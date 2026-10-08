// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { sha256, treeManifest, sourceExclusions } from './manifest.mjs';
import { evidenceLimits } from './evidence-limits.mjs';
import { dockerRead, measureImageFilesystem as measureFilesystem, measureInterpreter } from './image-measurement.mjs';

const image = `sha256:${'1'.repeat(64)}`;
const container = '2'.repeat(64);
const interpreterBytes = Buffer.from('trusted fixture Node interpreter');
const measureImageFilesystem = (image, options) => measureFilesystem(image, { interpreterSha256: sha256(interpreterBytes), ...options });
const excluded = (path) => path.split('/').includes('node_modules') || path === sourceExclusions[1] || path.startsWith(`${sourceExclusions[1]}/`);
function tar(entries) {
  return Buffer.concat([...entries.flatMap((entry) => {
    const data = Buffer.from(entry.data ?? '');
    const header = Buffer.alloc(512);
    header.write(entry.path, 0, 100);
    for (const [offset, width, value] of [[100, 8, parseInt(entry.mode, 8)], [108, 8, 0], [116, 8, 0], [124, 12, data.length], [136, 12, 0]]) header.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width);
    header.fill(32, 148, 156);
    header.write(Object.entries({ file: '0', directory: '5', symlink: '2', hardlink: '1' }).find(([type]) => type === entry.type)[1], 156);
    if (entry.target) header.write(entry.target, 157, 100);
    header.write('ustar\0', 257);
    header.write('00', 263);
    header.write(header.reduce((n, byte) => n + byte, 0).toString(8).padStart(6, '0') + '\0 ', 148);
    return [header, data, Buffer.alloc((512 - data.length % 512) % 512)];
  }), Buffer.alloc(1024)]);
}
async function fixture(source, action) {
  const directory = await mkdtemp(join(tmpdir(), 'measurement-test-'));
  const temporaryRoot = join(directory, 'temporary');
  const filesystem = join(directory, 'filesystem');
  await mkdir(temporaryRoot, { mode: 0o700 });
  const write = async (path, value) => {
    const file = join(filesystem, path);
    await mkdir(dirname(file), { recursive: true, mode: 0o755 });
    await writeFile(file, typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value, null, 2) + '\n' : value, { mode: 0o644 });
  };
  try {
    const artifact = Buffer.from('measured acquisition artifact');
    const pins = { node: '22.23.2', pnpm: '10.33.0', pnpmSha256: sha256(artifact), pnpmIntegrity: `sha512-${createHash('sha512').update(artifact).digest('base64')}` };
    await write('opt/pnpm/artifact.tgz', artifact);
    await write('opt/pnpm/package.json', { version: pins.pnpm });
    await symlink('missing-target', join(filesystem, 'opt/pnpm/dangling'));
    await write('app/pnpm-lock.yaml', 'lock data\n');
    await write('app/packages/starchess-core/package.json', { name: '@chess-coach/starchess-core', version: '0.0.1', dependencies: { lib: '1.0.0' } });
    await write('app/packages/starchess-arena/package.json', { name: '@chess-coach/starchess-arena', version: '0.0.1', dependencies: { '@chess-coach/starchess-core': 'workspace:*' } });
    await write('app/packages/starchess-training/package.json', { name: '@chess-coach/starchess-training', version: '0.0.1', dependencies: { '@chess-coach/starchess-core': 'workspace:*', '@chess-coach/starchess-arena': 'workspace:*', 'jssha': '3.3.2' } });
    await write('app/packages/starchess-core/node_modules/lib/package.json', { version: '1.0.0' });
    await mkdir(join(filesystem, 'app/packages/starchess-arena/node_modules'), { recursive: true, mode: 0o755 });
    await mkdir(join(filesystem, 'app/packages/starchess-arena/node_modules/@chess-coach'), { recursive: true });
    await symlink('../../../starchess-core', join(filesystem, 'app/packages/starchess-arena/node_modules/@chess-coach/starchess-core'));
    await mkdir(join(filesystem, 'app/packages/starchess-training/node_modules/@chess-coach'), { recursive: true });
    await symlink('../../../starchess-core', join(filesystem, 'app/packages/starchess-training/node_modules/@chess-coach/starchess-core'));
    await symlink('../../../starchess-arena', join(filesystem, 'app/packages/starchess-training/node_modules/@chess-coach/starchess-arena'));
    await write('app/packages/starchess-training/node_modules/jssha/package.json', { name: 'jssha', version: '3.3.2' });
    await write('app/node_modules/z-child/value', 'z');
    await write('app/node_modules/a-child/value', 'a');
    await write('pnpm/store/z-file', 'content');
    await link(join(filesystem, 'pnpm/store/z-file'), join(filesystem, 'pnpm/store/a-hardlink'));
    await symlink('/app/node_modules', join(filesystem, 'pnpm/store/absolute-link'));
    await write('hermetic/pins.json', pins);
    await write('hermetic/control.mjs', 'old controls');
    const controlRoot = source ? 'app/packages/starchess-arena/hermetic' : 'hermetic';
    if (source) {
      await write(`${controlRoot}/pins.json`, pins);
      await write(`${controlRoot}/control.mjs`, 'new source controls');
      await write('app/source.txt', 'source bytes');
      await write('app/_spec/evidence/ml-adjutant-r2-refresh/excluded.txt', 'ignored');
      await symlink('../source.txt', join(filesystem, 'app/source-link'));
    }
    const roots = ['/app/node_modules', '/app/packages/starchess-core/node_modules', '/app/packages/starchess-arena/node_modules', '/app/packages/starchess-training/node_modules'];
    const installed = roots.map((root) => ({ root, ...treeManifest(join(filesystem, root)) }));
    const dependencies = { version: 1, installed, installedSha256: sha256(JSON.stringify(installed)), frozenStore: { root: '/pnpm/store', ...treeManifest(join(filesystem, 'pnpm/store')) }, tools: { root: '/opt/pnpm', ...treeManifest(join(filesystem, 'opt/pnpm')) } };
    await write('hermetic-evidence/dependencies.json', dependencies);
    await write('hermetic-evidence/tools.json', { pins, node: pins.node, pnpm: pins.pnpm, artifact: { integrity: pins.pnpmIntegrity, sha256: sha256(artifact), bytes: artifact.length } });
    const inputs = ['pnpm-lock.yaml', 'packages/starchess-core/package.json', 'packages/starchess-arena/package.json', 'packages/starchess-training/package.json'];
    const capture = { version: 1, dependenciesOnly: !source, dependencyFiles: await Promise.all(inputs.map(async (path) => ({ path, sha256: sha256(await readFile(join(filesystem, 'app', path))) }))), control: treeManifest(join(filesystem, controlRoot)) };
    if (source) {
      capture.runtime = treeManifest(join(filesystem, 'app'), { exclude: excluded });
      await write('hermetic-evidence/source.json', { version: 1, root: '/app', exclusions: sourceExclusions, inventoryLocation: '/hermetic-evidence/source.json (outside inventoried root)', ...capture.runtime });
    }
    await write('hermetic-evidence/capture.json', capture);
    await write('hermetic-evidence/closure.json', { tools: { node: pins.node, pnpm: pins.pnpm }, packages: { 'starchess-core': { lib: '1.0.0' }, 'starchess-arena': { '@chess-coach/starchess-core': '0.0.1' }, 'starchess-training': { '@chess-coach/starchess-core': '0.0.1', '@chess-coach/starchess-arena': '0.0.1', 'jssha': '3.3.2' } }, lockSha256: capture.dependencyFiles[0].sha256 });
    const streams = new Map();
    streams.set('/usr/local/bin/node', tar([{ path: 'node', mode: '755', type: 'file', data: interpreterBytes }]));
    const rebuild = async () => {
      for (const root of ['/app', '/pnpm/store', '/opt/pnpm', '/hermetic-evidence', '/hermetic']) {
        const entries = await Promise.all(treeManifest(join(filesystem, root)).entries.map(async (entry) => ({ ...entry, path: `${root.split('/').at(-1)}${entry.path === '.' ? '' : `/${entry.path}`}`, ...(entry.type === 'file' ? { data: await readFile(join(filesystem, root, entry.path)) } : {}) })));
        if (root === '/pnpm/store') {
          const hardlink = entries.find((entry) => entry.path === 'store/a-hardlink');
          hardlink.type = 'hardlink';
          hardlink.target = 'store/z-file';
          delete hardlink.data;
        }
        streams.set(root, tar(entries.reverse()));
      }
    };
    await rebuild();
    await action({ directory, temporaryRoot, filesystem, streams, write, rebuild, capture, dependencies, imagePins: pins });
  } finally { await rm(directory, { recursive: true, force: true }); }
}
function mockDocker(streams, { inspectChange, failCopy, wrongImage = false, malformedCreate = false, platformImageId, wrongPlatformDescriptor = false } = {}) {
  const calls = [];
  const kills = [];
  const spawnProcess = (program, args, options) => {
    assert.equal(program, 'docker');
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
    assert.ok(!args.some((arg) => ['start', 'run', 'exec'].includes(arg)));
    calls.push(args);
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    let closed = false;
    const close = (code, signal) => {
      if (closed) return;
      closed = true;
      child.stdout.end();
      child.stderr.end();
      child.emit('close', code, signal);
    };
    child.kill = (signal) => { kills.push({ args, signal }); queueMicrotask(() => close(null, signal)); return true; };
    queueMicrotask(() => {
      if (args[0] === 'image') child.stdout.write(JSON.stringify([{ Id: args.includes('--platform') ? platformImageId : image, Os: 'linux', Architecture: 'amd64', ...(args.includes('--platform') ? { Descriptor: { digest: platformImageId } } : {}) }]));
      else if (args[0] === 'create') child.stdout.write(malformedCreate ? 'malformed create output\n' : container + '\n');
      else if (args[0] === 'container' && args[1] === 'inspect') child.stdout.write(JSON.stringify([inspectChange ?? { Image: wrongImage ? `sha256:${'3'.repeat(64)}` : image, State: { Status: 'created', Running: false, Pid: 0 }, ...(platformImageId ? { ImageManifestDescriptor: { digest: wrongPlatformDescriptor ? `sha256:${'4'.repeat(64)}` : platformImageId } } : {}) }]));
      else if (args[0] === 'cp') {
        const root = args[1].slice(container.length + 1);
        if (failCopy === root) { child.stderr.write('copy failed'); close(1); return; }
        child.stdout.write(streams.get(root));
      } else {
        assert.deepEqual(args.slice(0, 4), ['container', 'rm', '--force', '--volumes']);
        if (malformedCreate) assert.match(args[4], /^starchess-host-measurement-[0-9a-f-]+$/);
        else assert.equal(args[4], container);
      }
      close(0);
    });
    return child;
  };
  return { spawnProcess, calls, kills };
}

