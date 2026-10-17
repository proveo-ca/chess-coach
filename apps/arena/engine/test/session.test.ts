// SPEC: _spec/apps/arena/burn-compat.puml
import assert from "node:assert/strict";
import test from "node:test";
import { beginScTurn, formatScFen, parseScFen, scOutcome, validateScFen, type ScFenSnapshot } from "@chess-coach/starchess-core";
import { FIXTURES_V2, fixtureV2 } from "../fixtures";
import { PrivateSession } from "../session";
import { EngineErrorV2, type Action, type SessionOpen } from "../wire-v2";

function planningV2(open: SessionOpen) {
  assert.equal(open.kind, "planning");
  if (open.kind !== "planning") throw new Error("Expected planning");
  return open;
}
function codeV2(code: string) { return (error: unknown) => error instanceof EngineErrorV2 && error.packet.code === code; }
function testStateV2(turn: number, bank = 3): ScFenSnapshot {
  const tier = turn <= 10 ? 1 : turn <= 20 ? 2 : 3;
  return parseScFen(`SCFEN|4k3/8/8/8/8/8/8/4K3|${turn}|33|P|G:${tier}${tier}:${tier}${tier}|B:${bank}:${bank}|Q:w:;b:`);
}

test("v2 fixed public fixtures native-validate and preserve explicit banks and empty queues", () => {
  for (const fixture of ["tiny-v1", "standard-v1", "all-actors-v1"] as const) {
    const state = fixtureV2(fixture);
    assert.equal(validateScFen(formatScFen(state)).ok, true);
    assert.deepEqual(state.queue, { actions: [] });
    assert.equal(state.mines, undefined);
    assert.deepEqual(state.stored, fixture === "all-actors-v1" ? { w: 12, b: 12 } : { w: 3, b: 3 });
  }
  assert.equal(fixtureV2("standard-v1").placement, "4k3/2pppp2/8/8/8/8/2PPPP2/4K3");
  assert.equal(fixtureV2("all-actors-v1").turn, 21);
  assert.throws(() => fixtureV2("other" as "tiny-v1"), codeV2("BAD_REQUEST"));
});

test("v2 session shares one post-begin image between seats and defers full begin truth", () => {
  const engine = new PrivateSession();
  const start = engine.start("tiny-v1");
  const open = planningV2(engine.open(start.session, 0));
  assert.deepEqual(Object.keys(open).sort(), ["context", "kind", "views"]);
  assert.equal(open.views.w.turn, open.views.b.turn);
  assert.equal(open.views.w.version, "arena-observation-v2");
  assert.equal(open.views.w.own.minerals, 3);
  assert.equal(open.views.b.own.minerals, 3);
  assert.equal(Object.hasOwn(open.views.w, "queue"), false);
  const beforeSelection = JSON.stringify(open);
  const requests = {
    w: [{ kind: "classical", timing: "C", color: "w", from: "e1", to: "d1" }] as Action[],
    b: [{ kind: "classical", timing: "C", color: "b", from: "e8", to: "d8" }] as Action[],
  };
  const committed = engine.commit(open.context, requests);
  assert.equal(JSON.stringify(open), beforeSelection);
  assert.deepEqual(committed.begin.before, start.initial);
  assert.deepEqual(committed.settlement.before, committed.begin.after);
  assert.deepEqual(committed.settlement.requests, requests);
  assert.deepEqual(committed.settlement.grants, { w: 1, b: 1 });
  const nativeBegin = beginScTurn(parseScFen(FIXTURES_V2["tiny-v1"]));
  assert.deepEqual(committed.begin.rawBegin, nativeBegin);
  const queue = (committed.settlement.rawResolve as { queue: { color: string; seq: number }[] }).queue;
  assert.deepEqual(queue.map(a => [a.color, a.seq]), [["w", 0], ["b", 1]]);
  assert.equal(engine.close(start.session).pendingBegin, null);
});

