// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it, vi } from "vitest";
import type { AuthorizedHistory } from "@chess-coach/starchess-arena/observations";
import type { CheckedBoundary, EconomicArtifact, EconomicBeliefState, Meter, Square } from "../economic/contracts";
import * as k from "../economic/ownedKernel";
import { encodeOwnedNumber, decodeOwnedNumber } from "../economic/ownedScalars";
import { advanceEconomicState, encodeFeaturesV3, flattenFeaturesV3, initializeEconomicState, readoutEconomic } from "../features";
import * as publicFeatures from "../features";
import { closeFeatureMeter, featureHistory, featureMeter, ownCandidate, ownHistory } from "./featurePrefix370.test";
import { squares } from "./fixtures";

let previous: k.LedgerPair | undefined;
export const armFixture = (operation: k.A2Operation): Meter => {
  closeFeatureMeter();
  if (previous) { try { previous.owner.abort(); } catch { } }
  previous = k.createPlanningLedger(); previous.owner.admitOnce();
  switch (operation) {
    case "initialize": previous.owner.armInitialize(); break;
    case "advance": previous.owner.armAdvance(); break;
    case "readout": previous.owner.armReadout(); break;
    case "encode": previous.owner.armEncode(); break;
    case "flatten": previous.owner.armFlatten(); break;
  }
  return previous.meter;
};
export const fixtureArtifact = (): EconomicArtifact => {
  const context = k.createStartupArtifactContext(), partition = k.beginPartition(context);
  for (const [low, high] of [[0, 10], [11, 20], [21, 45]]) k.appendPartition(context, partition, k.makePartitionBin(context, low!, high!, 0, 64));
  const bins = k.finishPartition(context, partition), temperatures = k.beginTemperatures(context, bins);
  for (let i = 0; i < 3; i++) k.appendTemperatures(context, temperatures, encodeOwnedNumber(1));
  return k.makeEconomicArtifact(context, k.constructCanonicalOpening(), k.makeEconomicRecipe(context, encodeOwnedNumber(.5)), k.finishTables1588(context, k.beginTables1588(context)), bins, k.finishTemperatures(context, temperatures));
};
export const openingHistory = (turn = 0): AuthorizedHistory => {
  const raw = featureHistory([["e1", "k"], ["c2", "p"]], { minerals: 3, gas: 1, unknown: squares.filter(s => s !== "e1" && s !== "c2") });
  return ownHistory({ ...raw, currentAuthorizedSnapshotV2: { ...raw.currentAuthorizedSnapshotV2, turn, own: { ...raw.currentAuthorizedSnapshotV2.own, gasIncome: 1 } } }, featureMeter());
};
export const fixtureBoundary = (history: AuthorizedHistory, ordinal = 0, phase: CheckedBoundary["phase"] = ordinal === 0 ? "initial" : "turn-open", seqBefore = 0): CheckedBoundary => {
  const meter = featureMeter(), snapshot = history.currentAuthorizedSnapshotV2, events = k.beginEvents2048(meter);
  let seqThrough = seqBefore;
  if (phase === "initial") {
    for (const v of snapshot.ownUnitLineage) k.appendEvents2048(meter, events, k.makeOwnUnitEndowedEvent(meter, ++seqThrough, v.id, v.square, v.type));
    for (const v of snapshot.ownMineLineage) k.appendEvents2048(meter, events, k.makeOwnMineEndowedEvent(meter, ++seqThrough, v.mineId, v.square));
  } else if (phase === "settled") k.appendEvents2048(meter, events, k.makeOwnIncomeEvent(meter, ++seqThrough, 0));
  const planningOrdinal = Math.floor(ordinal / 2), batch = k.makeBoundaryBatch(meter, snapshot.side, ordinal, phase, snapshot.turn, planningOrdinal, seqBefore, seqThrough, k.finishEvents2048(meter, events), snapshot);
  const bytes = k.snapshotFixedBytes(k.encodeOwnedBoundaryBatch(meter, batch), "boundaryBatch", meter), verified = k.completeBoundaryBatchBytes(meter, bytes, batch);
  const retired = k.finishRetiredMineIds195(meter, k.beginRetiredMineIds195(meter, snapshot.side));
  const audit = k.makeMineAudit(meter, snapshot.ownMineLineage, retired, 0);
  const boundary = k.makeBoundary(meter, snapshot, snapshot.economicState, audit, history.everLit, ordinal, phase, planningOrdinal, seqThrough, verified);
  closeFeatureMeter(); return boundary;
};
export const fixtureState = (history: AuthorizedHistory, artifact = fixtureArtifact()): EconomicBeliefState => {
  const boundary = fixtureBoundary(history);
  return initializeEconomicState(artifact.opening, boundary, artifact, armFixture("initialize"));
};

