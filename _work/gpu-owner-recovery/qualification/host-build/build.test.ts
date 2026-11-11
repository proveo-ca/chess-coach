// SPEC: _spec/gpu-host-build.puml
import { beforeAll, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { lstat, mkdir, readFile, realpath, readdir, symlink, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import plan from "./plan.json";
import { docker, executeBuild, protectFinalizationSignals, treeBytes, watchWorkspace, workerCreate, type BuildIO, type DockerResult, type Paths, type TreeIO } from "./build";
import { nativeCommands, recordNativeCommand, recheckNativeSource, stageTree } from "./driver";

const scope = "SOURCE_ONLY_MOCK_NOT_HOST_EVIDENCE";
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const donor = "a".repeat(64), worker = "b".repeat(64), foreign = "c".repeat(64);
const paths: Paths = { context: "/source-only-mock/context", workspace: "/source-only-mock/workspace", evidence: "/source-only-mock/evidence",
  native: "/source-only-mock/workspace/native", cargo: "/source-only-mock/workspace/cargo-home", bun: "/source-only-mock/workspace/bun" };
const uid = 1001, gid = 1002;
const terminal = { Running: false, ExitCode: 0, OOMKilled: false };
const nativePass = { status: "PASS_NATIVE_COMPILATION_ONLY", compilationAttempts: 2, sourceChanged: false, sourceStabilityChecked: true };
const normalIds = ["donor-create", "bun-copy", "worker-create", "worker-start", "worker-logs", "worker-state", "worker-remove", "donor-remove"];
const fixtureScope = { scope, actualDockerProcesses: 0, actualNativeProcesses: 0, gpuExecuted: false,
  dockerCliCompatibilityValidated: false, nativeCliCompatibilityValidated: false, hostEvidence: false };
let evidence: string;

async function retainedJson(path: string, value: unknown) {
  const text = JSON.stringify(value, null, 2) + "\n";
  if (Buffer.byteLength(text) > 262144) throw Error("BOUNDED_SOURCE_TEST_EVIDENCE_REQUIRED");
  await writeFile(path, text, { flag: "wx" });
}

beforeAll(async () => {
  const base = process.env.HOST_BUILD_TEST_EVIDENCE;
  if (!base) throw Error("HOST_BUILD_TEST_EVIDENCE_REQUIRED");
  const runs = resolve(repository, "_work/gpu-owner-recovery/runs"), selected = resolve(repository, base);
  const name = relative(runs, selected), run = name.split(sep)[0]!;
  if (!name || isAbsolute(name) || name.startsWith("..") || !/^[A-Za-z0-9._-]*(?:source|test|verif)[A-Za-z0-9._-]*$/.test(run)) throw Error("SOURCE_VERIFIER_RUN_EVIDENCE_REQUIRED");
  const actual = relative(await realpath(runs), await realpath(selected));
  if (!actual || isAbsolute(actual) || actual.startsWith("..") || actual !== name) throw Error("REPOSITORY_OWNED_TEST_EVIDENCE_REQUIRED");
  evidence = resolve(selected, "host-build-build-tests");
  await mkdir(evidence);
  await retainedJson(evidence + "/fixture-scope.json", fixtureScope);
});

type Call = { id: string; argv: string[]; timeoutMs: number; at: number };
function fixture() {
  const calls: Call[] = [], events: { id: string; value?: unknown }[] = [];
  const state = {
    clock: 0, costMs: 11, createIds: { donor, worker } as Record<"donor" | "worker", string | null>,
    recoveredIds: { donor: null, worker: null } as Record<"donor" | "worker", string | null>,
    responses: {} as Record<string, Partial<DockerResult>>,
    throws: {} as Record<string, string>,
    terminal: JSON.stringify(terminal), native: structuredClone(nativePass) as unknown,
    artifactRows: Array.from({ length: 5 }, (_, index) => ({ executable: `/build/native/target-gpu/mock-${index}`, path: `${paths.native}/target-gpu/mock-${index}`, bytes: index + 1, sha256: String(index).repeat(64) })),
    validateError: null as string | null, nativeError: null as string | null, artifactsError: null as string | null,
    validates: 0, nativeReads: 0, artifactReads: 0, watches: 0, unwatches: 0,
    artifactTimeouts: [] as number[],
    onRun: null as ((id: string) => Promise<void>) | null,
    onUnwatch: null as (() => void | Promise<void>) | null,
    stop: null as ((reason: string) => Promise<void>) | null,
  };
  const io: BuildIO = {
    now: () => state.clock,
    run: async (id, argv, timeoutMs) => {
      calls.push({ id, argv: [...argv], timeoutMs, at: state.clock }); events.push({ id: "run:" + id });
      if (id === "donor-create") state.recoveredIds.donor = state.createIds.donor;
      if (id === "worker-create") state.recoveredIds.worker = state.createIds.worker;
      if (state.onRun) await state.onRun(id);
      state.clock += state.costMs;
      if (state.throws[id]) throw Error(state.throws[id]);
      const stdout = id === "worker-state" ? state.terminal : id === "donor-create" ? donor + "\n" : id === "worker-create" ? worker + "\n" : "";
      return { status: "PASS", exitCode: 0, failure: null, stdout, ...state.responses[id] };
    },
    recover: async kind => { const value = state.recoveredIds[kind]; events.push({ id: "recover:" + kind, value }); return value; },
    validateBun: async () => { state.validates++; events.push({ id: "validate-bun" }); if (state.validateError) throw Error(state.validateError); },
    nativeReceipt: async () => { state.nativeReads++; events.push({ id: "native-receipt" }); if (state.nativeError) throw Error(state.nativeError); return state.native; },
    artifacts: async timeoutMs => { state.artifactReads++; state.artifactTimeouts.push(timeoutMs); events.push({ id: "artifacts", value: timeoutMs }); if (state.artifactsError) throw Error(state.artifactsError); return state.artifactRows; },
    watch: stop => { state.watches++; state.stop = stop; events.push({ id: "watch" }); return () => { state.unwatches++; events.push({ id: "unwatch" }); return state.onUnwatch?.(); }; },
  };
  return { io, state, calls, events, execute: (p = plan) => executeBuild(p, paths, uid, gid, io) };
}
type Fixture = ReturnType<typeof fixture>;
type Result = Awaited<ReturnType<typeof executeBuild>>;
const ids = (f: Fixture) => f.calls.map(call => call.id);
const failed = (f: Fixture, id: string) => { f.state.responses[id] = { status: "FAIL", exitCode: 125, failure: "MOCK_CLIENT_FAILURE" }; };

function bounded(f: Fixture, result: Result, maximum = plan.maximums.dockerOperations) {
  expect(f.calls.length).toBeLessThanOrEqual(maximum);
  expect(new Set(ids(f)).size).toBe(f.calls.length);
  expect(result.results.map(row => row.id)).toEqual(ids(f));
  expect(f.state.watches).toBe(1); expect(f.state.unwatches).toBe(1);
  expect(result.hostInvocationsConsumed).toBe(1); expect(result.remainingHostInvocations).toBe(0);
  for (const key of ["automaticRetryAuthorized", "qualificationImageBuilt", "testsExecuted", "gpuDevicesRequested", "gpuExecuted", "trainingReady"] as const) expect(result[key]).toBe(false);
  for (const call of f.calls) {
    expect(call.argv.slice(0, 2)).toEqual(["docker", "--host=unix:///var/run/docker.sock"]);
    expect(Number.isInteger(call.timeoutMs) && call.timeoutMs > 0).toBe(true);
    expect(call.argv).not.toContain("buildx"); expect(call.argv).not.toContain("pull");
    expect(call.argv).not.toContain("--gpus"); expect(call.argv).not.toContain("--privileged");
    expect(call.argv).not.toContain("--tty"); expect(call.argv).not.toContain("--interactive");
    if (["start", "stop", "kill"].includes(call.argv[2]!)) expect(call.argv).not.toContain(donor);
  }
  expect(f.calls.filter(call => call.id === "donor-create").length).toBeLessThanOrEqual(1);
  expect(f.calls.filter(call => call.id === "worker-create").length).toBeLessThanOrEqual(1);
  expect(f.calls.filter(call => call.id === "worker-start").length).toBeLessThanOrEqual(1);
  expect(f.calls.filter(call => call.id === "worker-logs").length).toBeLessThanOrEqual(1);
  expect(f.calls.filter(call => call.id === "worker-state").length).toBeLessThanOrEqual(1);
  expect(f.calls.filter(call => call.id === "worker-stop").length).toBeLessThanOrEqual(1);
  expect(f.calls.filter(call => call.id === "worker-kill").length).toBeLessThanOrEqual(1);
  expect(f.calls.every(call => !call.argv.includes("--attach"))).toBe(true);
  expect(f.calls.filter(call => call.id === "bun-copy").length).toBeLessThanOrEqual(1);
}

async function retainedCase(name: string, f: Fixture, result: Result) {
  const directory = resolve(evidence, name); await mkdir(directory);
  await retainedJson(directory + "/fixture-scope.json", fixtureScope);
  await retainedJson(directory + "/result.json", { ...fixtureScope, result });
  await retainedJson(directory + "/argv.json", { ...fixtureScope, calls: f.calls });
  await retainedJson(directory + "/effects.json", { ...fixtureScope, events: f.events });
  expect(JSON.parse(await readFile(directory + "/result.json", "utf8")).scope).toBe(scope);
  expect(JSON.parse(await readFile(directory + "/argv.json", "utf8")).calls).toEqual(f.calls);
}

async function treeFixture(name: string, entries: Record<string, string>) {
  const directory = resolve(evidence, name), source = directory + "/source", destination = directory + "/destination";
  await mkdir(directory); await retainedJson(directory + "/fixture-scope.json", fixtureScope); await mkdir(source);
  for (const [path, text] of Object.entries(entries)) {
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    if (parent) await mkdir(source + "/" + parent, { recursive: true });
    await writeFile(source + "/" + path, text, { flag: "wx" });
  }
  return { directory, source, destination };
}

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function nativeFixture(index: number) {
  const command = nativeCommands()[index]!, attempts: any[] = [];
  const events: { id: string; source?: string; attempt: any }[] = [];
  const stdout = index < 3 ? ["rustc 1.95.0 (source-only-fixture)\n", "cargo 1.95.0 (source-only-fixture)\n", "23.1.0\n"][index]! : '{"reason":"compiler-artifact","scope":"SOURCE_ONLY_MOCK_NOT_HOST_EVIDENCE"}\n';
  const captures = Object.fromEntries(Object.entries({ stdout, stderr: "source-only diagnostics\n" }).map(([stream, text], number) => [stream,
    { path: `/source-only-mock/${command.id}/command.${stream}`, bytes: Buffer.byteLength(text), sha256: String(number + 1).repeat(64), text }])) as Record<string, { path: string; bytes: number; sha256: string; text: string }>;
  const state = { result: { status: "PASS", exitCode: 0, failure: null, elapsedMs: 17 } as Record<string, any>,
    executeError: null as Error | null, captureErrors: {} as Record<string, string>, mirrorErrors: {} as Record<string, string> };
  const snapshot = (id: string, source?: string) => events.push({ id, ...(source === undefined ? {} : { source }), attempt: structuredClone(attempts.at(-1)) });
  const io: Parameters<typeof recordNativeCommand>[2] = {
    execute: async () => { snapshot("execute"); if (state.executeError) throw state.executeError; return state.result; },
    capture: async stream => { snapshot("capture:" + stream); if (state.captureErrors[stream]) throw Error(state.captureErrors[stream]); return captures[stream]!; },
    mirror: async (stream, source) => { snapshot("mirror:" + stream, source); if (state.mirrorErrors[stream]) throw Error(state.mirrorErrors[stream]); },
  };
  return { command, attempts, events, state, captures, io, execute: () => recordNativeCommand(command, attempts, io) };
}

const capturedMetadata = (capture: { path: string; bytes: number; sha256: string; text: string }) => ({ path: capture.path, bytes: capture.bytes, sha256: capture.sha256 });
const metadataError = (code: string) => Object.assign(Error("SOURCE_ONLY_" + code), { code });

test("the pending proposal grants no host, publication, fetch, build, shared-worker, GPU or training authority", () => {
  expect(plan.status).toBe("SOURCE_ONLY_AWAITING_EXPLICIT_BUILD_METHOD_AND_HOST_APPROVAL");
  expect(plan.method).toBe("OWNED_DOCKER_CONTAINER_NATIVE_BUILD_ONLY_NOT_QUALIFICATION_IMAGE_BUILD");
  expect(plan.runId).toBe("host-gpu-native-build-1"); expect(plan.grant).toBe("--approved-host-gpu-native-build-1");
  expect(plan.context).toBe("_work/gpu-owner-recovery/cache/host-receive-2/context");
  expect(plan.workspace).toBe("_work/gpu-owner-recovery/cache/host-gpu-native-build-1");
  expect(plan.evidence).toBe("_work/gpu-owner-recovery/runs/host-gpu-native-build-1");
  for (const key of ["hostExecutionApproved", "stagingAndNativeCompilationApproved", "qualificationImageBuildAuthorized", "sharedBuilderModificationAuthorized", "imagePullOrDependencyFetchAuthorized", "gpuExecutionAuthorized", "trainingAuthorized", "automaticRetryAuthorized", "sourcePublicationRequired", "trainingReady"] as const) expect(plan[key]).toBe(false);
  expect(plan.helperDownloads).toBe(0);
});

test("pins, resource ceilings, phase reserves and the closed operation budget stay exact", () => {
  expect(plan.engine).toBe("unix:///var/run/docker.sock");
  expect(plan.rustImage).toBe("docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb");
  expect(plan.bunImage).toBe("docker.io/oven/bun@sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038");
  expect(plan.cudaBindingTrial).toBe("13000");
  expect(plan.resources).toEqual({ cpus: 2, memoryBytes: 8589934592, memoryPlusSwapBytes: 8589934592, cargoJobs: 2, rayonThreads: 2, uidGid: "CURRENT_OPERATOR_NUMERIC_UID_GID" });
  expect(plan.maximums).toEqual({ donorCreates: 1, donorStarts: 0, bunCopies: 1, workerCreates: 1, workerStarts: 1, workerLogFollows: 1, terminalInspections: 1, workerStops: 1, workerKills: 1, containerRemovals: 2, dockerOperations: 10, cargoCompilations: 2 });
  expect(plan.limits.normalOperationsMs + plan.limits.cleanupMs + plan.limits.receiptReserveMs).toBe(plan.limits.overallMs);
  expect(plan.limits.overallMs).toBe(4200000); expect(plan.limits.nativeWorkMs).toBe(3600000);
  expect(plan.limits.dockerCommandMs).toBe(120000); expect(plan.limits.stagingFiles).toBe(3800); expect(plan.limits.stagingBytes).toBe(536870912);
  expect(plan.limits.artifactValidationMs).toBe(120000); expect(plan.limits.hostDockerStreamsBytes).toBe(83886080);
  expect(plan.limits.hostDockerStreamsBytes).toBe(plan.maximums.dockerOperations * 2 * plan.limits.supervisedStreamBytes);
  expect(plan.limits.nativeStreamsBytes).toBe(40 * 1024 * 1024); expect(plan.limits.canonicalLogCopiesBytes).toBe(16 * 1024 * 1024);
  expect(plan.limits.hostDockerStreamsBytes + plan.limits.nativeStreamsBytes + plan.limits.canonicalLogCopiesBytes).toBe(136 * 1024 * 1024);
});

test("docker binds the local Unix endpoint without consulting a context or spawning anything", () => {
  expect(docker(plan, "container", "inspect", worker)).toEqual(["docker", "--host=unix:///var/run/docker.sock", "container", "inspect", worker]);
});

test("worker creation fixes every Docker option, writable destination, read-only input and post-image Bun argument", () => {
  const argv = workerCreate(plan, paths, uid, gid);
  expect(argv).toEqual(["docker", "--host=unix:///var/run/docker.sock", "create", "--pull=never", "--platform=linux/amd64", "--network=none", "--cpus=2", "--memory=8g", "--memory-swap=8g", "--user=1001:1002",
    "--cidfile=/source-only-mock/evidence/worker.cid", "--label=chess-coach.native-build=host-gpu-native-build-1", "--workdir=/build/native", "--entrypoint=/usr/local/bin/bun",
    "--mount", "type=bind,source=/source-only-mock/context,target=/received,readonly",
    "--mount", "type=bind,source=/source-only-mock/workspace/native,target=/build/native",
    "--mount", "type=bind,source=/source-only-mock/workspace/cargo-home,target=/capture/cargo-home",
    "--mount", "type=bind,source=/source-only-mock/context/gpu-build/llvm,target=/opt/tracel-data/tracel/tracel-llvm-23.1.0-4,readonly",
    "--mount", "type=bind,source=/source-only-mock/workspace/bun,target=/usr/local/bin/bun,readonly",
    "--mount", "type=bind,source=/source-only-mock/evidence,target=/evidence,readonly",
    "--mount", "type=bind,source=/source-only-mock/evidence/native,target=/build/native/_work/gpu-owner-recovery/runs/host-gpu-native-build-1",
    "--env", "CARGO_HOME=/capture/cargo-home", "--env", "CARGO_TARGET_DIR=/build/native/target-gpu", "--env", "CARGO_BUILD_JOBS=2", "--env", "RAYON_NUM_THREADS=2", "--env", "XDG_DATA_HOME=/opt/tracel-data",
    "--env", "CUDARC_CUDA_VERSION=13000", "--env", "CARGO_NET_OFFLINE=true", "--env", "CARGO_NET_RETRY=0", "--env", "RUSTUP_AUTO_INSTALL=0", "--env", "HOME=/build/native/_work/gpu-owner-recovery/scratch/home", "--env", "TMPDIR=/build/native/_work/gpu-owner-recovery/scratch/tmp",
    plan.rustImage, "--no-env-file", "--no-install", "/evidence/build-driver.mjs"]);
  const image = argv.indexOf(plan.rustImage);
  expect(argv.slice(image + 1)).toEqual(["--no-env-file", "--no-install", "/evidence/build-driver.mjs"]);
  expect(argv.indexOf("--entrypoint=/usr/local/bin/bun")).toBeLessThan(image);
  expect(argv.slice(0, image)).not.toContain("--no-env-file"); expect(argv.slice(0, image)).not.toContain("--no-install");
  expect(argv.join(" ")).not.toMatch(/buildx|--gpus|--device|--privileged|--security-opt|--cap-(?:add|drop)|--exclusive|--tty|--interactive|--network=host|source=\/var\/run\/docker\.sock/);
});

test("worker creation admits numeric UID/GID values, including zero, and rejects unsafe identities", () => {
  expect(workerCreate(plan, paths, 0, 0)).toContain("--user=0:0");
  for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1001", null, undefined]) {
    expect(() => workerCreate(plan, paths, invalid as number, gid)).toThrow("NUMERIC_OPERATOR_UID_GID_REQUIRED");
    expect(() => workerCreate(plan, paths, uid, invalid as number)).toThrow("NUMERIC_OPERATOR_UID_GID_REQUIRED");
  }
});

test("every mount source rejects relative paths and comma-injected mount options", () => {
  for (const key of ["context", "native", "cargo", "bun", "evidence"] as const) for (const value of ["relative", "/absolute,readonly", ""]) {
    expect(() => workerCreate(plan, { ...paths, [key]: value }, uid, gid)).toThrow("ABSOLUTE_COMMA_FREE_MOUNT_SOURCE_REQUIRED");
  }
});

test("native commands contain three exact version guards followed by only the two production no-run recipes", () => {
  const commands = nativeCommands();
  expect(commands.map(row => row.id)).toEqual(["rustc-version", "cargo-version", "llvm-version", "gpu-learning", "gpu-policy"]);
  expect(commands.slice(0, 3).map(row => row.argv)).toEqual([["rustc", "--version"], ["cargo", "--version"], ["/opt/tracel-data/tracel/tracel-llvm-23.1.0-4/bin/llvm-config", "--version"]]);
  expect(commands.slice(3).map(row => row.argv)).toEqual([
    ["cargo", "test", "--release", "--target", "x86_64-unknown-linux-gnu", "--locked", "--offline", "--jobs", "2", "-p", "chess-coach-learning", "--features", "gpu-prepared-llvm", "--test", "finite_difference", "--no-run", "--message-format=json"],
    ["cargo", "test", "--release", "--target", "x86_64-unknown-linux-gnu", "--locked", "--offline", "--jobs", "2", "-p", "chess-coach-policy-io", "--features", "gpu-prepared-llvm", "--test", "gpu", "--no-run", "--message-format=json"],
  ]);
  expect(commands.slice(3).every(row => row.version === null)).toBe(true);
});

test("version guards reject nearby versions, prereleases and wrong tools without executing a command", () => {
  const commands = nativeCommands();
  for (const [index, tool] of [[0, "rustc"], [1, "cargo"]] as const) {
    const guard = commands[index]!.version!;
    expect(guard.test(`${tool} 1.95.0 (source-only-fixture 2026-01-01)\n`)).toBe(true);
    for (const value of [`${tool} 1.95.0-nightly (fixture)`, `${tool} 1.95.01 (fixture)`, `${tool} 1.94.0 (fixture)`, `${tool} 1.95`, "other 1.95.0 (fixture)"]) expect(guard.test(value)).toBe(false);
  }
  const llvm = commands[2]!.version!;
  expect(llvm.test("23.1.0\n")).toBe(true);
  for (const value of ["23.1.00", "23.1.0git", "23.0.0", "LLVM 23.1.0", "23.1.0\nextra"]) expect(llvm.test(value)).toBe(false);
});

test("mocked integrated e2e happy path retains eight operations, five fake identities and source-only evidence", async () => {
  const f = fixture(), result = await f.execute(); await retainedCase("e2e-happy", f, result);
  expect(result.status).toBe("PASS_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.failure).toBeNull(); expect(result.cleanupFailures).toEqual([]);
  expect(ids(f)).toEqual(normalIds); expect(result.ids).toEqual({ donor, worker }); expect(result.state).toEqual(terminal);
  expect(result.nativeReceipt).toEqual(nativePass); expect(result.artifacts).toEqual(f.state.artifactRows);
  expect(f.calls[0]!.argv).toEqual(docker(plan, "create", "--pull=never", "--platform=linux/amd64", "--network=none", "--cidfile=" + paths.evidence + "/donor.cid", "--label=chess-coach.native-build=" + plan.runId, plan.bunImage));
  expect(f.calls[1]!.argv).toEqual(docker(plan, "cp", "-L", donor + ":/usr/local/bin/bun", paths.bun));
  expect(f.calls[2]!.argv).toEqual(workerCreate(plan, paths, uid, gid));
  expect(f.calls[3]!.argv).toEqual(docker(plan, "start", worker)); expect(f.calls[3]!.timeoutMs).toBe(plan.limits.dockerCommandMs);
  expect(f.calls[4]!.argv).toEqual(docker(plan, "logs", "--follow", worker)); expect(f.calls[4]!.timeoutMs).toBe(plan.limits.nativeWorkMs);
  expect(f.calls[5]!.argv).toEqual(docker(plan, "container", "inspect", "--format", "{{json .State}}", worker));
  expect(f.calls[6]!.argv).toEqual(docker(plan, "rm", worker)); expect(f.calls[7]!.argv).toEqual(docker(plan, "rm", donor));
  expect(f.state.validates).toBe(1); expect(f.state.nativeReads).toBe(1); expect(f.state.artifactReads).toBe(1);
  expect(f.state.artifactTimeouts).toEqual([plan.limits.artifactValidationMs]);
  expect(f.events.findIndex(row => row.id === "run:worker-state")).toBeLessThan(f.events.findIndex(row => row.id === "artifacts"));
  expect(f.events.findIndex(row => row.id === "unwatch")).toBeLessThan(f.events.findIndex(row => row.id === "run:worker-remove"));
  expect(f.events.filter(row => row.id === "recover:worker").map(row => row.value)).toEqual([null, worker, worker]);
  bounded(f, result);
});

test("mocked integrated e2e native failure stops the owned worker and preserves a failed receipt without artifacts", async () => {
  const f = fixture(); f.state.native = { ...nativePass, status: "FAIL_NATIVE_COMPILATION_ONLY", failure: "MOCK_COMPILATION_FAILURE" };
  const result = await f.execute(); await retainedCase("e2e-native-failure", f, result);
  expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.failure).toBe("SUCCESSFUL_NATIVE_COMPILATION_RECEIPT_REQUIRED");
  expect(ids(f)).toEqual(["donor-create", "bun-copy", "worker-create", "worker-start", "worker-logs", "worker-stop", "worker-state", "worker-remove", "donor-remove"]);
  expect(result.nativeReceipt).toEqual(f.state.native); expect(result.artifacts).toEqual([]); expect(f.state.artifactReads).toBe(0);
  expect(f.calls[5]!.argv).toEqual(docker(plan, "stop", "--time=10", worker)); bounded(f, result);
});

test("mocked integrated e2e cleanup failure cannot promote a successful compilation and still removes the donor", async () => {
  const f = fixture(); failed(f, "worker-remove");
  const result = await f.execute(); await retainedCase("e2e-cleanup-failure", f, result);
  expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.failure).toBeNull();
  expect(result.cleanupFailures).toEqual(["Error: DOCKER_OPERATION_FAILED:worker-remove"]);
  expect(ids(f)).toEqual(normalIds); expect(result.results.find(row => row.id === "worker-remove")?.status).toBe("FAIL");
  expect(f.calls.at(-1)?.argv).toEqual(docker(plan, "rm", donor)); bounded(f, result);
});

