/**
 * Board geometry and square-shape questions the Adjutant asks every turn.
 * Pure functions over a placement map — no snapshot, no strategy opinions.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/opponent-strategy.puml
 */

import type { Square } from "chess.js";

import {
  isSquareAttackedBy,
  parseSquare,
  sq,
  type ScPiece,
} from "../../board/placement";
import type { PieceColor } from "../../model/types";
import type { Move } from "./types";

export const FILES = "abcdefgh";

export const enemyOf = (color: PieceColor): PieceColor =>
  color === "w" ? "b" : "w";

export const rankOf = (s: Square): number => Number(s[1]);

export const chebyshev = (a: Square, b: Square): number => {
  const pa = parseSquare(a);
  const pb = parseSquare(b);
  return Math.max(Math.abs(pa.file - pb.file), Math.abs(pa.rank - pb.rank));
};

export const neighbors = (from: Square): Square[] => {
  const { file, rank } = parseSquare(from);
  const out: Square[] = [];
  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      if (df === 0 && dr === 0) continue;
      const at = sq(file + df, rank + dr);
      if (at) out.push(at);
    }
  }
  return out;
};

/** Contested-square pull: d/e + ranks 4/5 strong, c/f + 3/6 weaker. */
export const centerScore = (s: Square): number => {
  const file = FILES.indexOf(s[0]!);
  const rank = rankOf(s);
  const fc = file >= 3 && file <= 4 ? 2 : file >= 2 && file <= 5 ? 1 : 0;
  const rc = rank >= 4 && rank <= 5 ? 2 : rank >= 3 && rank <= 6 ? 1 : 0;
  return fc + rc;
};

/** True for the d4–e5 siege / mine hub (and immediate neighbours d5/e4). */
export const isSiegeHub = (s: Square): boolean => {
  const file = FILES.indexOf(s[0]!);
  const rank = rankOf(s);
  return file >= 3 && file <= 4 && rank >= 4 && rank <= 5;
};

/** Flank mine corridors once the centre hub is already mined. */
export const isFlankMineFile = (s: Square): boolean => {
  const f = s[0];
  return f === "a" || f === "h";
};

/** Destination is empty and not covered by the enemy. */
export const isSafeSquare = (
  map: Map<Square, ScPiece>,
  at: Square,
  enemy: PieceColor,
): boolean => !map.has(at) && !isSquareAttackedBy(map, at, enemy);

/** Occupancy after one classical move, honouring fire-in-place siege rooks. */
export const cloneWithMove = (
  map: Map<Square, ScPiece>,
  move: Move,
  sieged?: ReadonlySet<Square>,
): Map<Square, ScPiece> => {
  const next = new Map(map);
  const piece = next.get(move.from);
  if (!piece) return next;
  // A sieged rook fires in place — the resolver will not relocate it.
  if (move.firesInPlace || (piece.type === "r" && sieged?.has(move.from))) {
    next.delete(move.to);
    return next;
  }
  next.delete(move.from);
  next.set(move.to, {
    type: move.promotion ?? piece.type,
    color: piece.color,
  });
  return next;
};
