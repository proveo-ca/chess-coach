/**
 * Pure ChessBoard combat hide-set — shared by the board and unit tests so
 * Coach / Analysis / Review stay unaffected when no Brood War cues are passed.
 */

import type { Square } from "chess.js";

import type { KingDamageCue } from "~/broodwar/animations/kingDamageOverlay";
import type { AttackCue, DeathCue, MoveCue, QueenJumpTrail } from "~/broodwar/animations/types";

/** Stable empty set — classical boards reuse this (no per-render allocation). */
export const EMPTY_FX_HIDDEN: ReadonlySet<Square> = new Set();

export type CombatFxInput = {
  attacks?: readonly AttackCue[];
  deaths?: readonly DeathCue[];
  moves?: readonly MoveCue[];
  kingDamage?: readonly KingDamageCue[];
  /** Tactical Jump trails keep the FX layer alive only — never hide board pieces. */
  jumpTrails?: readonly QueenJumpTrail[];
  /** Transient flee origins while a damaged king slides. */
  fleeCover?: ReadonlySet<Square>;
};

/** True when any Brood War combat overlay owns a square. */
export const hasCombatFxInput = (fx: CombatFxInput): boolean =>
  (fx.attacks?.length ?? 0) > 0 ||
  (fx.deaths?.length ?? 0) > 0 ||
  (fx.moves?.length ?? 0) > 0 ||
  (fx.kingDamage?.length ?? 0) > 0 ||
  (fx.jumpTrails?.length ?? 0) > 0 ||
  (fx.fleeCover?.size ?? 0) > 0;

/**
 * Squares whose board `<img>` must hide while an overlay owns the piece.
 * Returns the shared empty set when nothing is active (classical default).
 */
export const buildFxHiddenSquares = (fx: CombatFxInput): ReadonlySet<Square> => {
  if (!hasCombatFxInput(fx)) return EMPTY_FX_HIDDEN;

  const hide = new Set<Square>();
  for (const c of fx.attacks ?? []) hide.add(c.from);
  for (const c of fx.deaths ?? []) hide.add(c.at);
  for (const c of fx.moves ?? []) {
    hide.add(c.from);
    // Destination too — FEN may already show the piece on `to` (interactive moves).
    hide.add(c.to);
  }
  for (const c of fx.kingDamage ?? []) {
    hide.add(c.at);
    for (const sq of c.cover ?? []) hide.add(sq);
  }
  if (fx.fleeCover) for (const sq of fx.fleeCover) hide.add(sq);
  return hide;
};
