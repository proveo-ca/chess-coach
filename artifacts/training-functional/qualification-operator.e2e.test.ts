// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { afterAll, expect, spyOn, test } from "bun:test";
import * as crypto from "node:crypto";
import * as fileIO from "node:fs/promises";
import type { CommandLimits, CommandResult, OperatorIO, PreparedInputManifest, WorkerIO } from "./qualification-operator";
import type { R4Coordinator, R4Input, R4Observation } from "./r4-observation";
import type { NativeObservation, NativeObserver } from "../../packages/runtime/src/fixed-attempt";
import type { AttemptSetup } from "../../packages/runtime/src/training-coordinator";

const spawn = spyOn(Bun, "spawn").mockImplementation(() => { throw new Error("FORBIDDEN_REAL_PROCESS"); });
const syncSpawn = spyOn(Bun, "spawnSync").mockImplementation(() => { throw new Error("FORBIDDEN_REAL_PROCESS"); });
const kill = spyOn(process, "kill").mockImplementation(() => true);
const realHash = crypto.createHash, mockPins = new Map<string, string>();
const hashes = spyOn(crypto, "createHash").mockImplementation((algorithm, options) => {
  const hash = realHash(algorithm, options), update = hash.update.bind(hash), digest = hash.digest.bind(hash); let pin: string | undefined;
  hash.update = ((data: Parameters<typeof hash.update>[0]) => { if (algorithm === "sha256") pin = mockPins.get(realHash("sha256").update(data).digest("hex")); update(data); return hash; }) as typeof hash.update;
  hash.digest = ((encoding?: crypto.BinaryToTextEncoding) => pin && encoding === "hex" ? pin : encoding ? digest(encoding) : digest()) as typeof hash.digest;
  return hash;
});
const { boundedQualificationCommand, createQualificationTrace, writeQualificationChunks, qualificationDockerCreate, qualificationInputManifest, qualificationMode, qualificationPlan,
  QUALIFICATION_LIMITS, REFERENCE_FILES, BINDING_ROLES, GPU_QUERY, runQualificationOperator, runQualificationWorker,
  validateQualificationInputs, WORKER_INPUT } = await import("./qualification-operator");
afterAll(() => { hashes.mockRestore(); spawn.mockRestore(); syncSpawn.mockRestore(); kill.mockRestore(); });
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));
const sha = (value: Uint8Array) => realHash("sha256").update(value).digest("hex");
const pass = (stdout: Uint8Array = Buffer.alloc(0), extra: Partial<CommandResult> = {}): CommandResult => ({ stdout, stderr: Buffer.alloc(0), exitCode: 0, signal: null,
  exited: true, reaped: true, stdoutEOF: true, stderrEOF: true, forced: false, error: null, ...extra });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const CID = "a".repeat(64), plan = qualificationPlan();
