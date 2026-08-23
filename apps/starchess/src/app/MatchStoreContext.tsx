// SPEC: _spec/apps/starchess/match-store.puml, _spec/apps/starchess/animation-pipeline.md, _spec/apps/starchess/core/turn/playback-interpreter.puml, _spec/apps/starchess/core/turn/turn-bonus-broadcast.puml, _spec/apps/starchess/core/engine-boundary.puml, _spec/apps/starchess/architecture/timeline-perf.puml
/**
 * Match store — Solid signal + reducer; timeline / timer / DualNav review runners.
 */
import {
  createContext,
  createSignal,
  useContext,
  type ParentComponent,
} from "solid-js";
import {
  turnTimeoutMsForTurn,
  type EndScTurnResult,
  type ScAction,
} from "@chess-coach/starchess-core";

import type {
  MatchAction,
  MatchShell,
  MatchState,
  MatchStore,
  TimelineState,
} from "~/types/match";
import { createInitialMatchState, matchReducer } from "~/app/matchReducer";
import type { Clock, Scheduler } from "~/types/ports";
import { browserClock, browserScheduler } from "~/adapters/browser";
import { perfNoteDispatch, perfNoteMatch } from "~/debug/perfMonitor";
import {
  isCheckOnlyResolve,
  previousTurnStartIndex,
} from "~/presentation/hud/isCheckOnlyResolve";
import { playReviewTurn } from "~/presentation/hud/playReviewTurn";
import type { ReviewTurnPhase } from "~/types/review";
import { playTimeline } from "~/presentation/timeline/timelinePlayer";
import { bindTimeline } from "~/presentation/timeline/timelineCommitGate";
import {
  playResolveWave,
} from "~/presentation/timeline/playResolveWave";
import { TURN_BONUS_BROADCAST_MS, turnBonusFor } from "~/app/turnBonusPolicy";
import type { ResolveWaveId } from "~/types/tutorial";

export type { MatchStore };

export const MatchStoreContext = createContext<MatchStore>();

const toShell = (s: MatchState): MatchShell => {
  const { timeline: _t, ...shell } = s;
  return shell;
};

const shellShallowEqual = (a: MatchShell, b: MatchShell): boolean => {
  const keys = Object.keys(a) as (keyof MatchShell)[];
  if (keys.length !== (Object.keys(b) as (keyof MatchShell)[]).length) return false;
  for (const k of keys) {
    if (!Object.is(a[k], b[k])) return false;
  }
  return true;
};

/** playTimeline + commit gate; cancel drops pending flush + player. */
const runTimeline = (
  result: EndScTurnResult,
  dispatch: (a: MatchAction) => void,
  scheduler: Scheduler,
  onDone: () => void,
): (() => void) => {
  const { callbacks, cancelGate } = bindTimeline(dispatch, scheduler, onDone);
  const cancelPlayer = playTimeline(result, scheduler, callbacks);
  return () => {
    cancelGate();
    cancelPlayer();
  };
};

const playOneResolve = (
  result: NonNullable<MatchState["lastResolve"]>,
  dispatch: (a: MatchAction) => void,
  scheduler: Scheduler,
  setCancel: (fn: (() => void) | null) => void,
): Promise<void> =>
  new Promise((resolve) => {
    dispatch({ type: "REVIEW_PLAY", result });
    const cancel = runTimeline(result, dispatch, scheduler, () => {
      dispatch({ type: "TIMELINE_DONE" });
      setCancel(null);
      resolve();
    });
    setCancel(cancel);
  });

