// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import type { Meter } from "./contracts";
import {
  abortA2, abortBlock, abortPlanningWork, beginBlock, consumeWorkBlock, enterA2, finishA2, finishBlock,
  requirePlanningMeter, requireBlockMeter, rejectPlanningWork, reserveBlock, type A2Operation, type A2Ticket, type BlockTicket,
} from "./ownedKernel";
import { checkedExtent, isContractError, type ClosedBlockId } from "./invoices";
export { ContractError } from "./invoices";
export const fail = (path: string, code = "SCHEMA"): never => rejectPlanningWork(path, code);
export type ValidationMeter = Meter;

export const validateMeter = (value: unknown, path = "$.meter"): Meter => requirePlanningMeter(value, path);
export const charge = (meter: Meter, n: number, path: string): void => consumeWorkBlock(meter, "scalar", n, path);
const NativeError = Error;
const descriptor = Object.getOwnPropertyDescriptor;
const own = Object.hasOwn;
export const classifyEconomicFailure = (error: unknown): "infrastructure" | null => {
  if (isContractError(error)) return "infrastructure";
  try {
    if (!(error instanceof NativeError)) return null;
    const name = descriptor(error, "name");
    return name && own(name, "value") && (name.value === "OwnedIngressError" || name.value === "ConstructionAccountingError") ? "infrastructure" : null;
  } catch { return null; }
};
export const prepareWorkEntry = (meter: unknown, operation: A2Operation): A2Ticket => enterA2(meter, operation);
export const prepareWorkClosure = (ticket: A2Ticket): void => finishA2(ticket);
export const abortWorkEntry = (ticket: A2Ticket): void => abortA2(ticket);
export function closeCore(meter: Meter, ticket: A2Ticket, error?: unknown): void {
  if (arguments.length === 3) {
    try { requirePlanningMeter(meter); abortA2(ticket); } catch { }
    throw error;
  }
  requirePlanningMeter(meter);
  finishA2(ticket);
}

export const prepareWorkBatch = (meter: Meter, ticket: A2Ticket, block: ClosedBlockId, extent: number): BlockTicket => {
  requirePlanningMeter(meter);
  const prepaid = reserveBlock(ticket, block, extent, 0);
  beginBlock(meter, prepaid, block);
  return prepaid;
};
export const finishWorkBatch = (meter: Meter, ticket: BlockTicket): void => finishBlock(meter, ticket);
export const abortWorkBatch = (meter: Meter, ticket: BlockTicket): void => abortBlock(meter, ticket);
export const blockMeters = (meter: unknown, ticket: BlockTicket): Meter => requireBlockMeter(meter, ticket);

export const allocateFloat64 = (length: number, meter: Meter, path: string): Float64Array => {
  requirePlanningMeter(meter, path);
  try {
    checkedExtent(length, 8034, path);
    consumeWorkBlock(meter, "float64-array", length, path);
    return new Float64Array(length);
  } catch (error) { try { abortPlanningWork(meter); } catch { } throw error; }
};
export const storeFloat64 = (values: Float64Array, index: number, value: number, meter: Meter, path: string): void => {
  consumeWorkBlock(meter, "float64-store", 1, path);
  try {
    if (!Number.isSafeInteger(index) || index < 0 || index >= values.length || Object.is(index, -0)) fail(path, "NUMBER");
    if (!Number.isFinite(value)) fail(path, "NONFINITE");
    values[index] = value;
  } catch (error) { try { abortPlanningWork(meter); } catch { } throw error; }
};
export const sumNonnegative = (values: readonly number[] | Float64Array, meter: Meter, path: string): number => {
  charge(meter, 1, path);
  let total = 0;
  for (let i = 0; ; i++) {
    charge(meter, 1, path);
    if (i >= values.length) break;
    charge(meter, 7, path);
    const value = values[i]!;
    if (!Number.isFinite(value) || value < 0) fail(path, "NUMERIC");
    total += value;
    if (!Number.isFinite(total)) fail(path, "NONFINITE");
  }
  return total;
};
export const positiveProduct = (a: number, b: number, meter: Meter, path: string): number => {
  charge(meter, 12, path);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) return fail(path, "NUMERIC");
  const result = a * b;
  if (!Number.isFinite(result)) return fail(path, "NONFINITE");
  if (a > 0 && b > 0 && result === 0) return fail(path, "NUMERIC");
  return result;
};
