// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml, _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml, _spec/packages/starchess-arena/authorized-economic-boundaries.puml
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
import { copyR3PrivateBytes, detachR3Data, encodeR3Provenance, equalR3PrivateBytes, readR3Record, R3_PRIVATE_CAP } from "./r3Private";
export { copyR3PrivateBytes, encodeR3Provenance, equalR3PrivateBytes } from "./r3Private";
import type { AuthorizedBoundaryBatch, AuthorizedHistory, ReconciledBoundaryState, Side } from "../authorized/v2/types";

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
export type R3EconomicBoundaryFields = Readonly<Omit<ReconciledBoundaryState, "lastBatchBytes">>;
export type R3EconomicInput = Readonly<{
  batch: AuthorizedBoundaryBatch; boundary: R3EconomicBoundaryFields; history: AuthorizedHistory;
  batchByteLength: number; readBatchByte: (index: number) => number;
}>;
type RecipientGraphs = Readonly<Record<Side, R3Recipient>>;
type InputChain = { current: R3Session; nodes: RecipientGraphs[]; borrowed: boolean };
type PrivateState = {
  binding: R3Binding; session: R3Session; recipients: Record<Side, R3RecipientPrivate>;
  publicRecipients: RecipientGraphs; lastTransition: R3StagedTransition | null; chain: InputChain;
};
type EconomicReaderScope = {
  binding: R3Binding | null; session: R3Session | null; recipient: R3Recipient | null;
  charge: ((units: number) => void) | null; byteLength: number; reading: boolean;
};
const sessions = new WeakMap<R3Session, PrivateState>();
const bindings = new WeakMap<R3Binding, { opening: ScFenSnapshot; bank: Bank; started: boolean }>();
const HOST_CAP = R3_PRIVATE_CAP;
const INPUT_CAP = 91;
const ECONOMIC_VISIT_UNITS = 128;
const ECONOMIC_NODE_UNITS = 256;
const ECONOMIC_BYTE_UNITS = 64;
const SIDES = ["w", "b"] as const;
const sideValue = <T>(values: Readonly<{ w: T; b: T }>, side: Side): T => side === "w" ? values.w : values.b;
const hash = (input: Uint8Array): string => createHash("sha256").update(input).digest("hex");
const authority = (binding: R3Binding, session: R3Session): PrivateState => {
  const state = sessions.get(session);
  if (!state || state.binding !== binding) return fail("$.binding", "SESSION");
  if (state.chain.current !== session) return fail("$.session", "SEQUENCE");
  return state;
};
const mutationAuthority = (binding: R3Binding, session: R3Session): PrivateState => {
  const state = authority(binding, session);
  if (state.chain.borrowed) fail("$.session", "PROTOCOL");
  return state;
};
const chargeEconomic = (binding: R3Binding, session: R3Session, charge: (units: number) => void, units: number): void => {
  if (!authority(binding, session).chain.borrowed) fail("$.session", "PROTOCOL");
  let result: unknown;
  try { result = charge(units); }
  finally { if (!authority(binding, session).chain.borrowed) fail("$.session", "PROTOCOL"); }
  if (result !== undefined) fail("$.charge", "PROTOCOL");
};
const economicByteReader = (scope: EconomicReaderScope): ((index: number) => number) => index => {
  if (!scope.binding || !scope.session || !scope.recipient || !scope.charge || scope.reading) return fail("$.readBatchByte", "PROTOCOL");
  const { binding, session, charge } = scope;
  scope.reading = true;
  try {
    chargeEconomic(binding, session, charge, ECONOMIC_BYTE_UNITS);
    if (!scope.recipient) return fail("$.readBatchByte", "PROTOCOL");
    integer(index, "$.readBatchByte.index", 0, scope.byteLength - 1);
    return scope.recipient.boundary.lastBatchBytes[index]!;
  } finally { scope.reading = false; }
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
    const stage = object(side === "w" ? pair.w : pair.b, `$.successfulOwnStages.${side}`, ["side", "intents", "gasAfter", "spend"]);
    if (stage.side !== side) fail("$.successfulOwnStages", "SIDE");
    array(stage.intents, "$.intents", 4, action => action);
    const intents = inspectDto(stage.intents, "$.intents") as StagedQueue["intents"];
    const checked = stageQueue(state.session.snapshot, state.session.bank, side, intents, state.session.planningOrdinal);
    if (!checked.ok) return fail("$.successfulOwnStages", "PROTOCOL");
    if (!isDeepStrictEqual(checked.staged, { ...stage, intents })) fail("$.successfulOwnStages", "CONSERVATION");
    if (side === "w") result.w = checked.staged;
    else result.b = checked.staged;
  }
  return result;
};

