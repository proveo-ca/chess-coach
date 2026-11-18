// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { bindingsShape } from "../../packages/contracts/src/training-state";
import type { ByteRef, TrainingState } from "../../packages/contracts/src/training-state";
import { checkTrainingState, initialTrainingState, nextAttempt } from "../../packages/runtime/src/curriculum";
import type { MatchClock } from "../../packages/runtime/src/match-session";
import { drawStream } from "../../packages/runtime/src/rng";
import { STORAGE_BOUNDS } from "../../packages/runtime/src/storage-bounds";
import type { AttemptSetup } from "../../packages/runtime/src/training-coordinator";
import type { NativeRecord } from "../../packages/runtime/src/training-store";
import { observeR4 } from "./r4-observation.ts";
import type { R4Coordinator, R4Input, R4Observation } from "./r4-observation.ts";

type SetupInput = Parameters<AttemptSetup>[0];
type Dependencies = Awaited<ReturnType<AttemptSetup>>;
type Call = { master: number; id: string; timing: MatchClock; createOwned: AttemptSetup; previous: TrainingState };
type Hooks = {
  initialize?: (state: TrainingState, record: NativeRecord) => TrainingState;
  setup?: (input: SetupInput, call: Call) => SetupInput;
  delegate?: AttemptSetup;
  returned?: (state: TrainingState, call: Call) => TrainingState;
  run?: (call: Call, execute: () => Promise<TrainingState>) => Promise<TrainingState>;
  snapshot?: (state: TrainingState, reads: number) => TrainingState;
  close?: () => void | Promise<void>;
  clock?: () => bigint;
  updates?: readonly boolean[];
};

