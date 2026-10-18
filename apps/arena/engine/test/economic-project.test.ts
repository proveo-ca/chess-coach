// SPEC: _spec/apps/arena/burn-compat.puml
import assert from "node:assert/strict";
import test from "node:test";
import {
  addScAction, beginTurnWithProvenance, endTurnWithProvenance, initializeProvenance, mapToPlacement, parseScFen,
  type EngineEntity, type ProvenanceCompanion, type ScPiece, type Square, type TrustedEffectFrame,
} from "@chess-coach/starchess-core";
import { EconomicProjector, projectOwnGeometry } from "../economic-project";
import { EconomicReplay } from "../economic-replay";
import { parseEconomicBoundary, type EconomicBoundary, type EffectFact } from "../economic-wire";
import { EngineErrorV2, type Action, type Pair, type Side } from "../wire-v2";

const facts = (boundary: EconomicBoundary): EffectFact[] => boundary.groups.flatMap(g => g.kind === "effects" ? g.facts : []);
const witnesses = (boundary: EconomicBoundary) => facts(boundary).filter(f => f.kind === "enemy-destruction-witnessed");
function run(raw: string, requests: Pair<Action[]>) {
  const replay = EconomicReplay.fromSnapshotForTest(parseScFen(raw));
  const start = replay.start("tiny-v1");
  const open = replay.open(0);
  if (open.kind !== "planning") throw new Error("Expected planning");
  const paid = replay.settle(open.context, requests);
  const closed = replay.close();
  return { start, open, paid, closed };
}
const rookPath: Action = { kind: "classical", timing: "C", color: "w", from: "a1", to: "a8" };

test("actual consumed rook path authorizes a6 victim and source action, not authored a8 destination", () => {
  const result = run("SCFEN|4k3/8/p7/8/8/8/8/R3K3|0|33|P|G:11:11|B:3:3|Q:w:;b:", { w: [rookPath], b: [] });
  assert.deepEqual(witnesses(result.paid.boundaries.w), [{ kind: "enemy-destruction-witnessed", square: "a6", type: "p", ownActionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 } }]);
  assert.ok(result.paid.boundaries.w.groups.some(g => g.kind === "vision" && g.changes.some(c => c.square === "a6" && c.visibility === "lit" && c.piece?.color === "b")));
  assert.ok(facts(result.paid.boundaries.w).some(f => f.kind === "unit-moved" && f.from === "a1" && f.to === "a6"));
  assert.equal(result.paid.boundaries.w.snapshot.cells.find(c => c.square === "a6")?.visibility, "lit");
  assert.deepEqual(witnesses(result.paid.boundaries.b), []);
});

test("native mutual removal and reciprocal swap preserve whole-group immutable before locators", () => {
  const removal = run("SCFEN|7k/8/8/8/8/3p4/4P3/K7|0|33|P|G:11:11|B:3:3|Q:w:;b:", {
    w: [{ kind: "classical", timing: "C", color: "w", from: "e2", to: "d3" }],
    b: [{ kind: "classical", timing: "C", color: "b", from: "d3", to: "e2" }],
  });
  for (const [side, square] of [["w", "e2"], ["b", "d3"]] as const) {
    assert.ok(facts(removal.paid.boundaries[side]).some(f => f.kind === "unit-destroyed" && f.subject.kind === "before-unit" && f.subject.square === square));
    assert.equal(witnesses(removal.paid.boundaries[side]).length, 1);
  }
  const swap = run("SCFEN|r3k3/8/8/8/8/8/8/R3K3|1|33|P|G:11:11|B:3:3|Q:w:;b:|S:a1a8", {
    w: [rookPath], b: [{ kind: "classical", timing: "C", color: "b", from: "a8", to: "a1" }],
  });
  for (const [side, from, to] of [["w", "a1", "a8"], ["b", "a8", "a1"]] as const) {
    const groups = swap.paid.boundaries[side].groups.filter(g => g.kind === "effects");
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0]!.facts, [{ kind: "unit-moved", subject: { kind: "before-unit", square: from }, from, to }]);
    assert.ok(groups[0]!.beforeOwn.units.some(u => u.square === from && u.mode === "siege"));
    assert.ok(groups[0]!.afterOwn.units.some(u => u.square === to));
    assert.deepEqual(witnesses(swap.paid.boundaries[side]), []);
  }
});

test("same-cell own replacement emits causal retirement and birth without confusing final occupancy", () => {
  const result = run("SCFEN|7k/8/8/8/8/8/4R3/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:", {
    w: [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "e2", unit: "p" }], b: [],
  });
  const group = result.paid.boundaries.w.groups.find(g => g.kind === "effects");
  assert.ok(group && group.kind === "effects");
  assert.ok(group.facts.some(f => f.kind === "unit-destroyed" && f.type === "r" && f.subject.kind === "before-unit" && f.subject.square === "e2"));
  assert.ok(group.facts.some(f => f.kind === "unit-born" && f.type === "p" && f.square === "e2" && f.mode === null));
  assert.deepEqual(group.beforeOwn.units.find(u => u.square === "e2"), { square: "e2", type: "r", mode: "tank" });
  assert.deepEqual(group.afterOwn.units.find(u => u.square === "e2"), { square: "e2", type: "p", mode: null });
});

test("B deployment birth followed by mine death is materialized lineage, never unmaterialized waste", () => {
  const result = run("SCFEN|4k3/8/8/8/8/8/4n3/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:|M:w:;b:e2", {
    w: [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "e2", unit: "p" }], b: [],
  });
  const own = facts(result.paid.boundaries.w);
  assert.equal(own.filter(f => f.kind === "unit-born").length, 1);
  assert.equal(own.filter(f => f.kind === "unit-destroyed").length, 1);
  assert.equal(own.filter(f => f.kind === "deployment-unmaterialized").length, 0);
  assert.equal(result.paid.boundaries.w.snapshot.own.pieces.length, 1);
  assert.ok(facts(result.paid.boundaries.b).some(f => f.kind === "mine-removed" && f.subject.kind === "before-mine" && f.subject.slot === 0));
  assert.deepEqual(witnesses(result.paid.boundaries.b), [{ kind: "enemy-destruction-witnessed", square: "e2", type: "p", ownActionRef: null }]);
});

