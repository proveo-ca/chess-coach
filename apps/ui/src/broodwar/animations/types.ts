import type { Square } from "chess.js";

import type { DemoPiece } from "~/broodwar/animations/attackAnim";
import type { PieceColor } from "~/broodwar/animations/teamColors";

export type BroodWarPiece = DemoPiece;

/** Active attack VFX cue (classical resolution part 1). */
export type AttackCue = {
  id: string;
  piece: BroodWarPiece;
  color: PieceColor;
  from: Square;
  to: Square;
};

/** Active death VFX cue on a square. */
export type DeathCue = {
  id: string;
  piece: BroodWarPiece;
  color: PieceColor;
  at: Square;
};

export type BoardOverlayBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};
