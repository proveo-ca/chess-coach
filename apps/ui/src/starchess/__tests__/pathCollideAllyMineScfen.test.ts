import { describe, expect, it } from "vitest";

import {
  PATH_COLLIDE_ALLY_MINE_PLY_SC,
  PATH_COLLIDE_ALLY_MINE_START_SCFEN,
  PATH_COLLIDE_ALLY_MINE_STEPS,
  queuePathCollideAllyMineStep,
} from "~/starchess/demos/pathCollideAllyMine";
import { endScTurn } from "~/starchess/endScTurn";
import { parseScFen } from "~/starchess/scfen";

describe("pathCollideAllyMine SCFEN (2 parallel turns)", () => {
  it("builds three plies from start through two resolves", () => {
    expect(PATH_COLLIDE_ALLY_MINE_PLY_SC).toHaveLength(3);
    expect(PATH_COLLIDE_ALLY_MINE_STEPS).toHaveLength(2);
  });

  it("turn 1: white mine a4 + knight c5; black rook a8", () => {
    const after = PATH_COLLIDE_ALLY_MINE_PLY_SC[1]!;
    expect(after.mines).toEqual([{ color: "w", at: "a4" }]);
    expect(after.placement).toBe("r3k3/8/8/2N5/8/8/8/4K3");
    expect(after.turn).toBe(1);
  });

  it("turn 2: chase boom at a1; siege F skipped; mine c5 remains", () => {
    const before = PATH_COLLIDE_ALLY_MINE_PLY_SC[1]!;
    const queued = queuePathCollideAllyMineStep(before, PATH_COLLIDE_ALLY_MINE_STEPS[1]!);
    const { resolved, next, siegedThisTurn, events } = endScTurn(queued);

    expect(resolved.moves.some((m) => m.from === "a8" && m.to === "a1")).toBe(true);
    expect(resolved.mineTriggers[0]).toMatchObject({
      kind: "mineBlast",
      from: "a8",
      to: "a1",
      chaseFrom: "a4",
      victim: { piece: "r", color: "b" },
    });
    expect(siegedThisTurn).toEqual([]);
    expect(events.some((e) => e.phase === "specialAfter")).toBe(false);
    expect(next.placement).toBe("4k3/8/8/8/4N3/8/8/4K3");
    expect(next.mines).toEqual([{ color: "w", at: "c5" }]);
    expect(PATH_COLLIDE_ALLY_MINE_PLY_SC[2]).toMatchObject({
      placement: next.placement,
      mines: next.mines,
    });
  });

  it("start SCFEN parses", () => {
    const s = parseScFen(PATH_COLLIDE_ALLY_MINE_START_SCFEN);
    expect(s.placement).toBe("4k3/8/8/8/N7/8/8/4K3");
  });
});