const bytesRef = (bytes: Uint8Array): ByteRef => ({ byteLength: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
const byteRef = (label: string): ByteRef => bytesRef(Buffer.from(label));
const bindings = () => bindingsShape.parse(Object.fromEntries(["source", "tests", "closure", "dependencyLock", "image", "runtimeConfiguration", "coreRules", "strategicSource",
  "corpusManifest", "corpusSource", "recipe", "featureLayout", "fixtureManifest", "hostConfiguration"].map(key => [key, byteRef(`injected-${key}`)])));
function record(label: string): NativeRecord {
  const bytes = Buffer.from(`injected-not-a-native-model:${label}`);
  return { record: bytes, config: { version: "chess-coach.model-config.v1", architecture: "mlp-relu-32", featureVersion: "chess-coach.features.v1",
    inputFeatures: 2271, hiddenUnits: 32, recordSha256: bytesRef(bytes).sha256 } };
}

function complete(previous: TrainingState, id: string, proposal: NativeRecord | null): TrainingState {
  const state = nextAttempt(previous, id).consumed;
  state.counters.verifiedCompleted++;
  state.journalRef = { ...byteRef(`injected-journal-${id}`), byteLength: (previous.journalRef?.byteLength ?? 0) + 20,
    lastRecordOrdinal: (previous.journalRef?.lastRecordOrdinal ?? 0) + 1 };
  state.historyRefs.push(byteRef(`injected-history-${id}`));
  if (proposal !== null) {
    state.rng["policy-sampling"] = drawStream(state.rng["policy-sampling"]).after;
    state.modelId = proposal.config.recordSha256;
    state.counters.eligibleCompleted++;
    state.counters.updates++;
    state.counters.baselineCount++;
    state.counters.baselineSum += previous.counters.baselineSum === previous.counters.baselineCount && previous.counters.baselineCount > 0 ? 0 : 1;
    state.counters.nonzeroPGUpdates++;
  }
  return checkTrainingState(state);
}

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(hooks: Hooks = {}) {
  const initialRecord = record("initial"), proposals = [record("proposal-0"), record("proposal-1")];
  const models = new Map([initialRecord, ...proposals].map(model => [model.config.recordSha256, model]));
  const calls: Call[] = [], setupInputs: SetupInput[] = [], initialized: number[] = [], events: string[] = [];
  const dependencies = {} as Dependencies;
  let state = initialTrainingState(101, initialRecord.config.recordSha256, bindings());
  let now = 0n, closed = 0, finalized = 0, reads = 0, active = 0, maxActive = 0, clockCalls = 0;
  const createOwned: AttemptSetup = input => {
    setupInputs.push(input); events.push(`delegate-${input.descriptor.startedOrdinal}`);
    return hooks.delegate ? hooks.delegate(input) : dependencies;
  };
  const coordinator = {
    initializeMaster(master: number, selected: NativeRecord) {
      initialized.push(master); events.push("initialize");
      state = hooks.initialize?.(structuredClone(state), selected) ?? structuredClone(state);
      return state;
    },
    async runAttempt(master: number, id: string, timing: MatchClock, factory: AttemptSetup) {
      const call: Call = { master, id, timing, createOwned: factory, previous: structuredClone(state) };
      calls.push(call); events.push(`attempt-${id}`); active++; maxActive = Math.max(maxActive, active);
      const execute = async () => {
        const expected = nextAttempt(call.previous, id);
        let setup: SetupInput = { descriptor: expected.descriptor, rng: expected.consumed.rng,
          model: structuredClone(models.get(call.previous.modelId)!), directory: `injected-only/${id}`, timing };
        setup = hooks.setup?.(setup, call) ?? setup;
        expect(await factory(setup)).toBe(dependencies);
        state = complete(call.previous, id, (hooks.updates ?? [true, false])[calls.length - 1] ? proposals[calls.length - 1]! : null);
        state = hooks.returned?.(state, call) ?? state;
        events.push(`settled-${id}`);
        return state;
      };
      try { return hooks.run ? await hooks.run(call, execute) : await execute(); }
      finally { active--; }
    },
    snapshot(master: number) {
      expect(master).toBe(101); reads++; events.push(`snapshot-${reads}`);
      return hooks.snapshot?.(structuredClone(state), reads) ?? structuredClone(state);
    },
    close() { closed++; events.push("close"); return hooks.close?.(); },
    finalize(): never { finalized++; throw new Error("Full training finalization is outside the R4 inventory"); },
  } satisfies R4Coordinator & { finalize(): never };
  const input: R4Input = { coordinator, initialRecord, createOwned, clockNs: () => { clockCalls++; return hooks.clock ? hooks.clock() : now; } };
  return { input, coordinator, initialRecord, proposals, calls, setupInputs, initialized, events, dependencies, createOwned,
    setTime(value: bigint) { now = value; }, counts: () => ({ closed, finalized, reads, active, maxActive, clockCalls }) };
}

function failed(observation: R4Observation, text?: string): void {
  expect(observation.status).toBe("FAIL");
  expect(observation.scope).toBe("COMPOSITION_ONLY_INPUTS_UNQUALIFIED");
  expect(observation.qualified).toBe(false);
  expect(observation.close.calls).toBe(1);
  expect(observation.failures.length).toBeGreaterThan(0);
  if (text) expect(String(observation.failures[0]!.error)).toContain(text);
}

test("R4 observes exactly corpus ordinal 0 then live ordinal 1 with one delegate, no overlap, no finalize, and one close", async () => {
  const env = fixture(), result = await observeR4(env.input);
  expect(result.status).toBe("PASS");
  expect(result.scope).toBe("COMPOSITION_ONLY_INPUTS_UNQUALIFIED");
  expect(result.qualified).toBe(false);
  expect(result.failures).toEqual([]);
  expect(result.close).toEqual({ calls: 1, status: "PASS", cleanupDeadlineNs: "300000000000" });
  expect(env.initialized).toEqual([101]);
  expect(env.calls.map(call => [call.master, call.id])).toEqual([[101, "r4-m101-a0000"], [101, "r4-m101-a0001"]]);
  expect(env.calls[0]!.createOwned).toBe(env.calls[1]!.createOwned);
  expect(env.setupInputs).toHaveLength(2);
  let previous = result.initialState!.state;
  for (const [index, attempt] of result.attempts.entries()) {
    const expected = nextAttempt(previous, attempt.attemptId);
    expect(attempt.descriptor).toEqual(expected.descriptor);
    expect(attempt.rng).toEqual(expected.consumed.rng);
    expect(attempt.setupCalls).toBe(1);
    expect(attempt.model!.config.recordSha256).toBe(previous.modelId);
    expect(attempt.returned!.state.counters).toMatchObject({ started: index + 1, verifiedCompleted: index + 1, eligibleCompleted: 1, nonzeroPGUpdates: 1 });
    expect(attempt.returned).toEqual(attempt.snapshot);
    expect(attempt.returned!.serializedStateRef).toEqual(byteRef(JSON.stringify(attempt.returned!.state)));
    expect(Object.isFrozen(env.calls[index]!.timing)).toBe(true);
    expect(env.calls[index]!.timing.clockNs).toBe(env.calls[0]!.timing.clockNs);
    expect(attempt.startupDeadlineNs).toBe("10000000000");
    expect(attempt.workDeadlineNs).toBe("297000000000");
    previous = attempt.returned!.state;
  }
  expect(result.attempts.map(attempt => attempt.descriptor!.schedule.kind)).toEqual(["corpus", "live"]);
  expect(result.initialRecord!.recordRef).toEqual(bytesRef(env.initialRecord.record));
  expect(result.initialRecord!.configRef).toEqual(byteRef(JSON.stringify(env.initialRecord.config)));
  expect(result.initialState).toEqual(result.initialSnapshot);
  expect(env.events).toEqual(["initialize", "snapshot-1", "attempt-r4-m101-a0000", "delegate-0", "settled-r4-m101-a0000", "snapshot-2",
    "attempt-r4-m101-a0001", "delegate-1", "settled-r4-m101-a0001", "snapshot-3", "close"]);
  expect(env.counts()).toMatchObject({ closed: 1, finalized: 0, reads: 3, active: 0, maxActive: 1 });
});

test("R4 copies prepared input and captures coordinator, delegate and clock callbacks before mutation", async () => {
  const fault = () => { throw new Error("mutated callback must not run"); };
  const env = fixture({ initialize(state, selected) {
    expect(selected).toEqual(env.initialRecord);
    expect(selected).not.toBe(env.initialRecord);
    expect(selected.record).not.toBe(env.initialRecord.record);
    selected.record.fill(0); selected.config.recordSha256 = "f".repeat(64);
    env.coordinator.runAttempt = fault; env.coordinator.snapshot = fault; env.coordinator.close = fault;
    Object.assign(env.input, { createOwned: fault, clockNs: fault, initialRecord: null });
    return state;
  } });
  const result = await observeR4(env.input);
  expect(result.status).toBe("PASS");
  expect(result.initialRecord!.recordRef.sha256).toBe(env.initialRecord.config.recordSha256);
  expect(env.setupInputs).toHaveLength(2);
  expect(env.counts().closed).toBe(1);
});

for (const key of ["initializeMaster", "runAttempt", "snapshot", "close", "createOwned", "clockNs"] as const) {
  test(`R4 rejects invalid ${key} with TypeError before ownership or clock work`, async () => {
    const env = fixture();
    if (key === "createOwned" || key === "clockNs") Object.assign(env.input, { [key]: null });
    else Object.assign(env.coordinator, { [key]: undefined });
    await expect(observeR4(env.input)).rejects.toBeInstanceOf(TypeError);
    expect(env.counts()).toMatchObject({ closed: 0, clockCalls: 0 });
    expect(env.initialized).toEqual([]);
  });
}

test("R4 rejects a missing input coordinator before taking ownership", async () => {
  await expect(observeR4(null as unknown as R4Input)).rejects.toBeInstanceOf(TypeError);
});

for (const kind of ["missing", "empty", "bound", "hash", "config", "extra-config"] as const) {
  test(`R4 closes a malformed prepared record: ${kind}`, async () => {
    const env = fixture();
    const selected = kind === "missing" ? null : kind === "empty" ? { ...env.initialRecord, record: new Uint8Array() } :
      kind === "bound" ? { ...env.initialRecord, record: new Uint8Array(STORAGE_BOUNDS.nativeRecordBytes + 1) } :
      kind === "hash" ? { ...env.initialRecord, record: Uint8Array.of(1) } :
      { ...env.initialRecord, config: { ...env.initialRecord.config, ...(kind === "config" ? { hiddenUnits: 64 } : { extra: "x".repeat(STORAGE_BOUNDS.configBytes + 1) }) } };
    const result = await observeR4({ ...env.input, initialRecord: selected as NativeRecord });
    failed(result);
    expect(result.failures[0]!.phase).toBe("initialize");
    expect(env.initialized).toEqual([]);
    expect(env.calls).toEqual([]);
    expect(env.counts().closed).toBe(1);
  });
}

for (const [name, mutate] of [
  ["resumed", (state: TrainingState) => complete(state, "old", null)],
  ["wrong master", (state: TrainingState) => initialTrainingState(102, state.modelId, state.bindings)],
  ["wrong model", (state: TrainingState) => ({ ...state, modelId: "f".repeat(64) })],
  ["nonfresh RNG", (state: TrainingState) => ({ ...state, rng: { ...state.rng, opponent: drawStream(state.rng.opponent).after } })],
] as const) {
  test(`R4 requires an exact fresh initial state: ${name}`, async () => {
    const env = fixture({ initialize: mutate });
    failed(await observeR4(env.input), "INITIAL_STATE");
    expect(env.calls).toEqual([]);
    expect(env.counts().closed).toBe(1);
  });
}

for (const [name, mutate] of [
  ["ordinal", (input: SetupInput) => ({ ...input, descriptor: { ...input.descriptor, startedOrdinal: 7 } })],
  ["schedule", (input: SetupInput) => ({ ...input, descriptor: { ...input.descriptor, schedule: { kind: "live" as const, liveOrdinal: 0, candidateSide: "w" as const } } })],
  ["attempt ID", (input: SetupInput) => ({ ...input, descriptor: { ...input.descriptor, attemptId: "not-r4" } })],
  ["master", (input: SetupInput) => ({ ...input, descriptor: { ...input.descriptor, master: 102 as const } })],
  ["descriptor model", (input: SetupInput) => ({ ...input, descriptor: { ...input.descriptor, modelId: "f".repeat(64) } })],
  ["baseline", (input: SetupInput) => ({ ...input, descriptor: { ...input.descriptor, frozenBaseline: 1 } })],
  ["extra descriptor", (input: SetupInput) => ({ ...input, descriptor: { ...input.descriptor, extra: true } })],
] as const) {
  test(`R4 checks the actual ${name} before forwarding to the supplied delegate`, async () => {
    const env = fixture({ setup: mutate });
    const result = await observeR4(env.input);
    failed(result, "DESCRIPTOR");
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]!.descriptor).not.toBeNull();
    expect(env.setupInputs).toHaveLength(0);
    expect(env.counts().closed).toBe(1);
  });
}

