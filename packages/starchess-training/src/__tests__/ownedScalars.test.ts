// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it, vi } from "vitest";
import { constructCanonicalOpening, constructFloat64Hex, constructRef, requireFloat64Hex, requireOpening, requireRef } from "../economic/ownedKernel";
import { decodeOwnedNumber, encodeOwnedNumber, equalOwnedRefs } from "../economic/ownedScalars";
import { snapshotFixedBytes } from "../economic/ownedBytes";
import { decodeOwnedFloat64Hex, decodeOwnedRef } from "../economic/ownedSchema";

const hash = "a".repeat(64);
const hostile = () => {
  const trap = vi.fn(() => { throw new Error("unsafe inspection"); });
  const value = new Proxy({}, { get: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap });
  return { value, trap };
};

describe("owned scalar and opening construction", () => {
  it.each([0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE, .5, .001, 1e-6])("round-trips finite binary64 %s", value => {
    const owned = encodeOwnedNumber(value);
    expect(Object.is(decodeOwnedNumber(owned), value)).toBe(true);
    expect(Object.isFrozen(owned)).toBe(true);
    expect(Object.keys(owned)).toEqual(["hex"]);
  });

  it.each([NaN, Infinity, -Infinity, "0", null, {}, new Number(1)])("rejects a nonfinite or nonprimitive number %s", value => {
    expect(() => encodeOwnedNumber(value as number)).toThrow("FLOAT64");
  });

  it.each(["7ff0000000000000", "fff0000000000000", "7ff0000000000001", "fff8000000000000", "3FF0000000000000", "0", "g".repeat(16)])("rejects invalid Float64Hex %s", hex => {
    expect(() => constructFloat64Hex(hex)).toThrow("FLOAT64");
  });

  it("preserves both signed zeros in big-endian bytes", () => {
    expect(encodeOwnedNumber(0).hex).toBe("0000000000000000");
    expect(encodeOwnedNumber(-0).hex).toBe("8000000000000000");
    expect(encodeOwnedNumber(.5).hex).toBe("3fe0000000000000");
  });

  it("constructs exact bounded byte references", () => {
    for (const byteLength of [0, 1, 1048576, 1048577, 16777216, Number.MAX_SAFE_INTEGER]) {
      const ref = constructRef(byteLength, hash);
      expect(requireRef(ref)).toBe(ref);
      expect(Object.keys(ref)).toEqual(["byteLength", "sha256"]);
      expect(Object.isFrozen(ref)).toBe(true);
    }
    for (const byteLength of [-0, -1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => constructRef(byteLength, hash)).toThrow("REF");
    for (const sha of ["a".repeat(63), "a".repeat(65), "A".repeat(64), "g".repeat(64)]) expect(() => constructRef(0, sha)).toThrow("REF");
  });

  it("compares only already-owned references", () => {
    const a = constructRef(1, hash);
    expect(equalOwnedRefs(a, constructRef(1, hash))).toBe(true);
    expect(equalOwnedRefs(a, constructRef(2, hash))).toBe(false);
    expect(equalOwnedRefs(a, constructRef(1, "b".repeat(64)))).toBe(false);
    expect(() => equalOwnedRefs(a, { ...a })).toThrow("PROVENANCE");
  });

  it("constructs a detached bottom-up frozen opening", () => {
    const opening = constructCanonicalOpening(), second = constructCanonicalOpening();
    expect(requireOpening(opening)).toBe(opening);
    expect(opening).toEqual({ version: "starchess-economic-opening-v1", turn: 0, bank: { w: 3, b: 3 }, cc: { w: "e1", b: "e8" }, marines: { w: ["c2", "d2", "e2", "f2"], b: ["c7", "d7", "e7", "f7"] } });
    expect(Object.getPrototypeOf(opening)).toBe(Object.prototype);
    for (const child of [opening, opening.bank, opening.cc, opening.marines, opening.marines.w, opening.marines.b]) expect(Object.isFrozen(child)).toBe(true);
    expect(second).not.toBe(opening);
    expect(second.marines.w).not.toBe(opening.marines.w);
  });

  it("rejects proxies before any trap at every scalar/role helper", () => {
    for (const helper of [requireFloat64Hex, requireRef, requireOpening, decodeOwnedNumber]) {
      const { value, trap } = hostile();
      expect(() => helper(value)).toThrow("PROVENANCE");
      expect(trap).not.toHaveBeenCalled();
    }
    const { value, trap } = hostile();
    expect(() => equalOwnedRefs(value, constructRef(1, hash))).toThrow("PROVENANCE");
    expect(() => equalOwnedRefs(constructRef(1, hash), value)).toThrow("PROVENANCE");
    expect(() => constructFloat64Hex(value as string)).toThrow("FLOAT64");
    expect(() => constructRef(value as number, hash)).toThrow("REF");
    expect(() => constructRef(0, value as string)).toThrow("REF");
    expect(() => encodeOwnedNumber(value as number)).toThrow("FLOAT64");
    expect(trap).not.toHaveBeenCalled();
  });

  it("rejects wide hidden/symbol records without reflection", () => {
    const value = Object.create(null);
    for (let i = 0; i < 8192; i++) {
      Object.defineProperty(value, `hidden${i}`, { value: 0 });
      Object.defineProperty(value, Symbol(), { value: 0 });
    }
    const keys = vi.spyOn(Reflect, "ownKeys"), descriptors = vi.spyOn(Object, "getOwnPropertyDescriptor");
    try {
      expect(() => requireFloat64Hex(value)).toThrow("PROVENANCE");
      expect(() => requireRef(value)).toThrow("PROVENANCE");
      expect(() => requireOpening(value)).toThrow("PROVENANCE");
      expect(keys).not.toHaveBeenCalled();
      expect(descriptors).not.toHaveBeenCalled();
    } finally { keys.mockRestore(); descriptors.mockRestore(); }
  });

  it("rejects raw, frozen, copied and wrong-role records", () => {
    const h = encodeOwnedNumber(1), ref = constructRef(1, hash), opening = constructCanonicalOpening();
    for (const value of [{ hex: h.hex }, Object.freeze({ hex: h.hex }), { ...h }, structuredClone(h), ref, opening]) expect(() => decodeOwnedNumber(value)).toThrow("PROVENANCE");
    expect(() => requireRef(h)).toThrow("PROVENANCE");
    expect(() => requireOpening(ref)).toThrow("PROVENANCE");
    expect(() => requireRef(new Proxy(ref, {}))).toThrow("PROVENANCE");
  });

  it("keeps captured identity and scalar intrinsics after replacement", () => {
    const ref = constructRef(1, hash), h = encodeOwnedNumber(.5);
    const get = vi.spyOn(WeakMap.prototype, "get").mockImplementation(() => { throw new Error("uncaptured lookup"); });
    const decode = vi.spyOn(DataView.prototype, "getFloat64").mockImplementation(() => { throw new Error("uncaptured decode"); });
    let same = false, number = 0;
    try { same = requireRef(ref) === ref; number = decodeOwnedNumber(h); }
    finally { get.mockRestore(); decode.mockRestore(); }
    expect(same).toBe(true);
    expect(number).toBe(.5);
  });

  it("never consults inherited numeric accessors while materializing digits", () => {
    const hex = "0000000000000001", sha256 = "0123456789abcdef".repeat(4);
    const snapshot = snapshotFixedBytes(new TextEncoder().encode(`{"hex":"${hex}"}`), "float64");
    const refSnapshot = snapshotFixedBytes(new TextEncoder().encode(`{"byteLength":0,"sha256":"${sha256}"}`), "ref");
    const prior = Object.getOwnPropertyDescriptor(Array.prototype, "15");
    let reads = 0, writes = 0, encoded = "", decoded = "", hashResult = "";
    Object.defineProperty(Array.prototype, "15", {
      configurable: true,
      get() { reads++; return "0"; },
      set() { writes++; },
    });
    try {
      encoded = encodeOwnedNumber(Number.MIN_VALUE).hex;
      decoded = decodeOwnedFloat64Hex(snapshot).hex;
      hashResult = decodeOwnedRef(refSnapshot).sha256;
    } finally {
      if (prior) Object.defineProperty(Array.prototype, "15", prior);
      else delete (Array.prototype as unknown as Record<string, unknown>)["15"];
    }
    expect(encoded).toBe(hex);
    expect(decoded).toBe(hex);
    expect(hashResult).toBe(sha256);
    expect(reads).toBe(0);
    expect(writes).toBe(0);
  });

  it("never consults an inherited iterator while repeating digit slots", () => {
    const snapshot = snapshotFixedBytes(new TextEncoder().encode('{"hex":"0000000000000001"}'), "float64");
    const prior = Object.getOwnPropertyDescriptor(Object.prototype, Symbol.iterator);
    let reads = 0, encoded = "", decoded = "";
    Object.defineProperty(Object.prototype, Symbol.iterator, {
      configurable: true,
      get() { reads++; throw new Error("inherited iterator"); },
    });
    try {
      encoded = encodeOwnedNumber(Number.MIN_VALUE).hex;
      decoded = decodeOwnedFloat64Hex(snapshot).hex;
    } finally {
      if (prior) Object.defineProperty(Object.prototype, Symbol.iterator, prior);
      else delete (Object.prototype as unknown as Record<symbol, unknown>)[Symbol.iterator];
    }
    expect(encoded).toBe("0000000000000001");
    expect(decoded).toBe("0000000000000001");
    expect(reads).toBe(0);
  });
});
