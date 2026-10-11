// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml, _spec/packages/starchess-training/r4-host-verification.puml
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { prepareContext, repository, r4AcceptedDocuments } from './context.mjs';
import { assertContainerPolicy, outputTarget, runArguments, tmpfsOptions } from './policy.mjs';
import pins from './pins.json' with { type: 'json' };
import { freshOutput, main, parseArguments } from './run.mjs';
import { logLimit, runLogged } from './logged-command.mjs';
import { workspacePackages, dependencyInputs, installedRoots } from './workspace-policy.mjs';
import { verificationCommands, strictInputs, VERIFICATION_VERSION } from './verification-plan.mjs';

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
  assert.deepEqual(capture.dependencyFiles.map((entry) => entry.path), dependencyInputs);
  assert.deepEqual(installedRoots, ['/app/node_modules', ...workspacePackages.map((name) => `/app/packages/${name}/node_modules`)]);
  const training = JSON.parse(readFileSync(join(context, 'deps/packages/starchess-training/package.json'), 'utf8'));
  assert.equal(training.dependencies['@chess-coach/starchess-arena'], 'workspace:*');
  assert.equal(training.dependencies.jssha, '3.3.2');
  assert.deepEqual(Object.keys(training.exports), ['./candidates']);
});

test('current verification freezes eleven exact commands and the complete strict source invoice', () => {
  const plan = verificationCommands(repository);
  assert.equal(VERIFICATION_VERSION, 'hermetic-verification-v3');
  assert.equal(plan.length, 11);
  assert.deepEqual(plan.slice(2, 5).map((command) => command.cwd), ['/app/packages/starchess-core', '/app/packages/starchess-arena', '/app/packages/starchess-training']);
  const inputs = strictInputs(repository);
  assert.equal(new Set(inputs).size, inputs.length);
  for (const path of ['packages/starchess-arena/src/__tests__/observationV1Bridge.test.ts', 'packages/starchess-arena/src/__tests__/intentCodecV1Bridge.test.ts', 'packages/starchess-arena/src/__tests__/r2CompositionEvidence.test.ts']) assert(inputs.includes(`/app/${path}`));
  assert.deepEqual(inputs.slice(-2), ['/app/scripts/challenge-contract-evidence.ts', '/app/scripts/challenge-validate-baseline.ts']);
  const invoice = [];
  const walk = (path) => {
    for (const entry of readdirSync(join(repository, path), { withFileTypes: true })) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (/\.tsx?$/.test(entry.name)) invoice.push(`/app/${child}`);
    }
  };
  walk('packages/starchess-core/src/__tests__');
  walk('packages/starchess-arena/src/__tests__');
  assert.deepEqual(inputs.slice(0, -2), invoice.sort());
  assert.deepEqual(plan[9].args, ['--test', '/app/packages/starchess-arena/hermetic/evidence-bundle.test.mjs', '/app/packages/starchess-arena/hermetic/image-measurement.test.mjs', '/app/packages/starchess-arena/hermetic/tar.test.mjs']);
  assert.deepEqual(plan[10], { executable: '/usr/local/bin/node', cwd: '/app', args: ['/app/scripts/check-public-closure.mjs'] });
  const context = fixture();
  const capture = prepareContext(context);
  for (const path of ['scripts/r2-composition-evidence.ts', 'packages/starchess-arena/hermetic/workspace-policy.mjs', 'packages/starchess-arena/hermetic/verification-plan.mjs', 'packages/starchess-arena/hermetic/public-closure.mjs']) assert(capture.runtime.entries.some((entry) => entry.path === path && entry.type === 'file'));
  for (const entry of capture.control.entries.filter((entry) => entry.type === 'file')) assert(capture.runtime.entries.some((file) => file.path === `packages/starchess-arena/hermetic/${entry.path}` && file.sha256 === entry.sha256));
});

