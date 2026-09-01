// SPEC: _spec/apps/starchess/core/adjutant/strategic/promotion-defense.puml
/**
 * Enemy promotion runners — the fog-honest read of "who is about to promote".
 *
 * A marine covers **two** ranks in one turn (a gas step in rank B plus its
 * classical in rank C), so "squares left" is the wrong urgency scale. Turns
 * are: a runner three steps out is two turns from putting a BattleShip on our
 * back rank, and by the time it stands two steps out the answer already has to
 * be on the board. Nothing in the naive script reads this at all —
 * `nearPromoteRush` asks the question only about *our* marines — so a visible
 * enemy runner scored exactly nothing before this module existed.
 *
 * A marine never shoots straight ahead (`rules/specials/pawnDouble.ts` and the
 * front-blocked suite), which is what makes the answers here cheap: a body on
 * the square in front stops the runner dead, and the only way past is a
 * diagonal capture — so a blockade is only as good as the forward diagonals
 * are empty.
 *
 * **Fog-honest**, by the same rule as the CC posterior: a marine enters this
 * module only on a lit or revealed square. Once seen it is *remembered* rather
 * than forgotten — the second half of the file folds a decaying set of squares
 * it could have reached, so a runner that steps out of our light is still
 * answered. A marine we have never seen at all belongs to the known-vs-seen
 * ledger (`cheesePromotion` in `intel.ts`), which answers with a guard deploy
 * rather than with a blockade on a square we cannot even suspect.
 *
 * Two halves, two lifetimes: the scan is derived once per planning turn by
 * `buildStrategicCtx` and read-only after; the memory is folded once per
 * settled ply by `tracking.ts` and threaded by the host.
 */

import type { Square } from "chess.js";

import { hostileMineOn } from "../../board/mine-contact";
import { parseSquare, placementToMap, sq } from "../../board/placement";
import type { ScPiece } from "../../board/placement";
import { getSideVision } from "../../board/vision";
import type { PieceColor, ScFenSnapshot } from "../../model/types";
import { pawnSingleTarget } from "../../rules/specials/pawnDouble";
import type { AdjutantCtx } from "../context";
import {
  enemyOf,
  isLastRank,
  rankOf,
  RUNNER_RANKS_PER_TURN,
  stepsToPromotion,
  turnsToPromote,
} from "../context";
import { ourMarineKills, runnerCrossings, type ResolveWitness } from "./witness";

// Both live in `ai/context/pawns.ts` with the other marine-distance facts, and
// are re-exported here because this is the module callers reach for them from.
export { RUNNER_RANKS_PER_TURN, turnsToPromote };

/** One visible enemy marine, read as a promotion threat. */
export type EnemyRunner = {
  /** Where the marine stands now. */
  at: Square;
  /** Squares left to its promotion rank (never 0 — a promoted unit is not a runner). */
  steps: number;
  /** Turns until it can stand on the promotion rank, at two ranks per turn. */
  turns: number;
  /** Forward squares from `at` to the promotion rank, nearest first. */
  path: readonly Square[];
  /** The square directly in front — the blockade tile. */
  front: Square;
  /** The promotion square itself. */
  promoteAt: Square;
  /** Path squares that already stop it: any occupant, or a mine that kills it. */
  blockedBy: readonly Square[];
  /** Nothing at all stands in its way. */
  passed: boolean;
  /** We can see it *right now*; `false` means this is a remembered ghost. */
  seen: boolean;
  /** 1 for a sighting, decaying while we only remember it. Scales every share. */
  confidence: number;
  /** Squares it could be on — `[at]` when seen, the ghost's live set otherwise. */
  possible: readonly Square[];
};

/** Beyond this many turns from promotion a marine is a plan, not a threat. */
export const RUNNER_WATCH_TURNS = 3;

/** Turns-to-promotion at which a runner stops being a worry and becomes the turn's business. */
export const RUNNER_URGENT_TURNS = 2;

