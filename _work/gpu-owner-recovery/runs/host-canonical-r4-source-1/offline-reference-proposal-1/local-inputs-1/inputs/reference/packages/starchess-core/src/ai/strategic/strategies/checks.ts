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

export const SNEAK_HOVERBIKE_CHECK_GUESS = 6_000;
export const ATTACK_CC_GUESS = 5_000;
/**
 * Closing weight on the guessed CC (× chebyshev delta, up to ×7 = 17_500).
 * Deliberately hotter than hunt `chaseCC` 450: closing on the guess drags
 * units into vision range of the true Command Center — the arena 10-0 line depends on
 * it. Knife-edge: 2_000 draws level, 4_000 suicides into the guess (verified
 * naive:strategic ×10 ×3 runs). Effective sums intentionally outbid
 * retaliation/serious tiers on long closes; the clearsCheck plan guard (not
 * the ladder) is what keeps the Command Center safe — see weight-ladder.puml.
 */
export const CHASE_CC_GUESS = 2_500;

/** Sneak check on a *seen* Command Center (CC). Distinct from the naive weight of the same shape. */
export const SNEAK_HOVERBIKE_CHECK_SEEN = 6_000;

/** Marine that lands a check on the Command Center (CC). */
export const MARINE_CHECK_CC_GUESS = 6_000;
export const MARINE_CHECK_CC_SEEN = 6_000;

const score = (ev: MoveEval, ctx: StrategicCtx): number => {
  const { move, piece, isCCMove } = ev;
  if (isCCMove) return 0;

  const { enemyCC, enemy, tactical, weights, vision, intel } = ctx;
  const { attackCC, chaseCC, diagonal, attackedPenalty } = weights;
  let s = 0;

  const isGuess = !vision.enemyCCVisible;
  const targetCC = isGuess ? intel.focus : enemyCC;
  const guessStrength = intel.strength;

  if (piece.type === "n" && targetCC && move.to !== targetCC) {
    const after = ev.after();
    if (attacksSquare(after, move.to, targetCC)) {
      if (!isSquareAttackedBy(after, move.to, enemy)) {
        s += isGuess
          ? SNEAK_HOVERBIKE_CHECK_GUESS * (guessStrength > 0 ? 1 : 0.5)
          : SNEAK_HOVERBIKE_CHECK_SEEN;
      } else if (tactical.friendlyProtects(move.to)) {
        s += (isGuess ? SNEAK_HOVERBIKE_CHECK_GUESS : SNEAK_HOVERBIKE_CHECK_SEEN) * 0.9;
      } else {
        s -= attackedPenalty;
      }
    }
  }

  const guessUsable = !isGuess || guessStrength > 0;

  if (
    piece.type === "b" &&
    targetCC &&
    guessUsable &&
    attacksSquare(ev.after(), move.to, targetCC)
  ) {
    s += isGuess ? diagonal * 0.6 : diagonal;
  }

  if (
    piece.type === "p" &&
    targetCC &&
    guessUsable &&
    attacksSquare(ev.after(), move.to, targetCC)
  ) {
    s += isGuess ? MARINE_CHECK_CC_GUESS : MARINE_CHECK_CC_SEEN;
  }

  const canAttackCC = isGuess ? guessStrength > 0 : vision.enemyCCVisible;
  const attackWeight = isGuess ? ATTACK_CC_GUESS : attackCC;
  if (attackWeight > 0 && targetCC && move.to !== targetCC && attacksSquare(ev.after(), move.to, targetCC) && canAttackCC) {
    s += attackWeight;
  }

  const chaseWeight = isGuess ? CHASE_CC_GUESS : chaseCC;
  if (chaseWeight > 0 && targetCC && move.to !== targetCC) {
    if (!isGuess || guessStrength > 0) {
      const before = chebyshev(move.from, targetCC);
      const after = chebyshev(move.to, targetCC);
      if (after < before) s += chaseWeight * (before - after);
    }
  }

  return s;
};

export const checks: StrategicStrategy = { id: "checks", score };
