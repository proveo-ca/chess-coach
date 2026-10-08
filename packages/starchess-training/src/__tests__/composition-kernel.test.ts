// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { describe, expect, it } from "vitest";
import { ACTION_KINDS, encodeCandidate, requestedSpend } from "@chess-coach/starchess-arena/intent-codec-v1";
import type { ScActionInput } from "@chess-coach/starchess-core";
import { composeKernel, type DomainFactory } from "../composition";
import type { CandidateBatchV3, CandidateLane } from "../contracts";
import { appendFailure, appendState, emptyPrefix, planningKnowledge, type PrefixState } from "../domain";
import { c, observation, s, squares } from "./fixtures";

const own = [["a1", "k"], ["d4", "q"]] as const;
const o = observation(own.map(([square, type]) => [square, type]), {
  minerals: 0, gas: 3, unknown: squares.filter((square) => !own.some(([from]) => from === square)),
});
const knowledge = planningKnowledge(o);
const classical = squares.filter((to) => {
  const dx = Math.abs(to.charCodeAt(0) - "d".charCodeAt(0));
  const dy = Math.abs(Number(to[1]) - 4);
  return to !== "d4" && to !== "a1" && (dx === 0 || dy === 0 || dx === dy);
}).map((to) => c("d4", to));
const king = [c("a1", "a2"), c("a1", "b1"), c("a1", "b2")];
const jumps = squares.filter((to) => to !== "a1" && to !== "d4").map((to) => s("tacticalJump", "d4", to));
const validTails = (state: PrefixState): ScActionInput[] => {
  if (state.actions.length !== 1) return [];
  const first = state.actions[0]!;
  return first.kind === "classical" ? jumps : [...classical, ...king].filter((action) =>
    action.to !== first.to || action.from === first.from);
};

type Cursor = {
  lane: CandidateLane | undefined; depth: number; pulls: number; yields: number; done: boolean; returned: boolean;
};
const instrument = (select: (state: PrefixState, lane: CandidateLane) => readonly ScActionInput[]) => {
  const cursors: Cursor[] = [];
  const visits: { lane: CandidateLane; prefix: readonly ScActionInput[]; action: ScActionInput }[] = [];
  const domain: DomainFactory = (k, state, family, lane) => {
    expect(k).toEqual(knowledge);
    expect(state.anchors).toEqual(state.actions.map((action) => action.from));
    expect(state.mineAnchors).toEqual([]);
    const record: Cursor = { lane, depth: state.actions.length, pulls: 0, yields: 0, done: false, returned: false };
    cursors.push(record);
    const actions = family ? family === "classical" ? classical : family === "tacticalJump" ? jumps : []
      : select(state, lane!);
    const cursor = (function* (): Generator<ScActionInput> {
      for (const action of actions) {
        if (lane) visits.push({ lane, prefix: state.actions, action });
        yield action;
      }
    })();
    const next = cursor.next.bind(cursor);
    const close = cursor.return.bind(cursor);
    cursor.next = (...args) => {
      record.pulls++;
      const result = next(...args);
      if (result.done) record.done = true;
      else record.yields++;
      return result;
    };
    cursor.return = (value) => {
      record.returned = true;
      record.done = true;
      return close(value);
    };
    return cursor;
  };
  return { domain, cursors, visits };
};

