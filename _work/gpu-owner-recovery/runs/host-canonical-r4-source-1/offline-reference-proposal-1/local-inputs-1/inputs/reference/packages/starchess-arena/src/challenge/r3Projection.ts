// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml, _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import {
  getSideVision, placementToMap, specialGasCost, UNIT_COST,
  type EngineEntity, type EngineProvenance, type ProvenanceCompanion, type ScFenSnapshot,
  type ScPiece, type TrustedEffectFrame,
} from "@chess-coach/starchess-core";
import { validateBoundaryBatch } from "../authorized/v2/batch";
import { advanceHistory, reconcileBoundary } from "../authorized/v2/reducer";
import { equal, fail, freeze, replacement, SQUARES } from "../authorized/v2/schema";
import type {
  AuthorizedBoundaryBatch, AuthorizedEvent, AuthorizedHistory, BoundaryPhase, EconomicState,
  ObservedCell, OwnMineLineage, OwnUnitLineage, PaidReceipt, ReconciledBoundaryState, Side, Sighting, Square,
} from "../authorized/v2/types";
import type { Bank } from "../run/bank";
import type { StagedQueue } from "./admission";

type Image = TrustedEffectFrame["before"];
type Effect = TrustedEffectFrame["effects"][number];
type EventInput = AuthorizedEvent extends infer E ? E extends AuthorizedEvent ? Omit<E, "seq"> : never : never;
const sideValue = <T>(values: Readonly<{ w: T; b: T }>, side: Side): T => side === "w" ? values.w : values.b;
export type R3Recipient = Readonly<{
  batch: AuthorizedBoundaryBatch; boundary: ReconciledBoundaryState; history: AuthorizedHistory;
}>;
export type R3RecipientPrivate = {
  lineage: Map<string, string>; witnessed: Map<string, string>;
  unitCounter: number; mineCounter: number; witnessCounter: number;
};
export const newRecipientPrivate = (): R3RecipientPrivate => ({
  lineage: new Map(), witnessed: new Map(), unitCounter: 0, mineCounter: 0, witnessCounter: 0,
});
export const copyRecipientPrivate = (state: R3RecipientPrivate): R3RecipientPrivate => ({
  ...state, lineage: new Map(state.lineage), witnessed: new Map(state.witnessed),
});

export const projectR3Cells = (image: Image, side: Side): readonly ObservedCell[] => {
  const board = new Map<Square, ScPiece>();
  const sieged = new Set<Square>();
  const entities = new Map(image.entities.map(entity => [entity.id, entity]));
  for (const entity of image.entities) {
    if (entity.kind !== "unit") continue;
    if (board.has(entity.square)) fail("$.image.entities", "PROVENANCE");
    board.set(entity.square, { type: entity.type, color: entity.side });
    if (entity.tankMode === "siege") sieged.add(entity.square);
  }
  const mines = image.nativeMineOrder.map(id => {
    const entity = entities.get(id);
    if (!entity || entity.kind !== "mine") return fail("$.image.nativeMineOrder", "PROVENANCE");
    return { color: entity.side, at: entity.square };
  });
  const vision = getSideVision(board, side, { tankModeFor: square => sieged.has(square) ? "siege" : "tank", mines });
  return SQUARES.map(square => {
    const piece = board.get(square);
    if (vision.litSquares.has(square) || piece?.color === side) return { square, visibility: "lit", piece: piece ? { ...piece } : null };
    if (vision.revealedPieces.has(square) && piece) return { square, visibility: "revealed", piece: { ...piece } };
    return { square, visibility: "unknown" };
  });
};

