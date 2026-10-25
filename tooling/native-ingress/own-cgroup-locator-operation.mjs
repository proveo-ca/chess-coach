// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
export const OWN_CGROUP_LOCATOR_SOURCE_PINS = freeze({
  helper: { bytes: 23213, sha256: '602965ec7a05e7de29312a5a5cac5e485549eb7455044804a4efac58aa0c1413' },
  dependency: { bytes: 19928, sha256: '249480f9af1b172c83f5f554184df1cfd486d6e7b98a2af4d60ca6433efb6401' },
  linked: { bytes: 49787, sha256: 'd3fb965f303294286526a3313c44bcdf252c34409a9d742309bf81fe53e676aa' },
});
const BASE = '/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/';
const SOURCES = Object.freeze({ helper: BASE + 'own-cgroup-locator.mjs', dependency: BASE + 'containment-metadata.mjs' });
const SECURITY = Object.freeze(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink']);
const TYPED = Object.getPrototypeOf(Uint8Array.prototype);
const LENGTH = Object.getOwnPropertyDescriptor(TYPED, 'length').get;
const BACKING = Object.getOwnPropertyDescriptor(TYPED, 'buffer').get;
const OFFSET = Object.getOwnPropertyDescriptor(TYPED, 'byteOffset').get;
const ARRAY_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const RESIZABLE = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const CODES = new Set(['E_ARGUMENTS', 'E_MOCK_TCB', 'E_SOURCE_PIN', 'E_SOURCE_METADATA', 'E_SOURCE_FLAGS',
  'E_SOURCE_IO', 'E_SOURCE_CLOSE', 'E_LIMIT', 'E_CLOCK', 'E_DEADLINE', 'E_RESULT', 'E_OBSERVATION', 'E_OUTPUT']);
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const check = (condition, code) => { if (!condition) fail(code); };
function own(object, key, code) {
  check(object && typeof object === 'object' && !types.isProxy(object), code);
  const field = Object.getOwnPropertyDescriptor(object, key);
  check(field && Object.hasOwn(field, 'value'), code);
  return field.value;
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function capture(raw, pin) {
  check(raw && !types.isProxy(raw) && Buffer.isBuffer(raw) && Object.getPrototypeOf(raw) === Buffer.prototype, 'E_SOURCE_PIN');
  for (const key of ['length', 'byteLength', 'buffer', 'byteOffset'])
    check(!Object.getOwnPropertyDescriptor(raw, key), 'E_SOURCE_PIN');
  let bytes;
  try {
    const length = LENGTH.call(raw), backing = BACKING.call(raw);
    ARRAY_LENGTH.call(backing);
    check(!RESIZABLE?.call(backing) && length === pin.bytes && length <= 100000, 'E_SOURCE_PIN');
    bytes = Buffer.alloc(length);
    Uint8Array.prototype.set.call(bytes, new Uint8Array(backing, OFFSET.call(raw), length));
  } catch { fail('E_SOURCE_PIN'); }
  check(hash(bytes) === pin.sha256, 'E_SOURCE_PIN');
  return bytes;
}

// WHAT: Private, raw-pinned and fully linked source graph; no path-based imports.
export function captureRegisteredOwnCgroupLocatorSources(raw) {
  const helper = capture(own(raw, 'helper', 'E_SOURCE_PIN'), OWN_CGROUP_LOCATOR_SOURCE_PINS.helper);
  const dependency = capture(own(raw, 'dependency', 'E_SOURCE_PIN'), OWN_CGROUP_LOCATOR_SOURCE_PINS.dependency);
  const literal = "'./containment-metadata.mjs'", source = helper.toString('utf8');
  check(source.split(literal).length === 2, 'E_SOURCE_PIN');
  const dependencyURL = 'data:text/javascript;base64,' + dependency.toString('base64');
  const linked = Buffer.from(source.replace(literal, JSON.stringify(dependencyURL)), 'utf8');
  check(linked.length === OWN_CGROUP_LOCATOR_SOURCE_PINS.linked.bytes &&
    hash(linked) === OWN_CGROUP_LOCATOR_SOURCE_PINS.linked.sha256, 'E_SOURCE_PIN');
  return { helper, dependency, linked };
}
function metadata(raw, pin) {
  const result = {};
  for (const key of SECURITY) {
    const value = own(raw, key, 'E_SOURCE_METADATA');
    check(typeof value === 'bigint' && value >= 0n && value <= 18446744073709551615n, 'E_SOURCE_METADATA');
    result[key] = value;
  }
  check(result.mode <= 4294967295n && (result.mode & 0o170000n) === 0o100000n, 'E_SOURCE_METADATA');
  check(own(raw, 'size', 'E_SOURCE_METADATA') === BigInt(pin.bytes), 'E_SOURCE_PIN');
  return result;
}
const same = (left, right) => SECURITY.every(key => left[key] === right[key]);
function api(raw) {
  const result = {};
  for (const key of ['lstatSync', 'openSync', 'fstatSync', 'readSync', 'closeSync']) {
    const method = own(raw, key, 'E_MOCK_TCB');
    check(typeof method === 'function' && !types.isProxy(method), 'E_MOCK_TCB');
    result[key] = method.bind(raw);
  }
  const constants = own(raw, 'constants', 'E_SOURCE_FLAGS');
  const read = own(constants, 'O_RDONLY', 'E_SOURCE_FLAGS');
  const nofollow = own(constants, 'O_NOFOLLOW', 'E_SOURCE_FLAGS');
  const nonblock = own(constants, 'O_NONBLOCK', 'E_SOURCE_FLAGS');
  check(read === 0 && [nofollow, nonblock].every(value => Number.isSafeInteger(value) && value > 0 &&
    value <= 0x40000000 && (value & (value - 1)) === 0 && (value & 3) === 0) && (nofollow & nonblock) === 0, 'E_SOURCE_FLAGS');
  result.flags = read | nofollow | nonblock;
  return result;
}
function asciiJSON(value) {
  return JSON.stringify(value).replace(/[^\x20-\x7e]/gu, character => {
    let result = '';
    for (let index = 0; index < character.length; index++) result += '\\u' + character.charCodeAt(index).toString(16).padStart(4, '0');
    return result;
  });
}
async function run(configuration, mockOnly, argumentCount) {
  const counts = { clockReadAttempts: 0, fsOperationAttempts: 0, fsOperationsCompleted: 0,
    sourceOpenAttempts: 0, sourceOpensCompleted: 0, sourceReadAttempts: 0, sourceReadsCompleted: 0,
    sourceRequestedReadBytes: 0, sourceReturnedReadBytes: 0, sourceCloseAttempts: 0,
    sourceClosesCompleted: 0, sourceImportsAttempted: 0, sourceImportsCompleted: 0, observationCalls: 0 };
  let io, now, load, observation, started, last, fd = null, error = null, result = null, sourceAccountingComplete = false;
  function guard(milliseconds = 1000) {
    check(counts.clockReadAttempts < 512, 'E_LIMIT'); counts.clockReadAttempts++;
    let value;
    try { value = now(); } catch { fail('E_CLOCK'); }
    check(typeof value === 'bigint' && value >= 0n && (last === undefined || value >= last), 'E_CLOCK');
    if (started === undefined) started = value;
    last = value;
    check(value - started < BigInt(milliseconds) * 1000000n, 'E_DEADLINE');
  }
  function close() {
    if (fd === null) return;
    const owned = fd; fd = null; counts.sourceCloseAttempts++; counts.fsOperationAttempts++;
    try { io.closeSync(owned); counts.sourceClosesCompleted++; counts.fsOperationsCompleted++; }
    catch { fail('E_SOURCE_CLOSE'); }
  }
  function call(name, ...args) {
    guard(); check(counts.fsOperationAttempts < 255, 'E_LIMIT');
    if (name === 'openSync') { check(counts.sourceOpenAttempts < 2 && fd === null, 'E_LIMIT'); counts.sourceOpenAttempts++; }
    if (name === 'readSync') {
      check(counts.sourceReadAttempts < 64 && args[3] <= 131072 - counts.sourceRequestedReadBytes, 'E_LIMIT');
      counts.sourceReadAttempts++; counts.sourceRequestedReadBytes += args[3];
    }
    counts.fsOperationAttempts++;
    const value = io[name](...args); counts.fsOperationsCompleted++;
    if (name === 'readSync') counts.sourceReadsCompleted++;
    return value;
  }
  function readSource(key) {
    const source = SOURCES[key], pin = OWN_CGROUP_LOCATOR_SOURCE_PINS[key];
    let failure = null, raw;
    try {
      const before = metadata(call('lstatSync', source, { bigint: true }), pin);
      const opened = call('openSync', source, io.flags);
      check(Number.isSafeInteger(opened) && opened >= 0, 'E_SOURCE_IO'); fd = opened; counts.sourceOpensCompleted++;
      const descriptor = metadata(call('fstatSync', fd, { bigint: true }), pin);
      check(same(before, descriptor), 'E_SOURCE_METADATA');
      raw = Buffer.alloc(pin.bytes + 1);
      let length = 0;
      while (true) {
        const request = Math.min(4096, raw.length - length);
        check(request > 0, 'E_SOURCE_PIN');
        const returned = call('readSync', fd, raw, length, request, null);
        check(Number.isSafeInteger(returned) && returned >= 0 && returned <= request, 'E_SOURCE_IO');
        counts.sourceReturnedReadBytes += returned; length += returned;
        check(length <= pin.bytes, 'E_SOURCE_PIN');
        if (returned === 0) break;
      }
      check(length === pin.bytes, 'E_SOURCE_PIN');
      const after = metadata(call('fstatSync', fd, { bigint: true }), pin);
      const namedAfter = metadata(call('lstatSync', source, { bigint: true }), pin);
      check(same(before, after) && same(before, namedAfter), 'E_SOURCE_METADATA');
      raw = raw.subarray(0, length);
    } catch (caught) { failure = caught; }
    finally { try { close(); } catch (caught) { failure = caught; } }
    if (failure) throw failure;
    guard(); return raw;
  }
  try {
    check(argumentCount === (mockOnly ? 1 : 0), 'E_ARGUMENTS');
    now = own(configuration, 'now', 'E_MOCK_TCB');
    check(typeof now === 'function' && !types.isProxy(now), 'E_MOCK_TCB'); guard();
    io = api(own(configuration, 'fs', 'E_MOCK_TCB'));
    load = own(configuration, 'load', 'E_MOCK_TCB');
    check(typeof load === 'function' && !types.isProxy(load), 'E_MOCK_TCB');
    if (mockOnly) observation = own(configuration, 'observation', 'E_MOCK_TCB');
    const helper = readSource('helper'), dependency = readSource('dependency');
    guard(); const graph = captureRegisteredOwnCgroupLocatorSources({ helper, dependency }); guard();
    sourceAccountingComplete = true; counts.sourceImportsAttempted++;
    const module = await load('data:text/javascript;base64,' + graph.linked.toString('base64'));
    counts.sourceImportsCompleted++; guard();
    const entry = module[mockOnly ? 'observeOwnCgroupAncestryMock' : 'observeOwnCgroupAncestry'];
    check(typeof entry === 'function', 'E_RESULT'); counts.observationCalls++;
    result = mockOnly ? entry(observation) : entry();
    guard(11000);
    if (result?.status === 'STOP') fail('E_OBSERVATION');
    check(result?.status === 'OWN_CGROUP_METADATA_OBSERVED' && result.mockOnly === mockOnly &&
      result.accountingComplete === true && result.scope === 'DATA_NOT_PERMISSION' &&
      result.error === null && result.rootProfileOnly === false && result.ownAncestryOnly === true &&
      result.delegationCandidate === (result.candidate !== null && !result.error) &&
      (!result.delegationCandidate || (result.mapping === 'MAPPED' && result.snapshotAgreement === true)) &&
      ['nativeQualified', 'rustReady', 'trainingReady', 'train', 'containmentEstablished'].every(key => result[key] === false), 'E_RESULT');
  } catch (caught) {
    const field = caught && typeof caught === 'object' && !types.isProxy(caught) ? Object.getOwnPropertyDescriptor(caught, 'code') : null;
    error = field && Object.hasOwn(field, 'value') && CODES.has(field.value) ? field.value : 'E_SOURCE_IO'; result = null;
  } finally {
    try { close(); } catch { error = 'E_SOURCE_CLOSE'; result = null; sourceAccountingComplete = false; }
    if (started !== undefined) {
      try { guard(11000); } catch (caught) {
        if (error !== 'E_SOURCE_CLOSE') {
          const field = caught && typeof caught === 'object' ? Object.getOwnPropertyDescriptor(caught, 'code') : null;
          error = field && CODES.has(field.value) ? field.value : 'E_CLOCK'; result = null;
        }
      }
    }
  }
  const output = { profile: mockOnly ? 'registered-own-cgroup-locator-MOCK-v1' : 'registered-own-cgroup-locator-v1',
    mockOnly, status: error ? 'STOP' : 'OWN_CGROUP_METADATA_OBSERVED', error, sourcePins: OWN_CGROUP_LOCATOR_SOURCE_PINS,
    sourceAccountingComplete, observationAccountingComplete: result?.accountingComplete === true,
    delegationCandidate: !error && result?.delegationCandidate === true,
    rootProfileOnly: false, ownAncestryOnly: true,
    pinScope: 'SOURCE_RECEIPT_NOT_AUTH', scope: 'DATA_NOT_PERMISSION', counts, result,
    proposedCaptureMilliseconds: 15000, preflightMilliseconds: 1000, totalMilliseconds: 11000,
    hardDeadlineGuaranteed: false, containmentEstablished: false, nativeQualified: false, rustReady: false,
    trainingReady: false, train: false };
  let serialized = asciiJSON(output) + '\n';
  if (Buffer.byteLength(serialized) > 65536) {
    output.status = 'STOP'; output.error = 'E_OUTPUT'; output.result = null; output.observationAccountingComplete = false;
    output.delegationCandidate = false;
    serialized = asciiJSON(output) + '\n'; error = 'E_OUTPUT';
  }
  if (started !== undefined) {
    try { guard(11000); }
    catch (caught) {
      const field = caught && typeof caught === 'object' ? Object.getOwnPropertyDescriptor(caught, 'code') : null;
      error = error === 'E_SOURCE_CLOSE' ? error : field && CODES.has(field.value) ? field.value : 'E_CLOCK';
      output.status = 'STOP'; output.error = error; output.result = null; output.observationAccountingComplete = false;
      output.delegationCandidate = false;
      serialized = asciiJSON(output) + '\n';
    }
  }
  serialized = asciiJSON(output) + '\n';
  if (Buffer.byteLength(serialized) > 65536) {
    output.status = 'STOP'; output.error = 'E_OUTPUT'; output.result = null; output.observationAccountingComplete = false;
    output.delegationCandidate = false;
    serialized = asciiJSON(output) + '\n'; error = 'E_OUTPUT';
  }
  return Object.freeze({ exitCode: error ? 1 : 0, text: serialized });
}

// WHAT: Fixed repository capture and private linked import before zero-argument observation.
export async function runRegisteredOwnCgroupLocator() {
  return run({ fs, now: () => process.hrtime.bigint(), load: url => import(url) }, false, arguments.length);
}

// WHAT: Synthetic source capture, loader and observation dependencies; never production observation.
export async function runRegisteredOwnCgroupLocatorMock(configuration) {
  return run(configuration, true, arguments.length);
}