for (const [name, mutate, error] of [
  ["unconsumed RNG", (input: SetupInput, call: Call) => ({ ...input, rng: call.previous.rng }), "RNG_CONTEXT"],
  ["changed policy RNG", (input: SetupInput) => ({ ...input, rng: { ...input.rng, "policy-sampling": drawStream(input.rng["policy-sampling"]).after } }), "RNG_CONTEXT"],
  ["record hash", (input: SetupInput) => ({ ...input, model: { ...input.model, record: Uint8Array.of(8) } }), "MODEL_RECORD"],
  ["bound model", (input: SetupInput) => ({ ...input, model: record("other-valid-model") }), "MODEL_CONTEXT"],
  ["config shape", (input: SetupInput) => ({ ...input, model: { ...input.model, config: { ...input.model.config, hiddenUnits: 64 } } } as unknown as SetupInput), ""],
  ["renewed timing", (input: SetupInput) => ({ ...input, timing: { ...input.timing, originNs: 1n } }), "TIMING_CONTEXT"],
  ["copied timing", (input: SetupInput) => ({ ...input, timing: { ...input.timing } }), "TIMING_CONTEXT"],
] as const) {
  test(`R4 rejects ${name} before delegate ownership`, async () => {
    const env = fixture({ setup: mutate });
    failed(await observeR4(env.input), error);
    expect(env.setupInputs).toHaveLength(0);
    expect(env.calls).toHaveLength(1);
    expect(env.counts().closed).toBe(1);
  });
}

