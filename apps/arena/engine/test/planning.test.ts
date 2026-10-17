// SPEC: _spec/apps/arena/burn-compat.puml
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { specialGasCost, UNIT_COST, type ScPiece, type Square } from "@chess-coach/starchess-core/planning-v1";
import { MAX_PLANNING_CURSORS_V2, PlanningManager, planningKnowledgeV2, primitiveDomainV2 } from "../planning";
import { ACTION_KINDS, EngineErrorV2, parseViewV2, SQUARES_V2, type Action, type ActionKind, type AuthorizedView, type Side } from "../wire-v2";

function viewV2(side: Side = "w", entries: Record<string, ScPiece> = { e1: { color: "w", type: "k" } }, mines: Square[] = []): AuthorizedView {
  return parseViewV2({ version: "arena-observation-v2", side, turn: 21,
    own: { minerals: 12, gas: 3, gasIncome: 3, ccLives: 3,
      pieces: Object.entries(entries).filter(([, p]) => p.color === side).map(([square, p]) => ({ square, type: p.type })).sort((a, b) => a.square < b.square ? -1 : 1),
      mines, siegedTanks: [] },
    cells: SQUARES_V2.map(square => ({ square, visibility: "lit", piece: entries[square] ?? null })),
  });
}

function rowsV2(view: AuthorizedView, prefix: Action[] = [], family: ActionKind | null = null) {
  return [...primitiveDomainV2(planningKnowledgeV2(view), prefix, family)];
}

function codeV2(code: string) { return (error: unknown) => error instanceof EngineErrorV2 && error.packet.code === code; }

for (const side of ["w", "b"] as const) {
  test(`v2 primitives cover seven families in canonical order for ${side}`, () => {
    const rank = side === "w" ? "1" : "8";
    const marine = side === "w" ? "a2" : "a7";
    const entries: Record<string, ScPiece> = { [marine]: { color: side, type: "p" } };
    for (const [file, type] of [["b", "n"], ["c", "b"], ["d", "r"], ["e", "k"], ["f", "q"]] as const) entries[`${file}${rank}`] = { color: side, type };
    const rows = rowsV2(viewV2(side, entries));
    assert.deepEqual([...new Set(rows.map(r => r.action.kind))], ACTION_KINDS);
    for (const row of rows) {
      assert.equal(row.action.color, side);
      assert.equal(row.cost.minerals, row.action.kind === "deploy" && row.action.unit ? UNIT_COST[row.action.unit] : 0);
      assert.equal(row.cost.gas, row.action.kind === "classical" ? 0 : specialGasCost(row.action.kind));
      assert.ok(Number.isSafeInteger(row.cost.minerals) && Number.isSafeInteger(row.cost.gas));
      assert.notEqual(row.anchor, null);
    }
    for (const family of ACTION_KINDS) {
      const selected = rowsV2(viewV2(side, entries), [], family);
      assert.deepEqual(selected, rows.filter(row => row.action.kind === family));
      assert.ok(selected.length > 0);
      if (family !== "classical") assert.deepEqual([...new Set(selected.map(r => r.action.timing))], ["B", "F"]);
    }
    const deploys = rows.filter(r => r.action.kind === "deploy");
    assert.deepEqual(deploys.slice(0, 5).map(r => r.action.kind === "deploy" ? r.action.unit : undefined), ["p", "n", "b", "r", "q"]);
  });
}

test("v2 planning uses append-time F anchors and shifted command-center deployment", () => {
  const view = viewV2("w", { e1: { color: "w", type: "k" }, b1: { color: "w", type: "n" }, c1: { color: "w", type: "b" } });
  const knight: Action = { kind: "classical", timing: "C", color: "w", from: "b1", to: "c3" };
  const mines = rowsV2(view, [knight], "spiderMine");
  assert.deepEqual(mines.map(r => r.anchor), ["b1", "c3"]);
  const bishop: Action = { kind: "classical", timing: "C", color: "w", from: "c1", to: "e3" };
  const missiles = rowsV2(view, [bishop], "charonMissiles");
  assert.ok(missiles.some(r => r.action.timing === "F" && r.action.to === "a7" && r.anchor === "e3"));
  assert.ok(!missiles.some(r => r.action.timing === "B" && r.action.to === "a7"));
  const center: Action = { kind: "classical", timing: "C", color: "w", from: "e1", to: "e2" };
  const deploys = rowsV2(view, [center], "deploy");
  assert.ok(deploys.some(r => r.action.timing === "F" && r.action.to === "e1" && r.anchor === "e2"));
  assert.ok(deploys.some(r => r.action.timing === "B" && r.anchor === "e1"));
  const repeatedClassicals = rowsV2(view, [knight], "classical");
  assert.ok(repeatedClassicals.length > 0);
  assert.ok(repeatedClassicals.every(r => r.nativeFailure === "timing"));
});

