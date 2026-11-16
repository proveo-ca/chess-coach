// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { AuthorizedObservationV1 } from "@chess-coach/starchess-arena/observations";
import type { PieceColor, ScActionInput, ScPiece, Square } from "@chess-coach/starchess-core";

export const squares = Array.from({ length: 64 }, (_, i) =>
  `${String.fromCharCode(97 + Math.floor(i / 8))}${i % 8 + 1}` as Square);
export type FixtureOptions = {
  side?: PieceColor; minerals?: number; gas?: number; mines?: Square[]; siege?: Square[];
  unknown?: Square[]; enemy?: [Square, ScPiece["type"]][];
};
export const observation = (
  own: [Square, ScPiece["type"]][] = [["a1", "k"]],
  options: FixtureOptions = {},
): AuthorizedObservationV1 => {
  const side = options.side ?? "w";
  const pieces = own.map(([square, type]) => ({ square, piece: { type, color: side } })).sort((a, b) => a.square.localeCompare(b.square));
  const enemies = (options.enemy ?? []).map(([square, type]) => ({ square, piece: { type, color: side === "w" ? "b" as const : "w" as const } }));
  const map = new Map([...pieces, ...enemies].map(({ square, piece }) => [square, piece]));
  return {
    version: "challenge-observation-v1", side, turn: 21,
    own: { minerals: options.minerals ?? 12, gas: options.gas ?? 3, gasIncome: 3, ccLives: 3,
      pieces, mines: [...options.mines ?? []].sort(), siegedTanks: [...options.siege ?? []].sort() },
    cells: squares.map((square) => options.unknown?.includes(square)
      ? { square, visibility: "unknown" } : { square, visibility: "lit", piece: map.get(square) ?? null }),
    memory: enemies.map((e) => ({ ...e, observedTurn: 21 })).sort((a, b) => a.square.localeCompare(b.square)),
  };
};
export const c = (from: Square, to: Square, color: PieceColor = "w"): Extract<ScActionInput, { timing: "C" }> =>
  ({ kind: "classical", timing: "C", color, from, to });
export const s = (
  kind: Exclude<ScActionInput["kind"], "classical">, from: Square, to?: Square,
  timing: "B" | "F" = "B", color: PieceColor = "w",
): Extract<ScActionInput, { timing: "B" | "F" }> =>
  ({ kind, from, timing, color, ...(to ? { to } : {}) });
export const allActors = (side: PieceColor = "w") => observation(
  [["a1", "k"], [side === "w" ? "b2" : "b7", "p"], ["c3", "n"], ["d4", "b"], ["e5", "r"], ["f6", "q"]],
  { side, unknown: ["g7", "h7"], enemy: [["h8", "k"], ["g8", "q"]] },
);
