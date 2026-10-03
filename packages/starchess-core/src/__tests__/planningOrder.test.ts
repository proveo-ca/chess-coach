// SPEC: _spec/packages/starchess-core/turn-queue-sequence.puml, _spec/packages/starchess-training/candidate-generation.puml
import { describe, expect, it } from "vitest";
import {
  addScAction,
  classicalRewriteCoordinatesAfterB,
  endScTurn,
  orderBHeadsFirst,
  placementToMap,
  rewriteClassicalAfterB,
  snapFromPlacement,
  type PieceColor,
  type ScAction,
  type ScActionInput,
  type Square,
} from "../index";

const classical = (from: Square, to: Square, color: PieceColor = "w"):
  Extract<ScActionInput, { timing: "C" }> => ({ timing: "C", kind: "classical", color, from, to });
const before = (kind: "stimStep" | "tacticalJump", from: Square, to: Square, color: PieceColor = "w"):
  ScActionInput => ({ timing: "B", kind, from, to, color });
const sequenced = (actions: readonly ScActionInput[]): ScAction[] => actions.map((a, seq) => ({ ...a, seq }));

describe("classicalRewriteCoordinatesAfterB", () => {
  it.each([
    ["d1", "d2", "d3", "d4", "w"],
    ["d2", "d3", "d4", "d5", "w"],
    ["d3", "d4", "d4", "d5", "w"],
    ["d8", "d7", "d6", "d5", "b"],
    ["d7", "d6", "d5", "d4", "b"],
  ] as const)("rewrites %s B→%s C→%s as %s for %s", (from, bTo, cTo, to, color) => {
    expect(classicalRewriteCoordinatesAfterB([before("stimStep", from, bTo, color)], classical(from, cTo, color)))
      .toEqual({ from: bTo, to });
  });

  it.each([
    ["d3", "d4", "d5"],
    ["d3", "d4", "d2"],
    ["d3", "d4", "e4"],
    ["d7", "d8", "d8"],
  ] as const)("declines ineligible/off-board stim %s→%s + %s", (from, bTo, cTo) => {
    expect(classicalRewriteCoordinatesAfterB([before("stimStep", from, bTo)], classical(from, cTo))).toBeNull();
  });

  it("matches the authored same-side origin and first B, without seq fields", () => {
    const prefix = [before("stimStep", "d2", "d3", "b"), before("stimStep", "c2", "d3"),
      before("stimStep", "d2", "d3"), before("stimStep", "d2", "d4")];
    expect(classicalRewriteCoordinatesAfterB(prefix, classical("d2", "d3"))).toEqual({ from: "d3", to: "d4" });
    expect(classicalRewriteCoordinatesAfterB(prefix, classical("d3", "d4"))).toBeNull();
    expect(classicalRewriteCoordinatesAfterB([{ ...before("stimStep", "d2", "d3"), timing: "F" }], classical("d2", "d3")))
      .toBeNull();
  });

  it("rewrites jump coordinates only when B.to equals C.to", () => {
    const prefix = [before("tacticalJump", "c3", "e5")];
    expect(classicalRewriteCoordinatesAfterB(prefix, classical("c3", "e5"))).toEqual({ from: "e5", to: "g7" });
    expect(classicalRewriteCoordinatesAfterB(prefix, classical("c3", "d4"))).toBeNull();
    expect(classicalRewriteCoordinatesAfterB([before("tacticalJump", "c3", "g7")], classical("c3", "g7")))
      .toBeNull();
  });

  it("keeps potential stim coordinates while native occupancy declines to the original queue", () => {
    const prefix = [before("stimStep", "d2", "d3")];
    const c = classical("d2", "d3");
    const actions = sequenced([...prefix, c]);
    expect(classicalRewriteCoordinatesAfterB(prefix, c)).toEqual({ from: "d3", to: "d4" });
    expect(rewriteClassicalAfterB(actions, "4k3/8/8/8/8/3P4/8/4K3")[1])
      .toEqual({ ...c, from: "d3", to: "d4", seq: 1 });
    expect(rewriteClassicalAfterB(actions, "4k3/8/8/8/3r4/3P4/8/4K3")).toEqual(actions);
    expect(actions[1]).toEqual({ ...c, seq: 1 });
  });

  it("retains jump rewrite on occupied continuation squares", () => {
    const actions = sequenced([before("tacticalJump", "c3", "e5"), classical("c3", "e5")]);
    expect(rewriteClassicalAfterB(actions, "4k3/6r1/8/4Q3/8/8/8/4K3")[1])
      .toMatchObject({ from: "e5", to: "g7" });
  });

  it("carries promotion unchanged through a clear B rewrite and resolves a Tank", () => {
    let snap = snapFromPlacement("k7/8/4P3/8/8/8/8/4K3", 1);
    snap = addScAction({ snapshot: snap, action: before("stimStep", "e6", "e7") }).snapshot;
    snap = addScAction({ snapshot: snap, action: { ...classical("e6", "e7"), promotion: "r" } }).snapshot;
    const result = endScTurn(snap);
    expect(result.resolved.promotions).toEqual([{ color: "w", from: "e7", at: "e8", unit: "r" }]);
    expect(placementToMap(result.next.placement).get("e8")).toEqual({ color: "w", type: "r" });
    expect(result.next.specialsUsed ?? []).not.toContain("e8");
  });

  it("preserves blocked stim landing and missing shifted-promotion resolution error", () => {
    const queue = sequenced([before("stimStep", "e6", "e7"), classical("e6", "e7")]);
    const blocked = endScTurn({ ...snapFromPlacement("k3r3/8/4P3/8/8/8/8/4K3", 1), queue: { actions: queue } },
      { skipTurnStartChecks: true });
    expect(placementToMap(blocked.next.placement).get("e7")).toEqual({ type: "p", color: "w" });
    expect(blocked.resolved.promotions).toEqual([]);
    expect(() => endScTurn({ ...snapFromPlacement("k7/8/4P3/8/8/8/8/4K3", 1), queue: { actions: queue } }))
      .toThrow("endScTurn: classical last-rank e7→e8 needs promotion");
  });
});

describe("orderBHeadsFirst", () => {
  it("orders chain heads before tails without mutating seq or input", () => {
    const actions = sequenced([before("stimStep", "e2", "e3"), before("stimStep", "e3", "e4"),
      before("stimStep", "e4", "e5")]);
    expect(orderBHeadsFirst(actions).map((a) => a.seq)).toEqual([2, 1, 0]);
    expect(actions.map((a) => a.seq)).toEqual([0, 1, 2]);
  });

  it("uses stable seq fallback for cycles and keeps nonrelocations eligible", () => {
    const actions = sequenced([before("tacticalJump", "a1", "b2"), before("tacticalJump", "b2", "a1"),
      { timing: "B", kind: "siegeMode", color: "w", from: "c1" }]);
    expect(orderBHeadsFirst([...actions].reverse()).map((a) => a.seq)).toEqual([2, 0, 1]);
    expect(orderBHeadsFirst(actions.slice(0, 2)).map((a) => a.seq)).toEqual([0, 1]);
  });
});