export const reconcileR3NativeImage = (snapshot: ScFenSnapshot, image: Image): void => {
  const board = placementToMap(snapshot.placement);
  const units = image.entities.filter(entity => entity.kind === "unit");
  if (units.length !== board.size || !equal(snapshot.ccLives, image.ccLives)) fail("$.provenance", "PROVENANCE");
  const sieged = new Set(snapshot.siegedTanks ?? []);
  for (const entity of units) {
    const piece = board.get(entity.square);
    if (!piece || piece.color !== entity.side || piece.type !== entity.type ||
      entity.tankMode !== (entity.type === "r" ? sieged.has(entity.square) ? "siege" : "tank" : null)) fail("$.provenance.entities", "PROVENANCE");
  }
  const mines = new Map(image.entities.filter(entity => entity.kind === "mine").map(entity => [entity.id, entity]));
  if (mines.size !== image.nativeMineOrder.length || new Set(image.nativeMineOrder).size !== mines.size ||
    !equal(image.nativeMineOrder.map(id => {
      const entity = mines.get(id) ?? fail("$.provenance.nativeMineOrder", "PROVENANCE");
      return { color: entity.side, at: entity.square };
    }), snapshot.mines ?? [])) fail("$.provenance.nativeMineOrder", "PROVENANCE");
};

