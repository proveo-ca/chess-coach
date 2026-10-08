// SPEC: _spec/packages/starchess-core/submit-turn-activity.puml, _spec/packages/starchess-core/resolve-turn-activity.puml
import { describe, expect, it } from "vitest";
import { addScAction, beginScTurn, endScTurn, parseScFen, placementToMap, type ScActionInput } from "../index";

function settle(fen: string, actions: ScActionInput[]) {
  const opening = parseScFen(fen);
  let snapshot = beginScTurn(opening).next;
  for (const action of actions) snapshot = addScAction({ snapshot, action }).snapshot;
  const committed = structuredClone(snapshot);
  const result = endScTurn(snapshot, { skipTurnStartChecks: true });
  expect(snapshot).toStrictEqual(committed);
  return { opening, committed, result };
}

describe("current own Marine gas promotion", () => {
  it("preserves the held opponent replacement in the exact accepted reproduction", () => {
    const { committed, result } = settle("SCFEN|5p2/4Pk2/8/8/8/8/8/K7|0|33|P|G:11:11|B:3:3|Q:w:;b:", [
      { kind: "stimStep", timing: "B", color: "w", from: "e7", to: "e8", promotion: "q" },
      { kind: "classical", timing: "C", color: "w", from: "e7", to: "f8", promotion: "q" },
      { kind: "deploy", timing: "B", color: "b", from: "f7", to: "e8", unit: "p" },
    ]);
    expect(committed.queue?.actions).toStrictEqual([
      { kind: "stimStep", timing: "B", color: "w", from: "e7", to: "e8", promotion: "q", seq: 0 },
      { kind: "classical", timing: "C", color: "w", from: "e7", to: "f8", promotion: "q", seq: 1 },
      { kind: "deploy", timing: "B", color: "b", from: "f7", to: "e8", unit: "p", seq: 2 },
    ]);
    expect(committed.stored).toStrictEqual({ w: 3, b: 3 });
    expect(committed.gas).toStrictEqual({ w: 0, b: 0 });
    expect(result.afterPending.placement).toBe("5p2/4Pk2/8/8/8/8/8/K7");
    for (const placement of [result.afterB.placement, result.resolved.afterAttack.placement, result.resolved.afterMove.placement, result.resolved.afterAll.placement, result.next.placement]) expect(placement).toBe("4pp2/5k2/8/8/8/8/8/K7");
    expect(result.resolved.promotions).toStrictEqual([]);
    expect(result.next).toStrictEqual({ placement: "4pp2/5k2/8/8/8/8/8/K7", turn: 1, phase: "P", ccLives: { w: 3, b: 3 }, gas: { w: 0, b: 0 }, gasIncome: { w: 1, b: 1 }, queue: { actions: [] }, specialsUsed: ["e8", "f7"] });
    expect(result.events).toStrictEqual([
      { id: "ev-0", phase: "specialBefore", color: "w", from: "e7", to: "e8", kind: "stimStep" },
      { id: "ev-1", phase: "specialBefore", color: "b", from: "f7", to: "e8", kind: "deploy", unit: "p", victim: { type: "p", color: "w" } },
    ]);
    expect(result.bMoves).toStrictEqual([{ piece: "p", color: "w", from: "e7", to: "e8" }]);
    for (const list of [result.fMoves, result.resolved.moves, result.resolved.attacks, result.resolved.pathRevealAttacks, result.resolved.mineTriggers, result.resolved.pathRevealMineTriggers, result.resolved.moveCollisions]) expect(list).toStrictEqual([]);
  });

  it("promotes the actual same-side replacement instead of pinning the original identity", () => {
    const { result } = settle("SCFEN|k4p2/4PK2/8/8/8/8/8/8|11|33|P|G:22:22|B:3:3|Q:w:;b:", [
      { kind: "stimStep", timing: "B", color: "w", from: "e7", to: "e8", promotion: "q" },
      { kind: "deploy", timing: "B", color: "w", from: "f7", to: "e8", unit: "p" },
      { kind: "classical", timing: "C", color: "w", from: "e7", to: "f8", promotion: "q" },
    ]);
    expect(placementToMap(result.next.placement).get("e8")).toStrictEqual({ type: "q", color: "w" });
    expect(result.resolved.promotions).toStrictEqual([{ color: "w", from: "e7", at: "e8", unit: "q" }]);
  });

  it("does not recolor a replacement moved by the existing immediate B path", () => {
    const { result } = settle("SCFEN|7k/8/8/8/8/8/3Kp3/8|11|33|P|G:22:22|B:3:3|Q:w:;b:", [
      { kind: "deploy", timing: "B", color: "w", from: "d2", to: "e2", unit: "p" },
      { kind: "stimStep", timing: "B", color: "b", from: "e2", to: "e1", promotion: "q" },
    ]);
    expect(result.resolved.promotions).toStrictEqual([]);
    expect(placementToMap(result.next.placement).get("e1")).toStrictEqual({ type: "p", color: "w" });
    expect(placementToMap(result.next.placement).has("e2")).toBe(false);
  });

  it.each([
    { side: "w" as const, fen: "k7/4P3/8/8/8/8/8/K7", from: "e7" as const, to: "e8" as const },
    { side: "b" as const, fen: "7k/8/8/8/8/8/4p3/K7", from: "e2" as const, to: "e1" as const },
  ])("keeps legitimate immediate/F/C promotion for $side", ({ side, fen, from, to }) => {
    for (const timing of ["B", "F", "C"] as const) {
      const { result } = settle(`SCFEN|${fen}|11|33|P|G:22:22|Q:w:;b:`, [timing === "C"
        ? { kind: "classical", timing, color: side, from, to, promotion: "q" }
        : { kind: "stimStep", timing, color: side, from, to, promotion: "q" }]);
      expect(placementToMap(result.next.placement).get(to)).toStrictEqual({ type: "q", color: side });
      expect(result.resolved.promotions).toStrictEqual([{ color: side, from, at: to, unit: "q" }]);
    }
  });

  it("does not promote a Marine removed by its last-rank mine", () => {
    const { result } = settle("SCFEN|k7/4P3/8/8/8/8/8/K7|11|33|P|G:22:22|Q:w:;b:|M:w:;b:e8", [
      { kind: "stimStep", timing: "B", color: "w", from: "e7", to: "e8", promotion: "q" },
    ]);
    expect(result.resolved.promotions).toStrictEqual([]);
    expect(placementToMap(result.next.placement).has("e8")).toBe(false);
    expect(result.next.mines).toBeUndefined();
  });

  it.each(["n", "r", "q"] as const)("does not promote a held non-Marine replacement %s", unit => {
    const { result } = settle("SCFEN|k4p2/4PK2/8/8/8/8/8/8|21|33|P|G:33:33|B:12:12|Q:w:;b:", [
      { kind: "stimStep", timing: "B", color: "w", from: "e7", to: "e8", promotion: "q" },
      { kind: "deploy", timing: "B", color: "w", from: "f7", to: "e8", unit },
      { kind: "classical", timing: "C", color: "w", from: "e7", to: "f8", promotion: "q" },
    ]);
    expect(result.resolved.promotions).toStrictEqual([]);
    expect(placementToMap(result.next.placement).get("e8")).toStrictEqual({ type: unit, color: "w" });
  });

  it.each([
    { color: "w" as const, placement: "k4p2/4P3/8/8/8/8/8/7K", from: "e7" as const, to: "e8" as const, target: "f8" as const },
    { color: "b" as const, placement: "k6K/8/8/8/8/8/4p3/3P4", from: "e2" as const, to: "e1" as const, target: "d1" as const },
  ])("keeps legitimate held B promotion for $color", ({ color, placement, from, to, target }) => {
    const { result } = settle(`SCFEN|${placement}|11|33|P|G:22:22|Q:w:;b:`, [
      { kind: "stimStep", timing: "B", color, from, to, promotion: "q" },
      { kind: "classical", timing: "C", color, from, to: target, promotion: "q" },
    ]);
    expect(result.resolved.promotions).toStrictEqual([{ color, from, at: to, unit: "q" }]);
    expect(placementToMap(result.next.placement).get(to)).toStrictEqual({ type: "q", color });
  });
});
