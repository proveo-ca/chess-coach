import { classicalRewriteCoordinatesAfterB, marineSingleTarget, orderBHeadsFirst, type ScAction, type ScActionInput, type Square } from "@chess-coach/starchess-core/planning-v1";
import type { Candidate, History, Meter } from "../economic/contracts";
import { charge, fail } from "../economic/work";
import type { FeatureLayers, FeatureUnit, OwnView } from "./relations";

export type ActionCheckpoint = Readonly<{
  index: number; action: ScActionInput; before: OwnView; after: OwnView;
  actorToken: string | null; actorBefore: FeatureUnit | null; actorAfter: FeatureUnit | null;
  effectiveFrom: Square; effectiveTo: Square | null; unknownRewrite: boolean; childToken: string | null;
}>;
export type OwnProjection = Readonly<{
  layers: FeatureLayers; baseline: OwnView; final: OwnView;
  positions: readonly ActionCheckpoint[]; schedule: readonly number[]; crushed: ReadonlySet<string>;
}>;

const copyView = (view: OwnView, meter: Meter): OwnView => {
  charge(meter, 6 + 4 * view.units.size + 4 * view.at.size + 3 * view.mines.size, "$.work.feature.projection.viewCopy");
  return { units: new Map(view.units), at: new Map(view.at), mines: new Set(view.mines) };
};
const unitAt = (view: OwnView, square: Square, meter: Meter): FeatureUnit | null => {
  charge(meter, 5, "$.work.feature.projection.actorLookup");
  const token = view.at.get(square);
  return token === undefined ? null : view.units.get(token) ?? null;
};
const putUnit = (view: OwnView, unit: FeatureUnit, meter: Meter): void => {
  charge(meter, 5, "$.work.feature.projection.putUnit");
  (view.units as Map<string, FeatureUnit>).set(unit.token, unit);
  (view.at as Map<Square, string>).set(unit.square, unit.token);
};
const removeUnit = (view: OwnView, unit: FeatureUnit, meter: Meter): void => {
  charge(meter, 5, "$.work.feature.projection.removeUnit");
  (view.units as Map<string, FeatureUnit>).delete(unit.token);
  (view.at as Map<Square, string>).delete(unit.square);
};

