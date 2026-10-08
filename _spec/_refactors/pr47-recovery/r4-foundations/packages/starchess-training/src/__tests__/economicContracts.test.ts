// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { advanceHistory, reconcileBoundary } from "@chess-coach/starchess-arena/events";
import type { AuthorizedBoundaryBatch, AuthorizedSnapshotV2, EconomicState } from "@chess-coach/starchess-arena/observations";
import type { EconomicArtifact, EconomicBeliefState, EconomicRecipe, Meter, PublicOpening, Table } from "../economic/contracts";
import { decodeFloat64, encodeFloat64 } from "../economic/float64";
import {
  bindStateToBoundary, bindStateToHistory, canonicalBytes, decodeArtifact, encodeArtifact, parseCanonicalBytes,
  readByteRef, referenceBytes, temperatureAt, transitionRowAdmitted, validateArtifact, validateBoundary,
  validateHistory, validateOpening, validatePartition, validateReadout, validateRecipe, validateState,
} from "../economic/schema";
import { ContractError } from "../economic/work";

const freshMeter = (): Meter => ({ limit: 1048576, used: 0 });
const H = (value: number) => encodeFloat64(value, freshMeter());
type Mutable<T> = T extends Uint8Array ? Uint8Array : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
const clone = <T>(v: T): Mutable<T> => structuredClone(v) as Mutable<T>;
const fails = (call: () => unknown, code: string, path?: string) => {
  let error: unknown; try { call(); } catch (e) { error = e; }
  expect(error).toBeInstanceOf(ContractError);
  expect(error).toMatchObject({ name: "ContractError", code, ...(path ? { path, message: `${code}: ${path}` } : {}) });
};
const opening: PublicOpening = {
  version: "starchess-economic-opening-v1", turn: 0, bank: { w: 3, b: 3 }, cc: { w: "e1", b: "e8" },
  marines: { w: ["c2", "d2", "e2", "f2"], b: ["c7", "d7", "e7", "f7"] },
};
const recipe: EconomicRecipe = {
  version: "starchess-economic-recipe-v1", supportVersion: "economic-accounting-relaxation-v1", graphVersion: "positive-headstock-suffix-v1",
  innovationVersion: "authorized-economic-innovation-v1", geometryVersion: "authorized-promotion-geometry-v1", calibrationVersion: "starchess-economic-calibration-v1",
  workCap: 1048576, materialCeiling: 576, bankCap: 12, bandStarts: [0,1,2,3,4,6,8,12,16,24,32,48,64,96,128,192,256,384,512],
  alpha: H(.5), minimumGroups: 32, diagnosticHorizons: [1,2,3],
};
const syntheticArtifact = (): EconomicArtifact => ({
  version: "starchess-economic-artifact-v1", status: "FROZEN", opening: clone(opening) as PublicOpening, recipe: clone(recipe) as EconomicRecipe,
  tables: [], partition: [[0,10,0,64],[11,20,0,64],[21,45,0,64]], temperatures: [H(1),H(.25),H(4)],
});
const backoffFixture = (rowCount: number): EconomicArtifact => {
  const rows: [number,number,number,number,number,{hex:string}][] = [];
  for (const growth of [0,2,4,6]) for (let destroyed = 0; destroyed <= 576 && rows.length < rowCount; destroyed++) rows.push([0,0,0,growth,destroyed,H(1)]);
  return { ...syntheticArtifact(), tables: [
    { kind: "transition", level: 0, bank: 3, band: 18, tier: 2, groups: rowCount, rows },
    { kind: "transition", level: 1, bank: 3, band: null, tier: 2, groups: rowCount, rows },
    { kind: "transition", level: 2, bank: 3, band: null, tier: null, groups: rowCount, rows },
    { kind: "transition", level: 3, bank: null, band: null, tier: null, groups: rowCount, rows },
  ] };
};
const testCanonicalBytes = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value, (_key, value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, (value as Record<string, unknown>)[key]])) : value));
const genuineBoundary = () => {
  const ledger: EconomicState = {
    version: "challenge-economic-ledger-v1", side: "w", ownPaidDebits: 0, ownPaidSurviving: 0, ownPaidDestroyed: 0,
    ownPaidWasted: 0, ownReplacementDestroyed: 0, enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" }, receipts: [], retiredOwnIds: [],
  };
  const ownUnits = [...opening.marines.w, opening.cc.w].sort().map(square => ({ square, piece: { type: square === "e1" ? "k" as const : "p" as const, color: "w" as const } }));
  const snapshot: AuthorizedSnapshotV2 = {
    version: "challenge-observation-v2", side: "w", turn: 0,
    own: { minerals: 3, gas: 1, gasIncome: 1, ccLives: 3, pieces: ownUnits, mines: [], siegedTanks: [] },
    cells: Array.from({ length: 64 }, (_, i) => {
      const square = `${"abcdefgh"[Math.floor(i / 8)]}${i % 8 + 1}` as AuthorizedSnapshotV2["cells"][number]["square"];
      const own = ownUnits.find(x => x.square === square);
      return own ? { square, visibility: "lit" as const, piece: own.piece } : { square, visibility: "unknown" as const };
    }), memory: [], economicState: ledger, ownMineLineage: [],
    ownUnitLineage: ownUnits.map(({ square, piece }) => ({ id: `w:unit:opening:${square}`, square, type: piece.type, paidBasis: 0, replacementValue: piece.type === "k" ? 0 : 1 })),
  };
  const batch: AuthorizedBoundaryBatch = {
    version: "challenge-boundary-batch-v1", side: "w", ordinal: 0, phase: "initial", turn: 0, planningOrdinal: 0, seqBefore: 0, seqThrough: 5,
    events: snapshot.ownUnitLineage.map((x, i) => ({ kind: "own-unit-endowed", seq: i + 1, id: x.id, square: x.square, type: x.type, paidBasis: 0 })), snapshot,
  };
  const boundary = reconcileBoundary(null, batch);
  return { boundary, history: advanceHistory(null, boundary), batch };
};
const syntheticState = (): EconomicBeliefState => {
  const { boundary } = genuineBoundary();
  const publicSupport = Array.from({ length: 7501 }, (_, i) => i === 577 * 3 + 4);
  return {
    version: "challenge-enemy-economic-belief-v1", side: "w", ordinal: 0, seqThrough: 5, planningOrdinal: 0, turn: 0,
    boundaryRef: { byteLength: boundary.lastBatchBytes.byteLength, sha256: createHash("sha256").update(boundary.lastBatchBytes).digest("hex") },
    cells: boundary.snapshot.cells, memory: [], witnessed: [], unlocated: ["c7","d7","e7","f7"], enemyCC: ["e8"],
    components: [{ bank: 3, band: 4, mass: H(1), conditional: [H(1), H(0)] }], publicSupport,
  };
};

