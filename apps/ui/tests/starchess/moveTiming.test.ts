import { describe, expect, it } from "vitest";

import {
  knightElbowMs,
  moveDurationMs,
  moveTravelSquares,
} from "~/starchess/animations/moveTiming";
import { MOVE_SQUARE_MS } from "~/starchess/constants";

describe("moveTiming", () => {
  it("charges MOVE_SQUARE_MS per Chebyshev square for slides", () => {
    expect(moveTravelSquares("a1", "c3", "b")).toBe(2);
    expect(moveDurationMs("a1", "c3", "b")).toBe(2 * MOVE_SQUARE_MS);
    expect(moveTravelSquares("e2", "e4", "p")).toBe(2);
    expect(moveDurationMs("e2", "e4", "p")).toBe(2 * MOVE_SQUARE_MS);
    expect(moveDurationMs("e2", "e3", "p")).toBe(MOVE_SQUARE_MS);
  });

  it("charges L-path length for knights at half rate (2+1)", () => {
    expect(moveTravelSquares("d4", "e6", "n")).toBe(3);
    expect(moveDurationMs("d4", "e6", "n")).toBe((3 * MOVE_SQUARE_MS) / 2);
    expect(knightElbowMs("d4", "e6")).toBe(MOVE_SQUARE_MS);
  });
});