test("v2 black C/F anchors retain original actors and shifted destinations", () => {
  const view = viewV2("b", { e8: { color: "b", type: "k" }, b8: { color: "b", type: "n" }, c8: { color: "b", type: "b" } });
  const knight: Action = { kind: "classical", timing: "C", color: "b", from: "b8", to: "c6" };
  assert.deepEqual(rowsV2(view, [knight], "spiderMine").map(r => r.anchor), ["b8", "c6"]);
  const bishop: Action = { kind: "classical", timing: "C", color: "b", from: "c8", to: "e6" };
  const missiles = rowsV2(view, [bishop], "charonMissiles");
  assert.ok(missiles.some(r => r.action.timing === "F" && r.action.to === "a2" && r.anchor === "e6"));
  assert.ok(!missiles.some(r => r.action.timing === "B" && r.action.to === "a2"));
  const center: Action = { kind: "classical", timing: "C", color: "b", from: "e8", to: "e7" };
  assert.ok(rowsV2(view, [center], "deploy").some(r => r.action.timing === "F" && r.action.to === "e8" && r.anchor === "e7"));
});

for (const side of ["w", "b"] as const) {
  test(`v2 promotes authored and B-rewritten classical coordinates for ${side}`, () => {
    const from = side === "w" ? "a6" : "a3";
    const to = side === "w" ? "a7" : "a2";
    const last = side === "w" ? "a8" : "a1";
    const king = side === "w" ? "e1" : "e8";
    const view = viewV2(side, { [king]: { color: side, type: "k" }, [from]: { color: side, type: "p" } });
    const prefix: Action[] = [{ kind: "stimStep", timing: "B", color: side, from, to }];
    const rewritten = rowsV2(view, prefix, "classical").filter(r => r.action.from === from && r.action.to === to);
    assert.deepEqual(rewritten.map(r => r.action.promotion), ["n", "b", "r", "q"]);
    const promotionView = viewV2(side, { [king]: { color: side, type: "k" }, [to]: { color: side, type: "p" } });
    for (const family of ["classical", "stimStep"] as const) {
      const direct = rowsV2(promotionView, [], family).filter(r => r.action.from === to && r.action.to === last);
      assert.deepEqual(direct.filter(r => r.action.timing !== "F").map(r => r.action.promotion), ["n", "b", "r", "q"]);
    }
  });
}

test("v2 B births can act classically but cannot acquire original-map specials", () => {
  const view = viewV2();
  const prefix: Action[] = [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "d2", unit: "p" }];
  assert.ok(rowsV2(view, prefix, "classical").some(r => r.action.from === "d2"));
  assert.equal(rowsV2(view, prefix, "stimStep").length, 0);
});

test("v2 black F anchors and native timing refusals remain visible as primitive rows", () => {
  const view = viewV2("b", { e8: { color: "b", type: "k" }, b8: { color: "b", type: "n" }, c8: { color: "b", type: "b" } });
  const knight: Action = { kind: "classical", timing: "C", color: "b", from: "b8", to: "c6" };
  assert.deepEqual(rowsV2(view, [knight], "spiderMine").map(r => r.anchor), ["b8", "c6"]);
  const bishop: Action = { kind: "classical", timing: "C", color: "b", from: "c8", to: "e6" };
  assert.ok(rowsV2(view, [bishop], "charonMissiles").some(r => r.action.timing === "F" && r.action.to === "a2" && r.anchor === "e6"));
  const center: Action = { kind: "classical", timing: "C", color: "b", from: "e8", to: "e7" };
  assert.ok(rowsV2(view, [center], "deploy").some(r => r.action.timing === "F" && r.action.to === "e8" && r.anchor === "e7"));
  const marine = viewV2("w", { e1: { color: "w", type: "k" }, a6: { color: "w", type: "p" } });
  const walk: Action = { kind: "classical", timing: "C", color: "w", from: "a6", to: "a7" };
  assert.equal(rowsV2(marine, [walk], "stimStep").find(r => r.action.timing === "F")?.nativeFailure, "timing");
});

test("v2 tactical jumps allow unknown destinations but exclude known occupied cells", () => {
  const view = structuredClone(viewV2("w", { e1: { color: "w", type: "k" }, f1: { color: "w", type: "q" }, h8: { color: "b", type: "n" } }));
  view.cells[SQUARES_V2.indexOf("a8")] = { square: "a8", visibility: "unknown" };
  const rows = rowsV2(parseViewV2(view), [], "tacticalJump");
  assert.ok(rows.some(r => r.action.to === "a8"));
  assert.ok(!rows.some(r => r.action.to === "h8" || r.action.to === "e1" || r.action.to === "f1"));
});

test("v2 mine inventories preserve 0..3 entities and duplicate-square occupancy", () => {
  for (const mines of [[], ["a1"], ["a1", "a1"], ["a1", "a1", "b2"]] as Square[][]) {
    const view = viewV2("w", { e1: { color: "w", type: "k" }, a1: { color: "w", type: "n" } }, mines);
    const knowledge = planningKnowledgeV2(view);
    assert.equal(knowledge.ownMineCount, mines.length);
    assert.equal(knowledge.ownMines.size, new Set(mines).size);
    assert.equal(rowsV2(view, [], "spiderMine")[0]!.nativeFailure, mines.length ? "ownOccupancy" : null);
  }
  const capped = viewV2("w", { e1: { color: "w", type: "k" }, a1: { color: "w", type: "n" } }, ["a2", "b2", "c2"]);
  assert.equal(rowsV2(capped, [], "spiderMine")[0]!.nativeFailure, "mineCap");
});

