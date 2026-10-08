// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { describe, expect, it } from "vitest";
import {
  countedPlanningKnowledge, knownAppendFailure,
  type CountedPlanningKnowledge, type PlanningKnowledge, type ScPiece, type Square,
} from "../planning-v1";

const setup = (mines: Square[] = ["b5"]): PlanningKnowledge => ({
  side: "w",
  knownPieces: new Map<Square, ScPiece>([
    ["e1", { type: "k", color: "w" }], ["a3", { type: "n", color: "w" }],
    ["c4", { type: "r", color: "w" }], ["h8", { type: "k", color: "b" }],
  ]),
  unknownSquares: new Set<Square>(["g7"]),
  ownMines: new Set(mines),
  ownSiegedTanks: new Set<Square>(["c4"]),
});
const construct = (knowledge: unknown, squares: unknown) =>
  countedPlanningKnowledge(knowledge as PlanningKnowledge, squares as readonly Square[]);

describe("counted planning constructor", () => {
  it.each([0, 1, 2, 3])("derives %i entities from a dense inventory without deduplicating", count => {
    const mines = Array.from({ length: count }, () => "b5" as const);
    const knowledge = setup(count ? ["b5"] : []);
    const counted: CountedPlanningKnowledge = countedPlanningKnowledge(knowledge, mines);
    expect(Object.keys(counted)).toEqual(["side", "knownPieces", "unknownSquares", "ownMines", "ownSiegedTanks", "ownMineCount"]);
    expect(counted.ownMineCount).toBe(count);
    expect([...counted.ownMines]).toEqual(count ? ["b5"] : []);
    expect(Object.isFrozen(counted)).toBe(true);
    expect(Reflect.set(counted, "ownMineCount", 0)).toBe(false);
  });

  it("detaches every map, set, inventory and piece value", () => {
    const knowledge = setup();
    const inventory: Square[] = ["b5", "b5"];
    const original = knowledge.knownPieces.get("a3")!;
    const counted = countedPlanningKnowledge(knowledge, inventory);
    const detached = counted.knownPieces.get("a3")!;
    expect(detached).not.toBe(original);
    expect(Object.isFrozen(detached)).toBe(true);
    expect(Object.isFrozen(original)).toBe(false);
    expect(Reflect.set(detached, "type", "q")).toBe(false);
    expect(original.type).toBe("n");
    original.type = "q";
    (knowledge.knownPieces as Map<Square, ScPiece>).clear();
    for (const set of [knowledge.unknownSquares, knowledge.ownMines, knowledge.ownSiegedTanks]) (set as Set<Square>).clear();
    inventory.length = 0;
    expect([...counted.knownPieces.keys()]).toEqual(["e1", "a3", "c4", "h8"]);
    expect(detached.type).toBe("n");
    expect([...counted.unknownSquares]).toEqual(["g7"]);
    expect([...counted.ownMines]).toEqual(["b5"]);
    expect([...counted.ownSiegedTanks]).toEqual(["c4"]);
    expect(counted.ownMineCount).toBe(2);
  });

  it("blocks prototype mutators and callback/iterator mutation escapes", () => {
    const knowledge = setup();
    const counted = countedPlanningKnowledge(knowledge, ["b5"]);
    expect(() => Map.prototype.set.call(counted.knownPieces, "a1", { type: "q", color: "w" })).toThrow(TypeError);
    expect(() => Map.prototype.delete.call(counted.knownPieces, "a3")).toThrow(TypeError);
    expect(() => Map.prototype.clear.call(counted.knownPieces)).toThrow(TypeError);
    counted.knownPieces.forEach((value, key, map) => {
      expect(map).toBe(counted.knownPieces);
      expect(Reflect.set(value, "type", "q")).toBe(false);
      expect(map.get(key)).toBe(value);
      expect(Reflect.set(map, "size", 0)).toBe(false);
    });
    for (const entry of counted.knownPieces.entries()) entry[1] = { type: "q", color: "b" };
    expect(counted.knownPieces.get("a3")).toEqual({ type: "n", color: "w" });
    for (const set of [counted.unknownSquares, counted.ownMines, counted.ownSiegedTanks]) {
      expect(Object.isFrozen(set)).toBe(true);
      expect(() => Set.prototype.add.call(set, "a1")).toThrow(TypeError);
      expect(() => Set.prototype.delete.call(set, [...set][0])).toThrow(TypeError);
      expect(() => Set.prototype.clear.call(set)).toThrow(TypeError);
      set.forEach((value, key, view) => {
        expect(view).toBe(set);
        expect(key).toBe(value);
        expect(Reflect.set(view, "add", () => view)).toBe(false);
      });
    }
    expect(knowledge.knownPieces.size).toBe(4);
    expect([...knowledge.ownMines]).toEqual(["b5"]);
  });

  it("preserves legacy knownAppendFailure location-based behavior", () => {
    const counted = countedPlanningKnowledge(setup(), ["b5", "b5", "b5"]);
    const mine = { kind: "spiderMine", timing: "B", from: "a3", color: "w" } as const;
    expect(knownAppendFailure(counted, [], mine)).toBeNull();
    expect(knownAppendFailure(setup(["b5", "b6", "b7"]), [], mine)).toBe("mineCap");
  });

  it("rejects mismatched location sets, invalid domains, extras and count overrides", () => {
    for (const squares of [[], ["b6"], ["b5", "b6"], ["b5", "b5", "b5", "b5"], ["z9"], null, "b5"]) {
      expect(() => construct(setup(), squares)).toThrow(TypeError);
    }
    for (const knowledge of [
      { ...setup(), ownMineCount: 3 }, { ...setup(), count: 3 }, { ...setup(), side: "x" },
      { ...setup(), [Symbol("extra")]: 1 }, { ...setup(), unknownSquares: new Set(["z9"]) },
      { ...setup(), ownMines: new Set(["z9"]) }, { ...setup(), ownSiegedTanks: new Set(["z9"]) },
      { ...setup(), knownPieces: new Map([["z9", { type: "p", color: "w" }]]) },
      { ...setup(), knownPieces: new Map([["a1", { type: "x", color: "w" }]]) },
      { ...setup(), knownPieces: new Map([["a1", { type: "p", color: "x" }]]) },
      { ...setup(), knownPieces: new Map([["a1", { type: "p", color: "w", extra: 1 }]]) },
      Object.create(setup()),
    ]) expect(() => construct(knowledge, ["b5"])).toThrow(TypeError);
  });

  it("rejects inherited fields, sparse arrays and accessors before reading them", () => {
    let reads = 0;
    const getter = () => { reads++; throw new Error("getter executed"); };
    for (const field of ["side", "knownPieces", "unknownSquares", "ownMines", "ownSiegedTanks"]) {
      const knowledge = setup();
      Object.defineProperty(knowledge, field, { enumerable: true, get: getter });
      expect(() => construct(knowledge, ["b5"])).toThrow(TypeError);
    }
    const knowledge = setup();
    Object.defineProperty(knowledge.knownPieces.get("a3")!, "type", { enumerable: true, get: getter });
    expect(() => construct(knowledge, ["b5"])).toThrow(TypeError);
    for (const method of ["entries", "size", Symbol.iterator]) {
      const knowledge = setup();
      Object.defineProperty(knowledge.knownPieces, method, { get: getter });
      expect(() => construct(knowledge, ["b5"])).toThrow(TypeError);
    }
    const inventory: Square[] = ["b5"];
    Object.defineProperty(inventory, "0", { enumerable: true, get: getter });
    expect(() => construct(setup(), inventory)).toThrow(TypeError);
    const sparse: Square[] = ["b5", "b5"];
    delete sparse[0];
    expect(() => construct(setup(), sparse)).toThrow(TypeError);
    const extra = Object.assign(["b5"], { ownMineCount: 1 });
    expect(() => construct(setup(), extra)).toThrow(TypeError);
    expect(reads).toBe(0);
  });
});
