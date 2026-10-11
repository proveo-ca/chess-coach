// SPEC: _spec/packages/starchess-training/r4-host-verification.puml
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync,
  chmodSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  blockedResult, controlledEnvironment, createScratch, diagnose, executeSchedule, fixedPlan, KIND,
  LIMITS, OPEN_GATES, PACKAGES, parseArgs, readFreshReport, resolveTool, runChild,
  snapshotDependencies, snapshotInputs, validateNodeTap, validateVitestReport,
} from './r4-host-verify-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const parent = realpathSync(process.env.R4_TEST_TEMP_PARENT || tmpdir());
function fixture(t) {
  const directory = mkdtempSync(join(parent, 'r4-host-unit-'));
  const root = join(directory, 'repo with spaces');
  mkdirSync(root, { mode: 0o700 });
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const write = (path, value) => {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value), { mode: 0o600 });
    return file;
  };
  for (const name of PACKAGES) {
    write(`packages/${name}/package.json`, { name: `@chess-coach/${name}`, type: 'module' });
    write(`packages/${name}/src/input.ts`, 'export const x = 1;\n');
    write(`packages/${name}/vitest.config.ts`, 'export default { test: { include: ["src/**/*.test.ts"] } };\n');
    write(`packages/${name}/src/__tests__/fixture.ts`, 'export const f = 1;\n');
  }
  write('scripts/synthetic.mjs', 'export const x = 1;\n');
  write('_spec/goals.md', 'diagnostic goals\n');
  write('package.json', { private: true, type: 'module' });
  write('pnpm-lock.yaml', 'lockfileVersion: 9.0\n');
  return { root, directory, write, scratch: () => createScratch(root, directory) };
}

function passingReport() {
  return { success: true, numTotalTests: 2, numPassedTests: 2, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0,
    numTotalTestSuites: 1, numPassedTestSuites: 1, numFailedTestSuites: 0, numPendingTestSuites: 0,
    testResults: [{ name: '/fixture.test.ts', status: 'passed', message: '', assertionResults: [
      { status: 'passed', failureMessages: [] }, { status: 'passed', failureMessages: [] },
    ] }] };
}

function install(f, name, manifest, files = {}) {
  const target = f.write(`node_modules/.pnpm/${name.replace('/', '+')}@1/node_modules/${name}/package.json`, { name, version: '1.0.0', ...manifest });
  for (const [path, value] of Object.entries(files)) f.write(`node_modules/.pnpm/${name.replace('/', '+')}@1/node_modules/${name}/${path}`, value);
  for (const owner of PACKAGES) {
    const logical = join(f.root, 'packages', owner, 'node_modules', name);
    mkdirSync(dirname(logical), { recursive: true });
    symlinkSync(dirname(target), logical);
  }
  return dirname(target);
}

function command(f, id, code, extra = {}) {
  return { id, cwd: f.root, args: ['-e', code], ...extra };
}

test('CLI flags are closed with static/diagnose defaults', () => {
  assert.deepEqual(parseArgs([]), { stage: 'static', mode: 'diagnose', tempParent: undefined });
  assert.deepEqual(parseArgs(['--stage', 'full', '--mode', 'accept', '--temp-parent', '/a literal path']), { stage: 'full', mode: 'accept', tempParent: '/a literal path' });
  for (const args of [['--stage', 'static', '--stage', 'full'], ['--stage'], ['--mode', 'ready'], ['--stage', 'fast'],
    ['--temp-parent', '/x', '--temp-parent', '/y'], ['--command', 'publish'], ['--executable', '/bin/sh'], ['--timeout', '600'],
    ['--stage=full'], ['full'], ['--mode', '--stage'], ['--temp-parent', 'x\0y']]) assert.throws(() => parseArgs(args));
});

test('a missing explicit HOST parent reports actionable guidance before any command runs', async t => {
  const f = fixture(t);
  for (const name of ['r4-host-verify.mjs', 'r4-host-verify-lib.mjs']) copyFileSync(join(here, name), join(f.root, 'scripts', name));
  const missing = join(f.directory, 'missing-host-parent');
  const result = spawnSync(process.execPath, [join(f.root, 'scripts/r4-host-verify.mjs'), '--stage', 'full', '--mode', 'diagnose',
    '--temp-parent', missing], { encoding: 'utf8', env: {} });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.commands, []);
  assert.equal(report.diagnosticsComplete, false);
  assert.match(report.errors[0], /Omit --temp-parent to use HOST's default/);
  assert.equal(existsSync(missing), false);
});

