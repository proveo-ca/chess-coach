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

  it("promoting onto enemy mine kills pawn — no deploy", () => {
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
    expect(r.resolved.promotions).toEqual([]);
    expect(placementToMap(r.next.placement).get("e8")).toBeUndefined();
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
