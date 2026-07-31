import { describe, expect, it } from "vitest";

import {
  canBwPawnDouble,
  canClassicalPawnDouble,
  pawnDoubleTarget,
} from "~/broodwar/specials/pawnDouble";

describe("pawnDouble", () => {
  const start = "7k/8/8/8/8/4P3/3P4/4K3 w - - 0 1";

  it("classical double on start rank only", () => {
    expect(canClassicalPawnDouble(start, "d2")).toBe(true);
    expect(canClassicalPawnDouble(start, "e3")).toBe(false);
    expect(pawnDoubleTarget("d2", "w")).toBe("d4");
  });

  it("BW double allows mid-board when path clear", () => {
    expect(canBwPawnDouble(start, "e3")).toBe(true);
    expect(canBwPawnDouble(start, "d2")).toBe(true);
  });

  it("rejects blocked path", () => {
    const blocked = "7k/8/8/8/3P4/8/3P4/4K3 w - - 0 1";
    expect(canClassicalPawnDouble(blocked, "d2")).toBe(false);
    expect(canBwPawnDouble(blocked, "d2")).toBe(false);
  });
});