for (const operation of ["donor-create", "worker-create"]) test(`failed ${operation} recovers the CID written before the client failed and cleans only that ownership`, async () => {
  const f = fixture(), directory = resolve(evidence, "partial-cid-" + operation); await mkdir(directory);
  await retainedJson(directory + "/fixture-scope.json", fixtureScope);
  f.state.onRun = async id => {
    if (id === "donor-create") await writeFile(directory + "/donor.cid", donor + "\n", { flag: "wx" });
    if (id === "worker-create") await writeFile(directory + "/worker.cid", worker + "\n", { flag: "wx" });
  };
  f.io.recover = async kind => {
    let value: string | null;
    try { value = (await readFile(directory + "/" + kind + ".cid", "utf8")).trim(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; value = null; }
    f.events.push({ id: "recover:" + kind, value }); return value;
  };
  failed(f, operation); const result = await f.execute();
  await retainedJson(directory + "/result.json", { ...fixtureScope, result });
  await retainedJson(directory + "/argv.json", { ...fixtureScope, calls: f.calls });
  expect(result.failure).toBe("DOCKER_OPERATION_FAILED:" + operation); expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY");
  expect(ids(f)).toEqual(operation === "donor-create" ? ["donor-create", "donor-remove"] : ["donor-create", "bun-copy", "worker-create", "worker-stop", "worker-state", "worker-remove", "donor-remove"]);
  expect(f.events.some(row => row.id === "recover:" + (operation === "donor-create" ? "donor" : "worker") && row.value === (operation === "donor-create" ? donor : worker))).toBe(true);
  expect(f.calls.some(call => call.id === "worker-start")).toBe(false); expect(f.state.artifactReads).toBe(0); bounded(f, result);
});

for (const kind of ["donor", "worker"] as const) test(`a successful ${kind} create stdout scalar cannot replace a missing CID file`, async () => {
  const f = fixture(); f.state.createIds[kind] = null;
  const result = await f.execute();
  expect(result.failure).toBe(kind === "donor" ? "OWNED_DONOR_ID_REQUIRED" : "OWNED_WORKER_ID_REQUIRED");
  expect(result.ids[kind]).toBeNull(); expect(f.calls.some(call => call.id === "worker-start")).toBe(false);
  expect(f.calls.some(call => call.id === kind + "-remove")).toBe(false); bounded(f, result);
});

test("a failed create without a CID never turns stdout into cleanup authority", async () => {
  const f = fixture(); f.state.createIds.donor = null; failed(f, "donor-create");
  const result = await f.execute(); expect(ids(f)).toEqual(["donor-create"]); expect(result.ids).toEqual({ donor: null, worker: null }); bounded(f, result);
});

test("Bun copy failure admits no worker and leaves only donor cleanup", async () => {
  const f = fixture(); failed(f, "bun-copy"); const result = await f.execute();
  expect(result.failure).toBe("DOCKER_OPERATION_FAILED:bun-copy"); expect(ids(f)).toEqual(["donor-create", "bun-copy", "donor-remove"]);
  expect(f.state.validates).toBe(0); expect(f.state.artifactReads).toBe(0); bounded(f, result);
});

for (const [label, response] of [
  ["bad-status", { status: "FAIL", exitCode: 0, failure: null }],
  ["bad-exit", { status: "PASS", exitCode: 1, failure: null }],
  ["failure-with-zero-exit", { status: "PASS", exitCode: 0, failure: "MOCK_SUPERVISOR_FAILURE" }],
] as const) test(`Docker result ${label} fails closed instead of admitting the copied Bun`, async () => {
  const f = fixture(); f.state.responses["bun-copy"] = response; const result = await f.execute();
  expect(result.failure).toBe("DOCKER_OPERATION_FAILED:bun-copy"); expect(ids(f)).toEqual(["donor-create", "bun-copy", "donor-remove"]);
  expect(result.results[1]).toMatchObject({ status: "FAIL", exitCode: response.exitCode, failure: response.failure, supervisorResult: response, operationFailure: "DOCKER_OPERATION_FAILED:bun-copy" });
  expect(f.state.validates).toBe(0); expect(result.results[1]?.status).toBe("FAIL"); bounded(f, result);
});

for (const [failure, exitCode] of [["COMMAND_DEADLINE", 143], ["COMMAND_OUTPUT_BOUND", 137]] as const) test(`Docker ${failure} retains the supervisor cause and exit separately from its operation wrapper`, async () => {
  const f = fixture(), supervisor = { status: "FAIL", exitCode, failure };
  f.state.responses["worker-logs"] = { ...supervisor, stdout: scope + ": partial mocked log\n" };
  const result = await f.execute(); await retainedCase("e2e-supervisor-" + failure, f, result);
  const entry = result.results.find(row => row.id === "worker-logs");
  expect(result.failure).toBe("DOCKER_OPERATION_FAILED:worker-logs"); expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY");
  expect(entry).toMatchObject({ id: "worker-logs", ...supervisor, supervisorResult: supervisor, operationFailure: "DOCKER_OPERATION_FAILED:worker-logs" });
  expect(result.cleanupFailures).toEqual([]); expect(f.state.artifactReads).toBe(0);
  expect(result.results.every(row => !Object.hasOwn(row, "stdout"))).toBe(true);
  expect(f.state.responses["worker-logs"]).toEqual({ ...supervisor, stdout: scope + ": partial mocked log\n" });
  bounded(f, result);
});

test("a Docker IO throw before any result preserves the thrown failure without inventing supervisor metadata", async () => {
  const f = fixture(); f.state.throws["worker-logs"] = "MOCK_IO_THROW_BEFORE_RESULT";
  const result = await f.execute(), entry = result.results.find(row => row.id === "worker-logs")!;
  expect(result.failure).toBe("MOCK_IO_THROW_BEFORE_RESULT");
  expect(entry).toMatchObject({ status: "FAIL", failure: "MOCK_IO_THROW_BEFORE_RESULT", operationFailure: "MOCK_IO_THROW_BEFORE_RESULT" });
  expect(Object.hasOwn(entry, "supervisorResult")).toBe(false); expect(Object.hasOwn(entry, "exitCode")).toBe(false); expect(Object.hasOwn(entry, "stdout")).toBe(false);
  expect(result.cleanupFailures).toEqual([]); bounded(f, result);
});

test("a full mocked 4-MiB log stays outside receipt metadata while raw trimmed inspection stdout still drives terminal validation", async () => {
  const f = fixture(), prefix = scope + ": MOCK_LOG_NOT_RECEIPT_METADATA:";
  const stdout = prefix + "x".repeat(plan.limits.supervisedStreamBytes - Buffer.byteLength(prefix));
  f.state.responses["worker-logs"] = { stdout }; f.state.terminal = "\n  " + JSON.stringify(terminal) + " \n";
  const result = await f.execute(), encoded = JSON.stringify(result);
  expect(Buffer.byteLength(stdout)).toBe(4194304); expect(result.status).toBe("PASS_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.state).toEqual(terminal);
  expect(result.results.every(row => !Object.hasOwn(row, "stdout"))).toBe(true);
  expect(encoded.includes(prefix)).toBe(false); expect(Buffer.byteLength(encoded)).toBeLessThan(plan.limits.hostReceiptBytes);
  expect(f.state.responses["worker-logs"]?.stdout?.length).toBe(stdout.length);
  for (const row of result.results) expect(row).toMatchObject({ supervisorResult: { status: "PASS", exitCode: 0, failure: null } });
  bounded(f, result);
});

for (const failure of ["COMMAND_DEADLINE", "COMMAND_OUTPUT_BOUND"]) test(`cleanup ${failure} retains raw evidence while cleanupFailures and the primary build failure keep their operation context`, async () => {
  const f = fixture(); failed(f, "worker-logs");
  const supervisor = { status: "FAIL", exitCode: 137, failure }; f.state.responses["worker-stop"] = supervisor;
  const result = await f.execute(), entry = result.results.find(row => row.id === "worker-stop");
  expect(result.failure).toBe("DOCKER_OPERATION_FAILED:worker-logs");
  expect(entry).toMatchObject({ ...supervisor, supervisorResult: supervisor, operationFailure: "DOCKER_OPERATION_FAILED:worker-stop" });
  expect(result.cleanupFailures).toEqual(["Error: DOCKER_OPERATION_FAILED:worker-stop"]); expect(ids(f)).toContain("worker-kill");
  expect(ids(f).slice(-2)).toEqual(["worker-remove", "donor-remove"]); bounded(f, result);
});

test("copied Bun admission failure stops before creating or starting a worker", async () => {
  const f = fixture(); f.state.validateError = "COPIED_BUN_FILE_ADMISSION_FAILED"; const result = await f.execute();
  expect(result.failure).toBe("COPIED_BUN_FILE_ADMISSION_FAILED"); expect(ids(f)).toEqual(["donor-create", "bun-copy", "donor-remove"]);
  expect(f.state.validates).toBe(1); bounded(f, result);
});

for (const operation of ["worker-start", "worker-logs"]) for (const mode of ["nonzero", "thrown"] as const) test(`${mode} ${operation} failure stops once, inspects once and removes both containers without retry`, async () => {
  const f = fixture();
  if (mode === "nonzero") failed(f, operation); else f.state.throws[operation] = "MOCK_DOCKER_IO_THROW";
  const result = await f.execute();
  expect(result.failure).toBe(mode === "nonzero" ? "DOCKER_OPERATION_FAILED:" + operation : "MOCK_DOCKER_IO_THROW");
  expect(ids(f)).toEqual([...normalIds.slice(0, operation === "worker-start" ? 4 : 5), "worker-stop", "worker-state", "worker-remove", "donor-remove"]);
  expect(result.artifacts).toEqual([]); expect(f.state.nativeReads).toBe(1); bounded(f, result);
});

for (const [label, receipt] of [
  ["absent", null], ["empty", {}], ["failed", { ...nativePass, status: "FAIL_NATIVE_COMPILATION_ONLY" }],
  ["one-attempt", { ...nativePass, compilationAttempts: 1 }], ["three-attempts", { ...nativePass, compilationAttempts: 3 }],
  ["string-attempt-count", { ...nativePass, compilationAttempts: "2" }], ["source-changed", { ...nativePass, sourceChanged: true }],
  ["string-source-change", { ...nativePass, sourceChanged: "false" }], ["missing-source-change", { status: nativePass.status, compilationAttempts: 2, sourceStabilityChecked: true }],
  ["unchecked", { ...nativePass, sourceStabilityChecked: false }], ["unknown-change", { ...nativePass, sourceChanged: null, sourceStabilityChecked: false }],
  ["string-stability-check", { ...nativePass, sourceStabilityChecked: "true" }], ["missing-stability-check", { status: nativePass.status, compilationAttempts: 2, sourceChanged: false }],
] as const) test(`native receipt ${label} cannot certify the host build`, async () => {
  const f = fixture(); f.state.native = receipt; const result = await f.execute();
  expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.failure).toBe("SUCCESSFUL_NATIVE_COMPILATION_RECEIPT_REQUIRED");
  expect(f.state.artifactReads).toBe(0); expect(ids(f).filter(id => id === "worker-stop")).toHaveLength(1); bounded(f, result);
});

test("an unreadable native receipt remains a failure even when the final best-effort read also fails", async () => {
  const f = fixture(); f.state.nativeError = "MOCK_NATIVE_RECEIPT_UNREADABLE"; const result = await f.execute();
  expect(result.failure).toBe("MOCK_NATIVE_RECEIPT_UNREADABLE"); expect(result.nativeReceipt).toBeNull(); expect(f.state.nativeReads).toBe(2);
  expect(f.state.artifactReads).toBe(0); bounded(f, result);
});

for (const [label, state] of [
  ["running", { ...terminal, Running: true }], ["OOM", { ...terminal, OOMKilled: true }], ["nonzero", { ...terminal, ExitCode: 137 }],
  ["string-exit", { ...terminal, ExitCode: "0" }], ["string-running", { ...terminal, Running: "false" }], ["missing-OOM", { Running: false, ExitCode: 0 }],
] as const) test(`terminal state ${label} stops the worker and denies artifact admission`, async () => {
  const f = fixture(); f.state.terminal = JSON.stringify(state); const result = await f.execute();
  expect(result.failure).toBe("SUCCESSFUL_TERMINAL_CONTAINER_STATE_REQUIRED"); expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY");
  expect(ids(f)).toEqual(["donor-create", "bun-copy", "worker-create", "worker-start", "worker-logs", "worker-state", "worker-stop", "worker-remove", "donor-remove"]);
  expect(f.state.artifactReads).toBe(0); bounded(f, result);
});

test("invalid and scalar inspection JSON cannot become terminal-state success", async () => {
  for (const text of ["not-json", "null", "0", "false", JSON.stringify(worker), "[]"]) {
    const f = fixture(); f.state.terminal = text; const result = await f.execute();
    expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.failure).not.toBeNull(); expect(f.state.artifactReads).toBe(0);
    expect(ids(f).filter(id => id === "worker-state")).toHaveLength(1); expect(ids(f)).toContain("worker-stop"); bounded(f, result);
  }
});

