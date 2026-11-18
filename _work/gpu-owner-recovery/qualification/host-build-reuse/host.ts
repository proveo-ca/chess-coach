// SPEC: _spec/gpu-host-build-reuse.puml
import { docker, type DockerResult } from "../host-build/build";
import type { ReusePaths, ReusePlan } from "./plan";

export type ReuseIO = {
  now(): number; startedAt?: number;
  run(id: string, argv: string[], timeoutMs: number): Promise<DockerResult>;
  recover(): Promise<string | null>;
  nativeReceipt(): Promise<any>;
  artifacts(timeoutMs: number): Promise<unknown[]>;
  watch(stop: (reason: string) => Promise<void>): () => void | Promise<void>;
};
const requireValue = (value: unknown, label: string) => { if (!value) throw Error(label); };
const mount = (source: string, target: string, readonly = false) => {
  requireValue(source.startsWith("/") && !source.includes(","), "ABSOLUTE_COMMA_FREE_MOUNT_SOURCE_REQUIRED");
  return `type=bind,source=${source},target=${target}${readonly ? ",readonly" : ""}`;
};

export function workerCreateReuse(p: ReusePlan, paths: ReusePaths, uid: number, gid: number): string[] {
  requireValue(Number.isSafeInteger(uid) && uid >= 0 && Number.isSafeInteger(gid) && gid >= 0, "NUMERIC_OPERATOR_UID_GID_REQUIRED");
  const environment = { CARGO_HOME: "/capture/cargo-home", CARGO_TARGET_DIR: "/build/native/target-gpu", CARGO_BUILD_JOBS: "2", RAYON_NUM_THREADS: "2", XDG_DATA_HOME: "/opt/tracel-data",
    CUDARC_CUDA_VERSION: p.cudaBindingTrial, CARGO_NET_OFFLINE: "true", CARGO_NET_RETRY: "0", RUSTUP_AUTO_INSTALL: "0", HOME: "/build/native/_work/gpu-owner-recovery/scratch/home", TMPDIR: "/build/native/_work/gpu-owner-recovery/scratch/tmp" };
  return docker(p, "create", "--pull=never", "--platform=linux/amd64", "--network=none", "--cpus=2", "--memory=8g", "--memory-swap=8g", "--user=" + uid + ":" + gid,
    "--cidfile=" + paths.evidence + "/worker.cid", "--label=chess-coach.native-build=" + p.runId, "--workdir=/build/native", "--entrypoint=/usr/local/bin/bun",
    ...[[paths.context, "/received", true], [paths.native, "/build/native", false], [paths.cargo, "/capture/cargo-home", false], [paths.target, "/build/native/target-gpu", false],
      [paths.context + "/gpu-build/llvm", "/opt/tracel-data/tracel/tracel-llvm-23.1.0-4", true], [paths.bun, "/usr/local/bin/bun", true], [paths.evidence, "/evidence", true],
      [paths.evidence + "/native", "/build/native/_work/gpu-owner-recovery/runs/" + p.runId, false]].flatMap(([source, target, ro]) => ["--mount", mount(source as string, target as string, ro as boolean)]),
    ...Object.entries(environment).flatMap(([key, value]) => ["--env", key + "=" + value]), p.rustImage, "--no-env-file", "--no-install", "/evidence/build-driver.mjs");
}

