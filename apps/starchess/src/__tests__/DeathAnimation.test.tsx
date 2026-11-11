import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { DeathAnimation } from "~/presentation/animations/components/DeathAnimation";
import type { DeathCue } from "~/types/cues";

afterEach(cleanup);

/** A shot-out mine: `piece: "n"` (the bike that laid it) plus `mine: true`. */
const MINE_DEATH: DeathCue = {
  id: "m0",
  piece: "n",
  color: "b",
  at: "c3",
  mine: true,
};

const BIKE_DEATH: DeathCue = { id: "d0", piece: "n", color: "b", at: "c3" };

const layer = (cues: readonly DeathCue[]) => {
  const { container } = render(() => (
    <DeathAnimation cues={cues} boardWidth={400} boardHeight={400} />
  ));
  return container;
};

/**
 * `resolve-turn` turns an attack that clears a mine into a `mineBlast`, which
 * projects a `mine: true` death cue on the phase-1 lane. The layer used to draw
 * no hull at all for those — the mine just vanished behind the generic flash.
 * // SPEC: _spec/apps/starchess/architecture/board-entities.puml
 */
describe("DeathAnimation · mine wreck", () => {
  it("draws the mine wreck, not the hoverbike that laid it", () => {
    const mine = layer([MINE_DEATH]);
    expect(mine.querySelector("[data-death-glyph='mine']")).not.toBeNull();

    // Same piece letter, no `mine` flag — still the bike.
    const bike = layer([BIKE_DEATH]);
    expect(bike.querySelector("[data-death-glyph='mine']")).toBeNull();
  });

  it("builds the wreck from shards so the scatter CSS can peel it apart", () => {
    // `.dyingDrama [data-shard]` drives `shardFly`; a shardless glyph sits still.
    const shards = layer([MINE_DEATH]).querySelectorAll("[data-shard]");
    expect(shards.length).toBeGreaterThan(1);
  });

  it("fires the hoverbike frag boom in place, and only for a mine", () => {
    expect(layer([MINE_DEATH]).querySelector("[data-part='mine-frag']")).not.toBeNull();
    expect(layer([BIKE_DEATH]).querySelector("[data-part='mine-frag']")).toBeNull();
  });

  it("keeps the slot's mine marker so the drama scatter still selects it", () => {
    const slot = layer([MINE_DEATH]).querySelector("[data-death-mine='true']");
    expect(slot?.getAttribute("data-square")).toBe("c3");
  });
});

describe("DeathAnimation · team tint", () => {
  it("tints the wreck's frag boom from the mine's owner", () => {
    const slot = layer([MINE_DEATH]).querySelector<HTMLElement>(
      "[data-death-mine='true']",
    )!;
    // MINE_DEATH is black's mine.
    expect(slot.style.getPropertyValue("--team-tint")).toBe("#a22");
    expect(slot.style.getPropertyValue("--team-rgb")).toBe("170, 34, 34");
  });
});
