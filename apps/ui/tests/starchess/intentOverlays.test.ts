import { describe, expect, it } from "vitest";

import { intentOverlaysFromQueue } from "~/starchess/intentOverlays";
import type { ScAction } from "~/types/starchess";

describe("intentOverlaysFromQueue", () => {
  it("maps classical intent to a destination ghost (not from)", () => {
    const actions: ScAction[] = [
      {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "a1",
        to: "a8",
        seq: 1,
      },
    ];
    expect(intentOverlaysFromQueue(actions)).toEqual({
      destinations: [{ at: "a8", color: "w" }],
      canisters: [],
    });
  });

  it("maps specials to a canister on from and a dest ring when to is set", () => {
    const actions: ScAction[] = [
      {
        timing: "B",
        kind: "queenWarp",
        color: "w",
        from: "d1",
        to: "d5",
        seq: 1,
      },
      {
        timing: "F",
        kind: "knightMine",
        color: "b",
        from: "b8",
        seq: 2,
      },
    ];
    expect(intentOverlaysFromQueue(actions)).toEqual({
      destinations: [{ at: "d5", color: "w" }],
      canisters: [
        { at: "d1", color: "w" },
        { at: "b8", color: "b" },
      ],
    });
  });

  it("returns empty overlays for an empty queue", () => {
    expect(intentOverlaysFromQueue([])).toEqual({ destinations: [], canisters: [] });
    expect(intentOverlaysFromQueue(undefined)).toEqual({ destinations: [], canisters: [] });
  });
});
