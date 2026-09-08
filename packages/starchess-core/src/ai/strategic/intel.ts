// SPEC: _spec/apps/starchess/core/adjutant/strategic/strategic-architecture.puml
/**
 * Known-vs-seen economy intel — the strategic Adjutant's material model.
 *
 * Classic StarChess gives the enemy a fog of our side and us a fog of theirs.
 * The naive Adjutant plans against what it can *see* this turn. The strategic
 * Adjutant instead tracks two numbers:
 *
 *   - `known`   — what the enemy side *should* have, by income, regardless of
 *                 what we can see. Mirrors the deterministic income ledger
 *                 (`incomeForTurn`) starting from the initial army.
 *   - `scouted` — the enemy material we have actually *seen* (lit/revealed
 *                 squares), accumulated turn over turn.
 *   - `captured`— the enemy material we have removed (captures / deployed-over
 *                 kills), accumulated turn over turn.
 *
 * The gap `known - (scouted - captured)` is the enemy material we cannot
 * account for: hidden units that could be advancing a promotion rush ("cheese")
 * or staging a threat we cannot answer. When the gap is positive the strategic
 * adjutant must react defensively; when the account balances, the strategic
 * adjutant knows the enemy has nothing hidden and can press its material lead.
 *
 * Pure / stateless: the accumulator lives on the host (threaded in the
 * `AdjutantContext`, matching the `storedFor` convention) and snap-only callers
 * fall back to a deterministic one-turn estimate.
 */

import type { Square } from "chess.js";

import { UNIT_COST, incomeForTurn } from "../../rules/constants";
import type { ScPiece } from "../../board/placement";
import type { PieceColor } from "../../model/types";

/** Known-vs-seen accumulator for one side, over the whole game so far. */
export type KnownVsSeen = {
  /**
   * What the side *should* have: initial army value plus the cumulative income
   * ledger through the current turn.
   */
  known: number;
  /** Cumulative enemy material value we have seen (lit / revealed squares). */
  scouted: number;
  /** Cumulative enemy material value we have captured or deployed-over. */
  captured: number;
  /**
   * `known - (scouted - captured)`. >0 ⇒ unaccounted (hidden) enemy material —
   * the cheese window. <0 ⇒ we account for more than the ledger says (captures
   * of revealed material), a sign we are ahead.
   */
  gap: number;
};

/** Accumulator seed for a brand-new snapshot (no history carried). */
export const seedKnownVsSeen = (): { known: number; scouted: number; captured: number } => ({
  known: 3,
  scouted: 0,
  captured: 0,
});

/** Value of one piece under the economy's own scale. */
export const pieceValue = (piece: ScPiece): number => UNIT_COST[piece.type];

/** Cumulative enemy material we should account for by a given turn. */
export const knownForTurn = (turn: number): number => {
  let known = seedKnownVsSeen().known;
  for (let t = 2; t <= turn; t += 1) known += incomeForTurn(t);
  return known;
};

export const gapOf = (k: Omit<KnownVsSeen, "gap">): number =>
  k.known - (k.scouted - k.captured);

/** Build a KnownVsSeen from parts, filling the derived gap. */
export const combineKnownVsSeen = (
  known: number,
  scouted: number,
  captured: number,
): KnownVsSeen => ({
  known,
  scouted,
  captured,
  gap: gapOf({ known, scouted, captured }),
});

/**
 * How much left after accounting for seen+captured — the unaccounted material.
 * Positive when the enemy holds hidden units (the cheese window).
 */
export const hiddenMaterial = (kvs: KnownVsSeen): number => kvs.gap;

/**
 * A one-turn deterministic estimate when no host accumulator is threaded
 * (snap-only callers). Sees only what the current board reveals, then grows
 * scouted by one "unseen" marine's worth when the ledger says more should exist —
 * a conservative stand-in for the host's cross-turn accumulation.
 */
export const estimateKnownVsSeen = (
  revealedEnemyValue: number,
  turn: number,
): KnownVsSeen => {
  const known = knownForTurn(turn);
  const scouted = revealedEnemyValue;
  const captured = 0;
  return combineKnownVsSeen(known, scouted, captured);
};

/** True when the enemy holds hidden material worth at least a marine. */
export const hasHiddenMaterial = (kvs: KnownVsSeen): boolean => kvs.gap >= 1;

/**
 * Cheese-promotion window: the enemy has unaccounted material (a hidden marine
 * advancing to our back rank) during mid-game — the turn range where income
 * accelerates (turn 11+ adds +2/turn) and hidden runners become decisive.
 * This is the primitive later passes refine into per-file blockades.
 */
export const detectCheesePromotion = (
  kvs: KnownVsSeen,
  turn: number,
): boolean => hasHiddenMaterial(kvs) && turn >= 7;

/** Chess-material-balance win flag: what we can count ≫ what the enemy knows. */
export const isWinning = (
  ourCounted: number,
  enemyKnown: number,
): boolean => ourCounted > enemyKnown;

/** Value of a side's units on the current board. */
export const boardValue = (
  pieces: ReadonlyMap<Square, ScPiece>,
  color: PieceColor,
): number => {
  let v = 0;
  for (const piece of pieces.values()) {
    if (piece.color === color) v += UNIT_COST[piece.type];
  }
  return v;
};

export type { ScPiece };