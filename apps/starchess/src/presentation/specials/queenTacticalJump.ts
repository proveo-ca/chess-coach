/**
 * Tactical Jump destinations from SCFEN placement (no chess.js FEN gate).
 */
import type { Square } from "chess.js";

import {
  getSideVision,
  placementToMap,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import type { RookMode } from "~/presentation/types";

export const TACTICAL_JUMP_GAS_COST = 2;
export const TACTICAL_JUMP_TRAVEL_MS = 200;
export const TACTICAL_JUMP_APPEAR_MS = 50;
export const TACTICAL_JUMP_TRAIL_MS = 1000;

/**
 * Legal Tactical Jump destinations for the queen on `from`: visible (lit) and
 * free. Occupancy is the only blocker — pieces between origin and target are ignored.
 */
export const tacticalJumpTargets = (
  placement: string,
  from: Square,
  color: StarChessColor,
  opts?: { rookModeFor?: (square: Square) => RookMode },
): Square[] => {
  const map = placementToMap(placement);
  const piece = map.get(from);
  if (!piece || piece.type !== "q" || piece.color !== color) return [];
  const { litSquares } = getSideVision(map, color, opts);
  return [...litSquares]
    .filter((square) => square !== from && !map.has(square))
    .sort();
};
