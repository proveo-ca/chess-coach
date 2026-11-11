// SPEC: _spec/gpu-full-qualification.puml
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, open, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { CommandResult } from "../../verify";
import { digest, fullSelectors, fullSteps, requireValue, type FullPlan } from "./plan";
import { makeProgressGuard, telemetryArgv } from "../host-feasibility/guard";
import type { AcceptedSample } from "../host-feasibility/guard";

type Qualification = Pick<typeof import("../../../../tooling/runtime/qualification"),
  "readArtifacts" | "qualificationPlan" | "executeQualification" | "recordAttempt" | "sourceInventory" | "testPassed">;
type Inventory = Awaited<ReturnType<Qualification["sourceInventory"]>>;
export type DriverEvent = {
  version: "chess-coach.gpu-full-event.v1";
  runId: string;
  sequence: number;
  kind: "guard-start" | "sample" | "attempt-start" | "attempt-finish" | "abort" | "done";
  [field: string]: unknown;
};
export type StreamMetadata = { path: string; bytes: number; sha256: string };
type Attempt = Parameters<Qualification["recordAttempt"]>[0][number] & {
  commandResult?: CommandResult; captureFailures?: string[]; captureDirectory?: string; commandInvoked?: boolean;
};
type QueryAttempt = Attempt & { query: number; queryStartedMs: number };
type QualificationResult = { id: string; status: string; exitCode: number; failure: string | null; stdoutSummaries: string[]; accepted: boolean };
export type FullDriverIO = {
  now(): number;
  budgetMs: number;
  readFile(path: string): Promise<Uint8Array>;
  hashExecutable(path: string, expectedBytes: number, check: () => void): Promise<{ bytes: number; sha256: string }>;
  loadQualification(): Promise<Qualification>;
  createCaptureDirectory(path: string): Promise<void>;
  runCommand(argv: string[], directory: string, timeoutMs: number, environment: Record<string, string>): Promise<CommandResult>;
  readCapture(path: string): Promise<Uint8Array>;
  appendJournal(line: string): Promise<void>;
  schedule(delayMs: number, callback: () => void): () => void;
  inheritedLdLibraryPath?: string;
};

