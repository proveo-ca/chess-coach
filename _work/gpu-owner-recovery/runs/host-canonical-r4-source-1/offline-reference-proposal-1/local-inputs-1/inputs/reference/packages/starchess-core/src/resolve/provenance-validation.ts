// SPEC: _spec/packages/starchess-core/resolve.puml, _spec/packages/starchess-core/resolve-turn-activity.puml, _spec/packages/starchess-core/submit-turn-activity.puml
import type { Square } from "chess.js";
import { mapToPlacement, placementToMap } from "../board/placement";
import { rayBetween } from "../board/mines";
import { scOutcome } from "../outcome";
import type { ScAction, ScFenSnapshot } from "../model/types";
import type { ActionBindings, EngineProvenance, FrameImage, PathQueryRecord } from "./provenance-types";

class ProvenanceError extends Error {
  readonly path: string;
  readonly code: string;
  readonly name = "ContractError";
  constructor(path: string, code: string) {
    super(`${code}: ${path}`);
    this.path = path;
    this.code = code;
  }
}
export function fail(path: string, code = "SCHEMA"): never { throw new ProvenanceError(path, code); }

export function record(value: unknown, keys: readonly string[], path: string, optional: readonly string[] = []): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) fail(path);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some(key => typeof key !== "string" || ![...keys, ...optional].includes(key))) fail(path);
  for (const key of keys) if (!Object.hasOwn(descriptors, key)) fail(`${path}.${key}`);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!("value" in descriptor) || !descriptor.enumerable) fail(`${path}.${key}`);
  }
}

function array(value: unknown, cap: number, path: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length > cap) fail(path, "CARDINALITY");
  if (Object.getPrototypeOf(value) !== Array.prototype) fail(path, "ARRAY");
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1) fail(path, "ARRAY");
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) fail(path, "ARRAY");
  }
}

function integer(value: unknown, min: number, max: number, path: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max || Object.is(value, -0)) fail(path, "NUMBER");
}
function oneOf(value: unknown, values: readonly unknown[], path: string): void { if (!values.includes(value)) fail(path); }
function square(value: unknown, path: string): asserts value is Square { if (typeof value !== "string" || !/^[a-h][1-8]$/.test(value)) fail(path); }
function id(value: unknown, kind: "unit" | "mine", max: number, path: string): void {
  if (typeof value !== "string" || !new RegExp(`^engine:${kind}:[1-9][0-9]*$`).test(value)) fail(path, "IDENTITY");
  integer(Number(value.split(":")[2]), 1, max, path);
}
function lives(value: unknown, path: string, max = 3): void {
  record(value, ["w", "b"], path);
  integer(value.w, 0, max, `${path}.w`); integer(value.b, 0, max, `${path}.b`);
}

export function freezeDetached<T>(value: T): T {
  const visit = (item: unknown, seen: Set<object>, depth: number): unknown => {
    if (item === null || typeof item === "string" || typeof item === "boolean" || typeof item === "number") return item;
    if (!item || typeof item !== "object" || depth > 20 || seen.has(item)) fail("$", "SCHEMA");
    seen.add(item);
    let out: unknown;
    if (Array.isArray(item)) {
      array(item, 2304, "$");
      out = Object.freeze(item.map(v => visit(v, seen, depth + 1)));
    } else {
      record(item, Object.keys(item), "$");
      out = Object.freeze(Object.fromEntries(Object.entries(item).map(([key, val]) => [key, visit(val, seen, depth + 1)])));
    }
    seen.delete(item);
    return out;
  };
  return visit(value, new Set(), 0) as T;
}

