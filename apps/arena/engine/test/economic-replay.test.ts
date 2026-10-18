// SPEC: _spec/apps/arena/burn-compat.puml
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  OPENING_STORED_MATERIAL, UNIT_COST, applyStoredIncome, beginScTurn, beginTurnWithProvenance,
  deployedMaterialFromPlacement, endScTurn, endTurnWithProvenance, energyForTurn, formatScFen,
  getSideVision, initializeProvenance, parseScFen, placementToMap, snapFromPlacement, specialGasCost,
} from "@chess-coach/starchess-core";
import { EconomicReplay, nativeLedgerRules } from "../economic-replay";
import { EconomicProjector } from "../economic-project";
import { fixtureV2 } from "../fixtures";
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
    { kind: "unit-born", actionRef: { planningOrdinal: 1, acceptedActionOrdinal: 0 }, square: "d1", type: "r", mode: "siege" },
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
  assert.deepEqual(groups[0]!.facts, [{ kind: "unit-born", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, square: "d2", type: "r", mode: "tank" }]);
  assert.deepEqual(groups[0]!.afterOwn.units.filter(unit => unit.type === "r"), [
    { square: "d1", type: "r", mode: "tank" }, { square: "d2", type: "r", mode: "tank" },
  ]);
  assert.deepEqual(boundaries.w.snapshot.own.siegedTanks, []);
  assert.deepEqual(parseScFen(paid.settlement.after.scfen).siegedTanks ?? [], []);
  assert.deepEqual(paid.settlement.after.bank, applyStoredIncome(paid.settlement.committed.bank, boundaries.w.turn));
  assert.deepEqual(replay.close(), oracle.close(1));
});

