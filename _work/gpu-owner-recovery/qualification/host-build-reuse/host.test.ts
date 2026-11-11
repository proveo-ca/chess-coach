// SPEC: _spec/gpu-host-build-reuse.puml
import { beforeAll, expect, test } from "bun:test";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { DockerResult } from "../host-build/build";
import { executeReuseBuild, workerCreateReuse, type ReuseIO } from "./host";
import { reusePlan, type ReusePaths, type ReusePlan } from "./plan";

const scope = "SOURCE_ONLY_MOCK_NOT_HOST_EVIDENCE", repository = fileURLToPath(new URL("../../../../", import.meta.url));
const worker = "b".repeat(64), foreign = "c".repeat(64), uid = 1001, gid = 1002;
const paths: ReusePaths = { context: "/source-only-mock/received/context", workspace: "/source-only-mock/new-workspace", evidence: "/source-only-mock/new-evidence",
  native: "/source-only-mock/new-workspace/native", cargo: "/source-only-mock/retained/cargo-home", target: "/source-only-mock/retained/native/target-gpu", bun: "/source-only-mock/retained/bun" };
const terminal = { Running: false, ExitCode: 0, OOMKilled: false };
const nativePass = { status: "PASS_NATIVE_COMPILATION_ONLY", compilationAttempts: 2, sourceChanged: false, sourceStabilityChecked: true,
  sourceManifestSha256: "7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec",
  previousSourceManifestSha256: "9141aaefa2fab3f3a812aeabec4bdfdd818415333f9e5cba6d5ef822dac90863" };
const normalIds = ["worker-create", "worker-start", "worker-logs", "worker-state", "worker-remove"];
const fixtureScope = { scope, actualDockerProcesses: 0, actualNativeProcesses: 0, actualDocker: 0, actualNative: 0, gpuExecuted: false, hostEvidence: false,
  dockerCliCompatibilityValidated: false, nativeCliCompatibilityValidated: false };
let plan: ReusePlan, evidence: string, runtimeSource: string;

async function retainedJson(path: string, value: unknown) {
  const text = JSON.stringify(value, null, 2) + "\n";
  if (Buffer.byteLength(text) > 262144) throw Error("BOUNDED_SOURCE_TEST_EVIDENCE_REQUIRED");
  await writeFile(path, text, { flag: "wx" });
}

beforeAll(async () => {
  const base = process.env.HOST_BUILD_REUSE_TEST_EVIDENCE;
  if (!base) throw Error("HOST_BUILD_REUSE_TEST_EVIDENCE_REQUIRED");
  const runs = resolve(repository, "_work/gpu-owner-recovery/runs"), selected = resolve(repository, base);
  const name = relative(runs, selected), run = name.split(sep)[0]!;
  if (!name || isAbsolute(name) || name.startsWith("..") || !/^[A-Za-z0-9._-]*(?:source|test|verif)[A-Za-z0-9._-]*$/.test(run)) throw Error("SOURCE_VERIFIER_RUN_EVIDENCE_REQUIRED");
  const actual = relative(await realpath(runs), await realpath(selected));
  if (!actual || isAbsolute(actual) || actual.startsWith("..") || actual !== name) throw Error("REPOSITORY_OWNED_TEST_EVIDENCE_REQUIRED");
  evidence = resolve(selected, "host-build-reuse-host-tests"); await mkdir(evidence);
  await retainedJson(evidence + "/fixture-scope.json", fixtureScope);
  plan = await reusePlan();
  runtimeSource = await readFile(new URL("./runtime.ts", import.meta.url), "utf8");
});