export function validateImage(value: unknown, path: string): asserts value is FrameImage {
  record(value, ["entities", "ccLives", "nativeMineOrder"], path);
  array(value.entities, 70, `${path}.entities`); lives(value.ccLives, `${path}.ccLives`);
  array(value.nativeMineOrder, 6, `${path}.nativeMineOrder`);
  const occupied = new Set<string>();
  const ids = new Set<string>();
  const mineIds = new Set<string>();
  const cc = { w: 0, b: 0 }; const mines = { w: 0, b: 0 };
  let previous = "";
  for (const entity of value.entities) {
    record(entity, ["id", "kind", "side", "square"], `${path}.entity`, ["type", "tankMode"]);
    oneOf(entity.side, ["w", "b"], `${path}.entity.side`); square(entity.square, `${path}.entity.square`);
    const side = entity.side as "w" | "b";
    if (entity.kind === "unit") {
      record(entity, ["id", "kind", "side", "square", "type", "tankMode"], `${path}.unit`);
      id(entity.id, "unit", 154, `${path}.id`);
      oneOf(entity.type, ["p", "n", "b", "r", "q", "k"], `${path}.type`);
      oneOf(entity.tankMode, entity.type === "r" ? ["tank", "siege"] : [null], `${path}.tankMode`);
      if (occupied.has(entity.square)) fail(path, "CONSISTENCY");
      occupied.add(entity.square);
      if (entity.type === "k") cc[side]++;
    } else if (entity.kind === "mine") {
      record(entity, ["id", "kind", "side", "square"], `${path}.mine`);
      id(entity.id, "mine", 276, `${path}.id`); mines[side]++;
      mineIds.add(entity.id as string);
    } else fail(`${path}.kind`);
    const current = entity.id as string;
    if (current <= previous || ids.has(current)) fail(path, "ORDER");
    previous = current; ids.add(current);
  }
  if (cc.w !== 1 || cc.b !== 1 || mines.w > 3 || mines.b > 3) fail(path, "CONSISTENCY");
  if (mineIds.size !== value.nativeMineOrder.length || new Set(value.nativeMineOrder).size !== mineIds.size || value.nativeMineOrder.some(key => !mineIds.has(key as string))) fail(`${path}.nativeMineOrder`, "IDENTITY");
}

export function validateSnapshot(snapshot: ScFenSnapshot, opening = false): void {
  record(snapshot, ["placement", "turn", "ccLives", "phase", "gas", "gasIncome"], "$.snapshot", ["stored", "specialsUsed", "queue", "mines", "siegedTanks", "pendingCCShots"]);
  integer(snapshot.turn, 0, 45, "$.snapshot.turn");
  lives(snapshot.ccLives, "$.snapshot.ccLives"); lives(snapshot.gas, "$.snapshot.gas"); lives(snapshot.gasIncome, "$.snapshot.gasIncome");
  oneOf(snapshot.phase, ["P", "B", "A", "M", "F", "O"], "$.snapshot.phase");
  if (typeof snapshot.placement !== "string" || snapshot.placement.length > 127) fail("$.snapshot.placement");
  const ranks = snapshot.placement.split("/");
  if (ranks.length !== 8 || ranks.some(rank => !/^[1-8pnbrqkPNBRQK]+$/.test(rank) || [...rank].reduce((n, ch) => n + (/^[1-8]$/.test(ch) ? Number(ch) : 1), 0) !== 8)) fail("$.snapshot.placement");
  const pieces = [...placementToMap(snapshot.placement).values()];
  for (const side of ["w", "b"] as const) if (pieces.filter(p => p.color === side && p.type === "k").length !== 1) fail("$.snapshot.placement", "CONSISTENCY");
  if (snapshot.stored !== undefined) lives(snapshot.stored, "$.snapshot.stored", 12);
  for (const field of ["specialsUsed", "siegedTanks"] as const) {
    if (snapshot[field] !== undefined) {
      array(snapshot[field], 64, `$.snapshot.${field}`);
      for (const at of snapshot[field]) square(at, `$.snapshot.${field}`);
      if (new Set(snapshot[field]).size !== snapshot[field].length) fail(`$.snapshot.${field}`, "DUPLICATE");
    }
  }
  if (snapshot.pendingCCShots !== undefined) {
    array(snapshot.pendingCCShots, 64, "$.snapshot.pendingCCShots");
    for (const shot of snapshot.pendingCCShots) {
      record(shot, ["color", "piece", "from", "to"], "$.snapshot.pendingCCShots");
      oneOf(shot.color, ["w", "b"], "$.shot.color"); oneOf(shot.piece, ["p", "n", "b", "r", "q", "k"], "$.shot.piece");
      square(shot.from, "$.shot.from"); square(shot.to, "$.shot.to");
    }
  }
  if (snapshot.mines !== undefined) array(snapshot.mines, 6, "$.snapshot.mines");
  const seen = new Set<string>(); const counts = { w: 0, b: 0 };
  for (const mine of snapshot.mines ?? []) {
    record(mine, ["color", "at"], "$.snapshot.mines");
    oneOf(mine.color, ["w", "b"], "$.mine.color"); square(mine.at, "$.mine.at");
    if (++counts[mine.color] > 3) fail("$.snapshot.mines", "CARDINALITY");
    const key = `${mine.color}:${mine.at}`;
    if (opening && seen.has(key)) fail("$.snapshot.mines", "DUPLICATE");
    seen.add(key);
  }
  if (snapshot.queue !== undefined) {
    record(snapshot.queue, ["actions"], "$.snapshot.queue");
    array(snapshot.queue.actions, 8, "$.snapshot.queue.actions");
    for (const action of snapshot.queue.actions) {
      record(action, ["kind", "timing", "color", "from", "seq"], "$.snapshot.action", ["to", "unit", "promotion"]);
      oneOf(action.kind, ["classical", "stimStep", "tacticalJump", "spiderMine", "charonMissiles", "deploy", "siegeMode"], "$.action.kind");
      oneOf(action.timing, ["B", "C", "F"], "$.action.timing"); oneOf(action.color, ["w", "b"], "$.action.color");
      square(action.from, "$.action.from"); integer(action.seq, 0, 7, "$.action.seq");
      if (action.to !== undefined) square(action.to, "$.action.to");
      for (const field of ["unit", "promotion"] as const) {
        const value = (action as unknown as Record<string, unknown>)[field];
        if (value !== undefined) oneOf(value, ["p", "n", "b", "r", "q"], `$.action.${field}`);
      }
      if ((action.kind === "classical") !== (action.timing === "C") || (action.timing === "C" && !action.to)) fail("$.action");
    }
  }
}

