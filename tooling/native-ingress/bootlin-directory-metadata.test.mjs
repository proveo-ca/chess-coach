// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  BOOTLIN_DIRECTORY_METADATA_V1_PROFILE as POLICY,
  collectRegisteredBootlinDirectoriesV1,
  createBootlinDirectoryMetadataFixture,
} from './bootlin-directory-metadata.mjs';

const bytes = text => new Uint8Array(Buffer.from(text, 'utf8'));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let index = 0; index < 40; index++) await Promise.resolve(); };

function fakeClock() {
  const clock = { time: 0, nextId: 0, timers: new Map(), armed: [], cleared: [] };
  clock.set = (callback, delay) => {
    const timer = { id: ++clock.nextId, due: clock.time + delay, callback, delay };
    clock.timers.set(timer.id, timer);
    clock.armed.push(timer);
    return timer.id;
  };
  clock.clear = id => { clock.cleared.push(id); clock.timers.delete(id); };
  clock.fireNext = () => {
    const next = [...clock.timers.values()].sort((a, b) => a.due - b.due || a.id - b.id)[0];
    assert.ok(next, 'fake timer available');
    clock.timers.delete(next.id);
    clock.time = next.due;
    next.callback();
    return next.due;
  };
  return clock;
}

function response(url, options = {}) {
  const state = { locks: 0, reads: 0, cancels: 0, bodyCancels: 0, releases: 0 };
  const chunks = options.chunks ?? [bytes('<pre>directory metadata</pre>')];
  const reader = {
    read() {
      const index = state.reads++;
      if (options.read) return options.read(index, state);
      return Promise.resolve(index < chunks.length
        ? { done: false, value: chunks[index] } : { done: true, value: undefined });
    },
    cancel() { state.cancels++; return options.cancel?.() ?? Promise.resolve(); },
    releaseLock() { state.releases++; return options.release?.(); },
  };
  const body = {
    getReader() { state.locks++; return options.getReader ? options.getReader(reader) : reader; },
    cancel() { state.bodyCancels++; return options.bodyCancel?.() ?? Promise.resolve(); },
  };
  const result = {
    status: 200, url, redirected: false, type: 'basic',
    headers: options.headers ?? [['content-type', 'text/html; charset=utf-8']],
    body,
    ...options.fields,
  };
  return { result, state, reader, body };
}

function harness(options = {}) {
  const clock = fakeClock();
  const h = { clock, calls: [], records: [] };
  h.dependencies = {
    fetch(url, init) {
      const index = h.calls.length;
      h.calls.push({ url, init });
      if (options.fetch) return options.fetch(url, init, index, h);
      const settings = typeof options.responses === 'function'
        ? options.responses(index, h) : options.responses?.[index];
      const record = response(url, settings);
      h.records.push(record);
      return Promise.resolve(record.result);
    },
    now() { return options.now ? options.now(h) : clock.time; },
    setTimeout(callback, delay) {
      if (options.setTimeout) return options.setTimeout(callback, delay, h);
      return clock.set(callback, delay);
    },
    clearTimeout(id) {
      if (options.clearTimeout) return options.clearTimeout(id, h);
      clock.clear(id);
    },
  };
  h.fixture = createBootlinDirectoryMetadataFixture({ mockOnly: true }, h.dependencies);
  h.run = (...args) => h.fixture.run(...args);
  return h;
}

function stop(result, error) {
  assert.equal(result.exitCode, 1);
  assert.equal(result.data.status, 'STOP');
  assert.equal(result.data.error, error);
  assert.equal(result.data.mockOnly, true);
  assert.deepEqual(Object.keys(result.data).sort(),
    ['profile', 'status', 'mockOnly', 'error', 'counts', 'cleanupUncertain'].sort());
  assert.equal(result.data.counts.transportClosedVerified, false);
}

function deeplyFrozen(value) {
  if (value && typeof value === 'object') {
    assert.equal(Object.isFrozen(value), true);
    for (const child of Object.values(value)) deeplyFrozen(child);
  }
}

test('production arguments consume its latch without a fetch, including later zero-argument use', async () => {
  const first = await collectRegisteredBootlinDirectoriesV1(undefined);
  assert.equal(first.data.error, 'E_ARGUMENTS');
  assert.equal(first.data.mockOnly, false);
  assert.equal(first.data.counts.fetchCalls, 0);
  const second = await collectRegisteredBootlinDirectoriesV1();
  assert.equal(second.data.error, 'E_ARGUMENTS');
  assert.equal(second.data.counts.fetchCalls, 0);
});

test('profile fixes ordered HTTPS directories and source pins recursively', () => {
  assert.deepEqual(POLICY.urls, [
    'https://toolchains.bootlin.com/downloads/releases/sources/',
    'https://toolchains.bootlin.com/downloads/releases/licenses/',
  ]);
  assert.equal(POLICY.profile, 'registered-bootlin-directories-v1');
  assert.equal(POLICY.sourceRef.registration, '33');
  assert.equal(POLICY.sourceRef.preparationBytes, 2724242);
  assert.equal(POLICY.sourceRef.rootReadmeBytes, 1093);
  assert.match(POLICY.sourceRef.preparationSha256, /^[a-f0-9]{64}$/);
  assert.match(POLICY.sourceRef.rootReadmeSha256, /^[a-f0-9]{64}$/);
  deeplyFrozen(POLICY);
});

