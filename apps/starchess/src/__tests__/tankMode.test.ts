import { describe, expect, it } from "vitest";
import type { Square } from "chess.js";

import { tankModeAt, tankModeForSieged } from "~/presentation/board/tankMode";

describe("tankModeForSieged", () => {
  it("maps set and array sieged lists", () => {
    const set = new Set<Square>(["d4"]);
    expect(tankModeForSieged(set)("d4")).toBe("siege");
    expect(tankModeForSieged(set)("e4")).toBe("tank");
    expect(tankModeAt("d4", ["d4", "f4"] as Square[])).toBe("siege");
    expect(tankModeAt("a1", ["d4"] as Square[])).toBe("tank");
  });
});
