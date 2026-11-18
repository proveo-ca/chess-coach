// SPEC: _spec/packages/starchess-core/resolve.puml, _spec/packages/starchess-core/resolve-turn-activity.puml, _spec/packages/starchess-core/submit-turn-activity.puml
import type { Square } from "chess.js";
import type { ScPiece } from "../board/placement";
import type { MineContact } from "../board/mine-contact";
import type { ScMine, StarChessColor, StarChessPiece, TankMode } from "../model/types";
import type {
  ActionBindings, ConsumedTargetProof, Effect, EngineEntity, EngineProvenance,
  FrameImage, FramePhase, MineId, PathQueryRecord, TrustedEffectFrame,
  UnitEngineEntity, UnitId, VisibilityCheckpoint, VisibilityImage,
} from "./provenance-types";
import { fail, freezeDetached, validateImage } from "./provenance-validation";

type MutableQuery = { -readonly [K in keyof PathQueryRecord]: PathQueryRecord[K] };

export class ProvenanceRecorder {
  readonly input: EngineProvenance;
  readonly bindings: ActionBindings;
  readonly frames: TrustedEffectFrame[] = [];
  readonly visibilityImages: VisibilityImage[] = [];
  readonly visibilityCheckpoints: VisibilityCheckpoint[] = [];
  readonly queries: MutableQuery[] = [];
  readonly consumedFacts: ConsumedTargetProof[] = [];
  readonly actors = new Map<number, UnitId | null>();
  readonly carriers = new WeakMap<ScPiece, UnitId>();
  readonly entities = new Map<string, EngineEntity>();
  readonly ccLives: Record<StarChessColor, number>;
  nativeMineOrder: MineId[];
  unitCounter: number;
  mineCounter: number;
  modeAt: (square: Square) => TankMode = () => "tank";
  private effects: Effect[] | null = null;
  private beforeKey = "";

  constructor(input: EngineProvenance, bindings: ActionBindings = []) {
    this.input = input;
    this.bindings = bindings;
    for (const entity of input.entities) this.entities.set(entity.id, { ...entity });
    this.ccLives = { ...input.ccLives };
    this.nativeMineOrder = [...input.nativeMineOrder];
    this.unitCounter = input.unitCounter;
    this.mineCounter = input.mineCounter;
  }

