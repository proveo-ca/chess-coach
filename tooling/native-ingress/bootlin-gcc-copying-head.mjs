// SPEC: _spec/tooling/native-ingress/step2.puml
import { types } from 'node:util';

const FETCH = globalThis.fetch;
const CLOCK = globalThis.performance;
const NOW = CLOCK.now;
const SET_TIMEOUT = globalThis.setTimeout;
const CLEAR_TIMEOUT = globalThis.clearTimeout;
const ABORT_CONTROLLER = globalThis.AbortController;
const URL = 'https://toolchains.bootlin.com/downloads/releases/licenses/gcc-final-15.3.0/COPYING';
const PROFILE = 'registered-bootlin-gcc-copying-head-v1';
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const FLAGS = Object.freeze(Object.fromEntries([
  'sourceAuthenticated', 'publisherAuthenticated', 'sourceRootAuthentication',
  'noticeQualified', 'noticeApplicabilityVerified', 'licenseComplianceVerified',
  'copyAuthorized', 'pythonFreeSubsetVerified', 'runtimeProvidersQualified',
  'abiVerified', 'imagePrepared', 'nativeQualified', 'rustReady', 'trainingReady',
  'hardDeadlineGuaranteed', 'hardRssBounded', 'wireByteBounded',
  'rawWireHeadersObserved', 'noBodyWireProved', 'transportClosureVerified', 'ioIsolated',
].map((key) => [key, false])));

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

export const BOOTLIN_GCC_COPYING_HEAD_V1_POLICY = deepFreeze({
  profile: PROFILE,
  clientKey: PROFILE,
  method: 'HEAD',
  requestedUrl: URL,
  maxRequests: 1,
  exposedHeaders: 64,
  totalHeaderUtf8Bytes: 16384,
  outputAsciiBytes: 65536,
  outputIncludesFinalLf: true,
  depth: 64,
  nodes: 100000,
  requestMs: 10000,
  workMs: 27000,
  totalMs: 30000,
  cleanupMs: 3000,
  bodyAcquisitionAllowed: false,
  noticeAdmissionAllowed: false,
  readerAcquisitionAllowed: false,
  outputScopes: ['HEAD_METADATA_DATA', 'STOP'],
  sourceRef: {
    kind: 'historical-gcc-context-identity',
    contextBytes: 14690,
    contextSha256: 'b020748b1a6cae8254e82486821682d79e747918a8a0128a897fa33c94806c7b',
    licenseBodyBytes: 1867,
    licenseBodySha256: 'bc44d5fff09beba4b68c3ad6ac6ae914e26f8174f32c85322c721f0f355f8f1c',
    copyingHref: URL,
    publisherAuthenticated: false,
  },
  qualifications: FLAGS,
});

class HeadFault extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new HeadFault(code);
}

function ownData(value, keys) {
  if (value === null || typeof value !== 'object' || types.isProxy(value)) fail('E_ARGUMENTS');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('E_ARGUMENTS');
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail('E_ARGUMENTS');
  const data = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('E_ARGUMENTS');
    data[key] = descriptor.value;
  }
  return data;
}

function validateFixture(config, dependencies) {
  if (ownData(config, ['mockOnly']).mockOnly !== true) fail('E_ARGUMENTS');
  const deps = ownData(dependencies, ['fetch', 'now', 'setTimeout', 'clearTimeout']);
  const forbidden = [FETCH, NOW, SET_TIMEOUT, CLEAR_TIMEOUT, globalThis.fetch,
    globalThis.performance.now, globalThis.setTimeout, globalThis.clearTimeout];
  for (const value of Object.values(deps)) {
    if (typeof value !== 'function' || types.isProxy(value) || forbidden.includes(value)) fail('E_ARGUMENTS');
  }
  return deps;
}