test("v2 view validation rejects malformed, sparse, extra and inconsistent DTO fields", () => {
  const valid = viewV2();
  const invalid: unknown[] = [null, { ...valid, actual: {} }, { ...valid, version: "arena-smoke-observation-v1" },
    { ...valid, own: { ...valid.own, pieces: [] } }, { ...valid, cells: valid.cells.slice(1) },
    { ...valid, own: { ...valid.own, mines: ["a1", "a1", "a1", "a1"] } },
    { ...valid, own: { ...valid.own, mines: ["b1", "a1"] } },
    { ...valid, own: { ...valid.own, siegedTanks: ["e1"] } },
    { ...valid, own: { ...valid.own, gas: NaN } }, { ...valid, own: { ...valid.own, minerals: 13 } },
    { ...valid, own: { ...valid.own, gasIncome: 0 } }, { ...valid, turn: 46 },
    { ...valid, cells: valid.cells.map((c, i) => i ? c : { square: "a1", visibility: "unknown", piece: null }) },
  ];
  const sparse = [...valid.cells];
  delete sparse[0];
  invalid.push({ ...valid, cells: sparse });
  const accessor = { ...valid };
  Object.defineProperty(accessor, "side", { enumerable: true, get() { throw new Error("must not run"); } });
  invalid.push(accessor);
  for (const value of invalid) assert.throws(() => parseViewV2(value), codeV2("BAD_REQUEST"));
  assert.ok(Object.isFrozen(parseViewV2(valid).own.pieces));
});

test("v2 cursor batches preserve exhaustion tombstones, view ownership and closure", () => {
  const manager = new PlanningManager();
  const p = manager.open(viewV2()).planning;
  const other = manager.open(viewV2()).planning;
  assert.throws(() => manager.open(viewV2()), codeV2("LIMIT"));
  const cursor = manager.next(p, [{ kind: "start", prefix: [], family: "classical" }]).steps[0]!.cursor;
  assert.throws(() => manager.next(other, [{ kind: "resume", cursor }]), codeV2("STATE"));
  assert.throws(() => manager.next(p, [{ kind: "resume", cursor: 999999 }]), codeV2("STATE"));
  let count = 1;
  let exhausted = false;
  for (let i = 0; i < 4 && !exhausted; i++) {
    const steps = manager.next(p, Array.from({ length: 8 }, () => ({ kind: "resume" as const, cursor }))).steps;
    for (const step of steps) {
      if (step.proposal) { assert.equal(exhausted, false); count++; }
      else exhausted = true;
    }
  }
  assert.equal(count, rowsV2(viewV2(), [], "classical").length);
  assert.equal(exhausted, true);
  assert.equal(manager.liveCursors, 0);
  assert.equal(manager.next(p, [{ kind: "resume", cursor }]).steps[0]!.proposal, null);
  manager.close(p);
  assert.throws(() => manager.next(p, [{ kind: "resume", cursor }]), codeV2("STATE"));
  manager.close(other);
  assert.equal(manager.liveContexts, 0);
});

test("v2 cursors enforce total creation, batch caps and invalid-prefix atomicity", () => {
  const manager = new PlanningManager();
  const p = manager.open(viewV2()).planning;
  const invalid: Action = { kind: "classical", timing: "C", color: "b", from: "e8", to: "d8" };
  assert.throws(() => manager.next(p, [{ kind: "start", prefix: [invalid], family: null }]), codeV2("BAD_REQUEST"));
  assert.throws(() => manager.next(p, Array.from({ length: 9 }, () => ({ kind: "start" as const, prefix: [], family: null }))), codeV2("BAD_REQUEST"));
  for (let i = 0; i < MAX_PLANNING_CURSORS_V2; i++) {
    assert.equal(manager.next(p, [{ kind: "start", prefix: [], family: "spiderMine" }]).steps[0]!.proposal, null);
  }
  assert.equal(manager.liveCursors, 0);
  assert.throws(() => manager.next(p, [{ kind: "start", prefix: [], family: null }]), codeV2("LIMIT"));
  manager.close(p);
});

test("v2 pure planning repeats equal limited DTOs without private-world dependencies", async () => {
  const first = viewV2("w", { e1: { color: "w", type: "k" }, f1: { color: "w", type: "q" } });
  const second = parseViewV2(JSON.parse(JSON.stringify(first)));
  const prefix: Action[] = [{ kind: "classical", timing: "C", color: "w", from: "f1", to: "f3" }];
  assert.deepEqual(rowsV2(first, prefix), rowsV2(second, prefix));
  const source = await readFile(new URL("../planning.ts", import.meta.url), "utf8");
  const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(imports, ["@chess-coach/starchess-core/planning-v1", "./wire-v2"]);
  assert.ok(!/addScAction|ScFenSnapshot|CoreRoot|commitWindow/.test(source));
});
