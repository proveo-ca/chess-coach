// SPEC: _spec/apps/arena/burn-compat.puml
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  OPENING_STORED_MATERIAL, UNIT_COST, applyStoredIncome, beginScTurn, deployedMaterialFromPlacement, endScTurn,
  energyForTurn, formatScFen, parseScFen, snapFromPlacement, specialGasCost,
} from "@chess-coach/starchess-core";
import { EconomicReplay, nativeLedgerRules } from "../economic-replay";
import { EconomicProjector } from "../economic-project";
import { parseEconomicBoundary, parseLedgerRules, type EconomicBoundary, type EconomicOpen } from "../economic-wire";
import { NativeReplay } from "../replay";
import { EngineErrorV2, type Action, type Pair } from "../wire-v2";

function planning(value: EconomicOpen) {
  assert.equal(value.kind, "planning");
  if (value.kind !== "planning") throw new Error("Expected planning");
  return value;
}
const settlement = (boundary: EconomicBoundary) => {
  const group = boundary.groups.at(-1);
  assert.equal(group?.kind, "settlement");
  if (group?.kind !== "settlement") throw new Error("Expected settlement");
  return group;
};
const empty: Pair<Action[]> = { w: [], b: [] };
const code = (value: string, message?: RegExp) => (error: unknown) => error instanceof EngineErrorV2 && error.packet.code === value && (!message || message.test(error.message));

test("economic DTOs decode the actual shared Rust golden and source-construct the native profile", async () => {
  const golden = JSON.parse(await readFile(new URL("../../../../packages/training/tests/fixtures/ledger-boundaries.json", import.meta.url), "utf8")) as { rules: unknown; boundaries: unknown[] };
  assert.deepEqual(nativeLedgerRules(), golden.rules);
  assert.deepEqual(parseLedgerRules(golden.rules), golden.rules);
  for (const boundary of golden.boundaries) assert.deepEqual(parseEconomicBoundary(boundary), boundary);
  const replay = new EconomicReplay();
  const start = replay.start("standard-v1");
  assert.deepEqual(start.boundaries.w, golden.boundaries[0]);
  assert.equal(deployedMaterialFromPlacement(parseScFen(start.initial.scfen).placement, "w"), 5);
  assert.equal(start.boundaries.w.snapshot.own.pieces.filter(p => p.type !== "k").length, 4);
  assert.deepEqual([start.boundaries.w.snapshot.own.minerals, start.boundaries.w.snapshot.own.gas, start.boundaries.w.snapshot.own.ccLives], [3, 1, 3]);
  assert.equal(Object.hasOwn(start.boundaries.w, "paidBasis"), false);
  const opened = planning(replay.open(0));
  assert.deepEqual(opened.boundaries.w, golden.boundaries[1]);
  const paid = replay.settle(opened.context, { w: [{ kind: "classical", timing: "C", color: "w", from: "c2", to: "c3" }], b: [] });
  assert.deepEqual(paid.boundaries.w.snapshot, parseEconomicBoundary(golden.boundaries[2]).snapshot);
  replay.close();
});

test("public native opening helpers construct standard endowed cost 5, non-CC cost 4 and the default bank/gas/lives", () => {
  const snapshot = snapFromPlacement("4k3/2pppp2/8/8/8/8/2PPPP2/4K3", 0);
  snapshot.stored = { w: OPENING_STORED_MATERIAL, b: OPENING_STORED_MATERIAL };
  const replay = EconomicReplay.fromSnapshotForTest(snapshot);
  const start = replay.start("standard-v1");
  const fixture = new EconomicReplay();
  assert.deepEqual(start, fixture.start("standard-v1"));
  for (const side of ["w", "b"] as const) {
    const own = start.boundaries[side].snapshot.own;
    assert.equal(own.pieces.reduce((sum, piece) => sum + UNIT_COST[piece.type], 0), 5);
    assert.equal(own.pieces.reduce((sum, piece) => sum + (piece.type === "k" ? 0 : UNIT_COST[piece.type]), 0), 4);
    assert.deepEqual([own.minerals, own.gas, own.ccLives], [3, 1, 3]);
    assert.equal(start.boundaries[side].grantOrdinal, 0);
    assert.deepEqual(start.boundaries[side].groups, []);
  }
  replay.close(); fixture.close();
});

