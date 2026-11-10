// SPEC: _spec/gpu-host-receive.puml
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { repository, work } from "../../provision";
import { runBounded } from "../../verify";
import { renderHostToolchainAlignment } from "../../qualification/host-toolchain/render";

const directory = resolve(work, "runs/host-toolchain-align-source-1");
if (Bun.argv.length !== 2 || resolve(process.cwd()) !== resolve(repository)) throw Error("ALIGNMENT_SOURCE_CONTEXT_REQUIRED");
await mkdir(resolve(directory, "home")); await mkdir(resolve(directory, "tmp"));
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const paths = ["mise.toml", "package.json", "tsconfig.json", "_work/gpu-owner-recovery/qualification/runtime-request.json", "_work/gpu-owner-recovery/qualification/host-receive/bootstrap.ts",
  "_work/gpu-owner-recovery/qualification/host-receive/receive.ts", "_work/gpu-owner-recovery/qualification/host-receive/receive.test.ts", "_work/gpu-owner-recovery/qualification/host-receive/bootstrap.test.ts", "_work/gpu-owner-recovery/qualification/host-receive/plan.json",
  "_work/gpu-owner-recovery/runs/host-feasibility-publication-3/outcome-check.json", "_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/context-manifest.json", "_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/preparation.json",
  "_work/gpu-owner-recovery/runs/host-input-receive-observation-1/operator-paste.txt", "_work/gpu-owner-recovery/runs/host-input-receive-observation-1/observation.json", "_work/gpu-owner-recovery/runs/host-input-receive-observation-1/verify-report.ts",
  "_work/gpu-owner-recovery/provision.ts", "_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/command-supervisor.ts", relative(repository, resolve(directory, "verify.ts"))];
for await (const path of new Bun.Glob("_work/gpu-owner-recovery/qualification/host-toolchain/*.{ts,json}").scan({ cwd: repository, onlyFiles: true })) paths.push(path);
const sources = await Promise.all([...new Set(paths)].sort().map(async path => ({ path, sha256: hash(await readFile(resolve(repository, path))) })));
await writeFile(resolve(directory, "sources.json"), JSON.stringify(sources, null, 2) + "\n", { flag: "wx" });
const command = renderHostToolchainAlignment() + "\n";
await writeFile(resolve(directory, "host-command.fish"), command, { flag: "wx" });
const commands = [
  { name: "alignment-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/qualification/host-toolchain/render.test.ts"] },
  { name: "receive-regression", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/qualification/host-receive/receive.test.ts", "./_work/gpu-owner-recovery/qualification/host-receive/bootstrap.test.ts"] },
  { name: "types", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", "_work/gpu-owner-recovery/qualification/host-toolchain/tsconfig.json"] },
  { name: "reported-failure-records", argv: [process.execPath, "--no-env-file", "--no-install", "_work/gpu-owner-recovery/runs/host-input-receive-observation-1/verify-report.ts", "record-check-2.json"] },
];
const results = [];
for (const item of commands) {
  const step = resolve(directory, item.name); await mkdir(step);
  const output = await runBounded(item.argv, step, 120000, { cwd: repository, environment: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(directory, "home"), TMPDIR: resolve(directory, "tmp"), NO_COLOR: "1", MISE_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false" } });
  const streams = await Promise.all(["stdout", "stderr"].map(async stream => { const path = resolve(step, "command." + stream), bytes = await readFile(path); return { path: relative(repository, path), bytes: bytes.length, sha256: hash(bytes) }; }));
  results.push({ ...item, ...output, streams }); if (output.status !== "PASS") break;
}
const sourceChanged = (await Promise.all(sources.map(async source => hash(await readFile(resolve(repository, source.path))) !== source.sha256))).some(Boolean);
const status = !sourceChanged && results.length === commands.length && results.every(result => result.status === "PASS") ? "PASS_HOST_TOOLCHAIN_ALIGNMENT_SOURCE_ONLY" : "FAIL_HOST_TOOLCHAIN_ALIGNMENT_SOURCE_ONLY";
await writeFile(resolve(directory, "receipt.json"), JSON.stringify({ version: "chess-coach.host-toolchain-alignment-source-proof.v1", status, sourceChanged, sources, results,
  command: { path: relative(repository, resolve(directory, "host-command.fish")), sha256: hash(Buffer.from(command)), operatorExecutionApproved: false },
  fishSyntax: "NOT_RUN_LOCALLY_HOST_PRECHECK_EMBEDDED", hostInstallationOrVersionQueryPerformed: false, receiverRetried: false, sourcePublicationPerformed: false,
  nativeRustOrLlvmExecuted: false, compilationPerformed: false, gpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status, commandSha256: hash(Buffer.from(command)), receipt: relative(repository, resolve(directory, "receipt.json")) }));
process.exitCode = status === "PASS_HOST_TOOLCHAIN_ALIGNMENT_SOURCE_ONLY" ? 0 : 1;
