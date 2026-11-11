// SPEC: _spec/turn-planning.puml
import { describe, expect, test } from "bun:test";
import { appendTimeSpecialAnchor, classicalActorAt, classicalRewriteCoordinatesAfterB, classifyClassicalVacancy,
  knownAppendFailure, placementToMap, spawnCCAnchorFromMap } from "../src";
import type { PlanningKnowledge, ScActionInput, Square } from "../src";

const knowledge = (placement = "4k3/8/8/8/8/8/3P4/RNBQK3"): PlanningKnowledge => ({
  side: "w", knownPieces: placementToMap(placement), ownMines: new Set(), ownSiegedTanks: new Set(), unknownSquares: new Set(),
});
const c = (from: Square, to: Square): Extract<ScActionInput, { timing: "C" }> => ({ kind: "classical", timing: "C", color: "w", from, to });
const step: ScActionInput = { kind: "stimStep", timing: "B", color: "w", from: "d2", to: "d3" };
const deploy: ScActionInput = { kind: "deploy", timing: "B", color: "w", from: "e1", to: "f2", unit: "p" };

describe("canonical recipient append constraints", () => {
  test.each([
    [c("a1", "a8"), null], [c("d2", "e3"), null], [step, null], [deploy, null],
    [{ ...step, from: "a1" }, "actor"], [{ ...step, color: "b" }, "actor"],
    [{ ...step, to: "d4" }, "shape"], [{ ...deploy, to: "h8" }, "shape"],
    [{ kind: "tacticalJump", timing: "B", color: "w", from: "d1", to: "d1" }, "shape"],
    [{ kind: "tacticalJump", timing: "B", color: "w", from: "d1", to: "a1" }, "ownOccupancy"],
    [{ kind: "spiderMine", timing: "B", color: "w", from: "b1", to: "b2" }, "shape"],
  ] as const)("classifies known action %j", (action, expected) => {
    expect(knownAppendFailure(knowledge(), [], action)).toBe(expected);
  });

  test("keeps unknown paths and target occupancy outside classical shape eligibility", () => {
    const own = knowledge("4k3/8/3p4/8/8/8/8/3RK3");
    const before = structuredClone(own);
    expect(knownAppendFailure(own, [], c("d1", "d8"))).toBeNull();
    expect(own).toEqual(before);
  });

  test("allows deployment crushing except on Command Centers", () => {
    expect(knownAppendFailure(knowledge(), [], { ...deploy, to: "d2" })).toBeNull();
    expect(knownAppendFailure(knowledge("8/8/8/8/8/8/4k3/4K3"), [], { ...deploy, to: "e2" })).toBe("ownOccupancy");
    expect(knownAppendFailure(knowledge(), [], { ...deploy, to: "e1" })).toBe("shape");
  });

  test("projects F deploys around the CC landing but leaves B at its origin", () => {
    const own = knowledge();
    const prefix = [c("e1", "f2")];
    expect(spawnCCAnchorFromMap(own.knownPieces, "w", "B", prefix).commandCenter).toBe("e1");
    const after = spawnCCAnchorFromMap(own.knownPieces, "w", "F", prefix);
    expect(after.commandCenter).toBe("f2");
    expect(after.allyOccupied.has("e1")).toBe(false);
    expect(after.allyOccupied.has("f2")).toBe(true);
    expect(knownAppendFailure(own, prefix, { ...deploy, timing: "F", to: "g3" })).toBeNull();
    expect(knownAppendFailure(own, prefix, { ...deploy, timing: "B", to: "g3" })).toBe("shape");
  });

  test("distinguishes vacated B origins, reserved transit and matching gas pairs", () => {
    const own = knowledge("4k3/8/8/8/8/8/3P4/3RK3");
    const vacancy = classifyClassicalVacancy([step], "w");
    expect([...vacancy.bOrigins]).toEqual(["d2"]);
    expect([...vacancy.transit]).toEqual(["d3"]);
    expect([...vacancy.gasPairs]).toEqual(["d2:d3"]);
    expect(knownAppendFailure(own, [step], c("d1", "d2"))).toBeNull();
    expect(knownAppendFailure(own, [step], c("d1", "d3"))).toBe("ownOccupancy");
    expect(knownAppendFailure(own, [step], c("d2", "d3"))).toBeNull();
  });

  test("finds prior B births and transfers only for own classical actors", () => {
    const own = knowledge();
    expect(classicalActorAt(own.knownPieces, [deploy], "w", "f2")).toEqual({ color: "w", type: "p" });
    expect(classicalActorAt(own.knownPieces, [step], "w", "d3")).toEqual({ color: "w", type: "p" });
    expect(classicalActorAt(own.knownPieces, [step], "b", "d3")).toBeUndefined();
    expect(knownAppendFailure(own, [deploy], c("f2", "f3"))).toBeNull();
    expect(knownAppendFailure(own, [deploy], { kind: "stimStep", timing: "F", color: "w", from: "f2", to: "f3" })).toBe("actor");
  });

  test("enforces one C and one special per original actor", () => {
    const own = knowledge();
    expect(knownAppendFailure(own, [c("a1", "a2")], c("d2", "d3"))).toBe("timing");
    expect(knownAppendFailure(own, [step], { ...step, timing: "F" })).toBe("timing");
    expect(knownAppendFailure(own, [{ ...c("a8", "a7"), color: "b" }], c("d2", "d3"))).toBeNull();
  });

  test("enforces promotion fields and excludes deferred F promotion", () => {
    const own = knowledge("4k3/3P4/8/8/8/8/8/4K3");
    const last = c("d7", "d8");
    expect(knownAppendFailure(own, [], last)).toBe("shape");
    expect(knownAppendFailure(own, [], { ...last, promotion: "n" })).toBeNull();
    expect(knownAppendFailure(own, [], { ...last, promotion: "p" })).toBe("shape");
    const prior = knowledge("4k3/8/3P4/8/8/8/8/4K3");
    expect(knownAppendFailure(prior, [c("d6", "d7")], { kind: "stimStep", timing: "F", color: "w", from: "d6", to: "d7" })).toBe("timing");
  });

  test("applies mine cap and F anchors without requiring a known Charon victim", () => {
    const own = knowledge();
    const mine: ScActionInput = { kind: "spiderMine", timing: "F", color: "w", from: "b1" };
    const prefix = [c("b1", "c3")];
    expect(appendTimeSpecialAnchor(prefix, "w", "b1", "F")).toBe("c3");
    expect(knownAppendFailure({ ...own, ownMines: new Set(["a3", "b3", "c4"]) }, prefix, mine)).toBe("mineCap");
    expect(knownAppendFailure({ ...own, ownMines: new Set(["c3"]) }, prefix, mine)).toBe("ownOccupancy");
    const shot: ScActionInput = { kind: "charonMissiles", timing: "F", color: "w", from: "c1", to: "h6" };
    expect(knownAppendFailure(own, [], shot)).toBeNull();
    expect(knownAppendFailure(own, [c("c1", "d2")], shot)).toBeNull();
    expect(knownAppendFailure(own, [c("c1", "e3")], { ...shot, to: "h8" })).toBe("shape");
  });

  test("denies sieged fire at own mines but permits unsieged targeting", () => {
    const own = { ...knowledge(), ownMines: new Set<Square>(["a3"]), ownSiegedTanks: new Set<Square>(["a1"]) };
    expect(knownAppendFailure(own, [], c("a1", "a3"))).toBe("ownOccupancy");
    expect(knownAppendFailure(own, [{ kind: "siegeMode", timing: "B", color: "w", from: "a1" }], c("a1", "a3"))).toBeNull();
  });

  test("rewrites only genuine forward Marine-band and matching warp structures", () => {
    expect(classicalRewriteCoordinatesAfterB([step], c("d2", "d4"))).toEqual({ from: "d3", to: "d5" });
    expect(classicalRewriteCoordinatesAfterB([step], c("d2", "e3"))).toBeNull();
    expect(classicalRewriteCoordinatesAfterB([{ ...step, from: "d3", to: "d4" }], c("d3", "d5"))).toBeNull();
    const warp: ScActionInput = { kind: "tacticalJump", timing: "B", color: "w", from: "d1", to: "d4" };
    expect(classicalRewriteCoordinatesAfterB([warp], c("d1", "d4"))).toEqual({ from: "d4", to: "d7" });
    expect(classicalRewriteCoordinatesAfterB([warp], c("d1", "e2"))).toBeNull();
    expect(classicalRewriteCoordinatesAfterB([{ ...warp, to: "d8" }], c("d1", "d8"))).toBeNull();
  });
});
