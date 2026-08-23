/**
 * Milestone broadcast seam — the planning clock arms only after the Turn
 * 1 / 11 / 21 bubble is dismissed, and re-entrant armTimer calls (BaseScreen
 * auto-arm effect, TurnBarSidebar onMount) cannot arm underneath the bubble.
 */
import { describe, expect, it } from "vitest";

import { createMatchStore } from "~/app/MatchStoreContext";
import { TURN_BONUS_BROADCAST_MS } from "~/app/turnBonusPolicy";
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
  it("broadcasts Turn 1 and keeps the clock unarmed until dismissed", () => {
    const s1 = ManualScheduler();
    const store = createMatchStore({
      clock: FixedClock(1000),
      scheduler: s1.scheduler,
      turnBonuses: true,
    });
    store.dispatch({ type: "LOAD_SCFEN", scfen: BONUS_BOARD });

    store.armTimer();

    const bonus = store.shell().turnBonus;
    expect(bonus).toEqual({ turn: 1, minerals: 1, gas: 1, seconds: 10 });
    expect(store.shell().deadlineAt).toBeNull();
    expect(s1.pendingCount()).toBe(1);

    // Re-entrant arms (BaseScreen auto-arm effect) must not stack or sneak a deadline.
    store.armTimer();
    store.armTimer();
    expect(store.shell().deadlineAt).toBeNull();
    expect(s1.pendingCount()).toBe(1);

    s1.fire(TURN_BONUS_BROADCAST_MS);
    expect(store.shell().turnBonus).toBeNull();
    expect(store.shell().deadlineAt).toBe(1000 + 10_000);
  });

  it("click-to-skip cancels the pending auto-dismiss and arms immediately", () => {
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

    expect(store.shell().turnBonus).toBeNull();
    expect(store.shell().deadlineAt).toBe(10_000);
    // Auto-dismiss no longer pending — only the armed timeout remains.
    expect(s1.pendingCount()).toBe(1);
    // Idempotent — double clicks are harmless.
    store.dismissTurnBonus();
    expect(store.shell().deadlineAt).toBe(10_000);
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
    s1.fire(TURN_BONUS_BROADCAST_MS); // dismissed → clock armed

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

  it("reducer guards: SHOW rejected off planning, HIDE idempotent, submit clears", () => {
    const s1 = ManualScheduler();
    const store = createMatchStore({
      clock: FixedClock(0),
      scheduler: s1.scheduler,
      turnBonuses: true,
    });
    store.dispatch({ type: "LOAD_SCFEN", scfen: BONUS_BOARD });
    store.armTimer();
    expect(store.state().turnBonus?.turn).toBe(1);

    // Submits are refused mid-broadcast — the turn waits for dismissal.
    store.submitTurn("end");
    expect(store.state().phase).toBe("planning");
    expect(store.state().turnBonus?.turn).toBe(1);

    // HIDE twice is harmless.
    store.dismissTurnBonus();
    expect(store.state().turnBonus).toBeNull();

    // SHOW during resolving / gameOver is rejected by the phase guard.
    store.dispatch({ type: "SUBMIT_TURN", reason: "end" });
    expect(store.state().phase).toBe("resolving");
    store.dispatch({
      type: "SHOW_TURN_BONUS",
      bonus: { turn: 11, minerals: 2, gas: 2, seconds: 15 },
    });
    expect(store.state().turnBonus).toBeNull();
  });
});
