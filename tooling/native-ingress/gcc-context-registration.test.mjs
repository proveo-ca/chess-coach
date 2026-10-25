// SPEC: _spec/tooling/native-ingress/step2.puml
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../../', import.meta.url);
const SPEC = '_spec/tooling/native-ingress/';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = (bytes, length, digest) => {
  assert.equal(bytes.byteLength, length);
  assert.equal(sha256(bytes), digest);
};
const load = path => readFile(new URL(path, ROOT));
const ADAPTER_PATH = 'tooling/native-ingress/bootlin-directory-metadata-v2.mjs';
const adapterBytes = await load(ADAPTER_PATH);
pin(adapterBytes, 5760, 'd09558231e7ea5f27c2ed0d1b34c599c087bc34a4c6e5e75e3e4ecf3f1ff9f80');
const adapter = await import(new URL(ADAPTER_PATH, ROOT));
const raw = await load('tooling/native-ingress/bootlin-directory-metadata.mjs');
pin(raw, 19649, '1a625ec28479ac28efeaa19a51095924f7db5c48524a1cd74570e0c4b7f3890f');
const originalRaw = Buffer.from(raw);
const base = adapter.buildBootlinDirectoryMetadataV2Source(raw);
pin(Buffer.from(base.sourceText), 20438, 'ece2c9edbb3068bc65ce78454b7f8dbc5236d36f046849f4f30085c58c567557');

const URLS = Object.freeze([
  'https://toolchains.bootlin.com/downloads/releases/sources/gcc-final-15.3.0/',
  'https://toolchains.bootlin.com/downloads/releases/licenses/gcc-final-15.3.0/',
]);
const STEPS = Object.freeze([
  ['profile', "const PROFILE = 'registered-bootlin-directories-v2';", "const PROFILE = 'registered-bootlin-gcc-final-context-v1';", 1, 20444, 'cdd8b5205c80518f9e17064612e4e3b4bb37876395ba89be744645e0781798e3'],
  ['sourceUrl', 'https://toolchains.bootlin.com/downloads/releases/sources/', URLS[0], 1, 20461, '63bc60b1afa14670ffab842282c84c294761b6b3d467159abf55235bbf75e41a'],
  ['licenseUrl', 'https://toolchains.bootlin.com/downloads/releases/licenses/', URLS[1], 1, 20478, 'a556107f384a9cf0ad4dbc191760a038b1c20c7ce22d4b92a24f3f8885ecab6a'],
  ['entryNames', 'collectRegisteredBootlinDirectoriesV2', 'collectRegisteredBootlinGccFinalContextV1', 2, 20486, '3fabd3574f01fda4ef7f1b7de0bdcccb14d6191c75733ee4783f8c6d93259a62'],
  ['policyNames', 'BOOTLIN_DIRECTORY_METADATA_V2_PROFILE', 'BOOTLIN_GCC_FINAL_CONTEXT_V1_PROFILE', 2, 20484, '23a1a7017a050c8f1ac4f6c9c1f610913cc97136ecf62480c8d9debd2592b323'],
].map(step => Object.freeze(step)));
const stages = [];
let source = base.sourceText;
for (const [name, oldText, newText, count, bytes, digest] of STEPS) {
  const pieces = source.split(oldText);
  assert.equal(pieces.length - 1, count, name);
  source = pieces.join(newText);
  pin(Buffer.from(source), bytes, digest);
  stages.push(source);
}
const dataUri = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const gcc = await import(dataUri(source));
const POLICY = gcc.BOOTLIN_GCC_FINAL_CONTEXT_V1_PROFILE;

const rootBytes = await load(`${SPEC}bootlin-source-license-directories-v2.result.json`);
pin(rootBytes, 138884, 'c5cdf65b6ad92de0eeb379017bff4464bed8136340394b1dc8f3b36c67699f61');
const roots = JSON.parse(rootBytes);
const receiptBytes = await load(`${SPEC}bootlin-source-license-directories-v2.receipt.json`);
pin(receiptBytes, 3905, 'e01edd22690836b1274646e62086dd27593c20965ca3c395202f1e3924251979');
const rootReceipt = JSON.parse(receiptBytes);
const proposalBytes = await load(`${SPEC}gnu-preparation-plan-v1.result.json`);
pin(proposalBytes, 136598, '7d34c5e0308dc8397a221618dbd6e85f7c253b0ccfa8d806cb458a6b5e544f6e');
const proposal = JSON.parse(proposalBytes);

