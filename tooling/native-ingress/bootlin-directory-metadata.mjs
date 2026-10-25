// SPEC: _spec/tooling/native-ingress/step2.puml
import { createHash } from 'node:crypto';
import { types } from 'node:util';

const FETCH = globalThis.fetch;
const NOW = performance.now;
const CLOCK = performance;
const SET_TIMEOUT = globalThis.setTimeout;
const CLEAR_TIMEOUT = globalThis.clearTimeout;
const Controller = globalThis.AbortController;
const Decoder = globalThis.TextDecoder;
const PROFILE = 'registered-bootlin-directories-v1';
const faults = new WeakMap();
const TYPED = Object.getPrototypeOf(Uint8Array.prototype);
const LENGTH = Object.getOwnPropertyDescriptor(TYPED, 'length').get;
const BACKING = Object.getOwnPropertyDescriptor(TYPED, 'buffer').get;
const OFFSET = Object.getOwnPropertyDescriptor(TYPED, 'byteOffset').get;
const ARRAY_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const RESIZABLE = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;

function fail(code) {
  const error = new Error(code);
  faults.set(error, code);
  throw error;
}

const check = (condition, code) => { if (!condition) fail(code); };
const codeOf = (error, fallback) => faults.get(error) ?? fallback;
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export const BOOTLIN_DIRECTORY_METADATA_V1_PROFILE = freeze({
  profile: PROFILE,
  urls: [
    'https://toolchains.bootlin.com/downloads/releases/sources/',
    'https://toolchains.bootlin.com/downloads/releases/licenses/',
  ],
  roles: ['sources', 'licenses'],
  limits: {
    requests: 2, headerPairs: 64, headerBytes: 16384,
    bodyBytes: 65536, aggregateBodyBytes: 131072,
    readsPerResponse: 1024, aggregateReads: 2048,
    requestMilliseconds: 10000, workMilliseconds: 27000,
    totalMilliseconds: 30000, cleanupReserveMilliseconds: 3000,
    outputBytes: 1048576, outputDepth: 64, outputNodes: 100000,
  },
  sourceRef: {
    spec: '_spec/tooling/native-ingress/step2.puml',
    registration: '33',
    preparationBytes: 2724242,
    preparationSha256: '3ae1a4949a913b972695a32dfab2076354e49a70a960021a34050c63a9bb281b',
    rootReadmeBytes: 1093,
    rootReadmeSha256: 'fa0b24cb67e660a5aebe2f4d4705b5a7ca2e5860e2e0405ddf6fddad40d4a41a',
    schemeSelection: 'fixed-https-upgrade-not-extracted-url',
    scope: 'ordinary-necessary-toolchain-preparation-directory-metadata',
    lifecycle: 'outside-offline-capture-build-runtime',
  },
});
const POLICY = BOOTLIN_DIRECTORY_METADATA_V1_PROFILE;
const LIMIT = POLICY.limits;
const QUALIFICATIONS = freeze({
  sourceAuthenticated: false, publisherAuthenticated: false,
  sourceRootAuthentication: false, licenseComplianceVerified: false,
  pythonFreeSubsetVerified: false, runtimeProvidersQualified: false,
  abiVerified: false, imagePrepared: false, nativeQualified: false,
  rustReady: false, trainingReady: false, hardDeadlineGuaranteed: false,
  hardRssBounded: false, wireByteBounded: false, rawWireHeadersObserved: false,
  transportClosureVerified: false, ioIsolated: false,
  secureErasureVerified: false,
});

function ownShape(value, keys) {
  check(value && typeof value === 'object' && !types.isProxy(value), 'E_MOCK_TCB');
  check([Object.prototype, null].includes(Object.getPrototypeOf(value)), 'E_MOCK_TCB');
  const names = Reflect.ownKeys(value);
  check(names.length === keys.length && names.every(key => keys.includes(key)), 'E_MOCK_TCB');
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    check(descriptor && Object.hasOwn(descriptor, 'value'), 'E_MOCK_TCB');
    result[key] = descriptor.value;
  }
  return result;
}