test('two fixed sequential GETs use closed fetch options and record uninterpreted metadata', async () => {
  const h = harness();
  const result = await h.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.status, 'BOOTLIN_DIRECTORY_METADATA');
  assert.equal(result.data.mockOnly, true);
  assert.deepEqual(h.calls.map(call => call.url), POLICY.urls);
  for (const { init } of h.calls) {
    const { signal, ...rest } = init;
    assert.deepEqual(rest, {
      method: 'GET', redirect: 'manual', credentials: 'omit', cache: 'no-store',
      referrer: '', referrerPolicy: 'no-referrer',
      headers: { Accept: 'text/html', 'Accept-Encoding': 'identity' },
    });
    assert.equal(signal.aborted, false);
  }
  for (const [index, observation] of result.data.observations.entries()) {
    assert.equal(observation.role, POLICY.roles[index]);
    assert.equal(observation.requestedUrl, POLICY.urls[index]);
    assert.equal(observation.responseUrl, POLICY.urls[index]);
    assert.equal(observation.bodySha256,
      createHash('sha256').update(Buffer.from(observation.bodyUtf8, 'utf8')).digest('hex'));
    assert.equal(observation.observedBodyBytes, Buffer.byteLength(observation.bodyUtf8));
    assert.equal(observation.eof, true);
    assert.equal(observation.utf8Validated, true);
    assert.equal(observation.urlsFollowed, false);
    assert.equal(observation.interpreted, false);
    assert.equal(observation.sourceKind, 'PUBLIC_DIRECTORY_METADATA');
  }
  assert.equal(result.data.counts.completedObservations, 2);
  assert.equal(result.data.counts.clearedTimers, 3);
  assert.equal(result.data.counts.activeTimers, 0);
  assert.equal(result.data.counts.releases, 2);
  assert.equal(result.data.counts.cancellations, 0);
  assert.equal(h.clock.timers.size, 0);
  assert.deepEqual(h.clock.armed.map(timer => timer.due), [30000, 10000, 10000]);
  for (const record of h.records) assert.deepEqual(record.state,
    { locks: 1, reads: 2, cancels: 0, bodyCancels: 0, releases: 1 });
  deeplyFrozen(result);
});

test('qualification flags remain false and no runtime or transport guarantee appears', async () => {
  const { data } = await harness().run();
  for (const name of [
    'sourceAuthenticated', 'publisherAuthenticated', 'sourceRootAuthentication',
    'licenseComplianceVerified', 'pythonFreeSubsetVerified', 'runtimeProvidersQualified',
    'abiVerified', 'imagePrepared', 'nativeQualified', 'rustReady', 'trainingReady',
    'hardDeadlineGuaranteed', 'hardRssBounded', 'wireByteBounded',
    'rawWireHeadersObserved', 'transportClosureVerified', 'ioIsolated', 'secureErasureVerified',
  ]) assert.equal(data[name], false, name);
});

test('links, scripts, package URLs, and legal-looking HTML remain literal text', async () => {
  const text = '<script src="https://invalid.example/x"></script><a href="pkg.tar.gz">License accepted</a>';
  const h = harness({ responses: [{ chunks: [bytes(text)] }, { chunks: [bytes(text)] }] });
  const result = await h.run();
  assert.equal(result.data.observations[0].bodyUtf8, text);
  assert.equal(h.calls.length, 2);
  assert.deepEqual(h.calls.map(call => call.url), POLICY.urls);
});

test('fixture arguments consume the latch and never allow URL overrides', async () => {
  const h = harness();
  stop(await h.run({ url: 'https://invalid.example/' }), 'E_ARGUMENTS');
  stop(await h.run(), 'E_ARGUMENTS');
  assert.equal(h.calls.length, 0);
});

test('fixtures have independent one-shot latches', async () => {
  const first = harness(), second = harness();
  assert.equal((await first.run()).exitCode, 0);
  stop(await first.run(), 'E_ARGUMENTS');
  assert.equal((await second.run()).exitCode, 0);
});

test('an in-flight invocation consumes the latch before awaiting fetch', async () => {
  const pending = deferred();
  const h = harness({ fetch: () => pending.promise });
  const running = h.run();
  stop(await h.run(), 'E_ARGUMENTS');
  assert.equal(h.calls.length, 1);
  h.clock.fireNext();
  stop(await running, 'E_DEADLINE');
  pending.reject(new Error('late failure'));
  await flush();
});

const invalidConfigurations = [
  ['false mockOnly', { mockOnly: false }], ['missing marker', {}],
  ['extra config field', { mockOnly: true, url: POLICY.urls[0] }],
  ['null configuration', null], ['proxy configuration', new Proxy({ mockOnly: true }, {})],
];
for (const [label, config] of invalidConfigurations) {
  test(`fixture rejects ${label} before I/O`, () => {
    const h = harness();
    assert.throws(() => createBootlinDirectoryMetadataFixture(config, h.dependencies), /^Error: E_MOCK_TCB$/);
    assert.equal(h.calls.length, 0);
  });
}

test('fixture rejects accessor configuration without invoking its getter', () => {
  let invoked = false;
  const config = Object.defineProperty({}, 'mockOnly', { get() { invoked = true; return true; } });
  assert.throws(() => createBootlinDirectoryMetadataFixture(config, harness().dependencies), /E_MOCK_TCB/);
  assert.equal(invoked, false);
});

for (const key of ['fetch', 'now', 'setTimeout', 'clearTimeout']) {
  test(`fixture requires own data fake ${key} with no real-global fallback`, () => {
    const h = harness();
    const missing = { ...h.dependencies };
    delete missing[key];
    assert.throws(() => createBootlinDirectoryMetadataFixture({ mockOnly: true }, missing), /E_MOCK_TCB/);
    const real = key === 'now' ? performance.now : globalThis[key];
    assert.throws(() => createBootlinDirectoryMetadataFixture({ mockOnly: true },
      { ...h.dependencies, [key]: real }), /E_MOCK_TCB/);
    let invoked = false;
    const accessor = { ...h.dependencies };
    Object.defineProperty(accessor, key, { get() { invoked = true; return h.dependencies[key]; } });
    assert.throws(() => createBootlinDirectoryMetadataFixture({ mockOnly: true }, accessor), /E_MOCK_TCB/);
    assert.equal(invoked, false);
  });
}

