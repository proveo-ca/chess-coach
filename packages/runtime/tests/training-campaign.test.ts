// SPEC: _spec/checkpoint-runtime.puml, _spec/match-runtime.puml
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import type { TrainingState } from "../../contracts/src/training-state";
import { checkTrainingState, initialTrainingState, nextAttempt } from "../src/curriculum";
import type { MatchClock } from "../src/match-session";
import { MatchWorker } from "../src/match-worker";
import { drawStream, MASTERS } from "../src/rng";
import { STORAGE_BOUNDS } from "../src/storage-bounds";
import { TrainingCampaign } from "../src/training-campaign";
import type { CampaignCoordinator, CampaignMaster, TrainingCampaignInput } from "../src/training-campaign";
import { TrainingCoordinator } from "../src/training-coordinator";
import type { AttemptSetup } from "../src/training-coordinator";
import type { NativeRecord } from "../src/training-store";
import { SyntheticMatchLearners, SyntheticMatchScorer, SyntheticMatchTransport, syntheticCorpus } from "./match-fixture";
import { repositoryScratch } from "./repository-scratch";
import { bindings, byteRef, syntheticRecord } from "./training-fixture";

type Result = ReturnType<CampaignCoordinator["finalize"]>;
type Call = { master: CampaignMaster; id: string; timing: MatchClock; createOwned: AttemptSetup };
type Hooks = {
  load?: TrainingCampaignInput["initialRecord"];
  initialize?: (master: CampaignMaster, state: TrainingState) => TrainingState;
  attempt?: (call: Call, state: TrainingState) => TrainingState | Promise<TrainingState>;
  finalize?: (timing: MatchClock, result: Result) => Result;
  close?: () => void;
  clock?: () => bigint;
};
const selected = syntheticRecord("synthetic-campaign-record-not-a-native-burn-model");
const cached = new Map<CampaignMaster, TrainingState[]>();

function states(master: CampaignMaster): TrainingState[] {
  const existing = cached.get(master);
  if (existing) return existing;
  let state = initialTrainingState(master, selected.config.recordSha256, bindings());
  const result = [state], history = byteRef(`synthetic-history-${master}`), journal = byteRef(`synthetic-journal-${master}`);
  for (let ordinal = 0; ordinal < 1000; ordinal++) {
    const count = ordinal + 1, corpusStarted = Math.ceil(count / 2);
    const consumed = ordinal % 36 === 0 ? nextAttempt(state, `synthetic-${ordinal}`).consumed : state;
    state = { ...consumed, counters: { started: count, verifiedCompleted: count, eligibleCompleted: 1, updates: 1, nonzeroPGUpdates: 1, baselineCount: 1, baselineSum: 1 },
      control: { ...consumed.control, corpusCursor: (corpusStarted - 1) % 18 + 1, corpusEpoch: Math.floor((corpusStarted - 1) / 18),
        scheduleCursor: count, liveOrdinal: Math.floor(count / 2), dueBucket: Math.floor(count / 100) },
      rng: ordinal === 0 ? { ...consumed.rng, "policy-sampling": drawStream(consumed.rng["policy-sampling"]).after } : consumed.rng,
      journalRef: { ...journal, byteLength: count, lastRecordOrdinal: count }, historyRefs: [...state.historyRefs, history] };
    result.push(state);
  }
  checkTrainingState(state);
  cached.set(master, result);
  return result;
}

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(hooks: Hooks = {}) {
  let now = 0n, active = 0, maxActive = 0, finalized = 0, closed = 0;
  const calls: Call[] = [], initialized: CampaignMaster[] = [], loaded: { master: CampaignMaster; timing: MatchClock }[] = [];
  const finalTimings: MatchClock[] = [];
  const events: string[] = [];
  const createOwned: AttemptSetup = () => { throw new Error("synthetic injected coordinator does not execute training"); };
  const artifacts = MASTERS.map(master => ({ master, artifactRef: byteRef(`synthetic-artifact-${master}`) }));
  const result: Result = { experiment: { version: "chess-coach.training-experiment.v1", status: "COMPLETE", artifacts,
    primaryMaster: 101, primaryArtifactRef: artifacts[0]!.artifactRef }, ref: byteRef("synthetic-experiment") };
  const coordinator: CampaignCoordinator = {
    initializeMaster(master, record) {
      initialized.push(master as CampaignMaster); events.push(`initialize-${master}`);
      expect(record).toEqual(selected);
      return hooks.initialize?.(master as CampaignMaster, states(master as CampaignMaster)[0]!) ?? states(master as CampaignMaster)[0]!;
    },
    async runAttempt(master, id, timing, factory) {
      const call: Call = { master: master as CampaignMaster, id, timing, createOwned: factory };
      calls.push(call); events.push(id); active++; maxActive = Math.max(maxActive, active);
      try {
        const state = states(call.master)[Number(id.slice(-4)) + 1]!;
        return hooks.attempt ? await hooks.attempt(call, state) : state;
      } finally { active--; }
    },
    finalize(timing) { finalized++; finalTimings.push(timing); events.push("finalize"); return hooks.finalize?.(timing, result) ?? result; },
    close() { closed++; events.push("close"); hooks.close?.(); },
  };
  const input: TrainingCampaignInput = { coordinator, initialRecord(master, timing) {
    loaded.push({ master, timing }); events.push(`load-${master}`);
    return hooks.load?.(master, timing) ?? selected;
  }, createOwned, clockNs: () => hooks.clock ? hooks.clock() : now };
  const campaign = new TrainingCampaign(input);
  return { campaign, coordinator, input, calls, initialized, loaded, finalTimings, events, createOwned, result,
    setTime: (value: bigint) => { now = value; }, counts: () => ({ finalized, closed, maxActive }) };
}

