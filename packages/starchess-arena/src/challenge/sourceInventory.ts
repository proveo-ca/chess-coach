// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { isBuiltin } from "node:module";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { canonical } from "./config";

export const SOURCE_INVENTORY_VERSION = "challenge-source-inventory-v2";
export const SOURCE_POLICY_VERSION = "challenge-source-policy-v2";
export type LegacySourcePartition = "execution" | "contracts" | "diagnostics";
export type LegacySourceFileRecord = { path: string; sha256: string; partition: LegacySourcePartition };
export const SOURCE_PARTITIONS = Object.freeze([
  "core-rules", "arena-authorized", "arena-host", "training-model", "training-coordinator", "verification-tooling",
] as const);
export type SourcePartition = typeof SOURCE_PARTITIONS[number];
export type SourceFileRecord = { path: string; sha256: string; partition: SourcePartition };
export type RuntimeFileRecord = { path: string; present: boolean; sha256: string | null };
export type ImportAuditEdge = {
  importer: string; specifier: string; kind: "import" | "export" | "dynamic" | "require" | "import-type" | "resolve" | "worker";
  target: string; targetKind: "source" | "builtin" | "external"; typeOnly?: boolean;
};
export type SourceImportAudit = { passed: true; edges: ImportAuditEdge[]; auditedFiles: string[] };
export type SourceInventoryV1 = {
  version: "challenge-source-inventory-v1";
  policyVersion: "challenge-source-policy-v1";
  roots: readonly string[];
  entrypoints: readonly string[];
  files: LegacySourceFileRecord[];
  groups: Record<LegacySourcePartition, LegacySourceFileRecord[]>;
  runtime: RuntimeFileRecord[];
  executionSha256: string;
  contractsSha256: string;
  diagnosticsSha256: string;
  runtimeConfigurationSha256: string;
  inventorySha256: string;
  audit: SourceImportAudit;
};
export type SourceInventoryV2 = {
  version: typeof SOURCE_INVENTORY_VERSION;
  policyVersion: typeof SOURCE_POLICY_VERSION;
  roots: readonly string[];
  entrypoints: readonly string[];
  files: SourceFileRecord[];
  groups: Record<SourcePartition, SourceFileRecord[]>;
  partitionSha256: Record<SourcePartition, string>;
  runtime: RuntimeFileRecord[];
  runtimeConfigurationSha256: string;
  inventorySha256: string;
  audit: SourceImportAudit;
};

const CORE = "packages/starchess-core";
const ARENA = "packages/starchess-arena";
const TRAINING = "packages/starchess-training";
const AUTHORIZED = new Set([
  `${ARENA}/src/observations.ts`, `${ARENA}/src/intent-codec-v1.ts`,
  ...["types", "canonical", "squares", "observationCodec"].map((name) => `${ARENA}/src/authorized/v1/${name}.ts`),
  ...["candidateWire", "validation", "observationCodec"].map((name) => `${ARENA}/src/challengeContract/${name}.ts`),
]);
export const SOURCE_PARTITION_EDGES: Readonly<Record<SourcePartition, readonly SourcePartition[]>> = Object.freeze({
  "core-rules": Object.freeze(["core-rules"] as const),
  "arena-authorized": Object.freeze(["core-rules", "arena-authorized"] as const),
  "arena-host": Object.freeze(["core-rules", "arena-authorized", "arena-host"] as const),
  "training-model": Object.freeze(["core-rules", "arena-authorized", "training-model"] as const),
  "training-coordinator": Object.freeze(["core-rules", "arena-authorized", "arena-host", "training-model", "training-coordinator"] as const),
  "verification-tooling": SOURCE_PARTITIONS,
});
const PURE = new Set<SourcePartition>(["core-rules", "arena-authorized", "training-model"]);
const ROOTS = Object.freeze([`${CORE}/src`, `${ARENA}/src`, `${TRAINING}/src`, "scripts", `${ARENA}/hermetic`].sort());
const ENTRYPOINTS = Object.freeze([
  `${CORE}/src/index.ts`, `${ARENA}/src/cli/challenge.ts`, `${ARENA}/src/challenge/worker.ts`,
  "scripts/challenge-contract-evidence.ts", `${ARENA}/hermetic/run.mjs`, `${ARENA}/hermetic/runtime.mjs`,
].sort());
const REQUIRED_RUNTIME = [
  "package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", `${CORE}/package.json`, `${CORE}/tsconfig.json`,
  `${ARENA}/package.json`, `${ARENA}/tsconfig.json`, `${ARENA}/hermetic/pins.json`, `${TRAINING}/package.json`, `${TRAINING}/tsconfig.json`,
];
const OPTIONAL_RUNTIME = [
  ".npmrc", ".pnpmfile.cjs", "pnpmfile.cjs", "tsconfig.json", "tsconfig.base.json", "nx.json",
  "vitest.config.ts", "vite.config.ts",
  ...[CORE, ARENA, TRAINING].flatMap((path) => [".npmrc", ".pnpmfile.cjs", "pnpmfile.cjs", "vitest.config.ts"].map((name) => `${path}/${name}`)),
];
const CODE_EXTENSION = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const hash = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const order = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const excludedTest = (path: string): boolean =>
  [CORE, ARENA, TRAINING].some((root) => path.startsWith(`${root}/src/`)) && path.split("/").includes("__tests__");
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const REVIEWED_INSPECT_DTO = `inspectDto = (value: unknown, path = "$"): unknown => {
  const state = { seenWeakMap: new WeakMap<object, { copy: unknown; height: number }>(), ancestors: new Set<object>(), visits: 0, textbytes: 0 };
  const countText = (text: string, at: string): void => {
    if (text.length > MAX_CODEC_BYTES - state.textbytes) fail(at, "SIZE");
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index);
      let bytes = code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
      if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
        const next = text.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) { bytes = 4; index++; }
      }
      state.textbytes += bytes;
      if (state.textbytes > MAX_CODEC_BYTES) fail(at, "SIZE");
    }
  };
  const visit = (input: unknown, at: string, depth: number): { copy: unknown; height: number } => {
    if (depth > 16 || ++state.visits > 8192) fail(at, "SIZE");
    if (!input || typeof input !== "object") {
      if (typeof input === "function" || typeof input === "symbol") fail(at);
      if (typeof input === "string") countText(input, at);
      return { copy: input, height: 0 };
    }
    if (state.ancestors.has(input)) fail(at);
    const memo = state.seenWeakMap.get(input);
    if (memo) {
      if (depth + memo.height > 16) fail(at, "SIZE");
      return memo;
    }
    const isArray = Array.isArray(input);
    const prototype = Object.getPrototypeOf(input);
    if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail(at);
    const keys = Reflect.ownKeys(input);
    if (keys.length - (isArray ? 1 : 0) > 8192 - state.visits) fail(at, "SIZE");
    for (const key of keys) {
      if (typeof key !== "string") fail(at);
      countText(key as string, at);
    }
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const length = isArray ? descriptors.length?.value as number : 0;
    if (isArray && length > 8192 - state.visits) fail(at, "SIZE");
    if (isArray && keys.length !== length + 1) fail(at, "ARRAY");
    state.ancestors.add(input);
    const entries: [string, unknown][] = [];
    let height = 0;
    for (const key of keys as string[]) {
      const descriptor = descriptors[key]!;
      if (!Object.hasOwn(descriptor, "value")) fail(at);
      if (isArray && key === "length") continue;
      if (!descriptor.enumerable) fail(at);
      if (isArray && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length)) fail(at, "ARRAY");
      const child = visit(descriptor.value, isArray ? \`\${at}[\${key}]\` : \`\${at}.\${key}\`, depth + 1);
      entries.push([key, child.copy]);
      height = Math.max(height, child.height + 1);
    }
    state.ancestors.delete(input);
    const detached = Object.fromEntries(entries);
    const result = { copy: isArray ? Array.from({ length }, (_, index) => detached[String(index)]) : detached, height };
    state.seenWeakMap.set(input, result);
    return result;
  };
  return visit(value, path, 0).copy;
}`;

