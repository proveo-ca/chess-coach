import { describe, expect, it } from "vitest";

import {
  addScAction,
  endScTurn,
  getSideVision,
  parseScFen,
  placementToMap,
} from "../../index";

describe("bishop vs king on diagonal", () => {
  it("lit king on ray: truncate, no pathReveal chip", () => {
    let snap = parseScFen(
      "SCFEN|8/8/8/4k3/4P3/8/8/B6K|0|33|P|G:11:11|Q:w:;b:",
    );
    const v = getSideVision(placementToMap(snap.placement), "w");
    expect(v.litSquares.has("e5") || v.revealedPieces.has("e5")).toBe(true);
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "a1",
        to: "h8",
      },
    }).snapshot;
    const r = endScTurn(snap, { skipTurnStartChecks: true });
    expect(r.resolved.pathRevealAttacks).toEqual([]);
    expect(r.next.kingLives.b).toBe(3);
  });

  it("fogged king on ray: pathReveal kingShot chips (only discovery case)", () => {
    let snap = parseScFen(
      "SCFEN|8/8/8/4k3/8/8/8/B6K|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "a1",
        to: "h8",
      },
    }).snapshot;
    const r = endScTurn(snap, { skipTurnStartChecks: true });
    expect(r.resolved.pathRevealAttacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "kingShot", to: "e5" }),
      ]),
    );
    expect(r.next.kingLives.b).toBe(2);
  });

  it("bishop moves onto a new checking square: no mid-resolve chip", () => {
    let snap = parseScFen(
      "SCFEN|8/8/8/4k3/8/8/3B4/7K|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "d2",
        to: "f4",
      },
    }).snapshot;
    const r = endScTurn(snap, { skipTurnStartChecks: true });
    expect(r.resolved.pathRevealAttacks).toEqual([]);
    expect(r.resolved.attacks.filter((a) => a.kind === "kingShot")).toEqual([]);
    expect(r.next.kingLives.b).toBe(3);
  });

  it("B-spawned marine on the ray to a fogged king is captured, not a fizzle", () => {
    // Mecha g2→d5: d5 is outside the 5×5 (last-seen Command Center). Black
    // drops a marine on e4 in B, on that diagonal and inside the Mecha's vision.
    let snap = parseScFen(
      "SCFEN|8/8/8/3k4/8/8/6B1/7K|1|33|P|G:11:11|B:3:3|Q:w:;b:",
    );
    const before = getSideVision(placementToMap(snap.placement), "w");
    expect(before.litSquares.has("d5")).toBe(false);
    expect(before.litSquares.has("e4")).toBe(true);
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "g2",
        to: "d5",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "B",
        kind: "spawn",
        color: "b",
        from: "d5",
        to: "e4",
        unit: "p",
      },
    }).snapshot;
    const r = endScTurn(snap, { skipTurnStartChecks: true });
    expect(r.resolved.pathRevealAttacks).toEqual([]);
    expect(r.resolved.attacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "capture",
          piece: "b",
          from: "g2",
          to: "e4",
          victim: { piece: "p", color: "b" },
          occupies: true,
        }),
      ]),
    );
    expect(r.next.placement).toBe("8/8/8/3k4/4B3/8/8/7K");
    expect(r.next.kingLives.b).toBe(3);
  });

  it("lit mid-path enemy: phase-1 capture, not pathReveal approach", () => {
    // Bishop aims through a lit knight on the ray (capture intent at e5).
    let snap = parseScFen(
      "SCFEN|k7/8/8/4n3/4P3/8/8/B6K|0|33|P|G:11:11|Q:w:;b:",
    );
    const v = getSideVision(placementToMap(snap.placement), "w");
    expect(v.litSquares.has("e5") || v.revealedPieces.has("e5")).toBe(true);
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "a1",
        to: "e5",
      },
    }).snapshot;
    const r = endScTurn(snap, { skipTurnStartChecks: true });
    expect(r.resolved.pathRevealAttacks).toEqual([]);
    expect(r.resolved.attacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "capture",
          from: "a1",
          to: "e5",
          occupies: true,
        }),
      ]),
    );
  });
});
