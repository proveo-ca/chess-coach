import { describe, expect, it } from "vitest";

import {
  canScPawnSingle,
  canClassicalPawnDouble,
  pawnDoubleTarget,
  pawnSingleTarget,
} from "~/starchess/specials/pawnDouble";

describe("pawn steps", () => {
  const start = "7k/8/8/8/8/4P3/3P4/4K3 w - - 0 1";

  it("classical double on start rank only", () => {
    expect(canClassicalPawnDouble(start, "d2")).toBe(true);
    expect(canClassicalPawnDouble(start, "e3")).toBe(false);
    expect(pawnDoubleTarget("d2", "w")).toBe("d4");
  });

  it("gas canister moves only 1 extra square", () => {
    expect(pawnSingleTarget("d4", "w")).toBe("d5");
    expect(pawnSingleTarget("e3", "w")).toBe("e4");
    expect(canScPawnSingle(start, "e3")).toBe(true);
    expect(canScPawnSingle(start, "d2")).toBe(true);
  });

  it("rejects a blocked single step", () => {
    const blocked = "7k/8/8/8/8/3P4/3P4/4K3 w - - 0 1";
    expect(canClassicalPawnDouble(blocked, "d2")).toBe(false);
    expect(canScPawnSingle(blocked, "d2")).toBe(false);
  });
});
