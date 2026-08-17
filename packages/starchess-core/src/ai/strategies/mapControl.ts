/**
 * Map control — territory, and the Marine advance that converts it.
 *
 * Covers the centre pull, the d4–e5 siege hub, Spider Mine siting, Mecha
 * diagonals, the fogged-King search vector, and promotion (rank progress plus
 * the ≤2-step rush): a Marine walking up the board *is* territory being taken,
 * so it is weighed on the same scale rather than as a separate concern.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/opponent-strategy.puml
 */

import { findKing, isSquareAttackedBy } from "../../board/placement";
import { hostileMineOn } from "../../board/mine-contact";
import { MAX_MINES_PER_SIDE, mineAt, minesFor } from "../../board/mines";
import { pawnSingleTarget } from "../../rules/specials/pawnDouble";
import type { PieceColor } from "../../model/types";
import type { AdjutantCtx, Candidate, MoveEval } from "../context";
import {
  centerScore,
  chebyshev,
  isLastRank,
  isSiegeHub,
  mineSiteWeight,
  promoteProgress,
  rankOf,
  stepsToPromotion,
} from "../context";
import { asCandidate, type Strategy } from "./types";

/**
 * Pawn ≤2 steps from last rank — rush promote (gas+move when needed).
 * Below King/queen survival; above equal trades / hunt checks.
 */
export const NEAR_PROMOTE_RUSH = 6_000;

/**
 * Absolute rush when a pawn starts ≤2 steps from promotion and this move
 * advances (gas+classical two-step or classical finish).
 */
export const nearPromoteRush = (
  fromRank: number,
  toRank: number,
  us: PieceColor,
): number => {
  const fromSteps = stepsToPromotion(fromRank, us);
  if (fromSteps > 2 || fromSteps <= 0) return 0;
  const toSteps = stepsToPromotion(toRank, us);
  if (toSteps >= fromSteps) return 0;
  // Completing promotion from 1 step out.
  if (fromSteps === 1 && toSteps === 0) return NEAR_PROMOTE_RUSH + 400;
  // 2 steps out: prefer gas+move that finishes both ranks this turn.
  if (fromSteps === 2 && toSteps === 0) return NEAR_PROMOTE_RUSH;
  // Single-step advance from 2 out — useful but must not beat the full rush.
  if (fromSteps === 2 && toSteps === 1) return Math.floor(NEAR_PROMOTE_RUSH * 0.35);
  return 0;
};

/**
 * Gas step +1 forward (lone B; the two-step stack is composed in `plans/`).
 * A last-rank landing carries a promotion choice (gas-only promote).
 */
const gasSteps = (ctx: AdjutantCtx): Candidate[] => {
  const { map, snap, us, enemy, weights } = ctx;
  const { center, promoteRank, promotionBonus, attackedPenalty } = weights;
  const out: Candidate[] = [];

  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "p") continue;
    const to = pawnSingleTarget(from, us);
    if (!to || map.has(to)) continue;
    // A gas step walks onto the tile — a hostile mine there kills the marine.
    if (hostileMineOn(snap.mines, us, to)) continue;

    const promotion = isLastRank(rankOf(to), us) ? ("q" as const) : undefined;
    let score =
      center * centerScore(to) + promoteRank * promoteProgress(rankOf(to), us);
    score += nearPromoteRush(rankOf(from), rankOf(to), us);
    if (promotion) score += promotionBonus;
    if (isSquareAttackedBy(map, to, enemy)) score -= attackedPenalty;

    out.push(
      asCandidate(
        {
          timing: "B",
          kind: "pawnDouble",
          color: us,
          from,
          to,
          ...(promotion ? { promotion } : {}),
        },
        score,
      ),
    );
  }
  return out;
};

/** Spider Mines — only on the d4–e5 hub, or a/h files once the hub is mined. */
const minePlants = (ctx: AdjutantCtx): Candidate[] => {
  const { map, snap, us, weights, hubMineTaken } = ctx;
  const out: Candidate[] = [];
  if (minesFor(snap.mines, us).length >= MAX_MINES_PER_SIDE) return out;

  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "n") continue;
    if (mineAt(snap.mines, from)) continue;
    const site = mineSiteWeight(from, hubMineTaken);
    if (site <= 0) continue;
    out.push(
      asCandidate(
        { timing: "B", kind: "knightMine", color: us, from, to: from },
        weights.siegeHub * site + weights.trade,
      ),
    );
  }
  return out;
};

