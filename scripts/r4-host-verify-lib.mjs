// SPEC: _spec/packages/starchess-training/r4-host-verification.puml
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync, constants, existsSync, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync,
  mkdtempSync, openSync, readdirSync, readlinkSync, readSync,
  realpathSync, writeFileSync, writeSync,
} from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

export const KIND = 'r4-host-diagnostics-v1';
export const PACKAGES = Object.freeze(['starchess-core', 'starchess-arena', 'starchess-training']);
export const OPEN_GATES = Object.freeze(['budget', 'B1', 'runtime-image', 'same-graph', 'exports', 'cold-positive', 'capture', 'full-reviews']);
export const LIMITS = Object.freeze({ logBytes: 8 * 1024 * 1024, reportBytes: 16 * 1024 * 1024,
  fileBytes: 512 * 1024 * 1024, totalBytes: 4 * 1024 * 1024 * 1024, entries: 100000,
  terminateMs: 2000, reapMs: 5000 });
export const COMMAND_DEADLINES = Object.freeze({ staticMs: 600000, packageMs: 3600000, evidenceMs: 900000 });
const GENERATED = new Set(['node_modules', '.git', '.pnpm-store', '.cache', '.vite', '.vitest', '.nx',
  '.vite-temp', '.wrangler', 'dist', 'dist-ssr', 'build', 'out', 'out-tsc', 'coverage', 'coverage-full',
  'test-results', 'playwright-report', 'storybook-static']);
const generatedInput = path => {
  const parts = path.split('/'), name = parts.at(-1);
  return name === 'node_modules' || name === '.git' || name.endsWith('.tsbuildinfo') ||
    parts.length === 3 && parts[0] === 'packages' && PACKAGES.includes(parts[1]) && GENERATED.has(name);
};
const ROOT_INPUTS = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', '.pnpmfile.cjs',
  'pnpmfile.cjs', 'tsconfig.json', 'tsconfig.base.json', 'nx.json', '.gitignore', '.dockerignore',
  'Dockerfile', 'compose.yml', 'AGENTS.md', 'CLAUDE.md', 'PLAN.md', 'README.md', 'MINIMUM_REQUIREMENTS.md'];
const LIMITATION = 'Host byte snapshots are not an immutable loader or a sandbox; installed dependency discovery cannot prove every dynamic/native/system load. No host result establishes R4 acceptance.';
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const within = (parent, path) => path === parent || path.startsWith(parent + sep);
const message = error => error instanceof Error ? error.message : String(error);
const entryExists = path => {
  try { lstatSync(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
};
const secret = name => /^\.env(?:$|\.)/.test(name) && name !== '.env.example' ||
  /\.(?:pem|key|p12|pfx|keystore)$/i.test(name) || /^(?:id_rsa|id_ed25519|credentials|\.netrc)$/i.test(name);

export function parseArgs(argv) {
  const result = { stage: 'static', mode: 'diagnose', tempParent: tmpdir() };
  const seen = new Set();
  const keys = { '--stage': 'stage', '--mode': 'mode', '--temp-parent': 'tempParent' };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!Object.hasOwn(keys, key) || seen.has(key) || typeof argv[i + 1] !== 'string' || !argv[i + 1] || argv[i + 1].startsWith('--')) {
      throw new Error('Usage: r4-host-verify.mjs [--stage static|full] [--mode diagnose|accept] [--temp-parent existing-canonical-path]; unknown, duplicate, or missing option');
    }
    seen.add(key);
    result[keys[key]] = argv[i + 1];
  }
  if (!['static', 'full'].includes(result.stage) || !['diagnose', 'accept'].includes(result.mode) || /[\0\r\n]/.test(result.tempParent)) throw new Error('Invalid stage, mode, or temp parent');
  return result;
}

export function blockedResult(options) {
  return { kind: KIND, stage: options.stage, mode: options.mode, status: 'BLOCKED', diagnosticsComplete: false,
    checksPassed: false, r4Acceptance: 'NOT_ESTABLISHED', openGates: [...OPEN_GATES], commands: [],
    errors: ['Acceptance remains blocked until actual positive proofs and independent reviews exist.'], limitations: [LIMITATION] };
}