/**
 * What is left of the seek pull while an urgent runner is on the board.
 *
 * `seekFocus` is the one posture weight that *multiplies* — `mapControl` pays
 * it per square closed toward the CC guess, times a cue of up to 3 — so a tank
 * strolling four squares down the board can bank more than any flat weight in
 * the ladder. Searching for a Command Center we may not find this turn is
 * exactly the concern that has to wait while a marine is two turns from
 * promoting, so the strategic context damps the dial rather than starting an
 * arms race of constants against it.
 */
export const RUNNER_SEEK_DAMP = 0.25;

/** Forward squares from `from` to the promotion rank, nearest first. */
const forwardPath = (
  from: Square,
  color: PieceColor,
  steps: number,
): Square[] => {
  const out: Square[] = [];
  let at: Square | null = from;
  for (let i = 0; i < steps; i += 1) {
    at = pawnSingleTarget(at, color);
    if (!at) break;
    out.push(at);
  }
  return out;
};

/** The two squares a marine on `from` can capture onto — its only way past a blockade. */
export const forwardDiagonals = (from: Square, color: PieceColor): Square[] => {
  const { file, rank } = parseSquare(from);
  const forward = color === "w" ? rank + 1 : rank - 1;
  return [sq(file - 1, forward), sq(file + 1, forward)].filter(
    (s): s is Square => s != null,
  );
};

/**
 * Our units the runner can capture to advance anyway — a blockade in front of
 * a runner with a sidestep available only costs it a tempo. Asked against a
 * given occupancy so the caller can ask it about the POST-move board.
 */
export const runnerSidesteps = (
  map: ReadonlyMap<Square, ScPiece>,
  runner: EnemyRunner,
  us: PieceColor,
): Square[] =>
  forwardDiagonals(runner.at, enemyOf(us)).filter(
    (s) => map.get(s)?.color === us,
  );

/** One runner record, built from a square we either see or suspect. */
const runnerAt = (
  ctx: AdjutantCtx,
  at: Square,
  seen: boolean,
  confidence: number,
  possible: readonly Square[],
): EnemyRunner | null => {
  const { map, snap, us, enemy, vision } = ctx;
  const steps = stepsToPromotion(rankOf(at), enemy);
  if (steps <= 0) return null;
  const turns = turnsToPromote(steps);
  if (turns > RUNNER_WATCH_TURNS) return null;

  const path = forwardPath(at, enemy, steps);
  const front = path[0];
  const promoteAt = path[path.length - 1];
  if (!front || !promoteAt) return null;

  /**
   * What actually stops it, using only what we are entitled to know: our own
   * units and our own mines wherever they stand, and any occupant on a square
   * we can see. An enemy unit parked in the dark must never count as a
   * blockade — believing in one we cannot see is how a runner walks in while
   * the urgency sits damped at a quarter.
   */
  const blockedBy = path.filter(
    (s) =>
      map.get(s)?.color === us ||
      (map.has(s) && (vision.litSquares.has(s) || vision.revealedPieces.has(s))) ||
      hostileMineOn(snap.mines, enemy, s),
  );

  return {
    at,
    steps,
    turns,
    path,
    front,
    promoteAt,
    blockedBy,
    passed: blockedBy.length === 0,
    seen,
    confidence,
    possible,
  };
};

/**
 * The runners this turn: every enemy marine we can see within
 * {@link RUNNER_WATCH_TURNS} of promoting, plus the ones we only *remember*
 * from `memory` — each of those placed on its worst-case square, carrying the
 * confidence the fold has left it. Nearest first (a stable, deterministic
 * order); a remembered runner never displaces a seen one on the same square.
 */
