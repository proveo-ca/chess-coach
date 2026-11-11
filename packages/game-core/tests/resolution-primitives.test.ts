// SPEC: _spec/resolution-primitives.puml
import { describe, expect, test } from "bun:test";
import { charonRayEdge, charonStrikeTarget, charonTargetShips, getSideVision, hostileMineOn, mineContact,
  moverContact, movesAirborne, placementAfterMechaCharon, placementToMap, revealStepsTo, scanRay,
  squareTicks, timedMover, travelSquares, travelTicks, withoutMine } from "../src";
import type { MineContactMode, ScMine, Square } from "../src";

describe("ordered mine contact", () => {
  test.each(["attack", "walk", "arrive", "walkThenAttack"] as const)("keeps empty and own-only paths inert in %s mode", mode => {
    expect(mineContact({ mines: [{ at: "a2", color: "w" }], color: "w", piece: "r", squares: ["a2", "a3"], mode })).toEqual({ kind: "inert" });
    expect(mineContact({ mines: undefined, color: "w", piece: "r", squares: [], mode })).toEqual({ kind: "inert" });
  });

  test("clears an attacked mine and chases a walker to landing", () => {
    const mines: ScMine[] = [{ at: "a2", color: "b" }, { at: "a4", color: "b" }];
    const query = { mines, color: "w" as const, piece: "r" as const, squares: ["a2", "a3", "a4"] as Square[] };
    const cleared = mineContact({ ...query, mode: "attack" });
    expect(cleared).toEqual({ kind: "cleared", at: "a2", mineColor: "b" });
    const chased = mineContact({ ...query, mode: "walk" });
    expect(chased).toEqual({ kind: "detonated", at: "a4", mineColor: "b", chaseFrom: "a2" });
    expect(withoutMine(mines, chased)).toEqual([mines[1]!]);
    expect(mines).toHaveLength(2);
  });

  test("walk-then-attack clears only a landing mine and triggers an intermediate mine", () => {
    expect(mineContact({ mines: [{ at: "a4", color: "b" }], color: "w", piece: "r", squares: ["a2", "a3", "a4"], mode: "walkThenAttack" })).toEqual({ kind: "cleared", at: "a4", mineColor: "b" });
    expect(mineContact({ mines: [{ at: "a2", color: "b" }], color: "w", piece: "r", squares: ["a2", "a3", "a4"], mode: "walkThenAttack" })).toEqual({ kind: "detonated", at: "a4", mineColor: "b", chaseFrom: "a2" });
  });

  test.each(["attack", "walk", "arrive", "walkThenAttack"] as const)("CCs clear mines in %s mode", mode => {
    expect(mineContact({ mines: [{ at: "e3", color: "b" }], color: "w", piece: "k", squares: ["e3"], mode })).toEqual({ kind: "cleared", at: "e3", mineColor: "b" });
  });

  test("preserves native first-mine selection and removes all identities on the spent tile", () => {
    const mines: ScMine[] = [{ at: "a2", color: "w" }, { at: "a2", color: "b" }];
    expect(hostileMineOn(mines, "w", "a2")).toBe(false);
    const query = { mines, color: "w" as const, piece: "p" as const, squares: ["a2"] as Square[], mode: "arrive" as MineContactMode };
    expect(mineContact(query)).toEqual({ kind: "inert" });
    const reversed = [...mines].reverse();
    const hit = mineContact({ ...query, mines: reversed });
    expect(hit).toEqual({ kind: "detonated", at: "a2", mineColor: "b" });
    expect(withoutMine(reversed, hit)).toEqual([]);
    expect(withoutMine(mines, { kind: "inert" })).toEqual(mines);
    expect(withoutMine(mines, { kind: "inert" })).not.toBe(mines);
  });
});

describe("simultaneous travel timing", () => {
  test.each(["p", "n", "b", "r", "q", "k"] as const)("retains %s travel and airborne rules", piece => {
    expect(squareTicks(piece)).toBe(piece === "n" ? 1 : 2);
    expect(movesAirborne(piece)).toBe(["p", "n", "k"].includes(piece));
    expect(travelSquares("b1", "c3", piece)).toBe(piece === "n" ? 3 : 2);
    expect(travelTicks("b1", "c3", piece)).toBe(piece === "n" ? 3 : 4);
    expect(travelSquares("b1", "b1", piece)).toBe(1);
  });

  test("airborne movers occupy only landing while ground movers traverse ray tiles", () => {
    expect(timedMover("a1", "a4", "r")).toEqual({ steps: [{ at: "a2", enter: 2 }, { at: "a3", enter: 4 }, { at: "a4", enter: 6 }] });
    expect(timedMover("b1", "d2", "n")).toEqual({ steps: [{ at: "d2", enter: 3 }] });
    expect(moverContact(timedMover("b1", "d2", "n"), timedMover("a2", "c2", "r"))).toBeNull();
  });

  test("reports the first holder and a lower-named head-on swap tile", () => {
    expect(moverContact(timedMover("a2", "a3", "r"), timedMover("c1", "a3", "b"))).toEqual({ at: "a3", tick: 4, first: "a" });
    expect(moverContact(timedMover("c1", "a3", "b"), timedMover("a2", "a3", "r"))).toEqual({ at: "a3", tick: 4, first: "b" });
    expect(moverContact(timedMover("a1", "d1", "r"), timedMover("d1", "a1", "r"))).toEqual({ at: "b1", tick: 4, first: "both" });
  });

  test("keeps landing deaths present at contact tick but absent from later collisions", () => {
    expect(moverContact(timedMover("a2", "a3", "r", { diesOnLanding: true }), timedMover("b3", "a3", "r"))).toEqual({ at: "a3", tick: 2, first: "both" });
    expect(moverContact(timedMover("a1", "a3", "r", { diesOnLanding: true }), timedMover("a7", "a3", "r"))).toBeNull();
    expect(moverContact(timedMover("a1", "a3", "r"), timedMover("a7", "a3", "r"))).toEqual({ at: "a3", tick: 8, first: "a" });
  });
});