test("terminal C skips charged F deployment with explicit unmaterialized disposition and one actual grant", () => {
  const result = run("SCFEN|8/8/k7/8/8/8/8/R3K3|21|31|P|G:33:33|B:3:3|Q:w:;b:", {
    w: [rookPath, { kind: "deploy", timing: "F", color: "w", from: "e1", to: "d2", unit: "p" }], b: [],
  });
  assert.ok(result.paid.settlement.outcome);
  assert.deepEqual(facts(result.paid.boundaries.w).filter(f => f.kind === "deployment-unmaterialized"), [{ kind: "deployment-unmaterialized", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 1 } }]);
  assert.ok(!facts(result.paid.boundaries.w).some(f => f.kind === "unit-born"));
  const admitted = result.paid.boundaries.w.groups[0]!;
  assert.ok(admitted.kind === "admission");
  assert.deepEqual(admitted.actions.map(a => [a.minerals, a.gas]), [[0, 0], [1, 1]]);
  assert.equal(result.paid.boundaries.w.grantOrdinal, 1);
  assert.equal(result.paid.settlement.grants.w, 3);
});

test("promotion emits birth, movement and same-entity transformation without a new payment", () => {
  const result = run("SCFEN|k4p2/4PK2/8/8/8/8/8/8|11|33|P|G:22:22|B:3:3|Q:w:;b:", {
    w: [{ kind: "stimStep", timing: "B", color: "w", from: "e7", to: "e8", promotion: "q" },
      { kind: "deploy", timing: "B", color: "w", from: "f7", to: "e8", unit: "p" },
      { kind: "classical", timing: "C", color: "w", from: "e7", to: "f8", promotion: "q" }], b: [],
  });
  const own = facts(result.paid.boundaries.w);
  assert.ok(own.some(f => f.kind === "unit-born" && f.actionRef.acceptedActionOrdinal === 1 && f.mode === null));
  assert.ok(own.some(f => f.kind === "unit-moved" && f.subject.kind === "before-unit" && f.subject.square === "e7"));
  assert.ok(own.some(f => f.kind === "unit-transformed" && f.fromType === "p" && f.toType === "q" && f.toMode === null && f.subject.kind === "before-unit" && f.subject.square === "e8"));
  const admission = result.paid.boundaries.w.groups.find(g => g.kind === "admission");
  assert.ok(admission && admission.kind === "admission");
  assert.deepEqual(admission.actions.map(a => a.minerals), [0, 1, 0]);
  assert.ok(result.paid.boundaries.w.snapshot.own.pieces.some(p => p.square === "e8" && p.type === "q"));
});

test("dead Mecha fire-and-forget source does not authorize a hidden enemy death", () => {
  const result = run("SCFEN|6k1/8/8/3q4/2p5/1B6/8/K7|21|33|P|G:33:33|B:3:3|Q:w:;b:", {
    w: [{ kind: "charonMissiles", timing: "F", color: "w", from: "b3", to: "d5" }],
    b: [{ kind: "classical", timing: "C", color: "b", from: "c4", to: "b3" }],
  });
  assert.ok(facts(result.paid.boundaries.w).some(f => f.kind === "unit-destroyed" && f.type === "b"));
  assert.deepEqual(witnesses(result.paid.boundaries.w), []);
  assert.ok(!result.paid.boundaries.w.snapshot.own.pieces.some(p => p.type === "b"));
});

test("deferred-skipped query authorizes no victim or capture, while real mover checkpoints remain public", () => {
  const result = run("SCFEN|4k3/8/p7/8/8/8/8/R3K3|0|33|P|G:11:11|B:3:3|Q:w:;b:", {
    w: [rookPath], b: [{ kind: "classical", timing: "C", color: "b", from: "a6", to: "a5" }],
  });
  assert.deepEqual(witnesses(result.paid.boundaries.w), []);
  assert.ok(!facts(result.paid.boundaries.w).some(f => f.kind === "unit-destroyed"));
  assert.ok(result.paid.boundaries.w.groups.some(g => g.kind === "vision"));
});

test("hidden-state twins expose byte-identical public facts and contiguous local sequences despite hidden births", () => {
  const base = "SCFEN|7k/8/p7/8/8/8/8/R3K3|21|33|P|G:33:33|B:3:3|Q:w:;b:";
  const first = run(base, { w: [rookPath], b: [] });
  const second = run(base.replace("7k", "5n1k"), { w: [rookPath], b: [{ kind: "deploy", timing: "B", color: "b", from: "h8", to: "g7", unit: "p" }] });
  assert.equal(JSON.stringify(first.start.boundaries.w), JSON.stringify(second.start.boundaries.w));
  assert.equal(JSON.stringify(first.open.boundaries.w), JSON.stringify(second.open.boundaries.w));
  assert.equal(JSON.stringify(first.paid.boundaries.w), JSON.stringify(second.paid.boundaries.w));
  const boundary = second.paid.boundaries.w;
  assert.deepEqual(boundary.groups.map(g => g.seq), boundary.groups.map((_, i) => boundary.seqBefore + i + 1));
  assert.equal(witnesses(boundary).length, 1);
  assert.ok(!/engine:|sourceEffectKey|queryOrdinal|siegeMask|evaluatedSteps|unitCounter|sourceActionSeq/.test(JSON.stringify(boundary)));
});

test("own mine-trigger source attribution follows victim action, not mine ownership", () => {
  const result = run("SCFEN|7k/8/8/8/4p3/8/2N5/K7|21|33|P|G:33:33|B:3:3|Q:w:;b:|M:w:e3;b:", {
    w: [], b: [{ kind: "classical", timing: "C", color: "b", from: "e4", to: "e3" }],
  });
  assert.deepEqual(witnesses(result.paid.boundaries.w), [{ kind: "enemy-destruction-witnessed", square: "e3", type: "p", ownActionRef: null }]);
  assert.ok(facts(result.paid.boundaries.w).some(f => f.kind === "mine-removed"));
});

