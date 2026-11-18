// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { modelConfigShape } from "../../packages/contracts/src/learning-channel";
import type { AttemptDescriptor, ByteRef, RngState, TrainingState } from "../../packages/contracts/src/training-state";
import { checkTrainingState, initialTrainingState, nextAttempt } from "../../packages/runtime/src/curriculum";
import type { MatchClock } from "../../packages/runtime/src/match-session";
import { STORAGE_BOUNDS } from "../../packages/runtime/src/storage-bounds";
import type { AttemptSetup, TrainingCoordinator } from "../../packages/runtime/src/training-coordinator";
import type { NativeRecord } from "../../packages/runtime/src/training-store";

export type R4Coordinator = Pick<TrainingCoordinator, "initializeMaster" | "runAttempt" | "snapshot" | "close">;
export type R4Input = Readonly<{
  coordinator: R4Coordinator;
  initialRecord: NativeRecord;
  createOwned: AttemptSetup;
  clockNs: () => bigint;
}>;
export type R4StateObservation = { state: TrainingState; serializedStateRef: ByteRef };
export type R4ModelObservation = { config: NativeRecord["config"]; recordRef: ByteRef; configRef: ByteRef };
export type R4AttemptObservation = {
  attemptId: string;
  originNs: string;
  startupDeadlineNs: string;
  workDeadlineNs: string;
  cleanupDeadlineNs: string;
  setupCalls: number;
  descriptor: AttemptDescriptor | null;
  rng: RngState | null;
  model: R4ModelObservation | null;
  returned: R4StateObservation | null;
  snapshot: R4StateObservation | null;
};
export type R4Observation = {
  scope: "COMPOSITION_ONLY_INPUTS_UNQUALIFIED";
  qualified: false;
  status: "PASS" | "FAIL";
  initialRecord: R4ModelObservation | null;
  initialState: R4StateObservation | null;
  initialSnapshot: R4StateObservation | null;
  attempts: R4AttemptObservation[];
  close: { calls: 1; status: "PASS" | "FAIL"; cleanupDeadlineNs: string | null };
  failures: { phase: string; error: unknown }[];
};

function fail(code: string): never { throw new Error(`R4 observation: ${code}`); }
const ref = (bytes: Uint8Array): ByteRef => ({ byteLength: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });

function copyRecord(input: NativeRecord): NativeRecord {
  const bytes = input?.record;
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > STORAGE_BOUNDS.nativeRecordBytes) fail("MODEL_RECORD");
  const config = modelConfigShape.parse(input.config), record = Uint8Array.from(bytes);
  if (Buffer.byteLength(JSON.stringify(config)) > STORAGE_BOUNDS.configBytes || ref(record).sha256 !== config.recordSha256) fail("MODEL_RECORD");
  return { config, record };
}

function modelObservation(model: NativeRecord): R4ModelObservation {
  return { config: structuredClone(model.config), recordRef: ref(model.record), configRef: ref(Buffer.from(JSON.stringify(model.config))) };
}

function stateObservation(input: TrainingState): R4StateObservation {
  const state = checkTrainingState(input), bytes = Buffer.from(JSON.stringify(state));
  if (bytes.byteLength > STORAGE_BOUNDS.historyBytes) fail("STATE_BOUND");
  return { state, serializedStateRef: ref(bytes) };
}

