// SPEC: _spec/apps/starchess/core/adjutant/strategic/cc-retaliation.puml, _spec/apps/starchess/core/adjutant/weight-ladder.puml
/**
 * Retaliation — take the unit that shot the Command Center, by any means.
 *
 * Firing on a Command Center is the one act fog cannot cover: the hit is felt
 * and the shot names its origin (`../attackers.ts`). The standing instruction
 * is therefore blunt, and deliberately so — whatever else the turn offers, the
 * shooter comes off the board if it can be reached.
 *
 * The weight sits directly under `KING_SAFETY`: keeping the Command Center out
 * of fire still outranks avenging it, and everything else — the promotion race
 * included — does not. It is a *capture* weight and nothing else: no chasing,
 * no positional pull toward the square, because a wanted square we cannot
 * actually strike must not warp the rest of the plan.
 */

import type { Square } from "chess.js";

import { UNIT_COST } from "../../../rules/constants";
import type { MoveEval } from "../../context";
import type { StrategicCtx } from "../context";
import { wantedAt } from "../attackers";
import type { StrategicStrategy } from "./types";

/**
 * Taking the unit that fired on our Command Center. Below `KING_SAFETY`
 * (10_000) so the CC's own safety still wins, above `RUNNER_STOP_CRITICAL`
 * (7_000) and every offensive weight, which is what "however possible" means:
 * it outbids a check, a promotion stop and any ordinary trade.
 */
export const AVENGE_CC_SHOT = 9_000;

/**
 * Answering with the cheapest unit that can do it. A marine that can take the
 * shooter should not lose the job to the BattleShip that can also take it, so
 * the bonus is scaled down by what we spend — never enough to change *whether*
 * we retaliate, only *with what*.
 */
export const AVENGE_THRIFT = 40;

/** What taking the wanted unit on `to` is worth, for any means of taking it. */
export const avengeValue = (
  ctx: StrategicCtx,
  to: Square,
  attackerCost: number,
): number =>
  wantedAt(ctx.ccAttackers, to)
    ? AVENGE_CC_SHOT - AVENGE_THRIFT * attackerCost
    : 0;

/**
 * The same debt, collected by dropping a unit on top of the shooter.
 *
 * Two corrections the move path does not need. The deploy loop already pays
 * `trade × (1 + cost)` for spending big, so thrift here has to *out-run* that
 * slope or the ring answers with the most expensive unit it can afford —
 * exactly backwards. And a crush needs something to crush: every ring square
 * sits inside our own Command Center's 3×3, so its occupancy is ours to read,
 * and paying for a drop onto an empty square would just burn minerals.
 */
export const avengeDeployValue = (
  ctx: StrategicCtx,
  to: Square,
  unitCost: number,
): number => {
  if (!wantedAt(ctx.ccAttackers, to)) return 0;
  if (ctx.map.get(to)?.color !== ctx.enemy) return 0;
  return AVENGE_CC_SHOT - (ctx.weights.trade + AVENGE_THRIFT) * unitCost;
};

const score = (ev: MoveEval, ctx: StrategicCtx): number => {
  const { move, piece, isKingMove } = ev;
  if (ctx.ccAttackers.length === 0) return 0;
  // Only a capture settles the debt, and the Command Center is not the unit to
  // collect it with: survival owns where the CC stands, and this concern must
  // never bid it toward a shooter.
  if (isKingMove || !move.capture) return 0;
  return avengeValue(ctx, move.to, UNIT_COST[piece.type]);
};

export const attackers: StrategicStrategy = { id: "attackers", score };
