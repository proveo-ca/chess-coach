// SPEC: _spec/game-core.puml
import { describe, expect, test } from "bun:test";
import {
  CC_MAX_LIVES, MAX_DEPLOYED_MATERIAL, MAX_GAME_TURNS, MAX_STORED_MATERIAL,
  OPENING_STORED_MATERIAL, SPECIAL_REGISTRY, UNIT_COST, applyStoredIncome,
  deployedMaterialFromFen, deployedMaterialFromMap, deployedMaterialFromPlacement,
  energyForTurn, estimateStoredFromSnap, gasRemainingFor, incomeForTurn,
  placementFromFen, placementToMap, specialGasCost, turnTimeoutMsForTurn,
} from "../src";
import type { ScAction, ScSpecialKind } from "../src";

describe("canonical economy", () => {
  test("retains locked caps, opening banks and costs", () => {
    expect([CC_MAX_LIVES, MAX_STORED_MATERIAL, MAX_DEPLOYED_MATERIAL, MAX_GAME_TURNS]).toEqual([3, 12, 50, 45]);
    expect(OPENING_STORED_MATERIAL).toBe(3);
    expect(UNIT_COST).toEqual({ k: 1, p: 1, n: 3, b: 3, r: 5, q: 9 });
    expect(Object.isFrozen(UNIT_COST)).toBe(true);
  });

  test.each([
    [0, 1, 10_000], [1, 1, 10_000], [10, 1, 10_000],
    [11, 2, 15_000], [20, 2, 15_000], [21, 3, 22_000], [45, 3, 22_000],
  ])("preserves turn %i income and clock", (turn, income, clock) => {
    expect(incomeForTurn(turn)).toBe(income);
    expect(energyForTurn(turn)).toBe(income);
    expect(turnTimeoutMsForTurn(turn)).toBe(clock);
  });

  test("adds turn income without mutating the bank", () => {
    const bank = Object.freeze({ w: 3, b: 2 });
    expect(applyStoredIncome(bank, 0)).toEqual({ w: 4, b: 3 });
    expect(applyStoredIncome(bank, 10)).toEqual({ w: 4, b: 3 });
    expect(applyStoredIncome(bank, 11)).toEqual({ w: 5, b: 4 });
    expect(applyStoredIncome(bank, 21)).toEqual({ w: 6, b: 5 });
    expect(bank).toEqual({ w: 3, b: 2 });
  });

  test("caps both stored banks", () => {
    expect(applyStoredIncome({ w: 11, b: 12 }, 50)).toEqual({ w: 12, b: 12 });
    expect(applyStoredIncome({ w: 12, b: 12 }, 1)).toEqual({ w: 12, b: 12 });
  });

  test("estimates missing stored banks from advanced turns", () => {
    expect(estimateStoredFromSnap({ turn: 0 })).toBe(3);
    expect(estimateStoredFromSnap({ turn: 3 })).toBe(6);
    expect(estimateStoredFromSnap({ turn: 500 })).toBe(12);
  });

  test("counts deployed material consistently across board representations", () => {
    const placement = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
    const map = placementToMap(placement);
    for (const color of ["w", "b"] as const) {
      expect(deployedMaterialFromPlacement(placement, color)).toBe(40);
      expect(deployedMaterialFromMap(map, color)).toBe(40);
      expect(deployedMaterialFromFen(`${placement} w - - 0 1`, color)).toBe(40);
    }
    expect(placementFromFen(`  ${placement} b - - 1 2 `)).toBe(placement);
    expect(() => placementFromFen(" ")).toThrow();
  });

  test.each([
    ["deploy", 1, "k"], ["stimStep", 1, "p"], ["spiderMine", 1, "n"],
    ["charonMissiles", 2, "b"], ["siegeMode", 1, "r"], ["tacticalJump", 3, "q"],
  ] as const)("retains %s gas and actor", (kind, gasCost, actorHint) => {
    expect(specialGasCost(kind as ScSpecialKind)).toBe(gasCost);
    expect(SPECIAL_REGISTRY[kind]).toEqual({ gasCost, actorHint });
    expect(Object.isFrozen(SPECIAL_REGISTRY[kind])).toBe(true);
  });

  test("debits only unqueued same-side overlay specials", () => {
    const queued: ScAction = { timing: "B", kind: "stimStep", color: "w", from: "e2", to: "e3", seq: 0 };
    const overlay: ScAction[] = [
      queued,
      { timing: "C", kind: "classical", color: "w", from: "e3", to: "e4", seq: 1 },
      { timing: "F", kind: "charonMissiles", color: "w", from: "c1", to: "h6", seq: 2 },
      { timing: "F", kind: "tacticalJump", color: "b", from: "d8", to: "d4", seq: 3 },
    ];
    const snap = { gas: { w: 2, b: 3 }, queue: { actions: [queued] } };
    expect(gasRemainingFor(snap, "w")).toBe(2);
    expect(gasRemainingFor(snap, "w", null)).toBe(2);
    expect(gasRemainingFor(snap, "w", [queued])).toBe(2);
    expect(gasRemainingFor(snap, "w", overlay)).toBe(0);
    expect(gasRemainingFor(snap, "b", overlay)).toBe(0);
    expect(snap.gas).toEqual({ w: 2, b: 3 });
  });

  test("clamps overlay gas at zero", () => {
    const action: ScAction = { timing: "B", kind: "tacticalJump", color: "w", from: "d1", to: "d5", seq: 0 };
    expect(gasRemainingFor({ gas: { w: 1, b: 3 } }, "w", [action])).toBe(0);
    expect(gasRemainingFor({ gas: { w: -1, b: 3 } }, "w")).toBe(0);
  });
});
