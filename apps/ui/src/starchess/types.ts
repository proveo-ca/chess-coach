import type { PieceSymbol, Square } from "chess.js";

import type { AttackAnimKind } from "~/types/starchess";

export type StarChessColor = "w" | "b";
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

export type { KingDamageState, ScPhaseCode, RookMode } from "~/types/starchess";

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

/** Planning / resolve phase codes used in SCFEN (see scfen.ts) — see ~/types/starchess. */

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

export type { AttackAnimKind };
