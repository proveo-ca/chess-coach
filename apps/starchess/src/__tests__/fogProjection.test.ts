import { describe, expect, it } from "vitest";
import type { Square } from "chess.js";

import { getSideVision, parseScFen, placementToMap } from "@chess-coach/starchess-core";

import {
  fogWithGasUsedReveal,
  mapWithMovePathOccupancy,
  getVisionBorderPaths,
  observerVisionFromSnap,
} from "~/presentation/board/fogProjection";
import { MOVE_SQUARE_MS } from "~/presentation/constants";
import { COMBAT_CHAIN_START_SCFEN } from "~/demos/combatChain";

describe("fogProjection", () => {
  it("does not pierce fog for enemy gas-used squares", () => {
    const base = {
      litSquares: new Set<Square>(["e1", "e2"]),
      revealedPieces: new Set<Square>(),
    };
    const out = fogWithGasUsedReveal(
      base,
      new Set<Square>(["e5"]),
      "w",
      {
        placement: "4k3/8/8/4n3/8/8/8/4K3",
        turn: 0,
        kingLives: { w: 3, b: 3 },
        phase: "P",
        gas: { w: 1, b: 1 },
        gasIncome: { w: 1, b: 1 },
      },
    );
    expect(out.revealedPieces.has("e5")).toBe(false);
    expect(out.litSquares.has("e5")).toBe(false);
    expect([...out.litSquares].sort()).toEqual(["e1", "e2"]);
  });

  it("does not reveal friendly specialsUsed as fog pierce", () => {
    const base = {
      litSquares: new Set<Square>(),
      revealedPieces: new Set<Square>(),
    };
    const out = fogWithGasUsedReveal(
      base,
      new Set<Square>(["e2"]),
      "w",
      {
        placement: "4k3/8/8/8/8/8/4P3/4K3",
        turn: 0,
        kingLives: { w: 3, b: 3 },
        phase: "P",
        gas: { w: 1, b: 1 },
        gasIncome: { w: 1, b: 1 },
      },
    );
    expect(out.revealedPieces.has("e2")).toBe(false);
  });
});

describe("mapWithMovePathOccupancy", () => {
  it("relocates a sliding bishop along the diagonal for progressive fog", () => {
    // Bd4 + Ka1 — g7 pawn stays outside rest vision; e5/f6 may already be lit.
    const map = placementToMap("7k/6p1/8/8/3B4/8/8/K7");
    const atStart = getSideVision(map, "w");
    expect(atStart.litSquares.has("g7")).toBe(false);

    // Fog-edge approach lands the bishop on e5 (pathRevealFrom d4 → from e5).
    const mid = mapWithMovePathOccupancy(
      map,
      [{ id: "b1", from: "d4", to: "e5", piece: "b", startedAt: 0 }],
      MOVE_SQUARE_MS,
    );
    expect(mid.get("e5")?.type).toBe("b");
    expect(mid.get("d4")).toBeUndefined();
    const vision = getSideVision(mid, "w");
    // From e5 the bishop ray reaches the hidden pawn on g7.
    expect(vision.litSquares.has("g7")).toBe(true);
  });

  it("still lights path fog when a king is absent (no chess.js FEN gate)", () => {
    // Kingless SCFEN-ish occupancy — chess.js would reject this as Invalid FEN.
    const map = placementToMap("8/6p1/8/8/3B4/8/8/8");
    const mid = mapWithMovePathOccupancy(
      map,
      [{ id: "b1", from: "d4", to: "e5", piece: "b", startedAt: 0 }],
      MOVE_SQUARE_MS,
    );
    expect(getSideVision(mid, "w").litSquares.has("g7")).toBe(true);
  });
});

describe("getVisionBorderPaths", () => {
  it("emits only exterior edges for a 2×2 block (no interior grid)", () => {
    const cells = [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
    ];
    const paths = getVisionBorderPaths(cells);
    // 2×2 union perimeter = 8 outer edges (not 16 from per-cell strokes).
    expect(paths).toHaveLength(8);
    // Shared interior edges must not appear.
    expect(paths.some((d) => d === "M1 0L1 1" || d === "M1 1L1 0")).toBe(false);
    expect(paths.some((d) => d === "M0 1L1 1" || d === "M1 1L0 1")).toBe(false);
  });

  it("emits 4 edges for a single cell", () => {
    expect(getVisionBorderPaths([{ col: 3, row: 4 }])).toHaveLength(4);
  });
});

describe("observerVisionFromSnap", () => {
  it("matches getSideVision for both colors on Combat Chain start SCFEN", () => {
    const snap = parseScFen(COMBAT_CHAIN_START_SCFEN);
    const dual = observerVisionFromSnap(snap);
    const sieged = new Set(snap.siegedRooks ?? []);
    const opts = {
      rookModeFor: (sq: Square) => (sieged.has(sq) ? ("siege" as const) : ("tank" as const)),
      mines: snap.mines,
    };
    const w = getSideVision(snap.placement, "w", opts);
    const b = getSideVision(snap.placement, "b", opts);
    expect([...dual.w.litSquares].sort()).toEqual([...w.litSquares].sort());
    expect([...dual.b.litSquares].sort()).toEqual([...b.litSquares].sort());
    // White king e1 + pawn d2 + tank c3 light bottom-left; black pieces light top.
    expect(dual.w.litSquares.has("e1")).toBe(true);
    expect(dual.w.litSquares.has("c3")).toBe(true);
    expect(dual.b.litSquares.has("e8") || dual.b.litSquares.has("f8")).toBe(true);
  });

  it("applies S: siege rook vision from snap", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/2R5/8/4K3|0|33|P|G:11:11|Q:w:;b:|S:c3",
    );
    const dual = observerVisionFromSnap(snap);
    // Siege 9×9 from c3 reaches farther than tank 5×5 (e.g. a7 / e7).
    expect(dual.w.litSquares.has("a7") || dual.w.litSquares.has("e7")).toBe(true);
  });
});
