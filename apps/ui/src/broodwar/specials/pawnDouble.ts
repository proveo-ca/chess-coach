import type { Color, Square } from "chess.js";
import { Chess } from "chess.js";

/** Two squares forward for a pawn, or null if off-board. */
export const pawnDoubleTarget = (square: Square, color: Color): Square | null => {
  const file = square[0]!;
  const rank = Number(square[1]);
  const dest = color === "w" ? rank + 2 : rank - 2;
  if (dest < 1 || dest > 8) return null;
  return `${file}${dest}` as Square;
};

/** One square forward for a pawn, or null if off-board. */
export const pawnSingleTarget = (square: Square, color: Color): Square | null => {
  const file = square[0]!;
  const rank = Number(square[1]);
  const dest = color === "w" ? rank + 1 : rank - 1;
  if (dest < 1 || dest > 8) return null;
  return `${file}${dest}` as Square;
};

export const isPawnStartRank = (square: Square, color: Color): boolean =>
  color === "w" ? square[1] === "2" : square[1] === "7";

/**
 * Classical chess.js double-step: start rank, clear path, legal `.move`.
 * Side-to-move in `fen` is forced to the pawn’s color for the probe.
 */
export const canClassicalPawnDouble = (fen: string, square: Square): boolean => {
  const probe = new Chess();
  try {
    probe.load(fen);
  } catch {
    return false;
  }
  const piece = probe.get(square);
  if (!piece || piece.type !== "p") return false;
  const to = pawnDoubleTarget(square, piece.color);
  if (!to) return false;

  // Probe as the pawn’s side so `.moves` is meaningful mid-BW planning.
  const parts = probe.fen().split(" ");
  parts[1] = piece.color;
  try {
    probe.load(parts.join(" "));
  } catch {
    return false;
  }
  return probe.moves({ square, verbose: true }).some((m) => m.to === to);
};

/**
 * Brood War gas step geometry: +1 forward with the destination empty.
 * Does not require the classical start rank — the canister is one extra square.
 */
export const canBwPawnSingle = (fen: string, square: Square): boolean => {
  const g = new Chess();
  try {
    g.load(fen);
  } catch {
    return false;
  }
  const piece = g.get(square);
  if (!piece || piece.type !== "p") return false;
  const to = pawnSingleTarget(square, piece.color);
  return to != null && g.get(to) == null;
};