test("R4 requires the updated inference model for the second attempt", async () => {
  const env = fixture({ setup(input, call) { return call.id.endsWith("0001") ? { ...input, model: env.initialRecord } : input; } });
  const result = await observeR4(env.input);
  failed(result, "MODEL_CONTEXT");
  expect(result.attempts).toHaveLength(2);
  expect(env.setupInputs).toHaveLength(1);
  expect(result.attempts[0]!.returned!.state.modelId).toBe(env.proposals[0]!.config.recordSha256);
});

test("R4 rejects missing setup without admitting another attempt", async () => {
  const env = fixture({ run: async call => complete(call.previous, call.id, env.proposals[0]!) });
  const result = await observeR4(env.input);
  failed(result, "SETUP_COUNT");
  expect(result.attempts[0]!.setupCalls).toBe(0);
  expect(env.calls).toHaveLength(1);
  expect(env.counts().closed).toBe(1);
});

test("R4 rejects a swallowed delegate rejection without starting a second attempt", async () => {
  const primary = new Error("injected swallowed delegate failure");
  const env = fixture({ delegate: async () => { throw primary; }, run: async (call, execute) => {
    try { return await execute(); } catch { return complete(call.previous, call.id, env.proposals[0]!); }
  } });
  const result = await observeR4(env.input);
  failed(result);
  expect(result.failures[0]!.error).toBe(primary);
  expect(env.calls).toHaveLength(1);
  expect(env.setupInputs).toHaveLength(1);
  expect(env.counts().closed).toBe(1);
});

for (const boundary of ["work", "cleanup"] as const) {
  test(`R4 preserves a swallowed setup failure ahead of the later ${boundary} deadline`, async () => {
    const primary = new Error("injected primary setup failure before expiry");
    const env = fixture({ delegate: async () => { throw primary; }, run: async (call, execute) => {
      try { return await execute(); } catch {
        env.setTime(boundary === "work" ? call.timing.workDeadlineNs : call.timing.cleanupDeadlineNs);
        return complete(call.previous, call.id, env.proposals[0]!);
      }
    } });
    const result = await observeR4(env.input);
    failed(result);
    expect(result.failures[0]!.error).toBe(primary);
    expect(result.failures[0]!.phase).toBe("r4-m101-a0000");
    expect(result.failures.map(failure => failure.phase)).toEqual(boundary === "work"
      ? ["r4-m101-a0000"] : ["r4-m101-a0000", "close-deadline"]);
    expect(env.calls).toHaveLength(1);
    expect(env.counts().closed).toBe(1);
    expect(result.close.cleanupDeadlineNs).toBe(String(env.calls[0]!.timing.cleanupDeadlineNs));
  });
}

