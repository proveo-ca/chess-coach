// SPEC: _spec/gpu-feasibility.puml
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, open, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { CommandResult } from "../../verify";
import type { FeasibilityPlan } from "./plan";
import { digest, requireValue } from "./plan";
import { makeProgressGuard, telemetryArgv } from "./guard";
import type { AcceptedSample, DriverEvent } from "./guard";

type Qualification = Pick<typeof import("../../../../tooling/runtime/qualification"),
  "readArtifacts" | "qualificationPlan" | "executeQualification" | "recordAttempt" | "sourceInventory" | "testPassed">;
type Inventory = Awaited<ReturnType<Qualification["sourceInventory"]>>;
export type StreamMetadata = { path: string; bytes: number; sha256: string };
type Attempt = Parameters<Qualification["recordAttempt"]>[0][number] & {
  commandResult?: CommandResult; captureFailures?: string[]; captureDirectory?: string;
};
type QueryAttempt = Attempt & { query: number; queryStartedMs: number };
type QualificationResult = { id: string; status: string; exitCode: number; failure: string | null; stdoutSummaries: string[]; accepted: boolean };
export type FeasibilityDriverIO = {
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

export function feasibilityEnvironment(p: FeasibilityPlan, inheritedLdLibraryPath?: string): Record<string, string> {
  return { HOME: "/scratch/home", TMPDIR: "/scratch/tmp", CUDA_CACHE_PATH: "/scratch/cuda-cache", XDG_CACHE_HOME: "/scratch/cache",
    XDG_DATA_HOME: "/opt/tracel-data", CUDA_PATH: "/usr/local/cuda", CUDA_VISIBLE_DEVICES: "0", NVIDIA_VISIBLE_DEVICES: p.selectedUuid,
    RAYON_NUM_THREADS: "2", RUST_TEST_THREADS: "1", PATH: "/usr/local/nvidia/bin:/usr/local/bin:/usr/bin:/bin",
    LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC", ...(inheritedLdLibraryPath === undefined ? {} : { LD_LIBRARY_PATH: inheritedLdLibraryPath }) };
}

export async function executeFeasibility(p: FeasibilityPlan, io: FeasibilityDriverIO) {
  const startedAtMs = io.now(), driverDeadline = startedAtMs + Math.min(p.limits.nativeWorkMs, io.budgetMs);
  const preflightDeadline = Math.min(driverDeadline, startedAtMs + p.limits.preflightMs);
  let phaseDeadline = driverDeadline;
  const guard = makeProgressGuard(p, io.now), environment = feasibilityEnvironment(p, io.inheritedLdLibraryPath);
  const captureDirectory = `/build/native/_work/gpu-owner-recovery/runs/${p.runId}`;
  const results: Attempt[] = [], qualificationResults: QualificationResult[] = [], queries: QueryAttempt[] = [], samples: AcceptedSample[] = [];
  const artifacts: { path: string; executable: string; bytes: number; sha256: string }[] = [];
  let failure: string | null = null, sourceManifestSha256: string | null = null, sourceChanged: boolean | null = null;
  let sourceStabilityChecked = false, sourceCheckFailure: string | null = null, inventory: Inventory | null = null, qualification: Qualification | null = null;
  let journalTail = Promise.resolve(), sequence = 0, journalBytes = 0, journalEvents = 0, journalWriteFailed = false;
  const journalHash = createHash("sha256");
  let abortScheduled = false, running = false, cancelTimer: (() => void) | null = null, pendingQuery: Promise<void> | null = null;
  const checkDeadline = (deadline = phaseDeadline) => {
    requireValue(Number.isFinite(io.budgetMs) && io.budgetMs > 0 && Number.isFinite(io.now()) && io.now() < deadline, "DRIVER_DEADLINE");
  };
  const emit = (kind: DriverEvent["kind"], fields: Record<string, unknown> = {}) => {
    const task = journalTail.then(async () => {
      const event: DriverEvent = { ...fields, version: "chess-coach.gpu-feasibility-event.v1", runId: p.runId, sequence: ++sequence, kind };
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
    requireValue(/^[a-z0-9-]{1,80}$/.test(p.runId) && p.selectedUuid === "GPU-713c95e0-6952-a576-794b-9ef1fb527ff0", "FIXED_FEASIBILITY_CONTEXT_REQUIRED");
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
    const steps = qualification.qualificationPlan("gpu", "feasibility", selected.artifacts);
    requireValue(steps.length === 2 && steps.every((step, index) => step.count === 1 && step.id === ["cuda_f64_nonzero_native_scores_round_trip", "cuda_f64_direct_sgd_changes_policy_parameters"][index]
      && step.selector === step.id), "EXACT_FEASIBILITY_PAIR_REQUIRED");
    checkDeadline(preflightDeadline);
    await emit("guard-start"); ensureActive();
    running = true; startQuery();
    await pendingQuery;
    ensureActive();
    requireValue(samples.length === 1, "INITIAL_TELEMETRY_SAMPLE_REQUIRED");
    const outcome = await qualification.executeQualification(steps, p.testLoop, { now: io.now, run: async (step, argv, timeoutMs) => {
      ensureActive();
      const directory = `${captureDirectory}/${step.id}`;
      await emit("attempt-start", { id: step.id }); ensureActive();
      await io.createCaptureDirectory(directory); ensureActive();
      const index = results.length;
      let primary: CommandResult | undefined;
      let result: { status: string; exitCode: number; failure: string | null; stdout: string };
      try {
        result = await qualification!.recordAttempt(results, step.id, argv, Math.min(timeoutMs, driverDeadline - io.now()), {
          execute: async () => {
            ensureActive();
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
          await emit("attempt-finish", { id: step.id, status: "FAIL", failure: results[index]!.failure ?? String(error) });
        }
        throw error;
      }
      results[index]!.captureDirectory = directory;
      qualificationResults.push({ id: step.id, status: result.status, exitCode: result.exitCode, failure: result.failure,
        stdoutSummaries: [...result.stdout.matchAll(/^test result:.*$/gm)].slice(0, 2).map(match => match[0].slice(0, 512)),
        accepted: qualification!.testPassed(result, 1) });
      await emit("attempt-finish", { id: step.id, status: result.status, accepted: qualificationResults.at(-1)!.accepted });
      ensureActive();
      return result;
    } });
    requireValue(outcome.status === "PASS_TESTS_ONLY" && qualificationResults.length === 2 && qualificationResults.every(result => result.accepted), "EXACT_FEASIBILITY_PAIR_NOT_ACCEPTED");
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
      requireValue(!sourceChanged, "SOURCE_CHANGED_DURING_FEASIBILITY");
    } catch (error) { sourceCheckFailure = String(error); await abort(sourceCheckFailure); }
  }
  try { checkDeadline(finalizationDeadline); await drainGuard(); checkDeadline(finalizationDeadline); } catch (error) { await abort(String(error)); }
  if (!sourceStabilityChecked || sourceChanged !== false) await abort(sourceCheckFailure ?? "SOURCE_STABILITY_UNCHECKED");
  if (!failure) {
    try {
      requireValue(results.length === 2 && qualificationResults.length === 2 && qualificationResults.every(result => result.accepted), "EXACT_FEASIBILITY_PAIR_NOT_ACCEPTED");
      checkDeadline(finalizationDeadline);
      await emit("done");
      checkDeadline(finalizationDeadline);
    } catch (error) { await abort(String(error)); }
  }
  await journalTail;
  return { version: "chess-coach.gpu-feasibility-driver.v1", runId: p.runId,
    status: failure === null ? "PASS_GPU_FEASIBILITY_TESTS_ONLY" : "FAIL_GPU_FEASIBILITY_TESTS_ONLY", failure: failure as string | null,
    sourceStabilityChecked, sourceChanged, sourceCheckFailure, sourceManifestSha256, artifacts, results, qualificationResults,
    telemetry: { samples, queries, events: { path: "/evidence/inner/events.ndjson", bytes: journalWriteFailed ? null : journalBytes,
      sha256: journalWriteFailed ? null : journalHash.digest("hex"), attemptedBytes: journalBytes, writeFailed: journalWriteFailed, count: journalEvents, lastSequence: sequence } },
    testLoopLimits: p.testLoop, elapsedMs: io.now() - startedAtMs, campaignInvocationsConsumed: queries.length ? 1 : 0,
    remainingCampaignInvocations: 0, automaticRetryAuthorized: false, outputBytesPerStreamLimit: 4194304,
    trainingReady: false, canonicalBothQualified: false, integratedR4Qualified: false, operationalTelemetryQualified: false,
    fullAssuranceQualified: false, trainingExecuted: false };
}
export type FeasibilityDriverReceipt = Awaited<ReturnType<typeof executeFeasibility>>;

export async function runFeasibilityDriver(p: FeasibilityPlan): Promise<void> {
  const adapterStartedAtMs = performance.now();
  process.exitCode = 1;
  requireValue(Bun.version === "1.4.0" && process.cwd() === "/build/native", "PINNED_ORIGINAL_CONTAINER_CONTEXT_REQUIRED");
  const deadline = JSON.parse(await readFile("/evidence/deadline.json", "utf8"));
  requireValue(Number.isFinite(deadline.normalDeadlineEpoch), "HOST_NORMAL_DEADLINE_REQUIRED");
  const budgetMs = Math.min(p.limits.nativeWorkMs, deadline.normalDeadlineEpoch - Date.now() - 20000);
  requireValue(budgetMs > 0, "HOST_NORMAL_BUDGET_EXHAUSTED");
  const captureDirectory = `/build/native/_work/gpu-owner-recovery/runs/${p.runId}`;
  requireValue(/^[a-z0-9-]{1,80}$/.test(p.runId), "FRESH_RUN_ID_REQUIRED");
  await mkdir(captureDirectory, { mode: 0o700 });
  for (const path of ["/scratch/home", "/scratch/tmp", "/scratch/cuda-cache", "/scratch/cache"]) await mkdir(path, { recursive: true, mode: 0o700 });
  const journal = await open("/evidence/inner/events.ndjson", "ax", 0o600);
  try {
    const receipt = await executeFeasibility(p, {
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
    process.exitCode = receipt.status === "PASS_GPU_FEASIBILITY_TESTS_ONLY" ? 0 : 1;
  } catch (error) { try { await journal.close(); } catch {} throw error; }
}