export function createScratch(root, parent) {
  if (!isAbsolute(parent) || resolve(parent) !== parent || realpathSync(parent) !== parent || !lstatSync(parent).isDirectory()) throw new Error('Temp parent must be an existing canonical absolute directory');
  if (within(root, parent)) throw new Error('Scratch must be external to the repository');
  let ancestor = parent;
  while (true) {
    const stat = lstatSync(ancestor);
    if (!stat.isDirectory() || process.getuid && stat.uid !== 0 && stat.uid !== process.getuid() ||
        (stat.mode & 0o022) !== 0 && (stat.mode & 0o1000) === 0) throw new Error(`Untrusted writable scratch ancestor: ${ancestor}`);
    if (ancestor === dirname(ancestor)) break;
    ancestor = dirname(ancestor);
  }
  const directory = mkdtempSync(join(parent, 'r4-host-'));
  const descriptor = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(descriptor), pathStat = lstatSync(directory);
    if (!before.isDirectory() || before.dev !== pathStat.dev || before.ino !== pathStat.ino || process.getuid && before.uid !== process.getuid()) throw new Error('Scratch directory identity changed');
    fchmodSync(descriptor, 0o700);
  } finally { closeSync(descriptor); }
  for (const name of ['logs', 'reports', 'manifests', 'tmp', 'home', 'cache', 'config', 'data']) mkdirSync(join(directory, name), { mode: 0o700 });
  return directory;
}

export function controlledEnvironment(directory) {
  return { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, TMPDIR: join(directory, 'tmp'),
    TMP: join(directory, 'tmp'), TEMP: join(directory, 'tmp'), HOME: join(directory, 'home'),
    XDG_CACHE_HOME: join(directory, 'cache'), XDG_CONFIG_HOME: join(directory, 'config'),
    XDG_DATA_HOME: join(directory, 'data'), CI: '1', TZ: 'UTC', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' };
}

function fileDigest(path, budget, allowHardlinks = false) {
  if (realpathSync(dirname(path)) !== dirname(path)) throw new Error(`Noncanonical file ancestor: ${path}`);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || !allowHardlinks && before.nlink !== 1) throw new Error(`Special or aliased source file: ${path}`);
    if (before.size > LIMITS.fileBytes || budget.bytes + before.size > LIMITS.totalBytes) throw new Error(`Manifest byte limit: ${path}`);
    budget.bytes += before.size;
    const digest = createHash('sha256');
    const chunk = Buffer.alloc(65536);
    for (let offset = 0; offset < before.size;) {
      const count = readSync(fd, chunk, 0, Math.min(chunk.length, before.size - offset), offset);
      if (!count) throw new Error(`Truncated manifest input: ${path}`);
      digest.update(chunk.subarray(0, count));
      offset += count;
    }
    const after = fstatSync(fd);
    if (['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs'].some(key => before[key] !== after[key])) throw new Error(`Input changed during read: ${path}`);
    return { bytes: before.size, mode: before.mode & 0o7777, sha256: digest.digest('hex') };
  } finally { closeSync(fd); }
}

function envelope(entries) {
  entries.sort((a, b) => order(a.path, b.path));
  return { sha256: hash(JSON.stringify(entries)), entries };
}

function readSmall(path, cap = LIMITS.reportBytes, allowHardlinks = false) {
  if (realpathSync(dirname(path)) !== dirname(path)) throw new Error(`Noncanonical report ancestor: ${path}`);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || !allowHardlinks && before.nlink !== 1 || before.size > cap) throw new Error(`Invalid or oversized report: ${path}`);
    const bytes = Buffer.alloc(before.size);
    for (let offset = 0; offset < bytes.length;) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count) throw new Error(`Truncated report: ${path}`);
      offset += count;
    }
    const after = fstatSync(fd);
    if (bytes.length !== before.size || ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs'].some(key => before[key] !== after[key])) throw new Error(`Report changed during read: ${path}`);
    return bytes;
  } finally { closeSync(fd); }
}