test('omitted HOST parent resolves native TMPDIR aliases while explicit aliases remain rejected', t => {
  const f = fixture(t), temporary = join(f.directory, 'native-temp'), alias = join(f.directory, 'native-alias');
  mkdirSync(temporary, { mode: 0o700 });
  symlinkSync(temporary, alias, 'dir');
  const helper = f.write('scratch-probe.mjs', `import {createScratch} from ${JSON.stringify(pathToFileURL(join(here, 'r4-host-verify-lib.mjs')).href)};
    process.stdout.write(createScratch(process.argv[2]));\n`);
  const result = spawnSync(process.execPath, [helper, f.root], { encoding: 'utf8', env: { TMPDIR: alias } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(dirname(result.stdout), temporary);
  assert.equal(lstatSync(result.stdout).mode & 0o7777, 0o700);
  assert.equal(lstatSync(alias).isSymbolicLink(), true);
  assert.equal(lstatSync(temporary).mode & 0o7777, 0o700);
  assert.throws(() => createScratch(f.root, alias), /canonical/);
});

test('missing or relative native defaults fail without fallback and do not affect early accept refusal', t => {
  const f = fixture(t);
  const helper = f.write('scratch-probe.mjs', `import {createScratch} from ${JSON.stringify(pathToFileURL(join(here, 'r4-host-verify-lib.mjs')).href)};
    createScratch(process.argv[2]);\n`);
  for (const selected of [join(f.directory, 'absent-native-temp'), 'relative-native-temp']) {
    const result = spawnSync(process.execPath, [helper, f.root], { encoding: 'utf8', cwd: f.root, env: { TMPDIR: selected } });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /default temporary directory is unusable/);
    assert.equal(existsSync(join(f.root, 'relative-native-temp')), false);
    assert.equal(existsSync(join(f.directory, 'absent-native-temp')), false);
  }
  for (const name of ['r4-host-verify.mjs', 'r4-host-verify-lib.mjs']) copyFileSync(join(here, name), join(f.root, 'scripts', name));
  const accept = spawnSync(process.execPath, [join(f.root, 'scripts/r4-host-verify.mjs'), '--stage', 'full', '--mode', 'accept'],
    { encoding: 'utf8', env: { TMPDIR: join(f.directory, 'absent-native-temp') } });
  assert.equal(accept.status, 2);
  assert.equal(JSON.parse(accept.stdout).status, 'BLOCKED');
  assert.deepEqual(JSON.parse(accept.stdout).commands, []);
});

test('accept blocks both stages before scratch, dependencies, or commands', async t => {
  const f = fixture(t);
  for (const stage of ['static', 'full']) {
    const before = readdirSync(f.directory);
    const result = await diagnose('/definitely/missing/repository', { stage, mode: 'accept', tempParent: '/missing/parent' });
    assert.equal(result.kind, KIND);
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.r4Acceptance, 'NOT_ESTABLISHED');
    assert.equal(result.diagnosticsComplete, false);
    assert.deepEqual(result.commands, []);
    assert.deepEqual(result.openGates, OPEN_GATES);
    assert.deepEqual(readdirSync(f.directory), before);
    assert.deepEqual(result, blockedResult({ stage, mode: 'accept' }));
  }
  for (const name of ['r4-host-verify.mjs', 'r4-host-verify-lib.mjs']) copyFileSync(join(here, name), join(f.root, 'scripts', name));
  const cli = join(f.root, 'scripts/r4-host-verify.mjs');
  const run = spawnSync(process.execPath, [cli, '--stage', 'full', '--mode', 'accept', '--temp-parent', '/missing/parent'], { encoding: 'utf8', env: {} });
  assert.equal(run.status, 2);
  assert.equal(JSON.parse(run.stdout).status, 'BLOCKED');
  assert.equal(run.stderr, '');
  const invalid = spawnSync(process.execPath, [cli, '--publish'], { encoding: 'utf8', env: {} });
  assert.equal(invalid.status, 2);
  assert.equal(JSON.parse(invalid.stdout).status, 'INVALID_ARGUMENTS');
});

test('scratch is fresh, canonical, external, private, and retains literal spaces', t => {
  const f = fixture(t);
  const one = f.scratch(), two = f.scratch();
  assert.notEqual(one, two);
  assert.equal(lstatSync(one).mode & 0o777, 0o700);
  for (const name of readdirSync(one)) assert.equal(lstatSync(join(one, name)).mode & 0o777, 0o700);
  assert.throws(() => createScratch(f.root, f.root), /external/);
  assert.throws(() => createScratch(f.root, join(f.directory, 'absent')));
  assert.throws(() => createScratch(f.root, f.directory + '/..'), /canonical/);
  assert.throws(() => createScratch(f.root, 'relative'), /canonical/);
  const alias = join(f.directory, 'alias');
  symlinkSync(f.directory, alias);
  assert.throws(() => createScratch(f.root, alias), /canonical/);
  const writable = join(f.directory, 'writable');
  mkdirSync(writable, { mode: 0o777 });
  chmodSync(writable, 0o777);
  assert.throws(() => createScratch(f.root, writable), /Untrusted writable/);
  assert.equal(readdirSync(writable).length, 0);
  assert.equal(lstatSync(writable).mode & 0o7777, 0o777);
  chmodSync(writable, 0o1777);
  assert.equal(lstatSync(createScratch(f.root, writable)).mode & 0o7777, 0o700);
  const intermediate = join(f.directory, 'intermediate'), inner = join(intermediate, 'inner');
  mkdirSync(intermediate, { mode: 0o777 });
  chmodSync(intermediate, 0o777);
  mkdirSync(inner, { mode: 0o700 });
  assert.throws(() => createScratch(f.root, inner), /Untrusted writable/);
  assert.equal(readdirSync(inner).length, 0);
});

