/**
 * `isCheckOnlyResolve` gates four consumers (TurnBar check chip, DualNav ply
 * chaining, tutorial `hasCheck` narration, spawn-spend economy preview) on
 * "this ply is nothing but the turn-open check". A sieged tank's fire
 * missions are attacks without moves, so they counterfeit that shape:
 * only attacks that actually hit a unit may satisfy the predicate.
 */
import { describe, expect, it } from "vitest";
import { addScAction, endScTurn, parseScFen } from "@chess-coach/starchess-core";

import { isCheckOnlyResolve } from "~/presentation/hud/isCheckOnlyResolve";

const SIEGED_D4 = "SCFEN|7k/8/8/8/3R4/8/8/K7|11|33|P|G:21:22|Q:w:;b:|S:d4";

const endWith = (
  scfen: string,
  action: Parameters<typeof addScAction>[0]["action"],
) => {
  let snap = parseScFen(scfen);
  snap = addScAction({ snapshot: snap, action }).snapshot;
  return endScTurn(snap, { skipTurnStartChecks: true });
};

describe("isCheckOnlyResolve · siege fire missions", () => {
  it("a victimless shelling End is not a check", () => {
    // HE on empty ground: attacks=[shelling], no moves, no specials.
    const r = endWith(SIEGED_D4, {
      timing: "C",
      kind: "classical",
      color: "w",
      from: "d4",
      to: "d5",
    });
    expect(r.resolved.attacks).toEqual([
      expect.objectContaining({ kind: "shelling", from: "d4", to: "d5" }),
    ]);
    expect(r.resolved.moves).toHaveLength(0);
    expect(isCheckOnlyResolve(r)).toBe(false);
  });

  it("a lone mine-clear End is not a check", () => {
    // Sieged turret clears a hostile mine in place: mineBlast with no victim,
    // no occupy (sieged never relocates), so moves stay empty.
    const r = endWith(`${SIEGED_D4}|M:w:;b:d5`, {
      timing: "C",
      kind: "classical",
      color: "w",
      from: "d4",
      to: "d5",
    });
    expect(r.resolved.attacks).toEqual([
      expect.objectContaining({ kind: "mineBlast", to: "d5" }),
    ]);
    expect(r.resolved.moves).toHaveLength(0);
    expect(isCheckOnlyResolve(r)).toBe(false);
  });

  it("a sieged capture End (fires in place, victim) still counts", () => {
    // Pre-existing semantics: an attack that killed a unit keeps the ply
    // chainable — the narrowing must not swallow real combat.
    const r = endWith("SCFEN|7k/3p4/8/8/3R4/8/8/K7|11|33|P|G:21:22|Q:w:;b:|S:d4", {
      timing: "C",
      kind: "classical",
      color: "w",
      from: "d4",
      to: "d7",
    });
    expect(r.resolved.attacks).toEqual([
      expect.objectContaining({
        kind: "capture",
        victim: { piece: "p", color: "b" },
      }),
    ]);
    expect(isCheckOnlyResolve(r)).toBe(true);
  });
});
