/**
 * Fog read: what our side can see this turn, and which enemy heavies are lit.
 * An unreadable board degrades to fighting blind rather than crashing the host.
 *
 * // SPEC: _spec/apps/starchess/core/adjutant/opponent-strategy.puml
 */

import type { Square } from "chess.js";

import type { ScPiece } from "../../board/placement";
import { getSideVision } from "../../board/vision";
import type { PieceColor, ScFenSnapshot } from "../../model/types";
import type { VisionIntel } from "./types";

export const buildVisionIntel = (
  snap: ScFenSnapshot,
  map: Map<Square, ScPiece>,
  us: PieceColor,
  enemy: PieceColor,
  enemyKing: Square | null,
  sieged: ReadonlySet<Square>,
): VisionIntel => {
  let litSquares: ReadonlySet<Square> = new Set();
  let revealedPieces: ReadonlySet<Square> = new Set();
  let enemyKingVisible = false;

  try {
    const vision = getSideVision(map, us, {
      mines: snap.mines,
      rookModeFor: (s) => (sieged.has(s) ? "siege" : "tank"),
    });
    litSquares = vision.litSquares;
    revealedPieces = vision.revealedPieces;
    enemyKingVisible =
      !!enemyKing && (litSquares.has(enemyKing) || revealedPieces.has(enemyKing));
  } catch {
    enemyKingVisible = false;
  }

  let enemyQueenVisible = false;
  for (const [sq, piece] of map) {
    if (piece.color !== enemy || piece.type !== "q") continue;
    if (litSquares.has(sq) || revealedPieces.has(sq)) {
      enemyQueenVisible = true;
      break;
    }
  }

  return { litSquares, revealedPieces, enemyKingVisible, enemyQueenVisible };
};