test("campaign serially admits all 5000 deterministic attempts with one captured factory and closes once", async () => {
  const env = fixture({ attempt(call, state) { env.setTime(call.timing.originNs + 1_000_000_000n); return state; } });
  const originalInitialize = env.coordinator.initializeMaster;
  env.coordinator.initializeMaster = () => { throw new Error("mutated coordinator must not replace captured method"); };
  (env.input as { createOwned: AttemptSetup }).createOwned = () => { throw new Error("mutated factory"); };
  expect(await env.campaign.run()).toEqual(env.result);
  expect(env.initialized).toEqual([...MASTERS]);
  expect(env.loaded.map(value => value.master)).toEqual([...MASTERS]);
  expect(env.calls).toHaveLength(5000);
  for (let index = 0; index < 5000; index++) {
    const call = env.calls[index]!, master = MASTERS[Math.floor(index / 1000)]!;
    expect(call.master).toBe(master);
    expect(call.id).toBe(`m${master}-a${String(index % 1000).padStart(4, "0")}`);
    expect(call.createOwned).toBe(env.createOwned);
    expect(Object.isFrozen(call.timing)).toBe(true);
    expect(call.timing.startupDeadlineNs - call.timing.originNs).toBe(10_000_000_000n);
    expect(call.timing.workDeadlineNs - call.timing.originNs).toBe(297_000_000_000n);
    expect(call.timing.cleanupDeadlineNs - call.timing.originNs).toBe(300_000_000_000n);
    expect(call.timing.clockNs).toBe(env.loaded[0]!.timing.clockNs);
    expect(call.timing.originNs).toBe(BigInt(index) * 1_000_000_000n);
  }
  for (const master of MASTERS.slice(1)) expect(env.events.indexOf(`load-${master}`)).toBeGreaterThan(env.events.indexOf(`m${master - 1}-a0999`));
  expect(env.finalTimings[0]).toEqual({ ...env.calls[0]!.timing, originNs: 5_000_000_000_000n,
    startupDeadlineNs: 5_010_000_000_000n, workDeadlineNs: 5_297_000_000_000n, cleanupDeadlineNs: 5_300_000_000_000n });
  expect(env.counts()).toEqual({ finalized: 1, closed: 1, maxActive: 1 });
  await expect(env.campaign.run()).rejects.toThrow("NO_RETRY");
  expect(env.counts().closed).toBe(1);
  env.coordinator.initializeMaster = originalInitialize;
}, 30000);

for (const [name, initial] of [
  ["resumed", () => states(101)[1]!],
  ["wrong master", () => states(102)[0]!],
  ["wrong model", () => ({ ...states(101)[0]!, modelId: "a".repeat(64) })],
] as const) {
  test(`campaign rejects ${name} initial state before attempts`, async () => {
    const env = fixture({ initialize: initial });
    await expect(env.campaign.run()).rejects.toThrow("INITIAL_STATE");
    expect(env.calls).toHaveLength(0);
    expect(env.counts().closed).toBe(1);
  });
}

