import { describe, expect, it } from "vitest";

import { applyUnlocks } from "~/achievements/unlocks";

describe("achievement unlocks", () => {
  it("keeps the higher level for a family and drops the lower id", () => {
    const first = applyUnlocks(
      {},
      [{ shortId: "stonks", level: 1, type: "analysis" }],
      "game-a",
      1,
    );
    expect(first).toEqual({ "1-analysis-stonks": { gameId: "game-a", unlockedAt: 1 } });

    const raised = applyUnlocks(
      first,
      [{ shortId: "stonks", level: 2, type: "analysis" }],
      "game-b",
      2,
    );
    expect(raised).toEqual({ "2-analysis-stonks": { gameId: "game-b", unlockedAt: 2 } });

    const kept = applyUnlocks(
      raised,
      [{ shortId: "stonks", level: 1, type: "analysis" }],
      "game-c",
      3,
    );
    expect(kept).toEqual(raised);
  });

  it("stores a second family beside the first", () => {
    const unlocks = applyUnlocks(
      { "2-analysis-stonks": { gameId: "game-b", unlockedAt: 2 } },
      [{ shortId: "medal", level: 1, type: "analysis" }],
      "game-d",
      4,
    );
    expect(Object.keys(unlocks).sort()).toEqual(["1-analysis-medal", "2-analysis-stonks"]);
  });
});
