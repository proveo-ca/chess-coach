// SPEC: _spec/gpu-qualification.puml
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readFile, statfs, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { protectFinalizationSignals, treeBytes, watchWorkspace } from "./host-build/build";
import hostBuildPlan from "./host-build/plan.json";
import planJson from "./cpu-host-plan.json";
import type { runBounded } from "../verify";

export type CpuPlan = typeof planJson;
type Qualification = Pick<typeof import("../../../tooling/runtime/qualification"), "cpuCoverage" | "sourceInventory" | "readArtifacts" | "qualificationPlan" | "validateLimits" | "executeQualification" | "recordAttempt" | "testPassed">;
type Manifest = { path: string; sha256: string }[];
type Result = { status: string; exitCode: number; failure: string | null };
type Stream = { path: string; bytes: number; sha256: string };
type Capture = { stdout: string; streams: Stream[] };
type Attempt = Parameters<Qualification["recordAttempt"]>[0][number];
export type Artifact = { executable: string; bytes: number; sha256: string };
const requireValue: (value: unknown, reason: string) => asserts value = (value, reason) => { if (!value) throw Error(reason); };
export const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const freeze = <T>(value: T): T => { if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };
export const cpuPlan = freeze(structuredClone(planJson));
export function validatePlan(value: CpuPlan = cpuPlan) {
  requireValue(JSON.stringify(value) === JSON.stringify(cpuPlan), "CLOSED_CPU39_PLAN_REQUIRED");
  requireValue(value.limits.overallMs === value.limits.normalOperationsMs + value.limits.cleanupMs + value.limits.receiptReserveMs, "WHOLE_CLOCK_BUDGET_REQUIRED");
  requireValue(value.limits.workerMs === value.limits.compilationMs + value.testLoop.totalMs + value.limits.startupAndFinalizationMs, "COMPLETE_WORKER_BUDGET_REQUIRED");
  return value;
}
export function cpuPaths(root = cpuPlan.root) {
  requireValue(root === cpuPlan.root, "FIXED_HOST_ROOT_REQUIRED");
  const workspace = resolve(root, cpuPlan.workspace), evidence = resolve(root, cpuPlan.evidence);
  return { workspace, evidence, native: workspace + "/native", cargo: workspace + "/cargo-home", scratch: workspace + "/scratch", inner: evidence + "/inner",
    retainedNative: resolve(root, cpuPlan.retained.native), retainedCargo: resolve(root, cpuPlan.retained.cargo), bun: resolve(root, cpuPlan.retained.bun) };
}
export type CpuPaths = ReturnType<typeof cpuPaths>;
export function cpuBuildCommands() {
  return ["learning", "policy-io"].map(owner => ({ id: owner === "learning" ? "cpu-learning" : "cpu-policy", argv: ["cargo", "test", "--release", "--target", "x86_64-unknown-linux-gnu", "--locked", "--offline", "--jobs", "2", "-p", "chess-coach-" + owner, "--tests", "--no-run", "--message-format=json"] }));
}
const docker = (...argv: string[]) => ["docker", "--host=" + cpuPlan.engine, ...argv];
export function cpuWorkerCreate(paths: CpuPaths, uid: number, gid: number) {
  requireValue(Number.isSafeInteger(uid) && uid >= 0 && Number.isSafeInteger(gid) && gid >= 0, "NUMERIC_OPERATOR_UID_GID_REQUIRED");
  requireValue(JSON.stringify(paths) === JSON.stringify(cpuPaths()), "CLOSED_CPU_PATHS_REQUIRED");
  const mounts: [string, string, boolean][] = [[paths.retainedNative, "/retained/native", true], [paths.bun, "/usr/local/bin/bun", true], [paths.native, "/build/native", false],
    [paths.cargo, "/capture/cargo-home", false], [paths.retainedCargo + "/registry/index", "/capture/cargo-home/registry/index", true],
    [paths.retainedCargo + "/registry/cache", "/capture/cargo-home/registry/cache", true], [paths.evidence, "/evidence", true],
    [paths.inner, "/build/native/_work/gpu-owner-recovery/runs/" + cpuPlan.runId, false], [paths.scratch, "/build/native/_work/gpu-owner-recovery/scratch", false]];
  const environment = { CARGO_HOME: "/capture/cargo-home", CARGO_TARGET_DIR: "/build/native/target-cpu", CARGO_BUILD_JOBS: "2", CARGO_NET_OFFLINE: "true", CARGO_NET_RETRY: "0",
    RAYON_NUM_THREADS: "2", RUST_TEST_THREADS: "1", RUSTUP_AUTO_INSTALL: "0", HOME: "/build/native/_work/gpu-owner-recovery/scratch/home", TMPDIR: "/build/native/_work/gpu-owner-recovery/scratch/tmp",
    PATH: "/usr/local/cargo/bin:/usr/local/bin:/usr/bin:/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC" };
  return docker("create", "--pull=never", "--platform=linux/amd64", "--network=none", "--cpus=2", "--memory=8g", "--memory-swap=8g", "--user=" + uid + ":" + gid,
    "--cidfile=" + paths.evidence + "/worker.cid", "--label=chess-coach.cpu39=" + cpuPlan.runId, "--workdir=/build/native", "--entrypoint=/usr/local/bin/bun",
    ...mounts.flatMap(([source, target, ro]) => { requireValue(source.startsWith("/") && !source.includes(","), "ABSOLUTE_COMMA_FREE_MOUNT_REQUIRED"); return ["--mount", `type=bind,source=${source},target=${target}${ro ? ",readonly" : ""}`]; }),
    ...Object.entries(environment).flatMap(([key, value]) => ["--env", key + "=" + value]), cpuPlan.rustImage, "--no-env-file", "--no-install", "/evidence/driver.mjs");
}

export function cpuManifest(bytes: Uint8Array): Manifest {
  requireValue(bytes.byteLength <= cpuPlan.limits.stagingBytes && digest(bytes) === cpuPlan.sourceManifestSha256, "CPU_NATIVE65_MANIFEST_HASH_REQUIRED");
  const rows = JSON.parse(Buffer.from(bytes).toString()) as Manifest;
  requireValue(Array.isArray(rows) && rows.length === 65 && new Set(rows.map(row => row.path)).size === 65, "EXACT_NATIVE65_REQUIRED");
  for (const row of rows) requireValue(typeof row.path === "string" && !row.path.startsWith("/") && row.path.split("/").every(part => /^[a-zA-Z0-9_.-]+$/.test(part) && part !== "." && part !== "..")
    && /^[a-f0-9]{64}$/.test(row.sha256), "MANIFEST_SOURCE_PATH_REQUIRED");
  return rows;
}
export type StageIO = { check(): void; stat(path: string): Promise<{ isFile(): boolean; size: number }>; read(path: string): Promise<Uint8Array>;
  mkdir(path: string): Promise<unknown>; copy(from: string, to: string, flags: number): Promise<unknown>; hash(path: string): Promise<string> };
