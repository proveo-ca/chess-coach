// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, createReadStream, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readSync, readdirSync, realpathSync, rmSync, writeSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareContext } from '../packages/starchess-arena/hermetic/context.mjs';
import { assertContainerPolicy } from '../packages/starchess-arena/hermetic/policy.mjs';

export const ORIGINAL_BASELINE_SHA256 = '940387370040f88888e9dfe0bb86ad9d4a8be88854df507120f34b22ee2d362b';
export const ORIGINAL_VERIFICATION_SHA256 = '55d965afa71d775ff6ee1e95b6650a27d0ce759b966a81c43a3bb364236c7508';
export const MAX_IMPORT_BYTES = 16_777_216;
const REQUIRED = ['baseline-report.json', 'contract-report.json', 'coverage.json', 'pin-migration.json', 'vitest-starchess-core.json', 'vitest-starchess-arena.json'];
const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const TSX = join(SCRIPT_DIR, '../packages/starchess-arena/node_modules/.bin/tsx');
const VALIDATOR = join(SCRIPT_DIR, 'challenge-validate-baseline.ts');

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonical = (value) => {
  const sorted = (item) => Array.isArray(item) ? item.map(sorted)
    : item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).filter(([, child]) => child !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, sorted(child)]))
    : item;
  return JSON.stringify(sorted(value));
};
export const safeRelative = (path) => {
  if (typeof path !== 'string' || path.startsWith('/') || /[\\\0]/.test(path)) throw new Error(`Unsafe artifact path: ${path}`);
  const parts = path.split('/');
  if (!parts.length || parts.some((part) => !/^[A-Za-z0-9._-]+$/.test(part) || part === '.' || part === '..')) throw new Error(`Unsafe artifact path: ${path}`);
  return parts.join('/');
};
const readBounded = (path, retain) => {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > MAX_IMPORT_BYTES) throw new Error(`Input exceeds byte cap: ${path}`);
  const bytes = Buffer.alloc(stat.size);
  const fd = openSync(path, 'r');
  try {
    let offset = 0;
    while (offset < stat.size) {
      const count = readSync(fd, bytes, offset, stat.size - offset, offset);
      if (count === 0) throw new Error(`Short read: ${path}`);
      offset += count;
    }
  } finally { closeSync(fd); }
  retain(bytes.length);
  return bytes;
};
const decodeBounded = (path, retain) => JSON.parse(readBounded(path, retain).toString('utf8'));
const streamHash = async (path) => {
  const stat = lstatSync(path);
  if (!stat.isFile()) throw new Error(`Archive is not a file: ${path}`);
  const digest = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(path)) { digest.update(chunk); bytes += chunk.length; }
  return { sha256: digest.digest('hex'), bytes };
};
const imageId = (value) => {
  if (!/^sha256:[a-f0-9]{64}$/.test(value ?? '')) throw new Error('Immutable image ID required');
  return value;
};
const logRecord = (record, label) => {
  if (!record?.logs?.stdout?.sha256 || !record?.logs?.stderr?.sha256) throw new Error(`Missing ${label} logs`);
  return [record.logs.stdout, record.logs.stderr];
};
const same = (left, right) => Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => item === right[index]);
const bin = (executable, pkg, name) => executable === `/app/packages/${pkg}/node_modules/.bin/${name}`;
const fsyncDirectory = (path) => {
  const fd = openSync(path, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
};
export const assertImageArchive = (path, image) => {
  const fd = openSync(path, 'r');
  const entries = new Map();
  const names = new Set();
  let retained = 0;
  try {
    const header = Buffer.alloc(512);
    let position = 0;
    for (;;) {
      const count = readSync(fd, header, 0, 512, position);
      if (count === 0) break;
      if (count !== 512) throw new Error('Exported image archive is not a Docker image tar');
      if (header.every((byte) => byte === 0)) break;
      if (header.subarray(257, 262).toString('utf8') !== 'ustar') throw new Error('Exported image archive is not a Docker image tar');
      const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
      const size = Number.parseInt(header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim() || '0', 8);
      if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Invalid image archive entry: ${name}`);
      position += 512;
      names.add(name);
      if (name === 'manifest.json' || name.endsWith('.json')) {
        if (size > MAX_IMPORT_BYTES) throw new Error(`Image archive entry exceeds byte cap: ${name}`);
        const data = Buffer.alloc(size);
        let offset = 0;
        while (offset < size) {
          const read = readSync(fd, data, offset, size - offset, position + offset);
          if (read === 0) throw new Error('Truncated image archive');
          offset += read;
        }
        retained += size;
        if (retained > MAX_IMPORT_BYTES) throw new Error('Image archive metadata exceeds byte cap');
        entries.set(name, data);
      }
      position += Math.ceil(size / 512) * 512;
    }
  } finally { closeSync(fd); }
  const manifestBytes = entries.get('manifest.json');
  if (!manifestBytes) throw new Error('Exported image archive has no manifest');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (!Array.isArray(manifest) || manifest.length !== 1 || typeof manifest[0]?.Config !== 'string' || !Array.isArray(manifest[0].Layers) || manifest[0].Layers.length < 1) {
    throw new Error('Exported image archive manifest mismatch');
  }
  const config = entries.get(manifest[0].Config);
  if (!config || manifest[0].Layers.some((layer) => !names.has(layer))) throw new Error('Exported image archive config missing');
  if (`sha256:${hash(config)}` !== image) throw new Error('Exported image archive is not the expected image');
};

export async function importEvidence({
  repositoryRoot, executionPath, buildPath, exportPath, expectedImage, destination,
  inspectImage = (image) => JSON.parse(execFileSync('docker', ['image', 'inspect', image], { encoding: 'utf8' }))[0],
  captureContext = async (root) => {
    const context = mkdtempSync(join('/tmp/opencode', 'challenge-capture-'));
    try { return prepareContext(context, false, root); }
    finally { rmSync(context, { recursive: true, force: true }); }
  },
  syncDirectory = fsyncDirectory,
} = {}) {
  mkdirSync('/tmp/opencode', { recursive: true });
  let retained = 0;
  const retain = (bytes) => {
    retained += bytes;
    if (retained > MAX_IMPORT_BYTES) throw new Error('Aggregate import byte cap exceeded');
  };
  const root = resolve(repositoryRoot);
  const execution = decodeBounded(executionPath, retain);
  const build = decodeBounded(buildPath, retain);
  const exported = decodeBounded(exportPath, retain);
  const image = imageId(expectedImage);
  if ([execution.image, build.image, exported.image, execution.imageInspection?.Id, build.imageInspection?.Id, exported.imageInspection?.Id,
    execution.initialContainerInspection?.Image, execution.finalContainerInspection?.Image].some((value) => value !== image)) throw new Error('Image identity mismatch');
  const inspected = await inspectImage(image);
  if (inspected?.Id !== image) throw new Error('Daemon image inspection mismatch');
  if (!execution.passed || execution.status !== 'passed' || execution.finalContainerInspection?.State?.ExitCode !== 0 || execution.finalContainerInspection?.State?.OOMKilled) throw new Error('Execution did not pass');
  assertContainerPolicy(execution.initialContainerInspection, realpathSync(execution.output));
  assertContainerPolicy(execution.finalContainerInspection, realpathSync(execution.output));
  const output = realpathSync(execution.output);
  const verificationBytes = readBounded(join(output, 'verification.json'), retain);
  const verification = JSON.parse(verificationBytes.toString('utf8'));
  if (verification.version !== 'hermetic-verification-v1' || verification.passed !== true || !Array.isArray(verification.commands) || verification.commands.length !== 7) throw new Error('Incomplete verification commands');
  if (verification.commands.some((command) => command.exitCode !== 0 || command.signal || command.error)) throw new Error('Verification command failed');
  const sourceRoot = join(SCRIPT_DIR, '..');
  const challengeTests = readdirSync(join(sourceRoot, 'packages/starchess-arena/src/__tests__'))
    .filter((name) => /^challenge.*\.ts$/.test(name) || ['observationIsolation.test.ts', 'resourceLedger.test.ts', 'strictRecordedQueues.test.ts'].includes(name))
    .sort()
    .map((name) => `/app/packages/starchess-arena/src/__tests__/${name}`);
  const required = [
    { executable: '/app/packages/starchess-arena/node_modules/.bin/tsx', cwd: '/app', args: ['/app/packages/starchess-arena/src/cli/challenge.ts', '--suite', 'all', '--rerun', '--out', '/app/_spec/evidence/ml-adjutant-phase2/baseline-report.json'] },
    { executable: '/app/packages/starchess-arena/node_modules/.bin/tsx', cwd: '/app', args: ['/app/scripts/challenge-contract-evidence.ts'] },
    { executable: '/app/packages/starchess-core/node_modules/.bin/tsc', cwd: '/app/packages/starchess-core', args: ['-p', 'tsconfig.json', '--noEmit'] },
    { executable: '/app/packages/starchess-arena/node_modules/.bin/tsc', cwd: '/app/packages/starchess-arena', args: ['-p', 'tsconfig.json', '--noEmit'] },
    { executable: '/app/packages/starchess-arena/node_modules/.bin/tsc', cwd: '/app/packages/starchess-arena', args: ['--noEmit', '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--strict', '--skipLibCheck', ...challengeTests, '/app/scripts/challenge-contract-evidence.ts'] },
    { executable: '/app/packages/starchess-core/node_modules/.bin/vitest', cwd: '/app/packages/starchess-core', args: ['run', '--config', '/tmp/starchess-core.vitest.mts', '--configLoader', 'native', '--maxWorkers', '2', '--reporter=default', '--reporter=json', '--outputFile', '/app/_spec/evidence/ml-adjutant-phase2/vitest-starchess-core.json'] },
    { executable: '/app/packages/starchess-arena/node_modules/.bin/vitest', cwd: '/app/packages/starchess-arena', args: ['run', '--config', '/tmp/starchess-arena.vitest.mts', '--configLoader', 'native', '--maxWorkers', '2', '--reporter=default', '--reporter=json', '--outputFile', '/app/_spec/evidence/ml-adjutant-phase2/vitest-starchess-arena.json'] },
  ];
  if (required.some((expected, index) => {
    const command = verification.commands[index];
    return !command || command.executable !== expected.executable || command.cwd !== expected.cwd || !same(command.args, expected.args) ||
      !bin(command.executable, index === 2 || index === 5 ? 'starchess-core' : 'starchess-arena', basename(expected.executable));
  })) throw new Error('Required verification command missing');
  if (!Array.isArray(verification.artifacts) || verification.artifacts.length < REQUIRED.length) throw new Error('Incomplete artifact inventory');
  const artifacts = new Map();
  for (const entry of verification.artifacts) {
    const path = safeRelative(entry.path);
    if (entry.type !== 'file' || artifacts.has(path) || typeof entry.sha256 !== 'string' || !Number.isSafeInteger(entry.bytes)) throw new Error(`Invalid artifact inventory: ${entry.path}`);
    const absolute = join(output, path);
    if (realpathSync(dirname(absolute)) !== dirname(absolute) || !lstatSync(absolute).isFile()) throw new Error(`Artifact path is not a contained file: ${path}`);
    const bytes = readBounded(absolute, retain);
    if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) throw new Error(`Artifact checksum mismatch: ${path}`);
    artifacts.set(path, bytes);
  }
  for (const path of REQUIRED) if (!artifacts.has(path)) throw new Error(`Missing required artifact: ${path}`);
  for (const command of verification.commands) {
    for (const record of logRecord(command, command.executable)) {
      const relative = safeRelative(record.path.slice(record.path.indexOf('/logs/') + 1));
      const listed = verification.artifacts.find((entry) => entry.path === relative);
      if (!listed || listed.sha256 !== record.sha256 || listed.bytes !== record.bytes || !artifacts.has(relative)) throw new Error(`Command log is not bound to artifacts: ${relative}`);
    }
    if (!command.tests) continue;
    const reportPath = basename(command.tests.path ?? '');
    const reportBytes = artifacts.get(reportPath);
    if (!reportBytes || command.tests.sha256 !== hash(reportBytes)) throw new Error(`Vitest report is not bound: ${reportPath}`);
    const report = JSON.parse(reportBytes.toString('utf8'));
    if (report.success !== true || report.numFailedTests !== 0 || report.numPassedTests !== report.numTotalTests || !Number.isSafeInteger(report.numTotalTests) || report.numTotalTests <= 0 ||
        command.tests.success !== true || command.tests.failed !== 0 || command.tests.passed !== report.numPassedTests || command.tests.total !== report.numTotalTests) {
      throw new Error(`Vitest report counts do not match: ${reportPath}`);
    }
  }
  const hostLogs = [];
  for (const [label, record] of [['build', build.buildLog], ['execution', execution.executionLog]]) {
    for (const stream of logRecord(record, label)) {
      const bytes = readBounded(stream.path, retain);
      if (bytes.length !== stream.bytes || hash(bytes) !== stream.sha256) throw new Error(`${label} host log checksum mismatch`);
      hostLogs.push({ label, path: stream.path, sha256: stream.sha256, bytes: stream.bytes });
    }
  }
  const archive = await streamHash(exported.archive);
  if (archive.sha256 !== exported.archiveSha256 || archive.bytes !== exported.archiveBytes) throw new Error('Exported image archive checksum mismatch');
  assertImageArchive(exported.archive, image);
  const assurance = verification.assurance;
  const measured = [execution.measurements, build.measurements, exported.measurements];
  if (measured.some((entry) => entry?.source?.sourceSha256 !== assurance.sourceSha256 || entry?.dependencies?.installedSha256 !== assurance.installedSha256 ||
    entry?.dependencies?.frozenStoreSha256 !== assurance.frozenStoreSha256 || entry?.dependencies?.toolTreeSha256 !== assurance.toolsSha256)) throw new Error('Runtime assurance does not match image measurements');
  const originalBaseline = join(root, '_spec/evidence/ml-adjutant-phase1/baseline-report.json');
  const originalVerification = join(root, '_spec/evidence/ml-adjutant-phase1/verification.json');
  if (hash(readBounded(originalBaseline, retain)) !== ORIGINAL_BASELINE_SHA256 || hash(readBounded(originalVerification, retain)) !== ORIGINAL_VERIFICATION_SHA256) throw new Error('Original Phase1 evidence changed');
  const validated = execFileSync(TSX, [VALIDATOR, join(output, 'baseline-report.json'), originalBaseline, join(output, 'pin-migration.json')], { encoding: 'utf8' });
  if (validated.trim() !== 'ok') throw new Error('Authoritative baseline validation failed');
  const baseline = JSON.parse(artifacts.get('baseline-report.json').toString('utf8'));
  const migration = JSON.parse(artifacts.get('pin-migration.json').toString('utf8'));
  const contract = JSON.parse(artifacts.get('contract-report.json').toString('utf8'));
  const coverage = JSON.parse(artifacts.get('coverage.json').toString('utf8'));
  if (baseline.version !== 'phase2-baseline-report-v1' || baseline.kind !== 'phase2-current-baseline' || baseline.pins?.version !== 'challenge-execution-pins-v2' || baseline.learnedGateEligible !== false) throw new Error('Current baseline provenance mismatch');
  if (migration.originalBaselineSha256 !== ORIGINAL_BASELINE_SHA256 || migration.originalVerificationSha256 !== ORIGINAL_VERIFICATION_SHA256 ||
    migration.currentBaselineSha256 !== hash(artifacts.get('baseline-report.json'))) throw new Error('Migration verification failed');
  if (canonical(contract.pins) !== canonical(baseline.pins) || contract.coverageSha256 !== hash(canonical(coverage)) || contract.baselineReportSha256 !== migration.currentBaselineSha256 || contract.learnedGateEligible !== false) throw new Error('Contract report is not bound to current execution');
  const capture = await captureContext(root);
  if (capture.runtime?.sha256 !== assurance.sourceSha256 || build.capture?.runtime?.sha256 !== assurance.sourceSha256 || capture.control?.sha256 !== build.capture?.control?.sha256) throw new Error('Captured source or hermetic control drifted');
  const target = destination ?? join(root, '_spec/evidence/ml-adjutant-phase2');
  if (existsSync(target)) throw new Error('Phase2 evidence destination already exists');
  const published = [...artifacts].map(([path, bytes]) => ({ path, bytes }));
  const assuranceRecord = { version: 'phase2-image-assurance-v1', image, inspectedImageId: inspected.Id, archive, hostLogs,
    references: { execution: { path: resolve(executionPath), sha256: hash(readBounded(executionPath, retain)) }, build: { path: resolve(buildPath), sha256: hash(readBounded(buildPath, retain)) }, export: { path: resolve(exportPath), sha256: hash(readBounded(exportPath, retain)) } },
    capture: { runtimeSha256: capture.runtime.sha256, controlSha256: capture.control.sha256 }, verifiedArtifactCount: published.length + 2 };
  published.push({ path: 'verification.json', bytes: verificationBytes });
  published.push({ path: 'image-assurance.json', bytes: Buffer.from(`${JSON.stringify(assuranceRecord, null, 2)}\n`) });
  let created = false;
  let committed = false;
  try {
    mkdirSync(target);
    created = true;
    syncDirectory(target);
    for (const artifact of published) {
      const path = safeRelative(artifact.path);
      const dest = join(target, path);
      mkdirSync(dirname(dest), { recursive: true });
      syncDirectory(dirname(dest));
      const fd = openSync(dest, 'wx', 0o644);
      try { writeSync(fd, artifact.bytes); fsyncSync(fd); }
      finally { closeSync(fd); }
    }
    const marker = join(target, '.publication-complete');
    const markerFd = openSync(marker, 'wx', 0o644);
    try { writeSync(markerFd, 'ok\n'); fsyncSync(markerFd); }
    finally { closeSync(markerFd); }
    syncDirectory(target);
    committed = true;
    syncDirectory(dirname(target));
  } catch (error) {
    if (created && !committed) rmSync(target, { recursive: true, force: true });
    if (committed) throw new Error(`Publication committed but parent durability failed: ${target}`);
    throw error;
  }
  return { target, image, artifacts: published.length };
}

async function main() {
  const options = {};
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    if (!['--execution', '--build', '--export', '--image'].includes(key) || !process.argv[index + 1] || options[key]) throw new Error('Usage: node scripts/challenge-import-evidence.mjs --execution execution.json --build build.json --export export.json --image sha256:...');
    options[key] = process.argv[index + 1];
  }
  if (Object.keys(options).length !== 4) throw new Error('Execution, build, export, and expected image are required');
  const result = await importEvidence({ repositoryRoot: fileURLToPath(new URL('../', import.meta.url)), executionPath: resolve(options['--execution']), buildPath: resolve(options['--build']), exportPath: resolve(options['--export']), expectedImage: options['--image'] });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
