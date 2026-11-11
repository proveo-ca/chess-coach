import type { PieceColor, TankMode, StarChessPiece } from "@chess-coach/starchess-core";
/**
 * Presentation + cue types for StarChess animations.
 * Domain snapshots come from `@chess-coach/starchess-core`.
 */
import type { Square } from "chess.js";

export type {
  PieceColor,
  TankMode,
  ScAction,
  ScActionInput,
  ScFenSnapshot,
  ScMine,
  StarChessPiece,
} from "@chess-coach/starchess-core";

export type CCDamageState = "pristine" | "smallFire" | "bigFire" | "destroyed";

/**
 * What a death demo can bury. A spider mine is not a unit — no FEN letter, no
 * square in the placement — so it rides an SCFEN snapshot instead of a FEN.
 */
export type DeathSubject = StarChessPiece | "mine";

export type AttackAnimKind =
  | "marineRifle"
  | "hoverbikeFrag"
  | "mechaGatlings"
  | "mechaCharon"
  | "tankBattery"
  | "battleShipLaser"
  | "ccDualCannon";

export type AttackCue = {
  id: string;
  piece: StarChessPiece;
  color: PieceColor;
  from: Square;
  to: Square;
  anim?: AttackAnimKind;
  damage?: CCDamageState;
  seed?: number;
  tankMode?: TankMode;
  /** Charon fizzle — no ship at resolve: missiles fly the full ray off-board, no impact burst. */
  fizzle?: boolean;
};

export type DeathCue = {
  id: string;
  piece: StarChessPiece;
  color: PieceColor;
  at: Square;
  mine?: boolean;
  tankMode?: TankMode;
  /** A move-phase collision death — the board clears the landing ghost on its square. */
  collision?: boolean;
};

export type MoveCue = {
  id: string;
  piece: StarChessPiece;
  color: PieceColor;
  from: Square;
  to: Square;
  tankMode?: TankMode;
  shipJump?: boolean;
  /** Marine gas-step (stimStep) — stim travel + hop rate. */
  stim?: boolean;
  /**
   * Command Center only: the travelling hull burns for itself. Without these the mover
   * paints a pristine CC while the persistent fire slot is still parked on
   * `from`, so a damaged Command Center reads as full HP for the whole slide.
   */
  damage?: CCDamageState;
  seed?: number;
};

export type DeployCue = {
  id: string;
  piece: StarChessPiece;
  color: PieceColor;
  at: Square;
  tankMode?: TankMode;
};

export type ShipJumpTrail = {
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

export type CCDamageCue = {
  /** Stable id so the slot survives square changes (Command Center flee). */
  id: string;
  at: Square;
  damage: CCDamageState;
  /** Fire-spot RNG — keep stable across moves so flames don't jump. */
  seed?: number;
  /**
   * Bumps only on a connecting Command Center-shot. Overlay booms when this increases —
   * not when SCFEN / turn-seek restores an already-damaged Command Center.
   */
  impactSeq?: number;
  /** Side color for DeathCommandCenter hull tint (defaults from id when omitted). */
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
