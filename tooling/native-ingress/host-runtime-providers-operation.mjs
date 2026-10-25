// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { performance } from 'node:perf_hooks';

const stringify = JSON.stringify;
const parse = JSON.parse;
const descriptorOf = Object.getOwnPropertyDescriptor;
const setPrototypeOf = Object.setPrototypeOf;
const prototypeOf = Object.getPrototypeOf;
const ownKeys = Reflect.ownKeys;
const isProxy = types.isProxy;
const isArray = Array.isArray;
const freeze = Object.freeze;
const MAX_OUTPUT = 2097152;
const SOURCE_FIELDS = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs'];
const PROFILE = 'registered-host-runtime-providers-v1';
const REPO = '/tmp/opencode/f9-bootstrap-correspondence';
const STAGE = '/tmp/opencode/f9-xz-qualification-01';
const HOST = '/usr/lib/x86_64-linux-gnu';
const SOURCE_NAMES = ['helper', 'elf4', 'staging', 'metadata', 'receipt'];
const SOURCE_PATHS = freeze({
  helper: REPO + '/tooling/native-ingress/host-runtime-providers.mjs',
  elf4: REPO + '/tooling/native-ingress/elf-requirements-v4.mjs',
  staging: REPO + '/tooling/native-ingress/xz-staging.mjs',
  metadata: REPO + '/tooling/native-ingress/elf-metadata.mjs',
  receipt: REPO + '/_spec/tooling/native-ingress/xz-qualification.receipt.json',
});

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    freeze(value);
  }
  return value;
}

