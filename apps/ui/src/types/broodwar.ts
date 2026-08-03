import type { Color, PieceSymbol, Square } from "chess.js";

import type { PieceSet } from "~/types/settings";

/** White / black side used by Brood War VFX and economy. */
export type PieceColor = "w" | "b";

/** Classical piece kinds used by attack / death / move cues. */
export type BroodWarPiece = "p" | "n" | "b" | "r" | "q" | "k";

export type KingDamageState = "pristine" | "smallFire" | "bigFire" | "destroyed";

/** Siege Tank turret: mobile twin guns vs deployed shock cannon (`InlineRook`). */
export type RookMode = "tank" | "siege";

/** Attack VFX cue ids (CSS `anim-*` class stems). */
export type AttackAnimKind =
  | "pawnRifle"
  | "knightFrag"
  | "bishopGatlings"
  | "bishopCharon"
  | "rookBattery"
  | "queenLaser"
  | "kingDualCannon";

/** Active attack VFX cue (classical resolution part 1). */
export type AttackCue = {
  id: string;
  piece: BroodWarPiece;
  color: PieceColor;
  from: Square;
  to: Square;
  /** Per-cue VFX override (Charon Booster Missiles); defaults to `ANIM_BY_PIECE[piece]`. */
  anim?: AttackAnimKind;
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

/** Tactical Jump green thruster trail (long-lived; does not hide board pieces). */
export type QueenJumpTrail = {
  id: string;
  color: PieceColor;
  from: Square;
  to: Square;
};

/** Command Center deploy drop — piece is not on the board until the cue finishes. */
export type DeployCue = {
  id: string;
  piece: BroodWarPiece;
  color: PieceColor;
  at: Square;
};

/** Damaged-king hull overlay cue (slides with the piece). */
export type KingDamageCue = {
  /** Stable id so the slot survives square changes (king flee). */
  id: string;
  at: Square;
  damage: KingDamageState;
  /** Fire-spot RNG — keep stable across moves so flames don't jump. */
  seed?: number;
  /**
   * Bumps only on a connecting king-shot. Overlay booms when this increases —
   * not when BWFEN / turn-seek restores an already-damaged king.
   */
  impactSeq?: number;
  /**
   * Extra board squares whose `<img>` stays hidden. Prefer ChessBoard’s
   * automatic flee-cover while `at` transitions — demos should not set this.
   */
  cover?: readonly Square[];
};

/** Planning / resolve phase codes used in BWFEN. */
export type BwPhaseCode = "P" | "B" | "A" | "M" | "F" | "O";

export type BwFenSnapshot = {
  /** Classic piece-placement ranks (FEN field 0). */
  placement: string;
  turn: number;
  kingLives: Record<PieceColor, number>;
  phase: BwPhaseCode;
  /**
   * Squares whose unit already used a special this turn (`|U:a1c4…` extras).
   * Cleared when `turn` advances.
   */
  specialsUsed?: readonly Square[];
};

/** One side’s classical action for simultaneous resolve. */
export type ClassicalPlan = {
  color: PieceColor;
  from: Square;
  to: Square;
};

/** King spawn choices — pawn first, then promotional set. */
export type SpawnPiece = Extract<PieceSymbol, "p" | "q" | "r" | "b" | "n">;

/** Pending Command Center deploy picker (was SpawnModalPending). */
export type DeployModalPending = {
  color: Color;
  pieceSet: PieceSet;
};

/** @deprecated Prefer {@link DeployModalPending}. */
export type SpawnModalPending = DeployModalPending;
