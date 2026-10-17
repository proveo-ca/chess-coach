// SPEC: _spec/apps/arena/burn-compat.puml
import {
  getSideVision, placementToMap, type EngineEntity, type EngineProvenance,
  type ProvenanceCompanion, type ScFenSnapshot, type ScPiece, type Square, type TrustedEffectFrame,
} from "@chess-coach/starchess-core";
import {
  ECONOMIC_REPLY_LIMIT, MAX_ECONOMIC_ENTRIES, MAX_ECONOMIC_GROUPS, type AcceptedOwnAction, type ActionRef,
  type AtomicGroup, type EconomicBoundary, type EffectFact, type MineSubject, type OwnGeometry, type UnitSubject,
} from "./economic-wire";
import { EngineErrorV2, parseViewV2, SQUARES_V2, type AuthorizedView, type Cell, type Pair, type Side } from "./wire-v2";

type FrameImage = TrustedEffectFrame["before"];
type Effect = TrustedEffectFrame["effects"][number];
type Cursor = { seq: number; ordinal: number; cells: Cell[]; turn: number };
type GroupInput = AtomicGroup extends infer G ? G extends AtomicGroup ? Omit<G, "seq"> : never : never;
export type SettlementFacts = { entitlement: number; credited: number; gasBeforeReset: number; nextGasCapacity: number };
const fault = (message: string): never => { throw new EngineErrorV2("ENGINE_FAILURE", `Economic provenance: ${message}`); };
const limit = (message: string): never => { throw new EngineErrorV2("LIMIT", message); };
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

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
      return { square: e.square, type: e.type, mode: e.tankMode };
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

function projectFrame(companion: ProvenanceCompanion<unknown>, frame: TrustedEffectFrame, side: Side, beforeCells: Cell[]): EffectFact[] {
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
        case "unit-create": fact = { kind: "unit-born", actionRef: ref ?? fault("Unbound unit birth"), square: e.entity.square, type: e.entity.type }; break;
        case "unit-move": fact = { kind: "unit-moved", subject: unitSubject(id), from: e.from, to: e.to }; break;
        case "unit-transform": fact = { kind: "unit-transformed", subject: unitSubject(id), fromType: e.fromType, toType: e.toType }; break;
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
          const facts = projectFrame(input.companion, frame, side, cells);
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
