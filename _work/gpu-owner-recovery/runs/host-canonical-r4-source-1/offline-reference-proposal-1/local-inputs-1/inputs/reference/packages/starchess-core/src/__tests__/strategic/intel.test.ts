import { describe, expect, it } from "vitest";

import {
  boardValue,
  combineKnownVsSeen,
  detectCheesePromotion,
  estimateKnownVsSeen,
  hasHiddenMaterial,
  hiddenMaterial,
  isWinning,
  knownForTurn,
  seedKnownVsSeen,
  pieceValue,
} from "../../ai/strategic/intel";

describe("known-vs-seen intel", () => {
  it("seeds at 3 — the initial materials", () => {
    expect(seedKnownVsSeen()).toEqual({ known: 3, scouted: 0, captured: 0 });
  });

  it("grows known as the income ledger (+1 to turn 10, +2 to turn 20, +3 after)", () => {
    expect(knownForTurn(1)).toBe(3);
    expect(knownForTurn(2)).toBe(4);
    expect(knownForTurn(10)).toBe(12);
    // Turn 11..20 add +2 each.
    expect(knownForTurn(11)).toBe(14);
    expect(knownForTurn(20)).toBe(32);
    // Turn 21+ add +3 each.
    expect(knownForTurn(21)).toBe(35);
    expect(knownForTurn(24)).toBe(44);
  });

  it("computes gap = known - (scouted - captured)", () => {
    expect(combineKnownVsSeen(14, 8, 3).gap).toBe(9);
    expect(combineKnownVsSeen(14, 16, 3).gap).toBe(1);
    expect(combineKnownVsSeen(14, 18, 4).gap).toBe(0);
    expect(combineKnownVsSeen(14, 20, 4).gap).toBe(-2);
  });

  it("hiddenMaterial is the gap", () => {
    const kvs = combineKnownVsSeen(14, 8, 3);
    expect(hiddenMaterial(kvs)).toBe(9);
    expect(hasHiddenMaterial(kvs)).toBe(true);
    expect(hasHiddenMaterial(combineKnownVsSeen(14, 18, 4))).toBe(false);
  });

  it("detects the cheese window when hidden material exists from turn 7", () => {
    expect(detectCheesePromotion(combineKnownVsSeen(12, 4, 0), 7)).toBe(true);
    expect(detectCheesePromotion(combineKnownVsSeen(12, 4, 0), 6)).toBe(false);
    expect(detectCheesePromotion(combineKnownVsSeen(12, 13, 0), 11)).toBe(false);
  });

  it("estimates from visible value only for snap-only callers", () => {
    const est = estimateKnownVsSeen(6, 10);
    expect(est.known).toBe(12);
    expect(est.scouted).toBe(6);
    expect(est.captured).toBe(0);
    expect(est.gap).toBe(6);
  });

  it("isWinning compares our counted material against the enemy's known", () => {
    expect(isWinning(15, 14)).toBe(true);
    expect(isWinning(14, 14)).toBe(false);
    expect(isWinning(10, 12)).toBe(false);
  });

  it("pieceValue and boardValue use the classic economy scale", () => {
    expect(pieceValue({ type: "p", color: "b" })).toBe(1);
    expect(pieceValue({ type: "r", color: "w" })).toBe(5);
    expect(pieceValue({ type: "q", color: "b" })).toBe(9);
    const map = new Map([
      ["a1", { type: "k", color: "w" }],
      ["a2", { type: "p", color: "w" }],
      ["h8", { type: "k", color: "b" }],
      ["h7", { type: "q", color: "b" }],
    ] as const);
    expect(boardValue(map, "w")).toBe(2);
    expect(boardValue(map, "b")).toBe(10);
  });
});