test("stop failure consumes one bounded kill fallback and still fits the ten-operation ceiling", async () => {
  const f = fixture(); failed(f, "worker-logs"); failed(f, "worker-stop"); const result = await f.execute();
  expect(ids(f)).toEqual(["donor-create", "bun-copy", "worker-create", "worker-start", "worker-logs", "worker-stop", "worker-kill", "worker-state", "worker-remove", "donor-remove"]);
  expect(f.calls[5]!.timeoutMs).toBe(20000); expect(f.calls[6]!.timeoutMs).toBe(15000);
  expect(f.calls[6]!.argv).toEqual(docker(plan, "kill", "--signal=KILL", worker));
  expect(result.cleanupFailures).toEqual(["Error: DOCKER_OPERATION_FAILED:worker-stop"]); expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); bounded(f, result);
});

test("stop and kill failures remain separate cleanup evidence while both removals still run", async () => {
  const f = fixture(); failed(f, "worker-logs"); failed(f, "worker-stop"); failed(f, "worker-kill"); const result = await f.execute();
  expect(result.failure).toBe("DOCKER_OPERATION_FAILED:worker-logs");
  expect(result.cleanupFailures).toEqual(["Error: DOCKER_OPERATION_FAILED:worker-stop", "Error: DOCKER_OPERATION_FAILED:worker-kill"]);
  expect(ids(f).slice(-2)).toEqual(["worker-remove", "donor-remove"]); expect(f.calls).toHaveLength(10); bounded(f, result);
});

