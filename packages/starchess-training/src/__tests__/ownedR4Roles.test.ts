// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it } from "vitest";
import * as k from "../economic/ownedKernel";
import type { Meter } from "../economic/contracts";

const planning = () => {
  const pair = k.createPlanningLedger(); pair.owner.admitOnce(); pair.owner.armInitialize();
  return { ...pair, ticket: k.enterA2(pair.meter, "initialize") };
};
const artifact = (c: k.StartupArtifactContext) => {
  const recipe = k.makeEconomicRecipe(c, k.constructFloat64Hex("3fe0000000000000"));
  const tables = k.finishTables1588(c, k.beginTables1588(c)), partition = k.beginPartition(c);
  for (const [low, high] of [[0, 10], [11, 20], [21, 45]]) k.appendPartition(c, partition, k.makePartitionBin(c, low!, high!, 0, 64));
  const bins = k.finishPartition(c, partition), temperatures = k.beginTemperatures(c, bins);
  for (let i = 0; i < 3; i++) k.appendTemperatures(c, temperatures, k.constructFloat64Hex("3ff0000000000000"));
  return k.makeEconomicArtifact(c, k.constructCanonicalOpening(), recipe, tables, bins, k.finishTemperatures(c, temperatures));
};

describe("R4 named local ownership", () => {
  const guards = [k.requireHistory, k.requireBoundary, k.requireCandidate, k.requireArtifact, k.requireState, k.requireReadout,
    k.requireFeatureBlocks, k.requireManifest, k.requireBatch, k.requireSnapshotV2, k.requireCells, k.requireMemory,
    k.requireSquareSet, k.requireOwnPieces, k.requireOwnUnits, k.requireOwnMines, k.requireReceipts, k.requireEconomicLedger,
    k.requireMineAudit, k.requireOwnState, k.requireEvents, k.requireActions, k.requireConditional, k.requireComponents,
    k.requirePublicSupport, k.requireTables, k.requirePartition, k.requireTemperatures, k.requirePiece, k.requireCell,
    k.requireSighting, k.requireOwnPiece, k.requireOwnUnit, k.requireOwnMine, k.requireActionRef, k.requirePaidReceipt,
    k.requireDisposition, k.requireEnemyLoss, k.requireEvent, k.requireAction, k.requireComponent, k.requireEconomicRecipe,
    k.requireTransitionRow, k.requireEvidenceRow, k.requireTable, k.requirePartitionBin, k.requireQueue34, k.requirePosition84,
    k.requireEconomic12, k.requirePromotion36];
  it.each(guards.map(guard => [guard.name, guard] as const))("%s rejects raw proxies without an unsafe effect", (_, guard) => {
    let effects = 0;
    const proxy = new Proxy({}, {
      get() { effects++; throw new Error("get"); }, ownKeys() { effects++; throw new Error("keys"); },
      getPrototypeOf() { effects++; throw new Error("prototype"); }, getOwnPropertyDescriptor() { effects++; throw new Error("descriptor"); },
    });
    expect(() => guard(proxy)).toThrow("PROVENANCE"); expect(effects).toBe(0);
    expect(() => guard(Object.freeze({ hidden: Array(100000) }))).toThrow("PROVENANCE");
  });
  it("keeps the existing canonical registry and rejects every clone/wrong role", () => {
    const c = k.createStartupArtifactContext(), a = artifact(c), m = k.makeCanonicalManifestV3(c);
    expect(k.requireArtifact(a)).toBe(a); expect(k.requireManifest(m)).toBe(m);
    for (const value of [{ ...a }, structuredClone(a), m, k.constructCanonicalOpening()]) expect(() => k.requireArtifact(value)).toThrow("PROVENANCE");
    expect(Object.isFrozen(a)).toBe(true); expect(Object.isFrozen(a.partition)).toBe(true);
    expect(Object.isFrozen(a.partition[0])).toBe(true); expect(Object.isFrozen(a.recipe.bandStarts)).toBe(true);
  });
  it("allows only artifact productions in startup", () => {
    const c = k.createStartupArtifactContext(); expect(k.requireArtifact(artifact(c))).toBeDefined();
    for (const begin of [k.beginCells64, k.beginMemory64, k.beginSquareSet64, k.beginEvents2048, k.beginActions65, k.beginComponents247, k.beginPublicSupport7501, k.beginQueue34])
      expect(() => begin(c)).toThrow("PROVENANCE");
    expect(() => k.makeUnknownCell(c, "a1")).toThrow("PROVENANCE");
    expect(() => k.makeCandidate(c, "w", [] as never)).toThrow("PROVENANCE");
  });
  it("uses opaque context-bound single-use cursors and dense ordering", () => {
    const { meter, ticket } = planning(), cursor = k.beginSquareSet64(meter);
    k.appendSquareSet64(meter, cursor, "a1"); k.appendSquareSet64(meter, cursor, "h8");
    const result = k.finishSquareSet64(meter, cursor);
    expect(result).toEqual(["a1", "h8"]); expect(Reflect.ownKeys(result)).toEqual(["0", "1", "length"]);
    expect(Object.isFrozen(result)).toBe(true); expect(k.requireSquareSet(result)).toBe(result);
    k.finishA2(ticket);
    const next = planning(); expect(() => k.appendSquareSet64(next.meter, cursor, "h8")).toThrow("PROVENANCE");
  });
  it("rejects incomplete cells and checks source order at append", () => {
    const { meter } = planning(), cursor = k.beginCells64(meter);
    expect(() => k.appendCells64(meter, cursor, k.makeUnknownCell(meter, "b1"))).toThrow("ORDER");
    const other = planning(), incomplete = k.beginCells64(other.meter);
    expect(() => k.finishCells64(other.meter, incomplete)).toThrow("CARDINALITY");
  });
  it("reserves the complete support cursor before any append", () => {
    const { meter, ticket } = planning(), before = meter.used, cursor = k.beginPublicSupport7501(meter), prepaid = meter.used;
    expect(prepaid - before).toBeGreaterThan(7501);
    for (let i = 0; i < 7501; i++) k.appendPublicSupport7501(meter, cursor, i === 1735);
    const support = k.finishPublicSupport7501(meter, cursor);
    expect(meter.used).toBe(prepaid + 128 + 64); expect(support).toHaveLength(7501); expect(k.requirePublicSupport(support)).toBe(support);
    expect(support.filter(Boolean)).toHaveLength(1); k.finishA2(ticket);
  });
  it("fails work capacity before allocating a support cursor", () => {
    const { meter } = planning(); k.consumeWorkBlock(meter, "scalar", 800000);
    const before = meter.used; expect(() => k.beginPublicSupport7501(meter)).toThrow("WORK_CAP");
    expect(meter.used).toBe(before); expect(() => k.requirePlanningMeter(meter)).toThrow("LIFECYCLE");
  });
  it("checks conditional width, positive masses and normalization", () => {
    const { meter, ticket } = planning(), one = k.constructFloat64Hex("3ff0000000000000"), cursor = k.beginConditional(meter, 1);
    k.appendConditional(meter, cursor, one);
    const conditional = k.finishConditional(meter, cursor), component = k.makeComponent(meter, 3, 3, one, conditional), components = k.beginComponents247(meter);
    k.appendComponents247(meter, components, component); expect(k.finishComponents247(meter, components)).toEqual([component]); k.finishA2(ticket);
    const other = planning(), wrong = k.beginConditional(other.meter, 1); k.appendConditional(other.meter, wrong, k.constructFloat64Hex("0000000000000000"));
    expect(() => k.finishConditional(other.meter, wrong)).toThrow("NORMALIZATION");
  });
  it("validates lane cardinality, domains and the full fixed 418 manifest", () => {
    const { meter, ticket } = planning(), q = k.beginQueue34(meter), p = k.beginPosition84(meter), e = k.beginEconomic12(meter), promo = k.beginPromotion36(meter);
    for (let i = 0; i < 34; i++) k.putQueue34(meter, q, i, i === 0 ? 1 : 0);
    for (let i = 0; i < 84; i++) k.putPosition84(meter, p, i, 0);
    for (let i = 0; i < 12; i++) k.putEconomic12(meter, e, i, 0);
    for (let i = 0; i < 36; i++) k.putPromotion36(meter, promo, i, 0);
    const position = k.finishPosition84(meter, p), features = k.makeFeatureBlocks(meter, k.finishQueue34(meter, q), position, position, position, position, k.finishEconomic12(meter, e), k.finishPromotion36(meter, promo));
    expect(k.requireFeatureBlocks(features)).toBe(features); expect(Object.isFrozen(features.positions)).toBe(true); k.finishA2(ticket);
    const manifest = k.makeCanonicalManifestV3(k.createStartupArtifactContext());
    expect(manifest.names).toHaveLength(418); expect(manifest.names[369]).toBe("position.3.ix.protectionPaidLoss");
    expect(manifest.names[370]).toBe("economic.ix.spendBalance"); expect(manifest.names[417]).toBe("promotion.visionAdded.unlocated.h3");
    expect(new Set(manifest.names).size).toBe(418);
  });
  it("keeps own native diagnostic names and exact two-field meters", () => {
    let error: unknown;
    try { k.makeUnknownCell({} as Meter, "a1"); } catch (caught) { error = caught; }
    expect(Object.getOwnPropertyDescriptor(error, "name")?.value).toBe("ContractError");
    const pair = k.createPlanningLedger(); expect(Object.keys(pair.meter)).toEqual(["limit", "used"]);
    expect(Object.getPrototypeOf(pair.meter)).toBeNull(); expect(Object.isExtensible(pair.meter)).toBe(false);
  });
  it("constructs exactly the sixteen V2 event variants with frozen owned children", () => {
    const { meter, ticket } = planning(), ref = k.makeActionRef(meter, 0, 0), changes = k.beginChanges64(meter);
    k.appendChanges64(meter, changes, k.makeLitCell(meter, "a1", null));
    const values = [k.makeOwnPaidReceiptEvent(meter, 1, "w:receipt:0:0", ref, "p", "a2", 1), k.makeOwnGasDebitedEvent(meter, 2, ref, 1),
      k.makeOwnUnitEndowedEvent(meter, 3, "w:unit:opening:a2", "a2", "p"), k.makeOwnUnitCreatedEvent(meter, 4, "w:unit:created:1", "w:receipt:0:0", "a2", "p"),
      k.makeOwnDeploymentUnmaterializedEvent(meter, 5, "w:receipt:0:0", 1), k.makeOwnUnitMovedEvent(meter, 6, "w:unit:opening:a2", "a2", "a3"),
      k.makeOwnUnitTransformedEvent(meter, 7, "w:unit:opening:a2", "p", "q"), k.makeOwnUnitModeChangedEvent(meter, 8, "w:unit:opening:b2", "tank"),
      k.makeOwnUnitDestroyedEvent(meter, 9, "w:unit:opening:c2", "n", "c2", 0), k.makeOwnMineEndowedEvent(meter, 10, "w:mine:opening:a2", "a2"),
      k.makeOwnMineCreatedEvent(meter, 11, "w:mine:created:1", ref, "a2"), k.makeOwnMineRemovedEvent(meter, 12, "w:mine:opening:a2"),
      k.makeOwnIncomeEvent(meter, 13, 1), k.makeOwnCCLivesChangedEvent(meter, 14, 3, 2), k.makeEnemyUnitDestructionWitnessedEvent(meter, 15, "w:witness:1", "b2", "p", 1),
      k.makeVisionWitnessEvent(meter, 16, 1, k.finishChanges64(meter, changes))];
    const expectedKeys = [7, 4, 6, 6, 4, 5, 6, 4, 6, 5, 5, 3, 3, 4, 7, 4], cursor = k.beginEvents2048(meter);
    for (let i = 0; i < values.length; i++) { expect(Object.keys(values[i]!)).toHaveLength(expectedKeys[i]!); expect(Object.isFrozen(values[i])).toBe(true); k.appendEvents2048(meter, cursor, values[i]!); }
    const events = k.finishEvents2048(meter, cursor); expect(new Set(events.map(e => e.kind)).size).toBe(16); expect(Object.isFrozen(events)).toBe(true); k.finishA2(ticket);
  });
});
