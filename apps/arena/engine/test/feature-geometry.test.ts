// SPEC: _spec/apps/arena/burn-compat.puml
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  attacksSquare, classicalRewriteCoordinatesAfterB, getUnitVision, isScMoveShape, orderBHeadsFirst, rayBetween,
  type ScAction, type ScActionInput, type ScPiece, type Square,
} from "@chess-coach/starchess-core/planning-v1";
import {
  appendFeatureAction, emptyFeatureQueue, FeatureGeometryError, nativeAttackShape, nativeOwnSchedule, nativeRay, nativeUnitLit,
  type FeatureQueue, type GeometryCharge,
} from "../feature-geometry";

const noCharge: GeometryCharge = () => {};
const squares: Square[] = Array.from({ length: 64 }, (_, i) => `${String.fromCharCode(97 + Math.floor(i / 8))}${i % 8 + 1}` as Square);
const kinds = ["classical", "deploy", "stimStep", "spiderMine", "charonMissiles", "siegeMode", "tacticalJump"] as const;
const units = ["p", "n", "b", "r", "q", "k"] as const;
const code = (expected: "BAD_INPUT" | "PROVENANCE", reason?: RegExp) => (error: unknown) => error instanceof FeatureGeometryError && error.code === expected && (!reason || reason.test(error.message));

function queueFor(side: "w" | "b", actions: readonly ScActionInput[], charge = noCharge): FeatureQueue {
  let queue = emptyFeatureQueue(side, charge);
  for (const action of actions) queue = appendFeatureAction(queue, action.kind, action.timing, action.from, action.to ?? null,
    "unit" in action ? action.unit ?? null : null,
    action.promotion === undefined ? null : action.promotion === "p" ? (() => { throw new Error("Invalid test promotion"); })() : action.promotion,
    charge);
  return queue;
}

function expectedSchedule(actions: readonly ScActionInput[]) {
  const sequenced: ScAction[] = actions.map((action, seq) => ({ ...action, seq }));
  const c = sequenced.find(action => action.timing === "C");
  return { bOrder: orderBHeadsFirst(sequenced.filter(action => action.timing === "B")).map(action => action.seq),
    classical: c ? { index: c.seq, rewrite: classicalRewriteCoordinatesAfterB(sequenced, c) } : null };
}

test("feature queues preserve native dependency heads, stable cycles, authored indices and structural C rewrites", () => {
  const cases: readonly ScActionInput[][] = [
    [],
    [{ kind: "classical", timing: "C", color: "w", from: "d2", to: "d3" }],
    [
      { kind: "stimStep", timing: "B", color: "w", from: "e2", to: "e3" },
      { kind: "stimStep", timing: "B", color: "w", from: "e3", to: "e4" },
      { kind: "stimStep", timing: "B", color: "w", from: "e4", to: "e5" },
    ],
    [
      { kind: "tacticalJump", timing: "B", color: "w", from: "a1", to: "b2" },
      { kind: "tacticalJump", timing: "B", color: "w", from: "b2", to: "a1" },
      { kind: "siegeMode", timing: "B", color: "w", from: "c1" },
    ],
    [
      { kind: "siegeMode", timing: "F", color: "w", from: "a1" },
      { kind: "stimStep", timing: "B", color: "w", from: "d2", to: "d3" },
      { kind: "classical", timing: "C", color: "w", from: "d2", to: "d3", promotion: "r" },
      { kind: "spiderMine", timing: "B", color: "w", from: "b1" },
    ],
    [
      { kind: "classical", timing: "C", color: "w", from: "d2", to: "d3" },
      { kind: "stimStep", timing: "B", color: "w", from: "d2", to: "d3" },
    ],
    [
      { kind: "stimStep", timing: "F", color: "w", from: "d2", to: "d3" },
      { kind: "classical", timing: "C", color: "w", from: "d2", to: "d3" },
    ],
    [
      { kind: "tacticalJump", timing: "B", color: "w", from: "c3", to: "e5" },
      { kind: "classical", timing: "C", color: "w", from: "c3", to: "e5" },
    ],
    [
      { kind: "tacticalJump", timing: "B", color: "w", from: "c3", to: "g7" },
      { kind: "classical", timing: "C", color: "w", from: "c3", to: "g7" },
    ],
    [
      { kind: "stimStep", timing: "B", color: "w", from: "d3", to: "d4" },
      { kind: "classical", timing: "C", color: "w", from: "d3", to: "e4" },
    ],
  ];
  for (const actions of cases) {
    const unchanged = structuredClone(actions);
    assert.deepEqual(nativeOwnSchedule(queueFor("w", actions), noCharge), expectedSchedule(actions));
    assert.deepEqual(actions, unchanged);
  }
  assert.deepEqual(nativeOwnSchedule(queueFor("w", cases[2]!), noCharge).bOrder, [2, 1, 0]);
  assert.deepEqual(nativeOwnSchedule(queueFor("w", cases[3]!), noCharge).bOrder, [2, 0, 1]);
  assert.deepEqual(nativeOwnSchedule(queueFor("w", cases[4]!), noCharge), { bOrder: [1, 3], classical: { index: 2, rewrite: { from: "d3", to: "d4" } } });
  assert.deepEqual(nativeOwnSchedule(queueFor("w", cases[5]!), noCharge), { bOrder: [1], classical: { index: 0, rewrite: { from: "d3", to: "d4" } } });
  const black: ScActionInput[] = [{ kind: "stimStep", timing: "B", color: "b", from: "d7", to: "d6" }, { kind: "classical", timing: "C", color: "b", from: "d7", to: "d6" }];
  assert.deepEqual(nativeOwnSchedule(queueFor("b", black), noCharge), expectedSchedule(black));
  assert.deepEqual(nativeOwnSchedule(queueFor("b", black), noCharge).classical?.rewrite, { from: "d6", to: "d5" });
});