function response(url, options = {}) {
  const chunks = options.chunks ?? [Buffer.from(options.text ?? '<html>metadata</html>')];
  const counters = { reads: 0, cancels: 0, releases: 0 };
  let index = 0;
  const reader = {
    read() {
      counters.reads++;
      options.onRead?.(counters.reads);
      if (options.readError) throw new Error('fake-read-failure');
      return index < chunks.length ? { done: false, value: chunks[index++] } : { done: true };
    },
    cancel() { counters.cancels++; return Promise.resolve(); },
    releaseLock() { counters.releases++; },
  };
  const body = { getReader() { return reader; }, cancel: reader.cancel };
  return {
    counters,
    value: {
      status: 200, redirected: false, type: 'basic', url,
      headers: [['Content-Type', 'text/html; charset=utf-8']], body,
      ...options.fields,
    },
  };
}

function fixture(options = {}) {
  const calls = [], timers = new Map(), delays = [];
  let time = options.time ?? 100, nextTimer = 0;
  const replies = URLS.map((url, index) => response(url, options.responses?.[index]));
  const dependencies = {
    fetch(url, init) {
      calls.push({ url, init });
      if (options.fetch) return options.fetch({ url, init, calls, timers, replies, setTime });
      return replies[calls.length - 1].value;
    },
    now() { return options.now ? options.now() : time; },
    setTimeout(callback, delay) {
      assert.equal(arguments.length, 2);
      assert.equal(typeof callback, 'function');
      assert.ok(Number.isFinite(delay) && delay > 0);
      const handle = ++nextTimer;
      delays.push(delay);
      timers.set(handle, { callback, delay });
      return handle;
    },
    clearTimeout(handle) {
      assert.equal(arguments.length, 1);
      assert.ok(timers.has(handle));
      timers.delete(handle);
      return options.clearResult;
    },
  };
  function setTime(value) { time = value; }
  const instance = gcc.createBootlinDirectoryMetadataFixture({ mockOnly: true }, dependencies);
  return { ...instance, calls, timers, delays, replies, dependencies, setTime };
}

function withheld(result, error) {
  assert.equal(result.exitCode, 1);
  assert.equal(result.data.status, 'STOP');
  assert.equal(result.data.mockOnly, true);
  assert.equal(result.data.error, error);
  assert.equal(Object.hasOwn(result.data, 'observations'), false);
  assert.doesNotMatch(JSON.stringify(result), /metadata<\/html>|bodyUtf8|bodySha256/);
}

function frozenTree(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) frozenTree(child);
}

test('GCC graph transforms preserve caller bytes and the pinned base V2 image', () => {
  assert.deepEqual(raw, originalRaw);
  assert.equal(base.profile, 'BOOTLIN_DIRECTORY_METADATA_V2_SOURCE');
  assert.equal(stages.length, 5);
  assert.equal(source.includes("const PROFILE = 'registered-bootlin-gcc-final-context-v1';"), true);
});

for (const [index, step] of STEPS.entries()) {
  test(`GCC graph pins the ordered ${step[0]} stage`, () => {
    pin(Buffer.from(stages[index]), step[4], step[5]);
    assert.equal((index ? stages[index - 1] : base.sourceText).split(step[1]).length - 1, step[3]);
    assert.equal(stages[index], (index ? stages[index - 1] : base.sourceText).split(step[1]).join(step[2]));
  });
}

test('GCC exposes fresh entry and policy without V1 or V2 public collector names', () => {
  assert.equal(typeof gcc.collectRegisteredBootlinGccFinalContextV1, 'function');
  assert.equal(typeof gcc.createBootlinDirectoryMetadataFixture, 'function');
  assert.equal(typeof gcc.SOURCE_BIND_PARENT_CLOCK_ORIGIN, 'function');
  for (const name of ['collectRegisteredBootlinDirectoriesV1', 'collectRegisteredBootlinDirectoriesV2',
    'BOOTLIN_DIRECTORY_METADATA_V1_PROFILE', 'BOOTLIN_DIRECTORY_METADATA_V2_PROFILE']) {
    assert.equal(Object.hasOwn(gcc, name), false);
    assert.equal(source.includes(name), false);
  }
});

test('GCC policy bytes bind the separately registered static child pair', () => {
  pin(Buffer.from(JSON.stringify(POLICY) + '\n'), 1067, 'e738e09ff89e8db2e0f23bce5c1bfa28f8dc6cd31398693d78bae90477d67bef');
  assert.equal(POLICY.profile, 'registered-bootlin-gcc-final-context-v1');
  assert.deepEqual(POLICY.urls, URLS);
  assert.deepEqual(POLICY.roles, ['sources', 'licenses']);
  frozenTree(POLICY);
});

