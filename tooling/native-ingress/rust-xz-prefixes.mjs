// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

const freeze = value => {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};
export const RUST_XZ_PREFIX_INPUTS = freeze({
  root: '/tmp/opencode/f9-rust-runtime-inputs-01',
  rootFinal: { dev: '28', ino: '13954', mode: '16832', uid: '1000', gid: '1000', nlink: '2', size: '4096', mtimeNs: '1792857301045485610', ctimeNs: '1792857301045485610' },
  inputs: [
    { role: 'cargo', name: 'cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz', byteLength: 10984780, expectedWholeSha256: 'e74edd2cf7d0f1f1383b4f00eb90c843750bc489e2ccf7214e6476678a907425', finalMetadata: { dev: '29', ino: '1211150', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '10984780', mtimeNs: '1792857299153485617', ctimeNs: '1792857299153485617' } },
    { role: 'rustc', name: 'rustc-1.95.0-x86_64-unknown-linux-gnu.tar.xz', byteLength: 80351960, expectedWholeSha256: '8426a3d170a5879f5682f5fbdd024a1779b3951e7baba685af2d6dc32a6dfc15', finalMetadata: { dev: '29', ino: '1211151', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '80351960', mtimeNs: '1792857300349485612', ctimeNs: '1792857300349485612' } },
    { role: 'rust-std', name: 'rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.xz', byteLength: 29573972, expectedWholeSha256: '047ea7098803d3500fa1072e9cee5392697e21525559e4458128a2bf874aa382', finalMetadata: { dev: '29', ino: '1211153', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '29573972', mtimeNs: '1792857300901485610', ctimeNs: '1792857300901485610' } },
    { role: 'rustfmt-preview', name: 'rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.xz', byteLength: 2164880, expectedWholeSha256: 'f1b2a7301513ffdd95ebf22ebbdd932e4d17fc806f748d93924740d0297b1396', finalMetadata: { dev: '29', ino: '1211154', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '2164880', mtimeNs: '1792857301041485610', ctimeNs: '1792857301041485610' } },
    { role: 'clippy-preview', name: 'clippy-1.95.0-x86_64-unknown-linux-gnu.tar.xz', byteLength: 4697128, expectedWholeSha256: 'ac779bc9839dd47180806b133e4e2563c4a34716284cd5b8fede8ef289f452ca', finalMetadata: { dev: '29', ino: '1211155', mode: '33152', uid: '1000', gid: '1000', nlink: '1', size: '4697128', mtimeNs: '1792857301361485608', ctimeNs: '1792857301361485608' } },
  ],
});
export const RUST_XZ_PREFIX_LIMITS = freeze({ prefixBytes: 1040, files: 5, totalPrefixBytes: 5200,
  fsOperations: 100, opens: 6, closeAttempts: 6, reads: 5, peakOwnedFds: 2,
  clockReads: 512, workMilliseconds: 4000, cleanupMilliseconds: 1000, totalMilliseconds: 5000,
  outputBytes: 16384, sourceBytes: 100000 });