test("feature queue grammar covers every kind/timing, exact nullable applicability and native promotion options", () => {
  const queue = emptyFeatureQueue("w", noCharge);
  for (const kind of kinds) for (const timing of ["B", "C", "F"] as const) {
    const to = kind === "spiderMine" || kind === "siegeMode" ? null : "e3";
    const unit = kind === "deploy" ? "p" : null;
    let billed = 0;
    const append = () => appendFeatureAction(queue, kind, timing, "e2", to, unit, null, fee => { billed += fee; });
    if ((kind === "classical") === (timing === "C")) {
      assert.ok(append()); assert.equal(billed, 512 + 192);
    } else { assert.throws(append, code("BAD_INPUT", /timing/)); assert.equal(billed, 0); }
  }
  for (const spawn of ["p", "n", "b", "r", "q"] as const) assert.ok(appendFeatureAction(queue, "deploy", "B", "e1", "d2", spawn, null, noCharge));
  for (const promotion of ["n", "b", "r", "q"] as const) for (const [kind, timing] of [["classical", "C"], ["stimStep", "B"], ["stimStep", "F"]] as const) assert.ok(appendFeatureAction(queue, kind, timing, "a7", "a8", null, promotion, noCharge));
  const malformed: unknown[][] = [
    [queue, "unknown", "B", "e2", "e3", null, null], [queue, "classical", "X", "e2", "e3", null, null],
    [queue, "deploy", "B", "e1", "d2", null, null], [queue, "deploy", "B", "e1", "d2", "k", null],
    [queue, "classical", "C", "e2", null, null, null], [queue, "siegeMode", "B", "a1", "a1", null, null],
    [queue, "spiderMine", "F", "b1", undefined, null, null], [queue, "classical", "C", "e2", "e3", "p", null],
    [queue, "classical", "C", "a7", "a8", null, "p"], [queue, "stimStep", "B", "a7", "a8", null, "k"],
    [queue, "deploy", "B", "e1", "d2", "p", "q"], [queue, "tacticalJump", "F", "a1", "b2", null, undefined],
    [queue, "classical", "C", "e2", "e3", undefined, null],
  ];
  for (const args of malformed) {
    let billed = false;
    assert.throws(() => Reflect.apply(appendFeatureAction, undefined, [...args, () => { billed = true; }]), code("BAD_INPUT"));
    assert.equal(billed, false);
  }
  assert.deepEqual(nativeOwnSchedule(queue, noCharge), { bOrder: [], classical: null });
});

