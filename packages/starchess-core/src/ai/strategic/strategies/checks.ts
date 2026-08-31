/**
 * Checks — Strategic version that is aware 1 move before checking.
 *
 * Mirrors naive `checks.ts` but scores the guessed Command Center (CC) when the real one
 * is fogged. The naive Adjutant only sees `enemyKing` (actual square, only
 * when visible). The strategic Adjutant keeps a running guess — `intel.focus`
 * seeded at the opposite home (e1 if we are b, e8 if we are w) and nudged by
 * every lit/revealed marine file / deployed unit. A Hoverbike (hoverbike) that
 * lands attacking the guessed square is still a sneak-check, even if the
 * true Command Center (CC) is still hidden — it will be, on the next scout.
 *
 * This is what makes games end sooner: the strategic doesn't wait to see
 * e8, it drives toward e7/e8 from the first marine-file cue and the moment a
 * hoverbike can fork the guess, it takes it (2000 sneak, 0.6k when the guess
 * is weak). Hunt-posture `attackKing`/`chaseKing` also fire on the guess
 * when `enemyKingVisible` is false but `intel.strength` is non-zero.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml
 */

import { attacksSquare, isSquareAttackedBy } from "../../../board/placement";
import type { MoveEval } from "../../context";
import { chebyshev } from "../../context";
import type { StrategicCtx } from "../context";
import type { StrategicStrategy } from "./types";

const SNEAK_KNIGHT_CHECK_GUESS = 2_000;
const ATTACK_KING_GUESS = 3_500;
const CHASE_KING_GUESS = 450;

export const SNEAK_KNIGHT_CHECK = 2_000;

const score = (ev: MoveEval, ctx: StrategicCtx): number => {
  const { move, piece, isKingMove } = ev;
  if (isKingMove) return 0;

  const { enemyKing, enemy, tactical, weights, vision, intel } = ctx;
  const { attackKing, chaseKing, diagonal, attackedPenalty } = weights;
  let s = 0;

  const targetKing = enemyKing ?? intel.focus;
  const isGuess = enemyKing == null;
  const guessStrength = intel.strength;

  // Sneak check: hoverbike lands checking the (real or guessed) Command Center (CC) on a square the enemy does not cover.
  if (piece.type === "n" && targetKing && move.to !== targetKing) {
    const after = ev.after();
    if (attacksSquare(after, move.to, targetKing)) {
      if (!isSquareAttackedBy(after, move.to, enemy)) {
        s += isGuess ? SNEAK_KNIGHT_CHECK_GUESS * (guessStrength > 0 ? 1 : 0.5) : SNEAK_KNIGHT_CHECK;
      } else if (tactical.friendlyProtects(move.to)) {
        s += (isGuess ? SNEAK_KNIGHT_CHECK_GUESS : SNEAK_KNIGHT_CHECK) * 0.25;
      } else {
        s -= attackedPenalty;
      }
    }
  }

  // Mecha ray that bites the (real or guessed) Command Center (CC)
  if (piece.type === "b" && targetKing && attacksSquare(ev.after(), move.to, targetKing)) {
    s += isGuess ? diagonal * 0.6 : diagonal;
  }

  // Marine that checks the (real or guessed) CC — e.g. c2 pawn checking e1 after capture, prefer over e2 non-check
  if (piece.type === "p" && targetKing && attacksSquare(ev.after(), move.to, targetKing)) {
    s += isGuess ? 1_200 : 1_500;
  }

  // Enemy-Command Center (CC) pressure — posture-scaled. Fire on real Command Center (CC) when visible,
  // otherwise fire on guessed Command Center (CC) when we have any intel at all.
  const canAttackKing = isGuess ? guessStrength > 0 : vision.enemyKingVisible;
  const attackWeight = isGuess ? ATTACK_KING_GUESS : attackKing;
  if (attackWeight > 0 && targetKing && move.to !== targetKing && attacksSquare(ev.after(), move.to, targetKing) && canAttackKing) {
    s += attackWeight;
  }

  // Chase: close Chebyshev distance to (real or guessed) Command Center (CC)
  const chaseWeight = isGuess ? CHASE_KING_GUESS : chaseKing;
  if (chaseWeight > 0 && targetKing && move.to !== targetKing) {
    // Only chase the guess when we have some intel, otherwise we would wander to e2/e7 blindly
    if (!isGuess || guessStrength > 0) {
      const before = chebyshev(move.from, targetKing);
      const after = chebyshev(move.to, targetKing);
      if (after < before) s += chaseWeight * (before - after);
    }
  }

  return s;
};

export const checks: StrategicStrategy = { id: "checks", score };
