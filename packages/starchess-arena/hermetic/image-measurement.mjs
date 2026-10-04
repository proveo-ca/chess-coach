// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdtemp, open, realpath, rm } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { evidenceLimits } from './evidence-limits.mjs';
import { archivePath, evidenceBudget, scanTarFile } from './tar.mjs';
import { sha256, sourceExclusions } from './manifest.mjs';
import pins from './pins.json' with { type: 'json' };
import { installedRoots, dependencyInputs, workspacePackages, workspaceManifestTarget } from './workspace-policy.mjs';

const roots = installedRoots;
const inputPaths = dependencyInputs;
const controlRoot = '/app/packages/starchess-arena/hermetic';
const mismatch = (label) => { throw new Error(`Image filesystem evidence mismatch: ${label}`); };
function equal(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) mismatch(label);
}

export async function dockerRead(args, { output, cap = evidenceLimits.metadataBytes, spawnProcess = spawn, timeoutMs = 120000 } = {}) {
  const file = output ? await open(output, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600) : null;
  let child;
  try {
    child = spawnProcess('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const closed = new Promise((resolve) => {
      let error;
      child.once('error', (value) => { error = value; });
      child.once('close', (code, signal) => resolve({ code, signal, error }));
    });
    let failure;
    const stop = (error) => { failure ??= error; child.kill('SIGKILL'); };
    const timer = setTimeout(() => stop(new Error('Docker measurement timeout')), timeoutMs);
    const chunks = [];
    let bytes = 0;
    let errorBytes = 0;
    const stderr = [];
    const consume = async (stream, isError) => {
      try {
        for await (const chunk of stream) {
          if (isError) {
            errorBytes += chunk.length;
            if (errorBytes > evidenceLimits.fileBytes) { stop(new Error('Docker stderr resource limit')); continue; }
            if (failure) continue;
            stderr.push(chunk);
          } else {
            bytes += chunk.length;
            if (bytes > cap) { stop(new Error('Docker stdout resource limit')); continue; }
            if (failure) continue;
            if (file) {
              let offset = 0;
              while (offset < chunk.length) {
                const written = await file.write(chunk, offset, chunk.length - offset);
                if (!written.bytesWritten) throw new Error('Short Docker archive write');
                offset += written.bytesWritten;
              }
            } else chunks.push(chunk);
          }
        }
      } catch (error) { stop(error); }
    };
    try {
      const [, , result] = await Promise.all([consume(child.stdout, false), consume(child.stderr, true), closed]);
      if (failure) throw failure;
      if (result.error) throw result.error;
      if (result.code !== 0) throw new Error(`Docker measurement command failed (${result.code ?? result.signal}): ${Buffer.concat(stderr).toString('utf8')}`);
      return file ? { bytes } : Buffer.concat(chunks).toString('utf8');
    } finally { clearTimeout(timer); }
  } finally { if (file) await file.close(); }
}

function virtualTree(entries, root, exclude = () => false) {
  if (entries.get(root)?.type !== 'directory') mismatch(`missing directory ${root}`);
  const children = new Map();
  for (const path of entries.keys()) {
    if (!path.startsWith(`${root}/`)) continue;
    const parent = posix.dirname(path);
    if (entries.get(parent)?.type !== 'directory') mismatch(`non-directory parent ${parent}`);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(path);
  }
  const result = [];
  const regular = (entry) => {
    const seen = new Set();
    while (entry?.type === 'hardlink') {
      if (seen.has(entry.path)) mismatch('hardlink cycle');
      seen.add(entry.path);
      entry = entries.get(archivePath(entry.target));
    }
    if (entry?.type !== 'file') mismatch('hardlink target');
    return entry;
  };
  const walk = (path) => {
    const name = path === root ? '.' : path.slice(root.length + 1);
    if (exclude(name)) return;
    const entry = entries.get(path);
    const item = { path: name, mode: entry.mode };
    if (entry.type === 'directory') {
      result.push({ ...item, type: 'directory' });
      for (const child of (children.get(path) ?? []).sort()) walk(child);
    } else if (entry.type === 'symlink') result.push({ ...item, type: 'symlink', target: entry.target, sha256: sha256(entry.target) });
    else {
      const file = regular(entry);
      result.push({ ...item, type: 'file', bytes: file.bytes, sha256: file.sha256 });
    }
  };
  walk(root);
  return { algorithm: 'sha256(JSON.stringify(entries))', sha256: sha256(JSON.stringify(result)), entries: result };
}

