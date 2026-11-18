// SPEC: _spec/packages/starchess-arena/authorized-economic-boundaries.puml, _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { describe, expect, it, vi } from "vitest";
import { parseScFen, type ScActionInput } from "@chess-coach/starchess-core";
import * as arena from "@chess-coach/starchess-arena";
import {
  initializeR3Session, stageR3Begin, stageR3Settlement, verifyAndCommitR3, visitR3EconomicInputs,
  type R3Binding, type R3EconomicBoundaryFields, type R3EconomicInput, type R3Session, type R3StagedTransition,
} from "@chess-coach/starchess-arena";
import { stageQueue } from "../challenge/admission";
import { readR3CheckedBoundary, readR3PlanningHistory } from "../challenge/r3Session";
import { bytes } from "../authorized/v2/schema";
import type { Side } from "../authorized/v2/types";

const opening = (turn = 0) => {
  const gas = turn <= 10 ? 1 : turn <= 20 ? 2 : 3;
  return parseScFen(`SCFEN|7k/8/8/8/8/8/8/K7|${turn}|33|P|G:${gas}${gas}:${gas}${gas}|Q:w:;b:|M:w:c3;b:f6`);
};
const begin = (binding: R3Binding, session: R3Session) => verifyAndCommitR3(binding, session, stageR3Begin(binding, session));
const pair = (session: R3Session, w: readonly ScActionInput[] = [], b: readonly ScActionInput[] = []) => {
  const white = stageQueue(session.snapshot, session.bank, "w", w, session.planningOrdinal);
  const black = stageQueue(session.snapshot, session.bank, "b", b, session.planningOrdinal);
  if (!white.ok || !black.ok) throw new Error("invalid economic visitor fixture");
  return { w: white.staged, b: black.staged };
};
const settle = (binding: R3Binding, session: R3Session, w: readonly ScActionInput[] = [], b: readonly ScActionInput[] = []) => {
  const transition = stageR3Settlement(binding, session, pair(session, w, b));
  return { transition, session: verifyAndCommitR3(binding, session, transition) };
};
const fixture = () => {
  const binding: R3Binding = {};
  const initial = initializeR3Session(binding, opening(), { w: 3, b: 3 });
  return { binding, initial, session: begin(binding, initial) };
};
const copyTransition = (transition: R3StagedTransition): R3StagedTransition => ({ ...structuredClone(transition), binding: transition.binding });
const unpaid = () => {};
const ordinals = (binding: R3Binding, session: R3Session, afterOrdinal = -1, side: Side = "w") => {
  const result: number[] = [];
  visitR3EconomicInputs(binding, session, side, afterOrdinal, unpaid, input => { result.push(input.batch.ordinal); });
  return result;
};
const assertFrozen = (value: unknown): void => {
  if (!value || typeof value !== "object") return;
  expect(ArrayBuffer.isView(value)).toBe(false);
  expect(value).not.toBeInstanceOf(ArrayBuffer);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) assertFrozen(child);
};

