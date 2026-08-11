/**
 * Occupancy for classical click targets across apps/starchess.
 * Player fog hides enemy units the viewer cannot see, so rays continue through
 * fogged blockers (intent + collision). Live / tutorial / stories share this
 * via {@link useBoardInput} + {@link playerFogOccultsMoves}.
 * // SPEC: _spec/packages/starchess-core/sc-moves.puml
 * // SPEC: _spec/packages/starchess-core/resolve.puml
 */
import type { Square } from "chess.js";
import {
  isPieceVisibleToSide,
  type RookMode,
  type ScPiece,
  type StarChessColor,
} from "@chess-coach/starchess-core";

/**
 * When `fog`, drop enemy pieces invisible to `viewer`. Own pieces always stay.
 * Pass the result into {@link scMovesFrom} so UI highlights match soft SCFEN
 * queueing (path blockers are resolve collisions, not queue rejects).
 */
export const occupancyForViewerMoves = (
  map: ReadonlyMap<Square, ScPiece>,
  viewer: StarChessColor,
  fog: boolean,
  opts?: { rookModeFor?: (square: Square) => RookMode },
): Map<Square, ScPiece> => {
  if (!fog) return new Map(map);
  const out = new Map<Square, ScPiece>();
  for (const [sq, piece] of map) {
    if (
      isPieceVisibleToSide(map, viewer, sq, piece.color, opts)
    ) {
      out.set(sq, piece);
    }
  }
  return out;
};