describe("five paid public A2 methods", () => {
  it("exports only the five frozen model methods", () => {
    expect(Object.keys(publicFeatures).sort()).toEqual(["advanceEconomicState", "encodeFeaturesV3", "flattenFeaturesV3", "initializeEconomicState", "readoutEconomic"]);
  });
  it("initializes, replays, advances, reads, encodes and freshly flattens owned operands", () => {
    const artifact = fixtureArtifact(), history = openingHistory(), initial = fixtureBoundary(history);
    const state = initializeEconomicState(artifact.opening, initial, artifact, armFixture("initialize"));
    expect(k.requireState(state)).toBe(state);
    expect(state.components).toHaveLength(1); expect(state.publicSupport[577 * 3 + 4]).toBe(true);
    expect(advanceEconomicState(state, initial, artifact, armFixture("advance"))).toBe(state);
    const boundary = fixtureBoundary(history, 1, "turn-open", state.seqThrough), open = advanceEconomicState(state, boundary, artifact, armFixture("advance"));
    expect(open.components).toBe(state.components); expect(open.publicSupport).toBe(state.publicSupport);
    const readout = readoutEconomic(history, open, artifact, armFixture("readout"));
    expect(k.requireReadout(readout)).toBe(readout); expect(decodeOwnedNumber(readout.meanD)).toBe(4); expect(decodeOwnedNumber(readout.balance)).toBe(-3);
    const candidate = ownCandidate([], "w", featureMeter()); closeFeatureMeter();
    const blocks = encodeFeaturesV3(history, open, candidate, artifact, armFixture("encode"));
    expect(k.requireFeatureBlocks(blocks)).toBe(blocks);
    const a = flattenFeaturesV3(blocks, armFixture("flatten")), b = flattenFeaturesV3(blocks, armFixture("flatten"));
    expect(a).toHaveLength(418); expect(a).toEqual(b); expect([...a].every(Number.isFinite)).toBe(true);
    a[0] = 99; expect(b[0]).toBe(1);
  });
  it("rejects every unarmed call before touching economic argument properties", () => {
    const trap = vi.fn(() => { throw new Error("trap"); }), value = new Proxy({}, { get: trap, ownKeys: trap, getPrototypeOf: trap });
    const run = (call: (v: never, meter: Meter) => unknown) => { const { meter } = k.createPlanningLedger(); expect(() => call(value as never, meter)).toThrow("LIFECYCLE"); };
    run((v, meter) => initializeEconomicState(v, v, v, meter)); run((v, meter) => advanceEconomicState(v, v, v, meter));
    run((v, meter) => readoutEconomic(v, v, v, meter)); run((v, meter) => encodeFeaturesV3(v, v, v, v, meter)); run((v, meter) => flattenFeaturesV3(v, meter));
    expect(trap).not.toHaveBeenCalled();
  });
  it("retains the entry debit and provenance error while closing a failed entry", () => {
    const trap = vi.fn(() => { throw new Error("trap"); }), raw = new Proxy({}, { get: trap, ownKeys: trap });
    const meter = armFixture("flatten"), used = meter.used;
    expect(() => flattenFeaturesV3(raw as never, meter)).toThrow("PROVENANCE");
    expect(meter.used).toBe(used); expect(() => previous!.owner.armFlatten()).toThrow("LIFECYCLE"); expect(trap).not.toHaveBeenCalled();
  });
  it("rejects a copied account and a mismatched arm without economic graph traps", () => {
    const trap = vi.fn(() => { throw new Error("trap"); }), raw = new Proxy({}, { get: trap, ownKeys: trap });
    const armed = armFixture("readout"), copy = { limit: armed.limit, used: armed.used };
    expect(() => readoutEconomic(raw as never, raw as never, raw as never, copy)).toThrow("PROVENANCE");
    expect(trap).not.toHaveBeenCalled();
    const wrong = armFixture("readout");
    expect(() => flattenFeaturesV3(raw as never, wrong)).toThrow("LIFECYCLE");
    expect(trap).not.toHaveBeenCalled();
  });
  it("uses the verified explicit state reference instead of ambient prior operands", () => {
    const artifact = fixtureArtifact(), history = openingHistory(), initial = fixtureBoundary(history);
    const state = initializeEconomicState(artifact.opening, initial, artifact, armFixture("initialize"));
    const next = fixtureBoundary(history, 1, "turn-open", state.seqThrough), meter = featureMeter();
    const input = k.makeAdvanceReductionInput(meter, state, next);
    expect(input.priorOwnUnits).toBe(k.batchForBoundaryRef(state.boundaryRef).snapshot.ownUnitLineage);
    expect(input.priorOwnSquares).toEqual(["c2"]); closeFeatureMeter();
  });
});