test('GCC inherits explicit V2 caps and original deadline reserves unchanged', () => {
  assert.deepEqual(POLICY.limits, {
    requests: 2, headerPairs: 64, headerBytes: 16384,
    bodyBytes: 1048576, aggregateBodyBytes: 2097152,
    readsPerResponse: 1024, aggregateReads: 2048,
    requestMilliseconds: 10000, workMilliseconds: 27000,
    totalMilliseconds: 30000, cleanupReserveMilliseconds: 3000,
    outputBytes: 16777216, outputDepth: 64, outputNodes: 100000,
  });
  const bridge = base.sourceText.slice(base.sourceText.indexOf('\nlet SOURCE_PARENT_ORIGIN'));
  assert.ok(bridge.length > 0);
  assert.equal(source.endsWith(bridge), true);
});

test('GCC sourceRef retains accepted preparation and README pins without context authority', () => {
  assert.deepEqual(POLICY.sourceRef, {
    spec: '_spec/tooling/native-ingress/step2.puml', registration: '33',
    preparationBytes: 2724242,
    preparationSha256: '3ae1a4949a913b972695a32dfab2076354e49a70a960021a34050c63a9bb281b',
    rootReadmeBytes: 1093,
    rootReadmeSha256: 'fa0b24cb67e660a5aebe2f4d4705b5a7ca2e5860e2e0405ddf6fddad40d4a41a',
    schemeSelection: 'fixed-https-upgrade-not-extracted-url',
    scope: 'ordinary-necessary-toolchain-preparation-directory-metadata',
    lifecycle: 'outside-offline-capture-build-runtime',
  });
  assert.equal(Object.hasOwn(POLICY, 'contextEvidence'), false);
});

test('accepted root listing bytes bind both literal child references without traversal', () => {
  assert.equal(roots.profile, 'BOOTLIN_DIRECTORY_METADATA_V2_RESULT');
  assert.equal(roots.status, 'BOOTLIN_DIRECTORY_METADATA_V2_DATA');
  assert.equal(roots.collection.profile, 'registered-bootlin-directories-v2');
  assert.equal(roots.collection.mockOnly, false);
  assert.equal(roots.collection.counts.fetchCalls, 2);
  assert.equal(roots.collection.counts.completedObservations, 2);
  assert.equal(roots.collection.licenseComplianceVerified, false);
  assert.equal(roots.collection.observations.length, 2);
  const bodyPins = [
    [71655, '3ec2ebb752d98768658645ad0beeb02d6c3152c5c0e7fb73d1e567f1c3a5f177'],
    [54483, 'beb1ac11371a08f2ad5f85b9a25d8c1a38624acfe9b69c85c56e6f6afdafb738'],
  ];
  for (const [index, observation] of roots.collection.observations.entries()) {
    const bytes = Buffer.from(observation.bodyUtf8, 'utf8');
    pin(bytes, ...bodyPins[index]);
    assert.equal(observation.observedBodyBytes, bytes.length);
    assert.equal(observation.bodySha256, sha256(bytes));
    assert.equal(observation.eof, true);
    assert.equal(observation.status, 200);
    assert.equal(observation.requestedUrl, URLS[index].replace('gcc-final-15.3.0/', ''));
    assert.equal(observation.responseUrl, observation.requestedUrl);
    assert.equal(observation.bodyUtf8.split('href="gcc-final-15.3.0/"').length - 1, 1);
    assert.equal(observation.urlsFollowed, false);
    assert.equal(observation.interpreted, false);
    assert.equal(observation.licenseComplianceVerified, false);
  }
});

test('accepted root receipt remains separately pinned JSON custody data', () => {
  assert.ok(rootReceipt && typeof rootReceipt === 'object');
  assert.match(JSON.stringify(rootReceipt), /c5cdf65b6ad92de0eeb379017bff4464bed8136340394b1dc8f3b36c67699f61/);
});

test('GNU declaration preserves both duplicate GCC rows and distinct license cells', () => {
  const rows = proposal.distributionDeclarations.rows.filter(row => row.packageLabel === 'gcc-final');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row.ordinal), [1, 8]);
  for (const row of rows) {
    assert.equal(row.cells[0], 'gcc-final');
    assert.equal(row.cells[1], '15.3.0');
  }
  assert.notDeepEqual(rows[0].cells.slice(2), rows[1].cells.slice(2));
});

