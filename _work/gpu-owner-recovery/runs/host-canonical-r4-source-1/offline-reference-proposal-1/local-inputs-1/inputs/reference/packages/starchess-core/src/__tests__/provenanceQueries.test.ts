// SPEC: _spec/packages/starchess-core/resolve-turn-activity.puml, _spec/packages/starchess-core/ray-scan.puml
import { describe, expect, it } from "vitest";
import {
  addScAction, beginScTurn, beginTurnWithProvenance, endScTurn, endTurnWithProvenance,
  initializeProvenance, parseScFen, type ScActionInput,
} from "../index";
import { pathRevealSteps, pathRevealStepsKernel } from "../board/vision";

function run(placement: string, actions: ScActionInput[], extras = "", turn = 0) {
  const tier = turn <= 10 ? 1 : turn <= 20 ? 2 : 3;
  const initial = parseScFen(`SCFEN|${placement}|${turn}|33|P|G:${tier}${tier}:${tier}${tier}|Q:w:;b:${extras}`);
  const began = beginTurnWithProvenance({ snapshot: initial, provenance: initializeProvenance(initial) });
  expect(began.nativeResult).toStrictEqual(beginScTurn(initial));
  let snapshot = began.nativeResult.next;
  for (const action of actions) snapshot = addScAction({ snapshot, action }).snapshot;
  const ordinals = { w: 0, b: 0 };
  const ended = endTurnWithProvenance({ snapshot, provenance: began.provenance, actionBindings: (snapshot.queue?.actions ?? []).map(a => ({ sourceActionSeq: a.seq, side: a.color, actionRef: { planningOrdinal: 0, acceptedActionOrdinal: ordinals[a.color]++ } })) });
  expect(ended.nativeResult).toStrictEqual(endScTurn(snapshot, { skipTurnStartChecks: true }));
  return ended;
}

