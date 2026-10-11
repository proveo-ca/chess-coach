// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { rejectOwned } from "./ownedErrors";
import jsSHA from "jssha/sha256";
import { BAND_STARTS, QUEUE_NAMES, POSITION_NAMES, ECONOMIC_NAMES, PROMOTION_KERNELS, PROMOTION_CHANNELS } from "./contracts";
import type {
  Meter, History, CheckedBoundary, Candidate, AuthorizedSnapshotV2, Cells, Memory, Side, Square,
  Component, EconomicRecipe, EconomicArtifact, EconomicBeliefState, EconomicReadout,
  TransitionRow, EvidenceRow, Table, Bin, Queue34, Position84, Economic12, Promotion36,
  FeatureBlocksV3, FeatureManifestV3, ManifestEntry, ScaleId, Scales, EconomicPin, EconomicBinding,
  EstimatorProvenance, EconomicAuthority, TrainingRecipeV2, Configuration418, Versions418, HostLimits,
} from "./contracts";
import { UNIT_COST, specialGasCost, type ScActionInput } from "@chess-coach/starchess-core/planning-v1";
import {
  fail, quoteBlock, PLANNING_WORK_CAP, PLANNING_INITIAL_UNITS, PLANNING_GATE_UNITS, PLANNING_ENTRY_UNITS,
  type ClosedBlockId, type ValidatedExtent,
} from "./invoices";

export type OwnedFloat64Hex = Readonly<{ hex: string }>;
export type OwnedByteRef = Readonly<{ byteLength: number; sha256: string }>;
export type OwnedPublicOpening = Readonly<{
  version: "starchess-economic-opening-v1";
  turn: 0;
  bank: Readonly<{ w: 3; b: 3 }>;
  cc: Readonly<{ w: "e1"; b: "e8" }>;
  marines: Readonly<{ w: readonly ["c2", "d2", "e2", "f2"]; b: readonly ["c7", "d7", "e7", "f7"] }>;
}>;
export type ByteProduction = "float64" | "ref" | "opening" | "economicArtifact" | "featureManifest" |
  "pin" | "binding" | "estimatorProvenance" | "authority" | "trainingRecipe" | "boundaryBatch" | "history" | "candidate" | "completion";
declare const snapshotBrand: unique symbol;
export type OwnedByteSnapshot = Readonly<{ [snapshotBrand]: "owned-fixed-bytes" }>;

type Role = "float64" | "ref" | "opening" | "bank" | "cc" | "white-marines" | "black-marines" | "marines" | "snapshot" | "meter" |
  "startup" | "piece" | "cell" | "sighting" | "cells" | "changes" | "memory" | "squares" | "own-piece" | "own-pieces" |
  "own-unit" | "own-units" | "own-mine" | "own-mines" | "action-ref" | "disposition" | "receipt" | "receipts" |
  "retired-units" | "retired-mines" | "enemy-loss" | "ledger" | "own" | "snapshot-v2" | "mine-audit" | "history" |
  "event" | "events" | "batch" | "verified-batch" | "boundary" | "action" | "actions" | "spend" | "candidate" |
  "conditional" | "component" | "components" | "support" | "recipe" | "band-starts" | "horizons" |
  "transition-row" | "evidence-row" | "transition-rows" | "evidence-rows" | "table" | "tables" | "bin" | "partition" |
  "temperatures" | "artifact" | "state" | "quantiles" | "readout" | "queue" | "position" | "economic" | "promotion" |
  "positions" | "features" | "manifest-entry" | "manifest-entries" | "manifest-names" | "scales" | "manifest" |
  "pin" | "binding" | "provenance" | "authority" | "profiles" | "masters" | "limits" | "eps" | "validation" |
  "configuration" | "versions" | "training-recipe" | "reduction-input";
type SnapshotStorage = Readonly<{ production: ByteProduction; length: number; bytes: Uint8Array }>;
const receipts = new WeakMap<object, Role>();
const byteStorage = new WeakMap<object, SnapshotStorage>();
const lookup = WeakMap.prototype.get.bind(receipts);
const register = WeakMap.prototype.set.bind(receipts);
const lookupBytes = WeakMap.prototype.get.bind(byteStorage);
const registerBytes = WeakMap.prototype.set.bind(byteStorage);
const wireLengths = new WeakMap<object, number>();
const getWireLength = WeakMap.prototype.get.bind(wireLengths);
const setWireLength = WeakMap.prototype.set.bind(wireLengths);
const freeze = Object.freeze;
const isSafeInteger = Number.isSafeInteger;
const maximumSafeInteger = Number.MAX_SAFE_INTEGER;
const sameValue = Object.is;
const apply = Reflect.apply;
const characterCode = String.prototype.charCodeAt;
const fromCharacterCode = String.fromCharCode;
const FixedUint8Array = Uint8Array;
const arrayBufferPrototype = ArrayBuffer.prototype;
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const descriptor = Object.getOwnPropertyDescriptor;
const hasOwnField = Object.hasOwn;
const typedTag = descriptor(typedArrayPrototype, Symbol.toStringTag)!.get!;
const typedBuffer = descriptor(typedArrayPrototype, "buffer")!.get!;
const typedOffset = descriptor(typedArrayPrototype, "byteOffset")!.get!;
const typedLength = descriptor(typedArrayPrototype, "byteLength")!.get!;
const bufferLength = descriptor(arrayBufferPrototype, "byteLength")!.get!;
const bufferResizable = descriptor(arrayBufferPrototype, "resizable")?.get;

export const OPENING_CANONICAL_BYTES_TEXT = '{"bank":{"b":3,"w":3},"cc":{"b":"e8","w":"e1"},"marines":{"b":["c7","d7","e7","f7"],"w":["c2","d2","e2","f2"]},"turn":0,"version":"starchess-economic-opening-v1"}';
export const BYTE_PRODUCTION_LIMITS = freeze({ float64: 26, ref: 107, opening: OPENING_CANONICAL_BYTES_TEXT.length,
  economicArtifact: 1048576, featureManifest: 1048576, pin: 1048576, binding: 1048576, estimatorProvenance: 1048576,
  authority: 1048576, trainingRecipe: 1048576, boundaryBatch: 1048576, history: 1048576, candidate: 1048576, completion: 16777216 });

const publish = <T extends object>(value: T, role: Role): Readonly<T> => {
  freeze(value);
  register(value, role);
  const length = constructedWireLength(value, role);
  if (length !== undefined) setWireLength(value, length);
  return value;
};

const requireRole = <T>(value: unknown, role: Role): T => {
  if (value === null || typeof value !== "object" || lookup(value) !== role) {
    if (paying) latch(paying);
    return rejectOwned("PROVENANCE");
  }
  return value as T;
};

const lowerHex = (value: unknown, length: number, code: "FLOAT64" | "REF"): string => {
  if (typeof value !== "string" || value.length !== length) return rejectOwned(code);
  for (let i = 0; i < length; i++) {
    const digit = apply(characterCode, value, [i]) as number;
    if (!(digit >= 48 && digit <= 57 || digit >= 97 && digit <= 102)) return rejectOwned(code);
  }
  return value;
};

export const constructFloat64Hex = (hex: string): OwnedFloat64Hex => {
  const valid = lowerHex(hex, 16, "FLOAT64");
  if ((valid[0] === "7" || valid[0] === "f") && valid[1] === "f" && valid[2] === "f") return rejectOwned("FLOAT64");
  return publish({ hex: valid }, "float64");
};

export const constructRef = (byteLength: number, sha256: string): OwnedByteRef => {
  if (typeof byteLength !== "number" || !isSafeInteger(byteLength) || byteLength < 0 || byteLength > maximumSafeInteger || sameValue(byteLength, -0)) return rejectOwned("REF");
  const valid = lowerHex(sha256, 64, "REF");
  return publish({ byteLength, sha256: valid }, "ref");
};

export const constructCanonicalOpening = (): OwnedPublicOpening => {
  const bank = publish({ w: 3, b: 3 } as const, "bank");
  const cc = publish({ w: "e1", b: "e8" } as const, "cc");
  const w = publish(["c2", "d2", "e2", "f2"] as const, "white-marines");
  const b = publish(["c7", "d7", "e7", "f7"] as const, "black-marines");
  const marines = publish({ w, b }, "marines");
  return publish({ version: "starchess-economic-opening-v1", turn: 0, bank, cc, marines } as const, "opening");
};

export const requireFloat64Hex = (value: unknown): OwnedFloat64Hex => requireRole(value, "float64");
export const requireRef = (value: unknown): OwnedByteRef => requireRole(value, "ref");
export const requireOpening = (value: unknown): OwnedPublicOpening => requireRole(value, "opening");

const fixedCarrier = (carrier: unknown): Readonly<{ source: Uint8Array; length: number }> => {
  try {
    if (apply(typedTag, carrier, []) !== "Uint8Array") return rejectOwned("CARRIER");
    const buffer = apply(typedBuffer, carrier, []) as ArrayBuffer;
    apply(bufferLength, buffer, []);
    if (!bufferResizable || apply(bufferResizable, buffer, []) !== false) return rejectOwned("CARRIER");
    const offset = apply(typedOffset, carrier, []) as number;
    const length = apply(typedLength, carrier, []) as number;
    return { source: new FixedUint8Array(buffer, offset, length), length };
  } catch {
    return rejectOwned("CARRIER");
  }
};

export const snapshotFixedBytes = (carrier: unknown, production: ByteProduction, context?: Meter): OwnedByteSnapshot => {
  switch (production) {
    case "float64": case "ref": case "opening": case "economicArtifact": case "featureManifest": case "pin": case "binding":
    case "estimatorProvenance": case "authority": case "trainingRecipe": case "boundaryBatch": case "history": case "candidate": case "completion": break;
    default: return rejectOwned("BYTES");
  }
  const planning = production === "boundaryBatch" || production === "history" || production === "candidate";
  if (planning) requirePlanningMeter(context);
  try {
  if (planning) contextWork(context as Meter, false, 512);
  const { source, length } = fixedCarrier(carrier);
  if (length > BYTE_PRODUCTION_LIMITS[production]) return rejectOwned("BYTES");
  if (planning) contextWork(context as Meter, false, 512 + 8 * length);
  const bytes = new FixedUint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = source[i]!;
  const storage = freeze({ production, length, bytes });
  const snapshot = {} as OwnedByteSnapshot;
  registerBytes(snapshot, storage);
  return publish(snapshot, "snapshot");
  } catch (error) {
    if (planning) { try { abortPlanningWork(context); } catch { } }
    throw error;
  }
};

const storageFor = (value: unknown): SnapshotStorage => {
  const snapshot = requireRole<OwnedByteSnapshot>(value, "snapshot");
  const storage = lookupBytes(snapshot);
  if (!storage) return rejectOwned("PROVENANCE");
  return storage;
};

export const requireSnapshot = (value: unknown, production: ByteProduction): OwnedByteSnapshot => {
  const storage = storageFor(value);
  if (storage.production !== production) return rejectOwned("PROVENANCE");
  return value as OwnedByteSnapshot;
};

export const snapshotLength = (value: unknown): number => storageFor(value).length;
export const snapshotProduction = (value: unknown): ByteProduction => storageFor(value).production;
export const readSnapshotByte = (value: unknown, index: number): number => {
  const storage = storageFor(value);
  if (typeof index !== "number" || !isSafeInteger(index) || index < 0 || index >= storage.length || sameValue(index, -0)) return rejectOwned("INDEX");
  return storage.bytes[index]!;
};

export type A2Operation = "initialize" | "advance" | "readout" | "encode" | "flatten";
declare const a2Brand: unique symbol;
declare const ingressBrand: unique symbol;
declare const blockBrand: unique symbol;
export type A2Ticket = Readonly<{ [a2Brand]: "a2-accounting" }>;
export type IngressTicket = Readonly<{ [ingressBrand]: "ingress-accounting" }>;
export type BlockTicket = Readonly<{ [blockBrand]: "prepaid-block" }>;
export type LedgerOwner = Readonly<{
  admitOnce(): void;
  armInitialize(): void;
  armAdvance(): void;
  armReadout(): void;
  armEncode(): void;
  armFlatten(): void;
  beginR3Visit(): IngressTicket;
  beginR3Node(): IngressTicket;
  beginR3ByteReads(byteLength: ValidatedExtent): IngressTicket;
  beginBatchSnapshot(byteLength: ValidatedExtent): IngressTicket;
  beginBatchHash(byteLength: ValidatedExtent): IngressTicket;
  finishIngress(ticket: IngressTicket): void;
  close(): void;
  abort(): void;
}>;
export type LedgerPair = Readonly<{ meter: Meter; owner: LedgerOwner }>;
type LedgerPhase = "UNADMITTED" | "IDLE" | "ARMED" | "ACTIVE" | "CLOSED" | "ABORTED" | "FAILED";
type Transaction = {
  ledger: LedgerControl; ticket: A2Ticket | IngressTicket; kind: "a2" | "ingress"; operation: A2Operation | ClosedBlockId;
  parent: Transaction | undefined; live: boolean; remaining: number; emptyAvailable: boolean; pending: BlockControl | undefined;
  evaluationSupport: EvaluationSupportStorage | undefined;
};
type BlockControl = {
  transaction: Transaction; ticket: BlockTicket; block: ClosedBlockId; remaining: number; callsRemaining: number;
  phase: "RESERVED" | "EXECUTING" | "EXPIRED";
};
type LedgerControl = {
  meter: Meter; used: number; phase: LedgerPhase; gate: boolean; armed: A2Operation | undefined;
  active: Transaction | undefined;
};
const accounting = new WeakMap<object, LedgerControl>();
const transactions = new WeakMap<object, Transaction>();
const blocks = new WeakMap<object, BlockControl>();
const accountingGet = WeakMap.prototype.get.bind(accounting);
const accountingSet = WeakMap.prototype.set.bind(accounting);
const transactionGet = WeakMap.prototype.get.bind(transactions);
const transactionSet = WeakMap.prototype.set.bind(transactions);
const blockGet = WeakMap.prototype.get.bind(blocks);
const blockSet = WeakMap.prototype.set.bind(blocks);
const create = Object.create;
const define = Object.defineProperty;
const preventExtensions = Object.preventExtensions;
const prototypeOf = Object.getPrototypeOf;
const extensible = Object.isExtensible;
const ownKeys = Reflect.ownKeys;
let paying: LedgerControl | undefined;

const ledgerFor = (value: unknown, path = "$.meter"): LedgerControl => {
  if (value === null || typeof value !== "object") return fail(path, "PROVENANCE");
  const control = accountingGet(value);
  if (!control) return fail(path, "PROVENANCE");
  return control;
};

const expireTransaction = (transaction: Transaction): void => {
  transaction.live = false;
  if (transaction.evaluationSupport) transaction.evaluationSupport.live = false;
  transaction.evaluationSupport = undefined;
  if (transaction.pending) transaction.pending.phase = "EXPIRED";
  transaction.pending = undefined;
};

const latch = (control: LedgerControl): void => {
  const decoder = getCurrentBoundaryDecode(control.meter) as BoundaryDecodeControl | undefined;
  if (decoder) { decoder.live = false; deleteCurrentBoundaryDecode(control.meter); }
  let transaction = control.active;
  while (transaction) {
    expireTransaction(transaction);
    transaction = transaction.parent;
  }
  control.active = undefined;
  control.armed = undefined;
  control.phase = "FAILED";
  control.gate = false;
  if (paying === control) paying = undefined;
};

const rejectLedger = (control: LedgerControl, code: string, path = "$.meter"): never => {
  latch(control);
  return fail(path, code);
};

const checkMeter = (control: LedgerControl, path = "$.meter"): void => {
  const limit = descriptor(control.meter, "limit"), used = descriptor(control.meter, "used");
  if (!limit || !used || limit.value !== PLANNING_WORK_CAP || limit.writable !== false || limit.configurable !== false || limit.enumerable !== true ||
      used.value !== control.used || used.writable !== true || used.configurable !== false || used.enumerable !== true ||
      prototypeOf(control.meter) !== null || extensible(control.meter) || ownKeys(control.meter).length !== 2) rejectLedger(control, "TAMPER", path);
};

const checkUsage = (control: LedgerControl, path = "$.meter"): void => {
  const used = descriptor(control.meter, "used")!;
  if (used.value !== control.used || used.writable !== true) return rejectLedger(control, "TAMPER", path);
};

const debit = (control: LedgerControl, units: number, path = "$.meter"): void => {
  if (!isSafeInteger(units) || units < 0 || units > PLANNING_WORK_CAP - control.used) return rejectLedger(control, "WORK_CAP", path);
  control.used += units;
  control.meter.used = control.used;
};

const idleGate = (control: LedgerControl): void => {
  if (control.phase !== "IDLE" || !control.gate || control.active || paying) return rejectLedger(control, "LIFECYCLE");
  checkMeter(control);
};

const arm = (control: LedgerControl, operation: A2Operation): void => {
  idleGate(control);
  debit(control, PLANNING_ENTRY_UNITS + PLANNING_GATE_UNITS);
  control.phase = "ARMED";
  control.armed = operation;
};

const newTransaction = (control: LedgerControl, kind: "a2" | "ingress", operation: A2Operation | ClosedBlockId,
  remaining: number, parent: Transaction | undefined): Transaction => {
  const ticket = freeze(create(null)) as A2Ticket | IngressTicket;
  const transaction: Transaction = { ledger: control, ticket, kind, operation, parent, live: true, remaining, emptyAvailable: remaining === 0,
    pending: undefined, evaluationSupport: undefined };
  transactionSet(ticket, transaction);
  control.active = transaction;
  control.phase = "ACTIVE";
  paying = control;
  return transaction;
};

const transactionFor = (value: unknown): Transaction => {
  if (value === null || typeof value !== "object") {
    if (paying) return rejectLedger(paying, "TICKET", "$.ticket");
    return fail("$.ticket", "TICKET");
  }
  const transaction = transactionGet(value);
  if (!transaction) {
    if (paying) return rejectLedger(paying, "TICKET", "$.ticket");
    return fail("$.ticket", "TICKET");
  }
  const control = transaction.ledger;
  if (paying && paying !== control) return rejectLedger(paying, "TICKET", "$.ticket");
  if (!transaction.live || control.phase !== "ACTIVE" || control.active !== transaction || paying !== control) return rejectLedger(control, "TICKET", "$.ticket");
  checkMeter(control);
  return transaction;
};

const activeFor = (value: unknown, path = "$.meter"): Transaction => {
  const control = ledgerFor(value, path);
  if (control.phase !== "ACTIVE" || !control.active || paying !== control) return rejectLedger(control, "LIFECYCLE", path);
  checkUsage(control, path);
  return control.active;
};

export const requirePlanningMeter = (value: unknown, path = "$.meter"): Meter => activeFor(value, path).ledger.meter;

const finishTransaction = (transaction: Transaction): void => {
  const control = transaction.ledger;
  if (transaction.pending || transaction.evaluationSupport) return rejectLedger(control, "TICKET", "$.ticket");
  const decoder = getCurrentBoundaryDecode(control.meter) as BoundaryDecodeControl | undefined;
  if (decoder?.live && decoder.transaction === transaction) return rejectLedger(control, "TICKET", "$.ticket");
  expireTransaction(transaction);
  control.active = transaction.parent;
  if (!transaction.parent) {
    control.phase = "IDLE";
    paying = undefined;
  }
};

