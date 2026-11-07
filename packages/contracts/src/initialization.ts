// SPEC: _spec/initialization.puml
import { createCanonicalGame, getSideVision, placementToMap, sq } from "@chess-coach/game-core";
import type { Square, StarChessColor } from "@chess-coach/game-core";
import { decodeObservation } from "./index";
import type { Observation, ObservedCell } from "./shape";

export function canonicalInitialObservation(side: StarChessColor): Observation {
  if (side !== "w" && side !== "b") throw new RangeError("Unknown recipient side");
  const { snapshot, openingUnits } = createCanonicalGame();
  const board = placementToMap(snapshot.placement);
  const vision = getSideVision(snapshot.placement, side);
  const squares = Array.from({ length: 64 }, (_, index) => sq(Math.floor(index / 8), index % 8 + 1)!);
  const cells: ObservedCell[] = squares.map((square: Square) => {
    const piece = board.get(square);
    if (vision.litSquares.has(square)) return { square, visibility: "lit", piece: piece ?? null };
    if (piece && vision.revealedPieces.has(square)) return { square, visibility: "revealed", piece };
    return { square, visibility: "unknown" };
  });
  const observation: Observation = {
    version: "chess-coach.observation.v1",
    side,
    turn: snapshot.turn,
    own: {
      minerals: snapshot.stored![side],
      gas: snapshot.gas[side],
      gasIncome: snapshot.gasIncome[side],
      ccLives: snapshot.ccLives[side],
      pieces: openingUnits.filter(unit => unit.color === side).map(unit => ({
        square: unit.square, piece: { type: unit.type, color: unit.color },
      })),
      mines: [],
      siegedTanks: [],
    },
    cells,
    memory: cells.flatMap(cell => cell.visibility !== "unknown" && cell.piece && cell.piece.color !== side
      ? [{ square: cell.square, piece: cell.piece, observedTurn: snapshot.turn }] : []),
    everLit: cells.flatMap(cell => cell.visibility === "lit" ? [cell.square] : []),
    ownUnitLineage: openingUnits.filter(unit => unit.color === side).map(({ color: _color, ...unit }) => unit),
    ownMineLineage: [],
    economy: {
      side,
      ownPaidDebits: 0,
      ownPaidSurviving: 0,
      ownPaidDestroyed: 0,
      ownPaidWasted: 0,
      ownReplacementDestroyed: 0,
      enemyLoss: {
        confirmedUnitCount: 0,
        replacementLowerBound: 0,
        paidLowerBound: 0,
        upper: "unknown",
        completeness: "witnessed-only",
      },
      receipts: [],
      retiredOwnIds: [],
    },
  };
  return decodeObservation(JSON.stringify(observation));
}
