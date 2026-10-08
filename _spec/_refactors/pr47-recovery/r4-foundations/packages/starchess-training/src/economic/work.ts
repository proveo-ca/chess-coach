// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { Meter } from "./contracts";
import { ECONOMIC_WORK_CAP } from "./contracts";

export class ContractError extends Error {
  constructor(readonly path: string, readonly code: string) {
    super(`${code}: ${path}`);
    this.name = "ContractError";
  }
}
export const fail = (path: string, code = "SCHEMA"): never => { throw new ContractError(path, code); };
export type ValidationMeter = Meter | undefined;
export const assertClosedOwnKeys = (value: object, allowed: readonly string[], meter: ValidationMeter, path: string, code = "SCHEMA"): void => {
  charge(meter, 12, path);
  const permitted = new Set<string>();
  let maximumLength = 0;
  for (let i = 0; ; ) {
    charge(meter, 1, path); if (i === allowed.length) break;
    charge(meter, 6, path); permitted.add(allowed[i]!); maximumLength = Math.max(maximumLength, allowed[i]!.length); i++;
  }
  const iterator = (function* () { for (const key in value) yield key; })();
  let count = 0;
  for (;;) {
    charge(meter, 3, path);
    const next = iterator.next();
    charge(meter, 1, path);
    if (next.done) break;
    charge(meter, 4, path);
    if (!Object.hasOwn(value, next.value) || count >= allowed.length) return fail(path, code);
    charge(meter, 4, path); if (next.value.length > maximumLength || !permitted.has(next.value)) return fail(path, code);
    charge(meter, 1, path); count++;
  }
  charge(meter, allowed.length + 3, path);
  const keys = Reflect.ownKeys(value);
  if (keys.length !== allowed.length) return fail(path, code);
};
export const validateMeter = (value: unknown, path = "$.meter"): Meter => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(path);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fail(path);
  assertClosedOwnKeys(value, ["limit", "used"], undefined, path);
  const limit = Object.getOwnPropertyDescriptor(value, "limit");
  const used = Object.getOwnPropertyDescriptor(value, "used");
  if (!limit || !Object.hasOwn(limit, "value") || !limit.enumerable || limit.value !== ECONOMIC_WORK_CAP) return fail(`${path}.limit`);
  if (!used || !Object.hasOwn(used, "value") || !used.enumerable || !used.writable) return fail(`${path}.used`);
  if (!Number.isSafeInteger(used.value) || Object.is(used.value, -0) || used.value < 0 || used.value > ECONOMIC_WORK_CAP) return fail(`${path}.used`, "NUMBER");
  return value as Meter;
};
export const charge = (meter: ValidationMeter, n: number, path: string): void => {
  if (!Number.isSafeInteger(n) || Object.is(n, -0) || n < 0) fail(path, "NUMBER");
  if (meter === undefined) return;
  validateMeter(meter);
  if (n > meter.limit - meter.used) fail(path, "WORK_CAP");
  meter.used += n;
};
export const classifyEconomicFailure = (error: unknown): "infrastructure" | null =>
  error instanceof Error && error.name === "ContractError" ? "infrastructure" : null;

export const allocateFloat64 = (length: number, meter: Meter, path: string): Float64Array => {
  charge(meter, 4, path);
  if (!Number.isSafeInteger(length) || length < 0 || length > 8034) return fail(path, "CARDINALITY");
  charge(meter, length, path);
  return new Float64Array(length);
};
export const storeFloat64 = (values: Float64Array, index: number, value: number, meter: Meter, path: string): void => {
  charge(meter, 7, path);
  if (!Number.isSafeInteger(index) || index < 0 || index >= values.length) fail(path, "NUMBER");
  if (!Number.isFinite(value)) fail(path, "NONFINITE");
  values[index] = value;
};
export const sumNonnegative = (values: readonly number[] | Float64Array, meter: Meter, path: string): number => {
  charge(meter, 1, path);
  let total = 0;
  for (let i = 0; ; ) {
    charge(meter, 1, path);
    if (i >= values.length) break;
    charge(meter, 7, path);
    const value = values[i]!;
    if (!Number.isFinite(value) || value < 0) fail(`${path}[${i}]`, "NUMERIC");
    total += value;
    if (!Number.isFinite(total)) fail(path, "NONFINITE");
    i++;
  }
  return total;
};
export const positiveProduct = (a: number, b: number, meter: Meter, path: string): number => {
  charge(meter, 7, path);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) return fail(path, "NUMERIC");
  charge(meter, 5, path);
  const product = a * b;
  if (!Number.isFinite(product)) return fail(path, "NONFINITE");
  if (a > 0 && b > 0 && product === 0) return fail(path, "NUMERIC");
  return product;
};
