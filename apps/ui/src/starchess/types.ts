import type { Color, PieceSymbol, Square } from "chess.js";

import type {
  PieceColor,
  PlayerEconomy,
  ResolveEvent as CoreResolveEvent,
  SpecialKind,
  StarChessColor,
  StarChessPiece,
} from "@chess-coach/starchess-core";
import type { PieceSet } from "~/types/settings";

/** Domain types — implementation lives in `@chess-coach/starchess-core`. */
export type {
  PieceColor,
  StarChessColor,
  StarChessPiece,
  RookMode,
  ScPhaseCode,
  SpawnPiece,
  ScActionTiming,
  ScSpecialKind,
  SpecialKind,
  ScAction,
  ScActionInput,
  DistributiveOmit,
  ScTurnQueue,
  ScMine,
  ScFenSnapshot,
  ScPendingKingShot,
  ScFenErrorCode,
  ScFenError,
  ClassicalPlan,
  PlayerEconomy,
} from "@chess-coach/starchess-core";

export type KingDamageState = "pristine" | "smallFire" | "bigFire" | "destroyed";

/** Map tile treatments for StarChess boards. */
export type NerdBoardVariant = "eclipse" | "butter" | "vermeer";

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
  piece: StarChessPiece;
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
  piece: StarChessPiece;
  color: PieceColor;
  at: Square;
  /**
   * Spider Mine (or mine+unit shared boom) — flash/ring only, no unit shatter
   * glyph. `piece` is ignored for art when set.
   */
  mine?: boolean;
};

/** Quiet / occupy slide — board hides `from` while the hull travels. */
export type MoveCue = {
  id: string;
  piece: StarChessPiece;
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

/** Spider Mine self-missile after chase wake (chaseFrom → detonation). */
export type MineMissileCue = {
  id: string;
  color: PieceColor;
  from: Square;
  to: Square;
};

/** Mine just placed — burrow VFX (per-leg random ≤ {@link MINE_DEPLOY_MS}). */
export type MineDeployCue = {
  id: string;
  at: Square;
  color: PieceColor;
  /** Per-leg bury duration in ms (length 4, each in 1..MINE_DEPLOY_MS). */
  legMs: number[];
};

/** Command Center deploy drop — piece is not on the board until the cue finishes. */
export type DeployCue = {
  id: string;
  piece: StarChessPiece;
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
   * not when SCFEN / turn-seek restores an already-damaged king.
   */
  impactSeq?: number;
  /**
   * Extra board squares whose `<img>` stays hidden. Prefer board automatic
   * flee-cover while `at` transitions — demos should not set this.
   */
  cover?: readonly Square[];
};

/** Pending Command Center deploy picker (was SpawnModalPending). */
export type DeployModalPending = {
  color: Color;
  pieceSet: PieceSet;
};

/** @deprecated Prefer {@link DeployModalPending}. */
export type SpawnModalPending = DeployModalPending;

export type TurnPhase = "specialBefore" | "attack" | "move" | "specialAfter";
export type SpecialTiming = "before" | "after";

export type QueuedSpecial = {
  id: string;
  color: StarChessColor;
  kind: SpecialKind;
  timing: SpecialTiming;
  from?: Square;
  to: Square;
  unit?: PieceSymbol;
};

/**
 * At most one classical chess action per player per turn.
 * Resolved in two parts: attack (if capturing) then move (if unit still alive).
 */
export type QueuedClassical = {
  id: string;
  color: StarChessColor;
  from: Square;
  to: Square;
};

export type PlayerTurnPlan = {
  special: QueuedSpecial | null;
  classical: QueuedClassical | null;
};

/** FEN-loadable piece occupancy for StarChess board snapshots (classic placement). */
export type StarChessBoard = string;

/** Core resolve cue + optional presentation anim override. */
export type ResolveEvent = CoreResolveEvent & {
  anim?: AttackAnimKind;
};

export type StarChessState = {
  turn: number;
  board: StarChessBoard;
  economies: Record<StarChessColor, PlayerEconomy>;
  kingLives: Record<StarChessColor, number>;
  plans: Record<StarChessColor, PlayerTurnPlan>;
  locked: Record<StarChessColor, boolean>;
  phase: TurnPhase | "planning" | "resolving" | "gameover";
  winner: StarChessColor | null;
  turnDeadline: number | null;
  lastResolveEvents: ResolveEvent[];
};
