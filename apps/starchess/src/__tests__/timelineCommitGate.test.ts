import { describe, expect, it, vi } from "vitest";

import { createTimelineCommitGate } from "~/presentation/timeline/timelineCommitGate";
import type { MatchAction } from "~/types/match";
import type { Scheduler } from "~/types/ports";

const makeScheduler = (): Scheduler & { flush: () => void } => {
  const q: Array<() => void> = [];
  return {
    delay: (_ms, fn) => {
      q.push(fn);
      return () => {
        const i = q.indexOf(fn);
        if (i >= 0) q.splice(i, 1);
      };
    },
    flush: () => {
      while (q.length) q.shift()!();
    },
  };
};

describe("timelineCommitGate", () => {
  it("merges same-turn onCommit into one TIMELINE_COMMIT on delay(0)", () => {
    const actions: MatchAction[] = [];
    const sched = makeScheduler();
    const gate = createTimelineCommitGate((a) => actions.push(a), sched);

    gate.onCommit({ playingIds: ["a1"], hidden: ["e2"] });
    gate.onCommit({ playingIds: ["a1", "d1"], moveProgress: { a1: 0 } });
    expect(actions).toEqual([]);

    sched.flush();
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      type: "TIMELINE_COMMIT",
      playingIds: ["a1", "d1"],
      hidden: ["e2"],
      moveProgress: { a1: 0 },
    });
  });

  it("flush before onStart drains pending then START", () => {
    const actions: MatchAction[] = [];
    const sched = makeScheduler();
    const gate = createTimelineCommitGate((a) => actions.push(a), sched);

    gate.onCommit({ playingIds: ["x"] });
    gate.onStart([{ id: "m1", kind: "move", piece: "p", color: "w", from: "e2", to: "e4" }], "8/8/8/8/8/8/8/8");
    expect(actions.map((a) => a.type)).toEqual(["TIMELINE_COMMIT", "TIMELINE_START"]);
    expect((actions[0] as { playingIds?: string[] }).playingIds).toEqual(["x"]);
  });

  it("flush is sync and clears the delayed schedule", () => {
    const actions: MatchAction[] = [];
    const sched = makeScheduler();
    const gate = createTimelineCommitGate((a) => actions.push(a), sched);

    gate.onCommit({ playingIds: ["a"] });
    gate.flush();
    expect(actions).toHaveLength(1);
    sched.flush();
    expect(actions).toHaveLength(1);
  });

  it("cancel drops pending and ignores further commits", () => {
    const actions: MatchAction[] = [];
    const sched = makeScheduler();
    const gate = createTimelineCommitGate((a) => actions.push(a), sched);

    gate.onCommit({ playingIds: ["a"] });
    gate.cancel();
    gate.onCommit({ playingIds: ["b"] });
    sched.flush();
    gate.flush();
    expect(actions).toEqual([]);
  });

  it("last-write-wins per field", () => {
    const dispatch = vi.fn();
    const sched = makeScheduler();
    const gate = createTimelineCommitGate(dispatch, sched);
    gate.onCommit({ placement: "a", playingIds: ["1"] });
    gate.onCommit({ placement: "b" });
    gate.flush();
    expect(dispatch).toHaveBeenCalledWith({
      type: "TIMELINE_COMMIT",
      placement: "b",
      playingIds: ["1"],
    });
  });
});
