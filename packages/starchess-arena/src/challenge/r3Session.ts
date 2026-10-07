// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml, _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  beginScTurn, beginTurnWithProvenance, endScTurn, endTurnWithProvenance, initializeProvenance, scOutcome,
  type ActionBindings, type BeginScTurnResult, type EndScTurnResult, type EngineProvenance,
  type ProvenanceCompanion, type ScFenSnapshot,
} from "@chess-coach/starchess-core";
import { validateBoundaryBatch } from "../authorized/v2/batch";
import { inspectDto } from "../challengeContract/validation";
import { array, byteEqual, bytes, fail, freeze, integer, object } from "../authorized/v2/schema";
import { grantStoredIncome, type Bank } from "../run/bank";
import { commitPair, stageQueue, type StagedQueue } from "./admission";
import {
  copyRecipientPrivate, newRecipientPrivate, projectR3Boundary, reconcileR3NativeImage,
  type R3Recipient, type R3RecipientPrivate,
} from "./r3Projection";
import type { AuthorizedBoundaryBatch, Side } from "../authorized/v2/types";

type NativeResult = BeginScTurnResult | EndScTurnResult;
type Companion = ProvenanceCompanion<NativeResult>;
export type R3Binding = object;
export type R3Session = Readonly<{
  snapshot: ScFenSnapshot; provenance: EngineProvenance; bank: Bank; planningOrdinal: number;
  previousCompanion: Companion | null; recipients: Readonly<Record<Side, R3Recipient>>;
}>;
export type R3StagedTransition = Readonly<{
  binding: R3Binding; phase: "turn-open" | "settled"; ordinal: number;
  successfulOwnStages: Readonly<Record<Side, StagedQueue>> | null;
  companion: Companion; provenanceBytes: Uint8Array;
  digest: Readonly<{ byteLength: number; sha256: string }>;
  batches: Readonly<Record<Side, AuthorizedBoundaryBatch>>;
}>;
type PrivateState = {
  binding: R3Binding; session: R3Session; recipients: Record<Side, R3RecipientPrivate>;
  lastTransition: R3StagedTransition | null; chain: { current: R3Session };
};
const sessions = new WeakMap<R3Session, PrivateState>();
const bindings = new WeakMap<R3Binding, { opening: ScFenSnapshot; bank: Bank; started: boolean }>();
const HOST_CAP = 16_777_216;
const SIDES = ["w", "b"] as const;
const sideValue = <T>(values: Readonly<{ w: T; b: T }>, side: Side): T => side === "w" ? values.w : values.b;
const hash = (input: Uint8Array): string => createHash("sha256").update(input).digest("hex");
const authority = (binding: R3Binding, session: R3Session): PrivateState => {
  const state = sessions.get(session);
  if (!state || state.binding !== binding) return fail("$.binding", "SESSION");
  if (state.chain.current !== session) return fail("$.session", "SEQUENCE");
  return state;
};

