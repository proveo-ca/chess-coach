// SPEC: _spec/apps/arena/burn-compat.puml
import {
  AddScActionError, MAX_GAME_TURNS, MAX_MINES_PER_SIDE, MAX_STORED_MATERIAL, OPENING_STORED_MATERIAL, UNIT_COST,
  addScAction, applyStoredIncome, assertQueueGas, beginTurnWithProvenance, endTurnWithProvenance,
  energyForTurn, formatScFen, incomeForTurn, initializeProvenance, parseScFen, queueGasSpent, scOutcome, validateScFen,
  type ActionBindings, type EngineProvenance, type ScFenSnapshot,
} from "@chess-coach/starchess-core";
import { EconomicProjector } from "./economic-project";
import {
  ECONOMIC_PROTOCOL, ECONOMIC_REPLY_LIMIT, type AcceptedOwnAction, type EconomicOpen, type EconomicSettle, type EconomicStart, type LedgerRules,
} from "./economic-wire";
import { FIXTURES_V2 } from "./fixtures";
import {
  EngineErrorV2, freezeV2, integerV2, parseContextV2, parseRequestsV2,
  type Action, type Bank, type BeginRecord, type EngineContext, type FixtureId, type Outcome, type Pair, type SessionClose, type Side, type StateImage,
} from "./wire-v2";

export function nativeLedgerRules(): LedgerRules {
  return freezeV2({ version: "arena-economic-rules-v1", openingBankDefault: OPENING_STORED_MATERIAL,
    unitCosts: { ...UNIT_COST }, mineralBankCap: MAX_STORED_MATERIAL, mineEntityCap: MAX_MINES_PER_SIDE, maxTurn: MAX_GAME_TURNS,
    incomeByTurn: Array.from({ length: MAX_GAME_TURNS + 1 }, (_, turn) => incomeForTurn(Math.max(1, turn))),
    gasCapacityByTurn: Array.from({ length: MAX_GAME_TURNS + 1 }, (_, turn) => energyForTurn(turn)),
  });
}

function bank(snapshot: ScFenSnapshot): Bank {
  if (!snapshot.stored) throw new Error("Economic reconstruction requires an explicit bank");
  const { w, b } = snapshot.stored;
  if (![w, b].every(n => Number.isSafeInteger(n) && n >= 0 && n <= MAX_STORED_MATERIAL)) throw new Error("Invalid economic bank");
  return { w, b };
}
const image = (snapshot: ScFenSnapshot): StateImage => ({ scfen: formatScFen(snapshot), bank: bank(snapshot) });
const outcome = (snapshot: ScFenSnapshot): Outcome | null => {
  const result = scOutcome(snapshot);
  return result === null ? null : { winner: result.winner, draw: result.draw === true };
};
function opening(snapshot: ScFenSnapshot): void {
  bank(snapshot);
  if (snapshot.phase !== "P" || !snapshot.queue || snapshot.queue.actions.length) throw new Error("Economic reconstruction requires an empty native queue");
  assertQueueGas(snapshot);
}

export function assertEconomicResultFits(result: unknown): void {
  const bytes = Buffer.byteLength(JSON.stringify({ protocol: ECONOMIC_PROTOCOL, id: 0xffffffff, ok: true, result })) + 1;
  if (bytes > ECONOMIC_REPLY_LIMIT) throw new EngineErrorV2("LIMIT", "Economic reply exceeds 1 MiB");
}

class AdmissionRejection extends Error {
  constructor(readonly side: Side, readonly index: number, readonly nativeCode: string, message: string) { super(message); }
}

function stage(open: ScFenSnapshot, requests: Pair<Action[]>, sides: readonly Side[], planningOrdinal: number) {
  let state = structuredClone(open);
  const minerals = bank(open);
  const admission: Pair<AcceptedOwnAction[]> = { w: [], b: [] };
  let sequence = 0;
  for (const side of sides) for (const [index, action] of requests[side].entries()) {
    const debit = action.kind === "deploy" && action.unit ? UNIT_COST[action.unit] : 0;
    if (debit > minerals[side]) throw new AdmissionRejection(side, index, "SC_MINERALS", `Insufficient minerals for ${side}`);
    const previousGas = state.gas[side];
    try {
      const appended = addScAction({ snapshot: state, action: structuredClone(action) });
      if (appended.action.seq !== sequence++) throw new Error("Economic native queue sequence mismatch");
      state = appended.snapshot;
    } catch (error) {
      if (error instanceof AddScActionError) throw new AdmissionRejection(side, index, error.code, error.message);
      throw error;
    }
    minerals[side] -= debit;
    state = { ...state, stored: { ...minerals } };
    admission[side].push({ actionRef: { planningOrdinal, acceptedActionOrdinal: index }, action: structuredClone(action), minerals: debit, gas: previousGas - state.gas[side] });
  }
  assertQueueGas(state);
  const gas = queueGasSpent(state.queue?.actions);
  for (const side of ["w", "b"] as const) if (state.gas[side] + gas[side] !== open.gas[side]) throw new Error("Economic native gas mismatch");
  return { state, admission };
}

