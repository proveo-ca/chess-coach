// SPEC: _spec/apps/arena/burn-compat.puml
import type { PieceColor, ScActionInput, ScPiece, Square } from "@chess-coach/starchess-core/planning-v1";
import { CC_MAX_LIVES, MAX_GAME_TURNS, MAX_MINES_PER_SIDE, MAX_STORED_MATERIAL } from "@chess-coach/starchess-core/planning-v1";

export const PROTOCOL_V2 = "arena-engine-v2";
export const ACTION_KINDS = ["classical", "deploy", "stimStep", "spiderMine", "charonMissiles", "siegeMode", "tacticalJump"] as const;
export type ActionKind = typeof ACTION_KINDS[number];
export type Side = PieceColor;
export type Action = ScActionInput;
export type Pair<T> = { w: T; b: T };
export type Bank = Pair<number>;
export type Outcome = { winner: Side | null; draw: boolean };
export type FixtureId = "tiny-v1" | "standard-v1" | "all-actors-v1";
export type Cell = { square: Square; visibility: "unknown" } |
  { square: Square; visibility: "lit"; piece: ScPiece | null } |
  { square: Square; visibility: "revealed"; piece: ScPiece };

export type AuthorizedView = {
  version: "arena-observation-v2";
  side: Side;
  turn: number;
  own: {
    minerals: number; gas: number; gasIncome: number; ccLives: number;
    pieces: { square: Square; type: ScPiece["type"] }[];
    mines: Square[]; siegedTanks: Square[];
  };
  cells: Cell[];
};

export type EngineContext = { session: number; planningOrdinal: number; turn: number };
export type StateImage = { scfen: string; bank: Bank };
export type BeginRecord = {
  session: number; planningOrdinal: number;
  before: StateImage; after: StateImage; rawBegin: unknown; outcome: Outcome | null;
};
export type SettlementRecord = {
  context: EngineContext; requests: Pair<Action[]>;
  before: StateImage; committed: StateImage; after: StateImage;
  grants: Bank; rawResolve: unknown; outcome: Outcome | null;
};
export type RejectionWitness = {
  side: Side; actionIndex: number | null; nativeCode: string; message: string;
  begin: BeginRecord; requests: Pair<Action[]>; image: StateImage; outcome: Outcome | null;
};
export type FailureCode = "BAD_REQUEST" | "STATE" | "STALE_CONTEXT" | "NATIVE_REJECTION" | "ENGINE_FAILURE" | "LIMIT";
export type ErrorPacket = { code: FailureCode; message: string; context: EngineContext | null; witness: RejectionWitness | null };
export type NativeFailure = "actor" | "shape" | "timing" | "mineCap" | "ownOccupancy";
export type PrimitiveProposal = { action: Action; nativeFailure: NativeFailure | null; anchor: Square | null; cost: { minerals: number; gas: number } };
export type CursorPull = { kind: "start"; prefix: Action[]; family: ActionKind | null } | { kind: "resume"; cursor: number };
export type DomainStep = { cursor: number; proposal: PrimitiveProposal | null };

export type SessionStart = { kind: "started"; session: number; fixture: FixtureId; initial: StateImage; outcome: Outcome | null };
export type SessionOpen = { kind: "planning"; context: EngineContext; views: Pair<AuthorizedView> } |
  { kind: "terminal"; session: number; outcome: Outcome; image: StateImage; begin: BeginRecord | null };
export type SessionCommit = { kind: "committed"; context: EngineContext; begin: BeginRecord; settlement: SettlementRecord };
export type SessionClose = { kind: "closed"; session: number; pendingBegin: BeginRecord | null; image: StateImage; outcome: Outcome | null };
export type PlanningOpen = { kind: "planning-opened"; planning: number };
export type PlanningNext = { kind: "planned"; planning: number; steps: DomainStep[] };
export type PlanningClose = { kind: "planning-closed"; planning: number };

