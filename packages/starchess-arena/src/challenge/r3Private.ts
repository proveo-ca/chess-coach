// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml, _spec/packages/starchess-arena/ml-adjutant-challenge-harness.puml
import { types as nodeTypes } from "node:util";
import type { ProvenanceCompanion } from "@chess-coach/starchess-core";
import { fail, integer } from "../authorized/v2/schema";

export const R3_PRIVATE_CAP = 16_777_216;
const isProxy = nodeTypes.isProxy;
const isArray = Array.isArray;
const isView = ArrayBuffer.isView;
const getPrototype = Object.getPrototypeOf;
const descriptor = Object.getOwnPropertyDescriptor;
const ownKeys = Reflect.ownKeys;
const apply = Reflect.apply;
const define = Object.defineProperty;
const create = Object.create;
const objectPrototype = Object.prototype;
const arrayPrototype = Array.prototype;
const Uint8 = Uint8Array;
const bytePrototype = Uint8Array.prototype;
const bufferPrototype = Buffer.prototype;
const typedPrototype = getPrototype(bytePrototype);
const typedName = descriptor(typedPrototype, Symbol.toStringTag)!.get!;
const typedByteLength = descriptor(typedPrototype, "byteLength")!.get!;
const typedSet = Uint8Array.prototype.set;

const privateByteLength = (input: unknown, path: string): number => {
  if (isProxy(input) || !isView(input) || apply(typedName, input, []) !== "Uint8Array") return fail(path, "SCHEMA");
  const length = apply(typedByteLength, input, []) as number;
  if (length > R3_PRIVATE_CAP) fail(path, "SIZE");
  const prototype = getPrototype(input);
  if (prototype !== bytePrototype && prototype !== bufferPrototype) fail(path, "SCHEMA");
  return length;
};
export const copyR3PrivateBytes = (input: unknown, path = "$.provenanceBytes"): Uint8Array => {
  const length = privateByteLength(input, path);
  const keys = ownKeys(input as object);
  if (keys.length !== length) fail(path, "SCHEMA");
  const result = new Uint8(length);
  try { apply(typedSet, result, [input]); }
  catch { return fail(path, "SCHEMA"); }
  return result;
};
export const equalR3PrivateBytes = (a: Uint8Array, b: Uint8Array): boolean => {
  const length = privateByteLength(a, "$.privateBytes");
  if (length !== privateByteLength(b, "$.privateBytes")) return false;
  for (let index = 0; index < length; index++) if (a[index] !== b[index]) return false;
  return true;
};

