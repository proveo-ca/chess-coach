import { getSideVision, mapToPlacement, placementToMap, type PieceColor, type ScActionInput, type ScFenSnapshot, type ScPiece, type Square } from "@chess-coach/starchess-core";
import type { AuthorizedObservationV1 } from "@chess-coach/starchess-arena/observations";

export const squares = Array.from({ length: 64 }, (_, index) => `${"abcdefgh"[Math.floor(index / 8)]}${index % 8 + 1}` as Square);
export type Entry = readonly [Square, ScPiece["type"], PieceColor?];
export const fixture = (entries: readonly Entry[] = [["a1", "k"]], options: {
  side?: PieceColor; gas?: number; minerals?: number; mines?: readonly Square[];
  siegedTanks?: readonly Square[]; unknown?: readonly Square[];
} = {}): AuthorizedObservationV1 => {
  const side = options.side ?? "w";
  const map = new Map(entries.map(([at, type, color]) => [at, { type, color: color ?? side }] as const));
  const cells = squares.map((square) => options.unknown?.includes(square) && !map.has(square)
    ? { square, visibility: "unknown" as const }
    : { square, visibility: "lit" as const, piece: map.get(square) ?? null });
  return {
    version: "challenge-observation-v1", side, turn: 21,
    own: {
      minerals: options.minerals ?? 12, gas: options.gas ?? 3, gasIncome: 3, ccLives: 3,
      pieces: squares.flatMap((square) => map.get(square)?.color === side ? [{ square, piece: map.get(square)! }] : []),
      mines: [...(options.mines ?? [])].sort(), siegedTanks: [...(options.siegedTanks ?? [])].sort(),
    },
    cells,
    memory: squares.flatMap((square) => map.has(square) && map.get(square)!.color !== side
      ? [{ square, piece: map.get(square)!, observedTurn: 21 }] : []),
  };
};
export const c = (from: Square, to: Square, color: PieceColor = "w"): Extract<ScActionInput, { timing: "C" }> =>
  ({ kind: "classical", timing: "C", color, from, to });
export const s = (kind: Exclude<ScActionInput["kind"], "classical">, from: Square, to?: Square,
  timing: "B" | "F" = "B", color: PieceColor = "w"): Extract<ScActionInput, { timing: "B" | "F" }> =>
  ({ kind, timing, color, from, ...(to ? { to } : {}) });
export const nativeSnapshot = (entries: readonly Entry[], side: PieceColor = "w", mines: readonly Square[] = []): ScFenSnapshot => ({
  placement: mapToPlacement(new Map(entries.map(([at, type, color]) => [at, { type, color: color ?? side }]))),
  turn: 21, phase: "P", ccLives: { w: 3, b: 3 }, gas: { w: 3, b: 3 }, gasIncome: { w: 3, b: 3 },
  stored: { w: 12, b: 12 }, mines: mines.map((at) => ({ at, color: side })),
});
export const observeNative = (snapshot: ScFenSnapshot, side: PieceColor): AuthorizedObservationV1 => {
  const map = placementToMap(snapshot.placement);
  const all = [...map];
  const vision = getSideVision(map, side, { mines: snapshot.mines });
  const observation = fixture(all.map(([at, piece]) => [at, piece.type, piece.color]), {
    side, gas: snapshot.gas[side], minerals: snapshot.stored?.[side] ?? 12,
    mines: snapshot.mines?.filter((mine) => mine.color === side).map((mine) => mine.at),
    siegedTanks: snapshot.siegedTanks?.filter((at) => map.get(at)?.color === side),
  });
  const cells = squares.map((square) => vision.litSquares.has(square) || map.get(square)?.color === side
    ? { square, visibility: "lit" as const, piece: map.get(square) ?? null }
    : vision.revealedPieces.has(square) && map.has(square)
      ? { square, visibility: "revealed" as const, piece: map.get(square)! }
      : { square, visibility: "unknown" as const });
  return { ...observation, cells, memory: cells.flatMap((cell) => cell.visibility !== "unknown" && cell.piece && cell.piece.color !== side
    ? [{ square: cell.square, piece: cell.piece, observedTurn: snapshot.turn }] : []) };
};
