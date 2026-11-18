// SPEC: _spec/gpu-host-build.puml
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, statfs, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type plan from "./plan.json";

type Plan = typeof plan;
export type Paths = { context: string; workspace: string; evidence: string; native: string; cargo: string; bun: string };
export type DockerResult = { status: string; exitCode: number; failure: string | null; stdout: string };
export type BuildIO = { now(): number; startedAt?: number; run(id: string, argv: string[], timeoutMs: number): Promise<DockerResult>; recover(kind: "donor" | "worker"): Promise<string | null>;
  validateBun(): Promise<void>; nativeReceipt(): Promise<any>; artifacts(timeoutMs: number): Promise<unknown[]>; watch(stop: (reason: string) => Promise<void>): () => void | Promise<void> };
const requireValue = (value: unknown, label: string) => { if (!value) throw Error(label); };
export const docker = (p: Plan, ...argv: string[]) => ["docker", "--host=" + p.engine, ...argv];
const mount = (source: string, target: string, readonly = false) => {
  requireValue(source.startsWith("/") && !source.includes(","), "ABSOLUTE_COMMA_FREE_MOUNT_SOURCE_REQUIRED");
  return `type=bind,source=${source},target=${target}${readonly ? ",readonly" : ""}`;
};
export function workerCreate(p: Plan, paths: Paths, uid: number, gid: number) {
  requireValue(Number.isSafeInteger(uid) && uid >= 0 && Number.isSafeInteger(gid) && gid >= 0, "NUMERIC_OPERATOR_UID_GID_REQUIRED");
  const environment = { CARGO_HOME: "/capture/cargo-home", CARGO_TARGET_DIR: "/build/native/target-gpu", CARGO_BUILD_JOBS: "2", RAYON_NUM_THREADS: "2", XDG_DATA_HOME: "/opt/tracel-data",
    CUDARC_CUDA_VERSION: p.cudaBindingTrial, CARGO_NET_OFFLINE: "true", CARGO_NET_RETRY: "0", RUSTUP_AUTO_INSTALL: "0", HOME: "/build/native/_work/gpu-owner-recovery/scratch/home", TMPDIR: "/build/native/_work/gpu-owner-recovery/scratch/tmp" };
  return docker(p, "create", "--pull=never", "--platform=linux/amd64", "--network=none", "--cpus=2", "--memory=8g", "--memory-swap=8g", "--user=" + uid + ":" + gid,
    "--cidfile=" + paths.evidence + "/worker.cid", "--label=chess-coach.native-build=" + p.runId, "--workdir=/build/native", "--entrypoint=/usr/local/bin/bun",
    ...[[paths.context, "/received", true], [paths.native, "/build/native", false], [paths.cargo, "/capture/cargo-home", false],
      [paths.context + "/gpu-build/llvm", "/opt/tracel-data/tracel/tracel-llvm-23.1.0-4", true], [paths.bun, "/usr/local/bin/bun", true], [paths.evidence, "/evidence", true],
      [paths.evidence + "/native", "/build/native/_work/gpu-owner-recovery/runs/" + p.runId, false]].flatMap(([source, target, ro]) => ["--mount", mount(source as string, target as string, ro as boolean)]),
    ...Object.entries(environment).flatMap(([key, value]) => ["--env", key + "=" + value]), p.rustImage, "--no-env-file", "--no-install", "/evidence/build-driver.mjs");
}

