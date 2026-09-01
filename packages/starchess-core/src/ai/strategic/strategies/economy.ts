// SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-economy.puml, _spec/apps/starchess/core/adjutant/strategic/promotion-defense.puml
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
 *  - **runners** — the *seen* half of the same worry (`../runners.ts`). Our
 *    deploy ring is our own last ranks, which is precisely where an enemy
 *    marine promotes, so a drop is often the only answer that arrives in time:
 *    onto a runner we can see it crushes it, in front of one it blocks it. An
 *    *urgent* runner — `isUrgentRunner`: unobstructed, within two turns, and
 *    believed (confidence ≥ 0.5) — counts as `defending` (no saving spree,
 *    `RUNNER_GUARD` tank on) and, when its path crosses the ring, buys back the
 *    light drops the heavy-unit preference would have skipped.
 *  - **kingThreatened** — unchanged from naive: survival always outranks
 *    economy (the absolute survival weights still dominate elsewhere).
 */

import { attacksSquare, isSquareAttackedBy } from "../../../board/placement";
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
import { centerScore, chebyshev, neighbors, promoteProgress, rankOf } from "../../context";
import {
  MAX_KNIGHTS,
  ROOK_AFTER_KNIGHTS,
  BISHOP_FIRST,
  BISHOP_VS_QUEEN,
  deployPolicy,
} from "../../strategies/economy";
import { isUrgentRunner } from "../runners";
import { avengeDeployValue } from "./attackers";
import { runnerDeployValue } from "./runners";
import type { StrategicStrategy, } from "./types";
import { asCandidate } from "./types";

/** Cap Hoverbikes — mirrors naive (prefer tank after this many hoverbikes). */
export const MAX_KNIGHTS_S = MAX_KNIGHTS;
/** Tank-biased guard when the enemy holds hidden material (cheese window). */
export const HIDDEN_GUARD = 1_450;
/**
 * The same shape of guard for a runner we can actually account for. A separate
 * constant on purpose: the two fire on different evidence, and a retune of the
 * cheese window must not silently retune the promotion defense.
 */
export const RUNNER_GUARD = 1_450;
/** Extra on a BattleShip deploy when the CC guess is already within warp reach. */
export const SHIP_WARP_READY = 800;
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

  const adjacent = neighbors(king).filter(
    (at) => !hostileMineOn(snap.mines, us, at),
  );

  // A visible runner within two turns of promoting is a defensive emergency on
  // the same footing as hidden material: it cancels the ship-saving spree and
  // earns the guard tank. When its path crosses the deploy ring — which is our
  // own last ranks, exactly where it is heading — a cheap body is a real answer,
  // so the heavy-unit preference gives way the way it does for a hot CC.
  const urgentRunners = ctx.runners.filter(isUrgentRunner);
  const runnerOnDeployRing = urgentRunners.some(
    (r) => adjacent.includes(r.at) || r.path.some((s) => adjacent.includes(s)),
  );
  const defending = hidden || urgentRunners.length > 0;

  for (const unit of ["p", "n", "b", "r", "q"] as const) {
    if (UNIT_COST[unit] > material.bank) continue;
    if (unit === "n" && knightsFull) continue;
    if (material.congested && unit === "p") continue;
    // Skip light drops when we can afford a tank+ (unless Command Center (CC) threatened, or
    // we still need mechas vs a visible enemy battleship).
    if (
      preferHeavy &&
      !kingThreatened &&
      !runnerOnDeployRing &&
      UNIT_COST[unit] < UNIT_COST.r &&
      !(wantBishops && unit === "b")
    ) {
      continue;
    }
    // After 2 hoverbikes, prefer tank deploys over other mid-tier options.
    if (knightsFull && preferHeavy && unit !== "r" && unit !== "q" && unit !== "b") {
      continue;
    }
    // STRATEGIC: winning + nothing to defend → save light drops toward a ship.
    // Defense (command center (CC) hot / enemy hidden / a runner on the board)
    // always cancels the saving spree.
    // Horizon-aware: only save when the ship is reachable within 5 turns.
    if (
      winning &&
      !defending &&
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
      // STRATEGIC: cheesy hidden material, or a runner we can account for →
      // tank guard on the Command Center (CC)'s perimeter
      if (unit === "r") {
        if (hidden) score += HIDDEN_GUARD;
        else if (urgentRunners.length > 0) score += RUNNER_GUARD;
      }
      // STRATEGIC: winning with nothing to defend → the ship closes the game.
      if (winning && !defending && unit === "q") score += QUEEN_FINISH;
      // CC guess is 1-away or in clear line from a visible square → ship + warp to check
      const ccOneAwayOrClearLine = (() => {
        const focus = ctx.ccIntel?.focus;
        if (!focus) return false;
        for (const vs of ctx.vision.litSquares) {
          if (vs === focus) continue;
          if (chebyshev(vs, focus) === 1) return true;
          if (attacksSquare(map, vs, focus)) return true;
        }
        return false;
      })();
      if (ccOneAwayOrClearLine && unit === "q") score += SHIP_HORIZON_BONUS + SHIP_WARP_READY;
      if (isUnitInBestSequence(unit, horizonSeq)) {
        score += SHIP_HORIZON_BONUS * 0.5;
        if (horizonSeq?.units[0] === unit) score += SHIP_HORIZON_BONUS * 0.5;
      }
      // STRATEGIC: a visible runner promotes on *our* back rank, which is the
      // deploy ring — so a drop is often the only answer that arrives in time,
      // and one onto the runner's own square crushes it.
      score += runnerDeployValue(ctx.runners, to);
      // STRATEGIC: "however possible" includes dropping a unit on top of the
      // shooter — a Command Center that was fired on can answer with its own
      // ring, and the crush needs no line of attack.
      score += avengeDeployValue(ctx, to, UNIT_COST[unit]);
      if (kingThreatened && unit === "r") score += trade * 4;
      if (kingThreatened) score += trade;
      if (isSquareAttackedBy(map, to, enemy)) score -= attackedPenalty;
      // Direct spawn crush on enemy — capture higher material
      const occ = map.get(to);
      if (occ && occ.color === enemy) {
        score += trade * (1 + UNIT_COST[occ.type]);
      }
      if (snap.turn <= 1 && (unit === "n" || unit === "b")) {
        score += (ctx.rng() - 0.5) * 0.5;
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