import { describe, expect, it } from "vitest";

import {
  addScAction,
  adjacentSquares,
  endScTurn,
  parseScFen,
  spawnKingAnchor,
} from "../src/index.ts";

describe("spawnKingAnchor", () => {
  it("B timing uses the living king ring", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const { king, occupied } = spawnKingAnchor(snap, "w", "B");
    expect(king).toBe("e1");
    expect(adjacentSquares(king!, occupied).sort()).toEqual(
      ["d1", "d2", "e2", "f1", "f2"].sort(),
    );
  });

  it("F timing centers the ring on the post-classical king square", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e1",
        to: "e2",
      },
    }).snapshot;
    const { king, occupied } = spawnKingAnchor(snap, "w", "F");
    expect(king).toBe("e2");
    // Vacated e1 is empty and adjacent to the post-move king.
    expect(adjacentSquares(king!, occupied)).toContain("e1");
    expect(adjacentSquares(king!, occupied)).not.toContain("e2");
  });

  it("queues F spawn onto the vacated king square after classical", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e1",
        to: "e2",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "F",
        kind: "spawn",
        color: "w",
        from: "e1",
        to: "e1",
        unit: "p",
      },
    }).snapshot;
    const { next } = endScTurn(snap, { skipTurnStartChecks: true });
    expect(next.placement).toMatch(/.*P.*/); // marine landed
    // King on e2, pawn back on e1.
    expect(next.placement.split("/")[6]).toContain("K"); // rank 2
  });
});
