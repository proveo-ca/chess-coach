// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml, _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml, _spec/packages/starchess-arena/authorized-economic-boundaries.puml
import { describe, expect, it } from "vitest";
import { parseScFen, type ScActionInput } from "@chess-coach/starchess-core";
import { validateBoundaryBatch } from "../authorized/v2/batch";
import { bytes, parseBytes } from "../authorized/v2/schema";
import type { ReconciledBoundaryState, Side } from "../authorized/v2/types";
import { stageQueue } from "../challenge/admission";
import {
  initializeR3Session, readR3CheckedBoundary, readR3PlanningHistory,
  stageR3Begin, stageR3Settlement, verifyAndCommitR3, type R3Session,
} from "../challenge/r3Session";

const opening = (turn = 21) => parseScFen(`SCFEN|7k/8/8/8/8/8/8/K7|${turn}|33|P|G:33:33|Q:w:;b:|M:w:c3;b:f6`);
const begin = (binding: object, session: R3Session) => verifyAndCommitR3(binding, session, stageR3Begin(binding, session));
const settle = (binding: object, session: R3Session, w: readonly ScActionInput[] = [], b: readonly ScActionInput[] = []) => {
  const white = stageQueue(session.snapshot, session.bank, "w", w, session.planningOrdinal);
  const black = stageQueue(session.snapshot, session.bank, "b", b, session.planningOrdinal);
  if (!white.ok || !black.ok) throw new Error("invalid accessor fixture");
  return verifyAndCommitR3(binding, session, stageR3Settlement(binding, session, { w: white.staged, b: black.staged }));
};
const assertBoundary = (binding: object, session: R3Session, side: Side): ReconciledBoundaryState => {
  const checked = readR3CheckedBoundary(binding, session, side);
  const recipient = session.recipients[side];
  expect(checked).toEqual(recipient.boundary);
  expect(checked.snapshot).toEqual(recipient.history.currentAuthorizedSnapshotV2);
  expect(checked.economicState).toEqual(recipient.history.economicState);
  expect(checked.snapshot.economicState).toEqual(checked.economicState);
  expect(checked.ownMineAuditState.liveOwnMines).toEqual(checked.snapshot.ownMineLineage);
  expect(checked.lastBatchBytes).toEqual(bytes(recipient.batch));
  expect(validateBoundaryBatch(parseBytes(checked.lastBatchBytes))).toEqual(recipient.batch);
  expect(Object.keys(checked).sort()).toEqual([
    "snapshot", "economicState", "ownMineAuditState", "everLit", "ordinal", "phase", "planningOrdinal", "seqThrough", "lastBatchBytes",
  ].sort());
  return checked;
};

