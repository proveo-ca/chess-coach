/**
 * Sieged Siege Tank classical attacks — rook rays only, fire in place.
 */
import { describe, expect, it } from "vitest";

import {
  addScAction,
  endScTurn,
  parseScFen,
  placementToMap,
  scMovesFrom,
  type ScMove,
} from "../../index";

const tos = (moves: ScMove[]) => moves.map((m) => m.to).sort();

const byTo = (moves: ScMove[], to: string) => moves.find((m) => m.to === to);

describe("sieged rook classical attacks", () => {
  it("fires only on rook rays (same file or rank), not diagonals / area", () => {
    // White rook d4 sieged; black targets on file, rank, and diagonal.
    //   . . . . . . . .
    //   . . . p . . . .   d7
    //   . . . . . . . .
    //   . . p R p . . .   c4 R d4 e4
    //   . . . . . . . .
    //   . . . . p . . .   e3 diagonal
    //   . . . . . . . .
    //   . . . . K . . k
    const map = placementToMap("8/3p4/8/8/2pRp3/4p3/8/4K2k");
    const moves = scMovesFrom(map, "d4", "w", { siegedRooks: ["d4"] });

    expect(tos(moves)).toEqual(["c4", "d7", "e4"]);
    expect(byTo(moves, "e3")).toBeUndefined(); // diagonal — not a rook attack
    expect(byTo(moves, "c5")).toBeUndefined(); // chebyshev-near diagonal
    expect(byTo(moves, "e5")).toBeUndefined();
    expect(byTo(moves, "c3")).toBeUndefined();
  });

  it("marks every sieged capture as firesInPlace (no relocate)", () => {
    const map = placementToMap("8/3p4/8/8/3R4/8/8/4K2k");
    const moves = scMovesFrom(map, "d4", "w", { siegedRooks: ["d4"] });
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.firesInPlace).toBe(true);
      expect(m.capture).not.toBeNull();
      expect(m.piece).toBe("r");
      expect(m.from).toBe("d4");
    }
  });

  it("offers no quiet relocates while sieged", () => {
    // Open board — tank would have many quiet squares; sieged has none.
    const map = placementToMap("8/8/8/8/3R4/8/8/4K2k");
    const sieged = scMovesFrom(map, "d4", "w", { siegedRooks: ["d4"] });
    const tank = scMovesFrom(map, "d4", "w");

    expect(sieged.every((m) => m.capture != null)).toBe(true);
    expect(sieged.every((m) => m.firesInPlace)).toBe(true);
    expect(tank.some((m) => m.capture == null && !m.firesInPlace)).toBe(true);
    expect(tank.some((m) => m.to === "d5" && m.capture == null)).toBe(true);
  });

  it("stops the ray at the first piece (friendly blocks, enemy capturable)", () => {
    // d4 rook; friendly d6; enemy d7 beyond; enemy a4; friendly f4; enemy h4.
    const map = placementToMap("8/3p4/3P4/8/p2R1P1p/8/8/4K2k");
    const moves = scMovesFrom(map, "d4", "w", { siegedRooks: ["d4"] });

    expect(byTo(moves, "d6")).toBeUndefined(); // friendly
    expect(byTo(moves, "d7")).toBeUndefined(); // blocked behind friendly
    expect(byTo(moves, "a4")?.capture).toEqual({ type: "p", color: "b" });
    expect(byTo(moves, "f4")).toBeUndefined(); // friendly
    expect(byTo(moves, "h4")).toBeUndefined(); // blocked behind friendly
  });

  it("does not fire through empty squares beyond an enemy (capture stops ray)", () => {
    // Enemy on d6; empty d7 — only d6 is a capture target.
    const map = placementToMap("8/8/3p4/8/3R4/8/8/4K2k");
    const moves = scMovesFrom(map, "d4", "w", { siegedRooks: ["d4"] });
    expect(tos(moves)).toEqual(["d6"]);
    expect(byTo(moves, "d5")).toBeUndefined();
    expect(byTo(moves, "d7")).toBeUndefined();
    expect(byTo(moves, "d8")).toBeUndefined();
  });

  it("tank (unpacked) rook keeps full rook geometry including quiet moves", () => {
    // Black pawn on d7 (file d).
    const map = placementToMap("8/3p4/8/8/3R4/8/8/4K2k");
    const moves = scMovesFrom(map, "d4", "w"); // not sieged
    expect(byTo(moves, "d5")?.capture).toBeNull();
    expect(byTo(moves, "d7")?.capture).toEqual({ type: "p", color: "b" });
    expect(byTo(moves, "a4")?.capture).toBeNull();
    expect(moves.every((m) => !m.firesInPlace)).toBe(true);
  });

  it("resolves a sieged capture in place — rook stays, victim removed", () => {
    let snap = parseScFen(
      "SCFEN|4k3/3p4/8/8/3R4/8/8/4K3|0|33|P|G:11:11|Q:w:;b:|S:d4",
    );
    snap = addScAction({
      snapshot: snap,
      action: {
        timing: "C",
        kind: "classical",
        color: "w",
        from: "d4",
        to: "d7",
      },
    }).snapshot;
    const r = endScTurn(snap, { skipTurnStartChecks: true });
    const map = placementToMap(r.next.placement);
    expect(map.get("d4")).toEqual({ type: "r", color: "w" });
    expect(map.get("d7")).toBeUndefined();
    expect(r.next.siegedRooks ?? []).toContain("d4");
  });

  it("scMovesFor only lists sieged fire-in-place captures for that rook", () => {
    const map = placementToMap("8/3p4/8/8/2pR4/8/8/4K2k");
    const all = scMovesFrom(map, "d4", "w", { siegedRooks: new Set(["d4"]) });
    expect(all.map((m) => `${m.from}${m.firesInPlace ? "!" : ">"}${m.to}`).sort()).toEqual([
      "d4!c4",
      "d4!d7",
    ]);
  });
});
