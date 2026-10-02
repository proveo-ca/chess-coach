// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { prepareContext, repository } from './context.mjs';
import { assertContainerPolicy, outputTarget, runArguments, tmpfsOptions } from './policy.mjs';
import pins from './pins.json' with { type: 'json' };
import { freshOutput } from './run.mjs';
import { logLimit, runLogged } from './logged-command.mjs';

const parent = '/tmp/opencode';
function fixture() {
  assert(existsSync(parent));
  const path = mkdtempSync(join(parent, 'hermetic-test-'));
  return path;
}

test('Dockerfile pins the official platform and isolates offline installation from acquisition', () => {
  const text = readFileSync(new URL('./Dockerfile', import.meta.url), 'utf8');
  const instructions = text.split('\n').filter((line) => line && !line.startsWith('#'));
  const stages = new Map();
  let stage;
  for (const line of instructions) {
    if (!stage) {
      if (line === 'ARG FROZEN_DEPENDENCIES=dependencies') continue;
      assert(line.startsWith('FROM '));
    }
    if (line.startsWith('FROM ')) {
      const match = /^FROM (\S+) AS (\w+)$/.exec(line);
      assert(match, `unsupported FROM grammar: ${line}`);
      stage = match[2];
      stages.set(stage, { base: match[1], lines: [] });
    } else stages.get(stage).lines.push(line);
  }
  assert.match(stages.get('tools').base, /^docker\.io\/library\/node:22\.23\.2-bookworm-slim@sha256:[0-9a-f]{64}$/);
  assert(stages.get('tools').base.endsWith(pins.basePlatformDigest));
  assert.equal(stages.get('dependencies').base, 'tools');
  assert.equal(stages.get('frozen').base, '${FROZEN_DEPENDENCIES}');
  assert.equal(stages.get('runtime').base, 'frozen');
  for (const [name, value] of stages) {
    for (const line of value.lines) {
      assert(!/^ADD\b/.test(line));
      assert(!/^COPY\s+\.\s/.test(line));
      if (['dependencies', 'runtime'].includes(name) && line.startsWith('RUN ')) assert(line.startsWith('RUN --network=none '));
      if (name === 'runtime') assert(!/\b(install|fetch|curl|wget|npm|pnpm)\b/.test(line));
    }
  }
  const installation = stages.get('dependencies').lines.find((line) => /\binstall\b/.test(line));
  assert.match(installation, /--offline\b/);
  assert.match(installation, /--frozen-lockfile\b/);
  assert(stages.get('dependencies').lines.some((line) => /^COPY --from=acquisition \/pnpm\/store\//.test(line)));
  assert(stages.get('runtime').lines.includes('USER 10001:10001'));
});

test('context keeps the original lock and workspace links without root dependencies or host stores', () => {
  const context = fixture();
  const capture = prepareContext(context, true);
  assert.equal(readFileSync(join(context, 'deps/pnpm-lock.yaml'), 'utf8'), readFileSync(join(repository, 'pnpm-lock.yaml'), 'utf8'));
  assert.equal(JSON.parse(readFileSync(join(context, 'deps/packages/starchess-arena/package.json'), 'utf8')).dependencies['@chess-coach/starchess-core'], 'workspace:*');
  assert(!existsSync(join(context, 'deps/package.json')));
  assert(!existsSync(join(context, 'deps/node_modules')));
  assert(!existsSync(join(context, 'deps/.pnpm-store')));
  assert(!existsSync(join(context, 'deps/.env')));
  assert(capture.optionalConfigs.some((entry) => entry.path === '.npmrc' && entry.present === false));
  assert.deepEqual(readdirSync(context).sort(), ['Dockerfile', 'capture.json', 'deps', 'hermetic']);
});

test('runtime capture preserves JSONC config closure, tests, fixtures, and rejects escaping paths or ancestor symlinks', () => {
  const root = fixture();
  const files = {
    'package.json': '{"private":true}', 'pnpm-lock.yaml': 'lockfileVersion: 9\n', 'pnpm-workspace.yaml': 'packages: []\n',
    'packages/starchess-arena/package.json': '{}', 'packages/starchess-core/package.json': '{}',
    'packages/starchess-arena/tsconfig.json': '{ // JSONC\n "extends": "../../config/base", }',
    'packages/starchess-core/tsconfig.json': '{"extends":["../../config/base.json"]}',
    'config/base.json': '{"extends":"./nested/strict.json"}', 'config/nested/strict.json': '{}',
    'packages/starchess-core/src/__tests__/fixture.json': '{}', 'packages/starchess-arena/src/__tests__/case.test.ts': 'export {};\n',
    'scripts/challenge-contract-evidence.ts': 'export {};\n', '_spec/corpora/ml-adjutant-corpus.manifest.json': '{"sourcePath":"corpus.json"}',
    '_spec/evidence/ml-adjutant-phase1/baseline-report.json': '{}', '_spec/evidence/ml-adjutant-phase1/verification.json': '{}', 'corpus.json': '{}',
    'packages/starchess-core/node_modules/host-secret': 'excluded', 'packages/starchess-arena/.pnpm-store/host-secret': 'excluded',
  };
  for (const [name, value] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, value);
  }
  const control = join(root, 'packages/starchess-arena/hermetic');
  mkdirSync(control);
  writeFileSync(join(control, 'Dockerfile'), 'FROM scratch\n');
  const context = fixture();
  const capture = prepareContext(context, false, root);
  assert(capture.runtime.entries.some((entry) => entry.path.endsWith('fixture.json')));
  assert(capture.runtime.entries.some((entry) => entry.path.endsWith('case.test.ts')));
  assert(!capture.runtime.entries.some((entry) => entry.path.includes('host-secret')));
  assert(!existsSync(join(context, 'runtime/_spec/evidence/ml-adjutant-phase2')));
  assert.equal(readFileSync(join(context, 'runtime/config/base.json'), 'utf8'), files['config/base.json']);
  assert.equal(readFileSync(join(context, 'runtime/config/nested/strict.json'), 'utf8'), '{}');
  assert(capture.configClosure.includes('config/nested/strict.json'));
  writeFileSync(join(root, 'config/base.json'), '{"extends":"../packages/starchess-arena/tsconfig.json"}');
  assert.throws(() => prepareContext(fixture(), false, root), /Cyclic tsconfig extends/);
  writeFileSync(join(root, 'config/base.json'), '{"extends":"../../outside.json"}');
  assert.throws(() => prepareContext(fixture(), false, root), /escapes repository/);
  writeFileSync(join(root, 'config/base.json'), '{"extends":"./missing.json"}');
  assert.throws(() => prepareContext(fixture(), false, root), /Missing or ambiguous tsconfig extends/);
  writeFileSync(join(root, 'config/base.json'), files['config/base.json']);
  const outside = fixture();
  renameSync(join(root, 'config'), join(outside, 'config'));
  symlinkSync(join(outside, 'config'), join(root, 'config'));
  assert.throws(() => prepareContext(fixture(), false, root), /Host symlink excluded/);
  symlinkSync('/etc/passwd', join(root, 'packages/starchess-core/src/escape'));
  assert.throws(() => prepareContext(fixture(), false, root), /Host symlink excluded/);
  renameSync(join(root, 'packages'), join(outside, 'packages'));
  symlinkSync(join(outside, 'packages'), join(root, 'packages'));
  assert.throws(() => prepareContext(fixture(), true, root), /Host symlink excluded/);
  const alias = fixture();
  symlinkSync(root, join(alias, 'repository'));
  assert.throws(() => prepareContext(fixture(), true, join(alias, 'repository')), /Host symlink excluded/);
});

test('CLI rejects mount injection and public output parents and preserves bounded success/failure logs', async () => {
  const image = 'sha256:' + 'a'.repeat(64);
  for (const malicious of ['node:latest', '--privileged', 'sha256:' + 'a'.repeat(64) + '\n--network=host']) assert.throws(() => runArguments(malicious, '/tmp/opencode/out'));
  const syntheticOutput = '/tmp/opencode/policy-output';
  const approved = {
    Image: image,
    HostConfig: { NetworkMode: 'none', ReadonlyRootfs: true, Privileged: false, Init: true, NanoCpus: 2_000_000_000, Memory: 4 * 1024 ** 3, MemorySwap: 4 * 1024 ** 3, PidsLimit: 256, CapDrop: ['ALL'], CapAdd: null, SecurityOpt: ['no-new-privileges=true'], Tmpfs: { '/tmp': tmpfsOptions } },
    Config: { User: '10001:10001' },
    Mounts: [
      { Type: 'bind', Destination: outputTarget, Source: syntheticOutput, RW: true },
      { Type: 'tmpfs', Destination: '/tmp' },
    ],
  };
  assertContainerPolicy(approved, syntheticOutput);
  const extraTmpfs = structuredClone(approved);
  extraTmpfs.Mounts.push({ Type: 'tmpfs', Destination: '/run' });
  assert.throws(() => assertContainerPolicy(extraTmpfs, syntheticOutput), /policy mismatch/);
  const looseTmpfs = structuredClone(approved);
  looseTmpfs.HostConfig.Tmpfs['/tmp'] = 'rw,nosuid,nodev';
  assert.throws(() => assertContainerPolicy(looseTmpfs, syntheticOutput), /policy mismatch/);
  for (const path of ['relative', '/tmp/x,target=/app', '/tmp/x\n--privileged']) assert.throws(() => runArguments(image, path));
  const args = runArguments(image, '/tmp/opencode/output with spaces;literal', ['code', 'scripts/test.ts', 'literal;$(touch /tmp/forbidden)']);
  assert(args.includes('type=bind,source=/tmp/opencode/output with spaces;literal,target=' + outputTarget + ',bind-propagation=rprivate'));
  assert.equal(args.at(-1), 'literal;$(touch /tmp/forbidden)');
  assert.notEqual(lstatSync(parent).mode & 0o077, 0);
  const publicOutput = join(parent, `public-output-${Date.now()}-${process.pid}`);
  assert.throws(() => freshOutput(publicOutput), /private host-owned ancestor/);
  assert(!existsSync(publicOutput));
  const protectedOutput = freshOutput(join(fixture(), 'output'));
  assert.equal(lstatSync(protectedOutput).mode & 0o777, 0o777);
  const directory = fixture();
  const noisy = await runLogged(process.execPath, ['-e', `process.stdout.write(Buffer.alloc(${logLimit + 4096}, 'a')); process.stderr.write(Buffer.alloc(${logLimit + 8192}, 'b'));`], { directory, prefix: 'bounded' });
  assert.equal(noisy.exitCode, 0);
  for (const [name, log] of Object.entries(noisy.logs)) {
    assert.equal(log.bytes, 8 * 1024 * 1024);
    assert.equal(log.truncated, true);
    const bytes = readFileSync(log.path);
    assert.equal(bytes.length, log.bytes);
    assert.equal(log.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(bytes[0], name === 'stdout' ? 97 : 98);
  }
  const failure = await runLogged(process.execPath, ['-e', 'console.log("partial progress"); console.error("failure diagnostic"); process.exit(3);'], { directory, prefix: 'failed' });
  assert.equal(failure.exitCode, 3);
  assert.match(readFileSync(failure.logs.stdout.path, 'utf8'), /partial progress/);
  assert.match(readFileSync(failure.logs.stderr.path, 'utf8'), /failure diagnostic/);
  assert.equal(failure.logs.stdout.truncated, false);
});

test('Docker enforces policy, fresh temporary inventory, and logged offline TS/Vitest', { skip: !process.env.HERMETIC_DEPENDENCY_IMAGE }, async () => {
  const image = process.env.HERMETIC_DEPENDENCY_IMAGE;
  const work = fixture();
  const output = freshOutput(join(work, 'output'));
  const args = runArguments(image, output, ['preflight']);
  const position = args.indexOf(image);
  args.splice(position, 0, '--entrypoint', 'node');
  args.splice(args.indexOf(image) + 1, 1, '/hermetic/probe.mjs');
  const docker = (command) => execFileSync('docker', command, { encoding: 'utf8' });
  const container = docker(['create', ...args.slice(1)]).trim();
  try {
    const [inspect] = JSON.parse(docker(['inspect', container]));
    const [imageInspect] = JSON.parse(docker(['image', 'inspect', image]));
    assert.equal(inspect.Image, imageInspect.Id);
    assertContainerPolicy(inspect, output);
    const wrongMount = structuredClone(inspect);
    wrongMount.Mounts[0].Source = join(output, 'replaced');
    assert.throws(() => assertContainerPolicy(wrongMount, output), /policy mismatch/);
    assert.equal(inspect.HostConfig.NetworkMode, 'none');
    assert.equal(inspect.HostConfig.ReadonlyRootfs, true);
    assert.equal(inspect.HostConfig.Memory, 4294967296);
    assert.equal(inspect.HostConfig.NanoCpus, 2000000000);
    assert.equal(inspect.HostConfig.PidsLimit, 256);
    const executionLog = await runLogged('docker', ['start', '--attach', container], { directory: work, prefix: 'docker' });
    assert.equal(executionLog.exitCode, 0);
    const [completed] = JSON.parse(docker(['inspect', container]));
    assert.equal(completed.State.ExitCode, 0);
    assert.equal(completed.State.OOMKilled, false);
    const report = JSON.parse(readFileSync(join(output, 'probe.json'), 'utf8'));
    assert.equal(report.passed, true);
    assert.equal(report.closure.tools.node, '22.23.2');
    assert.equal(report.freshTemporaryRoot, true);
    assert.equal(report.sourceOnlyInventoryFiles, 1);
    const tested = report.commands.find((entry) => entry.tests);
    assert.equal(tested.tests.total, 1);
    assert.equal(tested.tests.passed, 1);
    for (const command of report.commands) {
      for (const log of Object.values(command.logs)) {
        const path = join(output, log.path.slice(outputTarget.length + 1));
        assert.equal(log.sha256, createHash('sha256').update(readFileSync(path)).digest('hex'));
      }
    }
    writeFileSync(join(work, 'execution.json'), JSON.stringify({ initialContainerInspection: inspect, finalContainerInspection: completed, executionLog, report }, null, 2) + '\n');
    console.log(`Docker probe evidence: ${output}/probe.json`);
  } finally {
    docker(['rm', container]);
  }
});
