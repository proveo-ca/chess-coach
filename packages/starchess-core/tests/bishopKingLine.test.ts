import { describe, expect, it } from "vitest";

import {
  addScAction,
  endScTurn,
  getSideVision,
  parseScFen,
  placementToMap,
} from "../src/index";

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
