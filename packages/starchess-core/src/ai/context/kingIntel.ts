// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
/**
 * Infer a Command Center (CC)-search focus from fog-visible enemy units only.
 * Hints (strong → weak):
 *  1. Marine **files** — the Command Center (CC) deployed Marines nearby, so each visible
 *     marine's file is a corridor back toward the enemy home band
 *     (ranks 1–2 if enemy is white, ranks 7–8 if enemy is black).
 *  2. Marine clumps — dense shelter reinforces those files.
 *  3. Deployed non-marines — Command Center drops beside the Command Center (CC).
 * With no cues, fall back to enemy home (`e2` / `e7`).
 */

import type { Square } from "chess.js";

import { parseSquare, type ScPiece } from "../../board/placement";
import { UNIT_COST } from "../../rules/constants";
import type { PieceColor } from "../../model/types";
import { FILES, chebyshev } from "./geometry";
import type { KingIntel } from "./types";

export const gatherKingIntel = (
  map: Map<Square, ScPiece>,
  lit: ReadonlySet<Square>,
  revealed: ReadonlySet<Square>,
  enemy: PieceColor,
): KingIntel => {
  const visible: { square: Square; piece: ScPiece }[] = [];
  for (const [square, piece] of map) {
    if (piece.color !== enemy) continue;
    if (piece.type === "k") continue; // if visible, posture is hunt — ignore here
    if (lit.has(square) || revealed.has(square)) {
      visible.push({ square, piece });
    }
  }

  // Opposite home: if we are w, enemy b lives on e8; if we are b, enemy w on e1 — start there, then scout
  const defaultFocus: Square = enemy === "w" ? "e1" : "e8";
  if (visible.length === 0) {
    return { focus: defaultFocus, strength: 0 };
  }

  /** Visible marines within a 2-square box of `square` (clump density). */
  const pawnNeighbours = (square: Square): number => {
    let n = 0;
    for (const other of visible) {
      if (other.piece.type !== "p") continue;
      if (other.square === square) continue;
      if (chebyshev(other.square, square) <= 2) n += 1;
    }
    return n;
  };

  // File histogram of visible marines — Command Center (CC) deploy corridors.
  const pawnFiles = new Map<number, number>();
  for (const { square, piece } of visible) {
    if (piece.type !== "p") continue;
    const file = parseSquare(square).file;
    pawnFiles.set(
      file,
      (pawnFiles.get(file) ?? 0) + 1 + pawnNeighbours(square),
    );
  }

  let sumFile = 0;
  let sumRank = 0;
  let mass = 0;

  // Primary: each marine file pulls hard toward the enemy home band on that file.
  const homeRank = enemy === "w" ? 2 : 7;
  for (const [file, density] of pawnFiles) {
    const fileW = 8 + density * 4;
    sumFile += file * fileW;
    sumRank += homeRank * fileW;
    mass += fileW;
  }

  for (const { square, piece } of visible) {
    const { file, rank } = parseSquare(square);
    let w: number;
    if (piece.type === "p") {
      // Secondary: current marine square (advance / clump position).
      w = 1.5 + pawnNeighbours(square) * 2;
    } else {
      // Deployed unit — spawn was adjacent to Command Center (CC); back-rank bias for enemy home.
      w = 4 + UNIT_COST[piece.type];
      if (enemy === "w" ? rank <= 3 : rank >= 6) w += 3;
    }
    sumFile += file * w;
    sumRank += rank * w;
    mass += w;
  }

  const file = Math.max(0, Math.min(7, Math.round(sumFile / mass)));
  const rank = Math.max(1, Math.min(8, Math.round(sumRank / mass)));
  return {
    focus: `${FILES[file]}${rank}` as Square,
    strength: mass,
  };
};
