// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { advanceHistory, reconcileBoundary } from "@chess-coach/starchess-arena/events";
import { ACTION_KINDS } from "@chess-coach/starchess-arena/intent-codec-v1";
import * as codec from "@chess-coach/starchess-arena/intent-codec-v1";
import {
  type AuthorizedBoundaryBatch, type AuthorizedEvent, type AuthorizedHistory, type AuthorizedObservationV1,
  type AuthorizedSnapshotV2, type EconomicState, type OwnMineLineage, type ReconciledBoundaryState,
} from "@chess-coach/starchess-arena/observations";
import { countedPlanningKnowledge, type Square } from "@chess-coach/starchess-core/planning-v1";
import * as publicApi from "../candidates";
import { composeCandidatesFromHistoryV2 as composeV2, composeCandidatesFromObservationV1 as composeV1 } from "../candidates";
import { appendFailure, appendState, emptyPrefix, planningKnowledge, type PrefixState } from "../domain";
import * as domain from "../domain";
import { allActors, c, observation, s } from "./fixtures";

type EventInput = AuthorizedEvent extends infer E ? E extends AuthorizedEvent ? Omit<E, "seq"> : never : never;
type Session = { state: ReconciledBoundaryState; history: AuthorizedHistory };
type Mutable<T> = T extends readonly (infer V)[] ? Mutable<V>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
const clone = <T>(value: T): Mutable<T> => structuredClone(value) as Mutable<T>;
const expectContractError = (call: () => unknown, path: string, code: string): void => {
  let thrown: unknown;
  try { call(); } catch (error) { thrown = error; }
  expect(thrown).toBeInstanceOf(Error);
  expect(thrown).not.toBeInstanceOf(TypeError);
  expect(thrown).toMatchObject({ name: "ContractError", path, code, message: `${code}: ${path}` });
};
const ledger = (side: "w" | "b"): EconomicState => ({
  version: "challenge-economic-ledger-v1", side,
  ownPaidDebits: 0, ownPaidSurviving: 0, ownPaidDestroyed: 0, ownPaidWasted: 0, ownReplacementDestroyed: 0,
  enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" },
  receipts: [], retiredOwnIds: [],
});
const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const;
const initialSnapshot = (o: AuthorizedObservationV1): AuthorizedSnapshotV2 => ({
  ...clone(o), version: "challenge-observation-v2", economicState: ledger(o.side),
  ownUnitLineage: o.own.pieces.map(({ square, piece }) => ({
    id: `${o.side}:unit:opening:${square}`, square, type: piece.type, paidBasis: 0, replacementValue: values[piece.type],
  })),
  ownMineLineage: o.own.mines.map(square => ({ mineId: `${o.side}:mine:opening:${square}`, square })),
});
const publish = (previous: Session | null, snapshot: AuthorizedSnapshotV2, phase: AuthorizedBoundaryBatch["phase"], inputs: EventInput[]): Session => {
  const seqBefore = previous?.state.seqThrough ?? 0;
  const batch: AuthorizedBoundaryBatch = {
    version: "challenge-boundary-batch-v1", side: snapshot.side, ordinal: previous ? previous.state.ordinal + 1 : 0,
    phase, turn: snapshot.turn, planningOrdinal: (previous?.state.planningOrdinal ?? 0) + (phase === "settled" ? 1 : 0),
    seqBefore, seqThrough: seqBefore + inputs.length,
    events: inputs.map((event, i) => ({ ...event, seq: seqBefore + i + 1 })) as AuthorizedEvent[], snapshot,
  };
  const state = reconcileBoundary(previous?.state ?? null, batch);
  return { state, history: advanceHistory(previous?.history ?? null, state) };
};
const initial = (o: AuthorizedObservationV1): Session => {
  const snapshot = initialSnapshot(o);
  return publish(null, snapshot, "initial", [
    ...snapshot.ownUnitLineage.map(({ id, square, type }): EventInput => ({ kind: "own-unit-endowed", id, square, type, paidBasis: 0 })),
    ...snapshot.ownMineLineage.map(({ mineId, square }): EventInput => ({ kind: "own-mine-endowed", mineId, square, actionRef: null })),
  ]);
};
const open = (session: Session): Session => {
  const snapshot = clone(session.state.snapshot);
  snapshot.own.gas = snapshot.own.gasIncome;
  return publish(session, snapshot, "turn-open", []);
};
const addMines = (session: Session, squares: Square[], moves: { from: Square; to: Square }[] = []): Session => {
  const prior = open(session);
  const snapshot = clone(prior.state.snapshot);
  snapshot.turn++;
  snapshot.own.gas = 0;
  snapshot.own.gasIncome = 3;
  snapshot.memory.forEach(x => { if (snapshot.cells.find(cell => cell.square === x.square)!.visibility !== "unknown") x.observedTurn = snapshot.turn; });
  for (const move of moves) {
    const unit = snapshot.ownUnitLineage.find(x => x.square === move.from)!;
    unit.square = move.to;
    const own = snapshot.own.pieces.find(x => x.square === move.from)!;
    own.square = move.to;
    snapshot.cells[snapshot.cells.findIndex(x => x.square === move.from)] = { square: move.from, visibility: "lit", piece: null };
    snapshot.cells[snapshot.cells.findIndex(x => x.square === move.to)] = { square: move.to, visibility: "lit", piece: own.piece };
  }
  snapshot.ownUnitLineage.sort((a, b) => a.square < b.square ? -1 : 1);
  snapshot.own.pieces.sort((a, b) => a.square < b.square ? -1 : 1);
  const births: OwnMineLineage[] = squares.map((square, i) => ({
    mineId: `${snapshot.side}:mine:created:${prior.state.ownMineAuditState.ownMineCreationCounter + i + 1}`, square,
  }));
  snapshot.ownMineLineage.push(...births);
  snapshot.ownMineLineage.sort((a, b) => a.square < b.square ? -1 : a.square > b.square ? 1 : a.mineId < b.mineId ? -1 : 1);
  snapshot.own.mines = [...new Set(snapshot.ownMineLineage.map(x => x.square))].sort();
  const ref = (acceptedActionOrdinal: number) => ({ planningOrdinal: prior.state.planningOrdinal, acceptedActionOrdinal });
  const income = Math.min(3, 12 - snapshot.own.minerals);
  snapshot.own.minerals += income;
  return publish(prior, snapshot, "settled", [
    ...births.map((_, i): EventInput => ({ kind: "own-gas-debited", actionRef: ref(i), gas: 1 })),
    ...moves.map(({ from, to }): EventInput => ({ kind: "own-unit-moved", id: prior.state.snapshot.ownUnitLineage.find(x => x.square === from)!.id, from, to })),
    ...births.map(({ mineId, square }, i): EventInput => ({ kind: "own-mine-created", mineId, square, actionRef: ref(i) })),
    { kind: "own-income", actualCreditedMinerals: income },
  ]);
};
const stacked = (count: number, gas = 3, square: Square = "a4"): Session => {
  let session = initial(observation([["h8", "k"], ["a1", "n"], ["b1", "n"], ["c1", "n"]], { mines: count ? [square] : [], minerals: 0 }));
  if (count > 1) session = addMines(session, Array.from({ length: count - 1 }, () => square));
  return gas === 0 ? session : open(session);
};
const removeMines = (session: Session, ids: string[]): Session => {
  const snapshot = clone(session.state.snapshot);
  snapshot.turn++;
  snapshot.own.gas = 0;
  snapshot.ownMineLineage = snapshot.ownMineLineage.filter(x => !ids.includes(x.mineId));
  snapshot.own.mines = [...new Set(snapshot.ownMineLineage.map(x => x.square))].sort();
  const income = Math.min(3, 12 - snapshot.own.minerals);
  snapshot.own.minerals += income;
  return publish(session, snapshot, "settled", [
    ...ids.map((mineId): EventInput => ({ kind: "own-mine-removed", mineId })),
    { kind: "own-income", actualCreditedMinerals: income },
  ]);
};
const asV1 = (history: AuthorizedHistory): AuthorizedObservationV1 => {
  const { side, turn, own, cells, memory } = clone(history.currentAuthorizedSnapshotV2);
  return { version: "challenge-observation-v1", side, turn, own, cells, memory };
};
const guarded = (history: AuthorizedHistory) => {
  const facts = history.currentAuthorizedSnapshotV2;
  const knowledge = countedPlanningKnowledge(planningKnowledge(facts), facts.ownMineLineage.map(x => x.square));
  return { knowledge, failure: (state: PrefixState, action: Parameters<typeof appendFailure>[3]) => appendFailure(facts, knowledge, state, action) };
};

