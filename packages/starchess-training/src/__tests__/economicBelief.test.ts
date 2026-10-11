// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it } from "vitest";
import type { AuthorizedEvent, AuthorizedSnapshotV2, Sighting } from "@chess-coach/starchess-arena/observations";
import type { Cells, EconomicArtifact, Meter, PublicOpening, Square } from "../economic/contracts";
import { decodeOwnedNumber } from "../economic/ownedScalars";
import { foldInnovations } from "../economic/innovation";
import { currentBoardBounds, expandComponents } from "../economic/evaluator";
import { initializeEconomicState, advanceEconomicState, readoutEconomic } from "../features";
import { reduceEconomicBelief } from "../economic/belief";
import { readoutEconomicInternal } from "../economic/readout";
import { squares } from "./fixtures";
import { armFixture, fixtureArtifact, fixtureBoundary, openingHistory } from "./economicA2.test";
import { featureMeter, ownHistory } from "./featurePrefix370.test";
import * as k from "../economic/ownedKernel";

const meter = featureMeter;
const unknown: Cells = squares.map(square => ({ square, visibility: "unknown" }));
const sighting = (square: Square, type: Sighting["piece"]["type"], observedTurn = 0): Sighting => ({ square, piece: { type, color: "b" }, observedTurn });
const patch = (cells: Cells, changes: Cells): Cells => {
  const map = new Map(changes.map(cell => [cell.square, cell]));
  return cells.map(cell => map.get(cell.square) ?? cell);
};
const ownedCells = (cells: Cells, m: Meter): Cells => {
  const cursor = cells.length === 64 ? k.beginCells64(m) : k.beginChanges64(m);
  for (const cell of cells) {
    const piece = cell.visibility !== "unknown" && cell.piece ? k.makePiece(m, cell.piece.type, cell.piece.color) : null;
    const owned = cell.visibility === "unknown" ? k.makeUnknownCell(m, cell.square) : cell.visibility === "lit" ? k.makeLitCell(m, cell.square, piece) : k.makeRevealedCell(m, cell.square, piece!, "w");
    if (cells.length === 64) k.appendCells64(m, cursor, owned); else k.appendChanges64(m, cursor, owned);
  }
  return cells.length === 64 ? k.finishCells64(m, cursor) : k.finishChanges64(m, cursor);
};
const fold = (events: readonly AuthorizedEvent[], memory: readonly Sighting[] = [], finalCells: Cells = unknown, cells: Cells = unknown) => {
  const m = meter(), memories = k.beginMemory64(m);
  for (const v of memory) k.appendMemory64(m, memories, k.makeSighting(m, v.square, k.makePiece(m, v.piece.type, v.piece.color), v.observedTurn));
  const ownedEvents = events.map(v => v.kind === "vision-witness" ? k.makeVisionWitnessEvent(m, v.seq, v.turn, ownedCells(v.changes, m)) : v.kind === "own-income" ?
    k.makeOwnIncomeEvent(m, v.seq, v.actualCreditedMinerals) : v.kind === "enemy-unit-destruction-witnessed" ?
      k.makeEnemyUnitDestructionWitnessedEvent(m, v.seq, v.witnessId, v.square, v.type, v.replacementLowerBound) : v);
  return foldInnovations({ side: "w", previousTurn: 0, turn: 1, seqBefore: 0, seqThrough: events.length, cells: ownedCells(cells, m), memory: k.finishMemory64(m, memories),
    events: ownedEvents, finalCells: ownedCells(finalCells, m), priorOwn: [], currentOwn: [], priorUnits: [] }, m);
};
const artifact = fixtureArtifact(), opening = artifact.opening;
const snapshot = (turn = 0): AuthorizedSnapshotV2 => openingHistory(turn).currentAuthorizedSnapshotV2;
const boundary = (ordinal = 0, seqBefore = 0) => fixtureBoundary(openingHistory(), ordinal, ordinal === 0 ? "initial" : "turn-open", seqBefore);

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
    const first = boundary(), state = initializeEconomicState(opening, first, artifact, armFixture("initialize"));
    const joint = expandComponents(state.components, meter());
    expect(joint[577 * 3 + 4]).toBe(1); expect(joint.reduce((sum, p) => sum + p, 0)).toBe(1);
    expect(state.witnessed).toEqual([]); expect(state.unlocated).toEqual(["c7", "d7", "e7", "f7"]);
    const work = armFixture("advance"), used = work.used, replay = advanceEconomicState(state, first, artifact, work);
    expect(replay).toBe(state); expect(work.used - used).toBeLessThan(512);
    const open = advanceEconomicState(state, boundary(1, state.seqThrough), artifact, armFixture("advance"));
    expect(open.components).toBe(state.components); expect(open.publicSupport).toBe(state.publicSupport);
    expect(() => advanceEconomicState(state, { ...first, seqThrough: first.seqThrough + 1 }, artifact, armFixture("advance"))).toThrow("PROVENANCE");
  });
  it("reads exact own replacement rather than paid basis and excludes ownCC", () => {
    const state = initializeEconomicState(opening, boundary(), artifact, armFixture("initialize"));
    const current = snapshot();
    const history = ownHistory({ version: "challenge-history-v2", currentAuthorizedSnapshotV2: current, economicState: current.economicState, everLit: ["c2", "e1"] }, meter());
    const result = readoutEconomic(history, state, artifact, armFixture("readout"));
    expect(decodeOwnedNumber(result.meanD)).toBe(4); expect(decodeOwnedNumber(result.meanPotential)).toBe(7);
    expect(decodeOwnedNumber(result.balance)).toBe(-3); expect(decodeOwnedNumber(result.uncertainty)).toBe(0);
    const promoted: AuthorizedSnapshotV2 = { ...current, own: { ...current.own,
      pieces: [{ square: "e1", piece: { type: "k", color: "w" } }, { square: "c8", piece: { type: "q", color: "w" } }] },
      ownUnitLineage: [{ id: "w:unit:created:1", square: "c8", type: "q", paidBasis: 1, replacementValue: 9 }] };
    const ledger = { ...promoted.economicState, ownPaidDebits: 1, ownPaidSurviving: 1 };
    const cells = patch(current.cells, [{ square: "c2", visibility: "lit", piece: null }, { square: "c8", visibility: "lit", piece: { type: "q", color: "w" } }]);
    const promotedHistory = ownHistory({ version: "challenge-history-v2", currentAuthorizedSnapshotV2: { ...promoted, cells, economicState: ledger }, economicState: ledger, everLit: ["c2", "c8", "e1"] }, meter());
    expect(() => readoutEconomic(promotedHistory, state, artifact, armFixture("readout"))).toThrow("CONSISTENCY");
    const next = fixtureBoundary(promotedHistory, 3, "turn-open", state.seqThrough), m = meter();
    const promotedState = k.makeEconomicState(m, next, "w", 3, next.seqThrough, 1, 0, k.boundaryRef(next), next.snapshot.cells, next.snapshot.memory,
      state.witnessed, state.unlocated, state.enemyCC, state.components, state.publicSupport);
    const readout = readoutEconomic(promotedHistory, promotedState, artifact, armFixture("readout"));
    expect(decodeOwnedNumber(readout.balance)).toBe(5);
  });
  it("builds G from authorized nonCC own-loss/movement facts and excludes a moving CC", () => {
    const m = meter(), cells = ownedCells(unknown, m);
    const result = foldInnovations({ side: "w", previousTurn: 0, turn: 1, seqBefore: 0, seqThrough: 3, cells, memory: [], finalCells: cells,
      priorOwn: ["d4"], currentOwn: [], priorUnits: [{ id: "cc", square: "e1", type: "k", paidBasis: 0, replacementValue: 0 },
        { id: "marine", square: "d4", type: "p", paidBasis: 0, replacementValue: 1 }], events: [
        { kind: "own-unit-moved", seq: 1, id: "cc", from: "e1", to: "e2" },
        { kind: "own-unit-moved", seq: 2, id: "marine", from: "d4", to: "e5" },
         { kind: "own-unit-destroyed", seq: 3, id: "marine", typeAtLoss: "p", square: "e5", retiredPaidBasis: 0 }] }, m);
    expect(result.geometry).toEqual(["d4", "e5"]); expect(result.loss).toBe(0);
  });
  it("uses actual zero own-income to grant enemy income once and rejects turn-open grants", () => {
    const initial = initializeEconomicState(opening, boundary(), artifact, armFixture("initialize"));
    const state = advanceEconomicState(initial, boundary(1, initial.seqThrough), artifact, armFixture("advance"));
    const settled = fixtureBoundary(openingHistory(1), 2, "settled", state.seqThrough);
    const m = meter(), input = k.makeAdvanceReductionInput(m, state, settled);
    const result = reduceEconomicBelief(state, input, artifact, m, settled);
    expect(result.publicSupport.slice(577 * 4, 577 * 5).some(Boolean)).toBe(true);
    expect(result.publicSupport.slice(0, 577).some(Boolean)).toBe(false);
    expect(advanceEconomicState(result, settled, artifact, armFixture("advance"))).toBe(result);
    expect(() => advanceEconomicState(state, { ...settled, phase: "turn-open", planningOrdinal: 0 }, artifact, armFixture("advance"))).toThrow("PROVENANCE");
  });
});
