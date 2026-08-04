/**
 * Planning intent overlays — ghost destination rings + canister badges from
 * the live SCFEN queue (not resolve / DualNav review).
 */

import type { Square } from "chess.js";

import type { PieceColor, ScAction } from "~/types/starchess";

export type IntentDestGhost = {
  at: Square;
  color: PieceColor;
};

export type IntentCanisterGhost = {
  at: Square;
  color: PieceColor;
};

export type IntentOverlays = {
  /** Dashed border-only rings on queued destinations. */
  destinations: IntentDestGhost[];
  /** Ghost vespene canister over units with a queued special. */
  canisters: IntentCanisterGhost[];
};

/** Map planning `Q:` actions → board ghosts (intent squares, not resolved). */
export const intentOverlaysFromQueue = (
  actions: readonly ScAction[] | undefined,
): IntentOverlays => {
  const destinations: IntentDestGhost[] = [];
  const canisters: IntentCanisterGhost[] = [];
  const seenDest = new Set<string>();
  const seenCan = new Set<string>();

  for (const a of actions ?? []) {
    if (a.timing === "C") {
      const key = `${a.color}:${a.to}`;
      if (!seenDest.has(key)) {
        seenDest.add(key);
        destinations.push({ at: a.to, color: a.color });
      }
      continue;
    }
    // B / F specials — canister on the unit; destination ring when `to` is set.
    const canKey = `${a.color}:${a.from}`;
    if (!seenCan.has(canKey)) {
      seenCan.add(canKey);
      canisters.push({ at: a.from, color: a.color });
    }
    if (a.to) {
      const key = `${a.color}:${a.to}`;
      if (!seenDest.has(key)) {
        seenDest.add(key);
        destinations.push({ at: a.to, color: a.color });
      }
    }
  }

  return { destinations, canisters };
};
