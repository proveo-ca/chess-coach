// SPEC: _spec/checkpoint-runtime.puml
import { z } from "zod";
import { streamStateShape } from "./episode";

const count = z.int().min(0).max(1000), digest = z.string().regex(/^[a-f0-9]{64}$/);
export const masterShape = z.union([z.literal(101), z.literal(102), z.literal(103), z.literal(104), z.literal(105)]);
export const byteRefShape = z.strictObject({ byteLength: z.int().min(0).max(Number.MAX_SAFE_INTEGER), sha256: digest });
export const journalRefShape = byteRefShape.extend({ lastRecordOrdinal: z.int().min(0).max(Number.MAX_SAFE_INTEGER) });
export const bindingsShape = z.strictObject({ source: byteRefShape, tests: byteRefShape, closure: byteRefShape, dependencyLock: byteRefShape,
  image: byteRefShape, runtimeConfiguration: byteRefShape, coreRules: byteRefShape, strategicSource: byteRefShape, corpusManifest: byteRefShape,
  corpusSource: byteRefShape, recipe: byteRefShape, featureLayout: byteRefShape, fixtureManifest: byteRefShape, hostConfiguration: byteRefShape });
export const countersShape = z.strictObject({ started: count, verifiedCompleted: count, eligibleCompleted: count, updates: count,
  nonzeroPGUpdates: count, baselineCount: count, baselineSum: z.int().min(-1000).max(1000) }).refine(value => value.nonzeroPGUpdates <= value.updates &&
    value.updates === value.eligibleCompleted && value.updates === value.baselineCount && value.updates <= value.verifiedCompleted &&
    value.verifiedCompleted <= value.started && Math.abs(value.baselineSum) <= value.baselineCount, { message: "Counter invariant" });
const active = streamStateShape.refine(value => value.status === "active");
const unused = streamStateShape.refine(value => value.status === "unused" && value.state === value.root && value.drawCount === 0);
export const rngStateShape = z.strictObject({ selection: active, "environment-settlement": unused, "policy-sampling": active, opponent: active,
  generator: z.strictObject({ status: z.literal("unused"), root: z.null(), state: z.null(), drawCount: z.literal(0) }) });
export const controlShape = z.strictObject({ corpusPermutation: z.array(z.int().min(0).max(17)).length(18), corpusCursor: z.int().min(0).max(18),
  corpusEpoch: z.int().min(0).max(999), scheduleCursor: count, liveOrdinal: count, dueBucket: z.int().min(0).max(10), fulfilledBucket: z.int().min(0).max(10) })
  .refine(value => new Set(value.corpusPermutation).size === 18 && value.fulfilledBucket <= value.dueBucket && value.dueBucket === Math.floor(value.scheduleCursor / 100), { message: "Control invariant" });
export const trainingStateShape = z.strictObject({ version: z.literal("chess-coach.training-state.v1"), master: masterShape, initializationSeed: masterShape,
  modelId: digest, counters: countersShape, rng: rngStateShape, control: controlShape, journalRef: journalRefShape.nullable(),
  historyRefs: z.array(byteRefShape).max(1000), bindings: bindingsShape }).refine(value => value.initializationSeed === value.master &&
    value.counters.started === value.control.scheduleCursor && value.control.liveOrdinal === Math.floor(value.counters.started / 2) &&
    value.historyRefs.length === value.counters.verifiedCompleted, { message: "Training state binding" });
export const attemptDescriptorShape = z.strictObject({ version: z.literal("chess-coach.attempt.v1"), attemptId: z.string().regex(/^[A-Za-z0-9._:-]{1,64}$/),
  master: masterShape, startedOrdinal: z.int().min(0).max(999), modelId: digest, frozenBaseline: z.number().min(-1).max(1),
  schedule: z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("corpus"), corpusIndex: z.int().min(0).max(17), candidateSide: z.literal("b") }),
    z.strictObject({ kind: z.literal("live"), liveOrdinal: z.int().min(0).max(499), candidateSide: z.enum(["w", "b"]) })]) });
export type TrainingState = z.infer<typeof trainingStateShape>;
export type AttemptDescriptor = z.infer<typeof attemptDescriptorShape>;
export type TrainingBindings = z.infer<typeof bindingsShape>;
export type RngState = z.infer<typeof rngStateShape>;
export type ByteRef = z.infer<typeof byteRefShape>;
export type JournalRef = z.infer<typeof journalRefShape>;
