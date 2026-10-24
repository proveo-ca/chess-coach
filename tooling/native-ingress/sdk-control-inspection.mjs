// SPEC: _spec/tooling/native-ingress/gnu-sdk-controls.puml
import { createTarInventory as ordinaryInventory, createTarMemberInventory } from './tar-inventory.mjs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

const root = 'x86-64--glibc--stable-2026.08-1';
export const SDK_CONTROLS = Object.freeze([
  Object.freeze({ key: 'wrapper', path: root + '/bin/toolchain-wrapper', index: 10, size: 14704 }),
  Object.freeze({ key: 'script', path: root + '/relocate-sdk.sh', index: 8406, size: 1383 }),
]);
export const SDK_CONTROL_EXPECTATION = Object.freeze({ expandedBytes: 505333760, headers: 10181,
  entries: 8412, extensionBytes: 193768, outputBytes: 1812885, collisionBytes: 783392, dataEvents: 7711,
  metadataSha256: 'efe53c8fda0b0f1e8b8ba6b7868707a88f33aa26b5692b9c76dc0e6da694d901' });
export const SDK_CONTROL_LIMITS = Object.freeze({ maxSpanBytes: 4194304, maxCandidateEntries: 128,
  maxCandidateBytes: 65536, maxInternalSummaryBytes: 4194304 });
const summaryKeys = Object.freeze(Object.keys(SDK_CONTROL_EXPECTATION));
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length').get;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer').get;
const typedOffset = Object.getOwnPropertyDescriptor(typedPrototype, 'byteOffset').get;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const codes = new Set(['E_INPUT', 'E_PHASE', 'E_SUMMARY', 'E_TARGET', 'E_SPAN', 'E_OUTPUT', 'E_HASH', 'E_LENGTH', 'E_RECEIPT']);
export class SdkControlInspectionError extends Error {
  constructor(code) {
    const fixed = codes.has(code) ? code : 'E_INPUT';
    super(fixed); this.name = 'SdkControlInspectionError'; this.code = fixed; Object.freeze(this);
  }
}
const fail = code => { throw new SdkControlInspectionError(code); };
function fields(value, keys, exact = false) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) fail('E_INPUT');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('E_INPUT');
  if (exact && Reflect.ownKeys(value).length !== keys.length) fail('E_INPUT');
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('E_INPUT');
    result[key] = descriptor.value;
  }
  return Object.freeze(result);
}
function arrayItems(value, max) {
  if (!Array.isArray(value) || types.isProxy(value)) fail('E_INPUT');
  const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
  if (!Number.isSafeInteger(length) || length > max) fail('E_SPAN');
  const result = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('E_INPUT');
    result.push(descriptor.value);
  }
  return result;
}
function view(bytes) {
  if (types.isProxy(bytes) || !types.isUint8Array(bytes)) fail('E_INPUT');
  const backing = typedBuffer.call(bytes), length = typedLength.call(bytes);
  if (types.isSharedArrayBuffer(backing) || (resizable && resizable.call(backing)) || !length || length > 1048576) fail('E_INPUT');
  return new Uint8Array(backing, typedOffset.call(bytes), length);
}
function category(path) {
  if (/(?:python|gdb)/iu.test(path)) return null;
  if (path.startsWith(root + '/bin/') && /^[^/]*br_real[^/]*$/u.test(path.slice((root + '/bin/').length))) return 'compiler-real-name';
  if (path.startsWith(root + '/libexec/gcc/') && /^[^/]+\/[^/]+\/(?:cc1|cc1plus|collect2|lto1|lto-wrapper)$/u.test(path.slice((root + '/libexec/gcc/').length))) return 'compiler-helper-name';
  if ([root + '/share/buildroot/sdk-location', root + '/share/buildroot/sdk-relocation-files',
    root + '/manifest.csv', root + '/manifest.json', root + '/.config'].includes(path)) return 'relocation-manifest-name';
  return null;
}

