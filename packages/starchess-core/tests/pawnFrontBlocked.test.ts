/**
 * Marines only ever attack on their front diagonals — never straight ahead.
 * A unit met on the forward path therefore **blocks** the step: no attack cue,
 * no move collision, no fog discovery. The marine truncates onto the last empty
 * square before the blocker, like an ally-blocked slide. Head-on races are the
 * standard case and stay untouched — two marines stepping onto the same *empty*
 * square both die, because neither one attacked.
 */
import { describe, expect, it } from "vitest";

import {
  addScAction,
  addScMove,
  endScTurn,
  parseScFen,
  resolveTurn,
} from "../src/index";

/** White marine d2, black marine d5, kings off the file. */
const FACING = "SCFEN|4k3/8/8/3p4/8/8/3P4/4K3|1|33|P|G:11:11|Q:w:;b:";
/** White marine d2 with a black marine right in front on d3. */
const CONTACT = "SCFEN|4k3/8/8/8/8/3p4/3P4/4K3|1|33|P|G:11:11|Q:w:;b:";

describe("marine front step is blocked, never an attack", () => {
  it("head-on d2→d4 vs d5→d4 — both explode, neither attacks", () => {
    let s = parseScFen(FACING);
    s = addScMove(s, { color: "w", from: "d2", to: "d4" });
    s = addScMove(s, { color: "b", from: "d5", to: "d4" });
    const r = endScTurn(s, { skipTurnStartChecks: true });

    expect(r.next.placement).toBe("4k3/8/8/8/8/8/8/4K3");
    expect(r.resolved.attacks).toEqual([]);
    expect(r.resolved.pathRevealAttacks).toEqual([]);
    expect(r.resolved.moveCollisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          to: "d4",
          victim: { piece: "p", color: "w" },
          occupies: false,
          moveCollision: true,
        }),
        expect.objectContaining({
          to: "d4",
          victim: { piece: "p", color: "b" },
          occupies: false,
          moveCollision: true,
        }),
      ]),
    );
    expect(r.resolved.moveCollisions).toHaveLength(2);
  });

  it("visible enemy on d3 blocks d2→d3 — no capture, marine stays", () => {
    let s = parseScFen(CONTACT);
    s = addScMove(s, { color: "w", from: "d2", to: "d3" });
    const r = endScTurn(s, { skipTurnStartChecks: true });

    expect(r.next.placement).toBe("4k3/8/8/8/8/3p4/3P4/4K3");
    expect(r.resolved.attacks).toEqual([]);
    expect(r.resolved.moves).toEqual([]);
    expect(r.resolved.moveCollisions).toEqual([]);
    expect(r.resolved.pathRevealAttacks).toEqual([]);
  });

  it("an occupied d3 blocks the double d2→d4 — a marine never leaps a unit", () => {
    let s = parseScFen(CONTACT);
    s = addScMove(s, { color: "w", from: "d2", to: "d4" });
    const r = endScTurn(s, { skipTurnStartChecks: true });

    expect(r.next.placement).toBe("4k3/8/8/8/8/3p4/3P4/4K3");
    expect(r.resolved.attacks).toEqual([]);
    expect(r.resolved.moves).toEqual([]);
    expect(r.resolved.moveCollisions).toEqual([]);
  });

  it("gas beats the double to d4 — white truncates onto d3, black keeps d4", () => {
    // Black spends gas on d5→d4, which resolves in rank B, before any
    // classical. White's d2→d4 then finds d4 taken: it cannot shoot forward,
    // so it advances as far as it can and stops on d3.
    let s = parseScFen(FACING);
    s = addScAction({
      snapshot: s,
      action: { timing: "B", kind: "pawnDouble", color: "b", from: "d5", to: "d4" },
    }).snapshot;
    s = addScMove(s, { color: "w", from: "d2", to: "d4" });
    const r = endScTurn(s, { skipTurnStartChecks: true });

    expect(r.next.placement).toBe("4k3/8/8/8/3p4/3P4/8/4K3");
    expect(r.resolved.attacks).toEqual([]);
    expect(r.resolved.moveCollisions).toEqual([]);
    expect(r.resolved.moves).toEqual([
      expect.objectContaining({ from: "d2", to: "d3", piece: "p" }),
    ]);
  });

  it("an allied d3 blocks the double d2→d4 too", () => {
    let s = parseScFen("SCFEN|4k3/8/8/8/8/3N4/3P4/4K3|1|33|P|G:11:11|Q:w:;b:");
    s = addScMove(s, { color: "w", from: "d2", to: "d4" });
    const r = endScTurn(s, { skipTurnStartChecks: true });

    expect(r.next.placement).toBe("4k3/8/8/8/8/3N4/3P4/4K3");
    expect(r.resolved.moves).toEqual([]);
  });

  it("a fogged enemy in front blocks — no move collision, no discovery", () => {
    // Nothing on the board is visible: the front step must still block rather
    // than degrade into the fog capture/occupy that every other unit gets.
    const r = resolveTurn({
      placement: "4k3/8/8/8/8/3p4/3P4/4K3",
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "d2", to: "d3" },
      black: null,
      isTargetVisible: () => false,
    });

    expect(r.afterAll.placement).toBe("4k3/8/8/8/8/3p4/3P4/4K3");
    expect(r.attacks).toEqual([]);
    expect(r.moves).toEqual([]);
    expect(r.moveCollisions).toEqual([]);
    expect(r.pathRevealAttacks).toEqual([]);
  });

  it("an enemy king in front blocks — no HP chip", () => {
    const r = resolveTurn({
      placement: "8/8/8/8/8/3k4/3P4/4K3",
      kingLives: { w: 3, b: 3 },
      white: { color: "w", from: "d2", to: "d3" },
      black: null,
      isTargetVisible: () => false,
    });

    expect(r.afterAll.placement).toBe("8/8/8/8/8/3k4/3P4/4K3");
    expect(r.afterAll.kingLives).toEqual({ w: 3, b: 3 });
    expect(r.attacks).toEqual([]);
    expect(r.pathRevealAttacks).toEqual([]);
  });

  it("the front block leaves the front diagonals alone", () => {
    let s = parseScFen("SCFEN|4k3/8/8/8/8/2p1p3/3P4/4K3|1|33|P|G:11:11|Q:w:;b:");
    s = addScMove(s, { color: "w", from: "d2", to: "c3" });
    const r = endScTurn(s, { skipTurnStartChecks: true });

    expect(r.next.placement).toBe("4k3/8/8/8/8/2P1p3/8/4K3");
    expect(r.resolved.attacks).toEqual([
      expect.objectContaining({
        kind: "capture",
        from: "d2",
        to: "c3",
        victim: { piece: "p", color: "b" },
        occupies: true,
      }),
    ]);
  });
});
