import { describe, expect, it } from "vitest";

import {
  FOG_EDGE_BISHOP_START_SCFEN,
  FOG_EDGE_BISHOP_STEPS,
  queueFogEdgeStep,
} from "~/starchess/demos/fogEdgeBishop";
import {
  FOG_EDGE_ROOK_TANK_START_SCFEN,
  FOG_EDGE_ROOK_TANK_STEPS,
  queueFogEdgeRookTankStep,
} from "~/starchess/demos/fogEdgeRookTank";
import { endScTurn } from "~/starchess/endScTurn";
import {
  applyPathRevealAttack,
  resolveTurn,
  type ResolveAttack,
  type PathRevealSnap,
} from "~/starchess/resolveTurn";
import { parseScFen } from "~/starchess/scfen";
import type { ScFenSnapshot } from "~/starchess/types";

const capture = (
  over: Partial<Extract<ResolveAttack, { kind: "capture" }>> = {},
): ResolveAttack => ({
  kind: "capture",
  piece: "r",
  color: "w",
  from: "d6",
  to: "d8",
  victim: { piece: "b", color: "b" },
  occupies: true,
  pathRevealFrom: "d3",
  pathRevealSteps: 3,
  ...over,
});

describe("applyPathRevealAttack — phase-3 fog approach fizzle rules", () => {
  it("converging same-side approaches: the second fizzles (no silent overwrite)", () => {
    // Black bishop d8; white rook d3 + white knight e3, both approach d8.
    const snap = { placement: "k2b4/8/8/8/8/3RN3/8/K7", mines: [] };
    const first = applyPathRevealAttack(
      snap,
      capture({ pathRevealFrom: "d3", from: "d5", to: "d8" }),
    );
    expect(first.fired).toBe(true);
    expect(first.placement).toBe("k2R4/8/8/8/8/4N3/8/K7");

    const second = applyPathRevealAttack(
      first,
      capture({ piece: "n", pathRevealFrom: "e3", from: "e5", to: "d8" }),
    );
    // d8 now holds the first attacker (not the in-the-way black bishop) — fizzle.
    expect(second.fired).toBe(false);
    expect(second.placement).toBe(first.placement);
  });

  it("ghost capture: target already removed → fizzle, attacker stays put", () => {
    const snap = { placement: "k7/8/8/8/8/3R4/8/K7", mines: [] };
    const res = applyPathRevealAttack(
      snap,
      capture({ pathRevealFrom: "d3", from: "d5", to: "d8" }),
    );
    expect(res.fired).toBe(false);
    expect(res.placement).toBe(snap.placement);
  });

  it("a different enemy on `to` (not the in-the-way victim) is never captured", () => {
    // Black rook on d8 instead of the discovered black bishop.
    const snap = { placement: "k2r4/8/8/8/8/3R4/8/K7", mines: [] };
    const res = applyPathRevealAttack(
      snap,
      capture({ pathRevealFrom: "d3", from: "d5", to: "d8" }),
    );
    expect(res.fired).toBe(false);
    expect(res.placement).toBe(snap.placement);
  });

  it("captures the in-the-way victim and clears an enemy mine on the square", () => {
    const snap: PathRevealSnap = {
      placement: "k2b4/8/8/8/8/3R4/8/K7",
      mines: [
        { at: "d8", color: "b" },
        { at: "e5", color: "w" },
      ],
    };
    const res = applyPathRevealAttack(
      snap,
      capture({ pathRevealFrom: "d3", from: "d5", to: "d8" }),
    );
    expect(res.fired).toBe(true);
    expect(res.placement).toBe("k2R4/8/8/8/8/8/8/K7");
    expect(res.mines.map((m) => m.at)).toEqual(["e5"]);
  });

  it("fizzles when the attacker no longer occupies pathRevealFrom", () => {
    const snap = { placement: "k2b4/8/8/8/8/8/8/K7", mines: [] };
    const res = applyPathRevealAttack(
      snap,
      capture({ pathRevealFrom: "d3", from: "d5", to: "d8" }),
    );
    expect(res.fired).toBe(false);
  });
});

