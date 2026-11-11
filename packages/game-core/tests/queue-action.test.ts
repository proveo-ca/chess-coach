// SPEC: _spec/turn-planning.puml
import { describe, expect, test } from "bun:test";
import { addScAction, assertBaselineFen, assertQueueGas, queueGasSpent, removeScAction } from "../src";
import type { ScAction, ScActionInput, ScFenSnapshot, Square } from "../src";

const snapshot = (placement = "4k3/8/8/8/8/8/3P4/RNBQK3", turn = 21): ScFenSnapshot => ({
  placement, turn, ccLives: { w: 3, b: 3 }, phase: "P", gas: { w: 3, b: 3 }, gasIncome: { w: 3, b: 3 }, queue: { actions: [] },
});
const classical = (from: Square, to: Square): ScActionInput => ({ timing: "C", kind: "classical", color: "w", from, to });
const step: ScActionInput = { timing: "B", kind: "stimStep", color: "w", from: "d2", to: "d3" };
const code = (run: () => unknown) => { try { run(); return null; } catch (error) { return (error as { code: string }).code; } };

describe("canonical authoritative queue edits", () => {
  test("charges each side independently, keeps C free and never mutates its source", () => {
    const initial = snapshot("3qk3/8/8/8/8/8/3P4/2B1K3");
    const before = structuredClone(initial);
    let next = addScAction({ snapshot: initial, action: step }).snapshot;
    next = addScAction({ snapshot: next, action: classical("d2", "d4") }).snapshot;
    next = addScAction({ snapshot: next, action: { timing: "F", kind: "tacticalJump", color: "b", from: "d8", to: "a5" } }).snapshot;
    expect(initial).toEqual(before);
    expect(next.gas).toEqual({ w: 2, b: 0 });
    expect(next.queue?.actions.map(action => action.seq)).toEqual([0, 1, 2]);
    expect(queueGasSpent(next.queue?.actions)).toEqual({ w: 1, b: 3 });
    expect(() => assertQueueGas(next)).not.toThrow();
  });

  test("rejects insufficient gas, duplicate classicals and repeated special origins", () => {
    const shot: ScActionInput = { kind: "charonMissiles", timing: "B", color: "w", from: "c1", to: "h6" };
    expect(code(() => addScAction({ snapshot: { ...snapshot(), gas: { w: 1, b: 3 } }, action: shot }))).toBe("SC_GAS");
    const first = addScAction({ snapshot: snapshot(), action: classical("d2", "d3") }).snapshot;
    expect(code(() => addScAction({ snapshot: first, action: classical("a1", "a2") }))).toBe("SC_QUEUE_SHAPE");
    const special = addScAction({ snapshot: snapshot(), action: step }).snapshot;
    expect(code(() => addScAction({ snapshot: special, action: { ...step, timing: "F" } }))).toBe("SC_QUEUE_SHAPE");
  });

  test("rejects nonplanning phases, missing removals and invalid CC baselines", () => {
    expect(code(() => addScAction({ snapshot: { ...snapshot(), phase: "O" }, action: step }))).toBe("SC_PHASE");
    expect(code(() => removeScAction({ snapshot: { ...snapshot(), phase: "B" }, seq: 0 }))).toBe("SC_PHASE");
    expect(code(() => removeScAction({ snapshot: snapshot(), seq: 0 }))).toBe("SC_NOT_FOUND");
    expect(code(() => assertBaselineFen(snapshot("8/8")))).toBe("SC_BASELINE_FEN");
    expect(code(() => assertBaselineFen(snapshot("4k3/8/8/8/8/8/8/3KK3")))).toBe("SC_BASELINE_FEN");
  });

  test("refunds removed specials without reindexing or exceeding income", () => {
    let next = addScAction({ snapshot: snapshot(), action: step }).snapshot;
    next = addScAction({ snapshot: next, action: classical("d2", "d4") }).snapshot;
    next = { ...next, specialsUsed: ["d2", "c1"] };
    const before = structuredClone(next);
    const removed = removeScAction({ snapshot: next, seq: 0 });
    expect(removed.snapshot.gas).toEqual({ w: 3, b: 3 });
    expect(removed.snapshot.queue?.actions.map(action => action.seq)).toEqual([1]);
    expect(removed.snapshot.specialsUsed).toEqual(["c1"]);
    expect(next).toEqual(before);
    const capped = removeScAction({ snapshot: { ...next, gas: { w: 3, b: 3 }, specialsUsed: ["d2"] }, seq: 0 }).snapshot;
    expect(capped.gas.w).toBe(3);
    expect(Object.hasOwn(capped, "specialsUsed")).toBe(false);
  });

  test("rejects removal of a birth needed by the remaining classical actor", () => {
    const birth: ScActionInput = { kind: "deploy", timing: "B", color: "w", from: "e1", to: "f2", unit: "n" };
    const first = addScAction({ snapshot: snapshot(), action: birth }).snapshot;
    const second = addScAction({ snapshot: first, action: classical("f2", "g4") }).snapshot;
    const before = structuredClone(second);
    expect(code(() => removeScAction({ snapshot: second, seq: 0 }))).toBe("SC_BASELINE_FEN");
    expect(second).toEqual(before);
  });

  test("does not erase invalid insertion rules with a later replacement or toggle", () => {
    const initial = snapshot("4k3/8/8/8/8/8/3KP3/8");
    expect(code(() => addScAction({ snapshot: initial, action: classical("e2", "f4") }))).toBe("SC_BASELINE_FEN");
    const first = addScAction({ snapshot: initial, action: classical("e2", "e3") }).snapshot;
    const before = structuredClone(first);
    const replacement: ScActionInput = { kind: "deploy", timing: "B", color: "w", from: "d2", to: "e2", unit: "n" };
    expect(code(() => addScAction({ snapshot: first, action: replacement }))).toBe("SC_BASELINE_FEN");
    expect(first).toEqual(before);
  });

  test("validates special geometry, promotion, mine state and siege dependencies", () => {
    const initial = snapshot();
    expect(code(() => addScAction({ snapshot: initial, action: { ...step, to: "d4" } }))).toBe("SC_SPECIAL");
    expect(code(() => addScAction({ snapshot: initial, action: { kind: "tacticalJump", timing: "B", color: "w", from: "d1", to: "a1" } }))).toBe("SC_SPECIAL");
    expect(code(() => addScAction({ snapshot: { ...initial, mines: [{ at: "b1", color: "b" }] }, action: { kind: "spiderMine", timing: "B", color: "w", from: "b1" } }))).toBe("SC_SPECIAL");
    expect(code(() => addScAction({ snapshot: snapshot("4k3/3P4/8/8/8/8/8/4K3"), action: { ...step, from: "d7", to: "d8" } }))).toBe("SC_SPECIAL");
    const siege = { ...initial, siegedTanks: ["a1"] as Square[], mines: [{ at: "a3" as const, color: "w" as const }] };
    expect(code(() => addScAction({ snapshot: siege, action: classical("a1", "a3") }))).toBe("SC_SPECIAL");
    const unsieged = addScAction({ snapshot: siege, action: { kind: "siegeMode", timing: "B", color: "w", from: "a1" } }).snapshot;
    expect(code(() => addScAction({ snapshot: unsieged, action: classical("a1", "a3") }))).toBeNull();
  });

  test("gas invariants reject accumulation and overspend independently of edit checks", () => {
    expect(code(() => assertQueueGas({ ...snapshot(), turn: 1 }))).toBe("SC_GAS");
    const costly: ScAction = { kind: "tacticalJump", timing: "B", color: "w", from: "d1", to: "d4", seq: 0 };
    expect(code(() => assertQueueGas({ ...snapshot(), queue: { actions: [costly] } }))).toBe("SC_GAS");
    expect(code(() => assertQueueGas({ ...snapshot(), gas: { w: -1, b: 3 } }))).toBe("SC_GAS");
  });
});
