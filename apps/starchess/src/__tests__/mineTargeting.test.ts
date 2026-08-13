/**
 * Mines as targets — UI affordances for the resolve rule.
 *  - board dests: marine front diagonal + sieged-tank fire onto a mined tile,
 *    with fogged hostile mines filtered out (offering the tile would leak them),
 *  - intent chrome: attacking a visible mine rings red like a capture,
 *  - Tactical Jump: mined tiles stay legal landings (never occupancy) and a
 *    hostile one detonates — mine boom, then the BattleShip.
 * // SPEC: _spec/packages/starchess-core/resolve.puml, _spec/apps/starchess/starchess-mode.puml
 */
import { describe, expect, it } from "vitest";
import {
  addScAction,
  endScTurn,
  parseScFen,
  placementToMap,
  scMovesFrom,
  type ScAction,
  type ScMine,
} from "@chess-coach/starchess-core";

import { minesVisibleToViewer } from "~/presentation/board/fogVisibility";
import { intentOverlaysFromQueue } from "~/presentation/combat/intentOverlays";
import { projectResolveTimeline } from "~/presentation/timeline/timelinePlayer";
import { tacticalJumpTargets } from "~/presentation/specials/queenTacticalJump";

const MINE_B = (at: string): ScMine => ({ color: "b", at: at as never });

describe("legal dests from a mined tile", () => {
  it("marine front diagonal onto a hostile mine is a dest (fog off)", () => {
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

  it("keeps own mines and drops fogged hostile mines under player fog", () => {
    // Sieged tank a1 lights 9×9 (a4 visible); a lone marine on d2 does not see h8.
    const placement = "4k3/8/8/8/8/8/3P4/R3K3";
    const mines = [MINE_B("a4"), MINE_B("h8"), { color: "w" as const, at: "g1" as never }];
    const seen = minesVisibleToViewer(placement, "w", mines, true, {
      siegedRooks: ["a1"],
    }).map((m) => m.at);
    expect(seen).toEqual(expect.arrayContaining(["a4", "g1"]));
    expect(seen).not.toContain("h8");
    // Observer / fog-off keeps every mine.
    expect(minesVisibleToViewer(placement, "w", mines, false)).toHaveLength(3);
  });
});

describe("intent chrome", () => {
  const attackMineQueue: ScAction[] = [
    { timing: "C", kind: "classical", color: "w", from: "d1", to: "c3", seq: 0 },
  ];

  it("rings a visible hostile mine like a capture intent", () => {
    const out = intentOverlaysFromQueue(attackMineQueue, {
      placement: "7k/8/8/8/8/8/8/3NK3",
      mines: [MINE_B("c3")],
      viewer: "w",
    });
    expect(out.checks).toEqual([{ at: "c3" }]);
    expect(out.destinations).toEqual([{ at: "c3", color: "w", piece: "n" }]);
  });

  it("does not ring a plain quiet step", () => {
    const out = intentOverlaysFromQueue(attackMineQueue, {
      placement: "7k/8/8/8/8/8/8/3NK3",
      viewer: "w",
    });
    expect(out.checks).toEqual([]);
  });

  it("does not ring an own mine (allies never arm)", () => {
    const out = intentOverlaysFromQueue(attackMineQueue, {
      placement: "7k/8/8/8/8/8/8/3NK3",
      mines: [{ color: "w", at: "c3" }],
      viewer: "w",
    });
    expect(out.checks).toEqual([]);
  });
});

describe("resolve timeline cues", () => {
  const endWith = (scfen: string, action: Parameters<typeof addScAction>[0]["action"]) =>
    endScTurn(addScAction({ snapshot: parseScFen(scfen), action }).snapshot, {
      skipTurnStartChecks: true,
    });

  it("attack that clears a mine booms the mine, not the attacker", () => {
    const result = endWith(
      "SCFEN|7k/8/8/8/8/8/8/3NK3|0|33|P|G:11:11|M:b:c3|Q:w:;b:",
      { timing: "C", kind: "classical", color: "w", from: "d1", to: "c3" },
    );
    const cues = projectResolveTimeline(result);
    const deaths = cues.filter((c) => c.kind === "death");
    expect(deaths).toEqual([
      expect.objectContaining({ at: "c3", mine: true, piece: "n", color: "b" }),
    ]);
    expect(cues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "attack", from: "d1", to: "c3" }),
        expect.objectContaining({ kind: "move", from: "d1", to: "c3" }),
      ]),
    );
  });

  it("Tactical Jump onto a hostile mine: mine boom then the BattleShip", () => {
    const result = endWith(
      "SCFEN|4k3/8/8/8/8/8/8/Q3K3|21|33|P|G:33:33|Q:w:;b:|M:w:;b:d4",
      { timing: "B", kind: "queenWarp", color: "w", from: "a1", to: "d4" },
    );
    const cues = projectResolveTimeline(result);
    const ids = cues.map((c) => c.id);
    const jump = cues.findIndex((c) => c.kind === "move" && c.queenJump);
    const mineBoom = cues.findIndex((c) => c.kind === "death" && c.mine);
    const hull = cues.findIndex((c) => c.kind === "death" && c.piece === "q");
    expect(jump).toBeGreaterThanOrEqual(0);
    expect(mineBoom).toBeGreaterThan(jump);
    expect(hull).toBeGreaterThan(mineBoom);
    // Pre-afterB ids so both deaths play on the board the jump landed on.
    expect(ids.filter((id) => id.startsWith("qj"))).toHaveLength(3);
  });

  it("Tactical Jump onto an own mine plays the jump alone", () => {
    const result = endWith(
      "SCFEN|4k3/8/8/8/8/8/8/Q3K3|21|33|P|G:33:33|Q:w:;b:|M:w:d4;b:",
      { timing: "B", kind: "queenWarp", color: "w", from: "a1", to: "d4" },
    );
    const cues = projectResolveTimeline(result);
    expect(cues.filter((c) => c.kind === "death")).toEqual([]);
  });
});

describe("Tactical Jump targets", () => {
  it("offers mined tiles — a mine is never occupancy", () => {
    const targets = tacticalJumpTargets("4k3/8/8/8/3Q4/8/8/4K3", "d4", "w");
    // c3 / e5 hold mines in the live board; the target set only drops occupancy.
    expect(targets).toEqual(expect.arrayContaining(["c3", "e5"]));
    expect(targets).not.toContain("d4");
    expect(targets).not.toContain("e1");
  });
});
