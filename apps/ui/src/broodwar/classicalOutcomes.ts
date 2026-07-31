/**
 * Classical chess terminal conditions do **not** apply in Brood War.
 * Wins are king HP → 0 only (see BROODWAR_MODE.md). Stalemate, insufficient
 * material, threefold / fifty-move draws, and classical checkmate banners
 * must never surface on Brood War boards.
 */

/** Board props that mark a Brood War / Nerd chess surface. */
export type BroodWarBoardFlags = {
  fogOfWar?: boolean;
  variant?: string | null;
};

export const isBroodWarBoard = (flags: BroodWarBoardFlags): boolean =>
  flags.fogOfWar === true || (flags.variant != null && flags.variant !== "");