test('fake success performs only two closed GETs and never follows HTML links', async () => {
  const text = '<html><a href="https://unselected.invalid/archive.tar">source</a><script src="bundle.js"></script></html>';
  const f = fixture({ responses: [{ text }, { text }] });
  const result = await f.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.mockOnly, true);
  assert.equal(result.data.profile, POLICY.profile);
  assert.deepEqual(f.calls.map(call => call.url), URLS);
  for (const { init } of f.calls) {
    assert.deepEqual(Object.keys(init).sort(), ['cache', 'credentials', 'headers', 'method', 'redirect', 'referrer', 'referrerPolicy', 'signal']);
    assert.deepEqual({ ...init, signal: undefined }, {
      method: 'GET', redirect: 'manual', credentials: 'omit', cache: 'no-store',
      referrer: '', referrerPolicy: 'no-referrer',
      headers: { Accept: 'text/html', 'Accept-Encoding': 'identity' }, signal: undefined,
    });
    assert.equal(init.signal instanceof AbortSignal, true);
  }
  assert.notEqual(f.calls[0].init.signal, f.calls[1].init.signal);
  for (const [index, observation] of result.data.observations.entries()) {
    assert.equal(observation.requestedUrl, URLS[index]);
    assert.equal(observation.bodyUtf8, text);
    assert.equal(observation.bodySha256, sha256(Buffer.from(text)));
    assert.equal(observation.eof, true);
    assert.equal(observation.interpreted, false);
    assert.equal(observation.urlsFollowed, false);
  }
  assert.deepEqual(f.delays, [30000, 10000, 10000]);
  assert.equal(f.timers.size, 0);
  assert.equal(result.data.counts.eofObservations, 2);
  assert.equal(result.data.counts.releases, 2);
  assert.equal(result.data.counts.activeTimers, 0);
  frozenTree(result);
});

test('success grants no source, legal, runtime, native, image, or training qualification', async () => {
  const { data } = await fixture().run();
  for (const key of ['sourceAuthenticated', 'publisherAuthenticated', 'sourceRootAuthentication',
    'licenseComplianceVerified', 'pythonFreeSubsetVerified', 'runtimeProvidersQualified',
    'abiVerified', 'imagePrepared', 'nativeQualified', 'rustReady', 'trainingReady',
    'hardDeadlineGuaranteed', 'hardRssBounded', 'wireByteBounded', 'rawWireHeadersObserved',
    'transportClosureVerified', 'ioIsolated', 'secureErasureVerified']) assert.equal(data[key], false, key);
});

test('independent GCC fixtures hold independent one-shot latches', async () => {
  const first = fixture(), second = fixture();
  assert.equal((await first.run()).exitCode, 0);
  withheld(await first.run(), 'E_ARGUMENTS');
  assert.equal(first.calls.length, 2);
  assert.equal((await second.run()).exitCode, 0);
  assert.equal(second.calls.length, 2);
});

test('unexpected run arguments consume only that fixture without fetch admission', async () => {
  const f = fixture();
  withheld(await f.run({}), 'E_ARGUMENTS');
  withheld(await f.run(), 'E_ARGUMENTS');
  assert.equal(f.calls.length, 0);
  assert.equal((await fixture().run()).exitCode, 0);
});

test('fixture requires explicit mockOnly and a complete closed capability record', () => {
  const f = fixture();
  for (const config of [{ mockOnly: false }, {}, { mockOnly: true, extra: true }]) {
    assert.throws(() => gcc.createBootlinDirectoryMetadataFixture(config, f.dependencies), /E_MOCK_TCB/);
  }
  for (const key of Object.keys(f.dependencies)) {
    const partial = { ...f.dependencies };
    delete partial[key];
    assert.throws(() => gcc.createBootlinDirectoryMetadataFixture({ mockOnly: true }, partial), /E_MOCK_TCB/);
  }
  assert.throws(() => gcc.createBootlinDirectoryMetadataFixture({ mockOnly: true }), /E_MOCK_TCB/);
});

test('fixture refuses accessor and proxy capabilities without executing them', () => {
  const f = fixture();
  let accessed = false;
  const dependencies = { ...f.dependencies };
  Object.defineProperty(dependencies, 'fetch', { get() { accessed = true; return f.dependencies.fetch; } });
  assert.throws(() => gcc.createBootlinDirectoryMetadataFixture({ mockOnly: true }, dependencies), /E_MOCK_TCB/);
  assert.equal(accessed, false);
  assert.throws(() => gcc.createBootlinDirectoryMetadataFixture({ mockOnly: true }, new Proxy(f.dependencies, {})), /E_MOCK_TCB/);
});

test('fixture never admits real global capabilities as a missing-dependency fallback', () => {
  const f = fixture();
  for (const [key, method] of [
    ['fetch', globalThis.fetch], ['now', performance.now],
    ['setTimeout', globalThis.setTimeout], ['clearTimeout', globalThis.clearTimeout],
  ]) {
    assert.throws(() => gcc.createBootlinDirectoryMetadataFixture({ mockOnly: true }, {
      ...f.dependencies, [key]: method,
    }), /E_MOCK_TCB/);
  }
  assert.equal(f.calls.length, 0);
});