type Call = { id: string; argv: string[]; timeoutMs: number; at: number };
function fixture() {
  const calls: Call[] = [], events: { id: string; value?: unknown }[] = [];
  const state = {
    clock: 0, costMs: 11, createId: worker as string | null, recoveredId: null as string | null,
    responses: {} as Record<string, Partial<DockerResult>>, throws: {} as Record<string, string>,
    terminal: JSON.stringify(terminal), native: structuredClone(nativePass) as unknown,
    artifactRows: Array.from({ length: 5 }, (_, index) => ({ executable: `/build/native/target-gpu/mock-${index}`, path: `${paths.target}/mock-${index}`, bytes: index + 1, sha256: String(index).repeat(64) })),
    nativeError: null as string | null, artifactsError: null as string | null,
    nativeReads: 0, artifactReads: 0, watches: 0, unwatches: 0, artifactTimeouts: [] as number[],
    onRun: null as ((id: string) => Promise<void>) | null, onUnwatch: null as (() => void | Promise<void>) | null,
    stop: null as ((reason: string) => Promise<void>) | null,
  };
  const io: ReuseIO = {
    now: () => state.clock,
    run: async (id, argv, timeoutMs) => {
      calls.push({ id, argv: [...argv], timeoutMs, at: state.clock }); events.push({ id: "run:" + id });
      if (id === "worker-create") state.recoveredId = state.createId;
      if (state.onRun) await state.onRun(id);
      state.clock += state.costMs;
      if (state.throws[id]) throw Error(state.throws[id]);
      const stdout = id === "worker-state" ? state.terminal : id === "worker-create" ? worker + "\n" : "";
      return { status: "PASS", exitCode: 0, failure: null, stdout, ...state.responses[id] };
    },
    recover: async () => { events.push({ id: "recover", value: state.recoveredId }); return state.recoveredId; },
    nativeReceipt: async () => { state.nativeReads++; events.push({ id: "native-receipt" }); if (state.nativeError) throw Error(state.nativeError); return state.native; },
    artifacts: async timeoutMs => { state.artifactReads++; state.artifactTimeouts.push(timeoutMs); events.push({ id: "artifacts", value: timeoutMs }); if (state.artifactsError) throw Error(state.artifactsError); return state.artifactRows; },
    watch: stop => { state.watches++; state.stop = stop; events.push({ id: "watch" }); return () => { state.unwatches++; events.push({ id: "unwatch" }); return state.onUnwatch?.(); }; },
  };
  return { io, state, calls, events, execute: (p = plan) => executeReuseBuild(p, paths, uid, gid, io) };
}
type Fixture = ReturnType<typeof fixture>;
type Result = Awaited<ReturnType<typeof executeReuseBuild>>;
const ids = (f: Fixture) => f.calls.map(call => call.id);
const failed = (f: Fixture, id: string) => { f.state.responses[id] = { status: "FAIL", exitCode: 125, failure: "MOCK_CLIENT_FAILURE" }; };
function bounded(f: Fixture, result: Result, maximum = 7) {
  expect(f.calls.length).toBeLessThanOrEqual(maximum); expect(new Set(ids(f)).size).toBe(f.calls.length);
  expect(result.results.map(row => row.id)).toEqual(ids(f));
  expect(f.state.watches).toBe(1); expect(f.state.unwatches).toBe(1);
  expect(result.hostInvocationsConsumed).toBe(1); expect(result.remainingHostInvocations).toBe(0);
  for (const key of ["automaticRetryAuthorized", "qualificationImageBuilt", "testsExecuted", "gpuDevicesRequested", "gpuExecuted", "trainingReady"] as const) expect(result[key]).toBe(false);
  expect(result.mutableCachePaths).toEqual([paths.cargo, paths.target]); expect(result.retainedBunReadOnly).toBe(true);
  for (const call of f.calls) {
    expect(call.argv.slice(0, 2)).toEqual(["docker", "--host=unix:///var/run/docker.sock"]);
    expect(Number.isInteger(call.timeoutMs) && call.timeoutMs > 0).toBe(true);
    expect(call.argv.join(" ")).not.toMatch(/buildx|--gpus|--device|--privileged|--attach|--tty|--interactive/);
    expect(call.argv).not.toContain("cp"); expect(call.id).not.toMatch(/donor|bun-copy/);
    if (call.id !== "worker-create") expect(call.argv.at(-1)).toBe(worker);
  }
  for (const id of [...normalIds, "worker-stop", "worker-kill"]) expect(ids(f).filter(value => value === id).length).toBeLessThanOrEqual(1);
  expect(result.results.every(row => !Object.hasOwn(row, "stdout"))).toBe(true);
}
async function retainedCase(name: string, f: Fixture, result: Result) {
  const directory = resolve(evidence, name); await mkdir(directory);
  await retainedJson(directory + "/fixture-scope.json", fixtureScope);
  await retainedJson(directory + "/result.json", { ...fixtureScope, result });
  await retainedJson(directory + "/argv.json", { ...fixtureScope, calls: f.calls });
  await retainedJson(directory + "/effects.json", { ...fixtureScope, events: f.events });
  expect(JSON.parse(await readFile(directory + "/result.json", "utf8")).scope).toBe(scope);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

test("the reuse proposal grants no host, retained-cache write, publication, GPU or training authority", () => {
  expect(plan.runId).toBe("host-gpu-native-build-2"); expect(plan.grant).toBe("--approved-host-gpu-native-build-2");
  expect(plan.status).toBe("DRAFT_SOURCE_ONLY_HOST_APPROVAL_REQUIRED");
  for (const key of ["cacheWritesAuthorized", "hostExecutionApproved", "stagingAndNativeCompilationApproved", "publicationAuthorized", "gpuExecutionAuthorized", "trainingAuthorized", "automaticRetryAuthorized", "trainingReady"] as const) expect(plan[key]).toBe(false);
});

test("the closed packet has seven worst-case operations, five normal operations and exact reserves", () => {
  expect(plan.maximums.dockerOperations).toBe(7); expect(normalIds).toHaveLength(5);
  expect(plan.maximums.donorCreates).toBe(0); expect(plan.maximums.bunCopies).toBe(0); expect(plan.maximums.containerRemovals).toBe(1);
  expect(plan.limits.normalOperationsMs).toBe(4020000); expect(plan.limits.cleanupMs).toBe(120000); expect(plan.limits.receiptReserveMs).toBe(60000);
  expect(plan.limits.normalOperationsMs + plan.limits.cleanupMs + plan.limits.receiptReserveMs).toBe(plan.limits.overallMs);
  expect(plan.limits.nativeAcceptanceReserveMs).toBe(120000); expect(plan.limits.nativeWorkMs).toBe(3600000);
  expect(plan.limits.hostDockerStreamsBytes).toBe(7 * 2 * 4194304);
  expect(plan.limits.hostDockerStreamsBytes + plan.limits.nativeStreamsBytes + plan.limits.canonicalLogCopiesBytes).toBe(112 * 1024 * 1024);
  expect(plan.limits.minimumFreeBytes).toBe(64 * 1024 ** 3); expect(plan.limits.minimumRunningFreeBytes).toBe(16 * 1024 ** 3); expect(plan.limits.workspaceSoftBytes).toBe(32 * 1024 ** 3);
});

test("source metadata binds the corrected generation and only three retained paths", () => {
  expect(plan.sourceManifestSha256).toBe("7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec");
  expect(plan.retained).toEqual({ bun: "_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun", cargo: "_work/gpu-owner-recovery/cache/host-gpu-native-build-1/cargo-home", target: "_work/gpu-owner-recovery/cache/host-gpu-native-build-1/native/target-gpu" });
  expect(plan.workspace).not.toContain("build-1"); expect(plan.evidence).not.toContain("build-1");
});

test("worker creation fixes resources, all eight mounts and post-image Bun arguments", () => {
  const argv = workerCreateReuse(plan, paths, uid, gid), image = argv.indexOf(plan.rustImage);
  expect(argv.slice(0, 14)).toEqual(["docker", "--host=" + plan.engine, "create", "--pull=never", "--platform=linux/amd64", "--network=none", "--cpus=2", "--memory=8g", "--memory-swap=8g", "--user=1001:1002",
    "--cidfile=" + paths.evidence + "/worker.cid", "--label=chess-coach.native-build=" + plan.runId, "--workdir=/build/native", "--entrypoint=/usr/local/bin/bun"]);
  expect(argv.filter((_, index) => argv[index - 1] === "--mount")).toEqual([
    `type=bind,source=${paths.context},target=/received,readonly`, `type=bind,source=${paths.native},target=/build/native`,
    `type=bind,source=${paths.cargo},target=/capture/cargo-home`, `type=bind,source=${paths.target},target=/build/native/target-gpu`,
    `type=bind,source=${paths.context}/gpu-build/llvm,target=/opt/tracel-data/tracel/tracel-llvm-23.1.0-4,readonly`,
    `type=bind,source=${paths.bun},target=/usr/local/bin/bun,readonly`, `type=bind,source=${paths.evidence},target=/evidence,readonly`,
    `type=bind,source=${paths.evidence}/native,target=/build/native/_work/gpu-owner-recovery/runs/${plan.runId}`,
  ]);
  expect(argv.filter((_, index) => argv[index - 1] === "--env")).toEqual(["CARGO_HOME=/capture/cargo-home", "CARGO_TARGET_DIR=/build/native/target-gpu", "CARGO_BUILD_JOBS=2", "RAYON_NUM_THREADS=2", "XDG_DATA_HOME=/opt/tracel-data",
    "CUDARC_CUDA_VERSION=13000", "CARGO_NET_OFFLINE=true", "CARGO_NET_RETRY=0", "RUSTUP_AUTO_INSTALL=0", "HOME=/build/native/_work/gpu-owner-recovery/scratch/home", "TMPDIR=/build/native/_work/gpu-owner-recovery/scratch/tmp"]);
  expect(argv.slice(image + 1)).toEqual(["--no-env-file", "--no-install", "/evidence/build-driver.mjs"]);
  expect(argv.slice(0, image)).not.toContain("--no-install"); expect(argv.indexOf("--entrypoint=/usr/local/bin/bun")).toBeLessThan(image);
});

test("only safe numeric UID and GID values form the worker identity", () => {
  expect(workerCreateReuse(plan, paths, 0, 0)).toContain("--user=0:0");
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1001", null, undefined]) {
    expect(() => workerCreateReuse(plan, paths, value as number, gid)).toThrow("NUMERIC_OPERATOR_UID_GID_REQUIRED");
    expect(() => workerCreateReuse(plan, paths, uid, value as number)).toThrow("NUMERIC_OPERATOR_UID_GID_REQUIRED");
  }
});

