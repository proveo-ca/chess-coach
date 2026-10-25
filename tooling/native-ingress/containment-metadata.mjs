// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { types } from 'node:util';

const ROOT = '/sys/fs/cgroup';
const SECURITY = Object.freeze(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink']);
const CONTROLLERS = Object.freeze(['memory', 'pids', 'cpu']);
const CAPABILITIES = Object.freeze({ CAP_SYS_ADMIN: 21, CAP_SYS_RESOURCE: 24,
  CAP_SYS_PTRACE: 19, CAP_DAC_OVERRIDE: 1, CAP_NET_ADMIN: 12 });
const EXPECTED = new Set(['ENOENT', 'EACCES', 'EPERM', 'EROFS']);
const ERRORS = new Set(['E_ARGUMENTS', 'E_BYTES', 'E_UTF8', 'E_SYNTAX', 'E_PID', 'E_MOCK_TCB',
  'E_FLAGS', 'E_METADATA', 'E_IDENTITY', 'E_IO', 'E_CLOSE', 'E_CLOCK', 'E_DEADLINE', 'E_LIMIT', 'E_LENGTH', 'E_OUTPUT']);
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
export const CONTAINMENT_METADATA_LIMITS = freeze({ procBytes: 65536, sysBytes: 4096,
  requestedReadBytes: 245760, readAttempts: 256, perFileReadAttempts: 64, fsOperations: 1024,
  opens: 8, closeAttempts: 8, peakOwnedFds: 1, bodyBufferBytes: 65537, scratchBytes: 4096,
  workMilliseconds: 4000, totalMilliseconds: 5000, clockReads: 4096, outputBytes: 16384 });

function own(object, key, code) {
  check(object !== null && typeof object === 'object' && !types.isProxy(object), code);
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  check(descriptor && Object.hasOwn(descriptor, 'value'), code);
  return descriptor.value;
}

function errorCode(error, allowed, otherwise) {
  if (!error || typeof error !== 'object' || types.isProxy(error)) return otherwise;
  const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
  return descriptor && Object.hasOwn(descriptor, 'value') && allowed.has(descriptor.value) ? descriptor.value : otherwise;
}

function text(raw, maximum) {
  let bytes;
  if (typeof raw === 'string') {
    check(raw.length <= maximum, 'E_LENGTH');
    bytes = Buffer.from(raw, 'utf8');
    check(bytes.toString('utf8') === raw, 'E_UTF8');
  } else {
    check(raw && !types.isProxy(raw) && types.isUint8Array(raw), 'E_BYTES');
    check([Buffer.prototype, Uint8Array.prototype].includes(Object.getPrototypeOf(raw)), 'E_BYTES');
    for (const key of ['length', 'byteLength', 'buffer', 'byteOffset']) {
      check(!Object.getOwnPropertyDescriptor(raw, key), 'E_BYTES');
    }
    try {
      const backing = BACKING.call(raw), length = LENGTH.call(raw);
      ARRAY_LENGTH.call(backing);
      check(!RESIZABLE?.call(backing) && length <= maximum, 'E_BYTES');
      bytes = new Uint8Array(backing, OFFSET.call(raw), length);
    } catch { fail('E_BYTES'); }
  }
  check(bytes.length <= maximum, 'E_LENGTH');
  let value;
  try { value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { fail('E_UTF8'); }
  check(!/[\x00-\x08\x0b-\x1f\x7f-\x9f]/u.test(value), 'E_SYNTAX');
  return value;
}

function lines(value) {
  const result = value.split('\n');
  if (result.at(-1) === '') result.pop();
  return result;
}

function decimal(value, positive = false, maximum = 18446744073709551615n) {
  check(/^(0|[1-9][0-9]{0,19})$/.test(value), 'E_SYNTAX');
  const number = BigInt(value);
  check(number <= maximum && (!positive || number > 0n), 'E_SYNTAX');
  return value;
}

function mountPath(value) {
  check(value.length > 0, 'E_SYNTAX');
  let decoded = '';
  const escapes = { '040': ' ', '011': '\t', '012': '\n', '134': '\\' };
  for (let index = 0; index < value.length; index++) {
    if (value[index] !== '\\') { decoded += value[index]; continue; }
    const code = value.slice(index + 1, index + 4);
    check(Object.hasOwn(escapes, code), 'E_SYNTAX');
    decoded += escapes[code]; index += 3;
  }
  return decoded;
}

function readOnly(value) {
  const tokens = value.split(',');
  check(tokens.every(token => token.length > 0 && !/[ \t\n]/.test(token)), 'E_SYNTAX');
  for (const token of tokens) mountPath(token);
  check(new Set(tokens).size === tokens.length, 'E_SYNTAX');
  check(Number(tokens.includes('ro')) + Number(tokens.includes('rw')) === 1, 'E_SYNTAX');
  return tokens.includes('ro');
}

export function parseContainmentMountinfo(raw) {
  let entryCount = 0, selected = null;
  const entries = lines(text(raw, 65536));
  check(entries.length > 0, 'E_SYNTAX');
  for (const line of entries) {
    check(!line.includes('\t'), 'E_SYNTAX');
    const fields = line.split(' '), separator = fields.indexOf('-');
    check(!fields.includes('') && separator >= 6 &&
      fields.length === separator + 4, 'E_SYNTAX');
    decimal(fields[0], true, 4294967295n); decimal(fields[1], false, 4294967295n);
    const device = fields[2].split(':');
    check(device.length === 2, 'E_SYNTAX');
    for (const part of device) decimal(part, false, 4294967295n);
    const root = mountPath(fields[3]), point = mountPath(fields[4]);
    check(root.startsWith('/') && point.startsWith('/'), 'E_SYNTAX');
    const mountReadOnly = readOnly(fields[5]), optional = new Set();
    for (const field of fields.slice(6, separator)) {
      check(/^[A-Za-z0-9_]+(?::[A-Za-z0-9_.-]+)?$/.test(field), 'E_SYNTAX');
      const tag = field.split(':')[0]; check(!optional.has(tag), 'E_SYNTAX'); optional.add(tag);
      if (['shared', 'master', 'propagate_from'].includes(tag)) decimal(field.slice(tag.length + 1), true, 4294967295n);
      if (tag === 'unbindable') check(field === tag, 'E_SYNTAX');
    }
    const fsType = fields[separator + 1];
    check(/^[A-Za-z0-9_.-]+$/.test(fsType), 'E_SYNTAX');
    mountPath(fields[separator + 2]);
    const superblockReadOnly = readOnly(fields[separator + 3]);
    if (point === ROOT) {
      entryCount++;
      selected = fsType === 'cgroup2' ? { mountpoint: ROOT, fsType: 'cgroup2', mountReadOnly, superblockReadOnly } : null;
    }
  }
  return freeze({ exactMatchCount: entryCount, ambiguous: entryCount > 1, record: entryCount === 1 ? selected : null });
}

export function parseContainmentStatus(raw) {
  const selected = {};
  for (const line of lines(text(raw, 65536))) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon);
    if (!['NoNewPrivs', 'Seccomp', 'CapEff'].includes(key)) continue;
    check(!Object.hasOwn(selected, key), 'E_SYNTAX');
    selected[key] = line.slice(colon + 1).replace(/^[ \t]+|[ \t]+$/g, '');
  }
  check(Object.keys(selected).length === 3 && /^[01]$/.test(selected.NoNewPrivs) &&
    /^[012]$/.test(selected.Seccomp) && /^[0-9a-fA-F]{1,16}$/.test(selected.CapEff), 'E_SYNTAX');
  const bits = BigInt('0x' + selected.CapEff), capabilities = {};
  for (const [key, bit] of Object.entries(CAPABILITIES)) capabilities[key] = (bits & (1n << BigInt(bit))) !== 0n;
  return freeze({ noNewPrivs: Number(selected.NoNewPrivs), seccomp: Number(selected.Seccomp), capabilities });
}

