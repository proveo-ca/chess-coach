// SPEC: _spec/gpu-feasibility.puml
import { docker, type DockerResult } from "../host-build/build";
import { feasibilitySelectors, requireValue, type FeasibilityPaths, type FeasibilityPlan } from "./plan";

const mount = (source: string, target: string, readonly: boolean) => {
  requireValue(source.startsWith("/") && !source.includes(","), "ABSOLUTE_COMMA_FREE_MOUNT_SOURCE_REQUIRED");
  return `type=bind,source=${source},target=${target}${readonly ? ",readonly" : ""}`;
};
export function feasibilityCreate(p: FeasibilityPlan, paths: FeasibilityPaths, uid: number, gid: number) {
  requireValue(Number.isSafeInteger(uid) && uid >= 0 && Number.isSafeInteger(gid) && gid >= 0, "NUMERIC_OPERATOR_UID_GID_REQUIRED");
  const environment = { NVIDIA_VISIBLE_DEVICES: p.selectedUuid, NVIDIA_DRIVER_CAPABILITIES: "compute,utility", CUDA_VISIBLE_DEVICES: "0",
    CUDA_PATH: "/usr/local/cuda", XDG_DATA_HOME: "/opt/tracel-data", HOME: "/scratch/home", TMPDIR: "/scratch/tmp", CUDA_CACHE_PATH: "/scratch/cuda-cache", XDG_CACHE_HOME: "/scratch/cache", RAYON_NUM_THREADS: "2", RUST_TEST_THREADS: "1" };
  return docker(p, "create", "--pull=never", "--platform=linux/amd64", "--network=none", "--cpus=2", "--memory=8g", "--memory-swap=8g", "--user=" + uid + ":" + gid,
    "--runtime=nvidia", "--gpus=device=" + p.selectedUuid, "--cidfile=" + paths.evidence + "/worker.cid", "--label=chess-coach.gpu-feasibility=" + p.runId,
    "--workdir=/build/native", "--entrypoint=/usr/local/bin/bun",
    ...[[paths.native, "/build/native", true], [paths.target, "/build/native/target-gpu", true], [paths.bun, "/usr/local/bin/bun", true],
      [paths.context + "/gpu-build/llvm", "/opt/tracel-data/tracel/tracel-llvm-23.1.0-4", true],
      [paths.context + "/gpu-runtime/rootfs/usr/local/cuda", "/usr/local/cuda", true], [paths.evidence, "/evidence", true],
      [paths.inner, "/evidence/inner", false], [paths.runs, "/build/native/_work/gpu-owner-recovery/runs", false], [paths.scratch, "/scratch", false]]
      .flatMap(([source, target, ro]) => ["--mount", mount(source as string, target as string, ro as boolean)]),
    ...Object.entries(environment).flatMap(([key, value]) => ["--env", key + "=" + value]), p.rustImage, "--no-env-file", "--no-install", "/evidence/driver.mjs");
}

export function acceptInner(p: FeasibilityPlan, inner: any) {
  requireValue(inner?.status === "PASS_GPU_FEASIBILITY_TESTS_ONLY" && inner.failure === null && inner.sourceStabilityChecked === true
    && inner.sourceChanged === false && inner.sourceManifestSha256 === p.sourceManifestSha256, "SUCCESSFUL_SOURCE_BOUND_FEASIBILITY_RECEIPT_REQUIRED");
  requireValue(Array.isArray(inner.results) && inner.results.length === 2 && Array.isArray(inner.qualificationResults) && inner.qualificationResults.length === 2
    && Array.isArray(inner.artifacts) && inner.artifacts.length === 5, "COMPLETE_FEASIBILITY_PAIR_AND_ARTIFACTS_REQUIRED");
  for (const [i, id] of feasibilitySelectors.entries()) {
    const attempt = inner.results[i], result = inner.qualificationResults[i];
    requireValue(attempt.id === id && attempt.attempted === true && attempt.status === "PASS" && attempt.exitCode === 0 && attempt.failure === null
      && result.id === id && result.accepted === true && result.status === "PASS" && result.exitCode === 0 && result.failure === null, "EXACT_ACCEPTED_FEASIBILITY_TEST_REQUIRED");
    requireValue(JSON.stringify(attempt.argv) === JSON.stringify([p.artifacts[1]!.executable, id, "--exact", "--ignored", "--test-threads=1", "--nocapture", "--color=never"]), "UNCHANGED_EXACT_TEST_ARGUMENTS_REQUIRED");
  }
  for (const artifact of p.artifacts) requireValue(inner.artifacts.some((row: any) => (row.executable ?? row.path) === artifact.executable && row.bytes === artifact.bytes && row.sha256 === artifact.sha256), "ADMITTED_ARTIFACT_BINDING_REQUIRED");
  requireValue(inner.trainingReady === false, "FEASIBILITY_IS_NOT_TRAINING_READINESS");
}

