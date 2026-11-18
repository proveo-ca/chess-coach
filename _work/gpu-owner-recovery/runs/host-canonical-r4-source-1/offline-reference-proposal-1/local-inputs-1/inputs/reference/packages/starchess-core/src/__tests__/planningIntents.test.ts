// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { describe, expect, it } from "vitest";
import {
  AddScActionError,
  addScAction,
  appendTimeSpecialAnchor,
  assertSpecialLegal,
  charonDiagonalSquares,
  charonDiagonalSquaresFromSquare,
  classicalActorAt,
  classifyClassicalVacancy,
  endScTurn,
  gasPairKey,
  isTankSiegedAfterB,
  knownAppendFailure,
  mapToPlacement,
  parseQueueField,
  placementToMap,
  spawnCCAnchor,
  spawnCCAnchorFromMap,
  type PieceColor,
  type PlanningKnowledge,
  type ScActionInput,
  type ScFenSnapshot,
  type ScPiece,
  type Square,
} from "../index";

const piece = (type: ScPiece["type"], color: PieceColor = "w"): ScPiece => ({ type, color });
const knowledge = (entries: readonly (readonly [Square, ScPiece])[],
  overrides: Partial<PlanningKnowledge> = {}): PlanningKnowledge => ({
  side: "w",
  knownPieces: new Map(entries),
  unknownSquares: new Set(),
  ownMines: new Set(),
  ownSiegedTanks: new Set(),
  ...overrides,
});
const classical = (from: Square, to: Square, color: PieceColor = "w"):
  Extract<ScActionInput, { timing: "C" }> => ({ timing: "C", kind: "classical", color, from, to });
const special = (kind: Extract<ScActionInput, { timing: "B" | "F" }>["kind"],
  from: Square, to?: Square, timing: "B" | "F" = "B", color: PieceColor = "w"):
  Extract<ScActionInput, { timing: "B" | "F" }> =>
  ({ timing, kind, color, from, ...(to ? { to } : {}) });
const snapshot = (known: PlanningKnowledge, prefix: readonly ScActionInput[] = []): ScFenSnapshot => ({
  placement: mapToPlacement(new Map(known.knownPieces)),
  turn: 21,
  phase: "P",
  ccLives: { w: 3, b: 3 },
  gas: { w: 3, b: 3 },
  gasIncome: { w: 3, b: 3 },
  queue: { actions: prefix.map((a, seq) => ({ ...a, seq })) },
  mines: [...known.ownMines].map((at) => ({ at, color: known.side })),
  siegedTanks: [...known.ownSiegedTanks],
});

describe("classicalActorAt", () => {
  it("prefers the current own actor over an arriving deployment", () => {
    const actor = piece("r");
    const map = new Map<Square, ScPiece>([["d3", actor]]);
    expect(classicalActorAt(map, [{ ...special("deploy", "e2", "d3"), unit: "p" }], "w", "d3"))
      .toBe(actor);
  });

  it("uses only the first preceding B arrival and preserves its native actor type", () => {
    const map = new Map<Square, ScPiece>([["d2", piece("p")], ["d3", piece("q", "b")]]);
    const step = special("stimStep", "d2", "d3");
    expect(classicalActorAt(map, [step, { ...special("deploy", "e2", "d3"), unit: "r" }], "w", "d3"))
      .toEqual(piece("p"));
    expect(classicalActorAt(map, [special("stimStep", "c2", "d3"), step], "w", "d3"))
      .toBeUndefined();
    expect(classicalActorAt(map, [{ ...special("deploy", "e2", "c3"), unit: "n" }], "w", "c3"))
      .toEqual(piece("n"));
  });

  it("accepts authored origins and jump arrivals without granting F births", () => {
    const map = new Map<Square, ScPiece>([["d1", piece("q")]]);
    const jump = special("tacticalJump", "d1", "h5");
    expect(classicalActorAt(map, [jump], "w", "d1")).toEqual(piece("q"));
    expect(classicalActorAt(map, [jump], "w", "h5")).toEqual(piece("q"));
    expect(classicalActorAt(map, [special("tacticalJump", "d1", "h5", "F")], "w", "h5"))
      .toBeUndefined();
    expect(classicalActorAt(map, [special("tacticalJump", "d1", "h5", "B", "b")], "w", "h5"))
      .toBeUndefined();
  });
});

