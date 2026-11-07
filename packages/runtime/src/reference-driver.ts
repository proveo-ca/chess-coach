// SPEC: _spec/runtime-protocol.puml
import type {} from "bun";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { observationShape } from "../../contracts/src/shape";
import { decodeObservation } from "../../contracts/src/index";
import { nativeBoundaryShape } from "../../contracts/src/native-protocol";
import type { NativeBoundary } from "../../contracts/src/native-protocol";
import { beginResolutionShape, endResolutionShape, nativeSnapshotShape } from "../../contracts/src/resolution";
import type { GamePlans } from "../../contracts/src/game-session";
import type { GameDriver, StagedGame } from "./worker";

type Call = (...args: unknown[]) => unknown;
const call = z.custom<Call>(value => typeof value === "function");
const apiShape = z.strictObject({ parseScFen: call, initializeR3Session: call, stageR3Begin: call, stageR3Settlement: call, verifyAndCommitR3: call,
  stageQueue: call, grantStoredIncome: call });
export type ReferenceApi = z.infer<typeof apiShape>;
const observation = observationShape.unwrap();
const refSnapshot = observation.omit({ version: true, everLit: true, economy: true }).extend({ version: z.literal("challenge-observation-v2"),
  economicState: observation.shape.economy.unwrap().extend({ version: z.literal("challenge-economic-ledger-v1") }) });
const sequence = z.int().min(1).max(372736);
const refEvent = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("own-unit-endowed"), seq: sequence, id: z.string().max(64), square: observation.shape.ownUnitLineage.unwrap().element.unwrap().shape.square,
    type: observation.shape.ownUnitLineage.unwrap().element.unwrap().shape.type, paidBasis: z.literal(0) }),
  z.strictObject({ kind: z.literal("vision-witness"), seq: sequence, turn: z.int().min(0).max(45), changes: z.array(observation.shape.cells.unwrap().element).max(64) }),
  z.strictObject({ kind: z.literal("own-income"), seq: sequence, actualCreditedMinerals: z.int().min(0).max(3) }),
]);
const refBatch = z.strictObject({ version: z.literal("challenge-boundary-batch-v1"), side: z.enum(["w", "b"]), ordinal: z.int().min(0).max(2),
  phase: z.enum(["initial", "turn-open", "settled"]), turn: z.int().min(0).max(45), planningOrdinal: z.int().min(0).max(1),
  seqBefore: z.int().min(0), seqThrough: z.int().min(0), events: z.array(refEvent).max(2048), snapshot: refSnapshot });
const pair = z.strictObject({ w: refBatch, b: refBatch });
const bankShape = z.strictObject({ w: z.int().min(0).max(12), b: z.int().min(0).max(12) });
const sessionView = z.object({ snapshot: nativeSnapshotShape, bank: bankShape, planningOrdinal: z.int().min(0).max(1), recipients: z.strictObject({
  w: z.object({ batch: refBatch, history: z.object({ everLit: observation.shape.everLit }) }),
  b: z.object({ batch: refBatch, history: z.object({ everLit: observation.shape.everLit }) }),
}) });
type ReferenceState = { binding: object; session: unknown; transition: unknown | null; boundary: NativeBoundary };
function fail(code: string): never { throw new Error(`Reference driver: ${code}`); }

function normalize(snapshot: unknown, bank: unknown, batches: unknown, prior: NativeBoundary | null, kernel: unknown, kind: NativeBoundary["kind"]): NativeBoundary {
  const checkedBank = bankShape.parse(bank), checkedSnapshot = nativeSnapshotShape.parse(snapshot), checkedBatches = pair.parse(batches);
  const projected = (side: "w" | "b") => {
    const batch = checkedBatches[side];
    if (kind === "initial" ? batch.events.some(event => event.kind === "own-income")
      : kind === "opened" ? batch.events.length !== 0
        : batch.events.length !== 1 || batch.events[0]?.kind !== "own-income" ||
          batch.events[0].actualCreditedMinerals !== checkedBank[side] - (prior?.bank[side] ?? fail("MISSING_PARENT"))) fail("PROOF_SCOPE");
    const { version: _version, economicState, ...rest } = batch.snapshot;
    const { version: _economicVersion, ...economy } = economicState;
    const everLit = [...new Set([...(prior?.batches[side].observation.everLit ?? []),
      ...batch.events.flatMap(event => event.kind === "vision-witness" ? event.changes.flatMap(cell => cell.visibility === "lit" ? [cell.square] : []) : []),
      ...batch.snapshot.cells.flatMap(cell => cell.visibility === "lit" ? [cell.square] : [])])].sort();
    return { version: "chess-coach.recipient-batch.v1", side, ordinal: batch.ordinal, phase: kind, planningOrdinal: batch.planningOrdinal, events: [],
      observation: decodeObservation(JSON.stringify({ ...rest, version: "chess-coach.observation.v1", economy, everLit })) };
  };
  return nativeBoundaryShape.parse({ kind, snapshot: { ...checkedSnapshot, stored: checkedBank }, bank: checkedBank,
    batches: { w: projected("w"), b: projected("b") }, kernel });
}