export const encodeR3Provenance = (companion: Pick<Companion, "provenance" | "frames" | "visibilityImages" | "visibilityCheckpoints">): Uint8Array => {
  const root = object(companion, "$.private", ["provenance", "frames", "visibilityImages", "visibilityCheckpoints"]);
  const chunks: string[] = [];
  const ancestors = new Set<object>();
  let length = 0, visits = 0, totalEffects = 0;
  const append = (text: string): void => {
    length += Buffer.byteLength(text, "utf8");
    if (length > HOST_CAP) fail("$.private", "SIZE");
    chunks.push(text);
  };
  const limits = new Map<string, number>([
    ["entities", 70], ["nativeMineOrder", 6], ["resolvedActions", 8], ["queries", 4], ["consumedFacts", 2],
    ["evaluatedSteps", 6], ["mines", 6], ["frames", 1152], ["effects", 1152], ["visibilityImages", 2304], ["visibilityCheckpoints", 2304],
  ]);
  const visit = (value: unknown, path: string, key: string, depth: number): void => {
    if (++visits > 4_000_000 || depth > 16) fail(path, "SIZE");
    if (value === null || typeof value === "boolean") { append(JSON.stringify(value)); return; }
    if (typeof value === "string") {
      if (value.length > 256) fail(path, "SIZE");
      append(JSON.stringify(value)); return;
    }
    if (typeof value === "number") { integer(value, path); append(JSON.stringify(value)); return; }
    if (!value || typeof value !== "object" || ancestors.has(value)) return fail(path, "SCHEMA");
    ancestors.add(value);
    if (Array.isArray(value)) {
      const entries = array(value, path, limits.get(key) ?? 2304, value => value);
      if (key === "effects" && (totalEffects += entries.length) > 1152) fail(path, "CARDINALITY");
      append("[");
      for (const [index, entry] of entries.entries()) {
        if (index) append(",");
        visit(entry, `${path}[${index}]`, "", depth + 1);
      }
      append("]");
    } else {
      const keys = Reflect.ownKeys(value);
      if (keys.length > 32 || keys.some(key => typeof key !== "string" || key.length > 64)) fail(path, "SCHEMA");
      const record = object(value, path, keys as string[]);
      const entries = Object.entries(record).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
      append("{");
      for (const [index, [key, entry]] of entries.entries()) {
        if (index) append(",");
        append(`${JSON.stringify(key)}:`);
        visit(entry, `${path}.${key}`, key, depth + 1);
      }
      append("}");
    }
    ancestors.delete(value);
  };
  visit(root, "$.private", "", 0);
  return new Uint8Array(Buffer.from(chunks.join(""), "utf8"));
};
const privateBytes = (companion: Companion): Uint8Array => encodeR3Provenance({
  provenance: companion.provenance, frames: companion.frames,
  visibilityImages: companion.visibilityImages, visibilityCheckpoints: companion.visibilityCheckpoints,
});
const assertNativeEqual = (claimed: unknown, expected: unknown, path = "$.nativeResult", depth = 0): void => {
  if (depth > 32) fail(path, "SIZE");
  if (expected === null || typeof expected !== "object") {
    if (!Object.is(claimed, expected)) fail(path, "PROVENANCE");
    return;
  }
  if (Array.isArray(expected)) {
    const actual = array(claimed, path, expected.length, value => value, expected.length);
    for (const [index, value] of actual.entries()) assertNativeEqual(value, expected[index], `${path}[${index}]`, depth + 1);
  } else {
    const actual = object(claimed, path, Object.keys(expected));
    const reference = new Map(Object.entries(expected));
    for (const [key, value] of Object.entries(actual)) assertNativeEqual(value, reference.get(key), `${path}.${key}`, depth + 1);
  }
};
const detachCompanion = (companion: Companion): Companion => freeze(structuredClone(companion));
const sessionView = (data: R3Session): R3Session => Object.freeze({
  ...data,
  get recipients() { return freeze(structuredClone(data.recipients)); },
});
const ownStages = (state: PrivateState, value: Readonly<Record<Side, StagedQueue>>): Record<Side, StagedQueue> => {
  const pair = object(value, "$.successfulOwnStages", ["w", "b"]);
  const result = {} as Record<Side, StagedQueue>;
  for (const side of SIDES) {
    const stage = object(pair[side], `$.successfulOwnStages.${side}`, ["side", "intents", "gasAfter", "spend"]);
    if (stage.side !== side) fail("$.successfulOwnStages", "SIDE");
    array(stage.intents, "$.intents", 4, action => action);
    const intents = inspectDto(stage.intents, "$.intents") as StagedQueue["intents"];
    const checked = stageQueue(state.session.snapshot, state.session.bank, side, intents, state.session.planningOrdinal);
    if (!checked.ok) return fail("$.successfulOwnStages", "PROTOCOL");
    if (!isDeepStrictEqual(checked.staged, { ...stage, intents })) fail("$.successfulOwnStages", "CONSERVATION");
    result[side] = checked.staged;
  }
  return result;
};

export const initializeR3Session = (binding: R3Binding, openingSnapshot: ScFenSnapshot, openingBank: Bank): R3Session => {
  if (!binding || typeof binding !== "object") fail("$.binding", "SESSION");
  const registered = bindings.get(binding);
  if (registered?.started) fail("$.binding", "SESSION");
  const b = object(openingBank, "$.bank", ["w", "b"]);
  const bank = { w: integer(b.w, "$.bank.w", 0, 12), b: integer(b.b, "$.bank.b", 0, 12) };
  const provenance = initializeProvenance(openingSnapshot);
  const snapshot = structuredClone(openingSnapshot);
  if (registered && (!isDeepStrictEqual(snapshot, registered.opening) || !isDeepStrictEqual(bank, registered.bank))) fail("$.binding", "SESSION");
  reconcileR3NativeImage(snapshot, provenance);
  const recipients = { w: newRecipientPrivate(), b: newRecipientPrivate() };
  const project = (side: Side) => projectR3Boundary({ side, phase: "initial", planningOrdinal: 0, snapshot, bank, provenance, companion: null, previous: null, privateState: sideValue(recipients, side), ownStage: null, committedBank: null });
  const session = sessionView(freeze({ snapshot, provenance, bank, planningOrdinal: 0, previousCompanion: null, recipients: { w: project("w"), b: project("b") } }));
  sessions.set(session, { binding, session, recipients, lastTransition: null, chain: { current: session } });
  if (!registered) bindings.set(binding, { opening: session.snapshot, bank: session.bank, started: false });
  return session;
};

