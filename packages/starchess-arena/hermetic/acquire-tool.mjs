// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pins from './pins.json' with { type: 'json' };

if (process.versions.node !== pins.node) throw new Error('Node pin mismatch');
const response = await fetch(pins.pnpmTarball);
if (!response.ok) throw new Error(`pnpm acquisition: HTTP ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
if (integrity !== pins.pnpmIntegrity) throw new Error('pnpm artifact integrity mismatch');
const artifactSha256 = createHash('sha256').update(bytes).digest('hex');
if (artifactSha256 !== pins.pnpmSha256) throw new Error('pnpm artifact SHA-256 mismatch');
mkdirSync('/opt/pnpm', { recursive: true });
writeFileSync('/opt/pnpm/artifact.tgz', bytes);
execFileSync('tar', ['-xzf', '/opt/pnpm/artifact.tgz', '-C', '/opt/pnpm', '--strip-components=1']);
symlinkSync('/opt/pnpm/bin/pnpm.cjs', '/opt/pnpm/bin/pnpm');
mkdirSync('/hermetic-evidence', { recursive: true });
writeFileSync('/hermetic-evidence/tools.json', JSON.stringify({
  pins, node: process.versions.node,
  pnpm: execFileSync('/opt/pnpm/bin/pnpm', ['--version'], { encoding: 'utf8' }).trim(),
  artifact: { integrity, sha256: artifactSha256, bytes: bytes.length },
}, null, 2) + '\n');
