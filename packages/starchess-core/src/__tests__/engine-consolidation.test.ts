// SPEC: _spec/engine-consolidation.puml
import { describe, expect, it } from "vitest";
import * as product from "../index";
import * as native from "../engine";
import { beginWithJournal, endWithJournal, seedCausalState } from "../engine/causal-producer";
import { CausalJournal } from "../engine/causal-events";
import { resolveTurnKernel } from "../resolve/resolve-turn";
import type { ScActionInput, ScFenSnapshot } from "../engine";

const snapshot = (placement: string): ScFenSnapshot => ({ placement, turn: 21, phase: "P", ccLives: { w: 3, b: 3 },
  gas: { w: 3, b: 3 }, gasIncome: { w: 3, b: 3 }, stored: { w: 12, b: 12 }, queue: { actions: [] } });

describe("canonical product mutation kernel", () => {
  it("accepts readonly unsequenced planning inputs in both siege helpers", () => {
    const actions: readonly ScActionInput[] = [{ timing: "B", kind: "siegeMode", color: "w", from: "a1" }];
    expect(product.isTankSiegedAfterB("a1", [], actions)).toBe(true);
    expect(product.tankModeAfterB("a1", [], actions)).toBe("siege");
    expect(product.isTankSiegedAfterB("a1", ["a1"], actions)).toBe(false);
    expect(product.tankModeAfterB("a1", ["a1"], actions)).toBe("tank");
  });

  it("shares public primitives and error identities while retaining explicit admission facades", () => {
    for (const name of ["beginScTurn", "refillTurnGas", "rewriteClassicalAfterB", "applyPendingCCShots", "applyPathRevealAttack",
      "applyPathRevealCCShot", "isScMoveShape", "scMovesFrom", "placementToMap", "getSideVision", "queueGasSpent",
      "assertQueueShape", "ScValidateError", "AddScActionError", "RemoveScActionError"] as const) {
      expect(native[name]).toBe(product[name]);
    }
    expect(native.endScTurn).not.toBe(product.endScTurn);
    expect(native.resolveTurn).not.toBe(product.resolveTurn);
    expect(native.addScAction).not.toBe(product.addScAction);
    const base = snapshot("7k/8/8/8/8/4P3/8/K7");
    const action: ScActionInput = { timing: "C", kind: "classical", color: "w", from: "e3", to: "e5" };
    const permissive = product.addScAction({ snapshot: base, action }).snapshot;
    expect(() => product.endScTurn(permissive)).not.toThrow();
    expect(() => native.addScAction({ snapshot: base, action })).toThrow(product.AddScActionError);
    expect(() => native.endScTurn(permissive)).toThrow(native.ScValidateError);
    expect(() => endWithJournal(permissive, seedCausalState(base))).toThrow(native.ScValidateError);
  });

  it("keeps complete nonempty multi-turn results identical with and without mutation effects", () => {
    let base = native.createCanonicalGame().snapshot;
    let state = seedCausalState(base);
    const turns: ScActionInput[][] = [
      [{ timing: "B", kind: "stimStep", color: "w", from: "c2", to: "c3" },
        { timing: "C", kind: "classical", color: "w", from: "c2", to: "c4" },
        { timing: "B", kind: "stimStep", color: "b", from: "f7", to: "f6" },
        { timing: "C", kind: "classical", color: "b", from: "f7", to: "f5" }],
      [{ timing: "C", kind: "classical", color: "w", from: "d2", to: "d4" },
        { timing: "C", kind: "classical", color: "b", from: "e7", to: "e5" }],
      [{ timing: "C", kind: "classical", color: "w", from: "f2", to: "f3" },
        { timing: "C", kind: "classical", color: "b", from: "c7", to: "c6" }],
    ];
    for (const actions of turns) {
      const opened = beginWithJournal(base, state);
      expect(opened.result).toEqual(product.beginScTurn(base));
      expect(opened.result).toEqual(native.beginScTurn(base));
      let queued = opened.result.next;
      for (const action of actions) {
        const appended = native.addScAction({ snapshot: queued, action });
        expect(appended).toEqual(product.addScAction({ snapshot: queued, action }));
        queued = appended.snapshot;
      }
      const recorded = endWithJournal(queued, opened.state, { skipTurnStartChecks: true });
      expect(recorded.result).toEqual(product.endScTurn(queued, { skipTurnStartChecks: true }));
      expect(recorded.result).toEqual(native.endScTurn(queued, { skipTurnStartChecks: true }));
      expect(recorded.result.queue).toHaveLength(actions.length);
      expect(recorded.result.events.length).toBeGreaterThan(0);
      expect(recorded.journal.events.some(event => event.kind === "unit-moved")).toBe(true);
      expect(Object.keys(recorded.result).sort()).toEqual(["resolved", "next", "ignoreAttacksOn", "events", "siegedThisTurn", "afterB", "afterPending", "bMoves", "fMoves", "queue"].sort());
      base = recorded.result.next;
      state = recorded.state;
    }
    expect(state.callOrdinal).toBe(6);
    expect(state.unitCounter).toBe(10);
  });

  it("does not promote an enemy replacement that crushed a held last-rank Marine", () => {
    const base = snapshot("8/4Pk2/8/8/8/8/8/K7");
    const actions: ScActionInput[] = [
      { timing: "B", kind: "stimStep", color: "w", from: "e7", to: "e8", promotion: "q" },
      { timing: "C", kind: "classical", color: "w", from: "e7", to: "e8", promotion: "n" },
      { timing: "B", kind: "deploy", color: "b", from: "f7", to: "e8", unit: "r" },
    ];
    let queued = base;
    for (const action of actions) queued = product.addScAction({ snapshot: queued, action }).snapshot;
    const result = product.endScTurn(queued);
    expect(result).toEqual(native.endScTurn(queued));
    const recorded = endWithJournal(queued, seedCausalState(base));
    expect(recorded.result).toEqual(result);
    expect(product.placementToMap(result.next.placement).get("e8")).toEqual({ type: "r", color: "b" });
    expect(result.resolved.promotions).toEqual([]);
    expect(recorded.journal.events.some(event => event.kind === "unit-transformed")).toBe(false);
    expect(result.events.find(event => event.kind === "deploy")?.victim).toEqual({ type: "p", color: "w" });
  });

  it("synchronizes consumed mines across delayed-swap afterMove, afterAll and journal state", () => {
    const base = { ...snapshot("7k/8/8/3n4/8/2N5/8/K7"), mines: [{ color: "b", at: "d5" }, { color: "w", at: "c3" }] } satisfies ScFenSnapshot;
    const actions = [{ timing: "C", kind: "classical", color: "w", from: "c3", to: "d5", seq: 0 },
      { timing: "C", kind: "classical", color: "b", from: "d5", to: "c3", seq: 1 }] as const;
    const input = { placement: base.placement, ccLives: base.ccLives, mines: base.mines,
      white: { color: "w", from: "c3", to: "d5" }, black: { color: "b", from: "d5", to: "c3" }, isTargetVisible: () => false } as const;
    const result = product.resolveTurn(input);
    expect(result).toEqual(native.resolveTurn(input));
    const collector = new CausalJournal(seedCausalState(base), actions);
    expect(resolveTurnKernel(input, collector, { w: 0, b: 1 })).toEqual(result);
    const recorded = collector.finish({ ...base, ...result.afterAll });
    expect(result.mineTriggers).toHaveLength(2);
    expect(result.afterMove.mines).toEqual([]);
    expect(result.afterAll.mines).toEqual([]);
    expect(recorded.state.mineOrder).toEqual([]);
    expect(recorded.journal.events.filter(event => event.kind === "mine-removed")).toHaveLength(2);
  });

  it("requires the actual transferred Marine identity for the native double-step exception", () => {
    const classical = { timing: "C", kind: "classical", color: "w", from: "e2", to: "e4", seq: 1 } as const;
    const actions = [{ timing: "B", kind: "stimStep", color: "w", from: "e2", to: "e3", seq: 0 }, classical] as const;
    const actor = { type: "p", color: "w", id: "original" } as const;
    const transfer = { actor, from: "e2", to: "e3" } as const;
    expect(native.matchedMarineDouble(actions, classical, { from: "e3", to: "e5" }, actor, transfer)).toBe(true);
    expect(native.matchedMarineDouble(actions, classical, { from: "e3", to: "e5" }, { ...actor, id: "replacement" }, transfer)).toBe(false);
    expect(native.matchedMarineDouble(actions, classical, { from: "e3", to: "e5" }, actor, undefined)).toBe(false);
  });

  it("consumes stationary path CC-shot groups with full result parity and no invented movement", () => {
    const base = snapshot("8/8/8/8/8/8/k7/R6K");
    const action = { timing: "C", kind: "classical", color: "w", from: "a1", to: "a8", seq: 0 } as const;
    const input = { placement: base.placement, ccLives: base.ccLives, white: action, black: null, isTargetVisible: () => false };
    const result = product.resolveTurn(input);
    expect(native.resolveTurn(input)).toEqual(result);
    const initial = seedCausalState(base);
    const collector = new CausalJournal(initial, [action]);
    expect(resolveTurnKernel(input, collector, { w: 0, b: null })).toEqual(result);
    const recorded = collector.finish({ ...base, ...result.afterAll });
    expect(result.afterAll.placement).toBe("R7/8/8/8/8/8/k7/7K");
    expect(result.afterAll.ccLives).toEqual({ w: 3, b: 2 });
    expect(result.moves).toEqual([{ piece: "r", color: "w", from: "a1", to: "a8" }]);
    expect(result.pathRevealAttacks).toEqual([expect.objectContaining({ kind: "ccShot", to: "a2", target: "b", livesAfter: 2,
      pathRevealFrom: "a1", stopAt: "a1" })]);
    const actor = initial.entities.find(entity => entity.square === "a1")!;
    const target = initial.entities.find(entity => entity.square === "a2")!;
    const query = recorded.journal.discoveries[0]!;
    expect(query).toMatchObject({ deferred: true, returnedStep: 1, evaluationActorId: actor.id, evaluationTargetId: target.id,
      applied: { operation: "cc-shot", actorId: actor.id, targetId: target.id } });
    expect(recorded.journal.events.filter(event => event.group === query.applied!.group)).toEqual([expect.objectContaining({ kind: "cc-damaged", phase: "C-path", side: "b",
      before: 3, after: 2, actionSeq: 0, group: query.applied!.group,
      targets: [{ discoveryOrdinal: query.ordinal, recipient: "w", square: "a2", piece: { type: "k", color: "b" },
        evaluationActorId: actor.id, evaluationTargetId: target.id, appliedActorId: actor.id, appliedTargetId: target.id }] })]);
    expect(recorded.journal.events.filter(event => event.kind === "unit-moved")).toEqual([
      expect.objectContaining({ phase: "C-move", entityId: actor.id, from: "a1", to: "a8", actionSeq: 0 }),
    ]);
    expect(recorded.state.entities).toEqual(initial.entities.map(entity => entity.id === actor.id ? { ...entity, square: "a8" } : entity));
    expect(recorded.state.unitCounter).toBe(initial.unitCounter);
    expect(recorded.state.ccLives).toEqual(result.afterAll.ccLives);
  });

  it("preserves SCFEN, coordinate SAN, AI, replay and historical packed-result APIs", () => {
    const base = native.createCanonicalGame().snapshot;
    expect(product.parseScFen(product.formatScFen(base))).toMatchObject(base);
    const queued = product.addScMoveSan(base, "c2c3", "w");
    const result = product.endScTurn(queued);
    const historical = structuredClone(result);
    historical.next.placement = "7k/8/8/8/8/8/8/KQ6";
    const packed = product.packResolves([], [historical]);
    expect(packed).not.toBeNull();
    expect(product.unpackResolves([], packed!)).toEqual([historical]);
    expect(product.resolvesOf({ scfens: [], packed: packed! })).toEqual([historical]);
    expect(product.scsanOf([result])[0]).toContain("c2c3");
    for (const name of ["adjutant", "strategicAdjutant", "replayScFenHistory", "recordFromRun", "packRecord"] as const) expect(typeof product[name]).toBe("function");
  });
});
