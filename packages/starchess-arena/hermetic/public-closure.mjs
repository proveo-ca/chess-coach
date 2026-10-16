// SPEC: _spec/packages/starchess-arena/invocation-effect-analysis.puml
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const toolRequire = createRequire(import.meta.url);
const CORE = "packages/starchess-core";
const ARENA = "packages/starchess-arena";
const TRAINING = "packages/starchess-training";
const authorized = new Set([
  "src/observations.ts", "src/events.ts", "src/intent-codec-v1.ts",
  ...["types", "canonical", "squares", "observationCodec"].map((name) => `src/authorized/v1/${name}.ts`),
  ...["types", "schema", "observation", "batch", "reducer"].map((name) => `src/authorized/v2/${name}.ts`),
  ...["validation", "candidateWire", "observationCodec"].map((name) => `src/challengeContract/${name}.ts`),
]);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const conditions = new Set(["browser", "module", "import", "default"]);
const intrinsicNames = new Set(["Object", "Array", "Reflect", "Number", "String", "Boolean", "BigInt", "Math", "RegExp", "Map", "Set", "WeakMap", "WeakSet", "Symbol", "JSON", "ArrayBuffer", "SharedArrayBuffer", "DataView", "Uint8Array", "Uint8ClampedArray", "Int8Array", "Uint16Array", "Int16Array", "Uint32Array", "Int32Array", "Float32Array", "Float64Array", "BigInt64Array", "BigUint64Array", "Buffer", "TextEncoder", "TextDecoder", "Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "URIError", "EvalError", "AggregateError", "Promise", "Date", "Proxy"]);
const select = (value) => {
  if (typeof value === "string") return value;
  if (!plain(value)) throw new Error("Unsupported export conditions");
  for (const [condition, target] of Object.entries(value)) if (conditions.has(condition)) return select(target);
  throw new Error("No browser ESM export condition");
};
const exportTarget = (manifest, subpath) => {
  const exports = manifest.exports;
  const target = plain(exports) && Object.keys(exports).some((key) => key.startsWith("."))
    ? Object.entries(exports).find(([key]) => key === subpath)?.[1] : subpath === "." ? exports : undefined;
  if (target === undefined) throw new Error(`Unexported private subpath: ${manifest.name}${subpath.slice(1)}`);
  const selected = select(target);
  if (!selected.startsWith("./") || selected.includes("\\") || selected.split("/").some((part) => part === ".." || part === "*")) throw new Error(`Unsafe export target: ${selected}`);
  return selected;
};

export const checkPublicClosure = (root = repository) => {
  const ts = toolRequire("typescript");
  root = resolve(root);
  const display = (path) => relative(root, path).split(sep).join("/");
  const within = (base, path) => path === base || path.startsWith(`${base}${sep}`);
  const safe = (path, base = root) => {
    if (!within(base, path)) throw new Error(`Closure path escape: ${path}`);
    let cursor = base;
    for (const part of relative(base, path).split(sep).filter(Boolean)) {
      cursor = join(cursor, part);
      if (lstatSync(cursor).isSymbolicLink()) throw new Error(`Symlink in public closure: ${display(cursor)}`);
    }
    if (!lstatSync(path).isFile()) throw new Error(`Missing closure file: ${display(path)}`);
    return path;
  };
  const readJson = (path) => {
    const value = JSON.parse(readFileSync(safe(path), "utf8"));
    if (!plain(value)) throw new Error(`Invalid package manifest: ${display(path)}`);
    return value;
  };
  const manifests = new Map([CORE, ARENA, TRAINING].map((owner) => [owner, readJson(join(root, owner, "package.json"))]));
  const publicExports = new Map([
    [CORE, { ".": "./src/index.ts", "./planning-v1": "./src/planning-v1.ts" }],
    [ARENA, { ".": "./src/index.ts", "./intent-codec-v1": "./src/intent-codec-v1.ts", "./observations": "./src/observations.ts", "./events": "./src/events.ts" }],
    [TRAINING, { "./candidates": "./src/candidates.ts" }],
  ]);
  const canonicalBranches = (value, target) => typeof value === "string" ? value === target
    : plain(value) && Object.keys(value).length > 0 && Object.values(value).every((branch) => canonicalBranches(branch, target));
  for (const [owner, expected] of publicExports) {
    const exports = manifests.get(owner).exports;
    const branches = new Map(plain(exports) ? Object.entries(exports) : []);
    if (!plain(exports) || JSON.stringify(Object.keys(exports).sort()) !== JSON.stringify(Object.keys(expected).sort()) ||
        Object.entries(expected).some(([subpath, target]) => !canonicalBranches(branches.get(subpath), target))) throw new Error(`Unapproved public export map: ${owner}`);
  }
  const byName = new Map([...manifests].map(([owner, manifest]) => [manifest.name, owner]));
  if (byName.size !== 3 || [...byName.keys()].some((name) => typeof name !== "string")) throw new Error("Invalid workspace package names");
  const runtime = new Map(["", ...manifests.keys()].map((owner) => {
    const path = owner ? `${owner}/package.json` : "package.json";
    return [path, { path, sha256: sha256(readFileSync(join(root, path))) }];
  }));
  const sources = new Map();
  const dependencies = new Map();
  const edges = [];
  const visited = new Set();
  const dependencyPackages = new Map();
  const dependencyInstances = new Map();
  const capturedUnits = new Map();
  let capturedEpoch = 0;
  const packageName = (specifier) => specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
  const sourceOwner = (path) => [...manifests.keys()].find((owner) => within(join(root, owner), path));
  const resolveFile = (path, base) => {
    const candidates = extname(path) ? [path] : [path, ...[".ts", ".tsx", ".mts", ".js", ".mjs", "/index.ts", "/index.js"].map((suffix) => `${path}${suffix}`)];
    const found = candidates.filter((candidate) => existsSync(candidate) && lstatSync(candidate).isFile());
    if (found.length !== 1) throw new Error(`Missing or ambiguous public import: ${display(path)}`);
    if (!/\.(?:ts|tsx|mts|js|mjs)$/.test(found[0])) throw new Error(`Non-ESM closure target: ${display(found[0])}`);
    return safe(found[0], base);
  };
  const permitSource = (path) => {
    const owner = sourceOwner(path);
    const local = owner && relative(join(root, owner), path).split(sep).join("/");
    if (!local?.startsWith("src/") || local.split("/").includes("__tests__")) throw new Error(`Private or unclassified public source: ${display(path)}`);
    if (owner === CORE && (local === "src/index.ts" || /^src\/(?:scfen|replay|commands|resolve)\//.test(local))) throw new Error(`Native core in public closure: ${display(path)}`);
    if (owner === ARENA && !authorized.has(local)) throw new Error(`Host/baseline in public closure: ${display(path)}`);
    if (owner === TRAINING && /^src\/(?:coordinator|cli)\//.test(local)) throw new Error(`Coordinator in public closure: ${display(path)}`);
    return owner;
  };
  const workspaceEdges = new Map([
    [CORE, new Set([CORE])],
    [ARENA, new Set([CORE, ARENA])],
    [TRAINING, new Set([CORE, ARENA, TRAINING])],
  ]);
  const resolveImport = (importer, specifier, dependency) => {
    if (isBuiltin(specifier) || specifier.startsWith("node:")) throw new Error(`Node builtin in public closure: ${display(importer)} -> ${specifier}`);
    if (specifier.startsWith(".")) {
      const target = resolveFile(resolve(dirname(importer), specifier), dependency?.base ?? root);
      if (!dependency) {
        const owner = permitSource(target);
        if (owner !== sourceOwner(importer)) throw new Error(`Deep private cross-package import: ${display(importer)} -> ${display(target)}`);
      }
      return { path: target, dependency };
    }
    if (specifier.startsWith("/") || specifier.includes("\\") || specifier.includes(":")) throw new Error(`Unsupported public import: ${specifier}`);
    const name = packageName(specifier);
    const owner = sourceOwner(importer);
    const manifest = dependency?.manifest ?? manifests.get(owner);
    if (typeof manifest?.dependencies?.[name] !== "string" && manifest?.name !== name) throw new Error(`Undeclared public dependency: ${display(importer)} -> ${specifier}`);
    const subpath = specifier === name ? "." : `.${specifier.slice(name.length)}`;
    if (byName.has(name)) {
      if (dependency) throw new Error(`External dependency imports workspace: ${specifier}`);
      const targetOwner = byName.get(name);
      const target = resolveFile(resolve(root, targetOwner, exportTarget(manifests.get(targetOwner), subpath)), root);
      permitSource(target);
      if (!workspaceEdges.get(owner)?.has(targetOwner) || targetOwner === CORE && owner !== CORE && subpath !== "./planning-v1") {
        throw new Error(`Forbidden public workspace direction: ${display(importer)} -> ${display(target)}`);
      }
      return { path: target };
    }
    if (name !== "jssha") throw new Error(`Unreviewed public dependency: ${specifier}`);
    if (specifier !== "jssha/sha256") throw new Error(`Unreviewed SHA export: ${specifier}`);
    if (manifest.dependencies?.jssha !== "3.3.2") throw new Error("SHA dependency must declare exact 3.3.2");
    const packagePath = join(dependency?.base ?? join(root, owner), "node_modules", name);
    const base = realpathSync(packagePath);
    const identity = "jssha@3.3.2";
    const priorBase = dependencyInstances.get(identity);
    if (priorBase && priorBase !== base) throw new Error(`Ambiguous dependency instance: ${identity}`);
    dependencyInstances.set(identity, base);
    let resolvedPackage = dependencyPackages.get(base);
    if (!resolvedPackage) {
      const path = safe(join(base, "package.json"), base);
      const installed = JSON.parse(readFileSync(path, "utf8"));
      if (installed.name !== name || installed.version !== "3.3.2") throw new Error(`Unexpected dependency package: ${name}`);
      resolvedPackage = { base, manifest: installed, name, version: installed.version };
      dependencyPackages.set(base, resolvedPackage);
      const id = `${name}@${installed.version}/package.json`;
      dependencies.set(id, { path: id, resolvedPath: display(path), sha256: sha256(readFileSync(path)) });
    }
    const target = exportTarget(resolvedPackage.manifest, subpath);
    if (target !== "./dist/sha256.mjs") throw new Error(`Unreviewed SHA target: ${target}`);
    return { path: resolveFile(resolve(base, target), base), dependency: resolvedPackage };
  };
  const captureUnit = (path, dependency) => {
    let unit = capturedUnits.get(path);
    if (unit) return unit;
    const bytes = readFileSync(safe(path, dependency?.base ?? root));
    const source = ts.createSourceFile(path, bytes.toString("utf8"), ts.ScriptTarget.Latest, true, /\.m?js$/.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS);
    if (source.parseDiagnostics.length) throw new Error(`Invalid closure syntax: ${display(path)}`);
    const options = { noLib: true, noResolve: true, allowJs: true };
    const host = ts.createCompilerHost(options);
    host.getSourceFile = (file) => file === path ? source : undefined;
    const checker = ts.createProgram([path], options, host).getTypeChecker();
    capturedUnits.set(path, unit = { path, dependency, bytes, source, checker });
    capturedEpoch++;
    return unit;
  };
  const modelEntries = [[CORE, "./planning-v1"], [ARENA, "./observations"], [ARENA, "./intent-codec-v1"], [ARENA, "./events"], [TRAINING, "./candidates"]]
    .map(([owner, subpath]) => ({ owner, subpath, path: resolveFile(resolve(root, owner, exportTarget(manifests.get(owner), subpath)), root) }));
  const modelEntryPaths = new Set(modelEntries.map((entry) => entry.path));
  const visit = (path, dependency) => {
    if (visited.has(path)) return;
    visited.add(path);
    if (!dependency) permitSource(path);
    const { bytes, source, checker } = captureUnit(path, dependency);
    const id = dependency ? `${dependency.name}@${dependency.version}/${relative(dependency.base, path).split(sep).join("/")}` : display(path);
    (dependency ? dependencies : sources).set(id, { path: id, ...(dependency ? { resolvedPath: display(path) } : {}), sha256: sha256(bytes) });
    const options = { noLib: true, noResolve: true, allowJs: true };
    let dataChecker;
    const dataNodes = new Map();
    const nodeKey = (node) => `${node.pos}:${node.end}:${node.kind}`;
    const dataType = (node) => {
      if (!dataChecker) {
        const dataOptions = { ...options, noLib: false, noResolve: false, types: [], target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler };
        const dataHost = ts.createCompilerHost(dataOptions);
        dataHost.getCurrentDirectory = () => root;
        dataHost.resolveModuleNames = (names, importer) => names.map((name) => {
          const workspaceName = [...byName.keys()].find((candidate) => name === candidate || name.startsWith(`${candidate}/`));
          let specifier = name;
          if (workspaceName) {
            const owner = byName.get(workspaceName);
            const subpath = name === workspaceName ? "." : `.${name.slice(workspaceName.length)}`;
            specifier = resolve(root, owner, exportTarget(manifests.get(owner), subpath));
          }
          const resolved = ts.resolveModuleName(specifier, importer, dataOptions, dataHost).resolvedModule;
          return workspaceName && resolved ? { ...resolved, resolvedUsingTsExtension: false } : resolved;
        });
        const getSourceFile = dataHost.getSourceFile;
        const dataSource = ts.createSourceFile(path, source.text, ts.ScriptTarget.Latest, true, /\.m?js$/.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS);
        const indexDataNodes = (node) => { dataNodes.set(nodeKey(node), node); ts.forEachChild(node, indexDataNodes); };
        indexDataNodes(dataSource);
        dataHost.getSourceFile = (file, ...args) => file === path ? dataSource : getSourceFile(file, ...args);
        dataChecker = ts.createProgram([path], dataOptions, dataHost).getTypeChecker();
      }
      const dataNode = dataNodes.get(nodeKey(node));
      if (!dataNode) throw new Error(`Unclassified data-type node: ${id}`);
      return dataChecker.getTypeAtLocation(dataNode);
    };
    const checkerFor = (node) => capturedUnits.get(node.getSourceFile().fileName)?.checker ?? checker;
    const globalReference = (node) => {
      const symbol = checkerFor(node).getSymbolAtLocation(node);
      return !symbol?.declarations?.length;
    };
    const edge = (specifier, kind, typeOnly = false) => {
      if (specifier === undefined) throw new Error(`Computed public module loader: ${id}`);
      if (dependency && !typeOnly) throw new Error(`Runtime import in SHA dependency: ${id}`);
      if (typeOnly && !specifier.startsWith(".") && !byName.has(packageName(specifier)) && !isBuiltin(specifier) && !specifier.startsWith("node:")) {
        const manifest = dependency?.manifest ?? manifests.get(sourceOwner(path));
        const name = packageName(specifier);
        if (name === "jssha" && specifier !== "jssha/sha256") throw new Error(`Unreviewed SHA export: ${specifier}`);
        if (name === "jssha" && manifest?.dependencies?.jssha !== "3.3.2") throw new Error("SHA dependency must declare exact 3.3.2");
        if (![manifest?.dependencies, manifest?.devDependencies].some((declared) => typeof declared?.[name] === "string")) throw new Error(`Undeclared public type dependency: ${id} -> ${specifier}`);
        edges.push({ importer: id, specifier, target: specifier, kind, typeOnly: true, targetKind: "erased-external" });
        return;
      }
      const target = resolveImport(path, specifier, dependency);
      const targetId = target.dependency ? `${target.dependency.name}@${target.dependency.version}/${relative(target.dependency.base, target.path).split(sep).join("/")}` : display(target.path);
      edges.push({ importer: id, specifier, target: targetId, kind, ...(typeOnly ? { typeOnly: true } : {}) });
      visit(target.path, target.dependency);
    };
    const literal = (node) => node && ts.isStringLiteralLike(node) ? node.text : undefined;
    const unwrap = (node) => ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) ||
      ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node) ? unwrap(node.expression)
      : ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.CommaToken ? unwrap(node.right) : node;
    const staticString = (node, seen = new Set()) => {
      const expression = unwrap(node);
      if (ts.isStringLiteralLike(expression)) return expression.text;
      if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const left = staticString(expression.left, seen), right = staticString(expression.right, seen);
        return left === undefined || right === undefined ? undefined : left + right;
      }
      if (!ts.isIdentifier(expression)) return undefined;
      const symbol = checker.getSymbolAtLocation(expression);
      if (!symbol || seen.has(symbol)) return undefined;
      const declaration = symbol.valueDeclaration;
      return declaration && ts.isVariableDeclaration(declaration) && declaration.initializer &&
        ts.isVariableDeclarationList(declaration.parent) && declaration.parent.flags & ts.NodeFlags.Const
        ? staticString(declaration.initializer, new Set([...seen, symbol])) : undefined;
    };
    const staticKey = (node, seen = new Set()) => {
      const expression = unwrap(node);
      if (ts.isNumericLiteral(expression)) return String(Number(expression.text));
      if (ts.isIdentifier(expression)) {
        const symbol = checker.getSymbolAtLocation(expression);
        if (symbol && seen.has(symbol)) return undefined;
        const declaration = symbol?.valueDeclaration;
        if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer &&
            ts.isVariableDeclarationList(declaration.parent) && declaration.parent.flags & ts.NodeFlags.Const) {
          return staticKey(declaration.initializer, new Set([...seen, symbol]));
        }
      }
      return staticString(expression);
    };
    const property = (node) => {
      const expression = unwrap(node);
      if (ts.isPropertyAccessExpression(expression)) return { receiver: expression.expression, name: expression.name.text };
      if (ts.isElementAccessExpression(expression)) return { receiver: expression.expression, name: staticKey(expression.argumentExpression) };
    };
    const ownName = (name) => ts.isComputedPropertyName(name) ? staticKey(name.expression)
      : ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : ts.isNumericLiteral(name) ? String(Number(name.text)) : undefined;
    const ownMember = (receiver, name) => {
      if (name === undefined) return undefined;
      if (ts.isArrayLiteralExpression(receiver) && /^(0|[1-9][0-9]*)$/.test(name) && !receiver.elements.some(ts.isSpreadElement)) {
        const entry = receiver.elements[+name];
        return entry && !ts.isOmittedExpression(entry) ? entry : undefined;
      }
      if (!ts.isObjectLiteralExpression(receiver)) return undefined;
      const entries = receiver.properties.filter((entry) => !ts.isSpreadAssignment(entry) && ownName(entry.name) === name);
      const entry = entries.length === 1 && !receiver.properties.some(ts.isSpreadAssignment) ? entries[0] : undefined;
      return entry && ts.isPropertyAssignment(entry) ? entry.initializer : entry && ts.isShorthandPropertyAssignment(entry) ? entry.name : undefined;
    };
    const bindingMember = (declaration) => {
      const pattern = declaration.parent;
      const owner = pattern.parent;
      let receiver;
      if (ts.isVariableDeclaration(owner)) receiver = owner.initializer;
      else if (ts.isBindingElement(owner)) {
        const member = bindingMember(owner);
        if (!member) return undefined;
        receiver = ownMember(origin(member.receiver), member.name);
        if (!receiver) return member;
      }
      if (!receiver) return undefined;
      const name = declaration.dotDotDotToken ? undefined : ts.isArrayBindingPattern(pattern) ? String(pattern.elements.indexOf(declaration))
        : declaration.propertyName ? ownName(declaration.propertyName) : ts.isIdentifier(declaration.name) ? declaration.name.text : undefined;
      return { receiver, name };
    };
    const origin = (node, seen = new Set(), members = new Set()) => {
      const expression = unwrap(node);
      if (members.has(expression)) return expression;
      const next = new Set([...members, expression]);
      if (ts.isCallExpression(expression) && expression.arguments.length === 1) {
        const method = property(expression.expression);
        if (method?.name === "freeze" && builtinNamespace(method.receiver, "Object")) return origin(expression.arguments[0], seen, next);
      }
      const member = property(expression);
      if (member?.name !== undefined) {
        const entry = ownMember(origin(member.receiver, seen, next), member.name);
        if (entry) return origin(entry, seen, next);
      }
      if (!ts.isIdentifier(expression)) return expression;
      const localChecker = checkerFor(expression);
      const symbol = ts.isShorthandPropertyAssignment(expression.parent) ? localChecker.getShorthandAssignmentValueSymbol(expression.parent)
        : ts.isExportSpecifier(expression.parent) ? localChecker.getExportSpecifierLocalTargetSymbol(expression.parent) : localChecker.getSymbolAtLocation(expression);
      if (!symbol || seen.has(symbol)) return expression;
      const declaration = symbol.valueDeclaration;
      if (declaration && ts.isBindingElement(declaration) && !declaration.initializer && !declaration.dotDotDotToken) {
        const member = bindingMember(declaration);
        const entry = member && ownMember(origin(member.receiver, new Set([...seen, symbol]), next), member.name);
        if (entry) return origin(entry, new Set([...seen, symbol]), next);
      }
      return declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
        ? origin(declaration.initializer, new Set([...seen, symbol]), next) : expression;
    };
    const binding = (node) => {
      const localChecker = capturedUnits.get(node.getSourceFile().fileName)?.checker ?? checker;
      const symbol = ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node ? localChecker.getShorthandAssignmentValueSymbol(node.parent)
        : ts.isExportSpecifier(node.parent) ? localChecker.getExportSpecifierLocalTargetSymbol(node.parent) : localChecker.getSymbolAtLocation(node);
      return symbol?.declarations?.length ? symbol : node.text;
    };
    const provenance = (node, seen = new Set()) => {
      const expression = unwrap(node);
      const roots = new Set();
      if (seen.has(expression)) return roots;
      roots.add(expression);
      const next = new Set([...seen, expression]);
      const add = (value) => { for (const root of provenance(value, next)) roots.add(root); };
      if (ts.isIdentifier(expression)) {
        const symbol = binding(expression);
        roots.add(symbol ?? expression.text);
        const declaration = symbol?.valueDeclaration;
        if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) add(declaration.initializer);
        if (declaration && ts.isBindingElement(declaration)) {
          const member = bindingMember(declaration);
          if (member) add(member.receiver);
        }
      }
      const member = property(expression);
      if (member) {
        add(member.receiver);
        const entry = ownMember(origin(member.receiver), member.name);
        if (entry) add(entry);
      }
      if (ts.isCallExpression(expression)) add(expression.expression);
      if (ts.isBinaryExpression(expression) && expression.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && expression.operatorToken.kind <= ts.SyntaxKind.LastAssignment) add(expression.left);
      return roots;
    };
    const documentRoot = (node, seen = new Set()) => {
      const expression = origin(node);
      if (seen.has(expression)) return false;
      const next = new Set([...seen, expression]);
      if (ts.isIdentifier(expression)) {
        if (expression.text === "document" && globalReference(expression)) return true;
        const declaration = checker.getSymbolAtLocation(expression)?.valueDeclaration;
        const bound = declaration && ts.isBindingElement(declaration) ? bindingMember(declaration) : undefined;
        if (bound?.name === "document" && hostRoot(bound.receiver, next)) return true;
      }
      const member = property(expression);
      return Boolean(member?.name === "document" && hostRoot(member.receiver, next));
    };
    const hostRoot = (value, seen = new Set()) => {
      const expression = unwrap(value);
      if (seen.has(expression)) return false;
      const next = new Set([...seen, expression]);
      const rooted = origin(expression);
      if (rooted !== expression && hostRoot(rooted, next)) return true;
      if (ts.isIdentifier(expression)) {
        const declaration = checker.getSymbolAtLocation(expression)?.valueDeclaration;
        const bound = declaration && ts.isBindingElement(declaration) ? bindingMember(declaration) : undefined;
        if (bound && ["globalThis", "global", "window", "self", "frames", "top", "parent"].includes(bound.name ?? "") && hostRoot(bound.receiver, next)) return true;
        const receiver = bound && origin(bound.receiver);
        if (bound?.name === "defaultView" && documentRoot(receiver, next)) return true;
      }
      const accessed = property(expression);
      const receiver = accessed && origin(accessed.receiver);
      return expression.kind === ts.SyntaxKind.ThisKeyword ||
        ts.isIdentifier(expression) && ["globalThis", "global", "window", "self", "frames", "top", "parent"].includes(expression.text) && globalReference(expression) ||
        ts.isElementAccessExpression(expression) && hostRoot(expression.expression, next) ||
        accessed && (["globalThis", "global", "window", "self", "frames", "top", "parent"].includes(accessed.name ?? "") && hostRoot(accessed.receiver, next) ||
          accessed.name === "defaultView" && documentRoot(receiver, next));
    };
    const builtinNamespace = (node, name) => {
      const expression = origin(node), member = property(expression);
      const declaration = ts.isIdentifier(expression) ? binding(expression)?.valueDeclaration : undefined;
      const bound = declaration && ts.isBindingElement(declaration) && !declaration.initializer && !declaration.dotDotDotToken ? bindingMember(declaration) : undefined;
      return ts.isIdentifier(expression) && expression.text === name && globalReference(expression) || member?.name === name &&
        hostRoot(member.receiver) || bound?.name === name && hostRoot(bound.receiver);
    };
    let mutationEpoch = 0;
    let mutationBatch;
    class MutationFacts extends Set {
      add(value) { if (!this.has(value)) { super.add(value); mutationEpoch++; } return this; }
    }
    class AssignmentFacts extends Map {
      set(key, value) { if (this.get(key) !== value) mutationEpoch++; return super.set(key, value); }
    }
    const mutatedRoots = new MutationFacts();
    const nonNumericWrites = new MutationFacts();
    const numericAssignments = new AssignmentFacts();
    const callableAssignments = new Map();
    const assignmentTargets = [];
    let callableAssignmentCount = 0;
    const addCallableAssignments = (target, values) => {
      const entries = [...values];
      if (!entries.length) return;
      for (const root of provenance(target)) {
        let assigned = callableAssignments.get(root);
        if (!assigned) { assigned = new Set(); callableAssignments.set(root, assigned); }
        for (const value of entries) if (!assigned.has(value)) { assigned.add(value); callableAssignmentCount++; mutationEpoch++; }
      }
    };
    const registerCallableAssignment = (node, values, depth = 0) => {
      if (depth > 16) throw new Error(`Unsupported parameter mutation assignment in public closure: ${id}`);
      const target = unwrap(node);
      if (ts.isBinaryExpression(target) && target.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        registerCallableAssignment(target.left, [...values, target.right], depth + 1);
      } else if (ts.isArrayLiteralExpression(target)) {
        for (const [index, entry] of target.elements.entries()) {
          if (ts.isOmittedExpression(entry)) continue;
          if (ts.isSpreadElement(entry)) {
            const remaining = values.flatMap((value) => {
              const array = origin(value);
              return ts.isArrayLiteralExpression(unwrap(value)) && ts.isArrayLiteralExpression(array) && !array.elements.some(ts.isSpreadElement)
                ? array.elements.slice(index).filter((element) => !ts.isOmittedExpression(element)) : [value];
            });
            registerCallableAssignment(entry.expression, remaining, depth + 1);
          } else registerCallableAssignment(entry, values.map((value) => ts.isArrayLiteralExpression(unwrap(value)) ? ownMember(origin(value), String(index)) ?? value : value), depth + 1);
        }
      } else if (ts.isObjectLiteralExpression(target)) {
        for (const entry of target.properties) {
          if (ts.isPropertyAssignment(entry)) registerCallableAssignment(entry.initializer, values.map((value) => ts.isObjectLiteralExpression(unwrap(value)) ? ownMember(origin(value), ownName(entry.name)) ?? value : value), depth + 1);
          else if (ts.isShorthandPropertyAssignment(entry)) registerCallableAssignment(entry.name, [...values.map((value) => ts.isObjectLiteralExpression(unwrap(value)) ? ownMember(origin(value), entry.name.text) ?? value : value), ...entry.objectAssignmentInitializer ? [entry.objectAssignmentInitializer] : []], depth + 1);
          else if (ts.isSpreadAssignment(entry)) registerCallableAssignment(entry.expression, values, depth + 1);
        }
      } else {
        addCallableAssignments(target, values);
        for (const value of values) assignmentTargets.push({ target, value });
      }
    };
    const arrayMutatorTargets = [];
    const memberMutationTargets = [];
    const memberMutationKinds = new WeakMap();
    const intrinsicMutationTargets = [];
    const invocationMutationRoots = new MutationFacts();
    const mutationCalls = [];
    let mutationNodeCount = 0;
    let arrayIntrinsicsMutated = false;
    const markIntrinsicMutation = () => { if (!arrayIntrinsicsMutated) { arrayIntrinsicsMutated = true; mutationEpoch++; } };
    const arrayIntrinsicRoot = (node, seen = new Set()) => {
      const value = origin(node);
      if (seen.has(value)) return false;
      const next = new Set([...seen, value]);
      if (ts.isIdentifier(value)) {
        if (["Array", "Object", "String", "Number", "Boolean", "JSON", "globalThis", "global"].includes(binding(value))) return true;
        const declaration = binding(value)?.valueDeclaration;
        const member = declaration && ts.isBindingElement(declaration) ? bindingMember(declaration) : undefined;
        return Boolean(member && arrayIntrinsicRoot(member.receiver, next));
      }
      const member = property(value);
      return Boolean(member && arrayIntrinsicRoot(member.receiver, next));
    };
    const markMutation = (node, kind = "write") => {
      if (!memberMutationTargets.includes(node)) memberMutationTargets.push(node);
      let kinds = memberMutationKinds.get(node);
      if (!kinds) memberMutationKinds.set(node, kinds = new Set());
      if (!kinds.has(kind)) { kinds.add(kind); mutationEpoch++; }
      for (const root of provenance(node)) { mutatedRoots.add(root); invocationMutationRoots.add(root); }
      if (arrayIntrinsicRoot(node)) markIntrinsicMutation();
    };
    const freshError = (node) => {
      const value = origin(node);
      if (!ts.isNewExpression(value)) return false;
      const ctor = origin(value.expression);
      return ts.isIdentifier(ctor) && ["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "URIError", "EvalError", "AggregateError"].includes(ctor.text) &&
        globalReference(ctor) && ![...provenance(value.expression)].some((root) => mutatedRoots.has(root));
    };
    const literalArguments = (node) => {
      if (node && [...provenance(node)].some((root) => mutatedRoots.has(root))) return undefined;
      const value = node && origin(node);
      return value && ts.isArrayLiteralExpression(value) && !value.elements.some((entry) => ts.isSpreadElement(entry) || ts.isOmittedExpression(entry)) ? [...value.elements] : undefined;
    };
    const mutationInvocation = (expression, args, depth = 0) => {
      if (depth > 16) return undefined;
      const value = origin(expression);
      if (ts.isCallExpression(value)) {
        const bound = property(origin(value.expression));
        if (bound?.name === "bind") return mutationInvocation(bound.receiver, [...value.arguments.slice(1), ...args], depth + 1);
      }
      const declaration = ts.isIdentifier(value) ? binding(value)?.valueDeclaration : undefined;
      const method = property(value) ?? (declaration && ts.isBindingElement(declaration) && !declaration.initializer && !declaration.dotDotDotToken ? bindingMember(declaration) : undefined);
      if (!method) return undefined;
      if (method.name === "call") {
        const receiver = property(origin(method.receiver));
        if (receiver?.name === "call" && args[0]) return mutationInvocation(args[0], args.slice(2), depth + 1);
        return mutationInvocation(method.receiver, args.slice(1), depth + 1);
      }
      if (method.name === "apply" && builtinNamespace(method.receiver, "Reflect")) {
        const supplied = literalArguments(args[2]);
        return supplied && args[0] ? mutationInvocation(args[0], supplied, depth + 1)
          : args[0] && mutationInvocation(args[0], [], depth + 1) !== undefined ? null : undefined;
      }
      if (method.name === "apply") {
        const supplied = literalArguments(args[1]);
        return supplied ? mutationInvocation(method.receiver, supplied, depth + 1)
          : mutationInvocation(method.receiver, [], depth + 1) !== undefined ? null : undefined;
      }
      const object = builtinNamespace(method.receiver, "Object") && ["assign", "defineProperty", "defineProperties", "setPrototypeOf", "freeze", "seal", "preventExtensions"].includes(method.name);
      const reflect = builtinNamespace(method.receiver, "Reflect") && ["set", "deleteProperty", "defineProperty", "setPrototypeOf", "preventExtensions"].includes(method.name);
      if (["__defineGetter__", "__defineSetter__"].includes(method.name)) return method.receiver;
      return object || reflect ? args.some(ts.isSpreadElement) ? null : args[0] ?? null : undefined;
    };
    const returnedValues = (call) => {
      const callee = origin(call.expression);
      const fn = ts.isIdentifier(callee) ? binding(callee)?.valueDeclaration : callee;
      if (!fn || !(ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn) || ts.isArrowFunction(fn)) || !fn.body) return [];
      if (!ts.isBlock(fn.body)) return [fn.body];
      const values = [];
      const scan = (node) => {
        if (ts.isReturnStatement(node) && node.expression) values.push(node.expression);
        else if (!ts.isFunctionLike(node)) ts.forEachChild(node, scan);
      };
      ts.forEachChild(fn.body, scan);
      return values;
    };
    const intrinsicTarget = (node, seen = new Map(), escapeOnly = false) => {
      const input = unwrap(node);
      const value = origin(node);
      const modes = seen.get(input) ?? 0;
      const mode = escapeOnly ? 1 : 2;
      if (modes & mode) return false;
      seen.set(input, modes | mode);
      const next = seen;
      for (const root of provenance(input)) for (const assigned of callableAssignments.get(root) ?? []) {
        if (intrinsicTarget(assigned, next, escapeOnly)) return true;
      }
      if (ts.isConditionalExpression(value)) return intrinsicTarget(value.whenTrue, next, escapeOnly) || intrinsicTarget(value.whenFalse, next, escapeOnly);
      if (ts.isBinaryExpression(value) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(value.operatorToken.kind)) {
        return intrinsicTarget(value.left, next, escapeOnly) || intrinsicTarget(value.right, next, escapeOnly);
      }
      if (ts.isIdentifier(value)) {
        if (intrinsicNames.has(value.text) && globalReference(value)) return true;
        const declaration = binding(value)?.valueDeclaration;
        if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) return intrinsicTarget(declaration.initializer, next, escapeOnly);
        const bound = declaration && ts.isBindingElement(declaration) && !declaration.initializer && !declaration.dotDotDotToken ? bindingMember(declaration) : undefined;
        return Boolean(bound && (intrinsicNames.has(bound.name) && hostRoot(bound.receiver) ||
          (escapeOnly ? bound.name === "prototype" && intrinsicTarget(bound.receiver, next) : intrinsicTarget(bound.receiver, next))));
      }
      if (ts.isCallExpression(value)) {
        const method = property(origin(value.expression));
        if (method && builtinNamespace(method.receiver, "Object") && ["getPrototypeOf", "getOwnPropertyDescriptor", "freeze"].includes(method.name) && value.arguments[0]) {
          return escapeOnly && method.name === "getOwnPropertyDescriptor" ? false : intrinsicTarget(value.arguments[0], next, method.name === "getPrototypeOf" ? false : escapeOnly);
        }
        return returnedValues(value).some((returned) => intrinsicTarget(returned, next, escapeOnly));
      }
      const member = property(value);
      if (member) return intrinsicNames.has(member.name) && hostRoot(member.receiver) ||
        (escapeOnly ? member.name === "prototype" && intrinsicTarget(member.receiver, next) : intrinsicTarget(member.receiver, next));
      if (ts.isArrayLiteralExpression(value)) return value.elements.some((entry) => !ts.isOmittedExpression(entry) && intrinsicTarget(ts.isSpreadElement(entry) ? entry.expression : entry, next, escapeOnly));
      if (ts.isObjectLiteralExpression(value)) return value.properties.some((entry) => ts.isPropertyAssignment(entry) ? intrinsicTarget(entry.initializer, next, escapeOnly)
        : ts.isShorthandPropertyAssignment(entry) ? intrinsicTarget(entry.name, next, escapeOnly) : ts.isSpreadAssignment(entry) && intrinsicTarget(entry.expression, next, escapeOnly));
      return false;
    };
    const scanMutations = (node) => {
      mutationNodeCount++;
      const writes = (target, numeric = false) => {
        if (ts.isIdentifier(target)) {
          const symbol = binding(target) ?? target.text;
          const declaration = symbol?.valueDeclaration;
          if (typeof symbol === "string" && intrinsicNames.has(symbol)) intrinsicMutationTargets.push(target);
          if (id === `${TRAINING}/src/composition.ts` && declaration &&
              (ts.isVariableDeclaration(declaration) && declaration.parent.parent.parent === source && ts.isIdentifier(declaration.name) && declaration.name.text === "historyFailure" ||
               ts.isClassDeclaration(declaration) && declaration.parent === source && declaration.name?.text === "ContractError")) throw new Error(`Code constructor acquisition in public closure: ${id} -> ${target.text}`);
          if (id === `${ARENA}/src/authorized/v2/schema.ts` && ["Object", "Array", "Reflect", "Number", "String", "Map", "Set", "Symbol", "Uint8Array", "ArrayBuffer"].includes(symbol)) throw new Error(`Code constructor acquisition in public closure: ${id} -> ${target.text}`);
          if (id === `${ARENA}/src/authorized/v2/schema.ts` && declaration && ts.isVariableDeclaration(declaration) && declaration.parent.parent.parent === source &&
              ts.isIdentifier(declaration.name) && ["typedArrayPrototype", "typedArrayName", "typedArrayByteLength", "typedArraySet", "checkedByteLength", "copyBytes", "byteEqual", "parseBytes"].includes(declaration.name.text)) throw new Error(`Code constructor acquisition in public closure: ${id} -> ${target.text}`);
          if (id === `${ARENA}/src/authorized/v2/schema.ts` && declaration && ts.isVariableDeclaration(declaration) && declaration.parent.parent.parent === source &&
              ts.isIdentifier(declaration.name) && ["object", "tag", "array"].includes(declaration.name.text)) throw new Error(`Code constructor acquisition in public closure: ${id} -> ${target.text}`);
          mutatedRoots.add(symbol); if (!numeric) nonNumericWrites.add(symbol); if (["Array", "Object", "String", "Number", "Boolean", "JSON"].includes(symbol)) markIntrinsicMutation();
        }
        else if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) { intrinsicMutationTargets.push(target); markMutation(target); }
        else if (ts.isParenthesizedExpression(target) || ts.isAsExpression(target) || ts.isNonNullExpression(target) || ts.isTypeAssertionExpression(target)) writes(target.expression);
        else if (ts.isArrayLiteralExpression(target)) for (const child of target.elements) writes(child);
        else if (ts.isObjectLiteralExpression(target)) for (const child of target.properties) writes(child);
        else if (ts.isPropertyAssignment(target)) writes(target.initializer);
        else if (ts.isShorthandPropertyAssignment(target)) writes(target.name);
        else if (ts.isSpreadElement(target) || ts.isSpreadAssignment(target)) writes(target.expression);
        else if (ts.isBinaryExpression(target) && target.operatorToken.kind === ts.SyntaxKind.EqualsToken) writes(target.left);
      };
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
        registerCallableAssignment(node.left, [node.right]);
        const numericCandidate = [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken].includes(node.operatorToken.kind);
        const target = unwrap(node.left);
        if (numericCandidate && ts.isIdentifier(target)) {
          const symbol = binding(target);
          numericAssignments.set(symbol, [...numericAssignments.get(symbol) ?? [], node.right]);
        }
        writes(node.left, numericCandidate);
      }
      if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) writes(node.operand, true);
      if (ts.isDeleteExpression(node)) writes(node.expression);
      if ((ts.isForOfStatement(node) || ts.isForInStatement(node)) && !ts.isVariableDeclarationList(node.initializer)) writes(node.initializer);
      if (ts.isCallExpression(node)) {
        const actualTarget = mutationInvocation(node.expression, node.arguments);
        if (actualTarget) intrinsicMutationTargets.push(actualTarget);
        mutationCalls.push(node);
        const member = property(origin(node.expression));
        const mutator = (expression) => {
          const method = property(origin(expression));
          return Boolean(method && (builtinNamespace(method.receiver, "Object") && ["assign", "defineProperty", "defineProperties", "setPrototypeOf"].includes(method.name ?? "") ||
            builtinNamespace(method.receiver, "Reflect") && ["set", "deleteProperty", "defineProperty", "setPrototypeOf"].includes(method.name ?? "")));
        };
        const mutatorRoot = (expression, depth = 0) => {
          if (depth > 8) return true;
          const current = origin(expression);
          if (ts.isIdentifier(current)) {
            const symbol = binding(current);
            const declaration = symbol?.valueDeclaration;
            if (declaration && ts.isBindingElement(declaration)) {
              const bound = bindingMember(declaration);
              if (bound && ["assign", "defineProperty", "defineProperties", "setPrototypeOf", "set", "deleteProperty"].includes(bound.name ?? "") &&
                (builtinNamespace(origin(bound.receiver), "Object") || builtinNamespace(origin(bound.receiver), "Reflect"))) return true;
            }
          }
          const method = property(current);
          if (!method) return mutator(current);
          if (method.name === undefined) return builtinNamespace(method.receiver, "Object") || builtinNamespace(method.receiver, "Reflect") || mutatorRoot(method.receiver, depth + 1);
          if (["call", "apply", "bind"].includes(method.name)) return mutatorRoot(method.receiver, depth + 1);
          return mutator(current);
        };
        const argumentMutator = (argument, seen = new Set()) => {
          const value = origin(argument);
          if (seen.has(value)) return false;
          const next = new Set([...seen, value]);
          if (ts.isSpreadElement(value)) return argumentMutator(value.expression, next);
          if (ts.isArrayLiteralExpression(value)) return value.elements.some((entry) => !ts.isOmittedExpression(entry) && argumentMutator(entry, next));
          if (ts.isObjectLiteralExpression(value)) return value.properties.some((entry) => ts.isSpreadAssignment(entry) ? argumentMutator(entry.expression, next)
            : ts.isPropertyAssignment(entry) ? argumentMutator(entry.initializer, next) : ts.isShorthandPropertyAssignment(entry) && argumentMutator(entry.name, next));
          return mutatorRoot(value);
        };
        const calleeValue = origin(node.expression);
        const calleeSymbol = ts.isIdentifier(calleeValue) ? binding(calleeValue) : undefined;
        const calleeDeclaration = calleeSymbol?.valueDeclaration;
        const callee = property(calleeValue) ?? (calleeDeclaration && ts.isBindingElement(calleeDeclaration) ? bindingMember(calleeDeclaration) : undefined);
        const indirect = callee !== undefined && (callee.name === undefined || ["call", "apply", "bind"].includes(callee.name));
        if (mutatorRoot(node.expression)) {
          const target = node.arguments[0];
          if (target) arrayMutatorTargets.push(target);
          if (indirect || !target || arrayIntrinsicRoot(target) ||
              !freshError(target)) markIntrinsicMutation();
        } else if (indirect && node.arguments.some((argument) => argumentMutator(argument))) markIntrinsicMutation();
        if (mutatorRoot(node.expression) || indirect && node.arguments.some((argument) => argumentMutator(argument))) for (const builtin of ["Math", "String", "Number", "Array", "globalThis", "global"]) mutatedRoots.add(builtin);
        if (node.arguments[0] && member && (builtinNamespace(member.receiver, "Object") && ["assign", "defineProperty", "defineProperties"].includes(member.name ?? "") ||
            builtinNamespace(member.receiver, "Reflect") && ["set", "deleteProperty", "defineProperty"].includes(member.name ?? ""))) markMutation(node.arguments[0]);
        if (member && ["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"].includes(member.name ?? "")) markMutation(member.receiver, ["sort", "reverse"].includes(member.name) ? "reorder" : "write");
      }
      ts.forEachChild(node, scanMutations);
    };
    scanMutations(source);
    const reviewedIntrinsicCallback = (call) => {
      if (id !== `${ARENA}/src/authorized/v2/schema.ts` || call.getText(source) !== 'suffix.split(":").map(Number)' ||
          call.arguments.length !== 1 || !ts.isIdentifier(call.arguments[0]) || call.arguments[0].text !== "Number" || !globalReference(call.arguments[0])) return false;
      let declaration = call.parent;
      while (declaration && !(ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) && declaration.name.text === "id")) declaration = declaration.parent;
      if (!declaration || !ts.isIdentifier(declaration.name) || declaration.name.text !== "id" || declaration.parent.parent.parent !== source ||
          !(declaration.parent.flags & ts.NodeFlags.Const) || sha256(declaration.getText(source)) !== "f52020686923cc8b01c878e68e2fdf208f6ad9b9800a84fccc60e388c38091de") return false;
      const symbol = binding(declaration.name);
      if (symbol?.declarations?.length !== 1 || numericAssignments.has(symbol) || nonNumericWrites.has(symbol)) return false;
      let valid = true;
      const scan = (node) => {
        if (ts.isIdentifier(node) && valueUse(node) && intrinsicNames.has(node.text) && !globalReference(node)) valid = false;
        ts.forEachChild(node, scan);
      };
      scan(declaration);
      return valid;
    };
    const checkIntrinsicMutations = () => {
      for (const call of mutationCalls) {
        const target = mutationInvocation(call.expression, call.arguments);
        if (target === null) throw new Error(`Code constructor acquisition in public closure: ${id} -> unresolved mutation target`);
        if (target) intrinsicMutationTargets.push(target);
        const method = property(origin(call.expression));
        const reader = method && (builtinNamespace(method.receiver, "Object") && ["getPrototypeOf", "getOwnPropertyDescriptor", "getOwnPropertyDescriptors", "hasOwn", "is", "keys", "values", "entries", "isExtensible", "isFrozen", "isSealed"].includes(method.name) ||
          builtinNamespace(method.receiver, "Reflect") && ["ownKeys", "has", "isExtensible"].includes(method.name));
        if (!reader && !reviewedIntrinsicCallback(call) && call.arguments.some((argument) => intrinsicTarget(ts.isSpreadElement(argument) ? argument.expression : argument, new Map(), true))) throw new Error(`Code constructor acquisition in public closure: ${id} -> intrinsic reference escape: ${call.getText(source)}`);
      }
      if ([...intrinsicMutationTargets, ...memberMutationTargets].some((target) => intrinsicTarget(target))) throw new Error(`Code constructor acquisition in public closure: ${id} -> intrinsic mutation`);
    };
    checkIntrinsicMutations();
    if (arrayMutatorTargets.some((target) => !freshError(target))) markIntrinsicMutation();
    const staleInvocationSource = (node) => {
      const roots = [...provenance(node)];
      return roots.some((root) => numericAssignments.has(root) || nonNumericWrites.has(root)) ||
        roots.some((root) => root && typeof root === "object" && "kind" in root && (ts.isPropertyAccessExpression(root) || ts.isElementAccessExpression(root))) &&
        roots.some((root) => invocationMutationRoots.has(root));
    };
    const numericOperators = new Set([
      ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.AsteriskAsteriskToken, ts.SyntaxKind.SlashToken, ts.SyntaxKind.PercentToken,
      ts.SyntaxKind.LessThanLessThanToken, ts.SyntaxKind.GreaterThanGreaterThanToken, ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
      ts.SyntaxKind.AmpersandToken, ts.SyntaxKind.BarToken, ts.SyntaxKind.CaretToken,
    ]);
    const hidesGetter = (access, seen = new Set()) => {
      const member = property(access);
      if (!member || seen.has(access)) return false;
      const next = new Set([...seen, access]);
      const receiver = origin(member.receiver);
      if (hidesGetter(receiver, next)) return true;
      const receiverGetter = (value, visited = new Set()) => {
        const object = origin(value);
        if (visited.has(object)) return true;
        if (!ts.isObjectLiteralExpression(object)) return true;
        const nested = new Set([...visited, object]);
        return object.properties.some((entry) => ts.isSpreadAssignment(entry) ? receiverGetter(entry.expression, nested) :
          (member.name === undefined || ownName(entry.name) === undefined || ownName(entry.name) === member.name) &&
          (ts.isGetAccessorDeclaration(entry) || ts.isSetAccessorDeclaration(entry)));
      };
      return ts.isObjectLiteralExpression(receiver) && receiverGetter(receiver);
    };
    const bindingGetter = (declaration) => {
      if (!declaration || !ts.isBindingElement(declaration)) return false;
      const member = bindingMember(declaration);
      const scan = (node, seen = new Set()) => {
        const receiver = origin(node);
        if (seen.has(receiver)) return true;
        if (!ts.isObjectLiteralExpression(receiver)) return false;
        const next = new Set([...seen, receiver]);
        return receiver.properties.some((entry) => ts.isSpreadAssignment(entry) ? scan(entry.expression, next) :
          (member.name === undefined || ownName(entry.name) === undefined || ownName(entry.name) === member.name) &&
          (ts.isGetAccessorDeclaration(entry) || ts.isSetAccessorDeclaration(entry)));
      };
      return Boolean(member && scan(member.receiver));
    };
    const jsonData = (node, seen = new Set()) => {
      const value = origin(node);
      if (seen.has(value)) return false;
      const next = new Set([...seen, value]);
      const member = property(value);
      if (member) return jsonData(member.receiver, next);
      if (!ts.isCallExpression(value)) return false;
      const method = property(origin(value.expression));
      return Boolean(method?.name === "parse" && builtinNamespace(method.receiver, "JSON"));
    };
    const arrayValue = (node, seen = new Set()) => {
      const value = origin(node);
      const input = unwrap(node);
      if (seen.has(value) || mutatedRoots.has(value) || ts.isIdentifier(input) && mutatedRoots.has(binding(input))) return false;
      const next = new Set([...seen, value]);
      if (ts.isArrayLiteralExpression(value)) return true;
      if (jsonData(value)) return true;
      if (!ts.isCallExpression(value)) return false;
      const member = property(value.expression);
      if (member && ["map", "flatMap", "filter", "slice", "concat"].includes(member.name) && arrayValue(member.receiver, next)) return true;
      if (member?.name === "from" && builtinNamespace(member.receiver, "Array")) return true;
      const callee = origin(value.expression);
      if (ts.isIdentifier(value.expression) && (numericAssignments.has(binding(value.expression)) || nonNumericWrites.has(binding(value.expression)))) return false;
      const declaration = ts.isIdentifier(callee) ? binding(callee)?.valueDeclaration : callee;
      const fn = declaration && (ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration) || ts.isFunctionDeclaration(declaration)) ? declaration : undefined;
      if (!fn?.body) return false;
      if (!ts.isBlock(fn.body)) return arrayValue(fn.body, next);
      const returns = [];
      const scan = (child) => {
        if (ts.isReturnStatement(child)) returns.push(child.expression);
        else if (!ts.isFunctionLike(child)) ts.forEachChild(child, scan);
      };
      ts.forEachChild(fn.body, scan);
      return returns.length > 0 && returns.every((returned) => returned && arrayValue(returned, next));
    };
    const parameterArguments = (node) => {
      const symbol = ts.isIdentifier(node) ? binding(node) : ts.isIdentifier(node.name) ? binding(node.name) : undefined;
      const declaration = ts.isParameter(node) ? node : symbol?.valueDeclaration;
      if (!declaration || !ts.isParameter(declaration) || declaration.dotDotDotToken || mutatedRoots.has(symbol)) return undefined;
      if (functionEscaped(declaration.parent)) return undefined;
      ensureInvocationEpoch();
      const query = incomingQuery(declaration.parent);
      saturateInvocations();
      if (!query.closed || !query.routes.size) return undefined;
      const index = declaration.parent.parameters.indexOf(declaration), values = [];
      for (const route of query.routes.values()) {
        if (!route.args) return undefined;
        if (route.args.sequenceKind === "may") return undefined;
        const ref = route.args[index];
        const value = ref && referenceNode(ref);
        if (value) values.push(value);
        if ((!ref || !nonUndefinedArgument(ref.node)) && declaration.initializer) values.push(declaration.initializer);
        else if (!value) return undefined;
      }
      return values.length ? values : undefined;
    };
    const parameterPath = (node, seen = new Set()) => {
      const value = origin(node);
      if (seen.has(value)) return undefined;
      const next = new Set([...seen, value]);
      const member = property(value);
      if (member) {
        const base = parameterPath(member.receiver, next);
        return base && { declaration: base.declaration, keys: [...base.keys, member.name] };
      }
      if (ts.isCallExpression(value)) {
        const base = parameterPath(value.expression, next);
        return base && { declaration: base.declaration, keys: [...base.keys, undefined] };
      }
      if (!ts.isIdentifier(value)) return undefined;
      const declaration = binding(value)?.valueDeclaration;
      if (declaration && ts.isParameter(declaration)) return { declaration, keys: [] };
      if (declaration && ts.isVariableDeclaration(declaration) && ts.isVariableDeclarationList(declaration.parent) && ts.isForOfStatement(declaration.parent.parent)) {
        const base = parameterPath(declaration.parent.parent.expression, next);
        return base && { declaration: base.declaration, keys: [...base.keys, undefined] };
      }
      if (!declaration || !ts.isBindingElement(declaration)) return undefined;
      const bound = bindingMember(declaration);
      if (bound) {
        const base = parameterPath(bound.receiver, next);
        return base && { declaration: base.declaration, keys: [...base.keys, bound.name] };
      }
      const keys = [];
      let element = declaration;
      for (;;) {
        const pattern = element.parent;
        keys.unshift(element.dotDotDotToken ? undefined : ts.isArrayBindingPattern(pattern) ? String(pattern.elements.indexOf(element))
          : element.propertyName ? ownName(element.propertyName) : ts.isIdentifier(element.name) ? element.name.text : undefined);
        const owner = pattern.parent;
        if (ts.isParameter(owner)) return { declaration: owner, keys };
        if (!ts.isBindingElement(owner)) return undefined;
        element = owner;
      }
    };
    const parameterProofActive = new Set();
    const callableParameterAssignments = new Map();
    const addCallableParameterAssignments = (declaration, values) => {
      let assigned = callableParameterAssignments.get(declaration);
      if (!assigned) { assigned = new Set(); callableParameterAssignments.set(declaration, assigned); }
      for (const value of values) if (!assigned.has(value)) { assigned.add(value); callableAssignmentCount++; mutationEpoch++; }
    };
    for (const { target, value } of assignmentTargets) {
      const path = parameterPath(target);
      if (path) addCallableParameterAssignments(path.declaration, [value]);
    }
    const inheritCallableAssignments = (declaration, argument) => {
      if (mutationBatch) { chargeAnalysis("routes"); mutationBatch.push(() => inheritCallableAssignments(declaration, argument)); return; }
      const values = callableParameterAssignments.get(declaration);
      if (!values?.size) return;
      addCallableAssignments(argument, values);
      const path = parameterPath(argument);
      if (path) addCallableParameterAssignments(path.declaration, values);
    };
    const mutationParameters = new MutationFacts();
    const pendingMutationParameters = [];
    const queueMutationParameter = (target) => {
      const path = parameterPath(target);
      if (path && !mutationParameters.has(path.declaration)) {
        mutationParameters.add(path.declaration);
        pendingMutationParameters.push(path.declaration);
      }
    };
    const markArgumentMutation = (argument, seen = new Set()) => {
      if (mutationBatch) { chargeAnalysis("routes"); mutationBatch.push(() => markArgumentMutation(argument)); return; }
      const value = origin(argument);
      if (seen.has(value)) return;
      const next = new Set([...seen, value]);
      markMutation(argument);
      queueMutationParameter(argument);
      if (ts.isArrayLiteralExpression(value)) {
        for (const entry of value.elements) if (!ts.isOmittedExpression(entry)) markArgumentMutation(ts.isSpreadElement(entry) ? entry.expression : entry, next);
      } else if (ts.isObjectLiteralExpression(value)) {
        for (const entry of value.properties) {
          if (ts.isPropertyAssignment(entry)) markArgumentMutation(entry.initializer, next);
          else if (ts.isShorthandPropertyAssignment(entry)) markArgumentMutation(entry.name, next);
          else if (ts.isSpreadAssignment(entry)) markArgumentMutation(entry.expression, next);
        }
      }
    };
    const invocationArguments = (args, depth = 0) => {
      if (depth > 16) return undefined;
      const result = [];
      for (const argument of args) {
        if (ts.isOmittedExpression(argument)) return undefined;
        if (!ts.isSpreadElement(argument)) result.push(argument);
        else {
          if (staleInvocationSource(argument.expression) || [...provenance(argument.expression)].some((root) => invocationMutationRoots.has(root))) return undefined;
          const value = origin(argument.expression);
          if (!ts.isArrayLiteralExpression(value)) return undefined;
          const nested = invocationArguments(value.elements, depth + 1);
          if (!nested) return undefined;
          result.push(...nested);
        }
      }
      return result;
    };
    const invocationArray = (node) => {
      if (node && (staleInvocationSource(node) || [...provenance(node)].some((root) => invocationMutationRoots.has(root)))) return undefined;
      const value = node && origin(node);
      return value && ts.isArrayLiteralExpression(value) ? invocationArguments(value.elements) : undefined;
    };
    const callableCandidates = (expression, seen = new Set(), targets = new Set()) => {
      if (seen.has(expression)) return targets;
      seen.add(expression);
      for (const root of provenance(expression)) for (const value of callableAssignments.get(root) ?? []) callableCandidates(value, seen, targets);
      const value = origin(expression);
      const target = ts.isIdentifier(value) ? binding(value)?.valueDeclaration : value;
      if (target && (ts.isFunctionDeclaration(target) || ts.isFunctionExpression(target) || ts.isArrowFunction(target))) targets.add(target);
      if (ts.isConditionalExpression(value)) { callableCandidates(value.whenTrue, seen, targets); callableCandidates(value.whenFalse, seen, targets); }
      const member = property(value);
      if (member) callableCandidates(member.receiver, seen, targets);
      if (ts.isCallExpression(value)) callableCandidates(value.expression, seen, targets);
      if (ts.isArrayLiteralExpression(value)) for (const entry of value.elements) if (!ts.isOmittedExpression(entry)) callableCandidates(ts.isSpreadElement(entry) ? entry.expression : entry, seen, targets);
      if (ts.isObjectLiteralExpression(value)) for (const entry of value.properties) {
        if (ts.isPropertyAssignment(entry)) callableCandidates(entry.initializer, seen, targets);
        else if (ts.isShorthandPropertyAssignment(entry)) callableCandidates(entry.name, seen, targets);
        else if (ts.isMethodDeclaration(entry)) targets.add(entry);
        else if (ts.isSpreadAssignment(entry)) {
          const spread = origin(entry.expression);
          if (!ts.isObjectLiteralExpression(spread) && !ts.isArrayLiteralExpression(spread)) throw new Error(`Unsupported parameter mutation candidates in public closure: ${id}`);
          callableCandidates(entry.expression, seen, targets);
        } else if (ts.isGetAccessorDeclaration(entry) && entry.body) {
          const returns = (node) => {
            if (ts.isReturnStatement(node) && node.expression) callableCandidates(node.expression, seen, targets);
            else if (!ts.isFunctionLike(node)) ts.forEachChild(node, returns);
          };
          ts.forEachChild(entry.body, returns);
        }
      }
      return targets;
    };
    const analysisLimits = {
      queries: Math.min(64 * mutationNodeCount, 65536), edges: Math.min(256 * mutationNodeCount, 262144),
      routes: Math.min(256 * mutationNodeCount, 262144), arguments: Math.min(256 * mutationNodeCount, 262144),
      steps: Math.min(2048 * mutationNodeCount, 2097152),
    };
    const analysisWork = { queries: 0, edges: 0, routes: 0, arguments: 0, steps: 0 };
    let analysisPhase = "setup";
    const phaseWork = {};
    const chargeAnalysis = (category, count = 1) => {
      if (!Number.isSafeInteger(count) || count < 0 || analysisWork[category] > analysisLimits[category] - count) {
        throw new Error(`Unsupported parameter mutation analysis ceiling in public closure: ${id} -> ${category}: ${JSON.stringify({ nodes: mutationNodeCount, ...analysisWork, phaseWork })}`);
      }
      analysisWork[category] += count;
      if (category === "steps") phaseWork[analysisPhase] = (phaseWork[analysisPhase] ?? 0) + count;
    };
    const precheckBoundary = (specifier, typeOnly) => {
      if (specifier === undefined) throw new Error(`Computed public module loader: ${id}`);
      if (dependency && !typeOnly) throw new Error(`Runtime import in SHA dependency: ${id}`);
      if (typeOnly && !specifier.startsWith(".") && !byName.has(packageName(specifier)) && !isBuiltin(specifier) && !specifier.startsWith("node:")) {
        const manifest = dependency?.manifest ?? manifests.get(sourceOwner(path)), name = packageName(specifier);
        if (name === "jssha" && specifier !== "jssha/sha256") throw new Error(`Unreviewed SHA export: ${specifier}`);
        if (name === "jssha" && manifest?.dependencies?.jssha !== "3.3.2") throw new Error("SHA dependency must declare exact 3.3.2");
        if (![manifest?.dependencies, manifest?.devDependencies].some((declared) => typeof declared?.[name] === "string")) throw new Error(`Undeclared public type dependency: ${id} -> ${specifier}`);
      } else resolveImport(path, specifier, dependency);
    };
    const precheckBoundaries = (node) => {
      chargeAnalysis("steps");
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        const typeOnly = ts.isImportDeclaration(node) ? node.importClause?.isTypeOnly === true ||
          !node.importClause?.name && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
          node.importClause.namedBindings.elements.length > 0 && node.importClause.namedBindings.elements.every((entry) => entry.isTypeOnly) : node.isTypeOnly;
        precheckBoundary(literal(node.moduleSpecifier), Boolean(typeOnly));
      } else if (ts.isImportTypeNode(node)) precheckBoundary(ts.isLiteralTypeNode(node.argument) ? literal(node.argument.literal) : undefined, true);
      ts.forEachChild(node, precheckBoundaries);
    };
    precheckBoundaries(source);
    const identities = new WeakMap();
    let nextIdentity = 1;
    const identity = (node) => {
      if (!node) return 0;
      let value = identities.get(node);
      if (!value) { chargeAnalysis("arguments"); identities.set(node, value = nextIdentity++); }
      return value;
    };
    const references = new Map(), contexts = new Map(), vectors = new Map();
    const vectorIdentities = new WeakMap(), bindingScopes = new WeakMap();
    const lexicalOwners = new WeakMap();
    const lexicalOwner = (node) => {
      if (lexicalOwners.has(node)) return lexicalOwners.get(node);
      let owner = node.parent;
      while (owner && !ts.isFunctionLike(owner)) { chargeAnalysis("steps"); owner = owner.parent; }
      lexicalOwners.set(node, owner);
      return owner;
    };
    const sourceReference = (node, context, keys = []) => {
      if (node?.sourceRef) return node;
      if (node && context && ts.isElementAccessExpression(unwrap(node))) {
        const expression = unwrap(node), key = staticKey(expression.argumentExpression);
        if (key !== undefined) return projectReference(sourceReference(expression.expression, context), [key, ...keys]);
      }
      if (node && ts.isIdentifier(unwrap(node))) for (let scope = context; scope; scope = scope.closure) {
        chargeAnalysis("steps");
        const symbol = binding(unwrap(node)), replacement = scope.bindings?.get(symbol), declaration = symbol?.valueDeclaration;
        if (replacement && !(declaration && (ts.isVariableDeclaration(declaration) || ts.isBindingElement(declaration)) && nonlocalBindingWrites(declaration))) return projectReference(replacement, keys);
      }
      if (node && context && ts.isIdentifier(unwrap(node))) {
        const parameter = parameterPath(unwrap(node));
        let scope = context;
        while (scope && parameter?.declaration.parent !== scope.fn) { chargeAnalysis("steps"); scope = scope.closure; }
        if (scope && parameter) {
          const index = scope.fn.parameters.indexOf(parameter.declaration);
          const supplied = parameterArgument(parameter.declaration, index, scope.args, scope.closure, scope);
          if (supplied) return projectReference(parameterProjection(unwrap(node), supplied, scope), keys);
          if (scope.args && parameter.declaration.initializer) return sourceReference(parameter.declaration.initializer, scope.closure, [...parameter.keys, ...keys]);
          return scope.args ? derivedReference(node, "undefined", undefined, scope) : unknownReference(node, "unknown arguments");
        }
      }
      if (node && context) {
        const expression = unwrap(node), symbol = ts.isIdentifier(expression) ? binding(expression) : undefined;
        const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
        const definition = declaration ?? expression;
        if (!lexicalOwner(definition) || ts.isStringLiteralLike(expression) || ts.isNumericLiteral(expression) || ts.isBigIntLiteral(expression) ||
            [ts.SyntaxKind.NullKeyword, ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(expression.kind)) context = undefined;
      }
      if (node && ts.isIdentifier(unwrap(node))) {
        const expression = unwrap(node), symbol = binding(expression), declaration = symbol?.valueDeclaration;
        const target = declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
        if (target && (ts.isFunctionDeclaration(target) || ts.isFunctionExpression(target) || ts.isArrowFunction(target)) &&
            !numericAssignments.has(symbol) && !nonNumericWrites.has(symbol) && !callableAssignments.get(symbol)?.size) {
          node = target;
          if (!lexicalOwner(target)) context = undefined;
        }
      }
      const key = `${identity(node)}:${context?.id ?? 0}:${JSON.stringify(keys)}`;
      let ref = references.get(key);
      if (!ref) {
        chargeAnalysis("arguments");
        ref = { sourceRef: true, id: references.size + 1, node, context, keys };
        references.set(key, ref);
      }
      return ref;
    };
    const unknownReference = (node, reason) => {
      const key = `unknown:${identity(node)}:${reason}`;
      let ref = references.get(key);
      if (!ref) {
        chargeAnalysis("arguments");
        references.set(key, ref = { sourceRef: true, id: references.size + 1, node, keys: [], unknownReason: reason });
      }
      return ref;
    };
    const projectReference = (ref, keys) => {
      chargeAnalysis("steps", ref.keys.length + keys.length + 1);
      if (ref.unknownReason || !keys.length) return ref;
      if (!ref.valueKind && !ref.base) return sourceReference(ref.node, ref.context, [...ref.keys, ...keys]);
      const base = ref.base ?? ref, path = [...ref.keys, ...keys], key = `projection:${base.id}:${JSON.stringify(path)}`;
      let value = references.get(key);
      if (!value) { chargeAnalysis("arguments"); references.set(key, value = { sourceRef: true, id: references.size + 1, node: ref.node, context: ref.context, keys: path, base }); }
      return value;
    };
    const derivedReference = (node, valueKind, elements, context, summarized = false) => {
      chargeAnalysis("steps", (elements?.length ?? 0) + 1);
      const key = `derived:${identity(node)}:${valueKind}:${context?.id ?? 0}:${+summarized}:${elements?.map((ref) => ref.id).join(",") ?? "?"}`;
      let ref = references.get(key);
      if (!ref) {
        chargeAnalysis("arguments");
        references.set(key, ref = { sourceRef: true, id: references.size + 1, node, context, keys: [], valueKind, elements, summarized });
      }
      return ref;
    };
    const argumentVector = (args) => {
      if (!args) return undefined;
      chargeAnalysis("steps");
      const cached = vectorIdentities.get(args);
      if (cached) return cached;
      const possible = args.sequenceKind === "may", values = possible ? args.values : args, prefix = possible ? args.prefix : [];
      chargeAnalysis("steps", values.length + prefix.length + 1);
      const key = `${possible ? `may:${+args.unknownValue}:${+args.missing}:${prefix.map((ref) => ref.id).join(",")}:` : "ordered:"}${values.map((ref) => ref.id).join(",")}`;
      let vector = vectors.get(key);
      if (!vector) { chargeAnalysis("arguments"); vectors.set(key, vector = { id: vectors.size + 1, values: args }); }
      chargeAnalysis("arguments"); vectorIdentities.set(args, vector);
      return vector;
    };
    const unknownArguments = (node, values = [], prefix = [], unknownValue = false, missing = true) => {
      chargeAnalysis("steps", values.length + prefix.length + 1); chargeAnalysis("arguments", values.length + 1);
      const args = { sequenceKind: "may", node, values, prefix, unknownValue, missing };
      return argumentVector(args).values;
    };
    const argumentChoice = (node, args, fallback) => {
      chargeAnalysis("steps", args.values.length + 2); chargeAnalysis("arguments", args.values.length + 2);
      const values = args.values.map((value) => primitiveKind(value) === "undefined" && fallback ? fallback : value);
      if (args.missing) values.push(fallback ?? derivedReference(node, "undefined", undefined));
      if (args.unknownValue) values.push(unknownReference(node, "unknown supplied argument value"));
      return derivedReference(node, "alternatives", values, undefined, true);
    };
    const argumentAt = (args, index, node) => !args ? undefined : args.sequenceKind === "may" ? args.prefix[index] ?? argumentChoice(node, args) : args[index];
    const argumentValues = (args) => {
      if (!args || args.sequenceKind !== "may") return args ?? [];
      chargeAnalysis("steps", args.prefix.length + args.values.length + 1); chargeAnalysis("arguments", args.prefix.length + args.values.length + 1);
      return [...args.prefix, ...args.values, ...args.unknownValue ? [unknownReference(args.node, "unknown supplied argument value")] : []];
    };
    const sliceArguments = (args, start, node) => {
      if (!args) return undefined;
      if (args.sequenceKind === "may") {
        chargeAnalysis("steps", args.prefix.length + 1); chargeAnalysis("arguments", args.prefix.length + 1);
        return unknownArguments(node, args.values, args.prefix.slice(start), args.unknownValue, args.missing);
      }
      chargeAnalysis("steps", Math.max(0, args.length - start) + 1); chargeAnalysis("arguments", Math.max(0, args.length - start) + 1);
      return args.slice(start);
    };
    const concatArguments = (left, right, node) => {
      if (!left) left = unknownArguments(node, [], [], true);
      if (!right) right = unknownArguments(node, [], [], true);
      const a = left.sequenceKind === "may", b = right.sequenceKind === "may";
      const size = (a ? left.prefix.length + left.values.length : left.length) + (b ? right.prefix.length + right.values.length : right.length);
      chargeAnalysis("steps", size + 1); chargeAnalysis("arguments", size + 1);
      if (!a && !b) return argumentVector([...left, ...right]).values;
      if (!a) return unknownArguments(node, right.values, [...left, ...right.prefix], right.unknownValue, right.missing);
      return unknownArguments(node, [...left.values, ...b ? [...right.prefix, ...right.values] : right], left.prefix, left.unknownValue || Boolean(b && right.unknownValue), left.missing || Boolean(b && right.missing));
    };
    const mapArguments = (args, transform) => {
      if (!args) return undefined;
      const values = args.sequenceKind === "may" ? args.values : args;
      chargeAnalysis("steps", values.length + (args.prefix?.length ?? 0) + 1); chargeAnalysis("arguments", values.length + (args.prefix?.length ?? 0) + 1);
      return args.sequenceKind === "may" ? unknownArguments(args.node, values.map(transform), args.prefix.map(transform), args.unknownValue, args.missing) : argumentVector(values.map(transform)).values;
    };
    const parameterArgument = (declaration, index, args, closure, context) => {
      if (!args) {
        if (declaration.initializer) return argumentChoice(declaration, unknownArguments(declaration, [], [], true), initializerReference(declaration.initializer, context));
        return unknownReference(declaration.name, "unknown arguments");
      }
      const fallback = declaration.initializer && initializerReference(declaration.initializer, context);
      if (declaration.dotDotDotToken) {
        const rest = sliceArguments(args, index, declaration);
        return derivedReference(declaration, "array", argumentValues(rest), context, rest.sequenceKind === "may");
      }
      const value = args.sequenceKind === "may" ? args.prefix[index] ?? argumentChoice(declaration, args, fallback) : args[index];
      return !value || primitiveKind(value) === "undefined" ? fallback ?? derivedReference(declaration, "undefined", undefined, closure) : fallback ? defaultReference(value, fallback, declaration) : value;
    };
    const initializerReference = (node, context) => {
      const key = `initializer:${identity(node)}:${context?.id ?? 0}`;
      let ref = references.get(key);
      if (!ref) { chargeAnalysis("arguments"); references.set(key, ref = { sourceRef: true, id: references.size + 1, node, context, keys: [], valueKind: "initializer" }); }
      return ref;
    };
    const defaultReference = (value, fallback, node) => {
      const key = `default:${value.id}:${fallback.id}`;
      let ref = references.get(key);
      if (!ref) { chargeAnalysis("arguments"); references.set(key, ref = { sourceRef: true, id: references.size + 1, node, keys: [], valueKind: "default", value, fallback }); }
      return ref;
    };
    const parameterProjection = (node, value, context) => {
      chargeAnalysis("steps");
      let declaration = binding(node)?.valueDeclaration;
      if (!declaration || !ts.isBindingElement(declaration)) return value;
      chargeAnalysis("arguments"); const entries = [];
      while (declaration && ts.isBindingElement(declaration)) { chargeAnalysis("steps"); chargeAnalysis("arguments"); entries.push(declaration); declaration = declaration.parent.parent; }
      for (let index = entries.length - 1; index >= 0; index--) {
        chargeAnalysis("steps");
        const entry = entries[index], pattern = entry.parent;
        const key = ts.isArrayBindingPattern(pattern) ? String(pattern.elements.indexOf(entry)) : entry.propertyName ? ownName(entry.propertyName) : ts.isIdentifier(entry.name) ? entry.name.text : undefined;
        value = projectReference(value, [key]);
        if (entry.initializer) value = defaultReference(value, initializerReference(entry.initializer, context), entry);
      }
      return value;
    };
    const boundReference = (route, node) => {
      const key = `bound:${identity(route.target)}:${route.callee.id}:${argumentVector(route.args)?.id ?? "?"}:${route.receiver?.id ?? 0}:${route.closure?.id ?? 0}:${route.cost}`;
      let ref = references.get(key);
      if (!ref) {
        chargeAnalysis("arguments");
        references.set(key, ref = { sourceRef: true, id: references.size + 1, node: route.target ?? node, keys: [], valueKind: "bound", bound: route });
      }
      return ref;
    };
    const callContext = (fn, args, receiver, closure, cost = 0, site) => {
      const vector = argumentVector(args);
      const key = `${identity(fn)}:${vector?.id ?? "?"}:${receiver?.id ?? 0}:${closure?.id ?? 0}:${cost}:${identity(site)}`;
      let context = contexts.get(key);
      if (!context) {
        chargeAnalysis("arguments");
        contexts.set(key, context = { id: contexts.size + 1, fn, args, receiver, closure, cost, site });
      }
      return context;
    };
    const bindingContext = (context, bindings) => {
      chargeAnalysis("steps");
      const frame = context.frame ?? context, cached = bindingScopes.get(bindings);
      if (bindings instanceof BindingState && cached?.revision === bindings.revision && cached.frame === frame) return cached.scope;
      chargeAnalysis("arguments", bindings.size + 1);
      chargeAnalysis("steps", bindings.size * (Math.ceil(Math.log2(bindings.size + 1)) + 2) + 1);
      const key = `bindings:${frame.id}:${[...bindings].map(([symbol, ref]) => `${identity(symbol)}=${ref.id}`).sort().join(",")}`;
      let scope = contexts.get(key);
      if (!scope) {
        chargeAnalysis("arguments", bindings.size + 2); chargeAnalysis("steps", bindings.size + 1);
        contexts.set(key, scope = { ...frame, frame, id: contexts.size + 1, bindings: new Map(bindings) });
      }
      if (bindings instanceof BindingState) { chargeAnalysis("arguments"); bindingScopes.set(bindings, { frame, revision: bindings.revision, scope }); }
      return scope;
    };
    class BindingState extends Map {
      constructor(entries) { super(entries); this.revision = 0; }
      set(key, value) { if (this.get(key) !== value) this.revision = (this.revision ?? 0) + 1; return super.set(key, value); }
    }
    const copyBindings = (context) => {
      const size = context.bindings?.size ?? 0;
      chargeAnalysis("arguments", size + 1); chargeAnalysis("steps", size + 1);
      return new BindingState(context.bindings ?? []);
    };
    const functionNode = (node) => Boolean(node && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)));
    const lexicalClosure = (fn, context) => {
      let owner = fn.parent;
      while (owner && !functionNode(owner)) owner = owner.parent;
      if (!owner) return undefined;
      for (let scope = context; scope; scope = scope.closure) if (scope.fn === owner) return scope;
      return undefined;
    };
    const exportResolutionCache = new Map();
    const runtimeExports = (unit, name, active = new Set()) => {
      const key = `${unit.path}:${name}`;
      if (exportResolutionCache.has(key)) return exportResolutionCache.get(key);
      if (active.has(key)) { const pending = []; pending.pendingExport = true; return pending; }
      const next = new Set([...active, key]), declarations = [];
      const include = (values) => { declarations.push(...values); if (values.pendingExport) declarations.pendingExport = true; };
      for (const statement of unit.source.statements) {
        chargeAnalysis("steps");
        if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
          const target = statement.moduleSpecifier && resolveImport(unit.path, literal(statement.moduleSpecifier), unit.dependency);
          const exportedUnit = target && captureUnit(target.path, target.dependency);
          if (!statement.exportClause && exportedUnit) include(runtimeExports(exportedUnit, name, next));
          else if (statement.exportClause && ts.isNamedExports(statement.exportClause)) for (const entry of statement.exportClause.elements) {
            if (entry.isTypeOnly || name !== "*" && entry.name.text !== name) continue;
            if (exportedUnit) include(runtimeExports(exportedUnit, (entry.propertyName ?? entry.name).text, next));
            else {
              const symbol = unit.checker.getExportSpecifierLocalTargetSymbol(entry);
              const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
              if (declaration) declarations.push(declaration);
            }
          }
        } else if (ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export) {
          const entries = ts.isVariableStatement(statement) ? statement.declarationList.declarations : [statement];
          for (const entry of entries) {
            if (ts.isVariableDeclaration(entry) && !ts.isIdentifier(entry.name)) {
              const includeBindings = (pattern) => {
                chargeAnalysis("steps");
                for (const element of pattern.elements) if (ts.isBindingElement(element)) {
                  if (ts.isIdentifier(element.name)) { if (name === "*" || element.name.text === name) { chargeAnalysis("arguments"); declarations.push(element); } }
                  else includeBindings(element.name);
                }
              };
              includeBindings(entry.name); continue;
            }
            const exportedName = ts.getCombinedModifierFlags(entry) & ts.ModifierFlags.Default ? "default" : entry.name && ts.isIdentifier(entry.name) ? entry.name.text : undefined;
            if (name === "*" || exportedName === name) declarations.push(entry);
          }
        } else if (ts.isExportAssignment(statement) && !statement.isExportEquals && (name === "*" || name === "default")) declarations.push(statement.expression);
      }
      if (!declarations.pendingExport) { chargeAnalysis("arguments"); exportResolutionCache.set(key, declarations); }
      return declarations;
    };
    const runtimeImportTargets = (declaration) => {
      if (!declaration || !(ts.isImportSpecifier(declaration) || ts.isImportClause(declaration))) return undefined;
      let statement = declaration;
      while (statement && !ts.isImportDeclaration(statement)) { chargeAnalysis("steps"); statement = statement.parent; }
      if (!statement || statement.importClause?.isTypeOnly || ts.isImportSpecifier(declaration) && declaration.isTypeOnly) return [];
      const unit = captureUnit(statement.getSourceFile().fileName);
      const target = resolveImport(unit.path, literal(statement.moduleSpecifier), unit.dependency);
      return runtimeExports(captureUnit(target.path, target.dependency), ts.isImportClause(declaration) ? "default" : (declaration.propertyName ?? declaration.name).text);
    };
    const runtimeUnits = new Set(), unitCalls = new Map();
    const captureRuntimeGraph = (unit) => {
      if (runtimeUnits.has(unit)) return;
      chargeAnalysis("arguments"); runtimeUnits.add(unit);
      for (const statement of unit.source.statements) {
        chargeAnalysis("steps");
        if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier) continue;
        if (ts.isExportDeclaration(statement) && statement.isTypeOnly || ts.isImportDeclaration(statement) && (statement.importClause?.isTypeOnly ||
            !statement.importClause?.name && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings) &&
            statement.importClause.namedBindings.elements.length > 0 && statement.importClause.namedBindings.elements.every((entry) => entry.isTypeOnly))) continue;
        const target = resolveImport(unit.path, literal(statement.moduleSpecifier), unit.dependency);
        captureRuntimeGraph(captureUnit(target.path, target.dependency));
      }
    };
    const completeCallsites = () => {
      for (const entry of modelEntries) captureRuntimeGraph(captureUnit(entry.path));
      const calls = [];
      for (const unit of runtimeUnits) {
        let entries = unitCalls.get(unit);
        if (!entries) {
          entries = [];
          const scan = (node) => {
            chargeAnalysis("steps");
            if (ts.isCallExpression(node)) { chargeAnalysis("arguments"); entries.push(node); }
            ts.forEachChild(node, scan);
          };
          scan(unit.source); unitCalls.set(unit, entries);
        }
        calls.push(...entries);
      }
      return calls;
    };
    const referenceNode = (ref) => {
      if (!ref || ref.unknownReason) return undefined;
      let node = ref.node && origin(ref.node);
      for (const key of ref.keys) node = node && ownMember(origin(node), key);
      return node;
    };
    const argumentRecipes = new WeakMap(), spreadLists = new WeakMap();
    const hasSpread = (args) => {
      chargeAnalysis("steps");
      if (spreadLists.has(args)) return spreadLists.get(args);
      let spread = false;
      for (const argument of args) { chargeAnalysis("steps"); if (ts.isSpreadElement(argument)) spread = true; }
      chargeAnalysis("arguments"); spreadLists.set(args, spread); return spread;
    };
    const validateSpreadDepth = (args, context, depth = 0) => {
      chargeAnalysis("steps");
      if (depth > 16) throw new Error(`Unsupported parameter mutation arguments in public closure: ${id}`);
      for (const argument of args) {
        chargeAnalysis("steps");
        if (!ts.isSpreadElement(argument)) continue;
        const ref = sourceReference(argument.expression, context), value = referenceNode(ref);
        if (value && ts.isArrayLiteralExpression(value)) validateSpreadDepth(value.elements, ref.context, depth + 1);
      }
    };
    const referencedArguments = (args, context, depth = 0) => {
      chargeAnalysis("steps");
      if (depth > 16) throw new Error(`Unsupported parameter mutation arguments in public closure: ${id}`);
      if (!hasSpread(args)) {
        let recipes = argumentRecipes.get(args);
        const key = `${context?.id ?? 0}:${depth}:${mutationEpoch}:${capturedEpoch}`;
        if (recipes?.has(key)) return recipes.get(key);
        chargeAnalysis("steps", args.length * 2 + 1); chargeAnalysis("arguments", args.length + 1);
        const result = args.map((argument) => ts.isOmittedExpression(argument) ? undefined : sourceReference(argument, context));
        const recipe = result.includes(undefined) ? undefined : argumentVector(result).values;
        if (!recipes) { chargeAnalysis("arguments"); argumentRecipes.set(args, recipes = new Map()); }
        chargeAnalysis("arguments"); recipes.set(key, recipe); return recipe;
      }
      const result = [];
      for (const argument of args) {
        chargeAnalysis("steps");
        if (ts.isOmittedExpression(argument)) return undefined;
        if (!ts.isSpreadElement(argument)) result.push(sourceReference(argument, context));
        else {
          const ref = sourceReference(argument.expression, context), value = referenceNode(ref);
          if (ref.summarized || !value || !ts.isArrayLiteralExpression(value) || staleInvocationSource(argument.expression) ||
              mutatedRoots.has(value) || [...provenance(argument.expression)].some((root) => invocationMutationRoots.has(root) || mutatedRoots.has(root))) return undefined;
          const nested = referencedArguments(value.elements, ref.context, depth + 1);
          if (!nested) return undefined;
          result.push(...nested);
        }
      }
      argumentVector(result);
      return result;
    };
    let graphEpoch = -1, graphCapturedEpoch = -1, queryGraph = new Map(), activeGraph = false;
    const queryQueue = [], queuedQueries = new Set(), dirtyCertificate = new Set();
    const enqueueQuery = (query, dependency) => {
      dirtyCertificate.add(query);
      if (dependency) { query.changedDependencies ??= new Set(); query.changedDependencies.add(dependency); }
      if (!queuedQueries.has(query)) { queuedQueries.add(query); queryQueue.push(query); }
    };
    const invocationQuery = (ref, args, cost = 0, invoked = true, receiver, expected) => {
      if (cost > 16) throw new Error(`Unsupported parameter mutation wrapper in public closure: ${id} -> ${ref.node?.getText(source) ?? "unknown"}`);
      let wrapper = ref.node && unwrap(ref.node), wrappers = 0;
      while (wrapper) {
        const member = property(wrapper);
        if (member && ["call", "apply", "bind"].includes(member.name)) { wrappers++; wrapper = unwrap(member.receiver); }
        else if (ts.isCallExpression(wrapper) && property(wrapper.expression)?.name === "bind") { wrappers++; wrapper = unwrap(wrapper.expression); }
        else break;
        chargeAnalysis("steps");
        if (cost + wrappers > 16) throw new Error(`Unsupported parameter mutation wrapper in public closure: ${id}`);
      }
      const vector = argumentVector(args);
      const key = `invoke:${ref.id}:${vector?.id ?? "?"}:${cost}:${+invoked}:${receiver?.id ?? 0}`;
      let query = queryGraph.get(key);
      if (!query) {
        chargeAnalysis("queries");
        queryGraph.set(key, query = { key, ref, args, cost, invoked, receiver, routes: new Map(), dependencies: new Map(), parents: new Set(), terminal: false });
        enqueueQuery(query);
      }
      return query;
    };
    const incomingQuery = (fn) => {
      const key = `incoming:${identity(fn)}`;
      let query = queryGraph.get(key);
      if (!query) {
        chargeAnalysis("queries");
        queryGraph.set(key, query = { key, fn, routes: new Map(), dependencies: new Map(), parents: new Set(), terminal: false });
        enqueueQuery(query);
      }
      return query;
    };
    const discoveryQuery = () => {
      const key = "incoming-discovery";
      let query = queryGraph.get(key);
      if (!query) {
        chargeAnalysis("queries");
        queryGraph.set(key, query = { key, discoveryQuery: true, routes: new Map(), dependencies: new Map(), parents: new Set(), terminal: true, incoming: new Map() });
        enqueueQuery(query);
      }
      return query;
    };
    const callDiscoveryQuery = (call) => {
      const key = `call-discovery:${identity(call)}`;
      let query = queryGraph.get(key);
      if (!query) {
        chargeAnalysis("queries");
        queryGraph.set(key, query = { key, callDiscoveryQuery: true, call, routes: new Map(), dependencies: new Map(), parents: new Set(), terminal: true });
        enqueueQuery(query);
      }
      return query;
    };
    const valueQuery = (ref) => {
      const key = `value:${ref.id}`;
      let query = queryGraph.get(key);
      if (!query) {
        chargeAnalysis("queries");
        queryGraph.set(key, query = { key, valueQuery: true, ref, routes: new Map(), dependencies: new Map(), parents: new Set(), terminal: false });
        enqueueQuery(query);
      }
      return query;
    };
    const returnQuery = (fn, context) => {
      const key = `returns:${identity(fn)}:${context.id}`;
      let query = queryGraph.get(key);
      if (!query) {
        chargeAnalysis("queries");
        queryGraph.set(key, query = { key, returnQuery: true, target: fn, context, ref: sourceReference(fn, context), routes: new Map(), dependencies: new Map(), parents: new Set(), terminal: false });
        enqueueQuery(query);
      }
      return query;
    };
    const transferQuery = (key, kind, ref, call, allocation) => {
      chargeAnalysis("steps");
      let query = queryGraph.get(key);
      if (!query) {
        chargeAnalysis("queries");
        queryGraph.set(key, query = { key, [`${kind}Query`]: true, ref, call, allocation, routes: new Map(), dependencies: new Map(), parents: new Set(), terminal: kind !== "exposure", version: 0 });
        if (kind === "publicExposure" || kind === "heapDiscovery") query.incoming = new Map();
        enqueueQuery(query);
      }
      return query;
    };
    const publicExposureQuery = () => transferQuery("public-exposure", "publicExposure");
    const exposureQuery = (ref) => transferQuery(`exposure:${ref.id}`, "exposure", ref);
    const heapDiscoveryQuery = () => transferQuery("heap-discovery", "heapDiscovery");
    const heapMutationQuery = (call) => transferQuery(`heap-mutation:${identity(call)}`, "heapMutation", undefined, call);
    const argumentsQuery = (args, context, depth) => {
      if (depth > 16) throw new Error(`Unsupported parameter mutation arguments in public closure: ${id}`);
      const query = transferQuery(`arguments:${identity(args)}:${context?.id ?? 0}:${depth}`, "arguments", sourceReference(args[0] ?? source, context));
      query.argumentNodes ??= args; query.context ??= context; query.depth ??= depth;
      query.terminal = false;
      return query;
    };
    const sourceInvocations = (query, expression, args, context, cost = 0, invoked = true, discovery = false) => {
      chargeAnalysis("steps");
      query.sourceCalls ??= new Map();
      const key = `${identity(expression)}:${identity(args)}:${context?.id ?? 0}:${cost}:${+invoked}`;
      let state = query.sourceCalls.get(key);
      if (!state) {
        chargeAnalysis("arguments", 2); query.sourceCalls.set(key, state = { invocations: new Set() });
        if (hasSpread(args)) validateSpreadDepth(args, context);
        const exact = hasSpread(args) ? undefined : referencedArguments(args, context);
        if (exact) {
          const invocation = invocationQuery(sourceReference(expression, context), exact, cost, invoked);
          dependencyRoutes(query, invocation, discovery); state.invocations.add(invocation);
        } else state.arguments = argumentsQuery(args, context, 0);
      }
      if (state.arguments) {
        dependencyRoutes(query, state.arguments, discovery);
        for (const route of routeDelta(query, state.arguments, `source-arguments:${key}`)) {
          const invocation = invocationQuery(sourceReference(expression, context), route.args, cost, invoked);
          dependencyRoutes(query, invocation, discovery);
          if (!state.invocations.has(invocation)) { chargeAnalysis("edges"); state.invocations.add(invocation); }
        }
      }
      return state.invocations;
    };
    const allocationIdentities = new Map();
    const allocationIdentity = (ref) => {
      if (ref.allocation) return ref.allocation;
      if (ref.unknownReason || primitiveKind(ref)) return undefined;
      const node = ref.node && unwrap(ref.node);
      if (ref.keys.length || !node || ref.valueKind !== "array" && !ts.isArrayLiteralExpression(node) && !ts.isObjectLiteralExpression(node)) return undefined;
      const owner = lexicalOwner(node);
      let scope = ref.context;
      while (scope && scope.fn !== owner) { chargeAnalysis("steps"); scope = scope.closure; }
      const frame = scope?.frame ?? scope, key = `${identity(node)}:${frame?.id ?? 0}`;
      let allocation = allocationIdentities.get(key);
      if (!allocation) { chargeAnalysis("arguments"); allocationIdentities.set(key, allocation = { id: allocationIdentities.size + 1, node, frame }); }
      return allocation;
    };
    const heapQuery = (ref) => {
      const allocation = allocationIdentity(ref);
      return allocation && transferQuery(`heap:${allocation.id}`, "heap", ref, undefined, allocation);
    };
    const fieldQuery = (ref, name, site) => {
      const query = transferQuery(`field:${ref.id}:${JSON.stringify(name)}:${identity(site)}`, "field", ref, undefined, allocationIdentity(ref));
      query.fieldName = name;
      query.readSite = site;
      query.terminal = false;
      return query;
    };
    const fieldReference = (base, name, site) => {
      chargeAnalysis("steps");
      const key = `own-field:${base.id}:${JSON.stringify(name)}:${identity(site)}`;
      let ref = references.get(key);
      if (!ref) { chargeAnalysis("arguments"); references.set(key, ref = { sourceRef: true, id: references.size + 1, node: base.node, context: base.context, keys: [], valueKind: "own-field", fieldBase: base, fieldName: name, readSite: site }); }
      return ref;
    };
    const accessorReference = (base, getter, site) => {
      const key = `accessor:${base.id}:${identity(getter)}:${identity(site)}`;
      let ref = references.get(key);
      if (!ref) { chargeAnalysis("arguments"); references.set(key, ref = { sourceRef: true, id: references.size + 1, node: getter, context: base.context, keys: [], valueKind: "accessor-value", receiver: base, readSite: site }); }
      return ref;
    };
    const accessorReturns = (ref, consumer) => {
      const execution = transferQuery(`accessor-execution:${ref.id}`, "accessorExecution", ref);
      dependencyRoutes(discoveryQuery(), execution, true);
      dependencyRoutes(consumer, execution, true);
      const closure = lexicalClosure(ref.node, ref.context), body = returnQuery(ref.node, callContext(ref.node, [], ref.receiver, closure, 0, ref.readSite));
      dependencyRoutes(consumer, body, true);
      return body;
    };
    const clobberQuery = (ref, call) => transferQuery(`clobber:${ref.id}:${identity(call)}`, "clobber", ref, call);
    const allocationValues = (query, input, operation) => {
      query.allocationInputs ??= new Map();
      const key = `${input.key}:${operation}`;
      let state = query.allocationInputs.get(key);
      if (!state) { chargeAnalysis("arguments", 3); query.allocationInputs.set(key, state = { sources: new Set([input]), values: new Map() }); }
      for (const source of state.sources) {
        chargeAnalysis("steps");
        for (const route of routeDelta(query, source, `allocation-values:${key}`)) {
          const ref = route.value;
          if (!ref) continue;
          if (ref.valueKind === "accessor-value") {
            const body = accessorReturns(ref, query);
            if (!state.sources.has(body)) { chargeAnalysis("edges"); state.sources.add(body); }
          } else if (allocationIdentity(ref) && !state.values.has(ref.id)) { chargeAnalysis("arguments"); state.values.set(ref.id, ref); }
        }
      }
      return state.values.values();
    };
    const fieldMutationQuery = (node) => transferQuery(`field-mutation:${identity(node)}`, "fieldMutation", sourceReference(node), node);
    const globalLiteralOrigins = new WeakMap();
    const globalLiteralOrigin = (input) => {
      chargeAnalysis("steps");
      if (globalLiteralOrigins.has(input)) return globalLiteralOrigins.get(input);
      const visited = new Set();
      let node = input, result;
      while (node && !visited.has(node)) {
        chargeAnalysis("steps"); chargeAnalysis("arguments"); visited.add(node);
        if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
        else if (ts.isIdentifier(node)) {
          const declaration = binding(node)?.valueDeclaration;
          const imported = runtimeImportTargets(declaration);
          const target = imported?.length === 1 ? imported[0] : declaration;
          node = target && ts.isVariableDeclaration(target) ? target.initializer : undefined;
        } else {
          if ((ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)) && !lexicalOwner(node)) result = node;
          break;
        }
      }
      chargeAnalysis("arguments"); globalLiteralOrigins.set(input, result); return result;
    };
    const recordSiteScope = (query, node, scope) => {
      chargeAnalysis("steps");
      query.callContexts ??= new Map(); query.callScopeLogs ??= new Map();
      let scopes = query.callContexts.get(node);
      if (!scopes) { chargeAnalysis("arguments", 2); query.callContexts.set(node, scopes = new Set()); query.callScopeLogs.set(node, []); }
      if (!scopes.has(scope)) {
        chargeAnalysis("arguments"); scopes.add(scope); query.callScopeLogs.get(node).push(scope);
        query.version = (query.version ?? 0) + 1;
        for (const parent of query.parents) { chargeAnalysis("steps"); enqueueQuery(parent, query); }
      }
    };
    const dependencyRoutes = (query, dependency, discovery = false) => {
      if (!query.dependencies.has(dependency)) {
        chargeAnalysis("edges"); query.dependencies.set(dependency, discovery); dependency.parents.add(query);
        dirtyCertificate.add(query);
        query.changedDependencies ??= new Set(); query.changedDependencies.add(dependency);
      } else if (!discovery && query.dependencies.get(dependency)) { query.dependencies.set(dependency, false); dirtyCertificate.add(query); }
      return dependency.routes.values();
    };
    const addRoute = (query, route) => {
      chargeAnalysis("steps");
      const vector = argumentVector(route.args);
      const key = `${identity(route.target)}:${route.callee.id}:${vector?.id ?? "?"}:${route.receiver?.id ?? 0}:${route.closure?.id ?? 0}:${route.cost}:${+Boolean(route.bound)}:${route.unknownReason ?? ""}:${route.value?.id ?? 0}:${identity(route.call)}:${+Boolean(route.pendingNative)}`;
      if (!query.routes.has(key)) {
        chargeAnalysis("routes"); query.routes.set(key, route);
        query.routeLog ??= [];
        query.routeLog.push(route);
        query.version = (query.version ?? 0) + 1;
        if ((query.discoveryQuery || query.publicExposureQuery || query.heapDiscoveryQuery) && route.target) {
          let routes = query.incoming.get(route.target);
          if (!routes) { chargeAnalysis("edges"); query.incoming.set(route.target, routes = new Map()); }
          chargeAnalysis("edges"); routes.set(key, route);
          query.targetLogs ??= new Map();
          let log = query.targetLogs.get(route.target);
          if (!log) { chargeAnalysis("edges"); query.targetLogs.set(route.target, log = []); }
          chargeAnalysis("edges"); log.push(route);
          for (const parent of query.parents) if (parent.fn === route.target || parent.allocation === route.target) enqueueQuery(parent, query);
        } else for (const parent of query.parents) enqueueQuery(parent, query);
      }
    };
    const routeDelta = (query, dependency, operation) => {
      chargeAnalysis("steps");
      const log = dependency.routeLog ?? [];
      if (!log.length) return [];
      query.routeCursors ??= new Map();
      let cursors = query.routeCursors.get(dependency);
      if (!cursors) { chargeAnalysis("edges"); query.routeCursors.set(dependency, cursors = new Map()); }
      const cursor = cursors.get(operation) ?? 0;
      if (!cursors.has(operation)) chargeAnalysis("edges");
      cursors.set(operation, log.length);
      chargeAnalysis("steps", log.length - cursor);
      return log.slice(cursor);
    };
    const incomingDelta = (query, dependency, target, operation) => {
      chargeAnalysis("steps");
      query.incomingCursors ??= new Map();
      const key = `${dependency.key}:${identity(target)}:${operation}`, log = dependency.targetLogs?.get(target) ?? [];
      const cursor = query.incomingCursors.get(key) ?? 0;
      if (!query.incomingCursors.has(key)) chargeAnalysis("edges");
      query.incomingCursors.set(key, log.length);
      chargeAnalysis("steps", log.length - cursor);
      return log.slice(cursor);
    };
    const unknownRoute = (query, reason, effectsRequired = true) => addRoute(query, {
      callee: query.ref ?? sourceReference(query.fn), args: query.args, receiver: query.receiver,
      cost: query.cost ?? 0, unknownReason: reason, effectsRequired,
    });
    const forwardQuery = (query, ref, ...options) => {
      const args = options.length > 0 ? options[0] : query.args;
      const cost = options.length > 1 ? options[1] : query.cost;
      const invoked = options.length > 2 ? options[2] : query.invoked;
      const receiver = options.length > 3 ? options[3] : query.receiver;
      const dependency = invocationQuery(ref, args, cost, invoked, receiver, query.expected);
      dependencyRoutes(query, dependency);
      query.invocationForwards ??= new Set();
      if (!query.invocationForwards.has(dependency)) { chargeAnalysis("edges"); query.invocationForwards.add(dependency); }
      for (const route of routeDelta(query, dependency, "invoke-forward")) addRoute(query, route);
    };
    const forwardValue = (query, ref) => {
      const dependency = valueQuery(ref);
      dependencyRoutes(query, dependency);
      query.valueForwards ??= new Set();
      if (!query.valueForwards.has(dependency)) { chargeAnalysis("edges"); query.valueForwards.add(dependency); }
      for (const route of routeDelta(query, dependency, "value-forward")) addRoute(query, route);
      inheritEffects(query, dependency);
      if (dependency.terminal && !query.terminal) { query.terminal = true; for (const parent of query.parents) enqueueQuery(parent); }
    };
    const addValue = (query, value) => {
      const node = value.node && unwrap(value.node);
      if (!value.unknownReason && !value.keys.length && (value.valueKind === "array" || node && ts.isArrayLiteralExpression(node))) {
        const elements = value.valueKind === "array" ? value.elements : referencedArguments(node.elements, value.context);
        if (elements) {
          const recipe = literalArrayContents(value, elements, query);
          if (recipe?.summarized) value = derivedReference(value.node, "array", recipe.elements, value.context, true);
        }
      }
      addRoute(query, { callee: query.ref, value, cost: 0, unknownReason: value.unknownReason });
    };
    const addEffect = (query, ref) => {
      query.effects ??= new Map();
      if (!query.effects.has(ref.id)) {
        chargeAnalysis("routes"); query.effects.set(ref.id, ref);
        query.effectLog ??= [];
        query.effectLog.push(ref);
        query.version = (query.version ?? 0) + 1;
        for (const parent of query.parents) enqueueQuery(parent, query);
      }
    };
    const inheritEffects = (query, dependency) => {
      const log = dependency.effectLog ?? [];
      if (!log.length) return;
      query.effectCursors ??= new Map();
      const cursor = query.effectCursors.get(dependency) ?? 0;
      if (!query.effectCursors.has(dependency)) chargeAnalysis("edges");
      query.effectCursors.set(dependency, log.length);
      for (let index = cursor; index < log.length; index++) { chargeAnalysis("steps"); addEffect(query, log[index]); }
    };
    const refreshForwards = (query) => {
      for (const dependency of query.invocationForwards ?? []) for (const route of routeDelta(query, dependency, "invoke-forward")) addRoute(query, route);
      for (const dependency of query.valueForwards ?? []) {
        for (const route of routeDelta(query, dependency, "value-forward")) addRoute(query, route);
        inheritEffects(query, dependency);
        if (dependency.terminal && !query.terminal) { query.terminal = true; for (const parent of query.parents) enqueueQuery(parent); }
      }
    };
    const primitiveKind = (ref) => {
      if (!ref || ref.unknownReason) return undefined;
      if (["string", "number", "boolean", "undefined", "null", "bigint"].includes(ref.valueKind)) return ref.valueKind;
      const node = ref.node && unwrap(ref.node);
      if (!node) return undefined;
      if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) return "string";
      if (ts.isNumericLiteral(node)) return "number";
      if (ts.isBigIntLiteral(node)) return "bigint";
      if ([ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(node.kind)) return "boolean";
      if (node.kind === ts.SyntaxKind.NullKeyword) return "null";
      if (ts.isIdentifier(node) && node.text === "undefined" && !binding(node)?.declarations) return "undefined";
    };
    const bindPattern = (name, ref, context, bindings) => {
      chargeAnalysis("steps");
      if (ts.isIdentifier(name)) { bindings.set(binding(name), ref); return; }
      for (const [index, entry] of name.elements.entries()) {
        if (!ts.isBindingElement(entry)) continue;
        const key = ts.isArrayBindingPattern(name) ? String(index) : entry.propertyName ? ownName(entry.propertyName) : ts.isIdentifier(entry.name) ? entry.name.text : undefined;
        let value = projectReference(ref, [key]);
        if (entry.initializer) value = defaultReference(value, initializerReference(entry.initializer, context), entry);
        bindPattern(entry.name, value, context, bindings);
      }
    };
    const refineCondition = (condition, context, truth) => {
      chargeAnalysis("steps");
      const node = unwrap(condition);
      let bindings;
      if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) return refineCondition(node.operand, context, !truth);
      if (ts.isBinaryExpression(node)) {
        if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && truth || node.operatorToken.kind === ts.SyntaxKind.BarBarToken && !truth) {
          return refineCondition(node.right, refineCondition(node.left, context, truth), truth);
        }
        const equal = [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(node.operatorToken.kind);
        const unequal = [ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(node.operatorToken.kind);
        if ((equal && truth || unequal && !truth) && ts.isTypeOfExpression(unwrap(node.left)) && ts.isStringLiteralLike(unwrap(node.right))) {
          const value = unwrap(unwrap(node.left).expression), kind = unwrap(node.right).text;
          if (ts.isIdentifier(value) && ["string", "number", "boolean", "bigint"].includes(kind) && !nonNumericWrites.has(binding(value)) && !numericAssignments.has(binding(value))) {
            bindings ??= copyBindings(context);
            bindings.set(binding(value), derivedReference(value, kind, undefined, context));
          }
        }
      }
      if (truth && ts.isCallExpression(node) && node.arguments.length === 1) {
        const member = property(node.expression), argument = unwrap(node.arguments[0]);
        if (member?.name === "isArray" && builtinNamespace(member.receiver, "Array") && !arrayIntrinsicsMutated && ts.isIdentifier(argument)) {
          const value = sourceReference(argument, context), actual = referenceNode(value);
          if (!(value.valueKind === "array" || actual && ts.isArrayLiteralExpression(actual))) {
            bindings ??= copyBindings(context);
            bindings.set(binding(argument), derivedReference(argument, "array-input", undefined, context, true));
          }
        }
      }
      return bindings ? bindingContext(context, bindings) : context;
    };
    const expandReturns = (query) => {
      const fn = query.target, context = query.context;
      if (query.cfgBuilt && [...query.loopInputs ?? []].every(([dependency, version]) => (dependency.version ?? 0) === version)) {
        for (const ref of query.returnRefs?.values() ?? []) { chargeAnalysis("steps"); forwardValue(query, ref); }
        for (const dependency of query.dependencies.keys()) { chargeAnalysis("steps"); inheritEffects(query, dependency); }
        return;
      }
      if (!fn.body || fn.asteriskToken || fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
        addValue(query, unknownReference(fn, "unsupported function body")); return;
      }
      const recordExpression = (node, scope) => {
        chargeAnalysis("steps");
        if (functionNode(node)) return;
        if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
          const member = property(node.left);
          if (member) { recordSiteScope(query, node.left, scope); addEffect(query, sourceReference(member.receiver, scope)); }
        }
        if (ts.isCallExpression(node)) {
          recordSiteScope(query, node, scope);
          for (const invocation of sourceInvocations(query, node.expression, node.arguments, scope, 0, true, true)) { chargeAnalysis("steps"); inheritEffects(query, invocation); }
        }
        ts.forEachChild(node, (child) => recordExpression(child, scope));
      };
      let pendingIteration = false;
      const returnValue = (ref) => {
        query.returnRefs ??= new Map();
        if (!query.returnRefs.has(ref.id)) { chargeAnalysis("arguments"); query.returnRefs.set(ref.id, ref); }
        forwardValue(query, ref);
      };
      const invalidateExpressionWrites = (expression, scope) => {
        let bindings;
        const invalidate = (target) => {
          chargeAnalysis("steps");
          const node = unwrap(target);
          if (ts.isIdentifier(node)) {
            bindings ??= copyBindings(scope);
            bindings.set(binding(node), unknownReference(node, "unsupported contextual binding write"));
          } else if (!property(node)) ts.forEachChild(node, invalidate);
        };
        const scan = (node) => {
          chargeAnalysis("steps");
          if (functionNode(node)) return;
          if (!query.modeledWrites?.has(node)) {
            if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) invalidate(node.left);
            if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) invalidate(node.operand);
          }
          ts.forEachChild(node, scan);
        };
        const direct = unwrap(expression);
        if (ts.isBinaryExpression(direct) && [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken].includes(direct.operatorToken.kind)) {
          scan(direct.right);
          bindings ??= copyBindings(scope);
          const state = bindingContext(scope, bindings), right = sourceReference(direct.right, state);
          const assign = (target, value) => {
            chargeAnalysis("steps");
            const node = unwrap(target);
            if (ts.isIdentifier(node)) {
              const updated = direct.operatorToken.kind === ts.SyntaxKind.EqualsToken ? value : derivedReference(direct, "alternatives", [sourceReference(node, scope), value], state, true);
              bindings.set(binding(node), updated);
            } else if (ts.isObjectLiteralExpression(node)) for (const entry of node.properties) {
              chargeAnalysis("steps");
              if (ts.isShorthandPropertyAssignment(entry)) assign(entry.name, projectReference(value, [entry.name.text]));
              else if (ts.isPropertyAssignment(entry)) assign(entry.initializer, projectReference(value, [ownName(entry.name)]));
              else invalidate(entry);
            } else if (ts.isArrayLiteralExpression(node)) for (const [index, entry] of node.elements.entries()) {
              chargeAnalysis("steps"); if (!ts.isOmittedExpression(entry)) assign(entry, projectReference(value, [String(index)]));
            } else invalidate(node);
          };
          assign(direct.left, right);
        } else scan(expression);
        return bindings ? bindingContext(scope, bindings) : scope;
      };
      const walk = (statement, scope) => {
        chargeAnalysis("steps");
        if (ts.isBlock(statement)) {
          let states = [scope];
          for (const child of statement.statements) {
            const next = [];
            for (const state of states) if (state.breakScope) next.push(state); else next.push(...walk(child, state));
            states = [...new Set(next)];
            if (!states.length) break;
          }
          return states;
        }
        if (ts.isReturnStatement(statement)) {
          if (statement.expression) {
            const value = sourceReference(statement.expression, scope);
            recordExpression(statement.expression, scope);
            invalidateExpressionWrites(statement.expression, scope);
            returnValue(value);
          }
          else addValue(query, derivedReference(statement, "undefined", undefined, scope));
          return [];
        }
        if (ts.isThrowStatement(statement)) {
          recordExpression(statement.expression, scope);
          if (!query.terminal) { query.terminal = true; for (const parent of query.parents) enqueueQuery(parent); }
          return [];
        }
        if (ts.isIfStatement(statement)) {
          recordExpression(statement.expression, scope);
          scope = invalidateExpressionWrites(statement.expression, scope);
          const condition = unwrap(statement.expression), method = ts.isCallExpression(condition) && property(condition.expression);
          if (method?.name === "isArray" && builtinNamespace(method.receiver, "Array") && !arrayIntrinsicsMutated && condition.arguments.length === 1) {
            const input = valueQuery(sourceReference(condition.arguments[0], scope));
            dependencyRoutes(query, input);
            query.loopInputs ??= new Map(); query.loopInputs.set(input, input.version ?? 0);
            if (!input.routes.size) { pendingIteration = true; return []; }
            let array = false, other = false;
            for (const route of input.routes.values()) {
              chargeAnalysis("steps");
              const value = route.value, actual = value?.node && unwrap(value.node);
              if (value && !value.unknownReason && (value.valueKind === "array" || value.valueKind === "array-input" || actual && ts.isArrayLiteralExpression(actual))) array = true;
              else if (primitiveKind(value)) other = true;
              else { array = true; other = true; }
            }
            return [...(array ? walk(statement.thenStatement, refineCondition(statement.expression, scope, true)) : []),
              ...(other ? statement.elseStatement ? walk(statement.elseStatement, refineCondition(statement.expression, scope, false)) : [refineCondition(statement.expression, scope, false)] : [])];
          }
          return [...new Set([...walk(statement.thenStatement, refineCondition(statement.expression, scope, true)),
            ...(statement.elseStatement ? walk(statement.elseStatement, refineCondition(statement.expression, scope, false)) : [refineCondition(statement.expression, scope, false)])])];
        }
        if (ts.isVariableStatement(statement)) {
          let bindings = copyBindings(scope);
          for (const declaration of statement.declarationList.declarations) {
            if (!declaration.initializer) { bindPattern(declaration.name, derivedReference(declaration, "undefined", undefined, scope), scope, bindings); continue; }
            const before = bindingContext(scope, bindings);
            let value = sourceReference(declaration.initializer, before);
            recordExpression(declaration.initializer, before);
            scope = invalidateExpressionWrites(declaration.initializer, before);
            if (scope !== before) bindings = copyBindings(scope);
            const actual = unwrap(declaration.initializer);
            if (ts.isArrayLiteralExpression(actual)) value = derivedReference(actual, "array", referencedArguments(actual.elements, scope), scope);
            bindPattern(declaration.name, value, scope, bindings);
          }
          return [bindingContext(scope, bindings)];
        }
        if (ts.isExpressionStatement(statement)) {
          const expression = unwrap(statement.expression), member = ts.isCallExpression(expression) && property(expression.expression);
          const direct = ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(expression.left);
          scope = invalidateExpressionWrites(direct ? expression.right : expression, scope);
          if (member?.name === "push") {
            const array = sourceReference(member.receiver, scope);
            if (array.valueKind === "array" && array.elements && ts.isArrayLiteralExpression(unwrap(array.node)) && ts.isIdentifier(unwrap(member.receiver))) {
              recordSiteScope(query, expression, scope);
              const args = referencedArguments(expression.arguments, scope);
              if (!args) { addValue(query, unknownReference(expression, "unknown collector arguments")); return [scope]; }
              const bindings = copyBindings(scope);
              const values = new Map();
              for (const value of [...array.elements, ...args]) { chargeAnalysis("steps"); if (!values.has(value.id)) { chargeAnalysis("arguments"); values.set(value.id, value); } }
              const updated = derivedReference(array.node, "array", [...values.values()], array.context, true);
              for (const [symbol, value] of bindings) if (value === array) bindings.set(symbol, updated);
              for (const argument of expression.arguments) recordExpression(argument, scope);
              return [bindingContext(scope, bindings)];
            }
          }
          recordExpression(expression, scope);
          if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(expression.left)) {
            const bindings = copyBindings(scope);
            bindings.set(binding(expression.left), sourceReference(expression.right, scope));
            return [bindingContext(scope, bindings)];
          }
          return [scope];
        }
        if (ts.isForOfStatement(statement) && ts.isVariableDeclarationList(statement.initializer) && statement.initializer.declarations.length === 1) {
          const receiver = valueQuery(sourceReference(statement.expression, scope));
          dependencyRoutes(query, receiver);
          query.loopInputs ??= new Map();
          query.loopInputs.set(receiver, receiver.version ?? 0);
          pendingIteration ||= !receiver.routes.size;
          const states = [];
          for (const route of receiver.routes.values()) {
            const array = route.value, node = array?.node && unwrap(array.node);
            if (!array || array.unknownReason || !["array", "array-input"].includes(array.valueKind) && !ts.isArrayLiteralExpression(node)) { addValue(query, unknownReference(statement, "unproved collector iteration")); continue; }
            const elements = ["array", "array-input"].includes(array.valueKind) ? array.elements : referencedArguments(node.elements, array.context);
            const alternatives = elements?.length ? elements : elements ? [] : [unknownReference(statement, "symbolic iteration element")];
            if (array.summarized || !elements) states.push(scope);
            if (!alternatives.length) { states.push(scope); continue; }
            for (const element of alternatives) {
              query.loopAlternatives ??= new Map();
              const key = `${identity(statement)}:${scope.id}:${array.id}:${element.id}`;
              let cached = query.loopAlternatives.get(key);
              if (!cached || cached.versions.some(([dependency, version]) => (dependency.version ?? 0) !== version)) {
                chargeAnalysis("arguments");
                const bindings = copyBindings(scope);
                bindPattern(statement.initializer.declarations[0].name, element, scope, bindings);
                const outputs = walk(statement.statement, bindingContext(scope, bindings));
                cached = { outputs, versions: [...query.loopInputs].map(([dependency]) => [dependency, dependency.version ?? 0]) };
                query.loopAlternatives.set(key, cached);
              }
              for (const state of cached.outputs) states.push(state.breakScope ?? state);
            }
          }
          return [...new Set(states)];
        }
        if (ts.isForStatement(statement) && statement.initializer && ts.isVariableDeclarationList(statement.initializer) && statement.initializer.declarations.length === 1 &&
            statement.condition && ts.isBinaryExpression(unwrap(statement.condition)) && statement.incrementor) {
          const declaration = statement.initializer.declarations[0], condition = unwrap(statement.condition), increment = unwrap(statement.incrementor);
          const symbol = ts.isIdentifier(declaration.name) && binding(declaration.name);
          if (symbol && declaration.initializer && ts.isNumericLiteral(unwrap(declaration.initializer)) &&
              [ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken].includes(condition.operatorToken.kind) &&
              (ts.isPrefixUnaryExpression(increment) || ts.isPostfixUnaryExpression(increment)) && increment.operator === ts.SyntaxKind.PlusPlusToken &&
              ts.isIdentifier(increment.operand) && binding(increment.operand) === symbol) {
            let invariant = true;
            const inspect = (node) => {
              chargeAnalysis("steps");
              if (functionNode(node)) return;
              if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
                  ts.isIdentifier(unwrap(node.left)) && (!scope.bindings?.has(binding(unwrap(node.left))) || sourceReference(unwrap(node.left), scope).valueKind !== "array")) invariant = false;
              if (ts.isBreakStatement(node) || ts.isContinueStatement(node) || ts.isTryStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) invariant = false;
              ts.forEachChild(node, inspect);
            };
            inspect(statement.statement);
            if (invariant) {
              const bindings = copyBindings(scope);
              bindings.set(symbol, derivedReference(statement, "number", undefined, scope));
              recordExpression(condition, scope);
              return [...new Set([scope, ...walk(statement.statement, bindingContext(scope, bindings))])];
            }
          }
        }
        if (ts.isForStatement(statement) && !statement.initializer && !statement.condition && !statement.incrementor) {
          let invariant = true, exits = false;
          const bindings = copyBindings(scope);
          const inspect = (node) => {
            chargeAnalysis("steps");
            if (functionNode(node)) return;
            if (ts.isBreakStatement(node)) exits = true;
            if (ts.isTryStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node) || ts.isContinueStatement(node) || ts.isForStatement(node) || ts.isForOfStatement(node)) invariant = false;
            if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
              const target = unwrap(node.left);
              if (!ts.isIdentifier(target) || ![ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken].includes(node.operatorToken.kind)) invariant = false;
              else if (node.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken) bindings.set(binding(target), derivedReference(node, "number", undefined, scope));
              else {
                const left = valueQuery(sourceReference(target, scope)), right = valueQuery(sourceReference(node.right, scope));
                dependencyRoutes(query, left); dependencyRoutes(query, right);
                query.loopInputs ??= new Map(); query.loopInputs.set(left, left.version ?? 0); query.loopInputs.set(right, right.version ?? 0);
                if (!left.routes.size || !right.routes.size) pendingIteration = true;
                if (!left.routes.size || !right.routes.size || [...left.routes.values(), ...right.routes.values()].some((route) => primitiveKind(route.value) !== "number")) invariant = false;
                else bindings.set(binding(target), derivedReference(node, "number", undefined, scope));
              }
            }
            ts.forEachChild(node, inspect);
          };
          inspect(statement.statement);
          if (invariant && exits) {
            query.modeledWrites ??= new Set();
            const retain = (node) => { chargeAnalysis("steps"); if (functionNode(node)) return; if (ts.isBinaryExpression(node) && [ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken].includes(node.operatorToken.kind)) { chargeAnalysis("arguments"); query.modeledWrites.add(node); } ts.forEachChild(node, retain); };
            retain(statement.statement);
            return [...new Set([scope, ...walk(statement.statement, bindingContext(scope, bindings)).map((state) => state.breakScope ?? state)])];
          }
          if (pendingIteration) return [];
        }
        if (ts.isBreakStatement(statement)) {
          if (statement.label) { addValue(query, unknownReference(statement, "unsupported labelled loop exit")); return []; }
          chargeAnalysis("arguments"); return [{ breakScope: scope }];
        }
        if (ts.isEmptyStatement(statement) || functionNode(statement) || ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) return [scope];
        recordExpression(statement, scope);
        addValue(query, unknownReference(statement, "unsupported normal-return control flow"));
        return [scope];
      };
      if (!ts.isBlock(fn.body)) { recordExpression(fn.body, context); returnValue(sourceReference(fn.body, context)); query.cfgBuilt = true; return; }
      for (const state of walk(fn.body, context)) addValue(query, state.breakScope ? unknownReference(fn, "unclosed loop exit") : derivedReference(fn, "undefined", undefined, state));
      query.cfgBuilt = !pendingIteration;
    };
    const expandSourceValue = (query) => {
      const ref = query.ref;
      if (ref.unknownReason || !ref.node) { addValue(query, ref.unknownReason ? ref : unknownReference(ref.node, "missing value source")); return; }
      if (ref.valueKind) {
        if (ref.valueKind === "initializer") { forwardValue(query, sourceReference(ref.node, ref.context)); return; }
        if (ref.valueKind === "default") {
          const value = valueQuery(ref.value);
          dependencyRoutes(query, value);
          for (const route of routeDelta(query, value, "default-values")) if (route.value) {
            if (primitiveKind(route.value) === "undefined") forwardValue(query, ref.fallback);
            else { forwardValue(query, route.value); if (route.unknownReason) forwardValue(query, ref.fallback); }
          }
          return;
        }
        if (ref.valueKind === "accessor-value") {
          const body = accessorReturns(ref, query);
          for (const route of routeDelta(query, body, "accessor-normal-values")) if (route.value) addValue(query, ref);
          inheritEffects(query, body);
          return;
        }
        if (ref.valueKind === "own-field") {
          const field = fieldQuery(ref.fieldBase, ref.fieldName, ref.readSite);
          dependencyRoutes(query, field);
          for (const route of routeDelta(query, field, "own-field-values")) if (route.value) forwardValue(query, route.value);
          inheritEffects(query, field);
          return;
        }
        if (ref.valueKind === "alternatives") { for (const value of ref.elements) { chargeAnalysis("steps"); forwardValue(query, value); } return; }
        addValue(query, ref);
        return;
      }
      const node = unwrap(ref.node);
      if (!ref.keys.length && ts.isArrayLiteralExpression(node) && node.elements.some(ts.isSpreadElement)) {
        let changed = !query.spreadParts;
        if (!query.spreadParts) {
          chargeAnalysis("arguments", node.elements.length + 1);
          query.spreadParts = node.elements.map((entry) => ({ entry, alternatives: new Map() }));
        }
        for (const part of query.spreadParts) {
          chargeAnalysis("steps");
          const entry = part.entry;
          if (ts.isOmittedExpression(entry)) { addValue(query, unknownReference(entry, "sparse array spread")); continue; }
          const include = (values, summarized = false) => {
            const vector = argumentVector(values);
            const key = `${vector.id}:${+summarized}`;
            if (!part.alternatives.has(key)) {
              chargeAnalysis("arguments"); part.alternatives.set(key, { elements: vector.values, summarized }); changed = true;
            }
          };
          if (!ts.isSpreadElement(entry)) { include([sourceReference(entry, ref.context)]); continue; }
          const input = valueQuery(sourceReference(entry.expression, ref.context));
          dependencyRoutes(query, input);
          for (const route of routeDelta(query, input, `array-spread:${identity(entry)}`)) {
            if (!route.value || !pristineArrayReference(route.value)) { addValue(query, unknownReference(entry, "unproved spread allocation")); continue; }
            const values = route.value.valueKind === "array" ? route.value.elements : referencedArguments(unwrap(route.value.node).elements, route.value.context);
            if (!values) { addValue(query, unknownReference(entry, "unproved spread elements")); continue; }
            include(values, route.value.summarized);
          }
        }
        if (!changed) { for (const value of query.spreadValues ?? []) addValue(query, value); return; }
        if (query.spreadParts.some((part) => !part.alternatives.size)) return;
        let vectors = [{ elements: [], summarized: false }];
        for (const part of query.spreadParts) {
          const next = [];
          for (const prefix of vectors) for (const suffix of part.alternatives.values()) {
            chargeAnalysis("steps", prefix.elements.length + suffix.elements.length + 1);
            chargeAnalysis("arguments"); next.push({ elements: [...prefix.elements, ...suffix.elements], summarized: prefix.summarized || suffix.summarized });
          }
          vectors = next;
        }
        query.spreadValues = vectors.map((values) => derivedReference(node, "array", values.elements, ref.context, values.summarized));
        for (const value of query.spreadValues) addValue(query, value);
        return;
      }
      if (ref.keys.length) {
        const base = valueQuery(ref.base ?? sourceReference(ref.node, ref.context));
        dependencyRoutes(query, base);
        for (const route of routeDelta(query, base, "projection")) {
          let value = route.value;
          for (const [position, key] of ref.keys.entries()) {
            chargeAnalysis("steps");
            if (!value || value.unknownReason) break;
            if (primitiveKind(value)) {
              value = key === "length" && primitiveKind(value) === "string" ? derivedReference(ref.node, "number", undefined, ref.context) : unknownReference(ref.node, "unproved primitive own-field projection");
              continue;
            }
            const object = value.node && unwrap(value.node);
            if (object && ts.isObjectLiteralExpression(object)) {
              value = projectReference(fieldReference(value, key, ref.node), ref.keys.slice(position + 1));
              break;
            }
            const entry = object && ownMember(object, key);
            if (value.valueKind === "array" && value.summarized && /^(0|[1-9][0-9]*)$/.test(key ?? "")) {
              chargeAnalysis("steps", (value.elements?.length ?? 0) + ref.keys.length + 1); chargeAnalysis("arguments", (value.elements?.length ?? 0) + 1);
              const choices = [derivedReference(ref.node, "undefined", undefined, value.context), ...value.elements ?? [unknownReference(ref.node, "unproved positional array recipe")]];
              value = projectReference(derivedReference(ref.node, "alternatives", choices, value.context, true), ref.keys.slice(position + 1));
              break;
            }
            else if (entry) value = sourceReference(entry, value.context);
            else if ((value.valueKind === "array" || object && ts.isArrayLiteralExpression(object)) && /^(0|[1-9][0-9]*)$/.test(key ?? "")) value = value.elements?.[+key] ?? derivedReference(ref.node, "undefined", undefined, value.context);
            else if (key === "length" && (value.valueKind === "array" || object && (ts.isArrayLiteralExpression(object) || ts.isStringLiteralLike(object)))) value = derivedReference(ref.node, "number", undefined, ref.context);
            else value = unknownReference(ref.node, "unproved own data field");
          }
          if (value) forwardValue(query, value);
        }
        return;
      }
      if (ts.isConditionalExpression(node)) {
        const context = ref.context;
        forwardValue(query, sourceReference(node.whenTrue, context ? refineCondition(node.condition, context, true) : undefined));
        forwardValue(query, sourceReference(node.whenFalse, context ? refineCondition(node.condition, context, false) : undefined)); return;
      }
      if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
        forwardValue(query, sourceReference(node.left, ref.context));
        forwardValue(query, sourceReference(node.right, ref.context && node.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken ?
          refineCondition(node.left, ref.context, node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) : ref.context)); return;
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) { forwardValue(query, sourceReference(node.right, ref.context)); return; }
      if (ts.isIdentifier(node)) {
        if (node.text === "undefined" && !binding(node)?.declarations) { addValue(query, derivedReference(node, "undefined", undefined, ref.context)); return; }
        const symbol = binding(node), declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
        const imported = runtimeImportTargets(declaration);
        if (imported) {
          if (!imported.length) addValue(query, unknownReference(node, "unresolved runtime import"));
          for (const target of imported) forwardValue(query, sourceReference(ts.isVariableDeclaration(target) || ts.isBindingElement(target) ? target.name : target, ref.context));
          return;
        }
        if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
          forwardValue(query, sourceReference(declaration.initializer, ref.context));
          for (const write of bindingWrites(declaration)) {
            chargeAnalysis("steps");
            const assignment = write.parent;
            if (ts.isIdentifier(write) && ts.isBinaryExpression(assignment) && assignment.left === write && assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken) forwardValue(query, sourceReference(assignment.right, ref.context));
            else addValue(query, unknownReference(write, "unsupported binding write"));
          }
          return;
        }
        if (declaration && ts.isVariableDeclaration(declaration) && ts.isVariableDeclarationList(declaration.parent) && ts.isForOfStatement(declaration.parent.parent)) {
          const loop = declaration.parent.parent, iterable = valueQuery(sourceReference(loop.expression, ref.context));
          dependencyRoutes(query, iterable);
          for (const route of routeDelta(query, iterable, "binding-iteration-elements")) {
            const array = route.value;
            if (!array || !pristineArrayReference(array)) { addValue(query, unknownReference(node, "unproved binding iteration")); continue; }
            const elements = array.valueKind === "array" ? array.elements : referencedArguments(unwrap(array.node).elements, array.context);
            if (!elements) { addValue(query, unknownReference(node, "unknown binding iteration elements")); continue; }
            if (!elements.length) query.terminal = true;
            for (const element of elements) { chargeAnalysis("steps"); forwardValue(query, element); }
          }
          return;
        }
        const path = parameterPath(node);
        if (path) {
          const incoming = incomingQuery(path.declaration.parent);
          dependencyRoutes(query, incoming);
          for (const route of routeDelta(query, incoming, "parameter-value")) {
            const index = path.declaration.parent.parameters.indexOf(path.declaration);
            if (!route.args) { addValue(query, unknownReference(node, "unknown incoming value")); continue; }
            const supplied = parameterArgument(path.declaration, index, route.args, route.closure, callContext(path.declaration.parent, route.args, route.receiver, route.closure, route.cost, route.call));
            if (supplied) forwardValue(query, parameterProjection(node, supplied, callContext(path.declaration.parent, route.args, route.receiver, route.closure, route.cost, route.call)));
            if ((!supplied || !nonUndefinedArgument(supplied.node)) && path.declaration.initializer) forwardValue(query, sourceReference(path.declaration.initializer, route.closure, path.keys));
            else if (!supplied) addValue(query, derivedReference(node, "undefined", undefined, route.closure));
          }
          return;
        }
        if (functionNode(declaration)) { addValue(query, sourceReference(declaration, ref.context)); return; }
        if (declaration && ts.isBindingElement(declaration)) {
          const member = bindingMember(declaration);
          if (member) {
            let value = projectReference(sourceReference(member.receiver, ref.context), [member.name]);
            if (declaration.initializer) value = defaultReference(value, initializerReference(declaration.initializer, ref.context), declaration);
            forwardValue(query, value);
            for (const write of bindingWrites(declaration)) {
              chargeAnalysis("steps");
              const assignment = write.parent;
              if (ts.isIdentifier(write) && ts.isBinaryExpression(assignment) && assignment.left === write && assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken) forwardValue(query, sourceReference(assignment.right, ref.context));
              else addValue(query, unknownReference(write, "unsupported binding write"));
            }
            return;
          }
        }
        addValue(query, unknownReference(node, "unresolved value binding")); return;
      }
      if (ts.isTemplateExpression(node) || ts.isTypeOfExpression(node)) { addValue(query, derivedReference(node, "string", undefined, ref.context)); return; }
      if (ts.isPrefixUnaryExpression(node) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken, ts.SyntaxKind.TildeToken].includes(node.operator) ||
          ts.isBinaryExpression(node) && numericOperators.has(node.operatorToken.kind)) {
        addValue(query, derivedReference(node, "number", undefined, ref.context)); return;
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const left = valueQuery(sourceReference(node.left, ref.context)), right = valueQuery(sourceReference(node.right, ref.context));
        dependencyRoutes(query, left); dependencyRoutes(query, right);
        for (const a of left.routes.values()) for (const b of right.routes.values()) {
          const l = primitiveKind(a.value), r = primitiveKind(b.value);
          if (l === "number" && r === "number") addValue(query, derivedReference(node, "number", undefined, ref.context));
          else if (l === "string" && r || r === "string" && l) addValue(query, derivedReference(node, "string", undefined, ref.context));
          else addValue(query, unknownReference(node, "unproved addition coercion"));
        }
        return;
      }
      if (ts.isVoidExpression(node) || node.kind === ts.SyntaxKind.ThisKeyword) {
        if (ts.isVoidExpression(node)) addValue(query, derivedReference(node, "undefined", undefined, ref.context));
        else {
          let scope = ref.context;
          while (scope && ts.isArrowFunction(scope.fn)) scope = scope.closure;
          if (scope?.receiver) forwardValue(query, scope.receiver); else addValue(query, unknownReference(node, "unproved receiver"));
        }
        return;
      }
      if (ts.isElementAccessExpression(node) && staticKey(node.argumentExpression) === undefined) {
        const receiver = valueQuery(sourceReference(node.expression, ref.context)), selector = valueQuery(sourceReference(node.argumentExpression, ref.context));
        dependencyRoutes(query, receiver); dependencyRoutes(query, selector);
        for (const route of receiver.routes.values()) for (const selected of selector.routes.values()) {
          chargeAnalysis("steps");
          const array = route.value, allocation = array && allocationIdentity(array), index = selected.value;
          const heap = array && allocation && heapQuery(array);
          if (heap) dependencyRoutes(query, heap, true);
          if (!array || !pristineArrayReference(array) || !allocation || index?.indexAllocation !== allocation || heap?.routes.size) { addValue(query, unknownReference(node, "unproved indexed element range")); continue; }
          const elements = array.valueKind === "array" ? array.elements : referencedArguments(unwrap(array.node).elements, array.context);
          for (const element of elements ?? [unknownReference(node, "unproved indexed elements")]) { chargeAnalysis("steps"); forwardValue(query, element); }
        }
        return;
      }
      const member = property(node);
      if (member) { forwardValue(query, projectReference(sourceReference(member.receiver, ref.context), [member.name])); return; }
      if (ts.isCallExpression(node)) {
        const method = property(origin(node.expression));
        const callee = origin(node.expression);
        if (ts.isIdentifier(callee) && callee.text === "Number" && globalReference(callee) && ![...provenance(callee)].some((root) => mutatedRoots.has(root))) {
          for (const argument of node.arguments) dependencyRoutes(query, valueQuery(sourceReference(argument, ref.context)), true);
          addValue(query, derivedReference(node, "number", undefined, ref.context)); return;
        }
        if (method?.name === "freeze" && builtinNamespace(method.receiver, "Object") && node.arguments[0]) { forwardValue(query, sourceReference(node.arguments[0], ref.context)); return; }
        if (method && ["some", "every", "filter", "map", "flatMap", "sort", "entries", "from"].includes(method.name)) {
          const native = nativeCallbackQueries(query, node, ref.context);
          if (native) {
            dependencyRoutes(query, native.receiver);
            query.nativeReturnDependencies ??= new Map();
            for (const entry of native.callbacks) {
              dependencyRoutes(query, entry.query);
              for (const route of routeDelta(query, entry.query, "native-return-target")) {
                if (route.unknownReason || !functionNode(route.target)) { addValue(query, unknownReference(node, "unproved native callback target")); continue; }
                const body = returnQuery(route.target, callContext(route.target, route.args, route.receiver, route.closure, route.cost, node));
                dependencyRoutes(query, body);
                if (!query.nativeReturnDependencies.has(body)) { chargeAnalysis("arguments"); query.nativeReturnDependencies.set(body, entry.array); }
              }
            }
            const values = [];
            for (const [body] of query.nativeReturnDependencies) {
              inheritEffects(query, body);
              for (const route of routeDelta(query, body, "native-mapped-values")) {
                if (method.name === "flatMap") {
                  const value = route.value, actual = value?.node && unwrap(value.node);
                  if (value?.valueKind === "array") values.push(...value.elements ?? []);
                  else if (actual && ts.isArrayLiteralExpression(actual)) values.push(...referencedArguments(actual.elements, value.context) ?? []);
                  else if (value) values.push(value);
                } else if (route.value) values.push(route.value);
              }
            }
            query.mappedValues ??= new Map();
            for (const value of values) if (!query.mappedValues.has(value.id)) { chargeAnalysis("arguments"); query.mappedValues.set(value.id, value); }
            for (const route of native.receiver.routes.values()) { chargeAnalysis("steps"); if (route.unknownReason || native.unprovedReceivers.has(route.value?.id ?? 0)) addValue(query, unknownReference(node, "unproved native return receiver")); }
            for (const value of native.arrays.values()) {
              if (!pristineArrayReference(value)) { addValue(query, unknownReference(node, "unproved native return receiver")); continue; }
              query.nativeArrays ??= new Map();
              if (!query.nativeArrays.has(value.id)) { chargeAnalysis("arguments"); query.nativeArrays.set(value.id, value); }
            }
            for (const array of query.nativeArrays?.values() ?? []) {
              const elements = array.valueKind === "array" ? array.elements : referencedArguments(unwrap(array.node).elements, array.context);
              if (method.name === "sort") addValue(query, derivedReference(array.node, "array", elements, array.context, true));
              else if (method.name === "filter") {
                let pending = false, allTrue = !array.summarized, found = !elements.length;
                for (const [body, input] of query.nativeReturnDependencies) if (input === array) {
                  chargeAnalysis("steps"); found = true;
                  if (!body.cfgBuilt || !body.routes.size) pending = true;
                  for (const value of body.returnRefs?.values() ?? []) {
                    chargeAnalysis("steps");
                    const returned = valueQuery(value);
                    dependencyRoutes(query, returned);
                    if (!returned.routes.size) pending = true;
                  }
                  for (const route of body.routes.values()) {
                    chargeAnalysis("steps");
                    if (!route.value || route.unknownReason || unwrap(route.value.node).kind !== ts.SyntaxKind.TrueKeyword) allTrue = false;
                  }
                }
                const heap = heapQuery(array);
                if (heap) { dependencyRoutes(query, heap, true); if (heap.routes.size) allTrue = false; }
                if (pending || !found) continue;
                addValue(query, derivedReference(node, "array", elements, ref.context, !allTrue));
              }
              else if (method.name === "from" && !node.arguments[1]) addValue(query, derivedReference(node, "array", elements, ref.context, array.summarized));
              else if (["some", "every"].includes(method.name)) addValue(query, derivedReference(node, "boolean", undefined, ref.context));
              else if (method.name === "entries") {
                const index = derivedReference(node, "number", undefined, ref.context);
                addValue(query, derivedReference(node, "iterator", elements.map((element) => derivedReference(node, "array", [index, element], ref.context)), ref.context));
              } else if (!elements.length || query.mappedValues.size) addValue(query, derivedReference(node, "array", [...query.mappedValues.values()], ref.context, true));
            }
            return;
          }
        }
        if (method && ["split", "charAt", "charCodeAt", "includes", "localeCompare", "startsWith", "endsWith", "slice", "substring", "toLowerCase", "toUpperCase", "trim"].includes(method.name)) {
          const receiver = valueQuery(sourceReference(method.receiver, ref.context));
          dependencyRoutes(query, receiver);
          for (const route of receiver.routes.values()) {
            if (method.name === "includes" && route.value && pristineArrayReference(route.value)) {
              addValue(query, derivedReference(node, "boolean", undefined, ref.context)); continue;
            }
            if (primitiveKind(route.value) !== "string" || arrayIntrinsicsMutated) { addValue(query, unknownReference(node, "unproved String dispatch")); continue; }
            const argumentsQueries = node.arguments.map((argument) => valueQuery(sourceReference(argument, ref.context)));
            for (const argument of argumentsQueries) dependencyRoutes(query, argument);
            if (argumentsQueries.some((argument) => !argument.routes.size)) continue;
            if (argumentsQueries.some((argument) => [...argument.routes.values()].some((entry) => !primitiveKind(entry.value)))) { addValue(query, unknownReference(node, "unproved String coercion")); continue; }
            if (method.name === "split") {
              const element = derivedReference(node, "string", undefined, ref.context);
              addValue(query, derivedReference(node, "array", [element], ref.context, true));
            } else addValue(query, derivedReference(node, ["localeCompare", "charCodeAt"].includes(method.name) ? "number" : ["includes", "startsWith", "endsWith"].includes(method.name) ? "boolean" : "string", undefined, ref.context));
          }
          return;
        }
        for (const invocation of sourceInvocations(query, node.expression, node.arguments, ref.context)) {
        chargeAnalysis("steps");
        for (const route of routeDelta(query, invocation, "return-target")) {
          if (route.unknownReason || !functionNode(route.target)) { addValue(query, unknownReference(node, route.unknownReason ?? "unproved return target")); continue; }
          if (route.bound) { addValue(query, boundReference(route, node)); continue; }
          const context = callContext(route.target, route.args, route.receiver, route.closure, route.cost, node);
          const returns = returnQuery(route.target, context);
          dependencyRoutes(query, returns);
          query.returnDependencies ??= new Set();
          if (!query.returnDependencies.has(returns)) { chargeAnalysis("arguments"); query.returnDependencies.add(returns); }
        }
        }
        for (const returns of query.returnDependencies ?? []) {
          for (const value of routeDelta(query, returns, "return-values")) addRoute(query, value);
          inheritEffects(query, returns);
          if (returns.terminal && !query.terminal) { query.terminal = true; for (const parent of query.parents) enqueueQuery(parent); }
        }
        return;
      }
      addValue(query, ref);
    };
    const nativeArrayOperations = new Set(["some", "every", "filter", "map", "flatMap", "sort", "forEach"]);
    const definingWrites = new Map(), declarationWrites = new WeakMap();
    const writesInUnit = (file) => {
      let writes = definingWrites.get(file);
      if (writes) return writes;
      writes = [];
      const scan = (node) => {
        chargeAnalysis("steps");
        const target = ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment ? node.left
          : ts.isDeleteExpression(node) ? node.expression
          : (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator) ? node.operand
          : (ts.isForOfStatement(node) || ts.isForInStatement(node)) && !ts.isVariableDeclarationList(node.initializer) ? node.initializer : undefined;
        if (target) { chargeAnalysis("arguments"); writes.push(target); }
        ts.forEachChild(node, scan);
      };
      scan(file); definingWrites.set(file, writes); return writes;
    };
    const bindingWrites = (declaration) => {
      if (declarationWrites.has(declaration)) return declarationWrites.get(declaration);
      const symbol = binding(declaration.name), result = [];
      const matches = (target) => {
        chargeAnalysis("steps");
        if (ts.isIdentifier(target)) return binding(target) === symbol;
        if (property(target)) return false;
        let found = false;
        ts.forEachChild(target, (child) => { if (matches(child)) found = true; });
        return found;
      };
      for (const write of writesInUnit(declaration.getSourceFile())) if (matches(write)) { chargeAnalysis("arguments"); result.push(write); }
      chargeAnalysis("arguments"); declarationWrites.set(declaration, result); return result;
    };
    const nonlocalWrites = new WeakMap();
    const nonlocalBindingWrites = (declaration) => {
      if (nonlocalWrites.has(declaration)) return nonlocalWrites.get(declaration);
      const owner = lexicalOwner(declaration);
      let result = false;
      for (const write of bindingWrites(declaration)) { chargeAnalysis("steps"); if (lexicalOwner(write) !== owner) result = true; }
      chargeAnalysis("arguments"); nonlocalWrites.set(declaration, result); return result;
    };
    const contentProperty = (input) => {
      let node = input;
      while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) {
        chargeAnalysis("steps"); node = node.expression;
      }
      chargeAnalysis("steps");
      if (ts.isPropertyAccessExpression(node)) return { receiver: node.expression, name: node.name.text };
      if (ts.isElementAccessExpression(node)) return { receiver: node.expression, name: ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : ts.isNumericLiteral(node.argumentExpression) ? String(Number(node.argumentExpression.text)) : undefined };
    };
    let arrayContentSummaries = new Map();
    const literalArrayContents = (ref, elements, query) => {
      if (!elements) { addValue(query, unknownReference(ref.node, "unproved array contents")); return undefined; }
      const heap = heapQuery(ref);
      if (!heap) return { elements, summarized: ref.summarized };
      dependencyRoutes(query, heap, true);
      if (!heap.routes.size) return { elements, summarized: Boolean(ref.summarized) };
      chargeAnalysis("steps");
      const key = `${ref.id}:${heap.allocation.id}`;
      let summary = arrayContentSummaries.get(key);
      if (!summary) {
        chargeAnalysis("arguments", 2);
        const values = new Map();
        for (const value of elements) { chargeAnalysis("steps"); if (!values.has(value.id)) { chargeAnalysis("arguments"); values.set(value.id, value); } }
        arrayContentSummaries.set(key, summary = { values, cursor: 0 });
      }
      const log = heap.routeLog ?? [];
      for (let index = summary.cursor; index < log.length; index++) {
        chargeAnalysis("steps");
        const route = log[index];
        for (const value of argumentValues(route.args)) {
          chargeAnalysis("steps"); if (!summary.values.has(value.id)) { chargeAnalysis("arguments"); summary.values.set(value.id, value); }
        }
      }
      if (summary.cursor !== log.length || !summary.snapshot) {
        summary.cursor = log.length;
        chargeAnalysis("steps", summary.values.size + 1); chargeAnalysis("arguments", summary.values.size + 1);
        summary.snapshot = { elements: [...summary.values.values()], summarized: true };
      }
      return summary.snapshot;
    };
    const expandArguments = (query) => {
      query.parts ??= query.argumentNodes.map((node) => ({ node, alternatives: new Map() }));
      for (const part of query.parts) {
        chargeAnalysis("steps");
        const include = (args) => {
          const vector = argumentVector(args);
          if (!part.alternatives.has(vector.id)) { chargeAnalysis("arguments"); part.alternatives.set(vector.id, vector.values); }
        };
        if (!ts.isSpreadElement(part.node)) { include([sourceReference(part.node, query.context)]); continue; }
        const spread = valueQuery(sourceReference(part.node.expression, query.context));
        dependencyRoutes(query, spread);
        for (const route of routeDelta(query, spread, `arguments-spread:${identity(part.node)}`)) {
          const ref = route.value, node = ref?.node && unwrap(ref.node);
          const values = ref?.valueKind === "array" ? ref.elements : node && ts.isArrayLiteralExpression(node) ? referencedArguments(node.elements, ref.context, query.depth + 1) : undefined;
          include(ref && pristineArrayReference(ref) && values && !ref.summarized ? values : unknownArguments(part.node, values ?? [], [], !values));
        }
      }
      if (query.parts.some((part) => !part.alternatives.size)) return;
      let sequences = [[]];
      for (const part of query.parts) {
        chargeAnalysis("steps"); const next = [];
        for (const prefix of sequences) for (const suffix of part.alternatives.values()) { chargeAnalysis("steps"); next.push(concatArguments(prefix, suffix, part.node)); }
        sequences = next;
      }
      for (const args of sequences) { chargeAnalysis("steps"); addRoute(query, { callee: query.ref, args, cost: 0 }); }
    };
    const expandHeapDiscovery = (query) => {
      if (!query.initialized) {
        query.initialized = true;
        dependencyRoutes(query, discoveryQuery(), true);
        for (const call of completeCallsites()) {
          chargeAnalysis("steps");
          const member = contentProperty(call.expression);
          if (member && ["push", "unshift", "splice", "sort", "reverse", "pop", "shift", "fill", "copyWithin", undefined].includes(member.name)) dependencyRoutes(query, heapMutationQuery(call), true);
        }
        for (const unit of runtimeUnits) for (const target of writesInUnit(unit.source)) {
          chargeAnalysis("steps"); if (contentProperty(target)) dependencyRoutes(query, fieldMutationQuery(target), true);
        }
      }
      for (const dependency of query.changedDependencies ?? []) {
        chargeAnalysis("steps");
        if (dependency.discoveryQuery) continue;
        for (const route of routeDelta(query, dependency, "heap-mutation-union")) addRoute(query, route);
      }
      query.changedDependencies?.clear();
    };
    const scopesForCall = (query, call, operation) => {
      const owner = lexicalOwner(call);
      if (!owner) return [undefined];
      query.scopedCalls ??= new Map();
      let state = query.scopedCalls.get(call);
      if (!state) { chargeAnalysis("arguments", 3); query.scopedCalls.set(call, state = { bodies: new Map(), scopes: new Set() }); }
      const incoming = incomingQuery(owner);
      dependencyRoutes(query, incoming, true);
      for (const route of routeDelta(query, incoming, `scoped-incoming:${operation}:${identity(call)}`)) {
        const body = returnQuery(owner, callContext(owner, route.args, route.receiver, route.closure, route.cost, route.call));
        dependencyRoutes(query, body, true);
        if (!state.bodies.has(body)) { chargeAnalysis("edges"); state.bodies.set(body, -1); }
      }
      for (const [body, cursor] of state.bodies) {
        chargeAnalysis("steps");
        const log = body.callScopeLogs?.get(call) ?? [];
        for (let index = Math.max(0, cursor); index < log.length; index++) {
          const scope = log[index];
          chargeAnalysis("steps"); if (!state.scopes.has(scope)) { chargeAnalysis("arguments"); state.scopes.add(scope); }
        }
        state.bodies.set(body, log.length);
      }
      return state.scopes;
    };
    const expandHeapMutation = (query) => {
      const call = query.call, member = contentProperty(call.expression), owner = lexicalOwner(call);
      query.scopes ??= new Set(); query.bodies ??= new Set(); query.receivers ??= new Map();
      if (!owner) query.scopes.add(undefined);
      else {
        const incoming = incomingQuery(owner);
        dependencyRoutes(query, incoming, true);
        for (const route of routeDelta(query, incoming, "heap-owner-incoming")) {
          const body = returnQuery(owner, callContext(owner, route.args, route.receiver, route.closure, route.cost, route.call));
          dependencyRoutes(query, body, true);
          if (!query.bodies.has(body)) { chargeAnalysis("edges"); query.bodies.add(body); }
        }
        for (const body of query.bodies) for (const scope of body.callContexts?.get(call) ?? []) {
          chargeAnalysis("steps"); if (!query.scopes.has(scope)) { chargeAnalysis("arguments"); query.scopes.add(scope); }
        }
      }
      for (const scope of query.scopes) {
        chargeAnalysis("steps");
        const receiver = valueQuery(sourceReference(member.receiver, scope));
        dependencyRoutes(query, receiver, true);
        if (!query.receivers.has(receiver)) { chargeAnalysis("edges"); query.receivers.set(receiver, scope); }
      }
      query.receiverValues ??= new Map();
      for (const [receiver, scope] of query.receivers) {
        chargeAnalysis("steps");
        let values = query.receiverValues.get(receiver);
        if (!values) { chargeAnalysis("arguments"); query.receiverValues.set(receiver, values = new Map()); }
        for (const route of routeDelta(query, receiver, "heap-receivers")) if (route.value && allocationIdentity(route.value)) { chargeAnalysis("arguments"); values.set(route.value.id, route.value); }
        let sequences;
        if (["push", "unshift"].includes(member.name)) {
          const exact = hasSpread(call.arguments) ? undefined : referencedArguments(call.arguments, scope);
          if (exact) sequences = [exact];
          else {
            validateSpreadDepth(call.arguments, scope);
            const payload = argumentsQuery(call.arguments, scope, 0);
            dependencyRoutes(query, payload, true);
            sequences = [];
            for (const route of payload.routes.values()) { chargeAnalysis("steps"); sequences.push(argumentValues(route.args)); }
          }
        } else sequences = [[...(["sort", "reverse", "pop", "shift"].includes(member.name) ? [] : [unknownReference(call, "unsupported array content mutation")])]];
        for (const value of values.values()) for (const args of sequences) {
          chargeAnalysis("steps");
          addRoute(query, { target: allocationIdentity(value), callee: sourceReference(member.receiver, scope), args, cost: 0, call });
        }
      }
    };
    const expandHeap = (query) => {
      const discovery = heapDiscoveryQuery();
      dependencyRoutes(query, discovery, true);
      for (const route of incomingDelta(query, discovery, query.allocation, "allocation-effects")) { chargeAnalysis("steps"); addRoute(query, route); }
    };
    const expandFieldMutation = (query) => {
      const target = query.call, member = contentProperty(target), assignment = target.parent;
      const global = globalLiteralOrigin(member.receiver);
      if (global && lexicalOwner(target)) {
        const ref = sourceReference(global), allocation = allocationIdentity(ref);
        const values = ts.isBinaryExpression(assignment) && assignment.left === target && assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken ? [sourceReference(assignment.right)] : [unknownReference(target, "unproved global own-field update")];
        addRoute(query, { target: allocation, callee: ref, args: values, cost: 0, call: target, fieldWrite: true, fieldName: member.name });
      }
      for (const scope of scopesForCall(query, target, "field-write")) {
        chargeAnalysis("steps");
        const receiver = valueQuery(sourceReference(member.receiver, scope));
        dependencyRoutes(query, receiver, true);
        for (const ref of allocationValues(query, receiver, `field-receivers:${scope?.id ?? 0}`)) {
          const allocation = allocationIdentity(ref);
          if (!allocation) continue;
          const values = ts.isBinaryExpression(assignment) && assignment.left === target ? [sourceReference(assignment.right, scope)] : [unknownReference(target, "unsupported own-field update")];
          if (ts.isBinaryExpression(assignment) && assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken) values.push(unknownReference(target, "unsupported own-field assignment operator"));
          addRoute(query, { target: allocation, callee: ref, args: values, cost: 0, call: target, fieldWrite: true, fieldName: member.name });
        }
      }
    };
    const expandField = (query) => {
      const ref = query.ref, object = unwrap(ref.node), name = query.fieldName;
      if (!query.fieldSeedBuilt) {
        query.fieldSeedBuilt = true;
        chargeAnalysis("steps", object.properties.length * 2 + 1);
        const own = ownMember(object, name);
        if (own) forwardValue(query, sourceReference(own, ref.context));
        else {
          let member;
          for (const entry of object.properties) { chargeAnalysis("steps"); if (!ts.isSpreadAssignment(entry) && ownName(entry.name) === name) member = entry; }
          if (member && ts.isMethodDeclaration(member)) addValue(query, sourceReference(member, ref.context));
          else addValue(query, member && ts.isGetAccessorDeclaration(member) ? accessorReference(ref, member, query.readSite) : derivedReference(ref.node, "undefined", undefined, ref.context));
        }
      }
      const heap = heapQuery(ref);
      if (!heap) return;
      dependencyRoutes(query, heap, true);
      for (const route of routeDelta(query, heap, "field-values")) {
        chargeAnalysis("steps");
        if (route.fieldWrite && (route.fieldName === name || route.fieldName === undefined)) for (const value of argumentValues(route.args)) { chargeAnalysis("steps"); forwardValue(query, value); }
      }
    };
    const expandAccessorExecution = (query) => {
      const ref = query.ref;
      addRoute(query, { target: ref.node, callee: sourceReference(ref.node, ref.context), args: [], receiver: ref.receiver, closure: lexicalClosure(ref.node, ref.context), cost: 0, call: ref.readSite });
    };
    const expandClobber = (query) => {
      const value = valueQuery(query.ref);
      dependencyRoutes(query, value, true);
      query.clobberSources ??= new Set([value]); query.clobberValues ??= new Set();
      const include = (source) => { dependencyRoutes(query, source, true); if (!query.clobberSources.has(source)) { chargeAnalysis("edges"); query.clobberSources.add(source); } };
      for (const source of query.clobberSources) {
        chargeAnalysis("steps");
        for (const route of routeDelta(query, source, "reachable-clobber-values")) {
          const ref = route.value;
          if (!ref || query.clobberValues.has(ref.id)) continue;
          chargeAnalysis("arguments"); query.clobberValues.add(ref.id);
          if (ref.valueKind === "accessor-value") { include(accessorReturns(ref, query)); continue; }
          const node = ref.node && unwrap(ref.node);
          if (!ref.unknownReason && (functionNode(node) || ref.valueKind === "bound")) {
            const target = ref.valueKind === "bound" ? ref.bound.target : node, bound = ref.bound;
            include(returnQuery(target, callContext(target, bound ? concatArguments(bound.args, undefined, target) : undefined, bound?.receiver, bound?.closure ?? lexicalClosure(target, ref.context), bound?.cost ?? 0)));
          }
          const allocation = allocationIdentity(ref);
          if (!allocation) continue;
          addRoute(query, { target: allocation, callee: ref, args: [unknownReference(query.call, "unproved opaque own-field clobber")], cost: 0, call: query.call, fieldWrite: true, fieldName: undefined });
          if (ref.valueKind === "array" || node && ts.isArrayLiteralExpression(node)) {
            const elements = ref.valueKind === "array" ? ref.elements : referencedArguments(node.elements, ref.context);
            for (const element of elements ?? []) { chargeAnalysis("steps"); include(valueQuery(element)); }
          } else if (node && ts.isObjectLiteralExpression(node)) for (const entry of node.properties) {
            chargeAnalysis("steps");
            if (ts.isPropertyAssignment(entry)) include(valueQuery(ownName(entry.name) === undefined ? sourceReference(entry.initializer, ref.context) : fieldReference(ref, ownName(entry.name), entry)));
            else if (ts.isShorthandPropertyAssignment(entry)) include(valueQuery(fieldReference(ref, entry.name.text, entry)));
            else if (ts.isSpreadAssignment(entry)) include(valueQuery(sourceReference(entry.expression, ref.context)));
            else if (ts.isGetAccessorDeclaration(entry)) include(accessorReturns(accessorReference(ref, entry, entry), query));
            else if (ts.isMethodDeclaration(entry)) include(valueQuery(sourceReference(entry, ref.context)));
          }
        }
      }
    };
    const expandExposure = (query) => {
      const value = valueQuery(query.ref);
      dependencyRoutes(query, value, true);
      query.children ??= new Set(); query.instances ??= new Set();
      const include = (ref) => {
        const child = exposureQuery(ref);
        dependencyRoutes(query, child, true);
        if (!query.children.has(child)) { chargeAnalysis("edges"); query.children.add(child); }
      };
      for (const route of routeDelta(query, value, "exposed-values")) {
        chargeAnalysis("steps");
        const ref = route.value, node = ref?.node && unwrap(ref.node);
        if (!ref || ref.unknownReason || !node) { addValue(query, ref ?? unknownReference(query.ref.node, "unproved exposed value")); continue; }
        query.terminal = true;
        if (primitiveKind(ref)) continue;
        if (ref.valueKind === "accessor-value") {
          const body = accessorReturns(ref, query);
          query.returnBodies ??= new Set();
          if (!query.returnBodies.has(body)) { chargeAnalysis("edges"); query.returnBodies.add(body); }
        } else if (functionNode(node) || ref.valueKind === "bound") {
          const invocation = invocationQuery(ref, undefined, 0, false);
          dependencyRoutes(query, invocation, true);
          if (!query.instances.has(invocation)) { chargeAnalysis("edges"); query.instances.add(invocation); }
        } else if (ref.valueKind === "array" || ts.isArrayLiteralExpression(node)) {
          const elements = ref.valueKind === "array" ? ref.elements : referencedArguments(node.elements, ref.context);
          const recipe = elements && literalArrayContents(ref, elements, query);
          for (const element of recipe?.elements ?? []) { chargeAnalysis("steps"); include(element); }
        } else if (ts.isObjectLiteralExpression(node)) {
          query.objects ??= new Map();
          if (!query.objects.has(ref.id)) { chargeAnalysis("arguments"); query.objects.set(ref.id, ref); }
          for (const entry of node.properties) {
          chargeAnalysis("steps");
          if (ts.isPropertyAssignment(entry)) include(ownName(entry.name) === undefined ? sourceReference(entry.initializer, ref.context) : fieldReference(ref, ownName(entry.name)));
          else if (ts.isShorthandPropertyAssignment(entry)) include(fieldReference(ref, entry.name.text));
          else if (ts.isSpreadAssignment(entry)) include(sourceReference(entry.expression, ref.context));
          else if (ts.isMethodDeclaration(entry)) include(sourceReference(entry, ref.context));
          else if (ts.isGetAccessorDeclaration(entry)) {
            for (const receiver of [ref, undefined]) {
              chargeAnalysis("steps");
              const closure = lexicalClosure(entry, ref.context), callee = sourceReference(entry, ref.context);
              addRoute(query, { target: entry, callee, args: [], receiver, closure, cost: 0, accessor: true });
              const body = returnQuery(entry, callContext(entry, [], receiver, closure));
              dependencyRoutes(query, body, true);
              query.returnBodies ??= new Set();
              if (!query.returnBodies.has(body)) { chargeAnalysis("edges"); query.returnBodies.add(body); }
            }
          }
          }
        }
      }
      for (const object of query.objects?.values() ?? []) {
        chargeAnalysis("steps");
        const heap = heapQuery(object);
        dependencyRoutes(query, heap, true);
        for (const route of routeDelta(query, heap, `exposed-own-fields:${object.id}`)) if (route.fieldWrite) for (const value of argumentValues(route.args)) { chargeAnalysis("steps"); include(value); }
      }
      for (const invocation of query.instances) {
      chargeAnalysis("steps");
      for (const route of routeDelta(query, invocation, "exposed-instances")) {
        if (!functionNode(route.target)) continue;
        addRoute(query, route);
        const body = returnQuery(route.target, callContext(route.target, route.bound ? concatArguments(route.args, undefined, route.target) : undefined, route.receiver, route.closure, route.cost));
        dependencyRoutes(query, body, true);
        query.returnBodies ??= new Set();
        if (!query.returnBodies.has(body)) { chargeAnalysis("edges"); query.returnBodies.add(body); }
      }
      }
      for (const body of query.returnBodies ?? []) { chargeAnalysis("steps"); for (const route of routeDelta(query, body, "exposed-external-returns")) if (route.value) include(route.value); }
      for (const child of query.children) { chargeAnalysis("steps"); for (const route of routeDelta(query, child, "exposed-children")) addRoute(query, route); }
    };
    const expandPublicExposure = (query) => {
      if (!query.initialized) {
        query.initialized = true;
        for (const entry of modelEntries) for (const declaration of runtimeExports(captureUnit(entry.path), "*")) {
          chargeAnalysis("steps");
          const ref = sourceReference(ts.isVariableDeclaration(declaration) || ts.isBindingElement(declaration) ? declaration.name : declaration);
          dependencyRoutes(query, exposureQuery(ref), true);
        }
      }
      for (const dependency of query.changedDependencies ?? []) {
        chargeAnalysis("steps");
        for (const route of routeDelta(query, dependency, "public-exposure-union")) addRoute(query, route);
      }
      query.changedDependencies?.clear();
    };
    const pristineArrayReference = (ref) => {
      if (arrayIntrinsicsMutated || ref.unknownReason || primitiveKind(ref) || sourceValueMutationRoots.has(ref)) return false;
      const node = ref.node && unwrap(ref.node);
      if (ref.valueKind !== "array" && (!node || !ts.isArrayLiteralExpression(node))) return false;
      const roots = provenance(ref.node);
      if ([...roots].some((root) => sourceValueMutationRoots.has(root))) return false;
      if (ref.node.getSourceFile() !== source && writesInUnit(ref.node.getSourceFile()).some((target) => {
        const member = property(target);
        return member && (arrayIntrinsicRoot(member.receiver) || [...provenance(member.receiver)].some((root) => roots.has(root)));
      })) return false;
      return !assignmentTargets.some(({ target }) => {
        const member = property(target);
        return member && [...provenance(member.receiver)].some((root) => roots.has(root));
      });
    };
    const nativeCallbackQueries = (query, call, context) => {
      const member = property(origin(call.expression));
      const from = member?.name === "from" && builtinNamespace(member.receiver, "Array");
      if (!member || !from && !nativeArrayOperations.has(member.name) && member.name !== "entries") return undefined;
      const receiver = valueQuery(sourceReference(from ? call.arguments[0] : member.receiver, context));
      dependencyRoutes(query, receiver, true);
      query.nativeModels ??= new Map();
      const modelKey = `${identity(call)}:${context?.id ?? 0}`;
      let model = query.nativeModels.get(modelKey);
      if (!model) { chargeAnalysis("arguments", 6); query.nativeModels.set(modelKey, model = { receiver, callbacks: [], arrays: new Map(), coveredReceivers: new Set(), rawReceivers: new Map(), processedArrays: new Set(), unprovedReceivers: new Set(), pendingReceivers: new Set() }); }
      const callbacks = model.callbacks;
      for (const route of routeDelta(query, receiver, `native-receiver:${modelKey}`)) {
        chargeAnalysis("arguments"); model.rawReceivers.set(route.value?.id ?? 0, route);
      }
      for (const route of model.rawReceivers.values()) {
        chargeAnalysis("steps");
        const input = route.value;
        model.pendingReceivers.delete(input?.id ?? 0);
        let arrays = [input];
        if (from && input?.node && !primitiveKind(input) && ts.isObjectLiteralExpression(unwrap(input.node))) {
          const object = unwrap(input.node), heap = heapQuery(input);
          dependencyRoutes(query, heap, true);
          let safe = !arrayIntrinsicsMutated;
          for (const entry of object.properties) { chargeAnalysis("steps"); if (!(ts.isPropertyAssignment(entry) || ts.isShorthandPropertyAssignment(entry)) || ownName(entry.name) === undefined || ownName(entry.name) === "__proto__") safe = false; }
          for (const effect of heap.routes.values()) { chargeAnalysis("steps"); if (effect.fieldWrite && (effect.fieldName === undefined || effect.fieldName === "__proto__")) safe = false; }
          if (!safe) arrays = [undefined];
          else {
            const lengths = valueQuery(fieldReference(input, "length"));
            dependencyRoutes(query, lengths);
            if (!lengths.routes.size) { model.pendingReceivers.add(input.id); continue; }
            arrays = [];
            for (const length of lengths.routes.values()) {
              chargeAnalysis("steps");
              const value = length.value, actual = value?.node && unwrap(value.node);
              const count = primitiveKind(value) === "undefined" ? 0 : actual && ts.isNumericLiteral(actual) ? Number(actual.text) : undefined;
              if (count === undefined || !Number.isSafeInteger(count) || count < 0) { arrays.push(undefined); continue; }
              chargeAnalysis("steps", count + 1); chargeAnalysis("arguments", count + 1);
              const elements = [];
              for (let index = 0; index < count; index++) elements.push(fieldReference(input, String(index)));
              arrays.push(derivedReference(call, "array", elements, context));
            }
          }
        }
        for (const array of arrays) {
        chargeAnalysis("steps");
        if (!array || !pristineArrayReference(array)) {
          const unprovedKey = `${route.value?.id ?? 0}:unproved`;
          if (model.processedArrays.has(unprovedKey)) continue;
          chargeAnalysis("arguments"); model.processedArrays.add(unprovedKey); model.unprovedReceivers.add(route.value?.id ?? 0);
          if (!call.arguments[from ? 1 : 0]) continue;
          const callback = invocationQuery(sourceReference(call.arguments[from ? 1 : 0], context), undefined);
          dependencyRoutes(query, callback, true);
          callbacks.push({ query: callback, unprovedReceiver: true }); continue;
        }
        if (model.processedArrays.has(array.id)) continue;
        chargeAnalysis("arguments"); model.processedArrays.add(array.id);
        const elements = array.valueKind === "array" ? array.elements : referencedArguments(unwrap(array.node).elements, array.context);
        if (!elements) {
          if (!call.arguments[from ? 1 : 0]) continue;
          const callback = invocationQuery(sourceReference(call.arguments[from ? 1 : 0], context), undefined);
          dependencyRoutes(query, callback, true); callbacks.push({ query: callback, unprovedReceiver: true }); continue;
        }
        if (!model.arrays.has(array.id)) { chargeAnalysis("arguments"); model.arrays.set(array.id, array); }
        if (!model.coveredReceivers.has(route.value.id)) { chargeAnalysis("edges"); model.coveredReceivers.add(route.value.id); }
        if (!call.arguments[from ? 1 : 0] || member.name === "entries") continue;
        const allocation = allocationIdentity(array), indexKey = `native-index:${identity(call)}:${allocation?.id ?? 0}:${context?.id ?? 0}`;
        let index = references.get(indexKey);
        if (!index) { chargeAnalysis("arguments"); references.set(indexKey, index = { sourceRef: true, id: references.size + 1, node: call, context, keys: [], valueKind: "number", indexAllocation: allocation }); }
        for (const element of elements) {
          const partners = member.name === "sort" ? elements : [undefined];
          for (const partner of partners) {
            chargeAnalysis("steps");
            const args = member.name === "sort" ? [element, partner] : from ? [element, index] : [element, index, array];
            const callback = invocationQuery(sourceReference(call.arguments[from ? 1 : 0], context), args, 0, true,
              member.name !== "sort" && call.arguments[from ? 2 : 1] ? sourceReference(call.arguments[from ? 2 : 1], context) : undefined);
            dependencyRoutes(query, callback, true); callbacks.push({ query: callback, unprovedReceiver: false, array });
          }
        }
        }
      }
      return model;
    };
    const expandCallDiscovery = (query) => {
        const call = query.call;
        query.escapeChildren ??= new Set(); query.opaqueDependencies ??= new Set();
        for (const scope of scopesForCall(query, call, "discovery")) {
        chargeAnalysis("steps");
        for (const dependency of sourceInvocations(query, call.expression, call.arguments, scope, 0, true, true)) {
        chargeAnalysis("steps");
        const nativeCallee = nativeCallbackQueries(query, call, scope);
        query.candidateRoutes ??= new Map();
        let candidates = query.candidateRoutes.get(dependency);
        if (!candidates) { chargeAnalysis("arguments"); query.candidateRoutes.set(dependency, candidates = []); }
        for (const route of routeDelta(query, dependency, "ordinary-discovery")) {
          if (route.unknownReason && !query.opaqueDependencies.has(dependency)) { chargeAnalysis("edges"); query.opaqueDependencies.add(dependency); }
          if (route.target && !route.bound) addRoute(query, { ...route, call });
          else if (route.unknownReason) { chargeAnalysis("arguments"); candidates.push(route); }
        }
        let pendingCallee = Boolean(nativeCallee && (!nativeCallee.receiver.routes.size || nativeCallee.pendingReceivers.size)), nativeDispatch = Boolean(nativeCallee);
        for (const route of nativeCallee?.receiver.routes.values() ?? []) { chargeAnalysis("steps"); if (!route.value || !nativeCallee.coveredReceivers.has(route.value.id) || nativeCallee.unprovedReceivers.has(route.value.id)) nativeDispatch = false; }
        if (!pendingCallee && !nativeDispatch && candidates.length) {
          for (const route of candidates) { chargeAnalysis("steps"); for (const fn of callableCandidates(call.expression)) addRoute(query, { target: fn, callee: route.callee, args: route.args, cost: route.cost, unknownReason: route.unknownReason, call }); }
        }
        if (query.opaqueDependencies.has(dependency)) {
          const method = contentProperty(call.expression), native = nativeCallbackQueries(query, call, scope);
          const pure = method && !arrayIntrinsicsMutated && (method.name === "freeze" && builtinNamespace(method.receiver, "Object") || method.name === "isArray" && builtinNamespace(method.receiver, "Array"));
          let pending = false, opaque = !pure;
          if (native) {
            pending = !native.receiver.routes.size || native.pendingReceivers.size > 0; opaque = native.unprovedReceivers.size > 0;
            for (const route of native.receiver.routes.values()) { chargeAnalysis("steps"); if (!route.value || !native.coveredReceivers.has(route.value.id)) opaque = true; }
            for (const entry of native.callbacks) {
              chargeAnalysis("steps");
              if (!entry.query.routes.size && !entry.query.terminal) pending = true;
              if (entry.unprovedReceiver) opaque = true;
              for (const route of entry.query.routes.values()) { chargeAnalysis("steps"); if (route.unknownReason) opaque = true; }
            }
          } else if (method && ["push", "unshift"].includes(method.name)) {
            const receiver = valueQuery(sourceReference(method.receiver, scope));
            dependencyRoutes(query, receiver, true);
            pending = !receiver.routes.size;
            opaque = false;
            for (const route of receiver.routes.values()) { chargeAnalysis("steps"); if (!route.value || !pristineArrayReference(route.value)) opaque = true; }
          }
          if (!pending && opaque) {
            const escape = (ref) => {
              chargeAnalysis("steps");
              const escaped = exposureQuery(ref);
              dependencyRoutes(query, escaped, true);
              if (!query.escapeChildren.has(escaped)) { chargeAnalysis("edges"); query.escapeChildren.add(escaped); }
              dependencyRoutes(heapDiscoveryQuery(), clobberQuery(ref, call), true);
            };
            for (const argument of call.arguments) { chargeAnalysis("steps"); escape(sourceReference(ts.isSpreadElement(argument) ? argument.expression : argument, scope)); }
            for (const entry of native?.callbacks ?? []) {
              chargeAnalysis("steps");
              for (const route of entry.query.routes.values()) if (route.unknownReason) {
                chargeAnalysis("steps");
                for (const ref of argumentValues(route.args)) escape(ref);
                if (route.receiver) escape(route.receiver);
              }
            }
          }
        }
        }
        const member = property(origin(call.expression));
        const from = member?.name === "from" && builtinNamespace(member.receiver, "Array");
        if (member && (nativeArrayOperations.has(member.name) || from) && call.arguments[from ? 1 : 0]) {
          const callback = invocationQuery(sourceReference(call.arguments[from ? 1 : 0], scope), undefined, 0, false);
          dependencyRoutes(query, callback, true);
          for (const route of routeDelta(query, callback, "native-candidate-discovery")) if (route.target) {
            addRoute(query, { ...route, bound: false, call, pendingNative: true });
          }
        }
        }
        for (const escaped of query.escapeChildren) for (const route of routeDelta(query, escaped, "opaque-escape-incoming")) if (functionNode(route.target)) {
          addRoute(query, { ...route, args: route.bound ? concatArguments(route.args, undefined, route.target) : undefined, bound: false, call, unknownReason: "opaque incoming" });
        }
    };
    const expandDiscovery = (query) => {
      if (!query.discoveryInitialized) {
        query.discoveryInitialized = true;
        for (const call of completeCallsites()) {
          chargeAnalysis("steps");
          dependencyRoutes(query, callDiscoveryQuery(call), true);
        }
      }
      const changed = [...query.changedDependencies ?? []];
      query.changedDependencies?.clear();
      for (const dependency of changed) {
        chargeAnalysis("steps");
        for (const route of routeDelta(query, dependency, "discovery-union")) addRoute(query, route);
      }
    };
    const expandIncoming = (query) => {
      const fn = query.fn;
      const exposure = publicExposureQuery();
      dependencyRoutes(query, exposure, true);
      for (const route of incomingDelta(query, exposure, fn, "exported-incoming")) {
        chargeAnalysis("steps");
        addRoute(query, { target: fn, callee: route.callee, args: route.accessor ? [] : route.bound ? concatArguments(route.args, undefined, fn) : undefined, receiver: route.receiver, closure: route.closure, cost: route.cost, unknownReason: "exported incoming" });
      }
      const discovery = discoveryQuery();
      dependencyRoutes(query, discovery, true);
      for (const route of incomingDelta(query, discovery, fn, "ordinary-incoming")) {
        chargeAnalysis("steps");
        if (route.pendingNative) {
          query.nativeSites ??= new Set();
          if (!query.nativeSites.has(route.call)) { chargeAnalysis("edges"); query.nativeSites.add(route.call); }
        } else addRoute(query, route);
      }
      for (const call of query.nativeSites ?? []) {
        for (const scope of scopesForCall(query, call, "native-incoming")) {
        const native = nativeCallbackQueries(query, call, scope);
        for (const entry of native?.callbacks ?? []) for (const route of routeDelta(query, entry.query, entry.unprovedReceiver ? "incoming-native-unknown" : "incoming-native")) {
          if (route.target === fn && !route.bound) addRoute(query, { ...route, call, native: true,
            ...(entry.unprovedReceiver ? { args: undefined, unknownReason: "unclosed native receiver" } : {}) });
        }
        }
      }
    };
    const expandInvocation = (query) => {
      const { ref, args, cost, invoked } = query;
      if (ref.unknownReason || !ref.node) { unknownRoute(query, ref.unknownReason ?? "missing source"); return; }
      if (ref.valueKind === "alternatives") { for (const value of ref.elements) { chargeAnalysis("steps"); forwardQuery(query, value); } return; }
      if (ref.valueKind === "initializer" || ref.valueKind === "default") {
        const values = valueQuery(ref); dependencyRoutes(query, values);
        for (const route of routeDelta(query, values, "invoked-defaults")) if (route.value) forwardQuery(query, route.value);
        return;
      }
      if (ref.valueKind === "bound") {
        const route = ref.bound;
        if (!invoked) { addRoute(query, { ...route, bound: true }); return; }
        const combined = concatArguments(route.args, args, ref.node);
        forwardQuery(query, route.callee, combined, cost + route.cost, true, route.receiver);
        return;
      }
      if (ref.valueKind && (primitiveKind(ref) || ["array", "array-input", "iterator"].includes(ref.valueKind))) { query.terminal = true; return; }
      const input = unwrap(ref.node);
      if (ref.keys.length) {
        const values = valueQuery(ref);
        dependencyRoutes(query, values);
        for (const route of routeDelta(query, values, "invoked-fields")) if (route.value) forwardQuery(query, route.value, args);
        return;
      }
      if (ts.isConditionalExpression(input)) {
        forwardQuery(query, sourceReference(input.whenTrue, ref.context));
        forwardQuery(query, sourceReference(input.whenFalse, ref.context));
        return;
      }
      if (ts.isBinaryExpression(input) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(input.operatorToken.kind)) {
        forwardQuery(query, sourceReference(input.left, ref.context)); forwardQuery(query, sourceReference(input.right, ref.context)); return;
      }
      if (ts.isIdentifier(input)) {
        const symbol = binding(input), declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
        const imported = runtimeImportTargets(declaration);
        if (imported) {
          if (!imported.length) unknownRoute(query, "unresolved runtime import");
          for (const target of imported) forwardQuery(query, sourceReference(ts.isVariableDeclaration(target) ? target.initializer : target, ref.context));
          return;
        }
        const assignments = callableAssignments.get(symbol) ?? [];
        for (const assigned of assignments) if (assigned !== input) forwardQuery(query, sourceReference(assigned, ref.context));
        if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
          forwardQuery(query, sourceReference(declaration.initializer, ref.context)); return;
        }
        const path = parameterPath(input);
        if (path) {
          const incoming = incomingQuery(path.declaration.parent);
          dependencyRoutes(query, incoming);
          for (const route of routeDelta(query, incoming, "parameter-call")) {
            const context = callContext(path.declaration.parent, route.args, route.receiver, route.closure, route.cost, route.call);
            const index = path.declaration.parent.parameters.indexOf(path.declaration);
            const supplied = parameterArgument(path.declaration, index, route.args, route.closure, context);
            const defaultValue = path.declaration.initializer;
            if (!supplied && !defaultValue) { unknownRoute(query, route.args ? "missing callback" : "unknown incoming callback"); continue; }
            const translated = mapArguments(args, (argument) => argument.context || argument.valueKind || argument.base || argument.unknownReason ? argument : sourceReference(argument.node, context, argument.keys));
            if (supplied) forwardQuery(query, parameterProjection(input, supplied, context), translated, cost + route.cost);
            if (defaultValue && (!supplied || !nonUndefinedArgument(supplied.node))) forwardQuery(query, sourceReference(defaultValue, route.closure, path.keys), translated, cost + route.cost);
          }
          return;
        }
        if (functionNode(declaration)) {
          addRoute(query, { target: declaration, callee: ref, args, receiver: query.receiver, closure: lexicalClosure(declaration, ref.context), cost }); return;
        }
        const bound = declaration && ts.isBindingElement(declaration) ? bindingMember(declaration) : undefined;
        if (bound) {
          const entry = ownMember(origin(bound.receiver), bound.name);
          if (entry) { forwardQuery(query, sourceReference(entry, ref.context)); return; }
        }
        unknownRoute(query, "unresolved identifier", staleInvocationSource(input) || Boolean(declaration && !ts.isImportSpecifier(declaration) && !ts.isImportClause(declaration)));
        return;
      }
      if (functionNode(input)) {
        addRoute(query, { target: input, callee: ref, args, receiver: query.receiver, closure: lexicalClosure(input, ref.context), cost }); return;
      }
      if (ts.isCallExpression(input)) {
        if (property(origin(input.expression))?.name !== "bind") {
          const values = valueQuery(ref);
          dependencyRoutes(query, values);
          for (const route of routeDelta(query, values, "callee-values")) {
            if (route.value?.unknownReason) unknownRoute(query, route.value.unknownReason);
            else if (route.value) forwardQuery(query, route.value, args, cost + 1, invoked, query.receiver);
          }
          inheritEffects(query, values);
          return;
        }
        for (const creation of sourceInvocations(query, input.expression, input.arguments, ref.context, cost + 1)) {
        chargeAnalysis("steps");
        for (const route of routeDelta(query, creation, "bound-creation")) {
          if (route.bound) {
            const combined = concatArguments(route.args, args, input);
            forwardQuery(query, route.callee, combined, route.cost, invoked, route.receiver);
          } else if (route.unknownReason) unknownRoute(query, "unresolved call result", route.effectsRequired);
          else unknownRoute(query, "unproved function return");
        }
        }
        return;
      }
      const member = property(input);
      if (member?.name === "apply" && builtinNamespace(member.receiver, "Reflect")) {
        const callee = argumentAt(args, 0, input);
        if (!callee) unknownRoute(query, "unknown reflected callee");
        else forwardApply(query, callee, argumentAt(args, 2, input), cost + 1, invoked, argumentAt(args, 1, input));
        return;
      }
      if (member && ["call", "apply", "bind"].includes(member.name)) {
        if (member.name === "apply") { forwardApply(query, sourceReference(member.receiver, ref.context), argumentAt(args, 1, input), cost + 1, invoked, argumentAt(args, 0, input)); return; }
        const values = sliceArguments(args, 1, input);
        const child = invocationQuery(sourceReference(member.receiver, ref.context), values, cost + 1, invoked, argumentAt(args, 0, input), query.expected);
        dependencyRoutes(query, child);
        for (const route of routeDelta(query, child, `wrapper-${member.name}`)) addRoute(query, member.name === "bind" ? { ...route, bound: true } : route);
        return;
      }
      if (member) {
        const holder = origin(member.receiver);
        if (ts.isObjectLiteralExpression(holder) && member.name !== undefined) {
          const receiver = sourceReference(member.receiver, ref.context), values = valueQuery(projectReference(receiver, [member.name]));
          dependencyRoutes(query, values);
          for (const route of routeDelta(query, values, "own-dispatch-values")) if (route.value) forwardQuery(query, route.value, args, cost, invoked, receiver);
          return;
        }
        const entry = ownMember(holder, member.name);
        if (entry) { forwardQuery(query, sourceReference(entry, ref.context), args, cost, invoked, sourceReference(member.receiver, ref.context)); return; }
        if (ts.isObjectLiteralExpression(holder) && member.name !== undefined && !holder.properties.some(ts.isSpreadAssignment)) {
          const entries = holder.properties.filter((entry) => ownName(entry.name) === member.name);
          if (entries.length === 1 && ts.isMethodDeclaration(entries[0])) {
            addRoute(query, { target: entries[0], callee: ref, args, receiver: sourceReference(member.receiver, ref.context), closure: lexicalClosure(entries[0], ref.context), cost }); return;
          }
        }
        if (ts.isConditionalExpression(holder)) {
          forwardQuery(query, projectReference(sourceReference(holder.whenTrue, ref.context), [member.name]));
          forwardQuery(query, projectReference(sourceReference(holder.whenFalse, ref.context), [member.name])); return;
        }
        unknownRoute(query, "unresolved dispatch", staleInvocationSource(input) && (ts.isObjectLiteralExpression(holder) || member.name === undefined || /^(0|[1-9][0-9]*)$/.test(member.name)));
        return;
      }
      query.terminal = ts.isStringLiteralLike(input) || ts.isNumericLiteral(input) || ts.isBigIntLiteral(input) || ts.isArrayLiteralExpression(input) || ts.isObjectLiteralExpression(input) ||
        [ts.SyntaxKind.NullKeyword, ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(input.kind);
      if (!query.terminal) unknownRoute(query, "unsupported source value");
    };
    const forwardApply = (query, callee, arrayRef, cost, invoked, receiver) => {
      if (!arrayRef) { forwardQuery(query, callee, [], cost, invoked, receiver); return; }
      const array = valueQuery(arrayRef);
      dependencyRoutes(query, array);
      for (const route of routeDelta(query, array, "apply-sequences")) {
        chargeAnalysis("steps");
        const ref = route.value, node = ref?.node && unwrap(ref.node);
        const elements = ref?.valueKind === "array" ? ref.elements : node && ts.isArrayLiteralExpression(node) ? referencedArguments(node.elements, ref.context) : undefined;
        const args = ref && pristineArrayReference(ref) && elements && !ref.summarized ? elements : unknownArguments(arrayRef.node, elements ?? [], [], !elements);
        forwardQuery(query, callee, args, cost, invoked, receiver);
      }
    };
    const saturateInvocations = () => {
      if (!queryQueue.length && !dirtyCertificate.size) return;
      activeGraph = true;
      try {
        for (let cursor = 0; cursor < queryQueue.length; cursor++) {
          const query = queryQueue[cursor]; queuedQueries.delete(query); chargeAnalysis("steps");
          refreshForwards(query);
          analysisPhase = query.publicExposureQuery || query.exposureQuery ? "exposure" : query.heapDiscoveryQuery || query.heapMutationQuery || query.heapQuery ? "heap" : query.callDiscoveryQuery || query.discoveryQuery ? "discovery" : query.fn ? "incoming" : query.returnQuery ? "returns" : query.valueQuery ? "values" : "invocations";
          if (query.accessorExecutionQuery) expandAccessorExecution(query); else if (query.clobberQuery) expandClobber(query); else if (query.fieldQuery) expandField(query); else if (query.fieldMutationQuery) expandFieldMutation(query); else if (query.argumentsQuery) expandArguments(query); else if (query.publicExposureQuery) expandPublicExposure(query); else if (query.exposureQuery) expandExposure(query); else if (query.heapDiscoveryQuery) expandHeapDiscovery(query); else if (query.heapMutationQuery) expandHeapMutation(query); else if (query.heapQuery) expandHeap(query); else if (query.callDiscoveryQuery) expandCallDiscovery(query); else if (query.discoveryQuery) expandDiscovery(query); else if (query.fn) expandIncoming(query); else if (query.returnQuery) expandReturns(query); else if (query.valueQuery) expandSourceValue(query); else expandInvocation(query);
        }
        queryQueue.length = 0;
        analysisPhase = "certificate";
        const affected = [...dirtyCertificate];
        for (let cursor = 0; cursor < affected.length; cursor++) for (const parent of affected[cursor].parents) {
          chargeAnalysis("steps");
          if (parent.dependencies.get(affected[cursor]) === false && !dirtyCertificate.has(parent)) { dirtyCertificate.add(parent); affected.push(parent); }
        }
        const visited = new Set(), order = [];
        for (const root of affected) {
          if (visited.has(root)) continue;
          chargeAnalysis("steps"); visited.add(root);
          const stack = [{ query: root, edges: root.dependencies.entries() }];
          while (stack.length) {
            chargeAnalysis("steps");
            const frame = stack[stack.length - 1], next = frame.edges.next();
            if (next.done) { order.push(frame.query); stack.pop(); continue; }
            const [dependency, discovery] = next.value;
            if (discovery || !dirtyCertificate.has(dependency) || visited.has(dependency)) continue;
            visited.add(dependency); stack.push({ query: dependency, edges: dependency.dependencies.entries() });
          }
        }
        const components = [], memberships = new Map();
        for (let index = order.length - 1; index >= 0; index--) {
          const root = order[index];
          if (memberships.has(root)) continue;
          chargeAnalysis("steps");
          const component = { members: [], parents: new Set(), closed: true };
          components.push(component); memberships.set(root, component);
          const stack = [root];
          while (stack.length) {
            chargeAnalysis("steps");
            const query = stack.pop(); component.members.push(query);
            query.productive = query.terminal || query.routes.size > 0;
            if (!query.productive || [...query.routes.values()].some((route) => route.unknownReason)) component.closed = false;
            for (const parent of query.parents) {
              chargeAnalysis("steps");
              if (parent.dependencies.get(query) !== false || !dirtyCertificate.has(parent) || memberships.has(parent)) continue;
              memberships.set(parent, component); stack.push(parent);
            }
          }
        }
        for (const query of affected) for (const [dependency, discovery] of query.dependencies) {
          chargeAnalysis("steps");
          if (discovery) continue;
          const owner = memberships.get(query), upstream = memberships.get(dependency);
          if (!upstream) { if (!dependency.closed) owner.closed = false; }
          else if (owner !== upstream) upstream.parents.add(owner);
        }
        const unclosed = components.filter((component) => !component.closed);
        for (let cursor = 0; cursor < unclosed.length; cursor++) for (const parent of unclosed[cursor].parents) {
          chargeAnalysis("steps");
          if (parent.closed) { parent.closed = false; unclosed.push(parent); }
        }
        for (const component of components) for (const query of component.members) query.closed = component.closed;
        dirtyCertificate.clear();
      } finally { activeGraph = false; }
    };
    const ensureInvocationEpoch = () => {
      if (graphEpoch !== mutationEpoch || graphCapturedEpoch !== capturedEpoch) {
        graphEpoch = mutationEpoch; graphCapturedEpoch = capturedEpoch; queryGraph = new Map(); queryQueue.length = 0; queuedQueries.clear(); dirtyCertificate.clear();
        chargeAnalysis("steps"); chargeAnalysis("arguments");
        arrayContentSummaries = new Map();
      }
    };
    const localInvocation = (expression, args, depth = 0, expected, invoked = true) => {
      ensureInvocationEpoch();
      const query = invocationQuery(sourceReference(expression), mapArguments(args, (argument) => sourceReference(argument)), depth, invoked, undefined, expected);
      if (!activeGraph) saturateInvocations();
      return { routes: [...query.routes.values()], closed: query.closed, grounded: query.productive,
        unproved: !query.closed, noncallable: query.terminal && query.closed };
    };
    const localCallbackParameter = (fn, index, argument, expected) => {
      if (!fn || !ts.isFunctionDeclaration(fn) && !ts.isFunctionExpression(fn) && !ts.isArrowFunction(fn)) return false;
      const parameter = fn.parameters[+index];
      if (!parameter) return false;
      const names = [];
      const collect = (name) => {
        if (ts.isIdentifier(name)) names.push(name);
        else for (const element of name.elements) if (ts.isBindingElement(element)) collect(element.name);
      };
      collect(parameter.name);
      return names.some((name) => {
        const path = parameterPath(name);
        if (!path || path.declaration !== parameter) return false;
        let value = argument;
        for (const key of path.keys) value = value && ownMember(origin(value), key);
        if (!value) return false;
        const summary = localInvocation(value, [], 0, expected, false);
        if (!summary.closed || !summary.routes.length || !summary.routes.every((route) => route.target === expected)) return false;
        const symbol = binding(name);
        let called = false, escaped = false;
        const scan = (node) => {
          if (ts.isIdentifier(node) && node !== name && valueUse(node) && binding(node) === symbol) {
            const use = wrappedUse(node), parent = use.parent;
            if (ts.isCallExpression(parent) && parent.expression === use) called = true;
            else if (!(ts.isIfStatement(parent) && parent.expression === use || ts.isConditionalExpression(parent) && parent.condition === use || ts.isTypeOfExpression(parent))) escaped = true;
          }
          ts.forEachChild(node, scan);
        };
        scan(fn);
        return called && !escaped;
      });
    };
    const mutationCallback = (argument, fn, index, seen = new Set()) => {
      const value = origin(argument);
      if (seen.has(value)) return;
      const next = new Set([...seen, value]);
      const invocation = localInvocation(argument, [], 0, fn, false);
      for (const route of invocation.routes) if (route.target === fn) {
        const boundArgument = argumentAt(route.args, +index, fn);
        if (!boundArgument) throw new Error(`Unsupported parameter mutation callback in public closure: ${id} -> ${fn.getText(source).slice(0, 160)}`);
        markReferenceMutation(boundArgument);
      }
      if (ts.isArrayLiteralExpression(value)) {
        for (const entry of value.elements) if (!ts.isOmittedExpression(entry)) mutationCallback(ts.isSpreadElement(entry) ? entry.expression : entry, fn, index, next);
      } else if (ts.isObjectLiteralExpression(value)) {
        for (const entry of value.properties) {
          if (ts.isPropertyAssignment(entry)) mutationCallback(entry.initializer, fn, index, next);
          else if (ts.isShorthandPropertyAssignment(entry)) mutationCallback(entry.name, fn, index, next);
          else if (ts.isSpreadAssignment(entry)) mutationCallback(entry.expression, fn, index, next);
        }
      }
    };
    const nonUndefinedArgument = (node, seen = new Set()) => {
      if (staleInvocationSource(node)) return false;
      const value = origin(node);
      if (seen.has(value)) return false;
      const next = new Set([...seen, value]);
      if (ts.isConditionalExpression(value)) return nonUndefinedArgument(value.whenTrue, next) && nonUndefinedArgument(value.whenFalse, next);
      return ts.isObjectLiteralExpression(value) || ts.isArrayLiteralExpression(value) || ts.isArrowFunction(value) || ts.isFunctionExpression(value) ||
        ts.isNewExpression(value) || ts.isStringLiteralLike(value) || ts.isNumericLiteral(value) || ts.isBigIntLiteral(value) ||
        [ts.SyntaxKind.NullKeyword, ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(value.kind);
    };
    const markReferenceMutation = (ref, reorderOnly = false) => {
      if (mutationBatch) { chargeAnalysis("routes"); mutationBatch.push(() => markReferenceMutation(ref, reorderOnly)); return; }
      if (ref.unknownReason) throw new Error(`Unsupported parameter mutation value in public closure: ${id} -> ${ref.unknownReason}`);
      const value = referenceNode(ref);
      if (!value) throw new Error(`Unsupported parameter mutation member in public closure: ${id}`);
      if (reorderOnly) { markMutation(ref.node, "reorder"); queueMutationParameter(ref.node); markMutation(value, "reorder"); queueMutationParameter(value); return; }
      if (ref.valueKind === "array") sourceValueMutationRoots.add(ref);
      if (ts.isArrayLiteralExpression(value)) for (const root of provenance(value)) sourceValueMutationRoots.add(root);
      markArgumentMutation(ref.node);
      if (value !== ref.node) markArgumentMutation(value);
    };
    const sourceValueMutationRoots = new MutationFacts();
    const parameterReorderOnly = (declaration) => {
      const targets = memberMutationTargets.filter((target) => parameterPath(target)?.declaration === declaration);
      return targets.length > 0 && targets.every((target) => memberMutationKinds.get(target)?.size === 1 && memberMutationKinds.get(target).has("reorder"));
    };
    const sourceValueSummary = (ref) => {
      ensureInvocationEpoch();
      const query = valueQuery(ref);
      saturateInvocations();
      return query;
    };
    let referencedBindings;
    const referenceIndex = () => {
      if (referencedBindings) return referencedBindings;
      referencedBindings = new Set();
      completeCallsites();
      for (const entry of modelEntries) for (const declaration of runtimeExports(captureUnit(entry.path), "*")) {
        chargeAnalysis("steps");
        if (declaration.name && ts.isIdentifier(declaration.name)) { chargeAnalysis("arguments"); referencedBindings.add(binding(declaration.name)); }
      }
      for (const unit of runtimeUnits) {
        const scan = (node) => {
          chargeAnalysis("steps");
          if (ts.isIdentifier(node) && valueUse(node)) {
            const symbol = binding(node), declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
            if (declaration?.name !== node) {
              if (!referencedBindings.has(symbol)) { chargeAnalysis("arguments"); referencedBindings.add(symbol); }
              for (const target of runtimeImportTargets(declaration) ?? []) if (target.name && ts.isIdentifier(target.name)) {
                const imported = binding(target.name);
                if (!referencedBindings.has(imported)) { chargeAnalysis("arguments"); referencedBindings.add(imported); }
              }
            }
          }
          ts.forEachChild(node, scan);
        };
        scan(unit.source);
      }
      return referencedBindings;
    };
    const functionUnreachable = (fn) => {
      const owner = ts.isFunctionDeclaration(fn) ? fn : ts.isVariableDeclaration(fn.parent) ? fn.parent : undefined;
      if (!owner?.name || !ts.isIdentifier(owner.name)) return false;
      return !referenceIndex().has(binding(owner.name));
    };
    const contextsForCall = (call) => {
      let fn = call.parent;
      while (fn && !functionNode(fn)) { chargeAnalysis("steps"); fn = fn.parent; }
      if (!fn) return { complete: true, contexts: [undefined], unreachable: false };
      ensureInvocationEpoch();
      const incoming = incomingQuery(fn);
      saturateInvocations();
      if (!incoming.routes.size && ts.isCallExpression(fn.parent) && fn.parent.arguments[0] === fn) {
        const native = nativeCallSummary(fn.parent);
        if (native?.closed && native.empty) return { complete: true, contexts: [], unreachable: true };
      }
      if (!incoming.routes.size) {
        let owner = fn;
        while (owner) {
          chargeAnalysis("steps");
          if (functionNode(owner) && functionUnreachable(owner)) return { complete: true, contexts: [], unreachable: true };
          owner = owner.parent;
        }
        return { complete: false, contexts: [], unreachable: false };
      }
      const routes = [...incoming.routes.values()];
      const scopes = new Set(), bodies = [];
      for (const route of routes) {
        const context = callContext(fn, route.args, route.receiver, route.closure, route.cost, route.call);
        bodies.push(returnQuery(fn, context));
      }
      saturateInvocations();
      let complete = true;
      for (const body of bodies) {
        const mapped = body.callContexts?.get(call);
        if (!mapped?.size && !(body.cfgBuilt && body.closed)) complete = false;
        for (const scope of mapped ?? []) scopes.add(scope);
      }
      return { complete, contexts: [...scopes], unreachable: complete && scopes.size === 0 };
    };
    const checkPrimitiveNativeCall = (call) => {
      const member = property(origin(call.expression));
      if (!member || !["includes", "localeCompare"].includes(member.name)) return;
      const frames = contextsForCall(call);
      if (!frames.complete) throw new Error(`Code constructor acquisition in public closure: ${id} -> unproved enclosing native frame: ${call.getText(source)}`);
      if (frames.unreachable) return;
      ensureInvocationEpoch();
      const queries = frames.contexts.map((context) => valueQuery(sourceReference(call, context)));
      saturateInvocations();
      for (const query of queries) {
        if (!query.closed || !query.routes.size || ![...query.routes.values()].every((route) => ["boolean", "number"].includes(primitiveKind(route.value)))) {
          throw new Error(`Code constructor acquisition in public closure: ${id} -> unproved primitive native dispatch: ${call.getText(source)} -> ${[...query.dependencies].map(([dependency]) => `${dependency.ref?.node?.getText()}:${dependency.closed}:${[...dependency.routes.values()].map((route) => route.value?.unknownReason ?? primitiveKind(route.value) ?? route.value?.node?.getText()).join("|")}`).join(";")}`);
        }
      }
    };
    const nativeCallSummary = (call) => {
      ensureInvocationEpoch();
      const owner = invocationQuery(sourceReference(call.expression), referencedArguments(call.arguments));
      if (activeGraph) return undefined;
      scopesForCall(owner, call, "native-summary");
      saturateInvocations();
      const models = [];
      for (const scope of scopesForCall(owner, call, "native-summary")) {
        chargeAnalysis("steps");
        const model = nativeCallbackQueries(owner, call, scope);
        if (model) models.push(model);
      }
      saturateInvocations();
      for (const scope of scopesForCall(owner, call, "native-summary")) nativeCallbackQueries(owner, call, scope);
      saturateInvocations();
      return models.length ? { closed: models.every((model) => !model.pendingReceivers.size && model.receiver.closed && model.receiver.routes.size > 0 &&
        [...model.receiver.routes.values()].every((route) => route.value && model.coveredReceivers.has(route.value.id) && !model.unprovedReceivers.has(route.value.id)) &&
        model.callbacks.every((entry) => !entry.unprovedReceiver && entry.query.closed && entry.query.routes.size > 0)),
        routes: models.flatMap((model) => model.callbacks.flatMap((entry) => [...entry.query.routes.values()])), empty: models.every((model) => model.callbacks.length === 0) } : undefined;
    };
    const receiverMutationFunctions = new Set();
    for (const target of memberMutationTargets) {
      let root = origin(target), member;
      while ((member = property(root))) root = origin(member.receiver);
      if (root.kind !== ts.SyntaxKind.ThisKeyword) continue;
      let fn = target.parent;
      while (fn && (!functionNode(fn) || ts.isArrowFunction(fn))) fn = fn.parent;
      if (fn) receiverMutationFunctions.add(fn);
    }
    memberMutationTargets.forEach(queueMutationParameter);
    let previousMutationState;
    let mutationPass = 0;
    do {
      if (++mutationPass > mutationNodeCount * 6 + 1) throw new Error(`Unsupported parameter mutation convergence in public closure: ${id}`);
      previousMutationState = mutationEpoch;
      mutationBatch = [];
      for (const call of mutationCalls) {
        const invocation = localInvocation(call.expression, invocationArguments(call.arguments));
        for (const route of invocation.routes) {
          if (!route.unknownReason || !route.effectsRequired || route.bound) continue;
          if (!route.args) throw new Error(`Unsupported parameter mutation arguments in public closure: ${id}`);
          for (const argument of argumentValues(route.args)) markReferenceMutation(argument);
        }
        const callee = unwrap(call.expression);
        const parameter = ts.isIdentifier(callee) && parameterPath(callee);
        const parameterOwner = parameter?.declaration?.parent;
        const exportedParameterOwner = parameterOwner && Boolean(ts.getCombinedModifierFlags(parameterOwner) & ts.ModifierFlags.Export ||
          ts.isVariableDeclaration(parameterOwner.parent) && ts.getCombinedModifierFlags(parameterOwner.parent) & ts.ModifierFlags.Export);
        if (parameter && !parameter.keys.length && !invocation.closed && !exportedParameterOwner) {
          const owner = parameter.declaration.parent;
          const nativeEmpty = ts.isCallExpression(owner.parent) && owner.parent.arguments[0] === owner && nativeCallSummary(owner.parent);
          if (nativeEmpty?.closed && nativeEmpty.empty) continue;
          let outer = owner.parent;
          while (outer && !functionNode(outer) && !ts.isSourceFile(outer)) outer = outer.parent;
          if (!outer || ts.isSourceFile(outer)) throw new Error(`Code constructor acquisition in public closure: ${id} -> unclosed parameter mutation invocation: ${call.getText(source)}`);
        }
      }
      for (const fn of receiverMutationFunctions) {
        ensureInvocationEpoch();
        const incoming = incomingQuery(fn);
        saturateInvocations();
        for (const route of incoming.routes.values()) {
          if (route.unknownReason || !route.receiver) throw new Error(`Unsupported parameter mutation receiver in public closure: ${id}`);
          markReferenceMutation(route.receiver);
        }
      }
      for (let cursor = 0; cursor < pendingMutationParameters.length; cursor++) {
        const declaration = pendingMutationParameters[cursor];
        const fn = declaration.parent;
        if (!ts.isFunctionDeclaration(fn) && !ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn) && !ts.isMethodDeclaration(fn)) continue;
        const index = +fn.parameters.indexOf(declaration);
        const reorderOnly = parameterReorderOnly(declaration);
        ensureInvocationEpoch();
        const incoming = incomingQuery(fn);
        saturateInvocations();
        for (const route of incoming.routes.values()) if (route.native) {
          if (!route.args) throw new Error(`Unsupported parameter mutation native arguments in public closure: ${id}`);
          const actual = argumentAt(route.args, index, declaration);
          const supplied = declaration.dotDotDotToken ? argumentValues(sliceArguments(route.args, index, declaration)) : actual ? [actual] : [];
          for (const argument of supplied) { inheritCallableAssignments(declaration, argument.node); markReferenceMutation(argument, reorderOnly); }
          if ((!actual || !nonUndefinedArgument(actual.node)) && declaration.initializer) markArgumentMutation(declaration.initializer);
          const defaults = (node) => {
            chargeAnalysis("steps");
            if (ts.isBindingElement(node) && node.initializer) { inheritCallableAssignments(declaration, node.initializer); markArgumentMutation(node.initializer); }
            ts.forEachChild(node, defaults);
          };
          if (!ts.isIdentifier(declaration.name)) defaults(declaration.name);
        }
        for (const call of mutationCalls) {
          const invocation = localInvocation(call.expression, invocationArguments(call.arguments), 0, fn);
          const matching = invocation.routes.filter((route) => !route.bound && (route.target === fn || route.unknownReason && callableCandidates(route.callee.node).has(fn)));
          if (!matching.length) {
            const native = nativeCallSummary(call);
            for (const [argumentIndex, argument] of call.arguments.entries()) {
              if (argumentIndex === 0 && native?.closed) continue;
              if (!invocation.closed || !invocation.routes.length || !invocation.routes.every((route) => localCallbackParameter(route.target, argumentIndex, argument, fn))) mutationCallback(ts.isSpreadElement(argument) ? argument.expression : argument, fn, index);
            }
            continue;
          }
          for (const route of matching) {
          if (!route.args) {
            throw new Error(`Unsupported parameter mutation arguments in public closure: ${id}`);
          }
          if (declaration.dotDotDotToken) {
            for (const argument of argumentValues(sliceArguments(route.args, index, declaration))) { inheritCallableAssignments(declaration, argument.node); markReferenceMutation(argument, reorderOnly); }
          } else {
            const argument = argumentAt(route.args, index, declaration);
            const defaulted = !argument || !nonUndefinedArgument(argument.node);
            if (argument) { inheritCallableAssignments(declaration, argument.node); markReferenceMutation(argument, reorderOnly); }
            if (defaulted && declaration.initializer) { inheritCallableAssignments(declaration, declaration.initializer); markArgumentMutation(declaration.initializer); }
            const defaults = (node) => {
              if (ts.isBindingElement(node) && node.initializer) { inheritCallableAssignments(declaration, node.initializer); markArgumentMutation(node.initializer); }
              ts.forEachChild(node, defaults);
            };
            if (!ts.isIdentifier(declaration.name)) defaults(declaration.name);
          }
          }
        }
      }
      const effects = mutationBatch;
      mutationBatch = undefined;
      for (const effect of effects) { chargeAnalysis("steps"); effect(); }
    } while (previousMutationState !== mutationEpoch);
    checkIntrinsicMutations();
    if (arrayMutatorTargets.some((target) => !freshError(target))) markIntrinsicMutation();
    const parameterValueProof = (node, prove) => {
      const path = parameterPath(node);
      if (!path) return undefined;
      if (parameterProofActive.has(path.declaration)) return false;
      const follow = (argument, keys, seen = new Set()) => {
        if (!keys.length) return prove(argument);
        const value = origin(argument);
        if (seen.has(value) || [...provenance(argument)].some((root) => mutatedRoots.has(root))) return false;
        const next = new Set([...seen, value]);
        const nested = parameterPath(value);
        if (nested) {
          const values = parameterArguments(nested.declaration);
          return values !== undefined && values.every((entry) => follow(entry, [...nested.keys, ...keys], next));
        }
        const key = keys[0];
        if (key === "length" && keys.length === 1 && (ts.isArrayLiteralExpression(value) || ts.isStringLiteralLike(value))) return true;
        const entry = ownMember(value, key);
        return entry !== undefined && follow(entry, keys.slice(1), next);
      };
      parameterProofActive.add(path.declaration);
      try {
        const values = parameterArguments(path.declaration);
        return values !== undefined && values.every((value) => follow(value, path.keys));
      } finally { parameterProofActive.delete(path.declaration); }
    };
    const numericParameter = (node, seen) => {
      const symbol = binding(node), declaration = symbol?.valueDeclaration;
      if (!declaration || !ts.isParameter(declaration) || mutatedRoots.has(symbol)) return false;
      if (functionEscaped(declaration.parent)) return false;
      const query = sourceValueSummary(sourceReference(node));
      return query.closed && query.routes.size > 0 && [...query.routes.values()].every((route) => primitiveKind(route.value) === "number");
    };
    const functionEscapeCache = new WeakMap();
    const functionEscaped = (fn) => {
      chargeAnalysis("steps");
      const cached = functionEscapeCache.get(fn), incomingVersion = incomingQuery(fn).version ?? 0, exposureVersion = publicExposureQuery().version ?? 0;
      if (cached?.mutationEpoch === mutationEpoch && cached.capturedEpoch === capturedEpoch && cached.incomingVersion === incomingVersion && cached.exposureVersion === exposureVersion) return cached.escaped;
      const owner = ts.isFunctionDeclaration(fn) ? fn : ts.isVariableDeclaration(fn.parent) ? fn.parent : undefined;
      if (!owner?.name || !ts.isIdentifier(owner.name)) return false;
      const symbol = binding(owner.name);
      let escaped = false;
      const scan = (node) => {
        chargeAnalysis("steps");
        if (ts.isIdentifier(node) && node !== owner.name && valueUse(node) && binding(node) === symbol) {
          const use = wrappedUse(node), parent = use.parent, member = property(parent);
          const native = ts.isCallExpression(parent) && parent.arguments.includes(use) ? nativeCallSummary(parent) : undefined;
          if (!(ts.isCallExpression(parent) && parent.expression === use || member && member.receiver === use && ["call", "apply", "bind"].includes(member.name) || native?.closed && native.routes.some((route) => route.target === fn))) escaped = true;
        }
        ts.forEachChild(node, scan);
      };
      scan(fn.getSourceFile());
      chargeAnalysis("arguments");
      functionEscapeCache.set(fn, { escaped, mutationEpoch, capturedEpoch, incomingVersion: incomingQuery(fn).version ?? 0, exposureVersion: publicExposureQuery().version ?? 0 }); return escaped;
    };
    const plainData = (node, seen = new Set()) => {
      const input = unwrap(node);
      if (seen.has(input) || [...provenance(input)].some((root) => mutatedRoots.has(root))) return false;
      const next = new Set([...seen, input]);
      const value = origin(input);
      if (value !== input) return plainData(value, next);
      if (ts.isStringLiteralLike(value) || ts.isNumericLiteral(value) || [ts.SyntaxKind.NullKeyword, ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(value.kind)) return true;
      if (!arrayIntrinsicsMutated && jsonData(value)) return true;
      if (ts.isIdentifier(value)) {
        const values = parameterArguments(value);
        return values !== undefined && values.every((argument) => plainData(argument, next));
      }
      if (ts.isArrayLiteralExpression(value)) return value.elements.every((entry) => ts.isOmittedExpression(entry) || plainData(ts.isSpreadElement(entry) ? entry.expression : entry, next));
      return ts.isObjectLiteralExpression(value) && value.properties.every((entry) => ts.isPropertyAssignment(entry) ? plainData(entry.initializer, next)
        : ts.isShorthandPropertyAssignment(entry) ? plainData(entry.name, next) : ts.isSpreadAssignment(entry) && plainData(entry.expression, next));
    };
    const mutatedNumericMember = (node, seen = new Set()) => {
      const input = unwrap(node);
      if (seen.has(input)) return true;
      const next = new Set([...seen, input]);
      if (property(input)) return [...provenance(input)].some((root) => mutatedRoots.has(root));
      if (!ts.isIdentifier(input)) return false;
      const declaration = binding(input)?.valueDeclaration;
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) return mutatedNumericMember(declaration.initializer, next);
      const member = declaration && ts.isBindingElement(declaration) ? bindingMember(declaration) : undefined;
      return Boolean(member && [...provenance(member.receiver)].some((root) => mutatedRoots.has(root)));
    };
    const numericValue = (node, coercionOnly = false, seen = new Set()) => {
      const input = unwrap(node);
      if (seen.has(input)) return false;
      if (property(input) || mutatedNumericMember(input)) {
        const value = sourceValueSummary(sourceReference(input));
        return value.closed && value.routes.size > 0 && [...value.routes.values()].every((route) => primitiveKind(route.value) === "number");
      }
      const next = new Set([...seen, input]);
      if (ts.isIdentifier(input)) {
        const symbol = binding(input);
        if (nonNumericWrites.has(symbol)) return false;
        if (bindingGetter(symbol?.valueDeclaration)) return false;
        if (symbol?.valueDeclaration && ts.isBindingElement(symbol.valueDeclaration)) {
          const callerProof = parameterValueProof(input, (argument) => numericValue(argument, coercionOnly, next));
          if (callerProof !== undefined) return callerProof;
        }
        if (symbol?.valueDeclaration && ts.isParameter(symbol.valueDeclaration)) return numericParameter(input, next);
        if (mutatedRoots.has(symbol)) {
          if (!symbol?.valueDeclaration || !ts.isVariableDeclaration(symbol.valueDeclaration)) return false;
          const values = [...symbol.declarations.filter(ts.isVariableDeclaration).flatMap((declaration) => declaration.initializer ? [declaration.initializer] : []),
            ...numericAssignments.get(symbol) ?? []];
          return values.length > 0 && values.every((value) => numericValue(value, coercionOnly, next));
        }
        if (!coercionOnly && input.getSourceFile() === source && dataType(input).flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return false;
      }
      const value = origin(input);
      if (value !== input) return numericValue(value, coercionOnly, next);
      if (ts.isNumericLiteral(value)) return true;
      if (ts.isPrefixUnaryExpression(value) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken, ts.SyntaxKind.TildeToken].includes(value.operator)) return true;
      if (ts.isBinaryExpression(value)) return numericOperators.has(value.operatorToken.kind) ||
        value.operatorToken.kind === ts.SyntaxKind.PlusToken && numericValue(value.left, coercionOnly, next) && numericValue(value.right, coercionOnly, next);
      if (ts.isConditionalExpression(value)) return numericValue(value.whenTrue, coercionOnly, next) && numericValue(value.whenFalse, coercionOnly, next);
      if (ts.isCallExpression(value)) {
        const member = property(value.expression);
        if (ts.isIdentifier(value.expression) && value.expression.text === "Number" && globalReference(value.expression) &&
            !["Number", "global", "globalThis"].some((root) => mutatedRoots.has(root)) && ![...provenance(value.expression)].some((root) => mutatedRoots.has(root))) return true;
        return Boolean(member && ["floor", "ceil", "round", "trunc", "abs", "min", "max"].includes(member.name ?? "") &&
          builtinNamespace(member.receiver, "Math") && !["Math", "global", "globalThis"].some((root) => mutatedRoots.has(root)) &&
          ![...provenance(member.receiver)].some((root) => mutatedRoots.has(root)));
      }
      if (coercionOnly || ts.isAwaitExpression(value) || ts.isNewExpression(value) || ts.isTaggedTemplateExpression(value) || hidesGetter(value)) return false;
      if (ts.isIdentifier(value) && checker.getSymbolAtLocation(value)?.declarations?.some(ts.isParameter)) return false;
      if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
        const callerProof = parameterValueProof(value, (argument) => numericValue(argument, coercionOnly, next));
        if (callerProof !== undefined) return callerProof;
        const symbol = ts.isPropertyAccessExpression(value) ? checker.getSymbolAtLocation(value.name) : undefined;
        if (symbol?.declarations?.some((declaration) => ts.isGetAccessor(declaration) || ts.isSetAccessor(declaration))) return false;
      }
      const query = sourceValueSummary(sourceReference(value));
      return query.closed && query.routes.size > 0 && [...query.routes.values()].every((route) => primitiveKind(route.value) === "number");
    };
    const safeComputedDataKey = (node) => {
      const key = staticKey(node);
      if (key !== undefined) return !["constructor", "__proto__", "prototype"].includes(key);
      const input = unwrap(node);
      if (ts.isPrefixUnaryExpression(input) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(input.operator)) return true;
      if (ts.isBinaryExpression(input)) {
        if ([ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.AsteriskAsteriskToken, ts.SyntaxKind.SlashToken, ts.SyntaxKind.PercentToken,
          ts.SyntaxKind.LessThanLessThanToken, ts.SyntaxKind.GreaterThanGreaterThanToken, ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
          ts.SyntaxKind.AmpersandToken, ts.SyntaxKind.BarToken, ts.SyntaxKind.CaretToken].includes(input.operatorToken.kind)) return true;
        if (input.operatorToken.kind === ts.SyntaxKind.PlusToken && numericValue(input.left) && numericValue(input.right)) return true;
        if (input.operatorToken.kind === ts.SyntaxKind.PlusToken &&
            (ts.isCallExpression(unwrap(input.left)) && ts.isNumericLiteral(unwrap(input.right)) ||
             ts.isNumericLiteral(unwrap(input.left)) && ts.isCallExpression(unwrap(input.right)))) return true;
      }
      if (ts.isCallExpression(input)) {
        if (ts.isIdentifier(input.expression) && input.expression.text === "String" && globalReference(input.expression) && !["global", "globalThis"].some((root) => mutatedRoots.has(root)) && ![...provenance(input.expression)].some((root) => mutatedRoots.has(root)) && input.arguments.length === 1 &&
          numericValue(input.arguments[0])) return true;
        if (numericValue(input)) return true;
      }
      if ([...provenance(node)].some((root) => mutatedRoots.has(root))) {
        return numericValue(node);
      }
      if (ts.isIdentifier(input) && numericValue(input)) return true;
      const expression = unwrap(node);
      if (ts.isIdentifier(expression)) {
        const symbol = binding(expression);
        if (symbol && !mutatedRoots.has(symbol)) {
          const boundedCondition = (condition) => {
            const value = unwrap(condition);
            if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return boundedCondition(value.left) || boundedCondition(value.right);
            if (arrayIntrinsicsMutated || !ts.isCallExpression(value) || value.arguments.length !== 1) return false;
            const member = property(value.expression), argument = unwrap(value.arguments[0]);
            return member?.name === "includes" && ts.isArrayLiteralExpression(member.receiver) && member.receiver.elements.length > 0 &&
              member.receiver.elements.every((entry) => ts.isStringLiteralLike(entry) && !["constructor", "__proto__", "prototype"].includes(entry.text)) &&
              ts.isIdentifier(argument) && binding(argument) === symbol;
          };
          for (let branch = node; branch.parent; branch = branch.parent) {
            if (ts.isIfStatement(branch.parent) && branch.parent.thenStatement === branch && boundedCondition(branch.parent.expression)) return true;
          }
        }
        const declaration = symbol?.valueDeclaration;
        if (declaration && ts.isVariableDeclaration(declaration) && ts.isVariableDeclarationList(declaration.parent) && declaration.parent.flags & ts.NodeFlags.Const) {
          const loop = declaration.parent.parent;
          if (arrayIntrinsicsMutated && ts.isForOfStatement(loop) && ts.isArrayLiteralExpression(unwrap(loop.expression))) return false;
          if (ts.isForOfStatement(loop) && ts.isArrayLiteralExpression(unwrap(loop.expression)) &&
              unwrap(loop.expression).elements.every((entry) => ts.isStringLiteralLike(entry) && !["constructor", "__proto__", "prototype"].includes(entry.text))) return true;
        }
      }
      const value = origin(node);
      if (ts.isIdentifier(value) && bindingGetter(binding(value)?.valueDeclaration)) return false;
      const callerProof = parameterValueProof(value, safeComputedDataKey);
      if (callerProof !== undefined) {
        if (callerProof) return true;
        const actual = sourceValueSummary(sourceReference(input));
        return actual.closed && actual.routes.size > 0 && [...actual.routes.values()].every((route) => primitiveKind(route.value) === "number");
      }
      if (value !== input && ts.isBinaryExpression(value)) return safeComputedDataKey(value);
      if (ts.isConditionalExpression(value)) return safeComputedDataKey(value.whenTrue) && safeComputedDataKey(value.whenFalse);
      if (ts.isCallExpression(value)) {
        return false;
      }
      if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
        if (hidesGetter(value)) return false;
        const symbol = ts.isPropertyAccessExpression(value) ? checker.getSymbolAtLocation(value.name) : undefined;
        const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
        if (declaration && (ts.isGetAccessor(declaration) || ts.isSetAccessor(declaration))) return false;
        const query = sourceValueSummary(sourceReference(input));
        return query.closed && query.routes.size > 0 && [...query.routes.values()].every((route) => primitiveKind(route.value) === "number" ||
          route.value?.node && ts.isStringLiteralLike(unwrap(route.value.node)) && !["constructor", "__proto__", "prototype"].includes(unwrap(route.value.node).text));
      }
      if (ts.isCallExpression(value) || ts.isAwaitExpression(value) || ts.isNewExpression(value) || ts.isConditionalExpression(value) || ts.isBinaryExpression(value) || ts.isTaggedTemplateExpression(value)) return false;
      const query = sourceValueSummary(sourceReference(input));
      return query.closed && query.routes.size > 0 && [...query.routes.values()].every((route) => primitiveKind(route.value) === "number" ||
        route.value?.node && ts.isStringLiteralLike(unwrap(route.value.node)) && !["constructor", "__proto__", "prototype"].includes(unwrap(route.value.node).text));
    };
    const unsafeArraySelection = (receiver, selector) => {
      const pending = [receiver], visited = new Set();
      const name = staticKey(selector);
      const provedIndex = name !== undefined ? name === "length" || /^(0|[1-9][0-9]*)$/.test(name) : numericValue(selector);
      while (pending.length) {
        const value = origin(pending.pop());
        if (visited.has(value)) continue;
        visited.add(value);
        if (ts.isArrayLiteralExpression(value) && !provedIndex) return true;
        const declaration = ts.isIdentifier(value) ? binding(value)?.valueDeclaration : value;
        if (declaration && (ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration) || ts.isFunctionDeclaration(declaration) ||
            ts.isMethodDeclaration(declaration) || ts.isClassDeclaration(declaration) || ts.isClassExpression(declaration))) return true;
        if (ts.isConditionalExpression(value)) pending.push(value.whenTrue, value.whenFalse);
      }
      return false;
    };
    const unsafeComputedReceiver = (node, seen = new Set(), dataIndex = false, dataKey = dataIndex) => {
      const provenData = dataKey;
      if (!provenData && [...provenance(node)].some((root) => mutatedRoots.has(root))) return true;
      const expression = origin(node);
      if (seen.has(expression)) return true;
      const next = new Set([...seen, expression]);
      if (!provenData && ts.isElementAccessExpression(unwrap(node)) && !/^(0|[1-9][0-9]*)$/.test(staticKey(unwrap(node).argumentExpression) ?? "")) return true;
      const resolvedType = dataType(expression);
      if (resolvedType.getCallSignatures().length || resolvedType.getConstructSignatures().length || ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return true;
      if (ts.isCallExpression(expression) || ts.isAwaitExpression(expression) || ts.isNewExpression(expression) ||
          ts.isConditionalExpression(expression) || ts.isBinaryExpression(expression) || ts.isTaggedTemplateExpression(expression)) {
        if (!provenData || dataType(expression).getCallSignatures().length) return true;
      }
      const symbol = ts.isIdentifier(expression) ? checker.getSymbolAtLocation(expression) : undefined;
      const declaration = symbol?.valueDeclaration;
      if (!provenData && declaration && ts.isParameter(declaration) && !plainData(expression)) return true;
      const destructured = declaration && ts.isBindingElement(declaration) ? declaration : undefined;
      if (destructured?.initializer && unsafeComputedReceiver(destructured.initializer, next)) return true;
      const member = property(expression) ?? (destructured ? bindingMember(destructured) : undefined);
      if (!member) return false;
      if (unsafeComputedReceiver(member.receiver, next, dataIndex, provenData)) return true;
      const receiver = origin(member.receiver);
      if (ts.isArrayLiteralExpression(receiver)) {
        if (receiver.elements.some(ts.isSpreadElement)) return !dataIndex;
        return receiver.elements.some((entry, index) => !ts.isOmittedExpression(entry) &&
          (member.name === undefined || member.name === String(index)) && unsafeComputedReceiver(entry, next));
      }
      if (!ts.isObjectLiteralExpression(receiver)) return false;
      return receiver.properties.some((entry) => {
        if (ts.isSpreadAssignment(entry)) return true;
        const name = ownName(entry.name);
        if (member.name !== undefined && name !== undefined && name !== member.name) return false;
        if (ts.isMethodDeclaration(entry) || ts.isGetAccessorDeclaration(entry) || ts.isSetAccessorDeclaration(entry)) return true;
        return ts.isPropertyAssignment(entry) ? unsafeComputedReceiver(entry.initializer, next)
          : ts.isShorthandPropertyAssignment(entry) && unsafeComputedReceiver(entry.name, next);
      });
    };
    const reviewedDescriptor = (node) => {
      if (id !== `${ARENA}/src/challengeContract/validation.ts`) return false;
      const failDeclaration = source.statements.filter(ts.isVariableStatement).flatMap((statement) => [...statement.declarationList.declarations])
        .find((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === "fail");
      if (failDeclaration?.getText(source) !== 'fail = (path: string, code = "SCHEMA"): never => { throw new ContractError(path, code); }' || !checkedAnchorDeclaration(failDeclaration)) return false;
      for (let declaration = node; declaration; declaration = declaration.parent) {
        if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) && declaration.name.text === "inspectDto") {
          return checkedAnchorDeclaration(declaration) && sha256(declaration.getText(source)) === "d8652cde892c49aca2285f14a6720c718d622fb5cf3cfc97308c118d7ae46008";
        }
      }
      return false;
    };
    const reviewedArrayDescriptor = (node) => {
      if (id !== `${ARENA}/src/challengeContract/validation.ts` || node.getText(source) !== "Object.getOwnPropertyDescriptor") return false;
      const call = node.parent;
      if (!ts.isCallExpression(call) || call.expression !== node || call.getText(source) !== "Object.getOwnPropertyDescriptor(value, String(index))") return false;
      for (let declaration = call; declaration; declaration = declaration.parent) {
        if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) && declaration.name.text === "array") {
          return checkedAnchorDeclaration(declaration) && declaration.getText(source) === `array = (value: unknown, path: string, max = 64): unknown[] => {
  if (!Array.isArray(value) || value.length > max || Reflect.ownKeys(value).length !== value.length + 1) return fail(path, "ARRAY");
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return fail(path, "ARRAY");
  }
  return value;
}` && source.statements.filter(ts.isVariableStatement).flatMap((statement) => [...statement.declarationList.declarations])
            .some((entry) => entry.getText(source) === 'fail = (path: string, code = "SCHEMA"): never => { throw new ContractError(path, code); }');
        }
      }
      return false;
    };
    const validationIntrinsicRoot = (node, seen = new Set()) => {
      const value = origin(node);
      if (seen.has(value)) return false;
      if (ts.isIdentifier(value)) return ["Object", "Array", "Reflect", "Number", "String", "Map", "Set", "Symbol", "Uint8Array", "ArrayBuffer", "globalThis", "global", "window", "self"].includes(value.text) && globalReference(value);
      if (ts.isCallExpression(value)) {
        const method = property(value.expression);
        if (method && ["getPrototypeOf", "getOwnPropertyDescriptor"].includes(method.name) && builtinNamespace(method.receiver, "Object") && value.arguments[0]) {
          return validationIntrinsicRoot(value.arguments[0], new Set([...seen, value]));
        }
      }
      const member = property(value);
      return Boolean(member && validationIntrinsicRoot(member.receiver, new Set([...seen, value])));
    };
    const validationIntrinsicsChanged = () => [...memberMutationTargets, ...arrayMutatorTargets, ...intrinsicMutationTargets].some((target) => validationIntrinsicRoot(target)) ||
      ["Object", "Array", "Reflect", "Number", "String", "Map", "Set", "Symbol", "Uint8Array", "ArrayBuffer", "globalThis", "global", "window", "self"].some((name) => numericAssignments.has(name) || nonNumericWrites.has(name));
    const anchorGlobals = intrinsicNames;
    const checkedAnchorCache = new WeakMap();
    const checkedAnchorDeclaration = (declaration) => {
      if (checkedAnchorCache.has(declaration)) return checkedAnchorCache.get(declaration);
      if (!(ts.isVariableDeclaration(declaration) || ts.isFunctionDeclaration(declaration) || ts.isClassDeclaration(declaration)) || !declaration.name || !ts.isIdentifier(declaration.name)) return false;
      if (ts.isVariableDeclaration(declaration) ? declaration.parent.parent.parent !== source || !(declaration.parent.flags & ts.NodeFlags.Const) : declaration.parent !== source) return false;
      const symbol = binding(declaration.name);
      if (symbol?.declarations?.length !== 1 || numericAssignments.has(symbol) || nonNumericWrites.has(symbol)) return false;
      let valid = true;
      const scan = (node) => {
        if (ts.isIdentifier(node) && valueUse(node) && anchorGlobals.has(node.text) && !globalReference(node)) valid = false;
        ts.forEachChild(node, scan);
      };
      scan(declaration);
      checkedAnchorCache.set(declaration, valid);
      return valid;
    };
    const byteIntrinsicAnchors = new Map([
      ["typedArrayPrototype", ["d8b2a7d37da68bfbd8b3c496c5642775060ea5a5f72c287246c5b3171d092d14", ["Object.getPrototypeOf(Uint8Array.prototype)"]]],
      ["typedArrayName", ["75fcb7c4e68ebf8d0cff37db9248ff097daabb020ec70a1d690f8b99bd9214a7", ["Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)"]]],
      ["typedArrayByteLength", ["1e010d6adc37fef32ea456ae25ae0e6883edcef2e70360848a5da9196529574e", ['Object.getOwnPropertyDescriptor(typedArrayPrototype, "byteLength")']]],
      ["typedArraySet", ["478fdf2348bff8de1bb369cdb2b4e0044a1aba98a30bf7259e694b198404facb", []]],
      ["checkedByteLength", ["68460b229537b644bb0618c83afbb220817916cada1719bc55bcf73a843cbbad", []]],
      ["copyBytes", ["b316bf4bfdc21109c17eaabec0135f46ae19c2b0b4af1c5e2463ace1eb6ba207", []]],
      ["byteEqual", ["8d4f9bea85e3eec7eae6410a11f8419fb49fa882bfbcb34a8a02871856f491df", []]],
      ["parseBytes", ["a3d76ef5193831bbaf1177c43d9cdef66c99814e22efdb8d1964a64b86a05e88", []]],
    ]);
    let byteContextValid;
    const reviewedByteIntrinsic = (node) => {
      if (id !== `${ARENA}/src/authorized/v2/schema.ts`) return false;
      const declarations = source.statements.filter(ts.isVariableStatement).flatMap((statement) => [...statement.declarationList.declarations]);
      byteContextValid ??= !validationIntrinsicsChanged() && [...byteIntrinsicAnchors].every(([name, [digest]]) => {
        const entries = declarations.filter((entry) => ts.isIdentifier(entry.name) && entry.name.text === name);
        const entry = entries[0];
        const symbol = entry && binding(entry.name);
        return entries.length === 1 && checkedAnchorDeclaration(entry) && sha256(entry.getText(source)) === digest && !numericAssignments.has(symbol) && !nonNumericWrites.has(symbol);
      });
      if (!byteContextValid) return false;
      const definitionNode = ts.isVariableDeclaration(node);
      if (!definitionNode && (!ts.isPropertyAccessExpression(node) || !builtinNamespace(node.expression, "Object") ||
          !ts.isCallExpression(node.parent) || node.parent.expression !== node)) return false;
      const call = definitionNode ? undefined : node.parent.getText(source);
      for (let declaration = node; declaration; declaration = declaration.parent) {
        const anchor = ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) && byteIntrinsicAnchors.get(declaration.name.text);
        if (anchor) return declaration.parent.parent.parent === source && (definitionNode || anchor[1].includes(call));
      }
      return false;
    };
    const validationNames = new Map([
      [`${ARENA}/src/authorized/v2/schema.ts`, ["object", "tag", "array"]],
      [`${CORE}/src/rules/counted-planning.ts`, ["record", "inventory", "readMap", "readSet"]],
      [`${TRAINING}/src/composition.ts`, ["validateHistory"]],
    ]);
    const reviewedValidationDescriptor = (node) => {
      const v2 = id === `${ARENA}/src/authorized/v2/schema.ts`;
      const counted = id === `${CORE}/src/rules/counted-planning.ts`;
      const history = id === `${TRAINING}/src/composition.ts`;
      const declarationNode = ts.isVariableDeclaration(node);
      if ((!v2 && !counted && !history) || !declarationNode && (!ts.isPropertyAccessExpression(node) ||
          !ts.isCallExpression(node.parent) || node.parent.expression !== node)) return false;
      const call = declarationNode ? undefined : node.parent.getText(source);
      const anchors = v2 ? {
        object: ["a9ec2ae254afdbc710f7204ce7863a00d31b70d18ea23cf9dd32986e84212182", ["Object.getPrototypeOf(value)", "Object.getOwnPropertyDescriptor(value, key)"]],
        tag: ["71273fcd58c4a1bcc137ec5f1f1afb783d2bdbdc7a63aa9d635632a6e53e022e", ["Object.getPrototypeOf(value)", "Object.getOwnPropertyDescriptor(value, key)"]],
        array: ["9984d20eae9a6f3e932ab3aa61b39a4174481887e46bfff00bf704e05e25821f", ["Object.getPrototypeOf(value)", 'Object.getOwnPropertyDescriptor(value, "length")', "Object.getOwnPropertyDescriptor(value, String(i))"]],
      } : counted ? {
        record: ["a2e4ba72aff3962a17956cfed244188ca0022d10836e97ed480a221f765a46dd", ["Object.getPrototypeOf(value)", "Object.getOwnPropertyDescriptor(value, key)"]],
        inventory: ["0c8c1a1cf66a0f30a8be64654ae0850573d3e2bc72bdd6b1651fbbbde38a3646", ["Object.getPrototypeOf(value)", 'Object.getOwnPropertyDescriptor(value, "length")', "Object.getOwnPropertyDescriptor(value, String(i))"]],
        readMap: ["318d771321985067dcd99a8464de19040854c3dec98101fef0312731ed8f7789", ["Object.getPrototypeOf(value)"]],
        readSet: ["16ae0d17c4858336e74dcb2cd740129df1f2a081f0a56852450622c330bf8c60", ["Object.getPrototypeOf(value)"]],
      } : {
        validateHistory: ["2d6c1780be2d6f668b5a5797e99c8e83fff093e763a95d1b32b0afc3c8a0fde5", ["Object.getPrototypeOf(input)", "Object.getOwnPropertyDescriptor(input, key)", "Object.getPrototypeOf(r.everLit)", 'Object.getOwnPropertyDescriptor(r.everLit, "length")', "Object.getOwnPropertyDescriptor(r.everLit, String(i))"]],
      };
      const imports = source.statements.filter(ts.isImportDeclaration);
      const declarations = source.statements.filter(ts.isVariableStatement).flatMap((statement) => [...statement.declarationList.declarations]);
      if (counted && ["fail", "square", "piece"].some((name) => {
        const entries = declarations.filter((entry) => ts.isIdentifier(entry.name) && entry.name.text === name);
        return entries.length !== 1 || !checkedAnchorDeclaration(entries[0]);
      })) return false;
      if (history) {
        const failures = declarations.filter((entry) => ts.isIdentifier(entry.name) && entry.name.text === "historyFailure");
        const errors = source.statements.filter(ts.isClassDeclaration).filter((entry) => entry.name?.text === "ContractError");
        const failure = failures[0], error = errors[0];
        if (failures.length !== 1 || errors.length !== 1 || !checkedAnchorDeclaration(failure) || !checkedAnchorDeclaration(error) || failure.getText(source) !== 'historyFailure = (path: string, code = "SCHEMA"): never => { throw new ContractError(path, code); }' ||
            sha256(error.getText(source)) !== "4e4027ca9cd7c79cc0f90b22f75fecdd9d950c7d3cb8177b21f5685a0e876e88") return false;
        const failureSymbol = binding(failure.name), errorSymbol = binding(error.name);
        if (failureSymbol?.declarations?.length !== 1 || errorSymbol?.declarations?.length !== 1 ||
            [...memberMutationTargets, ...arrayMutatorTargets, ...intrinsicMutationTargets].some((target) => { const roots = provenance(target); return roots.has(failureSymbol) || roots.has(errorSymbol); })) return false;
      }
      if (v2 && !imports.some((entry) => entry.getText(source) === 'import { fail, MAX_CODEC_BYTES } from "../../challengeContract/validation";') ||
          counted && !declarations.some((entry) => checkedAnchorDeclaration(entry) && entry.getText(source) === 'fail = (): never => { throw new TypeError("Invalid counted planning knowledge"); }') ||
          validationIntrinsicsChanged()) return false;
      for (let declaration = node; declaration; declaration = declaration.parent) {
        const anchor = ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) && new Map(Object.entries(anchors)).get(declaration.name.text);
        if (anchor) {
          const [digest, calls] = anchor;
          return checkedAnchorDeclaration(declaration) && sha256(declaration.getText(source)) === digest && (declarationNode || calls.includes(call));
        }
      }
      return false;
    };
    const reviewedDataAccess = (node) => {
      const anchors = new Map([
        [`${ARENA}/src/authorized/v2/schema.ts`, [["canonical", "68e1d2acef686f11b36d33e2d3101c8a3a482ec290b0076f5b3645cd3060ea68", "r[k]"]]],
        [`${ARENA}/src/authorized/v2/observation.ts`, [["readSnapshot", "3b8145712ce2dda71f8d675789ac8d7858c002a6f5339de373e141ead9465701", "cells[SQUARES.indexOf(at)]"]]],
        [`${CORE}/src/rules/counted-planning.ts`, [
          ["readonlyMap", "8e3075a3f7ad51c68c1f9cc3c26fb678709a826e3d1e1a0b8afc72981317e85d", "map[Symbol.iterator]"],
          ["readonlySet", "c18f8c541b3b3d4bcce9ad63e515bf150dfa20eb4defb055dce900c18a4dcd31", "set[Symbol.iterator]"],
        ]],
      ]);
      const anchor = anchors.get(id)?.find((entry) => node.getText(source) === entry[2]);
      if (!anchor || validationIntrinsicsChanged()) return false;
      for (let declaration = node; declaration; declaration = declaration.parent) {
        if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) && declaration.name.text === anchor[0]) {
          return checkedAnchorDeclaration(declaration) && sha256(declaration.getText(source)) === anchor[1];
        }
      }
      return false;
    };
    function wrappedUse(node) {
      const parent = node.parent;
      return (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent) || ts.isTypeAssertionExpression(parent) || ts.isSatisfiesExpression(parent)) && parent.expression === node ||
        ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.CommaToken && parent.right === node ? wrappedUse(parent) : node;
    }
    function valueUse(node) {
      if (ts.isPartOfTypeNode(node)) return false;
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return true;
      if (!ts.isIdentifier(node)) return false;
      const parent = node.parent;
      return !(ts.isPropertyAccessExpression(parent) && parent.name === node ||
        (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent) || ts.isMethodSignature(parent) ||
          ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent) || ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isClassDeclaration(parent)) && parent.name === node ||
        ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent));
    }
    const metadataMutator = (node, seen = new Set()) => {
      const value = origin(node);
      if (seen.has(value)) return false;
      const next = new Set([...seen, value]);
      if (ts.isCallExpression(value)) {
        const method = property(origin(value.expression));
        return Boolean(method?.name === "bind" && metadataMutator(method.receiver, next));
      }
      const declaration = ts.isIdentifier(value) ? binding(value)?.valueDeclaration : undefined;
      const method = property(value) ?? (declaration && ts.isBindingElement(declaration) ? bindingMember(declaration) : undefined);
      if (!method) return false;
      if (["call", "apply", "bind"].includes(method.name)) return metadataMutator(method.receiver, next);
      return ["__defineGetter__", "__defineSetter__"].includes(method.name) || builtinNamespace(method.receiver, "Object") && ["assign", "defineProperty", "defineProperties", "setPrototypeOf", "freeze", "seal", "preventExtensions"].includes(method.name) ||
        builtinNamespace(method.receiver, "Reflect") && ["set", "deleteProperty", "defineProperty", "setPrototypeOf", "preventExtensions"].includes(method.name);
    };
    const localMetadataCapture = (declaration, name) => {
      const symbol = binding(name);
      return ts.isVariableDeclaration(declaration) && ts.isVariableDeclarationList(declaration.parent) && Boolean(declaration.parent.flags & ts.NodeFlags.Const) &&
        !(ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Export) && symbol?.declarations?.length === 1 && !numericAssignments.has(symbol) && !nonNumericWrites.has(symbol);
    };
    const checkMetadataUse = (node) => {
      if (ts.isBindingElement(node) && ts.isIdentifier(node.name) && metadataMutator(node.name) && !localMetadataCapture(node.parent.parent, node.name)) throw new Error(`Code constructor acquisition in public closure: ${id} -> metadata mutator capture`);
      if (!valueUse(node) || !metadataMutator(node)) return;
      const use = wrappedUse(node), parent = use.parent;
      if (ts.isVariableDeclaration(parent) && parent.initializer === use && ts.isIdentifier(parent.name) && localMetadataCapture(parent, parent.name)) return;
      const member = property(parent);
      if (member && member.receiver === use && ["call", "apply", "bind"].includes(member.name)) return;
      if (ts.isCallExpression(parent)) {
        const method = property(origin(parent.expression));
        if (parent.expression === use && (mutationInvocation(parent.expression, parent.arguments) !== undefined || method?.name === "bind")) return;
        if (parent.arguments[0] === use && method?.name === "apply" && builtinNamespace(method.receiver, "Reflect") && mutationInvocation(parent.expression, parent.arguments) !== undefined) return;
        const capture = property(origin(node));
        if (parent.arguments[0] === use && parent.arguments.length === 1 && method?.name === "map" && arrayValue(method.receiver) && !intrinsicTarget(method.receiver) &&
            capture?.name === "freeze" && builtinNamespace(capture.receiver, "Object")) return;
      }
      throw new Error(`Code constructor acquisition in public closure: ${id} -> metadata mutator escape: ${node.getText(source)}`);
    };
    const timerReference = (node) => {
      const expression = origin(node), member = property(expression);
      return ts.isIdentifier(expression) && ["setTimeout", "setInterval", "setImmediate"].includes(expression.text) && globalReference(expression) ||
        member && ["setTimeout", "setInterval", "setImmediate"].includes(member.name ?? "") && hostRoot(member.receiver);
    };
    const callableTimerArgument = (node) => {
      if (!node || ts.isSpreadElement(node)) return false;
      const expression = unwrap(node), value = origin(expression);
      if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return true;
      if (!ts.isIdentifier(expression)) return false;
      const callableType = (type) => !(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Union)) && type.getCallSignatures().length > 0;
      if (!callableType(dataType(expression))) return false;
      return ts.isArrowFunction(value) || ts.isFunctionExpression(value) || ts.isIdentifier(value) && callableType(dataType(value));
    };
    const scan = (node) => {
      checkMetadataUse(node);
      if (ts.isCallExpression(node)) checkPrimitiveNativeCall(node);
      const returned = ts.isReturnStatement(node) ? node.expression : ts.isArrowFunction(node) && !ts.isBlock(node.body) ? node.body : undefined;
      const exported = ts.isVariableDeclaration(node) && Boolean(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) ? node.initializer
        : ts.isIdentifier(node) && ts.isExportSpecifier(node.parent) && !node.parent.isTypeOnly && !node.parent.parent.parent.isTypeOnly ? node : undefined;
      if ((returned || exported) && intrinsicTarget(returned ?? exported, new Map(), true)) throw new Error(`Code constructor acquisition in public closure: ${id} -> intrinsic reference escape`);
      if (id === `${ARENA}/src/authorized/v2/schema.ts` && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) &&
          node.parent.parent.parent === source && byteIntrinsicAnchors.has(node.name.text) && !reviewedByteIntrinsic(node)) throw new Error(`Code constructor acquisition in public closure: ${id} -> ${node.name.text}`);
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.parent.parent.parent === source && validationNames.get(id)?.includes(node.name.text) &&
          !reviewedValidationDescriptor(node)) throw new Error(`Code constructor acquisition in public closure: ${id} -> ${node.name.text}`);
      if (id === `${ARENA}/src/challengeContract/validation.ts` && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) &&
          node.name.text === "inspectDto" && !reviewedDescriptor(node)) throw new Error(`Code constructor acquisition in public closure: ${id}`);
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) {
          const typeOnly = ts.isImportDeclaration(node) ? node.importClause?.isTypeOnly === true ||
            !node.importClause?.name && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
            node.importClause.namedBindings.elements.length > 0 && node.importClause.namedBindings.elements.every((item) => item.isTypeOnly) : node.isTypeOnly;
          edge(literal(node.moduleSpecifier), ts.isImportDeclaration(node) ? "import" : "export", Boolean(typeOnly));
        }
      } else if (ts.isImportTypeNode(node)) edge(ts.isLiteralTypeNode(node.argument) ? literal(node.argument.literal) : undefined, "import-type", true);
      else if (ts.isImportEqualsDeclaration(node)) throw new Error(`CommonJS in public closure: ${id}`);
      else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) throw new Error(`Dynamic import in public closure: ${id}`);
      if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) throw new Error(`Import metadata in public closure: ${id}`);
      const member = !ts.isPartOfTypeNode(node) && (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) ? property(node) : undefined;
      const assignment = ts.isElementAccessExpression(node) && ts.isBinaryExpression(node.parent) && node.parent.left === node ? node.parent.operatorToken.kind : undefined;
      const directDataWrite = assignment === ts.SyntaxKind.EqualsToken ||
        [ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken].includes(assignment);
      const scalarComparison = ts.isElementAccessExpression(node) && (ts.isTemplateSpan(node.parent) || ts.isTypeOfExpression(node.parent) || ts.isBinaryExpression(node.parent) &&
         [ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken,
           ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
           ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.AsteriskAsteriskToken, ts.SyntaxKind.SlashToken, ts.SyntaxKind.PercentToken,
           ts.SyntaxKind.AmpersandToken, ts.SyntaxKind.BarToken, ts.SyntaxKind.CaretToken, ts.SyntaxKind.LessThanLessThanToken,
           ts.SyntaxKind.GreaterThanGreaterThanToken, ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken]
          .includes(node.parent.operatorToken.kind));
      const hostName = member?.name;
      if (member && hostRoot(member.receiver) && ["eval", "Function", "process"].includes(hostName ?? "") ||
          ts.isElementAccessExpression(node) && hostRoot(node.expression) && staticKey(node.argumentExpression) === undefined) throw new Error(`Host acquisition in public closure: ${id}`);
      if (valueUse(node) && timerReference(node)) {
        const use = wrappedUse(node), call = use.parent;
        if (!ts.isCallExpression(call) || call.expression !== use || !callableTimerArgument(call.arguments[0])) throw new Error(`Host timer evaluation in public closure: ${id}`);
      }
      const reflected = valueUse(node) ? property(origin(node)) : undefined;
      const descriptorSeam = reflected && builtinNamespace(reflected.receiver, "Object") && ["getPrototypeOf", "getOwnPropertyDescriptors"].includes(reflected.name ?? "") &&
        reviewedDescriptor(node) && ts.isCallExpression(node.parent) && node.parent.expression === node;
      if (reflected && (builtinNamespace(reflected.receiver, "Reflect") && ["get", "getOwnPropertyDescriptor", undefined].includes(reflected.name) ||
          builtinNamespace(reflected.receiver, "Object") && ["getOwnPropertyDescriptor", "getPrototypeOf", "getOwnPropertyDescriptors", undefined].includes(reflected.name)) &&
          !descriptorSeam && !reviewedArrayDescriptor(node) && !reviewedValidationDescriptor(node) && !reviewedByteIntrinsic(node)) throw new Error(`Code constructor acquisition in public closure: ${id} -> ${node.getText(source)}`);
      const boundName = ts.isBindingElement(node) ? node.propertyName ? ownName(node.propertyName) : ts.isIdentifier(node.name) ? node.name.text : undefined : undefined;
      const bound = ts.isBindingElement(node) ? bindingMember(node) : undefined;
      if (ts.isBindingElement(node) && (["constructor", "__proto__", "__defineGetter__", "__defineSetter__", "eval", "Function", "process", "setTimeout", "setInterval", "setImmediate", "getOwnPropertyDescriptor", "getPrototypeOf", "getOwnPropertyDescriptors"].includes(boundName ?? "") ||
          bound?.name === "get" && builtinNamespace(bound.receiver, "Reflect") || node.propertyName && ts.isComputedPropertyName(node.propertyName))) throw new Error(`Code constructor acquisition in public closure: ${id}`);
      const computedUse = ts.isElementAccessExpression(node) ? wrappedUse(node) : undefined;
      const discardedComputed = computedUse && (ts.isVoidExpression(computedUse.parent) || ts.isExpressionStatement(computedUse.parent) ||
        ts.isBinaryExpression(computedUse.parent) && computedUse.parent.operatorToken.kind === ts.SyntaxKind.CommaToken && computedUse.parent.left === computedUse);
      if (ts.isElementAccessExpression(node) && !directDataWrite && !discardedComputed &&
          !reviewedDescriptor(node) && !reviewedDataAccess(node) && unsafeArraySelection(node.expression, node.argumentExpression)) {
        throw new Error(`Code constructor acquisition in public closure: ${id} -> unproved array selector: ${node.getText(source)}`);
      }
      if (["constructor", "__proto__", "__defineGetter__", "__defineSetter__"].includes(member?.name) ||
          ts.isElementAccessExpression(node) && !directDataWrite && !ts.isVoidExpression(node.parent) && !reviewedDescriptor(node) && !reviewedDataAccess(node) && unsafeComputedReceiver(node.expression, new Set(),
            /^(0|[1-9][0-9]*)$/.test(staticKey(node.argumentExpression) ?? ""), scalarComparison || safeComputedDataKey(node.argumentExpression))) throw new Error(`Code constructor acquisition in public closure: ${id} -> ${node.getText(source)}`);
      if (ts.isIdentifier(node) && !ts.isPartOfTypeNode(node)) {
        const parent = node.parent;
        const propertyName = ts.isPropertyAccessExpression(parent) && parent.name === node ||
          (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)) && parent.name === node;
        if (!propertyName && globalReference(node) && ["process", "require", "module", "__dirname", "__filename", "eval", "Function"].includes(node.text)) throw new Error(`Host global in public closure: ${id} -> ${node.text}`);
      }
      if (ts.isPropertyAccessExpression(node) && (node.name.text === "getBuiltinModule" || node.name.text === "process" &&
          ts.isIdentifier(node.expression) && ["globalThis", "global"].includes(node.expression.text) && globalReference(node.expression))) throw new Error(`Host acquisition in public closure: ${id}`);
      if (ts.isElementAccessExpression(node) && (literal(node.argumentExpression) === "getBuiltinModule" || literal(node.argumentExpression) === "process" &&
          ts.isIdentifier(node.expression) && ["globalThis", "global"].includes(node.expression.text) && globalReference(node.expression))) throw new Error(`Host acquisition in public closure: ${id}`);
      ts.forEachChild(node, scan);
    };
    scan(source);
  };
  const entries = modelEntries.map(({ owner, subpath, path }) => {
    visit(path);
    return { package: manifests.get(owner).name, subpath, path: display(path) };
  });
  const sorted = (records) => [...records.values()].sort((a, b) => order(a.path, b.path));
  const sourceFiles = sorted(sources);
  const dependencyFiles = sorted(dependencies);
  const runtimeFiles = sorted(runtime);
  edges.sort((a, b) => order(JSON.stringify(a), JSON.stringify(b)));
  const arenaManifest = JSON.parse(readFileSync(safe(join(repository, ARENA, "package.json"), resolve(repository)), "utf8"));
  const rootManifest = JSON.parse(readFileSync(safe(join(repository, "package.json"), resolve(repository)), "utf8"));
  const toolPath = toolRequire.resolve("typescript");
  const declaredBy = typeof rootManifest.devDependencies?.typescript === "string" ? "package.json" :
    typeof arenaManifest.devDependencies?.typescript === "string" ? `${ARENA}/package.json` : undefined;
  if (!declaredBy) throw new Error("Undeclared TypeScript audit tool");
  const report = {
    version: "public-closure-v2", passed: true, conditions: [...conditions], entries,
    verifiedPaths: [...sourceFiles, ...dependencyFiles].map((file) => file.path),
    sourceFiles, dependencyFiles, runtimeFiles, edges,
    sourceSha256: sha256(JSON.stringify(sourceFiles)), dependencySha256: sha256(JSON.stringify(dependencyFiles)),
    runtimeSha256: sha256(JSON.stringify(runtimeFiles)),
    tooling: { package: "typescript", version: ts.version, declaredBy, path: relative(repository, realpathSync(toolPath)).split(sep).join("/"), sha256: sha256(readFileSync(toolPath)) },
  };
  return { ...report, closureSha256: sha256(JSON.stringify(report)) };
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.stdout.write(`${JSON.stringify(checkPublicClosure(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ version: "public-closure-v2", passed: false, error: error.message })}\n`);
    process.exitCode = 1;
  }
}