test("fixed all-actors rook birth retains the replaced enemy rook's native siege square marker", () => {
  const replay = new EconomicReplay(); const oracle = new NativeReplay();
  const { boundaries: initial, rules: _rules, ...start } = replay.start("all-actors-v1");
  assert.deepEqual(start, oracle.start("all-actors-v1"));
  const nativeInitial = fixtureV2("all-actors-v1");
  const initialProvenance = initializeProvenance(nativeInitial);
  const nativeBegin = beginTurnWithProvenance({ snapshot: nativeInitial, provenance: initialProvenance });
  const opened = planning(replay.open(0));
  const { begin, boundaries: _openedBoundaries, ...oldOpened } = opened;
  assert.deepEqual(oldOpened, oracle.open(1, 0));
  assert.deepEqual(begin.rawBegin, nativeBegin.nativeResult);
  assert.deepEqual([opened.context.turn, start.initial.bank], [21, { w: 12, b: 12 }]);
  const relocate: Pair<Action[]> = { w: [], b: [
    { kind: "classical", timing: "C", color: "b", from: "d8", to: "d2" },
    { kind: "siegeMode", timing: "F", color: "b", from: "d8" },
  ] };
  const { boundaries: relocated, ...first } = replay.settle(opened.context, relocate);
  assert.deepEqual(first, oracle.commit(opened.context, relocate));
  const nativeFirst = endTurnWithProvenance({ snapshot: parseScFen(first.settlement.committed.scfen), provenance: nativeBegin.provenance,
    actionBindings: relocate.b.map((_, ordinal) => ({ sourceActionSeq: ordinal, side: "b", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: ordinal } })),
  });
  assert.deepEqual(nativeFirst.nativeResult, first.settlement.rawResolve);
  assert.deepEqual(nativeFirst.nativeResult.next.siegedTanks, ["d2"]);
  assert.deepEqual([first.settlement.committed.bank, first.settlement.grants, first.settlement.after.bank], [{ w: 12, b: 12 }, { w: 0, b: 0 }, { w: 12, b: 12 }]);
  const originalBlackGeometry = { units: initial.b.snapshot.own.pieces.map(piece => ({ ...piece, mode: piece.type === "r" ? "tank" as const : null })), mines: [], ccLives: 3 };
  const movedBlackGeometry = { ...originalBlackGeometry, units: originalBlackGeometry.units.map(unit => unit.square === "d8" ? { ...unit, square: "d2" as const } : unit) };
  const siegedBlackGeometry = { ...movedBlackGeometry, units: movedBlackGeometry.units.map(unit => unit.square === "d2" ? { ...unit, mode: "siege" as const } : unit) };
  const blackFirstGroups = relocated.b.groups.filter(group => group.kind === "effects");
  assert.deepEqual(blackFirstGroups.map(({ beforeOwn, afterOwn, facts }) => ({ beforeOwn, afterOwn, facts })), [
    { beforeOwn: originalBlackGeometry, afterOwn: movedBlackGeometry, facts: [{ kind: "unit-moved", subject: { kind: "before-unit", square: "d8" }, from: "d8", to: "d2" }] },
    { beforeOwn: movedBlackGeometry, afterOwn: siegedBlackGeometry, facts: [{ kind: "unit-mode-changed", subject: { kind: "before-unit", square: "d2" }, before: "tank", after: "siege" }] },
  ]);
  assert.deepEqual(relocated.w.groups.filter(group => group.kind === "effects"), []);
  assert.deepEqual(relocated.b.snapshot.own.siegedTanks, ["d2"]);
  assert.equal(settlement(relocated.b).gasBeforeReset, 3 - specialGasCost("siegeMode"));

  const nativeReplacementBegin = beginTurnWithProvenance({ snapshot: parseScFen(first.settlement.after.scfen), provenance: nativeFirst.provenance });
  const replacementOpen = planning(replay.open(1));
  const { begin: replacementBegin, boundaries: _replacementBoundaries, ...oldReplacementOpen } = replacementOpen;
  assert.deepEqual(oldReplacementOpen, oracle.open(1, 1));
  assert.deepEqual(replacementBegin.rawBegin, nativeReplacementBegin.nativeResult);
  for (const side of ["w", "b"] as const) assert.deepEqual(relocated[side].snapshot.cells, replacementOpen.views[side].cells);
  assert.deepEqual(replacementOpen.views.w.cells.find(cell => cell.square === "d2"), { square: "d2", visibility: "lit", piece: { color: "b", type: "r" } });
  assert.deepEqual(replacementOpen.views.w.own.siegedTanks, []);
  assert.ok(!replacementOpen.views.w.own.pieces.some(piece => piece.square === "d2"));
  const deploy: Action = { kind: "deploy", timing: "B", color: "w", from: "e1", to: "d2", unit: "r" };
  const requests: Pair<Action[]> = { w: [deploy], b: [] };
  const { boundaries: replaced, ...second } = replay.settle(replacementOpen.context, requests);
  assert.deepEqual(second, oracle.commit(replacementOpen.context, requests));
  const committed = parseScFen(second.settlement.committed.scfen);
  assert.deepEqual(committed.queue?.actions, [{ ...deploy, seq: 0 }]);
  assert.deepEqual(committed.gas, { w: 2, b: 3 });
  const nativeReplacement = endTurnWithProvenance({ snapshot: committed, provenance: nativeReplacementBegin.provenance,
    actionBindings: [{ sourceActionSeq: 0, side: "w", actionRef: { planningOrdinal: 1, acceptedActionOrdinal: 0 } }],
  });
  assert.deepEqual(nativeReplacement.nativeResult, second.settlement.rawResolve);
  assert.equal(nativeReplacement.frames.length, 1);
  const frame = nativeReplacement.frames[0]!;
  const birth = frame.effects.find(effect => effect.kind === "unit-create");
  const death = frame.effects.find(effect => effect.kind === "unit-destroy");
  assert.ok(birth?.kind === "unit-create" && death?.kind === "unit-destroy");
  assert.deepEqual([frame.phase, birth.entity.side, birth.entity.square, birth.entity.type, birth.entity.tankMode, birth.sourceActionSeq], ["B", "w", "d2", "r", "siege", 0]);
  assert.deepEqual([death.entity.side, death.entity.square, death.entity.type, death.entity.tankMode, death.sourceActionSeq], ["b", "d2", "r", "siege", 0]);
  assert.notEqual(birth.entity.id, death.entity.id);
  assert.deepEqual(frame.effects.map(effect => effect.kind), ["unit-create", "unit-destroy", "deployment-disposition"]);
  const nativeVision = getSideVision(placementToMap(committed.placement), "w", {
    mines: committed.mines ?? [], tankModeFor: square => committed.siegedTanks?.includes(square) ? "siege" : "tank",
  });
  assert.equal(nativeVision.litSquares.has(death.entity.square), true);

  const ownBefore = { units: initial.w.snapshot.own.pieces.map(piece => ({ ...piece, mode: piece.type === "r" ? "tank" as const : null })), mines: [], ccLives: 3 };
  const ownAfter = { ...ownBefore, units: [...ownBefore.units, { square: "d2" as const, type: "r" as const, mode: "siege" as const }].sort((a, b) => a.square < b.square ? -1 : a.square > b.square ? 1 : 0) };
  const whiteGroups = replaced.w.groups.filter(group => group.kind === "effects");
  const blackGroups = replaced.b.groups.filter(group => group.kind === "effects");
  assert.deepEqual(whiteGroups.map(({ beforeOwn, afterOwn, facts }) => ({ beforeOwn, afterOwn, facts })), [{
    beforeOwn: ownBefore, afterOwn: ownAfter, facts: [
      { kind: "unit-born", actionRef: { planningOrdinal: 1, acceptedActionOrdinal: 0 }, square: "d2", type: "r", mode: "siege" },
      { kind: "enemy-destruction-witnessed", square: "d2", type: "r", ownActionRef: { planningOrdinal: 1, acceptedActionOrdinal: 0 } },
    ],
  }]);
  assert.deepEqual(blackGroups.map(({ beforeOwn, afterOwn, facts }) => ({ beforeOwn, afterOwn, facts })), [{
    beforeOwn: siegedBlackGeometry, afterOwn: { ...siegedBlackGeometry, units: siegedBlackGeometry.units.filter(unit => unit.square !== "d2") },
    facts: [{ kind: "unit-destroyed", subject: { kind: "before-unit", square: "d2" }, square: "d2", type: "r" }],
  }]);
  const admission = replaced.w.groups.find(group => group.kind === "admission");
  assert.ok(admission?.kind === "admission");
  assert.deepEqual(admission.actions, [{ actionRef: { planningOrdinal: 1, acceptedActionOrdinal: 0 }, action: deploy, minerals: UNIT_COST.r, gas: specialGasCost("deploy") }]);
  assert.deepEqual([UNIT_COST.r, specialGasCost("deploy"), second.settlement.committed.bank, second.settlement.grants, second.settlement.after.bank], [5, 1, { w: 7, b: 12 }, { w: 3, b: 0 }, { w: 10, b: 12 }]);
  assert.deepEqual(second.settlement.after.bank, applyStoredIncome(second.settlement.committed.bank, nativeReplacement.nativeResult.next.turn));
  assert.deepEqual(replaced.w.snapshot.own.siegedTanks, ["d2"]);
  assert.deepEqual(replaced.b.snapshot.own.siegedTanks, []);
  assert.deepEqual(replaced.w.snapshot.cells.find(cell => cell.square === "d2"), { square: "d2", visibility: "lit", piece: { color: "w", type: "r" } });
  assert.deepEqual(replaced.b.snapshot.cells.find(cell => cell.square === "d2"), { square: "d2", visibility: "unknown" });
  for (const side of ["w", "b"] as const) {
    assert.deepEqual(parseEconomicBoundary(replaced[side]), replaced[side]);
    assert.ok(!/engine:|tankMode|sourceActionSeq|siegeMask/.test(JSON.stringify(replaced[side])));
  }
  const next = planning(replay.open(2));
  const { begin: _nextBegin, boundaries: _nextBoundaries, ...oldNext } = next;
  assert.deepEqual(oldNext, oracle.open(1, 2));
  for (const side of ["w", "b"] as const) assert.deepEqual(replaced[side].snapshot.cells, next.views[side].cells);
  assert.deepEqual([next.context.turn, next.views.w.own.minerals, next.views.w.own.gas, next.views.w.own.siegedTanks], [23, 10, 3, ["d2"]]);
  assert.deepEqual(replay.close(), oracle.close(1));
});

