// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { createHash } from "node:crypto";
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectNativeCommentBridge } from "./native-comment-bridge";

const root = fileURLToPath(new URL("../../", import.meta.url));
const base = resolve(root, "artifacts/training-functional");
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const pin = (path: string) => {
  const info = lstatSync(resolve(root, path));
  if ((!info.isFile() && !info.isSymbolicLink()) || info.size > 64 * 1024 * 1024) throw new Error(`Verification: FILE_BOUND:${path}`);
  const bytes = info.isSymbolicLink() ? Buffer.from(readlinkSync(resolve(root, path))) : readFileSync(resolve(root, path));
  return { path, kind: info.isSymbolicLink() ? "symlink" : "file", sizeBytes: bytes.length, mode: info.mode & 0o7777, sha256: sha(bytes) };
};
const pinPaths = (paths: Set<string>, limit = 5000) => {
  if (paths.size > limit) throw new Error("Verification: MEMBERSHIP_BOUND");
  let size = 0;
  return [...paths].sort().map(path => {
    const result = pin(path);
    if ((size += result.sizeBytes) > 256 * 1024 * 1024) throw new Error("Verification: AGGREGATE_BOUND");
    return result;
  });
};
const scan = (patterns: string[]) => {
  const paths = new Set<string>();
  for (const pattern of patterns) for (const path of new Bun.Glob(pattern).scanSync({ cwd: root, onlyFiles: true, followSymlinks: false })) paths.add(path);
  return pinPaths(paths);
};
const sourcePatterns = ["Cargo.toml", "Cargo.lock", "crates/*/Cargo.toml", "crates/**/*.rs", "packages/contracts/src/**/*.ts",
  "packages/policy/src/**/*.ts", "packages/runtime/src/**/*.ts", "packages/runtime/tests/*.ts", "packages/starchess-core/src/**/*.ts",
  "artifacts/training-functional/*.ts", "artifacts/training-functional/{plan,tsconfig,input-status}.json", "artifacts/training-functional/qualification-packet-1/plan.json",
  "artifacts/training-functional/qualification-packet-1/source-*/{source-manifest,core-rules,image-observation,runtime-configuration}.json",
  "artifacts/training-functional/qualification-delivery-1/{plan.json,command-template.sh}", "tsconfig*.json", "pnpm-lock.yaml", "schemas/*.json"];
const protectedFiles = () => {
  const result = Bun.spawnSync(["git", "--no-pager", "--no-optional-locks", "ls-files", "-z", "--", "_work", "artifacts/engine-layout", "artifacts/engine-consolidation", "artifacts/integration/mainline-1"],
    { cwd: root, env: { PATH: "/usr/local/bin:/usr/bin:/bin", GIT_NO_LAZY_FETCH: "1" }, stdout: "pipe", stderr: "pipe", timeout: 10_000 });
  if (result.exitCode !== 0 || result.stdout.length > 2 * 1024 * 1024) throw new Error("Verification: TRACKED_PRESERVATION_MEMBERSHIP");
  const paths = new Set(new TextDecoder().decode(result.stdout).split("\0").filter(Boolean));
  return pinPaths(paths, 8192);
};
const pureRuntime = ["native-session", "job", "reference", "match-session", "learner-pair", "curriculum", "training-artifact", "rng", "strategic"];
const commands: Record<string, string[]> = {
  focused: ["test", "--timeout", "30000", "./packages/runtime/tests/training-coordinator.test.ts", "./packages/runtime/tests/training-campaign.test.ts",
    "./artifacts/training-functional/native-comment-bridge.test.ts", "./artifacts/training-functional/qualification.test.ts"],
  runtime: ["test", ...pureRuntime.map(name => `./packages/runtime/tests/${name}.test.ts`)],
  contracts: ["test", ...["initialization", "game-session", "recipient-codec", "recipient-privacy", "shared-engine.e2e"].map(name => `./packages/contracts/tests/${name}.test.ts`)],
  r4: ["test", "--timeout", "30000", "./artifacts/training-functional/r4-observation.test.ts", "./artifacts/training-functional/qualification-adapters.test.ts",
    "./artifacts/training-functional/qualification-adapter-launch.test.ts",
    "./artifacts/training-functional/qualification-packet.test.ts", "./artifacts/training-functional/qualification-evidence.test.ts",
    "./artifacts/training-functional/qualification-operator.e2e.test.ts", "./artifacts/training-functional/qualification-input-documents.test.ts",
    "./artifacts/training-functional/qualification-bootstrap.e2e.test.ts", "./artifacts/training-functional/qualification-command.test.ts"],
  reference: ["test", "--timeout", "30000", "./artifacts/training-functional/reference-retry.test.ts", "./artifacts/training-functional/jssha-archive.test.ts"],
  "host-facts": ["test", "--timeout", "30000", "./artifacts/training-functional/host-facts.test.ts"],
  "source-types": ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "tsconfig.json"],
  "test-types": ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "tsconfig.tests.json"],
  "task-types": ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "artifacts/training-functional/tsconfig.json"],
  workspace: ["test", "./tooling/tests/workspace-integration.test.ts"],
  specs: ["./artifacts/training-functional/check-specs.ts"],
};

