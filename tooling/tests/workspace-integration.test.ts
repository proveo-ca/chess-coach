// SPEC: _spec/ml-runtime-architecture.puml
import { expect, test } from "bun:test";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
const maintainedRoots = new Set(["apps", "packages", "tooling", "crates", "_spec", "schemas"]);
type Manifest = { name: string; scripts: Record<string, string> } & Record<
  "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies", Record<string, string> | undefined
>;

function assertInsideRoot(path: string): void {
  const local = relative(root, path);
  expect(local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local), path).toBe(false);
}

function rooted(path: string): string {
  expect(path.length, path).toBeGreaterThan(0);
  expect(isAbsolute(path), path).toBe(false);
  expect(path.split(/[\\/]/), path).not.toContain("..");
  const absolute = resolve(root, path);
  assertInsideRoot(absolute);
  return absolute;
}

function existingFile(path: string): string {
  const absolute = rooted(path);
  expect(statSync(absolute).isFile(), path).toBe(true);
  assertInsideRoot(realpathSync(absolute));
  return absolute;
}

const read = (path: string): string => readFileSync(existingFile(path), "utf8");
const load = <T>(path: string): T => JSON.parse(read(path)) as T;
const hasMagic = (part: string): boolean => ["*", "?", "["].some(character => part.includes(character));

function coveredFiles(pattern: string): string[] {
  rooted(pattern);
  const parts = pattern.split("/");
  const firstMagic = parts.findIndex(hasMagic);
  if (firstMagic < 0) return [existingFile(pattern)];
  expect(firstMagic, pattern).toBeGreaterThan(0);
  expect(maintainedRoots.has(parts[0]!), pattern).toBe(true);
  const cwd = rooted(parts.slice(0, firstMagic).join("/"));
  expect(statSync(cwd).isDirectory(), pattern).toBe(true);
  assertInsideRoot(realpathSync(cwd));
  const suffix = parts.slice(firstMagic).join("/") + (pattern.endsWith("/**") ? "/*" : "");
  const files: string[] = [];
  for (const file of new Bun.Glob(suffix).scanSync({ cwd, onlyFiles: true, followSymlinks: false })) {
    files.push(existingFile(relative(root, resolve(cwd, file))));
    expect(files.length, pattern).toBeLessThanOrEqual(4096);
  }
  expect(files.length, pattern).toBeGreaterThan(0);
  return files.sort();
}

test("product entrypoints remain present", () => {
  for (const path of ["apps/chess/src/index.tsx", "apps/starchess/src/main.tsx",
    "packages/starchess-core/src/index.ts", "packages/starchess-arena/src/index.ts"]) existingFile(path);
});

test("workspace discovers product and ML packages with internal workspace links", () => {
  const patterns = [...read("pnpm-workspace.yaml").matchAll(/^  - '([^']+)'$/gm)].map(match => match[1]!);
  expect(patterns).toEqual(["apps/*", "packages/*", "packages/ui/*"]);
  const manifests = patterns.flatMap(pattern => coveredFiles(`${pattern}/package.json`))
    .map(path => load<Manifest>(relative(root, path)));
  expect(manifests.length).toBeLessThanOrEqual(64);
  const names = manifests.map(manifest => manifest.name);
  expect(new Set(names).size).toBe(names.length);
  for (const name of ["chess-coach-ui", "@chess-coach/starchess", "@chess-coach/starchess-core", "@chess-coach/starchess-arena",
    "@chess-coach/contracts", "@chess-coach/policy", "@chess-coach/runtime"]) expect(names).toContain(name);
  expect(names).not.toContain("@chess-coach/game-core");
  expect(existsSync(rooted("packages/game-core/package.json"))).toBe(false);
  for (const manifest of manifests) {
    for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const) {
      expect(manifest[section]?.["@chess-coach/game-core"], `${manifest.name}:${section}`).toBeUndefined();
      for (const [name, version] of Object.entries(manifest[section] ?? {})) {
        if (version.startsWith("workspace:")) expect(names, `${manifest.name}:${name}`).toContain(name);
      }
    }
  }
  const { importers } = Bun.YAML.parse(read("pnpm-lock.yaml")) as { importers: Record<string, Record<string, Record<string, unknown>>> };
  expect(importers).not.toHaveProperty("packages/game-core");
  for (const importer of Object.values(importers)) {
    for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
      expect(importer[section] ?? {}).not.toHaveProperty("@chess-coach/game-core");
    }
  }
});