type SessionOp = "session.start" | "replay.start";
type OpenOp = "session.open" | "replay.open";
type CommitOp = "session.commit" | "replay.commit";
type CloseOp = "session.close" | "replay.close";
export type Operation =
  { op: SessionOp; fixture: FixtureId } |
  { op: OpenOp; session: number; planningOrdinal: number } |
  { op: CommitOp; context: EngineContext; requests: Pair<Action[]> } |
  { op: CloseOp; session: number } |
  { op: "plan.open"; view: AuthorizedView } |
  { op: "plan.next"; planning: number; pulls: CursorPull[] } |
  { op: "plan.close"; planning: number };
export type RequestV2 = { protocol: typeof PROTOCOL_V2; id: number } & Operation;
export type ReplyV2 = { protocol: typeof PROTOCOL_V2; id: number; ok: true; result: unknown } |
  { protocol: typeof PROTOCOL_V2; id: number | null; ok: false; error: ErrorPacket };

export const SQUARES_V2: readonly Square[] = Object.freeze(Array.from({ length: 64 }, (_, i) =>
  `${String.fromCharCode(97 + Math.floor(i / 8))}${i % 8 + 1}` as Square));

export class EngineErrorV2 extends Error {
  readonly packet: ErrorPacket;
  constructor(code: FailureCode, message: string, context: EngineContext | null = null, witness: RejectionWitness | null = null) {
    super(message);
    this.packet = { code, message, context, witness };
  }
}

const bad = (message = "Invalid engine request"): never => { throw new EngineErrorV2("BAD_REQUEST", message); };

export function fieldsV2(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return bad("Expected a plain object");
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return bad("Expected a plain object");
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== "string" || (!required.includes(key) && !optional.includes(key)))) return bad("Unexpected fields");
  const result: Record<string, unknown> = Object.create(null);
  for (const key of [...required, ...optional]) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d && optional.includes(key)) continue;
    if (!d || !Object.hasOwn(d, "value") || !d.enumerable) return bad("Expected a data field");
    result[key] = d.value;
  }
  return result;
}

export function arrayV2(value: unknown, max: number, min = 0): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return bad("Expected a dense array");
  const n: unknown = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < min || n > max || Reflect.ownKeys(value).length !== n + 1) return bad("Invalid array length");
  const result: unknown[] = [];
  for (let i = 0; i < n; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    if (!d || !Object.hasOwn(d, "value") || !d.enumerable) return bad("Expected a dense data array");
    result.push(d.value);
  }
  return result;
}

export function integerV2(value: unknown, max = 0xffffffff, min = 0): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max ? value : bad("Invalid integer");
}

const sideV2 = (value: unknown): Side => value === "w" || value === "b" ? value : bad("Invalid side");
const squareV2 = (value: unknown): Square => typeof value === "string" && /^[a-h][1-8]$/.test(value) ? value as Square : bad("Invalid square");
const unitV2 = (value: unknown): "p" | "n" | "b" | "r" | "q" =>
  typeof value === "string" && ["p", "n", "b", "r", "q"].includes(value) ? value as "p" | "n" | "b" | "r" | "q" : bad("Invalid unit");

export function parseActionV2(value: unknown): Action {
  const r = fieldsV2(value, ["kind", "timing", "color", "from"], ["to", "unit", "promotion"]);
  const color = sideV2(r.color);
  const from = squareV2(r.from);
  if (typeof r.kind !== "string" || !(ACTION_KINDS as readonly string[]).includes(r.kind)) return bad("Invalid action kind");
  const kind = r.kind as ActionKind;
  const hasTo = Object.hasOwn(r, "to");
  const hasUnit = Object.hasOwn(r, "unit");
  const hasPromotion = Object.hasOwn(r, "promotion");
  const to = hasTo ? squareV2(r.to) : undefined;
  const promotion = hasPromotion ? unitV2(r.promotion) : undefined;
  if (promotion === "p") return bad("Invalid promotion");
  if (hasUnit && kind !== "deploy") return bad("Unexpected unit");
  if (hasPromotion && kind !== "classical" && kind !== "stimStep") return bad("Unexpected promotion");
  if (kind === "classical") {
    if (r.timing !== "C" || !to || hasUnit) return bad("Invalid classical action");
    return { kind, timing: "C", color, from, to, ...(promotion ? { promotion } : {}) };
  }
  if (r.timing !== "B" && r.timing !== "F") return bad("Invalid special timing");
  if ((kind === "spiderMine" || kind === "siegeMode") ? hasTo : !hasTo) return bad("Invalid special destination");
  const unit = kind === "deploy" ? unitV2(r.unit) : undefined;
  return { kind, timing: r.timing, color, from, ...(to ? { to } : {}), ...(unit ? { unit } : {}), ...(promotion ? { promotion } : {}) };
}

