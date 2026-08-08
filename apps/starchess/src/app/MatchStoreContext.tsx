/**
 * Match store — Solid signal + reducer; timeline / timer / DualNav review runners.
 * // SPEC: _spec/apps/starchess/match-store.puml
 * // SPEC: _spec/apps/starchess/animation-pipeline.md
 */
import {
  createContext,
  createSignal,
  useContext,
  type ParentComponent,
} from "solid-js";
import {
  beginScTurn,
  turnTimeoutMsForTurn,
  type EndScTurnResult,
  type ScAction,
} from "@chess-coach/starchess-core";

import type { MatchAction, MatchState, MatchStore } from "~/types/match";
import { createInitialMatchState, matchReducer } from "~/app/matchReducer";
import type { Clock, Scheduler } from "~/types/ports";
import { browserClock, browserScheduler } from "~/adapters/browser";
import { classicalActionsFromResolve } from "~/presentation/hud/classicalActionsFromResolve";
import {
  isCheckOnlyResolve,
  previousTurnStartIndex,
} from "~/presentation/hud/isCheckOnlyResolve";
import { playReviewTurn } from "~/presentation/hud/playReviewTurn";
import type { ReviewTurnPhase } from "~/types/review";
import { playTimeline } from "~/presentation/timeline/timelinePlayer";
import {
  playResolveWave,
} from "~/presentation/timeline/playResolveWave";
import type { ResolveWaveId } from "~/types/tutorial";

export type { MatchStore };

export const MatchStoreContext = createContext<MatchStore>();

const playOneResolve = (
  result: NonNullable<MatchState["lastResolve"]>,
  dispatch: (a: MatchAction) => void,
  scheduler: Scheduler,
  setCancel: (fn: (() => void) | null) => void,
): Promise<void> =>
  new Promise((resolve) => {
    dispatch({ type: "REVIEW_PLAY", result });
    const cancel = playTimeline(result, scheduler, {
      onStart: (cues, placement) =>
        dispatch({ type: "TIMELINE_START", cues, placement }),
      onCommit: (patch) => dispatch({ type: "TIMELINE_COMMIT", ...patch }),
      onDone: () => {
        dispatch({ type: "TIMELINE_DONE" });
        setCancel(null);
        resolve();
      },
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
}): MatchStore => {
  const clock = opts?.clock ?? browserClock;
  const scheduler = opts?.scheduler ?? browserScheduler;
  const autoArmTimer = opts?.autoArmTimer !== false;
  const [state, setState] = createSignal<MatchState>(
    opts?.initial ?? createInitialMatchState(),
  );
  const [reviewPhase, setReviewPhase] = createSignal<ReviewTurnPhase>("start");
  const [reviewIntentActions, setReviewIntentActions] = createSignal<
    readonly ScAction[] | null
  >(null);
  let cancelTimeline: (() => void) | null = null;
  let cancelTimer: (() => void) | null = null;
  let cancelReviewTurn: (() => void) | null = null;
  let reviewBusy = false;
  /** Settled index when the in-flight one-arrow turn began. */
  let reviewTurnStart = 0;

  const dispatch = (action: MatchAction) => {
    setState((s) => matchReducer(s, action));
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
    clearReviewIntent();
    dispatch({ type: "CANCEL_EFFECTS" });
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

    let begun;
    try {
      begun = beginScTurn(s.liveSnapshot);
    } catch {
      dispatch({ type: "REFILL_GAS" });
      dispatch({ type: "MARK_CHECKS_APPLIED" });
      if (opts?.armTimer) armTimer();
      return;
    }

    if (!begun.changed || !begun.asResolve) {
      // No standing checks — still refill at turn open before planning arms.
      dispatch({ type: "REFILL_GAS" });
      dispatch({ type: "MARK_CHECKS_APPLIED" });
      if (opts?.armTimer) armTimer();
      return;
    }

    cancelTimer?.();
    cancelTimer = null;
    // Refill when the check chip starts (not after End resolve).
    dispatch({ type: "REFILL_GAS" });
    dispatch({ type: "RESOLVE_READY", result: begun.asResolve });
    cancelTimeline?.();
    cancelTimeline = playTimeline(begun.asResolve, scheduler, {
      onStart: (cues, placement) =>
        dispatch({ type: "TIMELINE_START", cues, placement }),
      onCommit: (patch) => dispatch({ type: "TIMELINE_COMMIT", ...patch }),
      onDone: () => {
        dispatch({ type: "BEGIN_CHECKS_DONE" });
        const next = state();
        if (next.phase === "planning" && opts?.armTimer) armTimer();
        if (next.phase === "gameOver") syncReviewPhaseIdle();
      },
    });
  };

  const submitTurn = (reason: "end" | "timeout" = "end") => {
    cancelTimer?.();
    cancelTimer = null;
    const before = state();
    if (before.phase !== "planning" && before.phase !== "targeting") return;
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
    cancelTimeline = playTimeline(result, scheduler, {
      onStart: (cues, placement) =>
        dispatch({ type: "TIMELINE_START", cues, placement }),
      onCommit: (patch) => dispatch({ type: "TIMELINE_COMMIT", ...patch }),
      onDone: () => {
        dispatch({ type: "TIMELINE_DONE" });
        const next = state();
        if (next.phase === "planning") {
          ensureTurnOpenChecks({ armTimer: autoArmTimer });
        }
        if (next.phase === "gameOver") syncReviewPhaseIdle();
      },
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
        setReviewIntentActions(classicalActionsFromResolve(endResult));
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
      cancelTimeline = playResolveWave(
        result,
        waveId,
        scheduler,
        {
          onStart: (cues, placement) =>
            dispatch({ type: "TIMELINE_START", cues, placement }),
          onCommit: (patch) => dispatch({ type: "TIMELINE_COMMIT", ...patch }),
          onDone: () => {
            if (isLast) dispatch({ type: "TIMELINE_DONE" });
            else dispatch({ type: "TIMELINE_SOFT_DONE" });
            cancelTimeline = null;
            resolve();
          },
        },
        { isLastWave: isLast },
      );
    });

  const playReviewResolve = (result: EndScTurnResult): Promise<void> =>
    playOneResolve(result, dispatch, scheduler, (fn) => {
      cancelTimeline = fn;
    });

  return {
    state,
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
