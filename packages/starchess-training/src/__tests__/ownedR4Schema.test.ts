// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { validateBoundaryBatch } from "@chess-coach/starchess-arena/events";
import { decodeCandidate } from "@chess-coach/starchess-arena/intent-codec-v1";
import * as k from "../economic/ownedKernel";
import * as s from "../economic/ownedR4Schema";
import { encodeOwnedNumber } from "../economic/ownedScalars";
import { featureManifestV3, featureRegistryV3, SCALES_V3 } from "../feature/manifest";

const planning = () => {
  const pair = k.createPlanningLedger(); pair.owner.admitOnce(); pair.owner.armInitialize();
  return { ...pair, ticket: k.enterA2(pair.meter, "initialize") };
};
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value !== null && typeof value === "object" ?
  `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}` : JSON.stringify(value);
const bytes = (value: unknown) => new TextEncoder().encode(canonical(value));
const startup = k.createStartupArtifactContext;
const ref = () => k.constructRef(23, "a".repeat(64));
const makeArtifact = (c: k.StartupArtifactContext) => {
  const partition = k.beginPartition(c); for (const [lo, hi] of [[0, 10], [11, 20], [21, 45]]) k.appendPartition(c, partition, k.makePartitionBin(c, lo!, hi!, 0, 64));
  const bins = k.finishPartition(c, partition), temperatures = k.beginTemperatures(c, bins); for (let i = 0; i < 3; i++) k.appendTemperatures(c, temperatures, encodeOwnedNumber(1));
  const rows = k.beginTransitionRows8192(c); k.appendTransitionRows8192(c, rows, k.makeTransitionRow(c, 1, 1, 0, 0, 0, encodeOwnedNumber(1)));
  const tables = k.beginTables1588(c); k.appendTables1588(c, tables, k.makeTransitionTable(c, 0, 3, 4, 0, 1, k.finishTransitionRows8192(c, rows)));
  return k.makeEconomicArtifact(c, k.constructCanonicalOpening(), k.makeEconomicRecipe(c, encodeOwnedNumber(.5)), k.finishTables1588(c, tables), bins, k.finishTemperatures(c, temperatures));
};
const rawBatch = () => {
  const slots = { __proto__: null, length: 64 }, cells = Array.from(slots, (_, i) => {
    const square = `${"abcdefgh"[Math.floor(i / 8)]}${i % 8 + 1}`;
    return square === "e1" ? { square, visibility: "lit", piece: { type: "k", color: "w" } } : { square, visibility: "unknown" };
  });
  const economicState = { version: "challenge-economic-ledger-v1", side: "w", ownPaidDebits: 0, ownPaidSurviving: 0, ownPaidDestroyed: 0, ownPaidWasted: 0, ownReplacementDestroyed: 0,
    enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" }, receipts: [], retiredOwnIds: [] };
  return validateBoundaryBatch({ version: "challenge-boundary-batch-v1", side: "w", ordinal: 0, phase: "initial", turn: 0, planningOrdinal: 0, seqBefore: 0, seqThrough: 1,
    events: [{ kind: "own-unit-endowed", seq: 1, id: "w:unit:opening:e1", square: "e1", type: "k", paidBasis: 0 }],
    snapshot: { version: "challenge-observation-v2", side: "w", turn: 0, own: { minerals: 3, gas: 1, gasIncome: 1, ccLives: 3, pieces: [{ square: "e1", piece: { type: "k", color: "w" } }], mines: [], siegedTanks: [] },
      cells, memory: [], ownUnitLineage: [{ id: "w:unit:opening:e1", square: "e1", type: "k", paidBasis: 0, replacementValue: 0 }], ownMineLineage: [], economicState } });
};

describe("closed R4 canonical byte decoders", () => {
  it("round-trips every startup root through the one kernel", () => {
    const c = startup(), r = ref(), a = makeArtifact(c), m = k.makeCanonicalManifestV3(c), pin = k.makeEconomicPin(c, r, r, r, r), binding = k.makeEconomicBinding(c, r, r, r, r, r),
      p = k.makeEstimatorProvenance(c, r, r, r, r, r, r, r, r, r, r), authority = k.makeEconomicAuthority(c, r, r, r, r, r, r, r),
      validation = k.makeValidation(c, encodeOwnedNumber(1e-6), encodeOwnedNumber(1e-8), encodeOwnedNumber(1e-5)),
      configuration = k.makeConfiguration418(c, encodeOwnedNumber(.001), encodeOwnedNumber(1), encodeOwnedNumber(.0001), r, k.makeHostLimits(c), validation),
      recipe = k.makeTrainingRecipe(c, configuration, k.makeVersions418(c), r);
    const cases = [
      ["economicArtifact", a, s.decodeOwnedEconomicArtifact, k.requireArtifact], ["featureManifest", m, s.decodeOwnedFeatureManifest, k.requireManifest],
      ["pin", pin, s.decodeOwnedPin, k.requireEconomicPin], ["binding", binding, s.decodeOwnedBinding, k.requireEconomicBinding],
      ["estimatorProvenance", p, s.decodeOwnedEstimatorProvenance, k.requireEstimatorProvenance], ["authority", authority, s.decodeOwnedAuthority, k.requireEconomicAuthority],
      ["trainingRecipe", recipe, s.decodeOwnedTrainingRecipe, k.requireTrainingRecipe],
    ] as const;
    for (const [production, value, decode, guard] of cases) {
      const decoded = decode(c, k.snapshotFixedBytes(bytes(value), production));
      expect(decoded).toEqual(value); expect(guard(decoded)).toBe(decoded); expect(Object.isFrozen(decoded)).toBe(true);
    }
    expect(Object.keys(recipe.configuration)).toHaveLength(26); expect(Object.keys(recipe.versions)).toHaveLength(21);
  });
  it("preserves every original 370 name/scale and every appended 418 entry", () => {
    const { meter, ticket } = planning(), registry = featureRegistryV3(meter), historical = { version: "challenge-feature-manifest-v3", dimension: 418,
      names: registry.map(r => r.name), entries: registry.map(r => ({ name: r.name, meaningId: r.meaningId, scaleId: r.scaleId })), scales: SCALES_V3 },
      c = startup(), owned = k.makeCanonicalManifestV3(c);
    expect(owned).toEqual(historical); expect(owned.names.slice(0, 370)).toEqual(historical.names.slice(0, 370)); k.finishA2(ticket);
    expect(featureManifestV3(c)).toEqual(owned); expect(registry[369]!.formula).toBe("protection.units*D"); expect(registry[370]!.formula).toBe("S*b");
    expect(s.decodeOwnedFeatureManifest(c, k.snapshotFixedBytes(bytes(owned), "featureManifest"))).toEqual(historical);
  });
  it("decodes planning batch/history only with active admitted accounting", () => {
    const batch = rawBatch(), scope = planning(), snapshot = k.snapshotFixedBytes(bytes(batch), "boundaryBatch", scope.meter), decoded = s.decodeOwnedBoundaryBatch(scope.meter, snapshot);
    expect(decoded).toEqual(batch); expect(k.requireSnapshotV2(decoded.snapshot)).toBe(decoded.snapshot); expect(Object.isFrozen(decoded.events[0])).toBe(true); k.finishA2(scope.ticket);
    const next = planning(), rawHistory = { version: "challenge-history-v2", currentAuthorizedSnapshotV2: batch.snapshot, economicState: batch.snapshot.economicState, everLit: ["e1"] },
      history = s.decodeOwnedHistory(next.meter, k.snapshotFixedBytes(bytes(rawHistory), "history", next.meter));
    expect(history).toEqual(rawHistory); expect(history.economicState).toBe(history.currentAuthorizedSnapshotV2.economicState); k.finishA2(next.ticket);
    expect(() => s.decodeOwnedBoundaryBatch({ limit: 1048576, used: 0 }, snapshot)).toThrow("PROVENANCE");
  });
  it("round-trips all seven candidate action kinds and authored optional fields", () => {
    const { meter, ticket } = planning(), cursor = k.beginActions65(meter);
    const actions = [k.makeClassicalAction(meter, "b", "a7", "a8", "p"), k.makeDeployAction(meter, "B", "b", "e8", "c7", "p"),
      k.makeStimStepAction(meter, "F", "b", "c7", "c8", "q"), k.makeSpiderMineAction(meter, "B", "b", "c7", "c6"),
      k.makeCharonMissilesAction(meter, "F", "b", "g7", "g6"), k.makeSiegeModeAction(meter, "B", "b", "h8"), k.makeTacticalJumpAction(meter, "F", "b", "f7", "f6")];
    for (const action of actions) k.appendActions65(meter, cursor, action);
    const candidate = k.makeCandidate(meter, "b", k.finishActions65(meter, cursor)), physical = k.encodeOwnedCandidate(meter, candidate);
    expect(decodeCandidate(candidate, "b")).toEqual(candidate);
    const decoded = s.decodeOwnedCandidate(meter, k.snapshotFixedBytes(physical, "candidate", meter), "b");
    expect(decoded).toEqual(candidate); expect(k.requireCandidate(decoded)).toBe(decoded); k.finishA2(ticket);
  });
  it.each([
    ['duplicate', (text: string) => text.replace('"amendmentRef":', '"amendmentRef":null,"amendmentRef":')],
    ['unknown', (text: string) => text.replace('"version":', '"unexpected":0,"version":')],
    ['missing', (text: string) => text.replace(/,"version":"[^"]+"/, '')],
    ['whitespace', (text: string) => ` ${text}`],
    ['trailing', (text: string) => `${text}\n`],
    ['leading zero', (text: string) => text.replace('"byteLength":23', '"byteLength":023')],
    ['negative zero', (text: string) => text.replace('"byteLength":23', '"byteLength":-0')],
    ['noncanonical escape', (text: string) => text.replace('"version"', '"\\u0076ersion"')],
    ['invalid hex', (text: string) => text.replace('a'.repeat(64), 'A'.repeat(64))],
  ] as const)("rejects %s before admitting a startup pin", (_, mutate) => {
    const c = startup(), r = ref(), text = canonical(k.makeEconomicPin(c, r, r, r, r));
    expect(() => s.decodeOwnedPin(c, k.snapshotFixedBytes(new TextEncoder().encode(mutate(text)), "pin"))).toThrow();
  });
  it("rejects malformed UTF8, deep nesting and oversized tokens", () => {
    const c = startup(), r = ref(), physical = bytes(k.makeEconomicPin(c, r, r, r, r)), malformed = physical.slice(); malformed[2] = 255;
    expect(() => s.decodeOwnedPin(c, k.snapshotFixedBytes(malformed, "pin"))).toThrow("UTF8");
    for (const text of ['{"amendmentRef":' + '['.repeat(20) + '0' + ']'.repeat(20) + '}', '{"' + 'x'.repeat(1000) + '":0}'])
      expect(() => s.decodeOwnedPin(c, k.snapshotFixedBytes(new TextEncoder().encode(text), "pin"))).toThrow();
  });
  it("rejects excessive cardinality before any receiving piece construction", () => {
    const batch = rawBatch(), malformed = { ...batch, snapshot: { ...batch.snapshot, cells: [...batch.snapshot.cells, batch.snapshot.cells[0]] } }, { meter } = planning();
    const snapshot = k.snapshotFixedBytes(bytes(malformed), "boundaryBatch", meter), ctor = vi.spyOn(k, "makePiece");
    try { expect(() => s.decodeOwnedBoundaryBatch(meter, snapshot)).toThrow("CARDINALITY"); expect(ctor).not.toHaveBeenCalled(); }
    finally { ctor.mockRestore(); }
  });
  it("reports real fixed-cap exhaustion before parse allocations and retains earlier snapshot debits", () => {
    const { meter } = planning(), physical = new Uint8Array(20000), snapshot = k.snapshotFixedBytes(physical, "candidate", meter), before = meter.used,
      ctor = vi.spyOn(k, "makeCandidate");
    try {
      expect(() => s.decodeOwnedCandidate(meter, snapshot)).toThrow("WORK_CAP");
      expect(ctor).not.toHaveBeenCalled(); expect(meter.limit).toBe(1048576); expect(meter.used).toBe(before);
    } finally { ctor.mockRestore(); }
  });
  it("checks manifest semantics, partition coverage, temperature grid and recipe constants", () => {
    const c = startup(), manifest = k.makeCanonicalManifestV3(c), bad = { ...manifest, names: [...manifest.names] }; bad.names[370] = "changed";
    expect(() => s.decodeOwnedFeatureManifest(c, k.snapshotFixedBytes(bytes(bad), "featureManifest"))).toThrow("CANONICAL");
    const a = makeArtifact(c);
    for (const changed of [{ ...a, temperatures: [encodeOwnedNumber(.3), ...a.temperatures.slice(1)] }, { ...a, recipe: { ...a.recipe, alpha: encodeOwnedNumber(.6) } },
      { ...a, partition: [[0, 10, 0, 15], [11, 20, 0, 64], [21, 45, 0, 64]] }])
      expect(() => s.decodeOwnedEconomicArtifact(c, k.snapshotFixedBytes(bytes(changed), "economicArtifact"))).toThrow();
  });
  it("rejects startup/planning confusion and raw carrier aliases without inspecting them", () => {
    const c = startup(), r = ref(), pin = k.snapshotFixedBytes(bytes(k.makeEconomicPin(c, r, r, r, r)), "pin");
    expect(() => s.decodeOwnedPin({} as k.StartupArtifactContext, pin)).toThrow("PROVENANCE");
    let touched = 0;
    const proxy = new Proxy({}, { get() { touched++; return undefined; }, ownKeys() { touched++; return []; } });
    expect(() => s.decodeOwnedPin(c, proxy)).toThrow("PROVENANCE"); expect(touched).toBe(0);
    const alias = bytes(k.makeEconomicPin(c, r, r, r, r)), frozen = k.snapshotFixedBytes(alias, "pin"); alias.fill(0);
    expect(s.decodeOwnedPin(c, frozen).economicArtifactRef).toEqual(r);
  });
  it("fixes physical 1MiB/16MiB caps and exposes no unrestricted parser/adopter", () => {
    expect(k.BYTE_PRODUCTION_LIMITS.boundaryBatch).toBe(1048576); expect(k.BYTE_PRODUCTION_LIMITS.economicArtifact).toBe(1048576); expect(k.BYTE_PRODUCTION_LIMITS.completion).toBe(16777216);
    expect(() => k.snapshotFixedBytes(new Uint8Array(1048577), "pin")).toThrow("BYTES");
    const snapshot = k.snapshotFixedBytes(new Uint8Array(16777216), "completion"); expect(k.snapshotLength(snapshot)).toBe(16777216);
    const source = readFileSync(new URL("../economic/ownedR4Schema.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/JSON\.(?:parse|stringify)|Reflect\.|Object\.(?:keys|values|entries|getPrototypeOf)|structuredClone|coordinator\//);
    expect(source).not.toMatch(/\b(?:createPlanningLedger|LedgerPair|LedgerOwner)\b|import\s+\*\s+as/);
    expect(Object.keys(s).sort()).toEqual(["decodeOwnedAuthority", "decodeOwnedBinding", "decodeOwnedBoundaryBatch", "decodeOwnedCandidate", "decodeOwnedEconomicArtifact", "decodeOwnedEstimatorProvenance", "decodeOwnedFeatureManifest", "decodeOwnedHistory", "decodeOwnedPin", "decodeOwnedTrainingRecipe"]);
  });
});
