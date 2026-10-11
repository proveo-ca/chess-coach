// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import type { H, Meter } from "./contracts";
import { abortPlanningWork, consumeWorkBlock, requireFloat64Hex } from "./ownedKernel";
import { decodeOwnedNumber, encodeOwnedNumber } from "./ownedScalars";
import { fail } from "./work";

export const encodeFloat64 = (value: number, meter: Meter, path = "$"): H => {
  consumeWorkBlock(meter, "float64-encode", 1, path);
  try {
    if (typeof value !== "number" || !Number.isFinite(value)) return fail(path, "NONFINITE");
    return encodeOwnedNumber(value);
  } catch (error) { try { abortPlanningWork(meter); } catch { } throw error; }
};
export const decodeFloat64 = (value: unknown, meter: Meter, path = "$"): number => {
  consumeWorkBlock(meter, "float64-decode", 1, path);
  try { return decodeOwnedNumber(value); }
  catch (error) { try { abortPlanningWork(meter); } catch { } throw error; }
};
export const validateFloat64 = (value: unknown, meter: Meter, path = "$", low = -Number.MAX_VALUE, high = Number.MAX_VALUE): H => {
  consumeWorkBlock(meter, "float64-validate", 1, path);
  try {
    const owned = requireFloat64Hex(value), decoded = decodeOwnedNumber(owned);
    if (typeof low !== "number" || typeof high !== "number" || !Number.isFinite(low) || !Number.isFinite(high) || low > high || decoded < low || decoded > high) return fail(path, "NUMBER");
    return owned;
  } catch (error) { try { abortPlanningWork(meter); } catch { } throw error; }
};