for (const fixture of ["tiny-v1", "standard-v1", "all-actors-v1"] as const) {
  test(`economic reconstruction matches every native host field through terminal turn 45: ${fixture}`, () => {
    const replay = new EconomicReplay(); const oracle = new NativeReplay();
    const { rules: _rules, boundaries: _boundaries, ...start } = replay.start(fixture);
    assert.deepEqual(start, oracle.start(fixture));
    const windows = fixture === "all-actors-v1" ? 24 : 45;
    for (let ordinal = 0; ordinal < windows; ordinal++) {
      const opened = planning(replay.open(ordinal));
      const { begin, boundaries, ...oldOpen } = opened;
      assert.deepEqual(oldOpen, oracle.open(1, ordinal));
      assert.deepEqual(begin.rawBegin, beginScTurn(parseScFen(begin.before.scfen)));
      assert.deepEqual(boundaries.w.snapshot, opened.views.w);
      assert.deepEqual(boundaries.b.snapshot, opened.views.b);
      const { boundaries: paid, ...committed } = replay.settle(opened.context, empty);
      assert.deepEqual(committed, oracle.commit(opened.context, empty));
      assert.deepEqual(committed.settlement.rawResolve, endScTurn(parseScFen(committed.settlement.committed.scfen), { skipTurnStartChecks: true }));
      for (const side of ["w", "b"] as const) {
        const boundary = paid[side];
        assert.equal(boundary.turn, (fixture === "all-actors-v1" ? 21 : 0) + ordinal + 1);
        assert.equal(boundary.planningOrdinal, ordinal + 1);
        assert.equal(boundary.grantOrdinal, ordinal + 1);
        assert.equal(boundary.snapshot.own.gas, 0);
        assert.equal(boundary.snapshot.own.gasIncome, energyForTurn(boundary.turn));
        assert.deepEqual(parseEconomicBoundary(boundary), boundary);
        assert.equal(settlement(boundary).credited, committed.settlement.grants[side]);
      }
    }
    const terminal = replay.open(windows);
    assert.equal(terminal.kind, "terminal");
    if (terminal.kind === "terminal") { assert.equal(terminal.begin, null); assert.equal(terminal.boundaries, null); }
    oracle.open(1, windows);
    const close = replay.close();
    assert.deepEqual(close, oracle.close(1));
    assert.equal(parseScFen(close.image.scfen).turn, 45);
    assert.ok(close.outcome);
  });
}

for (const [turn, expected] of [[0, 1], [9, 1], [10, 2], [20, 3], [44, 3]] as const) {
  test(`native settlement crossing ${turn}→${turn + 1} grants tier ${expected} and resets current gas`, () => {
    const capacity = energyForTurn(turn);
    const replay = EconomicReplay.fromSnapshotForTest(parseScFen(`SCFEN|4k3/8/8/8/8/8/8/4K3|${turn}|33|P|G:${capacity}${capacity}:${capacity}${capacity}|B:3:3|Q:w:;b:`));
    const start = replay.start("tiny-v1");
    assert.deepEqual(start.initial.bank, { w: 3, b: 3 });
    assert.equal(start.boundaries.w.groups.length, 0);
    const opened = planning(replay.open(0));
    assert.deepEqual(opened.begin.before.bank, opened.begin.after.bank);
    const paid = replay.settle(opened.context, empty);
    for (const side of ["w", "b"] as const) {
      assert.equal(paid.boundaries[side].turn, turn + 1);
      assert.deepEqual(settlement(paid.boundaries[side]), { kind: "settlement", seq: paid.boundaries[side].seqThrough, entitlement: expected, credited: expected, gasBeforeReset: capacity, nextGasCapacity: expected });
      assert.equal(paid.boundaries[side].snapshot.own.gas, 0);
      assert.equal(paid.boundaries[side].snapshot.own.gasIncome, expected);
    }
    assert.deepEqual(paid.settlement.after.bank, { w: 3 + expected, b: 3 + expected });
    replay.close();
  });
}