for (const swallowed of [false, true]) {
  test(`R4 rejects duplicate setup even when its error is ${swallowed ? "swallowed" : "propagated"}`, async () => {
    const env = fixture({ run: async (call, execute) => {
      const state = await execute();
      try { await call.createOwned(env.setupInputs[0]!); } catch (error) { if (!swallowed) throw error; }
      return state;
    } });
    const result = await observeR4(env.input);
    failed(result, "SETUP_COUNT");
    expect(result.attempts[0]!.setupCalls).toBe(2);
    expect(env.setupInputs).toHaveLength(1);
    expect(env.calls).toHaveLength(1);
    expect(env.counts().closed).toBe(1);
  });
}

test("R4 closes the setup wrapper after coordinator settlement", async () => {
  const env = fixture();
  expect((await observeR4(env.input)).status).toBe("PASS");
  expect(() => env.calls[0]!.createOwned(env.setupInputs[0]!)).toThrow("SETUP_OUTSIDE_ATTEMPT");
  expect(env.setupInputs).toHaveLength(2);
  expect(env.counts().closed).toBe(1);
});

for (const [name, mutate] of [
  ["changed bindings", (state: TrainingState) => ({ ...state, bindings: { ...state.bindings, source: byteRef("changed") } })],
  ["wrong master", (state: TrainingState) => ({ ...state, master: 102 as const, initializationSeed: 102 as const })],
  ["wrong curriculum", (state: TrainingState) => ({ ...state, control: { ...state.control, corpusCursor: 0 } })],
  ["zero journal bytes", (state: TrainingState) => ({ ...state, journalRef: { ...state.journalRef!, byteLength: 0 } })],
  ["zero journal ordinal", (state: TrainingState) => ({ ...state, journalRef: { ...state.journalRef!, lastRecordOrdinal: 0 } })],
  ["missing journal", (state: TrainingState) => ({ ...state, journalRef: null })],
  ["unbound RNG state", (state: TrainingState) => ({ ...state, rng: { ...state.rng, opponent: { ...state.rng.opponent, state: (state.rng.opponent.state ^ 1) >>> 0 } } })],
  ["excess policy draws", (state: TrainingState) => ({ ...state, rng: { ...state.rng, "policy-sampling": { ...state.rng["policy-sampling"], drawCount: 65 } } })],
  ["nonzero PG at unchanged baseline", (state: TrainingState) => ({ ...state, counters: { ...state.counters, baselineSum: 0 } })],
] as const) {
  test(`R4 rejects returned ${name} before a second attempt`, async () => {
    const env = fixture({ returned: mutate });
    failed(await observeR4(env.input));
    expect(env.calls).toHaveLength(1);
    expect(env.counts().closed).toBe(1);
  });
}

for (const [name, mutate] of [
  ["counter regression", (state: TrainingState) => ({ ...state, counters: { ...state.counters, eligibleCompleted: 0, updates: 0, baselineCount: 0, baselineSum: 0, nonzeroPGUpdates: 0 } })],
  ["PG counter regression", (state: TrainingState) => ({ ...state, counters: { ...state.counters, nonzeroPGUpdates: 0 } })],
  ["history rewrite", (state: TrainingState) => ({ ...state, historyRefs: [byteRef("rewritten"), state.historyRefs[1]!] })],
  ["journal byte regression", (state: TrainingState) => ({ ...state, journalRef: { ...state.journalRef!, byteLength: 20 } })],
  ["journal ordinal regression", (state: TrainingState) => ({ ...state, journalRef: { ...state.journalRef!, lastRecordOrdinal: 1 } })],
  ["model change without update", (state: TrainingState) => ({ ...state, modelId: "f".repeat(64) })],
  ["baseline drift without update", (state: TrainingState) => ({ ...state, counters: { ...state.counters, baselineSum: 0 } })],
  ["policy RNG regression", (state: TrainingState) => ({ ...state, rng: { ...state.rng, "policy-sampling": initialTrainingState(101, state.modelId, state.bindings).rng["policy-sampling"] } })],
] as const) {
  test(`R4 rejects second-state ${name} while retaining both observations`, async () => {
    const env = fixture({ returned: (state, call) => call.id.endsWith("0001") ? mutate(state) : state });
    const result = await observeR4(env.input);
    failed(result);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]!.returned).not.toBeNull();
    expect(result.attempts[1]!.returned).not.toBeNull();
    expect(env.counts().closed).toBe(1);
  });
}