export function reconcile(image: FrameImage, snapshot: ScFenSnapshot): void {
  const map = new Map(image.entities.filter(e => e.kind === "unit").map(e => [e.square, { type: e.type, color: e.side }]));
  if (mapToPlacement(map) !== mapToPlacement(placementToMap(snapshot.placement)) || image.ccLives.w !== snapshot.ccLives.w || image.ccLives.b !== snapshot.ccLives.b) fail("$.snapshot", "CONSISTENCY");
  for (const entity of image.entities) if (entity.kind === "unit" && entity.type === "r" && entity.tankMode !== (snapshot.siegedTanks?.includes(entity.square) ? "siege" : "tank")) fail("$.snapshot.siegedTanks", "CONSISTENCY");
  const mines = snapshot.mines ?? [];
  if (mines.length !== image.nativeMineOrder.length) fail("$.snapshot.mines", "CONSISTENCY");
  for (let i = 0; i < mines.length; i++) {
    const entity = image.entities.find(e => e.id === image.nativeMineOrder[i]);
    if (!entity || entity.kind !== "mine" || entity.square !== mines[i]!.at || entity.side !== mines[i]!.color) fail("$.snapshot.mines", "CONSISTENCY");
  }
}

function binding(value: unknown, path: string, resolved: boolean, unitCounter = 154): void {
  record(value, resolved ? ["sourceActionSeq", "side", "actionRef", "effectiveActorId"] : ["sourceActionSeq", "side", "actionRef"], path);
  integer(value.sourceActionSeq, 0, 7, `${path}.sourceActionSeq`); oneOf(value.side, ["w", "b"], `${path}.side`);
  record(value.actionRef, ["planningOrdinal", "acceptedActionOrdinal"], `${path}.actionRef`);
  integer(value.actionRef.planningOrdinal, 0, 63, `${path}.planningOrdinal`); integer(value.actionRef.acceptedActionOrdinal, 0, 3, `${path}.acceptedActionOrdinal`);
  if (resolved && value.effectiveActorId !== null) id(value.effectiveActorId, "unit", unitCounter, `${path}.effectiveActorId`);
}