test("native duplicate mine appends preserve per-square occurrences and native removal slots", () => {
  const replay = EconomicReplay.fromSnapshotForTest(parseScFen("SCFEN|7k/8/8/8/5p2/8/2N5/K7|21|33|P|G:33:33|B:3:3|Q:w:;b:|M:w:e3;b:e3"));
  replay.start("tiny-v1");
  const duplicate: Pair<Action[]> = { w: [{ kind: "spiderMine", timing: "F", color: "w", from: "c2" }, { kind: "classical", timing: "C", color: "w", from: "c2", to: "e3" }], b: [] };
  const advance = (ordinal: number, requests: Pair<Action[]>) => {
    const open = replay.open(ordinal); if (open.kind !== "planning") throw new Error("Expected planning");
    return replay.settle(open.context, requests);
  };
  const first = advance(0, duplicate);
  assert.deepEqual(first.boundaries.w.snapshot.own.mines, ["e3", "e3"]);
  advance(1, { w: [{ kind: "classical", timing: "C", color: "w", from: "e3", to: "c2" }], b: [] });
  const second = advance(2, duplicate);
  assert.deepEqual(second.boundaries.w.snapshot.own.mines, ["e3", "e3", "e3"]);
  const third = advance(3, { w: [], b: [{ kind: "classical", timing: "C", color: "b", from: "f4", to: "e3" }] });
  const removed = facts(third.boundaries.w).filter(f => f.kind === "mine-removed");
  assert.deepEqual(removed.map(f => f.subject), [0, 1, 2].map(slot => ({ kind: "before-mine", square: "e3", slot })));
  assert.deepEqual(third.boundaries.w.snapshot.own.mines, []);
  assert.equal(facts(third.boundaries.b).filter(f => f.kind === "mine-removed").length, 1);
  replay.close();
});

function nativeCompanion(raw: string, actions: Action[]) {
  const initial = parseScFen(raw); const provenance = initializeProvenance(initial);
  const began = beginTurnWithProvenance({ snapshot: initial, provenance });
  let queued = began.nativeResult.next;
  for (const action of actions) queued = addScAction({ snapshot: queued, action }).snapshot;
  const ordinals = { w: 0, b: 0 };
  const ended = endTurnWithProvenance({ snapshot: queued, provenance: began.provenance, actionBindings: (queued.queue?.actions ?? []).map(a => ({ sourceActionSeq: a.seq, side: a.color, actionRef: { planningOrdinal: 0, acceptedActionOrdinal: ordinals[a.color]++ } })) });
  const projector = new EconomicProjector(); projector.initial(initial, provenance);
  return { projector, ended, initial, next: { ...ended.nativeResult.next, stored: initial.stored } };
}

type SyntheticImage = TrustedEffectFrame["before"];
type SyntheticUnit = Extract<EngineEntity, { kind: "unit" }>;
type SyntheticEffect = TrustedEffectFrame["effects"][number];

function syntheticOwnModeFrame(born: boolean, build: (unit: SyntheticUnit, image: SyntheticImage) => { effects: readonly SyntheticEffect[]; after: SyntheticImage }) {
  const { projector, ended, initial } = nativeCompanion(`SCFEN|7k/8/8/8/8/8/${born ? "8" : "P7"}/K7|21|33|P|G:33:33|B:3:3|Q:w:;b:`, []);
  const before: SyntheticImage = { entities: ended.provenance.entities, ccLives: ended.provenance.ccLives, nativeMineOrder: ended.provenance.nativeMineOrder };
  const unit: SyntheticUnit = born ? { id: "engine:unit:3", kind: "unit", side: "w", square: "a2", type: "p", tankMode: null } : (() => {
    const pawn = before.entities.find(entity => entity.kind === "unit" && entity.side === "w" && entity.type === "p");
    assert.ok(pawn?.kind === "unit"); return pawn;
  })();
  const built = build(unit, before);
  const frame: TrustedEffectFrame = { sourceEffectKey: "synthetic-mode-frame", phase: born ? "B" : "C-promotion", before, after: built.after,
    beforeVisibilityKey: "synthetic-before", afterVisibilityKey: "synthetic-after", effects: built.effects };
  const project = (selected = frame, target = projector) => {
    const board = new Map<Square, ScPiece>();
    for (const entity of selected.after.entities) if (entity.kind === "unit") board.set(entity.square, { color: entity.side, type: entity.type });
    const snapshot = { ...initial, placement: mapToPlacement(board), ccLives: { ...selected.after.ccLives },
      siegedTanks: selected.after.entities.flatMap(entity => entity.kind === "unit" && entity.tankMode === "siege" ? [entity.square] : []),
    };
    const companion: ProvenanceCompanion<unknown> = { ...ended, frames: [selected], provenance: { ...ended.provenance,
      resolvedActions: [{ sourceActionSeq: 0, side: "w", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, effectiveActorId: born ? null : unit.id }],
    }, visibilityImages: [
      { key: selected.beforeVisibilityKey, ordinal: 0, turn: initial.turn, phase: selected.phase, state: selected.before },
      { key: selected.afterVisibilityKey, ordinal: 1, turn: initial.turn, phase: selected.phase, state: selected.after },
    ], visibilityCheckpoints: [
      { ordinal: 0, imageKey: selected.beforeVisibilityKey, frameKey: selected.sourceEffectKey, point: "before-frame" },
      { ordinal: 1, imageKey: selected.afterVisibilityKey, frameKey: selected.sourceEffectKey, point: "after-frame" },
    ] };
    return target.boundary({ snapshot, companion, phase: "turn-open", planningOrdinal: 0 });
  };
  return { frame, unit, projector, project };
}

