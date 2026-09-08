// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
/**
 * Spider Mine siting and hub occupancy — the map-control read of the board.
 */

import type { Square } from "chess.js";

import type { ScPiece } from "../../board/placement";
import { minesFor } from "../../board/mines";
import type { PieceColor, ScFenSnapshot } from "../../model/types";
import { isFlankMineFile, isSiegeHub } from "./geometry";

/** Our side already planted on d4–e5 — open a/h as the next mine sites. */
export const hubMineTaken = (snap: ScFenSnapshot, us: PieceColor): boolean =>
  minesFor(snap.mines, us).some((m) => isSiegeHub(m.at));

/**
 * Preferred Spider Mine sites: hub first; a/h files only after hub is taken.
 * Returns a weight multiplier (0 = do not plant here).
 */
export const mineSiteWeight = (at: Square, hubTaken: boolean): number => {
  if (isSiegeHub(at)) return 1;
  if (hubTaken && isFlankMineFile(at)) return 0.9;
  return 0;
};

/** Our side already occupies the d4–e5 hub — map control asserted. */
export const hasHubPresence = (
  map: Map<Square, ScPiece>,
  us: PieceColor,
): boolean => {
  for (const [square, piece] of map) {
    if (piece.color === us && isSiegeHub(square)) return true;
  }
  return false;
};
