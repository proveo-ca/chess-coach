import { describe, expect, it } from "vitest";

import { bishopFootAimDeg } from "~/broodwar/animations/MoveAnimation";

describe("bishopFootAimDeg", () => {
  it("maps board diagonals to the locked foot-aim compass", () => {
    expect(bishopFootAimDeg({ df: -1, dr: 1 })).toBe(45); // top-left
    expect(bishopFootAimDeg({ df: 1, dr: 1 })).toBe(135); // top-right
    expect(bishopFootAimDeg({ df: 1, dr: -1 })).toBe(225); // bottom-right
    expect(bishopFootAimDeg({ df: -1, dr: -1 })).toBe(315); // bottom-left
  });
});