for (const operation of ["worker-state", "donor-remove"]) test(`${operation} failure cannot certify success or trigger replacement containers`, async () => {
  const f = fixture(); failed(f, operation); const result = await f.execute();
  expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY");
  if (operation === "worker-state") { expect(result.failure).toBe("DOCKER_OPERATION_FAILED:worker-state"); expect(f.state.artifactReads).toBe(0); expect(ids(f)).toContain("worker-stop"); }
  else expect(result.cleanupFailures).toEqual(["Error: DOCKER_OPERATION_FAILED:donor-remove"]);
  expect(ids(f).at(-1)).toBe("donor-remove"); bounded(f, result);
});

test("malformed CIDs never authorize a start, stop, kill, inspect or removal of an arbitrary target", async () => {
  for (const value of ["", "--all", "other-container", "a".repeat(63), "a".repeat(65), "A".repeat(64), "g".repeat(64), JSON.stringify(worker), worker + ";echo unsafe"]) {
    const f = fixture(); f.state.createIds.worker = value; const result = await f.execute();
    expect(result.failure).toBe("OWNED_CONTAINER_ID_RECOVERY_FAILED"); expect(result.ids.worker).toBeNull(); expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY");
    expect(ids(f)).toEqual(["donor-create", "bun-copy", "worker-create", "donor-remove"]); bounded(f, result);
  }
});

test("a malformed donor CID cannot authorize the Bun copy or arbitrary donor cleanup", async () => {
  const f = fixture(); f.state.createIds.donor = "--all"; const result = await f.execute();
  expect(result.failure).toBe("OWNED_CONTAINER_ID_RECOVERY_FAILED"); expect(ids(f)).toEqual(["donor-create"]); bounded(f, result);
});

test("a CID scalar changing after ownership was recorded cannot transfer cleanup to another container", async () => {
  const f = fixture(), recover = f.io.recover; let workerReads = 0;
  f.io.recover = async kind => kind === "worker" && ++workerReads === 3 ? foreign : recover(kind);
  const result = await f.execute();
  expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.ids.worker).toBe(worker);
  expect(result.cleanupFailures).toContain("Error: OWNED_CONTAINER_ID_RECOVERY_FAILED");
  expect(f.calls.find(call => call.id === "worker-remove")?.argv).toEqual(docker(plan, "rm", worker));
  expect(f.calls.every(call => !call.argv.includes(foreign))).toBe(true); bounded(f, result);
});

