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

describe("collision: timed paths — colour-independent", () => {
  const run = (scfen: string, moves: Parameters<typeof addScMove>[1][]) => {
    let s = parseScFen(scfen);
    for (const m of moves) s = addScMove(s, m);
    return endScTurn(s, { skipTurnStartChecks: true });
  };

  it.each([
    {
      label: "white Tank, black Hoverbike",
      scfen: "SCFEN|k7/6n1/8/8/8/8/8/K6R|1|33|P|G:11:11|Q:w:;b:",
      moves: [
        { color: "w", from: "h1", to: "h8" },
        { color: "b", from: "g7", to: "h5" },
      ],
      at: "h5",
    },
    {
      label: "white Hoverbike, black Tank",
      scfen: "SCFEN|k6r/8/8/8/8/8/6N1/K7|1|33|P|G:11:11|Q:w:;b:",
      moves: [
        { color: "w", from: "g2", to: "h4" },
        { color: "b", from: "h8", to: "h1" },
      ],
      at: "h4",
    },
  ] as const)("$label — the bike is parked when the Tank arrives", ({ scfen, moves, at }) => {
    const r = run(scfen, [...moves]);
    expect(r.next.placement).toBe("k7/8/8/8/8/8/8/K7");
    expect(r.resolved.moveCollisions).toHaveLength(2);
    expect(r.resolved.moveCollisions.every((c) => c.to === at && c.occupies === false)).toBe(true);
    expect(r.resolved.moves.map((m) => m.to)).toEqual([at, at]);
  });

  it("sliders crossing at different ticks pass through each other", () => {
    // White holds d4 on ticks 6–7; black reaches d4 on tick 8.
    const r = run("SCFEN|k2r4/8/8/8/R7/8/8/K7|1|33|P|G:11:11|Q:w:;b:", [
      { color: "w", from: "a4", to: "h4" },
      { color: "b", from: "d8", to: "d1" },
    ]);
    expect(r.next.placement).toBe("k7/8/8/8/7R/8/8/K2r4");
    expect(r.resolved.moveCollisions).toEqual([]);
  });

  it("sliders reaching the crossing on the same tick both die there", () => {
    const r = run("SCFEN|k7/3r4/8/8/R7/8/8/K7|1|33|P|G:11:11|Q:w:;b:", [
      { color: "w", from: "a4", to: "h4" },
      { color: "b", from: "d7", to: "d1" },
    ]);
    expect(r.next.placement).toBe("k7/8/8/8/8/8/8/K7");
    expect(r.resolved.moveCollisions.map((c) => c.to)).toEqual(["d4", "d4"]);
  });

  it("head-on sliders passing mid-edge both die", () => {
    const r = run("SCFEN|k3r3/8/8/8/8/8/8/K3R3|1|33|P|G:11:11|Q:w:;b:", [
      { color: "w", from: "e1", to: "e5" },
      { color: "b", from: "e8", to: "e4" },
    ]);
    expect(r.next.placement).toBe("k7/8/8/8/8/8/8/K7");
    expect(r.resolved.moveCollisions).toHaveLength(2);
  });

  it("a Tank reaching a square the Command Center already holds stops short", () => {
    const r = run("SCFEN|8/8/8/1k6/8/8/8/R3K3|1|33|P|G:11:11|Q:w:;b:", [
      { color: "w", from: "a1", to: "a8" },
      { color: "b", from: "b5", to: "a5" },
    ]);
    expect(r.next.placement).toBe("8/8/8/k7/R7/8/8/4K3");
    expect(r.resolved.moveCollisions).toEqual([]);
  });

  it("a Command Center stepping onto a mover takes it", () => {
    const r = run("SCFEN|8/8/8/8/8/1k6/8/R3K3|1|33|P|G:11:11|Q:w:;b:", [
      { color: "w", from: "a1", to: "a2" },
      { color: "b", from: "b3", to: "a2" },
    ]);
    expect(r.next.placement).toBe("8/8/8/8/8/8/k7/4K3");
    expect(r.resolved.moveCollisions).toEqual([
      expect.objectContaining({
        piece: "k",
        color: "b",
        to: "a2",
        victim: { piece: "r", color: "w" },
        occupies: true,
      }),
    ]);
  });
});
