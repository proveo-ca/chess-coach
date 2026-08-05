import type { Color, PieceSymbol, Square } from "chess.js";

import type { PieceSet } from "~/types/settings";

/** White / black side used by StarChess VFX and economy. */
export type PieceColor = "w" | "b";

export type StarChessColor = "w" | "b";

/** Classical piece kinds used by attack / death / move cues. */
export type StarChessPiece = "p" | "n" | "b" | "r" | "q" | "k";

export type KingDamageState = "pristine" | "smallFire" | "bigFire" | "destroyed";

/** Siege Tank turret: mobile twin guns vs deployed shock cannon (`InlineRook`). */
export type RookMode = "tank" | "siege";

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

export type ScMine = {
  color: PieceColor;
  at: Square;
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
  /** Spider Mines beside placement (`|M:…`). Max 2 per side. */
  mines?: readonly ScMine[];
  /**
   * Squares whose Siege Tank is unpacked (`|S:c3f7…`). Immobile until toggled
   * back to tank via `rookSiege`. Absent / empty ⇒ all rooks tank-mode.
   */
  siegedRooks?: readonly Square[];
  /**
   * Legacy deferred king-checks (`|H:…`). Parsed for round-trip only —
   * `endScTurn` applies **legal** checks from board geometry instead.
   */
  pendingKingShots?: readonly ScPendingKingShot[];
};

/** Armed king-check waiting for next-turn resolve (SCFEN `H:`). */
export type ScPendingKingShot = {
  /** Attacking side. */
  color: PieceColor;
  piece: PieceSymbol;
  from: Square;
  /** Intent square (enemy king when armed). */
  to: Square;
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
  /** Pawn promotion choice when `to` is the last rank. */
  promotion?: SpawnPiece;
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

/**
 * Per-unit special (GasDeploy onto unit). `spawn`, pawn/knight/rook demos,
 * `bishopSnipe` (Charon Booster Missiles), and `queenWarp` (Tactical Jump) have board-op paths — see STARCHESS_MODE.md.
 */
export type SpecialKind =
  | "spawn"
  | "pawnDouble"
  | "knightMine"
  | "bishopSnipe"
  | "rookSiege"
  | "queenWarp";

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

export type PlayerEconomy = {
  stored: number;
  deployed: number;
};

/** FEN-loadable piece occupancy for StarChess board snapshots (classic placement). */
export type StarChessBoard = string;

export type ResolveEvent = {
  id: string;
  phase: TurnPhase;
  color: StarChessColor;
  from?: Square;
  to?: Square;
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
