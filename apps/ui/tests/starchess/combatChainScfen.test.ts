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
} from "~/starchess/demos/kingHunt";
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
    expect(plies[0]!.placement).toBe("k7/6r1/8/2n5/4K3/8/7b/8");
    const last = plies[plies.length - 1]!;
    expect(last.kingLives.w).toBe(0);
    expect(last.phase).toBe("O");
    expect(KING_HUNT_PLY_SC[KING_HUNT_PLY_SC.length - 1]!.kingLives.w).toBe(0);
  });

  it("live seed is ownership-flipped with tank on g7 and pending H:", () => {
    const live = parseScFen(KING_HUNT_LIVE_START_SCFEN);
    expect(live.placement).toBe("K7/6R1/8/2N5/4k3/8/7B/8");
    expect(live.gas.w).toBe(3);
    expect(live.pendingKingShots).toEqual([
      { color: "w", piece: "n", from: "c5", to: "e4" },
    ]);
  });
});