test("feature queues enforce four actions and one classical without claiming admission or mutating old queues", () => {
  const first = emptyFeatureQueue("w", noCharge);
  const c = appendFeatureAction(first, "classical", "C", "d2", "d3", null, null, noCharge);
  assert.throws(() => appendFeatureAction(c, "classical", "C", "e2", "e3", null, null, noCharge), code("BAD_INPUT", /already has/));
  let four = first;
  for (let n = 0; n < 4; n++) four = appendFeatureAction(four, "spiderMine", "B", "b1", null, null, null, noCharge);
  let billed = false;
  assert.throws(() => appendFeatureAction(four, "siegeMode", "F", "d1", null, null, null, () => { billed = true; }), code("BAD_INPUT", /four actions/));
  assert.equal(billed, false);
  assert.deepEqual(nativeOwnSchedule(four, noCharge).bOrder, [0, 1, 2, 3]);
  assert.deepEqual(nativeOwnSchedule(first, noCharge), { bOrder: [], classical: null });
  assert.deepEqual(nativeOwnSchedule(c, noCharge), { bOrder: [], classical: { index: 0, rewrite: null } });
});

test("foreign, copied, inherited, accessor, revoked and proxy queue identities trigger no caller traps or charges", () => {
  const queue = emptyFeatureQueue("w", noCharge);
  let traps = 0; let billed = 0;
  const handler: ProxyHandler<object> = {
    get() { traps++; throw new Error("get trap executed"); }, ownKeys() { traps++; throw new Error("ownKeys trap executed"); },
    getOwnPropertyDescriptor() { traps++; throw new Error("descriptor trap executed"); }, getPrototypeOf() { traps++; throw new Error("prototype trap executed"); },
  };
  const accessor = Object.defineProperty({}, "actions", { get() { traps++; throw new Error("accessor executed"); } });
  const revoked = Proxy.revocable(queue, handler); revoked.revoke();
  const foreign: unknown[] = [{}, Object.assign({}, queue), structuredClone(queue), Object.create(queue), accessor, new Proxy(queue, handler), new Proxy({}, handler), revoked.proxy, null, undefined, 0, "queue", Symbol("queue")];
  for (const value of foreign) {
    assert.throws(() => nativeOwnSchedule(value as FeatureQueue, () => { billed++; }), code("PROVENANCE"));
    assert.throws(() => appendFeatureAction(value as FeatureQueue, "siegeMode", "B", "a1", null, null, null, () => { billed++; }), code("PROVENANCE"));
  }
  assert.equal(traps, 0); assert.equal(billed, 0);
});

test("feature queues retain captured WeakMap intrinsics after prototype and Reflect replacement", () => {
  const originalGet = WeakMap.prototype.get; const originalSet = WeakMap.prototype.set; const originalApply = Reflect.apply;
  const queue = emptyFeatureQueue("b", noCharge);
  let next: FeatureQueue;
  try {
    WeakMap.prototype.get = () => { throw new Error("replaced WeakMap.get"); };
    WeakMap.prototype.set = () => { throw new Error("replaced WeakMap.set"); };
    Reflect.apply = () => { throw new Error("replaced Reflect.apply"); };
    next = appendFeatureAction(queue, "classical", "C", "d7", "d6", null, null, noCharge);
  } finally { WeakMap.prototype.get = originalGet; WeakMap.prototype.set = originalSet; Reflect.apply = originalApply; }
  assert.deepEqual(nativeOwnSchedule(next!, noCharge), { bOrder: [], classical: { index: 0, rewrite: null } });
});

