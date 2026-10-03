// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, mkdirSync, mkdtempSync, openSync, readSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareContext } from '../packages/starchess-arena/hermetic/context.mjs';
import { PublicationError, publishBundleExclusive } from '../packages/starchess-arena/hermetic/evidence-bundle.mjs';
import { evidenceLimits } from '../packages/starchess-arena/hermetic/evidence-limits.mjs';
import { measureImageFilesystem } from '../packages/starchess-arena/hermetic/image-measurement.mjs';
import { assertContainerPolicy, outputTarget } from '../packages/starchess-arena/hermetic/policy.mjs';
import { assertImageArchive } from '../packages/starchess-arena/hermetic/tar.mjs';

export { assertImageArchive };
export const ORIGINAL_BASELINE_SHA256 = '940387370040f88888e9dfe0bb86ad9d4a8be88854df507120f34b22ee2d362b';
export const ORIGINAL_VERIFICATION_SHA256 = '55d965afa71d775ff6ee1e95b6650a27d0ce759b966a81c43a3bb364236c7508';
export const MAX_IMPORT_BYTES = evidenceLimits.fileBytes;
export const MAX_ARCHIVE_BYTES = evidenceLimits.archiveBytes;
export const VITEST_FLOORS = Object.freeze({ 'vitest-starchess-core.json': 426, 'vitest-starchess-arena.json': 434 });
const REQUIRED = ['baseline-report.json', 'contract-report.json', 'coverage.json', 'pin-migration.json', ...Object.keys(VITEST_FLOORS)];
const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const SOURCE_ROOT = resolve(SCRIPT_DIR, '..');
const TSX = join(SOURCE_ROOT, 'packages/starchess-arena/node_modules/.bin/tsx');
const VALIDATOR = join(SCRIPT_DIR, 'challenge-validate-baseline.ts');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const equal = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);

export const safeRelative = (path) => {
  if (typeof path !== 'string' || Buffer.byteLength(path) > evidenceLimits.pathBytes || path.startsWith('/') || /[\\\0]/.test(path)) throw new Error(`Unsafe artifact path: ${path}`);
  const parts = path.split('/');
  if (!parts.length || parts.some((part) => !/^[A-Za-z0-9._-]+$/.test(part) || part === '.' || part === '..')) throw new Error(`Unsafe artifact path: ${path}`);
  return parts.join('/');
};

function boundedReader() {
  let retained = 0;
  return (path) => {
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = fstatSync(fd);
      if (!before.isFile() || !Number.isSafeInteger(before.size) || before.size < 0 || before.size > evidenceLimits.fileBytes) throw new Error(`Input exceeds byte cap or is not a regular file: ${path}`);
      if (before.size > evidenceLimits.retainedBytes - retained) throw new Error('Aggregate import byte cap exceeded');
      retained += before.size;
      const bytes = Buffer.alloc(before.size);
      for (let offset = 0; offset < bytes.length;) {
        const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
        if (!count) throw new Error(`Input truncated during read: ${path}`);
        offset += count;
      }
      const after = fstatSync(fd);
      if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) throw new Error(`Input changed during read: ${path}`);
      return bytes;
    } finally { closeSync(fd); }
  };
}

function decode(bytes, label) {
  const value = JSON.parse(bytes.toString('utf8'));
  if (!record(value)) throw new Error(`Invalid ${label} object`);
  return value;
}

export function recountVitest(report) {
  if (!record(report) || !Array.isArray(report.testResults)) throw new Error('Vitest report has no test results');
  const counts = { passed: 0, failed: 0, pending: 0, todo: 0 };
  for (const file of report.testResults) {
    if (!record(file) || file.status !== 'passed' || !Array.isArray(file.assertionResults)) throw new Error('Vitest report contains an unsuccessful test file');
    for (const assertion of file.assertionResults) {
      if (!record(assertion) || !Object.hasOwn(counts, assertion.status)) throw new Error('Vitest assertion status is not counted');
      counts[assertion.status]++;
    }
  }
  return { ...counts, total: counts.passed + counts.failed + counts.pending + counts.todo };
}