for (const [name, invalid] of [
  ["skipped count", () => states(101)[2]!],
  ["duplicated count", () => states(101)[0]!],
  ["premature terminal", () => states(101)[1000]!],
  ["wrong master", () => states(102)[1]!],
  ["changed bindings", () => ({ ...states(101)[1]!, bindings: { ...bindings(), source: byteRef("changed") } })],
  ["invalid curriculum", () => ({ ...states(101)[1]!, control: { ...states(101)[1]!.control, corpusCursor: 0 } })],
] as const) {
  test(`campaign rejects ${name} returned state without advancing masters`, async () => {
    const env = fixture({ attempt: invalid });
    await expect(env.campaign.run()).rejects.toThrow();
    expect(env.calls).toHaveLength(1);
    expect(env.initialized).toEqual([101]);
    expect(env.counts()).toEqual({ finalized: 0, closed: 1, maxActive: 1 });
  });
}

test("campaign rejects model identity changes without an update", async () => {
  const env = fixture({ attempt(call, state) { return call.id.endsWith("0001") ? { ...state, modelId: "b".repeat(64) } : state; } });
  await expect(env.campaign.run()).rejects.toThrow("PROGRESS");
  expect(env.calls).toHaveLength(2);
  expect(env.counts().closed).toBe(1);
});

test("campaign binds every initial master to the same experiment bindings", async () => {
  const env = fixture({ initialize(master, state) { return master === 102 ? { ...state, bindings: { ...state.bindings, source: byteRef("changed") } } : state; } });
  await expect(env.campaign.run()).rejects.toThrow("INITIAL_STATE");
  expect(env.initialized).toEqual([101, 102]);
  expect(env.calls).toHaveLength(1000);
  expect(env.counts().closed).toBe(1);
}, 30000);

test("campaign requires nonzero policy gradient at 1000/1000 before loading the next master", async () => {
  const env = fixture({ attempt(_call, state) { return { ...state, counters: { ...state.counters, nonzeroPGUpdates: 0 } }; } });
  await expect(env.campaign.run()).rejects.toThrow("FINAL_VALIDITY");
  expect(env.calls).toHaveLength(1000);
  expect(env.initialized).toEqual([101]);
  expect(env.counts()).toEqual({ finalized: 0, closed: 1, maxActive: 1 });
}, 30000);

for (const phase of ["load", "initialize", "attempt"] as const) {
  test(`campaign closes once after ${phase} failure and preserves the primary error`, async () => {
    const primary = new Error(`synthetic ${phase} failure`), env = fixture({ [phase]: () => { throw primary; } });
    await expect(env.campaign.run()).rejects.toBe(primary);
    await expect(env.campaign.run()).rejects.toThrow("NO_RETRY");
    expect(env.counts().closed).toBe(1);
    expect(env.counts().finalized).toBe(0);
    expect(env.initialized.length).toBeLessThanOrEqual(1);
  });
}

test("campaign aggregates close failure after the unchanged primary error", async () => {
  const primary = new Error("synthetic loader failure"), cleanup = new Error("synthetic close failure");
  const env = fixture({ load: () => { throw primary; }, close: () => { throw cleanup; } });
  const error = await env.campaign.run().catch(error => error);
  expect(error).toBeInstanceOf(AggregateError);
  expect(error.errors).toEqual([primary, cleanup]);
  expect(env.counts().closed).toBe(1);
});

for (const phase of ["load", "initialize"] as const) {
  test(`campaign rejects exact initialization deadline after ${phase}`, async () => {
    const env = fixture({ [phase]: () => { env.setTime(10_000_000_000n); return phase === "load" ? selected : states(101)[0]!; } } as Hooks);
    await expect(env.campaign.run()).rejects.toThrow("DEADLINE");
    expect(env.calls).toHaveLength(0);
    expect(env.initialized).toHaveLength(phase === "load" ? 0 : 1);
    expect(env.loaded[0]!.timing.originNs).toBe(0n);
    expect(env.counts().closed).toBe(1);
  });
}

test("campaign shares the original initialization budget and captures the next attempt origin after initialization", async () => {
  const fault = new Error("synthetic stop after observing timing");
  let initialization!: MatchClock;
  const env = fixture({ load(_master, timing) { initialization = timing; env.setTime(timing.originNs + 9_000_000_000n); return selected; },
    initialize(_master, state) { env.setTime(initialization.startupDeadlineNs - 1n); return state; },
    attempt(call) {
      expect(initialization.originNs).toBe(0n);
      expect(call.timing.originNs).toBe(9_999_999_999n);
      expect(call.timing).not.toBe(initialization);
      expect(call.timing.clockNs).toBe(initialization.clockNs);
      throw fault;
    } });
  await expect(env.campaign.run()).rejects.toBe(fault);
  expect(env.counts().closed).toBe(1);
});