export function snapshotInputs(root) {
  if (realpathSync(root) !== root) throw new Error('Repository must be canonical');
  const source = [], docs = [];
  const budget = { bytes: 0 };
  const add = (path, record) => {
    if (source.length + docs.length >= LIMITS.entries) throw new Error('Input manifest entry limit');
    (path.startsWith('_spec/') || /\.(?:md|puml|mmd|mermaid)$/.test(path) ? docs : source).push({ path, ...record });
  };
  const walk = path => {
    const name = path.split('/').at(-1);
    if (generatedInput(path)) return;
    if (secret(name)) throw new Error(`Secret-like input rejected: ${path}`);
    const absolute = join(root, path);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Symlink source rejected: ${path}`);
    if (stat.isDirectory()) {
      add(path, { type: 'directory', mode: stat.mode & 0o7777 });
      for (const child of readdirSync(absolute).sort(order)) walk(`${path}/${child}`);
    } else if (stat.isFile()) {
      const record = fileDigest(absolute, budget);
      if (name === '.npmrc' && /(?:_auth|token|password)\s*=/i.test(readSmall(absolute).toString('utf8'))) throw new Error(`Credential-bearing config rejected: ${path}`);
      add(path, { type: 'file', ...record });
    } else throw new Error(`Special source rejected: ${path}`);
  };
  for (const path of [...PACKAGES.map(name => `packages/${name}`), 'scripts', '_spec']) walk(path);
  const roots = new Set(ROOT_INPUTS);
  for (const name of readdirSync(root)) if (/^(?:tsconfig|vitest\.config|vite\.config)(?:[.-].*)?\.(?:json|jsonc|[cm]?[jt]s)$/.test(name)) roots.add(name);
  const corpusManifest = join(root, '_spec/corpora/ml-adjutant-corpus.manifest.json');
  if (entryExists(corpusManifest)) {
    const corpus = JSON.parse(readSmall(corpusManifest));
    if (typeof corpus.sourcePath !== 'string' || !/^[a-zA-Z0-9._-]+\.json$/.test(corpus.sourcePath) || secret(corpus.sourcePath)) throw new Error('Invalid root corpus sourcePath');
    roots.add(corpus.sourcePath);
    if (!entryExists(join(root, corpus.sourcePath))) throw new Error('Selected root corpus missing');
  }
  const configurationSeeds = new Set([...PACKAGES.map(name => `packages/${name}/tsconfig.json`),
    ...[...roots].filter(path => /^tsconfig.*\.jsonc?$/.test(path))]);
  const visitedConfigs = new Set(), activeConfigs = new Set();
  const existingInputs = new Set([...source, ...docs].map(entry => entry.path));
  const visitConfig = path => {
    if (!entryExists(join(root, path))) return;
    if (activeConfigs.has(path)) throw new Error(`Cyclic configuration extends: ${path}`);
    if (visitedConfigs.has(path)) return;
    if (!within(root, join(root, path)) || path.split('/').some(secret) || generatedInput(path)) throw new Error(`Unsafe configuration path: ${path}`);
    const absolute = join(root, path);
    if (!existingInputs.has(path)) { walk(path); existingInputs.add(path); }
    const ts = createRequire(new URL('../packages/starchess-arena/package.json', import.meta.url))('typescript');
    const parsed = ts.parseConfigFileTextToJson(path, readSmall(absolute).toString('utf8'));
    if (parsed.error || !parsed.config || typeof parsed.config !== 'object' || Array.isArray(parsed.config)) throw new Error(`Invalid configuration JSONC: ${path}`);
    activeConfigs.add(path);
    const parents = parsed.config.extends === undefined ? [] : Array.isArray(parsed.config.extends) ? parsed.config.extends : [parsed.config.extends];
    for (const value of parents) {
      if (typeof value !== 'string' || !value.startsWith('.') || value.includes('\\')) throw new Error(`Unsupported configuration extends: ${path}`);
      const target = resolve(dirname(absolute), value);
      if (!within(root, target)) throw new Error(`Configuration extends escapes repository: ${path}`);
      const candidates = (extname(target) ? [target] : [target, `${target}.json`]).filter(candidate => entryExists(candidate));
      if (candidates.length !== 1) throw new Error(`Missing or ambiguous configuration extends: ${path}`);
      const selected = candidates[0];
      if (!lstatSync(selected).isFile() || realpathSync(selected) !== selected) throw new Error(`Invalid configuration ancestor: ${path}`);
      visitConfig(relative(root, selected).split(sep).join('/'));
    }
    activeConfigs.delete(path);
    visitedConfigs.add(path);
  };
  for (const path of configurationSeeds) visitConfig(path);
  for (const path of [...roots].sort(order)) {
    if (entryExists(join(root, path))) { if (!existingInputs.has(path)) walk(path); }
    else add(path, { type: 'missing' });
  }
  return { source: envelope(source), docs: envelope(docs), exclusions: { nestedMetadata: ['node_modules', '.git'],
    packageRootOutputs: [...GENERATED], suffixes: ['*.tsbuildinfo'] },
    selection: 'All eligible bytes under the three packages, scripts, and _spec; fixed root controls/configs and manifest-selected root corpus. Includes untracked and ignored inputs; root secrets are not selected.' };
}

const packageName = name => typeof name === 'string' && /^(?:@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+$/.test(name) && !name.includes('..');

function installedPackage(root, from, name) {
  if (!packageName(name)) throw new Error(`Invalid dependency name: ${name}`);
  for (let directory = from; within(root, directory); directory = dirname(directory)) {
    const logical = join(directory, 'node_modules', name);
    if (existsSync(logical)) {
      const target = realpathSync(logical);
      const workspace = PACKAGES.some(entry => target === join(root, 'packages', entry));
      if (!within(join(root, 'node_modules'), target) && !PACKAGES.some(entry => within(join(root, 'packages', entry, 'node_modules'), target)) && !workspace) throw new Error(`Dependency escapes selected installation: ${logical}`);
      const manifest = JSON.parse(readSmall(join(target, 'package.json'), LIMITS.reportBytes, true));
      if (manifest.name !== name) throw new Error(`Dependency name mismatch: ${logical}`);
      return { logical, target, manifest, link: lstatSync(logical).isSymbolicLink() ? readlinkSync(logical) : null, workspace };
    }
    if (directory === root) break;
  }
  throw new Error(`Missing installed dependency: ${name} from ${relative(root, from)}`);
}

export function resolveTool(root, owner, tool) {
  const names = { tsc: 'typescript', tsx: 'tsx', vitest: 'vitest' };
  if (!PACKAGES.includes(owner) || !Object.hasOwn(names, tool)) throw new Error('Tool is not in the fixed allowlist');
  const ownerManifest = JSON.parse(readSmall(join(root, 'packages', owner, 'package.json')));
  if (!Object.hasOwn({ ...ownerManifest.dependencies, ...ownerManifest.devDependencies }, names[tool])) throw new Error(`Tool not declared by fixed package: ${owner}/${tool}`);
  const installed = installedPackage(root, join(root, 'packages', owner), names[tool]);
  const bin = typeof installed.manifest.bin === 'string' ? installed.manifest.bin : installed.manifest.bin?.[tool];
  if (typeof bin !== 'string' || isAbsolute(bin) || bin.split(/[\\/]/).includes('..')) throw new Error(`Invalid local ${tool} entrypoint`);
  const path = realpathSync(join(installed.target, bin));
  if (!within(installed.target, path) || !lstatSync(path).isFile()) throw new Error(`Escaping local ${tool} entrypoint`);
  return path;
}

export function snapshotDependencies(root) {
  const entries = [];
  const budget = { bytes: 0 };
  const seen = new Set();
  const visited = new Set();
  const add = entry => {
    if (entries.length >= LIMITS.entries) throw new Error('Dependency entry limit');
    entries.push(entry);
  };
  const workspace = path => PACKAGES.some(name => path === join(root, 'packages', name));
  const allowed = path => within(join(root, 'node_modules'), path) || PACKAGES.some(name => within(join(root, 'packages', name, 'node_modules'), path)) || workspace(path);
  const walk = path => {
    if (seen.has(path)) return;
    seen.add(path);
    const stat = lstatSync(path);
    const label = relative(root, path);
    if (stat.isSymbolicLink()) {
      const target = realpathSync(path);
      if (!allowed(target)) throw new Error(`Installed symlink escapes closure: ${label}`);
      add({ path: label, type: 'symlink', link: readlinkSync(path), target: relative(root, target) });
      if (!workspace(target)) walk(target);
    } else if (stat.isDirectory()) {
      add({ path: label, type: 'directory', mode: stat.mode & 0o7777 });
      for (const name of readdirSync(path).sort(order)) walk(join(path, name));
    } else if (stat.isFile()) add({ path: label, type: 'file', ...fileDigest(path, budget, true) });
    else throw new Error(`Special installed file: ${label}`);
  };
  const visit = (from, name, optional = false) => {
    let installed;
    try { installed = installedPackage(root, from, name); }
    catch (error) {
      if (!optional || !message(error).startsWith('Missing installed dependency:')) throw error;
      add({ path: `resolution:${relative(root, from)}:${name}`, type: 'optional-missing' });
      return;
    }
    add({ path: `resolution:${relative(root, from)}:${name}`, type: 'resolution', logical: relative(root, installed.logical),
      target: relative(root, installed.target), link: installed.link, version: installed.manifest.version ?? null });
    if (installed.workspace || visited.has(installed.target)) return;
    visited.add(installed.target);
    walk(installed.target);
    const required = installed.manifest.dependencies ?? {};
    const optionalDeps = installed.manifest.optionalDependencies ?? {};
    const peers = installed.manifest.peerDependencies ?? {};
    for (const dependency of [...new Set([...Object.keys(required), ...Object.keys(optionalDeps), ...Object.keys(peers)])].sort(order)) {
      visit(installed.target, dependency, Object.hasOwn(optionalDeps, dependency) || !Object.hasOwn(required, dependency) && Object.hasOwn(peers, dependency));
    }
  };
  for (const name of PACKAGES) {
    const path = join(root, 'packages', name);
    const manifest = JSON.parse(readSmall(join(path, 'package.json')));
    for (const dependency of [...new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {}), ...Object.keys(manifest.optionalDependencies ?? {})])].sort(order)) {
      visit(path, dependency, Object.hasOwn(manifest.optionalDependencies ?? {}, dependency));
    }
  }
  const executable = realpathSync(process.execPath);
  add({ path: 'host:node', type: 'file', executable: process.execPath, resolved: executable,
    version: process.version, platform: process.platform, arch: process.arch, ...fileDigest(executable, budget, true) });
  return envelope(entries);
}

export function validateVitestReport(value) {
  const integer = key => {
    if (!Number.isSafeInteger(value?.[key]) || value[key] < 0) throw new Error(`Vitest invalid count: ${key}`);
    return value[key];
  };
  const total = integer('numTotalTests');
  const passed = integer('numPassedTests');
  const failed = integer('numFailedTests');
  const pending = integer('numPendingTests');
  const todo = integer('numTodoTests');
  const suites = integer('numTotalTestSuites');
  const passedSuites = integer('numPassedTestSuites');
  const failedSuites = integer('numFailedTestSuites');
  const pendingSuites = integer('numPendingTestSuites');
  if (value.success !== true || total === 0 || passed !== total || failed || pending || todo || suites === 0 || passedSuites !== suites || failedSuites || pendingSuites || value.wasInterrupted === true) throw new Error('Vitest failed, skipped, todo, empty, or incomplete run');
  if (!Array.isArray(value.testResults) || value.testResults.length === 0) throw new Error('Vitest test results missing');
  let assertions = 0;
  const names = new Set();
  for (const result of value.testResults) {
    if (result.status !== 'passed' || result.message !== '' || typeof result.name !== 'string' || !result.name || names.has(result.name) ||
        !Array.isArray(result.assertionResults) || result.assertionResults.length === 0) throw new Error('Vitest incomplete suite');
    names.add(result.name);
    for (const assertion of result.assertionResults) {
      if (assertion.status !== 'passed' || !Array.isArray(assertion.failureMessages) || assertion.failureMessages.length) throw new Error('Vitest failed or omitted assertion');
      assertions++;
    }
  }
  if (assertions !== total || suites < value.testResults.length) throw new Error('Vitest assertion/suite count mismatch');
  if (value.testExecError || value.snapshot?.failure === true) throw new Error('Vitest execution or snapshot error');
  return { total, passed, failed, pending, todo, suites, files: value.testResults.length, assertions };
}

export function readFreshReport(path) {
  const bytes = readSmall(path);
  return { path, bytes: bytes.length, sha256: hash(bytes), ...validateVitestReport(JSON.parse(bytes)) };
}

export function validateNodeTap(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!text.startsWith('TAP version 13\n') || /^\s*not ok\b|^\s*Bail out!|^\s*(?:ok|not ok)\b[^\n]*#\s*(?:SKIP|TODO)\b/im.test(text)) throw new Error('Node TAP failed or omitted tests');
  const counts = {};
  for (const name of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const matches = [...text.matchAll(new RegExp(`^# ${name} (\\d+)$`, 'gm'))];
    if (matches.length !== 1) throw new Error(`Node TAP incomplete ${name} summary`);
    counts[name] = Number(matches[0][1]);
  }
  const plans = [...text.matchAll(/^1\.\.(\d+)$/gm)], records = [...text.matchAll(/^ok (\d+)(?: -[^\n]*)?$/gm)];
  if (plans.length !== 1 || Number(plans[0][1]) !== records.length || records.some((record, index) => Number(record[1]) !== index + 1) ||
      /^\s+(?:ok|not ok)\b/m.test(text) || !/^# suites 0$/m.test(text) ||
      !Number.isSafeInteger(counts.tests) || counts.tests < 1 || counts.tests !== records.length || counts.pass !== counts.tests ||
      ['fail', 'cancelled', 'skipped', 'todo'].some(key => counts[key] !== 0)) throw new Error('Node TAP plan/result/summary mismatch or unsupported nested run');
  return counts;
}

