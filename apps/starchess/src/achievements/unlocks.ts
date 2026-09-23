// SPEC: _spec/_plans/starchess-achievements.puml
/**
 * Fold a match's new levels into the unlock map.
 * A higher level replaces the lower id for the same shortId.
 */
import {
  achievementId,
  parseAchievementId,
  type AchievementLevel,
  type AchievementType,
} from "~/achievements/types";

export type AchievementUnlock = { gameId: string; unlockedAt: number };

export type EarnedAchievement = {
  shortId: string;
  level: AchievementLevel;
  type: AchievementType;
};

export const applyUnlocks = (
  unlocks: Record<string, AchievementUnlock>,
  earned: readonly EarnedAchievement[],
  gameId: string,
  unlockedAt: number,
): Record<string, AchievementUnlock> => {
  const next = { ...unlocks };
  for (const item of earned) {
    let keep = false;
    for (const key of Object.keys(next)) {
      const parsed = parseAchievementId(key);
      if (!parsed || parsed.shortId !== item.shortId) continue;
      if (parsed.level >= item.level) {
        keep = true;
        break;
      }
      delete next[key];
    }
    if (keep) continue;
    next[achievementId(item.level, item.type, item.shortId)] = { gameId, unlockedAt };
  }
  return next;
};
