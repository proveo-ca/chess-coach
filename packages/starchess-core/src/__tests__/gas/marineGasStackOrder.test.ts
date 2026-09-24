/**
 * Marine gas stack order-independence: move-then-gas and gas-then-move MUST
 * resolve to the same square. Ranks outside the double-step band advance 2
 * squares (1 classical + 1 gas); inside it they advance 3 (classical double +
 * gas). The band covers the start rank and the marine's own back rank, which a
 * Command Center deploy can reach.
 * // SPEC: _spec/packages/starchess-core/turn-queue-sequence.puml
 */
import { describe, expect, it } from "vitest";

import { addScAction, endScTurn, parseScFen } from "../../index";

/** Build a snapshot with a single Marine on `pawn` and its Command Center off the file. */
const snapWith = (marine: string, color: "w" | "b"): ScFenSnapshot => {
  const rank = Number(marine[1]);
  const files = ["4k3", "8", "8", "8", "8", "8", "8", "4K3"];
  files[8 - rank] = `4${color === "w" ? "P" : "p"}3`;
  return parseScFen(`SCFEN|${files.join("/")}|1|33|P|G:11:11|Q:w:;b:`);
};

type ScFenSnapshot = ReturnType<typeof parseScFen>;

/** The single Marine's square after `endScTurn`. */
const marineSquareOf = (placement: string, color: "w" | "b"): string => {
  const ranks = placement.split("/");
  for (let i = 0; i < 8; i += 1) {
    const rank = ranks[i]!;
    let file = 0;
    for (const ch of rank) {
      if (/\d/.test(ch)) {
        file += Number(ch);
      } else if (ch === (color === "w" ? "P" : "p")) {
        return `${"abcdefgh"[file]}${8 - i}`;
      } else {
        file += 1;
      }
    }
  }
  throw new Error(`no ${color} Marine in ${placement}`);
};

/** Resolve `actions` queued on `pawn` for `color`, return the final Marine square. */
const resolve = (
  marine: string,
  color: "w" | "b",
  actions: Array<{ timing: "B" | "C" | "F"; from: string; to: string }>,
): { square: string; placement: string } => {
  let snap = snapWith(marine, color);
  for (const a of actions) {
    snap = addScAction({
      snapshot: snap,
      action: {
        ...a,
        kind: a.timing === "C" ? "classical" : "stimStep",
        color,
      },
    }).snapshot;
  }
  const result = endScTurn(snap);
  return {
    square: marineSquareOf(result.next.placement, color),
    placement: result.next.placement,
  };
};

/** Resolve on an arbitrary placement (for blocker tests), return final Marine square. */
const resolveOn = (
  placement: string,
  color: "w" | "b",
  actions: Array<{
    timing: "B" | "C" | "F";
    from: string;
    to: string;
    promotion?: "q" | "r" | "b" | "n";
  }>,
): { square: string; placement: string } => {
  let snap = parseScFen(`SCFEN|${placement}|1|33|P|G:11:11|Q:w:;b:`);
  for (const a of actions) {
    snap = addScAction({
      snapshot: snap,
      action: {
        ...a,
        kind: a.timing === "C" ? "classical" : "stimStep",
        color,
      },
    }).snapshot;
  }
  const result = endScTurn(snap);
  return {
    square: marineSquareOf(result.next.placement, color),
    placement: result.next.placement,
  };
};