for (const source of [false, true]) test(`measures ${source ? 'source' : 'dependency'} image using host tar streams`, () => fixture(source, async ({ temporaryRoot, streams, capture, dependencies }) => {
  const docker = mockDocker(streams);
  const result = await measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess });
  assert.equal(result.dependencies.installedSha256, dependencies.installedSha256);
  assert.equal(result.dependencies.frozenStoreSha256, dependencies.frozenStore.sha256);
  assert.equal(result.dependencies.toolTreeSha256, dependencies.tools.sha256);
  assert.equal(result.capture.controlSha256, capture.control.sha256);
  assert.deepEqual(result.capture.inputs, capture.dependencyFiles);
  assert.equal(result.source?.sourceSha256, capture.runtime?.sha256);
  assert.equal(result.tools.actual.pnpm, '10.33.0');
  assert.deepEqual(result.interpreter, { path: '/usr/local/bin/node', sha256: sha256(interpreterBytes), bytes: interpreterBytes.length });
  const copyRoots = docker.calls.filter((call) => call[0] === 'cp').map((call) => call[1].slice(container.length + 1));
  assert.deepEqual(copyRoots, source ? ['/usr/local/bin/node', '/app', '/pnpm/store', '/opt/pnpm', '/hermetic-evidence'] : ['/usr/local/bin/node', '/app', '/pnpm/store', '/opt/pnpm', '/hermetic-evidence', '/hermetic']);
  assert.deepEqual(docker.calls.at(-1), ['container', 'rm', '--force', '--volumes', container]);
  assert.deepEqual(await readdir(temporaryRoot), []);
}));
test('rejects interpreter replacement despite unchanged version claims and tree manifests', () => fixture(false, async ({ temporaryRoot, streams }) => {
  const evidence = streams.get('/hermetic-evidence');
  streams.set('/usr/local/bin/node', tar([{ path: 'node', mode: '755', type: 'file', data: 'replacement interpreter' }]));
  const docker = mockDocker(streams);
  await assert.rejects(measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess }), /Node interpreter SHA-256/);
  assert.equal(streams.get('/hermetic-evidence'), evidence);
  assert.equal(docker.calls.at(-1)[1], 'rm');
  assert.deepEqual(await readdir(temporaryRoot), []);
}));

