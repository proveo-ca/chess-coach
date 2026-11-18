// SPEC: _spec/causal-journal.puml, _spec/engine-consolidation.puml
import { expect, test } from "bun:test";
import { addScAction, beginScTurn, createCanonicalGame, endScTurn, mapToPlacement, placementToMap } from "@chess-coach/starchess-core/engine";
import { CausalJournal } from "@chess-coach/starchess-core/engine/causal-events";
import { beginWithJournal, endWithJournal, seedCausalState } from "@chess-coach/starchess-core/causal-producer";
import { applyPathRevealAttack } from "@chess-coach/starchess-core/engine/classical-resolution";
import { pathRevealStepsKernel } from "@chess-coach/starchess-core/engine/vision";
import type { ScActionInput, ScFenSnapshot, ScPiece, Square } from "@chess-coach/starchess-core/engine";

function board(pieces: readonly (readonly [Square, ScPiece["type"], "w" | "b"])[]): ScFenSnapshot {
  return { placement: mapToPlacement(new Map(pieces.map(([at, type, color]) => [at, { type, color }]))), turn: 21, phase: "P",
    ccLives: { w: 3, b: 3 }, gas: { w: 3, b: 3 }, gasIncome: { w: 3, b: 3 }, stored: { w: 12, b: 12 }, queue: { actions: [] } };
}
function run(snapshot: ScFenSnapshot, actions: readonly ScActionInput[]) {
  const opening = structuredClone(snapshot), state = seedCausalState(snapshot), before = structuredClone(state);
  const began = beginWithJournal(snapshot, state);
  expect(began.result).toEqual(beginScTurn(snapshot));
  let queued = began.result.next;
  for (const action of actions) queued = addScAction({ snapshot: queued, action }).snapshot;
  const result = endWithJournal(queued, began.state, { skipTurnStartChecks: true });
  expect(result.result).toEqual(endScTurn(queued, { skipTurnStartChecks: true }));
  expect(snapshot).toEqual(opening);
  expect(state).toEqual(before);
  return { ...result, initial: state, began };
}

test("journaled init/open/pass retains private identities and returns detached successors", () => {
  const initial = createCanonicalGame().snapshot, state = seedCausalState(initial);
  const began = beginWithJournal(initial, state), ended = endWithJournal(began.result.next, began.state, { skipTurnStartChecks: true });
  expect(began.journal.events).toEqual([]);
  expect(ended.journal.events).toEqual([]);
  expect(ended.state.entities).toEqual(state.entities);
  expect(ended.state.callOrdinal).toBe(2);
  expect(ended.state.turn).toBe(1);
  ended.journal.finalCells.w[0] = { square: "a1", visibility: "lit", piece: null };
  expect(began.journal.finalCells.w).not.toEqual(ended.journal.finalCells.w);
});

test("birth, immediate mine death and native mine multiplicity retain distinct actual identities", () => {
  const snapshot = board([["a1", "k", "w"], ["h8", "k", "b"], ["b2", "n", "b"]]);
  snapshot.mines = [{ color: "b", at: "b2" }, { color: "w", at: "b2" }];
  const result = run(snapshot, [{ kind: "deploy", timing: "B", color: "w", from: "a1", to: "b2", unit: "p" }]);
  const effects = result.journal.events.filter(event => event.kind !== "visibility");
  expect(effects.map(event => event.kind)).toEqual(["unit-destroyed", "unit-created", "deployment-resolved", "unit-destroyed", "mine-removed", "mine-removed"]);
  const birth = effects[1]!, blast = effects[3]!;
  expect(birth.kind === "unit-created" && blast.kind === "unit-destroyed" && birth.entity.id === blast.entity.id).toBe(true);
  expect(new Set(effects.flatMap(event => event.kind === "mine-removed" ? [event.entity.id] : [])).size).toBe(2);
  expect(result.state.mineOrder).toEqual([]);
  expect(result.state.entities.filter(entity => entity.kind === "unit" && entity.square === "b2")).toEqual([]);
});