function outputFrame(value) {
  const ancestors = new Set();
  let nodes = 0;
  function visit(item, depth) {
    if (++nodes > 100000 || depth > 64) fail('E_OUTPUT');
    if (item === null || typeof item === 'boolean') return;
    if (typeof item === 'string') {
      if (item.length > 65536) fail('E_OUTPUT');
      return;
    }
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) fail('E_OUTPUT');
      return;
    }
    if (typeof item !== 'object' || types.isProxy(item) || ancestors.has(item)) fail('E_OUTPUT');
    const array = Array.isArray(item);
    const prototype = Object.getPrototypeOf(item);
    if (prototype !== (array ? Array.prototype : Object.prototype) && !(prototype === null && !array)) fail('E_OUTPUT');
    for (let parent = prototype; parent !== null; parent = Object.getPrototypeOf(parent)) {
      if (Object.getOwnPropertyDescriptor(parent, 'toJSON')) fail('E_OUTPUT');
    }
    ancestors.add(item);
    let arrayItems = 0;
    for (const key of Reflect.ownKeys(item)) {
      if (typeof key !== 'string' || key === 'toJSON') fail('E_OUTPUT');
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('E_OUTPUT');
      if (array && key === 'length') continue;
      if (!descriptor.enumerable || (array && String(arrayItems++) !== key)) fail('E_OUTPUT');
      visit(key, depth + 1);
      visit(descriptor.value, depth + 1);
    }
    if (array && arrayItems !== item.length) fail('E_OUTPUT');
    ancestors.delete(item);
  }
  visit(value, 0);
  const frame = JSON.stringify(value).replace(/[\u007f-\uffff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`) + '\n';
  if (frame.length > 65536) fail('E_OUTPUT');
  return frame;
}

function newCounts() {
  return {
    requests: 0, fetchCalls: 0, authoredBodyReads: 0,
    pendingFetchKnown: false, abortCalls: 0, cancelCalls: 0, releaseCalls: 0,
    timersCreated: 0, timersCleared: 0, timersFired: 0, activeTimers: 0,
  };
}

function publish(exitCode, data) {
  const result = { exitCode, data };
  outputFrame(result);
  return deepFreeze(result);
}

function stopped(code, counts, cleanupUncertain, mockOnly) {
  return publish(1, {
    scope: 'STOP', profile: PROFILE, mockOnly, code,
    counts: { ...counts }, cleanupUncertain,
    bodyPrefixWithheld: true,
  });
}

function readHeaders(headers, guard) {
  const pairs = [];
  const names = new Set();
  let headerBytes = 0;
  try {
    if (headers === null || typeof headers !== 'object' || types.isProxy(headers)) fail('E_HEADERS');
    const iterate = headers[Symbol.iterator];
    if (typeof iterate !== 'function' || types.isProxy(iterate)) fail('E_HEADERS');
    const iterator = Reflect.apply(iterate, headers, []);
    if (!iterator || types.isProxy(iterator)) fail('E_HEADERS');
    const next = iterator.next;
    if (typeof next !== 'function' || types.isProxy(next)) fail('E_HEADERS');
    for (;;) {
      guard();
      const step = Reflect.apply(next, iterator, []);
      if (!step || types.isProxy(step)) fail('E_HEADERS');
      const done = step.done;
      if (done === true) break;
      if (done !== false || pairs.length === 64) fail('E_HEADERS');
      const pair = step.value;
      if (!Array.isArray(pair) || types.isProxy(pair) || pair.length !== 2) fail('E_HEADERS');
      const first = Object.getOwnPropertyDescriptor(pair, '0');
      const second = Object.getOwnPropertyDescriptor(pair, '1');
      if (!first || !second || !Object.hasOwn(first, 'value') || !Object.hasOwn(second, 'value')) fail('E_HEADERS');
      const name = first.value;
      const value = second.value;
      if (typeof name !== 'string' || typeof value !== 'string' || name.length > 16384 || value.length > 16384) fail('E_HEADERS');
      if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || names.has(name.toLowerCase())) fail('E_HEADERS');
      const nameBytes = ENCODER.encode(name);
      const valueBytes = ENCODER.encode(value);
      if (DECODER.decode(nameBytes) !== name || DECODER.decode(valueBytes) !== value) fail('E_HEADERS');
      const nextBytes = headerBytes + nameBytes.length + valueBytes.length;
      if (nextBytes > 16384) fail('E_HEADERS');
      headerBytes = nextBytes;
      names.add(name.toLowerCase());
      pairs.push([name, value]);
    }
  } catch (error) {
    if (error instanceof HeadFault) throw error;
    fail('E_HEADERS');
  }
  guard();
  return { exposedHeaders: pairs, exposedHeaderCount: pairs.length, headerBytes };
}

function createCollector(deps, mockOnly) {
  let consumed = false;
  return Object.freeze({
    async run() {
      const counts = newCounts();
      if (consumed) return stopped('E_ONESHOT', counts, false, mockOnly);
      consumed = true;
      if (arguments.length !== 0) return stopped('E_ARGUMENTS', counts, false, mockOnly);
      let cleanupUncertain = false;
      let controller;
      let response;
      let responseAvailable = false;
      let body;
      let bodyAttempted = false;
      let bodyKnown = false;
      let fetchStarted = false;
      let totalEnd;
      let workEnd;
      let requestEnd;
      let lastClock;
      let deadlineCode;
      let outer;
      const timers = [];

      function clock() {
        let value;
        try { value = Reflect.apply(deps.now, undefined, []); } catch { fail('E_CLOCK'); }
        if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER ||
            (lastClock !== undefined && value < lastClock)) fail('E_CLOCK');
        lastClock = value;
        return value;
      }

      function abort() {
        if (controller && counts.abortCalls === 0) {
          counts.abortCalls++;
          try { controller.abort(); } catch { cleanupUncertain = true; }
        }
      }

      function schedule(delay, code) {
        let resolve;
        const promise = new Promise((done) => { resolve = done; });
        const timer = { id: undefined, active: true, fired: false, created: false };
        timers.push(timer);
        const fire = () => {
          if (timer.fired || !timer.active) return;
          timer.fired = true;
          if (timer.created) counts.activeTimers--;
          timer.active = false;
          counts.timersFired++;
          deadlineCode ??= code;
          abort();
          resolve({ kind: 'deadline', code });
        };
        try {
          timer.id = Reflect.apply(deps.setTimeout, undefined, [fire, delay]);
          timer.created = true;
          counts.timersCreated++;
          if (timer.active) counts.activeTimers++;
        } catch {
          timer.active = false;
          cleanupUncertain = true;
          fail('E_TIMER');
        }
        return promise;
      }

      function clearTimers() {
        for (const timer of timers) {
          if (!timer.created || timer.cleared) continue;
          timer.cleared = true;
          try {
            const returned = Reflect.apply(deps.clearTimeout, undefined, [timer.id]);
            if (returned !== undefined) {
              cleanupUncertain = true;
              Promise.resolve(returned).catch(() => {});
            } else {
              counts.timersCleared++;
              if (timer.active) counts.activeTimers--;
              timer.active = false;
            }
          } catch { cleanupUncertain = true; }
        }
      }

      function guard() {
        const current = clock();
        if (current >= totalEnd) fail('E_TOTAL_DEADLINE');
        if (current >= workEnd) fail('E_WORK_DEADLINE');
        if (requestEnd !== undefined && current >= requestEnd) fail('E_REQUEST_DEADLINE');
        if (deadlineCode) fail(deadlineCode);
        return current;
      }

      function captureBody() {
        bodyAttempted = true;
        if (response === null || typeof response !== 'object' || types.isProxy(response)) fail('E_RESPONSE');
        body = response.body;
        bodyKnown = true;
      }

      async function cleanup() {
        abort();
        if (responseAvailable && !bodyAttempted) {
          try { captureBody(); } catch { cleanupUncertain = true; }
        }
        if (fetchStarted && (!bodyKnown || counts.pendingFetchKnown)) cleanupUncertain = true;
        if (bodyKnown && body !== null) {
          counts.cancelCalls++;
          try {
            if ((typeof body !== 'object' && typeof body !== 'function') || types.isProxy(body)) fail('E_CLEANUP');
            const cancel = body.cancel;
            if (typeof cancel !== 'function' || types.isProxy(cancel)) fail('E_CLEANUP');
            const pending = Promise.resolve(Reflect.apply(cancel, body, [])).then(
              () => ({ kind: 'cancelled' }), () => ({ kind: 'cancel-failed' }));
            let current;
            try { current = clock(); } catch { cleanupUncertain = true; }
            if (!outer || current === undefined || current >= totalEnd) {
              cleanupUncertain = true;
            } else {
              const outcome = await Promise.race([pending, outer]);
              if (outcome.kind !== 'cancelled') cleanupUncertain = true;
              try { if (clock() >= totalEnd) cleanupUncertain = true; } catch { cleanupUncertain = true; }
            }
          } catch { cleanupUncertain = true; }
        }
        clearTimers();
      }

      try {
        const start = clock();
        if (start > Number.MAX_SAFE_INTEGER - 30000) fail('E_CLOCK');
        workEnd = start + 27000;
        totalEnd = start + 30000;
        controller = new ABORT_CONTROLLER();
        const outerNow = clock();
        if (outerNow >= totalEnd) fail('E_TOTAL_DEADLINE');
        outer = schedule(totalEnd - outerNow, 'E_TOTAL_DEADLINE');
        const requestStart = guard();
        requestEnd = requestStart + Math.min(10000, workEnd - requestStart);
        const requestNow = guard();
        const request = schedule(requestEnd - requestNow, 'E_REQUEST_DEADLINE');
        guard();
        const options = {
          method: 'HEAD', redirect: 'manual', credentials: 'omit', cache: 'no-store',
          referrer: '', referrerPolicy: 'no-referrer',
          headers: { Accept: '*/*', 'Accept-Encoding': 'identity' },
          signal: controller.signal,
        };
        counts.requests++;
        counts.fetchCalls++;
        counts.pendingFetchKnown = true;
        fetchStarted = true;
        let pending;
        try {
          pending = Promise.resolve(Reflect.apply(deps.fetch, undefined, [URL, options]));
        } catch {
          counts.pendingFetchKnown = false;
          fail('E_FETCH');
        }
        const observed = pending.then(
          (value) => {
            counts.pendingFetchKnown = false;
            response = value;
            responseAvailable = true;
            return { kind: 'response', value };
          },
          () => {
            counts.pendingFetchKnown = false;
            return { kind: 'fetch-failed' };
          });
        const outcome = await Promise.race([observed, request, outer]);
        if (outcome.kind === 'deadline') fail(outcome.code);
        if (outcome.kind !== 'response') fail('E_FETCH');
        try {
          captureBody();
        } catch { fail('E_RESPONSE'); }
        guard();
        if (body !== null) fail('E_BODY');
        let metadata;
        try {
          const responseUrl = response.url;
          const statusCode = response.status;
          const responseType = response.type;
          const redirected = response.redirected;
          if (responseUrl !== URL || !Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599 ||
              !['basic', 'default'].includes(responseType) || redirected !== false) fail('E_RESPONSE');
          metadata = { requestedUrl: URL, responseUrl, statusCode, responseType, redirected, method: 'HEAD' };
        } catch { fail('E_RESPONSE'); }
        const headers = readHeaders(response.headers, guard);
        guard();
        clearTimers();
        if (cleanupUncertain) fail('E_CLEANUP');
        guard();
        const result = publish(0, {
          scope: 'HEAD_METADATA_DATA', profile: PROFILE, mockOnly, ...metadata, ...headers,
          responseBodyNullObserved: true,
          readerRelease: 'NOT_APPLICABLE_NO_READER',
          headerBytesMeaning: 'UTF-8 sum of exposed names and values; no separators; not raw wire framing',
          sourceRef: BOOTLIN_GCC_COPYING_HEAD_V1_POLICY.sourceRef,
          ...FLAGS,
          counts: { ...counts }, cleanupUncertain: false,
        });
        guard();
        return result;
      } catch (error) {
        const code = error instanceof HeadFault ? error.code : 'E_RESPONSE';
        if (code === 'E_CLOCK' || code === 'E_TIMER') cleanupUncertain = true;
        await cleanup();
        return stopped(code, counts, cleanupUncertain, mockOnly);
      }
    },
  });
}

const PRODUCTION = createCollector({
  fetch: (url, options) => Reflect.apply(FETCH, globalThis, [url, options]),
  now: () => Reflect.apply(NOW, CLOCK, []),
  setTimeout: (callback, delay) => Reflect.apply(SET_TIMEOUT, globalThis, [callback, delay]),
  clearTimeout: (timer) => Reflect.apply(CLEAR_TIMEOUT, globalThis, [timer]),
}, false);

export async function collectRegisteredBootlinGccCopyingHeadV1() {
  return Reflect.apply(PRODUCTION.run, undefined, arguments);
}

export function createBootlinGccCopyingHeadFixture(config, dependencies) {
  if (arguments.length !== 2) fail('E_ARGUMENTS');
  return createCollector(validateFixture(config, dependencies), true);
}
