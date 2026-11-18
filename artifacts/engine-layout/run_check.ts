// SPEC: _spec/engine-consolidation.puml
import { createHash } from "node:crypto";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const bun = "/usr/local/bin/bun";
const contracts = ["observation", "inference", "initialization", "causal-journal", "recipient-codec", "recipient-privacy", "game-session", "native-intents", "native-protocol", "gpu-job", "shared-engine.e2e"];
const policy = ["features", "candidates", "enumeration-golden", "initialization.e2e", "queue-planning.e2e", "source-boundary"];
const run = (...args: string[]) => [bun, "--no-env-file", "--no-install", ...args];
const tsc = (project: string) => run("node_modules/typescript/bin/tsc", "-p", project, "--noEmit");
const vitest = run("node_modules/vitest/vitest.mjs", "run", "--maxWorkers=2", "--no-file-parallelism");
const checks: Record<string, { cwd: string; command: string[] }> = {
  core: { cwd: "packages/starchess-core", command: vitest },
  arena: { cwd: "packages/starchess-arena", command: vitest },
  app: { cwd: "apps/starchess", command: vitest },
  native: { cwd: "packages/starchess-core", command: run("run", "test:native") },
  ml: { cwd: ".", command: run("test", "./packages/starchess-core/tests/native",
    ...contracts.map(name => `./packages/contracts/tests/${name}.test.ts`),
    ...policy.map(name => `./packages/policy/tests/${name}.test.ts`),
    ...["rng", "strategic", "closure"].map(name => `./packages/runtime/tests/${name}.test.ts`)) },
  "ml-source-types": { cwd: ".", command: tsc("tsconfig.json") },
  "ml-test-types": { cwd: ".", command: tsc("tsconfig.tests.json") },
  "core-types": { cwd: "packages/starchess-core", command: tsc("tsconfig.json") },
  "core-test-types": { cwd: "packages/starchess-core", command: tsc("tsconfig.integration-tests.json") },
  "arena-types": { cwd: "packages/starchess-arena", command: tsc("tsconfig.json") },
  "server-types": { cwd: "apps/server", command: tsc("tsconfig.json") },
  "app-types": { cwd: ".", command: run("node_modules/typescript/bin/tsc", "-b", "apps/starchess/tsconfig.json", "--noEmit") },
  "app-boundaries": { cwd: "apps/starchess", command: run("node_modules/dependency-cruiser/bin/dependency-cruiser.mjs", "src", "--config", ".dependency-cruiser.cjs", "--output-type", "err") },
  workspace: { cwd: ".", command: run("test", "./tooling/tests/workspace-integration.test.ts") },
};
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
type Pin = { path: string; relative?: string; mode: number; sha256: string; sizeBytes: number };
const pin = (path: string): Pin => {
  const absolute = resolve(root, path), info = lstatSync(absolute);
  if (!info.isFile() || info.nlink !== 1 || info.size > 64 * 1024 * 1024) throw new Error(`source bound ${path}`);
  const bytes = readFileSync(absolute);
  return { path, mode: info.mode & 0o7777, sha256: digest(bytes), sizeBytes: bytes.length };
};

