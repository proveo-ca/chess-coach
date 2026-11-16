// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
/**
 * Economy — what the Command Center deploys, and in what order.
 *
 * The bank alone does not decide the drop; the unit *mix* does:
 *  - always get a first Mecha out (diagonals / Charon),
 *  - stack more Mecha while an enemy BattleShip is lit,
 *  - stop dropping Marines once our Marines are congested,
 *  - cap Hoverbikes at {@link MAX_HOVERBIKES} and prefer Siege Tanks after,
 *  - skip light drops entirely once the bank can pay for a Tank or better,
 *    unless the Command Center is hot (survival buys time) or we still owe a Mecha.
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

/** Cap Hoverbikes — after this many Hoverbikes, prefer Tank deploys. */
export const MAX_HOVERBIKES = 2;
/**
 * Mecha deploy caps — same-colored Mechas see the same diagonals,
 * so the 3rd on a color is redundant, and a 5th Mecha anywhere never earns
 * its bank + gas. Gates, not scores: the ladder is untouched.
 */
export const MAX_MECHAS_TOTAL = 4;
export const MAX_MECHAS_PER_COLOR = 2;

export type SquareColor = "dark" | "light";

/** a1 is dark: file (a=0) + rank parity decides. */
export const squareColor = (sq: Square): SquareColor => {
  const { file, rank } = parseSquare(sq);
  return (file + rank) % 2 === 1 ? "dark" : "light";
};

/** Own Mechas split by square color, plus the total. */
export const countMechasByColor = (
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
 * True iff a post-deploy Mecha on `to` takes a *visible* enemy BattleShip or Tank
 * this turn — either by crushing one standing on `to` itself, or classically
 * from the landing square (via a spawn+capture stack). BattleShip/Tank only: takes
 * at these values repay bank + gas, while Hoverbike/Mecha/Marine takes do not.
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
  // Direct crush of a visible BattleShip/Tank on the landing square.
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
 * True iff this Mecha deploy must be suppressed. Projects counts first.
 * (The crush-replace netting below is defense in depth: naive rings are
 * empty-only and strategic generation skips same-type ally crushes, so no
 * caller currently reaches it with an own Mecha on `to`.)
 * The total cap is absolute; the per-color cap admits only the big-threat
 * capture.
 */
export const isMechaDeployCapped = (
  map: Map<Square, ScPiece>,
  us: StarChessColor,
  to: Square,
  isVisible: (sq: Square) => boolean,
): boolean => {
  const c = countMechasByColor(map, us);
  const occ = map.get(to);
  if (occ?.color === us && occ.type === "b") {
    c.total -= 1;
    c[squareColor(to)] -= 1;
  }
  if (c.total >= MAX_MECHAS_TOTAL) return true;
  if (c[squareColor(to)] >= MAX_MECHAS_PER_COLOR) {
    return !deployCapturesBigThreat(map, us, to, isVisible);
  }
  return false;
};
/** Bonus to spawn Tank once we already have {@link MAX_HOVERBIKES} Hoverbikes. */
export const TANK_AFTER_HOVERBIKES = 900;
/** Ensure ≥1 Mecha before stacking Tanks/BattleShips (Charon / diagonals). */
export const MECHA_FIRST = 2_200;
/** Visible enemy BattleShip — mass Mechas for Charon angles (never resign). */
export const MECHA_VS_BATTLESHIP = 3_500;

/** The deploy policy derived from the raw supply read. */
export type DeployPolicy = {
  preferHeavy: boolean;
  needMecha: boolean;
  wantMechas: boolean;
  hoverbikesFull: boolean;
};

export const deployPolicy = (ctx: AdjutantCtx): DeployPolicy => {
  const { material, vision } = ctx;
  const needMecha = material.ownMechas === 0;
  return {
    preferHeavy: material.bank >= UNIT_COST.r,
    needMecha,
    wantMechas: needMecha || vision.enemyBattleShipVisible,
    hoverbikesFull: material.ownHoverbikes >= MAX_HOVERBIKES,
  };
};

/**
 * Command Center deploys, adjacent to the Command Center, within the bank.
 *
 * Mined tiles are legal drops, but a deploy is no attack — a hostile mine takes
 * the fresh unit on arrival. Marines must never resolve onto an edge row (rank 1
 * or 8 breaks chess.js), so those squares are excluded for Marine drops.
 */
const deploys = (ctx: AdjutantCtx): Candidate[] => {
  const { map, snap, us, enemy, commandCenter, ccThreatened, material, vision, weights } =
    ctx;
  const { center, promoteRank, trade, attackedPenalty } = weights;
  const { preferHeavy, needMecha, wantMechas, hoverbikesFull } = deployPolicy(ctx);
  const out: Candidate[] = [];

  const adjacent = neighbors(commandCenter).filter(
    (at) => !map.has(at) && !hostileMineOn(snap.mines, us, at),
  );

  for (const unit of ["p", "n", "b", "r", "q"] as const) {
    if (UNIT_COST[unit] > material.bank) continue;
    if (unit === "n" && hoverbikesFull) continue;
    if (material.congested && unit === "p") continue;
    // Skip light drops when we can afford a Tank+ (unless Command Center threatened, or
    // we still need Mechas vs a visible enemy BattleShip).
    if (
      preferHeavy &&
      !ccThreatened &&
      UNIT_COST[unit] < UNIT_COST.r &&
      !(wantMechas && unit === "b")
    ) {
      continue;
    }
    // After 2 Hoverbikes, prefer Tank deploys over other mid-tier options.
    if (hoverbikesFull && preferHeavy && unit !== "r" && unit !== "q" && unit !== "b") {
      continue;
    }

    for (const to of adjacent) {
      if (unit === "p" && (rankOf(to) === 1 || rankOf(to) === 8)) continue;
      // Mecha pile-up gate (naive rings are empty-only, so `to` is vacant here;
      // the helper's crush-netting branch is unreachable defense in depth).
      if (unit === "b" && isMechaDeployCapped(map, us, to, () => true)) {
        continue;
      }
      let score =
        center * centerScore(to) +
        promoteRank * promoteProgress(rankOf(to), us) +
        // Heavier piece → higher score (q=9, r=5 ≫ p=1).
        trade * (1 + UNIT_COST[unit]);
      // Survival first — do not force mecha-before-tank while the Command Center is hot.
      // Turn 1 leaves Hoverbike and Mecha level so the open stays probabilistic.
      if (needMecha && unit === "b" && !ccThreatened && snap.turn > 1) {
        score += MECHA_FIRST;
      }
      if (vision.enemyBattleShipVisible && unit === "b" && !ccThreatened) {
        score += MECHA_VS_BATTLESHIP;
      }
      if (hoverbikesFull && unit === "r") score += TANK_AFTER_HOVERBIKES;
      // Back-rank cheese: prefer Tank deploys that can take the threat next.
      if (ccThreatened && unit === "r") score += trade * 4;
      if (ccThreatened) score += trade;
      if (isSquareAttackedBy(map, to, enemy)) score -= attackedPenalty;
      if (snap.turn <= 1 && (unit === "n" || unit === "b")) {
        score += (ctx.rng() - 0.5) * 0.5;
      }

      out.push(
        asCandidate(
          { timing: "B", kind: "deploy", color: us, from: commandCenter, to, unit },
          score,
          UNIT_COST[unit],
        ),
      );
    }
  }
  return out;
};

export const economy: Strategy = { id: "economy", generate: deploys };