const evidence = { status: "PASS_RETAINED_FUNCTIONAL_EVIDENCE", scope: "INPUTS_UNATTESTED_FUNCTIONAL_EVIDENCE_ONLY", qualified: false, failures: [] as string[], proof: null } as const;
const report = { scope: plan.scope, status: "PASS", canonical: "PASS", r4: "PASS", functional: evidence.status, qualified: false, trainingReady: false, failures: [] as string[], rawQualified: false, nativeTrace: "COMPLETE" } as const;
function inputs(app = "/app", reference = "/app/reference", documents = "/app/qualification-inputs") {
  const files = new Map<string, Uint8Array>();
  const sourcePaths = ["artifacts/training-functional/qualification-operator.ts", "artifacts/training-functional/qualification.ts", "artifacts/training-functional/r4-observation.ts",
    "artifacts/training-functional/qualification-evidence.ts", "artifacts/training-functional/qualification-policy-score.ts", "artifacts/training-functional/qualification-policy-channel.ts",
    "node_modules/zod/package.json", "packages/runtime/src/fixed-attempt.ts", "packages/runtime/src/training-coordinator.ts"];
  const source = sourcePaths.map((path, i) => { const value = path.endsWith("package.json") ? bytes({ name: "zod", version: "4.6.7" }) : bytes({ mockSource: i }); files.set(`${app}/${path}`, value); return { path, byteLength: value.byteLength, sha256: sha(value) }; });
  const bindingDocuments = BINDING_ROLES.map(role => { const value = bytes({ mockDocument: role }); files.set(`${documents}/${role}.bin`, value); return { role, source: { path: `mock-inputs/${role}.json`, byteLength: value.byteLength, sha256: sha(value) }, futurePath: `/app/qualification-inputs/${role}.bin` }; });
  for (const [i, row] of REFERENCE_FILES.entries()) { const value = Buffer.alloc(row.byteLength); value.write(`MOCK_REFERENCE_NOT_EVALUATED_${i}`); files.set(`${reference}/${row.path}`, value); mockPins.set(sha(value), row.sha256); }
  const manifest = qualificationInputManifest({ scope: "FOURTEEN_ACTUAL_DOCUMENT_REFS_NOT_STAGED_NOT_EXECUTION_AUTHORITY", documents: bindingDocuments }, source);
  files.set(`${documents}/input-manifest.json`, bytes(manifest));
  const read = async (path: string, cap: number) => {
    const value = files.get(path); if (!value) throw new Error(`MOCK_MISSING:${path}`);
    if (value.byteLength > cap) throw new Error("MOCK_READ_CAP"); return Uint8Array.from(value);
  };
  return { files, read, manifest, save: () => files.set(`${documents}/input-manifest.json`, bytes(manifest)) };
}
function operator() {
  const memory = inputs(plan.source, plan.reference, plan.documents), start = deferred<void>(), running = deferred<CommandResult>();
  const commands: { argv: readonly string[]; limits: CommandLimits }[] = [], writes = new Map<string, Uint8Array>(), dirs: string[] = [], waits: (() => void)[] = [];
  let time = 0, hold = false, gpuCount = 0, onGPU: (index: number) => CommandResult | Promise<CommandResult> = () => pass(Buffer.from(`${plan.gpu}, 4096\n`));
  let onDocker: ((verb: string) => CommandResult | undefined) | undefined;
  const io: OperatorIO = {
    now: () => time, alarm: () => () => {}, wait: () => new Promise(resolve => { waits.push(resolve); }),
    context: async () => ({ cwd: plan.host, realpath: plan.host, executable: plan.cachedBun, entrypoint: `${plan.source}/artifacts/training-functional/qualification-operator.ts` }),
    read: async (path, cap) => path.endsWith("/evidence/worker-report.json") ? bytes(report) : path.endsWith("/evidence/functional-evidence.json") ? bytes(evidence) : memory.read(path, cap),
    write: async (path, value) => { if (writes.has(path)) throw new Error("MOCK_EXCLUSIVE"); writes.set(path, Uint8Array.from(value)); },
    absent: async () => {}, mkdir: async path => { dirs.push(path); }, requirePath: async () => {}, alias: async () => {},
    command: async (argv, limits) => {
      commands.push({ argv, limits });
      if (argv[0] === "nvidia-smi") return onGPU(gpuCount++);
      const verb = argv[2]!;
      if (verb === "start") { start.resolve(); if (hold) return running.promise; }
      const override = onDocker?.(verb); if (override) return override;
      if (verb === "create") return pass(Buffer.from(CID + "\n"));
      if (verb === "stop" || verb === "kill") { running.resolve(pass(Buffer.alloc(0), { exitCode: 143 })); return pass(); }
      if (verb === "inspect") return pass(bytes({ Running: false, ExitCode: 0, OOMKilled: false, Dead: false, Error: "", Status: "exited" }));
      return pass();
    },
  };
  return { io, memory, commands, writes, dirs, start: start.promise, finish: (result = pass()) => running.resolve(result),
    hold: () => { hold = true; }, tick: async (ms = 2000) => { time += ms; const wake = waits.shift(); expect(wake).toBeDefined(); wake!(); for (let i = 0; i < 30; i++) await Promise.resolve(); },
    gpu: (value: typeof onGPU) => { onGPU = value; }, docker: (value: NonNullable<typeof onDocker>) => { onDocker = value; }, setTime: (value: number) => { time = value; } };
}
function worker() {
  const memory = inputs(), writes = new Map<string, Uint8Array>(), sequence: string[] = [];
  const alarms: { ms: number; fire: () => void; cancelled: boolean }[] = []; let time = 0;
  let canonicalCalls = 0, initCalls = 0, factoryCalls = 0, coordinatorCalls = 0, closeCalls = 0, observed: R4Input | null = null, observer: NativeObserver | null = null;
  const coordinator: R4Coordinator = { initializeMaster: () => { throw new Error("MOCK_UNUSED"); }, runAttempt: async () => { throw new Error("MOCK_UNUSED"); }, snapshot: () => { throw new Error("MOCK_UNUSED"); }, close: () => { closeCalls++; sequence.push("close"); } };
  const create: AttemptSetup = async () => { throw new Error("MOCK_UNUSED"); };
  const r4 = { scope: "COMPOSITION_ONLY_INPUTS_UNQUALIFIED", qualified: false, status: "PASS", initialRecord: null, initialState: null, initialSnapshot: null, attempts: [], close: { calls: 1, status: "PASS", cleanupDeadlineNs: "300000000000" }, failures: [] } as R4Observation;
  const io: WorkerIO = {
    now: () => time, alarm: (ms, fire) => { const alarm = { ms, fire, cancelled: false }; alarms.push(alarm); return () => { alarm.cancelled = true; }; }, wait: async () => {}, alias: async () => {},
    context: async () => ({ cwd: "/app", realpath: "/app", executable: "/usr/local/bin/bun", entrypoint: "/app/artifacts/training-functional/qualification-operator.ts" }),
    read: memory.read, write: async (path, value) => { writes.set(path, Uint8Array.from(value)); sequence.push(`write:${path}`); },
    writeChunks: async (path, chunks) => { const retained: Uint8Array[] = []; for (const chunk of chunks) retained.push(Uint8Array.from(chunk)); writes.set(path, Buffer.concat(retained)); sequence.push(`write:${path}`); },
    command: async (argv, limits) => { initCalls++; sequence.push("initialize"); expect(argv).toEqual(["/usr/local/bin/policy-initialize", "101"]); expect(limits).toMatchObject({ deadlineMs: 10000, cleanupDeadlineMs: 11000, stdoutBytes: 1048576, stderrBytes: 65536 }); return pass(Uint8Array.from([0, 255, 0, 7])); },
    observeCanonical: async input => { canonicalCalls++; sequence.push("canonical"); expect(Object.keys(input).sort()).toEqual(["clockNs", "sessionId"]); expect(input.sessionId).toBe("qualification-canonical-1"); expect(input.clockNs!()).toBe(0n); return { status: "PASS", error: null } as Awaited<ReturnType<WorkerIO["observeCanonical"]>>; },
    loadCorpus: async () => { sequence.push("corpus"); return {} as Awaited<ReturnType<WorkerIO["loadCorpus"]>>; },
    loadStrategic: async () => { sequence.push("strategic"); return {} as Awaited<ReturnType<WorkerIO["loadStrategic"]>>; },
    createFactory: (_corpus, _strategic, layout, tap) => { factoryCalls++; expect(layout).toBeUndefined(); observer = tap; return { create }; },
    createCoordinator: (root, bindings) => { coordinatorCalls++; expect(root).toBe("/state/run"); expect(Object.keys(bindings).sort()).toEqual([...BINDING_ROLES].sort()); return coordinator; },
    observeR4: async input => { sequence.push("r4"); observed = input; expect(input.coordinator).toBe(coordinator); expect(input.createOwned).toBe(create);
      expect(input.initialRecord.config).toEqual({ version: "chess-coach.model-config.v1", architecture: "mlp-relu-32", featureVersion: "chess-coach.features.v1", inputFeatures: 2271, hiddenUnits: 32, recordSha256: sha(Uint8Array.from([0, 255, 0, 7])) });
      observer!({ kind: "reply", attemptId: "r4-m101-a0000", channel: "a", json: '{"result":{"kind":"scored","logits":[0]}}', receivedNs: 23n });
      await input.coordinator.close(); return r4; },
    readback: root => { expect(root).toBe("/state/run"); expect(closeCalls).toBe(1); sequence.push("readback"); return {} as ReturnType<WorkerIO["readback"]>; },
    checkEvidence: input => { expect(input.r4).toBe(r4); expect(input.native).toHaveLength(1); expect(closeCalls).toBe(1); sequence.push("check"); return evidence as ReturnType<WorkerIO["checkEvidence"]>; },
  };
  return { io, memory, writes, sequence, r4, coordinator, alarms, setTime: (value: number) => { time = value; }, observed: () => observed, observer: () => observer!, counts: () => ({ canonicalCalls, initCalls, factoryCalls, coordinatorCalls, closeCalls }) };
}

