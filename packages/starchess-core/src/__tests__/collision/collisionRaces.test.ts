/**
 * Collision races — mid-path block, same-square land, Hoverbike vs fleeing Marine.
 */
import { describe, expect, it } from "vitest";

import { addScMove, endScTurn, parseScFen } from "../../index";

describe("collision: mid-path before destination", () => {
  it("Re1→e8 discovers pe7 (not skip to re8)", () => {
    let s = parseScFen(
      "SCFEN|k3r3/4p3/8/8/8/8/8/K3R3|1|33|P|G:11:11|Q:w:;b:",
    );
    s = addScMove(s, { color: "w", from: "e1", to: "e8" });
    const r = endScTurn(s, { skipTurnStartChecks: true });
    // Capture + occupy e7; black Tank on e8 survives.
    expect(r.next.placement).toBe("k3r3/4R3/8/8/8/8/8/K7");
    expect(r.resolved.pathRevealAttacks).toEqual([
      expect.objectContaining({
        kind: "capture",
        to: "e7",
        victim: { piece: "p", color: "b" },
        occupies: true,
      }),
    ]);
    expect(r.resolved.attacks).toEqual([]);
  });

  it("ally Marine e7 truncates Tank before e7 (no capture)", () => {
    let s = parseScFen(
      "SCFEN|k3r3/4P3/8/8/8/8/8/K3R3|1|33|P|G:11:11|Q:w:;b:",
    );
    s = addScMove(s, { color: "w", from: "e1", to: "e8" });
    const r = endScTurn(s, { skipTurnStartChecks: true });
    expect(r.next.placement).toBe("k3r3/4P3/4R3/8/8/8/8/K7");
    expect(r.resolved.moves).toEqual([
      expect.objectContaining({ from: "e1", to: "e6", piece: "r" }),
    ]);
    expect(r.resolved.attacks).toEqual([]);
    expect(r.resolved.pathRevealAttacks).toEqual([]);
  });
});

describe("collision: same-square Mechas", () => {
  it("near white (1sq) vs far black (3sq) — both die, e5 empty", () => {
    let s = parseScFen(
      "SCFEN|1b2k3/8/8/8/3B4/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    );
    s = addScMove(s, { color: "w", from: "d4", to: "e5" });
    s = addScMove(s, { color: "b", from: "b8", to: "e5" });
    const r = endScTurn(s, { skipTurnStartChecks: true });
    expect(r.next.placement).toBe("4k3/8/8/8/8/8/8/4K3");
    expect(r.resolved.moveCollisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          to: "e5",
          victim: { piece: "b", color: "w" },
          occupies: false,
          moveCollision: true,
        }),
        expect.objectContaining({
          to: "e5",
          victim: { piece: "b", color: "b" },
          occupies: false,
          moveCollision: true,
        }),
      ]),
    );
    expect(r.resolved.moveCollisions).toHaveLength(2);
  });

  it("far white (3sq) vs near black (1sq) — both die, d4 empty", () => {
    let s = parseScFen(
      "SCFEN|4k3/8/8/2b5/8/8/8/B3K3|1|33|P|G:11:11|Q:w:;b:",
    );
    s = addScMove(s, { color: "w", from: "a1", to: "d4" });
    s = addScMove(s, { color: "b", from: "c5", to: "d4" });
    const r = endScTurn(s, { skipTurnStartChecks: true });
    expect(r.next.placement).toBe("4k3/8/8/8/8/8/8/4K3");
    expect(r.resolved.moveCollisions).toHaveLength(2);
    expect(r.resolved.moveCollisions.every((c) => c.occupies === false)).toBe(
      true,
    );
  });
});

describe("collision: Hoverbike speed vs gas Marine + Mecha", () => {
  /**
   * B gas flees Marine e4→e5; white Mecha and black Hoverbike both classical to e4.
   * Race onto vacated e4 — mutual annihilation; Marine safe on e5.
   */
  it.each([
    {
      label: "Mecha 1sq (d5)",
      scfen:
        // Pre-queued: rem already net of the 1-gas stimStep.
        "SCFEN|4k3/8/3n4/3B4/4P3/8/8/4K3|1|33|P|G:01:11|Q:w:B=stimStep:e4:e5,C=d5e4;b:C=d6e4",
    },
    {
      label: "Mecha 2sq (c6)",
      scfen:
        "SCFEN|4k3/8/2Bn4/8/4P3/8/8/4K3|1|33|P|G:01:11|Q:w:B=stimStep:e4:e5,C=c6e4;b:C=d6e4",
    },
    {
      label: "Mecha 3sq (b1)",
      scfen:
        "SCFEN|4k3/8/3n4/8/4P3/8/8/1B2K3|1|33|P|G:01:11|Q:w:B=stimStep:e4:e5,C=b1e4;b:C=d6e4",
    },
  ] as const)("$label — both die on e4, Marine safe on e5", ({ scfen }) => {
    const r = endScTurn(parseScFen(scfen), { skipTurnStartChecks: true });
    expect(r.next.placement).toBe("4k3/8/8/4P3/8/8/8/4K3");
    expect(r.resolved.moveCollisions).toHaveLength(2);
    expect(r.resolved.moveCollisions.every((c) => c.occupies === false)).toBe(
      true,
    );
    expect(r.bMoves).toEqual([
      expect.objectContaining({ from: "e4", to: "e5", piece: "p" }),
    ]);
  });
});