function outputPreflight(data) {
  let nodes = 0;
  const seen = new WeakSet();
  function visit(value, depth) {
    check(++nodes <= LIMIT.outputNodes && depth <= LIMIT.outputDepth, 'E_LIMIT');
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
    if (typeof value === 'number') { check(Number.isSafeInteger(value), 'E_LIMIT'); return; }
    check(value && typeof value === 'object' && !types.isProxy(value), 'E_LIMIT');
    check(!seen.has(value), 'E_LIMIT');
    seen.add(value);
    check([Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(value)), 'E_LIMIT');
    for (const key of Reflect.ownKeys(value)) {
      check(typeof key === 'string' && key !== 'toJSON', 'E_LIMIT');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      check(descriptor && Object.hasOwn(descriptor, 'value'), 'E_LIMIT');
      visit(descriptor.value, depth + 1);
    }
    seen.delete(value);
  }
  visit(data, 0);
  const ascii = JSON.stringify(data).replace(/[\u007f-\uffff]/g,
    character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`) + '\n';
  check(ascii.length <= LIMIT.outputBytes, 'E_LIMIT');
}

function byteView(value) {
  check(value && !types.isProxy(value) && types.isUint8Array(value), 'E_BODY');
  check([Uint8Array.prototype, Buffer.prototype].includes(Object.getPrototypeOf(value)), 'E_BODY');
  for (const key of ['length', 'byteLength', 'buffer', 'byteOffset']) {
    check(!Object.getOwnPropertyDescriptor(value, key), 'E_BODY');
  }
  try {
    const backing = BACKING.call(value);
    ARRAY_LENGTH.call(backing);
    check(!RESIZABLE?.call(backing), 'E_BODY');
    return new Uint8Array(backing, OFFSET.call(value), LENGTH.call(value));
  } catch { fail('E_BODY'); }
}

function readResult(value) {
  check(value && typeof value === 'object' && !types.isProxy(value), 'E_BODY');
  const done = Object.getOwnPropertyDescriptor(value, 'done');
  const item = Object.getOwnPropertyDescriptor(value, 'value');
  check(done && Object.hasOwn(done, 'value') && typeof done.value === 'boolean', 'E_BODY');
  check(!item || Object.hasOwn(item, 'value'), 'E_BODY');
  check(!done.value || !item || item.value === undefined, 'E_BODY');
  check(done.value || item, 'E_BODY');
  return { done: done.value, value: item?.value };
}

function headersOf(response) {
  check(response && typeof response === 'object' && !types.isProxy(response), 'E_HEADERS');
  check(response.status === 200 && response.redirected === false, 'E_HEADERS');
  check(['basic', 'default'].includes(response.type), 'E_HEADERS');
  const headers = response.headers;
  check(headers && !types.isProxy(headers) && typeof headers[Symbol.iterator] === 'function', 'E_HEADERS');
  const iterator = headers[Symbol.iterator]();
  check(iterator && !types.isProxy(iterator) && typeof iterator.next === 'function', 'E_HEADERS');
  const pairs = [], selected = new Map();
  let total = 0;
  for (;;) {
    const next = iterator.next();
    check(next && typeof next === 'object' && !types.isProxy(next), 'E_HEADERS');
    const done = Object.getOwnPropertyDescriptor(next, 'done');
    const item = Object.getOwnPropertyDescriptor(next, 'value');
    check(done && Object.hasOwn(done, 'value') && typeof done.value === 'boolean', 'E_HEADERS');
    if (done.value) break;
    check(item && Object.hasOwn(item, 'value'), 'E_HEADERS');
    check(pairs.length < LIMIT.headerPairs, 'E_LIMIT');
    const pair = item.value;
    check(Array.isArray(pair) && !types.isProxy(pair) && pair.length === 2, 'E_HEADERS');
    const first = Object.getOwnPropertyDescriptor(pair, '0');
    const second = Object.getOwnPropertyDescriptor(pair, '1');
    check(first && second && Object.hasOwn(first, 'value') && Object.hasOwn(second, 'value'), 'E_HEADERS');
    const name = first.value, value = second.value;
    check(typeof name === 'string' && typeof value === 'string', 'E_HEADERS');
    check(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name), 'E_HEADERS');
    check(!/[\x00-\x1f\x7f-\x9f]/u.test(value), 'E_HEADERS');
    check(name.length <= LIMIT.headerBytes && value.length <= LIMIT.headerBytes, 'E_LIMIT');
    const nameBytes = Buffer.from(name, 'utf8'), valueBytes = Buffer.from(value, 'utf8');
    check(valueBytes.toString('utf8') === value, 'E_HEADERS');
    total += nameBytes.length + valueBytes.length;
    check(total <= LIMIT.headerBytes, 'E_LIMIT');
    pairs.push([name, value]);
    const lower = name.toLowerCase();
    check(!selected.has(lower), 'E_HEADERS');
    selected.set(lower, value);
  }
  check(/^text\/html(?: *; *charset *= *(?:utf-8|utf8))?$/i.test(selected.get('content-type') ?? ''), 'E_HEADERS');
  const encoding = selected.get('content-encoding');
  check(encoding === undefined || /^identity$/i.test(encoding), 'E_HEADERS');
  const declared = selected.get('content-length');
  let length = null;
  if (declared !== undefined) {
    check(/^(0|[1-9][0-9]{0,19})$/.test(declared), 'E_HEADERS');
    length = Number(declared);
    check(Number.isSafeInteger(length) && length <= LIMIT.bodyBytes, 'E_LIMIT');
  }
  return { pairs, length };
}

function collector(dependencies, mockOnly) {
  let consumed = false;
  return async function collectRegisteredBootlinDirectoriesV1(...args) {
    const reused = consumed;
    consumed = true;
    const counts = {
      requestsAttempted: 0, fetchCalls: 0, readAttempts: 0,
      deliveredBytes: 0, retainedBytes: 0, peakDeliveredChunkBytes: 0,
      rejectedChunks: 0, cancellations: 0, releases: 0, eofObservations: 0,
      completedObservations: 0, clearedTimers: 0, activeTimers: 0,
      pendingFetchKnown: false, pendingReadKnown: false,
      transportClosedVerified: false,
    };
    let lastClock, start, workEnd, totalEnd, outer, current;
    let cleanupUncertain = false;
    const timers = [], observations = [];

    function now() {
      let value;
      try { value = dependencies.now(); } catch { fail('E_CLOCK'); }
      check(Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER, 'E_CLOCK');
      check(lastClock === undefined || value >= lastClock, 'E_CLOCK');
      lastClock = value;
      return value;
    }

    function before(end) { check(now() < end, 'E_DEADLINE'); }

    function abort() {
      if (!current?.controller || current.aborted) return;
      current.aborted = true;
      try { current.controller.abort(); } catch { cleanupUncertain = true; }
    }

    function arm(end) {
      const remaining = end - now();
      check(remaining > 0 && Number.isFinite(remaining), 'E_DEADLINE');
      let reject;
      const timer = { end, active: true, cleared: false, promise: new Promise((_, no) => { reject = no; }) };
      timer.promise.catch(() => {});
      counts.activeTimers++;
      timers.push(timer);
      try {
        timer.handle = dependencies.setTimeout(() => {
          if (timer.cleared) return;
          if (timer.active) { timer.active = false; counts.activeTimers--; }
          abort();
          try { fail('E_DEADLINE'); } catch (error) { reject(error); }
        }, remaining);
      } catch {
        timer.active = false;
        counts.activeTimers--;
        timer.cleared = true;
        cleanupUncertain = true;
        fail('E_CLEANUP');
      }
      return timer;
    }

    function dispose(timer) {
      if (!timer || timer.cleared) return;
      timer.cleared = true;
      try {
        const result = dependencies.clearTimeout(timer.handle);
        if (result !== undefined) {
          Promise.resolve(result).catch(() => {});
          fail('E_CLEANUP');
        }
        counts.clearedTimers++;
        if (timer.active) { timer.active = false; counts.activeTimers--; }
      } catch { cleanupUncertain = true; fail('E_CLEANUP'); }
    }

    async function wait(action, timer, fallback, pending) {
      before(timer.end);
      let operation;
      try { operation = Promise.resolve(action()); }
      catch (error) { fail(codeOf(error, fallback)); }
      operation.catch(() => {});
      if (pending) {
        counts[pending] = true;
        operation.then(() => { counts[pending] = false; }, () => { counts[pending] = false; });
      }
      let result;
      try { result = await Promise.race([operation, timer.promise, outer.promise]); }
      catch (error) { fail(codeOf(error, fallback)); }
      before(timer.end);
      return result;
    }

    function release(context) {
      if (!context.reader || context.released) return;
      context.released = true;
      counts.releases++;
      try {
        const result = context.reader.releaseLock();
        if (result !== undefined) {
          Promise.resolve(result).catch(() => {});
          fail('E_CLEANUP');
        }
      }
      catch { cleanupUncertain = true; fail('E_CLEANUP'); }
    }

    async function cleanup(context) {
      abort();
      if (context && !context.eof && !context.cancelled) {
        context.cancelled = true;
        try {
          const target = context.reader ?? context.body ?? context.response?.body;
          if (target) {
            counts.cancellations++;
            const operation = Promise.resolve(target.cancel());
            operation.catch(() => {});
            if (!outer) { cleanupUncertain = true; }
            else {
              before(totalEnd);
              await Promise.race([operation, outer.promise]);
              before(totalEnd);
            }
          }
        } catch { cleanupUncertain = true; }
      }
      try { if (context) release(context); } catch { cleanupUncertain = true; }
      for (const timer of timers) {
        try { dispose(timer); } catch { cleanupUncertain = true; }
      }
      if (counts.pendingFetchKnown || counts.pendingReadKnown) cleanupUncertain = true;
    }

    async function directory(index) {
      before(workEnd);
      const requestStart = now();
      check(requestStart <= Number.MAX_SAFE_INTEGER - LIMIT.requestMilliseconds, 'E_CLOCK');
      const context = { controller: new Controller(), eof: false, released: false, cancelled: false };
      current = context;
      const timer = arm(Math.min(requestStart + LIMIT.requestMilliseconds, workEnd));
      const url = POLICY.urls[index];
      counts.requestsAttempted++;
      context.response = await wait(() => {
        counts.fetchCalls++;
        return Promise.resolve(dependencies.fetch(url, {
          method: 'GET', redirect: 'manual', credentials: 'omit', cache: 'no-store',
          referrer: '', referrerPolicy: 'no-referrer',
          headers: { Accept: 'text/html', 'Accept-Encoding': 'identity' },
          signal: context.controller.signal,
        })).then(response => { context.response = response; return response; });
      }, timer, 'E_FETCH', 'pendingFetchKnown');
      let metadata;
      try {
        metadata = headersOf(context.response);
        check(context.response.url === url, 'E_HEADERS');
      } catch (error) { fail(codeOf(error, 'E_HEADERS')); }
      before(timer.end);
      try {
        context.body = context.response.body;
        check(context.body && !types.isProxy(context.body), 'E_BODY');
        context.reader = context.body.getReader();
        check(context.reader && !types.isProxy(context.reader), 'E_BODY');
      } catch (error) { fail(codeOf(error, 'E_BODY')); }
      const chunks = [];
      let bytes = 0, reads = 0;
      for (;;) {
        check(reads < LIMIT.readsPerResponse && counts.readAttempts < LIMIT.aggregateReads, 'E_LIMIT');
        reads++;
        counts.readAttempts++;
        const item = readResult(await wait(() => context.reader.read(), timer, 'E_BODY', 'pendingReadKnown'));
        if (item.done) {
          context.eof = true;
          counts.eofObservations++;
          break;
        }
        const chunk = byteView(item.value), length = chunk.byteLength;
        check(Number.isSafeInteger(length) && length >= 0, 'E_BODY');
        check(counts.deliveredBytes <= Number.MAX_SAFE_INTEGER - length, 'E_LIMIT');
        counts.deliveredBytes += length;
        counts.peakDeliveredChunkBytes = Math.max(counts.peakDeliveredChunkBytes, length);
        if (length > LIMIT.bodyBytes - bytes || length > LIMIT.aggregateBodyBytes - counts.retainedBytes) {
          counts.rejectedChunks++;
          fail('E_LIMIT');
        }
        chunks.push(Buffer.from(chunk));
        bytes += length;
        counts.retainedBytes += length;
        before(timer.end);
      }
      check(metadata.length === null || metadata.length === bytes, 'E_BODY');
      before(timer.end);
      const body = Buffer.concat(chunks, bytes);
      let text;
      try { text = new Decoder('utf-8', { fatal: true, ignoreBOM: true }).decode(body); }
      catch { fail('E_UTF8'); }
      check(!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(text), 'E_UTF8');
      check(Buffer.from(text, 'utf8').equals(body), 'E_UTF8');
      const bodySha256 = createHash('sha256').update(body).digest('hex');
      before(timer.end);
      release(context);
      before(timer.end);
      dispose(timer);
      before(timer.end);
      observations.push({
        role: POLICY.roles[index], requestedUrl: url, responseUrl: url, status: 200,
        exposedHeaders: metadata.pairs, observedBodyBytes: bytes, bodySha256, bodyUtf8: text,
        eof: true, utf8Validated: true, urlsFollowed: false, interpreted: false,
        sourceKind: 'PUBLIC_DIRECTORY_METADATA', sourceAuthenticated: false,
        licenseComplianceVerified: false,
      });
      counts.completedObservations++;
      current = undefined;
    }

    try {
      check(!reused && args.length === 0, 'E_ARGUMENTS');
      start = now();
      check(start <= Number.MAX_SAFE_INTEGER - LIMIT.totalMilliseconds, 'E_CLOCK');
      workEnd = start + LIMIT.workMilliseconds;
      totalEnd = start + LIMIT.totalMilliseconds;
      outer = arm(totalEnd);
      await directory(0);
      await directory(1);
      before(workEnd);
      const data = {
        profile: PROFILE, status: 'BOOTLIN_DIRECTORY_METADATA', mockOnly,
        policyRefs: POLICY.sourceRef, counts, cleanupUncertain: false,
        ...QUALIFICATIONS, observations,
      };
      dispose(outer);
      check(counts.activeTimers === 0 && !cleanupUncertain, 'E_CLEANUP');
      data.counts = { ...counts };
      outputPreflight(data);
      before(workEnd);
      return freeze({ exitCode: 0, data });
    } catch (error) {
      const code = codeOf(error, 'E_BODY');
      observations.length = 0;
      await cleanup(current);
      const data = { profile: PROFILE, status: 'STOP', mockOnly, error: code, counts: { ...counts }, cleanupUncertain };
      outputPreflight(data);
      return freeze({ exitCode: 1, data });
    }
  };
}

const production = collector({
  fetch: (...args) => Reflect.apply(FETCH, globalThis, args),
  now: () => Reflect.apply(NOW, CLOCK, []),
  setTimeout: (...args) => Reflect.apply(SET_TIMEOUT, globalThis, args),
  clearTimeout: (...args) => Reflect.apply(CLEAR_TIMEOUT, globalThis, args),
}, false);

export async function collectRegisteredBootlinDirectoriesV1(...args) {
  return production(...args);
}

export function createBootlinDirectoryMetadataFixture(configuration, dependencies) {
  check(arguments.length === 2, 'E_MOCK_TCB');
  const config = ownShape(configuration, ['mockOnly']);
  check(config.mockOnly === true, 'E_MOCK_TCB');
  const supplied = ownShape(dependencies, ['fetch', 'now', 'setTimeout', 'clearTimeout']);
  const globals = [FETCH, NOW, SET_TIMEOUT, CLEAR_TIMEOUT,
    globalThis.fetch, performance.now, globalThis.setTimeout, globalThis.clearTimeout];
  for (const method of Object.values(supplied)) {
    check(typeof method === 'function' && !types.isProxy(method) && !globals.includes(method), 'E_MOCK_TCB');
  }
  const bound = {};
  for (const key of Object.keys(supplied)) bound[key] = (...args) => Reflect.apply(supplied[key], dependencies, args);
  return Object.freeze({ run: collector(bound, true) });
}
