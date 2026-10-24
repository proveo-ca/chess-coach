// SPEC: _spec/tooling/native-ingress/gnu-sdk-driver-controls.puml
import { createTarInventory as ordinaryInventory, createTarMemberInventory } from './tar-inventory.mjs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

const root = 'x86-64--glibc--stable-2026.08-1';
export const SDK_DRIVER_DECODED_SHA256 = '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f';
export const SDK_DRIVER_EXPECTATION = Object.freeze({ expandedBytes: 505333760, headers: 10181,
  entries: 8412, extensionBytes: 193768, outputBytes: 1812885, collisionBytes: 783392, dataEvents: 7711,
  metadataSha256: 'efe53c8fda0b0f1e8b8ba6b7868707a88f33aa26b5692b9c76dc0e6da694d901' });
export const SDK_DRIVER_TARGETS = Object.freeze([
  Object.freeze({ key: 'driver', path: root + '/bin/x86_64-buildroot-linux-gnu-gcc-15.3.0.br_real', size: 2349760, index: 29, bodyOffset: 61895680 }),
  Object.freeze({ key: 'location', path: root + '/share/buildroot/sdk-location', size: 79, index: 279, bodyOffset: 265943552 }),
  Object.freeze({ key: 'relocs', path: root + '/share/buildroot/sdk-relocs', minSize: 1, maxSize: 1048576 }),
]);
export const SDK_DRIVER_LIMITS = Object.freeze({ maxSpanBytes: 4194304, maxLookupKeyBytes: 4194304,
  maxInternalSummaryBytes: 4194304, maxManifestLines: 4096, maxJoinedBytes: 1048576, maxPayloadBytes: 3398415 });
const summaryKeys = Object.freeze(Object.keys(SDK_DRIVER_EXPECTATION));
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length').get;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer').get;
const typedOffset = Object.getOwnPropertyDescriptor(typedPrototype, 'byteOffset').get;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const codes = new Set(['E_INPUT', 'E_PHASE', 'E_SUMMARY', 'E_TARGET', 'E_SPAN', 'E_OUTPUT', 'E_HASH',
  'E_LENGTH', 'E_RECEIPT', 'E_TEXT', 'E_LOCATION', 'E_MANIFEST', 'E_REFERENCE']);
export class SdkDriverControlsError extends Error {
  constructor(code) {
    const fixed = codes.has(code) ? code : 'E_INPUT';
    super(fixed); this.name = 'SdkDriverControlsError'; this.code = fixed; Object.freeze(this);
  }
}
const fail = code => { throw new SdkDriverControlsError(code); };
function fields(value, keys, exact = false) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) fail('E_INPUT');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('E_INPUT');
  if (exact && Reflect.ownKeys(value).length !== keys.length) fail('E_INPUT');
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('E_INPUT');
    result[key] = descriptor.value;
  }
  return Object.freeze(result);
}
function items(value, max) {
  if (types.isProxy(value) || !Array.isArray(value)) fail('E_INPUT');
  const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
  if (!Number.isSafeInteger(length) || length > max) fail('E_SPAN');
  if (Reflect.ownKeys(value).length !== length + 1) fail('E_INPUT');
  const result = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('E_INPUT');
    result.push(descriptor.value);
  }
  return result;
}
function view(bytes, max = 1048576) {
  if (types.isProxy(bytes) || !types.isUint8Array(bytes)) fail('E_INPUT');
  const backing = typedBuffer.call(bytes), length = typedLength.call(bytes);
  if (types.isSharedArrayBuffer(backing) || (resizable && resizable.call(backing)) || !length || length > max) fail('E_INPUT');
  return new Uint8Array(backing, typedOffset.call(bytes), length);
}
function text(bytes, max) {
  const input = view(bytes, max);
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input); }
  catch { fail('E_TEXT'); }
}
function literalPath(path, code) {
  if (!path || Buffer.byteLength(path) > 1024 || !/^[A-Za-z0-9_+.,@%=-]+(?:\/[A-Za-z0-9_+.,@%=-]+)*$/u.test(path) ||
    path.split('/').some(component => component === '.' || component === '..')) fail(code);
}
// WHAT: Strict inert absolute-prefix data with at most one terminal LF.
export function parseSdkLocation(bytes) {
  let value = text(bytes, 79);
  if (value.endsWith('\n')) value = value.slice(0, -1);
  if (!value.startsWith('/')) fail('E_LOCATION');
  literalPath(value.slice(1), 'E_LOCATION');
  return value;
}
function manifest(bytes, maxLines) {
  let value = text(bytes, 1048576);
  if (value.endsWith('\n')) value = value.slice(0, -1);
  if (!value) fail('E_MANIFEST');
  const paths = [], seen = new Set();
  let start = 0;
  while (start <= value.length) {
    if (paths.length >= maxLines) fail('E_MANIFEST');
    const newline = value.indexOf('\n', start), end = newline < 0 ? value.length : newline;
    const path = value.slice(start, end);
    literalPath(path, 'E_MANIFEST');
    if (Buffer.byteLength(root + '/' + path) > 1024 || seen.has(path)) fail('E_MANIFEST');
    seen.add(path); paths.push(path);
    if (newline < 0) break;
    start = end + 1;
  }
  return Object.freeze(paths);
}
// WHAT: Literal relative-path lines; no shell expansion or path normalization.
export const parseSdkRelocationManifest = bytes => manifest(bytes, 4096);