test('rejects training arena link retargeted to core despite equal package versions and rebound installed claims', () => fixture(false, async ({ temporaryRoot, filesystem, streams, write, rebuild, dependencies }) => {
  const path = join(filesystem, 'app/packages/starchess-training/node_modules/@chess-coach/starchess-arena');
  await rm(path);
  await symlink('../../../starchess-core', path);
  dependencies.installed = dependencies.installed.map(({ root }) => ({ root, ...treeManifest(join(filesystem, root)) }));
  dependencies.installedSha256 = sha256(JSON.stringify(dependencies.installed));
  await write('hermetic-evidence/dependencies.json', dependencies);
  await rebuild();
  const docker = mockDocker(streams);
  await assert.rejects(measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess }), /workspace link/);
}));

test('rejects training dependency bytes changed under unchanged captured evidence', () => fixture(false, async ({ temporaryRoot, streams, write, rebuild }) => {
  await write('app/packages/starchess-training/node_modules/jssha/package.json', { name: 'jssha', version: '3.4.0' });
  await rebuild();
  const docker = mockDocker(streams);
  await assert.rejects(measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess }), /dependencies manifest/);
}));
test('production default rejects synthetic interpreter instead of trusting image pins', () => fixture(false, async ({ temporaryRoot, streams }) => {
  const docker = mockDocker(streams);
  await assert.rejects(measureFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess }), /Node interpreter SHA-256/);
  assert.deepEqual(await readdir(temporaryRoot), []);
}));
test('accepts new source control binary pin with unchanged older tool pin claims', () => fixture(true, async ({ temporaryRoot, filesystem, streams, write, rebuild, capture, imagePins }) => {
  await write('app/packages/starchess-arena/hermetic/pins.json', { ...imagePins, nodeBinarySha256: sha256(interpreterBytes) });
  capture.control = treeManifest(join(filesystem, 'app/packages/starchess-arena/hermetic'));
  capture.runtime = treeManifest(join(filesystem, 'app'), { exclude: excluded });
  await write('hermetic-evidence/capture.json', capture);
  await write('hermetic-evidence/source.json', { version: 1, root: '/app', exclusions: sourceExclusions, inventoryLocation: '/hermetic-evidence/source.json (outside inventoried root)', ...capture.runtime });
  await rebuild();
  const docker = mockDocker(streams);
  const result = await measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess });
  assert.equal(result.source.sourceSha256, capture.runtime.sha256);
  assert.equal(Object.hasOwn(result.tools.actual.pins, 'nodeBinarySha256'), false);
  assert.equal(result.interpreter.sha256, sha256(interpreterBytes));
}));
test('rejects a recorded binary pin that conflicts with the independently trusted pin', () => fixture(false, async ({ temporaryRoot, filesystem, streams, write, rebuild, capture, imagePins }) => {
  await write('hermetic/pins.json', { ...imagePins, nodeBinarySha256: '0'.repeat(64) });
  capture.control = treeManifest(join(filesystem, 'hermetic'));
  await write('hermetic-evidence/capture.json', capture);
  await rebuild();
  const docker = mockDocker(streams);
  await assert.rejects(measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess }), /recorded Node binary pin/);
  assert.deepEqual(await readdir(temporaryRoot), []);
}));
for (const [label, entries] of [
  ['non-executable mode', [{ path: 'node', mode: '644', type: 'file', data: interpreterBytes }]],
  ['setuid mode', [{ path: 'node', mode: '4755', type: 'file', data: interpreterBytes }]],
  ['symlink', [{ path: 'node', mode: '777', type: 'symlink', target: '/replacement' }]],
  ['hardlink', [{ path: 'node', mode: '755', type: 'hardlink', target: 'replacement' }]],
  ['extra file', [{ path: 'node', mode: '755', type: 'file', data: interpreterBytes }, { path: 'extra', mode: '644', type: 'file', data: 'x' }]],
]) test(`rejects interpreter ${label}`, () => fixture(false, async ({ temporaryRoot, streams }) => {
  streams.set('/usr/local/bin/node', tar(entries));
  const docker = mockDocker(streams);
  await assert.rejects(measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess }), /Node interpreter file or mode/);
  assert.equal(docker.calls.at(-1)[1], 'rm');
  assert.deepEqual(await readdir(temporaryRoot), []);
}));
test('interpreter helper returns copied-file hash and immutable-image provenance', () => fixture(false, async ({ temporaryRoot, streams }) => {
  const platformImageId = `sha256:${'3'.repeat(64)}`;
  const docker = mockDocker(streams, { platformImageId });
  const result = await measureInterpreter(image, { temporaryRoot, spawnProcess: docker.spawnProcess, platform: 'linux/amd64' });
  assert.deepEqual(result.interpreter, { path: '/usr/local/bin/node', sha256: sha256(interpreterBytes), bytes: interpreterBytes.length });
  assert.equal(result.copy.archiveSha256, sha256(streams.get('/usr/local/bin/node')));
  assert.equal(result.imageInspection.Id, image);
  assert.equal(result.platformImageInspection.Id, platformImageId);
  assert.equal(result.containerInspection.ImageManifestDescriptor.digest, platformImageId);
  assert.deepEqual(docker.calls.filter((args) => args[0] === 'cp').map((args) => args[1]), [`${container}:/usr/local/bin/node`]);
  assert.deepEqual(await readdir(temporaryRoot), []);
}));
test('interpreter helper rejects the wrong selected-platform container descriptor', () => fixture(false, async ({ temporaryRoot, streams }) => {
  const docker = mockDocker(streams, { platformImageId: `sha256:${'3'.repeat(64)}`, wrongPlatformDescriptor: true });
  await assert.rejects(measureInterpreter(image, { temporaryRoot, spawnProcess: docker.spawnProcess, platform: 'linux/amd64' }), /container platform descriptor/);
  assert.equal(docker.calls.at(-1)[1], 'rm');
  assert.deepEqual(await readdir(temporaryRoot), []);
}));
for (const [label, source, path, value, pattern] of [
  ['source changed', true, 'app/source.txt', 'tampered', /source manifest/],
  ['installed changed', false, 'app/node_modules/z-child/value', 'tampered', /dependencies manifest/],
  ['store changed', false, 'pnpm/store/z-file', 'tampered', /dependencies manifest/],
  ['tools changed', false, 'opt/pnpm/package.json', { version: 'tampered' }, /dependencies manifest/],
  ['control changed', false, 'hermetic/control.mjs', 'tampered', /control tree/],
  ['new source control changed', true, 'app/packages/starchess-arena/hermetic/control.mjs', 'tampered', /control tree/],
  ['input changed', false, 'app/pnpm-lock.yaml', 'tampered', /input hashes/],
  ['closure forged', false, 'hermetic-evidence/closure.json', { tools: { node: '22.23.2', pnpm: '10.33.0' }, packages: {}, lockSha256: sha256('lock data\n') }, /closure package versions/],
]) test(`rejects ${label} and cleans up`, () => fixture(source, async ({ temporaryRoot, streams, write, rebuild }) => {
  await write(path, value);
  await rebuild();
  const docker = mockDocker(streams);
  await assert.rejects(measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess }), pattern);
  assert.equal(docker.calls.at(-1)[1], 'rm');
  assert.deepEqual(await readdir(temporaryRoot), []);
}));
test('does not substitute cloned old controls for source controls', () => fixture(true, async ({ temporaryRoot, streams, write, rebuild }) => {
  await write('hermetic/control.mjs', 'unrelated old cloned control');
  await rebuild();
  const docker = mockDocker(streams);
  await measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess });
  assert.ok(!docker.calls.some((call) => call[0] === 'cp' && call[1].endsWith(':/hermetic')));
}));
for (const [label, options, pattern] of [
  ['image mismatch', { wrongImage: true }, /unstarted container inspection/],
  ['started container', { inspectChange: { Image: image, State: { Status: 'running', Running: true, Pid: 123 } } }, /unstarted container inspection/],
  ['copy command failure', { failCopy: '/pnpm/store' }, /copy failed/],
]) test(`rejects ${label} and removes container`, () => fixture(false, async ({ temporaryRoot, streams }) => {
  const docker = mockDocker(streams, options);
  await assert.rejects(measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess }), pattern);
  assert.equal(docker.calls.at(-1)[1], 'rm');
  assert.deepEqual(await readdir(temporaryRoot), []);
}));
test('kills and reaps over-cap docker cp and cleans all temporary files', () => fixture(false, async ({ temporaryRoot, streams }) => {
  const docker = mockDocker(streams);
  await assert.rejects(measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess, limits: { ...evidenceLimits, archiveBytes: 1024 } }), /stdout resource limit/);
  assert.equal(docker.kills[0].args[0], 'cp');
  assert.equal(docker.kills[0].signal, 'SIGKILL');
  assert.equal(docker.calls.at(-1)[1], 'rm');
  assert.deepEqual(await readdir(temporaryRoot), []);
}));
test('rejects tar path traversal before measurement', () => fixture(false, async ({ temporaryRoot, streams }) => {
  streams.set('/app', tar([{ path: '../escape', type: 'file', mode: '644', data: 'x' }]));
  const docker = mockDocker(streams);
  await assert.rejects(measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess }), /unsafe path/);
  assert.equal(docker.calls.at(-1)[1], 'rm');
  assert.deepEqual(await readdir(temporaryRoot), []);
}));
test('requires cp filesystem tar rather than fake measurement JSON', () => fixture(false, async ({ temporaryRoot, streams }) => {
  streams.set('/app', Buffer.from(JSON.stringify({ source: { sourceSha256: 'forged' } })));
  const docker = mockDocker(streams);
  await assert.rejects(measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess }), /truncated archive/);
}));
test('cleans created container by host-chosen name when stdout is malformed', () => fixture(false, async ({ temporaryRoot, streams }) => {
  const docker = mockDocker(streams, { malformedCreate: true });
  await assert.rejects(measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess }), /container ID/);
  const create = docker.calls.find((args) => args[0] === 'create');
  assert.equal(create[create.indexOf('--name') + 1], docker.calls.at(-1)[4]);
  assert.deepEqual(await readdir(temporaryRoot), []);
}));
test('rejects copied descendants beneath a symlink without following it', () => fixture(false, async ({ temporaryRoot, streams }) => {
  streams.set('/app', tar([{ path: 'app', type: 'directory', mode: '755' }, { path: 'app/link', type: 'symlink', mode: '777', target: '/host' }, { path: 'app/link/file', type: 'file', mode: '644', data: 'x' }]));
  const docker = mockDocker(streams);
  await assert.rejects(measureImageFilesystem(image, { temporaryRoot, spawnProcess: docker.spawnProcess }), /copy parent/);
  assert.deepEqual(await readdir(temporaryRoot), []);
}));
test('times out, kills, and waits for command close', async () => {
  let reaped = false;
  const spawnProcess = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = (signal) => {
      assert.equal(signal, 'SIGKILL');
      setTimeout(() => { reaped = true; child.stdout.end(); child.stderr.end(); child.emit('close', null, signal); }, 5);
    };
    return child;
  };
  await assert.rejects(dockerRead(['cp', 'container:/app', '-'], { spawnProcess, timeoutMs: 5 }), /timeout/);
  assert.equal(reaped, true);
});
