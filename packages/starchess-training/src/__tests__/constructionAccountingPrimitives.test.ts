// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it, vi } from "vitest";
import { CONSTRUCTION_WORK_CAP, reservePrimitive } from "../economic/accountingPrimitives";
import { requireRef } from "../economic/ownedKernel";

describe("primitive construction reservation arithmetic", () => {
  it("admits the inclusive cap without introducing a storage issuer", () => {
    expect(reservePrimitive(0, CONSTRUCTION_WORK_CAP)).toBe(CONSTRUCTION_WORK_CAP);
    expect(reservePrimitive(CONSTRUCTION_WORK_CAP, 0)).toBe(CONSTRUCTION_WORK_CAP);
    expect(reservePrimitive(CONSTRUCTION_WORK_CAP - 1, 1)).toBe(CONSTRUCTION_WORK_CAP);
    expect(() => reservePrimitive(CONSTRUCTION_WORK_CAP, 1)).toThrow("WORK_CAP");
    expect(() => reservePrimitive(CONSTRUCTION_WORK_CAP - 1, 2)).toThrow("WORK_CAP");
  });

  it.each([-0, -1, .5, NaN, Infinity, CONSTRUCTION_WORK_CAP + 1, "0", null, {}, 0n])("rejects invalid primitive %s without coercion", value => {
    expect(() => reservePrimitive(value as number, 0)).toThrow("NUMBER");
    expect(() => reservePrimitive(0, value as number)).toThrow("NUMBER");
  });

  it("never consults a caller graph or proxy", () => {
    const trap = vi.fn(() => { throw new Error("caller code"); });
    const value = new Proxy({}, { get: trap, ownKeys: trap, getPrototypeOf: trap, getOwnPropertyDescriptor: trap });
    expect(() => reservePrimitive(value as number, 1)).toThrow("NUMBER");
    expect(() => reservePrimitive(1, value as number)).toThrow("NUMBER");
    expect(trap).not.toHaveBeenCalled();
  });

  it("defines accounting and owned rejection names without an inherited setter", () => {
    const prior = Object.getOwnPropertyDescriptor(Error.prototype, "name");
    let calls = 0, capacityError: Error | undefined, ownershipError: Error | undefined;
    const descriptor = { __proto__: null, configurable: true, set() { calls++; } };
    Object.defineProperty(Error.prototype, "name", descriptor);
    try {
      try { reservePrimitive(CONSTRUCTION_WORK_CAP, 1); } catch (error) { capacityError = error as Error; }
      try { requireRef({}); } catch (error) { ownershipError = error as Error; }
    } finally {
      if (prior) {
        const saved = { __proto__: null, ...prior };
        Object.defineProperty(Error.prototype, "name", saved);
      }
      else delete (Error.prototype as unknown as Record<string, unknown>)["name"];
    }
    expect(calls).toBe(0);
    expect(capacityError?.name).toBe("ConstructionAccountingError");
    expect(ownershipError?.name).toBe("OwnedIngressError");
    expect(Object.hasOwn(capacityError!, "name")).toBe(true);
    expect(Object.hasOwn(ownershipError!, "name")).toBe(true);
  });
});
