// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { parseContainmentStatus, parseContainmentMembership, parseContainmentControllers,
  parseContainmentLimit, parseContainmentCpuMax } from './containment-metadata.mjs';

const ROOT = '/sys/fs/cgroup';
const SECURITY = Object.freeze(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink']);
const CONTROLLERS = Object.freeze(['memory', 'pids', 'cpu']);
const FILES = Object.freeze([
  ['controllers', 'cgroup.controllers', parseContainmentControllers],
  ['subtreeControl', 'cgroup.subtree_control', parseContainmentControllers],
  ['memoryMax', 'memory.max', parseContainmentLimit],
  ['pidsMax', 'pids.max', parseContainmentLimit],
  ['cpuMax', 'cpu.max', parseContainmentCpuMax],
]);
const EXPECTED = new Set(['ENOENT', 'EACCES', 'EPERM', 'EROFS']);
const ERRORS = new Set(['E_ARGUMENTS', 'E_MOCK_TCB', 'E_PID', 'E_FLAGS', 'E_BYTES', 'E_UTF8',
  'E_SYNTAX', 'E_PATH', 'E_DEPTH', 'E_SHADOW', 'E_SYMLINK', 'E_METADATA', 'E_IDENTITY',
  'E_IO', 'E_CLOSE', 'E_CLOCK', 'E_DEADLINE', 'E_LIMIT', 'E_LENGTH', 'E_MAPPING_DRIFT', 'E_OUTPUT']);
const TYPED = Object.getPrototypeOf(Uint8Array.prototype);
const LENGTH = Object.getOwnPropertyDescriptor(TYPED, 'length').get;
const BACKING = Object.getOwnPropertyDescriptor(TYPED, 'buffer').get;
const OFFSET = Object.getOwnPropertyDescriptor(TYPED, 'byteOffset').get;
const ARRAY_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const RESIZABLE = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const check = (condition, code) => { if (!condition) fail(code); };
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
export const OWN_CGROUP_LOCATOR_LIMITS = freeze({ directories: 32, procBytes: 65536, cgroupBytes: 4096,
  procReadChunk: 4096, cgroupReadChunk: 512, requestedReadBytes: 1048576, readAttempts: 512,
  openAttempts: 256, closeAttempts: 256, fsAttempts: 4096, clockReads: 16384,
  bodyBufferBytes: 65537, scratchBytes: 4096, peakOwnedFds: 1,
  workMilliseconds: 9000, totalMilliseconds: 10000, outputBytes: 65536 });

function own(object, key, code) {
  check(object && typeof object === 'object' && !types.isProxy(object), code);
  const field = Object.getOwnPropertyDescriptor(object, key);
  check(field && Object.hasOwn(field, 'value'), code);
  return field.value;
}
function errorCode(error, allowed, otherwise) {
  if (!error || typeof error !== 'object' || types.isProxy(error)) return otherwise;
  const field = Object.getOwnPropertyDescriptor(error, 'code');
  return field && Object.hasOwn(field, 'value') && allowed.has(field.value) ? field.value : otherwise;
}
function text(raw) {
  let bytes;
  if (typeof raw === 'string') {
    check(raw.length <= 65536, 'E_LENGTH');
    bytes = Buffer.from(raw, 'utf8');
    check(bytes.toString('utf8') === raw, 'E_UTF8');
  } else {
    check(raw && !types.isProxy(raw) && types.isUint8Array(raw) &&
      [Buffer.prototype, Uint8Array.prototype].includes(Object.getPrototypeOf(raw)), 'E_BYTES');
    for (const key of ['length', 'byteLength', 'buffer', 'byteOffset'])
      check(!Object.getOwnPropertyDescriptor(raw, key), 'E_BYTES');
    try {
      const backing = BACKING.call(raw), length = LENGTH.call(raw);
      ARRAY_LENGTH.call(backing);
      check(!RESIZABLE?.call(backing) && length <= 65536, 'E_BYTES');
      bytes = new Uint8Array(backing, OFFSET.call(raw), length);
    } catch { fail('E_BYTES'); }
  }
  check(bytes.length <= 65536, 'E_LENGTH');
  let value;
  try { value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { fail('E_UTF8'); }
  check(!/[\x00-\x08\x0b-\x1f\x7f-\x9f]/u.test(value), 'E_SYNTAX');
  return value;
}
function lines(raw) {
  const result = text(raw).split('\n');
  if (result.at(-1) === '') result.pop();
  return result;
}
function path(value) {
  check(typeof value === 'string' && value.startsWith('/') && Buffer.byteLength(value, 'utf8') <= 4096 &&
    !/[\x00-\x1f\x7f-\x9f\\]/u.test(value) && Buffer.from(value, 'utf8').toString('utf8') === value, 'E_PATH');
  check(value === '/' || value.slice(1).split('/').every(part => part !== '' && part !== '.' && part !== '..'), 'E_PATH');
  return value;
}
function unescape(value) {
  let result = '';
  const escapes = { '040': ' ', '011': '\t', '012': '\n', '134': '\\' };
  for (let index = 0; index < value.length; index++) {
    if (value[index] !== '\\') { result += value[index]; continue; }
    const code = value.slice(index + 1, index + 4);
    check(Object.hasOwn(escapes, code), 'E_SYNTAX');
    result += escapes[code]; index += 3;
  }
  return result;
}
function uint(value, positive = false) {
  check(/^(0|[1-9][0-9]{0,9})$/.test(value) && BigInt(value) <= 4294967295n &&
    (!positive || value !== '0'), 'E_SYNTAX');
  return value;
}
function options(value) {
  const tokens = value.split(',');
  check(tokens.every(token => token !== '' && !/[\s]/u.test(token)) &&
    new Set(tokens).size === tokens.length && Number(tokens.includes('ro')) + Number(tokens.includes('rw')) === 1, 'E_SYNTAX');
  for (const token of tokens) unescape(token);
  return tokens.includes('ro');
}
function mounts(raw) {
  const result = [], ids = new Set();
  for (const line of lines(raw)) {
    const fields = line.split(' '), separator = fields.indexOf('-');
    check(!line.includes('\t') && !fields.includes('') && separator >= 6 && fields.length === separator + 4, 'E_SYNTAX');
    const id = uint(fields[0], true), parent = uint(fields[1]);
    check(!ids.has(id), 'E_SYNTAX'); ids.add(id);
    const device = fields[2].split(':');
    check(device.length === 2, 'E_SYNTAX'); device.forEach(value => uint(value));
    const root = path(unescape(fields[3])), point = path(unescape(fields[4]));
    const readOnly = options(fields[5]), tags = new Set();
    for (const field of fields.slice(6, separator)) {
      check(/^[A-Za-z0-9_]+(?::[A-Za-z0-9_.-]+)?$/.test(field), 'E_SYNTAX');
      const tag = field.split(':')[0];
      check(!tags.has(tag), 'E_SYNTAX'); tags.add(tag);
      if (['shared', 'master', 'propagate_from'].includes(tag)) uint(field.slice(tag.length + 1), true);
      if (tag === 'unbindable') check(field === tag, 'E_SYNTAX');
    }
    const type = fields[separator + 1];
    check(/^[A-Za-z0-9_.-]+$/.test(type), 'E_SYNTAX');
    unescape(fields[separator + 2]);
    result.push({ id, parent, device: fields[2], root, point, type, readOnly,
      superReadOnly: options(fields[separator + 3]) });
  }
  check(result.length > 0, 'E_SYNTAX');
  return result;
}
function membership(raw) {
  parseContainmentMembership(raw);
  let unified = null;
  for (const line of lines(raw)) {
    const first = line.indexOf(':'), second = line.indexOf(':', first + 1);
    const member = path(line.slice(second + 1));
    if (line.slice(0, first) === '0') {
      check(unified === null, 'E_SYNTAX'); unified = member;
    }
  }
  return unified;
}
const beneath = (parent, child) => parent === child || (parent === '/' ? child.startsWith('/') : child.startsWith(parent + '/'));
function mapping(mount, member) {
  if (!mount || !member) return { state: 'UNAVAILABLE', directories: [], signature: JSON.stringify({ mount, member }) };
  const exact = mount.filter(entry => entry.point === ROOT);
  const selected = exact.length === 1 && exact[0].type === 'cgroup2' ? exact[0] : null;
  if (!selected) return { state: 'UNAVAILABLE', directories: [], signature: JSON.stringify({ exact, member }) };
  if (!beneath(selected.root, member))
    return { state: 'UNMAPPABLE', directories: [], signature: JSON.stringify({ selected, member }) };
  const suffix = member === selected.root ? '' : selected.root === '/' ? member : member.slice(selected.root.length);
  const leaf = path(ROOT + suffix), directories = [];
  let directory = leaf;
  while (true) {
    check(directories.length < 32, 'E_DEPTH'); directories.push(directory);
    if (directory === ROOT) break;
    directory = directory.slice(0, directory.lastIndexOf('/'));
    check(beneath(ROOT, directory), 'E_PATH');
  }
  const byId = new Map(mount.map(entry => [entry.id, entry])), ancestors = new Set([selected.id]);
  let parent = selected.parent;
  while (byId.has(parent)) {
    check(!ancestors.has(parent), 'E_SYNTAX'); ancestors.add(parent);
    const entry = byId.get(parent);
    if (entry.parent === parent && entry.point === '/') break;
    parent = entry.parent;
  }
  const enclosing = mount.filter(entry => entry !== selected && beneath(entry.point, ROOT));
  const shadows = mount.filter(entry => entry !== selected &&
    ((beneath(entry.point, ROOT) && !ancestors.has(entry.id)) || (beneath(ROOT, entry.point) &&
      (beneath(entry.point, leaf) || beneath(leaf, entry.point) ||
        directories.some(dir => FILES.some(([, name]) => beneath(entry.point, dir + '/' + name)))))));
  check(shadows.length === 0, 'E_SHADOW');
  return { state: 'MAPPED', selected, leaf, directories,
    signature: JSON.stringify({ selected, member,
      enclosing: enclosing.sort((left, right) => left.id < right.id ? -1 : left.id === right.id ? 0 : 1), shadows }) };
}
function metadata(raw) {
  const result = {};
  for (const key of SECURITY) {
    const value = own(raw, key, 'E_METADATA');
    check(typeof value === 'bigint' && value >= 0n && value <= 18446744073709551615n, 'E_METADATA');
    result[key] = value.toString();
  }
  check(BigInt(result.mode) <= 4294967295n, 'E_METADATA');
  return result;
}
const same = (left, right) => SECURITY.every(key => left[key] === right[key]);
const observed = value => ({ status: 'OBSERVED', value });
const unavailable = reason => ({ status: 'UNAVAILABLE', reason });
const get = record => record?.status === 'OBSERVED' ? record.value : null;
function api(raw) {
  const result = {};
  for (const key of ['lstatSync', 'accessSync', 'openSync', 'fstatSync', 'readSync', 'closeSync']) {
    const method = own(raw, key, 'E_MOCK_TCB');
    check(typeof method === 'function' && !types.isProxy(method), 'E_MOCK_TCB');
    result[key] = method.bind(raw);
  }
  const constants = own(raw, 'constants', 'E_FLAGS'), values = {};
  for (const key of ['O_RDONLY', 'O_NOFOLLOW', 'O_NONBLOCK', 'W_OK']) values[key] = own(constants, key, 'E_FLAGS');
  check(values.O_RDONLY === 0 && values.W_OK === 2 &&
    [values.O_NOFOLLOW, values.O_NONBLOCK].every(value => Number.isSafeInteger(value) && value > 0 &&
      value <= 0x40000000 && (value & (value - 1)) === 0 && (value & 3) === 0) &&
    (values.O_NOFOLLOW & values.O_NONBLOCK) === 0, 'E_FLAGS');
  result.flags = values.O_RDONLY | values.O_NOFOLLOW | values.O_NONBLOCK;
  result.writeAccess = values.W_OK;
  return result;
}
function observe(configuration, mockOnly, argumentCount) {
  const counts = { clockReadAttempts: 0, clockReads: 0, fsOperationAttempts: 0, fsOperationsCompleted: 0,
    openAttempts: 0, opensCompleted: 0, readAttempts: 0, readsCompleted: 0, requestedReadBytes: 0,
    returnedReadBytes: 0, acceptedReadBytes: 0, closeAttempts: 0, closesCompleted: 0, peakOwnedFds: 0,
    directoryAccessAttempts: 0, checkedFiles: 0 };
  let io, now, started, last, fd = null, body, scratch, error = null, accountingComplete = false;
  let state = 'UNAVAILABLE', ancestry = [], candidate = null, processStatus = unavailable('NOT_OBSERVED');
  let snapshotAgreement = false;
  function clock(milliseconds = 9000) {
    check(counts.clockReadAttempts < 16384, 'E_LIMIT'); counts.clockReadAttempts++;
    let value;
    try { value = now(); } catch { fail('E_CLOCK'); }
    counts.clockReads++;
    check(typeof value === 'bigint' && value >= 0n && (last === undefined || value >= last), 'E_CLOCK');
    if (started === undefined) started = value;
    last = value;
    check(value - started < BigInt(milliseconds) * 1000000n, 'E_DEADLINE');
  }
  function close() {
    if (fd === null) return;
    const owned = fd; fd = null;
    counts.closeAttempts++; counts.fsOperationAttempts++;
    try { io.closeSync(owned); counts.closesCompleted++; counts.fsOperationsCompleted++; }
    catch { fail('E_CLOSE'); }
  }
  function call(name, ...args) {
    clock();
    check(counts.fsOperationAttempts < 4095, 'E_LIMIT');
    if (name === 'openSync') { check(counts.openAttempts < 256 && fd === null, 'E_LIMIT'); counts.openAttempts++; }
    if (name === 'readSync') {
      check(counts.readAttempts < 512 && args[3] <= 1048576 - counts.requestedReadBytes, 'E_LIMIT');
      counts.readAttempts++; counts.requestedReadBytes += args[3];
    }
    if (name === 'accessSync') counts.directoryAccessAttempts++;
    counts.fsOperationAttempts++;
    const result = io[name](...args); counts.fsOperationsCompleted++;
    if (name === 'readSync') counts.readsCompleted++;
    return result;
  }
  function readFile(file, maximum, chunk, parser) {
    let failure = null, value;
    try {
      const before = metadata(call('lstatSync', file, { bigint: true }));
      check((BigInt(before.mode) & 0o170000n) === 0o100000n, 'E_METADATA');
      const opened = call('openSync', file, io.flags);
      check(Number.isSafeInteger(opened) && opened >= 0, 'E_IO');
      fd = opened; counts.opensCompleted++; counts.peakOwnedFds = 1;
      const descriptor = metadata(call('fstatSync', fd, { bigint: true }));
      check(same(before, descriptor), 'E_IDENTITY');
      let length = 0;
      while (true) {
        const request = Math.min(chunk, maximum + 1 - length);
        check(request > 0, 'E_LENGTH');
        const returned = call('readSync', fd, scratch, 0, request, null);
        check(Number.isSafeInteger(returned) && returned >= 0 && returned <= request, 'E_IO');
        counts.returnedReadBytes += returned;
        check(length + returned <= maximum, 'E_LENGTH');
        if (returned === 0) break;
        body.set(scratch.subarray(0, returned), length); length += returned; counts.acceptedReadBytes += returned;
      }
      const after = metadata(call('fstatSync', fd, { bigint: true }));
      const namedAfter = metadata(call('lstatSync', file, { bigint: true }));
      check(same(before, after) && same(before, namedAfter), 'E_IDENTITY');
      value = parser(body.subarray(0, length)); clock();
    } catch (caught) { failure = caught; }
    finally { try { close(); } catch (caught) { failure = caught; } }
    if (failure && errorCode(failure, ERRORS, null) === 'E_CLOSE') throw failure;
    clock();
    if (failure) {
      const code = errorCode(failure, EXPECTED, null);
      if (code) return unavailable(code);
      throw failure;
    }
    counts.checkedFiles++;
    return observed(value);
  }
  function directory(file) {
    try {
      const value = metadata(call('lstatSync', file, { bigint: true }));
      const type = BigInt(value.mode) & 0o170000n;
      check(type !== 0o120000n, 'E_SYMLINK');
      check(type === 0o040000n, 'E_METADATA');
      return observed(value);
    } catch (caught) {
      const code = errorCode(caught, EXPECTED, null);
      if (code) return unavailable(code);
      throw caught;
    }
  }
  function stable(before, after) {
    check(before.status === after.status, 'E_IDENTITY');
    if (before.status === 'OBSERVED') check(same(before.value, after.value), 'E_IDENTITY');
    else check(before.reason === after.reason, 'E_IDENTITY');
  }
  try {
    check(argumentCount === (mockOnly ? 1 : 0), 'E_ARGUMENTS');
    now = own(configuration, 'now', 'E_MOCK_TCB');
    check(typeof now === 'function' && !types.isProxy(now), 'E_MOCK_TCB'); clock();
    const pid = mockOnly ? own(configuration, 'pid', 'E_PID') : own(own(configuration, 'pidSource', 'E_PID'), 'pid', 'E_PID');
    check(Number.isInteger(pid) && pid > 0 && pid <= 4294967295, 'E_PID'); clock();
    io = api(own(configuration, 'fs', 'E_MOCK_TCB'));
    body = Buffer.alloc(65537); scratch = Buffer.alloc(4096);
    const proc = `/proc/${pid}`;
    const initialMount = readFile(proc + '/mountinfo', 65536, 4096, mounts);
    const initialMember = readFile(proc + '/cgroup', 65536, 4096, membership);
    processStatus = readFile(proc + '/status', 65536, 4096, parseContainmentStatus);
    const initial = mapping(get(initialMount), get(initialMember)); state = initial.state;
    const prefixes = new Map();
    if (state === 'MAPPED') {
      const parts = initial.leaf.slice(1).split('/');
      let prefix = '', blocked = null;
      for (const part of ['', ...parts]) {
        prefix = part === '' ? '/' : prefix === '/' ? '/' + part : prefix + '/' + part;
        const record = blocked ? unavailable(blocked) : directory(prefix);
        prefixes.set(prefix, record);
        if (record.status === 'UNAVAILABLE') blocked = record.reason;
      }
      const rootBaseline = prefixes.get(ROOT);
      for (let depth = 0; depth < initial.directories.length; depth++) {
        const dir = initial.directories[depth], prefixRecord = prefixes.get(dir);
        const record = { hash: createHash('sha256').update(dir, 'utf8').digest('hex'), depth,
          metadata: prefixRecord, writeAccess: unavailable('PREFIX_UNAVAILABLE'), fields: {} };
        if (prefixRecord.status === 'OBSERVED') {
          const rootBefore = directory(ROOT); stable(rootBaseline, rootBefore);
          const before = directory(dir); stable(prefixRecord, before); record.metadata = before;
          try { call('accessSync', dir, io.writeAccess); record.writeAccess = observed(true); }
          catch (caught) {
            const code = errorCode(caught, EXPECTED, null); if (!code) throw caught;
            record.writeAccess = unavailable(code);
          }
          for (const [key, name, parser] of FILES) record.fields[key] = readFile(dir + '/' + name, 4096, 512, parser);
          stable(before, directory(dir)); stable(rootBefore, directory(ROOT));
        } else {
          for (const [key] of FILES) record.fields[key] = unavailable('PREFIX_UNAVAILABLE');
        }
        const hierarchyRoot = dir === ROOT && initial.selected.root === '/';
        const completeLimits = ['memoryMax', 'pidsMax', 'cpuMax'].every(key =>
          record.fields[key].status === 'OBSERVED' || (hierarchyRoot && record.fields[key].reason === 'ENOENT'));
        const metadataComplete = prefixRecord.status === 'OBSERVED' && completeLimits &&
          ['controllers', 'subtreeControl'].every(key => record.fields[key].status === 'OBSERVED');
        const qualifies = !initial.selected.readOnly && !initial.selected.superReadOnly &&
          get(record.writeAccess) === true && metadataComplete && processStatus.status === 'OBSERVED' &&
          CONTROLLERS.every(key => get(record.fields.controllers)?.[key] === true && get(record.fields.subtreeControl)?.[key] === true);
        if (!candidate && qualifies) candidate = { directory: dir, interpretation: 'DATA_NOT_PERMISSION' };
        ancestry.push(record);
      }
      for (const [prefix, before] of prefixes) {
        if (before.status === 'OBSERVED') stable(before, directory(prefix));
      }
    }
    const finalMount = readFile(proc + '/mountinfo', 65536, 4096, mounts);
    const finalMember = readFile(proc + '/cgroup', 65536, 4096, membership);
    const final = mapping(get(finalMount), get(finalMember));
    check(initialMount.status === finalMount.status && initialMount.reason === finalMount.reason &&
      initialMember.status === finalMember.status && initialMember.reason === finalMember.reason &&
      initial.state === final.state && initial.signature === final.signature, 'E_MAPPING_DRIFT');
    snapshotAgreement = initialMount.status === 'OBSERVED' && initialMember.status === 'OBSERVED';
    clock(); accountingComplete = true;
  } catch (caught) { error = errorCode(caught, ERRORS, 'E_IO'); }
  finally {
    try { close(); } catch { error = 'E_CLOSE'; }
    if (started !== undefined) {
      try { clock(10000); } catch (caught) { if (error !== 'E_CLOSE') error = errorCode(caught, ERRORS, 'E_CLOCK'); }
    }
  }
  if (error) { candidate = null; ancestry = null; processStatus = null; state = 'UNAVAILABLE'; accountingComplete = false; snapshotAgreement = false; }
  const output = { profile: mockOnly ? 'own-cgroup-locator-MOCK-v1' : 'own-cgroup-locator-v1', mockOnly,
    status: error ? 'STOP' : 'OWN_CGROUP_METADATA_OBSERVED', error, mapping: state, candidate,
    delegationCandidate: candidate !== null && !error,
    ancestry, processStatus, accountingComplete, snapshotAgreement, counts,
    scope: 'DATA_NOT_PERMISSION', hashScope: 'UNSALTED_PATH_SHA256_NOT_GUARANTEED_ANONYMITY',
    snapshotAgreementScope: 'INITIAL_FINAL_MAPPING_AND_UNIFIED_MEMBERSHIP_ONLY',
    metadataScope: 'POINT_IN_TIME_KERNEL_RECORDS_NOT_ATOMIC_SNAPSHOT',
    counterScope: 'LOGICAL_NODE_ATTEMPTS_NOT_KERNEL_SYSCALL_PROOF', unsupportedContext: false,
    rootProfileOnly: false, ownAncestryOnly: true, continuousStabilityProven: false, atomicSnapshotGuaranteed: false,
    hardDeadlineGuaranteed: false, ancestorProtectionProven: false, childCgroupManagementProven: false,
    capacityProven: false, containmentEstablished: false, nativeQualified: false, rustReady: false,
    trainingReady: false, train: false };
  const serialized = asciiJSON(output);
  if (Buffer.byteLength(serialized) > 65536) {
    output.status = 'STOP'; output.error = 'E_OUTPUT'; output.mapping = 'UNAVAILABLE'; output.candidate = null;
    output.delegationCandidate = false;
    output.ancestry = null; output.processStatus = null; output.accountingComplete = false; output.snapshotAgreement = false;
  }
  if (started !== undefined) {
    try { clock(10000); }
    catch (caught) {
      output.status = 'STOP'; output.error = error === 'E_CLOSE' ? error : errorCode(caught, ERRORS, 'E_CLOCK');
      output.mapping = 'UNAVAILABLE'; output.candidate = null; output.ancestry = null; output.processStatus = null;
      output.delegationCandidate = false;
      output.accountingComplete = false; output.snapshotAgreement = false;
    }
  }
  if (Buffer.byteLength(asciiJSON(output)) > 65536) {
    output.status = 'STOP'; output.error = 'E_OUTPUT'; output.mapping = 'UNAVAILABLE'; output.candidate = null;
    output.delegationCandidate = false;
    output.ancestry = null; output.processStatus = null; output.accountingComplete = false; output.snapshotAgreement = false;
  }
  return freeze(output);
}
function asciiJSON(value) {
  return JSON.stringify(value).replace(/[^\x20-\x7e]/gu, character => {
    let result = '';
    for (let index = 0; index < character.length; index++) result += '\\u' + character.charCodeAt(index).toString(16).padStart(4, '0');
    return result;
  });
}

// WHAT: Zero-argument own-process ancestry metadata, without enforcement or target lookup.
export function observeOwnCgroupAncestry() {
  return observe({ fs, now: () => process.hrtime.bigint(), pidSource: process }, false, arguments.length);
}

// WHAT: Complete synthetic dependencies; never production observation.
export function observeOwnCgroupAncestryMock(configuration) {
  return observe(configuration, true, arguments.length);
}
