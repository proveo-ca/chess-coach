/**
 * Known-vs-seen accumulator — arena-owned, deterministic, fold-per-ply.
 * kvs is what makes the strategic script *strategic* (the naive script plans
 * only against what it can see this turn).
 */
import { describe, expect, it } from "vitest";

import {
  combineKnownVsSeen,
  knownForTurn,
  parseScFen,
} from "@chess-coach/starchess-core";

import {
  seedKvsForOpening,
  updateKvsForSnap,
} from "@chess-coach/starchess-core";
import { STAR_STARTING_SCFEN } from "../seeds";

const OPEN = parseScFen(STAR_STARTING_SCFEN);

/** Opening board minus one black pawn (captured before the snap). */
const BLACK_PAWN_DOWN =
  "SCFEN|4k3/2p1pp2/8/8/8/8/2PPPP2/4K3|1|33|P|G:11:11|Q:w:;b:";

describe("kvs accumulation", () => {
  it("opens with the income ledger and zero seen/captured", () => {
    const kvs = seedKvsForOpening(OPEN);
    for (const side of ["w", "b"] as const) {
      const k = kvs.perSide[side];
      expect(k.known).toBe(knownForTurn(0));
      expect(k.scouted).toBe(0);
      expect(k.captured).toBe(0);
      expect(k.gap).toBe(k.known);
    }
  });

  it("adds the enemy deployed deficit to captured after a capture", () => {
    const kvs = seedKvsForOpening(OPEN);
    const after = updateKvsForSnap(kvs, parseScFen(BLACK_PAWN_DOWN));

    // White's view of black: one black pawn removed this ply ⇒ +1 captured.
    const whiteView = after.perSide.w;
    const expectedKnown = knownForTurn(1);
    expect(whiteView.captured).toBe(1);
    expect(whiteView.known).toBe(expectedKnown);
    expect(whiteView.gap).toBe(combineKnownVsSeen(expectedKnown, whiteView.scouted, 1).gap);
  });

  it("stays deterministic and idempotent on repeated folds of the same snap", () => {
    const kvs = seedKvsForOpening(OPEN);
    const snap = parseScFen(BLACK_PAWN_DOWN);
    const once = updateKvsForSnap(kvs, snap);
    const twice = updateKvsForSnap(once, snap);
    // Revisiting the same board neither sees nor captures more.
    expect(twice.perSide.w.captured).toBe(once.perSide.w.captured);
    expect(twice.perSide.b.captured).toBe(once.perSide.b.captured);
  });
});