const beginIngress = (control: LedgerControl, block: ClosedBlockId, extent: number): IngressTicket => {
  if (getCurrentBoundaryDecode(control.meter)) return rejectLedger(control, "LIFECYCLE");
  const parent = control.active;
  if (parent) {
    if (control.phase !== "ACTIVE" || paying !== control || !parent.live || parent.kind !== "ingress" || parent.pending ||
      !(parent.operation === "r3-visit" && block === "r3-node" || parent.operation === "r3-node" &&
        (block === "r3-byte-read" || block === "batch-snapshot" || block === "batch-hash"))) return rejectLedger(control, "LIFECYCLE");
    checkMeter(control);
  } else idleGate(control);
  let units: number;
  try { units = quoteBlock(block, extent, 0); }
  catch (error) { latch(control); throw error; }
  debit(control, units + PLANNING_ENTRY_UNITS + PLANNING_GATE_UNITS);
  return newTransaction(control, "ingress", block, extent, parent).ticket as IngressTicket;
};

export const createPlanningLedger = (): LedgerPair => {
  const initial = PLANNING_INITIAL_UNITS;
  const meter = create(null) as Meter;
  const limitDescriptor = { __proto__: null, value: PLANNING_WORK_CAP, writable: false, configurable: false, enumerable: true };
  const usedDescriptor = { __proto__: null, value: initial, writable: true, configurable: false, enumerable: true };
  define(meter, "limit", limitDescriptor);
  define(meter, "used", usedDescriptor);
  preventExtensions(meter);
  const control: LedgerControl = { meter, used: initial, phase: "UNADMITTED", gate: true, armed: undefined, active: undefined };
  const owner: LedgerOwner = freeze({
    admitOnce(): void {
      if (control.phase !== "UNADMITTED" || !control.gate || paying) return rejectLedger(control, "LIFECYCLE");
      checkMeter(control);
      debit(control, PLANNING_GATE_UNITS);
      control.phase = "IDLE";
    },
    armInitialize(): void { arm(control, "initialize"); },
    armAdvance(): void { arm(control, "advance"); },
    armReadout(): void { arm(control, "readout"); },
    armEncode(): void { arm(control, "encode"); },
    armFlatten(): void { arm(control, "flatten"); },
    beginR3Visit(): IngressTicket { return beginIngress(control, "r3-visit", 1); },
    beginR3Node(): IngressTicket { return beginIngress(control, "r3-node", 1); },
    beginR3ByteReads(byteLength: ValidatedExtent): IngressTicket { return beginIngress(control, "r3-byte-read", byteLength); },
    beginBatchSnapshot(byteLength: ValidatedExtent): IngressTicket { return beginIngress(control, "batch-snapshot", byteLength); },
    beginBatchHash(byteLength: ValidatedExtent): IngressTicket { return beginIngress(control, "batch-hash", byteLength); },
    finishIngress(ticket: IngressTicket): void {
      if (control.phase !== "ACTIVE" || paying !== control) return rejectLedger(control, "LIFECYCLE");
      const transaction = ticket !== null && typeof ticket === "object" ? transactionGet(ticket) : undefined;
      if (!transaction || transaction.ledger !== control || transaction.kind !== "ingress" || !transaction.live || control.active !== transaction) return rejectLedger(control, "TICKET", "$.ticket");
      checkMeter(control);
      finishTransaction(transaction);
    },
    close(): void {
      idleGate(control);
      control.phase = "CLOSED";
      control.gate = false;
    },
    abort(): void {
      if (control.phase === "CLOSED" || control.phase === "ABORTED" || control.phase === "FAILED") return rejectLedger(control, "LIFECYCLE");
      checkMeter(control);
      latch(control);
      control.phase = "ABORTED";
    },
  });
  accountingSet(meter, control);
  register(meter, "meter");
  return freeze({ meter, owner });
};

export const enterA2 = (meter: unknown, operation: A2Operation): A2Ticket => {
  const control = ledgerFor(meter);
  if (control.phase !== "ARMED" || control.armed !== operation || paying || !control.gate) return rejectLedger(control, "LIFECYCLE");
  checkMeter(control);
  control.armed = undefined;
  return newTransaction(control, "a2", operation, 0, undefined).ticket as A2Ticket;
};

export const finishA2 = (ticket: A2Ticket): void => {
  const transaction = transactionFor(ticket);
  if (transaction.kind !== "a2") return rejectLedger(transaction.ledger, "TICKET", "$.ticket");
  finishTransaction(transaction);
};

export const abortA2 = (ticket: A2Ticket): void => {
  const transaction = transactionFor(ticket);
  if (transaction.kind !== "a2") return rejectLedger(transaction.ledger, "TICKET", "$.ticket");
  latch(transaction.ledger);
};
export const failCurrentEntry = (ticket: A2Ticket, error: unknown): never => {
  try { abortA2(ticket); } catch { }
  throw error;
};

export const reserveBlock = (ticket: A2Ticket | IngressTicket, block: ClosedBlockId, extent0: ValidatedExtent, extent1: ValidatedExtent): BlockTicket => {
  const transaction = transactionFor(ticket), control = transaction.ledger;
  if (transaction.pending) return rejectLedger(control, "TICKET", "$.block");
  let units: number;
  try { units = quoteBlock(block, extent0, extent1); }
  catch (error) { latch(control); throw error; }
  if (transaction.kind === "ingress" && block === transaction.operation) {
    if (extent0 > transaction.remaining || extent0 === 0 && !transaction.emptyAvailable) return rejectLedger(control, "TICKET", "$.block");
    transaction.emptyAvailable = false;
    transaction.remaining -= extent0;
  } else {
    if (block === "r3-visit" || block === "r3-node" || block === "r3-byte-read" || block === "batch-snapshot" || block === "batch-hash") return rejectLedger(control, "TICKET", "$.block");
    debit(control, units, "$.work");
  }
  const token = freeze(create(null)) as BlockTicket;
  const callsRemaining = block === "scalar" || block === "float64-array" ? 1 : extent0 === 0 ? 1 : extent0;
  const reservation: BlockControl = { transaction, ticket: token, block, remaining: extent0, callsRemaining, phase: "RESERVED" };
  blockSet(token, reservation);
  transaction.pending = reservation;
  return token;
};

const blockFor = (meter: unknown, ticket: unknown): BlockControl => {
  const transaction = activeFor(meter);
  if (ticket === null || typeof ticket !== "object") return rejectLedger(transaction.ledger, "TICKET", "$.block");
  const block = blockGet(ticket);
  if (!block || block.transaction !== transaction || transaction.pending !== block || block.phase === "EXPIRED") return rejectLedger(transaction.ledger, "TICKET", "$.block");
  return block;
};

export const beginBlock = (meter: unknown, ticket: BlockTicket, block: ClosedBlockId): void => {
  const reservation = blockFor(meter, ticket);
  if (reservation.phase !== "RESERVED" || reservation.block !== block) return rejectLedger(reservation.transaction.ledger, "TICKET", "$.block");
  reservation.phase = "EXECUTING";
};

export const requireBlockMeter = (meter: unknown, ticket: BlockTicket): Meter => {
  const reservation = blockFor(meter, ticket);
  if (reservation.phase !== "EXECUTING") return rejectLedger(reservation.transaction.ledger, "TICKET", "$.block");
  return reservation.transaction.ledger.meter;
};

export const finishBlock = (meter: unknown, ticket: BlockTicket): void => {
  const reservation = blockFor(meter, ticket);
  if (reservation.phase !== "EXECUTING") return rejectLedger(reservation.transaction.ledger, "TICKET", "$.block");
  reservation.phase = "EXPIRED";
  reservation.transaction.pending = undefined;
};

export const abortBlock = (meter: unknown, ticket: BlockTicket): void => { latch(blockFor(meter, ticket).transaction.ledger); };

export const consumeWorkBlock = (meter: unknown, block: ClosedBlockId, extent: ValidatedExtent, path = "$.work"): void => {
  const transaction = activeFor(meter, path), control = transaction.ledger;
  const reservation = transaction.pending;
  if (reservation) {
    if (reservation.phase !== "EXECUTING" || reservation.block !== block) return rejectLedger(control, "TICKET", path);
    try { quoteBlock(block, extent, 0, path); }
    catch (error) { latch(control); throw error; }
    if (extent > reservation.remaining || reservation.callsRemaining === 0) return rejectLedger(control, "TICKET", path);
    reservation.callsRemaining--;
    reservation.remaining -= extent;
    return;
  }
  const ticket = reserveBlock(transaction.ticket, block, extent, 0);
  beginBlock(meter, ticket, block);
  const issued = blockGet(ticket)!;
  issued.remaining = 0;
  finishBlock(meter, ticket);
};

export const abortPlanningWork = (meter: unknown): void => { latch(ledgerFor(meter)); };
export const rejectPlanningWork = (path: string, code: string): never => {
  if (paying) latch(paying);
  return fail(path, code);
};

declare const startupBrand: unique symbol;
declare const cursorBrand: unique symbol;
declare const verifiedBrand: unique symbol;
export type StartupArtifactContext = Readonly<{ [startupBrand]: "startup-artifacts-only" }>;
export type ConstructionContext = Meter | StartupArtifactContext;
export type OwnedCursor<T> = Readonly<{ [cursorBrand]: T }>;
export type VerifiedBatchBytes = Readonly<{ [verifiedBrand]: "verified-public-batch" }>;
export type Piece = NonNullable<Exclude<Cells[number], { visibility: "unknown" }>['piece']>;
export type Unit = AuthorizedSnapshotV2['ownUnitLineage'][number];
export type Mine = AuthorizedSnapshotV2['ownMineLineage'][number];
export type Receipt = AuthorizedSnapshotV2['economicState']['receipts'][number];
export type ActionRef = Receipt['actionRef'];
export type Ledger = AuthorizedSnapshotV2['economicState'];
export type Own = AuthorizedSnapshotV2['own'];
export type MineAudit = CheckedBoundary['ownMineAuditState'];
export type Event = ReturnType<typeof makeOwnPaidReceiptEvent | typeof makeOwnGasDebitedEvent | typeof makeOwnUnitEndowedEvent |
  typeof makeOwnUnitCreatedEvent | typeof makeOwnDeploymentUnmaterializedEvent | typeof makeOwnUnitMovedEvent | typeof makeOwnUnitTransformedEvent |
  typeof makeOwnUnitModeChangedEvent | typeof makeOwnUnitDestroyedEvent | typeof makeOwnMineEndowedEvent | typeof makeOwnMineCreatedEvent |
  typeof makeOwnMineRemovedEvent | typeof makeOwnIncomeEvent | typeof makeOwnCCLivesChangedEvent | typeof makeEnemyUnitDestructionWitnessedEvent | typeof makeVisionWitnessEvent>;
export type Batch = Readonly<{
  version: "challenge-boundary-batch-v1"; side: Side; ordinal: number; phase: CheckedBoundary['phase'];
  turn: number; planningOrdinal: number; seqBefore: number; seqThrough: number; events: readonly Event[]; snapshot: AuthorizedSnapshotV2;
}>;
type CursorRole = "cells" | "changes" | "memory" | "squares" | "own-pieces" | "own-units" | "own-mines" | "receipts" |
  "retired-units" | "retired-mines" | "events" | "actions" | "conditional" | "components" | "support" |
  "transition-rows" | "evidence-rows" | "tables" | "partition" | "temperatures" | "queue" | "position" | "economic" | "promotion";
type SupportSummary = { count: number; minimumD: number; maximumD: number; minimumPotential: number; maximumPotential: number; canBirth: boolean };
type CursorStorage = { context: ConstructionContext; role: CursorRole; min: number; max: number; values: unknown[];
  count: number; live: boolean; auxiliary: number; support: SupportSummary | undefined; transaction: Transaction | undefined };
const cursors = new WeakMap<object, CursorStorage>();
const getCursor = WeakMap.prototype.get.bind(cursors);
const setCursor = WeakMap.prototype.set.bind(cursors);
const supportSummaries = new WeakMap<object, Readonly<SupportSummary>>();
const getSupportSummary = WeakMap.prototype.get.bind(supportSummaries);
const setSupportSummary = WeakMap.prototype.set.bind(supportSummaries);
const numericValues = new WeakMap<object, number>();
const getNumericValue = WeakMap.prototype.get.bind(numericValues);
const setNumericValue = WeakMap.prototype.set.bind(numericValues);
const dense = Array.from.bind(Array);
const push = (target: unknown[], value: unknown): void => {
  const field = { __proto__: null, value, writable: true, configurable: true, enumerable: true };
  define(target, `${target.length}`, field);
};
const numeric = Number;
const finite = Number.isFinite;
const abs = Math.abs;
const floor = Math.floor;
const DenseDataView = DataView;
const DenseArrayBuffer = ArrayBuffer;
const dataGet = DataView.prototype.getFloat64;
const dataSet = DataView.prototype.setUint8;
const dataGetByte = DataView.prototype.getUint8;
const dataSetNumber = DataView.prototype.setFloat64;
const joinDigits = Array.prototype.join;
const constructionFail = (code: string, path = "$"): never => rejectPlanningWork(path, code);
const integer = (value: unknown, maximum: number, minimum = 0): number =>
  typeof value === "number" && isSafeInteger(value) && !sameValue(value, -0) && value >= minimum && value <= maximum ? value : constructionFail("NUMBER");
const color = (value: unknown): Side => value === "w" || value === "b" ? value : constructionFail("SIDE");
const atSquare = (value: unknown): Square => typeof value === "string" && value.length === 2 && value[0]! >= "a" && value[0]! <= "h" &&
  value[1]! >= "1" && value[1]! <= "8" ? value as Square : constructionFail("SCHEMA");
const kindType = (value: unknown, spawn = false): Piece['type'] =>
  value === "p" || value === "n" || value === "b" || value === "r" || value === "q" || !spawn && value === "k" ? value as Piece['type'] : constructionFail("SCHEMA");
const spawnType = (value: unknown): Exclude<Piece['type'], "k"> => kindType(value, true) as Exclude<Piece['type'], "k">;
const replacementValue = (type: Piece['type']): number => type === "k" ? 0 : UNIT_COST[type];
const identifier = (value: unknown, side: Side, kind: "unit" | "mine" | "receipt" | "witness"): string => {
  if (typeof value !== "string" || value.length > 64 || !value.startsWith(`${side}:${kind}:`)) return constructionFail("IDENTITY");
  const suffix = value.slice(kind.length + 3);
  if (kind === "unit" || kind === "mine") {
    if (suffix.startsWith("opening:") && suffix.length === 10) { atSquare(suffix.slice(8)); return value; }
    if (!suffix.startsWith("created:")) return constructionFail("IDENTITY");
    const digits = suffix.slice(8);
    if (!/^[1-9][0-9]*$/.test(digits)) return constructionFail("IDENTITY");
    integer(numeric(digits), kind === "unit" ? 64 : 192, 1);
  } else if (kind === "receipt") {
    if (!/^(0|[1-9][0-9]*):(0|[1-9][0-9]*)$/.test(suffix)) return constructionFail("IDENTITY");
    const colon = suffix.indexOf(":");
    integer(numeric(suffix.slice(0, colon)), 63); integer(numeric(suffix.slice(colon + 1)), 3);
  } else {
    if (!/^[1-9][0-9]*$/.test(suffix)) return constructionFail("IDENTITY");
    integer(numeric(suffix), 128, 1);
  }
  return value;
};
const sideOfId = (value: unknown): Side => typeof value === "string" ? color(value[0]) : constructionFail("IDENTITY");
const contextWork = (context: ConstructionContext, startup: boolean, units: number): void => {
  if (context !== null && typeof context === "object" && lookup(context) === "startup") {
    if (!startup) return constructionFail("PROVENANCE");
    return;
  }
  requirePlanningMeter(context);
  if (units > PLANNING_WORK_CAP) return constructionFail("WORK_CAP", "$.construction");
  consumeWorkBlock(context, "scalar", units, "$.construction");
};
export const createStartupArtifactContext = (): StartupArtifactContext => publish(create(null) as StartupArtifactContext, "startup");
export const requireStartupArtifactContext = (value: unknown): StartupArtifactContext => requireRole(value, "startup");
export const requireHistory = (value: unknown): History => requireRole(value, "history");
export const requireBoundary = (value: unknown): CheckedBoundary => requireRole(value, "boundary");
export const requireCandidate = (value: unknown): Candidate => requireRole(value, "candidate");
export const requireArtifact = (value: unknown): EconomicArtifact => requireRole(value, "artifact");
export const requireState = (value: unknown): EconomicBeliefState => requireRole(value, "state");
export const requireReadout = (value: unknown): EconomicReadout => requireRole(value, "readout");
export const requireFeatureBlocks = (value: unknown): FeatureBlocksV3 => requireRole(value, "features");
export const requireManifest = (value: unknown): FeatureManifestV3 => requireRole(value, "manifest");
export const requireBatch = (value: unknown): Batch => requireRole(value, "batch");
export const requireSnapshotV2 = (value: unknown): AuthorizedSnapshotV2 => requireRole(value, "snapshot-v2");
export const requireEconomicPin = (value: unknown): EconomicPin => requireRole(value, "pin");
export const requireEconomicBinding = (value: unknown): EconomicBinding => requireRole(value, "binding");
export const requireEstimatorProvenance = (value: unknown): EstimatorProvenance => requireRole(value, "provenance");
export const requireEconomicAuthority = (value: unknown): EconomicAuthority => requireRole(value, "authority");
export const requireTrainingRecipe = (value: unknown): TrainingRecipeV2 => requireRole(value, "training-recipe");
export const requireCells = (value: unknown): Cells => requireRole(value, "cells");
export const requireMemory = (value: unknown): Memory => requireRole(value, "memory");
export const requireSquareSet = (value: unknown): readonly Square[] => requireRole(value, "squares");
export const requireOwnPieces = (value: unknown): Own['pieces'] => requireRole(value, "own-pieces");
export const requireOwnUnits = (value: unknown): readonly Unit[] => requireRole(value, "own-units");
export const requireOwnMines = (value: unknown): readonly Mine[] => requireRole(value, "own-mines");
export const requireReceipts = (value: unknown): readonly Receipt[] => requireRole(value, "receipts");
export const requireEconomicLedger = (value: unknown): Ledger => requireRole(value, "ledger");
export const requireMineAudit = (value: unknown): MineAudit => requireRole(value, "mine-audit");
export const requireOwnState = (value: unknown): Own => requireRole(value, "own");
export const requireEvents = (value: unknown): readonly Event[] => requireRole(value, "events");
export const requireActions = (value: unknown): readonly ScActionInput[] => requireRole(value, "actions");
export const requireConditional = (value: unknown): readonly OwnedFloat64Hex[] => requireRole(value, "conditional");
export const requireComponents = (value: unknown): readonly Component[] => requireRole(value, "components");
export const requirePublicSupport = (value: unknown): readonly boolean[] => requireRole(value, "support");
export const requireTables = (value: unknown): readonly Table[] => requireRole(value, "tables");
export const requirePartition = (value: unknown): readonly Bin[] => requireRole(value, "partition");
export const requireTemperatures = (value: unknown): readonly OwnedFloat64Hex[] => requireRole(value, "temperatures");
export const requirePiece = (value: unknown): Piece => requireRole(value, "piece");
export const requireCell = (value: unknown): Cells[number] => requireRole(value, "cell");
export const requireSighting = (value: unknown): Memory[number] => requireRole(value, "sighting");
export const requireOwnPiece = (value: unknown): Own['pieces'][number] => requireRole(value, "own-piece");
export const requireOwnUnit = (value: unknown): Unit => requireRole(value, "own-unit");
export const requireOwnMine = (value: unknown): Mine => requireRole(value, "own-mine");
export const requireActionRef = (value: unknown): ActionRef => requireRole(value, "action-ref");
export const requireDisposition = (value: unknown): Receipt['disposition'] => requireRole(value, "disposition");
export const requirePaidReceipt = (value: unknown): Receipt => requireRole(value, "receipt");
export const requireEnemyLoss = (value: unknown): Ledger['enemyLoss'] => requireRole(value, "enemy-loss");
export const requireEvent = (value: unknown): Event => requireRole(value, "event");
export const requireAction = (value: unknown): ScActionInput => requireRole(value, "action");
export const requireComponent = (value: unknown): Component => requireRole(value, "component");
export const requireEconomicRecipe = (value: unknown): EconomicRecipe => requireRole(value, "recipe");
export const requireTransitionRow = (value: unknown): TransitionRow => requireRole(value, "transition-row");
export const requireEvidenceRow = (value: unknown): EvidenceRow => requireRole(value, "evidence-row");
export const requireTable = (value: unknown): Table => requireRole(value, "table");
export const requirePartitionBin = (value: unknown): Bin => requireRole(value, "bin");
export const requireQueue34 = (value: unknown): Queue34 => requireRole(value, "queue");
export const requirePosition84 = (value: unknown): Position84 => requireRole(value, "position");
export const requireEconomic12 = (value: unknown): Economic12 => requireRole(value, "economic");
export const requirePromotion36 = (value: unknown): Promotion36 => requireRole(value, "promotion");

