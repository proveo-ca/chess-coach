import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MoveAnimation } from "~/presentation/animations/components/MoveAnimation";
import { moveDurationMs } from "~/presentation/animations/moveTiming";
import type { MoveCue } from "~/types/cues";
import type { PieceSet } from "~/types/board";

afterEach(cleanup);

const CC_MOVE: MoveCue = {
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
 * The travelling hull owns the Command Center's fire for the length of the slide — the
 * persistent damage layer drops that side (`movingColors`), so if the mover
 * paints pristine nothing burns and the CC reads as full HP while it walks.
 * // SPEC: _spec/apps/starchess/architecture/board-entities.puml
 */
describe("MoveAnimation · Command Center hull", () => {
  it("burns at the cue's damage state instead of pristine", () => {
    const svg = mover([{ ...CC_MOVE, damage: "bigFire", seed: 0x1234 }]);
    expect(svg.querySelector("[data-cc-damage]")!.getAttribute("data-cc-damage")).toBe(
      "bigFire",
    );
  });

  it("stays pristine for an undamaged Command Center", () => {
    const svg = mover([CC_MOVE]);
    expect(svg.querySelector("[data-cc-damage]")!.getAttribute("data-cc-damage")).toBe(
      "pristine",
    );
  });

  it("keeps burning across the progress flip that drives the slide", () => {
    const cue: MoveCue = { ...CC_MOVE, damage: "smallFire", seed: 0x99 };
    for (const progress of [{ f0: 0 as const }, { f0: 1 as const }]) {
      const svg = mover([cue], progress);
      expect(
        svg.querySelector("[data-cc-damage]")!.getAttribute("data-cc-damage"),
      ).toBe("smallFire");
      cleanup();
    }
  });
});

/**
 * Move facing is rotation-only: mirror flips read papery mid-slide, so
 * BattleShip movers must never emit `scaleX` (Hoverbike keeps its baked-in
 * mirror — its rest silhouette depends on it). The Tank hull never
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

  it("rotates the BattleShip along travel with no mirror", () => {
    // West slide used to be scaleX(-1) + tilt; now a pure half-turn
    // (atan2 yields -180° here — visually identical to +180°).
    expect(faceTransform({ ...CC_MOVE, id: "f0", piece: "q", from: "e4", to: "c4" })).toBe(
      "rotate(-180deg)",
    );
    // North slide: bow follows travel, still no mirror.
    expect(faceTransform({ ...CC_MOVE, id: "f0", piece: "q", from: "e2", to: "e4" })).toBe(
      "rotate(-90deg)",
    );
    expect(
      mirroredInline(mover([{ ...CC_MOVE, id: "f0", piece: "q", from: "e4", to: "c4" }])),
    ).toBeNull();
  });

  it("keeps the Tank root upright, yawing only the turret along travel", () => {
    // Rank travel: hull stays unrotated (rotate(180°) put tracks on top).
    expect(faceTransform({ ...CC_MOVE, id: "f0", piece: "r", from: "a1", to: "h1" })).toBe("");
    // File travel: hull stays unrotated too.
    expect(faceTransform({ ...CC_MOVE, id: "f0", piece: "r", from: "a1", to: "a8" })).toBe("");
    // West / south legs yaw the same way (no mirror anywhere).
    expect(faceTransform({ ...CC_MOVE, id: "f0", piece: "r", from: "h1", to: "a1" })).toBe("");
    expect(faceTransform({ ...CC_MOVE, id: "f0", piece: "r", from: "a8", to: "a1" })).toBe("");
    // Turret aims along travel: east = 0°, north = -90°, west = -180°, south = 90°.
    expect(
      turretTransform({ ...CC_MOVE, id: "f0", piece: "r", from: "a1", to: "h1" }),
    ).toContain("rotate(0)");
    expect(
      turretTransform({ ...CC_MOVE, id: "f0", piece: "r", from: "a1", to: "a8" }),
    ).toContain("rotate(-90)");
    expect(
      turretTransform({ ...CC_MOVE, id: "f0", piece: "r", from: "h1", to: "a1" }),
    ).toContain("rotate(-180)");
    expect(
      turretTransform({ ...CC_MOVE, id: "f0", piece: "r", from: "a8", to: "a1" }),
    ).toContain("rotate(90)");
    expect(
      mirroredInline(mover([{ ...CC_MOVE, id: "f0", piece: "r", from: "a1", to: "h1" }])),
    ).toBeNull();
  });

  it("leaves the classic-tank Chess skin static (no turret to yaw)", () => {
    const el = mover([{ ...CC_MOVE, id: "f0", piece: "r", from: "a1", to: "h1" }], {}, "cburnett");
    expect((el.firstElementChild as HTMLElement | null)?.style.transform ?? "").toBe("");
    // Classic <img> glyph — unchanged from before the turret-yaw fix.
    expect(el.querySelector('img[data-piece="r"]')).not.toBeNull();
    expect(mirroredInline(el)).toBeNull();
  });

  it("returns the turret to rest at touchdown for the board hand-off", async () => {
    vi.useFakeTimers();
    try {
      const cue: MoveCue = { ...CC_MOVE, id: "f0", piece: "r", from: "a1", to: "h1" };
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

/**
 * A side change is a reflection, and tweening one squashes the hull through a
 * paper-thin frame. So the Hoverbike picks its side once per flight and the
 * hull itself only ever rotates.
 * // SPEC: _spec/apps/starchess/architecture/board-entities.puml
 */
describe("MoveAnimation · Hoverbike side", () => {
  const bike = (from: MoveCue["from"], to: MoveCue["to"], leg: 0 | 1) => {
    const { container } = render(() => (
      <MoveAnimation
        cues={[{ ...CC_MOVE, piece: "n", from, to }]}
        progress={{ f0: 1 }}
        leg={{ f0: leg }}
        boardWidth={400}
        boardHeight={400}
      />
    ));
    const el = container.querySelector<HTMLElement>("[data-move-id='f0']")!;
    const side = el.querySelector<SVGGElement>("[data-part='hull-side']")!;
    const hull = el.querySelector<SVGGElement>("[data-part='hull']")!;
    return { el, side: side.getAttribute("data-side"), turn: hull.style.transform };
  };

  it.each([
    { from: "g1", to: "f3", side: "left" },
    { from: "g1", to: "h3", side: "right" },
    { from: "b1", to: "d2", side: "right" },
    { from: "g8", to: "e7", side: "left" },
  ] as const)("$from→$to holds the $side side across the elbow", ({ from, to, side }) => {
    const long = bike(from, to, 0);
    cleanup();
    const short = bike(from, to, 1);
    expect([long.side, short.side]).toEqual([side, side]);
    for (const leg of [long, short]) {
      expect(leg.turn).toMatch(/^rotate\(-?[\d.]+deg\)$/);
    }
    expect(long.turn).not.toBe(short.turn);
  });

  it("lands on the resting silhouette", async () => {
    vi.useFakeTimers();
    try {
      const { el } = bike("g1", "h3", 1);
      await vi.advanceTimersByTimeAsync(moveDurationMs("g1", "h3", "n"));
      expect(el.querySelector("[data-part='hull-side']")!.getAttribute("data-side")).toBe("left");
      expect(el.querySelector("[data-part='hull']")!.getAttribute("data-pose")).toBe("rest");
    } finally {
      vi.useRealTimers();
    }
  });
});
