// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it, vi } from "vitest";
import {
  readSnapshotByte, requireSnapshot, snapshotFixedBytes, snapshotLength, snapshotProduction,
  type ByteProduction,
} from "../economic/ownedBytes";
import { OwnedIngressError } from "../economic/ownedErrors";
import {
  BYTE_PRODUCTION_LIMITS, constructCanonicalOpening, constructFloat64Hex, constructRef,
  OPENING_CANONICAL_BYTES_TEXT, requireFloat64Hex, requireOpening, requireRef,
} from "../economic/ownedKernel";
import {
  decodeOwnedFloat64Hex, decodeOwnedOpening, decodeOwnedRef,
  encodeOwnedFloat64Hex, encodeOwnedOpening, encodeOwnedRef,
} from "../economic/ownedSchema";

const hash = "0123456789abcdef".repeat(4);
const openingFixture = {
  bank: { b: 3, w: 3 },
  cc: { b: "e8", w: "e1" },
  marines: { b: ["c7", "d7", "e7", "f7"], w: ["c2", "d2", "e2", "f2"] },
  turn: 0,
  version: "starchess-economic-opening-v1",
};
const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const snapshotText = (text: string, production: ByteProduction) => snapshotFixedBytes(utf8(text), production);
const rejected = (run: () => unknown, code?: OwnedIngressError["code"]): void => {
  let error: unknown;
  try { run(); } catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(OwnedIngressError);
  if (code !== undefined) expect((error as OwnedIngressError).code).toBe(code);
};

const codecs = [
  { production: "float64" as const, owned: () => constructFloat64Hex("3ff0000000000000"),
    encode: encodeOwnedFloat64Hex, decode: decodeOwnedFloat64Hex, require: requireFloat64Hex },
  { production: "ref" as const, owned: () => constructRef(1048576, hash),
    encode: encodeOwnedRef, decode: decodeOwnedRef, require: requireRef },
  { production: "opening" as const, owned: constructCanonicalOpening,
    encode: encodeOwnedOpening, decode: decodeOwnedOpening, require: requireOpening },
];

