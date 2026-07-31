/**
 * Brood War economy helpers — board-derived deploy cost, energy tiers.
 */

import type { Square } from "chess.js";

import { placementToMap, type BwPiece } from "~/broodwar/board";
import { UNIT_COST } from "~/broodwar/constants";
import type { BroodWarColor } from "~/broodwar/types";

/** Sum of `UNIT_COST` for every piece of `color` on the placement. */
export const deployedMaterialFromPlacement = (
  placement: string,
  color: BroodWarColor,
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

export const deployedMaterialFromFen = (fen: string, color: BroodWarColor): number =>
  deployedMaterialFromPlacement(placementFromFen(fen), color);

/** Sum from an already-parsed occupancy map. */
export const deployedMaterialFromMap = (
  map: Map<Square, BwPiece>,
  color: BroodWarColor,
): number => {
  let total = 0;
  for (const piece of map.values()) {
    if (piece.color !== color) continue;
    total += UNIT_COST[piece.type];
  }
  return total;
};