describe("V2 zero-income candidate encoding", () => {
  it.each(["w", "b"] as const)("encodes and decodes pass and hand-authored nonpass keys using the actual recipient, %s", side => {
    const o = observation([[side === "w" ? "a1" : "h8", "k"]], { side, minerals: 0, gas: 0 });
    o.own.gasIncome = 0;
    const history = initial(o).history;
    const before = JSON.stringify(history);
    const decoder = vi.spyOn(codec, "decodeCandidate");
    try {
      const batch = composeV2(history);
      const expectedKeys = side === "w" ? [
        "[]",
        '[{"color":"w","from":"a1","kind":"classical","timing":"C","to":"a2"}]',
        '[{"color":"w","from":"a1","kind":"classical","timing":"C","to":"b1"}]',
        '[{"color":"w","from":"a1","kind":"classical","timing":"C","to":"b2"}]',
      ] : [
        "[]",
        '[{"color":"b","from":"h8","kind":"classical","timing":"C","to":"g7"}]',
        '[{"color":"b","from":"h8","kind":"classical","timing":"C","to":"g8"}]',
        '[{"color":"b","from":"h8","kind":"classical","timing":"C","to":"h7"}]',
      ];
      expect(batch.candidates.map(x => x.key)).toEqual(expectedKeys);
      expect(decoder.mock.calls[0]).toEqual([
        { version: "challenge-candidate-codec-v1", key: "[]", actions: [], ownSpend: { minerals: 0, gas: 0 } }, side,
      ]);
      expect(decoder.mock.calls.every(([, recipient]) => recipient === side)).toBe(true);
      for (const candidate of batch.candidates) {
        expect(candidate.ownSpend).toEqual({ minerals: 0, gas: 0 });
        expect(codec.decodeCandidate(candidate, side)).toEqual(candidate);
        expect(codec.decodeCandidate(JSON.stringify(candidate), side)).toEqual(candidate);
        expect(Object.isFrozen(candidate.actions)).toBe(true);
      }
      expect(batch.diagnostics.activeFamilies).toEqual(["classical"]);
      expect(JSON.stringify(history)).toBe(before);
      expect(() => composeV1(o)).toThrow("$.own.gasIncome");
      const invalid = clone(history);
      invalid.currentAuthorizedSnapshotV2.own.gas = 1;
      expect(() => composeV2(invalid)).toThrow("$.own.gas");
    } finally {
      decoder.mockRestore();
    }
  });

  it.each(["w", "b"] as const)("keeps actual zero resources at root and continuations with all seven actor families, %s", side => {
    const o = allActors(side);
    o.own.gas = 0;
    o.own.gasIncome = 0;
    const history = initial(o).history;
    const guard = vi.spyOn(domain, "appendFailure");
    try {
      const batch = composeV2(history);
      expect(batch.candidates.some(x => x.actions.length > 0)).toBe(true);
      expect(batch.candidates.every(x => x.actions.every(a => a.kind === "classical") && x.ownSpend.gas === 0)).toBe(true);
      expect(batch.diagnostics.activeFamilies).toEqual(["classical"]);
      expect(batch.diagnostics.pruned.resources).toBeGreaterThan(0);
      expect(guard.mock.calls.some(([, , state]) => state.actions.length > 0)).toBe(true);
      expect(guard.mock.calls.every(([facts]) => facts.side === side && facts.own.gas === 0 && facts.own.gasIncome === 0)).toBe(true);
    } finally {
      guard.mockRestore();
    }
  });
});

