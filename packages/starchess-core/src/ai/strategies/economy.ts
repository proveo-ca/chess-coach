/**
 * Economy — what the Command Center deploys, and in what order.
 *
 * The bank alone does not decide the drop; the unit *mix* does:
 *  - always get a first Mecha out (diagonals / Charon),
 *  - stack more Mecha while an enemy BattleShip is lit,
 *  - stop dropping Marines once our pawns are congested,
 *  - cap Hoverbikes at {@link MAX_KNIGHTS} and prefer Siege Tanks after,
 *  - skip light drops entirely once the bank can pay for a Tank or better,
 *    unless the King is hot (survival buys time) or we still owe a Mecha.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
 */

import { isSquareAttackedBy } from "../../board/placement";
import { hostileMineOn } from "../../board/mine-contact";
import { UNIT_COST } from "../../rules/constants";
import type { AdjutantCtx, Candidate } from "../context";
import { centerScore, neighbors, promoteProgress, rankOf } from "../context";
import { asCandidate, type Strategy } from "./types";

/** Cap Hoverbikes — after this many knights, prefer rook deploys. */
export const MAX_KNIGHTS = 2;
/** Bonus to spawn rook once we already have {@link MAX_KNIGHTS} knights. */
export const ROOK_AFTER_KNIGHTS = 900;
/** Ensure ≥1 bishop before stacking rooks/queens (Charon / diagonals). */
export const BISHOP_FIRST = 2_200;
/** Visible enemy queen — mass bishops for Charon angles (never resign). */
export const BISHOP_VS_QUEEN = 3_500;

/** The deploy policy derived from the raw supply read. */
export type DeployPolicy = {
  preferHeavy: boolean;
  needBishop: boolean;
  wantBishops: boolean;
  knightsFull: boolean;
};

export const deployPolicy = (ctx: AdjutantCtx): DeployPolicy => {
  const { material, vision } = ctx;
  const needBishop = material.ownBishops === 0;
  return {
    preferHeavy: material.bank >= UNIT_COST.r,
    needBishop,
    wantBishops: needBishop || vision.enemyQueenVisible,
    knightsFull: material.ownKnights >= MAX_KNIGHTS,
  };
};

/**
 * Command Center deploys, adjacent to the King, within the bank.
 *
 * Mined tiles are legal drops, but a deploy is no attack — a hostile mine takes
 * the fresh unit on arrival. Pawns must never resolve onto an edge row (rank 1
 * or 8 breaks chess.js), so those squares are excluded for Marine drops.
 */
const deploys = (ctx: AdjutantCtx): Candidate[] => {
  const { map, snap, us, enemy, king, kingThreatened, material, vision, weights } =
    ctx;
  const { center, promoteRank, trade, attackedPenalty } = weights;
  const { preferHeavy, needBishop, wantBishops, knightsFull } = deployPolicy(ctx);
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

    for (const to of adjacent) {
      if (unit === "p" && (rankOf(to) === 1 || rankOf(to) === 8)) continue;
      let score =
        center * centerScore(to) +
        promoteRank * promoteProgress(rankOf(to), us) +
        // Heavier piece → higher score (q=9, r=5 ≫ p=1).
        trade * (1 + UNIT_COST[unit]);
      // Survival first — do not force bishop-before-rook while the King is hot.
      if (needBishop && unit === "b" && !kingThreatened) score += BISHOP_FIRST;
      if (vision.enemyQueenVisible && unit === "b" && !kingThreatened) {
        score += BISHOP_VS_QUEEN;
      }
      if (knightsFull && unit === "r") score += ROOK_AFTER_KNIGHTS;
      // Back-rank cheese: prefer rook deploys that can take the threat next.
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

export const economy: Strategy = { id: "economy", generate: deploys };
