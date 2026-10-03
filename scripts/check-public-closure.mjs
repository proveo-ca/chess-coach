import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire, isBuiltin } from 'node:module';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require(require.resolve('typescript', { paths: [new URL('../packages/starchess-arena', import.meta.url).pathname] }));
const CONDITIONS = ['browser', 'import', 'default'];
const PACKAGES = ['starchess-core', 'starchess-arena', 'starchess-training'];
const PUBLIC_EXPORTS = [['starchess-core', '.'], ['starchess-arena', './observations'],
  ['starchess-arena', './intent-codec-v1'], ['starchess-training', './candidates']];
const PURE_EXTERNALS = new Set(['fflate', '@noble/hashes']);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const inside = (root, path) => path === root || path.startsWith(`${root}${sep}`);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function selectBrowserExport(exports, subpath) {
  const select = (value) => {
    if (typeof value === 'string') return value;
    if (!object(value) || Object.keys(value).some((key) => key.startsWith('.'))) throw new Error('Unsupported browser export conditions');
    for (const [condition, target] of Object.entries(value)) if (CONDITIONS.includes(condition)) return select(target);
    throw new Error('No browser ESM export');
  };
  if (object(exports) && Object.keys(exports).some((key) => key.startsWith('.'))) {
    if (Object.keys(exports).some((key) => key.includes('*'))) throw new Error('Wildcard package export');
    if (!Object.hasOwn(exports, subpath)) throw new Error(`Unexported package subpath: ${subpath}`);
    return select(exports[subpath]);
  }
  if (subpath !== '.') throw new Error(`Unexported package subpath: ${subpath}`);
  return select(exports);
}

