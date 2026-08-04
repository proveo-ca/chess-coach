import { describe, expect, it } from "vitest";

import {
  PATH_COLLIDE_PLY_SC,
  PATH_COLLIDE_START_SCFEN,
  PATH_COLLIDE_STEPS,
  queuePathCollideStep,
} from "~/starchess/demos/pathCollide";
import { endScTurn } from "~/starchess/endScTurn";
import { parseScFen } from "~/starchess/scfen";

describe("pathCollide SCFEN (2 parallel turns)", () => {
  it("builds three plies from start through two resolves", () => {
    expect(PATH_COLLIDE_PLY_SC).toHaveLength(3);
    expect(PATH_COLLIDE_STEPS).toHaveLength(2);
  });

  it("turn 1: black mine a4 + knight c5; white rook a1", () => {
    const after = PATH_COLLIDE_PLY_SC[1]!;
    expect(after.mines).toEqual([{ color: "b", at: "a4" }]);
    expect(after.placement).toBe("7k/8/8/2n5/8/8/8/R3K3");
    expect(after.turn).toBe(1);
  });

  it("turn 2: chase boom at a8; siege F skipped; mine c5 remains", () => {
    const before = PATH_COLLIDE_PLY_SC[1]!;
    const queued = queuePathCollideStep(before, PATH_COLLIDE_STEPS[1]!);
    const { resolved, next, siegedThisTurn, events } = endScTurn(queued);

    expect(resolved.moves.some((m) => m.from === "a1" && m.to === "a8")).toBe(true);
    expect(resolved.mineTriggers[0]).toMatchObject({
      kind: "mineBlast",
      to: "a8",
      chaseFrom: "a4",
      victim: { piece: "r", color: "w" },
    });
    expect(siegedThisTurn).toEqual([]);
    expect(events.some((e) => e.phase === "specialAfter")).toBe(false);
    // King was on h8 — chase boom removes rook on a8; black king survives on h8.
    expect(next.placement).toBe("7k/8/8/8/4n3/8/8/4K3");
    expect(next.mines).toEqual([{ color: "b", at: "c5" }]);
    expect(PATH_COLLIDE_PLY_SC[2]).toMatchObject({
      placement: next.placement,
      mines: next.mines,
    });
  });

  it("start SCFEN parses", () => {
    const s = parseScFen(PATH_COLLIDE_START_SCFEN);
    expect(s.placement).toBe("7k/8/8/8/n7/8/8/4K3");
  });
});
