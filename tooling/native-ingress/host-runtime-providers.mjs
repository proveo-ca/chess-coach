// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { inspectElf64RequirementsV4 } from './elf-requirements-v4.mjs';

const PROFILE = 'host-runtime-providers-v1';
const STAGE = '/tmp/opencode/f9-xz-qualification-01';
const HOST = '/usr/lib/x86_64-linux-gnu';
const FIELDS = Object.freeze(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']);
const INPUT_KEYS = Object.freeze(['role', 'root', 'path', 'soname', 'interpreter', 'sourceKind',
  'expectedBytes', 'expectedSha256', 'rootIdentity', 'fileIdentity']);
const CODES = new Set(['E_ARGUMENTS', 'E_CONSUMED', 'E_MOCK_TCB', 'E_INPUT', 'E_LIMITS',
  'E_FLAGS', 'E_IO', 'E_METADATA', 'E_IDENTITY', 'E_SIZE', 'E_LIMIT', 'E_LENGTH', 'E_HASH',
  'E_ELF', 'E_CLOSE', 'E_CLOCK', 'E_DEADLINE', 'E_OUTPUT']);
const INSPECTOR_FALSE = Object.freeze(['candidateExecuted', 'decoderQualified', 'realCandidateRead',
  'realArchiveInspected', 'provenanceVerified', 'noPythonRuntimeVerified', 'loaderClosureVerified',
  'nativeAuthority', 'nativeQualified', 'installedUsability', 'rustReady', 'trainingReady']);
const REQUIREMENTS_FALSE = Object.freeze(['symbolBindingsVerified', 'hardwareCompatibilityVerified',
  'instructionCoverageVerified', 'propertyEnforcementVerified', 'buildIdAuthenticated']);
const FLAGS = Object.freeze({
  scope: 'CANDIDATE_DATA_NOT_RUNTIME_ADMISSION',
  nativeQualified: false, nativeAuthority: false, rustReady: false, trainingReady: false,
  loaderClosureVerified: false, runtimeProvidersQualified: false, pythonFreeSubsetVerified: false,
  installedUsability: false, imagePrepared: false, dockerProviderQualified: false,
  symbolBindingsVerified: false, hardRssBounded: false, hardDeadlineGuaranteed: false,
  processTreeBounded: false, ancestorRacesExcluded: false, sourceAuthentication: false,
  sourceRootAuthentication: false, atomicSnapshot: false, candidateExecuted: false,
  provenanceVerified: false, noPythonRuntimeVerified: false, decoderQualified: false,
});
const OPTIONAL_FALSE = Object.freeze(Object.keys(FLAGS).filter(key => FLAGS[key] === false));
const bigintString = BigInt.prototype.toString;
const productionNow = performance.now.bind(performance);
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const check = (condition, code) => { if (!condition) fail(code); };
function freeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const stageIdentity = {
  dev: '28', ino: '13941', mode: '16704', uid: '1000', gid: '1000', nlink: '2',
  size: '4096', mtimeNs: '1792835630900915490', ctimeNs: '1792835630901678421',
};
export const HOST_RUNTIME_INPUTS = freeze([
  { role: 'HOST_LOADER', root: STAGE, path: STAGE + '/ld-linux-x86-64.so.2',
    soname: 'ld-linux-x86-64.so.2', interpreter: null, sourceKind: 'PINNED_ORDINARY_STAGE',
    expectedBytes: 254864, expectedSha256: 'c5e80a563850d6ab5c2f2482e4202d9c1b71fbf44854b8c399e63527202c64e1',
    rootIdentity: stageIdentity,
    fileIdentity: { dev: '29', ino: '1212100', mode: '33088', uid: '1000', gid: '1000', nlink: '1',
      size: '254864', mtimeNs: '1792835630900220500', ctimeNs: '1792835630900220500' } },
  { role: 'HOST_LIBC', root: STAGE, path: STAGE + '/libc.so.6', soname: 'libc.so.6',
    interpreter: '/lib64/ld-linux-x86-64.so.2', sourceKind: 'PINNED_ORDINARY_STAGE',
    expectedBytes: 2186512, expectedSha256: 'a3947513a02831ec692ebf13053c07614882ab54a2101fb91a1b15724062ed0c',
    rootIdentity: stageIdentity,
    fileIdentity: { dev: '29', ino: '1212102', mode: '33024', uid: '1000', gid: '1000', nlink: '1',
      size: '2186512', mtimeNs: '1792835630901678421', ctimeNs: '1792835630901678421' } },
  ...[['HOST_LIBM', 'libm.so.6'], ['HOST_LIBDL', 'libdl.so.2'], ['HOST_LIBPTHREAD', 'libpthread.so.0'],
    ['HOST_LIBRT', 'librt.so.1'], ['HOST_LIBGCC_S', 'libgcc_s.so.1']].map(([role, soname]) => ({
    role, root: HOST, path: HOST + '/' + soname, soname, interpreter: null,
    sourceKind: 'ORDINARY_HOST_CANDIDATE_UNAUTHENTICATED', expectedBytes: null,
    expectedSha256: null, rootIdentity: null, fileIdentity: null,
  })),
]);

export const HOST_RUNTIME_LIMITS = Object.freeze({
  maxFileBytes: 8388608, maxAggregateBytes: 33554432, maxRequestedBytes: 33554439,
  maxFsOperations: 2048, maxReadAttempts: 1024, maxClockReads: 8192, maxOutputBytes: 2097152,
  chunkBytes: 65536, maxTotalMs: 10000, cleanupMs: 2000,
});

function own(object, key, code) {
  check(object !== null && typeof object === 'object' && !types.isProxy(object), code);
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  check(descriptor && Object.hasOwn(descriptor, 'value'), code);
  return descriptor.value;
}

function data(object, keys, code) {
  check(object !== null && typeof object === 'object' && !types.isProxy(object) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(object)), code);
  const names = Reflect.ownKeys(object);
  check(names.length === keys.length && names.every(key => keys.includes(key)), code);
  return Object.fromEntries(keys.map(key => [key, own(object, key, code)]));
}

