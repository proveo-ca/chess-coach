// SPEC: _spec/apps/starchess/match-store.puml, _spec/apps/starchess/animation-pipeline.md, _spec/apps/starchess/core/turn/playback-interpreter.puml, _spec/apps/starchess/core/turn/turn-bonus-broadcast.puml, _spec/apps/starchess/core/engine-boundary.puml, _spec/apps/starchess/architecture/timeline-perf.puml, _spec/apps/starchess/architecture/reactivity/app-screens.md
/**
 * Match store — Solid signal + reducer; timeline / timer / DualNav review runners.
 */
import {
  batch,
  createContext,
  createMemo,
  createRoot,
  createSignal,
  getOwner,
  onCleanup,
  untrack,
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
import { createShellFields } from "~/app/shellFields";
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
import { turnBonusFor } from "~/app/turnBonusPolicy";
import { canSubmit, displayedSnapshotFrom, registerDisplayedSnapshot } from "~/app/selectors";
import { sameFlat } from "~/presentation/board/memoEquals";
import type { ResolveWaveId } from "~/types/tutorial";

export type { MatchStore };

export const MatchStoreContext = createContext<MatchStore>();

const toShell = (s: MatchState): MatchShell => {
  const { timeline: _t, ...shell } = s;
  return shell;
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
  autoArmTimer?: boolean | (() => boolean | undefined);
  turnBonuses?: boolean;
}): MatchStore => {
  const clock = opts?.clock ?? browserClock;
  const scheduler = opts?.scheduler ?? browserScheduler;
  const autoArmOpt = opts?.autoArmTimer;
  const autoArmTimer = (): boolean =>
    (typeof autoArmOpt === "function" ? untrack(autoArmOpt) : autoArmOpt) !== false;
  const turnBonusesEnabled = opts?.turnBonuses === true;
  const initial = opts?.initial ?? createInitialMatchState();
  const shellFields = createShellFields<MatchShell>(toShell(initial));
  const shell = (): MatchShell => shellFields.view;
  const [timeline, setTimeline] = createSignal<TimelineState>(initial.timeline);
  const state = (): MatchState => ({ ...shellFields.view, timeline: timeline() });
  const peek = (): MatchState => ({ ...shellFields.read(), timeline: untrack(timeline) });
  const [reviewPhase, setReviewPhase] = createSignal<ReviewTurnPhase>("start");
  const [reviewIntentActions, setReviewIntentActions] = createSignal<
    readonly ScAction[] | null
  >(null);
  let cancelTimeline: (() => void) | null = null;
  let cancelTimer: (() => void) | null = null;
  let cancelReviewTurn: (() => void) | null = null;
  let cancelDeferredSubmit: (() => void) | null = null;
  let cancelArmWhenIdle: (() => void) | null = null;
  let reviewBusy = false;
  /** Settled index when the in-flight one-arrow turn began. */
  let reviewTurnStart = 0;

  const dispatch = (action: MatchAction) => {
    perfNoteDispatch(action.type);
    const prev = peek();
    const next = matchReducer(prev, action);
    perfNoteMatch(next.phase, next.timeline.active);
    if (next === prev) return;
    batch(() => {
      shellFields.write(toShell(next));
      if (untrack(timeline) !== next.timeline) setTimeline(next.timeline);
    });
    if (action.type === "LOAD_SCFEN") armWhenIdle();
  };

  const clearReviewIntent = () => setReviewIntentActions(null);

  const syncReviewPhaseIdle = () => {
    const s = peek();
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
    cancelDeferredSubmit?.();
    cancelDeferredSubmit = null;
    cancelArmWhenIdle?.();
    cancelArmWhenIdle = null;
    clearReviewIntent();
    dispatch({ type: "CANCEL_EFFECTS" });
  };

  const dismissTurnBonus = () => {
    if (!peek().turnBonus) return;
    dispatch({ type: "HIDE_TURN_BONUS" });
  };

  const armTimer = () => {
    cancelArmWhenIdle?.();
    cancelArmWhenIdle = null;
    if (!autoArmTimer()) return;
    cancelTimer?.();
    const s = peek();
    if (s.phase !== "planning" && s.phase !== "targeting") return;
    if (!s.turnStartChecksApplied) {
      ensureTurnOpenChecks({ armTimer: true });
      return;
    }
    if (turnBonusesEnabled) {
      const bonus = turnBonusFor(s.liveSnapshot.turn);
      if (bonus && s.lastAnnouncedBonusTurn < bonus.turn) {
        dispatch({ type: "SHOW_TURN_BONUS", bonus });
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
    const s = peek();
    if (s.phase !== "planning" && s.phase !== "targeting") return;
    if (s.turnStartChecksApplied) {
      if (opts?.armTimer) armTimer();
      return;
    }

    // Sole engine write for turn-open — reducer owns beginScTurn.
    dispatch({ type: "TURN_OPEN" });
    const after = peek();
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
      const next = peek();
      if (next.phase === "planning" && opts?.armTimer) armTimer();
      if (next.phase === "gameOver") syncReviewPhaseIdle();
    });
  };

  const armWhenIdle = () => {
    cancelArmWhenIdle?.();
    cancelArmWhenIdle = null;
    if (!autoArmTimer()) return;
    cancelArmWhenIdle = scheduler.delay(0, () => {
      cancelArmWhenIdle = null;
      const s = peek();
      if (s.deadlineAt == null && !s.timeline.active) armTimer();
    });
  };

  const submitTurnNextTask = () => {
    cancelDeferredSubmit?.();
    cancelDeferredSubmit = scheduler.delay(0, () => {
      cancelDeferredSubmit = null;
      if (canSubmit(peek())) submitTurn("end");
    });
  };

  const submitTurn = (reason: "end" | "timeout" = "end") => {
    cancelTimer?.();
    cancelTimer = null;
    const before = peek();
    if (before.phase !== "planning" && before.phase !== "targeting") return;
    // The clock must not pick a BattleShip while the promotion modal is open.
    // A click on Tank would otherwise lose the race and resolve as BattleShip.
    if (reason === "timeout" && before.pendingPromotion) {
      armTimer();
      return;
    }
    if (!before.turnStartChecksApplied) {
      ensureTurnOpenChecks();
      // If checks are animating, defer submit until planning re-opens.
      if (peek().phase === "resolving") return;
    }
    dispatch({ type: "SUBMIT_TURN", reason });
    const after = peek();
    const result = after.lastResolve;
    if (!result) return;
    cancelTimeline?.();
    cancelTimeline = runTimeline(result, dispatch, scheduler, () => {
      dispatch({ type: "TIMELINE_DONE" });
      const next = peek();
      if (next.phase === "planning") {
        ensureTurnOpenChecks({ armTimer: autoArmTimer() });
      }
      if (next.phase === "gameOver") syncReviewPhaseIdle();
    });
  };

  const reviewBack = () => {
    const s = peek();
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
    const s0 = peek();
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
        const idx = peek().reviewIndex;
        const result = peek().settledResolves[idx];
        if (!result || isCheckOnlyResolve(result)) {
          // Check-only terminal (Command Center died on check) — already settled by playChecks.
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

  const store: MatchStore = {
    state,
    shell,
    timeline,
    dispatch,
    submitTurn,
    submitTurnNextTask,
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

  const disposeDisplayed = createRoot((dispose) => {
    registerDisplayedSnapshot(
      store,
      createMemo(() => displayedSnapshotFrom(shellFields.view, timeline()), undefined, {
        equals: sameFlat,
      }),
    );
    return dispose;
  });
  armWhenIdle();
  if (getOwner()) {
    onCleanup(() => {
      cancelReviewTurn?.();
      cancelTimeline?.();
      cancelTimer?.();
      cancelDeferredSubmit?.();
      cancelArmWhenIdle?.();
      disposeDisplayed();
    });
  }
  return store;
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
