// SPEC: _spec/engine-consolidation.puml
import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as canonical from "@chess-coach/starchess-core/engine";

test("canonical public modules own the native API without a legacy package dependency", async () => {
  const root = new URL("../../../../", import.meta.url);
  const directory = new URL("../../src/engine/", import.meta.url);
  const files = readdirSync(directory).filter(file => file.endsWith(".ts")).sort();
  expect(files).toContain("index.ts");
  expect(existsSync(new URL("packages/game-core/package.json", root))).toBe(false);
  for (const owner of ["starchess-core", "contracts", "policy", "runtime"]) {
    const manifest = JSON.parse(readFileSync(new URL(`packages/${owner}/package.json`, root), "utf8"));
    for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      expect(manifest[section]?.["@chess-coach/game-core"], `${owner}:${section}`).toBeUndefined();
    }
    const source = fileURLToPath(new URL(`packages/${owner}/src/`, root));
    for (const file of new Bun.Glob("**/*.ts").scanSync({ cwd: source, onlyFiles: true, followSymlinks: false })) {
      expect(readFileSync(resolve(source, file), "utf8"), `${owner}:${file}`).not.toMatch(/["']@chess-coach\/game-core(?:\/[^"']*)?["']/);
    }
  }
  for (const file of files) {
    const name = file.slice(0, -3);
    const implementation = await import(new URL(file, directory).href);
    const entry = name === "index" ? "@chess-coach/starchess-core/engine"
      : name === "causal-producer" || name === "causal-types" ? `@chess-coach/starchess-core/${name}`
      : `@chess-coach/starchess-core/engine/${name}`;
    const publicModule = await import(entry);
    expect(Object.keys(publicModule).sort(), file).toEqual(Object.keys(implementation).sort());
    for (const key of Object.keys(publicModule)) expect(publicModule[key], `${file}:${key}`).toBe(implementation[key]);
    if (name === "index") for (const key of Object.keys(canonical)) expect(publicModule[key], key).toBe(canonical[key as keyof typeof canonical]);
  }
});

test("unobserved product and native entrypoints do not load a causal producer implementation", () => {
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  for (const entry of ["../../src/index.ts", "../../src/engine/index.ts"]) {
    const reached = new Set<string>();
    const visit = (file: string): void => {
      if (reached.has(file)) return;
      reached.add(file);
      for (const imported of transpiler.scanImports(readFileSync(file, "utf8"))) {
        if (!imported.path.startsWith(".")) continue;
        const candidate = resolve(dirname(file), imported.path);
        const next = [candidate + ".ts", resolve(candidate, "index.ts"), candidate].find(path => existsSync(path) && path.endsWith(".ts"));
        if (next) visit(next);
      }
    };
    visit(fileURLToPath(new URL(entry, import.meta.url)));
    expect([...reached].filter(path => /\/engine\/causal-(producer|events)\.ts$/.test(path))).toEqual([]);
    expect([...reached].filter(path => /\/resolve\/(submit-turn|resolve-turn)\.ts$/.test(path))).toHaveLength(2);
  }
});
