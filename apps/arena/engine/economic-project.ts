// SPEC: _spec/apps/arena/burn-compat.puml
import {
  getSideVision, placementToMap, type EngineEntity, type EngineProvenance,
  type ProvenanceCompanion, type ScFenSnapshot, type ScPiece, type Square, type TrustedEffectFrame,
} from "@chess-coach/starchess-core";
import {
  ECONOMIC_REPLY_LIMIT, MAX_ECONOMIC_ENTRIES, MAX_ECONOMIC_GROUPS, type AcceptedOwnAction, type ActionRef,
  type AtomicGroup, type EconomicBoundary, type EffectFact, type MineSubject, type OwnGeometry, type TankMode, type UnitSubject,
} from "./economic-wire";
import { EngineErrorV2, parseViewV2, SQUARES_V2, type AuthorizedView, type Cell, type Pair, type Side } from "./wire-v2";

type FrameImage = TrustedEffectFrame["before"];
type Effect = TrustedEffectFrame["effects"][number];
type NativeUnit = Extract<EngineEntity, { kind: "unit" }>;
type UnitEffect = Extract<Effect, { kind: "unit-create" | "unit-move" | "unit-transform" | "unit-destroy" | "tank-mode-change" }>;
type Cursor = { seq: number; ordinal: number; cells: Cell[]; turn: number };
type GroupInput = AtomicGroup extends infer G ? G extends AtomicGroup ? Omit<G, "seq"> : never : never;
export type SettlementFacts = { entitlement: number; credited: number; gasBeforeReset: number; nextGasCapacity: number };
const fault = (message: string): never => { throw new EngineErrorV2("ENGINE_FAILURE", `Economic provenance: ${message}`); };
const limit = (message: string): never => { throw new EngineErrorV2("LIMIT", message); };
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

function nativeUnitMode(type: ScPiece["type"], value: unknown): TankMode | null {
  if (type === "r" && (value === "tank" || value === "siege")) return value;
  if (["p", "n", "b", "q", "k"].includes(type) && value === null) return null;
  return fault("Invalid native unit type/mode");
}

function ownNativeUnit(entity: EngineEntity | undefined, side: Side, id: string): NativeUnit {
  if (!entity || entity.kind !== "unit" || entity.id !== id || entity.side !== side) return fault("Missing or incompatible native unit anchor");
  nativeUnitMode(entity.type, entity.tankMode);
  return entity;
}

function transformedOwnMode(frame: TrustedEffectFrame, effectIndex: number, side: Side, checkTime: () => void): TankMode | null {
  checkTime();
  const event = frame.effects[effectIndex];
  if (!event || event.kind !== "unit-transform") return fault("Missing native transformation effect");
  if (event.toType !== "r") return null;
  let origin: TankMode | undefined;
  let current: TankMode | undefined;
  let retired = false;
  for (let i = effectIndex + 1; i < frame.effects.length; i++) {
    checkTime();
    const next = frame.effects[i]!;
    const id = "entity" in next ? next.entity.id : "entityId" in next ? next.entityId : null;
    if (id !== event.entityId) continue;
    if (retired) return fault("Post-retirement native unit effect");
    if (next.kind === "tank-mode-change") {
      const beforeMode = nativeUnitMode("r", next.before);
      const afterMode = nativeUnitMode("r", next.after);
      if (beforeMode === null || afterMode === null || beforeMode === afterMode || (current !== undefined && current !== beforeMode)) return fault("Contradictory native transformation mode chain");
      origin ??= beforeMode; current = afterMode;
    } else if (next.kind === "unit-destroy") {
      const anchor = ownNativeUnit(next.entity, side, event.entityId);
      if (anchor.type !== "r" || anchor.tankMode === null) return fault("Transformation death anchor type mismatch");
      if (current !== undefined && current !== anchor.tankMode) return fault("Contradictory native transformation death mode");
      origin ??= anchor.tankMode; current = anchor.tankMode; retired = true;
    } else if (next.kind !== "unit-move") return fault("Unprovable compound transformation origin or identity reuse");
  }
  const endpoints: EngineEntity[] = [];
  for (const entity of frame.after.entities) {
    checkTime();
    if (entity.id === event.entityId) endpoints.push(entity);
  }
  if (retired) {
    if (endpoints.length) return fault("Retired native unit survives in terminal image");
  } else {
    if (endpoints.length !== 1) return fault("Missing or ambiguous native transformation terminal anchor");
    const anchor = ownNativeUnit(endpoints[0], side, event.entityId);
    if (anchor.type !== "r" || anchor.tankMode === null) return fault("Transformation terminal anchor type mismatch");
    if (current !== undefined && current !== anchor.tankMode) return fault("Contradictory native transformation terminal mode");
    origin ??= anchor.tankMode;
  }
  if (origin === undefined) return fault("Missing native transformation entry mode");
  checkTime();
  return origin;
}

