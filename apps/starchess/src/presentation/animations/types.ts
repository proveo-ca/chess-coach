import type { Square } from "chess.js";

import type { PieceColor } from "~/presentation/pieces/teamColors";

export type {
  AttackCue,
  DeathCue,
  MoveCue,
  ShipJumpTrail,
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
