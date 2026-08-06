/**
 * StarChess board occupancy helpers (rules-side). Classic chess.js is not used
 * for legality — only optional render via toClassicFen / loadFen.
 *
 * // SPEC: _spec/apps/ui/starchess/resolve.puml
 */

import type { Square } from "chess.js";

import { toClassicFen } from "~/starchess/scfen";
import type { StarChessColor } from "~/starchess/types";

export type ScPiece = {
  type: "p" | "n" | "b" | "r" | "q" | "k";
  color: StarChessColor;
};

const FILES = "abcdefgh";

export const sq = (file: number, rank: number): Square | null => {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${FILES[file]}${rank}` as Square;
};

export const parseSquare = (s: Square): { file: number; rank: number } => ({
  file: s.charCodeAt(0) - 97,
  rank: Number(s[1]),
});

/** Parse classic placement (FEN field 0) into a square → piece map. */
export const placementToMap = (placement: string): Map<Square, ScPiece> => {
  const map = new Map<Square, ScPiece>();
  const ranks = placement.split("/");
  if (ranks.length !== 8) throw new Error(`Bad placement: ${placement}`);
  for (let r = 0; r < 8; r++) {
    const rank = 8 - r;
    let file = 0;
    for (const ch of ranks[r]!) {
      if (ch >= "1" && ch <= "8") {
        file += Number(ch);
        continue;
      }
      const color: StarChessColor = ch === ch.toUpperCase() ? "w" : "b";
      const type = ch.toLowerCase() as ScPiece["type"];
      const square = sq(file, rank);
      if (!square) throw new Error(`Bad square at ${file},${rank}`);
      map.set(square, { type, color });
      file += 1;
    }
  }
  return map;
};

/** Every rook / Siege Tank square in a placement (both colors). */
export const rookSquaresInPlacement = (placement: string): Square[] => {
  const out: Square[] = [];
  for (const [square, piece] of placementToMap(placement)) {
    if (piece.type === "r") out.push(square);
  }
  return out;
};

/** Serialize a square map back to classic placement. */
export const mapToPlacement = (map: Map<Square, ScPiece>): string => {
  const ranks: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = map.get(sq(file, rank)!);
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) {
        row += String(empty);
        empty = 0;
      }
      const ch = piece.type;
      row += piece.color === "w" ? ch.toUpperCase() : ch;
    }
    if (empty) row += String(empty);
    ranks.push(row);
  }
  return ranks.join("/");
};

/**
 * Ray / leap attack test (static geometry, ignores absolute pins).
 * Used for check indicators and “into fire” detection — not chess.js moves().
 */
export const attacksSquare = (
  map: Map<Square, ScPiece>,
  from: Square,
  to: Square,
): boolean => {
  if (from === to) return false;
  const attacker = map.get(from);
  if (!attacker) return false;
  const { file: ff, rank: fr } = parseSquare(from);
  const { file: tf, rank: tr } = parseSquare(to);
  const df = tf - ff;
  const dr = tr - fr;
  const adf = Math.abs(df);
  const adr = Math.abs(dr);

  const clearRay = () => {
    const stepF = Math.sign(df);
    const stepR = Math.sign(dr);
    let f = ff + stepF;
    let r = fr + stepR;
    while (f !== tf || r !== tr) {
      const mid = sq(f, r);
      if (mid && map.has(mid)) return false;
      f += stepF;
      r += stepR;
    }
    return true;
  };

  switch (attacker.type) {
    case "n":
      return (adf === 1 && adr === 2) || (adf === 2 && adr === 1);
    case "k":
      return adf <= 1 && adr <= 1;
    case "p": {
      const dir = attacker.color === "w" ? 1 : -1;
      return adr === 1 && adf === 1 && dr === dir;
    }
    case "b":
      return adf === adr && adf > 0 && clearRay();
    case "r":
      return ((df === 0 && dr !== 0) || (dr === 0 && df !== 0)) && clearRay();
    case "q":
      return (
        ((adf === adr && adf > 0) ||
          (df === 0 && dr !== 0) ||
          (dr === 0 && df !== 0)) &&
        clearRay()
      );
    default:
      return false;
  }
};

/** True if `to` is attacked by any piece of `byColor`. */
export const isSquareAttackedBy = (
  map: Map<Square, ScPiece>,
  to: Square,
  byColor: StarChessColor,
): boolean => {
  for (const [from, piece] of map) {
    if (piece.color !== byColor) continue;
    if (attacksSquare(map, from, to)) return true;
  }
  return false;
};

/** Find the king square for a color (null if missing). */
export const findKing = (
  map: Map<Square, ScPiece>,
  color: StarChessColor,
): Square | null => {
  for (const [s, p] of map) {
    if (p.type === "k" && p.color === color) return s;
  }
  return null;
};

/**
 * Every unit that **legally** checks a king (clear geometry via {@link attacksSquare}).
 * Attack range is the piece’s geometry only (bishop/queen/rook rays are unlimited).
 * Fog limit is **side vision**: if any friendly unit lights the king (e.g. sieged
 * tank 9×9), every geometric checker of that side may chip — including a bishop
 * whose own 5×5 would not cover the square.
 *
 * Kings are legal checkers too: two adjacent kings fight face-to-face, each
 * chipping the other every turn until one runs out of HP (or both reach 0 in the
 * same pass — a draw). Adjacency is therefore always **mutual**, and because a
 * king deploys its units ring-adjacent, a spawn next to the enemy king stacks a
 * second checker for 2 HP/turn.
 */
export const collectLegalKingChecks = (
  placement: string,
  opts?: {
    /** Side can see the king (cumulative lit ∪ revealed). */
    isTargetVisible?: (color: StarChessColor, square: Square) => boolean;
  },
): {
  color: StarChessColor;
  piece: ScPiece["type"];
  from: Square;
  to: Square;
}[] => {
  const map = placementToMap(placement);
  const canSee = opts?.isTargetVisible ?? (() => true);

  const out: {
    color: StarChessColor;
    piece: ScPiece["type"];
    from: Square;
    to: Square;
  }[] = [];
  for (const kingColor of ["w", "b"] as const) {
    const kingSq = findKing(map, kingColor);
    if (!kingSq) continue;
    const enemy: StarChessColor = kingColor === "w" ? "b" : "w";
    if (!canSee(enemy, kingSq)) continue;
    for (const [from, piece] of map) {
      if (piece.color !== enemy) continue;
      if (!attacksSquare(map, from, kingSq)) continue;
      out.push({ color: enemy, piece: piece.type, from, to: kingSq });
    }
  }
  out.sort((a, b) => {
    if (a.color !== b.color) return a.color === "w" ? -1 : 1;
    return a.from.localeCompare(b.from);
  });
  return out;
};

/**
 * Classic “in check” on occupancy (side’s king attacked). Independent of
 * side-to-move tricks in a FEN string.
 */
export const isKingInCheck = (
  map: Map<Square, ScPiece>,
  color: StarChessColor,
): boolean => {
  const k = findKing(map, color);
  if (!k) return false;
  const enemy: StarChessColor = color === "w" ? "b" : "w";
  return isSquareAttackedBy(map, k, enemy);
};

export const classicFenFromPlacement = (
  placement: string,
  sideToMove: StarChessColor = "w",
): string => toClassicFen(placement, sideToMove);