describe("private direct canonical ASCII productions", () => {
  it("matches an independently ordered opening fixture and exact physical limits", () => {
    const canonical = JSON.stringify(openingFixture);
    expect(OPENING_CANONICAL_BYTES_TEXT).toBe(canonical);
    expect(BYTE_PRODUCTION_LIMITS).toEqual({
      float64: 26, ref: 107, opening: utf8(canonical).byteLength,
      economicArtifact: 1048576, featureManifest: 1048576, pin: 1048576, binding: 1048576,
      estimatorProvenance: 1048576, authority: 1048576, trainingRecipe: 1048576,
      boundaryBatch: 1048576, history: 1048576, candidate: 1048576, completion: 16777216,
    } satisfies Record<ByteProduction, number>);
    expect(encodeOwnedOpening(constructCanonicalOpening())).toEqual(utf8(canonical));
    const decoded = decodeOwnedOpening(snapshotText(canonical, "opening"));
    expect(decoded).toEqual(openingFixture);
    expect(requireOpening(decoded)).toBe(decoded);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.bank)).toBe(true);
    expect(Object.isFrozen(decoded.cc)).toBe(true);
    expect(Object.isFrozen(decoded.marines)).toBe(true);
    expect(Object.isFrozen(decoded.marines.w)).toBe(true);
    expect(Object.isFrozen(decoded.marines.b)).toBe(true);
  });

  it.each([
    "0000000000000000", "8000000000000000", "0000000000000001", "8000000000000001",
    "3ff0000000000000", "bff0000000000000", "7fefffffffffffff", "ffefffffffffffff",
  ])("preserves finite Float64Hex bits %s and independent physical bytes", hex => {
    const expected = utf8(JSON.stringify({ hex }));
    const owned = constructFloat64Hex(hex);
    expect(encodeOwnedFloat64Hex(owned)).toEqual(expected);
    const decoded = decodeOwnedFloat64Hex(snapshotFixedBytes(expected, "float64"));
    expect(decoded).toEqual({ hex });
    expect(requireFloat64Hex(decoded)).toBe(decoded);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(encodeOwnedFloat64Hex(decoded)).toEqual(expected);
  });

  it.each([0, 1, 9, 10, 99, 100, 999999, 1000000, 1048576, 1048577, 16777216, Number.MAX_SAFE_INTEGER])("emits canonical Ref integer %i", byteLength => {
    const expected = utf8(JSON.stringify({ byteLength, sha256: hash }));
    const owned = constructRef(byteLength, hash);
    expect(encodeOwnedRef(owned)).toEqual(expected);
    const decoded = decodeOwnedRef(snapshotFixedBytes(expected, "ref"));
    expect(decoded).toEqual({ byteLength, sha256: hash });
    expect(requireRef(decoded)).toBe(decoded);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(encodeOwnedRef(decoded)).toEqual(expected);
  });

  it.each(["7ff0000000000000", "fff0000000000000", "7ff8000000000000", "fff8000000000001"])(
    "rejects nonfinite Float64Hex %s through the constructor", hex => {
      rejected(() => decodeOwnedFloat64Hex(snapshotText(JSON.stringify({ hex }), "float64")), "FLOAT64");
    },
  );

  it.each([
    "", "{}", '{"hex":""}', '{"hex":"000000000000000"}', '{"hex":"00000000000000000"}',
    '{"hex":"3FF0000000000000"}', '{"hex":"000000000000000g"}', '{"hex":0}',
    '{"heX":"0000000000000000"}', '{"hex":"0000000000000000","x":0}',
    '{"hex":"0000000000000000","hex":"0000000000000000"}',
    '{ "hex":"0000000000000000"}', '{"hex": "0000000000000000"}',
    '{"hex":"0000000000000000"}\n', '\ufeff{"hex":"0000000000000000"}',
    '{"hex":"\\u0030' + "0".repeat(15) + '"}', '{"hex":"é000000000000000"}',
    "[]", "null", '{"hex":"0000000000000000",}',
  ])("rejects every noncanonical float production %j", text => {
    rejected(() => decodeOwnedFloat64Hex(snapshotText(text, "float64")));
  });

  it.each([
    "-0", "-1", "00", "01", "+1", "1.0", "1e0", "1E0", " 1", "1 ",
    "9007199254740992", "9007199254740993", "9999999999999999", "10000000000000000", "null", "true", '"1"',
  ])("rejects noncanonical or out-of-domain Ref integer %s", integer => {
    rejected(() => decodeOwnedRef(snapshotText(`{"byteLength":${integer},"sha256":"${hash}"}`, "ref")));
  });

  it.each([
    "{}", "[]", "null", JSON.stringify({ sha256: hash, byteLength: 0 }),
    JSON.stringify({ byteLength: 0 }), JSON.stringify({ sha256: hash }),
    JSON.stringify({ byteLength: 0, sha256: hash, extra: 1 }),
    `{"byteLength":0,"byteLength":0,"sha256":"${hash}"}`,
    `{"byteLength":0,"sha256":"${hash}","sha256":"${hash}"}`,
    `{"byteLength":0,"sha256":"${hash.slice(1)}"}`,
    `{"byteLength":0,"sha256":"${hash}0"}`,
    `{"byteLength":0,"sha256":"${hash.toUpperCase()}"}`,
    `{"byteLength":0,"sha256":"g${hash.slice(1)}"}`,
    `{"byteLength":0,"sha256":"é${hash.slice(1)}"}`,
    `{"byteLength":0, "sha256":"${hash}"}`,
    `{"byteLength":0,"sha256":"${hash}"}\n`,
    `\ufeff{"byteLength":0,"sha256":"${hash}"}`,
  ])("rejects unknown, duplicate, missing, reordered or malformed Ref fields %j", text => {
    rejected(() => decodeOwnedRef(snapshotText(text, "ref")));
  });

  it("accepts only the exact opening literal, including every byte position", () => {
    const canonical = utf8(JSON.stringify(openingFixture));
    for (let index = 0; index < canonical.length; index++) {
      const changed = canonical.slice();
      changed[index] = changed[index] === 120 ? 121 : 120;
      rejected(() => decodeOwnedOpening(snapshotFixedBytes(changed, "opening")), "CANONICAL");
    }
    for (const text of [
      JSON.stringify({ ...openingFixture, turn: -0 }).replace('"turn":0', '"turn":-0'),
      JSON.stringify({ ...openingFixture, turn: 1 }),
      JSON.stringify({ ...openingFixture, bank: { b: 3, w: 4 } }),
      JSON.stringify({ ...openingFixture, cc: { b: "e8", w: "d1" } }),
      JSON.stringify({ ...openingFixture, marines: { b: ["c7", "d7", "e7", "f7"], w: ["d2", "c2", "e2", "f2"] } }),
      JSON.stringify({ version: openingFixture.version, turn: 0, bank: openingFixture.bank, cc: openingFixture.cc, marines: openingFixture.marines }),
      JSON.stringify({ ...openingFixture, extra: 0 }), "{}", "null",
      ` ${JSON.stringify(openingFixture)}`, `${JSON.stringify(openingFixture)}\n`,
      `\ufeff${JSON.stringify(openingFixture)}`,
      JSON.stringify(openingFixture).replace('"turn":0', '"turn":0,"turn":0'),
      JSON.stringify(openingFixture).replace(',"turn":0', ""),
    ]) rejected(() => decodeOwnedOpening(snapshotText(text, "opening")));
  });

  it.each(codecs)("rejects non-ASCII and malformed UTF-8 bytes for $production", codec => {
    for (const bad of [0, 128, 192, 193, 194, 239, 255]) {
      const bytes = codec.encode(codec.owned());
      bytes[Math.floor(bytes.length / 2)] = bad;
      rejected(() => codec.decode(snapshotFixedBytes(bytes, codec.production)), "CANONICAL");
    }
  });
});

