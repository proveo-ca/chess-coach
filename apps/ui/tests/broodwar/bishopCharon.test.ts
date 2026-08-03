import { describe, expect, it } from "vitest";

import { specialCopyFor } from "~/broodwar/primitives/specialCopy";
import {
  charonAimDeg,
  charonTargetQueenFromPlacement,
  placementAfterCharon,
} from "~/broodwar/specials/bishopCharon";

describe("charonTargetQueenFromPlacement", () => {
  it("targets the one enemy queen on a diagonal, ignoring blockers", () => {
    const placement = "k6q/8/4P3/4p3/3B4/8/8/K7";
    expect(charonTargetQueenFromPlacement(placement, "d4")).toBe("h8");
  });

  it("rejects non-diagonal queens", () => {
    const placement = "k6q/8/4P3/4p3/3B4/8/8/K7";
    expect(charonTargetQueenFromPlacement(placement, "d4")).toBe("h8");
    expect(charonTargetQueenFromPlacement("k7/7q/8/8/3B4/8/8/K7", "d4")).toBeNull();
  });

  it("ignores friendly queens", () => {
    const placement = "k6Q/8/8/8/3B4/8/8/K7";
    expect(charonTargetQueenFromPlacement(placement, "d4")).toBeNull();
  });

  it("requires exactly one enemy queen on the diagonals", () => {
    expect(charonTargetQueenFromPlacement("k7/8/4P3/4p3/3B4/8/8/K7", "d4")).toBeNull();
    expect(
      charonTargetQueenFromPlacement("k6q/6q1/4P3/4p3/3B4/8/8/K7", "d4"),
    ).toBeNull();
  });

  it("requires a bishop attacker", () => {
    expect(charonTargetQueenFromPlacement("k6q/8/8/8/3R4/8/8/K7", "d4")).toBeNull();
  });
});

describe("placementAfterCharon", () => {
  it("removes the queen while the Goliath holds its square", () => {
    expect(placementAfterCharon("k6q/8/4P3/4p3/3B4/8/8/K7", "h8")).toBe(
      "k7/8/4P3/4p3/3B4/8/8/K7",
    );
  });
});

describe("charonAimDeg", () => {
  it("aims launchers at the special-move diagonal quadrant", () => {
    expect(charonAimDeg("d4", "h8")).toBe(-45);
    expect(charonAimDeg("d4", "a7")).toBe(-135);
    expect(charonAimDeg("d4", "g1")).toBe(45);
    expect(charonAimDeg("d4", "a1")).toBe(135);
  });
});

describe("Goliath special copy", () => {
  it("is deployable and costs 2 vespene", () => {
    expect(specialCopyFor("b")).toMatchObject({
      unit: "Goliath",
      name: "Charon Booster Missiles",
      deployable: true,
      gasCost: 2,
    });
  });
});