for (const [turn, carried] of [[0, 1], [10, 1], [20, 2]] as const) {
  test(`terminal Begin ${turn}→${turn + 1} carries capacity ${carried} and creates no grant`, () => {
    const initial = parseScFen(`SCFEN|8/8/8/8/8/8/8/Kk6|${turn}|11|P|G:${carried}${carried}:${carried}${carried}|B:3:3|Q:w:;b:`);
    const replay = EconomicReplay.fromSnapshotForTest(initial);
    replay.start("tiny-v1");
    const opened = replay.open(0);
    assert.equal(opened.kind, "terminal");
    if (opened.kind !== "terminal") throw new Error("Expected terminal Begin");
    assert.deepEqual(opened.begin?.rawBegin, beginScTurn(initial));
    const native = (opened.begin!.rawBegin as ReturnType<typeof beginScTurn>).next;
    assert.deepEqual([native.turn, native.phase, native.ccLives, native.gas, native.gasIncome], [turn + 1, "O", { w: 0, b: 0 }, { w: carried, b: carried }, { w: carried, b: carried }]);
    assert.deepEqual(opened.image.bank, { w: 3, b: 3 });
    for (const side of ["w", "b"] as const) {
      const boundary: EconomicBoundary = opened.boundaries![side];
      assert.equal(boundary.grantOrdinal, 0);
      assert.equal(boundary.snapshot.own.gasIncome, carried);
      assert.ok(boundary.groups.every(g => g.kind !== "settlement" && g.kind !== "admission"));
    }
    assert.equal(replay.close().pendingBegin, null);
  });
}

test("fatal check refills native gas from zero but terminates before intent and grants no minerals", () => {
  const snapshot = parseScFen("SCFEN|8/8/8/8/8/8/8/Kk6|10|11|P|G:00:11|B:3:3|Q:w:;b:");
  const raw = beginScTurn(snapshot);
  assert.deepEqual([raw.next.phase, raw.next.turn, raw.next.ccLives, raw.next.gas, raw.next.gasIncome], ["O", 11, { w: 0, b: 0 }, { w: 1, b: 1 }, { w: 1, b: 1 }]);
  const replay = EconomicReplay.fromSnapshotForTest(snapshot);
  const start = replay.start("tiny-v1");
  assert.equal(start.boundaries.w.snapshot.own.gas, 0);
  const terminal = replay.open(0);
  assert.ok(terminal.kind === "terminal");
  assert.deepEqual(terminal.begin?.rawBegin, raw);
  assert.deepEqual(terminal.image.bank, { w: 3, b: 3 });
  assert.equal(terminal.image.scfen, formatScFen({ ...raw.next, stored: { w: 3, b: 3 } }));
  assert.equal(Object.hasOwn(terminal, "context"), false);
  assert.equal(Object.hasOwn(terminal, "views"), false);
  for (const side of ["w", "b"] as const) {
    const boundary: EconomicBoundary = terminal.boundaries![side];
    assert.deepEqual([boundary.snapshot.own.gas, boundary.snapshot.own.gasIncome, boundary.snapshot.own.minerals, boundary.grantOrdinal], [1, 1, 3, 0]);
    assert.ok(boundary.groups.every(g => g.kind !== "settlement" && g.kind !== "admission"));
  }
  assert.throws(() => replay.open(0), code("STALE_CONTEXT", /Repeated/));
  assert.deepEqual(replay.close().image, terminal.image);
});

