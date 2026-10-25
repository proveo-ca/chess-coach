// SPEC: _spec/tooling/native-ingress/step2.puml
import fs from 'node:fs';
import { types } from 'node:util';

const ORIGINAL_LSTAT = fs.lstatSync;
const LSTAT = ORIGINAL_LSTAT.bind(fs);
const CLOCK = performance;
const ORIGINAL_NOW = CLOCK.now;
const NOW = ORIGINAL_NOW.bind(CLOCK);
const BIGINT_STRING = BigInt.prototype.toString;
const PROFILE = 'registered-preparation-helper-metadata-v1';
const FIELDS = Object.freeze(['dev', 'ino', 'mode', 'nlink', 'uid', 'gid', 'size', 'mtimeNs', 'ctimeNs']);
const U64 = (1n << 64n) - 1n;
const I64_MIN = -(1n << 63n);
const I64_MAX = (1n << 63n) - 1n;
const faults = new WeakMap();

function fail(code) {
  const error = new Error(code);
  faults.set(error, code);
  throw error;
}

function check(condition, code) {
  if (!condition) fail(code);
}

function freeze(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export const PREPARATION_HELPER_METADATA_V1_POLICY = freeze({
  profile: PROFILE,
  paths: ['/usr/local/bin/node', '/usr/bin/docker'],
  maxLstats: 4,
  workMs: 3500,
  outerMs: 5000,
  outputBytes: 8192,
  outputDepth: 64,
  outputNodes: 10000,
  observationsOnly: true,
  executionGranted: false,
  metadataCallCompletion: 'normal-return-only',
  stableObservedMeaning: 'equal-pre-post-fields-not-uninterrupted-identity',
  scope: 'METADATA_NOT_INSTALLATION_USABILITY_IDENTITY_OR_AUTHORITY',
});
const POLICY = PREPARATION_HELPER_METADATA_V1_POLICY;
const FLAGS = freeze({
  installed: false, usability: false, helperQualified: false, providerQualified: false,
  runtimeProvidersQualified: false, sourceAuthenticated: false, publisherAuthenticated: false,
  abiVerified: false, pythonFreeSubsetVerified: false, noPythonRuntimeVerified: false,
  imagePrepared: false, dockerProviderQualified: false, nativeQualified: false,
  nativeAuthority: false, rustReady: false, trainingReady: false,
  hardDeadlineGuaranteed: false, hardRssBounded: false, ancestorRacesExcluded: false,
  atomicSnapshotVerified: false, ioIsolated: false,
});

function ownData(value, key, code) {
  check(value !== null && typeof value === 'object' && !types.isProxy(value), code);
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  check(descriptor && Object.hasOwn(descriptor, 'value'), code);
  return descriptor.value;
}

function exactData(value, keys) {
  check(value !== null && typeof value === 'object' && !types.isProxy(value), 'E_MOCK_TCB');
  check([Object.prototype, null].includes(Object.getPrototypeOf(value)), 'E_MOCK_TCB');
  const names = Reflect.ownKeys(value);
  check(names.length === keys.length && names.every(key => keys.includes(key)), 'E_MOCK_TCB');
  return Object.fromEntries(keys.map(key => [key, ownData(value, key, 'E_MOCK_TCB')]));
}

function snapshotMetadata(value) {
  const metadata = {};
  for (const key of FIELDS) {
    const item = ownData(value, key, 'E_METADATA');
    const signed = key === 'mtimeNs' || key === 'ctimeNs';
    check(typeof item === 'bigint' && item >= (signed ? I64_MIN : 0n) &&
      item <= (signed ? I64_MAX : U64), 'E_METADATA');
    metadata[key] = Reflect.apply(BIGINT_STRING, item, []);
  }
  check(metadata.ino !== '0', 'E_METADATA');
  const type = BigInt(metadata.mode) & 0o170000n;
  check(type === 0o100000n || type === 0o120000n, 'E_TYPE');
  return { kind: type === 0o100000n ? 'REGULAR' : 'SYMLINK', metadata };
}

function safeMissing(error) {
  if (error === null || typeof error !== 'object' || types.isProxy(error)) return false;
  const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
  return Boolean(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.value === 'ENOENT');
}

function serializeBounded(value, guard) {
  let nodes = 0;
  const active = new Set();
  function snapshot(item, depth) {
    guard();
    check(depth <= POLICY.outputDepth && ++nodes <= POLICY.outputNodes, 'E_OUTPUT');
    if (item === null || typeof item === 'boolean') return item;
    if (typeof item === 'string') {
      check(item.length + 3 <= POLICY.outputBytes, 'E_OUTPUT');
      return item;
    }
    if (typeof item === 'number') {
      check(Number.isSafeInteger(item), 'E_OUTPUT');
      return item;
    }
    check(typeof item === 'object' && !types.isProxy(item) && !active.has(item), 'E_OUTPUT');
    const array = Array.isArray(item);
    check([array ? Array.prototype : Object.prototype, null].includes(Object.getPrototypeOf(item)), 'E_OUTPUT');
    const keys = Reflect.ownKeys(item);
    check(keys.length <= POLICY.outputNodes, 'E_OUTPUT');
    const length = array ? ownData(item, 'length', 'E_OUTPUT') : keys.length;
    check(!array || (Number.isSafeInteger(length) && length >= 0 && keys.length === length + 1), 'E_OUTPUT');
    active.add(item);
    const copy = array ? [] : {};
    for (let index = 0; index < length; index++) {
      guard();
      const key = array ? String(index) : keys[index];
      check(typeof key === 'string' && key !== 'toJSON' && key.length + 3 <= POLICY.outputBytes, 'E_OUTPUT');
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      check(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable, 'E_OUTPUT');
      const child = snapshot(descriptor.value, depth + 1);
      Object.defineProperty(copy, key, { value: child, enumerable: true, configurable: true, writable: true });
    }
    active.delete(item);
    Object.freeze(copy);
    guard();
    return copy;
  }
  const copied = snapshot(value, 0);
  const parts = [];
  let bytes = 0;
  function emit(text) {
    check(bytes + text.length + 1 <= POLICY.outputBytes, 'E_OUTPUT');
    bytes += text.length;
    parts.push(text);
  }
  function string(text) {
    emit('"');
    for (let index = 0; index < text.length; index++) {
      if (index % 128 === 0) guard();
      const unit = text.charCodeAt(index);
      if (unit === 34 || unit === 92) emit('\\' + text[index]);
      else if (unit < 32 || unit >= 127) emit('\\u' + unit.toString(16).padStart(4, '0'));
      else emit(text[index]);
    }
    emit('"');
  }
  function encode(item) {
    guard();
    if (item === null) emit('null');
    else if (typeof item === 'boolean') emit(item ? 'true' : 'false');
    else if (typeof item === 'number') emit(String(item));
    else if (typeof item === 'string') string(item);
    else {
      const array = Array.isArray(item);
      emit(array ? '[' : '{');
      const keys = Object.keys(item);
      for (let index = 0; index < keys.length; index++) {
        if (index > 0) emit(',');
        const key = keys[index];
        if (!array) { string(key); emit(':'); }
        encode(item[key]);
      }
      emit(array ? ']' : '}');
    }
  }
  guard();
  encode(copied);
  const text = parts.join('') + '\n';
  check(text.length === bytes + 1 && text.length <= POLICY.outputBytes, 'E_OUTPUT');
  guard();
  return { snapshot: copied, text };
}

function observe(deps, mockOnly, initialError) {
  const counters = {
    metadataCallAttempts: 0, metadataCallCompletions: 0,
    fdAcquisitions: 0, opens: 0, reads: 0, contentBytes: 0, hashBytes: 0,
    execs: 0, daemonCalls: 0,
  };
  let start = null, previous = null;
  function guard() {
    let current;
    try { current = Reflect.apply(deps.now, undefined, []); }
    catch { fail('E_CLOCK'); }
    check(typeof current === 'number' && Number.isFinite(current) && current >= 0 &&
      current <= Number.MAX_SAFE_INTEGER && (previous === null || current >= previous), 'E_CLOCK');
    if (start === null) {
      check(current <= Number.MAX_SAFE_INTEGER - POLICY.workMs, 'E_CLOCK');
      start = current;
    }
    previous = current;
    check(current - start < POLICY.workMs, 'E_DEADLINE');
  }
  function metadata(path) {
    guard();
    check(counters.metadataCallAttempts < POLICY.maxLstats, 'E_METADATA');
    counters.metadataCallAttempts++;
    let value, thrown = false, error;
    try {
      value = Reflect.apply(deps.lstatSync, undefined, [path, { bigint: true }]);
      counters.metadataCallCompletions++;
    } catch (failure) { thrown = true; error = failure; }
    guard();
    if (thrown) {
      check(safeMissing(error), 'E_IO');
      return { kind: 'MISSING', metadata: null };
    }
    const result = snapshotMetadata(value);
    guard();
    return result;
  }
  try {
    check(initialError === null, initialError);
    guard();
    const pre = POLICY.paths.map(path => metadata(path));
    const post = POLICY.paths.map(path => metadata(path));
    const entries = POLICY.paths.map((path, index) => {
      guard();
      const before = pre[index], after = post[index];
      check(before.kind === after.kind && (before.metadata === null ||
        FIELDS.every(key => before.metadata[key] === after.metadata[key])), 'E_CHANGED');
      return { path, kind: before.kind, stableObserved: true, metadata: before.metadata };
    });
    guard();
    const data = { profile: PROFILE, status: 'PREPARATION_HELPER_METADATA', mockOnly,
      entries, counters: { ...counters }, ...FLAGS };
    const result = serializeBounded({ exitCode: 0, data }, guard).snapshot;
    guard();
    return result;
  } catch (error) {
    const data = { profile: PROFILE, status: 'STOP', mockOnly,
      error: faults.get(error) ?? 'E_IO', counters: { ...counters }, ...FLAGS };
    return serializeBounded({ exitCode: 1, data }, () => {}).snapshot;
  }
}

let consumed = false;
export function observeRegisteredPreparationHelpersV1() {
  const error = consumed ? 'E_CONSUMED' : arguments.length !== 0 ? 'E_ARGUMENTS' : null;
  consumed = true;
  return observe({ lstatSync: LSTAT, now: NOW }, false, error);
}

export function createPreparationHelperMetadataFixture(configuration, capabilities) {
  check(arguments.length === 2, 'E_MOCK_TCB');
  const config = exactData(configuration, ['mockOnly']);
  check(config.mockOnly === true, 'E_MOCK_TCB');
  const deps = exactData(capabilities, ['lstatSync', 'now']);
  for (const method of [deps.lstatSync, deps.now]) {
    check(typeof method === 'function' && !types.isProxy(method) &&
      ![ORIGINAL_LSTAT, LSTAT, ORIGINAL_NOW, NOW].includes(method), 'E_MOCK_TCB');
  }
  let fixtureConsumed = false;
  return Object.freeze({ observeRegisteredPreparationHelpersV1() {
    const error = fixtureConsumed ? 'E_CONSUMED' : arguments.length !== 0 ? 'E_ARGUMENTS' : null;
    fixtureConsumed = true;
    return observe(deps, true, error);
  } });
}
