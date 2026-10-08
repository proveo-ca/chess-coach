// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml, _spec/packages/starchess-training/candidate-generation.puml
import type { PieceColor, ScPiece, Square } from "@chess-coach/starchess-core/planning-v1";

export const MAX_CODEC_BYTES = 1_048_576;
export const PIECE_TYPES = ["p", "n", "b", "r", "q", "k"] as const;
export const SPAWN_TYPES = ["p", "n", "b", "r", "q"] as const;
export class ContractError extends Error {
  constructor(readonly path: string, readonly code: string) {
    super(`${code}: ${path}`);
    this.name = "ContractError";
  }
}
export const fail = (path: string, code = "SCHEMA"): never => { throw new ContractError(path, code); };
export const inspectDto = (value: unknown, path = "$"): unknown => {
  const state = { seenWeakMap: new WeakMap<object, { copy: unknown; height: number }>(), ancestors: new Set<object>(), visits: 0, textbytes: 0 };
  const countText = (text: string, at: string): void => {
    if (text.length > MAX_CODEC_BYTES - state.textbytes) fail(at, "SIZE");
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index);
      let bytes = code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
      if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
        const next = text.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) { bytes = 4; index++; }
      }
      state.textbytes += bytes;
      if (state.textbytes > MAX_CODEC_BYTES) fail(at, "SIZE");
    }
  };
  const visit = (input: unknown, at: string, depth: number): { copy: unknown; height: number } => {
    if (depth > 16 || ++state.visits > 8192) fail(at, "SIZE");
    if (!input || typeof input !== "object") {
      if (typeof input === "function" || typeof input === "symbol") fail(at);
      if (typeof input === "string") countText(input, at);
      return { copy: input, height: 0 };
    }
    if (state.ancestors.has(input)) fail(at);
    const memo = state.seenWeakMap.get(input);
    if (memo) {
      if (depth + memo.height > 16) fail(at, "SIZE");
      return memo;
    }
    const isArray = Array.isArray(input);
    const prototype = Object.getPrototypeOf(input);
    if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail(at);
    const keys = Reflect.ownKeys(input);
    if (keys.length - (isArray ? 1 : 0) > 8192 - state.visits) fail(at, "SIZE");
    for (const key of keys) {
      if (typeof key !== "string") fail(at);
      countText(key as string, at);
    }
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const length = isArray ? descriptors.length?.value as number : 0;
    if (isArray && length > 8192 - state.visits) fail(at, "SIZE");
    if (isArray && keys.length !== length + 1) fail(at, "ARRAY");
    state.ancestors.add(input);
    const entries: [string, unknown][] = [];
    let height = 0;
    for (const key of keys as string[]) {
      const descriptor = descriptors[key]!;
      if (!Object.hasOwn(descriptor, "value")) fail(at);
      if (isArray && key === "length") continue;
      if (!descriptor.enumerable) fail(at);
      if (isArray && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length)) fail(at, "ARRAY");
      const child = visit(descriptor.value, isArray ? `${at}[${key}]` : `${at}.${key}`, depth + 1);
      entries.push([key, child.copy]);
      height = Math.max(height, child.height + 1);
    }
    state.ancestors.delete(input);
    const detached = Object.fromEntries(entries);
    const result = { copy: isArray ? Array.from({ length }, (_, index) => detached[String(index)]) : detached, height };
    state.seenWeakMap.set(input, result);
    return result;
  };
  return visit(value, path, 0).copy;
};
export const object = (value: unknown, path: string, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(path);
  const record = value as Record<string, unknown>;
  if (required.some((key) => !Object.hasOwn(record, key)) || Object.keys(record).some((key) => !required.includes(key) && !optional.includes(key))) return fail(path);
  return record;
};
export const integer = (value: unknown, path: string, min: number, max: number): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) return fail(path, "NUMBER");
  return value;
};
export const side = (value: unknown, path: string): PieceColor => value === "w" || value === "b" ? value : fail(path);
export const square = (value: unknown, path: string): Square => typeof value === "string" && /^[a-h][1-8]$/.test(value) ? value as Square : fail(path);
export const piece = (value: unknown, path: string): ScPiece => {
  const record = object(value, path, ["type", "color"]);
  if (!PIECE_TYPES.includes(record.type as ScPiece["type"])) return fail(`${path}.type`);
  return { type: record.type as ScPiece["type"], color: side(record.color, `${path}.color`) };
};
export const array = (value: unknown, path: string, max = 64): unknown[] => {
  if (!Array.isArray(value) || value.length > max || Reflect.ownKeys(value).length !== value.length + 1) return fail(path, "ARRAY");
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return fail(path, "ARRAY");
  }
  return value;
};
export const orderedSquares = <T>(entries: readonly T[], key: (entry: T) => string, path: string): void => {
  for (let index = 1; index < entries.length; index++) if (key(entries[index - 1]!) >= key(entries[index]!)) fail(path, "ORDER");
};
export const parseJson = (json: string): unknown => {
  if (typeof json !== "string" || json.length > MAX_CODEC_BYTES || new TextEncoder().encode(json).length > MAX_CODEC_BYTES) return fail("$", "SIZE");
  try { return JSON.parse(json) as unknown; } catch { return fail("$", "JSON"); }
};
