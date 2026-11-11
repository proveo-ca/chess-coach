// SPEC: _spec/causal-journal.puml
import { mapToPlacement, placementToMap, sq } from "./board";
import { getSideVision } from "./vision";
import type { MineContact } from "./mine-contact";
import type { ScAction, ScFenSnapshot, ScMine, ScPiece, Square, StarChessColor, TankMode } from "./types";
import type { CausalCell, CausalDiscovery, CausalEffectPayload, CausalEvent, CausalImage, CausalJournalData, CausalMine,
  CausalPhase, CausalState, CausalUnit, DiscoveryInput, EngineMineId, EngineUnitId, MutationSpan, ResolutionEffects } from "./causal-types";

export const MAX_CAUSAL_EVENTS = 4096;
export const MAX_CAUSAL_EFFECTS = 1152;
const sides = ["w", "b"] as const;
const squares = Array.from({ length: 64 }, (_, index) => sq(Math.floor(index / 8), index % 8 + 1)!);
const detached = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function fail(code: string): never { throw new Error(`Causal journal: ${code}`); }
const sameCell = (left: CausalCell, right: CausalCell): boolean => left.visibility === right.visibility &&
  (left.visibility === "unknown" || right.visibility === "unknown" || (left.piece?.type === right.piece?.type && left.piece?.color === right.piece?.color));

export function seedCausalState(snapshot: ScFenSnapshot): CausalState {
  const sieged = new Set(snapshot.siegedTanks ?? []);
  let unitCounter = 0, mineCounter = 0;
  const units: CausalUnit[] = [...placementToMap(snapshot.placement)].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([square, piece]) => ({ kind: "unit", id: `engine:unit:${++unitCounter}`, side: piece.color, type: piece.type,
      square, tankMode: piece.type === "r" ? sieged.has(square) ? "siege" : "tank" : null }));
  const mines: CausalMine[] = (snapshot.mines ?? []).map(mine => ({ kind: "mine", id: `engine:mine:${++mineCounter}`, side: mine.color, square: mine.at }));
  return { version: "chess-coach.causal-state.v1", turn: snapshot.turn, callOrdinal: 0, unitCounter, mineCounter,
    ccLives: { ...snapshot.ccLives }, entities: [...units, ...mines], mineOrder: mines.map(mine => mine.id), nativeSiegedSquares: [...sieged].sort() };
}

type ActiveGroup = { index: number; phase: CausalPhase; before: CausalImage; cells: Record<StarChessColor, CausalCell[]>; effects: CausalEffectPayload[] };

export class CausalJournal implements ResolutionEffects {
  modeAt: (square: Square) => TankMode;
  private readonly entities = new Map<string, CausalUnit | CausalMine>();
  private readonly carriers = new WeakMap<ScPiece, EngineUnitId>();
  private readonly actions = new Map<number, ScAction>();
  private readonly events: CausalEvent[] = [];
  private readonly discoveries: CausalDiscovery[] = [];
  private readonly initialCells: Record<StarChessColor, CausalCell[]>;
  private readonly lives: Record<StarChessColor, number>;
  private readonly turn: number;
  private readonly callOrdinal: number;
  private readonly initialSiegedSquares: readonly Square[];
  private nativeOrder: EngineMineId[];
  private unitCounter: number;
  private mineCounter: number;
  private groupCounter = 0;
  private effectCount = 0;
  private active: ActiveGroup | null = null;
  private failed = false;
  private finished = false;

