import type { Square } from "chess.js";

import type { DemoPiece } from "~/broodwar/animations/attackAnim";
import type { PieceColor } from "~/broodwar/animations/teamColors";

export type {
  AttackCue,
  DeathCue,
  MoveCue,
  QueenJumpTrail,
  KingDamageState,
  RookMode,
} from "~/types/broodwar";
export type BroodWarPiece = DemoPiece;

export type BoardOverlayBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

// Keep PieceColor visible to same-folder animation modules that imported it via cues.
export type { PieceColor };
export type { Square };
