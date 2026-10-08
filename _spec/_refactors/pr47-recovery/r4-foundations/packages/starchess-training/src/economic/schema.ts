// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type {
  AuthorizedBoundaryBatch, AuthorizedEvent, AuthorizedOwnState, AuthorizedPiece, AuthorizedSnapshotV2,
  EconomicState, ObservedCell, OwnMineLineage, OwnUnitLineage, PaidReceipt, Side, Sighting, Square, UnitType,
} from "@chess-coach/starchess-arena/observations";
import { BAND_STARTS, ECONOMIC_BYTE_CAP, JOINT_SIZE } from "./contracts";
import type { Bin, ByteRef, CheckedBoundary, Component, EconomicArtifact, EconomicBeliefState, EconomicReadout, EconomicRecipe, H, History, Meter, PublicOpening, Table, TransitionRow, EvidenceRow } from "./contracts";
import { decodeFloat64, encodeFloat64, validateFloat64 } from "./float64";
import { assertClosedOwnKeys, charge, fail, type ValidationMeter } from "./work";

export const readObject = (value: unknown, meter: ValidationMeter, path: string, keys: readonly string[]): Record<string, unknown> => {
  charge(meter, 5, path);
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(path);
  const proto = Object.getPrototypeOf(value);
  charge(meter, 4, path);
  if (proto !== Object.prototype && proto !== null) return fail(path);
  assertClosedOwnKeys(value, keys, meter, path);
  charge(meter, 1, path);
  const result: Record<string, unknown> = {};
  for (let i = 0; ; ) {
    charge(meter, 1, path);
    if (i === keys.length) break;
    charge(meter, 7, path);
    const key = keys[i]!;
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !Object.hasOwn(d, "value") || !d.enumerable) return fail(`${path}.${key}`);
    charge(meter, 2, path);
    Object.defineProperty(result, key, { value: d.value, enumerable: true, writable: true, configurable: true });
    i++;
  }
  return result;
};
export const readTag = (value: unknown, key: string, meter: ValidationMeter, path: string): unknown => {
  charge(meter, 6, path);
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(path);
  const proto = Object.getPrototypeOf(value);
  charge(meter, 7, path);
  const d = Object.getOwnPropertyDescriptor(value, key);
  if ((proto !== Object.prototype && proto !== null) || !d || !Object.hasOwn(d, "value") || !d.enumerable) return fail(`${path}.${key}`);
  return d.value;
};
export const readArrayLength = (value: unknown, meter: ValidationMeter, path: string, min: number, max: number): number => {
  charge(meter, 3, path);
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return fail(path, "ARRAY");
  charge(meter, 8, path);
  const length = Object.getOwnPropertyDescriptor(value, "length")!.value as number;
  if (!Number.isSafeInteger(length) || length < min || length > max) return fail(path, "CARDINALITY");
  charge(meter, length + 3, path);
  if (Reflect.ownKeys(value).length !== length + 1) return fail(path, "ARRAY");
  return length;
};
export const readArray = <T>(value: unknown, meter: ValidationMeter, path: string, min: number, max: number, read: (value: unknown, path: string, index: number) => T): readonly T[] => {
  const length = readArrayLength(value, meter, path, min, max);
  charge(meter, 1, path);
  const result: T[] = [];
  for (let i = 0; ; ) {
    charge(meter, 1, path);
    if (i === length) break;
    charge(meter, 6, path);
    const d = Object.getOwnPropertyDescriptor(value as object, String(i));
    if (!d || !Object.hasOwn(d, "value") || !d.enumerable) return fail(`${path}[${i}]`, "ARRAY");
    const item = read(d.value, `${path}[${i}]`, i);
    charge(meter, 2, path);
    result.push(item);
    i++;
  }
  charge(meter, length + 1, path);
  return Object.freeze(result);
};
export const readInteger = (v: unknown, meter: ValidationMeter, p: string, low = 0, high = Number.MAX_SAFE_INTEGER): number => {
  charge(meter, 8, p);
  if (typeof v !== "number" || !Number.isFinite(v)) return fail(p, typeof v === "number" ? "NONFINITE" : "NUMBER");
  if (!Number.isSafeInteger(v) || Object.is(v, -0) || v < low || v > high) return fail(p, "NUMBER");
  return v;
};
export const readLiteral = <T extends string | number | boolean | null>(v: unknown, expected: T, meter: ValidationMeter, p: string): T => {
  charge(meter, 2, p);
  return Object.is(v, expected) ? expected : fail(p, p.endsWith(".version") ? "VERSION" : "SCHEMA");
};
export const freezeRecord = <T extends object>(value: T, fields: number, meter: ValidationMeter, p: string): Readonly<T> => {
  charge(meter, fields + 1, p);
  return Object.freeze(value);
};
const literalRecord = <T extends Record<string, string | number>>(v: unknown, expected: T, meter: ValidationMeter, p: string): Readonly<T> => {
  charge(meter, Object.keys(expected).length, p);
  const r = readObject(v, meter, p, Object.keys(expected));
  for (const key of Object.keys(expected)) {
    charge(meter, 3, p);
    readLiteral(r[key], expected[key]!, meter, `${p}.${key}`);
  }
  return freezeRecord(r as T, Object.keys(expected).length, meter, p);
};
export const readSide = (v: unknown, meter: Meter, p: string): Side => {
  charge(meter, 3, p);
  return v === "w" || v === "b" ? v : fail(p, "SIDE");
};
export const readSquare = (v: unknown, meter: Meter, p: string): Square => {
  charge(meter, 10, p);
  if (typeof v !== "string" || v.length !== 2 || v[0]! < "a" || v[0]! > "h" || v[1]! < "1" || v[1]! > "8") return fail(p);
  return v as Square;
};
export const squareIndex = (square: Square, meter: Meter, p: string): number => {
  charge(meter, 5, p);
  return (square.charCodeAt(0) - 97) * 8 + square.charCodeAt(1) - 49;
};
export const readSquares = (v: unknown, meter: Meter, p: string, min = 0, max = 64): readonly Square[] => {
  const result = readArray(v, meter, p, min, max, (x, at) => readSquare(x, meter, at));
  ordered(result, meter, p, (a, b) => { charge(meter, 2, p); return a < b ? -1 : a === b ? 0 : 1; });
  return result;
};
const ordered = <T>(values: readonly T[], meter: ValidationMeter, p: string, compare: (a: T, b: T) => number): void => {
  charge(meter, 1, p);
  for (let i = 1; ; ) {
    charge(meter, 1, p);
    if (i >= values.length) break;
    charge(meter, 3, p);
    if (compare(values[i - 1]!, values[i]!) >= 0) fail(p, "ORDER");
    charge(meter, 1, p); i++;
  }
};
const compareTuple = (a: readonly (number | null)[], b: readonly (number | null)[], meter: ValidationMeter, p: string): number => {
  for (let i = 0; ; ) {
    charge(meter, 1, p);
    if (i === a.length) return 0;
    charge(meter, 7, p);
    const x = a[i] ?? -1, y = b[i] ?? -1;
    if (x !== y) return x < y ? -1 : 1;
    charge(meter, 1, p); i++;
  }
};
export const readByteRef = (v: unknown, meter: Meter, p = "$"): ByteRef => {
  const r = readObject(v, meter, p, ["byteLength", "sha256"]);
  const byteLength = readInteger(r.byteLength, meter, `${p}.byteLength`);
  charge(meter, 4, p);
  if (typeof r.sha256 !== "string" || r.sha256.length !== 64) return fail(`${p}.sha256`);
  for (let i = 0; ; ) {
    charge(meter, 1, p);
    if (i === 64) break;
    charge(meter, 7, p);
    const c = r.sha256.charCodeAt(i);
    if (!(c >= 48 && c <= 57) && !(c >= 97 && c <= 102)) return fail(`${p}.sha256`);
    charge(meter, 1, p); i++;
  }
  charge(meter, 2, p);
  return freezeRecord({ byteLength, sha256: r.sha256 }, 2, meter, p);
};
export const validateOpening = (v: unknown, meter: ValidationMeter, p = "$"): PublicOpening => {
  const r = readObject(v, meter, p, ["version", "turn", "bank", "cc", "marines"]);
  readLiteral(r.version, "starchess-economic-opening-v1", meter, `${p}.version`);
  readLiteral(r.turn, 0, meter, `${p}.turn`);
  const bank = literalRecord(r.bank, { w: 3, b: 3 } as const, meter, `${p}.bank`);
  const cc = literalRecord(r.cc, { w: "e1", b: "e8" } as const, meter, `${p}.cc`);
  const m = readObject(r.marines, meter, `${p}.marines`, ["w", "b"]);
  const w = readArray(m.w, meter, `${p}.marines.w`, 4, 4, (x, at, i) => readLiteral(x, ["c2", "d2", "e2", "f2"][i]!, meter, at));
  const b = readArray(m.b, meter, `${p}.marines.b`, 4, 4, (x, at, i) => readLiteral(x, ["c7", "d7", "e7", "f7"][i]!, meter, at));
  charge(meter, 7, p);
  return freezeRecord({ version: "starchess-economic-opening-v1", turn: 0, bank, cc, marines: freezeRecord({ w, b }, 2, meter, p) } as PublicOpening, 5, meter, p);
};
export const validateRecipe = (v: unknown, meter: ValidationMeter, p = "$"): EconomicRecipe => {
  const fixed = {
    version: "starchess-economic-recipe-v1", supportVersion: "economic-accounting-relaxation-v1",
    graphVersion: "positive-headstock-suffix-v1", innovationVersion: "authorized-economic-innovation-v1",
    geometryVersion: "authorized-promotion-geometry-v1", calibrationVersion: "starchess-economic-calibration-v1",
    workCap: 1048576, materialCeiling: 576, bankCap: 12, minimumGroups: 32,
  } as const;
  const r = readObject(v, meter, p, [...Object.keys(fixed), "bandStarts", "alpha", "diagnosticHorizons"]);
  for (const key of Object.keys(fixed) as (keyof typeof fixed)[]) {
    charge(meter, 3, p); readLiteral(r[key], fixed[key], meter, `${p}.${key}`);
  }
  const bandStarts = readArray(r.bandStarts, meter, `${p}.bandStarts`, 19, 19, (x, at, i) => { charge(meter, 1, at); return readLiteral(x, BAND_STARTS[i]!, meter, at); });
  const alpha = validateFloat64(r.alpha, meter, `${p}.alpha`, .5, .5);
  const diagnosticHorizons = readArray(r.diagnosticHorizons, meter, `${p}.diagnosticHorizons`, 3, 3, (x, at, i) => { charge(meter, 1, at); return readLiteral(x, i + 1, meter, at); });
  charge(meter, 13, p);
  return freezeRecord({ ...fixed, bandStarts, alpha, diagnosticHorizons } as EconomicRecipe, 13, meter, p);
};
export const bandBounds = (band: number, meter: ValidationMeter, p: string): readonly [number, number] => {
  readInteger(band, meter, p, 0, 18);
  charge(meter, 6, p);
  return [BAND_STARTS[band]!, band === 18 ? 576 : BAND_STARTS[band + 1]! - 1];
};
export const validatePartition = (v: unknown, meter: ValidationMeter, p = "$.partition"): readonly Bin[] => {
  const bins = readArray(v, meter, p, 3, 12, (x, at) => readArray(x, meter, at, 4, 4, (y, ap) => readInteger(y, meter, ap, 0, 64)) as Bin);
  charge(meter, 2, p);
  let cursor = 0;
  for (const [low, high] of [[0, 10], [11, 20], [21, 45]]) {
    charge(meter, 4, p);
    let lit = 0;
    while (true) {
      charge(meter, 2, p);
      if (cursor >= bins.length) return fail(p, "CONSISTENCY");
      charge(meter, 7, p);
      const bin = bins[cursor]!;
      if (bin[0] !== low || bin[1] !== high || bin[2] !== lit) return fail(`${p}[${cursor}]`, "ORDER");
      charge(meter, 1, p);
      let valid = false;
      for (const pair of [[0, 15], [16, 31], [32, 47], [48, 64], [0, 31], [32, 64], [0, 64]]) {
        charge(meter, 5, p);
        if (bin[2] === pair[0] && bin[3] === pair[1]) { charge(meter, 1, p); valid = true; break; }
      }
      charge(meter, 4, p);
      if (!valid) return fail(`${p}[${cursor}]`, "NUMBER");
      lit = bin[3] + 1; cursor++;
      charge(meter, 1, p);
      if (lit === 65) break;
    }
  }
  charge(meter, 1, p);
  if (cursor !== bins.length) return fail(p, "CARDINALITY");
  return bins;
};
export const temperatureAt = (index: number, meter: ValidationMeter, p = "$.temperature"): number => {
  readInteger(index, meter, p, 0, 1000);
  charge(meter, 2, p);
  if (index === 0) return .25;
  if (index === 1000) return 4;
  charge(meter, 3, p);
  return .25 * 16 ** (index / 1000);
};
const readTemperature = (v: unknown, meter: ValidationMeter, p: string): H => {
  const t = decodeFloat64(v, meter, p);
  charge(meter, 3, p);
  if (t < .25 || t > 4) return fail(p, "NUMBER");
  charge(meter, 9, p);
  const index = Math.round(1000 * Math.log(t / .25) / Math.log(16));
  if (t !== temperatureAt(index, meter, p)) return fail(p, "DERIVED");
  return encodeFloat64(t, meter, p);
};
const growthPossible = (g: number, opportunities: number, meter: ValidationMeter, p: string): boolean => {
  for (let eights = 0; ; ) {
    charge(meter, 1, p); if (eights > opportunities) break;
    for (let fours = 0; ; ) {
      charge(meter, 2, p); if (fours > opportunities - eights) break;
      charge(meter, 9, p);
      const remaining = g - 8 * eights - 4 * fours;
      if (remaining >= 0 && remaining % 2 === 0 && remaining / 2 <= opportunities - eights - fours) return true;
      charge(meter, 1, p); fours++;
    }
    charge(meter, 1, p); eights++;
  }
  return false;
};
export const transitionRowAdmitted = (row: TransitionRow, cohort: Pick<Table, "bank" | "band" | "tier">, meter: ValidationMeter, p: string): boolean => {
  charge(meter, 15, p);
  const [s, c, w, g, d] = row;
  if (![0, 1, 3, 5, 9].includes(s) || (c !== 0 && c !== s) || w !== s - c || g % 2 !== 0) return false;
  charge(meter, 3, p);
  const bank = cohort.bank ?? 12;
  if (s > bank) return false;
  const bounds = cohort.band === null ? [0, 576] : bandBounds(cohort.band, meter, p);
  charge(meter, 11, p);
  const material = Math.min(bounds[1]!, 576 + d - c - g);
  const tier = cohort.tier ?? 2;
  const opportunities = Math.min(4, 2 + tier - Number(s > 0), material + Number(c === 1));
  charge(meter, 5, p);
  if (material < Math.max(bounds[0]!, d - c - g) || opportunities < 0) return false;
  return growthPossible(g, opportunities, meter, p);
};
export const validateAvailableBackoffs = (tables: readonly Table[], meter: ValidationMeter, p = "$.tables"): void => {
  const compareRows = (a: TransitionRow | EvidenceRow, b: TransitionRow | EvidenceRow, width: number): number => {
    for (let i = 0; ; ) {
      charge(meter, 1, p); if (i === width) return 0;
      charge(meter, 5, p); const x = a[i] as number, y = b[i] as number;
      if (x !== y) return x < y ? -1 : 1;
      charge(meter, 1, p); i++;
    }
  };
  for (let parentIndex = 0; ; ) {
    charge(meter, 1, p); if (parentIndex === tables.length) break;
    charge(meter, 3, p); const parent = tables[parentIndex]!;
    if (parent.level !== 0) {
      for (let level = 0; ; ) {
        charge(meter, 1, p); if (level === parent.level) break;
        charge(meter, parent.rows.length + 2, p); const known = new Float64Array(parent.rows.length);
        charge(meter, 2, p); const width = parent.kind === "transition" ? 5 : 3;
        for (let childIndex = 0; ; ) {
          charge(meter, 1, p); if (childIndex === tables.length) break;
          charge(meter, 15, p); const child = tables[childIndex]!;
          const admitted = child.kind === parent.kind && child.level === level && (parent.bank === null || parent.bank === child.bank) && (parent.tier === null || parent.tier === child.tier);
          if (admitted) {
            charge(meter, 3, p); if (child.groups > parent.groups) return fail(`${p}[${parentIndex}].groups`, "CONSISTENCY");
            for (let rowIndex = 0; ; ) {
              charge(meter, 1, p); if (rowIndex === child.rows.length) break;
              charge(meter, 4, p); const row = child.rows[rowIndex]!; let low = 0, high = parent.rows.length;
              for (;;) {
                charge(meter, 1, p); if (low === high) break;
                charge(meter, 5, p); const middle = Math.floor((low + high) / 2);
                const order = compareRows(parent.rows[middle]!, row, width);
                charge(meter, 3, p); if (order < 0) low = middle + 1; else high = middle;
              }
              charge(meter, 2, p); if (low === parent.rows.length || compareRows(parent.rows[low]!, row, width) !== 0) return fail(`${p}[${parentIndex}].rows`, "CONSERVATION");
              const count = decodeFloat64(row[width], meter, p);
              charge(meter, 4, p); known[low] = known[low]! + count;
              if (!Number.isFinite(known[low])) return fail(`${p}[${parentIndex}].rows`, "NONFINITE");
              charge(meter, 1, p); rowIndex++;
            }
          }
          charge(meter, 1, p); childIndex++;
        }
        for (let i = 0; ; ) {
          charge(meter, 1, p); if (i === parent.rows.length) break;
          const count = decodeFloat64(parent.rows[i]![width], meter, p);
          charge(meter, 4, p); if (known[i]! > count + 1e-12) return fail(`${p}[${parentIndex}].rows[${i}]`, "CONSERVATION");
          charge(meter, 1, p); i++;
        }
        charge(meter, 1, p); level++;
      }
    }
    charge(meter, 1, p); parentIndex++;
  }
};
export const validateArtifact = (v: unknown, meter?: Meter, p = "$"): EconomicArtifact => {
  const r = readObject(v, meter, p, ["version", "status", "opening", "recipe", "tables", "partition", "temperatures"]);
  readLiteral(r.version, "starchess-economic-artifact-v1", meter, `${p}.version`);
  readLiteral(r.status, "FROZEN", meter, `${p}.status`);
  const opening = validateOpening(r.opening, meter, `${p}.opening`);
  const recipe = validateRecipe(r.recipe, meter, `${p}.recipe`);
  const tableInputs = readArray(r.tables, meter, `${p}.tables`, 0, 1588, x => x);
  charge(meter, 1, p); let declaredRows = 0;
  for (let i = 0; ; ) {
    charge(meter, 1, p); if (i === tableInputs.length) break;
    charge(meter, 2, p); const at = `${p}.tables[${i}]`;
    const rows = readTag(tableInputs[i], "rows", meter, at);
    const length = readArrayLength(rows, meter, `${at}.rows`, 0, 8192);
    charge(meter, 2, p); if (length > 8192 - declaredRows) return fail(`${at}.rows`, "CARDINALITY");
    charge(meter, 2, p); declaredRows += length; i++;
  }
  charge(meter, 1, p);
  let totalRows = 0;
  const tables = readArray(r.tables, meter, `${p}.tables`, 0, 1588, (v, at): Table => {
    const t = readObject(v, meter, at, ["kind", "level", "bank", "band", "tier", "groups", "rows"]);
    charge(meter, 3, at);
    if (t.kind !== "transition" && t.kind !== "evidence") return fail(`${at}.kind`);
    const level = readInteger(t.level, meter, `${at}.level`, 0, 3);
    const bank = level === 3 ? readLiteral(t.bank, null, meter, `${at}.bank`) : readInteger(t.bank, meter, `${at}.bank`, 0, 12);
    const band = level === 0 ? readInteger(t.band, meter, `${at}.band`, 0, 18) : readLiteral(t.band, null, meter, `${at}.band`);
    const tier = level <= 1 ? readInteger(t.tier, meter, `${at}.tier`, 0, 2) : readLiteral(t.tier, null, meter, `${at}.tier`);
    const groups = readInteger(t.groups, meter, `${at}.groups`, 0, 14400);
    const transition = t.kind === "transition";
    charge(meter, 1, at); let countSum = 0;
    const rows = readArray(t.rows, meter, `${at}.rows`, 0, 8192 - totalRows, (v, ap): TransitionRow | EvidenceRow => {
      charge(meter, 1, ap);
      const width = transition ? 6 : 4;
      const row = readArray(v, meter, ap, width, width, (x, xp, i): number | H => {
        charge(meter, 2, xp);
        if (i === width - 1) {
          const count = decodeFloat64(x, meter, xp);
          charge(meter, 3, xp);
          if (count <= 0 || count > groups) return fail(xp, "NUMBER");
          charge(meter, 1, xp); countSum += count;
          return encodeFloat64(count, meter, xp);
        }
        charge(meter, 3, xp);
        const max = transition ? [9, 9, 9, 32, 617][i]! : [3, 3, 2][i]!;
        return readInteger(x, meter, xp, 0, max);
      }) as TransitionRow | EvidenceRow;
      charge(meter, 1, ap);
      if (transition && !transitionRowAdmitted(row as TransitionRow, { bank, band, tier }, meter, ap)) return fail(ap, "CONSERVATION");
      return row;
    });
    charge(meter, 6, at);
    totalRows += rows.length;
    if ((rows.length === 0) !== (groups === 0)) return fail(`${at}.groups`, "CONSISTENCY");
    charge(meter, 4, at); if (!Number.isFinite(countSum) || countSum > groups + 1e-12) return fail(`${at}.rows`, "CONSERVATION");
    ordered(rows, meter, `${at}.rows`, (a, b) => {
      charge(meter, 2 * (transition ? 5 : 3), at);
      return compareTuple(a.slice(0, -1) as number[], b.slice(0, -1) as number[], meter, at);
    });
    charge(meter, 7, at);
    return freezeRecord({ kind: t.kind, level, bank, band, tier, groups, rows } as Table, 7, meter, at);
  });
  ordered(tables, meter, `${p}.tables`, (a, b) => {
    charge(meter, 12, p);
    return compareTuple([a.kind === "transition" ? 0 : 1, a.level, a.bank, a.band, a.tier], [b.kind === "transition" ? 0 : 1, b.level, b.bank, b.band, b.tier], meter, p);
  });
  validateAvailableBackoffs(tables, meter, `${p}.tables`);
  const partition = validatePartition(r.partition, meter, `${p}.partition`);
  const temperatures = readArray(r.temperatures, meter, `${p}.temperatures`, partition.length, partition.length, (x, at) => readTemperature(x, meter, at));
  charge(meter, 7, p);
  const result: EconomicArtifact = freezeRecord({ version: "starchess-economic-artifact-v1", status: "FROZEN", opening, recipe, tables, partition, temperatures }, 7, meter, p);
  canonicalBytes(result, meter, p);
  return result;
};