export const createMatchStore = (opts?: {
  clock?: Clock;
  scheduler?: Scheduler;
  initial?: MatchState;
  /**
   * When false, never schedule the planning timeout after a resolve
   * (`TIMELINE_DONE` / begin-checks). Storybook `fast` fixtures use an
   * immediate scheduler — arming would microtask-loop timeout → End forever.
   */
  autoArmTimer?: boolean;
  turnBonuses?: boolean;
}): MatchStore => {
  const clock = opts?.clock ?? browserClock;
  const scheduler = opts?.scheduler ?? browserScheduler;
  const autoArmTimer = opts?.autoArmTimer !== false;
  const turnBonusesEnabled = opts?.turnBonuses === true;
  const initial = opts?.initial ?? createInitialMatchState();
  const [shell, setShell] = createSignal<MatchShell>(toShell(initial));
  const [timeline, setTimeline] = createSignal<TimelineState>(initial.timeline);
  const state = (): MatchState => ({ ...shell(), timeline: timeline() });
  const [reviewPhase, setReviewPhase] = createSignal<ReviewTurnPhase>("start");
  const [reviewIntentActions, setReviewIntentActions] = createSignal<
    readonly ScAction[] | null
  >(null);
  let cancelTimeline: (() => void) | null = null;
  let cancelTimer: (() => void) | null = null;
  let cancelBonusDelay: (() => void) | null = null;
  let cancelReviewTurn: (() => void) | null = null;
  let reviewBusy = false;
  /** Settled index when the in-flight one-arrow turn began. */
  let reviewTurnStart = 0;

  const dispatch = (action: MatchAction) => {
    perfNoteDispatch(action.type);
    const prev = state();
    const next = matchReducer(prev, action);
    perfNoteMatch(next.phase, next.timeline.active);
    if (next === prev) return;
    const nextShell = toShell(next);
    if (!shellShallowEqual(shell(), nextShell)) setShell(nextShell);
    if (timeline() !== next.timeline) setTimeline(next.timeline);
  };

  const clearReviewIntent = () => setReviewIntentActions(null);

  const syncReviewPhaseIdle = () => {
    const s = state();
    const max = Math.max(0, s.settledSnapshots.length - 1);
    if (s.phase !== "gameOver") {
      setReviewPhase("start");
      clearReviewIntent();
      return;
    }
    if (s.reviewIndex >= max) setReviewPhase("final");
    else if (s.reviewIndex <= 0) setReviewPhase("start");
    else setReviewPhase("start");
    clearReviewIntent();
  };

  const cancelEffects = () => {
    cancelReviewTurn?.();
    cancelReviewTurn = null;
    reviewBusy = false;
    cancelTimeline?.();
    cancelTimeline = null;
    cancelTimer?.();
    cancelTimer = null;
    cancelBonusDelay?.();
    cancelBonusDelay = null;
    clearReviewIntent();
    dispatch({ type: "CANCEL_EFFECTS" });
  };

  const dismissTurnBonus = () => {
    cancelBonusDelay?.();
    cancelBonusDelay = null;
    if (!state().turnBonus) return;
    dispatch({ type: "HIDE_TURN_BONUS" });
    armTimer();
  };

  const armTimer = () => {
    if (!autoArmTimer) return;
    cancelTimer?.();
    const s = state();
    if (s.phase !== "planning" && s.phase !== "targeting") return;
    if (!s.turnStartChecksApplied) {
      ensureTurnOpenChecks({ armTimer: true });
      return;
    }
    if (turnBonusesEnabled) {
      if (s.turnBonus) return;
      const bonus = turnBonusFor(s.liveSnapshot.turn);
      if (bonus && s.lastAnnouncedBonusTurn < bonus.turn) {
        dispatch({ type: "SHOW_TURN_BONUS", bonus });
        cancelBonusDelay?.();
        cancelBonusDelay = scheduler.delay(TURN_BONUS_BROADCAST_MS, () => {
          cancelBonusDelay = null;
          dismissTurnBonus();
        });
        return;
      }
    }
    const timeoutMs = turnTimeoutMsForTurn(s.liveSnapshot.turn);
    const at = clock.now() + timeoutMs;
    dispatch({ type: "SET_DEADLINE", at });
    cancelTimer = scheduler.delay(timeoutMs, () => {
      submitTurn("timeout");
    });
  };

  const ensureTurnOpenChecks = (opts?: { armTimer?: boolean }) => {
    const s = state();
    if (s.phase !== "planning" && s.phase !== "targeting") return;
    if (s.turnStartChecksApplied) {
      if (opts?.armTimer) armTimer();
      return;
    }

    // Sole engine write for turn-open — reducer owns beginScTurn.
    dispatch({ type: "TURN_OPEN" });
    const after = state();
    if (after.turnStartChecksApplied) {
      if (opts?.armTimer) armTimer();
      return;
    }
    const result = after.lastResolve;
    if (!result || after.phase !== "resolving") {
      if (opts?.armTimer) armTimer();
      return;
    }

    cancelTimer?.();
    cancelTimer = null;
    cancelTimeline?.();
    cancelTimeline = runTimeline(result, dispatch, scheduler, () => {
      dispatch({ type: "BEGIN_CHECKS_DONE" });
      const next = state();
      if (next.phase === "planning" && opts?.armTimer) armTimer();
      if (next.phase === "gameOver") syncReviewPhaseIdle();
    });
  };

  const submitTurn = (reason: "end" | "timeout" = "end") => {
    cancelTimer?.();
    cancelTimer = null;
    const before = state();
    if (before.phase !== "planning" && before.phase !== "targeting") return;
    if (before.turnBonus) return;
    if (!before.turnStartChecksApplied) {
      ensureTurnOpenChecks();
      // If checks are animating, defer submit until planning re-opens.
      if (state().phase === "resolving") return;
    }
    dispatch({ type: "SUBMIT_TURN", reason });
    const after = state();
    const result = after.lastResolve;
    if (!result) return;
    cancelTimeline?.();
    cancelTimeline = runTimeline(result, dispatch, scheduler, () => {
      dispatch({ type: "TIMELINE_DONE" });
      const next = state();
      if (next.phase === "planning") {
        ensureTurnOpenChecks({ armTimer: autoArmTimer });
      }
      if (next.phase === "gameOver") syncReviewPhaseIdle();
    });
  };

  const reviewBack = () => {
    const s = state();
    if (s.phase !== "gameOver") return;
    if (reviewBusy || s.timeline.active) {
      cancelReviewTurn?.();
      cancelReviewTurn = null;
      cancelTimeline?.();
      cancelTimeline = null;
      reviewBusy = false;
      clearReviewIntent();
      dispatch({ type: "CANCEL_EFFECTS" });
      dispatch({ type: "REVIEW_SEEK", index: reviewTurnStart });
      syncReviewPhaseIdle();
      return;
    }
    if (s.reviewIndex <= 0) {
      syncReviewPhaseIdle();
      return;
    }
    const idx = previousTurnStartIndex(s.reviewIndex, s.settledResolves);
    dispatch({ type: "REVIEW_SEEK", index: idx });
    syncReviewPhaseIdle();
  };

  const reviewForward = () => {
    const s0 = state();
    if (s0.phase !== "gameOver") return;
    if (reviewBusy || s0.timeline.active) return;
    const max = s0.settledSnapshots.length - 1;
    if (s0.reviewIndex >= max) return;

    const startIndex = s0.reviewIndex;
    const first = s0.settledResolves[startIndex];
    if (!first) {
      dispatch({ type: "REVIEW_SEEK", index: startIndex + 1 });
      syncReviewPhaseIdle();
      return;
    }

    reviewBusy = true;
    reviewTurnStart = startIndex;
    // Turn open — refill before check/intent (matches live ensureTurnOpenChecks).
    dispatch({ type: "REFILL_GAS" });
    const setCancel = (fn: (() => void) | null) => {
      cancelTimeline = fn;
    };

    const endResult =
      isCheckOnlyResolve(first) && s0.settledResolves[startIndex + 1]
        ? s0.settledResolves[startIndex + 1]!
        : isCheckOnlyResolve(first)
          ? null
          : first;

    cancelReviewTurn = playReviewTurn({
      onPhase: (phase) => setReviewPhase(phase),
      playChecks: isCheckOnlyResolve(first)
        ? () => playOneResolve(first, dispatch, scheduler, setCancel)
        : undefined,
      showIntent: () => {
        if (!endResult) {
          clearReviewIntent();
          return;
        }
        // Stamped planning Q: on EndScTurnResult (SCFen) — no reconstruct.
        setReviewIntentActions(endResult.queue);
      },
      playResolve: async () => {
        clearReviewIntent();
        if (!endResult) return;
        // After check TIMELINE_DONE, reviewIndex is startIndex+1; End plays there.
        // If no check, reviewIndex is still startIndex.
        const idx = state().reviewIndex;
        const result = state().settledResolves[idx];
        if (!result || isCheckOnlyResolve(result)) {
          // Check-only terminal (king died on check) — already settled by playChecks.
          return;
        }
        await playOneResolve(result, dispatch, scheduler, setCancel);
      },
      onDone: () => {
        reviewBusy = false;
        cancelReviewTurn = null;
        syncReviewPhaseIdle();
      },
    });
  };

  const reviewShowIntent = (actions: readonly ScAction[] | null) => {
    setReviewIntentActions(actions);
  };

  const reviewSetPhase = (phase: ReviewTurnPhase) => {
    setReviewPhase(phase);
  };

  const playReviewResolveWave = (
    result: EndScTurnResult,
    waveId: ResolveWaveId,
    opts?: { isLastWave?: boolean },
  ): Promise<void> =>
    new Promise((resolve) => {
      dispatch({ type: "REVIEW_PLAY", result });
      const isLast = opts?.isLastWave ?? false;
      const { callbacks, cancelGate } = bindTimeline(dispatch, scheduler, () => {
        if (isLast) dispatch({ type: "TIMELINE_DONE" });
        else dispatch({ type: "TIMELINE_SOFT_DONE" });
        cancelTimeline = null;
        resolve();
      });
      const cancelPlayer = playResolveWave(result, waveId, scheduler, callbacks, {
        isLastWave: isLast,
      });
      cancelTimeline = () => {
        cancelGate();
        cancelPlayer();
      };
    });

  const playReviewResolve = (result: EndScTurnResult): Promise<void> =>
    playOneResolve(result, dispatch, scheduler, (fn) => {
      cancelTimeline = fn;
    });

  return {
    state,
    shell,
    timeline,
    dispatch,
    submitTurn,
    armTimer,
    ensureTurnOpenChecks,
    reviewBack,
    reviewForward,
    reviewPhase,
    reviewIntentActions,
    reviewShowIntent,
    reviewSetPhase,
    playReviewResolveWave,
    playReviewResolve,
    dismissTurnBonus,
    cancelEffects,
  };
};

export const MatchStoreProvider: ParentComponent<{ store: MatchStore }> = (
  props,
) => (
  <MatchStoreContext.Provider value={props.store}>
    {props.children}
  </MatchStoreContext.Provider>
);

export const useMatchStore = (): MatchStore => {
  const ctx = useContext(MatchStoreContext);
  if (!ctx) throw new Error("useMatchStore requires MatchStoreProvider");
  return ctx;
};