const plain = (input: unknown, path: string, array: boolean): object => {
  if (!input || typeof input !== "object" || isProxy(input)) return fail(path, "SCHEMA");
  const prototype = getPrototype(input);
  if (array ? prototype !== arrayPrototype : prototype !== objectPrototype && prototype !== null) fail(path, array ? "ARRAY" : "SCHEMA");
  return input;
};
const data = (input: object, key: PropertyKey, path: string): unknown => {
  const field = descriptor(input, key);
  if (!field || !Object.hasOwn(field, "value") || !field.enumerable) return fail(path, "SCHEMA");
  return field.value;
};
export const readR3Record = (input: unknown, path: string, fields: readonly string[]): Record<string, unknown> => {
  const source = plain(input, path, false);
  if (isArray(source)) return fail(path, "SCHEMA");
  const keys = ownKeys(source);
  if (keys.length !== fields.length || keys.some(key => typeof key !== "string" || !fields.includes(key))) fail(path, "SCHEMA");
  const result = create(null) as Record<string, unknown>;
  for (const key of fields) define(result, key, { value: data(source, key, `${path}.${key}`), enumerable: true, configurable: true, writable: true });
  return result;
};
const readR3Array = (input: unknown, path: string, max: number): unknown[] => {
  const source = plain(input, path, true);
  if (!isArray(source)) return fail(path, "ARRAY");
  const length = descriptor(source, "length")!.value as number;
  if (!Number.isSafeInteger(length) || length < 0 || length > max) fail(path, "CARDINALITY");
  if (ownKeys(source).length !== length + 1) fail(path, "ARRAY");
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const field = descriptor(source, String(index));
    if (!field || !Object.hasOwn(field, "value") || !field.enumerable) return fail(path, "ARRAY");
    define(result, String(index), { value: field.value, enumerable: true, configurable: true, writable: true });
  }
  return result;
};
const arrayCaps = new Map<string, number>([
  ["entities", 70], ["nativeMineOrder", 6], ["resolvedActions", 8], ["queries", 4], ["consumedFacts", 2],
  ["evaluatedSteps", 6], ["mines", 6], ["frames", 1152], ["effects", 1152], ["visibilityImages", 2304], ["visibilityCheckpoints", 2304],
  ["intents", 4], ["actions", 8], ["events", 2048], ["cells", 64], ["changes", 64], ["ownUnitLineage", 64], ["ownMineLineage", 3], ["memory", 64],
]);
export const detachR3Data = (input: unknown, path: string): unknown => {
  const ancestors = new Set<object>();
  let visits = 0, size = 0;
  const count = (text: string, at: string): void => {
    size += Buffer.byteLength(text, "utf8");
    if (size > R3_PRIVATE_CAP) fail(at, "SIZE");
  };
  const visit = (value: unknown, at: string, key: string, depth: number): unknown => {
    if (++visits > 4_000_000 || depth > 32) fail(at, "SIZE");
    if (value === undefined) { count("undefined", at); return value; }
    if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) {
      if (typeof value === "string" && value.length > R3_PRIVATE_CAP - size) fail(at, "SIZE");
      count(JSON.stringify(value), at); return value;
    }
    if (!value || typeof value !== "object" || isProxy(value) || ancestors.has(value)) return fail(at, "SCHEMA");
    ancestors.add(value);
    let result: unknown;
    if (isArray(value)) {
      const entries = readR3Array(value, at, arrayCaps.get(key) ?? 2304), copy: unknown[] = [];
      count("[]", at);
      for (const [index, entry] of entries.entries()) {
        count(",", at);
        define(copy, String(index), { value: visit(entry, `${at}[${index}]`, "", depth + 1), enumerable: true, configurable: true, writable: true });
      }
      result = copy;
    } else {
      const source = plain(value, at, false), keys = ownKeys(source);
      if (keys.length > 32 || keys.some(key => typeof key !== "string")) return fail(at, "SCHEMA");
      const copy = create(getPrototype(source)) as object;
      count("{}", at);
      for (const key of keys as string[]) {
        if (key.length > R3_PRIVATE_CAP - size) fail(at, "SIZE");
        count(`${JSON.stringify(key)}:,`, at);
        define(copy, key, { value: visit(data(source, key, `${at}.${key}`), `${at}.${key}`, key, depth + 1), enumerable: true, configurable: true, writable: true });
      }
      result = copy;
    }
    ancestors.delete(value);
    return result;
  };
  return visit(input, path, "", 0);
};

