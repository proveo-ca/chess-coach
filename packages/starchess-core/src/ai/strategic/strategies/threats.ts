/**
 * Threats — Strategic version that is 1-move aware, especially for Hoverbikes.
 *
 * Naive `threats` only penalizes hanging (moving into attacked squares).
 * Strategic also rewards *blocking* a 1-move hoverbike check — a hoverbike that sits
 * on `checkThreatSquares` will check next turn unless we interpose or move.
 * This is what makes games end sooner: the strategic doesn't wait to be checked,
 * it sees the hoverbike 1 away and either deploys adjacent to the Command Center (CC) to block
 * or steps the Command Center (CC) repositioning.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml
 */

import type { MoveEval } from "../../context";
import type { StrategicCtx } from "../context";
import type { StrategicStrategy } from "./types";

const KNIGHT_1_MOVE_BLOCK = 800;
const KNIGHT_1_MOVE_KING_STEP = 600;
// Keep defensive block modest — offensive SNEAK 3000/ATTACK 5000 should dominate for sooner finish

const score = (ev: MoveEval, ctx: StrategicCtx): number => {
  const { move, isKingMove } = ev;
  if (isKingMove || move.capture) return 0;

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
  const isKnightThreat = (() => {
    for (const sq of tactical.checkThreatSquares) {
      const p = map.get(sq);
      if (p && p.color === ctx.enemy && p.type === "n") return true;
    }
    return false;
  })();

  if (isKnightThreat) {
    // Moving the Command Center (CC) to a safe square when a hoverbike is 1 away is repositioning, not capture
    if (isKingMove) {
      const destSafe = ev.destSafe();
      if (destSafe) s += KNIGHT_1_MOVE_KING_STEP;
    } else {
      // Deploy or interpose: moving any piece to block the hoverbike's check ray
      // A cheap way is to see if the move lands on a square that would be on the hoverbike's attack
      // For hoverbike, the only block is to move the Command Center (CC), but we can also deploy adjacent to Command Center (CC) to take the hoverbike
      // So we reward any non-command center (CC) move that goes to a square adjacent to the Command Center (CC) when a hoverbike threatens
      const king = ctx.king;
      const isAdjacentToKing = Math.abs(move.to.charCodeAt(0) - king.charCodeAt(0)) <= 1 && Math.abs(Number(move.to[1]) - Number(king[1])) <= 1;
      if (isAdjacentToKing) s += KNIGHT_1_MOVE_BLOCK;
    }
  }

  return s;
};

export const threats: StrategicStrategy = { id: "threats", score };
