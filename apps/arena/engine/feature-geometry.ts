// SPEC: _spec/apps/arena/burn-compat.puml
import {
  attacksSquare, classicalRewriteCoordinatesAfterB, getUnitVision, orderBHeadsFirst, rayBetween,
  type ScAction, type ScPiece, type Square,
} from "@chess-coach/starchess-core/planning-v1";

export type GeometryCharge = (units: number) => void;
type Side = "w" | "b";
type Unit = "p" | "n" | "b" | "r" | "q" | "k";
type Spawn = Exclude<Unit, "k">;
type Promotion = "n" | "b" | "r" | "q";
type Timing = "B" | "C" | "F";
type Kind = "classical" | "deploy" | "stimStep" | "spiderMine" | "charonMissiles" | "siegeMode" | "tacticalJump";
const queueBrand: unique symbol = Symbol("FeatureQueue");
export type FeatureQueue = Readonly<{ [queueBrand]: true }>;
type QueueState = Readonly<{ side: Side; count: number; hasClassical: boolean; actions: readonly ScAction[] }>;
type Schedule = Readonly<{
  bOrder: readonly number[];
  classical: Readonly<{ index: number; rewrite: Readonly<{ from: Square; to: Square }> | null }> | null;
}>;

export class FeatureGeometryError extends Error {
  constructor(readonly code: "BAD_INPUT" | "PROVENANCE", message = code === "BAD_INPUT" ? "Invalid feature geometry input" : "Foreign feature queue") {
    super(message);
    this.name = "FeatureGeometryError";
  }
}

const queues = new WeakMap<object, QueueState>();
const intrinsicGet: (queue: object) => QueueState | undefined = WeakMap.prototype.get.bind(queues);
const intrinsicSet: (queue: object, state: QueueState) => unknown = WeakMap.prototype.set.bind(queues);
const squareGrammar = /^[a-h][1-8]$/;
const bad = (message: string): never => { throw new FeatureGeometryError("BAD_INPUT", message); };

function owned(queue: FeatureQueue): QueueState {
  const state = intrinsicGet(queue);
  if (!state) throw new FeatureGeometryError("PROVENANCE");
  return state;
}

function assertSide(value: Side): void {
  if (value !== "w" && value !== "b") bad("Invalid side");
}

function assertSquare(value: unknown): asserts value is Square {
  if (typeof value !== "string" || !squareGrammar.test(value)) bad("Invalid square");
}

function assertUnit(value: Unit): void {
  if (value !== "p" && value !== "n" && value !== "b" && value !== "r" && value !== "q" && value !== "k") bad("Invalid unit");
}

function assertCharge(value: GeometryCharge): void {
  if (typeof value !== "function") bad("Expected a charge callback");
}

function createQueue(side: Side, actions: readonly ScAction[], hasClassical: boolean): FeatureQueue {
  const state: QueueState = Object.freeze({ side, count: actions.length, hasClassical, actions });
  const queue: FeatureQueue = Object.freeze({ [queueBrand]: true as const });
  intrinsicSet(queue, state);
  return queue;
}

export function emptyFeatureQueue(side: Side, charge: GeometryCharge): FeatureQueue {
  assertSide(side); assertCharge(charge);
  charge(128);
  return createQueue(side, Object.freeze([]), false);
}