export function fullEnvironment(p: FullPlan, inheritedLdLibraryPath?: string): Record<string, string> {
  return { HOME: "/scratch/home", TMPDIR: "/scratch/tmp", CUDA_CACHE_PATH: "/scratch/cuda-cache", XDG_CACHE_HOME: "/scratch/cache",
    XDG_DATA_HOME: "/opt/tracel-data", CUDA_PATH: "/usr/local/cuda", CUDA_VISIBLE_DEVICES: "0", NVIDIA_VISIBLE_DEVICES: p.selectedUuid,
    RAYON_NUM_THREADS: "2", RUST_TEST_THREADS: "1", PATH: "/usr/local/nvidia/bin:/usr/local/bin:/usr/bin:/bin",
    LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC", ...(inheritedLdLibraryPath === undefined ? {} : { LD_LIBRARY_PATH: inheritedLdLibraryPath }) };
}

export async function executeFull(p: FullPlan, io: FullDriverIO) {
  const startedAtMs = io.now(), driverDeadline = startedAtMs + Math.min(p.limits.nativeWorkMs, io.budgetMs);
  const preflightDeadline = Math.min(driverDeadline, startedAtMs + p.limits.preflightMs);
  let phaseDeadline = driverDeadline;
  const guard = makeProgressGuard(p, io.now), environment = fullEnvironment(p, io.inheritedLdLibraryPath);
  const captureDirectory = `/build/native/_work/gpu-owner-recovery/runs/${p.runId}`;
  const results: Attempt[] = [], qualificationResults: QualificationResult[] = [], queries: QueryAttempt[] = [], samples: AcceptedSample[] = [];
  const artifacts: { path: string; executable: string; bytes: number; sha256: string }[] = [];
  let expectedArgv: string[][] = [], campaignAccepted = false;
  let failure: string | null = null, sourceManifestSha256: string | null = null, sourceChanged: boolean | null = null;
  let sourceStabilityChecked = false, sourceCheckFailure: string | null = null, inventory: Inventory | null = null, qualification: Qualification | null = null;
  let journalTail = Promise.resolve(), sequence = 0, journalBytes = 0, journalEvents = 0, journalWriteFailed = false;
  const journalHash = createHash("sha256");
  let abortScheduled = false, running = false, cancelTimer: (() => void) | null = null, pendingQuery: Promise<void> | null = null;
  const checkDeadline = (deadline = phaseDeadline) => {
    requireValue(Number.isFinite(io.budgetMs) && io.budgetMs > 0 && Number.isFinite(io.now()) && io.now() < deadline, "DRIVER_DEADLINE");
  };
  const exactSixAccepted = () => results.length === 6 && qualificationResults.length === 6 && expectedArgv.length === 6
    && fullSelectors.every((id, index) => {
      const attempt = results[index]!, result = qualificationResults[index]!;
      return attempt.id === id && attempt.attempted === true && attempt.commandInvoked === true && JSON.stringify(attempt.argv) === JSON.stringify(expectedArgv[index])
        && attempt.status === "PASS" && attempt.exitCode === 0 && attempt.failure === null
        && attempt.commandResult?.status === "PASS" && attempt.commandResult.exitCode === 0 && attempt.commandResult.failure === null
        && attempt.streams?.length === 2 && attempt.captureFailures?.length === 0
        && result.id === id && result.status === "PASS" && result.exitCode === 0 && result.failure === null && result.accepted
        && result.stdoutSummaries.length === 1 && /^test result: ok\. 1 passed; 0 failed; 0 ignored;[^\r\n]*$/.test(result.stdoutSummaries[0]!);
    });
  const emit = (kind: DriverEvent["kind"], fields: Record<string, unknown> = {}) => {
    const task = journalTail.then(async () => {
      const event: DriverEvent = { ...fields, version: "chess-coach.gpu-full-event.v1", runId: p.runId, sequence: ++sequence, kind };
      const line = JSON.stringify(event) + "\n", bytes = Buffer.byteLength(line);
      requireValue(journalBytes + bytes <= p.limits.journalBytes, "JOURNAL_BYTE_BOUND");
      journalBytes += bytes;
      await io.appendJournal(line);
      journalHash.update(line); journalEvents++;
    });
    journalTail = task.catch(error => { journalWriteFailed = true; failure ??= String(error); guard.latch(failure); });
    return task;
  };
  const abort = async (reason: string) => {
    failure ??= reason;
    guard.latch(failure);
    running = false;
    cancelTimer?.(); cancelTimer = null;
    if (!abortScheduled) {
      abortScheduled = true;
      try { await emit("abort", { reason: failure }); } catch {}
    }
  };
  const ensureActive = () => { if (failure) throw Error(failure); checkDeadline(); guard.check(); };
  const checkedRead = async (path: string, deadline = preflightDeadline) => {
    checkDeadline(deadline); const bytes = await io.readFile(path); checkDeadline(deadline); return bytes;
  };
  const capture = async (attempt: Attempt, directory: string) => {
    const streams: StreamMetadata[] = [], failures: string[] = [];
    let stdout = "";
    for (const name of ["stdout", "stderr"]) {
      const path = `${directory}/command.${name}`;
      try {
        const bytes = await io.readCapture(path);
        requireValue(bytes.byteLength <= 4194304, "COMMAND_OUTPUT_BOUND");
        streams.push({ path, bytes: bytes.byteLength, sha256: digest(bytes) });
        if (name === "stdout") stdout = Buffer.from(bytes).toString("utf8");
      } catch (error) { failures.push(String(error)); }
    }
    attempt.streams = streams;
    attempt.captureFailures = failures;
    if (failures.length) throw Error(failures.join(";"));
    return { streams, stdout };
  };
  const arm = () => {
    cancelTimer?.(); cancelTimer = null;
    if (!running || failure) return;
    const state = guard.snapshot(), now = io.now();
    const due = [phaseDeadline];
    if (state.sample) due.push(state.sample.queryStartedAtMs + p.guard.maxSampleAgeMs);
    if (state.pending) due.push(state.pending.queryStartedAtMs + p.guard.queryTimeoutMs + 1);
    else due.push(state.lastQueryStartedAtMs === null ? now : state.lastQueryStartedAtMs + p.guard.sampleIntervalMs);
    cancelTimer = io.schedule(Math.max(1, Math.min(...due) - now), () => {
      cancelTimer = null;
      try {
        ensureActive();
        if (!pendingQuery) startQuery();
        arm();
      } catch (error) { void abort(String(error)); }
    });
  };
  const startQuery = () => {
    const query = guard.startQuery();
    const id = `telemetry-${String(query.query).padStart(4, "0")}`, directory = `${captureDirectory}/${id}`;
    const attempt: QueryAttempt = { id, argv: telemetryArgv(p), timeoutMs: p.guard.queryTimeoutMs, attempted: true, status: "STARTED",
      query: query.query, queryStartedMs: query.queryStartedAtMs, captureDirectory: directory };
    queries.push(attempt);
    pendingQuery = (async () => {
      try {
        await io.createCaptureDirectory(directory);
        ensureActive();
        const result = await io.runCommand(attempt.argv, directory, Math.min(p.guard.queryTimeoutMs, driverDeadline - io.now()), environment);
        attempt.commandResult = result; Object.assign(attempt, result);
        const captured = await capture(attempt, directory);
        ensureActive();
        requireValue(result.status === "PASS" && result.exitCode === 0 && result.failure === null, result.failure ?? "TELEMETRY_QUERY_FAILED");
        const sample = guard.accept(captured.stdout);
        await emit("sample", { uuid: sample.uuid, freeBytes: sample.freeBytes, totalBytes: sample.totalBytes,
          queryStartedMs: sample.queryStartedAtMs, query: sample.query });
        samples.push(sample);
      } catch (error) {
        attempt.status = "FAIL"; attempt.failure = attempt.commandResult?.failure ?? String(error);
        const aborted = abort(String(error));
        if (!attempt.streams) { try { await capture(attempt, directory); } catch {} }
        await aborted;
      }
    })().finally(() => { pendingQuery = null; arm(); });
    arm();
  };
  const drainGuard = async () => {
    running = false; cancelTimer?.(); cancelTimer = null;
    if (pendingQuery) await pendingQuery;
    await journalTail;
    if (!failure && guard.snapshot().sample) ensureActive();
  };
  try {
    checkDeadline(preflightDeadline);
    requireValue(p.runId === "host-gpu-full-1" && p.grant === "--approved-host-gpu-full-1"
      && p.selectedUuid === "GPU-713c95e0-6952-a576-794b-9ef1fb527ff0", "FIXED_FULL_CONTEXT_REQUIRED");
    requireValue(fullSelectors.length === 6 && JSON.stringify(fullSelectors) === JSON.stringify([
      "cuda_f64_nonzero_native_scores_round_trip", "cuda_f64_direct_sgd_changes_policy_parameters",
      "cuda_feature_complete_sweep_for_active_relu_checks_2335_coordinates", "cuda_feature_complete_sweep_for_inactive_relu_checks_2335_coordinates",
      "cuda_f64_redundant_learning_channels_agree_and_reload", "cuda_f64_policy_channel_subprocesses_agree_and_reload",
    ]), "EXACT_FULL_SELECTORS_REQUIRED");
    requireValue(p.testLoop.perTestMs === 120000 && p.testLoop.totalMs === 750000 && p.testLoop.cleanupReserveMs === 30000, "FIXED_FULL_TEST_LOOP_REQUIRED");
    requireValue(p.artifacts.length === 5 && new Set(p.artifacts.map(entry => entry.executable)).size === 5, "FIVE_DISTINCT_ARTIFACTS_REQUIRED");
    for (const binding of p.artifacts) {
      requireValue(binding.executable.startsWith("/build/native/target-gpu/x86_64-unknown-linux-gnu/release/")
        && resolve(binding.executable) === binding.executable && Number.isSafeInteger(binding.bytes) && binding.bytes > 0 && /^[a-f0-9]{64}$/.test(binding.sha256), "ARTIFACT_BINDING_REQUIRED");
      const actual = await io.hashExecutable(binding.executable, binding.bytes, () => checkDeadline(preflightDeadline));
      checkDeadline(preflightDeadline);
      requireValue(actual.bytes === binding.bytes && actual.sha256 === binding.sha256, "ARTIFACT_SIZE_SHA256_MISMATCH");
      artifacts.push({ path: binding.executable, executable: binding.executable, ...actual });
    }
    const sourceBytes = await checkedRead("/build/native/qualification/source-manifest.json");
    sourceManifestSha256 = digest(sourceBytes);
    requireValue(sourceManifestSha256 === p.sourceManifestSha256 && sourceManifestSha256 === "7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec", "SOURCE_MANIFEST_SHA256_MISMATCH");
    const manifest: Inventory = JSON.parse(Buffer.from(sourceBytes).toString("utf8"));
    requireValue(Array.isArray(manifest) && manifest.length === 65 && manifest.every(entry => typeof entry.path === "string"
      && !entry.path.startsWith("/") && !entry.path.split("/").some(part => part === "..") && /^[a-f0-9]{64}$/.test(entry.sha256))
      && new Set(manifest.map(entry => entry.path)).size === 65, "FULL_65_SOURCE_MANIFEST_REQUIRED");
    requireValue(p.existingHelpers.length === 2 && ["_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/command-supervisor.ts"]
      .every(path => p.existingHelpers.some(helper => helper.path === path)), "ORIGINAL_HELPER_BINDINGS_REQUIRED");
    for (const helper of p.existingHelpers) requireValue(digest(await checkedRead(`/build/native/${helper.path}`)) === helper.sha256, "ORIGINAL_HELPER_SHA256_MISMATCH");
    const qualificationBinding = manifest.find(entry => entry.path === "tooling/runtime/qualification.ts");
    requireValue(qualificationBinding && digest(await checkedRead("/build/native/tooling/runtime/qualification.ts")) === qualificationBinding.sha256, "FROZEN_QUALIFICATION_SHA256_MISMATCH");
    qualification = await io.loadQualification(); checkDeadline(preflightDeadline);
    const before = await qualification.sourceInventory("/build/native"); checkDeadline(preflightDeadline);
    requireValue(JSON.stringify(before) === JSON.stringify(manifest), "SOURCE_GENERATION_MISMATCH");
    inventory = before;
    const selected = qualification.readArtifacts({ learning: Buffer.from(await checkedRead("/build/native/qualification/gpu-learning.stdout")).toString("utf8"),
      "policy-io": Buffer.from(await checkedRead("/build/native/qualification/gpu-policy.stdout")).toString("utf8") }, "gpu");
    const parsedPaths = [...selected.artifacts.values()].map(entry => entry.executable).concat([...selected.binaries.values()]);
    requireValue(parsedPaths.length === 5 && new Set(parsedPaths).size === 5 && p.artifacts.every(entry => parsedPaths.includes(entry.executable)), "FIVE_PARSED_ARTIFACT_PATHS_REQUIRED");
    const learning = selected.artifacts.get("learning:test:finite_difference"), policy = selected.artifacts.get("policy-io:test:gpu");
    requireValue(selected.artifacts.size === 2 && learning?.count === 1 && policy?.count === 1 && learning.executable !== policy.executable, "EXACT_FULL_HARNESSES_REQUIRED");
    const executables = [policy.executable, policy.executable, learning.executable, learning.executable, policy.executable, policy.executable];
    const boundSteps = fullSteps(p);
    const steps = qualification.qualificationPlan("gpu", "full", selected.artifacts);
    requireValue(steps.length === 6 && steps.every((step, index) => step.count === 1 && step.id === fullSelectors[index]
      && step.selector === step.id && step.executable === executables[index] && step.executable === boundSteps[index]!.executable
      && p.artifacts.some(binding => binding.executable === step.executable)), "EXACT_FULL_SELECTOR_EXECUTABLE_MAPPING_REQUIRED");
    expectedArgv = fullSelectors.map((id, index) => [executables[index]!, id, "--exact", "--ignored", "--test-threads=1", "--nocapture", "--color=never"]);
    checkDeadline(preflightDeadline);
    await emit("guard-start"); ensureActive();
    running = true; startQuery();
    await pendingQuery;
    ensureActive();
    requireValue(samples.length === 1, "INITIAL_TELEMETRY_SAMPLE_REQUIRED");
    const outcome = await qualification.executeQualification(steps, p.testLoop, { now: io.now, run: async (step, argv, timeoutMs) => {
      ensureActive();
      const index = results.length, expected = steps[index];
      requireValue(index < 6 && expected && step.id === fullSelectors[index] && step.selector === step.id && step.count === 1
        && step.executable === expected.executable && JSON.stringify(argv) === JSON.stringify(expectedArgv[index]), "EXACT_FULL_ATTEMPT_ARGV_REQUIRED");
      requireValue(Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= p.testLoop.perTestMs, "FULL_ATTEMPT_TIMEOUT_REQUIRED");
      const directory = `${captureDirectory}/${step.id}`;
      let primary: CommandResult | undefined;
      let result: { status: string; exitCode: number; failure: string | null; stdout: string };
      try {
        result = await qualification!.recordAttempt(results, step.id, argv, Math.min(timeoutMs, driverDeadline - io.now()), {
          execute: async () => {
            results[index]!.commandInvoked = false;
            results[index]!.captureDirectory = directory;
            await emit("attempt-start", { id: step.id }); ensureActive();
            await io.createCaptureDirectory(directory); ensureActive();
            results[index]!.commandInvoked = true;
            primary = await io.runCommand(argv, directory, Math.min(timeoutMs, driverDeadline - io.now()), environment);
            results[index]!.commandResult = primary;
            return primary;
          },
          capture: () => capture(results[index]!, directory),
        });
      } catch (error) {
        if (results[index]) {
          results[index]!.captureDirectory = directory;
          if (!results[index]!.streams) { try { await capture(results[index]!, directory); } catch {} }
          if (primary?.failure) results[index]!.failure = primary.failure;
          await emit("attempt-finish", { id: step.id, status: "FAIL", accepted: false, failure: results[index]!.failure ?? String(error) });
        }
        throw error;
      }
      const stdoutSummaries = [...result.stdout.matchAll(/^test result:.*$/gm)].slice(0, 2).map(match => match[0].slice(0, 512));
      qualificationResults.push({ id: step.id, status: result.status, exitCode: result.exitCode, failure: result.failure, stdoutSummaries,
        accepted: qualification!.testPassed(result, 1) && stdoutSummaries.length === 1
          && /^test result: ok\. 1 passed; 0 failed; 0 ignored;[^\r\n]*$/.test(stdoutSummaries[0]!) });
      await emit("attempt-finish", { id: step.id, status: result.status, accepted: qualificationResults.at(-1)!.accepted });
      ensureActive();
      requireValue(qualificationResults.at(-1)!.accepted, "FULL_TEST_NOT_ACCEPTED:" + step.id);
      return result;
    } });
    requireValue(outcome.status === "PASS_TESTS_ONLY" && outcome.results.length === 6
      && outcome.results.every((result, index) => result.id === fullSelectors[index] && result.accepted && qualification!.testPassed(result, 1))
      && exactSixAccepted(), "EXACT_FULL_SIX_NOT_ACCEPTED");
    campaignAccepted = true;
  } catch (error) { await abort(String(error)); }
  const finalizationDeadline = Math.min(driverDeadline, io.now() + p.limits.driverFinalizationMs);
  phaseDeadline = finalizationDeadline;
  arm();
  if (inventory && qualification) {
    try {
      checkDeadline(finalizationDeadline);
      const after = await qualification.sourceInventory("/build/native");
      checkDeadline(finalizationDeadline);
      sourceChanged = JSON.stringify(after) !== JSON.stringify(inventory);
      sourceStabilityChecked = true;
      requireValue(!sourceChanged, "SOURCE_CHANGED_DURING_FULL");
    } catch (error) { sourceCheckFailure = String(error); await abort(sourceCheckFailure); }
  }
  try { checkDeadline(finalizationDeadline); await drainGuard(); checkDeadline(finalizationDeadline); } catch (error) { await abort(String(error)); }
  if (!sourceStabilityChecked || sourceChanged !== false) await abort(sourceCheckFailure ?? "SOURCE_STABILITY_UNCHECKED");
  if (!failure) {
    try {
      requireValue(campaignAccepted && exactSixAccepted(), "EXACT_FULL_SIX_NOT_ACCEPTED");
      checkDeadline(finalizationDeadline);
      await emit("done");
      checkDeadline(finalizationDeadline);
    } catch (error) { await abort(String(error)); }
  }
  await journalTail;
  return { version: "chess-coach.gpu-full-driver.v1", runId: p.runId,
    status: failure === null ? "PASS_GPU_FULL_TESTS_ONLY" : "FAIL_GPU_FULL_TESTS_ONLY", failure: failure as string | null,
    sourceStabilityChecked, sourceChanged, sourceCheckFailure, sourceManifestSha256, artifacts, results, qualificationResults,
    telemetry: { samples, queries, events: { path: "/evidence/inner/events.ndjson", bytes: journalWriteFailed ? null : journalBytes,
      sha256: journalWriteFailed ? null : journalHash.digest("hex"), attemptedBytes: journalBytes, writeFailed: journalWriteFailed, count: journalEvents, lastSequence: sequence } },
    testLoopLimits: p.testLoop, elapsedMs: io.now() - startedAtMs, campaignInvocationsConsumed: queries.length ? 1 : 0,
    remainingCampaignInvocations: 0, automaticRetryAuthorized: false, outputBytesPerStreamLimit: 4194304,
    trainingReady: false, canonicalBothQualified: false, integratedR4Qualified: false, operationalTelemetryQualified: false,
    fullAssuranceQualified: false, trainingExecuted: false };
}
export type FullDriverReceipt = Awaited<ReturnType<typeof executeFull>>;

export async function runFullDriver(p: FullPlan): Promise<void> {
  const adapterStartedAtMs = performance.now();
  process.exitCode = 1;
  requireValue(Bun.version === "1.4.0" && process.cwd() === "/build/native", "PINNED_ORIGINAL_CONTAINER_CONTEXT_REQUIRED");
  const deadline = JSON.parse(await readFile("/evidence/deadline.json", "utf8"));
  requireValue(Number.isFinite(deadline.normalDeadlineEpoch), "HOST_NORMAL_DEADLINE_REQUIRED");
  const budgetMs = Math.min(p.limits.nativeWorkMs, deadline.normalDeadlineEpoch - Date.now() - 20000);
  requireValue(budgetMs > 0, "HOST_NORMAL_BUDGET_EXHAUSTED");
  const captureDirectory = `/build/native/_work/gpu-owner-recovery/runs/${p.runId}`;
  requireValue(p.runId === "host-gpu-full-1" && p.grant === "--approved-host-gpu-full-1", "FIXED_FULL_CONTEXT_REQUIRED");
  await mkdir(captureDirectory, { mode: 0o700 });
  for (const path of ["/scratch/home", "/scratch/tmp", "/scratch/cuda-cache", "/scratch/cache"]) await mkdir(path, { recursive: true, mode: 0o700 });
  const journal = await open("/evidence/inner/events.ndjson", "ax", 0o600);
  try {
    const receipt = await executeFull(p, {
      now: () => performance.now(), budgetMs: Math.min(budgetMs - (performance.now() - adapterStartedAtMs), deadline.normalDeadlineEpoch - Date.now() - 20000), readFile,
      async hashExecutable(path, expectedBytes, check) {
        check(); const metadata = await stat(path); check();
        requireValue(metadata.isFile() && metadata.size === expectedBytes, "ARTIFACT_SIZE_MISMATCH");
        await access(path, constants.X_OK); check();
        const file = await open(path, "r"), hash = createHash("sha256"), chunk = Buffer.alloc(65536);
        let bytes = 0;
        try {
          for (;;) {
            check(); const read = await file.read(chunk); check();
            if (read.bytesRead === 0) break;
            bytes += read.bytesRead; requireValue(bytes <= expectedBytes, "ARTIFACT_SIZE_MISMATCH");
            hash.update(chunk.subarray(0, read.bytesRead)); check();
          }
        } finally { await file.close(); }
        check(); return { bytes, sha256: hash.digest("hex") };
      },
      async loadQualification() {
        const originalQualificationPath = "/build/native/tooling/runtime/qualification.ts";
        return await import(pathToFileURL(originalQualificationPath).href);
      },
      createCaptureDirectory: async path => { await mkdir(path, { mode: 0o700 }); },
      async runCommand(argv, directory, timeoutMs, environment) {
        const originalHelperPath = "/build/native/_work/gpu-owner-recovery/verify.ts";
        const { runBounded } = await import(pathToFileURL(originalHelperPath).href);
        return runBounded(argv, directory, timeoutMs, { cwd: "/build/native", environment });
      },
      readCapture: readFile,
      appendJournal: async line => { await journal.writeFile(line); await journal.sync(); },
      schedule(delayMs, callback) { const timer = setTimeout(callback, delayMs); return () => clearTimeout(timer); },
      inheritedLdLibraryPath: process.env.LD_LIBRARY_PATH,
    });
    await journal.close();
    requireValue(performance.now() - adapterStartedAtMs < budgetMs, "DRIVER_RECEIPT_DEADLINE");
    await writeFile("/evidence/inner/receipt.json", JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    requireValue(performance.now() - adapterStartedAtMs < budgetMs, "DRIVER_RECEIPT_DEADLINE");
    process.exitCode = receipt.status === "PASS_GPU_FULL_TESTS_ONLY" ? 0 : 1;
  } catch (error) { try { await journal.close(); } catch {} throw error; }
}