function fileAt(entries, path, follow = false) {
  path = archivePath(path.replace(/^\//, ''));
  const visited = new Set();
  for (let step = 0; step < 64; step++) {
    if (visited.has(path)) mismatch(`link cycle ${path}`);
    visited.add(path);
    const parts = path.split('/');
    let redirected = false;
    for (let i = 1; i <= parts.length; i++) {
      const prefix = parts.slice(0, i).join('/');
      const entry = entries.get(prefix);
      if (entry?.type === 'symlink') {
        if (!follow) mismatch(`symlink metadata ${prefix}`);
        const target = entry.target.startsWith('/') ? entry.target : `/${posix.dirname(prefix)}/${entry.target}`;
        path = archivePath(posix.resolve(target, ...parts.slice(i)).slice(1));
        redirected = true;
        break;
      }
    }
    if (redirected) continue;
    const entry = entries.get(path);
    if (entry?.type === 'hardlink') { path = archivePath(entry.target); continue; }
    if (entry?.type !== 'file') mismatch(`missing file ${path}`);
    return entry;
  }
  mismatch('link depth limit');
}
function jsonFile(entries, path, follow = false) {
  const entry = fileAt(entries, path, follow);
  if (!entry.data) mismatch(`unretained JSON ${path}`);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(entry.data));
}

export function measureCopiedFilesystem(entries, { interpreterSha256 = pins.nodeBinarySha256 } = {}) {
  const claim = (name, optional = false) => {
    const path = `/hermetic-evidence/${name}.json`;
    if (optional && !entries.has(path.slice(1))) return null;
    return { manifestSha256: fileAt(entries, path).sha256, value: jsonFile(entries, path) };
  };
  const dependency = claim('dependencies');
  const tools = claim('tools');
  const capture = claim('capture');
  const closure = claim('closure');
  const source = claim('source', true);
  const installed = roots.map((root) => ({ root, ...virtualTree(entries, root.slice(1)) }));
  const frozenStore = { root: '/pnpm/store', ...virtualTree(entries, 'pnpm/store') };
  const toolTree = { root: '/opt/pnpm', ...virtualTree(entries, 'opt/pnpm') };
  const dependencies = { version: 1, installed, installedSha256: sha256(JSON.stringify(installed)), frozenStore, tools: toolTree };
  equal(dependencies, dependency.value, 'dependencies manifest');
  const control = virtualTree(entries, source ? controlRoot.slice(1) : 'hermetic');
  equal(control, capture.value.control, 'capture control tree');
  equal(capture.value.dependencyFiles?.map((entry) => entry.path), inputPaths, 'capture input paths');
  const inputs = inputPaths.map((path) => ({ path, sha256: fileAt(entries, `/app/${path}`).sha256 }));
  equal(inputs, capture.value.dependencyFiles, 'capture input hashes');
  const actualPins = jsonFile(entries, `${source ? controlRoot : '/hermetic'}/pins.json`);
  const recordedPins = (value) => Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'nodeBinarySha256'));
  equal(recordedPins(tools.value.pins), recordedPins(actualPins), 'tool pins');
  for (const value of [tools.value.pins, actualPins]) if (Object.hasOwn(value, 'nodeBinarySha256') && value.nodeBinarySha256 !== interpreterSha256) mismatch('recorded Node binary pin');
  if (tools.value.node !== actualPins.node || tools.value.pnpm !== actualPins.pnpm) mismatch('tool versions');
  const artifact = fileAt(entries, '/opt/pnpm/artifact.tgz');
  if (!artifact.data) mismatch('unretained pnpm artifact');
  const integrity = `sha512-${createHash('sha512').update(artifact.data).digest('base64')}`;
  equal(tools.value.artifact, { integrity, sha256: artifact.sha256, bytes: artifact.bytes }, 'tool artifact');
  if (actualPins.pnpmIntegrity !== integrity || actualPins.pnpmSha256 !== artifact.sha256 || jsonFile(entries, '/opt/pnpm/package.json').version !== actualPins.pnpm) mismatch('measured pnpm artifact or version');
  equal(closure.value.tools, { node: tools.value.node, pnpm: tools.value.pnpm }, 'closure tools');
  if (closure.value.lockSha256 !== inputs[0].sha256) mismatch('closure lock');
  const packages = {};
  for (const name of workspacePackages) {
    const manifest = jsonFile(entries, `/app/packages/${name}/package.json`);
    if (manifest.name !== `@chess-coach/${name}`) mismatch('workspace manifest name');
    const versions = {};
    for (const [dependencyName, specifier] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
      const resolved = fileAt(entries, `/app/packages/${name}/node_modules/${dependencyName}/package.json`, true);
      if (specifier === 'workspace:*' && resolved.path !== workspaceManifestTarget(dependencyName).slice(1)) mismatch('workspace link');
      versions[dependencyName] = jsonFile(entries, resolved.path).version;
      if (dependencyName === '@noble/hashes' && (specifier !== '2.4.0' || versions[dependencyName] !== '2.4.0')) mismatch('SHA dependency pin');
    }
    packages[name] = versions;
  }
  equal(packages, closure.value.packages, 'closure package versions');
  const result = {
    dependencies: { manifestSha256: dependency.manifestSha256, installedSha256: dependencies.installedSha256, frozenStoreSha256: frozenStore.sha256, toolTreeSha256: toolTree.sha256 },
    tools: { manifestSha256: tools.manifestSha256, actual: tools.value },
    capture: { manifestSha256: capture.manifestSha256, inputs, controlSha256: control.sha256 },
    closure: { manifestSha256: closure.manifestSha256, actual: closure.value },
    method: 'host-scanned-unstarted-container-tar-v1',
  };
  if (source) {
    const tree = virtualTree(entries, 'app', (path) => path.split('/').includes('node_modules') || path === sourceExclusions[1] || path.startsWith(`${sourceExclusions[1]}/`));
    equal(source.value, { version: 1, root: '/app', exclusions: sourceExclusions, inventoryLocation: '/hermetic-evidence/source.json (outside inventoried root)', ...tree }, 'source manifest');
    equal(capture.value.runtime, tree, 'capture runtime tree');
    result.source = { manifestSha256: source.manifestSha256, sourceSha256: tree.sha256 };
  } else if (capture.value.dependenciesOnly !== true) mismatch('missing source manifest');
  return result;
}