export async function stageCpuSources(io: StageIO) {
  const from = "/retained/native", to = "/build/native", manifestPath = "qualification/source-manifest.json";
  io.check(); const manifestStat = await io.stat(from + "/" + manifestPath); io.check();
  requireValue(manifestStat.isFile() && manifestStat.size > 0 && manifestStat.size <= cpuPlan.limits.stagingBytes, "REGULAR_BOUNDED_MANIFEST_REQUIRED");
  const bytes = await io.read(from + "/" + manifestPath); io.check();
  requireValue(bytes.byteLength === manifestStat.size, "MANIFEST_SIZE_CHANGED");
  const inventory = cpuManifest(bytes);
  let copiedBytes = 0, copiedFiles = 0;
  for (const row of [...inventory, { path: manifestPath, sha256: cpuPlan.sourceManifestSha256 }]) {
    io.check(); const source = from + "/" + row.path, target = to + "/" + row.path, stat = await io.stat(source); io.check();
    requireValue(stat.isFile() && Number.isSafeInteger(stat.size) && stat.size >= 0, "STAGING_REGULAR_FILE_REQUIRED");
    copiedBytes += stat.size; copiedFiles++;
    requireValue(copiedBytes <= cpuPlan.limits.stagingBytes && copiedFiles <= cpuPlan.limits.stagingFiles, "CPU_SOURCE_COPY_BOUND");
    await io.mkdir(dirname(target)); io.check(); await io.copy(source, target, constants.COPYFILE_EXCL); io.check();
    const copied = await io.stat(target); io.check();
    requireValue(copied.isFile() && copied.size === stat.size && await io.hash(target) === row.sha256, "STAGED_SOURCE_HASH_REQUIRED:" + row.path); io.check();
  }
  requireValue(copiedFiles === 66, "EXACT_66_SOURCE_COPIES_REQUIRED");
  return { inventory, copiedBytes, copiedFiles, sourceManifestSha256: digest(bytes) };
}

export type WorkerIO = { now(): number; startedAt: number; deadline: number;
  bootstrap(check: () => void): Promise<{ qualification: Qualification; staging: Awaited<ReturnType<typeof stageCpuSources>> }>;
  inventory(): Promise<Manifest>; execute(id: string, argv: string[], timeoutMs: number): Promise<Result>; capture(id: string): Promise<Capture>;
  artifact(executable: string, check: () => void): Promise<Artifact> };
