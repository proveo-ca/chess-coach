// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it, vi } from "vitest";
import { BYTE_PRODUCTION_LIMITS, constructCanonicalOpening, constructRef, readSnapshotByte, requireRef, snapshotFixedBytes, snapshotLength } from "../economic/ownedKernel";

describe("independently observed construction bounds", () => {
  it("rejects an oversized physical view before a proportional allocation", async () => {
    const carrier = new Uint8Array(1048576);
    const allocatedLengths: number[] = [];
    const NativeUint8Array = Uint8Array;
    const observed = new Proxy(NativeUint8Array, {
      construct(target, args) {
        if (typeof args[0] === "number") allocatedLengths.push(args[0]);
        return Reflect.construct(target, args);
      },
    });
    vi.stubGlobal("Uint8Array", observed);
    try {
      const modulePath = "../economic/ownedKernel?allocation-observer";
      const kernel: typeof import("../economic/ownedKernel") = await import(modulePath);
      for (const production of ["float64", "ref", "opening"] as const) {
        expect(() => kernel.snapshotFixedBytes(carrier, production)).toThrow("BYTES");
      }
      expect(allocatedLengths).toEqual([]);
      const snapshot = kernel.snapshotFixedBytes(new NativeUint8Array(26), "float64");
      expect(kernel.snapshotLength(snapshot)).toBe(26);
      expect(allocatedLengths).toEqual([26]);
    } finally { vi.unstubAllGlobals(); }
  });

  it("uses independent view extent rather than buffer extent or carrier expandos", () => {
    const buffer = new ArrayBuffer(1048576), source = new Uint8Array(buffer, 100, 26);
    source[0] = 123;
    Object.defineProperties(source, {
      length: { get() { throw new Error("caller length"); } },
      byteLength: { get() { throw new Error("caller byteLength"); } },
      buffer: { get() { throw new Error("caller buffer"); } },
      byteOffset: { get() { throw new Error("caller offset"); } },
      [Symbol.iterator]: { get() { throw new Error("caller iterator"); } },
    });
    const snapshot = snapshotFixedBytes(source, "float64");
    expect(snapshotLength(snapshot)).toBe(26);
    expect(readSnapshotByte(snapshot, 0)).toBe(123);
    new Uint8Array(buffer)[100] = 0;
    expect(readSnapshotByte(snapshot, 0)).toBe(123);
  });

  it("never copies a receipt to a separately instantiated registry", async () => {
    const modulePath = "../economic/ownedKernel?separate-registry";
    const other: typeof import("../economic/ownedKernel") = await import(modulePath);
    const here = constructRef(26, "a".repeat(64)), there = other.constructRef(26, "a".repeat(64));
    expect(() => other.requireRef(here)).toThrow("PROVENANCE");
    expect(() => requireRef(there)).toThrow("PROVENANCE");
    expect(() => other.requireOpening(constructCanonicalOpening())).toThrow("PROVENANCE");
    const snapshot = snapshotFixedBytes(new Uint8Array(26), "float64");
    expect(() => other.snapshotLength(snapshot)).toThrow("PROVENANCE");
    expect(() => snapshotLength(structuredClone(snapshot))).toThrow("PROVENANCE");
  });

  it("fixes small-production bounds without introducing a planning meter", () => {
    expect(BYTE_PRODUCTION_LIMITS.float64).toBe(26);
    expect(BYTE_PRODUCTION_LIMITS.ref).toBe(107);
    expect(Object.isFrozen(BYTE_PRODUCTION_LIMITS)).toBe(true);
    const opening = constructCanonicalOpening();
    expect(Object.keys(opening).sort()).toEqual(["bank", "cc", "marines", "turn", "version"]);
    expect(Object.keys(opening.bank).sort()).toEqual(["b", "w"]);
    expect(opening.marines.w).toHaveLength(4);
    expect(opening.marines.b).toHaveLength(4);
  });
});
