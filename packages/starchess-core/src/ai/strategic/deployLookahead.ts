/**
 * Deploy lookahead over a 5-turn horizon — budget-aware sequence scoring.
 *
 * Extends the strategic economy from single-turn affordability (material.bank)
 * to multi-turn budgeting: projects stored minerals after `horizon` turns of
 * income (capped at MAX_STORED_MATERIAL), enumerates deploy sequences whose
 * total UNIT_COST fits the projected budget, and scores them to pick the best
 * composition to work toward.
 *
 * This lets ships/battleships (cost 9) be considered even when the current bank is
 * short, and lets the Command Center compare e.g. `p+p+q` vs `n+b+r` when the
 * projected budget is 11 in 3 turns (marine+marine+ship vs hoverbike+mecha+tank).
 *
 * Deterministic, pure, no I/O.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-economy.puml
 */

import { UNIT_COST, MAX_STORED_MATERIAL, incomeForTurn } from "../../rules/constants";
import type { SpawnPiece } from "../../model/types";
import type { StrategicCtx } from "./context";
import { centerScore, promoteProgress, rankOf, neighbors } from "../context";
import { isSquareAttackedBy } from "../../board/placement";
import { hostileMineOn } from "../../board/mine-contact";

export const HORIZON = 5;
export const SHIP_HORIZON_BONUS = 600;

const UNITS: readonly SpawnPiece[] = ["p", "n", "b", "r", "q"] as const;

/**
 * Maximum deploy budget if the Command Center saves for `horizon` turns.
 * Income tiers respected, capped at MAX_STORED_MATERIAL.
 */
export const projectedBank = (
  bank: number,
  turn: number,
  horizon: number = HORIZON,
): number => {
  let b = bank;
  for (let i = 1; i <= horizon; i += 1) {
    b += incomeForTurn(turn + i);
    if (b > MAX_STORED_MATERIAL) b = MAX_STORED_MATERIAL;
  }
  return b;
};

/**
 * Best placement score for a single unit type on the current board.
 * Mirrors economy.ts per-unit scoring (center, promoteRank, trade, mecha/battleship bonuses, etc.)
 * but without enqueuing — used to score horizon sequences.
 */
const bestScoreForUnit = (unit: SpawnPiece, ctx: StrategicCtx): number => {
  const { map, snap, us, enemy, king, kingThreatened, vision, weights } = ctx;
  const { center, promoteRank, trade, attackedPenalty } = weights;
  const adjacent = neighbors(king).filter(
    (at) => !map.has(at) && !hostileMineOn(snap.mines, us, at),
  );
  if (adjacent.length === 0) return Number.NEGATIVE_INFINITY;
  let best = Number.NEGATIVE_INFINITY;
  for (const to of adjacent) {
    if (unit === "p" && (rankOf(to) === 1 || rankOf(to) === 8)) continue;
    let score =
      center * centerScore(to) +
      promoteRank * promoteProgress(rankOf(to), us) +
      trade * (1 + UNIT_COST[unit]);
    // Mirror economy bonuses (battleship finish, mecha vs battleship, etc.) lightly here
    // so horizon sequences reflect the same strategic dials.
    if (vision.enemyQueenVisible && unit === "b" && !kingThreatened) score += 400;
    if (isSquareAttackedBy(map, to, enemy)) score -= attackedPenalty;
    if (score > best) best = score;
  }
  return best;
};

export type DeploySequence = {
  units: SpawnPiece[];
  totalCost: number;
  totalScore: number;
  horizonNeeded: number; // turns to afford (discount anchor)
};

/**
 * Enumerate deploy sequences of 1..maxLen units whose total cost fits the
 * projected budget over `horizon` turns. Score each as sum of best-placement
 * unit scores discounted by 0.95^position (prefer front-loaded value).
 * Returns the highest-scoring sequence, or null if none affordable.
 */
export const bestDeploySequence = (
  ctx: StrategicCtx,
  horizon: number = HORIZON,
  maxLen = 3,
): DeploySequence | null => {
  const { material, snap } = ctx;
  const budget = projectedBank(material.bank, snap.turn, horizon);
  let best: DeploySequence | null = null;

  const consider = (units: SpawnPiece[]): void => {
    const totalCost = units.reduce((sum, u) => sum + UNIT_COST[u], 0);
    if (totalCost > budget) return;
    // Horizon needed: smallest h where projectedBank >= totalCost
    let horizonNeeded = 0;
    for (let h = 0; h <= horizon; h += 1) {
      if (projectedBank(material.bank, snap.turn, h) >= totalCost) {
        horizonNeeded = h;
        break;
      }
    }
    let totalScore = 0;
    for (let i = 0; i < units.length; i += 1) {
      const unit = units[i]!;
      const s = bestScoreForUnit(unit, ctx);
      if (!Number.isFinite(s)) return;
      totalScore += s * Math.pow(0.95, horizonNeeded + i * 0.3);
    }
    // Winning clean + ships: add horizon bonus if sequence contains q
    if (ctx.winning && ctx.kvs.gap <= 0 && !ctx.cheesePromotion && units.includes("q")) {
      totalScore += SHIP_HORIZON_BONUS;
    }
    if (!best || totalScore > best.totalScore) {
      best = { units: [...units], totalCost, totalScore, horizonNeeded };
    }
  };

  // Size 1
  for (const u of UNITS) consider([u]);
  // Size 2
  if (maxLen >= 2) {
    for (const a of UNITS) for (const b of UNITS) consider([a, b]);
  }
  // Size 3 — classic marine+marine+ship vs hoverbike+mecha+tank etc.
  if (maxLen >= 3) {
    for (const a of UNITS) for (const b of UNITS) for (const c of UNITS) consider([a, b, c]);
  }

  return best;
};

/**
 * Whether a unit is part of the horizon-best sequence. Used by economy to
 * boost immediate candidates that align with the 5-turn plan.
 */
export const isUnitInBestSequence = (
  unit: SpawnPiece,
  seq: DeploySequence | null,
): boolean => !!seq && seq.units.includes(unit);
