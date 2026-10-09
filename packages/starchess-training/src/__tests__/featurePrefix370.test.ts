import { describe, expect, it } from "vitest";
import { decodeCandidate, requestedSpend } from "@chess-coach/starchess-arena/intent-codec-v1";
import type { AuthorizedHistory, EconomicState } from "@chess-coach/starchess-arena/observations";
import type { ScActionInput, Square } from "@chess-coach/starchess-core/planning-v1";
import type { Meter } from "../economic/contracts";
import { encodeHistorical370 } from "../feature/encoder";
import { projectOwn } from "../feature/projection";
import { measureRay, stationaryRelation } from "../feature/relations";
import { c, observation, s, type FixtureOptions } from "./fixtures";

export const featureMeter = (): Meter => ({ limit: 1048576, used: 0 });
export const featureHistory = (own: Parameters<typeof observation>[0], options: FixtureOptions = {}, paid: Partial<Record<Square, number>> = {}): AuthorizedHistory => {
  const o = observation(own, options);
  const surviving = Object.values(paid).reduce((a, b) => a + b, 0);
  const economic: EconomicState = { version: "challenge-economic-ledger-v1", side: o.side,
    ownPaidDebits: surviving, ownPaidSurviving: surviving, ownPaidDestroyed: 0, ownPaidWasted: 0, ownReplacementDestroyed: 0,
    enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" }, receipts: [], retiredOwnIds: [] };
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const;
  return { version: "challenge-history-v2", economicState: economic,
    everLit: o.cells.filter(cell => cell.visibility === "lit").map(cell => cell.square),
    currentAuthorizedSnapshotV2: { ...o, version: "challenge-observation-v2", economicState: economic,
      ownUnitLineage: o.own.pieces.map(({ square, piece }) => ({ id: `${o.side}:unit:opening:${square}`, square, type: piece.type, paidBasis: paid[square] ?? 0, replacementValue: values[piece.type] })),
      ownMineLineage: o.own.mines.map(square => ({ mineId: `${o.side}:mine:opening:${square}`, square })) } };
};
export const featureCandidate = (actions: readonly ScActionInput[], side: "w" | "b" = "w") => {
  const canonicalActions = actions.map(action => Object.fromEntries(Object.entries(action).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
  return decodeCandidate({ version: "challenge-candidate-codec-v1", actions, key: JSON.stringify(canonicalActions), ownSpend: requestedSpend(actions) }, side);
};
export const historical = (history: AuthorizedHistory, actions: readonly ScActionInput[]) => {
  const meter = featureMeter(), candidate = featureCandidate(actions, history.currentAuthorizedSnapshotV2.side);
  const projection = projectOwn(history, candidate, meter);
  return { ...encodeHistorical370(history, candidate, projection, meter), projection, meter };
};

describe("historical 370 independent numerical fixtures", () => {
  it("matches every numeric historical coordinate for an uncertain Tank ray", () => {
    const h = featureHistory([["a1", "k"], ["a2", "r"], ["b2", "n"]], { unknown: ["a4"], enemy: [["a7", "p"], ["h8", "k"]] }, { a2: 5 });
    const ledger = { ...h.economicState, ownPaidDestroyed: 6, ownPaidWasted: 3, ownPaidDebits: 14,
      enemyLoss: { ...h.economicState.enemyLoss, replacementLowerBound: 9, confirmedUnitCount: 1 } };
    const memory = [{ square: "a7" as const, piece: { type: "p" as const, color: "b" as const }, observedTurn: 10 }];
    const input = { ...h, economicState: ledger, currentAuthorizedSnapshotV2: { ...h.currentAuthorizedSnapshotV2, economicState: ledger, memory } };
    const { queue, positions } = historical(input, [c("a2", "a6")]);
    const expectedQueue = [0, .25, 0, 0, 0, .25, 0, 1, 1, 0, 0, 1 / 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 9 / (4096 * 2304), 1 / 4096, 0, 0, 0, 0, 0, 1 / 4096, 0, 0];
    const expected = new Array<number>(84).fill(0);
    for (const index of [0, 1, 9, 13, 16, 22, 28, 31, 35, 38, 42, 57, 60]) expected[index] = 1;
    expected[12] = 1 / 7; expected[15] = 5 / 7; expected[55] = 5 / 12; expected[56] = 5 / 12;
    expected[61] = 2 / 64; expected[63] = 1 / 64; expected[64] = 1 / 64; expected[65] = 4 / 7;
    expected[68] = 1 / 64; expected[78] = 9 / (64 * 2304); expected[81] = 4 / 7; expected[82] = (4 / 7) * (11 / 45);
    expect(Object.values(queue)).toEqual(expectedQueue);
    expect(Object.values(positions[0])).toEqual(expected);
    expect(positions.slice(1).flatMap(p => Object.values(p))).toEqual(new Array(252).fill(0));
  });

  it("keeps native B head order, original-rank double rewrite, and authored feature slots", () => {
    const h = featureHistory([["a1", "k"], ["e2", "p"], ["e3", "p"]]);
    const result = historical(h, [s("stimStep", "e2", "e3"), s("stimStep", "e3", "e4"), c("e2", "e4")]);
    expect(result.projection.schedule).toEqual([1, 0, 2]);
    expect(result.projection.positions[2].effectiveFrom).toBe("e3");
    expect(result.projection.positions[2].effectiveTo).toBe("e5");
    expect(result.projection.final.units.get("w:unit:opening:e2")?.square).toBe("e5");
    expect(result.positions[2]["from.rank"]).toBe(1 / 7);
    expect(result.positions[2]["to.rank"]).toBe(3 / 7);
    expect(result.positions[2]["actor.nominal"]).toBe(1);
    expect(result.queue["pair.sameActor"]).toBe(1 / 6);
    expect(result.queue["pair.BC"]).toBe(1 / 6);
  });

  it("binds a direct B-arrival C diagonal to the existing token", () => {
    const h = featureHistory([["a1", "k"], ["e6", "p"]], { enemy: [["d8", "q"]] });
    const { projection, positions } = historical(h, [s("stimStep", "e6", "e7"), { ...c("e7", "d8"), promotion: "n" }]);
    expect(projection.positions[1].actorToken).toBe("w:unit:opening:e6");
    expect(projection.positions[1].effectiveTo).toBe("d8");
    expect(projection.final.units.get("w:unit:opening:e6")?.type).toBe("n");
    expect(projection.layers.enemies.get("d8")?.type).toBe("q");
    expect(positions[1]["actor.paidKnown"]).toBe(1);
  });

  it("keeps F-before-C mine binding and persistent unpromoted last-rank Marine", () => {
    const mine = historical(featureHistory([["h1", "k"], ["a3", "n"]]), [s("spiderMine", "a3", undefined, "F"), c("a3", "b5")]);
    expect(mine.projection.schedule).toEqual([1, 0]);
    expect([...mine.projection.final.mines]).toEqual(["b5"]);
    expect(mine.queue["pair.CF"]).toBe(1 / 6); expect(mine.queue["pair.mineRelocate"]).toBe(1 / 6);
    expect(mine.queue["pair.timingInversions"]).toBe(1 / 6);
    const marine = historical(featureHistory([["a1", "k"], ["e6", "p"]]), [s("stimStep", "e6", "e7", "F"), c("e6", "e7")]);
    expect(marine.projection.final.units.get("w:unit:opening:e6")).toMatchObject({ square: "e8", type: "p", paidBasis: 0 });
    expect(marine.positions[0]["promotion.none"]).toBe(1);
  });

  it("keeps fixed enemy blockers, conditional own vacancies, and unknown masks disjoint", () => {
    const h = featureHistory([["a1", "k"], ["a2", "r"], ["a4", "q"]], { unknown: ["a5"], enemy: [["a6", "p"]] });
    const { projection } = historical(h, [s("tacticalJump", "a4", "b4")]);
    const meter = featureMeter();
    expect(measureRay(projection.layers, projection.final, "r", "a2", "a7", meter)).toMatchObject({ empty: 2, occupied: 1, unknown: 1 });
    expect(stationaryRelation(projection.layers, projection.final, { square: "a2", type: "r", color: "w" }, "a7", meter)).toBe("none");
    expect(stationaryRelation(projection.layers, projection.final, { square: "a2", type: "r", color: "w" }, "a6", meter)).toBe("possible");
    expect(h.currentAuthorizedSnapshotV2.cells.find(cell => cell.square === "a4")).toMatchObject({ piece: { type: "q" } });
  });

  it("leaves CC aims and sieged fire stationary and zeroes every special ray", () => {
    const h = featureHistory([["a1", "k"], ["a2", "r"], ["c3", "b"]], { siege: ["a2"], enemy: [["a7", "k"]] });
    const aim = historical(h, [c("a2", "a7")]);
    expect(aim.projection.final.units.get("w:unit:opening:a2")?.square).toBe("a2");
    expect(aim.positions[0]["pressure.cc"]).toBe(1);
    const charon = historical(h, [s("charonMissiles", "c3", "h8")]);
    expect(Object.entries(charon.positions[0]).filter(([name]) => name.startsWith("ray.") || name.startsWith("path.")).map(([, value]) => value)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("counts whole relation pairs with divisor 4096 and leaves pass novelty empty", () => {
    const h = featureHistory([["a1", "k"], ["a2", "r"], ["b2", "r"]], { enemy: [["a7", "p"], ["b7", "p"]] });
    const result = historical(h, []);
    expect(result.queue["ix.pressureLossUncertainty"]).toBe(2 / 4096);
    expect(result.queue["nominal.newlyLit"]).toBe(0);
    expect(result.queue["nominal.visionOverlap"]).toBe(0);
  });

  it("keeps paid basis through promotion and uses a B birth token for deployMove", () => {
    const promoted = historical(featureHistory([["a1", "k"], ["e7", "p"]], {}, { e7: 1 }), [{ ...c("e7", "e8"), promotion: "q" }]);
    expect(promoted.projection.final.units.get("w:unit:opening:e7")).toMatchObject({ square: "e8", type: "q", paidBasis: 1 });
    const born = historical(featureHistory([["e1", "k"]]), [{ ...s("deploy", "e1", "d2"), unit: "p" }, c("d2", "d4")]);
    expect(born.positions[1]["actor.known"]).toBe(0); expect(born.positions[1]["actor.paidKnown"]).toBe(0);
    expect(born.positions[1]["actor.nominal"]).toBe(1); expect(born.positions[1]["actor.paid"]).toBe(0);
    expect(born.queue["pair.deployMove"]).toBe(1 / 6);
    expect(born.projection.final.units.get("birth:0")?.square).toBe("d4");
  });

  it("keeps Mecha piece-only reveals out of newly-lit geometry", () => {
    const h = featureHistory([["b1", "k"], ["a1", "b"]], { enemy: [["h8", "q"]] });
    const input = { ...h, everLit: h.everLit.filter(square => square !== "h8"), currentAuthorizedSnapshotV2: {
      ...h.currentAuthorizedSnapshotV2, cells: h.currentAuthorizedSnapshotV2.cells.map(cell => cell.square === "h8" ?
        { square: "h8" as const, visibility: "revealed" as const, piece: { type: "q" as const, color: "b" as const } } : cell) } };
    const result = historical(input, [s("charonMissiles", "a1", "h8")]);
    expect(result.positions[0]["target.enemy"]).toBe(1); expect(result.positions[0]["target.type.q"]).toBe(1);
    expect(result.positions[0]["nominal.newlyLit"]).toBe(0);
  });

  it("counts distinct threatened nonCC tokens and keeps CC protection known-only", () => {
    const h = featureHistory([["a1", "k"], ["d3", "n"]], { unknown: ["d6"], enemy: [["d8", "r"]] });
    const result = historical(h, [c("d3", "e5")]);
    expect(result.positions[0]["protection.units"]).toBe(1 / 64);
    expect(result.positions[0]["protection.cc"]).toBe(0);
  });
});
