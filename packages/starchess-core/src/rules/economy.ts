/**
 * StarChess economy helpers — board-derived deploy cost, energy tiers,
 * stored-material income (the Command Center mineral bank).
 *
 * `applyStoredIncome` / `OPENING_STORED_MATERIAL` are the single owner for the
 * host mineral bank (shared by BRIDGE apps/starchess and the script arena).
 *
 * // SPEC: _spec/packages/starchess-arena/arena.puml
 */

import type { Square } from "../model/square";
import type { ScAction, ScFenSnapshot, StarChessColor } from "../model/types";
import { placementToMap, type ScPiece } from "../board/placement";
import { MAX_STORED_MATERIAL, UNIT_COST, incomeForTurn } from "./constants";
import { specialGasCost } from "./specials/registry";

/** Single-player / review opening Command Center bank (both sides). */
export const OPENING_STORED_MATERIAL = 3;

/**
 * Mineral income on turn advance — the stored bank's sole income owner.
 * Applies the turn tier (`incomeForTurn`) and caps at `MAX_STORED_MATERIAL`.
 * Turn 0 (demo seeds) uses the turn-1 tier.
 */
export const applyStoredIncome = (
  bank: Record<StarChessColor, number>,
  turn: number,
): Record<StarChessColor, number> => {
  const amount = incomeForTurn(Math.max(1, turn));
  if (amount <= 0) return bank;
  return {
    w: Math.min(MAX_STORED_MATERIAL, bank.w + amount),
    b: Math.min(MAX_STORED_MATERIAL, bank.b + amount),
  };
};

/**
 * Stored bank for a snapshot without SCFEN `B:`: the opening bank plus every
 * turn's income up to `snap.turn`. Prefer a replayed history when one exists.
 */
export const estimateStoredFromSnap = (snap: Pick<ScFenSnapshot, "turn">): number => {
  let stored = OPENING_STORED_MATERIAL;
  for (let t = 1; t <= Math.max(0, snap.turn); t += 1) {
    stored = applyStoredIncome({ w: stored, b: stored }, t).w;
  }
  return Math.max(0, stored);
};

/**
 * `color`'s gas after the snapshot's queue, minus specials in `overlayActions`
 * that are not on the snapshot yet (review intent ghosts). Classical moves cost
 * no gas.
 */
export const gasRemainingFor = (
  snap: Pick<ScFenSnapshot, "gas" | "queue">,
  color: StarChessColor,
  overlayActions?: readonly ScAction[] | null,
): number => {
  let rem = Math.max(0, snap.gas[color] ?? 0);
  if (!overlayActions?.length) return rem;
  const onSnap = new Set((snap.queue?.actions ?? []).map((a) => a.seq));
  for (const a of overlayActions) {
    if (a.color !== color || a.timing === "C") continue;
    if (onSnap.has(a.seq)) continue;
    rem -= specialGasCost(a.kind);
  }
  return Math.max(0, rem);
};

/** Sum of `UNIT_COST` for every piece of `color` on the placement. */
export const deployedMaterialFromPlacement = (
  placement: string,
  color: StarChessColor,
): number => {
  let total = 0;
  for (const piece of placementToMap(placement).values()) {
    if (piece.color !== color) continue;
    total += UNIT_COST[piece.type];
  }
  return total;
};

/** Placement field from a classic FEN (or bare placement string). */
export const placementFromFen = (fen: string): string => {
  const placement = fen.trim().split(/\s+/)[0];
  if (!placement) throw new Error(`Bad FEN / placement: ${fen.slice(0, 48)}`);
  return placement;
};

export const deployedMaterialFromFen = (fen: string, color: StarChessColor): number =>
  deployedMaterialFromPlacement(placementFromFen(fen), color);

/** Sum from an already-parsed occupancy map. */
export const deployedMaterialFromMap = (
  map: Map<Square, ScPiece>,
  color: StarChessColor,
): number => {
  let total = 0;
  for (const piece of map.values()) {
    if (piece.color !== color) continue;
    total += UNIT_COST[piece.type];
  }
  return total;
};
