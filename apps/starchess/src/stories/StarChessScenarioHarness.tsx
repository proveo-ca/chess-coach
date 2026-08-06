import type { ParentComponent } from "solid-js";
import { onMount } from "solid-js";

import type { ScActionInput } from "@chess-coach/starchess-core";

import { createMatchStore, MatchStoreProvider, useMatchStore } from "~/app/MatchStoreContext";
import { StarChessScreen } from "~/app/StarChessScreen";
import type { Clock, Scheduler } from "~/ports";

export type ScenarioFixture = {
  scfen: string;
  stored?: number;
  fog?: boolean;
  /** Optional queued actions applied after load (production QUEUE_ACTION path). */
  queue?: readonly ScActionInput[];
  /** Auto-submit after queue. */
  autoEnd?: boolean;
  /** Deterministic scheduler delay multiplier (0 = flush ASAP via 0ms). */
  fast?: boolean;
};

const ImmediateScheduler: Scheduler = {
  delay: (_ms, fn) => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) fn();
    });
    return () => {
      cancelled = true;
    };
  },
};

const FixedClock = (t = 0): Clock => ({ now: () => t });

/**
 * One harness for production screen + Storybook/demo fixtures.
 * Always goes through match dispatch / submitTurn (no alternate resolvers).
 */
export const StarChessScenarioHarness: ParentComponent<{
  fixture: ScenarioFixture;
}> = (props) => {
  const scheduler = props.fixture.fast ? ImmediateScheduler : undefined;
  const store = createMatchStore({
    clock: FixedClock(1_000_000),
    scheduler,
  });

  onMount(() => {
    store.dispatch({
      type: "LOAD_SCFEN",
      scfen: props.fixture.scfen,
      stored: props.fixture.stored ?? 12,
    });
    for (const action of props.fixture.queue ?? []) {
      store.dispatch({ type: "QUEUE_ACTION", action });
    }
    if (props.fixture.autoEnd) {
      store.submitTurn("end");
    }
  });

  return (
    <MatchStoreProvider store={store}>
      <StarChessScreen fog={props.fixture.fog} armTimer={false} />
      {props.children}
    </MatchStoreProvider>
  );
};

/** Imperative helper for stories that need to queue after mount. */
export const HarnessControls: ParentComponent = (props) => {
  const store = useMatchStore();
  return (
    <div style={{ "margin-top": "0.75rem", display: "flex", gap: "0.5rem" }}>
      <button type="button" onClick={() => store.submitTurn("end")}>
        End turn
      </button>
      {props.children}
    </div>
  );
};