test('fixture rejects proxies, inherited methods, extras, symbols, and nonfunctions', () => {
  const h = harness();
  for (const dependencies of [
    new Proxy(h.dependencies, {}), Object.create(h.dependencies),
    { ...h.dependencies, extra: () => {} }, { ...h.dependencies, [Symbol('x')]: true },
    { ...h.dependencies, fetch: 1 }, { ...h.dependencies, fetch: new Proxy(() => {}, {}) },
  ]) assert.throws(() => createBootlinDirectoryMetadataFixture({ mockOnly: true }, dependencies), /E_MOCK_TCB/);
  assert.throws(() => createBootlinDirectoryMetadataFixture({ mockOnly: true }, h.dependencies, {}), /E_MOCK_TCB/);
  assert.equal(h.calls.length, 0);
});

test('dependency functions receive their explicitly supplied receiver', async () => {
  const h = harness();
  const methods = Object.fromEntries(Object.entries(h.dependencies).map(([key, method]) => [key,
    function (...args) { assert.equal(this, methods); return method(...args); }]));
  assert.equal((await createBootlinDirectoryMetadataFixture({ mockOnly: true }, methods).run()).exitCode, 0);
});

const badResponses = [
  ['non-200 status', { status: 201 }], ['redirect status', { status: 302 }],
  ['redirected flag', { redirected: true }], ['wrong response URL', { url: 'https://invalid.example/secret' }],
  ['opaque response', { type: 'opaque' }], ['opaque redirect', { type: 'opaqueredirect' }],
  ['error response', { type: 'error' }],
];
for (const [label, fields] of badResponses) {
  test(`rejects ${label} before locking the body`, async () => {
    const h = harness({ responses: [{ fields }] });
    const result = await h.run();
    stop(result, 'E_HEADERS');
    assert.equal(h.calls.length, 1);
    assert.equal(h.records[0].state.locks, 0);
    assert.equal(h.records[0].state.bodyCancels, 1);
    assert.equal(result.data.counts.activeTimers, 0);
    assert.doesNotMatch(JSON.stringify(result), /invalid\.example|secret/);
  });
}

test('Node default response type is accepted', async () => {
  const h = harness({ responses: [{ fields: { type: 'default' } }] });
  assert.equal((await h.run()).exitCode, 0);
});

const badHeaders = [
  ['missing content type', []], ['non-HTML type', [['content-type', 'text/plain']]],
  ['unsupported ASCII declaration', [['content-type', 'text/html; charset=us-ascii']]],
  ['extra type parameter', [['content-type', 'text/html; charset=utf-8; extra=x']]],
  ['gzip encoding', [['content-type', 'text/html'], ['content-encoding', 'gzip']]],
  ['combined encoding', [['content-type', 'text/html'], ['content-encoding', 'identity, gzip']]],
  ['control header', [['content-type', 'text/html'], ['x-secret', 'hidden\r\ntext']]],
  ['NUL header', [['content-type', 'text/html'], ['x-secret', '\0']]],
  ['bad header name', [['content-type', 'text/html'], ['bad name', 'value']]],
  ['duplicate header', [['content-type', 'text/html'], ['Content-Type', 'text/html']]],
  ['surrogate header', [['content-type', 'text/html'], ['x-secret', '\ud800']]],
];
for (const [label, headers] of badHeaders) {
  test(`rejects ${label} without retaining body or publishing header values`, async () => {
    const h = harness({ responses: [{ headers }] });
    const result = await h.run();
    stop(result, 'E_HEADERS');
    assert.equal(h.records[0].state.locks, 0);
    assert.equal(h.calls.length, 1);
    assert.equal(result.data.counts.retainedBytes, 0);
    assert.doesNotMatch(JSON.stringify(result), /hidden|x-secret|content-type/);
  });
}

for (const type of ['text/html', 'TEXT/HTML; CHARSET=UTF-8', 'text/html;charset=utf8']) {
  test(`accepts supported HTML content type ${type}`, async () => {
    assert.equal((await harness({ responses: [{ headers: [
      ['content-type', type], ['content-encoding', 'IDENTITY'],
    ] }] }).run()).exitCode, 0);
  });
}

test('records bounded ordered Fetch-exposed header pairs, not raw wire headers', async () => {
  const headers = [['content-type', 'text/html'], ['server', 'fake-server'], ['set-cookie', 'public=fake']];
  const result = await harness({ responses: [{ headers }] }).run();
  assert.deepEqual(result.data.observations[0].exposedHeaders, headers);
  assert.equal(result.data.rawWireHeadersObserved, false);
});

test('64 exposed header pairs fit and 65 fail before body locking', async () => {
  const headers = [['content-type', 'text/html'], ...Array.from({ length: 63 }, (_, i) => [`x-${i}`, 'a'])];
  assert.equal((await harness({ responses: [{ headers }] }).run()).exitCode, 0);
  const h = harness({ responses: [{ headers: [...headers, ['x-over', 'a']] }] });
  stop(await h.run(), 'E_LIMIT');
  assert.equal(h.records[0].state.locks, 0);
});

