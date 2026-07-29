/**
 * Brood War board occupancy helpers (rules-side). Classic chess.js is not used
 * for legality — only optional render via toClassicFen / loadFen.
 */

import type { Square } from "chess.js";

import { toClassicFen } from "~/broodwar/bwfen";
import type { BroodWarColor } from "~/broodwar/types";

export type BwPiece = {
  type: "p" | "n" | "b" | "r" | "q" | "k";
  color: BroodWarColor;
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
export const placementToMap = (placement: string): Map<Square, BwPiece> => {
  const map = new Map<Square, BwPiece>();
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
      const color: BroodWarColor = ch === ch.toUpperCase() ? "w" : "b";
      const type = ch.toLowerCase() as BwPiece["type"];
      const square = sq(file, rank);
      if (!square) throw new Error(`Bad square at ${file},${rank}`);
      map.set(square, { type, color });
      file += 1;
    }
  }
  return map;
};

/** Serialize a square map back to classic placement. */
export const mapToPlacement = (map: Map<Square, BwPiece>): string => {
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
  map: Map<Square, BwPiece>,
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
  map: Map<Square, BwPiece>,
  to: Square,
  byColor: BroodWarColor,
): boolean => {
  for (const [from, piece] of map) {
    if (piece.color !== byColor) continue;
    if (attacksSquare(map, from, to)) return true;
  }
  return false;
};

/** Find the king square for a color (null if missing). */
export const findKing = (
  map: Map<Square, BwPiece>,
  color: BroodWarColor,
): Square | null => {
  for (const [s, p] of map) {
    if (p.type === "k" && p.color === color) return s;
  }
  return null;
};

/**
 * Classic “in check” on occupancy (side’s king attacked). Independent of
 * side-to-move tricks in a FEN string.
 */
export const isKingInCheck = (
  map: Map<Square, BwPiece>,
  color: BroodWarColor,
): boolean => {
  const k = findKing(map, color);
  if (!k) return false;
  const enemy: BroodWarColor = color === "w" ? "b" : "w";
  return isSquareAttackedBy(map, k, enemy);
};

export const classicFenFromPlacement = (
  placement: string,
  sideToMove: BroodWarColor = "w",
): string => toClassicFen(placement, sideToMove);