describe("reconciled V2 history count transport", () => {
  it.each([2, 3])("transports %i live entities to both availability probes and continuation appends", count => {
    const append = vi.spyOn(domain, "appendFailure");
    try {
      composeV2(stacked(count).history);
      expect(append.mock.calls.some(([, , state, action]) => state.actions.length === 0 && action.kind === "spiderMine")).toBe(true);
      expect(append.mock.calls.some(([, , state]) => state.actions.length > 0)).toBe(true);
      expect(append.mock.calls.every(([, knowledge]) => "ownMineCount" in knowledge && knowledge.ownMineCount === count)).toBe(true);
    } finally {
      append.mockRestore();
    }
  });
  it.each([0, 1, 2, 3])("uses %i live IDs at root and in every continuation lane", count => {
    const { history, state } = stacked(count);
    expect(history.currentAuthorizedSnapshotV2.ownMineLineage).toHaveLength(count);
    expect(state.ownMineAuditState.liveOwnMines).toHaveLength(count);
    expect(history.currentAuthorizedSnapshotV2.own.mines).toEqual(count ? ["a4"] : []);
    expect(Object.keys(history).sort()).toEqual(["currentAuthorizedSnapshotV2", "economicState", "everLit", "version"]);
    const batch = composeV2(history);
    const d = batch.diagnostics;
    expect(batch.candidates.length).toBeLessThanOrEqual(512);
    expect(d.attemptedExtensions).toBeLessThanOrEqual(2048);
    expect(batch.candidates.every(x => x.actions.length <= 4)).toBe(true);
    expect(batch.candidates.filter(x => x.actions.length === 0)).toHaveLength(1);
    expect(d.attemptedExtensions).toBe(Object.values(d.pruned).reduce((a, b) => a + b, 0) + d.ownerSkipped + d.quotaSkipped + d.duplicates + d.retainedNonPass);
    expect(d.uniqueIncludingPass).toBe(1 + d.retainedNonPass);
    expect(d.pools.reduce((n, pool) => n + pool.initialCapacity, 0)).toBe(511);
    expect(d.pools.reduce((n, pool) => n + pool.finalCapacity, 0)).toBe(511);
    expect(batch.diagnostics.activeFamilies.includes("spiderMine")).toBe(count < 3);
    const mineCounts = batch.candidates.map(x => x.actions.filter(a => a.kind === "spiderMine").length);
    expect(Math.max(...mineCounts)).toBeLessThanOrEqual(3 - count);
    if (count === 2) {
      expect(Math.max(...mineCounts)).toBe(1);
    }
    if (count === 3) expect(batch.diagnostics.pruned.mineCap).toBeGreaterThan(0);
    const { knowledge, failure } = guarded(history);
    let prefix = emptyPrefix();
    for (const from of ["a1", "b1", "c1"] as const) {
      const drop = s("spiderMine", from);
      expect(failure(prefix, drop)).toBe(count + prefix.mineAnchors.length >= 3 ? "mineCap" : null);
      if (count + prefix.mineAnchors.length < 3) prefix = appendState(knowledge, prefix, drop);
    }
  });

  it("keeps actor/shape/timing/resources ahead of entity cap and occupancy", () => {
    const { history } = stacked(3, 0, "a1");
    const { knowledge, failure } = guarded(history);
    expect(failure(emptyPrefix(), s("spiderMine", "h8", "a1"))).toBe("actor");
    expect(failure(emptyPrefix(), s("spiderMine", "a1", "a1"))).toBe("shape");
    expect(failure(appendState(knowledge, emptyPrefix(), s("spiderMine", "a1")), s("spiderMine", "a1"))).toBe("timing");
    expect(failure(emptyPrefix(), s("spiderMine", "a1"))).toBe("resources");
    const batch = composeV2(history);
    expect(batch.diagnostics.pruned.resources).toBeGreaterThan(0);
    expect(batch.diagnostics.pruned.mineCap).toBe(0);
    expect(batch.diagnostics.activeFamilies).not.toContain("spiderMine");
    expect(guarded(stacked(3, 3, "a1").history).failure(emptyPrefix(), s("spiderMine", "a1"))).toBe("mineCap");
    expect(guarded(stacked(2, 3, "a1").history).failure(emptyPrefix(), s("spiderMine", "a1"))).toBe("ownOccupancy");
  });

  it("counts only the live inventory after retirement while retaining the location projection", () => {
    const three = stacked(3);
    const one = open(removeMines(three, ["w:mine:created:1", "w:mine:created:2"]));
    expect(one.state.ownMineAuditState.ownMineCreationCounter).toBe(2);
    expect(one.state.ownMineAuditState.retiredOwnMineIdsSorted).toEqual(["w:mine:created:1", "w:mine:created:2"]);
    expect(one.history.currentAuthorizedSnapshotV2.ownMineLineage).toEqual([{ mineId: "w:mine:opening:a4", square: "a4" }]);
    const { knowledge, failure } = guarded(one.history);
    expect(knowledge.ownMineCount).toBe(1);
    const first = appendState(knowledge, emptyPrefix(), s("spiderMine", "a1"));
    expect(failure(first, s("spiderMine", "b1"))).toBeNull();
    const second = appendState(knowledge, first, s("spiderMine", "b1"));
    expect(failure(second, s("spiderMine", "c1"))).toBe("mineCap");
    expect(composeV2(one.history).diagnostics.activeFamilies).toContain("spiderMine");
  });

  it("distinguishes current/reserved ownership from cap and counts reservations without deduplication", () => {
    const one = guarded(stacked(1).history);
    const reserve = appendState(one.knowledge, emptyPrefix(), s("spiderMine", "a1", undefined, "F"));
    expect(reserve.mineAnchors).toEqual(["a1"]);
    const relocated = appendState(one.knowledge, reserve, c("b1", "a1"));
    expect(one.failure(relocated, s("spiderMine", "b1", undefined, "F"))).toBe("ownOccupancy");
    const two = guarded(stacked(2).history);
    expect(two.failure(relocated, s("spiderMine", "b1", undefined, "F"))).toBe("mineCap");
    const duplicated: PrefixState = { actions: [], anchors: ["a1", "a1"], mineAnchors: ["a1", "a1"] };
    expect(one.failure(duplicated, s("spiderMine", "c1"))).toBe("mineCap");
  });

  it("transports F-before-C multiplicity while retaining append-time reservations", () => {
    const session = initial(observation([["e1", "k"], ["a3", "n"], ["c3", "n"]], { mines: ["b5"] }));
    const { knowledge, failure } = guarded(session.history);
    const f = s("spiderMine", "a3", undefined, "F");
    const move = c("a3", "b5");
    expect(failure(emptyPrefix(), f)).toBeNull();
    const reserve = appendState(knowledge, emptyPrefix(), f);
    expect(failure(reserve, move)).toBeNull();
    const afterC = appendState(knowledge, reserve, move);
    expect(afterC.mineAnchors).toEqual(["a3"]);
    expect(afterC.anchors).toEqual(["a3", "a3"]);
    const settled = addMines(session, ["b5"], [{ from: "a3", to: "b5" }]);
    expect(settled.history.currentAuthorizedSnapshotV2.ownMineLineage).toEqual([
      { mineId: "w:mine:created:1", square: "b5" }, { mineId: "w:mine:opening:b5", square: "b5" },
    ]);
    const history = open(settled).history;
    const batch = composeV2(history);
    expect(batch.diagnostics.activeFamilies).toContain("spiderMine");
    expect(batch.candidates.some(x => x.actions.some(a => a.kind === "spiderMine" && a.from === "c3"))).toBe(true);
    expect(batch.candidates.every(x => x.actions.filter(a => a.kind === "spiderMine").length <= 1)).toBe(true);
    expect(afterC.mineAnchors).toEqual(["a3"]);
  });
});

