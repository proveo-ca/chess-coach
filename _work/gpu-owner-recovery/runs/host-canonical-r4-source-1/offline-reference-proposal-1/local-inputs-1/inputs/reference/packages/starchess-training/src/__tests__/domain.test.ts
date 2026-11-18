// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { describe, expect, it } from "vitest";
import { ACTION_KINDS } from "@chess-coach/starchess-arena/intent-codec-v1";
import type { ScActionInput, Square } from "@chess-coach/starchess-core";
import { appendFailure, appendState, emptyPrefix, planningKnowledge, primitiveDomain, type PrefixState } from "../domain";
import { allActors, c, observation, s, squares } from "./fixtures";

const units = ["p", "n", "b", "r", "q"];
const setup = (o = observation(), actions: ScActionInput[] = []) => {
  const knowledge = planningKnowledge(o);
  const state = actions.reduce((prefix, action) => appendState(knowledge, prefix, action), emptyPrefix());
  return { o, knowledge, state, domain: (kind?: typeof ACTION_KINDS[number]) => [...primitiveDomain(knowledge, state, kind)],
    failure: (action: ScActionInput, prefix: PrefixState = state) => appendFailure(o, knowledge, prefix, action) };
};

describe("authorized primitive domains", () => {
  it.each(["w", "b"] as const)("matches independent singleton geometry for all seven families, %s", (side) => {
    const { domain, failure, knowledge } = setup(allActors(side));
    const actual = domain();
    expect([...new Set(actual.map((a) => a.kind))]).toEqual(ACTION_KINDS);
    for (const kind of ACTION_KINDS) {
      const family = actual.filter((a) => a.kind === kind);
      if (kind === "classical") {
        const expected: ScActionInput[] = [];
        for (const [from, actor] of knowledge.knownPieces) {
          if (actor.color !== side) continue;
          for (const to of squares) {
            const dx = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
            const dy = Number(to[1]) - Number(from[1]);
            const forward = dy * (side === "w" ? 1 : -1);
            const shape = actor.type === "k" ? from !== to && dx <= 1 && Math.abs(dy) <= 1
              : actor.type === "p" ? (dx <= 1 && forward === 1) || (dx === 0 && forward === 2 && (side === "w" ? Number(from[1]) <= 2 : Number(from[1]) >= 7))
              : actor.type === "n" ? (dx === 1 && Math.abs(dy) === 2) || (dx === 2 && Math.abs(dy) === 1)
              : actor.type === "b" ? dx > 0 && dx === Math.abs(dy)
              : actor.type === "r" ? from !== to && (dx === 0 || dy === 0)
              : from !== to && (dx === Math.abs(dy) || dx === 0 || dy === 0);
            if (shape) expected.push(c(from, to, side));
          }
        }
        expect(family).toEqual(expected);
      } else {
        expect([...new Set(family.map((a) => a.timing))]).toEqual(["B", "F"]);
        const from = family[0]!.from;
        for (const timing of ["B", "F"] as const) {
          const timed = family.filter((a) => a.timing === timing);
          const targets = kind === "stimStep" ? [`${from[0]}${Number(from[1]) + (side === "w" ? 1 : -1)}`]
            : kind === "deploy" ? ["a2", "b1", "b2"]
            : kind === "tacticalJump" ? squares.filter((to) => !knowledge.knownPieces.has(to))
            : kind === "charonMissiles" ? squares.filter((to) => to !== from &&
              Math.abs(to.charCodeAt(0) - from.charCodeAt(0)) === Math.abs(Number(to[1]) - Number(from[1])))
            : [undefined];
          expect(timed.map((a) => a.to)).toEqual(kind === "deploy" ? targets.flatMap((to) => units.map(() => to)) : targets);
          if (kind === "deploy") expect(timed.map((a) => a.kind === "deploy" ? a.unit : undefined)).toEqual(targets.flatMap(() => units));
          for (const a of timed) {
            expect(Object.keys(a).sort()).toEqual(["kind", "timing", "color", "from", ...(a.to ? ["to"] : []), ...(a.kind === "deploy" ? ["unit"] : [])].sort());
          }
        }
      }
      expect(family.some((a) => failure(a) === null)).toBe(true);
    }
  });

  it("filters known occupied jumps and retains unknown targets", () => {
    const { domain } = setup(observation([["h1", "k"], ["a1", "q"]], { unknown: ["e5"], enemy: [["f5", "p"]] }));
    expect(domain("tacticalJump").some((a) => a.to === "e5")).toBe(true);
    expect(domain("tacticalJump").some((a) => ["a1", "h1", "f5"].includes(a.to!))).toBe(false);
  });

  it("allows nonCC crushes, excludes both CCs, and moves only the F deployment anchor", () => {
    const o = observation([["e1", "k"], ["d2", "n"]], { enemy: [["f2", "k"]] });
    const root = setup(o);
    expect(root.domain("deploy").filter((a) => a.to === "d2")).toHaveLength(10);
    expect(root.domain("deploy").some((a) => a.to === "f2" || a.to === "e1")).toBe(false);
    const after = setup(o, [c("e1", "e2")]);
    expect(after.domain("deploy").some((a) => a.timing === "F" && a.to === "e1")).toBe(true);
    expect(after.domain("deploy").some((a) => a.timing === "F" && a.to === "d3")).toBe(true);
    expect(after.domain("deploy").some((a) => a.timing === "B" && a.to === "d3")).toBe(false);
  });

  it("keeps every Charon diagonal without ship or path filters and stores append-time anchors", () => {
    const o = observation([["a1", "k"], ["c1", "b"]], { enemy: [["d2", "p"]], unknown: ["f4"] });
    const { domain, state } = setup(o, [c("c1", "e3"), s("charonMissiles", "c1", "f4", "F")]);
    expect(state.anchors).toEqual(["c1", "e3"]);
    expect(domain("charonMissiles").some((a) => a.timing === "F" && a.to === "f4")).toBe(true);
    expect(setup(o).domain("charonMissiles").some((a) => a.to === "h6")).toBe(true);
    const beforeC = setup(o, [s("charonMissiles", "c1", "d2", "F"), c("c1", "e3")]);
    expect(beforeC.state.anchors).toEqual(["c1", "c1"]);
  });

  it("authorizes classical B births and arrivals but never new specials", () => {
    const o = observation([["e1", "k"], ["a2", "p"], ["h1", "q"]]);
    for (const birth of [
      { ...s("deploy", "e1", "d2"), unit: "n" as const }, s("stimStep", "a2", "a3"), s("tacticalJump", "h1", "h5"),
    ]) {
      const { domain, failure } = setup(o, [birth]);
      expect(domain("classical").some((a) => a.from === birth.to)).toBe(true);
      expect(domain().some((a) => a.timing !== "C" && a.from === birth.to)).toBe(false);
      expect(failure(s("spiderMine", birth.to!))).toBe("actor");
    }
    expect(setup(o, [{ ...s("deploy", "e1", "d2", "F"), unit: "n" }]).domain("classical").some((a) => a.from === "d2")).toBe(false);
    expect(setup(observation([["e1", "k"], ["a7", "p"]]), [{ ...c("a7", "a8"), promotion: "r" }]).failure(s("siegeMode", "a7", undefined, "F"))).toBe("actor");
  });
});