test("fixed all-actors hidden enemy siege mode changes no white boundary or observation bytes", () => {
  const pass = new EconomicReplay(); const siege = new EconomicReplay();
  const initialPass = pass.start("all-actors-v1"); const initialSiege = siege.start("all-actors-v1");
  assert.deepEqual(initialPass.boundaries.w.snapshot.cells.find(cell => cell.square === "d8"), { square: "d8", visibility: "unknown" });
  assert.equal(JSON.stringify(initialPass.boundaries.w), JSON.stringify(initialSiege.boundaries.w));
  const passOpen = planning(pass.open(0)); const siegeOpen = planning(siege.open(0));
  assert.equal(JSON.stringify(passOpen.boundaries.w), JSON.stringify(siegeOpen.boundaries.w));
  const passed = pass.settle(passOpen.context, empty);
  const sieged = siege.settle(siegeOpen.context, { w: [], b: [{ kind: "siegeMode", timing: "F", color: "b", from: "d8" }] });
  assert.deepEqual(parseScFen(sieged.settlement.after.scfen).siegedTanks, ["d8"]);
  assert.deepEqual(sieged.boundaries.b.snapshot.own.siegedTanks, ["d8"]);
  assert.equal(JSON.stringify(passed.boundaries.w), JSON.stringify(sieged.boundaries.w));
  assert.deepEqual(sieged.boundaries.w.groups.filter(group => group.kind === "effects" || group.kind === "admission"), []);
  const passNext = planning(pass.open(1)); const siegeNext = planning(siege.open(1));
  assert.equal(JSON.stringify(passNext.boundaries.w), JSON.stringify(siegeNext.boundaries.w));
  assert.equal(JSON.stringify(passNext.views.w), JSON.stringify(siegeNext.views.w));
  assert.deepEqual(siegeNext.views.w.cells.find(cell => cell.square === "d8"), { square: "d8", visibility: "unknown" });
  pass.close(); siege.close();
});

