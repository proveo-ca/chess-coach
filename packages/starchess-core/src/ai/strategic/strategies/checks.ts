// SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml, _spec/apps/starchess/core/adjutant/cc-focus.puml
/**
 * Checks — strategic version, which scores the guessed Command Center (CC)
 * while the real one is fogged.
 */

import { attacksSquare, isSquareAttackedBy } from "../../../board/placement";
import type { MoveEval } from "../../context";
import { chebyshev } from "../../context";
import type { StrategicCtx } from "../context";
import type { StrategicStrategy } from "./types";

export const SNEAK_KNIGHT_CHECK_GUESS = 6_000;
export const ATTACK_KING_GUESS = 5_000;
/**
 * Closing weight on the guessed CC (× chebyshev delta, up to ×7 = 17_500).
 * Deliberately hotter than hunt `chaseKing` 450: closing on the guess drags
 * units into vision range of the true king — the arena 10-0 line depends on
 * it. Knife-edge: 2_000 draws level, 4_000 suicides into the guess (verified
 * naive:strategic ×10 ×3 runs). Effective sums intentionally outbid
 * retaliation/serious tiers on long closes; the clearsCheck plan guard (not
 * the ladder) is what keeps the king safe — see weight-ladder.puml.
 */
export const CHASE_KING_GUESS = 2_500;

/** Sneak check on a *seen* Command Center (CC). Distinct from the naive weight of the same shape. */
export const SNEAK_KNIGHT_CHECK_SEEN = 6_000;

/** Marine that lands a check on the Command Center (CC). */
export const PAWN_CHECK_CC_GUESS = 6_000;
export const PAWN_CHECK_CC_SEEN = 6_000;

const score = (ev: MoveEval, ctx: StrategicCtx): number => {
  const { move, piece, isKingMove } = ev;
  if (isKingMove) return 0;

  const { enemyKing, enemy, tactical, weights, vision, intel } = ctx;
  const { attackKing, chaseKing, diagonal, attackedPenalty } = weights;
  let s = 0;

  const isGuess = !vision.enemyKingVisible;
  const targetKing = isGuess ? intel.focus : enemyKing;
  const guessStrength = intel.strength;

  if (piece.type === "n" && targetKing && move.to !== targetKing) {
    const after = ev.after();
    if (attacksSquare(after, move.to, targetKing)) {
      if (!isSquareAttackedBy(after, move.to, enemy)) {
        s += isGuess
          ? SNEAK_KNIGHT_CHECK_GUESS * (guessStrength > 0 ? 1 : 0.5)
          : SNEAK_KNIGHT_CHECK_SEEN;
      } else if (tactical.friendlyProtects(move.to)) {
        s += (isGuess ? SNEAK_KNIGHT_CHECK_GUESS : SNEAK_KNIGHT_CHECK_SEEN) * 0.9;
      } else {
        s -= attackedPenalty;
      }
    }
  }

  const guessUsable = !isGuess || guessStrength > 0;

  if (
    piece.type === "b" &&
    targetKing &&
    guessUsable &&
    attacksSquare(ev.after(), move.to, targetKing)
  ) {
    s += isGuess ? diagonal * 0.6 : diagonal;
  }

  if (
    piece.type === "p" &&
    targetKing &&
    guessUsable &&
    attacksSquare(ev.after(), move.to, targetKing)
  ) {
    s += isGuess ? PAWN_CHECK_CC_GUESS : PAWN_CHECK_CC_SEEN;
  }

  const canAttackKing = isGuess ? guessStrength > 0 : vision.enemyKingVisible;
  const attackWeight = isGuess ? ATTACK_KING_GUESS : attackKing;
  if (attackWeight > 0 && targetKing && move.to !== targetKing && attacksSquare(ev.after(), move.to, targetKing) && canAttackKing) {
    s += attackWeight;
  }

  const chaseWeight = isGuess ? CHASE_KING_GUESS : chaseKing;
  if (chaseWeight > 0 && targetKing && move.to !== targetKing) {
    if (!isGuess || guessStrength > 0) {
      const before = chebyshev(move.from, targetKing);
      const after = chebyshev(move.to, targetKing);
      if (after < before) s += chaseWeight * (before - after);
    }
  }

  return s;
};

export const checks: StrategicStrategy = { id: "checks", score };
