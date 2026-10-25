// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const RUST_XZ_PREFIX_SOURCE_PIN = Object.freeze({ bytes: 19606, sha256: '23774f5ce7704f37b058656f0b659017c9460fc20c76cb8e53756365e62239dd' });
export const RUST_XZ_PREFIX_RECEIPT_PIN = Object.freeze({ bytes: 4012, sha256: 'c068579e97c9c01c707bae0cdffb082bf23d7f089bcd404a114d290e0476be87' });
const SOURCE = '/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/rust-xz-prefixes.mjs';
const RECEIPT = '/tmp/opencode/f9-bootstrap-correspondence/_spec/tooling/native-ingress/rust-runtime-inputs.receipt.json';
const TYPED = Object.getPrototypeOf(Uint8Array.prototype);
const LENGTH = Object.getOwnPropertyDescriptor(TYPED, 'length').get;
const BACKING = Object.getOwnPropertyDescriptor(TYPED, 'buffer').get;
const OFFSET = Object.getOwnPropertyDescriptor(TYPED, 'byteOffset').get;
const ARRAY_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const RESIZABLE = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const requireThat = (ok, code) => { if (!ok) fail(code); };
const FIELDS = Object.freeze(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']);
const FS_METHODS = Object.freeze(['openSync', 'closeSync', 'fstatSync', 'lstatSync', 'readSync']);
const FLAGS = Object.freeze(['O_RDONLY', 'O_NOFOLLOW', 'O_NONBLOCK']);
const NOW = () => process.hrtime.bigint();
const IMPORT = captured => import('data:text/javascript;base64,' + captured.toString('base64'));
const PRODUCTION = Object.freeze({ fs, now: NOW, importSource: IMPORT });
const CODES = new Set(['E_ARGUMENTS', 'E_SOURCE_PIN', 'E_RECEIPT_PIN', 'E_RECEIPT', 'E_CLOCK', 'E_DEADLINE',
  'E_METADATA', 'E_BINDING', 'E_SOURCE_LENGTH', 'E_FLAGS', 'E_CLOSE', 'E_LIMIT', 'E_RESULT', 'E_ACCOUNTING', 'E_OUTPUT']);

function capture(raw, pin, code) {
  if (!raw || types.isProxy(raw) || !Buffer.isBuffer(raw) || Object.getPrototypeOf(raw) !== Buffer.prototype) fail(code);
  for (const key of ['length', 'buffer', 'byteLength', 'byteOffset']) {
    if (Object.getOwnPropertyDescriptor(raw, key)) fail(code);
  }
  let bytes;
  try {
    const length = LENGTH.call(raw), backing = BACKING.call(raw);
    ARRAY_LENGTH.call(backing);
    if (RESIZABLE?.call(backing) || length > 100000 || length !== pin.bytes) fail(code);
    bytes = Buffer.alloc(length);
    Uint8Array.prototype.set.call(bytes, new Uint8Array(backing, OFFSET.call(raw), length));
  } catch { fail(code); }
  if (createHash('sha256').update(bytes).digest('hex') !== pin.sha256) fail(code);
  return bytes;
}

export function captureRegisteredRustXzPrefixSource(raw) {
  return capture(raw, RUST_XZ_PREFIX_SOURCE_PIN, 'E_SOURCE_PIN');
}
export function captureRegisteredRustXzPrefixReceipt(raw) {
  return capture(raw, RUST_XZ_PREFIX_RECEIPT_PIN, 'E_RECEIPT_PIN');
}

function codeOf(failure) {
  if (!failure || typeof failure !== 'object' || types.isProxy(failure)) return 'E_IO';
  const descriptor = Object.getOwnPropertyDescriptor(failure, 'code');
  return descriptor && Object.hasOwn(descriptor, 'value') && CODES.has(descriptor.value) ? descriptor.value : 'E_IO';
}
function metadata(raw) {
  requireThat(raw && typeof raw === 'object' && !types.isProxy(raw), 'E_METADATA');
  const result = {};
  for (const key of FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    requireThat(descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'bigint', 'E_METADATA');
    const value = descriptor.value;
    requireThat(value >= (key.endsWith('Ns') ? -0x8000000000000000n : 0n) &&
      value <= (key.endsWith('Ns') ? 0x7fffffffffffffffn : 0xffffffffffffffffn), 'E_METADATA');
    result[key] = value;
  }
  return result;
}
function snapshotEnvelope(raw) {
  let nodes = 0;
  function copy(value, depth) {
    requireThat(++nodes <= 2048 && depth <= 12, 'E_RESULT');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      requireThat(value.length <= 16384 && /^[\x20-\x7e]*$/.test(value), 'E_RESULT');
      return value;
    }
    if (typeof value === 'number') { requireThat(Number.isSafeInteger(value), 'E_RESULT'); return value; }
    requireThat(value && typeof value === 'object' && !types.isProxy(value), 'E_RESULT');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    requireThat(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'E_RESULT');
    const keys = Reflect.ownKeys(value);
    requireThat(keys.length <= 512 && keys.every(key => typeof key === 'string'), 'E_RESULT');
    const result = array ? [] : Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      requireThat(descriptor && Object.hasOwn(descriptor, 'value') && (descriptor.enumerable || array && key === 'length'), 'E_RESULT');
      if (array && key === 'length') {
        requireThat(Number.isSafeInteger(descriptor.value) && descriptor.value <= 512 && descriptor.value >= 0, 'E_RESULT');
        result.length = descriptor.value;
      } else {
        requireThat(!array || /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < 512, 'E_RESULT');
        Object.defineProperty(result, key, { value: copy(descriptor.value, depth + 1), enumerable: true });
      }
    }
    return Object.freeze(result);
  }
  const result = copy(raw, 0);
  requireThat(Buffer.byteLength(JSON.stringify(result)) <= 16384, 'E_RESULT');
  return result;
}