for (const [marked, mode] of [[true, "siege"], [false, "tank"]] as const) {
  test(`native endowed-pawn capture promotion to rook samples ${mode} mode at the actual b8 transform square`, () => {
    const snapshot = parseScFen(`SCFEN|1r2k3/P7/8/8/8/8/8/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:${marked ? "|S:b8" : ""}`);
    const provenance = initializeProvenance(snapshot);
    const originalPawn = provenance.entities.find(entity => entity.kind === "unit" && entity.side === "w" && entity.square === "a7");
    assert.ok(originalPawn?.kind === "unit");
    assert.deepEqual([originalPawn.type, originalPawn.tankMode], ["p", null]);
    const nativeBegin = beginTurnWithProvenance({ snapshot, provenance });
    const replay = EconomicReplay.fromSnapshotForTest(snapshot);
    const oracle = NativeReplay.fromSnapshotForTest(snapshot);
    const { boundaries: initial, rules: _rules, ...start } = replay.start("tiny-v1");
    assert.deepEqual(start, oracle.start("tiny-v1"));
    assert.deepEqual(initial.w.groups, []);
    assert.deepEqual(initial.w.snapshot.own.pieces, [{ square: "a7", type: "p" }, { square: "e1", type: "k" }]);
    const opened = planning(replay.open(0));
    const { begin, boundaries: _openedBoundaries, ...oldOpened } = opened;
    assert.deepEqual(oldOpened, oracle.open(1, 0));
    assert.deepEqual(begin.rawBegin, nativeBegin.nativeResult);
    assert.deepEqual(opened.views.w.cells.find(cell => cell.square === "b8"), { square: "b8", visibility: "lit", piece: { color: "b", type: "r" } });
    const action: Action = { kind: "classical", timing: "C", color: "w", from: "a7", to: "b8", promotion: "r" };
    const requests: Pair<Action[]> = { w: [action], b: [] };
    const { boundaries, ...paid } = replay.settle(opened.context, requests);
    assert.deepEqual(paid, oracle.commit(opened.context, requests));
    const committed = parseScFen(paid.settlement.committed.scfen);
    assert.deepEqual(committed.queue?.actions, [{ ...action, seq: 0 }]);
    const native = endTurnWithProvenance({ snapshot: committed, provenance: nativeBegin.provenance,
      actionBindings: [{ sourceActionSeq: 0, side: "w", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 } }],
    });
    assert.deepEqual(native.nativeResult, paid.settlement.rawResolve);
    assert.deepEqual(native.frames.map(frame => frame.phase), ["C-attack", "C-move", "C-promotion"]);
    assert.deepEqual(native.frames.flatMap(frame => frame.effects).map(effect => effect.kind), ["unit-destroy", "unit-move", "unit-transform"]);
    const move = native.frames[1]!.effects[0]!;
    const transformFrame = native.frames[2]!;
    const transform = transformFrame.effects[0]!;
    assert.deepEqual(move, { kind: "unit-move", entityId: originalPawn.id, from: "a7", to: "b8", sourceActionSeq: 0 });
    assert.deepEqual(transform, { kind: "unit-transform", entityId: originalPawn.id, fromType: "p", toType: "r", sourceActionSeq: 0 });
    assert.deepEqual(transformFrame.before.entities.find(entity => entity.id === originalPawn.id), { ...originalPawn, square: "b8" });
    assert.deepEqual(transformFrame.after.entities.find(entity => entity.id === originalPawn.id), { ...originalPawn, square: "b8", type: "r", tankMode: mode });
    assert.deepEqual(native.provenance.entities.find(entity => entity.id === originalPawn.id), { ...originalPawn, square: "b8", type: "r", tankMode: mode });
    assert.equal(native.provenance.unitCounter, provenance.unitCounter);

    const king = { square: "e1", type: "k", mode: null };
    const originGeometry = { units: [{ square: "a7", type: "p", mode: null }, king], mines: [], ccLives: 3 };
    const movedGeometry = { ...originGeometry, units: [{ square: "b8", type: "p", mode: null }, king] };
    const promotedGeometry = { ...movedGeometry, units: [{ square: "b8", type: "r", mode }, king] };
    const whiteEffects = boundaries.w.groups.filter(group => group.kind === "effects");
    assert.deepEqual(whiteEffects.map(({ beforeOwn, afterOwn, facts }) => ({ beforeOwn, afterOwn, facts })), [
      { beforeOwn: originGeometry, afterOwn: originGeometry, facts: [{ kind: "enemy-destruction-witnessed", square: "b8", type: "r", ownActionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 } }] },
      { beforeOwn: originGeometry, afterOwn: movedGeometry, facts: [{ kind: "unit-moved", subject: { kind: "before-unit", square: "a7" }, from: "a7", to: "b8" }] },
      { beforeOwn: movedGeometry, afterOwn: promotedGeometry, facts: [{ kind: "unit-transformed", subject: { kind: "before-unit", square: "b8" }, fromType: "p", toType: "r", toMode: mode }] },
    ]);
    const blackEffects = boundaries.b.groups.filter(group => group.kind === "effects");
    assert.deepEqual(blackEffects.map(group => group.facts), [[{ kind: "unit-destroyed", subject: { kind: "before-unit", square: "b8" }, square: "b8", type: "r" }]]);
    assert.deepEqual(blackEffects[0]!.beforeOwn.units.find(unit => unit.square === "b8"), { square: "b8", type: "r", mode });
    assert.ok(!blackEffects[0]!.afterOwn.units.some(unit => unit.square === "b8"));
    const admission = boundaries.w.groups.find(group => group.kind === "admission");
    assert.ok(admission?.kind === "admission");
    assert.deepEqual(admission.actions, [{ actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, action, minerals: 0, gas: 0 }]);
    assert.deepEqual(paid.settlement.committed.bank, { w: 3, b: 3 });
    assert.deepEqual(paid.settlement.after.bank, applyStoredIncome(paid.settlement.committed.bank, native.nativeResult.next.turn));
    assert.deepEqual([boundaries.w.turn, paid.settlement.grants, paid.settlement.after.bank], [22, { w: 3, b: 3 }, { w: 6, b: 6 }]);
    assert.deepEqual(native.nativeResult.next.siegedTanks ?? [], marked ? ["b8"] : []);
    assert.deepEqual(boundaries.w.snapshot.own.siegedTanks, marked ? ["b8"] : []);
    assert.deepEqual(boundaries.w.snapshot.own.pieces, [{ square: "b8", type: "r" }, { square: "e1", type: "k" }]);
    assert.deepEqual(boundaries.w.snapshot.cells.find(cell => cell.square === "b8"), { square: "b8", visibility: "lit", piece: { color: "w", type: "r" } });
    assert.deepEqual(parseEconomicBoundary(boundaries.w), boundaries.w);
    assert.deepEqual(replay.close(), oracle.close(1));
  });
}

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
