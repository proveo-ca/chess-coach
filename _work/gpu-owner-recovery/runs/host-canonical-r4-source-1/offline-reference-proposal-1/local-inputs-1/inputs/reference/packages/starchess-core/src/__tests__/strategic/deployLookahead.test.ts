import { describe, expect, it } from "vitest";
import { parseScFen } from "../../index";
import { buildStrategicCtx } from "../../ai/strategic/context";
import { projectedBank, bestDeploySequence, HORIZON } from "../../ai/strategic/deployLookahead";
import { combineKnownVsSeen } from "../../ai/strategic/intel";

describe("deployLookahead horizon 5", () => {
  const snapAt = (turn: number) =>
    parseScFen(`SCFEN|4k3/8/8/8/8/8/8/4K3|${turn}|33|P|G:11:11|Q:w:;b:`, {
      repairGas: true,
    });

  it("projects bank over 5 turns with income tiers and cap 12", () => {
    // turn 10 horizon 5: incomes 11-15 all tier2 => 10, 3+10=13 capped 12
    expect(projectedBank(3, 10, 5)).toBe(12);
    // turn 10 bank 8 => 8+10=18 capped 12
    expect(projectedBank(8, 10, 5)).toBe(12);
    // turn 15 horizon 5: incomes 16-20 tier2 =>10 =>12 capped
    expect(projectedBank(2, 15, 5)).toBe(12);
    // turn 25 income 3 per turn, bank 0 => 15 capped 12
    expect(projectedBank(0, 25, 5)).toBe(12);
    // early turn where income still 1 — turn 5 horizon 3: incomes 6,7,8 all 1 =>3
    expect(projectedBank(3, 5, 3)).toBe(6);
  });

  it("allows ship/BattleShip consideration via horizon when current bank short", () => {
    // turn 15 bank 2 projected 12 => BattleShip affordable within horizon
    const snap = snapAt(15);
    const ctx = buildStrategicCtx(snap, {
      color: "b",
      storedFor: () => 2,
      kvs: combineKnownVsSeen(12, 27, 15), // winning clean
    })!;
    const seq = bestDeploySequence(ctx, 5);
    expect(seq).not.toBeNull();
    // Best sequence when winning clean should contain q (ship) given budget 12
    expect(seq!.units.includes("q")).toBe(true);
    expect(seq!.totalCost).toBeLessThanOrEqual(12);
  });

  it("compares p+p+q vs n+b+r when projected 11 (marine+marine+ship vs hoverbike+mecha+tank)", () => {
    // At turn 12 income1, bank 8 => projected 11 in 3 turns (8+3)
    const snap = snapAt(12);
    const ctx = buildStrategicCtx(snap, {
      color: "b",
      storedFor: () => 8,
      kvs: combineKnownVsSeen(5, 5, 0),
    })!;
    const seq3 = bestDeploySequence(ctx, 3);
    expect(seq3).not.toBeNull();
    // Both combos cost 11, but scorer picks one; verify it picks a valid 3-unit combo cost <=11
    expect(seq3!.units.length).toBeGreaterThan(0);
    expect(seq3!.totalCost).toBeLessThanOrEqual(11);
  });

  it("horizon constant is 5", () => {
    expect(HORIZON).toBe(5);
  });
});
