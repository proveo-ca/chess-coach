/**
 * Regression: ImmediateScheduler + post-resolve armTimer used to microtask-loop
 * timeout → empty End → TIMELINE_DONE → arm forever (Promotion story hang).
 */
import { describe, expect, it } from "vitest";

import { createMatchStore } from "~/app/MatchStoreContext";
import type { Clock, Scheduler } from "~/types/ports";
import { PROMOTION_CLEAN_SCFEN } from "~/app/seeds";

const FixedClock = (t = 0): Clock => ({ now: () => t });

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

const flushMicrotasks = async (rounds = 20) => {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
};

describe("createMatchStore autoArmTimer", () => {
  it("does not timeout-loop after autoEnd when autoArmTimer is false", async () => {
    const store = createMatchStore({
      clock: FixedClock(1_000_000),
      scheduler: ImmediateScheduler,
      autoArmTimer: false,
    });
    store.dispatch({
      type: "LOAD_SCFEN",
      scfen: PROMOTION_CLEAN_SCFEN,
      stored: 12,
    });
    store.dispatch({
      type: "QUEUE_ACTION",
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e7",
        to: "e8",
        promotion: "q",
      },
    });
    store.submitTurn("end");
    await flushMicrotasks(40);

    const s = store.state();
    expect(s.phase).toBe("planning");
    // One End advanced turn 1 → 2; a timeout loop would keep climbing.
    expect(s.liveSnapshot.turn).toBe(2);
    expect(s.liveSnapshot.placement).toContain("Q");
    expect(s.deadlineAt).toBeNull();
  });

  it("does not stamp a battleship when the clock fires with the picker open", () => {
    const store = createMatchStore({
      clock: FixedClock(1_000_000),
      scheduler: ImmediateScheduler,
      autoArmTimer: false,
    });
    store.dispatch({
      type: "LOAD_SCFEN",
      scfen: PROMOTION_CLEAN_SCFEN,
      stored: 12,
    });
    const before = store.state().liveSnapshot.placement;
    store.dispatch({
      type: "SET_PENDING_PROMOTION",
      pending: { color: "w", from: "e7", to: "e8" },
    });
    store.submitTurn("timeout");
    const s = store.state();
    expect(s.pendingPromotion).toEqual({ color: "w", from: "e7", to: "e8" });
    expect(s.phase).toBe("targeting");
    expect(s.liveSnapshot.placement).toBe(before);
  });
});
