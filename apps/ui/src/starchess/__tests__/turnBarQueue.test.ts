import { describe, expect, it } from "vitest";

import { addScMove } from "~/starchess/scActions";
import {
  currentQueue,
  endPlanningTurn,
  planningSnapshot,
  queueScAction,
  resetStarChessEconomy,
  setPlanningSnapshot,
  starChessEconomies,
  storedMaterial,
} from "~/starchess/starChessStore";
import { parseScFen } from "~/starchess/scfen";

describe("starChessStore planning queue + endPlanningTurn", () => {
  it("End clears Q and bumps turn", () => {
    let snap = parseScFen(
      "SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = addScMove(snap, { color: "w", from: "d2", to: "d4" });
    snap = addScMove(snap, { color: "b", from: "e8", to: "c6" });
    setPlanningSnapshot(snap);
    expect(currentQueue()).toHaveLength(2);

    const result = endPlanningTurn();
    expect(result.next.turn).toBe(1);
    expect(result.next.queue?.actions).toEqual([]);
    expect(planningSnapshot()?.turn).toBe(1);
    expect(currentQueue()).toEqual([]);
    expect(planningSnapshot()?.placement).toBe("5k2/8/2b2n2/4p3/3P4/2R5/8/4K3");
  });

  it("End credits mineral income for the new turn (does not bank gas)", () => {
    resetStarChessEconomy({
      turn: 1,
      white: { stored: 0, deployed: 1 },
      black: { stored: 0, deployed: 1 },
      startTimer: false,
    });
    setPlanningSnapshot(
      parseScFen("SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:;b:"),
    );
    expect(storedMaterial()).toBe(0);

    endPlanningTurn();
    expect(planningSnapshot()?.turn).toBe(1);
    // Turn ≤10 income = 1 for both sides.
    expect(starChessEconomies().w.stored).toBe(1);
    expect(starChessEconomies().b.stored).toBe(1);
    expect(storedMaterial()).toBe(1);
  });

  it("queueScAction appends into the store snap", () => {
    setPlanningSnapshot(
      parseScFen("SCFEN|4bk2/8/5n2/4p3/8/2R5/3P4/4K3|0|33|P|G:11:11|Q:w:;b:"),
    );
    queueScAction({
      timing: "C",
      kind: "classical",
      color: "w",
      from: "d2",
      to: "d4",
    });
    expect(currentQueue()).toHaveLength(1);
    expect(currentQueue()[0]).toMatchObject({ from: "d2", to: "d4" });
  });
});
