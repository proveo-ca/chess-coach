// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, createReadStream, existsSync, fsyncSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareContext } from '../packages/starchess-arena/hermetic/context.mjs';
import { assertContainerPolicy } from '../packages/starchess-arena/hermetic/policy.mjs';

export const ORIGINAL_BASELINE_SHA256 = '940387370040f88888e9dfe0bb86ad9d4a8be88854df507120f34b22ee2d362b';
export const ORIGINAL_VERIFICATION_SHA256 = '55d965afa71d775ff6ee1e95b6650a27d0ce759b966a81c43a3bb364236c7508';
const REQUIRED = ['baseline-report.json', 'contract-report.json', 'coverage.json', 'pin-migration.json', 'vitest-starchess-core.json', 'vitest-starchess-arena.json'];

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const decode = (path) => JSON.parse(readFileSync(path, 'utf8'));
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
const streamHash = async (path) => {
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

export async function importEvidence({
  repositoryRoot, executionPath, buildPath, exportPath, expectedImage, destination,
  inspectImage = (image) => JSON.parse(execFileSync('docker', ['image', 'inspect', image], { encoding: 'utf8' }))[0],
  captureContext = async (root) => {
    const context = mkdtempSync(join('/tmp/opencode', 'challenge-capture-'));
    try { return prepareContext(context, false, root); }
    finally { rmSync(context, { recursive: true, force: true }); }
  },
} = {}) {
  mkdirSync('/tmp/opencode', { recursive: true });
  const root = resolve(repositoryRoot);
  const execution = decode(executionPath);
  const build = decode(buildPath);
  const exported = decode(exportPath);
  const image = imageId(expectedImage);
  if ([execution.image, build.image, exported.image, execution.imageInspection?.Id, build.imageInspection?.Id, exported.imageInspection?.Id,
    execution.initialContainerInspection?.Image, execution.finalContainerInspection?.Image].some((value) => value !== image)) throw new Error('Image identity mismatch');
  const inspected = await inspectImage(image);
  if (inspected?.Id !== image) throw new Error('Daemon image inspection mismatch');
  if (!execution.passed || execution.status !== 'passed' || execution.finalContainerInspection?.State?.ExitCode !== 0 || execution.finalContainerInspection?.State?.OOMKilled) throw new Error('Execution did not pass');
  assertContainerPolicy(execution.initialContainerInspection, realpathSync(execution.output));
  assertContainerPolicy(execution.finalContainerInspection, realpathSync(execution.output));
  const output = realpathSync(execution.output);
  const verification = decode(join(output, 'verification.json'));
  if (verification.version !== 'hermetic-verification-v1' || verification.passed !== true || !Array.isArray(verification.commands) || verification.commands.length < 7) throw new Error('Incomplete verification commands');
  if (verification.commands.some((command) => command.exitCode !== 0 || command.signal || command.error)) throw new Error('Verification command failed');
  const requiredCommands = [
    (command) => command.args?.includes('--suite') && command.args?.includes('all') && command.args?.includes('--rerun'),
    (command) => command.args?.some((arg) => String(arg).endsWith('challenge-contract-evidence.ts')),
    (command) => command.args?.includes('--noEmit') && command.cwd?.endsWith('starchess-core'),
    (command) => command.args?.includes('--noEmit') && command.cwd?.endsWith('starchess-arena') && !command.args.includes('--strict'),
    (command) => command.args?.includes('--strict') && command.args?.includes('--skipLibCheck'),
    (command) => command.tests?.path?.endsWith('vitest-starchess-core.json') && command.tests.success === true && command.tests.failed === 0 && command.tests.passed === command.tests.total && command.tests.total > 0,
    (command) => command.tests?.path?.endsWith('vitest-starchess-arena.json') && command.tests.success === true && command.tests.failed === 0 && command.tests.passed === command.tests.total && command.tests.total > 0,
  ];
  if (requiredCommands.some((match) => !verification.commands.some(match))) throw new Error('Required verification command missing');
  if (!Array.isArray(verification.artifacts) || verification.artifacts.length < REQUIRED.length) throw new Error('Incomplete artifact inventory');
  const artifacts = new Map();
  for (const entry of verification.artifacts) {
    const path = safeRelative(entry.path);
    if (entry.type !== 'file' || artifacts.has(path) || typeof entry.sha256 !== 'string' || !Number.isSafeInteger(entry.bytes)) throw new Error(`Invalid artifact inventory: ${entry.path}`);
    const absolute = join(output, path);
    if (realpathSync(dirname(absolute)) !== dirname(absolute) || !lstatSync(absolute).isFile()) throw new Error(`Artifact path is not a contained file: ${path}`);
    const bytes = readFileSync(absolute);
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
  }
  const hostLogs = [];
  for (const [label, record] of [['build', build.buildLog], ['execution', execution.executionLog]]) {
    for (const stream of logRecord(record, label)) {
      const bytes = readFileSync(stream.path);
      if (bytes.length !== stream.bytes || hash(bytes) !== stream.sha256) throw new Error(`${label} host log checksum mismatch`);
      hostLogs.push({ label, path: stream.path, sha256: stream.sha256, bytes: stream.bytes });
    }
  }
  const archive = await streamHash(exported.archive);
  if (archive.sha256 !== exported.archiveSha256 || archive.bytes !== exported.archiveBytes) throw new Error('Exported image archive checksum mismatch');
  const assurance = verification.assurance;
  const measured = [execution.measurements, build.measurements, exported.measurements];
  if (measured.some((entry) => entry?.source?.sourceSha256 !== assurance.sourceSha256 || entry?.dependencies?.installedSha256 !== assurance.installedSha256 ||
    entry?.dependencies?.frozenStoreSha256 !== assurance.frozenStoreSha256 || entry?.dependencies?.toolTreeSha256 !== assurance.toolsSha256)) throw new Error('Runtime assurance does not match image measurements');
  if (hash(readFileSync(join(root, '_spec/evidence/ml-adjutant-phase1/baseline-report.json'))) !== ORIGINAL_BASELINE_SHA256 ||
    hash(readFileSync(join(root, '_spec/evidence/ml-adjutant-phase1/verification.json'))) !== ORIGINAL_VERIFICATION_SHA256) throw new Error('Original Phase1 evidence changed');
  const baseline = decode(join(output, 'baseline-report.json'));
  const migration = decode(join(output, 'pin-migration.json'));
  const contract = decode(join(output, 'contract-report.json'));
  const coverage = decode(join(output, 'coverage.json'));
  if (baseline.version !== 'phase2-baseline-report-v1' || baseline.kind !== 'phase2-current-baseline' || baseline.pins?.version !== 'challenge-execution-pins-v2' ||
    baseline.rows?.length !== 54 || baseline.deterministicRerun?.comparisons?.length !== 54 || baseline.executionIntegrity !== true || baseline.learnedGateEligible !== false) throw new Error('Current baseline provenance mismatch');
  if (!migration.passed || migration.comparisons?.length !== 54 || migration.comparisons.some((entry) => !entry.equal) ||
    migration.originalBaselineSha256 !== ORIGINAL_BASELINE_SHA256 || migration.originalVerificationSha256 !== ORIGINAL_VERIFICATION_SHA256 ||
    migration.currentBaselineSha256 !== hash(artifacts.get('baseline-report.json'))) throw new Error('Migration verification failed');
  if (canonical(contract.pins) !== canonical(baseline.pins) || contract.coverageSha256 !== hash(canonical(coverage)) || contract.baselineReportSha256 !== migration.currentBaselineSha256 || contract.learnedGateEligible !== false) throw new Error('Contract report is not bound to current execution');
  const capture = await captureContext(root);
  if (capture.runtime?.sha256 !== build.capture?.runtime?.sha256 || capture.control?.sha256 !== build.capture?.control?.sha256) throw new Error('Captured source or hermetic control drifted');
  const target = destination ?? join(root, '_spec/evidence/ml-adjutant-phase2');
  if (existsSync(target)) throw new Error('Phase2 evidence destination already exists');
  const published = [...artifacts].map(([path, bytes]) => ({ path, bytes }));
  const assuranceRecord = { version: 'phase2-image-assurance-v1', image, inspectedImageId: inspected.Id, archive, hostLogs,
    references: { execution: { path: resolve(executionPath), sha256: hash(readFileSync(executionPath)) }, build: { path: resolve(buildPath), sha256: hash(readFileSync(buildPath)) }, export: { path: resolve(exportPath), sha256: hash(readFileSync(exportPath)) } },
    capture: { runtimeSha256: capture.runtime.sha256, controlSha256: capture.control.sha256 }, verifiedArtifactCount: published.length + 2 };
  published.push({ path: 'verification.json', bytes: readFileSync(join(output, 'verification.json')) });
  published.push({ path: 'image-assurance.json', bytes: Buffer.from(`${JSON.stringify(assuranceRecord, null, 2)}\n`) });
  const staging = mkdtempSync(join(dirname(target), '.phase2-import-'));
  try {
    for (const artifact of published) {
      const path = safeRelative(artifact.path);
      const dest = join(staging, path);
      mkdirSync(dirname(dest), { recursive: true });
      const temporary = join(dirname(dest), `.${basename(path)}.tmp`);
      const fd = openSync(temporary, 'wx', 0o644);
      try { writeFileSync(fd, artifact.bytes); fsyncSync(fd); }
      finally { closeSync(fd); }
      try { linkSync(temporary, dest); }
      finally { rmSync(temporary); }
    }
    const directory = openSync(staging, 'r');
    try { fsyncSync(directory); } finally { closeSync(directory); }
    renameSync(staging, target);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  const publishedDirectory = openSync(target, 'r');
  try { fsyncSync(publishedDirectory); } finally { closeSync(publishedDirectory); }
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