  constructor(state: CausalState, actions: readonly ScAction[] = []) {
    if (state.version !== "chess-coach.causal-state.v1") fail("VERSION");
    for (const entity of state.entities) {
      if (this.entities.has(entity.id)) fail("DUPLICATE_ID");
      this.entities.set(entity.id, { ...entity });
    }
    for (const action of actions) {
      if (!Number.isSafeInteger(action.seq) || action.seq < 0 || this.actions.has(action.seq)) fail("ACTION_SEQUENCE");
      this.actions.set(action.seq, { ...action });
    }
    this.lives = { ...state.ccLives };
    this.turn = state.turn;
    this.callOrdinal = state.callOrdinal + 1;
    this.unitCounter = state.unitCounter;
    this.mineCounter = state.mineCounter;
    this.nativeOrder = [...state.mineOrder];
    const sieged = new Set(state.nativeSiegedSquares);
    if (sieged.size !== state.nativeSiegedSquares.length || state.nativeSiegedSquares.some(at => !squares.includes(at))) fail("NATIVE_MODES");
    this.initialSiegedSquares = [...sieged].sort();
    this.modeAt = at => sieged.has(at) ? "siege" : "tank";
    this.assertWorld();
    if ([...this.entities.values()].some(entity => entity.kind === "unit" && entity.type === "r" &&
      entity.tankMode !== this.modeAt(entity.square))) fail("NATIVE_MODES");
    this.initialCells = this.project();
  }

  get mineOrder(): readonly EngineMineId[] { this.live(); return [...this.nativeOrder]; }

  capture(): CausalImage {
    this.live();
    return detached({ entities: [...this.entities.values()], ccLives: this.lives, mineOrder: this.nativeOrder });
  }

  bindBoard(board: ReadonlyMap<Square, ScPiece>): void {
    this.live();
    const units = new Map([...this.entities.values()].filter((entity): entity is CausalUnit => entity.kind === "unit").map(entity => [entity.square, entity]));
    if (board.size !== units.size) fail("BOARD_CARDINALITY");
    for (const [at, piece] of board) {
      const entity = units.get(at);
      if (!entity || entity.side !== piece.color || entity.type !== piece.type) fail("BOARD_IDENTITY");
      this.carriers.set(piece, entity.id);
    }
  }

  bindAction(seq: number | null, piece: ScPiece | undefined): void {
    this.live();
    if (seq !== null && !this.actions.has(seq)) fail("UNKNOWN_ACTION");
    if (piece) this.id(piece);
  }

  group(phase: CausalPhase, mutate: () => void): MutationSpan | null {
    this.live();
    if (this.active) fail("NESTED_GROUP");
    const group: ActiveGroup = { index: this.groupCounter, phase, before: this.capture(), cells: this.project(), effects: [] };
    this.active = group;
    try {
      mutate();
      this.assertWorld();
      this.active = null;
      if (!group.effects.length) return null;
      const effectOrdinals: number[] = [];
      for (const effect of group.effects) {
        effectOrdinals.push(this.events.length);
        this.append({ ...effect, ordinal: this.events.length, group: group.index, phase });
      }
      this.effectCount += group.effects.length;
      const after = this.project();
      for (const recipient of sides) {
        const changes = after[recipient].filter((cell, index) => !sameCell(cell, group.cells[recipient][index]!));
        if (changes.length) this.append({ kind: "visibility", recipient, turn: this.turn, changes, ordinal: this.events.length, group: group.index, phase });
      }
      this.groupCounter++;
      return { group: group.index, effectOrdinals };
    } catch (error) {
      this.failed = true;
      this.active = null;
      throw error;
    }
  }

  destroy(piece: ScPiece, actionSeq: number | null): void {
    const entity = this.unit(piece);
    if (entity.type === "k") fail("CC_DESTRUCTION");
    const group = this.active ?? fail("OUTSIDE_GROUP");
    if (!group.before.entities.some(value => value.kind === "unit" && value.id === entity.id && value.square === entity.square &&
      value.type === entity.type && value.side === entity.side)) fail("CAUSAL_PREIMAGE");
    const visibleTo = sides.filter(side => {
      const cell = group.cells[side].find(value => value.square === entity.square)!;
      return cell.visibility !== "unknown" && cell.piece?.type === entity.type && cell.piece.color === entity.side;
    });
    this.entities.delete(entity.id);
    this.emit({ kind: "unit-destroyed", entity: { ...entity }, actionSeq, visibleTo, targets: [] });
  }

  move(piece: ScPiece, from: Square, to: Square, actionSeq: number | null): void {
    const entity = this.unit(piece);
    if (entity.square !== from) fail("MOVE_ORIGIN");
    if (from === to) return;
    const tankMode = entity.type === "r" ? this.modeAt(to) : null;
    this.entities.set(entity.id, { ...entity, square: to, tankMode });
    this.emit({ kind: "unit-moved", entityId: entity.id, from, to, actionSeq });
    if (entity.tankMode !== null && tankMode !== null && entity.tankMode !== tankMode) {
      this.emit({ kind: "tank-mode-changed", entityId: entity.id, before: entity.tankMode, after: tankMode, actionSeq });
    }
  }

