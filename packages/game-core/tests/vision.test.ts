// SPEC: _spec/game-core.puml
import { describe, expect, test } from "bun:test";
import {
  getSideVision, getUnitVision, isMoverVisibleToSide, isPieceVisibleToSide, mapToPlacement,
  pathRevealSteps, pathRevealStepsKernel, pathRevealsTarget, placementToMap,
} from "../src";
import type { ScPiece, Square } from "../src";

describe("canonical cumulative fog", () => {
  test.each([["k", 9], ["p", 5], ["n", 17], ["b", 25], ["r", 25], ["q", 49]] as const)(
    "retains %s central vision shape", (type, count) => {
      const map = new Map<Square, ScPiece>([["d4", { type, color: "w" }]]);
      expect(getUnitVision(map, "d4").litSquares.size).toBe(count);
      expect(getUnitVision(map, null).litSquares.size).toBe(0);
      expect(getUnitVision(map, "a1").litSquares.size).toBe(0);
    },
  );

  test("mirrors Marine vision and clips board edges", () => {
    const map = placementToMap("7p/8/8/8/8/8/8/P7");
    expect([...getUnitVision(map, "a1").litSquares].sort()).toEqual(["a1", "a2", "a3", "b2"]);
    expect([...getUnitVision(map, "h8").litSquares].sort()).toEqual(["g7", "h6", "h7", "h8"]);
  });

  test("expands siege vision without occupancy blocking", () => {
    const map = placementToMap("8/8/8/3p4/3R4/8/8/8");
    expect(getUnitVision(map, "d4").litSquares.size).toBe(25);
    expect(getUnitVision(map, "d4", { tankModeFor: () => "siege" }).litSquares.size).toBe(64);
    expect(getUnitVision(map, "d4").litSquares.has("d6")).toBe(true);
  });

  test("keeps Mecha BattleShip pings dark until cumulative friendly vision lights them", () => {
    const map = placementToMap("7q/8/8/8/8/8/8/B7");
    const unit = getUnitVision(map, "a1");
    expect(unit.revealedPieces.has("h8")).toBe(true);
    expect(unit.litSquares.has("h8")).toBe(false);
    map.set("g7", { type: "k", color: "w" });
    const side = getSideVision(map, "w");
    expect(side.litSquares.has("h8")).toBe(true);
    expect(side.revealedPieces.has("h8")).toBe(false);
  });

  test("lets only own mines light their tile and leaves an empty army in fog", () => {
    const empty = new Map<Square, ScPiece>();
    expect(getSideVision(empty, "w").litSquares.size).toBe(0);
    const vision = getSideVision(empty, "w", { mines: [{ at: "c3", color: "w" }, { at: "f6", color: "b" }] });
    expect([...vision.litSquares]).toEqual(["c3"]);
  });

  test("uses cumulative side visibility and explicit shot reveals", () => {
    const map = placementToMap("7q/8/8/8/8/8/8/B7");
    expect(isPieceVisibleToSide(map, "w", "h8", "b")).toBe(true);
    expect(isPieceVisibleToSide(new Map(), "w", "a1", "w")).toBe(true);
    expect(isPieceVisibleToSide(new Map(), "w", "h8", "b")).toBe(false);
    expect(isMoverVisibleToSide(new Map(), "w", { from: "h8", color: "b" }, new Set(["h8"]))).toBe(true);
    expect(isMoverVisibleToSide(new Map(), "w", { from: "h8", color: "b" }, new Set())).toBe(false);
    expect(getSideVision(mapToPlacement(map), "w")).toEqual(getSideVision(map, "w"));
  });

  test("records the first intermediate path reveal without mutating occupancy", () => {
    const placement = "4k3/8/8/8/8/8/8/R3K3";
    const steps: [Square, boolean][] = [];
    const returns: (number | null)[] = [];
    expect(pathRevealStepsKernel(placement, "a1", "a8", "w", "a7", undefined, {
      step: (at, visible) => steps.push([at, visible]), returned: value => returns.push(value),
    })).toBe(4);
    expect(steps).toEqual([["a2", false], ["a3", false], ["a4", false], ["a5", true]]);
    expect(returns).toEqual([4]);
    expect(pathRevealsTarget(placement, "a1", "a8", "w", "a7")).toBe(true);
    expect(pathRevealSteps(placement, "a1", "a2", "w", "a7")).toBeNull();
    expect(pathRevealSteps(placement, "a1", "a8", "b", "a7")).toBeNull();
    expect(mapToPlacement(placementToMap(placement))).toBe(placement);
  });
});
