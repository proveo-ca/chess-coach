// SPEC: _spec/apps/arena/burn-compat.puml
import type { Square } from "@chess-coach/starchess-core/planning-v1";
import {
  arrayV2, EngineErrorV2, fieldsV2, integerV2, parseActionV2, parseContextV2, parseRequestsV2, parseViewV2,
  type Action, type AuthorizedView, type BeginRecord, type Cell, type EngineContext, type ErrorPacket,
  type FixtureId, type Outcome, type Pair, type SessionClose, type SettlementRecord, type Side, type StateImage,
} from "./wire-v2";

export const ECONOMIC_PROTOCOL = "arena-economic-v1";
export const ECONOMIC_REQUEST_LIMIT = 65_536;
export const ECONOMIC_REPLY_LIMIT = 1_048_576;
export const MAX_ECONOMIC_GROUPS = 2048;
export const MAX_ECONOMIC_ENTRIES = 2048;
export type UnitType = AuthorizedView["own"]["pieces"][number]["type"];
export type TankMode = "tank" | "siege";
export type LedgerRules = {
  version: "arena-economic-rules-v1"; openingBankDefault: number;
  unitCosts: Record<UnitType, number>; mineralBankCap: number; mineEntityCap: number; maxTurn: number;
  incomeByTurn: number[]; gasCapacityByTurn: number[];
};
export type ActionRef = { planningOrdinal: number; acceptedActionOrdinal: number };
export type AcceptedOwnAction = { actionRef: ActionRef; action: Action; minerals: number; gas: number };
export type OwnGeometry = {
  units: { square: Square; type: UnitType; mode: TankMode | null }[];
  mines: { square: Square; slot: number }[]; ccLives: number;
};
export type UnitSubject = { kind: "before-unit"; square: Square } | { kind: "born-unit"; actionRef: ActionRef };
export type MineSubject = { kind: "before-mine"; square: Square; slot: number } | { kind: "born-mine"; actionRef: ActionRef };
export type EffectFact =
  { kind: "unit-born"; actionRef: ActionRef; square: Square; type: UnitType; mode: TankMode | null } |
  { kind: "unit-moved"; subject: UnitSubject; from: Square; to: Square } |
  { kind: "unit-transformed"; subject: UnitSubject; fromType: UnitType; toType: UnitType; toMode: TankMode | null } |
  { kind: "unit-mode-changed"; subject: UnitSubject; before: TankMode; after: TankMode } |
  { kind: "unit-destroyed"; subject: UnitSubject; square: Square; type: UnitType } |
  { kind: "deployment-unmaterialized"; actionRef: ActionRef } |
  { kind: "mine-born"; actionRef: ActionRef; square: Square } |
  { kind: "mine-removed"; subject: MineSubject } |
  { kind: "cc-lives-changed"; before: number; after: number } |
  { kind: "enemy-destruction-witnessed"; square: Square; type: UnitType; ownActionRef: ActionRef | null };
export type AtomicGroup =
  { kind: "admission"; seq: number; actions: AcceptedOwnAction[] } |
  { kind: "effects"; seq: number; beforeOwn: OwnGeometry; afterOwn: OwnGeometry; facts: EffectFact[] } |
  { kind: "vision"; seq: number; turn: number; changes: Cell[] } |
  { kind: "settlement"; seq: number; entitlement: number; credited: number; gasBeforeReset: number; nextGasCapacity: number };
