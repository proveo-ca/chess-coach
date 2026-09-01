// SPEC: _spec/apps/starchess/core/adjutant/strategic/promotion-defense.puml, _spec/apps/starchess/core/adjutant/weight-ladder.puml
/**
 * Runners — answering an enemy marine before it promotes.
 *
 * The concern the naive script has no version of: promotion distance is read
 * only about *our* marines there (`nearPromoteRush`), so an enemy runner was
 * worth nothing beyond the ordinary material terms on capturing a marine —
 * 950 for an undefended one, against 6_000 for a check. That is why a runner
 * three squares out could walk in while the Adjutant went hunting.
 *
 * The tier is **turns**, not squares (`../runners.ts`): a marine covers two
 * ranks a turn, so 1–2 squares out means it promotes on the enemy's very next
 * turn and 3–4 means we have exactly one turn of slack left.
 *
 * The three answers, in the order they are worth having:
 *   - **capture** the runner — the only permanent one;
 *   - **blockade** the square in front — total while it holds, because a
 *     marine cannot shoot forward, but leaky if the runner has a diagonal
 *     capture available and worthless if the enemy simply takes the blocker;
 *   - **cover** the square it must cross — we do not stop it, we make it pay.
 *
 * And the mirror of the second: a blockade we walk away from is a runner we
 * re-released, so vacating the last blocked square is charged the full tier.
 */

import type { Square } from "chess.js";

import { attacksSquare, isSquareAttackedBy } from "../../../board/placement";
import type { ScPiece } from "../../../board/placement";
import type { MoveEval } from "../../context";
import type { StrategicCtx } from "../context";
import type { EnemyRunner } from "../runners";
import { isSoleBlocker, runnerSidesteps } from "../runners";
import type { StrategicStrategy } from "./types";

/**
 * The runner promotes on the enemy's next turn (1–2 squares out). Above the
 * Command Center pressure tier — a check we can repeat next turn must not
 * outbid the last chance to stop a BattleShip landing on our back rank — and
 * below every absolute survival weight.
 */
export const RUNNER_STOP_CRITICAL = 7_000;

/**
 * Two turns out (3–4 squares) — the case that started this module. Above
 * `ATTACK_KING_GUESS`, because aiming at a *guessed* Command Center square is
 * speculation and a marine three squares out is not, and below the 6_000 check
 * weights, so an actual threat on the Command Center still wins the turn.
 */
export const RUNNER_STOP_SERIOUS = 5_500;

/** Three turns out — a nudge that breaks ties, never a plan of its own. */
export const RUNNER_STOP_WATCH = 600;

/** Taking the runner off the board settles the question. */
export const RUNNER_CAPTURE_SHARE = 1;
/** A body on the square in front: total while it stands there. */
export const RUNNER_BLOCK_SHARE = 0.8;
/** ...halved when the runner can capture a diagonal and keep running. */
export const RUNNER_SIDESTEP_SHARE = 0.5;
/** ...and worth little when the enemy just takes the blocker for free. */
export const RUNNER_HANGING_SHARE = 0.3;
/** Covering a square on its path — it costs the runner a unit, not the race. */
export const RUNNER_COVER_SHARE = 0.35;
/** A runner something already stops is a watch item, not a threat. */
export const RUNNER_CONTAINED_SHARE = 0.25;
/** Walking the last blocker away hands the race back. */
export const RUNNER_ABANDON_SHARE = 0.8;

/** What this runner would be worth if nothing stood in its way. */
export const runnerTier = (runner: EnemyRunner): number =>
  runner.turns <= 1
    ? RUNNER_STOP_CRITICAL
    : runner.turns === 2
      ? RUNNER_STOP_SERIOUS
      : RUNNER_STOP_WATCH;

/**
 * What this runner is worth if nothing were in its way, scaled by how sure we
 * are it is there at all: 1 for a sighting, decaying while we only remember it
 * (`../runners.ts`).
 */
export const runnerStake = (runner: EnemyRunner): number =>
  runnerTier(runner) * runner.confidence;

