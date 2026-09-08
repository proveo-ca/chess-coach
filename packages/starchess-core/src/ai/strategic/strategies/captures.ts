// SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml, _spec/apps/starchess/core/adjutant/cc-focus.puml
/**
 * Captures — strategic version, fog-honest about where the Command Center is.
 */

import type { Square } from "chess.js";

import { attacksSquare } from "../../../board/placement";
import { deployCovers } from "../../../board/deploy-reach";
import {
  charonDiagonalSquares,
  charonStrikeTarget,
  charonTargetShips,
} from "../../../rules/specials/mechaCharon";
import {
  incomeForTurn,
  MAX_STORED_MATERIAL,
  UNIT_COST,
} from "../../../rules/constants";
import { chebyshev } from "../../context";
import type { Candidate, MoveEval } from "../../context";
import {
  CHARON_GUESS,
  CHARON_GUESS_HIT_RATE,
  CHARON_INSTA,
  CHARON_MAX_GUESSES_PER_SHIP,
  CHARON_MAX_GUESSES_TOTAL,
  EQUAL_TRADE_ATTACK,
  HUNT_UNDEFENDED_PAWN,
  PAWN_TRADE,
  SAC_FOR_CC,
  SAC_FOR_CC_WINNING,
  enemyCanJump,
  predictEnemyWarpDestinations,
} from "../../strategies/captures";
import type { StrategicCtx } from "../context";
import { asCandidate } from "./types";
import type { StrategicStrategy } from "./types";

/**
 * Enemy bank ceiling from the public income ledger alone — no read of the real
 * enemy bank, and an over-estimate, so a defended square is never mistaken for
 * a free one.
 */
const enemyBankCeiling = (turn: number): number => {
  let stored = 1;
  for (let t = 2; t <= turn; t += 1) stored += incomeForTurn(t);
  return Math.min(MAX_STORED_MATERIAL, stored);
};

const charonStrikes = (ctx: StrategicCtx): Candidate[] => {
  const { map, snap, us, enemy, weights } = ctx;
  const out: Candidate[] = [];
  const base = weights.trade * (1 + UNIT_COST.q - UNIT_COST.b);

  if (!enemyCanJump(snap, enemy)) {
    for (const [from, piece] of map) {
      if (piece.color !== us || piece.type !== "b") continue;
      for (const target of charonTargetShips(map, from)) {
        out.push(
          asCandidate(
            { timing: "B", kind: "bishopSnipe", color: us, from, to: target },
            base + CHARON_INSTA,
          ),
        );
      }
    }
    return out;
  }

  let total = 0;
  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "b") continue;
    const diagonals = new Set(charonDiagonalSquares(map, from));
    for (const [shipSq, shipPiece] of map) {
      if (shipPiece.color !== enemy || shipPiece.type !== "q") continue;
      let perShip = 0;
      for (const dest of predictEnemyWarpDestinations(ctx, shipSq)) {
        if (perShip >= CHARON_MAX_GUESSES_PER_SHIP) break;
        if (total >= CHARON_MAX_GUESSES_TOTAL) return out;
        if (!diagonals.has(dest)) continue;
        const probe = new Map(map);
        probe.delete(shipSq);
        probe.set(dest, { type: "q", color: enemy });
        if (charonStrikeTarget(probe, from, dest, us) !== dest) continue;
        perShip += 1;
        total += 1;
        out.push(
          asCandidate(
            { timing: "F", kind: "bishopSnipe", color: us, from, to: dest },
            base + CHARON_GUESS * CHARON_GUESS_HIT_RATE,
          ),
        );
      }
    }
  }
  return out;
};

const score = (ev: MoveEval, ctx: StrategicCtx): number => {
  const { move, piece, isKingMove } = ev;
  if (isKingMove || !move.capture) return 0;

  const { tactical, material, weights, enemy, enemyKing, snap, vision, ccIntel } = ctx;
  const { trade } = weights;
  let s = 0;

  const isGuess = !vision.enemyKingVisible;
  const targetCC: Square | null = isGuess ? ccIntel.focus : enemyKing;
  const guessUsable = !isGuess || ccIntel.strength > 0;

  const victimValue = UNIT_COST[move.capture.type];
  const attackerValue = UNIT_COST[piece.type];

  if (move.capture.type === "p") {
    const after = ev.after();
    const deployDefends = deployCovers(
      {
        map: after,
        mines: snap.mines,
        color: enemy,
        cc: targetCC,
        gas: snap.gasIncome[enemy],
        minerals: enemyBankCeiling(snap.turn + 1),
      },
      move.to,
    );
    const nearCC = targetCC != null && chebyshev(move.to, targetCC) === 1;
    const keepsCCUnderFire =
      targetCC != null && attacksSquare(after, move.to, targetCC);
    const givesUnitForCC =
      guessUsable && (deployDefends || nearCC) && keepsCCUnderFire;

    const undefended = !tactical.enemyAttacks(move.to) && !deployDefends && !nearCC;
    if (undefended) s += HUNT_UNDEFENDED_PAWN;
    else if (material.congested) s += HUNT_UNDEFENDED_PAWN * 0.35;
    if (material.congested && piece.type === "p") s += PAWN_TRADE;
    if (givesUnitForCC) s += ctx.winning ? SAC_FOR_CC_WINNING : SAC_FOR_CC;
  }

  if (victimValue === attackerValue) s += EQUAL_TRADE_ATTACK;
  else if (victimValue > attackerValue) s += trade * (1 + (victimValue - attackerValue));
  else s += trade * 0.25;

  if (tactical.friendlyProtects(move.to)) s += trade * 0.35;

  return s;
};

export const captures: StrategicStrategy = {
  id: "captures",
  generate: charonStrikes,
  score,
};

