// SPEC: _spec/_plans/starchess-achievements.puml
/**
 * Obtained achievement ids. The gallery reads this file plus career levels.
 */
import { reconcile } from "solid-js/store";

import { achievementsFor } from "~/achievements/catalog";
import { careerAchievementLevels } from "~/achievements/achievementLive";
import { applyUnlocks } from "~/achievements/unlocks";
import { parseAchievementId } from "~/achievements/types";
import { createPersistedStore } from "~/store/createPersistedStore";

const ACHIEVEMENT_KEY = "starchess_achievements";

type UnlockFile = { unlocks: Record<string, { gameId: string; unlockedAt: number }> };

const [state, setState] = createPersistedStore<UnlockFile>(ACHIEVEMENT_KEY, {
  unlocks: {},
});

export const noteAchievementUnlocks = (
  gameId: string,
  earned: readonly { shortId: string; level: 1 | 2 | 3 | 4 | 5 }[],
): void => {
  const rows = [];
  for (const item of earned) {
    const row = achievementsFor(item.shortId).find((entry) => entry.level === item.level);
    if (!row) continue;
    rows.push({ shortId: item.shortId, level: item.level, type: row.type });
  }
  if (rows.length === 0) return;
  setState(
    "unlocks",
    reconcile(applyUnlocks(state.unlocks, rows, gameId, Date.now())),
  );
};

export const unlockedLevel = (shortId: string): number => {
  let level = 0;
  for (const key of Object.keys(state.unlocks)) {
    const parsed = parseAchievementId(key);
    if (parsed?.shortId === shortId && parsed.level > level) level = parsed.level;
  }
  const career = careerAchievementLevels();
  if (shortId === "beat") level = Math.max(level, career.beat);
  if (shortId === "beat100") level = Math.max(level, career.beat100);
  return level;
};

export const witnessGameId = (shortId: string): string | null => {
  let best = 0;
  let gameId: string | null = null;
  for (const [key, record] of Object.entries(state.unlocks)) {
    const parsed = parseAchievementId(key);
    if (!parsed || parsed.shortId !== shortId || !record.gameId) continue;
    if (parsed.level < best) continue;
    best = parsed.level;
    gameId = record.gameId;
  }
  return gameId;
};
