// SPEC: _spec/_plans/starchess-achievements.puml
/**
 * Achievement identity. The id is `<level>-<type>-<shortId>`.
 * `difficulty` here is easy | hard | impossible — not Coach elo.
 * Level 1–5 is the material (wood → Anti-matter). On Adjutant-scaled
 * achievements the same level names which Adjutant was beaten.
 */

export const ACHIEVEMENT_TITLE_MAX = 25;
export const ACHIEVEMENT_DESCRIPTION_MAX = 75;
export const ACHIEVEMENT_LEVEL_MAX = 5;

export type AchievementLevel = 1 | 2 | 3 | 4 | 5;
export type AchievementDifficulty = "easy" | "hard" | "impossible";
export type AchievementType = "scfen" | "count" | "analysis";

export type AchievementMaterialId = "wood" | "silver" | "gold" | "btc" | "antimatter";

export type AchievementMaterial = {
  id: AchievementMaterialId;
  /** Badge name. Level 1 stays "wood"; the others are proper names. */
  label: "wood" | "Silver" | "Gold" | "BTC" | "Anti-matter";
  fill: string;
};

export const ACHIEVEMENT_MATERIALS: Record<AchievementLevel, AchievementMaterial> = {
  1: { id: "wood", label: "wood", fill: "#8B5A2B" },
  2: { id: "silver", label: "Silver", fill: "#C0C0C0" },
  3: { id: "gold", label: "Gold", fill: "#D4AF37" },
  4: { id: "btc", label: "BTC", fill: "#F7931A" },
  5: { id: "antimatter", label: "Anti-matter", fill: "#C084FC" },
};

/** Who a level stands for when the achievement scales with the Adjutant. */
export type AdjutantTier = "naive" | "strategic" | "ml" | "rlhf" | "rlcd";

export const ADJUTANT_BY_LEVEL: Record<
  AchievementLevel,
  { tier: AdjutantTier; name: string }
> = {
  1: { tier: "naive", name: "Naive" },
  2: { tier: "strategic", name: "Strategic" },
  3: { tier: "ml", name: "ML" },
  4: { tier: "rlhf", name: "RLHF" },
  5: { tier: "rlcd", name: "RLCD" },
};

export const LEVEL_FOR_ADJUTANT: Record<AdjutantTier, AchievementLevel> = {
  naive: 1,
  strategic: 2,
  ml: 3,
  rlhf: 4,
  rlcd: 5,
};

const TIERS = new Set<string>(Object.keys(LEVEL_FOR_ADJUTANT));

/** Shipped scripts are naive | strategic. ML, RLHF, and RLCD are later tiers. */
export const tierForOpponent = (opponent: string | undefined): AdjutantTier | null =>
  opponent != null && TIERS.has(opponent) ? (opponent as AdjutantTier) : null;

export type AchievementId = `${AchievementLevel}-${AchievementType}-${string}`;

export type AchievementMeasure =
  | { kind: "opponentWins"; count: 1 | 50 }
  | { kind: "flawlessWin" }
  | { kind: "winWithinTurns" }
  | { kind: "pieceMaterialSwing" }
  | { kind: "marinePromotions" }
  | { kind: "marineStimDefenses" }
  | { kind: "fullVisionStreak" }
  | { kind: "mineAttacks" }
  | { kind: "mechaBattleShipKills" }
  | { kind: "battleShipJumpStreak" }
  | { kind: "ccRadiusCaptures" };

export type Achievement = {
  id: AchievementId;
  /** Groups the five levels of one badge. No hyphens, so the id splits cleanly. */
  shortId: string;
  title: string;
  level: AchievementLevel;
  difficulty: AchievementDifficulty;
  type: AchievementType;
  description: string;
  /** 60×60 SVG. The fill is that level's material. */
  icon: string;
  material: AchievementMaterialId;
  threshold: number;
  goal: "atLeast" | "atMost";
  /**
   * `adjutant`: the level names who was beaten (wood Naive … Anti-matter RLCD).
   * The description stays "Beat the Adjutant".
   * `score`: the level is the in-game threshold step. Material still marks it.
   */
  scale: "adjutant" | "score";
  measure: AchievementMeasure;
};

const ID_RE = /^([1-5])-(scfen|count|analysis)-([a-z][a-z0-9]*)$/;

export const achievementId = (
  level: AchievementLevel,
  type: AchievementType,
  shortId: string,
): AchievementId => `${level}-${type}-${shortId}`;

export const parseAchievementId = (
  id: string,
): { level: AchievementLevel; type: AchievementType; shortId: string } | null => {
  const match = ID_RE.exec(id);
  if (!match) return null;
  return {
    level: Number(match[1]) as AchievementLevel,
    type: match[2] as AchievementType,
    shortId: match[3]!,
  };
};