for (const mode of ["tank", "siege"] as const) {
  test(`synthetic same-frame rook birth and death preserve actual ${mode} origin without an endpoint`, () => {
    const fixture = syntheticOwnModeFrame(true, (unit, image) => {
      const rook: SyntheticUnit = { ...unit, type: "r", tankMode: mode };
      return { after: image, effects: [
        { kind: "unit-create", entity: rook, sourceActionSeq: 0 },
        { kind: "unit-destroy", entity: rook, sourceActionSeq: 0, causalBeforeVisibilityKey: "synthetic-before" },
        { kind: "deployment-disposition", materializedEntityId: rook.id, sourceActionSeq: 0 },
      ] };
    });
    const projected = fixture.project().w;
    assert.deepEqual(facts(projected), [
      { kind: "unit-born", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, square: "a2", type: "r", mode },
      { kind: "unit-destroyed", subject: { kind: "born-unit", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 } }, square: "a2", type: "r" },
    ]);
    const group = projected.groups.find(group => group.kind === "effects");
    assert.ok(group?.kind === "effects"); assert.deepEqual(group.beforeOwn, group.afterOwn);
    assert.deepEqual(parseEconomicBoundary(projected), projected);
  });

  test(`synthetic birth retains ${mode} before a separate actual mode change`, () => {
    const finalMode = mode === "tank" ? "siege" : "tank";
    const fixture = syntheticOwnModeFrame(true, (unit, image) => {
      const rook: SyntheticUnit = { ...unit, type: "r", tankMode: mode };
      return { after: { ...image, entities: [...image.entities, { ...rook, tankMode: finalMode }] }, effects: [
        { kind: "unit-create", entity: rook, sourceActionSeq: 0 },
        { kind: "tank-mode-change", entityId: rook.id, before: mode, after: finalMode, sourceActionSeq: 0 },
      ] };
    });
    assert.deepEqual(facts(fixture.project().w), [
      { kind: "unit-born", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, square: "a2", type: "r", mode },
      { kind: "unit-mode-changed", subject: { kind: "born-unit", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 } }, before: mode, after: finalMode },
    ]);
  });

  test(`synthetic transform and immediate death use the actual ${mode} death anchor`, () => {
    const fixture = syntheticOwnModeFrame(false, (unit, image) => ({
      after: { ...image, entities: image.entities.filter(entity => entity.id !== unit.id) }, effects: [
        { kind: "unit-transform", entityId: unit.id, fromType: "p", toType: "r", sourceActionSeq: 0 },
        { kind: "unit-destroy", entity: { ...unit, type: "r", tankMode: mode }, sourceActionSeq: 0, causalBeforeVisibilityKey: "synthetic-before" },
      ],
    }));
    assert.deepEqual(facts(fixture.project().w), [
      { kind: "unit-transformed", subject: { kind: "before-unit", square: "a2" }, fromType: "p", toType: "r", toMode: mode },
      { kind: "unit-destroyed", subject: { kind: "before-unit", square: "a2" }, square: "a2", type: "r" },
    ]);
  });

  test(`synthetic newborn pawn keeps its born locator through ${mode} rook transformation and death`, () => {
    const fixture = syntheticOwnModeFrame(true, (unit, image) => ({ after: image, effects: [
      { kind: "unit-create", entity: unit, sourceActionSeq: 0 },
      { kind: "unit-transform", entityId: unit.id, fromType: "p", toType: "r", sourceActionSeq: 0 },
      { kind: "unit-destroy", entity: { ...unit, type: "r", tankMode: mode }, sourceActionSeq: 0, causalBeforeVisibilityKey: "synthetic-before" },
    ] }));
    const subject = { kind: "born-unit", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 } };
    assert.deepEqual(facts(fixture.project().w), [
      { kind: "unit-born", actionRef: subject.actionRef, square: "a2", type: "p", mode: null },
      { kind: "unit-transformed", subject, fromType: "p", toType: "r", toMode: mode },
      { kind: "unit-destroyed", subject, square: "a2", type: "r" },
    ]);
  });

  for (const retired of [false, true]) {
    test(`synthetic ${mode} type entry precedes a real mode change and ${retired ? "death" : "survival"}`, () => {
      const finalMode = mode === "tank" ? "siege" : "tank";
      const fixture = syntheticOwnModeFrame(false, (unit, image) => {
        const rook: SyntheticUnit = { ...unit, type: "r", tankMode: finalMode };
        return { after: { ...image, entities: retired ? image.entities.filter(entity => entity.id !== unit.id) : image.entities.map(entity => entity.id === unit.id ? rook : entity) }, effects: [
          { kind: "unit-transform", entityId: unit.id, fromType: "p", toType: "r", sourceActionSeq: 0 },
          { kind: "tank-mode-change", entityId: unit.id, before: mode, after: finalMode, sourceActionSeq: 0 },
          ...(retired ? [{ kind: "unit-destroy" as const, entity: rook, sourceActionSeq: 0, causalBeforeVisibilityKey: "synthetic-before" }] : []),
        ] };
      });
      const subject = { kind: "before-unit", square: "a2" };
      const projected = fixture.project().w;
      assert.deepEqual(facts(projected), [
        { kind: "unit-transformed", subject, fromType: "p", toType: "r", toMode: mode },
        { kind: "unit-mode-changed", subject, before: mode, after: finalMode },
        ...(retired ? [{ kind: "unit-destroyed", subject, square: "a2", type: "r" }] : []),
      ]);
      assert.deepEqual(parseEconomicBoundary(projected), projected);
    });
  }
}

test("synthetic transformation validates successive mode changes against the advancing native mode", () => {
  const fixture = syntheticOwnModeFrame(false, (unit, image) => ({
    after: { ...image, entities: image.entities.map(entity => entity.id === unit.id ? { ...unit, type: "r", tankMode: "siege" } : entity) }, effects: [
      { kind: "unit-transform", entityId: unit.id, fromType: "p", toType: "r", sourceActionSeq: 0 },
      { kind: "tank-mode-change", entityId: unit.id, before: "tank", after: "siege", sourceActionSeq: 0 },
      { kind: "tank-mode-change", entityId: unit.id, before: "siege", after: "tank", sourceActionSeq: 0 },
      { kind: "tank-mode-change", entityId: unit.id, before: "tank", after: "siege", sourceActionSeq: 0 },
    ],
  }));
  assert.deepEqual(facts(fixture.project().w).map(fact => fact.kind === "unit-transformed" ? fact.toMode : fact.kind === "unit-mode-changed" ? [fact.before, fact.after] : fact.kind), ["tank", ["tank", "siege"], ["siege", "tank"], ["tank", "siege"]]);
});

