/**
 * Queue shape (multi-special) + F rewrite (move-then-gas) contracts.
 */
import { describe, expect, it } from "vitest";

import {
  addScAction,
  endScTurn,
  formatScFen,
  parseScFen,
} from "@chess-coach/starchess-core";

describe("queue — multiple specials (B and/or F)", () => {
  // Turn 11 → income tier 2; G:22 gives room for two 1-gas specials.
  // Placement: Nb4, Re4, Pe2, Ke1 / ke8.
  const start = () =>
    parseScFen("SCFEN|4k3/8/8/8/1N2R3/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:");

  it("allows two B specials on different units", () => {
    let snap = start();
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "knightMine", color: "w", from: "b4", to: "b4" },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "rookSiege", color: "w", from: "e4" },
    }).snapshot;
    expect(snap.queue?.actions.filter((a) => a.timing === "B")).toHaveLength(2);
    expect(snap.gas.w).toBe(0);
  });

  it("allows a special before and a special after the same classical", () => {
    let snap = start();
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "knightMine", color: "w", from: "b4", to: "b4" },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e2",
        to: "e3",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "F", kind: "rookSiege", color: "w", from: "e4" },
    }).snapshot;
    expect(snap.queue?.actions.map((a) => a.timing)).toEqual(["B", "C", "F"]);
    expect(snap.gas.w).toBe(0);
    // Wire order is seq order — B before C before F round-trips unchanged.
    expect(formatScFen(snap)).toContain(
      "Q:w:B=knightMine:b4:b4,C=e2e3,F=rookSiege:e4;b:",
    );
    expect(parseScFen(formatScFen(snap)).queue?.actions).toEqual(snap.queue?.actions);
  });

  it("refuses a second special on the same unit", () => {
    // One special per unit per turn — the engine, not the HUD, is the authority.
    let snap = start();
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "knightMine", color: "w", from: "b4", to: "b4" },
    }).snapshot;
    expect(() =>
      addScAction({
        snapshot: snap,
        action: { timing: "F", kind: "knightMine", color: "w", from: "b4", to: "b4" },
      }),
    ).toThrow(/already used its special/);
    // Gas was never charged for the refused action.
    expect(snap.gas.w).toBe(1);
  });

  it("refuses a stacked-unit queue on the wire too", () => {
    // Same rule reading SCFEN — a hand-written or replayed wire cannot smuggle it in.
    expect(() =>
      parseScFen(
        "SCFEN|4k3/8/8/8/1N2R3/8/4P3/4K3|11|33|P|G:02:22|Q:w:B=knightMine:b4:b4,F=knightMine:b4:b4;b:",
      ),
    ).toThrow(/one special per unit/);
  });

  it("allows two F specials after classical", () => {
    let snap = start();
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e2",
        to: "e3",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "F", kind: "knightMine", color: "w", from: "b4", to: "b4" },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "F", kind: "rookSiege", color: "w", from: "e4" },
    }).snapshot;
    expect(snap.queue?.actions.filter((a) => a.timing === "F")).toHaveLength(2);
  });
});

describe("endScTurn — specials before and after one classical", () => {
  it("resolves B special, then the classical, then the F special", () => {
    // Nb4, Rd4, Pa2, Ke1 / ke8 — nothing on a check ray.
    let snap = parseScFen("SCFEN|4k3/8/8/8/1N1R4/8/P7/4K3|11|33|P|G:22:22|Q:w:;b:");
    snap = addScAction({
      snapshot: snap,
      action: { timing: "B", kind: "knightMine", color: "w", from: "b4", to: "b4" },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "C", kind: "classical", color: "w", from: "a2", to: "a3" },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "F", kind: "rookSiege", color: "w", from: "d4" },
    }).snapshot;

    const r = endScTurn(snap, { skipTurnStartChecks: true });
    expect(r.next.mines).toEqual([{ color: "w", at: "b4" }]);
    expect(r.next.placement).toBe("4k3/8/8/8/1N1R4/P7/8/4K3");
    expect(r.next.siegedRooks).toEqual(["d4"]);
    expect(
      r.events
        .filter((e) => e.phase !== "attack")
        .map((e) => e.phase),
    ).toEqual(["specialBefore", "move", "specialAfter"]);
  });
});

describe("endScTurn — F specials resolve on post-C square", () => {
  it("move-then-mine drops on the destination (not the origin)", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/1N2K3|11|33|P|G:22:22|Q:w:;b:",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "b1",
        to: "c3",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "F", kind: "knightMine", color: "w", from: "b1", to: "b1" },
    }).snapshot;
    const r = endScTurn(snap, { skipTurnStartChecks: true });
    expect(r.next.mines).toEqual([{ color: "w", at: "c3" }]);
    const gasEv = r.events.find(
      (e) => e.phase === "specialAfter" && e.kind === "knightMine",
    );
    expect(gasEv?.from).toBe("c3");
    expect(gasEv?.to).toBe("c3");
  });

  it("allows F mine when origin already has a mine (drop is post-C)", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/1N2K3|11|33|P|G:22:22|Q:w:;b:|M:w:b1",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "b1",
        to: "c3",
      },
    }).snapshot;
    snap = addScAction({
      snapshot: snap,
      action: { timing: "F", kind: "knightMine", color: "w", from: "b1", to: "b1" },
    }).snapshot;
    const r = endScTurn(snap, { skipTurnStartChecks: true });
    expect(r.next.mines).toEqual(
      expect.arrayContaining([
        { color: "w", at: "b1" },
        { color: "w", at: "c3" },
      ]),
    );
  });

  it("refuses F mine when the post-C square already has a mine", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/1N2K3|11|33|P|G:22:22|Q:w:;b:|M:w:c3",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "b1",
        to: "c3",
      },
    }).snapshot;
    expect(() =>
      addScAction({
        snapshot: snap,
        action: { timing: "F", kind: "knightMine", color: "w", from: "b1", to: "b1" },
      }),
    ).toThrow(/mine already/);
  });
});
