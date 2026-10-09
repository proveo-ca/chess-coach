import { describe, expect, it } from "vitest";
import { addScAction, endScTurn, mapToPlacement, placementToMap, type ScFenSnapshot, type ScActionInput, type ScPiece } from "@chess-coach/starchess-core";
import type { Cells, Meter, Side, Square } from "../economic/contracts";
import { adjacentSquares, marineOpportunity, reduceSpatial } from "../economic/spatial";
import { squares } from "./fixtures";

const meter = (): Meter => ({ limit: 1048576, used: 0 });
const unknown: Cells = squares.map(square => ({ square, visibility: "unknown" }));
const changed = (entries: readonly (readonly [Square, ScPiece | null])[]): Cells => {
  const map = new Map(entries);
  return squares.map(square => map.has(square) ? { square, visibility: "lit", piece: map.get(square)! } : { square, visibility: "unknown" });
};
const native = (source: Square, side: Side, actions: readonly ScActionInput[], targets: readonly Square[] = []) => {
  const entries: [Square, ScPiece][] = [[source, { type: "p", color: side }], ["a1", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }]];
  for (const square of targets) entries.push([square, { type: "n", color: side === "w" ? "b" : "w" }]);
  let snapshot: ScFenSnapshot = { placement: mapToPlacement(new Map(entries)), turn: 21, phase: "P", ccLives: { w: 3, b: 3 },
    gas: { w: 3, b: 3 }, gasIncome: { w: 3, b: 3 }, queue: { actions: [] }, mines: [], siegedTanks: [] };
  for (const action of actions) snapshot = addScAction({ snapshot, action }).snapshot;
  return placementToMap(endScTurn(snapshot, { skipTurnStartChecks: true }).next.placement);
};
const initial = { phase: "settled" as const, side: "b" as const, gas: 1, canBirth: false,
  enemyCC: ["a1" as Square], witnessed: ["e6" as Square], unlocated: [], cells: unknown, anchors: [], geometry: [] };