test("interruption after the Bun copy blocks every subsequent normal Docker operation", async () => {
  const f = fixture(); f.state.onRun = async id => { if (id === "bun-copy") await f.state.stop!("HOST_BUILD_INTERRUPTED"); };
  const result = await f.execute(); expect(result.failure).toBe("HOST_BUILD_INTERRUPTED");
  expect(ids(f)).toEqual(["donor-create", "bun-copy", "donor-remove"]); expect(f.state.artifactReads).toBe(0); bounded(f, result);
});

test("interruption during worker creation recovers its new CID for cleanup without ever starting", async () => {
  const f = fixture(); f.state.onRun = async id => { if (id === "worker-create") await f.state.stop!("HOST_BUILD_INTERRUPTED"); };
  const result = await f.execute(); expect(result.failure).toBe("HOST_BUILD_INTERRUPTED"); expect(result.ids.worker).toBe(worker);
  expect(ids(f)).toEqual(["donor-create", "bun-copy", "worker-create", "worker-stop", "worker-state", "worker-remove", "donor-remove"]);
  expect(f.state.artifactReads).toBe(0); bounded(f, result);
});

test("repeated watcher cancellations keep the first reason and stop the worker only once", async () => {
  const f = fixture(); f.state.onRun = async id => { if (id === "worker-logs") { await f.state.stop!("HOST_BUILD_INTERRUPTED"); await f.state.stop!("WORKSPACE_SOFT_LIMIT_OR_FREE_SPACE"); } };
  const result = await f.execute();
  expect(result.failure).toBe("HOST_BUILD_INTERRUPTED"); expect(ids(f).filter(id => id === "worker-stop")).toHaveLength(1);
  expect(ids(f).filter(id => id === "worker-kill")).toHaveLength(0); expect(f.state.artifactReads).toBe(0); bounded(f, result);
});

test("normal and cleanup timeouts derive from separate shrinking monotonic deadlines without resetting reserves", async () => {
  const f = fixture(); f.state.costMs = 17;
  const p = { ...plan, limits: { ...plan.limits, normalOperationsMs: 200, nativeWorkMs: 200, cleanupMs: 60, receiptReserveMs: 20, overallMs: 280, dockerCommandMs: 200, artifactValidationMs: 120 } };
  const result = await f.execute(p);
  expect(result.status).toBe("PASS_HOST_GPU_NATIVE_BUILD_ONLY");
  expect(f.calls.map(call => call.timeoutMs)).toEqual([200, 183, 166, 149, 132, 115, 158, 141]); expect(f.state.artifactTimeouts).toEqual([98]);
  for (const call of f.calls.slice(0, 6)) expect(call.at + call.timeoutMs).toBeLessThanOrEqual(p.limits.normalOperationsMs);
  for (const call of f.calls.slice(6)) expect(call.at + call.timeoutMs).toBeLessThanOrEqual(p.limits.overallMs - p.limits.receiptReserveMs);
  bounded(f, result);
});

test("an expired initial normal deadline starts no Docker operation", async () => {
  const f = fixture(); let reads = 0; f.io.now = () => reads++ === 0 ? 0 : plan.limits.normalOperationsMs;
  const result = await f.execute(); expect(result.failure).toBe("HOST_BUILD_DEADLINE"); expect(f.calls).toHaveLength(0); bounded(f, result);
});

test("a donor create finishing at the normal deadline permits owned cleanup but not a late Bun copy", async () => {
  const f = fixture(); f.state.costMs = 0; f.state.onRun = async id => { if (id === "donor-create") f.state.clock = plan.limits.normalOperationsMs; };
  const result = await f.execute(); expect(result.failure).toBe("HOST_BUILD_DEADLINE"); expect(ids(f)).toEqual(["donor-create", "donor-remove"]); bounded(f, result);
});

test("exhausted cleanup time cannot run stop, kill, inspect or removal past the receipt reserve", async () => {
  const f = fixture(); f.state.costMs = 0; f.state.onRun = async id => { if (id === "worker-logs") f.state.clock = plan.limits.overallMs - plan.limits.receiptReserveMs; };
  const result = await f.execute(); expect(result.failure).toBe("HOST_BUILD_DEADLINE");
  expect(ids(f)).toEqual(["donor-create", "bun-copy", "worker-create", "worker-start", "worker-logs"]); expect(f.state.artifactReads).toBe(0);
  expect(result.cleanupFailures).toHaveLength(4); expect(result.cleanupFailures.every(value => value.includes("HOST_BUILD_DEADLINE"))).toBe(true); bounded(f, result);
});

test("the closed operation ceiling prevents every over-budget Docker call, including cleanup retries", async () => {
  const f = fixture(), p = { ...plan, maximums: { ...plan.maximums, dockerOperations: 4 } }; const result = await f.execute(p);
  expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.failure).toBe("CLOSED_DOCKER_OPERATION_BUDGET");
  expect(ids(f)).toEqual(["donor-create", "bun-copy", "worker-create", "worker-start"]); expect(f.state.artifactReads).toBe(0);
  expect(result.cleanupFailures).toHaveLength(4); bounded(f, result, 4);
});

for (const count of [4, 6]) test(`${count} artifact identities cannot satisfy the exact five-artifact admission`, async () => {
  const f = fixture(); f.state.artifactRows = Array.from({ length: count }, () => ({ ...f.state.artifactRows[0]! }));
  const result = await f.execute(); expect(result.failure).toBe("COMPLETE_ARTIFACTS_WITHIN_DEADLINE_REQUIRED");
  expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(ids(f)).toContain("worker-stop"); bounded(f, result);
});

test("artifact discovery failure remains failure and still runs owned cleanup", async () => {
  const f = fixture(); f.state.artifactsError = "MOCK_ARTIFACT_READ_FAILURE"; const result = await f.execute();
  expect(result.failure).toBe("MOCK_ARTIFACT_READ_FAILURE"); expect(result.artifacts).toEqual([]); expect(ids(f).slice(-2)).toEqual(["worker-remove", "donor-remove"]); bounded(f, result);
});

test("five artifacts completing at the normal deadline cannot spend the cleanup or receipt reserves", async () => {
  const f = fixture(), artifacts = f.io.artifacts;
  f.io.artifacts = async timeoutMs => { const rows = await artifacts(timeoutMs); f.state.clock = plan.limits.normalOperationsMs; return rows; };
  const result = await f.execute(); expect(result.failure).toBe("COMPLETE_ARTIFACTS_WITHIN_DEADLINE_REQUIRED");
  expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(ids(f)).toEqual([...normalIds.slice(0, 6), "worker-stop", "worker-remove", "donor-remove"]); bounded(f, result);
});

test("preflight time supplied by startedAt cannot reset an already-expired normal deadline", async () => {
  const f = fixture(); f.io.startedAt = 0; f.state.clock = plan.limits.normalOperationsMs;
  const result = await f.execute();
  expect(result.failure).toBe("HOST_BUILD_DEADLINE"); expect(result.elapsedMs).toBe(plan.limits.normalOperationsMs);
  expect(f.calls).toEqual([]); expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); bounded(f, result);
});

test("a supplied start origin clips the first Docker timeout instead of granting another normal window", async () => {
  const f = fixture(); f.io.startedAt = 0; f.state.clock = plan.limits.normalOperationsMs - 25;
  const result = await f.execute();
  expect(f.calls[0]?.timeoutMs).toBe(25); expect(f.calls[1]?.timeoutMs).toBe(14); expect(f.calls[2]?.timeoutMs).toBe(3);
  expect(result.failure).toBe("HOST_BUILD_DEADLINE"); expect(ids(f)).not.toContain("worker-start"); bounded(f, result);
});

for (const clientFails of [false, true]) test(`cancellation during pending start waits for the ${clientFails ? "failed" : "successful"} client result before stopping and never follows logs`, async () => {
  const f = fixture(), entered = deferred<void>(), release = deferred<void>(); let finalized = false;
  f.state.onRun = async id => { if (id === "worker-start") { entered.resolve(undefined); await release.promise; f.events.push({ id: "mock-start-settled" }); } };
  if (clientFails) failed(f, "worker-start");
  const running = f.execute().then(result => { finalized = true; return result; });
  try {
    await entered.promise; await f.state.stop!("HOST_BUILD_INTERRUPTED"); await f.state.stop!("WORKSPACE_SOFT_LIMIT_OR_FREE_SPACE");
    expect(finalized).toBe(false); expect(ids(f)).toEqual(normalIds.slice(0, 4)); expect(ids(f)).not.toContain("worker-stop");
    release.resolve(undefined); const result = await running;
    expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.failure).toBe("HOST_BUILD_INTERRUPTED");
    expect(ids(f)).toEqual([...normalIds.slice(0, 4), "worker-stop", "worker-state", "worker-remove", "donor-remove"]);
    expect(f.events.findIndex(row => row.id === "mock-start-settled")).toBeLessThan(f.events.findIndex(row => row.id === "run:worker-stop"));
    expect(f.state.artifactReads).toBe(0); bounded(f, result);
  } finally { release.resolve(undefined); await running; }
});

test("cancellation during an outstanding log follower can stop the worker before that follower settles", async () => {
  const f = fixture(), entered = deferred<void>(), release = deferred<void>(); let finalized = false;
  f.state.onRun = async id => { if (id === "worker-logs") { entered.resolve(undefined); await release.promise; f.events.push({ id: "mock-logs-settled" }); } };
  const running = f.execute().then(result => { finalized = true; return result; });
  try {
    await entered.promise; await f.state.stop!("HOST_BUILD_INTERRUPTED");
    expect(ids(f)).toEqual([...normalIds.slice(0, 5), "worker-stop"]); expect(finalized).toBe(false);
    expect(ids(f)).not.toContain("worker-remove"); expect(f.events.some(row => row.id === "mock-logs-settled")).toBe(false);
    release.resolve(undefined); const result = await running;
    expect(result.failure).toBe("HOST_BUILD_INTERRUPTED"); expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY");
    expect(ids(f).filter(id => id === "worker-stop")).toHaveLength(1); expect(f.state.artifactReads).toBe(0); bounded(f, result);
  } finally { release.resolve(undefined); await running; }
});

