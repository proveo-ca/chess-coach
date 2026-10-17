// SPEC: _spec/apps/arena/burn-compat.puml
import {
  AddScActionError, MAX_STORED_MATERIAL, UNIT_COST, addScAction, applyStoredIncome,
  assertQueueGas, beginScTurn, endScTurn, formatScFen, getSideVision, parseScFen,
  placementToMap, queueGasSpent, scOutcome, validateScFen, type ScFenSnapshot,
} from "@chess-coach/starchess-core";
import { FIXTURES_V2 } from "./fixtures";
import {
  EngineErrorV2, freezeV2, integerV2, parseContextV2, parseRequestsV2, parseViewV2, SQUARES_V2,
  type Action, type AuthorizedView, type Bank, type BeginRecord, type Cell, type EngineContext, type FixtureId,
  type Outcome, type Pair, type SessionClose, type SessionCommit, type SessionOpen, type SessionStart, type Side, type StateImage,
} from "./wire-v2";

function replayBankV2(snapshot: ScFenSnapshot): Bank {
  if (!snapshot.stored) throw new Error("Replay requires an explicit bank");
  const { w, b } = snapshot.stored;
  if (![w, b].every(n => Number.isSafeInteger(n) && n >= 0 && n <= MAX_STORED_MATERIAL)) throw new Error("Invalid replay bank");
  return { w, b };
}
const replayImageV2 = (snapshot: ScFenSnapshot): StateImage => ({ scfen: formatScFen(snapshot), bank: replayBankV2(snapshot) });
const replayOutcomeV2 = (snapshot: ScFenSnapshot): Outcome | null => {
  const result = scOutcome(snapshot);
  return result === null ? null : { winner: result.winner, draw: result.draw === true };
};
function replayOpeningV2(snapshot: ScFenSnapshot): void {
  replayBankV2(snapshot);
  if (snapshot.phase !== "P" || !snapshot.queue || snapshot.queue.actions.length) throw new Error("Replay requires an empty native queue");
  assertQueueGas(snapshot);
}

function replayViewV2(snapshot: ScFenSnapshot, side: Side): AuthorizedView {
  const board = placementToMap(snapshot.placement);
  const siege = new Set(snapshot.siegedTanks ?? []);
  const vision = getSideVision(board, side, { mines: snapshot.mines ?? [], tankModeFor: at => siege.has(at) ? "siege" : "tank" });
  const pieces: AuthorizedView["own"]["pieces"] = [];
  const cells: Cell[] = SQUARES_V2.map(square => {
    const piece = board.get(square);
    if (piece?.color === side) pieces.push({ square, type: piece.type });
    if (vision.litSquares.has(square) || piece?.color === side) return { square, visibility: "lit", piece: piece ? { ...piece } : null };
    if (vision.revealedPieces.has(square) && piece) return { square, visibility: "revealed", piece: { ...piece } };
    return { square, visibility: "unknown" };
  });
  return parseViewV2({ version: "arena-observation-v2", side, turn: snapshot.turn, own: {
    minerals: replayBankV2(snapshot)[side], gas: snapshot.gas[side], gasIncome: snapshot.gasIncome[side], ccLives: snapshot.ccLives[side], pieces,
    mines: (snapshot.mines ?? []).filter(m => m.color === side).map(m => m.at).sort(),
    siegedTanks: pieces.filter(p => p.type === "r" && siege.has(p.square)).map(p => p.square),
  }, cells });
}

class ReplayRejectionV2 extends Error {
  constructor(readonly side: Side, readonly index: number | null, readonly nativeCode: string, message: string) { super(message); }
}

function replayStageV2(opening: ScFenSnapshot, requests: Pair<Action[]>, colors: readonly Side[]): ScFenSnapshot {
  let state = structuredClone(opening);
  const minerals = replayBankV2(opening);
  let sequence = 0;
  for (const side of colors) {
    for (const [index, action] of requests[side].entries()) {
      const debit = action.kind === "deploy" && action.unit ? UNIT_COST[action.unit] : 0;
      if (debit > minerals[side]) throw new ReplayRejectionV2(side, index, "SC_MINERALS", `Insufficient minerals for ${side}`);
      try {
        const appended = addScAction({ snapshot: state, action: structuredClone(action) });
        if (appended.action.seq !== sequence++) throw new Error("Replay sequence mismatch");
        state = appended.snapshot;
      } catch (error) {
        if (error instanceof AddScActionError) throw new ReplayRejectionV2(side, index, error.code, error.message);
        throw error;
      }
      minerals[side] -= debit;
      state = { ...state, stored: { ...minerals } };
    }
  }
  assertQueueGas(state);
  const gas = queueGasSpent(state.queue?.actions);
  for (const side of ["w", "b"] as const) if (state.gas[side] + gas[side] !== opening.gas[side]) throw new Error("Replay gas mismatch");
  return state;
}

export class NativeReplay {
  #state: ScFenSnapshot | null = null;
  #testState: ScFenSnapshot | null = null;
  #identity = 0;
  #ordinal = 0;
  #window: EngineContext | null = null;
  #begin: BeginRecord | null = null;
  #failed = false;
  #terminalReported = false;

  static fromSnapshotForTest(snapshot: ScFenSnapshot): NativeReplay {
    const replay = new NativeReplay();
    const valid = validateScFen(formatScFen(snapshot));
    if (!valid.ok) throw new Error(valid.error.message);
    replay.#testState = structuredClone(snapshot);
    return replay;
  }

