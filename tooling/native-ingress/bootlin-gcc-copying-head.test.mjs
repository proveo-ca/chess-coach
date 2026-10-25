// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  BOOTLIN_GCC_COPYING_HEAD_V1_POLICY as policy,
  collectRegisteredBootlinGccCopyingHeadV1,
  createBootlinGccCopyingHeadFixture as createFixture,
} from './bootlin-gcc-copying-head.mjs';

const URL = 'https://toolchains.bootlin.com/downloads/releases/licenses/gcc-final-15.3.0/COPYING';
const source = await readFile(new globalThis.URL('./bootlin-gcc-copying-head.mjs', import.meta.url), 'utf8');
const NOW_LITERAL = 'now: () => Reflect.apply(NOW, CLOCK, []),';
const BRIDGE = `
let SOURCE_PARENT_ORIGIN = null, SOURCE_FIRST_CLOCK = true;
export function SOURCE_BIND_PARENT_CLOCK_ORIGIN(origin) {
  if (arguments.length !== 1 || SOURCE_PARENT_ORIGIN !== null || !Number.isFinite(origin) || origin < 0 || origin > Number.MAX_SAFE_INTEGER - 30000) fail('E_CLOCK');
  const current = Reflect.apply(NOW, CLOCK, []);
  if (!Number.isFinite(current) || current < origin || current - origin >= 10000) fail('E_CLOCK');
  SOURCE_PARENT_ORIGIN = origin;
}
function SOURCE_CAPTURE_NOW() {
  if (SOURCE_PARENT_ORIGIN === null) fail('E_CLOCK');
  const current = Reflect.apply(NOW, CLOCK, []);
  if (!Number.isFinite(current) || current < SOURCE_PARENT_ORIGIN) fail('E_CLOCK');
  if (SOURCE_FIRST_CLOCK) { SOURCE_FIRST_CLOCK = false; return SOURCE_PARENT_ORIGIN; }
  return current;
}
`;
let imageId = 0;

async function privateImage({ bridge = true } = {}) {
  const prefix = `
const TEST_STATE = { time: 9000, calls: [], timers: [], cleared: [], reads: 0, pending: false, bodyPending: false, cancelCalls: 0 };
const TEST_TCB = {
  fetch(url, options) {
    TEST_STATE.calls.push([url, options]);
    if (TEST_STATE.pending) return new Promise(() => {});
    const body = TEST_STATE.bodyPending ? { cancel() { TEST_STATE.cancelCalls++; return new Promise(() => {}); } } : null;
    return Promise.resolve({ body, url, status: 200, type: 'basic', redirected: false, headers: [] });
  },
  clock: { now() { TEST_STATE.reads++; return TEST_STATE.time; } },
  setTimeout(callback, delay) { const timer = { callback, delay }; TEST_STATE.timers.push(timer); return timer; },
  clearTimeout(timer) { TEST_STATE.cleared.push(timer); },
};
`;
  const replacements = [
    ['const FETCH = globalThis.fetch;', 'const FETCH = TEST_TCB.fetch;'],
    ['const CLOCK = globalThis.performance;', 'const CLOCK = TEST_TCB.clock;'],
    ['const NOW = CLOCK.now;', 'const NOW = TEST_TCB.clock.now;'],
    ['const SET_TIMEOUT = globalThis.setTimeout;', 'const SET_TIMEOUT = TEST_TCB.setTimeout;'],
    ['const CLEAR_TIMEOUT = globalThis.clearTimeout;', 'const CLEAR_TIMEOUT = TEST_TCB.clearTimeout;'],
  ];
  let instrumented = source;
  for (const [before, after] of replacements) {
    assert.equal(instrumented.split(before).length - 1, 1);
    instrumented = instrumented.replace(before, after);
  }
  assert.equal(instrumented.split(NOW_LITERAL).length - 1, 1);
  if (bridge) instrumented = instrumented.replace(NOW_LITERAL, 'now: () => SOURCE_CAPTURE_NOW(),');
  const moduleSource = prefix + instrumented + (bridge ? BRIDGE : '') +
    `\nexport { TEST_STATE, TEST_TCB, outputFrame as TEST_outputFrame };\n// TEST IMAGE ${imageId++}\n`;
  return import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);
}

function forbiddenReaders(object) {
  for (const key of ['getReader', 'read', 'text', 'json', 'arrayBuffer', 'blob', 'formData', 'bytes', 'values', 'pipeTo', 'pipeThrough']) {
    Object.defineProperty(object, key, { get() { assert.fail(`forbidden API: ${key}`); } });
  }
  return object;
}

function response(overrides = {}) {
  return forbiddenReaders({ body: null, url: URL, status: 200, type: 'basic', redirected: false, headers: [], ...overrides });
}

function fake(settings = {}) {
  const state = {
    time: settings.time ?? 0, reads: 0, calls: [], scheduled: [], cleared: [], timers: new Map(), nextId: 1,
  };
  const deps = {
    fetch(url, options) {
      state.calls.push([url, options]);
      return settings.fetch ? settings.fetch(url, options, state) : Promise.resolve(settings.response ?? response());
    },
    now() {
      state.reads++;
      return settings.now ? settings.now(state) : state.time;
    },
    setTimeout(callback, delay) {
      if (settings.setTimeout) return settings.setTimeout(callback, delay, state);
      const id = state.nextId++;
      const timer = { id, callback, delay, due: state.time + delay };
      state.timers.set(id, timer);
      state.scheduled.push(timer);
      return id;
    },
    clearTimeout(id) {
      state.cleared.push(id);
      if (settings.clearTimeout) return settings.clearTimeout(id, state);
      state.timers.delete(id);
    },
  };
  state.advance = (time) => {
    assert.ok(time >= state.time);
    state.time = time;
    for (const timer of [...state.timers.values()].sort((a, b) => a.due - b.due)) {
      if (timer.due <= time && state.timers.has(timer.id)) {
        state.timers.delete(timer.id);
        timer.callback();
      }
    }
  };
  return { state, deps, fixture: createFixture({ mockOnly: true }, deps) };
}