  image(): FrameImage {
    return freezeDetached({
      entities: [...this.entities.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      ccLives: this.ccLives, nativeMineOrder: this.nativeMineOrder,
    });
  }

  board(map: ReadonlyMap<Square, ScPiece>, base: FrameImage = this.image()): void {
    const units = new Map(base.entities.filter((e): e is UnitEngineEntity => e.kind === "unit").map(e => [e.square, e]));
    for (const [square, piece] of map) {
      const entity = units.get(square);
      if (!entity || entity.side !== piece.color || entity.type !== piece.type) fail("$.carrier", "PROVENANCE");
      this.carriers.set(piece, entity.id);
    }
  }

  id(piece: ScPiece): UnitId {
    const id = this.carriers.get(piece);
    if (!id) fail("$.carrier", "IDENTITY");
    return id;
  }

  bind(seq: number | null, piece: ScPiece | undefined): void {
    if (seq !== null) this.actors.set(seq, piece ? this.id(piece) : null);
  }

  frame(phase: FramePhase, mutate: () => void): TrustedEffectFrame | null {
    if (this.effects) fail("$.frames", "PROVENANCE");
    const before = this.image();
    const ordinal = this.frames.length;
    const call = this.input.callOrdinal + 1;
    const sourceEffectKey = `engine:call:${call}:frame:${ordinal}`;
    const beforeVisibilityKey = `engine:call:${call}:image:${this.visibilityImages.length}`;
    const afterVisibilityKey = `engine:call:${call}:image:${this.visibilityImages.length + 1}`;
    this.beforeKey = beforeVisibilityKey;
    this.effects = [];
    mutate();
    const effects = this.effects;
    this.effects = null;
    if (!effects.length) return null;
    if (ordinal >= 1152 || this.frames.reduce((n, f) => n + f.effects.length, effects.length) > 1152) fail("$.frames", "CARDINALITY");
    const after = this.image();
    validateImage(after, "$.frames.after");
    const effectKey = (e: Effect): string => {
      if (e.kind === "deployment-disposition") return `2:${String(e.sourceActionSeq).padStart(2, "0")}`;
      if (e.kind === "cc-lives-change") return `1:${e.side === "w" ? 0 : 1}`;
      return `0:${"entity" in e ? e.entity.id : e.entityId}`;
    };
    effects.sort((a, b) => effectKey(a) < effectKey(b) ? -1 : effectKey(a) > effectKey(b) ? 1 : 0);
    const frame = freezeDetached({ sourceEffectKey, phase, before, after, effects, beforeVisibilityKey, afterVisibilityKey });
    this.frames.push(frame);
    for (const [state, key, point] of [
      [before, beforeVisibilityKey, "before-frame"], [after, afterVisibilityKey, "after-frame"],
    ] as const) {
      const imageOrdinal = this.visibilityImages.length;
      this.visibilityImages.push(freezeDetached({ key, ordinal: imageOrdinal, turn: this.input.turn, phase, state }));
      this.visibilityCheckpoints.push(freezeDetached({ ordinal: imageOrdinal, imageKey: key, frameKey: sourceEffectKey, point }));
    }
    return frame;
  }

  private emit(effect: Effect): void {
    if (!this.effects) fail("$.effects", "PROVENANCE");
    this.effects.push(effect);
  }

  private unit(piece: ScPiece): UnitEngineEntity {
    const entity = this.entities.get(this.id(piece));
    if (!entity || entity.kind !== "unit") fail("$.entity", "IDENTITY");
    return entity;
  }

  destroy(piece: ScPiece, seq: number | null): void {
    const entity = this.unit(piece);
    if (entity.type === "k") fail("$.unit-destroy", "PROVENANCE");
    this.entities.delete(entity.id);
    this.emit({ kind: "unit-destroy", entity, sourceActionSeq: seq, causalBeforeVisibilityKey: this.beforeKey });
  }

  move(piece: ScPiece, from: Square, to: Square, seq: number | null): void {
    const entity = this.unit(piece);
    if (entity.square !== from) fail("$.unit-move.from", "CONSISTENCY");
    if (from === to) return;
    const tankMode = entity.type === "r" ? this.modeAt(to) : null;
    this.entities.set(entity.id, { ...entity, square: to, tankMode });
    this.emit({ kind: "unit-move", entityId: entity.id, from, to, sourceActionSeq: seq });
    if (entity.tankMode !== null && tankMode !== null && entity.tankMode !== tankMode) this.emit({ kind: "tank-mode-change", entityId: entity.id, before: entity.tankMode, after: tankMode, sourceActionSeq: seq });
  }

  create(piece: ScPiece, square: Square, seq: number): UnitId {
    const id: UnitId = `engine:unit:${++this.unitCounter}`;
    const entity: UnitEngineEntity = { id, kind: "unit", side: piece.color, type: piece.type, square, tankMode: piece.type === "r" ? this.modeAt(square) : null };
    this.entities.set(id, entity);
    this.carriers.set(piece, id);
    this.emit({ kind: "unit-create", entity, sourceActionSeq: seq });
    return id;
  }

  transform(piece: ScPiece, type: StarChessPiece, seq: number | null): void {
    const entity = this.unit(piece);
    if (entity.type === type) return;
    this.entities.set(entity.id, { ...entity, type, tankMode: type === "r" ? this.modeAt(entity.square) : null });
    this.emit({ kind: "unit-transform", entityId: entity.id, fromType: entity.type, toType: type, sourceActionSeq: seq });
  }

  mode(piece: ScPiece, mode: TankMode, seq: number): void {
    const entity = this.unit(piece);
    if (entity.type !== "r" || entity.tankMode === null) fail("$.tank-mode", "PROVENANCE");
    if (entity.tankMode === mode) return;
    this.entities.set(entity.id, { ...entity, tankMode: mode });
    this.emit({ kind: "tank-mode-change", entityId: entity.id, before: entity.tankMode, after: mode, sourceActionSeq: seq });
  }

  mineCreate(mine: ScMine, seq: number): void {
    const id: MineId = `engine:mine:${++this.mineCounter}`;
    const entity = { id, kind: "mine" as const, side: mine.color, square: mine.at };
    this.entities.set(id, entity);
    this.nativeMineOrder.push(id);
    this.emit({ kind: "mine-create", entity, sourceActionSeq: seq });
  }

  mineIdsAt(at: Square): MineId[] {
    return this.nativeMineOrder.filter(id => this.entities.get(id)?.square === at);
  }

  mineRemovalIds(mines: readonly ScMine[], hit: MineContact, order: readonly MineId[] = this.nativeMineOrder): MineId[] {
    if (mines.length !== order.length) fail("$.mine-carrier", "CONSISTENCY");
    const spent = hit.kind === "inert" ? null : hit.kind === "detonated" ? hit.chaseFrom ?? hit.at : hit.at;
    const removed: MineId[] = [];
    let selectedColor: StarChessColor | undefined;
    let index = 0;
    for (const mine of mines) {
      const entity = this.entities.get(order[index]!);
      if (!entity || entity.kind !== "mine" || entity.side !== mine.color || entity.square !== mine.at) fail("$.mine-carrier", "CONSISTENCY");
      if (mine.at === spent) {
        selectedColor ??= mine.color;
        removed.push(entity.id);
      }
      index += 1;
    }
    if (hit.kind === "inert") return [];
    if (selectedColor !== hit.mineColor) fail("$.mine-selection", "PROVENANCE");
    return removed;
  }

  mineRemove(ids: readonly MineId[], seq: number | null): void {
    for (const id of ids) {
      if (this.entities.get(id)?.kind !== "mine") fail("$.mine-remove", "IDENTITY");
      this.entities.delete(id);
      this.emit({ kind: "mine-remove", entityId: id, sourceActionSeq: seq });
    }
    this.nativeMineOrder = this.nativeMineOrder.filter(id => !ids.includes(id));
  }

  mineContact(hit: MineContact, seq: number | null, mines: readonly ScMine[]): void {
    if (hit.kind === "inert") return;
    this.mineRemove(this.mineRemovalIds(mines, hit), seq);
  }

  damage(side: StarChessColor, after: number, seq: number | null): void {
    const before = this.ccLives[side];
    if (before === after) return;
    this.ccLives[side] = after;
    this.emit({ kind: "cc-lives-change", side, before, after, sourceActionSeq: seq });
  }

  disposition(seq: number, id: UnitId | null): void {
    this.emit({ kind: "deployment-disposition", materializedEntityId: id, sourceActionSeq: seq });
  }

  query(input: Omit<PathQueryRecord, "evaluatedSteps" | "returnedStep" | "consumption">): { ordinal: number; step: (mid: Square, visible: boolean) => void; returned: (value: number | null) => void } {
    if (this.queries.length >= 4) fail("$.lastCall.queries", "CARDINALITY");
    const steps: { mid: Square; visible: boolean }[] = [];
    const query: MutableQuery = { ...input, evaluatedSteps: steps, returnedStep: null, consumption: "not-deferred" };
    const ordinal = this.queries.length;
    this.queries.push(query);
    return { ordinal, step: (mid, visible) => {
      if (steps.length >= 6) fail("$.query.steps", "CARDINALITY");
      steps.push({ mid, visible });
    }, returned: value => { query.returnedStep = value; } };
  }

  queryAt(ordinal: number): MutableQuery {
    for (const [index, query] of this.queries.entries()) if (index === ordinal) return query;
    return fail("$.lastCall.queries", "PROVENANCE");
  }

  deferred(ordinal: number): void { this.queryAt(ordinal).consumption = "deferred-skipped"; }

  consume(ordinal: number, frame: TrustedEffectFrame | null, actor: ScPiece, target: ScPiece, operation: "capture" | "cc-shot"): void {
    const query = this.queryAt(ordinal);
    if (!query || query.returnedStep === null || !frame || query.consumption !== "deferred-skipped") fail("$.consumedFacts", "PROVENANCE");
    const evaluationActor = query.base.entities.find(e => e.kind === "unit" && e.square === query.from);
    const evaluationTarget = query.base.entities.find(e => e.kind === "unit" && e.square === query.target);
    if (!evaluationActor || evaluationActor.kind !== "unit" || !evaluationTarget || evaluationTarget.kind !== "unit") fail("$.consumedFacts.operands", "IDENTITY");
    if (evaluationTarget.type !== target.type || evaluationTarget.side !== target.color) fail("$.consumedFacts.target", "CONSISTENCY");
    query.consumption = "applied-consumed";
    this.consumedFacts.push({
      queryOrdinal: ordinal, sourceActionSeq: query.sourceActionSeq, side: query.side, operation,
      frameKey: frame.sourceEffectKey, causalBeforeVisibilityKey: frame.beforeVisibilityKey,
      evaluationActorId: evaluationActor.id, evaluationTargetId: evaluationTarget.id,
      appliedActorId: this.id(actor), appliedTargetId: this.id(target), turn: this.input.turn,
      targetCell: { square: query.target, visibility: "lit", piece: { type: target.type, color: target.color } },
    });
  }
}
