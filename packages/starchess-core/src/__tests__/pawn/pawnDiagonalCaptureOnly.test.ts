/**
 * Marine (pawn) diagonals are capture-only. A diagonal intent that finds no
 * enemy unit fizzles — it never degrades into a quiet sideways step, even when
 * queued under fog as an attack intent.
 */
import { describe, expect, it } from "vitest";

import { addScAction, endScTurn, parseScFen } from "../..";

const resolveClassical = (
  scfen: string,
  from: string,
  to: string,
  color: "w" | "b" = "w",
) => {
  let snap = parseScFen(scfen);
  snap = addScAction({
    snapshot: snap,
    action: {
      timing: "C",
      kind: "classical",
      color,
      from: from as never,
      to: to as never,
    },
  }).snapshot;
  return endScTurn(snap, { skipTurnStartChecks: true });
};

describe("pawn diagonal is capture-only", () => {
  it("empty diagonal fizzles — pawn stays put, no move or attack", () => {
    const r = resolveClassical(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:11:11|Q:w:;b:",
      "e2",
      "d3",
    );
    expect(r.next.placement).toBe("4k3/8/8/8/8/8/4P3/4K3");
    expect(r.resolved.moves).toEqual([]);
    expect(r.resolved.attacks).toEqual([]);
    expect(r.resolved.moveCollisions).toEqual([]);
  });

  it("enemy on the diagonal still captures and occupies", () => {
    const r = resolveClassical(
      "SCFEN|4k3/8/8/8/8/3p4/4P3/4K3|1|33|P|G:11:11|Q:w:;b:",
      "e2",
      "d3",
    );
    expect(r.next.placement).toBe("4k3/8/8/8/8/3P4/8/4K3");
    expect(r.resolved.attacks).toEqual([
      expect.objectContaining({
        kind: "capture",
        piece: "p",
        color: "w",
        from: "e2",
        to: "d3",
        victim: { piece: "p", color: "b" },
        occupies: true,
      }),
    ]);
    expect(r.resolved.moves).toEqual([
      expect.objectContaining({ from: "e2", to: "d3", piece: "p" }),
    ]);
  });

  it("fog attack intent onto a hidden enemy still captures", () => {
    // Spawned marine d1 attacks c2. c2 is outside king vision (only e1 lights
    // d1–f2), so the black pawn sits in fog — the intent must still resolve.
    const r = resolveClassical(
      "SCFEN|4k3/8/8/8/8/8/2p5/4K3|1|33|P|G:01:11|Q:w:B=spawn:e1:d1:p;b:",
      "d1",
      "c2",
    );
    expect(r.next.placement).toBe("4k3/8/8/8/8/8/2P5/4K3");
    expect(r.resolved.attacks).toEqual([
      expect.objectContaining({
        kind: "capture",
        from: "d1",
        to: "c2",
        victim: { piece: "p", color: "b" },
      }),
    ]);
  });

  it("fog attack intent onto an empty diagonal fizzles", () => {
    // Same spawn setup, but c2 is genuinely empty — no enemy to attack.
    const r = resolveClassical(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:01:11|Q:w:B=spawn:e1:d1:p;b:",
      "d1",
      "c2",
    );
    expect(r.next.placement).toBe("4k3/8/8/8/8/8/8/3PK3");
    expect(r.resolved.moves).toEqual([]);
    expect(r.resolved.attacks).toEqual([]);
  });
});
