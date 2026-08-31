/**
 * Captures — taking material, and the Charon strike that removes a BattleShip
 * without moving the Mecha.
 *
 * Trade policy: equal material is always worth taking; up-trades scale with the
 * gap; down-trades stay barely tempting so they only win when another concern
 * (survival, checks) is already paying for the move.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
 */

import { charonTargetQueenFromPlacement } from "../../rules/specials/bishopCharon";
import { UNIT_COST, incomeForTurn } from "../../rules/constants";
import { attacksSquare } from "../../board/placement";
import { deployCovers } from "../../board/deploy-reach";
import { chebyshev } from "../context";
import type { AdjutantCtx, Candidate, MoveEval } from "../context";
import { asCandidate, type Strategy } from "./types";

/** Equal-material capture when in range — always take the trade. */
export const EQUAL_TRADE_ATTACK = 2_400;
/** Congested / always: take an undefended enemy marine. */
export const HUNT_UNDEFENDED_PAWN = 950;
/** Congested: trade marine-for-marine to clear clutter. */
export const PAWN_TRADE = 750;
/** Charon (B) then a second unit still strikes in the same turn. */
export const CHARON_COMBO = 2_500;
/** Give up a unit to keep the enemy Command Center under fire, while ahead. */
export const SAC_FOR_CC_WINNING = 1_800;
/** Same trade while not ahead — kept below a real check. */
export const SAC_FOR_CC = 400;

/** Charon missiles at a unique diagonal enemy battleship (2 gas). */
const charonStrikes = (ctx: AdjutantCtx): Candidate[] => {
  const { map, snap, us, weights } = ctx;
  const out: Candidate[] = [];

  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "b") continue;
    const target = charonTargetQueenFromPlacement(snap.placement, from);
    if (!target) continue;
    out.push(
      asCandidate(
        { timing: "B", kind: "bishopSnipe", color: us, from, to: target },
        weights.trade * (1 + UNIT_COST.q - UNIT_COST.b) + CHARON_COMBO * 0.35,
      ),
    );
  }
  return out;
};

const score = (ev: MoveEval, ctx: AdjutantCtx): number => {
  const { move, piece, isKingMove } = ev;
  if (isKingMove || !move.capture) return 0;

  const { tactical, material, weights, enemy, enemyKing, snap } = ctx;
  const { trade } = weights;
  let s = 0;

  const victimValue = UNIT_COST[move.capture.type];
  const attackerValue = UNIT_COST[piece.type];

  if (move.capture.type === "p") {
    const after = ev.after();
    const deployDefends = deployCovers(
      {
        map: after,
        mines: snap.mines,
        color: enemy,
        cc: enemyKing,
        gas: snap.gasIncome[enemy],
        minerals: ctx.storedFor(enemy) + incomeForTurn(snap.turn + 1),
      },
      move.to,
    );
    const nearCC = enemyKing != null && chebyshev(move.to, enemyKing) === 1;
    const keepsCCUnderFire =
      enemyKing != null && attacksSquare(after, move.to, enemyKing);
    const givesUnitForCC = (deployDefends || nearCC) && keepsCCUnderFire;

    const undefended = !tactical.enemyAttacks(move.to) && !deployDefends && !nearCC;
    if (undefended) s += HUNT_UNDEFENDED_PAWN;
    else if (material.congested) s += HUNT_UNDEFENDED_PAWN * 0.35;
    if (material.congested && piece.type === "p") s += PAWN_TRADE;
    if (givesUnitForCC) s += ctx.winning ? SAC_FOR_CC_WINNING : SAC_FOR_CC;
  }

  if (victimValue === attackerValue) {
    // Same material — always attack.
    s += EQUAL_TRADE_ATTACK;
  } else if (victimValue > attackerValue) {
    s += trade * (1 + (victimValue - attackerValue));
  } else {
    // Bad trade — only slightly tempting unless it also saves us.
    s += trade * 0.25;
  }

  // Prefer capturing onto a square we already protect.
  if (tactical.friendlyProtects(move.to)) s += trade * 0.35;

  return s;
};

export const captures: Strategy = {
  id: "captures",
  generate: charonStrikes,
  score,
};