describe("R3 host economic visitor", () => {
  it("exports exactly the named lifecycle additions without detached or private helpers", () => {
    for (const name of ["initializeR3Session", "stageR3Begin", "stageR3Settlement", "verifyAndCommitR3", "visitR3EconomicInputs"] as const) {
      expect(typeof arena[name]).toBe("function");
    }
    for (const name of ["readR3CheckedBoundary", "readR3PlanningHistory", "copyR3PrivateBytes", "encodeR3Provenance", "projectR3Boundary"]) {
      expect(Object.hasOwn(arena, name)).toBe(false);
    }
  });

  it.each(["w", "b"] as const)("delivers constructor-owned %s initial/open graphs and freshly read canonical bytes", side => {
    const { binding, initial, session } = fixture();
    const expected = [initial.recipients[side], session.recipients[side]];
    const charge = vi.fn((units: number) => { expect(Number.isSafeInteger(units) && units > 0).toBe(true); });
    let visited = 0;
    const clone = vi.spyOn(globalThis, "structuredClone");
    try {
      visitR3EconomicInputs(binding, session, side, -1, charge, input => {
        const recipient = expected[visited++];
        expect(Object.keys(input).sort()).toEqual(["batch", "boundary", "history", "batchByteLength", "readBatchByte"].sort());
        const boundary: R3EconomicBoundaryFields = input.boundary;
        expect(Object.keys(boundary).sort()).toEqual(["snapshot", "economicState", "ownMineAuditState", "everLit", "ordinal", "phase", "planningOrdinal", "seqThrough"].sort());
        const { lastBatchBytes, ...fields } = recipient.boundary;
        expect(boundary).toEqual(fields);
        expect(input.batch).toEqual(recipient.batch);
        expect(input.history).toEqual(recipient.history);
        expect(input.batch).not.toBe(recipient.batch);
        expect(input.batch.snapshot).toEqual(boundary.snapshot);
        expect(input.history.currentAuthorizedSnapshotV2).toEqual(boundary.snapshot);
        expect(input.history.economicState).toEqual(boundary.economicState);
        expect(Object.isFrozen(input)).toBe(true);
        assertFrozen(input.batch);
        assertFrozen(boundary);
        assertFrozen(input.history);
        const reconstructed = new Uint8Array(input.batchByteLength);
        for (let index = 0; index < reconstructed.length; index++) reconstructed[index] = input.readBatchByte(index);
        expect(reconstructed).toEqual(lastBatchBytes);
        expect(reconstructed).toEqual(bytes(input.batch));
        reconstructed.fill(0);
        expect(input.readBatchByte(0)).toBe(123);
      });
      expect(clone).not.toHaveBeenCalled();
    } finally { clone.mockRestore(); }
    expect(visited).toBe(2);
    expect(charge).toHaveBeenCalled();
  });

  it("selects every pending boundary in ascending order using the supplied committed cursor", () => {
    const { binding, session: first } = fixture();
    const second = begin(binding, settle(binding, first).session);
    expect(ordinals(binding, second)).toEqual([0, 1, 2, 3]);
    expect(ordinals(binding, second, 0)).toEqual([1, 2, 3]);
    expect(ordinals(binding, second, 1)).toEqual([2, 3]);
    expect(ordinals(binding, second, 2)).toEqual([3]);
    expect(ordinals(binding, second, 3)).toEqual([]);
    const third = begin(binding, settle(binding, second).session);
    expect(ordinals(binding, third, 3)).toEqual([4, 5]);
    const phases: string[] = [];
    visitR3EconomicInputs(binding, third, "w", 1, unpaid, input => { phases.push(input.boundary.phase); });
    expect(phases).toEqual(["settled", "turn-open", "settled", "turn-open"]);
  });

  it.each([-2, -0, 2, 91, 0.5, NaN, Infinity, "0", {}, 1n])("rejects an invalid or skipping cursor %s before delivery", cursor => {
    const { binding, session } = fixture();
    const visit = vi.fn();
    expect(() => visitR3EconomicInputs(binding, session, "w", cursor as number, unpaid, visit)).toThrow("SEQUENCE");
    expect(visit).not.toHaveBeenCalled();
    expect(ordinals(binding, session)).toEqual([0, 1]);
  });

  it("rejects cross-session, cloned and proxy authority without reflection or billing", () => {
    const { binding, initial, session } = fixture();
    const alien = fixture();
    let traps = 0;
    const proxy = new Proxy(session, {
      get() { traps++; throw new Error("get trap"); },
      getPrototypeOf() { traps++; throw new Error("prototype trap"); },
      ownKeys() { traps++; throw new Error("keys trap"); },
      getOwnPropertyDescriptor() { traps++; throw new Error("descriptor trap"); },
    });
    const charge = vi.fn(), visit = vi.fn();
    for (const [otherBinding, otherSession] of [
      [alien.binding, session], [binding, alien.session], [binding, { ...session }], [binding, Object.create(session)], [binding, proxy],
      [new Proxy(binding, { get() { traps++; throw new Error("binding trap"); } }), session],
    ] as const) {
      expect(() => visitR3EconomicInputs(otherBinding, otherSession, "w", -1, charge, visit)).toThrow("SESSION");
    }
    expect(() => visitR3EconomicInputs(binding, initial, "w", -1, charge, visit)).toThrow("SEQUENCE");
    expect(traps).toBe(0);
    expect(charge).not.toHaveBeenCalled();
    expect(visit).not.toHaveBeenCalled();
  });

  it("rejects invalid sides and callbacks without delivering inputs", () => {
    const { binding, session } = fixture();
    const visit = vi.fn();
    expect(() => visitR3EconomicInputs(binding, session, "x" as Side, -1, unpaid, visit)).toThrow("SIDE");
    expect(() => visitR3EconomicInputs(binding, session, "w", -1, null as unknown as (units: number) => void, visit)).toThrow("PROTOCOL");
    expect(() => visitR3EconomicInputs(binding, session, "w", -1, unpaid, null as unknown as (input: R3EconomicInput) => void)).toThrow("PROTOCOL");
    expect(visit).not.toHaveBeenCalled();
    expect(ordinals(binding, session)).toEqual([0, 1]);
  });

  it("admits only current nonterminal after-begin sessions", () => {
    const binding = {};
    let session = initializeR3Session(binding, opening(), { w: 3, b: 3 });
    const visit = vi.fn();
    expect(() => visitR3EconomicInputs(binding, session, "w", -1, unpaid, visit)).toThrow("PROTOCOL");
    session = settle(binding, begin(binding, session)).session;
    expect(() => visitR3EconomicInputs(binding, session, "w", -1, unpaid, visit)).toThrow("PROTOCOL");
    const terminalBinding = {};
    const adjacent = parseScFen("SCFEN|8/8/8/8/8/8/8/Kk6|12|11|P|G:22:22|Q:w:;b:");
    const terminalBegin = begin(terminalBinding, initializeR3Session(terminalBinding, adjacent, { w: 3, b: 3 }));
    expect(terminalBegin.provenance.stage).toBe("terminal");
    expect(() => visitR3EconomicInputs(terminalBinding, terminalBegin, "w", -1, unpaid, visit)).toThrow("PROTOCOL");
    const endingBinding = {};
    const ending = settle(endingBinding, begin(endingBinding, initializeR3Session(endingBinding, opening(44), { w: 3, b: 3 }))).session;
    expect(ending.provenance.stage).toBe("terminal");
    expect(() => visitR3EconomicInputs(endingBinding, ending, "w", -1, unpaid, visit)).toThrow("PROTOCOL");
    const openingBinding = {};
    const terminalOpening = initializeR3Session(openingBinding, opening(45), { w: 3, b: 3 });
    expect(() => visitR3EconomicInputs(openingBinding, terminalOpening, "w", -1, unpaid, visit)).toThrow("PROTOCOL");
    expect(visit).not.toHaveBeenCalled();
    expect(ordinals(binding, begin(binding, session))).toEqual([0, 1, 2, 3]);
  });

  it("retains independently reexecuted graphs rather than claimed transitions or getter clones", () => {
    const binding = {};
    const initial = initializeR3Session(binding, opening(), { w: 3, b: 3 });
    const getterBytes = initial.recipients.w.boundary.lastBatchBytes;
    getterBytes.fill(0);
    const staged = stageR3Begin(binding, initial);
    const claimed = copyTransition(staged);
    const clone = vi.spyOn(globalThis, "structuredClone");
    let session: R3Session;
    try {
      session = verifyAndCommitR3(binding, initial, claimed);
      expect(clone.mock.calls.some(([value]) => value && typeof value === "object" && Object.hasOwn(value, "w") && Object.hasOwn(value, "b"))).toBe(false);
    } finally { clone.mockRestore(); }
    const exposed = session.recipients;
    exposed.w.boundary.lastBatchBytes.fill(0);
    const borrowed: R3EconomicInput[] = [];
    visitR3EconomicInputs(binding, session, "w", -1, unpaid, input => {
      borrowed.push(input);
      expect(input.readBatchByte(0)).toBe(123);
      if (input.batch.ordinal === 1) expect(input.batch).not.toBe(claimed.batches.w);
    });
    expect(borrowed[0].batch).not.toBe(initial.recipients.w.batch);
    expect(borrowed[1].batch).not.toBe(exposed.w.batch);
    const second: R3EconomicInput[] = [];
    visitR3EconomicInputs(binding, session, "w", -1, unpaid, input => { second.push(input); });
    expect(second[0].batch).toBe(borrowed[0].batch);
    expect(second[1].batch).toBe(borrowed[1].batch);
    expect(second[1].boundary).not.toBe(borrowed[1].boundary);
    expect(readR3CheckedBoundary(binding, session, "w").lastBatchBytes[0]).toBe(123);
    expect(readR3PlanningHistory(binding, session, "w")).toEqual(borrowed[1].history);
  });

  it("appends only verified commits and appends nothing for exact replay or a failed claim", () => {
    const { binding, session } = fixture();
    const transition = stageR3Settlement(binding, session, pair(session));
    expect(ordinals(binding, session)).toEqual([0, 1]);
    const bad = { ...copyTransition(transition), ordinal: transition.ordinal + 1 };
    expect(() => verifyAndCommitR3(binding, session, bad)).toThrow("SEQUENCE");
    expect(ordinals(binding, session)).toEqual([0, 1]);
    const completed = verifyAndCommitR3(binding, session, transition);
    expect(verifyAndCommitR3(binding, completed, copyTransition(transition))).toBe(completed);
    const nextTransition = stageR3Begin(binding, completed);
    const next = verifyAndCommitR3(binding, completed, nextTransition);
    expect(verifyAndCommitR3(binding, next, copyTransition(nextTransition))).toBe(next);
    expect(ordinals(binding, next)).toEqual([0, 1, 2, 3]);
    expect(ordinals(binding, next, 1)).toEqual([2, 3]);
  });

  it("preserves independent producer/parent recipient graphs for the same binding", () => {
    const binding = {};
    const producerInitial = initializeR3Session(binding, opening(), { w: 3, b: 3 });
    const parentInitial = initializeR3Session(binding, opening(), { w: 3, b: 3 });
    const transition = stageR3Begin(binding, producerInitial);
    const producer = verifyAndCommitR3(binding, producerInitial, transition);
    const parent = verifyAndCommitR3(binding, parentInitial, transition);
    const producerBatches: unknown[] = [], parentBatches: unknown[] = [];
    visitR3EconomicInputs(binding, producer, "w", -1, unpaid, input => { producerBatches.push(input.batch); });
    visitR3EconomicInputs(binding, parent, "w", -1, unpaid, input => { parentBatches.push(input.batch); });
    expect(parentBatches).toEqual(producerBatches);
    expect(parentBatches[0]).not.toBe(producerBatches[0]);
    expect(parentBatches[1]).not.toBe(producerBatches[1]);
    visitR3EconomicInputs(binding, producer, "w", 1, unpaid, () => {
      throw new Error("no pending producer input");
    });
  });

  it("preserves all pending receipt, income and mine audit fields", () => {
    const { binding, session } = fixture();
    const completed = settle(binding, session,
      [{ kind: "deploy", timing: "B", color: "w", from: "a1", to: "a2", unit: "p" }],
      [{ kind: "deploy", timing: "B", color: "b", from: "h8", to: "h7", unit: "p" }]).session;
    const expected = completed.recipients;
    const next = begin(binding, completed);
    for (const side of ["w", "b"] as const) {
      visitR3EconomicInputs(binding, next, side, 1, unpaid, input => {
        if (input.batch.ordinal !== 2) return;
        const { lastBatchBytes: _bytes, ...boundary } = expected[side].boundary;
        expect(input.boundary).toEqual(boundary);
        expect(input.boundary.economicState).toMatchObject({ ownPaidDebits: 1, ownPaidSurviving: 1, ownPaidDestroyed: 0, ownPaidWasted: 0 });
        expect(input.boundary.economicState.receipts).toHaveLength(1);
        expect(input.batch.events.at(-1)).toMatchObject({ kind: "own-income", actualCreditedMinerals: 1 });
        expect(input.boundary.ownMineAuditState.liveOwnMines).toEqual(input.boundary.snapshot.ownMineLineage);
      });
    }
  });

  it("rejects stage, commit, replay and nested visits for the entire synchronous borrow", () => {
    const { binding, session } = fixture();
    const stages = pair(session);
    const staged = stageR3Settlement(binding, session, stages);
    const forbidden = () => {
      expect(() => stageR3Begin(binding, session)).toThrow("PROTOCOL");
      expect(() => stageR3Settlement(binding, session, stages)).toThrow("PROTOCOL");
      expect(() => verifyAndCommitR3(binding, session, staged)).toThrow("PROTOCOL");
      expect(() => verifyAndCommitR3(binding, session, session.previousCompanion as unknown as R3StagedTransition)).toThrow("PROTOCOL");
      expect(() => visitR3EconomicInputs(binding, session, "w", -1, unpaid, unpaid)).toThrow("PROTOCOL");
      expect(() => visitR3EconomicInputs(binding, session, "b", 1, unpaid, unpaid)).toThrow("PROTOCOL");
    };
    visitR3EconomicInputs(binding, session, "w", 0, forbidden, input => {
      forbidden();
      expect(input.readBatchByte(0)).toBe(123);
    });
    expect(verifyAndCommitR3(binding, session, staged).planningOrdinal).toBe(1);
  });

  it.each(["visit", "charge"] as const)("rejects a nonundefined %s result without inspecting then and releases the borrow", callback => {
    const { binding, session } = fixture();
    let thenReads = 0;
    const result = new Proxy({}, { get() { thenReads++; throw new Error("then trap"); } });
    const invalid = () => result;
    let reader: ((index: number) => number) | undefined;
    const visit = (input: R3EconomicInput) => { reader = input.readBatchByte; return result; };
    expect(() => visitR3EconomicInputs(binding, session, "w", 0, callback === "charge" ? invalid : unpaid, callback === "visit" ? visit : unpaid)).toThrow("PROTOCOL");
    expect(thenReads).toBe(0);
    if (reader) expect(() => reader!(0)).toThrow("PROTOCOL");
    expect(ordinals(binding, session)).toEqual([0, 1]);
    expect(() => stageR3Settlement(binding, session, pair(session))).not.toThrow();
  });

  it.each([null, false, 0, "", Promise.resolve(undefined)])("rejects even primitive or promise callback result %s", result => {
    const { binding, session } = fixture();
    expect(() => visitR3EconomicInputs(binding, session, "w", 0, unpaid, () => result)).toThrow("PROTOCOL");
    expect(ordinals(binding, session)).toEqual([0, 1]);
  });

  it("expires each reader at callback return and never revives it in a later callback or visit", () => {
    const { binding, session } = fixture();
    const readers: ((index: number) => number)[] = [];
    let charges = 0;
    const charge = () => { charges++; };
    visitR3EconomicInputs(binding, session, "w", -1, charge, input => {
      for (const reader of readers) expect(() => reader(0)).toThrow("PROTOCOL");
      readers.push(input.readBatchByte);
      expect(input.readBatchByte(0)).toBe(123);
    });
    const before = charges;
    for (const reader of readers) expect(() => reader(0)).toThrow("PROTOCOL");
    expect(charges).toBe(before);
    visitR3EconomicInputs(binding, session, "w", 0, charge, input => {
      for (const reader of readers) expect(() => reader(0)).toThrow("PROTOCOL");
      expect(input.readBatchByte(0)).toBe(123);
    });
  });

  it("expires readers and releases the chain when the consumer throws", () => {
    const { binding, session } = fixture();
    const failure = new Error("consumer failure");
    let reader: ((index: number) => number) | undefined;
    expect(() => visitR3EconomicInputs(binding, session, "w", 0, unpaid, input => {
      reader = input.readBatchByte;
      throw failure;
    })).toThrow(failure);
    expect(() => reader!(0)).toThrow("PROTOCOL");
    expect(ordinals(binding, session)).toEqual([0, 1]);
    expect(() => stageR3Settlement(binding, session, pair(session))).not.toThrow();
  });

  it.each(["visit", "charge"] as const)("rechecks authority even when %s throws", callback => {
    const { binding, session } = fixture();
    const failure = new Error("callback failure");
    let thrown = false, rechecks = 0;
    const originalGet = WeakMap.prototype.get;
    const lookup = vi.spyOn(WeakMap.prototype, "get").mockImplementation(function (this: WeakMap<object, unknown>, key: object) {
      if (key === session && thrown) rechecks++;
      return originalGet.call(this, key);
    });
    const reject = () => { thrown = true; throw failure; };
    try {
      expect(() => visitR3EconomicInputs(binding, session, "w", 0, callback === "charge" ? reject : unpaid, callback === "visit" ? reject : unpaid)).toThrow(failure);
      expect(rechecks).toBeGreaterThan(0);
    } finally { lookup.mockRestore(); }
    expect(ordinals(binding, session)).toEqual([0, 1]);
  });

  it.each([-1, -0, 0.5, NaN, Infinity, "0", {}, 1n])("checks invalid byte index %s without coercion or byte delivery", index => {
    const { binding, session } = fixture();
    let coercions = 0;
    const poison = new Proxy({}, { get() { coercions++; throw new Error("coercion trap"); } });
    visitR3EconomicInputs(binding, session, "w", 0, unpaid, input => {
      expect(() => input.readBatchByte(index as number)).toThrow(/NUMBER|NONFINITE/);
      expect(() => input.readBatchByte(input.batchByteLength)).toThrow("NUMBER");
      expect(() => input.readBatchByte(poison as unknown as number)).toThrow("NUMBER");
      expect(input.readBatchByte(0)).toBe(123);
      expect(input.readBatchByte(input.batchByteLength - 1)).toBe(125);
    });
    expect(coercions).toBe(0);
  });

  it("reserves before any node envelope construction and never constructs the unaffordable node", () => {
    const { binding, session } = fixture();
    const reserveFailure = new Error("WORK_CAP");
    let reservations = 0, envelopes = 0, fields = 0, callbacks = 0;
    const originalFreeze = Object.freeze;
    const freeze = vi.spyOn(Object, "freeze").mockImplementation(value => {
      if (value && typeof value === "object" && Object.hasOwn(value, "readBatchByte")) {
        expect(reservations).toBeGreaterThanOrEqual(2);
        envelopes++;
      }
      if (value && typeof value === "object" && Object.hasOwn(value, "ownMineAuditState")) {
        expect(reservations).toBeGreaterThanOrEqual(2);
        fields++;
      }
      return originalFreeze(value);
    });
    try {
      expect(() => visitR3EconomicInputs(binding, session, "w", -1, () => {
        if (++reservations === 3) throw reserveFailure;
      }, () => { callbacks++; })).toThrow(reserveFailure);
      expect(envelopes).toBe(1);
      expect(fields).toBe(1);
      expect(callbacks).toBe(1);
    } finally { freeze.mockRestore(); }
    expect(ordinals(binding, session)).toEqual([0, 1]);
  });

  it("executes no envelope or callback when admission cannot be prepaid", () => {
    const { binding, session } = fixture();
    const freeze = vi.spyOn(Object, "freeze");
    const visit = vi.fn();
    const failure = new Error("WORK_CAP");
    try {
      expect(() => visitR3EconomicInputs(binding, session, "w", -1, () => { throw failure; }, visit)).toThrow(failure);
      expect(freeze).not.toHaveBeenCalled();
      expect(visit).not.toHaveBeenCalled();
    } finally { freeze.mockRestore(); }
    expect(ordinals(binding, session)).toEqual([0, 1]);
  });

  it("reserves each byte before delivery and denies recursive byte reads in the reservation callback", () => {
    const { binding, session } = fixture();
    const failure = new Error("WORK_CAP");
    let reader: ((index: number) => number) | undefined;
    let failRead = false, reservations = 0, delivered = 0;
    const charge = () => {
      reservations++;
      if (reader) expect(() => reader!(0)).toThrow("PROTOCOL");
      if (failRead) throw failure;
    };
    visitR3EconomicInputs(binding, session, "w", 0, charge, input => {
      reader = input.readBatchByte;
      const before = reservations;
      expect(input.readBatchByte(0)).toBe(123);
      expect(reservations).toBe(before + 1);
      failRead = true;
      expect(() => { input.readBatchByte(1); delivered++; }).toThrow(failure);
      expect(delivered).toBe(0);
      failRead = false;
      expect(input.readBatchByte(1)).toBe(34);
    });
    expect(() => reader!(0)).toThrow("PROTOCOL");
    expect(ordinals(binding, session)).toEqual([0, 1]);
  });

  it("retains the full native 91-boundary episode without dropping pending inputs", () => {
    const binding = {};
    let session = initializeR3Session(binding, opening(), { w: 3, b: 3 });
    for (let turn = 0; turn < 45; turn++) {
      session = begin(binding, session);
      expect(session.provenance.stage).toBe("after-begin");
      expect(ordinals(binding, session, turn === 0 ? -1 : 2 * turn - 1)).toEqual(turn === 0 ? [0, 1] : [2 * turn, 2 * turn + 1]);
      if (turn === 44) expect(ordinals(binding, session)).toEqual(Array.from({ length: 90 }, (_, ordinal) => ordinal));
      const settled = settle(binding, session);
      session = settled.session;
      expect(verifyAndCommitR3(binding, session, settled.transition)).toBe(session);
    }
    expect(session.recipients.w.batch.ordinal).toBe(90);
    expect(session.provenance.stage).toBe("terminal");
    expect(() => stageR3Begin(binding, session)).toThrow("PROTOCOL");
    expect(() => visitR3EconomicInputs(binding, session, "w", 89, unpaid, unpaid)).toThrow("PROTOCOL");
  }, 20_000);
});