test("campaign bounds a pending initial record and ignores its late completion after close", async () => {
  let ticks = 0;
  const pending = deferred<NativeRecord>();
  const env = fixture({ clock: () => ticks++ === 0 ? 0n : 9_999_000_000n, load: () => pending.promise });
  await expect(env.campaign.run()).rejects.toThrow("INITIAL_DEADLINE");
  expect(env.counts().closed).toBe(1);
  pending.resolve(selected);
  await pending.promise;
  await Promise.resolve();
  expect(env.initialized).toHaveLength(0);
  expect(env.counts().closed).toBe(1);
}, 1000);

test("campaign rejects a regressing clock across loading and attempt completion", async () => {
  const env = fixture({ load: () => { env.setTime(5n); return selected; }, attempt: (_call, state) => { env.setTime(4n); return state; } });
  await expect(env.campaign.run()).rejects.toThrow("CLOCK");
  expect(env.calls).toHaveLength(1);
  expect(env.counts().closed).toBe(1);
});

test("campaign attempts close even if the clock fails before any admission", async () => {
  const fault = new Error("synthetic clock failure"), env = fixture({ clock: () => { throw fault; } });
  await expect(env.campaign.run()).rejects.toBe(fault);
  expect(env.loaded).toHaveLength(0);
  expect(env.counts().closed).toBe(1);
});

test("campaign observes exact attempt deadline without racing unsettled owned cleanup", async () => {
  const started = deferred<void>(), pending = deferred<TrainingState>();
  const env = fixture({ attempt(call) { env.setTime(call.timing.workDeadlineNs); started.resolve(); return pending.promise; } });
  const first = env.campaign.run();
  await started.promise;
  expect(env.counts().closed).toBe(0);
  pending.resolve(states(101)[1]!);
  await expect(first).rejects.toThrow("DEADLINE");
  expect(env.calls).toHaveLength(1);
  expect(env.counts().closed).toBe(1);
});

test("concurrent campaign entry revokes admissions but waits for the owned attempt before its only close", async () => {
  const started = deferred<void>(), pending = deferred<TrainingState>();
  const env = fixture({ attempt() { started.resolve(); return pending.promise; } });
  const first = env.campaign.run();
  await started.promise;
  await expect(env.campaign.run()).rejects.toThrow("NO_RETRY");
  expect(env.counts().closed).toBe(0);
  pending.resolve(states(101)[1]!);
  await expect(first).rejects.toThrow("REVOKED");
  expect(env.calls).toHaveLength(1);
  expect(env.counts().closed).toBe(1);
  await expect(env.campaign.run()).rejects.toThrow("NO_RETRY");
  expect(env.counts().closed).toBe(1);
});

test("reentry while loading prevents late initialization", async () => {
  const started = deferred<void>(), pending = deferred<NativeRecord>();
  const env = fixture({ load() { started.resolve(); return pending.promise; } });
  const first = env.campaign.run();
  await started.promise;
  await expect(env.campaign.run()).rejects.toThrow("NO_RETRY");
  expect(env.counts().closed).toBe(0);
  pending.resolve(selected);
  await expect(first).rejects.toThrow("REVOKED");
  expect(env.initialized).toHaveLength(0);
  expect(env.counts().closed).toBe(1);
});

for (const phase of ["finalize", "close", "finalize-deadline", "close-deadline", "experiment", "ref"] as const) {
  test(`campaign rejects ${phase} failure after 5000 validated calls and never returns COMPLETE`, async () => {
    const fault = new Error(`synthetic ${phase} failure`);
    let finalTiming!: MatchClock;
    const env = fixture({ finalize(timing, result) {
      finalTiming = timing;
      if (phase === "finalize") throw fault;
      if (phase === "finalize-deadline") env.setTime(timing.workDeadlineNs);
      if (phase === "experiment") return { ...result, experiment: { ...result.experiment, primaryMaster: 105 } } as unknown as Result;
      if (phase === "ref") return { ...result, ref: { ...result.ref, byteLength: STORAGE_BOUNDS.experimentBytes + 1 } };
      return result;
    }, close() {
      if (phase === "close") throw fault;
      if (phase === "close-deadline") env.setTime(finalTiming.cleanupDeadlineNs);
    } });
    const error = await env.campaign.run().catch(error => error);
    expect(error).toBeInstanceOf(Error);
    if (phase === "finalize" || phase === "close") expect(error).toBe(fault);
    if (phase.endsWith("deadline")) expect(error.message).toContain("DEADLINE");
    expect(env.calls).toHaveLength(5000);
    expect(env.counts()).toEqual({ finalized: 1, closed: 1, maxActive: 1 });
  }, 30000);
}