test('runtime capture preserves JSONC config closure, tests, fixtures, and rejects escaping paths or ancestor symlinks', () => {
  const root = fixture();
  const files = {
    'package.json': '{"private":true}', 'pnpm-lock.yaml': 'lockfileVersion: 9\n', 'pnpm-workspace.yaml': 'packages: []\n',
    'packages/starchess-arena/package.json': '{}', 'packages/starchess-core/package.json': '{}',
    'packages/starchess-training/package.json': '{}', 'packages/starchess-training/tsconfig.json': '{}',
    'packages/starchess-training/src/__tests__/bridge.test.ts': 'export {};\n',
    'packages/starchess-arena/tsconfig.json': '{ // JSONC\n "extends": "../../config/base", }',
    'packages/starchess-core/tsconfig.json': '{"extends":["../../config/base.json"]}',
    'config/base.json': '{"extends":"./nested/strict.json"}', 'config/nested/strict.json': '{}',
    'packages/starchess-core/src/__tests__/fixture.json': '{}', 'packages/starchess-arena/src/__tests__/case.test.ts': 'export {};\n',
    'scripts/challenge-contract-evidence.ts': 'export {};\n', '_spec/corpora/ml-adjutant-corpus.manifest.json': '{"sourcePath":"corpus.json"}',
    '_spec/evidence/ml-adjutant-phase1/baseline-report.json': '{}', '_spec/evidence/ml-adjutant-phase1/verification.json': '{}', 'corpus.json': '{}',
    'packages/starchess-core/node_modules/host-secret': 'excluded', 'packages/starchess-arena/.pnpm-store/host-secret': 'excluded',
    ...Object.fromEntries(r4AcceptedDocuments.map(path => [path, `accepted fixture: ${path}\n`])),
  };
  for (const [name, value] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, value);
  }
  const control = join(root, 'packages/starchess-arena/hermetic');
  mkdirSync(control);
  writeFileSync(join(control, 'Dockerfile'), 'FROM scratch\n');
  mkdirSync(join(root, 'packages/starchess-core/src/empty'));
  const context = fixture();
  let capture;
  const previousUmask = process.umask(0o077);
  try { capture = prepareContext(context, false, root); }
  finally { process.umask(previousUmask); }
  assert.equal(lstatSync(root).mode & 0o7777, 0o700);
  assert.equal(lstatSync(context).mode & 0o7777, 0o700);
  assert.equal(lstatSync(join(context, 'capture.json')).mode & 0o7777, 0o644);
  assert.equal(lstatSync(join(context, 'deps/pnpm-workspace.yaml')).mode & 0o7777, 0o644);
  const checkDirectories = (path) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = join(path, entry.name);
      assert.equal(lstatSync(child).mode & 0o7777, 0o755, child);
      checkDirectories(child);
    }
  };
  checkDirectories(context);
  assert(capture.runtime.entries.some((entry) => entry.path.endsWith('fixture.json')));
  assert(capture.runtime.entries.some((entry) => entry.path.endsWith('case.test.ts')));
  assert(!capture.runtime.entries.some((entry) => entry.path.includes('host-secret')));
  assert(!existsSync(join(context, 'runtime/_spec/evidence/ml-adjutant-r2-refresh')));
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
  assert.deepEqual(parseArguments(['build', '--dependencies', '--no-cache']), { command: 'build', options: { dependencies: true, 'no-cache': true }, runtime: [] });
  assert.deepEqual(parseArguments(['build', '--from-dependencies', image, '--no-cache']), { command: 'build', options: { 'from-dependencies': image, 'no-cache': true }, runtime: [] });
  assert.deepEqual(parseArguments(['build']).options, {});
  assert.deepEqual(parseArguments(['run', '--image', image, '--', 'code', 'scripts/test.ts', '--no-cache']).runtime, ['code', 'scripts/test.ts', '--no-cache']);
  for (const argv of [
    ['build', '--no-cache', '--no-cache'], ['build', '--dependencies', '--dependencies'],
    ['build', '--no-cache=true'], ['build', '--no-cache', 'false'], ['build', '--unknown'],
    ['build', '--from-dependencies'], ['build', '--from-dependencies', image, '--from-dependencies', image],
    ['build', '--image', image], ['build', '--out', '/tmp/opencode/out'], ['build', '--'],
    ['preflight', '--image', image, '--no-cache'], ['run', '--image', image, '--no-cache'], ['export', '--image', image, '--no-cache'],
    ['preflight', '--image', image, '--dependencies'], ['run', '--image', image, '--from-dependencies', image],
    ['preflight', '--image', image, '--'], ['export', '--image', image, '--'],
    ['run', '--image', image, '--image', image], ['run', '--out'], ['run'], ['unknown'], ['--help', '--no-cache'],
  ]) {
    assert.throws(() => parseArguments(argv), /Invalid option|Option does not apply|--image is required|Unsupported command/);
    await assert.rejects(main(argv), /Invalid option|Option does not apply|--image is required|Unsupported command/);
  }
  for (const malicious of ['node:latest', '--privileged', 'sha256:' + 'a'.repeat(64) + '\n--network=host']) assert.throws(() => runArguments(malicious, '/tmp/opencode/out'));
  const syntheticOutput = '/tmp/opencode/policy-output';
  const approved = {
    Image: image,
    HostConfig: { NetworkMode: 'none', PidMode: '', IpcMode: 'private', ReadonlyRootfs: true, Privileged: false, Init: true, NanoCpus: 2_000_000_000, Memory: 4 * 1024 ** 3, MemorySwap: 4 * 1024 ** 3, PidsLimit: 256, CapDrop: ['ALL'], CapAdd: null, SecurityOpt: ['no-new-privileges=true'], Tmpfs: { '/tmp': tmpfsOptions } },
    Config: { User: '10001:10001' },
    Mounts: [
      { Type: 'bind', Destination: outputTarget, Source: syntheticOutput, RW: true, Propagation: 'rprivate' },
      { Type: 'tmpfs', Destination: '/tmp' },
    ],
  };
  assertContainerPolicy(approved, syntheticOutput);
  const hostConfigTemporary = structuredClone(approved);
  hostConfigTemporary.Mounts = hostConfigTemporary.Mounts.filter((mount) => mount.Type !== 'tmpfs');
  assertContainerPolicy(hostConfigTemporary, syntheticOutput);
  for (const key of ['PidMode', 'IpcMode']) {
    const sharedNamespace = structuredClone(approved);
    sharedNamespace.HostConfig[key] = 'host';
    assert.throws(() => assertContainerPolicy(sharedNamespace, syntheticOutput), /policy mismatch/);
  }
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
  const publicOutput = join(dirname(parent), `public-output-${Date.now()}-${process.pid}`);
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

test('Docker enforces policy, fresh temporary inventory, and logged offline TS/Vitest', async () => {
  const image = process.env.HERMETIC_DEPENDENCY_IMAGE;
  assert(image, 'HERMETIC_DEPENDENCY_IMAGE must name the freshly frozen dependency image');
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
    const extraTemporary = structuredClone(inspect);
    extraTemporary.Mounts.push({ Type: 'tmpfs', Destination: '/run' });
    assert.throws(() => assertContainerPolicy(extraTemporary, output), /policy mismatch/);
    for (const altered of ['rw,nosuid,nodev,size=1,mode=1777', 'rw,nosuid,nodev,size=1073741824,mode=777']) {
      const wrongTemporary = structuredClone(inspect);
      wrongTemporary.HostConfig.Tmpfs['/tmp'] = altered;
      assert.throws(() => assertContainerPolicy(wrongTemporary, output), /policy mismatch/);
    }
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
    writeFileSync(join(work, 'execution.json'), JSON.stringify({ image, output, imageInspection: imageInspect, initialContainerInspection: inspect, finalContainerInspection: completed, executionLog, report }, null, 2) + '\n');
    console.log(`Docker probe evidence: ${output}/probe.json`);
  } finally {
    docker(['rm', container]);
  }
});