describe("map anchors and geometry", () => {
  it("projects F spawn occupancy and carries all Command Center blockers", () => {
    const known = knowledge([["e1", piece("k")], ["f3", piece("k", "b")],
      ["d2", piece("n")], ["a2", piece("p")], ["h1", piece("q")]]);
    const prefix = [special("stimStep", "a2", "a3"), special("tacticalJump", "h1", "h5"),
      { ...special("deploy", "e1", "f1"), unit: "p" as const },
      classical("d2", "c4"), classical("e1", "e2"), classical("f3", "g4", "b")];
    const before = spawnCCAnchorFromMap(known.knownPieces, "w", "B", prefix);
    const after = spawnCCAnchorFromMap(known.knownPieces, "w", "F", prefix);
    expect(before.commandCenter).toBe("e1");
    expect(after.commandCenter).toBe("e2");
    expect([...after.allyOccupied].sort()).toEqual(["e2", "f3"]);
    expect([...after.occupied].sort()).toEqual(["a3", "c4", "e2", "f1", "f3", "h5"]);
    expect(after).toEqual(spawnCCAnchor(snapshot(known, prefix), "w", "F"));
    expect(known.knownPieces.has("d2")).toBe(true);
  });

  it("returns occupancy when the side has no known Command Center", () => {
    const result = spawnCCAnchorFromMap(new Map([["e8", piece("k", "b")]]), "w", "F", []);
    expect(result.commandCenter).toBeNull();
    expect([...result.allyOccupied]).toEqual(["e8"]);
  });

  it("uses the first same-actor C only for the F anchor", () => {
    const prefix = [classical("a1", "b3"), classical("c1", "d2", "b"),
      classical("c1", "e3"), classical("c1", "g5")];
    expect(appendTimeSpecialAnchor(prefix, "w", "c1", "F")).toBe("e3");
    expect(appendTimeSpecialAnchor(prefix, "w", "c1", "B")).toBe("c1");
    expect(appendTimeSpecialAnchor(prefix, "w", "h1", "F")).toBe("h1");
  });

  it("exposes geometry without granting the map wrapper an actor", () => {
    expect(charonDiagonalSquaresFromSquare("a1")).toEqual(["b2", "c3", "d4", "e5", "f6", "g7", "h8"]);
    expect(charonDiagonalSquares(new Map(), "a1")).toEqual([]);
    expect(charonDiagonalSquares(new Map([["a1", piece("n")]]), "a1")).toEqual([]);
    expect(charonDiagonalSquares(new Map([["a1", piece("b")]]), "a1"))
      .toEqual(charonDiagonalSquaresFromSquare("a1"));
  });
});

