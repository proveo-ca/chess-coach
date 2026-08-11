import { describe, expect, it } from "vitest";

import {
  createInitialMatchState,
  matchReducer,
  spawnCost,
} from "~/app/matchReducer";

const load = (scfen =
  "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:") =>
  matchReducer(createInitialMatchState(), { type: "LOAD_SCFEN", scfen });

describe("matchReducer action surface", () => {
  it("REMOVE_ACTION undoes queue and specialsUsed", () => {
    let s = load("SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:");
    s = matchReducer(s, {
      type: "QUEUE_ACTION",
      action: {
        timing: "B",
        kind: "pawnDouble",
        color: "w",
        from: "e2",
        to: "e3",
      },
    });
    const seq = s.liveSnapshot.queue!.actions[0]!.seq;
    s = { ...s, specialsUsed: new Set(["e2"]) };
    s = matchReducer(s, { type: "REMOVE_ACTION", seq });
    expect(s.liveSnapshot.queue?.actions ?? []).toHaveLength(0);
    expect(s.specialsUsed.has("e2")).toBe(false);
    const stuck = matchReducer(s, { type: "REMOVE_ACTION", seq: 999 });
    expect(stuck.liveSnapshot.queue?.actions ?? []).toHaveLength(0);
  });

  it("OPEN_* targeting, CANCEL, MARK, APPLY_SNAPSHOT", () => {
    let s = load();
    s = matchReducer(s, { type: "OPEN_SPAWN", unit: "n", color: "w" });
    expect(s.phase).toBe("targeting");
    expect(s.targeting?.kind).toBe("spawn");
    s = matchReducer(s, {
      type: "OPEN_BISHOP_SNIPE",
      from: "c1",
      to: "c8",
      color: "w",
    });
    expect(s.targeting?.kind).toBe("bishopSnipe");
    s = matchReducer(s, {
      type: "OPEN_QUEEN_WARP",
      from: "d1",
      targets: ["d4", "d5"],
      color: "w",
    });
    expect(s.targeting?.kind).toBe("queenWarp");
    s = matchReducer(s, { type: "CANCEL_TARGET" });
    expect(s.phase).toBe("planning");
    s = matchReducer(s, { type: "MARK_SPECIAL_USED", square: "e2" });
    expect(s.specialsUsed.has("e2")).toBe(true);
    s = matchReducer(s, {
      type: "APPLY_SNAPSHOT",
      snapshot: s.liveSnapshot,
    });
    expect(s.phase).toBe("planning");
  });

  it("SPEND / REFUND stored and SET_DEADLINE / CANCEL_EFFECTS", () => {
    let s = load();
    s = { ...s, economies: { w: { stored: 10, deployed: 0 }, b: { stored: 3, deployed: 0 } } };
    s = matchReducer(s, { type: "SPEND_STORED", color: "w", amount: 3 });
    expect(s.economies.w.stored).toBe(7);
    expect(s.economies.w.deployed).toBe(3);
    s = matchReducer(s, { type: "SPEND_STORED", color: "w", amount: 99 });
    expect(s.economies.w.stored).toBe(7);
    s = matchReducer(s, { type: "REFUND_STORED", color: "w", amount: 2 });
    expect(s.economies.w.stored).toBe(9);
    s = matchReducer(s, { type: "SET_DEADLINE", at: 123 });
    expect(s.deadlineAt).toBe(123);
    s = matchReducer(s, { type: "CANCEL_EFFECTS" });
    expect(s.deadlineAt).toBeNull();
    s = matchReducer(s, { type: "SET_VIEWER", viewer: "b" });
    expect(s.viewer).toBe("b");
    s = matchReducer(s, { type: "SET_PLAYER_COLOR", playerColor: "b" });
    expect(s.playerColor).toBe("b");
    expect(spawnCost("n")).toBeGreaterThan(0);
  });

  it("TURN_OPEN is sole beginScTurn path (no-check arm)", () => {
    let s = load();
    expect(s.turnStartChecksApplied).toBe(false);
    s = matchReducer(s, { type: "TURN_OPEN" });
    expect(s.turnStartChecksApplied).toBe(true);
    expect(s.phase).toBe("planning");
    const again = matchReducer(s, { type: "TURN_OPEN" });
    expect(again).toEqual(s);
  });

  it("REFILL_GAS, MARK_CHECKS_APPLIED, BEGIN_CHECKS_DONE, TIMELINE_*", () => {
    let s = load();
    s = matchReducer(s, { type: "REFILL_GAS" });
    expect(s.liveSnapshot.gas.w).toBeGreaterThanOrEqual(0);
    s = matchReducer(s, { type: "MARK_CHECKS_APPLIED" });
    expect(s.turnStartChecksApplied).toBe(true);
    s = matchReducer(s, { type: "BEGIN_CHECKS_DONE" });
    expect(s.phase).toBe("planning");

    s = load();
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
    s = matchReducer(s, {
      type: "TIMELINE_START",
      cues: [
        {
          id: "c1",
          kind: "move",
          piece: "p",
          color: "w",
          from: "e2",
          to: "e4",
        },
      ],
      placement: result.afterPending.placement,
    });
    expect(s.timeline.active).toBe(true);
    s = matchReducer(s, {
      type: "TIMELINE_COMMIT",
      placement: result.next.placement,
    });
    expect(s.timeline.displayPlacement).toBe(result.next.placement);
    s = matchReducer(s, { type: "TIMELINE_SOFT_DONE" });
    expect(s.timeline.active).toBe(false);
    s = {
      ...s,
      lastResolve: result,
      phase: "resolving",
      timeline: { ...s.timeline, active: true },
    };
    s = matchReducer(s, { type: "TIMELINE_DONE" });
    expect(["planning", "gameOver"]).toContain(s.phase);
  });

  it("CLEAR_PENDING_PROMOTION and QUEUE_REJECT", () => {
    let s = load("SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:;b:");
    s = matchReducer(s, {
      type: "SET_PENDING_PROMOTION",
      pending: { color: "w", from: "e7", to: "e8" },
    });
    s = matchReducer(s, { type: "CLEAR_PENDING_PROMOTION" });
    expect(s.pendingPromotion).toBeNull();
    expect(s.phase).toBe("planning");
    s = matchReducer(s, { type: "QUEUE_REJECT", message: "nope" });
    expect(s.statusText).toBe("nope");
  });

  it("SELECT_SQUARE and SET_LEGAL_DESTS", () => {
    let s = load();
    s = matchReducer(s, { type: "SELECT_SQUARE", square: "e2" });
    expect(s.selected).toBe("e2");
    s = matchReducer(s, { type: "SET_LEGAL_DESTS", dests: ["e3", "e4"] });
    expect(s.legalDests).toEqual(["e3", "e4"]);
    s = matchReducer(s, { type: "SELECT_SQUARE", square: null });
    expect(s.selected).toBeNull();
  });
});
