// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as ownedBytes from "../economic/ownedBytes";
import * as ownedGuards from "../economic/ownedGuards";
import * as ownedKernel from "../economic/ownedKernel";
import * as ownedScalars from "../economic/ownedScalars";
import * as ownedSchema from "../economic/ownedSchema";
import { ownedGuardNames, ownedKernelNames, ownedKernelTypeNames } from "./ownedSurface";

const readSource = (file: string): string => readFileSync(new URL(`../${file}.ts`, import.meta.url), "utf8");
const parseSource = (file: string): ts.SourceFile => ts.createSourceFile(
  `${file}.ts`, readSource(file), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS,
);
const forbiddenKernelBindings = new Set(["createPlanningLedger", "LedgerOwner", "LedgerPair"]);
const allowsModelKernelAcquisition = (node: ts.Node): boolean => {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    return !!clause && !clause.name && !!clause.namedBindings && ts.isNamedImports(clause.namedBindings) &&
      clause.namedBindings.elements.every(element => !forbiddenKernelBindings.has((element.propertyName ?? element.name).text));
  }
  if (ts.isExportDeclaration(node)) return !!node.exportClause && ts.isNamedExports(node.exportClause) &&
    node.exportClause.elements.every(element => !forbiddenKernelBindings.has((element.propertyName ?? element.name).text));
  if (ts.isImportTypeNode(node)) return !!node.qualifier && ts.isIdentifier(node.qualifier) && !forbiddenKernelBindings.has(node.qualifier.text);
  return false;
};
const exportsIn = (ast: ts.SourceFile): string[] => {
  const names: string[] = [];
  for (const statement of ast.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) names.push(element.name.text);
    }
    if (ts.isExportDeclaration(statement)) expect(statement.exportClause && ts.isNamedExports(statement.exportClause)).toBe(true);
    if (ts.isExportAssignment(statement)) throw new Error("Unapproved export assignment");
    if ((ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isFunctionDeclaration(statement)) &&
        statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      expect(statement.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)).toBe(false);
      expect(statement.name).toBeDefined();
      names.push(statement.name!.text);
    }
    if (ts.isVariableStatement(statement) && statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) {
        expect(ts.isIdentifier(declaration.name)).toBe(true);
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
      }
    }
  }
  return names.sort();
};