test("v2 sessions reject reused, stale and malformed contexts without consuming the window", () => {
  const engine = new PrivateSession();
  const { session } = engine.start("tiny-v1");
  assert.throws(() => engine.start("standard-v1"), codeV2("STATE"));
  assert.throws(() => engine.open(session, 1), codeV2("STALE_CONTEXT"));
  const open = planningV2(engine.open(session, 0));
  assert.throws(() => engine.open(session, 0), codeV2("STALE_CONTEXT"));
  assert.throws(() => engine.commit({ ...open.context, turn: 1 }, { w: [], b: [] }), codeV2("STALE_CONTEXT"));
  assert.throws(() => engine.commit(open.context, { w: [{ kind: "classical", timing: "C", color: "b", from: "e8", to: "d8" }], b: [] }), codeV2("BAD_REQUEST"));
  assert.throws(() => engine.commit(open.context, { w: [], b: [], extra: true } as never), codeV2("BAD_REQUEST"));
  const commit = engine.commit(open.context, { w: [], b: [] });
  assert.equal(parseScFen(commit.settlement.after.scfen).turn, 1);
  assert.throws(() => engine.commit(open.context, { w: [], b: [] }), codeV2("STALE_CONTEXT"));
  assert.throws(() => engine.open(session, 0), codeV2("STALE_CONTEXT"));
  const second = planningV2(engine.open(session, 1));
  assert.equal(second.context.turn, 1);
  const closed = engine.close(session);
  assert.equal(closed.pendingBegin?.planningOrdinal, 1);
  assert.throws(() => engine.close(session), codeV2("STATE"));
});

test("v2 native rejection publishes neither queued actions nor mineral/gas debits and permits no rescue", () => {
  const engine = new PrivateSession();
  const { session } = engine.start("tiny-v1");
  const open = planningV2(engine.open(session, 0));
  let refusal: EngineErrorV2 | undefined;
  try {
    engine.commit(open.context, {
      w: [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "d1", unit: "p" }],
      b: [{ kind: "classical", timing: "C", color: "b", from: "a8", to: "b8" }],
    });
    assert.fail("Expected native rejection");
  } catch (error) {
    assert.ok(error instanceof EngineErrorV2);
    refusal = error;
  }
  assert.equal(refusal.packet.code, "NATIVE_REJECTION");
  assert.equal(refusal.packet.witness?.side, "b");
  assert.equal(refusal.packet.witness?.actionIndex, 0);
  assert.equal(refusal.packet.witness?.begin.planningOrdinal, 0);
  assert.throws(() => engine.commit(open.context, { w: [], b: [] }), codeV2("STATE"));
  assert.throws(() => engine.open(session, 0), codeV2("STATE"));
  const close = engine.close(session);
  assert.deepEqual(close.image, refusal.packet.witness?.image);
  assert.equal(close.pendingBegin, null);
  assert.deepEqual(close.image.bank, { w: 3, b: 3 });
  assert.deepEqual(parseScFen(close.image.scfen).queue, { actions: [] });
  assert.deepEqual(parseScFen(close.image.scfen).gas, { w: 1, b: 1 });
});

test("v2 cumulative mineral rejection identifies its action and retains the native opening", () => {
  const engine = PrivateSession.fromSnapshotForTest(testStateV2(21, 0));
  const { session } = engine.start("tiny-v1");
  const open = planningV2(engine.open(session, 0));
  assert.throws(() => engine.commit(open.context, { w: [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "d1", unit: "p" }], b: [] }), error =>
    error instanceof EngineErrorV2 && error.packet.code === "NATIVE_REJECTION" && error.packet.witness?.nativeCode === "SC_MINERALS" && error.packet.witness.actionIndex === 0);
  assert.deepEqual(engine.close(session).image.bank, { w: 0, b: 0 });
});

test("v2 rejected queue prefixes identify the failed index without retaining earlier debits", () => {
  const engine = new PrivateSession();
  const { session } = engine.start("all-actors-v1");
  const open = planningV2(engine.open(session, 0));
  assert.throws(() => engine.commit(open.context, { w: [
    { kind: "deploy", timing: "B", color: "w", from: "e1", to: "d2", unit: "p" },
    { kind: "deploy", timing: "F", color: "w", from: "e1", to: "f2", unit: "p" },
  ], b: [] }), error => error instanceof EngineErrorV2 && error.packet.code === "NATIVE_REJECTION" &&
    error.packet.witness?.actionIndex === 1 && error.packet.witness.image.bank.w === 12);
  const closed = engine.close(session);
  assert.deepEqual(closed.image.bank, { w: 12, b: 12 });
  assert.deepEqual(parseScFen(closed.image.scfen).gas, { w: 3, b: 3 });
});

