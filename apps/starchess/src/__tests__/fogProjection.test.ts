import { describe, expect, it } from "vitest";
import type { Square } from "chess.js";

import { fogWithGasUsedReveal } from "~/presentation/board/fogProjection";

describe("fogProjection", () => {
  it("reveals enemy gas-used squares without lighting tiles", () => {
    const base = {
      litSquares: new Set<Square>(["e1", "e2"]),
      revealedPieces: new Set<Square>(),
    };
    const out = fogWithGasUsedReveal(
      base,
      new Set<Square>(["e5"]),
      "w",
      {
        placement: "4k3/8/8/4n3/8/8/8/4K3",
        turn: 0,
        kingLives: { w: 3, b: 3 },
        phase: "P",
        gas: { w: 1, b: 1 },
        gasIncome: { w: 1, b: 1 },
      },
    );
    expect(out.revealedPieces.has("e5")).toBe(true);
    expect(out.litSquares.has("e5")).toBe(false);
  });

  it("does not reveal friendly specialsUsed as fog pierce", () => {
    const base = {
      litSquares: new Set<Square>(),
      revealedPieces: new Set<Square>(),
    };
    const out = fogWithGasUsedReveal(
      base,
      new Set<Square>(["e2"]),
      "w",
      {
        placement: "4k3/8/8/8/8/8/4P3/4K3",
        turn: 0,
        kingLives: { w: 3, b: 3 },
        phase: "P",
        gas: { w: 1, b: 1 },
        gasIncome: { w: 1, b: 1 },
      },
    );
    expect(out.revealedPieces.has("e2")).toBe(false);
  });
});
