import type { Square } from "chess.js";

import type { PieceColor } from "~/presentation/animations/teamColors";

export type {
  AttackCue,
  DeathCue,
  MoveCue,
  QueenJumpTrail,
  MineMissileCue,
  KingDamageState,
  RookMode,
} from "~/presentation/types";
export type { StarChessPiece } from "~/presentation/types";

export type BoardOverlayBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

// Keep PieceColor visible to same-folder animation modules that imported it via cues.
export type { PieceColor };
export type { Square };
