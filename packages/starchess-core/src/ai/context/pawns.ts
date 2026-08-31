/**
 * Marine (marine) structure questions: promotion distance and file congestion.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
 */

import type { Square } from "chess.js";

import { parseSquare, type ScPiece } from "../../board/placement";
import type { PieceColor } from "../../model/types";

/**
 * Marine congestion — density in a file window, not total army size.
 * Congested when ≥{@link CLUSTER_PAWNS} of our marines sit in any
 * {@link CLUSTER_FILES} consecutive files (e.g. 7 marines across c–e).
 */
export const CLUSTER_FILES = 3;
export const CLUSTER_PAWNS = 7;

/** Progress toward our promotion rank (higher = closer). */
export const promoteProgress = (rank: number, us: PieceColor): number =>
  us === "b" ? 8 - rank : rank - 1;

/** Squares remaining until our last rank (0 = already there). */
export const stepsToPromotion = (rank: number, us: PieceColor): number =>
  us === "b" ? rank - 1 : 8 - rank;

/** True when `rank` is our last (promotion) rank. */
export const isLastRank = (rank: number, us: PieceColor): boolean =>
  us === "b" ? rank === 1 : rank === 8;

/**
 * True when our marines form a dense file cluster — ≥{@link CLUSTER_PAWNS}
 * marines inside any window of {@link CLUSTER_FILES} consecutive files.
 */
export const isPawnClustered = (
  map: Map<Square, ScPiece>,
  color: PieceColor,
): boolean => {
  const byFile = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const [square, piece] of map) {
    if (piece.color !== color || piece.type !== "p") continue;
    byFile[parseSquare(square).file] += 1;
  }
  for (let start = 0; start <= 8 - CLUSTER_FILES; start += 1) {
    let sum = 0;
    for (let i = 0; i < CLUSTER_FILES; i += 1) sum += byFile[start + i]!;
    if (sum >= CLUSTER_PAWNS) return true;
  }
  return false;
};