const sum = (values: Readonly<Record<string, number>>) => Object.values(values).reduce((a, b) => a + b, 0);
const check = (batch: CandidateBatchV3, fixture: ReturnType<typeof instrument>) => {
  const d = batch.diagnostics;
  expect(Object.keys(d).sort()).toEqual([
    "profile", "attemptedExtensions", "uniqueIncludingPass", "retainedNonPass", "duplicates", "ownerSkipped", "quotaSkipped",
    "pruned", "activeFamilies", "exhaustedLanes", "pools", "retainedByOwner", "retainedByLength",
    "attemptCapReached", "capacityCapReached", "stopReason",
  ].sort());
  expect(d.activeFamilies).toEqual(["classical", "tacticalJump"]);
  expect(d.pruned).toEqual({ actor: 0, shape: 0, timing: 0, resources: 0, mineCap: 0, ownOccupancy: 0 });
  expect(d.attemptedExtensions).toBe(d.retainedNonPass + d.duplicates + d.ownerSkipped + d.quotaSkipped + sum(d.pruned));
  expect(d.attemptedExtensions).toBeLessThanOrEqual(2048);
  expect(fixture.visits).toHaveLength(d.attemptedExtensions);
  expect(d.uniqueIncludingPass).toBe(512);
  expect(batch.candidates).toHaveLength(512);
  expect(batch.candidates.filter((candidate) => candidate.actions.length === 0)).toEqual([encodeCandidate(o, [])]);
  expect(d.retainedNonPass).toBe(511);
  expect(sum(d.retainedByOwner)).toBe(511);
  expect(sum(d.retainedByLength)).toBe(511);
  expect(d.pools.map((pool) => pool.id)).toEqual([...ACTION_KINDS, "shared-composition"]);
  expect(d.pools.reduce((n, pool) => n + pool.retained, 0)).toBe(511);
  expect(d.pools.reduce((n, pool) => n + pool.initialCapacity, 0)).toBe(511);
  expect(d.pools.reduce((n, pool) => n + pool.finalCapacity, 0)).toBe(511);
  expect(d.exhaustedLanes).toEqual(d.pools.filter((pool) => pool.exhausted).map((pool) => pool.id));
  for (const pool of d.pools) expect(pool.retained).toBe(pool.finalCapacity);
  const keys = batch.candidates.map((candidate) => candidate.key);
  expect(keys).toEqual([...keys].sort());
  expect(new Set(keys).size).toBe(512);
  const byOwner = Object.fromEntries(ACTION_KINDS.map((kind) => [kind,
    batch.candidates.filter((candidate) => candidate.actions[0]?.kind === kind).length]));
  expect(d.retainedByOwner).toEqual(byOwner);
  expect(d.retainedByLength).toEqual(Object.fromEntries([1, 2, 3, 4].map((length) => [String(length),
    batch.candidates.filter((candidate) => candidate.actions.length === length).length])));
  for (const candidate of batch.candidates) {
    expect(candidate.ownSpend).toEqual(requestedSpend(candidate.actions));
    expect(candidate.ownSpend.minerals).toBe(0);
    expect(candidate.ownSpend.gas).toBeLessThanOrEqual(3);
    expect(candidate.actions.length).toBeLessThanOrEqual(4);
    let state = emptyPrefix();
    for (const action of candidate.actions) {
      expect(appendFailure(o, knowledge, state, action)).toBeNull();
      state = appendState(knowledge, state, action);
    }
  }
  for (const visit of fixture.visits) {
    const state = visit.prefix.reduce((prefix, action) => appendState(knowledge, prefix, action), emptyPrefix());
    expect(appendFailure(o, knowledge, state, visit.action)).toBeNull();
  }
  const frozen = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    expect(Object.isFrozen(value)).toBe(true);
    for (const child of Object.values(value)) frozen(child);
  };
  frozen(batch);
  expect(fixture.cursors.every((cursor) => cursor.done)).toBe(true);
  expect(fixture.cursors.filter((cursor) => cursor.lane && cursor.depth === 0)).toHaveLength(8);
  expect(fixture.cursors.filter((cursor) => cursor.lane && cursor.depth === 0).every((cursor) => cursor.done)).toBe(true);
  expect(fixture.cursors.some((cursor) => cursor.depth > 0 && cursor.returned)).toBe(true);
};

