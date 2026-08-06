/**
 * Queue shape (multi-special) + F rewrite (move-then-gas) contracts.
 */
import { describe, expect, it } from "vitest";

import {
  AddScActionError,
  addScAction,
  endScTurn,
  parseScFen,
} from "@chess-coach/starchess-core";

describe("queue — multiple specials (B xor F)", () => {
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

  it("rejects mixing B and F on the same side", () => {
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
    expect(() =>
      addScAction({
        snapshot: snap,
        action: { timing: "F", kind: "rookSiege", color: "w", from: "e4" },
      }),
    ).toThrow(AddScActionError);
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
});
