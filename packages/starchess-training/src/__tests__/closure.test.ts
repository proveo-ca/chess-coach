// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it } from "vitest";

it("compiles source import descriptors and confines production to the approved pure closures", () => {
  const files = ["candidates", "composition", "contracts", "domain", "identity"];
  const external = new Set([
    "@chess-coach/starchess-arena/observations", "@chess-coach/starchess-arena/intent-codec-v1",
    "@chess-coach/starchess-core", "@noble/hashes/sha2.js",
  ]);
  const native = new Set([
    "appendTimeSpecialAnchor", "charonDiagonalSquaresFromSquare", "classicalActorAt",
    "classicalRewriteCoordinatesAfterB", "isScMoveShape", "knownAppendFailure", "marineSingleTarget", "spawnCCAnchorFromMap",
    "PlanningKnowledge", "ScActionInput", "SpawnPiece", "Square",
  ]);
  const imports = new Set<string>();
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}.ts`, import.meta.url), "utf8");
    const ast = ts.createSourceFile(`${file}.ts`, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    for (const statement of ast.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (!statement.moduleSpecifier) continue;
      expect(ts.isStringLiteral(statement.moduleSpecifier)).toBe(true);
      const module = (statement.moduleSpecifier as ts.StringLiteral).text;
      imports.add(module);
      expect(external.has(module) || files.some((name) => module === `./${name}`)).toBe(true);
      if (module === "@chess-coach/starchess-core" && ts.isImportDeclaration(statement)) {
        const bindings = statement.importClause?.namedBindings;
        expect(bindings && ts.isNamedImports(bindings)).toBe(true);
        if (bindings && ts.isNamedImports(bindings)) {
          for (const item of bindings.elements) expect(native.has((item.propertyName ?? item.name).text)).toBe(true);
        }
      }
    }
    const inspect = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        expect(["process", "require", "eval", "fetch", "WebSocket", "ScFenSnapshot", "addScAction", "resolveTurn", "endScTurn"].includes(node.text)).toBe(false);
      }
      if (ts.isCallExpression(node)) expect(node.expression.kind).not.toBe(ts.SyntaxKind.ImportKeyword);
      ts.forEachChild(node, inspect);
    };
    inspect(ast);
    const output = ts.transpileModule(source, { fileName: `${file}.ts`, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, isolatedModules: true } });
    expect(output.diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error)).toEqual([]);
  }
  expect([...external].every((specifier) => imports.has(specifier))).toBe(true);
});
