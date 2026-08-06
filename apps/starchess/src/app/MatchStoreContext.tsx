import { createContext, createSignal, useContext, type ParentComponent } from "solid-js";

import type { MatchAction, MatchState } from "~/app/matchTypes";
import { createInitialMatchState, matchReducer } from "~/app/matchReducer";
import type { Clock, Scheduler } from "~/ports";
import { browserClock, browserScheduler } from "~/adapters/browser";
import { playTimeline } from "~/presentation/timeline/timelinePlayer";
import { TURN_TIMEOUT_MS } from "~/presentation/timeline/timings";

export type MatchStore = {
  state: () => MatchState;
  dispatch: (action: MatchAction) => void;
  submitTurn: (reason?: "end" | "timeout") => void;
  armTimer: () => void;
  cancelEffects: () => void;
};

const MatchStoreContext = createContext<MatchStore>();

export const createMatchStore = (opts?: {
  clock?: Clock;
  scheduler?: Scheduler;
  initial?: MatchState;
}): MatchStore => {
  const clock = opts?.clock ?? browserClock;
  const scheduler = opts?.scheduler ?? browserScheduler;
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
    cancelTimer?.();
    const s = state();
    if (s.phase !== "planning" && s.phase !== "targeting") return;
    const at = clock.now() + TURN_TIMEOUT_MS;
    dispatch({ type: "SET_DEADLINE", at });
    cancelTimer = scheduler.delay(TURN_TIMEOUT_MS, () => {
      submitTurn("timeout");
    });
  };

  const submitTurn = (reason: "end" | "timeout" = "end") => {
    cancelTimer?.();
    cancelTimer = null;
    const before = state();
    if (before.phase !== "planning" && before.phase !== "targeting") return;
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
        if (next.phase === "planning") armTimer();
      },
    });
  };

  return { state, dispatch, submitTurn, armTimer, cancelEffects };
};

export const MatchStoreProvider: ParentComponent<{ store: MatchStore }> = (props) => (
  <MatchStoreContext.Provider value={props.store}>{props.children}</MatchStoreContext.Provider>
);

export const useMatchStore = (): MatchStore => {
  const ctx = useContext(MatchStoreContext);
  if (!ctx) throw new Error("useMatchStore requires MatchStoreProvider");
  return ctx;
};