export function referenceProofDriver(input: ReferenceApi): GameDriver<ReferenceState> {
  const api = apiShape.parse(input);
  return {
    initialize(): StagedGame<ReferenceState> {
      const parsed = nativeSnapshotShape.parse(api.parseScFen("SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|Q:w:;b:"));
      const binding = {}, openingBank = { w: 3, b: 3 };
      const session = api.initializeR3Session(binding, { ...parsed, stored: openingBank }, openingBank), view = sessionView.parse(session);
      const boundary = normalize(view.snapshot, view.bank, { w: view.recipients.w.batch, b: view.recipients.b.batch }, null, { kind: "initial" }, "initial");
      return { state: { binding, session, transition: null, boundary }, boundary };
    },
    open(state): StagedGame<ReferenceState> {
      if (state.transition !== null || state.boundary.kind !== "initial") fail("PROOF_SCOPE");
      const transition = api.stageR3Begin(state.binding, state.session);
      const value = z.object({ companion: z.object({ nativeResult: beginResolutionShape }), batches: pair }).parse(transition);
      const boundary = normalize(value.companion.nativeResult.next, state.boundary.bank, value.batches, state.boundary,
        { kind: "opened", result: value.companion.nativeResult }, "opened");
      return { state: { ...state, transition, boundary }, boundary };
    },
    settle(state, plans: GamePlans): StagedGame<ReferenceState> {
      if (state.transition !== null || state.boundary.kind !== "opened" || plans.w.length || plans.b.length) fail("PROOF_SCOPE");
      const view = sessionView.parse(state.session), stages: Record<string, unknown> = {};
      for (const side of ["w", "b"] as const) {
        const result = z.object({ ok: z.literal(true), staged: z.unknown() }).parse(api.stageQueue(view.snapshot, view.bank, side, [], 0));
        stages[side] = result.staged;
      }
      const transition = api.stageR3Settlement(state.binding, state.session, stages);
      const value = z.object({ companion: z.object({ nativeResult: endResolutionShape }), batches: pair }).parse(transition);
      const bank = api.grantStoredIncome(view.bank, value.companion.nativeResult.next.turn);
      const boundary = normalize(value.companion.nativeResult.next, bank, value.batches, state.boundary,
        { kind: "settled", result: value.companion.nativeResult }, "settled");
      return { state: { ...state, transition, boundary }, boundary };
    },
    commit(state): ReferenceState {
      if (state.transition === null) return state;
      const session = api.verifyAndCommitR3(state.binding, state.session, state.transition), view = sessionView.parse(session);
      if (!isDeepStrictEqual(view.bank, state.boundary.bank) || !isDeepStrictEqual({ ...view.snapshot, stored: view.bank }, state.boundary.snapshot)) fail("COMMIT_DRIFT");
      for (const side of ["w", "b"] as const) if (!isDeepStrictEqual(view.recipients[side].history.everLit, state.boundary.batches[side].observation.everLit)) fail("COMMIT_HISTORY");
      return { ...state, session, transition: null };
    },
  };
}

export async function loadCapturedReferenceProofDriver() {
  const corePath = "/app/reference/packages/starchess-core/src/index.ts";
  const sessionPath = "/app/reference/packages/starchess-arena/src/challenge/r3Session.ts";
  const admissionPath = "/app/reference/packages/starchess-arena/src/challenge/admission.ts";
  const bankPath = "/app/reference/packages/starchess-arena/src/run/bank.ts";
  const [core, session, admission, bank] = await Promise.all([import(corePath), import(sessionPath), import(admissionPath), import(bankPath)]);
  return referenceProofDriver(apiShape.parse({ parseScFen: core.parseScFen, initializeR3Session: session.initializeR3Session,
    stageR3Begin: session.stageR3Begin, stageR3Settlement: session.stageR3Settlement, verifyAndCommitR3: session.verifyAndCommitR3,
    stageQueue: admission.stageQueue, grantStoredIncome: bank.grantStoredIncome }));
}
