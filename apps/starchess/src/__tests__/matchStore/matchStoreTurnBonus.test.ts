/**
 * Milestone broadcast seam — the Turn 1 / 11 / 21 bubble rides the whole
 * planning window: the clock arms immediately underneath it, submits go
 * through, and the bubble clears when the turn ends (or on click).
 */
import { describe, expect, it } from "vitest";

import { createMatchStore } from "~/app/MatchStoreContext";
import type { Clock, Scheduler } from "~/types/ports";

const FixedClock = (t = 0): Clock => ({ now: () => t });

type Job = { at: number; fn: () => void; cancelled: boolean };

const ManualScheduler = () => {
  const jobs: Job[] = [];
  const scheduler: Scheduler = {
    delay: (ms, fn) => {
      const job: Job = { at: ms, fn, cancelled: false };
      jobs.push(job);
      return () => {
        job.cancelled = true;
      };
    },
  };
  return {
    scheduler,
    fire: (at: number) => {
      for (const j of jobs.splice(0)) {
        if (!j.cancelled && j.at === at) j.fn();
      }
    },
    pendingCount: () => jobs.filter((j) => !j.cancelled).length,
  };
};

const BONUS_BOARD =
  "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
const MID_BOARD =
  "SCFEN|4k3/8/8/8/8/8/4P3/4K3|5|33|P|G:11:11|B:8:8|Q:w:;b:";

describe("createMatchStore turnBonuses", () => {
  it("broadcasts Turn 1 and arms the clock underneath it", () => {
    const s1 = ManualScheduler();
    const store = createMatchStore({
      clock: FixedClock(1000),
      scheduler: s1.scheduler,
      turnBonuses: true,
    });
    store.dispatch({ type: "LOAD_SCFEN", scfen: BONUS_BOARD });

    store.armTimer();

    expect(store.shell().turnBonus).toEqual({ turn: 1, minerals: 1, gas: 1, seconds: 10 });
    expect(store.shell().deadlineAt).toBe(1000 + 10_000);
    // Only the planning timeout — no auto-dismiss job.
    expect(s1.pendingCount()).toBe(1);

    // Re-entrant arms (BaseScreen auto-arm effect) keep the bubble, never stack jobs.
    store.armTimer();
    store.armTimer();
    expect(store.shell().turnBonus?.turn).toBe(1);
    expect(s1.pendingCount()).toBe(1);
  });

  it("the bubble stays up for the whole planning window", () => {
    const s1 = ManualScheduler();
    const store = createMatchStore({
      clock: FixedClock(0),
      scheduler: s1.scheduler,
      turnBonuses: true,
    });
    store.dispatch({ type: "LOAD_SCFEN", scfen: BONUS_BOARD });
    store.armTimer();

    s1.fire(3000); // the old broadcast window — nothing scheduled there
    expect(store.shell().turnBonus?.turn).toBe(1);
    expect(store.state().phase).toBe("planning");
  });

  it("click-to-skip hides the bubble and leaves the running clock alone", () => {
    const s1 = ManualScheduler();
    const store = createMatchStore({
      clock: FixedClock(0),
      scheduler: s1.scheduler,
      turnBonuses: true,
    });
    store.dispatch({ type: "LOAD_SCFEN", scfen: BONUS_BOARD });
    store.armTimer();

    store.dismissTurnBonus();

    expect(store.shell().turnBonus).toBeNull();
    expect(store.shell().deadlineAt).toBe(10_000);
    expect(s1.pendingCount()).toBe(1);
    // Idempotent — double clicks are harmless.
    store.dismissTurnBonus();
    expect(store.shell().deadlineAt).toBe(10_000);
  });

  it("ending the turn clears the bubble", () => {
    const s1 = ManualScheduler();
    const store = createMatchStore({
      clock: FixedClock(0),
      scheduler: s1.scheduler,
      turnBonuses: true,
    });
    store.dispatch({ type: "LOAD_SCFEN", scfen: BONUS_BOARD });
    store.armTimer();
    expect(store.state().turnBonus?.turn).toBe(1);

    store.submitTurn("end");

    expect(store.state().phase).toBe("resolving");
    expect(store.state().turnBonus).toBeNull();
  });

  it("the planning timeout also clears the bubble", () => {
    const s1 = ManualScheduler();
    const store = createMatchStore({
      clock: FixedClock(0),
      scheduler: s1.scheduler,
      turnBonuses: true,
    });
    store.dispatch({ type: "LOAD_SCFEN", scfen: BONUS_BOARD });
    store.armTimer();

    s1.fire(10_000);

    expect(store.state().phase).toBe("resolving");
    expect(store.state().turnBonus).toBeNull();
  });

  it("broadcasts each milestone once per match", () => {
    const s1 = ManualScheduler();
    const store = createMatchStore({
      clock: FixedClock(0),
      scheduler: s1.scheduler,
      turnBonuses: true,
    });
    store.dispatch({ type: "LOAD_SCFEN", scfen: BONUS_BOARD });

    store.armTimer();
    expect(store.shell().turnBonus?.turn).toBe(1);
    store.dismissTurnBonus();

    // Post-resolve re-arm on the same displayed tier (raw turn 0 → 1) must
    // not broadcast Turn 1 twice.
    store.armTimer();

    const after = store.state();
    expect(after.phase).toBe("planning");
    expect(after.turnBonus).toBeNull();
    expect(after.lastAnnouncedBonusTurn).toBe(1);
    expect(s1.pendingCount()).toBe(1); // only the armed timeout
  });

  it("arms directly between milestones", () => {
    const s1 = ManualScheduler();
    const store = createMatchStore({
      clock: FixedClock(500),
      scheduler: s1.scheduler,
      turnBonuses: true,
    });
    store.dispatch({ type: "LOAD_SCFEN", scfen: MID_BOARD });

    store.armTimer();

    expect(store.shell().turnBonus).toBeNull();
    expect(store.shell().deadlineAt).toBe(500 + 10_000);
    expect(s1.pendingCount()).toBe(1);
  });

  it("never broadcasts when the opt-in flag is absent (tutorial / review)", () => {
    const s1 = ManualScheduler();
    const store = createMatchStore({
      clock: FixedClock(0),
      scheduler: s1.scheduler,
    });
    store.dispatch({ type: "LOAD_SCFEN", scfen: BONUS_BOARD });

    store.armTimer();

    expect(store.shell().turnBonus).toBeNull();
    expect(store.shell().deadlineAt).toBe(10_000);
  });

  it("reducer guards: SHOW rejected off planning", () => {
    const s1 = ManualScheduler();
    const store = createMatchStore({
      clock: FixedClock(0),
      scheduler: s1.scheduler,
      turnBonuses: true,
    });
    store.dispatch({ type: "LOAD_SCFEN", scfen: BONUS_BOARD });
    store.dispatch({ type: "SUBMIT_TURN", reason: "end" });
    expect(store.state().phase).toBe("resolving");

    store.dispatch({
      type: "SHOW_TURN_BONUS",
      bonus: { turn: 11, minerals: 2, gas: 2, seconds: 15 },
    });
    expect(store.state().turnBonus).toBeNull();
  });
});