function inspection(profile) {
  let phase = 'idle', factoryCalls = 0, current = null, pending = null, accepted = null;
  let memberComplete = false, memberAccepted = false, captureComplete = false, captureAccepted = false;
  const counts = { memberCompletedFeedCalls: 0, memberBytes: 0, captureCompletedFeedCalls: 0, captureBytes: 0, copiedBytes: 0 };
  function erase() { if (current?.buffers) { for (const buffer of current.buffers) buffer.fill(0); current.buffers = null; } }
  function abortInspection() {
    erase(); if (accepted) accepted.lookup.clear();
    current = null; pending = null; accepted = null; phase = 'failed';
  }
  function summary(value, state) {
    const captured = fields(value, [...summaryKeys, 'state']);
    if (captured.state !== state || !summaryKeys.every(key => captured[key] === profile.expected[key])) fail('E_SUMMARY');
    return Object.freeze(Object.fromEntries(summaryKeys.map(key => [key, captured[key]])));
  }
  function acceptCore(result) {
    const captured = fields(result, ['state', 'mockOnly', 'inventory', 'archivePasses', 'closeAttempts',
      'stdinFinished', 'stdoutEnded', 'stderrEnded', 'closeObserved', 'exitCode', 'signal', 'extracted', 'nativeQualified', 'pythonFreeSubsetVerified']);
    if (captured.inventory !== pending || captured.state !== 'GNU_SDK_DATA_INVENTORY' || captured.mockOnly !== profile.mockOnly ||
      captured.archivePasses !== 2 || captured.closeAttempts !== 2 || captured.exitCode !== 0 || captured.signal !== null ||
      !['stdinFinished', 'stdoutEnded', 'stderrEnded', 'closeObserved'].every(key => captured[key] === true) ||
      ['extracted', 'nativeQualified', 'pythonFreeSubsetVerified'].some(key => captured[key] !== false)) fail('E_RECEIPT');
  }
  function memberMetadata() {
    const spans = items(fields(pending, ['fileSpans']).fileSpans, profile.expected.entries), lookup = new Map();
    let previousIndex = 0, previousEnd = 0, spanBytes = 2, keyBytes = 2;
    for (const item of spans) {
      const span = fields(item, ['index', 'path', 'bodyOffset', 'size'], true);
      if (!Number.isSafeInteger(span.index) || span.index <= previousIndex || span.index > profile.expected.entries ||
        typeof span.path !== 'string' || !span.path || Buffer.byteLength(span.path) > 1024 || lookup.has(span.path) ||
        !Number.isSafeInteger(span.bodyOffset) || span.bodyOffset < 512 || span.bodyOffset < previousEnd ||
        !Number.isSafeInteger(span.size) || span.size < 0 || span.bodyOffset > profile.expected.expandedBytes ||
        span.size > profile.expected.expandedBytes - span.bodyOffset) fail('E_SPAN');
      spanBytes += Buffer.byteLength(JSON.stringify(span)) + (lookup.size ? 1 : 0);
      keyBytes += Buffer.byteLength(JSON.stringify(span.path)) + (lookup.size ? 1 : 0);
      if (spanBytes > profile.limits.maxSpanBytes || keyBytes > profile.limits.maxLookupKeyBytes) fail('E_OUTPUT');
      lookup.set(span.path, Object.freeze({ ...span })); previousIndex = span.index; previousEnd = span.bodyOffset + span.size;
    }
    const targets = profile.targets.map(target => {
      const span = lookup.get(target.path);
      if (!span || (target.key !== 'relocs' && ['size', 'index', 'bodyOffset'].some(key => span[key] !== target[key])) ||
        (target.key === 'relocs' && (span.size < 1 || span.size > target.maxSize))) fail('E_TARGET');
      return Object.freeze({ key: target.key, ...span });
    });
    const ranges = [...targets].sort((a, b) => a.bodyOffset - b.bodyOffset);
    if (ranges.some((span, index) => index > 0 && ranges[index - 1].bodyOffset + ranges[index - 1].size > span.bodyOffset)) fail('E_SPAN');
    if (targets.reduce((total, target) => total + target.size, 0) > profile.limits.maxPayloadBytes) fail('E_OUTPUT');
    return { metadata: Object.freeze({ summary: summary(pending, 'TAR_MEMBER_INVENTORY'), decodedSha256: profile.digest,
      targets: Object.freeze(targets), regularFileCount: lookup.size, lookupKeyJsonBytes: keyBytes }), lookup };
  }
  return Object.freeze({
    beginMemberPass() {
      if (phase !== 'idle') fail('E_PHASE');
      current = { hash: createHash('sha256'), cursor: 0, buffers: null }; phase = 'members-configured';
    },
    createTarInventory(overrides = {}) {
      if (!['members-configured', 'capture-configured'].includes(phase) || factoryCalls >= 2) fail('E_PHASE');
      const members = phase === 'members-configured';
      let parser;
      try { parser = members ? createTarMemberInventory(overrides, profile.limits.maxSpanBytes) : ordinaryInventory(overrides); }
      catch (error) { abortInspection(); throw error; }
      factoryCalls++; phase = members ? 'members-running' : 'capture-running';
      return Object.freeze({
        feed(bytes) {
          try {
            if (phase !== (members ? 'members-running' : 'capture-running')) fail('E_PHASE');
            const input = view(bytes);
            if (input.length > profile.expected.expandedBytes - current.cursor) fail('E_LENGTH');
            const events = parser.feed(bytes); current.hash.update(input);
            if (!members) {
              for (let i = 0; i < 3; i++) {
                const target = accepted.metadata.targets[i], start = Math.max(current.cursor, target.bodyOffset);
                const end = Math.min(current.cursor + input.length, target.bodyOffset + target.size);
                if (start < end) {
                  current.buffers[i].set(input.subarray(start - current.cursor, end - current.cursor), start - target.bodyOffset);
                  current.copied[i] += end - start; counts.copiedBytes += end - start;
                }
              }
            }
            current.cursor += input.length;
            if (members) { counts.memberCompletedFeedCalls++; counts.memberBytes += input.length; }
            else { counts.captureCompletedFeedCalls++; counts.captureBytes += input.length; }
            return events;
          } catch (error) { abortInspection(); throw error; }
        },
        finish() {
          try {
            if (phase !== (members ? 'members-running' : 'capture-running')) fail('E_PHASE');
            const result = parser.finish(); summary(result, members ? 'TAR_MEMBER_INVENTORY' : 'TAR_INVENTORY');
            if (current.cursor !== profile.expected.expandedBytes) fail('E_LENGTH');
            if (members) {
              for (const item of items(fields(result, ['fileSpans']).fileSpans, profile.expected.entries)) {
                const span = fields(item, ['index', 'path', 'bodyOffset', 'size'], true);
                if (typeof span.path !== 'string' || !['index', 'bodyOffset', 'size'].every(key => Number.isSafeInteger(span[key]))) fail('E_SPAN');
              }
            }
            if (Buffer.byteLength(JSON.stringify(result)) > profile.limits.maxInternalSummaryBytes) fail('E_OUTPUT');
            const digest = current.hash.digest('hex'); current.hash = null;
            if (digest !== profile.digest) fail('E_HASH');
            if (members) { memberComplete = true; phase = 'members-finished'; }
            else {
              if (!current.copied.every((size, index) => size === accepted.metadata.targets[index].size)) fail('E_LENGTH');
              captureComplete = true; phase = 'capture-finished';
            }
            pending = result; return result;
          } catch (error) { abortInspection(); throw error; }
        },
      });
    },
    acceptMemberPass(result) {
      try {
        if (phase !== 'members-finished') fail('E_PHASE');
        acceptCore(result); accepted = memberMetadata(); current = null; pending = null;
        memberAccepted = true; phase = 'members-accepted'; return accepted.metadata;
      } catch (error) { abortInspection(); throw error; }
    },
    beginCapturePass() {
      if (phase !== 'members-accepted') fail('E_PHASE');
      current = { hash: createHash('sha256'), cursor: 0, buffers: accepted.metadata.targets.map(target => Buffer.alloc(target.size)), copied: [0, 0, 0] };
      phase = 'capture-configured';
    },
    acceptCapturePass(result) {
      try {
        if (phase !== 'capture-finished') fail('E_PHASE');
        acceptCore(result); pending = null; captureAccepted = true; phase = 'complete';
      } catch (error) { abortInspection(); throw error; }
    },
    getInspectionData() {
      try {
        if (phase !== 'complete') fail('E_PHASE');
        const prefix = parseSdkLocation(current.buffers[1]), paths = manifest(current.buffers[2], profile.limits.maxManifestLines);
        const joined = []; let bytes = 2;
        for (const relativePath of paths) {
          const span = accepted.lookup.get(root + '/' + relativePath);
          if (!span) fail('E_REFERENCE');
          const entry = Object.freeze({ relativePath, ...span });
          bytes += Buffer.byteLength(JSON.stringify(entry)) + (joined.length ? 1 : 0);
          if (bytes > profile.limits.maxJoinedBytes) fail('E_OUTPUT');
          joined.push(entry);
        }
        const refs = accepted.metadata.targets.map((target, index) => Object.freeze({ ...target,
          sha256: createHash('sha256').update(current.buffers[index]).digest('hex'), byteLength: target.size }));
        const result = Object.freeze({ driver: Object.freeze({ ...refs[0], bytes: Buffer.from(current.buffers[0]) }),
          location: Object.freeze({ ...refs[1], prefix, interpretation: 'DATA_ONLY_NOT_A_HOST_PATH_PERMISSION' }),
          relocs: Object.freeze({ ...refs[2], paths, joined: Object.freeze(joined), interpretation: 'DATA_ONLY_LITERAL_PATHS_NOT_MUTATION_AUTHORITY' }) });
        erase(); accepted.lookup.clear(); accepted = null; current = null; phase = 'released'; return result;
      } catch (error) { abortInspection(); throw error; }
    },
    snapshot() {
      return Object.freeze({ phase, factoryCalls, hasCompleteMemberPass: memberComplete, hasAcceptedMemberPass: memberAccepted,
        hasCompleteSecondPass: captureComplete, hasAcceptedSecondPass: captureAccepted, ...counts });
    },
    abortInspection,
  });
}