describe("owned codec identity and stable bytes", () => {
  it.each(codecs)("rejects trapped raw objects without inspection for $production", codec => {
    const callback = vi.fn(() => { throw new Error("caller callback"); });
    const raw = Object.create(null);
    for (const key of ["hex", "byteLength", "sha256", "version", "bank", "cc", "marines", "turn", "toJSON"]) {
      Object.defineProperty(raw, key, { get: callback, enumerable: true });
    }
    for (let index = 0; index < 512; index++) Object.defineProperty(raw, `hidden${index}`, { get: callback });
    Object.defineProperty(raw, Symbol("hidden"), { get: callback });
    const proxy = new Proxy(raw, { get: callback, ownKeys: callback, getPrototypeOf: callback, getOwnPropertyDescriptor: callback });
    for (const value of [raw, proxy, undefined, null, 0, "raw", Symbol("raw"), () => 0]) {
      rejected(() => codec.encode(value), "PROVENANCE");
      rejected(() => codec.decode(value), "PROVENANCE");
    }
    expect(callback).not.toHaveBeenCalled();
  });

  it.each(codecs)("rejects clones, proxies and wrong-role identities for $production", codec => {
    const value = codec.owned();
    rejected(() => codec.encode(structuredClone(value)), "PROVENANCE");
    rejected(() => codec.encode({ ...value }), "PROVENANCE");
    const callback = vi.fn(() => { throw new Error("caller callback"); });
    rejected(() => codec.encode(new Proxy(value, { get: callback, ownKeys: callback, getPrototypeOf: callback })), "PROVENANCE");
    expect(callback).not.toHaveBeenCalled();
    const snapshot = snapshotFixedBytes(codec.encode(value), codec.production);
    rejected(() => codec.encode(snapshot), "PROVENANCE");
    rejected(() => codec.decode(value), "PROVENANCE");
    rejected(() => codec.decode(structuredClone(snapshot)), "PROVENANCE");
    rejected(() => codec.decode({ ...snapshot }), "PROVENANCE");
    for (const other of codecs) {
      if (other.production === codec.production) continue;
      rejected(() => codec.encode(other.owned()), "PROVENANCE");
      rejected(() => other.decode(snapshot), "PROVENANCE");
    }
  });

  it.each(codecs)("copies offset carriers and emits fresh independent bytes for $production", codec => {
    const value = codec.owned();
    const expected = codec.encode(value);
    const backing = new Uint8Array(expected.length + 4);
    backing.set(expected, 2);
    const carrier = backing.subarray(2, expected.length + 2);
    const snapshot = snapshotFixedBytes(carrier, codec.production);
    backing.fill(0);
    expect(snapshotProduction(snapshot)).toBe(codec.production);
    expect(requireSnapshot(snapshot, codec.production)).toBe(snapshot);
    expect(snapshotLength(snapshot)).toBe(expected.length);
    for (let index = 0; index < expected.length; index++) expect(readSnapshotByte(snapshot, index)).toBe(expected[index]);
    expect(codec.encode(codec.decode(snapshot))).toEqual(expected);
    const first = codec.encode(value);
    const second = codec.encode(value);
    expect(first).not.toBe(second);
    expect(first.buffer).not.toBe(second.buffer);
    first.fill(0);
    expect(second).toEqual(expected);
    expect(codec.encode(value)).toEqual(expected);
    const detachedCopy = codec.encode(codec.decode(snapshot));
    structuredClone(detachedCopy.buffer, { transfer: [detachedCopy.buffer] });
    expect(codec.encode(codec.decode(snapshot))).toEqual(expected);
  });

  it("rejects invalid indexes and unowned snapshots before inspecting caller properties", () => {
    const snapshot = snapshotText('{"hex":"0000000000000000"}', "float64");
    for (const index of [-1, -0, 0.5, 26, Infinity, NaN]) rejected(() => readSnapshotByte(snapshot, index), "INDEX");
    const callback = vi.fn(() => { throw new Error("caller callback"); });
    const proxy = new Proxy(snapshot, { get: callback, ownKeys: callback, getPrototypeOf: callback });
    rejected(() => snapshotLength(proxy), "PROVENANCE");
    rejected(() => snapshotProduction(proxy), "PROVENANCE");
    rejected(() => readSnapshotByte(proxy, 0), "PROVENANCE");
    rejected(() => requireSnapshot(proxy, "float64"), "PROVENANCE");
    expect(callback).not.toHaveBeenCalled();
  });

  it("rejects observed separate module-registry identities without claiming cross-realm coverage", async () => {
    const local = constructRef(0, hash);
    const localSnapshot = snapshotText(JSON.stringify({ byteLength: 0, sha256: hash }), "ref");
    vi.resetModules();
    const separate = await import("../economic/ownedKernel");
    expect(separate.constructRef).not.toBe(constructRef);
    const remote = separate.constructRef(0, hash);
    const remoteSnapshot = separate.snapshotFixedBytes(utf8(JSON.stringify({ byteLength: 0, sha256: hash })), "ref");
    rejected(() => encodeOwnedRef(remote), "PROVENANCE");
    rejected(() => decodeOwnedRef(remoteSnapshot), "PROVENANCE");
    expect(() => separate.requireRef(local)).toThrow();
    expect(() => separate.requireSnapshot(localSnapshot, "ref")).toThrow();
  });

  it("uses captured scalar operations for closed decoding and encoding", () => {
    const ref = constructRef(1048576, hash);
    const expected = encodeOwnedRef(ref), snapshot = snapshotFixedBytes(expected, "ref");
    const callback = () => { throw new Error("uncaptured scalar operation"); };
    const char = vi.spyOn(String.prototype, "charCodeAt").mockImplementation(callback);
    const from = vi.spyOn(String, "fromCharCode").mockImplementation(callback);
    const join = vi.spyOn(Array.prototype, "join").mockImplementation(callback);
    const integer = vi.spyOn(Number.prototype, "toString").mockImplementation(callback);
    let decoded: ReturnType<typeof decodeOwnedRef> | undefined, emitted: Uint8Array | undefined;
    try { decoded = decodeOwnedRef(snapshot); emitted = encodeOwnedRef(ref); }
    finally { integer.mockRestore(); join.mockRestore(); from.mockRestore(); char.mockRestore(); }
    expect(decoded).toEqual(ref);
    expect(emitted).toEqual(expected);
  });
});