test("each mount rejects relative and comma-injected paths", () => {
  for (const key of ["context", "native", "cargo", "target", "bun", "evidence"] as const) for (const value of ["relative", "/absolute,readonly", ""]) {
    expect(() => workerCreateReuse(plan, { ...paths, [key]: value }, uid, gid)).toThrow("ABSOLUTE_COMMA_FREE_MOUNT_SOURCE_REQUIRED");
  }
});

test("the worker packet contains no donor, copy, host-path transplant, device or acquisition command", () => {
  const argv = workerCreateReuse(plan, paths, uid, gid);
  expect(argv).not.toContain(plan.bunImage); expect(argv).not.toContain("cp");
  expect(argv.join(" ")).not.toMatch(/buildx|--gpus|--device|--privileged|--network=host|source=\/var\/run\/docker\.sock|PATH=|rustup install|cargo install/);
  expect(argv.some(value => value === `type=bind,source=${paths.target.slice(0, -"/target-gpu".length)},target=/build/native`)).toBe(false);
});

test("source-only integrated happy fixture retains exactly five Docker operations and five mocked artifacts", async () => {
  const f = fixture(), result = await f.execute(); await retainedCase("happy", f, result);
  expect(result.status).toBe("PASS_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.failure).toBeNull(); expect(result.cleanupFailures).toEqual([]);
  expect(ids(f)).toEqual(normalIds); expect(result.ids).toEqual({ worker }); expect(result.state).toEqual(terminal);
  expect(result.nativeReceipt).toEqual(nativePass); expect(result.artifacts).toEqual(f.state.artifactRows);
  expect(f.calls[0]!.argv).toEqual(workerCreateReuse(plan, paths, uid, gid));
  expect(f.calls[1]!.argv.slice(2)).toEqual(["start", worker]); expect(f.calls[1]!.timeoutMs).toBe(120000);
  expect(f.calls[2]!.argv.slice(2)).toEqual(["logs", "--follow", worker]); expect(f.calls[2]!.timeoutMs).toBe(3600000);
  expect(f.calls[3]!.timeoutMs).toBe(10000); expect(f.calls[4]!.timeoutMs).toBe(20000);
  expect(f.state.artifactTimeouts).toEqual([120000]); expect(f.state.nativeReads).toBe(1);
  expect(f.events.findIndex(row => row.id === "run:worker-state")).toBeLessThan(f.events.findIndex(row => row.id === "artifacts"));
  expect(f.events.findIndex(row => row.id === "unwatch")).toBeLessThan(f.events.findIndex(row => row.id === "run:worker-remove")); bounded(f, result);
});

test("source-only failed native fixture preserves its failed compilation receipt and admits no artifacts", async () => {
  const f = fixture(); f.state.native = { ...nativePass, status: "FAIL_NATIVE_COMPILATION_ONLY", failure: "MOCK_COMPILATION_FAILURE" };
  const result = await f.execute(); await retainedCase("native-failure", f, result);
  expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.failure).toBe("SUCCESSFUL_NATIVE_COMPILATION_RECEIPT_REQUIRED");
  expect(result.nativeReceipt).toEqual(f.state.native); expect(result.artifacts).toEqual([]); expect(f.state.artifactReads).toBe(0);
  expect(ids(f)).toEqual(["worker-create", "worker-start", "worker-logs", "worker-stop", "worker-state", "worker-remove"]); bounded(f, result);
});