test("product and ML commands coexist with pinned TypeScript and Bun types", () => {
  const manifest = load<Manifest>("package.json");
  for (const command of ["dev", "build:starchess", "test:starchess", "ci", "e2e", "ml:test", "ml:typecheck"]) {
    expect(manifest.scripts).toHaveProperty(command);
  }
  expect(manifest.devDependencies?.typescript).toBe("5.9.3");
  expect(manifest.devDependencies?.["@types/bun"]).toBe("1.4.0");
  expect(manifest.scripts["ml:test"]).toBe("bun test packages/starchess-core/tests/native packages/contracts/tests packages/policy/tests packages/runtime/tests");
  const core = load<Manifest>("packages/starchess-core/package.json");
  expect(core.scripts.test).toBe("vitest run");
  expect(core.scripts["test:native"]).toBe("bun --no-env-file --no-install test ./tests/native");
  expect(load<Manifest>("apps/chess/package.json").scripts).toHaveProperty("dev:web-no-llm:vite");
  expect(load<Manifest>("apps/starchess/package.json").scripts).toHaveProperty("dev");
});

test("ML typecheck does not replace application configs", () => {
  const config = load<{ include: string[] }>("tsconfig.json");
  expect(new Set(config.include)).toEqual(new Set(["packages/contracts/src", "packages/starchess-core/src/engine", "packages/policy/src",
    "packages/runtime/src", "tooling/**/*.ts"]));
  expect(new Set(load<{ include: string[] }>("tsconfig.tests.json").include)).toEqual(new Set([
    "packages/contracts/src", "packages/contracts/tests", "packages/starchess-core/src/engine", "packages/starchess-core/tests/native",
    "packages/policy/src", "packages/policy/tests", "packages/runtime/src", "packages/runtime/tests",
  ]));
  for (const path of ["tsconfig.tests.json", "apps/chess/tsconfig.json", "apps/starchess/tsconfig.json"]) existingFile(path);
});

test("Cargo members and Burn pin remain present without executing Rust", () => {
  const cargo = Bun.TOML.parse(read("Cargo.toml")) as {
    workspace: { members: string[]; dependencies: { burn: { version: string } } };
  };
  expect(new Set(cargo.workspace.members)).toEqual(new Set(["crates/learning", "crates/policy-io", "crates/host-facts", "crates/gpu-owner"]));
  for (const member of cargo.workspace.members) existingFile(`${member}/Cargo.toml`);
  expect(cargo.workspace.dependencies.burn.version).toBe("=0.22.0");
});

test("shared feature dimensions match Rust bindings", () => {
  const layout = load<{ dimension: number; stateDimension: number; actionDimension: number; actionSlots: number; actionSlotDimension: number }>("schemas/feature-layout.json");
  expect(layout.dimension).toBe(layout.stateDimension + layout.actionDimension);
  expect(layout.actionDimension).toBe(layout.actionSlots * layout.actionSlotDimension);
  const rust = read("crates/learning/src/batch.rs");
  for (const [name, expected] of [["FEATURES", layout.dimension], ["STATE_FEATURES", layout.stateDimension]] as const) {
    const found = new RegExp(`pub const ${name}: usize = (\\d+);`).exec(rust);
    expect(found, name).not.toBeNull();
    expect(Number(found![1]), name).toBe(expected);
  }
});

test("consolidation does not enable GPU training", () => {
  expect(read("packages/runtime/src/gpu-job.ts")).toContain(
    'export async function gpuJobMain(): Promise<never> { throw new Error("GPU job: SOURCE_ONLY_DISABLED"); }',
  );
});

test("architecture coverage matches spec headers and existing ROOT-scoped files or nonempty globs", () => {
  const spec = "_spec/ml-runtime-architecture.puml";
  const entries = load<{ specs: { spec: string; covers: string[] }[] }>("_spec/.spec-index.json").specs.filter(entry => entry.spec === spec);
  expect(entries).toHaveLength(1);
  const covers = entries[0]!.covers;
  const headers = [...read(spec).matchAll(/^' covers: (.+)$/gm)].map(match => match[1]!);
  expect(headers).toEqual(covers);
  expect(covers).toContain("tooling/tests/workspace-integration.test.ts");
  for (const pattern of covers) coveredFiles(pattern);
});