export const scanEnemyRunners = (
  ctx: AdjutantCtx,
  memory?: RunnerMemory | null,
): EnemyRunner[] => {
  const { map, enemy, vision } = ctx;
  const out: EnemyRunner[] = [];
  const claimed = new Set<Square>();

  for (const [at, piece] of map) {
    if (piece.color !== enemy || piece.type !== "p") continue;
    if (!vision.litSquares.has(at) && !vision.revealedPieces.has(at)) continue;
    const runner = runnerAt(ctx, at, true, 1, [at]);
    if (!runner) continue;
    claimed.add(at);
    out.push(runner);
  }

  for (const ghost of memory?.ghosts ?? []) {
    // A marine standing where we suspected one *is* that ghost, already listed.
    // Otherwise take its worst-case square that no other runner has claimed —
    // two records must never describe one marine.
    const at = ghost.possible.find((s) => !claimed.has(s));
    if (!at) continue;
    const runner = runnerAt(ctx, at, false, ghost.confidence, ghost.possible);
    if (!runner) continue;
    claimed.add(at);
    out.push(runner);
  }

  return out.sort((a, b) => a.steps - b.steps || (a.at < b.at ? -1 : 1));
};

/* ── Cross-ply memory: the marine that ran past us ───────────────────────── */

/**
 * A marine we saw and then lost, carried forward as the set of squares it could
 * be on now. Mirrors the CC posterior (`context/ccIntel.ts`): positive evidence
 * collapses it to a point, negative evidence (a lit square it is *not* on)
 * prunes it, and time decays what is left.
 *
 * A marine is a far easier thing to remember than a Command Center: it only
 * moves forward, at most two ranks a turn, so the set stays small enough to be
 * worth acting on.
 */
export type RunnerGhost = {
  /** Where we last actually saw it, and on which turn. */
  seenAt: Square;
  seenTurn: number;
  /** Where it can be now — most advanced (worst case for us) first. */
  possible: readonly Square[];
  /** 1 at the sighting, ×{@link RUNNER_MEMORY_DECAY} for every ply since. */
  confidence: number;
};

/** One side's memory of the enemy's runners. Host-threaded, one fold per ply. */
export type RunnerMemory = {
  ghosts: readonly RunnerGhost[];
  /**
   * Our own units at the previous fold, square **and type**. A unit gone from
   * its square is a fact we hold whether or not we could see it happen — but
   * only the *type count* dropping tells a capture from a unit that simply
   * moved, and crediting a move as a capture invents runners out of our own
   * manoeuvres.
   */
  ourUnits: readonly { at: Square; type: ScPiece["type"] }[];
  /** Turn of the last fold — the guard that keeps one ply from advancing twice. */
  turn: number;
};

/** Per unseen ply. Matches the CC posterior's 0.7 strength decay. */
export const RUNNER_MEMORY_DECAY = 0.7;
/** Below this a ghost is noise and is dropped — five plies of silence. */
export const RUNNER_MEMORY_FLOOR = 0.2;
/** Confidence a remembered runner needs before it can cancel the economy's plans. */
export const RUNNER_URGENT_CONFIDENCE = 0.5;

export const emptyRunnerMemory = (): RunnerMemory => ({
  ghosts: [],
  ourUnits: [],
  // Before any ply, so the first fold of turn 0 is never mistaken for a repeat.
  turn: -1,
});

/** Where a ghost could have gone in one turn, pruned by everything we can see. */
const advanceGhost = (
  ghost: RunnerGhost,
  side: PieceColor,
  map: ReadonlyMap<Square, ScPiece>,
  visible: (at: Square) => boolean,
  lostOurs: ReadonlySet<Square>,
  minedForEnemy: (at: Square) => boolean,
  /**
   * Ranks it may still cover. A full turn for a ghost we are propagating; less
   * for a marine we watched part-way through its move, which has already spent
   * the difference (`witness.ts`).
   */
  reach = RUNNER_RANKS_PER_TURN,
): Square[] => {
  const enemy = enemyOf(side);
  const isRunner = (at: Square) => {
    const p = map.get(at);
    return !!p && p.color === enemy && p.type === "p";
  };
  // Our own units are known wherever they stand, fog or not: a marine can never
  // be standing on one, and never walks through one.
  const ours = (at: Square) => map.get(at)?.color === side;
  const next = new Set<Square>();

  for (const at of ghost.possible) {
    next.add(at); // stood still
    // Walked: one rank classically, two with a gas step — but never through
    // something we can see standing in the way.
    let step: Square | null = at;
    for (let i = 0; i < reach; i += 1) {
      step = pawnSingleTarget(step, enemy);
      if (!step) break;
      if (ours(step)) break;
      if (visible(step) && map.has(step) && !isRunner(step)) break;
      next.add(step);
      // Our own mine is ours to know: a marine that walks onto it dies there,
      // so the walk cannot continue past it.
      if (minedForEnemy(step)) break;
    }
    // Took one of ours on a forward diagonal — we know our own losses.
    for (const d of forwardDiagonals(at, enemy)) if (lostOurs.has(d)) next.add(d);
  }

  return [...next]
    .filter((at) => !isLastRank(rankOf(at), enemy)) // promoted — no longer a runner
    .filter((at) => !ours(at)) // our own unit stands there
    .filter((at) => !visible(at) || isRunner(at)) // we would be looking at it
    .sort(
      (a, b) =>
        stepsToPromotion(rankOf(a), enemy) - stepsToPromotion(rankOf(b), enemy) ||
        (a < b ? -1 : 1),
    );
};

