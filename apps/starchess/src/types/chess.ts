import type { Square } from "chess.js";

/** Pawn / marine promotion target — queen, rook, bishop, or knight. */
export type PromotionPiece = "q" | "r" | "b" | "n";

/** Open picker while a last-rank advance is pending confirmation. */
export type PendingPromotion = {
  color: "w" | "b";
  from: Square;
  to: Square;
  /**
   * `gas` — Marine stim onto last rank (queues pawnDouble + promotion).
   * `classical` (default) — board click / gas-stack rewrite (queues C + promotion).
   */
  via?: "classical" | "gas";
};