export const projectOwn = (history: History, candidate: Candidate, meter: Meter): OwnProjection => {
  charge(meter, 7, "$.work.feature.projection.cardinality");
  if (candidate.actions.length > 4) fail("$.actions", "CARDINALITY");
  const snapshot = history.currentAuthorizedSnapshotV2;
  charge(meter, 12, "$.work.feature.projection.layersAllocate");
  const units = new Map<string, FeatureUnit>(), at = new Map<Square, string>();
  const enemies = new Map<Square, { type: FeatureUnit["type"]; color: "w" | "b" }>(), unknown = new Set<Square>();
  for (const cell of snapshot.cells) {
    charge(meter, 12, "$.work.feature.projection.cellVisit");
    if (cell.visibility === "unknown") unknown.add(cell.square);
    else if (cell.piece && cell.piece.color !== snapshot.side) enemies.set(cell.square, { ...cell.piece });
  }
  for (const lineage of snapshot.ownUnitLineage) {
    charge(meter, 9 * 4 + 20 + 3 * snapshot.own.siegedTanks.length, "$.work.feature.projection.lineageVisit");
    const unit: FeatureUnit = { token: lineage.id, square: lineage.square, type: lineage.type, color: snapshot.side,
      paidBasis: lineage.paidBasis, baseline: true, mode: lineage.type === "r" ? snapshot.own.siegedTanks.includes(lineage.square) ? "siege" : "tank" : null, nominal: false };
    units.set(unit.token, unit); at.set(unit.square, unit.token);
  }
  charge(meter, 8 + 3 * snapshot.own.mines.length, "$.work.feature.projection.baselineAllocate");
  const baseline: OwnView = { units, at, mines: new Set(snapshot.own.mines) }, layers: FeatureLayers = { enemies, unknown };
  let view = baseline;
  charge(meter, 8 + candidate.actions.length * (8 * 3 + 8), "$.work.feature.projection.scheduleInput");
  const actions: ScAction[] = candidate.actions.map((action, seq) => ({ ...action, seq }));
  const b = actions.filter(action => action.timing === "B");
  // WHAT: native sort, pending copies, head sets, find scans, splice for n<=4.
  charge(meter, 16 + b.length * b.length * (24 + 8 * b.length) + 16 * actions.length, "$.work.feature.projection.nativeBOrder");
  const schedule = [...orderBHeadsFirst(b), ...actions.filter(a => a.timing === "C"), ...actions.filter(a => a.timing === "F")];
  charge(meter, 7 + 3 * actions.length, "$.work.feature.projection.checkpointsAllocate");
  const positions: ActionCheckpoint[] = new Array(actions.length), crushed = new Set<string>();
  let classical: ActionCheckpoint | null = null;
  for (const action of schedule) {
    charge(meter, 14, "$.work.feature.projection.actionVisit");
    const before = view, after = copyView(before, meter);
    let effectiveFrom = action.from, effectiveTo: Square | null = action.to ?? null, unknownRewrite = false;
    if (action.timing === "C") {
      // WHAT: native prefix find, coordinate arithmetic, structural rewrite checks.
      charge(meter, 100 + 8 * actions.length, "$.work.feature.projection.nativeCRewrite");
      const rewrite = classicalRewriteCoordinatesAfterB(actions, action);
      charge(meter, 24 + 12 * actions.length, "$.work.feature.projection.rewriteBinding");
      const relocation = actions.find(a => a.timing === "B" && a.from === action.from && (a.kind === "stimStep" || a.kind === "tacticalJump"));
      if (rewrite && !(relocation?.kind === "stimStep" && (before.at.has(rewrite.to) || enemies.has(rewrite.to)))) {
        effectiveFrom = rewrite.from; effectiveTo = rewrite.to;
        unknownRewrite = unknown.has(rewrite.to);
      }
    } else if (action.timing === "F" && classical) {
      charge(meter, 12, "$.work.feature.projection.FBinding");
      if (classical.action.from === action.from || classical.effectiveFrom === action.from) {
        const ownActor = classical.actorToken ? before.units.get(classical.actorToken) : null;
        charge(meter, 4, "$.work.feature.projection.FActorPosition");
        if (ownActor) effectiveFrom = ownActor.square;
      }
      if (action.kind === "stimStep") {
        charge(meter, 20, "$.work.feature.projection.nativeFStep");
        effectiveTo = marineSingleTarget(effectiveFrom, action.color);
      }
    }
    const actor = unitAt(before, effectiveFrom, meter);
    charge(meter, 8, "$.work.feature.projection.actionMasks");
    let childToken: string | null = null;
    const move = (to: Square): void => {
      if (!actor) return;
      charge(meter, 8, "$.work.feature.projection.moveChecks");
      if (before.at.has(to) && before.at.get(to) !== actor.token) return;
      removeUnit(after, actor, meter);
      // WHAT: nine-field copy/replacement plus type/mode/nominal comparisons.
      charge(meter, 9 * 4 + 32, "$.work.feature.projection.moveRecord");
      const type = actor.type === "p" && to[1] === (actor.color === "w" ? "8" : "1") && action.promotion ? action.promotion : actor.type;
      putUnit(after, { ...actor, square: to, type, mode: type === "r" ? actor.type === "r" ? actor.mode : "tank" : null,
        nominal: actor.nominal || to !== actor.square || type !== actor.type || unknownRewrite }, meter);
    };
    if (actor) {
      charge(meter, 32, "$.work.feature.projection.effectDispatch");
      switch (action.kind) {
        case "classical":
          if (effectiveTo && !(actor.type === "r" && actor.mode === "siege") && enemies.get(effectiveTo)?.type !== "k") move(effectiveTo);
          break;
        case "stimStep":
          if (actor.type === "p" && effectiveTo && !enemies.has(effectiveTo)) move(effectiveTo);
          break;
        case "tacticalJump":
          if (actor.type === "q" && effectiveTo && !enemies.has(effectiveTo)) move(effectiveTo);
          break;
        case "deploy":
          if (actor.type === "k" && effectiveTo && action.unit) {
            const victim = unitAt(before, effectiveTo, meter);
            charge(meter, 6, "$.work.feature.projection.deployChecks");
            if (victim?.type === "k" || enemies.get(effectiveTo)?.type === "k") break;
            if (victim) {
              removeUnit(after, victim, meter);
              charge(meter, 4, "$.work.feature.projection.crushDedup");
              if (victim.baseline) crushed.add(victim.token);
            }
            charge(meter, 9 * 3 + 12, "$.work.feature.projection.childAllocate");
            childToken = `birth:${action.seq}`;
            putUnit(after, { token: childToken, square: effectiveTo, type: action.unit, color: action.color,
              paidBasis: 0, baseline: false, mode: action.unit === "r" ? "tank" : null, nominal: true }, meter);
          }
          break;
        case "siegeMode":
          if (actor.type === "r") {
            charge(meter, 9 * 3 + 8, "$.work.feature.projection.modeRecord");
            putUnit(after, { ...actor, mode: actor.mode === "siege" ? "tank" : "siege" }, meter);
          }
          break;
        case "spiderMine":
          charge(meter, 4, "$.work.feature.projection.mineAdd");
          (after.mines as Set<Square>).add(effectiveFrom);
          break;
        case "charonMissiles": break;
      }
    }
    charge(meter, 12 * 3 + 16, "$.work.feature.projection.checkpointRecord");
    const checkpoint: ActionCheckpoint = { index: action.seq, action: candidate.actions[action.seq], before, after,
      actorToken: actor?.token ?? null, actorBefore: actor, actorAfter: actor ? after.units.get(actor.token) ?? null : null,
      effectiveFrom, effectiveTo, unknownRewrite, childToken };
    positions[action.seq] = checkpoint;
    if (action.timing === "C") classical = checkpoint;
    view = after;
  }
  charge(meter, 12 + 3 * schedule.length, "$.work.feature.projection.result");
  return { layers, baseline, final: view, positions, schedule: schedule.map(a => a.seq), crushed };
};