describe("V1 complete-byte preservation", () => {
  const hashes = {
    w: ["4d67ac149889cafd82a15ece48061d844a8061691a55ea201b5f65e0b4150908", "4d67ac149889cafd82a15ece48061d844a8061691a55ea201b5f65e0b4150908", "4d67ac149889cafd82a15ece48061d844a8061691a55ea201b5f65e0b4150908", "dbcf4f3c13228190705e9099807e662439e00f6ef8aba0266d136c8c1fe5492c"],
    b: ["57a5afdfda19fda8a5a71da19dcbe9d2ab79763306ffecdff19bef69b84fe253", "57a5afdfda19fda8a5a71da19dcbe9d2ab79763306ffecdff19bef69b84fe253", "57a5afdfda19fda8a5a71da19dcbe9d2ab79763306ffecdff19bef69b84fe253", "2bb5841a5c59a53c8ac752573fb93b40930bdb5aea4f8a90fa02a8ee3ed5509b"],
  };
  it.each(["w", "b"] as const)("matches pre-extraction SHA-256 and complete V2 batch bytes for unique inventories, %s", side => {
    for (const count of [0, 1, 2, 3]) {
      const o = allActors(side);
      o.own.mines = (["a4", "a5", "a6"] as const).slice(0, count);
      const history = initial(o).history;
      const bytes = JSON.stringify(composeV1(o));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(hashes[side][count]);
      expect(JSON.stringify(composeV2(history))).toBe(bytes);
      if (count === 0) expect(composeV2(history).diagnostics.activeFamilies).toEqual(ACTION_KINDS);
    }
  });

  it("adds exactly the history entry to the existing candidate runtime surface", () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      "COMPOSITION_VERSION", "MAX_ATTEMPTED_EXTENSIONS", "MAX_GENERATED_ACTIONS", "MAX_RETAINED_CANDIDATES",
      "composeCandidatesFromHistoryV2", "composeCandidatesFromObservationV1", "decodeCandidate",
    ]);
  });

  it.each(["w", "b"] as const)("preserves current own siege modes and unknown cells, %s", side => {
    const o = allActors(side);
    o.own.siegedTanks = ["e5"];
    const history = initial(o).history;
    expect(JSON.stringify(composeV2(history))).toBe(JSON.stringify(composeV1(o)));
  });
});