// WHAT: Typed data-envelope accounting, without a native brand or a validation-success implication.
export function inspectRustXzPrefixObservationAccounting(raw) {
  const result = snapshotEnvelope(raw);
  requireThat(result && result.profile === 'registered-rust-xz-prefix-declarations-v1' &&
    ['STOP', 'RUST_XZ_PREFIXES_OBSERVED'].includes(result.status) && typeof result.mockOnly === 'boolean' &&
    (result.status === 'STOP' ? typeof result.error === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(result.error) :
      result.error === null) && Array.isArray(result.observations), 'E_RESULT');
  for (const key of ['ioAccountingComplete', 'closeFailed', 'cleanupUncertain']) requireThat(typeof result[key] === 'boolean', 'E_RESULT');
  const complete = result.ioAccountingComplete && !result.closeFailed && !result.cleanupUncertain;
  return Object.freeze({ result, observationAccountingComplete: complete, observationCountersLowerBounds: !complete,
    observationValidationPassed: result.status === 'RUST_XZ_PREFIXES_OBSERVED' && result.error === null });
}

// WHAT: Complete in-memory operation TCB; accepts no path, pin, or production-filesystem overrides.
export function createMockRustXzPrefixesOperation(deps) {
  requireThat(deps && typeof deps === 'object' && !types.isProxy(deps), 'E_MOCK_TCB');
  const own = (value, key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    requireThat(descriptor && Object.hasOwn(descriptor, 'value'), 'E_MOCK_TCB');
    return descriptor.value;
  };
  const mockFs = own(deps, 'fs'), now = own(deps, 'now'), importSource = own(deps, 'importSource');
  requireThat(mockFs && typeof mockFs === 'object' && !types.isProxy(mockFs) && mockFs !== fs &&
    typeof now === 'function' && now !== NOW && now !== process.hrtime.bigint &&
    typeof importSource === 'function' && importSource !== IMPORT, 'E_MOCK_TCB');
  const capturedFs = {};
  for (const key of FS_METHODS) {
    const method = own(mockFs, key);
    requireThat(typeof method === 'function' && method !== fs[key], 'E_MOCK_TCB');
    capturedFs[key] = method.bind(mockFs);
  }
  const constants = own(mockFs, 'constants');
  requireThat(constants && typeof constants === 'object' && !types.isProxy(constants), 'E_MOCK_TCB');
  capturedFs.constants = Object.freeze(Object.fromEntries(FLAGS.map(key => [key, own(constants, key)])));
  const captured = Object.freeze({ fs: Object.freeze(capturedFs), now, importSource });
  return Object.freeze(function runMockRustXzPrefixes() { return run(captured, true, arguments.length); });
}

// WHAT: Bounded fixed repository captures close before private import and fixed prefix observation.
export async function runRegisteredRustXzPrefixes() { return run(PRODUCTION, false, arguments.length); }

