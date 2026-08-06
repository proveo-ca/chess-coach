import { describe, expect, it } from "vitest";

import type { ScAction } from "@chess-coach/starchess-core";

import { intentOverlaysFromQueue } from "~/presentation/combat/intentOverlays";

describe("intentOverlaysFromQueue", () => {
  it("hides opponent queue ghosts when viewer is set (live player)", () => {
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
    ).toEqual([{ at: "g1", color: "w", piece: "b" }]);
  });

  it("shows both sides when viewer is omitted (DualNav / observer)", () => {
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
    ];
    expect(
      intentOverlaysFromQueue(actions, {
        placement: "K7/8/8/2N5/4k3/8/7B/8",
      }),
    ).toEqual([
      { at: "g1", color: "w", piece: "b" },
      { at: "d5", color: "b", piece: "k" },
    ]);
  });
});
