import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MoveAnimation } from "~/presentation/animations/components/MoveAnimation";
import { moveDurationMs } from "~/presentation/animations/moveTiming";
import type { MoveCue } from "~/types/cues";
import type { PieceSet } from "~/types/board";

afterEach(cleanup);

const KING_MOVE: MoveCue = {
  id: "f0",
  piece: "k",
  color: "w",
  from: "e1",
  to: "e2",
};

const mover = (
  cues: readonly MoveCue[],
  progress: Record<string, 0 | 1> = {},
  pieceSet?: PieceSet,
) => {
  const { container } = render(() => (
    <MoveAnimation
      cues={cues}
      progress={progress}
      boardWidth={400}
      boardHeight={400}
      pieceSet={pieceSet}
    />
  ));
  return container.querySelector<HTMLElement>("[data-move-id='f0']")!;
};

/**
 * The travelling hull owns the king's fire for the length of the slide — the
 * persistent damage layer drops that side (`movingColors`), so if the mover
 * paints pristine nothing burns and the CC reads as full HP while it walks.
 * // SPEC: _spec/apps/starchess/architecture/board-entities.puml
 */
describe("MoveAnimation · king hull", () => {
  it("burns at the cue's damage state instead of pristine", () => {
    const svg = mover([{ ...KING_MOVE, damage: "bigFire", seed: 0x1234 }]);
    expect(svg.querySelector("[data-king-damage]")!.getAttribute("data-king-damage")).toBe(
      "bigFire",
    );
  });

  it("stays pristine for an undamaged king", () => {
    const svg = mover([KING_MOVE]);
    expect(svg.querySelector("[data-king-damage]")!.getAttribute("data-king-damage")).toBe(
      "pristine",
    );
  });

  it("keeps burning across the progress flip that drives the slide", () => {
    const cue: MoveCue = { ...KING_MOVE, damage: "smallFire", seed: 0x99 };
    for (const progress of [{ f0: 0 as const }, { f0: 1 as const }]) {
      const svg = mover([cue], progress);
      expect(
        svg.querySelector("[data-king-damage]")!.getAttribute("data-king-damage"),
      ).toBe("smallFire");
      cleanup();
    }
  });
});

/**
 * Move facing is rotation-only: mirror flips read papery mid-slide, so
 * queen movers must never emit `scaleX` (knight keeps its baked-in
 * mirror — its rest silhouette depends on it). The rook hull never
 * rotates or mirrors — only its turret yaws along travel.
 */
describe("MoveAnimation · travel facing", () => {
  const faceTransform = (cue: MoveCue): string => {
    const el = mover([cue]);
    const face = el.firstElementChild as HTMLElement | null;
    return face?.style.transform ?? "";
  };

  const turretIn = (el: Element): string => {
    const gs = el.querySelectorAll("g[transform]");
    for (const g of gs) {
      const t = g.getAttribute("transform") ?? "";
      if (t.includes("rotate(") && t.includes("22.5 23.5")) return t;
    }
    return "";
  };

  const turretTransform = (cue: MoveCue): string => turretIn(mover([cue]));

  /** No inline `scaleX` anywhere in the mover subtree (mirrors read papery). */
  const mirroredInline = (el: Element): Element | null =>
    el.querySelector('[style*="scaleX"]');

  it("rotates the queen along travel with no mirror", () => {
    // West slide used to be scaleX(-1) + tilt; now a pure half-turn
    // (atan2 yields -180° here — visually identical to +180°).
    expect(faceTransform({ ...KING_MOVE, id: "f0", piece: "q", from: "e4", to: "c4" })).toBe(
      "rotate(-180deg)",
    );
    // North slide: bow follows travel, still no mirror.
    expect(faceTransform({ ...KING_MOVE, id: "f0", piece: "q", from: "e2", to: "e4" })).toBe(
      "rotate(-90deg)",
    );
    expect(
      mirroredInline(mover([{ ...KING_MOVE, id: "f0", piece: "q", from: "e4", to: "c4" }])),
    ).toBeNull();
  });

  it("keeps the rook root upright, yawing only the turret along travel", () => {
    // Rank travel: hull stays unrotated (rotate(180°) put tracks on top).
    expect(faceTransform({ ...KING_MOVE, id: "f0", piece: "r", from: "a1", to: "h1" })).toBe("");
    // File travel: hull stays unrotated too.
    expect(faceTransform({ ...KING_MOVE, id: "f0", piece: "r", from: "a1", to: "a8" })).toBe("");
    // West / south legs yaw the same way (no mirror anywhere).
    expect(faceTransform({ ...KING_MOVE, id: "f0", piece: "r", from: "h1", to: "a1" })).toBe("");
    expect(faceTransform({ ...KING_MOVE, id: "f0", piece: "r", from: "a8", to: "a1" })).toBe("");
    // Turret aims along travel: east = 0°, north = -90°, west = -180°, south = 90°.
    expect(
      turretTransform({ ...KING_MOVE, id: "f0", piece: "r", from: "a1", to: "h1" }),
    ).toContain("rotate(0)");
    expect(
      turretTransform({ ...KING_MOVE, id: "f0", piece: "r", from: "a1", to: "a8" }),
    ).toContain("rotate(-90)");
    expect(
      turretTransform({ ...KING_MOVE, id: "f0", piece: "r", from: "h1", to: "a1" }),
    ).toContain("rotate(-180)");
    expect(
      turretTransform({ ...KING_MOVE, id: "f0", piece: "r", from: "a8", to: "a1" }),
    ).toContain("rotate(90)");
    expect(
      mirroredInline(mover([{ ...KING_MOVE, id: "f0", piece: "r", from: "a1", to: "h1" }])),
    ).toBeNull();
  });

  it("leaves the classic-rook Chess skin static (no turret to yaw)", () => {
    const el = mover([{ ...KING_MOVE, id: "f0", piece: "r", from: "a1", to: "h1" }], {}, "cburnett");
    expect((el.firstElementChild as HTMLElement | null)?.style.transform ?? "").toBe("");
    // Classic <img> glyph — unchanged from before the turret-yaw fix.
    expect(el.querySelector('img[data-piece="r"]')).not.toBeNull();
    expect(mirroredInline(el)).toBeNull();
  });

  it("returns the turret to rest at touchdown for the board hand-off", async () => {
    vi.useFakeTimers();
    try {
      const cue: MoveCue = { ...KING_MOVE, id: "f0", piece: "r", from: "a1", to: "h1" };
      const { container } = render(() => (
        <MoveAnimation
          cues={[cue]}
          progress={{ f0: 1 }}
          boardWidth={400}
          boardHeight={400}
        />
      ));
      const el = container.querySelector<HTMLElement>("[data-move-id='f0']")!;
      expect(turretIn(el)).toContain("rotate(0)");
      await vi.advanceTimersByTimeAsync(moveDurationMs("a1", "h1", "r"));
      expect(turretIn(el)).toContain("rotate(-135)");
      expect((el.firstElementChild as HTMLElement | null)?.style.transform ?? "").toBe("");
    } finally {
      vi.useRealTimers();
    }
  });
});