for (const [name, fields] of [
  ['wrong URL', { url: 'https://unselected.invalid/' }],
  ['redirect', { redirected: true }],
  ['redirect status', { status: 302 }],
  ['opaque response', { type: 'opaque' }],
  ['script content type', { headers: [['Content-Type', 'application/javascript']] }],
  ['compressed content', { headers: [['Content-Type', 'text/html'], ['Content-Encoding', 'gzip']] }],
  ['duplicate header', { headers: [['Content-Type', 'text/html'], ['content-type', 'text/html']] }],
]) {
  test(`fake ${name} withholds all bodies and admits no second request`, async () => {
    const f = fixture({ responses: [{ fields }] });
    withheld(await f.run(), 'E_HEADERS');
    assert.equal(f.calls.length, 1);
    assert.equal(f.replies[0].counters.reads, 0);
    assert.equal(f.replies[0].counters.cancels, 1);
    assert.equal(f.timers.size, 0);
  });
}

test('fake second response failure withholds the completed first HTML body too', async () => {
  const f = fixture({ responses: [{}, { fields: { status: 503 } }] });
  const result = await f.run();
  withheld(result, 'E_HEADERS');
  assert.equal(result.data.counts.completedObservations, 1);
  assert.equal(f.calls.length, 2);
  assert.equal(f.replies[0].counters.releases, 1);
  withheld(await f.run(), 'E_ARGUMENTS');
  assert.equal(f.calls.length, 2);
});

test('fake fetch rejection stops once with no retry or global fallback', async () => {
  const f = fixture({ fetch() { throw new Error('fake-fetch-failure'); } });
  withheld(await f.run(), 'E_FETCH');
  withheld(await f.run(), 'E_ARGUMENTS');
  assert.equal(f.calls.length, 1);
});

test('fake body read failure withholds metadata and releases its reader', async () => {
  const f = fixture({ responses: [{ readError: true }] });
  withheld(await f.run(), 'E_BODY');
  assert.equal(f.replies[0].counters.cancels, 1);
  assert.equal(f.replies[0].counters.releases, 1);
  assert.equal(f.calls.length, 1);
});

test('fake UTF-8 failure withholds metadata after EOF', async () => {
  const f = fixture({ responses: [{ chunks: [Buffer.from([0xc3, 0x28])] }] });
  withheld(await f.run(), 'E_UTF8');
  assert.equal(f.calls.length, 1);
});

test('fake body control characters remain invalid metadata rather than executable input', async () => {
  const f = fixture({ responses: [{ text: '<html>\u0000</html>' }] });
  withheld(await f.run(), 'E_UTF8');
  assert.equal(f.calls.length, 1);
});

test('fake body byte accessors cannot substitute an unaccounted chunk', async () => {
  let accessed = false;
  const chunk = Buffer.from('metadata');
  Object.defineProperty(chunk, 'byteLength', { get() { accessed = true; return 0; } });
  const f = fixture({ responses: [{ chunks: [chunk] }] });
  withheld(await f.run(), 'E_BODY');
  assert.equal(accessed, false);
  assert.equal(f.calls.length, 1);
});

test('fake declared length mismatch withholds metadata', async () => {
  const f = fixture({ responses: [{ fields: { headers: [['Content-Type', 'text/html'], ['Content-Length', '1']] } }] });
  withheld(await f.run(), 'E_BODY');
});

test('GCC accepts bodies above old 64 KiB cap under the selected V2 caps', async () => {
  const f = fixture({ responses: [{ text: 'a'.repeat(65537) }, { text: 'b'.repeat(65537) }] });
  const result = await f.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.counts.retainedBytes, 131074);
});

test('GCC accepts exact 1 MiB bodies and exact 2 MiB aggregate', async () => {
  const f = fixture({ responses: [{ text: 'a'.repeat(1048576) }, { text: 'b'.repeat(1048576) }] });
  const result = await f.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.counts.retainedBytes, 2097152);
  assert.equal(result.data.observations.length, 2);
});

test('GCC rejects an oversized delivered chunk before retaining it', async () => {
  const f = fixture({ responses: [{ chunks: [Buffer.alloc(1048577, 97)] }] });
  const result = await f.run();
  withheld(result, 'E_LIMIT');
  assert.equal(result.data.counts.deliveredBytes, 1048577);
  assert.equal(result.data.counts.retainedBytes, 0);
  assert.equal(result.data.counts.rejectedChunks, 1);
  assert.equal(f.calls.length, 1);
});

test('GCC rejects cumulative per-body overflow and withholds both observations', async () => {
  const f = fixture({ responses: [{}, { chunks: [Buffer.alloc(1048576, 97), Buffer.from('b')] }] });
  const result = await f.run();
  withheld(result, 'E_LIMIT');
  assert.equal(result.data.counts.completedObservations, 1);
  assert.equal(result.data.counts.rejectedChunks, 1);
  assert.equal(f.calls.length, 2);
});