test('16384 UTF-8 header bytes fit and 16385 fail before body locking', async () => {
  const fixed = Buffer.byteLength('content-type' + 'text/html' + 'x-pad');
  const headers = [['content-type', 'text/html'], ['x-pad', 'x'.repeat(16384 - fixed)]];
  assert.equal((await harness({ responses: [{ headers }] }).run()).exitCode, 0);
  headers[1][1] += 'x';
  const h = harness({ responses: [{ headers }] });
  stop(await h.run(), 'E_LIMIT');
  assert.equal(h.records[0].state.locks, 0);
});

test('header accounting counts encoded UTF-8 bytes rather than UTF-16 length', async () => {
  const h = harness({ responses: [{ headers: [['content-type', 'text/html'], ['x-pad', 'é'.repeat(8192)]] }] });
  stop(await h.run(), 'E_LIMIT');
  assert.equal(h.records[0].state.locks, 0);
});

test('header-pair getters and proxy iterators are rejected without accessing payload getters', async () => {
  let invoked = false;
  const pair = ['x', 'secret'];
  Object.defineProperty(pair, '1', { get() { invoked = true; return 'secret'; } });
  const h = harness({ responses: [{ headers: [['content-type', 'text/html'], pair] }] });
  stop(await h.run(), 'E_HEADERS');
  assert.equal(invoked, false);
  const headers = { [Symbol.iterator]: () => new Proxy({ next: () => ({ done: true }) }, {}) };
  stop(await harness({ responses: [{ headers }] }).run(), 'E_HEADERS');
});

for (const declared of ['-1', '+1', '01', '1.0', ' 1', '1 ', '1e2', 'NaN', '999999999999999999999']) {
  test(`rejects noncanonical declared length ${JSON.stringify(declared)}`, async () => {
    const h = harness({ responses: [{ headers: [['content-type', 'text/html'], ['content-length', declared]] }] });
    stop(await h.run(), 'E_HEADERS');
    assert.equal(h.records[0].state.locks, 0);
  });
}

for (const declared of ['65537', '99999999999999999999']) {
  test(`rejects excessive declared length ${declared} before body access`, async () => {
    const h = harness({ responses: [{ headers: [['content-type', 'text/html'], ['content-length', declared]] }] });
    stop(await h.run(), 'E_LIMIT');
    assert.equal(h.records[0].state.locks, 0);
  });
}

test('identity declared length must exactly match EOF byte count, including zero', async () => {
  for (const declared of ['0', '2', '4']) {
    const h = harness({ responses: [{ chunks: [bytes('abc')], headers: [
      ['content-type', 'text/html'], ['content-length', declared],
    ] }] });
    stop(await h.run(), 'E_BODY');
    assert.equal(h.records[0].state.releases, 1);
    assert.equal(h.records[0].state.cancels, 0);
    assert.equal(h.calls.length, 1);
  }
  const result = await harness({ responses: [{ chunks: [], headers: [
    ['content-type', 'text/html'], ['content-length', '0'],
  ] }] }).run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.observations[0].bodyUtf8, '');
});

test('two exact 65536-byte chunks meet the 131072 aggregate body limit', async () => {
  const chunk = bytes('a'.repeat(65536));
  const h = harness({ responses: [0, 1].map(() => ({ chunks: [chunk], headers: [
    ['content-type', 'text/html'], ['content-length', '65536'],
  ] })) });
  const result = await h.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.counts.retainedBytes, 131072);
  assert.equal(result.data.counts.deliveredBytes, 131072);
  assert.equal(result.data.counts.peakDeliveredChunkBytes, 65536);
});

test('65537-byte delivered chunk is counted but rejected before retention', async () => {
  const h = harness({ responses: [{ chunks: [bytes('a'.repeat(65537))] }] });
  const result = await h.run();
  stop(result, 'E_LIMIT');
  assert.equal(result.data.counts.deliveredBytes, 65537);
  assert.equal(result.data.counts.peakDeliveredChunkBytes, 65537);
  assert.equal(result.data.counts.retainedBytes, 0);
  assert.equal(result.data.counts.rejectedChunks, 1);
  assert.equal(result.data.counts.cancellations, 1);
  assert.equal(result.data.counts.releases, 1);
  assert.equal(h.calls.length, 1);
});

test('overflowing second chunk never retains an accepted prefix of that chunk', async () => {
  const h = harness({ responses: [{ chunks: [bytes('a'.repeat(65535)), bytes('bc')] }] });
  const result = await h.run();
  stop(result, 'E_LIMIT');
  assert.equal(result.data.counts.deliveredBytes, 65537);
  assert.equal(result.data.counts.retainedBytes, 65535);
  assert.equal(result.data.counts.rejectedChunks, 1);
});

test('second response overflow withholds both directories and all exposed header strings', async () => {
  const h = harness({ responses: [
    { chunks: [bytes('FIRST_BODY_PRIVATE_MARKER')], headers: [['content-type', 'text/html'], ['x-marker', 'FIRST_HEADER_MARKER']] },
    { chunks: [bytes('a'.repeat(65537))], headers: [['content-type', 'text/html'], ['x-marker', 'SECOND_HEADER_MARKER']] },
  ] });
  const result = await h.run();
  stop(result, 'E_LIMIT');
  assert.equal(result.data.counts.completedObservations, 1);
  assert.equal(h.calls.length, 2);
  assert.doesNotMatch(JSON.stringify(result), /FIRST_|SECOND_|x-marker|text\/html/);
});

test('1024 read calls include EOF and permit zero-byte chunks', async () => {
  const h = harness({ responses: [{ chunks: Array.from({ length: 1023 }, () => new Uint8Array()) }] });
  const result = await h.run();
  assert.equal(result.exitCode, 0);
  assert.equal(h.records[0].state.reads, 1024);
  assert.equal(result.data.observations[0].observedBodyBytes, 0);
});

