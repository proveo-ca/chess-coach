// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const label = Bun.argv[2];
if (Bun.argv.length !== 3 || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(label ?? "")) throw new Error("Reference source check: LABEL");
const output = resolve(root, "artifacts/training-functional/reference-prep-1", label!);
mkdirSync(output);
const pins = () => ["artifacts/training-functional/reference-prep.ts", "artifacts/training-functional/reference-prep.test.ts",
  "artifacts/training-functional/reference-prep-1/plan.json", "artifacts/training-functional/reference-prep-1/tsconfig.json",
  "artifacts/training-functional/tsconfig.json",
  "artifacts/training-functional/reference-prep-1/verify-source.ts", "tooling/build-reference.ts", "tooling/reference-entrypoints.json"].map(path => {
  const bytes = readFileSync(resolve(root, path));
  if (bytes.length > 1024 * 1024) throw new Error("Reference source check: INPUT_BOUND");
  return { path, byteLength: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
});
const before = pins(), results = [];
for (const [name, args] of [["tests", ["test", "--timeout", "30000", "./artifacts/training-functional/reference-prep.test.ts"]],
  ["types", ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "artifacts/training-functional/reference-prep-1/tsconfig.json"]]] as const) {
  const command = [process.execPath, "--no-env-file", "--no-install", ...args];
  const stdout = openSync(resolve(output, `${name}.stdout`), "wx"), stderr = openSync(resolve(output, `${name}.stderr`), "wx");
  let exitCode = -1;
  try {
    const child = Bun.spawn(command, { cwd: root, stdout, stderr, timeout: 120_000,
      env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(root, ".cache/engine-consolidation/home"), CI: "true", TERM: "dumb", npm_config_offline: "true" } });
    exitCode = await child.exited;
  } finally { closeSync(stdout); closeSync(stderr); }
  results.push({ name, command, exitCode });
}
const after = pins(), sourcePinsMatch = JSON.stringify(before) === JSON.stringify(after);
const result = { status: results.every(row => row.exitCode === 0) && sourcePinsMatch ? "PASS_SOURCE_ONLY" : "FAIL_SOURCE_ONLY",
  results, sourcePinsBefore: before, sourcePinsAfter: after, sourcePinsMatch, networkOperations: 0, referenceBuilds: 0,
  nativeExecuted: false, hostExecuted: false, gpuExecuted: false, trainingExecuted: false, trainingReady: false };
writeFileSync(resolve(output, "receipt.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log("Executor: " + JSON.stringify({ receipt: resolve(output, "receipt.json"), status: result.status, results: results.map(({ name, exitCode }) => ({ name, exitCode })), sourcePinsMatch }));
process.exitCode = result.status === "PASS_SOURCE_ONLY" ? 0 : 1;
