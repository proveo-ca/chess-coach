// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { createHash, Hash } from "node:crypto";
import { requireRef } from "../economic/ownedKernel";

export type ByteRole = "contracts" | "r2Generator" | "base" | "corrective" | "r3Seam" | "r3NativeCorrection" | "ownedIngress"
  | "economicArtifact" | "estimatorProvenance" | "featureManifest" | "economicPin" | "economicBinding" | "trainingRecipe"
  | "policyArtifact" | "episodeWeights" | "fittingCode" | "collectionRecipe" | "fittingRecipe" | "collectionRoster"
  | "splitRoster" | "labelBytes" | "fitJournal" | "calibrationJournal" | "coreRules"
  | "source" | "tests" | "sourceInventory" | "sourcePolicy" | "dependencyLock" | "installedTree" | "frozenStore" | "toolTree"
  | "image" | "runtimeConfiguration" | "corpusManifest" | "corpusSource" | "strategicSource" | "hostConfiguration" | "recipe"
  | "fixtureManifest" | "episodeJournal" | "privateProvenanceCodec" | "sourceInventoryAuditorCode" | "publicClosureAuditorCode";
declare const registeredStoreBrand: unique symbol;
export type RegisteredByteStore = Readonly<{ [registeredStoreBrand]: "host-registered-bytes" }>;
export type RegisteredByteReader = Readonly<{ length: number; readByte: (index: number) => number }>;
export type RegisteredByteStoreOwner = Readonly<{
  register: (role: ByteRole, ref: unknown, carrier: unknown) => void;
  seal: () => RegisteredByteStore;
}>;

type Code = "PROVENANCE" | "ROLE" | "DUPLICATE" | "LIFECYCLE" | "CARRIER" | "LIMIT" | "MISMATCH" | "MISSING" | "INDEX";
class RegisteredBytesError extends Error {
  override readonly name = "RegisteredBytesError";
  constructor(readonly code: Code) { super(code); }
}
const reject = (code: Code): never => { throw new RegisteredBytesError(code); };
type Entry = Readonly<{ length: number; sha256: string; bytes: Uint8Array }>;
type Entries = Partial<Record<ByteRole, Entry>>;
const stores = new WeakMap<object, Readonly<Entries>>();
const lookupStore = WeakMap.prototype.get.bind(stores);
const publishStore = WeakMap.prototype.set.bind(stores);
const create = Object.create;
const freeze = Object.freeze;
const define = Object.defineProperty;
const descriptor = Object.getOwnPropertyDescriptor;
const apply = Reflect.apply;
const integer = Number.isSafeInteger;
const sameValue = Object.is;
const FixedUint8Array = Uint8Array;
const typedPrototype = Object.getPrototypeOf(FixedUint8Array.prototype) as object;
const typedTag = descriptor(typedPrototype, Symbol.toStringTag)!.get!;
const typedBuffer = descriptor(typedPrototype, "buffer")!.get!;
const typedOffset = descriptor(typedPrototype, "byteOffset")!.get!;
const typedLength = descriptor(typedPrototype, "length")!.get!;
const typedByteLength = descriptor(typedPrototype, "byteLength")!.get!;
const bufferLength = descriptor(ArrayBuffer.prototype, "byteLength")!.get!;
const bufferResizable = descriptor(ArrayBuffer.prototype, "resizable")?.get;
const bufferDetached = descriptor(ArrayBuffer.prototype, "detached")?.get;
const nativeCreateHash = createHash;
const hashUpdate = Hash.prototype.update;
const hashDigest = Hash.prototype.digest;
const roleByteCap = 1048576;

const requireRole = (role: unknown): ByteRole => {
  switch (role) {
    case "contracts": case "r2Generator": case "base": case "corrective": case "r3Seam": case "r3NativeCorrection": case "ownedIngress":
    case "economicArtifact": case "estimatorProvenance": case "featureManifest": case "economicPin": case "economicBinding":
    case "trainingRecipe": case "policyArtifact": case "episodeWeights": case "fittingCode": case "collectionRecipe": case "fittingRecipe":
    case "collectionRoster": case "splitRoster": case "labelBytes": case "fitJournal": case "calibrationJournal": case "coreRules":
    case "source": case "tests": case "sourceInventory": case "sourcePolicy": case "dependencyLock": case "installedTree":
    case "frozenStore": case "toolTree": case "image": case "runtimeConfiguration": case "corpusManifest": case "corpusSource":
    case "strategicSource": case "hostConfiguration": case "recipe": case "fixtureManifest": case "episodeJournal": case "privateProvenanceCodec":
    case "sourceInventoryAuditorCode": case "publicClosureAuditorCode":
      return role;
    default: return reject("ROLE");
  }
};

