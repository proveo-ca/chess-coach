/**
 * Phase 4 terminal history — settled snapshots + REVIEW_SEEK scrubbing.
 * Exit gate: scrub all settled positions without mutating the final match.
 */
import { describe, expect, it } from "vitest";

import {
  createInitialMatchState,
  createMatchStateFromScfen,
  matchReducer,
} from "~/app/matchReducer";
import {
  canSubmit,
  displayedSnapshot,
  isTerminal,
  outcomeLabel,
} from "~/app/selectors";
import type { MatchState } from "~/types/match";
import type { ScFenSnapshot } from "@chess-coach/starchess-core";

const baseSnap = (over: Partial<ScFenSnapshot> = {}): ScFenSnapshot => ({
  placement: "4k3/8/8/8/8/8/4P3/4K3",
  turn: 0,
  ccLives: { w: 3, b: 3 },
  phase: "P",
  gas: { w: 1, b: 1 },
  gasIncome: { w: 1, b: 1 },
  ...over,
});

const terminalState = (): MatchState => {
  let s = matchReducer(createInitialMatchState(), {
    type: "LOAD_SCFEN",
    scfen: "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
  });
  const start = s.liveSnapshot;
  const mid = baseSnap({
    placement: "4k3/8/8/8/8/4P3/8/4K3",
    turn: 1,
    specialsUsed: ["e3"],
    siegedTanks: [],
  });
  const end = baseSnap({
    placement: "4k3/8/8/8/8/8/8/4K3",
    turn: 2,
    phase: "O",
    ccLives: { w: 3, b: 0 },
  });
  return {
    ...s,
    phase: "gameOver",
    liveSnapshot: end,
    outcome: { winner: "w" },
    settledSnapshots: [start, mid, end],
    settledResolves: [],
    reviewIndex: 2,
    deadlineAt: null,
    targeting: null,
    selected: null,
    legalDests: [],
  };
};

