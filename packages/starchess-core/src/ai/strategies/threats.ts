// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
/**
 * Threats — not hanging our own units.
 *
 * The blunder guard is deliberately the whole of this concern: every other
 * "am I in danger" question is either survival (the Command Center (CC) and a savable
 * BattleShip) or checks (the enemy Command Center (CC)). What is left is the quiet mistake of
 * parking a unit on a square the enemy already covers.
 */

import type { AdjutantCtx, MoveEval } from "../context";
import type { Strategy } from "./types";

const score = (ev: MoveEval, ctx: AdjutantCtx): number => {
  const { move, isKingMove } = ev;
  // The Command Center (CC)'s own safety is survival's call, and a capture pays for itself.
  if (isKingMove || move.capture) return 0;

  const { tactical, weights } = ctx;
  if (!tactical.enemyAttacks(move.to)) return 0;

  // Covered by a friend — a trade we can answer, not a giveaway.
  return -(tactical.friendlyProtects(move.to)
    ? weights.attackedPenalty * 0.35
    : weights.attackedPenalty);
};

export const threats: Strategy = { id: "threats", score };
