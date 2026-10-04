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
  "src/observations.ts", "src/intent-codec-v1.ts",
  ...["types", "canonical", "squares", "observationCodec"].map((name) => `src/authorized/v1/${name}.ts`),
  ...["validation", "candidateWire", "observationCodec"].map((name) => `src/challengeContract/${name}.ts`),
]);
const reviewedCoreLinks = new Map([
  [`${ARENA}/src/authorized/v1/observationCodec.ts`, new Set([`${CORE}/src/rules/constants.ts`, `${CORE}/src/board/mines.ts`])],
  [`${ARENA}/src/challengeContract/candidateWire.ts`, new Set([`${CORE}/src/rules/constants.ts`, `${CORE}/src/rules/specials/registry.ts`])],
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
    ? exports[subpath] : subpath === "." ? exports : undefined;
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
    [CORE, { ".": "./src/index.ts" }],
    [ARENA, { ".": "./src/index.ts", "./intent-codec-v1": "./src/intent-codec-v1.ts", "./observations": "./src/observations.ts" }],
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
    if (owner === ARENA && !authorized.has(local)) throw new Error(`Host/baseline in public closure: ${display(path)}`);
    if (owner === TRAINING && /^src\/(?:coordinator|cli)\//.test(local)) throw new Error(`Coordinator in public closure: ${display(path)}`);
    return owner;
  };
  const resolveImport = (importer, specifier, dependency) => {
    if (isBuiltin(specifier) || specifier.startsWith("node:")) throw new Error(`Node builtin in public closure: ${display(importer)} -> ${specifier}`);
    if (specifier.startsWith(".")) {
      const target = resolveFile(resolve(dirname(importer), specifier), dependency?.base ?? root);
      if (!dependency) {
        const owner = permitSource(target);
        if (owner !== sourceOwner(importer) && !reviewedCoreLinks.get(display(importer))?.has(display(target))) throw new Error(`Deep private cross-package import: ${display(importer)} -> ${display(target)}`);
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
      return { path: target };
    }
    if (!["fflate", "@noble/hashes"].includes(name)) throw new Error(`Unreviewed public dependency: ${specifier}`);
    if (name === "@noble/hashes" && !dependency && !["@noble/hashes/sha2.js", "@noble/hashes/utils.js"].includes(specifier)) throw new Error(`Unreviewed SHA export: ${specifier}`);
    const packagePath = join(dependency?.base ?? join(root, owner), "node_modules", name);
    const base = realpathSync(packagePath);
    let resolvedPackage = dependencyPackages.get(base);
    if (!resolvedPackage) {
      const path = safe(join(base, "package.json"), base);
      const installed = JSON.parse(readFileSync(path, "utf8"));
      if (installed.name !== name || name === "@noble/hashes" && (installed.version !== "2.4.0" || installed.type !== "module")) throw new Error(`Unexpected dependency package: ${name}`);
      if (name === "@noble/hashes" && manifest.dependencies?.[name] !== "2.4.0") throw new Error("SHA dependency must declare exact 2.4.0");
      resolvedPackage = { base, manifest: installed, name, version: installed.version };
      dependencyPackages.set(base, resolvedPackage);
      const id = `${name}@${installed.version}/package.json`;
      dependencies.set(id, { path: id, resolvedPath: display(path), sha256: sha256(readFileSync(path)) });
    }
    const target = exportTarget(resolvedPackage.manifest, subpath);
    if (name === "fflate" && target !== "./esm/browser.js") throw new Error(`fflate did not select browser ESM: ${target}`);
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
      if (typeOnly && !specifier.startsWith(".") && !byName.has(packageName(specifier)) && !isBuiltin(specifier) && !specifier.startsWith("node:")) {
        const manifest = dependency?.manifest ?? manifests.get(sourceOwner(path));
        const name = packageName(specifier);
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
        const entry = receiver.elements[Number(name)];
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
    const binding = (node) => ts.isShorthandPropertyAssignment(node.parent) ? checker.getShorthandAssignmentValueSymbol(node.parent)
      : checker.getSymbolAtLocation(node);
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
    const builtinNamespace = (node, name) => {
      const expression = origin(node), member = property(expression);
      return ts.isIdentifier(expression) && expression.text === name && globalReference(expression) || member?.name === name &&
        ts.isIdentifier(member.receiver) && ["globalThis", "global"].includes(member.receiver.text) && globalReference(member.receiver);
    };
    const mutatedRoots = new Set();
    const markMutation = (node) => { for (const root of provenance(node)) mutatedRoots.add(root); };
    const scanMutations = (node) => {
      const writes = (target) => {
        if (ts.isIdentifier(target)) mutatedRoots.add(binding(target) ?? target.text);
        else if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) markMutation(target);
        else if (ts.isParenthesizedExpression(target) || ts.isAsExpression(target) || ts.isNonNullExpression(target) || ts.isTypeAssertionExpression(target)) writes(target.expression);
        else if (ts.isArrayLiteralExpression(target)) for (const child of target.elements) writes(child);
        else if (ts.isObjectLiteralExpression(target)) for (const child of target.properties) writes(child);
        else if (ts.isPropertyAssignment(target)) writes(target.initializer);
        else if (ts.isShorthandPropertyAssignment(target)) writes(target.name);
        else if (ts.isSpreadElement(target) || ts.isSpreadAssignment(target)) writes(target.expression);
        else if (ts.isBinaryExpression(target) && target.operatorToken.kind === ts.SyntaxKind.EqualsToken) writes(target.left);
      };
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) writes(node.left);
      if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) writes(node.operand);
      if (ts.isDeleteExpression(node)) writes(node.expression);
      if ((ts.isForOfStatement(node) || ts.isForInStatement(node)) && !ts.isVariableDeclarationList(node.initializer)) writes(node.initializer);
      if (ts.isCallExpression(node)) {
        const member = property(origin(node.expression));
        if (node.arguments[0] && member && (builtinNamespace(member.receiver, "Object") && ["assign", "defineProperty", "defineProperties"].includes(member.name ?? "") ||
            builtinNamespace(member.receiver, "Reflect") && ["set", "deleteProperty", "defineProperty"].includes(member.name ?? ""))) markMutation(node.arguments[0]);
        if (member && ["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"].includes(member.name ?? "")) markMutation(member.receiver);
      }
      ts.forEachChild(node, scanMutations);
    };
    scanMutations(source);
    const safeComputedDataKey = (node) => {
      const key = staticKey(node);
      if (key !== undefined) return !["constructor", "__proto__", "prototype"].includes(key);
      const expression = unwrap(node);
      if (ts.isIdentifier(expression)) {
        const symbol = binding(expression);
        if (symbol && !mutatedRoots.has(symbol)) {
          const boundedCondition = (condition) => {
            const value = unwrap(condition);
            if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return boundedCondition(value.left) || boundedCondition(value.right);
            if (!ts.isCallExpression(value) || value.arguments.length !== 1) return false;
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
          if (ts.isForOfStatement(loop) && ts.isArrayLiteralExpression(unwrap(loop.expression)) &&
              unwrap(loop.expression).elements.every((entry) => ts.isStringLiteralLike(entry) && !["constructor", "__proto__", "prototype"].includes(entry.text))) return true;
        }
      }
      if (ts.isBinaryExpression(expression) && ([ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.AsteriskAsteriskToken,
          ts.SyntaxKind.SlashToken, ts.SyntaxKind.PercentToken, ts.SyntaxKind.LessThanLessThanToken, ts.SyntaxKind.GreaterThanGreaterThanToken,
          ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken, ts.SyntaxKind.AmpersandToken, ts.SyntaxKind.BarToken, ts.SyntaxKind.CaretToken].includes(expression.operatorToken.kind) ||
          expression.operatorToken.kind === ts.SyntaxKind.PlusToken && (ts.isNumericLiteral(unwrap(expression.left)) || ts.isNumericLiteral(unwrap(expression.right))))) return true;
      const safeType = (type) => type.isUnion() ? type.types.every(safeType)
        : Boolean(type.flags & ts.TypeFlags.NumberLike) || type.isStringLiteral() && !["constructor", "__proto__", "prototype"].includes(type.value);
      return safeType(dataType(node));
    };
    const unsafeComputedReceiver = (node, seen = new Set(), dataIndex = false, dataKey = dataIndex) => {
      const provenData = dataKey;
      if (!provenData && [...provenance(node)].some((root) => mutatedRoots.has(root))) return true;
      const expression = origin(node);
      if (seen.has(expression)) return true;
      const next = new Set([...seen, expression]);
      if (checker.getTypeAtLocation(expression).getCallSignatures().length || ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return true;
      if (ts.isCallExpression(expression) || ts.isAwaitExpression(expression) || ts.isNewExpression(expression) ||
          ts.isConditionalExpression(expression) || ts.isBinaryExpression(expression) || ts.isTaggedTemplateExpression(expression)) {
        if (!provenData || dataType(expression).getCallSignatures().length) return true;
      }
      const symbol = ts.isIdentifier(expression) ? checker.getSymbolAtLocation(expression) : undefined;
      const declaration = symbol?.valueDeclaration;
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
    const scan = (node) => {
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
      const directDataWrite = ts.isElementAccessExpression(node) && ts.isBinaryExpression(node.parent) && node.parent.left === node &&
        node.parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
      const scalarComparison = ts.isElementAccessExpression(node) && (ts.isTypeOfExpression(node.parent) || ts.isBinaryExpression(node.parent) &&
        [ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken,
          ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken]
          .includes(node.parent.operatorToken.kind));
      if (!dependency && (["constructor", "__proto__"].includes(member?.name) ||
          ts.isElementAccessExpression(node) && !directDataWrite && !reviewedDescriptor(node) && unsafeComputedReceiver(node.expression, new Set(),
            /^(0|[1-9][0-9]*)$/.test(staticKey(node.argumentExpression) ?? ""), scalarComparison || safeComputedDataKey(node.argumentExpression)))) throw new Error(`Code constructor acquisition in public closure: ${id} -> ${node.getText(source)}`);
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
    [CORE, "."], [ARENA, "./observations"], [ARENA, "./intent-codec-v1"], [TRAINING, "./candidates"],
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
    version: "public-closure-v1", passed: true, conditions: [...conditions], entries,
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
    process.stderr.write(`${JSON.stringify({ version: "public-closure-v1", passed: false, error: error.message })}\n`);
    process.exitCode = 1;
  }
}