function inspection(profile) {
  let phase = 'idle', factoryCalls = 0, current = null, pending = null, accepted = null;
  let memberComplete = false, memberAccepted = false, captureComplete = false, captureAccepted = false;
  const counts = { memberCompletedFeedCalls: 0, memberBytes: 0, captureCompletedFeedCalls: 0, captureBytes: 0, copiedBytes: 0 };
  function erase() {
    if (current?.buffers) { for (const buffer of current.buffers) buffer.fill(0); current.buffers = null; }
  }
  function abortInspection() { erase(); pending = null; accepted = null; current = null; phase = 'failed'; }
  function summary(value, state) {
    const captured = fields(value, [...summaryKeys, 'state']);
    if (captured.state !== state || !summaryKeys.every(key => captured[key] === profile.expected[key])) fail('E_SUMMARY');
    return Object.freeze(Object.fromEntries(summaryKeys.map(key => [key, captured[key]])));
  }
  function acceptCore(result) {
    const captured = fields(result, ['state', 'mockOnly', 'inventory', 'archivePasses', 'closeAttempts',
      'stdinFinished', 'stdoutEnded', 'stderrEnded', 'closeObserved', 'exitCode', 'signal', 'extracted',
      'nativeQualified', 'pythonFreeSubsetVerified']);
    if (captured.inventory !== pending || captured.state !== 'GNU_SDK_DATA_INVENTORY' || captured.mockOnly !== profile.mockOnly ||
      captured.archivePasses !== 2 || captured.closeAttempts !== 2 || captured.exitCode !== 0 || captured.signal !== null ||
      !['stdinFinished', 'stdoutEnded', 'stderrEnded', 'closeObserved'].every(key => captured[key] === true) ||
      ['extracted', 'nativeQualified', 'pythonFreeSubsetVerified'].some(key => captured[key] !== false)) fail('E_RECEIPT');
  }
  function memberMetadata() {
    const value = fields(pending, ['fileSpans']);
    const spans = arrayItems(value.fileSpans, profile.expected.entries), targets = [], candidates = [];
    let previousIndex = 0, previousEnd = 0, spanBytes = 2, spanCount = 0;
    for (const item of spans) {
      const span = fields(item, ['index', 'path', 'bodyOffset', 'size'], true);
      if (!Number.isSafeInteger(span.index) || span.index <= previousIndex || span.index > profile.expected.entries ||
        typeof span.path !== 'string' || !span.path || Buffer.byteLength(span.path) > 1024 ||
        !Number.isSafeInteger(span.bodyOffset) || span.bodyOffset < 512 || span.bodyOffset < previousEnd ||
        !Number.isSafeInteger(span.size) || span.size < 0 || span.bodyOffset > profile.expected.expandedBytes ||
        span.size > profile.expected.expandedBytes - span.bodyOffset) fail('E_SPAN');
      previousIndex = span.index; previousEnd = span.bodyOffset + span.size;
      spanBytes += Buffer.byteLength(JSON.stringify(span)) + (spanCount++ ? 1 : 0);
      if (spanBytes > profile.limits.maxSpanBytes) fail('E_OUTPUT');
      const target = profile.controls.find(control => control.path === span.path);
      if (target) {
        if (span.index !== target.index || span.size !== target.size || targets.some(value => value.key === target.key)) fail('E_TARGET');
        targets.push(Object.freeze({ key: target.key, ...span }));
      }
      const kind = category(span.path);
      if (kind) {
        if (candidates.length >= profile.limits.maxCandidateEntries) fail('E_OUTPUT');
        candidates.push(Object.freeze({ ...span, category: kind }));
        if (Buffer.byteLength(JSON.stringify(candidates)) > profile.limits.maxCandidateBytes) fail('E_OUTPUT');
      }
    }
    if (targets.length !== 2) fail('E_TARGET');
    const ordered = profile.controls.map(control => targets.find(target => target.key === control.key));
    const ranges = [...ordered].sort((a, b) => a.bodyOffset - b.bodyOffset);
    if (ranges[0].bodyOffset + ranges[0].size > ranges[1].bodyOffset) fail('E_SPAN');
    return Object.freeze({ summary: summary(pending, 'TAR_MEMBER_INVENTORY'), decodedSha256: current.digest,
      targets: Object.freeze(ordered), candidates: Object.freeze(candidates) });
  }
  return Object.freeze({
    beginMemberPass() {
      if (phase !== 'idle') fail('E_PHASE');
      current = { hash: createHash('sha256'), cursor: 0, buffers: null };
      phase = 'members-configured';
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
            const events = parser.feed(bytes);
            current.hash.update(input);
            if (!members) {
              for (let i = 0; i < accepted.targets.length; i++) {
                const target = accepted.targets[i], start = Math.max(current.cursor, target.bodyOffset);
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
            const result = parser.finish();
            summary(result, members ? 'TAR_MEMBER_INVENTORY' : 'TAR_INVENTORY');
            if (current.cursor !== profile.expected.expandedBytes || Buffer.byteLength(JSON.stringify(result)) > profile.limits.maxInternalSummaryBytes) fail('E_OUTPUT');
            current.digest = current.hash.digest('hex'); current.hash = null;
            if (members) { memberComplete = true; phase = 'members-finished'; }
            else {
              if (current.digest !== accepted.decodedSha256) fail('E_HASH');
              if (!current.copied.every((bytes, index) => bytes === accepted.targets[index].size)) fail('E_LENGTH');
              captureComplete = true; phase = 'capture-finished';
            }
            pending = result;
            return result;
          } catch (error) { abortInspection(); throw error; }
        },
      });
    },
    acceptMemberPass(result) {
      try {
        if (phase !== 'members-finished') fail('E_PHASE');
        acceptCore(result); accepted = memberMetadata(); pending = null; current = null;
        memberAccepted = true; phase = 'members-accepted';
        return accepted;
      } catch (error) { abortInspection(); throw error; }
    },
    beginCapturePass() {
      if (phase !== 'members-accepted') fail('E_PHASE');
      current = { hash: createHash('sha256'), cursor: 0, buffers: accepted.targets.map(target => Buffer.alloc(target.size)), copied: [0, 0] };
      phase = 'capture-configured';
    },
    acceptCapturePass(result) {
      try {
        if (phase !== 'capture-finished') fail('E_PHASE');
        acceptCore(result); pending = null; captureAccepted = true; phase = 'complete';
      } catch (error) { abortInspection(); throw error; }
    },
    getCapturedControls() {
      if (phase !== 'complete') fail('E_PHASE');
      const result = Object.freeze(accepted.targets.map((target, index) => Object.freeze({ ...target,
        sha256: createHash('sha256').update(current.buffers[index]).digest('hex'), bytes: Buffer.from(current.buffers[index]) })));
      erase(); current = null; phase = 'released';
      return result;
    },
    snapshot() {
      return Object.freeze({ phase, factoryCalls, hasCompleteMemberPass: memberComplete, hasAcceptedMemberPass: memberAccepted,
        hasCompleteSecondPass: captureComplete, hasAcceptedSecondPass: captureAccepted, ...counts });
    },
    abortInspection,
  });
}