const shapes = new Map<string, readonly string[]>([
  ["root", ["provenance", "frames", "visibilityImages", "visibilityCheckpoints"]],
  ["provenance", ["version", "initialTurn", "turn", "stage", "callOrdinal", "unitCounter", "mineCounter", "entities", "ccLives", "nativeMineOrder", "resolvedActions", "lastCall"]],
  ["image", ["entities", "ccLives", "nativeMineOrder"]],
  ["entity:unit", ["id", "kind", "side", "type", "square", "tankMode"]], ["entity:mine", ["id", "kind", "side", "square"]],
  ["cc-lives", ["w", "b"]], ["resolved-action", ["sourceActionSeq", "side", "actionRef", "effectiveActorId"]],
  ["action-ref", ["planningOrdinal", "acceptedActionOrdinal"]], ["last-call", ["queries", "consumedFacts"]],
  ["frame", ["sourceEffectKey", "phase", "before", "after", "effects", "beforeVisibilityKey", "afterVisibilityKey"]],
  ["visibility-image", ["key", "ordinal", "turn", "phase", "state"]], ["checkpoint", ["ordinal", "imageKey", "frameKey", "point"]],
  ["query", ["sourceActionSeq", "site", "base", "from", "to", "side", "target", "visionInputs", "evaluatedSteps", "returnedStep", "consumption"]],
  ["vision-inputs", ["modeSource", "siegeMaskHex", "mineSource", "mines"]], ["vision-mine", ["color", "at"]], ["query-step", ["mid", "visible"]],
  ["fact", ["queryOrdinal", "sourceActionSeq", "side", "operation", "frameKey", "causalBeforeVisibilityKey", "evaluationActorId", "evaluationTargetId", "appliedActorId", "appliedTargetId", "turn", "targetCell"]],
  ["cell", ["square", "visibility", "piece"]], ["piece", ["type", "color"]],
  ["effect:unit-create", ["kind", "sourceActionSeq", "entity"]], ["effect:unit-move", ["kind", "sourceActionSeq", "entityId", "from", "to"]],
  ["effect:unit-transform", ["kind", "sourceActionSeq", "entityId", "fromType", "toType"]], ["effect:unit-destroy", ["kind", "sourceActionSeq", "entity", "causalBeforeVisibilityKey"]],
  ["effect:tank-mode-change", ["kind", "sourceActionSeq", "entityId", "before", "after"]], ["effect:mine-create", ["kind", "sourceActionSeq", "entity"]],
  ["effect:mine-remove", ["kind", "sourceActionSeq", "entityId"]], ["effect:cc-lives-change", ["kind", "sourceActionSeq", "side", "before", "after"]],
  ["effect:deployment-disposition", ["kind", "sourceActionSeq", "materializedEntityId"]],
]);
const arrays = new Map<string, Readonly<{ entry: string; max: number }>>([
  ["entities", { entry: "entity", max: 70 }], ["mine-order", { entry: "mine-id", max: 6 }], ["resolved-actions", { entry: "resolved-action", max: 8 }],
  ["frames", { entry: "frame", max: 1152 }], ["effects", { entry: "effect", max: 1152 }], ["images", { entry: "visibility-image", max: 2304 }],
  ["checkpoints", { entry: "checkpoint", max: 2304 }], ["queries", { entry: "query", max: 4 }], ["facts", { entry: "fact", max: 2 }],
  ["vision-mines", { entry: "vision-mine", max: 6 }], ["query-steps", { entry: "query-step", max: 6 }],
]);
const children = new Map<string, string>([
  ["root.provenance", "provenance"], ["root.frames", "frames"], ["root.visibilityImages", "images"], ["root.visibilityCheckpoints", "checkpoints"],
  ["provenance.entities", "entities"], ["provenance.ccLives", "cc-lives"], ["provenance.nativeMineOrder", "mine-order"],
  ["provenance.resolvedActions", "resolved-actions"], ["provenance.lastCall", "last-call"],
  ["image.entities", "entities"], ["image.ccLives", "cc-lives"], ["image.nativeMineOrder", "mine-order"], ["resolved-action.actionRef", "action-ref"],
  ["last-call.queries", "queries"], ["last-call.consumedFacts", "facts"], ["frame.before", "image"], ["frame.after", "image"], ["frame.effects", "effects"],
  ["visibility-image.state", "image"], ["query.base", "image"], ["query.visionInputs", "vision-inputs"], ["query.evaluatedSteps", "query-steps"],
  ["vision-inputs.mines", "vision-mines"], ["fact.targetCell", "cell"], ["cell.piece", "piece"],
  ["effect:unit-create.entity", "entity:unit"], ["effect:unit-destroy.entity", "entity:unit"], ["effect:mine-create.entity", "entity:mine"],
]);
const enums = new Map<string, readonly string[]>([
  ["version", ["engine-provenance-v1"]], ["stage", ["before-begin", "after-begin", "terminal"]],
  ["phase", ["turn-open", "B", "C-attack", "C-move", "C-path-reveal", "C-promotion", "F"]], ["side", ["w", "b"]], ["color", ["w", "b"]],
  ["type", ["p", "n", "b", "r", "q", "k"]], ["fromType", ["p", "n", "b", "r", "q", "k"]], ["toType", ["p", "n", "b", "r", "q"]],
  ["site", ["scan-ray", "reveal-to"]], ["consumption", ["not-deferred", "deferred-skipped", "applied-consumed"]],
  ["modeSource", ["default-tank", "native-sieged-set"]], ["mineSource", ["absent", "provided"]], ["operation", ["capture", "cc-shot"]],
  ["visibility", ["lit"]], ["point", ["before-frame", "after-frame"]],
]);
const numbers = new Map<string, readonly [number, number]>([
  ["initialTurn", [0, 45]], ["turn", [0, 45]], ["callOrdinal", [0, 90]], ["unitCounter", [0, 154]], ["mineCounter", [0, 276]],
  ["ordinal", [0, 2303]], ["planningOrdinal", [0, 63]], ["acceptedActionOrdinal", [0, 3]], ["sourceActionSeq", [0, 7]], ["queryOrdinal", [0, 3]],
]);
const id = (value: unknown, kind: "unit" | "mine", path: string): void => {
  if (typeof value !== "string" || !new RegExp(`^engine:${kind}:[1-9][0-9]*$`).test(value)) return fail(path, "SCHEMA");
  integer(Number(value.split(":")[2]), path, 1, kind === "unit" ? 154 : 276);
};
const localKey = (value: unknown, kind: "frame" | "image", path: string): void => {
  if (typeof value !== "string" || !new RegExp(`^engine:call:[1-9][0-9]*:${kind}:(0|[1-9][0-9]*)$`).test(value)) return fail(path, "SCHEMA");
  const parts = value.split(":");
  integer(Number(parts[2]), path, 1, 90); integer(Number(parts[4]), path, 0, kind === "frame" ? 1151 : 2303);
};
const scalar = (value: unknown, context: string, key: string, path: string): void => {
  if (context === "mine-id") return id(value, "mine", path);
  if (key === "kind") {
    if (value !== context.slice(context.indexOf(":") + 1)) fail(path, "SCHEMA");
    return;
  }
  if (["id", "entityId"].includes(key)) return id(value, context === "entity:mine" || context === "effect:mine-remove" ? "mine" : "unit", path);
  if (["effectiveActorId", "materializedEntityId"].includes(key)) { if (value !== null) id(value, "unit", path); return; }
  if (["evaluationActorId", "evaluationTargetId", "appliedActorId", "appliedTargetId"].includes(key)) return id(value, "unit", path);
  if (["sourceEffectKey", "frameKey"].includes(key)) return localKey(value, "frame", path);
  if (["key", "imageKey", "beforeVisibilityKey", "afterVisibilityKey", "causalBeforeVisibilityKey"].includes(key)) return localKey(value, "image", path);
  if (["square", "from", "to", "target", "mid", "at"].includes(key)) {
    if (typeof value !== "string" || !/^[a-h][1-8]$/.test(value)) fail(path, "SCHEMA");
    return;
  }
  if (key === "siegeMaskHex") { if (typeof value !== "string" || !/^[0-9a-f]{16}$/.test(value)) fail(path, "SCHEMA"); return; }
  if (key === "tankMode") { if (value !== null && value !== "tank" && value !== "siege") fail(path, "SCHEMA"); return; }
  if (key === "visible") { if (typeof value !== "boolean") fail(path, "SCHEMA"); return; }
  if (key === "returnedStep") { if (value !== null) integer(value, path, 1, 6); return; }
  if (context === "cc-lives" || context === "effect:cc-lives-change" && ["before", "after"].includes(key)) { integer(value, path, 0, 3); return; }
  if (context === "effect:tank-mode-change" && ["before", "after"].includes(key)) { if (value !== "tank" && value !== "siege") fail(path, "SCHEMA"); return; }
  if (key === "sourceActionSeq" && context.startsWith("effect:") && value === null) return;
  const domain = numbers.get(key);
  if (domain) { integer(value, path, domain[0], context === "fact" && key === "turn" ? 44 : domain[1]); return; }
  const choices = enums.get(key);
  if (!choices || typeof value !== "string" || !choices.includes(value)) fail(path, "SCHEMA");
};