  create(piece: ScPiece, square: Square, actionSeq: number): EngineUnitId {
    this.requireGroup();
    const action = this.actions.get(actionSeq);
    if (piece.type === "k" || action?.kind !== "deploy" || action.unit !== piece.type || action.color !== piece.color || action.to !== square) fail("DEPLOYMENT_BINDING");
    const id: EngineUnitId = `engine:unit:${++this.unitCounter}`;
    const entity: CausalUnit = { kind: "unit", id, side: piece.color, type: piece.type, square, tankMode: piece.type === "r" ? this.modeAt(square) : null };
    this.entities.set(id, entity);
    this.carriers.set(piece, id);
    this.emit({ kind: "unit-created", entity: { ...entity }, actionSeq });
    return id;
  }

  transform(piece: ScPiece, type: ScPiece["type"], actionSeq: number | null): void {
    const entity = this.unit(piece);
    if (entity.type === "k" || type === "k") fail("CC_TRANSFORM");
    if (entity.type === type) return;
    this.entities.set(entity.id, { ...entity, type, tankMode: type === "r" ? this.modeAt(entity.square) : null });
    this.emit({ kind: "unit-transformed", entityId: entity.id, fromType: entity.type, toType: type, actionSeq });
  }

  mode(piece: ScPiece, mode: TankMode, actionSeq: number): void {
    const entity = this.unit(piece);
    if (entity.type !== "r" || entity.tankMode === null) fail("TANK_MODE");
    if (entity.tankMode === mode) return;
    this.entities.set(entity.id, { ...entity, tankMode: mode });
    this.emit({ kind: "tank-mode-changed", entityId: entity.id, before: entity.tankMode, after: mode, actionSeq });
  }

  mineCreate(mine: ScMine, actionSeq: number): void {
    this.requireGroup();
    const action = this.actions.get(actionSeq);
    if (action?.kind !== "spiderMine" || action.color !== mine.color) fail("MINE_ACTION");
    const id: EngineMineId = `engine:mine:${++this.mineCounter}`;
    const entity: CausalMine = { kind: "mine", id, side: mine.color, square: mine.at };
    this.entities.set(id, entity);
    this.nativeOrder.push(id);
    this.emit({ kind: "mine-created", entity: { ...entity }, actionSeq });
  }

  mineRemovalIds(mines: readonly ScMine[], hit: MineContact, order: readonly EngineMineId[] = this.nativeOrder): EngineMineId[] {
    this.live();
    if (mines.length !== order.length) fail("MINE_ORDER");
    const spent = hit.kind === "inert" ? null : hit.kind === "detonated" ? hit.chaseFrom ?? hit.at : hit.at;
    const removed: EngineMineId[] = [];
    let selected: StarChessColor | undefined;
    mines.forEach((mine, index) => {
      const entity = this.entities.get(order[index]!);
      if (!entity || entity.kind !== "mine" || entity.side !== mine.color || entity.square !== mine.at) fail("MINE_IDENTITY");
      if (mine.at === spent) { selected ??= mine.color; removed.push(entity.id); }
    });
    if (hit.kind !== "inert" && selected !== hit.mineColor) fail("MINE_SELECTION");
    return removed;
  }

  mineRemove(ids: readonly EngineMineId[], actionSeq: number | null): void {
    this.requireGroup();
    for (const id of ids) {
      const entity = this.entities.get(id);
      if (!entity || entity.kind !== "mine") fail("MINE_LIFETIME");
      this.entities.delete(id);
      this.emit({ kind: "mine-removed", entity: { ...entity }, actionSeq });
    }
    this.nativeOrder = this.nativeOrder.filter(id => !ids.includes(id));
  }

  mineContact(hit: MineContact, actionSeq: number | null, mines: readonly ScMine[]): void {
    if (hit.kind !== "inert") this.mineRemove(this.mineRemovalIds(mines, hit), actionSeq);
  }