test("source-only cleanup-failure fixture never promotes a successful compilation", async () => {
  const f = fixture(); failed(f, "worker-remove"); const result = await f.execute(); await retainedCase("cleanup-failure", f, result);
  expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.failure).toBeNull();
  expect(result.cleanupFailures).toEqual(["Error: DOCKER_OPERATION_FAILED:worker-remove"]); expect(ids(f)).toEqual(normalIds); bounded(f, result);
});

test("failed create independently recovers its saved CID and cleans only that worker", async () => {
  const f = fixture(); failed(f, "worker-create"); const result = await f.execute();
  expect(result.failure).toBe("DOCKER_OPERATION_FAILED:worker-create"); expect(result.ids.worker).toBe(worker);
  expect(ids(f)).toEqual(["worker-create", "worker-stop", "worker-state", "worker-remove"]); expect(f.state.artifactReads).toBe(0); bounded(f, result);
});

test("successful create stdout cannot replace a missing saved CID", async () => {
  const f = fixture(); f.state.createId = null; const result = await f.execute();
  expect(result.failure).toBe("OWNED_WORKER_ID_REQUIRED"); expect(result.ids.worker).toBeNull(); expect(ids(f)).toEqual(["worker-create"]); bounded(f, result);
});

test("failed create stdout cannot authorize cleanup without a saved CID", async () => {
  const f = fixture(); f.state.createId = null; failed(f, "worker-create"); const result = await f.execute();
  expect(result.failure).toBe("DOCKER_OPERATION_FAILED:worker-create"); expect(result.ids.worker).toBeNull(); expect(ids(f)).toEqual(["worker-create"]); bounded(f, result);
});

test("malformed and non-string CID scalars never authorize arbitrary targets", async () => {
  for (const value of ["", "--all", "other-container", "b".repeat(63), "b".repeat(65), "B".repeat(64), "g".repeat(64), JSON.stringify(worker), worker + ";echo unsafe", 0, false, {}, [worker]]) {
    const f = fixture(); f.state.createId = value as string; const result = await f.execute();
    expect(result.failure).toBe("OWNED_CONTAINER_ID_RECOVERY_FAILED"); expect(result.ids.worker).toBeNull(); expect(ids(f)).toEqual(["worker-create"]); bounded(f, result);
  }
});

test("a changed saved CID cannot transfer ownership to a foreign container", async () => {
  const f = fixture(); let reads = 0; f.io.recover = async () => ++reads === 1 ? worker : foreign;
  const result = await f.execute(); expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.ids.worker).toBe(worker);
  expect(result.cleanupFailures).toContain("Error: OWNED_CONTAINER_ID_RECOVERY_FAILED");
  expect(f.calls.every(call => !call.argv.includes(foreign))).toBe(true); bounded(f, result);
});

test("CID read errors cannot admit or invent an owned worker", async () => {
  const f = fixture(); f.io.recover = async () => { throw Error("MOCK_CID_READ_FAILURE"); };
  const result = await f.execute(); expect(result.failure).toBe("OWNED_CONTAINER_ID_RECOVERY_FAILED"); expect(result.ids.worker).toBeNull();
  expect(ids(f)).toEqual(["worker-create"]); bounded(f, result);
});

test("failed create keeps its primary error when independent CID recovery also fails", async () => {
  const f = fixture(); failed(f, "worker-create"); f.io.recover = async () => { throw Error("MOCK_CID_READ_FAILURE"); };
  const result = await f.execute(); expect(result.failure).toBe("DOCKER_OPERATION_FAILED:worker-create");
  expect(result.cleanupFailures).toEqual(["Error: OWNED_CONTAINER_ID_RECOVERY_FAILED"]); expect(ids(f)).toEqual(["worker-create"]); bounded(f, result);
});

test("a watcher failure before admission prevents every normal Docker operation", async () => {
  const f = fixture(), watch = f.io.watch; f.io.watch = stop => { const close = watch(stop); void stop("WORKSPACE_MONITOR_FAILED"); return close; };
  const result = await f.execute(); expect(result.failure).toBe("WORKSPACE_MONITOR_FAILED"); expect(f.calls).toEqual([]); bounded(f, result);
});

test("interruption during creation recovers the CID but never starts the worker", async () => {
  const f = fixture(); f.state.onRun = async id => { if (id === "worker-create") await f.state.stop!("HOST_BUILD_INTERRUPTED"); };
  const result = await f.execute(); expect(result.failure).toBe("HOST_BUILD_INTERRUPTED");
  expect(ids(f)).toEqual(["worker-create", "worker-stop", "worker-state", "worker-remove"]); bounded(f, result);
});

for (const clientFails of [false, true]) test(`pending ${clientFails ? "failed" : "successful"} start defers stop until settlement and never follows logs`, async () => {
  const f = fixture(), entered = deferred<void>(), release = deferred<void>(); let finalized = false;
  f.state.onRun = async id => { if (id === "worker-start") { entered.resolve(undefined); await release.promise; f.events.push({ id: "start-settled" }); } };
  if (clientFails) failed(f, "worker-start");
  const running = f.execute().then(result => { finalized = true; return result; });
  try {
    await entered.promise; await f.state.stop!("HOST_BUILD_INTERRUPTED"); await f.state.stop!("WORKSPACE_SOFT_LIMIT_OR_FREE_SPACE");
    expect(finalized).toBe(false); expect(ids(f)).toEqual(["worker-create", "worker-start"]);
    release.resolve(undefined); const result = await running;
    expect(result.failure).toBe("HOST_BUILD_INTERRUPTED"); expect(ids(f)).toEqual(["worker-create", "worker-start", "worker-stop", "worker-state", "worker-remove"]);
    expect(f.events.findIndex(row => row.id === "start-settled")).toBeLessThan(f.events.findIndex(row => row.id === "run:worker-stop")); bounded(f, result);
  } finally { release.resolve(undefined); await running; }
});

