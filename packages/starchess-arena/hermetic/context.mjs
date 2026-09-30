// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase2.puml
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, treeManifest } from './manifest.mjs';

export const repository = fileURLToPath(new URL('../../../', import.meta.url));
export const optionalConfigs = ['.npmrc', '.pnpmfile.cjs', 'pnpmfile.cjs', 'tsconfig.json', 'tsconfig.base.json', 'vitest.config.ts', 'vite.config.ts', 'nx.json'];
export const excludedNames = ['node_modules', '.git', '.pnpm-store', '.cache', '.vite', '.vite-temp', 'coverage', 'dist', '.DS_Store'];

function copyTree(source, target) {
  const stat = lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`Host symlink excluded from context: ${source}`);
  if (stat.isDirectory()) {
    mkdirSync(target, { recursive: true, mode: 0o755 });
    for (const name of readdirSync(source).sort()) {
      if (excludedNames.includes(name)) continue;
      if (/^(\.env(?:\.|$)|\.npmrc$)|\.(pem|key|p12|pfx)$/i.test(name)) throw new Error(`Secret-bearing path excluded: ${source}/${name}`);
      copyTree(join(source, name), join(target, name));
    }
  } else if (stat.isFile()) {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    chmodSync(target, stat.mode & 0o111 ? 0o755 : 0o644);
  } else throw new Error(`Special host file excluded: ${source}`);
}

export function prepareContext(context, dependenciesOnly = false, root = repository) {
  if (readdirSync(context).length) throw new Error('Docker context must start empty');
  const control = join(root, 'packages/starchess-arena/hermetic');
  copyTree(control, join(context, 'hermetic'));
  copyTree(join(control, 'Dockerfile'), join(context, 'Dockerfile'));
  const dependencyFiles = ['pnpm-lock.yaml', 'packages/starchess-core/package.json', 'packages/starchess-arena/package.json'];
  for (const path of dependencyFiles) copyTree(join(root, path), join(context, 'deps', path));
  const narrowedWorkspace = 'packages:\n  - packages/starchess-core\n  - packages/starchess-arena\nallowBuilds:\n  esbuild: true\n';
  writeFileSync(join(context, 'deps/pnpm-workspace.yaml'), narrowedWorkspace);
  const configs = optionalConfigs.map((path) => ({ path, present: existsSync(join(root, path)) }));
  if (configs.some((entry) => entry.present && ['.npmrc', '.pnpmfile.cjs', 'pnpmfile.cjs'].includes(entry.path))) throw new Error('Package-manager override requires explicit context review');
  const capture = {
    version: 1, dependenciesOnly, excludedNames,
    dependencyFiles: dependencyFiles.map((path) => ({ path, sha256: sha256(readFileSync(join(root, path))) })),
    workspace: { originalSha256: sha256(readFileSync(join(root, 'pnpm-workspace.yaml'))), acquisition: narrowedWorkspace },
    optionalConfigs: configs,
  };
  if (!dependenciesOnly) {
    const required = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'packages/starchess-core', 'packages/starchess-arena',
      'scripts', '_spec/corpora', '_spec/evidence/ml-adjutant-phase1'];
    const corpus = JSON.parse(readFileSync(join(root, '_spec/corpora/ml-adjutant-corpus.manifest.json'), 'utf8'));
    if (!/^[a-zA-Z0-9._-]+\.json$/.test(corpus.sourcePath)) throw new Error('Corpus source must be a root JSON filename');
    required.push(corpus.sourcePath);
    if (!existsSync(join(root, 'scripts/challenge-contract-evidence.ts'))) throw new Error('Phase2 diagnostic script is not integrated');
    for (const path of [...required, ...configs.filter((entry) => entry.present).map((entry) => entry.path)]) {
      copyTree(resolve(root, path), join(context, 'runtime', path));
    }
    capture.runtime = treeManifest(join(context, 'runtime'));
  }
  capture.control = treeManifest(join(context, 'hermetic'));
  writeFileSync(join(context, 'capture.json'), JSON.stringify(capture, null, 2) + '\n');
  return capture;
}
