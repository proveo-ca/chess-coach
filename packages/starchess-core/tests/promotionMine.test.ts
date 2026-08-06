import { describe, expect, it } from "vitest";

import {
  addScAction,
  endScTurn,
  parseScFen,
  placementToMap,
  specialGasCost,
  SPECIAL_REGISTRY,
} from "@chess-coach/starchess-core";

describe("core promotion / mine (package)", () => {
  it("clean last-rank move promotes after landing as a pawn", () => {
    const start = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    const queued = addScAction({
      snapshot: start,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "q",
      },
    }).snapshot;
    const r = endScTurn(queued);
    expect(r.resolved.moves).toEqual([
      { piece: "p", color: "w", from: "e7", to: "e8" },
    ]);
    expect(r.resolved.promotions).toEqual([
      { color: "w", from: "e7", at: "e8", unit: "q" },
    ]);
    expect(placementToMap(r.next.placement).get("e8")).toEqual({
      type: "q",
      color: "w",
    });
  });

  it("gas + promote does not stamp U: on the deployed unit", () => {
    let snap = parseScFen(
      "SCFEN|k7/8/4P3/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "pawnDouble",
        color: "w",
        from: "e6",
        to: "e7",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e6",
        to: "e7",
        promotion: "q",
      },
    }).snapshot;
    const r = endScTurn(snap);
    expect(r.resolved.promotions.length).toBe(1);
    expect(placementToMap(r.next.placement).get("e8")).toEqual({
      type: "q",
      color: "w",
    });
    expect(r.next.specialsUsed ?? []).not.toContain("e8");
  });

  it("promoting onto enemy mine: walk-over trigger — no attack, no deploy", () => {
    const start = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|M:b:e8|Q:w:;b:",
    );
    const queued = addScAction({
      snapshot: start,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "q",
      },
    }).snapshot;
    const r = endScTurn(queued);
    // Pawn cannot attack straight ahead — no attack-phase mine blast.
    expect(r.resolved.attacks.filter((a) => a.kind === "mineBlast")).toEqual([]);
    expect(r.resolved.moves).toEqual([
      { piece: "p", color: "w", from: "e7", to: "e8" },
    ]);
    expect(r.resolved.mineTriggers).toEqual([
      expect.objectContaining({
        kind: "mineBlast",
        piece: "p",
        color: "w",
        from: "e7",
        to: "e8",
        mineColor: "b",
        victim: { piece: "p", color: "w" },
      }),
    ]);
    expect(r.resolved.promotions).toEqual([]);
    expect(placementToMap(r.next.placement).get("e8")).toBeUndefined();
    expect(r.next.mines ?? []).toEqual([]);
  });

  it("knight attack-clears a hostile mine then occupies", () => {
    const start = parseScFen(
      "SCFEN|7k/8/8/8/8/8/8/3NK3|0|33|P|G:11:11|M:b:c3|Q:w:;b:",
    );
    const queued = addScAction({
      snapshot: start,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "d1",
        to: "c3",
      },
    }).snapshot;
    const r = endScTurn(queued);
    expect(r.resolved.attacks).toEqual([
      expect.objectContaining({
        kind: "mineBlast",
        piece: "n",
        from: "d1",
        to: "c3",
        mineColor: "b",
      }),
    ]);
    expect(r.resolved.moves).toEqual([
      { piece: "n", color: "w", from: "d1", to: "c3" },
    ]);
    expect(r.resolved.mineTriggers).toEqual([]);
    expect(placementToMap(r.next.placement).get("c3")).toEqual({
      type: "n",
      color: "w",
    });
  });
});

describe("special registry", () => {
  it("exposes gas costs for every special kind", () => {
    expect(specialGasCost("spawn")).toBe(SPECIAL_REGISTRY.spawn.gasCost);
    expect(specialGasCost("bishopSnipe")).toBe(2);
    expect(specialGasCost("queenWarp")).toBe(2);
    expect(specialGasCost("pawnDouble")).toBe(1);
  });
});
