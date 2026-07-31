import type { PieceSymbol, Square } from "chess.js";

import type { AttackAnimKind } from "~/broodwar/animations/attackAnim";

export type BroodWarColor = "w" | "b";
export type TurnPhase = "specialBefore" | "attack" | "move" | "specialAfter";
export type SpecialTiming = "before" | "after";

/**
 * Per-unit special (long-press). Only `spawn` is implementable without
 * FEN-illegal board ops; other kinds are typed stubs — see BROODWAR_MODE.md.
 */
export type SpecialKind =
  | "spawn"
  | "pawnDouble"
  | "knightMine"
  | "bishopSnipe"
  | "rookSiege"
  | "queenWarp";

export type { KingDamageState, BwPhaseCode } from "~/types/broodwar";

export type QueuedSpecial = {
  id: string;
  color: BroodWarColor;
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
  color: BroodWarColor;
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

/** FEN-loadable piece occupancy for Brood War board snapshots (classic placement). */
export type BroodWarBoard = string;

/** Planning / resolve phase codes used in BWFEN (see bwfen.ts) — see ~/types/broodwar. */

export type ResolveEvent = {
  id: string;
  phase: TurnPhase;
  color: BroodWarColor;
  from?: Square;
  to?: Square;
  anim?: AttackAnimKind;
};

export type BroodWarState = {
  turn: number;
  board: BroodWarBoard;
  economies: Record<BroodWarColor, PlayerEconomy>;
  kingLives: Record<BroodWarColor, number>;
  plans: Record<BroodWarColor, PlayerTurnPlan>;
  locked: Record<BroodWarColor, boolean>;
  phase: TurnPhase | "planning" | "resolving" | "gameover";
  winner: BroodWarColor | null;
  turnDeadline: number | null;
  lastResolveEvents: ResolveEvent[];
};

export type { AttackAnimKind };
