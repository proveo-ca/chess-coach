/**
 * Build terminal DualNav history the same way live play records it:
 * optional beginScTurn check ply, then End resolve — so MatchStore
 * reviewForward/Back can replay without a parallel harness.
 */
import {
  beginScTurn,
  endScTurn,
  refillTurnGas,
  scOutcome,
  type EndScTurnResult,
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { createInitialMatchState } from "~/app/matchReducer";
import type { MatchState } from "~/types/match";
import type { ReviewHistory, ReviewHistoryStep } from "~/types/review";

export type { ReviewHistory, ReviewHistoryStep };

export type BuildReviewHistoryArgs = {
  start: ScFenSnapshot;
  steps: readonly ReviewHistoryStep[];
  startCaption: string;
  /** Queue actions for step `i` onto the current board (clears prior queue). */
  queueStep: (snap: ScFenSnapshot, stepIndex: number) => ScFenSnapshot;
  /**
   * When true (default), insert beginScTurn check plies like live MatchStore.
   */
  includeTurnOpenChecks?: boolean;
};

/**
 * Walk a scenario into settledSnapshots / settledResolves matching
 * BEGIN_CHECKS_DONE + TIMELINE_DONE recording order.
 */
export const buildReviewHistory = (args: BuildReviewHistoryArgs): ReviewHistory => {
  const includeChecks = args.includeTurnOpenChecks !== false;
  const settledSnapshots: ScFenSnapshot[] = [args.start];
  const settledResolves: EndScTurnResult[] = [];
  let cur = args.start;

  for (let i = 0; i < args.steps.length; i += 1) {
    if (cur.phase === "O") break;

    if (includeChecks) {
      let begun;
      try {
        begun = beginScTurn(cur);
      } catch {
        begun = null;
      }
      if (begun?.changed && begun.asResolve) {
        settledResolves.push(begun.asResolve);
        settledSnapshots.push(begun.next);
        cur = begun.next;
        if (cur.phase === "O") break;
      } else {
        // No standing checks — still refill like live turn-open.
        cur = begun?.next ?? refillTurnGas(cur);
      }
    } else {
      cur = refillTurnGas(cur);
    }

    const queued = args.queueStep(cur, i);
    const result = endScTurn(queued, { skipTurnStartChecks: true });
    settledResolves.push(result);
    settledSnapshots.push(result.next);
    cur = result.next;
  }

  return {
    settledSnapshots,
    settledResolves,
    startCaption: args.startCaption,
    steps: args.steps,
  };
};

export const createMatchStateFromReviewHistory = (
  history: Pick<ReviewHistory, "settledSnapshots" | "settledResolves">,
  opts?: { stored?: number; playerColor?: StarChessColor },
): MatchState => {
  const stored = opts?.stored ?? 12;
  const playerColor = opts?.playerColor ?? "w";
  const snaps = history.settledSnapshots;
  const resolves = history.settledResolves;
  if (snaps.length === 0) return createInitialMatchState();

  const live = snaps[snaps.length - 1]!;
  const start = snaps[0]!;
  const outcome = live.phase === "O" ? scOutcome(live) : null;

  const base = createInitialMatchState();
  return {
    ...base,
    phase: "gameOver",
    liveSnapshot: live,
    economies: {
      w: { stored, deployed: 0 },
      b: { stored, deployed: 0 },
    },
    viewer: playerColor,
    playerColor,
    deadlineAt: null,
    targeting: null,
    specialsUsed: new Set(),
    siegedRooks: new Set(start.siegedRooks ?? []),
    timeline: {
      active: false,
      cues: [],
      playingIds: [],
      attackDying: {},
      hiddenSquares: new Set(),
      moveProgress: {},
      moveLeg: {},
      jumpTrails: [],
      mineMissileTrails: [],
      spentMines: [],
      displayPlacement: null,
      displayKingLives: null,
      displayMines: null,
      displaySiegedRooks: null,
    },
    outcome,
    settledSnapshots: [...snaps],
    settledResolves: [...resolves],
    reviewIndex: 0,
    statusText: "Start",
    lastResolve: null,
    selected: null,
    legalDests: [],
    pendingPromotion: null,
    turnStartChecksApplied: true,
  };
};
