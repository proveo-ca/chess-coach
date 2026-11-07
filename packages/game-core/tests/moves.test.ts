// SPEC: _spec/game-core.puml
import { describe, expect, test } from "bun:test";
import {
  canClassicalMarineDouble, canMarineDoubleStep, isScMoveShape, marineSingleTarget,
  placementToMap, scMovesFor, scMovesFrom,
} from "../src";
import type { Square } from "../src";

describe("native classical moves", () => {
  test.each([
    ["w", "d1", "d3", true], ["w", "d2", "d4", true], ["w", "d3", "d5", false],
    ["b", "d8", "d6", true], ["b", "d7", "d5", true], ["b", "d6", "d4", false],
  ] as const)("retains %s Marine double band from %s", (color, from, to, allowed) => {
    const map = new Map([[from as Square, { type: "p" as const, color }]]);
    expect(canMarineDoubleStep(from, color)).toBe(allowed);
    expect(scMovesFrom(map, from, color).some(move => move.to === to && move.isMarineDoubleStep)).toBe(allowed);
    expect(isScMoveShape("p", from, to, color)).toBe(allowed);
  });

  test("keeps Marine diagonals capture-only except hostile mine targets", () => {
    const map = placementToMap("4k3/8/8/8/8/2p1P3/3P4/4K3");
    expect(scMovesFrom(map, "d2", "w").map(move => move.to)).toEqual(["d3", "d4", "c3"]);
    map.delete("e3");
    expect(scMovesFrom(map, "d2", "w").some(move => move.to === "e3")).toBe(false);
    const moves = scMovesFrom(map, "d2", "w", { mines: [{ color: "b", at: "e3" }] });
    expect(moves.find(move => move.to === "e3")).toMatchObject({ capture: null, hostileMineOnTo: true });
    expect(scMovesFrom(map, "d2", "w", { mines: [{ color: "w", at: "e3" }] }).some(move => move.to === "e3")).toBe(false);
  });

  test("denies forward captures and blocked double steps", () => {
    const placement = "4k3/8/8/8/8/3n4/3P4/4K3";
    expect(scMovesFrom(placementToMap(placement), "d2", "w")).toEqual([]);
    expect(canClassicalMarineDouble(placement, "d2")).toBe(false);
    expect(canClassicalMarineDouble(placement, "e1")).toBe(false);
    expect(canClassicalMarineDouble(placement, "a1")).toBe(false);
    expect(canClassicalMarineDouble("4k3/8/8/8/8/8/8/3PK3", "d1")).toBe(true);
  });

  test.each(["w", "b"] as const)("marks last-rank %s Marine moves for promotion", color => {
    const from: Square = color === "w" ? "d7" : "d2";
    const to: Square = color === "w" ? "d8" : "d1";
    const map = new Map([[from, { type: "p" as const, color }]]);
    expect(scMovesFrom(map, from, color).find(move => move.to === to)).toMatchObject({ promotes: true, promotion: "q" });
    expect(marineSingleTarget(from, color)).toBe(to);
    expect(marineSingleTarget(to, color)).toBeNull();
  });

  test("lists sieged fire missions through blockers without relocation", () => {
    const map = placementToMap("8/3p4/3P4/8/p2R1P1p/8/8/4K2k");
    const moves = scMovesFrom(map, "d4", "w", { siegedTanks: ["d4"] });
    expect(moves).toHaveLength(12);
    expect(moves.every(move => move.firesInPlace)).toBe(true);
    expect(moves.find(move => move.to === "d7")?.capture).toEqual({ type: "p", color: "b" });
    expect(moves.some(move => move.to === "d6" || move.to === "f4" || move.to === "e5")).toBe(false);
    expect(scMovesFrom(map, "d4", "w").some(move => move.to === "d7")).toBe(false);
    expect(scMovesFrom(map, "d4", "w", { siegedTanks: new Set(["d4"]) })).toEqual(moves);
  });

  test("marks hostile mines on sieged empty fire targets", () => {
    const moves = scMovesFrom(placementToMap("4k3/8/8/8/8/8/8/R3K3"), "a1", "w", {
      siegedTanks: ["a1"], mines: [{ at: "a4", color: "b" }],
    });
    expect(moves.find(move => move.to === "a4")).toMatchObject({ capture: null, firesInPlace: true, hostileMineOnTo: true });
  });

  test("flags CC-target intents as dropped at resolution rather than captures", () => {
    const map = placementToMap("4k3/8/8/8/8/8/8/4R2K");
    expect(scMovesFrom(map, "e1", "w").find(move => move.to === "e8")).toMatchObject({ dropsAtResolve: true });
    expect(scMovesFrom(map, "e1", "b")).toEqual([]);
    expect(scMovesFrom(map, "a1", "w")).toEqual([]);
    expect(scMovesFor(map, "w")).toEqual([...scMovesFrom(map, "e1", "w"), ...scMovesFrom(map, "h1", "w")]);
  });

  test("keeps shape-only intents separate from occupancy legality", () => {
    const map = placementToMap("4k3/8/8/8/8/8/4P3/4R2K");
    expect(isScMoveShape("r", "e1", "e7", "w")).toBe(true);
    expect(scMovesFrom(map, "e1", "w").some(move => move.to === "e7")).toBe(false);
    expect(isScMoveShape("n", "b1", "c3")).toBe(true);
    expect(isScMoveShape("b", "c1", "h6")).toBe(true);
    expect(isScMoveShape("q", "d1", "d8")).toBe(true);
    expect(isScMoveShape("k", "e1", "g1")).toBe(false);
    expect(isScMoveShape("p", "e4", "e2")).toBe(true);
    expect(isScMoveShape("p", "e4", "e2", "b")).toBe(false);
    expect(isScMoveShape("p", "e4", "e4", "w")).toBe(false);
  });
});