export async function executeReuseBuild(p: ReusePlan, paths: ReusePaths, uid: number, gid: number, io: ReuseIO) {
  const started = io.startedAt ?? io.now(), normalDeadline = started + p.limits.normalOperationsMs, cleanupDeadline = started + p.limits.overallMs - p.limits.receiptReserveMs;
  const results: { id: string; argv: string[]; status: string; exitCode?: number; failure?: string | null; operationFailure?: string; supervisorResult?: Omit<DockerResult, "stdout"> }[] = [], cleanupFailures: string[] = [];
  const ids: { worker: string | null } = { worker: null };
  let failure: string | null = null, native: any = null, state: any = null, artifacts: unknown[] = [], stopPromise: Promise<void> | null = null, startPending = false, stateAttempted = false;
  let unwatch: () => void | Promise<void> = () => {};
  const used = new Set<string>();
  const operation = async (id: string, argv: string[], maximumMs: number, cleanup = false) => {
    requireValue(cleanup || failure === null, failure ?? "HOST_BUILD_INTERRUPTED");
    requireValue(!used.has(id) && used.size < p.maximums.dockerOperations, "CLOSED_DOCKER_OPERATION_BUDGET");
    const ms = Math.floor(Math.min(maximumMs, (cleanup ? cleanupDeadline : normalDeadline) - io.now()));
    requireValue(ms > 0, "HOST_BUILD_DEADLINE");
    used.add(id);
    const entry = { id, argv, status: "STARTED" }; results.push(entry);
    try {
      const out = await io.run(id, argv, ms), { stdout, ...recorded } = out;
      Object.assign(entry, recorded, { supervisorResult: { status: out.status, exitCode: out.exitCode, failure: out.failure } });
      requireValue(out.status === "PASS" && out.exitCode === 0 && out.failure === null, "DOCKER_OPERATION_FAILED:" + id);
      return stdout.trim();
    } catch (error) {
      const operationFailure = error instanceof Error ? error.message : "DOCKER_OPERATION_FAILED";
      Object.assign(entry, { status: "FAIL", operationFailure, ...(!Object.hasOwn(entry, "exitCode") ? { failure: operationFailure } : {}) });
      throw error;
    }
  };
  const recover = async () => {
    try {
      const value = await io.recover();
      if (value !== null) {
        requireValue(typeof value === "string" && /^[a-f0-9]{64}$/.test(value) && (ids.worker === null || ids.worker === value), "OWNED_CONTAINER_ID_REQUIRED");
        ids.worker = value;
      }
    } catch { throw Error("OWNED_CONTAINER_ID_RECOVERY_FAILED"); }
  };
  const stopWorker = () => stopPromise ??= (async () => {
    if (!ids.worker) return;
    try { await operation("worker-stop", docker(p, "stop", "--time=10", ids.worker), 20000, true); }
    catch (error) {
      cleanupFailures.push(String(error));
      try { await operation("worker-kill", docker(p, "kill", "--signal=KILL", ids.worker), 15000, true); }
      catch (killError) { cleanupFailures.push(String(killError)); }
    }
  })();
  const inspect = async (cleanup: boolean) => {
    stateAttempted = true;
    state = JSON.parse(await operation("worker-state", docker(p, "container", "inspect", "--format", "{{json .State}}", ids.worker!), 10000, cleanup));
    requireValue(state?.Running === false && state.ExitCode === 0 && state.OOMKilled === false, "SUCCESSFUL_TERMINAL_CONTAINER_STATE_REQUIRED");
  };
  try {
    unwatch = io.watch(async reason => { failure ??= reason; if (ids.worker && !startPending) await stopWorker(); });
    await operation("worker-create", workerCreateReuse(p, paths, uid, gid), p.limits.dockerCommandMs);
    await recover(); requireValue(ids.worker, "OWNED_WORKER_ID_REQUIRED");
    requireValue(failure === null, failure ?? "HOST_BUILD_INTERRUPTED");
    startPending = true;
    try { await operation("worker-start", docker(p, "start", ids.worker!), p.limits.dockerCommandMs); }
    finally { startPending = false; }
    requireValue(failure === null, failure ?? "HOST_BUILD_INTERRUPTED");
    await operation("worker-logs", docker(p, "logs", "--follow", ids.worker!), p.limits.nativeWorkMs);
    requireValue(failure === null, failure ?? "HOST_BUILD_INTERRUPTED");
    native = await io.nativeReceipt();
    requireValue(native?.status === "PASS_NATIVE_COMPILATION_ONLY" && native.compilationAttempts === 2 && native.sourceChanged === false && native.sourceStabilityChecked === true
      && native.sourceManifestSha256 === p.sourceManifestSha256 && native.previousSourceManifestSha256 === p.previousSourceManifestSha256, "SUCCESSFUL_NATIVE_COMPILATION_RECEIPT_REQUIRED");
    await inspect(false);
    const artifactMs = Math.floor(Math.min(p.limits.artifactValidationMs, normalDeadline - io.now()));
    requireValue(artifactMs > 0, "ARTIFACT_VALIDATION_NORMAL_DEADLINE");
    const rows = await io.artifacts(artifactMs);
    requireValue(rows.length === 5 && io.now() < normalDeadline, "COMPLETE_ARTIFACTS_WITHIN_DEADLINE_REQUIRED");
    requireValue(failure === null, failure ?? "HOST_BUILD_INTERRUPTED");
    artifacts = rows;
  } catch (error) { failure ??= error instanceof Error ? error.message : "HOST_BUILD_FAILED"; }
  finally {
    try { await unwatch(); } catch (error) { failure ??= "WORKSPACE_MONITOR_SHUTDOWN_FAILED:" + String(error); }
    if (stopPromise) await stopPromise;
    try { await recover(); } catch (error) { cleanupFailures.push(String(error)); }
    if (ids.worker) {
      if (failure !== null) await stopWorker();
      if (!stateAttempted) {
        try { await inspect(true); }
        catch (error) { failure ??= error instanceof Error ? error.message : "TERMINAL_BUILD_VALIDATION_FAILED"; await stopWorker(); }
      }
    }
    native ??= await io.nativeReceipt().catch(() => null);
    if (ids.worker) {
      try { await operation("worker-remove", docker(p, "rm", ids.worker), 20000, true); }
      catch (error) { cleanupFailures.push(String(error)); }
    }
  }
  return { version: "chess-coach.owned-container-reused-cache-native-build.v1", status: failure === null && cleanupFailures.length === 0 ? "PASS_HOST_GPU_NATIVE_BUILD_ONLY" : "FAIL_HOST_GPU_NATIVE_BUILD_ONLY",
    failure, cleanupFailures, method: p.method, requestedResources: p.resources, limits: p.limits, ids, state, nativeReceipt: native, artifacts, results, elapsedMs: io.now() - started,
    cachePaths: { bun: paths.bun, cargo: paths.cargo, target: paths.target }, mutableCachePaths: [paths.cargo, paths.target], retainedBunReadOnly: true,
    hostInvocationsConsumed: 1, remainingHostInvocations: 0, automaticRetryAuthorized: false, qualificationImageBuilt: false, testsExecuted: false, gpuDevicesRequested: false, gpuExecuted: false, trainingReady: false };
}
