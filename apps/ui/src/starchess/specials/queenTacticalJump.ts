import type { Chess, Square } from "chess.js";

import type { RookMode } from "~/starchess/types";
import { getSideVision } from "~/starchess/vision";

export const TACTICAL_JUMP_GAS_COST = 2;
export const TACTICAL_JUMP_TRAVEL_MS = 200;
export const TACTICAL_JUMP_APPEAR_MS = 50;
export const TACTICAL_JUMP_TRAIL_MS = 1000;

/**
 * Legal Tactical Jump destinations for the queen on `from`: visible (lit) and
 * free. Occupancy is the only blocker — pieces between origin and target are ignored.
 */
export const tacticalJumpTargets = (
  game: Chess,
  from: Square,
  opts?: { rookModeFor?: (square: Square) => RookMode },
): Square[] => {
  const piece = game.get(from);
  if (!piece || piece.type !== "q") return [];
  const { litSquares } = getSideVision(game, piece.color, opts);
  return [...litSquares]
    .filter((square) => square !== from && !game.get(square))
    .sort();
};
