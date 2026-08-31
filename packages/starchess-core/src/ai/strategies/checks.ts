/**
 * Checks — putting the enemy Command Center under fire and closing on it.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
 * // SPEC: _spec/apps/starchess/core/adjutant/cc-focus.puml
 */

import { attacksSquare, isSquareAttackedBy } from "../../board/placement";
import type { AdjutantCtx, MoveEval } from "../context";
import { chebyshev } from "../context";
import type { Strategy } from "./types";

/** Hoverbike lands a check on a square the enemy does not cover (sneak). */
export const SNEAK_KNIGHT_CHECK = 2_000;
/** Marine that lands a check on the Command Center (CC). */
export const PAWN_CHECK_CC = 1_500;

const score = (ev: MoveEval, ctx: AdjutantCtx): number => {
  const { move, piece, isKingMove } = ev;
  if (isKingMove) return 0;

  const { enemyKing, enemy, tactical, weights, vision } = ctx;
  const { attackKing, chaseKing, diagonal, attackedPenalty } = weights;
  let s = 0;

  // Sneak check: land checking the Command Center (CC) on a square the enemy does not cover.
  if (piece.type === "n" && enemyKing && move.to !== enemyKing) {
    const after = ev.after();
    if (attacksSquare(after, move.to, enemyKing)) {
      if (!isSquareAttackedBy(after, move.to, enemy)) s += SNEAK_KNIGHT_CHECK;
      else if (tactical.friendlyProtects(move.to)) s += SNEAK_KNIGHT_CHECK * 0.25;
      else s -= attackedPenalty;
    }
  }

  // Mecha ray that bites the Command Center (CC) — worth a second diagonal's weight.
  if (
    piece.type === "b" &&
    enemyKing &&
    attacksSquare(ev.after(), move.to, enemyKing)
  ) {
    s += diagonal;
  }

  if (
    piece.type === "p" &&
    enemyKing &&
    attacksSquare(ev.after(), move.to, enemyKing)
  ) {
    s += PAWN_CHECK_CC;
  }

  // Enemy-Command Center (CC) pressure — posture-scaled (0 unless hunt).
  if (
    attackKing > 0 &&
    enemyKing &&
    vision.enemyKingVisible &&
    move.to !== enemyKing &&
    attacksSquare(ev.after(), move.to, enemyKing)
  ) {
    s += attackKing;
  }

  // Chase a visible Command Center (CC) (hunt) — close Chebyshev distance.
  if (
    chaseKing > 0 &&
    enemyKing &&
    vision.enemyKingVisible &&
    move.to !== enemyKing
  ) {
    const before = chebyshev(move.from, enemyKing);
    const after = chebyshev(move.to, enemyKing);
    if (after < before) s += chaseKing * (before - after);
  }

  return s;
};

export const checks: Strategy = { id: "checks", score };