function identity(object, code) {
  const result = data(object, FIELDS, code);
  for (const key of FIELDS) check(typeof result[key] === 'string' && /^(0|[1-9][0-9]{0,31})$/.test(result[key]), code);
  check(BigInt(result.ino) > 0n, code);
  return result;
}

function snapshot(object) {
  const result = {};
  for (const key of FIELDS) {
    const value = own(object, key, 'E_METADATA');
    check(typeof value === 'bigint' && value >= 0n && value < (1n << 128n), 'E_METADATA');
    result[key] = bigintString.call(value);
  }
  check(result.ino !== '0', 'E_METADATA');
  return result;
}

function equal(actual, expected) {
  check(FIELDS.every(key => actual[key] === expected[key]), 'E_IDENTITY');
}

function rootPolicy(meta, row) {
  const mode = BigInt(meta.mode);
  check((mode & 0o170000n) === 0o040000n && BigInt(meta.nlink) >= 1n, 'E_METADATA');
  if (row.rootIdentity !== null) {
    check(meta.uid === '1000' && meta.gid === '1000' && mode === 0o040500n && meta.nlink === '2', 'E_METADATA');
    equal(meta, row.rootIdentity);
  } else {
    check(meta.uid === '0' && meta.gid === '0' && (mode & 0o022n) === 0n, 'E_METADATA');
  }
}

function filePolicy(meta, row) {
  const mode = BigInt(meta.mode);
  check((mode & 0o170000n) === 0o100000n && BigInt(meta.nlink) >= 1n, 'E_METADATA');
  if (row.fileIdentity !== null) {
    check(meta.uid === '1000' && meta.gid === '1000' && meta.nlink === '1' &&
      mode === (row.role === 'HOST_LOADER' ? 0o100500n : 0o100400n), 'E_METADATA');
    equal(meta, row.fileIdentity);
    check(meta.size === String(row.expectedBytes), 'E_SIZE');
  } else {
    check(meta.uid === '0' && meta.gid === '0' && (mode & 0o022n) === 0n, 'E_METADATA');
  }
}

