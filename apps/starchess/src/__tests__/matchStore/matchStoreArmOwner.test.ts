import { describe, expect, it } from "vitest";

import { createMatchStore } from "~/app/MatchStoreContext";
import { PROMOTION_CLEAN_SCFEN } from "~/app/seeds";
import type { Scheduler } from "~/types/ports";

type Job = { ms: number; fn: () => void; live: boolean };

const manual = () => {
  const jobs: Job[] = [];
  const scheduler: Scheduler = {
    delay: (ms, fn) => {
      const job = { ms, fn, live: true };
      jobs.push(job);
      return () => {
        job.live = false;
      };
    },
  };
  const pending = () => jobs.filter((j) => j.live);
  const runZeroDelay = () => {
    for (const j of pending().filter((j) => j.ms === 0)) {
      j.live = false;
      j.fn();
    }
  };
  return { scheduler, pending, runZeroDelay };
};

const create = (autoArmTimer?: boolean) => {
  const m = manual();
  const store = createMatchStore({ clock: { now: () => 0 }, scheduler: m.scheduler, autoArmTimer });
  return { store, ...m };
};

describe("createMatchStore owns turn-timer arming", () => {
  it("arms one task after LOAD_SCFEN, without a screen effect", () => {
    const { store, runZeroDelay } = create();
    store.dispatch({ type: "LOAD_SCFEN", scfen: PROMOTION_CLEAN_SCFEN, stored: 4 });
    expect(store.shell().deadlineAt).toBeNull();
    runZeroDelay();
    expect(store.shell().deadlineAt).not.toBeNull();
  });

  it("never arms when autoArmTimer is false", () => {
    const { store, runZeroDelay, pending } = create(false);
    store.dispatch({ type: "LOAD_SCFEN", scfen: PROMOTION_CLEAN_SCFEN, stored: 4 });
    runZeroDelay();
    expect(store.shell().deadlineAt).toBeNull();
    expect(pending()).toHaveLength(0);
  });

  it("an explicit arm supersedes the pending idle arm; at most one timeout is pending", () => {
    const { store, runZeroDelay, pending } = create();
    store.dispatch({ type: "LOAD_SCFEN", scfen: PROMOTION_CLEAN_SCFEN, stored: 4 });
    store.armTimer();
    store.armTimer();
    runZeroDelay();
    expect(pending().filter((j) => j.ms > 0)).toHaveLength(1);
    expect(pending().filter((j) => j.ms === 0)).toHaveLength(0);
  });

  it("cancelEffects drops a pending idle arm", () => {
    const { store, runZeroDelay } = create();
    store.dispatch({ type: "LOAD_SCFEN", scfen: PROMOTION_CLEAN_SCFEN, stored: 4 });
    store.cancelEffects();
    runZeroDelay();
    expect(store.shell().deadlineAt).toBeNull();
  });
});

describe("createMatchStore loadLesson", () => {
  it("drops in-flight effects, re-seeds, and applies the gas override in one batch", () => {
    const { store, pending, runZeroDelay } = create();
    store.dispatch({ type: "LOAD_SCFEN", scfen: PROMOTION_CLEAN_SCFEN, stored: 4 });
    runZeroDelay();
    store.submitTurnNextTask();
    const deadlineJobs = pending().length;
    expect(deadlineJobs).toBeGreaterThan(0);
    store.loadLesson({ scfen: PROMOTION_CLEAN_SCFEN, stored: 2, gas: 9 });
    const s = store.shell();
    expect(s.deadlineAt).toBeNull();
    expect(s.liveSnapshot.gas[s.viewer]).toBe(3);
    expect(pending().filter((j) => j.ms > 0)).toHaveLength(0);
    expect(pending().filter((j) => j.ms === 0)).toHaveLength(1);
  });
});

describe("createMatchStore view", () => {
  it("reads the viewer, their stored minerals and this window's used specials", () => {
    const { store } = create(false);
    store.dispatch({ type: "LOAD_SCFEN", scfen: PROMOTION_CLEAN_SCFEN, stored: 4 });
    const s = store.shell();
    expect(store.view.viewerColor()).toBe(s.viewer);
    expect(store.view.storedMaterial()).toBe(s.economies[s.viewer].stored);
    expect(store.view.specialUsed("e2")).toBe(false);
    store.dispatch({ type: "MARK_SPECIAL_USED", square: "e2" });
    expect(store.view.specialUsed("e2")).toBe(true);
  });
});