test('source/docs include untracked, ignored, aliases/configs, evidence, and root corpus bytes', t => {
  const f = fixture(t);
  f.write('.gitignore', '*ignored*\n');
  f.write('packages/starchess-core/src/ignored-untracked.ts', 'aa');
  f.write('packages/starchess-core/src/__tests__/fixtures/blob.json', 'fixture');
  f.write('packages/starchess-core/tsconfig.alias.json', '{"compilerOptions":{"paths":{"x":["a"]}}}');
  f.write('_spec/evidence/old/logs/stdout.log', 'old retained evidence');
  f.write('_spec/corpora/ml-adjutant-corpus.manifest.json', { sourcePath: 'selected-corpus.json' });
  f.write('selected-corpus.json', 'aa');
  f.write('packages/starchess-core/node_modules/generated.json', 'excluded');
  f.write('packages/starchess-core/dist/generated.js', 'excluded');
  f.write('.env', 'ROOT_CREDENTIAL=excluded\n');
  const before = snapshotInputs(f.root);
  assert(before.source.entries.some(entry => entry.path.endsWith('ignored-untracked.ts')));
  assert(before.docs.entries.some(entry => entry.path.endsWith('stdout.log')));
  assert(before.source.entries.some(entry => entry.path === 'selected-corpus.json'));
  assert(!before.source.entries.some(entry => /node_modules|dist\/|^\.env$/.test(entry.path)));
  f.write('packages/starchess-core/src/ignored-untracked.ts', 'bb');
  assert.notEqual(snapshotInputs(f.root).source.sha256, before.source.sha256);
  const changed = snapshotInputs(f.root);
  f.write('packages/starchess-core/tsconfig.alias.json', '{"compilerOptions":{"paths":{"x":["b"]}}}');
  assert.notEqual(snapshotInputs(f.root).source.sha256, changed.source.sha256);
  const aliasChanged = snapshotInputs(f.root);
  f.write('selected-corpus.json', 'bb');
  assert.notEqual(snapshotInputs(f.root).source.sha256, aliasChanged.source.sha256);
  f.write('_spec/goals.md', 'different goals\n');
  assert.notEqual(snapshotInputs(f.root).docs.sha256, before.docs.sha256);
});

test('source rejects symlink/hardlink aliases and secret-like eligible inputs', t => {
  const f = fixture(t);
  const input = join(f.root, 'scripts/synthetic.mjs');
  const alias = join(f.root, 'scripts/alias.mjs');
  symlinkSync(input, alias);
  assert.throws(() => snapshotInputs(f.root), /Symlink source/);
  unlinkSync(alias);
  linkSync(input, alias);
  assert.throws(() => snapshotInputs(f.root), /aliased source/);
  unlinkSync(alias);
  f.write('packages/starchess-arena/.env.local', 'secret');
  assert.throws(() => snapshotInputs(f.root), /Secret-like/);
  unlinkSync(join(f.root, 'packages/starchess-arena/.env.local'));
  f.write('.npmrc', '//registry/:_authToken=secret');
  assert.throws(() => snapshotInputs(f.root), /Credential-bearing/);
});

test('directory modes and legitimate nested build source participate in input identity', t => {
  const f = fixture(t);
  f.write('packages/starchess-core/src/build/legitimate.ts', 'export const value = 1;\n');
  const before = snapshotInputs(f.root);
  assert(before.source.entries.some(entry => entry.path.endsWith('src/build/legitimate.ts')));
  const directory = join(f.root, 'packages/starchess-core/src/build');
  chmodSync(directory, 0o755);
  const after = snapshotInputs(f.root);
  assert.notEqual(after.source.sha256, before.source.sha256);
  assert.equal(after.source.entries.find(entry => entry.path.endsWith('src/build')).mode, 0o755);
});

test('relative JSONC extends outside package directories participates in input drift', t => {
  const f = fixture(t);
  f.write('packages/starchess-core/tsconfig.json', '{ // configuration\n "extends":"../../config/base.json", }');
  f.write('config/base.json', '{"extends":"./strict"}');
  f.write('config/strict.json', '{"compilerOptions":{"strict":true}}');
  const before = snapshotInputs(f.root);
  for (const name of ['config/base.json', 'config/strict.json']) assert(before.source.entries.some(entry => entry.path === name));
  f.write('config/strict.json', '{"compilerOptions":{"strict":false}}');
  assert.notEqual(snapshotInputs(f.root).source.sha256, before.source.sha256);
  f.write('config/strict.json', '{"extends":"./base.json"}');
  assert.throws(() => snapshotInputs(f.root), /Cyclic configuration/);
  f.write('config/strict.json', '{"extends":"../../outside.json"}');
  assert.throws(() => snapshotInputs(f.root), /escapes repository/);
});

test('dangling optional-control links fail instead of recording an absent input', t => {
  const f = fixture(t);
  symlinkSync(join(f.directory, 'missing-control'), join(f.root, 'tsconfig.json'));
  assert.throws(() => snapshotInputs(f.root));
});