describe("causal ray discovery prerequisites", () => {
  test("records exact first discovery, stop-before and evaluated path taps", () => {
    const placement = "4k3/p7/8/8/8/8/8/R3K3";
    const board = placementToMap(placement);
    const visible = getSideVision(board, "w");
    const steps: [Square, boolean][] = [], returned: (number | null)[] = [], targets: Square[] = [];
    const input = { placement, board, from: "a1" as const, intentTo: "a8" as const, color: "w" as const, canSee: (_side: "w" | "b", at: Square) => visible.litSquares.has(at) };
    const result = scanRay(input, target => { targets.push(target); return { step: (at, lit) => steps.push([at, lit]), returned: value => returned.push(value) }; });
    expect(result.contact).toMatchObject({ at: "a7", index: 5, startVisible: false, revealSteps: 4, becomesVisible: true, discovery: "a5", stopBefore: "a6" });
    expect(targets).toEqual(["a7"]);
    expect(steps).toEqual([["a2", false], ["a3", false], ["a4", false], ["a5", true]]);
    expect(returned).toEqual([4]);
    expect(revealStepsTo({ ...input, target: "a7" })).toBe(4);
    expect(board.get("a1")).toEqual({ type: "r", color: "w" });
  });

  test("stops at the first adjacent blocker and avoids querying later contacts", () => {
    const placement = "4k3/8/8/8/8/8/P7/R3K3";
    const targets: Square[] = [];
    const result = scanRay({ placement, board: placementToMap(placement), from: "a1", intentTo: "a8", color: "w", canSee: () => true }, target => { targets.push(target); return undefined; });
    expect(result.contact).toMatchObject({ at: "a2", startVisible: true, becomesVisible: false, discovery: null, stopBefore: null });
    expect(targets).toEqual(["a2"]);
    expect(scanRay({ placement, board: new Map(), from: "a1", intentTo: "b3", color: "w", canSee: () => false })).toEqual({ mids: [], contact: null });
  });
});

describe("Charon strike primitives", () => {
  test("ignores nonships but respects first allied or enemy ship screens", () => {
    const map = placementToMap("4k3/8/8/6q1/8/4P3/8/2B1K3");
    expect(charonStrikeTarget(map, "c1", "g5")).toBe("g5");
    expect(charonTargetShips(map, "c1")).toEqual(["g5"]);
    map.set("e3", { type: "q", color: "w" });
    expect(charonStrikeTarget(map, "c1", "g5")).toBeNull();
    expect(charonTargetShips(map, "c1")).toEqual([]);
    map.set("e3", { type: "q", color: "b" });
    expect(charonTargetShips(map, "c1")).toEqual(["e3"]);
    expect(charonStrikeTarget(map, "c1", "g5")).toBeNull();
  });

  test("bound paid side can fire after the actor disappears while planning requires a Mecha", () => {
    const map = placementToMap("4k3/8/8/6q1/8/8/8/4K3");
    expect(charonStrikeTarget(map, "c1", "g5")).toBeNull();
    expect(charonStrikeTarget(map, "c1", "g5", "w")).toBe("g5");
    expect(charonStrikeTarget(map, "c1", "g5", "b")).toBeNull();
    expect(charonStrikeTarget(map, "c1", "c5", "w")).toBeNull();
    expect(charonStrikeTarget(map, "c1", "h6", "w")).toBeNull();
    expect(charonTargetShips(map, "c1")).toEqual([]);
  });

  test("removes only the chosen ship and preserves fizzle ray edges", () => {
    const placement = "4k3/8/8/6q1/8/8/8/2B1K3";
    const result = placementAfterMechaCharon(placement, "g5");
    expect(placementToMap(result).has("g5")).toBe(false);
    expect(placementToMap(result).get("c1")).toEqual({ type: "b", color: "w" });
    expect(charonRayEdge("e4", "d5")).toBe("a8");
    expect(charonRayEdge("e4", "e5")).toBe("e8");
    expect(charonRayEdge("e4", "g5")).toBe("g5");
    expect(charonRayEdge("e4", "e4")).toBe("e4");
  });
});