test("asynchronous watcher drain can still fail an otherwise-good build before removals or PASS finalization", async () => {
  const f = fixture(), closeEntered = deferred<void>(), releaseClose = deferred<void>(), stopEntered = deferred<void>(), releaseStop = deferred<void>(); let finalized = false;
  f.state.onUnwatch = async () => { closeEntered.resolve(undefined); await releaseClose.promise; await Promise.resolve(); await f.state.stop!("WORKSPACE_MONITOR_FAILED"); f.events.push({ id: "monitor-drained" }); };
  f.state.onRun = async id => { if (id === "worker-stop") { stopEntered.resolve(undefined); await releaseStop.promise; } };
  const running = f.execute().then(result => { finalized = true; return result; });
  try {
    await closeEntered.promise; expect(ids(f)).toEqual(normalIds.slice(0, 6)); expect(finalized).toBe(false);
    releaseClose.resolve(undefined); await stopEntered.promise; await Promise.resolve();
    expect(finalized).toBe(false); expect(ids(f)).not.toContain("worker-remove"); expect(ids(f)).not.toContain("donor-remove");
    releaseStop.resolve(undefined); const result = await running; await retainedCase("e2e-watcher-drain", f, result);
    expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(result.failure).toBe("WORKSPACE_MONITOR_FAILED");
    expect(f.events.findIndex(row => row.id === "monitor-drained")).toBeLessThan(f.events.findIndex(row => row.id === "run:worker-remove"));
    expect(ids(f)).toEqual([...normalIds.slice(0, 6), "worker-stop", "worker-remove", "donor-remove"]); bounded(f, result);
  } finally { releaseClose.resolve(undefined); releaseStop.resolve(undefined); await running; }
});

test("cleanup joins cached stop work even when the watcher closer returns before that stop completes", async () => {
  const f = fixture(), stopEntered = deferred<void>(), releaseStop = deferred<void>(); let finalized = false;
  f.state.onUnwatch = () => { void f.state.stop!("HOST_BUILD_INTERRUPTED"); return Promise.resolve(); };
  f.state.onRun = async id => { if (id === "worker-stop") { stopEntered.resolve(undefined); await releaseStop.promise; } };
  const running = f.execute().then(result => { finalized = true; return result; });
  try {
    await stopEntered.promise; await Promise.resolve();
    expect(finalized).toBe(false); expect(ids(f)).not.toContain("worker-remove"); expect(ids(f)).not.toContain("donor-remove");
    releaseStop.resolve(undefined); const result = await running;
    expect(result.failure).toBe("HOST_BUILD_INTERRUPTED"); expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); bounded(f, result);
  } finally { releaseStop.resolve(undefined); await running; }
});

test("the finalization guardian registers exactly SIGTERM and SIGINT on a fake emitter and keeps a sticky observation", () => {
  const signals = new EventEmitter(), protection = protectFinalizationSignals(signals);
  try {
    expect(signals.eventNames()).toEqual(["SIGTERM", "SIGINT"]); expect(signals.listenerCount("SIGTERM")).toBe(1); expect(signals.listenerCount("SIGINT")).toBe(1);
    expect(protection.observed()).toBe(false); signals.emit("SOURCE_ONLY_UNRELATED_EVENT"); expect(protection.observed()).toBe(false);
    signals.emit("SIGTERM"); expect(protection.observed()).toBe(true); signals.emit("SIGINT"); expect(protection.observed()).toBe(true);
    protection.release(); expect(signals.listenerCount("SIGTERM")).toBe(0); expect(signals.listenerCount("SIGINT")).toBe(0); expect(protection.observed()).toBe(true);
  } finally { protection.release(); }
});

test("releasing an unobserved guardian prevents late fake signals from mutating its state", () => {
  const signals = new EventEmitter(), protection = protectFinalizationSignals(signals);
  try {
    expect(protection.observed()).toBe(false); protection.release(); protection.release();
    expect(signals.emit("SIGTERM")).toBe(false); expect(signals.emit("SIGINT")).toBe(false);
    expect(protection.observed()).toBe(false); expect(signals.eventNames()).toEqual([]);
  } finally { protection.release(); }
});

test("guardian release removes only its own listeners and preserves independently owned signal handlers", () => {
  const signals = new EventEmitter(), observed: string[] = [];
  const term = () => { observed.push("TERM"); }, interrupt = () => { observed.push("INT"); };
  signals.on("SIGTERM", term); signals.on("SIGINT", interrupt); const protection = protectFinalizationSignals(signals);
  try {
    expect(signals.listenerCount("SIGTERM")).toBe(2); expect(signals.listenerCount("SIGINT")).toBe(2);
    protection.release(); expect(signals.listeners("SIGTERM")).toEqual([term]); expect(signals.listeners("SIGINT")).toEqual([interrupt]);
    signals.emit("SIGTERM"); signals.emit("SIGINT"); expect(observed).toEqual(["TERM", "INT"]); expect(protection.observed()).toBe(false);
  } finally { protection.release(); signals.off("SIGTERM", term); signals.off("SIGINT", interrupt); }
});

test("draining and closing the workspace monitor leaves the independent fake-emitter guardian active", async () => {
  const signals = new EventEmitter(), protection = protectFinalizationSignals(signals), entered = deferred<void>(), releaseScan = deferred<number>(), reasons: string[] = [];
  const monitor = watchWorkspace(plan, paths, async reason => { reasons.push(reason); }, {
    free: async () => { entered.resolve(undefined); return releaseScan.promise; }, bytes: async () => 0,
  });
  try {
    const checking = monitor.check(); await entered.promise; const closing = monitor.close();
    expect(signals.listenerCount("SIGTERM")).toBe(1); expect(signals.listenerCount("SIGINT")).toBe(1);
    releaseScan.resolve(plan.limits.minimumRunningFreeBytes); await Promise.all([checking, closing]);
    expect(protection.observed()).toBe(false); signals.emit("SIGTERM"); expect(protection.observed()).toBe(true);
    await monitor.check(); monitor.interrupt(); await Promise.resolve(); expect(reasons).toEqual([]);
    expect(signals.listenerCount("SIGTERM")).toBe(1); expect(signals.listenerCount("SIGINT")).toBe(1);
    protection.release(); expect(signals.eventNames()).toEqual([]);
  } finally { releaseScan.resolve(plan.limits.minimumRunningFreeBytes); await monitor.close(); protection.release(); }
});

test("the guardian can observe a fake SIGTERM during owned cleanup after the pipeline watcher has closed", async () => {
  const signals = new EventEmitter(), protection = protectFinalizationSignals(signals), f = fixture(), entered = deferred<void>(), releaseCleanup = deferred<void>(); let completed = false;
  f.state.onRun = async id => { if (id === "worker-remove") { entered.resolve(undefined); await releaseCleanup.promise; } };
  const running = f.execute().then(result => { completed = true; return result; });
  try {
    await entered.promise; expect(f.state.unwatches).toBe(1); expect(completed).toBe(false); expect(protection.observed()).toBe(false);
    signals.emit("SIGTERM"); expect(protection.observed()).toBe(true); expect(signals.listenerCount("SIGTERM")).toBe(1);
    releaseCleanup.resolve(undefined); const result = await running;
    expect(completed).toBe(true); expect(ids(f).slice(-2)).toEqual(["worker-remove", "donor-remove"]); expect(protection.observed()).toBe(true); bounded(f, result);
  } finally { releaseCleanup.resolve(undefined); await running; protection.release(); }
});

test("the guardian remains observable throughout pending mock receipt IO until explicit release", async () => {
  const signals = new EventEmitter(), protection = protectFinalizationSignals(signals), entered = deferred<void>(), releaseWrite = deferred<void>(); let written = false;
  const writing = (async () => { entered.resolve(undefined); await releaseWrite.promise; written = true; })();
  try {
    await entered.promise; expect(written).toBe(false); expect(protection.observed()).toBe(false);
    signals.emit("SIGTERM"); expect(protection.observed()).toBe(true); await Promise.resolve(); expect(written).toBe(false);
    expect(signals.listenerCount("SIGTERM")).toBe(1); expect(signals.listenerCount("SIGINT")).toBe(1);
    releaseWrite.resolve(undefined); await writing; expect(written).toBe(true); expect(protection.observed()).toBe(true);
    protection.release(); expect(signals.eventNames()).toEqual([]);
  } finally { releaseWrite.resolve(undefined); await writing; protection.release(); }
});

for (const priorFailure of [false, true]) test(`watcher closer errors ${priorFailure ? "preserve the earlier failure" : "prevent success"} without skipping owned cleanup`, async () => {
  const f = fixture(); if (priorFailure) failed(f, "worker-logs");
  f.state.onUnwatch = async () => { await Promise.resolve(); throw Error("MOCK_CLOSE_FAILURE"); };
  const result = await f.execute();
  expect(result.failure).toBe(priorFailure ? "DOCKER_OPERATION_FAILED:worker-logs" : "WORKSPACE_MONITOR_SHUTDOWN_FAILED:Error: MOCK_CLOSE_FAILURE");
  expect(result.status).toBe("FAIL_HOST_GPU_NATIVE_BUILD_ONLY"); expect(ids(f).slice(-2)).toEqual(["worker-remove", "donor-remove"]);
  expect(ids(f).filter(id => id === "worker-state")).toHaveLength(1); expect(ids(f).filter(id => id === "worker-stop")).toHaveLength(1); bounded(f, result);
});

test("terminal inspection finishing at the normal deadline cannot admit artifact work using cleanup time", async () => {
  const f = fixture(); f.state.costMs = 0; f.state.onRun = async id => { if (id === "worker-state") f.state.clock = plan.limits.normalOperationsMs; };
  const result = await f.execute();
  expect(result.failure).toBe("ARTIFACT_VALIDATION_NORMAL_DEADLINE"); expect(f.state.artifactTimeouts).toEqual([]);
  expect(ids(f).filter(id => id === "worker-state")).toHaveLength(1); expect(ids(f)).toContain("worker-stop"); bounded(f, result);
});

test("artifact validation receives only the remaining normal milliseconds, not a fresh 120-second window", async () => {
  const f = fixture(); f.state.costMs = 0; f.state.onRun = async id => { if (id === "worker-state") f.state.clock = plan.limits.normalOperationsMs - 37; };
  const result = await f.execute(); expect(result.status).toBe("PASS_HOST_GPU_NATIVE_BUILD_ONLY"); expect(f.state.artifactTimeouts).toEqual([37]); bounded(f, result);
});