async function withUnstartedImage(image, { spawnProcess = spawn, temporaryRoot = '/tmp/opencode', limits = evidenceLimits, timeoutMs = 120000, platform } = {}, measure) {
  if (!/^sha256:[0-9a-f]{64}$/.test(image)) throw new Error('Expected immutable image ID');
  const parent = await lstat(temporaryRoot);
  if (!parent.isDirectory() || parent.isSymbolicLink() || await realpath(temporaryRoot) !== temporaryRoot || parent.uid !== process.getuid()) throw new Error('Verified host-owned temporary parent required');
  const work = await mkdtemp(join(temporaryRoot, 'starchess-image-measurement-'));
  const read = (args, options = {}) => dockerRead(args, { spawnProcess, timeoutMs, ...options });
  let container;
  let cleanupName;
  let failure;
  try {
    const [inspection] = JSON.parse(await read(['image', 'inspect', image]));
    if (inspection?.Id !== image || inspection.Os !== 'linux' || inspection.Architecture !== 'amd64') mismatch('image inspection');
    const [platformInspection] = platform ? JSON.parse(await read(['image', 'inspect', '--platform', platform, image])) : [inspection];
    if (!/^sha256:[0-9a-f]{64}$/.test(platformInspection?.Id) || platformInspection.Os !== 'linux' || platformInspection.Architecture !== 'amd64' || platform && platform !== 'linux/amd64') mismatch('platform inspection');
    if (platform && platformInspection.Descriptor?.digest !== platformInspection.Id) mismatch('platform descriptor');
    cleanupName = `starchess-host-measurement-${randomUUID()}`;
    container = (await read(['create', '--name', cleanupName, '--pull=never', '--network=none', '--read-only', '--entrypoint', '/__host_measurement_never_started__', ...(platform ? ['--platform', platform] : []), image])).trim();
    if (!/^[0-9a-f]{64}$/.test(container)) mismatch('container ID');
    const [created] = JSON.parse(await read(['container', 'inspect', container]));
    if (![image, platformInspection.Id].includes(created?.Image) || created.State?.Status !== 'created' || created.State.Running !== false || created.State.Pid !== 0) mismatch('unstarted container inspection');
    if (platform && created.ImageManifestDescriptor?.digest !== platformInspection.Id) mismatch('container platform descriptor');
    const budget = evidenceBudget(limits);
    let archiveBytes = 0;
    let copies = 0;
    const copy = async (root, retain = () => false) => {
      const path = join(work, `copy-${copies++}.tar`);
      const copied = await read(['cp', `${container}:${root}`, '-'], { output: path, cap: limits.archiveBytes - archiveBytes });
      archiveBytes += copied.bytes;
      const scanned = await scanTarFile(path, { limits, budget, retain });
      await rm(path);
      return scanned;
    };
    return await measure({ copy, inspection, platformInspection, created });
  } catch (error) { failure = error; throw error; }
  finally {
    let cleanupError;
    if (cleanupName) {
      const target = container && /^[0-9a-f]{64}$/.test(container) ? container : cleanupName;
      try { await read(['container', 'rm', '--force', '--volumes', target]); } catch (error) { cleanupError = error; }
    }
    await rm(work, { recursive: true, force: true });
    if (cleanupError && !failure) throw cleanupError;
    if (cleanupError && failure) throw new AggregateError([failure, cleanupError], 'Measurement and container cleanup failed');
  }
}