  damage(side: StarChessColor, after: number, actionSeq: number | null): void {
    this.requireGroup();
    const before = this.lives[side];
    if (!Number.isSafeInteger(after) || after < 0 || after !== Math.max(0, before - 1)) fail("CC_DAMAGE");
    if (before === after) return;
    this.lives[side] = after;
    this.emit({ kind: "cc-damaged", side, before, after, actionSeq, targets: [] });
  }

  disposition(actionSeq: number, unitId: EngineUnitId | null): void {
    this.requireGroup();
    const action = this.actions.get(actionSeq);
    if (action?.kind !== "deploy") fail("DEPLOYMENT_ACTION");
    if (unitId !== null && this.entities.get(unitId)?.kind !== "unit") fail("DEPLOYMENT_ENTITY");
    this.emit({ kind: "deployment-resolved", side: action.color, unitId, actionSeq });
  }

  discovery(input: DiscoveryInput) {
    this.live();
    const action = this.actions.get(input.actionSeq);
    if (this.discoveries.length >= 4 || action?.timing !== "C" || action.color !== input.side) fail("DISCOVERY_BOUND");
    const actor = input.base.entities.find((entity): entity is CausalUnit => entity.kind === "unit" && entity.square === input.from);
    const target = input.base.entities.find((entity): entity is CausalUnit => entity.kind === "unit" && entity.square === input.target);
    if (!actor || !target || actor.side !== input.side) fail("DISCOVERY_OPERANDS");
    const query: CausalDiscovery = { ordinal: this.discoveries.length, actionSeq: input.actionSeq, side: input.side, site: input.site,
      from: input.from, to: input.to, target: input.target, evaluationActorId: actor.id, evaluationTargetId: target.id,
      modeSource: input.modeSource, siegedSquares: [...input.siegedSquares], mineInputProvided: input.mineInputProvided,
      mines: input.mines.map(mine => ({ ...mine })), steps: [], returnedStep: null, deferred: false, applied: null };
    this.discoveries.push(query);
    return { ordinal: query.ordinal, step: (square: Square, visible: boolean): void => {
      this.live();
      if (query.steps.length >= 6) fail("DISCOVERY_STEPS");
      query.steps.push({ square, visible });
    }, returned: (value: number | null): void => { this.live(); query.returnedStep = value; } };
  }

  discoveryAt(ordinal: number): CausalDiscovery { this.live(); return detached(this.discoveries[ordinal] ?? fail("DISCOVERY_ID")); }
  deferred(ordinal: number): void { this.live(); (this.discoveries[ordinal] ?? fail("DISCOVERY_ID")).deferred = true; }

  consume(ordinal: number, span: MutationSpan | null, actor: ScPiece, target: ScPiece, operation: "capture" | "cc-shot"): void {
    this.live();
    const query = this.discoveries[ordinal] ?? fail("DISCOVERY_ID"), actorId = this.id(actor), targetId = this.id(target);
    if (!span || !query.deferred || query.returnedStep === null || query.returnedStep < 1 || query.applied ||
      actor.color !== query.side || target.color === query.side || (operation === "cc-shot") !== (target.type === "k")) fail("NATIVE_CONSUMPTION");
    const effects = span.effectOrdinals.map(index => this.events[index]);
    if (effects.some(event => !event || event.group !== span.group || event.phase !== "C-path" || event.kind === "visibility" || event.actionSeq !== query.actionSeq) ||
      !effects.some(event => event?.kind === "unit-moved" && event.entityId === actorId && event.from === query.from &&
        (operation !== "capture" || event.to === query.target))) fail("CONSUMED_OPERATION");
    const event = span.effectOrdinals.map(index => this.events[index]).find(value => operation === "capture"
      ? value?.kind === "unit-destroyed" && value.entity.id === targetId
      : value?.kind === "cc-damaged" && value.side === target.color);
    if (!event) fail("CONSUMED_EFFECT");
    query.applied = { group: span.group, operation, actorId, targetId };
    if (event.kind === "unit-destroyed" || event.kind === "cc-damaged") {
      const entity = event.kind === "unit-destroyed" ? event.entity : this.entities.get(targetId);
      if (!entity || entity.kind !== "unit" || entity.square !== query.target || entity.type !== target.type || entity.side !== target.color) fail("CONSUMED_TARGET");
      event.targets.push({ discoveryOrdinal: ordinal, recipient: query.side, square: query.target,
        piece: { type: target.type, color: target.color }, evaluationActorId: query.evaluationActorId,
        evaluationTargetId: query.evaluationTargetId, appliedActorId: actorId, appliedTargetId: targetId });
    }
  }