test('dependency/tool bytes include contained pnpm links and transitives, not unrelated trees', t => {
  const f = fixture(t);
  for (const name of PACKAGES) f.write(`packages/${name}/package.json`, { name: `@chess-coach/${name}`, devDependencies: { typescript: '1' } });
  const tool = install(f, 'typescript', { bin: { tsc: 'bin/tsc.js' }, dependencies: { helper: '1' } }, { 'bin/tsc.js': 'aa', 'data.bin': 'cc' });
  const helper = install(f, 'helper', {}, { 'index.js': 'hh' });
  mkdirSync(join(tool, 'node_modules'), { recursive: true });
  symlinkSync(helper, join(tool, 'node_modules/helper'));
  f.write('node_modules/unrelated/package.json', { name: 'unrelated' });
  const before = snapshotDependencies(f.root);
  assert(before.entries.some(entry => entry.path === 'host:node' && entry.executable === process.execPath));
  assert(before.entries.some(entry => entry.type === 'resolution' && entry.link));
  assert(before.entries.some(entry => entry.path.endsWith('helper/index.js')));
  assert(!before.entries.some(entry => entry.path.includes('unrelated')));
  assert.equal(resolveTool(f.root, 'starchess-arena', 'tsc'), join(tool, 'bin/tsc.js'));
  writeFileSync(join(helper, 'index.js'), 'ii');
  assert.notEqual(snapshotDependencies(f.root).sha256, before.sha256);
  const changed = snapshotDependencies(f.root);
  writeFileSync(join(tool, 'data.bin'), 'dd');
  assert.notEqual(snapshotDependencies(f.root).sha256, changed.sha256);
  assert.throws(() => resolveTool(f.root, 'starchess-arena', 'shell'), /allowlist/);
  assert.throws(() => resolveTool(f.root, 'other', 'tsc'), /allowlist/);
});

test('dependency escapes, missing required packages, and escaping tool bins fail closed', t => {
  const f = fixture(t);
  f.write('packages/starchess-arena/package.json', { name: '@chess-coach/starchess-arena', dependencies: { missing: '1' } });
  assert.throws(() => snapshotDependencies(f.root), /Missing installed/);
  const outside = join(f.directory, 'outside');
  mkdirSync(outside);
  writeFileSync(join(outside, 'package.json'), JSON.stringify({ name: 'missing' }));
  mkdirSync(join(f.root, 'packages/starchess-arena/node_modules'), { recursive: true });
  symlinkSync(outside, join(f.root, 'packages/starchess-arena/node_modules/missing'));
  assert.throws(() => snapshotDependencies(f.root), /escapes/);
  install(f, 'typescript', { bin: { tsc: '../escape.js' } });
  f.write('packages/starchess-arena/package.json', { name: '@chess-coach/starchess-arena', devDependencies: { typescript: '1' } });
  assert.throws(() => resolveTool(f.root, 'starchess-arena', 'tsc'), /Invalid local/);
  assert.throws(() => resolveTool(f.root, 'starchess-core', 'tsc'), /not declared/);
});

test('real Node spawn preserves argv/cwd and strips inherited loaders, credentials, HERMETIC', async t => {
  const f = fixture(t);
  const scratch = f.scratch();
  const env = controlledEnvironment(scratch);
  const code = 'process.stdout.write(JSON.stringify({args:process.argv.slice(1),cwd:process.cwd(),env:process.env}));process.stderr.write("separate stderr");';
  const result = await runChild(['-e', code, 'literal space ; $(publish)', '--not-an-option'], { cwd: f.root, env, directory: join(scratch, 'logs'), prefix: 'literal' });
  assert.equal(result.passed, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.signal, null);
  const output = JSON.parse(readFileSync(result.logs.stdout.path));
  assert.deepEqual(output.args, ['literal space ; $(publish)', '--not-an-option']);
  assert.equal(output.cwd, f.root);
  assert.deepEqual(output.env, env);
  for (const key of ['NODE_OPTIONS', 'NODE_PATH', 'LD_PRELOAD', 'LD_LIBRARY_PATH', 'HERMETIC_OUTPUT_DIRECTORY', 'AWS_SECRET_ACCESS_KEY', 'NPM_TOKEN']) assert.equal(output.env[key], undefined);
  assert.equal(readFileSync(result.logs.stderr.path, 'utf8'), 'separate stderr');
  assert.equal(result.logs.stdout.truncated, false);
});

test('actual exits/signals, pipe drain, raw log caps, and interrupt are retained', async t => {
  const f = fixture(t);
  const scratch = f.scratch();
  const options = { cwd: f.root, env: controlledEnvironment(scratch), directory: join(scratch, 'logs') };
  const failed = await runChild(['-e', 'process.stdout.write("last stdout");process.stderr.write("last stderr");process.exitCode=7'], { ...options, prefix: 'exit' });
  assert.equal(failed.exitCode, 7);
  assert.equal(failed.signal, null);
  assert.equal(failed.passed, false);
  assert.equal(readFileSync(failed.logs.stdout.path, 'utf8'), 'last stdout');
  assert.equal(readFileSync(failed.logs.stderr.path, 'utf8'), 'last stderr');
  const killed = await runChild(['-e', 'process.kill(process.pid,"SIGTERM")'], { ...options, prefix: 'signal' });
  assert.equal(killed.exitCode, null);
  assert.equal(killed.signal, 'SIGTERM');
  assert.equal(killed.passed, false);
  const cap = await runChild(['-e', `process.stdout.write(Buffer.alloc(${LIMITS.logBytes + 123},97));`], { ...options, prefix: 'cap' });
  assert.equal(cap.exitCode, 0);
  assert.equal(cap.logs.stdout.bytes, LIMITS.logBytes);
  assert.equal(cap.logs.stdout.observedBytes, LIMITS.logBytes + 123);
  assert.equal(cap.logs.stdout.truncated, true);
  assert.equal(cap.passed, false);
  const controller = new AbortController();
  const running = runChild(['-e', 'setInterval(()=>{},1000)'], { ...options, prefix: 'interrupt', signal: controller.signal });
  setTimeout(() => controller.abort('SIGINT'), 50);
  const interrupted = await running;
  assert.equal(interrupted.interrupted, 'SIGINT');
  assert.equal(interrupted.signal, 'SIGINT');
  assert.equal(interrupted.exitCode, null);
  assert.equal(interrupted.passed, false);
});

