import { describe, expect, it } from "vitest";

import type { Square } from "chess.js";
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
        kind: "deploy",
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

  it("badges both the live special actor and its gas ghost", () => {
    const actions: ScAction[] = [
      {
        timing: "B",
        kind: "stimStep",
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
    ).toEqual([
      { at: "e2", color: "w" },
      { at: "e3", color: "w" },
    ]);
  });

  it("maps legal standing checks to red rings on the Command Center square", () => {
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
    // Pe4 lights e5 now, so the ring reveals nothing the viewer cannot see.
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
        placement: "8/8/8/4k3/4P3/8/3B4/7K",
        viewer: "w",
      }).checks,
    ).toEqual([{ at: "e5" }]);
  });

  it("never rings a Command Center the viewer cannot see yet (fog leak at intent)", () => {
    // Nc4→d6 would light *and* check Ke8 once it resolves, but at intent time
    // e8 is still fogged — a ring there would confirm the hidden Command Center.
    const actions: ScAction[] = [
      {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "c4",
        to: "d6",
        seq: 0,
      },
    ];
    const out = intentOverlaysFromQueue(actions, {
      placement: "4k3/8/8/8/2N5/8/8/7K",
      viewer: "w",
    });
    expect(out.checks).toEqual([]);
    expect(out.destinations).toEqual([{ at: "d6", color: "w", piece: "n" }]);
  });

  it("keeps observer / DualNav projections unringed by fog (no viewer)", () => {
    const actions: ScAction[] = [
      {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "c4",
        to: "d6",
        seq: 0,
      },
    ];
    expect(
      intentOverlaysFromQueue(actions, {
        placement: "4k3/8/8/8/2N5/8/8/7K",
      }).checks,
    ).toEqual([{ at: "e8" }]);
  });

  it("spawn + classical: deploy ghost with canister, move ghost without", () => {
    // B deploy marine d1, C d1→d2 — both ghosts; gas only on deploy square.
    const actions: ScAction[] = [
      {
        timing: "B",
        kind: "deploy",
        color: "w",
        from: "e1",
        to: "d1",
        unit: "p",
        seq: 0,
      },
      {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "d1",
        to: "d2",
        seq: 1,
      },
    ];
    const out = intentOverlaysFromQueue(actions, {
      placement: "4k3/8/8/8/8/8/8/4K3",
      viewer: "w",
    });
    expect(out.destinations).toEqual([
      { at: "d1", color: "w", piece: "p" },
      { at: "d2", color: "w", piece: "p" },
    ]);
    expect(out.canisters).toEqual([{ at: "d1", color: "w" }]);
    expect(out.canisters.some((c) => c.at === "d2")).toBe(false);
  });

  it("gas landing + classical: B ghost and further move ghost", () => {
    // C is queued from the post-gas landing, so the resolver never folds the
    // legs — e3 stays the gas ghost and the marine really does stop on e4.
    const actions: ScAction[] = [
      {
        timing: "B",
        kind: "stimStep",
        color: "w",
        from: "e2",
        to: "e3",
        seq: 0,
      },
      {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "e3",
        to: "e4",
        seq: 1,
      },
    ];
    const out = intentOverlaysFromQueue(actions, {
      placement: "4k3/8/8/8/8/8/4P3/4K3",
      viewer: "w",
    });
    expect(out.destinations).toEqual([
      { at: "e3", color: "w", piece: "p", via: "gas" },
      { at: "e4", color: "w", piece: "p" },
    ]);
    expect(out.canisters).toEqual([
      { at: "e2", color: "w" },
      { at: "e3", color: "w" },
    ]);
  });

  describe("stacked gas + move — ghost lands on the resolver's endpoint", () => {
    // The queue never records the composed landing square: the resolver folds
    // the legs at End. Painting the raw `to` leaves the square the player is
    // actually aiming at unmarked.

    it("start-rank stack: B e2→e3 + C e2→e4 lands e5", () => {
      const actions: ScAction[] = [
        {
          timing: "B",
          kind: "stimStep",
          color: "w",
          from: "e2",
          to: "e3",
          seq: 0,
        },
        {
          timing: "C",
          kind: "classical",
          color: "w",
          from: "e2",
          to: "e4",
          seq: 1,
        },
      ];
      const out = intentOverlaysFromQueue(actions, {
        placement: "4k3/8/8/8/8/8/4P3/4K3",
        viewer: "w",
      });
      expect(out.destinations).toEqual(
        expect.arrayContaining([
          { at: "e4", color: "w", piece: "p" },
          { at: "e5", color: "w", piece: "p", via: "gas" },
        ]),
      );
      expect(out.destinations).toHaveLength(2);
      expect(out.destinations.some((d) => d.at === "e3")).toBe(false);
      expect(out.canisters).toEqual(
        expect.arrayContaining([
          { at: "e2", color: "w" },
          { at: "e5", color: "w" },
        ]),
      );
    });

    it("same-vector stack: B e6→e7 + C e6→e7 lands e8", () => {
      // Both actions carry `to: e7`; the endpoint projection is also what keeps
      // the destination dedup from collapsing them into one ghost.
      const actions: ScAction[] = [
        {
          timing: "B",
          kind: "stimStep",
          color: "w",
          from: "e6",
          to: "e7",
          seq: 0,
        },
        {
          timing: "C",
          kind: "classical",
          color: "w",
          from: "e6",
          to: "e7",
          seq: 1,
        },
      ];
      const out = intentOverlaysFromQueue(actions, {
        placement: "8/8/4P3/8/8/8/8/4K2k",
        viewer: "w",
      });
      expect(out.destinations).toEqual(
        expect.arrayContaining([
          { at: "e7", color: "w", piece: "p" },
          { at: "e8", color: "w", piece: "p", via: "gas" },
        ]),
      );
      expect(out.destinations).toHaveLength(2);
    });

    it("paints a tank on the last rank when the stack chose one", () => {
      const actions: ScAction[] = [
        {
          timing: "B",
          kind: "stimStep",
          color: "w",
          from: "e6",
          to: "e7",
          seq: 0,
        },
        {
          timing: "C",
          kind: "classical",
          color: "w",
          from: "e6",
          to: "e7",
          promotion: "r",
          seq: 1,
        },
      ];
      const out = intentOverlaysFromQueue(actions, {
        placement: "8/8/4P3/8/8/8/8/4K2k",
        viewer: "w",
      });
      expect(out.destinations).toEqual(
        expect.arrayContaining([
          { at: "e7", color: "w", piece: "p" },
          { at: "e8", color: "w", piece: "r", via: "gas", tankMode: "tank" },
        ]),
      );
    });

    it("paints a gas-only tank promotion on the last rank", () => {
      const actions: ScAction[] = [
        {
          timing: "B",
          kind: "stimStep",
          color: "w",
          from: "e7",
          to: "e8",
          promotion: "r",
          seq: 0,
        },
      ];
      const out = intentOverlaysFromQueue(actions, {
        placement: "k7/4P3/8/8/8/8/8/4K3",
        viewer: "w",
      });
      expect(out.destinations).toEqual([
        { at: "e8", color: "w", piece: "r", via: "gas", tankMode: "tank" },
      ]);
    });

    it("paints a classical tank promotion on the last rank", () => {
      const actions: ScAction[] = [
        {
          timing: "C",
          kind: "classical",
          color: "w",
          from: "e7",
          to: "e8",
          promotion: "r",
          seq: 0,
        },
      ];
      const out = intentOverlaysFromQueue(actions, {
        placement: "k7/4P3/8/8/8/8/8/4K3",
        viewer: "w",
      });
      expect(out.destinations).toEqual([
        { at: "e8", color: "w", piece: "r", tankMode: "tank" },
      ]);
    });

    it("move then gas: C e2→e4 + F e2→e3 lands e5", () => {
      // F is a placeholder for pre-move geometry — the resolver recomputes +1
      // from the classical landing.
      const actions: ScAction[] = [
        {
          timing: "C",
          kind: "classical",
          color: "w",
          from: "e2",
          to: "e4",
          seq: 0,
        },
        {
          timing: "F",
          kind: "stimStep",
          color: "w",
          from: "e2",
          to: "e3",
          seq: 1,
        },
      ];
      const out = intentOverlaysFromQueue(actions, {
        placement: "4k3/8/8/8/8/8/4P3/4K3",
        viewer: "w",
      });
      expect(out.destinations).toEqual(
        expect.arrayContaining([
          { at: "e4", color: "w", piece: "p" },
          { at: "e5", color: "w", piece: "p", via: "gas" },
        ]),
      );
      expect(out.destinations.some((d) => d.at === "e3")).toBe(false);
    });

    it("blocked landing: rewrite is declined, gas ghost stays on B.to", () => {
      // Enemy Tank on e5 — core skips the rewrite so the classical fizzles and
      // the marine parks on the gas step. Never paint e5.
      const actions: ScAction[] = [
        {
          timing: "B",
          kind: "stimStep",
          color: "w",
          from: "e2",
          to: "e3",
          seq: 0,
        },
        {
          timing: "C",
          kind: "classical",
          color: "w",
          from: "e2",
          to: "e4",
          seq: 1,
        },
      ];
      const out = intentOverlaysFromQueue(actions, {
        placement: "4k3/8/8/4r3/8/8/4P3/4K3",
        viewer: "w",
      });
      expect(out.destinations.some((d) => d.at === "e5")).toBe(false);
      expect(out.destinations).toEqual(
        expect.arrayContaining([
          { at: "e3", color: "w", piece: "p", via: "gas" },
        ]),
      );
    });

    it("BattleShip warp + classical stack lands past the warp square", () => {
      const actions: ScAction[] = [
        {
          timing: "B",
          kind: "tacticalJump",
          color: "w",
          from: "d1",
          to: "d3",
          seq: 0,
        },
        {
          timing: "C",
          kind: "classical",
          color: "w",
          from: "d1",
          to: "d3",
          seq: 1,
        },
      ];
      const out = intentOverlaysFromQueue(actions, {
        placement: "4k3/8/8/8/8/8/8/3QK3",
        viewer: "w",
      });
      expect(out.destinations).toEqual(
        expect.arrayContaining([
          { at: "d3", color: "w", piece: "q" },
          { at: "d5", color: "w", piece: "q", via: "gas" },
        ]),
      );
    });
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

  describe("marine front step — never an attack", () => {
    const frontStep = (from: Square, to: Square): ScAction[] => [
      { timing: "C", kind: "classical", color: "w", from, to, seq: 0 },
    ];

    it("does not ring a unit straight ahead, or project a capture", () => {
      // d2→d3 is blocked by the black marine: no capture ring on d3, and the
      // projection must not walk the marine onto d3 where it would check Ke4.
      const out = intentOverlaysFromQueue(frontStep("d2", "d3"), {
        placement: "8/8/8/8/4k3/3p4/3P4/7K",
      });
      expect(out.checks).toEqual([]);
      // The ghost still paints — under fog the player does not know it blocks.
      expect(out.destinations).toEqual([{ at: "d3", color: "w", piece: "p" }]);
    });

    it("does not ring a mine straight ahead (the marine walks in and dies)", () => {
      const out = intentOverlaysFromQueue(frontStep("d2", "d3"), {
        placement: "4k3/8/8/8/8/8/3P4/4K3",
        mines: [{ color: "b", at: "d3" }],
      });
      expect(out.checks).toEqual([]);
    });

    it("still rings the front diagonals", () => {
      const out = intentOverlaysFromQueue(frontStep("d2", "c3"), {
        placement: "4k3/8/8/8/8/2p5/3P4/4K3",
      });
      expect(out.checks).toEqual([{ at: "c3" }]);
    });
  });
});