async function run(deps, mockOnly, argumentCount) {
  const phase = () => ({ attempted: false, ioAccountingComplete: false, pinValidated: false, closed: false,
    closeFailed: false, cleanupUncertain: false,
    counts: { fsOperations: 0, openAttempts: 0, opens: 0, fstatAttempts: 0, fstats: 0,
      namedStatAttempts: 0, namedStats: 0, readAttempts: 0, reads: 0, requestedBytes: 0, returnedBytes: 0,
      positiveReadBytes: 0, closeAttempts: 0, closes: 0, allocations: 0, allocatedBytes: 0 } });
  const source = phase(), receipt = phase();
  const counts = { clockReads: 0, repositoryPeakOwnedFds: 0, sourceImports: 0, observationCalls: 0 };
  let started = null, last = null, error = null, result = null, observationReturned = false, receiptDeclarationMatched = false;
  let observationAccountingComplete = false, observationCountersLowerBounds = true, observationValidationPassed = false;
  function poison(code) { if (error === null) error = code; }
  function sample() {
    requireThat(counts.clockReads < 512, 'E_LIMIT'); counts.clockReads++;
    const value = deps.now();
    requireThat(typeof value === 'bigint' && value >= 0n && (last === null || value >= last), 'E_CLOCK');
    last = value; return value;
  }
  function guard(milliseconds = 4000) { requireThat(sample() - started < BigInt(milliseconds) * 1000000n, 'E_DEADLINE'); }
  function readFixed(which) {
    const record = which === 0 ? source : receipt;
    const path = which === 0 ? SOURCE : RECEIPT;
    const pin = which === 0 ? RUST_XZ_PREFIX_SOURCE_PIN : RUST_XZ_PREFIX_RECEIPT_PIN;
    const pinCode = which === 0 ? 'E_SOURCE_PIN' : 'E_RECEIPT_PIN';
    const c = record.counts;
    let fd = null, bytes = null;
    record.attempted = true; record.ioAccountingComplete = true;
    function call(attempt, completed, action) {
      guard(); requireThat(c.fsOperations < 70, 'E_LIMIT'); c.fsOperations++; c[attempt]++;
      let value;
      try { value = action(); c[completed]++; }
      catch (failure) { record.ioAccountingComplete = false; throw failure; }
      guard(); return value;
    }
    function pair(before) {
      const own = metadata(call('fstatAttempts', 'fstats', () => deps.fs.fstatSync(fd, { bigint: true })));
      requireThat((own.mode & 0o170000n) === 0o100000n && own.size === BigInt(pin.bytes), 'E_SOURCE_LENGTH');
      const named = metadata(call('namedStatAttempts', 'namedStats', () => deps.fs.lstatSync(path, { bigint: true })));
      requireThat(FIELDS.every(key => own[key] === named[key] && (!before || own[key] === before[key])), 'E_BINDING');
      return own;
    }
    function cleanupClock() {
      try { guard(5000); }
      catch (failure) { record.cleanupUncertain = true; poison(codeOf(failure)); }
    }
    try {
      guard();
      requireThat(Number.isSafeInteger(pin.bytes) && pin.bytes > 0 && pin.bytes <= 100000, pinCode);
      const C = deps.fs.constants;
      for (const key of FLAGS) requireThat(Number.isInteger(C[key]) && C[key] === fs.constants[key] &&
        (key === 'O_RDONLY' ? C[key] === 0 : C[key] > 0), 'E_FLAGS');
      call('openAttempts', 'opens', () => {
        const opened = deps.fs.openSync(path, C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK);
        requireThat(Number.isSafeInteger(opened) && opened >= 0, 'E_IO');
        fd = opened; counts.repositoryPeakOwnedFds = 1;
      });
      const before = pair();
      guard(); bytes = Buffer.alloc(pin.bytes + 1); c.allocations++; c.allocatedBytes += pin.bytes + 1; guard();
      let position = 0;
      function read(length) {
        requireThat(c.readAttempts < 64 && length <= 65536 && position <= pin.bytes, 'E_LIMIT');
        return call('readAttempts', 'reads', () => {
          c.requestedBytes += length;
          const n = deps.fs.readSync(fd, bytes, position, length, position);
          if (!Number.isSafeInteger(n) || n < 0 || n > length) { record.ioAccountingComplete = false; fail('E_IO'); }
          c.returnedBytes += n;
          if (n > 0) c.positiveReadBytes += n;
          return n;
        });
      }
      while (position < pin.bytes) {
        const length = Math.min(65536, pin.bytes - position), n = read(length);
        requireThat(n === length, 'E_SOURCE_LENGTH'); position += n;
      }
      requireThat(read(1) === 0, 'E_SOURCE_LENGTH');
      pair(before);
    } catch (failure) { poison(codeOf(failure)); }
    finally {
      if (fd !== null) {
        const owned = fd; fd = null;
        cleanupClock(); c.closeAttempts++; c.fsOperations++;
        try { deps.fs.closeSync(owned); c.closes++; record.closed = true; }
        catch { record.closeFailed = true; record.cleanupUncertain = true; record.ioAccountingComplete = false; poison('E_CLOSE'); }
        cleanupClock();
      }
    }
    if (error) fail(error);
    guard();
    const payload = bytes.subarray(0, pin.bytes);
    requireThat(createHash('sha256').update(payload).digest('hex') === pin.sha256, pinCode);
    guard(); record.pinValidated = true;
    return payload;
  }
  try {
    started = sample();
    requireThat(argumentCount === 0, 'E_ARGUMENTS');
    const capturedSource = readFixed(0), capturedReceipt = readFixed(1);
    guard();
    const helper = await deps.importSource(capturedSource);
    counts.sourceImports++; guard();
    if (helper.assertRustXzPrefixReceipt(capturedReceipt) !== true) fail('E_RECEIPT');
    receiptDeclarationMatched = true;
    guard(); counts.observationCalls++;
    const returned = helper.observeRegisteredRustXzPrefixes(started);
    observationReturned = true;
    const accounting = inspectRustXzPrefixObservationAccounting(returned);
    result = accounting.result;
    observationAccountingComplete = accounting.observationAccountingComplete;
    observationCountersLowerBounds = accounting.observationCountersLowerBounds;
    observationValidationPassed = accounting.observationValidationPassed;
    guard(5000);
    if (!observationValidationPassed || result.mockOnly !== mockOnly) error = result.error ?? 'E_RESULT';
    else if (!observationAccountingComplete) error = 'E_ACCOUNTING';
    if (error) {
      result = Object.freeze({ ...result, observations: Object.freeze([]), rootFinal: null, rootFinalUnchanged: false });
      observationValidationPassed = false;
    }
  } catch (failure) {
    poison(codeOf(failure)); result = null; observationValidationPassed = false;
  }
  const complete = record => record.attempted && record.ioAccountingComplete && !record.closeFailed && !record.cleanupUncertain;
  const sourceAccountingComplete = complete(source), receiptAccountingComplete = complete(receipt);
  const output = { profile: 'registered-rust-xz-prefixes-operation-v1', status: error ? 'STOP' : 'RUST_XZ_PREFIXES_OBSERVED',
    error, mockOnly, sourcePin: RUST_XZ_PREFIX_SOURCE_PIN, receiptPin: RUST_XZ_PREFIX_RECEIPT_PIN,
    pinScope: 'REPOSITORY_SOURCE_AND_PARENT_TRANSCRIPTION_EQUALITY_NOT_AUTHENTICATION_OR_CAPABILITY',
    counts, sourcePhase: source, receiptPhase: receipt, sourceAccountingComplete, receiptAccountingComplete, receiptDeclarationMatched,
    counterScope: 'logicalNodeOperations; attempts and requestedBytes count attempted calls; positiveReadBytes count completed positive reads',
    sourceCountersLowerBounds: !sourceAccountingComplete, receiptCountersLowerBounds: !receiptAccountingComplete,
    observationReturned, observationAccountingComplete, observationCountersLowerBounds, observationValidationPassed,
    accountingScope: 'COUNTER_COMPLETENESS_NOT_VALIDATION_SUCCESS_OR_NATIVE_AUTHORITY', result,
    wholeArchiveHashVerifiedThisOperation: false, archiveDecoded: false, archiveExtracted: false,
    filesInstalled: false, filesChanged: false, rustExecuted: false, pythonRuntimeInvoked: false,
    nativeQualified: false, rustReady: false, installedUsability: false, trainingReady: false,
    nativeAuthority: false, toolRuntimeAdmission: false, hardDeadlineGuaranteed: false, hardRssBounded: false,
    executionProfile: 'PhaseNumericStandalone_ordinaryCPUcounterbilling_not_F9_not_1M_meter' };
  let text = JSON.stringify(output) + '\n';
  if (!/^[\x20-\x7e]*\n$/.test(text) || Buffer.byteLength(text) > 16384) {
    error = 'E_OUTPUT'; output.status = 'STOP'; output.error = error; output.result = null;
    output.observationValidationPassed = false;
    text = JSON.stringify(output) + '\n';
  }
  return Object.freeze({ exitCode: error ? 1 : 0, text });
}
