import { describe, expect, it } from "vitest";
import type { Color, PieceSymbol, Square } from "chess.js";

import { deployCuesForBoardDiff } from "~/starchess/hooks/useAutoDeploy";

type PieceAt = { type: PieceSymbol; color: Color };

const mapOf = (entries: [Square, PieceAt][]) => new Map(entries);

describe("deployCuesForBoardDiff", () => {
  it("fires deploy when a unit appears without relocating", () => {
    const prev = mapOf([
      ["e1", { type: "k", color: "w" }],
      ["e8", { type: "k", color: "b" }],
    ]);
    const next = mapOf([
      ["e1", { type: "k", color: "w" }],
      ["e8", { type: "k", color: "b" }],
      ["d1", { type: "r", color: "w" }],
    ]);
    const cues = deployCuesForBoardDiff(prev, next);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ piece: "r", color: "w", at: "d1" });
  });

  it("does not deploy quiet relocates", () => {
    const prev = mapOf([
      ["d1", { type: "r", color: "w" }],
      ["e1", { type: "k", color: "w" }],
    ]);
    const next = mapOf([
      ["a1", { type: "r", color: "w" }],
      ["e1", { type: "k", color: "w" }],
    ]);
    expect(deployCuesForBoardDiff(prev, next)).toEqual([]);
  });

  it("does not deploy kings", () => {
    const prev = mapOf([["e1", { type: "k", color: "w" }]]);
    const next = mapOf([
      ["e1", { type: "k", color: "w" }],
      ["e8", { type: "k", color: "b" }],
    ]);
    expect(deployCuesForBoardDiff(prev, next)).toEqual([]);
  });

  it("does not deploy captures that only remove a piece", () => {
    const prev = mapOf([
      ["d1", { type: "r", color: "w" }],
      ["a4", { type: "n", color: "b" }],
    ]);
    const next = mapOf([["d1", { type: "r", color: "w" }]]);
    expect(deployCuesForBoardDiff(prev, next)).toEqual([]);
  });
});