function dependencies(trusted, mockOnly) {
  const options = data(trusted, ['fs', 'now', 'inspectElf'], 'E_MOCK_TCB');
  check(typeof options.now === 'function' && typeof options.inspectElf === 'function', 'E_MOCK_TCB');
  check(!mockOnly || options.fs !== fs, 'E_MOCK_TCB');
  const adapter = options.fs;
  check(adapter !== null && typeof adapter === 'object' && !types.isProxy(adapter), 'E_MOCK_TCB');
  const methods = {};
  for (const name of ['lstatSync', 'fstatSync', 'openSync', 'readSync', 'closeSync']) {
    const method = own(adapter, name, 'E_MOCK_TCB');
    check(typeof method === 'function', 'E_MOCK_TCB');
    methods[name] = (...args) => Reflect.apply(method, adapter, args);
  }
  const constants = own(adapter, 'constants', 'E_FLAGS');
  const c = {};
  for (const key of ['O_RDONLY', 'O_NOFOLLOW', 'O_NONBLOCK', 'O_DIRECTORY']) c[key] = own(constants, key, 'E_FLAGS');
  check(c.O_RDONLY === 0 && ['O_NOFOLLOW', 'O_NONBLOCK', 'O_DIRECTORY'].every(key =>
    Number.isSafeInteger(c[key]) && c[key] > 0 && c[key] <= 0x7fffffff), 'E_FLAGS');
  check((c.O_NOFOLLOW & c.O_NONBLOCK) === 0 && (c.O_NOFOLLOW & c.O_DIRECTORY) === 0 &&
    (c.O_NONBLOCK & c.O_DIRECTORY) === 0, 'E_FLAGS');
  return { methods, now: options.now, inspectElf: options.inspectElf, c };
}

function fixtureConfiguration(configuration) {
  const options = data(configuration, ['mockOnly', 'inputs', 'limits'], 'E_MOCK_TCB');
  check(options.mockOnly === true, 'E_MOCK_TCB');
  const overrides = options.limits;
  check(overrides !== null && typeof overrides === 'object' && !types.isProxy(overrides) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(overrides)), 'E_LIMITS');
  const limits = { ...HOST_RUNTIME_LIMITS };
  for (const key of Reflect.ownKeys(overrides)) {
    check(typeof key === 'string' && Object.hasOwn(limits, key), 'E_LIMITS');
    const value = own(overrides, key, 'E_LIMITS');
    check(Number.isSafeInteger(value) && value > 0 && value <= limits[key], 'E_LIMITS');
    limits[key] = value;
  }
  check(limits.cleanupMs < limits.maxTotalMs && limits.maxFsOperations >= 2, 'E_LIMITS');
  const list = options.inputs;
  check(!types.isProxy(list) && Array.isArray(list) && Object.getPrototypeOf(list) === Array.prototype &&
    own(list, 'length', 'E_INPUT') === 7 && Reflect.ownKeys(list).length === 8, 'E_INPUT');
  const inputs = HOST_RUNTIME_INPUTS.map((fixed, index) => {
    const row = data(own(list, String(index), 'E_INPUT'), INPUT_KEYS, 'E_INPUT');
    for (const key of ['role', 'root', 'path', 'soname', 'interpreter', 'sourceKind']) check(row[key] === fixed[key], 'E_INPUT');
    if (index < 2) {
      check(Number.isSafeInteger(row.expectedBytes) && row.expectedBytes > 0 && row.expectedBytes <= fixed.expectedBytes &&
        typeof row.expectedSha256 === 'string' && /^[a-f0-9]{64}$/.test(row.expectedSha256) &&
        row.expectedSha256 !== fixed.expectedSha256, 'E_INPUT');
      row.rootIdentity = identity(row.rootIdentity, 'E_INPUT');
      row.fileIdentity = identity(row.fileIdentity, 'E_INPUT');
      rootPolicy(row.rootIdentity, row);
      filePolicy(row.fileIdentity, row);
    } else {
      for (const key of ['expectedBytes', 'expectedSha256', 'rootIdentity', 'fileIdentity']) check(row[key] === null, 'E_INPUT');
    }
    return row;
  });
  equal(inputs[0].rootIdentity, inputs[1].rootIdentity);
  return freeze({ inputs, limits });
}