export function cpuStdoutSummary(stdout: string) {
  let summaryCount = 0;
  const stdoutSummaries: string[] = [];
  for (const match of stdout.matchAll(/^test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored;.*$/gm)) {
    summaryCount++;
    if (stdoutSummaries.length < 2) {
      const counts = match.slice(1, 4).map(text => { const value = Number(text); return Number.isSafeInteger(value) ? value : -1; });
      stdoutSummaries.push(`test result: ok. ${counts[0]} passed; ${counts[1]} failed; ${counts[2]} ignored;`);
    }
  }
  return { summaryCount, stdoutSummaries };
}
export async function executeCpuWorker(io: WorkerIO) {
  const deadline = Math.min(io.startedAt + cpuPlan.limits.workerMs, io.deadline), attempts: Attempt[] = [], invoked = new Set<string>(), artifacts: Artifact[] = [];
  let phase = "staging", failure: string | null = null, qualification: Qualification | null = null, staging: Awaited<ReturnType<typeof stageCpuSources>> | null = null;
  let sourceChanged: boolean | null = null, sourceStabilityChecked = false, compilationAttempts = 0, outcome: Awaited<ReturnType<Qualification["executeQualification"]>> | null = null;
  let failurePhase: string | null = null, sourceCheckFailure: string | null = null;
  let harnesses: ReturnType<Qualification["qualificationPlan"]> = [];
  const check = () => requireValue(io.now() < deadline - cpuPlan.limits.workerFinalizationMs, "CPU_WORKER_PHASE_DEADLINE:" + phase);
  const command = async (id: string, argv: string[], ms: number) => {
    check(); requireValue(ms > 0 && ms <= deadline - cpuPlan.limits.workerFinalizationMs - io.now(), "COMPLETE_PHASE_COMMAND_BUDGET_REQUIRED");
    const result = await qualification!.recordAttempt(attempts, id, argv, ms, {
      execute: async () => { invoked.add(id); return io.execute(id, argv, ms); },
      capture: async () => { const captured = await io.capture(id); check(); requireValue(captured.streams.length === 2 && captured.streams.every(stream => stream.bytes >= 0 && stream.bytes <= cpuPlan.limits.supervisedStreamBytes && /^[a-f0-9]{64}$/.test(stream.sha256)), "BOUNDED_TWO_STREAM_CAPTURE_REQUIRED"); return captured; },
    });
    check(); return result;
  };
  try {
    check(); const boot = await io.bootstrap(check); check(); qualification = boot.qualification; staging = boot.staging;
    requireValue(staging.copiedFiles === 66 && staging.copiedBytes <= cpuPlan.limits.stagingBytes && staging.sourceManifestSha256 === cpuPlan.sourceManifestSha256 && staging.inventory.length === 65, "CPU_NATIVE65_STAGING_REQUIRED");
    const before = await io.inventory(); check(); requireValue(JSON.stringify(before) === JSON.stringify(staging.inventory), "CPU_STAGED_SOURCE_INVENTORY_REQUIRED");
    qualification.validateLimits(cpuPlan.testLoop, 16);
    requireValue(JSON.stringify(qualification.cpuCoverage) === JSON.stringify(cpuPlan.cpuCoverage), "FROZEN_CPU39_COVERAGE_REQUIRED");
    phase = "version-guards";
    for (const name of ["rustc", "cargo"]) {
      const result = await command(name + "-version", [name, "--version"], cpuPlan.limits.versionMs);
      requireValue(result.status === "PASS" && result.exitCode === 0 && result.failure === null && new RegExp("^" + name + " 1\\.95\\.0 ").test(result.stdout), "CPU_TOOLCHAIN_VERSION_REQUIRED:" + name);
    }
    phase = "compilation";
    requireValue(io.now() + cpuPlan.limits.compilationMs + cpuPlan.testLoop.totalMs + cpuPlan.limits.workerFinalizationMs <= deadline, "COMPLETE_COMPILE_AND_CPU_LOOP_BUDGET_REQUIRED");
    const compileDeadline = io.now() + cpuPlan.limits.compilationMs, logs: Record<string, string> = {};
    for (const build of cpuBuildCommands()) {
      const ms = Math.floor(compileDeadline - io.now()); requireValue(ms > 0, "AGGREGATE_CPU_COMPILATION_DEADLINE"); compilationAttempts++;
      const result = await command(build.id, build.argv, ms);
      requireValue(io.now() < compileDeadline, "AGGREGATE_CPU_COMPILATION_DEADLINE");
      requireValue(result.status === "PASS" && result.exitCode === 0 && result.failure === null, "CPU_COMPILATION_FAILED:" + build.id);
      logs[build.id] = result.stdout;
    }
    phase = "artifacts";
    const selected = qualification.readArtifacts({ learning: logs["cpu-learning"]!, "policy-io": logs["cpu-policy"]! }, "cpu"); check();
    const steps = qualification.qualificationPlan("cpu", "regression", selected.artifacts);
    requireValue(steps.length === 16 && steps.every((step, index) => step.id === Object.keys(cpuPlan.cpuCoverage)[index] && step.count === Object.values(cpuPlan.cpuCoverage)[index]), "COMPLETE_CPU39_PLAN_REQUIRED");
    harnesses = steps;
    const executables = new Set([...steps.map(step => step.executable), ...selected.binaries.values()]);
    requireValue(executables.size === 19, "NINETEEN_DISTINCT_CPU_EXECUTABLES_REQUIRED");
    for (const executable of executables) {
      check(); const artifact = await io.artifact(executable, check); check();
      requireValue(artifact.executable === executable && artifact.bytes > 0 && Number.isSafeInteger(artifact.bytes) && /^[a-f0-9]{64}$/.test(artifact.sha256), "ACTUAL_CPU_EXECUTABLE_METADATA_REQUIRED"); artifacts.push(artifact);
    }
    phase = "cpu-regression";
    requireValue(io.now() + cpuPlan.testLoop.totalMs + cpuPlan.limits.workerFinalizationMs <= deadline, "COMPLETE_CPU_LOOP_BUDGET_REQUIRED");
    outcome = await qualification.executeQualification(steps, cpuPlan.testLoop, { now: io.now, run: async (step, argv, ms) => {
      requireValue(ms === cpuPlan.testLoop.perTestMs, "COMPLETE_CPU_HARNESS_BUDGET_REQUIRED");
      requireValue(!argv.includes("--ignored") && !argv.includes("--exact") && argv.length === 4 && argv[0] === step.executable, "UNFILTERED_SERIAL_CPU_COMMAND_REQUIRED");
      return command(step.id, argv, ms);
    } }); check();
    requireValue(outcome.status === "PASS_TESTS_ONLY" && outcome.results.length === 16 && outcome.results.every((result, index) => result.accepted && invoked.has(result.id) && qualification!.testPassed(result, steps[index]!.count)), "ALL_16_CPU_HARNESSES_MUST_EXECUTE_AND_PASS");
  } catch (error) { failure = errorText(error); failurePhase = phase; }
  phase = "source-postcheck";
  if (staging && qualification) {
    try { check(); const after = await io.inventory(); check(); sourceChanged = JSON.stringify(after) !== JSON.stringify(staging.inventory); sourceStabilityChecked = true; }
    catch (error) { sourceChanged = null; sourceCheckFailure = errorText(error); if (failure === null) { failure = sourceCheckFailure; failurePhase = phase; } }
  }
  if (failure === null && (sourceChanged !== false || !sourceStabilityChecked)) { failure = "CPU_SOURCE_STABILITY_REQUIRED"; failurePhase = phase; }
  if (failure === null && io.now() >= deadline - cpuPlan.limits.workerFinalizationMs) { failure = "CPU_WORKER_FINALIZATION_DEADLINE"; failurePhase = phase; }
  const boundedOutcome = outcome ? { ...outcome, results: outcome.results.map(result => {
    const { stdout, ...metadata } = result, harness = harnesses.find(step => step.id === result.id);
    return { ...metadata, expectedCount: harness?.count ?? null, executable: harness?.executable ?? null, ...cpuStdoutSummary(stdout) };
  }) } : null;
  return { version: "chess-coach.cpu39-worker.v1", status: failure === null ? "PASS_CPU39_TESTS_ONLY" : "FAIL_CPU39_TESTS_ONLY", failure, phase: failure === null ? "complete" : failurePhase ?? phase, failurePhase,
    staging, sourceChanged, sourceStabilityChecked, sourceCheckFailure, sourceManifestSha256: cpuPlan.sourceManifestSha256, compilationAttempts, artifacts, harnesses, outcome: boundedOutcome,
    results: attempts.map(attempt => ({ ...attempt, commandInvoked: invoked.has(attempt.id) })), elapsedMs: io.now() - io.startedAt,
    cpuOnly: true, gpuExecuted: false, llvmExecuted: false, trainingExecuted: false, trainingReady: false };
}
export type WorkerReceipt = Awaited<ReturnType<typeof executeCpuWorker>>;
export function acceptCpuWorker(receipt: WorkerReceipt) {
  const expected = Object.entries(cpuPlan.cpuCoverage), prefix = "/build/native/target-cpu/x86_64-unknown-linux-gnu/release/";
  const headers = [...["rustc", "cargo"].map(name => ({ id: name + "-version", argv: [name, "--version"] })), ...cpuBuildCommands()];
  const successfulAttempt = (row: WorkerReceipt["results"][number]) => row.attempted === true && row.commandInvoked === true && row.status === "PASS" && row.exitCode === 0 && row.failure === null
    && row.streams?.length === 2 && row.streams.every(stream => stream.bytes >= 0 && stream.bytes <= cpuPlan.limits.supervisedStreamBytes && /^[a-f0-9]{64}$/.test(stream.sha256));
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  requireValue(receipt.status === "PASS_CPU39_TESTS_ONLY" && receipt.phase === "complete" && receipt.failure === null && receipt.failurePhase === null && receipt.sourceCheckFailure === null
    && receipt.compilationAttempts === 2 && receipt.sourceChanged === false && receipt.sourceStabilityChecked === true
    && receipt.sourceManifestSha256 === cpuPlan.sourceManifestSha256 && receipt.staging?.copiedFiles === 66 && receipt.artifacts.length === 19 && new Set(receipt.artifacts.map(row => row.executable)).size === 19
    && receipt.artifacts.every(row => row.executable.startsWith(prefix) && resolve(row.executable) === row.executable && row.bytes > 0 && Number.isSafeInteger(row.bytes) && /^[a-f0-9]{64}$/.test(row.sha256))
    && ["policy-score", "policy-channel", "policy-initialize"].every(name => receipt.artifacts.some(row => row.executable === prefix + name))
    && receipt.harnesses.length === 16 && new Set(receipt.harnesses.map(row => row.executable)).size === 16 && receipt.harnesses.every(row => row.executable.startsWith(prefix + "deps/"))
    && receipt.results.length === 20 && receipt.results.every(successfulAttempt)
    && headers.every((header, index) => { const row = receipt.results[index]!; return row.id === header.id && same(row.argv, header.argv)
      && (index < 2 ? row.timeoutMs === cpuPlan.limits.versionMs : Number.isSafeInteger(row.timeoutMs) && row.timeoutMs > 0 && row.timeoutMs <= cpuPlan.limits.compilationMs && (index === 2 || row.timeoutMs <= receipt.results[2]!.timeoutMs)); })
    && receipt.outcome?.status === "PASS_TESTS_ONLY" && receipt.outcome.results.length === 16 && expected.every(([id, count], index) => {
      const harness = receipt.harnesses[index]!, row = receipt.outcome!.results[index]!, attempt = receipt.results[index + 4]!;
      return harness.id === id && harness.count === count && harness.selector === undefined && row.id === id && row.expectedCount === count && row.executable === harness.executable
        && row.accepted === true && row.status === "PASS" && row.exitCode === 0 && row.failure === null && row.summaryCount === 1
        && same(row.stdoutSummaries, [`test result: ok. ${count} passed; 0 failed; 0 ignored;`])
        && attempt.id === id && attempt.timeoutMs === cpuPlan.testLoop.perTestMs && same(attempt.argv, [harness.executable, "--test-threads=1", "--nocapture", "--color=never"])
        && receipt.artifacts.some(artifact => artifact.executable === harness.executable);
    }) && receipt.cpuOnly === true && receipt.gpuExecuted === false && receipt.llvmExecuted === false && receipt.trainingExecuted === false && receipt.trainingReady === false,
    "COMPLETE_SUCCESSFUL_CPU39_WORKER_RECEIPT_REQUIRED");
}

