// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const EVIDENCE_PUBLICATION_PATH = '/tmp/opencode/f9-bootstrap-correspondence/_spec/tooling/native-ingress/toolchain-evidence-collection-v1.result.json';
export const EVIDENCE_PUBLICATION_LIMITS = Object.freeze({
  maxBytes: 16777216, chunkBytes: 65536, maxFsOperations: 8192,
  maxWriteAttempts: 4096, maxReadAttempts: 1024, maxRequestedReadBytes: 16777217,
});
const ROOT = '/tmp/opencode/f9-bootstrap-correspondence';
const DIRECTORY = ROOT + '/_spec/tooling/native-ingress';
const DIRECTORIES = [ROOT, ROOT + '/_spec', ROOT + '/_spec/tooling', DIRECTORY];
const SECURITY = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink'];
const IDENTITY = SECURITY.filter(key => key !== 'mode');
const FULL = [...SECURITY, 'size', 'mtimeNs', 'ctimeNs'];
const METHODS = ['lstatSync', 'openSync', 'fstatSync', 'fsyncSync', 'fchmodSync', 'writeSync', 'readSync', 'closeSync'];
const CODES = new Set(['ARGUMENT', 'FIXTURE', 'LIMIT', 'GUARD', 'STATE', 'DIRECTORY', 'METADATA',
  'BINDING', 'FILE', 'EXISTS', 'IO', 'CLOSE', 'BYTES', 'JSON', 'WRITE', 'READ', 'HASH', 'EOF', 'ABORTED']);
const TYPED = Object.getPrototypeOf(Uint8Array.prototype);
const LENGTH = Object.getOwnPropertyDescriptor(TYPED, 'length').get;
const BACKING = Object.getOwnPropertyDescriptor(TYPED, 'buffer').get;
const OFFSET = Object.getOwnPropertyDescriptor(TYPED, 'byteOffset').get;
const RESIZABLE = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const SET = Uint8Array.prototype.set;
const FILL = Uint8Array.prototype.fill;
const SUBARRAY = Uint8Array.prototype.subarray;
const FLAGS = fs.constants;
let productionReserved = false;

class EvidencePublicationError extends Error {
  constructor(code) {
    const fixed = 'E_PUBLICATION_' + (CODES.has(code) ? code : 'IO');
    super(fixed);
    Object.defineProperty(this, 'code', { value: fixed, enumerable: true });
  }
}
const fail = code => { throw new EvidencePublicationError(code); };
const requireThat = (ok, code) => { if (!ok) fail(code); };
const equal = (a, b, keys = FULL) => keys.every(key => a[key] === b[key]);
const own = (object, key, code) => {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  requireThat(descriptor && Object.hasOwn(descriptor, 'value'), code);
  return descriptor.value;
};
function plain(value, code) {
  requireThat(value && typeof value === 'object' && !types.isProxy(value), code);
  requireThat([Object.prototype, null].includes(Object.getPrototypeOf(value)), code);
}
function trustedFunction(value, code) {
  requireThat(typeof value === 'function' && !types.isProxy(value), code);
}
function shape(value, allowed, code) {
  plain(value, code);
  for (const key of Reflect.ownKeys(value)) {
    requireThat(typeof key === 'string' && allowed.includes(key), code);
    own(value, key, code);
  }
}
function metadata(value) {
  requireThat(value && typeof value === 'object' && !types.isProxy(value), 'METADATA');
  const result = {};
  for (const key of FULL) {
    const field = own(value, key, 'METADATA');
    requireThat(typeof field === 'bigint' && field <= 0xffffffffffffffffn &&
      field >= (key.endsWith('Ns') ? -0x8000000000000000n : 0n), 'METADATA');
    result[key] = field;
  }
  return Object.freeze(result);
}
function directory(value) {
  requireThat((value.mode & 0o170000n) === 0o040000n && (value.mode & 0o022n) === 0n &&
    value.uid === 1000n && value.gid === 1000n, 'DIRECTORY');
}
function file(value, birth, size, mode) {
  requireThat(value.mode === BigInt(0o100000 | mode) && value.uid === 1000n && value.gid === 1000n &&
    value.nlink === 1n && value.size === BigInt(size), 'FILE');
  if (birth) requireThat(equal(value, birth, IDENTITY), 'BINDING');
}
function isExists(error) {
  return error && typeof error === 'object' && !types.isProxy(error) &&
    Object.getOwnPropertyDescriptor(error, 'code')?.value === 'EEXIST';
}

