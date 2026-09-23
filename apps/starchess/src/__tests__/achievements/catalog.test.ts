import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS, achievementsFor } from "~/achievements/catalog";
import {
  ACHIEVEMENT_DESCRIPTION_MAX,
  ACHIEVEMENT_MATERIALS,
  ACHIEVEMENT_TITLE_MAX,
  ADJUTANT_BY_LEVEL,
  parseAchievementId,
  tierForOpponent,
} from "~/achievements/types";

const by = (shortId: string, level: number) => {
  const found = achievementsFor(shortId).find((achievement) => achievement.level === level);
  if (!found) throw new Error(`missing ${shortId} level ${level}`);
  return found;
};

describe("achievement catalog", () => {
  it("keeps titles and descriptions inside the limits", () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.title.length).toBeGreaterThan(0);
      expect(achievement.title.length).toBeLessThanOrEqual(ACHIEVEMENT_TITLE_MAX);
      expect(achievement.description.length).toBeGreaterThan(0);
      expect(achievement.description.length).toBeLessThanOrEqual(ACHIEVEMENT_DESCRIPTION_MAX);
      expect(achievement.level).toBeGreaterThanOrEqual(1);
      expect(achievement.level).toBeLessThanOrEqual(5);
    }
  });

  it("uses a level-type-shortId and a 60x60 material icon", () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(parseAchievementId(achievement.id)).toEqual({
        level: achievement.level,
        type: achievement.type,
        shortId: achievement.shortId,
      });
      expect(achievement.icon).toBe(
        `${import.meta.env.BASE_URL}achievements/${achievement.shortId}.svg`,
      );
      expect(achievement.material).toBe(ACHIEVEMENT_MATERIALS[achievement.level].id);
    }
  });

  it("gives each family five levels and one card's worth of short ids", () => {
    const shortIds = [...new Set(ACHIEVEMENTS.map((achievement) => achievement.shortId))];
    expect(shortIds).toEqual([
      "beat",
      "beat100",
      "flawless",
      "cheese",
      "stonks",
      "gogo",
      "medal",
      "vision",
      "mines",
      "mecha",
      "juke",
      "light",
    ]);
    for (const shortId of shortIds) {
      expect(achievementsFor(shortId).map((achievement) => achievement.level)).toEqual([
        1, 2, 3, 4, 5,
      ]);
    }
  });

  it("says Beat the Adjutant and lets the level name who fell", () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(by("beat", level).description).toBe("Beat the Adjutant");
      expect(by("beat100", level).description).toBe("Beat the Adjutant 100 times");
      expect(by("beat", level).title).toBe("Human Training");
      expect(by("beat", level).difficulty).toBe("easy");
      expect(by("beat", level).type).toBe("count");
      expect(by("beat", level).scale).toBe("adjutant");
    }
    expect(by("beat", 1).description).not.toMatch(/Naive|Strategic/);
    expect(ADJUTANT_BY_LEVEL[1].name).toBe("Naive");
    expect(ADJUTANT_BY_LEVEL[2].name).toBe("Strategic");
    expect(ADJUTANT_BY_LEVEL[5].name).toBe("RLCD");
    expect(tierForOpponent("strategic")).toBe("strategic");
    expect(tierForOpponent("ml")).toBe("ml");
    expect(tierForOpponent(undefined)).toBeNull();
  });

  it("levels Human Training by how many wins that tier took", () => {
    expect(by("beat", 2).threshold).toBe(1);
    expect(by("beat100", 5).threshold).toBe(100);
  });

  it("records the score ladders", () => {
    expect(achievementsFor("cheese").map((achievement) => achievement.threshold)).toEqual([
      20, 16, 13, 11, 9,
    ]);
    expect(by("cheese", 1).description).toBe("Win a game in 20 turns or less");
    expect(by("cheese", 1).goal).toBe("atMost");
    expect(by("cheese", 1).difficulty).toBe("easy");
    expect(by("cheese", 5).description).toBe("Win a game in 9 turns or less");

    expect(achievementsFor("stonks").map((achievement) => achievement.threshold)).toEqual([
      3, 6, 10, 15, 20,
    ]);
    expect(by("stonks", 1).difficulty).toBe("easy");
    expect(achievementsFor("gogo").map((achievement) => achievement.threshold)).toEqual([
      1, 2, 3, 5, 7,
    ]);
    expect(achievementsFor("medal").map((achievement) => achievement.threshold)).toEqual([
      1, 3, 5, 7, 10,
    ]);
    expect(by("medal", 1).difficulty).toBe("impossible");
    expect(achievementsFor("vision").map((achievement) => achievement.threshold)).toEqual([
      2, 4, 7, 10, 15,
    ]);
    expect(achievementsFor("mines").map((achievement) => achievement.threshold)).toEqual([
      1, 2, 4, 7, 10,
    ]);
    expect(achievementsFor("mecha").map((achievement) => achievement.threshold)).toEqual([
      1, 2, 3, 5, 7,
    ]);
    expect(by("mecha", 1).difficulty).toBe("impossible");
    expect(achievementsFor("juke").map((achievement) => achievement.threshold)).toEqual([
      2, 4, 7, 10, 15,
    ]);
    expect(by("juke", 1).title).toBe("Make it happen");
    expect(achievementsFor("light").map((achievement) => achievement.threshold)).toEqual([
      3, 7, 10, 14, 20,
    ]);
  });

  it("names the materials in level order", () => {
    expect(ACHIEVEMENT_MATERIALS[1].label).toBe("wood");
    expect(ACHIEVEMENT_MATERIALS[2].label).toBe("Silver");
    expect(ACHIEVEMENT_MATERIALS[3].label).toBe("Gold");
    expect(ACHIEVEMENT_MATERIALS[4].label).toBe("BTC");
    expect(ACHIEVEMENT_MATERIALS[5].label).toBe("Anti-matter");
  });
});