export const HOST_RUNTIME_OPERATION_SOURCE_PINS = deepFreeze({
  raw: {
    helper: { bytes: 23026, sha256: '97dcdbc62e2bcb89d48e58a36b3cde59db4dc283eac46574364c5fcac2a6ce48' },
    elf4: { bytes: 21142, sha256: 'f5a428aae91593853acfd289c4e91fb715ca530744defa2fe9447f6dda0602f3' },
    staging: { bytes: 16688, sha256: 'f75c21a58bb67e6ab3f8b1dafd090e11ac2d3a70f017da35afb81b00761b71b4' },
    metadata: { bytes: 19842, sha256: 'b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85' },
    receipt: { bytes: 4239, sha256: 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233' },
  },
  linked: {
    helper: { bytes: 51221, sha256: '38bba76176d6e4138ee2426537797fd39ea267abcae02e5e8aa29f16a282e9bb' },
    staging: { bytes: 43154, sha256: '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2' },
  },
});

export const HOST_RUNTIME_OPERATION_LIMITS = deepFreeze({
  maxFileBytes: 8388608, maxAggregateBytes: 33554432, maxRequestedBytes: 33554439,
  maxFsOperations: 2048, maxReadAttempts: 1024, maxClockReads: 8192,
  maxOutputBytes: MAX_OUTPUT, chunkBytes: 65536, maxTotalMs: 10000, cleanupMs: 2000,
});

const ROOT_IDENTITY = deepFreeze({ dev: '28', ino: '13941', mode: '16704', uid: '1000', gid: '1000',
  nlink: '2', size: '4096', mtimeNs: '1792835630900915490', ctimeNs: '1792835630901678421' });
const LOADER_IDENTITY = deepFreeze({ dev: '29', ino: '1212100', mode: '33088', uid: '1000', gid: '1000',
  nlink: '1', size: '254864', mtimeNs: '1792835630900220500', ctimeNs: '1792835630900220500' });
const LIBC_IDENTITY = deepFreeze({ dev: '29', ino: '1212102', mode: '33024', uid: '1000', gid: '1000',
  nlink: '1', size: '2186512', mtimeNs: '1792835630901678421', ctimeNs: '1792835630901678421' });

export const HOST_RUNTIME_OPERATION_INPUTS = deepFreeze([
  { role: 'HOST_LOADER', root: STAGE, path: `${STAGE}/ld-linux-x86-64.so.2`, soname: 'ld-linux-x86-64.so.2',
    interpreter: null, sourceKind: 'PINNED_ORDINARY_STAGE', expectedBytes: 254864,
    expectedSha256: 'c5e80a563850d6ab5c2f2482e4202d9c1b71fbf44854b8c399e63527202c64e1',
    rootIdentity: ROOT_IDENTITY, fileIdentity: LOADER_IDENTITY },
  { role: 'HOST_LIBC', root: STAGE, path: `${STAGE}/libc.so.6`, soname: 'libc.so.6',
    interpreter: '/lib64/ld-linux-x86-64.so.2', sourceKind: 'PINNED_ORDINARY_STAGE', expectedBytes: 2186512,
    expectedSha256: 'a3947513a02831ec692ebf13053c07614882ab54a2101fb91a1b15724062ed0c',
    rootIdentity: ROOT_IDENTITY, fileIdentity: LIBC_IDENTITY },
  ...[['HOST_LIBM', 'libm.so.6'], ['HOST_LIBDL', 'libdl.so.2'], ['HOST_LIBPTHREAD', 'libpthread.so.0'],
    ['HOST_LIBRT', 'librt.so.1'], ['HOST_LIBGCC_S', 'libgcc_s.so.1']].map(([role, soname]) => ({
    role, root: HOST, path: `${HOST}/${soname}`, soname, interpreter: null,
    sourceKind: 'ORDINARY_HOST_CANDIDATE_UNAUTHENTICATED', expectedBytes: null,
    expectedSha256: null, rootIdentity: null, fileIdentity: null,
  })),
]);

const NEGATIVES = deepFreeze({
  candidateExecuted: false, nativeAuthority: false, nativeQualified: false, runtimeQualified: false,
  abiQualified: false, symbolBindingsVerified: false, imageQualified: false, dockerQualified: false,
  noPythonRuntimeVerified: false, decoderQualified: false, loaderClosureVerified: false,
  sourceAuthenticated: false, publisherAuthenticated: false, sourceRootAuthentication: false,
  ancestorRacesExcluded: false, atomicSnapshotVerified: false, hardDeadlineGuaranteed: false,
  hardRssBounded: false, installedUsability: false, rustReady: false, trainingReady: false,
  runtimeProvidersQualified: false, pythonFreeSubsetVerified: false, imagePrepared: false,
  dockerProviderQualified: false, processTreeBounded: false, sourceAuthentication: false,
  atomicSnapshot: false, provenanceVerified: false,
});
const HELPER_FLAGS = deepFreeze({
  scope: 'CANDIDATE_DATA_NOT_RUNTIME_ADMISSION',
  nativeQualified: false, nativeAuthority: false, rustReady: false, trainingReady: false,
  loaderClosureVerified: false, runtimeProvidersQualified: false, pythonFreeSubsetVerified: false,
  installedUsability: false, imagePrepared: false, dockerProviderQualified: false,
  symbolBindingsVerified: false, hardRssBounded: false, hardDeadlineGuaranteed: false,
  processTreeBounded: false, ancestorRacesExcluded: false, sourceAuthentication: false,
  sourceRootAuthentication: false, atomicSnapshot: false, candidateExecuted: false,
  provenanceVerified: false, noPythonRuntimeVerified: false, decoderQualified: false,
});
const HELPER_COUNT_LIMITS = deepFreeze({
  fsOperationsAttempted: 2048, fsOperationsCompleted: 2048,
  openAttempts: 14, opensCompleted: 14, lstatAttempts: 28, lstatsCompleted: 28,
  fstatAttempts: 28, fstatsCompleted: 28, readAttempts: 1024, readsCompleted: 1024,
  requestedBytes: 33554439, returnedBytes: 33554432, closeAttempts: 14, closesCompleted: 14,
  clockReads: 8192, clockReadsCompleted: 8192, filesAdmitted: 7, admittedBytes: 33554432,
  capturedFiles: 7, inspectedFiles: 7, allocatedBytes: 33554439, peakOwnedFds: 2, ownedFds: 2,
});
const CODES = new Set(['E_ARGUMENTS', 'E_ONESHOT', 'E_CONFIG', 'E_SOURCE_IO',
  'E_SOURCE_METADATA', 'E_SOURCE_BINDING', 'E_SOURCE_LENGTH', 'E_SOURCE_HASH', 'E_SOURCE_CLOSE',
  'E_SOURCE_LIMIT', 'E_LINK', 'E_IMPORT', 'E_CONSTANTS', 'E_CLOCK', 'E_PREFLIGHT', 'E_OUTER',
  'E_HELPER', 'E_HELPER_STOP', 'E_HELPER_DATA', 'E_CANDIDATES', 'E_ELF', 'E_QUALIFICATION',
  'E_ACCOUNTING', 'E_OUTPUT']);
const HELPER_CODES = new Set(['E_ARGUMENTS', 'E_CONSUMED', 'E_MOCK_TCB', 'E_INPUT', 'E_LIMITS',
  'E_FLAGS', 'E_IO', 'E_METADATA', 'E_IDENTITY', 'E_SIZE', 'E_LIMIT', 'E_LENGTH', 'E_HASH',
  'E_ELF', 'E_CLOSE', 'E_CLOCK', 'E_DEADLINE', 'E_OUTPUT']);
const ROLES = new Set([...HOST_RUNTIME_OPERATION_INPUTS.map(value => value.role),
  ...SOURCE_NAMES.map(name => `SOURCE_${name.toUpperCase()}`)]);
const boolTrue = new Set(['mockOnly', 'ioAccountingComplete', 'privateSnapshot', 'present']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => `data:text/javascript;base64,${Buffer.from(bytes).toString('base64')}`;

class Stop extends Error {
  constructor(code, role = null) {
    super(code);
    this.code = CODES.has(code) ? code : 'E_HELPER';
    this.role = ROLES.has(role) ? role : null;
  }
}

function requireThat(condition, code, role = null) {
  if (!condition) throw new Stop(code, role);
}

function plain(value, code = 'E_HELPER_DATA') {
  requireThat(value !== null && typeof value === 'object' && !isProxy(value), code);
  requireThat([Object.prototype, null].includes(prototypeOf(value)), code);
  const result = Object.create(null);
  const keys = ownKeys(value);
  requireThat(keys.length <= 32, code);
  for (const key of keys) {
    requireThat(typeof key === 'string', code);
    const descriptor = descriptorOf(value, key);
    requireThat(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable, code);
    Object.defineProperty(result, key, { value: descriptor.value, enumerable: true });
  }
  return result;
}

function ownField(value, key, code = 'E_HELPER_DATA') {
  requireThat(value !== null && typeof value === 'object' && !isProxy(value) &&
    [Object.prototype, null].includes(prototypeOf(value)), code);
  const field = descriptorOf(value, key);
  requireThat(field && Object.hasOwn(field, 'value') && field.enumerable, code);
  return field.value;
}

function exact(value, expected, code = 'E_CONSTANTS') {
  if (expected === null || typeof expected !== 'object') {
    requireThat(value === expected, code);
    return;
  }
  requireThat(value !== null && typeof value === 'object' && !isProxy(value), code);
  const array = isArray(expected);
  requireThat(isArray(value) === array && (prototypeOf(value) === (array ? Array.prototype : Object.prototype) ||
    (!array && prototypeOf(value) === null)), code);
  const actualKeys = ownKeys(value);
  const expectedKeys = ownKeys(expected);
  requireThat(actualKeys.length === expectedKeys.length && expectedKeys.every(key => actualKeys.includes(key)), code);
  for (const key of expectedKeys) {
    const field = descriptorOf(value, key);
    requireThat(field && Object.hasOwn(field, 'value'), code);
    exact(field.value, expected[key], code);
  }
}

function escapedStringBytes(value) {
  let count = 2;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    count += code >= 0x7f || code < 0x20 ? ([8, 9, 10, 12, 13].includes(code) ? 2 : 6) :
      code === 34 || code === 92 ? 2 : 1;
    if (count > MAX_OUTPUT) throw new Stop('E_OUTPUT');
  }
  return count;
}

function ownSnapshot(value, maximum = MAX_OUTPUT) {
  let bytes = 0;
  let nodes = 0;
  const seen = new Set();
  const add = count => {
    bytes += count;
    requireThat(bytes <= maximum, 'E_OUTPUT');
  };
  const visit = (item, depth) => {
    requireThat(++nodes <= 200000 && depth <= 32, 'E_OUTPUT');
    if (item === null) { add(4); return null; }
    if (typeof item === 'string') { add(escapedStringBytes(item)); return item; }
    if (typeof item === 'boolean') { add(item ? 4 : 5); return item; }
    if (typeof item === 'number') {
      requireThat(Number.isFinite(item) && Number.isSafeInteger(item), 'E_HELPER_DATA');
      add(String(Object.is(item, -0) ? 0 : item).length);
      return item;
    }
    requireThat(item !== null && typeof item === 'object' && !isProxy(item) && !seen.has(item), 'E_HELPER_DATA');
    seen.add(item);
    const array = isArray(item);
    requireThat(prototypeOf(item) === (array ? Array.prototype : Object.prototype) ||
      prototypeOf(item) === null, 'E_HELPER_DATA');
    const keys = ownKeys(item);
    requireThat(keys.length <= 200001, 'E_OUTPUT');
    let result;
    add(2);
    if (array) {
      const length = descriptorOf(item, 'length')?.value;
      requireThat(Number.isSafeInteger(length) && length >= 0 && length <= 200000 && keys.length === length + 1,
        'E_HELPER_DATA');
      result = [];
      for (let index = 0; index < length; index++) {
        const field = descriptorOf(item, String(index));
        requireThat(field && Object.hasOwn(field, 'value') && field.enumerable, 'E_HELPER_DATA');
        if (index) add(1);
        result.push(visit(field.value, depth + 1));
      }
      setPrototypeOf(result, null);
    } else {
      result = Object.create(null);
      let index = 0;
      for (const key of keys) {
        requireThat(typeof key === 'string' && key.length <= 256, 'E_HELPER_DATA');
        const field = descriptorOf(item, key);
        requireThat(Object.hasOwn(field, 'value') && field.enumerable, 'E_HELPER_DATA');
        if (index++) add(1);
        add(escapedStringBytes(key) + 1);
        Object.defineProperty(result, key, { value: visit(field.value, depth + 1), enumerable: true });
      }
    }
    seen.delete(item);
    return freeze(result);
  };
  const snapshot = visit(value, 0);
  return { snapshot, bytes };
}

function publicText(value, guard = () => {}) {
  const { snapshot, bytes } = ownSnapshot(value, MAX_OUTPUT - 1);
  guard();
  const text = stringify(snapshot).replace(/[\u007f-\uffff]/g,
    character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`) + '\n';
  requireThat(text.length === bytes + 1 && text.length <= MAX_OUTPUT, 'E_OUTPUT');
  return text;
}

function clock(now) {
  let reads = 0;
  let previous = null;
  const read = () => {
    requireThat(++reads <= 8192, 'E_CLOCK');
    let current;
    try { current = now(); } catch { throw new Stop('E_CLOCK'); }
    requireThat(typeof current === 'number' && Number.isFinite(current) &&
      (previous === null || current >= previous), 'E_CLOCK');
    previous = current;
    return current;
  };
  const start = read();
  return { read, elapsed: () => read() - start,
    guard: (limit, code) => requireThat(read() - start <= limit, code) };
}

function metadata(value) {
  requireThat(value !== null && typeof value === 'object' && !isProxy(value), 'E_SOURCE_METADATA');
  const result = {};
  for (const key of SOURCE_FIELDS) {
    const field = descriptorOf(value, key);
    requireThat(field && Object.hasOwn(field, 'value') && typeof field.value === 'bigint' && field.value >= 0n,
      'E_SOURCE_METADATA');
    result[key] = field.value;
  }
  requireThat(result.ino > 0n && (result.mode & 0o170000n) === 0o100000n && result.nlink >= 1n,
    'E_SOURCE_METADATA');
  return result;
}

function sameMetadata(a, b) {
  requireThat(SOURCE_FIELDS.every(key => a[key] === b[key]), 'E_SOURCE_BINDING');
}

function sourceContext(adapter, timer) {
  const counts = { fsOperations: 0, readAttempts: 0, requestedBytes: 0, returnedBytes: 0, capturedBytes: 0,
    allocatedBytes: 0, closeAttempts: 0, positiveCloses: 0, peakOwnedFds: 0, sourceReads: 0 };
  const methods = ['lstatSync', 'fstatSync', 'openSync', 'readSync', 'closeSync'];
  const bindings = Object.fromEntries(methods.map(name => {
    const field = descriptorOf(adapter, name);
    requireThat(field && Object.hasOwn(field, 'value') && typeof field.value === 'function', 'E_CONFIG');
    return [name, field.value.bind(adapter)];
  }));
  let owned = null;
  let closeFailed = false;
  let ioUncertain = false;
  const call = (method, ...args) => {
    timer.guard(1000, 'E_PREFLIGHT');
    requireThat(counts.fsOperations < 1023, 'E_SOURCE_LIMIT');
    counts.fsOperations++;
    let result;
    try { result = bindings[method](...args); }
    catch { ioUncertain = true; throw new Stop('E_SOURCE_IO'); }
    if (method === 'openSync') {
      if (!Number.isSafeInteger(result) || result < 0) {
        ioUncertain = true;
        throw new Stop('E_SOURCE_IO');
      }
      owned = result;
      counts.peakOwnedFds = 1;
    }
    if (method === 'readSync') {
      if (!Number.isSafeInteger(result) || result < 0 || result > args[3]) {
        ioUncertain = true;
        throw new Stop('E_SOURCE_LENGTH');
      }
      counts.returnedBytes += result;
    }
    timer.guard(1000, 'E_PREFLIGHT');
    return result;
  };
  const close = () => {
    if (owned === null) return;
    const fd = owned;
    owned = null;
    counts.fsOperations++;
    counts.closeAttempts++;
    try { bindings.closeSync(fd); counts.positiveCloses++; }
    catch { closeFailed = true; ioUncertain = true; throw new Stop('E_SOURCE_CLOSE'); }
  };
  const capture = (name, pin) => {
    const path = SOURCE_PATHS[name];
    const role = `SOURCE_${name.toUpperCase()}`;
    try {
      requireThat(Number.isSafeInteger(pin.bytes) && pin.bytes > 0 && pin.bytes <= 262144 &&
        /^[0-9a-f]{64}$/.test(pin.sha256), 'E_SOURCE_LIMIT');
      const before = metadata(call('lstatSync', path, { bigint: true }));
      requireThat(before.size === BigInt(pin.bytes), 'E_SOURCE_LENGTH');
      const flags = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK;
      const fd = call('openSync', path, flags);
      let bytes;
      try {
        sameMetadata(before, metadata(call('fstatSync', fd, { bigint: true })));
        requireThat(counts.allocatedBytes + pin.bytes <= 262144, 'E_SOURCE_LIMIT');
        bytes = Buffer.alloc(pin.bytes);
        counts.allocatedBytes += pin.bytes;
        let at = 0;
        let attempts = 0;
        while (at < bytes.length) {
          requireThat(++attempts <= 127, 'E_SOURCE_LIMIT');
          const length = Math.min(65536, bytes.length - at);
          counts.readAttempts++;
          counts.requestedBytes += length;
          const got = call('readSync', fd, bytes, at, length, at);
          requireThat(Number.isSafeInteger(got) && got > 0 && got <= length, 'E_SOURCE_LENGTH');
          counts.capturedBytes += got;
          at += got;
        }
        requireThat(++attempts <= 128, 'E_SOURCE_LIMIT');
        counts.readAttempts++;
        counts.requestedBytes++;
        requireThat(call('readSync', fd, Buffer.alloc(1), 0, 1, at) === 0, 'E_SOURCE_LENGTH');
        sameMetadata(before, metadata(call('fstatSync', fd, { bigint: true })));
        sameMetadata(before, metadata(call('lstatSync', path, { bigint: true })));
      } finally { close(); }
      timer.guard(1000, 'E_PREFLIGHT');
      requireThat(hash(bytes) === pin.sha256, 'E_SOURCE_HASH');
      counts.sourceReads++;
      return bytes;
    } catch (error) {
      if (owned !== null) {
        try { close(); } catch { throw new Stop('E_SOURCE_CLOSE', role); }
      }
      throw new Stop(error instanceof Stop ? error.code : 'E_SOURCE_IO', role);
    }
  };
  return { capture, close, counts,
    get accountingComplete() { return !ioUncertain && !closeFailed && owned === null; },
    get closeFailed() { return closeFailed; }, get ioUncertain() { return ioUncertain; } };
}

function link(raw, specifier, replacement, pin) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  const needle = `'${specifier}'`;
  const at = text.indexOf(needle);
  requireThat(at >= 0 && text.indexOf(needle, at + needle.length) === -1, 'E_LINK');
  const linked = Buffer.from(text.slice(0, at) + `'${replacement}'` + text.slice(at + needle.length));
  requireThat(linked.length === pin.bytes && hash(linked) === pin.sha256, 'E_LINK');
  return uri(linked);
}

function moduleData(namespace, name) {
  requireThat(namespace !== null && typeof namespace === 'object' && !isProxy(namespace), 'E_IMPORT');
  const field = descriptorOf(namespace, name);
  requireThat(field && Object.hasOwn(field, 'value'), 'E_IMPORT');
  return field.value;
}

function constants(helper, staging, receipt) {
  exact(moduleData(helper, 'HOST_RUNTIME_INPUTS'), HOST_RUNTIME_OPERATION_INPUTS);
  exact(moduleData(helper, 'HOST_RUNTIME_LIMITS'), HOST_RUNTIME_OPERATION_LIMITS);
  const stageProfile = ownSnapshot(moduleData(staging, 'XZ_STAGING_PROFILE'), 131072).snapshot;
  requireThat(stageProfile.profile === 'fixed-xz-ordinary-staging-v1' && stageProfile.root === STAGE &&
    isArray(stageProfile.images) && stageProfile.images.length === 4, 'E_CONSTANTS');
  requireThat(receipt.version === 'ordinary-xz-finite-receipt-v1' &&
    receipt.staged?.profile === stageProfile.profile && receipt.staged.root === STAGE, 'E_CONSTANTS');
  exact(receipt.staged.directory, ROOT_IDENTITY);
  for (const [input, index] of [[HOST_RUNTIME_OPERATION_INPUTS[0], 1], [HOST_RUNTIME_OPERATION_INPUTS[1], 3]]) {
    const image = stageProfile.images[index];
    const file = receipt.staged.files[index];
    requireThat(image.name === input.soname && image.size === input.expectedBytes &&
      image.sha256 === input.expectedSha256 && image.soname === input.soname &&
      image.interpreter === input.interpreter && file.name === input.soname &&
      input.path === `${stageProfile.root}/${image.name}`, 'E_CONSTANTS');
    exact(file.metadata, input.fileIdentity);
  }
  const observe = moduleData(helper, 'observeHostRuntimeProviders');
  requireThat(typeof observe === 'function', 'E_IMPORT');
  return observe;
}

function negativeFlags(value) {
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    requireThat(child !== true || boolTrue.has(key), 'E_QUALIFICATION');
    negativeFlags(child);
  }
}

function publicMetadata(value, directory, size) {
  requireThat(value !== null && typeof value === 'object' && ownKeys(value).length === 9, 'E_CANDIDATES');
  const result = {};
  for (const key of SOURCE_FIELDS) {
    requireThat(typeof value[key] === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value[key]), 'E_CANDIDATES');
    result[key] = BigInt(value[key]);
  }
  requireThat(result.ino > 0n && result.nlink >= 1n && result.uid === 0n && result.gid === 0n &&
    (result.mode & 0o170000n) === (directory ? 0o040000n : 0o100000n) &&
    (result.mode & 0o022n) === 0n && (directory || result.size === BigInt(size)), 'E_CANDIDATES');
}

function helperCounts(value) {
  requireThat(value !== null && typeof value === 'object' && !isArray(value) &&
    ownKeys(value).length === ownKeys(HELPER_COUNT_LIMITS).length + 2,
    'E_ACCOUNTING');
  for (const [key, limit] of Object.entries(HELPER_COUNT_LIMITS)) {
    requireThat(Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= limit, 'E_ACCOUNTING');
  }
  for (const key of ['fsAccountingUncertain', 'readAccountingUncertain']) {
    requireThat(typeof value[key] === 'boolean', 'E_ACCOUNTING');
  }
  for (const [attempts, completed] of [['fsOperationsAttempted', 'fsOperationsCompleted'],
    ['openAttempts', 'opensCompleted'], ['lstatAttempts', 'lstatsCompleted'],
    ['fstatAttempts', 'fstatsCompleted'], ['readAttempts', 'readsCompleted'],
    ['closeAttempts', 'closesCompleted'], ['clockReads', 'clockReadsCompleted']]) {
    requireThat(value[completed] <= value[attempts], 'E_ACCOUNTING');
  }
  return value;
}

function validateObservation(result, mockOnly) {
  requireThat(result.profile === 'host-runtime-providers-v1' && result.mockOnly === mockOnly, 'E_HELPER_DATA');
  requireThat(result.status === 'HOST_RUNTIME_CANDIDATES_OBSERVED', 'E_HELPER_STOP');
  requireThat(result.ioAccountingComplete === true && result.closeFailed === false &&
    result.cleanupUncertain === false && result.cleanupOverrun === false,
    'E_ACCOUNTING');
  const counts = helperCounts(result.counts);
  requireThat(counts.closeAttempts === 14 && counts.closesCompleted === 14 && counts.peakOwnedFds === 2 &&
    counts.ownedFds === 0 && counts.opensCompleted === 14 && counts.openAttempts === 14 &&
    counts.lstatAttempts === 28 && counts.lstatsCompleted === 28 &&
    counts.fstatAttempts === 28 && counts.fstatsCompleted === 28 &&
    counts.fsOperationsAttempted === counts.fsOperationsCompleted &&
    counts.readAttempts === counts.readsCompleted && counts.clockReads === counts.clockReadsCompleted &&
    counts.filesAdmitted === 7 && counts.capturedFiles === 7 && counts.inspectedFiles === 7 &&
    counts.fsAccountingUncertain === false && counts.readAccountingUncertain === false &&
    counts.requestedBytes === counts.returnedBytes + 7 && counts.allocatedBytes === counts.returnedBytes + 7 &&
    counts.admittedBytes === counts.returnedBytes && counts.fsOperationsAttempted === counts.readAttempts + 84,
    'E_ACCOUNTING');
  for (const [key, value] of Object.entries(HELPER_FLAGS)) {
    requireThat(result[key] === value, 'E_QUALIFICATION');
  }
  negativeFlags(result);
  requireThat(isArray(result.candidates) && result.candidates.length === 7, 'E_CANDIDATES');
  let aggregate = 0;
  for (let index = 0; index < 7; index++) {
    const candidate = result.candidates[index];
    const input = HOST_RUNTIME_OPERATION_INPUTS[index];
    requireThat(candidate && candidate.role === input.role && candidate.root === input.root &&
      candidate.path === input.path && candidate.sourceKind === input.sourceKind &&
      Number.isSafeInteger(candidate.size) && candidate.size >= 1 && candidate.size <= 8388608 &&
      typeof candidate.sha256 === 'string' && /^[0-9a-f]{64}$/.test(candidate.sha256), 'E_CANDIDATES', input.role);
    aggregate += candidate.size;
    requireThat(aggregate <= 33554432, 'E_CANDIDATES', input.role);
    if (index < 2) {
      requireThat(candidate.size === input.expectedBytes && candidate.sha256 === input.expectedSha256,
        'E_CANDIDATES', input.role);
      exact(candidate.rootMetadata, input.rootIdentity, 'E_CANDIDATES');
      exact(candidate.fileMetadata, input.fileIdentity, 'E_CANDIDATES');
    } else {
      publicMetadata(candidate.rootMetadata, true, 0);
      publicMetadata(candidate.fileMetadata, false, candidate.size);
      if (index > 2) exact(candidate.rootMetadata, result.candidates[2].rootMetadata, 'E_CANDIDATES');
    }
    const frame = candidate.requirements;
    requireThat(frame && frame.profile === 'elf64le-x86-64-requirements-v4' &&
      frame.state === 'ELF_REQUIREMENTS_METADATA' && frame.byteLength === candidate.size &&
      frame.inputSha256 === candidate.sha256 && frame.header?.machine === 62 &&
      [2, 3].includes(frame.header.type) && frame.interpreter === input.interpreter &&
      frame.dynamic?.soname === input.soname && frame.dynamic.present === true &&
      isArray(frame.programHeaders) && isArray(frame.dynamic.needed) && isArray(frame.dynamic.unknownTags) &&
      frame.requirements && ['versionNeeds', 'versionDefinitions', 'notes', 'buildIds', 'abiTags', 'properties']
        .every(key => isArray(frame.requirements[key])), 'E_ELF', input.role);
    for (const key of ['candidateExecuted', 'decoderQualified', 'realCandidateRead', 'realArchiveInspected',
      'provenanceVerified', 'noPythonRuntimeVerified', 'loaderClosureVerified', 'nativeAuthority',
      'nativeQualified', 'installedUsability', 'rustReady', 'trainingReady']) {
      requireThat(frame[key] === false, 'E_QUALIFICATION', input.role);
    }
    for (const key of ['symbolBindingsVerified', 'hardwareCompatibilityVerified', 'instructionCoverageVerified',
      'propertyEnforcementVerified', 'buildIdAuthenticated']) {
      requireThat(frame.requirements[key] === false, 'E_QUALIFICATION', input.role);
    }
  }
  requireThat(aggregate === counts.admittedBytes, 'E_ACCOUNTING');
  return result;
}

function stopMetadata(result, mockOnly) {
  try {
    requireThat(ownField(result, 'profile') === 'host-runtime-providers-v1' &&
      ownField(result, 'mockOnly') === mockOnly && ownField(result, 'status') === 'STOP', 'E_HELPER_DATA');
    const suppliedRole = ownField(result, 'role');
    const suppliedCode = ownField(result, 'error');
    const role = HOST_RUNTIME_OPERATION_INPUTS.some(input => input.role === suppliedRole) ? suppliedRole : null;
    const code = HELPER_CODES.has(suppliedCode) ? suppliedCode : 'E_HELPER_STOP';
    const counts = ownSnapshot(ownField(result, 'counts'), 8192).snapshot;
    helperCounts(counts);
    const helperFlags = ownSnapshot(ownField(result, 'flags'), 8192).snapshot;
    exact(helperFlags, HELPER_FLAGS, 'E_QUALIFICATION');
    const flags = {};
    for (const [key, output] of [['ioAccountingComplete', 'helperIoAccountingComplete'],
      ['closeFailed', 'helperCloseFailed'], ['cleanupUncertain', 'helperCleanupUncertain'],
      ['cleanupOverrun', 'helperCleanupOverrun']]) {
      const flag = ownField(result, key);
      requireThat(typeof flag === 'boolean', 'E_HELPER_DATA');
      flags[output] = flag;
    }
    return { role, helperCode: code, helperCounts: counts, helperFlags, ...flags };
  } catch { return {}; }
}

function pinRecord(value) {
  const fields = plain(value, 'E_CONFIG');
  requireThat(ownKeys(fields).length === 2 && Number.isSafeInteger(fields.bytes) && fields.bytes >= 1 &&
    fields.bytes <= 262144 && typeof fields.sha256 === 'string' && /^[a-f0-9]{64}$/.test(fields.sha256), 'E_CONFIG');
  return { bytes: fields.bytes, sha256: fields.sha256 };
}

function mockConfiguration(config) {
  const fields = plain(config, 'E_CONFIG');
  const expected = ['mockOnly', 'fs', 'now', 'moduleImporter', 'helperPin', 'linkedHelperPin'];
  requireThat(ownKeys(fields).length === expected.length && expected.every(key => Object.hasOwn(fields, key)) &&
    fields.mockOnly === true && typeof fields.now === 'function' && typeof fields.moduleImporter === 'function', 'E_CONFIG');
  requireThat(fields.fs !== null && typeof fields.fs === 'object' && !isProxy(fields.fs), 'E_CONFIG');
  return { adapter: fields.fs, now: fields.now, importer: fields.moduleImporter,
    pins: deepFreeze({ raw: { ...HOST_RUNTIME_OPERATION_SOURCE_PINS.raw, helper: pinRecord(fields.helperPin) },
      linked: { ...HOST_RUNTIME_OPERATION_SOURCE_PINS.linked, helper: pinRecord(fields.linkedHelperPin) } }) };
}

async function run(mockOnly, capabilities) {
  let context = null;
  let timer = null;
  let helperStop = {};
  const pins = capabilities?.pins ?? HOST_RUNTIME_OPERATION_SOURCE_PINS;
  const envelope = () => ({ profile: PROFILE, mockOnly, evidenceScope: 'CANDIDATE_DATA_NOT_RUNTIME_ADMISSION',
    sourcePins: pins, sourceCounts: context ? { ...context.counts } : {
      fsOperations: 0, readAttempts: 0, requestedBytes: 0, returnedBytes: 0, capturedBytes: 0, allocatedBytes: 0,
      closeAttempts: 0, positiveCloses: 0, peakOwnedFds: 0, sourceReads: 0 },
    sourceAccountingComplete: context ? context.accountingComplete : true,
    sourceCloseFailed: context ? context.closeFailed : false,
    sourceIoAccountingUncertain: context ? context.ioUncertain : false, ...NEGATIVES });
  try {
    timer = clock(capabilities.now);
    requireThat(process.platform === 'linux' && process.arch === 'x64' &&
      ['O_NOFOLLOW', 'O_NONBLOCK'].every(key => Number.isSafeInteger(fs.constants[key]) &&
        fs.constants[key] > 0), 'E_CONFIG');
    context = sourceContext(capabilities.adapter, timer);
    const captured = {};
    for (const name of SOURCE_NAMES) captured[name] = context.capture(name, pins.raw[name]);
    const elfUri = uri(captured.elf4);
    const metadataUri = uri(captured.metadata);
    const stageUri = link(captured.staging, './elf-metadata.mjs', metadataUri, pins.linked.staging);
    const helperUri = link(captured.helper, './elf-requirements-v4.mjs', elfUri, pins.linked.helper);
    timer.guard(1000, 'E_PREFLIGHT');
    let staging;
    let helper;
    try {
      staging = await capabilities.importer(stageUri);
      timer.guard(1000, 'E_PREFLIGHT');
      helper = await capabilities.importer(helperUri);
    } catch (error) { throw error instanceof Stop ? error : new Stop('E_IMPORT'); }
    timer.guard(1000, 'E_PREFLIGHT');
    let receipt;
    try { receipt = parse(new TextDecoder('utf-8', { fatal: true }).decode(captured.receipt)); }
    catch { throw new Stop('E_CONSTANTS'); }
    const observer = constants(helper, staging, receipt);
    timer.guard(1000, 'E_PREFLIGHT');
    requireThat(11000 - timer.elapsed() >= 10000, 'E_PREFLIGHT');
    let observed;
    try { observed = observer(); }
    catch { throw new Stop('E_HELPER'); }
    timer.guard(11000, 'E_OUTER');
    const status = ownField(observed, 'status');
    if (status !== 'HOST_RUNTIME_CANDIDATES_OBSERVED') {
      helperStop = stopMetadata(observed, mockOnly);
      throw new Stop('E_HELPER_STOP', helperStop.role);
    }
    const result = validateObservation(ownSnapshot(observed, MAX_OUTPUT - 1).snapshot, mockOnly);
    timer.guard(11000, 'E_OUTER');
    const output = { ...envelope(), status: mockOnly ? 'MOCK_HOST_RUNTIME_CANDIDATES_OBSERVED' :
      'HOST_RUNTIME_CANDIDATES_OBSERVED', candidates: result.candidates, counts: result.counts,
    ioAccountingComplete: true, closeFailed: false, cleanupUncertain: false, cleanupOverrun: false };
    const text = publicText(output, () => timer.guard(11000, 'E_OUTER'));
    timer.guard(11000, 'E_OUTER');
    return freeze({ exitCode: 0, text });
  } catch (error) {
    if (context) {
      try { context.close(); } catch { error = new Stop('E_SOURCE_CLOSE'); }
    }
    const failure = error instanceof Stop ? error : new Stop('E_HELPER');
    const output = { ...envelope(), status: mockOnly ? 'MOCK_HOST_RUNTIME_PROVIDERS_STOP' :
      'HOST_RUNTIME_PROVIDERS_STOP', code: failure.code, role: failure.role, ...helperStop };
    return freeze({ exitCode: 1, text: publicText(output) });
  }
}

let productionUsed = false;

export async function runRegisteredHostRuntimeProviders() {
  if (arguments.length !== 0 || productionUsed) {
    const code = productionUsed ? 'E_ONESHOT' : 'E_ARGUMENTS';
    productionUsed = true;
    return freeze({ exitCode: 1, text: publicText({ profile: PROFILE, status: 'HOST_RUNTIME_PROVIDERS_STOP',
      mockOnly: false, code, role: null, ...NEGATIVES }) });
  }
  productionUsed = true;
  return run(false, { adapter: fs, now: performance.now.bind(performance), importer: value => import(value),
    pins: HOST_RUNTIME_OPERATION_SOURCE_PINS });
}

// WHAT: Trusted mock capabilities.
export async function runRegisteredHostRuntimeProvidersMock(config) {
  try {
    requireThat(arguments.length === 1, 'E_CONFIG');
    const capabilities = mockConfiguration(config);
    return run(true, capabilities);
  } catch {
    return freeze({ exitCode: 1, text: publicText({ profile: PROFILE, status: 'MOCK_HOST_RUNTIME_PROVIDERS_STOP',
      mockOnly: true, code: 'E_CONFIG', role: null, ...NEGATIVES }) });
  }
}