describe("knownAppendFailure", () => {
  it("rejects native nongeometry while preserving candidate shape refusal", () => {
    const known = knowledge([["a1", piece("k")], ["h8", piece("k", "b")], ["d2", piece("n")]]);
    const action = classical("d2", "d3");
    expect(knownAppendFailure(known, [], action)).toBe("shape");
    expect(() => addScAction({ snapshot: snapshot(known), action })).toThrow(AddScActionError);
  });

  it("keeps actor refusal ahead of shape and timing without granting special births", () => {
    const known = knowledge([["e1", piece("k")], ["e7", piece("p")]]);
    const birth = { ...special("deploy", "e1", "d2"), unit: "n" as const };
    expect(knownAppendFailure(known, [birth], special("spiderMine", "d2"))).toBe("actor");
    expect(knownAppendFailure(known, [classical("e7", "e8")], special("tacticalJump", "e7", "h5", "F")))
      .toBe("actor");
    expect(knownAppendFailure(known, [classical("e1", "e2")], classical("d4", "d4"))).toBe("actor");
  });

  it("checks strict emitted special fields while native V1 accepts optional mine fields", () => {
    const known = knowledge([["d2", piece("n")], ["a1", piece("r")]]);
    for (const action of [special("spiderMine", "d2", "d2"), special("siegeMode", "a1", "a1"),
      { ...special("spiderMine", "d2"), to: undefined },
      { ...special("spiderMine", "d2"), unit: undefined }]) {
      expect(knownAppendFailure(known, [], action)).toBe("shape");
    }
    expect(knownAppendFailure(known, [], special("spiderMine", "d2"))).toBeNull();
    expect(() => assertSpecialLegal(snapshot(known), { ...special("spiderMine", "d2", "d2"), seq: 0 }))
      .not.toThrow();
    expect(parseQueueField("Q:w:B=spiderMine:d2:d2;b:").actions[0]).toMatchObject({ to: "d2" });
  });

  it("checks shape before duplicate classical or special timing", () => {
    const known = knowledge([["d2", piece("n")], ["e2", piece("p")]]);
    expect(knownAppendFailure(known, [classical("d2", "c4")], classical("d2", "d3"))).toBe("shape");
    expect(knownAppendFailure(known, [classical("d2", "c4")], classical("d2", "f3"))).toBe("timing");
    expect(knownAppendFailure(known, [special("stimStep", "e2", "e3")], special("stimStep", "e2", "e4")))
      .toBe("shape");
    expect(knownAppendFailure(known, [special("stimStep", "e2", "e3")], special("stimStep", "e2", "e3", "F")))
      .toBe("timing");
  });

  it("allows B-vacated origins and exact pairs but rejects unrelated transit targets", () => {
    const known = knowledge([["e2", piece("p")], ["d3", piece("k")], ["e3", piece("p")]]);
    const prefix = [special("stimStep", "e2", "e3")];
    expect(knownAppendFailure(known, prefix, classical("d3", "e2"))).toBeNull();
    expect(knownAppendFailure(known, prefix, classical("d3", "e3"))).toBe("ownOccupancy");
    expect(knownAppendFailure(known, prefix, classical("e2", "e3"))).toBe("ownOccupancy");
    const chain = [...prefix, special("stimStep", "e3", "e4")];
    expect(knownAppendFailure(known, chain, classical("e2", "e3"))).toBeNull();
    const vacancy = classifyClassicalVacancy(chain, "w");
    expect(vacancy.gasPairs.has(gasPairKey("e2", "e3"))).toBe(true);
    expect(vacancy.transit.has("e3")).toBe(true);
  });

  it("ignores path blockers and unknown occupancy in classical shapes", () => {
    const known = knowledge([["a1", piece("r")], ["a2", piece("p")]],
      { unknownSquares: new Set(["a3", "a4"]) });
    expect(knownAppendFailure(known, [], classical("a1", "a4"))).toBeNull();
    expect(knownAppendFailure(known, [], classical("a1", "a2"))).toBe("ownOccupancy");
    expect(knownAppendFailure(knowledge([["e2", piece("p")]]), [], classical("e2", "f3"))).toBeNull();
  });

  it("uses current and B-effective siege mode with own mines on empty targets", () => {
    const known = knowledge([["a1", piece("r")]], { ownMines: new Set(["a4"]), ownSiegedTanks: new Set(["a1"]) });
    const action = classical("a1", "a4");
    expect(knownAppendFailure(known, [], action)).toBe("ownOccupancy");
    expect(knownAppendFailure(known, [special("siegeMode", "a1")], action)).toBeNull();
    expect(knownAppendFailure({ ...known, ownMines: new Set() }, [], action)).toBeNull();
    expect(knownAppendFailure({ ...known, ownSiegedTanks: new Set() }, [special("siegeMode", "a1")], action))
      .toBe("ownOccupancy");
    expect(isTankSiegedAfterB("a1", ["a1"], [special("siegeMode", "a1")])).toBe(false);
  });

  it("rejects known jump occupancy but allows unknown destinations", () => {
    const known = knowledge([["d1", piece("q")], ["h5", piece("p", "b")]], { unknownSquares: new Set(["g5"]) });
    expect(knownAppendFailure(known, [], special("tacticalJump", "d1", "h5"))).toBe("ownOccupancy");
    expect(knownAppendFailure(known, [], special("tacticalJump", "d1", "g5"))).toBeNull();
  });

  it("blocks both Command Centers but permits deploy crushes of other known pieces", () => {
    const known = knowledge([["e1", piece("k")], ["f2", piece("k", "b")], ["d2", piece("n")]]);
    expect(knownAppendFailure(known, [], { ...special("deploy", "e1", "f2"), unit: "p" })).toBe("ownOccupancy");
    expect(knownAppendFailure(known, [], { ...special("deploy", "e1", "d2"), unit: "p" })).toBeNull();
    expect(knownAppendFailure(known, [classical("e1", "e2")],
      { ...special("deploy", "e1", "e1", "F"), unit: "p" })).toBeNull();
  });

  it("preserves the B stim chain-head and F exact-authored-to occupied exceptions", () => {
    const known = knowledge([["e2", piece("p")], ["e3", piece("p")]]);
    expect(knownAppendFailure(known, [], special("stimStep", "e2", "e3"))).toBe("ownOccupancy");
    expect(knownAppendFailure(known, [special("stimStep", "e3", "e4")], special("stimStep", "e2", "e3")))
      .toBeNull();
    expect(knownAppendFailure(known, [special("stimStep", "e3", "e4", "F")], special("stimStep", "e2", "e3")))
      .toBe("ownOccupancy");
    expect(knownAppendFailure(known, [classical("e2", "e3")], special("stimStep", "e2", "e3", "F")))
      .toBeNull();
    expect(knownAppendFailure(known, [classical("e2", "e4")], special("stimStep", "e2", "e3", "F")))
      .toBe("ownOccupancy");
  });

  it.each(["w", "b"] as const)("requires authored promotion and rejects F last-rank continuation for %s", (side) => {
    const from: Square = side === "w" ? "e7" : "e2";
    const to: Square = side === "w" ? "e8" : "e1";
    const approach: Square = side === "w" ? "e6" : "e3";
    const known = knowledge([[from, piece("p", side)], [approach, piece("p", side)]], { side });
    expect(knownAppendFailure(known, [], special("stimStep", from, to, "B", side))).toBe("shape");
    expect(knownAppendFailure(known, [], { ...special("stimStep", from, to, "B", side), promotion: "n" }))
      .toBeNull();
    expect(knownAppendFailure(known, [], classical(from, to, side))).toBe("shape");
    expect(knownAppendFailure(known, [], { ...classical(from, to, side), promotion: "r" })).toBeNull();
    expect(knownAppendFailure(known, [classical(approach, from, side)], special("stimStep", approach, from, "F", side)))
      .toBe("timing");
  });

  it("allows a classical promotion choice carried for the B-rewritten landing", () => {
    const known = knowledge([["e6", piece("p")]]);
    expect(knownAppendFailure(known, [special("stimStep", "e6", "e7")],
      { ...classical("e6", "e7"), promotion: "r" })).toBeNull();
  });

  it("anchors F mine occupancy to its own C and counts only current mines for the cap", () => {
    const known = knowledge([["b1", piece("n")], ["g1", piece("n")]], { ownMines: new Set(["b1", "a3"]) });
    const prefix = [classical("b1", "c3"), special("spiderMine", "g1")];
    expect(knownAppendFailure(known, prefix, special("spiderMine", "b1", undefined, "F"))).toBeNull();
    expect(knownAppendFailure({ ...known, ownMines: new Set(["c3"]) }, prefix,
      special("spiderMine", "b1", undefined, "F"))).toBe("ownOccupancy");
    expect(knownAppendFailure(known, [classical("g1", "f3")], special("spiderMine", "b1", undefined, "F")))
      .toBe("ownOccupancy");
    expect(knownAppendFailure({ ...known, ownMines: new Set(["b1", "c3", "a3"]) }, prefix,
      special("spiderMine", "b1", undefined, "F"))).toBe("mineCap");
  });

  it("queues and resolves F mines at the moved actor while preserving the origin mine", () => {
    const known = knowledge([["a1", piece("k")], ["h8", piece("k", "b")], ["b1", piece("n")]],
      { ownMines: new Set(["b1"]) });
    const prefix = [classical("b1", "c3")];
    const action = special("spiderMine", "b1", undefined, "F");
    const queued = addScAction({ snapshot: snapshot(known, prefix), action }).snapshot;
    const result = endScTurn(queued, { skipTurnStartChecks: true });
    expect(result.next.mines).toEqual([{ at: "b1", color: "w" }, { at: "c3", color: "w" }]);
    expect(placementToMap(result.next.placement).get("c3")).toEqual(piece("n"));
    expect(result.events).toContainEqual(expect.objectContaining({ kind: "spiderMine", from: "c3", to: "c3" }));
    expect(() => addScAction({
      snapshot: snapshot({ ...known, ownMines: new Set(["c3"]) }, prefix), action,
    })).toThrow("mine already on square");
  });

  it("keeps a mine F anchor on its arming square when another actor moves", () => {
    const known = knowledge([["a1", piece("k")], ["h8", piece("k", "b")],
      ["b1", piece("n")], ["g1", piece("n")]]);
    const prefix = [classical("g1", "f3")];
    const action = special("spiderMine", "b1", undefined, "F");
    const queued = addScAction({ snapshot: snapshot(known, prefix), action }).snapshot;
    expect(endScTurn(queued, { skipTurnStartChecks: true }).next.mines).toEqual([{ color: "w", at: "b1" }]);
  });

  it("reports no hidden-enemy-mine constraint through PlanningKnowledge", () => {
    const known = knowledge([["b1", piece("n")]], { unknownSquares: new Set(["b1"]) });
    const action = special("spiderMine", "b1");
    expect(knownAppendFailure(known, [], action)).toBeNull();
    expect(() => assertSpecialLegal({ ...snapshot(known), mines: [{ color: "b", at: "b1" }] },
      { ...action, seq: 0 })).toThrow("mine already on square");
  });

  it("uses the F mecha anchor for aim without granting a promoted special actor", () => {
    const known = knowledge([["c1", piece("b")]]);
    const prefix = [classical("c1", "e3")];
    expect(knownAppendFailure(known, prefix, special("charonMissiles", "c1", "f4", "F"))).toBeNull();
    expect(knownAppendFailure(known, prefix, special("charonMissiles", "c1", "d2", "F"))).toBeNull();
    expect(knownAppendFailure(known, prefix, special("charonMissiles", "c1", "b2", "F"))).toBe("shape");
    expect(() => assertSpecialLegal(snapshot(known, prefix), { ...special("charonMissiles", "c1", "f4", "F"), seq: 1 }))
      .not.toThrow();
  });

  it("preserves native refusal codes and messages", () => {
    const known = knowledge([["a1", piece("k")], ["h8", piece("k", "b")], ["d2", piece("p")], ["d3", piece("n")]]);
    try {
      addScAction({ snapshot: snapshot(known), action: special("stimStep", "d2", "d3") });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AddScActionError);
      expect(error).toMatchObject({ code: "SC_SPECIAL", message: "stimStep blocked" });
    }
    expect(() => addScAction({ snapshot: snapshot(known), action: classical("a1", "d2") }))
      .toThrow("cannot classical-target ally on d2");
  });
});