export function parseContainmentMembership(raw) {
  let entryCount = 0, unifiedEntryPresent = false;
  const controllerEntryCounts = { memory: 0, pids: 0, cpu: 0 }, hierarchies = new Set();
  for (const line of lines(text(raw, 65536))) {
    const first = line.indexOf(':'), second = line.indexOf(':', first + 1);
    check(first > 0 && second > first && line.slice(second + 1).startsWith('/'), 'E_SYNTAX');
    const id = decimal(line.slice(0, first), false, 4294967295n);
    check(!hierarchies.has(id), 'E_SYNTAX'); hierarchies.add(id);
    const list = line.slice(first + 1, second);
    if (id === '0') { check(list === '', 'E_SYNTAX'); unifiedEntryPresent = true; }
    else {
      const tokens = list.split(',');
      check(tokens.every(token => /^(?:[A-Za-z0-9_][A-Za-z0-9_.-]*|name=[A-Za-z0-9_.-]+)$/.test(token)) &&
        new Set(tokens).size === tokens.length, 'E_SYNTAX');
      for (const name of CONTROLLERS) if (tokens.includes(name)) controllerEntryCounts[name]++;
    }
    entryCount++;
  }
  check(entryCount > 0, 'E_SYNTAX');
  return freeze({ entryCount, unifiedEntryPresent, controllerEntryCounts });
}

