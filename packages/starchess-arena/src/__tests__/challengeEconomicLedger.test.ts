import { describe, expect, it } from "vitest";
import { advanceHistory, reconcileBoundary, validateBoundaryBatch } from "../events";
import { ContractError } from "../challengeContract/validation";
import type { AuthorizedBoundaryBatch, AuthorizedEvent, AuthorizedHistory, AuthorizedSnapshotV2, EconomicState, OwnMineLineage, OwnUnitLineage, ReconciledBoundaryState, Sighting, Square } from "../observations";

const loss0 = { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" } as const;
const economy0: EconomicState = { version: "challenge-economic-ledger-v1", side: "w", ownPaidDebits: 0, ownPaidSurviving: 0, ownPaidDestroyed: 0, ownPaidWasted: 0, ownReplacementDestroyed: 0, enemyLoss: loss0, receipts: [], retiredOwnIds: [] };
const openingUnits: OwnUnitLineage[] = [
  { id: "w:unit:opening:a2", square: "a2", type: "p", paidBasis: 0, replacementValue: 1 },
  { id: "w:unit:opening:b2", square: "b2", type: "n", paidBasis: 0, replacementValue: 3 },
  { id: "w:unit:opening:c2", square: "c2", type: "r", paidBasis: 0, replacementValue: 5 },
  { id: "w:unit:opening:e1", square: "e1", type: "k", paidBasis: 0, replacementValue: 0 },
];
const openingMines: OwnMineLineage[] = [{ mineId: "w:mine:opening:b2", square: "b2" }];
const snapshot = (turn: number, gas: number, minerals: number, units: readonly OwnUnitLineage[], mines: readonly OwnMineLineage[], economy: EconomicState, memory: readonly Sighting[] = [], ccLives = 3): AuthorizedSnapshotV2 => {
  const pieces = units.map(x => ({ square: x.square, piece: { type: x.type, color: "w" as const } }));
  return { version: "challenge-observation-v2", side: "w", turn,
    own: { minerals, gas, gasIncome: 3, ccLives, pieces, mines: [...new Set(mines.map(x => x.square))].sort(), siegedTanks: [] },
    cells: Array.from({ length: 64 }, (_, i) => {
      const square = `${"abcdefgh"[Math.floor(i / 8)]}${i % 8 + 1}` as Square;
      const piece = pieces.find(x => x.square === square)?.piece ?? null;
      return piece || mines.some(x => x.square === square) ? { square, visibility: "lit" as const, piece } : { square, visibility: "unknown" as const };
    }), memory, ownUnitLineage: units, ownMineLineage: mines, economicState: economy };
};
type EventInput = AuthorizedEvent extends infer E ? E extends AuthorizedEvent ? Omit<E, "seq"> : never : never;
const batch = (ordinal: number, seqBefore: number, snap: AuthorizedSnapshotV2, events: readonly EventInput[]): AuthorizedBoundaryBatch => ({
  version: "challenge-boundary-batch-v1", side: "w", ordinal, phase: ordinal === 0 ? "initial" : ordinal % 2 ? "turn-open" : "settled", turn: snap.turn,
  planningOrdinal: Math.floor(ordinal / 2), seqBefore, seqThrough: seqBefore + events.length,
  events: events.map((x, i) => ({ ...x, seq: seqBefore + i + 1 })) as AuthorizedEvent[], snapshot: snap,
});
const initial = () => batch(0, 0, snapshot(21, 0, 12, openingUnits, openingMines, economy0), [
  ...openingUnits.map(x => ({ kind: "own-unit-endowed" as const, id: x.id, square: x.square, type: x.type, paidBasis: 0 as const })),
  { kind: "own-mine-endowed", mineId: "w:mine:opening:b2", actionRef: null, square: "b2" },
]);
const lifecycle = () => {
  const start = initial();
  const open = batch(1, start.seqThrough, snapshot(21, 3, 12, openingUnits, openingMines, economy0), []);
  const swapped = [
    { ...openingUnits[1]!, square: "a2" as const }, { ...openingUnits[0]!, square: "b2" as const }, openingUnits[3]!,
  ];
  const stacked: OwnMineLineage[] = [{ mineId: "w:mine:created:1", square: "b2" }, { mineId: "w:mine:created:2", square: "b2" }, ...openingMines];
  const paid: EconomicState = { ...economy0, ownPaidDebits: 5, ownPaidDestroyed: 5, ownReplacementDestroyed: 10,
    enemyLoss: { ...loss0, confirmedUnitCount: 1, replacementLowerBound: 9 },
    receipts: [{ receiptId: "w:receipt:0:0", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, unit: "r", requestedSquare: "c2", minerals: 5, disposition: { kind: "materialized", lineageId: "w:unit:created:1" } }],
    retiredOwnIds: ["w:unit:created:1", "w:unit:opening:c2"],
  };
  const memory: Sighting[] = [{ square: "h6", piece: { type: "p", color: "b" }, observedTurn: 21 }, { square: "h7", piece: { type: "q", color: "b" }, observedTurn: 21 }];
  const settle = batch(2, open.seqThrough, snapshot(22, 0, 10, swapped, stacked, paid, memory), [
    { kind: "own-paid-receipt", receiptId: "w:receipt:0:0", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, unit: "r", requestedSquare: "c2", minerals: 5 },
    { kind: "own-gas-debited", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, gas: 1 },
    { kind: "own-gas-debited", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 1 }, gas: 1 },
    { kind: "own-gas-debited", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 2 }, gas: 1 },
    { kind: "vision-witness", turn: 21, changes: [{ square: "h6", visibility: "lit", piece: { type: "p", color: "b" } }, { square: "h7", visibility: "revealed", piece: { type: "q", color: "b" } }, { square: "h8", visibility: "lit", piece: { type: "q", color: "b" } }] },
    { kind: "own-unit-created", lineageId: "w:unit:created:1", receiptId: "w:receipt:0:0", square: "c2", type: "r" },
    { kind: "own-unit-destroyed", id: "w:unit:opening:c2", typeAtLoss: "r", square: "c2", retiredPaidBasis: 0 },
    { kind: "own-unit-destroyed", id: "w:unit:created:1", typeAtLoss: "r", square: "c2", retiredPaidBasis: 5 },
    { kind: "own-unit-moved", id: "w:unit:opening:a2", from: "a2", to: "b2" },
    { kind: "own-unit-moved", id: "w:unit:opening:b2", from: "b2", to: "a2" },
    { kind: "own-mine-created", mineId: "w:mine:created:1", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 1 }, square: "b2" },
    { kind: "own-mine-created", mineId: "w:mine:created:2", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 2 }, square: "b2" },
    { kind: "enemy-unit-destruction-witnessed", witnessId: "w:witness:1", square: "h8", type: "q", replacementLowerBound: 9, paidLowerBound: 0 },
    { kind: "own-income", actualCreditedMinerals: 3 },
  ]);
  const open2 = batch(3, settle.seqThrough, snapshot(22, 3, 10, swapped, stacked, paid, memory), []);
  const wasted: EconomicState = { ...paid, ownPaidDebits: 14, ownPaidWasted: 9, enemyLoss: { ...loss0, confirmedUnitCount: 2, replacementLowerBound: 10 },
    receipts: [...paid.receipts, { receiptId: "w:receipt:1:0", actionRef: { planningOrdinal: 1, acceptedActionOrdinal: 0 }, unit: "q", requestedSquare: "d2", minerals: 9, disposition: { kind: "unmaterialized" } }] };
  const transformed = swapped.map(x => x.type === "p" ? { ...x, type: "q" as const, replacementValue: 9 } : x);
  const settle2 = batch(4, open2.seqThrough, snapshot(23, 0, 4, transformed, [], wasted, [memory[1]!]), [
    { kind: "own-paid-receipt", receiptId: "w:receipt:1:0", actionRef: { planningOrdinal: 1, acceptedActionOrdinal: 0 }, unit: "q", requestedSquare: "d2", minerals: 9 },
    { kind: "own-gas-debited", actionRef: { planningOrdinal: 1, acceptedActionOrdinal: 0 }, gas: 1 },
    { kind: "own-deployment-unmaterialized", receiptId: "w:receipt:1:0", paidMinerals: 9 },
    { kind: "own-unit-transformed", id: "w:unit:opening:a2", fromType: "p", toType: "q", paidDelta: 0 },
    { kind: "own-mine-removed", mineId: "w:mine:created:1" }, { kind: "own-mine-removed", mineId: "w:mine:created:2" }, { kind: "own-mine-removed", mineId: "w:mine:opening:b2" },
    { kind: "enemy-unit-destruction-witnessed", witnessId: "w:witness:2", square: "h6", type: "p", replacementLowerBound: 1, paidLowerBound: 0 },
    { kind: "own-income", actualCreditedMinerals: 3 },
  ]);
  return { start, open, settle, open2, settle2 };
};
const prefix = () => {
  const f = lifecycle();
  const start = reconcileBoundary(null, f.start), open = reconcileBoundary(start, f.open), settle = reconcileBoundary(open, f.settle), open2 = reconcileBoundary(settle, f.open2);
  return { f, start, open, settle, open2 };
};
type Mutable<T> = T extends readonly (infer E)[] ? Mutable<E>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
const mutateBatch = (b: AuthorizedBoundaryBatch): Mutable<AuthorizedBoundaryBatch> => structuredClone(b) as Mutable<AuthorizedBoundaryBatch>;
describe("pure authorized boundary economic ledger", () => {
  it("folds an independent lifecycle including swaps, replacement, newborn death, stacked mines, waste and free transformation", () => {
    const { f, start, open, settle, open2 } = prefix();
    const end = reconcileBoundary(open2, f.settle2);
    expect(start.economicState).toEqual(economy0);
    expect(settle.economicState).toEqual(f.settle.snapshot.economicState);
    expect(end.economicState).toEqual(f.settle2.snapshot.economicState);
    expect(end.economicState.ownPaidDebits).toBe(14);
    expect(end.economicState.ownPaidSurviving + end.economicState.ownPaidDestroyed + end.economicState.ownPaidWasted).toBe(14);
    expect(end.snapshot.ownUnitLineage.find(x => x.id === "w:unit:opening:a2")).toMatchObject({ square: "b2", type: "q", paidBasis: 0, replacementValue: 9 });
    expect(settle.ownMineAuditState).toEqual({ liveOwnMines: f.settle.snapshot.ownMineLineage, retiredOwnMineIdsSorted: [], ownMineCreationCounter: 2 });
    expect(settle.snapshot.own.mines).toEqual(["b2"]);
    expect(end.ownMineAuditState).toEqual({ liveOwnMines: [], retiredOwnMineIdsSorted: ["w:mine:created:1", "w:mine:created:2", "w:mine:opening:b2"], ownMineCreationCounter: 2 });
    expect(settle.everLit).toEqual(["a2", "b2", "c2", "e1", "h6", "h8"]);
    expect(end.snapshot.memory).toEqual([{ square: "h7", piece: { type: "q", color: "b" }, observedTurn: 21 }]);
    let history: AuthorizedHistory | null = null;
    for (const boundary of [start, open, settle, open2, end]) history = advanceHistory(history, boundary);
    expect(history).toEqual({ version: "challenge-history-v2", currentAuthorizedSnapshotV2: end.snapshot, economicState: end.economicState, everLit: end.everLit });
    expect(Object.keys(history!).sort()).toEqual(["currentAuthorizedSnapshotV2", "economicState", "everLit", "version"]);
    expect(Object.isFrozen(history!.currentAuthorizedSnapshotV2.ownUnitLineage)).toBe(true);
  });
  it("returns byte-and-SHA-identical last replay without advancement and owns fresh bytes", () => {
    const { f, open, settle } = prefix();
    const replay = reconcileBoundary(settle, f.settle);
    expect(replay).toEqual(settle); expect(replay.lastBatchBytes).not.toBe(settle.lastBatchBytes);
    const first = reconcileBoundary(open, f.settle);
    first.lastBatchBytes.fill(0);
    expect(reconcileBoundary(settle, f.settle)).toEqual(settle);
    const changed = mutateBatch(f.settle); changed.snapshot.own.minerals--;
    expect(() => reconcileBoundary(settle, changed)).toThrow("DUPLICATE: $");
    expect(() => reconcileBoundary(settle, f.start)).toThrow("SEQUENCE: $");
    expect(() => reconcileBoundary(settle, f.open)).toThrow("SEQUENCE: $");
    expect(() => reconcileBoundary(null, f.open)).toThrow("SEQUENCE: $");
  });
  it.each([
    ["missing disposition", (b: Mutable<AuthorizedBoundaryBatch>) => { b.events.splice(5, 1); }],
    ["wrong birth ID", (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[5]!, { lineageId: "w:unit:created:2" })],
    ["wrong paid retirement", (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[7]!, { retiredPaidBasis: 0 })],
    ["wrong from", (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[8]!, { from: "a1" })],
    ["mine counter gap", (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[10]!, { mineId: "w:mine:created:3" })],
    ["unknown mine removal", (b: Mutable<AuthorizedBoundaryBatch>) => b.events.splice(10, 0, { kind: "own-mine-removed", mineId: "w:mine:created:3", seq: 1 })],
    ["wrong witness counter", (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[12]!, { witnessId: "w:witness:2" })],
    ["wrong credited income", (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[13]!, { actualCreditedMinerals: 2 })],
    ["casualty stale memory", (b: Mutable<AuthorizedBoundaryBatch>) => b.snapshot.memory.push({ square: "h8", piece: { type: "q", color: "b" }, observedTurn: 21 })],
    ["gas underpayment for mine", (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[2]!, { gas: 2 })],
    ["wrong final gas", (b: Mutable<AuthorizedBoundaryBatch>) => { b.snapshot.own.gas = 1; }],
    ["wrong tank mode", (b: Mutable<AuthorizedBoundaryBatch>) => b.events.splice(5, 0, { kind: "own-unit-mode-changed", seq: 1, id: "w:unit:opening:a2", mode: "siege" })],
  ] as const)("rejects %s transactionally", (_name, change) => {
    const { f, open } = prefix(), priorBytes = open.lastBatchBytes.slice(), before = structuredClone(open);
    const b = mutateBatch(f.settle); change(b);
    b.events.forEach((e, i) => { e.seq = b.seqBefore + i + 1; }); b.seqThrough = b.seqBefore + b.events.length;
    expect(() => reconcileBoundary(open, b)).toThrow(ContractError);
    expect(open).toEqual(before); expect(open.lastBatchBytes).toEqual(priorBytes);
  });
  it("rejects malformed closed events, wrong debit order, action refs, sequence gaps and initial resets", () => {
    const { f, start, open } = prefix();
    const invalid: AuthorizedBoundaryBatch[] = [
      { ...f.settle, ordinal: 4 }, { ...f.settle, seqBefore: f.settle.seqBefore + 1 }, { ...f.settle, turn: 24 },
      { ...f.open, events: [{ kind: "own-income", seq: f.open.seqThrough + 1, actualCreditedMinerals: 0 }], seqThrough: f.open.seqThrough + 1 },
    ];
    for (const change of [
      (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[0]!, { privateFrame: "hidden" }),
      (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[0]!, { minerals: 4 }),
      (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[0]!, { receiptId: "w:receipt:00:0" }),
      (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[2]!, { actionRef: { planningOrdinal: 1, acceptedActionOrdinal: 1 } }),
      (b: Mutable<AuthorizedBoundaryBatch>) => { [b.events[0], b.events[4]] = [b.events[4]!, b.events[0]!]; },
      (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[4]!, { changes: [] }),
      (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[4]!, { turn: 20 }),
      (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[12]!, { type: "k", replacementLowerBound: 1 }),
      (b: Mutable<AuthorizedBoundaryBatch>) => Object.assign(b.events[12]!, { paidLowerBound: 1 }),
    ]) { const b = mutateBatch(f.settle); change(b); b.events.forEach((e, i) => { e.seq = b.seqBefore + i + 1; }); invalid.push(b); }
    invalid.forEach(b => expect(() => reconcileBoundary(open, b)).toThrow(ContractError));
    expect(() => reconcileBoundary(open, f.start)).toThrow(ContractError);
    expect(() => reconcileBoundary(start, { ...f.start, ordinal: 1 })).toThrow(ContractError);
    expect(() => validateBoundaryBatch({ ...f.start, events: [], seqThrough: 0 })).toThrow(ContractError);
    const wrongEndowment = mutateBatch(f.start);
    Object.assign(wrongEndowment.events[0]!, { id: "w:unit:created:1" });
    expect(() => validateBoundaryBatch(wrongEndowment)).toThrow(ContractError);
  });
  it("clears only matching casualty types before later vision repopulates memory", () => {
    const { f, open2 } = prefix();
    const b = mutateBatch(f.settle2);
    b.events.splice(b.events.length - 1, 0, { kind: "vision-witness", seq: 1, turn: 22, changes: [{ square: "h6", visibility: "lit", piece: { type: "n", color: "b" } }] });
    b.events.forEach((e, i) => { e.seq = b.seqBefore + i + 1; }); b.seqThrough++;
    b.snapshot.memory.unshift({ square: "h6", piece: { type: "n", color: "b" }, observedTurn: 22 });
    expect(reconcileBoundary(open2, b).snapshot.memory).toEqual(b.snapshot.memory);
    const mismatch = mutateBatch(f.settle2);
    Object.assign(mismatch.events[7]!, { type: "n", replacementLowerBound: 3 });
    mismatch.snapshot.economicState.enemyLoss.replacementLowerBound = 12;
    mismatch.snapshot.memory.unshift({ square: "h6", piece: { type: "p", color: "b" }, observedTurn: 21 });
    expect(reconcileBoundary(open2, mismatch).snapshot.memory).toEqual(mismatch.snapshot.memory);
  });
  it("grants one capped zero income at settlement and none at opening or terminal open", () => {
    const start = reconcileBoundary(null, initial());
    const openBatch = batch(1, start.seqThrough, { ...start.snapshot, own: { ...start.snapshot.own, gas: 3 } }, []);
    const open = reconcileBoundary(start, openBatch);
    const settled = batch(2, open.seqThrough, { ...open.snapshot, turn: 22, own: { ...open.snapshot.own, gas: 0 } }, [{ kind: "own-income", actualCreditedMinerals: 0 }]);
    expect(reconcileBoundary(open, settled).snapshot.own.minerals).toBe(12);
    const terminal = batch(1, start.seqThrough, { ...start.snapshot, turn: 22, own: { ...start.snapshot.own, gas: 3, ccLives: 0 } }, [{ kind: "own-cc-lives-changed", before: 3, after: 0 }]);
    const terminalState = reconcileBoundary(start, terminal);
    expect(terminalState.snapshot.own.minerals).toBe(12); expect(terminalState.planningOrdinal).toBe(0);
    expect(() => reconcileBoundary(terminalState, { ...settled, seqBefore: terminal.seqThrough, seqThrough: terminal.seqThrough + 1, events: [{ kind: "own-income", seq: terminal.seqThrough + 1, actualCreditedMinerals: 0 }] })).toThrow(ContractError);
  });
  it("binds four-key history to exact snapshot/ledger/everLit and rejects forged audit state", () => {
    const { start, open, settle } = prefix(), history = advanceHistory(null, start);
    for (const bad of [
      { ...history, ownMineCount: 1 }, { ...history, economicState: settle.economicState }, { ...history, everLit: [] },
      { ...history, everLit: [...history.everLit, history.everLit[0]!] },
    ]) expect(() => advanceHistory(bad, open)).toThrow(ContractError);
    expect(() => advanceHistory(null, settle)).toThrow(ContractError);
    for (const bad of [
      { ...settle, ownMineAuditState: { ...settle.ownMineAuditState, ownMineCreationCounter: 3 } },
      { ...settle, ownMineAuditState: { ...settle.ownMineAuditState, liveOwnMines: [] } },
      { ...settle, economicState: economy0 }, { ...settle, extra: 1 },
    ]) expect(() => advanceHistory(history, bad)).toThrow(ContractError);
    expect(advanceHistory(advanceHistory(history, open), settle).economicState).toEqual(settle.snapshot.economicState);
  });
  it("preserves a surviving paid basis through promotion and retires that basis at the later type's replacement price", () => {
    const start = reconcileBoundary(null, initial());
    const open = reconcileBoundary(start, batch(1, start.seqThrough, snapshot(21, 3, 12, openingUnits, openingMines, economy0), []));
    const paidUnit: OwnUnitLineage = { id: "w:unit:created:1", square: "d2", type: "q", paidBasis: 1, replacementValue: 9 };
    const economy: EconomicState = { ...economy0, ownPaidDebits: 1, ownPaidSurviving: 1,
      receipts: [{ receiptId: "w:receipt:0:0", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, unit: "p", requestedSquare: "d2", minerals: 1, disposition: { kind: "materialized", lineageId: "w:unit:created:1" } }] };
    const units = [...openingUnits.slice(0, 3), paidUnit, openingUnits[3]!];
    const birth = batch(2, open.seqThrough, snapshot(22, 0, 12, units, openingMines, economy), [
      { kind: "own-paid-receipt", receiptId: "w:receipt:0:0", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, unit: "p", requestedSquare: "d2", minerals: 1 },
      { kind: "own-gas-debited", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, gas: 1 },
      { kind: "own-unit-created", lineageId: "w:unit:created:1", receiptId: "w:receipt:0:0", square: "d2", type: "p" },
      { kind: "own-unit-transformed", id: "w:unit:created:1", fromType: "p", toType: "q", paidDelta: 0 },
      { kind: "own-income", actualCreditedMinerals: 1 },
    ]);
    const live = reconcileBoundary(open, birth);
    expect(live.economicState.ownPaidSurviving).toBe(1);
    const open2 = reconcileBoundary(live, batch(3, live.seqThrough, snapshot(22, 3, 12, units, openingMines, economy), []));
    const loss: EconomicState = { ...economy, ownPaidSurviving: 0, ownPaidDestroyed: 1, ownReplacementDestroyed: 9, retiredOwnIds: [paidUnit.id] };
    const died = reconcileBoundary(open2, batch(4, open2.seqThrough, snapshot(23, 0, 12, openingUnits, openingMines, loss), [
      { kind: "own-unit-destroyed", id: paidUnit.id, square: "d2", typeAtLoss: "q", retiredPaidBasis: 1 }, { kind: "own-income", actualCreditedMinerals: 0 },
    ]));
    expect(died.economicState).toEqual(loss);
  });
  it("audits created-and-removed mine occurrences and preserves a location while one occurrence remains", () => {
    const { f, open2 } = prefix();
    const partial = mutateBatch(f.settle2);
    partial.events.splice(6, 1);
    partial.events.forEach((e, i) => { e.seq = partial.seqBefore + i + 1; }); partial.seqThrough--;
    partial.snapshot.ownMineLineage = [...openingMines]; partial.snapshot.own.mines = ["b2"];
    const kept = reconcileBoundary(open2, partial);
    expect(kept.ownMineAuditState.liveOwnMines).toEqual(openingMines);
    expect(kept.ownMineAuditState.retiredOwnMineIdsSorted).toEqual(["w:mine:created:1", "w:mine:created:2"]);
    const start = reconcileBoundary(null, initial());
    const open = reconcileBoundary(start, batch(1, start.seqThrough, snapshot(21, 3, 12, openingUnits, openingMines, economy0), []));
    const removed = reconcileBoundary(open, batch(2, open.seqThrough, snapshot(22, 0, 12, openingUnits, openingMines, economy0), [
      { kind: "own-gas-debited", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, gas: 1 },
      { kind: "own-mine-created", mineId: "w:mine:created:1", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, square: "b2" },
      { kind: "own-mine-removed", mineId: "w:mine:created:1" }, { kind: "own-income", actualCreditedMinerals: 0 },
    ]));
    expect(removed.ownMineAuditState).toEqual({ liveOwnMines: openingMines, retiredOwnMineIdsSorted: ["w:mine:created:1"], ownMineCreationCounter: 1 });
  });
  it("reconciles tank modes and dated final memory while clearing lit empty cells", () => {
    const initialBatch = initial(), initialSnapshot = mutateBatch(initialBatch).snapshot;
    initialSnapshot.cells[63] = { square: "h8", visibility: "revealed", piece: { type: "q", color: "b" } };
    initialSnapshot.memory = [{ square: "h8", piece: { type: "q", color: "b" }, observedTurn: 21 }];
    const start = reconcileBoundary(null, { ...initialBatch, snapshot: initialSnapshot });
    const open = reconcileBoundary(start, batch(1, start.seqThrough, { ...initialSnapshot, own: { ...initialSnapshot.own, gas: 3 } }, []));
    const settledSnapshot = structuredClone(open.snapshot) as Mutable<AuthorizedSnapshotV2>;
    settledSnapshot.turn = 22; settledSnapshot.own.gas = 0; settledSnapshot.own.siegedTanks = ["c2"];
    settledSnapshot.memory[0]!.observedTurn = 22;
    const settled = reconcileBoundary(open, batch(2, open.seqThrough, settledSnapshot, [
      { kind: "own-gas-debited", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, gas: 1 },
      { kind: "own-unit-mode-changed", id: "w:unit:opening:c2", mode: "siege" }, { kind: "own-income", actualCreditedMinerals: 0 },
    ]));
    expect(settled.snapshot.memory[0]!.observedTurn).toBe(22); expect(settled.everLit).not.toContain("h8");
    const nextSnapshot = structuredClone(settled.snapshot) as Mutable<AuthorizedSnapshotV2>;
    nextSnapshot.own.gas = 3; nextSnapshot.memory = []; nextSnapshot.cells[63] = { square: "h8", visibility: "lit", piece: null };
    const cleared = reconcileBoundary(settled, batch(3, settled.seqThrough, nextSnapshot, [{ kind: "vision-witness", turn: 22, changes: [{ square: "h8", visibility: "lit", piece: null }] }]));
    expect(cleared.snapshot.memory).toEqual([]); expect(cleared.everLit).toContain("h8");
    const invalid = batch(3, settled.seqThrough, nextSnapshot, [{ kind: "own-unit-mode-changed", id: "w:unit:opening:c2", mode: "siege" }]);
    expect(() => validateBoundaryBatch(invalid)).toThrow(ContractError);
  });
  it("uses recipient-local counters and identities for Black", () => {
    const f = lifecycle();
    const black = (value: AuthorizedBoundaryBatch): AuthorizedBoundaryBatch => JSON.parse(JSON.stringify(value).replaceAll('"w"', '"temp"').replaceAll('"b"', '"w"').replaceAll('"temp"', '"b"').replaceAll('w:', 'b:'));
    let state: ReconciledBoundaryState | null = null;
    for (const b of [f.start, f.open, f.settle, f.open2, f.settle2]) state = reconcileBoundary(state, black(b));
    expect(state!.snapshot.side).toBe("b"); expect(state!.economicState.receipts[0]!.receiptId).toBe("b:receipt:0:0");
    expect(state!.ownMineAuditState.retiredOwnMineIdsSorted).toEqual(["b:mine:created:1", "b:mine:created:2", "b:mine:opening:b2"]);
  });
  it("checks mine counter continuity as identities when presentation places created:10 before created:9", () => {
    let state = reconcileBoundary(null, initial());
    for (let p = 0; p < 5; p++) {
      const openSnapshot = snapshot(21 + p, 3, 12, openingUnits, openingMines, economy0);
      state = reconcileBoundary(state, batch(2 * p + 1, state.seqThrough, openSnapshot, []));
      const ids = [`w:mine:created:${2 * p + 1}`, `w:mine:created:${2 * p + 2}`].sort();
      const events: EventInput[] = [
        { kind: "own-gas-debited", actionRef: { planningOrdinal: p, acceptedActionOrdinal: 0 }, gas: 1 },
        { kind: "own-gas-debited", actionRef: { planningOrdinal: p, acceptedActionOrdinal: 1 }, gas: 1 },
        ...ids.map((mineId, i) => ({ kind: "own-mine-created" as const, mineId, actionRef: { planningOrdinal: p, acceptedActionOrdinal: mineId.endsWith(`:${2 * p + 1}`) ? 0 : 1 }, square: "b2" as const })),
        ...ids.map(mineId => ({ kind: "own-mine-removed" as const, mineId })),
        { kind: "own-income", actualCreditedMinerals: 0 },
      ];
      state = reconcileBoundary(state, batch(2 * p + 2, state.seqThrough, snapshot(22 + p, 0, 12, openingUnits, openingMines, economy0), events));
    }
    expect(state.ownMineAuditState.ownMineCreationCounter).toBe(10);
    expect(state.ownMineAuditState.retiredOwnMineIdsSorted).toEqual(["w:mine:created:1", "w:mine:created:10", ...Array.from({ length: 8 }, (_, i) => `w:mine:created:${i + 2}`)]);
  });
});