  assertSnapshot(snapshot: ScFenSnapshot): void {
    this.live();
    if (snapshot.turn !== this.turn) fail("SNAPSHOT_TURN");
    if (JSON.stringify([...new Set(snapshot.siegedTanks ?? [])].sort()) !== JSON.stringify(this.initialSiegedSquares)) fail("SNAPSHOT_NATIVE_MODES");
    this.matchesSnapshot(snapshot);
  }

  finish(snapshot: ScFenSnapshot): { state: CausalState; journal: CausalJournalData } {
    this.live();
    try { return this.complete(snapshot); }
    catch (error) { this.failed = true; throw error; }
  }

  private complete(snapshot: ScFenSnapshot): { state: CausalState; journal: CausalJournalData } {
    this.live();
    if (this.active) fail("OPEN_GROUP");
    if (!Number.isSafeInteger(snapshot.turn) || snapshot.turn < this.turn || snapshot.turn > Math.min(45, this.turn + 1)) fail("SUCCESSOR_TURN");
    this.assertWorld();
    this.matchesSnapshot(snapshot);
    for (const action of this.actions.values()) {
      if (action.kind !== "deploy") continue;
      const dispositions = this.events.filter(event => event.kind === "deployment-resolved" && event.actionSeq === action.seq);
      const creations = this.events.filter(event => event.kind === "unit-created" && event.actionSeq === action.seq);
      const disposition = dispositions[0];
      if (dispositions.length !== 1 || disposition?.kind !== "deployment-resolved" || (disposition.unitId === null ? creations.length !== 0
        : creations.length !== 1 || creations[0]?.kind !== "unit-created" || creations[0].entity.id !== disposition.unitId)) fail("DEPLOYMENT_COMPLETENESS");
    }
    const image = this.capture(), finalCells = this.project();
    const state: CausalState = { ...image, version: "chess-coach.causal-state.v1", turn: snapshot.turn, callOrdinal: this.callOrdinal,
      unitCounter: this.unitCounter, mineCounter: this.mineCounter, nativeSiegedSquares: [...new Set(snapshot.siegedTanks ?? [])].sort() };
    const journal: CausalJournalData = { version: "chess-coach.causal-journal.v1", turn: this.turn, callOrdinal: this.callOrdinal,
      initialCells: this.initialCells, finalCells, events: this.events, discoveries: this.discoveries };
    this.finished = true;
    return detached({ state, journal });
  }

