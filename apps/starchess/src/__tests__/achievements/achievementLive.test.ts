import { parseScFen } from "@chess-coach/starchess-core";
import { beforeEach, describe, expect, it } from "vitest";

import {
  careerAchievementLevels,
  careerWins,
  ensureAchievementLive,
  finalizeAchievementLive,
  noteSettledPlies,
  resetAchievementLive,
} from "~/achievements/achievementLive";

const OPENING = parseScFen("SCFEN|4k3/P7/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:");
const PROMOTED = "Q3k3/8/8/8/8/8/8/4K3";

const win = (id: string, opponent: "naive" | "strategic" | undefined = "naive") => ({
  id,
  result: "win" as const,
  opponent,
});

beforeEach(() => {
  localStorage.clear();
  resetAchievementLive();
});

describe("finalizeAchievementLive", () => {
  it("returns levels announced mid-game, even on a loss", () => {
    ensureAchievementLive("m1", "w", OPENING);
    noteSettledPlies([
      { turn: 2, placement: PROMOTED, promotions: [{ color: "w", from: "a7", at: "a8" }] },
    ]);
    const earned = finalizeAchievementLive("loss", "naive", []);
    expect(earned.map((b) => [b.shortId, b.level])).toEqual([["gogo", 1]]);
  });

  it("lists each badge once, at the highest level the match reached", () => {
    ensureAchievementLive("m2", "w", OPENING);
    noteSettledPlies([
      { turn: 2, placement: PROMOTED, promotions: [{ color: "w", at: "a8" }] },
      { turn: 3, placement: PROMOTED, promotions: [{ color: "w", at: "a8" }] },
    ]);
    const earned = finalizeAchievementLive("draw", "naive", []);
    expect(earned.map((b) => [b.shortId, b.level])).toEqual([["gogo", 2]]);
  });

  it("counts the 50th career win from history plus kept ids", () => {
    const history = Array.from({ length: 49 }, (_, i) => win(`h${i}`));
    ensureAchievementLive("m100", "w", OPENING);
    const earned = finalizeAchievementLive("win", "naive", history);
    expect(earned.find((b) => b.shortId === "beat50")?.level).toBe(1);
    // The win is kept by id, so evicting every replay from history loses nothing.
    expect(careerAchievementLevels([]).beat50).toBe(1);
  });
});

describe("careerWins", () => {
  it("unions kept ids with history wins, without double counting", () => {
    const wins = careerWins({ wins: {}, winIds: { naive: ["a", "b"] } }, [
      win("b"),
      win("c"),
      { id: "d", result: "loss", opponent: "naive" },
    ]);
    expect(wins).toEqual({ naive: 3 });
  });

  it("ignores arena imports and treats a legacy counter as a floor", () => {
    const wins = careerWins({ wins: { naive: 5 }, winIds: {} }, [
      win("a"),
      win("arena", undefined),
    ]);
    expect(wins).toEqual({ naive: 5 });
  });

  it("recognizes wins recorded before the ledger existed", () => {
    const history = Array.from({ length: 50 }, (_, i) => win(`old${i}`, "strategic"));
    expect(careerAchievementLevels(history)).toEqual({ beat: 2, beat50: 2 });
  });
});
