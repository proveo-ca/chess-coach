import { describe, expect, it } from "vitest";

import { intentOverlaysFromQueue } from "~/starchess/intentOverlays";
import type { ScAction } from "~/starchess/types";

describe("intentOverlaysFromQueue", () => {
  it("maps classical intent to a destination ghost with mover piece", () => {
    const actions: ScAction[] = [
      {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "h2",
        to: "g1",
        seq: 1,
      },
    ];
    expect(
      intentOverlaysFromQueue(actions, {
        placement: "K7/8/8/2N5/4k3/8/7B/8",
      }),
    ).toEqual({
      destinations: [{ at: "g1", color: "w", piece: "b" }],
      canisters: [],
      checks: [{ at: "e4" }],
    });
  });

  it("maps spawn to a destination ghost with the chosen unit", () => {
    const actions: ScAction[] = [
      {
        timing: "B",
        kind: "spawn",
        color: "w",
        from: "a8",
        to: "b8",
        unit: "r",
        seq: 0,
      },
    ];
    expect(intentOverlaysFromQueue(actions)).toEqual({
      destinations: [{ at: "b8", color: "w", piece: "r", rookMode: "tank" }],
      canisters: [{ at: "a8", color: "w" }],
      checks: [],
    });
  });

  it("maps specials to a canister on from and a dest ghost when to relocates", () => {
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
    expect(
      intentOverlaysFromQueue(actions, {
        placement: "4k3/8/8/8/8/8/8/3QK3",
      }),
    ).toEqual({
      destinations: [{ at: "d5", color: "w", piece: "q" }],
      canisters: [
        { at: "d1", color: "w" },
        { at: "b8", color: "b" },
      ],
      checks: [],
    });
  });

  it("hides opponent queue ghosts when viewer is set (player vs opponent)", () => {
    const actions: ScAction[] = [
      {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "h2",
        to: "g1",
        seq: 0,
      },
      {
        timing: "C",
        kind: "classical",
        color: "b",
        from: "e4",
        to: "d5",
        seq: 1,
      },
      {
        timing: "B",
        kind: "spawn",
        color: "b",
        from: "c5",
        to: "c4",
        unit: "p",
        seq: 2,
      },
    ];
    expect(
      intentOverlaysFromQueue(actions, {
        placement: "K7/8/8/2N5/4k3/8/7B/8",
        viewer: "w",
      }),
    ).toEqual({
      destinations: [{ at: "g1", color: "w", piece: "b" }],
      canisters: [],
      checks: [{ at: "e4" }],
    });
  });

  it("maps legal standing checks to red rings on the king square", () => {
    expect(
      intentOverlaysFromQueue([], {
        placement: "k7/5r2/8/2n5/4K3/8/7b/8",
        viewer: "w",
      }),
    ).toEqual({
      destinations: [],
      canisters: [],
      checks: [{ at: "e4" }],
    });
  });

  it("maps unsiege+move intent ghost as InlineRook tank mode", () => {
    const actions: ScAction[] = [
      {
        timing: "B",
        kind: "rookSiege",
        color: "w",
        from: "c4",
        seq: 0,
      },
      {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "c4",
        to: "c5",
        seq: 1,
      },
    ];
    expect(
      intentOverlaysFromQueue(actions, {
        placement: "4k3/8/8/8/2R5/8/8/4K3",
        siegedRooks: ["c4"],
      }),
    ).toEqual({
      destinations: [{ at: "c5", color: "w", piece: "r", rookMode: "tank" }],
      canisters: [{ at: "c4", color: "w" }],
      checks: [],
    });
  });

  it("returns empty overlays for an empty queue", () => {
    expect(intentOverlaysFromQueue([])).toEqual({
      destinations: [],
      canisters: [],
      checks: [],
    });
    expect(intentOverlaysFromQueue(undefined)).toEqual({
      destinations: [],
      canisters: [],
      checks: [],
    });
  });
});
