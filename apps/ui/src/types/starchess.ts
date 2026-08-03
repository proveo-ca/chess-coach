import type { Color, PieceSymbol, Square } from "chess.js";

import type { PieceSet } from "~/types/settings";

/** White / black side used by StarChess VFX and economy. */
export type PieceColor = "w" | "b";

/** Classical piece kinds used by attack / death / move cues. */
export type StarChessPiece = "p" | "n" | "b" | "r" | "q" | "k";

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
};

/** Quiet / occupy slide — ChessBoard hides `from` while the hull travels. */
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
   * Extra board squares whose `<img>` stays hidden. Prefer ChessBoard’s
   * automatic flee-cover while `at` transitions — demos should not set this.
   */
  cover?: readonly Square[];
};

/** Planning / resolve phase codes used in SCFEN. */
export type ScPhaseCode = "P" | "B" | "A" | "M" | "F" | "O";

/** King spawn choices — pawn first, then promotional set. */
export type SpawnPiece = Extract<PieceSymbol, "p" | "q" | "r" | "b" | "n">;

/** Queue timing codes written in SCFEN `Q:`. */
export type ScActionTiming = "B" | "C" | "F";

export type ScSpecialKind =
  | "spawn"
  | "pawnDouble"
  | "knightMine"
  | "bishopSnipe"
  | "rookSiege"
  | "queenWarp";

export type ScAction =
  | {
      timing: "B" | "F";
      kind: ScSpecialKind;
      color: PieceColor;
      from: Square;
      to?: Square;
      unit?: SpawnPiece;
      seq: number;
    }
  | {
      timing: "C";
      kind: "classical";
      color: PieceColor;
      from: Square;
      to: Square;
      promotion?: SpawnPiece;
      seq: number;
    };

export type ScTurnQueue = {
  /** Global insertion sequence. Resolve groups by timing, then seq. */
  actions: readonly ScAction[];
};

export type ScFenSnapshot = {
  /** Classic piece-placement ranks (FEN field 0). */
  placement: string;
  turn: number;
  kingLives: Record<PieceColor, number>;
  phase: ScPhaseCode;
  /** Remaining vespene this planning turn (`G:` first pair). */
  gas: Record<PieceColor, number>;
  /** Gas income/cap this turn (`G:` second pair) — authoritative for legality. */
  gasIncome: Record<PieceColor, number>;
  /**
   * Squares whose unit already used a special this turn (`|U:a1c4…` extras).
   * Cleared when `turn` advances.
   */
  specialsUsed?: readonly Square[];
  /** Planning queue (`|Q:…`). Omit = snapshot-only. */
  queue?: ScTurnQueue;
};

export type ScFenErrorCode =
  | "SC_SCHEMA"
  | "SC_PLACEMENT"
  | "SC_GAS"
  | "SC_QUEUE_SHAPE"
  | "SC_PHASE"
  | "SC_BASELINE_FEN"
  | "SC_SPECIAL"
  | "SC_REPLAY";

export type ScFenError = {
  code: ScFenErrorCode;
  message: string;
};

/** One side’s classical action for simultaneous resolve. */
export type ClassicalPlan = {
  color: PieceColor;
  from: Square;
  to: Square;
};

/** Pending Command Center deploy picker (was SpawnModalPending). */
export type DeployModalPending = {
  color: Color;
  pieceSet: PieceSet;
};

/** @deprecated Prefer {@link DeployModalPending}. */
export type SpawnModalPending = DeployModalPending;