test('a hung child hits its fixed diagnostic deadline without an operator interrupt', async t => {
  const f = fixture(t), scratch = f.scratch();
  const result = await runChild(['-e', 'setInterval(()=>{},1000)'], { cwd: f.root, env: controlledEnvironment(scratch),
    directory: join(scratch, 'logs'), prefix: 'timeout', timeoutMs: 200 });
  assert.equal(result.timedOut, true);
  assert.equal(result.timeoutMs, 200);
  assert.equal(result.interrupted, null);
  assert.equal(result.passed, false);
  assert.equal(result.cleanupIncomplete, false);
  assert.equal(result.signal, 'SIGTERM');
});

test('Vitest recount rejects skipped/todo/failed, inconsistent counts, and incomplete errors', () => {
  assert.equal(validateVitestReport(passingReport()).assertions, 2);
  const mutations = [
    value => { value.numPassedTests = 1; }, value => { value.numTotalTests = 3; value.numPassedTests = 3; },
    value => { value.numPendingTests = 1; }, value => { value.numTodoTests = 1; }, value => { value.numFailedTests = 1; },
    value => { value.numFailedTestSuites = 1; }, value => { value.numPendingTestSuites = 1; },
    value => { value.testResults[0].assertionResults[0].status = 'skipped'; },
    value => { value.testResults[0].assertionResults[0].status = 'todo'; },
    value => { value.testResults[0].assertionResults[0].failureMessages.push('error'); },
    value => { value.testResults[0].status = 'failed'; }, value => { value.testResults[0].message = 'collection error'; },
    value => { value.testResults = []; }, value => { value.testResults[0].assertionResults = []; },
    value => { value.numTotalTests = -1; }, value => { delete value.numTodoTests; },
    value => { value.wasInterrupted = true; }, value => { value.success = false; },
    value => { value.testExecError = 'error'; }, value => { value.snapshot = { failure: true }; },
    value => { value.testResults.push(structuredClone(value.testResults[0])); },
  ];
  for (const mutate of mutations) { const value = passingReport(); mutate(value); assert.throws(() => validateVitestReport(value)); }
});

test('fresh JSON is required; stale/symlink/missing/malformed reports cannot pass a zero exit', async t => {
  const f = fixture(t);
  const scratch = f.scratch();
  const options = { cwd: f.root, env: controlledEnvironment(scratch), directory: join(scratch, 'logs') };
  const report = join(scratch, 'reports/fresh.json');
  const good = await runChild(['-e', 'require("node:fs").writeFileSync(process.argv[1],process.argv[2])', report, JSON.stringify(passingReport())], { ...options, prefix: 'fresh', testReport: report });
  assert.equal(good.passed, true);
  assert.equal(good.tests.total, 2);
  await assert.rejects(runChild(['-e', 'process.exitCode=0'], { ...options, prefix: 'stale', testReport: report }), /absent/);
  const alias = join(scratch, 'reports/alias.json');
  symlinkSync(report, alias);
  assert.throws(() => readFreshReport(alias));
  const dangling = join(scratch, 'reports/dangling.json');
  symlinkSync(join(scratch, 'reports/not-created.json'), dangling);
  await assert.rejects(runChild(['-e', 'throw new Error("must not spawn")'], { ...options, prefix: 'dangling', testReport: dangling }), /absent/);
  const missing = await runChild(['-e', 'process.exitCode=0'], { ...options, prefix: 'missing', testReport: join(scratch, 'reports/missing.json') });
  assert.equal(missing.exitCode, 0);
  assert.equal(missing.passed, false);
  assert(missing.reportError);
  const malformedPath = join(scratch, 'reports/malformed.json');
  const malformed = await runChild(['-e', 'require("node:fs").writeFileSync(process.argv[1],"{")', malformedPath], { ...options, prefix: 'malformed', testReport: malformedPath });
  assert.equal(malformed.passed, false);
  assert(malformed.reportError);
});

