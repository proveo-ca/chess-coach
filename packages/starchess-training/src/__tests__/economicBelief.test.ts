import { describe, expect, it } from "vitest";
import type { AuthorizedEvent, AuthorizedSnapshotV2, Sighting } from "@chess-coach/starchess-arena/observations";
import type { Cells, EconomicArtifact, Meter, PublicOpening, Square } from "../economic/contracts";
import { encodeFloat64, decodeFloat64 } from "../economic/float64";
import { foldInnovations } from "../economic/innovation";
import { currentBoardBounds, expandComponents } from "../economic/evaluator";
import { initializeEconomicBelief, reduceEconomicBelief, type EconomicBoundaryInput } from "../economic/belief";
import { readoutEconomicInternal } from "../economic/readout";
import { squares } from "./fixtures";

const meter = (): Meter => ({ limit: 1048576, used: 0 });
const unknown: Cells = squares.map(square => ({ square, visibility: "unknown" }));
const sighting = (square: Square, type: Sighting["piece"]["type"], observedTurn = 0): Sighting => ({ square, piece: { type, color: "b" }, observedTurn });
const patch = (cells: Cells, changes: Cells): Cells => {
  const map = new Map(changes.map(cell => [cell.square, cell]));
  return cells.map(cell => map.get(cell.square) ?? cell);
};
const fold = (events: readonly AuthorizedEvent[], memory: readonly Sighting[] = [], finalCells: Cells = unknown, cells: Cells = unknown) =>
  foldInnovations({ side: "w", previousTurn: 0, turn: 1, seqBefore: 0, seqThrough: events.length, cells, memory, events, finalCells, priorOwn: [], currentOwn: [], priorUnits: [] }, meter());
const opening: PublicOpening = { version: "starchess-economic-opening-v1", turn: 0, bank: { w: 3, b: 3 }, cc: { w: "e1", b: "e8" },
  marines: { w: ["c2", "d2", "e2", "f2"], b: ["c7", "d7", "e7", "f7"] } };
const artifact: EconomicArtifact = { version: "starchess-economic-artifact-v1", status: "FROZEN", opening,
  recipe: { version: "starchess-economic-recipe-v1", supportVersion: "economic-accounting-relaxation-v1", graphVersion: "positive-headstock-suffix-v1",
    innovationVersion: "authorized-economic-innovation-v1", geometryVersion: "authorized-promotion-geometry-v1", calibrationVersion: "starchess-economic-calibration-v1",
    workCap: 1048576, materialCeiling: 576, bankCap: 12, bandStarts: [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512],
    alpha: encodeFloat64(.5, undefined), minimumGroups: 32, diagnosticHorizons: [1, 2, 3] }, tables: [], partition: [[0, 10, 0, 64], [11, 20, 0, 64], [21, 45, 0, 64]],
  temperatures: [1, 1, 1].map(value => encodeFloat64(value, undefined)) };