test("promotion preserves the Marine identity through B and C transformations", () => {
  const snapshot = board([["a1", "k", "w"], ["h8", "k", "b"], ["e7", "p", "w"]]);
  const result = run(snapshot, [{ kind: "classical", timing: "C", color: "w", from: "e7", to: "e8", promotion: "q" }]);
  const initial = result.initial.entities.find(entity => entity.square === "e7")!;
  expect(result.state.entities.find(entity => entity.id === initial.id)).toMatchObject({ square: "e8", type: "q" });
  expect(result.journal.events.filter(event => event.kind === "unit-transformed")).toEqual([
    expect.objectContaining({ entityId: initial.id, fromType: "p", toType: "q", actionSeq: 0 }),
  ]);
});

test("mutual casualties share the same live preimage and both recipients retain their witnesses", () => {
  const result = run(board([["a1", "k", "w"], ["e2", "p", "w"], ["d3", "p", "b"], ["h8", "k", "b"]]), [
    { kind: "classical", timing: "C", color: "w", from: "e2", to: "d3" },
    { kind: "classical", timing: "C", color: "b", from: "d3", to: "e2" },
  ]);
  const losses = result.journal.events.filter(event => event.kind === "unit-destroyed");
  expect(losses).toHaveLength(2);
  expect(losses[0]!.group).toBe(losses[1]!.group);
  expect(losses.map(event => event.visibleTo)).toEqual([["w", "b"], ["w", "b"]]);
});

test("starting snapshot checks reject substituted placement, ordered mines, native siege and turn", () => {
  const initial = board([["a1", "k", "w"], ["h8", "k", "b"], ["e7", "p", "w"]]);
  initial.mines = [{ color: "w", at: "d4" }, { color: "b", at: "d4" }];
  const state = seedCausalState(initial);
  expect(() => beginWithJournal({ ...initial, placement: createCanonicalGame().snapshot.placement }, state)).toThrow("FINAL_WORLD");
  expect(() => beginWithJournal({ ...initial, mines: [...initial.mines!].reverse() }, state)).toThrow("FINAL_MINES");
  expect(() => beginWithJournal({ ...initial, siegedTanks: ["d4"] }, state)).toThrow("SNAPSHOT_NATIVE_MODES");
  expect(() => beginWithJournal({ ...initial, turn: 22 }, state)).toThrow("SNAPSHOT_TURN");
});

test("failed, nested and out-of-group mutations cannot publish a successor", () => {
  const initial = createCanonicalGame().snapshot, state = seedCausalState(initial);
  const collector = new CausalJournal(state), pieces = placementToMap(initial.placement);
  collector.bindBoard(pieces);
  expect(() => collector.move(pieces.get("a2")!, "a2", "a3", null)).toThrow("OUTSIDE_GROUP");
  expect(() => collector.finish(initial)).toThrow("CLOSED");
  const nested = new CausalJournal(state);
  expect(() => nested.group("B", () => nested.group("B", () => {}))).toThrow("NESTED_GROUP");
  expect(() => nested.finish(initial)).toThrow("CLOSED");
  const failed = new CausalJournal(state);
  expect(() => failed.group("B", () => { throw new Error("synthetic failure"); })).toThrow("synthetic failure");
  expect(() => failed.finish(initial)).toThrow("CLOSED");
});

test("collector rejects final drift and cannot be reused after successful completion", () => {
  const initial = createCanonicalGame().snapshot, state = seedCausalState(initial), collector = new CausalJournal(state);
  expect(() => collector.finish({ ...initial, ccLives: { w: 2, b: 3 } })).toThrow("FINAL_WORLD");
  expect(() => collector.finish(initial)).toThrow("CLOSED");
  const complete = new CausalJournal(state);
  complete.finish(initial);
  expect(() => complete.capture()).toThrow("CLOSED");
  expect(() => complete.finish(initial)).toThrow("CLOSED");
});