test("v2 unexpected opening failures end the engine and still permit explicit closure", () => {
  const snapshot = { ...testStateV2(0), phase: "O" as const };
  const engine = PrivateSession.fromSnapshotForTest(snapshot);
  const started = engine.start("tiny-v1");
  assert.throws(() => engine.open(started.session, 0), codeV2("ENGINE_FAILURE"));
  assert.throws(() => engine.open(started.session, 0), codeV2("STATE"));
  assert.deepEqual(engine.close(started.session).image, started.initial);
  assert.equal(engine.active, false);
});

test("v2 native turn-45 outcomes preserve either winner rather than inventing draws", () => {
  for (const [lives, winner] of [["32", "w"], ["23", "b"]] as const) {
    const snapshot = parseScFen(`SCFEN|4k3/8/8/8/8/8/8/4K3|45|${lives}|P|G:33:33|B:3:3|Q:w:;b:`);
    const engine = PrivateSession.fromSnapshotForTest(snapshot);
    const started = engine.start("tiny-v1");
    assert.deepEqual(started.outcome, { winner, draw: false });
    const opened = engine.open(started.session, 0);
    assert.equal(opened.kind, "terminal");
    if (opened.kind === "terminal") {
      assert.equal(opened.begin, null);
      assert.deepEqual(opened.outcome, started.outcome);
    }
    engine.close(started.session);
  }
});

test("v2 terminal begin chips advance native turn without invented settlement income", () => {
  const state = parseScFen("SCFEN|8/8/8/8/8/8/8/Kk6|10|11|P|G:11:11|B:3:3|Q:w:;b:");
  const engine = PrivateSession.fromSnapshotForTest(state);
  const { session } = engine.start("tiny-v1");
  const open = engine.open(session, 0);
  assert.equal(open.kind, "terminal");
  if (open.kind !== "terminal") throw new Error("Expected terminal begin");
  assert.deepEqual(open.outcome, { winner: null, draw: true });
  assert.equal(open.image.scfen.split("|")[2], "11");
  assert.deepEqual(open.image.bank, { w: 3, b: 3 });
  assert.deepEqual(open.begin?.rawBegin, beginScTurn(structuredClone(state)));
  assert.throws(() => engine.open(session, 0), codeV2("STALE_CONTEXT"));
  assert.equal(engine.close(session).pendingBegin, null);
});

test("v2 records nonterminal begin chips once and does not double-chip at settlement", () => {
  const state = parseScFen("SCFEN|k7/5r2/8/2n5/4K3/8/7b/8|0|33|P|G:11:11|B:3:3|Q:w:;b:");
  const engine = PrivateSession.fromSnapshotForTest(state);
  const { session } = engine.start("tiny-v1");
  const open = planningV2(engine.open(session, 0));
  assert.equal(open.views.w.own.ccLives, 2);
  const committed = engine.commit(open.context, { w: [], b: [] });
  assert.equal(parseScFen(committed.settlement.after.scfen).ccLives.w, 2);
  assert.equal((committed.begin.rawBegin as { changed: boolean }).changed, true);
  engine.close(session);
});

for (const [turn, bank, grant] of [[9, 3, 1], [10, 3, 2], [20, 3, 3], [21, 11, 1], [21, 12, 0], [44, 0, 3]] as const) {
  test(`v2 grants income once at settlement for turn ${turn}, bank ${bank}`, () => {
    const engine = PrivateSession.fromSnapshotForTest(testStateV2(turn, bank));
    const { session } = engine.start("tiny-v1");
    const open = planningV2(engine.open(session, 0));
    assert.equal(open.views.w.own.minerals, bank);
    const commit = engine.commit(open.context, { w: [], b: [] });
    assert.deepEqual(commit.settlement.grants, { w: grant, b: grant });
    assert.deepEqual(commit.settlement.after.bank, { w: bank + grant, b: bank + grant });
    if (turn === 44) assert.deepEqual(commit.settlement.outcome, { winner: null, draw: true });
    engine.close(session);
  });
}

