/**
 * Build terminal DualNav history the same way live play records it:
 * optional beginScTurn check ply, then End resolve — so MatchStore
 * reviewForward/Back can replay without a parallel harness.
 */
import {
  UNIT_COST,
  beginScTurn,
  endScTurn,
  incomeForTurn,
  refillTurnGas,
  scOutcome,
  type EndScTurnResult,
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import {
  OPENING_STORED_MATERIAL,
  reconstructStoredBanks,
} from "~/app/matchEconomy";
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
const withBank = (
  snap: ScFenSnapshot,
  bank: NonNullable<ScFenSnapshot["stored"]>,
): ScFenSnapshot => ({ ...snap, stored: { ...bank } });

export const buildReviewHistory = (args: BuildReviewHistoryArgs): ReviewHistory => {
  const includeChecks = args.includeTurnOpenChecks !== false;
  const opening = args.start.stored ?? {
    w: OPENING_STORED_MATERIAL,
    b: OPENING_STORED_MATERIAL,
  };
  let bank = { ...opening };
  let cur = withBank(args.start, bank);
  const settledSnapshots: ScFenSnapshot[] = [cur];
  const settledResolves: EndScTurnResult[] = [];

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
        const next = withBank(begun.next, bank);
        settledSnapshots.push(next);
        cur = next;
        if (cur.phase === "O") break;
      } else {
        cur = withBank(begun?.next ?? refillTurnGas(cur), bank);
      }
    } else {
      cur = withBank(refillTurnGas(cur), bank);
    }

    const queued = args.queueStep(cur, i);
    // Spawn spends (B/F spawn) debit bank before End — keep SCFEN `B:` in sync.
    for (const a of queued.queue?.actions ?? []) {
      if (a.kind === "spawn" && a.unit) {
        const cost = UNIT_COST[a.unit];
        const c = a.color;
        bank = {
          ...bank,
          [c]: Math.max(0, bank[c] - cost),
        };
      }
    }
    const result = endScTurn(queued, { skipTurnStartChecks: true });
    settledResolves.push(result);
    // Income lands when the wire turn advances (same as live TIMELINE_DONE).
    if (result.next.turn > cur.turn) {
      const inc = incomeForTurn(Math.max(1, result.next.turn));
      bank = {
        w: Math.min(12, bank.w + inc),
        b: Math.min(12, bank.b + inc),
      };
    }
    const next = withBank(result.next, bank);
    settledSnapshots.push(next);
    cur = next;
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
  const stored = opts?.stored ?? OPENING_STORED_MATERIAL;
  const playerColor = opts?.playerColor ?? "w";
  const snaps = history.settledSnapshots;
  const resolves = history.settledResolves;
  if (snaps.length === 0) return createInitialMatchState();

  const live = snaps[snaps.length - 1]!;
  const start = snaps[0]!;
  const outcome = live.phase === "O" ? scOutcome(live) : null;

  const base = createInitialMatchState();
  // Prefer SCFEN `B:` when present; legacy history rebuilds spends from
  // deployed-material deltas (old replays never stored the bank).
  const stampedSnaps = reconstructStoredBanks(snaps, stored);
  const stampedLive = stampedSnaps[stampedSnaps.length - 1]!;
  return {
    ...base,
    phase: "gameOver",
    liveSnapshot: stampedLive,
    economies: {
      w: { stored: stampedLive.stored?.w ?? stored, deployed: 0 },
      b: { stored: stampedLive.stored?.b ?? stored, deployed: 0 },
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
    settledSnapshots: stampedSnaps,
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
