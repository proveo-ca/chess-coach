// SPEC: _spec/checkpoint-runtime.puml
import { expect, test } from "bun:test";
import { initialTrainingState, nextAttempt, checkTrainingState } from "../src/curriculum";
import { bindings, byteRef } from "./training-fixture";

test("frozen 1000-slot curriculum uses 500 corpus and alternating 250/250 live seats without cap extension", () => {
  let state = initialTrainingState(101, "a".repeat(64), bindings());
  const corpus: number[] = [], seats = { w: 0, b: 0 };
  for (let i = 0; i < 1000; i++) {
    const next = nextAttempt(state, `synthetic-${i}`), schedule = next.descriptor.schedule;
    expect(next.descriptor.startedOrdinal).toBe(i);
    if (schedule.kind === "corpus") { expect(i % 2).toBe(0); corpus.push(schedule.corpusIndex); }
    else { expect(i % 2).toBe(1); seats[schedule.candidateSide]++; }
    state = next.consumed;
    state.counters.verifiedCompleted++;
    state.historyRefs.push(byteRef(String(i)));
  }
  expect(corpus).toHaveLength(500);
  expect(seats).toEqual({ w: 250, b: 250 });
  expect(new Set(corpus.slice(0, 18)).size).toBe(18);
  expect(new Set(corpus.slice(18, 36)).size).toBe(18);
  expect(state.rng.selection.drawCount).toBe(17 * 28);
  expect(state.rng["policy-sampling"].drawCount).toBe(0);
  expect(() => nextAttempt(state, "slot-1001")).toThrow("CAP");
}, 15_000);

test("curriculum rejects forged roots, shuffle order, pending starts and caller mutation", () => {
  const initial = initialTrainingState(101, "a".repeat(64), bindings()), first = nextAttempt(initial, "first");
  expect(initial.counters.started).toBe(0);
  expect(() => nextAttempt(first.consumed, "second")).toThrow("PENDING");
  const reordered = structuredClone(first.consumed);
  reordered.control.corpusPermutation.reverse();
  expect(() => checkTrainingState(reordered)).toThrow("PERMUTATION");
  const substituted = structuredClone(initial);
  substituted.rng.opponent.root ^= 1; substituted.rng.opponent.state = substituted.rng.opponent.root;
  expect(() => checkTrainingState(substituted)).toThrow("ROOT");
});