export function parseContainmentControllers(raw) {
  const value = text(raw, 4096).trim(), tokens = value === '' ? [] : value.split(/[ \t\n]+/);
  check(tokens.every(token => /^[a-z][a-z0-9_]*$/.test(token)) && new Set(tokens).size === tokens.length, 'E_SYNTAX');
  const result = {};
  for (const key of CONTROLLERS) result[key] = tokens.includes(key);
  return freeze({ ...result, unknownTokenCount: tokens.filter(token => !CONTROLLERS.includes(token)).length });
}

export function parseContainmentLimit(raw) {
  const value = text(raw, 4096).replace(/\n$/, '');
  return value === 'max' ? 'max' : decimal(value);
}

export function parseContainmentCpuMax(raw) {
  const value = text(raw, 4096).replace(/\n$/, ''), fields = value.split(/[ \t]+/);
  check(fields.length === 2, 'E_SYNTAX');
  return freeze({ quota: fields[0] === 'max' ? 'max' : decimal(fields[0]), period: decimal(fields[1], true) });
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
const unavailable = reason => ({ status: 'UNAVAILABLE', reason });
const observed = value => ({ status: 'OBSERVED', value });

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
    rootLstatAttempts: 0, rootAccessAttempts: 0, openAttempts: 0, opensCompleted: 0,
    readAttempts: 0, readsCompleted: 0, requestedReadBytes: 0, returnedReadBytes: 0, acceptedReadBytes: 0,
    closeAttempts: 0, closesCompleted: 0, peakOwnedFds: 0, checkedFiles: 0 };
  let io, now, started, last, body, scratch, fd = null, observations = {}, error = null, context = 'INITIALIZATION';
  let accountingComplete = false;
  const close = () => {
    if (fd === null) return;
    const owned = fd; fd = null;
    counts.closeAttempts++; counts.fsOperationAttempts++;
    try { io.closeSync(owned); counts.closesCompleted++; counts.fsOperationsCompleted++; }
    catch { fail('E_CLOSE'); }
  };
  function clock(limit = 4000) {
    if (++counts.clockReadAttempts > 4096) fail('E_LIMIT');
    let value;
    try { value = now(); } catch { fail('E_CLOCK'); }
    counts.clockReads++;
    check(typeof value === 'bigint' && value >= 0n && (last === undefined || value >= last), 'E_CLOCK');
    if (started === undefined) started = value;
    last = value;
    check(value - started < BigInt(limit) * 1000000n, 'E_DEADLINE');
  }
  function call(name, ...args) {
    clock();
    check(counts.fsOperationAttempts < 1023, 'E_LIMIT');
    counts.fsOperationAttempts++;
    if (name === 'lstatSync' && args[0] === ROOT) counts.rootLstatAttempts++;
    if (name === 'accessSync') counts.rootAccessAttempts++;
    if (name === 'openSync') counts.openAttempts++;
    if (name === 'readSync') { counts.readAttempts++; counts.requestedReadBytes += args[3]; }
    const result = io[name](...args);
    counts.fsOperationsCompleted++;
    if (name === 'readSync') counts.readsCompleted++;
    return result;
  }
  function readFile(path, maximum, parser) {
    let failure = null, value;
    try {
      const namedBefore = metadata(call('lstatSync', path, { bigint: true }));
      check((BigInt(namedBefore.mode) & 0o170000n) === 0o100000n, 'E_METADATA');
      clock(); check(counts.openAttempts < 8 && fd === null, 'E_LIMIT');
      const opened = call('openSync', path, io.flags);
      check(Number.isSafeInteger(opened) && opened >= 0, 'E_IO');
      fd = opened; counts.opensCompleted++; counts.peakOwnedFds = 1;
      const descriptorBefore = metadata(call('fstatSync', fd, { bigint: true }));
      check(same(namedBefore, descriptorBefore), 'E_IDENTITY');
      let length = 0, attempts = 0;
      while (true) {
        clock();
        check(attempts < 64 && counts.readAttempts < 256, 'E_LIMIT');
        const request = Math.min(4096, maximum + 1 - length);
        check(request > 0 && request <= 245760 - counts.requestedReadBytes, 'E_LIMIT');
        attempts++;
        const returned = call('readSync', fd, scratch, 0, request, null);
        check(Number.isSafeInteger(returned) && returned >= 0 && returned <= request, 'E_IO');
        counts.returnedReadBytes += returned;
        check(length + returned <= maximum, 'E_LENGTH');
        if (returned === 0) break;
        body.set(scratch.subarray(0, returned), length);
        length += returned; counts.acceptedReadBytes += returned;
      }
      const descriptorAfter = metadata(call('fstatSync', fd, { bigint: true }));
      const namedAfter = metadata(call('lstatSync', path, { bigint: true }));
      check(same(namedBefore, namedAfter) && same(namedBefore, descriptorAfter), 'E_IDENTITY');
      value = parser(body.subarray(0, length));
      clock();
    } catch (caught) { failure = caught; }
    finally {
      try { close(); } catch (caught) { failure = caught; }
    }
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
  try {
    check(argumentCount === (mockOnly ? 1 : 0), 'E_ARGUMENTS');
    now = own(configuration, 'now', 'E_MOCK_TCB');
    check(typeof now === 'function' && !types.isProxy(now), 'E_MOCK_TCB');
    clock();
    const pid = mockOnly ? own(configuration, 'pid', 'E_PID') :
      own(own(configuration, 'pidSource', 'E_PID'), 'pid', 'E_PID');
    check(Number.isInteger(pid) && pid > 0 && pid <= 4294967295, 'E_PID');
    clock();
    io = api(own(configuration, 'fs', 'E_MOCK_TCB'));
    body = Buffer.alloc(65537); scratch = Buffer.alloc(4096);
    const resources = [
      ['mountinfo', `/proc/${pid}/mountinfo`, 65536, parseContainmentMountinfo],
      ['status', `/proc/${pid}/status`, 65536, parseContainmentStatus],
      ['membership', `/proc/${pid}/cgroup`, 65536, parseContainmentMembership],
      ['controllers', ROOT + '/cgroup.controllers', 4096, parseContainmentControllers],
      ['subtreeControl', ROOT + '/cgroup.subtree_control', 4096, parseContainmentControllers],
      ['memoryMax', ROOT + '/memory.max', 4096, parseContainmentLimit],
      ['pidsMax', ROOT + '/pids.max', 4096, parseContainmentLimit],
      ['cpuMax', ROOT + '/cpu.max', 4096, parseContainmentCpuMax],
    ];
    context = 'ROOT_METADATA';
    try {
      const root = metadata(call('lstatSync', ROOT, { bigint: true }));
      observations.root = (BigInt(root.mode) & 0o170000n) === 0o040000n ? observed(root) : unavailable('NOT_REAL_DIRECTORY');
    } catch (caught) {
      const code = errorCode(caught, EXPECTED, null); if (!code) throw caught;
      observations.root = unavailable(code);
    }
    context = 'ROOT_WRITE_ACCESS';
    try { call('accessSync', ROOT, io.writeAccess); observations.rootWriteAccess = observed(true); }
    catch (caught) {
      const code = errorCode(caught, EXPECTED, null); if (!code) throw caught;
      observations.rootWriteAccess = unavailable(code);
    }
    for (const [key, path, maximum, parser] of resources) {
      context = key; observations[key] = readFile(path, maximum, parser);
    }
    clock();
    accountingComplete = true;
  } catch (caught) { error = errorCode(caught, ERRORS, 'E_IO'); }
  finally {
    try { close(); } catch { error = 'E_CLOSE'; }
    if (started !== undefined) {
      try { clock(5000); } catch (caught) { if (error !== 'E_CLOSE') error = errorCode(caught, ERRORS, 'E_CLOCK'); }
    }
  }
  if (error) { observations = null; accountingComplete = false; }
  const blockers = [];
  if (!error) {
    const get = key => observations[key]?.status === 'OBSERVED' ? observations[key].value : null;
    const mount = get('mountinfo');
    if (!mount || mount.ambiguous || !mount.record) blockers.push('CGROUP_MOUNT_UNAVAILABLE');
    else if (mount.record.mountReadOnly || mount.record.superblockReadOnly) blockers.push('CGROUP_MOUNT_READ_ONLY');
    if (!get('root') || get('rootWriteAccess') !== true) blockers.push('CGROUP_WRITE_ACCESS_UNAVAILABLE');
    if (!CONTROLLERS.every(key => get('controllers')?.[key] === true)) blockers.push('CGROUP_CONTROLLERS_UNAVAILABLE');
    if (!CONTROLLERS.every(key => get('subtreeControl')?.[key] === true)) blockers.push('CGROUP_CONTROLLERS_NOT_ENABLED');
    if (Object.values(observations).some(value => value.status !== 'OBSERVED')) blockers.push('CGROUP_OBSERVATION_UNAVAILABLE');
  }
  const output = { profile: mockOnly ? 'containment-metadata-MOCK-v1' : 'containment-metadata-root-v1',
    status: error ? 'STOP' : mockOnly ? 'MOCK_CONTAINMENT_METADATA_OBSERVED' : 'CONTAINMENT_METADATA_OBSERVED',
    mockOnly, scope: 'CONTAINMENT_METADATA_NOT_ENFORCEMENT_PROOF', error,
    failureContext: error ? context : null, accountingComplete, counts, observations, blockers,
    delegationCandidate: !error && blockers.length === 0, unsupportedContext: false,
    rootProfileOnly: true, childCgroupManagementProven: false, atomicSnapshotGuaranteed: false,
    ancestorProtectionProven: false, hardDeadlineGuaranteed: false,
    counterScope: 'logical Node attempts/completions; requested, returned and accepted read bytes are distinct',
    nativeQualified: false, rustReady: false, trainingReady: false, containmentEstablished: false };
  const serialized = JSON.stringify(output);
  if (!/^[\x20-\x7e]*$/.test(serialized) || Buffer.byteLength(serialized) > 16384) {
    output.status = 'STOP'; output.error = 'E_OUTPUT'; output.observations = null;
    output.delegationCandidate = false; output.accountingComplete = false;
  }
  return freeze(output);
}

// WHAT: Fixed own-process and cgroup-root metadata observation without enforcement.
export function observeContainmentMetadata() {
  return observe({ fs, now: () => process.hrtime.bigint(), pidSource: process }, false, arguments.length);
}

// WHAT: Complete synthetic dependencies with a distinct non-production result profile.
export function observeContainmentMetadataMock(configuration) {
  return observe(configuration, true, arguments.length);
}
