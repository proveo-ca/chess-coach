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
  const visit = (path, dependency) => {
    if (visited.has(path)) return;
    visited.add(path);
    if (!dependency) permitSource(path);
    const bytes = readFileSync(path);
    const id = dependency ? `${dependency.name}@${dependency.version}/${relative(dependency.base, path).split(sep).join("/")}` : display(path);
    (dependency ? dependencies : sources).set(id, { path: id, ...(dependency ? { resolvedPath: display(path) } : {}), sha256: sha256(bytes) });
    const source = ts.createSourceFile(path, bytes.toString("utf8"), ts.ScriptTarget.Latest, true, /\.m?js$/.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS);
    if (source.parseDiagnostics.length) throw new Error(`Invalid closure syntax: ${id}`);
    const options = { noLib: true, noResolve: true, allowJs: true };
    const host = ts.createCompilerHost(options);
    host.getSourceFile = (file) => file === path ? source : undefined;
    const checker = ts.createProgram([path], options, host).getTypeChecker();
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
    const globalReference = (node) => {
      const symbol = checker.getSymbolAtLocation(node);
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
      const symbol = ts.isShorthandPropertyAssignment(expression.parent) ? checker.getShorthandAssignmentValueSymbol(expression.parent)
        : checker.getSymbolAtLocation(expression);
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
      const symbol = ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : ts.isExportSpecifier(node.parent) ? checker.getExportSpecifierLocalTargetSymbol(node.parent) : checker.getSymbolAtLocation(node);
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
      return ts.isIdentifier(expression) && expression.text === name && globalReference(expression) || member?.name === name &&
        hostRoot(member.receiver);
    };
    const mutatedRoots = new Set();
    const nonNumericWrites = new Set();
    const numericAssignments = new Map();
    const callableAssignments = new Map();
    const assignmentTargets = [];
    let callableAssignmentCount = 0;
    const addCallableAssignments = (target, values) => {
      const entries = [...values];
      if (!entries.length) return;
      for (const root of provenance(target)) {
        let assigned = callableAssignments.get(root);
        if (!assigned) { assigned = new Set(); callableAssignments.set(root, assigned); }
        for (const value of entries) if (!assigned.has(value)) { assigned.add(value); callableAssignmentCount++; }
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
    const invocationMutationRoots = new Set();
    const mutationCalls = [];
    let mutationNodeCount = 0;
    let arrayIntrinsicsMutated = false;
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
    const markMutation = (node) => {
      if (!memberMutationTargets.includes(node)) memberMutationTargets.push(node);
      for (const root of provenance(node)) { mutatedRoots.add(root); invocationMutationRoots.add(root); }
      if (arrayIntrinsicRoot(node)) arrayIntrinsicsMutated = true;
    };
    const freshError = (node) => {
      const value = origin(node);
      if (!ts.isNewExpression(value)) return false;
      const ctor = origin(value.expression);
      return ts.isIdentifier(ctor) && ["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "URIError", "EvalError", "AggregateError"].includes(ctor.text) &&
        globalReference(ctor) && ![...provenance(value.expression)].some((root) => mutatedRoots.has(root));
    };
    const scanMutations = (node) => {
      mutationNodeCount++;
      const writes = (target, numeric = false) => {
        if (ts.isIdentifier(target)) { const symbol = binding(target) ?? target.text; mutatedRoots.add(symbol); if (!numeric) nonNumericWrites.add(symbol); if (["Array", "Object", "String", "Number", "Boolean", "JSON"].includes(symbol)) arrayIntrinsicsMutated = true; }
        else if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) markMutation(target);
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
              !freshError(target)) arrayIntrinsicsMutated = true;
        } else if (indirect && node.arguments.some((argument) => argumentMutator(argument))) arrayIntrinsicsMutated = true;
        if (mutatorRoot(node.expression) || indirect && node.arguments.some((argument) => argumentMutator(argument))) for (const builtin of ["Math", "String", "Number", "Array", "globalThis", "global"]) mutatedRoots.add(builtin);
        if (node.arguments[0] && member && (builtinNamespace(member.receiver, "Object") && ["assign", "defineProperty", "defineProperties"].includes(member.name ?? "") ||
            builtinNamespace(member.receiver, "Reflect") && ["set", "deleteProperty", "defineProperty"].includes(member.name ?? ""))) markMutation(node.arguments[0]);
        if (member && ["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"].includes(member.name ?? "")) markMutation(member.receiver);
      }
      ts.forEachChild(node, scanMutations);
    };
    scanMutations(source);
    arrayIntrinsicsMutated ||= arrayMutatorTargets.some((target) => !freshError(target));
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
      if (!declaration || !ts.isParameter(declaration) || declaration.initializer || declaration.dotDotDotToken || mutatedRoots.has(symbol)) return undefined;
      const fn = declaration.parent, index = +fn.parameters.indexOf(declaration);
      const owner = ts.isFunctionDeclaration(fn) ? fn : ts.isArrowFunction(fn) || ts.isFunctionExpression(fn) ? fn.parent : undefined;
      if (!owner || !(ts.isFunctionDeclaration(owner) || ts.isVariableDeclaration(owner)) || !owner.name || !ts.isIdentifier(owner.name) ||
          ts.getCombinedModifierFlags(owner) & ts.ModifierFlags.Export) return undefined;
      const callable = binding(owner.name);
      if (mutatedRoots.has(callable)) return undefined;
      const calls = [];
      let escaped = false;
      const scan = (child) => {
        if (ts.isIdentifier(child) && child !== owner.name && valueUse(child) && binding(child) === callable) {
          const use = wrappedUse(child), parent = use.parent;
          if (!ts.isCallExpression(parent) || parent.expression !== use || parent.arguments.some(ts.isSpreadElement)) escaped = true;
          else calls.push(parent);
        }
        ts.forEachChild(child, scan);
      };
      scan(source);
      if (escaped || !calls.length || calls.some((call) => !call.arguments[index])) return undefined;
      return calls.map((call) => call.arguments[index]);
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
      for (const value of values) if (!assigned.has(value)) { assigned.add(value); callableAssignmentCount++; }
    };
    for (const { target, value } of assignmentTargets) {
      const path = parameterPath(target);
      if (path) addCallableParameterAssignments(path.declaration, [value]);
    }
    const inheritCallableAssignments = (declaration, argument) => {
      const values = callableParameterAssignments.get(declaration);
      if (!values?.size) return;
      addCallableAssignments(argument, values);
      const path = parameterPath(argument);
      if (path) addCallableParameterAssignments(path.declaration, values);
    };
    const mutationParameters = new Set();
    const pendingMutationParameters = [];
    const queueMutationParameter = (target) => {
      const path = parameterPath(target);
      if (path && !mutationParameters.has(path.declaration)) {
        mutationParameters.add(path.declaration);
        pendingMutationParameters.push(path.declaration);
      }
    };
    const markArgumentMutation = (argument, seen = new Set()) => {
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
    const localParameterCallables = (node) => {
      const path = parameterPath(node);
      if (!path) return [];
      const fn = path.declaration.parent;
      if (!ts.isFunctionDeclaration(fn) && !ts.isFunctionExpression(fn) && !ts.isArrowFunction(fn)) return [];
      const index = +fn.parameters.indexOf(path.declaration);
      const values = [];
      for (const call of mutationCalls) {
        const callee = origin(call.expression);
        const target = ts.isIdentifier(callee) ? binding(callee)?.valueDeclaration : callee;
        if (target !== fn) continue;
        if (staleInvocationSource(call.expression)) throw new Error(`Unsupported parameter mutation callee in public closure: ${id} -> ${call.expression.getText(source)}`);
        let value = invocationArguments(call.arguments)?.[index];
        for (const key of path.keys) value = value && ownMember(origin(value), key);
        if (value) values.push(value);
      }
      return values;
    };
    const localInvocation = (expression, args, depth = 0, expected, invoked = true) => {
      if (depth > 16) throw new Error(`Unsupported parameter mutation wrapper in public closure: ${id}`);
      const stale = staleInvocationSource(expression);
      if (invoked && !property(unwrap(expression)) && [...provenance(expression)].some((root) => numericAssignments.has(root) || nonNumericWrites.has(root))) {
        return { unproved: true, callee: expression, args };
      }
      if (!invoked && stale && expected) for (const root of provenance(expression)) {
        for (const value of numericAssignments.get(root) ?? []) {
          const assigned = origin(value);
          const target = ts.isIdentifier(assigned) ? binding(assigned)?.valueDeclaration : assigned;
          if (target === expected) throw new Error(`Unsupported parameter mutation callback in public closure: ${id}`);
        }
      }
      const callee = origin(expression);
      if (ts.isCallExpression(callee)) {
        const creation = localInvocation(callee.expression, invocationArguments(callee.arguments), depth + 1, expected);
        if (!creation?.bound) return undefined;
        const combined = creation.bound.args && args ? [...creation.bound.args, ...args] : undefined;
        const invocation = localInvocation(creation.bound.receiver, combined, depth + 1, expected);
        if (stale && invocation?.target) throw new Error(`Unsupported parameter mutation callee in public closure: ${id} -> ${expression.getText(source)}`);
        return invocation;
      }
      const member = property(callee);
      if (member?.name === "apply" && builtinNamespace(member.receiver, "Reflect")) {
        return args?.[0] ? localInvocation(args[0], invocationArray(args[2]), depth + 1, expected) : undefined;
      }
      if (member && ["call", "apply", "bind"].includes(member.name)) {
        const values = member.name === "apply" ? invocationArray(args?.[1]) : args?.slice(1);
        const invocation = localInvocation(member.receiver, values, depth + 1, expected);
        return member.name === "bind" ? { ...invocation, bound: { receiver: member.receiver, args: values } } : invocation;
      }
      if (member) {
        const holder = origin(member.receiver);
        const replacedHolder = [...provenance(member.receiver)].some((root) =>
          (numericAssignments.has(root) || nonNumericWrites.has(root)) &&
          (!ts.isArrayLiteralExpression(holder) || [...callableAssignments.get(root) ?? []].some((value) => !ts.isArrayLiteralExpression(origin(value)))));
        if (invoked && stale && (replacedHolder || ts.isObjectLiteralExpression(holder) || ts.isArrayLiteralExpression(holder) && (member.name === undefined || /^(0|[1-9][0-9]*)$/.test(member.name)))) return { unproved: true, callee: expression, args };
        if (ts.isObjectLiteralExpression(holder) && member.name !== undefined && !holder.properties.some(ts.isSpreadAssignment)) {
          const entries = holder.properties.filter((entry) => !ts.isSpreadAssignment(entry) && ownName(entry.name) === member.name);
          if (entries.length === 1 && ts.isMethodDeclaration(entries[0])) return { target: entries[0], args };
        }
        const receiver = localInvocation(member.receiver, undefined, depth + 1, expected, false);
        return receiver?.target ? { target: receiver.target } : undefined;
      }
      const target = ts.isIdentifier(callee) ? binding(callee)?.valueDeclaration : callee;
      if (expected && ts.isIdentifier(callee) && target && (ts.isParameter(target) || ts.isBindingElement(target))) {
        for (const value of localParameterCallables(callee)) {
          const invocation = localInvocation(value, args, depth + 1, expected, invoked);
          if (invocation?.target === expected) return invocation;
        }
        return undefined;
      }
      if (target && (ts.isFunctionDeclaration(target) || ts.isFunctionExpression(target) || ts.isArrowFunction(target))) {
        if (stale) throw new Error(`Unsupported parameter mutation callee in public closure: ${id} -> ${expression.getText(source)}`);
        return { target, args };
      }
      if (invoked && stale) return { unproved: true, callee: expression, args };
      return undefined;
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
        if (!value || localInvocation(value, [], 0, expected, false)?.target !== expected) return false;
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
      if (invocation?.target === fn) {
        const boundArgument = invocation.args?.[+index];
        if (!boundArgument) throw new Error(`Unsupported parameter mutation callback in public closure: ${id} -> ${fn.getText(source).slice(0, 160)}`);
        markArgumentMutation(boundArgument);
      } else if (ts.isArrayLiteralExpression(value)) {
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
    const mutationStateSize = () => mutatedRoots.size + invocationMutationRoots.size + mutationParameters.size + callableAssignmentCount;
    memberMutationTargets.forEach(queueMutationParameter);
    let previousMutationState;
    let mutationPass = 0;
    do {
      if (++mutationPass > mutationNodeCount * 6 + 1) throw new Error(`Unsupported parameter mutation convergence in public closure: ${id}`);
      previousMutationState = mutationStateSize();
      for (const call of mutationCalls) {
        const invocation = localInvocation(call.expression, invocationArguments(call.arguments));
        if (!invocation?.unproved) continue;
        if (!invocation.args) throw new Error(`Unsupported parameter mutation arguments in public closure: ${id}`);
        for (const argument of invocation.args) markArgumentMutation(argument);
      }
      for (let cursor = 0; cursor < pendingMutationParameters.length; cursor++) {
        const declaration = pendingMutationParameters[cursor];
        const fn = declaration.parent;
        if (!ts.isFunctionDeclaration(fn) && !ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn) && !ts.isMethodDeclaration(fn)) continue;
        const index = +fn.parameters.indexOf(declaration);
        for (const call of mutationCalls) {
          const invocation = localInvocation(call.expression, invocationArguments(call.arguments), 0, fn);
          if (invocation?.target !== fn && !(invocation?.unproved && invocation.callee && callableCandidates(invocation.callee).has(fn))) {
            for (const [argumentIndex, argument] of call.arguments.entries()) {
              if (!localCallbackParameter(invocation?.target, argumentIndex, argument, fn)) mutationCallback(ts.isSpreadElement(argument) ? argument.expression : argument, fn, index);
            }
            continue;
          }
          if (!invocation.args) {
            if (invocation.bound) continue;
            throw new Error(`Unsupported parameter mutation arguments in public closure: ${id}`);
          }
          if (declaration.dotDotDotToken) {
            for (const argument of invocation.args.slice(index)) { inheritCallableAssignments(declaration, argument); markArgumentMutation(argument); }
          } else {
            const argument = invocation.args[index];
            const defaulted = !argument || !nonUndefinedArgument(argument);
            if (argument) { inheritCallableAssignments(declaration, argument); markArgumentMutation(argument); }
            if (defaulted && declaration.initializer) { inheritCallableAssignments(declaration, declaration.initializer); markArgumentMutation(declaration.initializer); }
            const defaults = (node) => {
              if (ts.isBindingElement(node) && node.initializer) { inheritCallableAssignments(declaration, node.initializer); markArgumentMutation(node.initializer); }
              ts.forEachChild(node, defaults);
            };
            if (!ts.isIdentifier(declaration.name)) defaults(declaration.name);
          }
        }
      }
    } while (previousMutationState !== mutationStateSize());
    arrayIntrinsicsMutated ||= arrayMutatorTargets.some((target) => !freshError(target));
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
      if (!declaration || !ts.isParameter(declaration) || declaration.initializer || declaration.dotDotDotToken || mutatedRoots.has(symbol)) return false;
      const fn = declaration.parent, index = +fn.parameters.indexOf(declaration);
      if (index === 1 && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isCallExpression(fn.parent) && !arrayIntrinsicsMutated) {
        const call = fn.parent, member = property(call.expression);
        if (member && (call.arguments[0] === fn && ["map", "flatMap", "filter", "forEach"].includes(member.name) && arrayValue(member.receiver) ||
            call.arguments[1] === fn && member.name === "from" && builtinNamespace(member.receiver, "Array"))) return true;
      }
      const values = parameterArguments(node);
      return values !== undefined && values.every((value) => numericValue(value, false, seen));
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
      if (mutatedNumericMember(input)) return false;
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
        if (!coercionOnly && dataType(input).flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return false;
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
      const type = dataType(value);
      return Boolean(type.flags & ts.TypeFlags.NumberLike) && !(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown));
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
      const safeType = (type) => type.isUnion() ? type.types.every(safeType)
        : Boolean(type.flags & ts.TypeFlags.NumberLike) || type.isStringLiteral() && !["constructor", "__proto__", "prototype"].includes(type.value);
      const value = origin(node);
      if (ts.isIdentifier(value) && bindingGetter(binding(value)?.valueDeclaration)) return false;
      const callerProof = parameterValueProof(value, safeComputedDataKey);
      if (callerProof !== undefined) return callerProof;
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
        const type = dataType(value);
        return !(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) && safeType(type);
      }
      if (ts.isCallExpression(value) || ts.isAwaitExpression(value) || ts.isNewExpression(value) || ts.isConditionalExpression(value) || ts.isBinaryExpression(value) || ts.isTaggedTemplateExpression(value)) return false;
      if (ts.isIdentifier(value) && checker.getSymbolAtLocation(value)?.declarations?.some(ts.isParameter)) {
        const literalData = (type) => type.isUnion() ? type.types.every(literalData)
          : type.isStringLiteral() && !["constructor", "__proto__", "prototype"].includes(type.value);
        return literalData(dataType(value));
      }
      return safeType(dataType(value));
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
      if (failDeclaration?.getText(source) !== 'fail = (path: string, code = "SCHEMA"): never => { throw new ContractError(path, code); }') return false;
      for (let declaration = node; declaration; declaration = declaration.parent) {
        if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) && declaration.name.text === "inspectDto") {
          return sha256(declaration.getText(source)) === "d8652cde892c49aca2285f14a6720c718d622fb5cf3cfc97308c118d7ae46008";
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
          return declaration.getText(source) === `array = (value: unknown, path: string, max = 64): unknown[] => {
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
      if (ts.isIdentifier(value)) return ["Object", "Array", "Reflect", "Number", "String", "Map", "Set", "Symbol"].includes(value.text) && globalReference(value);
      const member = property(value);
      return Boolean(member && validationIntrinsicRoot(member.receiver, new Set([...seen, value])));
    };
    const validationIntrinsicsChanged = () => memberMutationTargets.some((target) => validationIntrinsicRoot(target)) ||
      ["Object", "Array", "Reflect", "Number", "String", "Map", "Set", "Symbol"].some((name) => nonNumericWrites.has(name));
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
        object: ["cbae30e75c79871605332af369a8bc90b967c5764f310f809eb3bc178700b5ef", ["Object.getPrototypeOf(value)", "Object.getOwnPropertyDescriptor(value, key)"]],
        tag: ["71273fcd58c4a1bcc137ec5f1f1afb783d2bdbdc7a63aa9d635632a6e53e022e", ["Object.getPrototypeOf(value)", "Object.getOwnPropertyDescriptor(value, key)"]],
        array: ["9984d20eae9a6f3e932ab3aa61b39a4174481887e46bfff00bf704e05e25821f", ["Object.getPrototypeOf(value)", 'Object.getOwnPropertyDescriptor(value, "length")', "Object.getOwnPropertyDescriptor(value, String(i))"]],
      } : counted ? {
        record: ["a2e4ba72aff3962a17956cfed244188ca0022d10836e97ed480a221f765a46dd", ["Object.getPrototypeOf(value)", "Object.getOwnPropertyDescriptor(value, key)"]],
        inventory: ["0c8c1a1cf66a0f30a8be64654ae0850573d3e2bc72bdd6b1651fbbbde38a3646", ["Object.getPrototypeOf(value)", 'Object.getOwnPropertyDescriptor(value, "length")', "Object.getOwnPropertyDescriptor(value, String(i))"]],
        readMap: ["318d771321985067dcd99a8464de19040854c3dec98101fef0312731ed8f7789", ["Object.getPrototypeOf(value)"]],
        readSet: ["16ae0d17c4858336e74dcb2cd740129df1f2a081f0a56852450622c330bf8c60", ["Object.getPrototypeOf(value)"]],
      } : {
        validateHistory: ["7c6d19e2e1db913ae24f633f679a321d59fb8ac77619ae26433b59afcffaa13f", ["Object.getPrototypeOf(input)", "Object.getOwnPropertyDescriptor(input, key)", "Object.getPrototypeOf(r.everLit)", 'Object.getOwnPropertyDescriptor(r.everLit, "length")', "Object.getOwnPropertyDescriptor(r.everLit, String(i))"]],
      };
      const imports = source.statements.filter(ts.isImportDeclaration);
      const declarations = source.statements.filter(ts.isVariableStatement).flatMap((statement) => [...statement.declarationList.declarations]);
      if (v2 && !imports.some((entry) => entry.getText(source) === 'import { fail, MAX_CODEC_BYTES } from "../../challengeContract/validation";') ||
          counted && !declarations.some((entry) => entry.getText(source) === 'fail = (): never => { throw new TypeError("Invalid counted planning knowledge"); }') ||
          history && !declarations.some((entry) => entry.getText(source) === 'historyFailure = (): never => { throw new TypeError("Invalid authorized history V2"); }') ||
          validationIntrinsicsChanged()) return false;
      for (let declaration = node; declaration; declaration = declaration.parent) {
        const anchor = ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) && new Map(Object.entries(anchors)).get(declaration.name.text);
        if (anchor) {
          const [digest, calls] = anchor;
          return declaration.parent.parent.parent === source && sha256(declaration.getText(source)) === digest && (declarationNode || calls.includes(call));
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
          return declaration.parent.parent.parent === source && sha256(declaration.getText(source)) === anchor[1];
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
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && validationNames.get(id)?.includes(node.name.text) &&
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
          !descriptorSeam && !reviewedArrayDescriptor(node) && !reviewedValidationDescriptor(node)) throw new Error(`Code constructor acquisition in public closure: ${id} -> ${node.getText(source)}`);
      const boundName = ts.isBindingElement(node) ? node.propertyName ? ownName(node.propertyName) : ts.isIdentifier(node.name) ? node.name.text : undefined : undefined;
      const bound = ts.isBindingElement(node) ? bindingMember(node) : undefined;
      if (ts.isBindingElement(node) && (["constructor", "__proto__", "eval", "Function", "process", "setTimeout", "setInterval", "setImmediate", "getOwnPropertyDescriptor", "getPrototypeOf", "getOwnPropertyDescriptors"].includes(boundName ?? "") ||
          bound?.name === "get" && builtinNamespace(bound.receiver, "Reflect") || node.propertyName && ts.isComputedPropertyName(node.propertyName))) throw new Error(`Code constructor acquisition in public closure: ${id}`);
      if (["constructor", "__proto__"].includes(member?.name) ||
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
  const entries = [
    [CORE, "./planning-v1"], [ARENA, "./observations"], [ARENA, "./intent-codec-v1"], [ARENA, "./events"], [TRAINING, "./candidates"],
  ].map(([owner, subpath]) => {
    const path = resolveFile(resolve(root, owner, exportTarget(manifests.get(owner), subpath)), root);
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