describe("closed history validation and detachment", () => {
  it("reports stable schema errors for primitive, array and inherited roots", () => {
    const history = initial(observation()).history;
    for (const value of [undefined, null, false, 0, NaN, "{}", Symbol("history"), () => history, [], new Date(), Object.create(history)]) {
      expectContractError(() => composeV2(value as AuthorizedHistory), "$", "SCHEMA");
    }
  });

  it("reports exact history schema/version/ledger error paths and codes", () => {
    const history = initial(observation()).history;
    const cases: { mutate: (h: Mutable<AuthorizedHistory>) => void; path: string; code: string }[] = [
      { mutate: h => { Object.assign(h, { ownMineCount: 0 }); }, path: "$", code: "SCHEMA" },
      { mutate: h => { Object.assign(h, { [Symbol("extra")]: 0 }); }, path: "$", code: "SCHEMA" },
      { mutate: h => { delete (h as Partial<Mutable<AuthorizedHistory>>).version; }, path: "$", code: "SCHEMA" },
      { mutate: h => { Object.defineProperty(h, "version", { enumerable: false }); }, path: "$.version", code: "SCHEMA" },
      { mutate: h => { Object.assign(h, { version: "challenge-history-v1" }); }, path: "$.version", code: "VERSION" },
      { mutate: h => { h.economicState.enemyLoss.confirmedUnitCount = 1; h.economicState.enemyLoss.replacementLowerBound = 1; }, path: "$.economicState", code: "CONSISTENCY" },
      { mutate: h => { h.economicState.side = "b"; }, path: "$.economicState.side", code: "SIDE" },
      { mutate: h => { Object.assign(h.economicState, { ownMineCount: 0 }); }, path: "$.economicState", code: "SCHEMA" },
      { mutate: h => { h.economicState = Object.create(h.economicState); }, path: "$.economicState", code: "SCHEMA" },
    ];
    for (const { mutate, path, code } of cases) {
      const value = clone(history);
      mutate(value);
      expectContractError(() => composeV2(value), path, code);
    }
  });

  it("distinguishes malformed, oversized, unordered and inconsistent everLit", () => {
    const history = initial(observation()).history;
    const cases: { mutate: (h: Mutable<AuthorizedHistory>) => void; path: string; code: string }[] = [
      { mutate: h => { Object.assign(h, { everLit: { 0: "a1", length: 1 } }); }, path: "$.everLit", code: "ARRAY" },
      { mutate: h => { Object.setPrototypeOf(h.everLit, {}); }, path: "$.everLit", code: "ARRAY" },
      { mutate: h => { h.everLit = Array.from({ length: 65 }, () => "a1"); }, path: "$.everLit", code: "CARDINALITY" },
      { mutate: h => { delete h.everLit[0]; }, path: "$.everLit", code: "ARRAY" },
      { mutate: h => { Object.assign(h.everLit, { ownMineCount: 0 }); }, path: "$.everLit", code: "ARRAY" },
      { mutate: h => { Object.defineProperty(h.everLit, "0", { enumerable: false }); }, path: "$.everLit[0]", code: "ARRAY" },
      { mutate: h => { h.everLit[0] = "z9" as Square; }, path: "$.everLit[0]", code: "SCHEMA" },
      { mutate: h => { Object.assign(h.everLit, { 0: 1 }); }, path: "$.everLit[0]", code: "SCHEMA" },
      { mutate: h => { h.everLit.reverse(); }, path: "$.everLit", code: "ORDER" },
      { mutate: h => { h.everLit[1] = h.everLit[0]!; }, path: "$.everLit", code: "ORDER" },
      { mutate: h => { h.everLit = h.everLit.slice(1); }, path: "$.everLit", code: "CONSISTENCY" },
    ];
    for (const { mutate, path, code } of cases) {
      const value = clone(history);
      mutate(value);
      expectContractError(() => composeV2(value), path, code);
    }
  });

  it("reports descriptor errors without evaluating root, ledger or everLit getters", () => {
    const history = initial(observation()).history;
    let reads = 0;
    const getter = () => { reads++; throw new Error("getter executed"); };
    for (const key of ["version", "currentAuthorizedSnapshotV2", "economicState", "everLit"]) {
      const value = clone(history);
      Object.defineProperty(value, key, { enumerable: true, get: getter });
      expectContractError(() => composeV2(value), `$.${key}`, "SCHEMA");
    }
    const lit = clone(history);
    Object.defineProperty(lit.everLit, "0", { enumerable: true, get: getter });
    expectContractError(() => composeV2(lit), "$.everLit[0]", "ARRAY");
    const economic = clone(history);
    Object.defineProperty(economic.economicState, "ownPaidDebits", { enumerable: true, get: getter });
    expectContractError(() => composeV2(economic), "$.economicState.ownPaidDebits", "SCHEMA");
    const extra = clone(history);
    Object.defineProperty(extra, "ownMineCount", { enumerable: true, get: getter });
    expectContractError(() => composeV2(extra), "$", "SCHEMA");
    expect(reads).toBe(0);
  });

  it("preserves V1 codec error paths, codes and messages", () => {
    const o = observation();
    Object.assign(o, { version: "challenge-observation-v2" });
    expectContractError(() => composeV1(o), "$.version", "VERSION");
    const zero = observation();
    zero.own.gas = 0;
    zero.own.gasIncome = 0;
    expectContractError(() => composeV1(zero), "$.own.gasIncome", "NUMBER");
    let reads = 0;
    const accessor = observation();
    Object.defineProperty(accessor, "version", { enumerable: true, get: () => { reads++; return "challenge-observation-v1"; } });
    expectContractError(() => composeV1(accessor), "$", "SCHEMA");
    expect(reads).toBe(0);
  });

  it("ignores stale enemy memory when building current knowledge", () => {
    const session = initial(observation([["h8", "k"], ["a1", "q"]], { enemy: [["e5", "p"]] }));
    const current = clone(session.state.snapshot);
    current.cells[current.cells.findIndex(x => x.square === "e5")] = { square: "e5", visibility: "unknown" };
    const history = publish(session, current, "turn-open", []).history;
    expect(history.currentAuthorizedSnapshotV2.memory).toEqual([{ square: "e5", piece: { type: "p", color: "b" }, observedTurn: 21 }]);
    expect(composeV2(history).candidates.some(x => x.actions.some(a => a.kind === "tacticalJump" && a.to === "e5"))).toBe(true);
    expect(JSON.stringify(composeV2(history))).toBe(JSON.stringify(composeV1(asV1(history))));
  });

  it("detaches the input and freezes the entire result", () => {
    const history = clone(stacked(2).history);
    const original = JSON.stringify(history);
    const batch = composeV2(history);
    expect(JSON.stringify(history)).toBe(original);
    expect(Object.isFrozen(history)).toBe(false);
    const saved = JSON.stringify(batch);
    history.currentAuthorizedSnapshotV2.ownMineLineage.length = 0;
    history.currentAuthorizedSnapshotV2.own.pieces[0]!.piece.type = "q";
    history.everLit.length = 0;
    expect(JSON.stringify(batch)).toBe(saved);
    const checkFrozen = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      expect(Object.isFrozen(value)).toBe(true);
      Object.values(value).forEach(checkFrozen);
    };
    checkFrozen(batch);
  });

  it("rejects forged fields, malformed live IDs/order/projection and inconsistent ledgers", () => {
    const mutations: ((h: Mutable<AuthorizedHistory>) => unknown)[] = [
      h => Object.assign(h, { ownMineCount: 2 }), h => Object.assign(h, { ownMineAuditState: {} }),
      h => Object.assign(h, { version: "challenge-history-v1" }), h => Object.assign(h, { extra: 0 }),
      h => Object.assign(h, { [Symbol("extra")]: 1 }), h => Object.assign(h.currentAuthorizedSnapshotV2, { ownMineCount: 2 }),
      h => Object.assign(h.currentAuthorizedSnapshotV2.own, { ownMineCount: 2 }),
      h => Object.assign(h.currentAuthorizedSnapshotV2.ownMineLineage[0]!, { ownMineCount: 2 }),
      h => { h.currentAuthorizedSnapshotV2.ownMineLineage[0]!.mineId = "w:mine:created:01"; },
      h => { h.currentAuthorizedSnapshotV2.ownMineLineage[0]!.mineId = "b:mine:created:1"; },
      h => { h.currentAuthorizedSnapshotV2.ownMineLineage[0]!.mineId = h.currentAuthorizedSnapshotV2.ownMineLineage[1]!.mineId; },
      h => h.currentAuthorizedSnapshotV2.ownMineLineage.reverse(),
      h => { h.currentAuthorizedSnapshotV2.ownMineLineage[0]!.square = "a5"; },
      h => { h.currentAuthorizedSnapshotV2.ownMineLineage[1]!.mineId = "w:mine:opening:a5"; },
      h => { delete h.currentAuthorizedSnapshotV2.ownMineLineage[0]; },
      h => { h.currentAuthorizedSnapshotV2.ownMineLineage.push({ mineId: "w:mine:created:2", square: "a4" }, { mineId: "w:mine:created:3", square: "a4" }); },
      h => { h.currentAuthorizedSnapshotV2.own.mines = []; },
      h => { h.economicState.side = "b"; }, h => Object.assign(h.economicState, { count: 2 }),
      h => { h.economicState.enemyLoss.confirmedUnitCount = 1; h.economicState.enemyLoss.replacementLowerBound = 1; },
      h => { h.everLit = []; }, h => h.everLit.reverse(), h => { delete h.everLit[0]; },
      h => { h.everLit.push(h.everLit.at(-1)!); }, h => { h.everLit[0] = "z9" as Square; },
      h => Object.setPrototypeOf(h, { version: h.version }),
    ];
    for (const mutate of mutations) {
      const h = clone(stacked(2).history);
      mutate(h);
      expect(() => composeV2(h)).toThrow();
    }
    expect(() => composeV2(Object.create(stacked(2).history))).toThrow();
  });

  it("rejects history/snapshot/ledger/everLit accessors without executing them", () => {
    let reads = 0;
    const getter = () => { reads++; throw new Error("getter executed"); };
    const mutations: ((h: Mutable<AuthorizedHistory>) => void)[] = [
      ...["version", "currentAuthorizedSnapshotV2", "economicState", "everLit"].map(key => (h: Mutable<AuthorizedHistory>) => {
        Object.defineProperty(h, key, { enumerable: true, get: getter });
      }),
      h => { Object.defineProperty(h.everLit, "0", { enumerable: true, get: getter }); },
      h => { Object.defineProperty(h.economicState, "ownPaidDebits", { enumerable: true, get: getter }); },
      h => { Object.defineProperty(h.currentAuthorizedSnapshotV2.ownMineLineage[0]!, "mineId", { enumerable: true, get: getter }); },
      h => { Object.defineProperty(h.currentAuthorizedSnapshotV2.cells[0]!, "piece", { enumerable: true, get: getter }); },
    ];
    for (const mutate of mutations) {
      const h = clone(stacked(2).history);
      mutate(h);
      expect(() => composeV2(h)).toThrow();
    }
    expect(reads).toBe(0);
  });
});