function verificationCommands(root) {
  const tests = readdirSync(join(root, 'packages/starchess-arena/src/__tests__')).filter((name) => /^challenge.*\.test\.ts$/.test(name) || ['observationIsolation.test.ts', 'resourceLedger.test.ts', 'strictRecordedQueues.test.ts'].includes(name)).sort();
  const arena = '/app/packages/starchess-arena';
  const core = '/app/packages/starchess-core';
  return [
    { executable: `${arena}/node_modules/.bin/tsx`, cwd: '/app', args: [`${arena}/src/cli/challenge.ts`, '--suite', 'all', '--rerun', '--out', `${outputTarget}/baseline-report.json`] },
    { executable: `${arena}/node_modules/.bin/tsx`, cwd: '/app', args: ['/app/scripts/challenge-contract-evidence.ts'] },
    ...[core, arena].map((cwd) => ({ executable: `${cwd}/node_modules/.bin/tsc`, cwd, args: ['-p', 'tsconfig.json', '--noEmit'] })),
    { executable: `${arena}/node_modules/.bin/tsc`, cwd: arena, args: ['--noEmit', '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--strict', '--skipLibCheck', ...tests.map((name) => `${arena}/src/__tests__/${name}`), '/app/scripts/challenge-contract-evidence.ts', '/app/scripts/challenge-validate-baseline.ts'] },
    ...[core, arena].map((cwd) => ({ executable: `${cwd}/node_modules/.bin/vitest`, cwd, args: ['run', '--config', `/tmp/${cwd.split('/').at(-1)}.vitest.mts`, '--configLoader', 'native', '--maxWorkers', '2', '--reporter=default', '--reporter=json', '--outputFile', `${outputTarget}/vitest-${cwd.split('/').at(-1)}.json`] })),
    { executable: '/usr/local/bin/node', cwd: '/app', args: ['--test', `${arena}/hermetic/evidence-bundle.test.mjs`, `${arena}/hermetic/image-measurement.test.mjs`, `${arena}/hermetic/tar.test.mjs`] },
  ];
}