for (const [label, paused, value, rejected, reason] of [
  ["low-free-space", "free", plan.limits.minimumRunningFreeBytes - 1, false, "WORKSPACE_SOFT_LIMIT_OR_FREE_SPACE"],
  ["free-scan-error", "free", 0, true, "WORKSPACE_MONITOR_FAILED"],
  ["workspace-overflow", "bytes", plan.limits.workspaceSoftBytes + 1, false, "WORKSPACE_SOFT_LIMIT_OR_FREE_SPACE"],
  ["byte-scan-error", "bytes", 0, true, "WORKSPACE_MONITOR_FAILED"],
  ["exact-boundaries", "free", plan.limits.minimumRunningFreeBytes, false, null],
] as const) test(`watchWorkspace close drains an in-flight ${label} scan and its stop before allowing completion`, async () => {
  const scan = deferred<number>(), scanEntered = deferred<void>(), stopEntered = deferred<void>(), releaseStop = deferred<void>();
  const calls = { free: 0, bytes: 0 }, reasons: string[] = []; let closed = false;
  const monitor = watchWorkspace(plan, paths, async reason => { reasons.push(reason); stopEntered.resolve(undefined); await releaseStop.promise; }, {
    free: async () => { calls.free++; if (paused === "free") { scanEntered.resolve(undefined); return scan.promise; } return plan.limits.minimumRunningFreeBytes; },
    bytes: async () => { calls.bytes++; if (paused === "bytes") { scanEntered.resolve(undefined); return scan.promise; } return plan.limits.workspaceSoftBytes; },
  });
  try {
    const checking = monitor.check(); expect(monitor.check()).toBe(checking); await scanEntered.promise;
    const closing = monitor.close().then(() => { closed = true; }); await Promise.resolve(); expect(closed).toBe(false);
    if (rejected) scan.reject(Error("MOCK_SCAN_FAILURE")); else scan.resolve(value);
    if (reason !== null) {
      await stopEntered.promise; await Promise.resolve(); expect(closed).toBe(false); expect(reasons).toEqual([reason]); releaseStop.resolve(undefined);
    }
    await Promise.all([checking, closing]); expect(closed).toBe(true); expect(reasons).toEqual(reason === null ? [] : [reason]);
    expect(calls).toEqual({ free: 1, bytes: paused === "free" && reason !== null ? 0 : 1 });
    const retainedCalls = { ...calls }; await monitor.check(); monitor.interrupt(); await Promise.resolve(); await monitor.close();
    expect(calls).toEqual(retainedCalls); expect(reasons).toEqual(reason === null ? [] : [reason]);
  } finally { scan.resolve(plan.limits.minimumRunningFreeBytes); releaseStop.resolve(undefined); await monitor.close(); }
});

test("watchWorkspace close joins a manual interrupt stop and blocks later interrupts and checks", async () => {
  const entered = deferred<void>(), release = deferred<void>(), reasons: string[] = []; let scans = 0, closed = false;
  const monitor = watchWorkspace(plan, paths, async reason => { reasons.push(reason); entered.resolve(undefined); await release.promise; }, {
    free: async () => { scans++; return plan.limits.minimumRunningFreeBytes; }, bytes: async () => { scans++; return 0; },
  });
  try {
    monitor.interrupt(); await entered.promise; const closing = monitor.close().then(() => { closed = true; });
    await Promise.resolve(); expect(closed).toBe(false); monitor.interrupt(); await monitor.check();
    expect(reasons).toEqual(["HOST_BUILD_INTERRUPTED"]); expect(scans).toBe(0);
    release.resolve(undefined); await closing; await monitor.check(); monitor.interrupt(); await Promise.resolve();
    expect(closed).toBe(true); expect(reasons).toEqual(["HOST_BUILD_INTERRUPTED"]); expect(scans).toBe(0);
  } finally { release.resolve(undefined); await monitor.close(); }
});

test("treeBytes tolerates disappearing child files and directories while retaining surviving metadata totals", async () => {
  const calls: string[] = [], root = "/source-only-mock/metadata";
  const entry = (name: string, directory = false) => ({ name, isDirectory: () => directory });
  const files: TreeIO = {
    entries: async path => {
      calls.push("entries:" + path);
      if (path === root) return [entry("one"), entry("missing-file"), entry("missing-directory", true), entry("nested", true)];
      if (path === root + "/missing-directory") throw metadataError("ENOENT");
      if (path === root + "/nested") return [entry("two")];
      throw Error("UNEXPECTED_SOURCE_FIXTURE_PATH");
    },
    size: async path => { calls.push("size:" + path); if (path.endsWith("/missing-file")) throw metadataError("ENOENT"); return path.endsWith("/one") ? 3 : 7; },
  };
  expect(await treeBytes(root, files)).toBe(10);
  expect(calls).toEqual(["entries:" + root, "size:" + root + "/one", "size:" + root + "/missing-file", "entries:" + root + "/missing-directory", "entries:" + root + "/nested", "size:" + root + "/nested/two"]);
});

for (const code of ["ENOENT", "EACCES", "EIO"]) test(`treeBytes preserves root ${code} rather than treating a missing or unreadable root as empty`, async () => {
  const error = metadataError(code); let sizes = 0;
  await expect(treeBytes("/source-only-mock/root", { entries: async () => { throw error; }, size: async () => { sizes++; return 0; } })).rejects.toBe(error);
  expect(sizes).toBe(0);
});

for (const directory of [false, true]) for (const code of ["EACCES", "EIO"]) test(`treeBytes propagates child ${directory ? "directory" : "file"} ${code} instead of suppressing non-ENOENT errors`, async () => {
  const root = "/source-only-mock/root", error = metadataError(code);
  await expect(treeBytes(root, { entries: async path => { if (path !== root) throw error; return [{ name: "child", isDirectory: () => directory }]; }, size: async () => { throw error; } })).rejects.toBe(error);
});

for (const index of [0, 1, 2, 3, 4]) test(`native command ${index} registers its attempt before execution and records results and captures before optional mirroring`, async () => {
  const f = nativeFixture(index); await f.execute();
  expect(f.attempts).toHaveLength(1); expect(f.events[0]?.attempt).toEqual({ id: f.command.id, argv: f.command.argv, attempted: true, status: "STARTED", streams: [], captureFailures: [], canonicalCopyFailures: [] });
  expect(f.events[1]?.attempt).toMatchObject(f.state.result);
  expect(f.events.map(row => row.id)).toEqual(index < 3 ? ["execute", "capture:stdout", "capture:stderr"] : ["execute", "capture:stdout", "mirror:stdout", "capture:stderr", "mirror:stderr"]);
  const attempt = f.attempts[0]; expect(attempt).toMatchObject({ ...f.state.result, id: f.command.id, argv: f.command.argv, attempted: true, captureFailures: [], canonicalCopyFailures: [] });
  expect(attempt.streams).toEqual([capturedMetadata(f.captures.stdout!), capturedMetadata(f.captures.stderr!)]);
  for (const stream of ["stdout", "stderr"]) {
    const mirror = f.events.find(row => row.id === "mirror:" + stream);
    if (index < 3) expect(mirror).toBeUndefined();
    else { expect(mirror?.source).toBe(f.captures[stream]!.path); expect(mirror?.attempt.streams).toContainEqual(capturedMetadata(f.captures[stream]!)); }
  }
  expect(JSON.stringify(attempt.streams)).not.toContain('"text"');
});

for (const streams of [["stdout"], ["stderr"], ["stdout", "stderr"]]) test(`a successful Cargo command with canonical copy failures in ${streams.join("+")} retains its real result and both captures`, async () => {
  const f = nativeFixture(3); for (const stream of streams) f.state.mirrorErrors[stream] = "MOCK_CANONICAL_COPY_FAILURE";
  await expect(f.execute()).rejects.toThrow("NATIVE_CAPTURE_OR_COPY_FAILED:" + f.command.id);
  expect(f.attempts[0]).toMatchObject(f.state.result); expect(f.attempts[0].captureFailures).toEqual([]);
  expect(f.attempts[0].canonicalCopyFailures).toEqual(streams.map(stream => stream + ":Error: MOCK_CANONICAL_COPY_FAILURE"));
  expect(f.attempts[0].streams).toEqual([capturedMetadata(f.captures.stdout!), capturedMetadata(f.captures.stderr!)]);
  expect(f.events.filter(row => row.id.startsWith("mirror:")).map(row => row.id)).toEqual(["mirror:stdout", "mirror:stderr"]);
});

for (const streams of [["stdout"], ["stderr"], ["stdout", "stderr"]]) test(`capture failures in ${streams.join("+")} retain every other stream and never mirror an uncaptured source`, async () => {
  const f = nativeFixture(4); for (const stream of streams) f.state.captureErrors[stream] = "MOCK_CAPTURE_FAILURE";
  await expect(f.execute()).rejects.toThrow("NATIVE_CAPTURE_OR_COPY_FAILED:" + f.command.id);
  const kept = ["stdout", "stderr"].filter(stream => !streams.includes(stream));
  expect(f.attempts[0]).toMatchObject(f.state.result); expect(f.attempts[0].captureFailures).toEqual(streams.map(stream => stream + ":Error: MOCK_CAPTURE_FAILURE"));
  expect(f.attempts[0].canonicalCopyFailures).toEqual([]); expect(f.attempts[0].streams).toEqual(kept.map(stream => capturedMetadata(f.captures[stream]!)));
  expect(f.events.filter(row => row.id.startsWith("mirror:")).map(row => row.id)).toEqual(kept.map(stream => "mirror:" + stream));
  expect(f.events.filter(row => row.id.startsWith("capture:")).map(row => row.id)).toEqual(["capture:stdout", "capture:stderr"]);
});

for (const index of [0, 1, 2]) test(`successful guard ${index} with a missing capture fails auxiliary admission without attempting a canonical copy`, async () => {
  const f = nativeFixture(index); f.state.captureErrors.stdout = "MOCK_GUARD_CAPTURE_FAILURE";
  await expect(f.execute()).rejects.toThrow("NATIVE_CAPTURE_OR_COPY_FAILED:" + f.command.id);
  expect(f.attempts[0]).toMatchObject(f.state.result); expect(f.attempts[0].streams).toEqual([capturedMetadata(f.captures.stderr!)]);
  expect(f.attempts[0].captureFailures).toEqual(["stdout:Error: MOCK_GUARD_CAPTURE_FAILURE"]); expect(f.attempts[0].canonicalCopyFailures).toEqual([]);
  expect(f.events.some(row => row.id.startsWith("mirror:"))).toBe(false);
});

for (const index of [0, 3]) test(`failed ${index === 0 ? "guard" : "Cargo"} commands retain both successful captures and the actual failure result`, async () => {
  const f = nativeFixture(index); f.state.result = { status: "FAIL", exitCode: 101, failure: "MOCK_NATIVE_FAILURE" };
  await expect(f.execute()).rejects.toThrow("NATIVE_COMMAND_FAILED:" + f.command.id);
  expect(f.attempts[0]).toMatchObject(f.state.result); expect(f.attempts[0].streams).toEqual([capturedMetadata(f.captures.stdout!), capturedMetadata(f.captures.stderr!)]);
  expect(f.attempts[0].captureFailures).toEqual([]); expect(f.attempts[0].canonicalCopyFailures).toEqual([]);
});

