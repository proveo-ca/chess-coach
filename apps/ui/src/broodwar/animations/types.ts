import type { Square } from "chess.js";

import type { DemoPiece } from "~/broodwar/animations/attackAnim";
import type { PieceColor } from "~/broodwar/animations/teamColors";
import type { KingDamageState } from "~/broodwar/types";

export type BroodWarPiece = DemoPiece;

/** Active attack VFX cue (classical resolution part 1). */
export type AttackCue = {
  id: string;
  piece: BroodWarPiece;
  color: PieceColor;
  from: Square;
  to: Square;
  /** King only — keep HP fire overlays on the attacking hull. */
  damage?: KingDamageState;
  /** Stable fire-spot seed (match kingDamage overlay). */
  seed?: number;
};

/** Active death VFX cue on a square. */
export type DeathCue = {
  id: string;
  piece: BroodWarPiece;
  color: PieceColor;
  at: Square;
};

/** Quiet / occupy slide — ChessBoard hides `from` while the hull travels. */
export type MoveCue = {
  id: string;
  piece: BroodWarPiece;
  color: PieceColor;
  from: Square;
  to: Square;
};

export type BoardOverlayBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};
