import { describe, expect, it } from "vitest";

import {
  MAX_STORED_MATERIAL,
  OPENING_STORED_MATERIAL,
  estimateStoredFromSnap,
} from "../../index";

describe("estimateStoredFromSnap", () => {
  it("is the opening bank before any turn advances", () => {
    expect(estimateStoredFromSnap({ turn: 0 })).toBe(OPENING_STORED_MATERIAL);
  });

  it("adds one turn's income per advanced turn", () => {
    expect(estimateStoredFromSnap({ turn: 3 })).toBe(OPENING_STORED_MATERIAL + 3);
  });

  it("never exceeds the stored-material cap", () => {
    expect(estimateStoredFromSnap({ turn: 500 })).toBe(MAX_STORED_MATERIAL);
  });
});
