import { describe, expect, it } from "vitest";

import {
  addScAction,
  adjacentSquares,
  endScTurn,
  parseScFen,
  spawnCCAnchor,
} from "../../index.ts";

describe("spawnCCAnchor", () => {
  it("B timing uses the living Command Center ring", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const { commandCenter, occupied } = spawnCCAnchor(snap, "w", "B");
    expect(commandCenter).toBe("e1");
    expect(adjacentSquares(commandCenter!, occupied).sort()).toEqual(
      ["d1", "d2", "e2", "f1", "f2"].sort(),
    );
  });

  it("F timing centers the ring on the post-classical Command Center square", () => {
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
    const { commandCenter, occupied } = spawnCCAnchor(snap, "w", "F");
    expect(commandCenter).toBe("e2");
    // Vacated e1 is empty and adjacent to the post-move Command Center.
    expect(adjacentSquares(commandCenter!, occupied)).toContain("e1");
    expect(adjacentSquares(commandCenter!, occupied)).not.toContain("e2");
  });

  it("queues F spawn onto the vacated Command Center square after classical", () => {
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
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "e1",
        unit: "p",
      },
    }).snapshot;
    const { next } = endScTurn(snap, { skipTurnStartChecks: true });
    expect(next.placement).toMatch(/.*P.*/); // marine landed
    // Command Center on e2, Marine back on e1.
    expect(next.placement.split("/")[6]).toContain("K"); // rank 2
  });

  it("F timing frees a non-Command Center unit's origin for deploy after classical", () => {
    // Hoverbike on d2 leaves; Command Center may F-spawn onto d2.
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/3N4/4K3|1|33|P|G:11:11|B:3:3|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "d2",
        to: "c4",
      },
    }).snapshot;
    const { commandCenter, occupied } = spawnCCAnchor(snap, "w", "F");
    expect(commandCenter).toBe("e1");
    expect(occupied.has("d2")).toBe(false);
    expect(occupied.has("c4")).toBe(true);
    expect(adjacentSquares(commandCenter!, occupied)).toContain("d2");

    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "F",
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "d2",
        unit: "p",
      },
    }).snapshot;
    const { next } = endScTurn(snap, { skipTurnStartChecks: true });
    // Hoverbike c4, marine d2, Command Center e1.
    expect(next.placement).toBe("4k3/8/8/8/2N5/8/3P4/4K3");
  });

  it("B timing still treats pre-classical square as occupied", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/3N4/4K3|1|33|P|G:11:11|B:3:3|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "d2",
        to: "c4",
      },
    }).snapshot;
    // B spawn must not see d2 free (B resolves before C).
    const { occupied } = spawnCCAnchor(snap, "w", "B");
    expect(occupied.has("d2")).toBe(true);
  });
});
