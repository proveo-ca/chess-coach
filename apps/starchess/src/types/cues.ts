import type { PieceColor, RookMode, StarChessPiece } from "@chess-coach/starchess-core";
/**
 * Presentation + cue types for StarChess animations.
 * Domain snapshots come from `@chess-coach/starchess-core`.
 */
import type { Square } from "chess.js";

export type {
  PieceColor,
  RookMode,
  ScAction,
  ScActionInput,
  ScFenSnapshot,
  ScMine,
  StarChessPiece,
} from "@chess-coach/starchess-core";

export type KingDamageState = "pristine" | "smallFire" | "bigFire" | "destroyed";

export type AttackAnimKind =
  | "pawnRifle"
  | "knightFrag"
  | "bishopGatlings"
  | "bishopCharon"
  | "rookBattery"
  | "queenLaser"
  | "kingDualCannon";

export type AttackCue = {
  id: string;
  piece: StarChessPiece;
  color: PieceColor;
  from: Square;
  to: Square;
  anim?: AttackAnimKind;
  damage?: KingDamageState;
  seed?: number;
  rookMode?: RookMode;
};

export type DeathCue = {
  id: string;
  piece: StarChessPiece;
  color: PieceColor;
  at: Square;
  mine?: boolean;
  rookMode?: RookMode;
};

export type MoveCue = {
  id: string;
  piece: StarChessPiece;
  color: PieceColor;
  from: Square;
  to: Square;
  rookMode?: RookMode;
  queenJump?: boolean;
  /** Pawn gas-step (pawnDouble) — stim travel + hop rate. */
  stim?: boolean;
};

export type DeployCue = {
  id: string;
  piece: StarChessPiece;
  color: PieceColor;
  at: Square;
  rookMode?: RookMode;
};

export type QueenJumpTrail = {
  id: string;
  from: Square;
  to: Square;
};

export type MineMissileCue = {
  id: string;
  from: Square;
  to: Square;
  color: PieceColor;
};

export type KingDamageCue = {
  /** Stable id so the slot survives square changes (king flee). */
  id: string;
  at: Square;
  damage: KingDamageState;
  /** Fire-spot RNG — keep stable across moves so flames don't jump. */
  seed?: number;
  /**
   * Bumps only on a connecting king-shot. Overlay booms when this increases —
   * not when SCFEN / turn-seek restores an already-damaged king.
   */
  impactSeq?: number;
  /** Side color for DeathKing hull tint (defaults from id when omitted). */
  color?: PieceColor;
};

/** Where the canister starts along the top edge of the square. */
export type GasDropCorner = "left" | "mid" | "right";

/**
 * Resolve VFX — vespene canister falls from the top of the square into the unit
 * that spent gas, then the green special-used aura eases in.
 */
export type GasDropCue = {
  id: string;
  at: Square;
  color: PieceColor;
  corner: GasDropCorner;
};
