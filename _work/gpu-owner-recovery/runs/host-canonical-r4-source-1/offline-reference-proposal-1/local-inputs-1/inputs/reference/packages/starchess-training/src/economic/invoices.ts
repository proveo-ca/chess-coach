// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
export class ContractError extends Error {
  override readonly name = "ContractError";
  constructor(readonly path: string, readonly code: string) {
    super(`${code}: ${path}`);
    rememberError(this, true);
  }
}

const errors = new WeakMap<object, boolean>();
const rememberError = WeakMap.prototype.set.bind(errors);
const knownError = WeakMap.prototype.get.bind(errors);
export const fail = (path: string, code = "SCHEMA"): never => { throw new ContractError(path, code); };
export const isContractError = (value: unknown): boolean =>
  value !== null && typeof value === "object" && knownError(value) === true;

export type ClosedBlockId = "scalar" | "float64-encode" | "float64-decode" | "float64-validate" |
  "float64-array" | "float64-store" | "support-initialize" | "support-read" | "support-write" | "support-seal" |
  "r3-visit" | "r3-node" | "r3-byte-read" | "batch-snapshot" | "batch-hash";
export type ValidatedExtent = number;
export const PLANNING_WORK_CAP = 1048576 as const;
export const PLANNING_BOOTSTRAP_UNITS = 2048;
export const PLANNING_GATE_UNITS = 512;
export const PLANNING_CLOSURE_UNITS = 512;
export const PLANNING_ENTRY_UNITS = 1024;
export const PLANNING_INITIAL_UNITS = PLANNING_BOOTSTRAP_UNITS + PLANNING_GATE_UNITS + PLANNING_CLOSURE_UNITS;

const integer = Number.isSafeInteger;
const same = Object.is;
export const checkedExtent = (value: unknown, maximum: number, path = "$.work.extent"): number => {
  if (typeof value !== "number" || !integer(value) || value < 0 || value > maximum || same(value, -0)) return fail(path, "CARDINALITY");
  return value;
};

const applyLane = (arity: number): number => 32 + 8 * arity;
const record = (slots: number): number => 32 + 8 * slots;
const frozen = (slots: number): number => 64 + 16 * slots;
const publish = (slots: number): number => record(slots) + frozen(slots) + 64;
const hex = (characters: number): number => 48 + characters * (applyLane(1) + 4 + 24);
const constructH = 32 + hex(16) + publish(1);
const encodeH = 64 + 40 + 32 + applyLane(3) + 64 + record(1) + 32 + 96 + 32 * 16
  + 8 * (applyLane(1) + 8 + 32) + applyLane(1) + 64 + 16 * 16 + publish(1) + applyLane(2);
const decodeH = 32 + 64 + 40 + 32 + 8 * (16 + 2 * (applyLane(1) + 24) + applyLane(2) + 8) + applyLane(2) + 64;
const blockControl = 128;

export const quoteBlock = (block: ClosedBlockId, extent0: ValidatedExtent, extent1: ValidatedExtent, path = "$.work"): number => {
  checkedExtent(extent1, 0, path);
  switch (block) {
    case "scalar": return blockControl + checkedExtent(extent0, PLANNING_WORK_CAP, path);
    case "float64-encode": return blockControl + checkedExtent(extent0, 8034, path) * encodeH;
    case "float64-decode": return blockControl + checkedExtent(extent0, 8034, path) * decodeH;
    case "float64-validate": return blockControl + checkedExtent(extent0, 8034, path) * (decodeH + 32);
    case "float64-array": return blockControl + 32 + checkedExtent(extent0, 8034, path);
    case "float64-store": return blockControl + checkedExtent(extent0, 8034, path) * 32;
    case "support-initialize":
      if (extent0 !== 7501) return fail(path, "CARDINALITY");
      return blockControl + 1024 + 8 * extent0;
    case "support-read":
      if (extent0 !== 1) return fail(path, "CARDINALITY");
      return blockControl + 32;
    case "support-write":
      if (extent0 !== 1) return fail(path, "CARDINALITY");
      return blockControl + 64;
    case "support-seal":
      if (extent0 !== 7501) return fail(path, "CARDINALITY");
      return blockControl + 1024 + 40 * extent0;
    case "r3-visit": return blockControl + checkedExtent(extent0, 1, path) * 128;
    case "r3-node": return blockControl + checkedExtent(extent0, 1, path) * 256;
    case "r3-byte-read": return blockControl + checkedExtent(extent0, PLANNING_WORK_CAP, path) * (64 + blockControl);
    case "batch-snapshot": return blockControl + 64 + checkedExtent(extent0, PLANNING_WORK_CAP, path) * (2 + blockControl);
    case "batch-hash": return blockControl + 64 + checkedExtent(extent0, PLANNING_WORK_CAP, path) * (32 + blockControl);
    default: return fail(path, "INVOICE");
  }
};