test('declared length over 1 MiB fails before reading a body', async () => {
  const f = fixture({ responses: [{ fields: { headers: [['Content-Type', 'text/html'], ['Content-Length', '1048577']] } }] });
  withheld(await f.run(), 'E_LIMIT');
  assert.equal(f.replies[0].counters.reads, 0);
});

test('GCC retains the 64-pair exposed header cap before body admission', async () => {
  const headers = [['Content-Type', 'text/html'], ...Array.from({ length: 64 }, (_, index) => [`X-Fake-${index}`, 'a'])];
  const f = fixture({ responses: [{ fields: { headers } }] });
  withheld(await f.run(), 'E_LIMIT');
  assert.equal(f.replies[0].counters.reads, 0);
  assert.equal(f.calls.length, 1);
});

test('finite read budget includes EOF and rejects an unterminated fake stream', async () => {
  const f = fixture({ responses: [{ chunks: Array.from({ length: 1024 }, () => Buffer.alloc(0)) }] });
  const result = await f.run();
  withheld(result, 'E_LIMIT');
  assert.equal(result.data.counts.readAttempts, 1024);
  assert.equal(result.data.counts.eofObservations, 0);
});

test('GCC output permits escaped control-free HTML beyond old 1 MiB result cap', async () => {
  const f = fixture({ responses: [{ text: '"'.repeat(600000) }, { text: '"'.repeat(600000) }] });
  const result = await f.run();
  assert.equal(result.exitCode, 0);
  const serialized = JSON.stringify(result.data) + '\n';
  assert.ok(serialized.length > 1048576 && serialized.length < 16777216);
});

test('fake request deadline at the exact boundary stops without retry', async () => {
  let setTime;
  const f = fixture({ responses: [{ onRead() { setTime(10100); } }] });
  setTime = f.setTime;
  withheld(await f.run(), 'E_DEADLINE');
  assert.equal(f.calls.length, 1);
  assert.equal(f.timers.size, 0);
});

test('fake second admission uses original work deadline instead of restarting it', async () => {
  let f;
  f = fixture({ responses: [{ onRead(count) { if (count === 2) f.setTime(10099); } }, {}],
    fetch({ calls, replies, setTime }) {
      if (calls.length === 2) setTime(27100);
      return replies[calls.length - 1].value;
    } });
  const result = await f.run();
  withheld(result, 'E_DEADLINE');
  assert.equal(result.data.counts.completedObservations, 1);
  assert.equal(f.calls.length, 2);
  assert.equal(f.replies[1].counters.reads, 0);
});

test('fake timer expiry reports pending transport rather than claiming closure', async () => {
  const f = fixture({ fetch({ timers }) {
    [...timers.values()].at(-1).callback();
    return new Promise(() => {});
  } });
  const result = await f.run();
  withheld(result, 'E_DEADLINE');
  assert.equal(result.data.counts.pendingFetchKnown, true);
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(result.data.counts.transportClosedVerified, false);
  assert.equal(f.calls.length, 1);
});

test('fake unexpected clearTimeout return withholds bodies and marks uncertain cleanup', async () => {
  const f = fixture({ clearResult: 1 });
  const result = await f.run();
  withheld(result, 'E_CLEANUP');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(f.calls.length, 1);
});

test('fake backward clock is rejected without silently resetting deadlines', async () => {
  let calls = 0;
  const f = fixture({ now() { return calls++ ? 99 : 100; } });
  withheld(await f.run(), 'E_CLOCK');
  assert.equal(f.calls.length, 0);
});

let capabilitySequence = 0;
async function fakeProduction() {
  const capabilityUri = dataUri(`
export const state = { time: 100, calls: [], timers: new Map(), next: 0 };
export const clock = { now() { return state.time; } };
export function fetch(url, init) {
  state.calls.push({ url, init });
  let done = false;
  return { status: 200, redirected: false, type: 'basic', url,
    headers: [['Content-Type', 'text/html']],
    body: { getReader() { return {
      read() { if (done) return { done: true }; done = true; return { done: false, value: new Uint8Array([97]) }; },
      cancel() { return Promise.resolve(); }, releaseLock() {},
    }; }, cancel() { return Promise.resolve(); } },
  };
}
export function setTimeout(callback, delay) { const id = ++state.next; state.timers.set(id, { callback, delay }); return id; }
export function clearTimeout(id) { state.timers.delete(id); }
// GCC fake capability instance ${++capabilitySequence}
`);
  const capabilities = await import(capabilityUri);
  let instrumented = source;
  for (const [oldText, newText] of [
    ['const FETCH = globalThis.fetch;', 'const FETCH = GCC_TEST_CAP.fetch;'],
    ['const NOW = performance.now;', 'const NOW = GCC_TEST_CAP.clock.now;'],
    ['const CLOCK = performance;', 'const CLOCK = GCC_TEST_CAP.clock;'],
    ['const SET_TIMEOUT = globalThis.setTimeout;', 'const SET_TIMEOUT = GCC_TEST_CAP.setTimeout;'],
    ['const CLEAR_TIMEOUT = globalThis.clearTimeout;', 'const CLEAR_TIMEOUT = GCC_TEST_CAP.clearTimeout;'],
  ]) {
    assert.equal(instrumented.split(oldText).length - 1, 1);
    instrumented = instrumented.replace(oldText, newText);
  }
  const module = await import(dataUri(`import * as GCC_TEST_CAP from ${JSON.stringify(capabilityUri)};\n${instrumented}`));
  return { module, ...capabilities };
}