function logRecords(value, label) {
  if (!record(value?.logs) || !record(value.logs.stdout) || !record(value.logs.stderr)) throw new Error(`Missing ${label} logs`);
  const streams = [value.logs.stdout, value.logs.stderr];
  if (streams.some((entry) => typeof entry.path !== 'string' || !digest(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > evidenceLimits.fileBytes)) throw new Error(`Invalid ${label} log metadata`);
  return streams;
}

function captureContext(root) {
  const scratch = mkdtempSync('/tmp/opencode/challenge-capture-');
  try {
    return { ...prepareContext(scratch, false, root), sourceRoot: join(scratch, 'runtime'), cleanup: () => rmSync(scratch, { recursive: true, force: true }) };
  } catch (error) { rmSync(scratch, { recursive: true, force: true }); throw error; }
}

export async function importEvidence({
  repositoryRoot, executionPath, buildPath, exportPath, expectedImage, destination,
  inspectImage = (image) => JSON.parse(execFileSync('docker', ['image', 'inspect', image], { encoding: 'utf8' }))[0],
  measureImage = measureImageFilesystem, captureContext: capture = captureContext, syncDirectory, beforePublication,
} = {}) {
  mkdirSync('/tmp/opencode', { recursive: true });
  const root = resolve(repositoryRoot);
  const read = boundedReader();
  const executionBytes = read(executionPath), buildBytes = read(buildPath), exportBytes = read(exportPath);
  const execution = decode(executionBytes, 'execution'), build = decode(buildBytes, 'build'), exported = decode(exportBytes, 'export');
  const image = expectedImage;
  if (typeof image !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error('Immutable image ID required');
  if ([execution.image, build.image, exported.image, execution.imageInspection?.Id, build.imageInspection?.Id, exported.imageInspection?.Id, execution.initialContainerInspection?.Image, execution.finalContainerInspection?.Image].some((value) => value !== image)) throw new Error('Image identity mismatch');
  const inspected = await inspectImage(image);
  if (inspected?.Id !== image) throw new Error('Daemon image inspection mismatch');
  if (execution.passed !== true || execution.status !== 'passed' || execution.finalContainerInspection?.State?.ExitCode !== 0 || execution.finalContainerInspection?.State?.OOMKilled !== false) throw new Error('Execution did not pass');
  const output = realpathSync(execution.output);
  assertContainerPolicy(execution.initialContainerInspection, output);
  assertContainerPolicy(execution.finalContainerInspection, output);
  const verificationBytes = read(join(output, 'verification.json'));
  const verification = decode(verificationBytes, 'verification');
  if (verification.version !== 'hermetic-verification-v2' || verification.passed !== true || !Array.isArray(verification.commands) || verification.commands.length !== 8) throw new Error('Incomplete verification commands');
  if (verification.commands.some((command) => !record(command) || command.exitCode !== 0 || command.signal !== null || command.error !== null)) throw new Error('Verification command failed');
  const required = verificationCommands(SOURCE_ROOT);
  if (required.some((expected, index) => {
    const command = verification.commands[index];
    return command.executable !== expected.executable || command.cwd !== expected.cwd || !equal(command.args, expected.args);
  })) throw new Error('Required verification command missing');
  if (!Array.isArray(verification.artifacts) || verification.artifacts.length < REQUIRED.length || verification.artifacts.length > evidenceLimits.entries) throw new Error('Incomplete artifact inventory');
  const artifacts = new Map();
  for (const entry of verification.artifacts) {
    if (!record(entry)) throw new Error('Invalid artifact inventory entry');
    const path = safeRelative(entry.path), absolute = join(output, path);
    if (entry.type !== 'file' || artifacts.has(path) || !digest(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > evidenceLimits.fileBytes) throw new Error(`Invalid artifact inventory: ${path}`);
    if (realpathSync(dirname(absolute)) !== dirname(absolute)) throw new Error(`Artifact path is not a contained file: ${path}`);
    const bytes = read(absolute);
    if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) throw new Error(`Artifact checksum mismatch: ${path}`);
    artifacts.set(path, bytes);
  }
  for (const path of REQUIRED) if (!artifacts.has(path)) throw new Error(`Missing required artifact: ${path}`);
  for (const command of verification.commands) {
    for (const stream of logRecords(command, command.executable)) {
      if (!stream.path.startsWith(`${outputTarget}/logs/`)) throw new Error('Command log has an unapproved path');
      const path = safeRelative(stream.path.slice(outputTarget.length + 1));
      const bytes = artifacts.get(path);
      if (!bytes || stream.sha256 !== hash(bytes) || stream.bytes !== bytes.length) throw new Error(`Command log is not bound to artifacts: ${path}`);
    }
    if (!command.executable.endsWith('/vitest')) continue;
    if (!record(command.tests)) throw new Error(`Vitest command has no bound report: ${command.executable}`);
    const outputFile = command.args.at(-1);
    if (command.tests.path !== outputFile) throw new Error('Vitest report is not the command output');
    const path = outputFile.slice(outputTarget.length + 1), bytes = artifacts.get(path);
    const report = bytes ? decode(bytes, `Vitest ${path}`) : null;
    const counted = report ? recountVitest(report) : null;
    if (!bytes || !counted || !Object.hasOwn(VITEST_FLOORS, path) || command.tests.sha256 !== hash(bytes) || counted.failed !== 0 || counted.pending !== 0 || counted.todo !== 0 || counted.total < VITEST_FLOORS[path] ||
        report.success !== true || report.numTotalTests !== counted.total || report.numPassedTests !== counted.passed || report.numFailedTests !== counted.failed || report.numPendingTests !== counted.pending || report.numTodoTests !== counted.todo || report.numFailedTestSuites !== 0 || report.numPendingTestSuites !== 0 ||
        !Number.isSafeInteger(report.numTotalTestSuites) || report.numTotalTestSuites < report.testResults.length || report.numPassedTestSuites !== report.numTotalTestSuites ||
        command.tests.success !== true || command.tests.total !== counted.total || command.tests.passed !== counted.passed || command.tests.failed !== counted.failed ||
        (command.tests.pending !== undefined && command.tests.pending !== counted.pending) || (command.tests.todo !== undefined && command.tests.todo !== counted.todo)) throw new Error(`Vitest report counts do not match: ${path}`);
  }
  const hostLogs = [];
  for (const [label, value] of [['build', build.buildLog], ['execution', execution.executionLog]]) for (const stream of logRecords(value, label)) {
    const bytes = read(stream.path);
    if (bytes.length !== stream.bytes || hash(bytes) !== stream.sha256) throw new Error(`${label} host log checksum mismatch`);
    hostLogs.push({ label, path: stream.path, sha256: stream.sha256, bytes: stream.bytes });
  }
  const archive = await assertImageArchive(exported.archive, image);
  if (archive.sha256 !== exported.archiveSha256 || archive.bytes !== exported.archiveBytes) throw new Error('Exported image archive checksum mismatch');
  const assurance = verification.assurance;
  if (!record(assurance)) throw new Error('Invalid runtime assurance');
  const measuredImage = await measureImage(image);
  const measurements = [measuredImage, execution.measurements, build.measurements, exported.measurements];
  if (measurements.some((entry) => entry?.source?.sourceSha256 !== assurance.sourceSha256 || entry?.dependencies?.installedSha256 !== assurance.installedSha256 || entry?.dependencies?.frozenStoreSha256 !== assurance.frozenStoreSha256 || entry?.dependencies?.toolTreeSha256 !== assurance.toolsSha256)) throw new Error('Runtime assurance does not match image measurements');
  const originalBytes = read(join(root, '_spec/evidence/ml-adjutant-phase1/baseline-report.json'));
  const originalVerification = read(join(root, '_spec/evidence/ml-adjutant-phase1/verification.json'));
  if (hash(originalBytes) !== ORIGINAL_BASELINE_SHA256 || hash(originalVerification) !== ORIGINAL_VERIFICATION_SHA256) throw new Error('Original Phase1 evidence changed');
  const snapshot = await capture(root);
  let publication;
  let primaryError;
  try {
    if (typeof snapshot.sourceRoot !== 'string' || snapshot.runtime?.sha256 !== assurance.sourceSha256 || build.capture?.runtime?.sha256 !== assurance.sourceSha256 || snapshot.control?.sha256 !== build.capture?.control?.sha256 ||
        (measuredImage.capture && measuredImage.capture.controlSha256 !== snapshot.control.sha256)) throw new Error('Captured source is not the inspected image source');
    const scratch = mkdtempSync('/tmp/opencode/challenge-validate-');
    try {
      const inputs = [['baseline.json', artifacts.get('baseline-report.json')], ['original.json', originalBytes], ['original-verification.json', originalVerification], ['migration.json', artifacts.get('pin-migration.json')], ['coverage.json', artifacts.get('coverage.json')], ['contract.json', artifacts.get('contract-report.json')]];
      for (const [name, bytes] of inputs) writeFileSync(join(scratch, name), bytes, { flag: 'wx', mode: 0o600 });
      const result = execFileSync(TSX, [VALIDATOR, ...inputs.map(([name]) => join(scratch, name)), snapshot.sourceRoot], { encoding: 'utf8', cwd: SOURCE_ROOT, timeout: 300000, maxBuffer: evidenceLimits.fileBytes });
      if (result.trim() !== 'ok') throw new Error('Authoritative evidence validation failed');
    } finally { rmSync(scratch, { recursive: true, force: true }); }
    const target = destination ?? join(root, '_spec/evidence/ml-adjutant-phase2');
    const assuranceRecord = { version: 'phase2-image-assurance-v1', image, inspectedImageId: inspected.Id, archive, hostLogs,
      references: { execution: { path: resolve(executionPath), sha256: hash(executionBytes) }, build: { path: resolve(buildPath), sha256: hash(buildBytes) }, export: { path: resolve(exportPath), sha256: hash(exportBytes) } },
      capture: { runtimeSha256: snapshot.runtime.sha256, controlSha256: snapshot.control.sha256 }, verifiedArtifactCount: artifacts.size + 2 };
    const published = [...artifacts].map(([path, bytes]) => ({ path, bytes }));
    published.push({ path: 'verification.json', bytes: verificationBytes }, { path: 'image-assurance.json', bytes: Buffer.from(`${JSON.stringify(assuranceRecord, null, 2)}\n`) });
    await beforePublication?.(target);
    publication = publishBundleExclusive(target, published, { syncDirectory });
    return { ...publication, image, artifacts: published.length };
  } catch (error) { primaryError = error; throw error; }
  finally {
    try { snapshot.cleanup?.(); }
    catch (cleanupCause) {
      if (primaryError) primaryError.cleanupCause = cleanupCause;
      else if (publication) {
        const error = new PublicationError(publication.target, publication.state, 'snapshot-cleanup', cleanupCause);
        error.durability = publication.durability;
        throw error;
      } else throw cleanupCause;
    }
  }
}

async function main() {
  const options = {};
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    if (!['--execution', '--build', '--export', '--image', '--destination'].includes(key) || !process.argv[index + 1] || Object.hasOwn(options, key)) throw new Error('Expected --execution, --build, --export, --image, and optional --destination');
    options[key] = process.argv[index + 1];
  }
  if (['--execution', '--build', '--export', '--image'].some((key) => !options[key])) throw new Error('Execution, build, export, and expected image are required');
  console.log(JSON.stringify(await importEvidence({ repositoryRoot: SOURCE_ROOT, executionPath: resolve(options['--execution']), buildPath: resolve(options['--build']), exportPath: resolve(options['--export']), expectedImage: options['--image'], ...(options['--destination'] ? { destination: resolve(options['--destination']) } : {}) })));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 1; });