/**
 * Fold one settled snapshot into `side`'s memory of enemy runners.
 *
 * Fog-honest in both directions: a marine enters memory only on a lit or
 * revealed square, and a ghost is pruned by any square we can see it is not on.
 * The one thing credited without vision is our own loss — a unit gone from a
 * runner's capture diagonal is evidence we hold regardless of fog.
 *
 * `witness` adds the channel the settled board cannot carry: a marine that
 * crossed one of our lit squares mid-turn and finished somewhere dark
 * (`witness.ts`). Without it the fold still works, on departures alone.
 */
export const foldRunnerMemory = (
  prior: RunnerMemory,
  snap: ScFenSnapshot,
  side: PieceColor,
  witness?: ResolveWitness | null,
): RunnerMemory => {
  /**
   * One turn, one propagation — but every ply, its evidence.
   *
   * A turn-open chip ply carries the *same* turn number as the settle before it
   * (`beginScTurn` does not advance the clock), so a guard that skipped the
   * whole fold would throw away the chip's account of itself: a shot fired at
   * turn open, and any marine seen in it. Only the forward walk and the decay
   * are once-per-turn; sightings, crossings and pruning always run.
   */
  const propagate = snap.turn !== prior.turn;

  const enemy = enemyOf(side);
  const map = placementToMap(snap.placement);
  const sieged: ReadonlySet<Square> = new Set(snap.siegedRooks ?? []);
  // Same vision the planner gets (`ai/context/vision.ts`): a sieged tank lights
  // 9×9, and our mines light their own tile. A fold that asked for less would
  // forget marines its own siege cone is looking at.
  const { litSquares, revealedPieces } = getSideVision(snap.placement, side, {
    mines: snap.mines,
    rookModeFor: (s) => (sieged.has(s) ? "siege" : "tank"),
  });
  const visible = (at: Square) => litSquares.has(at) || revealedPieces.has(at);

  const ourUnits: { at: Square; type: ScPiece["type"] }[] = [];
  for (const [at, piece] of map) {
    if (piece.color === side) ourUnits.push({ at, type: piece.type });
  }

  /**
   * Squares one of ours left *and* that we can account for as a loss: a type
   * whose count dropped. Without the count test our own knight hopping off a
   * runner's capture diagonal would invent an advance the enemy never made.
   */
  const lost = new Map<ScPiece["type"], number>();
  for (const { type } of prior.ourUnits) lost.set(type, (lost.get(type) ?? 0) + 1);
  for (const { type } of ourUnits) lost.set(type, (lost.get(type) ?? 0) - 1);
  const lostOurs = new Set(
    prior.ourUnits
      .filter(
        ({ at, type }) =>
          map.get(at)?.color !== side && (lost.get(type) ?? 0) > 0,
      )
      .map(({ at }) => at),
  );

  const ghosts: RunnerGhost[] = [];
  const sighted = new Set<Square>();

  for (const [at, piece] of map) {
    if (piece.color !== enemy || piece.type !== "p") continue;
    if (!visible(at)) continue;
    const steps = stepsToPromotion(rankOf(at), enemy);
    if (steps <= 0 || turnsToPromote(steps) > RUNNER_WATCH_TURNS) continue;
    sighted.add(at);
    ghosts.push({ seenAt: at, seenTurn: snap.turn, possible: [at], confidence: 1 });
  }

  const mined = (at: Square) => hostileMineOn(snap.mines, enemy, at);
  const absorbed = new Set<Square>();

  /**
   * Carry a ghost forward: walk it as far as `reach` allows, then reconcile.
   * A marine standing where it could now be *is* that marine — one sighting
   * retires one ghost — and any other sighted square is somebody else, so it
   * leaves the set. `null` means the ghost is finished: captured, promoted, or
   * never there at all.
   */
  const carry = (ghost: RunnerGhost, reach: number): readonly Square[] | null => {
    const advanced = advanceGhost(ghost, side, map, visible, lostOurs, mined, reach);
    const hit = advanced.find((at) => sighted.has(at) && !absorbed.has(at));
    if (hit) {
      absorbed.add(hit);
      return null;
    }
    const open = advanced.filter((at) => !sighted.has(at));
    return open.length > 0 ? open : null;
  };

  for (const ghost of prior.ghosts) {
    const possible = carry(ghost, propagate ? RUNNER_RANKS_PER_TURN : 0);
    if (!possible) continue;
    const confidence = propagate
      ? ghost.confidence * RUNNER_MEMORY_DECAY
      : ghost.confidence;
    if (confidence < RUNNER_MEMORY_FLOOR) continue;
    ghosts.push({ ...ghost, possible, confidence });
  }

  /**
   * The fly-by channel: a marine we watched cross one of our lit squares during
   * the turn, which the settled board cannot show. It seeds a ghost where we
   * saw it, walked forward only by what the sighting leaves unaccounted for.
   *
   * A crossing supersedes any ghost it overlaps — it is the same marine, seen
   * again — which is what keeps one runner from being counted twice, once as
   * last turn's ghost and once as this turn's sighting.
   */
  const killed = witness ? ourMarineKills(witness, side) : new Set<Square>();
  for (const crossing of witness ? runnerCrossings(witness, side) : []) {
    if (sighted.has(crossing.at)) continue; // the settled board already has it
    const steps = stepsToPromotion(rankOf(crossing.at), enemy);
    if (steps <= 0 || turnsToPromote(steps) > RUNNER_WATCH_TURNS) continue;

    const seed: RunnerGhost = {
      seenAt: crossing.at,
      seenTurn: snap.turn,
      possible: [crossing.at],
      confidence: 1,
    };
    const carried = carry(seed, crossing.residual);
    // A marine we killed ourselves this ply is not a runner, whatever the fog
    // says about the square it died on.
    const possible = carried?.filter((at) => !killed.has(at));
    if (!possible || possible.length === 0) continue;

    const overlaps = (g: RunnerGhost) => g.possible.some((at) => possible.includes(at));
    for (let i = ghosts.length - 1; i >= 0; i -= 1) {
      if (!sighted.has(ghosts[i]!.possible[0]!) && overlaps(ghosts[i]!)) ghosts.splice(i, 1);
    }
    ghosts.push({ ...seed, possible });
  }

  return { ghosts, ourUnits, turn: snap.turn };
};

/**
 * A runner nothing contains, close enough that this turn has to answer it —
 * and, when we are only remembering it, one we still believe in.
 */
export const isUrgentRunner = (runner: EnemyRunner): boolean =>
  runner.passed &&
  runner.turns <= RUNNER_URGENT_TURNS &&
  runner.confidence >= RUNNER_URGENT_CONFIDENCE;

/** True when `at` is the *only* thing standing between this runner and promotion. */
export const isSoleBlocker = (runner: EnemyRunner, at: Square): boolean =>
  runner.blockedBy.length === 1 && runner.blockedBy[0] === at;