function jsonData(value, maxUtf8, maxAscii, guard, copy = false) {
  let utf8 = 0, ascii = 0, nodes = 0;
  const active = new Set();
  const add = (u, a = u) => {
    utf8 += u; ascii += a;
    check(utf8 <= maxUtf8 && ascii <= maxAscii, 'E_OUTPUT');
  };
  const string = text => {
    add(2);
    for (let index = 0; index < text.length; index++) {
      if (index % 4096 === 0) guard();
      const unit = text.charCodeAt(index);
      if (unit === 34 || unit === 92 || [8, 9, 10, 12, 13].includes(unit)) add(2);
      else if (unit < 32) add(6);
      else if (unit < 127) add(1);
      else if (unit >= 0xd800 && unit <= 0xdbff && index + 1 < text.length &&
        text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) { add(4, 12); index++; }
      else if (unit >= 0xd800 && unit <= 0xdfff) add(6);
      else add(unit < 128 ? 1 : unit < 2048 ? 2 : 3, 6);
    }
  };
  const visit = (item, depth) => {
    check(depth <= 32 && ++nodes <= 65536, 'E_OUTPUT');
    if (nodes % 128 === 0) guard();
    if (item === null) { add(4); return null; }
    if (typeof item === 'boolean') { add(item ? 4 : 5); return item; }
    if (typeof item === 'number') { check(Number.isFinite(item), 'E_ELF'); add(String(item).length); return item; }
    if (typeof item === 'string') { string(item); return item; }
    check(typeof item === 'object' && !types.isProxy(item) && !active.has(item), 'E_ELF');
    active.add(item);
    const array = Array.isArray(item);
    check([array ? Array.prototype : Object.prototype, null].includes(Object.getPrototypeOf(item)), 'E_ELF');
    const keys = Reflect.ownKeys(item);
    check(keys.length <= 32769, 'E_OUTPUT');
    const length = array ? own(item, 'length', 'E_ELF') : keys.length;
    check(!array || (Number.isSafeInteger(length) && length <= 32768 && keys.length === length + 1), 'E_ELF');
    const result = copy ? array ? [] : Object.create(null) : item;
    add(2);
    for (let index = 0; index < length; index++) {
      if (index > 0) add(1);
      const key = array ? String(index) : keys[index];
      check(typeof key === 'string', 'E_ELF');
      if (!array) { string(key); add(1); }
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      check(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable, 'E_ELF');
      const child = visit(descriptor.value, depth + 1);
      if (copy) Object.defineProperty(result, key, { value: child, writable: true, enumerable: true, configurable: true });
    }
    active.delete(item);
    return result;
  };
  const result = visit(value, 0);
  return { value: result, utf8Bytes: utf8, asciiBytes: ascii };
}

