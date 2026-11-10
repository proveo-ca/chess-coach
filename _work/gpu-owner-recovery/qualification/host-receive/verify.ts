// SPEC: _spec/gpu-input-transfer.puml
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { repository, work } from "../../provision";
import { runBounded, sourceFilePaths } from "../../verify";
import { sourceInventory } from "../../../../tooling/runtime/qualification";
import { renderHostReceive } from "./bootstrap";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const [label] = Bun.argv.slice(2);
if (Bun.argv.length !== 3 || !/^host-input-receive-source-[1-9][0-9]*$/.test(label ?? "") || resolve(process.cwd()) !== resolve(repository)) throw Error("HOST_RECEIVE_SOURCE_CONTEXT_REQUIRED");
const directory = resolve(work, "runs", label!);
await mkdir(directory); await mkdir(resolve(directory, "home")); await mkdir(resolve(directory, "tmp"));
const native = await sourceInventory(repository);
const paths = new Set([...(await sourceFilePaths("typecheck-source")), ...native.map(source => source.path), "_work/gpu-owner-recovery/provision.ts",
  "_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/context-manifest.json", "_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/preparation.json",
  "_work/gpu-owner-recovery/runs/host-feasibility-publication-3/outcome-check.json", "_work/gpu-owner-recovery/runs/gpu-input-transfer-source-6/receipt.json",
  "tooling/runtime/Dockerfile", "tooling/runtime/Dockerfile.gpu", "_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/sources.json",
  "_work/gpu-owner-recovery/runs/gpu-qualification-llvm-flags-1/receipt.json", "_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/registry-manifest.json",
  "_work/gpu-owner-recovery/runs/gpu-qualification-input-inventory-1/command.stdout"]);
for (const pattern of ["_work/gpu-owner-recovery/qualification/**/*.{ts,json,fish}", "_work/gpu-owner-recovery/prepared-llvm*/**/*.{ts,json}"]) {
  for await (const path of new Bun.Glob(pattern).scan({ cwd: repository, onlyFiles: true })) paths.add(path);
}
const sources = await Promise.all([...paths].sort().map(async path => ({ path, sha256: hash(await readFile(resolve(repository, path))) })));
await writeFile(resolve(directory, "sources.json"), JSON.stringify(sources, null, 2) + "\n", { flag: "wx" });
const helper = await readFile(resolve(work, "qualification/host-receive/receive.ts"));
if (helper.length > 131072) throw Error("BOUNDED_STANDALONE_HELPER_REQUIRED");
const helperSha256 = hash(helper);
await writeFile(resolve(directory, "host-command.template.fish"), renderHostReceive("0".repeat(40), helperSha256) + "\n", { flag: "wx" });
const commands = [
  { name: "receive-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/qualification/host-receive/receive.test.ts", "./_work/gpu-owner-recovery/qualification/host-receive/bootstrap.test.ts"] },
  { name: "transfer-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/qualification/transfer/archive.test.ts", "./_work/gpu-owner-recovery/qualification/transfer/prepare.test.ts", "./_work/gpu-owner-recovery/qualification/transfer/publish.test.ts"] },
  { name: "qualification-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./packages/runtime/tests/gpu-recipe.test.ts", "./packages/runtime/tests/gpu-qualification.test.ts", "./_work/gpu-owner-recovery/prepared-llvm/verify.test.ts"] },
  ...["tsconfig.json", "tsconfig.tests.json", "_work/gpu-owner-recovery/qualification/tsconfig.json", "_work/gpu-owner-recovery/qualification/transfer/tsconfig.json", "_work/gpu-owner-recovery/qualification/host-receive/tsconfig.json"].map((project, index) => ({ name: "types-" + index,
    argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", project] })),
];
const results = [];
let failure: string | null = null, sourceChanged = false;
try {
  for (const command of commands) {
    const step = resolve(directory, command.name); await mkdir(step);
    const result = await runBounded(command.argv, step, 120000, { cwd: repository, environment: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(directory, "home"), TMPDIR: resolve(directory, "tmp"), NO_COLOR: "1", MISE_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false" } });
    const streams = await Promise.all(["stdout", "stderr"].map(async stream => { const path = resolve(step, "command." + stream), bytes = await readFile(path); return { path: relative(repository, path), bytes: bytes.length, sha256: hash(bytes) }; }));
    results.push({ ...command, ...result, streams });
    if (result.status !== "PASS") break;
  }
  sourceChanged = (await Promise.all(sources.map(async source => hash(await readFile(resolve(repository, source.path))) !== source.sha256))).some(Boolean);
  sourceChanged ||= JSON.stringify(await sourceInventory(repository)) !== JSON.stringify(native);
} catch (error) { failure = String(error); sourceChanged = true; }
const status = !failure && !sourceChanged && results.length === commands.length && results.every(result => result.status === "PASS") ? "PASS_HOST_RECEIVE_SOURCE_ONLY" : "FAIL_HOST_RECEIVE_SOURCE_ONLY";
await writeFile(resolve(directory, "receipt.json"), JSON.stringify({ version: "chess-coach.host-receive-source-proof.v1", status, failure, sourceChanged, sources, results,
  helper: { path: "_work/gpu-owner-recovery/qualification/host-receive/receive.ts", bytes: helper.length, sha256: helperSha256 },
  commandTemplate: { path: relative(repository, resolve(directory, "host-command.template.fish")), placeholderCommit: "0".repeat(40), operatorExecutionAuthorized: false },
  fishSyntax: "NOT_RUN_CODING_BINARY_ABSENT_AND_SHIM_UNCONFIGURED_HOST_SYNTAX_PRECHECK_EMBEDDED",
  sourcePublicationPerformed: false, assetDownloadsPerformed: false, archiveExtractionPerformed: false, hostExecuted: false, compilationPerformed: false, gpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status, helperSha256, receipt: relative(repository, resolve(directory, "receipt.json")) }));
process.exitCode = status === "PASS_HOST_RECEIVE_SOURCE_ONLY" ? 0 : 1;