test('Node evidence TAP requires complete, non-skipped, non-todo, passing counts', async t => {
  const f = fixture(t);
  const scratch = f.scratch();
  const file = f.write('tiny.test.mjs', 'import test from "node:test"; test("one",()=>{});\n');
  const options = { cwd: f.root, env: controlledEnvironment(scratch), directory: join(scratch, 'logs'), nodeTap: true };
  const result = await runChild(['--test', file], { ...options, prefix: 'tap' });
  assert.equal(result.passed, true);
  assert.equal(result.tap.tests, 1);
  const stdout = readFileSync(result.logs.stdout.path, 'utf8');
  assert.throws(() => validateNodeTap(Buffer.from(stdout.replace('# skipped 0', '# skipped 1'))));
  assert.throws(() => validateNodeTap(Buffer.from(stdout.replace('# todo 0', '# todo 1'))));
  assert.throws(() => validateNodeTap(Buffer.from(stdout.replace('# tests 1', '# tests 2'))));
  assert.throws(() => validateNodeTap(Buffer.from(stdout.replace('# pass 1\n', ''))));
  assert.throws(() => validateNodeTap(Buffer.from(stdout.replace('1..1', '1..0'))));
  assert.throws(() => validateNodeTap(Buffer.from(stdout.replace(/^ok 1[^\n]*\n/m, ''))));
  assert.throws(() => validateNodeTap(Buffer.from(stdout.replace(/^ok 1/m, 'ok 2'))));
  assert.throws(() => validateNodeTap(Buffer.from('TAP version 13\n1..0\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n')));
  f.write('tiny.test.mjs', 'import test from "node:test"; test.skip("one",()=>{});\n');
  const skipped = await runChild(['--test', file], { ...options, prefix: 'tap-skip' });
  assert.equal(skipped.exitCode, 0);
  assert.equal(skipped.passed, false);
});

test('ordinary diagnostic failure continues independent checks without acceptance', async t => {
  const f = fixture(t);
  const scratch = f.scratch();
  const outcome = await executeSchedule({ root: f.root, directory: scratch, plan: [
    command(f, 'failure', 'process.stderr.write("failure diagnostic");process.exitCode=3'),
    command(f, 'independent', 'process.stdout.write("independent check ran")'),
  ] });
  assert.equal(outcome.commands.length, 2);
  assert.equal(outcome.commands[0].exitCode, 3);
  assert.equal(outcome.commands[1].exitCode, 0);
  assert.equal(outcome.diagnosticsComplete, true);
  assert.equal(outcome.checksPassed, false);
  assert(existsSync(outcome.commands[0].logs.stderr.path));
  assert(outcome.manifests.start && outcome.manifests.end && outcome.manifests.dependenciesStart && outcome.manifests.dependenciesEnd);
  const passed = await executeSchedule({ root: f.root, directory: f.scratch(), plan: [command(f, 'only', 'process.exitCode=0')] });
  assert.equal(passed.checksPassed, true);
  assert.equal(passed.r4Acceptance, undefined);
});

test('completed command receipts exist before the next command starts', async t => {
  const f = fixture(t), scratch = f.scratch(), first = join(scratch, 'logs/command-1.result.json');
  const outcome = await executeSchedule({ root: f.root, directory: scratch, plan: [
    command(f, 'first', 'process.stdout.write("first complete")'),
    { id: 'observer', cwd: f.root, args: ['-e', 'const r=JSON.parse(require("node:fs").readFileSync(process.argv[1]));if(r.id!=="first"||r.exitCode!==0||r.passed!==true)process.exitCode=8;', first] },
  ] });
  assert.equal(outcome.checksPassed, true);
  for (const record of outcome.commands) {
    assert.equal(JSON.parse(readFileSync(record.startedReceipt)).executable, process.execPath);
    assert.equal(JSON.parse(readFileSync(record.resultReceipt)).exitCode, record.exitCode);
  }
});

test('post-command source/doc drift stops later checks, dependency drift invalidates', async t => {
  const f = fixture(t);
  const scratch = f.scratch();
  const sourceDrift = await executeSchedule({ root: f.root, directory: scratch, plan: [
    command(f, 'mutate', 'require("node:fs").writeFileSync("scripts/synthetic.mjs","export const x = 2;\\n")'),
    command(f, 'must-not-run', 'throw new Error("later check ran")'),
  ] });
  assert.equal(sourceDrift.commands.length, 1);
  assert.deepEqual(sourceDrift.notRun.map(record => record.id), ['must-not-run']);
  assert.match(sourceDrift.notRun[0].reason, /drift/);
  assert.equal(sourceDrift.checksPassed, false);
  assert.equal(sourceDrift.diagnosticsComplete, false);
  assert(sourceDrift.errors.some(error => /drift/.test(error)));
  const docDrift = await executeSchedule({ root: f.root, directory: f.scratch(), plan: [
    command(f, 'doc-mutate', 'require("node:fs").writeFileSync("_spec/goals.md","changed")'),
    command(f, 'must-not-run', 'throw new Error("later check ran")'),
  ] });
  assert.equal(docDrift.commands.length, 1);
  assert.equal(docDrift.checksPassed, false);
  let calls = 0;
  const depDrift = await executeSchedule({ root: f.root, directory: f.scratch(),
    plan: [command(f, 'one', 'process.exitCode=0')], dependencies: () => ({ sha256: String(++calls), entries: [] }) });
  assert.equal(depDrift.commands[0].exitCode, 0);
  assert.equal(depDrift.checksPassed, false);
  assert.equal(depDrift.diagnosticsComplete, false);
  assert(depDrift.errors.some(error => /dependency\/tool drift/.test(error)));
});

