// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml, _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import * as core from "@chess-coach/starchess-core";
import { beginScTurn, endScTurn, parseScFen, type ScActionInput, type ScFenSnapshot } from "@chess-coach/starchess-core";
import { commitPair, stageQueue, type StagedQueue } from "../challenge/admission";
import {
  encodeR3Provenance, initializeR3Session, stageR3Begin, stageR3Settlement, verifyAndCommitR3,
  type R3Session, type R3StagedTransition,
} from "../challenge/r3Session";
import { validateBoundaryBatch } from "../authorized/v2/batch";
import { byteEqual, bytes } from "../authorized/v2/schema";
import type { Bank } from "../run/bank";

const snapshot = (placement = "7k/8/8/8/8/8/8/K7", turn = 0, extras = "", lives = "33") => {
  const gas = turn <= 10 ? 1 : turn <= 20 ? 2 : 3;
  return parseScFen(`SCFEN|${placement}|${turn}|${lives}|P|G:${gas}${gas}:${gas}${gas}|Q:w:;b:${extras}`);
};
const begin = (binding: object, session: R3Session) => verifyAndCommitR3(binding, session, stageR3Begin(binding, session));
const pair = (session: R3Session, w: readonly ScActionInput[] = [], b: readonly ScActionInput[] = []): Record<"w" | "b", StagedQueue> => {
  const white = stageQueue(session.snapshot, session.bank, "w", w, session.planningOrdinal);
  const black = stageQueue(session.snapshot, session.bank, "b", b, session.planningOrdinal);
  if (!white.ok || !black.ok) throw new Error(JSON.stringify([white, black]));
  return { w: white.staged, b: black.staged };
};
const settle = (binding: object, session: R3Session, w: readonly ScActionInput[] = [], b: readonly ScActionInput[] = []) => {
  const stages = pair(session, w, b);
  const transition = stageR3Settlement(binding, session, stages);
  return { transition, session: verifyAndCommitR3(binding, session, transition), stages };
};
const copy = (transition: R3StagedTransition): R3StagedTransition => ({ ...structuredClone(transition), binding: transition.binding });
const rehash = (transition: R3StagedTransition): R3StagedTransition => {
  const { nativeResult: _native, ...privateRecord } = transition.companion;
  const provenanceBytes = encodeR3Provenance(privateRecord);
  return { ...transition, provenanceBytes, digest: { byteLength: provenanceBytes.length, sha256: createHash("sha256").update(provenanceBytes).digest("hex") } };
};
const events = (session: R3Session, side: "w" | "b" = "w") => session.recipients[side].batch.events;