test("geometry rejects malformed primitive metadata without coercion or charging", () => {
  let traps = 0; let billed = 0;
  const charge = () => { billed++; };
  const poison = new Proxy({}, { get() { traps++; throw new Error("primitive coercion executed"); } });
  for (const square of ["a0", "i1", "a10", "A1", " a1", "a1\n", null, undefined, poison, new String("a1")]) {
    assert.throws(() => Reflect.apply(nativeRay, undefined, [square, "h8", charge]), code("BAD_INPUT", /square/));
    assert.throws(() => Reflect.apply(nativeUnitLit, undefined, ["p", "w", square, null, charge]), code("BAD_INPUT", /square/));
  }
  for (const unit of ["x", null, undefined, poison]) assert.throws(() => Reflect.apply(nativeAttackShape, undefined, [unit, "w", "d4", "e5", charge]), code("BAD_INPUT", /unit/));
  for (const side of ["x", null, undefined, poison]) assert.throws(() => Reflect.apply(emptyFeatureQueue, undefined, [side, charge]), code("BAD_INPUT", /side/));
  for (const mode of [null, undefined, "Tank", "sieged", poison]) assert.throws(() => Reflect.apply(nativeUnitLit, undefined, ["r", "w", "d4", mode, charge]), code("BAD_INPUT", /explicit mode/));
  for (const mode of ["tank", "siege", undefined, poison]) assert.throws(() => Reflect.apply(nativeUnitLit, undefined, ["p", "w", "d4", mode, charge]), code("BAD_INPUT", /null mode/));
  assert.throws(() => Reflect.apply(emptyFeatureQueue, undefined, ["w", null]), code("BAD_INPUT", /charge callback/));
  assert.equal(traps, 0); assert.equal(billed, 0);
});

test("all six singleton attack shapes match native geometry at every board coordinate for both sides", () => {
  for (const unit of units) for (const side of ["w", "b"] as const) for (const from of squares) {
    const board = new Map<Square, ScPiece>([[from, { color: side, type: unit }]]);
    for (const to of squares) assert.equal(nativeAttackShape(unit, side, from, to, noCharge), attacksSquare(board, from, to), `${side}:${unit}:${from}:${to}`);
  }
  assert.equal(nativeAttackShape("p", "w", "d4", "d5", noCharge), false);
  assert.equal(nativeAttackShape("p", "w", "d4", "e5", noCharge), true);
  assert.equal(isScMoveShape("p", "d4", "d5", "w"), true);
  assert.equal(nativeAttackShape("p", "b", "d5", "d4", noCharge), false);
  assert.equal(nativeAttackShape("p", "b", "d5", "c4", noCharge), true);
});

test("native rays preserve travel order, exclude endpoints and stay within six squares for every pair", () => {
  for (const from of squares) for (const to of squares) {
    const ray = nativeRay(from, to, noCharge);
    assert.deepEqual(ray, rayBetween(from, to));
    assert.ok(ray.length <= 6); assert.ok(!ray.includes(from)); assert.ok(!ray.includes(to)); assert.ok(Object.isFrozen(ray));
  }
  assert.deepEqual(nativeRay("h8", "a1", noCharge), ["g7", "f6", "e5", "d4", "c3", "b2"]);
  assert.deepEqual(nativeRay("a1", "b3", noCharge), []);
  assert.deepEqual(nativeRay("a1", "a1", noCharge), []);
});

test("native singleton vision matches every unit, side, source and explicit rook mode with canonical lit-only output", () => {
  for (const unit of units) for (const side of ["w", "b"] as const) for (const source of squares) for (const mode of unit === "r" ? ["tank", "siege"] as const : [null]) {
    const board = new Map<Square, ScPiece>([[source, { color: side, type: unit }]]);
    const expected = getUnitVision(board, source, mode === null ? undefined : { tankModeFor: () => mode });
    const lit = nativeUnitLit(unit, side, source, mode, noCharge);
    assert.deepEqual(lit, [...expected.litSquares].sort());
    assert.ok(lit.length <= 64); assert.equal(new Set(lit).size, lit.length); assert.ok(Object.isFrozen(lit));
  }
  const board = new Map<Square, ScPiece>([["a1", { color: "w", type: "b" }], ["h8", { color: "b", type: "q" }]]);
  assert.equal(getUnitVision(board, "a1").revealedPieces.has("h8"), true);
  assert.equal(nativeUnitLit("b", "w", "a1", null, noCharge).includes("h8"), false);
  assert.ok(nativeUnitLit("r", "w", "d4", "siege", noCharge).length > nativeUnitLit("r", "w", "d4", "tank", noCharge).length);
});