test('fresh GCC production bridge executes only complete fake capabilities with original origin', async () => {
  const f = await fakeProduction();
  f.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(100);
  const result = await f.module.collectRegisteredBootlinGccFinalContextV1();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.mockOnly, false);
  assert.deepEqual(f.state.calls.map(call => call.url), URLS);
  assert.equal(f.state.timers.size, 0);
  assert.equal((await f.module.collectRegisteredBootlinGccFinalContextV1()).data.error, 'E_ARGUMENTS');
  assert.equal(f.state.calls.length, 2);
});

test('original parent origin prevents a late GCC start from gaining a fresh work window', async () => {
  const f = await fakeProduction();
  f.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(100);
  f.state.time = 27100;
  const result = await f.module.collectRegisteredBootlinGccFinalContextV1();
  assert.equal(result.exitCode, 1);
  assert.equal(result.data.error, 'E_DEADLINE');
  assert.equal(Object.hasOwn(result.data, 'observations'), false);
  assert.equal(f.state.calls.length, 0);
});

test('original clock binding rejects stale origins and rebinding without fetch', async () => {
  const stale = await fakeProduction();
  stale.state.time = 10100;
  assert.throws(() => stale.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(100), /E_CLOCK/);
  const fresh = await fakeProduction();
  fresh.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(100);
  assert.throws(() => fresh.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(100), /E_CLOCK/);
  assert.equal(stale.state.calls.length, 0);
  assert.equal(fresh.state.calls.length, 0);
});

test('unbound fresh GCC production clock cannot admit a fake request', async () => {
  const f = await fakeProduction();
  const result = await f.module.collectRegisteredBootlinGccFinalContextV1();
  assert.equal(result.data.error, 'E_CLOCK');
  assert.equal(f.state.calls.length, 0);
});

test('distinct fresh GCC graphs do not share production latches or clock bindings', async () => {
  const first = await fakeProduction(), second = await fakeProduction();
  first.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(100);
  second.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(100);
  assert.equal((await first.module.collectRegisteredBootlinGccFinalContextV1({})).data.error, 'E_ARGUMENTS');
  assert.equal((await first.module.collectRegisteredBootlinGccFinalContextV1()).data.error, 'E_ARGUMENTS');
  assert.equal(first.state.calls.length, 0);
  assert.equal((await second.module.collectRegisteredBootlinGccFinalContextV1()).exitCode, 0);
  assert.equal(second.state.calls.length, 2);
});

async function parentPacket() {
  const canonical = (await load('_spec/_plans/ml-runtime-redesign.md')).toString('utf8');
  const matches = [...canonical.matchAll(/<!-- BEGIN STEP2 GCC FINAL CONTEXT V1 -->([\s\S]*?)<!-- END STEP2 GCC FINAL CONTEXT V1 -->/g)];
  assert.equal(matches.length, 1, 'canonical registration must contain exactly one completed GCC packet');
  return matches[0][1];
}

test('canonical GCC packet statically registers every ordered graph and policy pin', async () => {
  const packet = await parentPacket();
  let previous = -1;
  for (const [, , , , bytes, digest] of STEPS) {
    const at = packet.indexOf(digest);
    assert.ok(at > previous, `ordered stage ${digest}`);
    assert.match(packet, new RegExp(String(bytes)));
    previous = at;
  }
  assert.match(packet, /e738e09ff89e8db2e0f23bce5c1bfa28f8dc6cd31398693d78bae90477d67bef/);
  assert.match(packet, /1067/);
  for (const url of URLS) assert.ok(packet.includes(url));
  assert.match(packet, /gccSteps/);
});

test('canonical GCC packet binds whole parent evidence and both unresolved declaration rows', async () => {
  const packet = await parentPacket();
  for (const digest of [sha256(rootBytes), sha256(proposalBytes),
    '3ec2ebb752d98768658645ad0beeb02d6c3152c5c0e7fb73d1e567f1c3a5f177',
    'beb1ac11371a08f2ad5f85b9a25d8c1a38624acfe9b69c85c56e6f6afdafb738']) assert.ok(packet.includes(digest));
  assert.match(packet, /DISTRIBUTION_DECLARATION/);
  assert.match(packet, /UNRESOLVED/);
  assert.match(packet, /packageContext/);
  assert.match(packet, /gcc-final/);
  assert.match(packet, /15\.3\.0/);
});

