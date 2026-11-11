import { createRoot } from "solid-js";
import { describe, expect, it } from "vitest";

import { createMatchStore } from "~/app/MatchStoreContext";
import { PROMOTION_CLEAN_SCFEN } from "~/app/seeds";
import type { Scheduler } from "~/types/ports";

const trackingScheduler = () => {
  const live = new Set<symbol>();
  const scheduler: Scheduler = {
    delay: () => {
      const id = Symbol();
      live.add(id);
      return () => live.delete(id);
    },
  };
  return { scheduler, live };
};

describe("createMatchStore disposal", () => {
  it("disposing the owner cancels the armed turn timeout", () => {
    const { scheduler, live } = trackingScheduler();
    const dispose = createRoot((d) => {
      const store = createMatchStore({ clock: { now: () => 0 }, scheduler });
      store.dispatch({ type: "LOAD_SCFEN", scfen: PROMOTION_CLEAN_SCFEN, stored: 4 });
      store.armTimer();
      return d;
    });
    expect(live.size).toBeGreaterThan(0);
    dispose();
    expect(live.size).toBe(0);
  });
});

describe("createMatchStore submitTurnNextTask", () => {
  const setup = () => {
    const { scheduler, live } = trackingScheduler();
    const store = createMatchStore({ clock: { now: () => 0 }, scheduler, autoArmTimer: false });
    store.dispatch({ type: "LOAD_SCFEN", scfen: PROMOTION_CLEAN_SCFEN, stored: 4 });
    return { store, live };
  };

  it("a lesson reload (cancelEffects) drops a pending auto-end submit", () => {
    const { store, live } = setup();
    store.submitTurnNextTask();
    expect(live.size).toBe(1);
    store.cancelEffects();
    expect(live.size).toBe(0);
  });

  it("a second request replaces the first instead of queuing two submits", () => {
    const { store, live } = setup();
    store.submitTurnNextTask();
    store.submitTurnNextTask();
    expect(live.size).toBe(1);
  });
});