for (const [name, mutate] of [
  ["duplicate counts", (_state: TrainingState, call: Call) => call.previous],
  ["skipped counts", (state: TrainingState) => complete(state, "skipped", null)],
  ["PG increment without update", (state: TrainingState) => ({ ...state, counters: { ...state.counters, nonzeroPGUpdates: 2 } })],
  ["update without policy draw", (state: TrainingState, call: Call) => ({ ...state, rng: { ...state.rng, "policy-sampling": call.previous.rng["policy-sampling"] } })],
] as const) {
  test(`R4 rejects ${name}`, async () => {
    const env = fixture({ returned: mutate });
    failed(await observeR4(env.input));
    expect(env.calls).toHaveLength(1);
    expect(env.counts().closed).toBe(1);
  });
}

for (const read of [1, 2, 3]) {
  test(`R4 compares returned state against readback snapshot ${read}`, async () => {
    const env = fixture({ snapshot: (state, reads) => reads === read ? { ...state, bindings: { ...state.bindings, tests: byteRef("disagreement") } } : state });
    const result = await observeR4(env.input);
    failed(result, "SNAPSHOT");
    expect(env.calls).toHaveLength(read - 1);
    expect(env.counts().closed).toBe(1);
  });
}

for (const kind of ["no eligible", "zero PG"] as const) {
  test(`R4 reports insufficient exercise (${kind}) after exactly two attempts without starvation retries`, async () => {
    const env = fixture({ updates: kind === "no eligible" ? [false, false] : [true, false],
      returned: state => kind === "zero PG" ? { ...state, counters: { ...state.counters, nonzeroPGUpdates: 0 } } : state });
    const result = await observeR4(env.input);
    failed(result, "INSUFFICIENT_EXERCISE");
    expect(result.failures[0]!.phase).toBe("exercise");
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts.every(attempt => attempt.returned !== null)).toBe(true);
    expect(env.counts()).toMatchObject({ closed: 1, finalized: 0 });
  });
}

test("R4 accepts update composition occurring only in the live attempt", async () => {
  const env = fixture({ updates: [false, true] });
  const result = await observeR4(env.input);
  expect(result.status).toBe("PASS");
  expect(result.attempts[0]!.returned!.state.counters.nonzeroPGUpdates).toBe(0);
  expect(result.attempts[1]!.returned!.state.counters.nonzeroPGUpdates).toBe(1);
});

for (const phase of ["initialize", "attempt", "delegate", "snapshot"] as const) {
  test(`R4 retains the primary ${phase} failure before close failure`, async () => {
    const primary = new Error(`injected ${phase} failure`), cleanup = new Error("injected close failure");
    const hooks: Hooks = { close: () => { throw cleanup; } };
    if (phase === "initialize") hooks.initialize = () => { throw primary; };
    if (phase === "attempt") hooks.run = async () => { throw primary; };
    if (phase === "delegate") hooks.delegate = async () => { throw primary; };
    if (phase === "snapshot") hooks.snapshot = () => { throw primary; };
    const env = fixture(hooks), result = await observeR4(env.input);
    failed(result);
    expect(result.failures.map(failure => failure.error)).toEqual([primary, cleanup]);
    expect(result.failures[1]!.phase).toBe("close");
    expect(result.close.status).toBe("FAIL");
    expect(env.counts().closed).toBe(1);
  });
}

test("R4 returns FAIL instead of a completed receipt when close fails after both attempts", async () => {
  const cleanup = new Error("injected close failure"), env = fixture({ close: async () => { throw cleanup; } });
  const result = await observeR4(env.input);
  failed(result);
  expect(result.failures).toEqual([{ phase: "close", error: cleanup }]);
  expect(result.attempts).toHaveLength(2);
  expect(result.close.status).toBe("FAIL");
});

for (const bad of [-1n, 1 as unknown as bigint]) {
  test(`R4 rejects invalid clock output ${String(bad)} and still closes once`, async () => {
    const env = fixture({ clock: () => bad }), result = await observeR4(env.input);
    failed(result, "CLOCK");
    expect(result.failures).toHaveLength(1);
    expect(result.close.cleanupDeadlineNs).toBeNull();
    expect(env.counts()).toMatchObject({ closed: 1, clockCalls: 1 });
  });
}

test("R4 preserves a thrown clock fault and closes without resetting the clock", async () => {
  const primary = new Error("injected initial clock failure"), cleanup = new Error("injected close failure");
  const env = fixture({ clock: () => { throw primary; }, close: () => { throw cleanup; } });
  const result = await observeR4(env.input);
  failed(result);
  expect(result.failures.map(failure => failure.error)).toEqual([primary, cleanup]);
  expect(result.close.cleanupDeadlineNs).toBeNull();
  expect(env.counts()).toMatchObject({ closed: 1, clockCalls: 1 });
  expect(env.initialized).toEqual([]);
});

