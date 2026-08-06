/**
 * Charon Booster Missiles — pure rules + presentation aim helpers.
 *
 * Rules (target / placement / gas) live in `@chess-coach/starchess-core`.
 * Aim angle + impact timing stay presentation-side.
 */

import type { Square } from "chess.js";

import { screenAngleDeg } from "~/starchess/animations/attackVectors";
import { vecBetween } from "~/starchess/animations/boardGeom";
import { FRAG_FLIGHT_MS } from "~/starchess/constants";

export {
  CHARON_GAS_COST,
  charonTargetQueen,
  charonTargetQueenFromPlacement,
  placementAfterCharon,
} from "@chess-coach/starchess-core";

/** Charon Booster Missiles impact / resolve window (matches combat kill→death delay). */
export const CHARON_IMPACT_MS = FRAG_FLIGHT_MS;

const CHARON_AIM_DEGS = [-135, -45, 45, 135] as const;

/** Launcher aim for the special move, snapped to the four diagonal quadrants. */
export const charonAimDeg = (from: Square, to: Square): number => {
  const raw = screenAngleDeg(vecBetween(from, to));
  let best: number = CHARON_AIM_DEGS[0];
  for (const deg of CHARON_AIM_DEGS) {
    if (Math.abs(deg - raw) < Math.abs(best - raw)) best = deg;
  }
  return best;
};
