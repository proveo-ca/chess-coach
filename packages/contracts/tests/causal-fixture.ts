// SPEC: _spec/causal-journal.puml
import { addScAction, mapToPlacement } from "@chess-coach/game-core";
import type { ScActionInput, ScFenSnapshot, ScPiece, Square } from "@chess-coach/game-core";
import { beginWithJournal, endWithJournal, seedCausalState } from "@chess-coach/game-core/causal-producer";

export function causalBoard(pieces: readonly (readonly [Square, ScPiece["type"], "w" | "b"])[], extra: Partial<ScFenSnapshot> = {}): ScFenSnapshot {
  return { placement: mapToPlacement(new Map(pieces.map(([at, type, color]) => [at, { type, color }]))), turn: 21, phase: "P",
    ccLives: { w: 3, b: 3 }, gas: { w: 3, b: 3 }, gasIncome: { w: 3, b: 3 }, stored: { w: 12, b: 12 }, queue: { actions: [] }, ...extra };
}
export function causalRun(snapshot = causalBoard([["a1", "r", "w"], ["e1", "k", "w"], ["a6", "p", "b"], ["h8", "k", "b"]]),
  actions: readonly ScActionInput[] = [{ kind: "classical", timing: "C", color: "w", from: "a1", to: "a8" }]) {
  const initial = seedCausalState(snapshot), began = beginWithJournal(snapshot, initial);
  let queued = began.result.next;
  for (const action of actions) queued = addScAction({ snapshot: queued, action }).snapshot;
  const ended = endWithJournal(queued, began.state, { skipTurnStartChecks: true });
  return { initial, snapshot, began, queued, ended };
}