test("queues and detached schedule/ray/vision outputs remain deeply immutable across appends and refusals", () => {
  const queue = queueFor("w", [{ kind: "stimStep", timing: "B", color: "w", from: "d2", to: "d3" }, { kind: "classical", timing: "C", color: "w", from: "d2", to: "d3" }]);
  const before = nativeOwnSchedule(queue, noCharge);
  const next = appendFeatureAction(queue, "siegeMode", "F", "a1", null, null, null, noCharge);
  assert.notEqual(next, queue); assert.ok(Object.isFrozen(queue)); assert.ok(Object.isFrozen(next));
  assert.ok(Object.isFrozen(before)); assert.ok(Object.isFrozen(before.bOrder)); assert.ok(Object.isFrozen(before.classical)); assert.ok(Object.isFrozen(before.classical?.rewrite));
  assert.throws(() => { (before.bOrder as number[]).push(9); }, TypeError);
  assert.throws(() => { (before.classical!.rewrite as { from: Square; to: Square }).from = "h8"; }, TypeError);
  const ray = nativeRay("a1", "a8", noCharge); const lit = nativeUnitLit("r", "w", "d4", "tank", noCharge);
  assert.throws(() => { (ray as Square[]).reverse(); }, TypeError);
  assert.throws(() => { (lit as Square[]).pop(); }, TypeError);
  assert.deepEqual(nativeOwnSchedule(queue, noCharge), before);
  assert.notEqual(nativeOwnSchedule(queue, noCharge).bOrder, before.bOrder);
  const refusal = new Error("reserve refused");
  assert.throws(() => appendFeatureAction(queue, "siegeMode", "F", "a1", null, null, null, () => { throw refusal; }), error => error === refusal);
  assert.deepEqual(nativeOwnSchedule(queue, noCharge), before);
});

test("every standalone helper reserves its full exact invoice without caching, allowances or resets", () => {
  const fees: number[] = [];
  let queue = emptyFeatureQueue("w", fee => fees.push(fee));
  assert.deepEqual(fees, [128]);
  for (let n = 0; n <= 4; n++) {
    const invoice: number[] = [];
    nativeOwnSchedule(queue, fee => invoice.push(fee)); nativeOwnSchedule(queue, fee => invoice.push(fee));
    assert.deepEqual(invoice, [2048 + 256 * n * n, 2048 + 256 * n * n]);
    if (n < 4) {
      const appendFees: number[] = [];
      queue = appendFeatureAction(queue, "siegeMode", "B", "d1", null, null, null, fee => appendFees.push(fee));
      assert.deepEqual(appendFees, [512 + 192 * (n + 1)]);
    }
  }
  const unitFees: number[] = [];
  nativeAttackShape("p", "w", "d4", "e5", fee => unitFees.push(fee));
  nativeRay("a1", "h8", fee => unitFees.push(fee));
  nativeUnitLit("r", "w", "d4", "siege", fee => unitFees.push(fee));
  assert.deepEqual(unitFees, [512, 512, 8192]);
});

