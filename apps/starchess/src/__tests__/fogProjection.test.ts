import { describe, expect, it } from "vitest";
import type { Square } from "chess.js";

import {
  getSideVision,
  parseScFen,
  placementToMap,
} from "@chess-coach/starchess-core";

import {
  buildFogHoleCellPath,
  getVisionBorderPaths,
  getVisionDisplayCells,
  getVisionFogHolePaths,
  mapWithMovePathOccupancy,
  observerVisionFromSnap,
} from "~/presentation/board/fogProjection";
import { moveSquareAtElapsed } from "~/presentation/animations/moveTiming";
import { tankModeForSieged } from "~/presentation/board/tankMode";
import { COMBAT_CHAIN_START_SCFEN } from "~/demos/combatChain";

describe("fogProjection", () => {
  it("observerVisionFromSnap returns both sides", () => {
    const snap = parseScFen(COMBAT_CHAIN_START_SCFEN);
    const v = observerVisionFromSnap(snap);
    expect(v.w.litSquares.size).toBeGreaterThan(0);
    expect(v.b.litSquares.size).toBeGreaterThan(0);
    // No sieged Tanks is the same board as passing none explicitly.
    const explicit = observerVisionFromSnap(snap, { siegedTanks: [] });
    expect(explicit.w.litSquares.size).toBe(v.w.litSquares.size);
  });

  it("sieged Tank mode changes vision vs tank", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/3R4/8/8/4K3|0|33|P|G:11:11|S:d4|Q:w:;b:",
    );
    const sieged = new Set<Square>(["d4"]);
    const siegeV = getSideVision(snap.placement, "w", {
      tankModeFor: tankModeForSieged(sieged),
    });
    const tankV = getSideVision(snap.placement, "w", {
      tankModeFor: tankModeForSieged([]),
    });
    expect(siegeV.litSquares.size).not.toBe(tankV.litSquares.size);
  });

  it("getVisionBorderPaths emits exterior edges only", () => {
    const paths = getVisionBorderPaths([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ]);
    expect(paths.length).toBeGreaterThan(0);
  });

  it("mapWithMovePathOccupancy never displaces a unit the mover passes over", () => {
    // live-play-attack-1: the enemy Hoverbike b8→d7 elbows over the BattleShip on d8.
    const map = placementToMap("kn1Q4/ppp5/8/8/8/8/8/6K1");
    const cue = { id: "n1", from: "b8" as Square, to: "d7" as Square, piece: "n" as const, startedAt: 0 };
    let crossedD8 = false;
    for (let t = 0; t <= 3_000; t += 5) {
      if (moveSquareAtElapsed("b8", "d7", "n", t) === "d8") crossedD8 = true;
      const moved = mapWithMovePathOccupancy(map, [cue], t);
      expect(moved.get("d8"), `t=${t}`).toEqual({ type: "q", color: "w" });
    }
    expect(crossedD8).toBe(true);
  });

  it("mapWithMovePathOccupancy relocates movers along path", () => {
    const map = placementToMap("4k3/8/8/8/8/8/4P3/4K3");
    const empty = mapWithMovePathOccupancy(map, [], 0);
    expect(empty.get("e2")?.type).toBe("p");
    const moved = mapWithMovePathOccupancy(
      map,
      [
        {
          id: "m1",
          from: "e2",
          to: "e4",
          piece: "p",
          startedAt: 0,
        },
      ],
      10_000,
    );
    expect(moved.has("e2")).toBe(false);
    expect(moved.get("e4")?.type === "p" || moved.get("e3")?.type === "p").toBe(
      true,
    );
    const stim = mapWithMovePathOccupancy(
      map,
      [
        {
          id: "m2",
          from: "e2",
          to: "e3",
          piece: "p",
          startedAt: 0,
          stim: true,
        },
      ],
      50,
    );
    expect(stim.size).toBeGreaterThan(0);
  });

  it("projects display cells, borders, and fog-hole paths off lit squares", () => {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
    const cells = getVisionDisplayCells(
      new Set<Square>(["e1", "e2", "d1", "z9" as Square]),
      files,
      ranks,
    );
    expect(cells.some((c) => c.col === 4)).toBe(true);
    expect(getVisionBorderPaths(cells).length).toBeGreaterThan(0);
    const holes = getVisionFogHolePaths(cells, 0.15);
    expect(holes.length).toBe(cells.length);
    const tip = getVisionFogHolePaths([{ col: 0, row: 0 }], 0.2);
    expect(tip[0]).toContain("M");
    const path = buildFogHoleCellPath(1, 1, 0.2, {
      tl: true,
      tr: true,
      bl: false,
      br: false,
    });
    expect(path.endsWith("Z")).toBe(true);
    const sharp = buildFogHoleCellPath(0, 0, 0, {
      tl: false,
      tr: false,
      bl: false,
      br: false,
    });
    expect(sharp).toContain("L");
  });
});