const execute = (state: PrivateState, phase: "turn-open" | "settled", pair: Readonly<Record<Side, StagedQueue>> | null): { transition: R3StagedTransition; successor: PrivateState } => {
  const prior = state.session;
  if (scOutcome(prior.snapshot) || prior.provenance.stage === "terminal" || prior.planningOrdinal >= 64) fail("$.session", "PROTOCOL");
  if (prior.previousCompanion && !isDeepStrictEqual(prior.provenance, prior.previousCompanion.provenance)) fail("$.previousCompanion", "PROVENANCE");
  let companion: Companion;
  let committedBank: Bank | null = null;
  let bank = { ...prior.bank };
  let stages: Record<Side, StagedQueue> | null = null;
  if (phase === "turn-open") {
    if (prior.provenance.stage !== "before-begin" || pair !== null) fail("$.session", "SEQUENCE");
    companion = beginTurnWithProvenance({ snapshot: prior.snapshot, provenance: prior.provenance });
    if (!isDeepStrictEqual(companion.nativeResult, beginScTurn(prior.snapshot))) fail("$.nativeResult", "PROVENANCE");
  } else {
    if (prior.provenance.stage !== "after-begin" || pair === null) return fail("$.session", "SEQUENCE");
    stages = ownStages(state, pair);
    const committed = commitPair(prior.snapshot, prior.bank, stages.w, stages.b);
    committedBank = committed.bank;
    const counts = { w: 0, b: 0 };
    const actionBindings: ActionBindings = (committed.snapshot.queue?.actions ?? []).map((action, sourceActionSeq) => {
      if (action.seq !== sourceActionSeq) return fail("$.actionBindings", "SEQUENCE");
      return { sourceActionSeq, side: action.color, actionRef: { planningOrdinal: prior.planningOrdinal, acceptedActionOrdinal: action.color === "w" ? counts.w++ : counts.b++ } };
    });
    companion = endTurnWithProvenance({ snapshot: committed.snapshot, provenance: prior.provenance, actionBindings });
    if (!isDeepStrictEqual(companion.nativeResult, endScTurn(committed.snapshot, { skipTurnStartChecks: true }))) fail("$.nativeResult", "PROVENANCE");
    bank = grantStoredIncome(committed.bank, companion.nativeResult.next.turn);
  }
  reconcileR3NativeImage(companion.nativeResult.next, companion.provenance);
  const provenanceBytes = privateBytes(companion);
  const planningOrdinal = prior.planningOrdinal + (phase === "settled" ? 1 : 0);
  const recipients = { w: copyRecipientPrivate(state.recipients.w), b: copyRecipientPrivate(state.recipients.b) };
  const project = (side: Side) => projectR3Boundary({ side, phase, planningOrdinal, snapshot: companion.nativeResult.next, bank, provenance: companion.provenance, companion, previous: sideValue(prior.recipients, side), privateState: sideValue(recipients, side), ownStage: stages ? sideValue(stages, side) : null, committedBank });
  const projected = { w: project("w"), b: project("b") };
  const completionLength = provenanceBytes.length + bytes(projected.w.batch).length + bytes(projected.b.batch).length + Buffer.byteLength(JSON.stringify(companion.nativeResult), "utf8");
  if (completionLength > HOST_CAP) fail("$.transition", "SIZE");
  const checkedCompanion = detachCompanion(companion);
  const session: R3Session = sessionView(freeze({ snapshot: checkedCompanion.nativeResult.next, provenance: checkedCompanion.provenance, bank, planningOrdinal, previousCompanion: checkedCompanion, recipients: projected }));
  const transition: R3StagedTransition = Object.freeze({
    binding: state.binding, phase, ordinal: projected.w.batch.ordinal, successfulOwnStages: stages ? freeze(stages) : null,
    companion: checkedCompanion, provenanceBytes, digest: freeze({ byteLength: provenanceBytes.length, sha256: hash(provenanceBytes) }),
    batches: freeze({ w: projected.w.batch, b: projected.b.batch }),
  });
  return { transition, successor: { binding: state.binding, session, recipients, lastTransition: transition, chain: state.chain } };
};