const replacement = (type: UnitType, meter: Meter, p: string): number => {
  charge(meter, 2, p);
  return { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }[type];
};
const readType = (v: unknown, meter: Meter, p: string, spawn = false): UnitType => {
  charge(meter, 3, p);
  const types = spawn ? ["p", "n", "b", "r", "q"] : ["p", "n", "b", "r", "q", "k"];
  for (const type of types) { charge(meter, 2, p); if (v === type) return type as UnitType; }
  return fail(p);
};
const readPiece = (v: unknown, meter: Meter, p: string): AuthorizedPiece => {
  const r = readObject(v, meter, p, ["type", "color"]);
  const type = readType(r.type, meter, `${p}.type`), color = readSide(r.color, meter, `${p}.color`);
  charge(meter, 2, p);
  return freezeRecord({ type, color }, 2, meter, p);
};
export const readCells = (v: unknown, side: Side, meter: Meter, p: string, complete = true): CellsResult => {
  return readArray(v, meter, p, complete ? 64 : 1, 64, (x, at, i): ObservedCell => {
    const visibility = readTag(x, "visibility", meter, at);
    charge(meter, 1, at);
    const r = readObject(x, meter, at, visibility === "unknown" ? ["square", "visibility"] : ["square", "visibility", "piece"]);
    const square = readSquare(r.square, meter, `${at}.square`);
    charge(meter, 2, at);
    if (complete && squareIndex(square, meter, at) !== i) return fail(`${at}.square`, "ORDER");
    charge(meter, 1, at);
    if (visibility === "unknown") { charge(meter, 2, at); return freezeRecord({ square, visibility }, 2, meter, at); }
    charge(meter, 3, at);
    if (visibility !== "lit" && visibility !== "revealed") return fail(`${at}.visibility`);
    const piece = r.piece === null ? null : readPiece(r.piece, meter, `${at}.piece`);
    charge(meter, 5, at);
    if (visibility === "revealed" && (!piece || piece.type !== "q" || piece.color === side)) return fail(`${at}.piece`, "CONSISTENCY");
    charge(meter, 3, at);
    return freezeRecord({ square, visibility, piece } as ObservedCell, 3, meter, at);
  });
};
type CellsResult = readonly ObservedCell[];
export const readMemory = (v: unknown, side: Side, turn: number, cells: readonly ObservedCell[], meter: Meter, p: string): readonly Sighting[] => {
  const result = readArray(v, meter, p, 0, 64, (x, at): Sighting => {
    const r = readObject(x, meter, at, ["square", "piece", "observedTurn"]);
    const square = readSquare(r.square, meter, `${at}.square`), piece = readPiece(r.piece, meter, `${at}.piece`);
    const observedTurn = readInteger(r.observedTurn, meter, `${at}.observedTurn`, 0, turn);
    charge(meter, 1, at);
    if (piece.color === side) return fail(`${at}.piece.color`, "SIDE");
    charge(meter, 3, at);
    return freezeRecord({ square, piece, observedTurn }, 3, meter, at);
  });
  ordered(result, meter, p, (a, b) => { charge(meter, 4, p); return a.square < b.square ? -1 : a.square === b.square ? 0 : 1; });
  for (const cell of cells) {
    charge(meter, 2, p);
    if (cell.visibility === "unknown") continue;
    let memory: Sighting | undefined;
    for (const item of result) { charge(meter, 4, p); if (item.square === cell.square) { memory = item; break; } }
    charge(meter, 4, p);
    if (cell.piece && cell.piece.color !== side) {
      charge(meter, 7, p);
      if (!memory || memory.observedTurn !== turn || memory.piece.color !== cell.piece.color || memory.piece.type !== cell.piece.type) return fail(p, "CONSISTENCY");
    } else if (memory) return fail(p, "CONSISTENCY");
  }
  return result;
};
const readId = (v: unknown, side: Side, kind: "unit" | "mine" | "receipt" | "witness", meter: Meter, p: string): string => {
  charge(meter, 5, p);
  if (typeof v !== "string" || v.length > 64) return fail(p, "IDENTITY");
  charge(meter, v.length + 4, p);
  if (!v.startsWith(`${side}:${kind}:`)) return fail(p, "SIDE");
  const suffix = v.slice(kind.length + 3);
  charge(meter, suffix.length + 4, p);
  if (kind === "unit" || kind === "mine") {
    if (/^opening:[a-h][1-8]$/.test(suffix)) return v;
    if (!/^created:[1-9][0-9]*$/.test(suffix)) return fail(p, "IDENTITY");
    readInteger(Number(suffix.slice(8)), meter, p, 1, kind === "unit" ? 64 : 192);
  } else if (kind === "receipt") {
    if (!/^(0|[1-9][0-9]*):(0|[1-9][0-9]*)$/.test(suffix)) return fail(p, "IDENTITY");
    charge(meter, suffix.length + 4, p);
    const parts = suffix.split(":");
    readInteger(Number(parts[0]), meter, p, 0, 63); readInteger(Number(parts[1]), meter, p, 0, 3);
  } else {
    if (!/^[1-9][0-9]*$/.test(suffix)) return fail(p, "IDENTITY");
    readInteger(Number(suffix), meter, p, 1, 128);
  }
  return v;
};
const readActionRef = (v: unknown, meter: Meter, p: string) => {
  const r = readObject(v, meter, p, ["planningOrdinal", "acceptedActionOrdinal"]);
  const planningOrdinal = readInteger(r.planningOrdinal, meter, `${p}.planningOrdinal`, 0, 63);
  const acceptedActionOrdinal = readInteger(r.acceptedActionOrdinal, meter, `${p}.acceptedActionOrdinal`, 0, 3);
  charge(meter, 2, p);
  return freezeRecord({ planningOrdinal, acceptedActionOrdinal }, 2, meter, p);
};
const contains = <T>(values: readonly T[], item: T, meter: Meter, p: string): boolean => {
  for (let i = 0; ; ) {
    charge(meter, 1, p); if (i === values.length) return false;
    charge(meter, 2, p); if (values[i] === item) return true;
    charge(meter, 1, p); i++;
  }
};
const unique = (values: readonly string[], meter: Meter, p: string): void => {
  charge(meter, 1, p); const seen = new Set<string>();
  for (const item of values) { charge(meter, 4, p); if (seen.has(item)) fail(p, "IDENTITY"); seen.add(item); }
};
export const readLedger = (v: unknown, side: Side, meter: Meter, p: string): EconomicState => {
  const r = readObject(v, meter, p, ["version", "side", "ownPaidDebits", "ownPaidSurviving", "ownPaidDestroyed", "ownPaidWasted", "ownReplacementDestroyed", "enemyLoss", "receipts", "retiredOwnIds"]);
  readLiteral(r.version, "challenge-economic-ledger-v1", meter, `${p}.version`); readLiteral(r.side, side, meter, `${p}.side`);
  const receipts = readArray(r.receipts, meter, `${p}.receipts`, 0, 64, (x, at): PaidReceipt => {
    const t = readObject(x, meter, at, ["receiptId", "actionRef", "unit", "requestedSquare", "minerals", "disposition"]);
    const receiptId = readId(t.receiptId, side, "receipt", meter, `${at}.receiptId`), actionRef = readActionRef(t.actionRef, meter, `${at}.actionRef`);
    const unit = readType(t.unit, meter, `${at}.unit`, true) as PaidReceipt["unit"];
    const requestedSquare = readSquare(t.requestedSquare, meter, `${at}.requestedSquare`), minerals = readInteger(t.minerals, meter, `${at}.minerals`, 1, 9);
    charge(meter, 5, at);
    if (receiptId !== `${side}:receipt:${actionRef.planningOrdinal}:${actionRef.acceptedActionOrdinal}` || minerals !== replacement(unit, meter, at)) return fail(at, "DERIVED");
    const kind = readTag(t.disposition, "kind", meter, `${at}.disposition`);
    charge(meter, 1, at);
    const d = readObject(t.disposition, meter, `${at}.disposition`, kind === "materialized" ? ["kind", "lineageId"] : ["kind"]);
    let disposition: PaidReceipt["disposition"];
    charge(meter, 1, at);
    if (kind === "materialized") {
      const lineageId = readId(d.lineageId, side, "unit", meter, `${at}.disposition.lineageId`);
      charge(meter, lineageId.length + 2, at);
      if (!lineageId.startsWith(`${side}:unit:created:`)) return fail(`${at}.disposition.lineageId`, "IDENTITY");
      charge(meter, 2, at); disposition = freezeRecord({ kind, lineageId }, 2, meter, at);
    } else { readLiteral(kind, "unmaterialized", meter, `${at}.disposition.kind`); charge(meter, 1, at); disposition = freezeRecord({ kind: "unmaterialized" }, 1, meter, at); }
    charge(meter, 6, at); return freezeRecord({ receiptId, actionRef, unit, requestedSquare, minerals, disposition }, 6, meter, at);
  });
  ordered(receipts, meter, `${p}.receipts`, (a, b) => { charge(meter, 4, p); return a.receiptId < b.receiptId ? -1 : a.receiptId === b.receiptId ? 0 : 1; });
  const retiredOwnIds = readArray(r.retiredOwnIds, meter, `${p}.retiredOwnIds`, 0, 128, (x, at) => readId(x, side, "unit", meter, at));
  ordered(retiredOwnIds, meter, `${p}.retiredOwnIds`, (a, b) => { charge(meter, 2, p); return a < b ? -1 : a === b ? 0 : 1; });
  const ownPaidDebits = readInteger(r.ownPaidDebits, meter, `${p}.ownPaidDebits`, 0, 576);
  const ownPaidSurviving = readInteger(r.ownPaidSurviving, meter, `${p}.ownPaidSurviving`, 0, 576);
  const ownPaidDestroyed = readInteger(r.ownPaidDestroyed, meter, `${p}.ownPaidDestroyed`, 0, 576);
  const ownPaidWasted = readInteger(r.ownPaidWasted, meter, `${p}.ownPaidWasted`, 0, 576);
  const ownReplacementDestroyed = readInteger(r.ownReplacementDestroyed, meter, `${p}.ownReplacementDestroyed`, 0, 1152);
  charge(meter, 6, p);
  let debits = 0, wasted = 0, destroyed = 0;
  const plans = new Set<number>(), created = new Map<number, string>();
  for (const receipt of receipts) {
    charge(meter, 9, p);
    if (plans.has(receipt.actionRef.planningOrdinal)) return fail(`${p}.receipts`, "IDENTITY");
    plans.add(receipt.actionRef.planningOrdinal); debits += receipt.minerals;
    if (receipt.disposition.kind === "unmaterialized") { charge(meter, 2, p); wasted += receipt.minerals; }
    else {
      charge(meter, 4, p); created.set(receipt.actionRef.planningOrdinal, receipt.disposition.lineageId);
      if (contains(retiredOwnIds, receipt.disposition.lineageId, meter, p)) { charge(meter, 2, p); destroyed += receipt.minerals; }
    }
  }
  charge(meter, 3, p); let counter = 0; const issued: string[] = [];
  for (let plan = 0; ; ) {
    charge(meter, 1, p); if (plan === 64) break;
    charge(meter, 2, p); const born = created.get(plan);
    charge(meter, 1, p); if (born !== undefined) {
      charge(meter, 5, p); counter++; if (born !== `${side}:unit:created:${counter}`) return fail(`${p}.receipts`, "IDENTITY"); issued.push(born);
    }
    charge(meter, 1, p); plan++;
  }
  for (const id of retiredOwnIds) { charge(meter, id.length + 2, p); if (id.includes(":created:") && !contains(issued, id, meter, p)) return fail(`${p}.retiredOwnIds`, "IDENTITY"); }
  charge(meter, 12, p);
  if (debits !== ownPaidDebits || wasted !== ownPaidWasted || destroyed !== ownPaidDestroyed || ownPaidDebits !== ownPaidSurviving + ownPaidDestroyed + ownPaidWasted || ownReplacementDestroyed < retiredOwnIds.length || ownReplacementDestroyed > retiredOwnIds.length * 9) return fail(p, "CONSERVATION");
  const l = readObject(r.enemyLoss, meter, `${p}.enemyLoss`, ["confirmedUnitCount", "replacementLowerBound", "paidLowerBound", "upper", "completeness"]);
  const confirmedUnitCount = readInteger(l.confirmedUnitCount, meter, `${p}.enemyLoss.confirmedUnitCount`, 0, 128);
  const replacementLowerBound = readInteger(l.replacementLowerBound, meter, `${p}.enemyLoss.replacementLowerBound`, 0, 1152);
  charge(meter, 4, p); if (replacementLowerBound < confirmedUnitCount || replacementLowerBound > 9 * confirmedUnitCount) return fail(`${p}.enemyLoss`, "CONSERVATION");
  readLiteral(l.paidLowerBound, 0, meter, `${p}.enemyLoss.paidLowerBound`); readLiteral(l.upper, "unknown", meter, `${p}.enemyLoss.upper`); readLiteral(l.completeness, "witnessed-only", meter, `${p}.enemyLoss.completeness`);
  charge(meter, 15, p);
  const enemyLoss = freezeRecord({ confirmedUnitCount, replacementLowerBound, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" } as const, 5, meter, p);
  return freezeRecord({ version: "challenge-economic-ledger-v1", side, ownPaidDebits, ownPaidSurviving, ownPaidDestroyed, ownPaidWasted, ownReplacementDestroyed, enemyLoss, receipts, retiredOwnIds }, 10, meter, p);
};
const readMineLineage = (v: unknown, side: Side, meter: Meter, p: string): readonly OwnMineLineage[] => {
  const result = readArray(v, meter, p, 0, 3, (x, at): OwnMineLineage => {
    const r = readObject(x, meter, at, ["mineId", "square"]);
    const mineId = readId(r.mineId, side, "mine", meter, `${at}.mineId`), square = readSquare(r.square, meter, `${at}.square`);
    charge(meter, mineId.length + 4, at);
    if (mineId.includes(":opening:") && mineId !== `${side}:mine:opening:${square}`) return fail(`${at}.mineId`, "IDENTITY");
    charge(meter, 2, at); return freezeRecord({ mineId, square }, 2, meter, at);
  });
  ordered(result, meter, p, (a, b) => { charge(meter, 6, p); const x = `${a.square}:${a.mineId}`, y = `${b.square}:${b.mineId}`; return x < y ? -1 : x === y ? 0 : 1; });
  charge(meter, result.length * 2, p); unique(result.map(x => x.mineId), meter, p);
  return result;
};
export const validateSnapshot = (v: unknown, meter: Meter, p = "$"): AuthorizedSnapshotV2 => {
  const r = readObject(v, meter, p, ["version", "side", "turn", "own", "cells", "memory", "ownUnitLineage", "ownMineLineage", "economicState"]);
  readLiteral(r.version, "challenge-observation-v2", meter, `${p}.version`);
  const side = readSide(r.side, meter, `${p}.side`), turn = readInteger(r.turn, meter, `${p}.turn`, 0, 45);
  const cells = readCells(r.cells, side, meter, `${p}.cells`), memory = readMemory(r.memory, side, turn, cells, meter, `${p}.memory`);
  const o = readObject(r.own, meter, `${p}.own`, ["minerals", "gas", "gasIncome", "ccLives", "pieces", "mines", "siegedTanks"]);
  const minerals = readInteger(o.minerals, meter, `${p}.own.minerals`, 0, 12), gasIncome = readInteger(o.gasIncome, meter, `${p}.own.gasIncome`, 0, 3);
  const gas = readInteger(o.gas, meter, `${p}.own.gas`, 0, gasIncome), ccLives = readInteger(o.ccLives, meter, `${p}.own.ccLives`, 0, 3);
  const pieces = readArray(o.pieces, meter, `${p}.own.pieces`, 1, 64, (x, at) => {
    const t = readObject(x, meter, at, ["square", "piece"]);
    const square = readSquare(t.square, meter, `${at}.square`), piece = readPiece(t.piece, meter, `${at}.piece`);
    charge(meter, 1, at); if (piece.color !== side) return fail(`${at}.piece.color`, "SIDE");
    charge(meter, 2, at); return freezeRecord({ square, piece }, 2, meter, at);
  });
  ordered(pieces, meter, `${p}.own.pieces`, (a, b) => { charge(meter, 4, p); return a.square < b.square ? -1 : a.square === b.square ? 0 : 1; });
  charge(meter, 2, p); let count = 0, cc = 0;
  for (const cell of cells) {
    charge(meter, 5, p); if (cell.visibility === "unknown" || cell.piece?.color !== side) continue;
    charge(meter, 7, p); const piece = pieces[count];
    if (!piece || piece.square !== cell.square || piece.piece.type !== cell.piece.type) return fail(`${p}.own.pieces`, "CONSISTENCY");
    count++; if (cell.piece.type === "k") cc++;
  }
  charge(meter, 3, p); if (count !== pieces.length || cc !== 1) return fail(`${p}.own.pieces`, "CONSISTENCY");
  const mines = readSquares(o.mines, meter, `${p}.own.mines`, 0, 3), siegedTanks = readSquares(o.siegedTanks, meter, `${p}.own.siegedTanks`);
  for (const at of mines) { charge(meter, 3, p); if (cells[squareIndex(at, meter, p)]!.visibility !== "lit") return fail(`${p}.own.mines`, "CONSISTENCY"); }
  for (const at of siegedTanks) { charge(meter, 6, p); const cell = cells[squareIndex(at, meter, p)]!; if (cell.visibility === "unknown" || cell.piece?.color !== side || cell.piece.type !== "r") return fail(`${p}.own.siegedTanks`, "CONSISTENCY"); }
  const economicState = readLedger(r.economicState, side, meter, `${p}.economicState`);
  const ownUnitLineage = readArray(r.ownUnitLineage, meter, `${p}.ownUnitLineage`, 1, 64, (x, at): OwnUnitLineage => {
    const t = readObject(x, meter, at, ["id", "square", "type", "paidBasis", "replacementValue"]);
    const id = readId(t.id, side, "unit", meter, `${at}.id`), square = readSquare(t.square, meter, `${at}.square`), type = readType(t.type, meter, `${at}.type`);
    const paidBasis = readInteger(t.paidBasis, meter, `${at}.paidBasis`, 0, 9), replacementValue = readInteger(t.replacementValue, meter, `${at}.replacementValue`, 0, 9);
    charge(meter, 1, at); if (replacementValue !== replacement(type, meter, at)) return fail(`${at}.replacementValue`, "DERIVED");
    charge(meter, 5, at); return freezeRecord({ id, square, type, paidBasis, replacementValue }, 5, meter, at);
  });
  ordered(ownUnitLineage, meter, `${p}.ownUnitLineage`, (a, b) => { charge(meter, 4, p); return a.square < b.square ? -1 : a.square === b.square ? 0 : 1; });
  charge(meter, ownUnitLineage.length * 2, p); unique(ownUnitLineage.map(x => x.id), meter, `${p}.ownUnitLineage`);
  charge(meter, 2, p); if (ownUnitLineage.length !== pieces.length) return fail(`${p}.ownUnitLineage`, "CONSISTENCY");
  let paid = 0;
  for (let i = 0; ; ) {
    charge(meter, 1, p); if (i === ownUnitLineage.length) break;
    charge(meter, 7, p); const unit = ownUnitLineage[i]!, piece = pieces[i]!;
    if (unit.square !== piece.square || unit.type !== piece.piece.type || contains(economicState.retiredOwnIds, unit.id, meter, p)) return fail(`${p}.ownUnitLineage`, "CONSISTENCY");
    charge(meter, unit.id.length + 3, p); const opening = unit.id.includes(":opening:");
    if (unit.type === "k" && !opening) return fail(`${p}.ownUnitLineage`, "IDENTITY");
    let receipt: PaidReceipt | undefined;
    for (const x of economicState.receipts) { charge(meter, 6, p); if (x.disposition.kind === "materialized" && x.disposition.lineageId === unit.id) { receipt = x; break; } }
    charge(meter, 7, p);
    if (opening ? unit.paidBasis !== 0 || receipt !== undefined : !receipt || receipt.minerals !== unit.paidBasis) return fail(`${p}.ownUnitLineage`, "CONSERVATION");
    paid += unit.paidBasis; i++;
  }
  for (const receipt of economicState.receipts) {
    charge(meter, 2, p); if (receipt.disposition.kind !== "materialized") continue;
    charge(meter, 2, p); let live = false;
    for (const unit of ownUnitLineage) { charge(meter, 4, p); if (unit.id === receipt.disposition.lineageId) { live = true; break; } }
    charge(meter, 2, p); if (!live && !contains(economicState.retiredOwnIds, receipt.disposition.lineageId, meter, p)) return fail(`${p}.economicState.receipts`, "IDENTITY");
  }
  charge(meter, 1, p); if (paid !== economicState.ownPaidSurviving) return fail(`${p}.economicState`, "CONSERVATION");
  const ownMineLineage = readMineLineage(r.ownMineLineage, side, meter, `${p}.ownMineLineage`);
  charge(meter, 2, p); const locations: Square[] = [];
  for (const mine of ownMineLineage) { charge(meter, 4, p); if (locations.at(-1) !== mine.square) { charge(meter, 2, p); locations.push(mine.square); } }
  if (!equalCanonical(locations, mines, meter, p)) return fail(`${p}.ownMineLineage`, "CONSISTENCY");
  charge(meter, 16, p);
  const own: AuthorizedOwnState = freezeRecord({ minerals, gas, gasIncome, ccLives, pieces, mines, siegedTanks }, 7, meter, p);
  return freezeRecord({ version: "challenge-observation-v2", side, turn, own, cells, memory, ownUnitLineage, ownMineLineage, economicState }, 9, meter, p);
};
export const validateHistory = (v: unknown, meter: Meter, p = "$"): History => {
  const r = readObject(v, meter, p, ["version", "currentAuthorizedSnapshotV2", "economicState", "everLit"]);
  readLiteral(r.version, "challenge-history-v2", meter, `${p}.version`);
  const currentAuthorizedSnapshotV2 = validateSnapshot(r.currentAuthorizedSnapshotV2, meter, `${p}.currentAuthorizedSnapshotV2`);
  const economicState = readLedger(r.economicState, currentAuthorizedSnapshotV2.side, meter, `${p}.economicState`);
  if (!equalCanonical(economicState, currentAuthorizedSnapshotV2.economicState, meter, p)) return fail(`${p}.economicState`, "CONSISTENCY");
  const everLit = readSquares(r.everLit, meter, `${p}.everLit`);
  for (const cell of currentAuthorizedSnapshotV2.cells) { charge(meter, 2, p); if (cell.visibility === "lit" && !contains(everLit, cell.square, meter, p)) return fail(`${p}.everLit`, "CONSISTENCY"); }
  charge(meter, 4, p);
  const result: History = freezeRecord({ version: "challenge-history-v2", currentAuthorizedSnapshotV2, economicState, everLit }, 4, meter, p);
  canonicalBytes(result, meter, p);
  return result;
};

const EVENT_FIELDS = Object.freeze({
  "own-paid-receipt": ["receiptId", "actionRef", "unit", "requestedSquare", "minerals"],
  "own-gas-debited": ["actionRef", "gas"], "own-unit-endowed": ["id", "square", "type", "paidBasis"],
  "own-unit-created": ["lineageId", "receiptId", "square", "type"], "own-deployment-unmaterialized": ["receiptId", "paidMinerals"],
  "own-unit-moved": ["id", "from", "to"], "own-unit-transformed": ["id", "fromType", "toType", "paidDelta"],
  "own-unit-mode-changed": ["id", "mode"], "own-unit-destroyed": ["id", "typeAtLoss", "square", "retiredPaidBasis"],
  "own-mine-endowed": ["mineId", "actionRef", "square"], "own-mine-created": ["mineId", "actionRef", "square"],
  "own-mine-removed": ["mineId"], "own-income": ["actualCreditedMinerals"], "own-cc-lives-changed": ["before", "after"],
  "enemy-unit-destruction-witnessed": ["witnessId", "square", "type", "replacementLowerBound", "paidLowerBound"],
  "vision-witness": ["turn", "changes"],
} as const);
const readEvent = (v: unknown, side: Side, meter: Meter, p: string): AuthorizedEvent => {
  const tag = readTag(v, "kind", meter, p);
  charge(meter, 3, p); if (typeof tag !== "string" || !Object.hasOwn(EVENT_FIELDS, tag)) return fail(`${p}.kind`);
  const kind = tag as keyof typeof EVENT_FIELDS;
  charge(meter, EVENT_FIELDS[kind].length + 3, p);
  const r = readObject(v, meter, p, ["kind", "seq", ...EVENT_FIELDS[kind]]);
  const seq = readInteger(r.seq, meter, `${p}.seq`, 1);
  charge(meter, 2, p); const out: Record<string, unknown> = { kind, seq };
  for (const key of EVENT_FIELDS[kind]) {
    charge(meter, 2, p); const value = r[key], at = `${p}.${key}`;
    charge(meter, 5, p);
    if (key === "id" || key === "lineageId" || key === "mineId" || key === "receiptId" || key === "witnessId") {
      charge(meter, 4, p);
      out[key] = readId(value, side, key === "mineId" ? "mine" : key === "receiptId" ? "receipt" : key === "witnessId" ? "witness" : "unit", meter, at);
    } else if (key === "actionRef") {
      charge(meter, 2, p); out[key] = kind === "own-mine-endowed" ? readLiteral(value, null, meter, at) : readActionRef(value, meter, at);
    } else if (key === "square" || key === "from" || key === "to" || key === "requestedSquare") {
      charge(meter, 4, p); out[key] = readSquare(value, meter, at);
    } else if (key === "type" || key === "typeAtLoss" || key === "fromType" || key === "toType" || key === "unit") {
      charge(meter, 5, p); out[key] = readType(value, meter, at, !(kind === "own-unit-endowed" || key === "fromType"));
    } else if (key === "changes") {
      const cells = readCells(value, side, meter, at, false);
      ordered(cells, meter, at, (a, b) => { charge(meter, 4, p); return a.square < b.square ? -1 : a.square === b.square ? 0 : 1; }); out[key] = cells;
    } else if (key === "mode") {
      charge(meter, 3, at); if (value !== "tank" && value !== "siege") return fail(at); out[key] = value;
    } else {
      charge(meter, 8, at);
      const zero = key === "paidBasis" || key === "paidDelta" || key === "paidLowerBound";
      const low = key === "gas" || key === "minerals" || key === "paidMinerals" || key === "replacementLowerBound" ? 1 : 0;
      const high = zero ? 0 : key === "turn" ? 45 : key === "before" || key === "after" || key === "gas" || key === "actualCreditedMinerals" ? 3 : 9;
      out[key] = readInteger(value, meter, at, low, high);
    }
    charge(meter, 1, p);
  }
  charge(meter, 5, p);
  if (kind === "own-unit-moved" && out.from === out.to || kind === "own-unit-transformed" && out.fromType === out.toType || kind === "own-cc-lives-changed" && (out.after as number) >= (out.before as number)) return fail(p, "CONSISTENCY");
  charge(meter, 3, p);
  if (kind === "own-paid-receipt") {
    charge(meter, 6, p); const ref = out.actionRef as { planningOrdinal: number; acceptedActionOrdinal: number };
    if (out.receiptId !== `${side}:receipt:${ref.planningOrdinal}:${ref.acceptedActionOrdinal}` || out.minerals !== replacement(out.unit as UnitType, meter, p)) return fail(p, "DERIVED");
  }
  if (kind === "enemy-unit-destruction-witnessed" && out.replacementLowerBound !== replacement(out.type as UnitType, meter, p)) return fail(`${p}.replacementLowerBound`, "DERIVED");
  return freezeRecord(out as unknown as AuthorizedEvent, 2 + EVENT_FIELDS[kind].length, meter, p);
};
export const validateBatch = (v: unknown, meter: Meter, p = "$"): AuthorizedBoundaryBatch => {
  const r = readObject(v, meter, p, ["version", "side", "ordinal", "phase", "turn", "planningOrdinal", "seqBefore", "seqThrough", "events", "snapshot"]);
  readLiteral(r.version, "challenge-boundary-batch-v1", meter, `${p}.version`);
  const side = readSide(r.side, meter, `${p}.side`), ordinal = readInteger(r.ordinal, meter, `${p}.ordinal`, 0, 128), planningOrdinal = readInteger(r.planningOrdinal, meter, `${p}.planningOrdinal`, 0, 64);
  charge(meter, 4, p); if (r.phase !== "initial" && r.phase !== "turn-open" && r.phase !== "settled") return fail(`${p}.phase`);
  const phase = r.phase, turn = readInteger(r.turn, meter, `${p}.turn`, 0, 45), seqBefore = readInteger(r.seqBefore, meter, `${p}.seqBefore`), seqThrough = readInteger(r.seqThrough, meter, `${p}.seqThrough`);
  const events = readArray(r.events, meter, `${p}.events`, 0, 2048, (x, at) => readEvent(x, side, meter, at));
  charge(meter, 5, p); if (!Number.isSafeInteger(seqBefore + events.length) || seqThrough !== seqBefore + events.length) return fail(`${p}.seqThrough`, "SEQUENCE");
  const snapshot = validateSnapshot(r.snapshot, meter, `${p}.snapshot`);
  charge(meter, 4, p); if (snapshot.side !== side || snapshot.turn !== turn) return fail(`${p}.snapshot`, "CONSISTENCY");
  charge(meter, 10, p); let visionTurn = -1, effectsStarted = false, lastDebit = -1, awaitingGas = false, receipts = 0, income = 0, endowedUnits = 0, endowedMines = 0;
  const gasRefs = new Set<number>();
  for (let i = 0; ; ) {
    charge(meter, 1, p); if (i === events.length) break;
    charge(meter, 5, p); const event = events[i]!, at = `${p}.events[${i}]`;
    if (event.seq !== seqBefore + i + 1) return fail(`${at}.seq`, "SEQUENCE");
    charge(meter, 1, p); if (event.kind === "vision-witness") { charge(meter, 5, at); if (event.turn < visionTurn || event.turn > turn) return fail(`${at}.turn`, "SEQUENCE"); visionTurn = event.turn; }
    charge(meter, 5, at); if ("actionRef" in event && event.actionRef !== null && event.actionRef.planningOrdinal !== planningOrdinal - 1) return fail(`${at}.actionRef`, "SEQUENCE");
    charge(meter, 3, at);
    if (event.kind === "own-paid-receipt" || event.kind === "own-gas-debited") {
      charge(meter, 6, at); const action = event.actionRef.acceptedActionOrdinal;
      if (phase !== "settled" || effectsStarted || action < lastDebit) return fail(at, "ORDER");
      charge(meter, 1, at); if (event.kind === "own-paid-receipt") {
        charge(meter, 6, at); receipts++; if (receipts > 1 || awaitingGas || action <= lastDebit) return fail(at, "IDENTITY"); awaitingGas = true;
      } else {
        charge(meter, 9, at); if (gasRefs.has(action) || awaitingGas && (action !== lastDebit || event.gas !== 1)) return fail(at, "IDENTITY"); gasRefs.add(action); awaitingGas = false;
      }
      charge(meter, 1, at); lastDebit = action;
    } else { charge(meter, 2, at); if (awaitingGas) return fail(at, "ORDER"); effectsStarted = true; }
    charge(meter, 2, at); if (event.kind === "own-income") { charge(meter, 1, at); income++; }
    charge(meter, 1, at); if (phase === "initial") {
      charge(meter, 3, at); if (event.kind === "own-unit-endowed") {
        charge(meter, 9, at); const unit = snapshot.ownUnitLineage[endowedUnits];
        if (endowedMines || !unit || event.id !== `${side}:unit:opening:${event.square}` || event.id !== unit.id || event.square !== unit.square || event.type !== unit.type || unit.paidBasis !== 0) return fail(at, "IDENTITY"); endowedUnits++;
      } else if (event.kind === "own-mine-endowed") {
        charge(meter, 7, at); const mine = snapshot.ownMineLineage[endowedMines];
        if (!mine || event.mineId !== `${side}:mine:opening:${event.square}` || event.mineId !== mine.mineId || event.square !== mine.square) return fail(at, "IDENTITY"); endowedMines++;
      } else return fail(at, "ORDER");
    } else {
      charge(meter, 3, at); if (event.kind === "own-unit-endowed" || event.kind === "own-mine-endowed") return fail(at, "IDENTITY");
      charge(meter, 7, at); if (phase === "turn-open" && !["own-unit-destroyed", "own-mine-removed", "own-cc-lives-changed", "enemy-unit-destruction-witnessed", "vision-witness"].includes(event.kind)) return fail(at, "ORDER");
    }
    charge(meter, 1, at); i++;
  }
  charge(meter, 1, p); if (awaitingGas) return fail(`${p}.events`, "ORDER");
  charge(meter, 1, p); if (phase === "initial") {
    charge(meter, 12, p); if (ordinal !== 0 || planningOrdinal !== 0 || seqBefore !== 0 || endowedUnits !== snapshot.ownUnitLineage.length || endowedMines !== snapshot.ownMineLineage.length || snapshot.economicState.receipts.length !== 0 || snapshot.economicState.retiredOwnIds.length !== 0 || snapshot.economicState.ownReplacementDestroyed !== 0 || snapshot.economicState.enemyLoss.confirmedUnitCount !== 0) return fail(p, "SEQUENCE");
    for (const sighting of snapshot.memory) { charge(meter, 3, p); if (snapshot.cells[squareIndex(sighting.square, meter, p)]!.visibility === "unknown") return fail(`${p}.snapshot.memory`, "CONSISTENCY"); }
  } else { charge(meter, 8, p); if (ordinal !== (phase === "turn-open" ? 2 * planningOrdinal + 1 : 2 * planningOrdinal) || phase === "settled" && planningOrdinal === 0) return fail(p, "SEQUENCE"); }
  charge(meter, 7, p); if (phase === "settled" ? income !== 1 || events.at(-1)?.kind !== "own-income" : income !== 0) return fail(`${p}.events`, "ORDER");
  charge(meter, 10, p); return freezeRecord({ version: "challenge-boundary-batch-v1", side, ordinal, phase, turn, planningOrdinal, seqBefore, seqThrough, events, snapshot }, 10, meter, p);
};
export const validateBoundary = (v: unknown, meter: Meter, p = "$"): CheckedBoundary => {
  const r = readObject(v, meter, p, ["snapshot", "economicState", "ownMineAuditState", "everLit", "ordinal", "phase", "planningOrdinal", "seqThrough", "lastBatchBytes"]);
  const snapshot = validateSnapshot(r.snapshot, meter, `${p}.snapshot`), economicState = readLedger(r.economicState, snapshot.side, meter, `${p}.economicState`);
  if (!equalCanonical(economicState, snapshot.economicState, meter, p)) return fail(`${p}.economicState`, "CONSISTENCY");
  const a = readObject(r.ownMineAuditState, meter, `${p}.ownMineAuditState`, ["liveOwnMines", "retiredOwnMineIdsSorted", "ownMineCreationCounter"]);
  const liveOwnMines = readMineLineage(a.liveOwnMines, snapshot.side, meter, `${p}.ownMineAuditState.liveOwnMines`);
  const retiredOwnMineIdsSorted = readArray(a.retiredOwnMineIdsSorted, meter, `${p}.ownMineAuditState.retiredOwnMineIdsSorted`, 0, 195, (x, at) => readId(x, snapshot.side, "mine", meter, at));
  ordered(retiredOwnMineIdsSorted, meter, `${p}.ownMineAuditState.retiredOwnMineIdsSorted`, (x, y) => { charge(meter, 2, p); return x < y ? -1 : x === y ? 0 : 1; });
  const ownMineCreationCounter = readInteger(a.ownMineCreationCounter, meter, `${p}.ownMineAuditState.ownMineCreationCounter`, 0, 192);
  charge(meter, liveOwnMines.length * 2 + retiredOwnMineIdsSorted.length + 2, p);
  const issued = [...liveOwnMines.map(x => x.mineId), ...retiredOwnMineIdsSorted]; unique(issued, meter, `${p}.ownMineAuditState`);
  charge(meter, 2, p); let created = 0;
  for (const id of issued) { charge(meter, id.length + 3, p); if (id.includes(":created:")) created++; }
  charge(meter, 4, p); if (created !== ownMineCreationCounter || issued.length - created > 3 || !equalCanonical(liveOwnMines, snapshot.ownMineLineage, meter, p)) return fail(`${p}.ownMineAuditState`, "IDENTITY");
  for (let i = 1; i <= created; i++) { charge(meter, 4, p); if (!contains(issued, `${snapshot.side}:mine:created:${i}`, meter, p)) return fail(`${p}.ownMineAuditState`, "IDENTITY"); }
  const everLit = readSquares(r.everLit, meter, `${p}.everLit`);
  for (const cell of snapshot.cells) { charge(meter, 2, p); if (cell.visibility === "lit" && !contains(everLit, cell.square, meter, p)) return fail(`${p}.everLit`, "CONSISTENCY"); }
  const lastBatchBytes = copyByteInput(r.lastBatchBytes, meter, `${p}.lastBatchBytes`);
  const batch = validateBatch(parseCanonicalBytes(lastBatchBytes, meter, `${p}.lastBatchBytes`), meter, `${p}.lastBatchBytes`);
  const ordinal = readInteger(r.ordinal, meter, `${p}.ordinal`, 0, 128), planningOrdinal = readInteger(r.planningOrdinal, meter, `${p}.planningOrdinal`, 0, 64), seqThrough = readInteger(r.seqThrough, meter, `${p}.seqThrough`);
  charge(meter, 9, p); if (ordinal !== batch.ordinal || r.phase !== batch.phase || planningOrdinal !== batch.planningOrdinal || seqThrough !== batch.seqThrough || !equalCanonical(snapshot, batch.snapshot, meter, p)) return fail(p, "CONSISTENCY");
  charge(meter, 3, p); if (ownMineCreationCounter > 3 * planningOrdinal) return fail(p, "SEQUENCE");
  for (const receipt of economicState.receipts) { charge(meter, 3, p); if (receipt.actionRef.planningOrdinal >= planningOrdinal) return fail(p, "SEQUENCE"); }
  charge(meter, 12, p); const ownMineAuditState = freezeRecord({ liveOwnMines, retiredOwnMineIdsSorted, ownMineCreationCounter }, 3, meter, p);
  return freezeRecord({ snapshot, economicState, ownMineAuditState, everLit, ordinal, phase: batch.phase, planningOrdinal, seqThrough, lastBatchBytes }, 9, meter, p);
};

export const validateState = (v: unknown, meter: Meter, boundary?: CheckedBoundary, p = "$"): EconomicBeliefState => {
  const r = readObject(v, meter, p, ["version", "side", "ordinal", "seqThrough", "planningOrdinal", "turn", "boundaryRef", "cells", "memory", "witnessed", "unlocated", "enemyCC", "components", "publicSupport"]);
  readLiteral(r.version, "challenge-enemy-economic-belief-v1", meter, `${p}.version`);
  const side = readSide(r.side, meter, `${p}.side`), ordinal = readInteger(r.ordinal, meter, `${p}.ordinal`, 0, 256);
  const seqThrough = readInteger(r.seqThrough, meter, `${p}.seqThrough`), planningOrdinal = readInteger(r.planningOrdinal, meter, `${p}.planningOrdinal`, 0, 63), turn = readInteger(r.turn, meter, `${p}.turn`, 0, 45);
  const boundaryRef = readByteRef(r.boundaryRef, meter, `${p}.boundaryRef`), cells = readCells(r.cells, side, meter, `${p}.cells`), memory = readMemory(r.memory, side, turn, cells, meter, `${p}.memory`);
  const witnessed = readSquares(r.witnessed, meter, `${p}.witnessed`), unlocated = readSquares(r.unlocated, meter, `${p}.unlocated`), enemyCC = readSquares(r.enemyCC, meter, `${p}.enemyCC`, 1);
  const publicSupport = readArray(r.publicSupport, meter, `${p}.publicSupport`, JOINT_SIZE, JOINT_SIZE, (x, at) => {
    charge(meter, 2, at); return typeof x === "boolean" ? x : fail(at);
  });
  charge(meter, 4, p); let supported = false, lower = 0, unknown = 0, seenCC = false;
  for (const cell of cells) {
    charge(meter, 2, p); if (cell.visibility === "unknown") { charge(meter, 1, p); unknown++; continue; }
    charge(meter, 4, p); if (cell.piece && cell.piece.color !== side) {
      charge(meter, 1, p); if (cell.piece.type === "k") { charge(meter, 3, p); seenCC = true; if (enemyCC.length !== 1 || enemyCC[0] !== cell.square) return fail(`${p}.enemyCC`, "CONSISTENCY"); }
      else { charge(meter, 1, p); lower += replacement(cell.piece.type, meter, p); }
    }
  }
  charge(meter, 7, p); const reserve = seenCC ? 0 : 1, upper = Math.min(576, lower + 9 * (unknown - reserve));
  if (unknown < reserve) return fail(`${p}.cells`, "CONSISTENCY");
  for (const [name, set] of [["witnessed", witnessed], ["unlocated", unlocated], ["enemyCC", enemyCC]] as const) {
    for (const at of set) {
      charge(meter, 7, p); const cell = cells[squareIndex(at, meter, p)]!;
      if (cell.visibility !== "unknown" && (!cell.piece || cell.piece.color === side || cell.piece.type !== (name === "enemyCC" ? "k" : "p"))) return fail(`${p}.${name}`, "CONSISTENCY");
    }
  }
  for (const cell of cells) {
    charge(meter, 6, p);
    if (cell.visibility !== "unknown" && cell.piece?.color !== side && cell.piece?.type === "p") {
      if (!contains(witnessed, cell.square, meter, p) || contains(unlocated, cell.square, meter, p)) return fail(`${p}.witnessed`, "CONSISTENCY");
    }
  }
  for (let i = 0; ; ) {
    charge(meter, 1, p); if (i === JOINT_SIZE) break;
    charge(meter, 2, p); if (publicSupport[i]) {
      charge(meter, 5, p); const d = i % 577; supported = true;
      if (d < lower || d > upper) return fail(`${p}.publicSupport[${i}]`, "CONSISTENCY");
    }
    charge(meter, 1, p); i++;
  }
  charge(meter, 1, p); if (!supported) return fail(`${p}.publicSupport`, "NUMERIC");
  charge(meter, 1, p); let total = 0;
  const components = readArray(r.components, meter, `${p}.components`, 1, 247, (v, at): Component => {
    const c = readObject(v, meter, at, ["bank", "band", "mass", "conditional"]);
    const bank = readInteger(c.bank, meter, `${at}.bank`, 0, 12), band = readInteger(c.band, meter, `${at}.band`, 0, 18), mass = decodeFloat64(c.mass, meter, `${at}.mass`);
    charge(meter, 4, at); if (mass <= 0 || mass > 1) return fail(`${at}.mass`, "NUMBER"); total += mass;
    const [low, high] = bandBounds(band, meter, at);
    charge(meter, 3, at); const width = high - low + 1; let sum = 0;
    const conditional = readArray(c.conditional, meter, `${at}.conditional`, width, width, (x, ap, i) => {
      const probability = decodeFloat64(x, meter, ap);
      charge(meter, 4, ap); if (probability < 0 || probability > 1) return fail(ap, "NUMBER"); sum += probability;
      charge(meter, 6, ap);
      if (probability > 0 && !publicSupport[577 * bank + low + i]) return fail(ap, "CONSISTENCY");
      charge(meter, 4, ap); if (probability > 0 && probability * mass === 0) return fail(ap, "NUMERIC");
      return encodeFloat64(probability, meter, ap);
    });
    charge(meter, 4, at); if (!Number.isFinite(sum) || Math.abs(sum - 1) > 1e-12) return fail(`${at}.conditional`, "NUMERIC");
    charge(meter, 4, at); return freezeRecord({ bank, band, mass: encodeFloat64(mass, meter, `${at}.mass`), conditional }, 4, meter, at);
  });
  ordered(components, meter, `${p}.components`, (a, b) => { charge(meter, 4, p); return compareTuple([a.bank, a.band], [b.bank, b.band], meter, p); });
  charge(meter, 4, p); if (!Number.isFinite(total) || Math.abs(total - 1) > 1e-12) return fail(`${p}.components`, "NUMERIC");
  charge(meter, 14, p);
  const result: EconomicBeliefState = freezeRecord({ version: "challenge-enemy-economic-belief-v1", side, ordinal, seqThrough, planningOrdinal, turn, boundaryRef, cells, memory, witnessed, unlocated, enemyCC, components, publicSupport }, 14, meter, p);
  charge(meter, 1, p); if (boundary !== undefined) bindStateToBoundary(result, boundary, meter, p);
  return result;
};
export const bindStateToHistory = (state: EconomicBeliefState, history: History, meter: Meter, p = "$"): void => {
  charge(meter, 7, p); const snapshot = history.currentAuthorizedSnapshotV2;
  if (state.side !== snapshot.side || state.turn !== snapshot.turn || !equalCanonical(state.cells, snapshot.cells, meter, p) || !equalCanonical(state.memory, snapshot.memory, meter, p)) fail(p, "CONSISTENCY");
};
export const bindStateToBoundary = (state: EconomicBeliefState, boundary: CheckedBoundary, meter: Meter, p = "$"): void => {
  const r = readObject(boundary, meter, `${p}.boundary`, ["snapshot", "economicState", "ownMineAuditState", "everLit", "ordinal", "phase", "planningOrdinal", "seqThrough", "lastBatchBytes"]);
  const snapshot = validateSnapshot(r.snapshot, meter, `${p}.boundary.snapshot`);
  const ordinal = readInteger(r.ordinal, meter, `${p}.boundary.ordinal`, 0, 128);
  const seqThrough = readInteger(r.seqThrough, meter, `${p}.boundary.seqThrough`);
  const planningOrdinal = readInteger(r.planningOrdinal, meter, `${p}.boundary.planningOrdinal`, 0, 64);
  charge(meter, 10, p);
  if (state.side !== snapshot.side || state.ordinal !== ordinal || state.seqThrough !== seqThrough || state.planningOrdinal !== planningOrdinal || state.turn !== snapshot.turn ||
    !equalCanonical(state.cells, snapshot.cells, meter, p) || !equalCanonical(state.memory, snapshot.memory, meter, p) || !equalCanonical(state.boundaryRef, referenceBytes(r.lastBatchBytes, meter, p), meter, p)) fail(p, "CONSISTENCY");
};
export const validateReadout = (v: unknown, meter: Meter, p = "$"): EconomicReadout => {
  const r = readObject(v, meter, p, ["version", "boundaryRef", "meanD", "meanPotential", "quantilesD", "quantilesPotential", "balance", "uncertainty"]);
  readLiteral(r.version, "starchess-economic-readout-v1", meter, `${p}.version`);
  const boundaryRef = readByteRef(r.boundaryRef, meter, `${p}.boundaryRef`);
  const meanD = validateFloat64(r.meanD, meter, `${p}.meanD`, 0, 576), meanPotential = validateFloat64(r.meanPotential, meter, `${p}.meanPotential`, 0, 588);
  const balance = validateFloat64(r.balance, meter, `${p}.balance`, -576, 576), uncertainty = validateFloat64(r.uncertainty, meter, `${p}.uncertainty`, 0, 288);
  const quantiles = (x: unknown, at: string, max: number) => {
    const q = readArray(x, meter, at, 4, 4, (v, ap) => readInteger(v, meter, ap, 0, max)) as readonly [number, number, number, number];
    charge(meter, 6, at); if (q[2] > q[0] || q[0] > q[1] || q[1] > q[3]) return fail(at, "ORDER"); return q;
  };
  const quantilesD = quantiles(r.quantilesD, `${p}.quantilesD`, 576), quantilesPotential = quantiles(r.quantilesPotential, `${p}.quantilesPotential`, 588);
  const d = decodeFloat64(meanD, meter, p), potential = decodeFloat64(meanPotential, meter, p);
  charge(meter, 4, p); if (potential < d || potential > d + 12) return fail(`${p}.meanPotential`, "CONSERVATION");
  for (let i = 0; ; ) {
    charge(meter, 1, p); if (i === 4) break;
    charge(meter, 6, p); if (quantilesPotential[i]! < quantilesD[i]! || quantilesPotential[i]! > quantilesD[i]! + 12) return fail(`${p}.quantilesPotential`, "CONSERVATION");
    charge(meter, 1, p); i++;
  }
  charge(meter, 3, p); if (decodeFloat64(uncertainty, meter, p) !== (quantilesD[3] - quantilesD[2]) / 2) return fail(`${p}.uncertainty`, "DERIVED");
  charge(meter, 8, p); return freezeRecord({ version: "starchess-economic-readout-v1", boundaryRef, meanD, meanPotential, quantilesD, quantilesPotential, balance, uncertainty }, 8, meter, p);
};

export const canonicalBytes = (v: unknown, meter: ValidationMeter, p = "$"): Uint8Array => {
  charge(meter, 3, p); const output: number[] = [], ancestors = new Set<object>();
  const put = (byte: number): void => { charge(meter, 4, p); if (output.length >= ECONOMIC_BYTE_CAP) fail(p, "SIZE"); output.push(byte); };
  const ascii = (text: string): void => { for (let i = 0; ; ) { charge(meter, 1, p); if (i === text.length) break; charge(meter, 1, p); put(text.charCodeAt(i)); charge(meter, 1, p); i++; } };
  const string = (text: string): void => {
    put(34);
    for (let i = 0; ; ) {
      charge(meter, 1, p); if (i === text.length) break;
      charge(meter, 5, p); const code = text.charCodeAt(i);
      if (code === 34 || code === 92) { put(92); put(code); }
      else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) {
        charge(meter, 18, p); const point = 0x10000 + ((code - 0xd800) << 10) + text.charCodeAt(i + 1) - 0xdc00;
        put(240 | (point >>> 18)); put(128 | ((point >>> 12) & 63)); put(128 | ((point >>> 6) & 63)); put(128 | (point & 63)); i++;
      } else if (code < 32 || (code >= 0xd800 && code <= 0xdfff)) {
        charge(meter, 4, p); const escapes: Record<number, string> = { 8: "b", 9: "t", 10: "n", 12: "f", 13: "r" };
        const short = escapes[code];
        charge(meter, 1, p); if (short) { put(92); ascii(short); }
        else { charge(meter, 4, p); ascii(`\\u${code.toString(16).padStart(4, "0")}`); }
      } else if (code < 128) put(code);
      else if (code < 2048) { charge(meter, 5, p); put(192 | (code >>> 6)); put(128 | (code & 63)); }
      else { charge(meter, 8, p); put(224 | (code >>> 12)); put(128 | ((code >>> 6) & 63)); put(128 | (code & 63)); }
      charge(meter, 1, p); i++;
    }
    put(34);
  };
  const visit = (value: unknown, depth: number): void => {
    charge(meter, 3, p); if (depth > 16) fail(p, "SIZE");
    if (value === null) { ascii("null"); return; }
    charge(meter, 1, p); if (typeof value === "string") { string(value); return; }
    charge(meter, 1, p); if (typeof value === "boolean") { ascii(value ? "true" : "false"); return; }
    charge(meter, 1, p); if (typeof value === "number") { charge(meter, 3, p); if (!Number.isFinite(value)) fail(p, "NONFINITE"); ascii(Object.is(value, -0) ? "0" : String(value)); return; }
    charge(meter, 5, p); if (!value || typeof value !== "object" || ancestors.has(value)) return fail(p);
    ancestors.add(value);
    charge(meter, 5, p); const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) return fail(p);
    charge(meter, 2, p); const keys = Reflect.ownKeys(value);
    charge(meter, keys.length, p);
    if (array) {
      charge(meter, 5, p); const length = Object.getOwnPropertyDescriptor(value, "length")!.value as number;
      if (length > 8192 || keys.length !== length + 1) return fail(p, "ARRAY");
      put(91);
      for (let i = 0; ; ) {
        charge(meter, 1, p); if (i === length) break;
        charge(meter, 6, p); const d = Object.getOwnPropertyDescriptor(value, String(i));
        if (!d || !Object.hasOwn(d, "value") || !d.enumerable) return fail(p, "ARRAY");
        charge(meter, 1, p); if (i) put(44);
        charge(meter, 1, p); visit(d.value, depth + 1); charge(meter, 1, p); i++;
      }
      put(93);
    } else {
      charge(meter, 1, p); const names: string[] = [];
      for (const key of keys) {
        charge(meter, 2, p); if (typeof key !== "string") return fail(p);
        charge(meter, 2, p); let i = names.length;
        while (true) { charge(meter, 2, p); if (i === 0) break; charge(meter, 2, p); if (names[i - 1]! < key) break; charge(meter, 4, p); names[i] = names[i - 1]!; i--; }
        charge(meter, 1, p); names[i] = key;
      }
      put(123);
      for (let i = 0; ; ) {
        charge(meter, 1, p); if (i === names.length) break;
        charge(meter, 6, p); const key = names[i]!, d = Object.getOwnPropertyDescriptor(value, key);
        if (!d || !Object.hasOwn(d, "value") || !d.enumerable) return fail(p);
        charge(meter, 1, p); if (i) put(44);
        string(key); put(58); charge(meter, 1, p); visit(d.value, depth + 1); charge(meter, 1, p); i++;
      }
      put(125);
    }
    charge(meter, 1, p); ancestors.delete(value);
  };
  visit(v, 0);
  charge(meter, output.length * 2 + 1, p);
  return Uint8Array.from(output);
};
export const copyByteInput = (v: unknown, meter: ValidationMeter, p = "$"): Uint8Array => {
  charge(meter, 6, p);
  if (!ArrayBuffer.isView(v) || Object.getPrototypeOf(v) !== Uint8Array.prototype) return fail(p);
  const input = v as Uint8Array;
  const proto = Object.getPrototypeOf(Uint8Array.prototype);
  charge(meter, 6, p);
  const length = Reflect.apply(Object.getOwnPropertyDescriptor(proto, "byteLength")!.get!, input, []) as number;
  const buffer = Reflect.apply(Object.getOwnPropertyDescriptor(proto, "buffer")!.get!, input, []) as ArrayBuffer;
  if (length > ECONOMIC_BYTE_CAP) return fail(p, "SIZE");
  if (Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype) return fail(p);
  charge(meter, length + 2, p); if (Reflect.ownKeys(input).length !== length) return fail(p);
  charge(meter, length + 1, p); const copy = new Uint8Array(length);
  for (let i = 0; ; ) { charge(meter, 1, p); if (i === length) break; charge(meter, 3, p); copy[i] = input[i]!; i++; }
  return copy;
};
export const equalBytes = (a: Uint8Array, b: Uint8Array, meter: ValidationMeter, p: string): boolean => {
  charge(meter, 3, p); if (a.length !== b.length) return false;
  for (let i = 0; ; ) { charge(meter, 1, p); if (i === a.length) return true; charge(meter, 3, p); if (a[i] !== b[i]) return false; charge(meter, 1, p); i++; }
};
export const equalCanonical = (a: unknown, b: unknown, meter: Meter, p = "$"): boolean => {
  charge(meter, 2, p); const left = new Set<object>(), right = new Set<object>();
  const compare = (a: unknown, b: unknown, depth: number): boolean => {
    charge(meter, 4, p); if (depth > 16) return fail(p, "SIZE");
    if (typeof a !== typeof b) return false;
    charge(meter, 2, p); if (a === null || b === null) return a === b;
    charge(meter, 1, p); if (typeof a === "string") {
      charge(meter, 3, p); const text = b as string; if (a.length !== text.length) return false;
      for (let i = 0; ; ) { charge(meter, 1, p); if (i === a.length) return true; charge(meter, 3, p); if (a[i] !== text[i]) return false; charge(meter, 1, p); i++; }
    }
    charge(meter, 1, p); if (typeof a === "number") { charge(meter, 5, p); if (!Number.isFinite(a) || !Number.isFinite(b)) return fail(p, "NONFINITE"); return a === b; }
    charge(meter, 1, p); if (typeof a === "boolean") { charge(meter, 1, p); return a === b; }
    charge(meter, 5, p); if (typeof a !== "object" || typeof b !== "object" || left.has(a) || right.has(b)) return fail(p);
    charge(meter, 7, p); const array = Array.isArray(a), otherArray = Array.isArray(b), ap = Object.getPrototypeOf(a), bp = Object.getPrototypeOf(b);
    if (array !== otherArray) return false;
    charge(meter, 6, p); if (array ? ap !== Array.prototype || bp !== Array.prototype : ap !== Object.prototype && ap !== null || bp !== Object.prototype && bp !== null) return fail(p);
    charge(meter, 2, p); const keys = Reflect.ownKeys(a), otherKeys = Reflect.ownKeys(b);
    charge(meter, keys.length + otherKeys.length + 1, p); if (keys.length !== otherKeys.length) return false;
    charge(meter, 2, p); left.add(a); right.add(b);
    if (array) {
      charge(meter, 7, p); const al = Object.getOwnPropertyDescriptor(a, "length")!.value as number, bl = Object.getOwnPropertyDescriptor(b, "length")!.value as number;
      if (al > 8192 || bl > 8192 || keys.length !== al + 1 || otherKeys.length !== bl + 1) return fail(p, "ARRAY");
      charge(meter, 1, p); if (al !== bl) return false;
    }
    for (const key of keys) {
      charge(meter, 3, p); if (typeof key !== "string") return fail(p);
      if (array && key === "length") continue;
      charge(meter, 8, p); const ad = Object.getOwnPropertyDescriptor(a, key), bd = Object.getOwnPropertyDescriptor(b, key);
      if (!ad || !Object.hasOwn(ad, "value") || !ad.enumerable) return fail(p);
      if (!bd) return false;
      charge(meter, 3, p); if (!Object.hasOwn(bd, "value") || !bd.enumerable) return fail(p);
      charge(meter, 1, p); if (!compare(ad.value, bd.value, depth + 1)) return false;
    }
    charge(meter, 2, p); left.delete(a); right.delete(b); return true;
  };
  return compare(a, b, 0);
};

