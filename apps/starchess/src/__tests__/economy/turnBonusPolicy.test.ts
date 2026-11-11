import { describe, expect, it } from "vitest";

import { isMilestoneTurn, turnBonusFor } from "~/app/turnBonusPolicy";

describe("turnBonusPolicy", () => {
  it("marks displayed turns 1 / 11 / 21 as milestones", () => {
    for (const t of [0, 1, 11, 21]) expect(isMilestoneTurn(t)).toBe(true);
  });

  it("skips non-milestone turns", () => {
    for (const t of [2, 5, 10, 12, 20, 22, 30]) {
      expect(isMilestoneTurn(t)).toBe(false);
    }
    expect(isMilestoneTurn(1.5)).toBe(false);
  });

  it("announces tier 1 at Turn 1 (+1 Minerals +1 Gas 10s)", () => {
    // Raw engine turn 0 displays as Turn 1 at game start.
    expect(turnBonusFor(0)).toEqual({
      turn: 1,
      minerals: 1,
      gas: 1,
      seconds: 10,
    });
    expect(turnBonusFor(1)?.turn).toBe(1);
  });

  it("announces tier 2 at Turn 11 (+2 Minerals +2 Gas 15s)", () => {
    expect(turnBonusFor(11)).toEqual({
      turn: 11,
      minerals: 2,
      gas: 2,
      seconds: 15,
    });
  });

  it("announces tier 3 at Turn 21 (+3 Minerals +3 Gas 22s)", () => {
    expect(turnBonusFor(21)).toEqual({
      turn: 21,
      minerals: 3,
      gas: 3,
      seconds: 22,
    });
  });

  it("is null off the cadence", () => {
    expect(turnBonusFor(2)).toBeNull();
    expect(turnBonusFor(10)).toBeNull();
    expect(turnBonusFor(30)).toBeNull();
  });
});
