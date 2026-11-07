// SPEC: _spec/game-core.puml
import { describe, expect, test } from "bun:test";
import { scOutcome } from "../src";

describe("canonical terminal outcomes", () => {
  test.each([
    [0, 0, { winner: null, draw: true }],
    [-1, 0, { winner: null, draw: true }],
    [0, 3, { winner: "b", draw: false }],
    [3, 0, { winner: "w", draw: false }],
  ] as const)("resolves CC lives %i:%i", (w, b, expected) => {
    expect(scOutcome({ ccLives: { w, b }, turn: 1 })).toEqual(expected);
  });

  test("keeps unequal surviving lives nonterminal before the cap", () => {
    expect(scOutcome({ ccLives: { w: 3, b: 1 } })).toBeNull();
    expect(scOutcome({ ccLives: { w: 1, b: 3 }, turn: 44 })).toBeNull();
  });

  test.each([45, 46])("compares surviving CC lives at turn %i", turn => {
    expect(scOutcome({ ccLives: { w: 3, b: 2 }, turn })).toEqual({ winner: "w", draw: false });
    expect(scOutcome({ ccLives: { w: 2, b: 3 }, turn })).toEqual({ winner: "b", draw: false });
    expect(scOutcome({ ccLives: { w: 2, b: 2 }, turn })).toEqual({ winner: null, draw: true });
  });
});