test("live log following allows one stop before the follower settles", async () => {
  const f = fixture(), entered = deferred<void>(), release = deferred<void>(); let finalized = false;
  f.state.onRun = async id => { if (id === "worker-logs") { entered.resolve(undefined); await release.promise; f.events.push({ id: "logs-settled" }); } };
  const running = f.execute().then(result => { finalized = true; return result; });
  try {
    await entered.promise; await f.state.stop!("HOST_BUILD_INTERRUPTED");
    expect(ids(f)).toEqual(["worker-create", "worker-start", "worker-logs", "worker-stop"]); expect(finalized).toBe(false);
    expect(f.events.some(row => row.id === "logs-settled")).toBe(false);
    release.resolve(undefined); const result = await running;
    expect(result.failure).toBe("HOST_BUILD_INTERRUPTED"); expect(f.state.artifactReads).toBe(0); bounded(f, result);
  } finally { release.resolve(undefined); await running; }
});

test("disk-scan drain and its stop both finish before removal and receipt return", async () => {
  const f = fixture(), closeEntered = deferred<void>(), releaseClose = deferred<void>(), stopEntered = deferred<void>(), releaseStop = deferred<void>(); let finalized = false;
  f.state.onUnwatch = async () => { closeEntered.resolve(undefined); await releaseClose.promise; await f.state.stop!("WORKSPACE_MONITOR_FAILED"); f.events.push({ id: "scan-drained" }); };
  f.state.onRun = async id => { if (id === "worker-stop") { stopEntered.resolve(undefined); await releaseStop.promise; } };
  const running = f.execute().then(result => { finalized = true; return result; });
  try {
    await closeEntered.promise; expect(ids(f)).toEqual(normalIds.slice(0, 4)); expect(finalized).toBe(false);
    releaseClose.resolve(undefined); await stopEntered.promise;
    expect(ids(f)).not.toContain("worker-remove"); expect(finalized).toBe(false);
    releaseStop.resolve(undefined); const result = await running;
    expect(result.failure).toBe("WORKSPACE_MONITOR_FAILED");
    expect(f.events.findIndex(row => row.id === "scan-drained")).toBeLessThan(f.events.findIndex(row => row.id === "run:worker-remove")); bounded(f, result);
  } finally { releaseClose.resolve(undefined); releaseStop.resolve(undefined); await running; }
});

test("cleanup joins a cached stop even when watcher close does not join it", async () => {
  const f = fixture(), entered = deferred<void>(), release = deferred<void>(); let finalized = false;
  f.state.onUnwatch = () => { void f.state.stop!("HOST_BUILD_INTERRUPTED"); };
  f.state.onRun = async id => { if (id === "worker-stop") { entered.resolve(undefined); await release.promise; } };
  const running = f.execute().then(result => { finalized = true; return result; });
  try {
    await entered.promise; expect(finalized).toBe(false); expect(ids(f)).not.toContain("worker-remove");
    release.resolve(undefined); const result = await running; expect(result.failure).toBe("HOST_BUILD_INTERRUPTED"); bounded(f, result);
  } finally { release.resolve(undefined); await running; }
});

test("repeated watcher cancellations preserve the first reason and stop only once", async () => {
  const f = fixture(); f.state.onRun = async id => { if (id === "worker-logs") { await f.state.stop!("HOST_BUILD_INTERRUPTED"); await f.state.stop!("WORKSPACE_SOFT_LIMIT_OR_FREE_SPACE"); } };
  const result = await f.execute(); expect(result.failure).toBe("HOST_BUILD_INTERRUPTED"); expect(ids(f).filter(id => id === "worker-stop")).toHaveLength(1); bounded(f, result);
});

for (const priorFailure of [false, true]) test(`watcher close failure ${priorFailure ? "preserves the primary failure" : "prevents PASS"} and still cleans ownership`, async () => {
  const f = fixture(); if (priorFailure) failed(f, "worker-logs"); f.state.onUnwatch = async () => { throw Error("MOCK_CLOSE_FAILURE"); };
  const result = await f.execute(); expect(result.failure).toBe(priorFailure ? "DOCKER_OPERATION_FAILED:worker-logs" : "WORKSPACE_MONITOR_SHUTDOWN_FAILED:Error: MOCK_CLOSE_FAILURE");
  expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(ids(f).at(-1)).toBe("worker-remove"); bounded(f, result);
});

test("a synchronous watcher setup error becomes a failed receipt without Docker work", async () => {
  const f = fixture(); f.io.watch = () => { throw Error("MOCK_WATCH_SETUP_FAILURE"); };
  const result = await f.execute(); expect(result.failure).toBe("MOCK_WATCH_SETUP_FAILURE"); expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(f.calls).toEqual([]);
});

for (const [label, response] of [
  ["bad-status", { status: "FAIL", exitCode: 0, failure: null }], ["bad-exit", { status: "PASS", exitCode: 1, failure: null }],
  ["failure-at-zero-exit", { status: "PASS", exitCode: 0, failure: "MOCK_SUPERVISOR_FAILURE" }],
] as const) test(`Docker ${label} cannot pass admission`, async () => {
  const f = fixture(); f.state.responses["worker-start"] = response; const result = await f.execute();
  expect(result.failure).toBe("DOCKER_OPERATION_FAILED:worker-start"); expect(ids(f)).not.toContain("worker-logs");
  expect(result.results[1]).toMatchObject({ status: "FAIL", exitCode: response.exitCode, failure: response.failure, supervisorResult: response, operationFailure: "DOCKER_OPERATION_FAILED:worker-start" }); bounded(f, result);
});