export type HostIO = { now(): number; startedAt: number; run(id: string, argv: string[], timeoutMs: number): Promise<Result & { stdout: string }>;
  recover(): Promise<string | null>; workerReceipt(): Promise<WorkerReceipt>; watch(stop: (reason: string) => Promise<void>): () => void | Promise<void> };
export async function executeCpuHost(paths: CpuPaths, uid: number, gid: number, io: HostIO) {
  const normalDeadline = io.startedAt + cpuPlan.limits.normalOperationsMs, cleanupDeadline = normalDeadline + cpuPlan.limits.cleanupMs;
  const results: { id: string; argv: string[]; status: string; [key: string]: unknown }[] = [], cleanupFailures: string[] = [], used = new Set<string>();
  let failure: string | null = null, cid: string | null = null, state: { Running: boolean; ExitCode: number; OOMKilled: boolean } | null = null, inner: WorkerReceipt | null = null;
  let pending = false, stateAttempted = false, stopPromise: Promise<void> | null = null;
  const check = (cleanup = false) => requireValue(io.now() < (cleanup ? cleanupDeadline : normalDeadline), cleanup ? "CPU_HOST_CLEANUP_DEADLINE" : "CPU_HOST_NORMAL_DEADLINE");
  const operation = async (id: string, argv: string[], max: number, cleanup = false) => {
    check(cleanup); requireValue(cleanup || failure === null, failure ?? "CPU_HOST_INTERRUPTED");
    requireValue(!used.has(id) && used.size < 7, "CLOSED_SEVEN_DOCKER_OPERATIONS_REQUIRED"); used.add(id);
    const row = { id, argv, status: "STARTED" }; results.push(row);
    try {
      const out = await io.run(id, argv, Math.floor(Math.min(max, (cleanup ? cleanupDeadline : normalDeadline) - io.now())));
      const { stdout, ...record } = out; Object.assign(row, record, { supervisorResult: record }); check(cleanup);
      requireValue(out.status === "PASS" && out.exitCode === 0 && out.failure === null, "CPU_DOCKER_OPERATION_FAILED:" + id); return stdout.trim();
    } catch (error) { Object.assign(row, { status: "FAIL", operationFailure: errorText(error) }); throw error; }
  };
  const recover = async () => {
    const value = await io.recover(); check(true);
    if (value !== null) { requireValue(/^[a-f0-9]{64}$/.test(value) && (cid === null || cid === value), "OWNED_CPU_CONTAINER_ID_REQUIRED"); cid = value; }
  };
  const stop = () => stopPromise ??= (async () => {
    if (!cid || state?.Running === false) return;
    try { await operation("worker-stop", docker("stop", "--time=10", cid), 20000, true); }
    catch (error) {
      cleanupFailures.push(errorText(error));
      try { await operation("worker-kill", docker("kill", "--signal=KILL", cid), 15000, true); }
      catch (killError) { cleanupFailures.push(errorText(killError)); }
    }
  })();
  const inspect = async (cleanup: boolean) => {
    stateAttempted = true; state = JSON.parse(await operation("worker-state", docker("container", "inspect", "--format", "{{json .State}}", cid!), 10000, cleanup));
    requireValue(state?.Running === false && state.ExitCode === 0 && state.OOMKilled === false, "SUCCESSFUL_TERMINAL_CPU_CONTAINER_STATE_REQUIRED");
  };
  let unwatch: (() => void | Promise<void>) | null = null;
  try {
    check(); unwatch = io.watch(async reason => { failure ??= reason; if (cid && !pending) await stop(); }); check();
    pending = true;
    try { await operation("worker-create", cpuWorkerCreate(paths, uid, gid), cpuPlan.limits.dockerCommandMs); }
    finally { pending = false; }
    await recover(); check(); requireValue(cid, "OWNED_CPU_WORKER_CID_REQUIRED");
    pending = true;
    try { await operation("worker-start", docker("start", cid), cpuPlan.limits.dockerCommandMs); }
    finally { pending = false; }
    await operation("worker-logs", docker("logs", "--follow", cid), cpuPlan.limits.workerMs);
    inner = await io.workerReceipt(); check(); acceptCpuWorker(inner);
    await inspect(false); check(); requireValue(failure === null, failure ?? "CPU_HOST_INTERRUPTED");
  } catch (error) { failure ??= errorText(error); }
  finally {
    try { await recover(); } catch (error) { cleanupFailures.push(errorText(error)); }
    if (cid) {
      if (failure !== null) await stop();
      if (!stateAttempted) { try { await inspect(true); } catch (error) { failure ??= errorText(error); await stop(); } }
      if (stopPromise) await stopPromise;
      try { await operation("worker-remove", docker("rm", cid), 20000, true); } catch (error) { cleanupFailures.push(errorText(error)); }
    }
    try { if (unwatch) await unwatch(); check(true); } catch (error) { failure ??= errorText(error); }
    if (stopPromise) await stopPromise;
  }
  return { version: "chess-coach.cpu39-host.v1", status: failure === null && cleanupFailures.length === 0 ? "PASS_HOST_CPU39_ONLY" : "FAIL_HOST_CPU39_ONLY", failure, cleanupFailures,
    cid: cid as string | null, state: state as { Running: boolean; ExitCode: number; OOMKilled: boolean } | null, innerReceipt: inner, results, elapsedMs: io.now() - io.startedAt, hostInvocationsConsumed: 1, remainingHostInvocations: 0, automaticRetryAuthorized: false,
    cpuOnly: true, gpuDevicesRequested: false, gpuExecuted: false, trainingExecuted: false, trainingReady: false, workspaceIsFilesystemQuota: false,
    dockerWritableLayerIncludedInWorkspaceAccounting: false, limitsAreTrialCapsNotFitGuarantees: true };
}