export function validateBindings(bindings: ActionBindings, actions: readonly ScAction[], planningOrdinal: number): void {
  array(bindings, 8, "$.actionBindings");
  if (bindings.length !== actions.length) fail("$.actionBindings", "CARDINALITY");
  const ordinals = { w: 0, b: 0 }; const classical = { w: 0, b: 0 }; const deploys = { w: 0, b: 0 }; const origins = { w: new Set<Square>(), b: new Set<Square>() };
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!; const entry = bindings[i]!;
    binding(entry, "$.actionBindings", false);
    if (action.seq !== i || entry.sourceActionSeq !== i || entry.side !== action.color || entry.actionRef.planningOrdinal !== planningOrdinal || entry.actionRef.acceptedActionOrdinal !== ordinals[action.color]++) fail("$.actionBindings", "SEQUENCE");
    if (action.kind === "classical") {
      if (++classical[action.color] > 1) fail("$.queue", "CARDINALITY");
    } else {
      if (origins[action.color].has(action.from)) fail("$.queue", "DUPLICATE");
      origins[action.color].add(action.from);
      if (action.kind === "deploy" && ++deploys[action.color] > 1) fail("$.queue", "CARDINALITY");
    }
  }
}

function validateQuery(value: unknown, path: string, unitCounter: number, mineCounter: number): asserts value is PathQueryRecord {
  record(value, ["sourceActionSeq", "site", "base", "from", "to", "side", "target", "visionInputs", "evaluatedSteps", "returnedStep", "consumption"], path);
  integer(value.sourceActionSeq, 0, 7, `${path}.sourceActionSeq`); oneOf(value.site, ["scan-ray", "reveal-to"], path); oneOf(value.side, ["w", "b"], path);
  for (const field of ["from", "to", "target"]) square(value[field], `${path}.${field}`);
  validateImage(value.base, `${path}.base`);
  for (const e of value.base.entities) id(e.id, e.kind, e.kind === "unit" ? unitCounter : mineCounter, path);
  record(value.visionInputs, ["modeSource", "siegeMaskHex", "mineSource", "mines"], `${path}.visionInputs`);
  const inputs = value.visionInputs;
  oneOf(inputs.modeSource, ["default-tank", "native-sieged-set"], path); oneOf(inputs.mineSource, ["absent", "provided"], path);
  if (typeof inputs.siegeMaskHex !== "string" || !/^[0-9a-f]{16}$/.test(inputs.siegeMaskHex) || (inputs.modeSource === "default-tank" && inputs.siegeMaskHex !== "0000000000000000")) fail(path);
  array(inputs.mines, 6, `${path}.mines`); const counts = { w: 0, b: 0 };
  if (inputs.mineSource === "absent" && inputs.mines.length) fail(path, "CONSISTENCY");
  for (const mine of inputs.mines) {
    record(mine, ["color", "at"], path); oneOf(mine.color, ["w", "b"], path); square(mine.at, path);
    if (++counts[mine.color as "w" | "b"] > 3) fail(path, "CARDINALITY");
  }
  array(value.evaluatedSteps, 6, `${path}.evaluatedSteps`);
  const mids = rayBetween(value.from as Square, value.to as Square);
  const actor = value.base.entities.find(e => e.kind === "unit" && e.square === value.from);
  if (!actor || actor.kind !== "unit" || actor.side !== value.side) fail(`${path}.actor`, "CONSISTENCY");
  for (let i = 0; i < value.evaluatedSteps.length; i++) {
    const step = value.evaluatedSteps[i]; record(step, ["mid", "visible"], path); square(step.mid, path);
    if (typeof step.visible !== "boolean" || step.mid !== mids[i] || (step.visible && i !== value.evaluatedSteps.length - 1)) fail(path, "CONSISTENCY");
  }
  if (value.returnedStep !== null) {
    integer(value.returnedStep, 1, 6, path);
    if (value.returnedStep !== value.evaluatedSteps.length || !(value.evaluatedSteps.at(-1) as { visible: boolean }).visible) fail(path, "CONSISTENCY");
  } else if (value.evaluatedSteps.length !== mids.length || value.evaluatedSteps.some(step => (step as { visible: boolean }).visible)) fail(path, "CONSISTENCY");
  oneOf(value.consumption, ["not-deferred", "deferred-skipped", "applied-consumed"], path);
  if (value.consumption !== "not-deferred" && value.returnedStep === null) fail(path, "CONSISTENCY");
}

