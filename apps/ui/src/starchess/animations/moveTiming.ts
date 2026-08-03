import type { PieceSymbol, Square } from "chess.js";

import { vecBetween } from "~/starchess/animations/boardGeom";
import { MOVE_SQUARE_MS } from "~/starchess/constants";

/** Knight is the only piece that travels at half the per-square rate. */
export const knightSquareMs = (): number => MOVE_SQUARE_MS / 2;

/**
 * Squares of travel for quiet-move VFX.
 * Sliders use Chebyshev; knights use L-path length (|df|+|dr| = 3).
 */
export const moveTravelSquares = (
  from: Square,
  to: Square,
  piece?: PieceSymbol,
): number => {
  const { df, dr } = vecBetween(from, to);
  if (piece === "n") return Math.max(1, Math.abs(df) + Math.abs(dr));
  return Math.max(1, Math.abs(df), Math.abs(dr));
};

const squareMsFor = (piece?: PieceSymbol): number =>
  piece === "n" ? knightSquareMs() : MOVE_SQUARE_MS;

/** Total slide / L-path duration: per-square ms × squares (knight = half rate). */
export const moveDurationMs = (
  from: Square,
  to: Square,
  piece?: PieceSymbol,
): number => moveTravelSquares(from, to, piece) * squareMsFor(piece);

/**
 * Knight elbow (end of length-2 leg) — matches `knightLMove` 67% keyframe
 * when long=2 and short=1.
 */
export const knightElbowMs = (from: Square, to: Square): number => {
  const { df, dr } = vecBetween(from, to);
  return Math.max(Math.abs(df), Math.abs(dr)) * knightSquareMs();
};
