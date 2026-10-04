// SPEC: _spec/packages/starchess-arena/newgeneration.puml
import { readFileSync, existsSync } from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as observations from "../observations";

const arena = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const core = resolve(arena, "../starchess-core");
const require = createRequire(import.meta.url);
const localTarget = (importer: string, specifier: string): string => {
  const base = resolve(dirname(importer), specifier);
  const candidates = [base, `${base}.ts`, join(base, "index.ts")].filter((path) => existsSync(path) && path.endsWith(".ts"));
  expect(candidates, `${importer} -> ${specifier}`).toHaveLength(1);
  return candidates[0]!;
};
const runtimeEdges = (path: string): string[] => {
  const emitted = ts.transpileModule(readFileSync(path, "utf8"), {
    fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const source = ts.createSourceFile(path, emitted, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const edges: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      expect(ts.isStringLiteral(node.moduleSpecifier)).toBe(true);
      edges.push((node.moduleSpecifier as ts.StringLiteral).text);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      ts.isIdentifier(node.expression) && node.expression.text === "require")) {
      expect(node.arguments).toHaveLength(1);
      expect(ts.isStringLiteral(node.arguments[0]!)).toBe(true);
      edges.push((node.arguments[0] as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return edges;
};

describe("public V1 bridge isolation", () => {
  it("publishes exactly the selected arena subpaths through real package resolution", () => {
    const manifest = JSON.parse(readFileSync(join(arena, "package.json"), "utf8"));
    expect(manifest.exports).toEqual({
      ".": "./src/index.ts", "./observations": "./src/observations.ts", "./intent-codec-v1": "./src/intent-codec-v1.ts",
    });
    for (const subpath of ["observations", "intent-codec-v1"]) {
      expect(require.resolve(`@chess-coach/starchess-arena/${subpath}`)).toBe(join(arena, "src", `${subpath}.ts`));
    }
    expect(Object.keys(observations).sort()).toEqual(["decodeObservationV1", "encodeObservationV1", "validateObservationV1"]);
  });

  it.each(["observations.ts", "intent-codec-v1.ts"])("keeps %s runtime closure free of Node imports and arena host/baseline modules", (entry) => {
    const allowedArena = new Set([
      "observations.ts", "intent-codec-v1.ts", "authorized/v1/canonical.ts", "authorized/v1/squares.ts",
      "authorized/v1/observationCodec.ts", "challengeContract/candidateWire.ts", "challengeContract/validation.ts",
    ].map((path) => join(arena, "src", path)));
    const seen = new Set<string>();
    const visit = (path: string): void => {
      if (seen.has(path)) return;
      seen.add(path);
      if (path.startsWith(`${arena}/`)) expect(allowedArena.has(path), path).toBe(true);
      else expect(path.startsWith(`${core}/src/`), path).toBe(true);
      for (const specifier of runtimeEdges(path)) {
        expect(isBuiltin(specifier), `${path} -> ${specifier}`).toBe(false);
        if (specifier.startsWith(".")) visit(localTarget(path, specifier));
        else throw new Error(`Non-leaf runtime dependency: ${path} -> ${specifier}`);
      }
    };
    visit(join(arena, "src", entry));
    expect(seen.has(join(arena, "src/authorized/v1/observationCodec.ts"))).toBe(true);
    expect(seen.has(join(arena, "src/challengeContract/candidateWire.ts"))).toBe(entry === "intent-codec-v1.ts");
    expect(seen.has(join(core, "src/index.ts"))).toBe(false);
  });
});
