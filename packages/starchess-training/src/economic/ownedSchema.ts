// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { readSnapshotByte, requireSnapshot, snapshotLength } from "./ownedBytes";
import { rejectOwned } from "./ownedErrors";
import {
  constructCanonicalOpening, constructFloat64Hex, constructRef,
  OPENING_CANONICAL_BYTES_TEXT, requireFloat64Hex, requireOpening, requireRef,
  type OwnedByteRef, type OwnedByteSnapshot, type OwnedFloat64Hex, type OwnedPublicOpening,
} from "./ownedKernel";

const FLOAT64_PREFIX = '{"hex":"';
const REF_PREFIX = '{"byteLength":';
const REF_MIDDLE = ',"sha256":"';
const RECORD_END = '"}';
const FixedUint8Array = Uint8Array;
const repeat = Array.from.bind(Array);
const codeAt = Function.prototype.call.bind(String.prototype.charCodeAt);
const fromCode = String.fromCharCode;
const join = Function.prototype.call.bind(Array.prototype.join);
const integerText = Function.prototype.call.bind(Number.prototype.toString);
const maximumSafeInteger = Number.MAX_SAFE_INTEGER;
const floor = Math.floor;

const requireLiteral = (snapshot: OwnedByteSnapshot, start: number, literal: string): void => {
  for (let index = 0; index < literal.length; index++) {
    if (readSnapshotByte(snapshot, start + index) !== codeAt(literal, index)) rejectOwned("CANONICAL");
  }
};

const readLowerHex = (snapshot: OwnedByteSnapshot, start: number, length: number): string => {
  const slots = { __proto__: null, length };
  const characters = repeat(slots, () => "");
  for (let index = 0; index < length; index++) {
    const byte = readSnapshotByte(snapshot, start + index);
    if (!((byte >= 48 && byte <= 57) || (byte >= 97 && byte <= 102))) rejectOwned("CANONICAL");
    characters[index] = fromCode(byte);
  }
  return join(characters, "") as string;
};

const emitAscii = (segments: readonly string[]): Uint8Array => {
  let length = 0;
  for (let index = 0; index < segments.length; index++) length += segments[index]!.length;
  const bytes = new FixedUint8Array(length);
  let offset = 0;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!;
    for (let character = 0; character < segment.length; character++) bytes[offset++] = codeAt(segment, character);
  }
  return bytes;
};

export const decodeOwnedFloat64Hex = (value: unknown): OwnedFloat64Hex => {
  const snapshot = requireSnapshot(value, "float64");
  if (snapshotLength(snapshot) !== 26) rejectOwned("CANONICAL");
  requireLiteral(snapshot, 0, FLOAT64_PREFIX);
  const hex = readLowerHex(snapshot, FLOAT64_PREFIX.length, 16);
  requireLiteral(snapshot, 24, RECORD_END);
  return constructFloat64Hex(hex);
};

export const decodeOwnedRef = (value: unknown): OwnedByteRef => {
  const snapshot = requireSnapshot(value, "ref");
  const digitCount = snapshotLength(snapshot) - REF_PREFIX.length - REF_MIDDLE.length - 64 - RECORD_END.length;
  if (digitCount < 1 || digitCount > 16) rejectOwned("CANONICAL");
  requireLiteral(snapshot, 0, REF_PREFIX);
  let byteLength = 0;
  for (let index = 0; index < digitCount; index++) {
    const digit = readSnapshotByte(snapshot, REF_PREFIX.length + index);
    if (digit < 48 || digit > 57 || (index === 0 && digitCount > 1 && digit === 48)) rejectOwned("CANONICAL");
    const value = digit - 48;
    if (byteLength > floor((maximumSafeInteger - value) / 10)) rejectOwned("REF");
    byteLength = byteLength * 10 + value;
  }
  const middleStart = REF_PREFIX.length + digitCount;
  requireLiteral(snapshot, middleStart, REF_MIDDLE);
  const hashStart = middleStart + REF_MIDDLE.length;
  const sha256 = readLowerHex(snapshot, hashStart, 64);
  requireLiteral(snapshot, hashStart + 64, RECORD_END);
  return constructRef(byteLength, sha256);
};

export const decodeOwnedOpening = (value: unknown): OwnedPublicOpening => {
  const snapshot = requireSnapshot(value, "opening");
  if (snapshotLength(snapshot) !== OPENING_CANONICAL_BYTES_TEXT.length) rejectOwned("CANONICAL");
  requireLiteral(snapshot, 0, OPENING_CANONICAL_BYTES_TEXT);
  return constructCanonicalOpening();
};

export const encodeOwnedFloat64Hex = (value: unknown): Uint8Array => {
  const owned = requireFloat64Hex(value);
  return emitAscii([FLOAT64_PREFIX, owned.hex, RECORD_END]);
};

export const encodeOwnedRef = (value: unknown): Uint8Array => {
  const owned = requireRef(value);
  return emitAscii([REF_PREFIX, integerText(owned.byteLength, 10) as string, REF_MIDDLE, owned.sha256, RECORD_END]);
};

export const encodeOwnedOpening = (value: unknown): Uint8Array => {
  requireOpening(value);
  return emitAscii([OPENING_CANONICAL_BYTES_TEXT]);
};