function reverseImports(source: string): string {
  const file = ts.createSourceFile("relocated.ts", source, ts.ScriptTarget.Latest, true);
  const edits: { start: number; end: number; value: string }[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const original = node.moduleSpecifier.text;
      const value = original === "@chess-coach/starchess-core/engine" ? "../src"
        : original === "@chess-coach/starchess-core/causal-producer" ? "../src/causal-producer"
        : original === "@chess-coach/starchess-core/causal-types" ? "../src/causal-types"
        : original.startsWith("@chess-coach/starchess-core/engine/") ? "../src/" + original.slice("@chess-coach/starchess-core/engine/".length)
        : original === "../../../contracts/src/causal-journal" ? "../../contracts/src/causal-journal" : original;
      if (value !== original) edits.push({ start: node.moduleSpecifier.getStart(file) + 1, end: node.moduleSpecifier.getEnd() - 1, value });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
  return source;
}

function preservation() {
  const baseline = JSON.parse(readFileSync(resolve(root, "artifacts/engine-layout/baseline-1.json"), "utf8")) as {
    oldTestRoot: string; newTestRoot: string; testTree: Pin[]; fixtures: Pin[]; legacyForwarders: Pin[]; canonicalSource: Pin[]; historicalArtifacts: Pin[];
  };
  const compare = (expected: Pin, path = expected.path): void => {
    const actual = pin(path);
    if (actual.mode !== expected.mode || actual.sha256 !== expected.sha256 || actual.sizeBytes !== expected.sizeBytes) throw new Error(`preservation mismatch ${path}`);
  };
  for (const item of [...baseline.canonicalSource, ...baseline.historicalArtifacts]) compare(item);
  const actualCanonical = [...new Bun.Glob("**/*").scanSync({ cwd: resolve(root, "packages/starchess-core/src"), onlyFiles: true, followSymlinks: false })].sort();
  const expectedCanonical = baseline.canonicalSource.map(item => item.relative!).sort();
  if (JSON.stringify(actualCanonical) !== JSON.stringify(expectedCanonical)) throw new Error("canonical source membership drift");
  const expectedTests: string[] = [];
  let importsOnly = 0;
  for (const item of baseline.testTree) {
    const renamed = item.relative === "compatibility-exports.test.ts" ? "canonical-exports.test.ts" : item.relative!;
    const path = `${baseline.newTestRoot}/${renamed}`;
    expectedTests.push(renamed);
    if (renamed.startsWith("fixtures/")) compare(item, path);
    else if (renamed !== "canonical-exports.test.ts") {
      const actual = pin(path);
      if (actual.mode !== item.mode || digest(reverseImports(readFileSync(resolve(root, path), "utf8"))) !== item.sha256) throw new Error(`non-import change in relocated test ${renamed}`);
      importsOnly++;
    }
  }
  const actualTests = [...new Bun.Glob("**/*").scanSync({ cwd: resolve(root, baseline.newTestRoot), onlyFiles: true, followSymlinks: false })].sort();
  if (JSON.stringify(actualTests) !== JSON.stringify(expectedTests.sort())) throw new Error("relocated corpus membership drift");
  for (const item of baseline.legacyForwarders) if (existsSync(resolve(root, item.path))) throw new Error(`forwarder retained ${item.path}`);
  if (existsSync(resolve(root, "packages/game-core/package.json")) || existsSync(resolve(root, baseline.oldTestRoot))) throw new Error("retired workspace retained");
  const lock = Bun.YAML.parse(readFileSync(resolve(root, "pnpm-lock.yaml"), "utf8")) as { importers: Record<string, unknown> };
  if (Object.hasOwn(lock.importers, "packages/game-core")) throw new Error("retired lock importer retained");
  return { movedFiles: actualTests.length, byteIdenticalFixtures: baseline.fixtures.length, importOnlyTypeScriptFiles: importsOnly,
    canonicalFilesUnchanged: baseline.canonicalSource.length, recordedHistoricalFilesUnchanged: baseline.historicalArtifacts.length, retiredForwarders: baseline.legacyForwarders.length };
}

function snapshot() {
  const paths = new Set(["package.json", "pnpm-lock.yaml", "artifacts/engine-layout/run_check.ts", "tooling/tests/workspace-integration.test.ts"]);
  for (const pattern of ["packages/*/package.json", "packages/starchess-core/src/**/*.ts", "packages/starchess-core/tests/native/**/*.ts", "packages/starchess-core/tests/native/**/*.json", "packages/contracts/src/**/*.ts", "packages/policy/src/**/*.ts", "packages/runtime/src/**/*.ts", "packages/*/tests/*.ts", "schemas/*.json", "tsconfig*.json", "packages/starchess-core/tsconfig*.json"]) {
    for (const file of new Bun.Glob(pattern).scanSync({ cwd: root, onlyFiles: true, followSymlinks: false })) paths.add(file);
  }
  if (paths.size > 2500) throw new Error("source membership bound");
  return [...paths].sort().map(pin);
}

const [runName, check] = Bun.argv.slice(2);
if (Bun.argv.length !== 4 || !runName || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(runName) || !check || (check !== "layout" && !Object.hasOwn(checks, check))) throw new Error("usage: run_check.ts RUN CHECK");
const output = resolve(root, "artifacts/engine-layout/checks", runName, check);
mkdirSync(resolve(output, ".."), { recursive: true });
mkdirSync(output);
const before = snapshot(), started = performance.now();
let exitCode: number | null = null, error: string | null = null, layout: ReturnType<typeof preservation> | null = null;
if (check === "layout") {
  try { layout = preservation(); exitCode = 0; } catch (caught) { error = caught instanceof Error ? caught.message : String(caught); exitCode = 1; }
} else {
  const selected = checks[check]!;
  const stdout = openSync(resolve(output, "command.stdout"), "wx"), stderr = openSync(resolve(output, "command.stderr"), "wx");
  try {
    const child = Bun.spawn(selected.command, { cwd: resolve(root, selected.cwd), stdout, stderr, timeout: 240_000,
      env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(root, ".cache/engine-consolidation/home"), CI: "true", TERM: "dumb", npm_config_offline: "true" } });
    exitCode = await child.exited;
  } catch (caught) { error = caught instanceof Error ? caught.message : String(caught); }
  finally { closeSync(stdout); closeSync(stderr); }
}
const after = snapshot(), sourcePinsMatch = JSON.stringify(before) === JSON.stringify(after);
const result = { check, command: checks[check]?.command ?? [bun, "run_check.ts", runName, "layout"], cwd: checks[check]?.cwd ?? ".", exitCode, error, layout,
  elapsedSeconds: (performance.now() - started) / 1000, sourcePinsBefore: before, sourcePinsAfter: after, sourcePinsMatch,
  status: exitCode === 0 && sourcePinsMatch ? "PASS" : "FAIL", runtime: "Bun", rustExecuted: false, trainingPerformed: false };
writeFileSync(resolve(output, "receipt.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log("Executor: " + JSON.stringify({ check, status: result.status, exitCode, error, layout, elapsedSeconds: result.elapsedSeconds, sourcePinsMatch }));
process.exitCode = result.status === "PASS" ? 0 : 1;