test("synthetic movement preserves the type-entry mode until a real native mode-change effect", () => {
  const fixture = syntheticOwnModeFrame(false, (unit, image) => ({
    after: { ...image, entities: image.entities.map(entity => entity.id === unit.id ? { ...unit, square: "a3", type: "r", tankMode: "siege" } : entity) }, effects: [
      { kind: "unit-transform", entityId: unit.id, fromType: "p", toType: "r", sourceActionSeq: 0 },
      { kind: "unit-move", entityId: unit.id, from: "a2", to: "a3", sourceActionSeq: 0 },
      { kind: "tank-mode-change", entityId: unit.id, before: "tank", after: "siege", sourceActionSeq: 0 },
    ],
  }));
  const subject = { kind: "before-unit", square: "a2" };
  assert.deepEqual(facts(fixture.project().w), [
    { kind: "unit-transformed", subject, fromType: "p", toType: "r", toMode: "tank" },
    { kind: "unit-moved", subject, from: "a2", to: "a3" },
    { kind: "unit-mode-changed", subject, before: "tank", after: "siege" },
  ]);
});

test("synthetic contradictory transformation anchors refuse for the intended reason and retain both recipient cursors", () => {
  type Mutation = (frame: TrustedEffectFrame, unit: SyntheticUnit) => TrustedEffectFrame;
  const endpoint = (frame: TrustedEffectFrame, unit: SyntheticUnit, patch: Partial<SyntheticUnit>): TrustedEffectFrame => ({ ...frame,
    after: { ...frame.after, entities: frame.after.entities.map(entity => entity.id === unit.id ? { ...unit, type: "r", tankMode: "siege", ...patch } : entity) },
  });
  const absent = (frame: TrustedEffectFrame, unit: SyntheticUnit): SyntheticImage => ({ ...frame.after, entities: frame.after.entities.filter(entity => entity.id !== unit.id) });
  const death = (unit: SyntheticUnit, patch: Partial<SyntheticUnit> = {}): SyntheticEffect => ({ kind: "unit-destroy", entity: { ...unit, type: "r", tankMode: "siege", ...patch }, sourceActionSeq: 0, causalBeforeVisibilityKey: "synthetic-before" });
  const mutations: [string, RegExp, Mutation][] = [
    ["missing endpoint", /transformation terminal anchor/, (frame, unit) => ({ ...frame, after: absent(frame, unit) })],
    ["foreign endpoint", /incompatible native unit anchor/, (frame, unit) => endpoint(frame, unit, { side: "b" })],
    ["wrong endpoint type", /terminal anchor type mismatch/, (frame, unit) => endpoint(frame, unit, { type: "q", tankMode: null })],
    ["invalid endpoint mode", /Invalid native unit type\/mode/, (frame, unit) => endpoint(frame, unit, { tankMode: null })],
    ["incompatible final mode", /transformation terminal mode/, (frame, unit) => endpoint(frame, unit, { tankMode: "tank" })],
    ["wrong endpoint kind", /incompatible native unit anchor/, (frame, unit) => ({ ...frame, after: { ...frame.after, entities: frame.after.entities.map(entity => entity.id === unit.id ? { id: unit.id, kind: "mine", side: "w", square: unit.square } as unknown as EngineEntity : entity) } })],
    ["duplicate endpoint", /Duplicate native frame entity/, (frame, unit) => ({ ...frame, after: { ...frame.after, entities: [...frame.after.entities, { ...unit, type: "r", tankMode: "siege" }] } })],
    ["missing preimage", /Missing native unit causal preimage/, (frame, unit) => ({ ...frame, before: { ...frame.before, entities: frame.before.entities.filter(entity => entity.id !== unit.id) } })],
    ["unknown transformed identity", /Missing native unit causal preimage/, frame => ({ ...frame, effects: frame.effects.map(event => event.kind === "unit-transform" || event.kind === "tank-mode-change" ? { ...event, entityId: "engine:unit:99" } : event) })],
    ["wrong source type", /Incompatible native transformation type/, frame => ({ ...frame, effects: frame.effects.map(event => event.kind === "unit-transform" ? { ...event, fromType: "q" } : event) })],
    ["broken advancing chain", /transformation mode chain/, (frame, unit) => ({ ...frame, effects: [...frame.effects, { kind: "tank-mode-change", entityId: unit.id, before: "tank", after: "siege", sourceActionSeq: 0 }] })],
    ["unprovable second type entry", /Unprovable compound transformation/, (frame, unit) => ({ ...endpoint(frame, unit, { type: "q", tankMode: null }), effects: [frame.effects[0]!, { kind: "unit-transform", entityId: unit.id, fromType: "r", toType: "q", sourceActionSeq: 0 }] })],
    ["identity reuse", /identity reuse/, (frame, unit) => ({ ...frame, effects: [...frame.effects, { kind: "unit-create", entity: { ...unit, type: "r", tankMode: "siege" }, sourceActionSeq: 0 }] })],
    ["foreign death", /incompatible native unit anchor/, (frame, unit) => ({ ...frame, after: absent(frame, unit), effects: [...frame.effects, death(unit, { side: "b" })] })],
    ["wrong death type", /death anchor type mismatch/, (frame, unit) => ({ ...frame, after: absent(frame, unit), effects: [...frame.effects, death(unit, { type: "q", tankMode: null })] })],
    ["invalid death mode", /Invalid native unit type\/mode/, (frame, unit) => ({ ...frame, after: absent(frame, unit), effects: [...frame.effects, death(unit, { tankMode: null })] })],
    ["incompatible death mode", /transformation death mode/, (frame, unit) => ({ ...frame, after: absent(frame, unit), effects: [...frame.effects, death(unit, { tankMode: "tank" })] })],
    ["retired endpoint", /Retired native unit survives/, (frame, unit) => ({ ...frame, effects: [...frame.effects, death(unit)] })],
    ["movement after retirement", /Post-retirement native unit effect/, (frame, unit) => ({ ...frame, after: absent(frame, unit), effects: [...frame.effects, death(unit), { kind: "unit-move", entityId: unit.id, from: "a2", to: "a3", sourceActionSeq: 0 }] })],
    ["mode change after retirement", /Post-retirement native unit effect/, (frame, unit) => ({ ...frame, after: absent(frame, unit), effects: [...frame.effects, death(unit), { kind: "tank-mode-change", entityId: unit.id, before: "siege", after: "tank", sourceActionSeq: 0 }] })],
  ];
  for (const [name, reason, mutate] of mutations) {
    const fixture = syntheticOwnModeFrame(false, (unit, image) => ({
      after: { ...image, entities: image.entities.map(entity => entity.id === unit.id ? { ...unit, type: "r", tankMode: "siege" } : entity) }, effects: [
        { kind: "unit-transform", entityId: unit.id, fromType: "p", toType: "r", sourceActionSeq: 0 },
        { kind: "tank-mode-change", entityId: unit.id, before: "tank", after: "siege", sourceActionSeq: 0 },
      ],
    }));
    const clean = fixture.projector.fork();
    assert.throws(() => fixture.project(mutate(fixture.frame, fixture.unit)), error => error instanceof EngineErrorV2 && error.packet.code === "ENGINE_FAILURE" && reason.test(error.message), name);
    assert.deepEqual(fixture.project(), fixture.project(fixture.frame, clean), name);
  }
});

