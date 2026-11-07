// SPEC: _spec/checkpoint-runtime.puml
import { attemptDescriptorShape, trainingStateShape } from "../../contracts/src/training-state";
import type { AttemptDescriptor, RngState, TrainingBindings, TrainingState } from "../../contracts/src/training-state";
import { deriveStream, drawStream, MASTERS } from "./rng";

export function initialTrainingState(master: number, modelId: string, bindings: TrainingBindings): TrainingState {
  const rng: RngState = { selection: deriveStream(master, "selection"), "environment-settlement": deriveStream(master, "environment-settlement"),
    "policy-sampling": deriveStream(master, "policy-sampling"), opponent: deriveStream(master, "opponent"),
    generator: { status: "unused", root: null, state: null, drawCount: 0 } };
  return trainingStateShape.parse({ version: "chess-coach.training-state.v1", master, initializationSeed: master, modelId, bindings, rng,
    counters: { started: 0, verifiedCompleted: 0, eligibleCompleted: 0, updates: 0, nonzeroPGUpdates: 0, baselineCount: 0, baselineSum: 0 },
    control: { corpusPermutation: Array.from({ length: 18 }, (_, i) => i), corpusCursor: 0, corpusEpoch: 0, scheduleCursor: 0, liveOrdinal: 0, dueBucket: 0, fulfilledBucket: 0 },
    journalRef: null, historyRefs: [] });
}

export function checkTrainingState(input: TrainingState): TrainingState {
  const state = trainingStateShape.parse(input);
  if (!(MASTERS as readonly number[]).includes(state.master)) throw new Error("Curriculum: MASTER");
  for (const label of ["selection", "environment-settlement", "policy-sampling", "opponent"] as const) {
    if (state.rng[label].root !== deriveStream(state.master, label).root) throw new Error("Curriculum: ROOT");
  }
  const corpusStarted = Math.ceil(state.counters.started / 2), expectedEpoch = corpusStarted ? Math.floor((corpusStarted - 1) / 18) : 0;
  const expectedCursor = corpusStarted ? (corpusStarted - 1) % 18 + 1 : 0;
  if (state.control.corpusEpoch !== expectedEpoch || state.control.corpusCursor !== expectedCursor || state.rng.selection.drawCount !== (corpusStarted ? 17 * (expectedEpoch + 1) : 0)) throw new Error("Curriculum: CURSOR");
  let stream = deriveStream(state.master, "selection"), permutation = Array.from({ length: 18 }, (_, i) => i);
  for (let epoch = 0; corpusStarted && epoch <= expectedEpoch; epoch++) {
    permutation = Array.from({ length: 18 }, (_, i) => i);
    for (let i = 17; i > 0; i--) {
      const draw = drawStream(stream), j = Math.floor(draw.uniform * (i + 1));
      stream = draw.after;
      [permutation[i], permutation[j]] = [permutation[j]!, permutation[i]!];
    }
  }
  if (JSON.stringify(state.control.corpusPermutation) !== JSON.stringify(permutation) || state.rng.selection.state !== stream.state) throw new Error("Curriculum: PERMUTATION");
  return state;
}

export function nextAttempt(input: TrainingState, attemptId: string): { descriptor: AttemptDescriptor; consumed: TrainingState } {
  const state = checkTrainingState(input), consumed = structuredClone(state), ordinal = state.counters.started;
  if (ordinal >= 1000 || state.counters.verifiedCompleted !== ordinal) throw new Error("Curriculum: PENDING_OR_CAP");
  let schedule: AttemptDescriptor["schedule"];
  if (ordinal % 2 === 0) {
    const control = consumed.control;
    if (control.corpusCursor === 0 || control.corpusCursor === 18) {
      if (control.corpusCursor === 18) control.corpusEpoch++;
      control.corpusPermutation = Array.from({ length: 18 }, (_, i) => i);
      for (let i = 17; i > 0; i--) {
        const draw = drawStream(consumed.rng.selection), j = Math.floor(draw.uniform * (i + 1));
        consumed.rng.selection = draw.after;
        [control.corpusPermutation[i], control.corpusPermutation[j]] = [control.corpusPermutation[j]!, control.corpusPermutation[i]!];
      }
      control.corpusCursor = 0;
    }
    schedule = { kind: "corpus", corpusIndex: control.corpusPermutation[control.corpusCursor++]!, candidateSide: "b" };
  } else {
    const liveOrdinal = consumed.control.liveOrdinal++;
    schedule = { kind: "live", liveOrdinal, candidateSide: liveOrdinal % 2 === 0 ? "w" : "b" };
  }
  consumed.counters.started++;
  consumed.control.scheduleCursor++;
  consumed.control.dueBucket = Math.floor(consumed.counters.started / 100);
  const descriptor = attemptDescriptorShape.parse({ version: "chess-coach.attempt.v1", attemptId, master: state.master, startedOrdinal: ordinal, modelId: state.modelId,
    frozenBaseline: state.counters.baselineCount ? state.counters.baselineSum / state.counters.baselineCount : 0, schedule });
  return { descriptor, consumed: checkTrainingState(consumed) };
}