test('pre-command drift and manifest failures produce incomplete retained diagnostics', async t => {
  const f = fixture(t);
  let calls = 0;
  const pre = await executeSchedule({ root: f.root, directory: f.scratch(), plan: [command(f, 'never', 'throw 1')], snapshots: root => {
    if (++calls === 2) f.write('scripts/new-untracked.mjs', 'export {};\n');
    return snapshotInputs(root);
  } });
  assert.equal(pre.commands.length, 0);
  assert.deepEqual(pre.notRun.map(record => record.id), ['never']);
  assert.equal(pre.diagnosticsComplete, false);
  assert(pre.errors.some(error => /before command/.test(error)));
  const failed = await executeSchedule({ root: f.root, directory: f.scratch(), plan: [], snapshots: () => { throw new Error('synthetic snapshot error'); } });
  assert.equal(failed.diagnosticsComplete, false);
  assert.equal(failed.checksPassed, false);
  assert(failed.errors.some(error => /synthetic snapshot error/.test(error)));
  assert(failed.manifests.dependenciesEnd);
});

test('interruption stops the schedule and preserves the interrupted command', async t => {
  const f = fixture(t);
  const controller = new AbortController();
  const running = executeSchedule({ root: f.root, directory: f.scratch(), signal: controller.signal, plan: [
    command(f, 'interrupt', 'setInterval(()=>{},1000)'), command(f, 'later', 'throw new Error("must not execute")'),
  ] });
  setTimeout(() => controller.abort('SIGTERM'), 50);
  const result = await running;
  assert.equal(result.commands.length, 1);
  assert.deepEqual(result.notRun.map(record => record.id), ['later']);
  assert.equal(result.commands[0].interrupted, 'SIGTERM');
  assert.equal(result.commands[0].signal, 'SIGTERM');
  assert.equal(result.diagnosticsComplete, false);
  assert.equal(result.checksPassed, false);
  assert(result.manifests.end && result.manifests.dependenciesEnd);
});

test('fixed stages derive the entire command-6 invoice and never schedule shell/publish/game commands', async t => {
  const f = fixture(t);
  f.write('packages/starchess-arena/hermetic/verification-plan.mjs', `
    import { readdirSync } from 'node:fs';
    export function verificationCommands(root) {
      const inputs = ['starchess-core','starchess-arena'].flatMap(name => readdirSync(root+'/packages/'+name+'/src/__tests__').map(file => '/app/packages/'+name+'/src/__tests__/'+file));
      return [null,null,null,null,null,{executable:'/app/packages/starchess-arena/node_modules/.bin/tsc',cwd:'/app/packages/starchess-arena',args:['--noEmit','--strict',...inputs,'/app/scripts/challenge-contract-evidence.ts','/app/scripts/challenge-validate-baseline.ts']}];
    }
  `);
  const inputs = snapshotInputs(f.root);
  const staticPlan = await fixedPlan(f.root, f.scratch(), 'static', inputs);
  assert.equal(staticPlan[0].id, 'planning-budget-audit');
  assert.deepEqual(staticPlan[0].args, [join(f.root, 'scripts/r4-planning-budget-audit.mjs')]);
  const fullScratch = f.scratch();
  const fullPlan = await fixedPlan(f.root, fullScratch, 'full', inputs);
  assert.deepEqual(fullPlan.slice(0, staticPlan.length), staticPlan);
  const strict = staticPlan.find(entry => entry.id === 'strict-core-arena-invoice');
  assert(strict.args.includes(join(f.root, 'packages/starchess-core/src/__tests__/fixture.ts')));
  assert(strict.args.includes(join(f.root, 'packages/starchess-arena/src/__tests__/fixture.ts')));
  assert(strict.args.includes(join(f.root, 'scripts/challenge-validate-baseline.ts')));
  assert.equal(staticPlan.filter(entry => entry.tool === 'tsc').length, 4);
  assert.equal(staticPlan.filter(entry => entry.id.startsWith('syntax-')).length, 2);
  const suites = fullPlan.filter(entry => entry.tool === 'vitest');
  assert.equal(suites.length, 3);
  for (const suite of suites) {
    assert.deepEqual(suite.args.slice(0, 1), ['run']);
    assert(suite.args.includes('--no-cache'));
    assert.equal(suite.args[suite.args.indexOf('--configLoader') + 1], 'native');
    assert.equal(suite.args[suite.args.indexOf('--maxWorkers') + 1], '2');
    assert(suite.args.includes('--reporter=default') && suite.args.includes('--reporter=json'));
    assert(suite.args.at(-1).startsWith(fullScratch));
    assert(!existsSync(suite.testReport));
    assert.match(readFileSync(suite.args[2], 'utf8'), /\.\.\.base\.test, cache: false/);
  }
  assert.equal(fullPlan.filter(entry => entry.nodeTap).length, 4);
  assert(fullPlan.some(entry => entry.id === 'node-r4-tooling' && entry.args.includes(join(f.root, 'scripts/r4-host-verify.test.mjs'))));
  assert(!JSON.stringify(fullPlan).match(/pnpm|corepack|docker|publish|deploy|challenge\.ts|calibrat/));
  await assert.rejects(fixedPlan(f.root, f.scratch(), 'arbitrary', inputs));
});

