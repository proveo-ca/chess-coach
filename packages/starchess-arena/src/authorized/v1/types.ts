// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { PieceColor, ScPiece, Square } from "@chess-coach/starchess-core";

export type ObservedCell =
  | { square: Square; visibility: "unknown" }
  | { square: Square; visibility: "lit"; piece: ScPiece | null }
  | { square: Square; visibility: "revealed"; piece: ScPiece };
export type Sighting = { square: Square; piece: ScPiece; observedTurn: number };
export type AuthorizedObservationV1 = {
  version: "challenge-observation-v1";
  side: PieceColor;
  turn: number;
  own: {
    minerals: number; gas: number; gasIncome: number; ccLives: number;
    pieces: { square: Square; piece: ScPiece }[];
    mines: Square[]; siegedTanks: Square[];
  };
  cells: ObservedCell[];
  memory: Sighting[];
};
export type AuthorizedObservation = AuthorizedObservationV1;