export const parseCanonicalBytes = (input: unknown, meter: ValidationMeter, p = "$"): unknown => {
  const bytes = copyByteInput(input, meter, p);
  charge(meter, 2, p); let cursor = 0;
  const peek = (): number => { charge(meter, 1, p); return bytes[cursor] ?? -1; };
  const take = (): number => { charge(meter, 3, p); return bytes[cursor++] ?? -1; };
  const expect = (code: number): void => { charge(meter, 1, p); if (take() !== code) fail(p, "JSON"); };
  const str = (): string => {
    expect(34); charge(meter, 1, p); let result = "";
    while (true) {
      const c = take(); charge(meter, 4, p);
      if (c === 34) return result;
      if (c < 32) return fail(p, "JSON");
      let code = c;
      if (c === 92) {
        const e = take(); charge(meter, 4, p);
        const escaped: Record<number, number> = { 34: 34, 92: 92, 47: 47, 98: 8, 102: 12, 110: 10, 114: 13, 116: 9 };
        charge(meter, 2, p);
        if (e === 117) {
          charge(meter, 1, p); code = 0;
          for (let i = 0; i < 4; i++) {
            charge(meter, 10, p); const h = take();
            const digit = h >= 48 && h <= 57 ? h - 48 : h >= 97 && h <= 102 ? h - 87 : h >= 65 && h <= 70 ? h - 55 : -1;
            charge(meter, 4, p); if (digit < 0) return fail(p, "JSON"); code = 16 * code + digit;
          }
        } else { charge(meter, 2, p); if (!Object.hasOwn(escaped, e)) return fail(p, "JSON"); code = escaped[e]!; }
      } else if (c >= 128) {
        charge(meter, 12, p);
        const lanes = c >= 0xc2 && c <= 0xdf ? 2 : c >= 0xe0 && c <= 0xef ? 3 : c >= 0xf0 && c <= 0xf4 ? 4 : 0;
        if (!lanes) return fail(p, "JSON");
        code = c & (127 >>> lanes);
        for (let i = 1; i < lanes; i++) { charge(meter, 8, p); const next = take(); if (next < 128 || next > 191) return fail(p, "JSON"); code = (code << 6) | (next & 63); }
        charge(meter, 8, p); if (code < (lanes === 2 ? 128 : lanes === 3 ? 2048 : 65536) || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return fail(p, "JSON");
      }
      charge(meter, 3, p); result += String.fromCodePoint(code);
    }
  };
  const visit = (depth: number): unknown => {
    charge(meter, 2, p); if (depth > 16) return fail(p, "SIZE");
    const c = peek(); charge(meter, 1, p); if (c === 34) return str();
    charge(meter, 1, p); if (c === 91) {
      take(); charge(meter, 1, p); const array: unknown[] = [];
      charge(meter, 1, p); if (peek() !== 93) while (true) {
        charge(meter, 3, p); if (array.length >= 8192) return fail(p, "CARDINALITY");
        const item = visit(depth + 1); charge(meter, 1, p); array.push(item);
        charge(meter, 1, p); if (peek() !== 44) break; take();
      }
      expect(93); return array;
    }
    charge(meter, 1, p); if (c === 123) {
      take(); charge(meter, 1, p); const object: Record<string, unknown> = Object.create(null);
      charge(meter, 1, p); if (peek() !== 125) while (true) {
        const key = str(); charge(meter, 2, p); if (Object.hasOwn(object, key)) return fail(p, "JSON");
        expect(58); const item = visit(depth + 1); charge(meter, 1, p); object[key] = item;
        charge(meter, 1, p); if (peek() !== 44) break; take();
      }
      expect(125); return object;
    }
    for (const [text, result] of [["true", true], ["false", false], ["null", null]] as const) {
      charge(meter, 3, p); if (c !== text.charCodeAt(0)) continue;
      for (let i = 0; i < text.length; i++) { charge(meter, 4, p); expect(text.charCodeAt(i)); }
      return result;
    }
    charge(meter, 1, p); let text = "";
    while (true) {
      const byte = peek(); charge(meter, 8, p);
      if (!((byte >= 48 && byte <= 57) || byte === 45 || byte === 43 || byte === 46 || byte === 101 || byte === 69)) break;
      charge(meter, 2, p); text += String.fromCharCode(take());
    }
    charge(meter, text.length + 4, p);
    if (!/^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(text)) return fail(p, "JSON");
    const number = Number(text); charge(meter, 2, p); if (!Number.isFinite(number)) return fail(p, "NONFINITE"); return number;
  };
  const value = visit(0); charge(meter, 1, p); if (cursor !== bytes.length || !equalBytes(bytes, canonicalBytes(value, meter, p), meter, p)) return fail(p, "JSON");
  return value;
};

const SHA_K = Object.freeze([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
export const referenceBytes = (value: unknown, meter: Meter, p = "$"): ByteRef => {
  const bytes = copyByteInput(value, meter, p);
  charge(meter, 8, p); const length = Math.ceil((bytes.length + 9) / 64) * 64, bits = bytes.length * 8;
  charge(meter, length + 1, p); const padded = new Uint8Array(length);
  for (let i = 0; i < bytes.length; i++) { charge(meter, 4, p); padded[i] = bytes[i]!; }
  charge(meter, 2, p); padded[bytes.length] = 128;
  for (let i = 0; i < 8; i++) { charge(meter, 7, p); padded[length - 1 - i] = Math.floor(bits / 2 ** (8 * i)) & 255; }
  charge(meter, 73, p); const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], w = new Uint32Array(64);
  const rotate = (x: number, n: number): number => { charge(meter, 4, p); return (x >>> n) | (x << (32 - n)); };
  for (let offset = 0; ; ) {
    charge(meter, 1, p); if (offset === length) break;
    for (let i = 0; i < 16; i++) { charge(meter, 15, p); const at = offset + 4 * i; w[i] = (padded[at]! << 24) | (padded[at + 1]! << 16) | (padded[at + 2]! << 8) | padded[at + 3]!; }
    for (let i = 16; i < 64; i++) {
      charge(meter, 5, p); const a = w[i - 15]!, b = w[i - 2]!;
      charge(meter, 6, p);
      const s0 = rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3), s1 = rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10);
      charge(meter, 8, p); w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    charge(meter, 8, p); let [a,b,c,d,e,f,g,hh] = h as [number,number,number,number,number,number,number,number];
    for (let i = 0; i < 64; i++) {
      charge(meter, 2, p);
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      charge(meter, 18, p); const ch = (e & f) ^ (~e & g), t1 = (hh + s1 + ch + SHA_K[i]! + w[i]!) >>> 0;
      charge(meter, 2, p);
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      charge(meter, 20, p); const maj = (a & b) ^ (a & c) ^ (b & c), t2 = (s0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    charge(meter, 8, p); const lanes = [a,b,c,d,e,f,g,hh];
    for (let i = 0; i < 8; i++) { charge(meter, 7, p); h[i] = (h[i]! + lanes[i]!) >>> 0; }
    charge(meter, 1, p); offset += 64;
  }
  charge(meter, 1, p); let sha256 = "";
  for (const word of h) {
    for (let shift = 28; shift >= 0; shift -= 4) { charge(meter, 7, p); sha256 += "0123456789abcdef"[(word >>> shift) & 15]!; }
  }
  charge(meter, 2, p); return freezeRecord({ byteLength: bytes.length, sha256 }, 2, meter, p);
};
export const decodeArtifact = (bytes: Uint8Array, meter?: Meter): EconomicArtifact => validateArtifact(parseCanonicalBytes(bytes, meter), meter);
export const encodeArtifact = (artifact: EconomicArtifact, meter?: Meter): Uint8Array => canonicalBytes(validateArtifact(artifact, meter), meter);
