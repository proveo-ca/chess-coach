// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
/**
 * Marine (marine) structure questions: promotion distance and file congestion.
 */

import type { Square } from "chess.js";

import { parseSquare, type ScPiece } from "../../board/placement";
import type { PieceColor } from "../../model/types";

/**
 * Marine congestion — density in a file window, not total army size.
 * Congested when ≥{@link CLUSTER_MARINES} of our marines sit in any
 * {@link CLUSTER_FILES} consecutive files (e.g. 7 marines across c–e).
 */
export const CLUSTER_FILES = 3;
export const CLUSTER_MARINES = 7;

/** Progress toward our promotion rank (higher = closer). */
export const promoteProgress = (rank: number, us: PieceColor): number =>
  us === "b" ? 8 - rank : rank - 1;

/**
 * A marine covers two ranks in one turn: the gas step lands in rank B and its
 * classical in rank C (`plans/stacks.ts` composes the pair). Both directions of
 * the promotion race are read in turns rather than squares, so the fact lives
 * here with the distance helpers rather than in either reader.
 */
export const RUNNER_RANKS_PER_TURN = 2;

/** Turns a marine needs to reach its promotion rank from `steps` squares out. */
export const turnsToPromote = (steps: number): number =>
  Math.ceil(steps / RUNNER_RANKS_PER_TURN);

/** Squares remaining until our last rank (0 = already there). */
export const stepsToPromotion = (rank: number, us: PieceColor): number =>
  us === "b" ? rank - 1 : 8 - rank;

/** True when `rank` is our last (promotion) rank. */
export const isLastRank = (rank: number, us: PieceColor): boolean =>
  us === "b" ? rank === 1 : rank === 8;

/**
 * True when our marines form a dense file cluster — ≥{@link CLUSTER_MARINES}
 * marines inside any window of {@link CLUSTER_FILES} consecutive files.
 */
export const isMarineClustered = (
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
    if (sum >= CLUSTER_MARINES) return true;
  }
  return false;
};