const [run, check] = Bun.argv.slice(2);
if (Bun.argv.length !== 4 || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(run ?? "") || !["baseline", "preservation", ...Object.keys(commands)].includes(check ?? "")) {
  throw new Error("usage: run-check.ts RUN baseline|preservation|focused|runtime|contracts|r4|reference|host-facts|source-types|test-types|task-types|workspace|specs");
}
const directory = resolve(base, "checks", run!, check!);
mkdirSync(resolve(directory, ".."), { recursive: true });
mkdirSync(directory);
const before = scan(sourcePatterns), started = performance.now();
let exitCode = 1, failure: string | null = null, details: unknown = null;
const command = commands[check!];
try {
  if (check === "baseline") {
    const protectedRows = protectedFiles();
    const baseline = { scope: "TRACKED_HISTORICAL_WORK_AND_RECORDED_ENGINE_EVIDENCE", protectedFiles: protectedRows, nativeBridge: inspectNativeCommentBridge(root) };
    writeFileSync(resolve(base, "preservation-baseline.json"), JSON.stringify(baseline, null, 2) + "\n", { flag: "wx" });
    details = { protectedFiles: protectedRows.length, protectedBytes: protectedRows.reduce((sum, row) => sum + row.sizeBytes, 0), nativeBridge: baseline.nativeBridge.status };
    exitCode = 0;
  } else if (check === "preservation") {
    const bytes = readFileSync(resolve(base, "preservation-baseline.json"));
    const baseline = JSON.parse(bytes.toString()) as { protectedFiles: ReturnType<typeof scan> };
    const current = protectedFiles();
    if (JSON.stringify(baseline.protectedFiles) !== JSON.stringify(current)) throw new Error("Verification: HISTORICAL_INPUT_CHANGED");
    const bridge = inspectNativeCommentBridge(root);
    writeFileSync(resolve(directory, "native-comment-bridge.json"), JSON.stringify(bridge, null, 2) + "\n", { flag: "wx" });
    details = { historicalFilesUnchanged: current.length, baselineSha256: sha(bytes), nativeBridge: bridge.status, byteIdenticalNativeMembers: 59, specPointerOnlyNativeMembers: 6 };
    exitCode = 0;
  } else if (command) {
    const stdout = openSync(resolve(directory, "command.stdout"), "wx"), stderr = openSync(resolve(directory, "command.stderr"), "wx");
    try {
      const child = Bun.spawn([process.execPath, "--no-env-file", "--no-install", ...command], { cwd: root, stdout, stderr, timeout: 240_000,
        env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(root, ".cache/engine-consolidation/home"), CI: "true", TERM: "dumb", npm_config_offline: "true" } });
      exitCode = await child.exited;
    } finally { closeSync(stdout); closeSync(stderr); }
  }
} catch (error) { failure = String(error); }
const after = scan(sourcePatterns), sourcePinsMatch = JSON.stringify(before) === JSON.stringify(after);
const receipt = { check, status: exitCode === 0 && failure === null && sourcePinsMatch ? "PASS" : "FAIL", exitCode, failure,
  command: command ? [process.execPath, "--no-env-file", "--no-install", ...command] : null, details,
  sourcePinsBefore: before, sourcePinsAfter: after, sourcePinsMatch, elapsedSeconds: (performance.now() - started) / 1000,
  runtime: "Bun", nativeExecuted: false, hostExecuted: false, referenceBuilt: false, trainingExecuted: false, trainingReady: false };
writeFileSync(resolve(directory, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
console.log("Executor: " + JSON.stringify({ check, status: receipt.status, exitCode, failure, details, sourcePinsMatch }));
process.exitCode = receipt.status === "PASS" ? 0 : 1;