test("settlement 10 retains its actual grant before fatal check 11 without a new intent or tier-2 grant", () => {
  const snapshot = parseScFen("SCFEN|8/8/8/8/8/2k5/8/4K3|9|11|P|G:11:11|B:3:3|Q:w:;b:");
  const replay = EconomicReplay.fromSnapshotForTest(snapshot);
  replay.start("tiny-v1");
  const open = planning(replay.open(0));
  const paid = replay.settle(open.context, { w: [{ kind: "classical", timing: "C", color: "w", from: "e1", to: "d2" }], b: [] });
  assert.equal(paid.settlement.outcome, null);
  assert.deepEqual(paid.settlement.grants, { w: 1, b: 1 });
  assert.deepEqual(paid.settlement.after.bank, { w: 4, b: 4 });
  assert.equal(paid.boundaries.w.turn, 10);
  assert.equal(settlement(paid.boundaries.w).entitlement, 1);
  assert.equal(settlement(paid.boundaries.w).credited, 1);
  const terminal = replay.open(1);
  assert.ok(terminal.kind === "terminal");
  assert.ok(terminal.begin);
  const raw = terminal.begin.rawBegin as ReturnType<typeof beginScTurn>;
  assert.deepEqual([raw.next.turn, raw.next.phase, raw.next.ccLives, raw.next.gas, raw.next.gasIncome], [11, "O", { w: 0, b: 0 }, { w: 1, b: 1 }, { w: 1, b: 1 }]);
  assert.deepEqual(terminal.image.bank, { w: 4, b: 4 });
  assert.equal(terminal.image.scfen, formatScFen({ ...raw.next, stored: { w: 4, b: 4 } }));
  assert.equal(Object.hasOwn(terminal, "views"), false);
  for (const side of ["w", "b"] as const) {
    const boundary: EconomicBoundary = terminal.boundaries![side];
    assert.equal(boundary.grantOrdinal, 1);
    assert.equal(boundary.snapshot.own.minerals, 4);
    assert.ok(boundary.groups.every(g => g.kind !== "settlement" && g.kind !== "admission"));
  }
  assert.throws(() => replay.settle(open.context, empty), code("STALE_CONTEXT", /Stale planning/));
  assert.deepEqual(replay.close().image, terminal.image);
});

test("turn 21 cap asymmetry separates equal nominal entitlement from native credited and discarded amounts", () => {
  const replay = EconomicReplay.fromSnapshotForTest(parseScFen("SCFEN|4k3/8/8/8/8/8/8/4K3|20|33|P|G:22:22|B:12:11|Q:w:;b:"));
  replay.start("tiny-v1");
  const opened = planning(replay.open(0));
  const paid = replay.settle(opened.context, empty);
  assert.deepEqual(paid.settlement.grants, { w: 0, b: 1 });
  assert.deepEqual(paid.settlement.after.bank, { w: 12, b: 12 });
  assert.deepEqual([settlement(paid.boundaries.w).entitlement, settlement(paid.boundaries.b).entitlement], [3, 3]);
  assert.deepEqual([settlement(paid.boundaries.w).credited, settlement(paid.boundaries.b).credited], [0, 1]);
  assert.deepEqual([3 - paid.settlement.grants.w, 3 - paid.settlement.grants.b], [3, 2]);
  replay.close();
});

test("native gas admission debit, unused discard, end zero and next Begin refill remain distinct", () => {
  const replay = new EconomicReplay(); replay.start("all-actors-v1");
  const opened = planning(replay.open(0));
  const paid = replay.settle(opened.context, { w: [{ kind: "spiderMine", timing: "B", color: "w", from: "b1" }], b: [] });
  const admission = paid.boundaries.w.groups[0]!;
  assert.equal(admission.kind, "admission");
  if (admission.kind === "admission") assert.deepEqual(admission.actions.map(a => [a.minerals, a.gas, a.actionRef]), [[0, 1, { planningOrdinal: 0, acceptedActionOrdinal: 0 }]]);
  assert.equal(settlement(paid.boundaries.w).gasBeforeReset, 2);
  assert.equal(paid.boundaries.w.snapshot.own.gas, 0);
  assert.equal(settlement(paid.boundaries.w).nextGasCapacity, 3);
  const next = planning(replay.open(1));
  assert.equal(next.views.w.own.gas, 3);
  assert.deepEqual(next.begin.after.bank, paid.settlement.after.bank);
  replay.close();
});