export function runChild(args, { cwd, env, directory, prefix, signal, testReport, nodeTap = false, timeoutMs = COMMAND_DEADLINES.staticMs } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) return Promise.reject(new Error('Invalid diagnostic command deadline'));
  if (testReport && entryExists(testReport)) return Promise.reject(new Error('Test report must be absent before spawn'));
  return new Promise((done, reject) => {
    const logs = {};
    const handles = {};
    try {
      for (const stream of ['stdout', 'stderr']) {
        const path = join(directory, `${prefix}.${stream}.log`);
        handles[stream] = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        logs[stream] = { path, bytes: 0, observedBytes: 0, truncated: false, sha256: null };
      }
    } catch (error) {
      for (const fd of Object.values(handles)) closeSync(fd);
      reject(error);
      return;
    }
    const started = new Date().toISOString();
    let child, timer, reapTimer, executionTimer, completed = false, exited = false, exitCode = null, actualSignal = null;
    let timedOut = false;
    let error = null, interrupted = null, cleanupIncomplete = false;
    const kill = value => {
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, value);
        else child.kill(value);
      } catch (caught) { if (caught.code !== 'ESRCH') error ??= message(caught); }
    };
    const finish = () => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      clearTimeout(reapTimer);
      clearTimeout(executionTimer);
      signal?.removeEventListener('abort', abort);
      if (child?.pid) kill('SIGKILL');
      for (const stream of ['stdout', 'stderr']) {
        try { closeSync(handles[stream]); }
        catch (caught) { error ??= `Log close: ${message(caught)}`; }
        try { logs[stream].sha256 = hash(readSmall(logs[stream].path, LIMITS.logBytes)); }
        catch (caught) { error ??= `Log read: ${message(caught)}`; }
      }
      const result = { executable: process.execPath, args: [...args], cwd, env: { ...env }, started,
        finished: new Date().toISOString(), exitCode, signal: actualSignal, error, interrupted, timedOut, timeoutMs, cleanupIncomplete, logs };
      if (testReport) {
        try { result.tests = readFreshReport(testReport); }
        catch (caught) { result.reportError = message(caught); }
      }
      if (nodeTap) {
        try {
          if (logs.stdout.truncated) throw new Error('Node TAP log truncated');
          result.tap = validateNodeTap(readSmall(logs.stdout.path, LIMITS.logBytes));
        } catch (caught) { result.reportError = message(caught); }
      }
      result.passed = exited && exitCode === 0 && actualSignal === null && !error && !interrupted && !timedOut && !cleanupIncomplete && !result.reportError &&
        Object.values(logs).every(log => !log.truncated);
      done(result);
    };
    const cleanup = () => {
      if (timer || completed) return;
      timer = setTimeout(() => kill('SIGKILL'), LIMITS.terminateMs);
      reapTimer = setTimeout(() => {
        cleanupIncomplete = true;
        error ??= 'Child or output pipes did not reap within cleanup limit';
        child.stdout?.destroy();
        child.stderr?.destroy();
        child.unref();
        finish();
      }, LIMITS.reapMs);
    };
    const abort = () => {
      interrupted = ['SIGINT', 'SIGTERM'].includes(signal?.reason) ? signal.reason : 'SIGTERM';
      kill(interrupted);
      cleanup();
    };
    try {
      child = spawn(process.execPath, args, { cwd, env, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (caught) { error = message(caught); finish(); return; }
    executionTimer = setTimeout(() => { timedOut = true; kill('SIGTERM'); cleanup(); }, timeoutMs);
    for (const stream of ['stdout', 'stderr']) {
      child[stream].on('data', chunk => {
        if (completed) return;
        const log = logs[stream];
        log.observedBytes += chunk.length;
        const retained = chunk.subarray(0, Math.max(0, LIMITS.logBytes - log.bytes));
        try {
          for (let offset = 0; offset < retained.length;) {
            const written = writeSync(handles[stream], retained, offset, retained.length - offset);
            if (!written) throw new Error('Log write made no progress');
            offset += written;
            log.bytes += written;
          }
        } catch (caught) { error ??= message(caught); kill('SIGTERM'); cleanup(); }
        log.truncated = log.observedBytes > log.bytes;
      });
      child[stream].on('error', caught => { error ??= message(caught); kill('SIGTERM'); cleanup(); });
    }
    child.on('error', caught => { error ??= message(caught); cleanup(); });
    child.on('exit', (code, value) => { exited = true; exitCode = code; actualSignal = value; kill('SIGTERM'); cleanup(); });
    child.on('close', finish);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

const local = (root, value) => value === '/app' ? root : value.startsWith('/app/') ? join(root, value.slice(5)) : value;

export async function fixedPlan(root, directory, stage, inputSnapshot) {
  if (!['static', 'full'].includes(stage)) throw new Error('Unknown diagnostic stage');
  const arena = join(root, 'packages/starchess-arena');
  const { verificationCommands } = await import(pathToFileURL(join(arena, 'hermetic/verification-plan.mjs')).href);
  const strict = verificationCommands(root)[5];
  if (!strict || strict.executable !== '/app/packages/starchess-arena/node_modules/.bin/tsc' || strict.cwd !== '/app/packages/starchess-arena') throw new Error('Strict invoice is not command 6');
  const plan = [
    { id: 'planning-budget-audit', cwd: root, args: [join(root, 'scripts/r4-planning-budget-audit.mjs')] },
    { id: 'source-inventory', owner: 'starchess-arena', tool: 'tsx', cwd: root, args: [join(arena, 'hermetic/r4-source-inventory.ts'), root] },
    { id: 'public-closure', cwd: root, args: [join(root, 'scripts/check-public-closure.mjs')] },
    ...PACKAGES.map(owner => ({ id: `types-${owner}`, owner, tool: 'tsc', cwd: join(root, 'packages', owner), args: ['-p', 'tsconfig.json', '--noEmit'] })),
    { id: 'strict-core-arena-invoice', owner: 'starchess-arena', tool: 'tsc', cwd: local(root, strict.cwd), args: strict.args.map(value => local(root, value)) },
    ...inputSnapshot.source.entries.filter(entry => entry.type === 'file' && entry.path.endsWith('.mjs')).map(entry => ({ id: `syntax-${entry.path.replace(/[^a-zA-Z0-9-]/g, '-')}`, cwd: root, args: ['--check', join(root, entry.path)] })),
  ];
  if (stage === 'full') {
    for (const owner of PACKAGES) {
      const config = join(directory, 'tmp', `${owner}.vitest.mts`);
      const base = join(root, 'packages', owner, 'vitest.config.ts');
      writeFileSync(config, `import base from ${JSON.stringify(base)};\nexport default { ...base, cacheDir: ${JSON.stringify(join(directory, 'cache', owner))}, test: { ...base.test, cache: false } };\n`, { flag: 'wx', mode: 0o600 });
      const testReport = join(directory, 'reports', `vitest-${owner}.json`);
      plan.push({ id: `vitest-${owner}`, owner, tool: 'vitest', cwd: join(root, 'packages', owner), testReport,
        args: ['run', '--config', config, '--configLoader', 'native', '--no-cache', '--maxWorkers', '2', '--reporter=default', '--reporter=json', '--outputFile', testReport] });
    }
    for (const name of ['evidence-bundle', 'image-measurement', 'tar']) plan.push({ id: `node-${name}`, cwd: root, nodeTap: true, args: ['--test', join(arena, 'hermetic', `${name}.test.mjs`)] });
    plan.push({ id: 'node-r4-tooling', cwd: root, nodeTap: true, args: ['--test', join(root, 'scripts/r4-host-verify.test.mjs'),
      join(arena, 'hermetic/r4-budget-audit.test.mjs'), join(arena, 'hermetic/r4-context.test.mjs')] });
  }
  return plan.map(command => ({ ...command, timeoutMs: command.tool === 'vitest' ? COMMAND_DEADLINES.packageMs :
    command.nodeTap ? COMMAND_DEADLINES.evidenceMs : COMMAND_DEADLINES.staticMs }));
}

export async function executeSchedule({ root, directory, plan, signal, snapshots = snapshotInputs, dependencies = snapshotDependencies }) {
  const commands = [], errors = [];
  const env = controlledEnvironment(directory);
  const manifests = { start: null, end: null, dependenciesStart: null, dependenciesEnd: null };
  let complete = false, stopped = false;
  let start, depsStart, selected;
  const save = (name, value) => {
    const path = join(directory, 'manifests', `${name}.json`);
    writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return { path, ...fileDigest(path, { bytes: 0 }) };
  };
  const receipt = (name, value) => {
    const path = join(directory, 'logs', `${name}.json`);
    const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
      const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
      for (let offset = 0; offset < bytes.length;) {
        const count = writeSync(fd, bytes, offset, bytes.length - offset);
        if (!count) throw new Error('Receipt write made no progress');
        offset += count;
      }
      fsyncSync(fd);
    } finally { closeSync(fd); }
    return path;
  };
  try {
    start = snapshots(root);
    manifests.start = save('start', start);
    depsStart = dependencies(root);
    manifests.dependenciesStart = save('dependencies-start', depsStart);
    selected = typeof plan === 'function' ? await plan(start) : plan;
    for (const [index, command] of selected.entries()) {
      if (signal?.aborted) { stopped = true; errors.push(`Interrupted: ${String(signal.reason)}`); break; }
      const pre = snapshots(root);
      const preManifest = save(`command-${index + 1}-pre`, pre);
      if (pre.source.sha256 !== start.source.sha256 || pre.docs.sha256 !== start.docs.sha256) { stopped = true; errors.push('Source/doc drift before command; later checks stopped'); break; }
      let record;
      try {
        const args = command.tool ? [resolveTool(root, command.owner, command.tool), ...command.args] : command.args;
        const startedReceipt = receipt(`command-${index + 1}.started`, { id: command.id, executable: process.execPath, args,
          cwd: command.cwd, env, requestedAt: new Date().toISOString(), preManifest, timeoutMs: command.timeoutMs ?? COMMAND_DEADLINES.staticMs });
        record = await runChild(args, { cwd: command.cwd, env, directory: join(directory, 'logs'), prefix: `command-${index + 1}`, signal,
          testReport: command.testReport, nodeTap: command.nodeTap, timeoutMs: command.timeoutMs });
        record.startedReceipt = startedReceipt;
      } catch (error) { record = { executable: process.execPath, requestedArgs: command.args, cwd: command.cwd, env, passed: false, error: message(error), notExecuted: true }; }
      record.id = command.id;
      record.preManifest = preManifest;
      commands.push(record);
      record.resultReceipt = receipt(`command-${index + 1}.result`, record);
      if (!record.passed) errors.push(`Check failed: ${command.id}`);
      const post = snapshots(root);
      record.postManifest = save(`command-${index + 1}-post`, post);
      if (post.source.sha256 !== start.source.sha256 || post.docs.sha256 !== start.docs.sha256) { stopped = true; errors.push('Source/doc drift after command; later checks stopped'); break; }
      if (record.cleanupIncomplete) { stopped = true; errors.push('Incomplete cleanup; later checks stopped'); break; }
    }
    complete = !stopped && commands.length === selected.length && !signal?.aborted && !commands.some(command => command.notExecuted || command.cleanupIncomplete);
  } catch (error) { errors.push(message(error)); }
  finally {
    try {
      const end = snapshots(root);
      manifests.end = save('end', end);
      if (!start || start.source.sha256 !== end.source.sha256 || start.docs.sha256 !== end.docs.sha256) {
        complete = false;
        errors.push('Start/end source/doc drift invalidates diagnostics');
      }
    } catch (error) { complete = false; errors.push(`End snapshot: ${message(error)}`); }
    try {
      const end = dependencies(root);
      manifests.dependenciesEnd = save('dependencies-end', end);
      if (!depsStart || depsStart.sha256 !== end.sha256) {
        complete = false;
        errors.push('Start/end dependency/tool drift invalidates diagnostics');
      }
    } catch (error) { complete = false; errors.push(`End dependencies: ${message(error)}`); }
  }
  const notRun = (selected ?? []).slice(commands.length).map(command => ({ id: command.id, executable: process.execPath,
    requestedArgs: command.args, cwd: command.cwd, tool: command.tool ?? null, owner: command.owner ?? null,
    notExecuted: true, reason: errors.join(' | ') || 'Schedule incomplete' }));
  return { diagnosticsComplete: complete, checksPassed: complete && commands.length > 0 && commands.every(command => command.passed) && errors.length === 0, commands, notRun, errors, manifests };
}

export async function diagnose(root, options, signal) {
  if (options.mode === 'accept') return blockedResult(options);
  const directory = createScratch(root, options.tempParent);
  const outcome = await executeSchedule({ root, directory, signal, plan: start => fixedPlan(root, directory, options.stage, start) });
  const result = { kind: KIND, stage: options.stage, mode: 'diagnose', status: outcome.checksPassed ? 'DIAGNOSTICS_PASSED' : 'DIAGNOSTICS_FAILED',
    root, directory, startedFrom: 'live-host-checkout', ...outcome, r4Acceptance: 'NOT_ESTABLISHED', openGates: [...OPEN_GATES],
    limits: LIMITS, limitations: [LIMITATION, 'Snapshots detect observed boundaries, not transient edits between them. Static budget quotes and actual auditor reports do not establish whole-budget adequacy or production B1 enforcement. No Docker, frozen image, cold-positive, training, calibration or global R5 proof runs here.',
      'Full mode runs the unfiltered package suites as requested; test code remains trusted host code and may exercise game logic or use literal temporary paths.',
      'Vitest JSON exposes assertion statuses and aggregate nested-suite counts, not a complete nested-suite inventory. Source exclusions and secret-like filename rejection are fixed policy, not a secret scanner.'] };
  try { writeFileSync(join(directory, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    result.status = 'DIAGNOSTICS_FAILED';
    result.checksPassed = false;
    result.diagnosticsComplete = false;
    result.errors.push(`Result write: ${message(error)}`);
  }
  return result;
}
