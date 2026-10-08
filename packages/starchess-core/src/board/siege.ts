/**
 * Effective Siege Tank mode after queued B `siegeMode` intents.
 * Intent siege (enter) locks mobility before classical; intent unsiege unlocks it.
 */

import type { Square } from "../model/square";
import type { TankMode, ScActionInput } from "../model/types";

/** Whether `from` is sieged after applying all B `siegeMode` toggles in `actions`. */
export const isTankSiegedAfterB = (
  from: Square,
  siegedTanks: readonly Square[] | undefined,
  actions: readonly ScActionInput[] | undefined,
): boolean => {
  let sieged = (siegedTanks ?? []).includes(from);
  for (const a of actions ?? []) {
    if (a.timing !== "B" || a.kind !== "siegeMode" || a.from !== from) continue;
    sieged = !sieged;
  }
  return sieged;
};

/** Tank ↔ siege after B intents (destination ghost / mobility). */
export const tankModeAfterB = (
  from: Square,
  siegedTanks: readonly Square[] | undefined,
  actions: readonly ScActionInput[] | undefined,
): TankMode => (isTankSiegedAfterB(from, siegedTanks, actions) ? "siege" : "tank");
