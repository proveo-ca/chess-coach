// SPEC: _spec/engine-consolidation.puml
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  ml: { cwd: ".", command: run("test", "./packages/game-core/tests",
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

function snapshot() {
  const paths = new Set(["package.json", "pnpm-lock.yaml", "artifacts/engine-consolidation/run_check.ts", "tooling/tests/workspace-integration.test.ts"]);
  for (const pattern of ["packages/*/package.json", "packages/game-core/src/**/*.ts", "packages/starchess-core/src/**/*.ts", "packages/contracts/src/**/*.ts", "packages/policy/src/**/*.ts", "packages/runtime/src/**/*.ts", "packages/*/tests/*.ts", "schemas/*.json", "tsconfig*.json", "packages/starchess-core/tsconfig*.json"]) {
    for (const file of new Bun.Glob(pattern).scanSync({ cwd: root, onlyFiles: true })) paths.add(file);
  }
  if (paths.size > 2500) throw new Error("source membership bound");
  return [...paths].sort().map(path => {
    const absolute = resolve(root, path);
    if (statSync(absolute).size > 2 * 1024 * 1024) throw new Error("source size bound");
    const bytes = readFileSync(absolute);
    return { path, sha256: createHash("sha256").update(bytes).digest("hex"), sizeBytes: bytes.length };
  });
}

const [runName, check] = Bun.argv.slice(2);
if (Bun.argv.length !== 4 || !runName || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(runName) || !check || !Object.hasOwn(checks, check)) {
  throw new Error("usage: run_check.ts RUN CHECK");
}
const output = resolve(root, "artifacts/engine-consolidation/checks", runName, check);
mkdirSync(resolve(output, ".."), { recursive: true });
mkdirSync(output);
const selected = checks[check]!;
const before = snapshot();
const stdout = openSync(resolve(output, "command.stdout"), "wx");
const stderr = openSync(resolve(output, "command.stderr"), "wx");
const started = performance.now();
let exitCode: number | null = null;
let error: string | null = null;
try {
  const child = Bun.spawn(selected.command, {
    cwd: resolve(root, selected.cwd), stdout, stderr, timeout: 240_000,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(root, ".cache/engine-consolidation/home"), CI: "true", TERM: "dumb", npm_config_offline: "true" },
  });
  exitCode = await child.exited;
} catch (caught) {
  error = caught instanceof Error ? caught.message : String(caught);
} finally {
  closeSync(stdout);
  closeSync(stderr);
}
const after = snapshot();
const sourcePinsMatch = JSON.stringify(before) === JSON.stringify(after);
const result = { check, command: selected.command, cwd: selected.cwd, exitCode, error,
  elapsedSeconds: (performance.now() - started) / 1000, sourcePinsBefore: before, sourcePinsAfter: after, sourcePinsMatch,
  status: exitCode === 0 && sourcePinsMatch ? "PASS" : "FAIL", runtime: "Bun", rustExecuted: false, trainingPerformed: false };
writeFileSync(resolve(output, "receipt.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log("Executor: " + JSON.stringify({ check, status: result.status, exitCode, error, elapsedSeconds: result.elapsedSeconds, sourcePinsMatch }));
process.exitCode = result.status === "PASS" ? 0 : 1;
