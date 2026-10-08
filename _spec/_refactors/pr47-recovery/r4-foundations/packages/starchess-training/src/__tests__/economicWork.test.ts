// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { describe, expect, it, vi } from "vitest";
import { decodeFloat64 } from "../economic/float64";
import { readObject, validateState } from "../economic/schema";
import type { EconomicBeliefState, Meter } from "../economic/contracts";
import { allocateFloat64, charge, classifyEconomicFailure, ContractError, positiveProduct, storeFloat64, sumNonnegative, validateMeter } from "../economic/work";

const meter = (used = 0): Meter => ({ limit: 1048576, used });
describe("inclusive planning work", () => {
  it.each(["record", "Float64"] as const)("rejects exhausted %s ingress before observing own keys", kind => {
    let enumerations = 0;
    const input = new Proxy(kind === "record" ? { value: 1 } : { hex: "3ff0000000000000" }, {
      ownKeys(target) { enumerations++; return Reflect.ownKeys(target); },
    });
    const m = meter(1048576 - (kind === "record" ? 9 : 18));
    expect(() => kind === "record" ? readObject(input, m, "$", ["value"]) : decodeFloat64(input, m)).toThrow("WORK_CAP");
    expect(enumerations).toBe(0);
    expect(m.used).toBeLessThanOrEqual(m.limit);
  });
  it.each(["record", "Float64"] as const)("bounds wide ordinary %s rejection without constructing its key list", kind => {
    const input: Record<string, unknown> = kind === "record" ? { value: 1 } : { hex: "3ff0000000000000" };
    for (let i = 0; i < 20000; i++) input[`extra${i}`] = i;
    const original = Reflect.ownKeys, observed: object[] = [];
    const spy = vi.spyOn(Reflect, "ownKeys").mockImplementation(value => { observed.push(value); return original(value); });
    const m = meter();
    try {
      expect(() => kind === "record" ? readObject(input, m, "$", ["value"]) : decodeFloat64(input, m)).toThrow("SCHEMA");
      expect(observed).not.toContain(input);
      expect(m.used).toBeLessThan(256);
    } finally { spy.mockRestore(); }
  });
  it.each(["non-enumerable", "symbol"] as const)("rejects wide %s ingress without allocating an unbounded own-key list", kind => {
    const input = { hex:"3ff0000000000000" };
    for (let i = 0; i < 20000; i++) Object.defineProperty(input, kind === "symbol" ? Symbol(i) : `hidden${i}`, { value:i });
    const original = Reflect.ownKeys; let unsafeEnumerations = 0;
    const spy = vi.spyOn(Reflect, "ownKeys").mockImplementation(value => {
      if (value === input) unsafeEnumerations++;
      return original(value);
    });
    try {
      expect(() => decodeFloat64(input, meter())).toThrow("SCHEMA");
      expect(unsafeEnumerations).toBe(0);
    } finally { spy.mockRestore(); }
  });
  it("keeps exactly two caller-owned data fields and accepts a readonly limit", () => {
    const m = meter(); Object.defineProperty(m, "limit", { writable: false });
    expect(validateMeter(m)).toBe(m); charge(m, 4, "$.work");
    expect(Reflect.ownKeys(m)).toEqual(["limit","used"]);
    expect(Object.getOwnPropertyDescriptor(m, "used")!.writable).toBe(true);
    expect(m.used).toBe(4);
  });
  it.each([0, 1, 1048575, 1048576])("preserves consumed work %i without resetting", used => {
    const m = meter(used); charge(m, 1048576 - used, "$" ); expect(m.used).toBe(1048576);
    charge(m, 0, "$"); expect(m.used).toBe(1048576);
  });
  it("fails capacity checks atomically and classifies exhaustion as infrastructure", () => {
    const m = meter(1048574); charge(m, 1, "$.first");
    let error: unknown; try { charge(m, 2, "$.next"); } catch (e) { error = e; }
    expect(error).toMatchObject({ name: "ContractError", code: "WORK_CAP", path: "$.next", message: "WORK_CAP: $.next" });
    expect(classifyEconomicFailure(error)).toBe("infrastructure"); expect(m.used).toBe(1048575);
    charge(m, 1, "$.last"); expect(m.used).toBe(1048576);
  });
  it("rejects accessors, inherited substitutes, extra and hidden properties without invoking getters", () => {
    let reads = 0;
    for (const m of [
      { limit: 1048576, get used() { reads++; return 0; } }, Object.create(meter()),
      { ...meter(), extra: 0 }, Object.defineProperty(meter(), "cache", { value: new Map() }),
      { ...meter(), [Symbol("hidden")]: 0 }, Object.freeze(meter()), { limit: 1048576, used: -0 },
      { limit: 1048576, used: NaN }, { limit: 1048576, used: 1048577 }, { limit: 65536, used: 0 },
    ]) expect(() => validateMeter(m)).toThrow(ContractError);
    expect(reads).toBe(0);
  });
  it.each([-1, -0, NaN, Infinity, .5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid charge %s atomically", n => {
    const m = meter(17); expect(() => charge(m, n, "$")).toThrow(ContractError); expect(m.used).toBe(17);
  });
  it("charges initialization and output stores before mutating an output", () => {
    const m = meter(), values = allocateFloat64(8, m, "$.values");
    expect(m.used).toBe(12); storeFloat64(values, 3, 5, m, "$.values[3]"); expect(m.used).toBe(19);
    m.used = 1048575;
    expect(() => storeFloat64(values, 3, 7, m, "$.values[3]")).toThrow("WORK_CAP");
    expect(values[3]).toBe(5); expect(m.used).toBe(1048575);
    expect(() => allocateFloat64(8, m, "$.next")).toThrow("WORK_CAP"); expect(m.used).toBe(1048575);
    const graph = meter(); expect(allocateFloat64(13 * 618, graph, "$.headstock")).toHaveLength(8034);
    expect(graph.used).toBe(8038);
    expect(() => allocateFloat64(8035, graph, "$.headstock")).toThrow("CARDINALITY");
  });
  it("charges every reduction lane and catches required positive underflow", () => {
    const a = meter(), b = meter(); expect(sumNonnegative([1,2,3], a, "$")).toBe(6); expect(sumNonnegative([1], b, "$")).toBe(1);
    expect(a.used - b.used).toBe(16);
    expect(() => positiveProduct(Number.MIN_VALUE, .5, meter(), "$.mass")).toThrow("NUMERIC");
    expect(positiveProduct(0, .5, meter(), "$")).toBe(0);
    expect(() => sumNonnegative([Number.MAX_VALUE, Number.MAX_VALUE], meter(), "$")).toThrow("NONFINITE");
  });
  it("shares one transaction across pending reductions and 512 streamed candidate outputs", () => {
    const m = meter(); charge(m, 300000, "$.pendingBoundaries");
    for (let candidate = 0; candidate < 512; candidate++) {
      const row = allocateFloat64(418, m, "$.features");
      for (let coordinate = 0; coordinate < 418; coordinate++) {
        charge(m, 1, "$.output"); row[coordinate] = 0;
      }
    }
    expect(m.used).toBe(300000 + 512 * (4 + 418 + 418));
    charge(m, m.limit - m.used, "$.remaining");
    expect(() => charge(m, 1, "$.candidate513")).toThrow("WORK_CAP"); expect(m.used).toBe(m.limit);
  });
  it("charges Float64 validation repeatedly and preserves work when decoding fails", () => {
    const m = meter(); decodeFloat64({ hex: "3ff0000000000000" }, m);
    const first = m.used; decodeFloat64({ hex: "3ff0000000000000" }, m); expect(m.used).toBe(2 * first);
    const exhausted = meter(1048574); expect(() => decodeFloat64({ hex: "3ff0000000000000" }, exhausted)).toThrow("WORK_CAP"); expect(exhausted.used).toBe(1048574);
  });
  it("publishes no partial state and retains consumed work on schema exhaustion", () => {
    const state: EconomicBeliefState = {
      version: "challenge-enemy-economic-belief-v1", side: "w", ordinal: 0, seqThrough: 0, planningOrdinal: 0, turn: 0,
      boundaryRef: { byteLength: 0, sha256: "0".repeat(64) },
      cells: Array.from({ length: 64 }, (_, i) => ({ square: `${"abcdefgh"[Math.floor(i / 8)]}${i % 8 + 1}` as EconomicBeliefState["enemyCC"][number], visibility: "unknown" })),
      memory: [], witnessed: [], unlocated: [], enemyCC: ["e8"],
      components: [{ bank: 3, band: 4, mass: { hex: "3ff0000000000000" }, conditional: [{ hex: "3ff0000000000000" }, { hex: "0000000000000000" }] }],
      publicSupport: Array.from({ length: 7501 }, (_, i) => i === 1735),
    };
    const before = JSON.stringify(state), m = meter(1048476);
    expect(() => validateState(state, m)).toThrow("WORK_CAP");
    expect(JSON.stringify(state)).toBe(before); expect(m.used).toBeGreaterThan(1048476); expect(m.used).toBeLessThanOrEqual(m.limit);
  });
});