function frameOriginModes(frame: TrustedEffectFrame, side: Side, checkTime: () => void): Map<UnitEffect, TankMode | null> {
  const before = new Map<string, EngineEntity>(frame.before.entities.map(entity => [entity.id, entity]));
  const after = new Map<string, EngineEntity>(frame.after.entities.map(entity => [entity.id, entity]));
  if (before.size !== frame.before.entities.length || after.size !== frame.after.entities.length) return fault("Duplicate native frame entity");
  const ownIds = new Set<string>();
  const knownUnitIds = new Set<string>(frame.before.entities.filter(entity => entity.kind === "unit").map(entity => entity.id));
  for (const entity of [...frame.before.entities, ...frame.after.entities]) if (entity.kind === "unit" && entity.side === side) ownIds.add(entity.id);
  const byId = new Map<string, { event: UnitEffect; index: number }[]>();
  for (const [index, event] of frame.effects.entries()) {
    checkTime();
    if (event.kind !== "unit-create" && event.kind !== "unit-move" && event.kind !== "unit-transform" && event.kind !== "unit-destroy" && event.kind !== "tank-mode-change") continue;
    const id = "entity" in event ? event.entity.id : event.entityId;
    const events = byId.get(id) ?? [];
    events.push({ event, index }); byId.set(id, events);
    if (event.kind === "unit-create") {
      knownUnitIds.add(event.entity.id);
      if (event.entity.side === side) ownIds.add(id);
    }
  }
  for (const id of byId.keys()) {
    checkTime();
    if (!knownUnitIds.has(id)) return fault("Missing native unit causal preimage");
  }
  const modes = new Map<UnitEffect, TankMode | null>();
  for (const id of ownIds) {
    checkTime();
    const preimage = before.get(id);
    const terminal = after.get(id);
    let current: NativeUnit | null = preimage ? { ...ownNativeUnit(preimage, side, id) } : null;
    let retired = false;
    const events = byId.get(id) ?? [];
    for (const { event, index } of events) {
      checkTime();
      if (retired) return fault("Post-retirement native unit effect");
      if (event.kind === "unit-create") {
        if (current) return fault("Duplicate native unit birth");
        current = { ...ownNativeUnit(event.entity, side, id) };
        if (current.type === "k") return fault("Native command center birth is unsupported");
        modes.set(event, nativeUnitMode(current.type, current.tankMode));
        continue;
      }
      if (!current) return fault("Missing native unit causal preimage");
      switch (event.kind) {
        case "unit-transform": {
          if (current.type !== event.fromType || event.fromType === event.toType || event.fromType === "k" || event.toType === "k" ||
              !["p", "n", "b", "r", "q"].includes(event.toType)) return fault("Incompatible native transformation type");
          const toMode = transformedOwnMode(frame, index, side, checkTime);
          modes.set(event, toMode);
          current = { ...current, type: event.toType, tankMode: toMode };
          break;
        }
        case "unit-move":
          if (current.square !== event.from || event.from === event.to) return fault("Incompatible native unit movement");
          current = { ...current, square: event.to };
          break;
        case "tank-mode-change": {
          const beforeMode = nativeUnitMode("r", event.before);
          const afterMode = nativeUnitMode("r", event.after);
          if (current.type !== "r" || current.tankMode !== beforeMode || beforeMode === afterMode) return fault("Contradictory native unit mode chain");
          current = { ...current, tankMode: afterMode };
          break;
        }
        case "unit-destroy": {
          const anchor = ownNativeUnit(event.entity, side, id);
          if (anchor.type !== current.type || anchor.square !== current.square || anchor.tankMode !== current.tankMode) return fault("Contradictory native unit death anchor");
          current = null; retired = true;
          break;
        }
      }
    }
    if (retired) {
      if (terminal) return fault("Retired native unit survives in terminal image");
    } else {
      const anchor = ownNativeUnit(terminal, side, id);
      if (!current || anchor.type !== current.type || anchor.square !== current.square || anchor.tankMode !== current.tankMode) return fault("Contradictory native unit terminal anchor");
    }
  }
  return modes;
}

