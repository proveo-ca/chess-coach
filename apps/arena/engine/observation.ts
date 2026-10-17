// SPEC: _spec/apps/arena/burn-compat.puml
import {
  getSideVision,
  placementToMap,
  sq,
  type ScFenSnapshot,
  type Square,
  type StarChessColor,
  type StarChessPiece,
} from "@chess-coach/starchess-core";

export type ObservedPiece = Readonly<{
  color: StarChessColor;
  type: StarChessPiece;
}>;

export type ObservedCell =
  | Readonly<{ square: Square; visibility: "unknown" }>
  | Readonly<{ square: Square; visibility: "lit"; piece: ObservedPiece | null }>
  | Readonly<{ square: Square; visibility: "revealed"; piece: ObservedPiece }>;

export type SmokeObservation = Readonly<{
  version: "arena-smoke-observation-v1";
  side: StarChessColor;
  turn: number;
  own: Readonly<{
    minerals: number;
    gas: number;
    gasIncome: number;
    ccLives: number;
    pieces: readonly Readonly<{ square: Square; type: StarChessPiece }>[];
    mines: readonly Square[];
    siegedTanks: readonly Square[];
  }>;
  cells: readonly ObservedCell[];
}>;

function freezeTree<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

export function projectObservation(
  snapshot: ScFenSnapshot,
  side: StarChessColor,
): SmokeObservation {
  if (!snapshot.stored) throw new Error("Observation requires an explicit mineral bank");
  const board = placementToMap(snapshot.placement);
  const siege = new Set(snapshot.siegedTanks ?? []);
  const vision = getSideVision(board, side, {
    mines: snapshot.mines ?? [],
    tankModeFor: (square) => (siege.has(square) ? "siege" : "tank"),
  });
  const pieces = [...board]
    .filter(([, piece]) => piece.color === side)
    .map(([square, piece]) => ({ square, type: piece.type }))
    .sort((left, right) => compareText(left.square, right.square));
  const cells: ObservedCell[] = [];
  for (let file = 0; file < 8; file += 1) {
    for (let rank = 1; rank <= 8; rank += 1) {
      const square = sq(file, rank);
      if (!square) throw new Error("Invalid observation square");
      const piece = board.get(square);
      if (vision.litSquares.has(square) || piece?.color === side) {
        cells.push({
          square,
          visibility: "lit",
          piece: piece ? { color: piece.color, type: piece.type } : null,
        });
      } else if (vision.revealedPieces.has(square) && piece) {
        cells.push({ square, visibility: "revealed", piece: { color: piece.color, type: piece.type } });
      } else {
        cells.push({ square, visibility: "unknown" });
      }
    }
  }
  const observation: SmokeObservation = {
    version: "arena-smoke-observation-v1",
    side,
    turn: snapshot.turn,
    own: {
      minerals: snapshot.stored[side],
      gas: snapshot.gas[side],
      gasIncome: snapshot.gasIncome[side],
      ccLives: snapshot.ccLives[side],
      pieces,
      mines: (snapshot.mines ?? [])
        .filter((mine) => mine.color === side)
        .map((mine) => mine.at)
        .sort(compareText),
      siegedTanks: pieces
        .filter((piece) => piece.type === "r" && siege.has(piece.square))
        .map((piece) => piece.square),
    },
    cells,
  };
  return freezeTree(observation);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
