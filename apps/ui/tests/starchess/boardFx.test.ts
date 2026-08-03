import { describe, expect, it } from "vitest";

import {
  EMPTY_FX_HIDDEN,
  buildFxHiddenSquares,
  hasCombatFxInput,
} from "~/starchess/boardFx";

describe("boardFx (classical isolation)", () => {
  it("treats missing cues as inactive — Coach/Analysis default", () => {
    expect(hasCombatFxInput({})).toBe(false);
    expect(buildFxHiddenSquares({})).toBe(EMPTY_FX_HIDDEN);
    expect(buildFxHiddenSquares({ attacks: [], deaths: [], moves: [] })).toBe(EMPTY_FX_HIDDEN);
  });

  it("hides attack from / death at / move from+to / king damage", () => {
    const hide = buildFxHiddenSquares({
      attacks: [{ id: "a", piece: "n", color: "b", from: "c5", to: "e4" }],
      deaths: [{ id: "d", piece: "n", color: "b", at: "c5" }],
      moves: [{ id: "m", piece: "r", color: "b", from: "f7", to: "f6" }],
      kingDamage: [{ id: "w", at: "e4", damage: "smallFire" }],
    });
    expect(hide).not.toBe(EMPTY_FX_HIDDEN);
    expect([...hide].sort()).toEqual(["c5", "e4", "f6", "f7"]);
  });

  it("includes flee cover after king damage slides", () => {
    const hide = buildFxHiddenSquares({
      kingDamage: [{ id: "w", at: "c5", damage: "smallFire" }],
      fleeCover: new Set(["d5"]),
    });
    expect(hide.has("c5")).toBe(true);
    expect(hide.has("d5")).toBe(true);
  });

  it("keeps Tactical Jump trails alive without hiding board pieces", () => {
    const fx = {
      jumpTrails: [{ id: "t", color: "w" as const, from: "a1" as const, to: "c3" as const }],
    };
    expect(hasCombatFxInput(fx)).toBe(true);
    expect(buildFxHiddenSquares(fx).size).toBe(0);
  });
});