function imageInventory(image: FrameImage, side: Side) {
  if (image.entities.length > 70 || image.nativeMineOrder.length > 6) limit("Native image exceeds physical bounds");
  const units = image.entities.filter(e => e.kind === "unit" && e.side === side).sort((a, b) => compare(a.square, b.square));
  const byId = new Map(image.entities.map(e => [e.id, e]));
  const occurrences = new Map<Square, number>();
  const mines = image.nativeMineOrder.flatMap(id => {
    const entity = byId.get(id);
    if (!entity || entity.kind !== "mine") return fault("Missing native mine carrier");
    if (entity.side !== side) return [];
    const slot = occurrences.get(entity.square) ?? 0;
    occurrences.set(entity.square, slot + 1);
    return [{ id, square: entity.square, slot }];
  });
  if (units.length > 64 || mines.length > 3) limit("Own geometry exceeds physical bounds");
  return { units, mines };
}

export function projectOwnGeometry(image: FrameImage, side: Side): OwnGeometry {
  const { units, mines } = imageInventory(image, side);
  return {
    units: units.map(e => {
      if (e.kind !== "unit") return fault("Invalid unit carrier");
      return { square: e.square, type: e.type, mode: nativeUnitMode(e.type, e.tankMode) };
    }),
    mines: mines.map(({ square, slot }) => ({ square, slot })).sort((a, b) => compare(a.square, b.square) || a.slot - b.slot),
    ccLives: image.ccLives[side],
  };
}

function imageCells(image: FrameImage, side: Side): Cell[] {
  const board = new Map<Square, ScPiece>();
  const siege = new Set<Square>();
  for (const e of image.entities) if (e.kind === "unit") {
    board.set(e.square, { color: e.side, type: e.type });
    if (e.tankMode === "siege") siege.add(e.square);
  }
  const byId = new Map(image.entities.map(e => [e.id, e]));
  const mines = image.nativeMineOrder.map(id => {
    const e = byId.get(id);
    if (!e || e.kind !== "mine") return fault("Missing native mine carrier");
    return { at: e.square, color: e.side };
  });
  const vision = getSideVision(board, side, { mines, tankModeFor: at => siege.has(at) ? "siege" : "tank" });
  return SQUARES_V2.map(square => {
    const piece = board.get(square);
    if (vision.litSquares.has(square) || piece?.color === side) return { square, visibility: "lit", piece: piece ? { ...piece } : null };
    if (vision.revealedPieces.has(square) && piece) return { square, visibility: "revealed", piece: { ...piece } };
    return { square, visibility: "unknown" };
  });
}

export function projectNativeView(snapshot: ScFenSnapshot, side: Side): AuthorizedView {
  const board = placementToMap(snapshot.placement);
  const siege = new Set(snapshot.siegedTanks ?? []);
  const vision = getSideVision(board, side, { mines: snapshot.mines ?? [], tankModeFor: at => siege.has(at) ? "siege" : "tank" });
  const pieces: AuthorizedView["own"]["pieces"] = [];
  const cells: Cell[] = SQUARES_V2.map(square => {
    const piece = board.get(square);
    if (piece?.color === side) pieces.push({ square, type: piece.type });
    if (vision.litSquares.has(square) || piece?.color === side) return { square, visibility: "lit", piece: piece ? { ...piece } : null };
    if (vision.revealedPieces.has(square) && piece) return { square, visibility: "revealed", piece: { ...piece } };
    return { square, visibility: "unknown" };
  });
  if (!snapshot.stored) return fault("Missing native bank");
  return parseViewV2({ version: "arena-observation-v2", side, turn: snapshot.turn, own: {
    minerals: snapshot.stored[side], gas: snapshot.gas[side], gasIncome: snapshot.gasIncome[side], ccLives: snapshot.ccLives[side], pieces,
    mines: (snapshot.mines ?? []).filter(m => m.color === side).map(m => m.at).sort(),
    siegedTanks: pieces.filter(p => p.type === "r" && siege.has(p.square)).map(p => p.square),
  }, cells });
}

function ownRef(companion: ProvenanceCompanion<unknown>, side: Side, sequence: number | null): ActionRef | null {
  if (sequence === null) return null;
  const binding = companion.provenance.resolvedActions.find(a => a.sourceActionSeq === sequence);
  return binding?.side === side ? { ...binding.actionRef } : null;
}

