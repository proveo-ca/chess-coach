// SPEC: _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { getSideVision, placementToMap, type PieceColor, type ScFenSnapshot } from "@chess-coach/starchess-core";
import type { Bank } from "../run/bank";
import { deepFreeze } from "./config";
import type { AuthorizedObservation, ObservedCell, Sighting } from "./types";

import { SQUARES } from "../authorized/v1/squares";
export { SQUARES } from "../authorized/v1/squares";

export const observe = (
  snapshot: ScFenSnapshot, bank: Bank, side: PieceColor, prior: readonly Sighting[] = [],
): AuthorizedObservation => {
  const map = placementToMap(snapshot.placement);
  const sieged = new Set(snapshot.siegedTanks ?? []);
  const vision = getSideVision(map, side, {
    tankModeFor: (square) => sieged.has(square) ? "siege" : "tank",
    mines: snapshot.mines,
  });
  const cells: ObservedCell[] = SQUARES.map((square) => {
    const piece = map.get(square);
    if (vision.litSquares.has(square) || piece?.color === side) {
      return { square, visibility: "lit", piece: piece ? { ...piece } : null };
    }
    if (vision.revealedPieces.has(square) && piece) {
      return { square, visibility: "revealed", piece: { ...piece } };
    }
    return { square, visibility: "unknown" };
  });
  const sightings = new Map(prior.map((sighting) => [sighting.square, structuredClone(sighting)]));
  for (const cell of cells) {
    if (cell.visibility === "unknown") continue;
    if (cell.piece && cell.piece.color !== side) {
      sightings.set(cell.square, { square: cell.square, piece: { ...cell.piece }, observedTurn: snapshot.turn });
    } else sightings.delete(cell.square);
  }
  return deepFreeze({
    version: "challenge-observation-v1", side, turn: snapshot.turn,
    own: {
      minerals: bank[side], gas: snapshot.gas[side], gasIncome: snapshot.gasIncome[side],
      ccLives: snapshot.ccLives[side],
      pieces: cells.flatMap((cell) => cell.visibility !== "unknown" && cell.piece?.color === side
        ? [{ square: cell.square, piece: { ...cell.piece } }] : []),
      mines: SQUARES.filter((square) => snapshot.mines?.some((mine) => mine.at === square && mine.color === side)),
      siegedTanks: SQUARES.filter((square) => sieged.has(square) && map.get(square)?.color === side),
    },
    cells,
    memory: SQUARES.flatMap((square) => sightings.has(square) ? [sightings.get(square)!] : []),
  });
};
