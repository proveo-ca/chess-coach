import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

import { specialCopyFor } from "~/starchess/primitives/specialCopy";
import { tacticalJumpTargets } from "~/starchess/specials/queenTacticalJump";

describe("tacticalJumpTargets", () => {
  it("returns visible empty squares for the queen, excluding origin and occupants", () => {
    const game = new Chess("7k/8/8/8/8/8/8/Q6K w - - 0 1");
    const targets = tacticalJumpTargets(game, "a1");

    expect(targets).toContain("c3");
    expect(targets).toContain("d4");
    expect(targets).not.toContain("a1");
    expect(targets).not.toContain("h1");
    expect(targets).not.toContain("h8");
  });

  it("ignores pieces in the way but still requires the target square to be free", () => {
    const game = new Chess("7k/8/8/8/8/8/1P6/Q6K w - - 0 1");
    const targets = tacticalJumpTargets(game, "a1");

    expect(targets).toContain("c3");
    expect(targets).not.toContain("b2");
  });

  it("requires a queen on the origin square", () => {
    const game = new Chess("7k/8/8/8/8/8/8/Q6K w - - 0 1");
    expect(tacticalJumpTargets(game, "h1")).toEqual([]);
    expect(tacticalJumpTargets(game, "a2")).toEqual([]);
  });
});

describe("Battlecruiser special copy", () => {
  it("is deployable and costs 2 vespene", () => {
    expect(specialCopyFor("q")).toMatchObject({
      unit: "Battlecruiser",
      name: "Tactical Jump",
      deployable: true,
      gasCost: 2,
    });
  });
});
