// SPEC: _spec/_plans/starchess-achievements.puml
/**
 * Achievement roster. One family is one gallery card; five rows are its levels.
 * Human Training copy is "Beat the Adjutant" — the level names Naive through RLCD.
 * Twelve families. Human Training is one win and one hundred wins.
 */
import {
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
      count: 1 | 100;
      description: string;
    }
  | {
      scale: "score";
      goal: "atLeast" | "atMost";
      thresholds: readonly [number, number, number, number, number];
      description: string | ((threshold: number) => string);
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
    description: "Beat the Adjutant",
  },
  {
    shortId: "beat100",
    title: "Human Training",
    difficulty: "easy",
    type: "count",
    measure: { kind: "opponentWins", count: 100 },
    scale: "adjutant",
    count: 100,
    description: "Beat the Adjutant 100 times",
  },
  {
    shortId: "flawless",
    title: "Flawless Training",
    difficulty: "hard",
    type: "scfen",
    measure: { kind: "flawlessWin" },
    scale: "adjutant",
    count: 1,
    description: "Beat the Adjutant without receiving any damage on your Command Center",
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
    description: "Get material advantage from a single piece",
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
    description: "Promote Marines in a game",
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
    description: "A Marine intercepts an attack and dies",
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
    description: "Have full vision of the board for consecutive turns",
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
    description: "Attack enemies using Mines in a game",
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
    description: "Eliminate BattleShips using a Mecha in a game",
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
    description: "Use the BattleShip's jump in consecutive turns",
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
    description: "Capture enemy units at a 3x3 radius around your Command Center",
  },
];

const expand = (family: Family): Achievement[] =>
  LEVELS.map((level) => {
    const material = ACHIEVEMENT_MATERIALS[level];
    const threshold = family.scale === "adjutant" ? family.count : family.thresholds[level - 1];
    const description =
      family.scale === "adjutant"
        ? family.description
        : typeof family.description === "string"
          ? family.description
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