export function parseActionsV2(value: unknown, max: number, side?: Side): Action[] {
  return arrayV2(value, max).map(entry => {
    const action = parseActionV2(entry);
    if (side !== undefined && action.color !== side) return bad("Action belongs to the opposing side");
    return action;
  });
}

const orderedV2 = (values: readonly string[], duplicates = false): void => {
  if (values.some((value, i) => i > 0 && (duplicates ? values[i - 1]! > value : values[i - 1]! >= value))) bad("Invalid canonical order");
};

function pieceV2(value: unknown): ScPiece {
  const r = fieldsV2(value, ["color", "type"]);
  const color = sideV2(r.color);
  const type = r.type === "k" ? "k" : unitV2(r.type);
  return { color, type };
}

export function freezeV2<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeV2(child);
    Object.freeze(value);
  }
  return value;
}

export function parseViewV2(value: unknown): AuthorizedView {
  const r = fieldsV2(value, ["version", "side", "turn", "own", "cells"]);
  if (r.version !== "arena-observation-v2") return bad("Invalid observation version");
  const side = sideV2(r.side);
  const turn = integerV2(r.turn, MAX_GAME_TURNS);
  const own = fieldsV2(r.own, ["minerals", "gas", "gasIncome", "ccLives", "pieces", "mines", "siegedTanks"]);
  const minerals = integerV2(own.minerals, MAX_STORED_MATERIAL);
  const gasIncome = integerV2(own.gasIncome, 3, 1);
  const gas = integerV2(own.gas, gasIncome);
  const ccLives = integerV2(own.ccLives, CC_MAX_LIVES);
  const cells = arrayV2(r.cells, 64, 64).map((entry, i): Cell => {
    const c = fieldsV2(entry, ["square", "visibility"], ["piece"]);
    const square = squareV2(c.square);
    if (square !== SQUARES_V2[i]) return bad("Invalid cell order");
    if (c.visibility === "unknown") {
      if (Object.hasOwn(c, "piece")) return bad("Unknown cells cannot carry pieces");
      return { square, visibility: "unknown" };
    }
    if (!Object.hasOwn(c, "piece")) return bad("Visible cells require a piece field");
    const piece = c.piece === null ? null : pieceV2(c.piece);
    if (c.visibility === "revealed") {
      if (!piece || piece.color === side || piece.type !== "q") return bad("Invalid revealed piece");
      return { square, visibility: "revealed", piece };
    }
    if (c.visibility !== "lit") return bad("Invalid visibility");
    return { square, visibility: "lit", piece };
  });
  const pieces = arrayV2(own.pieces, 64, 1).map(entry => {
    const p = fieldsV2(entry, ["square", "type"]);
    return { square: squareV2(p.square), type: p.type === "k" ? "k" as const : unitV2(p.type) };
  });
  orderedV2(pieces.map(p => p.square));
  const expected = cells.flatMap(c => c.visibility !== "unknown" && c.piece?.color === side ? [{ square: c.square, type: c.piece.type }] : []);
  if (JSON.stringify(pieces) !== JSON.stringify(expected) || pieces.filter(p => p.type === "k").length !== 1) return bad("Inconsistent own pieces");
  const mines = arrayV2(own.mines, MAX_MINES_PER_SIDE).map(squareV2);
  const siegedTanks = arrayV2(own.siegedTanks, 64).map(squareV2);
  orderedV2(mines, true);
  orderedV2(siegedTanks);
  if (mines.some(at => cells[SQUARES_V2.indexOf(at)]!.visibility !== "lit") ||
      siegedTanks.some(at => !pieces.some(p => p.square === at && p.type === "r"))) return bad("Inconsistent own inventory");
  return freezeV2({ version: "arena-observation-v2", side, turn, own: { minerals, gas, gasIncome, ccLives, pieces, mines, siegedTanks }, cells });
}