test("successful native guard retains evaluation and applied target identities without imposing equality", () => {
  const initial = board([["a1", "r", "w"], ["e1", "k", "w"], ["a6", "p", "b"], ["b7", "k", "b"]]);
  const collector = new CausalJournal(seedCausalState(initial), [
    { kind: "classical", timing: "C", color: "w", from: "a1", to: "a8", seq: 0 },
    { kind: "deploy", timing: "B", color: "b", from: "b7", to: "a6", unit: "p", seq: 1 },
  ]);
  const pieces = placementToMap(initial.placement);
  collector.bindBoard(pieces);
  const tap = collector.discovery({ actionSeq: 0, side: "w", site: "scan-ray", base: collector.capture(), from: "a1", to: "a8", target: "a6",
    modeSource: "default-tank", siegedSquares: [], mineInputProvided: false, mines: [] });
  const steps = pathRevealStepsKernel(initial.placement, "a1", "a8", "w", "a6", undefined, tap)!;
  collector.deferred(tap.ordinal);
  collector.group("B", () => {
    collector.destroy(pieces.get("a6")!, 1);
    const id = collector.create({ type: "p", color: "b" }, "a6", 1);
    collector.disposition(1, id);
  });
  const applied = applyPathRevealAttack({ placement: initial.placement, ccLives: initial.ccLives, mines: [] },
    { kind: "capture", piece: "r", color: "w", from: "a3", to: "a6", victim: { piece: "p", color: "b" },
      occupies: true, pathRevealFrom: "a1", pathRevealSteps: steps }, collector, 0, tap.ordinal);
  expect(applied.fired).toBe(true);
  const { journal } = collector.finish({ ...initial, placement: applied.placement });
  const query = journal.discoveries[0]!;
  expect(query.evaluationTargetId).not.toBe(query.applied!.targetId);
  const loss = journal.events.filter(event => event.kind === "unit-destroyed").find(event => event.targets.length)!;
  expect(loss.targets[0]).toMatchObject({ evaluationTargetId: query.evaluationTargetId, appliedTargetId: query.applied!.targetId,
    square: "a6", piece: { type: "p", color: "b" } });
});

function stationaryShot() {
  const initial = board([["a1", "r", "w"], ["h1", "k", "w"], ["a2", "k", "b"]]);
  const collector = new CausalJournal(seedCausalState(initial), [
    { kind: "classical", timing: "C", color: "w", from: "a1", to: "a8", seq: 0 },
    { kind: "classical", timing: "C", color: "b", from: "a2", to: "b2", seq: 1 },
    { kind: "deploy", timing: "B", color: "w", from: "h1", to: "a1", unit: "r", seq: 2 },
  ]);
  const pieces = placementToMap(initial.placement);
  collector.bindBoard(pieces);
  const actor = pieces.get("a1")!, target = pieces.get("a2")!;
  const query = collector.discovery({ actionSeq: 0, side: "w", site: "scan-ray", base: collector.capture(),
    from: "a1", to: "a8", target: "a2", modeSource: "default-tank", siegedSquares: [], mineInputProvided: false, mines: [] });
  query.step("a2", true);
  query.returned(1);
  collector.deferred(query.ordinal);
  return { initial, collector, pieces, actor, target, query };
}

test("stationary CC-shot consumption needs a group-bound no-op move and cannot repeat", () => {
  const unbound = stationaryShot();
  const damage = unbound.collector.group("C-path", () => unbound.collector.damage("b", 2, 0));
  expect(() => unbound.collector.consume(unbound.query.ordinal, damage, unbound.actor, unbound.target, "cc-shot")).toThrow("CONSUMED_OPERATION");
  const bound = stationaryShot();
  const span = bound.collector.group("C-path", () => {
    bound.collector.move(bound.actor, "a1", "a1", 0);
    bound.collector.damage("b", 2, 0);
  });
  bound.collector.consume(bound.query.ordinal, span, bound.actor, bound.target, "cc-shot");
  expect(() => bound.collector.consume(bound.query.ordinal, span, bound.actor, bound.target, "cc-shot")).toThrow("NATIVE_CONSUMPTION");
});

