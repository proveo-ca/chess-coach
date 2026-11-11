// SPEC: _spec/apps/starchess/core/adjutant/naive/opponent-strategy.puml
/**
 * Fog read: what our side can see this turn, and which enemy heavies are lit.
 * An unreadable board degrades to fighting blind rather than crashing the host.
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
  enemyCC: Square | null,
  sieged: ReadonlySet<Square>,
): VisionIntel => {
  let litSquares: ReadonlySet<Square> = new Set();
  let revealedPieces: ReadonlySet<Square> = new Set();
  let enemyCCVisible = false;

  try {
    const vision = getSideVision(map, us, {
      mines: snap.mines,
      tankModeFor: (s) => (sieged.has(s) ? "siege" : "tank"),
    });
    litSquares = vision.litSquares;
    revealedPieces = vision.revealedPieces;
    enemyCCVisible =
      !!enemyCC && (litSquares.has(enemyCC) || revealedPieces.has(enemyCC));
  } catch {
    enemyCCVisible = false;
  }

  let enemyBattleShipVisible = false;
  for (const [sq, piece] of map) {
    if (piece.color !== enemy || piece.type !== "q") continue;
    if (litSquares.has(sq) || revealedPieces.has(sq)) {
      enemyBattleShipVisible = true;
      break;
    }
  }

  return { litSquares, revealedPieces, enemyCCVisible, enemyBattleShipVisible };
};
