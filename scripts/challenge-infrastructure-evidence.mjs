import { createHash } from 'node:crypto';
import { constants, closeSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareContext } from '../packages/starchess-arena/hermetic/context.mjs';
import { evidenceLimits } from '../packages/starchess-arena/hermetic/evidence-limits.mjs';
import { measureImageFilesystem } from '../packages/starchess-arena/hermetic/image-measurement.mjs';
import { runLogged } from '../packages/starchess-arena/hermetic/logged-command.mjs';
import { assertContainerPolicy, outputTarget } from '../packages/starchess-arena/hermetic/policy.mjs';

export const INFRASTRUCTURE_VERSION = 'r2-infrastructure-verification-v1';
export const INFRASTRUCTURE_TEST_NAMES = Object.freeze([
  'Dockerfile pins the official platform and isolates offline installation from acquisition',
  'context keeps the original lock and workspace links without root dependencies or host stores',
  'current verification freezes eleven exact commands and the complete strict source invoice',
  'runtime capture preserves JSONC config closure, tests, fixtures, and rejects escaping paths or ancestor symlinks',
  'CLI rejects mount injection and public output parents and preserves bounded success/failure logs',
  'Docker enforces policy, fresh temporary inventory, and logged offline TS/Vitest',
]);
export const INFRASTRUCTURE_TESTS = INFRASTRUCTURE_TEST_NAMES.length;
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const infraPath = join(root, 'packages/starchess-arena/hermetic/infra.test.mjs');
const scriptPath = fileURLToPath(import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const immutable = (value) => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
const fail = (message) => { throw new Error(`Infrastructure ${message}`); };

export function infrastructureReader() {
  const memo = new Map();
  let retained = 0;
  return (path) => {
    if (typeof path !== 'string' || !path || Buffer.byteLength(path) > evidenceLimits.pathBytes || /[\0\r\n]/.test(path)) fail('input path invalid');
    path = resolve(path);
    if (memo.has(path)) return memo.get(path);
    if (realpathSync(dirname(path)) !== dirname(path)) fail('input ancestor is not canonical');
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = fstatSync(fd);
      if (!before.isFile() || !Number.isSafeInteger(before.size) || before.size < 0 || before.size > evidenceLimits.fileBytes) fail('input exceeds byte cap');
      if (before.size > evidenceLimits.retainedBytes - retained) fail('aggregate byte cap exceeded');
      retained += before.size;
      const bytes = Buffer.alloc(before.size);
      for (let offset = 0; offset < bytes.length;) {
        const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
        if (!count) fail('input truncated');
        offset += count;
      }
      const after = fstatSync(fd);
      if (['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs'].some((key) => before[key] !== after[key])) fail('input changed');
      memo.set(path, bytes);
      return bytes;
    } finally { closeSync(fd); }
  };
}

