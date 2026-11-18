// SPEC: _spec/gpu-host-build-reuse.puml
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { repository, work } from "../../provision";
import { runBounded } from "../../verify";
import { sourceInventory } from "../../../../tooling/runtime/qualification";
import { correctionProof } from "./plan";
import { renderReusePacket } from "./render";

const [label] = Bun.argv.slice(2);
if (Bun.argv.length !== 3 || !/^host-gpu-cache-reuse-source-[1-9][0-9]*$/.test(label ?? "") || resolve(process.cwd()) !== resolve(repository)) throw Error("CACHE_REUSE_SOURCE_CONTEXT_REQUIRED");
const directory = resolve(work, "runs", label!), hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: unknown, reason: string) => { if (!value) throw Error(reason); };
await mkdir(directory); for (const name of ["home", "tmp", "e2e", "original-e2e"]) await mkdir(resolve(directory, name));
const correction = JSON.parse(await readFile(correctionProof, "utf8"));
const paths = new Set<string>(correction.sources.map((row: { path: string }) => row.path));
for (const path of [correctionProof, correction.generation.path, "_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/record-check.json", "_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/review.json"]) paths.add(path);
for await (const path of new Bun.Glob("_work/gpu-owner-recovery/qualification/host-build-reuse/*.{ts,json}").scan({ cwd: repository, onlyFiles: true })) paths.add(path);
const sources = await Promise.all([...paths].sort().map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(resolve(directory, "sources.json"), JSON.stringify(sources, null, 2) + "\n", { flag: "wx" });
const commands = [
  { name: "reuse-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/qualification/host-build-reuse/plan.test.ts", "./_work/gpu-owner-recovery/qualification/host-build-reuse/native.test.ts", "./_work/gpu-owner-recovery/qualification/host-build-reuse/host.test.ts", "./_work/gpu-owner-recovery/qualification/host-build-reuse/render.test.ts"] },
  { name: "qualification-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./packages/runtime/tests/gpu-policy-record.test.ts", "./packages/runtime/tests/gpu-recipe.test.ts", "./packages/runtime/tests/gpu-qualification.test.ts", "./_work/gpu-owner-recovery/prepared-llvm/verify.test.ts"] },
  { name: "original-build-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/qualification/host-build/build.test.ts", "./_work/gpu-owner-recovery/qualification/host-build/render.test.ts"] },
  ...["tsconfig.json", "tsconfig.tests.json", "_work/gpu-owner-recovery/qualification/tsconfig.json", "_work/gpu-owner-recovery/qualification/host-build/tsconfig.json", "_work/gpu-owner-recovery/qualification/policy-record-fix/tsconfig.json", "_work/gpu-owner-recovery/qualification/host-build-reuse/tsconfig.json"].map((project, index) => ({ name: "types-" + index, argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", project] })),
];
const results = []; let failure: string | null = null, sourceChanged: boolean | null = null, packet: Awaited<ReturnType<typeof renderReusePacket>> | null = null;
let command: { path: string; bytes: number; sha256: string } | null = null;
let programs: { path: string; bytes: number; sha256: string }[] = [];
try {
  packet = await renderReusePacket();
  check(JSON.stringify(await sourceInventory(repository)) === JSON.stringify(JSON.parse(packet.programs.plan.correctedManifest.utf8)), "CORRECTED_SOURCE_GENERATION_REQUIRED");
  const commandBytes = Buffer.from(packet.command + "\n");
  command = { path: relative(repository, resolve(directory, "host-command.fish")), bytes: commandBytes.length, sha256: hash(commandBytes) };
  await writeFile(command.path, commandBytes, { flag: "wx" });
  for (const [name, text] of [["host-program.mjs", packet.programs.host], ["native-program.mjs", packet.programs.native], ["plan.json", JSON.stringify(packet.programs.plan, null, 2) + "\n"]]) {
    const path = relative(repository, resolve(directory, name!)), bytes = Buffer.from(text!);
    await writeFile(path, bytes, { flag: "wx" }); programs.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  }
  for (const stage of commands) {
    const step = resolve(directory, stage.name); await mkdir(step);
    const result = await runBounded(stage.argv, step, 120000, { cwd: repository, environment: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(directory, "home"), TMPDIR: resolve(directory, "tmp"), NO_COLOR: "1", GIT_NO_LAZY_FETCH: "1", MISE_AUTO_INSTALL: "false", MISE_EXEC_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false", HOST_BUILD_REUSE_TEST_EVIDENCE: resolve(directory, "e2e"), HOST_BUILD_TEST_EVIDENCE: resolve(directory, "original-e2e") } });
    const streams = await Promise.all(["stdout", "stderr"].map(async stream => { const path = resolve(step, "command." + stream), bytes = await readFile(path); return { path: relative(repository, path), bytes: bytes.length, sha256: hash(bytes) }; }));
    results.push({ ...stage, ...result, streams }); check(result.status === "PASS" && result.exitCode === 0, "REUSE_SOURCE_CHECK_FAILED:" + stage.name);
  }
} catch (error) { failure = error instanceof Error ? error.message : String(error); }
try {
  sourceChanged = (await Promise.all(sources.map(async source => hash(await readFile(source.path)) !== source.sha256))).some(Boolean);
  if (packet) sourceChanged ||= JSON.stringify(await sourceInventory(repository)) !== JSON.stringify(JSON.parse(packet.programs.plan.correctedManifest.utf8));
  if (sourceChanged) failure ??= "SOURCE_CHANGED_DURING_REUSE_VERIFICATION";
} catch (error) { sourceChanged = null; failure ??= "SOURCE_STABILITY_UNCHECKED:" + String(error); }
const status = failure === null && results.length === commands.length && sourceChanged === false ? "PASS_CACHE_REUSE_SOURCE_ONLY" : "FAIL_CACHE_REUSE_SOURCE_ONLY";
const receipt = { status, failure, sources, sourceChanged, results, command, programs, plan: packet?.programs.plan ?? null,
  verificationScope: "BUN_STATIC_AND_PURE_MOCK_LIFECYCLES_NOT_HOST_OR_NATIVE_EXECUTION", hostExecutionAuthorized: false, cacheWritesAuthorized: false, copyingOrStagingAuthorized: false,
  publicationAuthorized: false, nativeCompilationPerformed: false, gpuExecuted: false, trainingAuthorized: false, trainingReady: false, localFishSyntax: "NOT_EXECUTED_HOST_SYNTAX_PRECHECK_EMBEDDED" };
const proofPath = relative(repository, resolve(directory, "receipt.json")), proofBytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
await writeFile(proofPath, proofBytes, { flag: "wx" });
if (status === "PASS_CACHE_REUSE_SOURCE_ONLY") await writeFile(resolve(directory, "approval-proposal.json"), JSON.stringify({ status: "DRAFT_AWAITING_EXACT_HOST_CACHE_WRITE_STAGING_AND_NATIVE_BUILD_APPROVAL", sourceProof: { path: proofPath, sha256: hash(proofBytes) }, command, programs,
  plan: packet!.programs.plan, maximumHostInvocations: 1, cacheMutationScope: { cargoHome: packet!.programs.plan.retained.cargo, cargoTarget: packet!.programs.plan.retained.target }, retainedBunReadOnly: packet!.programs.plan.retained.bun, preserveOriginalFailedSourceAndEvidence: true,
  hostExecutionApproved: false, cacheWritesApproved: false, copyingOrStagingApproved: false, publicationApproved: false, gpuExecutionApproved: false, trainingApproved: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status, failure, sources: sources.length, command, receipt: proofPath }));
process.exitCode = status === "PASS_CACHE_REUSE_SOURCE_ONLY" ? 0 : 1;