test('canonical GCC packet pins writer and fresh output custody without launcher execution', async () => {
  const packet = await parentPacket();
  for (const value of ['bootlin-gcc-final-context', 'bootlin-gcc-final-context-v1.result.json',
    '35e337183714fa2b6960dc38cb80dfcc605efd320ca72d2d3dcd745fc33a1bc4',
    '29690c60a66ec950c658e2f4d93c3d686a05ef4a57184b98426874455986b0d3',
    '9e3d6d84e58d5e86a3097a4d8a731dcef9c922622b1fc225acf0385b218f41aa',
    'O_NOFOLLOW', 'SOURCE_BIND_PARENT_CLOCK_ORIGIN',
    'collectRegisteredBootlinGccFinalContextV1']) assert.ok(packet.includes(value), value);
  assert.match(packet, /3043136/);
  assert.match(packet, /3043142/);
  assert.match(packet, /published\.mode !== '0444'/);
  assert.match(packet, /published\.counts\.closes !== 3/);
  assert.match(packet, /published\.counts\.fsyncs !== 4/);
  assert.match(packet, /published\.readbackVerified !== true/);
  assert.match(packet, /published\.directorySynced !== true/);
  assert.match(packet, /published\.counts\.readbackHashBytes !== bytes\.length/);
  assert.match(packet, /state\.closeFailed !== false/);
  assert.match(packet, /retainedFilesUnaccepted:true/);
  const reservation = packet.indexOf("publisher = writer.reserveSplitEvidencePublication('bootlin-gcc-final-context'");
  const evidence = packet.indexOf('const preparation = capture(');
  const binding = packet.indexOf('module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(started)');
  const invocation = packet.indexOf('await module.collectRegisteredBootlinGccFinalContextV1()');
  assert.ok(reservation > 0 && reservation < evidence && evidence < binding && binding < invocation);
});

test('canonical GCC packet cannot invoke the consumed root V1 or V2 collectors', async () => {
  const packet = await parentPacket();
  assert.doesNotMatch(packet, /\bcollectRegisteredBootlinDirectoriesV[12]\s*\(/);
  assert.doesNotMatch(packet, /\b(?:unlink|unlinkSync|rmSync|rmdirSync)\s*\(/);
  assert.doesNotMatch(packet, /\bfetch\s*\(/);
});

test('canonical GCC parent retains bounded capture counters and whole-file admission order', async () => {
  const packet = await parentPacket();
  for (const clause of ['allocated + length + 1 > 8388608', '++reads > 128',
    'captures !== 6', 'captureCloses !== 6', 'returned !== 3043136',
    'requested !== 3043142', 'allocated !== 3043142', 'before.nlink !== 1n',
    'fs.constants.O_NONBLOCK', 'if (sha(bytes) !== pin)',
    "fields = ['dev','ino','mode','uid','gid','nlink','size','mtimeNs','ctimeNs']"]) assert.ok(packet.includes(clause), clause);
  for (const [capture, parse] of [
    ["capture(DIR + 'bootlin-source-license-directories-v2.result.json',138884,", 'JSON.parse(rootBytes)'],
    ["capture(DIR + 'gnu-preparation-plan-v1.result.json',136598,", 'JSON.parse(proposalBytes)'],
  ]) {
    assert.ok(packet.indexOf(capture) > 0);
    assert.ok(packet.indexOf(parse) > packet.indexOf(capture));
  }
});

test('canonical GCC parent keeps result admission and qualifications outside runtime authority', async () => {
  const packet = await parentPacket();
  for (const clause of ['sourceAuthenticated:false', 'publisherAuthenticated:false',
    'licenseComplianceVerified:false', 'pythonFreeSubsetVerified:false',
    'runtimeProvidersQualified:false', 'abiVerified:false', 'imagePrepared:false',
    'nativeQualified:false', 'rustReady:false', 'trainingReady:false',
    'c.retainedBytes > 2097152', 'c.peakDeliveredChunkBytes > 1048576',
    'bytes.length > 16777216', 'o.status !== 200', 'o.eof !== true',
    'o.urlsFollowed !== false', 'o.interpreted !== false',
    'source === true ? 10000 : 27000', 'performance.now() - started >= 30000',
    'outside offline capture/build/runtime']) assert.ok(packet.includes(clause), clause);
  assert.equal(packet.split('await module.collectRegisteredBootlinGccFinalContextV1()').length - 1, 1);
});
