import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { AttackAnimation } from "~/presentation/animations/components/AttackAnimation";
import type { AttackCue } from "~/types/cues";

afterEach(cleanup);

const KING_SHOT: AttackCue = {
  id: "a0",
  piece: "k",
  color: "w",
  from: "e1",
  to: "e3",
};

const damageOf = (cues: readonly AttackCue[]) => {
  const { container } = render(() => (
    <AttackAnimation cues={cues} boardWidth={400} boardHeight={400} />
  ));
  return container
    .querySelector("[data-king-damage]")!
    .getAttribute("data-king-damage");
};

/**
 * `visibleKingDamageCues` drops the persistent slot for a square an attack hull
 * owns (`attackFrom`), so the shot hull is the only thing drawing that CC —
 * a pristine hull there means the king goes full HP for the length of the shot.
 * // SPEC: _spec/apps/starchess/architecture/board-entities.puml
 */
describe("AttackAnimation · king hull", () => {
  it("burns at the cue's damage state instead of pristine", () => {
    expect(damageOf([{ ...KING_SHOT, damage: "smallFire", seed: 0x77 }])).toBe(
      "smallFire",
    );
  });

  it("stays pristine for an undamaged king", () => {
    expect(damageOf([KING_SHOT])).toBe("pristine");
  });
});

/**
 * The frag boom and the Ship's laser are the firing player's own colours, so
 * every cue element that paints them carries the tint. It cannot live on the
 * layer root: a phase-1 window plays both sides' shots at once.
 * // SPEC: _spec/apps/starchess/architecture/board-entities.puml
 */
describe("AttackAnimation · team tint", () => {
  const tintsOf = (cues: readonly AttackCue[]): Set<string> => {
    const { container } = render(() => (
      <AttackAnimation cues={cues} boardWidth={400} boardHeight={400} />
    ));
    return new Set(
      [...container.querySelectorAll<HTMLElement>("div")]
        .map((el) => el.style.getPropertyValue("--team-tint"))
        .filter((v) => v !== ""),
    );
  };

  it("tints the Hoverbike frag from the shooter", () => {
    expect(tintsOf([{ id: "a0", piece: "n", color: "w", from: "e4", to: "e6" }])).toEqual(
      new Set(["#3b7dd8"]),
    );
    expect(tintsOf([{ id: "a0", piece: "n", color: "b", from: "e8", to: "e6" }])).toEqual(
      new Set(["#a22"]),
    );
  });

  it("tints the Ship's laser from the shooter", () => {
    expect(tintsOf([{ id: "a0", piece: "q", color: "b", from: "d8", to: "d4" }])).toEqual(
      new Set(["#a22"]),
    );
  });

  it("keeps the two sides' tints apart in one phase-1 window", () => {
    // Why the tint cannot live on the layer root: both shots play at once.
    expect(
      tintsOf([
        { id: "a0", piece: "q", color: "w", from: "d1", to: "d5" },
        { id: "a1", piece: "q", color: "b", from: "d8", to: "d4" },
      ]),
    ).toEqual(new Set(["#3b7dd8", "#a22"]));
  });
});
