import { describe, expect, it } from "vitest";
import type { Square } from "chess.js";
import { parseScFen, placementToMap } from "@chess-coach/starchess-core";

import {
  buildFogHoleCellPath,
  getVisionBorderPaths,
  getVisionDisplayCells,
  getVisionFogHolePaths,
  mapWithMovePathOccupancy,
  observerVisionFromSnap,
} from "~/presentation/board/fogProjection";

describe("fogProjection coverage", () => {
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

  it("observerVisionFromSnap + display/border/hole paths", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    const v = observerVisionFromSnap(snap, { siegedRooks: [] });
    expect(v.w.litSquares.size).toBeGreaterThan(0);
    expect(v.b.litSquares.size).toBeGreaterThan(0);
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
    const cells = getVisionDisplayCells(
      new Set<Square>(["e1", "e2", "d1", "z9" as Square]),
      files,
      ranks,
    );
    expect(cells.some((c) => c.col === 4)).toBe(true);
    const borders = getVisionBorderPaths(cells);
    expect(borders.length).toBeGreaterThan(0);
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