const beginCursor = <T>(context: ConstructionContext, role: CursorRole, minimum: number, maximum: number, startup = false, auxiliary = 0): OwnedCursor<T> => {
  contextWork(context, startup, 1024 + 48 * maximum + (role === "own-units" || role === "own-mines" || role === "receipts" ? 16 * maximum * maximum : 0));
  const cursor = freeze(create(null)) as OwnedCursor<T>;
  setCursor(cursor, { context, role, min: minimum, max: maximum, values: [], count: 0, live: true, auxiliary,
    support: role === "support" ? { count: 0, minimumD: 576, maximumD: 0, minimumPotential: 588, maximumPotential: 0, canBirth: false } : undefined,
    transaction: lookup(context) === "startup" ? undefined : activeFor(context) });
  return cursor;
};
const cursorFor = (context: ConstructionContext, value: unknown, role: CursorRole): CursorStorage => {
  if (context !== null && typeof context === "object" && lookup(context) === "startup") {
    if (role !== "transition-rows" && role !== "evidence-rows" && role !== "tables" && role !== "partition" && role !== "temperatures") return constructionFail("PROVENANCE");
  } else requirePlanningMeter(context);
  if (value === null || typeof value !== "object") return constructionFail("PROVENANCE");
  const cursor = getCursor(value);
  if (!cursor || cursor.context !== context || cursor.role !== role || !cursor.live) return constructionFail("PROVENANCE");
  if (cursor.transaction && cursor.transaction !== activeFor(context)) return constructionFail("TICKET");
  return cursor;
};
const appendCursor = (context: ConstructionContext, value: unknown, role: CursorRole, child: unknown): void => {
  const cursor = cursorFor(context, value, role);
  if (cursor.count >= cursor.max) return constructionFail("CARDINALITY");
  const index = cursor.count;
  let checked: unknown = child;
  switch (role) {
    case "cells": case "changes": checked = requireRole<Cells[number]>(child, "cell"); break;
    case "memory": checked = requireRole<Memory[number]>(child, "sighting"); break;
    case "own-pieces": checked = requireRole<Own['pieces'][number]>(child, "own-piece"); break;
    case "own-units": checked = requireRole<Unit>(child, "own-unit"); break;
    case "own-mines": checked = requireRole<Mine>(child, "own-mine"); break;
    case "receipts": checked = requireRole<Receipt>(child, "receipt"); break;
    case "events": checked = requireRole<Event>(child, "event"); break;
    case "actions": checked = requireRole<ScActionInput>(child, "action"); break;
    case "components": checked = requireRole<Component>(child, "component"); break;
    case "transition-rows": checked = requireRole<TransitionRow>(child, "transition-row"); break;
    case "evidence-rows": checked = requireRole<EvidenceRow>(child, "evidence-row"); break;
    case "tables": checked = requireRole<Table>(child, "table"); break;
    case "partition": checked = requireRole<Bin>(child, "bin"); break;
    case "squares": checked = atSquare(child); break;
    case "retired-units": case "retired-mines": checked = identifier(child, cursor.auxiliary === 0 ? "w" : "b", role === "retired-units" ? "unit" : "mine"); break;
    case "support": {
      if (typeof child !== "boolean") return constructionFail("SCHEMA");
      if (child) {
        contextWork(context, false, 64);
        const summary = cursor.support!, material = index % 577, potential = material + floor(index / 577);
        summary.count++;
        if (material < summary.minimumD) summary.minimumD = material;
        if (material > summary.maximumD) summary.maximumD = material;
        if (potential < summary.minimumPotential) summary.minimumPotential = potential;
        if (potential > summary.maximumPotential) summary.maximumPotential = potential;
        if (index >= 577) summary.canBirth = true;
      }
      break;
    }
    case "conditional": case "temperatures": checked = requireFloat64Hex(child); break;
    default: return constructionFail("PROVENANCE");
  }
  if (role === "cells" && (checked as Cells[number]).square !== `${"abcdefgh"[floor(index / 8)]}${index % 8 + 1}`) return constructionFail("ORDER");
  const orderedKey = (item: unknown): string => {
    switch (role) {
      case "memory": case "changes": case "own-pieces": case "own-units": return (item as { square: Square }).square;
      case "own-mines": return `${(item as Mine).square}:${(item as Mine).mineId}`;
      case "receipts": return (item as Receipt).receiptId;
      case "squares": case "retired-units": case "retired-mines": return item as string;
      default: return "";
    }
  };
  if (index > 0 && orderedKey(checked) !== "" && orderedKey(cursor.values[index - 1]) >= orderedKey(checked)) return constructionFail("ORDER");
  if (role === "components" && index > 0) {
    const prior = cursor.values[index - 1] as Component, current = checked as Component;
    if (prior.bank * 19 + prior.band >= current.bank * 19 + current.band) return constructionFail("ORDER");
  }
  if (role === "events" && index > 0 && (checked as Event).seq !== (cursor.values[index - 1] as Event).seq + 1) return constructionFail("SEQUENCE");
  if (role === "own-units" || role === "own-mines" || role === "receipts") for (let i = 0; i < index; i++) {
    const prior = cursor.values[i];
    if (role === "own-units" && (prior as Unit).id === (checked as Unit).id || role === "own-mines" && (prior as Mine).mineId === (checked as Mine).mineId ||
      role === "receipts" && (prior as Receipt).actionRef.planningOrdinal === (checked as Receipt).actionRef.planningOrdinal) return constructionFail("IDENTITY");
  }
  if ((role === "transition-rows" || role === "evidence-rows") && index > 0) {
    const previous = cursor.values[index - 1] as readonly number[], current = checked as readonly number[];
    let order = 0;
    for (let i = 0; i < current.length - 1 && order === 0; i++) order = current[i]! - previous[i]!;
    if (order <= 0) return constructionFail("ORDER");
  }
  push(cursor.values, checked); cursor.count++;
};
const finishCursor = <T>(context: ConstructionContext, value: unknown, role: CursorRole): readonly T[] => {
  const cursor = cursorFor(context, value, role);
  if (cursor.count < cursor.min) return constructionFail("CARDINALITY");
  cursor.live = false;
  return publish(cursor.values as T[], role);
};

export const makePiece = (c: ConstructionContext, type: Piece['type'], side: Side): Piece => {
  contextWork(c, false, 512); return publish({ type: kindType(type), color: color(side) }, "piece");
};
export const makeUnknownCell = (c: ConstructionContext, square: Square): Cells[number] => {
  contextWork(c, false, 512); return publish({ square: atSquare(square), visibility: "unknown" as const }, "cell");
};
export const makeLitCell = (c: ConstructionContext, square: Square, piece: Piece | null): Cells[number] => {
  contextWork(c, false, 512); if (piece !== null) requireRole(piece, "piece");
  return publish({ square: atSquare(square), visibility: "lit" as const, piece }, "cell");
};
export const makeRevealedCell = (c: ConstructionContext, square: Square, piece: Piece, side: Side): Cells[number] => {
  contextWork(c, false, 512); const owned = requireRole<Piece>(piece, "piece");
  if (owned.type !== "q" || owned.color === color(side)) return constructionFail("CONSISTENCY");
  return publish({ square: atSquare(square), visibility: "revealed" as const, piece: owned }, "cell");
};
export const makeSighting = (c: ConstructionContext, square: Square, piece: Piece, observedTurn: number): Memory[number] => {
  contextWork(c, false, 512); requireRole(piece, "piece");
  return publish({ square: atSquare(square), piece, observedTurn: integer(observedTurn, 45) }, "sighting");
};
export const makeOwnPiece = (c: ConstructionContext, square: Square, piece: Piece): Own['pieces'][number] => {
  contextWork(c, false, 512); requireRole(piece, "piece"); return publish({ square: atSquare(square), piece }, "own-piece");
};
export const makeOwnUnit = (c: ConstructionContext, id: string, square: Square, type: Piece['type'], paidBasis: number, replacement: number): Unit => {
  contextWork(c, false, 768); const valid = kindType(type);
  if (integer(replacement, 9) !== replacementValue(valid)) return constructionFail("DERIVED");
  return publish({ id: identifier(id, sideOfId(id), "unit"), square: atSquare(square), type: valid, paidBasis: integer(paidBasis, 9), replacementValue: replacement }, "own-unit");
};
export const makeOwnMine = (c: ConstructionContext, mineId: string, square: Square): Mine => {
  contextWork(c, false, 512); const valid = identifier(mineId, sideOfId(mineId), "mine"), at = atSquare(square);
  if (valid.includes(":opening:") && valid !== `${sideOfId(valid)}:mine:opening:${at}`) return constructionFail("IDENTITY");
  return publish({ mineId: valid, square: at }, "own-mine");
};
export const makeActionRef = (c: ConstructionContext, planningOrdinal: number, acceptedActionOrdinal: number): ActionRef => {
  contextWork(c, false, 512); return publish({ planningOrdinal: integer(planningOrdinal, 63), acceptedActionOrdinal: integer(acceptedActionOrdinal, 3) }, "action-ref");
};
export const makeMaterializedDisposition = (c: ConstructionContext, lineageId: string): Receipt['disposition'] => {
  contextWork(c, false, 512); identifier(lineageId, sideOfId(lineageId), "unit");
  if (!lineageId.includes(":created:")) return constructionFail("IDENTITY");
  return publish({ kind: "materialized" as const, lineageId }, "disposition");
};
export const makeUnmaterializedDisposition = (c: ConstructionContext): Receipt['disposition'] => {
  contextWork(c, false, 512); return publish({ kind: "unmaterialized" as const }, "disposition");
};
export const makePaidReceipt = (c: ConstructionContext, receiptId: string, actionRef: ActionRef, unit: Exclude<Piece['type'], "k">,
  requestedSquare: Square, minerals: number, disposition: Receipt['disposition']): Receipt => {
  contextWork(c, false, 1024); requireRole(actionRef, "action-ref"); requireRole(disposition, "disposition");
  const side = sideOfId(receiptId), validUnit = spawnType(unit);
  identifier(receiptId, side, "receipt");
  if (receiptId !== `${side}:receipt:${actionRef.planningOrdinal}:${actionRef.acceptedActionOrdinal}` || minerals !== UNIT_COST[validUnit] ||
    disposition.kind === "materialized" && sideOfId(disposition.lineageId) !== side) return constructionFail("DERIVED");
  return publish({ receiptId, actionRef, unit: validUnit, requestedSquare: atSquare(requestedSquare), minerals, disposition }, "receipt");
};

export const beginCells64 = (c: ConstructionContext) => beginCursor<Cells[number]>(c, "cells", 64, 64);
export const appendCells64 = (c: ConstructionContext, cursor: OwnedCursor<Cells[number]>, child: Cells[number]) => appendCursor(c, cursor, "cells", child);
export const finishCells64 = (c: ConstructionContext, cursor: OwnedCursor<Cells[number]>) => finishCursor<Cells[number]>(c, cursor, "cells");
export const beginChanges64 = (c: ConstructionContext) => beginCursor<Cells[number]>(c, "changes", 1, 64);
export const appendChanges64 = (c: ConstructionContext, cursor: OwnedCursor<Cells[number]>, child: Cells[number]) => appendCursor(c, cursor, "changes", child);
export const finishChanges64 = (c: ConstructionContext, cursor: OwnedCursor<Cells[number]>) => finishCursor<Cells[number]>(c, cursor, "changes");
export const beginMemory64 = (c: ConstructionContext) => beginCursor<Memory[number]>(c, "memory", 0, 64);
export const appendMemory64 = (c: ConstructionContext, cursor: OwnedCursor<Memory[number]>, child: Memory[number]) => appendCursor(c, cursor, "memory", child);
export const finishMemory64 = (c: ConstructionContext, cursor: OwnedCursor<Memory[number]>) => finishCursor<Memory[number]>(c, cursor, "memory");
export const beginSquareSet64 = (c: ConstructionContext) => beginCursor<Square>(c, "squares", 0, 64);
export const appendSquareSet64 = (c: ConstructionContext, cursor: OwnedCursor<Square>, child: Square) => appendCursor(c, cursor, "squares", child);
export const finishSquareSet64 = (c: ConstructionContext, cursor: OwnedCursor<Square>) => finishCursor<Square>(c, cursor, "squares");
export const beginOwnPieces64 = (c: ConstructionContext) => beginCursor<Own['pieces'][number]>(c, "own-pieces", 1, 64);
export const appendOwnPieces64 = (c: ConstructionContext, cursor: OwnedCursor<Own['pieces'][number]>, child: Own['pieces'][number]) => appendCursor(c, cursor, "own-pieces", child);
export const finishOwnPieces64 = (c: ConstructionContext, cursor: OwnedCursor<Own['pieces'][number]>) => finishCursor<Own['pieces'][number]>(c, cursor, "own-pieces");
export const beginOwnUnits64 = (c: ConstructionContext) => beginCursor<Unit>(c, "own-units", 1, 64);
export const appendOwnUnits64 = (c: ConstructionContext, cursor: OwnedCursor<Unit>, child: Unit) => appendCursor(c, cursor, "own-units", child);
export const finishOwnUnits64 = (c: ConstructionContext, cursor: OwnedCursor<Unit>) => finishCursor<Unit>(c, cursor, "own-units");
export const beginOwnMines3 = (c: ConstructionContext) => beginCursor<Mine>(c, "own-mines", 0, 3);
export const appendOwnMines3 = (c: ConstructionContext, cursor: OwnedCursor<Mine>, child: Mine) => appendCursor(c, cursor, "own-mines", child);
export const finishOwnMines3 = (c: ConstructionContext, cursor: OwnedCursor<Mine>) => finishCursor<Mine>(c, cursor, "own-mines");
export const beginReceipts64 = (c: ConstructionContext) => beginCursor<Receipt>(c, "receipts", 0, 64);
export const appendReceipts64 = (c: ConstructionContext, cursor: OwnedCursor<Receipt>, child: Receipt) => appendCursor(c, cursor, "receipts", child);
export const finishReceipts64 = (c: ConstructionContext, cursor: OwnedCursor<Receipt>) => finishCursor<Receipt>(c, cursor, "receipts");
export const beginRetiredOwnIds128 = (c: ConstructionContext, side: Side) => beginCursor<string>(c, "retired-units", 0, 128, false, color(side) === "w" ? 0 : 1);
export const appendRetiredOwnIds128 = (c: ConstructionContext, cursor: OwnedCursor<string>, child: string) => appendCursor(c, cursor, "retired-units", child);
export const finishRetiredOwnIds128 = (c: ConstructionContext, cursor: OwnedCursor<string>) => finishCursor<string>(c, cursor, "retired-units");
export const beginRetiredMineIds195 = (c: ConstructionContext, side: Side) => beginCursor<string>(c, "retired-mines", 0, 195, false, color(side) === "w" ? 0 : 1);
export const appendRetiredMineIds195 = (c: ConstructionContext, cursor: OwnedCursor<string>, child: string) => appendCursor(c, cursor, "retired-mines", child);
export const finishRetiredMineIds195 = (c: ConstructionContext, cursor: OwnedCursor<string>) => finishCursor<string>(c, cursor, "retired-mines");
export const beginEvents2048 = (c: ConstructionContext) => beginCursor<Event>(c, "events", 0, 2048);
export const appendEvents2048 = (c: ConstructionContext, cursor: OwnedCursor<Event>, child: Event) => appendCursor(c, cursor, "events", child);
export const finishEvents2048 = (c: ConstructionContext, cursor: OwnedCursor<Event>) => finishCursor<Event>(c, cursor, "events");
export const beginActions65 = (c: ConstructionContext) => beginCursor<ScActionInput>(c, "actions", 0, 65);
export const appendActions65 = (c: ConstructionContext, cursor: OwnedCursor<ScActionInput>, child: ScActionInput) => appendCursor(c, cursor, "actions", child);
export const finishActions65 = (c: ConstructionContext, cursor: OwnedCursor<ScActionInput>) => finishCursor<ScActionInput>(c, cursor, "actions");