function consumedCapture(companion: ProvenanceCompanion<unknown>, frame: TrustedEffectFrame, effect: Effect, side: Side): Cell | null {
  if (effect.kind !== "unit-destroy" || effect.entity.side === side || effect.entity.type === "k") return null;
  const proof = companion.provenance.lastCall.consumedFacts.find(proof => {
    if (proof.side !== side || proof.operation !== "capture" || proof.frameKey !== frame.sourceEffectKey ||
        proof.causalBeforeVisibilityKey !== frame.beforeVisibilityKey || effect.causalBeforeVisibilityKey !== frame.beforeVisibilityKey ||
        proof.appliedTargetId !== effect.entity.id || proof.sourceActionSeq !== effect.sourceActionSeq ||
        proof.targetCell.square !== effect.entity.square || proof.targetCell.piece.color !== effect.entity.side || proof.targetCell.piece.type !== effect.entity.type) return false;
    const query = companion.provenance.lastCall.queries[proof.queryOrdinal];
    const target = frame.before.entities.find(e => e.id === proof.appliedTargetId);
    const actor = frame.before.entities.find(e => e.id === proof.appliedActorId);
    const evaluationTarget = query?.base.entities.find(e => e.id === proof.evaluationTargetId);
    const evaluationActor = query?.base.entities.find(e => e.id === proof.evaluationActorId);
    return !!query && query.consumption === "applied-consumed" && query.returnedStep !== null && query.sourceActionSeq === proof.sourceActionSeq && query.side === side &&
      !!target && target.kind === "unit" && target.square === effect.entity.square && target.side === effect.entity.side && target.type === effect.entity.type &&
      !!actor && actor.kind === "unit" && actor.side === side && actor.square === query.from &&
      !!evaluationActor && evaluationActor.kind === "unit" && evaluationActor.side === side && evaluationActor.type === actor.type &&
      !!evaluationTarget && evaluationTarget.kind === "unit" && evaluationTarget.square === target.square && evaluationTarget.side === target.side && evaluationTarget.type === target.type;
  });
  return proof ? { square: proof.targetCell.square, visibility: "lit", piece: { color: proof.targetCell.piece.color, type: proof.targetCell.piece.type } } : null;
}