const ownField = (target: object, key: string, value: unknown): void => {
  const field = create(null) as PropertyDescriptor;
  field.value = value;
  field.writable = false;
  field.enumerable = true;
  field.configurable = false;
  define(target, key, field);
};

const carrierExtent = (carrier: unknown): Readonly<{ buffer: ArrayBuffer; offset: number; length: number }> => {
  try {
    if (apply(typedTag, carrier, []) !== "Uint8Array") return reject("CARRIER");
    const buffer = apply(typedBuffer, carrier, []) as ArrayBuffer;
    const capacity = apply(bufferLength, buffer, []) as number;
    if (!bufferResizable || apply(bufferResizable, buffer, []) !== false ||
        bufferDetached && apply(bufferDetached, buffer, []) !== false) return reject("CARRIER");
    const offset = apply(typedOffset, carrier, []) as number;
    const length = apply(typedLength, carrier, []) as number;
    if (length !== apply(typedByteLength, carrier, []) || !integer(length) || !integer(offset) ||
        length < 0 || offset < 0 || sameValue(length, -0) || sameValue(offset, -0) ||
        offset > capacity || length > capacity - offset) return reject("CARRIER");
    return { buffer, offset, length };
  } catch { return reject("CARRIER"); }
};

export const createRegisteredByteStore = (): RegisteredByteStoreOwner => {
  const entries = create(null) as Entries;
  let sealed = false;
  const register = (role: ByteRole, ref: unknown, carrier: unknown): void => {
    if (sealed) return reject("LIFECYCLE");
    const key = requireRole(role);
    if (entries[key] !== undefined) return reject("DUPLICATE");
    const claim = requireRef(ref);
    const { buffer, offset, length } = carrierExtent(carrier);
    if (length > roleByteCap) return reject("LIMIT");
    if (length !== claim.byteLength) return reject("MISMATCH");
    let source: Uint8Array;
    try { source = new FixedUint8Array(buffer, offset, length); }
    catch { return reject("CARRIER"); }
    const bytes = new FixedUint8Array(length);
    for (let index = 0; index < length; index++) bytes[index] = source[index]!;
    const hash = nativeCreateHash("sha256");
    apply(hashUpdate, hash, [bytes]);
    const sha256 = apply(hashDigest, hash, ["hex"]) as string;
    if (sha256 !== claim.sha256) return reject("MISMATCH");
    entries[key] = freeze({ length, sha256, bytes });
  };
  const seal = (): RegisteredByteStore => {
    if (sealed) return reject("LIFECYCLE");
    sealed = true;
    freeze(entries);
    const store = freeze(create(null)) as RegisteredByteStore;
    publishStore(store, entries);
    return store;
  };
  const owner = create(null) as RegisteredByteStoreOwner;
  ownField(owner, "register", freeze(register));
  ownField(owner, "seal", freeze(seal));
  return freeze(owner);
};

export const requireRegisteredBytes = (store: unknown, role: ByteRole, expectedRef: unknown): RegisteredByteReader => {
  if (store === null || typeof store !== "object") return reject("PROVENANCE");
  const entries = lookupStore(store);
  if (!entries) return reject("PROVENANCE");
  const key = requireRole(role);
  const expected = requireRef(expectedRef);
  const entry = entries[key];
  if (!entry) return reject("MISSING");
  if (entry.length !== expected.byteLength || entry.sha256 !== expected.sha256) return reject("MISMATCH");
  const { length, bytes } = entry;
  const readByte = (index: number): number => {
    if (typeof index !== "number" || !integer(index) || index < 0 || index >= length || sameValue(index, -0)) return reject("INDEX");
    return bytes[index]!;
  };
  const reader = create(null) as RegisteredByteReader;
  ownField(reader, "length", length);
  ownField(reader, "readByte", freeze(readByte));
  return freeze(reader);
};
