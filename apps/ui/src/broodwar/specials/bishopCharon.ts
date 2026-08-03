import type { Square } from "chess.js";

import { screenAngleDeg } from "~/broodwar/animations/attackVectors";
import {
  mapToPlacement,
  parseSquare,
  placementToMap,
  sq,
  type BwPiece,
} from "~/broodwar/board";
import { vecBetween } from "~/broodwar/animations/boardGeom";
import { FRAG_FLIGHT_MS } from "~/broodwar/constants";

/** Charon Booster Missiles impact / resolve window (matches combat kill→death delay). */
export const CHARON_IMPACT_MS = FRAG_FLIGHT_MS;
export const CHARON_GAS_COST = 2;

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

const DIRS = [
  { df: 1, dr: 1 },
  { df: 1, dr: -1 },
  { df: -1, dr: -1 },
  { df: -1, dr: 1 },
] as const;

/**
 * Single legal Charon target: exactly one enemy queen on the bishop's diagonal
 * rays. Blockers are ignored — Charon Booster Missiles fire through units.
 */
export const charonTargetQueen = (
  map: Map<Square, BwPiece>,
  from: Square,
): Square | null => {
  const attacker = map.get(from);
  if (!attacker || attacker.type !== "b") return null;
  const { file, rank } = parseSquare(from);
  const targets: Square[] = [];

  for (const dir of DIRS) {
    let f = file + dir.df;
    let r = rank + dir.dr;
    for (;;) {
      const at = sq(f, r);
      if (!at) break;
      const piece = map.get(at);
      if (piece?.type === "q" && piece.color !== attacker.color) targets.push(at);
      f += dir.df;
      r += dir.dr;
    }
  }

  return targets.length === 1 ? targets[0]! : null;
};

export const charonTargetQueenFromPlacement = (
  placement: string,
  from: Square,
): Square | null => charonTargetQueen(placementToMap(placement), from);

/** Remove the sniped queen; the Goliath stays on its origin square. */
export const placementAfterCharon = (placement: string, queen: Square): string => {
  const map = placementToMap(placement);
  map.delete(queen);
  return mapToPlacement(map);
};