function progress(state: TrainingState, previous: TrainingState, consumed: TrainingState, count: number): void {
  const delta = state.counters.updates - previous.counters.updates;
  const nonzeroDelta = state.counters.nonzeroPGUpdates - previous.counters.nonzeroPGUpdates;
  const reward = state.counters.baselineSum - previous.counters.baselineSum;
  const baseline = previous.counters.baselineCount ? previous.counters.baselineSum / previous.counters.baselineCount : 0;
  if (state.master !== 101 || state.counters.started !== count || state.counters.verifiedCompleted !== count ||
    !isDeepStrictEqual(state.bindings, previous.bindings) || delta !== 0 && delta !== 1 ||
    state.counters.nonzeroPGUpdates < previous.counters.nonzeroPGUpdates || state.counters.nonzeroPGUpdates > previous.counters.nonzeroPGUpdates + delta ||
    Math.abs(reward) > delta || nonzeroDelta > 0 && reward === baseline || delta === 0 && state.modelId !== previous.modelId ||
    state.journalRef === null || state.journalRef.byteLength === 0 || state.journalRef.lastRecordOrdinal === 0 ||
    previous.journalRef !== null && (state.journalRef.byteLength <= previous.journalRef.byteLength || state.journalRef.lastRecordOrdinal <= previous.journalRef.lastRecordOrdinal) ||
    !previous.historyRefs.every((history, index) => isDeepStrictEqual(history, state.historyRefs[index])) ||
    !isDeepStrictEqual(state.control, consumed.control)) fail("PROGRESS");
  for (const label of ["selection", "environment-settlement", "generator"] as const) {
    if (!isDeepStrictEqual(state.rng[label], consumed.rng[label])) fail("RNG_PROGRESS");
  }
  for (const label of ["policy-sampling", "opponent"] as const) {
    const before = consumed.rng[label], after = state.rng[label], draws = after.drawCount - before.drawCount;
    if (after.root !== before.root || draws < 0 || draws === 0 && !isDeepStrictEqual(after, before) ||
      label === "policy-sampling" && (delta === 0 ? draws !== 0 : draws < 1 || draws > 64)) fail("RNG_PROGRESS");
  }
}

