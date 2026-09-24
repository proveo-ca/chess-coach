// SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml, _spec/apps/starchess/core/adjutant/weight-ladder.puml
/**
 * Threats — strategic version, aware of a check one move before it lands.
 */

import { chebyshev } from "../../context";
import type { MoveEval } from "../../context";
import type { StrategicCtx } from "../context";
import type { StrategicStrategy } from "./types";

/** Interpose against a Hoverbike that checks next turn. Deliberately below the offensive tiers. */
export const HOVERBIKE_1_MOVE_BLOCK = 800;

const score = (ev: MoveEval, ctx: StrategicCtx): number => {
  const { move, isCCMove } = ev;
  if (isCCMove || move.capture) return 0;

  const { tactical, weights, map } = ctx;
  let s = 0;

  // Base: don't hang (same as naive, but keep it)
  if (tactical.enemyAttacks(move.to)) {
    s -= tactical.friendlyProtects(move.to) ? weights.attackedPenalty * 0.35 : weights.attackedPenalty;
  }

  // 1-move hoverbike check threat: enemy hoverbike on a square that can check us next
  // If we move to block that ray or step the Command Center (CC), reward.
  // `checkThreatSquares` are enemy squares that can check in one move (tactical.ts)
  // For hoverbikes, this is exactly the 1-move check threat the user flagged.
  const isHoverbikeThreat = (() => {
    for (const sq of tactical.checkThreatSquares) {
      const p = map.get(sq);
      if (p && p.color === ctx.enemy && p.type === "n") return true;
    }
    return false;
  })();

  if (isHoverbikeThreat && chebyshev(move.to, ctx.commandCenter) <= 1) {
    s += HOVERBIKE_1_MOVE_BLOCK;
  }

  return s;
};

export const threats: StrategicStrategy = { id: "threats", score };
