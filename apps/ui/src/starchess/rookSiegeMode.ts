/**
 * Effective Siege Tank mode after queued B `rookSiege` intents.
 * Intent siege (enter) locks mobility before classical; intent unsiege unlocks it.
 */

import type { Square } from "chess.js";

import type { RookMode, ScAction } from "~/starchess/types";

/** Whether `from` is sieged after applying all B `rookSiege` toggles in `actions`. */
export const isRookSiegedAfterB = (
  from: Square,
  siegedRooks: readonly Square[] | undefined,
  actions: readonly ScAction[] | undefined,
): boolean => {
  let sieged = (siegedRooks ?? []).includes(from);
  for (const a of actions ?? []) {
    if (a.timing !== "B" || a.kind !== "rookSiege" || a.from !== from) continue;
    sieged = !sieged;
  }
  return sieged;
};

/** Tank ↔ siege after B intents (destination ghost / mobility). */
export const rookModeAfterB = (
  from: Square,
  siegedRooks: readonly Square[] | undefined,
  actions: readonly ScAction[] | undefined,
): RookMode => (isRookSiegedAfterB(from, siegedRooks, actions) ? "siege" : "tank");
