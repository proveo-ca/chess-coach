/**
 * Observer DualNav review — phase chip + store-backed history packages.
 */
import type { EndScTurnResult, ScFenSnapshot } from "@chess-coach/starchess-core";

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