function projectFrame(companion: ProvenanceCompanion<unknown>, frame: TrustedEffectFrame, side: Side, beforeCells: Cell[], checkTime: () => void): EffectFact[] {
  const originModes = frameOriginModes(frame, side, checkTime);
  const before = imageInventory(frame.before, side);
  const subjects = new Map<string, UnitSubject | MineSubject>();
  for (const e of before.units) subjects.set(e.id, { kind: "before-unit", square: e.square });
  for (const e of before.mines) subjects.set(e.id, { kind: "before-mine", square: e.square, slot: e.slot });
  const entities = new Map<string, EngineEntity>(frame.before.entities.map(e => [e.id, e]));
  for (const e of frame.effects) if (e.kind === "unit-create" || e.kind === "mine-create") {
    entities.set(e.entity.id, e.entity);
    if (e.entity.side === side) {
      const ref = ownRef(companion, side, e.sourceActionSeq) ?? fault("Own birth lacks an admitted action binding");
      subjects.set(e.entity.id, e.kind === "unit-create" ? { kind: "born-unit", actionRef: ref } : { kind: "born-mine", actionRef: ref });
    }
  }
  const unitSubject = (id: string): UnitSubject => {
    const s = subjects.get(id);
    return s?.kind === "before-unit" || s?.kind === "born-unit" ? s : fault("Missing whole-group unit locator");
  };
  const mineSubject = (id: string): MineSubject => {
    const s = subjects.get(id);
    return s?.kind === "before-mine" || s?.kind === "born-mine" ? s : fault("Missing whole-group mine locator");
  };
  const facts: { key: string; fact: EffectFact }[] = [];
  const refKey = (ref: ActionRef): string => `${String(ref.planningOrdinal).padStart(10, "0")}:${ref.acceptedActionOrdinal}`;
  const locatorKey = (s: UnitSubject | MineSubject): string => "square" in s ? `${s.kind}:${s.square}:${"slot" in s ? s.slot : ""}` : `${s.kind}:${refKey(s.actionRef)}`;
  for (const e of frame.effects) {
    const ref = ownRef(companion, side, e.sourceActionSeq);
    const entity = "entity" in e ? e.entity : "entityId" in e ? entities.get(e.entityId) : null;
    let fact: EffectFact | null = null; let key = "";
    if (entity?.side === side) {
      const id = entity.id;
      key = locatorKey(subjects.get(id) ?? fault("Missing whole-group subject"));
      switch (e.kind) {
        case "unit-create": {
          const mode = originModes.get(e);
          if (mode === undefined) return fault("Missing native unit birth mode");
          fact = { kind: "unit-born", actionRef: ref ?? fault("Unbound unit birth"), square: e.entity.square, type: e.entity.type, mode };
          break;
        }
        case "unit-move": fact = { kind: "unit-moved", subject: unitSubject(id), from: e.from, to: e.to }; break;
        case "unit-transform": {
          const toMode = originModes.get(e);
          if (toMode === undefined) return fault("Missing native transformation entry mode");
          fact = { kind: "unit-transformed", subject: unitSubject(id), fromType: e.fromType, toType: e.toType, toMode };
          break;
        }
        case "unit-destroy": fact = { kind: "unit-destroyed", subject: unitSubject(id), square: e.entity.square, type: e.entity.type }; break;
        case "tank-mode-change": fact = { kind: "unit-mode-changed", subject: unitSubject(id), before: e.before, after: e.after }; break;
        case "mine-create": fact = { kind: "mine-born", actionRef: ref ?? fault("Unbound mine birth"), square: e.entity.square }; break;
        case "mine-remove": fact = { kind: "mine-removed", subject: mineSubject(id) }; break;
      }
    } else if (e.kind === "unit-destroy" && e.entity.type !== "k") {
      const victim = frame.before.entities.find(v => v.id === e.entity.id);
      const cell = beforeCells.find(c => c.square === e.entity.square);
      const visible = cell?.visibility !== "unknown" && cell?.piece?.color === e.entity.side && cell.piece.type === e.entity.type;
      if (victim?.kind === "unit" && victim.side === e.entity.side && victim.type === e.entity.type && victim.square === e.entity.square &&
          e.causalBeforeVisibilityKey === frame.beforeVisibilityKey && (visible || consumedCapture(companion, frame, e, side))) {
        key = `witness:${e.entity.square}:${e.entity.type}:${ref ? refKey(ref) : ""}`;
        fact = { kind: "enemy-destruction-witnessed", square: e.entity.square, type: e.entity.type, ownActionRef: ref };
      }
    } else if (e.kind === "cc-lives-change" && e.side === side) {
      key = "cc"; fact = { kind: "cc-lives-changed", before: e.before, after: e.after };
    } else if (e.kind === "deployment-disposition" && e.materializedEntityId === null && ref) {
      key = `action:${refKey(ref)}`; fact = { kind: "deployment-unmaterialized", actionRef: ref };
    }
    if (fact) facts.push({ key, fact });
  }
  return facts.sort((a, b) => compare(a.key, b.key)).map(({ fact }) => fact);
}

function checkCompanion(companion: ProvenanceCompanion<unknown>): void {
  if (companion.frames.length > 1152 || companion.visibilityImages.length > 2304 || companion.visibilityCheckpoints.length > 2304 ||
      companion.provenance.lastCall.queries.length > 4 || companion.provenance.lastCall.consumedFacts.length > 4) limit("Native provenance exceeds physical bounds");
  let effects = 0;
  for (const frame of companion.frames) {
    effects += frame.effects.length;
    if (effects > 1152 || frame.before.entities.length > 70 || frame.after.entities.length > 70) limit("Native provenance exceeds physical bounds");
  }
  const { provenance, frames, visibilityImages, visibilityCheckpoints } = companion;
  if (Buffer.byteLength(JSON.stringify({ provenance, frames, visibilityImages, visibilityCheckpoints })) > 16_777_216) limit("Native provenance exceeds 16 MiB");
}

export class EconomicProjector {
  #cursors: Pair<Cursor> | null = null;

  fork(): EconomicProjector {
    const next = new EconomicProjector();
    next.#cursors = structuredClone(this.#cursors);
    return next;
  }

