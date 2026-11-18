// SPEC: _spec/gpu-feasibility.puml
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { repository, work } from "../../provision";
import { runBounded } from "../../verify";
import { sourceInventory } from "../../../../tooling/runtime/qualification";
import { buildObservation, buildReport, digest, requireValue } from "./plan";
import { renderFeasibilityPacket } from "./render";

const [label] = Bun.argv.slice(2);
requireValue(Bun.argv.length === 3 && /^host-gpu-feasibility-source-[1-9][0-9]*$/.test(label ?? "") && resolve(process.cwd()) === resolve(repository), "FEASIBILITY_SOURCE_CONTEXT_REQUIRED");
const directory = resolve(work, "runs", label!), sourceRoot = "_work/gpu-owner-recovery/qualification/host-feasibility/";
await mkdir(directory); for (const name of ["home", "tmp", "e2e"]) await mkdir(resolve(directory, name));
const baselinePath = "_work/gpu-owner-recovery/runs/host-gpu-cache-reuse-source-3/receipt.json", baseline = JSON.parse(await readFile(baselinePath, "utf8"));
requireValue(baseline.status === "PASS_CACHE_REUSE_SOURCE_ONLY" && baseline.sourceChanged === false && baseline.sources.length === 307, "FROZEN_ACCEPTED_BASELINE_REQUIRED");
const paths = new Set<string>([baselinePath, buildReport, buildObservation]);
for (const row of baseline.sources) {
  requireValue(digest(await readFile(row.path)) === row.sha256, "PROTECTED_SOURCE_CHANGED_BEFORE_VERIFICATION:" + row.path); paths.add(row.path);
}
for await (const path of new Bun.Glob(sourceRoot + "*.{ts,json}").scan({ cwd: repository, onlyFiles: true })) paths.add(path);
const sources = await Promise.all([...paths].sort().map(async path => ({ path, sha256: digest(await readFile(path)) })));
await writeFile(resolve(directory, "sources.json"), JSON.stringify(sources, null, 2) + "\n", { flag: "wx" });
const commands = [
  { name: "feasibility-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./" + sourceRoot] },
  { name: "qualification-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./packages/runtime/tests/gpu-policy-record.test.ts", "./packages/runtime/tests/gpu-recipe.test.ts", "./packages/runtime/tests/gpu-qualification.test.ts", "./_work/gpu-owner-recovery/prepared-llvm/verify.test.ts"] },
  ...["tsconfig.json", "tsconfig.tests.json", "_work/gpu-owner-recovery/qualification/tsconfig.json", sourceRoot + "tsconfig.json"].map((project, i) => ({ name: "types-" + i, argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", project] })),
];
const results = [], programs: { path: string; bytes: number; sha256: string }[] = [];
let failure: string | null = null, sourceChanged: boolean | null = null, packet: Awaited<ReturnType<typeof renderFeasibilityPacket>> | null = null;
let command: { path: string; bytes: number; sha256: string } | null = null;
try {
  packet = await renderFeasibilityPacket();
  const manifest = "_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/native-source-manifest.json", bytes = await readFile(manifest);
  requireValue(digest(bytes) === packet.programs.plan.sourceManifestSha256 && JSON.stringify(await sourceInventory(repository)) === JSON.stringify(JSON.parse(bytes.toString())), "UNCHANGED_NATIVE_65_SOURCE_REQUIRED");
  for (const [name, text] of [["host-command.fish", packet.command + "\n"], ["host-program.mjs", packet.programs.host], ["driver-program.mjs", packet.programs.driver], ["plan.json", JSON.stringify(packet.programs.plan, null, 2) + "\n"]]) {
    const path = relative(repository, resolve(directory, name!)), data = Buffer.from(text!); await writeFile(path, data, { flag: "wx" });
    const row = { path, bytes: data.length, sha256: digest(data) }; if (name === "host-command.fish") command = row; else programs.push(row);
  }
  for (const stage of commands) {
    const step = resolve(directory, stage.name); await mkdir(step);
    const result = await runBounded(stage.argv, step, 120000, { cwd: repository, environment: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(directory, "home"), TMPDIR: resolve(directory, "tmp"), NO_COLOR: "1", MISE_AUTO_INSTALL: "false", MISE_EXEC_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false", HOST_FEASIBILITY_TEST_EVIDENCE: resolve(directory, "e2e") } });
    const streams = await Promise.all(["stdout", "stderr"].map(async stream => { const path = resolve(step, "command." + stream), data = await readFile(path); return { path: relative(repository, path), bytes: data.length, sha256: digest(data) }; }));
    results.push({ ...stage, ...result, streams }); requireValue(result.status === "PASS" && result.exitCode === 0, "FEASIBILITY_SOURCE_CHECK_FAILED:" + stage.name);
  }
} catch (error) { failure = error instanceof Error ? error.message : String(error); }
try { sourceChanged = (await Promise.all(sources.map(async row => digest(await readFile(row.path)) !== row.sha256))).some(Boolean); if (sourceChanged) failure ??= "SOURCE_CHANGED_DURING_FEASIBILITY_VERIFICATION"; }
catch (error) { sourceChanged = null; failure ??= "SOURCE_STABILITY_UNCHECKED:" + String(error); }
const status = failure === null && results.length === commands.length && sourceChanged === false ? "PASS_GPU_FEASIBILITY_SOURCE_ONLY" : "FAIL_GPU_FEASIBILITY_SOURCE_ONLY";
const receipt = { status, failure, sources, sourceChanged, results, command, programs, plan: packet?.programs.plan ?? null, protectedBaselineSources: baseline.sources.length,
  verificationScope: "BUN_STATIC_AND_PURE_MOCK_E2E_NOT_HOST_GPU_NATIVE_OR_JIT_EXECUTION", originalHostArtifactBytesRehashed: false,
  hostExecutionAuthorized: false, copyingOrStagingAuthorized: false, kernelJitCompilationAuthorized: false, nativeCompilationPerformed: false,
  gpuExecuted: false, publicationAuthorized: false, trainingAuthorized: false, trainingReady: false, localFishSyntax: "NOT_EXECUTED_HOST_SYNTAX_PRECHECK_EMBEDDED" };
const proofPath = relative(repository, resolve(directory, "receipt.json")), proofBytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
await writeFile(proofPath, proofBytes, { flag: "wx" });
if (status === "PASS_GPU_FEASIBILITY_SOURCE_ONLY") await writeFile(resolve(directory, "approval-proposal.json"), JSON.stringify({ status: "DRAFT_FRESH_EXACT_HOST_GPU_JIT_APPROVAL_REQUIRED", sourceProof: { path: proofPath, sha256: digest(proofBytes) }, command, programs,
  plan: packet!.programs.plan, maximumHostInvocations: 1, maximumContainers: 1, retainedInputsReadOnly: true, writableScope: [packet!.programs.plan.workspace, packet!.programs.plan.evidence],
  hostExecutionApproved: false, copyingOrStagingApproved: false, gpuExecutionApproved: false, kernelJitCompilationApproved: false, publicationApproved: false, trainingApproved: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status, failure, sources: sources.length, command, receipt: proofPath })); process.exitCode = status === "PASS_GPU_FEASIBILITY_SOURCE_ONLY" ? 0 : 1;
