// SPEC: _spec/game-core.puml
import { describe, expect, test } from "bun:test";
import {
  attacksSquare, collectLegalCCChecks, findCC, isCCInCheck, isSquareAttackedBy,
  mapToPlacement, parseSquare, placementToMap, sq, tankSquaresInPlacement, toClassicFen,
} from "../src";
import type { ScPiece, Square, StarChessColor } from "../src";

const board = (entries: [Square, ScPiece["type"], StarChessColor][]) =>
  new Map<Square, ScPiece>(entries.map(([at, type, color]) => [at, { type, color }]));

describe("canonical board geometry", () => {
  test("round-trips all 64 coordinates and rejects off-board coordinates", () => {
    for (let file = 0; file < 8; file++) {
      for (let rank = 1; rank <= 8; rank++) {
        expect(parseSquare(sq(file, rank)!)).toEqual({ file, rank });
      }
    }
    for (const [file, rank] of [[-1, 1], [8, 1], [0, 0], [0, 9]]) expect(sq(file, rank)).toBeNull();
  });

  test.each([
    "8/8/8/8/8/8/8/8",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
    "4k3/8/3r4/8/2R5/8/8/4K3",
  ])("round-trips canonical placement %s", placement => {
    expect(mapToPlacement(placementToMap(placement))).toBe(placement);
  });

  test("reports invalid placement rank count and occupied overflow", () => {
    expect(() => placementToMap("8/8")).toThrow();
    expect(() => placementToMap("8k/8/8/8/8/8/8/8")).toThrow();
  });

  test("finds both Command Centers and tanks", () => {
    const placement = "4k3/8/3r4/8/2R5/8/8/4K3";
    const map = placementToMap(placement);
    expect(findCC(map, "w")).toBe("e1");
    expect(findCC(map, "b")).toBe("e8");
    expect(findCC(new Map(), "w")).toBeNull();
    expect(tankSquaresInPlacement(placement)).toEqual(["d6", "c4"]);
    expect(toClassicFen(placement)).toBe(`${placement} w - - 0 1`);
    expect(toClassicFen(placement, "b", 2, 5)).toBe(`${placement} b - - 2 5`);
  });

  test("uses directional Marine attacks rather than forward movement", () => {
    const map = board([["e4", "p", "w"], ["d5", "p", "b"]]);
    expect(attacksSquare(map, "e4", "d5")).toBe(true);
    expect(attacksSquare(map, "d5", "e4")).toBe(true);
    expect(attacksSquare(map, "e4", "e5")).toBe(false);
    expect(attacksSquare(map, "e4", "d3")).toBe(false);
    expect(attacksSquare(map, "d5", "c6")).toBe(false);
  });

  test("stops sliding rays at occupancy but permits attacking the blocker square", () => {
    const map = board([["a1", "r", "w"], ["a3", "p", "b"], ["c1", "b", "w"], ["d2", "p", "w"]]);
    expect(attacksSquare(map, "a1", "a3")).toBe(true);
    expect(attacksSquare(map, "a1", "a4")).toBe(false);
    expect(attacksSquare(map, "c1", "e3")).toBe(false);
    expect(attacksSquare(map, "c1", "d2")).toBe(true);
    expect(attacksSquare(map, "a1", "b2")).toBe(false);
    expect(attacksSquare(map, "c1", "c3")).toBe(false);
  });

  test("keeps leaps independent of blockers and excludes self-attacks", () => {
    const map = board([["b1", "n", "w"], ["b2", "p", "w"], ["c2", "p", "w"], ["d4", "q", "w"]]);
    expect(attacksSquare(map, "b1", "c3")).toBe(true);
    expect(attacksSquare(map, "b1", "b3")).toBe(false);
    expect(attacksSquare(map, "d4", "h8")).toBe(true);
    expect(attacksSquare(map, "d4", "d8")).toBe(true);
    expect(attacksSquare(map, "d4", "f5")).toBe(false);
    expect(attacksSquare(map, "d4", "d4")).toBe(false);
    expect(attacksSquare(map, "h1", "h8")).toBe(false);
  });

  test("retains mutual adjacent Command Center attacks", () => {
    const map = board([["e4", "k", "w"], ["e5", "k", "b"]]);
    expect(isCCInCheck(map, "w")).toBe(true);
    expect(isCCInCheck(map, "b")).toBe(true);
    expect(isSquareAttackedBy(map, "e5", "w")).toBe(true);
    expect(collectLegalCCChecks(mapToPlacement(map))).toEqual([
      { color: "w", piece: "k", from: "e4", to: "e5" },
      { color: "b", piece: "k", from: "e5", to: "e4" },
    ]);
    expect(isCCInCheck(new Map(), "w")).toBe(false);
  });

  test("uses attacking-side visibility and stable checker ordering", () => {
    const map = board([["a1", "k", "w"], ["h8", "k", "b"], ["h1", "r", "w"], ["b2", "b", "w"], ["a8", "r", "b"]]);
    const placement = mapToPlacement(map);
    expect(collectLegalCCChecks(placement).map(check => check.from)).toEqual(["b2", "h1", "a8"]);
    const calls: [StarChessColor, Square][] = [];
    const checks = collectLegalCCChecks(placement, { isTargetVisible: (color, at) => {
      calls.push([color, at]);
      return color === "w";
    } });
    expect(calls).toEqual([["b", "a1"], ["w", "h8"]]);
    expect(checks.map(check => check.from)).toEqual(["b2", "h1"]);
  });
});