// WHAT: Fixed production reservation; the controller supplies its original private guard.
export function reserveToolchainEvidencePublication(guard) {
  requireThat(arguments.length === 1, 'ARGUMENT');
  trustedFunction(guard, 'ARGUMENT');
  requireThat(!productionReserved, 'STATE');
  productionReserved = true;
  return reserve(fs, guard, EVIDENCE_PUBLICATION_LIMITS);
}

// WHAT: Complete in-memory test TCB with lower-only limits and no production fallback.
export function createEvidencePublicationFixture(options, dependencies) {
  requireThat(arguments.length === 2, 'FIXTURE');
  shape(options, ['mockOnly', 'limits'], 'FIXTURE');
  requireThat(own(options, 'mockOnly', 'FIXTURE') === true, 'FIXTURE');
  shape(dependencies, ['fs', 'guard'], 'FIXTURE');
  const backend = own(dependencies, 'fs', 'FIXTURE');
  const guard = own(dependencies, 'guard', 'FIXTURE');
  trustedFunction(guard, 'FIXTURE');
  plain(backend, 'FIXTURE');
  requireThat(backend !== fs, 'FIXTURE');
  for (const key of Reflect.ownKeys(backend)) {
    const value = own(backend, key, 'FIXTURE');
    requireThat(!types.isProxy(value), 'FIXTURE');
  }
  const captured = {};
  for (const key of METHODS) {
    const method = own(backend, key, 'FIXTURE');
    trustedFunction(method, 'FIXTURE');
    requireThat(method !== fs[key], 'FIXTURE');
    captured[key] = (...args) => Reflect.apply(method, backend, args);
  }
  const limits = { ...EVIDENCE_PUBLICATION_LIMITS };
  if (Object.hasOwn(options, 'limits')) {
    const overrides = own(options, 'limits', 'FIXTURE');
    shape(overrides, Object.keys(limits), 'FIXTURE');
    for (const key of Object.keys(overrides)) {
      const value = own(overrides, key, 'FIXTURE');
      requireThat(Number.isSafeInteger(value) && value >= 1 && value <= limits[key], 'FIXTURE');
      limits[key] = value;
    }
  }
  let consumed = false;
  return Object.freeze({ reserveToolchainEvidencePublication() {
    requireThat(arguments.length === 0, 'ARGUMENT');
    requireThat(!consumed, 'STATE');
    consumed = true;
    return reserve(Object.freeze(captured), guard, Object.freeze(limits));
  } });
}