  private live(): void { if (this.failed || this.finished) fail("CLOSED"); }
  private requireGroup(): ActiveGroup {
    this.live();
    if (!this.active) { this.failed = true; fail("OUTSIDE_GROUP"); }
    return this.active;
  }
  private id(piece: ScPiece): EngineUnitId { return this.carriers.get(piece) ?? fail("OPERAND_IDENTITY"); }
  private unit(piece: ScPiece): CausalUnit {
    this.requireGroup();
    const entity = this.entities.get(this.id(piece));
    return entity?.kind === "unit" ? entity : fail("UNIT_LIFETIME");
  }
  private emit(effect: CausalEffectPayload): void {
    this.live();
    if (!this.active) fail("OUTSIDE_GROUP");
    if (effect.actionSeq !== null && !this.actions.has(effect.actionSeq)) fail("UNKNOWN_ACTION");
    if (this.effectCount + this.active.effects.length >= MAX_CAUSAL_EFFECTS) fail("EFFECT_BOUND");
    this.active.effects.push(effect);
  }
  private append(event: CausalEvent): void {
    if (this.events.length >= MAX_CAUSAL_EVENTS) fail("EVENT_BOUND");
    this.events.push(event);
  }
  private project(): Record<StarChessColor, CausalCell[]> {
    const units = [...this.entities.values()].filter((entity): entity is CausalUnit => entity.kind === "unit");
    const board = new Map(units.map(unit => [unit.square, { type: unit.type, color: unit.side }]));
    const modes = new Map(units.map(unit => [unit.square, unit.tankMode]));
    const mines = this.nativeOrder.map(id => {
      const mine = this.entities.get(id) as CausalMine;
      return { color: mine.side, at: mine.square };
    });
    const cellsFor = (side: StarChessColor): CausalCell[] => {
      const vision = getSideVision(board, side, { mines, tankModeFor: at => modes.get(at) ?? "tank" });
      return squares.map(square => {
        const piece = board.get(square);
        return vision.litSquares.has(square) ? { square, visibility: "lit", piece: piece ?? null }
          : piece && vision.revealedPieces.has(square) ? { square, visibility: "revealed", piece } : { square, visibility: "unknown" };
      });
    };
    return { w: cellsFor("w"), b: cellsFor("b") };
  }
  private matchesSnapshot(snapshot: ScFenSnapshot): void {
    const units = [...this.entities.values()].filter((entity): entity is CausalUnit => entity.kind === "unit");
    const placement = mapToPlacement(new Map(units.map(unit => [unit.square, { type: unit.type, color: unit.side }])));
    if (placement !== snapshot.placement || this.lives.w !== snapshot.ccLives.w || this.lives.b !== snapshot.ccLives.b) fail("FINAL_WORLD");
    const mines = snapshot.mines ?? [];
    if (mines.length !== this.nativeOrder.length || mines.some((mine, index) => {
      const entity = this.entities.get(this.nativeOrder[index]!);
      return !entity || entity.kind !== "mine" || entity.square !== mine.at || entity.side !== mine.color;
    })) fail("FINAL_MINES");
    const sieged = new Set(snapshot.siegedTanks ?? []);
    if (units.some(unit => unit.type === "r" && unit.tankMode !== (sieged.has(unit.square) ? "siege" : "tank"))) fail("FINAL_MODES");
  }
  private assertWorld(): void {
    if (!Number.isSafeInteger(this.turn) || this.turn < 0 || this.turn > 45 || !Number.isSafeInteger(this.callOrdinal) || this.callOrdinal < 1 || this.callOrdinal > 91 ||
      !Number.isSafeInteger(this.unitCounter) || this.unitCounter < 0 || this.unitCounter > 192 || !Number.isSafeInteger(this.mineCounter) || this.mineCounter < 0 || this.mineCounter > 512) fail("STATE_BOUND");
    const units = [...this.entities.values()].filter((entity): entity is CausalUnit => entity.kind === "unit");
    const mines = [...this.entities.values()].filter((entity): entity is CausalMine => entity.kind === "mine");
    if (units.length > 64 || mines.length > 6 || new Set(units.map(unit => unit.square)).size !== units.length ||
      this.nativeOrder.length !== mines.length || new Set(this.nativeOrder).size !== mines.length || this.nativeOrder.some(id => this.entities.get(id)?.kind !== "mine")) fail("WORLD_CARDINALITY");
    for (const side of sides) {
      if (units.filter(unit => unit.side === side && unit.type === "k").length !== 1 || mines.filter(mine => mine.side === side).length > 3 ||
        !Number.isSafeInteger(this.lives[side]) || this.lives[side] < 0 || this.lives[side] > 3) fail("SIDE_STATE");
    }
    for (const entity of this.entities.values()) {
      const counter = Number(entity.id.split(":")[2]);
      if (!squares.includes(entity.square) || !sides.includes(entity.side) || !Number.isSafeInteger(counter) || counter < 1 ||
        entity.id !== `engine:${entity.kind}:${counter}` || counter > (entity.kind === "unit" ? this.unitCounter : this.mineCounter)) fail("ENTITY_ID");
      if (entity.kind === "unit" && (!["p", "n", "b", "r", "q", "k"].includes(entity.type) ||
        (entity.type === "r" ? entity.tankMode !== "tank" && entity.tankMode !== "siege" : entity.tankMode !== null))) fail("UNIT_STATE");
    }
  }
}