export type EconomicBoundary = {
  version: "arena-economic-boundary-v1"; side: Side; ordinal: number; phase: "initial" | "turn-open" | "settled";
  turn: number; planningOrdinal: number; grantOrdinal: number; seqBefore: number; seqThrough: number;
  groups: AtomicGroup[]; snapshot: AuthorizedView;
};
export type EconomicStart = {
  kind: "started"; session: number; fixture: FixtureId; initial: StateImage; outcome: Outcome | null;
  rules: LedgerRules; boundaries: Pair<EconomicBoundary>;
};
export type EconomicOpen = {
  kind: "planning"; context: EngineContext; views: Pair<AuthorizedView>; begin: BeginRecord; boundaries: Pair<EconomicBoundary>;
} | {
  kind: "terminal"; session: number; outcome: Outcome; image: StateImage;
  begin: BeginRecord | null; boundaries: Pair<EconomicBoundary> | null;
};
export type EconomicSettle = {
  kind: "committed"; context: EngineContext; begin: BeginRecord; settlement: SettlementRecord; boundaries: Pair<EconomicBoundary>;
};
export type EconomicResult = EconomicStart | EconomicOpen | EconomicSettle | SessionClose;
export type EconomicRequest = { protocol: typeof ECONOMIC_PROTOCOL; id: number } & (
  { op: "economic.start"; fixture: FixtureId } | { op: "economic.open"; planningOrdinal: number } |
  { op: "economic.settle"; context: EngineContext; requests: Pair<Action[]> } | { op: "economic.close" }
);
export type EconomicReply = { protocol: typeof ECONOMIC_PROTOCOL; id: number; ok: true; result: EconomicResult } |
  { protocol: typeof ECONOMIC_PROTOCOL; id: number | null; ok: false; error: ErrorPacket };

const bad = (message: string): never => { throw new EngineErrorV2("BAD_REQUEST", message); };
const uint = (value: unknown, max = 0xffffffff, min = 0): number => Object.is(value, -0) ? bad("Invalid integer") : integerV2(value, max, min);
const square = (value: unknown): Square => typeof value === "string" && /^[a-h][1-8]$/.test(value) ? value as Square : bad("Invalid square");
const unit = (value: unknown): UnitType => typeof value === "string" && ["p", "n", "b", "r", "q", "k"].includes(value) ? value as UnitType : bad("Invalid unit type");
const mode = (value: unknown): TankMode => value === "tank" || value === "siege" ? value : bad("Invalid tank mode");
const tag = (value: unknown): unknown => value && typeof value === "object" ? Object.getOwnPropertyDescriptor(value, "kind")?.value : undefined;

export function parseEconomicRequest(value: unknown): EconomicRequest {
  const op: unknown = value && typeof value === "object" ? Object.getOwnPropertyDescriptor(value, "op")?.value : undefined;
  const extras: Record<string, string[]> = {
    "economic.start": ["fixture"], "economic.open": ["planningOrdinal"], "economic.settle": ["context", "requests"], "economic.close": [],
  };
  if (typeof op !== "string" || !Object.hasOwn(extras, op)) return bad("Unsupported economic operation");
  const r = fieldsV2(value, ["protocol", "id", "op", ...extras[op]!]);
  if (r.protocol !== ECONOMIC_PROTOCOL) return bad("Invalid economic protocol");
  const base = { protocol: ECONOMIC_PROTOCOL, id: uint(r.id) } as const;
  switch (op) {
    case "economic.start":
      if (r.fixture !== "tiny-v1" && r.fixture !== "standard-v1" && r.fixture !== "all-actors-v1") return bad("Invalid fixture");
      return { ...base, op, fixture: r.fixture };
    case "economic.open": return { ...base, op, planningOrdinal: uint(r.planningOrdinal) };
    case "economic.settle": {
      const context = parseContextV2(r.context);
      Object.values(context).forEach(n => uint(n));
      return { ...base, op, context, requests: parseRequestsV2(r.requests) };
    }
    default: return { ...base, op: "economic.close" };
  }
}

export function economicFailure(id: number | null, error: unknown): EconomicReply {
  const packet: ErrorPacket = error instanceof EngineErrorV2 ? error.packet : {
    code: "ENGINE_FAILURE", message: "Native economic boundary failed", context: null, witness: null,
  };
  return { protocol: ECONOMIC_PROTOCOL, id, ok: false, error: packet };
}

export function parseLedgerRules(value: unknown): LedgerRules {
  const r = fieldsV2(value, ["version", "openingBankDefault", "unitCosts", "mineralBankCap", "mineEntityCap", "maxTurn", "incomeByTurn", "gasCapacityByTurn"]);
  if (r.version !== "arena-economic-rules-v1") return bad("Invalid economic rules version");
  const costs = fieldsV2(r.unitCosts, ["p", "n", "b", "r", "q", "k"]);
  const unitCosts = Object.fromEntries(Object.entries(costs).map(([k, v]) => [k, uint(v, 12, 1)])) as Record<UnitType, number>;
  const maxTurn = uint(r.maxTurn, 45);
  return {
    version: r.version, openingBankDefault: uint(r.openingBankDefault, uint(r.mineralBankCap, 12, 1)), unitCosts,
    mineralBankCap: uint(r.mineralBankCap, 12, 1), mineEntityCap: uint(r.mineEntityCap, 3, 1), maxTurn,
    incomeByTurn: arrayV2(r.incomeByTurn, maxTurn + 1, maxTurn + 1).map(n => uint(n, 12)),
    gasCapacityByTurn: arrayV2(r.gasCapacityByTurn, maxTurn + 1, maxTurn + 1).map(n => uint(n, 3, 1)),
  };
}