describe("V3 promotion closure", () => {
  it.each(["w", "b"] as const)("emits exactly four native authored-last choices for C and B/F stim, %s", (side) => {
    const from: Square = side === "w" ? "e7" : "e2";
    const to: Square = side === "w" ? "e8" : "e1";
    const { domain, failure } = setup(observation([["a4", "k"], [from, "p"]], { side }));
    const actions = domain().filter((a) => a.from === from && a.to === to);
    for (const timing of ["C", "B", "F"]) {
      const timed = actions.filter((a) => a.timing === timing);
      expect(timed.map((a) => a.promotion)).toEqual(units.slice(1));
      for (const a of timed) expect(failure(a)).toBeNull();
    }
  });

  it.each(["w", "b"] as const)("uses structural earlier-B promotion and leaves authored coordinates intact, %s", (side) => {
    const from: Square = side === "w" ? "e6" : "e3";
    const to: Square = side === "w" ? "e7" : "e2";
    for (const occupied of [false, true]) {
      const o = observation([["a4", "k"], [from, "p"]], { side, ...(occupied ? { enemy: [[to, "p"] as [Square, "p"]] } : { unknown: [to] }) });
      const root = setup(o);
      const before = root.domain("classical").filter((a) => a.from === from && a.to === to);
      expect(before).toEqual([c(from, to, side)]);
      const after = setup(o, [s("stimStep", from, to, "B", side)]);
      const promoted = after.domain("classical").filter((a) => a.from === from && a.to === to);
      expect(promoted.map((a) => a.promotion)).toEqual(units.slice(1));
      expect(promoted.map(({ from: f, to: t }) => [f, t])).toEqual(units.slice(1).map(() => [from, to]));
      expect(after.domain("classical").filter((a) => a.from === from && a.to === (side === "w" ? "d7" : "d2")).map((a) => a.promotion)).toEqual([undefined]);
      const later = appendState(root.knowledge, appendState(root.knowledge, emptyPrefix(), before[0]!), s("stimStep", from, to, "B", side));
      expect(later.actions[0]).toEqual(c(from, to, side));
      expect(setup(o, [s("stimStep", from, to, "F", side)]).domain("classical").filter((a) => a.from === from && a.to === to)).toEqual(before);
    }
  });

  it("keeps native rewrite matching, start-rank double, off-board, and first-match rules", () => {
    const double = setup(observation([["h8", "k"], ["e2", "p"]]), [s("stimStep", "e2", "e3")]);
    expect(double.domain("classical").find((a) => a.from === "e2" && a.to === "e4")?.promotion).toBeUndefined();
    const offboard = setup(observation([["a1", "k"], ["e7", "p"]]), [s("stimStep", "e7", "e8")]);
    expect(offboard.domain("classical").filter((a) => a.from === "e7" && a.to === "e8").map((a) => a.promotion)).toEqual(units.slice(1));
    const jump = setup(observation([["a1", "k"], ["e6", "p"]]), [s("tacticalJump", "e6", "e7")]);
    expect(jump.domain("classical").filter((a) => a.from === "e6" && a.to === "e7").map((a) => a.promotion)).toEqual(units.slice(1));
    expect(jump.domain("classical").find((a) => a.from === "e6" && a.to === "f7")?.promotion).toBeUndefined();
    const first = setup(observation([["a1", "k"], ["e6", "p"]]), [s("tacticalJump", "e6", "d4"), s("stimStep", "e6", "e7")]);
    expect(first.domain("classical").find((a) => a.from === "e6" && a.to === "e7")?.promotion).toBeUndefined();
    expect(setup(observation([["a1", "k"], ["e8", "p"]])).domain("stimStep")).toEqual([]);
  });
});

