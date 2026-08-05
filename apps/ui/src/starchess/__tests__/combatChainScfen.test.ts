import { describe, expect, it } from "vitest";

import {
  COMBAT_CHAIN_PLY_SC,
  COMBAT_CHAIN_START_SCFEN,
  COMBAT_CHAIN_STEPS,
  buildCombatChainPlys,
  queueCombatChainStep,
} from "~/starchess/demos/combatChain";
import {
  KING_HUNT_LIVE_START_SCFEN,
  KING_HUNT_PLY_SC,
  KING_HUNT_START_SCFEN,
  buildKingHuntPlys,
  queueKingHuntLiveOpponent,
} from "~/starchess/demos/kingHunt";
import { findKing, placementToMap } from "~/starchess/board";
import { UNIT_COST } from "~/starchess/constants";
import { endScTurn } from "~/starchess/endScTurn";
import { formatScFen, parseScFen, validateScFenHistory } from "~/starchess/scfen";

describe("Combat Chain SCFEN engine history", () => {
  it("engine plies match expected final placement", () => {
    const plies = buildCombatChainPlys();
    expect(plies).toHaveLength(4);
    expect(plies[0]!.placement).toBe(parseScFen(COMBAT_CHAIN_START_SCFEN).placement);
    expect(plies[3]!.placement).toBe("5k2/8/8/4P3/8/2n5/8/4K3");
    expect(COMBAT_CHAIN_PLY_SC[3]!.placement).toBe(plies[3]!.placement);
  });

  it("replay validates queued planning history", () => {
    let snap = parseScFen(COMBAT_CHAIN_START_SCFEN);
    const queuedRaws: string[] = [];
    const finals: string[] = [];
    for (const step of COMBAT_CHAIN_STEPS) {
      const q = queueCombatChainStep(snap, step);
      queuedRaws.push(formatScFen(q));
      snap = endScTurn(q).next;
      finals.push(formatScFen({ ...snap, queue: { actions: [] } }));
    }
    const v = validateScFenHistory(queuedRaws[0]!, [
      queuedRaws[1]!,
      queuedRaws[2]!,
      finals[2]!,
    ]);
    expect(v.ok).toBe(true);
    expect(v.replay).toBe("ok");
  });
});

describe("King Hunt SCFEN engine history", () => {
  it("engine plies reach lethal phase O with 0 white lives", () => {
    const plies = buildKingHuntPlys();
    expect(plies[0]!.placement).toBe(parseScFen(KING_HUNT_START_SCFEN).placement);
    expect(plies[0]!.placement).toBe("k7/8/6r1/2n5/4K3/8/7b/8");
    const last = plies[plies.length - 1]!;
    expect(last.kingLives.w).toBe(0);
    expect(last.phase).toBe("O");
    expect(KING_HUNT_PLY_SC[KING_HUNT_PLY_SC.length - 1]!.kingLives.w).toBe(0);
  });

  it("live seed is ownership-flipped without tank; Nc5 legally checks ke4", () => {
    const live = parseScFen(KING_HUNT_LIVE_START_SCFEN);
    expect(live.placement).toBe("K7/8/8/2N5/4k3/8/7B/8");
    expect(live.gas.w).toBe(1);
    expect(live.pendingKingShots).toBeUndefined();
    // First End chips black HP from standing Nc5 before flee.
    const after = endScTurn(live).next;
    expect(after.kingLives.b).toBe(2);
  });

  it("live opponent DualNav flee then marine gas-promote on c5", () => {
    let snap = parseScFen(KING_HUNT_LIVE_START_SCFEN);

    // e4 → d5
    let q = queueKingHuntLiveOpponent(snap);
    expect(q.snapshot.queue?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: "b", timing: "C", from: "e4", to: "d5" }),
      ]),
    );
    snap = endScTurn(q.snapshot).next;

    // d5 → c5
    q = queueKingHuntLiveOpponent(snap);
    expect(q.snapshot.queue?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: "b", timing: "C", from: "d5", to: "c5" }),
      ]),
    );
    snap = endScTurn(q.snapshot).next;
    expect(findKing(placementToMap(snap.placement), "b")).toBe("c5");

    // spawn marine on c4
    q = queueKingHuntLiveOpponent(snap);
    expect(q.spendMinerals).toEqual({ color: "b", amount: UNIT_COST.p });
    expect(q.snapshot.queue?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: "b",
          timing: "B",
          kind: "spawn",
          from: "c5",
          to: "c4",
          unit: "p",
        }),
      ]),
    );
    snap = endScTurn(q.snapshot).next;
    expect(placementToMap(snap.placement).get("c4")).toEqual({ type: "p", color: "b" });

    // gas-double c4 → c2
    q = queueKingHuntLiveOpponent(snap);
    expect(q.snapshot.queue?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: "b",
          timing: "B",
          kind: "pawnDouble",
          from: "c4",
          to: "c2",
        }),
      ]),
    );
    snap = endScTurn(q.snapshot).next;
    expect(placementToMap(snap.placement).get("c2")).toEqual({ type: "p", color: "b" });

    // promote c2 → c1=q
    q = queueKingHuntLiveOpponent(snap);
    expect(q.snapshot.queue?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: "b",
          timing: "C",
          from: "c2",
          to: "c1",
          promotion: "q",
        }),
      ]),
    );
    snap = endScTurn(q.snapshot).next;
    expect(placementToMap(snap.placement).get("c1")).toEqual({ type: "q", color: "b" });

    // then DualNav Kc6
    q = queueKingHuntLiveOpponent(snap);
    expect(q.snapshot.queue?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: "b", timing: "C", from: "c5", to: "c6" }),
      ]),
    );
  });
});
