/**
 * Command Center fire must not leak through the veil.
 * The companion "cburnett stays tutorial-only" scan lives with the other
 * source-boundary checks in `__tests__/bundle/bundleBoundary.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { parseScFen, type StarChessColor } from "@chess-coach/starchess-core";
import type { Square } from "chess.js";

import {
  kingDamageCuesFromBoard,
  kingDamageStateForLives,
  visibleKingDamageCues,
} from "~/presentation/animations/kingDamage";
import { pieceVisibleToViewer } from "~/presentation/board/fogVisibility";

const NONE: ReadonlySet<string> = new Set();

const noFog = {
  attackFrom: NONE,
  dyingAt: NONE,
  dyingColors: NONE,
  movingColors: NONE,
  isVisible: () => true,
};

/**
 * Kings far apart with nothing between them: White on a1 cannot see h8, and
 * Black's CC there is down to 1 life (bigFire).
 */
const SCFEN = "SCFEN|7k/8/8/8/8/8/8/K7|0|33|P|G:11:11|Q:w:;b:";
const LIVES = { w: 3, b: 1 } as const;

const cuesFor = (lives: Record<StarChessColor, number> = LIVES) =>
  kingDamageCuesFromBoard(parseScFen(SCFEN).placement, lives);

/** The real fog predicate the board hands to the filter, for `viewer`. */
const fogGate = (viewer: StarChessColor) => (at: Square, color: StarChessColor) =>
  pieceVisibleToViewer(parseScFen(SCFEN).placement, viewer, at, color);

describe("king damage fog", () => {
  it("maps 1 / 2 lives to fire and 3 to pristine", () => {
    expect(kingDamageStateForLives(3)).toBe("pristine");
    expect(kingDamageStateForLives(2)).toBe("smallFire");
    expect(kingDamageStateForLives(1)).toBe("bigFire");
    expect(kingDamageStateForLives(0)).toBe("destroyed");
  });

  it("seeds a burning cue for the enemy CC regardless of vision", () => {
    // The cue exists — it is the *filter* that owes fog, not the seeder.
    const black = cuesFor().find((c) => c.id === "b");
    expect(black).toMatchObject({ at: "h8", damage: "bigFire" });
  });

  it("does not paint an unseen enemy Command Center's fire", () => {
    // White on a1 has no vision of h8, so nothing may mark that square.
    expect(
      visibleKingDamageCues(cuesFor(), { ...noFog, isVisible: fogGate("w") }),
    ).toEqual([]);
  });

  it("paints the same fire once the CC is visible to the viewer", () => {
    // Black sees its own CC — the cue survives for that viewer.
    const seen = visibleKingDamageCues(cuesFor(), {
      ...noFog,
      isVisible: fogGate("b"),
    });
    expect(seen.map((c) => c.at)).toEqual(["h8"]);
  });

  it("still paints for observer / no-fog callers", () => {
    // DualNav review passes an always-true predicate; fog gates nothing there.
    const seen = visibleKingDamageCues(cuesFor(), noFog);
    expect(seen.map((c) => c.id)).toEqual(["b"]);
  });

  it("drops pristine, attacking and dying kings before the fog check", () => {
    const both = cuesFor({ w: 2, b: 1 });
    expect(visibleKingDamageCues(both, noFog).map((c) => c.id)).toEqual(["w", "b"]);
    // A healthy CC never paints.
    expect(visibleKingDamageCues(cuesFor({ w: 3, b: 3 }), noFog)).toEqual([]);
    // Attack hull / death crumple own the square instead.
    expect(
      visibleKingDamageCues(both, { ...noFog, attackFrom: new Set(["a1"]) }).map(
        (c) => c.id,
      ),
    ).toEqual(["b"]);
    expect(
      visibleKingDamageCues(both, { ...noFog, dyingAt: new Set(["h8"]) }).map(
        (c) => c.id,
      ),
    ).toEqual(["w"]);
    expect(
      visibleKingDamageCues(both, { ...noFog, dyingColors: new Set(["b"]) }).map(
        (c) => c.id,
      ),
    ).toEqual(["w"]);
  });
});