export function parseContextV2(value: unknown): EngineContext {
  const r = fieldsV2(value, ["session", "planningOrdinal", "turn"]);
  return { session: integerV2(r.session), planningOrdinal: integerV2(r.planningOrdinal), turn: integerV2(r.turn, MAX_GAME_TURNS) };
}

export function parseRequestsV2(value: unknown): Pair<Action[]> {
  const r = fieldsV2(value, ["w", "b"]);
  return { w: parseActionsV2(r.w, 4, "w"), b: parseActionsV2(r.b, 4, "b") };
}

export function parsePullsV2(value: unknown): CursorPull[] {
  return arrayV2(value, 8, 1).map(entry => {
    const tag: unknown = entry && typeof entry === "object" ? Object.getOwnPropertyDescriptor(entry, "kind")?.value : undefined;
    if (tag === "resume") {
      const p = fieldsV2(entry, ["kind", "cursor"]);
      return { kind: "resume", cursor: integerV2(p.cursor) };
    }
    const p = fieldsV2(entry, ["kind", "prefix", "family"]);
    if (p.kind !== "start" || (p.family !== null && !(ACTION_KINDS as readonly unknown[]).includes(p.family))) return bad("Invalid cursor pull");
    return { kind: "start", prefix: parseActionsV2(p.prefix, 3), family: p.family as ActionKind | null };
  });
}

export function parseRequestV2(value: unknown): RequestV2 {
  const op: unknown = value && typeof value === "object" ? Object.getOwnPropertyDescriptor(value, "op")?.value : undefined;
  const extras: Record<string, readonly string[]> = {
    "session.start": ["fixture"], "replay.start": ["fixture"],
    "session.open": ["session", "planningOrdinal"], "replay.open": ["session", "planningOrdinal"],
    "session.commit": ["context", "requests"], "replay.commit": ["context", "requests"],
    "session.close": ["session"], "replay.close": ["session"],
    "plan.open": ["view"], "plan.next": ["planning", "pulls"], "plan.close": ["planning"],
  };
  if (typeof op !== "string" || !Object.hasOwn(extras, op)) return bad("Unsupported operation");
  const r = fieldsV2(value, ["protocol", "id", "op", ...extras[op]!]);
  if (r.protocol !== PROTOCOL_V2) return bad("Invalid protocol");
  const base = { protocol: PROTOCOL_V2, id: integerV2(r.id) } as const;
  switch (op) {
    case "session.start": case "replay.start":
      if (r.fixture !== "tiny-v1" && r.fixture !== "standard-v1" && r.fixture !== "all-actors-v1") return bad("Invalid fixture");
      return { ...base, op, fixture: r.fixture };
    case "session.open": case "replay.open": return { ...base, op, session: integerV2(r.session), planningOrdinal: integerV2(r.planningOrdinal) };
    case "session.commit": case "replay.commit": return { ...base, op, context: parseContextV2(r.context), requests: parseRequestsV2(r.requests) };
    case "session.close": case "replay.close": return { ...base, op, session: integerV2(r.session) };
    case "plan.open": return { ...base, op, view: parseViewV2(r.view) };
    case "plan.next": return { ...base, op, planning: integerV2(r.planning), pulls: parsePullsV2(r.pulls) };
    case "plan.close": return { ...base, op, planning: integerV2(r.planning) };
    default: return bad("Unsupported operation");
  }
}

export function failureV2(id: number | null, error: unknown): ReplyV2 {
  const packet = error instanceof EngineErrorV2 ? error.packet : { code: "ENGINE_FAILURE" as const, message: "Native engine boundary failed", context: null, witness: null };
  return { protocol: PROTOCOL_V2, id, ok: false, error: packet };
}
