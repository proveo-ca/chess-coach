// SPEC: _spec/turn-resolution.puml
import { expect, test } from "bun:test";
import { addScAction, beginScTurn, createCanonicalGame, endScTurn, mapToPlacement, placementToMap } from "../src";
import type { ScActionInput, ScFenSnapshot, ScPiece, Square } from "../src";

function fixture(pieces: readonly (readonly [Square, ScPiece["type"], "w" | "b"])[]): ScFenSnapshot {
  return { placement: mapToPlacement(new Map(pieces.map(([at, type, color]) => [at, { type, color }]))),
    turn: 21, phase: "P", ccLives: { w: 3, b: 3 }, gas: { w: 3, b: 3 }, gasIncome: { w: 3, b: 3 }, stored: { w: 12, b: 12 }, queue: { actions: [] } };
}
function queued(snapshot: ScFenSnapshot, actions: readonly ScActionInput[]): ScFenSnapshot {
  for (const action of actions) snapshot = addScAction({ snapshot, action }).snapshot;
  return snapshot;
}

test("canonical init, open and pass settlement use actual kernels without changing input banks", () => {
  const { snapshot } = createCanonicalGame(), before = structuredClone(snapshot);
  const began = beginScTurn(snapshot);
  expect(began.changed).toBe(false);
  expect(began.next.stored).toEqual({ w: 3, b: 3 });
  const ended = endScTurn(began.next, { skipTurnStartChecks: true });
  expect(ended.next).toMatchObject({ placement: snapshot.placement, turn: 1, phase: "P", gas: { w: 0, b: 0 }, gasIncome: { w: 1, b: 1 } });
  expect(ended.events).toEqual([]);
  expect(ended.resolved.moves).toEqual([]);
  expect(snapshot).toEqual(before);
  expect(beginScTurn(ended.next).next.gas).toEqual({ w: 1, b: 1 });
});

test("B Marine transfer preserves positional double eligibility without public override flags", () => {
  const base = fixture([["e1", "k", "w"], ["h8", "k", "b"], ["e2", "p", "w"]]);
  const snapshot = queued(base, [
    { kind: "stimStep", timing: "B", color: "w", from: "e2", to: "e3" },
    { kind: "classical", timing: "C", color: "w", from: "e2", to: "e4" },
  ]);
  const ended = endScTurn(snapshot);
  expect(placementToMap(ended.afterB.placement).get("e3")).toEqual({ type: "p", color: "w" });
  expect(ended.resolved.moves).toEqual([{ piece: "p", color: "w", from: "e3", to: "e5" }]);
  expect(placementToMap(ended.next.placement).get("e5")).toEqual({ type: "p", color: "w" });
  expect(ended.queue).toEqual(snapshot.queue!.actions);
});

test("a held B mine follows the Marine to its true classical destination", () => {
  const base = fixture([["e1", "k", "w"], ["h8", "k", "b"], ["e2", "p", "w"]]);
  base.mines = [{ color: "b", at: "e3" }];
  const ended = endScTurn(queued(base, [
    { kind: "stimStep", timing: "B", color: "w", from: "e2", to: "e3" },
    { kind: "classical", timing: "C", color: "w", from: "e2", to: "e4" },
  ]));
  expect(ended.resolved.mineTriggers).toEqual([{ kind: "mineBlast", piece: "p", color: "w", from: "e3", to: "e5", mineColor: "b",
    victim: { piece: "p", color: "w" }, chaseFrom: "e3" }]);
  expect(placementToMap(ended.next.placement).has("e5")).toBe(false);
  expect(ended.next.mines ?? []).toEqual([]);
});

test("blocked rewrite settles the held mine at the B arrival instead of inventing a continuation", () => {
  const base = fixture([["e1", "k", "w"], ["h8", "k", "b"], ["e2", "p", "w"], ["e5", "p", "b"]]);
  base.mines = [{ color: "b", at: "e3" }];
  const ended = endScTurn(queued(base, [
    { kind: "stimStep", timing: "B", color: "w", from: "e2", to: "e3" },
    { kind: "classical", timing: "C", color: "w", from: "e2", to: "e4" },
  ]));
  expect(ended.bMoves).toHaveLength(1);
  expect(ended.resolved.moves).toEqual([]);
  expect(ended.events[0]).toMatchObject({ phase: "specialBefore", victim: { type: "p", color: "w" }, mineColor: "b" });
  expect(placementToMap(ended.next.placement).has("e3")).toBe(false);
});

test("F Marine step follows its own classical actor and holds a landing mine through the final hop", () => {
  const base = fixture([["e1", "k", "w"], ["h8", "k", "b"], ["e2", "p", "w"]]);
  base.mines = [{ color: "b", at: "e4" }];
  const ended = endScTurn(queued(base, [
    { kind: "classical", timing: "C", color: "w", from: "e2", to: "e4" },
    { kind: "stimStep", timing: "F", color: "w", from: "e2", to: "e3" },
  ]));
  expect(ended.fMoves).toEqual([{ piece: "p", color: "w", from: "e4", to: "e5" }]);
  expect(ended.events.at(-1)).toMatchObject({ phase: "specialAfter", from: "e4", to: "e5", mineColor: "b", chaseFrom: "e4" });
  expect(placementToMap(ended.next.placement).has("e5")).toBe(false);
});