describe("resolver-owned path queries and consumed targets", () => {
  const move: ScActionInput = { kind: "classical", timing: "C", color: "w", from: "a1", to: "a8" };
  it("captures the exact scan prefix without cursor images or incidental observations", () => {
    const ended = run("4k3/8/p7/8/8/8/8/R3K3", [move]);
    expect(ended.provenance.lastCall.queries).toHaveLength(1);
    const query = ended.provenance.lastCall.queries[0]!;
    expect(query).toMatchObject({ sourceActionSeq: 0, site: "scan-ray", from: "a1", to: "a8", side: "w", target: "a6", returnedStep: 3, consumption: "applied-consumed", visionInputs: { modeSource: "native-sieged-set", siegeMaskHex: "0000000000000000", mineSource: "provided", mines: [] } });
    expect(query.evaluatedSteps).toStrictEqual([{ mid: "a2", visible: false }, { mid: "a3", visible: false }, { mid: "a4", visible: true }]);
    expect(ended.frames).toHaveLength(1);
    expect(ended.visibilityImages).toHaveLength(2);
    expect(ended.visibilityCheckpoints.map(c => c.point)).toStrictEqual(["before-frame", "after-frame"]);
    expect(ended.provenance.lastCall.consumedFacts).toStrictEqual([{
      queryOrdinal: 0, sourceActionSeq: 0, side: "w", operation: "capture", frameKey: "engine:call:2:frame:0", causalBeforeVisibilityKey: "engine:call:2:image:0",
      evaluationActorId: "engine:unit:1", evaluationTargetId: "engine:unit:2", appliedActorId: "engine:unit:1", appliedTargetId: "engine:unit:2", turn: 0,
      targetCell: { square: "a6", visibility: "lit", piece: { type: "p", color: "b" } },
    }]);
    expect(ended.frames[0]?.effects.map(e => e.kind)).toStrictEqual(["unit-move", "unit-destroy"]);
    expect(ended.nativeResult.resolved.afterMove.placement).toBe("4k3/8/p7/8/8/8/8/R3K3");
    expect(ended.nativeResult.resolved.afterAll.placement).toBe("4k3/8/R7/8/8/8/8/4K3");
  });

  it("carries the reveal-to branch for a destination capture", () => {
    const ended = run("4k3/8/p7/8/8/8/8/R3K3", [{ ...move, to: "a6" }]);
    expect(ended.provenance.lastCall.queries[0]).toMatchObject({ site: "reveal-to", target: "a6", consumption: "applied-consumed", returnedStep: 3 });
    expect(ended.provenance.lastCall.consumedFacts[0]?.targetCell).toStrictEqual({ square: "a6", visibility: "lit", piece: { type: "p", color: "b" } });
  });

  it("binds the CC-destination blocker operand rather than the authored destination", () => {
    const ended = run("k7/8/p7/8/8/8/8/R3K3", [move]);
    expect(ended.provenance.lastCall.queries[0]).toMatchObject({ site: "reveal-to", target: "a6", from: "a1", to: "a8" });
    expect(ended.provenance.lastCall.consumedFacts[0]).toMatchObject({ operation: "capture", targetCell: { square: "a6", piece: { type: "p", color: "b" } } });
    expect(ended.nativeResult.next.ccLives).toStrictEqual({ w: 3, b: 3 });
  });

  it("records CC damage at actual application and keeps its fact after the approach mine", () => {
    const ended = run("8/8/k7/8/8/8/8/R3K3", [move], "|M:w:;b:a5");
    expect(ended.provenance.lastCall.consumedFacts).toHaveLength(1);
    expect(ended.provenance.lastCall.consumedFacts[0]).toMatchObject({ operation: "cc-shot", targetCell: { square: "a6", visibility: "lit", piece: { type: "k", color: "b" } }, frameKey: "engine:call:2:frame:0" });
    expect(ended.frames.map(f => f.effects.map(e => e.kind))).toStrictEqual([["unit-move", "cc-lives-change"], ["mine-remove", "unit-destroy"]]);
    expect(ended.frames[1]?.before.entities).toContainEqual({ id: "engine:unit:1", kind: "unit", side: "w", type: "r", square: "a5", tankMode: "tank" });
    expect(ended.nativeResult.next.ccLives).toStrictEqual({ w: 3, b: 2 });
    expect(ended.provenance.lastCall.queries[0]?.visionInputs.mines).toStrictEqual([{ color: "b", at: "a5" }]);
  });

  it("keeps a positive unconsumed probe private", () => {
    const ended = run("4k3/8/8/8/8/p7/8/R3K3", [move]);
    expect(ended.provenance.lastCall.queries[0]).toMatchObject({ target: "a3", returnedStep: 1, evaluatedSteps: [{ mid: "a2", visible: true }], consumption: "not-deferred" });
    expect(ended.provenance.lastCall.consumedFacts).toStrictEqual([]);
    expect(ended.frames.map(f => f.phase)).toStrictEqual(["C-attack", "C-move"]);
  });

  it("does not grant a fact when a selected approach fails its actual victim guard", () => {
    const ended = run("4k3/8/p7/8/8/8/8/R3K3", [move, { kind: "classical", timing: "C", color: "b", from: "a6", to: "a5" }]);
    expect(ended.provenance.lastCall.queries[0]).toMatchObject({ consumption: "deferred-skipped", returnedStep: 3 });
    expect(ended.provenance.lastCall.consumedFacts).toStrictEqual([]);
    expect(ended.nativeResult.resolved.pathRevealAttacks).toStrictEqual([]);
    expect(ended.frames.map(f => f.phase)).toStrictEqual(["C-move", "C-move"]);
  });

  it("captures native set memberships on empty squares and respects a sieged skip", () => {
    const ended = run("4k3/8/8/p7/8/8/8/R3K3", [move], "|S:a1b2");
    const query = ended.provenance.lastCall.queries[0]!;
    expect(query.visionInputs.siegeMaskHex).toBe("8040000000000000");
    expect(query.consumption).toBe("not-deferred");
    expect(ended.provenance.lastCall.consumedFacts).toStrictEqual([]);
  });

  it("does not add tank-mode callbacks or helper evaluations", () => {
    const placement = "4k3/8/p7/8/8/8/8/R3K3";
    let nativeCount = 0; let tracedCount = 0;
    const expected = pathRevealSteps(placement, "a1", "a8", "w", "a6", { tankModeFor: () => { nativeCount++; return "tank"; } });
    const evaluated: { mid: string; visible: boolean }[] = [];
    let returned: number | null | undefined;
    const actual = pathRevealStepsKernel(placement, "a1", "a8", "w", "a6", { tankModeFor: () => { tracedCount++; return "tank"; } }, { step: (mid, visible) => evaluated.push({ mid, visible }), returned: value => { returned = value; } });
    expect(actual).toBe(expected);
    expect(returned).toBe(3);
    expect(nativeCount).toBe(3);
    expect(tracedCount).toBe(nativeCount);
    expect(evaluated).toStrictEqual([{ mid: "a2", visible: false }, { mid: "a3", visible: false }, { mid: "a4", visible: true }]);
  });

  it("keeps an unselected positive scan distinct from the selected destination query", () => {
    const ended = run("8/p7/8/k7/8/8/8/R3K3", [{ ...move, to: "a7" }]);
    expect(ended.provenance.lastCall.queries.map(q => [q.site, q.target, q.returnedStep, q.consumption])).toStrictEqual([
      ["scan-ray", "a5", 2, "not-deferred"], ["reveal-to", "a7", 4, "applied-consumed"],
    ]);
    expect(ended.provenance.lastCall.consumedFacts).toHaveLength(1);
    expect(ended.provenance.lastCall.consumedFacts[0]).toMatchObject({ queryOrdinal: 1, operation: "capture", targetCell: { square: "a7", piece: { type: "p", color: "b" } } });
    expect(ended.frames).toHaveLength(1);
    expect(ended.visibilityImages).toHaveLength(2);
  });

  it("orders two consumed facts by actual native application", () => {
    const ended = run("4k2r/8/p7/8/8/7P/8/R3K3", [move, { kind: "classical", timing: "C", color: "b", from: "h8", to: "h1" }]);
    expect(ended.provenance.lastCall.consumedFacts.map(p => [p.side, p.targetCell.square, p.queryOrdinal, p.frameKey])).toStrictEqual([
      ["w", "a6", 0, "engine:call:2:frame:0"], ["b", "h3", 1, "engine:call:2:frame:1"],
    ]);
    expect(ended.provenance.lastCall.queries.map(q => q.consumption)).toStrictEqual(["applied-consumed", "applied-consumed"]);
    expect(ended.visibilityImages).toHaveLength(4);
  });
});