describe("resolveTurn — phase-3 siege + origin-loss fizzle (end to end)", () => {
  // White rook a1, white king h1; black king a8, black pawn g7 (fogged).
  const placement = "k7/6p1/8/8/8/8/8/R6K";

  it("sieged rook never relocates: its fog approach fizzles", () => {
    const r = resolveTurn({
      placement,
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "a1", to: "g7" },
      black: null,
      isTargetVisible: () => false,
      pathVisionOpts: { rookModeFor: () => "siege" },
      siegedRooks: ["a1"],
    });
    expect(r.pathRevealAttacks).toEqual([]);
    expect(r.afterMove.placement).toBe(placement);
    expect(r.afterAll.placement).toBe(placement);
  });

  it("sieged rook never ghost-kills a fogged adjacent enemy", () => {
    // White sieged rook a2; black pawn b2 fogged and adjacent (no ray to
    // reveal along). The rook cannot relocate to "contact" it — fizzle.
    const r = resolveTurn({
      placement: "7k/8/8/8/8/8/Rp6/K7",
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "a2", to: "b2" },
      black: null,
      isTargetVisible: () => false,
      pathVisionOpts: { rookModeFor: () => "siege" },
      siegedRooks: ["a2"],
    });
    expect(r.attacks).toEqual([]);
    expect(r.afterMove.placement).toBe("7k/8/8/8/8/8/Rp6/K7");
    expect(r.afterAll.placement).toBe("7k/8/8/8/8/8/Rp6/K7");
  });

  it("unsieged rook in the same spot moves onto the fogged square and captures", () => {
    const r = resolveTurn({
      placement: "7k/8/8/8/8/8/Rp6/K7",
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "a2", to: "b2" },
      black: null,
      isTargetVisible: () => false,
      pathVisionOpts: { rookModeFor: () => "tank" },
    });
    expect(r.attacks[0]).toMatchObject({ kind: "capture", to: "b2", moveCollision: true });
    expect(r.afterAll.placement).toBe("7k/8/8/8/8/8/1R6/K7");
  });

  it("sieged rook still kills a VISIBLE adjacent enemy (turret in place)", () => {
    const r = resolveTurn({
      placement: "7k/8/8/8/8/8/Rp6/K7",
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "a2", to: "b2" },
      black: null,
      isTargetVisible: (_color, sq) => sq === "b2",      pathVisionOpts: { rookModeFor: () => "siege" },
      siegedRooks: ["a2"],
    });
    expect(r.attacks[0]).toMatchObject({ kind: "capture", to: "b2", victim: { piece: "p", color: "b" } });
    expect(r.afterAll.placement).toBe("7k/8/8/8/8/8/R7/K7");
  });

  it("sieged rook never steps onto a fogged enemy mine", () => {
    const r = resolveTurn({
      placement: "7k/8/8/8/8/8/R7/K7",
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "a2", to: "b2" },
      black: null,
      mines: [{ at: "b2", color: "b" }],
      isTargetVisible: () => false,
      pathVisionOpts: { rookModeFor: () => "siege" },
      siegedRooks: ["a2"],
    });
    expect(r.mineTriggers).toEqual([]);
    expect(r.moveCollisions).toEqual([]);
    expect(r.afterAll.placement).toBe("7k/8/8/8/8/8/R7/K7");
    expect(r.afterAll.mines.map((m) => m.at)).toEqual(["b2"]);
  });

  it("unsieged rook in the same spot detonates the fogged mine and occupies", () => {
    const r = resolveTurn({
      placement: "7k/8/8/8/8/8/R7/K7",
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "a2", to: "b2" },
      black: null,
      mines: [{ at: "b2", color: "b" }],
      isTargetVisible: () => false,
      pathVisionOpts: { rookModeFor: () => "tank" },
    });
    expect(r.moveCollisions[0]).toMatchObject({ kind: "mineBlast", to: "b2", mineColor: "b" });
    expect(r.afterAll.placement).toBe("7k/8/8/8/8/8/1R6/K7");
    expect(r.afterAll.mines).toEqual([]);
  });

  it("sieged rook still destroys a VISIBLE enemy mine (turret in place)", () => {
    const r = resolveTurn({
      placement: "7k/8/8/8/8/8/R7/K7",
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "a2", to: "b2" },
      black: null,
      mines: [{ at: "b2", color: "b" }],
      isTargetVisible: (_color, sq) => sq === "b2",
      pathVisionOpts: { rookModeFor: () => "siege" },
      siegedRooks: ["a2"],
    });
    expect(r.attacks[0]).toMatchObject({ kind: "mineBlast", to: "b2", mineColor: "b" });
    expect(r.afterAll.placement).toBe("7k/8/8/8/8/8/R7/K7");
    expect(r.afterAll.mines).toEqual([]);
  });

  it("same setup unsieged (tank) fires and captures the hidden pawn", () => {
    const r = resolveTurn({
      placement,
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "a1", to: "g7" },
      black: null,
      isTargetVisible: () => false,
      pathVisionOpts: { rookModeFor: () => "tank" },
    });
    expect(r.pathRevealAttacks[0]).toMatchObject({
      kind: "capture",
      piece: "r",
      color: "w",
      to: "g7",
      pathRevealFrom: "a1",
      victim: { piece: "p", color: "b" },
      occupies: true,
    });
    expect(r.afterAll.placement).toBe("k7/6R1/8/8/8/8/8/7K");
  });

  it("approach fizzles when a phase-2 mover took over its origin square", () => {
    // White bishop d4 intends d4→h8 (path-reveal on fogged g7 pawn), while the
    // black rook h4→d4 capture removes the bishop in phase 1 and occupies d4 in
    // phase 2 — the approach origin is gone.
    const r = resolveTurn({
      placement: "7k/6p1/8/8/3B3r/8/8/K7",
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "d4", to: "h8" },
      black: { color: "b", from: "h4", to: "d4" },
      isTargetVisible: (color, sq) => (color === "b" ? true : sq !== "g7"),
      pathVisionOpts: { rookModeFor: () => "tank" },
    });
    expect(r.attacks[0]).toMatchObject({
      kind: "capture",
      from: "h4",
      to: "d4",
      victim: { piece: "b", color: "w" },
    });
    expect(r.pathRevealAttacks).toEqual([]);
    expect(r.afterMove.placement).toBe("7k/6p1/8/8/3r4/8/8/K7");
    expect(r.afterAll.placement).toBe(r.afterMove.placement);
  });
});