describe("exact finite binary64", () => {
  it.each([
    [0, "0000000000000000"], [-0, "8000000000000000"], [.5, "3fe0000000000000"], [1, "3ff0000000000000"],
    [-1, "bff0000000000000"], [Number.MIN_VALUE, "0000000000000001"], [Number.MAX_VALUE, "7fefffffffffffff"],
  ] as const)("preserves %s as %s", (value, hex) => {
    expect(encodeFloat64(value, freshMeter())).toEqual({ hex });
    expect(Object.is(decodeFloat64({ hex }, freshMeter()), value)).toBe(true);
  });
  it.each(["7ff0000000000000", "fff0000000000000", "7ff8000000000000", "7ff0000000000001"])("rejects nonfinite bits %s", hex => fails(() => decodeFloat64({ hex }, freshMeter()), "NONFINITE"));
  it.each([{}, [], { hex: "0" }, { hex: "3FE0000000000000" }, { hex: "3fe000000000000g" }, { hex: 1 }, { hex: "3fe0000000000000", extra: 1 }])("rejects malformed H %j", value => fails(() => decodeFloat64(value, freshMeter()), "SCHEMA"));
  it("rejects accessors and inherited H without reading them", () => {
    let reads = 0;
    const getter = { get hex() { reads++; return "3ff0000000000000"; } };
    fails(() => decodeFloat64(getter, freshMeter()), "SCHEMA");
    fails(() => decodeFloat64(Object.create({ hex: "3ff0000000000000" }), freshMeter()), "SCHEMA");
    expect(reads).toBe(0);
  });
  it.each([NaN, Infinity, -Infinity])("rejects nonfinite encoding %s", value => fails(() => encodeFloat64(value, freshMeter()), "NONFINITE"));
});

