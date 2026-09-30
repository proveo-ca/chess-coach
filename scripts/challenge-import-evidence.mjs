// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase2.puml
import { createHash } from 'node:crypto';
import { closeSync, createReadStream, existsSync, fsyncSync, linkSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  if (!['--execution', '--build', '--export'].includes(key) || !process.argv[index + 1] || options[key]) throw new Error('Usage: node scripts/challenge-import-evidence.mjs --execution execution.json --build build.json --export export.json');
  options[key] = resolve(process.argv[index + 1]);
}
if (Object.keys(options).length !== 3) throw new Error('Execution, build, and image export evidence are required');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const decode = (path) => JSON.parse(readFileSync(path, 'utf8'));
const execution = decode(options['--execution']);
const build = decode(options['--build']);
const exported = decode(options['--export']);
if (!execution.passed || execution.status !== 'passed' || execution.finalContainerInspection?.State.ExitCode !== 0 || execution.finalContainerInspection?.State.OOMKilled ||
  build.image !== execution.image || exported.image !== execution.image || !/^sha256:[a-f0-9]{64}$/.test(execution.image)) throw new Error('Hermetic image or execution evidence mismatch');
const archiveHash = createHash('sha256');
for await (const bytes of createReadStream(exported.archive)) archiveHash.update(bytes);
if (archiveHash.digest('hex') !== exported.archiveSha256) throw new Error('Exported image archive checksum mismatch');
const output = realpathSync(execution.output);
const verification = decode(join(output, 'verification.json'));
if (verification.passed !== true || verification.commands.some((command) => command.exitCode !== 0 || command.signal || command.error)) throw new Error('Hermetic verification did not pass');
const original = join(root, '_spec/evidence/ml-adjutant-phase1/baseline-report.json');
if (hash(readFileSync(original)) !== '940387370040f88888e9dfe0bb86ad9d4a8be88854df507120f34b22ee2d362b') throw new Error('Original Phase1 evidence changed');
const baseline = decode(join(output, 'baseline-report.json'));
const migration = decode(join(output, 'pin-migration.json'));
if (!migration.passed || migration.currentBaselineSha256 !== hash(readFileSync(join(output, 'baseline-report.json')))) throw new Error('Migration verification failed');
if (migration.originalVerificationSha256 !== hash(readFileSync(join(root, '_spec/evidence/ml-adjutant-phase1/verification.json')))) throw new Error('Original Phase1 verification changed');
for (const entry of [...baseline.pins.sourceInventory.files, ...baseline.pins.sourceInventory.runtime]) {
  const path = resolve(root, entry.path);
  if (!path.startsWith(`${root}/`) && !path.startsWith(root.endsWith('/') ? root : `${root}/`)) throw new Error('Inventory path escapes repository');
  if (entry.present === false) {
    if (existsSync(path)) throw new Error(`Runtime file appeared: ${entry.path}`);
  } else if (hash(readFileSync(path)) !== entry.sha256) throw new Error(`Captured source drift: ${entry.path}`);
}
const artifacts = verification.artifacts.map((entry) => {
  if (!/^[a-zA-Z0-9_.-]+$/.test(entry.path)) throw new Error('Unsafe artifact name');
  const bytes = readFileSync(join(output, entry.path));
  if (hash(bytes) !== entry.sha256) throw new Error(`Artifact checksum mismatch: ${entry.path}`);
  return { path: entry.path, bytes };
});
artifacts.push({ path: 'verification.json', bytes: readFileSync(join(output, 'verification.json')) });
const assurance = { version: 'phase2-image-assurance-v1', execution, build, export: exported,
  references: Object.fromEntries(Object.entries(options).map(([flag, path]) => [flag.slice(2), { path, sha256: hash(readFileSync(path)) }])),
  imageArchive: { path: exported.archive, sha256: exported.archiveSha256, bytes: exported.archiveBytes },
  verifiedArtifactCount: artifacts.length,
};
artifacts.push({ path: 'image-assurance.json', bytes: Buffer.from(`${JSON.stringify(assurance, null, 2)}\n`) });
const target = join(root, '_spec/evidence/ml-adjutant-phase2');
if (existsSync(target)) throw new Error('Phase2 evidence destination already exists');
mkdirSync(target);
for (const artifact of artifacts) {
  const temporary = join(target, `.${artifact.path}.tmp`);
  const fd = openSync(temporary, 'wx', 0o644);
  try { writeFileSync(fd, artifact.bytes); fsyncSync(fd); }
  finally { closeSync(fd); }
  try { linkSync(temporary, join(target, artifact.path)); }
  finally { unlinkSync(temporary); }
}
const fd = openSync(target, 'r');
try { fsyncSync(fd); } finally { closeSync(fd); }
console.log(JSON.stringify({ target, image: execution.image, artifacts: artifacts.length }));
