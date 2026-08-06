import { describe, expect, it } from "vitest";

import { matchReducer, createInitialMatchState } from "~/app/matchReducer";

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
  });
});
