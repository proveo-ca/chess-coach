// SPEC: _spec/tooling/native-ingress/step2.puml
import { createHash } from 'node:crypto';
import { types } from 'node:util';

const TYPED = Object.getPrototypeOf(Uint8Array.prototype);
const BYTE_LENGTH = Object.getOwnPropertyDescriptor(TYPED, 'byteLength').get;
const BACKING = Object.getOwnPropertyDescriptor(TYPED, 'buffer').get;
const OFFSET = Object.getOwnPropertyDescriptor(TYPED, 'byteOffset').get;
const ARRAY_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const RESIZABLE = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const SET = Uint8Array.prototype.set;

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const graphPins = freeze({
  raw: { bytes: 19649, sha256: '1a625ec28479ac28efeaa19a51095924f7db5c48524a1cd74570e0c4b7f3890f' },
  profile: { bytes: 19649, sha256: '2ba1287648b7c42bdd5abcd8f36d77c726e7bbc7b67cc66440898ff2080381ca' },
  bodyLimits: { bytes: 19652, sha256: 'c6c7fe77de2115988cc80f110193d145565e7a7811e170cf733a2bb280141b6d' },
  outputLimit: { bytes: 19653, sha256: '76dd78b668d5cf71c73f229b3f85afb0aab9752b391e5a3269a269938ea9bd69' },
  entryNames: { bytes: 19653, sha256: 'fe18ce7d1df28e5113b6c1273c7c53722bb17fdc4c096666007779dcaa796d53' },
  policyNames: { bytes: 19653, sha256: '243026d3f1b63abc6674102d55a89c0950bac86a97f318bbac52de96e8eaf7d9' },
  routed: { bytes: 19644, sha256: 'f5ce1d23732051048b8ea10499d4cf1e861bfc74bc31f0febbde95d070e129a1' },
  clockBridge: { bytes: 794, sha256: '28bbe878605dc95eaa7d15d27e1ae9d162c86a755e7d76f8f8e69a97291cf334' },
  final: { bytes: 20438, sha256: 'ece2c9edbb3068bc65ce78454b7f8dbc5236d36f046849f4f30085c58c567557' },
});
const policyPin = freeze({ bytes: 1027, sha256: '47336055ae39a95bdccb99e4a3fcee3a5618016fd946c6d15f1300a4a6e1ef16' });

export const BOOTLIN_DIRECTORY_METADATA_V2_PINS = freeze({ ...graphPins, policy: policyPin });

const CLOCK_BRIDGE = `
let SOURCE_PARENT_ORIGIN = null, SOURCE_FIRST_CLOCK = true;
export function SOURCE_BIND_PARENT_CLOCK_ORIGIN(origin) {
  if (arguments.length !== 1 || SOURCE_PARENT_ORIGIN !== null || !Number.isFinite(origin) || origin < 0 || origin > Number.MAX_SAFE_INTEGER - 30000) fail('E_CLOCK');
  const current = Reflect.apply(NOW, CLOCK, []);
  if (!Number.isFinite(current) || current < origin || current - origin >= 10000) fail('E_CLOCK');
  SOURCE_PARENT_ORIGIN = origin;
}
function SOURCE_CAPTURE_NOW() {
  if (SOURCE_PARENT_ORIGIN === null) fail('E_CLOCK');
  const current = Reflect.apply(NOW, CLOCK, []);
  if (!Number.isFinite(current) || current < SOURCE_PARENT_ORIGIN) fail('E_CLOCK');
  if (SOURCE_FIRST_CLOCK) { SOURCE_FIRST_CLOCK = false; return SOURCE_PARENT_ORIGIN; }
  return current;
}
`;

function fail(code) { throw new Error(code); }

function verify(bytes, pin) {
  if (bytes.byteLength !== pin.bytes || createHash('sha256').update(bytes).digest('hex') !== pin.sha256) fail('E_PIN');
}

function replace(source, oldText, newText, count, pin) {
  const parts = source.split(oldText);
  if (parts.length !== count + 1) fail('E_TRANSFORM');
  const result = parts.join(newText);
  verify(Buffer.from(result, 'ascii'), pin);
  return result;
}

export function buildBootlinDirectoryMetadataV2Source(rawV1Buffer) {
  if (arguments.length !== 1) fail('E_ARGUMENTS');
  if (!rawV1Buffer || types.isProxy(rawV1Buffer) || !types.isUint8Array(rawV1Buffer) ||
      !Buffer.isBuffer(rawV1Buffer) || Object.getPrototypeOf(rawV1Buffer) !== Buffer.prototype) fail('E_BUFFER');
  let backing, offset, length;
  try {
    length = BYTE_LENGTH.call(rawV1Buffer);
    if (length !== graphPins.raw.bytes) fail('E_BUFFER');
    backing = BACKING.call(rawV1Buffer);
    ARRAY_LENGTH.call(backing);
    if (RESIZABLE?.call(backing)) fail('E_BUFFER');
    offset = OFFSET.call(rawV1Buffer);
  } catch { fail('E_BUFFER'); }
  const keys = Reflect.ownKeys(rawV1Buffer);
  if (keys.length !== length) fail('E_BUFFER');
  for (let index = 0; index < length; index++) {
    if (keys[index] !== String(index)) fail('E_BUFFER');
    const descriptor = Object.getOwnPropertyDescriptor(rawV1Buffer, keys[index]);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('E_BUFFER');
  }
  const copy = new Uint8Array(length);
  Reflect.apply(SET, copy, [new Uint8Array(backing, offset, length)]);
  verify(copy, graphPins.raw);
  if (copy.some(byte => byte > 127)) fail('E_PIN');
  let source = Buffer.from(copy.buffer, copy.byteOffset, copy.byteLength).toString('ascii');
  source = replace(source, "const PROFILE = 'registered-bootlin-directories-v1';", "const PROFILE = 'registered-bootlin-directories-v2';", 1, graphPins.profile);
  source = replace(source, 'bodyBytes: 65536, aggregateBodyBytes: 131072,', 'bodyBytes: 1048576, aggregateBodyBytes: 2097152,', 1, graphPins.bodyLimits);
  source = replace(source, 'outputBytes: 1048576, outputDepth: 64, outputNodes: 100000,', 'outputBytes: 16777216, outputDepth: 64, outputNodes: 100000,', 1, graphPins.outputLimit);
  source = replace(source, 'collectRegisteredBootlinDirectoriesV1', 'collectRegisteredBootlinDirectoriesV2', 2, graphPins.entryNames);
  source = replace(source, 'BOOTLIN_DIRECTORY_METADATA_V1_PROFILE', 'BOOTLIN_DIRECTORY_METADATA_V2_PROFILE', 2, graphPins.policyNames);
  source = replace(source, 'now: () => Reflect.apply(NOW, CLOCK, []),', 'now: () => SOURCE_CAPTURE_NOW(),', 1, graphPins.routed);
  verify(Buffer.from(CLOCK_BRIDGE, 'ascii'), graphPins.clockBridge);
  source += CLOCK_BRIDGE;
  verify(Buffer.from(source, 'ascii'), graphPins.final);
  return freeze({ profile: 'BOOTLIN_DIRECTORY_METADATA_V2_SOURCE', sourceText: source, graphPins, policyPin });
}
