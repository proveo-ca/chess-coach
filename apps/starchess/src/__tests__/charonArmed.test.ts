/**
 * Charon launchers belong to the Mecha that spent its own gas on a strike —
 * never to a Mecha that merely stands where some other unit used gas.
 * Scenarios are real resolves: SCFEN → `endScTurn`.
 */
import { endScTurn, parseScFen } from "@chess-coach/starchess-core";
import { describe, expect, it } from "vitest";

import {
  charonTrailSquares,
  queuedCharonSquares,
  restingCharonSquares,
} from "~/presentation/board/charonArmed";

const resolve = (scfen: string) => endScTurn(parseScFen(scfen));

describe("Charon launchers follow the Mecha that fired", () => {
  it("arms a Mecha that fired, and follows its classical leg", () => {
    // Bd1 snipes the a4 BattleShip (B), then walks d1→e2 (C).
    const esr = resolve(
      "SCFEN|4k3/8/8/8/q7/8/8/3BK3|21|33|P|G:13:33|Q:w:B=charonMissiles:d1:a4,C=d1e2;b:",
    );
    expect(esr.next.placement).toBe("4k3/8/8/8/8/8/4B3/4K3");
    expect([...charonTrailSquares(esr)].sort()).toEqual(["d1", "e2"]);
    expect(restingCharonSquares(esr, esr.next.specialsUsed)).toEqual(["e2"]);
  });

  it("does not arm a freshly deployed Mecha — the Command Center spent that gas", () => {
    const esr = resolve(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:01:11|B:3:3|Q:w:B=deploy:e1:d2:b;b:",
    );
    expect(esr.next.placement).toContain("3B4");
    expect(esr.next.specialsUsed).toEqual(["e1"]);
    expect(restingCharonSquares(esr, esr.next.specialsUsed)).toEqual([]);
    expect(charonTrailSquares(esr).size).toBe(0);
  });

  it("does not arm a Mecha that captures a unit which used gas", () => {
    // Black's e6 Marine gas-steps to e5; Bc3 takes it there. `U:` now marks
    // e5 — where the Mecha stands — but the gas was the Marine's.
    const esr = resolve(
      "SCFEN|4k3/8/4p3/8/8/2B5/8/4K3|1|33|P|G:10:11|Q:w:C=c3e5;b:B=stimStep:e6:e5",
    );
    expect(esr.next.placement).toBe("4k3/8/8/4B3/8/8/8/4K3");
    expect(esr.next.specialsUsed).toContain("e5");
    expect(restingCharonSquares(esr, esr.next.specialsUsed)).toEqual([]);
    expect(charonTrailSquares(esr).size).toBe(0);
  });

  it("folds the launchers once turn-open clears the stamp", () => {
    const esr = resolve(
      "SCFEN|4k3/8/8/8/q7/8/8/3BK3|21|33|P|G:13:33|Q:w:B=charonMissiles:d1:a4;b:",
    );
    expect(restingCharonSquares(esr, esr.next.specialsUsed)).toEqual(["d1"]);
    expect(restingCharonSquares(esr, [])).toEqual([]);
  });

  it("shows a queued strike on its own side only while planning", () => {
    const queue = parseScFen(
      "SCFEN|4k1b1/8/8/8/q7/8/8/3BK3|21|33|P|G:11:33|Q:w:B=charonMissiles:d1:a4;b:B=charonMissiles:g8:a2",
    ).queue!.actions;
    expect(queuedCharonSquares(queue, "w")).toEqual(["d1"]);
    expect(queuedCharonSquares(queue).sort()).toEqual(["d1", "g8"]);
  });
});