test('read-call cap stops endless zero chunks after exactly 1024 calls', async () => {
  const h = harness({ responses: [{ read: () => Promise.resolve({ done: false, value: new Uint8Array() }) }] });
  const result = await h.run();
  stop(result, 'E_LIMIT');
  assert.equal(h.records[0].state.reads, 1024);
  assert.equal(result.data.counts.readAttempts, 1024);
  assert.equal(h.calls.length, 1);
});

test('aggregate read cap permits two 1024-call responses with EOF', async () => {
  const h = harness({ responses: [0, 1].map(() => ({ chunks: Array.from({ length: 1023 }, () => new Uint8Array()) })) });
  const result = await h.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.counts.readAttempts, 2048);
});

const invalidChunks = [
  ['plain array', [1, 2]], ['Uint16Array', new Uint16Array([1])],
  ['DataView', new DataView(new ArrayBuffer(1))],
  ['proxy Uint8Array', new Proxy(new Uint8Array([65]), {})],
  ['spoofed length object', { byteLength: Number.MAX_SAFE_INTEGER, length: NaN }],
];
for (const [label, chunk] of invalidChunks) {
  test(`rejects ${label} as a body chunk`, async () => {
    const h = harness({ responses: [{ chunks: [chunk] }] });
    const result = await h.run();
    stop(result, 'E_BODY');
    assert.equal(result.data.counts.deliveredBytes, 0);
    assert.equal(result.data.counts.retainedBytes, 0);
    assert.equal(result.data.counts.releases, 1);
  });
}

test('typed-array shadow getters cannot spoof counters or run during validation', async () => {
  let invoked = false;
  const chunk = new Uint8Array([65]);
  Object.defineProperty(chunk, 'byteLength', { get() { invoked = true; return Infinity; } });
  const h = harness({ responses: [{ chunks: [chunk] }] });
  stop(await h.run(), 'E_BODY');
  assert.equal(invoked, false);
});

test('read-result getters and nonempty EOF values are rejected', async () => {
  let invoked = false;
  const getter = { done: false, get value() { invoked = true; return bytes('x'); } };
  for (const item of [getter, { done: true, value: bytes('x') }, { done: 'true' }, new Proxy({ done: true }, {})]) {
    stop(await harness({ responses: [{ read: () => Promise.resolve(item) }] }).run(), 'E_BODY');
  }
  assert.equal(invoked, false);
});

test('missing readable body fails closed without a second request', async () => {
  const h = harness({ responses: [{ fields: { body: null } }] });
  stop(await h.run(), 'E_BODY');
  assert.equal(h.calls.length, 1);
});

test('invalid UTF-8 discovered at EOF withholds every body and releases once', async () => {
  const h = harness({ responses: [{ chunks: [bytes('valid prefix'), new Uint8Array([0xc3])] }] });
  const result = await h.run();
  stop(result, 'E_UTF8');
  assert.doesNotMatch(JSON.stringify(result), /valid prefix/);
  assert.equal(h.records[0].state.releases, 1);
  assert.equal(h.records[0].state.cancels, 0);
});

test('BOM, non-ASCII text, and split multibyte code points round-trip byte-exactly', async () => {
  const text = '\ufeff<h1>é🙂</h1>\r\n\t';
  const raw = bytes(text);
  const h = harness({ responses: [{ chunks: [raw.slice(0, 2), raw.slice(2, 9), raw.slice(9)] }] });
  const result = await h.run();
  assert.equal(result.exitCode, 0);
  const observation = result.data.observations[0];
  assert.equal(observation.bodyUtf8, text);
  assert.equal(observation.bodySha256, createHash('sha256').update(raw).digest('hex'));
});

for (const control of ['\0', '\b', '\v', '\f', '\x1f', '\x7f', '\x85', '\x9f']) {
  test(`rejects body control U+${control.charCodeAt(0).toString(16).padStart(4, '0')}`, async () => {
    stop(await harness({ responses: [{ chunks: [bytes('a' + control)] }] }).run(), 'E_UTF8');
  });
}

