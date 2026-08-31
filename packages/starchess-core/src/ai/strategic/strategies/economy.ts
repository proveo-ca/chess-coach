/**
 * Economy (STRATEGIC) — what the Command Center deploys, reacting to the
 * known-vs-seen material model the naive economy cannot see.
 *
 * Mirrors naive `strategies/economy.ts` (same bank/unit-mix/command center (CC)-proximity
 * policy, reusing `deployPolicy`, `centerScore`, `promoteProgress`), then
 * layers three strategic dials:
 *
 *  - **winning** — we are up in material by the known-vs-seen count. Save
 *    toward a BattleShip (battleship) to end the game: rush the `q` drop when the
 *    bank can afford it, and skip light drops (marine / hoverbike) that would
 *    delay the ship — unless the Command Center (CC) is hot or the enemy hides material.
 *  - **cheese / hidden material** — `gap > 0`: the ledger says the enemy holds
 *    material we have never seen (e.g. a hidden promotion runner). When the
 *    enemy has hidden material, defense outranks saving: prefer the guard
 *    drops (tank commands a neighbouring square; marines shore the shelter) and
 *    cancel the battleship-finish saving spree.
 *  - **kingThreatened** — unchanged from naive: survival always outranks
 *    economy (the absolute survival weights still dominate elsewhere).
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-economy.puml
 */

import type { Square } from "chess.js";

import { attacksSquare, isSquareAttackedBy, type ScPiece } from "../../../board/placement";
import { hostileMineOn } from "../../../board/mine-contact";
import { UNIT_COST } from "../../../rules/constants";
import type { StrategicCtx } from "../context";
import {
  bestDeploySequence,
  isUnitInBestSequence,
  projectedBank,
  SHIP_HORIZON_BONUS,
} from "../deployLookahead";
import type { Candidate } from "../../context";
import { centerScore, neighbors, promoteProgress, rankOf } from "../../context";
import {
  MAX_KNIGHTS,
  ROOK_AFTER_KNIGHTS,
  BISHOP_FIRST,
  BISHOP_VS_QUEEN,
  deployPolicy,
} from "../../strategies/economy";
import type { StrategicStrategy, } from "./types";
import { asCandidate } from "./types";

/** Cap Hoverbikes — mirrors naive (prefer tank after this many hoverbikes). */
export const MAX_KNIGHTS_S = MAX_KNIGHTS;
/** Tank-biased guard when the enemy holds hidden material (cheese window). */
export const HIDDEN_GUARD = 1_450;
/** BattleShip rush when winning: deploy q the moment the bank allows. */
export const QUEEN_FINISH = 3_200;