describe("prefix guards and reservations", () => {
  it.each(["w", "b"] as const)("keeps native B vacancy/transit/exact pairs and stim occupancy exceptions, %s", (side) => {
    const rank = side === "w" ? ["2", "3", "4"] : ["7", "6", "5"];
    const [from, to, head] = rank.map((r) => `e${r}` as Square) as [Square, Square, Square];
    const cc = `d${rank[1]}` as Square;
    const o = observation([[cc, "k"], [from, "p"], [to, "p"]], { side });
    const root = setup(o);
    expect(root.failure(s("stimStep", from, to, "B", side))).toBe("ownOccupancy");
    const b = setup(o, [s("stimStep", to, head, "B", side)]);
    expect(b.failure(s("stimStep", from, to, "B", side))).toBeNull();
    expect(setup(o, [s("stimStep", to, head, "F", side)]).failure(s("stimStep", from, to, "B", side))).toBe("ownOccupancy");
    const chain = setup(o, [s("stimStep", to, head, "B", side), s("stimStep", from, to, "B", side)]);
    expect(chain.failure(c(from, to, side))).toBeNull();
    const transit = setup(o, [s("stimStep", from, to, "B", side)]);
    expect(transit.failure(c(cc, from, side))).toBeNull();
    expect(transit.failure(c(cc, to, side))).toBe("ownOccupancy");
    expect(setup(o, [c(from, to, side)]).failure(s("stimStep", from, to, "F", side))).toBeNull();
    expect(setup(o, [c(from, head, side)]).failure(s("stimStep", from, to, "F", side))).toBe("ownOccupancy");
  });

  it.each(["w", "b"] as const)("rejects F stim approaching last rank only when C is earlier, %s", (side) => {
    const from: Square = side === "w" ? "e6" : "e3";
    const to: Square = side === "w" ? "e7" : "e2";
    const o = observation([["a4", "k"], [from, "p"]], { side });
    const action = s("stimStep", from, to, "F", side);
    expect(setup(o, [c(from, to, side)]).failure(action)).toBe("timing");
    const root = setup(o);
    expect(root.failure(action)).toBeNull();
    const earlier = appendState(root.knowledge, emptyPrefix(), action);
    expect(root.failure(c(from, to, side), earlier)).toBeNull();
  });

  it("uses effective B siege and does not infer movement of own mines", () => {
    const o = observation([["h8", "k"], ["a1", "r"]], { siege: ["a1"], mines: ["a4"] });
    expect(setup(o).failure(c("a1", "a4"))).toBe("ownOccupancy");
    expect(setup(o, [s("siegeMode", "a1")]).failure(c("a1", "a4"))).toBeNull();
    expect(setup(o, [s("siegeMode", "a1", undefined, "F")]).failure(c("a1", "a4"))).toBe("ownOccupancy");
    expect(setup({ ...o, own: { ...o.own, siegedTanks: [] } }, [s("siegeMode", "a1")]).failure(c("a1", "a4"))).toBe("ownOccupancy");
  });

  it.each([0, 1, 2, 3])("reserves current %i mines plus earlier valid drops without refunds", (current) => {
    const o = observation([["h8", "k"], ["a1", "n"], ["b1", "n"], ["c1", "n"]], { mines: ["f1", "f2", "f3"].slice(0, current) as Square[] });
    const { knowledge } = setup(o);
    let state = emptyPrefix();
    for (let i = 0; i < 3; i++) {
      const action = s("spiderMine", ["a1", "b1", "c1"][i] as Square);
      const failure = appendFailure(o, knowledge, state, action);
      expect(failure).toBe(current + i >= 3 ? "mineCap" : null);
      if (!failure) state = appendState(knowledge, state, action);
    }
    expect(state.mineAnchors.length).toBe(3 - current);
  });

  it.each(["w", "b"] as const)("stores F mine anchors, rejects prior/current collisions, and never retroactively moves them, %s", (side) => {
    const o = observation([["h8", "k"], ["a1", "n"], ["c2", "n"]], { side, mines: ["a1"] });
    const relocated = setup(o, [c("a1", "c2", side)]);
    expect(relocated.failure(s("spiderMine", "a1", undefined, "F", side))).toBeNull();
    expect(setup(o, [c("c2", "a3", side)]).failure(s("spiderMine", "a1", undefined, "F", side))).toBe("ownOccupancy");
    const clash = setup(o, [s("spiderMine", "c2", undefined, "B", side), c("a1", "c2", side)]);
    expect(clash.state.mineAnchors).toEqual(["c2"]);
    expect(clash.failure(s("spiderMine", "a1", undefined, "F", side))).toBe("ownOccupancy");
    const clear = { ...o, own: { ...o.own, mines: [] } };
    const late = setup(clear, [s("spiderMine", "a1", undefined, "F", side), c("a1", "c2", side)]);
    expect(late.state.mineAnchors).toEqual(["a1"]);
    expect(late.failure(s("spiderMine", "c2", undefined, "B", side))).toBeNull();
    const cap = setup({ ...o, own: { ...o.own, mines: ["a1", "f1", "f2"] } });
    expect(cap.failure(s("spiderMine", "a1", undefined, "F", side))).toBe("mineCap");
  });

  it("keeps actor, shape, timing, resources, cap, occupancy priority", () => {
    const o = observation([["h8", "k"], ["a1", "n"], ["b1", "n"], ["c1", "r"]], { gas: 0, mines: ["a1", "f1", "f2"] });
    const root = setup(o);
    expect(root.failure(s("spiderMine", "c1", "off" as Square))).toBe("actor");
    expect(root.failure(s("spiderMine", "a1", "a1"))).toBe("shape");
    expect(setup(o, [s("spiderMine", "a1")]).failure(s("spiderMine", "a1"))).toBe("timing");
    expect(root.failure(s("spiderMine", "a1"))).toBe("resources");
    expect(setup({ ...o, own: { ...o.own, gas: 3 } }).failure(s("spiderMine", "a1"))).toBe("mineCap");
    expect(setup({ ...o, own: { ...o.own, gas: 3, mines: ["a1"] } }).failure(s("spiderMine", "a1"))).toBe("ownOccupancy");
    expect(setup(observation([["a1", "k"]], { minerals: 0 })).failure({ ...s("deploy", "a1", "a2"), unit: "p" })).toBe("resources");
  });

  it("checks cumulative mineral and gas funding at exact bank edges", () => {
    const o = observation([["a1", "k"], ["e2", "p"], ["d1", "r"]], { gas: 2, minerals: 1 });
    const deploy = { ...s("deploy", "a1", "b2"), unit: "p" as const };
    const root = setup(o);
    expect(root.failure(deploy)).toBeNull();
    expect(root.failure({ ...deploy, unit: "n" })).toBe("resources");
    const paid = setup(o, [deploy, s("stimStep", "e2", "e3")]);
    expect(paid.failure(s("siegeMode", "d1"))).toBe("resources");
    expect(paid.failure(c("a1", "a2"))).toBeNull();
  });

  it("keeps independent branch mine reservations and parent actions detached", () => {
    const { knowledge } = setup(observation([["a1", "k"], ["b1", "n"], ["g1", "n"]]));
    const root = emptyPrefix();
    const left = appendState(knowledge, root, s("spiderMine", "b1"));
    const right = appendState(knowledge, root, s("spiderMine", "g1"));
    const continued = appendState(knowledge, left, c("b1", "c3"));
    expect(root).toEqual({ actions: [], anchors: [], mineAnchors: [] });
    expect(left.mineAnchors).toEqual(["b1"]);
    expect(right.mineAnchors).toEqual(["g1"]);
    expect(continued.mineAnchors).toEqual(["b1"]);
    expect(left.actions).toHaveLength(1);
    expect(right.actions).toHaveLength(1);
    expect(continued.actions).toHaveLength(2);
  });
});