export function parseOwnGeometry(value: unknown): OwnGeometry {
  const r = fieldsV2(value, ["units", "mines", "ccLives"]);
  const units = arrayV2(r.units, 64).map(value => {
    const u = fieldsV2(value, ["square", "type", "mode"]);
    const type = unit(u.type);
    if ((type === "r") !== (u.mode !== null)) return bad("Rook-only modes are required");
    return { square: square(u.square), type, mode: u.mode === null ? null : mode(u.mode) };
  });
  if (units.some((u, i) => i > 0 && units[i - 1]!.square >= u.square)) return bad("Noncanonical own units");
  const mines = arrayV2(r.mines, 3).map(value => {
    const m = fieldsV2(value, ["square", "slot"]);
    return { square: square(m.square), slot: uint(m.slot, 2) };
  });
  for (let i = 0; i < mines.length; i++) {
    const m = mines[i]!; const prior = mines[i - 1];
    if ((prior && prior.square > m.square) || m.slot !== (prior?.square === m.square ? prior.slot + 1 : 0)) return bad("Noncanonical mine occurrences");
  }
  return { units, mines, ccLives: uint(r.ccLives, 3) };
}

function actionRef(value: unknown): ActionRef {
  const r = fieldsV2(value, ["planningOrdinal", "acceptedActionOrdinal"]);
  return { planningOrdinal: uint(r.planningOrdinal), acceptedActionOrdinal: uint(r.acceptedActionOrdinal, 3) };
}
function subject(value: unknown, mine: false): UnitSubject;
function subject(value: unknown, mine: true): MineSubject;
function subject(value: unknown, mine: boolean): UnitSubject | MineSubject {
  const kind = tag(value);
  if (kind === (mine ? "born-mine" : "born-unit")) {
    const r = fieldsV2(value, ["kind", "actionRef"]);
    return { kind, actionRef: actionRef(r.actionRef) } as UnitSubject | MineSubject;
  }
  if (kind !== (mine ? "before-mine" : "before-unit")) return bad("Invalid locator kind");
  const r = fieldsV2(value, mine ? ["kind", "square", "slot"] : ["kind", "square"]);
  return mine ? { kind: "before-mine", square: square(r.square), slot: uint(r.slot, 2) } : { kind: "before-unit", square: square(r.square) };
}
function effect(value: unknown): EffectFact {
  const kind = tag(value);
  switch (kind) {
    case "unit-born": {
      const r = fieldsV2(value, ["kind", "actionRef", "square", "type", "mode"]);
      const type = unit(r.type);
      if (type === "k") return bad("Command centers cannot be deployed");
      if ((type === "r") !== (r.mode !== null)) return bad("Unit births require rook-only modes");
      return { kind, actionRef: actionRef(r.actionRef), square: square(r.square), type, mode: r.mode === null ? null : mode(r.mode) };
    }
    case "mine-born": {
      const r = fieldsV2(value, ["kind", "actionRef", "square"]);
      return { kind, actionRef: actionRef(r.actionRef), square: square(r.square) };
    }
    case "unit-moved": {
      const r = fieldsV2(value, ["kind", "subject", "from", "to"]);
      if (r.from === r.to) return bad("Movement must change square");
      return { kind, subject: subject(r.subject, false), from: square(r.from), to: square(r.to) };
    }
    case "unit-transformed": {
      const r = fieldsV2(value, ["kind", "subject", "fromType", "toType", "toMode"]);
      if (r.fromType === r.toType || r.fromType === "k" || r.toType === "k") return bad("Invalid transformation");
      const toType = unit(r.toType);
      if ((toType === "r") !== (r.toMode !== null)) return bad("Unit transformations require rook-only destination modes");
      return { kind, subject: subject(r.subject, false), fromType: unit(r.fromType), toType, toMode: r.toMode === null ? null : mode(r.toMode) };
    }
    case "unit-mode-changed": {
      const r = fieldsV2(value, ["kind", "subject", "before", "after"]);
      if (r.before === r.after) return bad("Mode must change");
      return { kind, subject: subject(r.subject, false), before: mode(r.before), after: mode(r.after) };
    }
    case "unit-destroyed": {
      const r = fieldsV2(value, ["kind", "subject", "square", "type"]);
      if (r.type === "k") return bad("CC damage is not ordinary destruction");
      return { kind, subject: subject(r.subject, false), square: square(r.square), type: unit(r.type) };
    }
    case "deployment-unmaterialized": {
      const r = fieldsV2(value, ["kind", "actionRef"]); return { kind, actionRef: actionRef(r.actionRef) };
    }
    case "mine-removed": {
      const r = fieldsV2(value, ["kind", "subject"]); return { kind, subject: subject(r.subject, true) };
    }
    case "cc-lives-changed": {
      const r = fieldsV2(value, ["kind", "before", "after"]);
      if (r.before === r.after) return bad("CC lives must change");
      return { kind, before: uint(r.before, 3), after: uint(r.after, 3) };
    }
    case "enemy-destruction-witnessed": {
      const r = fieldsV2(value, ["kind", "square", "type", "ownActionRef"]);
      if (r.type === "k") return bad("CC damage is not ordinary destruction");
      return { kind, square: square(r.square), type: unit(r.type), ownActionRef: r.ownActionRef === null ? null : actionRef(r.ownActionRef) };
    }
    default: return bad("Invalid economic effect kind");
  }
}

