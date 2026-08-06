import type { Color, Square } from "chess.js";

import type { PromotionPiece } from "~/types/chess";
import type { PieceSet } from "~/types/settings";

/**
 * Variant-agnostic move authority injected into {@link useChessBoard}.
 * Absent ⇒ every path is byte-identical to chess.js. Present ⇒ destinations
 * and commit are owned by the provider; chess.js gates are bypassed.
 *
 * // SPEC: _spec/apps/ui/starchess/sc-moves.puml
 */
export type BoardMoveProvider = {
  /** Legal destination squares from `from` (highlights). */
  destinations: (from: Square) => readonly string[];
  /**
   * Commit a move. Return true when the move was accepted.
   * `requestPromotion` is supplied by the board hook (same modal as classical).
   */
  commit: (input: {
    from: Square;
    to: Square;
    requestPromotion: (color: Color, pieceSet: PieceSet) => Promise<PromotionPiece | null>;
  }) => Promise<{ didMove: boolean; cancelled?: boolean }>;
  /** Optional select filter; default uses chess.js turn / piece colour. */
  canSelect?: (square: Square) => boolean;
  /** When true, Stockfish hover-eval is suppressed (would throw on SC-legal moves). */
  suppressHoverEval?: boolean;
};