describe("Phase 4 terminal history", () => {
  it("seeds settledSnapshots with the initial position on load", () => {
    const s = matchReducer(createInitialMatchState(), {
      type: "LOAD_SCFEN",
      scfen: "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
    });
    expect(s.settledSnapshots).toHaveLength(1);
    expect(s.settledSnapshots[0]).toEqual(s.liveSnapshot);
    expect(s.reviewIndex).toBe(0);
  });

  it("appends exactly one settled snapshot per TIMELINE_DONE; End is idempotent while resolving / gameOver", () => {
    let s = matchReducer(createInitialMatchState(), {
      type: "LOAD_SCFEN",
      scfen: "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
    });
    expect(s.settledSnapshots).toHaveLength(1);
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
    expect(s.phase).toBe("resolving");
    const result = s.lastResolve!;
    const whileResolving = matchReducer(s, { type: "SUBMIT_TURN", reason: "timeout" });
    expect(whileResolving).toEqual(s);

    s = matchReducer(s, { type: "TIMELINE_DONE" });
    expect(s.settledSnapshots).toHaveLength(2);
    expect(s.settledSnapshots[1]?.placement).toBe(result.next.placement);
    expect(s.settledResolves).toHaveLength(1);
    expect(s.settledResolves[0]).toBe(result);

    // Force terminal and ensure End / timeout cannot append again.
    s = {
      ...s,
      phase: "gameOver",
      outcome: { winner: "w" },
      liveSnapshot: { ...s.liveSnapshot, phase: "O", ccLives: { w: 3, b: 0 } },
    };
    const afterEnd = matchReducer(s, { type: "SUBMIT_TURN", reason: "end" });
    const afterTimeout = matchReducer(s, { type: "SUBMIT_TURN", reason: "timeout" });
    expect(afterEnd).toEqual(s);
    expect(afterTimeout).toEqual(s);
    expect(afterEnd.settledSnapshots).toHaveLength(2);
  });

  it("terminal deep link keeps DualNav bounds (one snapshot, both disabled)", () => {
    const s = createMatchStateFromScfen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|30|O|G:11:11|Q:w:;b:",
    );
    expect(s.phase).toBe("gameOver");
    expect(s.settledSnapshots).toHaveLength(1);
    expect(s.reviewIndex).toBe(0);
    expect(s.reviewIndex <= 0).toBe(true);
    expect(s.reviewIndex >= s.settledSnapshots.length - 1).toBe(true);
  });

  it("REVIEW_SEEK never mutates liveSnapshot or outcome", () => {
    const s0 = terminalState();
    const live = s0.liveSnapshot;
    const outcome = s0.outcome;
    const settled = s0.settledSnapshots.map((x) => ({ ...x }));

    let s = matchReducer(s0, { type: "REVIEW_SEEK", index: 0 });
    expect(s.liveSnapshot).toEqual(live);
    expect(s.outcome).toEqual(outcome);
    expect(s.phase).toBe("gameOver");
    expect(s.settledSnapshots).toEqual(settled);
    expect(displayedSnapshot(s).placement).toBe(settled[0]!.placement);

    s = matchReducer(s, { type: "REVIEW_SEEK", index: 1 });
    expect(s.liveSnapshot).toEqual(live);
    expect(displayedSnapshot(s).placement).toBe(settled[1]!.placement);
    // Arm marks stay empty under review — snap U: is display-only via snapshot.
    expect(s.specialsUsed.size).toBe(0);
    expect(s.statusText).toBe("Turn 1 of 2");

    s = matchReducer(s, { type: "REVIEW_SEEK", index: 2 });
    expect(s.statusText).toBe("Final");
    expect(displayedSnapshot(s).phase).toBe("O");
    expect(outcomeLabel(s)).toBe("White wins");
  });

  it("terminal match rejects board mutations (canSubmit / queue)", () => {
    const s0 = terminalState();
    expect(isTerminal(s0)).toBe(true);
    expect(canSubmit(s0)).toBe(false);
    const queued = matchReducer(s0, {
      type: "QUEUE_ACTION",
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e2",
        to: "e4",
      },
    });
    // Reducer may no-op or reject — liveSnapshot must stay terminal.
    expect(queued.liveSnapshot).toEqual(s0.liveSnapshot);
    expect(queued.phase).toBe("gameOver");
    expect(queued.settledSnapshots).toEqual(s0.settledSnapshots);
  });

  it("REVIEW_SEEK is a no-op outside gameOver", () => {
    const s = matchReducer(createInitialMatchState(), {
      type: "LOAD_SCFEN",
      scfen: "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
    });
    const next = matchReducer(s, { type: "REVIEW_SEEK", index: 0 });
    expect(next).toEqual(s);
  });

  it("clamps cursor at both ends", () => {
    let s = terminalState();
    s = matchReducer(s, { type: "REVIEW_SEEK", index: -5 });
    expect(s.reviewIndex).toBe(0);
    expect(s.statusText).toBe("Start");
    s = matchReducer(s, { type: "REVIEW_SEEK", index: 99 });
    expect(s.reviewIndex).toBe(2);
    expect(s.statusText).toBe("Final");
  });

  it("REVIEW_PLAY + timeline keeps gameOver and advances cursor without mutating live", () => {
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
    s = matchReducer(s, { type: "TIMELINE_DONE" });
    // Pretend the match ended so DualNav review owns the chrome.
    s = {
      ...s,
      phase: "gameOver",
      outcome: { winner: "w" },
      liveSnapshot: { ...s.liveSnapshot, phase: "O", ccLives: { w: 3, b: 0 } },
      reviewIndex: 0,
      statusText: "Start",
    };
    const live = s.liveSnapshot;
    const settledLen = s.settledSnapshots.length;

    s = matchReducer(s, { type: "REVIEW_PLAY", result });
    expect(s.phase).toBe("gameOver");
    expect(s.lastResolve).toBe(result);

    s = matchReducer(s, {
      type: "TIMELINE_START",
      cues: [],
      placement: result.afterPending.placement,
    });
    expect(s.phase).toBe("gameOver");
    expect(s.timeline.active).toBe(true);

    s = matchReducer(s, {
      type: "TIMELINE_COMMIT",
      placement: result.next.placement,
      ccLives: result.next.ccLives,
    });
    expect(s.liveSnapshot).toEqual(live);
    expect(s.timeline.displayPlacement).toBe(result.next.placement);
    expect(displayedSnapshot(s).placement).toBe(result.next.placement);

    s = matchReducer(s, { type: "TIMELINE_DONE" });
    expect(s.phase).toBe("gameOver");
    expect(s.liveSnapshot).toEqual(live);
    expect(s.settledSnapshots).toHaveLength(settledLen);
    expect(s.reviewIndex).toBe(1);
    expect(s.timeline.active).toBe(false);
    expect(s.lastResolve).toBeNull();
  });
});
