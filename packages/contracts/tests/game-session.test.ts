// SPEC: _spec/recipient-production.puml
import { expect, test } from "bun:test";
import { canonicalInitialObservation } from "../src/initialization";
import { gameRecordJsonSchema, initializeGame, openGame, replayGameRecord, seedGame, settleGame } from "../src/game-session";
import { decodeRecipientBatch, encodeRecipientBatch } from "../src/recipient-codec";
import { causalBoard } from "./causal-fixture";

test("actual canonical recipients start with the approved opening and no income grant", () => {
  const initial = initializeGame(), began = openGame(initial).session;
  for (const side of ["w", "b"] as const) {
    expect(initial.batches[side].observation).toEqual(canonicalInitialObservation(side));
    expect(began.batches[side].observation.own.minerals).toBe(3);
    expect(began.batches[side].observation.economy.ownPaidDebits).toBe(0);
    expect(decodeRecipientBatch(encodeRecipientBatch(began.batches[side]))).toEqual(began.batches[side]);
  }
  expect(initial.history).toEqual([]);
  expect(began.bank).toEqual({ w: 3, b: 3 });
});

test("explicit banks debit deployment once, grant settlement income once and survive omitted core stored fields", () => {
  const open = openGame(initializeGame()).session, parent = structuredClone(open);
  const result = settleGame(open, { w: [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "f1", unit: "n" }], b: [] });
  expect(open).toEqual(parent);
  expect(result.session.bank).toEqual({ w: 1, b: 4 });
  expect(result.session.snapshot.stored).toEqual({ w: 1, b: 4 });
  const began = openGame(result.session).session;
  expect(began.bank).toEqual({ w: 1, b: 4 });
  expect(began.batches.w.observation.economy).toMatchObject({ ownPaidDebits: 3, ownPaidSurviving: 3, ownPaidDestroyed: 0, ownPaidWasted: 0 });
  const pass = settleGame(began, { w: [], b: [] }).session;
  expect(pass.bank).toEqual({ w: 2, b: 5 });
});

test("paid basis survives promotion and retires independently of replacement value", () => {
  const seed = seedGame(causalBoard([["d6", "k", "w"], ["f7", "k", "b"]]), { w: 12, b: 12 });
  const first = settleGame(openGame(seed).session, { w: [
    { kind: "deploy", timing: "B", color: "w", from: "d6", to: "e7", unit: "p" },
    { kind: "classical", timing: "C", color: "w", from: "e7", to: "e8", promotion: "q" },
  ], b: [] }).session;
  const unit = first.batches.w.observation.ownUnitLineage.find(unit => unit.square === "e8")!;
  expect(unit).toMatchObject({ id: "w:unit:created:1", type: "q", paidBasis: 1, replacementValue: 9 });
  const second = settleGame(openGame(first).session, { w: [], b: [
    { kind: "deploy", timing: "B", color: "b", from: "f7", to: "e8", unit: "p" },
  ] }).session;
  expect(second.batches.w.observation.economy).toMatchObject({ ownPaidDebits: 1, ownPaidDestroyed: 1, ownPaidSurviving: 0, ownReplacementDestroyed: 9 });
  expect(second.batches.w.observation.economy.retiredOwnIds).toContain(unit.id);
});

test("birth followed by immediate mine loss is paid destruction rather than waste", () => {
  const initial = seedGame(causalBoard([["a1", "k", "w"], ["h8", "k", "b"]], { mines: [{ color: "b", at: "b2" }] }), { w: 12, b: 12 });
  const ended = settleGame(openGame(initial).session, { w: [{ kind: "deploy", timing: "B", color: "w", from: "a1", to: "b2", unit: "n" }], b: [] }).session;
  expect(ended.batches.w.observation.economy).toMatchObject({ ownPaidDebits: 3, ownPaidDestroyed: 3, ownPaidWasted: 0, ownPaidSurviving: 0 });
  expect(ended.batches.w.observation.economy.receipts[0]!.disposition).toEqual({ kind: "materialized", lineageId: "w:unit:created:1" });
});