test("F-before-C authored order retains the canonical unpromoted last-rank Marine", () => {
  const base = fixture([["a1", "k", "w"], ["h8", "k", "b"], ["e6", "p", "w"]]);
  const ended = endScTurn(queued(base, [
    { kind: "stimStep", timing: "F", color: "w", from: "e6", to: "e7" },
    { kind: "classical", timing: "C", color: "w", from: "e6", to: "e7" },
  ]));
  expect(placementToMap(ended.next.placement).get("e8")).toEqual({ type: "p", color: "w" });
  expect(ended.resolved.promotions).toEqual([]);
});

test("F deployment anchors on the same Command Center's actual classical result", () => {
  const base = fixture([["e1", "k", "w"], ["h8", "k", "b"]]);
  const ended = endScTurn(queued(base, [
    { kind: "classical", timing: "C", color: "w", from: "e1", to: "f1" },
    { kind: "deploy", timing: "F", color: "w", from: "e1", to: "g2", unit: "q" },
  ]));
  const board = placementToMap(ended.next.placement);
  expect(board.get("f1")).toEqual({ type: "k", color: "w" });
  expect(board.get("g2")).toEqual({ type: "q", color: "w" });
  expect(ended.events.at(-1)).toMatchObject({ kind: "deploy", phase: "specialAfter", from: "f1", to: "g2" });
});

test("paid F Charon remains fire-and-forget after the Mecha dies", () => {
  const base = fixture([["e1", "k", "w"], ["h8", "k", "b"], ["c3", "b", "w"], ["c8", "r", "b"], ["f6", "q", "b"]]);
  const ended = endScTurn(queued(base, [
    { kind: "charonMissiles", timing: "F", color: "w", from: "c3", to: "f6" },
    { kind: "classical", timing: "C", color: "b", from: "c8", to: "c3" },
  ]));
  expect(placementToMap(ended.resolved.afterAll.placement).get("f6")?.type).toBe("q");
  expect(placementToMap(ended.next.placement).has("f6")).toBe(false);
  expect(placementToMap(ended.next.placement).get("c3")).toEqual({ type: "r", color: "b" });
  expect(ended.events.at(-1)).toMatchObject({ kind: "charonMissiles", from: "c3", to: "f6", victim: { type: "q", color: "b" } });
});

test("B siege fires in place and F siege follows its own moved Tank", () => {
  const base = fixture([["e1", "k", "w"], ["h8", "k", "b"], ["d3", "r", "w"], ["d6", "p", "b"]]);
  const before = endScTurn(queued(base, [
    { kind: "siegeMode", timing: "B", color: "w", from: "d3" },
    { kind: "classical", timing: "C", color: "w", from: "d3", to: "d6" },
  ]));
  expect(before.resolved.moves).toEqual([]);
  expect(placementToMap(before.next.placement).get("d3")?.type).toBe("r");
  expect(placementToMap(before.next.placement).has("d6")).toBe(false);
  const after = endScTurn(queued(base, [
    { kind: "classical", timing: "C", color: "w", from: "d3", to: "d4" },
    { kind: "siegeMode", timing: "F", color: "w", from: "d3" },
  ]));
  expect(after.next.siegedTanks).toEqual(["d4"]);
});

test("two B jumps onto one initially empty tile destroy both ships", () => {
  const base = fixture([["e1", "k", "w"], ["e8", "k", "b"], ["f3", "q", "w"], ["f6", "q", "b"]]);
  const ended = endScTurn(queued(base, [
    { kind: "tacticalJump", timing: "B", color: "w", from: "f3", to: "e4" },
    { kind: "tacticalJump", timing: "B", color: "b", from: "f6", to: "e4" },
  ]));
  expect(ended.events.at(-1)).toMatchObject({ victim: { type: "q", color: "w" }, collider: { type: "q", color: "b" } });
  expect([...placementToMap(ended.next.placement).values()].filter(piece => piece.type === "q")).toEqual([]);
});

test("F mines migrate only with the arming Hoverbike's own classical action", () => {
  const base = fixture([["e1", "k", "w"], ["h8", "k", "b"], ["e2", "p", "w"], ["b3", "n", "w"]]);
  const own = endScTurn(queued(base, [
    { kind: "classical", timing: "C", color: "w", from: "b3", to: "d4" },
    { kind: "spiderMine", timing: "F", color: "w", from: "b3" },
  ]));
  expect(own.next.mines).toEqual([{ color: "w", at: "d4" }]);
  const other = endScTurn(queued(base, [
    { kind: "classical", timing: "C", color: "w", from: "e2", to: "e4" },
    { kind: "spiderMine", timing: "F", color: "w", from: "b3" },
  ]));
  expect(other.next.mines).toEqual([{ color: "w", at: "b3" }]);
});

test("terminal turn-open chips advance once without a planning queue or hidden grant", () => {
  const base = fixture([["a1", "k", "w"], ["b1", "k", "b"]]);
  base.ccLives = { w: 1, b: 1 };
  const before = structuredClone(base), began = beginScTurn(base);
  expect(began.changed).toBe(true);
  expect(began.next).toMatchObject({ phase: "O", turn: 22, ccLives: { w: 0, b: 0 }, queue: { actions: [] } });
  expect(began.asResolve?.resolved.attacks).toHaveLength(2);
  expect(base).toEqual(before);
  expect(() => beginScTurn(began.next)).toThrow("requires phase P");
  expect(() => endScTurn(began.next)).toThrow("requires phase P");
});
