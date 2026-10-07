import { UNIT_COST } from "@chess-coach/starchess-core/planning-v1";
import { fail, MAX_CODEC_BYTES } from "../../challengeContract/validation";
import type { AuthorizedPiece, ObservedCell, OwnActionRef, Side, SpawnPiece, Square, UnitType } from "./types";

export { fail, MAX_CODEC_BYTES };
export const SQUARES = Array.from({ length: 64 }, (_, i) => `${"abcdefgh"[Math.floor(i / 8)]}${i % 8 + 1}` as Square);
export const object = (value: unknown, path: string, keys: readonly string[]): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(path);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return fail(path);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== "string" || !keys.includes(key))) return fail(path);
  const entries: [string, unknown][] = [];
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return fail(`${path}.${key}`);
    entries.push([key, descriptor.value]);
  }
  return Object.fromEntries(entries);
};
export const tag = (value: unknown, path: string, key: string): unknown => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(path);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return fail(path);
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return fail(`${path}.${key}`);
  return descriptor.value;
};
export const array = <T>(value: unknown, path: string, max: number, read: (v: unknown, p: string, i: number) => T, min = 0): T[] => {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return fail(path, "ARRAY");
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isSafeInteger(length) || length < min || length > max) return fail(path, "CARDINALITY");
  if (Reflect.ownKeys(value).length !== length + 1) return fail(path, "ARRAY");
  const result: T[] = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return fail(`${path}[${i}]`, "ARRAY");
    result.push(read(descriptor.value, `${path}[${i}]`, i));
  }
  return result;
};
export const integer = (v: unknown, p: string, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) return fail(p, typeof v === "number" ? "NONFINITE" : "NUMBER");
  return Number.isSafeInteger(v) && !Object.is(v, -0) && v >= min && v <= max ? v : fail(p, "NUMBER");
};
export const literal = <T extends string | number | null>(v: unknown, p: string, expected: T): T => Object.is(v, expected) ? expected : fail(p);
export const version = <T extends string>(v: unknown, p: string, expected: T): T => v === expected ? expected : fail(p, "VERSION");
export const side = (v: unknown, p: string): Side => v === "w" || v === "b" ? v : fail(p, "SIDE");
export const square = (v: unknown, p: string): Square => typeof v === "string" && /^[a-h][1-8]$/.test(v) ? v as Square : fail(p);
export const unitType = (v: unknown, p: string, spawn = false): UnitType =>
  typeof v === "string" && (spawn ? ["p", "n", "b", "r", "q"] : ["p", "n", "b", "r", "q", "k"]).includes(v) ? v as UnitType : fail(p);
export const spawn = (v: unknown, p: string): SpawnPiece => unitType(v, p, true) as SpawnPiece;
export const replacement = (type: UnitType): number => type === "k" ? 0 : UNIT_COST[type];
export const piece = (v: unknown, p: string): AuthorizedPiece => {
  const r = object(v, p, ["type", "color"]);
  return { type: unitType(r.type, `${p}.type`), color: side(r.color, `${p}.color`) };
};
export const ordered = <T>(values: readonly T[], key: (v: T) => string, p: string): void => {
  for (let i = 1; i < values.length; i++) if (key(values[i - 1]!) >= key(values[i]!)) fail(p, "ORDER");
};
export const squares = (v: unknown, p: string, max = 64): Square[] => {
  const result = array(v, p, max, square);
  ordered(result, x => x, p);
  return result;
};
export const id = (v: unknown, p: string, color: Side, kind: "unit" | "mine" | "receipt" | "witness"): string => {
  if (typeof v !== "string" || v.length > 64) return fail(p, "IDENTITY");
  const prefix = `${color}:${kind}:`;
  if (!v.startsWith(prefix)) return fail(p, "SIDE");
  const suffix = v.slice(prefix.length);
  if (kind === "unit" || kind === "mine") {
    if (/^opening:[a-h][1-8]$/.test(suffix)) return v;
    if (!/^created:[1-9][0-9]*$/.test(suffix)) return fail(p, "IDENTITY");
    integer(Number(suffix.slice(8)), p, 1, kind === "unit" ? 64 : 192);
  } else if (kind === "receipt") {
    if (!/^(0|[1-9][0-9]*):(0|[1-9][0-9]*)$/.test(suffix)) return fail(p, "IDENTITY");
    const [planning, action] = suffix.split(":").map(Number);
    integer(planning, p, 0, 63); integer(action, p, 0, 3);
  } else {
    if (!/^[1-9][0-9]*$/.test(suffix)) return fail(p, "IDENTITY");
    integer(Number(suffix), p, 1, 128);
  }
  return v;
};
export const actionRef = (v: unknown, p: string): OwnActionRef => {
  const r = object(v, p, ["planningOrdinal", "acceptedActionOrdinal"]);
  return { planningOrdinal: integer(r.planningOrdinal, `${p}.planningOrdinal`, 0, 63), acceptedActionOrdinal: integer(r.acceptedActionOrdinal, `${p}.acceptedActionOrdinal`, 0, 3) };
};
export const cell = (v: unknown, p: string, color: Side): ObservedCell => {
  const visibility = tag(v, p, "visibility");
  const r = object(v, p, visibility === "unknown" ? ["square", "visibility"] : ["square", "visibility", "piece"]);
  const at = square(r.square, `${p}.square`);
  if (visibility === "unknown") return { square: at, visibility };
  if (visibility !== "lit" && visibility !== "revealed") return fail(`${p}.visibility`);
  const current = r.piece === null ? null : piece(r.piece, `${p}.piece`);
  if (visibility === "revealed") {
    if (!current || current.type !== "q" || current.color === color) return fail(`${p}.piece`, "CONSISTENCY");
    return { square: at, visibility, piece: current };
  }
  return { square: at, visibility, piece: current };
};
export const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const r = value as Record<string, unknown>;
    return `{${Object.keys(r).sort().map(k => `${JSON.stringify(k)}:${canonical(r[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
export const equal = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
export const freeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !ArrayBuffer.isView(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const bytes = (value: unknown): Uint8Array => {
  const text = canonical(value);
  if (text.length > MAX_CODEC_BYTES) return fail("$", "SIZE");
  const encoded = new TextEncoder().encode(text);
  if (encoded.byteLength > MAX_CODEC_BYTES) return fail("$", "SIZE");
  return encoded;
};
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedArrayName = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)!.get!;
const typedArrayByteLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, "byteLength")!.get!;
const typedArraySet = Uint8Array.prototype.set;
const checkedByteLength = (input: Uint8Array, path = "$"): number => {
  if (!ArrayBuffer.isView(input) || Reflect.apply(typedArrayName, input, []) !== "Uint8Array") return fail(path);
  const length = Reflect.apply(typedArrayByteLength, input, []) as number;
  if (length > MAX_CODEC_BYTES) return fail("$", "SIZE");
  return length;
};
export const copyBytes = (input: Uint8Array, path = "$"): Uint8Array => {
  const length = checkedByteLength(input, path);
  const copy = new Uint8Array(length);
  try { Reflect.apply(typedArraySet, copy, [input]); }
  catch { return fail(path); }
  return copy;
};
export const byteEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  const length = checkedByteLength(a);
  if (length !== checkedByteLength(b)) return false;
  for (let i = 0; i < length; i++) if (a[i] !== b[i]) return false;
  return true;
};
export const parseBytes = (input: Uint8Array): unknown => {
  const copy = copyBytes(input);
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(copy)); }
  catch { return fail("$", "JSON"); }
};