// WHAT: Reduced, fixed-path in-memory profile with lower-only fixture budgets.
export function createControlInspectionFixture(value) {
  const profile = fields(value, ['expectedSummary', 'controls', 'limits'], true);
  const expected = fields(profile.expectedSummary, summaryKeys, true);
  for (const key of summaryKeys) {
    if (key === 'metadataSha256') {
      if (typeof expected[key] !== 'string' || !/^[0-9a-f]{64}$/u.test(expected[key])) fail('E_INPUT');
    } else if (!Number.isSafeInteger(expected[key]) || expected[key] < 0 || expected[key] > SDK_CONTROL_EXPECTATION[key]) fail('E_INPUT');
  }
  if (expected.expandedBytes < 1 || expected.expandedBytes > 1048576) fail('E_INPUT');
  const controls = arrayItems(profile.controls, 2);
  if (controls.length !== 2) fail('E_INPUT');
  const reduced = controls.map((value, index) => {
    const control = fields(value, ['index', 'size'], true), registered = SDK_CONTROLS[index];
    if (!Number.isSafeInteger(control.index) || control.index < 1 || control.index > registered.index ||
      !Number.isSafeInteger(control.size) || control.size < 1 || control.size > registered.size) fail('E_INPUT');
    return Object.freeze({ ...registered, ...control });
  });
  fields(profile.limits, []);
  const keys = Reflect.ownKeys(profile.limits);
  if (keys.some(key => typeof key !== 'string' || !Object.hasOwn(SDK_CONTROL_LIMITS, key))) fail('E_INPUT');
  const overrides = fields(profile.limits, keys, true), limits = { ...SDK_CONTROL_LIMITS };
  for (const [key, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(limits, key) || !Number.isSafeInteger(value) || value < (key === 'maxCandidateEntries' ? 0 : 1) || value > limits[key]) fail('E_INPUT');
    limits[key] = value;
  }
  return inspection(Object.freeze({ expected, controls: Object.freeze(reduced), limits: Object.freeze(limits), mockOnly: true }));
}

const registered = inspection(Object.freeze({ expected: SDK_CONTROL_EXPECTATION, controls: SDK_CONTROLS, limits: SDK_CONTROL_LIMITS, mockOnly: false }));
export const beginMemberPass = () => registered.beginMemberPass();
export const createTarInventory = overrides => registered.createTarInventory(overrides);
export const acceptMemberPass = result => registered.acceptMemberPass(result);
export const beginCapturePass = () => registered.beginCapturePass();
export const acceptCapturePass = result => registered.acceptCapturePass(result);
export const getCapturedControls = () => registered.getCapturedControls();
export const snapshotControlInspection = () => registered.snapshot();
export const abortControlInspection = () => registered.abortInspection();