export const initializeR3Session = (binding: R3Binding, openingSnapshot: ScFenSnapshot, openingBank: Bank): R3Session => {
  if (!binding || typeof binding !== "object") fail("$.binding", "SESSION");
  const registered = bindings.get(binding);
  if (registered?.started) fail("$.binding", "SESSION");
  const b = readR3Record(openingBank, "$.bank", ["w", "b"]);
  const bank = { w: integer(b.w, "$.bank.w", 0, 12), b: integer(b.b, "$.bank.b", 0, 12) };
  const snapshot = detachR3Data(openingSnapshot, "$.snapshot") as ScFenSnapshot;
  const provenance = initializeProvenance(snapshot);
  if (registered && (!isDeepStrictEqual(snapshot, registered.opening) || !isDeepStrictEqual(bank, registered.bank))) fail("$.binding", "SESSION");
  reconcileR3NativeImage(snapshot, provenance);
  const recipients = { w: newRecipientPrivate(), b: newRecipientPrivate() };
  const project = (side: Side) => projectR3Boundary({ side, phase: "initial", planningOrdinal: 0, snapshot, bank, provenance, companion: null, previous: null, privateState: sideValue(recipients, side), ownStage: null, committedBank: null });
  const publicRecipients = freeze({ w: project("w"), b: project("b") });
  const session = sessionView(freeze({ snapshot, provenance, bank, planningOrdinal: 0, previousCompanion: null, recipients: publicRecipients }));
  sessions.set(session, { binding, session, recipients, publicRecipients, lastTransition: null, chain: { current: session, nodes: [publicRecipients], borrowed: false } });
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
  const project = (side: Side) => projectR3Boundary({ side, phase, planningOrdinal, snapshot: companion.nativeResult.next, bank, provenance: companion.provenance, companion, previous: sideValue(state.publicRecipients, side), privateState: sideValue(recipients, side), ownStage: stages ? sideValue(stages, side) : null, committedBank });
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
  return { transition, successor: { binding: state.binding, session, recipients, publicRecipients: projected, lastTransition: transition, chain: state.chain } };
};

export const stageR3Begin = (binding: R3Binding, session: R3Session): R3StagedTransition => {
  const result = execute(mutationAuthority(binding, session), "turn-open", null);
  authority(binding, session);
  return result.transition;
};
export const stageR3Settlement = (binding: R3Binding, session: R3Session, successfulOwnStages: Readonly<Record<Side, StagedQueue>>): R3StagedTransition => {
  const state = mutationAuthority(binding, session);
  const detached = detachR3Data(successfulOwnStages, "$.successfulOwnStages") as Readonly<Record<Side, StagedQueue>>;
  authority(binding, session);
  const result = execute(state, "settled", detached);
  authority(binding, session);
  return result.transition;
};
export const readR3CheckedBoundary = (binding: R3Binding, session: R3Session, side: Side): ReconciledBoundaryState => {
  const state = authority(binding, session);
  if (side !== "w" && side !== "b") return fail("$.side", "SIDE");
  return sideValue(state.session.recipients, side).boundary;
};
export const readR3PlanningHistory = (binding: R3Binding, session: R3Session, side: Side): AuthorizedHistory => {
  const state = authority(binding, session);
  if (side !== "w" && side !== "b") return fail("$.side", "SIDE");
  if (state.session.provenance.stage !== "after-begin" || scOutcome(state.session.snapshot)) fail("$.session", "PROTOCOL");
  const recipient = sideValue(state.session.recipients, side);
  const snapshot = recipient.history.currentAuthorizedSnapshotV2;
  if (snapshot.ownMineLineage.length !== recipient.boundary.ownMineAuditState.liveOwnMines.length ||
    !isDeepStrictEqual(snapshot, recipient.boundary.snapshot)) fail("$.ownMineLineage", "CONSISTENCY");
  return recipient.history;
};

export const visitR3EconomicInputs = (
  binding: R3Binding, session: R3Session, side: Side, afterOrdinal: number,
  charge: (units: number) => void, visit: (input: R3EconomicInput) => void,
): void => {
  const state = mutationAuthority(binding, session);
  if (typeof charge !== "function" || typeof visit !== "function") fail("$.callback", "PROTOCOL");
  state.chain.borrowed = true;
  try {
    chargeEconomic(binding, session, charge, ECONOMIC_VISIT_UNITS);
    if (side !== "w" && side !== "b") fail("$.side", "SIDE");
    if (session.provenance.stage !== "after-begin" || scOutcome(session.snapshot)) fail("$.session", "PROTOCOL");
    const ordinal = state.publicRecipients.w.batch.ordinal;
    if (typeof afterOrdinal !== "number" || !Number.isSafeInteger(afterOrdinal) || Object.is(afterOrdinal, -0) || afterOrdinal < -1 || afterOrdinal > ordinal ||
      state.chain.nodes.length !== ordinal + 1 || state.chain.nodes.length > INPUT_CAP) fail("$.afterOrdinal", "SEQUENCE");
    for (let next = afterOrdinal + 1; next <= ordinal; next++) {
      chargeEconomic(binding, session, charge, ECONOMIC_NODE_UNITS);
      const recipient = sideValue(state.chain.nodes[next]!, side);
      const retained = recipient.boundary;
      if (recipient.batch.ordinal !== next || retained.ordinal !== next) fail("$.ordinal", "SEQUENCE");
      const boundary: R3EconomicBoundaryFields = Object.freeze({
        snapshot: retained.snapshot, economicState: retained.economicState, ownMineAuditState: retained.ownMineAuditState,
        everLit: retained.everLit, ordinal: retained.ordinal, phase: retained.phase, planningOrdinal: retained.planningOrdinal,
        seqThrough: retained.seqThrough,
      });
      const scope: EconomicReaderScope = { binding, session, recipient, charge, byteLength: retained.lastBatchBytes.byteLength, reading: false };
      try {
        const input: R3EconomicInput = Object.freeze({
          batch: recipient.batch, boundary, history: recipient.history,
          batchByteLength: scope.byteLength, readBatchByte: economicByteReader(scope),
        });
        authority(binding, session);
        let result: unknown;
        try { result = visit(input); }
        finally { authority(binding, session); }
        if (result !== undefined) fail("$.visit", "PROTOCOL");
      } finally {
        scope.binding = null; scope.session = null; scope.recipient = null; scope.charge = null;
      }
    }
  } finally { state.chain.borrowed = false; }
};

