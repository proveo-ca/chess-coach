import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const target = new URL('packages/starchess-arena/src/__tests__/fixtures/challenge-history-pins.json', root);
const paths = [
  ...['baseline-report.json', 'verification.json'].map((name) => `_spec/evidence/ml-adjutant-phase1/${name}`),
  ...['baseline-report.json', 'coverage.json', 'contract-report.json', 'pin-migration.json'].map((name) => `_spec/evidence/ml-adjutant-phase2/${name}`),
];
const files = Object.fromEntries(paths.map((path) => {
  const bytes = readFileSync(new URL(path, root));
  return [path, { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
}));
const manifest = { version: 'challenge-locked-history-v1', files };
if (existsSync(target)) {
  if (JSON.stringify(JSON.parse(readFileSync(target, 'utf8'))) !== JSON.stringify(manifest)) throw new Error('Locked historical evidence changed');
} else {
  const fd = openSync(target, 'wx', 0o644);
  try { writeFileSync(fd, `${JSON.stringify(manifest, null, 2)}\n`); fsyncSync(fd); }
  finally { closeSync(fd); }
}
console.log(fileURLToPath(target));
