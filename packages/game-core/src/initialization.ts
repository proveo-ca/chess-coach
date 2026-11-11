// SPEC: _spec/initialization.puml
import { placementToMap } from "./board";
import { CC_MAX_LIVES, UNIT_COST, energyForTurn } from "./constants";
import { OPENING_STORED_MATERIAL } from "./economy";
import type { ScFenSnapshot, Square, StarChessColor, StarChessPiece } from "./types";

export const CANONICAL_OPENING_PLACEMENT = "4k3/2pppp2/8/8/8/8/2PPPP2/4K3";

export type OpeningUnit = {
  id: `${StarChessColor}:unit:opening:${Square}`;
  color: StarChessColor;
  square: Square;
  type: StarChessPiece;
  paidBasis: 0;
  replacementValue: number;
};

export type InitializedGame = { snapshot: ScFenSnapshot; openingUnits: OpeningUnit[] };

export function createCanonicalGame(): InitializedGame {
  const gas = energyForTurn(0);
  const snapshot: ScFenSnapshot = {
    placement: CANONICAL_OPENING_PLACEMENT,
    turn: 0,
    ccLives: { w: CC_MAX_LIVES, b: CC_MAX_LIVES },
    phase: "P",
    gas: { w: gas, b: gas },
    gasIncome: { w: gas, b: gas },
    stored: { w: OPENING_STORED_MATERIAL, b: OPENING_STORED_MATERIAL },
    queue: { actions: [] },
  };
  const openingUnits: OpeningUnit[] = [...placementToMap(snapshot.placement)]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([square, piece]) => ({
      id: `${piece.color}:unit:opening:${square}`,
      color: piece.color,
      square,
      type: piece.type,
      paidBasis: 0,
      replacementValue: piece.type === "k" ? 0 : UNIT_COST[piece.type],
    }));
  return { snapshot, openingUnits };
}
