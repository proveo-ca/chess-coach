import type { PieceSymbol, Square } from "chess.js";

import { vecBetween } from "~/presentation/animations/boardGeom";
import { knightLegVecs, squareAt } from "~/presentation/animations/attackVectors";
import { rayBetween } from "@chess-coach/starchess-core";
import { MOVE_SQUARE_MS, STIM_MOVE_SQUARE_MS } from "~/presentation/constants";

/** Knight is the only piece that travels at half the per-square rate. */
export const knightSquareMs = (): number => MOVE_SQUARE_MS / 2;

/** Pawn gas-step stim — half classical travel (100ms / square). */
export const stimSquareMs = (): number => STIM_MOVE_SQUARE_MS;

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

export type MoveSquareMsOpts = {
  /** Pawn / marine gas-step — {@link STIM_MOVE_SQUARE_MS}. */
  stim?: boolean;
};

const squareMsFor = (piece?: PieceSymbol, opts?: MoveSquareMsOpts): number => {
  if (opts?.stim) return stimSquareMs();
  return piece === "n" ? knightSquareMs() : MOVE_SQUARE_MS;
};

/**
 * Ordered occupancy squares for a quiet move (inclusive `from` → `to`).
 * Sliders follow the ray; knights follow the L (long leg → elbow → short);
 * leaps are `[from, to]`.
 */
export const movePathSquares = (
  from: Square,
  to: Square,
  piece?: PieceSymbol,
): Square[] => {
  if (from === to) return [from];
  if (piece === "n") {
    const { leg1 } = knightLegVecs(vecBetween(from, to));
    const elbow = squareAt(from, leg1);
    if (!elbow) return [from, to];
    return [from, ...rayBetween(from, elbow), elbow, ...rayBetween(elbow, to), to];
  }
  if (piece === "k" || piece === "p") return [from, to];
  return [from, ...rayBetween(from, to), to];
};

/** Square the mover occupies after `elapsedMs` of slide (matches MoveAnimation timing). */
export const moveSquareAtElapsed = (
  from: Square,
  to: Square,
  piece: PieceSymbol | undefined,
  elapsedMs: number,
  opts?: MoveSquareMsOpts,
): Square => {
  const path = movePathSquares(from, to, piece);
  const ms = squareMsFor(piece, opts);
  const i = Math.min(path.length - 1, Math.max(0, Math.floor(elapsedMs / ms)));
  return path[i]!;
};

/** Total slide / L-path duration: per-square ms × squares (knight / stim rates). */
export const moveDurationMs = (
  from: Square,
  to: Square,
  piece?: PieceSymbol,
  opts?: MoveSquareMsOpts,
): number => moveTravelSquares(from, to, piece) * squareMsFor(piece, opts);

/**
 * Knight elbow (end of length-2 leg) — matches `knightLMove` 67% keyframe
 * when long=2 and short=1.
 */
export const knightElbowMs = (from: Square, to: Square): number => {
  const { df, dr } = vecBetween(from, to);
  return Math.max(Math.abs(df), Math.abs(dr)) * knightSquareMs();
};
