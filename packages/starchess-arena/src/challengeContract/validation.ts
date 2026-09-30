// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase2.puml
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