describe("phase-3 replay invariant (UI single source of truth)", () => {
  const replay = (snapshot: ScFenSnapshot, step: number) => {
    const queued =
      snapshot === parseScFen(FOG_EDGE_ROOK_TANK_START_SCFEN)
        ? queueFogEdgeRookTankStep(snapshot, FOG_EDGE_ROOK_TANK_STEPS[step]!)
        : queueFogEdgeStep(snapshot, FOG_EDGE_BISHOP_STEPS[step]!);
    const { resolved } = endScTurn(queued);
    let snap: PathRevealSnap = {
      placement: resolved.afterMove.placement,
      mines: [...resolved.afterMove.mines],
    };
    for (const a of resolved.pathRevealAttacks) {
      snap = applyPathRevealAttack(snap, a);
    }
    expect(snap.placement).toBe(resolved.afterAll.placement);
    expect([...snap.mines]).toEqual(resolved.afterAll.mines);
  };

  it("fog-edge bishop: replaying fired approaches from afterMove lands on afterAll", () => {
    replay(parseScFen(FOG_EDGE_BISHOP_START_SCFEN), 0);
  });

  it("fog-edge rook tank: same invariant", () => {
    replay(parseScFen(FOG_EDGE_ROOK_TANK_START_SCFEN), 0);
  });

  it("resolveTurn tank capture: same invariant", () => {
    const r = resolveTurn({
      placement: "k7/6p1/8/8/8/8/8/R6K",
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "a1", to: "g7" },
      black: null,
      isTargetVisible: () => false,
      pathVisionOpts: { rookModeFor: () => "tank" },
    });
    let snap: PathRevealSnap = {
      placement: r.afterMove.placement,
      mines: [...r.afterMove.mines],
    };
    for (const a of r.pathRevealAttacks) {
      snap = applyPathRevealAttack(snap, a);
    }
    expect(snap.placement).toBe(r.afterAll.placement);
    expect([...snap.mines]).toEqual(r.afterAll.mines);
  });
});