export const encodeR3Provenance = (input: Pick<ProvenanceCompanion<unknown>, "provenance" | "frames" | "visibilityImages" | "visibilityCheckpoints">): Uint8Array => {
  const ancestors = new Set<object>(), chunks: string[] = [];
  let size = 0, visits = 0, effects = 0;
  const append = (text: string): void => { size += Buffer.byteLength(text, "utf8"); if (size > R3_PRIVATE_CAP) fail("$.private", "SIZE"); chunks.push(text); };
  const visit = (value: unknown, context: string, path: string, depth: number): void => {
    if (++visits > 4_000_000 || depth > 16) fail(path, "SIZE");
    if (context === "mine-id") { scalar(value, context, "", path); append(JSON.stringify(value)); return; }
    if (!value || typeof value !== "object" || isProxy(value) || ancestors.has(value)) return fail(path, "SCHEMA");
    ancestors.add(value);
    const list = arrays.get(context);
    if (list) {
      const entries = readR3Array(value, path, list.max);
      if (context === "effects" && (effects += entries.length) > 1152) fail(path, "CARDINALITY");
      append("[");
      for (const [index, entry] of entries.entries()) { if (index) append(","); visit(entry, list.entry, `${path}[${index}]`, depth + 1); }
      append("]");
    } else {
      if (context === "entity" || context === "effect") {
        const kind = data(plain(value, path, false), "kind", `${path}.kind`);
        if (typeof kind !== "string") return fail(path, "SCHEMA");
        context = `${context}:${kind}`;
      }
      const fields = shapes.get(context);
      if (!fields) return fail(path, "SCHEMA");
      const record = readR3Record(value, path, fields);
      append("{");
      for (const [index, [key, entry]] of Object.entries(record).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).entries()) {
        if (index) append(","); append(`${JSON.stringify(key)}:`);
        const child = children.get(`${context}.${key}`);
        if (child) visit(entry, child, `${path}.${key}`, depth + 1);
        else { scalar(entry, context, key, `${path}.${key}`); append(JSON.stringify(entry)); }
      }
      append("}");
    }
    ancestors.delete(value);
  };
  visit(input, "root", "$.private", 0);
  return new Uint8(Buffer.from(chunks.join(""), "utf8"));
};