test('synthetic static diagnose persists a passing result but cannot self-certify R4', async t => {
  const f = fixture(t);
  const tool = install(f, 'typescript', { bin: { tsc: 'bin/tsc.js' } }, { 'bin/tsc.js': 'process.exitCode=0;\n' });
  assert(tool);
  install(f, 'tsx', { bin: { tsx: 'cli.mjs' } }, { 'cli.mjs': 'process.exitCode=0;\n' });
  for (const name of PACKAGES) f.write(`packages/${name}/package.json`, { name: `@chess-coach/${name}`, type: 'module', devDependencies: { typescript: '1', tsx: '1' } });
  f.write('scripts/check-public-closure.mjs', 'process.stdout.write("synthetic public audit only");\n');
  f.write('scripts/r4-planning-budget-audit.mjs', 'process.stdout.write("synthetic audit only");\n');
  f.write('packages/starchess-arena/hermetic/verification-plan.mjs', `export function verificationCommands(){return [null,null,null,null,null,{executable:'/app/packages/starchess-arena/node_modules/.bin/tsc',cwd:'/app/packages/starchess-arena',args:['--noEmit','--strict','/app/packages/starchess-core/src/__tests__/fixture.ts','/app/packages/starchess-arena/src/__tests__/fixture.ts']}];}\n`);
  const result = await diagnose(f.root, { stage: 'static', mode: 'diagnose', tempParent: f.directory });
  assert.equal(result.kind, KIND);
  assert.equal(result.checksPassed, true);
  assert.equal(result.diagnosticsComplete, true);
  assert.equal(result.r4Acceptance, 'NOT_ESTABLISHED');
  assert.deepEqual(result.openGates, OPEN_GATES);
  assert.equal(result.status, 'DIAGNOSTICS_PASSED');
  assert.deepEqual(JSON.parse(readFileSync(join(result.directory, 'result.json'))), result);
  assert(!existsSync(join(result.directory, 'verification.json')));
  assert(!existsSync(join(f.root, '_spec/evidence/verification.json')));
});

test('synthetic full diagnose runs only fresh stub suites and tiny Node evidence fixtures', async t => {
  const f = fixture(t);
  install(f, 'typescript', { bin: { tsc: 'bin/tsc.js' } }, { 'bin/tsc.js': 'process.exitCode=0;\n' });
  install(f, 'tsx', { bin: { tsx: 'cli.mjs' } }, { 'cli.mjs': 'process.exitCode=0;\n' });
  const vitest = install(f, 'vitest', { bin: { vitest: 'cli.mjs' } }, {
    'cli.mjs': `import {writeFileSync} from 'node:fs'; const path=process.argv[process.argv.indexOf('--outputFile')+1]; writeFileSync(path,${JSON.stringify(JSON.stringify(passingReport()))});\n`,
  });
  writeFileSync(join(vitest, 'package.json'), JSON.stringify({ name: 'vitest', version: '1', type: 'module', bin: { vitest: 'cli.mjs' } }));
  for (const name of PACKAGES) f.write(`packages/${name}/package.json`, { name: `@chess-coach/${name}`, type: 'module', devDependencies: { typescript: '1', tsx: '1', vitest: '1' } });
  f.write('scripts/check-public-closure.mjs', 'process.exitCode=0;\n');
  f.write('scripts/r4-planning-budget-audit.mjs', 'process.exitCode=0;\n');
  f.write('packages/starchess-arena/hermetic/verification-plan.mjs', `export function verificationCommands(){return [null,null,null,null,null,{executable:'/app/packages/starchess-arena/node_modules/.bin/tsc',cwd:'/app/packages/starchess-arena',args:['--noEmit','--strict','/app/packages/starchess-core/src/__tests__/fixture.ts','/app/packages/starchess-arena/src/__tests__/fixture.ts']}];}\n`);
  for (const name of ['evidence-bundle', 'image-measurement', 'tar']) f.write(`packages/starchess-arena/hermetic/${name}.test.mjs`, 'import test from "node:test"; test("synthetic only",()=>{});\n');
  for (const path of ['scripts/r4-host-verify.test.mjs', 'packages/starchess-arena/hermetic/r4-budget-audit.test.mjs',
    'packages/starchess-arena/hermetic/r4-context.test.mjs']) f.write(path, 'import test from "node:test"; test("synthetic tooling only",()=>{});\n');
  const result = await diagnose(f.root, { stage: 'full', mode: 'diagnose', tempParent: f.directory });
  assert.equal(result.checksPassed, true);
  assert.equal(result.diagnosticsComplete, true);
  assert.equal(result.r4Acceptance, 'NOT_ESTABLISHED');
  assert.equal(result.commands.filter(record => record.tests).length, 3);
  assert.equal(result.commands.filter(record => record.tap).length, 4);
  assert.equal(result.commands.filter(record => record.tests).reduce((sum, record) => sum + record.tests.assertions, 0), 6);
  assert(result.commands.every(record => record.executable === process.execPath));
});