// WHAT: Lower-only fixed-name fixture with a trusted synthetic decoded digest.
export function createSdkDriverControlsFixture(value) {
  const profile = fields(value, ['expectedSummary', 'expectedDecodedSha256', 'targets', 'limits'], true);
  const expected = fields(profile.expectedSummary, summaryKeys, true);
  for (const key of summaryKeys) {
    if (key === 'metadataSha256') { if (typeof expected[key] !== 'string' || !/^[0-9a-f]{64}$/u.test(expected[key])) fail('E_INPUT'); }
    else if (!Number.isSafeInteger(expected[key]) || expected[key] < 0 || expected[key] > SDK_DRIVER_EXPECTATION[key]) fail('E_INPUT');
  }
  if (expected.expandedBytes < 1 || expected.expandedBytes > 1048576 || typeof profile.expectedDecodedSha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(profile.expectedDecodedSha256)) fail('E_INPUT');
  const values = items(profile.targets, 3);
  if (values.length !== 3) fail('E_INPUT');
  const targets = values.map((value, index) => {
    const registered = SDK_DRIVER_TARGETS[index];
    if (index === 2) {
      const target = fields(value, ['maxSize'], true);
      if (!Number.isSafeInteger(target.maxSize) || target.maxSize < 1 || target.maxSize > registered.maxSize) fail('E_INPUT');
      return Object.freeze({ ...registered, maxSize: target.maxSize });
    }
    const target = fields(value, ['size', 'index', 'bodyOffset'], true);
    if (!['size', 'index', 'bodyOffset'].every(key => Number.isSafeInteger(target[key]) && target[key] >= (key === 'bodyOffset' ? 512 : 1) && target[key] <= registered[key])) fail('E_INPUT');
    return Object.freeze({ ...registered, ...target });
  });
  fields(profile.limits, []); const keys = Reflect.ownKeys(profile.limits), limits = { ...SDK_DRIVER_LIMITS };
  if (keys.some(key => typeof key !== 'string' || !Object.hasOwn(limits, key))) fail('E_INPUT');
  const overrides = fields(profile.limits, keys, true);
  for (const [key, value] of Object.entries(overrides)) {
    if (!Number.isSafeInteger(value) || value < 1 || value > limits[key]) fail('E_INPUT');
    limits[key] = value;
  }
  return inspection(Object.freeze({ expected, digest: profile.expectedDecodedSha256, targets: Object.freeze(targets), limits: Object.freeze(limits), mockOnly: true }));
}

const registered = inspection(Object.freeze({ expected: SDK_DRIVER_EXPECTATION, digest: SDK_DRIVER_DECODED_SHA256,
  targets: SDK_DRIVER_TARGETS, limits: SDK_DRIVER_LIMITS, mockOnly: false }));
export const beginMemberPass = () => registered.beginMemberPass();
export const createTarInventory = overrides => registered.createTarInventory(overrides);
export const acceptMemberPass = value => registered.acceptMemberPass(value);
export const beginCapturePass = () => registered.beginCapturePass();
export const acceptCapturePass = value => registered.acceptCapturePass(value);
export const getInspectionData = () => registered.getInspectionData();
export const snapshotDriverInspection = () => registered.snapshot();
export const abortDriverInspection = () => registered.abortInspection();