test("fixed all-actors rook replacement retires the sieged unit and births a new rook retaining native siege mode", () => {
  const replay = new EconomicReplay(); const oracle = new NativeReplay();
  const { boundaries: initial, rules: _rules, ...start } = replay.start("all-actors-v1");
  assert.deepEqual(start, oracle.start("all-actors-v1"));
  assert.deepEqual([initial.w.turn, initial.w.snapshot.own.minerals], [21, 12]);
  assert.deepEqual(initial.w.snapshot.own.pieces.find(piece => piece.square === "d1"), { square: "d1", type: "r" });
  assert.deepEqual(initial.w.snapshot.own.siegedTanks, []);

  const opened = planning(replay.open(0));
  const { begin: _begin, boundaries: _openedBoundaries, ...oldOpened } = opened;
  assert.deepEqual(oldOpened, oracle.open(1, 0));
  const siegeRequests: Pair<Action[]> = { w: [{ kind: "siegeMode", timing: "B", color: "w", from: "d1" }], b: [] };
  const { boundaries: sieged, ...siegeCommit } = replay.settle(opened.context, siegeRequests);
  assert.deepEqual(siegeCommit, oracle.commit(opened.context, siegeRequests));
  const modeGroups = sieged.w.groups.filter(group => group.kind === "effects");
  assert.equal(modeGroups.length, 1);
  assert.deepEqual(modeGroups[0]!.beforeOwn.units.find(unit => unit.square === "d1"), { square: "d1", type: "r", mode: "tank" });
  assert.deepEqual(modeGroups[0]!.afterOwn.units.find(unit => unit.square === "d1"), { square: "d1", type: "r", mode: "siege" });
  assert.deepEqual(modeGroups[0]!.facts, [{ kind: "unit-mode-changed", subject: { kind: "before-unit", square: "d1" }, before: "tank", after: "siege" }]);
  assert.deepEqual(sieged.w.snapshot.own.siegedTanks, ["d1"]);
  assert.deepEqual(siegeCommit.settlement.grants, { w: 0, b: 0 });
  assert.deepEqual(siegeCommit.settlement.after.bank, { w: 12, b: 12 });

  const replacementOpen = planning(replay.open(1));
  const { begin: _replacementBegin, boundaries: _replacementOpenedBoundaries, ...oldReplacementOpen } = replacementOpen;
  assert.deepEqual(oldReplacementOpen, oracle.open(1, 1));
  assert.deepEqual(replacementOpen.views.w.own.siegedTanks, ["d1"]);
  assert.deepEqual([replacementOpen.context.turn, replacementOpen.views.w.own.minerals, replacementOpen.views.w.own.gas], [22, 12, 3]);
  const deploy: Action = { kind: "deploy", timing: "B", color: "w", from: "e1", to: "d1", unit: "r" };
  const requests: Pair<Action[]> = { w: [deploy], b: [] };
  const { boundaries: replaced, ...replacement } = replay.settle(replacementOpen.context, requests);
  assert.deepEqual(replacement, oracle.commit(replacementOpen.context, requests));
  const committed = parseScFen(replacement.settlement.committed.scfen);
  assert.deepEqual(committed.queue?.actions, [{ ...deploy, seq: 0 }]);
  assert.deepEqual(committed.gas, { w: 2, b: 3 });
  assert.deepEqual(replacement.settlement.committed.bank, { w: 7, b: 12 });
  const rawReplacement = endScTurn(committed, { skipTurnStartChecks: true });
  assert.deepEqual(replacement.settlement.rawResolve, rawReplacement);
  assert.deepEqual(rawReplacement.next.siegedTanks, ["d1"]);

  const admission = replaced.w.groups.find(group => group.kind === "admission");
  assert.ok(admission?.kind === "admission");
  assert.deepEqual([UNIT_COST.r, specialGasCost("deploy")], [5, 1]);
  assert.deepEqual(admission.actions, [{ actionRef: { planningOrdinal: 1, acceptedActionOrdinal: 0 }, action: deploy, minerals: UNIT_COST.r, gas: specialGasCost("deploy") }]);
  const replacementGroups = replaced.w.groups.filter(group => group.kind === "effects");
  assert.equal(replacementGroups.length, 1);
  const group = replacementGroups[0]!;
  assert.deepEqual(group.beforeOwn.units.find(unit => unit.square === "d1"), { square: "d1", type: "r", mode: "siege" });
  assert.deepEqual(group.afterOwn.units.find(unit => unit.square === "d1"), { square: "d1", type: "r", mode: "siege" });
  assert.deepEqual(group.facts, [
    { kind: "unit-destroyed", subject: { kind: "before-unit", square: "d1" }, square: "d1", type: "r" },
    { kind: "unit-born", actionRef: { planningOrdinal: 1, acceptedActionOrdinal: 0 }, square: "d1", type: "r" },
  ]);
  assert.deepEqual(replaced.w.snapshot.own.siegedTanks, ["d1"]);
  assert.deepEqual(replacement.settlement.after.bank, applyStoredIncome(replacement.settlement.committed.bank, rawReplacement.next.turn));
  assert.deepEqual([replaced.w.turn, replacement.settlement.grants, replacement.settlement.after.bank], [23, { w: 3, b: 0 }, { w: 10, b: 12 }]);
  assert.equal(settlement(replaced.w).credited, replacement.settlement.grants.w);

  const next = planning(replay.open(2));
  const { begin: _nextBegin, boundaries: _nextBoundaries, ...oldNext } = next;
  assert.deepEqual(oldNext, oracle.open(1, 2));
  assert.deepEqual([next.context.turn, next.views.w.own.gas], [23, 3]);
  assert.deepEqual(next.views.w.own.siegedTanks, ["d1"]);
  const { boundaries: usable, ...pass } = replay.settle(next.context, empty);
  assert.deepEqual(pass, oracle.commit(next.context, empty));
  assert.deepEqual(usable.w.snapshot.own.siegedTanks, ["d1"]);
  assert.deepEqual(replay.close(), oracle.close(1));
});

