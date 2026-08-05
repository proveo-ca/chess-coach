import { describe, expect, it } from "vitest";

import { resolveTurn } from "~/starchess/resolveTurn";

describe("resolveTurn", () => {
  it("king-aimed C is a no-op (checks are implicit at turn start)", () => {
    const r = resolveTurn({
      placement: "k7/5r2/8/2n5/4K3/8/7b/8",
      kingLives: { w: 3, b: 3 },
      white: null,
      black: { color: "b", from: "c5", to: "e4" },
    });
    expect(r.attacks).toEqual([]);
    expect(r.pendingKingShotsArmed).toEqual([]);
    expect(r.afterAttack.kingLives.w).toBe(3);
    expect(r.afterAttack.placement).toBe("k7/5r2/8/2n5/4K3/8/7b/8");
    expect(r.moves).toEqual([]);
    expect(r.afterMove.placement).toBe(r.afterAttack.placement);
  });

  it("capture leaves mid-placement then occupies", () => {
    const r = resolveTurn({
      placement: "k7/5r2/8/2nK4/8/8/8/6b1",
      kingLives: { w: 2, b: 3 },
      white: { color: "w", from: "d5", to: "c5" },
      black: { color: "b", from: "f7", to: "f6" },
    });
    expect(r.attacks).toHaveLength(1);
    expect(r.attacks[0]).toMatchObject({
      kind: "capture",
      piece: "k",
      from: "d5",
      to: "c5",
      victim: { piece: "n", color: "b" },
    });
    expect(r.afterAttack.placement).toBe("k7/5r2/8/3K4/8/8/8/6b1");
    expect(r.moves).toEqual(
      expect.arrayContaining([
        { piece: "k", color: "w", from: "d5", to: "c5" },
        { piece: "r", color: "b", from: "f7", to: "f6" },
      ]),
    );
    expect(r.afterMove.placement).toBe("k7/8/5r2/2K5/8/8/8/6b1");
  });

  it("path-discovery kingShot chips when king sits mid-ray (intent past king)", () => {
    // Rook a8 → a1 past white king on a4 — resolve.puml path discovery.
    const r = resolveTurn({
      placement: "r6k/8/8/8/K7/8/8/8",
      kingLives: { w: 2, b: 3 },
      white: null,
      black: { color: "b", from: "a8", to: "a1" },
    });
    expect(r.attacks[0]).toMatchObject({
      kind: "kingShot",
      from: "a5",
      to: "a4",
      livesAfter: 1,
    });
    expect(r.afterAttack.kingLives.w).toBe(1);
  });

  it("Combat Chain turn 1: dual quiet slides", () => {
    const r = resolveTurn({
      placement: "4bk2/8/5n2/4p3/8/2R5/3P4/4K3",
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "d2", to: "d4" },
      black: { color: "b", from: "e8", to: "c6" },
    });
    expect(r.attacks).toEqual([]);
    expect(r.afterMove.placement).toBe("5k2/8/2b2n2/4p3/3P4/2R5/8/4K3");
  });

  it("Combat Chain turn 3: mutual capture — rook dies, knight occupies", () => {
    const r = resolveTurn({
      placement: "5k2/8/2b5/4P3/4n3/2R5/8/4K3",
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "c3", to: "c6" },
      black: { color: "b", from: "e4", to: "c3" },
    });
    expect(r.afterAttack.placement).toBe("5k2/8/8/4P3/4n3/8/8/4K3");
    expect(r.moves).toEqual([{ piece: "n", color: "b", from: "e4", to: "c3" }]);
    expect(r.afterMove.placement).toBe("5k2/8/8/4P3/8/2n5/8/4K3");
  });

  it("Tactical Jump: attacks on a jumping queen are ignored", () => {
    const r = resolveTurn({
      placement: "4k3/8/8/4p3/3Q4/8/8/4K3",
      kingLives: { w: 3, b: 3 },
      white: null,
      black: { color: "b", from: "e5", to: "d4" },
      ignoreAttacksOn: ["d4"],
    });
    expect(r.attacks).toEqual([]);
    expect(r.afterMove.placement).toBe("4k3/8/8/4p3/3Q4/8/8/4K3");
  });
});
