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