export const makeEnemyLoss = (c: ConstructionContext, confirmedUnitCount: number, replacementLowerBound: number): Ledger['enemyLoss'] => {
  contextWork(c, false, 512); integer(confirmedUnitCount, 128); integer(replacementLowerBound, 1152);
  if (replacementLowerBound < confirmedUnitCount || replacementLowerBound > confirmedUnitCount * 9) return constructionFail("CONSERVATION");
  return publish({ confirmedUnitCount, replacementLowerBound, paidLowerBound: 0, upper: "unknown", completeness: "witnessed-only" } as const, "enemy-loss");
};
export const makeEconomicLedger = (c: ConstructionContext, side: Side, ownPaidDebits: number, ownPaidSurviving: number, ownPaidDestroyed: number,
  ownPaidWasted: number, ownReplacementDestroyed: number, enemyLoss: Ledger['enemyLoss'], receipts: readonly Receipt[], retiredOwnIds: readonly string[]): Ledger => {
  contextWork(c, false, 1024); const validSide = color(side);
  requireRole(enemyLoss, "enemy-loss"); requireRole(receipts, "receipts"); requireRole(retiredOwnIds, "retired-units");
  contextWork(c, false, 64 * receipts.length + 32 * retiredOwnIds.length + 32 * receipts.length * receipts.length);
  integer(ownPaidDebits, 576); integer(ownPaidSurviving, 576); integer(ownPaidDestroyed, 576); integer(ownPaidWasted, 576); integer(ownReplacementDestroyed, 1152);
  let debits = 0, destroyed = 0, wasted = 0;
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i]!; identifier(receipt.receiptId, validSide, "receipt"); debits += receipt.minerals;
    if (receipt.disposition.kind === "unmaterialized") wasted += receipt.minerals;
    else {
      identifier(receipt.disposition.lineageId, validSide, "unit");
      let birthOrder = 1;
      for (let j = 0; j < receipts.length; j++) if (receipts[j]!.disposition.kind === "materialized" && receipts[j]!.actionRef.planningOrdinal < receipt.actionRef.planningOrdinal) birthOrder++;
      if (receipt.disposition.lineageId !== `${validSide}:unit:created:${birthOrder}`) return constructionFail("IDENTITY");
      if (retiredOwnIds.includes(receipt.disposition.lineageId)) destroyed += receipt.minerals;
    }
    for (let j = 0; j < i; j++) if (receipts[j]!.actionRef.planningOrdinal === receipt.actionRef.planningOrdinal) return constructionFail("IDENTITY");
  }
  for (const retired of retiredOwnIds) {
    identifier(retired, validSide, "unit");
    if (retired.includes(":created:") && !receipts.some(r => r.disposition.kind === "materialized" && r.disposition.lineageId === retired)) return constructionFail("IDENTITY");
  }
  if (debits !== ownPaidDebits || destroyed !== ownPaidDestroyed || wasted !== ownPaidWasted || ownPaidDebits !== ownPaidSurviving + destroyed + wasted ||
    ownReplacementDestroyed < retiredOwnIds.length || ownReplacementDestroyed > retiredOwnIds.length * 9) return constructionFail("CONSERVATION");
  return publish({ version: "challenge-economic-ledger-v1", side: validSide, ownPaidDebits, ownPaidSurviving, ownPaidDestroyed, ownPaidWasted,
    ownReplacementDestroyed, enemyLoss, receipts, retiredOwnIds } as const, "ledger");
};
export const makeOwnState = (c: ConstructionContext, minerals: number, gas: number, gasIncome: number, ccLives: number,
  pieces: Own['pieces'], mines: readonly Square[], siegedTanks: readonly Square[]): Own => {
  contextWork(c, false, 1024); requireRole(pieces, "own-pieces"); requireRole(mines, "squares"); requireRole(siegedTanks, "squares");
  integer(minerals, 12); integer(gasIncome, 3); integer(gas, gasIncome); integer(ccLives, 3);
  if (mines.length > 3) return constructionFail("CARDINALITY");
  contextWork(c, false, 16 * pieces.length * (siegedTanks.length + 1));
  if (pieces.filter(p => p.piece.type === "k").length !== 1 || siegedTanks.some(s => !pieces.some(p => p.square === s && p.piece.type === "r"))) return constructionFail("CONSISTENCY");
  return publish({ minerals, gas, gasIncome, ccLives, pieces, mines, siegedTanks }, "own");
};
const samePiece = (a: Piece, b: Piece): boolean => a.type === b.type && a.color === b.color;
const sameCells = (a: Cells, b: Cells): boolean => {
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!, y = b[i]!;
    if (x.square !== y.square || x.visibility !== y.visibility) return false;
    if (x.visibility !== "unknown" && y.visibility !== "unknown" && (x.piece === null || y.piece === null ? x.piece !== y.piece : !samePiece(x.piece, y.piece))) return false;
  }
  return a.length === b.length;
};
const sameMemory = (a: Memory, b: Memory): boolean => a.length === b.length && a.every((x, i) => x.square === b[i]!.square && x.observedTurn === b[i]!.observedTurn && samePiece(x.piece, b[i]!.piece));
export const makeSnapshotV2 = (c: ConstructionContext, side: Side, turn: number, own: Own, cells: Cells, memory: Memory,
  ownUnitLineage: readonly Unit[], ownMineLineage: readonly Mine[], economicState: Ledger): AuthorizedSnapshotV2 => {
  contextWork(c, false, 1024); color(side); integer(turn, 45);
  requireRole(own, "own"); requireRole(cells, "cells"); requireRole(memory, "memory"); requireRole(ownUnitLineage, "own-units"); requireRole(ownMineLineage, "own-mines"); requireRole(economicState, "ledger");
  contextWork(c, false, 32 * 64 * (memory.length + own.pieces.length + 1) + 32 * ownUnitLineage.length * (economicState.receipts.length + ownUnitLineage.length + 1));
  if (economicState.side !== side || ownUnitLineage.length !== own.pieces.length) return constructionFail("CONSISTENCY");
  let paid = 0, visibleOwn = 0;
  for (const cell of cells) {
    if (cell.visibility === "unknown") continue;
    if (cell.visibility === "revealed" && (cell.piece.type !== "q" || cell.piece.color === side)) return constructionFail("CONSISTENCY");
    const remembered = memory.find(m => m.square === cell.square);
    if (cell.piece !== null && cell.piece.color !== side) {
      if (!remembered || remembered.observedTurn !== turn || !samePiece(cell.piece, remembered.piece)) return constructionFail("CONSISTENCY");
    } else if (remembered) return constructionFail("CONSISTENCY");
    if (cell.piece?.color === side) {
      visibleOwn++;
      if (!own.pieces.some(p => p.square === cell.square && samePiece(p.piece, cell.piece!))) return constructionFail("CONSISTENCY");
    }
  }
  if (visibleOwn !== own.pieces.length || memory.some(m => m.piece.color === side || m.observedTurn > turn)) return constructionFail("CONSISTENCY");
  for (let i = 0; i < ownUnitLineage.length; i++) {
    const unit = ownUnitLineage[i]!, piece = own.pieces[i]!;
    identifier(unit.id, side, "unit");
    if (piece.piece.color !== side || piece.square !== unit.square || piece.piece.type !== unit.type || economicState.retiredOwnIds.includes(unit.id) ||
      ownUnitLineage.some((u, j) => j !== i && u.id === unit.id)) return constructionFail("IDENTITY");
    const receipt = economicState.receipts.find(r => r.disposition.kind === "materialized" && r.disposition.lineageId === unit.id);
    if (unit.id.includes(":opening:") ? unit.paidBasis !== 0 || receipt !== undefined : !receipt || receipt.minerals !== unit.paidBasis) return constructionFail("CONSERVATION");
    if (unit.type === "k" && !unit.id.includes(":opening:")) return constructionFail("IDENTITY");
    paid += unit.paidBasis;
  }
  for (const receipt of economicState.receipts) if (receipt.disposition.kind === "materialized" && !ownUnitLineage.some(u => receipt.disposition.kind === "materialized" && u.id === receipt.disposition.lineageId) &&
    !economicState.retiredOwnIds.includes(receipt.disposition.lineageId)) return constructionFail("IDENTITY");
  if (paid !== economicState.ownPaidSurviving) return constructionFail("CONSERVATION");
  let uniqueMines = 0, previousSquare = "";
  for (let i = 0; i < ownMineLineage.length; i++) {
    const mine = ownMineLineage[i]!; identifier(mine.mineId, side, "mine");
    if (ownMineLineage.some((m, j) => i !== j && m.mineId === mine.mineId)) return constructionFail("IDENTITY");
    if (mine.square !== previousSquare) uniqueMines++;
    previousSquare = mine.square;
    if (!own.mines.includes(mine.square)) return constructionFail("CONSISTENCY");
  }
  if (uniqueMines !== own.mines.length || own.mines.some(s => cells.find(x => x.square === s)!.visibility !== "lit")) return constructionFail("CONSISTENCY");
  return publish({ version: "challenge-observation-v2", side, turn, own, cells, memory, ownUnitLineage, ownMineLineage, economicState } as const, "snapshot-v2");
};
export const makeHistory = (c: ConstructionContext, snapshot: AuthorizedSnapshotV2, economicState: Ledger, everLit: readonly Square[]): History => {
  contextWork(c, false, 1024); requireSnapshotV2(snapshot); requireRole(economicState, "ledger"); requireRole(everLit, "squares");
  contextWork(c, false, 32 * 64 * (everLit.length + 1) + 1024 * (economicState.receipts.length + snapshot.economicState.receipts.length + 1));
  if (!sameOwnedValue(economicState, snapshot.economicState) || snapshot.cells.some(x => x.visibility === "lit" && !everLit.includes(x.square))) return constructionFail("CONSISTENCY");
  return publish({ version: "challenge-history-v2", currentAuthorizedSnapshotV2: snapshot, economicState: snapshot.economicState, everLit } as const, "history");
};
export const makeMineAudit = (c: ConstructionContext, liveOwnMines: readonly Mine[], retiredOwnMineIdsSorted: readonly string[], ownMineCreationCounter: number): MineAudit => {
  contextWork(c, false, 1024); requireRole(liveOwnMines, "own-mines"); requireRole(retiredOwnMineIdsSorted, "retired-mines"); integer(ownMineCreationCounter, 192);
  contextWork(c, false, 32 * (liveOwnMines.length + retiredOwnMineIdsSorted.length) * (ownMineCreationCounter + 1));
  let created = 0;
  const side = liveOwnMines.length !== 0 ? sideOfId(liveOwnMines[0]!.mineId) : retiredOwnMineIdsSorted.length !== 0 ? sideOfId(retiredOwnMineIdsSorted[0]) : undefined;
  for (const mine of liveOwnMines) {
    if (side !== undefined) identifier(mine.mineId, side, "mine");
    if (retiredOwnMineIdsSorted.includes(mine.mineId)) return constructionFail("IDENTITY");
    if (mine.mineId.includes(":created:")) created++;
  }
  for (const id of retiredOwnMineIdsSorted) { if (side !== undefined) identifier(id, side, "mine"); if (id.includes(":created:")) created++; }
  if (created !== ownMineCreationCounter || liveOwnMines.length + retiredOwnMineIdsSorted.length - created > 3) return constructionFail("IDENTITY");
  for (let i = 1; i <= ownMineCreationCounter; i++) if (!liveOwnMines.some(m => m.mineId.endsWith(`:created:${i}`)) && !retiredOwnMineIdsSorted.some(id => id.endsWith(`:created:${i}`))) return constructionFail("IDENTITY");
  return publish({ liveOwnMines, retiredOwnMineIdsSorted, ownMineCreationCounter }, "mine-audit");
};

const eventEntry = (c: ConstructionContext, seq: number): number => { contextWork(c, false, 1024); return integer(seq, maximumSafeInteger, 1); };
export const makeOwnPaidReceiptEvent = (c: ConstructionContext, seq: number, receiptId: string, actionRef: ActionRef, unit: Exclude<Piece['type'], "k">, requestedSquare: Square, minerals: number) => {
  eventEntry(c, seq); requireRole(actionRef, "action-ref"); const side = sideOfId(receiptId), type = spawnType(unit); identifier(receiptId, side, "receipt");
  if (receiptId !== `${side}:receipt:${actionRef.planningOrdinal}:${actionRef.acceptedActionOrdinal}` || minerals !== UNIT_COST[type]) return constructionFail("DERIVED");
  return publish({ kind: "own-paid-receipt", seq, receiptId, actionRef, unit: type, requestedSquare: atSquare(requestedSquare), minerals } as const, "event");
};
export const makeOwnGasDebitedEvent = (c: ConstructionContext, seq: number, actionRef: ActionRef, gas: number) => {
  eventEntry(c, seq); requireRole(actionRef, "action-ref"); return publish({ kind: "own-gas-debited", seq, actionRef, gas: integer(gas, 3, 1) } as const, "event");
};
export const makeOwnUnitEndowedEvent = (c: ConstructionContext, seq: number, id: string, square: Square, type: Piece['type']) => {
  eventEntry(c, seq); identifier(id, sideOfId(id), "unit"); return publish({ kind: "own-unit-endowed", seq, id, square: atSquare(square), type: kindType(type), paidBasis: 0 } as const, "event");
};
export const makeOwnUnitCreatedEvent = (c: ConstructionContext, seq: number, lineageId: string, receiptId: string, square: Square, type: Exclude<Piece['type'], "k">) => {
  eventEntry(c, seq); const side = sideOfId(lineageId); identifier(lineageId, side, "unit"); identifier(receiptId, side, "receipt");
  return publish({ kind: "own-unit-created", seq, lineageId, receiptId, square: atSquare(square), type: spawnType(type) } as const, "event");
};
export const makeOwnDeploymentUnmaterializedEvent = (c: ConstructionContext, seq: number, receiptId: string, paidMinerals: number) => {
  eventEntry(c, seq); identifier(receiptId, sideOfId(receiptId), "receipt");
  return publish({ kind: "own-deployment-unmaterialized", seq, receiptId, paidMinerals: integer(paidMinerals, 9, 1) } as const, "event");
};
export const makeOwnUnitMovedEvent = (c: ConstructionContext, seq: number, id: string, from: Square, to: Square) => {
  eventEntry(c, seq); identifier(id, sideOfId(id), "unit"); atSquare(from); atSquare(to); if (from === to) return constructionFail("CONSISTENCY");
  return publish({ kind: "own-unit-moved", seq, id, from, to } as const, "event");
};
export const makeOwnUnitTransformedEvent = (c: ConstructionContext, seq: number, id: string, fromType: Piece['type'], toType: Exclude<Piece['type'], "k">) => {
  eventEntry(c, seq); identifier(id, sideOfId(id), "unit"); kindType(fromType); spawnType(toType); if (fromType === toType) return constructionFail("CONSISTENCY");
  return publish({ kind: "own-unit-transformed", seq, id, fromType, toType, paidDelta: 0 } as const, "event");
};
export const makeOwnUnitModeChangedEvent = (c: ConstructionContext, seq: number, id: string, mode: "tank" | "siege") => {
  eventEntry(c, seq); identifier(id, sideOfId(id), "unit"); if (mode !== "tank" && mode !== "siege") return constructionFail("SCHEMA");
  return publish({ kind: "own-unit-mode-changed", seq, id, mode } as const, "event");
};
export const makeOwnUnitDestroyedEvent = (c: ConstructionContext, seq: number, id: string, typeAtLoss: Exclude<Piece['type'], "k">, square: Square, retiredPaidBasis: number) => {
  eventEntry(c, seq); identifier(id, sideOfId(id), "unit");
  return publish({ kind: "own-unit-destroyed", seq, id, typeAtLoss: spawnType(typeAtLoss), square: atSquare(square), retiredPaidBasis: integer(retiredPaidBasis, 9) } as const, "event");
};
export const makeOwnMineEndowedEvent = (c: ConstructionContext, seq: number, mineId: string, square: Square) => {
  eventEntry(c, seq); identifier(mineId, sideOfId(mineId), "mine"); return publish({ kind: "own-mine-endowed", seq, mineId, actionRef: null, square: atSquare(square) } as const, "event");
};
export const makeOwnMineCreatedEvent = (c: ConstructionContext, seq: number, mineId: string, actionRef: ActionRef, square: Square) => {
  eventEntry(c, seq); identifier(mineId, sideOfId(mineId), "mine"); requireRole(actionRef, "action-ref");
  return publish({ kind: "own-mine-created", seq, mineId, actionRef, square: atSquare(square) } as const, "event");
};
export const makeOwnMineRemovedEvent = (c: ConstructionContext, seq: number, mineId: string) => {
  eventEntry(c, seq); identifier(mineId, sideOfId(mineId), "mine"); return publish({ kind: "own-mine-removed", seq, mineId } as const, "event");
};
export const makeOwnIncomeEvent = (c: ConstructionContext, seq: number, actualCreditedMinerals: number) => {
  eventEntry(c, seq); return publish({ kind: "own-income", seq, actualCreditedMinerals: integer(actualCreditedMinerals, 3) } as const, "event");
};
export const makeOwnCCLivesChangedEvent = (c: ConstructionContext, seq: number, before: number, after: number) => {
  eventEntry(c, seq); integer(before, 3); integer(after, 3); if (after >= before) return constructionFail("CONSISTENCY");
  return publish({ kind: "own-cc-lives-changed", seq, before, after } as const, "event");
};
export const makeEnemyUnitDestructionWitnessedEvent = (c: ConstructionContext, seq: number, witnessId: string, square: Square, type: Exclude<Piece['type'], "k">, replacementLowerBound: number) => {
  eventEntry(c, seq); identifier(witnessId, sideOfId(witnessId), "witness"); const valid = spawnType(type);
  if (replacementLowerBound !== UNIT_COST[valid]) return constructionFail("DERIVED");
  return publish({ kind: "enemy-unit-destruction-witnessed", seq, witnessId, square: atSquare(square), type: valid, replacementLowerBound, paidLowerBound: 0 } as const, "event");
};
export const makeVisionWitnessEvent = (c: ConstructionContext, seq: number, turn: number, changes: Cells) => {
  eventEntry(c, seq); requireRole(changes, "changes");
  return publish({ kind: "vision-witness", seq, turn: integer(turn, 45), changes } as const, "event");
};

const actionEntry = (c: ConstructionContext, timing: unknown, side: Side, from: Square): "B" | "F" => {
  contextWork(c, false, 1024); color(side); atSquare(from);
  return timing === "B" || timing === "F" ? timing : constructionFail("SCHEMA");
};
export const makeClassicalAction = (c: ConstructionContext, side: Side, from: Square, to: Square, promotion?: Exclude<Piece['type'], "k">): ScActionInput => {
  contextWork(c, false, 1024); color(side); atSquare(from); atSquare(to);
  return promotion === undefined ? publish({ __proto__: null, kind: "classical", timing: "C", color: side, from, to } as const, "action") :
    publish({ __proto__: null, kind: "classical", timing: "C", color: side, from, to, promotion: spawnType(promotion) } as const, "action");
};
export const makeDeployAction = (c: ConstructionContext, timing: "B" | "F", side: Side, from: Square, to: Square, unit: Exclude<Piece['type'], "k">): ScActionInput => {
  actionEntry(c, timing, side, from); return publish({ __proto__: null, kind: "deploy", timing, color: side, from, to: atSquare(to), unit: spawnType(unit) } as const, "action");
};
export const makeStimStepAction = (c: ConstructionContext, timing: "B" | "F", side: Side, from: Square, to: Square, promotion?: Exclude<Piece['type'], "k">): ScActionInput => {
  actionEntry(c, timing, side, from); atSquare(to);
  return promotion === undefined ? publish({ __proto__: null, kind: "stimStep", timing, color: side, from, to } as const, "action") :
    publish({ __proto__: null, kind: "stimStep", timing, color: side, from, to, promotion: spawnType(promotion) } as const, "action");
};
export const makeSpiderMineAction = (c: ConstructionContext, timing: "B" | "F", side: Side, from: Square, to?: Square): ScActionInput => {
  actionEntry(c, timing, side, from); return to === undefined ? publish({ __proto__: null, kind: "spiderMine", timing, color: side, from } as const, "action") :
    publish({ __proto__: null, kind: "spiderMine", timing, color: side, from, to: atSquare(to) } as const, "action");
};
export const makeCharonMissilesAction = (c: ConstructionContext, timing: "B" | "F", side: Side, from: Square, to: Square): ScActionInput => {
  actionEntry(c, timing, side, from); return publish({ __proto__: null, kind: "charonMissiles", timing, color: side, from, to: atSquare(to) } as const, "action");
};
export const makeSiegeModeAction = (c: ConstructionContext, timing: "B" | "F", side: Side, from: Square, to?: Square): ScActionInput => {
  actionEntry(c, timing, side, from); return to === undefined ? publish({ __proto__: null, kind: "siegeMode", timing, color: side, from } as const, "action") :
    publish({ __proto__: null, kind: "siegeMode", timing, color: side, from, to: atSquare(to) } as const, "action");
};
export const makeTacticalJumpAction = (c: ConstructionContext, timing: "B" | "F", side: Side, from: Square, to: Square): ScActionInput => {
  actionEntry(c, timing, side, from); return publish({ __proto__: null, kind: "tacticalJump", timing, color: side, from, to: atSquare(to) } as const, "action");
};