export type FeasibilityIO = {
  now(): number; startedAt?: number;
  run(id: string, argv: string[], ms: number): Promise<DockerResult & { supervisorResult?: Omit<DockerResult, "stdout">; captureFailures?: string[] }>;
  recover(): Promise<string | null>; innerReceipt(): Promise<any>;
  watch(abort: (reason: string) => Promise<void>): { close(): Promise<{ guardComplete: boolean }> };
};
export async function executeFeasibilityHost(p: FeasibilityPlan, paths: FeasibilityPaths, uid: number, gid: number, io: FeasibilityIO) {
  const started = io.startedAt ?? io.now(), normal = started + p.limits.normalOperationsMs, cleanup = started + p.limits.overallMs - p.limits.receiptReserveMs;
  const results: any[] = [], cleanupFailures: string[] = [], used = new Set<string>();
  let worker: string | null = null, failure: string | null = null, inner: any = null, state: any = null, startPending = false, inspected = false, startAttempted = false;
  let stopping: Promise<void> | null = null, guardComplete = false, monitor: ReturnType<FeasibilityIO["watch"]> | null = null;
  const operation = async (id: string, argv: string[], maxMs: number, final = false) => {
    requireValue(final || failure === null, failure ?? "FEASIBILITY_INTERRUPTED");
    requireValue(!used.has(id) && used.size < 7, "CLOSED_DOCKER_OPERATION_BUDGET");
    const phaseDeadline = final ? cleanup : normal, ms = Math.floor(Math.min(maxMs, phaseDeadline - io.now()));
    requireValue(ms > 0, "HOST_FEASIBILITY_DEADLINE");
    used.add(id); const entry: any = { id, argv, timeoutMs: ms, status: "STARTED" }; results.push(entry);
    try {
      const out = await io.run(id, argv, ms), { stdout, ...record } = out;
      Object.assign(entry, record, { supervisorResult: out.supervisorResult ?? { status: out.status, exitCode: out.exitCode, failure: out.failure } });
      requireValue(out.status === "PASS" && out.exitCode === 0 && out.failure === null, "DOCKER_OPERATION_FAILED:" + id);
      requireValue(io.now() < phaseDeadline, "HOST_FEASIBILITY_PHASE_DEADLINE:" + id);
      return stdout.trim();
    } catch (error) {
      entry.operationFailure = error instanceof Error ? error.message : "DOCKER_OPERATION_FAILED"; entry.status = "FAIL";
      if (!Object.hasOwn(entry, "exitCode")) entry.failure = entry.operationFailure;
      throw error;
    }
  };
  const recover = async () => {
    const value = await io.recover();
    if (value !== null) { requireValue(typeof value === "string" && /^[a-f0-9]{64}$/.test(value) && (worker === null || worker === value), "OWNED_CONTAINER_ID_REQUIRED"); worker = value; }
  };
  const stop = () => {
    if (!worker) return Promise.resolve();
    return stopping ??= (async () => {
      try { await operation("worker-stop", docker(p, "stop", "--time=2", worker!), 10000, true); }
      catch (error) {
        cleanupFailures.push(String(error));
        try { await operation("worker-kill", docker(p, "kill", "--signal=KILL", worker!), 10000, true); }
        catch (error) { cleanupFailures.push(String(error)); }
      }
    })();
  };
  const inspect = async (final: boolean) => {
    inspected = true; state = JSON.parse(await operation("worker-state", docker(p, "container", "inspect", "--format", "{{json .State}}", worker!), 10000, final));
    requireValue(state?.Running === false && state.ExitCode === 0 && state.OOMKilled === false, "SUCCESSFUL_TERMINAL_CONTAINER_STATE_REQUIRED");
  };
  try {
    monitor = io.watch(async reason => { failure ??= reason; if (!startPending) await stop(); });
    await operation("worker-create", feasibilityCreate(p, paths, uid, gid), p.limits.dockerCommandMs);
    await recover(); requireValue(worker, "OWNED_WORKER_ID_REQUIRED");
    requireValue(failure === null, failure ?? "FEASIBILITY_INTERRUPTED");
    startPending = true; startAttempted = true;
    try { await operation("worker-start", docker(p, "start", worker!), p.limits.dockerCommandMs); } finally { startPending = false; }
    requireValue(failure === null, failure ?? "FEASIBILITY_INTERRUPTED");
    await operation("worker-logs", docker(p, "logs", "--follow", worker!), p.limits.nativeWorkMs);
    requireValue(failure === null, failure ?? "FEASIBILITY_INTERRUPTED");
    inner = await io.innerReceipt(); acceptInner(p, inner);
    await inspect(false);
    requireValue(io.now() < normal, "HOST_FEASIBILITY_NORMAL_DEADLINE");
  } catch (error) { failure ??= error instanceof Error ? error.message : "HOST_FEASIBILITY_FAILED"; }
  finally {
    try { if (monitor) guardComplete = (await monitor.close()).guardComplete; } catch (error) { failure ??= String(error); }
    if (failure === null && !guardComplete) failure = "COMPLETE_GUARD_JOURNAL_REQUIRED";
    if (stopping) await stopping;
    try { await recover(); } catch (error) { cleanupFailures.push(String(error)); }
    if (worker) {
      if (failure !== null) await stop();
      if (!inspected) { try { await inspect(true); } catch (error) { failure ??= String(error); await stop(); } }
    }
    inner ??= await io.innerReceipt().catch(() => null);
    if (worker) { try { await operation("worker-remove", docker(p, "rm", worker), 15000, true); } catch (error) { cleanupFailures.push(String(error)); } }
  }
  return { version: "chess-coach.owned-gpu-feasibility.v1", status: failure === null && cleanupFailures.length === 0 ? "PASS_HOST_GPU_FEASIBILITY_ONLY" : "FAIL_HOST_GPU_FEASIBILITY_ONLY",
    failure, cleanupFailures, ids: { worker }, state, innerReceipt: inner, guardComplete, results, elapsedMs: io.now() - started,
    gpuExecutionAttempted: startAttempted, testsExecuted: Array.isArray(inner?.results) ? inner.results.some((r: any) => r !== null && typeof r === "object" && r.attempted === true) : null,
    hostInvocationsConsumed: 1, remainingHostInvocations: 0, automaticRetryAuthorized: false, trainingReady: false,
    qualificationImageBuilt: false, fullAssuranceQualified: false, operationalTelemetryQualified: false, trainingExecuted: false };
}
