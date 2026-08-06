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
    ).toEqual({
      destinations: [{ at: "g1", color: "w", piece: "b" }],
      canisters: [],
      checks: [{ at: "e4" }],
    });
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
    ).toEqual({
      destinations: [
        { at: "g1", color: "w", piece: "b" },
        { at: "d5", color: "b", piece: "k" },
      ],
      canisters: [],
      checks: [{ at: "e4" }],
    });
  });

  it("places a canister badge on queued special actors", () => {
    const actions: ScAction[] = [
      {
        timing: "B",
        kind: "pawnDouble",
        color: "w",
        from: "e2",
        to: "e3",
        seq: 0,
      },
    ];
    expect(
      intentOverlaysFromQueue(actions, {
        placement: "4k3/8/8/8/8/8/4P3/4K3",
        viewer: "w",
      }).canisters,
    ).toEqual([{ at: "e2", color: "w" }]);
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

  it("rings a capture destination when attack intent is queued", () => {
    const actions: ScAction[] = [
      {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "a1",
        to: "e5",
        seq: 0,
      },
    ];
    expect(
      intentOverlaysFromQueue(actions, {
        placement: "k7/8/8/4n3/4P3/8/8/B6K",
        viewer: "w",
      }).checks,
    ).toEqual([{ at: "e5" }]);
  });

  it("projects a red ring when queued classical would give check", () => {
    // Bd2→f4 discovers check on Ke5 (not checking yet from d2).
    const actions: ScAction[] = [
      {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "d2",
        to: "f4",
        seq: 0,
      },
    ];
    expect(
      intentOverlaysFromQueue(actions, {
        placement: "8/8/8/4k3/8/8/3B4/7K",
        viewer: "w",
      }).checks,
    ).toEqual([{ at: "e5" }]);
  });

  it("does not project opponent classical moves into check rings (no intent leak)", () => {
    // Black Ke4→d5 would discover nothing useful; white must not see black's
    // destination via projected geometry. Only standing checks from current board.
    const actions: ScAction[] = [
      {
        timing: "C",
        kind: "classical",
        color: "b",
        from: "e4",
        to: "d5",
        seq: 0,
      },
      {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "h2",
        to: "g1",
        seq: 1,
      },
    ];
    const out = intentOverlaysFromQueue(actions, {
      placement: "K7/8/8/2N5/4k3/8/7B/8",
      viewer: "w",
    });
    expect(out.destinations).toEqual([{ at: "g1", color: "w", piece: "b" }]);
    expect(out.canisters).toEqual([]);
    // Standing check on e4 (Nc5) — not a black-intent ring on d5.
    expect(out.checks).toEqual([{ at: "e4" }]);
    expect(out.checks.some((c) => c.at === "d5")).toBe(false);
  });
});