for (const [failure, exitCode] of [["COMMAND_DEADLINE", 143], ["COMMAND_OUTPUT_BOUND", 137]] as const) test(`${failure} preserves raw supervisor cause separately from operation context`, async () => {
  const f = fixture(), supervisor = { status: "FAIL", exitCode, failure }; f.state.responses["worker-logs"] = { ...supervisor, stdout: scope + ": partial log" };
  f.state.native = { ...nativePass, status: "FAIL_NATIVE_COMPILATION_ONLY", failure: "MOCK_NATIVE_FAILURE_BEFORE_LOG_CLIENT_EXIT" };
  const result = await f.execute(); expect(result.failure).toBe("DOCKER_OPERATION_FAILED:worker-logs");
  expect(result.results.find(row => row.id === "worker-logs")).toMatchObject({ ...supervisor, supervisorResult: supervisor, operationFailure: "DOCKER_OPERATION_FAILED:worker-logs" });
  expect(result.nativeReceipt).toEqual(f.state.native); expect(f.state.artifactReads).toBe(0); bounded(f, result);
});

test("an IO throw invents no supervisor result and preserves its original stage failure", async () => {
  const f = fixture(); f.state.throws["worker-logs"] = "MOCK_IO_THROW"; const result = await f.execute(), entry = result.results.find(row => row.id === "worker-logs")!;
  expect(result.failure).toBe("MOCK_IO_THROW"); expect(entry).toMatchObject({ status: "FAIL", failure: "MOCK_IO_THROW", operationFailure: "MOCK_IO_THROW" });
  expect(Object.hasOwn(entry, "supervisorResult")).toBe(false); expect(Object.hasOwn(entry, "exitCode")).toBe(false); bounded(f, result);
});

test("a full mocked 4-MiB stdout is not duplicated into receipt metadata", async () => {
  const f = fixture(), prefix = scope + ": MOCK_STDOUT_NOT_METADATA:"; f.state.responses["worker-logs"] = { stdout: prefix + "x".repeat(4194304 - Buffer.byteLength(prefix)) };
  f.state.terminal = "\n " + JSON.stringify(terminal) + " \n";
  const result = await f.execute(); expect(result.status).toBe("PASS_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.state).toEqual(terminal);
  expect(JSON.stringify(result)).not.toContain(prefix); expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(2097152); bounded(f, result);
});

test("stop failure uses one 15-second kill fallback and fits exactly seven operations", async () => {
  const f = fixture(), supervisor = { status: "FAIL", exitCode: 137, failure: "COMMAND_OUTPUT_BOUND" };
  failed(f, "worker-logs"); f.state.responses["worker-stop"] = supervisor; const result = await f.execute();
  expect(ids(f)).toEqual(["worker-create", "worker-start", "worker-logs", "worker-stop", "worker-kill", "worker-state", "worker-remove"]);
  expect(f.calls[3]!.argv.slice(2)).toEqual(["stop", "--time=10", worker]); expect(f.calls[3]!.timeoutMs).toBe(20000);
  expect(f.calls[4]!.argv.slice(2)).toEqual(["kill", "--signal=KILL", worker]); expect(f.calls[4]!.timeoutMs).toBe(15000);
  expect(result.results.find(row => row.id === "worker-stop")).toMatchObject({ ...supervisor, supervisorResult: supervisor, operationFailure: "DOCKER_OPERATION_FAILED:worker-stop" });
  expect(result.cleanupFailures).toEqual(["Error: DOCKER_OPERATION_FAILED:worker-stop"]); bounded(f, result);
});

test("stop, kill and remove failures remain separate and never replace the primary failure", async () => {
  const f = fixture(); for (const id of ["worker-logs", "worker-stop", "worker-kill", "worker-remove"]) failed(f, id);
  const result = await f.execute(); expect(result.failure).toBe("DOCKER_OPERATION_FAILED:worker-logs");
  expect(result.cleanupFailures).toEqual(["worker-stop", "worker-kill", "worker-remove"].map(id => "Error: DOCKER_OPERATION_FAILED:" + id)); expect(f.calls).toHaveLength(7); bounded(f, result);
});

for (const operation of ["worker-start", "worker-logs", "worker-state"]) test(`${operation} failure keeps its top-level stage code and performs no retries`, async () => {
  const f = fixture(); failed(f, operation); const result = await f.execute();
  expect(result.failure).toBe("DOCKER_OPERATION_FAILED:" + operation); expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY");
  expect(result.artifacts).toEqual([]); expect(ids(f)).toContain("worker-stop"); expect(ids(f).at(-1)).toBe("worker-remove"); bounded(f, result);
});

test("native receipt status, two attempts, unchanged source and checked stability require exact values", async () => {
  for (const native of [null, {}, { ...nativePass, status: "FAIL_NATIVE_COMPILATION_ONLY" }, ...[1, 3, "2"].map(compilationAttempts => ({ ...nativePass, compilationAttempts })),
    ...[true, "false", null, undefined].map(sourceChanged => ({ ...nativePass, sourceChanged })), ...[false, "true", null, undefined].map(sourceStabilityChecked => ({ ...nativePass, sourceStabilityChecked })),
    ...["0".repeat(64), null, undefined].map(sourceManifestSha256 => ({ ...nativePass, sourceManifestSha256 })),
    ...["0".repeat(64), null, undefined].map(previousSourceManifestSha256 => ({ ...nativePass, previousSourceManifestSha256 }))]) {
    const f = fixture(); f.state.native = native; const result = await f.execute();
    expect(result.failure).toBe("SUCCESSFUL_NATIVE_COMPILATION_RECEIPT_REQUIRED"); expect(result.artifacts).toEqual([]); expect(f.state.artifactReads).toBe(0); bounded(f, result);
  }
});

test("native receipt read failure survives the final best-effort recovery attempt", async () => {
  const f = fixture(); f.state.nativeError = "MOCK_NATIVE_RECEIPT_UNREADABLE"; const result = await f.execute();
  expect(result.failure).toBe("MOCK_NATIVE_RECEIPT_UNREADABLE"); expect(result.nativeReceipt).toBeNull(); expect(f.state.nativeReads).toBe(2); bounded(f, result);
});

test("terminal state rejects running, nonzero, OOM, missing fields, scalars and malformed JSON", async () => {
  for (const value of ["not-json", "null", "0", "false", "[]", JSON.stringify(worker), ...[{ ...terminal, Running: true }, { ...terminal, ExitCode: 137 }, { ...terminal, OOMKilled: true },
    { ...terminal, ExitCode: "0" }, { ...terminal, Running: "false" }, { Running: false, ExitCode: 0 }].map(value => JSON.stringify(value))]) {
    const f = fixture(); f.state.terminal = value; const result = await f.execute();
    expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.failure).not.toBeNull(); expect(f.state.artifactReads).toBe(0);
    expect(ids(f).filter(id => id === "worker-state")).toHaveLength(1); expect(ids(f)).toContain("worker-stop"); bounded(f, result);
  }
});