test("instrumented native delegates prove prepayment before construction, call ceilings, detached results and exception propagation", { timeout: 20_000 }, () => {
  const moduleUrl = new URL("../feature-geometry.ts", import.meta.url).href;
  const nativeUrl = import.meta.resolve("@chess-coach/starchess-core/planning-v1");
  const stub = `
    import * as native from ${JSON.stringify(nativeUrl)};
    const call = (name, args) => {
      const probe = globalThis.f1Probe;
      if (!probe.reserved) throw new Error("Native call preceded invoice: " + name);
      probe.calls[name]++;
      if (probe.fail === name) throw probe.nativeError;
      if (name === "orderBHeadsFirst" || name === "classicalRewriteCoordinatesAfterB") {
        if (!Object.isFrozen(args[0]) || args[0].some(action => !Object.isFrozen(action))) throw new Error("Mutable native schedule input");
      }
      if (name === "attacksSquare" || name === "getUnitVision") {
        if (args[0].size !== 1 || !Object.isFrozen(args[0].get(args[1]))) throw new Error("Native input is not a singleton unit map");
      }
      const result = native[name](...args);
      if (name === "getUnitVision") result.revealedPieces.add("h8");
      probe.last[name] = { args, result };
      return result;
    };
    export const orderBHeadsFirst = (...args) => call("orderBHeadsFirst", args);
    export const classicalRewriteCoordinatesAfterB = (...args) => call("classicalRewriteCoordinatesAfterB", args);
    export const attacksSquare = (...args) => call("attacksSquare", args);
    export const rayBetween = (...args) => call("rayBetween", args);
    export const getUnitVision = (...args) => call("getUnitVision", args);
  `;
  const script = `
    import assert from "node:assert/strict";
    import { registerHooks } from "node:module";
    const names = ["orderBHeadsFirst", "classicalRewriteCoordinatesAfterB", "attacksSquare", "rayBetween", "getUnitVision"];
    const probe = globalThis.f1Probe = { calls: {}, last: {}, fail: null, reserved: false, nativeError: new Error("native sentinel") };
    let tracking = false;
    let covered = { freezes: 0, identities: 0, maps: 0 };
    const freeze = Object.freeze;
    const set = WeakMap.prototype.set;
    const apply = Reflect.apply;
    const NativeMap = Map;
    Object.freeze = value => { if (tracking) covered.freezes++; return freeze(value); };
    WeakMap.prototype.set = function(key, value) { if (tracking) covered.identities++; return apply(set, this, [key, value]); };
    globalThis.Map = class extends NativeMap { constructor(...args) { super(...args); if (tracking) covered.maps++; } };
    registerHooks({
      resolve(specifier, context, next) {
        if (specifier === "@chess-coach/starchess-core/planning-v1" && context.parentURL?.split("?")[0] === ${JSON.stringify(moduleUrl)}) return { url: "feature-native:probe", shortCircuit: true };
        return next(specifier, context);
      },
      load(url, context, next) {
        if (url === "feature-native:probe") return { format: "module", source: ${JSON.stringify(stub)}, shortCircuit: true };
        return next(url, context);
      }
    });
    const api = await import(${JSON.stringify(moduleUrl)});
    const reserve = () => { probe.reserved = true; };
    const reset = () => { for (const name of names) probe.calls[name] = 0; probe.last = {}; probe.reserved = false; probe.fail = null; };
    reset();
    const empty = api.emptyFeatureQueue("w", reserve);
    const classical = api.appendFeatureAction(empty, "classical", "C", "d2", "d3", null, null, reserve);
    const queue = api.appendFeatureAction(classical, "stimStep", "B", "d2", "d3", null, null, reserve);
    assert.deepEqual(probe.calls, Object.fromEntries(names.map(name => [name, 0])));
    const budgetError = new Error("budget sentinel");
    const refusals = [
      [128, charge => api.emptyFeatureQueue("w", charge)],
      [512 + 192 * 2, charge => api.appendFeatureAction(classical, "siegeMode", "B", "a1", null, null, null, charge)],
      [2048 + 256 * 2 * 2, charge => api.nativeOwnSchedule(queue, charge)],
      [512, charge => api.nativeAttackShape("p", "w", "d4", "e5", charge)],
      [512, charge => api.nativeRay("a1", "h8", charge)],
      [8192, charge => api.nativeUnitLit("r", "w", "d4", "siege", charge)]
    ];
    for (const [fee, operation] of refusals) {
      reset(); covered = { freezes: 0, identities: 0, maps: 0 };
      const invoices = [];
      let caught;
      tracking = true;
      try { operation(units => { invoices.push(units); throw budgetError; }); } catch (error) { caught = error; }
      tracking = false;
      assert.equal(caught, budgetError);
      assert.deepEqual(invoices, [fee]);
      assert.deepEqual(covered, { freezes: 0, identities: 0, maps: 0 });
      assert.deepEqual(probe.calls, Object.fromEntries(names.map(name => [name, 0])));
    }
    reset();
    const schedule = api.nativeOwnSchedule(queue, reserve);
    assert.deepEqual(schedule, { bOrder: [1], classical: { index: 0, rewrite: { from: "d3", to: "d4" } } });
    assert.deepEqual(probe.calls, { orderBHeadsFirst: 1, classicalRewriteCoordinatesAfterB: 1, attacksSquare: 0, rayBetween: 0, getUnitVision: 0 });
    assert.notEqual(schedule.classical.rewrite, probe.last.classicalRewriteCoordinatesAfterB.result);
    probe.last.classicalRewriteCoordinatesAfterB.result.from = "h8";
    probe.last.orderBHeadsFirst.result.pop();
    assert.deepEqual(schedule, { bOrder: [1], classical: { index: 0, rewrite: { from: "d3", to: "d4" } } });
    const previousActions = probe.last.classicalRewriteCoordinatesAfterB.args[0];
    reset();
    api.nativeOwnSchedule(queue, reserve);
    assert.notEqual(previousActions, probe.last.classicalRewriteCoordinatesAfterB.args[0]);
    assert.notEqual(previousActions[0], probe.last.classicalRewriteCoordinatesAfterB.args[0][0]);
    reset();
    api.nativeOwnSchedule(empty, reserve);
    assert.deepEqual(probe.calls, { orderBHeadsFirst: 1, classicalRewriteCoordinatesAfterB: 0, attacksSquare: 0, rayBetween: 0, getUnitVision: 0 });
    reset();
    assert.equal(api.nativeAttackShape("p", "w", "d4", "e5", reserve), true);
    assert.equal(probe.calls.attacksSquare, 1);
    reset();
    const ray = api.nativeRay("a1", "a8", reserve);
    assert.equal(probe.calls.rayBetween, 1);
    assert.notEqual(ray, probe.last.rayBetween.result);
    probe.last.rayBetween.result[0] = "h8";
    assert.deepEqual(ray, ["a2", "a3", "a4", "a5", "a6", "a7"]);
    reset();
    const lit = api.nativeUnitLit("r", "w", "a1", "tank", reserve);
    assert.equal(probe.calls.getUnitVision, 1);
    assert.equal(probe.last.getUnitVision.args[2].tankModeFor("a1"), "tank");
    assert.equal(lit.includes("h8"), false);
    assert.ok(probe.last.getUnitVision.result.revealedPieces.has("h8"));
    probe.last.getUnitVision.result.litSquares.clear();
    assert.ok(lit.length > 0);
    const failures = [
      ["orderBHeadsFirst", () => api.nativeOwnSchedule(queue, reserve), [1, 0, 0, 0, 0]],
      ["classicalRewriteCoordinatesAfterB", () => api.nativeOwnSchedule(queue, reserve), [1, 1, 0, 0, 0]],
      ["attacksSquare", () => api.nativeAttackShape("q", "b", "d4", "e5", reserve), [0, 0, 1, 0, 0]],
      ["rayBetween", () => api.nativeRay("a1", "h8", reserve), [0, 0, 0, 1, 0]],
      ["getUnitVision", () => api.nativeUnitLit("p", "w", "d4", null, reserve), [0, 0, 0, 0, 1]]
    ];
    for (const [name, operation, counts] of failures) {
      reset(); probe.fail = name;
      assert.throws(operation, error => error === probe.nativeError);
      assert.deepEqual(names.map(name => probe.calls[name]), counts);
    }
    reset();
    assert.deepEqual(api.nativeOwnSchedule(queue, reserve), schedule);
    reset();
    assert.throws(() => api.nativeRay("invalid", "a1", reserve), error => error.code === "BAD_INPUT");
    assert.deepEqual(probe.calls, Object.fromEntries(names.map(name => [name, 0])));
    assert.equal(probe.reserved, false);
    console.log("feature geometry native instrumentation passed");
  `;
  const env = { ...process.env }; delete env.NODE_OPTIONS; delete env.NODE_PATH; delete env.TSX_TSCONFIG_PATH;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)), env, encoding: "utf8", timeout: 15_000, maxBuffer: 128 * 1024,
  });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), "feature geometry native instrumentation passed");
});

test("feature geometry production imports only the pure native planning boundary", async () => {
  const source = await readFile(new URL("../feature-geometry.ts", import.meta.url), "utf8");
  assert.deepEqual([...source.matchAll(/from\s+"([^"]+)"/g)].map(match => match[1]), ["@chess-coach/starchess-core/planning-v1"]);
  assert.ok(!/\b(?:process|require|eval)\s*[.(]|\.test\.[cm]?[jt]s/.test(source));
});
