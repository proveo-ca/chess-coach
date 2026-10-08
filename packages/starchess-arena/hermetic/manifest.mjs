// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { installedRoots, evidenceNamespace, excludedSource } from './workspace-policy.mjs';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const sourceExclusions = ['node_modules', evidenceNamespace];

export function treeManifest(root, { exclude = () => false } = {}) {
  const entries = [];
  function walk(path) {
    const name = relative(root, path).split('\\').join('/');
    if (exclude(name)) return;
    const stat = lstatSync(path);
    const item = { path: name || '.', mode: (stat.mode & 0o7777).toString(8) };
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(path);
      entries.push({ ...item, type: 'symlink', target, sha256: sha256(target) });
    }
    else if (stat.isFile()) entries.push({ ...item, type: 'file', bytes: stat.size, sha256: sha256(readFileSync(path)) });
    else if (stat.isDirectory()) {
      entries.push({ ...item, type: 'directory' });
      for (const child of readdirSync(path).sort()) walk(join(path, child));
    } else throw new Error(`Unsupported tree entry: ${path}`);
  }
  walk(root);
  return { algorithm: 'sha256(JSON.stringify(entries))', sha256: sha256(JSON.stringify(entries)), entries };
}

export function dependencyManifest() {
  const roots = installedRoots;
  const installed = roots.map((path) => ({ root: path, ...treeManifest(path) }));
  const store = treeManifest('/pnpm/store');
  const tools = treeManifest('/opt/pnpm');
  return { version: 1, installed, installedSha256: sha256(JSON.stringify(installed)), frozenStore: { root: '/pnpm/store', ...store }, tools: { root: '/opt/pnpm', ...tools } };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const source = process.argv[2] === 'source';
  const report = source ? {
    version: 1, root: '/app', exclusions: sourceExclusions,
    inventoryLocation: '/hermetic-evidence/source.json (outside inventoried root)',
    ...treeManifest('/app', { exclude: excludedSource }),
  } : dependencyManifest();
  if (source) {
    const capture = JSON.parse(readFileSync('/hermetic-evidence/capture.json', 'utf8'));
    if (report.sha256 !== capture.runtime.sha256) throw new Error('Image source tree differs from allowlisted capture');
  }
  writeFileSync(`/hermetic-evidence/${source ? 'source' : 'dependencies'}.json`, JSON.stringify(report, null, 2) + '\n');
}