  get active(): boolean { return this.#state !== null; }

  start(fixture: FixtureId): SessionStart {
    if (this.active) throw new EngineErrorV2("STATE", "An engine is already active");
    if (!Object.hasOwn(FIXTURES_V2, fixture)) throw new EngineErrorV2("BAD_REQUEST", "Invalid fixture");
    try {
      const raw = FIXTURES_V2[fixture];
      const valid = validateScFen(raw);
      if (!valid.ok) throw new Error(valid.error.message);
      const state = this.#testState ? structuredClone(this.#testState) : parseScFen(raw);
      this.#testState = null;
      const result: SessionStart = { kind: "started", session: this.#identity + 1, fixture, initial: replayImageV2(state), outcome: replayOutcomeV2(state) };
      this.#state = state;
      this.#identity++;
      this.#ordinal = 0;
      this.#window = null;
      this.#begin = null;
      this.#failed = false;
      this.#terminalReported = false;
      return freezeV2(result);
    } catch { throw new EngineErrorV2("ENGINE_FAILURE", "Native engine initialization failed"); }
  }

  #require(session: number, failedAllowed = false): ScFenSnapshot {
    integerV2(session);
    if (this.#state === null || session !== this.#identity) throw new EngineErrorV2("STATE", "Unknown engine session");
    if (this.#failed && !failedAllowed) throw new EngineErrorV2("STATE", "Engine session failed", this.#window);
    return this.#state;
  }

  open(session: number, planningOrdinal: number): SessionOpen {
    integerV2(planningOrdinal);
    const before = this.#require(session);
    if (planningOrdinal !== this.#ordinal || this.#window !== null || this.#terminalReported) throw new EngineErrorV2("STALE_CONTEXT", "Repeated or out-of-sequence planning window", this.#window);
    try {
      const alreadyOver = replayOutcomeV2(before);
      if (alreadyOver) {
        this.#terminalReported = true;
        return freezeV2({ kind: "terminal", session, outcome: alreadyOver, image: replayImageV2(before), begin: null });
      }
      replayOpeningV2(before);
      const rawBegin = beginScTurn(structuredClone(before));
      const next: ScFenSnapshot = { ...structuredClone(rawBegin.next), stored: replayBankV2(before) };
      const outcome = replayOutcomeV2(next);
      const record: BeginRecord = freezeV2({ session, planningOrdinal, before: replayImageV2(before), after: replayImageV2(next), rawBegin: structuredClone(rawBegin), outcome });
      if (outcome !== null) {
        this.#state = next;
        this.#terminalReported = true;
        return freezeV2({ kind: "terminal", session, outcome, image: replayImageV2(next), begin: record });
      }
      replayOpeningV2(next);
      const views = { w: replayViewV2(next, "w"), b: replayViewV2(next, "b") };
      const context = { session, planningOrdinal, turn: next.turn };
      this.#state = next;
      this.#window = context;
      this.#begin = record;
      return freezeV2({ kind: "planning", context: { ...context }, views });
    } catch {
      this.#failed = true;
      throw new EngineErrorV2("ENGINE_FAILURE", "Native turn opening failed", this.#window);
    }
  }

  commit(contextValue: EngineContext, requestsValue: Pair<Action[]>): SessionCommit {
    const context = parseContextV2(contextValue);
    const requests = parseRequestsV2(requestsValue);
    const before = this.#require(context.session);
    if (!this.#window || !this.#begin || context.turn !== this.#window.turn || context.planningOrdinal !== this.#window.planningOrdinal) throw new EngineErrorV2("STALE_CONTEXT", "Stale planning context", this.#window);
    const begin = this.#begin;
    try {
      replayOpeningV2(before);
      const independentWhite = replayStageV2(before, requests, ["w"]);
      const independentBlack = replayStageV2(before, requests, ["b"]);
      const queued = replayStageV2(before, requests, ["w", "b"]);
      if (independentWhite.gas.w !== queued.gas.w || independentBlack.gas.b !== queued.gas.b ||
          replayBankV2(independentWhite).w !== replayBankV2(queued).w || replayBankV2(independentBlack).b !== replayBankV2(queued).b) throw new Error("Replay isolation mismatch");
      const rawResolve = endScTurn(structuredClone(queued), { skipTurnStartChecks: true });
      const debited = replayBankV2(queued);
      const funded = applyStoredIncome({ ...debited }, rawResolve.next.turn);
      const after: ScFenSnapshot = { ...structuredClone(rawResolve.next), stored: { ...funded } };
      const outcome = replayOutcomeV2(after);
      const result: SessionCommit = freezeV2({ kind: "committed", context, begin, settlement: {
        context: { ...context }, requests, before: replayImageV2(before), committed: replayImageV2(queued), after: replayImageV2(after),
        grants: { w: funded.w - debited.w, b: funded.b - debited.b }, rawResolve: structuredClone(rawResolve), outcome,
      } });
      this.#state = after;
      this.#begin = null;
      this.#window = null;
      this.#ordinal++;
      return result;
    } catch (error) {
      this.#failed = true;
      if (error instanceof ReplayRejectionV2) {
        const witness = freezeV2({ side: error.side, actionIndex: error.index, nativeCode: error.nativeCode, message: error.message, begin, requests,
          image: replayImageV2(before), outcome: replayOutcomeV2(before) });
        this.#begin = null;
        throw new EngineErrorV2("NATIVE_REJECTION", error.message, context, witness);
      }
      throw new EngineErrorV2("ENGINE_FAILURE", "Native settlement failed", context);
    }
  }

  close(session: number): SessionClose {
    const state = this.#require(session, true);
    const result: SessionClose = freezeV2({ kind: "closed", session, pendingBegin: this.#begin, image: replayImageV2(state), outcome: replayOutcomeV2(state) });
    this.#state = null;
    this.#window = null;
    this.#begin = null;
    return result;
  }
}
