// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { afterAll, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import * as fileIO from "node:fs/promises";
import { mkdirSync, readFileSync, renameSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import type { TrainingState } from "../../packages/contracts/src/training-state";
import type { AttemptSetup } from "../../packages/runtime/src/training-coordinator";
import { checkTrainingState, initialTrainingState, nextAttempt } from "../../packages/runtime/src/curriculum";
import { drawStream } from "../../packages/runtime/src/rng";
import { bindings, byteRef, syntheticRecord } from "../../packages/runtime/tests/training-fixture";
import { repositoryScratch } from "../../packages/runtime/tests/repository-scratch";
import type { CommandLimits, CommandResult } from "./qualification-operator";
import { campaignInvocation, campaignPlan, CAMPAIGN_ENTRY, FULL_CAMPAIGN_SCOPE, SELECTED_CAMPAIGN_BUDGET } from "./campaign-plan";
import type { CampaignApproval } from "./campaign-plan";
import { campaignDockerCreate, campaignMode, campaignWorkspaceUsage, decodeCampaignRequest, openCampaignTelemetry, readCampaignProgress,
  runCampaignOperator, runCampaignWorker, validateCampaignInputs } from "./campaign-operator";
import type { CampaignOperatorIO, CampaignProgress, CampaignRequest, CampaignWorkerIO, CampaignWorkerReport } from "./campaign-operator";
import type { CampaignEvidence, CampaignReadback } from "./campaign-evidence";

const spawn = spyOn(Bun, "spawn").mockImplementation(() => { throw new Error("FORBIDDEN_REAL_PROCESS"); });
const spawnSync = spyOn(Bun, "spawnSync").mockImplementation(() => { throw new Error("FORBIDDEN_REAL_PROCESS"); });
afterAll(() => { spawn.mockRestore(); spawnSync.mockRestore(); });
const encode = (value: unknown) => Buffer.from(JSON.stringify(value) + "\n");
const ref = (bytes: Uint8Array) => ({ byteLength: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
const plan = campaignPlan(SELECTED_CAMPAIGN_BUDGET), CID = "a".repeat(64);
const request: CampaignRequest = { version: "chess-coach.training-campaign-request.v1", plan, preparedInputManifest: byteRef("mock-manifest"),
  sourceManifest: byteRef("mock-source"), bindingDocuments: byteRef("mock-documents"), verification: byteRef("mock-verification"), trainingExecutionAuthorized: false, publicationAuthorized: false };
const requestBytes = encode(request), approval: CampaignApproval = { version: "chess-coach.training-execution-approval.v1", approvedBy: "Executor",
  action: "EXECUTE_FULL_CAMPAIGN_ONCE", packetSha256: ref(requestBytes).sha256, nativeScope: FULL_CAMPAIGN_SCOPE, trainingExecutionAuthorized: true };
const launch = { requestBytes, approval };
const pass = (stdout: Uint8Array = Buffer.alloc(0), extra: Partial<CommandResult> = {}): CommandResult => ({ stdout, stderr: Buffer.alloc(0), exitCode: 0,
  signal: null, exited: true, reaped: true, stdoutEOF: true, stderrEOF: true, forced: false, error: null, ...extra });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
const evidence = { status: "PASS_CAMPAIGN_RETAINED_RESULT_VALIDATION", attempts: 5000, nativeScoresReplayed: false, failures: [] } as unknown as CampaignEvidence;
const workerReport: CampaignWorkerReport = { scope: "FULL_CAMPAIGN_WORKER", execution: "MOCK", status: "PASS", failures: [], verifiedAttempts: 5000,
  finalizationCalls: 1, closeCalls: 1, validation: evidence, trainingExecuted: false };
function operator() {
  let time = 0, hold = false, gpuCount = 0;
  const started = deferred<void>(), running = deferred<CommandResult>(), commands: { argv: readonly string[]; limits: CommandLimits }[] = [];
  const writes = new Map<string, Uint8Array>(), dirs: string[] = [], waits: { ms: number; resolve: () => void }[] = [], telemetry: unknown[] = [];
  const alarms: { fire: () => void; cancelled: boolean }[] = [];
  let gpu: (ordinal: number) => CommandResult | Promise<CommandResult> = () => pass(Buffer.from(`${plan.gpu}, 4096\n`));
  let docker: (verb: string) => CommandResult | undefined = () => undefined;
  let progress: CampaignProgress = { version: "chess-coach.campaign-progress.v1", phase: "work", completed: 0 };
  const io: CampaignOperatorIO = {
    execution: "MOCK", now: () => time, alarm: (_ms, fire) => { const alarm = { fire, cancelled: false }; alarms.push(alarm); return () => { alarm.cancelled = true; }; },
    wait: ms => new Promise(resolve => { waits.push({ ms, resolve }); }),
    context: async () => ({ cwd: plan.host, realpath: plan.host, executable: plan.cachedBun, entrypoint: `${plan.source}/${CAMPAIGN_ENTRY}` }),
    read: async path => path.endsWith("campaign-worker.json") ? encode(workerReport) : path.endsWith("progress.json") ? encode(progress) : (() => { throw new Error("UNEXPECTED_READ"); })(),
    write: async (path, bytes) => { if (writes.has(path)) throw new Error("EXCLUSIVE_CREATE"); writes.set(path, bytes); },
    validateInputs: async () => bindings(), alias: async () => {}, absent: async () => {}, mkdir: async path => { dirs.push(path); }, requirePath: async () => {},
    capacity: async () => ({ usableBytes: plan.budget!.minimumFreeBytes, freeEntries: plan.storageAdmission.requiredFreeEntries }),
    usage: async () => 0, telemetry: value => { telemetry.push(value); }, closeTelemetry: () => {},
    command: async (argv, limits) => {
      commands.push({ argv, limits }); if (argv[0] === "nvidia-smi") return gpu(gpuCount++);
      const verb = argv[2]!; if (verb === "start") { started.resolve(); if (hold) return running.promise; }
      const replacement = docker(verb); if (replacement) return replacement;
      if (verb === "create") return pass(Buffer.from(CID + "\n"));
      if (verb === "stop" || verb === "kill") { running.resolve(pass(Buffer.alloc(0), { exitCode: 143 })); return pass(); }
      if (verb === "inspect") return pass(encode({ Running: false, ExitCode: 0, OOMKilled: false, Dead: false, Error: "", Status: "exited" }));
      return pass();
    },
  };
  return { io, commands, dirs, writes, telemetry, started: started.promise, hold: () => { hold = true; }, finish: () => running.resolve(pass()),
    setGPU: (fn: typeof gpu) => { gpu = fn; }, setDocker: (fn: typeof docker) => { docker = fn; }, setTime: (ms: number) => { time = ms; },
    expireIO: () => { const alarm = alarms.filter(a => !a.cancelled).at(-1); expect(alarm).toBeDefined(); alarm!.fire(); },
    progress: (value: Partial<CampaignProgress>) => { progress = { ...progress, ...value }; },
    tick: async (ms = 2000, interval = 2000) => { time += ms; const index = waits.findIndex(w => w.ms === interval); expect(index).toBeGreaterThanOrEqual(0); waits.splice(index, 1)[0]!.resolve(); for (let i = 0; i < 40; i++) await Promise.resolve(); } };
}
const selected = syntheticRecord("mock-full-campaign-not-a-native-model"), cached = new Map<number, TrainingState[]>();
function states(master: number) {
  if (cached.has(master)) return cached.get(master)!;
  let state = initialTrainingState(master, selected.config.recordSha256, bindings()); const result = [state], history = byteRef(`history-${master}`);
  for (let ordinal = 0; ordinal < 1000; ordinal++) {
    const count = ordinal + 1, corpusStarted = Math.ceil(count / 2), consumed = ordinal % 36 === 0 ? nextAttempt(state, `fixture-${ordinal}`).consumed : state;
    state = { ...consumed, counters: { started: count, verifiedCompleted: count, eligibleCompleted: 1, updates: 1, nonzeroPGUpdates: 1, baselineCount: 1, baselineSum: 1 },
      control: { ...consumed.control, corpusCursor: (corpusStarted - 1) % 18 + 1, corpusEpoch: Math.floor((corpusStarted - 1) / 18), scheduleCursor: count,
        liveOrdinal: Math.floor(count / 2), dueBucket: Math.floor(count / 100) }, rng: ordinal === 0 ? { ...consumed.rng, "policy-sampling": drawStream(consumed.rng["policy-sampling"]).after } : consumed.rng,
      journalRef: { ...byteRef("mock-journal"), byteLength: (master - 101) * 1000 + count, lastRecordOrdinal: (master - 101) * 1000 + count }, historyRefs: [...state.historyRefs, history] };
    result.push(state);
  }
  checkTrainingState(state); cached.set(master, result); return result;
}
function worker() {
  const calls: { master: number; id: string; factory: AttemptSetup }[] = [], initializers: string[][] = [], progress: CampaignProgress[] = [], writes = new Map<string, Uint8Array>();
  let coordinators = 0, factories = 0, closes = 0, finalizes = 0, readbacks = 0, validations = 0, time = 0;
  const create: AttemptSetup = () => { throw new Error("MOCK_NEVER_EXECUTES_NATIVE"); };
  const artifacts = ([101, 102, 103, 104, 105] as const).map(master => ({ master, artifactRef: byteRef(`artifact-${master}`) }));
  const io: CampaignWorkerIO = { execution: "MOCK", now: () => time, alarm: () => () => {}, alias: async () => {}, validateInputs: async () => bindings(),
    context: async () => ({ cwd: "/app", realpath: "/app", executable: "/usr/local/bin/bun", entrypoint: `/app/${CAMPAIGN_ENTRY}` }),
    read: async () => { throw new Error("UNEXPECTED_READ"); }, write: async (path, bytes) => { writes.set(path, bytes); },
    command: async argv => { initializers.push([...argv]); return pass(selected.record); }, loadCorpus: async () => ({}) as Recorded<CampaignWorkerIO["loadCorpus"]>,
    loadStrategic: async () => ({}) as Recorded<CampaignWorkerIO["loadStrategic"]>,
    createFactory: () => { factories++; return { create }; }, createCoordinator: () => { coordinators++; return {
      initializeMaster: master => states(master)[0]!, runAttempt: async (master, id, _timing, factory) => { calls.push({ master, id, factory }); return states(master)[Number(id.slice(-4)) + 1]!; },
      finalize: () => { finalizes++; return { experiment: { version: "chess-coach.training-experiment.v1", status: "COMPLETE", artifacts, primaryMaster: 101, primaryArtifactRef: artifacts[0]!.artifactRef }, ref: byteRef("experiment") }; },
      close: () => { closes++; },
    }; }, progress: value => { progress.push(value); },
    openReadback: () => { expect(closes).toBe(1); readbacks++; return {} as CampaignReadback; },
    validate: (_result, _reader, _bindings, onProgress) => { expect(closes).toBe(1); validations++; onProgress?.(5000); return evidence; },
  };
  return { io, calls, create, progress, writes, initializers, setTime: (value: number) => { time = value; },
    counts: () => ({ coordinators, factories, closes, finalizes, readbacks, validations }) };
}
type Recorded<F extends (...args: never[]) => unknown> = Awaited<ReturnType<F>>;

test("MOCK imports and plan remain inert; CLI arguments do not grant execution", () => {
  expect(spawn).not.toHaveBeenCalled(); expect(spawnSync).not.toHaveBeenCalled();
  expect(campaignMode(false, ["operator"])).toBeNull(); expect(campaignMode(true, [])).toBeNull(); expect(campaignMode(true, ["operator", "--approved"])).toBeNull();
  expect(campaignMode(true, ["plan"])).toBe("plan"); expect(decodeCampaignRequest(requestBytes).plan).toEqual(plan);
});
test("MOCK unapproved operator and worker perform zero IO", async () => {
  const host = operator(), child = worker(); let reads = 0;
  host.io.context = child.io.context = async () => { reads++; throw new Error("UNEXPECTED_CONTEXT"); };
  expect((await runCampaignOperator({ requestBytes, approval: null }, host.io)).status).toBe("FAIL");
  expect((await runCampaignWorker({ requestBytes, approval: null, invocation: campaignInvocation(plan, 0) }, child.io)).status).toBe("FAIL");
  expect(reads).toBe(0); expect(host.commands).toHaveLength(0); expect(host.dirs).toHaveLength(0); expect(child.writes.size).toBe(0);
});
test("MOCK inherited container controls use only fresh writable roots and readonly retained caches", () => {
  const argv = campaignDockerCreate(plan); for (const arg of ["--pull=never", "--network=none", "--cpus=2", "--memory=8g", "--memory-swap=8g", "--user=1000:1000"]) expect(argv).toContain(arg);
  expect(argv.at(-1)).toBe("worker"); expect(plan.mounts.filter(m => !m.readonly).every(m => m.source.startsWith(plan.root + "/"))).toBe(true);
  expect(plan.mounts.filter(m => m.source.includes("/cache/")).every(m => m.readonly)).toBe(true);
});
test("MOCK one actual campaign class drives 5000 serial attempts, five CPU initializers and one close/finalize", async () => {
  const env = worker(), report = await runCampaignWorker({ ...launch, invocation: campaignInvocation(plan, 0) }, env.io);
  expect(report.failures).toEqual([]); expect(report.status).toBe("PASS"); expect(report.trainingExecuted).toBe(false);
  expect(env.calls).toHaveLength(5000); expect(env.calls.every((call, i) => call.master === 101 + Math.floor(i / 1000) && call.id === `m${call.master}-a${String(i % 1000).padStart(4, "0")}` && call.factory === env.create)).toBe(true);
  expect(env.initializers).toEqual([101, 102, 103, 104, 105].map(master => ["/usr/local/bin/policy-initialize", String(master)]));
  expect(env.counts()).toEqual({ coordinators: 1, factories: 1, closes: 1, finalizes: 1, readbacks: 1, validations: 1 });
  expect(env.progress.filter(p => p.phase === "work").map(p => p.completed)).toEqual(Array.from({ length: 5000 }, (_, i) => i + 1));
}, 30000);
test("MOCK factory/coordinator constructor failure never starts the campaign or closes an unreturned owner", async () => {
  for (const name of ["createFactory", "createCoordinator"] as const) {
    const env = worker(); env.io[name] = () => { throw new Error("MOCK_CONSTRUCTOR"); };
    const report = await runCampaignWorker({ ...launch, invocation: campaignInvocation(plan, 0) }, env.io);
    expect(report.status).toBe("FAIL"); expect(env.calls).toHaveLength(0); expect(env.counts().closes).toBe(0);
  }
});
test("MOCK campaign constructor failure closes the acquired coordinator exactly once", async () => {
  const env = worker(), original = env.io.createCoordinator;
  env.io.createCoordinator = (...args) => ({ ...original(...args), runAttempt: null! });
  expect((await runCampaignWorker({ ...launch, invocation: campaignInvocation(plan, 0) }, env.io)).status).toBe("FAIL"); expect(env.counts().closes).toBe(1);
});
test("MOCK failed initializer closes once without attempts or result validation", async () => {
  const env = worker(); env.io.command = async () => pass(Buffer.alloc(0), { exitCode: 1 });
  expect((await runCampaignWorker({ ...launch, invocation: campaignInvocation(plan, 0) }, env.io)).status).toBe("FAIL");
  expect(env.counts().closes).toBe(1); expect(env.calls).toHaveLength(0); expect(env.counts().validations).toBe(0);
});
test("MOCK first-attempt failure preserves one-close/no-finalization ownership", async () => {
  const env = worker(), original = env.io.createCoordinator;
  env.io.createCoordinator = (...args) => ({ ...original(...args), runAttempt: async () => { throw new Error("MOCK_ATTEMPT_FAILURE"); } });
  const report = await runCampaignWorker({ ...launch, invocation: campaignInvocation(plan, 0) }, env.io);
  expect(report.status).toBe("FAIL"); expect(report.failures.join()).toContain("MOCK_ATTEMPT_FAILURE");
  expect(env.counts().closes).toBe(1); expect(env.counts().finalizes).toBe(0); expect(env.counts().validations).toBe(0);
});
test("MOCK a renewed invocation fails before context, initializer or owner creation", async () => {
  const env = worker(), invocation = campaignInvocation(plan, 0); invocation.workDeadlineMs++;
  const report = await runCampaignWorker({ ...launch, invocation }, env.io);
  expect(report.status).toBe("FAIL"); expect(report.failures.join()).toContain("INVOCATION_RENEWED");
  expect(env.counts().coordinators).toBe(0); expect(env.initializers).toHaveLength(0);
});
test("MOCK changed prepared bytes fail before qualification input evaluation", async () => {
  await expect(validateCampaignInputs(request, { read: async () => encode({ changed: true }), alias: async () => {} }, { app: "/app", reference: "/ref", documents: "/docs" })).rejects.toThrow("PREPARED_MANIFEST_REF");
});
test("MOCK natural completion uses the original selected deadlines and a compact report", async () => {
  const env = operator(), report = await runCampaignOperator(launch, env.io);
  expect(report.failures).toEqual([]); expect(report.status).toBe("PASS"); expect(report.cleanup).toBe("REMOVED"); expect(report.trainingExecuted).toBe(false);
  expect(report.invocation).toEqual(campaignInvocation(plan, 0)); expect(report.queries).toBe(1);
  expect(env.commands.filter(c => c.argv[0] === "docker").map(c => c.argv[2])).toEqual(["create", "start", "inspect", "rm"]);
  expect(env.commands.find(c => c.argv[2] === "start")!.limits.deadlineMs).toBe(report.invocation!.validationDeadlineMs);
  expect("commands" in report).toBe(false); expect(encode(report).byteLength).toBeLessThan(4096);
});
test("MOCK existing roots and insufficient bytes/inodes reject before GPU, Docker or root creation", async () => {
  for (const mode of ["existing", "bytes", "entries"]) { const env = operator();
    if (mode === "existing") env.io.absent = async () => { throw new Error("ROOT_EXISTS"); };
    else env.io.capacity = async () => ({ usableBytes: mode === "bytes" ? 1 : plan.budget!.minimumFreeBytes, freeEntries: mode === "entries" ? 1 : plan.storageAdmission.requiredFreeEntries });
    const report = await runCampaignOperator(launch, env.io); expect(report.status).toBe("FAIL"); expect(env.commands).toHaveLength(0); expect(env.dirs).toHaveLength(0);
  }
});
test("MOCK GPU failure stops only the newly owned CID and preserves the original deadline", async () => {
  const env = operator(); env.hold(); env.setGPU(i => pass(Buffer.from(`${plan.gpu}, ${i ? 2047 : 4096}\n`)));
  const pending = runCampaignOperator(launch, env.io); await env.started; await env.tick(); const report = await pending;
  expect(report.status).toBe("FAIL"); expect(report.aborted).toBe(true); expect(report.cleanup).toBe("REMOVED");
  expect(env.commands.filter(c => c.argv[2] === "stop").map(c => c.argv.at(-1))).toEqual([CID]);
  expect(env.commands.every(c => c.limits.cleanupDeadlineMs <= report.invocation!.cleanupDeadlineMs)).toBe(true);
});
test("MOCK telemetry never renews inactivity without verified or validation progress", async () => {
  const env = operator(); env.hold(); const pending = runCampaignOperator(launch, env.io); await env.started;
  for (let i = 0; i < 300; i++) await env.tick(); const report = await pending;
  expect(report.status).toBe("FAIL"); expect(report.failures.join()).toContain("INACTIVITY"); expect(env.telemetry.length).toBe(301);
});
test("MOCK increasing verified progress, then validation progress, renews only inactivity", async () => {
  const env = operator(); env.hold(); const pending = runCampaignOperator(launch, env.io); await env.started;
  env.progress({ completed: 5000 }); await env.tick(); env.progress({ phase: "validation", completed: 10 }); await env.tick(); env.finish();
  const report = await pending; expect(report.status).toBe("PASS"); expect(report.progress).toEqual({ work: 5000, validation: 10 }); expect(report.invocation).toEqual(campaignInvocation(plan, 0));
});
test("MOCK compact monitoring passes the old 401-query qualification cap without renewing outer deadlines", async () => {
  const env = operator(); env.hold(); const pending = runCampaignOperator(launch, env.io); await env.started;
  for (let i = 0; i < 450; i++) { env.progress({ completed: i + 1 }); await env.tick(); }
  env.finish(); const report = await pending;
  expect(report.status).toBe("PASS"); expect(report.queries).toBe(451); expect(report.invocation).toEqual(campaignInvocation(plan, 0));
  expect("commands" in report).toBe(false); expect(encode(report).byteLength).toBeLessThan(4096);
});
test("MOCK a late monitoring failure remains a failure after natural container exit", async () => {
  const env = operator(), late = deferred<CommandResult>(); env.hold(); env.setGPU(i => i ? late.promise : pass(Buffer.from(`${plan.gpu}, 4096\n`)));
  const pending = runCampaignOperator(launch, env.io); await env.started; await env.tick(); env.finish();
  for (let i = 0; i < 20; i++) await Promise.resolve(); late.resolve(pass(Buffer.from(`${plan.gpu}, 0\n`)));
  expect((await pending).status).toBe("FAIL");
});
test("MOCK soft workspace excess fails without adopting another root or container", async () => {
  const env = operator(); env.hold(); env.io.usage = async () => plan.budget!.workspaceBytes + 1;
  const pending = runCampaignOperator(launch, env.io); await env.started; await env.tick(60000, 60000);
  const report = await pending; expect(report.status).toBe("FAIL"); expect(report.failures.join()).toContain("WORKSPACE_SOFT_BUDGET"); expect(report.cid).toBe(CID);
});
test("MOCK stalled progress IO cannot suspend GPU staleness and inactivity monitoring", async () => {
  const env = operator(), original = env.io.read; env.hold();
  env.io.read = async (path, cap) => path.endsWith("progress.json") ? new Promise<Uint8Array>(() => {}) : original(path, cap);
  const pending = runCampaignOperator(launch, env.io); await env.started; await env.tick(); env.setTime(6000); env.expireIO();
  const report = await pending; expect(report.status).toBe("FAIL"); expect(report.failures.join()).toContain("DEADLINE"); expect(report.cleanup).toBe("REMOVED");
});
test("MOCK stalled workspace IO fails within one check interval rather than the multi-day outer envelope", async () => {
  const env = operator(); env.hold(); env.io.usage = async () => new Promise<number>(() => {});
  const pending = runCampaignOperator(launch, env.io); await env.started; await env.tick(60000, 60000); env.setTime(120000); env.expireIO();
  const report = await pending; expect(report.status).toBe("FAIL"); expect(report.failures.join()).toContain("DEADLINE"); expect(report.cleanup).toBe("REMOVED");
});
test("MOCK final worker-report IO expires while leaving time for owned CID removal", async () => {
  const env = operator(), original = env.io.read, reading = deferred<void>();
  env.io.read = async (path, cap) => { if (path.endsWith("campaign-worker.json")) { reading.resolve(); return new Promise<Uint8Array>(() => {}); } return original(path, cap); };
  const pending = runCampaignOperator(launch, env.io); await reading.promise; env.setTime(5000); env.expireIO();
  const report = await pending; expect(report.status).toBe("FAIL"); expect(report.failures.join()).toContain("DEADLINE");
  expect(report.cleanup).toBe("REMOVED"); expect(env.commands.filter(c => c.argv[2] === "rm")).toHaveLength(1);
});
test("MOCK telemetry opens before container creation and closes once after owned cleanup", async () => {
  const env = operator(); let closed = 0;
  env.setDocker(verb => { if (verb === "create") expect(env.telemetry.length).toBe(1); return undefined; });
  env.io.closeTelemetry = () => { closed++; expect(env.commands.filter(c => c.argv[2] === "rm")).toHaveLength(1); };
  expect((await runCampaignOperator(launch, env.io)).status).toBe("PASS"); expect(closed).toBe(1);
});
test("repository-local telemetry symlink replacement cannot redirect retained-descriptor writes", () => {
  const root = repositoryScratch("campaign-telemetry-"), approved = `${root}/approved`; mkdirSync(approved);
  const path = `${approved}/telemetry.ndjson`, target = `${root}/host-target`; writeFileSync(target, "PRESERVE_TARGET");
  const writer = openCampaignTelemetry(path, 4096); unlinkSync(path); symlinkSync(target, path);
  writer.append({ ordinal: 1, observedMs: 1, freeMiB: 4096 }); expect(readFileSync(target, "utf8")).toBe("PRESERVE_TARGET");
  expect(() => writer.close()).toThrow("TELEMETRY_REPLACED"); expect(() => writer.append({ ordinal: 2, observedMs: 2, freeMiB: 4096 })).toThrow("TELEMETRY_CLOSED");
  expect(readFileSync(target, "utf8")).toBe("PRESERVE_TARGET"); writer.close();
});
test("repository-local progress accepts a stable old snapshot across atomic replacement", async () => {
  const root = repositoryScratch("campaign-progress-"), path = `${root}/progress.json`, next = `${root}/next.json`;
  writeFileSync(path, encode({ completed: 1 })); writeFileSync(next, encode({ completed: 2 }));
  const original = fileIO.open; let calls = 0;
  const opened = spyOn(fileIO, "open").mockImplementation(async (physical, flags, mode) => {
    const handle = await original(physical, flags, mode), stat = handle.stat.bind(handle) as (...args: any[]) => Promise<any>;
    handle.stat = (async (...args: any[]) => { if (++calls === 2) renameSync(next, path); return stat(...args); }) as typeof handle.stat;
    return handle;
  });
  try { expect(JSON.parse(Buffer.from(await readCampaignProgress(path, 4096)).toString())).toEqual({ completed: 1 }); }
  finally { opened.mockRestore(); }
  expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ completed: 2 });
});
test("repository-local workspace traversal tolerates removed scratch entries and directories", async () => {
  const root = repositoryScratch("campaign-usage-"), gone = `${root}/gone`, transient = `${root}/transient`;
  mkdirSync(gone); writeFileSync(transient, "transient"); writeFileSync(`${root}/retained`, "retained");
  const original = fileIO.readdir; let removed = false;
  const scan = spyOn(fileIO, "readdir").mockImplementation((async (...args: any[]) => {
    if (String(args[0]) === gone) rmdirSync(gone);
    const children = await (original as any)(...args);
    if (String(args[0]) === root && !removed) { removed = true; unlinkSync(transient); }
    return children;
  }) as typeof fileIO.readdir);
  try { expect(await campaignWorkspaceUsage(root, 1048576, 100, () => 0)).toBeGreaterThanOrEqual(8); }
  finally { scan.mockRestore(); }
  await expect(campaignWorkspaceUsage(`${root}/missing-root`, 1048576, 100, () => 0)).rejects.toThrow();
});
test("MOCK unknown create output never grants container ownership", async () => {
  const env = operator(); env.setDocker(verb => verb === "create" ? pass(Buffer.from("unknown")) : undefined);
  const report = await runCampaignOperator(launch, env.io); expect(report.status).toBe("FAIL"); expect(report.cid).toBeNull();
  expect(env.commands.filter(c => c.argv[0] === "docker").map(c => c.argv[2])).toEqual(["create"]);
});