const deploys = (ctx: StrategicCtx): Candidate[] => {
  const { map, snap, us, enemy, king, kingThreatened, material, vision, weights, kvs, cheesePromotion, winning } =
    ctx;
  const { center, promoteRank, trade, attackedPenalty } = weights;
  const { preferHeavy, needBishop, wantBishops, knightsFull } = deployPolicy(ctx);
  const hidden = kvs.gap > 0 || cheesePromotion;
  const out: Candidate[] = [];
  // 5-turn deploy lookahead: projects budget and picks best composition (e.g.
  // p+p+q vs n+b+r when projected 11). Used to boost horizon-aligned units.
  const horizonSeq = bestDeploySequence(ctx, 5);
  const horizonBank = projectedBank(material.bank, snap.turn, 5);

  const _isOpenFile = (sq: Square, m: Map<Square, ScPiece>): boolean => {
    const file = sq[0];
    for (const [s, p] of m) if (s[0] === file && p.type === "p") return false;
    return true;
  };
  // Deploy may land on empty, ally or enemy (crush) — all show deploy survives
  const adjacent = neighbors(king).filter(
    (at) => !hostileMineOn(snap.mines, us, at),
  );

  for (const unit of ["p", "n", "b", "r", "q"] as const) {
    if (UNIT_COST[unit] > material.bank) continue;
    if (unit === "n" && knightsFull) continue;
    if (material.congested && unit === "p") continue;
    // Skip light drops when we can afford a tank+ (unless Command Center (CC) threatened, or
    // we still need mechas vs a visible enemy battleship).
    if (
      preferHeavy &&
      !kingThreatened &&
      UNIT_COST[unit] < UNIT_COST.r &&
      !(wantBishops && unit === "b")
    ) {
      continue;
    }
    // After 2 hoverbikes, prefer tank deploys over other mid-tier options.
    if (knightsFull && preferHeavy && unit !== "r" && unit !== "q" && unit !== "b") {
      continue;
    }
    // STRATEGIC: winning + nothing hidden → save light drops toward a ship.
    // Defense (command center (CC) hot / enemy hidden) always cancels the saving spree.
    // Horizon-aware: only save when the ship is reachable within 5 turns.
    if (
      winning &&
      !hidden &&
      !kingThreatened &&
      material.bank < UNIT_COST.q &&
      horizonBank >= UNIT_COST.q &&
      (unit === "p" || unit === "n")
    ) {
      continue;
    }

    for (const to of adjacent) {
      if (unit === "p" && (rankOf(to) === 1 || rankOf(to) === 8)) continue;
      let score =
        center * centerScore(to) +
        promoteRank * promoteProgress(rankOf(to), us) +
        trade * (1 + UNIT_COST[unit]);
      // Turn 1: hoverbike and mecha equal for probabilistic open
      if (needBishop && unit === "b" && !kingThreatened && snap.turn > 1) score += BISHOP_FIRST;
      if (vision.enemyQueenVisible && unit === "b" && !kingThreatened) {
        score += BISHOP_VS_QUEEN;
      }
      if (knightsFull && unit === "r") score += ROOK_AFTER_KNIGHTS;
      // STRATEGIC: cheesy hidden material → tank guard on the Command Center (CC)'s perimeter
      if (hidden && unit === "r") score += HIDDEN_GUARD;
      // STRATEGIC: winning with nothing hidden → the ship closes the game.
      if (winning && !hidden && unit === "q") score += QUEEN_FINISH;
      // CC guess is 1-away or in clear line from a visible square → ship + warp to check
      const ccOneAwayOrClearLine = (() => {
        const focus = ctx.ccIntel?.focus;
        if (!focus) return false;
        const visible = ctx.vision.litSquares;
        // Check if guessed CC is 1-away from any visible square, or in clear line from any visible square
        for (const vs of visible) {
          if (vs === focus) continue;
          const isOneAway = Math.max(Math.abs(vs.charCodeAt(0) - focus.charCodeAt(0)), Math.abs(Number(vs[1]) - Number(focus[1]))) === 1;
          if (isOneAway) return true;
          if (attacksSquare(map, vs, focus)) return true;
        }
        return false;
      })();
      if (ccOneAwayOrClearLine && unit === "q") score += SHIP_HORIZON_BONUS + 800;
      // Horizon-aligned: boost units that are part of the 5-turn best composition
      // (e.g. p+p+q vs n+b+r when projected 11). First unit of the sequence
      // gets extra to steer immediate deploy toward the long-horizon plan.
      // Gate tank part of horizon on open file — don't push tanks on closed files (keep for horizon, but not for immediate defense)
      if (isUnitInBestSequence(unit, horizonSeq)) {
        score += SHIP_HORIZON_BONUS * 0.5;
        if (horizonSeq?.units[0] === unit) score += SHIP_HORIZON_BONUS * 0.5;
      }
      if (kingThreatened && unit === "r") score += trade * 4;
      if (kingThreatened) score += trade;
      if (isSquareAttackedBy(map, to, enemy)) score -= attackedPenalty;
      // Direct spawn crush on enemy — capture higher material
      const occ = map.get(to);
      if (occ && occ.color === enemy) {
        score += trade * (1 + UNIT_COST[occ.type]);
      }
      if (snap.turn <= 1 && (unit === "n" || unit === "b")) {
        score += (Math.random() - 0.5) * 0.5;
      }

      out.push(
        asCandidate(
          { timing: "B", kind: "spawn", color: us, from: king, to, unit },
          score,
          UNIT_COST[unit],
        ),
      );
    }
  }
  return out;
};

export const economy: StrategicStrategy = { id: "economy", generate: deploys };