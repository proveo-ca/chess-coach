/**
 * Classical chess terminal conditions do **not** apply in StarChess.
 * Wins are king HP → 0 only (see STARCHESS_MODE.md). Stalemate, insufficient
 * material, threefold / fifty-move draws, and classical checkmate banners
 * must never surface on StarChess boards.
 */

/** Board props that mark a StarChess / Nerd chess surface. */
export type StarChessBoardFlags = {
  fogOfWar?: boolean;
  variant?: string | null;
};

export const isStarChessBoard = (flags: StarChessBoardFlags): boolean =>
  flags.fogOfWar === true || (flags.variant != null && flags.variant !== "");
