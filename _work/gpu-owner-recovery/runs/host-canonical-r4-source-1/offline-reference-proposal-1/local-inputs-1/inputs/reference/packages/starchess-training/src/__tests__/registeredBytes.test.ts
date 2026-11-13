// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { createHash, Hash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { constructCanonicalOpening, constructFloat64Hex, constructRef, requireRef } from "../economic/ownedKernel";
import { createRegisteredByteStore, requireRegisteredBytes, type ByteRole } from "../coordinator/registeredBytes";

const CAP = 1048576;
const roles = [
  "contracts", "r2Generator", "base", "corrective", "r3Seam", "r3NativeCorrection", "ownedIngress", "economicArtifact",
  "estimatorProvenance", "featureManifest", "economicPin", "economicBinding", "trainingRecipe", "policyArtifact", "episodeWeights",
  "fittingCode", "collectionRecipe", "fittingRecipe", "collectionRoster", "splitRoster", "labelBytes", "fitJournal", "calibrationJournal", "coreRules",
  "source", "tests", "sourceInventory", "sourcePolicy", "dependencyLock", "installedTree", "frozenStore", "toolTree", "image", "runtimeConfiguration",
  "corpusManifest", "corpusSource", "strategicSource", "hostConfiguration", "recipe", "fixtureManifest", "episodeJournal", "privateProvenanceCodec",
  "sourceInventoryAuditorCode", "publicClosureAuditorCode",
] as const satisfies readonly ByteRole[];
const digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const refFor = (bytes: Uint8Array) => constructRef(bytes.byteLength, digest(bytes));
const hostile = (target: object = {}) => {
  const trap = vi.fn(() => { throw new Error("caller trap"); });
  return { value: new Proxy(target, { get: trap, set: trap, ownKeys: trap, getPrototypeOf: trap, getOwnPropertyDescriptor: trap }), trap };
};
const fixture = (role: ByteRole = "economicArtifact", bytes = new Uint8Array([0, 1, 128, 255])) => {
  const ref = refFor(bytes), owner = createRegisteredByteStore();
  owner.register(role, ref, bytes);
  return { role, bytes, ref, owner, store: owner.seal() };
};

