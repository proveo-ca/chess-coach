import { describe, expect, it } from "vitest";

import { resolveTurn } from "~/broodwar/resolveTurn";

describe("resolveTurn", () => {
  it("king-shot chips lives without occupying the king square", () => {
    const r = resolveTurn({
      placement: "k7/5r2/8/2n5/4K3/8/7b/8",
      kingLives: { w: 3, b: 3 },
      white: null,
      black: { color: "b", from: "c5", to: "e4" },
    });
    expect(r.attacks).toEqual([
      expect.objectContaining({
        kind: "kingShot",
        from: "c5",
        to: "e4",
        livesAfter: 2,
      }),
    ]);
    expect(r.afterAttack.kingLives.w).toBe(2);
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
    // Knight gone; king still on d5; rook still on f7.
    expect(r.afterAttack.placement).toBe("k7/5r2/8/3K4/8/8/8/6b1");
    expect(r.moves).toEqual(
      expect.arrayContaining([
        { piece: "k", color: "w", from: "d5", to: "c5" },
        { piece: "r", color: "b", from: "f7", to: "f6" },
      ]),
    );
    expect(r.afterMove.placement).toBe("k7/8/5r2/2K5/8/8/8/6b1");
  });

  it("king-shot then quiet flee on the same turn", () => {
    const r = resolveTurn({
      placement: "k7/8/5r2/2K5/8/8/8/6b1",
      kingLives: { w: 2, b: 3 },
      white: { color: "w", from: "c5", to: "c6" },
      black: { color: "b", from: "g1", to: "c5" },
    });
    expect(r.attacks[0]).toMatchObject({
      kind: "kingShot",
      from: "g1",
      to: "c5",
      livesAfter: 1,
    });
    expect(r.afterAttack.kingLives.w).toBe(1);
    expect(r.moves).toEqual([{ piece: "k", color: "w", from: "c5", to: "c6" }]);
    expect(r.afterMove.placement).toBe("k7/8/2K2r2/8/8/8/8/6b1");
  });

  it("lethal king-shot chips to 0 but keeps king in placement", () => {
    const r = resolveTurn({
      placement: "k7/8/2K2r2/8/8/8/8/6b1",
      kingLives: { w: 1, b: 3 },
      white: null,
      black: { color: "b", from: "f6", to: "c6" },
    });
    expect(r.attacks[0]).toMatchObject({ kind: "kingShot", livesAfter: 0 });
    expect(r.afterAttack.placement).toBe("k7/8/2K2r2/8/8/8/8/6b1");
    expect(r.afterAttack.kingLives.w).toBe(0);
  });

  it("Combat Chain turn 1: dual quiet slides", () => {
    const r = resolveTurn({
      placement: "4bk2/8/5n2/4p3/2R5/8/3P4/4K3",
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "d2", to: "d4" },
      black: { color: "b", from: "e8", to: "c6" },
    });
    expect(r.attacks).toEqual([]);
    expect(r.afterMove.placement).toBe("5k2/8/2b2n2/4p3/2RP4/8/8/4K3");
  });

  it("Combat Chain turn 3: mutual capture — rook dies, knight occupies", () => {
    const r = resolveTurn({
      placement: "5k2/8/2b5/4P3/2R1n3/8/8/4K3",
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "c4", to: "c6" },
      black: { color: "b", from: "e4", to: "c4" },
    });
    expect(r.afterAttack.placement).toBe("5k2/8/8/4P3/4n3/8/8/4K3");
    expect(r.moves).toEqual([{ piece: "n", color: "b", from: "e4", to: "c4" }]);
    expect(r.afterMove.placement).toBe("5k2/8/8/4P3/2n5/8/8/4K3");
  });
});
