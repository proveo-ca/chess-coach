// SPEC: _spec/turn-resolution.puml
import { expect, test } from "bun:test";
import { addScAction, beginScTurn, createCanonicalGame, endScTurn, placementToMap } from "../src";

test("both seats submit to one common opened board and settle through actual B/C/F kernels", () => {
  const initial = createCanonicalGame();
  const began = beginScTurn(initial.snapshot);
  let snapshot = began.next;
  snapshot = addScAction({ snapshot, action: { kind: "stimStep", timing: "B", color: "w", from: "e2", to: "e3" } }).snapshot;
  snapshot = addScAction({ snapshot, action: { kind: "classical", timing: "C", color: "w", from: "e2", to: "e4" } }).snapshot;
  snapshot = addScAction({ snapshot, action: { kind: "classical", timing: "C", color: "b", from: "e7", to: "e5" } }).snapshot;
  const accepted = structuredClone(snapshot);
  const ended = endScTurn(snapshot, { skipTurnStartChecks: true });
  expect(snapshot).toEqual(accepted);
  expect(ended.bMoves).toEqual([{ piece: "p", color: "w", from: "e2", to: "e3" }]);
  expect(ended.resolved.moveCollisions).toHaveLength(2);
  const board = placementToMap(ended.next.placement);
  expect(board.has("e5")).toBe(false);
  expect(board.has("e7")).toBe(false);
  expect(ended.next.turn).toBe(1);
  expect(ended.next.ccLives).toEqual({ w: 3, b: 3 });
  expect(ended.queue).toHaveLength(3);
});