describe("R3 real-native scheduled boundaries and conservation", () => {
  it("publishes only initial/open/settled boundaries with zero opening basis", () => {
    const binding = {};
    const opening = snapshot("7k/8/8/8/8/8/4R3/K7", 0, "|M:w:c3;b:d4|S:e2");
    const saved = structuredClone(opening);
    const initial = initializeR3Session(binding, opening, { w: 3, b: 3 });
    expect(events(initial).map(event => event.kind)).toEqual(["own-unit-endowed", "own-unit-endowed", "own-mine-endowed"]);
    expect(initial.recipients.w.batch).toMatchObject({ ordinal: 0, phase: "initial", planningOrdinal: 0, seqBefore: 0, seqThrough: 3 });
    expect(initial.recipients.w.history.currentAuthorizedSnapshotV2.ownUnitLineage).toEqual([
      { id: "w:unit:opening:a1", square: "a1", type: "k", paidBasis: 0, replacementValue: 0 },
      { id: "w:unit:opening:e2", square: "e2", type: "r", paidBasis: 0, replacementValue: 5 },
    ]);
    expect(initial.recipients.w.boundary.economicState).toMatchObject({ ownPaidDebits: 0, ownPaidSurviving: 0, ownPaidDestroyed: 0, ownPaidWasted: 0 });
    const open = begin(binding, initial);
    expect(open.snapshot).toEqual(beginScTurn(opening).next);
    expect(open.recipients.w.batch).toMatchObject({ ordinal: 1, phase: "turn-open", planningOrdinal: 0 });
    expect(events(open)).toEqual([]);
    const completed = settle(binding, open).session;
    expect(completed.recipients.w.batch).toMatchObject({ ordinal: 2, phase: "settled", planningOrdinal: 1 });
    expect(events(completed)).toEqual([{ kind: "own-income", actualCreditedMinerals: 1, seq: 4 }]);
    expect(opening).toEqual(saved);
    expect(Object.isFrozen(binding)).toBe(false);
  });

  it("conserves paid crush/birth/later newborn mine death without a refund", () => {
    const binding = {};
    const initial = initializeR3Session(binding, snapshot("4k3/8/8/8/8/8/4n3/4K3", 21, "|M:w:;b:e2"), { w: 3, b: 3 });
    const open = begin(binding, initial);
    const action: ScActionInput = { kind: "deploy", timing: "B", color: "w", from: "e1", to: "e2", unit: "p" };
    const { session: completed, transition, stages } = settle(binding, open, [action]);
    const committed = commitPair(open.snapshot, open.bank, stages.w, stages.b);
    expect(transition.companion.nativeResult).toStrictEqual(endScTurn(committed.snapshot, { skipTurnStartChecks: true }));
    expect(transition.companion.frames.map(frame => frame.effects.map(effect => effect.kind))).toEqual([
      ["unit-destroy", "unit-create", "deployment-disposition"], ["mine-remove", "unit-destroy"],
    ]);
    expect(events(completed).filter(event => event.kind !== "vision-witness").map(event => event.kind)).toEqual([
      "own-paid-receipt", "own-gas-debited", "own-unit-created", "enemy-unit-destruction-witnessed", "own-unit-destroyed", "own-income",
    ]);
    expect(completed.recipients.w.boundary.economicState).toMatchObject({
      ownPaidDebits: 1, ownPaidSurviving: 0, ownPaidDestroyed: 1, ownPaidWasted: 0, ownReplacementDestroyed: 1,
      receipts: [{ receiptId: "w:receipt:0:0", minerals: 1, disposition: { kind: "materialized", lineageId: "w:unit:created:1" } }],
      retiredOwnIds: ["w:unit:created:1"], enemyLoss: { confirmedUnitCount: 1, replacementLowerBound: 3 },
    });
    expect(completed.bank.w).toBe(5);
    expect(events(completed, "b").filter(event => event.kind === "own-mine-removed")).toHaveLength(1);
  });

  it("wastes paid terminal-C skipped F deployment without inventing birth or refund", () => {
    const binding = {};
    const initial = initializeR3Session(binding, snapshot("8/8/k7/8/8/8/8/R3K3", 21, "", "31"), { w: 3, b: 3 });
    const open = begin(binding, initial);
    const completed = settle(binding, open, [
      { kind: "classical", timing: "C", color: "w", from: "a1", to: "a8" },
      { kind: "deploy", timing: "F", color: "w", from: "e1", to: "d2", unit: "p" },
    ]).session;
    expect(completed.provenance.stage).toBe("terminal");
    expect(events(completed).filter(event => event.kind === "own-unit-created")).toEqual([]);
    expect(events(completed).filter(event => event.kind === "own-deployment-unmaterialized")).toEqual([
      expect.objectContaining({ receiptId: "w:receipt:0:1", paidMinerals: 1 }),
    ]);
    expect(completed.recipients.w.boundary.economicState).toMatchObject({ ownPaidDebits: 1, ownPaidSurviving: 0, ownPaidDestroyed: 0, ownPaidWasted: 1 });
    expect(completed.bank).toEqual({ w: 5, b: 6 });
    expect(events(completed).at(-1)).toMatchObject({ kind: "own-income", actualCreditedMinerals: 3 });
    expect(events(completed).filter(event => event.kind === "enemy-unit-destruction-witnessed")).toEqual([]);
    expect(() => stageR3Begin(binding, completed)).toThrow("PROTOCOL");
  });

  it("rolls back a rejected pair and retries with contiguous source/own ordinals", () => {
    const binding = {};
    const open = begin(binding, initializeR3Session(binding, snapshot("7k/8/8/8/8/8/4P3/4K3", 21), { w: 3, b: 3 }));
    const before = structuredClone({ snapshot: open.snapshot, bank: open.bank, provenance: open.provenance, recipients: open.recipients });
    const white = stageQueue(open.snapshot, open.bank, "w", [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "d2", unit: "p" }], 0);
    const black = stageQueue(open.snapshot, open.bank, "b", [{ kind: "deploy", timing: "B", color: "b", from: "h8", to: "h7", unit: "q" }], 0);
    expect(white.ok).toBe(true); expect(black.ok).toBe(false);
    expect({ snapshot: open.snapshot, bank: open.bank, provenance: open.provenance, recipients: open.recipients }).toEqual(before);
    const stages = pair(open, [
      { kind: "stimStep", timing: "F", color: "w", from: "e2", to: "e3" },
      { kind: "deploy", timing: "B", color: "w", from: "e1", to: "d2", unit: "p" },
      { kind: "classical", timing: "C", color: "w", from: "e2", to: "e3" },
    ], [{ kind: "deploy", timing: "B", color: "b", from: "h8", to: "g7", unit: "p" }]);
    expect(() => stageR3Settlement(binding, open, { ...stages, b: { ...stages.b, spend: 0 } })).toThrow("CONSERVATION");
    const transition = stageR3Settlement(binding, open, stages);
    expect(transition.companion.provenance.resolvedActions.map(action => ({ seq: action.sourceActionSeq, side: action.side, ref: action.actionRef }))).toEqual([
      { seq: 0, side: "w", ref: { planningOrdinal: 0, acceptedActionOrdinal: 0 } },
      { seq: 1, side: "w", ref: { planningOrdinal: 0, acceptedActionOrdinal: 1 } },
      { seq: 2, side: "w", ref: { planningOrdinal: 0, acceptedActionOrdinal: 2 } },
      { seq: 3, side: "b", ref: { planningOrdinal: 0, acceptedActionOrdinal: 0 } },
    ]);
    expect(transition.batches.w.events.slice(0, 3).map(event => event.kind)).toEqual(["own-gas-debited", "own-paid-receipt", "own-gas-debited"]);
    const completed = verifyAndCommitR3(binding, open, transition);
    expect(completed.recipients.w.boundary.economicState.receipts).toHaveLength(1);
    expect(completed.recipients.w.boundary.economicState.receipts[0].receiptId).toBe("w:receipt:0:1");
    expect(completed.recipients.w.boundary.snapshot.ownUnitLineage.find(unit => unit.id === "w:unit:opening:e2")?.square).toBe("e4");
  });

  it("preserves zero paid delta and purchased basis through native replacement promotion", () => {
    const binding = {};
    const open = begin(binding, initializeR3Session(binding, snapshot("k4p2/4PK2/8/8/8/8/8/8", 11), { w: 3, b: 3 }));
    const completed = settle(binding, open, [
      { kind: "stimStep", timing: "B", color: "w", from: "e7", to: "e8", promotion: "q" },
      { kind: "deploy", timing: "B", color: "w", from: "f7", to: "e8", unit: "p" },
      { kind: "classical", timing: "C", color: "w", from: "e7", to: "f8", promotion: "q" },
    ]).session;
    expect(events(completed).filter(event => event.kind === "own-unit-transformed")).toEqual([expect.objectContaining({ id: "w:unit:created:1", fromType: "p", toType: "q", paidDelta: 0 })]);
    expect(completed.recipients.w.boundary.snapshot.ownUnitLineage.find(unit => unit.id === "w:unit:created:1")).toMatchObject({ type: "q", paidBasis: 1, replacementValue: 9 });
    expect(completed.recipients.w.boundary.economicState).toMatchObject({ ownPaidDebits: 1, ownPaidSurviving: 1, ownPaidDestroyed: 0 });
  });

  it("reconciles simultaneous delayed swaps and landed-live mine deaths", () => {
    const binding = {};
    const open = begin(binding, initializeR3Session(binding, snapshot("r3k3/8/8/8/8/8/8/R3K3", 1, "|S:a1a8|M:w:a1h4;b:a8h5"), { w: 3, b: 3 }));
    const completed = settle(binding, open,
      [{ kind: "classical", timing: "C", color: "w", from: "a1", to: "a8" }],
      [{ kind: "classical", timing: "C", color: "b", from: "a8", to: "a1" }]).session;
    for (const side of ["w", "b"] as const) {
      expect(events(completed, side).filter(event => event.kind === "own-unit-moved")).toHaveLength(1);
      expect(events(completed, side).filter(event => event.kind === "own-unit-destroyed")).toHaveLength(1);
      expect(events(completed, side).filter(event => event.kind === "own-mine-removed")).toHaveLength(1);
    }
    expect(completed.snapshot.mines).toEqual([{ color: "w", at: "h4" }, { color: "b", at: "h5" }]);
    expect(completed.recipients.w.boundary.snapshot.ownUnitLineage.map(unit => unit.type)).toEqual(["k"]);
  });

  it("tracks every duplicate mine occurrence and retires all matching IDs once", () => {
    const binding = {};
    let current = initializeR3Session(binding, snapshot("7k/8/8/8/5p2/8/2N5/K7", 21, "|M:w:e3;b:e3"), { w: 3, b: 3 });
    const duplicate: ScActionInput[] = [
      { kind: "spiderMine", timing: "F", color: "w", from: "c2", to: "c2" },
      { kind: "classical", timing: "C", color: "w", from: "c2", to: "e3" },
    ];
    current = settle(binding, begin(binding, current), duplicate).session;
    expect(current.recipients.w.boundary.snapshot.ownMineLineage).toEqual([
      { mineId: "w:mine:created:1", square: "e3" }, { mineId: "w:mine:opening:e3", square: "e3" },
    ]);
    expect(current.recipients.w.boundary.snapshot.own.mines).toEqual(["e3"]);
    current = settle(binding, begin(binding, current), [{ kind: "classical", timing: "C", color: "w", from: "e3", to: "c2" }]).session;
    current = settle(binding, begin(binding, current), duplicate).session;
    expect(current.recipients.w.boundary.ownMineAuditState.liveOwnMines).toHaveLength(3);
    current = settle(binding, begin(binding, current), [], [{ kind: "classical", timing: "C", color: "b", from: "f4", to: "e3" }]).session;
    expect(events(current).filter(event => event.kind === "own-mine-removed").map(event => event.mineId)).toEqual([
      "w:mine:created:1", "w:mine:created:2", "w:mine:opening:e3",
    ]);
    expect(current.recipients.w.boundary.ownMineAuditState).toEqual({ liveOwnMines: [], retiredOwnMineIdsSorted: ["w:mine:created:1", "w:mine:created:2", "w:mine:opening:e3"], ownMineCreationCounter: 2 });
    expect(current.snapshot.mines).toBeUndefined();
    expect(current.recipients.w.boundary.economicState.ownPaidDebits).toBe(0);
  });

  it.each([0, 1, 11, 21, 44])("grants one capped settlement income at turn %i", turn => {
    const binding = {};
    const openingBank: Bank = { w: 12, b: 11 };
    const initial = initializeR3Session(binding, snapshot(undefined, turn), openingBank);
    expect(initial.bank).toEqual(openingBank);
    const open = begin(binding, initial);
    expect(open.bank).toEqual(openingBank);
    const completed = settle(binding, open).session;
    expect(completed.bank).toEqual({ w: 12, b: 12 });
    expect(events(completed).at(-1)).toMatchObject({ kind: "own-income", actualCreditedMinerals: 0 });
    expect(events(completed, "b").at(-1)).toMatchObject({ kind: "own-income", actualCreditedMinerals: 1 });
    if (turn === 44) expect(() => stageR3Begin(binding, completed)).toThrow("PROTOCOL");
  });

  it("publishes terminal Begin chip only as scheduled turn-open, with no grant or extra boundary", () => {
    const binding = {};
    const initial = initializeR3Session(binding, snapshot("8/8/8/8/8/8/8/Kk6", 12, "", "11"), { w: 3, b: 3 });
    const completed = begin(binding, initial);
    expect(completed.provenance).toMatchObject({ stage: "terminal", callOrdinal: 1 });
    expect(completed.recipients.w.batch).toMatchObject({ ordinal: 1, phase: "turn-open", planningOrdinal: 0, turn: 13 });
    expect(events(completed).filter(event => event.kind !== "vision-witness")).toEqual([expect.objectContaining({ kind: "own-cc-lives-changed", before: 1, after: 0 })]);
    expect(completed.bank).toEqual({ w: 3, b: 3 });
    expect(() => stageR3Begin(binding, completed)).toThrow("PROTOCOL");
    expect(() => stageR3Settlement(binding, completed, pair(completed))).toThrow();
  });

  it("initializes terminal openings without Begin or income", () => {
    const binding = {};
    const initial = initializeR3Session(binding, snapshot(undefined, 45), { w: 3, b: 3 });
    expect(initial.provenance.stage).toBe("terminal");
    expect(events(initial).every(event => event.kind.endsWith("endowed"))).toBe(true);
    expect(() => stageR3Begin(binding, initial)).toThrow("PROTOCOL");
  });
});

