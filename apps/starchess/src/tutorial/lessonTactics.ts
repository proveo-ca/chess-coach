// SPEC: _spec/apps/starchess/menu-flow.puml
import {
  attacksSquare,
  placementToMap,
  type ScPiece,
  type StarChessColor,
} from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import type { SquareCoverer, SquareCovers } from "~/types/tutorial";

export const SHIP_WATCH_SQUARES: readonly Square[] = ["e1", "f1", "g1"];

export const attackersOfSquare = (
  map: Map<Square, ScPiece>,
  square: Square,
  color: StarChessColor,
): SquareCoverer[] => {
  const out: SquareCoverer[] = [];
  for (const [from, piece] of map) {
    if (piece.color !== color) continue;
    if (attacksSquare(map, from, square)) out.push({ from, kind: piece.type });
  }
  return out;
};

export const coveredEnemyShips = (
  scfen: string | undefined,
  viewer: StarChessColor,
  squares: readonly Square[] = SHIP_WATCH_SQUARES,
): SquareCovers => {
  if (!scfen) return {};
  const placement = scfen.split("|")[1];
  if (!placement) return {};
  let map: Map<Square, ScPiece>;
  try {
    map = placementToMap(placement);
  } catch {
    return {};
  }
  const out: SquareCovers = {};
  for (const square of squares) {
    const occupant = map.get(square);
    if (!occupant || occupant.type !== "q" || occupant.color === viewer) continue;
    out[square] = attackersOfSquare(map, square, viewer);
  }
  return out;
};
