/**
 * Strategic context assembly — the naive planning context plus the
 * known-vs-seen intel the strategic economy weighs.
 *
 * Builds on `buildAdjutantCtx` unchanged (vision · tactical · posture · King
 * intel · material are all shared), then layers the strategic dials:
 *   - `kvs`            — the known-vs-seen accumulator (host-threaded, or a
 *                        deterministic one-turn estimate for snap-only callers)
 *   - `cheesePromotion`— hidden enemy material worth at least a pawn in
 *                        mid-game (the promotion-rush / "cheese" window)
 *   - `winning`        — our board plus captured exceeds what the enemy knows
 *
 * Like the naive context, the strategic context is built once per planning
 * turn and treated as read-only afterwards.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml
 */

import type { AdjutantCtx, AdjutantContext } from "../context";
import { buildAdjutantCtx } from "../context";
import type { ScFenSnapshot } from "../../model/types";
import {
  boardValue,
  detectCheesePromotion,
  estimateKnownVsSeen,
  isWinning,
  pieceValue,
  type KnownVsSeen,
} from "./intel";

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
};

/** The full strategic planning context handed to strategic strategies. */
export type StrategicCtx = AdjutantCtx & {
  kvs: KnownVsSeen;
  cheesePromotion: boolean;
  winning: boolean;
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

  return {
    ...base,
    kvs,
    cheesePromotion: detectCheesePromotion(kvs, base.snap.turn),
    winning: isWinning(countedForUs(base, kvs), kvs.known),
  };
};