describe("Marine gas stack — order independence", () => {
  it.each([
    ["white non-start", "e3", "w", "e5", 2],
    ["white start rank", "e2", "w", "e5", 3],
    ["black non-start", "e6", "b", "e4", 2],
    ["black start rank", "e7", "b", "e4", 3],
  ] as const)(
    "%s: gas-move and move-gas both land %s (%s squares)",
    (_label, marine, color, expected, squares) => {
      const mid =
        color === "w"
          ? `${marine[0]}${Number(marine[1]) + 1}`
          : `${marine[0]}${Number(marine[1]) - 1}`;
      const far =
        color === "w"
          ? `${marine[0]}${Number(marine[1]) + (squares === 3 ? 2 : 1)}`
          : `${marine[0]}${Number(marine[1]) - (squares === 3 ? 2 : 1)}`;

      const byGasMove = resolve(marine, color, [
        { timing: "B", from: marine, to: mid },
        { timing: "C", from: marine, to: far },
      ]);
      const byMoveGas = resolve(marine, color, [
        { timing: "C", from: marine, to: far },
        { timing: "F", from: marine, to: mid },
      ]);

      expect(byGasMove.square).toBe(expected);
      expect(byMoveGas.square).toBe(expected);
      // Order must not change the resolved board.
      expect(byMoveGas.placement).toBe(byGasMove.placement);
    },
  );

  it("single-step stack from the start rank stays 2 squares (pinned)", () => {
    const byGasMove = resolve("e2", "w", [
      { timing: "B", from: "e2", to: "e3" },
      { timing: "C", from: "e2", to: "e3" },
    ]);
    expect(byGasMove.square).toBe("e4");
  });

  it.each([
    // Deployed behind the Command Center — the Command Center ring reaches d1/d8.
    ["white back rank", "3PK3", "4k3", "w", "d1", "d2", "d3", "d4"],
    ["black back rank", "3pk3", "4K3", "b", "d8", "d7", "d6", "d5"],
  ] as const)(
    "%s marine stacks to 3 squares like the start rank",
    (_label, home, far8, color, marine, mid, dbl, expected) => {
      const rows =
        color === "w"
          ? [far8, "8", "8", "8", "8", "8", "8", home]
          : [home, "8", "8", "8", "8", "8", "8", far8];
      const placement = rows.join("/");

      const byGasMove = resolveOn(placement, color, [
        { timing: "B", from: marine, to: mid },
        { timing: "C", from: marine, to: dbl },
      ]);
      const byMoveGas = resolveOn(placement, color, [
        { timing: "C", from: marine, to: dbl },
        { timing: "F", from: marine, to: mid },
      ]);

      expect(byGasMove.square).toBe(expected);
      expect(byMoveGas.square).toBe(expected);
      expect(byMoveGas.placement).toBe(byGasMove.placement);
    },
  );

  it("non-start-rank 2-rank C fizzles after B — never rewritten, never throws", () => {
    // A 2-rank C only exists from the start rank; elsewhere it was never a
    // legal double, so gas-then-move must leave it to fizzle (Marine stays at
    // the gas step) instead of rewriting into a phantom double.
    for (const [marine, color, mid] of [
      ["e5", "w", "e6"],
      ["e6", "b", "e5"],
    ] as const) {
      const byGasMove = resolve(marine, color, [
        { timing: "B", from: marine, to: mid },
        { timing: "C", from: marine, to: color === "w" ? "e7" : "e4" },
      ]);
      expect(byGasMove.square).toBe(mid);
    }
  });

  it("blocked final square: gas-then-move fizzles like move-then-gas (rank 5 → 6)", () => {
    // Enemy on the square after the stack. Both orders fizzle at the gas step —
    // a gas step never captures through a blocked landing square.
    const blocked = "k7/4r3/8/4P3/8/8/8/4K3";
    const byGasMove = resolveOn(blocked, "w", [
      { timing: "B", from: "e5", to: "e6" },
      { timing: "C", from: "e5", to: "e6" },
    ]);
    const byMoveGas = resolveOn(blocked, "w", [
      { timing: "C", from: "e5", to: "e6" },
      { timing: "F", from: "e5", to: "e6" },
    ]);
    expect(byGasMove.square).toBe("e6");
    expect(byMoveGas.square).toBe("e6");
    expect(byMoveGas.placement).toBe(byGasMove.placement);
  });

  it("blocked last-rank approach: conversion stack parks on the 7th (blocked, no promote)", () => {
    // User scenario: Marine on the 6th, enemy on the 8th rank. Both orders
    // converge to the same converted stack (B + C-with-promotion) and must be
    // blocked at the 7th rank — never a phantom capture / promotion.
    const blocked = "k3r3/8/4P3/8/8/8/8/4K3";
    const byGasMove = resolveOn(blocked, "w", [
      { timing: "B", from: "e6", to: "e7" },
      { timing: "C", from: "e6", to: "e7", promotion: "q" },
    ]);
    expect(byGasMove.square).toBe("e7");
    expect(byGasMove.placement).toContain("r");
  });

  it("blocked start-rank double: gas-then-move does not capture through the block", () => {
    // Enemy on e5 (the double+gas landing square). The rewritten double must
    // fizzle at the gas step instead of capturing — mirroring move-then-gas,
    // whose post-C gas fizzles and leaves the enemy untouched.
    const blocked = "k7/8/8/4r3/8/8/4P3/4K3";
    const byGasMove = resolveOn(blocked, "w", [
      { timing: "B", from: "e2", to: "e3" },
      { timing: "C", from: "e2", to: "e4" },
    ]);
    const byMoveGas = resolveOn(blocked, "w", [
      { timing: "C", from: "e2", to: "e4" },
      { timing: "F", from: "e2", to: "e3" },
    ]);
    expect(byGasMove.square).toBe("e3");
    expect(byMoveGas.square).toBe("e4");
    // Neither order takes the blocker.
    expect(byGasMove.placement).toContain("r");
    expect(byMoveGas.placement).toContain("r");
  });
});
