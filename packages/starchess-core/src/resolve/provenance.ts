// SPEC: _spec/packages/starchess-core/resolve.puml, _spec/packages/starchess-core/resolve-turn-activity.puml, _spec/packages/starchess-core/submit-turn-activity.puml
import { placementToMap } from "../board/placement";
import { scOutcome } from "../outcome";
import type { ScFenSnapshot } from "../model/types";
import { beginScTurnKernel, endScTurnKernel, type BeginScTurnResult, type EndScTurnResult } from "./submit-turn";
import { ProvenanceRecorder } from "./provenance-recorder";
import { fail, freezeDetached, reconcile, record, validateBindings, validateProvenance, validateSnapshot } from "./provenance-validation";
import type { ActionBindings, EngineEntity, EngineProvenance, MineId, ProvenanceCompanion } from "./provenance-types";

export function initializeProvenance(snapshot: ScFenSnapshot): EngineProvenance {
  validateSnapshot(snapshot, true);
  if (snapshot.queue?.actions.length) fail("$.snapshot.queue", "SEQUENCE");
  let unitCounter = 0; let mineCounter = 0;
  const entities: EngineEntity[] = [...placementToMap(snapshot.placement)].sort(([a], [b]) => a < b ? -1 : 1).map(([square, piece]) => ({
    id: `engine:unit:${++unitCounter}`, kind: "unit", side: piece.color, type: piece.type, square,
    tankMode: piece.type === "r" ? snapshot.siegedTanks?.includes(square) ? "siege" : "tank" : null,
  }));
  const mineIds = new Map<number, MineId>();
  const mines = snapshot.mines ?? [];
  const ordered = mines.map((mine, index) => ({ mine, index })).sort((a, b) => a.mine.color < b.mine.color ? 1 : a.mine.color > b.mine.color ? -1 : a.mine.at < b.mine.at ? -1 : 1);
  for (const { mine, index } of ordered) {
    const id: MineId = `engine:mine:${++mineCounter}`;
    mineIds.set(index, id);
    entities.push({ id, kind: "mine", side: mine.color, square: mine.at });
  }
  const provenance: EngineProvenance = freezeDetached({
    version: "engine-provenance-v1", initialTurn: snapshot.turn, turn: snapshot.turn,
    stage: scOutcome(snapshot) ? "terminal" : "before-begin", callOrdinal: 0,
    unitCounter, mineCounter, entities: entities.sort((a, b) => a.id < b.id ? -1 : 1),
    ccLives: snapshot.ccLives, nativeMineOrder: mines.map((_, index) => mineIds.get(index)!),
    resolvedActions: [], lastCall: { queries: [], consumedFacts: [] },
  });
  validateProvenance(provenance);
  return provenance;
}

function preflight(input: { snapshot: ScFenSnapshot; provenance: EngineProvenance }, stage: "before-begin" | "after-begin"): void {
  validateSnapshot(input.snapshot);
  validateProvenance(input.provenance);
  if (input.provenance.stage !== stage || input.snapshot.phase !== "P" || input.snapshot.turn !== input.provenance.turn || scOutcome(input.snapshot)) fail("$.provenance.stage", "SEQUENCE");
  reconcile(input.provenance, input.snapshot);
}

function inputKeys(input: unknown, keys: readonly string[]): void {
  record(input, keys, "$");
}