describe("fixed physical carrier boundary", () => {
  it.each(codecs)("checks the physical $production size limit", codec => {
    rejected(() => snapshotFixedBytes(new Uint8Array(BYTE_PRODUCTION_LIMITS[codec.production] + 1), codec.production), "BYTES");
  });

  it("ignores carrier expandos, hidden symbols and callbacks without invoking them", () => {
    const callback = vi.fn(() => { throw new Error("caller callback"); });
    const expected = utf8('{"hex":"0000000000000000"}');
    for (const key of ["byteLength", "buffer", "length", "slice", "constructor", "extra", Symbol.iterator, Symbol("hidden")]) {
      const carrier = utf8('{"hex":"0000000000000000"}');
      Object.defineProperty(carrier, key, { get: callback });
      const snapshot = snapshotFixedBytes(carrier, "float64");
      expect(encodeOwnedFloat64Hex(decodeOwnedFloat64Hex(snapshot))).toEqual(expected);
    }
    const wide = utf8('{"hex":"0000000000000000"}');
    for (let index = 0; index < 512; index++) Object.defineProperty(wide, `hidden${index}`, { get: callback });
    const snapshot = snapshotFixedBytes(wide, "float64");
    expect(encodeOwnedFloat64Hex(decodeOwnedFloat64Hex(snapshot))).toEqual(expected);
    expect(callback).not.toHaveBeenCalled();
  });

  it("rejects proxy and non-Uint8 carriers without property inspection", () => {
    const callback = vi.fn(() => { throw new Error("caller callback"); });
    const proxy = new Proxy(utf8('{"hex":"0000000000000000"}'), {
      get: callback, ownKeys: callback, getPrototypeOf: callback, getOwnPropertyDescriptor: callback,
    });
    for (const carrier of [proxy, [], {}, "bytes", null, undefined, new ArrayBuffer(26), new DataView(new ArrayBuffer(26)), new Uint16Array(13), new Int8Array(26)]) {
      rejected(() => snapshotFixedBytes(carrier, "float64"), "CARRIER");
    }
    expect(callback).not.toHaveBeenCalled();
  });

  it("rejects shared and detached backing storage", () => {
    rejected(() => snapshotFixedBytes(new Uint8Array(new SharedArrayBuffer(26)), "float64"), "CARRIER");
    const carrier = utf8('{"hex":"0000000000000000"}');
    structuredClone(carrier.buffer, { transfer: [carrier.buffer] });
    rejected(() => snapshotFixedBytes(carrier, "float64"), "CARRIER");
  });

  it.runIf(typeof (ArrayBuffer.prototype as ArrayBuffer & { resize?: unknown }).resize === "function")(
    "rejects resizable backing storage", () => {
      const ResizableBuffer = ArrayBuffer as unknown as new (length: number, options: { maxByteLength: number }) => ArrayBuffer;
      rejected(() => snapshotFixedBytes(new Uint8Array(new ResizableBuffer(26, { maxByteLength: 52 })), "float64"), "CARRIER");
    },
  );
});
