import type { Square } from "chess.js";

/** Marine promotion target — BattleShip, Tank, Mecha, or Hoverbike. */
export type PromotionPiece = "q" | "r" | "b" | "n";

/** Open picker while a last-rank advance is pending confirmation. */
export type PendingPromotion = {
  color: "w" | "b";
  from: Square;
  to: Square;
  /**
   * `gas` — Marine stim onto last rank (queues stimStep + promotion).
   * `classical` (default) — board click / gas-stack rewrite (queues C + promotion).
   */
  via?: "classical" | "gas";
};