export const constructOwnedNumber = (value: number): OwnedFloat64Hex => {
  if (typeof value !== "number" || !finite(value)) return rejectOwned("FLOAT64");
  const view = new DenseDataView(new DenseArrayBuffer(8));
  apply(dataSetNumber, view, [0, value, false]);
  const slots = { __proto__: null, length: 16 }, digits = dense(slots, () => ""), hex = "0123456789abcdef";
  for (let i = 0; i < 8; i++) {
    const byte = apply(dataGetByte, view, [i]) as number;
    digits[2 * i] = hex[byte >>> 4]!;
    digits[2 * i + 1] = hex[byte & 15]!;
  }
  const result = publish({ hex: apply(joinDigits, digits, [""]) as string }, "float64");
  setNumericValue(result, value);
  return result;
};
const hNumber = (value: unknown, low = -Number.MAX_VALUE, high = Number.MAX_VALUE): number => {
  const h = requireFloat64Hex(value);
  let result = getNumericValue(h);
  if (result === undefined) {
    if (paying) consumeWorkBlock(paying.meter, "float64-decode", 1, "$.construction.float64");
    const view = new DenseDataView(new DenseArrayBuffer(8));
    for (let i = 0; i < 8; i++) {
      let byte = 0;
      for (let j = 0; j < 2; j++) {
        const code = apply(characterCode, h.hex, [2 * i + j]) as number;
        byte = 16 * byte + (code <= 57 ? code - 48 : code - 87);
      }
      apply(dataSet, view, [i, byte]);
    }
    result = apply(dataGet, view, [0, false]) as number;
    setNumericValue(h, result);
  }
  if (!finite(result) || result < low || result > high) return constructionFail("NUMBER");
  return result;
};
const bandWidth = (band: number): number => (band === 18 ? 577 : BAND_STARTS[band + 1]!) - BAND_STARTS[band]!;
export const beginConditional = (c: ConstructionContext, bandwidth: number) => {
  contextWork(c, false, 256); integer(bandwidth, 128, 1);
  let valid = false;
  for (let i = 0; i < 19; i++) if (bandWidth(i) === bandwidth) valid = true;
  if (!valid) return constructionFail("CARDINALITY");
  return beginCursor<OwnedFloat64Hex>(c, "conditional", bandwidth, bandwidth);
};
export const appendConditional = (c: ConstructionContext, cursor: OwnedCursor<OwnedFloat64Hex>, child: OwnedFloat64Hex) => appendCursor(c, cursor, "conditional", child);
export const finishConditional = (c: ConstructionContext, cursor: OwnedCursor<OwnedFloat64Hex>): readonly OwnedFloat64Hex[] => {
  const storage = cursorFor(c, cursor, "conditional"); contextWork(c, false, 256 + 64 * storage.count);
  let sum = 0;
  for (const value of storage.values) sum += hNumber(value, 0, 1);
  if (abs(sum - 1) > 1e-12) return constructionFail("NORMALIZATION");
  return finishCursor<OwnedFloat64Hex>(c, cursor, "conditional");
};
export const makeComponent = (c: ConstructionContext, bank: number, band: number, mass: OwnedFloat64Hex, conditional: readonly OwnedFloat64Hex[]): Component => {
  contextWork(c, false, 1024); requireFloat64Hex(mass); requireRole(conditional, "conditional"); integer(bank, 12); integer(band, 18);
  if (!(hNumber(mass, 0, 1) > 0) || conditional.length !== bandWidth(band)) return constructionFail("NORMALIZATION");
  return publish({ bank, band, mass, conditional }, "component");
};
export const beginComponents247 = (c: ConstructionContext) => beginCursor<Component>(c, "components", 1, 247);
export const appendComponents247 = (c: ConstructionContext, cursor: OwnedCursor<Component>, child: Component) => appendCursor(c, cursor, "components", child);
export const finishComponents247 = (c: ConstructionContext, cursor: OwnedCursor<Component>): readonly Component[] => {
  const storage = cursorFor(c, cursor, "components"); contextWork(c, false, 256 + 64 * storage.count);
  let sum = 0;
  for (const value of storage.values) sum += hNumber((value as Component).mass, 0, 1);
  if (abs(sum - 1) > 1e-12) return constructionFail("NORMALIZATION");
  return finishCursor<Component>(c, cursor, "components");
};
export const beginPublicSupport7501 = (c: ConstructionContext) => beginCursor<boolean>(c, "support", 7501, 7501);
export const appendPublicSupport7501 = (c: ConstructionContext, cursor: OwnedCursor<boolean>, child: boolean) => appendCursor(c, cursor, "support", child);
export const finishPublicSupport7501 = (c: ConstructionContext, cursor: OwnedCursor<boolean>): readonly boolean[] => {
  const storage = cursorFor(c, cursor, "support");
  if (storage.support!.count === 0) return constructionFail("CONSISTENCY");
  const result = finishCursor<boolean>(c, cursor, "support");
  setSupportSummary(result, freeze(storage.support!));
  return result;
};
const supportSummary = (value: unknown): Readonly<SupportSummary> => {
  const support = requirePublicSupport(value), summary = getSupportSummary(support);
  return summary ?? constructionFail("PROVENANCE");
};
export const publicSupportCanBirth = (c: Meter, value: readonly boolean[]): boolean => {
  contextWork(c, false, 128);
  return supportSummary(value).canBirth;
};
declare const evaluationSupportBrand: unique symbol;
export type EvaluationSupportDraft = Readonly<{ [evaluationSupportBrand]: "transaction-local-economic-support" }>;
type EvaluationSupportStorage = { transaction: Transaction; values: boolean[]; live: boolean };
const evaluationSupports = new WeakMap<object, EvaluationSupportStorage>();
const getEvaluationSupport = WeakMap.prototype.get.bind(evaluationSupports);
const setEvaluationSupport = WeakMap.prototype.set.bind(evaluationSupports);
const evaluationSupportFor = (c: Meter, value: unknown): EvaluationSupportStorage => {
  const transaction = activeFor(c);
  if (value === null || typeof value !== "object") return rejectLedger(transaction.ledger, "TICKET");
  const storage = getEvaluationSupport(value);
  if (!storage || !storage.live || storage.transaction !== transaction || transaction.evaluationSupport !== storage) {
    return rejectLedger(transaction.ledger, "TICKET");
  }
  return storage;
};
export const beginEvaluationSupport7501 = (c: Meter): EvaluationSupportDraft => {
  const transaction = activeFor(c);
  if (transaction.evaluationSupport) return rejectLedger(transaction.ledger, "TICKET");
  consumeWorkBlock(c, "support-initialize", 7501);
  const slots = { __proto__: null, length: 7501 }, values = dense(slots, () => false);
  const result = freeze(create(null)) as EvaluationSupportDraft;
  const storage: EvaluationSupportStorage = { transaction, values, live: true };
  setEvaluationSupport(result, storage); transaction.evaluationSupport = storage;
  return result;
};
export const putEvaluationSupport = (c: Meter, draft: EvaluationSupportDraft, index: number, value: boolean): void => {
  const storage = evaluationSupportFor(c, draft);
  consumeWorkBlock(c, "support-write", 1);
  integer(index, 7500);
  if (typeof value !== "boolean") return constructionFail("SCHEMA");
  storage.values[index] = value;
};
export const readEvaluationSupport = (c: Meter, draft: EvaluationSupportDraft, index: number): boolean => {
  const storage = evaluationSupportFor(c, draft);
  consumeWorkBlock(c, "support-read", 1);
  return storage.values[integer(index, 7500)]!;
};
export const finishEvaluationSupport7501 = (c: Meter, draft: EvaluationSupportDraft): readonly boolean[] => {
  const storage = evaluationSupportFor(c, draft);
  consumeWorkBlock(c, "support-seal", 7501);
  const summary: SupportSummary = { count: 0, minimumD: 576, maximumD: 0, minimumPotential: 588, maximumPotential: 0, canBirth: false };
  for (let i = 0; i < 7501; i++) if (storage.values[i]) {
    const material = i % 577, potential = material + floor(i / 577);
    summary.count++;
    if (material < summary.minimumD) summary.minimumD = material;
    if (material > summary.maximumD) summary.maximumD = material;
    if (potential < summary.minimumPotential) summary.minimumPotential = potential;
    if (potential > summary.maximumPotential) summary.maximumPotential = potential;
    if (i >= 577) summary.canBirth = true;
  }
  if (summary.count === 0) return constructionFail("CONSISTENCY");
  storage.live = false; storage.transaction.evaluationSupport = undefined;
  const support = freeze(storage.values);
  register(support, "support"); setWireLength(support, 45007 - summary.count); setSupportSummary(support, freeze(summary));
  return support;
};
export const makeEconomicRecipe = (c: ConstructionContext, alpha: OwnedFloat64Hex): EconomicRecipe => {
  contextWork(c, true, 1024); requireFloat64Hex(alpha); if (alpha.hex !== "3fe0000000000000") return constructionFail("DERIVED");
  const slots = { __proto__: null, length: 19 };
  const bands = publish(dense(slots, (_, i) => BAND_STARTS[i]!), "band-starts") as unknown as typeof BAND_STARTS;
  const diagnosticHorizons = publish([1, 2, 3] as const, "horizons");
  return publish({ version: "starchess-economic-recipe-v1", supportVersion: "economic-accounting-relaxation-v1", graphVersion: "positive-headstock-suffix-v1",
    innovationVersion: "authorized-economic-innovation-v1", geometryVersion: "authorized-promotion-geometry-v1", calibrationVersion: "starchess-economic-calibration-v1",
    workCap: 1048576, materialCeiling: 576, bankCap: 12, bandStarts: bands, alpha, minimumGroups: 32, diagnosticHorizons } as const, "recipe");
};
export const makeTransitionRow = (c: ConstructionContext, s: number, created: number, w: number, g: number, d: number, count: OwnedFloat64Hex): TransitionRow => {
  contextWork(c, true, 1024); requireFloat64Hex(count); integer(s, 9); integer(created, 9); integer(w, 9); integer(g, 32); integer(d, 617);
  if (!(hNumber(count, 0, 14400) > 0) || ![0, 1, 3, 5, 9].includes(s) || created !== 0 && created !== s || w !== s - created || g % 2 !== 0) return constructionFail("CONSERVATION");
  return publish([s, created, w, g, d, count] as const, "transition-row");
};
export const makeEvidenceRow = (c: ConstructionContext, y1: number, y2: number, y3: number, count: OwnedFloat64Hex): EvidenceRow => {
  contextWork(c, true, 1024); requireFloat64Hex(count); if (!(hNumber(count, 0, 14400) > 0)) return constructionFail("NUMBER");
  return publish([integer(y1, 3), integer(y2, 3), integer(y3, 2), count] as const, "evidence-row");
};
export const beginTransitionRows8192 = (c: ConstructionContext) => beginCursor<TransitionRow>(c, "transition-rows", 0, 8192, true);
export const appendTransitionRows8192 = (c: ConstructionContext, cursor: OwnedCursor<TransitionRow>, child: TransitionRow) => appendCursor(c, cursor, "transition-rows", child);
export const finishTransitionRows8192 = (c: ConstructionContext, cursor: OwnedCursor<TransitionRow>) => finishCursor<TransitionRow>(c, cursor, "transition-rows");
export const beginEvidenceRows8192 = (c: ConstructionContext) => beginCursor<EvidenceRow>(c, "evidence-rows", 0, 8192, true);
export const appendEvidenceRows8192 = (c: ConstructionContext, cursor: OwnedCursor<EvidenceRow>, child: EvidenceRow) => appendCursor(c, cursor, "evidence-rows", child);
export const finishEvidenceRows8192 = (c: ConstructionContext, cursor: OwnedCursor<EvidenceRow>) => finishCursor<EvidenceRow>(c, cursor, "evidence-rows");
const tableFields = (level: number, bank: number | null, band: number | null, tier: number | null, groups: number, rows: readonly unknown[]): void => {
  integer(level, 3); integer(groups, 14400);
  if (level <= 2 ? bank === null : bank !== null) return constructionFail("SCHEMA");
  if (level === 0 ? band === null : band !== null) return constructionFail("SCHEMA");
  if (level <= 1 ? tier === null : tier !== null) return constructionFail("SCHEMA");
  if (bank !== null) integer(bank, 12); if (band !== null) integer(band, 18); if (tier !== null) integer(tier, 2);
  if (rows.length === 0 && groups !== 0 || rows.length > 0 && groups === 0) return constructionFail("CONSERVATION");
};
export const makeTransitionTable = (c: ConstructionContext, level: number, bank: number | null, band: number | null, tier: number | null, groups: number, rows: readonly TransitionRow[]): Table => {
  contextWork(c, true, 1024); requireRole(rows, "transition-rows"); tableFields(level, bank, band, tier, groups, rows);
  contextWork(c, true, 256 + rows.length * 128);
  for (const row of rows) {
    const maximumMaterial = band === null ? 576 : BAND_STARTS[band]! + bandWidth(band) - 1;
    const minimumMaterial = band === null ? 0 : BAND_STARTS[band]!;
    const gas = tier === null ? 3 : tier + 1, maximumPromotions = Math.min(4, 1 + gas - (row[0] > 0 ? 1 : 0), maximumMaterial + (row[1] === 1 ? 1 : 0));
    let feasibleGrowth = false;
    for (let a = 0; a <= maximumPromotions; a++) for (let b = 0; b <= maximumPromotions - a; b++) for (let d = 0; d <= maximumPromotions - a - b; d++)
      if (2 * a + 4 * b + 8 * d === row[3]) feasibleGrowth = true;
    if (row[0] > (bank ?? 12) || !feasibleGrowth || row[4] > maximumMaterial + row[1] + row[3] || minimumMaterial + row[1] + row[3] - row[4] > 576) return constructionFail("CONSERVATION");
  }
  return publish({ kind: "transition", level, bank, band, tier, groups, rows } as const, "table");
};
export const makeEvidenceTable = (c: ConstructionContext, level: number, bank: number | null, band: number | null, tier: number | null, groups: number, rows: readonly EvidenceRow[]): Table => {
  contextWork(c, true, 1024); requireRole(rows, "evidence-rows"); tableFields(level, bank, band, tier, groups, rows);
  return publish({ kind: "evidence", level, bank, band, tier, groups, rows } as const, "table");
};
export const beginTables1588 = (c: ConstructionContext) => beginCursor<Table>(c, "tables", 0, 1588, true);
export const appendTables1588 = (c: ConstructionContext, cursor: OwnedCursor<Table>, child: Table): void => {
  const storage = cursorFor(c, cursor, "tables"); requireRole(child, "table");
  if (storage.count > 0) {
    const prior = storage.values[storage.count - 1] as Table;
    const a = [prior.kind === "transition" ? 0 : 1, prior.level, prior.bank ?? -1, prior.band ?? -1, prior.tier ?? -1];
    const b = [child.kind === "transition" ? 0 : 1, child.level, child.bank ?? -1, child.band ?? -1, child.tier ?? -1];
    let order = 0;
    for (let i = 0; i < 5 && order === 0; i++) order = b[i]! - a[i]!;
    if (order <= 0) return constructionFail("ORDER");
  }
  if (storage.auxiliary + child.rows.length > 8192) return constructionFail("CARDINALITY");
  appendCursor(c, cursor, "tables", child); storage.auxiliary += child.rows.length;
};
export const finishTables1588 = (c: ConstructionContext, cursor: OwnedCursor<Table>) => finishCursor<Table>(c, cursor, "tables");
export const makePartitionBin = (c: ConstructionContext, turnLow: number, turnHigh: number, litLow: number, litHigh: number): Bin => {
  contextWork(c, true, 512);
  if (!(turnLow === 0 && turnHigh === 10 || turnLow === 11 && turnHigh === 20 || turnLow === 21 && turnHigh === 45) ||
    !(litLow === 0 && (litHigh === 15 || litHigh === 31 || litHigh === 64) || litLow === 16 && litHigh === 31 || litLow === 32 && (litHigh === 47 || litHigh === 64) || litLow === 48 && litHigh === 64)) return constructionFail("SCHEMA");
  return publish([turnLow, turnHigh, litLow, litHigh] as const, "bin");
};
export const beginPartition = (c: ConstructionContext) => beginCursor<Bin>(c, "partition", 3, 12, true);
export const appendPartition = (c: ConstructionContext, cursor: OwnedCursor<Bin>, child: Bin) => appendCursor(c, cursor, "partition", child);
export const finishPartition = (c: ConstructionContext, cursor: OwnedCursor<Bin>): readonly Bin[] => {
  const storage = cursorFor(c, cursor, "partition"); let tier = 0, nextLit = 0;
  const starts = [0, 11, 21], ends = [10, 20, 45];
  for (const item of storage.values) {
    const bin = item as Bin;
    if (tier > 2 || bin[0] !== starts[tier] || bin[1] !== ends[tier] || bin[2] !== nextLit) return constructionFail("ORDER");
    nextLit = bin[3] + 1;
    if (nextLit === 65) { tier++; nextLit = 0; }
  }
  if (tier !== 3 || nextLit !== 0) return constructionFail("CONSISTENCY");
  return finishCursor<Bin>(c, cursor, "partition");
};
export const beginTemperatures = (c: ConstructionContext, partition: readonly Bin[]) => {
  contextWork(c, true, 256); requireRole(partition, "partition"); return beginCursor<OwnedFloat64Hex>(c, "temperatures", partition.length, partition.length, true);
};
export const appendTemperatures = (c: ConstructionContext, cursor: OwnedCursor<OwnedFloat64Hex>, child: OwnedFloat64Hex): void => {
  const storage = cursorFor(c, cursor, "temperatures"); contextWork(c, true, 64000); const value = hNumber(child, .25, 4);
  let found = value === .25 || value === 4;
  for (let i = 1; i < 1000 && !found; i++) if (value === .25 * 16 ** (i / 1000)) found = true;
  if (!found) return constructionFail("DERIVED");
  appendCursor(c, cursor, "temperatures", child); void storage;
};
export const finishTemperatures = (c: ConstructionContext, cursor: OwnedCursor<OwnedFloat64Hex>) => finishCursor<OwnedFloat64Hex>(c, cursor, "temperatures");
export const makeEconomicArtifact = (c: ConstructionContext, opening: OwnedPublicOpening, recipe: EconomicRecipe, tables: readonly Table[], partition: readonly Bin[], temperatures: readonly OwnedFloat64Hex[]): EconomicArtifact => {
  contextWork(c, true, 1024); requireOpening(opening); requireRole(recipe, "recipe"); requireRole(tables, "tables"); requireRole(partition, "partition"); requireRole(temperatures, "temperatures");
  if (temperatures.length !== partition.length) return constructionFail("CARDINALITY");
  const result = publish({ version: "starchess-economic-artifact-v1", status: "FROZEN", opening, recipe, tables, partition, temperatures } as const, "artifact");
  if (wireLength(result) > 1048576) return constructionFail("BYTES");
  return result;
};

const sorted = (values: string[]): readonly string[] => freeze(values.sort());
const promotionSlots = { __proto__: null, length: 36 };
const promotionNames: readonly string[] = freeze(dense(promotionSlots, (_, i) =>
  `${PROMOTION_KERNELS[floor(i / 6)]}.${PROMOTION_CHANNELS[floor(i / 3) % 2]}.h${i % 3 + 1}`));