test("synthetic contradictory birth anchors never supply a default mode or consume recipient sequences", () => {
  type Mutation = (frame: TrustedEffectFrame, unit: SyntheticUnit) => TrustedEffectFrame;
  const absent = (frame: TrustedEffectFrame, unit: SyntheticUnit): SyntheticImage => ({ ...frame.after, entities: frame.after.entities.filter(entity => entity.id !== unit.id) });
  const mutations: [string, RegExp, Mutation][] = [
    ["missing rook mode", /Invalid native unit type\/mode/, frame => ({ ...frame, effects: frame.effects.map(event => event.kind === "unit-create" ? { ...event, entity: { ...event.entity, tankMode: null } } : event) })],
    ["nonrook birth mode", /Invalid native unit type\/mode/, frame => ({ ...frame, effects: frame.effects.map(event => event.kind === "unit-create" ? { ...event, entity: { ...event.entity, type: "p", tankMode: "siege" } } : event) })],
    ["foreign birth entity", /incompatible native unit anchor/, frame => ({ ...frame, effects: frame.effects.map(event => event.kind === "unit-create" ? { ...event, entity: { ...event.entity, side: "b" } } : event) })],
    ["wrong birth kind", /incompatible native unit anchor/, (frame, unit) => ({ ...frame, effects: [{ kind: "unit-create", entity: { id: unit.id, kind: "mine", side: "w", square: unit.square } as unknown as SyntheticUnit, sourceActionSeq: 0 }] })],
    ["missing terminal entity", /incompatible native unit anchor/, (frame, unit) => ({ ...frame, after: absent(frame, unit) })],
    ["birth versus endpoint mode", /Contradictory native unit terminal anchor/, (frame, unit) => ({ ...frame, after: { ...frame.after, entities: frame.after.entities.map(entity => entity.id === unit.id ? { ...unit, type: "r", tankMode: "siege" } : entity) } })],
    ["birth versus death mode", /Contradictory native unit death anchor/, (frame, unit) => ({ ...frame, after: absent(frame, unit), effects: [...frame.effects, { kind: "unit-destroy", entity: { ...unit, type: "r", tankMode: "siege" }, sourceActionSeq: 0, causalBeforeVisibilityKey: "synthetic-before" }] })],
    ["birth reuse after retirement", /Post-retirement native unit effect/, (frame, unit) => ({ ...frame, after: absent(frame, unit), effects: [...frame.effects, { kind: "unit-destroy", entity: { ...unit, type: "r", tankMode: "tank" }, sourceActionSeq: 0, causalBeforeVisibilityKey: "synthetic-before" }, frame.effects[0]!] })],
  ];
  for (const [name, reason, mutate] of mutations) {
    const fixture = syntheticOwnModeFrame(true, (unit, image) => {
      const rook: SyntheticUnit = { ...unit, type: "r", tankMode: "tank" };
      return { after: { ...image, entities: [...image.entities, rook] }, effects: [{ kind: "unit-create", entity: rook, sourceActionSeq: 0 }] };
    });
    const clean = fixture.projector.fork();
    assert.throws(() => fixture.project(mutate(fixture.frame, fixture.unit)), error => error instanceof EngineErrorV2 && error.packet.code === "ENGINE_FAILURE" && reason.test(error.message), name);
    assert.deepEqual(fixture.project(), fixture.project(fixture.frame, clean), name);
  }
});

test("mode projection enforces the existing total native effect cap before inspecting origin anchors", () => {
  const fixture = syntheticOwnModeFrame(true, (unit, image) => ({ after: { ...image, entities: [...image.entities, unit] }, effects: [{ kind: "unit-create", entity: unit, sourceActionSeq: 0 }] }));
  const malformed = { ...fixture.frame, effects: Array.from({ length: 1153 }, () => undefined as unknown as SyntheticEffect) };
  const clean = fixture.projector.fork();
  assert.throws(() => fixture.project(malformed), error => error instanceof EngineErrorV2 && error.packet.code === "LIMIT" && /Native provenance exceeds physical bounds/.test(error.message));
  assert.deepEqual(fixture.project(), fixture.project(fixture.frame, clean));
});

