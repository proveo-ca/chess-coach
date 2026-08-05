import type { Square } from "chess.js";

import type { PieceColor } from "~/starchess/animations/teamColors";

export type {
  AttackCue,
  DeathCue,
  MoveCue,
  QueenJumpTrail,
  MineMissileCue,
  KingDamageState,
  RookMode,
} from "~/starchess/types";
export type { StarChessPiece } from "~/starchess/types";

export type BoardOverlayBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

// Keep PieceColor visible to same-folder animation modules that imported it via cues.
export type { PieceColor };
export type { Square };