export async function executeBuild(p: Plan, paths: Paths, uid: number, gid: number, io: BuildIO) {
  const started = io.startedAt ?? io.now(), normalDeadline = started + p.limits.normalOperationsMs, cleanupDeadline = started + p.limits.overallMs - p.limits.receiptReserveMs;
  const results: { id: string; argv: string[]; status: string; exitCode?: number; failure?: string | null }[] = [], cleanupFailures: string[] = [];
  const ids: { donor: string | null; worker: string | null } = { donor: null, worker: null };
  let failure: string | null = null, native: any = null, state: any = null, artifacts: unknown[] = [], stopPromise: Promise<void> | null = null, startPending = false, stateAttempted = false;
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
    const errors = [];
    for (const kind of ["donor", "worker"] as const) {
      try {
        const value = await io.recover(kind);
        if (value !== null) { requireValue(/^[a-f0-9]{64}$/.test(value) && (ids[kind] === null || ids[kind] === value), "OWNED_CONTAINER_ID_REQUIRED"); ids[kind] = value; }
      } catch (error) { errors.push(error); }
    }
    if (errors.length) throw Error("OWNED_CONTAINER_ID_RECOVERY_FAILED");
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
    requireValue(state.Running === false && state.ExitCode === 0 && state.OOMKilled === false, "SUCCESSFUL_TERMINAL_CONTAINER_STATE_REQUIRED");
  };
  const unwatch = io.watch(async reason => { failure ??= reason; if (ids.worker && !startPending) await stopWorker(); });
  try {
    await operation("donor-create", docker(p, "create", "--pull=never", "--platform=linux/amd64", "--network=none", "--cidfile=" + paths.evidence + "/donor.cid", "--label=chess-coach.native-build=" + p.runId, p.bunImage), p.limits.dockerCommandMs);
    await recover(); requireValue(ids.donor, "OWNED_DONOR_ID_REQUIRED");
    await operation("bun-copy", docker(p, "cp", "-L", ids.donor + ":/usr/local/bin/bun", paths.bun), p.limits.dockerCommandMs); await io.validateBun();
    requireValue(failure === null, failure ?? "HOST_BUILD_INTERRUPTED");
    await operation("worker-create", workerCreate(p, paths, uid, gid), p.limits.dockerCommandMs);
    await recover(); requireValue(ids.worker, "OWNED_WORKER_ID_REQUIRED");
    requireValue(failure === null, failure ?? "HOST_BUILD_INTERRUPTED");
    startPending = true;
    try { await operation("worker-start", docker(p, "start", ids.worker!), p.limits.dockerCommandMs); }
    finally { startPending = false; }
    requireValue(failure === null, failure ?? "HOST_BUILD_INTERRUPTED");
    await operation("worker-logs", docker(p, "logs", "--follow", ids.worker!), p.limits.nativeWorkMs);
    native = await io.nativeReceipt();
    requireValue(native?.status === "PASS_NATIVE_COMPILATION_ONLY" && native.compilationAttempts === 2 && native.sourceChanged === false && native.sourceStabilityChecked === true, "SUCCESSFUL_NATIVE_COMPILATION_RECEIPT_REQUIRED");
    await inspect(false);
    const artifactMs = Math.floor(Math.min(p.limits.artifactValidationMs, normalDeadline - io.now()));
    requireValue(artifactMs > 0, "ARTIFACT_VALIDATION_NORMAL_DEADLINE");
    artifacts = await io.artifacts(artifactMs);
    requireValue(artifacts.length === 5 && io.now() < normalDeadline, "COMPLETE_ARTIFACTS_WITHIN_DEADLINE_REQUIRED");
    requireValue(failure === null, failure ?? "HOST_BUILD_INTERRUPTED");
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
    for (const kind of ["worker", "donor"] as const) if (ids[kind]) {
      try { await operation(kind + "-remove", docker(p, "rm", ids[kind]!), 20000, true); }
      catch (error) { cleanupFailures.push(String(error)); }
    }
  }
  return { version: "chess-coach.owned-container-native-build.v1", status: failure === null && cleanupFailures.length === 0 ? "PASS_HOST_GPU_NATIVE_BUILD_ONLY" : "FAIL_HOST_GPU_NATIVE_BUILD_ONLY",
    failure, cleanupFailures, method: p.method, requestedResources: p.resources, limits: p.limits, ids, state, nativeReceipt: native, artifacts, results, elapsedMs: io.now() - started,
    hostInvocationsConsumed: 1, remainingHostInvocations: 0, automaticRetryAuthorized: false, qualificationImageBuilt: false, testsExecuted: false, gpuDevicesRequested: false, gpuExecuted: false, trainingReady: false };
}