test("synthetic black origin failure rolls back white facts and both side sequences atomically", () => {
  const fixture = syntheticOwnModeFrame(true, (unit, image) => ({ after: { ...image, entities: [...image.entities, unit] }, effects: [{ kind: "unit-create", entity: unit, sourceActionSeq: 0 }] }));
  const black: SyntheticUnit = { id: "engine:unit:4", kind: "unit", side: "b", type: "r", square: "h7", tankMode: null };
  const malformed: TrustedEffectFrame = { ...fixture.frame,
    after: { ...fixture.frame.after, entities: [...fixture.frame.after.entities, black] },
    effects: [...fixture.frame.effects, { kind: "unit-create", entity: black, sourceActionSeq: 1 }],
  };
  const clean = fixture.projector.fork();
  assert.throws(() => fixture.project(malformed), error => error instanceof EngineErrorV2 && error.packet.code === "ENGINE_FAILURE" && /Invalid native unit type\/mode/.test(error.message));
  const recovered = fixture.project();
  assert.deepEqual(recovered, fixture.project(fixture.frame, clean));
  assert.equal(recovered.w.seqBefore, 0); assert.equal(recovered.b.seqBefore, 0);
  assert.ok(facts(recovered.w).some(fact => fact.kind === "unit-born" && fact.mode === null));
});

test("unconsumed or mismatched capture proof cannot authorize hidden causal preimage", () => {
  const fixture = "SCFEN|4k3/8/p7/8/8/8/8/R3K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
  for (const variant of ["unconsumed", "victim", "source", "frame", "causal"] as const) {
    const { projector, ended, next } = nativeCompanion(fixture, [rookPath]);
    const forged = structuredClone(ended);
    const proof = { ...forged.provenance.lastCall.consumedFacts[0]! };
    if (variant === "victim") proof.appliedTargetId = proof.appliedActorId;
    if (variant === "source") proof.sourceActionSeq = 99;
    if (variant === "frame") proof.frameKey = "unrelated";
    if (variant === "causal") proof.causalBeforeVisibilityKey = "unrelated";
    const queries = forged.provenance.lastCall.queries.map(q => variant === "unconsumed" ? { ...q, consumption: "deferred-skipped" as const } : q);
    const companion = { ...forged, provenance: { ...forged.provenance, lastCall: { queries, consumedFacts: [proof] } } };
    const boundary = projector.boundary({ snapshot: next, companion, phase: "turn-open", planningOrdinal: 0 }).w;
    assert.deepEqual(witnesses(boundary), [], variant);
    assert.ok(!boundary.groups.some(g => g.kind === "vision" && g.changes.some(c => c.square === "a6" && c.visibility !== "unknown" && c.piece?.color === "b")), variant);
  }
});

test("unchanged private visibility checkpoints emit no repeated public noise", () => {
  const { projector, ended, next } = nativeCompanion("SCFEN|7k/8/8/8/8/8/8/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:", []);
  const state = { entities: ended.provenance.entities, ccLives: ended.provenance.ccLives, nativeMineOrder: ended.provenance.nativeMineOrder };
  const companion: ProvenanceCompanion<unknown> = { ...ended, visibilityImages: [{ key: "private", ordinal: 0, turn: 21, phase: "F", state }], visibilityCheckpoints: Array.from({ length: 100 }, (_, ordinal) => ({ ordinal, imageKey: "private", frameKey: null, point: "path-visibility" as const })) };
  const baseline = projector.fork().boundary({ snapshot: next, companion: ended, phase: "turn-open", planningOrdinal: 0 });
  const repeated = projector.boundary({ snapshot: next, companion, phase: "turn-open", planningOrdinal: 0 });
  assert.equal(JSON.stringify(repeated), JSON.stringify(baseline));
});

test("own geometry filters native mine order before same-square slot assignment", () => {
  const initial = parseScFen("SCFEN|7k/8/8/8/8/8/8/K7|21|33|P|G:33:33|B:3:3|Q:w:;b:|M:w:e3;b:e3");
  const provenance = initializeProvenance(initial);
  const extra = { id: "engine:mine:3" as const, kind: "mine" as const, side: "w" as const, square: "e3" as const };
  const image = { ...provenance, entities: [...provenance.entities, extra], nativeMineOrder: ["engine:mine:2", "engine:mine:3", "engine:mine:1"] as const };
  assert.deepEqual(projectOwnGeometry(image, "w").mines, [{ square: "e3", slot: 0 }, { square: "e3", slot: 1 }]);
});

test("private provenance cardinality refusal leaves both projector cursors unchanged", () => {
  const { projector, ended, next } = nativeCompanion("SCFEN|7k/8/8/8/8/8/8/K7|21|33|P|G:33:33|B:3:3|Q:w:;b:", []);
  const clean = projector.fork();
  const tooMany = { ...ended, frames: Array.from({ length: 1153 }, () => undefined as unknown as TrustedEffectFrame) };
  assert.throws(() => projector.boundary({ snapshot: next, companion: tooMany, phase: "turn-open", planningOrdinal: 0 }), error => error instanceof EngineErrorV2 && error.packet.code === "LIMIT" && /physical bounds/.test(error.message));
  const project = (p: EconomicProjector) => p.boundary({ snapshot: next, companion: ended, phase: "turn-open", planningOrdinal: 0 });
  assert.deepEqual(project(projector), project(clean));
});

test("whole-group newborn locators survive immediate destruction inside the same atomic frame", () => {
  const { projector, ended, initial } = nativeCompanion("SCFEN|7k/8/8/8/8/8/8/K7|21|33|P|G:33:33|B:3:3|Q:w:;b:", []);
  const entity = { id: "engine:unit:3" as const, kind: "unit" as const, side: "w" as const, square: "a2" as const, type: "p" as const, tankMode: null };
  const state = { entities: ended.provenance.entities, ccLives: ended.provenance.ccLives, nativeMineOrder: ended.provenance.nativeMineOrder };
  const frame: TrustedEffectFrame = { sourceEffectKey: "private-birth", phase: "B", before: state, after: state,
    beforeVisibilityKey: "before", afterVisibilityKey: "after", effects: [
      { kind: "unit-create", entity, sourceActionSeq: 0 },
      { kind: "unit-destroy", entity, sourceActionSeq: 0, causalBeforeVisibilityKey: "before" },
      { kind: "deployment-disposition", materializedEntityId: entity.id, sourceActionSeq: 0 },
    ] };
  const companion = { ...ended, frames: [frame], provenance: { ...ended.provenance,
    resolvedActions: [{ sourceActionSeq: 0, side: "w" as const, actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, effectiveActorId: null }],
  }, visibilityImages: [{ key: "before", ordinal: 0, turn: 21, phase: "B" as const, state }, { key: "after", ordinal: 1, turn: 21, phase: "B" as const, state }],
  visibilityCheckpoints: [{ ordinal: 0, imageKey: "before", frameKey: frame.sourceEffectKey, point: "before-frame" as const }, { ordinal: 1, imageKey: "after", frameKey: frame.sourceEffectKey, point: "after-frame" as const }] };
  const projected = projector.boundary({ snapshot: initial, companion, phase: "turn-open", planningOrdinal: 0 }).w;
  assert.deepEqual(facts(projected), [
    { kind: "unit-born", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 }, square: "a2", type: "p", mode: null },
    { kind: "unit-destroyed", subject: { kind: "born-unit", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 } }, square: "a2", type: "p" },
  ]);
});