export function checkPublicClosure(root = fileURLToPath(new URL('../', import.meta.url))) {
  root = resolve(root);
  const label = (path) => relative(root, path).split(sep).join('/');
  const json = (path) => {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    if (!object(value)) throw new Error(`Invalid package manifest: ${label(path)}`);
    return value;
  };
  const workspaces = new Map(PACKAGES.map((name) => {
    const directory = resolve(root, 'packages', name);
    return [name, { directory, manifest: json(resolve(directory, 'package.json')), workspace: true }];
  }));
  const byName = new Map([...workspaces.values()].map((owner) => [owner.manifest.name, owner]));
  const training = workspaces.get('starchess-training').manifest;
  if (training.private !== true || training.version !== '0.0.1' || training.dependencies?.['@noble/hashes'] !== '2.4.0' ||
    training.dependencies?.['@chess-coach/starchess-core'] !== 'workspace:*' ||
    training.dependencies?.['@chess-coach/starchess-arena'] !== 'workspace:*') throw new Error('Invalid training package pins');
  const files = new Map();
  const manifests = new Map();
  const edges = [];
  const externalOwners = new Map();
  const safeWorkspace = (path) => {
    if (!inside(root, path)) throw new Error(`Workspace source escape: ${path}`);
    let current = root;
    for (const part of relative(root, path).split(sep)) {
      current = resolve(current, part);
      try { if (lstatSync(current).isSymbolicLink()) throw new Error(`Symlink in public workspace: ${label(path)}`); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  };
  const captureManifest = (owner) => {
    const path = resolve(owner.directory, 'package.json');
    if (owner.workspace) safeWorkspace(path);
    manifests.set(label(path), hash(readFileSync(path)));
  };
  for (const owner of workspaces.values()) captureManifest(owner);
  const resolveFile = (path, owner) => {
    if (!inside(owner.directory, path)) throw new Error(`Package deep import escape: ${label(path)}`);
    if (owner.workspace) safeWorkspace(path);
    if (owner.workspace && (relative(owner.directory, path).split(sep).includes('__tests__') ||
      owner === workspaces.get('starchess-arena') && ![
        'src/observations.ts', 'src/intent-codec-v1.ts', 'src/challengeContract/validation.ts', 'src/challengeContract/candidateWire.ts',
      ].includes(relative(owner.directory, path).split(sep).join('/')) && !inside(resolve(owner.directory, 'src/authorized'), path))) {
      throw new Error(`Private host source in public closure: ${label(path)}`);
    }
    if (owner === workspaces.get('starchess-training') && inside(resolve(owner.directory, 'src/coordinator'), path)) throw new Error(`Private coordinator in public closure: ${label(path)}`);
    const candidates = extname(path) ? [path, ...(owner.workspace && /\.[cm]?js$/.test(path) ? [path.replace(/\.js$/, '.ts').replace(/\.mjs$/, '.mts').replace(/\.cjs$/, '.cts')] : [])]
      : [path, ...['.ts', '.mts', '.js', '.mjs', '/index.ts', '/index.js'].map((suffix) => `${path}${suffix}`)];
    const found = candidates.filter((candidate) => {
      if (owner.workspace) safeWorkspace(candidate);
      try { return lstatSync(candidate).isFile(); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    });
    if (found.length !== 1 || !/\.(?:ts|mts|tsx|js|mjs)$/.test(found[0])) throw new Error(`Missing, ambiguous, or non-ESM public source: ${label(path)}`);
    return found[0];
  };
  const exportFile = (owner, subpath) => {
    const target = selectBrowserExport(owner.manifest.exports, subpath);
    if (!target.startsWith('./') || target.includes('*') || target.includes('\\') || target.slice(2).split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('Unsafe package export target');
    return resolveFile(resolve(owner.directory, target), owner);
  };
  const external = (name, owner) => {
    if (!PURE_EXTERNALS.has(name)) throw new Error(`Undeclared pure external: ${name}`);
    const directory = realpathSync(resolve(owner.directory, 'node_modules', name));
    if (!inside(root, directory)) throw new Error(`Installed package outside frozen root: ${name}`);
    if (externalOwners.has(directory)) return externalOwners.get(directory);
    const manifest = json(resolve(directory, 'package.json'));
    if (manifest.name !== name || name === '@noble/hashes' && manifest.version !== '2.4.0') throw new Error(`External package pin mismatch: ${name}`);
    const target = { directory, manifest, workspace: false };
    captureManifest(target);
    externalOwners.set(directory, target);
    return target;
  };
  const visit = (path, owner) => {
    if (files.has(path)) return;
    const bytes = readFileSync(path);
    files.set(path, hash(bytes));
    const source = ts.createSourceFile(path, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
    if (source.parseDiagnostics.length) throw new Error(`Invalid public syntax: ${label(path)}`);
    const options = { noLib: true, noResolve: true, allowJs: true };
    const host = ts.createCompilerHost(options);
    host.getSourceFile = (name) => name === path ? source : undefined;
    const checker = ts.createProgram([path], options, host).getTypeChecker();
    const edge = (specifier, typeOnly) => {
      if (isBuiltin(specifier)) throw new Error(`Node builtin in browser closure: ${label(path)} -> ${specifier}`);
      let targetOwner = owner;
      let target;
      if (specifier.startsWith('.')) target = resolveFile(resolve(dirname(path), specifier), owner);
      else {
        const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
        if (!object(owner.manifest.dependencies) || typeof owner.manifest.dependencies[name] !== 'string') throw new Error(`Undeclared runtime dependency: ${label(path)} -> ${specifier}`);
        targetOwner = byName.get(name) ?? external(name, owner);
        if (owner.workspace && targetOwner.workspace && (
          owner === workspaces.get('starchess-core') && targetOwner !== owner ||
          owner === workspaces.get('starchess-arena') && targetOwner === workspaces.get('starchess-training'))) throw new Error(`Forbidden public package direction: ${specifier}`);
        if (!targetOwner.workspace && String(owner.manifest.dependencies[name]).startsWith('workspace:')) throw new Error(`Unresolved workspace: ${name}`);
        const subpath = specifier === name ? '.' : `.${specifier.slice(name.length)}`;
        target = exportFile(targetOwner, subpath);
      }
      edges.push({ importer: label(path), specifier, target: label(target), typeOnly });
      visit(target, targetOwner);
    };
    const walk = (node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (ts.isExportDeclaration(node) && !node.exportClause) throw new Error(`Wildcard public reexport: ${label(path)}`);
        if (node.moduleSpecifier) {
          if (!ts.isStringLiteralLike(node.moduleSpecifier)) throw new Error('Computed public module declaration');
          edge(node.moduleSpecifier.text, ts.isImportDeclaration(node) ? node.importClause?.isTypeOnly === true : node.isTypeOnly);
        }
      } else if (ts.isImportTypeNode(node)) {
        if (!ts.isLiteralTypeNode(node.argument) || !ts.isStringLiteralLike(node.argument.literal)) throw new Error('Computed public import type');
        edge(node.argument.literal.text, true);
      } else if (ts.isImportEqualsDeclaration(node) || ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        throw new Error(`Non-static public module loader: ${label(path)}`);
      }
      if (ts.isIdentifier(node) && !ts.isPartOfTypeNode(node) && ['require', 'module', 'process', 'Buffer', '__dirname', '__filename', 'eval', 'Function'].includes(node.text)) {
        const parent = node.parent;
        const name = ts.isPropertyAccessExpression(parent) && parent.name === node ||
          (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isMethodDeclaration(parent)) && parent.name === node;
        if (!name && !checker.getSymbolAtLocation(node)?.declarations?.length) throw new Error(`Node or code-loading global in browser closure: ${label(path)} -> ${node.text}`);
      }
      ts.forEachChild(node, walk);
    };
    walk(source);
  };
  const entrypoints = PUBLIC_EXPORTS.map(([name, subpath]) => {
    const owner = workspaces.get(name);
    const path = exportFile(owner, subpath);
    visit(path, owner);
    return { package: owner.manifest.name, subpath, target: label(path) };
  });
  return { version: 'challenge-public-closure-v1', passed: true, conditions: CONDITIONS, entrypoints,
    files: [...files].map(([path, sha256]) => ({ path: label(path), sha256 })).sort((a, b) => a.path.localeCompare(b.path)),
    manifests: [...manifests].map(([path, sha256]) => ({ path, sha256 })).sort((a, b) => a.path.localeCompare(b.path)),
    edges: edges.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 3) throw new Error('Expected at most one frozen source root');
  console.log(JSON.stringify(checkPublicClosure(process.argv[2]), null, 2));
}