export function appendFeatureAction(
  queue: FeatureQueue, kind: Kind, timing: Timing, from: Square, to: Square | null,
  unit: Spawn | null, promotion: Promotion | null, charge: GeometryCharge,
): FeatureQueue {
  const state = owned(queue);
  if (state.count >= 4) return bad("Feature queue exceeds four actions");
  if (kind !== "classical" && kind !== "deploy" && kind !== "stimStep" && kind !== "spiderMine" && kind !== "charonMissiles" && kind !== "siegeMode" && kind !== "tacticalJump") return bad("Invalid action kind");
  if (kind === "classical") {
    if (timing !== "C") return bad("Classical actions require timing C");
    if (state.hasClassical) return bad("Feature queue already has a classical action");
  } else if (timing !== "B" && timing !== "F") return bad("Special actions require timing B or F");
  assertSquare(from);
  if (kind === "spiderMine" || kind === "siegeMode") {
    if (to !== null) return bad("This special requires a null destination");
  } else assertSquare(to);
  if (kind === "deploy") {
    if (unit !== "p" && unit !== "n" && unit !== "b" && unit !== "r" && unit !== "q") return bad("Deployment requires a spawn unit");
  } else if (unit !== null) return bad("Only deployment accepts a spawn unit");
  if (kind === "classical" || kind === "stimStep") {
    if (promotion !== null && promotion !== "n" && promotion !== "b" && promotion !== "r" && promotion !== "q") return bad("Invalid promotion");
  } else if (promotion !== null) return bad("This action requires a null promotion");
  assertCharge(charge);
  const count = state.count + 1;
  charge(512 + 192 * count);
  const promoted = promotion === null ? {} : { promotion };
  const action: ScAction = kind === "classical"
    ? { kind, timing: "C", color: state.side, from, to: to!, ...promoted, seq: state.count }
    : { kind, timing: timing as "B" | "F", color: state.side, from,
      ...(to === null ? {} : { to }), ...(unit === null ? {} : { unit }), ...promoted, seq: state.count };
  const actions = Object.freeze([...state.actions.map(previous => Object.freeze({ ...previous })), Object.freeze(action)]);
  return createQueue(state.side, actions, state.hasClassical || kind === "classical");
}

export function nativeOwnSchedule(queue: FeatureQueue, charge: GeometryCharge): Schedule {
  const state = owned(queue);
  assertCharge(charge);
  charge(2048 + 256 * state.count * state.count);
  const actions = Object.freeze(state.actions.map(action => Object.freeze({ ...action })));
  const before = Object.freeze(actions.filter(action => action.timing === "B"));
  const bOrder = Object.freeze(orderBHeadsFirst(before).map(action => action.seq));
  const classical = actions.find(action => action.timing === "C");
  if (!classical) return Object.freeze({ bOrder, classical: null });
  const coordinates = classicalRewriteCoordinatesAfterB(actions, classical);
  const rewrite = coordinates === null ? null : Object.freeze({ from: coordinates.from, to: coordinates.to });
  return Object.freeze({ bOrder, classical: Object.freeze({ index: classical.seq, rewrite }) });
}

export function nativeAttackShape(unit: Unit, side: Side, from: Square, to: Square, charge: GeometryCharge): boolean {
  assertUnit(unit); assertSide(side); assertSquare(from); assertSquare(to); assertCharge(charge);
  charge(512);
  const attacker: ScPiece = Object.freeze({ color: side, type: unit });
  return attacksSquare(new Map([[from, attacker]]), from, to);
}

export function nativeRay(from: Square, to: Square, charge: GeometryCharge): readonly Square[] {
  assertSquare(from); assertSquare(to); assertCharge(charge);
  charge(512);
  const ray = rayBetween(from, to);
  if (ray.length > 6) throw new Error("Native ray exceeds six squares");
  return Object.freeze([...ray]);
}

export function nativeUnitLit(unit: Unit, side: Side, source: Square, mode: "tank" | "siege" | null, charge: GeometryCharge): readonly Square[] {
  assertUnit(unit); assertSide(side); assertSquare(source);
  if (unit === "r") {
    if (mode !== "tank" && mode !== "siege") return bad("Rook vision requires an explicit mode");
  } else if (mode !== null) return bad("Nonrook vision requires a null mode");
  assertCharge(charge);
  charge(8192);
  const piece: ScPiece = Object.freeze({ color: side, type: unit });
  const board = new Map([[source, piece]]);
  const vision = mode === null ? getUnitVision(board, source) : getUnitVision(board, source, { tankModeFor: () => mode });
  if (vision.litSquares.size > 64) throw new Error("Native unit vision exceeds 64 squares");
  return Object.freeze([...vision.litSquares].sort());
}