function finish<R extends BeginScTurnResult | EndScTurnResult>(recorder: ProvenanceRecorder, nativeResult: R, begin: boolean): ProvenanceCompanion<R> {
  const snapshot = nativeResult.next;
  const image = recorder.image();
  reconcile(image, snapshot);
  const counts: Record<string, number> = {};
  const ceilings: Record<string, number> = {
    "unit-create": 2, "unit-destroy": 66, "unit-move": 520, "unit-transform": 8,
    "tank-mode-change": 530, "mine-create": 6, "mine-remove": 12,
    "cc-lives-change": 6, "deployment-disposition": 2,
  };
  for (const frame of recorder.frames) for (const effect of frame.effects) {
    counts[effect.kind] = (counts[effect.kind] ?? 0) + 1;
    if (counts[effect.kind]! > ceilings[effect.kind]!) fail("$.effects", "CARDINALITY");
    if (effect.sourceActionSeq !== null && !recorder.bindings[effect.sourceActionSeq]) fail("$.effects.source", "PROVENANCE");
  }
  if (!begin && (counts["deployment-disposition"] ?? 0) !== ("queue" in nativeResult ? nativeResult.queue.filter(a => a.kind === "deploy").length : 0)) fail("$.deployment-dispositions", "PROVENANCE");
  const provenance: EngineProvenance = freezeDetached({
    ...recorder.input, ...image, turn: snapshot.turn, callOrdinal: recorder.input.callOrdinal + 1,
    stage: scOutcome(snapshot) ? "terminal" : begin ? "after-begin" : "before-begin",
    unitCounter: recorder.unitCounter, mineCounter: recorder.mineCounter,
    resolvedActions: begin ? [] : recorder.bindings.map(binding => ({ ...binding, effectiveActorId: recorder.actors.get(binding.sourceActionSeq) ?? null })),
    lastCall: { queries: recorder.queries, consumedFacts: recorder.consumedFacts },
  });
  validateProvenance(provenance);
  for (const proof of provenance.lastCall.consumedFacts) {
    const frame = recorder.frames.find(frame => frame.sourceEffectKey === proof.frameKey);
    const actor = frame?.before.entities.find(e => e.id === proof.appliedActorId);
    const target = frame?.before.entities.find(e => e.id === proof.appliedTargetId);
    const query = provenance.lastCall.queries[proof.queryOrdinal]!;
    const evaluationActor = query.base.entities.find(e => e.id === proof.evaluationActorId);
    if (!frame || frame.beforeVisibilityKey !== proof.causalBeforeVisibilityKey || !actor || actor.kind !== "unit" || actor.side !== proof.side || actor.square !== query.from || !evaluationActor || evaluationActor.kind !== "unit" || actor.type !== evaluationActor.type || !target || target.kind !== "unit" || target.square !== proof.targetCell.square || target.side !== proof.targetCell.piece.color || target.type !== proof.targetCell.piece.type) fail("$.consumedFacts", "PROVENANCE");
    if (!frame.effects.some(effect => effect.sourceActionSeq === proof.sourceActionSeq && (proof.operation === "capture" ? effect.kind === "unit-destroy" && effect.entity.id === proof.appliedTargetId : effect.kind === "cc-lives-change" && effect.side === target.side))) fail("$.consumedFacts.effect", "PROVENANCE");
  }
  const privateRecords = freezeDetached({ frames: recorder.frames, visibilityImages: recorder.visibilityImages, visibilityCheckpoints: recorder.visibilityCheckpoints });
  const json = JSON.stringify({ provenance, ...privateRecords });
  if (json.length > 16_777_216 || new TextEncoder().encode(json).byteLength > 16_777_216) fail("$", "SIZE");
  return Object.freeze({ nativeResult, provenance, ...privateRecords });
}

export function beginTurnWithProvenance(input: { snapshot: ScFenSnapshot; provenance: EngineProvenance }): ProvenanceCompanion<BeginScTurnResult> {
  inputKeys(input, ["snapshot", "provenance"]);
  preflight(input, "before-begin");
  if (input.snapshot.queue?.actions.length) fail("$.snapshot.queue", "SEQUENCE");
  const recorder = new ProvenanceRecorder(input.provenance);
  return finish(recorder, beginScTurnKernel(input.snapshot, recorder), true);
}

export function endTurnWithProvenance(input: { snapshot: ScFenSnapshot; provenance: EngineProvenance; actionBindings: ActionBindings }): ProvenanceCompanion<EndScTurnResult> {
  inputKeys(input, ["snapshot", "provenance", "actionBindings"]);
  preflight(input, "after-begin");
  validateBindings(input.actionBindings, input.snapshot.queue?.actions ?? [], Math.floor(input.provenance.callOrdinal / 2));
  const recorder = new ProvenanceRecorder(input.provenance, input.actionBindings);
  return finish(recorder, endScTurnKernel(input.snapshot, { skipTurnStartChecks: true }, recorder), false);
}
