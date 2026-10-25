// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const CONTAINMENT_METADATA_SOURCE_PIN = Object.freeze({ bytes: 19928, sha256: '249480f9af1b172c83f5f554184df1cfd486d6e7b98a2af4d60ca6433efb6401' });
const SOURCE = '/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/containment-metadata.mjs';
const SECURITY = Object.freeze(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink']);
const TYPED = Object.getPrototypeOf(Uint8Array.prototype);
const LENGTH = Object.getOwnPropertyDescriptor(TYPED, 'length').get;
const BACKING = Object.getOwnPropertyDescriptor(TYPED, 'buffer').get;
const OFFSET = Object.getOwnPropertyDescriptor(TYPED, 'byteOffset').get;
const ARRAY_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const RESIZABLE = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const CODES = new Set(['E_ARGUMENTS', 'E_SOURCE_PIN', 'E_SOURCE_METADATA', 'E_SOURCE_FLAGS',
  'E_SOURCE_IO', 'E_SOURCE_CLOSE', 'E_CLOCK', 'E_DEADLINE', 'E_RESULT', 'E_OBSERVATION', 'E_OUTPUT']);
const fail = code => { const error = new Error(code); error.code = code; throw error; };

export function captureRegisteredContainmentMetadataSource(raw) {
  if (!raw || types.isProxy(raw) || !Buffer.isBuffer(raw) || Object.getPrototypeOf(raw) !== Buffer.prototype) fail('E_SOURCE_PIN');
  for (const key of ['length', 'byteLength', 'buffer', 'byteOffset']) {
    if (Object.getOwnPropertyDescriptor(raw, key)) fail('E_SOURCE_PIN');
  }
  let bytes;
  try {
    const length = LENGTH.call(raw), backing = BACKING.call(raw);
    ARRAY_LENGTH.call(backing);
    if (RESIZABLE?.call(backing) || length > 100000 || length !== CONTAINMENT_METADATA_SOURCE_PIN.bytes) fail('E_SOURCE_PIN');
    bytes = Buffer.alloc(length);
    Uint8Array.prototype.set.call(bytes, new Uint8Array(backing, OFFSET.call(raw), length));
  } catch { fail('E_SOURCE_PIN'); }
  if (createHash('sha256').update(bytes).digest('hex') !== CONTAINMENT_METADATA_SOURCE_PIN.sha256) fail('E_SOURCE_PIN');
  return bytes;
}

function metadata(raw) {
  if (!raw || typeof raw !== 'object' || types.isProxy(raw)) fail('E_SOURCE_METADATA');
  const result = {};
  for (const key of SECURITY) {
    const field = Object.getOwnPropertyDescriptor(raw, key);
    if (!field || !Object.hasOwn(field, 'value') || typeof field.value !== 'bigint' ||
      field.value < 0n || field.value > 18446744073709551615n) fail('E_SOURCE_METADATA');
    result[key] = field.value;
  }
  if ((result.mode & 0o170000n) !== 0o100000n || result.mode > 4294967295n) fail('E_SOURCE_METADATA');
  return result;
}

// WHAT: Capture a bounded pinned helper, then import only its private data URL bytes.
export async function runRegisteredContainmentMetadata() {
  const counts = { sourceLstatAttempts: 0, sourceOpenAttempts: 0, sourceOpensCompleted: 0,
    sourceFstatAttempts: 0, sourceReadAttempts: 0, sourceReadsCompleted: 0,
    sourceRequestedReadBytes: 0, sourceReturnedReadBytes: 0, sourceCloseAttempts: 0,
    sourceClosesCompleted: 0, sourceImportsAttempted: 0, sourceImportsCompleted: 0, observationCalls: 0 };
  let started, last, fd = null, error = null, result = null, sourceAccountingComplete = false;
  const close = () => {
    if (fd === null) return;
    const owned = fd; fd = null; counts.sourceCloseAttempts++;
    try { fs.closeSync(owned); counts.sourceClosesCompleted++; }
    catch { fail('E_SOURCE_CLOSE'); }
  };
  function guard(milliseconds = 1000) {
    let now;
    try { now = process.hrtime.bigint(); } catch { fail('E_CLOCK'); }
    if (typeof now !== 'bigint' || now < 0n || (last !== undefined && now < last)) fail('E_CLOCK');
    if (started === undefined) started = now;
    last = now;
    if (now - started >= BigInt(milliseconds) * 1000000n) fail('E_DEADLINE');
  }
  try {
    guard();
    if (arguments.length !== 0) fail('E_ARGUMENTS');
    const constants = fs.constants, { O_RDONLY, O_NOFOLLOW, O_NONBLOCK } = constants;
    if (O_RDONLY !== 0 || ![O_NOFOLLOW, O_NONBLOCK].every(value => Number.isSafeInteger(value) &&
      value > 0 && value <= 0x40000000 && (value & (value - 1)) === 0 && (value & 3) === 0) ||
      (O_NOFOLLOW & O_NONBLOCK) !== 0) fail('E_SOURCE_FLAGS');
    counts.sourceLstatAttempts++; const namedBefore = metadata(fs.lstatSync(SOURCE, { bigint: true }));
    guard(); counts.sourceOpenAttempts++;
    fd = fs.openSync(SOURCE, O_RDONLY | O_NOFOLLOW | O_NONBLOCK); counts.sourceOpensCompleted++;
    guard(); counts.sourceFstatAttempts++; const descriptorBefore = metadata(fs.fstatSync(fd, { bigint: true }));
    if (!SECURITY.every(key => namedBefore[key] === descriptorBefore[key])) fail('E_SOURCE_METADATA');
    const raw = Buffer.alloc(CONTAINMENT_METADATA_SOURCE_PIN.bytes + 1);
    let length = 0;
    while (true) {
      guard();
      const request = Math.min(4096, raw.length - length);
      if (request <= 0 || counts.sourceReadAttempts >= 64 ||
        counts.sourceRequestedReadBytes + request > 100000) fail('E_SOURCE_PIN');
      counts.sourceReadAttempts++; counts.sourceRequestedReadBytes += request;
      const returned = fs.readSync(fd, raw, length, request, null);
      counts.sourceReadsCompleted++;
      if (!Number.isSafeInteger(returned) || returned < 0 || returned > request) fail('E_SOURCE_IO');
      counts.sourceReturnedReadBytes += returned; length += returned;
      if (length > CONTAINMENT_METADATA_SOURCE_PIN.bytes) fail('E_SOURCE_PIN');
      if (returned === 0) break;
    }
    guard(); counts.sourceFstatAttempts++; const descriptorAfter = metadata(fs.fstatSync(fd, { bigint: true }));
    guard(); counts.sourceLstatAttempts++; const namedAfter = metadata(fs.lstatSync(SOURCE, { bigint: true }));
    if (!SECURITY.every(key => namedBefore[key] === descriptorAfter[key] && namedBefore[key] === namedAfter[key])) fail('E_SOURCE_METADATA');
    close(); guard();
    const captured = captureRegisteredContainmentMetadataSource(raw.subarray(0, length));
    sourceAccountingComplete = true;
    guard(); counts.sourceImportsAttempted++;
    const helper = await import('data:text/javascript;base64,' + captured.toString('base64'));
    counts.sourceImportsCompleted++; guard();
    counts.observationCalls++;
    result = helper.observeContainmentMetadata();
    guard(6000);
    if (result.status === 'STOP' && result.mockOnly === false && result.observations === null) error = 'E_OBSERVATION';
    else if (result.status !== 'CONTAINMENT_METADATA_OBSERVED' || result.mockOnly !== false ||
      result.accountingComplete !== true || result.scope !== 'CONTAINMENT_METADATA_NOT_ENFORCEMENT_PROOF') fail('E_RESULT');
  } catch (caught) {
    const descriptor = caught && typeof caught === 'object' && !types.isProxy(caught) ? Object.getOwnPropertyDescriptor(caught, 'code') : null;
    error = descriptor && Object.hasOwn(descriptor, 'value') && CODES.has(descriptor.value) ? descriptor.value : 'E_SOURCE_IO';
    result = null;
  } finally {
    try { close(); } catch { error = 'E_SOURCE_CLOSE'; result = null; sourceAccountingComplete = false; }
  }
  const output = { profile: 'registered-containment-metadata-operation-v1',
    status: error ? 'STOP' : 'CONTAINMENT_METADATA_OBSERVED', error,
    sourcePin: CONTAINMENT_METADATA_SOURCE_PIN, sourceAccountingComplete, counts,
    pinScope: 'REPOSITORY_SOURCE_EQUALITY_NOT_AUTHENTICATION_OR_CONTAINMENT',
    scope: 'CONTAINMENT_METADATA_NOT_ENFORCEMENT_PROOF',
    counterScope: 'logical Node attempts/completions; source requested and returned bytes are distinct',
    observationAccountingComplete: result?.accountingComplete === true, result,
    nativeQualified: false, rustReady: false, trainingReady: false, containmentEstablished: false,
    hardDeadlineGuaranteed: false, ancestorProtectionProven: false, atomicSnapshotGuaranteed: false };
  let serialized = JSON.stringify(output) + '\n';
  if (!/^[\x20-\x7e]*\n$/.test(serialized) || Buffer.byteLength(serialized) > 16384) {
    error = 'E_OUTPUT'; output.status = 'STOP'; output.error = error; output.result = null;
    output.observationAccountingComplete = false;
    serialized = JSON.stringify(output) + '\n';
  }
  return Object.freeze({ exitCode: error ? 1 : 0, text: serialized });
}