/**
 * Siege toggle (1 gas). Prefer packing on the d4–e5 hub for map control;
 * unpack only under fire. In seek, pack when 9×9 would cover the King focus.
 */
const siegeToggles = (ctx: AdjutantCtx): Candidate[] => {
  const { map, us, enemy, sieged, weights, intel } = ctx;
  const { siegeHub, mapControl, seekFocus, attackedPenalty, trade } = weights;
  const out: Candidate[] = [];

  for (const [from, piece] of map) {
    if (piece.color !== us || piece.type !== "r") continue;
    const packed = sieged.has(from);
    const underFire = isSquareAttackedBy(map, from, enemy);
    if (packed && !underFire) continue;

    let score = packed ? attackedPenalty : trade * 2;
    if (!packed) {
      if (isSiegeHub(from)) score = Math.max(score, siegeHub);
      else score += mapControl * centerScore(from);

      const ek = findKing(map, enemy);
      if (ek) {
        // Tank vision ~5×5 (cheb≤2); siege 9×9 (cheb≤4).
        const cheb = chebyshev(from, ek);
        if (cheb > 2 && cheb <= 4) score = Math.max(score, mapControl * 1.5);
      }
      // Seek: packing reveals a fogged focus inside siege 9×9.
      if (seekFocus > 0 && chebyshev(from, intel.focus) <= 4) {
        score = Math.max(
          score,
          siegeHub + seekFocus * (1 + Math.min(3, intel.strength / 4)),
        );
      }
    }
    out.push(
      asCandidate({ timing: "B", kind: "rookSiege", color: us, from, to: from }, score),
    );
  }
  return out;
};

const generate = (ctx: AdjutantCtx): Candidate[] => [
  ...gasSteps(ctx),
  ...minePlants(ctx),
  ...siegeToggles(ctx),
];

const score = (ev: MoveEval, ctx: AdjutantCtx): number => {
  const { move, piece, isKingMove } = ev;
  const { us, sieged, weights, intel, material, hubMineTaken } = ctx;
  const {
    center,
    mapControl,
    diagonal,
    siegeHub,
    promoteRank,
    promotionBonus,
    seekFocus,
    trade,
  } = weights;

  // The centre pull applies to every mover, King included.
  let s = center * centerScore(move.to);
  if (isKingMove) return s;

  if (piece.type === "p") {
    s += promoteRank * promoteProgress(rankOf(move.to), us);
    if (isLastRank(rankOf(move.to), us)) s += promotionBonus;
    s += nearPromoteRush(rankOf(move.from), rankOf(move.to), us);
    // Congested — quiet pawn advances are less useful than trades / clears.
    if (material.congested && !move.capture) s -= trade * 0.5;
  }

  // Hoverbike — hop onto hub mine sites; once hub is mined, prefer a/h flanks.
  if (piece.type === "n") {
    const site = mineSiteWeight(move.to, hubMineTaken);
    s += site > 0
      ? mapControl * (1 + site)
      : mapControl * centerScore(move.to) * 0.15;
  }

  // Mecha — claim long diagonals that bite the centre.
  if (piece.type === "b") s += diagonal * Math.max(1, centerScore(move.to));

  // Siege Tank — walk into the d4–e5 hub before packing.
  if (piece.type === "r" && !sieged.has(move.from) && isSiegeHub(move.to)) {
    s += siegeHub * 0.75;
  }

  // Seek a fogged King — close on deploy / pawn-clump focus (intel).
  if (seekFocus > 0) {
    const before = chebyshev(move.from, intel.focus);
    const after = chebyshev(move.to, intel.focus);
    if (after < before) {
      const cue = 1 + Math.min(2, intel.strength / 6);
      s += seekFocus * (before - after) * cue;
    }
    // Settling next to the focus (vision contact) is almost as good as finding it.
    if (after <= 1) {
      s += seekFocus * 0.5 * (1 + Math.min(1, intel.strength / 8));
    }
  }

  return s;
};

export const mapControl: Strategy = { id: "mapControl", generate, score };