export function validateProvenance(value: unknown): asserts value is EngineProvenance {
  record(value, ["version", "initialTurn", "turn", "stage", "callOrdinal", "unitCounter", "mineCounter", "entities", "ccLives", "nativeMineOrder", "resolvedActions", "lastCall"], "$.provenance");
  if (value.version !== "engine-provenance-v1") fail("$.provenance.version", "VERSION");
  integer(value.initialTurn, 0, 45, "$.initialTurn"); integer(value.turn, value.initialTurn, 45, "$.turn");
  const remaining = 45 - value.initialTurn;
  integer(value.callOrdinal, 0, 2 * remaining, "$.callOrdinal");
  const settlements = Math.floor(value.callOrdinal / 2);
  integer(value.unitCounter, 0, 64 + 2 * settlements, "$.unitCounter"); integer(value.mineCounter, 0, 6 + 6 * settlements, "$.mineCounter");
  validateImage({ entities: value.entities, ccLives: value.ccLives, nativeMineOrder: value.nativeMineOrder }, "$.provenance.image");
  for (const e of value.entities as FrameImage["entities"]) id(e.id, e.kind, e.kind === "unit" ? value.unitCounter : value.mineCounter, "$.entity.id");
  oneOf(value.stage, ["before-begin", "after-begin", "terminal"], "$.stage");
  const ccLives = value.ccLives as { w: number; b: number };
  const terminal = scOutcome({ turn: value.turn, ccLives }) !== null;
  const odd = value.callOrdinal % 2 === 1;
  if ((value.stage === "terminal") !== terminal || (terminal && odd && ccLives.w !== 0 && ccLives.b !== 0) || (value.stage === "before-begin" && odd) || (value.stage === "after-begin" && !odd) || value.turn !== value.initialTurn + settlements + (terminal && odd ? 1 : 0) || (!terminal && settlements >= remaining)) fail("$.provenance.stage", "SEQUENCE");
  array(value.resolvedActions, 8, "$.resolvedActions");
  const ordinals = { w: 0, b: 0 };
  for (let i = 0; i < value.resolvedActions.length; i++) {
    const entry = value.resolvedActions[i]; binding(entry, "$.resolvedActions", true, value.unitCounter);
    const bound = entry as EngineProvenance["resolvedActions"][number];
    if (bound.sourceActionSeq !== i || bound.actionRef.planningOrdinal !== settlements - 1 || bound.actionRef.acceptedActionOrdinal !== ordinals[bound.side]++) fail("$.resolvedActions", "SEQUENCE");
  }
  record(value.lastCall, ["queries", "consumedFacts"], "$.lastCall");
  array(value.lastCall.queries, 4, "$.lastCall.queries"); array(value.lastCall.consumedFacts, 2, "$.lastCall.consumedFacts");
  if ((odd || value.callOrdinal === 0) && (value.resolvedActions.length || value.lastCall.queries.length || value.lastCall.consumedFacts.length)) fail("$.lastCall", "CONSISTENCY");
  const querySites = new Set<string>();
  const querySources = new Map<string, number>();
  for (const query of value.lastCall.queries) {
    validateQuery(query, "$.lastCall.queries", value.unitCounter, value.mineCounter);
    const source = (value.resolvedActions as EngineProvenance["resolvedActions"])[query.sourceActionSeq];
    if (!source || source.side !== query.side) fail("$.query.source", "PROVENANCE");
    const site = `${query.side}:${query.site}`;
    if (querySites.has(site) || (querySources.has(query.side) && querySources.get(query.side) !== query.sourceActionSeq)) fail("$.query.site", "PROVENANCE");
    querySites.add(site); querySources.set(query.side, query.sourceActionSeq);
  }
  const used = new Set<number>(); const sides = new Set<string>(); let frameOrdinal = -1;
  for (const proof of value.lastCall.consumedFacts) {
    record(proof, ["queryOrdinal", "sourceActionSeq", "side", "operation", "frameKey", "causalBeforeVisibilityKey", "evaluationActorId", "evaluationTargetId", "appliedActorId", "appliedTargetId", "turn", "targetCell"], "$.proof");
    integer(proof.queryOrdinal, 0, 3, "$.proof.queryOrdinal"); integer(proof.sourceActionSeq, 0, 7, "$.proof.sourceActionSeq"); integer(proof.turn, 0, 44, "$.proof.turn");
    oneOf(proof.side, ["w", "b"], "$.proof.side"); oneOf(proof.operation, ["capture", "cc-shot"], "$.proof.operation");
    for (const field of ["evaluationActorId", "evaluationTargetId", "appliedActorId", "appliedTargetId"]) id(proof[field], "unit", value.unitCounter, `$.proof.${field}`);
    const frameMatch = typeof proof.frameKey === "string" && new RegExp(`^engine:call:${value.callOrdinal}:frame:(0|[1-9][0-9]*)$`).exec(proof.frameKey);
    const imageMatch = typeof proof.causalBeforeVisibilityKey === "string" && new RegExp(`^engine:call:${value.callOrdinal}:image:(0|[1-9][0-9]*)$`).exec(proof.causalBeforeVisibilityKey);
    if (!frameMatch || !imageMatch || Number(frameMatch[1]) > 1151 || Number(imageMatch[1]) !== 2 * Number(frameMatch[1]) || Number(frameMatch[1]) <= frameOrdinal) fail("$.proof.key", "PROVENANCE");
    frameOrdinal = Number(frameMatch[1]);
    record(proof.targetCell, ["square", "visibility", "piece"], "$.proof.targetCell"); square(proof.targetCell.square, "$.proof.square"); oneOf(proof.targetCell.visibility, ["lit"], "$.proof.visibility");
    record(proof.targetCell.piece, ["type", "color"], "$.proof.piece"); oneOf(proof.targetCell.piece.type, proof.operation === "capture" ? ["p", "n", "b", "r", "q"] : ["k"], "$.proof.type");
    oneOf(proof.targetCell.piece.color, [proof.side === "w" ? "b" : "w"], "$.proof.color");
    const query = value.lastCall.queries[proof.queryOrdinal] as PathQueryRecord | undefined;
    if (!query || query.consumption !== "applied-consumed" || query.sourceActionSeq !== proof.sourceActionSeq || query.side !== proof.side || query.target !== proof.targetCell.square || proof.turn !== value.turn - 1 || used.has(proof.queryOrdinal) || sides.has(proof.side as string)) fail("$.proof", "PROVENANCE");
    const evalActor = query.base.entities.find(e => e.id === proof.evaluationActorId);
    const evalTarget = query.base.entities.find(e => e.id === proof.evaluationTargetId);
    if (!evalActor || evalActor.kind !== "unit" || evalActor.square !== query.from || evalActor.side !== proof.side || !evalTarget || evalTarget.kind !== "unit" || evalTarget.square !== query.target || evalTarget.type !== proof.targetCell.piece.type || evalTarget.side !== proof.targetCell.piece.color) fail("$.proof.operands", "IDENTITY");
    used.add(proof.queryOrdinal); sides.add(proof.side as string);
  }
  for (let i = 0; i < value.lastCall.queries.length; i++) if (((value.lastCall.queries[i] as PathQueryRecord).consumption === "applied-consumed") !== used.has(i)) fail("$.queries.consumption", "PROVENANCE");
}