describe("R3 checked boundary accessor", () => {
  it.each(["w", "b"] as const)("reads valid initial, Begin and settled %s boundaries with existing receipt/lineage equality", side => {
    const binding = {};
    const initial = initializeR3Session(binding, opening(), { w: 3, b: 3 });
    expect(assertBoundary(binding, initial, side)).toMatchObject({ phase: "initial", ordinal: 0, planningOrdinal: 0 });
    expect(() => readR3PlanningHistory(binding, initial, side)).toThrow("PROTOCOL");
    const open = begin(binding, initial);
    const openBoundary = assertBoundary(binding, open, side);
    expect(openBoundary).toMatchObject({ phase: "turn-open", ordinal: 1, planningOrdinal: 0 });
    expect(readR3PlanningHistory(binding, open, side)).toEqual({
      version: "challenge-history-v2", currentAuthorizedSnapshotV2: openBoundary.snapshot,
      economicState: openBoundary.economicState, everLit: openBoundary.everLit,
    });
    const completed = settle(binding, open,
      [{ kind: "deploy", timing: "B", color: "w", from: "a1", to: "a2", unit: "p" }],
      [{ kind: "deploy", timing: "B", color: "b", from: "h8", to: "h7", unit: "p" }]);
    const boundary = assertBoundary(binding, completed, side);
    expect(boundary).toMatchObject({ phase: "settled", ordinal: 2, planningOrdinal: 1 });
    expect(boundary.economicState.receipts).toHaveLength(1);
    const receipt = boundary.economicState.receipts[0];
    const unit = boundary.snapshot.ownUnitLineage.find(lineage => lineage.type === "p")!;
    expect(receipt).toMatchObject({ receiptId: `${side}:receipt:0:0`, minerals: 1, disposition: { kind: "materialized", lineageId: unit.id } });
    expect(unit).toMatchObject({ paidBasis: 1, replacementValue: 1 });
    expect(() => readR3PlanningHistory(binding, completed, side)).toThrow("PROTOCOL");
  });

  it("rejects crosssession, copied and stale authority plus invalid sides", () => {
    const binding = {}, other = {};
    const initial = initializeR3Session(binding, opening(), { w: 3, b: 3 });
    const alien = initializeR3Session(other, opening(), { w: 3, b: 3 });
    expect(() => readR3CheckedBoundary(other, initial, "w")).toThrow("SESSION");
    expect(() => readR3CheckedBoundary(binding, alien, "w")).toThrow("SESSION");
    expect(() => readR3CheckedBoundary(binding, { ...initial }, "w")).toThrow("SESSION");
    let reads = 0;
    const forged = Object.create(initial) as R3Session;
    Object.defineProperty(forged, "recipients", { get() { reads++; return initial.recipients; } });
    expect(() => readR3CheckedBoundary(binding, forged, "w")).toThrow("SESSION");
    expect(reads).toBe(0);
    expect(() => readR3CheckedBoundary(binding, initial, "x" as Side)).toThrow("SIDE");
    const open = begin(binding, initial);
    expect(() => readR3CheckedBoundary(binding, initial, "w")).toThrow("SEQUENCE");
    const completed = settle(binding, open);
    expect(() => readR3CheckedBoundary(binding, open, "b")).toThrow("SEQUENCE");
    expect(assertBoundary(binding, completed, "w").phase).toBe("settled");
    expect(assertBoundary(other, alien, "b").phase).toBe("initial");
  });

  it("returns frozen public DTOs and fresh raw bytes without mutating session state", () => {
    const binding = {};
    const initial = initializeR3Session(binding, opening(), { w: 3, b: 3 });
    const completed = settle(binding, begin(binding, initial), [
      { kind: "deploy", timing: "B", color: "w", from: "a1", to: "a2", unit: "p" },
    ]);
    const first = assertBoundary(binding, completed, "w");
    const second = readR3CheckedBoundary(binding, completed, "w");
    const assertFrozen = (value: unknown): void => {
      if (!value || typeof value !== "object" || ArrayBuffer.isView(value)) return;
      expect(Object.isFrozen(value)).toBe(true);
      for (const child of Object.values(value)) assertFrozen(child);
    };
    assertFrozen(first);
    expect(first).not.toBe(second);
    expect(first.snapshot).not.toBe(second.snapshot);
    expect(first.economicState.receipts[0]).not.toBe(second.economicState.receipts[0]);
    expect(first.lastBatchBytes).not.toBe(second.lastBatchBytes);
    expect(first.lastBatchBytes.buffer).not.toBe(second.lastBatchBytes.buffer);
    expect(Reflect.set(first.snapshot.own, "minerals", 0)).toBe(false);
    expect(Reflect.set(first.economicState.receipts[0].disposition, "lineageId", "forged")).toBe(false);
    const saved = structuredClone(second);
    first.lastBatchBytes.fill(0);
    expect(second).toEqual(saved);
    expect(assertBoundary(binding, completed, "w")).toEqual(saved);
    expect(() => begin(binding, completed)).not.toThrow();
  });

  it.each(["initial", "turn-open", "settled"] as const)("allows %s terminal inspection while planning history rejects it", phase => {
    const binding = {};
    let session: R3Session;
    if (phase === "initial") {
      session = initializeR3Session(binding, opening(45), { w: 3, b: 3 });
    } else if (phase === "turn-open") {
      const native = parseScFen("SCFEN|8/8/8/8/8/8/8/Kk6|12|11|P|G:22:22|Q:w:;b:");
      session = begin(binding, initializeR3Session(binding, native, { w: 3, b: 3 }));
    } else {
      session = settle(binding, begin(binding, initializeR3Session(binding, opening(44), { w: 3, b: 3 })));
    }
    expect(session.provenance.stage).toBe("terminal");
    for (const side of ["w", "b"] as const) {
      expect(assertBoundary(binding, session, side).phase).toBe(phase);
      expect(() => readR3PlanningHistory(binding, session, side)).toThrow("PROTOCOL");
    }
  });
});