const SCOPE = 'PREFIX_DECLARATIONS_NOT_FULL_ARCHIVE_INTEGRITY_OR_DECODER_MEMORY_PROOF';
const FIELDS = Object.freeze(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']);
const TYPED = Object.getPrototypeOf(Uint8Array.prototype);
const LENGTH = Object.getOwnPropertyDescriptor(TYPED, 'length').get;
const BACKING = Object.getOwnPropertyDescriptor(TYPED, 'buffer').get;
const OFFSET = Object.getOwnPropertyDescriptor(TYPED, 'byteOffset').get;
const ARRAY_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const RESIZABLE = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const SET = Uint8Array.prototype.set;
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const requireThat = (ok, code) => { if (!ok) fail(code); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const CODES = new Set(['E_BYTES', 'E_LENGTH', 'E_MAGIC', 'E_STREAM_FLAGS', 'E_STREAM_CRC',
  'UNSUPPORTED_FIRST_BLOCK', 'E_BLOCK_LENGTH', 'E_BLOCK_FLAGS', 'E_BLOCK_CRC', 'E_VLI',
  'UNSUPPORTED_FILTER', 'E_PROPERTIES', 'E_PADDING', 'E_RECEIPT', 'E_METADATA', 'E_BINDING',
  'E_FLAGS', 'E_IO', 'E_CLOSE', 'E_CLOCK', 'E_DEADLINE', 'E_LIMIT', 'E_OUTPUT', 'E_MOCK_TCB']);

function snapshot(raw, maximum, code = 'E_BYTES') {
  requireThat(raw && !types.isProxy(raw) && types.isUint8Array(raw), code);
  requireThat([Buffer.prototype, Uint8Array.prototype].includes(Object.getPrototypeOf(raw)), code);
  for (const key of ['length', 'byteLength', 'buffer', 'byteOffset']) {
    requireThat(!Object.getOwnPropertyDescriptor(raw, key), code);
  }
  try {
    const length = LENGTH.call(raw), backing = BACKING.call(raw);
    ARRAY_LENGTH.call(backing);
    requireThat(!RESIZABLE?.call(backing), code);
    requireThat(length <= maximum, code);
    const bytes = Buffer.alloc(length);
    SET.call(bytes, new Uint8Array(backing, OFFSET.call(raw), length));
    return bytes;
  } catch { fail(code); }
}

function crc32(bytes, start, end) {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function crc32XzPrefix(raw) {
  const bytes = snapshot(raw, 1040);
  return crc32(bytes, 0, bytes.length);
}

// WHAT: First-stream and first-block declarations from a bounded private byte snapshot.
export function inspectXzPrefix(raw) {
  const bytes = snapshot(raw, 1040);
  requireThat(bytes.length >= 13, 'E_LENGTH');
  requireThat(bytes.subarray(0, 6).equals(Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0])), 'E_MAGIC');
  requireThat(bytes[6] === 0 && [0, 1, 4, 10].includes(bytes[7]), 'E_STREAM_FLAGS');
  requireThat(crc32(bytes, 6, 8) === bytes.readUInt32LE(8), 'E_STREAM_CRC');
  requireThat(bytes[12] !== 0, 'UNSUPPORTED_FIRST_BLOCK');
  const blockHeaderBytes = (bytes[12] + 1) * 4, end = 12 + blockHeaderBytes, crcAt = end - 4;
  requireThat(blockHeaderBytes <= 1024 && end <= bytes.length, 'E_BLOCK_LENGTH');
  requireThat((bytes[13] & 0x3c) === 0, 'E_BLOCK_FLAGS');
  requireThat(crc32(bytes, 12, crcAt) === bytes.readUInt32LE(crcAt), 'E_BLOCK_CRC');
  const flags = bytes[13], filterCount = (flags & 3) + 1;
  let cursor = 14;
  function vli() {
    let value = 0n;
    for (let i = 0; i < 9; i++) {
      requireThat(cursor < crcAt, 'E_VLI');
      const byte = bytes[cursor++];
      value |= BigInt(byte & 127) << BigInt(i * 7);
      if ((byte & 128) === 0) {
        requireThat(i === 0 || byte !== 0, 'E_VLI');
        return value;
      }
    }
    fail('E_VLI');
  }
  const compressedSizeDeclared = flags & 0x40 ? vli().toString() : null;
  requireThat(compressedSizeDeclared === null || BigInt(compressedSizeDeclared) > 0n, 'E_BLOCK_LENGTH');
  const uncompressedSizeDeclared = flags & 0x80 ? vli().toString() : null;
  const filters = [];
  let declaredDictionaryBytes;
  for (let index = 0; index < filterCount; index++) {
    const id = vli(), propertyLength = vli();
    requireThat(propertyLength <= BigInt(crcAt - cursor), 'E_PROPERTIES');
    const length = Number(propertyLength), properties = bytes.subarray(cursor, cursor + length);
    cursor += length;
    const filter = { id: id.toString(), propertiesHex: properties.toString('hex') };
    if (index === filterCount - 1) {
      requireThat(id === 0x21n, 'UNSUPPORTED_FILTER');
      requireThat(length === 1 && properties[0] <= 40, 'E_PROPERTIES');
      const property = properties[0];
      declaredDictionaryBytes = (property === 40 ? 4294967295n :
        (2n | BigInt(property & 1)) << BigInt(Math.floor(property / 2) + 11)).toString();
      filter.declaredDictionaryBytes = declaredDictionaryBytes;
    } else if (id === 0x04n) {
      requireThat(length === 0 || length === 4, 'E_PROPERTIES');
    } else if (id === 0x03n) {
      requireThat(length === 1, 'E_PROPERTIES');
    } else fail('UNSUPPORTED_FILTER');
    filters.push(filter);
  }
  for (; cursor < crcAt; cursor++) requireThat(bytes[cursor] === 0, 'E_PADDING');
  return freeze({ streamCheckId: bytes[7], blockHeaderBytes, compressedSizeDeclared, uncompressedSizeDeclared,
    filters, declaredDictionaryBytes, prefixSha256: sha256(bytes), scope: SCOPE });
}

// WHAT: Receipt transcription equality, not authentication or filesystem authority.
export function assertRustXzPrefixReceipt(raw) {
  let receipt;
  try { receipt = JSON.parse(snapshot(raw, 100000, 'E_RECEIPT').toString('utf8')); }
  catch { fail('E_RECEIPT'); }
  const sameMetadata = (actual, expected) => actual && Object.keys(actual).length === FIELDS.length &&
    FIELDS.every(key => typeof actual[key] === 'string' && actual[key] === expected[key]);
  requireThat(receipt?.version === 'rust-runtime-opaque-input-receipt-v1' &&
    receipt.status === 'RUST_INPUT_BYTES_MATCHED' && receipt.root === RUST_XZ_PREFIX_INPUTS.root &&
    sameMetadata(receipt.rootFinal, RUST_XZ_PREFIX_INPUTS.rootFinal) &&
    Array.isArray(receipt.inputs) && receipt.inputs.length === 5, 'E_RECEIPT');
  for (let i = 0; i < 5; i++) {
    const actual = receipt.inputs[i], expected = RUST_XZ_PREFIX_INPUTS.inputs[i];
    requireThat(actual && actual.role === expected.role && actual.name === expected.name &&
      actual.byteLength === expected.byteLength && actual.incomingSha256 === expected.expectedWholeSha256 &&
      actual.readbackSha256 === expected.expectedWholeSha256 && actual.verified === true &&
      sameMetadata(actual.finalMetadata, expected.finalMetadata), 'E_RECEIPT');
  }
  for (const key of ['closeFailed', 'cleanupUncertain', 'archiveDecoded', 'archiveExtracted', 'filesInstalled',
    'rustExecuted', 'pythonRuntimeInvoked', 'installedUsability', 'nativeQualified', 'rustReady', 'trainingReady', 'pinComplete']) {
    requireThat(receipt[key] === false, 'E_RECEIPT');
  }
  requireThat(receipt.ioAccountingComplete === true, 'E_RECEIPT');
  return true;
}

function metadata(raw) {
  requireThat(raw && typeof raw === 'object' && !types.isProxy(raw), 'E_METADATA');
  const result = {};
  for (const key of FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    requireThat(descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'bigint', 'E_METADATA');
    const value = descriptor.value;
    requireThat(value >= (key.endsWith('Ns') ? -0x8000000000000000n : 0n) && value <=
      (key.endsWith('Ns') ? 0x7fffffffffffffffn : 0xffffffffffffffffn), 'E_METADATA');
    result[key] = value.toString();
  }
  return result;
}
function errorCode(error) {
  if (!error || typeof error !== 'object' || types.isProxy(error)) return 'E_IO';
  const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
  return descriptor && Object.hasOwn(descriptor, 'value') && CODES.has(descriptor.value) ? descriptor.value : 'E_IO';
}
const NOW = () => process.hrtime.bigint();
const PRODUCTION = Object.freeze({ fs, now: NOW });
const FS_METHODS = Object.freeze(['openSync', 'closeSync', 'fstatSync', 'lstatSync', 'readSync']);

// WHAT: A complete, non-default mock TCB; the resulting observer cannot claim production evidence.
export function createMockRustXzPrefixes(deps) {
  requireThat(deps && typeof deps === 'object' && !types.isProxy(deps), 'E_MOCK_TCB');
  const own = key => {
    const descriptor = Object.getOwnPropertyDescriptor(deps, key);
    requireThat(descriptor && Object.hasOwn(descriptor, 'value'), 'E_MOCK_TCB');
    return descriptor.value;
  };
  const mockFs = own('fs'), now = own('now');
  requireThat(mockFs && typeof mockFs === 'object' && !types.isProxy(mockFs) && mockFs !== fs &&
    typeof now === 'function' && now !== NOW && now !== process.hrtime.bigint, 'E_MOCK_TCB');
  const capturedFs = {};
  for (const key of FS_METHODS) {
    const descriptor = Object.getOwnPropertyDescriptor(mockFs, key);
    requireThat(descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'function' &&
      descriptor.value !== fs[key], 'E_MOCK_TCB');
    capturedFs[key] = descriptor.value.bind(mockFs);
  }
  const descriptor = Object.getOwnPropertyDescriptor(mockFs, 'constants');
  requireThat(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.value &&
    !types.isProxy(descriptor.value), 'E_MOCK_TCB');
  capturedFs.constants = Object.freeze(Object.fromEntries(['O_RDONLY', 'O_DIRECTORY', 'O_NOFOLLOW', 'O_NONBLOCK'].map(key => {
    const field = Object.getOwnPropertyDescriptor(descriptor.value, key);
    requireThat(field && Object.hasOwn(field, 'value'), 'E_MOCK_TCB');
    return [key, field.value];
  })));
  const captured = Object.freeze({ fs: Object.freeze(capturedFs), now });
  return Object.freeze(function observeMockRustXzPrefixes() {
    requireThat(arguments.length === 0, 'E_MOCK_TCB');
    return observe(captured, true);
  });
}

export function observeRegisteredRustXzPrefixes(operationStarted) {
  requireThat(arguments.length <= 1 && (operationStarted === undefined || typeof operationStarted === 'bigint'), 'E_CLOCK');
  return observe(PRODUCTION, false, operationStarted);
}

function observe(deps, mockOnly, operationStarted) {
  const counts = { clockReads: 0, fsOperations: 0, opens: 0, openAttempts: 0, closes: 0, closeAttempts: 0,
    fstats: 0, namedStats: 0, reads: 0, prefixAttempts: 0, prefixBytes: 0, requestedPrefixBytes: 0,
    peakOwnedFds: 0 };
  const root = { fd: null }, leaf = { fd: null }, provisional = [];
  let error = null, last = null, started = null, workEnd = null, end = null;
  let closeFailed = false, cleanupUncertain = false, ioAccountingComplete = true;
  function poison(code) { if (error === null) error = code; }
  function sample() {
    requireThat(counts.clockReads < 512, 'E_LIMIT');
    counts.clockReads++;
    const value = deps.now();
    requireThat(typeof value === 'bigint' && value >= 0n && (last === null || value >= last), 'E_CLOCK');
    last = value;
    return value;
  }
  function guard() { requireThat(sample() < workEnd, 'E_DEADLINE'); }
  function admit() {
    requireThat(counts.fsOperations < 100, 'E_LIMIT');
    counts.fsOperations++;
  }
  function call(key, action) {
    guard(); admit();
    let value;
    try { value = action(); counts[key]++; }
    catch (failure) { ioAccountingComplete = false; throw failure; }
    guard();
    return value;
  }
  function open(holder, target, flags) {
    requireThat(holder.fd === null && counts.openAttempts < 6 && !closeFailed, 'E_LIMIT');
    call('opens', () => {
      counts.openAttempts++;
      const fd = deps.fs.openSync(target, flags);
      requireThat(Number.isSafeInteger(fd) && fd >= 0 && fd !== root.fd && fd !== leaf.fd, 'E_IO');
      holder.fd = fd;
      counts.peakOwnedFds = Math.max(counts.peakOwnedFds, Number(root.fd !== null) + Number(leaf.fd !== null));
    });
  }
  function cleanupClock() {
    try { if (sample() >= end) { cleanupUncertain = true; poison('E_DEADLINE'); } }
    catch (failure) { cleanupUncertain = true; poison(errorCode(failure)); }
  }
  function close(holder) {
    if (holder.fd === null) return;
    const fd = holder.fd;
    holder.fd = null;
    cleanupClock();
    counts.closeAttempts++;
    counts.fsOperations++;
    try { deps.fs.closeSync(fd); counts.closes++; }
    catch { closeFailed = true; cleanupUncertain = true; ioAccountingComplete = false; poison('E_CLOSE'); }
    cleanupClock();
  }
  function pair(holder, target, expected) {
    const own = metadata(call('fstats', () => deps.fs.fstatSync(holder.fd, { bigint: true })));
    const named = metadata(call('namedStats', () => deps.fs.lstatSync(target, { bigint: true })));
    requireThat(FIELDS.every(key => own[key] === named[key] && own[key] === expected[key]), 'E_BINDING');
  }
  function checkRoot() { pair(root, RUST_XZ_PREFIX_INPUTS.root, RUST_XZ_PREFIX_INPUTS.rootFinal); }
  try {
    const current = sample();
    started = operationStarted === undefined ? current : operationStarted;
    requireThat(typeof started === 'bigint' && started >= 0n && started <= current, 'E_CLOCK');
    workEnd = started + 4000000000n; end = started + 5000000000n;
    guard();
    const C = deps.fs.constants;
    for (const key of ['O_RDONLY', 'O_DIRECTORY', 'O_NOFOLLOW', 'O_NONBLOCK']) {
      requireThat(Number.isInteger(C[key]) && C[key] === fs.constants[key] &&
        (key === 'O_RDONLY' ? C[key] === 0 : C[key] > 0), 'E_FLAGS');
    }
    open(root, RUST_XZ_PREFIX_INPUTS.root, C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW | C.O_NONBLOCK);
    checkRoot();
    for (const input of RUST_XZ_PREFIX_INPUTS.inputs) {
      checkRoot();
      const target = RUST_XZ_PREFIX_INPUTS.root + '/' + input.name;
      open(leaf, target, C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK);
      try {
        pair(leaf, target, input.finalMetadata);
        const bytes = Buffer.alloc(1040);
        requireThat(counts.prefixAttempts < 5 && counts.requestedPrefixBytes <= 4160, 'E_LIMIT');
        const length = call('reads', () => {
          counts.prefixAttempts++; counts.requestedPrefixBytes += 1040;
          const n = deps.fs.readSync(leaf.fd, bytes, 0, 1040, 0);
          if (Number.isInteger(n) && n >= 0 && n <= 1040) counts.prefixBytes += n;
          return n;
        });
        requireThat(length === 1040, 'E_LENGTH');
        guard(); const declarations = inspectXzPrefix(bytes); guard();
        pair(leaf, target, input.finalMetadata);
        checkRoot();
        provisional.push({ role: input.role, name: input.name, prefixBytes: 1040,
          expectedWholeSha256: input.expectedWholeSha256,
          wholeHashScope: 'KNOWN_ACQUISITION_RECEIPT_NOT_REHASHED_THIS_OPERATION',
          metadata: input.finalMetadata, beforeAfterOwnNamedMetadataMatched: true, declarations });
      } finally { close(leaf); }
      if (error) fail(error);
      guard();
    }
    checkRoot();
    guard();
  } catch (failure) { poison(errorCode(failure)); }
  finally { close(leaf); close(root); }
  if (!error) {
    try {
      requireThat(sample() < end, 'E_DEADLINE');
      requireThat(provisional.length === 5 && counts.openAttempts === 6 && counts.opens === 6 &&
        counts.closeAttempts === 6 && counts.closes === 6 && counts.reads === 5 && counts.prefixBytes === 5200 &&
        counts.fsOperations <= 100 && counts.peakOwnedFds === 2, 'E_LIMIT');
    } catch (failure) { poison(errorCode(failure)); }
  }
  const result = { profile: 'registered-rust-xz-prefix-declarations-v1', status: error ? 'STOP' : 'RUST_XZ_PREFIXES_OBSERVED',
    error, mockOnly, limits: RUST_XZ_PREFIX_LIMITS, counts, closeFailed, cleanupUncertain, ioAccountingComplete,
    counterLowerBoundsOnFailure: !ioAccountingComplete,
    counterScope: 'logicalNodeOperations; fsOperations, openAttempts, closeAttempts and prefixAttempts count attempts',
    rootFinal: error ? null : RUST_XZ_PREFIX_INPUTS.rootFinal, rootFinalUnchanged: !error,
    observations: error ? [] : provisional, scope: SCOPE,
    prefixHashScope: 'OBSERVED_PREFIX_BYTES_ORDINARY_CRYPTO_TCB', wholeArchiveHashVerifiedThisOperation: false,
    eofProbed: false, archiveDecoded: false, archiveExtracted: false, filesInstalled: false, filesChanged: false,
    rustExecuted: false, pythonRuntimeInvoked: false, nativeQualified: false, rustReady: false,
    installedUsability: false, trainingReady: false, nativeAuthority: false, toolRuntimeAdmission: false,
    hardDeadlineGuaranteed: false, hardRssBounded: false,
    executionProfile: 'PhaseNumericStandalone_ordinaryCPUcounterbilling_not_F9_not_1M_meter' };
  const text = JSON.stringify(result);
  if (!/^[\x20-\x7e]*$/.test(text) || Buffer.byteLength(text) > 16384) {
    result.status = 'STOP'; result.error = 'E_OUTPUT'; result.observations = [];
    result.rootFinal = null; result.rootFinalUnchanged = false;
  }
  return freeze(result);
}
