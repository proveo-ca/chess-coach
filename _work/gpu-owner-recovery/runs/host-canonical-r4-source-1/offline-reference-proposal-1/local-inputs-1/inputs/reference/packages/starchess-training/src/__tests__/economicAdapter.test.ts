// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { validateBoundaryBatch } from "@chess-coach/starchess-arena/events";
import { initializeR3Session, stageR3Begin, verifyAndCommitR3, visitR3EconomicInputs } from "@chess-coach/starchess-arena";
import { parseScFen } from "@chess-coach/starchess-core";
import { composeCandidatesFromHistoryV2 } from "../candidates";
import * as kernel from "../economic/ownedKernel";
import { constructOwnedGeneratedBatch, executeCandidatePipeline, reconstructEconomicInput } from "../coordinator/economicAdapter";
import type { PrivateHostedScope } from "../coordinator/planningScope";
import type { OriginalEpisodeRequestV2 } from "../coordinator/episodeContracts";

const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value !== null && typeof value === "object" ?
  `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}` : JSON.stringify(value);
const active = () => {
  const pair = kernel.createPlanningLedger(); pair.owner.admitOnce();
  const visit = pair.owner.beginR3Visit(), node = pair.owner.beginR3Node();
  return { ...pair, finish: () => { pair.owner.finishIngress(node); pair.owner.finishIngress(visit); pair.owner.close(); } };
};
const fixture = (ownSquare = "e1", minerals = 3, gas = 1) => {
  const economicState = { version: "challenge-economic-ledger-v1", side: "w", ownPaidDebits: 0, ownPaidSurviving: 0, ownPaidDestroyed: 0, ownPaidWasted: 0, ownReplacementDestroyed: 0,
    enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" }, receipts: [], retiredOwnIds: [] };
  const cells = Array.from({ length: 64 }, (_, i) => {
    const square = `${"abcdefgh"[Math.floor(i / 8)]}${i % 8 + 1}`;
    return square === ownSquare ? { square, visibility: "lit", piece: { type: "k", color: "w" } } : { square, visibility: "unknown" };
  });
  const batch = validateBoundaryBatch({ version: "challenge-boundary-batch-v1", side: "w", ordinal: 0, phase: "initial", turn: 0, planningOrdinal: 0, seqBefore: 0, seqThrough: 1,
    events: [{ kind: "own-unit-endowed", seq: 1, id: `w:unit:opening:${ownSquare}`, square: ownSquare, type: "k", paidBasis: 0 }],
    snapshot: { version: "challenge-observation-v2", side: "w", turn: 0, own: { minerals, gas, gasIncome: 1, ccLives: 3, pieces: [{ square: ownSquare, piece: { type: "k", color: "w" } }], mines: [], siegedTanks: [] },
      cells, memory: [], ownUnitLineage: [{ id: `w:unit:opening:${ownSquare}`, square: ownSquare, type: "k", paidBasis: 0, replacementValue: 0 }], ownMineLineage: [], economicState } });
  const source = new TextEncoder().encode(canonical(batch)), snapshot = batch.snapshot;
  return { batch, boundary: { snapshot, economicState: snapshot.economicState, ownMineAuditState: { liveOwnMines: [], retiredOwnMineIdsSorted: [], ownMineCreationCounter: 0 },
    everLit: [ownSquare], ordinal: 0, phase: "initial", planningOrdinal: 0, seqThrough: 1 },
  history: { version: "challenge-history-v2", currentAuthorizedSnapshotV2: snapshot, economicState: snapshot.economicState, everLit: [ownSquare] }, batchByteLength: source.length, readBatchByte: (i: number) => source[i]!, source };
};

describe("owned economic adapter", () => {
  it("reconstructs detached receiving DTOs and physical boundary bytes under active accounting", () => {
    const pair = active(), raw = fixture(), owned = reconstructEconomicInput(raw, pair.meter);
    expect(kernel.requireHistory(owned.history)).toBe(owned.history); expect(kernel.requireBoundary(owned.boundary)).toBe(owned.boundary);
    expect(owned.history).toEqual(raw.history); expect(owned.boundary.lastBatchBytes).toEqual(raw.source);
    expect(owned.history).not.toBe(raw.history); expect(owned.boundary.snapshot).not.toBe(raw.boundary.snapshot);
    const ref = kernel.boundaryRef(owned.boundary); owned.boundary.lastBatchBytes.fill(0);
    expect(kernel.boundaryRef(owned.boundary)).toBe(ref); expect(kernel.boundaryBatch(owned.boundary).snapshot).toBe(owned.boundary.snapshot);
    expect(Object.isFrozen(owned.history.currentAuthorizedSnapshotV2.cells[0])).toBe(true);
    expect(pair.meter.used).toBeGreaterThan(3072); expect(pair.meter.used).toBeLessThanOrEqual(1048576); pair.finish();
    expect(() => kernel.requireHistory(raw.history)).toThrow("PROVENANCE");
    expect(() => kernel.requireSnapshotV2(raw.batch.snapshot)).toThrow("PROVENANCE");
  });
  it("rejects an unadmitted meter before reading a hostile envelope", () => {
    let traps = 0;
    const input = new Proxy({}, { get() { traps++; throw new Error("trap"); }, getOwnPropertyDescriptor() { traps++; throw new Error("trap"); } });
    const pair = kernel.createPlanningLedger();
    expect(() => reconstructEconomicInput(input, pair.meter)).toThrow("LIFECYCLE"); expect(traps).toBe(0);
  });
  it("rejects proxies and accessors without executing their hooks", () => {
    for (const proxy of [true, false]) {
      const pair = active(); let traps = 0;
      const input = proxy ? new Proxy({}, { getOwnPropertyDescriptor() { traps++; throw new Error("trap"); } }) : Object.defineProperty({}, "batch", { enumerable: true, get() { traps++; throw new Error("trap"); } });
      expect(() => reconstructEconomicInput(input, pair.meter)).toThrow(); expect(traps).toBe(0); expect(() => pair.finish()).toThrow();
    }
  });
  it.each(["bytes", "history", "ordinal", "mine-audit"])("rejects substituted %s with no receiving publication", mode => {
    const pair = active(), raw = fixture();
    const changed = mode === "bytes" ? { ...raw, readBatchByte: () => 0 } : mode === "history" ? { ...raw, history: { ...raw.history, everLit: ["a1", "e1"] } } :
      mode === "ordinal" ? { ...raw, boundary: { ...raw.boundary, ordinal: 1 } } : { ...raw, boundary: { ...raw.boundary, ownMineAuditState: { ...raw.boundary.ownMineAuditState, ownMineCreationCounter: 1 } } };
    expect(() => reconstructEconomicInput(changed, pair.meter)).toThrow(); expect(() => pair.finish()).toThrow();
    expect(() => kernel.requireHistory(raw.history)).toThrow("PROVENANCE");
  });
  it("reserves field inspection before invoking a byte-reader or field getter at exhaustion", () => {
    const pair = active(), raw = fixture(), reader = vi.fn(raw.readBatchByte), getter = vi.fn();
    kernel.consumeWorkBlock(pair.meter, "scalar", 1048576 - pair.meter.used - 128);
    const input = Object.defineProperty({ ...raw, readBatchByte: reader }, "batch", { enumerable: true, get: getter });
    const used = pair.meter.used;
    expect(() => reconstructEconomicInput(input, pair.meter)).toThrow("WORK_CAP");
    expect(reader).not.toHaveBeenCalled(); expect(getter).not.toHaveBeenCalled(); expect(pair.meter.used).toBe(used);
  });
  it("retains the original reader exception and closes accounting", () => {
    const pair = active(), raw = fixture(), failure = new Error("reader-failure");
    expect(() => reconstructEconomicInput({ ...raw, readBatchByte: () => { throw failure; } }, pair.meter)).toThrow(failure);
    expect(() => pair.finish()).toThrow();
  });
  it("uses a genuine native R3 visitor and preserves an actual shared-cap failure", () => {
    const binding = Object.freeze({}), initial = initializeR3Session(binding, parseScFen("SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:"), { w: 3, b: 3 });
    const session = verifyAndCommitR3(binding, initial, stageR3Begin(binding, initial)), pair = kernel.createPlanningLedger(); pair.owner.admitOnce();
    let visit: kernel.IngressTicket | null = null, node: kernel.IngressTicket | null = null, publications = 0;
    expect(() => visitR3EconomicInputs(binding, session, "w", -1, units => {
      if (units === 128) visit = pair.owner.beginR3Visit();
      else if (units === 256) node = pair.owner.beginR3Node();
      else { const byte = pair.owner.beginR3ByteReads(1); pair.owner.finishIngress(byte); }
    }, input => { reconstructEconomicInput(input, pair.meter); publications++; })).toThrow("WORK_CAP");
    expect(publications).toBe(0); expect(pair.meter.used).toBeLessThanOrEqual(1048576); expect(visit).not.toBeNull(); expect(node).not.toBeNull();
    expect(() => visitR3EconomicInputs(binding, session, "w", 1, () => undefined, () => undefined)).not.toThrow();
  });
  it("authenticates owned history before examining a supplied generator batch", () => {
    const pair = active(); let traps = 0;
    const generated = new Proxy({}, { get() { traps++; throw new Error("trap"); } });
    expect(() => constructOwnedGeneratedBatch({} as never, generated as never, pair.meter)).toThrow("PROVENANCE"); expect(traps).toBe(0);
  });
  it("checks the actual generated output instead of accepting a supplied subset", () => {
    const first = active(), owned = reconstructEconomicInput(fixture(), first.meter); first.finish();
    const actual = composeCandidatesFromHistoryV2(owned.history), pair = active();
    expect(() => constructOwnedGeneratedBatch(owned.history, { ...actual, candidates: [] }, pair.meter)).toThrow("NONMEMBER"); expect(() => pair.finish()).toThrow();
  });
  it("does not truncate an actual generated batch or renew the meter to evade hashing/scoring costs", () => {
    const first = active(), owned = reconstructEconomicInput(fixture("a1", 0, 0), first.meter); first.finish();
    const generated = composeCandidatesFromHistoryV2(owned.history), keys = generated.candidates.map(candidate => candidate.key), pair = active();
    expect(() => constructOwnedGeneratedBatch(owned.history, generated, pair.meter)).toThrow("WORK_CAP");
    expect(generated.candidates.map(candidate => candidate.key)).toEqual(keys); expect(pair.meter.limit).toBe(1048576); expect(pair.meter.used).toBeLessThanOrEqual(pair.meter.limit);
    expect(() => pair.finish()).toThrow();
  });
  it.each(["key", "spend"])("checks every actual generated candidate's %s", mode => {
    const first = active(), owned = reconstructEconomicInput(fixture("a1", 0, 0), first.meter); first.finish();
    const generated = composeCandidatesFromHistoryV2(owned.history), candidates = generated.candidates.map((candidate, i) => i !== 0 ? candidate :
      mode === "key" ? { ...candidate, key: "substituted" } : { ...candidate, ownSpend: { ...candidate.ownSpend, minerals: 1 } }), pair = active();
    expect(() => constructOwnedGeneratedBatch(owned.history, { ...generated, candidates }, pair.meter)).toThrow("NONMEMBER"); expect(() => pair.finish()).toThrow();
  });
  it("fails closed before request/weights/RNG inspection for a forged planning scope", () => {
    let traps = 0; const hostile = new Proxy({}, { get() { traps++; throw new Error("trap"); } });
    expect(() => executeCandidatePipeline(hostile as PrivateHostedScope, hostile as OriginalEpisodeRequestV2, hostile as never, hostile as never)).toThrow("permit"); expect(traps).toBe(0);
  });
  it("keeps all seven action builders, the five unchanged A2 bridges and bounded streaming", () => {
    const source = readFileSync(new URL("../coordinator/economicAdapter.ts", import.meta.url), "utf8");
    for (const name of ["Classical", "Deploy", "StimStep", "SpiderMine", "CharonMissiles", "SiegeMode", "TacticalJump"]) expect(source).toContain(`make${name}Action(meter`);
    expect(source).not.toMatch(/JSON\.(?:parse|stringify)|Object\.keys|createPlanningLedger|LedgerOwner|LedgerPair/);
    expect(source).toContain("hostedReadoutEconomic(scope"); expect(source).toContain("hostedFlattenFeaturesV3(scope");
    expect(source).not.toMatch(/Float64Array\([^)]*512\s*\*\s*418|pending|strategicCandidates|addScAction/);
  });
});