export const projectR3Boundary = (input: {
  side: Side; phase: BoundaryPhase; planningOrdinal: number; snapshot: ScFenSnapshot; bank: Bank;
  provenance: EngineProvenance; companion: ProvenanceCompanion<unknown> | null;
  previous: R3Recipient | null; privateState: R3RecipientPrivate;
  ownStage: StagedQueue | null; committedBank: Bank | null;
}): R3Recipient => {
  const { side, phase, snapshot, bank, provenance, companion, previous, privateState, planningOrdinal } = input;
  const prior = previous?.boundary;
  const units = new Map<string, OwnUnitLineage>((prior?.snapshot.ownUnitLineage ?? []).map(unit => [unit.id, { ...unit }]));
  const mines = new Map<string, OwnMineLineage>((prior?.snapshot.ownMineLineage ?? []).map(mine => [mine.mineId, { ...mine }]));
  const receipts = new Map<string, PaidReceipt>((prior?.economicState.receipts ?? []).map(receipt => [receipt.receiptId, receipt]));
  const pending = new Map<string, Extract<EventInput, { kind: "own-paid-receipt" }>>();
  const retired = new Set(prior?.economicState.retiredOwnIds ?? []);
  const memory = new Map<Square, Sighting>((prior?.snapshot.memory ?? []).map(sighting => [sighting.square, sighting]));
  const projection = new Map<Square, ObservedCell>((prior?.snapshot.cells ?? []).map(cell => [cell.square, cell]));
  const events: AuthorizedEvent[] = [];
  const seqBefore = prior?.seqThrough ?? 0;
  let debits = prior?.economicState.ownPaidDebits ?? 0;
  let destroyed = prior?.economicState.ownPaidDestroyed ?? 0;
  let wasted = prior?.economicState.ownPaidWasted ?? 0;
  let replacementDestroyed = prior?.economicState.ownReplacementDestroyed ?? 0;
  let lossCount = prior?.economicState.enemyLoss.confirmedUnitCount ?? 0;
  let lossReplacement = prior?.economicState.enemyLoss.replacementLowerBound ?? 0;
  const live = (id: string): OwnUnitLineage => units.get(id) ?? fail("$.lineage", "IDENTITY");
  const publicId = (id: string): string => privateState.lineage.get(id) ?? fail("$.lineage", "PROVENANCE");
  const fold = (cells: readonly ObservedCell[], turn: number): void => {
    for (const cell of cells) {
      if (cell.visibility === "unknown") continue;
      if (cell.piece && cell.piece.color !== side) memory.set(cell.square, { square: cell.square, piece: { ...cell.piece }, observedTurn: turn });
      else memory.delete(cell.square);
    }
  };
  const emit = (event: EventInput): void => {
    if (events.length >= 2048) fail("$.events", "CARDINALITY");
    events.push({ ...event, seq: seqBefore + events.length + 1 } as AuthorizedEvent);
    switch (event.kind) {
      case "own-unit-endowed": units.set(event.id, { id: event.id, square: event.square, type: event.type, paidBasis: 0, replacementValue: replacement(event.type) }); break;
      case "own-mine-endowed": case "own-mine-created": mines.set(event.mineId, { mineId: event.mineId, square: event.square }); break;
      case "own-mine-removed": if (!mines.delete(event.mineId)) fail("$.mines", "IDENTITY"); break;
      case "own-paid-receipt": pending.set(event.receiptId, event); debits += event.minerals; break;
      case "own-unit-created": {
        const receipt = pending.get(event.receiptId) ?? fail("$.receipt", "IDENTITY");
        const { kind: _kind, ...payment } = receipt;
        receipts.set(event.receiptId, { ...payment, disposition: { kind: "materialized", lineageId: event.lineageId } });
        pending.delete(event.receiptId);
        units.set(event.lineageId, { id: event.lineageId, square: event.square, type: event.type, paidBasis: receipt.minerals, replacementValue: replacement(event.type) });
        break;
      }
      case "own-deployment-unmaterialized": {
        const receipt = pending.get(event.receiptId) ?? fail("$.receipt", "IDENTITY");
        const { kind: _kind, ...payment } = receipt;
        receipts.set(event.receiptId, { ...payment, disposition: { kind: "unmaterialized" } });
        pending.delete(event.receiptId); wasted += receipt.minerals; break;
      }
      case "own-unit-moved": units.set(event.id, { ...live(event.id), square: event.to }); break;
      case "own-unit-transformed": units.set(event.id, { ...live(event.id), type: event.toType, replacementValue: replacement(event.toType) }); break;
      case "own-unit-destroyed": destroyed += live(event.id).paidBasis; replacementDestroyed += replacement(event.typeAtLoss); units.delete(event.id); retired.add(event.id); break;
      case "enemy-unit-destruction-witnessed": lossCount++; lossReplacement += event.replacementLowerBound; if (memory.get(event.square)?.piece.type === event.type) memory.delete(event.square); break;
      case "vision-witness": event.changes.forEach(cell => projection.set(cell.square, cell)); fold(event.changes, event.turn); break;
    }
  };
  const delta = (cells: readonly ObservedCell[], turn: number): void => {
    const changes = cells.filter(cell => !equal(cell, projection.get(cell.square)));
    if (changes.length) emit({ kind: "vision-witness", turn, changes });
  };
  if (phase === "initial") {
    for (const kind of ["unit", "mine"] as const) {
      const own = provenance.entities.filter(entity => entity.side === side && entity.kind === kind).sort((a, b) => a.square < b.square ? -1 : a.square > b.square ? 1 : 0);
      for (const entity of own) {
        const id = `${side}:${kind}:opening:${entity.square}`;
        privateState.lineage.set(entity.id, id);
        if (entity.kind === "unit") emit({ kind: "own-unit-endowed", id, square: entity.square, type: entity.type, paidBasis: 0 });
        else emit({ kind: "own-mine-endowed", mineId: id, actionRef: null, square: entity.square });
      }
    }
  }
  const binding = (seq: number | null) => {
    const resolved = provenance.resolvedActions.find(action => action.sourceActionSeq === seq);
    if (!resolved || resolved.side !== side || resolved.actionRef.planningOrdinal !== planningOrdinal - 1) return fail("$.actionBindings", "PROVENANCE");
    return resolved.actionRef;
  };
  const receiptFor = (seq: number | null) => {
    const ref = binding(seq);
    const action = input.ownStage?.intents[ref.acceptedActionOrdinal];
    if (!action || action.kind !== "deploy") return fail("$.deployment", "PROVENANCE");
    const id = `${side}:receipt:${ref.planningOrdinal}:${ref.acceptedActionOrdinal}`;
    if (!pending.has(id)) return fail("$.deployment", "PROVENANCE");
    return id;
  };
  if (phase === "settled") {
    if (!input.ownStage || !input.committedBank || !prior) return fail("$.staging", "PROTOCOL");
    let spend = 0, gas = 0;
    input.ownStage.intents.forEach((action, acceptedActionOrdinal) => {
      const actionRef = { planningOrdinal: planningOrdinal - 1, acceptedActionOrdinal };
      if (action.kind === "deploy") {
        if (!action.unit || !action.to) return fail("$.staging", "PROVENANCE");
        spend += UNIT_COST[action.unit];
        emit({ kind: "own-paid-receipt", receiptId: `${side}:receipt:${planningOrdinal - 1}:${acceptedActionOrdinal}`, actionRef, unit: action.unit, requestedSquare: action.to, minerals: UNIT_COST[action.unit] });
      }
      if (action.kind !== "classical") {
        const cost = specialGasCost(action.kind); gas += cost;
        emit({ kind: "own-gas-debited", actionRef, gas: cost });
      }
    });
    if (spend !== input.ownStage.spend || prior.snapshot.own.minerals - spend !== sideValue(input.committedBank, side) ||
      prior.snapshot.own.gas - gas !== input.ownStage.gasAfter) fail("$.staging", "CONSERVATION");
  }
  const effectEvent = (effect: Effect, frame: TrustedEffectFrame): EventInput | null => {
    switch (effect.kind) {
      case "unit-create": {
        if (effect.entity.side !== side) return null;
        if (effect.entity.type === "k") return fail("$.creation", "PROVENANCE");
        return { kind: "own-unit-created", lineageId: publicId(effect.entity.id), receiptId: receiptFor(effect.sourceActionSeq), square: effect.entity.square, type: effect.entity.type };
      }
      case "unit-destroy": {
        if (effect.entity.side !== side || effect.entity.type === "k") return null;
        const id = publicId(effect.entity.id);
        return { kind: "own-unit-destroyed", id, square: effect.entity.square, typeAtLoss: effect.entity.type, retiredPaidBasis: live(id).paidBasis };
      }
      case "unit-move": case "unit-transform": case "tank-mode-change": {
        const entity = frame.before.entities.find(entity => entity.id === effect.entityId);
        if (!entity || entity.kind !== "unit") return fail("$.effect", "PROVENANCE");
        if (entity.side !== side) return null;
        const id = publicId(entity.id);
        if (effect.kind === "unit-move") return { kind: "own-unit-moved", id, from: effect.from, to: effect.to };
        if (effect.kind === "unit-transform") {
          if (effect.toType === "k") return fail("$.effect", "PROVENANCE");
          return { kind: "own-unit-transformed", id, fromType: effect.fromType, toType: effect.toType, paidDelta: 0 };
        }
        return { kind: "own-unit-mode-changed", id, mode: effect.after };
      }
      case "mine-create": return effect.entity.side === side ? { kind: "own-mine-created", mineId: publicId(effect.entity.id), actionRef: binding(effect.sourceActionSeq), square: effect.entity.square } : null;
      case "mine-remove": {
        const entity = frame.before.entities.find(entity => entity.id === effect.entityId);
        if (!entity || entity.kind !== "mine") return fail("$.effect", "PROVENANCE");
        return entity.side === side ? { kind: "own-mine-removed", mineId: publicId(entity.id) } : null;
      }
      default: return null;
    }
  };
  if (companion) {
    if (companion.visibilityImages.length !== companion.frames.length * 2 || companion.visibilityCheckpoints.length !== companion.visibilityImages.length) fail("$.companion", "PROVENANCE");
    for (const [index, frame] of companion.frames.entries()) {
      const before = companion.visibilityImages[2 * index]!, after = companion.visibilityImages[2 * index + 1]!;
      const pre = companion.visibilityCheckpoints[2 * index]!, post = companion.visibilityCheckpoints[2 * index + 1]!;
      if (before.key !== frame.beforeVisibilityKey || after.key !== frame.afterVisibilityKey || !equal(before.state, frame.before) || !equal(after.state, frame.after) ||
        pre.point !== "before-frame" || post.point !== "after-frame" || pre.imageKey !== before.key || post.imageKey !== after.key ||
        pre.frameKey !== frame.sourceEffectKey || post.frameKey !== frame.sourceEffectKey || pre.ordinal !== 2 * index || post.ordinal !== 2 * index + 1) fail("$.checkpoints", "PROVENANCE");
      const beforeCells = projectR3Cells(before.state, side);
      delta(beforeCells, before.turn);
      const facts = provenance.lastCall.consumedFacts.filter(proof => proof.frameKey === frame.sourceEffectKey && proof.side === side);
      for (const proof of facts) delta([proof.targetCell], proof.turn);
      const births = frame.effects.flatMap(effect => effect.kind === "unit-create" || effect.kind === "mine-create" ? [effect.entity] : [])
        .filter(entity => entity.side === side).sort((a, b) => Number(a.id.split(":")[2]) - Number(b.id.split(":")[2]));
      for (const entity of births) {
        if (privateState.lineage.has(entity.id)) fail("$.creation", "IDENTITY");
        const counter = entity.kind === "unit" ? ++privateState.unitCounter : ++privateState.mineCounter;
        privateState.lineage.set(entity.id, `${side}:${entity.kind}:created:${counter}`);
      }
      const blocks = new Map<string, Effect[]>();
      for (const effect of frame.effects) {
        const id = "entity" in effect ? effect.entity.id : "entityId" in effect ? effect.entityId : null;
        if (!id || !privateState.lineage.has(id)) continue;
        const key = publicId(id);
        blocks.set(key, [...(blocks.get(key) ?? []), effect]);
      }
      for (const id of [...blocks.keys()].sort()) {
        for (const effect of blocks.get(id)!) {
          const event = effectEvent(effect, frame);
          if (event) emit(event);
        }
      }
      for (const effect of frame.effects) if (effect.kind === "cc-lives-change" && effect.side === side) emit({ kind: "own-cc-lives-changed", before: effect.before, after: effect.after });
      const dispositions = frame.effects.filter(effect => effect.kind === "deployment-disposition" && effect.materializedEntityId === null &&
        provenance.resolvedActions.find(action => action.sourceActionSeq === effect.sourceActionSeq)?.side === side)
        .sort((a, b) => binding(a.sourceActionSeq).acceptedActionOrdinal - binding(b.sourceActionSeq).acceptedActionOrdinal);
      for (const effect of dispositions) {
        const receiptId = receiptFor(effect.sourceActionSeq);
        emit({ kind: "own-deployment-unmaterialized", receiptId, paidMinerals: pending.get(receiptId)!.minerals });
      }
      const enemies = frame.effects.filter((effect): effect is Extract<Effect, { kind: "unit-destroy" }> => effect.kind === "unit-destroy" && effect.entity.side !== side && effect.entity.type !== "k")
        .sort((a, b) => a.entity.square < b.entity.square ? -1 : a.entity.square > b.entity.square ? 1 : a.entity.type < b.entity.type ? -1 : a.entity.type > b.entity.type ? 1 : 0);
      for (const effect of enemies) {
        if (effect.causalBeforeVisibilityKey !== before.key || !frame.before.entities.some(entity => equal(entity, effect.entity))) fail("$.destruction", "PROVENANCE");
        const cell = beforeCells.find(cell => cell.square === effect.entity.square)!;
        const geometric = cell.visibility !== "unknown" && cell.piece?.type === effect.entity.type && cell.piece.color === effect.entity.side;
        const consumed = facts.some(proof => proof.operation === "capture" && proof.appliedTargetId === effect.entity.id && proof.causalBeforeVisibilityKey === before.key &&
          proof.targetCell.square === effect.entity.square && proof.targetCell.piece.type === effect.entity.type && proof.targetCell.piece.color === effect.entity.side);
        if ((!geometric && !consumed) || privateState.witnessed.has(effect.entity.id)) continue;
        if (effect.entity.type === "k") return fail("$.destruction", "PROVENANCE");
        const witnessId = `${side}:witness:${++privateState.witnessCounter}`;
        privateState.witnessed.set(effect.entity.id, witnessId);
        emit({ kind: "enemy-unit-destruction-witnessed", witnessId, square: effect.entity.square, type: effect.entity.type, replacementLowerBound: UNIT_COST[effect.entity.type], paidLowerBound: 0 });
      }
      delta(projectR3Cells(after.state, side), after.turn);
    }
  }
  if (phase === "settled") emit({ kind: "own-income", actualCreditedMinerals: sideValue(bank, side) - sideValue(input.committedBank!, side) });
  if (pending.size) fail("$.receipts", "CONSERVATION");
  const cells = projectR3Cells(provenance, side);
  fold(cells, snapshot.turn);
  const ownUnitLineage = [...units.values()].sort((a, b) => a.square < b.square ? -1 : a.square > b.square ? 1 : 0);
  const ownMineLineage = [...mines.values()].sort((a, b) => `${a.square}:${a.mineId}` < `${b.square}:${b.mineId}` ? -1 : 1);
  const actualUnits = provenance.entities.filter((entity): entity is Extract<EngineEntity, { kind: "unit" }> => entity.kind === "unit" && entity.side === side);
  const actualMines = provenance.entities.filter(entity => entity.kind === "mine" && entity.side === side);
  if (actualUnits.length !== units.size || actualMines.length !== mines.size || actualUnits.some(entity => {
    const unit = units.get(publicId(entity.id)); return !unit || unit.square !== entity.square || unit.type !== entity.type;
  }) || actualMines.some(entity => mines.get(publicId(entity.id))?.square !== entity.square)) fail("$.lineage", "PROVENANCE");
  const economicState: EconomicState = {
    version: "challenge-economic-ledger-v1", side, ownPaidDebits: debits,
    ownPaidSurviving: ownUnitLineage.reduce((sum, unit) => sum + unit.paidBasis, 0),
    ownPaidDestroyed: destroyed, ownPaidWasted: wasted, ownReplacementDestroyed: replacementDestroyed,
    enemyLoss: { confirmedUnitCount: lossCount, replacementLowerBound: lossReplacement, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" },
    receipts: [...receipts.values()].sort((a, b) => a.receiptId < b.receiptId ? -1 : 1), retiredOwnIds: [...retired].sort(),
  };
  const batch = validateBoundaryBatch({
    version: "challenge-boundary-batch-v1", side, ordinal: prior ? prior.ordinal + 1 : 0, phase,
    turn: snapshot.turn, planningOrdinal, seqBefore, seqThrough: seqBefore + events.length, events,
    snapshot: {
      version: "challenge-observation-v2", side, turn: snapshot.turn,
      own: {
        minerals: sideValue(bank, side), gas: sideValue(snapshot.gas, side), gasIncome: sideValue(snapshot.gasIncome, side), ccLives: sideValue(snapshot.ccLives, side),
        pieces: ownUnitLineage.map(unit => ({ square: unit.square, piece: { type: unit.type, color: side } })),
        mines: [...new Set(ownMineLineage.map(mine => mine.square))].sort(),
        siegedTanks: actualUnits.filter(entity => entity.kind === "unit" && entity.tankMode === "siege").map(entity => entity.square).sort(),
      },
      cells, memory: [...memory.values()].sort((a, b) => a.square < b.square ? -1 : 1), ownUnitLineage, ownMineLineage, economicState,
    },
  });
  const boundary = reconcileBoundary(prior ?? null, batch);
  const history = advanceHistory(previous?.history ?? null, boundary);
  if (history.currentAuthorizedSnapshotV2.ownMineLineage.length !== boundary.ownMineAuditState.liveOwnMines.length) fail("$.ownMineLineage", "CONSISTENCY");
  return freeze({ batch, boundary, history });
};
