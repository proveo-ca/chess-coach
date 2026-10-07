// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { ACTION_KINDS, encodeCandidate, MAX_QUEUE_ACTIONS, requestedSpend } from "@chess-coach/starchess-arena/intent-codec-v1";
import { validateObservationV1, type AuthorizedObservationV1 } from "@chess-coach/starchess-arena/observations";
import { addScAction, getSideVision, mapToPlacement, SPECIAL_REGISTRY, UNIT_COST, type ScFenSnapshot, type ScPiece, type Square } from "@chess-coach/starchess-core";
import * as publicApi from "../candidates";
import { composeCandidatesFromObservationV1 as compose, decodeCandidate } from "../candidates";
import { composeWithRuntime } from "../composition";
import type { CandidateBatchV3 } from "../contracts";
import { KeyIndex, sha256 } from "../identity";
import { allActors, c, observation, s, squares } from "./fixtures";
import { tinyOracle } from "./tiny-oracle";

const sum = (record: Readonly<Record<string, number>>) => Object.values(record).reduce((a, b) => a + b, 0);
const checkBatch = (batch: CandidateBatchV3) => {
  const d = batch.diagnostics;
  expect(Object.keys(batch).sort()).toEqual(["candidates", "diagnostics", "version"]);
  expect(batch.version).toBe("challenge-composition-v3");
  expect(Object.keys(d).sort()).toEqual([
    "profile", "attemptedExtensions", "uniqueIncludingPass", "retainedNonPass", "duplicates", "ownerSkipped", "quotaSkipped",
    "pruned", "activeFamilies", "exhaustedLanes", "pools", "retainedByOwner", "retainedByLength", "attemptCapReached", "capacityCapReached", "stopReason",
  ].sort());
  expect(Object.keys(d.pruned)).toEqual(["actor", "shape", "timing", "resources", "mineCap", "ownOccupancy"]);
  expect(Object.keys(d.retainedByOwner)).toEqual(ACTION_KINDS);
  expect(Object.keys(d.retainedByLength)).toEqual(["1", "2", "3", "4"]);
  expect(d.profile).toBe("B");
  const checkCounters = (value: unknown): void => {
    if (typeof value === "number") {
      expect(Number.isSafeInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    } else if (value && typeof value === "object") {
      for (const entry of Object.values(value)) checkCounters(entry);
    }
  };
  checkCounters(d);
  expect(d.attemptedExtensions).toBe(sum(d.pruned) + d.ownerSkipped + d.duplicates + d.quotaSkipped + d.retainedNonPass);
  expect(d.uniqueIncludingPass).toBe(1 + d.retainedNonPass);
  expect(d.uniqueIncludingPass).toBe(1 + sum(d.retainedByOwner));
  expect(d.uniqueIncludingPass).toBe(1 + sum(d.retainedByLength));
  expect(d.uniqueIncludingPass).toBe(1 + d.pools.reduce((n, p) => n + p.retained, 0));
  expect(d.pools.reduce((n, p) => n + p.initialCapacity, 0)).toBe(511);
  expect(d.pools.reduce((n, p) => n + p.finalCapacity, 0)).toBe(511);
  expect(d.pools.map((p) => p.id)).toEqual([...ACTION_KINDS, "shared-composition"]);
  for (const pool of d.pools) {
    expect(Object.keys(pool).sort()).toEqual(["id", "initialCapacity", "finalCapacity", "retained", "exhausted"].sort());
    expect(pool.retained).toBeLessThanOrEqual(pool.finalCapacity);
    if (!pool.exhausted && !d.pools[7]!.exhausted) expect(pool.finalCapacity).toBe(pool.initialCapacity);
  }
  expect(d.attemptCapReached).toBe(d.attemptedExtensions === 2048);
  expect(d.capacityCapReached).toBe(d.uniqueIncludingPass === 512);
  expect(d.stopReason).toBe(d.capacityCapReached ? "capacity-cap" : d.attemptCapReached ? "attempt-cap" : "exhausted");
  expect(d.exhaustedLanes).toEqual(d.pools.filter((p) => p.exhausted).map((p) => p.id));
  expect(d.activeFamilies).toEqual(ACTION_KINDS.filter((k) => d.activeFamilies.includes(k)));
  if (d.stopReason === "exhausted") expect(d.exhaustedLanes).toHaveLength(8);
  const keys = batch.candidates.map((candidate) => candidate.key);
  expect(keys).toHaveLength(d.uniqueIncludingPass);
  expect(keys.length).toBeLessThanOrEqual(512);
  expect(keys).toEqual([...keys].sort());
  expect(new Set(keys).size).toBe(keys.length);
  expect(batch.candidates.filter((candidate) => candidate.actions.length === 0)).toHaveLength(1);
  for (const candidate of batch.candidates) {
    expect(candidate.actions.length).toBeLessThanOrEqual(4);
    expect(Object.keys(candidate).sort()).toEqual(["version", "key", "actions", "ownSpend"].sort());
    expect(candidate.ownSpend).toEqual(requestedSpend(candidate.actions));
  }
};

describe("bounded independent tiny oracle", () => {
  it("retains pass once after complete authorized traversal even when every append fails", () => {
    const o = observation([["a8", "k"], ["a7", "p"], ["b7", "p"], ["b8", "p"], ["c8", "p"]], { minerals: 0, gas: 0 });
    const { batch, runtime } = composeWithRuntime(o);
    checkBatch(batch);
    expect(batch.candidates).toEqual([encodeCandidate(o, [])]);
    expect(batch.diagnostics.stopReason).toBe("exhausted");
    expect(batch.diagnostics.activeFamilies).toEqual([]);
    expect(batch.diagnostics.pools.map((pool) => pool.initialCapacity)).toEqual([0, 0, 0, 0, 0, 0, 0, 511]);
    expect(runtime.availabilityPulls).toBeGreaterThan(7);
    expect(runtime.continuationNodes).toBe(0);
    expect(runtime.peakLiveNodes).toBe(8);
  });

  it.each(["w", "b"] as const)("matches complete batch keys and diagnostics with exhaustive zero-budget domain, %s", (side) => {
    const o = observation([[side === "w" ? "a1" : "h8", "k"]], { side, minerals: 0, gas: 0 });
    const oracle = tinyOracle(o);
    const actual = compose(o);
    checkBatch(actual);
    expect(actual.candidates.map((a) => a.key)).toEqual(oracle.keys);
    expect(actual.diagnostics).toEqual(oracle.diagnostics);
    expect(oracle.keys).toEqual(oracle.exhaustive);
    expect(actual.candidates).toHaveLength(4);
    expect(actual.diagnostics.stopReason).toBe("exhausted");
    expect(actual.diagnostics.activeFamilies).toEqual(["classical"]);
    expect(actual.diagnostics.pools.map((p) => p.initialCapacity)).toEqual([336, 0, 0, 0, 0, 0, 0, 175]);
    expect(actual.diagnostics.pools.slice(0, 7).every((p) => p.finalCapacity === p.retained)).toBe(true);
  });

  it.each(["w", "b"] as const)("matches lazy cyclic FIFO bounded coverage and quantifies omissions, %s", (side) => {
    const o = observation([[side === "w" ? "a1" : "h8", "k"]], { side, minerals: 1, gas: 1 });
    const oracle = tinyOracle(o);
    const actual = compose(o);
    checkBatch(actual);
    expect(actual.candidates.map((a) => a.key)).toEqual(oracle.keys);
    expect(actual.diagnostics).toEqual(oracle.diagnostics);
    expect(oracle.exhaustive.length).toBeGreaterThan(oracle.keys.length);
    expect(oracle.keys.every((key) => oracle.exhaustive.includes(key))).toBe(true);
    expect(actual.diagnostics.attemptedExtensions).toBe(2048);
    expect(actual.diagnostics.ownerSkipped).toBeGreaterThan(0);
    expect(actual.diagnostics.duplicates).toBeGreaterThan(0);
    expect(actual.candidates.some((candidate) => candidate.actions[0]?.kind === "deploy")).toBe(true);
    expect(actual.candidates.some((candidate) => candidate.actions.length === 2)).toBe(true);
  });

  it("enumerates actual native membership using a full snapshot only in tests", () => {
    const o = observation([["a1", "k"]], { gas: 1, minerals: 1, enemy: [["h8", "k"]] });
    const oracle = tinyOracle(o);
    const full: ScFenSnapshot = {
      placement: "7k/8/8/8/8/8/8/K7", turn: 21, phase: "P", ccLives: { w: 3, b: 3 },
      gas: { w: 1, b: 3 }, gasIncome: { w: 3, b: 3 }, queue: { actions: [] }, mines: [],
    };
    let nativeAccepted = 0;
    for (const key of oracle.exhaustive) {
      let snapshot = full;
      try {
        for (const action of JSON.parse(key)) snapshot = addScAction({ snapshot, action }).snapshot;
        nativeAccepted++;
      } catch {}
    }
    const actual = compose(o);
    expect(nativeAccepted).toBe(oracle.exhaustive.length);
    expect(actual.candidates.length).toBeLessThan(nativeAccepted);
    for (const candidate of actual.candidates) {
      let snapshot = full;
      for (const action of candidate.actions) snapshot = addScAction({ snapshot, action }).snapshot;
      expect(snapshot.queue?.actions.length).toBe(candidate.actions.length);
    }
  });
});

describe("public V1 bridge, identity, and detachment", () => {
  it("preserves requested spend and the complete composition batch after native cost mutation attempts", () => {
    const o = allActors();
    const actions = [
      { ...s("deploy", "a1", "a2"), unit: "q" as const },
      s("charonMissiles", "d4", "g7"),
      s("tacticalJump", "f6", "h7"),
    ];
    const spend = requestedSpend(actions);
    expect(spend).toEqual({ minerals: 9, gas: 6 });
    const before = compose(o);
    expect(before.diagnostics.activeFamilies).toEqual(ACTION_KINDS);
    expect(before.candidates.some((candidate) => candidate.actions.some((action) => action.kind === "deploy"))).toBe(true);
    for (const unit of Object.keys(UNIT_COST)) expect(Reflect.set(UNIT_COST, unit, 0)).toBe(false);
    for (const kind of ACTION_KINDS) {
      if (kind === "classical") continue;
      expect(Reflect.set(SPECIAL_REGISTRY[kind], "gasCost", 0)).toBe(false);
      expect(Reflect.set(SPECIAL_REGISTRY, kind, { gasCost: 0 })).toBe(false);
    }
    expect(requestedSpend(actions)).toEqual(spend);
    const after = compose(o);
    expect(after).toEqual(before);
    checkBatch(after);
  });

  it("exports exactly V1/V2 composition and V1 decoding at runtime and preserves the 65-action codec ceiling", () => {
    expect(Object.keys(publicApi).sort()).toEqual(["composeCandidatesFromHistoryV2", "composeCandidatesFromObservationV1", "decodeCandidate"]);
    expect(MAX_QUEUE_ACTIONS).toBe(65);
    const o = observation();
    const wire = encodeCandidate(o, Array.from({ length: 65 }, () => c("a1", "a2")));
    const decoded = decodeCandidate(JSON.stringify(wire), "w");
    expect(decoded.actions).toHaveLength(65);
    expect(decoded.key).toBe(wire.key);
    expect(() => decodeCandidate(wire, "b")).toThrow();
    expect(() => decodeCandidate({ ...wire, key: "[]" }, "w")).toThrow("DERIVED");
    expect(() => encodeCandidate(o, Array.from({ length: 66 }, () => c("a1", "a2")))).toThrow();
    expect(compose(o).candidates.every((candidate) => candidate.actions.length <= 4)).toBe(true);
    let getterReads = 0;
    const withGetter = { ...wire };
    Object.defineProperty(withGetter, "actions", { enumerable: true, get: () => { getterReads++; return []; } });
    expect(() => decodeCandidate(withGetter, "w")).toThrow();
    expect(getterReads).toBe(0);
    const sparse = { ...wire, actions: [...wire.actions] };
    delete sparse.actions[0];
    expect(() => decodeCandidate(sparse, "w")).toThrow();
    expect(() => decodeCandidate({ ...wire, [Symbol("extra")]: 1 }, "w")).toThrow();
  });

  it("validates before traversal, detaches and recursively freezes without mutating input", () => {
    const o = observation();
    const before = JSON.stringify(o);
    const batch = compose(o);
    expect(JSON.stringify(o)).toBe(before);
    expect(Object.isFrozen(o)).toBe(false);
    const recursivelyFrozen = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      expect(Object.getPrototypeOf(value)).toBe(Array.isArray(value) ? Array.prototype : Object.prototype);
      expect(Object.isFrozen(value)).toBe(true);
      for (const child of Object.values(value)) recursivelyFrozen(child);
    };
    recursivelyFrozen(batch);
    const saved = JSON.stringify(batch);
    o.own.pieces[0]!.piece.type = "q";
    o.own.minerals = 0;
    expect(JSON.stringify(batch)).toBe(saved);
  });

  it("rejects getters without executing them, symbols, sparse arrays, cycles, and malformed budgets", () => {
    let reads = 0;
    for (const mutate of [
      (o: AuthorizedObservationV1) => Object.defineProperty(o.own, "gas", { enumerable: true, get: () => { reads++; throw Error("getter ran"); } }),
      (o: AuthorizedObservationV1) => Object.defineProperty(o.cells[0]!, "piece", { enumerable: true, get: () => { reads++; throw Error("getter ran"); } }),
      (o: AuthorizedObservationV1) => Object.defineProperty(o, Symbol("hidden"), { value: 1, enumerable: true }),
      (o: AuthorizedObservationV1) => { delete o.cells[1]; },
      (o: AuthorizedObservationV1) => { (o.memory as unknown[]).push(o); },
      (o: AuthorizedObservationV1) => { o.own.minerals = 13; },
      (o: AuthorizedObservationV1) => { o.own.gas = 4; },
      (o: AuthorizedObservationV1) => { o.own.gas = NaN; },
      (o: AuthorizedObservationV1) => { o.side = "x" as "w"; },
      (o: AuthorizedObservationV1) => { o.version = "v2" as typeof o.version; },
      (o: AuthorizedObservationV1) => { (o.own.mines as unknown[]).push("a1", "a2", "a3", "a4"); },
      (o: AuthorizedObservationV1) => { (o.cells as unknown[]).push(o.cells[0]); },
    ]) {
      const o = observation();
      mutate(o);
      expect(() => compose(o)).toThrow();
    }
    expect(reads).toBe(0);
  });

  it("uses standard UTF-8 SHA256 vectors and exact bytes under digest collisions", () => {
    const text = new TextEncoder();
    const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    expect(hex(sha256(text.encode("")))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(hex(sha256(text.encode("abc")))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    const colliding = new KeyIndex(() => new Uint8Array(32));
    const a = colliding.bytes("[a]");
    const b = colliding.bytes("[b]");
    colliding.add(a);
    expect(colliding.has(a)).toBe(true);
    expect(colliding.has(b)).toBe(false);
    colliding.add(b);
    expect(colliding.has(b)).toBe(true);
    const o = allActors();
    expect(composeWithRuntime(o, () => new Uint8Array(32)).batch).toEqual(compose(o));
  });
  it("matches independent SHA-256 across Unicode, binary padding boundaries, and offset views", () => {
    const vectors = [new TextEncoder().encode("♟️\u0000棋🚀é")];
    for (const length of [0, 1, 31, 55, 56, 63, 64, 65, 127, 128, 129, 255, 1024]) {
      const backing = Uint8Array.from({ length: length + 11 }, (_, i) => (i * 73 + 251) & 255);
      vectors.push(backing.subarray(7, 7 + length));
    }
    for (const bytes of vectors) {
      const input = bytes.slice();
      const expected = createHash("sha256").update(bytes).digest();
      const actual = sha256(bytes);
      expect(actual).toHaveLength(32);
      expect(Buffer.from(actual).equals(expected)).toBe(true);
      expect(Buffer.from(bytes).equals(Buffer.from(input))).toBe(true);
    }
  });

  it.each(["w", "b"] as const)("keeps full batches and diagnostics identical across equal observations of different hidden worlds, %s", (side) => {
    const ownSquare = side === "w" ? "a1" : "h8";
    const enemySquare = side === "w" ? "h8" : "a1";
    const hiddenSquare = side === "w" ? "g7" : "b2";
    const enemyColor = side === "w" ? "b" : "w";
    const worldA: ScFenSnapshot = {
      placement: mapToPlacement(new Map<Square, ScPiece>([[ownSquare, { type: "k", color: side }], [enemySquare, { type: "k", color: enemyColor }]])),
      turn: 21, phase: "P", ccLives: { w: 3, b: 3 }, gas: { w: 3, b: 3 }, gasIncome: { w: 3, b: 3 },
      mines: [], queue: { actions: [] },
    };
    const worldB: ScFenSnapshot = { ...worldA, mines: [{ at: hiddenSquare, color: enemyColor }],
      placement: mapToPlacement(new Map<Square, ScPiece>([[ownSquare, { type: "k", color: side }], [enemySquare, { type: "k", color: enemyColor }], [hiddenSquare, { type: "r", color: enemyColor }]])),
      gas: { ...worldA.gas, [enemyColor]: 0 },
      queue: { actions: [{ ...c(enemySquare, hiddenSquare, enemyColor), seq: 0 }] },
    };
    const project = (world: ScFenSnapshot) => {
      const lit = getSideVision(world.placement, side, { mines: world.mines }).litSquares;
      expect(lit.has(hiddenSquare)).toBe(false);
      expect(lit.has(enemySquare)).toBe(false);
      return validateObservationV1(observation([[ownSquare, "k"]], { side, unknown: squares.filter((sq) => !lit.has(sq)) }));
    };
    expect(worldB).not.toEqual(worldA);
    const first = project(worldA);
    const second = project(worldB);
    expect(first).toEqual(second);
    const batch = compose(first);
    expect(compose(second)).toEqual(batch);
    expect(compose(JSON.parse(JSON.stringify(first)))).toEqual(batch);
  });

  it("keeps hidden enemy mines out of proposals while a test-only full-board native probe can reject the same intent", () => {
    const o = observation([["h8", "k"], ["a1", "n"]], { enemy: [["h1", "k"]] });
    const full: ScFenSnapshot = {
      placement: "7K/8/8/8/8/8/8/N6k", turn: 21, phase: "P", ccLives: { w: 3, b: 3 },
      gas: { w: 3, b: 3 }, gasIncome: { w: 3, b: 3 }, queue: { actions: [] }, mines: [],
    };
    const mine = s("spiderMine", "a1");
    expect(() => addScAction({ snapshot: full, action: mine })).not.toThrow();
    expect(() => addScAction({ snapshot: { ...full, mines: [{ at: "a1", color: "b" }] }, action: mine })).toThrow("mine already on square");
    const encoded = encodeCandidate(o, [mine]);
    expect(compose(o).candidates.some((candidate) => candidate.key === encoded.key)).toBe(true);
    expect(compose(JSON.parse(JSON.stringify(o)))).toEqual(compose(o));
  });
});

describe("bounded work, memory, and funding", () => {
  it.each(ACTION_KINDS)("retains actual public membership for %s in an authorized fixture", (kind) => {
    const types = { classical: "k", deploy: "k", stimStep: "p", spiderMine: "n", charonMissiles: "b", siegeMode: "r", tacticalJump: "q" } as const;
    for (const side of ["w", "b"] as const) {
      const o = observation(types[kind] === "k" ? [["h4", "k"]] : [["h4", "k"], [side === "w" ? "a2" : "a7", types[kind]]], { side });
      const batch = compose(o);
      checkBatch(batch);
      const actions = batch.candidates.flatMap((candidate) => candidate.actions).filter((a) => a.kind === kind);
      expect(actions.length).toBeGreaterThan(0);
      if (kind !== "classical") expect(actions.some((a) => a.timing === "B")).toBe(true);
    }
  });

  it.each(["w", "b"] as const)("distinguishes structural-promotion codec representability from bounded omissions, %s", (side) => {
    const from: Square = side === "w" ? "e6" : "e3";
    const to: Square = side === "w" ? "e7" : "e2";
    const batch = compose(observation([["h4", "k"], [from, "p"]], { side, unknown: [to] }));
    const matching = batch.candidates.filter((candidate) => candidate.actions.length === 2 &&
      candidate.actions[0]?.kind === "stimStep" && candidate.actions[0].timing === "B" &&
      candidate.actions[0].from === from && candidate.actions[1]?.kind === "classical" &&
      candidate.actions[1].from === from && candidate.actions[1].to === to);
    expect(batch.diagnostics.stopReason).toBe("attempt-cap");
    expect(matching).toEqual([]);
    for (const promotion of ["p", "n", "b", "r", "q"] as const) {
      const candidate = encodeCandidate(observation([["h4", "k"], [from, "p"]], { side, unknown: [to] }),
        [s("stimStep", from, to, "B", side), { ...c(from, to, side), promotion }]);
      expect(decodeCandidate(candidate, side)).toEqual(candidate);
      expect(batch.candidates.some((entry) => entry.key === candidate.key)).toBe(false);
    }
    const laterB = encodeCandidate(observation([["h4", "k"], [from, "p"]], { side, unknown: [to] }),
      [c(from, to, side), s("stimStep", from, to, "B", side)]);
    expect(laterB.actions[0]!.promotion).toBeUndefined();
    expect(batch.candidates.some((candidate) => candidate.key === laterB.key)).toBe(false);
  });

  it.each(["w", "b"] as const)("counts every repeated lane attempt and bounds nodes/cursors with no false exhaustion, %s", (side) => {
    const { batch, runtime } = composeWithRuntime(allActors(side));
    checkBatch(batch);
    expect(batch.diagnostics.attemptedExtensions).toBe(2048);
    expect(batch.diagnostics.activeFamilies).toEqual(ACTION_KINDS);
    expect(batch.diagnostics.pools.map((p) => p.initialCapacity)).toEqual([48, 48, 48, 48, 48, 48, 48, 175]);
    expect(batch.diagnostics.exhaustedLanes).toEqual([]);
    expect(batch.diagnostics.pools.map((p) => p.finalCapacity)).toEqual(batch.diagnostics.pools.map((p) => p.initialCapacity));
    expect(runtime.roots).toBe(8);
    expect(runtime.availabilityPulls).toBeGreaterThanOrEqual(7);
    expect(runtime.appendAttempts).toBe(2048);
    expect(runtime.continuationNodes).toBeLessThanOrEqual(2048);
    expect(runtime.peakLiveNodes).toBeLessThanOrEqual(8 + runtime.continuationNodes);
    expect(runtime.domainCursors).toBe(8 + runtime.continuationNodes);
    expect(runtime.cursorPulls).toBeGreaterThanOrEqual(runtime.appendAttempts);
    expect(runtime.cursorPulls).toBeLessThanOrEqual(runtime.appendAttempts + runtime.domainCursors);
    expect(runtime.maximumQueueLength).toBeLessThanOrEqual(4);
    expect(batch.diagnostics.ownerSkipped).toBeGreaterThan(0);
    expect(batch.diagnostics.quotaSkipped).toBeGreaterThan(0);
    for (const candidate of batch.candidates) {
      expect(candidate.ownSpend.minerals).toBeLessThanOrEqual(12);
      expect(candidate.ownSpend.gas).toBeLessThanOrEqual(3);
    }
  });

  it("retains valid continuations after owner/duplicate/quota skips and keeps semantic owners distinct from funding", () => {
    const o = observation([["h8", "k"], ["a1", "n"], ["b1", "r"], ["c2", "p"]]);
    const { batch, runtime } = composeWithRuntime(o);
    checkBatch(batch);
    const d = batch.diagnostics;
    expect(runtime.continuationNodes).toBeGreaterThan(d.retainedNonPass);
    expect(d.ownerSkipped).toBeGreaterThan(0);
    expect(d.duplicates).toBeGreaterThan(0);
    expect(d.quotaSkipped).toBeGreaterThan(0);
    expect(d.pools[7]!.retained).toBeGreaterThan(0);
    expect(d.retainedByOwner.classical).toBeGreaterThan(d.pools[0]!.retained);
  });

  it("measures dense authorized capped work and publishes runtime counters within the 10-second planning deadline", () => {
    const fixtures = {
      emptyBudget: observation([["a1", "k"]], { gas: 0, minerals: 0 }),
      tinyBudget: observation([["a1", "k"]], { gas: 1, minerals: 1 }),
      allFamilies: allActors(),
      mineComposition: observation([["h8", "k"], ["a1", "n"], ["b1", "n"], ["c1", "n"]], { minerals: 0, enemy: [["g7", "k"]] }),
      dense: observation(squares.filter((square) => square !== "h8").map((square, i) =>
        [square, i === 0 ? "k" : ["p", "n", "b", "r", "q"][i % 5] as ScPiece["type"]]), { unknown: ["h8"] }),
    };
    for (const [name, o] of Object.entries(fixtures)) {
      const started = performance.now();
      const { batch, runtime } = composeWithRuntime(o);
      const elapsedMs = performance.now() - started;
      checkBatch(batch);
      expect(elapsedMs).toBeLessThan(10_000);
      expect(runtime.peakLiveNodes).toBeLessThanOrEqual(2056);
      expect(runtime.appendAttempts).toBe(batch.diagnostics.attemptedExtensions);
      if (name === "mineComposition") expect(runtime.maximumQueueLength).toBe(4);
      console.info("Executor, candidate runtime", JSON.stringify({ fixture: name, candidates: batch.candidates.length,
        elapsedMs: Math.round(elapsedMs * 100) / 100, stopReason: batch.diagnostics.stopReason, ...runtime }));
    }
  });
});
