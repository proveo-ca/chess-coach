// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
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
 */

import type { Square } from "chess.js";

import {
  attacksSquare,
  isSquareAttackedBy,
  parseSquare,
  type ScPiece,
} from "../../board/placement";
import { hostileMineOn } from "../../board/mine-contact";
import type { StarChessColor } from "../../model/types";
import { UNIT_COST } from "../../rules/constants";
import type { AdjutantCtx, Candidate } from "../context";
import { centerScore, neighbors, promoteProgress, rankOf } from "../context";
import { asCandidate, type Strategy } from "./types";

/** Cap Hoverbikes — after this many knights, prefer rook deploys. */
export const MAX_KNIGHTS = 2;
/**
 * Mecha (bishop) deploy caps — same-colored bishops see the same diagonals,
 * so the 3rd on a color is redundant, and a 5th bishop anywhere never earns
 * its bank + gas. Gates, not scores: the ladder is untouched.
 */
export const MAX_BISHOPS_TOTAL = 4;
export const MAX_BISHOPS_PER_COLOR = 2;

export type SquareColor = "dark" | "light";

/** a1 is dark: file (a=0) + rank parity decides. */
export const squareColor = (sq: Square): SquareColor => {
  const { file, rank } = parseSquare(sq);
  return (file + rank) % 2 === 1 ? "dark" : "light";
};

/** Own bishops split by square color, plus the total. */
export const countBishopsByColor = (
  map: Map<Square, ScPiece>,
  us: StarChessColor,
): { dark: number; light: number; total: number } => {
  const out = { dark: 0, light: 0, total: 0 };
  for (const [sq, p] of map) {
    if (p.color !== us || p.type !== "b") continue;
    out.total += 1;
    out[squareColor(sq)] += 1;
  }
  return out;
};

/**
 * True iff a post-deploy bishop on `to` takes a *visible* enemy queen or rook
 * this turn — either by crushing one standing on `to` itself, or classically
 * from the landing square (via a spawn+capture stack). Queen/rook only: takes
 * at these values repay bank + gas, while knight/bishop/pawn takes do not.
 * Charon is not such an answer — `assertSpecialLegal` demands the
 * sniper exist pre-turn, and a fresh deploy spent its unit's special — so
 * only crush + classical captures count.
 */
export const deployCapturesBigThreat = (
  map: Map<Square, ScPiece>,
  us: StarChessColor,
  to: Square,
  isVisible: (sq: Square) => boolean,
): boolean => {
  const occ = map.get(to);
  // Direct crush of a visible queen/rook on the landing square.
  if (occ && occ.color !== us && (occ.type === "q" || occ.type === "r")) {
    return isVisible(to);
  }
  const after = new Map(map);
  after.delete(to);
  after.set(to, { type: "b", color: us });
  for (const [sq, p] of after) {
    if (p.color === us || (p.type !== "q" && p.type !== "r")) continue;
    if (!isVisible(sq)) continue;
    if (attacksSquare(after, to, sq)) return true;
  }
  return false;
};

/**
 * True iff this bishop deploy must be suppressed. Projects counts first: a
 * crush-replaced own bishop is net-zero, never a 3rd. The total cap is
 * absolute; the per-color cap admits only the big-threat capture.
 */
export const isBishopDeployCapped = (
  map: Map<Square, ScPiece>,
  us: StarChessColor,
  to: Square,
  isVisible: (sq: Square) => boolean,
): boolean => {
  const c = countBishopsByColor(map, us);
  const occ = map.get(to);
  if (occ?.color === us && occ.type === "b") {
    c.total -= 1;
    c[squareColor(to)] -= 1;
  }
  if (c.total >= MAX_BISHOPS_TOTAL) return true;
  if (c[squareColor(to)] >= MAX_BISHOPS_PER_COLOR) {
    return !deployCapturesBigThreat(map, us, to, isVisible);
  }
  return false;
};
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
      // Mecha pile-up gate (naive rings are empty-only; the helper reads
      // occupancy itself, so crush-replace nets out with no caller math).
      if (unit === "b" && isBishopDeployCapped(map, us, to, () => true)) {
        continue;
      }
      let score =
        center * centerScore(to) +
        promoteRank * promoteProgress(rankOf(to), us) +
        // Heavier piece → higher score (q=9, r=5 ≫ p=1).
        trade * (1 + UNIT_COST[unit]);
      // Survival first — do not force bishop-before-rook while the King is hot.
      // Turn 1 leaves Hoverbike and Mecha level so the open stays probabilistic.
      if (needBishop && unit === "b" && !kingThreatened && snap.turn > 1) {
        score += BISHOP_FIRST;
      }
      if (vision.enemyQueenVisible && unit === "b" && !kingThreatened) {
        score += BISHOP_VS_QUEEN;
      }
      if (knightsFull && unit === "r") score += ROOK_AFTER_KNIGHTS;
      // Back-rank cheese: prefer rook deploys that can take the threat next.
      if (kingThreatened && unit === "r") score += trade * 4;
      if (kingThreatened) score += trade;
      if (isSquareAttackedBy(map, to, enemy)) score -= attackedPenalty;
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

export const economy: Strategy = { id: "economy", generate: deploys };