function observedCell(value: unknown, side: Side): Cell {
  const c = fieldsV2(value, ["square", "visibility"], ["piece"]);
  const at = square(c.square);
  if (c.visibility === "unknown") {
    if (Object.hasOwn(c, "piece")) return bad("Unknown cells cannot carry pieces");
    return { square: at, visibility: "unknown" };
  }
  if (!Object.hasOwn(c, "piece")) return bad("Visible cells require a piece field");
  const p = c.piece === null ? null : fieldsV2(c.piece, ["color", "type"]);
  if (p && p.color !== "w" && p.color !== "b") return bad("Invalid piece side");
  const piece = p ? { color: p.color as Side, type: unit(p.type) } : null;
  if (c.visibility === "revealed") {
    if (!piece || piece.color === side || piece.type !== "q") return bad("Invalid revealed piece");
    return { square: at, visibility: "revealed", piece };
  }
  if (c.visibility !== "lit") return bad("Invalid cell visibility");
  return { square: at, visibility: "lit", piece };
}

export function parseEconomicBoundary(value: unknown): EconomicBoundary {
  const r = fieldsV2(value, ["version", "side", "ordinal", "phase", "turn", "planningOrdinal", "grantOrdinal", "seqBefore", "seqThrough", "groups", "snapshot"]);
  if (r.version !== "arena-economic-boundary-v1" || (r.side !== "w" && r.side !== "b") || !["initial", "turn-open", "settled"].includes(r.phase as string)) return bad("Invalid economic boundary header");
  let entries = 0;
  const groups = arrayV2(r.groups, MAX_ECONOMIC_GROUPS).map((value): AtomicGroup => {
    switch (tag(value)) {
      case "admission": {
        const g = fieldsV2(value, ["kind", "seq", "actions"]);
        const actions = arrayV2(g.actions, 4, 1).map(value => {
          const a = fieldsV2(value, ["actionRef", "action", "minerals", "gas"]);
          return { actionRef: actionRef(a.actionRef), action: parseActionV2(a.action), minerals: uint(a.minerals, 12), gas: uint(a.gas, 3) };
        });
        entries += actions.length; return { kind: "admission", seq: uint(g.seq), actions };
      }
      case "effects": {
        const g = fieldsV2(value, ["kind", "seq", "beforeOwn", "afterOwn", "facts"]);
        const facts = arrayV2(g.facts, MAX_ECONOMIC_ENTRIES, 1).map(effect);
        entries += facts.length;
        return { kind: "effects", seq: uint(g.seq), beforeOwn: parseOwnGeometry(g.beforeOwn), afterOwn: parseOwnGeometry(g.afterOwn), facts };
      }
      case "vision": {
        const g = fieldsV2(value, ["kind", "seq", "turn", "changes"]);
        const changes = arrayV2(g.changes, 64, 1).map(value => observedCell(value, r.side as Side));
        if (changes.some((c, i) => i > 0 && changes[i - 1]!.square >= c.square)) return bad("Noncanonical vision changes");
        return { kind: "vision", seq: uint(g.seq), turn: uint(g.turn, 45), changes };
      }
      case "settlement": {
        const g = fieldsV2(value, ["kind", "seq", "entitlement", "credited", "gasBeforeReset", "nextGasCapacity"]);
        return { kind: "settlement", seq: uint(g.seq), entitlement: uint(g.entitlement, 12), credited: uint(g.credited, 12), gasBeforeReset: uint(g.gasBeforeReset, 3), nextGasCapacity: uint(g.nextGasCapacity, 3, 1) };
      }
      default: return bad("Invalid atomic group kind");
    }
  });
  if (entries > MAX_ECONOMIC_ENTRIES) return bad("Boundary exceeds 2048 admission actions plus effect facts");
  const snapshot = parseViewV2(r.snapshot);
  const boundary: EconomicBoundary = { version: r.version, side: r.side, ordinal: uint(r.ordinal), phase: r.phase as EconomicBoundary["phase"], turn: uint(r.turn, 45), planningOrdinal: uint(r.planningOrdinal), grantOrdinal: uint(r.grantOrdinal), seqBefore: uint(r.seqBefore), seqThrough: uint(r.seqThrough), groups, snapshot };
  if (boundary.side !== snapshot.side || boundary.turn !== snapshot.turn || boundary.planningOrdinal !== boundary.grantOrdinal || boundary.seqThrough !== boundary.seqBefore + groups.length || groups.some((g, i) => g.seq !== boundary.seqBefore + i + 1)) return bad("Economic boundary sequence mismatch");
  if (boundary.phase === "initial" && (boundary.ordinal || boundary.planningOrdinal || boundary.seqBefore || groups.length)) return bad("Invalid initial boundary");
  return boundary;
}