function observe(inputs, limits, deps, mockOnly, initialError) {
  const counts = { fsOperationsAttempted: 0, fsOperationsCompleted: 0,
    openAttempts: 0, opensCompleted: 0, lstatAttempts: 0, lstatsCompleted: 0,
    fstatAttempts: 0, fstatsCompleted: 0, readAttempts: 0, readsCompleted: 0,
    requestedBytes: 0, returnedBytes: 0, closeAttempts: 0, closesCompleted: 0,
    clockReads: 0, clockReadsCompleted: 0, filesAdmitted: 0, admittedBytes: 0,
    capturedFiles: 0, inspectedFiles: 0, allocatedBytes: 0, peakOwnedFds: 0, ownedFds: 0,
    fsAccountingUncertain: false, readAccountingUncertain: false };
  let role = null, closeFailed = false, cleanupUncertain = false, cleanupOverrun = false;
  let start = null, previous = null, cleanupError = null;
  const candidates = [];
  const clock = cleanup => {
    try {
      check(counts.clockReads < limits.maxClockReads, 'E_LIMIT');
      counts.clockReads++;
      let time;
      try { time = deps.now(); } catch { fail('E_CLOCK'); }
      counts.clockReadsCompleted++;
      check(typeof time === 'number' && Number.isFinite(time) && (previous === null || time >= previous), 'E_CLOCK');
      if (start === null) start = time;
      previous = time;
      if (cleanup) {
        if (time - start >= limits.maxTotalMs) { cleanupOverrun = true; fail('E_DEADLINE'); }
      } else check(time - start < limits.maxTotalMs - limits.cleanupMs, 'E_DEADLINE');
    } catch (error) {
      if (!cleanup) throw error;
      cleanupUncertain = true;
      cleanupError ??= fixedCode(error);
    }
  };
  const guard = () => clock(false);
  const kinds = { openSync: ['openAttempts', 'opensCompleted'], lstatSync: ['lstatAttempts', 'lstatsCompleted'],
    fstatSync: ['fstatAttempts', 'fstatsCompleted'], readSync: ['readAttempts', 'readsCompleted'] };
  const io = (method, args, accept) => {
    guard();
    check(counts.fsOperationsAttempted < limits.maxFsOperations - 2, 'E_LIMIT');
    if (method === 'readSync') {
      check(counts.readAttempts < limits.maxReadAttempts && args[3] <= limits.maxRequestedBytes - counts.requestedBytes, 'E_LIMIT');
      counts.requestedBytes += args[3];
    }
    counts.fsOperationsAttempted++;
    counts[kinds[method][0]]++;
    let result;
    try { result = deps.methods[method](...args); }
    catch {
      counts.fsAccountingUncertain = true;
      if (method === 'readSync') counts.readAccountingUncertain = true;
      if (method === 'openSync') cleanupUncertain = true;
      fail('E_IO');
    }
    counts.fsOperationsCompleted++;
    counts[kinds[method][1]]++;
    if (method === 'readSync') {
      if (!Number.isSafeInteger(result) || result < 0 || result > args[3]) {
        counts.readAccountingUncertain = true;
        fail('E_LENGTH');
      }
      counts.returnedBytes += result;
    }
    if (accept) accept(result);
    guard();
    return result;
  };
  const open = (holder, path, directory) => io('openSync', [path,
    deps.c.O_RDONLY | deps.c.O_NOFOLLOW | deps.c.O_NONBLOCK | (directory ? deps.c.O_DIRECTORY : 0)], fd => {
    if (!Number.isSafeInteger(fd) || fd < 0) { cleanupUncertain = true; fail('E_IO'); }
    holder.fd = fd;
    counts.peakOwnedFds = Math.max(counts.peakOwnedFds, ++counts.ownedFds);
  });
  const close = holder => {
    if (holder.fd === null) return;
    const fd = holder.fd;
    holder.fd = null;
    counts.ownedFds--;
    clock(true);
    counts.fsOperationsAttempted++;
    counts.closeAttempts++;
    try { deps.methods.closeSync(fd); counts.fsOperationsCompleted++; counts.closesCompleted++; }
    catch { closeFailed = true; cleanupUncertain = true; counts.fsAccountingUncertain = true; }
    clock(true);
  };
  const named = path => snapshot(io('lstatSync', [path, { bigint: true }]));
  const stat = fd => snapshot(io('fstatSync', [fd, { bigint: true }]));
  try {
    check(!initialError, initialError);
    guard();
    let hostRoot = null;
    for (const row of inputs) {
      role = row.role;
      guard();
      const root = { fd: null }, leaf = { fd: null };
      let rootMeta, fileMeta, bytes, hash;
      try {
        rootMeta = named(row.root);
        rootPolicy(rootMeta, row);
        if (row.rootIdentity === null) {
          if (hostRoot === null) hostRoot = rootMeta;
          else equal(rootMeta, hostRoot);
        }
        open(root, row.root, true);
        equal(stat(root.fd), rootMeta);
        fileMeta = named(row.path);
        filePolicy(fileMeta, row);
        open(leaf, row.path, false);
        equal(stat(leaf.fd), fileMeta);
        const sizeBig = BigInt(fileMeta.size);
        check(sizeBig > 0n && sizeBig <= BigInt(limits.maxFileBytes), 'E_SIZE');
        const size = Number(sizeBig);
        check(size <= limits.maxAggregateBytes - counts.admittedBytes, 'E_LIMIT');
        counts.admittedBytes += size;
        counts.filesAdmitted++;
        guard();
        counts.allocatedBytes += size + 1;
        bytes = Buffer.alloc(size + 1);
        hash = createHash('sha256');
        for (let position = 0; position < size; position += limits.chunkBytes) {
          const length = Math.min(limits.chunkBytes, size - position);
          check(io('readSync', [leaf.fd, bytes, position, length, position]) === length, 'E_LENGTH');
          hash.update(bytes.subarray(position, position + length));
        }
        check(io('readSync', [leaf.fd, bytes, size, 1, size]) === 0, 'E_LENGTH');
        equal(stat(leaf.fd), fileMeta);
        equal(named(row.path), fileMeta);
        equal(stat(root.fd), rootMeta);
        equal(named(row.root), rootMeta);
        counts.capturedFiles++;
      } finally {
        close(leaf);
        close(root);
      }
      check(!closeFailed, 'E_CLOSE');
      check(!cleanupError, cleanupError);
      guard();
      const digest = hash.digest('hex');
      check(row.expectedSha256 === null || digest === row.expectedSha256, 'E_HASH');
      let raw;
      try { raw = deps.inspectElf(bytes.subarray(0, Number(fileMeta.size))); }
      catch { fail('E_ELF'); }
      guard();
      const requirements = jsonData(raw, 131072, limits.maxOutputBytes - 1, guard, true).value;
      check(requirements !== null && typeof requirements === 'object' && !Array.isArray(requirements) &&
        requirements.profile === 'elf64le-x86-64-requirements-v4' && requirements.state === 'ELF_REQUIREMENTS_METADATA' &&
        requirements.inputSha256 === digest && requirements.byteLength === Number(fileMeta.size) &&
        requirements.header?.machine === 62 && [2, 3].includes(requirements.header?.type) &&
        requirements.dynamic?.soname === row.soname && requirements.interpreter === row.interpreter &&
        INSPECTOR_FALSE.every(key => requirements[key] === false) &&
        OPTIONAL_FALSE.every(key => !Object.hasOwn(requirements, key) || requirements[key] === false) &&
        REQUIREMENTS_FALSE.every(key => requirements.requirements?.[key] === false), 'E_ELF');
      check(Array.isArray(requirements.programHeaders) && Array.isArray(requirements.dynamic.needed) &&
        Array.isArray(requirements.dynamic.unknownTags) &&
        ['versionNeeds', 'versionDefinitions', 'notes', 'buildIds', 'abiTags', 'properties'].every(key =>
          Array.isArray(requirements.requirements[key])), 'E_ELF');
      counts.inspectedFiles++;
      candidates.push(freeze({ role: row.role, path: row.path, root: row.root, sourceKind: row.sourceKind,
        size: Number(fileMeta.size), sha256: digest, rootMetadata: rootMeta, fileMetadata: fileMeta, requirements }));
      bytes = null;
      guard();
    }
    role = null;
    const publishedCounts = { ...counts };
    const countBytes = jsonData(publishedCounts, Infinity, Infinity, () => {}).asciiBytes;
    const result = { profile: PROFILE, status: 'HOST_RUNTIME_CANDIDATES_OBSERVED', mockOnly,
      candidates, counts: publishedCounts, ioAccountingComplete: true, closeFailed, cleanupUncertain, cleanupOverrun, ...FLAGS };
    const sized = jsonData(result, limits.maxOutputBytes - 1, limits.maxOutputBytes - 1, guard);
    guard();
    Object.assign(publishedCounts, counts);
    const finalCountBytes = jsonData(publishedCounts, Infinity, Infinity, () => {}).asciiBytes;
    check(sized.asciiBytes + finalCountBytes - countBytes + 1 <= limits.maxOutputBytes, 'E_OUTPUT');
    return freeze(result);
  } catch (error) {
    return freeze({ profile: PROFILE, status: 'STOP', mockOnly,
      error: closeFailed ? 'E_CLOSE' : cleanupError ?? fixedCode(error), role, counts, flags: FLAGS,
      ioAccountingComplete: false, closeFailed, cleanupUncertain, cleanupOverrun });
  }
}

