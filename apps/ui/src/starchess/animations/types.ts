import type { Square } from "chess.js";

import type { DemoPiece } from "~/starchess/animations/attackAnim";
import type { PieceColor } from "~/starchess/animations/teamColors";

export type {
  AttackCue,
  DeathCue,
  MoveCue,
  QueenJumpTrail,
  KingDamageState,
  RookMode,
} from "~/types/starchess";
export type StarChessPiece = DemoPiece;

export type BoardOverlayBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

// Keep PieceColor visible to same-folder animation modules that imported it via cues.
export type { PieceColor };
export type { Square };