for (const kind of ["hash", "empty", "bound", "config"] as const) {
  test(`campaign rejects invalid prepared record ${kind} before initialization`, async () => {
    const record = kind === "empty" ? new Uint8Array() : kind === "bound" ? new Uint8Array(STORAGE_BOUNDS.nativeRecordBytes + 1) : Uint8Array.of(1);
    const input = kind === "config" ? { ...selected, config: { ...selected.config, hiddenUnits: 64 } } as unknown as NativeRecord : { ...selected, record };
    const env = fixture({ load: () => input });
    await expect(env.campaign.run()).rejects.toThrow();
    expect(env.initialized).toHaveLength(0);
    expect(env.counts().closed).toBe(1);
  });
}

test("campaign validates callbacks before taking coordinator ownership", () => {
  const env = fixture();
  expect(() => new TrainingCampaign({ ...env.input, createOwned: null } as unknown as TrainingCampaignInput)).toThrow("INPUT");
  expect(() => new TrainingCampaign({ ...env.input, clockNs: 3 } as unknown as TrainingCampaignInput)).toThrow("INPUT");
  expect(env.counts().closed).toBe(0);
});

test("actual coordinator campaign smoke retains one synthetic zero-window completion and the next failed STARTED", async () => {
  const root = `${repositoryScratch("campaign-smoke-")}/state`, coordinator = new TrainingCoordinator(root, bindings());
  const fault = new Error("synthetic second setup refusal; no native training"), setups: string[] = [];
  const createOwned: AttemptSetup = ({ descriptor, model, timing }) => {
    setups.push(descriptor.attemptId);
    if (setups.length === 2) throw fault;
    const corpus = syntheticCorpus(0), scorer = new SyntheticMatchScorer(timing.clockNs), learners = new SyntheticMatchLearners();
    const worker = new MatchWorker(descriptor.attemptId, { corpus, strategic: null, scorer, modelId: model.config.recordSha256,
      clockNs: timing.clockNs, workDeadlineNs: timing.workDeadlineNs });
    return { corpus, strategic: null, verifier: scorer, learners, transport: new SyntheticMatchTransport(worker, timing.clockNs) };
  };
  const campaign = new TrainingCampaign({ coordinator, initialRecord: () => selected, createOwned, clockNs: () => 0n });
  await expect(campaign.run()).rejects.toBe(fault);
  expect(setups).toEqual(["m101-a0000", "m101-a0001"]);
  const inspection = new Database(`${root}/private.sqlite`, { readonly: true });
  try {
    expect(inspection.query<{ id: string; status: string }, []>("SELECT id,status FROM attempts ORDER BY ordinal").all()).toEqual([
      { id: "m101-a0000", status: "COMPLETED" }, { id: "m101-a0001", status: "STARTED" },
    ]);
    const control = inspection.query<{ aborted: number; failure: string }, []>("SELECT aborted,failure FROM control").get()!;
    expect(control.aborted).toBe(1);
    expect(JSON.parse(control.failure).message).toContain("synthetic second setup refusal");
    const row = inspection.query<{ state: string }, []>("SELECT state FROM masters WHERE master=101").get()!;
    expect(JSON.parse(row.state).counters).toMatchObject({ started: 2, verifiedCompleted: 1, updates: 0, nonzeroPGUpdates: 0 });
  } finally { inspection.close(); }
  const packet = `${root}/packet-00`, first = `${packet}/attempt-m101-a0000`, second = `${packet}/attempt-m101-a0001`;
  expect(readdirSync(first).some(name => name.endsWith("-verified-journal.bin"))).toBe(true);
  const files = readdirSync(second);
  expect(files).toEqual(["000000-started-descriptor.bin"]);
  expect(JSON.parse(readFileSync(`${second}/${files[0]}`, "utf8")).descriptor).toMatchObject({ attemptId: "m101-a0001", startedOrdinal: 1 });
});