describe("private host registered bytes", () => {
  it.each(roles)("independently registers and retrieves exact bytes for %s", role => {
    const { store, ref, bytes } = fixture(role);
    const independentlyIssued = refFor(bytes);
    expect(independentlyIssued).not.toBe(ref);
    const reader = requireRegisteredBytes(store, role, independentlyIssued);
    expect(reader.length).toBe(bytes.length);
    expect(Array.from({ length: reader.length }, (_, index) => reader.readByte(index))).toEqual(Array.from(bytes));
    expect(Object.isFrozen(reader)).toBe(true);
    expect(Object.getPrototypeOf(reader)).toBeNull();
    expect(Reflect.ownKeys(reader)).toEqual(["length", "readByte"]);
    expect(Object.getOwnPropertyDescriptor(reader, "length")).toEqual({ value: bytes.length, writable: false, enumerable: true, configurable: false });
    expect(Object.isFrozen(reader.readByte)).toBe(true);
  });

  it("copies a physical subview and ignores all carrier expandos without callbacks", () => {
    const buffer = new ArrayBuffer(CAP + 500), bytes = new Uint8Array(buffer, 100, 4);
    bytes.set([17, 23, 29, 31]);
    const ref = refFor(bytes), owner = createRegisteredByteStore();
    const getter = vi.fn(() => { throw new Error("caller getter"); });
    for (const key of ["length", "byteLength", "buffer", "byteOffset", "constructor", Symbol.iterator, Symbol.toStringTag, Symbol.species]) {
      Object.defineProperty(bytes, key, { get: getter });
    }
    owner.register("economicArtifact", ref, bytes);
    new Uint8Array(buffer)[100] = 250;
    const store = owner.seal(), reader = requireRegisteredBytes(store, "economicArtifact", constructRef(4, ref.sha256));
    expect([0, 1, 2, 3].map(index => reader.readByte(index))).toEqual([17, 23, 29, 31]);
    new Uint8Array(buffer).fill(0);
    expect(reader.readByte(3)).toBe(31);
    expect(requireRegisteredBytes(store, "economicArtifact", ref).readByte(0)).toBe(17);
    expect(getter).not.toHaveBeenCalled();
    expect(Reflect.set(reader, "length", 0)).toBe(false);
    expect(Reflect.set(reader, "readByte", () => 0)).toBe(false);
  });

  it("rejects proxy carriers with zero traps", () => {
    const bytes = new Uint8Array([1]), ref = refFor(bytes), owner = createRegisteredByteStore();
    const wrapped = hostile(bytes), raw = hostile();
    for (const carrier of [wrapped.value, raw.value]) expect(() => owner.register("base", ref, carrier)).toThrow("CARRIER");
    expect(wrapped.trap).not.toHaveBeenCalled();
    expect(raw.trap).not.toHaveBeenCalled();
    const { proxy, revoke } = Proxy.revocable(bytes, {});
    revoke();
    expect(() => owner.register("base", ref, proxy)).toThrow("CARRIER");
  });

  it("requires exact owned refs before any ref property or carrier access", () => {
    const bytes = new Uint8Array([1]), ref = refFor(bytes), owner = createRegisteredByteStore();
    const property = vi.fn(() => { throw new Error("caller ref"); });
    const fake = Object.defineProperties({}, { byteLength: { get: property }, sha256: { get: property } });
    const wrapped = hostile(ref), raw = hostile(), carrier = hostile(bytes);
    const invalidRefs = [null, undefined, {}, { ...ref }, Object.freeze({ ...ref }), structuredClone(ref), fake,
      constructFloat64Hex("0000000000000000"), constructCanonicalOpening(), wrapped.value, raw.value];
    for (const invalid of invalidRefs) expect(() => owner.register("base", invalid, carrier.value)).toThrow("PROVENANCE");
    owner.register("base", ref, bytes);
    const store = owner.seal();
    for (const invalid of invalidRefs) expect(() => requireRegisteredBytes(store, "base", invalid)).toThrow("PROVENANCE");
    expect(property).not.toHaveBeenCalled();
    for (const value of [wrapped, raw, carrier]) expect(value.trap).not.toHaveBeenCalled();
  });

  it("rejects shared, growable, resizable, detached and non-Uint8 storage", () => {
    const owner = createRegisteredByteStore(), ref = refFor(new Uint8Array([1]));
    const shared = new SharedArrayBuffer(1), growable = Reflect.construct(SharedArrayBuffer, [1, { maxByteLength: 2 }]) as SharedArrayBuffer;
    const resizable = Reflect.construct(ArrayBuffer, [1, { maxByteLength: 2 }]) as ArrayBuffer;
    const detached = new Uint8Array([1]), detachedEmpty = new Uint8Array(0);
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    structuredClone(detachedEmpty.buffer, { transfer: [detachedEmpty.buffer] });
    const getter = vi.fn(() => { throw new Error("unsupported carrier getter"); });
    const fake = Object.defineProperties({}, { length: { get: getter }, buffer: { get: getter }, [Symbol.toStringTag]: { get: getter } });
    for (const carrier of [new Uint8Array(shared), new Uint8Array(growable), new Uint8Array(resizable), detached,
      new Uint8ClampedArray([1]), new Int8Array([1]), new Uint16Array([1]), new DataView(new ArrayBuffer(1)),
      new ArrayBuffer(1), [1], "1", null, undefined, fake]) {
      expect(() => owner.register("base", ref, carrier)).toThrow("CARRIER");
    }
    expect(() => owner.register("base", refFor(new Uint8Array(0)), detachedEmpty)).toThrow("CARRIER");
    expect(getter).not.toHaveBeenCalled();
  });

  it("checks every conservative role cap and actual extent before allocating a copy", async () => {
    const oversized = new Uint8Array(CAP + 1), small = new Uint8Array([42]), atCap = new Uint8Array(CAP);
    const oversizedRef = refFor(oversized), smallRef = refFor(small), capRef = refFor(atCap);
    const maximumRef = constructRef(Number.MAX_SAFE_INTEGER, smallRef.sha256);
    const NativeUint8Array = Uint8Array, allocations: number[] = [], views: number[] = [];
    vi.stubGlobal("Uint8Array", new Proxy(NativeUint8Array, {
      construct(target, args) {
        if (typeof args[0] === "number") allocations.push(args[0]);
        else views.push(args[2] as number);
        return Reflect.construct(target, args);
      },
    }));
    try {
      const modulePath = "../coordinator/registeredBytes?allocation-observer";
      const isolated: typeof import("../coordinator/registeredBytes") = await import(modulePath);
      const owner = isolated.createRegisteredByteStore();
      for (const role of roles) expect(() => owner.register(role, oversizedRef, oversized)).toThrow("LIMIT");
      expect(() => owner.register("base", smallRef, oversized)).toThrow("LIMIT");
      expect(() => owner.register("base", maximumRef, small)).toThrow("MISMATCH");
      expect(allocations).toEqual([]);
      expect(views).toEqual([]);
      owner.register("base", capRef, atCap);
      expect(allocations).toEqual([CAP]);
      expect(views).toEqual([CAP]);
      expect(isolated.requireRegisteredBytes(owner.seal(), "base", capRef).length).toBe(CAP);
      expect(requireRef(maximumRef).byteLength).toBe(Number.MAX_SAFE_INTEGER);
    } finally { vi.unstubAllGlobals(); }
  });

  it("hashes the same exclusive snapshot later consumed by the reader", async () => {
    const bytes = new Uint8Array([2, 3, 5, 7]), ref = refFor(bytes), update = Hash.prototype.update;
    let observed: Uint8Array | undefined;
    const watch = vi.spyOn(Hash.prototype, "update").mockImplementation(function (this: Hash, data: string | NodeJS.ArrayBufferView, ...args: unknown[]) {
      if (data instanceof Uint8Array) {
        observed = data;
        expect(data).not.toBe(bytes);
        expect(data.buffer).not.toBe(bytes.buffer);
        bytes.fill(0);
      }
      return Reflect.apply(update, this, [data, ...args]);
    });
    try {
      const modulePath = "../coordinator/registeredBytes?physical-hash-observer";
      const isolated: typeof import("../coordinator/registeredBytes") = await import(modulePath);
      const owner = isolated.createRegisteredByteStore();
      owner.register("economicArtifact", ref, bytes);
      const reader = isolated.requireRegisteredBytes(owner.seal(), "economicArtifact", ref);
      expect(observed).toBeDefined();
      expect(watch).toHaveBeenCalledTimes(1);
      const consumed = new Uint8Array(Array.from({ length: reader.length }, (_, index) => reader.readByte(index)));
      expect(Array.from(consumed)).toEqual([2, 3, 5, 7]);
      observed![1] = 101;
      expect(reader.readByte(1)).toBe(101);
      observed![1] = 3;
      watch.mockRestore();
      expect(digest(consumed)).toBe(ref.sha256);
      expect(Array.from(bytes)).toEqual([0, 0, 0, 0]);
    } finally { watch.mockRestore(); }
  });

  it("keeps roles independent and rejects duplicates, missing and unknown roles", () => {
    const bytes = new Uint8Array([1]), ref = refFor(bytes), owner = createRegisteredByteStore();
    const poisoned = hostile();
    for (const role of roles) owner.register(role, ref, bytes);
    for (const role of roles) expect(() => owner.register(role, poisoned.value, poisoned.value)).toThrow("DUPLICATE");
    const invalidRoles: unknown[] = ["", "constructor", "__proto__", "toString", "/artifacts/model", "https://example.org/model", "checkpoint", {}, poisoned.value, null];
    for (const role of invalidRoles) expect(() => owner.register(role as ByteRole, poisoned.value, poisoned.value)).toThrow("ROLE");
    const store = owner.seal();
    for (const role of invalidRoles) expect(() => requireRegisteredBytes(store, role as ByteRole, poisoned.value)).toThrow("ROLE");
    const partial = fixture("base");
    expect(() => requireRegisteredBytes(partial.store, "corrective", partial.ref)).toThrow("MISSING");
    expect(() => requireRegisteredBytes(createRegisteredByteStore().seal(), "base", ref)).toThrow("MISSING");
    expect(poisoned.trap).not.toHaveBeenCalled();
    const other = new Uint8Array([2]), independent = createRegisteredByteStore();
    independent.register("base", ref, bytes);
    independent.register("corrective", refFor(other), other);
    const joined = independent.seal();
    expect(requireRegisteredBytes(joined, "base", ref).readByte(0)).toBe(1);
    expect(requireRegisteredBytes(joined, "corrective", refFor(other)).readByte(0)).toBe(2);
    expect(() => requireRegisteredBytes(joined, "corrective", ref)).toThrow("MISMATCH");
  });

  it("rejects physical length or hash mismatch without registering a role", () => {
    const bytes = new Uint8Array([1, 2]), ref = refFor(bytes), owner = createRegisteredByteStore();
    for (const mismatch of [constructRef(0, ref.sha256), constructRef(3, ref.sha256), constructRef(2, "0".repeat(64))]) {
      expect(() => owner.register("base", mismatch, bytes)).toThrow("MISMATCH");
    }
    owner.register("base", ref, bytes);
    expect(requireRegisteredBytes(owner.seal(), "base", ref).readByte(1)).toBe(2);
  });

  it("rejects self-consistent substitution against the independent host expected ref", () => {
    const original = new Uint8Array([1, 2, 3]), substituted = new Uint8Array([3, 2, 1]);
    const expected = refFor(original), claimed = refFor(substituted), owner = createRegisteredByteStore();
    owner.register("economicArtifact", claimed, substituted);
    const store = owner.seal();
    expect(() => requireRegisteredBytes(store, "economicArtifact", expected)).toThrow("MISMATCH");
    expect(() => requireRegisteredBytes(store, "economicArtifact", constructRef(4, claimed.sha256))).toThrow("MISMATCH");
    expect(requireRegisteredBytes(store, "economicArtifact", refFor(substituted)).readByte(0)).toBe(3);
  });

  it("rejects foreign, cloned, proxy and unsealed stores without inspection", async () => {
    const { owner, store, ref } = fixture("base"), proxy = hostile(store), raw = hostile();
    const getter = vi.fn(() => { throw new Error("caller store"); });
    const fake = Object.defineProperty({}, "base", { get: getter });
    for (const candidate of [owner, createRegisteredByteStore(), null, undefined, {}, { ...store }, Object.freeze({}),
      structuredClone(store), fake, proxy.value, raw.value]) {
      expect(() => requireRegisteredBytes(candidate, "base", ref)).toThrow("PROVENANCE");
    }
    const modulePath = "../coordinator/registeredBytes?foreign-registry";
    const foreign: typeof import("../coordinator/registeredBytes") = await import(modulePath);
    const foreignOwner = foreign.createRegisteredByteStore(), bytes = new Uint8Array([1]);
    foreignOwner.register("base", refFor(bytes), bytes);
    const foreignStore = foreignOwner.seal();
    expect(() => requireRegisteredBytes(foreignStore, "base", refFor(bytes))).toThrow("PROVENANCE");
    expect(() => foreign.requireRegisteredBytes(store, "base", ref)).toThrow("PROVENANCE");
    expect(proxy.trap).not.toHaveBeenCalled();
    expect(raw.trap).not.toHaveBeenCalled();
    expect(getter).not.toHaveBeenCalled();
  });

  it("seals once and denies all owner or store post-seal tampering", () => {
    const { owner, store, ref } = fixture("base"), hostileRef = hostile();
    expect(Object.isFrozen(owner)).toBe(true);
    expect(Object.getPrototypeOf(owner)).toBeNull();
    expect(Object.keys(owner)).toEqual(["register", "seal"]);
    expect(Object.isFrozen(store)).toBe(true);
    expect(Object.getPrototypeOf(store)).toBeNull();
    expect(Reflect.ownKeys(store)).toEqual([]);
    expect(Reflect.set(owner, "register", () => undefined)).toBe(false);
    expect(Reflect.set(owner, "seal", () => ({}))).toBe(false);
    expect(Reflect.set(store, "base", {})).toBe(false);
    expect(Reflect.setPrototypeOf(store, {})).toBe(false);
    expect(() => owner.seal()).toThrow("LIFECYCLE");
    expect(() => owner.register("base", hostileRef.value, hostileRef.value)).toThrow("LIFECYCLE");
    expect(() => owner.register("corrective", ref, new Uint8Array([1]))).toThrow("LIFECYCLE");
    expect(hostileRef.trap).not.toHaveBeenCalled();
    expect(requireRegisteredBytes(store, "base", ref).readByte(1)).toBe(1);
  });

  it("accepts empty bytes and rejects negative-zero ref lengths and unsafe reader indices", () => {
    expect(() => constructRef(-0, digest(new Uint8Array(0)))).toThrow("REF");
    const empty = fixture("base", new Uint8Array(0));
    const emptyReader = requireRegisteredBytes(empty.store, "base", empty.ref);
    expect(emptyReader.length).toBe(0);
    expect(Object.is(emptyReader.length, -0)).toBe(false);
    expect(() => emptyReader.readByte(0)).toThrow("INDEX");
    const { store, ref } = fixture("base"), reader = requireRegisteredBytes(store, "base", ref), index = hostile();
    for (const invalid of [-0, -1, .5, 4, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, -Infinity, "0", null, undefined, index.value]) {
      expect(() => reader.readByte(invalid as number)).toThrow("INDEX");
    }
    expect(index.trap).not.toHaveBeenCalled();
    expect(reader.readByte(0)).toBe(0);
    expect(reader.readByte(3)).toBe(255);
  });

  it("uses captured intrinsics after module initialization", () => {
    const bytes = new Uint8Array([8, 13]), ref = refFor(bytes);
    let calls = 0;
    const failure = () => { calls++; throw new Error("replaced intrinsic"); };
    const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
    const targets: Array<[object, PropertyKey]> = [
      [WeakMap.prototype, "get"], [WeakMap.prototype, "set"], [Hash.prototype, "update"], [Hash.prototype, "digest"],
      [typedPrototype, "length"], [typedPrototype, "byteLength"], [typedPrototype, "buffer"], [typedPrototype, "byteOffset"],
      [typedPrototype, Symbol.toStringTag], [ArrayBuffer.prototype, "byteLength"], [ArrayBuffer.prototype, "resizable"],
      [ArrayBuffer.prototype, "detached"], [globalThis, "Uint8Array"],
    ];
    const descriptors = targets.map(([target, key]) => Object.getOwnPropertyDescriptor(target, key)!);
    let first: number | undefined, reported: unknown;
    try {
      for (let index = 0; index < targets.length; index++) {
        const [target, key] = targets[index]!, original = descriptors[index]!;
        const replacement = Object.assign(Object.create(null), original) as PropertyDescriptor;
        if ("value" in original) replacement.value = failure; else replacement.get = failure;
        Object.defineProperty(target, key, replacement);
      }
      const owner = createRegisteredByteStore();
      owner.register("base", ref, bytes);
      first = requireRegisteredBytes(owner.seal(), "base", ref).readByte(1);
    } catch (error) { reported = error; }
    finally {
      for (let index = targets.length - 1; index >= 0; index--) {
        const [target, key] = targets[index]!;
        Object.defineProperty(target, key, descriptors[index]!);
      }
    }
    expect(reported).toBeUndefined();
    expect(first).toBe(13);
    expect(calls).toBe(0);
  });

  it("defines bounded error names and complete data descriptors without inherited hooks", () => {
    const nameSetter = vi.fn(() => { throw new Error("inherited error name"); });
    const descriptor = Object.getOwnPropertyDescriptor(Error.prototype, "name");
    const inheritedGet = Object.getOwnPropertyDescriptor(Object.prototype, "get");
    const inheritedSet = Object.getOwnPropertyDescriptor(Object.prototype, "set");
    let owner: ReturnType<typeof createRegisteredByteStore> | undefined, reported: unknown;
    const safeDescriptor = (value: PropertyDescriptor): PropertyDescriptor => Object.assign(Object.create(null), value);
    Object.defineProperty(Error.prototype, "name", safeDescriptor({ configurable: true, get: () => "Error", set: nameSetter }));
    Object.defineProperty(Object.prototype, "get", safeDescriptor({ configurable: true, value: () => { throw new Error("inherited descriptor get"); } }));
    Object.defineProperty(Object.prototype, "set", safeDescriptor({ configurable: true, value: () => { throw new Error("inherited descriptor set"); } }));
    try {
      owner = createRegisteredByteStore();
      owner.seal();
      owner.seal();
    } catch (error) { reported = error; }
    finally {
      if (inheritedGet) Object.defineProperty(Object.prototype, "get", safeDescriptor(inheritedGet)); else delete (Object.prototype as { get?: unknown }).get;
      if (inheritedSet) Object.defineProperty(Object.prototype, "set", safeDescriptor(inheritedSet)); else delete (Object.prototype as { set?: unknown }).set;
      if (descriptor) Object.defineProperty(Error.prototype, "name", safeDescriptor(descriptor)); else delete (Error.prototype as { name?: string }).name;
    }
    expect(owner).toBeDefined();
    expect((reported as Error).message).toBe("LIFECYCLE");
    expect(Object.getOwnPropertyDescriptor(reported, "name")?.value).toBe("RegisteredBytesError");
    expect(nameSetter).not.toHaveBeenCalled();
  });

  it("keeps its startup surface private and imports no loaders, configuration or planning", async () => {
    const module = await import("../coordinator/registeredBytes");
    expect(Object.keys(module).sort()).toEqual(["createRegisteredByteStore", "requireRegisteredBytes"]);
    const source = readFileSync(new URL("../coordinator/registeredBytes.ts", import.meta.url), "utf8");
    expect(source.split("\n")[0]).toBe("// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml");
    expect([...source.matchAll(/from "([^"]+)"/g)].map(match => match[1]).sort()).toEqual(["../economic/ownedKernel", "node:crypto"]);
    expect(source).not.toMatch(/JSON\.(?:parse|stringify)|\.set\(source|\.slice\(|\.subarray\(|\.constructor|Symbol\.(?:iterator|species)/);
    expect(JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).exports).toEqual({ "./candidates": "./src/candidates.ts" });
  });
});
