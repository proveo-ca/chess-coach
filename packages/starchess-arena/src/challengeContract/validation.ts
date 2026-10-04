// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml, _spec/packages/starchess-training/candidate-generation.puml
import type { PieceColor, ScPiece, Square } from "@chess-coach/starchess-core";

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
export const inspectDto = (value: unknown, path = "$", ancestors = new Set<object>()): unknown => {
  if (!value || typeof value !== "object") {
    if (typeof value === "function" || typeof value === "symbol") fail(path);
    return value;
  }
  if (ancestors.has(value)) fail(path);
  const isArray = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail(path);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string")) fail(path);
  const length = isArray ? descriptors.length?.value as number : 0;
  if (isArray && keys.length !== length + 1) fail(path, "ARRAY");
  ancestors.add(value);
  const entries: [string, unknown][] = [];
  for (const key of keys as string[]) {
    const descriptor = descriptors[key]!;
    if (!Object.hasOwn(descriptor, "value")) fail(`${path}.${key}`);
    if (isArray && key === "length") continue;
    if (!descriptor.enumerable) fail(`${path}.${key}`);
    if (isArray && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length)) fail(path, "ARRAY");
    entries.push([key, inspectDto(descriptor.value, isArray ? `${path}[${key}]` : `${path}.${key}`, ancestors)]);
  }
  ancestors.delete(value);
  const detached = Object.fromEntries(entries);
  return isArray ? Array.from({ length }, (_, index) => detached[String(index)]) : detached;
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
  if (typeof json !== "string" || new TextEncoder().encode(json).length > MAX_CODEC_BYTES) return fail("$", "SIZE");
  try { return JSON.parse(json) as unknown; } catch { return fail("$", "JSON"); }
};
