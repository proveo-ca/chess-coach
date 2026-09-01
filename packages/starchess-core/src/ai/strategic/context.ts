// SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml
/**
 * Strategic context assembly — the naive planning context plus the
 * known-vs-seen intel the strategic economy weighs.
 *
 * Builds on `buildAdjutantCtx` unchanged (vision · tactical · posture · Command Center (CC)
 * intel · material are all shared), then layers the strategic dials:
 *   - `kvs`            — the known-vs-seen accumulator (host-threaded, or a
 *                        deterministic one-turn estimate for snap-only callers)
 *   - `cheesePromotion`— hidden enemy material worth at least a marine in
 *                        mid-game (the promotion-rush / "cheese" window)
 *   - `winning`        — our board plus captured exceeds what the enemy knows
 *   - `runners`        — the *visible* half of the same question: enemy marines
 *                        already close enough to promote (`runners.ts`)
 *
 * Like the naive context, the strategic context is built once per planning
 * turn and treated as read-only afterwards.
 */

import type { AdjutantCtx, AdjutantContext } from "../context";
import { buildAdjutantCtx } from "../context";
import type { ScFenSnapshot } from "../../model/types";
import type { Square } from "chess.js";
import { getCCBestGuess, type CCIntel, emptyCCIntel } from "../context/ccIntel";
import {
  boardValue,
  detectCheesePromotion,
  estimateKnownVsSeen,
  isWinning,
  pieceValue,
  type KnownVsSeen,
} from "./intel";
import {
  isUrgentRunner,
  RUNNER_SEEK_DAMP,
  scanEnemyRunners,
  type EnemyRunner,
  type RunnerMemory,
} from "./runners";
import type { AttackerMemory, CCAttacker } from "./attackers";

// The strategic context re-exports the shared candidate shapes so strategic
// strategies read the same `Candidate` / `Move` / `MoveEval` as naive ones.
export type { Candidate, Move, MoveEval } from "../context";

/** Host-threaded input to the strategic planner (besides the naive knobs). */
export type StrategicAdjutantContext = AdjutantContext & {
  /**
   * Known-vs-seen accumulator maintained by the host across turns. Absent for
   * snap-only callers, who get a deterministic one-turn estimate instead.
   */
  kvs?: KnownVsSeen;
  /** CC search state — the host threads the previous `CCIntel` and the last Hoverbike probe. */
  ccIntel?: CCIntel | null;
  lastCCProbe?: { to: Square; empty: boolean } | null;
  /**
   * Memory of enemy marines that ran past our vision and are no longer on a
   * square we can see. Absent for snap-only callers, who then see only what is
   * lit this turn.
   */
  runnerMemory?: RunnerMemory | null;
  /** Who has fired on our Command Center lately, and from where. */
  attackerMemory?: AttackerMemory | null;
};

/** The full strategic planning context handed to strategic strategies. */
export type StrategicCtx = AdjutantCtx & {
  kvs: KnownVsSeen;
  cheesePromotion: boolean;
  winning: boolean;
  ccIntel: CCIntel;
  /** Visible enemy marines near their promotion rank — the fog-honest half of the cheese window. */
  runners: readonly EnemyRunner[];
  /** Units that fired on our Command Center and named themselves doing it. */
  ccAttackers: readonly CCAttacker[];
};

/** Sum of enemy unit value currently visible (lit or revealed) this turn. */
export const revealedEnemyValue = (ctx: AdjutantCtx): number => {
  let v = 0;
  for (const [sq, piece] of ctx.map) {
    if (piece.color !== ctx.enemy) continue;
    if (ctx.vision.litSquares.has(sq) || ctx.vision.revealedPieces.has(sq)) {
      v += pieceValue(piece);
    }
  }
  return v;
};

/** Value of units of `color` on the board. */
export const ourBoardValue = (ctx: AdjutantCtx): number =>
  boardValue(ctx.map, ctx.us);

/**
 * How much we can count against the enemy: our board plus the enemy material we
 * have already removed (captures / deploy-over-kills).
 */
export const countedForUs = (ctx: AdjutantCtx, kvs: KnownVsSeen): number =>
  ourBoardValue(ctx) + kvs.captured;

export const buildStrategicCtx = (
  snap: ScFenSnapshot,
  ctx?: StrategicAdjutantContext,
): StrategicCtx | null => {
  const base = buildAdjutantCtx(snap, ctx);
  if (!base) return null;

  const kvs: KnownVsSeen =
    ctx?.kvs ?? estimateKnownVsSeen(revealedEnemyValue(base), base.snap.turn);
  const ccIntel = getCCBestGuess(
    ctx?.ccIntel ?? emptyCCIntel(base.enemy),
    base.map,
    base.vision.litSquares,
    base.vision.revealedPieces,
    ctx?.lastCCProbe ?? null,
    base.enemy,
  );

  const runners = scanEnemyRunners(base, ctx?.runnerMemory ?? null);

  return {
    ...base,
    // Hunting for a Command Center we may not even find this turn is the one
    // concern that waits while a marine is about to promote. The dial is damped
    // here, in the context, so the strategies keep reading `weights` and never
    // branch on the runner themselves.
    weights: runners.some(isUrgentRunner)
      ? { ...base.weights, seekFocus: base.weights.seekFocus * RUNNER_SEEK_DAMP }
      : base.weights,
    kvs,
    ccIntel,
    cheesePromotion: detectCheesePromotion(kvs, base.snap.turn),
    winning: isWinning(countedForUs(base, kvs), kvs.known),
    runners,
    ccAttackers: ctx?.attackerMemory?.attackers ?? [],
  };
};