export type TreeIO = { entries(path: string): Promise<{ name: string; isDirectory(): boolean }[]>; size(path: string): Promise<number> };
export async function treeBytes(path: string, files: TreeIO = { entries: path => readdir(path, { withFileTypes: true }), size: async path => (await lstat(path)).size }): Promise<number> {
  let total = 0;
  for (const entry of await files.entries(path)) {
    const child = path + "/" + entry.name;
    try { total += entry.isDirectory() ? await treeBytes(child, files) : await files.size(child); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  return total;
}

export function watchWorkspace(p: Plan, paths: Paths, stop: (reason: string) => Promise<void>, io = {
  free: async () => { const space = await statfs(paths.workspace); return Number(space.bavail) * Number(space.bsize); },
  bytes: async () => await treeBytes(paths.workspace) + await treeBytes(paths.evidence),
}) {
  let closed = false, pending: Promise<void> | null = null;
  const stops = new Set<Promise<void>>();
  const request = (reason: string) => { const job = stop(reason); stops.add(job); void job.finally(() => stops.delete(job)).catch(() => {}); return job; };
  const check = () => {
    if (closed) return Promise.resolve();
    return pending ??= (async () => {
      try { if (await io.free() < p.limits.minimumRunningFreeBytes || await io.bytes() > p.limits.workspaceSoftBytes) await request("WORKSPACE_SOFT_LIMIT_OR_FREE_SPACE"); }
      catch { await request("WORKSPACE_MONITOR_FAILED"); }
    })().finally(() => { pending = null; });
  };
  const interrupt = () => { if (!closed) void request("HOST_BUILD_INTERRUPTED"); };
  const timer = setInterval(() => { void check(); }, 5000);
  process.on("SIGTERM", interrupt); process.on("SIGINT", interrupt);
  return { check, interrupt, close: async () => {
    closed = true; clearInterval(timer); process.off("SIGTERM", interrupt); process.off("SIGINT", interrupt);
    if (pending) await pending;
    await Promise.all([...stops]);
  } };
}

export function protectFinalizationSignals(signals: { on(event: string, listener: () => void): unknown; off(event: string, listener: () => void): unknown } = process) {
  let interrupted = false;
  const protect = () => { interrupted = true; };
  for (const name of ["SIGTERM", "SIGINT"]) signals.on(name, protect);
  return { observed: () => interrupted, release: () => { for (const name of ["SIGTERM", "SIGINT"]) signals.off(name, protect); } };
}

export async function runHostBuild(p: Plan, driver: string) {
  requireValue(Bun.version === "1.4.0" && Bun.argv.at(-1) === p.grant, "FRESH_PINNED_HOST_BUILD_CONTEXT_REQUIRED");
  const root = resolve(process.cwd()), evidence = resolve(p.evidence), workspace = resolve(p.workspace), context = resolve(p.context);
  const paths = { context, evidence, workspace, native: workspace + "/native", cargo: workspace + "/cargo-home", bun: workspace + "/bun" };
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const captures: unknown[] = [];
  const protection = protectFinalizationSignals();
  let receipt: any;
  try {
    const startedEpoch = Number(process.env.HOST_NATIVE_BUILD_STARTED_MS), elapsed = Date.now() - startedEpoch;
    requireValue(Number.isSafeInteger(startedEpoch) && startedEpoch > 0 && elapsed >= 0 && elapsed < p.limits.normalOperationsMs, "HOST_BUILD_START_TIME_REQUIRED");
    const startedAt = performance.now() - elapsed;
    for (const helper of p.existingHelpers) requireValue(hash(await readFile(helper.path)) === helper.sha256, "EXISTING_HOST_HELPER_MISMATCH:" + helper.path);
    requireValue(hash(await readFile("Cargo.lock")) === "77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955", "HOST_REPOSITORY_CONTEXT_REQUIRED");
    const free = await statfs(dirname(workspace)); requireValue(Number(free.bavail) * Number(free.bsize) >= p.limits.minimumFreeBytes, "INITIAL_FREE_DISK_REQUIRED");
    await mkdir(workspace); await mkdir(paths.native); await mkdir(paths.cargo); await mkdir(evidence + "/native");
    await mkdir(paths.native + "/_work/gpu-owner-recovery/runs/" + p.runId, { recursive: true });
    await writeFile(evidence + "/build-driver.mjs", driver, { flag: "wx" });
    await writeFile(evidence + "/deadline.json", JSON.stringify({ normalDeadlineEpoch: startedEpoch + p.limits.normalOperationsMs }) + "\n", { flag: "wx" });
    const { runBounded } = await import(pathToFileURL(resolve(p.existingHelpers[0]!.path)).href);
    const environment = Object.fromEntries(Object.entries(process.env).filter((row): row is [string, string] => row[1] !== undefined)); delete environment.DOCKER_CONTEXT;
    requireValue(!protection.observed(), "HOST_BUILD_INTERRUPTED_DURING_PREFLIGHT");
    receipt = await executeBuild(p, paths, process.getuid!(), process.getgid!(), {
      now: () => performance.now(), startedAt, run: async (id, argv, ms) => {
        const step = evidence + "/" + id; await mkdir(step);
        const result = await runBounded(argv, step, ms, { cwd: root, environment });
        const streams = [];
        for (const stream of ["stdout", "stderr"]) { const path = step + "/command." + stream, bytes = await readFile(path); streams.push({ path, bytes: bytes.length, sha256: hash(bytes) }); }
        captures.push({ id, streams }); return { ...result, stdout: await readFile(step + "/command.stdout", "utf8") };
      }, recover: async kind => {
        try { return (await readFile(evidence + "/" + kind + ".cid", "utf8")).trim(); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
      }, validateBun: async () => { const s = await lstat(paths.bun); requireValue(s.isFile() && s.size > 0 && s.size <= p.limits.bunPostCopyBytes && (s.mode & 0o111) !== 0, "COPIED_BUN_FILE_ADMISSION_FAILED"); },
      nativeReceipt: async () => JSON.parse(await readFile(evidence + "/native/receipt.json", "utf8")),
      artifacts: async timeoutMs => {
        const deadline = performance.now() + timeoutMs;
        const remaining = () => requireValue(performance.now() < deadline, "ARTIFACT_VALIDATION_NORMAL_DEADLINE");
        remaining();
        const { readArtifacts } = await import(pathToFileURL(context + "/qualification-tools/tooling/runtime/qualification.ts").href);
        const logs = { learning: await readFile(paths.native + "/qualification/gpu-learning.stdout", "utf8"), "policy-io": await readFile(paths.native + "/qualification/gpu-policy.stdout", "utf8") };
        remaining();
        const chosen = readArtifacts(logs, "gpu"), artifacts = [];
        for (const executable of new Set<string>([...Array.from(chosen.artifacts.values()).map((row: any) => row.executable), ...chosen.binaries.values()] as string[])) {
          remaining();
          const path = paths.native + executable.slice("/build/native".length), s = await lstat(path);
          requireValue(s.isFile() && (s.mode & 0o111) !== 0, "BUILT_EXECUTABLE_FILE_REQUIRED");
          const digest = createHash("sha256"), file = Bun.file(path);
          for await (const chunk of file.stream()) { remaining(); digest.update(chunk); }
          remaining();
          artifacts.push({ executable, path, bytes: s.size, sha256: digest.digest("hex") });
        }
        return artifacts;
      }, watch: stop => watchWorkspace(p, paths, stop).close,
    });
  } catch (error) { receipt = { status: "FAIL_HOST_BUILD_PREFLIGHT", failure: error instanceof Error ? error.message : "HOST_BUILD_FAILED", hostInvocationsConsumed: 1, remainingHostInvocations: 0, automaticRetryAuthorized: false, qualificationImageBuilt: false, gpuExecuted: false, testsExecuted: false, trainingReady: false }; }
  try {
    if (protection.observed()) { receipt.status = "FAIL_HOST_GPU_NATIVE_BUILD_ONLY"; receipt.failure ??= "HOST_BUILD_INTERRUPTED"; }
    const bytes = Buffer.from(JSON.stringify({ ...receipt, captures, workspace: p.workspace, evidence: p.evidence, receiptStatusRequiresZeroHostMarker: true, workspaceIsFilesystemQuota: false, dockerWritableLayerIncludedInWorkspaceAccounting: false,
      finalizationSignalObserved: protection.observed(), bunCopyHasOnlyPostCopySizeCheck: true, parentDiagnosticsHaveOnlyPostExitSoftSizeCheck: true }, null, 2) + "\n");
    requireValue(bytes.length <= p.limits.hostReceiptBytes, "HOST_BUILD_RECEIPT_SIZE_LIMIT"); await writeFile(evidence + "/receipt.json", bytes, { flag: "wx" });
    if (protection.observed()) { receipt.status = "FAIL_HOST_GPU_NATIVE_BUILD_ONLY"; receipt.failure ??= "HOST_BUILD_INTERRUPTED"; }
    console.log(JSON.stringify({ status: receipt.status, failure: receipt.failure, receipt: p.evidence + "/receipt.json", trainingReady: false }));
    process.exitCode = receipt.status === "PASS_HOST_GPU_NATIVE_BUILD_ONLY" ? 0 : 1;
  } finally { protection.release(); }
}
