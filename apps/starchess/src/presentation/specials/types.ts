import type { PieceSymbol, Square } from "chess.js";

/** Drop target when a gas canister is released on a unit. */
export type GasDeployTarget = {
  square: Square;
  piece: PieceSymbol;
};

/** Handler outcome — `pending` skips specials-used marking until it queues. */
export type ArmResult = false | "armed" | "pending";