for (const index of [0, 1, 2, 3, 4]) test(`failed native command ${index} stays the primary failure despite auxiliary capture or canonical-copy errors`, async () => {
  const f = nativeFixture(index); f.state.result = { status: "FAIL", exitCode: 101, failure: "MOCK_NATIVE_FAILURE", elapsedMs: 19 };
  f.state.captureErrors.stdout = "MOCK_CAPTURE_FAILURE"; f.state.mirrorErrors.stderr = "MOCK_CANONICAL_COPY_FAILURE";
  await expect(f.execute()).rejects.toThrow("NATIVE_COMMAND_FAILED:" + f.command.id);
  expect(f.attempts[0]).toMatchObject(f.state.result); expect(f.attempts[0].captureFailures).toEqual(["stdout:Error: MOCK_CAPTURE_FAILURE"]);
  expect(f.attempts[0].streams).toEqual([capturedMetadata(f.captures.stderr!)]);
  expect(f.attempts[0].canonicalCopyFailures).toEqual(index < 3 ? [] : ["stderr:Error: MOCK_CANONICAL_COPY_FAILURE"]);
});

test("a native supervisor failure with zero exit remains primary and preserves otherwise complete captures", async () => {
  const f = nativeFixture(3); f.state.result = { status: "PASS", exitCode: 0, failure: "MOCK_NATIVE_SUPERVISOR_FAILURE" };
  f.state.mirrorErrors.stdout = "MOCK_CANONICAL_COPY_FAILURE";
  await expect(f.execute()).rejects.toThrow("NATIVE_COMMAND_FAILED:" + f.command.id);
  expect(f.attempts[0]).toMatchObject(f.state.result); expect(f.attempts[0].streams).toHaveLength(2);
  expect(f.attempts[0].canonicalCopyFailures).toEqual(["stdout:Error: MOCK_CANONICAL_COPY_FAILURE"]);
});

for (const result of [{ status: "FAIL", exitCode: 0, failure: null }, { status: "PASS", exitCode: 1, failure: null }]) test(`native ${result.status}/${result.exitCode} cannot bypass command admission because its other result fields look successful`, async () => {
  const f = nativeFixture(4); f.state.result = result;
  await expect(f.execute()).rejects.toThrow("NATIVE_COMMAND_FAILED:" + f.command.id);
  expect(f.attempts[0]).toMatchObject(result); expect(f.attempts[0].streams).toHaveLength(2);
});

test("native execute throws retain the registered attempt and original error without inventing capture or copy results", async () => {
  const f = nativeFixture(3), error = Error("MOCK_NATIVE_EXECUTE_THROW"); f.state.executeError = error;
  await expect(f.execute()).rejects.toBe(error);
  expect(f.events.map(row => row.id)).toEqual(["execute"]); expect(f.attempts).toHaveLength(1);
  expect(f.attempts[0]).toMatchObject({ id: f.command.id, argv: f.command.argv, attempted: true, status: "FAIL", failure: String(error), streams: [], captureFailures: [], canonicalCopyFailures: [] });
  expect(f.attempts[0].exitCode).toBeUndefined(); expect(f.events[0]?.attempt.status).toBe("STARTED");
});

for (const index of [0, 1, 2]) test(`a successful guard ${index} still rejects mismatched version text after retaining both captures`, async () => {
  const f = nativeFixture(index); f.captures.stdout!.text = "wrong-tool-version\n";
  await expect(f.execute()).rejects.toThrow("NATIVE_VERSION_MISMATCH:" + f.command.id);
  expect(f.attempts[0]).toMatchObject(f.state.result); expect(f.attempts[0].streams).toHaveLength(2);
  expect(f.attempts[0].captureFailures).toEqual([]); expect(f.attempts[0].canonicalCopyFailures).toEqual([]);
  expect(f.events.some(row => row.id.startsWith("mirror:"))).toBe(false);
});

for (const changed of [false, true]) test(`source recheck records a checked ${changed ? "changed" : "unchanged"} inventory only after both deadline checks`, async () => {
  const initial = [{ path: "fixture.rs", sha256: "a".repeat(64) }], after = structuredClone(initial), calls: string[] = [];
  if (changed) after[0]!.sha256 = "b".repeat(64);
  const result = await recheckNativeSource(initial, async () => { calls.push("read"); return after; }, () => { calls.push("remaining"); return 100; });
  expect(result).toEqual({ sourceChanged: changed, sourceStabilityChecked: true, sourceCheckFailure: null }); expect(calls).toEqual(["remaining", "read", "remaining"]);
  expect(initial[0]!.sha256).toBe("a".repeat(64));
});

for (const missing of ["inventory", "reader", "both"] as const) test(`source recheck with missing ${missing} reports unknown stability rather than unchanged source`, async () => {
  let reads = 0, checks = 0;
  const initial = missing === "reader" ? [] : null;
  const read = missing === "inventory" ? async () => { reads++; return []; } : null;
  const result = await recheckNativeSource(initial, read, () => { checks++; return 100; });
  expect(result).toEqual({ sourceChanged: null, sourceStabilityChecked: false, sourceCheckFailure: "INITIAL_INVENTORY_UNAVAILABLE" });
  expect(reads).toBe(0); expect(checks).toBe(0);
});

test("a failed source inventory read reports unchecked stability with the explicit read failure", async () => {
  const calls: string[] = [], error = Error("MOCK_INVENTORY_READ_FAILURE");
  const result = await recheckNativeSource([], async () => { calls.push("read"); throw error; }, () => { calls.push("remaining"); return 100; });
  expect(result).toEqual({ sourceChanged: null, sourceStabilityChecked: false, sourceCheckFailure: String(error) }); expect(calls).toEqual(["remaining", "read"]);
});

for (const expires of ["before-read", "after-read"]) test(`source recheck deadline ${expires} cannot claim unchanged or checked stability`, async () => {
  let checks = 0, reads = 0;
  const result = await recheckNativeSource([], async () => { reads++; return []; }, () => { if (++checks === (expires === "before-read" ? 1 : 2)) throw Error("NATIVE_BUILD_DEADLINE"); return 100; });
  expect(result).toEqual({ sourceChanged: null, sourceStabilityChecked: false, sourceCheckFailure: "Error: NATIVE_BUILD_DEADLINE" });
  expect(reads).toBe(expires === "before-read" ? 0 : 1); expect(checks).toBe(expires === "before-read" ? 1 : 2);
});

test("stageTree copies only a tiny retained repository fixture and counts UTF-8 bytes across nested directories", async () => {
  const entries = { "alpha.txt": "source-only\n", "nested/beta.txt": "π\n" }, f = await treeFixture("stage-exact", entries);
  const bytes = Object.values(entries).reduce((total, value) => total + Buffer.byteLength(value), 0), budget = { bytes: 0, files: 0 }; let checks = 0;
  const p = { ...plan, limits: { ...plan.limits, stagingBytes: bytes, stagingFiles: 2 } };
  await stageTree(f.source, f.destination, budget, p, () => { checks++; return 100; });
  expect(budget).toEqual({ bytes, files: 2 }); expect(checks).toBe(5); expect(await treeBytes(f.destination)).toBe(bytes);
  for (const [path, value] of Object.entries(entries)) { expect(await readFile(f.destination + "/" + path, "utf8")).toBe(value); expect(await readFile(f.source + "/" + path, "utf8")).toBe(value); }
  await retainedJson(f.directory + "/staging-result.json", { ...fixtureScope, budget, checks });
});

for (const dimension of ["bytes", "files"] as const) test(`stageTree enforces the shared ${dimension} bound before copying the exceeding file`, async () => {
  const f = await treeFixture("stage-over-" + dimension, { "one.txt": "abcd" }), budget = { bytes: 4, files: 1 };
  const p = { ...plan, limits: { ...plan.limits, stagingBytes: dimension === "bytes" ? 7 : 8, stagingFiles: dimension === "files" ? 1 : 2 } };
  await expect(stageTree(f.source, f.destination, budget, p, () => 100)).rejects.toThrow("STAGING_BUDGET");
  expect(budget).toEqual({ bytes: 8, files: 2 }); expect(await readdir(f.destination)).toEqual([]); expect(await readFile(f.source + "/one.txt", "utf8")).toBe("abcd");
});

test("stageTree COPYFILE_EXCL retains a preexisting destination and fails rather than overwriting it", async () => {
  const f = await treeFixture("stage-exclusive", { "one.txt": "new-source" }); await mkdir(f.destination);
  await writeFile(f.destination + "/one.txt", "retained-old-destination", { flag: "wx" });
  await expect(stageTree(f.source, f.destination, { bytes: 0, files: 0 }, plan, () => 100)).rejects.toMatchObject({ code: "EEXIST" });
  expect(await readFile(f.destination + "/one.txt", "utf8")).toBe("retained-old-destination"); expect(await readFile(f.source + "/one.txt", "utf8")).toBe("new-source");
});

test("stageTree rejects fixture symlinks without copying their targets", async () => {
  const f = await treeFixture("stage-link", {}); await writeFile(f.directory + "/target.txt", "source-only-target", { flag: "wx" });
  await symlink("../target.txt", f.source + "/link.txt");
  await expect(stageTree(f.source, f.destination, { bytes: 0, files: 0 }, plan, () => 100)).rejects.toThrow("STAGING_REGULAR_FILE_REQUIRED");
  expect(await readdir(f.destination)).toEqual([]); expect(await readFile(f.directory + "/target.txt", "utf8")).toBe("source-only-target");
});

test("stageTree checks its remaining budget before traversal and again before each entry", async () => {
  const f = await treeFixture("stage-deadline", { "one.txt": "source-only" }), budget = { bytes: 0, files: 0 }; let checks = 0;
  await expect(stageTree(f.source, f.destination, budget, plan, () => { if (++checks === 2) throw Error("NATIVE_BUILD_DEADLINE"); return 100; })).rejects.toThrow("NATIVE_BUILD_DEADLINE");
  expect(checks).toBe(2); expect(budget).toEqual({ bytes: 0, files: 0 }); expect(await readdir(f.destination)).toEqual([]);
  await expect(stageTree(f.source, f.directory + "/never-created", budget, plan, () => { throw Error("NATIVE_BUILD_DEADLINE"); })).rejects.toThrow("NATIVE_BUILD_DEADLINE");
  expect(await readdir(f.directory)).not.toContain("never-created");
});

test("treeBytes counts only metadata and does not follow a dangling fixture symlink", async () => {
  const f = await treeFixture("tree-metadata", { "one.txt": "abc", "nested/two.txt": "雪" });
  await symlink("missing-fixture-target", f.source + "/dangling");
  const link = await lstat(f.source + "/dangling");
  expect(await treeBytes(f.source)).toBe(3 + Buffer.byteLength("雪") + link.size);
  const source = await readFile(new URL("./build.ts", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("export async function treeBytes("), source.indexOf("export function watchWorkspace("));
  expect(body).toContain("lstat(path)"); expect(body).not.toMatch(/readFile|Bun\.file|\.stream\(/);
});
