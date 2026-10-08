// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { H } from "./contracts";
import { assertClosedOwnKeys, charge, fail, type ValidationMeter } from "./work";

export const decodeFloat64 = (value: unknown, meter: ValidationMeter, path = "$"): number => {
  charge(meter, 5, path);
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(path);
  const prototype = Object.getPrototypeOf(value);
  charge(meter, 5, path);
  if (prototype !== Object.prototype && prototype !== null) return fail(path);
  assertClosedOwnKeys(value, ["hex"], meter, path);
  charge(meter, 8, path);
  const descriptor = Object.getOwnPropertyDescriptor(value, "hex");
  if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return fail(path);
  const hex = descriptor.value as unknown;
  charge(meter, 4, path);
  if (typeof hex !== "string" || hex.length !== 16) return fail(`${path}.hex`);
  charge(meter, 10, path);
  const bytes = new ArrayBuffer(8);
  const view = new DataView(bytes);
  for (let i = 0; ; ) {
    charge(meter, 1, path);
    if (i === 8) break;
    charge(meter, 1, path);
    let byte = 0;
    for (let j = 0; ; ) {
      charge(meter, 1, path);
      if (j === 2) break;
      charge(meter, 4, path);
      const code = hex.charCodeAt(2 * i + j);
      charge(meter, 3, path);
      let digit: number;
      if (code >= 48 && code <= 57) { charge(meter, 1, path); digit = code - 48; }
      else {
        charge(meter, 3, path);
        if (code < 97 || code > 102) return fail(`${path}.hex`);
        charge(meter, 1, path); digit = code - 87;
      }
      charge(meter, 4, path);
      byte = byte * 16 + digit;
      j++;
    }
    charge(meter, 2, path);
    view.setUint8(i, byte);
    i++;
  }
  charge(meter, 3, path);
  const result = view.getFloat64(0, false);
  if (!Number.isFinite(result)) return fail(path, "NONFINITE");
  return result;
};
export const encodeFloat64 = (value: number, meter: ValidationMeter, path = "$"): H => {
  charge(meter, 3, path);
  if (typeof value !== "number" || !Number.isFinite(value)) return fail(path, "NONFINITE");
  charge(meter, 12, path);
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  let hex = "";
  for (let i = 0; ; ) {
    charge(meter, 1, path);
    if (i === 8) break;
    charge(meter, 8, path);
    const byte = view.getUint8(i);
    hex += "0123456789abcdef"[byte >>> 4]! + "0123456789abcdef"[byte & 15]!;
    i++;
  }
  charge(meter, 2, path);
  return Object.freeze({ hex });
};
export const validateFloat64 = (value: unknown, meter: ValidationMeter, path = "$", low = -Number.MAX_VALUE, high = Number.MAX_VALUE): H => {
  const decoded = decodeFloat64(value, meter, path);
  charge(meter, 3, path);
  if (decoded < low || decoded > high) return fail(path, "NUMBER");
  return encodeFloat64(decoded, meter, path);
};