test("R4 shares one monotonic guard across initialization, delegate, attempts, and close", async () => {
  const env = fixture({ initialize(state) { env.setTime(5n); return state; }, delegate(input) {
    expect(input.timing.clockNs()).toBe(5n); env.setTime(4n); return env.dependencies;
  } });
  const result = await observeR4(env.input);
  failed(result, "CLOCK");
  expect(result.failures).toHaveLength(1);
  expect(env.calls).toHaveLength(1);
  expect(env.counts().closed).toBe(1);
});

test("R4 starts the initialization budget before prepared-record validation", async () => {
  const env = fixture();
  const selected = { get record() { env.setTime(10_000_000_000n); return env.initialRecord.record; }, config: env.initialRecord.config };
  const result = await observeR4({ ...env.input, initialRecord: selected });
  failed(result, "DEADLINE");
  expect(env.initialized).toEqual([]);
  expect(result.close.cleanupDeadlineNs).toBe("300000000000");
});

test("R4 closes with a failed receipt if reading the prepared input throws", async () => {
  const primary = new Error("injected prepared-record access failure"), env = fixture();
  Object.defineProperty(env.input, "initialRecord", { get() { throw primary; } });
  const result = await observeR4(env.input);
  failed(result);
  expect(result.failures).toEqual([{ phase: "initialize", error: primary }]);
  expect(result.close.cleanupDeadlineNs).toBe("300000000000");
  expect(env.initialized).toEqual([]);
  expect(env.counts().closed).toBe(1);
});

test("R4 rejects the exact 10-second initialization deadline without renewing it", async () => {
  const env = fixture({ initialize(state) { env.setTime(10_000_000_000n); return state; } });
  const result = await observeR4(env.input);
  failed(result, "DEADLINE");
  expect(env.calls).toHaveLength(0);
  expect(result.close.cleanupDeadlineNs).toBe("300000000000");
});

test("R4 rejects setup admission at its exact original startup deadline before delegation", async () => {
  const env = fixture({ setup(input) { env.setTime(input.timing.startupDeadlineNs); return input; } });
  failed(await observeR4(env.input), "DEADLINE");
  expect(env.setupInputs).toHaveLength(0);
  expect(env.calls).toHaveLength(1);
  expect(env.counts().closed).toBe(1);
});

for (const at of ["return", "snapshot"] as const) {
  test(`R4 rejects its exact original 297-second work deadline after ${at}`, async () => {
    const env = fixture({ returned(state, call) { if (at === "return") env.setTime(call.timing.workDeadlineNs); return state; },
      snapshot(state, reads) { if (at === "snapshot" && reads === 2) env.setTime(env.calls[0]!.timing.workDeadlineNs); return state; } });
    failed(await observeR4(env.input), "DEADLINE");
    expect(env.calls).toHaveLength(1);
    expect(env.counts().closed).toBe(1);
  });
}

test("R4 captures a fresh origin per phase while preserving each 10/297/300 budget", async () => {
  const env = fixture({ initialize(state) { env.setTime(9_999_999_999n); return state; },
    returned(state, call) { env.setTime(call.timing.originNs + 100n); return state; } });
  const result = await observeR4(env.input);
  expect(result.status).toBe("PASS");
  expect(env.calls.map(call => call.timing.originNs)).toEqual([9_999_999_999n, 10_000_000_099n]);
  for (const { timing } of env.calls) {
    expect(timing.startupDeadlineNs).toBe(timing.originNs + 10_000_000_000n);
    expect(timing.workDeadlineNs).toBe(timing.originNs + 297_000_000_000n);
    expect(timing.cleanupDeadlineNs).toBe(timing.originNs + 300_000_000_000n);
  }
  expect(result.close.cleanupDeadlineNs).toBe(String(env.calls[1]!.timing.cleanupDeadlineNs));
});

test("R4 waits for late owned-attempt cleanup before its only close and never starts a second attempt", async () => {
  const entered = deferred<void>(), cleanup = deferred<void>();
  const primary = new Error("injected attempt failure after owned cleanup");
  const env = fixture({ run: async (call, execute) => {
    await execute(); env.setTime(call.timing.workDeadlineNs); entered.resolve();
    await cleanup.promise; env.events.push("owned-cleanup-settled"); throw primary;
  } });
  const pending = observeR4(env.input);
  await entered.promise;
  expect(env.counts()).toMatchObject({ closed: 0, active: 1 });
  expect(env.calls).toHaveLength(1);
  env.setTime(299_999_999_999n);
  await Promise.resolve();
  expect(env.counts().closed).toBe(0);
  cleanup.resolve();
  const result = await pending;
  failed(result);
  expect(result.failures[0]!.error).toBe(primary);
  expect(env.events.indexOf("close")).toBeGreaterThan(env.events.indexOf("owned-cleanup-settled"));
  expect(env.counts()).toMatchObject({ closed: 1, active: 0 });
});

