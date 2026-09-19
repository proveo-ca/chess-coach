import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { MoveAnimation } from "~/presentation/animations/components/MoveAnimation";
import type { MoveCue } from "~/types/cues";

afterEach(cleanup);

const KING_MOVE: MoveCue = {
  id: "f0",
  piece: "k",
  color: "w",
  from: "e1",
  to: "e2",
};

const mover = (cues: readonly MoveCue[], progress: Record<string, 0 | 1> = {}) => {
  const { container } = render(() => (
    <MoveAnimation cues={cues} progress={progress} boardWidth={400} boardHeight={400} />
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
 * queen/rook movers must never emit `scaleX` (knight keeps its baked-in
 * mirror — its rest silhouette depends on it).
 */
describe("MoveAnimation · travel facing", () => {
  const faceTransform = (cue: MoveCue): string => {
    const el = mover([cue]);
    const face = el.firstElementChild as HTMLElement | null;
    return face?.style.transform ?? "";
  };

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
  });

  it("half-turns the rook on rank travel, rests on file travel", () => {
    expect(faceTransform({ ...KING_MOVE, id: "f0", piece: "r", from: "a1", to: "h1" })).toBe(
      "rotate(180deg)",
    );
    expect(faceTransform({ ...KING_MOVE, id: "f0", piece: "r", from: "a1", to: "a8" })).toBe(
      "rotate(0deg)",
    );
  });
});
