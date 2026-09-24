// SPEC: _spec/_plans/starchess-achievements.puml
/**
 * Achievement roster. One family is one gallery card; five rows are its levels.
 * Every description names its level: a score family states the threshold, an
 * Adjutant family names the tier beaten (Naive, Strategic, ML, RLHF, RLCD).
 * Twelve families. Human Training is one win and fifty wins.
 */
import {
  ADJUTANT_BY_LEVEL,
  ACHIEVEMENT_DESCRIPTION_MAX,
  ACHIEVEMENT_MATERIALS,
  ACHIEVEMENT_TITLE_MAX,
  achievementId,
  type Achievement,
  type AchievementDifficulty,
  type AchievementLevel,
  type AchievementMeasure,
  type AchievementType,
} from "~/achievements/types";

const LEVELS: readonly AchievementLevel[] = [1, 2, 3, 4, 5];

/** `1 Marine`, `3 Marines` — counts in copy read naturally at every level. */
const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export const achievementGlyphUrl = (shortId: string): string =>
  `${import.meta.env.BASE_URL}achievements/${shortId}.svg`;

type Family = {
  shortId: string;
  title: string;
  difficulty: AchievementDifficulty;
  type: AchievementType;
  measure: AchievementMeasure;
} & (
  | {
      scale: "adjutant";
      /** Career wins against that Adjutant tier or a harder one. */
      count: 1 | 50;
      /** Given the tier's display name (`Naive` … `RLCD`). */
      description: (adjutant: string) => string;
    }
  | {
      scale: "score";
      goal: "atLeast" | "atMost";
      thresholds: readonly [number, number, number, number, number];
      description: (threshold: number) => string;
    }
);

const FAMILIES: readonly Family[] = [
  {
    shortId: "beat",
    title: "Human Training",
    difficulty: "easy",
    type: "count",
    measure: { kind: "opponentWins", count: 1 },
    scale: "adjutant",
    count: 1,
    description: (adjutant) => `Beat the ${adjutant} Adjutant`,
  },
  {
    shortId: "beat50",
    title: "Human Training",
    difficulty: "easy",
    type: "count",
    measure: { kind: "opponentWins", count: 50 },
    scale: "adjutant",
    count: 50,
    description: (adjutant) => `Beat the ${adjutant} Adjutant 50 times`,
  },
  {
    shortId: "flawless",
    title: "Flawless Training",
    difficulty: "hard",
    type: "scfen",
    measure: { kind: "flawlessWin" },
    scale: "adjutant",
    count: 1,
    description: (adjutant) => `Beat the ${adjutant} Adjutant with no damage to your Command Center`,
  },
  {
    shortId: "cheese",
    title: "Cheese Master",
    difficulty: "easy",
    type: "scfen",
    measure: { kind: "winWithinTurns" },
    scale: "score",
    goal: "atMost",
    thresholds: [20, 16, 13, 11, 9],
    description: (turns) => `Win a game in ${turns} turns or less`,
  },
  {
    shortId: "stonks",
    title: "Stonks",
    difficulty: "easy",
    type: "analysis",
    measure: { kind: "pieceMaterialSwing" },
    scale: "score",
    goal: "atLeast",
    thresholds: [3, 6, 10, 15, 20],
    description: (n) => `Get +${n} material advantage from a single piece`,
  },
  {
    shortId: "gogo",
    title: "GO GO GO!",
    difficulty: "hard",
    type: "analysis",
    measure: { kind: "marinePromotions" },
    scale: "score",
    goal: "atLeast",
    thresholds: [1, 2, 3, 5, 7],
    description: (n) => `Promote ${count(n, "Marine")} in a game`,
  },
  {
    shortId: "medal",
    title: "Medal of Honor",
    difficulty: "impossible",
    type: "analysis",
    // Marine Stim is the gas double-step (`pawnDouble`) used to save a unit.
    measure: { kind: "marineStimDefenses" },
    scale: "score",
    goal: "atLeast",
    thresholds: [1, 3, 5, 7, 10],
    description: (n) => `Have ${count(n, "Marine")} intercept an attack and die`,
  },
  {
    shortId: "vision",
    title: "Ready to roll out!",
    difficulty: "hard",
    type: "scfen",
    measure: { kind: "fullVisionStreak" },
    scale: "score",
    goal: "atLeast",
    thresholds: [2, 4, 7, 10, 15],
    description: (n) => `Have full vision of the board for ${n} consecutive turns`,
  },
  {
    shortId: "mines",
    title: "Is that it?",
    difficulty: "hard",
    type: "analysis",
    measure: { kind: "mineAttacks" },
    scale: "score",
    goal: "atLeast",
    thresholds: [1, 2, 4, 7, 10],
    description: (n) => `Attack ${count(n, "enemy", "enemies")} using Mines in a game`,
  },
  {
    shortId: "mecha",
    title: "Target Designated",
    difficulty: "impossible",
    type: "analysis",
    measure: { kind: "mechaBattleShipKills" },
    scale: "score",
    goal: "atLeast",
    thresholds: [1, 2, 3, 5, 7],
    description: (n) => `Eliminate ${count(n, "BattleShip")} using a Mecha in a game`,
  },
  {
    shortId: "juke",
    title: "Make it happen",
    difficulty: "hard",
    type: "scfen",
    measure: { kind: "battleShipJumpStreak" },
    scale: "score",
    goal: "atLeast",
    thresholds: [2, 4, 7, 10, 15],
    description: (n) => `Use the BattleShip's jump in ${n} consecutive turns`,
  },
  {
    shortId: "light",
    title: "Let there be Light",
    difficulty: "hard",
    type: "scfen",
    measure: { kind: "ccRadiusCaptures" },
    scale: "score",
    goal: "atLeast",
    thresholds: [3, 7, 10, 14, 20],
    description: (n) => `Capture ${count(n, "enemy unit")} at a 3x3 radius around your Command Center`,
  },
];

const expand = (family: Family): Achievement[] =>
  LEVELS.map((level) => {
    const material = ACHIEVEMENT_MATERIALS[level];
    const threshold = family.scale === "adjutant" ? family.count : family.thresholds[level - 1];
    const description =
      family.scale === "adjutant"
        ? family.description(ADJUTANT_BY_LEVEL[level].name)
        : family.description(threshold);
    if (family.title.length > ACHIEVEMENT_TITLE_MAX) {
      throw new Error(`title too long: ${family.shortId}`);
    }
    if (description.length > ACHIEVEMENT_DESCRIPTION_MAX || description.length === 0) {
      throw new Error(`description length: ${family.shortId} level ${level}`);
    }
    return {
      id: achievementId(level, family.type, family.shortId),
      shortId: family.shortId,
      title: family.title,
      level,
      difficulty: family.difficulty,
      type: family.type,
      description,
      icon: achievementGlyphUrl(family.shortId),
      material: material.id,
      threshold,
      goal: family.scale === "adjutant" ? "atLeast" : family.goal,
      scale: family.scale,
      measure: family.measure,
    };
  });

export const ACHIEVEMENTS: readonly Achievement[] = FAMILIES.flatMap(expand);

export const ACHIEVEMENT_SHORT_IDS: readonly string[] = FAMILIES.map((family) => family.shortId);

export const achievementsFor = (shortId: string): readonly Achievement[] =>
  ACHIEVEMENTS.filter((achievement) => achievement.shortId === shortId);
