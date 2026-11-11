// SPEC: _spec/turn-resolution.puml
import { addScAction, beginScTurn, endScTurn, mapToPlacement } from "../src";
import type { ScActionInput, ScFenSnapshot, ScMine, ScPiece, Square } from "../src";

const c = (from: Square, to: Square): ScActionInput => ({ kind: "classical", timing: "C", color: "w", from, to });
const step = (timing: "B" | "F"): ScActionInput => ({ kind: "stimStep", timing, color: "w", from: "e2", to: "e3" });
const mine = (timing: "B" | "F"): ScActionInput => ({ kind: "spiderMine", timing, color: "w", from: "b3" });
const siege = (timing: "B" | "F"): ScActionInput => ({ kind: "siegeMode", timing, color: "w", from: "d3" });
const charon = (timing: "B" | "F"): ScActionInput => ({ kind: "charonMissiles", timing, color: "w", from: "c3", to: "f6" });
const jump = (timing: "B" | "F"): ScActionInput => ({ kind: "tacticalJump", timing, color: "w", from: "f3", to: "e4" });
const deploy = (timing: "B" | "F", unit: "p" | "n" | "b" | "r" | "q", to: Square = "d2"): ScActionInput =>
  ({ kind: "deploy", timing, color: "w", from: "e1", to, unit });

export const TURN_QUEUES: readonly (readonly ScActionInput[])[] = [
  [], [c("e2", "e3")], [c("e2", "e4")], [c("b3", "d4")], [c("c3", "f6")], [c("d3", "d6")], [c("f3", "f6")], [c("e1", "f1")],
  [step("B")], [step("F")], [mine("B")], [mine("F")], [siege("B")], [siege("F")], [charon("B")], [charon("F")], [jump("B")], [jump("F")],
  [step("B"), c("e2", "e4")], [c("e2", "e4"), step("B")], [c("e2", "e4"), step("F")], [step("F"), c("e2", "e4")],
  [step("B"), c("e2", "e4"), mine("F")], [mine("B"), c("b3", "d4")], [c("b3", "d4"), mine("F")], [mine("F"), c("b3", "d4")],
  [siege("B"), c("d3", "d6")], [c("d3", "d6"), siege("F")], [charon("B"), c("c3", "d4")], [c("c3", "d4"), charon("F")],
  [jump("B"), c("f3", "f6")], [c("f3", "f6"), jump("F")], [c("e1", "f1"), deploy("F", "p", "g2")],
  [deploy("B", "p"), c("d2", "d3")], [c("e2", "e4"), deploy("B", "p", "e2")], [deploy("B", "p", "e2"), c("e2", "e4")],
  [c("c1", "c6")],
  ...(["B", "F"] as const).flatMap(timing => (["p", "n", "b", "r", "q"] as const).map(unit => [deploy(timing, unit)])),
];

const mirror = (at: Square): Square => `${at[0]}${9 - Number(at[1])}` as Square;
export const turnQueueFor = (queue: readonly ScActionInput[], side: "w" | "b"): ScActionInput[] => queue.map(action => side === "w" ? { ...action }
  : { ...action, color: side, from: mirror(action.from), ...(action.to ? { to: mirror(action.to) } : {}) });

export function turnBase(variant: number): ScFenSnapshot {
  const board = new Map<Square, ScPiece>();
  for (const [at, type] of [["e1", "k"], ["e2", "p"], ["b3", "n"], ["c3", "b"], ["d3", "r"], ["f3", "q"]] as const) {
    board.set(at, { type, color: "w" });
    board.set(mirror(at), { type, color: "b" });
  }
  if (variant === 4) {
    board.delete("d3"); board.delete("d6");
    board.delete("c6");
    board.set("e6", { type: "b", color: "b" });
    board.set("c1", { type: "r", color: "w" });
    board.set("c8", { type: "r", color: "b" });
  }
  const mines: ScMine[] = variant === 1 ? [{ color: "b", at: "e3" }, { color: "w", at: "e6" }]
    : variant === 2 ? [{ color: "w", at: "e3" }, { color: "b", at: "e3" }, { color: "b", at: "e6" }, { color: "w", at: "e6" }]
      : variant === 3 ? [{ color: "b", at: "e4" }, { color: "w", at: "e5" }] : [];
  return { placement: mapToPlacement(board), turn: 21, phase: "P", ccLives: { w: 3, b: 3 },
    gas: { w: 3, b: 3 }, gasIncome: { w: 3, b: 3 }, stored: { w: 12, b: 12 }, queue: { actions: [] }, mines,
    ...(variant === 3 ? { siegedTanks: ["d3", "d6"] as Square[] } : {}) };
}

type TurnApi = { addScAction: typeof addScAction; beginScTurn: typeof beginScTurn; endScTurn: typeof endScTurn };
export type TurnCase = { variant: number; white: number; black: number };
export function turnCaseOutcome(request: TurnCase, api: TurnApi = { addScAction, beginScTurn, endScTurn }): unknown {
  try {
    const began = api.beginScTurn(turnBase(request.variant));
    if (began.next.phase === "O") return { kind: "terminal-open", began };
    let snapshot = began.next;
    for (const action of [...turnQueueFor(TURN_QUEUES[request.white]!, "w"), ...turnQueueFor(TURN_QUEUES[request.black]!, "b")]) {
      snapshot = api.addScAction({ snapshot, action }).snapshot;
    }
    const queued = structuredClone(snapshot);
    const ended = api.endScTurn(snapshot, { skipTurnStartChecks: true });
    if (JSON.stringify(snapshot) !== JSON.stringify(queued)) throw new Error("MUTATED_INPUT");
    return { kind: "settled", began, queued, ended };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return { kind: "rejected", name: error.name, code: "code" in error ? error.code : null, message: error.message };
  }
}