export function deriveActionBindings(queued: ScFenSnapshot, admission: Pair<AcceptedOwnAction[]>): ActionBindings {
  const ordinals = { w: 0, b: 0 };
  return (queued.queue?.actions ?? []).map(action => {
    const receipt = admission[action.color][ordinals[action.color]++];
    if (!receipt) throw new Error("Missing admitted native action");
    const { seq: _seq, ...input } = action;
    if (JSON.stringify(input) !== JSON.stringify(receipt.action)) throw new Error("Native action binding mismatch");
    return { sourceActionSeq: action.seq, side: action.color, actionRef: { ...receipt.actionRef } };
  });
}

export class EconomicReplay {
  #state: ScFenSnapshot | null = null;
  #testState: ScFenSnapshot | null = null;
  #provenance: EngineProvenance | null = null;
  #projector = new EconomicProjector();
  #identity = 0;
  #ordinal = 0;
  #window: EngineContext | null = null;
  #begin: BeginRecord | null = null;
  #failed = false;
  #terminalReported = false;
  #analysisDeadline = performance.now() + 297_000;
  #windowDeadline = 0;

  #checkTime(deadline = this.#windowDeadline): void {
    if (performance.now() >= Math.min(deadline, this.#analysisDeadline)) throw new EngineErrorV2("LIMIT", "Economic reconstruction deadline exceeded", this.#window);
  }

  static fromSnapshotForTest(snapshot: ScFenSnapshot): EconomicReplay {
    const valid = validateScFen(formatScFen(snapshot));
    if (!valid.ok) throw new Error(valid.error.message);
    const replay = new EconomicReplay();
    replay.#testState = structuredClone(snapshot);
    return replay;
  }

  get active(): boolean { return this.#state !== null; }

  start(fixture: FixtureId): EconomicStart {
    if (this.active) throw new EngineErrorV2("STATE", "An engine is already active");
    if (!Object.hasOwn(FIXTURES_V2, fixture)) throw new EngineErrorV2("BAD_REQUEST", "Invalid fixture");
    try {
      const deadline = performance.now() + 10_000;
      this.#checkTime(deadline);
      const raw = FIXTURES_V2[fixture];
      const valid = validateScFen(raw);
      if (!valid.ok) throw new Error(valid.error.message);
      const state = this.#testState ? structuredClone(this.#testState) : parseScFen(raw);
      const mines = new Set<string>();
      for (const mine of state.mines ?? []) {
        const key = `${mine.color}:${mine.at}`;
        if (mines.has(key)) throw new EngineErrorV2("ENGINE_FAILURE", "Unsupported duplicate same-side initial mines in native provenance");
        mines.add(key);
      }
      const provenance = initializeProvenance(state);
      const projector = new EconomicProjector();
      const result: EconomicStart = freezeV2({ kind: "started", session: this.#identity + 1, fixture, initial: image(state), outcome: outcome(state), rules: nativeLedgerRules(), boundaries: projector.initial(state, provenance) });
      assertEconomicResultFits(result);
      this.#checkTime(deadline);
      this.#state = state; this.#testState = null; this.#provenance = provenance; this.#projector = projector;
      this.#identity++; this.#ordinal = 0; this.#window = null; this.#begin = null; this.#failed = false; this.#terminalReported = false;
      this.#windowDeadline = deadline;
      return result;
    } catch (error) {
      if (error instanceof EngineErrorV2) throw error;
      throw new EngineErrorV2("ENGINE_FAILURE", "Native economic initialization failed");
    }
  }

  #require(failedAllowed = false): ScFenSnapshot {
    if (!this.#state) throw new EngineErrorV2("STATE", "Unknown engine session");
    if (this.#failed && !failedAllowed) throw new EngineErrorV2("STATE", "Engine session failed", this.#window);
    return this.#state;
  }

  open(planningOrdinal: number): EconomicOpen {
    integerV2(planningOrdinal);
    const before = this.#require();
    if (planningOrdinal !== this.#ordinal || this.#window || this.#terminalReported) throw new EngineErrorV2("STALE_CONTEXT", "Repeated or out-of-sequence planning window", this.#window);
    try {
      const deadline = this.#ordinal === 0 ? this.#windowDeadline : performance.now() + 10_000;
      this.#checkTime(deadline);
      const existing = outcome(before);
      if (existing) {
        const result: EconomicOpen = freezeV2({ kind: "terminal", session: this.#identity, outcome: existing, image: image(before), begin: null, boundaries: null });
        assertEconomicResultFits(result); this.#terminalReported = true; return result;
      }
      opening(before);
      const companion = beginTurnWithProvenance({ snapshot: structuredClone(before), provenance: this.#provenance! });
      const rawBegin = companion.nativeResult;
      const next: ScFenSnapshot = { ...structuredClone(rawBegin.next), stored: bank(before) };
      const over = outcome(next);
      const begin: BeginRecord = freezeV2({ session: this.#identity, planningOrdinal, before: image(before), after: image(next), rawBegin: structuredClone(rawBegin), outcome: over });
      const projector = this.#projector.fork();
      const boundaries = projector.boundary({ snapshot: next, companion, phase: "turn-open", planningOrdinal, deadline: Math.min(deadline, this.#analysisDeadline) });
      let result: EconomicOpen;
      const context = { session: this.#identity, planningOrdinal, turn: next.turn };
      if (over) result = freezeV2({ kind: "terminal", session: this.#identity, outcome: over, image: image(next), begin, boundaries });
      else {
        opening(next);
        result = freezeV2({ kind: "planning", context, views: { w: boundaries.w.snapshot, b: boundaries.b.snapshot }, begin, boundaries });
      }
      assertEconomicResultFits(result);
      this.#checkTime(deadline);
      this.#state = next; this.#provenance = companion.provenance; this.#projector = projector;
      this.#windowDeadline = deadline;
      if (over) this.#terminalReported = true;
      else { this.#window = context; this.#begin = begin; }
      return result;
    } catch (error) {
      this.#failed = true;
      if (error instanceof EngineErrorV2) throw error;
      throw new EngineErrorV2("ENGINE_FAILURE", "Native turn opening failed", this.#window);
    }
  }

  settle(contextValue: EngineContext, requestsValue: Pair<Action[]>): EconomicSettle {
    const context = parseContextV2(contextValue);
    const requests = parseRequestsV2(requestsValue);
    const before = this.#require();
    if (context.session !== this.#identity || !this.#window || !this.#begin || context.turn !== this.#window.turn || context.planningOrdinal !== this.#window.planningOrdinal) throw new EngineErrorV2("STALE_CONTEXT", "Stale planning context", this.#window);
    const begin = this.#begin;
    try {
      this.#checkTime();
      opening(before);
      const white = stage(before, requests, ["w"], context.planningOrdinal);
      const black = stage(before, requests, ["b"], context.planningOrdinal);
      const merged = stage(before, requests, ["w", "b"], context.planningOrdinal);
      const queued = merged.state;
      if (white.state.gas.w !== queued.gas.w || black.state.gas.b !== queued.gas.b || bank(white.state).w !== bank(queued).w || bank(black.state).b !== bank(queued).b) throw new Error("Economic admission isolation mismatch");
      const companion = endTurnWithProvenance({ snapshot: structuredClone(queued), provenance: this.#provenance!, actionBindings: deriveActionBindings(queued, merged.admission) });
      const rawResolve = companion.nativeResult;
      const debited = bank(queued);
      const funded = applyStoredIncome({ ...debited }, rawResolve.next.turn);
      const after: ScFenSnapshot = { ...structuredClone(rawResolve.next), stored: { ...funded } };
      const grants = { w: funded.w - debited.w, b: funded.b - debited.b };
      const settlementFacts = (side: Side) => ({ entitlement: incomeForTurn(Math.max(1, after.turn)), credited: grants[side], gasBeforeReset: queued.gas[side], nextGasCapacity: after.gasIncome[side] });
      const projector = this.#projector.fork();
      const boundaries = projector.boundary({ snapshot: after, companion, phase: "settled", planningOrdinal: context.planningOrdinal + 1,
        admission: merged.admission, settlement: { w: settlementFacts("w"), b: settlementFacts("b") }, deadline: Math.min(this.#windowDeadline, this.#analysisDeadline) });
      const result: EconomicSettle = freezeV2({ kind: "committed", context, begin, settlement: {
        context: { ...context }, requests, before: image(before), committed: image(queued), after: image(after), grants, rawResolve: structuredClone(rawResolve), outcome: outcome(after),
      }, boundaries });
      assertEconomicResultFits(result);
      this.#checkTime();
      this.#state = after; this.#provenance = companion.provenance; this.#projector = projector;
      this.#begin = null; this.#window = null; this.#ordinal++;
      return result;
    } catch (error) {
      this.#failed = true;
      if (error instanceof AdmissionRejection) {
        const witness = freezeV2({ side: error.side, actionIndex: error.index, nativeCode: error.nativeCode, message: error.message, begin, requests, image: image(before), outcome: outcome(before) });
        this.#begin = null;
        throw new EngineErrorV2("NATIVE_REJECTION", error.message, context, witness);
      }
      if (error instanceof EngineErrorV2) throw error;
      throw new EngineErrorV2("ENGINE_FAILURE", "Native settlement failed", context);
    }
  }

  close(): SessionClose {
    const state = this.#require(true);
    const result: SessionClose = freezeV2({ kind: "closed", session: this.#identity, pendingBegin: this.#begin, image: image(state), outcome: outcome(state) });
    assertEconomicResultFits(result);
    this.#state = null; this.#provenance = null; this.#window = null; this.#begin = null; this.#projector = new EconomicProjector();
    return result;
  }
}
