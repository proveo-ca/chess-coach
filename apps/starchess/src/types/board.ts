import type { RookMode, StarChessColor } from "@chess-coach/starchess-core";
import type { PieceSymbol, Square } from "chess.js";

export type BoardVariant = "eclipse" | "butter" | "vermeer";

/** Alias used by older demo fixtures. */
export type NerdBoardVariant = BoardVariant;

/** `player` = single-viewer fog veil; `observer` = full board + dual vision borders. */
export type VisionMode = "player" | "observer";

export type IntentGhost = {
  at: Square;
  color: StarChessColor;
  piece: PieceSymbol;
  rookMode?: RookMode;
};

export type IntentCanister = {
  at: Square;
  color: StarChessColor;
};

/** Red dashed ring — pending king-check or queued capture/attack target. */
export type IntentCheck = {
  at: Square;
};