export function parseEconomicJson(text: string): unknown {
  let pos = 0;
  const whitespace = () => { while (/[\x20\t\r\n]/.test(text[pos] ?? "x")) pos++; };
  const string = (): string => {
    const start = pos++;
    while (pos < text.length) {
      const char = text[pos++]!;
      if (char === "\\") pos++;
      else if (char === '"') {
        try { return JSON.parse(text.slice(start, pos)) as string; } catch { return bad("Invalid JSON string"); }
      }
    }
    return bad("Unterminated JSON string");
  };
  const value = (depth: number): unknown => {
    if (depth > 32) return bad("JSON nesting exceeds 32 levels");
    whitespace();
    const char = text[pos];
    if (char === '"') return string();
    if (char === "{") {
      pos++; whitespace(); const out: Record<string, unknown> = Object.create(null);
      if (text[pos] === "}") { pos++; return out; }
      for (;;) {
        whitespace(); if (text[pos] !== '"') return bad("Expected JSON object key");
        const key = string();
        if (Object.hasOwn(out, key)) return bad(`Duplicate JSON key: ${key}`);
        whitespace(); if (text[pos++] !== ":") return bad("Expected JSON colon");
        out[key] = value(depth + 1); whitespace();
        const separator = text[pos++];
        if (separator === "}") return out;
        if (separator !== ",") return bad("Expected JSON object separator");
      }
    }
    if (char === "[") {
      pos++; whitespace(); const out: unknown[] = [];
      if (text[pos] === "]") { pos++; return out; }
      for (;;) {
        out.push(value(depth + 1)); whitespace(); const separator = text[pos++];
        if (separator === "]") return out;
        if (separator !== ",") return bad("Expected JSON array separator");
      }
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(pos))?.[0];
    if (!token) return bad("Expected JSON value");
    pos += token.length; return JSON.parse(token) as unknown;
  };
  const result = value(0); whitespace();
  if (pos !== text.length) return bad("Trailing JSON data");
  return result;
}
