// SPEC: _spec/apps/arena/burn-compat.puml
import {
  AddScActionError, MAX_STORED_MATERIAL, UNIT_COST, addScAction, applyStoredIncome,
  assertQueueGas, beginScTurn, endScTurn, formatScFen, queueGasSpent, scOutcome, validateScFen,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";
import { fixtureV2 } from "./fixtures";
import { projectObservation } from "./observation";
import {
  EngineErrorV2, freezeV2, integerV2, parseContextV2, parseRequestsV2, parseViewV2,
  type Action, type Bank, type BeginRecord, type EngineContext, type FixtureId, type Outcome,
  type Pair, type SessionClose, type SessionCommit, type SessionOpen, type SessionStart, type Side, type StateImage,
} from "./wire-v2";

function bankV2(snapshot: ScFenSnapshot): Bank {
  const bank = snapshot.stored;
  if (!bank || ![bank.w, bank.b].every(n => Number.isSafeInteger(n) && n >= 0 && n <= MAX_STORED_MATERIAL)) throw new Error("Invalid retained bank");
  return { w: bank.w, b: bank.b };
}
const imageV2 = (snapshot: ScFenSnapshot): StateImage => ({ scfen: formatScFen(snapshot), bank: bankV2(snapshot) });
const outcomeV2 = (snapshot: ScFenSnapshot): Outcome | null => {
  const outcome = scOutcome(snapshot);
  return outcome ? { winner: outcome.winner, draw: outcome.draw === true } : null;
};
const openSnapshotV2 = (snapshot: ScFenSnapshot): void => {
  bankV2(snapshot);
  if (snapshot.phase !== "P" || !snapshot.queue || snapshot.queue.actions.length !== 0) throw new Error("Expected native planning opening");
  assertQueueGas(snapshot);
};

class QueueRejectionV2 extends Error {
  constructor(readonly side: Side, readonly index: number | null, readonly nativeCode: string, message: string) { super(message); }
}

function appendV2(opening: ScFenSnapshot, ordered: readonly { side: Side; index: number; action: Action }[]): ScFenSnapshot {
  let staged = structuredClone(opening);
  const bank = bankV2(opening);
  for (const { side, index, action } of ordered) {
    const minerals = action.kind === "deploy" && action.unit ? UNIT_COST[action.unit] : 0;
    if (bank[side] < minerals) throw new QueueRejectionV2(side, index, "SC_MINERALS", `Insufficient minerals for ${side}`);
    try { staged = addScAction({ snapshot: staged, action: structuredClone(action) }).snapshot; }
    catch (error) {
      if (error instanceof AddScActionError) throw new QueueRejectionV2(side, index, error.code, error.message);
      throw error;
    }
    bank[side] -= minerals;
    staged.stored = { ...bank };
  }
  assertQueueGas(staged);
  const spent = queueGasSpent(staged.queue?.actions);
  for (const side of ["w", "b"] as const) if (staged.gas[side] !== opening.gas[side] - spent[side]) throw new Error("Native gas accounting disagrees");
  if (staged.queue?.actions.some((a, i) => a.seq !== i)) throw new Error("Native sequence accounting disagrees");
  return staged;
}

function commitV2(opening: ScFenSnapshot, requests: Pair<Action[]>): ScFenSnapshot {
  openSnapshotV2(opening);
  const w = requests.w.map((action, index) => ({ side: "w" as const, index, action }));
  const b = requests.b.map((action, index) => ({ side: "b" as const, index, action }));
  const white = appendV2(opening, w);
  const black = appendV2(opening, b);
  const merged = appendV2(opening, [...w, ...b]);
  for (const [side, isolated] of [["w", white], ["b", black]] as const) {
    if (isolated.gas[side] !== merged.gas[side] || bankV2(isolated)[side] !== bankV2(merged)[side]) throw new Error("Isolated admission disagrees");
  }
  return merged;
}

export class PrivateSession {
  #snapshot: ScFenSnapshot | null = null;
  #testSnapshot: ScFenSnapshot | null = null;
  #session = 0;
  #ordinal = 0;
  #context: EngineContext | null = null;
  #pending: BeginRecord | null = null;
  #failed = false;
  #terminalOpened = false;

  static fromSnapshotForTest(snapshot: ScFenSnapshot): PrivateSession {
    const engine = new PrivateSession();
    const checked = validateScFen(formatScFen(snapshot));
    if (!checked.ok) throw new Error(checked.error.message);
    engine.#testSnapshot = structuredClone(snapshot);
    return engine;
  }

  get active(): boolean { return this.#snapshot !== null; }

  start(fixture: FixtureId): SessionStart {
    if (this.active) throw new EngineErrorV2("STATE", "An engine is already active");
    const initial = fixtureV2(fixture);
    const snapshot = this.#testSnapshot ? structuredClone(this.#testSnapshot) : initial;
    this.#testSnapshot = null;
    try {
      const result: SessionStart = { kind: "started", session: this.#session + 1, fixture, initial: imageV2(snapshot), outcome: outcomeV2(snapshot) };
      this.#snapshot = snapshot;
      this.#session++;
      this.#ordinal = 0;
      this.#context = null;
      this.#pending = null;
      this.#failed = false;
      this.#terminalOpened = false;
      return freezeV2(result);
    } catch { throw new EngineErrorV2("ENGINE_FAILURE", "Native engine initialization failed"); }
  }

  #get(session: number, allowFailed = false): ScFenSnapshot {
    integerV2(session);
    if (!this.#snapshot || session !== this.#session) throw new EngineErrorV2("STATE", "Unknown engine session");
    if (this.#failed && !allowFailed) throw new EngineErrorV2("STATE", "Engine session failed", this.#context);
    return this.#snapshot;
  }

  open(session: number, planningOrdinal: number): SessionOpen {
    integerV2(planningOrdinal);
    const snapshot = this.#get(session);
    if (planningOrdinal !== this.#ordinal || this.#context || this.#terminalOpened) throw new EngineErrorV2("STALE_CONTEXT", "Repeated or out-of-sequence planning window", this.#context);
    try {
      const initialOutcome = outcomeV2(snapshot);
      if (initialOutcome) {
        this.#terminalOpened = true;
        return freezeV2({ kind: "terminal", session, outcome: initialOutcome, image: imageV2(snapshot), begin: null });
      }
      openSnapshotV2(snapshot);
      const bank = bankV2(snapshot);
      const rawBegin = beginScTurn(structuredClone(snapshot));
      const next = { ...structuredClone(rawBegin.next), stored: { ...bank } };
      const outcome = outcomeV2(next);
      const begin: BeginRecord = freezeV2({ session, planningOrdinal, before: imageV2(snapshot), after: imageV2(next), rawBegin: structuredClone(rawBegin), outcome });
      if (outcome) {
        this.#snapshot = next;
        this.#terminalOpened = true;
        return freezeV2({ kind: "terminal", session, outcome, image: imageV2(next), begin });
      }
      openSnapshotV2(next);
      const views = {
        w: parseViewV2({ ...projectObservation(next, "w"), version: "arena-observation-v2" }),
        b: parseViewV2({ ...projectObservation(next, "b"), version: "arena-observation-v2" }),
      };
      const context = { session, planningOrdinal, turn: next.turn };
      this.#snapshot = next;
      this.#context = context;
      this.#pending = begin;
      return freezeV2({ kind: "planning", context: { ...context }, views });
    } catch (error) {
      this.#failed = true;
      throw error instanceof EngineErrorV2 && error.packet.code === "ENGINE_FAILURE" ? error : new EngineErrorV2("ENGINE_FAILURE", "Native turn opening failed", this.#context);
    }
  }

  commit(contextValue: EngineContext, requestsValue: Pair<Action[]>): SessionCommit {
    const context = parseContextV2(contextValue);
    const requests = parseRequestsV2(requestsValue);
    const opening = this.#get(context.session);
    if (!this.#context || !this.#pending || context.planningOrdinal !== this.#context.planningOrdinal || context.turn !== this.#context.turn) throw new EngineErrorV2("STALE_CONTEXT", "Stale planning context", this.#context);
    const begin = this.#pending;
    try {
      const committed = commitV2(opening, requests);
      const rawResolve = endScTurn(structuredClone(committed), { skipTurnStartChecks: true });
      const beforeBank = bankV2(committed);
      const afterBank = applyStoredIncome({ ...beforeBank }, rawResolve.next.turn);
      const after = { ...structuredClone(rawResolve.next), stored: { ...afterBank } };
      const outcome = outcomeV2(after);
      const result: SessionCommit = freezeV2({ kind: "committed", context, begin, settlement: {
        context: { ...context }, requests, before: imageV2(opening), committed: imageV2(committed), after: imageV2(after),
        grants: { w: afterBank.w - beforeBank.w, b: afterBank.b - beforeBank.b }, rawResolve: structuredClone(rawResolve), outcome,
      } });
      this.#snapshot = after;
      this.#context = null;
      this.#pending = null;
      this.#ordinal++;
      return result;
    } catch (error) {
      this.#failed = true;
      if (error instanceof QueueRejectionV2) {
        const witness = freezeV2({ side: error.side, actionIndex: error.index, nativeCode: error.nativeCode, message: error.message, begin,
          requests, image: imageV2(opening), outcome: outcomeV2(opening) });
        this.#pending = null;
        throw new EngineErrorV2("NATIVE_REJECTION", error.message, context, witness);
      }
      throw new EngineErrorV2("ENGINE_FAILURE", "Native settlement failed", context);
    }
  }

  close(session: number): SessionClose {
    const snapshot = this.#get(session, true);
    const result: SessionClose = freezeV2({ kind: "closed", session, pendingBegin: this.#pending, image: imageV2(snapshot), outcome: outcomeV2(snapshot) });
    this.#snapshot = null;
    this.#pending = null;
    this.#context = null;
    return result;
  }
}