async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function assertStop(result, code) {
  assert.equal(result.exitCode, 1);
  assert.equal(result.data.scope, 'STOP');
  assert.equal(result.data.code, code);
  assert.equal(Object.hasOwn(result.data, 'exposedHeaders'), false);
  assert.equal(Object.hasOwn(result.data, 'responseUrl'), false);
  assert.equal(result.data.counts.authoredBodyReads, 0);
  assert.equal(result.data.counts.releaseCalls, 0);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.data.counts));
}

function assertData(result) {
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.scope, 'HEAD_METADATA_DATA');
  assert.equal(result.data.responseBodyNullObserved, true);
  assert.equal(result.data.counts.authoredBodyReads, 0);
  assert.equal(result.data.counts.releaseCalls, 0);
  assert.equal(result.data.counts.cancelCalls, 0);
  assert.equal(result.data.counts.abortCalls, 0);
  assert.equal(result.data.counts.pendingFetchKnown, false);
  assert.equal(result.data.counts.activeTimers, 0);
  assert.equal(result.data.counts.timersCreated, 2);
  assert.equal(result.data.counts.timersCleared, 2);
  assert.equal(result.data.cleanupUncertain, false);
}

test('fixed policy includes bounds, historical identity, and no qualification', () => {
  assert.equal(policy.profile, 'registered-bootlin-gcc-copying-head-v1');
  assert.equal(policy.clientKey, policy.profile);
  assert.equal(policy.method, 'HEAD');
  assert.equal(policy.requestedUrl, URL);
  for (const [key, value] of Object.entries({ maxRequests: 1, exposedHeaders: 64, totalHeaderUtf8Bytes: 16384,
    outputAsciiBytes: 65536, depth: 64, nodes: 100000, requestMs: 10000, workMs: 27000, totalMs: 30000, cleanupMs: 3000 })) {
    assert.equal(policy[key], value);
  }
  assert.equal(policy.sourceRef.contextBytes, 14690);
  assert.equal(policy.sourceRef.contextSha256, 'b020748b1a6cae8254e82486821682d79e747918a8a0128a897fa33c94806c7b');
  assert.equal(policy.sourceRef.licenseBodyBytes, 1867);
  assert.equal(policy.sourceRef.licenseBodySha256, 'bc44d5fff09beba4b68c3ad6ac6ae914e26f8174f32c85322c721f0f355f8f1c');
  assert.equal(policy.sourceRef.copyingHref, URL);
  assert.ok(Object.values(policy.qualifications).every((value) => value === false));
  const visit = (value) => {
    assert.ok(Object.isFrozen(value));
    for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child);
  };
  visit(policy);
});

test('exact single HEAD request has no body, auth, cookie, or follow capability', async () => {
  const { fixture, state } = fake();
  const result = await fixture.run();
  assertData(result);
  assert.equal(state.calls.length, 1);
  const [url, options] = state.calls[0];
  assert.equal(url, URL);
  assert.deepEqual(Object.keys(options).sort(), ['cache', 'credentials', 'headers', 'method', 'redirect', 'referrer', 'referrerPolicy', 'signal'].sort());
  assert.deepEqual({ ...options, signal: undefined }, {
    method: 'HEAD', redirect: 'manual', credentials: 'omit', cache: 'no-store',
    referrer: '', referrerPolicy: 'no-referrer', headers: { Accept: '*/*', 'Accept-Encoding': 'identity' }, signal: undefined,
  });
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(options.signal.aborted, false);
  assert.deepEqual(state.scheduled.map((timer) => timer.delay), [30000, 10000]);
  assert.equal(state.timers.size, 0);
  assert.equal(result.data.counts.requests, 1);
  assert.equal(result.data.counts.fetchCalls, 1);
});

for (const status of [100, 101, 199, 200, 204, 299, 301, 302, 307, 308, 399, 404, 418, 500, 599]) {
  test(`HTTP ${status} is passive metadata without following Location`, async () => {
    const { fixture, state } = fake({ response: response({ status, headers: [['Location', 'https://example.invalid/never-follow']] }) });
    const result = await fixture.run();
    assertData(result);
    assert.equal(result.data.statusCode, status);
    assert.deepEqual(result.data.exposedHeaders, [['Location', 'https://example.invalid/never-follow']]);
    assert.equal(state.calls.length, 1);
  });
}

for (const status of [99, 600, 200.1, '200', null, undefined, NaN, Infinity]) {
  test(`invalid status ${String(status)} stops without exposing metadata`, async () => {
    assertStop(await fake({ response: response({ status }) }).fixture.run(), 'E_RESPONSE');
  });
}

for (const type of ['basic', 'default']) {
  test(`response type ${type} is observed`, async () => {
    assertData(await fake({ response: response({ type }) }).fixture.run());
  });
}

for (const overrides of [
  { url: `${URL}?other` }, { url: '' }, { url: URL.replace('https:', 'http:') },
  { redirected: true }, { redirected: undefined }, { redirected: 0 },
  { type: 'opaque' }, { type: 'opaqueredirect' }, { type: 'error' },
]) {
  test(`invalid response identity ${JSON.stringify(overrides)}`, async () => {
    assertStop(await fake({ response: response(overrides) }).fixture.run(), 'E_RESPONSE');
  });
}

