// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { chmodSync, copyFileSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { sha256, treeManifest } from './manifest.mjs';
import { dependencyInputs, workspacePackages } from './workspace-policy.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');

export const repository = fileURLToPath(new URL('../../../', import.meta.url));
export const optionalConfigs = ['.npmrc', '.pnpmfile.cjs', 'pnpmfile.cjs', 'tsconfig.json', 'tsconfig.base.json', 'vitest.config.ts', 'vite.config.ts', 'nx.json'];
export const excludedNames = ['node_modules', '.git', '.pnpm-store', '.cache', '.vite', '.vite-temp', 'coverage', 'dist', '.DS_Store'];

function sourcePath(root, path, optional = false) {
  const absolute = resolve(root, path);
  const name = relative(root, absolute);
  if (name === '..' || name.startsWith(`..${sep}`)) throw new Error(`Source path escapes repository: ${path}`);
  let current = sep;
  for (const part of absolute.split(sep).filter(Boolean)) {
    current = join(current, part);
    let stat;
    try { stat = lstatSync(current); }
    catch (error) {
      if (optional && error.code === 'ENOENT') return null;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Host symlink excluded from context: ${current}`);
  }
  if (realpathSync(absolute) !== absolute) throw new Error(`Non-canonical source path: ${path}`);
  return absolute;
}

function sourceBytes(root, path) {
  return readFileSync(sourcePath(root, path));
}

function copyTree(root, path, target) {
  const source = sourcePath(root, path);
  const stat = lstatSync(source);
  if (stat.isDirectory()) {
    mkdirSync(target, { recursive: true, mode: 0o755 });
    for (const name of readdirSync(sourcePath(root, path)).sort()) {
      if (excludedNames.includes(name)) continue;
      if (/^(\.env(?:\.|$)|\.npmrc$)|\.(pem|key|p12|pfx)$/i.test(name)) throw new Error(`Secret-bearing path excluded: ${source}/${name}`);
      copyTree(root, join(path, name), join(target, name));
    }
  } else if (stat.isFile()) {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(sourcePath(root, path), target);
    chmodSync(target, stat.mode & 0o111 ? 0o755 : 0o644);
  } else throw new Error(`Special host file excluded: ${source}`);
}

function configClosure(root, seeds) {
  const visited = new Set();
  const active = new Set();
  function visit(path) {
    if (active.has(path)) throw new Error(`Cyclic tsconfig extends: ${path}`);
    if (visited.has(path)) return;
    const absolute = sourcePath(root, path);
    if (!lstatSync(absolute).isFile()) throw new Error(`Non-file tsconfig: ${path}`);
    active.add(path);
    const parsed = ts.parseConfigFileTextToJson(path, sourceBytes(root, path).toString('utf8'));
    const config = parsed.config;
    if (parsed.error || !config || typeof config !== 'object' || Array.isArray(config)) throw new Error(`Invalid tsconfig: ${path}`);
    const parents = config.extends === undefined ? [] : Array.isArray(config.extends) ? config.extends : [config.extends];
    for (const parent of parents) {
      if (typeof parent !== 'string' || !parent.startsWith('.') || parent.includes('\\')) throw new Error(`Unsafe tsconfig extends: ${path}`);
      const target = relative(root, resolve(dirname(absolute), parent));
      const candidates = extname(target) ? [target] : [target, `${target}.json`];
      const found = candidates.filter((candidate) => {
        const checked = sourcePath(root, candidate, true);
        return checked !== null && lstatSync(checked).isFile();
      });
      if (found.length !== 1) throw new Error(`Missing or ambiguous tsconfig extends: ${path}`);
      if (found[0].split(sep).some((part) => excludedNames.includes(part) || /^(\.env(?:\.|$)|\.npmrc$)|\.(pem|key|p12|pfx)$/i.test(part))) throw new Error(`Excluded tsconfig extends: ${path}`);
      visit(found[0]);
    }
    active.delete(path);
    visited.add(path);
  }
  for (const path of seeds) visit(path);
  return [...visited].sort();
}

export function prepareContext(context, dependenciesOnly = false, root = repository) {
  root = resolve(root);
  sourcePath(root, '.');
  if (readdirSync(context).length) throw new Error('Docker context must start empty');
  const control = 'packages/starchess-arena/hermetic';
  copyTree(root, control, join(context, 'hermetic'));
  copyTree(root, join(control, 'Dockerfile'), join(context, 'Dockerfile'));
  const dependencyFiles = dependencyInputs;
  for (const path of dependencyFiles) copyTree(root, path, join(context, 'deps', path));
  const narrowedWorkspace = `packages:\n${workspacePackages.map((name) => `  - packages/${name}\n`).join('')}allowBuilds:\n  esbuild: true\n`;
  writeFileSync(join(context, 'deps/pnpm-workspace.yaml'), narrowedWorkspace);
  const configs = optionalConfigs.map((path) => {
    const absolute = sourcePath(root, path, true);
    if (absolute !== null && !lstatSync(absolute).isFile()) throw new Error(`Non-file runtime configuration: ${path}`);
    return { path, present: absolute !== null };
  });
  if (configs.some((entry) => entry.present && ['.npmrc', '.pnpmfile.cjs', 'pnpmfile.cjs'].includes(entry.path))) throw new Error('Package-manager override requires explicit context review');
  const capture = {
    version: 1, dependenciesOnly, excludedNames,
    dependencyFiles: dependencyFiles.map((path) => ({ path, sha256: sha256(sourceBytes(root, path)) })),
    workspace: { originalSha256: sha256(sourceBytes(root, 'pnpm-workspace.yaml')), acquisition: narrowedWorkspace },
    optionalConfigs: configs,
  };
  if (!dependenciesOnly) {
    const required = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', ...workspacePackages.map((name) => `packages/${name}`),
      'scripts', '_spec/corpora', '_spec/evidence/ml-adjutant-phase1'];
    const corpus = JSON.parse(sourceBytes(root, '_spec/corpora/ml-adjutant-corpus.manifest.json').toString('utf8'));
    if (!/^[a-zA-Z0-9._-]+\.json$/.test(corpus.sourcePath)) throw new Error('Corpus source must be a root JSON filename');
    required.push(corpus.sourcePath);
    if (sourcePath(root, 'scripts/challenge-contract-evidence.ts', true) === null) throw new Error('Phase2 diagnostic script is not integrated');
    const seeds = [...workspacePackages.map((name) => `packages/${name}/tsconfig.json`),
      ...configs.filter((entry) => entry.present && ['tsconfig.json', 'tsconfig.base.json'].includes(entry.path)).map((entry) => entry.path)];
    capture.configClosure = configClosure(root, seeds);
    for (const path of [...required, ...configs.filter((entry) => entry.present).map((entry) => entry.path), ...capture.configClosure]) {
      copyTree(root, path, join(context, 'runtime', path));
    }
    capture.runtime = treeManifest(join(context, 'runtime'));
  }
  capture.control = treeManifest(join(context, 'hermetic'));
  writeFileSync(join(context, 'capture.json'), JSON.stringify(capture, null, 2) + '\n');
  return capture;
}