const checkTransition = (binding: R3Binding, transition: R3StagedTransition): R3StagedTransition => {
  const source = readR3Record(transition, "$.transition", ["binding", "phase", "ordinal", "successfulOwnStages", "companion", "provenanceBytes", "digest", "batches"]);
  if (source.binding !== binding) fail("$.binding", "SESSION");
  const provenanceBytes = copyR3PrivateBytes(source.provenanceBytes);
  const detached = detachR3Data({ phase: source.phase, ordinal: source.ordinal, successfulOwnStages: source.successfulOwnStages, companion: source.companion, digest: source.digest, batches: source.batches }, "$.transition") as Omit<R3StagedTransition, "binding" | "provenanceBytes">;
  const value: R3StagedTransition = Object.freeze({ ...freeze(detached), binding, provenanceBytes });
  if (value.phase !== "turn-open" && value.phase !== "settled") fail("$.phase", "SCHEMA");
  integer(value.ordinal, "$.ordinal", 1, 128);
  if (value.phase === "turn-open" ? value.successfulOwnStages !== null : value.successfulOwnStages === null) fail("$.successfulOwnStages", "SCHEMA");
  if (value.successfulOwnStages !== null) inspectDto(value.successfulOwnStages, "$.successfulOwnStages");
  object(value.companion, "$.companion", ["nativeResult", "provenance", "frames", "visibilityImages", "visibilityCheckpoints"]);
  const digest = object(value.digest, "$.digest", ["byteLength", "sha256"]);
  integer(digest.byteLength, "$.digest.byteLength", 0, HOST_CAP);
  if (typeof digest.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(digest.sha256)) fail("$.digest.sha256", "SCHEMA");
  const batches = object(value.batches, "$.batches", ["w", "b"]);
  validateBoundaryBatch(batches.w);
  validateBoundaryBatch(batches.b);
  const encoded = privateBytes(value.companion);
  if (!equalR3PrivateBytes(encoded, provenanceBytes) || digest.byteLength !== encoded.length || digest.sha256 !== hash(provenanceBytes)) fail("$.companion", "PROVENANCE");
  return value;
};
const compareTransition = (claimed: R3StagedTransition, expected: R3StagedTransition): void => {
  if (claimed.phase !== expected.phase || claimed.ordinal !== expected.ordinal || !isDeepStrictEqual(claimed.successfulOwnStages, expected.successfulOwnStages)) fail("$.transition", "DUPLICATE");
  const encoded = privateBytes(claimed.companion);
  if (!equalR3PrivateBytes(encoded, claimed.provenanceBytes) || !equalR3PrivateBytes(claimed.provenanceBytes, expected.provenanceBytes) ||
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
  const state = mutationAuthority(binding, previous);
  const checked = checkTransition(binding, claimed);
  authority(binding, previous);
  const ordinal = state.publicRecipients.w.batch.ordinal;
  if (checked.ordinal === ordinal) {
    if (!state.lastTransition) return fail("$.ordinal", "SEQUENCE");
    compareTransition(checked, state.lastTransition);
    authority(binding, previous);
    return previous;
  }
  if (checked.ordinal !== ordinal + 1) fail("$.ordinal", "SEQUENCE");
  const expected = execute(state, checked.phase, checked.successfulOwnStages);
  compareTransition(checked, expected.transition);
  authority(binding, previous);
  if (state.chain.nodes.length !== checked.ordinal || state.chain.nodes.length >= INPUT_CAP) fail("$.ordinal", "SEQUENCE");
  state.chain.nodes[checked.ordinal] = expected.successor.publicRecipients;
  sessions.set(expected.successor.session, expected.successor);
  state.chain.current = expected.successor.session;
  bindings.get(binding)!.started = true;
  return expected.successor.session;
};
