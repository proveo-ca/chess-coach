// SPEC: _spec/apps/starchess/match-store.puml
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
        kind: "stimStep",
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

  it("REMOVE_ACTION refunds Command-Center deploy minerals", () => {
    let s = load("SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:");
    s = { ...s, economies: { w: { stored: 4, deployed: 0 }, b: { stored: 4, deployed: 0 } } };
    // Mirror the board-input spawn flow: spend minerals, then queue the spawn.
    s = matchReducer(s, { type: "SPEND_STORED", color: "w", amount: 3 });
    expect(s.planningMineralSpend.w).toBe(3);
    s = matchReducer(s, {
      type: "QUEUE_ACTION",
      action: {
        timing: "B",
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "d1",
        unit: "b",
      },
    });
    expect(s.economies.w.stored).toBe(1);
    expect(s.economies.w.deployed).toBe(3);
    const seq = s.liveSnapshot.queue!.actions[0]!.seq;
    s = matchReducer(s, { type: "REMOVE_ACTION", seq });
    expect(s.liveSnapshot.queue?.actions ?? []).toHaveLength(0);
    expect(s.economies.w.stored).toBe(4);
    expect(s.economies.w.deployed).toBe(0);
    expect(s.planningMineralSpend.w).toBe(0);
    // Removing a non-spawn action never touches the bank.
    const again = matchReducer(s, { type: "REMOVE_ACTION", seq: 999 });
    expect(again.economies.w.stored).toBe(4);
  });

  it("REMOVE_ACTION preserves the paid deployment and bank when its newborn move depends on it", () => {
    let s = load("SCFEN|4kb2/8/8/8/8/8/8/4K3|11|33|P|G:22:22|B:6:6|Q:w:;b:");
    const cost = spawnCost("n");
    s = matchReducer(s, { type: "SPEND_STORED", color: "b", amount: cost });
    s = matchReducer(s, { type: "QUEUE_ACTION", action: {
      timing: "B", kind: "deploy", color: "b", from: "e8", to: "f8", unit: "n",
    } });
    s = matchReducer(s, { type: "QUEUE_ACTION", action: {
      timing: "C", kind: "classical", color: "b", from: "f8", to: "h7",
    } });
    expect(s.liveSnapshot.queue!.actions).toHaveLength(2);
    const [deploy, move] = s.liveSnapshot.queue!.actions;
    const before = structuredClone({
      snapshot: s.liveSnapshot, economies: s.economies, spend: s.planningMineralSpend,
      specialsUsed: s.specialsUsed, statusText: s.statusText,
    });
    const rejected = matchReducer(s, { type: "REMOVE_ACTION", seq: deploy!.seq });
    expect(rejected).toBe(s);
    expect({
      snapshot: rejected.liveSnapshot, economies: rejected.economies, spend: rejected.planningMineralSpend,
      specialsUsed: rejected.specialsUsed, statusText: rejected.statusText,
    }).toEqual(before);
    expect(rejected.economies.b).toEqual({ stored: 6 - cost, deployed: cost });
    expect(rejected.planningMineralSpend.b).toBe(cost);
    s = matchReducer(rejected, { type: "REMOVE_ACTION", seq: move!.seq });
    expect(s.economies.b).toEqual({ stored: 6 - cost, deployed: cost });
    expect(s.planningMineralSpend.b).toBe(cost);
    s = matchReducer(s, { type: "REMOVE_ACTION", seq: deploy!.seq });
    expect(s.liveSnapshot.queue!.actions).toEqual([]);
    expect(s.economies.b).toEqual({ stored: 6, deployed: 0 });
    expect(s.planningMineralSpend.b).toBe(0);
    expect(s.liveSnapshot.gas.b).toBe(2);
    expect(s.liveSnapshot.stored?.b).toBe(6);
  });

  it("REMOVE_ACTION does not refund a seed-imported queued spawn", () => {
    // A deep-link seed carries the spawn on the queue but never debited the
    // bank — refunding it would inflate the bank.
    let s = load(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:01:11|Q:w:B=deploy:e1:d1:p;b:",
    );
    const seq = s.liveSnapshot.queue!.actions[0]!.seq;
    expect(s.economies.w.stored).toBe(3);
    s = matchReducer(s, { type: "REMOVE_ACTION", seq });
    expect(s.liveSnapshot.queue?.actions ?? []).toHaveLength(0);
    expect(s.economies.w.stored).toBe(3);
  });

  it("refunds never cross colors or inflate the bank (ledger is per-side)", () => {
    // Seed queues an UNPAID white deploy p (e1→d1) while the black side spends
    // and queues its own Mecha deploy. Removing the white spawn must not pull
    // from black's ledger, and black's own removal must refund fully.
    let s = load(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:01:11|B:4:4|Q:w:B=deploy:e1:d1:p;b:",
    );
    const whiteSeq = s.liveSnapshot.queue!.actions[0]!.seq;
    s = matchReducer(s, { type: "SPEND_STORED", color: "b", amount: 3 });
    s = matchReducer(s, {
      type: "QUEUE_ACTION",
      action: {
        timing: "B",
        kind: "deploy",
        color: "b",
        from: "e8",
        to: "d8",
        unit: "b",
      },
    });
    expect(s.economies.b.stored).toBe(1);
    const blackSeq = s.liveSnapshot.queue!.actions[1]!.seq;

    s = matchReducer(s, { type: "REMOVE_ACTION", seq: whiteSeq });
    expect(s.economies.w.stored).toBe(4);
    expect(s.economies.b.stored).toBe(1);

    s = matchReducer(s, { type: "REMOVE_ACTION", seq: blackSeq });
    expect(s.economies.b.stored).toBe(4);
    expect(s.economies.b.deployed).toBe(0);
    expect(s.planningMineralSpend.b).toBe(0);
  });

  it("TURN_OPEN resets the mineral-spend ledger for the next window", () => {
    let s = load();
    s = matchReducer(s, { type: "SPEND_STORED", color: "w", amount: 2 });
    expect(s.planningMineralSpend.w).toBe(2);
    s = matchReducer(s, { type: "TURN_OPEN" });
    expect(s.planningMineralSpend.w).toBe(0);
    expect(s.planningMineralSpend.b).toBe(0);
  });

  it("OPEN_* targeting, CANCEL, MARK, APPLY_SNAPSHOT", () => {
    let s = load();
    s = matchReducer(s, { type: "OPEN_SPAWN", unit: "n", color: "w" });
    expect(s.phase).toBe("targeting");
    expect(s.targeting?.kind).toBe("deploy");
    s = matchReducer(s, {
      type: "OPEN_MECHA_SNIPE",
      from: "c1",
      targets: ["b2", "d2"],
      color: "w",
    });
    expect(s.targeting?.kind).toBe("charonMissiles");
    s = matchReducer(s, {
      type: "OPEN_BATTLESHIP_WARP",
      from: "d1",
      targets: ["d4", "d5"],
      color: "w",
    });
    expect(s.targeting?.kind).toBe("tacticalJump");
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

  it("TIMELINE_COMMIT reuses hiddenSquares Set when membership unchanged", () => {
    let s = load();
    s = matchReducer(s, { type: "SUBMIT_TURN", reason: "end" });
    const result = s.lastResolve!;
    s = matchReducer(s, {
      type: "TIMELINE_START",
      cues: [],
      placement: result.afterPending.placement,
    });
    s = matchReducer(s, {
      type: "TIMELINE_COMMIT",
      hidden: ["e2", "e4"],
      playingIds: ["m1"],
    });
    const hiddenRef = s.timeline.hiddenSquares;
    const playRef = s.timeline.playingIds;
    s = matchReducer(s, {
      type: "TIMELINE_COMMIT",
      hidden: ["e2", "e4"],
      playingIds: ["m1"],
    });
    expect(s.timeline.hiddenSquares).toBe(hiddenRef);
    expect(s.timeline.playingIds).toBe(playRef);
    s = matchReducer(s, { type: "TIMELINE_COMMIT" });
    expect(s.timeline.hiddenSquares).toBe(hiddenRef);
  });

  it("TIMELINE_COMMIT review never mutates liveSnapshot", () => {
    let s = load();
    s = matchReducer(s, { type: "SUBMIT_TURN", reason: "end" });
    const result = s.lastResolve!;
    s = {
      ...s,
      phase: "gameOver",
      liveSnapshot: result.next,
      settledSnapshots: [s.liveSnapshot, result.next],
      settledResolves: [result],
      reviewIndex: 0,
      lastResolve: result,
    };
    const liveRef = s.liveSnapshot;
    s = matchReducer(s, {
      type: "TIMELINE_START",
      cues: [],
      placement: result.afterPending.placement,
    });
    s = matchReducer(s, {
      type: "TIMELINE_COMMIT",
      placement: "8/8/8/8/8/8/8/8",
      ccLives: { w: 1, b: 1 },
      playingIds: ["a1"],
    });
    expect(s.liveSnapshot).toBe(liveRef);
    expect(s.timeline.displayPlacement).toBe("8/8/8/8/8/8/8/8");
    expect(s.phase).toBe("gameOver");
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
