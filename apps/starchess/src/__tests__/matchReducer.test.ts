import { describe, expect, it } from "vitest";

import {
  matchReducer,
  createInitialMatchState,
  createMatchStateFromScfen,
} from "~/app/matchReducer";

describe("matchReducer", () => {
  it("loads SCFEN into planning", () => {
    const next = matchReducer(createInitialMatchState(), {
      type: "LOAD_SCFEN",
      scfen: "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
    });
    expect(next.phase).toBe("planning");
    expect(next.liveSnapshot.placement).toBe("4k3/8/8/8/8/8/4P3/4K3");
    expect(next.settledSnapshots).toHaveLength(1);
  });

  it("createMatchStateFromScfen seeds King Hunt live before mount", () => {
    const s = createMatchStateFromScfen(
      "SCFEN|8/8/8/2N5/4k3/8/7B/7K|0|33|P|G:11:11|Q:w:;b:",
      1,
    );
    expect(s.phase).toBe("planning");
    expect(s.liveSnapshot.placement).toBe("8/8/8/2N5/4k3/8/7B/7K");
    expect(s.economies.w.stored).toBe(1);
    expect(s.turnStartChecksApplied).toBe(false);
    expect(s.deadlineAt).toBeNull();
  });

  it("queues classical and submits into resolving", () => {
    let s = matchReducer(createInitialMatchState(), {
      type: "LOAD_SCFEN",
      scfen: "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
    });
    s = matchReducer(s, {
      type: "QUEUE_ACTION",
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e2",
        to: "e4",
      },
    });
    expect(s.liveSnapshot.queue?.actions).toHaveLength(1);
    s = matchReducer(s, { type: "SUBMIT_TURN", reason: "end" });
    expect(s.phase).toBe("resolving");
    expect(s.lastResolve).toBeTruthy();
  });

  it("no-ops SUBMIT_TURN while resolving", () => {
    let s = matchReducer(createInitialMatchState(), {
      type: "LOAD_SCFEN",
      scfen: "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
    });
    s = matchReducer(s, { type: "SUBMIT_TURN", reason: "end" });
    const again = matchReducer(s, { type: "SUBMIT_TURN", reason: "end" });
    expect(again).toEqual(s);
  });

  it("TIMELINE_DONE enters gameOver on phase O", () => {
    let s = matchReducer(createInitialMatchState(), {
      type: "LOAD_SCFEN",
      scfen: "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
    });
    s = matchReducer(s, {
      type: "QUEUE_ACTION",
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e2",
        to: "e4",
      },
    });
    s = matchReducer(s, { type: "SUBMIT_TURN", reason: "end" });
    const result = s.lastResolve!;
    expect(result).toBeTruthy();
    s = {
      ...s,
      lastResolve: {
        ...result,
        next: { ...result.next, phase: "O", kingLives: { w: 3, b: 0 } },
      },
    };
    s = matchReducer(s, { type: "TIMELINE_DONE" });
    expect(s.phase).toBe("gameOver");
    expect(s.outcome?.winner).toBe("w");
    expect(s.settledSnapshots.length).toBeGreaterThanOrEqual(2);
    expect(s.reviewIndex).toBe(s.settledSnapshots.length - 1);
  });

  it("REVIEW_SEEK clamps and restores settled history labels", () => {
    let s = matchReducer(createInitialMatchState(), {
      type: "LOAD_SCFEN",
      scfen: "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
    });
    s = {
      ...s,
      phase: "gameOver",
      settledSnapshots: [
        s.liveSnapshot,
        { ...s.liveSnapshot, placement: "4k3/8/8/8/8/8/8/4K3", turn: 1 },
        {
          ...s.liveSnapshot,
          placement: "4k3/8/8/8/8/8/8/4K3",
          turn: 2,
          phase: "O",
          kingLives: { w: 3, b: 0 },
        },
      ],
      settledResolves: [],
      reviewIndex: 2,
      outcome: { winner: "w" },
    };
    s = matchReducer(s, { type: "REVIEW_SEEK", index: 0 });
    expect(s.reviewIndex).toBe(0);
    expect(s.statusText).toBe("Start");
    s = matchReducer(s, { type: "REVIEW_SEEK", index: 1 });
    expect(s.reviewIndex).toBe(1);
    expect(s.statusText).toBe("Turn 1 of 2");
    s = matchReducer(s, { type: "REVIEW_SEEK", index: 99 });
    expect(s.reviewIndex).toBe(2);
    expect(s.statusText).toBe("Final");
  });

  it("timeout with open promotion modal defaults to queen", () => {
    let s = matchReducer(createInitialMatchState(), {
      type: "LOAD_SCFEN",
      scfen: "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:",
    });
    s = { ...s, turnStartChecksApplied: true };
    s = matchReducer(s, {
      type: "SET_PENDING_PROMOTION",
      pending: { color: "w", from: "e7", to: "e8" },
    });
    expect(s.pendingPromotion).toEqual({ color: "w", from: "e7", to: "e8" });
    expect(s.phase).toBe("targeting");

    s = matchReducer(s, { type: "SUBMIT_TURN", reason: "timeout" });
    expect(s.phase).toBe("resolving");
    expect(s.pendingPromotion).toBeNull();
    expect(s.lastResolve?.resolved.promotions).toEqual([
      expect.objectContaining({ at: "e8", unit: "q", color: "w" }),
    ]);
  });
});
