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
      siegedRooks: ["a1"],
      mines: [MINE_B("a4")],
    });
    expect(moves).toEqual([
      expect.objectContaining({
        to: "a4",
        firesInPlace: true,
        capture: null,
        hostileMineOnTo: true,
      }),
    ]);
  });
});
