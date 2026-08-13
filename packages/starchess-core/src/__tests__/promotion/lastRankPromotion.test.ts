/**
 * Last-rank promotion, classical pass: a pawn promotes only with a chosen unit.
 * Gas routes onto the last rank live in `gas/gasLastRank.test.ts`; mine contact
 * lives in `mine/`.
 */
import { describe, expect, it } from "vitest";

import {
  addScAction,
  endScTurn,
  parseScFen,
  placementToMap,
} from "@chess-coach/starchess-core";

describe("last-rank promotion (classical)", () => {
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



  it("rejects classical last-rank without a promotion choice", () => {
    const snap = parseScFen(
      "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    expect(() =>
      addScAction({
        snapshot: snap,
        action: {
          timing: "C",
          kind: "classical",
          color: "w",
          from: "e7",
          to: "e8",
        },
      }),
    ).toThrow(/promotion/i);
  });



  /** `demos/attackMine` — DualNav "attack mine then occupy" package. */
});