describe("private kernel policy with finite independent C/B-jump subsets", () => {
  it("fills all three funding pools and stops at exactly 512 identities before the attempt cap", () => {
    const fixture = instrument((state, lane) => {
      if (!["classical", "tacticalJump", "shared-composition"].includes(lane)) return [];
      if (state.actions.length) return validTails(state);
      return lane === "classical" ? classical : lane === "tacticalJump" ? jumps.slice(10) : jumps.slice(0, 10);
    });
    const { batch, runtime } = composeKernel(o, fixture.domain);
    check(batch, fixture);
    expect(batch.diagnostics.stopReason).toBe("capacity-cap");
    expect(batch.diagnostics.capacityCapReached).toBe(true);
    expect(batch.diagnostics.attemptCapReached).toBe(false);
    expect(batch.diagnostics.attemptedExtensions).toBeLessThan(2048);
    expect(batch.diagnostics.pools.map((pool) => pool.retained)).toEqual([168, 0, 0, 0, 0, 0, 168, 175]);
    expect(batch.diagnostics.retainedByOwner).toMatchObject({ classical: 168, tacticalJump: 343 });
    expect(runtime.appendAttempts).toBe(fixture.visits.length);
    expect(runtime.cursorPulls).toBe(fixture.cursors.filter((cursor) => cursor.lane).reduce((n, cursor) => n + cursor.pulls, 0));
    expect(runtime.availabilityPulls).toBe(fixture.cursors.filter((cursor) => !cursor.lane).reduce((n, cursor) => n + cursor.pulls, 0));
    expect(runtime.domainCursors).toBe(fixture.cursors.filter((cursor) => cursor.lane).length);
    expect(runtime.continuationNodes).toBe(fixture.visits.length);
    expect(runtime.domainCursors).toBe(8 + runtime.continuationNodes);
    expect(runtime.cursorPulls).toBeGreaterThanOrEqual(runtime.appendAttempts);
    expect(runtime.cursorPulls).toBeLessThanOrEqual(runtime.appendAttempts + runtime.domainCursors);
    expect(runtime.availabilityPulls).toBe(7);
    expect(runtime.maximumQueueLength).toBe(2);
    expect(fixture.visits.slice(0, 6)).toEqual([
      { lane: "classical", prefix: [], action: classical[0] },
      { lane: "tacticalJump", prefix: [], action: jumps[10] },
      { lane: "shared-composition", prefix: [], action: jumps[0] },
      { lane: "classical", prefix: [classical[0]], action: jumps[0] },
      { lane: "tacticalJump", prefix: [jumps[10]], action: validTails({ actions: [jumps[10]!], anchors: ["d4"], mineAnchors: [] })[0] },
      { lane: "shared-composition", prefix: [jumps[0]], action: classical[0] },
    ]);
    for (const [lane, roots] of [["classical", classical], ["tacticalJump", jumps.slice(10)],
      ["shared-composition", jumps.slice(0, 10)]] as const) {
      const tails = fixture.visits.filter((visit) => visit.lane === lane && visit.prefix.length === 1);
      const expected = roots.flatMap((action) => validTails({ actions: [action], anchors: [action.from], mineAnchors: [] })
        .map((tail) => ({ lane, prefix: [action], action: tail })));
      expect(tails).toEqual(expected.slice(0, tails.length));
    }
    console.info("Executor, synthetic kernel capacity", JSON.stringify({ attemptedExtensions: batch.diagnostics.attemptedExtensions,
      uniqueIncludingPass: batch.diagnostics.uniqueIncludingPass, pools: batch.diagnostics.pools.map((pool) => pool.retained) }));
  });

  it("redistributes early proven shared exhaustion in ordered rounds only to live families", () => {
    const fixture = instrument((state, lane) => {
      if (lane !== "classical" && lane !== "tacticalJump") return [];
      return state.actions.length ? validTails(state) : lane === "classical" ? classical : jumps;
    });
    const { batch } = composeKernel(o, fixture.domain);
    check(batch, fixture);
    expect(batch.diagnostics.stopReason).toBe("capacity-cap");
    expect(batch.diagnostics.pools.map((pool) => pool.initialCapacity)).toEqual([168, 0, 0, 0, 0, 0, 168, 175]);
    expect(batch.diagnostics.pools.map((pool) => pool.finalCapacity)).toEqual([256, 0, 0, 0, 0, 0, 255, 0]);
    expect(batch.diagnostics.exhaustedLanes).toEqual([...ACTION_KINDS.slice(1, 6), "shared-composition"]);
    expect(batch.diagnostics.retainedByOwner).toMatchObject({ classical: 256, tacticalJump: 255 });
    expect(fixture.cursors.find((cursor) => cursor.lane === "shared-composition")).toMatchObject({ depth: 0, pulls: 1, yields: 0, done: true });
  });

  it("routes a later exhausted family's unused capacity through exhausted shared to the remaining family", () => {
    const fixture = instrument((state, lane) => {
      if (lane === "classical") return state.actions.length ? [] : king;
      if (lane !== "tacticalJump") return [];
      return state.actions.length ? validTails(state) : jumps;
    });
    const { batch } = composeKernel(o, fixture.domain);
    check(batch, fixture);
    expect(batch.diagnostics.stopReason).toBe("capacity-cap");
    expect(batch.diagnostics.pools.map((pool) => pool.finalCapacity)).toEqual([3, 0, 0, 0, 0, 0, 508, 0]);
    expect(batch.diagnostics.exhaustedLanes).toEqual([...ACTION_KINDS.slice(0, 6), "shared-composition"]);
    expect(batch.diagnostics.retainedByOwner).toMatchObject({ classical: 3, tacticalJump: 508 });
    expect(fixture.cursors.filter((cursor) => cursor.lane === "classical").every((cursor) => cursor.done && !cursor.returned)).toBe(true);
  });

  it("gives capacity precedence when both fixed caps coincide and never consumes attempt 2049", () => {
    const fixture = instrument((state, lane) => {
      if (lane !== "classical") return [];
      if (!state.actions.length) return classical;
      const tails = validTails(state);
      return state.actions.length === 1 && state.actions[0]!.to === classical[0]!.to
        ? [...Array.from({ length: 1537 }, () => tails[0]!), ...tails] : tails;
    });
    const { batch, runtime } = composeKernel(o, fixture.domain);
    check(batch, fixture);
    expect(batch.diagnostics).toMatchObject({ attemptedExtensions: 2048, duplicates: 1537,
      ownerSkipped: 0, quotaSkipped: 0, capacityCapReached: true, attemptCapReached: true, stopReason: "capacity-cap" });
    expect(batch.diagnostics.pools.map((pool) => pool.finalCapacity)).toEqual([511, 0, 0, 0, 0, 0, 0, 0]);
    expect(batch.diagnostics.retainedByOwner.classical).toBe(511);
    expect(runtime.appendAttempts).toBe(2048);
    expect(fixture.visits).toHaveLength(2048);
  });

  it("closes a suspended root and depth cursors at the attempt cap without pulling action 2049", () => {
    const fixture = instrument((state, lane) => lane === "classical" && !state.actions.length
      ? Array.from({ length: 2049 }, () => classical[0]!) : []);
    const { batch, runtime } = composeKernel(o, fixture.domain);
    expect(batch.candidates.map((candidate) => candidate.key).sort()).toEqual([
      encodeCandidate(o, []).key, encodeCandidate(o, [classical[0]!]).key,
    ].sort());
    expect(batch.diagnostics).toMatchObject({ attemptedExtensions: 2048, uniqueIncludingPass: 2, retainedNonPass: 1,
      duplicates: 2047, ownerSkipped: 0, quotaSkipped: 0, capacityCapReached: false,
      attemptCapReached: true, stopReason: "attempt-cap", retainedByLength: { "1": 1, "2": 0, "3": 0, "4": 0 } });
    expect(fixture.visits).toHaveLength(2048);
    expect(fixture.cursors.find((cursor) => cursor.lane === "classical" && cursor.depth === 0))
      .toMatchObject({ pulls: 2048, yields: 2048, done: true, returned: true });
    expect(fixture.cursors.some((cursor) => cursor.depth === 1 && cursor.returned)).toBe(true);
    expect(fixture.cursors.every((cursor) => cursor.done)).toBe(true);
    expect(runtime.appendAttempts).toBe(2048);
    expect(runtime.availabilityPulls).toBe(7);
    expect(runtime.cursorPulls).toBe(fixture.cursors.filter((cursor) => cursor.lane).reduce((n, cursor) => n + cursor.pulls, 0));
    expect(runtime.domainCursors).toBe(2056);
  });
});
