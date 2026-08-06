import { describe, expect, it } from "vitest";

import {
  beginScTurn,
  endScTurn,
  parseScFen,
} from "@chess-coach/starchess-core";

describe("beginScTurn", () => {
  it("chips standing check before intent; End with skip does not double-chip", () => {
    const start = parseScFen(
      "SCFEN|k7/5r2/8/2n5/4K3/8/7b/8|0|33|P|G:11:11|Q:w:;b:",
    );
    const begun = beginScTurn(start);
    expect(begun.changed).toBe(true);
    expect(begun.attacks[0]).toMatchObject({
      kind: "kingShot",
      from: "c5",
      to: "e4",
      livesAfter: 2,
    });
    expect(begun.next.kingLives.w).toBe(2);
    expect(begun.next.phase).toBe("P");
    expect(begun.next.turn).toBe(0);

    const afterEnd = endScTurn(begun.next, { skipTurnStartChecks: true });
    expect(afterEnd.next.kingLives.w).toBe(2);
    expect(afterEnd.resolved.attacks.every((a) => a.kind !== "kingShot")).toBe(
      true,
    );
  });

  it("lethal turn-open check ends the match without intent", () => {
    const start = parseScFen(
      "SCFEN|k7/5r2/8/2n5/4K3/8/7b/8|0|11|P|G:11:11|Q:w:;b:",
    );
    const begun = beginScTurn(start);
    expect(begun.next.kingLives.w).toBe(0);
    expect(begun.next.phase).toBe("O");
  });
});
