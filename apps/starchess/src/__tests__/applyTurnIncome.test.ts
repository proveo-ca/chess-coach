import { describe, expect, it } from "vitest";
import { MAX_STORED_MATERIAL } from "@chess-coach/starchess-core";

import { applyTurnIncome, OPENING_STORED_MATERIAL } from "~/app/matchEconomy";

describe("applyTurnIncome", () => {
  it("adds income for both sides and clamps to max", () => {
    const next = applyTurnIncome({ w: 3, b: 3 }, 1);
    expect(next.w).toBeGreaterThanOrEqual(OPENING_STORED_MATERIAL);
    expect(next.b).toBe(next.w);
    const capped = applyTurnIncome(
      { w: MAX_STORED_MATERIAL, b: MAX_STORED_MATERIAL },
      5,
    );
    expect(capped.w).toBe(MAX_STORED_MATERIAL);
    expect(capped.b).toBe(MAX_STORED_MATERIAL);
  });
});
