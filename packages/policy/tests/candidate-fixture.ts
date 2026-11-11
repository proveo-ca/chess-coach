// SPEC: _spec/candidate-generation.puml
import { UNIT_COST, getSideVision, placementToMap, sq } from "@chess-coach/game-core";
import type { Square } from "@chess-coach/game-core";
import { fixture } from "../../contracts/tests/fixture";
import type { ObservationInput } from "../../contracts/tests/fixture";

export function candidateFixture(placement = "4k2q/8/8/8/8/8/3P4/RNBQK3"): ObservationInput {
  const value = fixture();
  value.turn = 21;
  const map = placementToMap(placement);
  const vision = getSideVision(map, "w");
  value.own.pieces = [...map].filter(([, piece]) => piece.color === "w").map(([square, piece]) => ({ square, piece })).sort((a, b) => a.square.localeCompare(b.square));
  value.own.gas = 3;
  value.own.gasIncome = 3;
  value.own.minerals = 12;
  value.own.mines = [];
  value.ownMineLineage = [];
  value.ownUnitLineage = value.own.pieces.map(({ square, piece }) => ({
    id: `w:unit:opening:${square}`, square, type: piece.type, paidBasis: 0,
    replacementValue: piece.type === "k" ? 0 : UNIT_COST[piece.type],
  }));
  value.cells = Array.from({ length: 64 }, (_, index) => {
    const square = sq(Math.floor(index / 8), index % 8 + 1)!;
    const piece = map.get(square);
    if (vision.litSquares.has(square)) return { square, visibility: "lit", piece: piece ?? null };
    if (piece && vision.revealedPieces.has(square)) return { square, visibility: "revealed", piece };
    return { square, visibility: "unknown" };
  });
  value.everLit = [...vision.litSquares].sort();
  value.memory = value.cells.flatMap(cell => cell.visibility !== "unknown" && cell.piece?.color === "b" ? [{ square: cell.square, piece: cell.piece, observedTurn: value.turn }] : []);
  return value;
}

export function mirroredCandidateFixture(value: ObservationInput): ObservationInput {
  const result = structuredClone(value);
  const flip = (at: Square): Square => `${at[0]}${9 - Number(at[1])}` as Square;
  const flipColor = (color: "w" | "b") => color === "w" ? "b" as const : "w" as const;
  result.side = "b";
  result.economy.side = "b";
  result.own.pieces = result.own.pieces.map(entry => ({ square: flip(entry.square), piece: { type: entry.piece.type, color: flipColor(entry.piece.color) } })).sort((a, b) => a.square.localeCompare(b.square));
  result.cells = result.cells.map(cell => {
    if (cell.visibility === "unknown") return { ...cell, square: flip(cell.square) };
    return { ...cell, square: flip(cell.square), piece: cell.piece ? { type: cell.piece.type, color: flipColor(cell.piece.color) } : null } as typeof cell;
  }).sort((a, b) => a.square.localeCompare(b.square));
  result.memory = result.memory.map(entry => ({ ...entry, square: flip(entry.square), piece: { type: entry.piece.type, color: flipColor(entry.piece.color) } })).sort((a, b) => a.square.localeCompare(b.square));
  result.ownUnitLineage = result.ownUnitLineage.map(entry => ({ ...entry, square: flip(entry.square), id: `b:unit:opening:${flip(entry.square)}` })).sort((a, b) => a.square.localeCompare(b.square));
  result.own.mines = result.own.mines.map(flip).sort();
  result.own.siegedTanks = result.own.siegedTanks.map(flip).sort();
  result.ownMineLineage = result.ownMineLineage.map(entry => ({ square: flip(entry.square), mineId: `b:mine:opening:${flip(entry.square)}` })).sort((a, b) => a.square.localeCompare(b.square));
  result.everLit = result.everLit.map(flip).sort();
  return result;
}