function fixedCode(error) {
  if (error !== null && typeof error === 'object' && !types.isProxy(error)) {
    const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
    if (descriptor && Object.hasOwn(descriptor, 'value') && CODES.has(descriptor.value)) return descriptor.value;
  }
  return 'E_IO';
}

let consumed = false;
export function observeHostRuntimeProviders() {
  const error = consumed ? 'E_CONSUMED' : arguments.length !== 0 ? 'E_ARGUMENTS' : null;
  consumed = true;
  let deps;
  if (error) return observe(HOST_RUNTIME_INPUTS, HOST_RUNTIME_LIMITS, null, false, error);
  try { deps = dependencies({ fs, now: productionNow, inspectElf: inspectElf64RequirementsV4 }, false); }
  catch (failure) { return observe(HOST_RUNTIME_INPUTS, HOST_RUNTIME_LIMITS, null, false, fixedCode(failure)); }
  return observe(HOST_RUNTIME_INPUTS, HOST_RUNTIME_LIMITS, deps, false, null);
}

export function createHostRuntimeProvidersFixture(configuration, trustedDeps) {
  check(arguments.length === 2, 'E_MOCK_TCB');
  const { inputs, limits } = fixtureConfiguration(configuration);
  const deps = dependencies(trustedDeps, true);
  let fixtureConsumed = false;
  return Object.freeze({ observeHostRuntimeProviders() {
    const error = fixtureConsumed ? 'E_CONSUMED' : arguments.length !== 0 ? 'E_ARGUMENTS' : null;
    fixtureConsumed = true;
    return observe(inputs, limits, deps, true, error);
  } });
}