test("transient native mover vision remains authorized after the mover returns behind fog", () => {
  const result = run("SCFEN|7k/2p5/8/8/8/8/1Q6/K7|21|33|P|G:33:33|B:3:3|Q:w:;b:", {
    w: [{ kind: "classical", timing: "C", color: "w", from: "b2", to: "b6" }, { kind: "tacticalJump", timing: "F", color: "w", from: "b2", to: "h1" }], b: [],
  });
  const boundary = result.paid.boundaries.w;
  assert.ok(boundary.groups.some(g => g.kind === "vision" && g.changes.some(c => c.square === "c7" && c.visibility === "lit" && c.piece?.color === "b")));
  assert.equal(boundary.snapshot.cells.find(c => c.square === "c7")?.visibility, "unknown");
  assert.deepEqual(witnesses(boundary), []);
});

test("native siege mode expands actual visibility and keeps rook-only modes canonical", () => {
  const result = run("SCFEN|7k/8/8/6p1/8/8/8/K2R4|21|33|P|G:33:33|B:3:3|Q:w:;b:", {
    w: [{ kind: "siegeMode", timing: "B", color: "w", from: "d1" }], b: [],
  });
  assert.equal(result.start.boundaries.w.snapshot.cells.find(c => c.square === "g5")?.visibility, "unknown");
  assert.ok(facts(result.paid.boundaries.w).some(f => f.kind === "unit-mode-changed" && f.before === "tank" && f.after === "siege"));
  assert.equal(result.paid.boundaries.w.snapshot.cells.find(c => c.square === "g5")?.visibility, "lit");
  const effect = result.paid.boundaries.w.groups.find(g => g.kind === "effects");
  assert.ok(effect?.kind === "effects");
  assert.deepEqual(effect.afterOwn.units, [{ square: "a1", type: "k", mode: null }, { square: "d1", type: "r", mode: "siege" }]);
});

test("public 2048-group refusal and deadline refusal leave both side cursors transactional", () => {
  const { projector, ended, initial } = nativeCompanion("SCFEN|7k/8/8/8/8/8/8/K7|21|33|P|G:33:33|B:3:3|Q:w:;b:", [{ kind: "classical", timing: "C", color: "w", from: "a1", to: "b1" }]);
  const template = ended.frames[0]!;
  const frames: TrustedEffectFrame[] = Array.from({ length: 1025 }, (_, i) => {
    const before = i % 2 === 0 ? template.before : template.after;
    const after = i % 2 === 0 ? template.after : template.before;
    const move = template.effects.find(e => e.kind === "unit-move")!;
    assert.ok(move.kind === "unit-move");
    return { ...template, before, after, sourceEffectKey: `frame-${i}`, beforeVisibilityKey: `before-${i}`, afterVisibilityKey: `after-${i}`,
      effects: [{ ...move, from: i % 2 === 0 ? "a1" : "b1", to: i % 2 === 0 ? "b1" : "a1" }] };
  });
  const companion = { ...ended, frames,
    visibilityImages: frames.flatMap((f, i) => [{ key: f.beforeVisibilityKey, ordinal: 2 * i, turn: 21, phase: f.phase, state: f.before }, { key: f.afterVisibilityKey, ordinal: 2 * i + 1, turn: 21, phase: f.phase, state: f.after }]),
    visibilityCheckpoints: frames.flatMap((f, i) => [{ ordinal: 2 * i, imageKey: f.beforeVisibilityKey, frameKey: f.sourceEffectKey, point: "before-frame" as const }, { ordinal: 2 * i + 1, imageKey: f.afterVisibilityKey, frameKey: f.sourceEffectKey, point: "after-frame" as const }]),
  };
  const clean = projector.fork();
  assert.throws(() => projector.boundary({ snapshot: initial, companion, phase: "turn-open", planningOrdinal: 0 }), error => error instanceof EngineErrorV2 && error.packet.code === "LIMIT" && /public group or entry cap/.test(error.message));
  assert.throws(() => projector.boundary({ snapshot: initial, companion: ended, phase: "turn-open", planningOrdinal: 0, deadline: -1 }), error => error instanceof EngineErrorV2 && error.packet.code === "LIMIT" && /deadline/.test(error.message));
  const project = (p: EconomicProjector) => p.boundary({ snapshot: initial, companion: { ...ended, frames: [], visibilityImages: [], visibilityCheckpoints: [] }, phase: "turn-open", planningOrdinal: 0 });
  assert.deepEqual(project(projector), project(clean));
});

test("public recipient output never exposes the opposing actual bank or debit", () => {
  const result = run("SCFEN|7k/8/8/8/8/8/8/K7|21|33|P|G:33:33|B:3:12|Q:w:;b:", {
    w: [], b: [{ kind: "deploy", timing: "B", color: "b", from: "h8", to: "g7", unit: "q" }],
  });
  for (const side of ["w", "b"] as Side[]) {
    const text = JSON.stringify(result.paid.boundaries[side]);
    assert.ok(!/opponent|bank|rawResolve|requests|nativeResult|modelInput/.test(text));
  }
  assert.deepEqual(result.paid.boundaries.w.groups.filter(g => g.kind === "admission"), []);
});
