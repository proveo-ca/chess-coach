import { describe, expect, it } from "vitest";
import type { ScActionInput, Square } from "@chess-coach/starchess-core";
import { candidateInput } from "../candidates/input";
import { appendFailure, appendPrefix, emptyPrefix, type OwnPrefix } from "../candidates/ownPrefix";
import { c, fixture, s } from "./candidateFixtures";

const prefix = (actions: readonly ScActionInput[]): OwnPrefix => actions.reduce(appendPrefix, emptyPrefix());

describe("prefix-only authorized guards", () => {
  it("prioritizes actor, shape and timing ahead of depleted resources", () => {
    const input = candidateInput(fixture([["a1", "k"], ["e2", "p"]], { gas: 0, minerals: 0 }));
    expect(appendFailure(input, emptyPrefix(), s("spiderMine", "e2"))).toBe("actor");
    expect(appendFailure(input, emptyPrefix(), s("stimStep", "e2", "e4"))).toBe("shape");
    expect(appendFailure(input, prefix([s("stimStep", "e2", "e3")]), s("stimStep", "e2", "e3", "F"))).toBe("timing");
  });
  it("prioritizes resources ahead of mine cap and occupied anchors", () => {
    const input = candidateInput(fixture([["a1", "k"], ["b1", "n"]], { gas: 0, mines: ["b1", "c1", "d1"] }));
    expect(appendFailure(input, emptyPrefix(), s("spiderMine", "b1"))).toBe("resources");
    const funded = candidateInput(fixture([["a1", "k"], ["b1", "n"]], { mines: ["b1", "c1", "d1"] }));
    expect(appendFailure(funded, emptyPrefix(), s("spiderMine", "b1"))).toBe("mineCap");
    const occupied = candidateInput(fixture([["a1", "k"], ["b1", "n"]], { mines: ["b1"] }));
    expect(appendFailure(occupied, emptyPrefix(), s("spiderMine", "b1"))).toBe("ownOccupancy");
  });
  it("checks cumulative native mineral and gas costs at exact bank edges", () => {
    const input = candidateInput(fixture([["a1", "k"], ["e2", "p"], ["d1", "r"]], { gas: 2, minerals: 1 }));
    const deploy = { ...s("deploy", "a1", "b2"), unit: "p" as const };
    expect(appendFailure(input, emptyPrefix(), deploy)).toBeNull();
    expect(appendFailure(input, emptyPrefix(), { ...deploy, unit: "n" })).toBe("resources");
    const paid = prefix([deploy, s("stimStep", "e2", "e3")]);
    expect(paid).toMatchObject({ minerals: 1, gas: 2 });
    expect(appendFailure(input, paid, s("siegeMode", "d1"))).toBe("resources");
    expect(appendFailure(input, paid, c("a1", "a2"))).toBeNull();
  });
  it.each([0, 1, 2, 3])("reserves prior distinct-bike mine drops with %i existing mines", (count) => {
    const existing = (["e1", "f1", "g1"] as Square[]).slice(0, count);
    const input = candidateInput(fixture([["a1", "k"], ["b1", "n"], ["c1", "n"], ["d1", "n"]], { mines: existing }));
    let state = emptyPrefix();
    for (const [index, from] of (["b1", "c1", "d1"] as const).entries()) {
      const action = s("spiderMine", from);
      if (index + count >= 3) expect(appendFailure(input, state, action)).toBe("mineCap");
      else {
        expect(appendFailure(input, state, action)).toBeNull();
        state = appendPrefix(state, action);
      }
    }
    expect(state.reservations).toHaveLength(3 - count);
  });
  it("holds append-time F reservations stable when a later C arrives", () => {
    const input = candidateInput(fixture([["a1", "k"], ["b1", "n"], ["c3", "n"]]));
    const drop = s("spiderMine", "b1", undefined, "F");
    const before = prefix([drop]);
    const after = appendPrefix(before, c("b1", "c3"));
    expect(after.reservations).toEqual([{ queueIndex: 0, anchor: "b1" }]);
    expect(before.reservations).toEqual([{ queueIndex: 0, anchor: "b1" }]);
    const anchored = prefix([c("b1", "c3"), drop]);
    expect(anchored.reservations).toEqual([{ queueIndex: 1, anchor: "c3" }]);
    expect(appendFailure(input, anchored, s("spiderMine", "c3"))).toBe("ownOccupancy");
    expect(appendFailure(input, after, s("spiderMine", "c3"))).toBeNull();
  });
  it("never borrows another actor C anchor or refunds an existing mine", () => {
    const input = candidateInput(fixture([["a1", "k"], ["b1", "n"], ["g1", "n"]], { mines: ["a3", "d1", "e1"] }));
    const moved = prefix([c("g1", "f3")]);
    expect(appendFailure(input, moved, s("spiderMine", "b1", undefined, "F"))).toBe("mineCap");
    expect(prefix([c("g1", "f3"), s("spiderMine", "b1", undefined, "F")]).reservations[0]?.anchor).toBe("b1");
  });
  it("keeps independent branch reservations detached", () => {
    const root = emptyPrefix();
    const left = appendPrefix(root, s("spiderMine", "b1"));
    const right = appendPrefix(root, s("spiderMine", "g1"));
    expect(root.reservations).toEqual([]);
    expect(left.reservations).toEqual([{ queueIndex: 0, anchor: "b1" }]);
    expect(right.reservations).toEqual([{ queueIndex: 0, anchor: "g1" }]);
  });
  it("preserves native stim chain-head and exact F authored-target exceptions", () => {
    const input = candidateInput(fixture([["a1", "k"], ["e2", "p"], ["e3", "p"]]));
    const action = s("stimStep", "e2", "e3");
    expect(appendFailure(input, emptyPrefix(), action)).toBe("ownOccupancy");
    expect(appendFailure(input, prefix([s("stimStep", "e3", "e4")]), action)).toBeNull();
    expect(appendFailure(input, prefix([s("stimStep", "e3", "e4", "F")]), action)).toBe("ownOccupancy");
    expect(appendFailure(input, prefix([c("e2", "e3")]), { ...action, timing: "F" })).toBeNull();
    expect(appendFailure(input, prefix([c("e2", "e4")]), { ...action, timing: "F" })).toBe("ownOccupancy");
  });
  it.each(["w", "b"] as const)("does not retrovalidate earlier F stim against later C for %s", (side) => {
    const from: Square = side === "w" ? "e6" : "e3";
    const to: Square = side === "w" ? "e7" : "e2";
    const input = candidateInput(fixture([["a4", "k"], [from, "p"]], { side }));
    const classical = c(from, to, side);
    const stim = s("stimStep", from, to, "F", side);
    expect(appendFailure(input, emptyPrefix(), stim)).toBeNull();
    expect(appendFailure(input, prefix([classical]), stim)).toBe("timing");
    expect(appendFailure(input, prefix([stim]), classical)).toBeNull();
  });
  it("tracks native B vacancy, exact transit pairs and effective siege own mines", () => {
    const input = candidateInput(fixture([["a1", "k"], ["e2", "p"], ["d3", "r"]], { mines: ["d5"], siegedTanks: ["d3"] }));
    const moved = prefix([s("stimStep", "e2", "e3")]);
    expect(appendFailure(input, moved, c("d3", "e3"))).toBe("ownOccupancy");
    expect(appendFailure(input, moved, c("e2", "e3"))).toBeNull();
    expect(appendFailure(input, emptyPrefix(), c("d3", "d5"))).toBe("ownOccupancy");
    expect(appendFailure(input, prefix([s("siegeMode", "d3")]), c("d3", "d5"))).toBeNull();
  });
  it("aborts malformed action/side input instead of charging normal prune counters", () => {
    const input = candidateInput(fixture());
    for (const action of [c("a1", "b2", "b"), { ...c("a1", "b2"), extra: 1 }, { ...c("a1", "b2"), to: "z9" }]) {
      expect(() => appendFailure(input, emptyPrefix(), action as ScActionInput)).toThrowError(expect.objectContaining({ name: "ContractError" }));
    }
  });
});
