/**
 * Under player fog, pawn front-diagonals stay clickable attack intents even
 * when no enemy is visible on the square (resolve owns the victim).
 * // SPEC: _spec/apps/starchess/core/board/planning-projection.puml
 */
import type { Square } from "chess.js";
import {
  parseSquare,
  sq,
  type ScPiece,
  type StarChessColor,
} from "@chess-coach/starchess-core";

/** Empty or enemy-occupied pawn attack diagonals from `from`. */
export const pawnFogAttackDests = (
  from: Square,
  color: StarChessColor,
  map: ReadonlyMap<Square, ScPiece>,
): Square[] => {
  const { file, rank } = parseSquare(from);
  const dir = color === "w" ? 1 : -1;
  const out: Square[] = [];
  for (const df of [-1, 1] as const) {
    const to = sq(file + df, rank + dir);
    if (!to) continue;
    const occ = map.get(to);
    if (occ && occ.color === color) continue;
    out.push(to);
  }
  return out;
};

/** Merge classical dests with fog pawn-attack diagonals (deduped). */
export const legalDestsWithFogPawnAttacks = (
  classical: readonly Square[],
  from: Square,
  piece: ScPiece,
  map: ReadonlyMap<Square, ScPiece>,
  fog: boolean,
): Square[] => {
  if (!fog || piece.type !== "p") return [...classical];
  const seen = new Set<Square>(classical);
  for (const d of pawnFogAttackDests(from, piece.color, map)) {
    seen.add(d);
  }
  return [...seen];
};