test("stationary CC-shot consumption rejects wrong actor origins and substituted actors", () => {
  const moved = stationaryShot();
  moved.collector.group("C-move", () => moved.collector.move(moved.actor, "a1", "b1", 0));
  const wrongOrigin = moved.collector.group("C-path", () => {
    moved.collector.move(moved.actor, "b1", "b1", 0);
    moved.collector.damage("b", 2, 0);
  });
  expect(() => moved.collector.consume(moved.query.ordinal, wrongOrigin, moved.actor, moved.target, "cc-shot")).toThrow("CONSUMED_OPERATION");
  const replaced = stationaryShot(), replacement: ScPiece = { type: "r", color: "w" };
  replaced.collector.group("B", () => {
    replaced.collector.destroy(replaced.actor, 2);
    const id = replaced.collector.create(replacement, "a1", 2);
    replaced.collector.disposition(2, id);
  });
  const substituted = replaced.collector.group("C-path", () => {
    replaced.collector.move(replacement, "a1", "a1", 0);
    replaced.collector.damage("b", 2, 0);
  });
  expect(() => replaced.collector.consume(replaced.query.ordinal, substituted, replacement, replaced.target, "cc-shot")).toThrow("CONSUMED_OPERATION");
});

test("stationary CC-shot consumption retains damage sequence, target and movement guards", () => {
  const wrongSeq = stationaryShot();
  const span = wrongSeq.collector.group("C-path", () => {
    wrongSeq.collector.move(wrongSeq.actor, "a1", "a1", 1);
    wrongSeq.collector.damage("b", 2, 0);
  });
  expect(() => wrongSeq.collector.consume(wrongSeq.query.ordinal, span, wrongSeq.actor, wrongSeq.target, "cc-shot")).toThrow("CONSUMED_OPERATION");
  const wrongTarget = stationaryShot();
  wrongTarget.collector.group("C-move", () => wrongTarget.collector.move(wrongTarget.target, "a2", "b2", 1));
  const retargeted = wrongTarget.collector.group("C-path", () => {
    wrongTarget.collector.move(wrongTarget.actor, "a1", "a1", 0);
    wrongTarget.collector.damage("b", 2, 0);
  });
  expect(() => wrongTarget.collector.consume(wrongTarget.query.ordinal, retargeted, wrongTarget.actor, wrongTarget.target, "cc-shot")).toThrow("CONSUMED_TARGET");
  const conflicting = stationaryShot();
  const displaced = conflicting.collector.group("C-path", () => {
    conflicting.collector.move(conflicting.actor, "a1", "a1", 0);
    conflicting.collector.move(conflicting.actor, "a1", "b1", 0);
    conflicting.collector.move(conflicting.actor, "b1", "a1", 0);
    conflicting.collector.move(conflicting.actor, "a1", "a1", 0);
    conflicting.collector.damage("b", 2, 0);
  });
  const damageOnly = { group: displaced!.group, effectOrdinals: displaced!.effectOrdinals.filter(ordinal =>
    ordinal === displaced!.effectOrdinals[displaced!.effectOrdinals.length - 1]) };
  expect(() => conflicting.collector.consume(conflicting.query.ordinal, damageOnly, conflicting.actor, conflicting.target, "cc-shot")).toThrow("CONSUMED_OPERATION");
});

test("capture consumption still requires actual movement even with a no-op move proof", () => {
  const initial = board([["a1", "r", "w"], ["h1", "k", "w"], ["a2", "p", "b"], ["h8", "k", "b"]]);
  const collector = new CausalJournal(seedCausalState(initial), [{ kind: "classical", timing: "C", color: "w", from: "a1", to: "a8", seq: 0 }]);
  const pieces = placementToMap(initial.placement), actor = pieces.get("a1")!, target = pieces.get("a2")!;
  collector.bindBoard(pieces);
  const query = collector.discovery({ actionSeq: 0, side: "w", site: "scan-ray", base: collector.capture(),
    from: "a1", to: "a8", target: "a2", modeSource: "default-tank", siegedSquares: [], mineInputProvided: false, mines: [] });
  query.step("a2", true);
  query.returned(1);
  collector.deferred(query.ordinal);
  const span = collector.group("C-path", () => {
    collector.move(actor, "a1", "a1", 0);
    collector.destroy(target, 0);
  });
  expect(() => collector.consume(query.ordinal, span, actor, target, "capture")).toThrow("CONSUMED_OPERATION");
});
