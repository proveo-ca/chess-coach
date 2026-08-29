/**
 * Economy (STRATEGIC) — what the Command Center deploys, reacting to the
 * known-vs-seen material model the naive economy cannot see.
 *
 * Mirrors naive `strategies/economy.ts` (same bank/unit-mix/king-proximity
 * policy, reusing `deployPolicy`, `centerScore`, `promoteProgress`), then
 * layers three strategic dials:
 *
 *  - **winning** — we are up in material by the known-vs-seen count. Save
 *    toward a BattleShip (queen) to end the game: rush the `q` drop when the
 *    bank can afford it, and skip light drops (pawn / hoverbike) that would
 *    delay the ship — unless the King is hot or the enemy hides material.
 *  - **cheese / hidden material** — `gap > 0`: the ledger says the enemy holds
 *    material we have never seen (e.g. a hidden promotion runner). When the
 *    enemy has hidden material, defense outranks saving: prefer the guard
 *    drops (rook commands a neighbouring square; pawns shore the shelter) and
 *    cancel the queen-finish saving spree.
 *  - **kingThreatened** — unchanged from naive: survival always outranks
 *    economy (the absolute survival weights still dominate elsewhere).
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-economy.puml
 */

import { isSquareAttackedBy } from "../../../board/placement";
import { hostileMineOn } from "../../../board/mine-contact";
import { UNIT_COST } from "../../../rules/constants";
import type { StrategicCtx } from "../context";
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

/** Cap Hoverbikes — mirrors naive (prefer rook after this many knights). */
export const MAX_KNIGHTS_S = MAX_KNIGHTS;
/** Rook-biased guard when the enemy holds hidden material (cheese window). */
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

  const adjacent = neighbors(king).filter(
    (at) => !map.has(at) && !hostileMineOn(snap.mines, us, at),
  );

  for (const unit of ["p", "n", "b", "r", "q"] as const) {
    if (UNIT_COST[unit] > material.bank) continue;
    if (unit === "n" && knightsFull) continue;
    if (material.congested && unit === "p") continue;
    // Skip light drops when we can afford a rook+ (unless King threatened, or
    // we still need bishops vs a visible enemy queen).
    if (
      preferHeavy &&
      !kingThreatened &&
      UNIT_COST[unit] < UNIT_COST.r &&
      !(wantBishops && unit === "b")
    ) {
      continue;
    }
    // After 2 knights, prefer rook deploys over other mid-tier options.
    if (knightsFull && preferHeavy && unit !== "r" && unit !== "q" && unit !== "b") {
      continue;
    }
    // STRATEGIC: winning + nothing hidden → save light drops toward a ship.
    // Defense (king hot / enemy hidden) always cancels the saving spree.
    if (
      winning &&
      !hidden &&
      !kingThreatened &&
      material.bank < UNIT_COST.q &&
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
      if (needBishop && unit === "b" && !kingThreatened) score += BISHOP_FIRST;
      if (vision.enemyQueenVisible && unit === "b" && !kingThreatened) {
        score += BISHOP_VS_QUEEN;
      }
      if (knightsFull && unit === "r") score += ROOK_AFTER_KNIGHTS;
      // STRATEGIC: cheesy hidden material → rook guard on the King's perimeter.
      if (hidden && unit === "r") score += HIDDEN_GUARD;
      // STRATEGIC: winning with nothing hidden → the ship closes the game.
      if (winning && !hidden && unit === "q") score += QUEEN_FINISH;
      if (kingThreatened && unit === "r") score += trade * 4;
      if (kingThreatened) score += trade;
      if (isSquareAttackedBy(map, to, enemy)) score -= attackedPenalty;

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