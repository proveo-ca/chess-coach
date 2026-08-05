import { describe, expect, it } from "vitest";

import { findNerdName, levenshteinDistance } from "~/starchess/nerdNames";

describe("nerd name matching", () => {
  it("ignores case and accepts a Levenshtein distance of two", () => {
    expect(findNerdName("kErRiGaN")).toBe("Kerrigan");
    expect(findNerdName("Kerrigxx")).toBe("Kerrigan");
  });

  it("does not unlock for names outside the threshold", () => {
    expect(findNerdName("Classic Chess Player")).toBeNull();
  });

  it("recognizes StarChess units and Korean pro handles", () => {
    expect(findNerdName("Hydralizk")).toBe("Hydralisk");
    expect(findNerdName("Jaedong")).toBe("Jaedong");
    expect(findNerdName("iloveoov")).toBe("iloveoov");
  });

  it("computes insertions, removals, and substitutions", () => {
    expect(levenshteinDistance("Raynor", "Raynor")).toBe(0);
    expect(levenshteinDistance("Raynor", "Raynor!")).toBe(1);
    expect(levenshteinDistance("Nova", "Niva")).toBe(1);
  });
});