test("R4 checks a late returned attempt only after its owned promise settles", async () => {
  const entered = deferred<void>(), settled = deferred<void>();
  const env = fixture({ run: async (call, execute) => {
    const state = await execute(); env.setTime(call.timing.workDeadlineNs); entered.resolve();
    await settled.promise; return state;
  } });
  const pending = observeR4(env.input);
  await entered.promise;
  expect(env.counts().closed).toBe(0);
  settled.resolve();
  failed(await pending, "DEADLINE");
  expect(env.calls).toHaveLength(1);
  expect(env.counts().closed).toBe(1);
});

for (const stop of ["initial", "first", "second"] as const) {
  test(`R4 uses the last captured ${stop} cleanup deadline instead of now plus 300 seconds`, async () => {
    const primary = new Error(`injected ${stop} failure`);
    const env = fixture({ initialize(state) { if (stop === "initial") throw primary; env.setTime(5n); return state; },
      run: async (call, execute) => {
        if (stop === "first" || call.id.endsWith("0001")) { env.setTime(call.timing.workDeadlineNs); throw primary; }
        const state = await execute(); env.setTime(call.timing.originNs + 10n); return state;
      }, close() {
        const deadline = env.calls.at(-1)?.timing.cleanupDeadlineNs ?? 300_000_000_000n;
        env.setTime(deadline);
      } });
    const result = await observeR4(env.input);
    failed(result);
    expect(result.failures[0]!.error).toBe(primary);
    expect(result.failures.map(failure => failure.phase)).toEqual([stop === "initial" ? "initialize" : stop === "first" ? "r4-m101-a0000" : "r4-m101-a0001", "close-deadline"]);
    expect(String(result.failures[1]!.error)).toContain("DEADLINE");
    expect(result.close.status).toBe("FAIL");
    expect(result.close.cleanupDeadlineNs).toBe(String(env.calls.at(-1)?.timing.cleanupDeadlineNs ?? 300_000_000_000n));
    expect(env.counts().closed).toBe(1);
  });
}

test("R4 preserves primary, close, and close-deadline failures in order", async () => {
  const primary = new Error("injected primary"), cleanup = new Error("injected close failure");
  const env = fixture({ run: async () => { throw primary; }, close: () => { env.setTime(300_000_000_000n); throw cleanup; } });
  const result = await observeR4(env.input);
  failed(result);
  expect(result.failures.slice(0, 2).map(failure => failure.error)).toEqual([primary, cleanup]);
  expect(result.failures.map(failure => failure.phase)).toEqual(["r4-m101-a0000", "close", "close-deadline"]);
  expect(String(result.failures[2]!.error)).toContain("DEADLINE");
  expect(env.counts().closed).toBe(1);
});

test("R4 retains the previous phase cleanup deadline if the next phase clock fails", async () => {
  const primary = new Error("injected next phase clock failure");
  let checksLeft: number | null = null;
  const env = fixture({ clock: () => { if (checksLeft !== null && checksLeft-- === 0) throw primary; return 7n; },
    snapshot(state, reads) { if (reads === 2) checksLeft = 1; return state; } });
  const result = await observeR4(env.input);
  failed(result);
  expect(result.failures[0]!.error).toBe(primary);
  expect(result.close.cleanupDeadlineNs).toBe("300000000007");
  expect(result.failures).toHaveLength(1);
  expect(env.calls).toHaveLength(1);
  expect(env.counts().closed).toBe(1);
});

test("R4 records close failure even when it rethrows the primary error object", async () => {
  const shared = new Error("injected shared primary and close failure");
  const env = fixture({ initialize: () => { throw shared; }, close: () => { throw shared; } });
  const result = await observeR4(env.input);
  failed(result);
  expect(result.failures).toEqual([{ phase: "initialize", error: shared }, { phase: "close", error: shared }]);
  expect(result.close.status).toBe("FAIL");
});

test("R4 keeps the actual second descriptor bound to ordinal one and the live schedule", async () => {
  const env = fixture({ setup(input, call) { return call.id.endsWith("0001") ? { ...input, descriptor: { ...input.descriptor, startedOrdinal: 0,
    schedule: { kind: "corpus", corpusIndex: 0, candidateSide: "b" } } } : input; } });
  const result = await observeR4(env.input);
  failed(result, "DESCRIPTOR");
  expect(env.setupInputs).toHaveLength(1);
  expect(env.calls).toHaveLength(2);
  expect(result.attempts[0]!.returned).not.toBeNull();
  expect(result.attempts[1]!.setupCalls).toBe(1);
});