test("fixed all-actors rook birth on an empty nonsieged square stays in native tank mode", () => {
  const replay = new EconomicReplay(); const oracle = new NativeReplay();
  replay.start("all-actors-v1"); oracle.start("all-actors-v1");
  const opened = planning(replay.open(0)); oracle.open(1, 0);
  assert.deepEqual(opened.views.w.own.siegedTanks, []);
  assert.ok(!opened.views.w.own.pieces.some(piece => piece.square === "d2"));
  const deploy: Action = { kind: "deploy", timing: "B", color: "w", from: "e1", to: "d2", unit: "r" };
  const requests: Pair<Action[]> = { w: [deploy], b: [] };
  const { boundaries, ...paid } = replay.settle(opened.context, requests);
  assert.deepEqual(paid, oracle.commit(opened.context, requests));
  const groups = boundaries.w.groups.filter(group => group.kind === "effects");
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0]!.facts, [{ kind: "unit-born", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, square: "d2", type: "r" }]);
  assert.deepEqual(groups[0]!.afterOwn.units.filter(unit => unit.type === "r"), [
    { square: "d1", type: "r", mode: "tank" }, { square: "d2", type: "r", mode: "tank" },
  ]);
  assert.deepEqual(boundaries.w.snapshot.own.siegedTanks, []);
  assert.deepEqual(parseScFen(paid.settlement.after.scfen).siegedTanks ?? [], []);
  assert.deepEqual(paid.settlement.after.bank, applyStoredIncome(paid.settlement.committed.bank, boundaries.w.turn));
  assert.deepEqual(replay.close(), oracle.close(1));
});