export async function observeR4(input: R4Input): Promise<R4Observation> {
  const { coordinator, createOwned, clockNs: rawClock } = input ?? {} as R4Input;
  if (!coordinator) throw new TypeError("R4 observation: INPUT");
  const { initializeMaster, runAttempt, snapshot, close } = coordinator;
  if ([initializeMaster, runAttempt, snapshot, close, createOwned, rawClock].some(value => typeof value !== "function")) throw new TypeError("R4 observation: INPUT");
  const initialize = initializeMaster.bind(coordinator), attempt = runAttempt.bind(coordinator);
  const read = snapshot.bind(coordinator), finish = close.bind(coordinator);
  const observation: R4Observation = { scope: "COMPOSITION_ONLY_INPUTS_UNQUALIFIED", qualified: false, status: "FAIL",
    initialRecord: null, initialState: null, initialSnapshot: null, attempts: [],
    close: { calls: 1, status: "FAIL", cleanupDeadlineNs: null }, failures: [] };
  let lastNow: bigint | null = null, clockFailed = false, clockFault: unknown;
  const clockNs = (): bigint => {
    if (clockFailed) throw clockFault;
    try {
      const now = rawClock();
      if (typeof now !== "bigint" || now < 0n || lastNow !== null && now < lastNow) fail("CLOCK");
      lastNow = now;
      return now;
    } catch (error) { clockFailed = true; clockFault = error; throw error; }
  };
  const retain = (phase: string, error: unknown): void => {
    observation.failures.push({ phase, error });
  };
  const lastTiming: { value: MatchClock | null } = { value: null };
  let phase = "initialize";
  const timing = (): MatchClock => {
    const originNs = clockNs();
    lastTiming.value = Object.freeze({ clockNs, originNs, startupDeadlineNs: originNs + 10_000_000_000n,
      workDeadlineNs: originNs + 297_000_000_000n, cleanupDeadlineNs: originNs + 300_000_000_000n });
    return lastTiming.value;
  };
  const check = (deadlineNs: bigint): void => { if (clockNs() >= deadlineNs) fail("DEADLINE"); };
  type Active = { observation: R4AttemptObservation; expected: ReturnType<typeof nextAttempt>; timing: MatchClock; fault: { error: unknown } | null };
  let active: Active | null = null;
  const wrapped: AttemptSetup = setup => {
    const current = active;
    if (current === null) fail("SETUP_OUTSIDE_ATTEMPT");
    current.observation.setupCalls++;
    try {
      if (current.fault !== null) throw current.fault.error;
      if (current.observation.setupCalls !== 1) fail("SETUP_COUNT");
      current.observation.descriptor = structuredClone(setup.descriptor);
      current.observation.rng = structuredClone(setup.rng);
      if (!isDeepStrictEqual(setup.descriptor, current.expected.descriptor)) fail("DESCRIPTOR");
      if (!isDeepStrictEqual(setup.rng, current.expected.consumed.rng)) fail("RNG_CONTEXT");
      if (setup.timing !== current.timing) fail("TIMING_CONTEXT");
      check(current.timing.startupDeadlineNs);
      const selected = copyRecord(setup.model);
      current.observation.model = modelObservation(selected);
      if (selected.config.recordSha256 !== current.expected.descriptor.modelId ||
        Buffer.byteLength(JSON.stringify({ descriptor: setup.descriptor, rng: setup.rng })) > STORAGE_BOUNDS.startedBytes) fail("MODEL_CONTEXT");
      check(current.timing.startupDeadlineNs);
      return Promise.resolve(createOwned(setup)).catch(error => { current.fault ??= { error }; throw error; });
    } catch (error) { current.fault ??= { error }; throw error; }
  };
  try {
    const initialTiming = timing();
    check(initialTiming.startupDeadlineNs);
    const selected = copyRecord(input.initialRecord);
    observation.initialRecord = modelObservation(selected);
    check(initialTiming.startupDeadlineNs);
    const initialized = initialize(101, { config: structuredClone(selected.config), record: Uint8Array.from(selected.record) });
    check(initialTiming.startupDeadlineNs);
    observation.initialState = stateObservation(initialized);
    let state = observation.initialState.state;
    if (!isDeepStrictEqual(state, initialTrainingState(101, selected.config.recordSha256, state.bindings))) fail("INITIAL_STATE");
    observation.initialSnapshot = stateObservation(read(101));
    if (!isDeepStrictEqual(state, observation.initialSnapshot.state)) fail("SNAPSHOT");
    check(initialTiming.startupDeadlineNs);
    for (const attemptId of ["r4-m101-a0000", "r4-m101-a0001"]) {
      phase = attemptId;
      const attemptTiming = timing(), expected = nextAttempt(state, attemptId);
      const observed: R4AttemptObservation = { attemptId, originNs: String(attemptTiming.originNs),
        startupDeadlineNs: String(attemptTiming.startupDeadlineNs), workDeadlineNs: String(attemptTiming.workDeadlineNs), cleanupDeadlineNs: String(attemptTiming.cleanupDeadlineNs),
        setupCalls: 0, descriptor: null, rng: null, model: null, returned: null, snapshot: null };
      observation.attempts.push(observed);
      const current: Active = { observation: observed, expected, timing: attemptTiming, fault: null };
      active = current;
      let returned: TrainingState;
      try { returned = await attempt(101, attemptId, attemptTiming, wrapped); }
      finally { active = null; }
      if (current.fault !== null) throw current.fault.error;
      check(attemptTiming.workDeadlineNs);
      if (observed.setupCalls !== 1) fail("SETUP_COUNT");
      observed.returned = stateObservation(returned);
      observed.snapshot = stateObservation(read(101));
      if (!isDeepStrictEqual(observed.returned.state, observed.snapshot.state)) fail("SNAPSHOT");
      progress(observed.returned.state, state, expected.consumed, observation.attempts.length);
      state = observed.returned.state;
      check(attemptTiming.workDeadlineNs);
    }
    phase = "exercise";
    if (state.counters.eligibleCompleted < 1 || state.counters.nonzeroPGUpdates < 1) fail("INSUFFICIENT_EXERCISE");
  } catch (error) { retain(phase, error); }
  finally {
    const cleanupDeadlineNs = lastTiming.value?.cleanupDeadlineNs;
    observation.close.cleanupDeadlineNs = cleanupDeadlineNs === undefined ? null : String(cleanupDeadlineNs);
    let closed = false;
    try { await finish(); closed = true; } catch (error) { retain("close", error); }
    try {
      const now = clockNs();
      if (cleanupDeadlineNs !== undefined && now >= cleanupDeadlineNs) fail("DEADLINE");
      if (closed) observation.close.status = "PASS";
    } catch (error) {
      if (!clockFailed || error !== clockFault || !observation.failures.some(failure => failure.error === error)) retain("close-deadline", error);
    }
  }
  observation.status = observation.failures.length === 0 ? "PASS" : "FAIL";
  return observation;
}