describe("closed references, opening and recipe", () => {
  it("accepts safe boundary lengths and exact lower-case hashes", () => {
    for (const byteLength of [0, Number.MAX_SAFE_INTEGER]) expect(readByteRef({ byteLength, sha256: "a".repeat(64) }, freshMeter())).toEqual({ byteLength, sha256: "a".repeat(64) });
    for (const byteLength of [-1, -0, 1.5, Number.MAX_SAFE_INTEGER + 1]) fails(() => readByteRef({ byteLength, sha256: "0".repeat(64) }, freshMeter()), "NUMBER");
    for (const sha256 of ["0".repeat(63), "G".repeat(64), "A".repeat(64)]) fails(() => readByteRef({ byteLength: 0, sha256 }, freshMeter()), "SCHEMA");
  });
  it("detaches and recursively freezes the canonical opening and recipe", () => {
    const a = clone(opening), b = clone(recipe);
    const actualOpening = validateOpening(a, freshMeter()), actualRecipe = validateRecipe(b, freshMeter());
    Object.assign(a.marines.w, { 0: "d2" }); Object.assign(b.bandStarts, { 0: 9 });
    expect(actualOpening).toEqual(opening); expect(actualRecipe).toEqual(recipe);
    expect(Object.isFrozen(actualOpening.marines.w)).toBe(true); expect(Object.isFrozen(actualRecipe.bandStarts)).toBe(true);
  });
  it("rejects altered SCFEN-derived opening facts and recipe constants", () => {
    const a = clone(opening); a.bank.w = 4 as 3; fails(() => validateOpening(a, freshMeter()), "SCHEMA");
    const b = clone(recipe); b.alpha = H(.5001); fails(() => validateRecipe(b, freshMeter()), "NUMBER");
    const c = clone(recipe); Object.assign(c.bandStarts, { 18: 511 }); fails(() => validateRecipe(c, freshMeter()), "SCHEMA");
    const d = clone(recipe); d.workCap = 65536 as 1048576; fails(() => validateRecipe(d, freshMeter()), "SCHEMA");
  });
});

