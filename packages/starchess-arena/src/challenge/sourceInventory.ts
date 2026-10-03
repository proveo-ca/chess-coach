// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { isBuiltin } from "node:module";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { canonical } from "./config";

export const SOURCE_INVENTORY_VERSION = "challenge-source-inventory-v1";
export const SOURCE_POLICY_VERSION = "challenge-source-policy-v1";
export type SourcePartition = "execution" | "contracts" | "diagnostics";
export type SourceFileRecord = { path: string; sha256: string; partition: SourcePartition };
export type RuntimeFileRecord = { path: string; present: boolean; sha256: string | null };
export type ImportAuditEdge = {
  importer: string; specifier: string; kind: "import" | "export" | "dynamic" | "require" | "import-type" | "resolve" | "worker";
  target: string; targetKind: "source" | "builtin" | "external"; typeOnly?: boolean;
};
export type SourceImportAudit = { passed: true; edges: ImportAuditEdge[]; auditedFiles: string[] };
export type SourceInventoryV1 = {
  version: typeof SOURCE_INVENTORY_VERSION;
  policyVersion: typeof SOURCE_POLICY_VERSION;
  roots: readonly string[];
  entrypoints: readonly string[];
  files: SourceFileRecord[];
  groups: Record<SourcePartition, SourceFileRecord[]>;
  runtime: RuntimeFileRecord[];
  executionSha256: string;
  contractsSha256: string;
  diagnosticsSha256: string;
  runtimeConfigurationSha256: string;
  inventorySha256: string;
  audit: SourceImportAudit;
};

