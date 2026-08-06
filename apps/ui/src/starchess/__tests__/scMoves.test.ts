/**
 * SC-native classical movegen — geometry, siege artillery, flags.
 * // SPEC: _spec/apps/ui/starchess/sc-moves.puml
 */
import { describe, expect, it } from "vitest";
import type { Square } from "chess.js";

import { placementToMap } from "~/starchess/board";
import {
  isScMoveShape,
  scMovesFor,
  scMovesFrom,
  type ScMove,
} from "~/starchess/scMoves";

const tos = (moves: ScMove[]) => moves.map((m) => m.to).sort();

describe("scMovesFrom — pawn", () => {
  it("single push and free start-rank double", () => {
    const map = placementToMap("8/8/8/8/8/8/4P3/4K3");
    const moves = scMovesFrom(map, "e2", "w");
    expect(tos(moves)).toEqual(["e3", "e4"]);
    expect(moves.find((m) => m.to === "e4")?.isPawnDoubleStep).toBe(true);
    expect(moves.find((m) => m.to === "e3")?.isPawnDoubleStep).toBe(false);
  });

  it("blocks double when mid occupied", () => {
    const map = placementToMap("8/8/8/8/8/4n3/4P3/4K3");
    expect(tos(scMovesFrom(map, "e2", "w"))).toEqual([]);
  });

  it("diagonal capture only; no en passant", () => {
    const map = placementToMap("8/8/8/3p1p2/4P3/8/8/4K3");
    const moves = scMovesFrom(map, "e4", "w");
    expect(tos(moves)).toEqual(["d5", "e5", "f5"]);
    expect(moves.filter((m) => m.capture).map((m) => m.to).sort()).toEqual(["d5", "f5"]);
  });

  it("flags promotion on last rank", () => {
    const map = placementToMap("8/4P3/8/8/8/8/8/4K3");
    const moves = scMovesFrom(map, "e7", "w");
    const quiet = moves.find((m) => m.to === "e8");
    expect(quiet?.promotes).toBe(true);
    expect(quiet?.promotion).toBe("q");
  });
});

describe("scMovesFrom — leapers and sliders", () => {
  it("knight L leaps; ally blocked", () => {
    const map = placementToMap("8/8/8/8/4N3/8/3P4/4K3");
    const moves = scMovesFrom(map, "e4", "w");
    expect(tos(moves)).toContain("d6");
    expect(tos(moves)).toContain("f6");
    expect(tos(moves)).toContain("c3");
    // d2 is ally pawn — not emitted
    expect(tos(moves)).not.toContain("d2");
  });

  it("king may step adjacent to enemy king (duel)", () => {
    const map = placementToMap("8/8/8/8/8/8/3k4/4K3");
    const moves = scMovesFrom(map, "e1", "w");
    expect(tos(moves)).toContain("d1");
    expect(tos(moves)).toContain("d2");
    expect(tos(moves)).toContain("e2");
    expect(tos(moves)).toContain("f1");
    expect(tos(moves)).toContain("f2");
    // stepping onto the enemy king is emitted but flagged
    const ontoKing = moves.find((m) => m.to === "d2" && m.capture?.type === "k");
    // d2 has black king
    const kingCap = moves.find((m) => m.capture?.type === "k");
    expect(kingCap?.to).toBe("d2");
    expect(kingCap?.dropsAtResolve).toBe(true);
    void ontoKing;
  });

  it("bishop includes first enemy on ray and stops", () => {
    const map = placementToMap("8/8/8/8/8/2n5/8/B3K3");
    const moves = scMovesFrom(map, "a1", "w");
    expect(tos(moves)).toEqual(["b2", "c3"]);
    expect(moves.find((m) => m.to === "c3")?.capture?.type).toBe("n");
  });

  it("rook ray blocked by ally", () => {
    const map = placementToMap("8/8/8/8/8/8/4P3/4R3");
    const moves = scMovesFrom(map, "e1", "w");
    expect(tos(moves)).not.toContain("e2");
    expect(tos(moves)).not.toContain("e3");
    expect(tos(moves)).toContain("a1");
    expect(tos(moves)).toContain("h1");
  });
});

describe("scMovesFrom — sieged rook artillery", () => {
  it("fires 9×9 Chebyshev captures only, firesInPlace", () => {
    // Sieged rook d4, enemy knight h7 (Chebyshev 4), empty quiet squares ignored
    const map = placementToMap("7k/7n/8/8/3R4/8/8/4K3");
    const moves = scMovesFrom(map, "d4", "w", { siegedRooks: ["d4"] });
    expect(moves.every((m) => m.firesInPlace)).toBe(true);
    expect(moves.every((m) => m.capture)).toBe(true);
    expect(tos(moves)).toContain("h7");
    expect(tos(moves)).toContain("h8"); // enemy king within 9×9
    expect(tos(moves)).not.toContain("d5"); // quiet
    // Outside 9×9: a8 is Chebyshev max(|0-3|,|8-4|)=max(3,4)=4 — inside
    // a1 from d4: max(3,3)=3 inside if enemy — empty
  });

  it("unsieged rook uses rook-line geometry", () => {
    const map = placementToMap("7k/7n/8/8/3R4/8/8/4K3");
    const moves = scMovesFrom(map, "d4", "w", { siegedRooks: [] });
    expect(moves.some((m) => m.firesInPlace)).toBe(false);
    expect(tos(moves)).toContain("d5");
    expect(tos(moves)).not.toContain("h7"); // not a rook line
  });
});

describe("scMovesFrom — flags", () => {
  it("marks dropsAtResolve on enemy king destination", () => {
    const map = placementToMap("8/8/8/8/8/8/3k4/3R4");
    const moves = scMovesFrom(map, "d1", "w");
    const hit = moves.find((m) => m.to === "d2");
    expect(hit?.dropsAtResolve).toBe(true);
    expect(hit?.capture?.type).toBe("k");
  });

  it("hostileMineOnTo is advisory only", () => {
    const map = placementToMap("8/8/8/8/8/8/4P3/4K3");
    const moves = scMovesFrom(map, "e2", "w", {
      mines: [{ color: "b", at: "e3" as Square }],
    });
    const e3 = moves.find((m) => m.to === "e3");
    expect(e3?.hostileMineOnTo).toBe(true);
    // still legal
    expect(e3).toBeTruthy();
  });

  it("never emits ally destinations", () => {
    const map = placementToMap("8/8/8/8/8/8/3PP3/4K3");
    const moves = scMovesFrom(map, "e1", "w");
    expect(tos(moves)).not.toContain("d2");
    expect(tos(moves)).not.toContain("e2");
  });
});

describe("scMovesFor", () => {
  it("lists every side move", () => {
    const map = placementToMap("4k3/8/8/8/8/8/4P3/4K3");
    const all = scMovesFor(map, "w");
    expect(all.some((m) => m.from === "e2")).toBe(true);
    expect(all.some((m) => m.from === "e1")).toBe(true);
    expect(all.every((m) => m.color === "w")).toBe(true);
  });
});

describe("isScMoveShape", () => {
  it("ignores blockers — blocked ray still shape-legal", () => {
    expect(isScMoveShape("r", "a1", "a8")).toBe(true);
    expect(isScMoveShape("b", "a1", "h8")).toBe(true);
    expect(isScMoveShape("n", "b1", "e5")).toBe(false);
    expect(isScMoveShape("n", "b1", "c3")).toBe(true);
    expect(isScMoveShape("p", "e2", "e4", "w")).toBe(true);
    expect(isScMoveShape("p", "e3", "e5", "w")).toBe(false);
  });
});