describe("economic anonymous spatial support with native controls", () => {
  it("matches independently enumerated stay/Adj and anchor-excluding Ring unions", () => {
    for (const source of squares) {
      const expected = squares.filter(square => Math.abs(source.charCodeAt(0) - square.charCodeAt(0)) <= 1 && Math.abs(Number(source[1]) - Number(square[1])) <= 1);
      expect(adjacentSquares([source], false, meter())).toEqual(expected);
      expect(adjacentSquares([source], true, meter())).toEqual(expected.filter(square => square !== source));
    }
    expect(adjacentSquares(["a1", "b1"], true, meter())).toContain("a1");
  });
  it("keeps CC exclusions current and rejects an empty envelope", () => {
    const excluded = changed([["a1", null], ["a2", { type: "p", color: "w" }], ["b1", { type: "k", color: "b" }]]);
    expect(reduceSpatial({ ...initial, cells: excluded, witnessed: [] }, meter()).enemyCC).toEqual(["b2"]);
    const next = reduceSpatial({ ...initial, enemyCC: ["b2"], witnessed: [] }, meter());
    expect(next.enemyCC).toContain("a1");
    const allEmpty: Cells = squares.map(square => ({ square, visibility: "lit", piece: null }));
    expect(() => reduceSpatial({ ...initial, cells: allEmpty, witnessed: [] }, meter())).toThrow("CONSISTENCY");
  });
  it.each(["w", "b"] as const)("retains both B+C bindings and arrival-origin diagonal promotion for %s", side => {
    const source: Square = side === "w" ? "e6" : "e3", arrival: Square = side === "w" ? "e7" : "e2", diagonal: Square = side === "w" ? "d8" : "d1";
    const macros = marineOpportunity(source, side, new Set([diagonal]), { gas: 1 }, meter());
    for (const promotion of ["n", "b", "r", "q"] as const) {
      const original = macros.find(macro => macro.key === `1:1:0:0:0:${promotion}`)!;
      const direct = macros.find(macro => macro.key === `1:1:0:1:0:${promotion}`)!;
      const capture = macros.find(macro => macro.key === `1:3:0:1:0:${promotion}`)!;
      expect(original.actions[1]!.from).toBe(source); expect(direct.actions[1]!.from).toBe(arrival);
      expect(native(source, side, original.actions).get(original.destination)).toEqual({ type: promotion, color: side });
      expect(native(source, side, direct.actions).get(direct.destination)).toEqual({ type: promotion, color: side });
      expect(capture.destination).toBe(diagonal);
      expect(native(source, side, capture.actions, [diagonal]).get(diagonal)).toEqual({ type: promotion, color: side });
    }
    expect(macros.some(macro => macro.key.startsWith("1:3:0:0:") && macro.destination === diagonal)).toBe(false);
  });
  it.each(["w", "b"] as const)("preserves F-before-C unpromoted last rank and rejects C-before-F at that rank for %s", side => {
    const source: Square = side === "w" ? "e6" : "e3", last: Square = side === "w" ? "e8" : "e1";
    const macros = marineOpportunity(source, side, new Set(), { gas: 1 }, meter());
    const unpromoted = macros.find(macro => macro.key === "0:1:1:0:1:p")!;
    expect(unpromoted.destination).toBe(last); expect(unpromoted.promotion).toBeNull();
    expect(native(source, side, unpromoted.actions).get(last)).toEqual({ type: "p", color: side });
    expect(macros.some(macro => macro.key.startsWith("0:1:1:0:0:"))).toBe(false);
    expect(marineOpportunity(last, side, new Set(), { gas: 3 }, meter()).some(macro => macro.destination === last && macro.promotion === null)).toBe(true);
  });
  it("retains both C/F authored orders away from last rank", () => {
    const macros = marineOpportunity("e4", "w", new Set(), { gas: 1 }, meter());
    for (const order of [0, 1]) {
      const macro = macros.find(value => value.key === `0:1:1:0:${order}:p`)!;
      expect(macro.destination).toBe("e6");
      expect(native("e4", "w", macro.actions).get("e6")).toEqual({ type: "p", color: "w" });
    }
  });
  it("uses original-rank double eligibility for rewrites and arrival-rank eligibility for direct binding", () => {
    const macros = marineOpportunity("e2", "w", new Set(), { gas: 1 }, meter());
    const rewrite = macros.find(macro => macro.key === "1:2:0:0:0:p")!;
    expect(rewrite.destination).toBe("e5");
    expect(native("e2", "w", rewrite.actions).get("e5")).toEqual({ type: "p", color: "w" });
    expect(macros.some(macro => macro.key === "1:2:0:1:0:p")).toBe(false);
    expect(marineOpportunity("e1", "w", new Set(), { gas: 0 }, meter()).some(macro => macro.destination === "e3")).toBe(true);
  });
  it("requires public geometry for diagonal movement and never both B/F specials", () => {
    for (const gas of [0, 1, 2, 3]) {
      const macros = marineOpportunity("e4", "w", new Set(["d5"]), { gas }, meter());
      expect(macros.some(macro => macro.destination === "f5")).toBe(false);
      expect(macros.some(macro => macro.actions.filter(action => action.timing !== "C").length > 1)).toBe(false);
      expect(macros.some(macro => macro.destination === "d5")).toBe(true);
      if (gas === 0) expect(macros.every(macro => macro.actions.every(action => action.timing === "C"))).toBe(true);
    }
  });
  it("seeds births from temporal CC Rings with bank/gas/origin permission", () => {
    const base = { ...initial, enemyCC: ["e4" as Square], witnessed: [], unlocated: [], gas: 1 };
    expect(reduceSpatial(base, meter()).unlocated).toEqual([]);
    expect(reduceSpatial({ ...base, canBirth: true, gas: 0 }, meter()).unlocated).toEqual([]);
    const births = reduceSpatial({ ...base, canBirth: true }, meter()).unlocated;
    expect(births).toContain("e2"); expect(births).toContain("e6");
    expect(births).not.toContain("e7");
    const origin = { ...base, canBirth: true, gas: 2, unlocated: ["e5" as Square] };
    expect(reduceSpatial(origin, meter()).unlocated).toContain("e7");
  });
  it("preserves anonymous channels, transient zero/one envelopes, current pruning and no turn-open motion", () => {
    const result = reduceSpatial({ ...initial, unlocated: ["c4"], anchors: ["g4"] }, meter());
    expect(result.witnessed).toContain("e6"); expect(result.witnessed).toContain("g4"); expect(result.witnessed).toContain("g5");
    expect(result.unlocated).toContain("c4"); expect(result.unlocated).toContain("c5");
    const open = reduceSpatial({ ...initial, phase: "turn-open", unlocated: ["c4"], cells: changed([["c4", { type: "p", color: "w" }]]) }, meter());
    expect(open.witnessed).toEqual(["c4", "e6"]); expect(open.unlocated).toEqual([]); expect(open.enemyCC).toEqual(["a1"]);
    const pruned = reduceSpatial({ ...initial, phase: "turn-open", cells: changed([["e6", null]]) }, meter());
    expect(pruned.witnessed).toEqual([]);
  });
  it("charges one shared cap before expansion and preserves inputs on exhaustion", () => {
    const work = meter(); work.used = work.limit - 20;
    expect(() => reduceSpatial(initial, work)).toThrow("WORK_CAP");
    expect(initial.witnessed).toEqual(["e6"]); expect(work.used).toBe(work.limit - 20);
  });
});