const recordKeys: Partial<Record<Role, readonly string[]>> = {
  float64: ["hex"], ref: ["byteLength", "sha256"], opening: sorted(["version", "turn", "bank", "cc", "marines"]),
  bank: ["b", "w"], cc: ["b", "w"], marines: ["b", "w"], piece: ["color", "type"],
  sighting: ["observedTurn", "piece", "square"], "own-piece": ["piece", "square"], "own-unit": ["id", "paidBasis", "replacementValue", "square", "type"],
  "own-mine": ["mineId", "square"], "action-ref": ["acceptedActionOrdinal", "planningOrdinal"], receipt: sorted(["receiptId", "actionRef", "unit", "requestedSquare", "minerals", "disposition"]),
  "enemy-loss": sorted(["confirmedUnitCount", "replacementLowerBound", "paidLowerBound", "upper", "completeness"]),
  ledger: sorted(["version", "side", "ownPaidDebits", "ownPaidSurviving", "ownPaidDestroyed", "ownPaidWasted", "ownReplacementDestroyed", "enemyLoss", "receipts", "retiredOwnIds"]),
  own: sorted(["minerals", "gas", "gasIncome", "ccLives", "pieces", "mines", "siegedTanks"]),
  "snapshot-v2": sorted(["version", "side", "turn", "own", "cells", "memory", "ownUnitLineage", "ownMineLineage", "economicState"]),
  "mine-audit": sorted(["liveOwnMines", "retiredOwnMineIdsSorted", "ownMineCreationCounter"]),
  history: sorted(["version", "currentAuthorizedSnapshotV2", "economicState", "everLit"]),
  batch: sorted(["version", "side", "ordinal", "phase", "turn", "planningOrdinal", "seqBefore", "seqThrough", "events", "snapshot"]),
  spend: ["gas", "minerals"], candidate: ["actions", "key", "ownSpend", "version"], component: ["band", "bank", "conditional", "mass"],
  recipe: sorted(["version", "supportVersion", "graphVersion", "innovationVersion", "geometryVersion", "calibrationVersion", "workCap", "materialCeiling", "bankCap", "bandStarts", "alpha", "minimumGroups", "diagnosticHorizons"]),
  table: sorted(["kind", "level", "bank", "band", "tier", "groups", "rows"]), artifact: sorted(["version", "status", "opening", "recipe", "tables", "partition", "temperatures"]),
  state: sorted(["version", "side", "ordinal", "seqThrough", "planningOrdinal", "turn", "boundaryRef", "cells", "memory", "witnessed", "unlocated", "enemyCC", "components", "publicSupport"]),
  readout: sorted(["version", "boundaryRef", "meanD", "meanPotential", "quantilesD", "quantilesPotential", "balance", "uncertainty"]),
  queue: sorted([...QUEUE_NAMES]), position: sorted([...POSITION_NAMES]), economic: sorted([...ECONOMIC_NAMES]), promotion: sorted([...promotionNames]),
  features: sorted(["version", "queue", "positions", "economic", "promotion"]), "manifest-entry": ["meaningId", "name", "scaleId"],
  scales: sorted(["minerals", "gas", "turn", "ccLives", "maxSpawn", "paid", "replacement", "coords", "squares", "actions", "pairs", "relationPairs", "visionOverlap", "files"]),
  manifest: sorted(["version", "dimension", "names", "entries", "scales"]),
  pin: sorted(["version", "economicArtifactRef", "estimatorProvenanceRef", "featureManifestRef", "amendmentRef"]),
  binding: sorted(["version", "policyArtifactRef", "economicArtifactRef", "estimatorProvenanceRef", "featureManifestRef", "amendmentRef"]),
  provenance: sorted(["version", "economicArtifactRef", "coreRulesRef", "fittingCodeRef", "collectionRecipeRef", "fittingRecipeRef", "collectionRosterRef", "splitRosterRef", "labelBytesRef", "fitJournalRef", "calibrationJournalRef"]),
  authority: sorted(["version", "contractsRef", "r2GeneratorRef", "baseRef", "correctiveRef", "r3SeamRef", "r3NativeCorrectionRef", "ownedIngressRef"]),
  profiles: sorted(["api", "provenance", "quota", "curriculum", "validation"]), limits: sorted(["startupMs", "planMs", "matchMs", "maxWindows", "maxRecordedPlies", "maxProposals", "maxIpcMessages", "maxProgressBytes", "maxCompletionBytes"]),
  validation: ["atol", "eps", "profile", "rtol"], configuration: sorted(["profiles", "horizon", "dimension", "uniqueCap", "workCap", "maxGeneratedActions", "familyCapacity", "compositionCapacity", "passCapacity", "maxStartedPerMaster", "masters", "checkpointCadence", "initialization", "arithmetic", "optimizer", "learningRate", "temperature", "l2", "clipping", "baseline", "emptyDecision", "abortPolicy", "primaryMaster", "openingRef", "hostLimits", "validation"]),
  versions: sorted(["snapshot", "observationCodec", "history", "batch", "ledger", "provenance", "candidateCodec", "generator", "projection", "features", "featureManifest", "comparator", "rng", "episodeProtocol", "checkpoint", "artifact", "optimizer", "loss", "eligibility", "recipe", "hostConfig"]),
  "training-recipe": ["configuration", "economicPinRef", "version", "versions"],
};
const eventKeys: Record<Event['kind'], readonly string[]> = {
  "own-paid-receipt": sorted(["kind", "seq", "receiptId", "actionRef", "unit", "requestedSquare", "minerals"]),
  "own-gas-debited": sorted(["kind", "seq", "actionRef", "gas"]), "own-unit-endowed": sorted(["kind", "seq", "id", "square", "type", "paidBasis"]),
  "own-unit-created": sorted(["kind", "seq", "lineageId", "receiptId", "square", "type"]),
  "own-deployment-unmaterialized": sorted(["kind", "seq", "receiptId", "paidMinerals"]), "own-unit-moved": sorted(["kind", "seq", "id", "from", "to"]),
  "own-unit-transformed": sorted(["kind", "seq", "id", "fromType", "toType", "paidDelta"]), "own-unit-mode-changed": sorted(["kind", "seq", "id", "mode"]),
  "own-unit-destroyed": sorted(["kind", "seq", "id", "typeAtLoss", "square", "retiredPaidBasis"]), "own-mine-endowed": sorted(["kind", "seq", "mineId", "actionRef", "square"]),
  "own-mine-created": sorted(["kind", "seq", "mineId", "actionRef", "square"]), "own-mine-removed": sorted(["kind", "seq", "mineId"]),
  "own-income": sorted(["kind", "seq", "actualCreditedMinerals"]), "own-cc-lives-changed": sorted(["kind", "seq", "before", "after"]),
  "enemy-unit-destruction-witnessed": sorted(["kind", "seq", "witnessId", "square", "type", "replacementLowerBound", "paidLowerBound"]), "vision-witness": sorted(["kind", "seq", "turn", "changes"]),
};
const keysFor = (value: object, role: Role): readonly string[] | undefined => {
  let keys = hasOwnField(recordKeys, role) ? recordKeys[role] : undefined;
  if (role === "cell") keys = (value as Cells[number]).visibility === "unknown" ? ["square", "visibility"] : ["piece", "square", "visibility"];
  if (role === "disposition") keys = (value as Receipt['disposition']).kind === "materialized" ? ["kind", "lineageId"] : ["kind"];
  if (role === "event") keys = eventKeys[(value as Event).kind];
  if (role === "action") {
    const action = value as ScActionInput;
    keys = action.kind === "deploy" ? ["color", "from", "kind", "timing", "to", "unit"] : hasOwnField(action, "promotion") ?
      ["color", "from", "kind", "promotion", "timing", "to"] : hasOwnField(action, "to") ? ["color", "from", "kind", "timing", "to"] : ["color", "from", "kind", "timing"];
  }
  return keys;
};
const arrayRole = (role: Role): boolean => {
  switch (role) {
    case "white-marines": case "black-marines": case "cells": case "changes": case "memory": case "squares": case "own-pieces": case "own-units": case "own-mines":
    case "receipts": case "retired-units": case "retired-mines": case "events": case "actions": case "conditional": case "components": case "support":
    case "band-starts": case "horizons": case "transition-row": case "evidence-row": case "transition-rows": case "evidence-rows": case "tables": case "bin":
    case "partition": case "temperatures": case "quantiles": case "positions": case "manifest-entries": case "manifest-names": case "masters": case "eps": return true;
    default: return false;
  }
};
const wireLength = (value: unknown): number => {
  if (value === null) return 4;
  if (typeof value === "string") {
    let length = 2;
    for (let i = 0; i < value.length; i++) {
      const code = apply(characterCode, value, [i]) as number; if (code < 32 || code > 126) return constructionFail("CANONICAL");
      length += code === 34 || code === 92 ? 2 : 1;
    }
    return length;
  }
  if (typeof value === "boolean") return value ? 4 : 5;
  if (typeof value === "number") { if (!finite(value)) return constructionFail("NUMBER"); return `${value}`.length; }
  if (typeof value !== "object" || !lookup(value)) return constructionFail("PROVENANCE");
  const length = getWireLength(value) as number | undefined;
  return length === undefined ? constructionFail("PROVENANCE") : length;
};
const constructedWireLength = (value: object, role: Role): number | undefined => {
  switch (role) {
    case "float64": return 26;
    case "ref": return 91 + `${(value as OwnedByteRef).byteLength}`.length;
    case "bank": return 13;
    case "cc": return 19;
    case "white-marines": case "black-marines": return 21;
    case "marines": return 53;
    case "opening": return 162;
  }
  const keys = keysFor(value, role);
  if (keys) {
    let length = 2;
    for (let i = 0; i < keys.length; i++) length += (i === 0 ? 0 : 1) + wireLength(keys[i]!) + 1 + wireLength((value as Record<string, unknown>)[keys[i]!]);
    return length;
  }
  if (!arrayRole(role)) return undefined;
  const values = value as readonly unknown[]; let length = 2;
  for (let i = 0; i < values.length; i++) length += (i === 0 ? 0 : 1) + wireLength(values[i]);
  return length;
};
const sameOwnedValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const role = lookup(a) as Role | undefined;
  if (!role || lookup(b) !== role) return constructionFail("PROVENANCE");
  const keys = keysFor(a, role), otherKeys = keysFor(b, role);
  if (keys) {
    if (!otherKeys || keys.length !== otherKeys.length) return false;
    for (let i = 0; i < keys.length; i++) if (keys[i] !== otherKeys[i] || !sameOwnedValue((a as Record<string, unknown>)[keys[i]!], (b as Record<string, unknown>)[keys[i]!])) return false;
    return true;
  }
  if (!arrayRole(role)) return constructionFail("PROVENANCE");
  const left = a as readonly unknown[], right = b as readonly unknown[];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) if (!sameOwnedValue(left[i], right[i])) return false;
  return true;
};
type ByteEmitter = { bytes: Uint8Array; offset: number; compare: boolean };
const emitByte = (output: ByteEmitter, byte: number): void => {
  if (output.offset >= output.bytes.length) return constructionFail("CANONICAL");
  if (output.compare) { if (output.bytes[output.offset] !== byte) return constructionFail("CANONICAL"); }
  else output.bytes[output.offset] = byte;
  output.offset++;
};
const emitText = (output: ByteEmitter, text: string, quoted: boolean): void => {
  if (quoted) emitByte(output, 34);
  for (let i = 0; i < text.length; i++) {
    const code = apply(characterCode, text, [i]) as number;
    if (code < 32 || code > 126) return constructionFail("CANONICAL");
    if (quoted && (code === 34 || code === 92)) emitByte(output, 92);
    emitByte(output, code);
  }
  if (quoted) emitByte(output, 34);
};
const emitCanonical = (output: ByteEmitter, value: unknown, depth = 0): void => {
  if (depth > 16) return constructionFail("DEPTH");
  if (value === null) return emitText(output, "null", false);
  if (typeof value === "string") return emitText(output, value, true);
  if (typeof value === "boolean") return emitText(output, value ? "true" : "false", false);
  if (typeof value === "number") { if (!finite(value)) return constructionFail("NUMBER"); return emitText(output, `${value}`, false); }
  if (typeof value !== "object") return constructionFail("PROVENANCE");
  const role = lookup(value) as Role | undefined; if (!role) return constructionFail("PROVENANCE");
  const keys = keysFor(value, role);
  if (keys) {
    emitByte(output, 123);
    for (let i = 0; i < keys.length; i++) {
      if (i) emitByte(output, 44);
      emitText(output, keys[i]!, true); emitByte(output, 58);
      emitCanonical(output, (value as Record<string, unknown>)[keys[i]!], depth + 1);
    }
    return emitByte(output, 125);
  }
  if (!arrayRole(role)) return constructionFail("PROVENANCE");
  const values = value as readonly unknown[];
  emitByte(output, 91);
  for (let i = 0; i < values.length; i++) {
    if (i) emitByte(output, 44);
    emitCanonical(output, values[i], depth + 1);
  }
  return emitByte(output, 93);
};
const canonicalBytes = (value: unknown): Uint8Array => {
  const bytes = new FixedUint8Array(wireLength(value)), output: ByteEmitter = { bytes, offset: 0, compare: false };
  emitCanonical(output, value);
  if (output.offset !== bytes.length) return constructionFail("CANONICAL");
  return bytes;
};
const canonicalText = (value: unknown): string => {
  const bytes = canonicalBytes(value), slots = { __proto__: null, length: bytes.length }, characters = dense(slots, () => "");
  for (let i = 0; i < bytes.length; i++) characters[i] = fromCharacterCode(bytes[i]!);
  return apply(joinDigits, characters, [""]) as string;
};
const encoded = (c: ConstructionContext, value: unknown, startup: boolean): Uint8Array => {
  contextWork(c, startup, 512);
  const length = wireLength(value);
  if (length > 1048576) return constructionFail("BYTES");
  contextWork(c, startup, 512 + 16 * length);
  return canonicalBytes(value);
};
export const encodeOwnedBoundaryBatch = (c: ConstructionContext, batch: unknown) => encoded(c, requireBatch(batch), false);
export const encodeOwnedHistory = (c: ConstructionContext, history: unknown) => encoded(c, requireHistory(history), false);
export const encodeOwnedCandidate = (c: ConstructionContext, candidate: unknown) => encoded(c, requireCandidate(candidate), false);
export const encodeOwnedEconomicArtifact = (c: ConstructionContext, artifact: unknown) => encoded(c, requireArtifact(artifact), true);
export const encodeOwnedFeatureManifest = (c: ConstructionContext, manifest: unknown) => encoded(c, requireManifest(manifest), true);
export const encodeOwnedPin = (c: ConstructionContext, pin: unknown) => encoded(c, requireEconomicPin(pin), true);
export const encodeOwnedBinding = (c: ConstructionContext, binding: unknown) => encoded(c, requireEconomicBinding(binding), true);
export const encodeOwnedEstimatorProvenance = (c: ConstructionContext, provenance: unknown) => encoded(c, requireEstimatorProvenance(provenance), true);
export const encodeOwnedAuthority = (c: ConstructionContext, authority: unknown) => encoded(c, requireEconomicAuthority(authority), true);
export const encodeOwnedTrainingRecipe = (c: ConstructionContext, recipe: unknown) => encoded(c, requireTrainingRecipe(recipe), true);

export const makeCandidate = (c: ConstructionContext, side: Side, actions: readonly ScActionInput[]): Candidate => {
  contextWork(c, false, 1024); color(side); requireRole(actions, "actions"); contextWork(c, false, 256 + 64 * actions.length);
  let minerals = 0, gas = 0;
  for (const action of actions) {
    if (action.color !== side) return constructionFail("SIDE");
    if (action.kind === "deploy") minerals += UNIT_COST[action.unit!];
    if (action.kind !== "classical") gas += specialGasCost(action.kind);
  }
  contextWork(c, false, 512 + 64 * wireLength(actions));
  const key = canonicalText(actions), ownSpend = publish({ minerals, gas }, "spend");
  return publish({ version: "challenge-candidate-codec-v1", key, actions: actions as ScActionInput[], ownSpend } as const, "candidate");
};
export const makeBoundaryBatch = (c: ConstructionContext, side: Side, ordinal: number, phase: CheckedBoundary['phase'], turn: number,
  planningOrdinal: number, seqBefore: number, seqThrough: number, events: readonly Event[], snapshot: AuthorizedSnapshotV2): Batch => {
  contextWork(c, false, 1024); color(side); integer(ordinal, 128); integer(turn, 45); integer(planningOrdinal, 64); integer(seqBefore, maximumSafeInteger); integer(seqThrough, maximumSafeInteger);
  requireRole(events, "events"); requireSnapshotV2(snapshot); contextWork(c, false, 256 + 128 * events.length);
  if (phase !== "initial" && phase !== "turn-open" && phase !== "settled") return constructionFail("SCHEMA");
  if (snapshot.side !== side || snapshot.turn !== turn || !isSafeInteger(seqBefore + events.length) || seqThrough !== seqBefore + events.length) return constructionFail("SEQUENCE");
  let visionTurn = -1, effectsStarted = false, lastDebitOrdinal = -1, awaitingDeployGas = false, receipts = 0;
  const gasRefs: number[] = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    if (event.seq !== seqBefore + i + 1) return constructionFail("SEQUENCE");
    switch (event.kind) {
      case "own-paid-receipt": case "own-deployment-unmaterialized": identifier(event.receiptId, side, "receipt"); break;
      case "own-unit-created": identifier(event.lineageId, side, "unit"); identifier(event.receiptId, side, "receipt"); break;
      case "own-unit-endowed": case "own-unit-moved": case "own-unit-transformed": case "own-unit-mode-changed": case "own-unit-destroyed": identifier(event.id, side, "unit"); break;
      case "own-mine-endowed": case "own-mine-created": case "own-mine-removed": identifier(event.mineId, side, "mine"); break;
      case "enemy-unit-destruction-witnessed": identifier(event.witnessId, side, "witness"); break;
      case "vision-witness":
        if (event.turn < visionTurn || event.turn > turn || event.changes.some(x => x.visibility === "revealed" && x.piece.color === side)) return constructionFail("SEQUENCE");
        visionTurn = event.turn; break;
    }
    if (hasOwnField(event, "actionRef") && (event as { actionRef: ActionRef }).actionRef !== null &&
        (event as { actionRef: ActionRef }).actionRef.planningOrdinal !== planningOrdinal - 1) return constructionFail("SEQUENCE");
    if (event.kind === "own-paid-receipt" || event.kind === "own-gas-debited") {
      const action = event.actionRef.acceptedActionOrdinal;
      if (phase !== "settled" || effectsStarted || action < lastDebitOrdinal) return constructionFail("ORDER");
      if (event.kind === "own-paid-receipt") {
        if (++receipts > 1 || awaitingDeployGas || action <= lastDebitOrdinal) return constructionFail("IDENTITY");
        awaitingDeployGas = true;
      } else {
        if (gasRefs.includes(action) || awaitingDeployGas && (action !== lastDebitOrdinal || event.gas !== specialGasCost("deploy"))) return constructionFail("IDENTITY");
        push(gasRefs, action); awaitingDeployGas = false;
      }
      lastDebitOrdinal = action;
    } else {
      if (awaitingDeployGas) return constructionFail("ORDER"); effectsStarted = true;
    }
  }
  if (awaitingDeployGas) return constructionFail("ORDER");
  const incomes = events.filter(e => e.kind === "own-income");
  if (phase === "settled" ? incomes.length !== 1 || events[events.length - 1]?.kind !== "own-income" : incomes.length !== 0) return constructionFail("ORDER");
  if (phase === "initial") {
    if (ordinal !== 0 || planningOrdinal !== 0 || seqBefore !== 0 || snapshot.turn !== 0) return constructionFail("SEQUENCE");
    const units = events.filter(e => e.kind === "own-unit-endowed"), mines = events.filter(e => e.kind === "own-mine-endowed");
    if (events.length !== units.length + mines.length || units.length !== snapshot.ownUnitLineage.length || mines.length !== snapshot.ownMineLineage.length) return constructionFail("IDENTITY");
    for (let i = 0; i < units.length; i++) {
      const unit = units[i]!, expected = snapshot.ownUnitLineage[i]!;
      if (events[i] !== unit || unit.id !== expected.id || unit.square !== expected.square || unit.type !== expected.type || unit.id !== `${side}:unit:opening:${unit.square}` || expected.paidBasis !== 0) return constructionFail("IDENTITY");
    }
    for (let i = 0; i < mines.length; i++) {
      const mine = mines[i]!, expected = snapshot.ownMineLineage[i]!;
      if (mine.mineId !== expected.mineId || mine.square !== expected.square || mine.mineId !== `${side}:mine:opening:${mine.square}`) return constructionFail("IDENTITY");
    }
    const ledger = snapshot.economicState;
    if (ledger.ownPaidDebits !== 0 || ledger.ownReplacementDestroyed !== 0 || ledger.enemyLoss.confirmedUnitCount !== 0 || ledger.enemyLoss.replacementLowerBound !== 0 || ledger.receipts.length !== 0 || ledger.retiredOwnIds.length !== 0 || snapshot.memory.some(m => snapshot.cells.find(x => x.square === m.square)!.visibility === "unknown")) return constructionFail("CONSERVATION");
  } else {
    if (ordinal !== (phase === "turn-open" ? 2 * planningOrdinal + 1 : 2 * planningOrdinal) || phase === "settled" && planningOrdinal === 0) return constructionFail("SEQUENCE");
    for (const event of events) {
      if (event.kind === "own-unit-endowed" || event.kind === "own-mine-endowed") return constructionFail("IDENTITY");
      if (phase === "turn-open" && event.kind !== "own-unit-destroyed" && event.kind !== "own-mine-removed" && event.kind !== "own-cc-lives-changed" && event.kind !== "enemy-unit-destruction-witnessed" && event.kind !== "vision-witness") return constructionFail("ORDER");
    }
  }
  return publish({ version: "challenge-boundary-batch-v1", side, ordinal, phase, turn, planningOrdinal, seqBefore, seqThrough, events, snapshot } as const, "batch");
};

