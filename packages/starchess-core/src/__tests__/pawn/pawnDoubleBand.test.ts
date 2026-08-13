/**
 * The double-step band and the classical-after-B rewrite, unit level.
 *
 * `rewriteClassicalAfterB` is public because planning projections (intent
 * ghosts) need the composed landing square — the queue only ever records the
 * pre-rewrite legs. These cases pin the contract those projections rely on.
 * // SPEC: _spec/packages/starchess-core/sc-moves.puml
 */
import { describe, expect, it } from "vitest";

import {
  canClassicalPawnDouble,
  canPawnDoubleStep,
  placementToMap,
  rewriteClassicalAfterB,
  scMovesFrom,
  type ScAction,
} from "../../index";

/** White marine on d1 behind its king, black king parked off the file. */
const WHITE_BACK_RANK = "4k3/8/8/8/8/8/8/3PK3";
/** Black marine on d8 behind its king. */
const BLACK_BACK_RANK = "3pk3/8/8/8/8/8/8/4K3";
const WHITE_START_RANK = "4k3/8/8/8/8/8/3P4/4K3";

describe("canPawnDoubleStep", () => {
  it("covers the start rank and everything behind it", () => {
    expect(canPawnDoubleStep("d2", "w")).toBe(true);
    expect(canPawnDoubleStep("d1", "w")).toBe(true);
    expect(canPawnDoubleStep("d3", "w")).toBe(false);
    expect(canPawnDoubleStep("d7", "b")).toBe(true);
    expect(canPawnDoubleStep("d8", "b")).toBe(true);
    expect(canPawnDoubleStep("d6", "b")).toBe(false);
  });
});

describe("double-step generation", () => {
  it("offers the double from a deployed back-rank marine", () => {
    const map = placementToMap(WHITE_BACK_RANK);
    const dests = scMovesFrom(map, "d1", "w").map((m) => m.to);
    expect(dests).toContain("d2");
    expect(dests).toContain("d3");
  });

  it("mirrors for black", () => {
    const map = placementToMap(BLACK_BACK_RANK);
    const dests = scMovesFrom(map, "d8", "b").map((m) => m.to);
    expect(dests).toContain("d7");
    expect(dests).toContain("d6");
  });

  it("still refuses the double from mid-board", () => {
    const map = placementToMap("4k3/8/8/8/8/3P4/8/4K3");
    expect(scMovesFrom(map, "d3", "w").map((m) => m.to)).not.toContain("d5");
  });

  it("blocked path denies the double", () => {
    const map = placementToMap("4k3/8/8/8/8/8/3n4/3PK3");
    expect(scMovesFrom(map, "d1", "w").map((m) => m.to)).not.toContain("d3");
  });
});

describe("canClassicalPawnDouble", () => {
  // chess.js rejects a placement with a pawn on the edge rows outright, so the
  // free-double affordance used to go dark exactly where a marine is deployed.
  it("reports the free double for a back-rank marine", () => {
    expect(canClassicalPawnDouble(WHITE_BACK_RANK, "d1")).toBe(true);
    expect(canClassicalPawnDouble(BLACK_BACK_RANK, "d8")).toBe(true);
  });

  it("still reports it on the start rank", () => {
    expect(canClassicalPawnDouble(WHITE_START_RANK, "d2")).toBe(true);
  });

  it("is false off the band, on a blocker, and for non-pawns", () => {
    expect(canClassicalPawnDouble("4k3/8/8/8/8/3P4/8/4K3", "d3")).toBe(false);
    expect(canClassicalPawnDouble("4k3/8/8/8/8/8/3n4/3PK3", "d1")).toBe(false);
    expect(canClassicalPawnDouble(WHITE_BACK_RANK, "e1")).toBe(false);
    expect(canClassicalPawnDouble(WHITE_BACK_RANK, "a5")).toBe(false);
  });
});

describe("rewriteClassicalAfterB", () => {
  const act = (a: Omit<ScAction, "seq">, seq: number): ScAction =>
    ({ ...a, seq }) as ScAction;

  it("folds a back-rank gas stack into a 3-square advance", () => {
    const out = rewriteClassicalAfterB(
      [
        act(
          { timing: "B", kind: "pawnDouble", color: "w", from: "d1", to: "d2" },
          0,
        ),
        act(
          { timing: "C", kind: "classical", color: "w", from: "d1", to: "d3" },
          1,
        ),
      ],
      WHITE_BACK_RANK,
    );
    expect(out[1]).toMatchObject({ from: "d2", to: "d4" });
  });

  it("folds the same-vector single step", () => {
    const out = rewriteClassicalAfterB(
      [
        act(
          { timing: "B", kind: "pawnDouble", color: "w", from: "d2", to: "d3" },
          0,
        ),
        act(
          { timing: "C", kind: "classical", color: "w", from: "d2", to: "d3" },
          1,
        ),
      ],
      WHITE_START_RANK,
    );
    expect(out[1]).toMatchObject({ from: "d3", to: "d4" });
  });

  it("declines when the composed landing is occupied", () => {
    // Intent overlays lean on this: a declined rewrite means the classical
    // fizzles, so the ghost must stay on the gas step rather than paint d4.
    const out = rewriteClassicalAfterB(
      [
        act(
          { timing: "B", kind: "pawnDouble", color: "w", from: "d1", to: "d2" },
          0,
        ),
        act(
          { timing: "C", kind: "classical", color: "w", from: "d1", to: "d3" },
          1,
        ),
      ],
      "4k3/8/8/8/3r4/8/8/3PK3",
    );
    expect(out[1]).toMatchObject({ from: "d1", to: "d3" });
  });

  it("leaves a 2-rank C from outside the band alone", () => {
    const out = rewriteClassicalAfterB(
      [
        act(
          { timing: "B", kind: "pawnDouble", color: "w", from: "d5", to: "d6" },
          0,
        ),
        act(
          { timing: "C", kind: "classical", color: "w", from: "d5", to: "d7" },
          1,
        ),
      ],
      "4k3/8/8/3P4/8/8/8/4K3",
    );
    expect(out[1]).toMatchObject({ from: "d5", to: "d7" });
  });
});