test("v2 closing an uncommitted gas-only begin retains its full record without income", () => {
  const state = { ...testStateV2(11), gas: { w: 0, b: 0 } };
  const engine = PrivateSession.fromSnapshotForTest(state);
  const { session } = engine.start("tiny-v1");
  const open = planningV2(engine.open(session, 0));
  assert.equal(open.views.w.own.gas, 2);
  const close = engine.close(session);
  assert.ok(close.pendingBegin);
  assert.equal((close.pendingBegin.rawBegin as { changed: boolean }).changed, false);
  assert.notEqual(close.pendingBegin.before.scfen, close.pendingBegin.after.scfen);
  assert.deepEqual(close.image.bank, { w: 3, b: 3 });
});

test("v2 initial native turn-45 outcome precedes begin and native pass/pass reaches the same cap", () => {
  const terminal = PrivateSession.fromSnapshotForTest(testStateV2(45));
  assert.deepEqual(terminal.start("tiny-v1").outcome, { winner: null, draw: true });
  const last = terminal.open(1, 0);
  assert.equal(last.kind, "terminal");
  if (last.kind === "terminal") assert.equal(last.begin, null);
  terminal.close(1);
  const engine = new PrivateSession();
  engine.start("tiny-v1");
  for (let ordinal = 0; ordinal < 45; ordinal++) {
    const open = planningV2(engine.open(1, ordinal));
    const commit = engine.commit(open.context, { w: [], b: [] });
    assert.equal(parseScFen(commit.settlement.after.scfen).turn, ordinal + 1);
    assert.deepEqual(commit.settlement.outcome, ordinal === 44 ? { winner: null, draw: true } : null);
  }
  const close = engine.close(1);
  assert.deepEqual(close.outcome, scOutcome(parseScFen(close.image.scfen)));
});

test("v2 hidden native worlds produce equal own planning DTOs and no opponent resource fields", () => {
  const first = parseScFen("SCFEN|n3k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:");
  const second = parseScFen("SCFEN|1n2k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|B:3:9|Q:w:;b:");
  const a = PrivateSession.fromSnapshotForTest(first);
  const b = PrivateSession.fromSnapshotForTest(second);
  a.start("tiny-v1"); b.start("tiny-v1");
  assert.deepEqual(planningV2(a.open(1, 0)).views.w, planningV2(b.open(1, 0)).views.w);
  a.close(1); b.close(1);
});

test("v2 indexed prefix rejection leaves the paired live bank and queue untouched", () => {
  const engine = new PrivateSession();
  const { session } = engine.start("all-actors-v1");
  const opened = planningV2(engine.open(session, 0));
  const requests: { w: Action[]; b: Action[] } = { w: [
    { kind: "deploy", timing: "B", color: "w", from: "e1", to: "d2", unit: "p" },
    { kind: "deploy", timing: "F", color: "w", from: "e1", to: "f2", unit: "p" },
  ], b: [] };
  assert.throws(() => engine.commit(opened.context, requests), error => error instanceof EngineErrorV2 &&
    error.packet.code === "NATIVE_REJECTION" && error.packet.witness?.actionIndex === 1 && error.packet.witness.image.bank.w === 12);
  const closed = engine.close(session);
  assert.deepEqual(closed.image.bank, { w: 12, b: 12 });
  assert.deepEqual(parseScFen(closed.image.scfen).queue, { actions: [] });
});

test("v2 unexpected opening errors fail the engine but still permit state release", () => {
  const snapshot = { ...testStateV2(0), phase: "O" as const };
  const engine = PrivateSession.fromSnapshotForTest(snapshot);
  engine.start("tiny-v1");
  assert.throws(() => engine.open(1, 0), codeV2("ENGINE_FAILURE"));
  assert.throws(() => engine.open(1, 0), codeV2("STATE"));
  const closed = engine.close(1);
  assert.equal(closed.image.scfen, formatScFen(snapshot));
  assert.equal(engine.active, false);
});
