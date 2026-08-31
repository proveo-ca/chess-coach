/**
 * Observer DualNav review — phase chip + store-backed history packages.
 */
import type { EndScTurnResult, ScFenSnapshot, StarChessColor } from "@chess-coach/starchess-core";

import type { BoardVariant } from "~/types/board";

export type ReviewTurnPhase =
  /** Settled idle (turn start or Final). */
  | "start"
  /** Turn-open king-checks animating. */
  | "check"
  /** Intent ghosts / rings held before End. */
  | "intent"
  /** End combat timeline (B → C → path-reveal → F). */
  | "resolve"
  /** Last settled ply. */
  | "final";

export type ReviewHistoryStep = {
  caption: string;
  intentCaption?: string;
};

/** Settled DualNav package — MatchStore reviewForward/Back consume this. */
export type ReviewHistory = {
  settledSnapshots: ScFenSnapshot[];
  settledResolves: EndScTurnResult[];
  startCaption: string;
  steps: readonly ReviewHistoryStep[];
};

export type StarChessMatchResult = "win" | "loss" | "draw";

/** Persisted finished match for `/review/:id` DualNav replay. */
export type StarChessGameRecord = {
  id: string;
  startedAt: string;
  endedAt: string;
  result: StarChessMatchResult;
  map: BoardVariant;
  playerColor: StarChessColor;
  playerName?: string;
  /** For arena imports, preserve both sides' script ids for display (max 2 lines). */
  arenaPlayers?: { w: string; b: string };
  /** Settled DualNav plies as SCFEN strings. */
  scfens: string[];
  /** Resolve that produced scfens[i+1] from scfens[i]. */
  resolves: EndScTurnResult[];
};
