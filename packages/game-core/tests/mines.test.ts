// SPEC: _spec/game-core.puml
import { describe, expect, test } from "bun:test";
import {
  MAX_MINES_PER_SIDE, assertMineCap, firstBlockerOnRay, formatMinesExtra,
  mineAt, minesFor, parseMinesExtra, pathContactSquares, placementToMap, rayBetween,
} from "../src";
import type { ScMine } from "../src";

describe("canonical mine geometry", () => {
  test("enumerates ordered exclusive intermediates and rejects non-rays", () => {
    expect(rayBetween("a1", "d4")).toEqual(["b2", "c3"]);
    expect(rayBetween("d4", "a1")).toEqual(["c3", "b2"]);
    expect(rayBetween("a1", "a2")).toEqual([]);
    expect(rayBetween("a1", "a1")).toEqual([]);
    expect(rayBetween("b1", "c3")).toEqual([]);
    const map = placementToMap("8/8/8/8/8/2p5/1P6/8");
    expect(firstBlockerOnRay(map, "a1", "d4")).toBe("b2");
    expect(firstBlockerOnRay(map, "a1", "d1")).toBeNull();
  });

  test("exempts Hoverbike leaps and Command Centers from mine path contact", () => {
    for (const type of ["p", "b", "r", "q"] as const) expect(pathContactSquares("a1", "a4", type)).toEqual(["a2", "a3"]);
    for (const type of ["n", "k"] as const) expect(pathContactSquares("a1", "a4", type)).toEqual([]);
  });

  test("packs sorted side-local mines and parses recognized coordinates", () => {
    const mines: ScMine[] = [{ at: "h8", color: "w" }, { at: "a1", color: "w" }, { at: "d4", color: "b" }];
    expect(formatMinesExtra(mines)).toBe("M:w:a1h8;b:d4");
    expect(parseMinesExtra(formatMinesExtra(mines)!)).toEqual([mines[1]!, mines[0]!, mines[2]!]);
    expect(formatMinesExtra([])).toBeNull();
    expect(parseMinesExtra(undefined)).toEqual([]);
    expect(parseMinesExtra("X:w:a1")).toEqual([]);
    expect(parseMinesExtra("M:w:a1z9x;b:d4")).toEqual([mines[1]!, mines[2]!]);
    expect(minesFor(mines, "b")).toEqual([mines[2]!]);
    expect(mineAt(mines, "d4")).toEqual(mines[2]!);
    expect(mineAt(undefined, "a1")).toBeUndefined();
  });

  test("retains the actual three-mine per-side cap", () => {
    const mines: ScMine[] = ["a1", "b1", "c1", "d1"].map(at => ({ at: at as ScMine["at"], color: "w" }));
    expect(MAX_MINES_PER_SIDE).toBe(3);
    expect(() => assertMineCap(mines.slice(0, 3), "w")).not.toThrow();
    expect(() => assertMineCap(mines, "w")).toThrow();
    expect(() => assertMineCap(mines, "b")).not.toThrow();
  });
});