async function copyInterpreter(copy) {
  const scanned = await copy('/usr/local/bin/node');
  const entry = scanned.entries.get('node');
  if (scanned.entries.size !== 1 || entry?.type !== 'file' || entry.mode !== '755') mismatch('Node interpreter file or mode');
  return { interpreter: { path: '/usr/local/bin/node', sha256: entry.sha256, bytes: entry.bytes }, copy: { archiveSha256: scanned.sha256, archiveBytes: scanned.bytes } };
}

export async function measureInterpreter(image, options = {}) {
  return withUnstartedImage(image, options, async ({ copy, inspection, platformInspection, created }) => ({
    ...await copyInterpreter(copy), imageInspection: inspection, platformImageInspection: platformInspection,
    containerInspection: created, method: 'host-scanned-unstarted-container-tar-v1',
  }));
}

export async function measureImageFilesystem(image, { interpreterSha256 = pins.nodeBinarySha256, ...options } = {}) {
  if (!/^[0-9a-f]{64}$/.test(interpreterSha256)) throw new Error('Trusted Node binary SHA-256 required');
  return withUnstartedImage(image, options, async ({ copy }) => {
    const { interpreter } = await copyInterpreter(copy);
    if (interpreter.sha256 !== interpreterSha256) mismatch('Node interpreter SHA-256');
    const entries = new Map();
    const copyTree = async (root) => {
      const basename = posix.basename(root);
      const scanned = await copy(root, (entry) => entry.type === 'file' && (root === '/hermetic-evidence' || entry.path.endsWith('/package.json') || entry.path === `${basename}/artifact.tgz` || entry.path.endsWith('/hermetic/pins.json') || root === '/hermetic' && entry.path === 'hermetic/pins.json'));
      if (scanned.entries.get(basename)?.type !== 'directory') mismatch(`copy directory ${root}`);
      for (const entry of scanned.entries.values()) {
        if (entry.path !== basename && !entry.path.startsWith(`${basename}/`)) mismatch(`copy root ${root}`);
        if (entry.path !== basename && scanned.entries.get(posix.dirname(entry.path))?.type !== 'directory') mismatch(`copy parent ${entry.path}`);
        const remap = (path) => `${root.slice(1)}${path.slice(basename.length)}`;
        const mapped = { ...entry, path: remap(entry.path) };
        if (entry.type === 'hardlink') {
          const target = archivePath(entry.target);
          if (target !== basename && !target.startsWith(`${basename}/`)) mismatch('hardlink outside copy');
          mapped.target = remap(target);
        }
        if (entries.has(mapped.path)) mismatch('overlapping copy roots');
        entries.set(mapped.path, mapped);
      }
    };
    for (const root of ['/app', '/pnpm/store', '/opt/pnpm', '/hermetic-evidence']) await copyTree(root);
    if (!entries.has('hermetic-evidence/source.json')) await copyTree('/hermetic');
    return { ...measureCopiedFilesystem(entries, { interpreterSha256 }), interpreter };
  });
}
