import { describe, expect, it } from "vitest";

import {
  beginScTurn,
  endScTurn,
  parseScFen,
  refillTurnGas,
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
    // Turn-open refills gas (even when already full).
    expect(begun.next.gas).toEqual({ w: 1, b: 1 });

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

  it("refills gas from income when no checks fire", () => {
    const empty = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:00:11|Q:w:;b:",
    );
    expect(empty.gas).toEqual({ w: 0, b: 0 });
    const begun = beginScTurn(empty);
    expect(begun.changed).toBe(false);
    expect(begun.next.gas).toEqual({ w: 1, b: 1 });
    expect(refillTurnGas(empty).gas).toEqual({ w: 1, b: 1 });
  });
});

describe("endScTurn gas timing", () => {
  it("leaves gas at 0 and advances income tier; beginScTurn refills", () => {
    let snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:",
    );
    snap = {
      ...snap,
      queue: {
        actions: [
          {
            timing: "C",
            kind: "classical",
            color: "w",
            from: "e2",
            to: "e4",
            seq: 0,
          },
        ],
      },
    };
    const r = endScTurn(snap, { skipTurnStartChecks: true });
    expect(r.next.turn).toBe(1);
    expect(r.next.gas).toEqual({ w: 0, b: 0 });
    expect(r.next.gasIncome).toEqual({ w: 1, b: 1 });

    const begun = beginScTurn(r.next);
    expect(begun.next.gas).toEqual({ w: 1, b: 1 });
  });
});