test('MIME, charset, content length, and controls remain uninterpreted ordered data', async () => {
  const headers = [
    ['Content-Type', 'application/x-unknown; charset=unsupported'],
    ['Content-Length', '-1, nonsense; 999999999999999999999999999999'],
    ['X-Control', '\0\r\n\t\u0001\u007f é😀'],
  ];
  const result = await fake({ response: response({ headers }) }).fixture.run();
  assertData(result);
  assert.deepEqual(result.data.exposedHeaders, headers);
  assert.equal(result.data.headerBytes, headers.reduce((sum, pair) => sum + Buffer.byteLength(pair[0]) + Buffer.byteLength(pair[1]), 0));
  assert.equal(result.data.exposedHeaderCount, 3);
  for (const key of Object.keys(policy.qualifications)) assert.equal(result.data[key], false);
  assert.match(result.data.headerBytesMeaning, /no separators; not raw wire/);
});

test('body getter is called exactly once and forbidden response readers stay untouched', async () => {
  let reads = 0;
  const value = response();
  Object.defineProperty(value, 'body', { get() { reads++; return null; } });
  assertData(await fake({ response: value }).fixture.run());
  assert.equal(reads, 1);
});

test('native Response and Headers prototype getters are allowed without own-property requirements', async () => {
  const value = new Response(null, { status: 200, headers: { 'X-Native': 'observed' } });
  Object.defineProperty(value, 'url', { value: URL });
  const result = await fake({ response: value }).fixture.run();
  assertData(result);
  assert.equal(result.data.responseType, 'default');
  assert.deepEqual(result.data.exposedHeaders, [['x-native', 'observed']]);
});

test('nonnull body is aborted and cancelled once with no reader acquisition', async () => {
  let cancels = 0;
  const body = forbiddenReaders({ cancel() { cancels++; return Promise.resolve(); } });
  const { fixture, state } = fake({ response: response({ body }) });
  const result = await fixture.run();
  assertStop(result, 'E_BODY');
  assert.equal(cancels, 1);
  assert.equal(result.data.counts.cancelCalls, 1);
  assert.equal(result.data.counts.abortCalls, 1);
  assert.equal(result.data.cleanupUncertain, false);
  assert.equal(state.calls[0][1].signal.aborted, true);
  assert.equal(state.timers.size, 0);
});

test('nonsettling cancellation uses original total deadline, not a renewed cleanup window', async () => {
  let cancels = 0;
  const body = forbiddenReaders({ cancel() { cancels++; return new Promise(() => {}); } });
  const { fixture, state } = fake({ response: response({ body }), time: 0 });
  const pending = fixture.run();
  await flush();
  assert.equal(cancels, 1);
  state.advance(10000);
  await flush();
  let settled = false;
  pending.then(() => { settled = true; });
  await flush();
  assert.equal(settled, false);
  state.advance(29999);
  await flush();
  assert.equal(settled, false);
  state.advance(30000);
  const result = await pending;
  assertStop(result, 'E_BODY');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(result.data.counts.abortCalls, 1);
  assert.deepEqual(state.scheduled.map((timer) => timer.delay), [30000, 10000]);
  assert.equal(state.timers.size, 0);
});

test('body arriving at 27000 cancels inside only the original remaining 3000 ms', async () => {
  let resolveFetch;
  let cancels = 0;
  const { fixture, state } = fake({ fetch: () => new Promise((resolve) => { resolveFetch = resolve; }) });
  const pending = fixture.run();
  state.time = 27000;
  resolveFetch(response({ body: forbiddenReaders({ cancel() { cancels++; return new Promise(() => {}); } }) }));
  await flush();
  assert.equal(cancels, 1);
  state.advance(30000);
  const result = await pending;
  assertStop(result, 'E_WORK_DEADLINE');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(state.scheduled.length, 2);
});

for (const cancel of [() => { throw new Error('SECRET-CANCEL'); }, () => Promise.reject(new Error('SECRET-CANCEL')), null]) {
  test(`cancellation failure ${String(cancel)} stays bounded and filtered`, async () => {
    const result = await fake({ response: response({ body: forbiddenReaders({ cancel }) }) }).fixture.run();
    assertStop(result, 'E_BODY');
    assert.equal(result.data.cleanupUncertain, true);
    assert.equal(JSON.stringify(result).includes('SECRET'), false);
  });
}

test('throwing body getter does not infer absence or serialize its exception', async () => {
  const value = response();
  Object.defineProperty(value, 'body', { get() { throw new Error('SECRET-BODY'); } });
  const result = await fake({ response: value }).fixture.run();
  assertStop(result, 'E_RESPONSE');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
});

for (const value of [null, undefined, 7, 'response', new Proxy({}, { get(target, key) {
  if (key === 'then') return undefined;
  assert.fail('response proxy invoked');
} })]) {
  test(`malformed response ${typeof value} stops with uncertain cleanup`, async () => {
    const result = await fake({ fetch: () => Promise.resolve(value) }).fixture.run();
    assertStop(result, 'E_RESPONSE');
    assert.equal(result.data.cleanupUncertain, true);
  });
}

for (const [name, value] of [['x', '\ud800'], ['x', '\udc00'], ['x', 'before\ud800after'], ['bad name', 'v'], ['', 'v'], ['é', 'v'], ['x\r', 'v'], ['x', 5], [3, 'v']]) {
  test(`invalid header pair ${JSON.stringify([name, value])}`, async () => {
    assertStop(await fake({ response: response({ headers: [[name, value]] }) }).fixture.run(), 'E_HEADERS');
  });
}

test('all valid HTTP token characters and empty value are captured', async () => {
  assertData(await fake({ response: response({ headers: [["!#$%&'*+.^_`|~012AZaz-", '']] }) }).fixture.run());
});