  initial(snapshot: ScFenSnapshot, provenance: EngineProvenance): Pair<EconomicBoundary> {
    if (this.#cursors) return fault("Repeated initial projection");
    const make = (side: Side): EconomicBoundary => {
      const view = projectNativeView(snapshot, side);
      if (JSON.stringify(projectOwnGeometry(provenance, side).units.map(({ square, type }) => ({ square, type }))) !== JSON.stringify(view.own.pieces)) return fault("Initial geometry mismatch");
      return { version: "arena-economic-boundary-v1", side, ordinal: 0, phase: "initial", turn: snapshot.turn, planningOrdinal: 0, grantOrdinal: 0, seqBefore: 0, seqThrough: 0, groups: [], snapshot: view };
    };
    const pair = { w: make("w"), b: make("b") };
    this.#cursors = { w: { seq: 0, ordinal: 0, cells: pair.w.snapshot.cells, turn: snapshot.turn }, b: { seq: 0, ordinal: 0, cells: pair.b.snapshot.cells, turn: snapshot.turn } };
    return pair;
  }

  boundary(input: {
    snapshot: ScFenSnapshot; companion: ProvenanceCompanion<unknown>; phase: "turn-open" | "settled"; planningOrdinal: number;
    admission?: Pair<AcceptedOwnAction[]>; settlement?: Pair<SettlementFacts>; deadline?: number;
  }): Pair<EconomicBoundary> {
    const deadline = input.deadline ?? performance.now() + 10_000;
    const checkTime = (): void => { if (performance.now() >= deadline) limit("Economic projection deadline exceeded"); };
    checkTime();
    checkCompanion(input.companion);
    const cursors = structuredClone(this.#cursors) ?? fault("Projection requires an initial boundary");
    const make = (side: Side): EconomicBoundary => {
      const cursor = cursors[side]; const seqBefore = cursor.seq; const groups: AtomicGroup[] = []; let entries = 0;
      const emit = (g: GroupInput): void => {
        entries += g.kind === "effects" ? g.facts.length : g.kind === "admission" ? g.actions.length : 0;
        if (groups.length >= MAX_ECONOMIC_GROUPS || entries > MAX_ECONOMIC_ENTRIES) limit("Economic boundary exceeds public group or entry cap");
        if (cursor.seq === 0xffffffff) limit("Economic sequence exhausted");
        groups.push({ ...g, seq: ++cursor.seq } as AtomicGroup);
      };
      const vision = (cells: Cell[], turn: number): void => {
        const changes = cells.filter((cell, i) => cursor.turn !== turn || JSON.stringify(cell) !== JSON.stringify(cursor.cells[i]));
        if (changes.length) emit({ kind: "vision", turn, changes });
        cursor.cells = cells; cursor.turn = turn;
      };
      const admitted = input.admission?.[side];
      if (admitted?.length) emit({ kind: "admission", actions: admitted });
      const images = new Map(input.companion.visibilityImages.map(image => [image.key, image]));
      const frames = new Map(input.companion.frames.map(frame => [frame.sourceEffectKey, frame]));
      for (const checkpoint of input.companion.visibilityCheckpoints) {
        checkTime();
        const image = images.get(checkpoint.imageKey) ?? fault("Missing visibility image");
        let cells = imageCells(image.state, side);
        const frame = checkpoint.frameKey === null ? null : frames.get(checkpoint.frameKey) ?? fault("Missing effect frame");
        if (checkpoint.point === "before-frame" && frame) {
          for (const effect of frame.effects) {
            const cell = consumedCapture(input.companion, frame, effect, side);
            if (cell) cells = cells.map(c => c.square === cell.square ? cell : c);
          }
          vision(cells, image.turn);
          const facts = projectFrame(input.companion, frame, side, cells, checkTime);
          if (facts.length) emit({ kind: "effects", beforeOwn: projectOwnGeometry(frame.before, side), afterOwn: projectOwnGeometry(frame.after, side), facts });
        } else vision(cells, image.turn);
      }
      const snapshot = projectNativeView(input.snapshot, side);
      vision(snapshot.cells, snapshot.turn);
      if (input.settlement) emit({ kind: "settlement", ...input.settlement[side] });
      if (cursor.ordinal === 0xffffffff) limit("Economic boundary ordinal exhausted");
      return { version: "arena-economic-boundary-v1", side, ordinal: ++cursor.ordinal, phase: input.phase, turn: snapshot.turn,
        planningOrdinal: input.planningOrdinal, grantOrdinal: input.planningOrdinal, seqBefore, seqThrough: cursor.seq, groups, snapshot };
    };
    const result = { w: make("w"), b: make("b") };
    if (Buffer.byteLength(JSON.stringify(result)) > ECONOMIC_REPLY_LIMIT) limit("Economic projection exceeds 1 MiB");
    checkTime();
    this.#cursors = cursors;
    return result;
  }
}