type VerifiedStorage = Readonly<{ snapshot: OwnedByteSnapshot; batch: Batch; ref: OwnedByteRef }>;
declare const boundaryDecodeBrand: unique symbol;
export type BoundaryDecodeTicket = Readonly<{ [boundaryDecodeBrand]: "boundary-decode-prepayment" }>;
type BoundaryDecodeControl = { ledger: LedgerControl; transaction: Transaction; snapshot: OwnedByteSnapshot; live: boolean; hashAvailable: boolean; verified: VerifiedBatchBytes | undefined };
const boundaryDecodes = new WeakMap<object, BoundaryDecodeControl>();
const currentBoundaryDecode = new WeakMap<object, BoundaryDecodeControl>();
const verifiedBySnapshot = new WeakMap<object, Readonly<{ batch: Batch; verified: VerifiedBatchBytes }>>();
const getBoundaryDecode = WeakMap.prototype.get.bind(boundaryDecodes);
const setBoundaryDecode = WeakMap.prototype.set.bind(boundaryDecodes);
const getCurrentBoundaryDecode = WeakMap.prototype.get.bind(currentBoundaryDecode);
const setCurrentBoundaryDecode = WeakMap.prototype.set.bind(currentBoundaryDecode);
const deleteCurrentBoundaryDecode = WeakMap.prototype.delete.bind(currentBoundaryDecode);
const getVerifiedBySnapshot = WeakMap.prototype.get.bind(verifiedBySnapshot);
const setVerifiedBySnapshot = WeakMap.prototype.set.bind(verifiedBySnapshot);
export const beginBoundaryBatchDecode = (c: Meter, value: OwnedByteSnapshot): BoundaryDecodeTicket => {
  const transaction = activeFor(c); requireSnapshot(value, "boundaryBatch");
  if (getCurrentBoundaryDecode(c)) return rejectLedger(transaction.ledger, "LIFECYCLE");
  contextWork(c, false, 2048 + 96 * snapshotLength(value));
  const ticket = freeze(create(null)) as BoundaryDecodeTicket;
  const control: BoundaryDecodeControl = { ledger: transaction.ledger, transaction, snapshot: value, live: true, hashAvailable: true, verified: undefined };
  setBoundaryDecode(ticket, control); setCurrentBoundaryDecode(c, control);
  return ticket;
};
const boundaryDecodeFor = (c: Meter, value: unknown): BoundaryDecodeControl => {
  const transaction = activeFor(c);
  if (value === null || typeof value !== "object") return rejectLedger(transaction.ledger, "TICKET");
  const control = getBoundaryDecode(value) as BoundaryDecodeControl | undefined;
  if (!control || control.ledger !== transaction.ledger || control.transaction !== transaction || !control.live || getCurrentBoundaryDecode(c) !== control) return rejectLedger(transaction.ledger, "TICKET");
  return control;
};
export const finishBoundaryBatchDecode = (c: Meter, ticket: BoundaryDecodeTicket): void => {
  const control = boundaryDecodeFor(c, ticket);
  if (!control.verified) return rejectLedger(control.ledger, "TICKET");
  control.live = false; deleteCurrentBoundaryDecode(c);
};
export const abortBoundaryBatchDecode = (c: Meter, ticket: BoundaryDecodeTicket): void => {
  if (ticket === null || typeof ticket !== "object") return fail("$.ticket", "TICKET");
  const control = getBoundaryDecode(ticket) as BoundaryDecodeControl | undefined;
  if (!control || control.ledger.meter !== c || !control.live) return fail("$.ticket", "TICKET");
  control.live = false; deleteCurrentBoundaryDecode(c); latch(control.ledger);
};
const verifiedStorage = new WeakMap<object, VerifiedStorage>();
const boundaryStorage = new WeakMap<object, VerifiedBatchBytes>();
const refStorage = new WeakMap<object, VerifiedBatchBytes>();
const getVerified = WeakMap.prototype.get.bind(verifiedStorage);
const setVerified = WeakMap.prototype.set.bind(verifiedStorage);
const getBoundary = WeakMap.prototype.get.bind(boundaryStorage);
const setBoundary = WeakMap.prototype.set.bind(boundaryStorage);
const getRefBatch = WeakMap.prototype.get.bind(refStorage);
const setRefBatch = WeakMap.prototype.set.bind(refStorage);
const SHA256 = jsSHA;
export const completeBoundaryBatchBytes = (c: ConstructionContext, ownedBytes: OwnedByteSnapshot, ownedBatch: Batch): VerifiedBatchBytes => {
  contextWork(c, false, 1024); const bytes = storageFor(requireSnapshot(ownedBytes, "boundaryBatch")), batch = requireBatch(ownedBatch);
  if (wireLength(batch) !== bytes.length) return constructionFail("CANONICAL");
  const cached = getVerifiedBySnapshot(ownedBytes) as Readonly<{ batch: Batch; verified: VerifiedBatchBytes }> | undefined;
  const decoder = getCurrentBoundaryDecode(c) as BoundaryDecodeControl | undefined;
  if (decoder && (!decoder.live || decoder.transaction !== activeFor(c) || decoder.snapshot !== ownedBytes)) return constructionFail("TICKET");
  if (cached?.batch === batch) {
    if (decoder) { decoder.hashAvailable = false; decoder.verified = cached.verified; }
    return cached.verified;
  }
  if (decoder) {
    if (!decoder.hashAvailable) return constructionFail("TICKET");
    decoder.hashAvailable = false;
  } else contextWork(c, false, 512 + bytes.length * 48);
  const comparison: ByteEmitter = { bytes: bytes.bytes, offset: 0, compare: true };
  emitCanonical(comparison, batch);
  if (comparison.offset !== bytes.length) return constructionFail("CANONICAL");
  const hash = new SHA256("SHA-256", "UINT8ARRAY"); hash.update(bytes.bytes);
  const ref = constructRef(bytes.length, hash.getHash("HEX")), verified = publish(create(null) as VerifiedBatchBytes, "verified-batch");
  setVerified(verified, freeze({ snapshot: ownedBytes, batch, ref })); setRefBatch(ref, verified);
  setVerifiedBySnapshot(ownedBytes, freeze({ batch, verified }));
  if (decoder) decoder.verified = verified;
  return verified;
};
const verifiedFor = (value: unknown): VerifiedStorage => {
  const verified = requireRole<VerifiedBatchBytes>(value, "verified-batch"), storage = getVerified(verified);
  return storage ?? constructionFail("PROVENANCE");
};
export const makeBoundary = (c: ConstructionContext, snapshot: AuthorizedSnapshotV2, ledger: Ledger, mineAudit: MineAudit, everLit: readonly Square[],
  ordinal: number, phase: CheckedBoundary['phase'], planningOrdinal: number, seqThrough: number, verifiedBytes: VerifiedBatchBytes): CheckedBoundary => {
  contextWork(c, false, 1024); requireSnapshotV2(snapshot); requireRole(ledger, "ledger"); requireRole(mineAudit, "mine-audit"); requireRole(everLit, "squares");
  const verified = verifiedFor(verifiedBytes), batch = verified.batch;
  contextWork(c, false, 512 + 16 * 64 * (everLit.length + 1) + 16 * snapshot.ownMineLineage.length + 8 * snapshotLength(verified.snapshot));
  if (!sameOwnedValue(batch.snapshot, snapshot) || !sameOwnedValue(snapshot.economicState, ledger) || batch.ordinal !== ordinal || batch.phase !== phase || batch.planningOrdinal !== planningOrdinal || batch.seqThrough !== seqThrough ||
    !sameOwnedValue(mineAudit.liveOwnMines, snapshot.ownMineLineage) || snapshot.cells.some(x => x.visibility === "lit" && !everLit.includes(x.square))) return constructionFail("CONSISTENCY");
  if (mineAudit.ownMineCreationCounter > 3 * planningOrdinal || ledger.receipts.some(r => r.actionRef.planningOrdinal >= planningOrdinal) ||
    mineAudit.retiredOwnMineIdsSorted.some(id => sideOfId(id) !== snapshot.side)) return constructionFail("SEQUENCE");
  const bytes = storageFor(verified.snapshot), lastBatchBytes = new FixedUint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) lastBatchBytes[i] = bytes.bytes[i]!;
  const boundary = publish({ snapshot, economicState: snapshot.economicState, ownMineAuditState: mineAudit, everLit, ordinal, phase, planningOrdinal, seqThrough, lastBatchBytes }, "boundary");
  setBoundary(boundary, verifiedBytes);
  return boundary;
};
const verifiedBoundary = (value: unknown): VerifiedStorage => {
  const boundary = requireBoundary(value), verified = getBoundary(boundary);
  return verified === undefined ? constructionFail("PROVENANCE") : verifiedFor(verified);
};
export const boundaryBatch = (value: unknown): Batch => verifiedBoundary(value).batch;
export const boundaryRef = (value: unknown): OwnedByteRef => verifiedBoundary(value).ref;
export const batchForBoundaryRef = (value: unknown): Batch => {
  const ref = requireRef(value), verified = getRefBatch(ref);
  return verified === undefined ? constructionFail("PROVENANCE") : verifiedFor(verified).batch;
};
export type OwnedReductionInput = Readonly<{
  phase: CheckedBoundary['phase']; ordinal: number; planningOrdinal: number; seqBefore: number; seqThrough: number;
  boundaryRef: OwnedByteRef; snapshot: AuthorizedSnapshotV2; events: readonly Event[]; priorOwnSquares: readonly Square[]; priorOwnUnits: readonly Unit[];
}>;
const reductionInput = (c: ConstructionContext, boundary: CheckedBoundary, prior: Batch | undefined): OwnedReductionInput => {
  const batch = boundaryBatch(boundary);
  contextWork(c, false, 1024 + 128 * (prior?.snapshot.own.pieces.length ?? 0));
  const squares = beginSquareSet64(c);
  if (prior) for (let f = 0; f < 8; f++) for (let r = 1; r <= 8; r++) {
    const at = `${"abcdefgh"[f]}${r}` as Square;
    if (prior.snapshot.own.pieces.some(p => p.square === at && p.piece.type !== "k") || prior.snapshot.own.mines.includes(at)) appendSquareSet64(c, squares, at);
  }
  const priorOwnSquares = finishSquareSet64(c, squares);
  const priorOwnUnits = prior ? prior.snapshot.ownUnitLineage : publish([] as Unit[], "own-units");
  return publish({ phase: batch.phase, ordinal: batch.ordinal, planningOrdinal: batch.planningOrdinal, seqBefore: batch.seqBefore, seqThrough: batch.seqThrough,
    boundaryRef: boundaryRef(boundary), snapshot: batch.snapshot, events: batch.events, priorOwnSquares, priorOwnUnits }, "reduction-input");
};
export const makeInitialReductionInput = (c: ConstructionContext, value: CheckedBoundary): OwnedReductionInput => {
  contextWork(c, false, 512); const boundary = requireBoundary(value), batch = boundaryBatch(boundary);
  if (batch.phase !== "initial" || batch.ordinal !== 0) return constructionFail("SEQUENCE");
  return reductionInput(c, boundary, undefined);
};
export const makeAdvanceReductionInput = (c: ConstructionContext, value: EconomicBeliefState, boundaryValue: CheckedBoundary): OwnedReductionInput => {
  contextWork(c, false, 512); const state = requireState(value), boundary = requireBoundary(boundaryValue);
  const prior = batchForBoundaryRef(state.boundaryRef), next = boundaryBatch(boundary);
  if (prior.side !== state.side || prior.ordinal !== state.ordinal || prior.seqThrough !== state.seqThrough || prior.planningOrdinal !== state.planningOrdinal || prior.turn !== state.turn || next.side !== prior.side) return constructionFail("SEQUENCE");
  if (next.ordinal === prior.ordinal) {
    const verified = getRefBatch(state.boundaryRef), oldBytes = storageFor(verifiedFor(verified).snapshot), newBytes = storageFor(verifiedBoundary(boundary).snapshot);
    contextWork(c, false, 512 + 8 * oldBytes.length);
    if (oldBytes.length !== newBytes.length) return constructionFail("DUPLICATE");
    for (let i = 0; i < oldBytes.length; i++) if (oldBytes.bytes[i] !== newBytes.bytes[i]) return constructionFail("DUPLICATE");
  } else if (next.phase === "initial" || next.ordinal !== prior.ordinal + 1 || next.seqBefore !== prior.seqThrough ||
    next.phase !== (prior.phase === "turn-open" ? "settled" : "turn-open") || next.planningOrdinal !== prior.planningOrdinal + (next.phase === "settled" ? 1 : 0) ||
    (next.phase === "settled" ? next.turn !== prior.turn + 1 : next.turn < prior.turn || next.turn > prior.turn + 1) || prior.turn === 45 || prior.snapshot.own.ccLives === 0) return constructionFail("SEQUENCE");
  return reductionInput(c, boundary, prior);
};
export const makeEconomicState = (c: ConstructionContext, boundary: CheckedBoundary, side: Side, ordinal: number, seqThrough: number, planningOrdinal: number,
  turn: number, ref: OwnedByteRef, cells: Cells, memory: Memory, witnessed: readonly Square[], unlocated: readonly Square[], enemyCC: readonly Square[], components: readonly Component[], support: readonly boolean[]): EconomicBeliefState => {
  contextWork(c, false, 1024); requireBoundary(boundary); requireRef(ref); requireRole(cells, "cells"); requireRole(memory, "memory"); requireRole(witnessed, "squares"); requireRole(unlocated, "squares"); requireRole(enemyCC, "squares"); requireRole(components, "components"); requireRole(support, "support");
  contextWork(c, false, 16 * components.length);
  let conditionalCount = 0;
  for (const component of components) conditionalCount += component.conditional.length;
  contextWork(c, false, 2048 + 64 * conditionalCount + 64 * 64 + 128 * (memory.length + enemyCC.length + witnessed.length + unlocated.length + 1));
  const batch = boundaryBatch(boundary);
  if (color(side) !== batch.side || integer(ordinal, 256) !== batch.ordinal || integer(seqThrough, maximumSafeInteger) !== batch.seqThrough || integer(planningOrdinal, 63) !== batch.planningOrdinal ||
    integer(turn, 45) !== batch.turn || ref !== boundaryRef(boundary) || !sameCells(cells, batch.snapshot.cells) || !sameMemory(memory, batch.snapshot.memory) || enemyCC.length === 0) return constructionFail("CONSISTENCY");
  let sum = 0;
  for (const component of components) {
    sum += hNumber(component.mass, 0, 1);
    for (let i = 0; i < component.conditional.length; i++) if (hNumber(component.conditional[i], 0, 1) > 0 && !support[577 * component.bank + BAND_STARTS[component.band]! + i]) return constructionFail("CONSISTENCY");
  }
  if (abs(sum - 1) > 1e-12) return constructionFail("NORMALIZATION");
  const witnessMask = new FixedUint8Array(64), unlocatedMask = new FixedUint8Array(64), ccMask = new FixedUint8Array(64);
  const maskIndex = (square: Square): number => ((apply(characterCode, square, [0]) as number) - 97) * 8 + (apply(characterCode, square, [1]) as number) - 49;
  for (const square of witnessed) witnessMask[maskIndex(square)] = 1;
  for (const square of unlocated) unlocatedMask[maskIndex(square)] = 1;
  for (const square of enemyCC) ccMask[maskIndex(square)] = 1;
  let lower = 0, unknown = 0, locatedCC = false;
  for (let i = 0; i < 64; i++) {
    const cell = cells[i]!;
    if (cell.visibility === "unknown") { unknown++; continue; }
    const enemy = cell.piece !== null && cell.piece.color !== side;
    if (enemy) { lower += replacementValue(cell.piece!.type); if (cell.piece!.type === "k") locatedCC = true; }
    if (enemy && cell.piece!.type === "p" ? witnessMask[i] !== 1 : witnessMask[i] === 1) return constructionFail("CONSISTENCY");
    if (unlocatedMask[i] === 1 || ccMask[i] === 1 && (!enemy || cell.piece!.type !== "k")) return constructionFail("CONSISTENCY");
    if (enemy && cell.piece!.type === "k" && (enemyCC.length !== 1 || enemyCC[0] !== cell.square)) return constructionFail("CONSISTENCY");
  }
  const upper = Math.min(576, lower + 9 * (unknown - (locatedCC ? 0 : 1)));
  if (unknown < (locatedCC ? 0 : 1)) return constructionFail("CONSISTENCY");
  const summary = supportSummary(support);
  if (summary.minimumD < lower || summary.maximumD > upper) return constructionFail("CONSISTENCY");
  return publish({ version: "challenge-enemy-economic-belief-v1", side, ordinal, seqThrough, planningOrdinal, turn, boundaryRef: ref, cells, memory, witnessed, unlocated, enemyCC,
    components, publicSupport: support } as const, "state");
};
export const makeQuantilesD = (c: ConstructionContext, q05: number, q95: number, q025: number, q975: number): EconomicReadout['quantilesD'] => {
  contextWork(c, false, 512); integer(q05, 576); integer(q95, 576); integer(q025, 576); integer(q975, 576);
  if (!(q025 <= q05 && q05 <= q95 && q95 <= q975)) return constructionFail("ORDER");
  return publish([q05, q95, q025, q975] as const, "quantiles");
};
export const makeQuantilesPotential = (c: ConstructionContext, q05: number, q95: number, q025: number, q975: number): EconomicReadout['quantilesPotential'] => {
  contextWork(c, false, 512); integer(q05, 588); integer(q95, 588); integer(q025, 588); integer(q975, 588);
  if (!(q025 <= q05 && q05 <= q95 && q95 <= q975)) return constructionFail("ORDER");
  return publish([q05, q95, q025, q975] as const, "quantiles");
};
export const makeEconomicReadout = (c: ConstructionContext, state: EconomicBeliefState, meanD: OwnedFloat64Hex, meanPotential: OwnedFloat64Hex,
  qD: EconomicReadout['quantilesD'], qP: EconomicReadout['quantilesPotential'], balance: OwnedFloat64Hex, uncertainty: OwnedFloat64Hex): EconomicReadout => {
  contextWork(c, false, 2048); requireState(state); requireFloat64Hex(meanD); requireFloat64Hex(meanPotential); requireFloat64Hex(balance); requireFloat64Hex(uncertainty); requireRole(qD, "quantiles"); requireRole(qP, "quantiles");
  const d = hNumber(meanD, 0, 576), p = hNumber(meanPotential, 0, 588), b = hNumber(balance, -576, 576), u = hNumber(uncertainty, 0, 288);
  contextWork(c, false, 2048 + 16 * 64);
  const batch = batchForBoundaryRef(state.boundaryRef); let ownReplacement = 0;
  for (const piece of batch.snapshot.own.pieces) ownReplacement += replacementValue(piece.piece.type);
  if (p < d || p > d + 12 || qD.some(x => x > 576) || qP.some((x, i) => x < qD[i]! || x > qD[i]! + 12) || b !== ownReplacement - d || u !== (qD[3] - qD[2]) / 2) return constructionFail("DERIVED");
  const summary = supportSummary(state.publicSupport), minimumD = summary.minimumD, maximumD = summary.maximumD,
    minimumP = summary.minimumPotential, maximumP = summary.maximumPotential;
  if (d < minimumD || d > maximumD || p < minimumP || p > maximumP || qD.some(x => x < minimumD || x > maximumD) || qP.some(x => x < minimumP || x > maximumP)) return constructionFail("CONSISTENCY");
  return publish({ version: "starchess-economic-readout-v1", boundaryRef: state.boundaryRef, meanD, meanPotential, quantilesD: qD, quantilesPotential: qP, balance, uncertainty } as const, "readout");
};