test('case-insensitive duplicate names withhold all headers', async () => {
  const result = await fake({ response: response({ headers: [['X-One', 'secret'], ['x-one', 'two']] }) }).fixture.run();
  assertStop(result, 'E_HEADERS');
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

for (const count of [0, 64, 65]) {
  test(`header count boundary ${count}`, async () => {
    const headers = Array.from({ length: count }, (_, i) => [`x-${i}`, 'v']);
    const result = await fake({ response: response({ headers }) }).fixture.run();
    if (count <= 64) {
      assertData(result);
      assert.equal(result.data.exposedHeaderCount, count);
    } else assertStop(result, 'E_HEADERS');
  });
}

for (const bytes of [16383, 16384, 16385]) {
  test(`UTF-8 cumulative header bytes ${bytes}`, async () => {
    const result = await fake({ response: response({ headers: [['x', 'a'.repeat(bytes - 1)]] }) }).fixture.run();
    if (bytes <= 16384) {
      assertData(result);
      assert.equal(result.data.headerBytes, bytes);
    } else assertStop(result, 'E_HEADERS');
  });
}

test('multibyte UTF-8 total counts bytes rather than code units', async () => {
  const accepted = await fake({ response: response({ headers: [['x', 'é'.repeat(8191) + 'a']] }) }).fixture.run();
  assertData(accepted);
  assert.equal(accepted.data.headerBytes, 16384);
  assertStop(await fake({ response: response({ headers: [['x', 'é'.repeat(8192)]] }) }).fixture.run(), 'E_HEADERS');
});

test('byte cap includes all name and value bytes without separators', async () => {
  const headers = [['First', 'a'.repeat(8000)], ['Second', 'b'.repeat(8373)]];
  const result = await fake({ response: response({ headers }) }).fixture.run();
  assertData(result);
  assert.equal(result.data.headerBytes, 16384);
  headers[1][1] += 'x';
  assertStop(await fake({ response: response({ headers }) }).fixture.run(), 'E_HEADERS');
});

test('oversized value is rejected before encoding or retaining any partial headers', async () => {
  const result = await fake({ response: response({ headers: [['first', 'withheld-value'], ['x', 'a'.repeat(16385)]] }) }).fixture.run();
  assertStop(result, 'E_HEADERS');
  assert.equal(JSON.stringify(result).includes('withheld-value'), false);
});

test('oversized header name stops without retaining any headers', async () => {
  assertStop(await fake({ response: response({ headers: [['a'.repeat(16385), '']] }) }).fixture.run(), 'E_HEADERS');
});

test('64th-pair byte failure does not publish the previous 63 pairs', async () => {
  const headers = Array.from({ length: 63 }, (_, i) => [`x-${i}`, 'secret']);
  headers.push(['last', 'v'.repeat(16384)]);
  const result = await fake({ response: response({ headers }) }).fixture.run();
  assertStop(result, 'E_HEADERS');
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('control escaping can exceed output cap despite passing header UTF-8 cap', async () => {
  const result = await fake({ response: response({ headers: [['x', '\0'.repeat(16383)]] }) }).fixture.run();
  assertStop(result, 'E_OUTPUT');
  assert.equal(result.data.cleanupUncertain, false);
  assert.equal(result.data.counts.timersCleared, 2);
});

test('invalid header iterator exception cannot leak data', async () => {
  const headers = { [Symbol.iterator]() { throw new Error('SECRET-HEADERS'); } };
  const result = await fake({ response: response({ headers }) }).fixture.run();
  assertStop(result, 'E_HEADERS');
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
});

test('header pair accessors are rejected without invocation', async () => {
  const pair = ['x', 'v'];
  Object.defineProperty(pair, '1', { get() { assert.fail('pair getter invoked'); } });
  assertStop(await fake({ response: response({ headers: [pair] }) }).fixture.run(), 'E_HEADERS');
});

test('a proxy header container is rejected without traps', async () => {
  const headers = new Proxy({}, { get() { assert.fail('headers proxy invoked'); } });
  assertStop(await fake({ response: response({ headers }) }).fixture.run(), 'E_HEADERS');
});

test('request timeout wins even when fetch ignores abort', async () => {
  const { fixture, state } = fake({ fetch: () => new Promise(() => {}) });
  const pending = fixture.run();
  state.advance(9999);
  await flush();
  let settled = false;
  pending.then(() => { settled = true; });
  await flush();
  assert.equal(settled, false);
  state.advance(10000);
  const result = await pending;
  assertStop(result, 'E_REQUEST_DEADLINE');
  assert.equal(result.data.counts.pendingFetchKnown, true);
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(result.data.counts.abortCalls, 1);
  assert.equal(state.calls[0][1].signal.aborted, true);
  assert.equal(state.timers.size, 0);
});

test('late rejecting fetch is observed and cannot mutate frozen snapshot counts', async () => {
  let rejectFetch;
  const { fixture, state } = fake({ fetch: () => new Promise((resolve, reject) => { rejectFetch = reject; }) });
  const pending = fixture.run();
  state.advance(10000);
  const result = await pending;
  const snapshot = JSON.stringify(result);
  rejectFetch(new Error('LATE-SECRET'));
  await flush();
  assert.equal(JSON.stringify(result), snapshot);
  assert.equal(result.data.counts.pendingFetchKnown, true);
});

test('late resolving fetch is observed without reading its body or changing snapshot', async () => {
  let resolveFetch;
  const { fixture, state } = fake({ fetch: () => new Promise((resolve) => { resolveFetch = resolve; }) });
  const pending = fixture.run();
  state.advance(10000);
  const result = await pending;
  const snapshot = JSON.stringify(result);
  resolveFetch({ get body() { assert.fail('late body inspected'); } });
  await flush();
  assert.equal(JSON.stringify(result), snapshot);
});

test('response already exposed during a timeout race is cancelled once, not abandoned', async () => {
  let resolveFetch;
  let cancels = 0;
  let bodyChecks = 0;
  const value = response();
  Object.defineProperty(value, 'body', { get() {
    bodyChecks++;
    return forbiddenReaders({ cancel() { cancels++; return Promise.resolve(); } });
  } });
  const { fixture, state } = fake({ fetch: () => new Promise((resolve) => { resolveFetch = resolve; }) });
  const pending = fixture.run();
  state.advance(10000);
  resolveFetch(value);
  const result = await pending;
  assertStop(result, 'E_REQUEST_DEADLINE');
  assert.equal(cancels, 1);
  assert.equal(bodyChecks, 1);
  assert.equal(result.data.counts.cancelCalls, 1);
  assert.equal(result.data.counts.abortCalls, 1);
  assert.equal(result.data.cleanupUncertain, false);
});

for (const reject of [false, true]) {
  test(`${reject ? 'rejected' : 'throwing'} fake fetch emits a fixed diagnostic only`, async () => {
    const { fixture } = fake({ fetch() {
      if (reject) return Promise.reject(new Error('SECRET-FETCH'));
      throw new Error('SECRET-FETCH');
    } });
    const result = await fixture.run();
    assertStop(result, 'E_FETCH');
    assert.equal(result.data.counts.pendingFetchKnown, false);
    assert.equal(result.data.cleanupUncertain, true);
    assert.equal(JSON.stringify(result).includes('SECRET'), false);
  });
}

for (const value of [NaN, Infinity, -Infinity, -1, '0', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 29999]) {
  test(`initial invalid or overflowing clock ${String(value)}`, async () => {
    const { fixture, state } = fake({ now: () => value });
    const result = await fixture.run();
    assertStop(result, 'E_CLOCK');
    assert.equal(result.data.cleanupUncertain, true);
    assert.equal(state.calls.length, 0);
  });
}

test('max-safe start minus total window does not overflow', async () => {
  assertData(await fake({ time: Number.MAX_SAFE_INTEGER - 30000 }).fixture.run());
});

test('regressing actual clock stops before fetch', async () => {
  const { fixture, state } = fake({ now: ({ reads }) => reads === 1 ? 10 : 9 });
  const result = await fixture.run();
  assertStop(result, 'E_CLOCK');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(state.calls.length, 0);
});

test('throwing actual clock has a fixed uncertain diagnostic', async () => {
  const { fixture } = fake({ now() { throw new Error('SECRET-CLOCK'); } });
  const result = await fixture.run();
  assertStop(result, 'E_CLOCK');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
});

test('regression after response does not publish DATA', async () => {
  const result = await fake({ now: ({ reads }) => reads < 6 ? 10 : 9 }).fixture.run();
  assertStop(result, 'E_CLOCK');
  assert.equal(result.data.cleanupUncertain, true);
});

for (const [elapsed, code] of [[10000, 'E_REQUEST_DEADLINE'], [27000, 'E_WORK_DEADLINE'], [30000, 'E_TOTAL_DEADLINE']]) {
  test(`post-await actual clock at ${elapsed} enforces original deadline`, async () => {
    assertStop(await fake({ now: ({ reads }) => reads < 6 ? 0 : elapsed }).fixture.run(), code);
  });
}

test('header iteration processing time is guarded before publication', async () => {
  let state;
  const headers = { *[Symbol.iterator]() { yield ['x', 'v']; state.time = 10000; } };
  const setup = fake({ response: response({ headers }) });
  state = setup.state;
  assertStop(await setup.fixture.run(), 'E_REQUEST_DEADLINE');
});

test('clock guard after timer disposal prevents late DATA', async () => {
  const result = await fake({ clearTimeout(id, state) { state.timers.delete(id); state.time = 10000; } }).fixture.run();
  assertStop(result, 'E_REQUEST_DEADLINE');
});

for (const [label, make] of [
  ['fulfilled promise', () => Promise.resolve()],
  ['rejected promise', () => Promise.reject(new Error('SECRET-CLEAR'))],
  ['number', () => 1], ['null', () => null],
]) {
  test(`nonundefined timer disposal ${label} cannot claim clean DATA`, async () => {
    const result = await fake({ clearTimeout: make }).fixture.run();
    assertStop(result, 'E_CLEANUP');
    assert.equal(result.data.cleanupUncertain, true);
    assert.equal(result.data.counts.timersCleared, 0);
  });
}

test('throwing timer disposal is uncertain and filtered', async () => {
  const result = await fake({ clearTimeout() { throw new Error('SECRET-CLEAR'); } }).fixture.run();
  assertStop(result, 'E_CLEANUP');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
});

test('throwing timer setup never starts fetch', async () => {
  const { fixture, state } = fake({ setTimeout() { throw new Error('SECRET-TIMER'); } });
  const result = await fixture.run();
  assertStop(result, 'E_TIMER');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(state.calls.length, 0);
});

test('synchronous timer expiry is checked before authored fetch', async () => {
  const { fixture, state } = fake({ setTimeout(callback) { callback(); return 1; } });
  assertStop(await fixture.run(), 'E_TOTAL_DEADLINE');
  assert.equal(state.calls.length, 0);
});

test('fixture invalid run arguments consume the latch before first await', async () => {
  const { fixture, state } = fake();
  const first = fixture.run(undefined);
  const second = fixture.run();
  assertStop(await first, 'E_ARGUMENTS');
  assertStop(await second, 'E_ONESHOT');
  assert.equal(state.calls.length, 0);
  assert.equal(state.reads, 0);
});

test('fixture reentry consumes synchronously while first fetch is pending', async () => {
  let resolveFetch;
  const { fixture, state } = fake({ fetch: () => new Promise((resolve) => { resolveFetch = resolve; }) });
  const first = fixture.run();
  assertStop(await fixture.run(), 'E_ONESHOT');
  assert.equal(state.calls.length, 1);
  resolveFetch(response());
  assertData(await first);
  assertStop(await fixture.run(), 'E_ONESHOT');
});

test('fixtures have independent one-shot latches', async () => {
  const first = fake();
  const second = fake();
  assertData(await first.fixture.run());
  assertData(await second.fixture.run());
  assertStop(await first.fixture.run(), 'E_ONESHOT');
});

test('unmodified production rejects arguments and consumes latch without invoking fetch', async () => {
  const first = collectRegisteredBootlinGccCopyingHeadV1(undefined);
  const second = collectRegisteredBootlinGccCopyingHeadV1();
  const rejected = await first, reused = await second;
  assertStop(rejected, 'E_ARGUMENTS');
  assertStop(reused, 'E_ONESHOT');
  assert.equal(rejected.data.mockOnly, false);
  assert.equal(reused.data.mockOnly, false);
});

test('fixture success and STOP snapshots carry explicit mock-only identity', async () => {
  const success = await fake().fixture.run();
  const failure = await fake({ response: response({ status: 0 }) }).fixture.run();
  assertData(success); assertStop(failure, 'E_RESPONSE');
  assert.equal(success.data.mockOnly, true);
  assert.equal(failure.data.mockOnly, true);
});

test('passive exposed header values preserve a leading BOM during UTF-8 round trip', async () => {
  const value = '\ufeffraw-header';
  const result = await fake({ response: response({ headers: [['x-passive', value]] }) }).fixture.run();
  assertData(result);
  assert.deepEqual(result.data.exposedHeaders, [['x-passive', value]]);
  assert.equal(result.data.headerBytes, Buffer.byteLength('x-passive' + value, 'utf8'));
});

for (const config of [undefined, null, {}, { mockOnly: false }, { mockOnly: true, url: URL }, { mockOnly: true, profile: 'other' }, Object.create({ mockOnly: true })]) {
  test(`fixture rejects incomplete or overridden config ${JSON.stringify(config)}`, () => {
    assert.throws(() => createFixture(config, fake().deps), { message: 'E_ARGUMENTS' });
  });
}

test('fixture requires exactly two complete own-data arguments', () => {
  const { deps } = fake();
  assert.throws(() => createFixture(), { message: 'E_ARGUMENTS' });
  assert.throws(() => createFixture({ mockOnly: true }), { message: 'E_ARGUMENTS' });
  assert.throws(() => createFixture({ mockOnly: true }, deps, null), { message: 'E_ARGUMENTS' });
  assert.throws(() => createFixture({ mockOnly: true }, { ...deps, extra: true }), { message: 'E_ARGUMENTS' });
});

for (const key of ['fetch', 'now', 'setTimeout', 'clearTimeout']) {
  test(`fixture rejects missing/nonfunction/accessor/proxy dependency ${key} without invoking`, () => {
    const { deps } = fake();
    const missing = { ...deps };
    delete missing[key];
    assert.throws(() => createFixture({ mockOnly: true }, missing), { message: 'E_ARGUMENTS' });
    assert.throws(() => createFixture({ mockOnly: true }, { ...deps, [key]: null }), { message: 'E_ARGUMENTS' });
    const accessor = { ...deps };
    Object.defineProperty(accessor, key, { get() { assert.fail('dependency getter invoked'); } });
    assert.throws(() => createFixture({ mockOnly: true }, accessor), { message: 'E_ARGUMENTS' });
    const proxy = new Proxy(() => assert.fail('proxy called'), { apply() { assert.fail('proxy apply'); } });
    assert.throws(() => createFixture({ mockOnly: true }, { ...deps, [key]: proxy }), { message: 'E_ARGUMENTS' });
  });
}

test('fixture rejects config/dependency proxies and getters without invoking traps', () => {
  const proxy = new Proxy({}, { ownKeys() { assert.fail('proxy ownKeys'); }, getPrototypeOf() { assert.fail('proxy prototype'); } });
  const { deps } = fake();
  assert.throws(() => createFixture(proxy, deps), { message: 'E_ARGUMENTS' });
  assert.throws(() => createFixture({ mockOnly: true }, proxy), { message: 'E_ARGUMENTS' });
  assert.throws(() => createFixture({ get mockOnly() { assert.fail('config getter'); } }, deps), { message: 'E_ARGUMENTS' });
});

test('fixture rejects symbols and inherited dependency methods', () => {
  const { deps } = fake();
  assert.throws(() => createFixture({ mockOnly: true, [Symbol('extra')]: 1 }, deps), { message: 'E_ARGUMENTS' });
  assert.throws(() => createFixture({ mockOnly: true }, Object.create(deps)), { message: 'E_ARGUMENTS' });
});

test('null-prototype own-data fixture arguments work', async () => {
  const { deps } = fake();
  assertData(await createFixture(Object.assign(Object.create(null), { mockOnly: true }), Object.assign(Object.create(null), deps)).run());
});

for (const actual of [globalThis.fetch, globalThis.performance.now, globalThis.setTimeout, globalThis.clearTimeout]) {
  test(`fixture refuses actual global function ${actual.name} in every dependency slot`, () => {
    const { deps } = fake();
    for (const key of Object.keys(deps)) {
      assert.throws(() => createFixture({ mockOnly: true }, { ...deps, [key]: actual }), { message: 'E_ARGUMENTS' });
    }
  });
}

test('DATA is recursively frozen including headers and counts', async () => {
  const result = await fake({ response: response({ headers: [['x', 'v']] }) }).fixture.run();
  const visit = (value) => {
    assert.ok(Object.isFrozen(value));
    for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child);
  };
  visit(result);
  assert.throws(() => { result.data.exposedHeaders[0][1] = 'changed'; }, TypeError);
  assert.throws(() => { result.data.counts.requests++; }, TypeError);
});

test('exact private bridge has the registered byte count and SHA', () => {
  assert.equal(Buffer.byteLength(BRIDGE), 794);
  assert.equal(createHash('sha256').update(BRIDGE).digest('hex'), '28bbe878605dc95eaa7d15d27e1ae9d162c86a755e7d76f8f8e69a97291cf334');
  assert.equal(source.split(NOW_LITERAL).length - 1, 1);
  assert.equal(source.includes('SOURCE_BIND_PARENT_CLOCK_ORIGIN'), false);
  assert.equal(source.includes('SOURCE_CAPTURE_NOW'), false);
});

test('five-TCB-only raw production keeps original collector-start clock', async () => {
  const image = await privateImage({ bridge: false });
  assertData(await image.collectRegisteredBootlinGccCopyingHeadV1());
  assert.deepEqual(image.TEST_STATE.timers.map((timer) => timer.delay), [30000, 10000]);
  assert.equal(image.TEST_STATE.calls.length, 1);
});

test('fixture rejects captured TCB functions even when current globals differ', async () => {
  const image = await privateImage();
  const { deps } = fake();
  for (const captured of [image.TEST_TCB.fetch, image.TEST_TCB.clock.now, image.TEST_TCB.setTimeout, image.TEST_TCB.clearTimeout]) {
    for (const key of Object.keys(deps)) {
      assert.throws(() => image.createBootlinGccCopyingHeadFixture({ mockOnly: true }, { ...deps, [key]: captured }), { message: 'E_ARGUMENTS' });
    }
  }
  assert.equal(image.TEST_STATE.calls.length, 0);
});

test('private original-parent bridge seeds first read only: origin 0, bind/invoke 9000', async () => {
  const image = await privateImage();
  image.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  const result = await image.collectRegisteredBootlinGccCopyingHeadV1();
  assertData(result);
  assert.deepEqual(image.TEST_STATE.timers.map((timer) => timer.delay), [21000, 10000]);
  assert.equal(image.TEST_STATE.calls.length, 1);
  assert.equal(image.TEST_STATE.calls[0][1].method, 'HEAD');
  assert.equal(image.TEST_STATE.time, 9000);
  assert.ok(image.TEST_STATE.reads > 5);
});

test('private delayed invocation at 27000 schedules only original remaining 3000 and never fetches', async () => {
  const image = await privateImage();
  image.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  image.TEST_STATE.time = 27000;
  const result = await image.collectRegisteredBootlinGccCopyingHeadV1();
  assertStop(result, 'E_WORK_DEADLINE');
  assert.deepEqual(image.TEST_STATE.timers.map((timer) => timer.delay), [3000]);
  assert.equal(image.TEST_STATE.calls.length, 0);
  assert.equal(image.TEST_STATE.cleared.length, 1);
});

test('private bridge never renews a 20100-ms cleanup window after original deadline', async () => {
  const image = await privateImage();
  image.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  image.TEST_STATE.pending = true;
  const pending = image.collectRegisteredBootlinGccCopyingHeadV1();
  assert.deepEqual(image.TEST_STATE.timers.map((timer) => timer.delay), [21000, 10000]);
  image.TEST_STATE.time = 19000;
  image.TEST_STATE.timers[1].callback();
  const result = await pending;
  assertStop(result, 'E_REQUEST_DEADLINE');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(image.TEST_STATE.timers.length, 2);
  assert.equal(image.TEST_STATE.cleared.length, 2);
});

test('private body cancellation retains parent total end 30000, not invocation plus 30000', async () => {
  const image = await privateImage();
  image.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  image.TEST_STATE.bodyPending = true;
  const pending = image.collectRegisteredBootlinGccCopyingHeadV1();
  await flush();
  assert.equal(image.TEST_STATE.cancelCalls, 1);
  assert.deepEqual(image.TEST_STATE.timers.map((timer) => timer.delay), [21000, 10000]);
  let settled = false;
  pending.then(() => { settled = true; });
  image.TEST_STATE.time = 19000;
  image.TEST_STATE.timers[1].callback();
  await flush();
  assert.equal(settled, false);
  image.TEST_STATE.time = 29999;
  await flush();
  assert.equal(settled, false);
  image.TEST_STATE.time = 30000;
  image.TEST_STATE.timers[0].callback();
  const result = await pending;
  assertStop(result, 'E_BODY');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(result.data.counts.abortCalls, 1);
  assert.equal(image.TEST_STATE.timers.length, 2);
  assert.equal(image.TEST_STATE.cleared.length, 2);
});

test('private request end clips to original work end instead of renewing 10000 ms', async () => {
  const image = await privateImage();
  image.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  image.TEST_STATE.time = 24000;
  assertData(await image.collectRegisteredBootlinGccCopyingHeadV1());
  assert.deepEqual(image.TEST_STATE.timers.map((timer) => timer.delay), [6000, 3000]);
  assert.equal(image.TEST_STATE.calls.length, 1);
});

test('private invocation at original total end creates no request or renewed timer', async () => {
  const image = await privateImage();
  image.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  image.TEST_STATE.time = 30000;
  assertStop(await image.collectRegisteredBootlinGccCopyingHeadV1(), 'E_TOTAL_DEADLINE');
  assert.equal(image.TEST_STATE.calls.length, 0);
  assert.equal(image.TEST_STATE.timers.length, 0);
});

test('final post-serialization clock guard withholds completed DATA on deadline', async () => {
  const baseline = fake();
  assertData(await baseline.fixture.run());
  const finalRead = baseline.state.reads;
  const result = await fake({ now: ({ reads }) => reads === finalRead ? 10000 : 0 }).fixture.run();
  assertStop(result, 'E_REQUEST_DEADLINE');
});

test('65th header is rejected before touching its pair or copying it', async () => {
  const headers = {
    *[Symbol.iterator]() {
      for (let i = 0; i < 64; i++) yield [`x-${i}`, 'v'];
      yield new Proxy([], { get() { assert.fail('65th pair inspected'); } });
    },
  };
  assertStop(await fake({ response: response({ headers }) }).fixture.run(), 'E_HEADERS');
});

test('instrumented production reentry consumes before first await', async () => {
  const image = await privateImage();
  image.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  image.TEST_STATE.pending = true;
  const pending = image.collectRegisteredBootlinGccCopyingHeadV1();
  assertStop(await image.collectRegisteredBootlinGccCopyingHeadV1(), 'E_ONESHOT');
  image.TEST_STATE.time = 19000;
  image.TEST_STATE.timers[1].callback();
  assertStop(await pending, 'E_REQUEST_DEADLINE');
  assert.equal(image.TEST_STATE.calls.length, 1);
});

test('instrumented production argument failure makes zero calls and consumes before await', async () => {
  const image = await privateImage();
  const pending = image.collectRegisteredBootlinGccCopyingHeadV1({ origin: 0, url: URL });
  assertStop(await image.collectRegisteredBootlinGccCopyingHeadV1(), 'E_ONESHOT');
  assertStop(await pending, 'E_ARGUMENTS');
  assert.equal(image.TEST_STATE.calls.length, 0);
  assert.equal(image.TEST_STATE.reads, 0);
});

test('private clock requires binding before any production clock read', async () => {
  const image = await privateImage();
  assertStop(await image.collectRegisteredBootlinGccCopyingHeadV1(), 'E_CLOCK');
  assert.equal(image.TEST_STATE.calls.length, 0);
});

test('exact bridge disallows late binding, reset, bad origin, and regressing actual clock', async () => {
  const late = await privateImage();
  late.TEST_STATE.time = 10000;
  assert.throws(() => late.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0), { message: 'E_CLOCK' });
  const reset = await privateImage();
  reset.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  assert.throws(() => reset.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0), { message: 'E_CLOCK' });
  const bad = await privateImage();
  for (const origin of [NaN, Infinity, -1, 9001, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => bad.SOURCE_BIND_PARENT_CLOCK_ORIGIN(origin), { message: 'E_CLOCK' });
  }
  const backwards = await privateImage();
  backwards.SOURCE_BIND_PARENT_CLOCK_ORIGIN(9000);
  backwards.TEST_STATE.time = 8999;
  assertStop(await backwards.collectRegisteredBootlinGccCopyingHeadV1(), 'E_CLOCK');
  assert.equal(backwards.TEST_STATE.calls.length, 0);
});

test('private output preflight enforces exact ASCII cap including LF and never truncates', async () => {
  const { TEST_outputFrame: frame } = await privateImage();
  const exact = frame('x'.repeat(65533));
  assert.equal(Buffer.byteLength(exact), 65536);
  assert.equal(exact.at(-1), '\n');
  assert.equal(JSON.parse(exact).length, 65533);
  assert.throws(() => frame('x'.repeat(65534)), { message: 'E_OUTPUT' });
  const escaped = frame('\0\r\n\t\u007fé😀');
  assert.match(escaped, /^[\x00-\x7f]+$/);
  assert.equal(escaped.slice(0, -1).includes('\n'), false);
  assert.equal(JSON.parse(escaped), '\0\r\n\t\u007fé😀');
});

test('private output preflight rejects getter/toJSON/proxy without executing hooks', async () => {
  const { TEST_outputFrame: frame } = await privateImage();
  const cases = [
    { get field() { assert.fail('output getter'); } },
    { toJSON() { assert.fail('output toJSON'); } },
    new Proxy({}, { ownKeys() { assert.fail('output proxy'); } }),
    Object.create({ toJSON() { assert.fail('inherited output toJSON'); } }),
  ];
  for (const value of cases) assert.throws(() => frame(value), { message: 'E_OUTPUT' });
});

test('private output preflight rejects cycles, nonfinite, undefined, exotic data, and sparse arrays', async () => {
  const { TEST_outputFrame: frame } = await privateImage();
  const cycle = {}; cycle.self = cycle;
  for (const value of [cycle, NaN, Infinity, undefined, 1n, () => {}, new Date(), new Array(1), { [Symbol('x')]: 1 }]) {
    assert.throws(() => frame(value), { message: 'E_OUTPUT' });
  }
});

test('private output preflight depth 64/65 boundary and node bound', async () => {
  const { TEST_outputFrame: frame } = await privateImage();
  let value = null;
  for (let i = 0; i < 64; i++) value = [value];
  assert.doesNotThrow(() => frame(value));
  assert.throws(() => frame([value]), { message: 'E_OUTPUT' });
  assert.throws(() => frame(Array(50000).fill(null)), { message: 'E_OUTPUT' });
});

test('handoff pins cover only owned files, policy JSON, and clock-only private image', async (context) => {
  const testSource = await readFile(new globalThis.URL('./bootlin-gcc-copying-head.test.mjs', import.meta.url), 'utf8');
  const pin = (text) => ({
    bytes: Buffer.byteLength(text),
    sha256: createHash('sha256').update(text).digest('hex'),
  });
  const clockOnlyImage = source.replace(NOW_LITERAL, 'now: () => SOURCE_CAPTURE_NOW(),') + BRIDGE;
  const exports = [...source.matchAll(/^export (?:async )?(?:const|function) (\w+)/gm)].map((match) => match[1]).sort();
  assert.deepEqual(exports, ['BOOTLIN_GCC_COPYING_HEAD_V1_POLICY', 'collectRegisteredBootlinGccCopyingHeadV1', 'createBootlinGccCopyingHeadFixture'].sort());
  const pins = {
    source: { ...pin(source), lines: source.split('\n').length - 1 },
    test: { ...pin(testSource), lines: testSource.split('\n').length - 1 },
    policyJsonWithoutLf: pin(JSON.stringify(policy)),
    clockOnlyPrivateImage: pin(clockOnlyImage),
    sourceNowLiteralCount: source.split(NOW_LITERAL).length - 1,
    profile: policy.profile, clientKey: policy.clientKey, exports,
  };
  assert.equal(pins.sourceNowLiteralCount, 1);
  context.diagnostic(JSON.stringify(pins));
});
