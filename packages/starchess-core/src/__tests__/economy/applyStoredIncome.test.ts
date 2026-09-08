/**
 * applyStoredIncome / OPENING_STORED_MATERIAL — the stored bank's income owner
 * (single-owner core; the app's `applyTurnIncome` delegates here).
 */
import { describe, expect, it } from "vitest";

import {
  MAX_STORED_MATERIAL,
  OPENING_STORED_MATERIAL,
  applyStoredIncome,
} from "../../index";

describe("applyStoredIncome", () => {
  it("defines the opening bank", () => {
    expect(OPENING_STORED_MATERIAL).toBe(3);
  });

  it("grants +1 per side on turn advance (income tier 1)", () => {
    expect(applyStoredIncome({ w: 3, b: 3 }, 1)).toEqual({ w: 4, b: 4 });
    expect(applyStoredIncome({ w: 3, b: 3 }, 10)).toEqual({ w: 4, b: 4 });
  });

  it("keeps the exact app income tiers (2 by 11+, 3 by 21+)", () => {
    expect(applyStoredIncome({ w: 0, b: 0 }, 11)).toEqual({ w: 2, b: 2 });
    expect(applyStoredIncome({ w: 0, b: 0 }, 21)).toEqual({ w: 3, b: 3 });
  });

  it("caps both sides at MAX_STORED_MATERIAL", () => {
    const capped = applyStoredIncome({ w: 11, b: 12 }, 50);
    expect(capped.w).toBe(MAX_STORED_MATERIAL);
    expect(capped.b).toBe(MAX_STORED_MATERIAL);
    expect(applyStoredIncome({ w: 12, b: 12 }, 1)).toEqual({
      w: 12,
      b: 12,
    });
  });

  it("treats turn 0 seeds as the turn-1 tier", () => {
    expect(applyStoredIncome({ w: 3, b: 3 }, 0)).toEqual({ w: 4, b: 4 });
  });
});