test("suppressed F deployment pays once and records unmaterialized waste after a terminal C chip", () => {
  const initial = seedGame(causalBoard([["a1", "r", "w"], ["h1", "k", "w"], ["a6", "k", "b"]], { ccLives: { w: 3, b: 1 } }), { w: 12, b: 12 });
  const ended = settleGame(openGame(initial).session, { w: [{ kind: "classical", timing: "C", color: "w", from: "a1", to: "a8" }],
    b: [{ kind: "deploy", timing: "F", color: "b", from: "a6", to: "b6", unit: "p" }] }).session;
  expect(ended.phase).toBe("terminal");
  expect(ended.batches.b.observation.economy).toMatchObject({ ownPaidDebits: 1, ownPaidWasted: 1, ownPaidDestroyed: 0, ownPaidSurviving: 0 });
  expect(ended.batches.b.observation.economy.receipts[0]!.disposition).toEqual({ kind: "unmaterialized" });
});

test("terminal opening chips preserve explicit banks without a planning or mineral grant", () => {
  const initial = seedGame(causalBoard([["a1", "k", "w"], ["b1", "k", "b"]], { ccLives: { w: 1, b: 1 } }), { w: 2, b: 7 });
  const ended = openGame(initial).session;
  expect(ended.phase).toBe("terminal");
  expect(ended.bank).toEqual({ w: 2, b: 7 });
  expect(ended.snapshot.turn).toBe(22);
  expect(() => openGame(ended)).toThrow("OPEN_PHASE");
  expect(() => settleGame(ended, { w: [], b: [] })).toThrow("SETTLE_PHASE");
});

test("both-seat staging rejects invalid side, extra fields and insufficient minerals without partial commit", () => {
  const opened = openGame(initializeGame()).session, before = structuredClone(opened);
  const deploy = { kind: "deploy", timing: "B", color: "w", from: "e1", to: "f1", unit: "q" } as const;
  expect(() => settleGame(opened, { w: [deploy], b: [] })).toThrow("MINERALS");
  expect(() => settleGame(opened, { w: [], b: [{ kind: "classical", timing: "C", color: "w", from: "e2", to: "e3" }] })).toThrow();
  expect(() => settleGame(opened, { w: [{ ...deploy, unit: "p" }], b: [{ kind: "classical", timing: "C", color: "b", from: "a8", to: "a7" }] })).toThrow();
  const forged = structuredClone(opened);
  forged.bank.w = 12;
  expect(() => settleGame(forged, { w: [], b: [] })).toThrow("PARENT_STATE");
  expect(opened).toEqual(before);
});

test("recipient references use accepted own ordinals rather than combined native action sequences", () => {
  const seed = seedGame(causalBoard([["a1", "k", "w"], ["h8", "k", "b"], ["b3", "n", "w"]]), { w: 12, b: 12 });
  const ended = settleGame(openGame(seed).session, { w: [{ kind: "spiderMine", timing: "B", color: "w", from: "b3" }],
    b: [{ kind: "deploy", timing: "B", color: "b", from: "h8", to: "g7", unit: "p" }] }).session;
  expect(ended.batches.b.observation.economy.receipts[0]!).toMatchObject({ receiptId: "b:receipt:0:0", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 } });
  expect(ended.batches.w.observation.ownMineLineage[0]!.mineId).toBe("w:mine:created:1");
});

test("source-bound deterministic replay rejects gaps and conflicts and accepts identical repeats without new facts", () => {
  const initial = initializeGame(), opened = openGame(initial), ended = settleGame(opened.session, { w: [], b: [] });
  const replayedOpen = replayGameRecord(initial, JSON.stringify(opened.record));
  const replayedEnd = replayGameRecord(replayedOpen, JSON.stringify(ended.record));
  expect(replayedEnd).toEqual(ended.session);
  expect(replayGameRecord(replayedEnd, JSON.stringify(opened.record))).toEqual(replayedEnd);
  expect(replayGameRecord(replayedEnd, JSON.stringify(ended.record))).toEqual(replayedEnd);
  expect(() => replayGameRecord(initial, JSON.stringify(ended.record))).toThrow("REPLAY_GAP");
  const conflict = structuredClone(ended.record);
  conflict.bank.w--;
  expect(() => replayGameRecord(replayedEnd, JSON.stringify(conflict))).toThrow("REPLAY_CONFLICT");
  expect(() => replayGameRecord(replayedOpen, JSON.stringify(conflict))).toThrow("REPLAY_MISMATCH");
  expect(gameRecordJsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
});