export const stageR3Begin = (binding: R3Binding, session: R3Session): R3StagedTransition => execute(authority(binding, session), "turn-open", null).transition;
export const stageR3Settlement = (binding: R3Binding, session: R3Session, successfulOwnStages: Readonly<Record<Side, StagedQueue>>): R3StagedTransition => execute(authority(binding, session), "settled", successfulOwnStages).transition;

const checkTransition = (binding: R3Binding, transition: R3StagedTransition): void => {
  const value = object(transition, "$.transition", ["binding", "phase", "ordinal", "successfulOwnStages", "companion", "provenanceBytes", "digest", "batches"]);
  if (value.binding !== binding) fail("$.binding", "SESSION");
  if (value.phase !== "turn-open" && value.phase !== "settled") fail("$.phase", "SCHEMA");
  integer(value.ordinal, "$.ordinal", 1, 128);
  if (value.phase === "turn-open" ? value.successfulOwnStages !== null : value.successfulOwnStages === null) fail("$.successfulOwnStages", "SCHEMA");
  if (value.successfulOwnStages !== null) inspectDto(value.successfulOwnStages, "$.successfulOwnStages");
  object(value.companion, "$.companion", ["nativeResult", "provenance", "frames", "visibilityImages", "visibilityCheckpoints"]);
  const digest = object(value.digest, "$.digest", ["byteLength", "sha256"]);
  integer(digest.byteLength, "$.digest.byteLength", 0, HOST_CAP);
  if (typeof digest.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(digest.sha256)) fail("$.digest.sha256", "SCHEMA");
  if (!(value.provenanceBytes instanceof Uint8Array) || value.provenanceBytes.byteLength > HOST_CAP) fail("$.provenanceBytes", "SIZE");
  const batches = object(value.batches, "$.batches", ["w", "b"]);
  for (const side of SIDES) validateBoundaryBatch(batches[side]);
};
const compareTransition = (claimed: R3StagedTransition, expected: R3StagedTransition): void => {
  if (claimed.phase !== expected.phase || claimed.ordinal !== expected.ordinal || !isDeepStrictEqual(claimed.successfulOwnStages, expected.successfulOwnStages)) fail("$.transition", "DUPLICATE");
  const encoded = privateBytes(claimed.companion);
  if (!byteEqual(encoded, claimed.provenanceBytes) || !byteEqual(claimed.provenanceBytes, expected.provenanceBytes) ||
    claimed.digest.byteLength !== expected.digest.byteLength || claimed.digest.sha256 !== expected.digest.sha256 || hash(claimed.provenanceBytes) !== claimed.digest.sha256) fail("$.companion", "PROVENANCE");
  assertNativeEqual(claimed.companion.nativeResult, expected.companion.nativeResult);
  if (!isDeepStrictEqual(claimed.companion.nativeResult, expected.companion.nativeResult)) fail("$.nativeResult", "PROVENANCE");
  for (const side of SIDES) {
    const actual = bytes(validateBoundaryBatch(sideValue(claimed.batches, side)));
    const reference = bytes(sideValue(expected.batches, side));
    if (!byteEqual(actual, reference) || hash(actual) !== hash(reference)) fail(`$.batches.${side}`, "PROVENANCE");
  }
};
export const verifyAndCommitR3 = (binding: R3Binding, previous: R3Session, claimed: R3StagedTransition): R3Session => {
  const state = authority(binding, previous);
  checkTransition(binding, claimed);
  const ordinal = previous.recipients.w.batch.ordinal;
  if (claimed.ordinal === ordinal) {
    if (!state.lastTransition) return fail("$.ordinal", "SEQUENCE");
    compareTransition(claimed, state.lastTransition);
    return previous;
  }
  if (claimed.ordinal !== ordinal + 1) fail("$.ordinal", "SEQUENCE");
  const expected = execute(state, claimed.phase, claimed.successfulOwnStages);
  compareTransition(claimed, expected.transition);
  sessions.set(expected.successor.session, expected.successor);
  state.chain.current = expected.successor.session;
  bindings.get(binding)!.started = true;
  return expected.successor.session;
};