for (const count of [4, 6]) test(`${count} artifacts cannot satisfy five-artifact admission`, async () => {
  const f = fixture(); f.state.artifactRows = Array.from({ length: count }, () => ({ ...f.state.artifactRows[0]! })); const result = await f.execute();
  expect(result.failure).toBe("COMPLETE_ARTIFACTS_WITHIN_DEADLINE_REQUIRED"); expect(result.artifacts).toEqual([]); bounded(f, result);
});

test("artifact discovery failure preserves its cause and leaves artifacts unadmitted", async () => {
  const f = fixture(); f.state.artifactsError = "MOCK_ARTIFACT_FAILURE"; const result = await f.execute();
  expect(result.failure).toBe("MOCK_ARTIFACT_FAILURE"); expect(result.artifacts).toEqual([]); expect(ids(f).at(-1)).toBe("worker-remove"); bounded(f, result);
});

test("artifact validation receives only remaining normal time rather than a fresh reserve", async () => {
  const f = fixture(); f.state.costMs = 0; f.state.onRun = async id => { if (id === "worker-state") f.state.clock = plan.limits.normalOperationsMs - 37; };
  const result = await f.execute(); expect(f.state.artifactTimeouts).toEqual([37]); expect(result.status).toBe("PASS_HOST_GPU_NATIVE_BUILD_ONLY"); bounded(f, result);
});

test("artifacts completing at the normal deadline cannot spend cleanup or receipt time", async () => {
  const f = fixture(), artifacts = f.io.artifacts; f.io.artifacts = async ms => { const rows = await artifacts(ms); f.state.clock = plan.limits.normalOperationsMs; return rows; };
  const result = await f.execute(); expect(result.failure).toBe("COMPLETE_ARTIFACTS_WITHIN_DEADLINE_REQUIRED"); expect(result.artifacts).toEqual([]); bounded(f, result);
});

test("inspection at the normal cutoff admits no artifact work and is never retried", async () => {
  const f = fixture(); f.state.costMs = 0; f.state.onRun = async id => { if (id === "worker-state") f.state.clock = plan.limits.normalOperationsMs; };
  const result = await f.execute(); expect(result.failure).toBe("ARTIFACT_VALIDATION_NORMAL_DEADLINE"); expect(f.state.artifactTimeouts).toEqual([]);
  expect(ids(f).filter(id => id === "worker-state")).toHaveLength(1); bounded(f, result);
});

test("bootstrap time in startedAt cannot reset an expired normal budget", async () => {
  const f = fixture(); f.io.startedAt = 0; f.state.clock = plan.limits.normalOperationsMs; const result = await f.execute();
  expect(result.failure).toBe("HOST_BUILD_DEADLINE"); expect(result.elapsedMs).toBe(plan.limits.normalOperationsMs); expect(f.calls).toEqual([]); bounded(f, result);
});

test("bootstrap time clips each normal Docker timeout without replenishing the window", async () => {
  const f = fixture(); f.io.startedAt = 0; f.state.clock = plan.limits.normalOperationsMs - 25; const result = await f.execute();
  expect(f.calls.slice(0, 3).map(call => call.timeoutMs)).toEqual([25, 14, 3]); expect(result.failure).toBe("HOST_BUILD_DEADLINE"); bounded(f, result);
});

test("normal and cleanup deadlines shrink from one origin rather than resetting phase reserves", async () => {
  const f = fixture(); f.state.costMs = 17;
  const p = { ...plan, limits: { ...plan.limits, normalOperationsMs: 200, nativeWorkMs: 200, cleanupMs: 60, receiptReserveMs: 20, overallMs: 280, dockerCommandMs: 200, artifactValidationMs: 120 } };
  const result = await f.execute(p); expect(result.status).toBe("PASS_HOST_GPU_NATIVE_BUILD_ONLY");
  expect(f.calls.map(call => call.timeoutMs)).toEqual([200, 183, 166, 149, 192]); expect(f.state.artifactTimeouts).toEqual([120]);
  for (const call of f.calls.slice(0, 4)) expect(call.at + call.timeoutMs).toBeLessThanOrEqual(200);
  expect(f.calls[4]!.at + f.calls[4]!.timeoutMs).toBe(260); bounded(f, result);
});

test("exhausted cleanup time blocks stop, kill and remove before spending receipt reserve", async () => {
  const f = fixture(); f.state.costMs = 0; f.state.onRun = async id => { if (id === "worker-logs") f.state.clock = plan.limits.overallMs - plan.limits.receiptReserveMs; };
  const result = await f.execute(); expect(result.failure).toBe("HOST_BUILD_DEADLINE"); expect(ids(f)).toEqual(normalIds.slice(0, 3));
  expect(result.cleanupFailures).toHaveLength(3); expect(result.cleanupFailures.every(value => value.includes("HOST_BUILD_DEADLINE"))).toBe(true); bounded(f, result);
});

test("the closed operation budget blocks over-budget normal work and cleanup attempts", async () => {
  const f = fixture(), p = { ...plan, maximums: { ...plan.maximums, dockerOperations: 3 } }; const result = await f.execute(p);
  expect(result.failure).toBe("CLOSED_DOCKER_OPERATION_BUDGET"); expect(f.calls).toHaveLength(3); expect(result.cleanupFailures).toHaveLength(3); bounded(f, result, 3);
});