test("atomic rejected pair returns exact old witness and preserves opening without receipts, End or grant", () => {
  const replay = new EconomicReplay(); const oracle = new NativeReplay();
  replay.start("tiny-v1"); oracle.start("tiny-v1");
  const opened = planning(replay.open(0)); oracle.open(1, 0);
  const requests: Pair<Action[]> = { w: [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "d1", unit: "p" }], b: [{ kind: "classical", timing: "C", color: "b", from: "a8", to: "a7" }] };
  let old: unknown;
  try { oracle.commit(opened.context, requests); } catch (error) { assert.ok(error instanceof EngineErrorV2); old = error.packet; }
  assert.throws(() => replay.settle(opened.context, requests), error => {
    assert.ok(error instanceof EngineErrorV2);
    assert.equal(error.packet.code, "NATIVE_REJECTION"); assert.deepEqual(error.packet, old); return true;
  });
  assert.throws(() => replay.settle(opened.context, empty), code("STATE", /failed/));
  const closed = replay.close();
  assert.deepEqual(closed, oracle.close(1));
  assert.equal(closed.pendingBegin, null);
  assert.deepEqual(closed.image, opened.begin.after);
});

test("economic context and closed state refuse stale or foreign mutations for their intended reason", () => {
  const replay = new EconomicReplay();
  assert.throws(() => replay.open(0), code("STATE", /Unknown/));
  replay.start("tiny-v1");
  assert.throws(() => replay.open(1), code("STALE_CONTEXT", /out-of-sequence/));
  const opened = planning(replay.open(0));
  assert.throws(() => replay.open(0), code("STALE_CONTEXT", /Repeated/));
  for (const context of [{ ...opened.context, session: 2 }, { ...opened.context, planningOrdinal: 1 }, { ...opened.context, turn: 1 }]) assert.throws(() => replay.settle(context, empty), code("STALE_CONTEXT", /Stale planning/));
  assert.deepEqual(replay.close().pendingBegin, opened.begin);
  assert.throws(() => replay.close(), code("STATE", /Unknown/));
});

test("duplicate same-side initial mines refuse explicitly instead of guessing native identity", () => {
  const replay = EconomicReplay.fromSnapshotForTest(parseScFen("SCFEN|7k/8/8/8/8/8/8/K7|21|33|P|G:33:33|B:3:3|Q:w:;b:|M:w:c3c3;b:"));
  assert.throws(() => replay.start("tiny-v1"), code("ENGINE_FAILURE", /Unsupported duplicate same-side initial mines/));
  assert.equal(replay.active, false);
});

test("serialization refusal rolls back native state and recipient cursors and forbids unsafe continuation", () => {
  const replay = new EconomicReplay(); replay.start("tiny-v1");
  const opened = planning(replay.open(0));
  const original = EconomicProjector.prototype.boundary;
  try {
    EconomicProjector.prototype.boundary = function(input) {
      const result = structuredClone(original.call(this, input));
      result.w.snapshot.own.mines = Array.from({ length: 220_000 }, () => "a1" as const);
      return result;
    };
    assert.throws(() => replay.settle(opened.context, empty), code("LIMIT", /reply exceeds 1 MiB/));
  } finally { EconomicProjector.prototype.boundary = original; }
  assert.throws(() => replay.settle(opened.context, empty), code("STATE", /failed/));
  const close = replay.close();
  assert.deepEqual(close.image, opened.begin.after);
  assert.deepEqual(close.pendingBegin, opened.begin);
});

test("economic production reconstruction imports no live, replay, admission or legacy reducer", async () => {
  for (const name of ["economic-replay", "economic-project", "economic-wire"]) {
    const source = await readFile(new URL(`../${name}.ts`, import.meta.url), "utf8");
    assert.ok(!/from\s+["'][^"']*(?:\/session|\/replay|\/admission|starchess-arena|starchess-training|\.test|\/core\/)/.test(source));
    assert.ok(!/paidBasis|lineageId/.test(source));
  }
});