test('maximum Unicode bodies and header expansion still fit actual ASCII JSON plus LF', async () => {
  const text = 'é'.repeat(32768);
  const headers = [['content-type', 'text/html'], ['x-meta', '漢'.repeat(5400)]];
  const h = harness({ responses: [0, 1].map(() => ({ chunks: [bytes(text)], headers })) });
  const result = await h.run();
  assert.equal(result.exitCode, 0);
  const serialized = JSON.stringify(result.data).replace(/[\u007f-\uffff]/g,
    char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`) + '\n';
  assert.ok(serialized.length <= 1048576);
  assert.match(serialized, /\\u00e9/);
  assert.match(serialized, /\\u6f22/);
  assert.equal(Buffer.byteLength(serialized, 'ascii'), serialized.length);
});

const privatePreflight = (async () => {
  const source = await readFile(new URL('./bootlin-directory-metadata.mjs', import.meta.url), 'utf8');
  const appended = source + '\nexport { outputPreflight as testOnlyPreflight };\n';
  const module = await import('data:text/javascript;base64,' + Buffer.from(appended).toString('base64'));
  return module.testOnlyPreflight;
})();

test('private output guard accepts exactly 1 MiB ASCII JSON plus LF and rejects one more byte', async () => {
  const preflight = await privatePreflight;
  const available = POLICY.limits.outputBytes - JSON.stringify({ value: '' }).length - 1;
  preflight({ value: 'a'.repeat(available) });
  assert.throws(() => preflight({ value: 'a'.repeat(available + 1) }), /^Error: E_LIMIT$/);
});

test('private output guard counts six ASCII escape bytes per non-ASCII UTF-16 unit', async () => {
  const preflight = await privatePreflight;
  const available = POLICY.limits.outputBytes - JSON.stringify({ value: '' }).length - 1;
  const value = 'é'.repeat(Math.floor(available / 6)) + 'a'.repeat(available % 6);
  preflight({ value });
  assert.throws(() => preflight({ value: value + 'a' }), /^Error: E_LIMIT$/);
});

test('private output guard enforces depth 64 and node count 100000 inclusively', async () => {
  const preflight = await privatePreflight;
  let value = 'leaf';
  for (let depth = 0; depth < 64; depth++) value = { value };
  preflight(value);
  assert.throws(() => preflight({ value }), /E_LIMIT/);
  preflight({ items: Array(99997).fill(0) });
  assert.throws(() => preflight({ items: Array(99998).fill(0) }), /E_LIMIT/);
});

test('private output guard rejects proxies, accessors, cycles, and toJSON without invoking them', async () => {
  const preflight = await privatePreflight;
  let invoked = false;
  const cycle = {};
  cycle.self = cycle;
  for (const value of [
    new Proxy({}, { ownKeys() { invoked = true; return []; } }),
    { get secret() { invoked = true; return 'secret'; } },
    { toJSON() { invoked = true; return 'secret'; } }, cycle,
    { value: NaN }, { value: Number.MAX_SAFE_INTEGER + 1 },
  ]) assert.throws(() => preflight(value), /E_LIMIT/);
  assert.equal(invoked, false);
});

test('fetch rejection produces only a fixed code and no fallback or retry', async () => {
  const h = harness({ fetch: () => Promise.reject(new Error('PRIVATE_EXCEPTION_MARKER')) });
  const result = await h.run();
  stop(result, 'E_FETCH');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_EXCEPTION/);
  assert.equal(h.calls.length, 1);
  assert.equal(result.data.counts.activeTimers, 0);
  stop(await h.run(), 'E_ARGUMENTS');
  assert.equal(h.calls.length, 1);
});

test('an untrusted exception cannot spoof an internal error classification', async () => {
  const error = Object.assign(new Error('hidden'), { code: 'E_CLOCK' });
  const h = harness({ fetch: () => { throw error; } });
  stop(await h.run(), 'E_FETCH');
});

test('fetch ignoring abort loses the absolute race and its late rejection is observed', async () => {
  const pending = deferred();
  const h = harness({ fetch: () => pending.promise });
  const running = h.run();
  await flush();
  assert.equal(h.clock.fireNext(), 10000);
  const result = await running;
  stop(result, 'E_DEADLINE');
  assert.equal(h.calls[0].init.signal.aborted, true);
  assert.equal(result.data.counts.pendingFetchKnown, true);
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(result.data.counts.activeTimers, 0);
  assert.equal(h.calls.length, 1);
  pending.reject(new Error('LATE_FETCH_SECRET'));
  await flush();
  assert.equal(result.data.counts.pendingFetchKnown, true);
});

test('late successful fetch settlement cannot mutate frozen STOP counters', async () => {
  const pending = deferred();
  const h = harness({ fetch: () => pending.promise });
  const running = h.run();
  await flush();
  h.clock.fireNext();
  const result = await running;
  stop(result, 'E_DEADLINE');
  pending.resolve(response(POLICY.urls[0]).result);
  await flush();
  assert.equal(result.data.counts.pendingFetchKnown, true);
  deeplyFrozen(result);
});

test('one 10-second request timer covers headers and all chunks without renewal', async () => {
  const pending = deferred();
  const h = harness({ responses: (_index, h) => ({
    read(index) {
      if (index === 0) { h.clock.time = 9000; return Promise.resolve({ done: false, value: bytes('first') }); }
      return pending.promise;
    },
  }) });
  const running = h.run();
  await flush();
  assert.equal(h.records[0].state.reads, 2);
  assert.deepEqual(h.clock.armed.map(timer => timer.due), [30000, 10000]);
  assert.equal(h.clock.fireNext(), 10000);
  const result = await running;
  stop(result, 'E_DEADLINE');
  assert.equal(result.data.counts.pendingReadKnown, true);
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(h.records[0].state.cancels, 1);
  assert.equal(h.records[0].state.releases, 1);
  pending.reject(new Error('LATE_READ_SECRET'));
  await flush();
});

test('headers consuming the exact absolute request boundary fail before body retention', async () => {
  const h = harness({ fetch(url, _init, _index, h) {
    h.clock.time = 10000;
    const record = response(url);
    h.records.push(record);
    return Promise.resolve(record.result);
  } });
  const result = await h.run();
  stop(result, 'E_DEADLINE');
  assert.equal(h.records[0].state.locks, 0);
  assert.equal(h.records[0].state.bodyCancels, 1);
});

test('EOF arriving exactly at the deadline fails and cancels/releases the reader once', async () => {
  const h = harness({ responses: (_index, h) => ({ read() {
    h.clock.time = 10000;
    return Promise.resolve({ done: true, value: undefined });
  } }) });
  const result = await h.run();
  stop(result, 'E_DEADLINE');
  assert.equal(h.records[0].state.cancels, 1);
  assert.equal(h.records[0].state.releases, 1);
});

test('the same request deadline still applies after UTF-8 decoding and hashing', async () => {
  let afterEof = 0;
  const h = harness({ now(h) {
    if (h.records[0]?.state.reads === 2) return ++afterEof >= 3 ? 10000 : 9999;
    return h.clock.time;
  } });
  const result = await h.run();
  stop(result, 'E_DEADLINE');
  assert.equal(result.data.counts.eofObservations, 1);
  assert.equal(h.records[0].state.releases, 1);
  assert.equal(h.records[0].state.cancels, 0);
  assert.equal(h.calls.length, 1);
});

test('request timer disposal cannot move publication past its strict boundary', async () => {
  const h = harness({ clearTimeout(id, h) {
    h.clock.clear(id);
    if (id === 2) h.clock.time = 10000;
  } });
  const result = await h.run();
  stop(result, 'E_DEADLINE');
  assert.equal(h.calls.length, 1);
  assert.equal(h.records[0].state.releases, 1);
  assert.equal(h.records[0].state.cancels, 0);
});

test('request two waits until request one has reached EOF and released its only lock', async () => {
  const pending = deferred();
  const h = harness({ responses: index => index === 0 ? { read: () => pending.promise } : {} });
  const running = h.run();
  await flush();
  assert.equal(h.calls.length, 1);
  pending.resolve({ done: true, value: undefined });
  const result = await running;
  assert.equal(result.exitCode, 0);
  assert.equal(h.calls.length, 2);
  assert.equal(h.records[0].state.releases, 1);
  assert.equal(h.records[0].state.cancels, 0);
});

function delayedSecond(options = {}) {
  return harness({
    ...options,
    clearTimeout(id, h) {
      h.clock.clear(id);
      if (id === 2) Promise.resolve().then(() => { h.clock.time = 20000; });
    },
  });
}

test('the original 27-second work deadline clips request two instead of renewing the budget', async () => {
  const pending = deferred();
  const h = delayedSecond({ responses: index => index === 1 ? { read: () => pending.promise } : {} });
  const running = h.run();
  await flush();
  assert.deepEqual(h.clock.armed.map(timer => timer.due), [30000, 10000, 27000]);
  assert.equal(h.calls.length, 2);
  assert.equal(h.clock.fireNext(), 27000);
  const result = await running;
  stop(result, 'E_DEADLINE');
  assert.equal(result.data.counts.completedObservations, 1);
  assert.equal(result.data.counts.retainedBytes > 0, true);
  assert.equal(result.data.counts.activeTimers, 0);
  pending.resolve({ done: true, value: undefined });
  await flush();
});

test('unresolved cancellation gets only the original 30-second outer deadline', async () => {
  const read = deferred(), cancel = deferred();
  const h = delayedSecond({ responses: index => index === 1
    ? { read: () => read.promise, cancel: () => cancel.promise } : {} });
  const running = h.run();
  await flush();
  assert.equal(h.clock.fireNext(), 27000);
  await flush();
  assert.equal(h.records[1].state.cancels, 1);
  assert.equal(h.clock.fireNext(), 30000);
  const result = await running;
  stop(result, 'E_DEADLINE');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(result.data.counts.releases, 2);
  assert.equal(result.data.counts.activeTimers, 0);
  assert.deepEqual(h.clock.armed.map(timer => timer.due), [30000, 10000, 27000]);
  read.reject(new Error('late read'));
  cancel.reject(new Error('late cancellation'));
  await flush();
});

test('cleanup started before expiry still cancels and releases, without a renewed timer', async () => {
  const cancel = deferred();
  const h = harness({ responses: [{ chunks: [[1]], cancel: () => cancel.promise }] });
  const running = h.run();
  await flush();
  assert.equal(h.records[0].state.cancels, 1);
  assert.equal(h.clock.fireNext(), 10000);
  await flush();
  assert.equal(h.clock.fireNext(), 30000);
  const result = await running;
  stop(result, 'E_BODY');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(h.records[0].state.releases, 1);
  assert.equal(h.calls.length, 1);
  assert.equal(h.clock.armed.length, 2);
  cancel.reject(new Error('late cleanup rejection'));
  await flush();
});

for (const [label, value] of [
  ['NaN', NaN], ['infinity', Infinity], ['negative', -1], ['string', '0'],
  ['unsafe integer', Number.MAX_SAFE_INTEGER + 1], ['deadline overflow', Number.MAX_SAFE_INTEGER - 29999],
]) {
  test(`rejects ${label} clock before fetch`, async () => {
    const h = harness({ now: () => value });
    const result = await h.run();
    stop(result, 'E_CLOCK');
    assert.equal(h.calls.length, 0);
    assert.equal(result.data.counts.activeTimers, 0);
  });
}

test('clock exceptions map to a fixed error without leaking the exception', async () => {
  const h = harness({ now: () => { throw new Error('CLOCK_SECRET'); } });
  const result = await h.run();
  stop(result, 'E_CLOCK');
  assert.doesNotMatch(JSON.stringify(result), /CLOCK_SECRET/);
});

test('clock regression fails before I/O', async () => {
  let count = 0;
  const h = harness({ now: () => ++count === 1 ? 10 : 9 });
  stop(await h.run(), 'E_CLOCK');
  assert.equal(h.calls.length, 0);
});

test('clock regression during body reads triggers cancellation and never request two', async () => {
  const h = harness({ responses: (_index, h) => ({ read() {
    h.clock.time = -1;
    return Promise.resolve({ done: false, value: bytes('x') });
  } }) });
  const result = await h.run();
  stop(result, 'E_CLOCK');
  assert.equal(h.records[0].state.cancels, 1);
  assert.equal(h.records[0].state.releases, 1);
  assert.equal(h.calls.length, 1);
});

test('read rejection receives E_BODY with one cancellation and one release', async () => {
  const h = harness({ responses: [{ read: () => Promise.reject(new Error('READ_SECRET')) }] });
  const result = await h.run();
  stop(result, 'E_BODY');
  assert.equal(h.records[0].state.cancels, 1);
  assert.equal(h.records[0].state.releases, 1);
  assert.doesNotMatch(JSON.stringify(result), /READ_SECRET/);
});

test('cancellation rejection marks cleanup uncertain while release still runs', async () => {
  const h = harness({ responses: [{ chunks: [[1]], cancel: () => Promise.reject(new Error('CANCEL_SECRET')) }] });
  const result = await h.run();
  stop(result, 'E_BODY');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(h.records[0].state.releases, 1);
  assert.equal(result.data.counts.activeTimers, 0);
});

test('release failure after EOF yields E_CLEANUP and no second directory', async () => {
  const h = harness({ responses: [{ release: () => { throw new Error('RELEASE_SECRET'); } }] });
  const result = await h.run();
  stop(result, 'E_CLEANUP');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(h.records[0].state.releases, 1);
  assert.equal(h.records[0].state.cancels, 0);
  assert.equal(h.calls.length, 1);
});

test('unexpected asynchronous release is observed and rejected without waiting forever', async () => {
  const h = harness({ responses: [{ release: () => Promise.reject(new Error('ASYNC_RELEASE_SECRET')) }] });
  const result = await h.run();
  stop(result, 'E_CLEANUP');
  assert.equal(result.data.cleanupUncertain, true);
  await flush();
});

test('release failure during failure cleanup never prevents timer disposal', async () => {
  const h = harness({ responses: [{ chunks: [[1]], release: () => { throw new Error('release'); } }] });
  const result = await h.run();
  stop(result, 'E_BODY');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(h.records[0].state.releases, 1);
  assert.equal(h.clock.timers.size, 0);
});

test('header failure attempts body cancellation without obtaining a reader', async () => {
  const h = harness({ responses: [{ fields: { status: 404 }, bodyCancel: () => Promise.reject(new Error('body cancel')) }] });
  const result = await h.run();
  stop(result, 'E_HEADERS');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(h.records[0].state.locks, 0);
  assert.equal(h.records[0].state.bodyCancels, 1);
});

test('reader acquisition failure still attempts body cancellation', async () => {
  const h = harness({ responses: [{ getReader: () => { throw new Error('lock'); } }] });
  const result = await h.run();
  stop(result, 'E_BODY');
  assert.equal(h.records[0].state.locks, 1);
  assert.equal(h.records[0].state.bodyCancels, 1);
  assert.equal(h.records[0].state.releases, 0);
});

test('timer-arm failure yields fixed E_CLEANUP without any fetch', async () => {
  const h = harness({ setTimeout: () => { throw new Error('timer'); } });
  const result = await h.run();
  stop(result, 'E_CLEANUP');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(result.data.counts.activeTimers, 0);
  assert.equal(h.calls.length, 0);
});

test('timer-disposal failure prevents publication and never retries clearing that timer', async () => {
  const h = harness({ clearTimeout(id, h) {
    if (id === 2) { h.clock.cleared.push(id); throw new Error('clear'); }
    h.clock.clear(id);
  } });
  const result = await h.run();
  stop(result, 'E_CLEANUP');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(h.calls.length, 1);
  assert.equal(h.clock.cleared.filter(id => id === 2).length, 1);
  assert.equal(result.data.counts.activeTimers, 1);
});

test('asynchronous timer-disposal failure is observed and prevents publication', async () => {
  const h = harness({ clearTimeout(id, h) {
    h.clock.clear(id);
    if (id === 2) return Promise.reject(new Error('ASYNC_CLEAR_SECRET'));
  } });
  const result = await h.run();
  stop(result, 'E_CLEANUP');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(h.calls.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /ASYNC_CLEAR_SECRET/);
  await flush();
});

test('outer timer disposal failure suppresses both completed bodies', async () => {
  const h = harness({ clearTimeout(id, h) {
    if (id === 1) { h.clock.cleared.push(id); throw new Error('outer clear'); }
    h.clock.clear(id);
  } });
  const result = await h.run();
  stop(result, 'E_CLEANUP');
  assert.equal(result.data.counts.completedObservations, 2);
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(h.calls.length, 2);
  assert.equal(h.clock.cleared.filter(id => id === 1).length, 1);
});

test('final clock check after both EOFs and timer disposal still controls publication', async () => {
  const h = harness({ clearTimeout(id, h) {
    h.clock.clear(id);
    if (id === 1) h.clock.time = 27000;
  } });
  const result = await h.run();
  stop(result, 'E_DEADLINE');
  assert.equal(result.data.counts.completedObservations, 2);
  assert.equal(result.data.counts.activeTimers, 0);
  assert.equal(h.clock.timers.size, 0);
});

test('STOP data and success data freeze recursively and all counters stay safe/nonnegative', async () => {
  for (const h of [harness(), harness({ responses: [{ chunks: [[1]] }] })]) {
    const result = await h.run();
    deeplyFrozen(result);
    for (const value of Object.values(result.data.counts)) {
      if (typeof value === 'number') assert.ok(Number.isSafeInteger(value) && value >= 0);
    }
    assert.throws(() => { result.data.counts.fetchCalls = 1000; }, TypeError);
  }
});

test('handoff fingerprints cover only the two new source files', async context => {
  for (const name of ['bootlin-directory-metadata.mjs', 'bootlin-directory-metadata.test.mjs']) {
    const content = await readFile(new URL(name, import.meta.url));
    assert.ok(content.byteLength > 0);
    context.diagnostic(`${name}: bytes=${content.byteLength} sha256=${createHash('sha256').update(content).digest('hex')}`);
  }
});
