// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase2.puml
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
    const candidates = extname(target) ? [target] : [target, ...[".ts", "/index.ts", ".mts", ".cts", ".tsx", ".js", "/index.js", ".mjs", ".cjs"].map((suffix) => `${target}${suffix}`)];
    const found = candidates.filter(present);
    if (found.length !== 1) throw new Error(`Missing or ambiguous import: ${importer} -> ${specifier}`);
    if (!listed.has(found[0]!)) throw new Error(`Unclassified import target: ${importer} -> ${found[0]}`);
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
    const requireNames = new Set(["require"]);
    const requireFactories = new Set(["createRequire"]);
    const moduleNamespaces = new Set(["module"]);
    const property = (node: ts.Expression): { receiver: ts.Expression; name: string | undefined } | undefined => {
      if (ts.isPropertyAccessExpression(node)) return { receiver: node.expression, name: node.name.text };
      if (ts.isElementAccessExpression(node)) return { receiver: node.expression, name: literal(node.argumentExpression) };
      return undefined;
    };
    const factory = (node: ts.Expression): boolean => {
      const member = property(node);
      return ts.isIdentifier(node) && requireFactories.has(node.text) || member !== undefined && member.name === "createRequire" &&
        ts.isIdentifier(member.receiver) && moduleNamespaces.has(member.receiver.text);
    };
    const loader = (node: ts.Expression): boolean => {
      const member = property(node);
      return ts.isIdentifier(node) && requireNames.has(node.text) || ts.isCallExpression(node) && factory(node.expression) ||
        member !== undefined && member.name === "require" && ts.isIdentifier(member.receiver) && moduleNamespaces.has(member.receiver.text);
    };
    const scanBindings = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) && ["node:module", "module"].includes(literal(node.moduleSpecifier) ?? "")) {
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) moduleNamespaces.add(bindings.name.text);
        if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) {
          if ((element.propertyName ?? element.name).text === "createRequire") requireFactories.add(element.name.text);
        }
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
          (loader(node.initializer) || ts.isCallExpression(node.initializer) && factory(node.initializer.expression))) requireNames.add(node.name.text);
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name) && factory(node.initializer)) requireFactories.add(node.name.text);
      if (ts.isVariableDeclaration(node) && node.initializer && !ts.isIdentifier(node.name) && (loader(node.initializer) || factory(node.initializer) ||
        (ts.isIdentifier(node.initializer) && moduleNamespaces.has(node.initializer.text)))) throw new Error(`Unsupported loader destructuring: ${file.path}`);
      ts.forEachChild(node, scanBindings);
    };
    scanBindings(source);
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && (requireNames.has(node.text) || requireFactories.has(node.text))) {
        const parent = node.parent;
        const declaration = (ts.isVariableDeclaration(parent) && parent.name === node) || ts.isImportSpecifier(parent) || ts.isImportClause(parent);
        const directCall = ts.isCallExpression(parent) && parent.expression === node;
        const alias = ts.isVariableDeclaration(parent) && parent.initializer === node && ts.isIdentifier(parent.name);
        const resolver = ts.isPropertyAccessExpression(parent) && parent.expression === node && parent.name.text === "resolve" && requireNames.has(node.text) && ts.isCallExpression(parent.parent) && parent.parent.expression === parent;
        const memberName = ts.isPropertyAccessExpression(parent) && parent.name === node && (factory(parent) || loader(parent));
        if (!declaration && !directCall && !alias && !resolver && !memberName) throw new Error(`Unsupported loader escape: ${file.path}`);
      }
      if (ts.isPropertyAccessExpression(node) && ["bind", "call", "apply"].includes(node.name.text) && (loader(node.expression) || factory(node.expression))) throw new Error(`Unsupported loader escape: ${file.path}`);
      if (ts.isCallExpression(node) && (factory(node.expression) || loader(node.expression))) {
        const parent = node.parent;
        const assigned = ts.isVariableDeclaration(parent) && parent.initializer === node && ts.isIdentifier(parent.name);
        const invoked = ts.isCallExpression(parent) && parent.expression === node;
        const resolved = ts.isPropertyAccessExpression(parent) && parent.expression === node && parent.name.text === "resolve";
        if (!assigned && !invoked && !resolved) throw new Error(`Unsupported loader escape: ${file.path}`);
      }
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) {
          const specifier = literal(node.moduleSpecifier);
          if (specifier === undefined) throw new Error(`Computed module declaration: ${file.path}`);
          const typeOnly = ts.isImportDeclaration(node)
            ? node.importClause?.isTypeOnly === true || (node.importClause?.namedBindings !== undefined && ts.isNamedImports(node.importClause.namedBindings) && !node.importClause.name && node.importClause.namedBindings.elements.length > 0 && node.importClause.namedBindings.elements.every((element) => element.isTypeOnly))
            : node.isTypeOnly;
          addEdge(file.path, specifier, ts.isImportDeclaration(node) ? "import" : "export", typeOnly);
        }
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        const specifier = literal(node.moduleReference.expression);
        if (specifier === undefined) throw new Error(`Computed module declaration: ${file.path}`);
        addEdge(file.path, specifier, "require");
      } else if (ts.isImportTypeNode(node)) {
        const specifier = ts.isLiteralTypeNode(node.argument) ? literal(node.argument.literal) : undefined;
        if (specifier === undefined) throw new Error(`Computed import type: ${file.path}`);
          addEdge(file.path, specifier, "import-type", true);
      } else if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const dynamic = expression.kind === ts.SyntaxKind.ImportKeyword;
        const requireCall = loader(expression);
        const member = property(expression);
        const resolver = member !== undefined && member.name === "resolve" && loader(member.receiver);
        if (dynamic || requireCall || resolver) {
          const specifier = literal(node.arguments[0]);
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