describe("synthetic FROZEN artifact validation", () => {
  it.each([1024,2048])("accepts legal %i-row backoffs at startup and charges explicit planning validation", rowCount => {
    const artifact = backoffFixture(rowCount), bytes = testCanonicalBytes(artifact);
    expect(bytes.length).toBeLessThan(1048576);
    expect(Reflect.apply(validateArtifact, undefined, [artifact])).toEqual(artifact);
    expect(Reflect.apply(decodeArtifact, undefined, [bytes])).toEqual(artifact);
    expect(Reflect.apply(encodeArtifact, undefined, [artifact])).toEqual(bytes);
    const m = freshMeter(); fails(() => validateArtifact(artifact, m), "WORK_CAP");
    expect(m.used).toBeGreaterThan(1000000); expect(m.used).toBeLessThanOrEqual(m.limit);
    fails(() => decodeArtifact(bytes, freshMeter()), "WORK_CAP");
  });
  it.each(["transition", "evidence"] as const)("rejects available %s backoffs with smaller distinct-group qualification", kind => {
    const a = clone(syntheticArtifact());
    const rows = kind === "transition" ? [[0,0,0,0,0,H(32)]] : [[0,0,0,H(32)]];
    const parentRows = kind === "transition" ? [[0,0,0,0,0,H(1)]] : [[0,0,0,H(1)]];
    Object.assign(a, { tables: [
      { kind, level:0, bank:3, band:4, tier:0, groups:32, rows },
      { kind, level:3, bank:null, band:null, tier:null, groups:1, rows:parentRows },
    ] });
    fails(() => validateArtifact(a, freshMeter()), "CONSISTENCY");
  });
  it.each([1,2,3])("rejects known aggregate counts exceeding available parent level %i", level => {
    const a = clone(syntheticArtifact());
    a.tables = [
      { kind:"transition", level:0, bank:3, band:4, tier:0, groups:2, rows:[[0,0,0,0,0,H(2)]] },
      { kind:"transition", level:0, bank:3, band:5, tier:0, groups:2, rows:[[0,0,0,0,0,H(2)]] },
      { kind:"transition", level, bank:level === 3 ? null : 3, band:null, tier:level === 1 ? 0 : null, groups:4, rows:[[0,0,0,0,0,H(3)]] },
    ];
    fails(() => validateArtifact(a, freshMeter()), "CONSERVATION");
  });
  it("allows overlapping ancestry groups and skips absent parent tables without inventing a roster", () => {
    const a = clone(syntheticArtifact());
    a.tables = [
      { kind:"transition", level:0, bank:3, band:4, tier:0, groups:32, rows:[[0,0,0,0,0,H(16)]] },
      { kind:"transition", level:0, bank:3, band:5, tier:0, groups:32, rows:[[0,0,0,0,0,H(16)]] },
      { kind:"transition", level:3, bank:null, band:null, tier:null, groups:32, rows:[[0,0,0,0,0,H(32)]] },
    ];
    expect(validateArtifact(a, freshMeter()).tables).toEqual(a.tables);
    a.tables.pop(); expect(validateArtifact(a, freshMeter()).tables).toEqual(a.tables);
  });
  it("rejects a child row missing from an available parent and respects cohort/kind boundaries", () => {
    const a = clone(syntheticArtifact());
    a.tables = [
      { kind:"transition", level:0, bank:3, band:4, tier:0, groups:1, rows:[[0,0,0,0,0,H(1)]] },
      { kind:"transition", level:2, bank:3, band:null, tier:null, groups:1, rows:[[0,0,0,0,1,H(1)]] },
    ];
    fails(() => validateArtifact(a, freshMeter()), "CONSERVATION");
    a.tables[1]!.bank = 4; expect(validateArtifact(a, freshMeter()).tables).toEqual(a.tables);
    a.tables[1] = { kind:"evidence", level:3, bank:null, band:null, tier:null, groups:0, rows:[] };
    expect(validateArtifact(a, freshMeter()).tables).toEqual(a.tables);
  });
  it("round-trips canonical bytes without making a calibration claim", () => {
    const artifact = syntheticArtifact(), encoded = encodeArtifact(artifact, freshMeter());
    expect(decodeArtifact(encoded, freshMeter())).toEqual(artifact);
    expect(Object.isFrozen(validateArtifact(artifact, freshMeter()).tables)).toBe(true);
    expect(new TextDecoder().decode(encoded)).not.toContain("\n");
  });
  it("accepts every exact temperature grid value", () => {
    for (let i = 0; i <= 1000; i++) {
      const artifact = clone(syntheticArtifact()); artifact.temperatures[0] = H(temperatureAt(i, freshMeter()));
      expect(validateArtifact(artifact, freshMeter()).temperatures[0]).toEqual(artifact.temperatures[0]);
    }
  });
  it("rejects an off-grid temperature and version/status substitutions", () => {
    const a = clone(syntheticArtifact()); a.temperatures[0] = H(1.00001); fails(() => validateArtifact(a, freshMeter()), "DERIVED");
    const b = clone(syntheticArtifact()); Object.assign(b, { status: "VALID" }); fails(() => validateArtifact(b, freshMeter()), "SCHEMA");
    Object.assign(b, { version: "starchess-training-artifact-v1" }); fails(() => validateArtifact(b, freshMeter()), "VERSION");
  });
  it("validates closed positive counts, empty groups and row ordering", () => {
    const table: Table = { kind: "transition", level: 3, bank: null, band: null, tier: null, groups: 32, rows: [[0,0,0,0,0,H(1)], [1,1,0,2,1,H(.5)]] };
    const a = clone(syntheticArtifact()); a.tables = clone([table]); expect(validateArtifact(a, freshMeter()).tables).toEqual([table]);
    a.tables[0]!.groups = 0; fails(() => validateArtifact(a, freshMeter()), "NUMBER");
    a.tables = clone([{ ...table, rows: [] }]); fails(() => validateArtifact(a, freshMeter()), "CONSISTENCY");
    a.tables = clone([{ ...table, rows: [...table.rows].reverse() }]); fails(() => validateArtifact(a, freshMeter()), "ORDER");
    a.tables = clone([{ ...table, rows: [table.rows[0]!, table.rows[0]!] }]); fails(() => validateArtifact(a, freshMeter()), "ORDER");
    a.tables = clone([{ ...table, rows: [[0,0,0,0,0,H(33)]] }]); fails(() => validateArtifact(a, freshMeter()), "NUMBER");
    a.tables = clone([{ ...table, rows: [[0,0,0,0,0,H(20)], [1,1,0,0,0,H(20)]] }]); fails(() => validateArtifact(a, freshMeter()), "CONSERVATION");
  });
  it("rejects impossible accounting and cohort domains", () => {
    const cohort = { bank: 1, band: 0, tier: 0 };
    for (const row of [[3,3,0,0,0,H(1)], [1,0,0,0,0,H(1)], [0,0,0,1,0,H(1)], [0,0,0,2,0,H(1)], [0,0,0,0,1,H(1)]] as const) {
      expect(transitionRowAdmitted(row, cohort, freshMeter(), "$"), JSON.stringify(row)).toBe(false);
    }
    expect(transitionRowAdmitted([1,1,0,8,9,H(1)], cohort, freshMeter(), "$")).toBe(true);
    expect(transitionRowAdmitted([0,0,0,32,0,H(1)], { bank: null, band: 0, tier: null }, freshMeter(), "$")).toBe(false);
    const a = clone(syntheticArtifact()); a.tables = [{ kind: "evidence", level: 1, bank: 3, band: 4, tier: 0, groups: 1, rows: [] }];
    fails(() => validateArtifact(a, freshMeter()), "SCHEMA");
    a.tables = [{ kind: "transition", level: 0, bank: 0, band: 0, tier: 0, groups: 1, rows: [[1,1,0,0,0,H(1)]] }];
    fails(() => validateArtifact(a, freshMeter()), "CONSERVATION");
  });
  it("enforces kind-matched rows, global table/row bounds and table ordering", () => {
    const a = clone(syntheticArtifact());
    a.tables = [{ kind: "evidence", level: 3, bank: null, band: null, tier: null, groups: 1, rows: [[0,0,0,H(1)]] }];
    expect(validateArtifact(a, freshMeter()).tables).toHaveLength(1);
    (a.tables[0]!.rows as unknown[]) = [[0,0,0,0,0,H(1)]];
    fails(() => validateArtifact(a, freshMeter()), "CARDINALITY");
    a.tables = Array.from({ length: 1589 }, () => ({ kind: "evidence" as const, level: 3, bank: null, band: null, tier: null, groups: 0, rows: [] }));
    fails(() => validateArtifact(a, freshMeter()), "CARDINALITY");
    a.tables = [{ kind: "transition", level: 3, bank: null, band: null, tier: null, groups: 1, rows: Array.from({ length: 8193 }, () => [0,0,0,0,0,H(1)] as [number,number,number,number,number,{hex:string}]) }];
    fails(() => validateArtifact(a, freshMeter()), "CARDINALITY");
    const row = [0,0,0,0,0,H(1)] as [number,number,number,number,number,{hex:string}];
    a.tables = [
      { kind: "transition", level: 2, bank: 0, band: null, tier: null, groups: 1, rows: Array.from({ length: 4096 }, () => row) },
      { kind: "transition", level: 2, bank: 1, band: null, tier: null, groups: 1, rows: Array.from({ length: 4097 }, () => row) },
    ];
    fails(() => validateArtifact(a, freshMeter()), "CARDINALITY", "$.tables[1].rows");
    a.tables = [{ kind: "evidence", level: 3, bank: null, band: null, tier: null, groups: 0, rows: [] }, { kind: "transition", level: 3, bank: null, band: null, tier: null, groups: 0, rows: [] }];
    fails(() => validateArtifact(a, freshMeter()), "ORDER");
  });
  it("checks merge-tree partition coverage, tiers, order and temperature cardinality", () => {
    expect(validatePartition([[0,10,0,15],[0,10,16,31],[0,10,32,64],[11,20,0,64],[21,45,0,64]], freshMeter())).toHaveLength(5);
    for (const partition of [
      [[0,10,0,31],[0,10,16,64],[11,20,0,64],[21,45,0,64]],
      [[0,11,0,64],[11,20,0,64],[21,45,0,64]],
      [[0,10,0,32],[11,20,0,64],[21,45,0,64]],
    ]) fails(() => validatePartition(partition, freshMeter()), partition[0]![1] === 11 ? "ORDER" : partition[0]![3] === 32 ? "NUMBER" : "ORDER");
    const a = clone(syntheticArtifact()); a.temperatures.pop(); fails(() => validateArtifact(a, freshMeter()), "CARDINALITY");
  });
  it("rejects getters, cycles, sparse/extraneous arrays and inherited records", () => {
    let reads = 0;
    const getter = () => { reads++; throw new Error("executed"); };
    for (const mutate of [
      (a: Mutable<EconomicArtifact>) => Object.defineProperty(a, "opening", { enumerable: true, get: getter }),
      (a: Mutable<EconomicArtifact>) => Object.defineProperty(a.recipe.alpha, "hex", { enumerable: true, get: getter }),
      (a: Mutable<EconomicArtifact>) => Object.defineProperty(a.temperatures, "0", { enumerable: true, get: getter }),
      (a: Mutable<EconomicArtifact>) => Object.assign(a.recipe, { alpha: a.recipe }),
      (a: Mutable<EconomicArtifact>) => Object.setPrototypeOf(a.opening, opening),
      (a: Mutable<EconomicArtifact>) => Object.assign(a.partition, { extra: 1 }),
      (a: Mutable<EconomicArtifact>) => { delete a.partition[0]; },
      (a: Mutable<EconomicArtifact>) => Object.assign(a, { [Symbol("extra")]: 1 }),
    ]) { const a = clone(syntheticArtifact()); mutate(a); expect(() => validateArtifact(a, freshMeter())).toThrow(ContractError); }
    expect(reads).toBe(0);
  });
  it.each([
    " {\"a\":1}", "{\"a\":1}\n", "{\"a\":1,\"a\":2}", "{\"b\":1,\"a\":2}", "[1,]", "01", "1e999", "\ufeff{}",
  ])("rejects malformed or noncanonical bytes %s", text => expect(() => parseCanonicalBytes(new TextEncoder().encode(text), freshMeter())).toThrow(ContractError));
  it("checks raw lengths and typed-byte descriptors before parsing", () => {
    fails(() => decodeArtifact(new Uint8Array(1048577), freshMeter()), "SIZE");
    fails(() => decodeArtifact(new Uint8Array([0xc0,0x80]), freshMeter()), "JSON");
    const bytes = new Uint8Array([123,125]); let reads = 0;
    Object.defineProperty(bytes, "byteLength", { get() { reads++; return 0; } });
    fails(() => parseCanonicalBytes(bytes, freshMeter()), "SCHEMA");
    expect(reads).toBe(0);
    fails(() => parseCanonicalBytes(new Uint8Array(new SharedArrayBuffer(2)), freshMeter()), "SCHEMA");
  });
  it("matches native SHA-256 of physical canonical public bytes", () => {
    for (const value of [null, [], { z: 9, a: [true,false,"é","😀","\n","\ud800"] }, syntheticArtifact()]) {
      const bytes = canonicalBytes(value, freshMeter());
      const ref = referenceBytes(bytes, freshMeter());
      expect(ref).toEqual({ byteLength: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
      expect(parseCanonicalBytes(bytes, freshMeter())).toEqual(value);
    }
    expect(referenceBytes(new Uint8Array(), freshMeter()).sha256).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("genuine checked boundary and economic state", () => {
  it("validates arena-reconciled bytes and the exact fourteen-key state", () => {
    const { boundary, history } = genuineBoundary(), state = syntheticState();
    const m = freshMeter();
    const checked = validateBoundary(boundary, m), h = validateHistory(history, m), s = validateState(state, m);
    bindStateToBoundary(s, checked, m); bindStateToHistory(s, h, m);
    expect(s).toEqual(state); expect(s.publicSupport).toHaveLength(7501);
    expect(Object.keys(s).sort()).toEqual(["version","side","ordinal","seqThrough","planningOrdinal","turn","boundaryRef","cells","memory","witnessed","unlocated","enemyCC","components","publicSupport"].sort());
    expect(checked.lastBatchBytes).not.toBe(boundary.lastBatchBytes);
    expect(Object.keys(checked).sort()).toEqual(Object.keys(boundary).sort());
  });
  it("does not apply the V1 8192-visit limit to 7501 public support bits", () => {
    const a = clone(syntheticState()); a.publicSupport = a.publicSupport.map((_, i) => i % 577 <= 522);
    const state = validateState(a, freshMeter()); expect(state.publicSupport.filter(Boolean)).toHaveLength(13 * 523);
    a.publicSupport[0] = false; expect(state.publicSupport[0]).toBe(true);
  });
  it("rejects noncanonical boundary bytes, snapshot disagreement and mismatched refs", () => {
    const { boundary } = genuineBoundary(); const a = clone(boundary);
    a.lastBatchBytes = new TextEncoder().encode(new TextDecoder().decode(a.lastBatchBytes) + "\n"); fails(() => validateBoundary(a, freshMeter()), "JSON");
    const b = clone(boundary); b.seqThrough++; fails(() => validateBoundary(b, freshMeter()), "CONSISTENCY");
    const c = clone(syntheticState()); c.boundaryRef.sha256 = "0".repeat(64); fails(() => bindStateToBoundary(c, boundary, freshMeter()), "CONSISTENCY");
    const d = clone(syntheticState()); d.ordinal = 1; fails(() => bindStateToBoundary(d, boundary, freshMeter()), "CONSISTENCY");
  });
  it("rejects array, field, numerical, spatial and PMF violations", () => {
    for (const mutate of [
      (a: Mutable<EconomicBeliefState>) => a.publicSupport.pop(),
      (a: Mutable<EconomicBeliefState>) => { delete a.publicSupport[0]; },
      (a: Mutable<EconomicBeliefState>) => { a.publicSupport[1735] = false; },
      (a: Mutable<EconomicBeliefState>) => { a.components[0]!.conditional = [H(.5),H(.4)]; },
      (a: Mutable<EconomicBeliefState>) => { a.components[0]!.mass = H(0); },
      (a: Mutable<EconomicBeliefState>) => { a.components.push(a.components[0]!); },
      (a: Mutable<EconomicBeliefState>) => { a.enemyCC = []; },
      (a: Mutable<EconomicBeliefState>) => { a.enemyCC = ["e1"]; },
      (a: Mutable<EconomicBeliefState>) => { a.witnessed = ["d7","c7"]; },
      (a: Mutable<EconomicBeliefState>) => { a.planningOrdinal = 64; },
      (a: Mutable<EconomicBeliefState>) => Object.assign(a, { privateBank: 3 }),
    ]) { const a = clone(syntheticState()); mutate(a); expect(() => validateState(a, freshMeter())).toThrow(ContractError); }
  });
  it("checks band widths, 247-component ceiling and positive underflow", () => {
    const a = clone(syntheticState()); a.components[0]!.conditional.push(H(0)); fails(() => validateState(a, freshMeter()), "CARDINALITY");
    a.components = Array.from({ length: 248 }, () => clone(syntheticState().components[0]!)); fails(() => validateState(a, freshMeter()), "CARDINALITY");
    const b = clone(syntheticState()); b.components[0]!.mass = H(Number.MIN_VALUE); b.components[0]!.conditional = [H(.5),H(.5)]; b.publicSupport[1736] = true;
    fails(() => validateState(b, freshMeter()), "NUMERIC");
  });
  it("validates readout quantile order, conservation and interval formula", () => {
    const r = { version: "starchess-economic-readout-v1", boundaryRef: syntheticState().boundaryRef, meanD: H(4), meanPotential: H(7), quantilesD: [4,4,4,4], quantilesPotential: [7,7,7,7], balance: H(0), uncertainty: H(0) };
    expect(validateReadout(r, freshMeter())).toEqual(r);
    fails(() => validateReadout({ ...r, quantilesD: [5,4,4,4] }, freshMeter()), "ORDER");
    fails(() => validateReadout({ ...r, uncertainty: H(1) }, freshMeter()), "DERIVED");
    fails(() => validateReadout({ ...r, meanPotential: H(17) }, freshMeter()), "CONSERVATION");
  });
});