test("MOCK inert imports and explicit CLI discrimination never launch default modes", () => {
  expect(spawn).not.toHaveBeenCalled(); expect(syncSpawn).not.toHaveBeenCalled();
  for (const args of [[], ["--run"], ["operator", "--approved"], ["worker", "extra"], ["unknown"]]) expect(qualificationMode(true, args)).toBeNull();
  expect(qualificationMode(false, ["operator"])).toBeNull(); expect(qualificationMode(true, ["operator"])).toBe("operator"); expect(qualificationMode(true, ["worker"])).toBe("worker");
  expect(plan).toMatchObject({ delivery: "INPUTS_PENDING", qualified: false, trainingReady: false, reservation: false, commandCount: { natural: 4, withStopAndKill: 6, maximum: 7 } });
});
test("MOCK one fixed container mounts only fresh writable parents and immutable retained paths", () => {
  const argv = qualificationDockerCreate();
  for (const option of ["--pull=never", "--platform=linux/amd64", "--network=none", "--cpus=2", "--memory=8g", "--memory-swap=8g", "--user=1000:1000", "--runtime=nvidia", `--gpus=device=${plan.gpu}`, plan.image]) expect(argv).toContain(option);
  expect(argv.slice(-5)).toEqual(["/usr/local/bin/bun", "--no-env-file", "--no-install", "/app/artifacts/training-functional/qualification-operator.ts", "worker"]);
  expect(plan.mounts.filter(m => !m.readonly).map(m => m.target)).toEqual(["/state", "/tmp", "/scratch/home", "/evidence"]);
  expect(plan.mounts.some(m => m.target === "/state/run" || m.target === "/tmp/episode-model")).toBe(false);
  expect(plan.mounts.filter(m => !m.readonly).every(m => m.source.startsWith(plan.root + "/"))).toBe(true);
  expect(plan.mounts.filter(m => m.source.includes("/cache/")).every(m => m.readonly)).toBe(true);
});
test("MOCK prepared physical manifests bind exactly fourteen documents and reject changed bytes or reference pins", async () => {
  const env = inputs(); const alias = async () => {};
  const bindings = await validateQualificationInputs({ read: env.read, alias }, WORKER_INPUT); expect(Object.keys(bindings)).toHaveLength(14);
  env.files.set("/app/qualification-inputs/source.bin", Buffer.from(env.files.get("/app/qualification-inputs/source.bin")!).fill(7));
  await expect(validateQualificationInputs({ read: env.read, alias }, WORKER_INPUT)).rejects.toThrow("BINDING_HASH");
  const other = inputs(); other.manifest.reference[0]!.sha256 = "f".repeat(64); other.save();
  await expect(validateQualificationInputs({ read: other.read, alias }, WORKER_INPUT)).rejects.toThrow("REFERENCE_PINS");
});
test("MOCK duplicate, renamed, missing, unsafe and unprepared source documents fail before operational effects", async () => {
  for (const mutate of [
    (m: PreparedInputManifest) => { m.documents[1] = m.documents[0]!; },
    (m: PreparedInputManifest) => { m.documents[0]!.futurePath = "/app/qualification-inputs/other.bin"; },
    (m: PreparedInputManifest) => { m.documents.pop(); },
    (m: PreparedInputManifest) => { m.source[0]!.path = "../escape"; },
    (m: PreparedInputManifest) => { m.source = []; },
  ]) { const env = operator(); mutate(env.memory.manifest); env.memory.save(); const result = await runQualificationOperator(env.io); expect(result.status).toBe("FAIL"); expect(env.commands).toHaveLength(0); expect(env.dirs).toHaveLength(0); expect(env.writes.size).toBe(0); }
});
test("MOCK generator document conversion accepts a real-sized lock and bounds documents and metadata", async () => {
  const env = inputs(), lock = Buffer.alloc(2 * 1048576, 42), entry = env.manifest.documents.find(row => row.role === "dependencyLock")!;
  env.files.set("/app/qualification-inputs/dependencyLock.bin", lock); entry.source = { path: "pnpm-lock.yaml", byteLength: lock.byteLength, sha256: sha(lock) }; env.save();
  const bindings = await validateQualificationInputs({ read: env.read, alias: async () => {} }, WORKER_INPUT); expect(bindings.dependencyLock.byteLength).toBe(lock.byteLength);
  entry.source.byteLength = 8 * 1048576 + 1; env.save(); await expect(validateQualificationInputs({ read: env.read, alias: async () => {} }, WORKER_INPUT)).rejects.toThrow("BINDING_BOUND");
  const large = operator(); large.io.read = async (path, cap) => { expect(path).toBe(`${plan.documents}/input-manifest.json`); expect(cap).toBe(8 * 1048576); throw new Error("MOCK_METADATA_CAP_PLUS_ONE"); };
  expect((await runQualificationOperator(large.io)).status).toBe("FAIL"); expect(large.commands).toHaveLength(0);
});
test("MOCK physical payload inventories above 64 KiB fit only the raised 8 MiB metadata cap", async () => {
  const env = inputs(), value = Buffer.from("x");
  for (let i = 0; i < 600; i++) { const path = `node_modules/zod/mock-payload-${i}.js`; env.manifest.source.push({ path, byteLength: 1, sha256: sha(value) }); env.files.set(`/app/${path}`, value); }
  env.save(); expect(env.files.get("/app/qualification-inputs/input-manifest.json")!.byteLength).toBeGreaterThan(65536);
  const caps: number[] = [], read = env.read;
  await validateQualificationInputs({ alias: async () => {}, read: async (path, cap) => { if (path.endsWith("input-manifest.json")) caps.push(cap); return read(path, cap); } }, WORKER_INPUT);
  expect(caps).toEqual([8 * 1048576]); expect(4096 * 1024).toBeLessThan(8 * 1048576);
});
test("MOCK delivered adapters must already be executable before admission or output creation", async () => {
  const env = operator(), seen: string[] = []; env.io.requirePath = async (path, kind) => { seen.push(path); expect(kind).toBe("executable"); throw new Error("MOCK_STAGING_MODE_PENDING"); };
  const result = await runQualificationOperator(env.io); expect(result.status).toBe("FAIL"); expect(seen[0]).toBe(`${plan.source}/artifacts/training-functional/qualification-policy-score.ts`); expect(env.commands).toHaveLength(0); expect(env.dirs).toHaveLength(0);
});
test("MOCK exact host, executable and delivered source context reject before reads or process commands", async () => {
  for (const patch of [{ cwd: "/wrong" }, { realpath: "/different" }, { executable: "/usr/local/bin/bun" }, { entrypoint: `${plan.host}/artifacts/training-functional/qualification-operator.ts` }]) {
    const env = operator(), old = env.io.context; env.io.context = async () => ({ ...await old(), ...patch });
    env.io.read = async () => { throw new Error("UNEXPECTED_READ"); };
    const result = await runQualificationOperator(env.io); expect(result.failures.join()).toContain("OPERATOR_CONTEXT"); expect(env.commands).toHaveLength(0); expect(env.dirs).toHaveLength(0);
  }
});
test("MOCK natural zero exit accepts retained functional PASS without claiming qualification", async () => {
  const env = operator(), result = await runQualificationOperator(env.io);
  expect(result).toMatchObject({ status: "PASS", qualified: false, trainingReady: false, cleanup: "REMOVED", cid: CID, aborted: false, queries: 1, originMs: 0, deadlineMs: 800000 });
  expect(env.commands.filter(c => c.argv[0] === "docker").map(c => c.argv[2])).toEqual(["create", "start", "inspect", "rm"]);
  expect(env.commands[0]!.argv).toEqual(GPU_QUERY); expect(env.dirs).toEqual([plan.root, ...["state", "tmp", "home", "evidence"].map(n => `${plan.root}/${n}`)]);
  expect(env.writes.has(`${plan.root}/evidence/operator-report.json`)).toBe(true);
});
test("MOCK failed, low and stale admission queries never create the task root", async () => {
  for (const mode of ["low", "error", "stale", "uuid"]) { const env = operator(); env.gpu(() => {
    if (mode === "stale") env.setTime(1001);
    return pass(Buffer.from(`${mode === "uuid" ? "GPU-wrong" : plan.gpu}, ${mode === "low" ? 3071 : 4096}\n`), mode === "error" ? { exitCode: 1 } : {});
  }); const result = await runQualificationOperator(env.io); expect(result.status).toBe("FAIL"); expect(result.queries).toBe(1); expect(env.dirs).toHaveLength(0); expect(env.commands).toHaveLength(1); }
});
test("MOCK running GPU monitoring continues until container completion and uses original command deadlines", async () => {
  const env = operator(); env.hold(); const pending = runQualificationOperator(env.io); await env.start;
  await env.tick(); await env.tick(); env.finish(); const result = await pending;
  expect(result.status).toBe("PASS"); expect(result.queries).toBe(3);
  const start = env.commands.find(c => c.argv[2] === "start")!; expect(start.limits.deadlineMs).toBe(770000); expect(start.limits.cleanupDeadlineMs).toBe(771000);
  expect(env.commands.every(c => c.limits.cleanupDeadlineMs <= 800000)).toBe(true);
});
test("MOCK low, errored and stale running queries latch abort and stop only the newly owned CID", async () => {
  for (const mode of ["low", "error", "stale", "query-age"]) {
    const env = operator(); env.hold(); env.gpu(index => { if (index && mode === "query-age") env.setTime(3001); return pass(Buffer.from(`${plan.gpu}, ${index && mode === "low" ? 2047 : 4096}\n`), index && mode === "error" ? { error: "query failure" } : {}); });
    const pending = runQualificationOperator(env.io); await env.start; await env.tick(mode === "stale" ? 4001 : 2000); const result = await pending;
    expect(result.status).toBe("FAIL"); expect(result.aborted).toBe(true);
    const stops = env.commands.filter(c => c.argv[2] === "stop"); expect(stops).toHaveLength(1); expect(stops[0]!.argv.at(-1)).toBe(CID);
    expect(env.commands.some(c => c.argv.includes("ps") || c.argv.includes("--all"))).toBe(false); expect(result.cleanup).toBe("REMOVED");
  }
});
test("MOCK failed owned stop uses one kill without retry or deadline renewal", async () => {
  const env = operator(); env.hold(); env.gpu(index => pass(Buffer.from(`${plan.gpu}, ${index ? 0 : 4096}\n`)));
  env.docker(verb => verb === "stop" ? pass(Buffer.alloc(0), { exitCode: 1 }) : undefined);
  const pending = runQualificationOperator(env.io); await env.start; await env.tick(); const result = await pending;
  expect(result.status).toBe("FAIL"); expect(env.commands.filter(c => c.argv[0] === "docker").map(c => c.argv[2])).toEqual(["create", "start", "stop", "kill", "inspect", "rm"]);
  expect(env.commands.every(c => c.limits.cleanupDeadlineMs <= result.deadlineMs)).toBe(true);
});
test("MOCK monitor policy failure racing natural container exit remains latched", async () => {
  const env = operator(), late = deferred<CommandResult>(); env.hold(); env.gpu(index => index ? late.promise : pass(Buffer.from(`${plan.gpu}, 4096\n`)));
  const pending = runQualificationOperator(env.io); await env.start; await env.tick(); env.finish();
  for (let i = 0; i < 20; i++) await Promise.resolve(); late.resolve(pass(Buffer.from(`${plan.gpu}, 0\n`)));
  const result = await pending; expect(result.status).toBe("FAIL"); expect(result.aborted).toBe(true); expect(env.commands.filter(c => c.argv[2] === "stop")).toHaveLength(1);
});
test("MOCK uncertain command lifecycle never becomes accepted from a clean final inspect", async () => {
  for (const fault of [{ reaped: false }, { stdoutEOF: false }, { stderrEOF: false }, { exited: false }, { forced: true }, { signal: "SIGTERM" }, { exitCode: 1 }]) {
    const env = operator(); env.docker(verb => verb === "start" ? pass(Buffer.alloc(0), fault) : undefined);
    const result = await runQualificationOperator(env.io); expect(result.status).toBe("FAIL"); expect(result.aborted).toBe(true); expect(env.commands.filter(c => c.argv[2] === "create")).toHaveLength(1);
  }
});
test("MOCK invalid create CID never adopts, stops, inspects or removes another container", async () => {
  for (const raw of [CID.toUpperCase(), CID + "\n" + CID, " " + CID, "short"]) {
    const env = operator(); env.docker(verb => verb === "create" ? pass(Buffer.from(raw)) : undefined);
    const result = await runQualificationOperator(env.io); expect(result.cid).toBeNull(); expect(result.status).toBe("FAIL"); expect(env.commands.filter(c => c.argv[0] === "docker").map(c => c.argv[2])).toEqual(["create"]);
  }
});
test("MOCK original outer clock stops monitoring before exceeding total GPU query and Docker caps", async () => {
  const env = operator(); env.hold(); const pending = runQualificationOperator(env.io); await env.start;
  for (let i = 0; i < 385; i++) await env.tick();
  const result = await pending; expect(result.status).toBe("FAIL"); expect(result.queries).toBeLessThanOrEqual(QUALIFICATION_LIMITS.queries);
  expect(result.commands.filter(c => c.argv[0] === "docker").length).toBeLessThanOrEqual(7); expect(result.deadlineMs).toBe(800000); expect(result.elapsedMs).toBe(770000);
});
test("MOCK invalid or regressing clock and existing output root fail without creating anything", async () => {
  for (const time of [NaN, Infinity, -1, "0" as unknown as number]) { const env = operator(); env.setTime(time); const result = await runQualificationOperator(env.io); expect(result.status).toBe("FAIL"); expect(env.commands).toHaveLength(0); expect(env.dirs).toHaveLength(0); }
  const env = operator(); env.io.absent = async () => { throw new Error("ROOT_EXISTS"); }; const result = await runQualificationOperator(env.io); expect(result.status).toBe("FAIL"); expect(env.commands).toHaveLength(0);
  const backward = operator(); let calls = 0; backward.io.now = () => calls++ ? 9 : 10; expect((await runQualificationOperator(backward.io)).status).toBe("FAIL"); expect(backward.commands).toHaveLength(0);
});
test("MOCK retained evidence failure or remove uncertainty prevents operator PASS", async () => {
  const env = operator(), read = env.io.read; env.io.read = async (path, cap) => path.endsWith("functional-evidence.json") ? bytes({ ...evidence, status: "FAIL_RETAINED_FUNCTIONAL_EVIDENCE" }) : read(path, cap);
  expect((await runQualificationOperator(env.io)).status).toBe("FAIL");
  const remove = operator(); remove.docker(verb => verb === "rm" ? pass(Buffer.alloc(0), { reaped: false }) : undefined);
  const result = await runQualificationOperator(remove.io); expect(result.status).toBe("FAIL"); expect(result.cleanup).toBe("UNCONFIRMED");
});
test("MOCK parent accepts only literal false worker qualification, readiness and raw qualification flags", async () => {
  for (const name of ["qualified", "trainingReady", "rawQualified"] as const) for (const value of [true, undefined, null, 0, "false"]) {
    const env = operator(), read = env.io.read;
    env.io.read = async (path, cap) => path.endsWith("worker-report.json") ? bytes({ ...report, [name]: value }) : read(path, cap);
    const result = await runQualificationOperator(env.io); expect(result.status).toBe("FAIL"); expect(result.failures.join()).toContain("RETAINED_FUNCTIONAL_CHECK");
  }
});
test("MOCK final receipt time remains inside the same original outer budget", async () => {
  const env = operator(), write = env.io.write; env.io.write = async (path, value) => { await write(path, value); env.setTime(800001); };
  const result = await runQualificationOperator(env.io); expect(result.status).toBe("FAIL"); expect(result.deadlineMs).toBe(800000); expect(result.failures.join()).toContain("DEADLINE"); expect(env.writes.size).toBe(1);
});
test("MOCK worker composes one coordinator and factory, closes before readback and retains raw records", async () => {
  const env = worker(), result = await runQualificationWorker(WORKER_INPUT, env.io);
  expect(result).toEqual({ ...report, scope: plan.scope }); expect(env.counts()).toEqual({ canonicalCalls: 1, initCalls: 1, factoryCalls: 1, coordinatorCalls: 1, closeCalls: 1 });
  expect(env.sequence.indexOf("canonical")).toBeLessThan(env.sequence.indexOf("initialize")); expect(env.sequence.indexOf("close")).toBeLessThan(env.sequence.indexOf("readback"));
  expect(env.writes.get("/evidence/initial-native.bin")).toEqual(Uint8Array.from([0, 255, 0, 7]));
  const raw = JSON.parse(Buffer.from(env.writes.get("/evidence/native.ndjson")!).toString()); expect(raw.receivedNs).toBe("23"); expect(raw.json).toContain('"logits":[0]');
  expect(env.writes.has("/evidence/canonical.json")).toBe(true); expect(env.writes.has("/evidence/r4.json")).toBe(true); expect(env.writes.has("/evidence/functional-evidence.json")).toBe(true);
});
test("MOCK preparation includes both synchronous constructors and closes a late coordinator exactly once", async () => {
  for (const stage of ["factory", "coordinator"]) {
    const env = worker(), factory = env.io.createFactory, coordinator = env.io.createCoordinator;
    env.io.createFactory = (...args) => { const value = factory(...args); if (stage === "factory") env.setTime(10000); return value; };
    env.io.createCoordinator = (...args) => { const value = coordinator(...args); if (stage === "coordinator") env.setTime(10000); return value; };
    const result = await runQualificationWorker(WORKER_INPUT, env.io); expect(result.status).toBe("FAIL"); expect(result.failures.join()).toContain("PREPARATION_DEADLINE");
    expect(env.counts()).toMatchObject({ factoryCalls: 1, coordinatorCalls: 1, closeCalls: 1 }); expect(env.observed()).toBeNull(); expect(env.sequence).not.toContain("readback");
    expect(env.writes.has("/evidence/initial-native.bin")).toBe(true); expect(env.writes.has("/evidence/worker-report.json")).toBe(true);
  }
});
test("MOCK constructor errors preserve scratch and never retry acquisition", async () => {
  for (const stage of ["factory", "coordinator"]) {
    const env = worker(), factory = env.io.createFactory;
    env.io.createFactory = (...args) => { const value = factory(...args); env.writes.set("/tmp/episode-model/mock-prefix", Buffer.from("kept")); if (stage === "factory") throw new Error("MOCK_FACTORY_CONSTRUCTOR"); return value; };
    if (stage === "coordinator") env.io.createCoordinator = () => { throw new Error("MOCK_COORDINATOR_CONSTRUCTOR"); };
    const result = await runQualificationWorker(WORKER_INPUT, env.io); expect(result.status).toBe("FAIL"); expect(env.counts().factoryCalls).toBe(1); expect(env.observed()).toBeNull();
    expect(Buffer.from(env.writes.get("/tmp/episode-model/mock-prefix")!).toString()).toBe("kept"); expect(env.writes.has("/evidence/worker-report.json")).toBe(true);
  }
});
test("MOCK readback and checker postchecks share a single original sixty-second output phase", async () => {
  expect(QUALIFICATION_LIMITS.readbackAndReceiptMs).toBe(60000);
  for (const stage of ["readback", "checker"]) {
    const env = worker(), readback = env.io.readback, checker = env.io.checkEvidence;
    env.io.readback = root => { const value = readback(root); if (stage === "readback") env.setTime(60000); return value; };
    env.io.checkEvidence = input => { const value = checker(input); if (stage === "checker") env.setTime(60000); return value; };
    const result = await runQualificationWorker(WORKER_INPUT, env.io); expect(result.status).toBe("FAIL"); expect(result.failures.join()).toContain("READBACK_RECEIPT_DEADLINE");
    expect(env.counts().closeCalls).toBe(1); expect(env.sequence.includes("check")).toBe(stage === "checker"); expect(env.writes.has("/evidence/initial-native.bin")).toBe(true);
    expect(env.writes.has("/evidence/functional-evidence.json")).toBe(false); expect(env.alarms.filter(a => a.ms === 60000)).toHaveLength(1);
  }
});
test("MOCK output origin starts only after awaited R4 settlement and coordinator closure", async () => {
  const env = worker(), entered = deferred<void>(), resume = deferred<void>(), observe = env.io.observeR4;
  env.io.observeR4 = async input => { entered.resolve(); await resume.promise; return observe(input); };
  const pending = runQualificationWorker(WORKER_INPUT, env.io); await entered.promise;
  expect(env.counts().closeCalls).toBe(0); expect(env.alarms.every(a => a.cancelled)).toBe(true); expect(env.writes.has("/evidence/worker-report.json")).toBe(false);
  env.setTime(600000); resume.resolve(); const result = await pending;
  expect(result.status).toBe("PASS"); expect(env.counts().closeCalls).toBe(1); expect(env.alarms.filter(a => a.ms === 60000)).toHaveLength(1);
});
test("MOCK blocked functional, trace and receipt writers fail finitely without a renewed phase", async () => {
  for (const stage of ["functional", "trace", "receipt", "canonical-failure"]) {
    const env = worker(), entered = deferred<void>(), write = env.io.write;
    if (stage === "canonical-failure") env.io.observeCanonical = async () => { env.setTime(300000); return { status: "FAIL", error: "MOCK_CANONICAL_CLOSED" } as Awaited<ReturnType<WorkerIO["observeCanonical"]>>; };
    env.io.write = async (path, value) => {
      if (stage === "functional" && path.endsWith("functional-evidence.json") || stage === "receipt" && path.endsWith("worker-report.json") || stage === "canonical-failure" && path.endsWith("canonical.json")) { entered.resolve(); return new Promise(() => {}); }
      await write(path, value);
    };
    if (stage === "trace") env.io.writeChunks = async () => { entered.resolve(); return new Promise(() => {}); };
    const pending = runQualificationWorker(WORKER_INPUT, env.io); await entered.promise;
    const alarm = env.alarms.find(a => !a.cancelled && a.ms === 60000)!; expect(alarm).toBeDefined();
    env.setTime(stage === "canonical-failure" ? 360000 : 60000); alarm.fire(); const result = await pending;
    expect(result.status).toBe("FAIL"); expect(result.failures.join()).toContain("READBACK_RECEIPT_DEADLINE"); expect(result.qualified).toBe(false); expect(result.trainingReady).toBe(false);
    expect(env.alarms.filter(a => a.ms === 60000)).toHaveLength(1); expect(alarm.cancelled).toBe(true); expect(env.counts().closeCalls).toBe(stage === "canonical-failure" ? 0 : 1);
  }
});
test("MOCK all output operations consume the same remaining phase rather than sixty seconds each", async () => {
  const env = worker(), write = env.io.write, checker = env.io.checkEvidence;
  env.io.checkEvidence = input => { const value = checker(input); env.setTime(30000); return value; };
  env.io.write = async (path, value) => { await write(path, value); if (path.endsWith("canonical.json")) env.setTime(59000); if (path.endsWith("r4.json")) env.setTime(60000); };
  const result = await runQualificationWorker(WORKER_INPUT, env.io); expect(result.status).toBe("FAIL"); expect(result.failures.join()).toContain("READBACK_RECEIPT_DEADLINE");
  expect(env.writes.has("/evidence/functional-evidence.json")).toBe(true); expect(env.writes.has("/evidence/canonical.json")).toBe(true); expect(env.writes.has("/evidence/r4.json")).toBe(true); expect(env.writes.has("/evidence/native.ndjson")).toBe(false);
  expect(env.alarms.filter(a => a.ms === 60000)).toHaveLength(1);
});
test("MOCK canonical FAIL preserves evidence and stops before CPU initialization and R4", async () => {
  const env = worker(); env.io.observeCanonical = async () => ({ status: "FAIL", error: "mock canonical failure" }) as Awaited<ReturnType<WorkerIO["observeCanonical"]>>;
  const result = await runQualificationWorker(WORKER_INPUT, env.io); expect(result.status).toBe("FAIL"); expect(env.counts()).toMatchObject({ initCalls: 0, factoryCalls: 0, coordinatorCalls: 0 });
  expect(env.writes.has("/evidence/canonical.json")).toBe(true); expect(env.writes.has("/evidence/worker-report.json")).toBe(true);
});
test("MOCK CPU failure, preparation failure and readback failure preserve partial evidence without retry", async () => {
  for (const stage of ["cpu", "prepare", "readback"]) { const env = worker();
    if (stage === "cpu") env.io.command = async () => pass(Buffer.alloc(0), { reaped: false });
    if (stage === "prepare") env.io.loadCorpus = async () => { throw new Error("MOCK_CORPUS_FAILURE"); };
    if (stage === "readback") env.io.readback = () => { expect(env.counts().closeCalls).toBe(1); throw new Error("MOCK_READBACK_FAILURE"); };
    const result = await runQualificationWorker(WORKER_INPUT, env.io); expect(result.status).toBe("FAIL"); expect(env.counts().factoryCalls).toBe(stage === "readback" ? 1 : 0); expect(env.writes.has("/evidence/worker-report.json")).toBe(true);
  }
});
test("MOCK observer cannot bypass coordinator closure or qualify a failed R4", async () => {
  for (const stage of ["no-close", "throw", "failed"]) { const env = worker(), original = env.io.observeR4;
    env.io.observeR4 = async input => { if (stage === "no-close") return env.r4; if (stage === "throw") throw new Error("MOCK_R4_THROW"); const result = await original(input); return { ...result, status: "FAIL" }; };
    const result = await runQualificationWorker(WORKER_INPUT, env.io); expect(result.status).toBe("FAIL"); expect(env.counts().closeCalls).toBe(1); expect(result.qualified).toBe(false); expect(result.trainingReady).toBe(false);
  }
});
test("MOCK failed close and evidence writes preserve failure and never read an open coordinator", async () => {
  const close = worker(); close.coordinator.close = () => { throw new Error("MOCK_CLOSE_FAILED"); }; close.io.readback = () => { throw new Error("UNEXPECTED_READBACK"); };
  const failedClose = await runQualificationWorker(WORKER_INPUT, close.io); expect(failedClose.status).toBe("FAIL"); expect(close.sequence).not.toContain("readback"); expect(close.writes.has("/evidence/worker-report.json")).toBe(true);
  const env = worker(); env.io.writeChunks = async () => { throw new Error("MOCK_TRACE_WRITE"); };
  const result = await runQualificationWorker(WORKER_INPUT, env.io); expect(result.status).toBe("FAIL"); expect(result.failures.join()).toContain("MOCK_TRACE_WRITE"); expect(env.writes.has("/evidence/worker-report.json")).toBe(true);
});
test("MOCK worker context or unprepared inputs fail before observers, constructors or evidence writes", async () => {
  for (const stage of ["context", "inputs"]) { const env = worker(); if (stage === "context") env.io.context = async () => ({ cwd: "/wrong", realpath: "/app", executable: "/usr/local/bin/bun", entrypoint: "/app/artifacts/training-functional/qualification-operator.ts" });
    else env.memory.files.delete("/app/qualification-inputs/input-manifest.json"); const result = await runQualificationWorker(WORKER_INPUT, env.io); expect(result.status).toBe("FAIL"); expect(env.counts().canonicalCalls).toBe(0); expect(env.writes.size).toBe(0); }
});
test("MOCK native trace caps full raw events and bytes with small fixtures and retains bigint precision", () => {
  const event: NativeObservation = { kind: "reply", attemptId: "r4-m101-a0000", channel: "a", json: "full-native-record", receivedNs: 123456789012345678n };
  const count = createQualificationTrace({ events: 2, bytes: 4096 }); count.observe(event); count.observe(event); expect(() => count.observe(event)).toThrow("TRACE_BOUND"); expect(count.events).toHaveLength(2); expect(count.events[0]).not.toBe(event);
  expect((count.events[0] as typeof event).receivedNs).toBe(event.receivedNs); expect(count.failed).toBe(true);
  const size = createQualificationTrace({ events: 800, bytes: 1 }); expect(() => size.observe(event)).toThrow("TRACE_BOUND"); expect(size.events).toHaveLength(0); expect(size.bytes()).toBe(0);
});
test("MOCK one-GiB trace bounds count serialized UTF-8 bigint and NDJSON framing with tiny exact-boundary fixtures", () => {
  const event: NativeObservation = { kind: "reply", attemptId: "r4-m101-a0001", channel: "b", json: '"\n☃', receivedNs: 123456789012345678n };
  const serialized = Buffer.from(JSON.stringify({ ...event, receivedNs: String(event.receivedNs) }) + "\n"), trace = createQualificationTrace({ events: 800, bytes: serialized.byteLength * 2 });
  expect(trace.observe(event)).toBeUndefined(); trace.observe(event); expect(trace.bytes()).toBe(serialized.byteLength * 2); expect(() => trace.observe(event)).toThrow("TRACE_BOUND"); expect(trace.events).toHaveLength(2);
  const prefix = createQualificationTrace({ events: 800, bytes: serialized.byteLength * 2 - 1 }); prefix.observe(event); expect(() => prefix.observe(event)).toThrow("TRACE_BOUND"); expect(prefix.events).toHaveLength(1); expect(prefix.bytes()).toBe(serialized.byteLength);
  expect(QUALIFICATION_LIMITS.nativeBytes).toBe(1024 ** 3); expect(QUALIFICATION_LIMITS.nativeEvents).toBe(800); expect(512 * 2271 * 2 * 3 * 64).toBeGreaterThan(256 * 1048576);
  expect(512 * 2271 * 2 * 3 * 64).toBeLessThan(QUALIFICATION_LIMITS.nativeBytes); expect(createQualificationTrace({ events: 800, bytes: 1024 ** 3 }).events).toHaveLength(0);
  expect(() => createQualificationTrace({ events: 800, bytes: 1024 ** 3 + 1 })).toThrow("TRACE_LIMIT");
});
test("MOCK overflow streams only the retained native prefix and reports incomplete evidence without readiness", async () => {
  const env = worker(); env.io.observeR4 = async input => { try { for (let i = 0; i <= 800; i++) env.observer()({ kind: "request", attemptId: "r4-m101-a0001", channel: "a", json: String(i) }); return env.r4; } finally { await input.coordinator.close(); } };
  const chunks: Uint8Array[] = []; env.io.writeChunks = async (path, iterable) => { expect(path).toBe("/evidence/native.ndjson"); expect(Array.isArray(iterable)).toBe(false); for (const chunk of iterable) { expect(chunk.byteLength).toBeLessThan(256); chunks.push(chunk); } };
  const result = await runQualificationWorker(WORKER_INPUT, env.io); expect(result).toMatchObject({ status: "FAIL", nativeTrace: "INCOMPLETE_EVIDENCE", qualified: false, trainingReady: false, rawQualified: false });
  expect(chunks).toHaveLength(800); expect(JSON.parse(Buffer.from(chunks[799]!).toString()).json).toBe("799"); expect(env.counts().closeCalls).toBe(1); expect(env.sequence).not.toContain("readback");
  expect(result.failures.join()).not.toContain("math"); expect(JSON.parse(Buffer.from(env.writes.get("/evidence/worker-report.json")!).toString()).nativeTrace).toBe("INCOMPLETE_EVIDENCE");
});
test("MOCK exclusive chunk writer handles short writes, then syncs and closes without whole-trace concatenation", async () => {
  const calls: string[] = [], written: Uint8Array[] = [], offsets: number[] = [];
  const lstat = spyOn(fileIO, "lstat").mockImplementation((async () => ({ isDirectory: () => true, isSymbolicLink: () => false })) as unknown as typeof fileIO.lstat);
  const open = spyOn(fileIO, "open").mockImplementation((async (path: string, flags: string, mode: number) => {
    expect([path, flags, mode]).toEqual(["/evidence/native.ndjson", "wx", 0o600]); return {
      write: async (chunk: Uint8Array, offset: number, length: number, position: number | null) => { expect(position).toBeNull(); const count = Math.min(2, length); offsets.push(offset); written.push(chunk.slice(offset, offset + count)); calls.push("write"); return { bytesWritten: count }; },
      sync: async () => { calls.push("sync"); }, close: async () => { calls.push("close"); },
    };
  }) as unknown as typeof fileIO.open);
  function* chunks() { calls.push("yield-0"); yield Buffer.from("abcde"); expect(offsets).toEqual([0, 2, 4]); calls.push("yield-1"); yield Buffer.from("fg"); }
  try { await writeQualificationChunks("/evidence/native.ndjson", chunks()); expect(Buffer.concat(written).toString()).toBe("abcdefg"); expect(calls).toEqual(["yield-0", "write", "write", "write", "yield-1", "write", "sync", "close"]); }
  finally { lstat.mockRestore(); open.mockRestore(); }
});
test("MOCK chunk writer preserves partial writes and closes once on zero writes, generator errors or sync failure", async () => {
  const lstat = spyOn(fileIO, "lstat").mockImplementation((async () => ({ isDirectory: () => true, isSymbolicLink: () => false })) as unknown as typeof fileIO.lstat);
  let stage = "zero", closed = 0, synced = 0, written = 0;
  const open = spyOn(fileIO, "open").mockImplementation((async () => ({
    write: async (_chunk: Uint8Array, _offset: number, length: number) => { if (stage === "zero") return { bytesWritten: 0 }; written += length; return { bytesWritten: length }; },
    sync: async () => { synced++; if (stage === "sync") throw new Error("MOCK_SYNC"); }, close: async () => { closed++; },
  })) as unknown as typeof fileIO.open);
  try {
    await expect(writeQualificationChunks("/evidence/native.ndjson", [Buffer.from("x")])).rejects.toThrow("SHORT_WRITE"); expect([closed, synced, written]).toEqual([1, 0, 0]);
    stage = "generator"; function* chunks() { yield Buffer.from("kept"); throw new Error("MOCK_GENERATOR"); }
    await expect(writeQualificationChunks("/evidence/native.ndjson", chunks())).rejects.toThrow("MOCK_GENERATOR"); expect([closed, synced, written]).toEqual([2, 0, 4]);
    stage = "sync"; await expect(writeQualificationChunks("/evidence/native.ndjson", [Buffer.from("x")])).rejects.toThrow("MOCK_SYNC"); expect([closed, synced, written]).toEqual([3, 1, 5]);
  } finally { lstat.mockRestore(); open.mockRestore(); }
});
test("MOCK bounded detached production command reports actual mocked EOF, exit and reap receipts", async () => {
  const timer = spyOn(globalThis, "setTimeout").mockImplementation((() => 1) as unknown as typeof setTimeout);
  const clear = spyOn(globalThis, "clearTimeout").mockImplementation(() => {});
  const stream = (value: Uint8Array) => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(value); controller.close(); } });
  spawn.mockImplementation(((argv: readonly string[], options: unknown) => { expect(argv).toEqual(["mock-command"]); expect(options).toMatchObject({ detached: true, stdin: "ignore", stdout: "pipe", stderr: "pipe" }); return {
    pid: 99999999, stdout: stream(Buffer.from("retained")), stderr: stream(Buffer.alloc(0)), exited: Promise.resolve(0), signalCode: null, unref: () => {}, kill: () => {},
  } as unknown as ReturnType<typeof Bun.spawn>; }) as unknown as typeof Bun.spawn);
  try { const result = await boundedQualificationCommand(["mock-command"], { deadlineMs: 1000, cleanupDeadlineMs: 2000, stdoutBytes: 32, stderrBytes: 32, now: () => 0 });
    expect(result).toMatchObject({ exitCode: 0, exited: true, reaped: true, stdoutEOF: true, stderrEOF: true, forced: false, error: null }); expect(Buffer.from(result.stdout).toString()).toBe("retained"); }
  finally { timer.mockRestore(); clear.mockRestore(); spawn.mockImplementation(() => { throw new Error("FORBIDDEN_REAL_PROCESS"); }); }
});
test("MOCK bounded commands cap raw streams and never fabricate EOF or reap after a cleanup timeout", async () => {
  const alarms: (() => void)[] = [], timer = spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => { alarms.push(callback); return alarms.length; }) as unknown as typeof setTimeout);
  const clear = spyOn(globalThis, "clearTimeout").mockImplementation(() => {});
  let unrefs = 0;
  const fakeSpawn = (stdout: ReadableStream<Uint8Array>, stderr: ReadableStream<Uint8Array>, exited: Promise<number>) => {
    spawn.mockImplementation((() => ({ pid: 99999999, stdout, stderr, exited, signalCode: null, unref: () => { unrefs++; }, kill: () => {} })) as unknown as typeof Bun.spawn);
  };
  try {
    const stream = (value: Uint8Array) => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(value); controller.close(); } });
    fakeSpawn(stream(Buffer.alloc(5)), stream(Buffer.alloc(5)), Promise.resolve(0));
    const capped = await boundedQualificationCommand(["mock-command"], { deadlineMs: 1000, cleanupDeadlineMs: 2000, stdoutBytes: 4, stderrBytes: 3, now: () => 0 });
    expect(capped).toMatchObject({ forced: true, error: "OUTPUT_CAP" }); expect(capped.stdout.byteLength).toBe(4); expect(capped.stderr.byteLength).toBe(3);
    alarms.length = 0; fakeSpawn(new ReadableStream(), new ReadableStream(), new Promise(() => {}));
    const pending = boundedQualificationCommand(["mock-command"], { deadlineMs: 1000, cleanupDeadlineMs: 2000, stdoutBytes: 4, stderrBytes: 3, now: () => 0 });
    for (let i = 0; i < 10; i++) await Promise.resolve(); expect(alarms).toHaveLength(2); alarms[0]!(); alarms[1]!();
    const uncertain = await pending; expect(uncertain).toMatchObject({ forced: true, exited: false, reaped: false, stdoutEOF: false, stderrEOF: false, exitCode: null }); expect(unrefs).toBe(2);
  } finally { timer.mockRestore(); clear.mockRestore(); spawn.mockImplementation(() => { throw new Error("FORBIDDEN_REAL_PROCESS"); }); }
});
