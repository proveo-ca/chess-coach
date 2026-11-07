// SPEC: _spec/observations.puml
import { getSideVision, placementToMap, sq } from "@chess-coach/game-core";
import type { Observation } from "../src";

type Writable<T> = T extends readonly (infer Item)[] ? Writable<Item>[] :
  T extends object ? { -readonly [Key in keyof T]: Writable<T[Key]> } : T;
export type ObservationInput = Writable<Observation>;

export function fixture(paid = false): ObservationInput {
  const board = placementToMap("4k2q/8/8/8/8/8/3P4/2B1K3");
  if (paid) board.set("f2", { type: "p", color: "w" });
  const mines = [{ at: "a4", color: "w" }] as const;
  const vision = getSideVision(board, "w", { mines });
  const cells: ObservationInput["cells"] = Array.from({ length: 64 }, (_, index) => {
    const square = sq(Math.floor(index / 8), index % 8 + 1)!;
    const piece = board.get(square);
    if (vision.litSquares.has(square)) return { square, visibility: "lit", piece: piece ?? null };
    if (piece && vision.revealedPieces.has(square)) return { square, visibility: "revealed", piece };
    return { square, visibility: "unknown" };
  });
  const pieces = [...board].filter(([, piece]) => piece.color === "w").sort(([a], [b]) => a.localeCompare(b)).map(([square, piece]) => ({ square, piece }));
  return {
    version: "chess-coach.observation.v1", side: "w", turn: 1,
    own: { minerals: paid ? 2 : 3, gas: 1, gasIncome: 1, ccLives: 3, pieces, mines: ["a4"], siegedTanks: [] },
    cells,
    everLit: cells.filter(cell => cell.visibility === "lit").map(cell => cell.square),
    memory: cells.flatMap(cell => cell.visibility !== "unknown" && cell.piece?.color === "b" ? [{ square: cell.square, piece: cell.piece, observedTurn: 1 }] : []),
    ownUnitLineage: pieces.map(({ square, piece }) => ({
      id: paid && square === "f2" ? "w:unit:created:1" : `w:unit:opening:${square}`,
      square, type: piece.type, paidBasis: paid && square === "f2" ? 1 : 0,
      replacementValue: piece.type === "k" ? 0 : piece.type === "b" ? 3 : 1,
    })),
    ownMineLineage: [{ mineId: "w:mine:opening:a4", square: "a4" }],
    economy: {
      side: "w", ownPaidDebits: paid ? 1 : 0, ownPaidSurviving: paid ? 1 : 0,
      ownPaidDestroyed: 0, ownPaidWasted: 0, ownReplacementDestroyed: 0,
      enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" },
      receipts: paid ? [{
        receiptId: "w:receipt:1:0", actionRef: { planningOrdinal: 1, acceptedActionOrdinal: 0 },
        unit: "p", requestedSquare: "f2", minerals: 1, disposition: { kind: "materialized", lineageId: "w:unit:created:1" },
      }] : [],
      retiredOwnIds: [],
    },
  };
}