test("state attempt is recorded before admission so cancellation cannot produce a second inspection", async () => {
  const f = fixture(), read = f.io.nativeReceipt; f.io.nativeReceipt = async () => { const native = await read(); await f.state.stop!("HOST_BUILD_INTERRUPTED"); return native; };
  const result = await f.execute(); expect(result.failure).toBe("HOST_BUILD_INTERRUPTED"); expect(ids(f)).not.toContain("worker-state"); expect(f.state.artifactReads).toBe(0); bounded(f, result);
});

test("runtime source has no top-level execution and tests never import or call its entry point", () => {
  const start = runtimeSource.indexOf("export async function runReuseHost(p: ReusePlan, driver: string)"); expect(start).toBeGreaterThan(0);
  expect(runtimeSource.slice(0, start)).not.toMatch(/\bawait\b|Bun\.(?:spawn|file)|process\.env|\b(?:lstat|statfs|readFile|writeFile|mkdir)\(/);
  expect(runtimeSource).not.toMatch(/Bun\.spawn|spawnSync|execFile|fetch\(|docker build|docker cp|cargo install/);
});

test("runtime source verifies bootstrap epoch, both existing helpers and lock before dynamic supervisor import", () => {
  const helpers = runtimeSource.indexOf("for (const helper of p.existingHelpers)"), lock = runtimeSource.indexOf('readFile("Cargo.lock")');
  const supervisor = runtimeSource.indexOf("const { runBounded } = await import");
  expect(runtimeSource).toContain('Bun.version === "1.4.0" && Bun.argv.at(-1) === p.grant'); expect(runtimeSource).toContain("process.env.HOST_NATIVE_BUILD_STARTED_MS");
  expect(runtimeSource).toContain("const startedAt = performance.now() - elapsed");
  expect(helpers).toBeLessThan(lock); expect(lock).toBeLessThan(supervisor);
  expect(runtimeSource).toContain("77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955");
  expect(runtimeSource).toContain("delete environment.DOCKER_CONTEXT");
});

test("runtime source accounts each logical tree once and resolves artifact reads into retained target", () => {
  expect(runtimeSource).toContain("[workspace, evidence, paths.cargo, paths.target]"); expect(runtimeSource).toContain("await treeBytes(path, {");
  expect(runtimeSource).toContain("entries: async path => { remaining();"); expect(runtimeSource).toContain("size: async path => { remaining();");
  expect(runtimeSource).toContain("const chosen = readArtifacts(logs, \"gpu\")");
  expect(runtimeSource).toContain('paths.target + executable.slice("/build/native/target-gpu".length)');
  expect(runtimeSource).toContain("Math.min(normalDeadline, performance.now() + timeoutMs)");
  expect(runtimeSource).toContain("for await (const chunk of Bun.file(path).stream()) { artifactRemaining(); digest.update(chunk); artifactRemaining(); }");
  expect(runtimeSource.indexOf("requireValue(await logicalBytes()")).toBeLessThan(runtimeSource.indexOf("receipt = await executeReuseBuild"));
  expect(runtimeSource).toContain("watchWorkspace(p, paths, stop, {");
});

test("runtime source creates only fresh directories and exclusive driver, plan, deadline and receipt files", () => {
  expect(runtimeSource).toContain('await mkdir(workspace); await mkdir(paths.native); await mkdir(paths.native + "/target-gpu")');
  expect(runtimeSource).not.toContain("mkdir(paths.cargo"); expect(runtimeSource).not.toContain("mkdir(paths.target"); expect(runtimeSource).not.toContain("copyFile");
  for (const name of ["build-driver.mjs", "plan.json", "deadline.json", "receipt.json"]) expect(runtimeSource).toContain(`writeFile(evidence + "/${name}"`);
  expect(runtimeSource.match(/flag: "wx"/g)).toHaveLength(4);
  expect(runtimeSource).toContain('writeFile(evidence + "/plan.json", JSON.stringify(p)');
  expect(runtimeSource).toContain("normalDeadlineEpoch: startedEpoch + p.limits.normalOperationsMs, nativeAcceptanceReserveMs: p.limits.nativeAcceptanceReserveMs");
  expect(runtimeSource).toContain("bun.isFile() && bun.size > 0 && bun.size <= p.limits.bunPostCopyBytes");
  expect(runtimeSource).not.toMatch(/hash\([^\n]*(?:paths\.bun|paths\.cargo|paths\.target)|readFile\(paths\.bun/);
});

test("runtime source guards preflight through receipt write and post-write marker without rewriting the receipt", () => {
  const protection = runtimeSource.indexOf("const protection = protectFinalizationSignals()"), preflight = runtimeSource.indexOf('requireValue(Bun.version');
  const write = runtimeSource.indexOf('await writeFile(evidence + "/receipt.json"'), consoleMarker = runtimeSource.indexOf("console.log(JSON.stringify"), exit = runtimeSource.indexOf("process.exitCode ="), release = runtimeSource.indexOf("protection.release()");
  expect(protection).toBeLessThan(preflight); expect(write).toBeLessThan(consoleMarker); expect(consoleMarker).toBeLessThan(exit); expect(exit).toBeLessThan(release);
  expect(runtimeSource.slice(write, consoleMarker)).toContain("if (protection.observed())"); expect(runtimeSource.slice(write, consoleMarker)).toContain('receipt.failure ??= "HOST_BUILD_INTERRUPTED"');
  expect(runtimeSource).toContain("receiptStatusRequiresZeroHostMarker: true"); expect(runtimeSource).toContain("workspaceIsFilesystemQuota: false");
  expect(runtimeSource).toContain("dockerWritableLayerIncludedInWorkspaceAccounting: false"); expect(runtimeSource).toContain("parentDiagnosticsHaveOnlyPostExitSoftSizeCheck: true");
  expect(runtimeSource).toContain("cacheWritesScope: { cargoHome: paths.cargo, cargoTarget: paths.target, otherRetainedPathsWritable: false }");
  expect(runtimeSource).toContain("bytes.length <= p.limits.hostReceiptBytes");
});
