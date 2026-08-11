import { describe, expect, it } from "vitest";
import type { Square } from "chess.js";

import { rookModeAt, rookModeForSieged } from "~/presentation/board/rookMode";

describe("rookModeForSieged", () => {
  it("maps set and array sieged lists", () => {
    const set = new Set<Square>(["d4"]);
    expect(rookModeForSieged(set)("d4")).toBe("siege");
    expect(rookModeForSieged(set)("e4")).toBe("tank");
    expect(rookModeAt("d4", ["d4", "f4"] as Square[])).toBe("siege");
    expect(rookModeAt("a1", ["d4"] as Square[])).toBe("tank");
  });
});