const queueScales: readonly ScaleId[] = ["unit", "actions", "minerals", "gas", "actions", "actions", "actions", "minerals", "gas", "paid", "replacement", "squares", "squares", "squares", "unit", "pairs", "pairs", "pairs", "pairs", "pairs", "pairs", "visionOverlap", "meanCosts*paid", "relationPairs*paid", "relationPairs*replacement", "squares*squares", "squares*ccComplement", "pairs*squares", "meanCosts*turn", "ccComplement", "actions*gas", "relationPairs", "meanCosts*paid", "actions*paid"];
const positionScales: readonly ScaleId[] = [
  "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "coords", "coords", "unit", "coords", "coords",
  "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit",
  "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "turn", "minerals", "gas", "minerals", "minerals", "unit", "unit", "unit", "unit", "squares", "squares", "squares", "squares", "coords", "squares", "squares", "squares", "unit", "squares", "unit", "minerals*minerals", "gas*gas", "minerals", "squares*minerals", "squares*minerals", "squares*minerals", "squares*replacement", "ccComplement", "squares", "coords", "coords*turn", "squares*paid",
];
const economicScales: readonly ScaleId[] = ["meanCosts*unit", "meanCosts*unit", "minerals*unit", "minerals*unit", "minerals*unit", "minerals*unit", "minerals*unit", "minerals*unit", "meanCosts", "minerals", "minerals", "minerals"];
const economicDomains = [[-576, 576], [0, 288], [-27648, 27648], [-13824, 288], [-1728, 1728], [-864, 216], [-27648, 27648], [0, 13824], [0, 1], [-48, 1], [-3, .75], [0, 48]] as const;
const ownData = (target: object, key: string, value: unknown): void => {
  const field = { __proto__: null, value, writable: false, configurable: false, enumerable: true };
  define(target, key, field);
};
const laneNames = (role: "queue" | "position" | "economic" | "promotion"): readonly string[] =>
  role === "queue" ? QUEUE_NAMES : role === "position" ? POSITION_NAMES : role === "economic" ? ECONOMIC_NAMES : promotionNames;
const putLane = (c: ConstructionContext, cursor: unknown, role: "queue" | "position" | "economic" | "promotion", index: number, value: number): void => {
  const storage = cursorFor(c, cursor, role);
  if (integer(index, storage.max - 1) !== storage.count) return constructionFail("ORDER");
  if (typeof value !== "number" || !finite(value)) return constructionFail("NUMBER");
  const low = role === "economic" ? economicDomains[index]![0] : role === "queue" && (index === 7 || index === 8) || role === "position" && index === 74 ? -1 : 0;
  const high = role === "economic" ? economicDomains[index]![1] : role === "queue" && index === 23 ? 0 : 1;
  if (value < low || value > high) return constructionFail("NUMBER");
  if (role === "position" && (index <= 10 || index === 13 || index >= 16 && index <= 51 || index >= 57 && index <= 60 || index === 69 || index === 71) && value !== 0 && value !== 1) return constructionFail("NUMBER");
  if (role === "promotion" && Math.round(value * 8) / 8 !== value) return constructionFail("NUMBER");
  push(storage.values, value); storage.count++;
};
const finishLanes = <T>(c: ConstructionContext, cursor: unknown, role: "queue" | "position" | "economic" | "promotion"): T => {
  const storage = cursorFor(c, cursor, role);
  if (storage.count !== storage.max) return constructionFail("CARDINALITY");
  const names = laneNames(role), result: Record<string, number> = {};
  for (let i = 0; i < names.length; i++) ownData(result, names[i]!, storage.values[i]);
  if (role === "position") {
    const p = result as Position84;
    if (p.present === 0 && storage.values.some(v => v !== 0)) return constructionFail("DERIVED");
    if (p.present !== 0) {
      if (p['to.present'] === 0 && (p['to.file'] !== 0 || p['to.rank'] !== 0) || p['target.memory.present'] === 0 && p['target.memory.age'] !== 0 ||
        p['actor.paidKnown'] === 0 && p['actor.paid'] !== 0 || p['ray.applicable'] === 0 && (p['path.knownEmpty'] !== 0 || p['path.knownOccupied'] !== 0 || p['path.unknown'] !== 0)) return constructionFail("DERIVED");
      if (p['actor.absent'] === 1) for (let i = 32; i <= 71; i++) if ((i <= 39 || i === 56 || i >= 65) && storage.values[i] !== 0) return constructionFail("DERIVED");
      for (const [low, high] of [[1, 8], [8, 11], [16, 22], [22, 28], [40, 45]]) {
        let sum = 0;
        for (let i = low!; i < high!; i++) sum += storage.values[i] as number;
        if (sum !== 1) return constructionFail("DERIVED");
      }
      if (p['actor.known'] + p['actor.absent'] !== (p['actor.nominal'] && !p['actor.known'] ? 0 : 1) || p['actor.paidKnown'] !== p['actor.known'] ||
        p['ray.open'] + p['ray.blocked'] + p['ray.uncertain'] !== p['ray.applicable'] || p['timing.C'] !== p['kind.classical'] ||
        p['ix.exposurePaidKnown'] !== p['exposure.known'] * p['actor.paid'] * p['actor.paidKnown'] ||
        p['ix.exposurePaidPossible'] !== p['exposure.possible'] * p['actor.paid'] * p['actor.paidKnown'] || p['ix.exposureReplacement'] !== p['exposure.known'] * p['actor.replacement']) return constructionFail("DERIVED");
    }
  }
  storage.live = false;
  return publish(result, role) as T;
};
export const beginQueue34 = (c: ConstructionContext) => beginCursor<number>(c, "queue", 34, 34);
export const putQueue34 = (c: ConstructionContext, cursor: OwnedCursor<number>, index: number, value: number) => putLane(c, cursor, "queue", index, value);
export const finishQueue34 = (c: ConstructionContext, cursor: OwnedCursor<number>) => finishLanes<Queue34>(c, cursor, "queue");
export const beginPosition84 = (c: ConstructionContext) => beginCursor<number>(c, "position", 84, 84);
export const putPosition84 = (c: ConstructionContext, cursor: OwnedCursor<number>, index: number, value: number) => putLane(c, cursor, "position", index, value);
export const finishPosition84 = (c: ConstructionContext, cursor: OwnedCursor<number>) => finishLanes<Position84>(c, cursor, "position");
export const beginEconomic12 = (c: ConstructionContext) => beginCursor<number>(c, "economic", 12, 12);
export const putEconomic12 = (c: ConstructionContext, cursor: OwnedCursor<number>, index: number, value: number) => putLane(c, cursor, "economic", index, value);
export const finishEconomic12 = (c: ConstructionContext, cursor: OwnedCursor<number>) => finishLanes<Economic12>(c, cursor, "economic");
export const beginPromotion36 = (c: ConstructionContext) => beginCursor<number>(c, "promotion", 36, 36);
export const putPromotion36 = (c: ConstructionContext, cursor: OwnedCursor<number>, index: number, value: number) => putLane(c, cursor, "promotion", index, value);
export const finishPromotion36 = (c: ConstructionContext, cursor: OwnedCursor<number>) => finishLanes<Promotion36>(c, cursor, "promotion");
export const makeFeatureBlocks = (c: ConstructionContext, queue: Queue34, p0: Position84, p1: Position84, p2: Position84, p3: Position84, economic: Economic12, promotion: Promotion36): FeatureBlocksV3 => {
  contextWork(c, false, 2048); requireRole(queue, "queue"); requireRole(p0, "position"); requireRole(p1, "position"); requireRole(p2, "position"); requireRole(p3, "position"); requireRole(economic, "economic"); requireRole(promotion, "promotion");
  if (economic.spend !== .5 * (queue.requestedMinerals + queue.requestedGas) || queue['timing.CCount'] === 0 && economic.trade !== 0) return constructionFail("DERIVED");
  for (const name of ["deploy", "trade", "protection"] as const) if (Math.round(economic[name] * 12) / 12 !== economic[name]) return constructionFail("NUMBER");
  let count = 0, b = 0, classical = 0, f = 0;
  for (const position of [p0, p1, p2, p3]) {
    count += position.present; b += position['timing.B']; classical += position['timing.C']; f += position['timing.F'];
  }
  if (queue.actionCount !== count / 4 || queue.pass !== (count === 0 ? 1 : 0) || queue['timing.BCount'] !== b / 4 || queue['timing.CCount'] !== classical / 4 || queue['timing.FCount'] !== f / 4) return constructionFail("DERIVED");
  for (let i = 0; i < 4; i++) {
    const factor = economic[ECONOMIC_NAMES[8 + i]!];
    if (factor === 0 && (economic[ECONOMIC_NAMES[2 * i]!] !== 0 || economic[ECONOMIC_NAMES[2 * i + 1]!] !== 0)) return constructionFail("DERIVED");
  }
  const positions = publish([p0, p1, p2, p3] as const, "positions");
  return publish({ version: "challenge-features-v3", queue, positions, economic, promotion } as const, "features");
};
export const makeCanonicalManifestV3 = (c: ConstructionContext): FeatureManifestV3 => {
  contextWork(c, true, 65536); const names: string[] = [], entries: ManifestEntry[] = [];
  for (let i = 0; i < 418; i++) {
    let name: string, meaningId: ManifestEntry['meaningId'], scaleId: ScaleId;
    if (i < 34) { name = `queue.${QUEUE_NAMES[i]}`; meaningId = `q:${i}`; scaleId = queueScales[i]!; }
    else if (i < 370) { const lane = (i - 34) % 84; name = `position.${floor((i - 34) / 84)}.${POSITION_NAMES[lane]}`; meaningId = `p:${lane}`; scaleId = positionScales[lane]!; }
    else if (i < 382) { const lane = i - 370; name = `economic.${ECONOMIC_NAMES[lane]}`; meaningId = `e:${lane}`; scaleId = economicScales[lane]!; }
    else { const lane = i - 382; name = `promotion.${promotionNames[lane]}`; meaningId = `promo:${floor(lane / 6)}:${floor(lane / 3) % 2}:${lane % 3 + 1 as 1 | 2 | 3}`; scaleId = "files"; }
    push(names, name); push(entries, publish({ name, meaningId, scaleId }, "manifest-entry"));
  }
  const scales = publish({ minerals: 12, gas: 3, turn: 45, ccLives: 3, maxSpawn: 9, paid: 3072, replacement: 2304, coords: 7, squares: 64, actions: 4, pairs: 6, relationPairs: 4096, visionOverlap: 256, files: 8 } as const, "scales");
  return publish({ version: "challenge-feature-manifest-v3", dimension: 418, names: publish(names, "manifest-names"), entries: publish(entries, "manifest-entries"), scales } as const, "manifest");
};
export const makeEconomicPin = (c: ConstructionContext, economicArtifactRef: OwnedByteRef, estimatorProvenanceRef: OwnedByteRef, featureManifestRef: OwnedByteRef, amendmentRef: OwnedByteRef): EconomicPin => {
  contextWork(c, true, 1024); requireRef(economicArtifactRef); requireRef(estimatorProvenanceRef); requireRef(featureManifestRef); requireRef(amendmentRef);
  return publish({ version: "starchess-economic-pin-v1", economicArtifactRef, estimatorProvenanceRef, featureManifestRef, amendmentRef } as const, "pin");
};
export const makeEconomicBinding = (c: ConstructionContext, policyArtifactRef: OwnedByteRef, economicArtifactRef: OwnedByteRef, estimatorProvenanceRef: OwnedByteRef, featureManifestRef: OwnedByteRef, amendmentRef: OwnedByteRef): EconomicBinding => {
  contextWork(c, true, 1024); requireRef(policyArtifactRef); requireRef(economicArtifactRef); requireRef(estimatorProvenanceRef); requireRef(featureManifestRef); requireRef(amendmentRef);
  return publish({ version: "starchess-economic-binding-v1", policyArtifactRef, economicArtifactRef, estimatorProvenanceRef, featureManifestRef, amendmentRef } as const, "binding");
};
export const makeEstimatorProvenance = (c: ConstructionContext, economicArtifactRef: OwnedByteRef, coreRulesRef: OwnedByteRef, fittingCodeRef: OwnedByteRef, collectionRecipeRef: OwnedByteRef,
  fittingRecipeRef: OwnedByteRef, collectionRosterRef: OwnedByteRef, splitRosterRef: OwnedByteRef, labelBytesRef: OwnedByteRef, fitJournalRef: OwnedByteRef, calibrationJournalRef: OwnedByteRef): EstimatorProvenance => {
  contextWork(c, true, 2048);
  for (const ref of [economicArtifactRef, coreRulesRef, fittingCodeRef, collectionRecipeRef, fittingRecipeRef, collectionRosterRef, splitRosterRef, labelBytesRef, fitJournalRef, calibrationJournalRef]) requireRef(ref);
  return publish({ version: "starchess-estimator-provenance-v1", economicArtifactRef, coreRulesRef, fittingCodeRef, collectionRecipeRef, fittingRecipeRef, collectionRosterRef, splitRosterRef, labelBytesRef, fitJournalRef, calibrationJournalRef } as const, "provenance");
};
export const makeEconomicAuthority = (c: ConstructionContext, contractsRef: OwnedByteRef, r2GeneratorRef: OwnedByteRef, baseRef: OwnedByteRef, correctiveRef: OwnedByteRef,
  r3SeamRef: OwnedByteRef, r3NativeCorrectionRef: OwnedByteRef, ownedIngressRef: OwnedByteRef): EconomicAuthority => {
  contextWork(c, true, 2048); for (const ref of [contractsRef, r2GeneratorRef, baseRef, correctiveRef, r3SeamRef, r3NativeCorrectionRef, ownedIngressRef]) requireRef(ref);
  return publish({ version: "starchess-economic-authority-v1", contractsRef, r2GeneratorRef, baseRef, correctiveRef, r3SeamRef, r3NativeCorrectionRef, ownedIngressRef } as const, "authority");
};
export const makeHostLimits = (c: ConstructionContext): HostLimits => {
  contextWork(c, true, 1024); return publish({ startupMs: 10000, planMs: 10000, matchMs: 300000, maxWindows: 64, maxRecordedPlies: 128, maxProposals: 4096, maxIpcMessages: 2048, maxProgressBytes: 1048576, maxCompletionBytes: 16777216 } as const, "limits");
};
export const makeValidation = (c: ConstructionContext, eps: OwnedFloat64Hex, atol: OwnedFloat64Hex, rtol: OwnedFloat64Hex): Configuration418['validation'] => {
  contextWork(c, true, 1024); if (hNumber(eps) !== 1e-6 || hNumber(atol) !== 1e-8 || hNumber(rtol) !== 1e-5) return constructionFail("DERIVED");
  return publish({ profile: "A", eps: publish([eps] as const, "eps"), atol, rtol } as const, "validation");
};
export const makeConfiguration418 = (c: ConstructionContext, learningRate: OwnedFloat64Hex, temperature: OwnedFloat64Hex, l2: OwnedFloat64Hex,
  openingRef: OwnedByteRef, hostLimits: HostLimits, validation: Configuration418['validation']): Configuration418 => {
  contextWork(c, true, 4096); requireRef(openingRef); requireRole(hostLimits, "limits"); requireRole(validation, "validation");
  if (hNumber(learningRate) !== .001 || hNumber(temperature) !== 1 || hNumber(l2) !== .0001) return constructionFail("DERIVED");
  const profiles = publish({ api: "A", provenance: "A", quota: "B", curriculum: "A", validation: "A" } as const, "profiles"), masters = publish([101, 102, 103, 104, 105] as const, "masters");
  return publish({ profiles, horizon: 1, dimension: 418, uniqueCap: 512, workCap: 2048, maxGeneratedActions: 4, familyCapacity: 48, compositionCapacity: 175, passCapacity: 1,
    maxStartedPerMaster: 1000, masters, checkpointCadence: 100, initialization: "zeros", arithmetic: "float64-cpu", optimizer: "SGD", learningRate, temperature, l2, clipping: "none",
    baseline: "per-seed-all-history-eligible-mean", emptyDecision: "diagnostic-only", abortPolicy: "stop-all", primaryMaster: 101, openingRef, hostLimits, validation } as const, "configuration");
};
export const makeVersions418 = (c: ConstructionContext): Versions418 => {
  contextWork(c, true, 2048); return publish({ snapshot: "challenge-observation-v2", observationCodec: "challenge-observation-codec-v2", history: "challenge-history-v2",
    batch: "challenge-boundary-batch-v1", ledger: "challenge-economic-ledger-v1", provenance: "engine-provenance-v1", candidateCodec: "challenge-candidate-codec-v1",
    generator: "challenge-composition-v3", projection: "authorized-own-projection-v1", features: "challenge-features-v3", featureManifest: "challenge-feature-manifest-v3",
    comparator: "score-desc-key-asc-v1", rng: "starchess-training-rng-v1", episodeProtocol: "starchess-training-episode-v2", checkpoint: "starchess-training-checkpoint-v2",
    artifact: "starchess-training-artifact-v2", optimizer: "starchess-sgd-float64-v1", loss: "starchess-reinforce-sum-v1", eligibility: "starchess-training-eligibility-v1",
    recipe: "starchess-training-recipe-v2", hostConfig: "starchess-training-host-v2" } as const, "versions");
};
export const makeTrainingRecipe = (c: ConstructionContext, configuration: Configuration418, versions: Versions418, economicPinRef: OwnedByteRef): TrainingRecipeV2 => {
  contextWork(c, true, 1024); requireRole(configuration, "configuration"); requireRole(versions, "versions"); requireRef(economicPinRef);
  return publish({ version: "starchess-training-recipe-v2", configuration, versions, economicPinRef } as const, "training-recipe");
};