describe("R3 independent parent authority and atomic commit", () => {
  it("reexecutes from independent prior sessions and checks exact private bytes and complete native result", () => {
    const binding = {};
    const opening = snapshot("4k3/8/p7/8/8/8/8/R3K3");
    let producer = initializeR3Session(binding, opening, { w: 3, b: 3 });
    let parent = initializeR3Session(binding, structuredClone(opening), { w: 3, b: 3 });
    const openingTransition = stageR3Begin(binding, producer);
    parent = verifyAndCommitR3(binding, parent, openingTransition);
    producer = verifyAndCommitR3(binding, producer, openingTransition);
    const transition = stageR3Settlement(binding, producer, pair(producer, [{ kind: "classical", timing: "C", color: "w", from: "a1", to: "a8" }]));
    const final = verifyAndCommitR3(binding, parent, transition);
    expect(final.recipients.w.batch).toEqual(transition.batches.w);
    expect(final.provenance).toEqual(transition.companion.provenance);
    const encoded = encodeR3Provenance({ provenance: final.provenance, frames: final.previousCompanion!.frames, visibilityImages: final.previousCompanion!.visibilityImages, visibilityCheckpoints: final.previousCompanion!.visibilityCheckpoints });
    expect(byteEqual(encoded, transition.provenanceBytes)).toBe(true);
    expect(transition.digest).toEqual({ byteLength: encoded.length, sha256: createHash("sha256").update(encoded).digest("hex") });
  });

  it.each(["proof", "image", "binding", "native", "public", "raw", "length", "hash", "gap", "initial"])("rejects forged %s atomically", variant => {
    const binding = {};
    const open = begin(binding, initializeR3Session(binding, snapshot("4k3/8/p7/8/8/8/8/R3K3"), { w: 3, b: 3 }));
    const transition = stageR3Settlement(binding, open, pair(open, [{ kind: "classical", timing: "C", color: "w", from: "a1", to: "a8" }]));
    const before = structuredClone({ snapshot: open.snapshot, bank: open.bank, provenance: open.provenance, recipients: open.recipients });
    let bad = copy(transition);
    const mutable = bad as any;
    if (variant === "proof") { mutable.companion.provenance.lastCall.consumedFacts[0].targetCell.square = "b6"; bad = rehash(bad); }
    if (variant === "image") { mutable.companion.visibilityImages[0].state.entities[0].square = "b1"; bad = rehash(bad); }
    if (variant === "binding") { mutable.companion.provenance.resolvedActions[0].actionRef.acceptedActionOrdinal = 1; bad = rehash(bad); }
    if (variant === "native") mutable.companion.nativeResult.resolved.afterMove.placement = mutable.companion.nativeResult.next.placement;
    if (variant === "public") {
      const event = mutable.batches.w.events.find((event: any) => event.kind === "enemy-unit-destruction-witnessed");
      event.square = "b6";
      expect(validateBoundaryBatch(mutable.batches.w)).toBeDefined();
    }
    if (variant === "raw") mutable.provenanceBytes[0] ^= 1;
    if (variant === "length") mutable.digest.byteLength++;
    if (variant === "hash") mutable.digest.sha256 = "0".repeat(64);
    if (variant === "gap") mutable.ordinal += 2;
    if (variant === "initial") mutable.phase = "initial";
    expect(() => verifyAndCommitR3(binding, open, bad)).toThrow(/PROVENANCE|SEQUENCE|SCHEMA/);
    expect({ snapshot: open.snapshot, bank: open.bank, provenance: open.provenance, recipients: open.recipients }).toEqual(before);
    const completed = verifyAndCommitR3(binding, open, transition);
    expect(completed.recipients.w.boundary.economicState.enemyLoss.confirmedUnitCount).toBe(1);
    expect(events(completed).find(event => event.kind === "enemy-unit-destruction-witnessed")?.witnessId).toBe("w:witness:1");
  });

  it("rejects crosssession bindings, copied session authority and stale nonlast parents", () => {
    const binding = {}, other = {};
    const initial = initializeR3Session(binding, snapshot(), { w: 3, b: 3 });
    const alien = initializeR3Session(other, snapshot(), { w: 3, b: 3 });
    const transition = stageR3Begin(other, alien);
    expect(() => stageR3Begin(other, initial)).toThrow("SESSION");
    expect(() => verifyAndCommitR3(binding, initial, transition)).toThrow("SESSION");
    expect(() => stageR3Begin(binding, { ...initial })).toThrow("SESSION");
    const open = begin(binding, initial);
    expect(() => stageR3Begin(binding, initial)).toThrow("SEQUENCE");
    const completed = settle(binding, open).session;
    expect(() => verifyAndCommitR3(binding, completed, { ...transition, binding })).toThrow("SEQUENCE");
  });

  it("replays the last accepted transition with no native execution or state/IDs/income effects", () => {
    const binding = {};
    const open = begin(binding, initializeR3Session(binding, snapshot("7k/8/8/8/8/8/8/K7", 21), { w: 3, b: 3 }));
    const { session: completed, transition } = settle(binding, open, [{ kind: "deploy", timing: "B", color: "w", from: "a1", to: "a2", unit: "p" }]);
    const spy = vi.spyOn(core, "endTurnWithProvenance");
    try {
      expect(verifyAndCommitR3(binding, completed, copy(transition))).toBe(completed);
      expect(spy).not.toHaveBeenCalled();
      const bad = copy(transition) as any;
      bad.batches.w.events.at(-1).actualCreditedMinerals = 2;
      expect(() => verifyAndCommitR3(binding, completed, bad)).toThrow("PROVENANCE");
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
    expect(completed.bank.w).toBe(5);
    expect(completed.recipients.w.boundary.economicState.receipts).toHaveLength(1);
    expect(completed.recipients.w.boundary.snapshot.ownUnitLineage.filter(unit => unit.id.includes("created"))).toHaveLength(1);
  });

  it("detaches exposed reducer bytes and rejects getters/sparse private records without evaluation", () => {
    const binding = {};
    const initial = initializeR3Session(binding, snapshot(), { w: 3, b: 3 });
    const exposed = initial.recipients.w.boundary.lastBatchBytes;
    exposed.fill(0);
    expect(initial.recipients.w.boundary.lastBatchBytes[0]).toBe(123);
    const transition = stageR3Begin(binding, initial);
    const bad = copy(transition) as any;
    Object.defineProperty(bad.companion.provenance, "turn", { get: () => { throw new Error("getter executed"); }, enumerable: true });
    expect(() => verifyAndCommitR3(binding, initial, bad)).toThrow("SCHEMA");
    const sparse = copy(transition) as any;
    sparse.companion.frames = new Array(2);
    expect(() => verifyAndCommitR3(binding, initial, sparse)).toThrow("ARRAY");
    const open = verifyAndCommitR3(binding, initial, transition);
    expect(open.recipients.w.batch.ordinal).toBe(1);
    expect(bytes(initial.recipients.w.batch)).toEqual(initial.recipients.w.boundary.lastBatchBytes);
  });
});