/** What answering it is worth *this* turn — the stake, damped while contained. */
export const runnerUrgency = (runner: EnemyRunner): number =>
  runnerStake(runner) * (runner.passed ? 1 : RUNNER_CONTAINED_SHARE);

/**
 * Quality of a blockade on `front`, asked on the POST-move board: a blocker
 * the enemy can take for free is not a blockade, and one the runner can walk
 * around by capturing a diagonal only buys a tempo.
 */
const blockShare = (
  after: Map<Square, ScPiece>,
  runner: EnemyRunner,
  ctx: StrategicCtx,
): number => {
  const hanging =
    isSquareAttackedBy(after, runner.front, ctx.enemy) &&
    !isSquareAttackedBy(after, runner.front, ctx.us);
  if (hanging) return RUNNER_HANGING_SHARE;
  return runnerSidesteps(after, runner, ctx.us).length > 0
    ? RUNNER_BLOCK_SHARE * RUNNER_SIDESTEP_SHARE
    : RUNNER_BLOCK_SHARE;
};

/**
 * What a deploy onto `to` is worth against the runners. The Command Center's
 * deploy ring sits on our own last ranks — exactly where an enemy runner
 * promotes — so a drop is often the only answer that arrives in time, and a
 * drop onto a runner we can *see* crushes it (`board/deploy-reach.ts`).
 *
 * The best single answer, not the sum: one body settles one square, so several
 * runners sharing a path must not stack a ring square past the tier ceiling.
 */
export const runnerDeployValue = (
  runners: readonly EnemyRunner[],
  to: Square,
): number => {
  let best = 0;
  for (const runner of runners) {
    // A drop onto a *remembered* runner's square lands on an empty tile far
    // more often than it crushes anything: it is a body in the way, no more.
    const share =
      to === runner.at
        ? runner.seen
          ? RUNNER_CAPTURE_SHARE
          : RUNNER_BLOCK_SHARE
        : to === runner.front
          ? RUNNER_BLOCK_SHARE
          : runner.path.includes(to)
            ? RUNNER_COVER_SHARE
            : 0;
    if (share > 0) best = Math.max(best, runnerUrgency(runner) * share);
  }
  return best;
};

const score = (ev: MoveEval, ctx: StrategicCtx): number => {
  const { move, isKingMove } = ev;
  // The Command Center's own square is survival's call, never this concern's.
  if (isKingMove) return 0;
  const { runners } = ctx;
  if (runners.length === 0) return 0;

  // A sieged tank fires without leaving its square: it can shoot a runner, but
  // it can never *stand* in front of one.
  const lands = move.firesInPlace ? move.from : move.to;
  let s = 0;

  for (const runner of runners) {
    // Only a marine taken off the square answers the race — on a *remembered*
    // runner the square may hold something else entirely.
    if (move.capture?.type === "p" && move.to === runner.at) {
      s += runnerUrgency(runner) * RUNNER_CAPTURE_SHARE;
      continue;
    }
    // A sieged tank firing in place never *arrives* anywhere, so it can shoot a
    // runner but can never become the body in front of one.
    if (!move.firesInPlace && move.to === runner.front) {
      s += runnerUrgency(runner) * blockShare(ev.after(), runner, ctx);
      continue;
    }
    if (isSoleBlocker(runner, move.from) && !runner.path.includes(lands)) {
      // Fleeing fire is not abandoning a post: a blocker the enemy is about to
      // take stops being a blocker either way, and survival owns that call.
      const flees = ctx.tactical.enemyAttacks(move.from) && ev.destSafe();
      // Charged against the stake it would have if we let it go, not against
      // the damped urgency our own blocker is the reason for.
      if (!flees) s -= runnerStake(runner) * RUNNER_ABANDON_SHARE;
      continue;
    }
    if (attacksSquare(ev.after(), lands, runner.front)) {
      s += runnerUrgency(runner) * RUNNER_COVER_SHARE;
    }
  }

  return s;
};

export const runners: StrategicStrategy = { id: "runners", score };