describe("private owned foundation slice boundaries", () => {
  it("preserves the package's only public entry and current candidates surface", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(manifest.exports).toEqual({ "./candidates": "./src/candidates.ts" });
    const candidates = parseSource("candidates");
    expect(exportsIn(candidates)).toEqual([
      "COMPOSITION_VERSION", "CandidateBatchV3", "CandidateDiagnostics", "CandidateKind", "CandidateLane", "CandidatePool",
      "Kind", "Lane", "MAX_ATTEMPTED_EXTENSIONS", "MAX_GENERATED_ACTIONS", "MAX_RETAINED_CANDIDATES", "PoolRecord",
      "composeCandidatesFromHistoryV2", "composeCandidatesFromObservationV1", "decodeCandidate",
    ].sort());
    const modules: string[] = [];
    for (const statement of candidates.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (!statement.moduleSpecifier) continue;
      expect(ts.isStringLiteral(statement.moduleSpecifier)).toBe(true);
      modules.push((statement.moduleSpecifier as ts.StringLiteral).text);
    }
    expect(modules.sort()).toEqual([
      "@chess-coach/starchess-arena/observations", "@chess-coach/starchess-arena/intent-codec-v1",
      "./contracts", "./contracts", "./contracts", "./composition",
    ].sort());
  });

  it("keeps the byte facade limited to safe kernel snapshot operations and types", () => {
    expect(Object.keys(ownedBytes).sort()).toEqual([
      "readSnapshotByte", "requireSnapshot", "snapshotFixedBytes", "snapshotLength", "snapshotProduction",
    ]);
    const ast = parseSource("economic/ownedBytes");
    expect(exportsIn(ast)).toEqual([
      "ByteProduction", "OwnedByteSnapshot", "readSnapshotByte", "requireSnapshot", "snapshotFixedBytes", "snapshotLength", "snapshotProduction",
    ].sort());
    for (const statement of ast.statements) {
      expect(ts.isExportDeclaration(statement)).toBe(true);
      if (!ts.isExportDeclaration(statement)) continue;
      expect(statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text).toBe("./ownedKernel");
      expect(statement.exportClause && ts.isNamedExports(statement.exportClause)).toBe(true);
    }
  });

  it("exports only the six schema-directed codecs", () => {
    const expected = [
      "decodeOwnedFloat64Hex", "decodeOwnedOpening", "decodeOwnedRef",
      "encodeOwnedFloat64Hex", "encodeOwnedOpening", "encodeOwnedRef",
    ];
    expect(Object.keys(ownedSchema).sort()).toEqual(expected);
    expect(exportsIn(parseSource("economic/ownedSchema"))).toEqual(expected);
  });

  it("pins named R4 builders and the restricted B1 issuer without a generic registrar or backing-store access", () => {
    expect(new Set(ownedKernelNames).size).toBe(ownedKernelNames.length);
    expect(Object.keys(ownedKernel).sort()).toEqual(ownedKernelNames);
    expect(exportsIn(parseSource("economic/ownedKernel"))).toEqual([...ownedKernelNames, ...ownedKernelTypeNames].sort());
    expect(Object.keys(ownedGuards).sort()).toEqual(ownedGuardNames);
    expect(exportsIn(parseSource("economic/ownedGuards"))).toEqual(ownedGuardNames);
    for (const statement of parseSource("economic/ownedGuards").statements) {
      expect(ts.isExportDeclaration(statement)).toBe(true);
      if (!ts.isExportDeclaration(statement)) continue;
      expect(statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text).toBe("./ownedKernel");
      expect(statement.exportClause && ts.isNamedExports(statement.exportClause)).toBe(true);
    }
    expect(Object.keys(ownedScalars).sort()).toEqual(["decodeOwnedNumber", "encodeOwnedNumber", "equalOwnedRefs"]);
    const dependencies: Record<string, readonly string[]> = {
      ownedKernel: ["./ownedErrors", "./contracts", "./invoices", "jssha/sha256", "@chess-coach/starchess-core/planning-v1"],
      ownedGuards: ["./ownedKernel"], ownedScalars: ["./ownedKernel"], ownedBytes: ["./ownedKernel"],
      ownedSchema: ["./ownedBytes", "./ownedErrors", "./ownedKernel"], ownedErrors: [],
      ownedR4Schema: ["./ownedKernel", "./contracts", "jssha/sha256"],
    };
    for (const [file, allowed] of Object.entries(dependencies)) {
      const modules = new Set<string>();
      for (const statement of parseSource(`economic/${file}`).statements) {
        if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
        if (!statement.moduleSpecifier) continue;
        expect(ts.isStringLiteral(statement.moduleSpecifier)).toBe(true);
        modules.add((statement.moduleSpecifier as ts.StringLiteral).text);
      }
      expect([...modules].sort()).toEqual([...allowed].sort());
    }
  });

  it("excludes private accounting constructors from runtime and type-only model imports", () => {
    const root = fileURLToPath(new URL("../", import.meta.url));
    const files: string[] = [];
    const visit = (directory: string): void => {
      for (const item of readdirSync(directory, { withFileTypes: true })) {
        if (item.name === "coordinator" || item.name === "__tests__") continue;
        const path = join(directory, item.name);
        if (item.isDirectory()) visit(path);
        else if (item.name.endsWith(".ts")) files.push(path);
      }
    };
    visit(root);
    for (const file of files) {
      const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
      const inspect = (node: ts.Node): void => {
        let literal: ts.StringLiteralLike | undefined;
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
          if (node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) literal = node.moduleSpecifier;
        } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) {
          literal = node.argument.literal;
        } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) &&
          node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
          literal = node.moduleReference.expression;
        } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require")) {
          if (node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) literal = node.arguments[0];
        }
        if (literal) {
          const module = literal.text;
          expect(module.includes("coordinator"), `${relative(root, file)}: ${module}`).toBe(false);
          if (module.startsWith(".")) {
            const resolved = resolve(dirname(file), module).replace(/\.(?:[cm]?[jt]s|[jt]sx)$/, "");
            const target = relative(root, resolved).split(sep);
            expect(target[0], `${relative(root, file)}: ${module}`).not.toBe("coordinator");
            if (resolved === join(root, "economic", "ownedKernel")) {
              expect(allowsModelKernelAcquisition(node), `${relative(root, file)}: ${node.getText(ast)}`).toBe(true);
            }
          }
        }
        ts.forEachChild(node, inspect);
      };
      inspect(ast);
    }
  });

  it.each([
    'import { createPlanningLedger as fresh } from "./ownedKernel";',
    'import type { LedgerOwner as Owner } from "./ownedKernel";',
    'export { LedgerPair as Pair } from "./ownedKernel";',
    'export type { LedgerOwner as Owner } from "./ownedKernel";',
    'export * from "./ownedKernel";',
    'export * as kernel from "./ownedKernel";',
    'import * as kernel from "./ownedKernel";',
    'import kernel from "./ownedKernel";',
    'type Owner = import("./ownedKernel").LedgerOwner;',
    'type Kernel = typeof import("./ownedKernel");',
    'const dead = () => import("./ownedKernel");',
    'const dead = () => require("./ownedKernel");',
    'import kernel = require("./ownedKernel");',
  ])("rejects the model-side B1 acquisition route %s", source => {
    const ast = ts.createSourceFile("fixture.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    let acquisition: ts.Node | undefined;
    const inspect = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isImportTypeNode(node) || ts.isImportEqualsDeclaration(node) ||
          ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require")) acquisition = node;
      ts.forEachChild(node, inspect);
    };
    inspect(ast);
    expect(acquisition).toBeDefined();
    expect(allowsModelKernelAcquisition(acquisition!)).toBe(false);
  });

  it("typechecks the construction slice source and tests with their import closure", () => {
    const configPath = fileURLToPath(new URL("../../tsconfig.json", import.meta.url));
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    expect(config.error).toBeUndefined();
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
    expect(parsed.errors).toEqual([]);
    const roots = [
      "../economic/ownedBytes.ts", "../economic/ownedSchema.ts",
      "../economic/ownedScalars.ts", "../economic/ownedGuards.ts",
      "./ownedSchemaBytes.test.ts", "./ownedFoundationBoundary.test.ts",
      "./ownedScalars.test.ts", "./ownedConstructionBounds.test.ts",
    ].map(file => fileURLToPath(new URL(file, import.meta.url)));
    const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram(roots, parsed.options))
      .filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
    expect(diagnostics.map(diagnostic => `${diagnostic.file?.fileName}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`)).toEqual([]);
  });

  it.each(["economic/ownedBytes", "economic/ownedSchema"])(
    "confines %s to the agreed private foundation imports and source pointer", file => {
      const source = readSource(file);
      expect(source.split("\n")[0]).toBe("// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml");
      const allowed = file === "economic/ownedBytes" ? ["./ownedKernel"] : ["./ownedBytes", "./ownedErrors", "./ownedKernel"];
      const modules: string[] = [];
      for (const statement of parseSource(file).statements) {
        if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
        if (!statement.moduleSpecifier) continue;
        expect(ts.isStringLiteral(statement.moduleSpecifier)).toBe(true);
        const module = (statement.moduleSpecifier as ts.StringLiteral).text;
        expect(allowed).toContain(module);
        modules.push(module);
      }
      expect([...new Set(modules)].sort()).toEqual(allowed.sort());
      const output = ts.transpileModule(source, {
        fileName: `${file}.ts`, reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, isolatedModules: true },
      });
      expect(output.diagnostics?.filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)).toEqual([]);
    },
  );

  it("keeps schema parsing direct and leaves registry and backing-buffer authority in the kernel", () => {
    const forbiddenIdentifiers = new Set([
      "JSON", "Reflect", "Object", "Proxy", "WeakMap", "WeakSet", "Map", "Set", "Symbol",
      "ArrayBuffer", "SharedArrayBuffer", "DataView", "Buffer", "TextEncoder", "TextDecoder", "Atomics",
      "eval", "require", "process", "fetch", "WebSocket", "structuredClone",
      "Meter", "charge", "freshMeter", "register", "registrar", "initializeEconomicState",
      "composeWithRuntime", "composeHistory", "validateOpening", "readByteRef", "referenceBytes",
    ]);
    const forbiddenMethods = new Set([
      "parse", "stringify", "getOwnPropertyDescriptor", "getOwnPropertyDescriptors", "getPrototypeOf", "ownKeys",
      "assign", "defineProperty", "defineProperties", "entries", "keys", "values", "from", "set", "slice", "subarray",
    ]);
    const inspect = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) expect(forbiddenIdentifiers.has(node.text), node.text).toBe(false);
      expect(ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isSpreadElement(node) || ts.isSpreadAssignment(node)).toBe(false);
      expect(ts.isTemplateExpression(node)).toBe(false);
      if (ts.isCallExpression(node)) {
        expect(node.expression.kind).not.toBe(ts.SyntaxKind.ImportKeyword);
        if (ts.isPropertyAccessExpression(node.expression)) expect(forbiddenMethods.has(node.expression.name.text), node.expression.name.text).toBe(false);
      }
      ts.forEachChild(node, inspect);
    };
    inspect(parseSource("economic/ownedSchema"));
  });
});
