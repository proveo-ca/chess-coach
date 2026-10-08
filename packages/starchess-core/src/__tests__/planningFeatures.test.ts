// SPEC: _spec/packages/starchess-core/resolve.puml, _spec/packages/starchess-core/turn-queue-sequence.puml, _spec/apps/starchess/core/board/board-queries.puml
import { describe, expect, it } from "vitest";
import * as native from "../index";
import {
  attacksSquare, energyForTurn, getUnitVision, incomeForTurn, orderBHeadsFirst, rayBetween,
  type PieceColor, type ScAction, type ScPiece, type Square,
} from "../planning-v1";

describe("planning feature native parity", () => {
  it("preserves income and energy tiers at opening and tier boundaries", () => {
    for (const [turn, tier] of [[-1, 1], [0, 1], [1, 1], [10, 1], [11, 2], [20, 2], [21, 3], [45, 3]]) {
      expect(incomeForTurn(turn)).toBe(tier);
      expect(energyForTurn(turn)).toBe(tier);
      expect(incomeForTurn(turn)).toBe(native.incomeForTurn(turn));
      expect(energyForTurn(turn)).toBe(native.energyForTurn(turn));
    }
  });

  it("orders B relocation heads and cyclic fallbacks without changing actions", () => {
    const head: ScAction = { kind: "stimStep", timing: "B", color: "w", from: "a2", to: "a3", seq: 0 };
    const tail: ScAction = { kind: "stimStep", timing: "B", color: "w", from: "a3", to: "a4", seq: 2 };
    const deploy: ScAction = { kind: "deploy", timing: "B", color: "w", from: "b1", to: "b2", unit: "p", seq: 1 };
    const actions = [tail, head, deploy];
    const saved = structuredClone(actions);
    const result = orderBHeadsFirst(actions);
    expect(result).toEqual([deploy, tail, head]);
    expect(result).toEqual(native.orderBHeadsFirst(actions));
    expect(result).not.toBe(actions);
    expect(result[0]).toBe(deploy);
    expect(actions).toEqual(saved);
    const cycle: ScAction[] = [
      { kind: "tacticalJump", timing: "B", color: "w", from: "a5", to: "b5", seq: 3 },
      { kind: "tacticalJump", timing: "B", color: "w", from: "b5", to: "a5", seq: 2 },
    ];
    expect(orderBHeadsFirst(cycle).map(action => action.seq)).toEqual([2, 3]);
    expect(orderBHeadsFirst(cycle)).toEqual(native.orderBHeadsFirst(cycle));
    expect(orderBHeadsFirst([])).toEqual([]);
  });

  it("preserves directed exclusive rays and nonray geometry", () => {
    const cases: [Square, Square, Square[]][] = [
      ["a1", "a4", ["a2", "a3"]], ["a4", "a1", ["a3", "a2"]],
      ["a1", "d1", ["b1", "c1"]], ["a1", "d4", ["b2", "c3"]],
      ["d4", "a1", ["c3", "b2"]], ["a1", "a2", []], ["a1", "a1", []], ["a1", "b3", []],
    ];
    for (const [from, to, expected] of cases) {
      expect(rayBetween(from, to)).toEqual(expected);
      expect(rayBetween(from, to)).toEqual(native.rayBetween(from, to));
    }
  });

  it("preserves attack geometry, pawn direction and intermediate blockers", () => {
    const cases: [ScPiece["type"], PieceColor, Square, boolean][] = [
      ["p", "w", "e5", true], ["p", "w", "d5", false], ["p", "w", "e3", false],
      ["p", "b", "c3", true], ["p", "b", "c5", false],
      ["n", "w", "f5", true], ["n", "b", "e5", false],
      ["k", "w", "e5", true], ["k", "b", "f4", false],
      ["b", "w", "g7", true], ["b", "b", "g4", false],
      ["r", "w", "d8", true], ["r", "b", "e5", false],
      ["q", "w", "a1", true], ["q", "b", "h4", true],
    ];
    for (const [type, color, to, expected] of cases) {
      const board = new Map<Square, ScPiece>([["d4", { type, color }]]);
      const saved = structuredClone(board);
      expect(attacksSquare(board, "d4", to)).toBe(expected);
      expect(attacksSquare(board, "d4", to)).toBe(native.attacksSquare(board, "d4", to));
      expect(attacksSquare(board, "d4", "d4")).toBe(false);
      expect(attacksSquare(board, "a8", to)).toBe(false);
      expect(board).toEqual(saved);
    }
    for (const color of ["w", "b"] as const) {
      const board = new Map<Square, ScPiece>([["d4", { type: "r", color: "w" }], ["d6", { type: "p", color }]]);
      expect(attacksSquare(board, "d4", "d8")).toBe(false);
      expect(attacksSquare(board, "d4", "d6")).toBe(true);
      expect(attacksSquare(board, "d4", "d8")).toBe(native.attacksSquare(board, "d4", "d8"));
    }
  });

  it("preserves unit footprints, pawn direction and siege vision through occupancy", () => {
    const footprints: [ScPiece["type"], number][] = [["k", 9], ["p", 5], ["n", 17], ["b", 25], ["r", 25], ["q", 49]];
    for (const color of ["w", "b"] as const) {
      for (const [type, count] of footprints) {
        const board = new Map<Square, ScPiece>([["d4", { type, color }], ["e5", { type: "p", color }]]);
        const saved = structuredClone(board);
        const vision = getUnitVision(board, "d4");
        expect(vision).toEqual(native.getUnitVision(board, "d4"));
        expect(vision.litSquares.size).toBe(count);
        expect(vision.revealedPieces.size).toBe(0);
        if (type === "p") expect([...vision.litSquares].sort()).toEqual(
          color === "w" ? ["c5", "d4", "d5", "d6", "e5"] : ["c3", "d2", "d3", "d4", "e3"],
        );
        expect(board).toEqual(saved);
      }
    }
    const tank = new Map<Square, ScPiece>([["d4", { type: "r", color: "w" }]]);
    const opts = { tankModeFor: () => "siege" as const };
    expect(getUnitVision(tank, "d4", opts)).toEqual(native.getUnitVision(tank, "d4", opts));
    expect(getUnitVision(tank, "d4", opts).litSquares.size).toBe(64);
    const corner = new Map<Square, ScPiece>([["a1", { type: "k", color: "w" }]]);
    expect([...getUnitVision(corner, "a1").litSquares].sort()).toEqual(["a1", "a2", "b1", "b2"]);
  });

  it("preserves off-footprint battleship pings, board adapters and detached vision sets", () => {
    const board = new Map<Square, ScPiece>([["d4", { type: "b", color: "w" }], ["h8", { type: "q", color: "b" }]]);
    const vision = getUnitVision(board, "d4");
    expect(vision).toEqual(native.getUnitVision(board, "d4"));
    expect([...vision.revealedPieces]).toEqual(["h8"]);
    expect(vision.litSquares.has("h8")).toBe(false);
    const placement = "7q/8/8/8/3B4/8/8/8";
    expect(getUnitVision(placement, "d4")).toEqual(vision);
    expect(getUnitVision({ fen: () => `${placement} w - - 0 1` }, "d4")).toEqual(vision);
    vision.litSquares.clear();
    vision.revealedPieces.clear();
    expect(getUnitVision(board, "d4").litSquares.size).toBe(25);
    expect([...getUnitVision(board, "d4").revealedPieces]).toEqual(["h8"]);
    for (const source of [null, "a1"] as const) {
      expect(getUnitVision(board, source)).toEqual({ litSquares: new Set(), revealedPieces: new Set() });
      expect(getUnitVision(board, source)).toEqual(native.getUnitVision(board, source));
    }
  });
});
