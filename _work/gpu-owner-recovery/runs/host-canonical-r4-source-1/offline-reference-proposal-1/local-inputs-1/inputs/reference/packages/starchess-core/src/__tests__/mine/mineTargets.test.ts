/**
 * A hostile mine is a legal target: `scMovesFrom` offers the mined tile to units
 * that can *attack* it — a marine's front diagonal, a sieged tank's ray — where
 * an empty tile would be illegal. What contact then does is `minePathContact`;
 * whether the player may see the mine at all is the app's fog layer.
 * // SPEC: _spec/packages/starchess-core/mine-contact.puml
 */
import { describe, expect, it } from "vitest";

import { placementToMap, scMovesFrom, type ScMine } from "../../index";

const MINE_B = (at: string): ScMine => ({ color: "b", at: at as never });

describe("legal dests onto a mined tile", () => {
  it("marine front diagonal onto a hostile mine is a dest", () => {
    const map = placementToMap("4k3/8/8/8/8/8/3P4/4K3");
    const dests = scMovesFrom(map, "d2", "w", { mines: [MINE_B("e3")] }).map(
      (m) => m.to,
    );
    expect(dests).toEqual(expect.arrayContaining(["d3", "e3"]));
    // Empty diagonals stay illegal without a mine there.
    expect(scMovesFrom(map, "d2", "w").map((m) => m.to)).not.toContain("e3");
  });

  it("sieged tank targets a hostile mine on its ray (fires in place)", () => {
    const map = placementToMap("4k3/8/8/8/8/8/8/R3K3");
    const moves = scMovesFrom(map, "a1", "w", {
      siegedTanks: ["a1"],
      mines: [MINE_B("a4")],
    });
    // The mined tile clears in place — alongside every other cross square,
    // which the tank may shell like a regular piece attacking empty ground.
    expect(moves).toContainEqual(
      expect.objectContaining({
        to: "a4",
        firesInPlace: true,
        capture: null,
        hostileMineOnTo: true,
      }),
    );
    expect(moves.map((m) => m.to).sort()).toEqual([
      "a2",
      "a3",
      "a4",
      "a5",
      "a6",
      "a7",
      "a8",
      "b1",
      "c1",
      "d1",
      "f1",
      "g1",
      "h1",
    ]);
    expect(moves.every((m) => m.firesInPlace)).toBe(true);
  });
});
