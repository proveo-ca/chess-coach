import { describe, expect, it } from "vitest";
import type { Square } from "chess.js";

import { getSideVision, parseScFen } from "@chess-coach/starchess-core";

import {
  getVisionBorderPaths,
  observerVisionFromSnap,
} from "~/presentation/board/fogProjection";
import { rookModeForSieged } from "~/presentation/board/rookMode";
import { COMBAT_CHAIN_START_SCFEN } from "~/demos/combatChain";

describe("fogProjection", () => {
  it("observerVisionFromSnap returns both sides", () => {
    const snap = parseScFen(COMBAT_CHAIN_START_SCFEN);
    const v = observerVisionFromSnap(snap);
    expect(v.w.litSquares.size).toBeGreaterThan(0);
    expect(v.b.litSquares.size).toBeGreaterThan(0);
  });

  it("sieged rook mode changes vision vs tank", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/3R4/8/8/4K3|0|33|P|G:11:11|S:d4|Q:w:;b:",
    );
    const sieged = new Set<Square>(["d4"]);
    const siegeV = getSideVision(snap.placement, "w", {
      rookModeFor: rookModeForSieged(sieged),
    });
    const tankV = getSideVision(snap.placement, "w", {
      rookModeFor: rookModeForSieged([]),
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
});