async function fileDigest(path: string, check: () => void) {
  const hasher = createHash("sha256"); check();
  for await (const chunk of Bun.file(path).stream()) { check(); hasher.update(chunk); }
  check(); return hasher.digest("hex");
}
export type WorkerStartupIO = { now(): number; epochNow(): number; cwd(): string; bunVersion(): string; readDeadline(): Promise<string>;
  initialize(): Promise<Omit<WorkerIO, "now" | "startedAt" | "deadline">>; persist(receipt: WorkerReceipt): Promise<void> };
export async function initializeCpuWorker(io: WorkerStartupIO) {
  const startedAt = io.now(); let phase = "context", receipt: WorkerReceipt;
  try {
    requireValue(io.cwd() === "/build/native" && io.bunVersion() === "1.4.0", "CPU_CONTAINER_BUN_CONTEXT_REQUIRED");
    phase = "deadline";
    const hostDeadline = JSON.parse(await io.readDeadline()).normalDeadlineEpoch, now = io.now(), epochNow = io.epochNow();
    requireValue(Number.isSafeInteger(hostDeadline) && hostDeadline > epochNow && now < startedAt + cpuPlan.limits.workerMs - cpuPlan.limits.workerFinalizationMs, "CPU_HOST_DEADLINE_REQUIRED");
    const deadline = now + hostDeadline - epochNow;
    phase = "initialization"; const worker = await io.initialize();
    receipt = await executeCpuWorker({ ...worker, now: io.now, startedAt, deadline });
  } catch (error) {
    receipt = { version: "chess-coach.cpu39-worker.v1", status: "FAIL_CPU39_TESTS_ONLY", failure: errorText(error), phase, failurePhase: phase,
      staging: null, sourceChanged: null, sourceStabilityChecked: false, sourceCheckFailure: null, sourceManifestSha256: cpuPlan.sourceManifestSha256,
      compilationAttempts: 0, artifacts: [], harnesses: [], outcome: null, results: [], elapsedMs: io.now() - startedAt,
      cpuOnly: true, gpuExecuted: false, llvmExecuted: false, trainingExecuted: false, trainingReady: false };
  }
  await io.persist(receipt); return receipt;
}
export async function runCpuWorker() {
  const root = "/build/native", directory = root + "/_work/gpu-owner-recovery/runs/" + cpuPlan.runId;
  let bounded: typeof runBounded, phaseCheck = () => {};
  const receipt = await initializeCpuWorker({ now: () => performance.now(), epochNow: () => Date.now(), cwd: () => process.cwd(), bunVersion: () => Bun.version,
    readDeadline: () => readFile("/evidence/deadline.json", "utf8"), persist: value => writeJson(directory + "/receipt.json", value), initialize: async () => {
      const environment = Object.fromEntries(Object.entries(process.env).filter((row): row is [string, string] => row[1] !== undefined));
      return {
    bootstrap: async check => {
      phaseCheck = check;
      const staging = await stageCpuSources({ check, stat: lstat, read: readFile, mkdir: path => mkdir(path, { recursive: true }), copy: copyFile, hash: path => fileDigest(path, check) }); check();
      for (const path of ["_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/command-supervisor.ts", "tooling/runtime/qualification.ts"]) {
        const expected = staging.inventory.find(row => row.path === path); requireValue(expected && await fileDigest(root + "/" + path, check) === expected.sha256, "HASH_CHECKED_CPU_HELPER_REQUIRED:" + path); check();
      }
      ({ runBounded: bounded } = await import(pathToFileURL(root + "/_work/gpu-owner-recovery/verify.ts").href)); check();
      const qualification: Qualification = await import(pathToFileURL(root + "/tooling/runtime/qualification.ts").href); check();
      return { qualification, staging };
    }, inventory: async () => {
      const module: Qualification = await import(pathToFileURL(root + "/tooling/runtime/qualification.ts").href); return module.sourceInventory(root);
    }, execute: async (id, argv, ms) => {
      const commandDeadline = performance.now() + ms, step = directory + "/" + id; await mkdir(step); phaseCheck();
      const remaining = Math.floor(commandDeadline - performance.now()); requireValue(remaining > 0, "CPU_COMMAND_SETUP_DEADLINE");
      return bounded(argv, step, remaining, { cwd: root, environment });
    },
    capture: id => captureStreams(directory + "/" + id, phaseCheck), artifact: async (executable, check) => {
      const s = await lstat(executable); check(); requireValue(s.isFile() && (s.mode & 0o111) !== 0, "REGULAR_EXECUTABLE_CPU_ARTIFACT_REQUIRED");
      return { executable, bytes: s.size, sha256: await fileDigest(executable, check) };
    },
  }; } });
  console.log(JSON.stringify({ status: receipt.status, failure: receipt.failure, phase: receipt.phase, trainingReady: false }));
  process.exitCode = receipt.status === "PASS_CPU39_TESTS_ONLY" ? 0 : 1;
}
async function captureStreams(directory: string, check = () => {}): Promise<Capture> {
  const streams: Stream[] = []; let stdout = "";
  for (const name of ["stdout", "stderr"]) {
    check(); const path = directory + "/command." + name, s = await lstat(path); check();
    requireValue(s.isFile() && s.size <= cpuPlan.limits.supervisedStreamBytes, "BOUNDED_CAPTURE_FILE_REQUIRED");
    const bytes = await readFile(path); check(); requireValue(bytes.length <= cpuPlan.limits.supervisedStreamBytes, "CAPTURE_READ_BOUND");
    streams.push({ path, bytes: bytes.length, sha256: digest(bytes) }); if (name === "stdout") stdout = bytes.toString();
  }
  return { stdout, streams };
}
async function writeJson(path: string, value: unknown) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n"); requireValue(bytes.length <= cpuPlan.limits.hostReceiptBytes, "CPU_RECEIPT_BYTE_BOUND");
  await writeFile(path, bytes, { flag: "wx" });
}
export async function runCpuHost(driver: string) {
  const protection = protectFinalizationSignals(), captures: unknown[] = [], paths = cpuPaths();
  let receipt: Record<string, unknown>;
  const epoch = Number(process.env.HOST_CPU39_STARTED_MS), startedAt = performance.now() - (Date.now() - epoch);
  const check = () => {
    requireValue(Number.isSafeInteger(epoch) && epoch > 0 && Date.now() >= epoch && performance.now() < startedAt + cpuPlan.limits.normalOperationsMs, "WHOLE_CPU_HOST_CLOCK_REQUIRED");
    requireValue(!protection.observed(), "CPU_HOST_INTERRUPTED");
  };
  try {
    requireValue(Bun.version === "1.4.0" && process.cwd() === cpuPlan.root && Bun.argv.at(-1) === cpuPlan.grant, "SEPARATE_HUMAN_APPROVAL_AND_PINNED_CPU_HOST_CONTEXT_REQUIRED"); check();
    for (const helper of cpuPlan.existingHelpers) { requireValue(digest(await readFile(helper.path)) === helper.sha256, "CPU_EXISTING_HELPER_HASH_REQUIRED:" + helper.path); check(); }
    requireValue(digest(await readFile("Cargo.lock")) === cpuPlan.cargoLockSha256, "CPU_HOST_CARGO_LOCK_REQUIRED"); check();
    const space = await statfs(dirname(paths.workspace)); check(); requireValue(Number(space.bavail) * Number(space.bsize) >= cpuPlan.limits.minimumFreeBytes, "CPU_INITIAL_64GIB_FREE_REQUIRED");
    for (const path of [paths.bun, paths.retainedNative + "/qualification/source-manifest.json", paths.retainedCargo + "/registry/index", paths.retainedCargo + "/registry/cache"]) {
      const s = await lstat(path); check(); requireValue(path === paths.bun ? s.isFile() && (s.mode & 0o111) !== 0 : path.endsWith(".json") ? s.isFile() : s.isDirectory(), "EXISTING_CPU_RETAINED_INPUT_REQUIRED:" + path);
    }
    await mkdir(paths.workspace); check();
    for (const path of [paths.native, paths.cargo, paths.scratch, paths.inner]) { await mkdir(path); check(); }
    for (const path of [paths.cargo + "/registry/index", paths.cargo + "/registry/cache", paths.cargo + "/registry/src", paths.scratch + "/home", paths.scratch + "/tmp", paths.native + "/_work/gpu-owner-recovery/runs/" + cpuPlan.runId]) { await mkdir(path, { recursive: true }); check(); }
    await writeFile(paths.evidence + "/driver.mjs", driver, { flag: "wx" }); check();
    await writeJson(paths.evidence + "/deadline.json", { normalDeadlineEpoch: epoch + cpuPlan.limits.normalOperationsMs }); check();
    const { runBounded: bounded }: { runBounded: typeof runBounded } = await import(pathToFileURL(resolve(cpuPlan.existingHelpers[0]!.path)).href); check();
    const environment = { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: paths.scratch + "/home", TMPDIR: paths.scratch + "/tmp", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC" };
    receipt = await executeCpuHost(paths, process.getuid!(), process.getgid!(), { now: () => performance.now(), startedAt,
      run: async (id, argv, ms) => {
        const commandDeadline = performance.now() + ms, directory = paths.evidence + "/" + id; await mkdir(directory);
        const remaining = Math.floor(commandDeadline - performance.now()); requireValue(remaining > 0, "CPU_DOCKER_COMMAND_SETUP_DEADLINE");
        const result = await bounded(argv, directory, remaining, { cwd: cpuPlan.root, environment });
        const capture = await captureStreams(directory); captures.push({ id, streams: capture.streams }); return { ...result, stdout: capture.stdout };
      }, recover: async () => { try { return (await readFile(paths.evidence + "/worker.cid", "utf8")).trim(); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; } },
      workerReceipt: async () => { const s = await lstat(paths.inner + "/receipt.json"); requireValue(s.isFile() && s.size <= cpuPlan.limits.hostReceiptBytes, "BOUNDED_CPU_WORKER_RECEIPT_REQUIRED"); return JSON.parse(await readFile(paths.inner + "/receipt.json", "utf8")); },
      watch: stop => {
        const monitor = watchWorkspace({ ...hostBuildPlan, limits: { ...hostBuildPlan.limits, ...cpuPlan.limits } }, { context: paths.evidence, workspace: paths.workspace, evidence: paths.evidence, native: paths.native, cargo: paths.cargo, bun: paths.bun }, stop, {
          free: async () => { const s = await statfs(paths.workspace); return Number(s.bavail) * Number(s.bsize); },
          bytes: async () => {
            const workBytes = await treeBytes(paths.workspace), evidenceBytes = await treeBytes(paths.evidence), scratchBytes = await treeBytes(paths.scratch);
            if (evidenceBytes > cpuPlan.limits.evidenceSoftBytes || scratchBytes > cpuPlan.limits.scratchSoftBytes) await stop("CPU_EVIDENCE_OR_SCRATCH_SOFT_BOUND");
            return workBytes + evidenceBytes;
          },
        }); return async () => { await monitor.check(); await monitor.close(); };
      },
    });
  } catch (error) { receipt = { status: "FAIL_HOST_CPU39_PREFLIGHT", failure: errorText(error), hostInvocationsConsumed: 1, remainingHostInvocations: 0, automaticRetryAuthorized: false, trainingReady: false }; }
  try {
    if (protection.observed() || performance.now() >= startedAt + cpuPlan.limits.overallMs - cpuPlan.limits.receiptReserveMs) { receipt.status = "FAIL_HOST_CPU39_ONLY"; receipt.failure ??= "CPU_HOST_FINALIZATION_SIGNAL_OR_DEADLINE"; }
    await writeJson(paths.evidence + "/receipt.json", { ...receipt, captures, plan: cpuPlan, finalizationSignalObserved: protection.observed(), receiptStatusRequiresZeroHostMarker: true });
    const passed = receipt.status === "PASS_HOST_CPU39_ONLY" && !protection.observed() && performance.now() < startedAt + cpuPlan.limits.overallMs;
    console.log(JSON.stringify({ status: passed ? receipt.status : "FAIL_HOST_CPU39_ONLY", failure: receipt.failure, receipt: cpuPlan.evidence + "/receipt.json", trainingReady: false })); process.exitCode = passed ? 0 : 1;
  } finally { protection.release(); }
}

const quoteFish = (value: string) => "'" + value.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";
export function assertCpuArgv(argv: string[]) {
  const argumentBytes = argv.map(argument => Buffer.byteLength(argument) + 1);
  requireValue(argv.every((argument, index) => !argument.includes("\0") && argumentBytes[index]! <= 131072), "CPU_LINUX_ARGUMENT_BYTE_LIMIT");
  return argumentBytes;
}
export async function buildCpuPrograms() {
  const result = await Bun.build({ entrypoints: [resolve(cpuPlan.root, "_work/gpu-owner-recovery/qualification/cpu-host.ts")], target: "bun", minify: { whitespace: true }, sourcemap: "none" });
  requireValue(result.success && result.outputs.length === 1, "IN_MEMORY_CPU_JS_BUNDLE_REQUIRED");
  const bundle = await result.outputs[0]!.text();
  const driver = bundle + "\nawait runCpuWorker();\n", host = bundle + "\nawait runCpuHost(" + JSON.stringify(driver) + ");\n";
  cpuHostScripts(host); return { bundle, driver, host };
}
export function cpuHostScripts(host: string) {
  const innerKillMs = cpuPlan.limits.cleanupMs / 2, innerTermMs = cpuPlan.limits.normalOperationsMs + cpuPlan.limits.cleanupMs - innerKillMs;
  requireValue(innerTermMs + innerKillMs + cpuPlan.limits.receiptReserveMs === cpuPlan.limits.overallMs, "COMPLETE_CPU_PARENT_TAIL_RESERVE_REQUIRED");
  const evalArgv = ["mise", "exec", "core:bun@1.4.0", "core:rust@1.95.0", "--", "bun", "--no-env-file", "--no-install", "--eval", host, "--", cpuPlan.grant];
  const worker = ["set -gx HOST_CPU39_STARTED_MS (command date +%s%3N); or exit 73", "test (pwd -P) = " + quoteFish(cpuPlan.root) + "; or exit 73",
    "set -l evidence " + quoteFish(cpuPlan.evidence), 'command mkdir -- "$evidence"; or exit 73',
    "set -gx MISE_AUTO_INSTALL false", "set -gx MISE_EXEC_AUTO_INSTALL false", "set -gx MISE_TASK_RUN_AUTO_INSTALL false",
    "command " + evalArgv.map(quoteFish).join(" ") + ' < /dev/null > "$evidence/worker.stdout" 2> "$evidence/worker.stderr"'].join("; ");
  const innerArgv = ["timeout", "--signal=TERM", "--kill-after=" + innerKillMs / 1000 + "s", innerTermMs / 1000 + "s", "fish", "--no-config", "-c", worker];
  const parent = ["command " + innerArgv.map(quoteFish).join(" "), "set -l inner_code $status", "if test $inner_code -eq 73; exit $inner_code; end", "set -l code $inner_code", "set -l evidence " + quoteFish(cpuPlan.evidence),
    'for stream in stdout stderr; if not test -f "$evidence/worker.$stream"; set code 1; else if test (command wc -c < "$evidence/worker.$stream") -gt 65536; set code 1; end; end',
    'printf \'%s\\n\' $inner_code > "$evidence/command.exit"; or exit 1',
    'command cat -- "$evidence/worker.stdout"; or set code 1', 'command cat -- "$evidence/worker.stderr" >&2; or set code 1',
    'if test -f "$evidence/receipt.json"; command cat -- "$evidence/receipt.json"; or set code 1; end',
    'printf \'HOST_CPU39_EXIT=%s\\n\' $code; or exit 1', "exit $code"].join("; ");
  const outerArgv = ["timeout", "--signal=KILL", cpuPlan.limits.overallMs / 1000 + "s", "fish", "--no-config", "-c", parent];
  const canonical = "command " + outerArgv.map(quoteFish).join(" ") + "\n";
  const argumentBytes = { eval: assertCpuArgv(evalArgv), worker: assertCpuArgv(innerArgv), parent: assertCpuArgv(outerArgv), canonical: assertCpuArgv(["fish", "--no-config", "-c", canonical]) };
  return { worker, parent, canonical, evalArgv, innerArgv, outerArgv, argumentBytes, innerTermMs, innerKillMs, receiptReserveMs: cpuPlan.limits.receiptReserveMs };
}
export const renderCpuHostCommand = (host: string) => cpuHostScripts(host).canonical;
export function cpuApprovalRequest(bindings: unknown) {
  return { version: "chess-coach.cpu39-host-request.v1", status: "UNAPPROVED", plan: cpuPlan, bindings, grantIsIdentityNotAuthority: true, separateExplicitHumanApprovalRequired: true,
    reviewedPacketCommitPushRequiredBeforeHostCommand: true, requestedOperations: { nativeSourceCopies: 66, nativeSourceCopyMaximumBytes: 2097152, readOnlyRetainedCargoRegistryIndexAndCache: true,
      cargoArchiveUnpackOnlyIntoFreshWritableCargoHome: true, offlineCpuCompilations: 2, completeCpuHarnesses: 16, cpuTests: 39, ownedContainerLifecycle: true, maximumHostAttemptsIncludingPreflight: 1 },
    hostExecutionApproved: false, stagingAndNativeCompilationApproved: false, cargoArchiveUnpackIntoFreshWritableHomeApproved: false, cpuRegressionExecutionApproved: false,
    gpuExecutionAuthorized: false, llvmExecutionAuthorized: false, retainedMutationAuthorized: false, oldGrantsReusable: false, trainingAuthorized: false, publicationAuthorized: false, trainingReady: false };
}

export function cpuSourceDirectory(label: string) {
  requireValue(/^host-cpu-regression-source-[1-9][0-9]?$/.test(label) && label.trim() === label, "BOUNDED_CPU_SOURCE_LABEL_REQUIRED");
  return resolve(cpuPlan.root, "_work/gpu-owner-recovery/runs", label);
}
export function validateCpuSourcePacket(path: string) {
  requireValue(path === cpuSourceDirectory(basename(path)), "FIXED_CPU_SOURCE_PACKET_ROOT_REQUIRED"); return path;
}
export async function verifyCpuSource(label: string) {
  requireValue(Bun.version === "1.4.0" && process.execPath === "/usr/local/bin/bun" && process.cwd() === cpuPlan.root, "CLOSED_PINNED_CPU_SOURCE_VERIFICATION_REQUIRED");
  const directory = cpuSourceDirectory(label);
  await mkdir(directory); await mkdir(directory + "/home"); await mkdir(directory + "/tmp");
  const sources = ["_work/gpu-owner-recovery/qualification/cpu-host-plan.json", "_work/gpu-owner-recovery/qualification/cpu-host.ts", "_work/gpu-owner-recovery/qualification/cpu-host.test.ts",
    ...cpuPlan.existingHelpers.map(row => row.path), cpuPlan.nativeManifestMetadata, "tooling/runtime/qualification.ts", "tooling/runtime/Dockerfile.gpu-qualification", "_work/gpu-owner-recovery/qualification/host-build/plan.json", "_work/gpu-owner-recovery/qualification/tsconfig.json", "tsconfig.json", "package.json", "packages/runtime/tests/gpu-qualification.test.ts"];
  const bindings = await Promise.all(sources.map(async path => ({ path, sha256: digest(await readFile(path)) })));
  const results: unknown[] = [], programs: { path: string; sha256: string; bytes: number }[] = [];
  let failure: string | null = null, sourceChanged = false, programsChanged = false;
  try {
    validatePlan(); cpuManifest(await readFile(cpuPlan.nativeManifestMetadata));
    for (const helper of cpuPlan.existingHelpers) requireValue(bindings.find(row => row.path === helper.path)?.sha256 === helper.sha256, "SOURCE_HELPER_HASH_REQUIRED");
    const { driver, host } = await buildCpuPrograms();
    for (const [name, text] of [["driver.mjs", driver], ["host.mjs", host], ["canonical-host-command.fish", renderCpuHostCommand(host)]]) await writeFile(directory + "/" + name, text!, { flag: "wx" });
    const scripts = cpuHostScripts(host);
    for (const [name, text] of [["worker-body.fish", scripts.worker], ["parent-body.fish", scripts.parent]]) await writeFile(directory + "/" + name, text!, { flag: "wx" });
    await writeJson(directory + "/argument-bounds.json", scripts.argumentBytes);
    programs.push(...await Promise.all(["driver.mjs", "host.mjs", "canonical-host-command.fish", "worker-body.fish", "parent-body.fish", "argument-bounds.json"].map(async name => {
      const bytes = await readFile(directory + "/" + name); return { path: relative(cpuPlan.root, directory + "/" + name), sha256: digest(bytes), bytes: bytes.length };
    })));
    await writeJson(directory + "/plan.json", cpuPlan); await writeJson(directory + "/bindings.json", { sources: bindings, programs }); await writeJson(directory + "/request.json", cpuApprovalRequest({ sources: bindings, programs }));
    const { runBounded: bounded }: { runBounded: typeof runBounded } = await import(pathToFileURL(resolve(cpuPlan.root, cpuPlan.existingHelpers[0]!.path)).href);
    const environment = { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: directory + "/home", TMPDIR: directory + "/tmp", NO_COLOR: "1", CPU_SOURCE_PACKET: directory,
      MISE_AUTO_INSTALL: "false", MISE_EXEC_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false" };
    const fish = "/home/agent/toolchains/linux-amd64/.local/share/mise/installs/github-fish-shell-fish-shell/4.9.3/fish";
    const commands = [
      { id: "unit-and-mock-e2e", argv: ["/usr/local/bin/bun", "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/qualification/cpu-host.test.ts"] },
      { id: "frozen-cpu-contract", argv: ["/usr/local/bin/bun", "--no-env-file", "--no-install", "test", "./packages/runtime/tests/gpu-qualification.test.ts", "--test-name-pattern", "CPU coverage|CPU and GPU artifacts|artifact admission|only compiler artifacts|compiled policy subprocess|CPU runner|capture failure"] },
      { id: "types", argv: ["/usr/local/bin/bun", "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", "_work/gpu-owner-recovery/qualification/tsconfig.json"] },
      { id: "fish-syntax-only", argv: [fish, "--no-config", "--no-execute", directory + "/canonical-host-command.fish"] },
      { id: "fish-worker-syntax-only", argv: [fish, "--no-config", "--no-execute", directory + "/worker-body.fish"] },
      { id: "fish-parent-syntax-only", argv: [fish, "--no-config", "--no-execute", directory + "/parent-body.fish"] },
    ];
    for (const command of commands) {
      const step = directory + "/" + command.id; await mkdir(step); const result = await bounded(command.argv, step, 120000, { cwd: cpuPlan.root, environment });
      const capture = await captureStreams(step); results.push({ ...command, ...result, streams: capture.streams }); requireValue(result.status === "PASS" && result.exitCode === 0 && result.failure === null, "CPU_SOURCE_VERIFICATION_FAILED:" + command.id);
    }
    const mock = JSON.parse(await readFile(directory + "/mock-e2e.json", "utf8")); requireValue(mock.status === "PASS_MOCK_CPU39_ONLY" && mock.actualHostExecuted === false && mock.tests === 39 && mock.harnesses === 16, "PERSISTED_MOCK_CPU39_E2E_REQUIRED");
  } catch (error) { failure = errorText(error); }
  try { sourceChanged = (await Promise.all(bindings.map(async row => digest(await readFile(row.path)) !== row.sha256))).some(Boolean); } catch { sourceChanged = true; }
  try { programsChanged = (await Promise.all(programs.map(async row => { const bytes = await readFile(row.path); return bytes.length !== row.bytes || digest(bytes) !== row.sha256; }))).some(Boolean); } catch { programsChanged = true; }
  const receipt = { version: "chess-coach.cpu39-source.v1", status: failure === null && !sourceChanged && !programsChanged ? "PASS_SOURCE_ONLY" : "FAIL_SOURCE_ONLY", failure, sourceChanged, programsChanged, bindings, programs, results,
    actualHostExecuted: false, cargoInvocations: 0, rustcInvocations: 0, llvmInvocations: 0, dockerInvocations: 0, gpuInvocations: 0, downloadsPerformed: false, compilationPerformed: false,
    mockExecutionOnly: true, hostExecutionApproved: false, trainingReady: false };
  await writeJson(directory + "/receipt.json", receipt); console.log(JSON.stringify({ status: receipt.status, failure, receipt: relative(cpuPlan.root, directory + "/receipt.json"), trainingReady: false }));
  process.exitCode = receipt.status === "PASS_SOURCE_ONLY" ? 0 : 1;
}

if (import.meta.main && Bun.argv[2] === "--verify-source") {
  requireValue(Bun.argv.length === 4, "CLOSED_CPU_SOURCE_ARGUMENTS_REQUIRED"); await verifyCpuSource(Bun.argv[3]!);
}