const snapshot = (turn = 0): AuthorizedSnapshotV2 => ({ version: "challenge-observation-v2", side: "w", turn,
  own: { minerals: 3, gas: 1, gasIncome: 1, ccLives: 3, pieces: [{ square: "e1", piece: { type: "k", color: "w" } }, { square: "c2", piece: { type: "p", color: "w" } }], mines: [], siegedTanks: [] },
  cells: unknown, memory: [], ownUnitLineage: [], ownMineLineage: [], economicState: { version: "challenge-economic-ledger-v1", side: "w",
    ownPaidDebits: 0, ownPaidSurviving: 0, ownPaidDestroyed: 0, ownPaidWasted: 0, ownReplacementDestroyed: 0,
    enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" }, receipts: [], retiredOwnIds: [] } });
const boundary = (ordinal = 0): EconomicBoundaryInput => ({ phase: ordinal === 0 ? "initial" : "turn-open", ordinal, planningOrdinal: 0,
  seqBefore: 0, seqThrough: 0, events: [], snapshot: snapshot(), boundaryRef: { byteLength: 10, sha256: String(ordinal).repeat(64) }, priorOwnSquares: ["c2"], priorOwnUnits: [] });

describe("economic public innovation and transactional belief", () => {
  it("counts typed assertions once in recipient sequence without equating sightings with births", () => {
    const marine: Cells = [{ square: "d4", visibility: "lit", piece: { type: "p", color: "b" } }];
    const ship: Cells = [{ square: "d4", visibility: "revealed", piece: { type: "q", color: "b" } }];
    const result = fold([{ kind: "vision-witness", seq: 1, turn: 1, changes: marine }, { kind: "vision-witness", seq: 2, turn: 1, changes: ship },
      { kind: "vision-witness", seq: 3, turn: 1, changes: marine }, { kind: "own-income", seq: 4, actualCreditedMinerals: 0 }]);
    expect(result.values).toEqual([10, 0, 0]); expect(result.code).toEqual([3, 0, 0]); expect(result.anchors).toEqual(["d4"]);
    expect(result.memory).toEqual([sighting("d4", "p", 1)]); expect(result.grant).toBe(true);
    const same = patch(unknown, marine);
    expect(fold([], [sighting("d4", "p")], same, same).values).toEqual([0, 0, 0]);
  });
  it("applies casualty memory clearing before lit-empty Y3 without fabricating a clear", () => {
    const events: AuthorizedEvent[] = [{ kind: "enemy-unit-destruction-witnessed", seq: 1, witnessId: "w:witness:1", square: "d4", type: "p", replacementLowerBound: 1, paidLowerBound: 0 },
      { kind: "vision-witness", seq: 2, turn: 1, changes: [{ square: "d4", visibility: "lit", piece: null }] }];
    const result = fold(events, [sighting("d4", "p")]);
    expect(result.values).toEqual([0, 1, 0]); expect(result.memory).toEqual([]); expect(result.loss).toBe(1);
    const mismatch = fold(events, [sighting("d4", "q")]);
    expect(mismatch.values).toEqual([0, 1, 1]);
    const unknownAfterLoss = fold(events.slice(0, 1), [sighting("d4", "p")]);
    expect(unknownAfterLoss.cells.find(cell => cell.square === "d4")).toEqual({ square: "d4", visibility: "unknown" });
  });
  it("repopulates memory from later authorized occupants and counts distinct clear squares", () => {
    const result = fold([{ kind: "enemy-unit-destruction-witnessed", seq: 1, witnessId: "w:witness:1", square: "d4", type: "p", replacementLowerBound: 1, paidLowerBound: 0 },
      { kind: "vision-witness", seq: 2, turn: 1, changes: [{ square: "d4", visibility: "lit", piece: { type: "q", color: "b" } }] },
      { kind: "vision-witness", seq: 3, turn: 1, changes: [{ square: "e4", visibility: "lit", piece: null }, { square: "f4", visibility: "lit", piece: null }] }],
    [sighting("d4", "p"), sighting("e4", "p"), sighting("f4", "p")]);
    expect(result.values).toEqual([9, 1, 2]); expect(result.code).toEqual([3, 1, 2]); expect(result.memory).toEqual([sighting("d4", "q", 1)]);
  });
  it("rejects gaps, duplicate witnesses and repeated grants including zero", () => {
    expect(() => fold([{ kind: "own-income", seq: 2, actualCreditedMinerals: 0 }])).toThrow("SEQUENCE");
    expect(() => fold([{ kind: "own-income", seq: 1, actualCreditedMinerals: 0 }, { kind: "own-income", seq: 2, actualCreditedMinerals: 0 }])).toThrow("DUPLICATE");
    const loss: AuthorizedEvent = { kind: "enemy-unit-destruction-witnessed", seq: 1, witnessId: "w:witness:1", square: "d4", type: "p", replacementLowerBound: 1, paidLowerBound: 0 };
    expect(() => fold([loss, { ...loss, seq: 2 }])).toThrow("DUPLICATE");
  });
  it("excludes CC and stale sightings from current-board bounds and reserves an unknown CC cell", () => {
    const cells = patch(unknown, [{ square: "e8", visibility: "lit", piece: { type: "k", color: "b" } }, { square: "d4", visibility: "revealed", piece: { type: "q", color: "b" } }]);
    expect(currentBoardBounds(cells, "w", meter())).toEqual({ lower: 9, upper: 567, marines: 0 });
    expect(currentBoardBounds(unknown, "w", meter())).toEqual({ lower: 0, upper: 567, marines: 0 });
    const complete: Cells = squares.map(square => ({ square, visibility: "lit", piece: null }));
    expect(() => currentBoardBounds(complete, "w", meter())).toThrow("CONSISTENCY");
  });
  it("initializes the public joint4/3 and keeps turn-open economics and replay exact", () => {
    const first = boundary(), state = initializeEconomicBelief(opening, first, artifact, meter());
    const joint = expandComponents(state.components, meter());
    expect(joint[577 * 3 + 4]).toBe(1); expect(joint.reduce((sum, p) => sum + p, 0)).toBe(1);
    expect(state.witnessed).toEqual([]); expect(state.unlocated).toEqual(["c7", "d7", "e7", "f7"]);
    const work = meter(), replay = reduceEconomicBelief(state, first, artifact, work);
    expect(replay).toBe(state); expect(work.used).toBeLessThan(100);
    const open = reduceEconomicBelief(state, boundary(1), artifact, meter());
    expect(open.components).toEqual(state.components); expect(open.publicSupport).toEqual(state.publicSupport);
    expect(() => reduceEconomicBelief(state, { ...first, boundaryRef: { byteLength: 11, sha256: first.boundaryRef.sha256 } }, artifact, meter())).toThrow("DUPLICATE");
  });
  it("reads exact own replacement rather than paid basis and excludes ownCC", () => {
    const state = initializeEconomicBelief(opening, boundary(), artifact, meter());
    const current = snapshot();
    const result = readoutEconomicInternal({ version: "challenge-history-v2", currentAuthorizedSnapshotV2: current, economicState: current.economicState, everLit: [] }, state, artifact, meter());
    expect(decodeFloat64(result.meanD, undefined)).toBe(4); expect(decodeFloat64(result.meanPotential, undefined)).toBe(7);
    expect(decodeFloat64(result.balance, undefined)).toBe(-3); expect(decodeFloat64(result.uncertainty, undefined)).toBe(0);
    const promoted: AuthorizedSnapshotV2 = { ...current, own: { ...current.own,
      pieces: [{ square: "e1", piece: { type: "k", color: "w" } }, { square: "c8", piece: { type: "q", color: "w" } }] },
      ownUnitLineage: [{ id: "w:unit:created:1", square: "c8", type: "q", paidBasis: 1, replacementValue: 9 }] };
    const readout = readoutEconomicInternal({ version: "challenge-history-v2", currentAuthorizedSnapshotV2: promoted, economicState: promoted.economicState, everLit: [] }, state, artifact, meter());
    expect(decodeFloat64(readout.balance, undefined)).toBe(5);
  });
  it("builds G from authorized nonCC own-loss/movement facts and excludes a moving CC", () => {
    const result = foldInnovations({ side: "w", previousTurn: 0, turn: 1, seqBefore: 0, seqThrough: 3, cells: unknown, memory: [], finalCells: unknown,
      priorOwn: ["d4"], currentOwn: [], priorUnits: [{ id: "cc", square: "e1", type: "k", paidBasis: 0, replacementValue: 0 },
        { id: "marine", square: "d4", type: "p", paidBasis: 0, replacementValue: 1 }], events: [
        { kind: "own-unit-moved", seq: 1, id: "cc", from: "e1", to: "e2" },
        { kind: "own-unit-moved", seq: 2, id: "marine", from: "d4", to: "e5" },
        { kind: "own-unit-destroyed", seq: 3, id: "marine", typeAtLoss: "p", square: "e5", retiredPaidBasis: 0 }] }, meter());
    expect(result.geometry).toEqual(["d4", "e5"]); expect(result.loss).toBe(0);
  });
  it("uses actual zero own-income to grant enemy income once and rejects turn-open grants", () => {
    const state = initializeEconomicBelief(opening, boundary(), artifact, meter());
    const settled: EconomicBoundaryInput = { ...boundary(1), phase: "settled", planningOrdinal: 1, snapshot: snapshot(1), seqThrough: 1,
      events: [{ kind: "own-income", seq: 1, actualCreditedMinerals: 0 }] };
    const result = reduceEconomicBelief(state, settled, artifact, meter());
    expect(result.publicSupport.slice(577 * 4, 577 * 5).some(Boolean)).toBe(true);
    expect(result.publicSupport.slice(0, 577).some(Boolean)).toBe(false);
    expect(reduceEconomicBelief(result, settled, artifact, meter())).toBe(result);
    expect(() => reduceEconomicBelief(state, { ...settled, phase: "turn-open", planningOrdinal: 0 }, artifact, meter())).toThrow("CONSISTENCY");
  });
});
