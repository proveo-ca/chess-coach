/**
 * Sieged Siege Tank classical attacks — any square on the cross, fire in place.
 * Like a regular piece attacking an empty square, the tank may shell empty
 * cross squares; blockers do not filter the list (resolve intercepts).
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

describe("sieged Tank classical attacks", () => {
  it("fires on the whole cross (same file or rank), not diagonals / area", () => {
    // White Tank d4 sieged; black targets on file, rank, and diagonal.
    //   . . . . . . . .
    //   . . . p . . . .   d7
    //   . . . . . . . .
    //   . . p R p . . .   c4 R d4 e4
    //   . . . . . . . .
    //   . . . . p . . .   e3 diagonal
    //   . . . . . . . .
    //   . . . . K . . k
    const map = placementToMap("8/3p4/8/8/2pRp3/4p3/8/4K2k");
    const moves = scMovesFrom(map, "d4", "w", { siegedTanks: ["d4"] });

    expect(tos(moves)).toEqual([
      "a4",
      "b4",
      "c4",
      "d1",
      "d2",
      "d3",
      "d5",
      "d6",
      "d7",
      "d8",
      "e4",
      "f4",
      "g4",
      "h4",
    ]);
    // Occupied enemies still list their victim; empties shell with null.
    expect(byTo(moves, "c4")?.capture).toEqual({ type: "p", color: "b" });
    expect(byTo(moves, "d7")?.capture).toEqual({ type: "p", color: "b" });
    expect(byTo(moves, "d5")?.capture).toBeNull();
    expect(byTo(moves, "e3")).toBeUndefined(); // diagonal — not a Tank attack
    expect(byTo(moves, "c5")).toBeUndefined(); // chebyshev-near diagonal
    expect(byTo(moves, "e5")).toBeUndefined();
    expect(byTo(moves, "c3")).toBeUndefined();
  });

  it("marks every sieged mission as firesInPlace (no relocate)", () => {
    const map = placementToMap("8/3p4/8/8/3R4/8/8/4K2k");
    const moves = scMovesFrom(map, "d4", "w", { siegedTanks: ["d4"] });
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.firesInPlace).toBe(true);
      expect(m.piece).toBe("r");
      expect(m.from).toBe("d4");
    }
    // Enemy squares list victims; empty squares shell with null capture.
    expect(byTo(moves, "d7")?.capture).toEqual({ type: "p", color: "b" });
    expect(byTo(moves, "d5")?.capture).toBeNull();
  });

  it("offers no quiet relocates while sieged", () => {
    // Open board — tank would have many quiet squares; sieged fires everywhere
    // in place instead (captures on enemies, shellings on empties).
    const map = placementToMap("8/8/8/8/3R4/8/8/4K2k");
    const sieged = scMovesFrom(map, "d4", "w", { siegedTanks: ["d4"] });
    const tank = scMovesFrom(map, "d4", "w");

    expect(sieged.every((m) => m.firesInPlace)).toBe(true);
    expect(sieged.some((m) => m.capture == null)).toBe(true);
    expect(tank.some((m) => m.capture == null && !m.firesInPlace)).toBe(true);
    expect(tank.some((m) => m.to === "d5" && m.capture == null)).toBe(true);
  });

  it("targets through blockers (resolve intercepts at the first piece)", () => {
    // d4 Tank; friendly d6; enemy d7 beyond; enemy a4; friendly f4; enemy h4.
    const map = placementToMap("8/3p4/3P4/8/p2R1P1p/8/8/4K2k");
    const moves = scMovesFrom(map, "d4", "w", { siegedTanks: ["d4"] });

    expect(byTo(moves, "d6")).toBeUndefined(); // friendly — never targeted
    // Through-fire: listed with the square's own victim; resolve collides
    // at the first piece in the way (d6 / f4 hold the shots).
    expect(byTo(moves, "d7")?.capture).toEqual({ type: "p", color: "b" });
    expect(byTo(moves, "a4")?.capture).toEqual({ type: "p", color: "b" });
    expect(byTo(moves, "f4")).toBeUndefined(); // friendly
    expect(byTo(moves, "h4")?.capture).toEqual({ type: "p", color: "b" });
  });

  it("lists empty squares beyond an enemy (resolve intercepts, not move-gen)", () => {
    // Enemy on d6; empty d5/d7/d8 — all listed; the d7/d8 shots collide at d6.
    const map = placementToMap("8/8/3p4/8/3R4/8/8/4K2k");
    const moves = scMovesFrom(map, "d4", "w", { siegedTanks: ["d4"] });
    expect(byTo(moves, "d5")?.capture).toBeNull();
    expect(byTo(moves, "d6")?.capture).toEqual({ type: "p", color: "b" });
    expect(byTo(moves, "d7")?.capture).toBeNull();
    expect(byTo(moves, "d8")?.capture).toBeNull();
  });

  it("tank (unpacked) Tank keeps full Tank geometry including quiet moves", () => {
    // Black Marine on d7 (file d).
    const map = placementToMap("8/3p4/8/8/3R4/8/8/4K2k");
    const moves = scMovesFrom(map, "d4", "w"); // not sieged
    expect(byTo(moves, "d5")?.capture).toBeNull();
    expect(byTo(moves, "d7")?.capture).toEqual({ type: "p", color: "b" });
    expect(byTo(moves, "a4")?.capture).toBeNull();
    expect(moves.every((m) => !m.firesInPlace)).toBe(true);
  });

  it("resolves a sieged capture in place — Tank stays, victim removed", () => {
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
    expect(r.next.siegedTanks ?? []).toContain("d4");
  });

  it("scMovesFor lists sieged fire-in-place missions for that Tank", () => {
    const map = placementToMap("8/3p4/8/8/2pR4/8/8/4K2k");
    const all = scMovesFrom(map, "d4", "w", { siegedTanks: new Set(["d4"]) });
    expect(all.map((m) => `${m.from}${m.firesInPlace ? "!" : ">"}${m.to}`).sort()).toEqual([
      "d4!a4",
      "d4!b4",
      "d4!c4",
      "d4!d1",
      "d4!d2",
      "d4!d3",
      "d4!d5",
      "d4!d6",
      "d4!d7",
      "d4!d8",
      "d4!e4",
      "d4!f4",
      "d4!g4",
      "d4!h4",
    ]);
  });
});