export function recountInfrastructureTap(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!text.startsWith('TAP version 13\n') || /(?:^|\n)\s*Bail out!|^\s*(?:ok|not ok)\b[^\n]*#\s*(?:SKIP|TODO)\b/im.test(text)) fail('TAP contains omitted or failed tests');
  const results = [...text.matchAll(/^(ok|not ok) (\d+) - (.+)$/gm)];
  if (results.length !== INFRASTRUCTURE_TESTS || results.some((entry, index) => entry[1] !== 'ok' || Number(entry[2]) !== index + 1 ||
      entry[3] !== INFRASTRUCTURE_TEST_NAMES[index])) fail('TAP test count or Docker test mismatch');
  if (/^\s*not ok\b/m.test(text)) fail('TAP contains omitted or failed tests');
  const plans = [...text.matchAll(/^1\.\.(\d+)$/gm)];
  if (plans.length !== 1 || Number(plans[0][1]) !== INFRASTRUCTURE_TESTS) fail('TAP plan mismatch');
  const counts = { tests: INFRASTRUCTURE_TESTS, suites: 0, pass: INFRASTRUCTURE_TESTS, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
  for (const [key, expected] of Object.entries(counts)) {
    const matches = [...text.matchAll(new RegExp(`^# ${key} (\\d+)$`, 'gm'))];
    if (matches.length !== 1 || Number(matches[0][1]) !== expected) fail(`TAP ${key} summary mismatch`);
  }
  return counts;
}

export function infrastructureHost(read) {
  return { executable: process.execPath, nodeVersion: process.version, platform: process.platform, arch: process.arch,
    script: { path: scriptPath, sha256: hash(read(scriptPath)) }, source: { path: infraPath, sha256: hash(read(infraPath)) } };
}

export function validateInfrastructure(value, { read, image, measurements, controlSha256, host = infrastructureHost(read) }) {
  if (!object(value) || value.version !== INFRASTRUCTURE_VERSION || value.passed !== true) fail('verification did not pass');
  if (!immutable(image) || value.image !== image || value.imageInspection?.Id !== image) fail('dependency image mismatch');
  if (!digest(controlSha256) || measurements?.capture?.controlSha256 !== controlSha256 || value.measurements?.capture?.controlSha256 !== controlSha256) fail('control binding mismatch');
  if (!object(measurements?.dependencies) || measurements.source || !same(value.measurements, measurements)) fail('host image remeasurement mismatch');
  if (!same(value.host, host)) fail('host runtime or source metadata mismatch');
  const command = value.command;
  if (!object(command) || command.executable !== process.execPath || !same(command.args, ['--test', infraPath]) || command.cwd !== root ||
      !same(command.env, { HERMETIC_DEPENDENCY_IMAGE: image }) || command.exitCode !== 0 || command.signal !== null || command.error !== null ||
      !['started', 'finished'].every((key) => typeof command[key] === 'string' && new Date(command[key]).toISOString() === command[key]) || command.finished < command.started) fail('exact command or runtime environment mismatch');
  const artifacts = [];
  const add = (metadata, path, label, boundedLog = false) => {
    if (!object(metadata) || typeof metadata.path !== 'string' || !digest(metadata.sha256) || !Number.isSafeInteger(metadata.bytes) || metadata.bytes < 0 ||
        metadata.bytes > (boundedLog ? 8 * 1024 * 1024 : evidenceLimits.fileBytes) || boundedLog && (metadata.truncated !== false || metadata.observedBytes !== metadata.bytes)) fail(`${label} metadata invalid`);
    const bytes = read(metadata.path);
    if (bytes.length !== metadata.bytes || hash(bytes) !== metadata.sha256) fail(`${label} checksum mismatch`);
    artifacts.push({ path, bytes });
    return bytes;
  };
  if (!object(command.logs)) fail('host logs missing');
  const stdout = add(command.logs.stdout, 'host-infrastructure/stdout.log', 'stdout', true);
  add(command.logs.stderr, 'host-infrastructure/stderr.log', 'stderr', true);
  const counted = recountInfrastructureTap(stdout);
  if (!same(value.tap, counted)) fail('TAP envelope summary mismatch');
  const paths = [...stdout.toString('utf8').matchAll(/^# Docker probe evidence:(?: )([^\r\n]+)$/gm)];
  if (paths.length !== 1 || value.probe?.report?.path !== paths[0][1]) fail('Docker probe output path mismatch');
  const reportBytes = add(value.probe.report, 'host-infrastructure/probe.json', 'Docker probe');
  const report = JSON.parse(reportBytes);
  const executionBytes = add(value.probe.execution, 'host-infrastructure/inspections.json', 'Docker inspections');
  const execution = JSON.parse(executionBytes);
  const output = dirname(value.probe.report.path);
  if (value.probe.execution.path !== join(dirname(output), 'execution.json') || execution.output !== output || execution.image !== image || execution.imageInspection?.Id !== image ||
      execution.initialContainerInspection?.Image !== image || execution.finalContainerInspection?.Image !== image ||
      execution.finalContainerInspection?.State?.ExitCode !== 0 || execution.finalContainerInspection?.State?.OOMKilled !== false || !same(execution.report, report) || !same(value.imageInspection, execution.imageInspection)) fail('Docker inspection image or report binding mismatch');
  assertContainerPolicy(execution.initialContainerInspection, output);
  assertContainerPolicy(execution.finalContainerInspection, output);
  for (const inspection of [execution.initialContainerInspection, execution.finalContainerInspection]) {
    const config = inspection.Config;
    if (!same(config.Entrypoint, ['node']) || !same(config.Cmd, ['/hermetic/probe.mjs']) || config.WorkingDir !== '/app' ||
        !Array.isArray(config.Env) || !config.Env.every((entry) => typeof entry === 'string') ||
        !same(config.Env.filter((entry) => entry === 'HERMETIC_OUTPUT_DIRECTORY' || entry.startsWith('HERMETIC_OUTPUT_DIRECTORY=')),
          [`HERMETIC_OUTPUT_DIRECTORY=${outputTarget}`])) fail('Docker probe container command or environment mismatch');
  }
  if (!object(report) || report.passed !== true || report.freshTemporaryRoot !== true || report.sourceOnlyInventoryFiles !== 1 ||
      report.installedSha256 !== measurements.dependencies.installedSha256 || report.frozenStoreSha256 !== measurements.dependencies.frozenStoreSha256 ||
      report.toolsSha256 !== measurements.dependencies.toolTreeSha256 || !same(report.closure, measurements.closure?.actual) || !Array.isArray(report.commands) || report.commands.length !== 3) fail('Docker probe assurance mismatch');
  const arena = '/app/packages/starchess-arena/node_modules/.bin/';
  const expected = [
    { executable: `${arena}tsx`, args: ['/tmp/test/source-only-inventory.ts'] },
    { executable: `${arena}tsx`, args: ['/tmp/test/direct.ts'] },
    { executable: `${arena}vitest`, args: ['run', '--config', '/tmp/test/config.mts', '--configLoader', 'native', '--reporter=default', '--reporter=json', '--outputFile', `${outputTarget}/vitest-probe.json`] },
  ];
  if (!Array.isArray(value.probe.artifacts) || value.probe.artifacts.length !== 9) fail('Docker probe artifact inventory incomplete');
  const inventory = new Map();
  for (const entry of value.probe.artifacts) {
    if (!object(entry) || typeof entry.relative !== 'string' || !/^(?:logs\/(?:inventory|tsx|vitest)\.(?:stdout|stderr)\.log|vitest-probe\.json|docker\.(?:stdout|stderr)\.log)$/.test(entry.relative) || inventory.has(entry.relative)) fail('Docker probe artifact path invalid');
    const absolute = entry.relative.startsWith('docker.') ? join(dirname(output), entry.relative) : join(output, entry.relative);
    if (entry.path !== absolute) fail('Docker probe artifact path mismatch');
    inventory.set(entry.relative, { metadata: entry, bytes: add(entry, `host-infrastructure/${entry.relative}`, 'Docker artifact', entry.relative.endsWith('.log')) });
  }
  const bindLog = (entry, relative) => {
    const retained = inventory.get(relative);
    if (!retained || !same(entry, Object.fromEntries(Object.entries(retained.metadata).filter(([key]) => key !== 'relative')))) fail('Docker command log binding mismatch');
  };
  const docker = execution.executionLog;
  if (!object(docker) || docker.executable !== 'docker' || !Array.isArray(docker.args) || docker.args.length !== 3 || docker.args[0] !== 'start' || docker.args[1] !== '--attach' ||
      docker.args[2] !== execution.initialContainerInspection.Id || execution.finalContainerInspection.Id !== docker.args[2] || docker.exitCode !== 0 || docker.signal !== null || docker.error !== null) fail('Docker execution command mismatch');
  for (const stream of ['stdout', 'stderr']) bindLog(docker.logs?.[stream], `docker.${stream}.log`);
  for (const [index, expectedCommand] of expected.entries()) {
    const actual = report.commands[index];
    if (!object(actual) || actual.executable !== expectedCommand.executable || !same(actual.args, expectedCommand.args) || actual.cwd !== '/tmp/test' || actual.exitCode !== 0 || actual.signal !== null || actual.error !== null) fail('Docker TS/Vitest command mismatch');
    for (const stream of ['stdout', 'stderr']) {
      const relative = `logs/${['inventory', 'tsx', 'vitest'][index]}.${stream}.log`;
      const metadata = inventory.get(relative)?.metadata;
      const log = actual.logs?.[stream];
      if (!metadata || !object(log) || log.path !== `${outputTarget}/${relative}` ||
          ['sha256', 'bytes', 'observedBytes', 'truncated'].some((key) => !Object.hasOwn(log, key) || log[key] !== metadata[key])) fail('Docker TS/Vitest log binding mismatch');
    }
  }
  const vitest = inventory.get('vitest-probe.json');
  const tests = report.commands[2].tests;
  const parsed = vitest ? JSON.parse(vitest.bytes) : null;
  if (!vitest || !object(tests) || tests.path !== `${outputTarget}/vitest-probe.json` || tests.sha256 !== hash(vitest.bytes) || tests.success !== true || tests.total !== 1 || tests.passed !== 1 || tests.failed !== 0 || tests.pending !== 0 || tests.todo !== 0 ||
      parsed?.success !== true || parsed.numTotalTests !== 1 || parsed.numPassedTests !== 1 || parsed.numFailedTests !== 0 || parsed.numPendingTests !== 0 || parsed.numTodoTests !== 0 ||
      parsed.numTotalTestSuites !== 1 || parsed.numPassedTestSuites !== 1 || parsed.numFailedTestSuites !== 0 || parsed.numPendingTestSuites !== 0 ||
      !Array.isArray(parsed.testResults) || parsed.testResults.length !== 1 || parsed.testResults[0].status !== 'passed' || parsed.testResults[0].assertionResults?.length !== 1 || parsed.testResults[0].assertionResults[0].status !== 'passed') fail('Docker Vitest assertion recount mismatch');
  return artifacts;
}

export async function captureInfrastructure({ image } = {}) {
  if (!immutable(image)) fail('immutable dependency image required');
  const parent = '/tmp/opencode';
  const stat = lstatSync(parent);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(parent) !== parent || stat.uid !== process.getuid()) fail('host-owned scratch parent required');
  const directory = mkdtempSync(join(parent, 'challenge-infrastructure-'));
  const read = infrastructureReader();
  const host = infrastructureHost(read);
  const measurements = await measureImageFilesystem(image);
  const context = join(directory, 'context');
  mkdirSync(context, { mode: 0o700 });
  let capture;
  try { capture = prepareContext(context, true); } finally { rmSync(context, { recursive: true, force: true }); }
  if (measurements.source || measurements.capture?.controlSha256 !== capture.control.sha256) fail('dependency control does not match host source');
  process.env.HERMETIC_DEPENDENCY_IMAGE = image;
  const command = await runLogged(process.execPath, ['--test', infraPath], { cwd: root, directory, prefix: 'infrastructure' });
  command.env = { HERMETIC_DEPENDENCY_IMAGE: image };
  const value = { version: INFRASTRUCTURE_VERSION, passed: false, image, imageInspection: { Id: image }, measurements, host, command };
  const path = join(directory, 'infrastructure.json');
  try {
    value.tap = recountInfrastructureTap(read(command.logs.stdout.path));
    const matches = [...read(command.logs.stdout.path).toString('utf8').matchAll(/^# Docker probe evidence: ([^\r\n]+)$/gm)];
    if (matches.length !== 1) fail('Docker probe output path missing');
    const reportPath = matches[0][1], output = dirname(reportPath);
    const metadata = (path) => { const bytes = read(path); return { path, sha256: hash(bytes), bytes: bytes.length }; };
    const report = JSON.parse(read(reportPath));
    const executionPath = join(dirname(output), 'execution.json');
    const execution = JSON.parse(read(executionPath));
    value.imageInspection = execution.imageInspection;
    const probeArtifacts = [];
    for (const entry of report.commands ?? []) for (const [stream, log] of Object.entries(entry.logs ?? {})) {
      if (typeof log.path !== 'string' || !log.path.startsWith(`${outputTarget}/logs/`)) fail('probe log path invalid');
      const relative = log.path.slice(outputTarget.length + 1);
      probeArtifacts.push({ ...log, ...metadata(join(output, relative)), relative });
    }
    probeArtifacts.push({ ...metadata(join(output, 'vitest-probe.json')), relative: 'vitest-probe.json' });
    for (const stream of ['stdout', 'stderr']) probeArtifacts.push({ ...execution.executionLog.logs[stream], relative: `docker.${stream}.log` });
    value.probe = { report: metadata(reportPath), execution: metadata(executionPath), artifacts: probeArtifacts };
    value.passed = true;
    validateInfrastructure(value, { read, image, measurements, controlSha256: capture.control.sha256, host });
  } catch (error) {
    value.passed = false;
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    throw new Error(`Infrastructure capture failed; retained evidence: ${path}`, { cause: error });
  }
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return { image, evidence: path };
}

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== '--image') fail('usage: --image sha256:<dependency-image>');
  console.log(JSON.stringify(await captureInfrastructure({ image: process.argv[3] })));
}
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) main().catch((error) => { console.error(error); process.exitCode = 1; });
