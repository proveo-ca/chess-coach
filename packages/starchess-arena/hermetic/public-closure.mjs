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
    if (!plain(exports) || JSON.stringify(Object.keys(exports).sort()) !== JSON.stringify(Object.keys(expected).sort()) ||
        Object.entries(expected).some(([subpath, target]) => !canonicalBranches(exports[subpath], target))) throw new Error(`Unapproved public export map: ${owner}`);
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
      ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node) ? unwrap(node.expression) : node;
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
    const property = (node) => {
      const expression = unwrap(node);
      if (ts.isPropertyAccessExpression(expression)) return { receiver: expression.expression, name: expression.name.text };
      if (ts.isElementAccessExpression(expression)) return { receiver: expression.expression, name: staticString(expression.argumentExpression) };
    };
    const origin = (node, seen = new Set(), members = new Set()) => {
      const expression = unwrap(node);
      if (members.has(expression)) return expression;
      const next = new Set([...members, expression]);
      const member = property(expression);
      if (member?.name !== undefined) {
        const receiver = origin(member.receiver, seen, next);
        if (ts.isObjectLiteralExpression(receiver)) {
          const entry = receiver.properties.find((entry) => !ts.isSpreadAssignment(entry) &&
            (ts.isComputedPropertyName(entry.name) ? staticString(entry.name.expression)
              : ts.isIdentifier(entry.name) || ts.isStringLiteralLike(entry.name) || ts.isNumericLiteral(entry.name) ? entry.name.text : undefined) === member.name);
          if (entry && ts.isPropertyAssignment(entry)) return origin(entry.initializer, seen, next);
          if (entry && ts.isShorthandPropertyAssignment(entry)) return origin(entry.name, seen, next);
        }
      }
      if (!ts.isIdentifier(expression)) return expression;
      const symbol = ts.isShorthandPropertyAssignment(expression.parent) ? checker.getShorthandAssignmentValueSymbol(expression.parent)
        : checker.getSymbolAtLocation(expression);
      if (!symbol || seen.has(symbol)) return expression;
      const declaration = symbol.valueDeclaration;
      return declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
        ? origin(declaration.initializer, new Set([...seen, symbol]), next) : expression;
    };
    const unsafeComputedReceiver = (node, seen = new Set()) => {
      const expression = origin(node);
      if (seen.has(expression)) return true;
      const next = new Set([...seen, expression]);
      if (checker.getTypeAtLocation(expression).getCallSignatures().length || ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return true;
      const member = property(expression);
      if (!member) return false;
      if (unsafeComputedReceiver(member.receiver, next)) return true;
      const receiver = origin(member.receiver);
      if (!ts.isObjectLiteralExpression(receiver)) return false;
      return receiver.properties.some((entry) => {
        if (ts.isSpreadAssignment(entry)) return unsafeComputedReceiver(entry.expression, next);
        const name = ts.isComputedPropertyName(entry.name) ? staticString(entry.name.expression)
          : ts.isIdentifier(entry.name) || ts.isStringLiteralLike(entry.name) ? entry.name.text : undefined;
        if (member.name !== undefined && name !== undefined && name !== member.name) return false;
        if (ts.isMethodDeclaration(entry) || ts.isGetAccessorDeclaration(entry) || ts.isSetAccessorDeclaration(entry)) return true;
        return ts.isPropertyAssignment(entry) ? unsafeComputedReceiver(entry.initializer, next)
          : ts.isShorthandPropertyAssignment(entry) && unsafeComputedReceiver(entry.name, next);
      });
    };
    const scan = (node) => {
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
      if (!dependency && (["constructor", "__proto__"].includes(member?.name) ||
          ts.isElementAccessExpression(node) && unsafeComputedReceiver(node.expression))) throw new Error(`Code constructor acquisition in public closure: ${id}`);
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
