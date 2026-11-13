// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { ScPiece } from "../board/placement";
import { MAX_MINES_PER_SIDE } from "../board/mines";
import type { Square } from "../model/square";
import type { PlanningKnowledge } from "./planning-intents";

export type CountedPlanningKnowledge = Readonly<PlanningKnowledge> & Readonly<{ ownMineCount: number }>;

const fail = (): never => { throw new TypeError("Invalid counted planning knowledge"); };
const record = (value: unknown, keys: readonly string[]): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return fail();
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== "string" || !keys.includes(key))) return fail();
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return fail();
    result[key] = descriptor.value;
  }
  return result;
};
const square = (value: unknown): Square =>
  typeof value === "string" && /^[a-h][1-8]$/.test(value) ? value as Square : fail();
const piece = (value: unknown): ScPiece => {
  const r = record(value, ["type", "color"]);
  if (typeof r.type !== "string" || !["p", "n", "b", "r", "q", "k"].includes(r.type) ||
      (r.color !== "w" && r.color !== "b")) return fail();
  return Object.freeze({ type: r.type as ScPiece["type"], color: r.color });
};
const inventory = (value: unknown): Square[] => {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return fail();
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_MINES_PER_SIDE ||
      Reflect.ownKeys(value).length !== length + 1) return fail();
  const result: Square[] = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return fail();
    result.push(square(descriptor.value));
  }
  return result;
};
const readMap = (value: unknown): Map<Square, ScPiece> => {
  if (!value || Object.getPrototypeOf(value) !== Map.prototype || Reflect.ownKeys(value).length) return fail();
  const result = new Map<Square, ScPiece>();
  for (const [key, entry] of Map.prototype.entries.call(value) as MapIterator<[unknown, unknown]>) {
    if (result.size === 64) return fail();
    result.set(square(key), piece(entry));
  }
  return result;
};
const readSet = (value: unknown): Set<Square> => {
  if (!value || Object.getPrototypeOf(value) !== Set.prototype || Reflect.ownKeys(value).length) return fail();
  const result = new Set<Square>();
  for (const entry of Set.prototype.values.call(value) as SetIterator<unknown>) {
    if (result.size === 64) return fail();
    result.add(square(entry));
  }
  return result;
};
const readonlyMap = <K, V>(map: Map<K, V>): ReadonlyMap<K, V> => {
  const view: ReadonlyMap<K, V> = Object.freeze({
    size: map.size,
    get: (key: K) => map.get(key),
    has: (key: K) => map.has(key),
    entries: () => map.entries(),
    keys: () => map.keys(),
    values: () => map.values(),
    [Symbol.iterator]: () => map[Symbol.iterator](),
    forEach: (callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown) =>
      map.forEach((value, key) => callback.call(thisArg, value, key, view)),
  });
  return view;
};
const readonlySet = <T>(set: Set<T>): ReadonlySet<T> => {
  const view: ReadonlySet<T> = Object.freeze({
    size: set.size,
    has: (value: T) => set.has(value),
    entries: () => set.entries(),
    keys: () => set.keys(),
    values: () => set.values(),
    [Symbol.iterator]: () => set[Symbol.iterator](),
    forEach: (callback: (value: T, key: T, set: ReadonlySet<T>) => void, thisArg?: unknown) =>
      set.forEach(value => callback.call(thisArg, value, value, view)),
  });
  return view;
};

export const countedPlanningKnowledge = (
  knowledge: PlanningKnowledge,
  ownMineInventorySquares: readonly Square[],
): CountedPlanningKnowledge => {
  const r = record(knowledge, ["side", "knownPieces", "unknownSquares", "ownMines", "ownSiegedTanks"]);
  if (r.side !== "w" && r.side !== "b") return fail();
  const knownPieces = readMap(r.knownPieces);
  const unknownSquares = readSet(r.unknownSquares);
  const ownMines = readSet(r.ownMines);
  const ownSiegedTanks = readSet(r.ownSiegedTanks);
  const squares = inventory(ownMineInventorySquares);
  const locations = new Set(squares);
  if (locations.size !== ownMines.size || [...locations].some(at => !ownMines.has(at))) return fail();
  return Object.freeze({
    side: r.side,
    knownPieces: readonlyMap(knownPieces),
    unknownSquares: readonlySet(unknownSquares),
    ownMines: readonlySet(ownMines),
    ownSiegedTanks: readonlySet(ownSiegedTanks),
    ownMineCount: squares.length,
  });
};
