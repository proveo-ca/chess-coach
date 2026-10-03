import { describe, expect, it } from "vitest";
import type { ScActionInput, Square } from "@chess-coach/starchess-core";
import { candidateInput } from "../candidates/input";
import { primitiveIntents } from "../candidates/primitives";
import { appendFailure, emptyPrefix } from "../candidates/ownPrefix";
import { FAMILY_ORDER } from "../candidates/types";
import { c, fixture, s, squares } from "./candidateFixtures";

const domain = (observation: ReturnType<typeof fixture>, prefix: readonly ScActionInput[] = []) =>
  [...primitiveIntents(candidateInput(observation), prefix)];
const at = (actions: ScActionInput[], kind: ScActionInput["kind"], from: Square, timing?: ScActionInput["timing"]) =>
  actions.filter((action) => action.kind === kind && action.from === from && (!timing || action.timing === timing));

describe("authorized primitive domains", () => {
  it("covers all seven families with registry/actor/timing/target/unit/promotion ordering", () => {
    const observation = fixture([["a1", "k"], ["b2", "p"], ["c3", "n"], ["d4", "b"], ["e5", "r"], ["f6", "q"]]);
    const actions = domain(observation);
    expect([...new Set(actions.map((action) => action.kind))]).toEqual(FAMILY_ORDER);
    const order = (action: ScActionInput) => [
      FAMILY_ORDER.indexOf(action.kind), squares.indexOf(action.from), action.timing === "F" ? 1 : 0,
      action.to ? squares.indexOf(action.to) : -1,
      "unit" in action && action.unit ? ["p", "n", "b", "r", "q"].indexOf(action.unit) : -1,
      action.promotion ? ["p", "n", "b", "r", "q"].indexOf(action.promotion) : -1,
    ];
    const compare = (left: ScActionInput, right: ScActionInput) => {
      const a = order(left); const b = order(right);
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
      return 0;
    };
    expect(actions).toEqual([...actions].sort(compare));
    expect(actions.every((action) => action.color === "w")).toBe(true);
    for (const action of actions.filter((action) => action.kind === "siegeMode" || action.kind === "spiderMine")) {
      expect(Object.keys(action).sort()).toEqual(["color", "from", "kind", "timing"]);
    }
  });

  it.each(["w", "b"] as const)("emits exactly five authored promotions for %s", (side) => {
    const from: Square = side === "w" ? "e7" : "e2";
    const to: Square = side === "w" ? "e8" : "e1";
    const actions = domain(fixture([["a4", "k"], [from, "p"]], { side }));
    for (const [kind, timing] of [["classical", "C"], ["stimStep", "B"], ["stimStep", "F"]] as const) {
      expect(at(actions, kind, from, timing).filter((action) => action.to === to).map((action) => action.promotion))
        .toEqual(["p", "n", "b", "r", "q"]);
    }
  });

  it.each(["w", "b"] as const)("uses structural preceding-B promotion potential for %s even with settlement blockers", (side) => {
    const from: Square = side === "w" ? "e6" : "e3";
    const authored: Square = side === "w" ? "e7" : "e2";
    const block: Square = side === "w" ? "e8" : "e1";
    for (const observation of [
      fixture([["a4", "k"], [from, "p"]], { side, unknown: [authored, block] }),
      fixture([["a4", "k"], [from, "p"], [block, "r", side === "w" ? "b" : "w"]], { side }),
    ]) {
      const step = s("stimStep", from, authored, "B", side);
      const before = at(domain(observation), "classical", from).filter((action) => action.to === authored);
      expect(before.map((action) => action.promotion)).toEqual([undefined]);
      const after = at(domain(observation, [step]), "classical", from).filter((action) => action.to === authored);
      expect(after.map((action) => action.promotion)).toEqual(["p", "n", "b", "r", "q"]);
      expect(after.every((action) => action.from === from && action.to === authored)).toBe(true);
      expect(at(domain(observation, [{ ...step, timing: "F" }]), "classical", from).filter((action) => action.to === authored))
        .toEqual(before);
    }
  });

  it("offers B births/arrivals only as classical actors and never special actors", () => {
    const observation = fixture([["a1", "k"], ["e2", "p"], ["h1", "q"]]);
    const birth = { ...s("deploy", "a1", "b2"), unit: "n" as const };
    const prefix = [birth, s("stimStep", "e2", "e3"), s("tacticalJump", "h1", "h5")];
    const actions = domain(observation, prefix);
    for (const from of ["b2", "e3", "h5"] as const) {
      expect(at(actions, "classical", from).length).toBeGreaterThan(0);
      expect(actions.filter((action) => action.from === from && action.kind !== "classical")).toEqual([]);
    }
    expect(at(domain(observation, [{ ...birth, timing: "F" }]), "classical", "b2")).toEqual([]);
  });

  it("keeps classical rays beyond blockers and unknown cells", () => {
    const observation = fixture([["a1", "k"], ["d1", "r"], ["d2", "p"], ["d4", "n", "b"]], { unknown: ["d3", "d5"] });
    const actions = at(domain(observation), "classical", "d1");
    expect(actions).toContainEqual(c("d1", "d8"));
    expect(appendFailure(candidateInput(observation), emptyPrefix(), c("d1", "d8"))).toBeNull();
  });

  it("keeps crushable own/enemy non-CC deployment targets and native F CC anchor", () => {
    const observation = fixture([["e1", "k"], ["d2", "n"], ["f1", "r", "b"], ["f2", "k", "b"]]);
    const root = at(domain(observation), "deploy", "e1", "B");
    expect(root.filter((action) => action.to === "d2").map((action) => "unit" in action ? action.unit : undefined)).toEqual(["p", "n", "b", "r", "q"]);
    expect(root.filter((action) => action.to === "f1")).toHaveLength(5);
    expect(root.some((action) => action.to === "f2" || action.to === "e1")).toBe(false);
    const after = at(domain(observation, [c("e1", "e2")]), "deploy", "e1", "F");
    expect(after.filter((action) => action.to === "e1")).toHaveLength(5);
    expect(after.filter((action) => action.to === "d3")).toHaveLength(5);
    expect(after.some((action) => action.to === "e2" || action.to === "f2")).toBe(false);
  });

  it("emits every Charon diagonal from append-time own C only without target filtering", () => {
    const observation = fixture([["a1", "k"], ["c1", "b"], ["d2", "p"], ["e3", "r", "b"]]);
    const expected = ["a3", "b2", "d2", "e3", "f4", "g5", "h6"];
    expect(at(domain(observation), "charonMissiles", "c1", "F").map((action) => action.to)).toEqual(expected);
    const after = at(domain(observation, [c("c1", "e3")]), "charonMissiles", "c1", "F").map((action) => action.to);
    expect(after).toContain("f4"); expect(after).not.toContain("b2");
    expect(at(domain(observation, [c("a1", "b2")]), "charonMissiles", "c1", "F").map((action) => action.to)).toEqual(expected);
    expect(at(domain(observation, [c("c1", "e3")]), "charonMissiles", "c1", "B").map((action) => action.to)).toEqual(expected);
  });

  it("retains unknown jump squares and excludes current occupied targets even after hypothetical vacates", () => {
    const observation = fixture([["a1", "k"], ["d1", "q"], ["h5", "p"], ["g5", "n", "b"]], { unknown: ["h6"] });
    const actions = at(domain(observation, [c("h5", "h6")]), "tacticalJump", "d1", "B");
    expect(actions.some((action) => action.to === "h6")).toBe(true);
    expect(actions.some((action) => ["d1", "h5", "g5", "a1"].includes(action.to!))).toBe(false);
    expect(actions).toHaveLength(60);
  });

  it("offers no off-board Marine stim target", () => {
    expect(at(domain(fixture([["a1", "k"], ["e8", "p"]])), "stimStep", "e8")).toEqual([]);
    expect(at(domain(fixture([["a8", "k"], ["e1", "p"]], { side: "b" })), "stimStep", "e1")).toEqual([]);
  });
});