export const collectSourceInventory = (
  root: string = fileURLToPath(new URL("../../../../", import.meta.url)),
): SourceInventoryV2 => {
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
    if (path.startsWith(`${CORE}/src/`)) matches.push("core-rules");
    if (AUTHORIZED.has(path)) matches.push("arena-authorized");
    const tooling = path.startsWith("scripts/") || path.startsWith(`${ARENA}/hermetic/`) ||
      path === `${ARENA}/src/challenge/sourceInventory.ts` || path.startsWith(`${ARENA}/src/challengeContract/`) && !AUTHORIZED.has(path);
    if (tooling) matches.push("verification-tooling");
    if (path.startsWith(`${ARENA}/src/`) && !tooling && !AUTHORIZED.has(path)) matches.push("arena-host");
    if (path.startsWith(`${TRAINING}/src/`)) matches.push(/^packages\/starchess-training\/src\/(?:coordinator|cli)\//.test(path) ? "training-coordinator" : "training-model");
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
  const manifests = new Map(["", CORE, ARENA, TRAINING].map((path) => [path, json(path ? `${path}/package.json` : "package.json")]));
  const canonicalBranches = (value: unknown, target: string): boolean => typeof value === "string" ? value === target
    : object(value) && Object.keys(value).length > 0 && Object.values(value).every((branch) => canonicalBranches(branch, target));
  const coreExports = manifests.get(CORE)!.exports;
  if (!object(coreExports) || Object.keys(coreExports).sort().join(",") !== ".,./planning-v1" ||
      !canonicalBranches(coreExports["."], "./src/index.ts") || !canonicalBranches(coreExports["./planning-v1"], "./src/planning-v1.ts")) {
    throw new Error(`Unsupported workspace export map: ${CORE}`);
  }
  const selectExport = (value: unknown): string | undefined => {
    if (typeof value === "string") return value;
    if (!object(value)) return undefined;
    for (const [condition, target] of Object.entries(value)) {
      if (["browser", "import", "module", "default"].includes(condition)) return selectExport(target);
    }
    return undefined;
  };
  const entrypoints = [...ENTRYPOINTS];
  for (const owner of [CORE, ARENA, TRAINING]) {
    const exports = manifests.get(owner)!.exports;
    if (!object(exports)) throw new Error(`Missing public export map: ${owner}`);
    for (const [subpath, value] of Object.entries(exports)) {
      const target = selectExport(value);
      if (!subpath.startsWith(".") || subpath.includes("*") || !target?.startsWith("./")) throw new Error(`Unsupported workspace export: ${owner} ${subpath}`);
      entrypoints.push(`${owner}/${target.slice(2)}`);
    }
  }
  const currentEntrypoints = [...new Set(entrypoints)].sort(order);
  for (const path of currentEntrypoints) if (!listed.has(path)) throw new Error(`Missing inventory entrypoint: ${path}`);

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
  for (const path of [`${CORE}/tsconfig.json`, `${ARENA}/tsconfig.json`, `${TRAINING}/tsconfig.json`, "tsconfig.json", "tsconfig.base.json"]) {
    if (present(path)) configExtends(path);
  }

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
    const owner = [CORE, ARENA, TRAINING].find((path) => importer.startsWith(`${path}/`)) ?? "";
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
        const exported = selectExport(object(value.exports) ? Object.entries(value.exports).find(([key]) => key === subpath)?.[1] : subpath === "." ? value.exports : undefined);
        if (typeof exported !== "string" || !exported.startsWith("./")) throw new Error(`Unsupported workspace export: ${specifier}`);
        target = localTarget(importer, specifier, `${path}/${exported.slice(2)}`);
        targetKind = "source";
      } else {
        if (dependencies.some((dependency) => typeof dependency[name] === "string" && String(Object.entries(dependency).find(([key]) => key === name)?.[1]).startsWith("workspace:"))) throw new Error(`Undeclared workspace target: ${specifier}`);
        targetKind = "external";
      }
    }
    const partition = listed.get(importer)!.partition;
    if (["arena-authorized", "training-model"].includes(partition) && target === `${CORE}/src/index.ts`) throw new Error(`Forbidden core root edge: ${importer} -> ${target}`);
    if (kind === "dynamic" && PURE.has(partition)) throw new Error(`Forbidden dynamic import edge: ${importer} -> ${specifier}`);
    const inventorySeam = importer === `${ARENA}/src/challenge/evidence.ts` && target === `${ARENA}/src/challenge/sourceInventory.ts` && kind === "import";
    if (targetKind === "source" && !SOURCE_PARTITION_EDGES[partition].includes(listed.get(target)!.partition) && !inventorySeam) {
      throw new Error(`Forbidden partition edge: ${importer} -> ${target}`);
    }
    if (importer.startsWith(`${ARENA}/src/challengeContract/`) && targetKind === "source" &&
        (target.startsWith("scripts/") || target.startsWith(`${ARENA}/hermetic/`))) throw new Error(`Forbidden partition edge: ${importer} -> ${target}`);
    if (targetKind === "builtin" && PURE.has(partition)) throw new Error(`Forbidden builtin edge: ${importer} -> ${specifier}`);
    if (["training-model", "arena-authorized"].includes(partition) && targetKind === "source" && owner !== [...manifests.entries()].find(([path]) => path && target.startsWith(`${path}/`))?.[0] && specifier.startsWith(".")) {
      throw new Error(`Forbidden deep private edge: ${importer} -> ${target}`);
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
    let dataChecker: ts.TypeChecker | undefined;
    const dataNodes = new Map<string, ts.Node>();
    const nodeKey = (node: ts.Node): string => `${node.pos}:${node.end}:${node.kind}`;
    const dataType = (node: ts.Node): ts.Type => {
      if (!dataChecker) {
        const options: ts.CompilerOptions = { ...bindingOptions, noLib: false, noResolve: false, types: [], target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler };
        const dataHost = ts.createCompilerHost(options);
        dataHost.getCurrentDirectory = () => absoluteRoot;
        dataHost.resolveModuleNames = (names, importer) => names.map((name) => {
          const workspace = [...manifests].find(([owner, manifest]) => owner && typeof manifest.name === "string" &&
            (name === manifest.name || name.startsWith(`${manifest.name}/`)));
          let specifier = name;
          if (workspace) {
            const [owner, manifest] = workspace;
            const subpath = name === manifest.name ? "." : `.${name.slice(String(manifest.name).length)}`;
            const target = selectExport(object(manifest.exports) ? Object.entries(manifest.exports).find(([key]) => key === subpath)?.[1] : manifest.exports);
            if (target?.startsWith("./")) specifier = resolve(absoluteRoot, owner, target);
          }
          const resolved = ts.resolveModuleName(specifier, importer, options, dataHost).resolvedModule;
          return workspace && resolved ? { ...resolved, resolvedUsingTsExtension: false } : resolved;
        });
        const getSourceFile = dataHost.getSourceFile;
        const dataPath = resolve(absoluteRoot, file.path);
        const dataSource = ts.createSourceFile(dataPath, source.text, ts.ScriptTarget.Latest, true,
          /\.[cm]?js$/.test(file.path) ? ts.ScriptKind.JS : file.path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        const indexDataNodes = (node: ts.Node): void => { dataNodes.set(nodeKey(node), node); ts.forEachChild(node, indexDataNodes); };
        indexDataNodes(dataSource);
        dataHost.getSourceFile = (path, ...args) => resolve(path) === dataPath ? dataSource : getSourceFile(path, ...args);
        dataChecker = ts.createProgram([dataPath], options, dataHost).getTypeChecker();
      }
      const dataNode = dataNodes.get(nodeKey(node));
      if (!dataNode) throw new Error(`Unclassified data-type node: ${file.path}`);
      return dataChecker.getTypeAtLocation(dataNode);
    };
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
    const objectNamespaces = new Set<ts.Symbol | string>(["Object"]);
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
    const staticKey = (node: ts.Expression, seen = new Set<ts.Symbol | string>()): string | undefined => {
      const expression = unwrapValue(node);
      if (ts.isNumericLiteral(expression)) return String(Number(expression.text));
      if (ts.isIdentifier(expression)) {
        const key = binding(expression);
        if (seen.has(key)) return undefined;
        const declaration = typeof key !== "string" && key.valueDeclaration;
        if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer &&
            ts.isVariableDeclarationList(declaration.parent) && declaration.parent.flags & ts.NodeFlags.Const) {
          return staticKey(declaration.initializer, new Set([...seen, key]));
        }
      }
      return staticString(expression);
    };
    const property = (node: ts.Expression): { receiver: ts.Expression; name: string | undefined } | undefined => {
      const expression = unwrap(node);
      if (ts.isPropertyAccessExpression(expression)) return { receiver: unwrap(expression.expression), name: expression.name.text };
      if (ts.isElementAccessExpression(expression)) return { receiver: unwrap(expression.expression), name: staticKey(expression.argumentExpression) };
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
    const objectNamespace = (node: ts.Expression): boolean => {
      const expression = unwrap(node), member = property(expression);
      return ts.isIdentifier(expression) && objectNamespaces.has(binding(expression)) ||
        member !== undefined && member.name === "Object" && globalNamespace(member.receiver);
    };
    const documentRoot = (node: ts.Expression, seen = new Set<ts.Expression>()): boolean => {
      const expression = origin(node);
      if (seen.has(expression)) return false;
      const next = new Set([...seen, expression]);
      if (ts.isIdentifier(expression)) {
        const key = binding(expression);
        if (expression.text === "document" && typeof key === "string") return true;
        const declaration = typeof key !== "string" ? key.valueDeclaration : undefined;
        const bound = declaration && ts.isBindingElement(declaration) ? bindingMember(declaration) : undefined;
        if (bound?.name === "document" && hostRoot(bound.receiver, next)) return true;
      }
      const member = property(expression);
      return !!(member?.name === "document" && hostRoot(member.receiver, next));
    };
    const hostRoot = (node: ts.Expression, seen = new Set<ts.Expression>()): boolean => {
      const expression = unwrap(node);
      if (seen.has(expression)) return false;
      const next = new Set([...seen, expression]);
      const rooted = origin(expression);
      if (rooted !== expression && hostRoot(rooted, next)) return true;
      if (ts.isIdentifier(expression)) {
        const key = binding(expression);
        const declaration = typeof key !== "string" ? key.valueDeclaration : undefined;
        const bound = declaration && ts.isBindingElement(declaration) ? bindingMember(declaration) : undefined;
        if (bound && ["globalThis", "global", "window", "self", "frames", "top", "parent"].includes(bound.name ?? "") && hostRoot(bound.receiver, next)) return true;
        const receiver = bound && origin(bound.receiver);
        if (bound?.name === "defaultView" && receiver && documentRoot(receiver, next)) return true;
      }
      const member = property(expression);
      const receiver = member && origin(member.receiver);
      return !!(expression.kind === ts.SyntaxKind.ThisKeyword || ts.isIdentifier(expression) && ["globalThis", "global", "window", "self", "frames", "top", "parent"].includes(expression.text) &&
        (globalNamespaces.has(binding(expression)) || typeof binding(expression) === "string") ||
        ts.isElementAccessExpression(expression) && hostRoot(expression.expression, next) ||
        member !== undefined && (["globalThis", "global", "window", "self", "frames", "top", "parent"].includes(member.name ?? "") && hostRoot(member.receiver, next) ||
          member.name === "defaultView" && receiver && documentRoot(receiver, next)));
    };
    const evaluation = (node: ts.Expression): boolean => {
      const expression = unwrap(node);
      const member = property(expression);
      const name = ts.isIdentifier(expression) ? binding(expression) : undefined;
      const forbidden = ["eval", "Function"];
      const thisReceiver = member !== undefined && ts.isToken(member.receiver) && member.receiver.kind === ts.SyntaxKind.ThisKeyword;
      return name === "eval" || name === "Function" ||
        member !== undefined && (forbidden.includes(member.name ?? "") || member.name === undefined) && (hostRoot(member.receiver) || thisReceiver);
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
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && objectNamespace(node.initializer)) objectNamespaces.add(binding(node.name));
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
          loader(node.initializer)) requireNames.add(binding(node.name));
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name) && factory(node.initializer)) requireFactories.add(binding(node.name));
      if (ts.isVariableDeclaration(node) && node.initializer && !ts.isIdentifier(node.name) && (loader(node.initializer) || factory(node.initializer) ||
        namespace(node.initializer))) throw new Error(`Unsupported loader destructuring: ${file.path}`);
      ts.forEachChild(node, scanBindings);
    };
    let bindingCount: number;
    const countBindings = (): number => requireNames.size + requireFactories.size + moduleNamespaces.size + processNamespaces.size + globalNamespaces.size + reflectionNamespaces.size + objectNamespaces.size;
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
    const ownName = (name: ts.PropertyName): string | undefined => ts.isComputedPropertyName(name) ? staticKey(name.expression)
      : ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : ts.isNumericLiteral(name) ? String(Number(name.text)) : undefined;
    const ownMember = (receiver: ts.Expression, name: string | undefined): ts.Expression | undefined => {
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
    const bindingMember = (declaration: ts.BindingElement): { receiver: ts.Expression; name: string | undefined } | undefined => {
      const pattern = declaration.parent;
      const owner = pattern.parent;
      let receiver: ts.Expression | undefined;
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
    const origin = (node: ts.Expression, seen = new Set<ts.Symbol | string>(), members = new Set<ts.Expression>()): ts.Expression => {
      const expression = unwrap(node);
      if (members.has(expression)) return expression;
      const next = new Set([...members, expression]);
      if (ts.isCallExpression(expression) && expression.arguments.length === 1) {
        const method = property(expression.expression);
        if (method?.name === "freeze" && objectNamespace(method.receiver)) return origin(expression.arguments[0]!, seen, next);
      }
      const member = property(expression);
      if (member?.name !== undefined) {
        const entry = ownMember(origin(member.receiver, seen, next), member.name);
        if (entry) return origin(entry, seen, next);
      }
      if (!ts.isIdentifier(expression)) return expression;
      const key = binding(expression);
      if (seen.has(key) || typeof key === "string") return expression;
      const declaration = key.valueDeclaration;
      if (declaration && ts.isBindingElement(declaration) && !declaration.initializer && !declaration.dotDotDotToken) {
        const member = bindingMember(declaration);
        const entry = member && ownMember(origin(member.receiver, new Set([...seen, key]), next), member.name);
        if (entry) return origin(entry, new Set([...seen, key]), next);
      }
      return declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
        ? origin(declaration.initializer, new Set([...seen, key]), next) : expression;
    };
    const provenance = (node: ts.Expression, seen = new Set<ts.Expression>()): Set<ts.Expression | ts.Symbol | string> => {
      const expression = unwrap(node);
      const roots = new Set<ts.Expression | ts.Symbol | string>();
      if (seen.has(expression)) return roots;
      roots.add(expression);
      const next = new Set([...seen, expression]);
      const add = (value: ts.Expression): void => { for (const root of provenance(value, next)) roots.add(root); };
      if (ts.isIdentifier(expression)) {
        const key = binding(expression);
        roots.add(key);
        const declaration = typeof key !== "string" ? key.valueDeclaration : undefined;
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
    const mutatedRoots = new Set<ts.Expression | ts.Symbol | string>();
    const nonNumericWrites = new Set<ts.Symbol | string>();
    const numericAssignments = new Map<ts.Symbol | string, ts.Expression[]>();
    const arrayMutatorTargets: ts.Expression[] = [];
    let arrayIntrinsicsMutated = false;
    const arrayIntrinsicRoot = (node: ts.Expression, seen = new Set<ts.Expression>()): boolean => {
      const value = origin(node);
      if (seen.has(value)) return false;
      const next = new Set([...seen, value]);
      if (ts.isIdentifier(value)) {
        const symbol = binding(value);
        if (typeof symbol === "string" && ["Array", "Object", "String", "Number", "Boolean", "JSON", "globalThis", "global"].includes(symbol)) return true;
        const declaration = typeof symbol !== "string" ? symbol.valueDeclaration : undefined;
        const member = declaration && ts.isBindingElement(declaration) ? bindingMember(declaration) : undefined;
        return !!(member && arrayIntrinsicRoot(member.receiver, next));
      }
      const member = property(value);
      return !!(member && arrayIntrinsicRoot(member.receiver, next));
    };
    const markMutation = (node: ts.Expression): void => {
      for (const root of provenance(node)) mutatedRoots.add(root);
      if (arrayIntrinsicRoot(node)) arrayIntrinsicsMutated = true;
    };
    const freshError = (node: ts.Expression): boolean => {
      const value = origin(node);
      if (!ts.isNewExpression(value)) return false;
      const ctor = origin(value.expression);
      return ts.isIdentifier(ctor) && ["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "URIError", "EvalError", "AggregateError"].includes(ctor.text) &&
        typeof binding(ctor) === "string" && ![...provenance(value.expression)].some((root) => mutatedRoots.has(root));
    };
    const scanMutations = (node: ts.Node): void => {
      const writes = (target: ts.Node, numeric = false): void => {
        if (ts.isIdentifier(target)) { const symbol = binding(target); mutatedRoots.add(symbol); if (!numeric) nonNumericWrites.add(symbol); if (typeof symbol === "string" && ["Array", "Object", "String", "Number", "Boolean", "JSON"].includes(symbol)) arrayIntrinsicsMutated = true; }
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
        const member = property(origin(node.expression));
        const mutator = (expression: ts.Expression): boolean => {
          const method = property(origin(expression));
          return !!(method && (objectNamespace(origin(method.receiver)) && ["assign", "defineProperty", "defineProperties", "setPrototypeOf"].includes(method.name ?? "") ||
            reflectionNamespace(origin(method.receiver)) && ["set", "deleteProperty", "defineProperty", "setPrototypeOf"].includes(method.name ?? "")));
        };
        const mutatorRoot = (expression: ts.Expression, depth = 0): boolean => {
          if (depth > 8) return true;
          const current = origin(expression);
          if (ts.isIdentifier(current)) {
            const key = binding(current);
            const declaration = typeof key !== "string" ? key.valueDeclaration : undefined;
            if (declaration && ts.isBindingElement(declaration)) {
              const bound = bindingMember(declaration);
              if (bound && ["assign", "defineProperty", "defineProperties", "setPrototypeOf", "set", "deleteProperty"].includes(bound.name ?? "") &&
                (objectNamespace(origin(bound.receiver)) || reflectionNamespace(origin(bound.receiver)))) return true;
            }
          }
          const method = property(current);
          if (!method) return mutator(current);
          if (method.name === undefined) return objectNamespace(method.receiver) || reflectionNamespace(method.receiver) || mutatorRoot(method.receiver, depth + 1);
          if (["call", "apply", "bind"].includes(method.name)) return mutatorRoot(method.receiver, depth + 1);
          return mutator(current);
        };
        const argumentMutator = (argument: ts.Expression, seen = new Set<ts.Expression>()): boolean => {
          const value = origin(unwrap(argument));
          if (seen.has(value)) return false;
          const next = new Set([...seen, value]);
          if (ts.isSpreadElement(value)) return argumentMutator(value.expression, next);
          if (ts.isArrayLiteralExpression(value)) return value.elements.some((entry) => !ts.isOmittedExpression(entry) && argumentMutator(entry, next));
          if (ts.isObjectLiteralExpression(value)) return value.properties.some((entry) => ts.isSpreadAssignment(entry) ? argumentMutator(entry.expression, next)
            : ts.isPropertyAssignment(entry) ? argumentMutator(entry.initializer, next) : ts.isShorthandPropertyAssignment(entry) && argumentMutator(entry.name, next));
          return mutatorRoot(value);
        };
        const callee = property(origin(node.expression));
        const indirect = callee !== undefined && (callee.name === undefined || ["call", "apply", "bind"].includes(callee.name));
        if (mutatorRoot(node.expression)) {
          const target = node.arguments[0];
          if (target) arrayMutatorTargets.push(target);
          if (indirect || !target || arrayIntrinsicRoot(target) ||
              !freshError(target)) arrayIntrinsicsMutated = true;
        } else if (indirect && node.arguments.some((argument) => argumentMutator(argument))) arrayIntrinsicsMutated = true;
        if (mutatorRoot(node.expression) || indirect && node.arguments.some((argument) => argumentMutator(argument))) {
          for (const builtin of ["Math", "String", "Number", "Array", "globalThis", "global"]) mutatedRoots.add(builtin);
        }
        if (node.arguments[0] && member && (objectNamespace(origin(member.receiver)) && ["assign", "defineProperty", "defineProperties"].includes(member.name ?? "") ||
            reflectionNamespace(origin(member.receiver)) && ["set", "deleteProperty", "defineProperty"].includes(member.name ?? ""))) markMutation(node.arguments[0]);
        if (member && ["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"].includes(member.name ?? "")) markMutation(member.receiver);
      }
      ts.forEachChild(node, scanMutations);
    };
    scanMutations(source);
    arrayIntrinsicsMutated ||= arrayMutatorTargets.some((target) => !freshError(target));
    const numericOperators = new Set([
      ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.AsteriskAsteriskToken, ts.SyntaxKind.SlashToken, ts.SyntaxKind.PercentToken,
      ts.SyntaxKind.LessThanLessThanToken, ts.SyntaxKind.GreaterThanGreaterThanToken, ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
      ts.SyntaxKind.AmpersandToken, ts.SyntaxKind.BarToken, ts.SyntaxKind.CaretToken,
    ]);
    const hidesGetter = (access: ts.Expression, seen = new Set<ts.Expression>()): boolean => {
      const member = property(access);
      if (!member || seen.has(access)) return false;
      const next = new Set([...seen, access]);
      const receiver = origin(member.receiver);
      if (hidesGetter(receiver, next)) return true;
      const receiverGetter = (value: ts.Expression, visited = new Set<ts.Expression>()): boolean => {
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
    const bindingGetter = (declaration: ts.Declaration | undefined): boolean => {
      if (!declaration || !ts.isBindingElement(declaration)) return false;
      const member = bindingMember(declaration);
      if (!member) return false;
      const scan = (node: ts.Expression, seen = new Set<ts.Expression>()): boolean => {
        const receiver = origin(node);
        if (seen.has(receiver)) return true;
        if (!ts.isObjectLiteralExpression(receiver)) return false;
        const next = new Set([...seen, receiver]);
        return receiver.properties.some((entry) => ts.isSpreadAssignment(entry) ? scan(entry.expression, next) :
          (member.name === undefined || ownName(entry.name) === undefined || ownName(entry.name) === member.name) &&
          (ts.isGetAccessorDeclaration(entry) || ts.isSetAccessorDeclaration(entry)));
      };
      return scan(member.receiver);
    };
    const jsonData = (node: ts.Expression, seen = new Set<ts.Expression>()): boolean => {
      const value = origin(node);
      if (seen.has(value)) return false;
      const next = new Set([...seen, value]);
      const member = property(value);
      if (member) return jsonData(member.receiver, next);
      if (!ts.isCallExpression(value)) return false;
      const method = property(origin(value.expression));
      const receiver = method && origin(method.receiver);
      return !!(method?.name === "parse" && receiver && ts.isIdentifier(receiver) && binding(receiver) === "JSON");
    };
    const arrayValue = (node: ts.Expression, seen = new Set<ts.Expression>()): boolean => {
      const value = origin(node);
      const input = unwrap(node);
      if (seen.has(value) || mutatedRoots.has(value) || ts.isIdentifier(input) && mutatedRoots.has(binding(input))) return false;
      const next = new Set([...seen, value]);
      if (ts.isArrayLiteralExpression(value)) return true;
      if (jsonData(value)) return true;
      if (!ts.isCallExpression(value)) return false;
      const member = property(value.expression);
      if (member && ["map", "flatMap", "filter", "slice", "concat"].includes(member.name ?? "") && arrayValue(member.receiver, next)) return true;
      if (member?.name === "from" && ts.isIdentifier(member.receiver) && binding(member.receiver) === "Array") return true;
      const callee = origin(value.expression);
      if (ts.isIdentifier(value.expression) && (numericAssignments.has(binding(value.expression)) || nonNumericWrites.has(binding(value.expression)))) return false;
      const symbol = ts.isIdentifier(callee) ? binding(callee) : undefined;
      const declaration = symbol && typeof symbol !== "string" ? symbol.valueDeclaration : callee;
      const fn = declaration && (ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration) || ts.isFunctionDeclaration(declaration)) ? declaration : undefined;
      if (!fn?.body) return false;
      if (!ts.isBlock(fn.body)) return arrayValue(fn.body, next);
      const returns: (ts.Expression | undefined)[] = [];
      const scan = (child: ts.Node): void => {
        if (ts.isReturnStatement(child)) returns.push(child.expression);
        else if (!ts.isFunctionLike(child)) ts.forEachChild(child, scan);
      };
      ts.forEachChild(fn.body, scan);
      return returns.length > 0 && returns.every((returned) => returned !== undefined && arrayValue(returned, next));
    };
    const parameterArguments = (node: ts.Identifier): ts.Expression[] | undefined => {
      const symbol = binding(node), declaration = typeof symbol !== "string" ? symbol.valueDeclaration : undefined;
      if (!declaration || !ts.isParameter(declaration) || declaration.initializer || declaration.dotDotDotToken || mutatedRoots.has(symbol)) return undefined;
      const fn = declaration.parent;
      if (!ts.isFunctionDeclaration(fn) && !ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) return undefined;
      const index = +fn.parameters.indexOf(declaration);
      const owner = ts.isFunctionDeclaration(fn) ? fn : fn.parent;
      if (!(ts.isFunctionDeclaration(owner) || ts.isVariableDeclaration(owner)) || !owner.name || !ts.isIdentifier(owner.name) ||
          ts.getCombinedModifierFlags(owner) & ts.ModifierFlags.Export) return undefined;
      const callable = binding(owner.name);
      if (mutatedRoots.has(callable)) return undefined;
      const calls: ts.CallExpression[] = [];
      let escaped = false;
      const scan = (child: ts.Node): void => {
        if (ts.isIdentifier(child) && child !== owner.name && !ts.isPartOfTypeNode(child) && !sourceIsName(child) && !sourceIsDeclaration(child) && binding(child) === callable) {
          const use = wrappedUse(child), parent = use.parent;
          if (!ts.isCallExpression(parent) || parent.expression !== use || parent.arguments.some(ts.isSpreadElement)) escaped = true;
          else calls.push(parent);
        }
        ts.forEachChild(child, scan);
      };
      scan(source);
      if (escaped || !calls.length || calls.some((call) => call.arguments[index] === undefined)) return undefined;
      return calls.map((call) => call.arguments[index]!);
    };
    const numericParameter = (node: ts.Identifier, seen: Set<ts.Expression>): boolean => {
      const symbol = binding(node), declaration = typeof symbol !== "string" ? symbol.valueDeclaration : undefined;
      if (!declaration || !ts.isParameter(declaration) || declaration.initializer || declaration.dotDotDotToken || mutatedRoots.has(symbol)) return false;
      const fn = declaration.parent;
      if (!ts.isFunctionDeclaration(fn) && !ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) return false;
      const index = +fn.parameters.indexOf(declaration);
      if (index === 1 && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isCallExpression(fn.parent) && !arrayIntrinsicsMutated) {
        const call = fn.parent, member = property(call.expression);
        if (member && (call.arguments[0] === fn && ["map", "flatMap", "filter", "forEach"].includes(member.name ?? "") && arrayValue(member.receiver) ||
            call.arguments[1] === fn && member.name === "from" && ts.isIdentifier(member.receiver) && binding(member.receiver) === "Array")) return true;
      }
      const values = parameterArguments(node);
      return values !== undefined && values.every((value) => numericValue(value, false, seen));
    };
    const plainData = (node: ts.Expression, seen = new Set<ts.Expression>()): boolean => {
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
    const mutatedNumericMember = (node: ts.Expression, seen = new Set<ts.Expression>()): boolean => {
      const input = unwrap(node);
      if (seen.has(input)) return true;
      const next = new Set([...seen, input]);
      if (property(input)) return [...provenance(input)].some((root) => mutatedRoots.has(root));
      if (!ts.isIdentifier(input)) return false;
      const symbol = binding(input), declaration = typeof symbol !== "string" ? symbol.valueDeclaration : undefined;
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) return mutatedNumericMember(declaration.initializer, next);
      const member = declaration && ts.isBindingElement(declaration) ? bindingMember(declaration) : undefined;
      return !!(member && [...provenance(member.receiver)].some((root) => mutatedRoots.has(root)));
    };
    const numericValue = (node: ts.Expression, coercionOnly = false, seen = new Set<ts.Expression>()): boolean => {
      const input = unwrap(node);
      if (seen.has(input)) return false;
      if (mutatedNumericMember(input)) return false;
      const next = new Set([...seen, input]);
      if (ts.isIdentifier(input)) {
        const symbol = binding(input);
        if (nonNumericWrites.has(symbol)) return false;
        if (typeof symbol !== "string" && bindingGetter(symbol.valueDeclaration)) return false;
        if (typeof symbol !== "string" && symbol.valueDeclaration && ts.isParameter(symbol.valueDeclaration)) return numericParameter(input, next);
        if (mutatedRoots.has(symbol)) {
          if (typeof symbol === "string" || !symbol.valueDeclaration || !ts.isVariableDeclaration(symbol.valueDeclaration)) return false;
          const values = [...(symbol.declarations ?? []).filter(ts.isVariableDeclaration).flatMap((declaration) => declaration.initializer ? [declaration.initializer] : []),
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
        if (ts.isIdentifier(value.expression) && value.expression.text === "Number" && typeof binding(value.expression) === "string" &&
            !["Number", "global", "globalThis"].some((root) => mutatedRoots.has(root)) && ![...provenance(value.expression)].some((root) => mutatedRoots.has(root))) return true;
        return !!(member && ["floor", "ceil", "round", "trunc", "abs", "min", "max"].includes(member.name ?? "") &&
          ts.isIdentifier(member.receiver) && member.receiver.text === "Math" && typeof binding(member.receiver) === "string" &&
          !["Math", "global", "globalThis"].some((root) => mutatedRoots.has(root)) && ![...provenance(member.receiver)].some((root) => mutatedRoots.has(root)));
      }
      if (coercionOnly || ts.isAwaitExpression(value) || ts.isNewExpression(value) || ts.isTaggedTemplateExpression(value) || hidesGetter(value)) return false;
      if (ts.isIdentifier(value)) {
        const key = binding(value);
        if (typeof key !== "string" && key.declarations?.some(ts.isParameter)) return false;
      }
      if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
        const symbol = ts.isPropertyAccessExpression(value) ? checker.getSymbolAtLocation(value.name) : undefined;
        if (symbol?.declarations?.some((declaration) => ts.isGetAccessor(declaration) || ts.isSetAccessor(declaration))) return false;
      }
      const type = dataType(value);
      return !!(type.flags & ts.TypeFlags.NumberLike) && !(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown));
    };
    const safeComputedDataKey = (node: ts.Expression): boolean => {
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
        if (ts.isIdentifier(input.expression) && input.expression.text === "String" && typeof binding(input.expression) === "string" && !["global", "globalThis"].some((root) => mutatedRoots.has(root)) && ![...provenance(input.expression)].some((root) => mutatedRoots.has(root)) && input.arguments.length === 1 &&
          numericValue(input.arguments[0]!)) return true;
        if (numericValue(input)) return true;
      }
      if ([...provenance(node)].some((root) => mutatedRoots.has(root))) {
        return numericValue(node);
      }
      if (ts.isIdentifier(input) && numericValue(input)) return true;
      const expression = unwrap(node);
      if (ts.isIdentifier(expression)) {
        const symbol = binding(expression);
        if (typeof symbol !== "string" && !mutatedRoots.has(symbol)) {
          const boundedCondition = (condition: ts.Expression): boolean => {
            const value = unwrap(condition);
            if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return boundedCondition(value.left) || boundedCondition(value.right);
            if (!ts.isCallExpression(value) || value.arguments.length !== 1) return false;
            const member = property(value.expression), argument = unwrap(value.arguments[0]!);
            return member?.name === "includes" && ts.isArrayLiteralExpression(member.receiver) && member.receiver.elements.length > 0 &&
              member.receiver.elements.every((entry) => ts.isStringLiteralLike(entry) && !["constructor", "__proto__", "prototype"].includes(entry.text)) &&
              ts.isIdentifier(argument) && binding(argument) === symbol;
          };
          for (let branch: ts.Node = node; branch.parent; branch = branch.parent) {
            if (ts.isIfStatement(branch.parent) && branch.parent.thenStatement === branch && boundedCondition(branch.parent.expression)) return true;
          }
        }
        const declaration = typeof symbol !== "string" ? symbol.valueDeclaration : undefined;
        if (declaration && ts.isVariableDeclaration(declaration) && ts.isVariableDeclarationList(declaration.parent) && declaration.parent.flags & ts.NodeFlags.Const) {
          const loop = declaration.parent.parent;
          if (ts.isForOfStatement(loop) && ts.isArrayLiteralExpression(unwrap(loop.expression)) &&
              (unwrap(loop.expression) as ts.ArrayLiteralExpression).elements.every((entry) => ts.isStringLiteralLike(entry) && !["constructor", "__proto__", "prototype"].includes(entry.text))) return true;
        }
      }
      const safeType = (type: ts.Type): boolean => type.isUnion() ? type.types.every(safeType)
        : !!(type.flags & ts.TypeFlags.NumberLike) || type.isStringLiteral() && !["constructor", "__proto__", "prototype"].includes(type.value);
      const value = origin(node);
      const valueSymbol = ts.isIdentifier(value) ? binding(value) : undefined;
      if (valueSymbol && typeof valueSymbol !== "string" && bindingGetter(valueSymbol.valueDeclaration)) return false;
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
      if (ts.isIdentifier(value)) {
        const key = binding(value);
        if (typeof key !== "string" && key.declarations?.some(ts.isParameter)) {
          const literalData = (type: ts.Type): boolean => type.isUnion() ? type.types.every(literalData)
            : type.isStringLiteral() && !["constructor", "__proto__", "prototype"].includes(type.value);
          return literalData(dataType(value));
        }
      }
      return safeType(dataType(value));
    };
    const unsafeComputedReceiver = (node: ts.Expression, seen = new Set<ts.Expression>(), dataIndex = false, dataKey = dataIndex): boolean => {
      const provenData = dataKey;
      if (!provenData && [...provenance(node)].some((root) => mutatedRoots.has(root))) return true;
      const expression = origin(node);
      if (seen.has(expression)) return true;
      const next = new Set([...seen, expression]);
      if (!provenData && ts.isElementAccessExpression(unwrap(node)) && !/^(0|[1-9][0-9]*)$/.test(staticKey((unwrap(node) as ts.ElementAccessExpression).argumentExpression) ?? "")) return true;
      const resolvedType = dataType(expression);
      if (resolvedType.getCallSignatures().length || resolvedType.getConstructSignatures().length || ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return true;
      if (ts.isCallExpression(expression) || ts.isAwaitExpression(expression) || ts.isNewExpression(expression) ||
          ts.isConditionalExpression(expression) || ts.isBinaryExpression(expression) || ts.isTaggedTemplateExpression(expression)) {
        if (!provenData || dataType(expression).getCallSignatures().length) return true;
      }
      const key = ts.isIdentifier(expression) ? binding(expression) : undefined;
      const declaration = key && typeof key !== "string" ? key.valueDeclaration : undefined;
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
    const reviewedDescriptor = (node: ts.Node): boolean => {
      if (file.path !== `${ARENA}/src/challengeContract/validation.ts`) return false;
      const failDeclaration = source.statements.filter(ts.isVariableStatement).flatMap((statement) => [...statement.declarationList.declarations])
        .find((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === "fail");
      if (failDeclaration?.getText(source) !== 'fail = (path: string, code = "SCHEMA"): never => { throw new ContractError(path, code); }') return false;
      for (let declaration: ts.Node | undefined = node; declaration; declaration = declaration.parent) {
        if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) && declaration.name.text === "inspectDto") return declaration.getText(source) === REVIEWED_INSPECT_DTO;
      }
      return false;
    };
    const reviewedArrayDescriptor = (node: ts.Node): boolean => {
      if (file.path !== `${ARENA}/src/challengeContract/validation.ts` || node.getText(source) !== "Object.getOwnPropertyDescriptor") return false;
      const call = node.parent;
      if (!ts.isCallExpression(call) || call.expression !== node || call.getText(source) !== "Object.getOwnPropertyDescriptor(value, String(index))") return false;
      for (let declaration: ts.Node | undefined = call; declaration; declaration = declaration.parent) {
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
    const timerReference = (node: ts.Expression): boolean => {
      const expression = origin(node), member = property(expression);
      return ts.isIdentifier(expression) && ["setTimeout", "setInterval", "setImmediate"].includes(expression.text) && typeof binding(expression) === "string" ||
        !!(member && ["setTimeout", "setInterval", "setImmediate"].includes(member.name ?? "") && hostRoot(member.receiver));
    };
    const callableTimerArgument = (node: ts.Expression | undefined): boolean => {
      if (!node || ts.isSpreadElement(node)) return false;
      const expression = unwrap(node), value = origin(expression);
      if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return true;
      if (!ts.isIdentifier(expression)) return false;
      const callableType = (type: ts.Type): boolean => !(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Union)) && type.getCallSignatures().length > 0;
      if (!callableType(dataType(expression))) return false;
      return ts.isArrowFunction(value) || ts.isFunctionExpression(value) || ts.isIdentifier(value) && callableType(dataType(value));
    };
    const visit = (node: ts.Node): void => {
      if (file.path === `${ARENA}/src/challengeContract/validation.ts` && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) &&
          node.name.text === "inspectDto" && !reviewedDescriptor(node)) throw new Error(`Unsupported code constructor acquisition: ${file.path}`);
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
      const hostProcessRead = value && property(node as ts.Expression)?.name === "process" && hostRoot(property(node as ts.Expression)!.receiver);
      if (value && PURE.has(file.partition) && (processNamespace(node as ts.Expression) || hostProcessRead) && !(ts.isIdentifier(node) && sourceIsDeclaration(node))) throw new Error(`Forbidden process access: ${file.path}`);
      if (value && evaluation(node as ts.Expression)) throw new Error(`Unsupported string evaluation: ${file.path}`);
      if (value && !(ts.isIdentifier(node) && sourceIsDeclaration(node)) && timerReference(node as ts.Expression)) {
        const use = wrappedUse(node as ts.Expression), call = use.parent;
        if (!ts.isCallExpression(call) || call.expression !== use || !callableTimerArgument(call.arguments[0])) throw new Error(`Unsupported string evaluation: ${file.path}`);
      }
      const accessed = value ? property(node as ts.Expression) : undefined;
      const reflected = value ? property(origin(node as ts.Expression)) : undefined;
      const descriptorSeam = reflected && ["getPrototypeOf", "getOwnPropertyDescriptors"].includes(reflected.name ?? "") &&
        objectNamespace(origin(reflected.receiver)) && reviewedDescriptor(node) && ts.isCallExpression(node.parent) && node.parent.expression === node;
      if (reflected && (reflectionNamespace(origin(reflected.receiver)) && ["get", "getOwnPropertyDescriptor", undefined].includes(reflected.name) ||
          objectNamespace(origin(reflected.receiver)) && ["getOwnPropertyDescriptor", "getPrototypeOf", "getOwnPropertyDescriptors", undefined].includes(reflected.name)) &&
          !descriptorSeam && !reviewedArrayDescriptor(node)) throw new Error(`Unsupported code constructor acquisition: ${file.path}`);
      if (["constructor", "__proto__", "getPrototypeOf", "getOwnPropertyDescriptors"].includes(accessed?.name ?? "") && !descriptorSeam) throw new Error(`Unsupported code constructor acquisition: ${file.path}`);
      if (accessed && objectNamespace(accessed.receiver) && accessed.name === undefined) throw new Error(`Unsupported code constructor acquisition: ${file.path}`);
      if (accessed && reflectionNamespace(accessed.receiver) && !["ownKeys", "apply", "has", "set", "deleteProperty"].includes(accessed.name ?? "")) throw new Error(`Unsupported code constructor acquisition: ${file.path}`);
      const boundName = ts.isBindingElement(node) ? node.propertyName ? ownName(node.propertyName) : ts.isIdentifier(node.name) ? node.name.text : undefined : undefined;
      const bound = ts.isBindingElement(node) ? bindingMember(node) : undefined;
      if (ts.isBindingElement(node) && (["constructor", "__proto__", "eval", "Function", "process", "setTimeout", "setInterval", "setImmediate", "getPrototypeOf", "getOwnPropertyDescriptors", "getOwnPropertyDescriptor"].includes(boundName ?? "") ||
          bound?.name === "get" && reflectionNamespace(origin(bound.receiver)) || node.propertyName && ts.isComputedPropertyName(node.propertyName))) throw new Error(`Unsupported code constructor acquisition: ${file.path}`);
      if (ts.isElementAccessExpression(node) && mutableOrigin(node.expression) && !safeDataKey(node.argumentExpression)) throw new Error(`Unsupported mutable computed receiver: ${file.path}`);
      if (ts.isElementAccessExpression(node) && loader(node.expression) && staticKey(node.argumentExpression) === undefined) throw new Error(`Unsupported loader escape: ${file.path}`);
      const assignment = ts.isElementAccessExpression(node) && ts.isBinaryExpression(wrappedUse(node).parent) &&
        (wrappedUse(node).parent as ts.BinaryExpression).left === wrappedUse(node) ? (wrappedUse(node).parent as ts.BinaryExpression).operatorToken.kind : undefined;
      const directDataWrite = assignment === ts.SyntaxKind.EqualsToken ||
        [ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken].includes(assignment ?? ts.SyntaxKind.Unknown);
      const scalarComparison = ts.isElementAccessExpression(node) && (ts.isTemplateSpan(wrappedUse(node).parent) || ts.isTypeOfExpression(wrappedUse(node).parent) || ts.isBinaryExpression(wrappedUse(node).parent) &&
         [ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken,
           ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
           ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.AsteriskAsteriskToken, ts.SyntaxKind.SlashToken, ts.SyntaxKind.PercentToken,
           ts.SyntaxKind.AmpersandToken, ts.SyntaxKind.BarToken, ts.SyntaxKind.CaretToken, ts.SyntaxKind.LessThanLessThanToken,
           ts.SyntaxKind.GreaterThanGreaterThanToken, ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken]
          .includes((wrappedUse(node).parent as ts.BinaryExpression).operatorToken.kind));
      if (ts.isElementAccessExpression(node) && !directDataWrite && !ts.isVoidExpression(wrappedUse(node).parent) && !reviewedDescriptor(node) && unsafeComputedReceiver(node.expression, new Set(),
          /^(0|[1-9][0-9]*)$/.test(staticKey(node.argumentExpression) ?? ""), scalarComparison || safeComputedDataKey(node.argumentExpression))) throw new Error(`Unsupported code constructor acquisition: ${file.path} -> ${node.getText(source)}`);
      const hostProcess = (receiver: ts.Expression): boolean => {
        const expression = origin(unwrap(receiver));
        const member = property(expression);
        return processNamespace(expression) || member?.name === "process" && hostRoot(member.receiver);
      };
      if (accessed && hostProcess(accessed.receiver) && ["getBuiltinModule", "mainModule", "require", "binding", "dlopen"].includes(accessed.name ?? "")) throw new Error(`Unsupported builtin acquisition: ${file.path}`);
      if (accessed && namespace(accessed.receiver) && ["register", "registerHooks"].includes(accessed.name ?? "")) throw new Error(`Unsupported module loader API: ${file.path}`);
      if (value && (namespace(node as ts.Expression) || processNamespace(node as ts.Expression) || globalNamespace(node as ts.Expression) || reflectionNamespace(node as ts.Expression) || objectNamespace(node as ts.Expression) || factory(node as ts.Expression) || loader(node as ts.Expression) || resolver(node as ts.Expression))) {
        const expression = node as ts.Expression;
        const use = wrappedUse(expression);
        const parent = use.parent;
        const declaration = ts.isIdentifier(node) && sourceIsDeclaration(node);
        const alias = ts.isVariableDeclaration(parent) && parent.initializer === use && ts.isIdentifier(parent.name) && !resolver(expression);
        const runtimeNamespace = processNamespace(expression) || globalNamespace(expression) || reflectionNamespace(expression) || objectNamespace(expression);
        const directCall = ts.isCallExpression(parent) && parent.expression === use && !namespace(expression) && (!runtimeNamespace || objectNamespace(expression));
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
            if (["node:process", "process"].includes(specifier) && names.some((name) => ["getBuiltinModule", "mainModule", "require", "binding", "dlopen"].includes(name))) throw new Error(`Unsupported builtin acquisition: ${file.path}`);
          }
          if (ts.isExportDeclaration(node) && !typeOnly && ["node:module", "module"].includes(specifier) &&
               (!node.exportClause || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some((element) => !element.isTypeOnly && ["createRequire", "default", "Module", "register", "registerHooks"].includes((element.propertyName ?? element.name).text)))) throw new Error(`Unsupported loader escape: ${file.path}`);
          if (ts.isExportDeclaration(node) && !typeOnly && ["node:process", "process"].includes(specifier) &&
              (!node.exportClause || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some((element) => !element.isTypeOnly && ["getBuiltinModule", "mainModule", "require", "binding", "dlopen", "default"].includes((element.propertyName ?? element.name).text)))) throw new Error(`Unsupported builtin acquisition: ${file.path}`);
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
  const planningVisited = new Set<string>();
  const auditPlanning = (path: string): void => {
    if (planningVisited.has(path)) return;
    planningVisited.add(path);
    if (path === `${CORE}/src/index.ts` || path.startsWith(`${CORE}/src/`) && /\/src\/(?:scfen|replay|commands|resolve)\//.test(path)) {
      throw new Error(`Forbidden native planning edge: ${path}`);
    }
    for (const edge of edges.filter((edge) => edge.importer === path)) {
      if (edge.targetKind === "source") auditPlanning(edge.target);
      else if (edge.target === "fflate" || edge.target.startsWith("fflate/")) throw new Error(`Forbidden native planning edge: ${path} -> ${edge.target}`);
    }
  };
  auditPlanning(`${CORE}/src/planning-v1.ts`);
  edges.sort((a, b) => order(canonical(a), canonical(b)));
  const groups = Object.fromEntries(SOURCE_PARTITIONS.map((partition) => [partition, files.filter((file) => file.partition === partition)])) as SourceInventoryV2["groups"];
  const partitionSha256 = Object.fromEntries(SOURCE_PARTITIONS.map((partition) => [partition, hash(canonical(groups[partition]))])) as SourceInventoryV2["partitionSha256"];
  const runtimeRecords = [...runtime.values()].sort((a, b) => order(a.path, b.path));
  const audit: SourceImportAudit = { passed: true, edges, auditedFiles };
  const descriptor: Pick<SourceInventoryV2, "version" | "policyVersion" | "roots" | "entrypoints" | "files" | "groups"> = {
    version: SOURCE_INVENTORY_VERSION, policyVersion: SOURCE_POLICY_VERSION, roots: ROOTS, entrypoints: currentEntrypoints, files, groups,
  };
  return {
    ...descriptor, runtime: runtimeRecords, audit, partitionSha256,
    runtimeConfigurationSha256: hash(canonical(runtimeRecords)),
    inventorySha256: hash(canonical(descriptor)),
  };
};
