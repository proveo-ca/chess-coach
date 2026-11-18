// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml, _spec/apps/starchess/core/adjutant/cc-focus.puml
/**
 * Checks — putting the enemy Command Center under fire and closing on it.
 */

import { attacksSquare, isSquareAttackedBy } from "../../board/placement";
import type { AdjutantCtx, MoveEval } from "../context";
import { chebyshev } from "../context";
import type { Strategy } from "./types";

/** Hoverbike lands a check on a square the enemy does not cover (sneak). */
export const SNEAK_HOVERBIKE_CHECK = 2_000;
/** Marine that lands a check on the Command Center (CC). */
export const MARINE_CHECK_CC = 1_500;

const score = (ev: MoveEval, ctx: AdjutantCtx): number => {
  const { move, piece, isCCMove } = ev;
  if (isCCMove) return 0;

  const { enemyCC, enemy, tactical, weights, vision } = ctx;
  const { attackCC, chaseCC, diagonal, attackedPenalty } = weights;
  let s = 0;

  // Sneak check: land checking the Command Center (CC) on a square the enemy does not cover.
  if (piece.type === "n" && enemyCC && move.to !== enemyCC) {
    const after = ev.after();
    if (attacksSquare(after, move.to, enemyCC)) {
      if (!isSquareAttackedBy(after, move.to, enemy)) s += SNEAK_HOVERBIKE_CHECK;
      else if (tactical.friendlyProtects(move.to)) s += SNEAK_HOVERBIKE_CHECK * 0.25;
      else s -= attackedPenalty;
    }
  }

  // Mecha ray that bites the Command Center (CC) — worth a second diagonal's weight.
  if (
    piece.type === "b" &&
    enemyCC &&
    attacksSquare(ev.after(), move.to, enemyCC)
  ) {
    s += diagonal;
  }

  if (
    piece.type === "p" &&
    enemyCC &&
    attacksSquare(ev.after(), move.to, enemyCC)
  ) {
    s += MARINE_CHECK_CC;
  }

  // Enemy-Command Center (CC) pressure — posture-scaled (0 unless hunt).
  if (
    attackCC > 0 &&
    enemyCC &&
    vision.enemyCCVisible &&
    move.to !== enemyCC &&
    attacksSquare(ev.after(), move.to, enemyCC)
  ) {
    s += attackCC;
  }

  // Chase a visible Command Center (CC) (hunt) — close Chebyshev distance.
  if (
    chaseCC > 0 &&
    enemyCC &&
    vision.enemyCCVisible &&
    move.to !== enemyCC
  ) {
    const before = chebyshev(move.from, enemyCC);
    const after = chebyshev(move.to, enemyCC);
    if (after < before) s += chaseCC * (before - after);
  }

  return s;
};

export const checks: Strategy = { id: "checks", score };
