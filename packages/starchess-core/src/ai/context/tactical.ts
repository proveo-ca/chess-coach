// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
/**
 * Build attack predicates + one-ply enemy check threats.
 * 1) squares attacked by enemy · 2) squares protected by us ·
 * 3) whether any enemy unit can check our Command Center (CC) in one move ·
 * 4) squares of those checkers / future checkers.
 */

import type { Square } from "chess.js";

import {
  attacksSquare,
  findCC,
  isSquareAttackedBy,
  type ScPiece,
} from "../../board/placement";
import { scMovesFor } from "../../board/moves";
import type { PieceColor } from "../../model/types";
import { cloneWithMove } from "./geometry";
import type { TacticalBoard } from "./types";

export const buildTacticalBoard = (
  map: Map<Square, ScPiece>,
  us: PieceColor,
  enemy: PieceColor,
  ourCC: Square,
  sieged: ReadonlySet<Square>,
): TacticalBoard => {
  const enemyAttacks = (sq: Square) => isSquareAttackedBy(map, sq, enemy);
  const friendlyProtects = (sq: Square) => isSquareAttackedBy(map, sq, us);

  const checkers = new Set<Square>();
  const checkThreatSquares = new Set<Square>();
  // Already checking us.
  for (const [sq, piece] of map) {
    if (piece.color !== enemy) continue;
    if (attacksSquare(map, sq, ourCC)) {
      checkers.add(sq);
      checkThreatSquares.add(sq);
    }
  }

  let enemyThreatensCheck = checkers.size > 0;
  for (const m of scMovesFor(map, enemy, { siegedTanks: sieged })) {
    if (m.dropsAtResolve) continue;
    const after = cloneWithMove(
      map,
      {
        from: m.from,
        to: m.to,
        capture: m.capture,
        ...(m.firesInPlace ? { firesInPlace: true } : {}),
        ...(m.promotion ? { promotion: m.promotion } : {}),
      },
      sieged,
    );
    if (!findCC(after, us)) continue;
    const land = m.firesInPlace ? m.from : m.to;
    if (attacksSquare(after, land, ourCC)) {
      enemyThreatensCheck = true;
      checkThreatSquares.add(m.from);
    }
  }

  return {
    enemyAttacks,
    friendlyProtects,
    enemyThreatensCheck,
    checkers,
    checkThreatSquares,
  };
};