const CORE = "packages/starchess-core";
const ARENA = "packages/starchess-arena";
const ROOTS = Object.freeze([`${CORE}/src`, `${ARENA}/src`, "scripts", `${ARENA}/hermetic`].sort());
const ENTRYPOINTS = Object.freeze([
  `${CORE}/src/index.ts`, `${ARENA}/src/cli/challenge.ts`, `${ARENA}/src/challenge/worker.ts`,
  "scripts/challenge-contract-evidence.ts", `${ARENA}/hermetic/run.mjs`, `${ARENA}/hermetic/runtime.mjs`,
].sort());
const REQUIRED_RUNTIME = [
  "package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", `${CORE}/package.json`, `${CORE}/tsconfig.json`,
  `${ARENA}/package.json`, `${ARENA}/tsconfig.json`, `${ARENA}/hermetic/pins.json`,
];
const OPTIONAL_RUNTIME = [
  ".npmrc", ".pnpmfile.cjs", "pnpmfile.cjs", "tsconfig.json", "tsconfig.base.json", "nx.json",
  "vitest.config.ts", "vite.config.ts",
  ...[CORE, ARENA].flatMap((path) => [".npmrc", ".pnpmfile.cjs", "pnpmfile.cjs", "vitest.config.ts"].map((name) => `${path}/${name}`)),
];
const CODE_EXTENSION = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const hash = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const order = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const excludedTest = (path: string): boolean =>
  (path.startsWith(`${CORE}/src/`) || path.startsWith(`${ARENA}/src/`)) && path.split("/").includes("__tests__");
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export const collectSourceInventory = (
  root: string = fileURLToPath(new URL("../../../../", import.meta.url)),
): SourceInventoryV1 => {
  const absoluteRoot = resolve(root);
  const safePath = (path: string): string => {
    if (path.startsWith("/") || path.split("/").some((part) => !part || part === "." || part === "..") || path.includes("\\")) {
      throw new Error(`Unsafe inventory path: ${path}`);
    }
    const parts = absoluteRoot.split(sep).filter(Boolean);
    let absolute: string = sep;
    for (const part of [...parts, ...path.split("/")]) {
      absolute = join(absolute, part);
      let stat;
      try { stat = lstatSync(absolute); }
      catch (error) {
        if (object(error) && error.code === "ENOENT") return join(absoluteRoot, path);
        throw error;
      }
      if (stat.isSymbolicLink()) throw new Error(`Symlink in inventory: ${path}`);
    }
    return absolute;
  };
  const present = (path: string): boolean => {
    try { return lstatSync(safePath(path)).isFile(); }
    catch (error) { if (object(error) && error.code === "ENOENT") return false; throw error; }
  };
  const bytes = (path: string): Buffer => readFileSync(safePath(path));
  const json = (path: string): Record<string, unknown> => {
    const parsed: unknown = JSON.parse(bytes(path).toString("utf8"));
    if (!object(parsed)) throw new Error(`Invalid manifest: ${path}`);
    return parsed;
  };
  const classify = (path: string): SourcePartition => {
    const matches: SourcePartition[] = [];
    if (path.startsWith(`${CORE}/src/`) || path.startsWith(`${ARENA}/src/`) && !path.startsWith(`${ARENA}/src/challengeContract/`)) matches.push("execution");
    if (path.startsWith(`${ARENA}/src/challengeContract/`)) matches.push("contracts");
    if (path.startsWith("scripts/") || path.startsWith(`${ARENA}/hermetic/`)) matches.push("diagnostics");
    if (matches.length !== 1) throw new Error(`Unclassified or overlapping source: ${path}`);
    return matches[0]!;
  };
  const files: SourceFileRecord[] = [];
  const walk = (path: string): void => {
    const stat = lstatSync(safePath(path));
    if (stat.isDirectory()) {
      for (const name of readdirSync(safePath(path)).sort(order)) walk(`${path}/${name}`);
    } else if (stat.isFile()) {
      if (/\.(?:sh|bash|py|wasm|node|so|c|cc|cpp|rs)$/.test(path)) throw new Error(`Unsupported executable source: ${path}`);
      if (!excludedTest(path)) files.push({ path, sha256: hash(bytes(path)), partition: classify(path) });
    } else throw new Error(`Special file in inventory: ${path}`);
  };
  for (const path of ROOTS) walk(path);
  files.sort((a, b) => order(a.path, b.path));
  const listed = new Map(files.map((file) => [file.path, file]));
  for (const path of ENTRYPOINTS) if (!listed.has(path)) throw new Error(`Missing inventory entrypoint: ${path}`);

  const runtime = new Map<string, RuntimeFileRecord>();
  const addRuntime = (path: string, required: boolean): void => {
    if (runtime.has(path)) return;
    let exists = false;
    try {
      const stat = lstatSync(safePath(path));
      if (!stat.isFile()) throw new Error(`Non-file runtime configuration: ${path}`);
      exists = true;
    } catch (error) {
      if (!object(error) || error.code !== "ENOENT") throw error;
    }
    if (required && !exists) throw new Error(`Missing runtime configuration: ${path}`);
    runtime.set(path, { path, present: exists, sha256: exists ? hash(bytes(path)) : null });
  };
  REQUIRED_RUNTIME.forEach((path) => addRuntime(path, true));
  OPTIONAL_RUNTIME.forEach((path) => addRuntime(path, false));
  const visited = new Set<string>();
  const active = new Set<string>();
  const configExtends = (path: string): void => {
    if (active.has(path)) throw new Error(`Cyclic tsconfig extends: ${path}`);
    if (visited.has(path)) return;
    addRuntime(path, true);
    active.add(path);
    const parsed = ts.parseConfigFileTextToJson(path, bytes(path).toString("utf8"));
    const config: unknown = parsed.config;
    if (parsed.error || !object(config)) throw new Error(`Invalid tsconfig: ${path}`);
    const parents = config.extends === undefined ? [] : Array.isArray(config.extends) ? config.extends : [config.extends];
    for (const parent of parents) {
      if (typeof parent !== "string" || !parent.startsWith(".")) throw new Error(`Unsafe tsconfig extends: ${path}`);
      const target = relative(absoluteRoot, resolve(absoluteRoot, dirname(path), parent)).split(sep).join("/");
      const candidates = extname(target) ? [target] : [target, `${target}.json`];
      const found = candidates.filter(present);
      if (found.length !== 1) throw new Error(`Missing or ambiguous tsconfig extends: ${path}`);
      configExtends(found[0]!);
    }
    active.delete(path);
    visited.add(path);
  };
  for (const path of [`${CORE}/tsconfig.json`, `${ARENA}/tsconfig.json`, "tsconfig.json", "tsconfig.base.json"]) {
    if (present(path)) configExtends(path);
  }

  const manifests = new Map(["", CORE, ARENA].map((path) => [path, json(path ? `${path}/package.json` : "package.json")]));
  const edges: ImportAuditEdge[] = [];
  const auditedFiles: string[] = [];
  const localTarget = (importer: string, specifier: string, absolute?: string): string => {
    const target = absolute ?? relative(absoluteRoot, resolve(absoluteRoot, dirname(importer), specifier)).split(sep).join("/");
    safePath(target);
    if (excludedTest(target)) throw new Error(`Import into excluded tests: ${importer} -> ${target}`);
    if (extname(target) && !CODE_EXTENSION.test(target) && extname(target) !== ".json") throw new Error(`Unaudited executable extension: ${importer} -> ${specifier}`);
    const candidates = extname(target) ? [target] : [target, ...[".ts", "/index.ts", ".mts", ".cts", ".tsx", ".js", "/index.js", ".mjs", ".cjs"].map((suffix) => `${target}${suffix}`)];
    const found = candidates.filter(present);
    if (found.length !== 1) throw new Error(`Missing or ambiguous import: ${importer} -> ${specifier}`);
    if (!listed.has(found[0]!)) throw new Error(`Unclassified import target: ${importer} -> ${found[0]}`);
    if (!CODE_EXTENSION.test(found[0]!) && extname(found[0]!) !== ".json") throw new Error(`Unaudited executable extension: ${importer} -> ${found[0]}`);
    return found[0]!;
  };
  const addEdge = (importer: string, specifier: string, kind: ImportAuditEdge["kind"], typeOnly = false): void => {
    let target = specifier;
    let targetKind: ImportAuditEdge["targetKind"];
    const owner = importer.startsWith(`${CORE}/`) ? CORE : importer.startsWith(`${ARENA}/`) ? ARENA : "";
    const manifest = manifests.get(owner)!;
    const name = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]!;
    const dependencies = [manifest.dependencies, manifest.devDependencies, manifest.optionalDependencies].filter(object);
    const lockedClosureLoader = importer === `${ARENA}/hermetic/closure.mjs` && ["resolve", "require"].includes(kind) && specifier === "esbuild" &&
      bytes("pnpm-lock.yaml").toString("utf8").includes("esbuild@");
    if (specifier.startsWith(".")) {
      target = localTarget(importer, specifier);
      targetKind = "source";
    } else if (isBuiltin(specifier)) targetKind = "builtin";
    else {
      if (specifier.startsWith("/") || (!lockedClosureLoader && !dependencies.some((dependency) => typeof dependency[name] === "string"))) {
        throw new Error(`Undeclared external import: ${importer} -> ${specifier}`);
      }
      const workspace = [...manifests.entries()].find(([path, value]) => path && value.name === name);
      if (workspace) {
        const [path, value] = workspace;
        const subpath = specifier === name ? "." : `.${specifier.slice(name.length)}`;
        const exported = object(value.exports) ? value.exports[subpath] : subpath === "." ? value.exports : undefined;
        if (typeof exported !== "string" || !exported.startsWith("./")) throw new Error(`Unsupported workspace export: ${specifier}`);
        target = localTarget(importer, specifier, `${path}/${exported.slice(2)}`);
        targetKind = "source";
      } else {
        if (dependencies.some((dependency) => typeof dependency[name] === "string" && String(dependency[name]).startsWith("workspace:"))) throw new Error(`Undeclared workspace target: ${specifier}`);
        targetKind = "external";
      }
    }
    if (targetKind === "source" && listed.get(importer)!.partition === "execution" && listed.get(target)!.partition !== "execution") {
      throw new Error(`Forbidden partition edge: ${importer} -> ${target}`);
    }
    if (targetKind === "source" && listed.get(importer)!.partition === "contracts" && listed.get(target)!.partition === "diagnostics") {
      throw new Error(`Forbidden partition edge: ${importer} -> ${target}`);
    }
    edges.push({ importer, specifier, kind, target, targetKind, ...(typeOnly ? { typeOnly: true } : {}) });
  };
  const literal = (node: ts.Node | undefined): string | undefined => node && ts.isStringLiteralLike(node) ? node.text : undefined;
  for (const file of files) {
    if (!CODE_EXTENSION.test(file.path)) continue;
    auditedFiles.push(file.path);
    const source = ts.createSourceFile(file.path, bytes(file.path).toString("utf8"), ts.ScriptTarget.Latest, true,
      /\.[cm]?js$/.test(file.path) ? ts.ScriptKind.JS : file.path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const diagnostics = (source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
    if (diagnostics.length) throw new Error(`Invalid source syntax: ${file.path}`);
    const bindingOptions: ts.CompilerOptions = { noLib: true, noResolve: true, allowJs: true };
    const host = ts.createCompilerHost(bindingOptions);
    host.getSourceFile = (path) => path === file.path ? source : undefined;
    const checker = ts.createProgram([file.path], bindingOptions, host).getTypeChecker();
    const binding = (node: ts.Identifier): ts.Symbol | string => {
      const parent = node.parent;
      const symbol = ts.isShorthandPropertyAssignment(parent) ? checker.getShorthandAssignmentValueSymbol(parent)
        : ts.isExportSpecifier(parent) ? checker.getExportSpecifierLocalTargetSymbol(parent) : checker.getSymbolAtLocation(node);
      return symbol?.declarations?.length ? symbol : node.text;
    };
    const requireNames = new Set<ts.Symbol | string>(["require"]);
    const requireFactories = new Set<ts.Symbol | string>(["createRequire"]);
    const moduleNamespaces = new Set<ts.Symbol | string>(["module"]);
    const processNamespaces = new Set<ts.Symbol | string>(["process"]);
    const globalNamespaces = new Set<ts.Symbol | string>(["globalThis", "global"]);
    const reflectionNamespaces = new Set<ts.Symbol | string>(["Reflect"]);
    const reassignedBindings = new Set<ts.Symbol | string>();
    const unwrapValue = (node: ts.Expression): ts.Expression => {
      if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) return unwrapValue(node.expression);
      return node;
    };
    const unwrap = (node: ts.Expression): ts.Expression => {
      const expression = unwrapValue(node);
      if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.CommaToken) return unwrap(expression.right);
      return expression;
    };
    const staticString = (node: ts.Expression, seen = new Set<ts.Symbol | string>()): string | undefined => {
      const expression = unwrapValue(node);
      if (ts.isStringLiteralLike(expression)) return expression.text;
      if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const a = staticString(expression.left, seen), b = staticString(expression.right, seen);
        return a === undefined || b === undefined ? undefined : a + b;
      }
      if (ts.isIdentifier(expression)) {
        const key = binding(expression);
        if (seen.has(key) || typeof key === "string") return undefined;
        const declaration = key.valueDeclaration;
        if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer &&
            ts.isVariableDeclarationList(declaration.parent) && declaration.parent.flags & ts.NodeFlags.Const) {
          return staticString(declaration.initializer, new Set([...seen, key]));
        }
      }
      return undefined;
    };
    const property = (node: ts.Expression): { receiver: ts.Expression; name: string | undefined } | undefined => {
      const expression = unwrap(node);
      if (ts.isPropertyAccessExpression(expression)) return { receiver: unwrap(expression.expression), name: expression.name.text };
      if (ts.isElementAccessExpression(expression)) return { receiver: unwrap(expression.expression), name: staticString(expression.argumentExpression) };
      return undefined;
    };
    const namespace = (node: ts.Expression): boolean => {
      const expression = unwrap(node);
      return ts.isIdentifier(expression) && moduleNamespaces.has(binding(expression));
    };
    const globalNamespace = (node: ts.Expression): boolean => {
      const expression = unwrap(node);
      const member = property(expression);
      return ts.isIdentifier(expression) && globalNamespaces.has(binding(expression)) || member !== undefined &&
        ["globalThis", "global"].includes(member.name ?? "") && globalNamespace(member.receiver);
    };
    const processNamespace = (node: ts.Expression): boolean => {
      const expression = unwrap(node);
      const member = property(expression);
      return ts.isIdentifier(expression) && processNamespaces.has(binding(expression)) || member !== undefined &&
        (member.name === "default" && processNamespace(member.receiver) || member.name === "process" && globalNamespace(member.receiver));
    };
    const reflectionNamespace = (node: ts.Expression): boolean => {
      const expression = unwrap(node), member = property(expression);
      return ts.isIdentifier(expression) && reflectionNamespaces.has(binding(expression)) ||
        member !== undefined && member.name === "Reflect" && globalNamespace(member.receiver);
    };
    const evaluation = (node: ts.Expression): boolean => {
      const expression = unwrap(node);
      const member = property(expression);
      const name = ts.isIdentifier(expression) ? binding(expression) : undefined;
      return name === "eval" || name === "Function" ||
        member !== undefined && ["eval", "Function"].includes(member.name ?? "") && globalNamespace(member.receiver);
    };
    const factory = (node: ts.Expression): boolean => {
      const expression = unwrap(node);
      const member = property(expression);
      return ts.isIdentifier(expression) && requireFactories.has(binding(expression)) || member !== undefined && member.name === "createRequire" && namespace(member.receiver);
    };
    const loader = (node: ts.Expression): boolean => {
      const expression = unwrap(node);
      const member = property(expression);
      return ts.isIdentifier(expression) && requireNames.has(binding(expression)) || ts.isCallExpression(expression) && factory(expression.expression) ||
        member !== undefined && member.name === "require" && namespace(member.receiver);
    };
    const resolver = (node: ts.Expression): boolean => {
      const member = property(node);
      return member !== undefined && member.name === "resolve" && loader(member.receiver);
    };
    const scanBindings = (node: ts.Node): void => {
      const writes = (target: ts.Node): void => {
        if (ts.isIdentifier(target)) reassignedBindings.add(binding(target));
        else if (ts.isParenthesizedExpression(target)) writes(target.expression);
        else if (ts.isArrayLiteralExpression(target)) for (const child of target.elements) writes(child);
        else if (ts.isObjectLiteralExpression(target)) for (const child of target.properties) writes(child);
        else if (ts.isPropertyAssignment(target)) writes(target.initializer);
        else if (ts.isShorthandPropertyAssignment(target)) writes(target.name);
        else if (ts.isSpreadElement(target) || ts.isSpreadAssignment(target)) writes(target.expression);
        else if (ts.isBinaryExpression(target) && target.operatorToken.kind === ts.SyntaxKind.EqualsToken) writes(target.left);
      };
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) writes(node.left);
      if ((ts.isForOfStatement(node) || ts.isForInStatement(node)) && !ts.isVariableDeclarationList(node.initializer)) writes(node.initializer);
      if (ts.isImportDeclaration(node) && ["node:module", "module"].includes(literal(node.moduleSpecifier) ?? "")) {
        if (node.importClause?.isTypeOnly) return;
        if (node.importClause?.name) moduleNamespaces.add(binding(node.importClause.name));
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) moduleNamespaces.add(binding(bindings.name));
        if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) {
          if (!element.isTypeOnly && (element.propertyName ?? element.name).text === "createRequire") requireFactories.add(binding(element.name));
          if (!element.isTypeOnly && ["default", "Module"].includes((element.propertyName ?? element.name).text)) moduleNamespaces.add(binding(element.name));
        }
      }
      if (ts.isImportDeclaration(node) && ["node:process", "process"].includes(literal(node.moduleSpecifier) ?? "") && !node.importClause?.isTypeOnly) {
        if (node.importClause?.name) processNamespaces.add(binding(node.importClause.name));
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) processNamespaces.add(binding(bindings.name));
        if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) {
          if (!element.isTypeOnly && (element.propertyName ?? element.name).text === "default") processNamespaces.add(binding(element.name));
        }
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && namespace(node.initializer)) moduleNamespaces.add(binding(node.name));
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && processNamespace(node.initializer)) processNamespaces.add(binding(node.name));
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && globalNamespace(node.initializer)) globalNamespaces.add(binding(node.name));
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && reflectionNamespace(node.initializer)) reflectionNamespaces.add(binding(node.name));
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
          loader(node.initializer)) requireNames.add(binding(node.name));
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name) && factory(node.initializer)) requireFactories.add(binding(node.name));
      if (ts.isVariableDeclaration(node) && node.initializer && !ts.isIdentifier(node.name) && (loader(node.initializer) || factory(node.initializer) ||
        namespace(node.initializer))) throw new Error(`Unsupported loader destructuring: ${file.path}`);
      ts.forEachChild(node, scanBindings);
    };
    let bindingCount: number;
    const countBindings = (): number => requireNames.size + requireFactories.size + moduleNamespaces.size + processNamespaces.size + globalNamespaces.size + reflectionNamespaces.size;
    do {
      bindingCount = countBindings();
      scanBindings(source);
    } while (bindingCount !== countBindings());
    const factoryBase = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && factory(node.expression)) {
        const base = node.arguments[0] && unwrapValue(node.arguments[0]);
        const closureBase = file.path === `${ARENA}/hermetic/closure.mjs` && base &&
          ts.isStringLiteral(base) && base.text === "/app/packages/starchess-arena/package.json";
        const ownBase = base && ts.isPropertyAccessExpression(base) && base.name.text === "url" &&
          ts.isMetaProperty(base.expression) && base.expression.keywordToken === ts.SyntaxKind.ImportKeyword && base.expression.name.text === "meta";
        if (node.arguments.length !== 1 || (!ownBase && !closureBase)) {
          throw new Error(`Unsupported createRequire base: ${file.path}`);
        }
      }
      ts.forEachChild(node, factoryBase);
    };
    factoryBase(source);
    const wrappedUse = (node: ts.Expression): ts.Expression => {
      const parent = node.parent;
      if ((ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent) || ts.isTypeAssertionExpression(parent) || ts.isSatisfiesExpression(parent)) && parent.expression === node ||
          ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.CommaToken && parent.right === node) return wrappedUse(parent as ts.Expression);
      return node;
    };
    const origin = (node: ts.Expression, seen = new Set<ts.Symbol | string>()): ts.Expression => {
      const expression = unwrapValue(node);
      if (!ts.isIdentifier(expression)) return expression;
      const key = binding(expression);
      if (seen.has(key) || typeof key === "string") return expression;
      const declaration = key.valueDeclaration;
      return declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
        ? origin(declaration.initializer, new Set([...seen, key])) : expression;
    };
    const mutableOrigin = (node: ts.Expression, seen = new Set<ts.Symbol | string>()): boolean => {
      const expression = unwrapValue(node);
      if (!ts.isIdentifier(expression)) return false;
      const key = binding(expression);
      if (reassignedBindings.has(key)) return true;
      if (seen.has(key) || typeof key === "string") return false;
      const declaration = key.valueDeclaration;
      return !!(declaration && ts.isVariableDeclaration(declaration) && declaration.initializer && mutableOrigin(declaration.initializer, new Set([...seen, key])));
    };
    const safeDataKey = (node: ts.Expression): boolean => {
      const expression = unwrapValue(node);
      const value = staticString(expression);
      if (value !== undefined) return !["constructor", "__proto__", "prototype"].includes(value);
      if (ts.isNumericLiteral(expression)) return true;
      if (!ts.isIdentifier(expression)) return false;
      const key = binding(expression);
      if (typeof key === "string") return false;
      const declaration = key.valueDeclaration;
      if (!declaration || !ts.isVariableDeclaration(declaration) || !ts.isVariableDeclarationList(declaration.parent)) return false;
      const loop = declaration.parent.parent;
      return !!(ts.isForOfStatement(loop) && declaration.parent.flags & ts.NodeFlags.Const && ts.isArrayLiteralExpression(unwrapValue(loop.expression)) &&
        (unwrapValue(loop.expression) as ts.ArrayLiteralExpression).elements.every((entry) => ts.isStringLiteralLike(entry) && ["w", "b"].includes(entry.text)));
    };
    const sourceIsDeclaration = (node: ts.Identifier): boolean => {
      const parent = node.parent;
      return ts.isVariableDeclaration(parent) && parent.name === node || ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent);
    };
    const sourceIsName = (node: ts.Identifier): boolean => {
      const parent = node.parent;
      if (ts.isExportSpecifier(parent) && (parent.isTypeOnly || parent.parent.parent.isTypeOnly)) return true;
      let typeName: ts.Node = node;
      while (ts.isQualifiedName(typeName.parent)) typeName = typeName.parent;
      if (ts.isTypeQueryNode(typeName.parent) && typeName.parent.exprName === typeName) return true;
      return ts.isPropertyAccessExpression(parent) && parent.name === node ||
        (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent) || ts.isMethodSignature(parent)) && parent.name === node && !ts.isComputedPropertyName(parent.name);
    };
    const visit = (node: ts.Node): void => {
      if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
        const access = node.parent;
        if (!ts.isPropertyAccessExpression(access) || access.expression !== node || !["url", "dirname", "filename"].includes(access.name.text)) throw new Error(`Unsupported import metadata escape: ${file.path}`);
        const use = wrappedUse(access);
        let target: ts.Node = use;
        while (ts.isArrayLiteralExpression(target.parent) || ts.isObjectLiteralExpression(target.parent) ||
          ts.isPropertyAssignment(target.parent) && target.parent.initializer === target ||
          (ts.isSpreadElement(target.parent) || ts.isSpreadAssignment(target.parent)) && target.parent.expression === target) target = target.parent;
        const parent = target.parent;
        if (ts.isDeleteExpression(parent) ||
            ts.isBinaryExpression(parent) && parent.left === target && parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment ||
            (ts.isForOfStatement(parent) || ts.isForInStatement(parent)) && parent.initializer === target ||
            (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(parent.operator)) {
          throw new Error(`Unsupported import metadata mutation: ${file.path}`);
        }
      }
      const value = !ts.isPartOfTypeNode(node) && (ts.isIdentifier(node) && !sourceIsName(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node));
      if (value && evaluation(node as ts.Expression)) throw new Error(`Unsupported string evaluation: ${file.path}`);
      const accessed = value ? property(node as ts.Expression) : undefined;
      if (["constructor", "__proto__", "getPrototypeOf", "getOwnPropertyDescriptors"].includes(accessed?.name ?? "")) throw new Error(`Unsupported code constructor acquisition: ${file.path}`);
      if (accessed && reflectionNamespace(accessed.receiver) && !["ownKeys", "apply", "has", "set", "deleteProperty"].includes(accessed.name ?? "")) throw new Error(`Unsupported code constructor acquisition: ${file.path}`);
      if (ts.isBindingElement(node) && node.propertyName && ((ts.isIdentifier(node.propertyName) || ts.isStringLiteralLike(node.propertyName)) && ["constructor", "__proto__", "getPrototypeOf", "getOwnPropertyDescriptors", "getOwnPropertyDescriptor"].includes(node.propertyName.text) || ts.isComputedPropertyName(node.propertyName))) throw new Error(`Unsupported code constructor acquisition: ${file.path}`);
      if (ts.isElementAccessExpression(node) && mutableOrigin(node.expression) && !safeDataKey(node.argumentExpression)) throw new Error(`Unsupported mutable computed receiver: ${file.path}`);
      if (ts.isElementAccessExpression(node) && (checker.getTypeAtLocation(origin(node.expression)).getCallSignatures().length ||
          ts.isArrowFunction(origin(node.expression)) || ts.isFunctionExpression(origin(node.expression)))) throw new Error(`Unsupported code constructor acquisition: ${file.path}`);
      if (accessed?.name === "getOwnPropertyDescriptor" && !(ts.isCallExpression(node.parent) && node.parent.expression === node)) throw new Error(`Unsupported code constructor acquisition: ${file.path}`);
      if (ts.isCallExpression(node) && property(node.expression)?.name === "getOwnPropertyDescriptor") {
        if (file.path !== `${ARENA}/src/challengeContract/validation.ts` || node.getText(source) !== "Object.getOwnPropertyDescriptor(value, String(index))") throw new Error(`Unsupported code constructor acquisition: ${file.path}`);
      }
      if (accessed && processNamespace(accessed.receiver) && accessed.name === "getBuiltinModule") throw new Error(`Unsupported builtin acquisition: ${file.path}`);
      if (accessed && namespace(accessed.receiver) && ["register", "registerHooks"].includes(accessed.name ?? "")) throw new Error(`Unsupported module loader API: ${file.path}`);
      if (value && (namespace(node as ts.Expression) || processNamespace(node as ts.Expression) || globalNamespace(node as ts.Expression) || reflectionNamespace(node as ts.Expression) || factory(node as ts.Expression) || loader(node as ts.Expression) || resolver(node as ts.Expression))) {
        const expression = node as ts.Expression;
        const use = wrappedUse(expression);
        const parent = use.parent;
        const declaration = ts.isIdentifier(node) && sourceIsDeclaration(node);
        const alias = ts.isVariableDeclaration(parent) && parent.initializer === use && ts.isIdentifier(parent.name) && !resolver(expression);
        const runtimeNamespace = processNamespace(expression) || globalNamespace(expression) || reflectionNamespace(expression);
        const directCall = ts.isCallExpression(parent) && parent.expression === use && !namespace(expression) && !runtimeNamespace;
        const member = (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && parent.expression === use &&
          (namespace(expression) && (factory(parent) || loader(parent)) || loader(expression) && resolver(parent) ||
            runtimeNamespace && property(parent)?.name !== undefined ||
            ts.isIdentifier(expression) && binding(expression) === "module" && property(parent)?.name === "exports");
        if (!declaration && !alias && !directCall && !member) throw new Error(`${runtimeNamespace ? "Unsupported builtin acquisition" : "Unsupported loader escape"}: ${file.path}`);
        const variable = alias ? parent : declaration ? node.parent : undefined;
        if (variable && ts.isVariableDeclaration(variable) && (ts.getCombinedModifierFlags(variable) & ts.ModifierFlags.Export)) throw new Error(`Unsupported loader escape: ${file.path}`);
      }
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) {
          const specifier = literal(node.moduleSpecifier);
          if (specifier === undefined) throw new Error(`Computed module declaration: ${file.path}`);
          const typeOnly = ts.isImportDeclaration(node)
            ? node.importClause?.isTypeOnly === true || (node.importClause?.namedBindings !== undefined && ts.isNamedImports(node.importClause.namedBindings) && !node.importClause.name && node.importClause.namedBindings.elements.length > 0 && node.importClause.namedBindings.elements.every((element) => element.isTypeOnly))
            : node.isTypeOnly;
          const namedImports = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : undefined;
          if (!typeOnly && namedImports && ts.isNamedImports(namedImports)) {
            const names = namedImports.elements.filter((element) => !element.isTypeOnly).map((element) => (element.propertyName ?? element.name).text);
            if (["node:module", "module"].includes(specifier) && names.some((name) => ["register", "registerHooks"].includes(name))) throw new Error(`Unsupported module loader API: ${file.path}`);
            if (["node:process", "process"].includes(specifier) && names.includes("getBuiltinModule")) throw new Error(`Unsupported builtin acquisition: ${file.path}`);
          }
          if (ts.isExportDeclaration(node) && !typeOnly && ["node:module", "module"].includes(specifier) &&
               (!node.exportClause || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some((element) => !element.isTypeOnly && ["createRequire", "default", "Module", "register", "registerHooks"].includes((element.propertyName ?? element.name).text)))) throw new Error(`Unsupported loader escape: ${file.path}`);
          if (ts.isExportDeclaration(node) && !typeOnly && ["node:process", "process"].includes(specifier) &&
              (!node.exportClause || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some((element) => !element.isTypeOnly && ["getBuiltinModule", "default"].includes((element.propertyName ?? element.name).text)))) throw new Error(`Unsupported builtin acquisition: ${file.path}`);
          addEdge(file.path, specifier, ts.isImportDeclaration(node) ? "import" : "export", typeOnly);
        }
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        const specifier = literal(node.moduleReference.expression);
        if (specifier === undefined) throw new Error(`Computed module declaration: ${file.path}`);
        if (["node:module", "module"].includes(specifier)) throw new Error(`Unsupported module namespace import: ${file.path}`);
        if (["node:process", "process"].includes(specifier)) throw new Error(`Unsupported builtin acquisition: ${file.path}`);
        addEdge(file.path, specifier, "require");
      } else if (ts.isImportTypeNode(node)) {
        const specifier = ts.isLiteralTypeNode(node.argument) ? literal(node.argument.literal) : undefined;
        if (specifier === undefined) throw new Error(`Computed import type: ${file.path}`);
          addEdge(file.path, specifier, "import-type", true);
      } else if (ts.isCallExpression(node)) {
        const expression = unwrap(node.expression);
        const dynamic = expression.kind === ts.SyntaxKind.ImportKeyword;
        const requireCall = loader(expression);
        const member = property(expression);
        const resolver = member !== undefined && member.name === "resolve" && loader(member.receiver);
        if (dynamic || requireCall || resolver) {
          const specifier = literal(node.arguments[0]);
          if (file.path === `${ARENA}/hermetic/closure.mjs` && (requireCall || resolver) &&
              specifier !== undefined && (specifier.startsWith(".") || specifier.startsWith("/"))) throw new Error(`Unsupported closure loader edge: ${file.path}`);
          if ((dynamic || requireCall) && (specifier === "node:module" || specifier === "module")) throw new Error(`Unsupported dynamic module import: ${file.path}`);
          if ((dynamic || requireCall) && (specifier === "node:process" || specifier === "process")) throw new Error(`Unsupported builtin acquisition: ${file.path}`);
          if (specifier === undefined) {
            if (file.path === `${ARENA}/hermetic/closure.mjs` && requireCall && node.getText(source) === "require(require.resolve('esbuild', { paths: [require.resolve('tsx/package.json')] }))") {
              addEdge(file.path, "esbuild", "require");
              ts.forEachChild(node, visit);
              return;
            }
            throw new Error(`Computed module loader: ${file.path}`);
          }
          if (resolver && member && ts.isCallExpression(member.receiver) &&
              (file.path !== `${ARENA}/src/challenge/supervisor.ts` || specifier !== "tsx" || member.receiver.getText(source) !== "createRequire(import.meta.url)" || node.arguments.length !== 1)) {
            throw new Error(`Undeclared createRequire resolver: ${file.path}`);
          }
          addEdge(file.path, specifier, dynamic ? "dynamic" : resolver ? "resolve" : "require");
        }
      } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "URL") {
        const specifier = literal(node.arguments?.[0]);
        if (specifier && CODE_EXTENSION.test(specifier) && node.arguments?.[1]?.getText(source) === "import.meta.url") {
          if (file.path !== `${ARENA}/src/challenge/supervisor.ts` || specifier !== "./worker.ts") throw new Error(`Undeclared module URL: ${file.path}`);
          addEdge(file.path, specifier, "worker");
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  edges.sort((a, b) => order(canonical(a), canonical(b)));
  const groups: SourceInventoryV1["groups"] = {
    execution: files.filter((file) => file.partition === "execution"),
    contracts: files.filter((file) => file.partition === "contracts"),
    diagnostics: files.filter((file) => file.partition === "diagnostics"),
  };
  const runtimeRecords = [...runtime.values()].sort((a, b) => order(a.path, b.path));
  const audit: SourceImportAudit = { passed: true, edges, auditedFiles };
  const descriptor: Pick<SourceInventoryV1, "version" | "policyVersion" | "roots" | "entrypoints" | "files" | "groups"> = {
    version: SOURCE_INVENTORY_VERSION, policyVersion: SOURCE_POLICY_VERSION, roots: ROOTS, entrypoints: ENTRYPOINTS, files, groups,
  };
  return {
    ...descriptor, runtime: runtimeRecords, audit,
    executionSha256: hash(canonical(groups.execution)), contractsSha256: hash(canonical(groups.contracts)),
    diagnosticsSha256: hash(canonical(groups.diagnostics)), runtimeConfigurationSha256: hash(canonical(runtimeRecords)),
    inventorySha256: hash(canonical(descriptor)),
  };
};
