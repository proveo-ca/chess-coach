// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import jsSHA from "jssha/sha256";
import { validateBoundaryBatch as readBatch } from "@chess-coach/starchess-arena/events";
import * as k from "../economic/ownedKernel";
import { decodeOwnedBoundaryBatch } from "../economic/ownedR4Schema";
import { encodeOwnedNumber } from "../economic/ownedScalars";
import type { Meter, Square, CheckedBoundary } from "../economic/contracts";

const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value !== null && typeof value === "object" ?
  `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}` : JSON.stringify(value);
const publicBytes = (value: unknown): Uint8Array => new TextEncoder().encode(canonical(value));

const planning = () => {
  const pair = k.createPlanningLedger(); pair.owner.admitOnce(); pair.owner.armInitialize();
  return { ...pair, ticket: k.enterA2(pair.meter, "initialize") };
};
const fixture = (mine = true) => {
  const economicState = { version: "challenge-economic-ledger-v1", side: "w", ownPaidDebits: 0, ownPaidSurviving: 0, ownPaidDestroyed: 0, ownPaidWasted: 0,
    ownReplacementDestroyed: 0, enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" }, receipts: [], retiredOwnIds: [] };
  const slots = { __proto__: null, length: 64 };
  const cells = Array.from(slots, (_, i) => {
    const square = `${"abcdefgh"[Math.floor(i / 8)]}${i % 8 + 1}`;
    return square === "e1" ? { square, visibility: "lit", piece: { type: "k", color: "w" } } : { square, visibility: "unknown" };
  });
  const snapshot = { version: "challenge-observation-v2", side: "w", turn: 0,
    own: { minerals: 3, gas: 1, gasIncome: 1, ccLives: 3, pieces: [{ square: "e1", piece: { type: "k", color: "w" } }], mines: mine ? ["e1"] : [], siegedTanks: [] },
    cells, memory: [], ownUnitLineage: [{ id: "w:unit:opening:e1", square: "e1", type: "k", paidBasis: 0, replacementValue: 0 }],
    ownMineLineage: mine ? [{ mineId: "w:mine:opening:e1", square: "e1" }] : [], economicState };
  const events = [{ kind: "own-unit-endowed", seq: 1, id: "w:unit:opening:e1", square: "e1", type: "k", paidBasis: 0 },
    ...(mine ? [{ kind: "own-mine-endowed", seq: 2, mineId: "w:mine:opening:e1", actionRef: null, square: "e1" }] : [])];
  return readBatch({ version: "challenge-boundary-batch-v1", side: "w", ordinal: 0, phase: "initial", turn: 0, planningOrdinal: 0, seqBefore: 0, seqThrough: events.length, events, snapshot });
};
const ownedBoundary = (c: Meter, raw: ReturnType<typeof readBatch>, retired: readonly string[] = []): CheckedBoundary => {
  const snapshot = k.snapshotFixedBytes(publicBytes(raw), "boundaryBatch", c), batch = decodeOwnedBoundaryBatch(c, snapshot), verified = k.completeBoundaryBatchBytes(c, snapshot, batch);
  const retiredCursor = k.beginRetiredMineIds195(c, "w"); for (const id of retired) k.appendRetiredMineIds195(c, retiredCursor, id);
  const audit = k.makeMineAudit(c, batch.snapshot.ownMineLineage, k.finishRetiredMineIds195(c, retiredCursor), 0), lit = k.beginSquareSet64(c);
  for (const cell of batch.snapshot.cells) if (cell.visibility === "lit") k.appendSquareSet64(c, lit, cell.square);
  return k.makeBoundary(c, batch.snapshot, batch.snapshot.economicState, audit, k.finishSquareSet64(c, lit), batch.ordinal, batch.phase, batch.planningOrdinal, batch.seqThrough, verified);
};
const stateAt = (c: Meter, boundary: CheckedBoundary) => {
  const squares = () => k.finishSquareSet64(c, k.beginSquareSet64(c)), cc = k.beginSquareSet64(c); k.appendSquareSet64(c, cc, "e8");
  const conditional = k.beginConditional(c, 1), one = k.constructFloat64Hex("3ff0000000000000"); k.appendConditional(c, conditional, one);
  const components = k.beginComponents247(c); k.appendComponents247(c, components, k.makeComponent(c, 3, 3, one, k.finishConditional(c, conditional)));
  const support = k.beginPublicSupport7501(c); for (let i = 0; i < 7501; i++) k.appendPublicSupport7501(c, support, i === 3 * 577 + 3);
  return k.makeEconomicState(c, boundary, "w", boundary.ordinal, boundary.seqThrough, boundary.planningOrdinal, boundary.snapshot.turn, k.boundaryRef(boundary), boundary.snapshot.cells,
    boundary.snapshot.memory, squares(), squares(), k.finishSquareSet64(c, cc), k.finishComponents247(c, components), k.finishPublicSupport7501(c, support));
};

describe("verified public boundary sources", () => {
  it("retains exact nine-field boundaries and hashes the physical public bytes", () => {
    const { meter, ticket } = planning(), raw = fixture(), boundary = ownedBoundary(meter, raw), ref = k.boundaryRef(boundary);
    expect(Object.keys(boundary).sort()).toEqual(["economicState", "everLit", "lastBatchBytes", "ordinal", "ownMineAuditState", "phase", "planningOrdinal", "seqThrough", "snapshot"]);
    expect(ref).toEqual({ byteLength: publicBytes(raw).length, sha256: createHash("sha256").update(publicBytes(raw)).digest("hex") });
    expect(k.boundaryBatch(boundary)).toEqual(raw); expect(k.batchForBoundaryRef(ref)).toBe(k.boundaryBatch(boundary));
    const physical = canonical(raw); expect(new TextDecoder().decode(boundary.lastBatchBytes)).toBe(physical);
    boundary.lastBatchBytes.fill(0);
    expect(k.boundaryBatch(boundary)).toEqual(raw); expect(k.boundaryRef(boundary)).toBe(ref);
    expect(() => k.requireSnapshot(boundary.lastBatchBytes, "boundaryBatch")).toThrow("PROVENANCE");
    expect(Object.isFrozen(boundary)).toBe(true);
    expect(() => k.finishA2(ticket)).toThrow("TICKET");
  });
  it("rejects numerical/hash-equal Ref clones and byte substitutions", () => {
    const first = planning(), raw = fixture(), boundary = ownedBoundary(first.meter, raw), ref = k.boundaryRef(boundary); k.finishA2(first.ticket);
    expect(() => k.batchForBoundaryRef(k.constructRef(ref.byteLength, ref.sha256))).toThrow("PROVENANCE");
    expect(() => k.batchForBoundaryRef({ ...ref })).toThrow("PROVENANCE");
    const next = planning(), batch = k.boundaryBatch(boundary), changed = publicBytes(raw); changed[changed.length - 1] = 32;
    const bytes = k.snapshotFixedBytes(changed, "boundaryBatch", next.meter);
    expect(() => k.completeBoundaryBatchBytes(next.meter, bytes, batch)).toThrow("CANONICAL");
  });
  it("derives initial events exclusively from verified boundary bytes", () => {
    const { meter, ticket } = planning(), boundary = ownedBoundary(meter, fixture()), batch = k.boundaryBatch(boundary), input = k.makeInitialReductionInput(meter, boundary);
    expect(input.events).toBe(batch.events); expect(input.snapshot).toBe(batch.snapshot); expect(input.boundaryRef).toBe(k.boundaryRef(boundary));
    expect(input.priorOwnSquares).toEqual([]); expect(input.priorOwnUnits).toEqual([]); expect(Object.isFrozen(input)).toBe(true); k.finishA2(ticket);
  });
  it("reconstructs advance prior units/mines through the state's exact verified Ref", () => {
    const initial = planning(), raw = fixture(), oldBoundary = ownedBoundary(initial.meter, raw); k.finishA2(initial.ticket);
    const stateScope = planning(), state = stateAt(stateScope.meter, oldBoundary); k.finishA2(stateScope.ticket);
    const changedSnapshot = { ...raw.snapshot, own: { ...raw.snapshot.own, mines: [] }, ownMineLineage: [] };
    const nextRaw = readBatch({ ...raw, ordinal: 1, phase: "turn-open", seqBefore: raw.seqThrough, seqThrough: raw.seqThrough + 1,
      events: [{ kind: "own-mine-removed", seq: raw.seqThrough + 1, mineId: "w:mine:opening:e1" }], snapshot: changedSnapshot });
    const scope = planning(), boundary = ownedBoundary(scope.meter, nextRaw, ["w:mine:opening:e1"]), input = k.makeAdvanceReductionInput(scope.meter, state, boundary);
    expect(input.events).toBe(k.boundaryBatch(boundary).events);
    expect(input.priorOwnUnits).toBe(k.batchForBoundaryRef(state.boundaryRef).snapshot.ownUnitLineage);
    expect(input.priorOwnSquares).toEqual(["e1"] as Square[]);
    expect(input.priorOwnSquares).not.toBe(boundary.snapshot.own.mines); k.finishA2(scope.ticket);
  });
  it("retains byte-exact replay and validates readout conservation/support certainty", () => {
    const initial = planning(), boundary = ownedBoundary(initial.meter, fixture()); k.finishA2(initial.ticket);
    const scope = planning(), state = stateAt(scope.meter, boundary), replay = k.makeAdvanceReductionInput(scope.meter, state, boundary);
    expect(replay.ordinal).toBe(state.ordinal); expect(replay.events).toBe(k.boundaryBatch(boundary).events);
    const qD = k.makeQuantilesD(scope.meter, 3, 3, 3, 3), qP = k.makeQuantilesPotential(scope.meter, 6, 6, 6, 6),
      readout = k.makeEconomicReadout(scope.meter, state, encodeOwnedNumber(3), encodeOwnedNumber(6), qD, qP, encodeOwnedNumber(-3), encodeOwnedNumber(0));
    expect(k.requireReadout(readout)).toBe(readout); expect(readout.boundaryRef).toBe(state.boundaryRef);
    expect(Object.isFrozen(readout.quantilesD)).toBe(true); k.finishA2(scope.ticket);
  });
  it("constructs the full frozen five-unit opening under the unchanged planning cap", () => {
    const raw = fixture(false), squares = ["c2", "d2", "e1", "e2", "f2"] as const,
      pieces = squares.map(square => ({ square, piece: { color: "w" as const, type: square === "e1" ? "k" as const : "p" as const } })),
      lineage = pieces.map(p => ({ id: `w:unit:opening:${p.square}`, square: p.square, type: p.piece.type, paidBasis: 0, replacementValue: p.piece.type === "k" ? 0 : 1 })),
      snapshot = { ...raw.snapshot, own: { ...raw.snapshot.own, pieces }, ownUnitLineage: lineage,
        cells: raw.snapshot.cells.map(cell => { const own = pieces.find(p => p.square === cell.square); return own ? { square: own.square, visibility: "lit" as const, piece: own.piece } : cell; }) },
      events = lineage.map((unit, i) => ({ kind: "own-unit-endowed", seq: i + 1, id: unit.id, square: unit.square, type: unit.type, paidBasis: 0 })),
      batch = readBatch({ ...raw, seqThrough: 5, events, snapshot }), scope = planning();
    const boundary = ownedBoundary(scope.meter, batch);
    expect(boundary.snapshot.ownUnitLineage).toHaveLength(5); expect(scope.meter.used).toBeLessThanOrEqual(1048576); k.finishA2(scope.ticket);
  });
  it("hashes a stable physical boundary once and reuses only its exact owned pair", () => {
    const scope = planning(), raw = fixture(false), bytes = k.snapshotFixedBytes(publicBytes(raw), "boundaryBatch", scope.meter), hash = vi.spyOn(jsSHA.prototype, "getHash");
    try {
      const batch = decodeOwnedBoundaryBatch(scope.meter, bytes); expect(hash).toHaveBeenCalledTimes(1);
      const before = scope.meter.used, first = k.completeBoundaryBatchBytes(scope.meter, bytes, batch), second = k.completeBoundaryBatchBytes(scope.meter, bytes, batch);
      expect(second).toBe(first); expect(hash).toHaveBeenCalledTimes(1); expect(scope.meter.used - before).toBeLessThan(4096); k.finishA2(scope.ticket);
    } finally { hash.mockRestore(); }
  });
  it("rejects duplicate decoder scopes and scope escape before finishing accounting", () => {
    const first = planning(), bytes = k.snapshotFixedBytes(publicBytes(fixture(false)), "boundaryBatch", first.meter);
    k.beginBoundaryBatchDecode(first.meter, bytes);
    expect(() => k.beginBoundaryBatchDecode(first.meter, bytes)).toThrow("LIFECYCLE");
    const second = planning(), other = k.snapshotFixedBytes(publicBytes(fixture(false)), "boundaryBatch", second.meter);
    k.beginBoundaryBatchDecode(second.meter, other);
    expect(() => k.finishA2(second.ticket)).toThrow("TICKET");
  });
});
