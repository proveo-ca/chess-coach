// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const arenaRoot = fileURLToPath(new URL("../../", import.meta.url));
const runtimeSpecifiers = (filename: string): string[] => {
  const source = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
  return source.statements.flatMap((statement) => {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      if (clause?.isTypeOnly) return [];
      if (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.every((entry) => entry.isTypeOnly)) return [];
      return [statement.moduleSpecifier.text];
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      if (statement.isTypeOnly || (statement.exportClause && ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.every((entry) => entry.isTypeOnly))) return [];
      return [statement.moduleSpecifier.text];
    }
    return [];
  });
};

describe("public arena V1 pure closures", () => {
  it("resolves exactly the two new package subpaths", () => {
    const manifest = JSON.parse(readFileSync(resolve(arenaRoot, "package.json"), "utf8"));
    expect(manifest.exports["./observations"]).toBe("./src/observations.ts");
    expect(manifest.exports["./intent-codec-v1"]).toBe("./src/intent-codec-v1.ts");
    expect(require.resolve("@chess-coach/starchess-arena/observations")).toBe(resolve(arenaRoot, "src/observations.ts"));
    expect(require.resolve("@chess-coach/starchess-arena/intent-codec-v1")).toBe(resolve(arenaRoot, "src/intent-codec-v1.ts"));
  });

  it.each(["observations", "intent-codec-v1"])("keeps %s transitive runtime imports in pure leaves", (entrypoint) => {
    const pending = [resolve(arenaRoot, `src/${entrypoint}.ts`)];
    const visited = new Set<string>();
    while (pending.length) {
      const filename = pending.pop()!;
      if (visited.has(filename)) continue;
      visited.add(filename);
      if (filename.startsWith(resolve(arenaRoot, "src") + "/")) {
        const relative = filename.slice(resolve(arenaRoot, "src").length + 1);
        expect(relative, filename).toMatch(/^(observations\.ts|intent-codec-v1\.ts|authorized\/v1\/[^/]+\.ts|challengeContract\/validation\.ts)$/);
      }
      for (const specifier of runtimeSpecifiers(filename)) {
        expect(specifier, filename).not.toMatch(/^(node:|fs$|path$|crypto$|child_process$|worker_threads$)/);
        if (specifier.startsWith(".")) {
          pending.push(resolve(dirname(filename), `${specifier}.ts`));
        } else {
          expect(specifier, filename).toBe("@chess-coach/starchess-core/rules");
          pending.push(require.resolve(specifier));
        }
      }
    }
    expect([...visited].some((filename) => filename.endsWith("authorized/v1/observationCodec.ts"))).toBe(true);
    expect([...visited].some((filename) => filename.endsWith("challenge/baseline.ts"))).toBe(false);
  });
});
