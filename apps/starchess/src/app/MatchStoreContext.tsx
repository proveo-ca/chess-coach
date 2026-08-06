import { createContext, createSignal, useContext, type ParentComponent } from "solid-js";

import type { MatchAction, MatchState } from "~/app/matchTypes";
import { createInitialMatchState, matchReducer } from "~/app/matchReducer";
import type { Clock, Scheduler } from "~/ports";
import { browserClock, browserScheduler } from "~/adapters/browser";
import { beginScTurn } from "@chess-coach/starchess-core";
import { playTimeline } from "~/presentation/timeline/timelinePlayer";
import { TURN_TIMEOUT_MS } from "~/presentation/timeline/timings";

export type MatchStore = {
  state: () => MatchState;
  dispatch: (action: MatchAction) => void;
  submitTurn: (reason?: "end" | "timeout") => void;
  armTimer: () => void;
  /** Resolve turn-open king-checks before intent; then arm timer when requested. */
  ensureTurnOpenChecks: (opts?: { armTimer?: boolean }) => void;
  cancelEffects: () => void;
};

const MatchStoreContext = createContext<MatchStore>();

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
  let cancelTimeline: (() => void) | null = null;
  let cancelTimer: (() => void) | null = null;

  const dispatch = (action: MatchAction) => {
    setState((s) => matchReducer(s, action));
  };

  const cancelEffects = () => {
    cancelTimeline?.();
    cancelTimeline = null;
    cancelTimer?.();
    cancelTimer = null;
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
    const at = clock.now() + TURN_TIMEOUT_MS;
    dispatch({ type: "SET_DEADLINE", at });
    cancelTimer = scheduler.delay(TURN_TIMEOUT_MS, () => {
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
      dispatch({ type: "MARK_CHECKS_APPLIED" });
      if (opts?.armTimer) armTimer();
      return;
    }

    if (!begun.changed || !begun.asResolve) {
      dispatch({ type: "MARK_CHECKS_APPLIED" });
      if (opts?.armTimer) armTimer();
      return;
    }

    cancelTimer?.();
    cancelTimer = null;
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
      },
    });
  };

  return {
    state,
    dispatch,
    submitTurn,
    armTimer,
    ensureTurnOpenChecks,
    cancelEffects,
  };
};

export const MatchStoreProvider: ParentComponent<{ store: MatchStore }> = (props) => (
  <MatchStoreContext.Provider value={props.store}>{props.children}</MatchStoreContext.Provider>
);

export const useMatchStore = (): MatchStore => {
  const ctx = useContext(MatchStoreContext);
  if (!ctx) throw new Error("useMatchStore requires MatchStoreProvider");
  return ctx;
};
