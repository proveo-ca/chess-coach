/**
 * Checks — putting the enemy Command Center under fire and closing on it.
 *
 * Two of these terms deliberately ignore fog (`enemyKing` without a visibility
 * test): the sneak-check and the Mecha ray use the same omniscience capture
 * scoring already has. The posture-scaled `attackKing` / `chaseKing` terms do
 * require a *visible* Command Center (CC) — they are the hunt-posture offensive.
 *
 * A classical move onto the Command Center (CC) square is dropped by the resolver, so every
 * term here rewards establishing a ray from the landing square instead.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
 */

import { attacksSquare, isSquareAttackedBy } from "../../board/placement";
import type { AdjutantCtx, MoveEval } from "../context";
import { chebyshev } from "../context";
import type { Strategy } from "./types";

/**
 * Hoverbike lands a check on a square the enemy does not cover (sneak).
 * Below equal-material trades (always take those); above quiet hops.
 */
export const SNEAK_KNIGHT_CHECK = 2_000;

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

  // Marine that checks the CC — e.g. pawn on c2/d2 checking e1 after capture, high bonus to prefer c2 check over e2 non-check
  if (
    piece.type === "p" &&
    enemyKing &&
    attacksSquare(ev.after(), move.to, enemyKing)
  ) {
    s += 1_500;
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