function reserve(backend, guard, limits) {
  const dir = { fd: null }, write = { fd: null }, read = { fd: null };
  const holders = [write, read, dir];
  const counts = { fsOperations: 0, guardChecks: 0, opens: 0, closeAttempts: 0, closes: 0,
    cleanupCloseAttempts: 0, namedStats: 0, fdStats: 0, fsyncs: 0, chmods: 0,
    writeAttempts: 0, readAttempts: 0, requestedWriteBytes: 0, requestedReadBytes: 0,
    writtenBytes: 0, readbackBytes: 0, inputBytes: 0, copiedBytes: 0,
    inputHashBytes: 0, readbackHashBytes: 0, peakOwnedFDs: 0,
    ownedSnapshotBytes: 0, peakOwnedSnapshotBytes: 0, ownedScratchBytes: 0,
    peakOwnedScratchBytes: 0, jsonStringCodeUnits: 0, wipedSnapshotBytes: 0 };
  let phase = 'RESERVING', error = null, created = false, sealed = false;
  let closeFailed = false, cleanupUncertain = false, snapshotBytes = null, scratch = null;
  let dirBirth, fileBirth, sealedMetadata;
  const ownedCount = () => holders.reduce((total, holder) => total + Number(holder.fd !== null), 0);
  function check() {
    counts.guardChecks++;
    try { guard(); } catch { fail('GUARD'); }
  }
  function work(action) {
    check(); const result = action(); check(); return result;
  }
  function operation(key, action, code = 'IO', opening = false) {
    check();
    requireThat(counts.fsOperations + 1 + ownedCount() + Number(opening) <= limits.maxFsOperations, 'LIMIT');
    counts.fsOperations++;
    counts[key]++;
    let result;
    try { result = action(); }
    catch (cause) {
      if (cause instanceof EvidencePublicationError) throw cause;
      fail(isExists(cause) ? 'EXISTS' : code);
    }
    check();
    return result;
  }
  function open(holder, target, flags, mode) {
    operation('opens', () => {
      const fd = backend.openSync(target, flags, mode);
      requireThat(Number.isSafeInteger(fd) && fd >= 0, 'IO');
      holder.fd = fd;
      if (holder === write) created = true;
      counts.peakOwnedFDs = Math.max(counts.peakOwnedFDs, ownedCount());
    }, 'IO', true);
  }
  function close(holder, cleanup = false) {
    if (holder.fd === null) return;
    let guardFailed = false;
    try { check(); } catch { guardFailed = true; }
    const fd = holder.fd;
    holder.fd = null;
    counts.closeAttempts++;
    counts.cleanupCloseAttempts += Number(cleanup);
    counts.fsOperations++;
    try { backend.closeSync(fd); counts.closes++; }
    catch { closeFailed = true; cleanupUncertain = true; }
    try { check(); } catch { guardFailed = true; }
    if (!cleanup) {
      requireThat(!closeFailed, 'CLOSE');
      requireThat(!guardFailed, 'GUARD');
    }
  }
  function dropBuffers() {
    if (snapshotBytes) {
      FILL.call(snapshotBytes, 0);
      counts.wipedSnapshotBytes += snapshotBytes.length;
      snapshotBytes = null;
      counts.ownedSnapshotBytes = 0;
    }
    if (scratch) { FILL.call(scratch, 0); scratch = null; counts.ownedScratchBytes = 0; }
  }
  function cleanup() {
    for (const holder of holders) close(holder, true);
    dropBuffers();
    if (closeFailed) error = 'E_PUBLICATION_CLOSE';
  }
  function poison(cause) {
    phase = 'FAILED';
    error = cause instanceof EvidencePublicationError ? cause.code : 'E_PUBLICATION_IO';
    cleanup();
    throw new EvidencePublicationError(error.slice('E_PUBLICATION_'.length));
  }
  const named = path => metadata(operation('namedStats', () => backend.lstatSync(path, { bigint: true })));
  const stat = holder => metadata(operation('fdStats', () => backend.fstatSync(holder.fd, { bigint: true })));
  function pair(holder, path, keys = FULL) {
    const descriptor = stat(holder), name = named(path);
    requireThat(equal(descriptor, name, keys), 'BINDING');
    return descriptor;
  }
  const sync = holder => operation('fsyncs', () => backend.fsyncSync(holder.fd));
  function snapshot() {
    return Object.freeze({ phase, ownedFDCount: ownedCount(), counts: Object.freeze({ ...counts }),
      created, sealed, error, closeFailed, cleanupUncertain });
  }
  function abort() {
    requireThat(arguments.length === 0, 'ARGUMENT');
    if (phase !== 'PUBLISHED_READBACK_MATCHED') {
      phase = 'FAILED';
      error ??= 'E_PUBLICATION_ABORTED';
    }
    cleanup();
    return Object.freeze({ counts: Object.freeze({ ...counts }), closeFailed, cleanupUncertain });
  }
  function copyBytes(bytes) {
    requireThat(bytes && !types.isProxy(bytes) && types.isUint8Array(bytes) &&
      [Uint8Array.prototype, Buffer.prototype].includes(Object.getPrototypeOf(bytes)), 'BYTES');
    for (const key of ['length', 'byteLength', 'byteOffset', 'buffer', 'subarray', 'set', 'toString']) {
      const descriptor = Object.getOwnPropertyDescriptor(bytes, key);
      requireThat(!descriptor || Object.hasOwn(descriptor, 'value'), 'BYTES');
    }
    const backing = BACKING.call(bytes);
    requireThat(types.isArrayBuffer(backing) && !types.isSharedArrayBuffer(backing) &&
      (!RESIZABLE || !RESIZABLE.call(backing)), 'BYTES');
    let length;
    try {
      length = LENGTH.call(bytes);
      new Uint8Array(backing, OFFSET.call(bytes), length);
    } catch { fail('BYTES'); }
    requireThat(length >= 3 && length <= limits.maxBytes, 'BYTES');
    counts.inputBytes = length;
    snapshotBytes = work(() => Buffer.alloc(length));
    counts.ownedSnapshotBytes = length;
    counts.peakOwnedSnapshotBytes = length;
    work(() => SET.call(snapshotBytes, bytes));
    counts.copiedBytes = length;
    return length;
  }
  function validateJSON(length) {
    requireThat(snapshotBytes[length - 1] === 10, 'JSON');
    for (let position = 0; position < length; position += limits.chunkBytes) {
      work(() => {
        for (let i = position; i < Math.min(length, position + limits.chunkBytes); i++) {
          requireThat(snapshotBytes[i] > 0 && snapshotBytes[i] <= 127, 'JSON');
        }
      });
    }
    let value;
    try {
      value = work(() => {
        const text = Buffer.prototype.toString.call(snapshotBytes, 'ascii');
        counts.jsonStringCodeUnits = text.length;
        return JSON.parse(text);
      });
    } catch (cause) {
      if (cause instanceof EvidencePublicationError) throw cause;
      fail('JSON');
    }
    requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), 'JSON');
    for (const key of ['selfDigest', 'publicationAccepted', 'publication', 'publicationRecord',
      'readbackVerified', 'directorySynced', 'fileMetadata', 'publicationCounts',
      'postwriteCounts', 'postWriteCounts', 'sealedMetadata']) requireThat(!Object.hasOwn(value, key), 'JSON');
  }
  function inputHash(length) {
    const hash = work(() => createHash('sha256'));
    for (let position = 0; position < length; position += limits.chunkBytes) {
      const end = Math.min(length, position + limits.chunkBytes);
      work(() => hash.update(SUBARRAY.call(snapshotBytes, position, end)));
      counts.inputHashBytes += end - position;
    }
    return work(() => hash.digest('hex'));
  }
  function publish(bytes) {
    requireThat(phase === 'RESERVED', 'STATE');
    phase = 'PUBLISHING';
    try {
      requireThat(arguments.length === 1, 'ARGUMENT');
      check();
      const length = copyBytes(bytes);
      validateJSON(length);
      const sha256 = inputHash(length);
      let position = 0;
      while (position < length) {
        requireThat(counts.writeAttempts < limits.maxWriteAttempts, 'LIMIT');
        const requested = Math.min(limits.chunkBytes, length - position);
        counts.requestedWriteBytes += requested;
        const amount = operation('writeAttempts', () => backend.writeSync(write.fd, snapshotBytes, position, requested, position));
        requireThat(Number.isSafeInteger(amount) && amount > 0 && amount <= requested, 'WRITE');
        position += amount;
        counts.writtenBytes += amount;
      }
      sync(write);
      file(pair(write, EVIDENCE_PUBLICATION_PATH), fileBirth, length, 0o600);
      operation('chmods', () => backend.fchmodSync(write.fd, 0o444));
      sync(write);
      sealedMetadata = pair(write, EVIDENCE_PUBLICATION_PATH);
      file(sealedMetadata, fileBirth, length, 0o444);
      sealed = true;
      close(write);
      open(read, EVIDENCE_PUBLICATION_PATH, FLAGS.O_RDONLY | FLAGS.O_NOFOLLOW | FLAGS.O_NONBLOCK);
      requireThat(equal(pair(read, EVIDENCE_PUBLICATION_PATH), sealedMetadata), 'BINDING');
      scratch = work(() => Buffer.alloc(limits.chunkBytes));
      counts.ownedScratchBytes = limits.chunkBytes;
      counts.peakOwnedScratchBytes = limits.chunkBytes;
      const hash = work(() => createHash('sha256'));
      position = 0;
      function readChunk(requested) {
        requireThat(counts.readAttempts < limits.maxReadAttempts && requested > 0 &&
          counts.requestedReadBytes + requested <= limits.maxRequestedReadBytes, 'LIMIT');
        counts.requestedReadBytes += requested;
        const amount = operation('readAttempts', () => backend.readSync(read.fd, scratch, 0, requested, position));
        requireThat(Number.isSafeInteger(amount) && amount >= 0 && amount <= requested, 'READ');
        return amount;
      }
      while (position < length) {
        const requested = Math.min(limits.chunkBytes, length - position,
          limits.maxRequestedReadBytes - counts.requestedReadBytes - 1);
        const amount = readChunk(requested);
        requireThat(amount > 0, 'READ');
        work(() => hash.update(SUBARRAY.call(scratch, 0, amount)));
        position += amount;
        counts.readbackBytes += amount;
        counts.readbackHashBytes += amount;
      }
      requireThat(readChunk(1) === 0, 'EOF');
      requireThat(work(() => hash.digest('hex')) === sha256, 'HASH');
      requireThat(equal(pair(read, EVIDENCE_PUBLICATION_PATH), sealedMetadata), 'BINDING');
      close(read);
      sync(dir);
      const finalDir = pair(dir, DIRECTORY, SECURITY);
      directory(finalDir);
      requireThat(equal(finalDir, dirBirth, SECURITY), 'BINDING');
      requireThat(equal(named(EVIDENCE_PUBLICATION_PATH), sealedMetadata), 'BINDING');
      close(dir);
      dropBuffers();
      check();
      phase = 'PUBLISHED_READBACK_MATCHED';
      return Object.freeze({ state: phase, path: EVIDENCE_PUBLICATION_PATH, byteLength: length, sha256,
        mode: '0444', readbackVerified: true, directorySynced: true,
        fileMetadata: Object.freeze(Object.fromEntries(FULL.map(key => [key, sealedMetadata[key].toString()]))),
        counts: Object.freeze({ ...counts }),
        accountingScope: 'publication-owned descriptors and byte buffers; not RSS or collector stage/archive owners',
        sourceRootAuthentication: false, ancestorRacesExcluded: false, atomicCrashCommit: false,
        storageFailureSurvival: false, hardDeadlineGuaranteed: false,
        nativeQualified: false, abiQualified: false, authenticatedStorage: false });
    } catch (cause) { poison(cause); }
  }
  try {
    for (const path of DIRECTORIES) {
      const current = named(path);
      directory(current);
      if (path === DIRECTORY) dirBirth = current;
    }
    open(dir, DIRECTORY, FLAGS.O_RDONLY | FLAGS.O_DIRECTORY | FLAGS.O_NOFOLLOW | FLAGS.O_NONBLOCK);
    const bound = pair(dir, DIRECTORY, SECURITY);
    directory(bound);
    requireThat(equal(bound, dirBirth, SECURITY), 'BINDING');
    open(write, EVIDENCE_PUBLICATION_PATH,
      FLAGS.O_WRONLY | FLAGS.O_CREAT | FLAGS.O_EXCL | FLAGS.O_NOFOLLOW | FLAGS.O_NONBLOCK, 0o600);
    fileBirth = pair(write, EVIDENCE_PUBLICATION_PATH);
    file(fileBirth, null, 0, 0o600);
    sync(dir);
    phase = 'RESERVED';
    return Object.freeze({ publish, abort, snapshot });
  } catch (cause) { poison(cause); }
}
