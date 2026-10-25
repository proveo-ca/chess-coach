// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as builder from './bootlin-gcc-notices-v2.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ownSource = readFileSync(new URL('./bootlin-gcc-notices-v2.mjs', import.meta.url), 'utf8');
const directoryBuilderBytes = readFileSync(new URL('./bootlin-directory-metadata-v2.mjs', import.meta.url));
assert.equal(directoryBuilderBytes.length, 5760);
assert.equal(hash(directoryBuilderBytes), 'd09558231e7ea5f27c2ed0d1b34c599c087bc34a4c6e5e75e3e4ecf3f1ff9f80');
const directoryBuilder = await import('./bootlin-directory-metadata-v2.mjs');
const noticeBuilderBytes = readFileSync(new URL('./bootlin-gcc-notices-source.mjs', import.meta.url));
assert.equal(noticeBuilderBytes.length, 6707);
assert.equal(hash(noticeBuilderBytes), '5688445c67f6c7ea92784d5727302e7b454923fa4bfda5ed1864e1659a614757');
const noticeBuilder = await import('./bootlin-gcc-notices-source.mjs');
const rawBytes = readFileSync(new URL('./bootlin-directory-metadata.mjs', import.meta.url));
assert.equal(rawBytes.length, 19649);
assert.equal(hash(rawBytes), '1a625ec28479ac28efeaa19a51095924f7db5c48524a1cd74570e0c4b7f3890f');
const base = noticeBuilder.buildBootlinGccNoticesSource(directoryBuilder.buildBootlinDirectoryMetadataV2Source(rawBytes).sourceText).sourceText;
assert.equal(base.length, 21227);
assert.equal(hash(base), 'ab907eccc60c8f58c351ca82b449d2fd774c96e343e07cf49ceda74b86e77a44');
const { buildBootlinGccNoticesV2Source: build, BOOTLIN_GCC_NOTICES_V2_PINS: pins } = builder;
const image = build(base);
const FINAL = '6b0dbb219859300b7c5530d314f6d6fa1a6d1ff1146400af92ed707134239866';
const POLICY_HASH = '227acf8ed390f17ccece2691fd11e8d05d5d589a59878b67925bd0e2a0275abd';
const FILES = ['COPYING', 'COPYING.LIB', 'COPYING.RUNTIME', 'COPYING3', 'COPYING3.LIB'];
const URLS = FILES.map(name => `https://toolchains.bootlin.com/downloads/releases/licenses/gcc-final-15.3.0/${name}`);
const STAGES = [
  ['profile', "const PROFILE = 'registered-bootlin-gcc-notices-v1';", "const PROFILE = 'registered-bootlin-gcc-notices-v2';", 1, 21227, '222c7415fe8e2e225195423fc4bfa5970a0d32a4d9834eadd046b8d0494cb48d'],
  ['entryNames', 'collectRegisteredBootlinGccNoticesV1', 'collectRegisteredBootlinGccNoticesV2', 2, 21227, 'b462226f68d322e7018724066f440e25e45595ff7dd19ca677dfdcd81cae33e2'],
  ['policyNames', 'BOOTLIN_GCC_NOTICES_V1_PROFILE', 'BOOTLIN_GCC_NOTICES_V2_PROFILE', 2, 21227, '73bd42d3a8abaa7cc12362cd2fe97e2e9a017c9b2f95d877843b9af696d9d4ac'],
  ['absentPolicy', "  bodyFormat: 'LICENSE_NOTICE_TEXT',\n  allowedBodyControls: [9, 10, 12, 13],", "  bodyFormat: 'LICENSE_NOTICE_TEXT',\n  absentMediaAllowed: true,\n  allowedBodyControls: [9, 10, 12, 13],", 1, 21255, 'e14883d54334242f8d5c15afe11a05315d90bb9cc3e20daf04f4384055488ebc'],
  ['declaration', "  const media = selected.get('content-type') ?? '';", "  const contentTypeExposed = selected.has('content-type');\n  const media = contentTypeExposed ? selected.get('content-type') : null;", 1, 21336, '4eb87061dd2d5756a242696eac537aab5f7c4ab74f830b3cc0636afd61918456'],
  ['acceptance', String.raw`  check(/^(?:text\/plain(?: *; *charset *= *(?:utf-8|utf8|us-ascii))?|application\/octet-stream)$/i.test(media), 'E_HEADERS');`, String.raw`  check(media === null || /^(?:text\/plain(?: *; *charset *= *(?:utf-8|utf8|us-ascii))?|application\/octet-stream)$/i.test(media), 'E_HEADERS');`, 1, 21354, 'dadbf9b890863e23086ee4138d29bb15eeb63841f7ab113a44372d10ea6aa1c5'],
  ['headerRecord', '  return { pairs, length, asciiOnly };', '  return { pairs, length, asciiOnly, contentTypeExposed, declaredContentType: media };', 1, 21402, '78746045d9d2ae92ef4b128eb7b1cb6a835749946e95e16d5e85901f14125a45'],
  ['observation', '        exposedHeaders: metadata.pairs, observedBodyBytes: bytes, bodySha256, bodyUtf8: text,', '        exposedHeaders: metadata.pairs, observedBodyBytes: bytes, bodySha256, bodyUtf8: text,\n        contentTypeExposed: metadata.contentTypeExposed, declaredContentType: metadata.declaredContentType,', 1, 21510, FINAL],
];
let expectedSource = base;
for (const [name, oldText, newText, count, bytes, digest] of STAGES) {
  const parts = expectedSource.split(oldText);
  assert.equal(parts.length, count + 1);
  expectedSource = parts.join(newText);
  assert.equal(expectedSource.length, bytes);
  assert.equal(hash(expectedSource), digest);
  assert.deepEqual(image.graphPins[name], { bytes, sha256: digest });
}
assert.equal(image.sourceText, expectedSource);
assert.equal(Buffer.byteLength(image.sourceText), 21510);
assert.equal(hash(image.sourceText), FINAL);
let serial = 0;
function uri(source) {
  return `data:text/javascript;base64,${Buffer.from(`${source}\n// TEST ${serial++}\n`).toString('base64')}`;
}
async function importImage(instrument = source => source) {
  assert.equal(image.sourceText.length, 21510);
  assert.equal(hash(image.sourceText), FINAL);
  return import(uri(instrument(image.sourceText)));
}
const notices = await importImage();
const POLICY = notices.BOOTLIN_GCC_NOTICES_V2_PROFILE;
assert.equal(Buffer.byteLength(`${JSON.stringify(POLICY)}\n`), 1494);
assert.equal(hash(`${JSON.stringify(POLICY)}\n`), POLICY_HASH);

function frozenTree(value) {
  if (value && typeof value === 'object') {
    assert.equal(Object.isFrozen(value), true);
    assert.equal(ArrayBuffer.isView(value), false);
    for (const child of Object.values(value)) frozenTree(child);
  } else assert.ok(['string', 'number', 'boolean'].includes(typeof value) || value === null);
}

function replaceOnce(source, oldText, newText) {
  assert.equal(source.split(oldText).length, 2);
  return source.replace(oldText, newText);
}

function harness(options = {}) {
  const state = {
    clock: options.clock ?? 0, calls: [], records: [], timers: new Map(), scheduled: [], cleared: [],
    activeFetches: 0, maximumFetches: 0,
  };
  const dependencies = {
    now() { return options.now ? options.now(state) : state.clock; },
    setTimeout(callback, delay) {
      const handle = { callback, delay, end: state.clock + delay };
      state.timers.set(handle, handle);
      state.scheduled.push(handle);
      return handle;
    },
    clearTimeout(handle) {
      state.timers.delete(handle);
      state.cleared.push(handle);
      return options.clearResult;
    },
    async fetch(url, init) {
      const index = state.calls.length;
      state.calls.push({ url, init });
      state.activeFetches++;
      state.maximumFetches = Math.max(state.maximumFetches, state.activeFetches);
      const spec = options.responses?.[index] ?? {};
      const record = { readers: 0, reads: 0, cancels: 0, releases: 0, eof: false };
      state.records.push(record);
      try {
        if (options.onFetch) await options.onFetch(state, index, init);
        if (spec.fetchError) throw new Error(spec.fetchError);
        if (spec.pendingFetch) return await new Promise(() => {});
        const bytes = spec.bytes ?? Buffer.from(`notice-${index}\t\n\f\rhttps://not-followed.invalid/source.tar.xz`);
        const chunks = spec.chunks ?? (bytes.length ? [bytes] : []);
        const reader = {
          async read() {
            const read = record.reads++;
            if (options.onRead) await options.onRead(state, index, read);
            if (spec.readError) throw new Error(spec.readError);
            if (spec.pendingRead) return new Promise(() => {});
            if (spec.readResult) return spec.readResult(read);
            if (read < chunks.length) return { done: false, value: chunks[read] };
            record.eof = true;
            return { done: true };
          },
          cancel() { record.cancels++; return spec.cancelPending ? new Promise(() => {}) : undefined; },
          releaseLock() { record.releases++; return spec.releaseResult; },
        };
        return {
          status: spec.status ?? 200, redirected: spec.redirected ?? false, type: spec.type ?? 'basic',
          url: spec.url ?? url,
          headers: Object.hasOwn(spec, 'headers') ? spec.headers : [['content-type', spec.media ?? 'text/plain; charset=utf-8']],
          body: {
            getReader() { record.readers++; return reader; },
            cancel() { record.cancels++; return undefined; },
          },
        };
      } finally { state.activeFetches--; }
    },
  };
  const fixture = notices.createBootlinDirectoryMetadataFixture({ mockOnly: true }, dependencies);
  return { state, dependencies, run: fixture.run };
}

async function stopped(options, code, requests = 1) {
  const fixture = harness(options);
  const result = await fixture.run();
  assert.equal(result.exitCode, 1);
  assert.equal(result.data.profile, 'registered-bootlin-gcc-notices-v2');
  assert.equal(result.data.status, 'STOP');
  assert.equal(result.data.error, code);
  assert.equal(fixture.state.calls.length, requests);
  assert.equal(Object.hasOwn(result.data, 'observations'), false);
  assert.equal(Object.hasOwn(result.data, 'exposedHeaders'), false);
  frozenTree(result);
  return { ...fixture, result };
}

test('exact two-export pure builder returns an immutable string-only source image', () => {
  assert.deepEqual(Object.keys(builder).sort(), ['BOOTLIN_GCC_NOTICES_V2_PINS', 'buildBootlinGccNoticesV2Source']);
  assert.deepEqual(Object.keys(image), ['profile', 'sourceText', 'graphPins', 'policyPin']);
  assert.equal(image.profile, 'BOOTLIN_GCC_NOTICES_V2_SOURCE');
  assert.equal(Object.keys(pins).length, 10);
  frozenTree(pins);
  frozenTree(image);
  assert.throws(() => { pins.base.bytes = 1; }, TypeError);
  assert.throws(() => { image.sourceText = ''; }, TypeError);
  assert.deepEqual(build(base), image);
});

test('product imports only crypto and contains no I/O, evaluation, or allocation fallback', () => {
  assert.deepEqual([...ownSource.matchAll(/^import .+ from '([^']+)';$/gm)].map(match => match[1]), ['node:crypto']);
  assert.doesNotMatch(ownSource, /\b(?:process|fetch|eval|Function|readFile|writeFile|Buffer)\b|import\s*\(/);
});

test('arity and primitive length admission precede ASCII, digest, and transformations', () => {
  const admission = ownSource.slice(ownSource.indexOf('export function buildBootlinGccNoticesV2Source'));
  assert.ok(admission.indexOf('arguments.length') < admission.indexOf('typeof baseNoticeV1Source'));
  assert.ok(admission.indexOf('baseNoticeV1Source.length') < admission.indexOf('/[^'));
  assert.ok(admission.indexOf('/[^') < admission.indexOf('verify(baseNoticeV1Source'));
  assert.ok(admission.indexOf('verify(baseNoticeV1Source') < admission.indexOf('source = replace'));
});

test('invalid admissions cannot reach a hash or transform', async () => {
  let source = replaceOnce(ownSource, 'function verify(source, pin) {', "function verify(source, pin) { fail('E_UNEXPECTED_HASH');");
  source = replaceOnce(source, 'function replace(source, oldText, newText, count, pin) {', "function replace(source, oldText, newText, count, pin) { fail('E_UNEXPECTED_TRANSFORM');");
  const local = await import(uri(source));
  const entry = local.buildBootlinGccNoticesV2Source;
  for (const value of [null, new String(base), 'A'.repeat(2 ** 22), '\u00e9'.repeat(base.length), base.slice(1)]) {
    assert.throws(() => entry(value), /^Error: E_SOURCE$/);
  }
  assert.throws(() => entry(base, {}), /^Error: E_ARGUMENTS$/);
  assert.throws(() => entry(base), /^Error: E_UNEXPECTED_HASH$/);
});

for (const [name, value] of [
  ['undefined', undefined], ['null', null], ['number', 21227], ['boolean', true], ['array', [base]],
  ['buffer', Buffer.from(base)], ['boxed string', new String(base)], ['symbol', Symbol('source')], ['bigint', 21227n],
  ['huge ASCII', 'x'.repeat(2 ** 22)], ['huge Unicode', '\u{1f600}'.repeat(2 ** 20)],
  ['short source', base.slice(1)], ['long source', `${base} `],
  ['same-length non-ASCII', `\u00e9${base.slice(1)}`], ['same-length surrogate', `\ud800${base.slice(1)}`],
]) {
  test(`source admission rejects ${name}`, () => assert.throws(() => build(value), /^Error: E_SOURCE$/));
}

test('proxy and coercion hooks remain inert during admission', () => {
  const proxy = new Proxy(new String(base), { get() { assert.fail('proxy trap'); }, getPrototypeOf() { assert.fail('prototype trap'); } });
  assert.throws(() => build(proxy), /^Error: E_SOURCE$/);
  const { proxy: revoked, revoke } = Proxy.revocable({}, {});
  revoke();
  assert.throws(() => build(revoked), /^Error: E_SOURCE$/);
  assert.throws(() => build({ toString() { assert.fail('coercion'); } }), /^Error: E_SOURCE$/);
});

test('wrong arity rejects a hostile source before any property inspection', () => {
  const source = new Proxy({}, { get() { assert.fail('get'); }, getPrototypeOf() { assert.fail('prototype'); } });
  assert.throws(() => build(source, pins), /^Error: E_ARGUMENTS$/);
});

for (const args of [[], [base, undefined], [base, {}], [base, pins]]) {
  test(`arity ${args.length} rejects configuration overrides`, () => assert.throws(() => build(...args), /^Error: E_ARGUMENTS$/));
}

test('same-size ASCII mutation fails the root digest before transformation', () => {
  assert.throws(() => build(` ${base.slice(1)}`), /^Error: E_PIN$/);
  assert.equal(base.length, 21227);
  assert.equal(hash(base), pins.base.sha256);
});

for (const [stage, pin] of Object.entries(image.graphPins)) {
  test(`${stage} static byte pin fails closed`, async () => {
    const local = await import(uri(replaceOnce(ownSource, `${stage}: { bytes: ${pin.bytes},`, `${stage}: { bytes: ${pin.bytes + 1},`)));
    assert.throws(() => local.buildBootlinGccNoticesV2Source(base), stage === 'base' ? /^Error: E_SOURCE$/ : /^Error: E_PIN$/);
  });
  test(`${stage} static digest pin fails closed`, async () => {
    const local = await import(uri(replaceOnce(ownSource, pin.sha256, '0'.repeat(64))));
    assert.throws(() => local.buildBootlinGccNoticesV2Source(base), /^Error: E_PIN$/);
  });
}

for (const [stage, , , count, bytes, digest] of STAGES) {
  test(`${stage} exact transform count rejects cardinality drift`, async () => {
    const local = await import(uri(replaceOnce(ownSource, `, ${count}, graphPins.${stage});`, `, ${count + 1}, graphPins.${stage});`)));
    assert.throws(() => local.buildBootlinGccNoticesV2Source(base), /^Error: E_TRANSFORM$/);
  });
  test(`${stage} retains the independently supplied graph pin`, () => {
    assert.deepEqual(image.graphPins[stage], { bytes, sha256: digest });
  });
}

test('every intermediate verifies in order and all non-authorized bytes stay identical', async () => {
  const local = await import(uri(replaceOnce(ownSource, 'function verify(source, pin) {', 'export const TEST_STAGES = [];\nfunction verify(source, pin) { TEST_STAGES.push({ source, pin });')));
  const result = local.buildBootlinGccNoticesV2Source(base);
  let source = base;
  const expected = [base];
  for (const [, oldText, newText, count] of STAGES) {
    assert.equal(source.split(oldText).length, count + 1);
    source = source.split(oldText).join(newText);
    expected.push(source);
  }
  expected.push(source);
  assert.deepEqual(local.TEST_STAGES.map(record => record.source), expected);
  assert.equal(result.sourceText, source);
});

test('policy JSON-LF has the independently supplied 1494-byte pin', () => {
  const text = `${JSON.stringify(POLICY)}\n`;
  assert.equal(Buffer.byteLength(text), 1494);
  assert.equal(hash(text), POLICY_HASH);
  assert.deepEqual(image.policyPin, { bytes: 1494, sha256: POLICY_HASH });
  assert.deepEqual(POLICY.urls, URLS);
  assert.deepEqual(POLICY.roles, ['copying', 'copying-lib', 'runtime-exception', 'copying3', 'copying3-lib']);
  assert.equal(POLICY.profile, 'registered-bootlin-gcc-notices-v2');
  assert.equal(POLICY.bodyFormat, 'LICENSE_NOTICE_TEXT');
  assert.equal(POLICY.absentMediaAllowed, true);
  assert.deepEqual(POLICY.allowedBodyControls, [9, 10, 12, 13]);
  frozenTree(POLICY);
});

test('a mutated declared policy pin cannot qualify the actual generated policy', async () => {
  const local = await import(uri(replaceOnce(ownSource, POLICY_HASH, '0'.repeat(64))));
  assert.notEqual(hash(`${JSON.stringify(POLICY)}\n`), local.buildBootlinGccNoticesV2Source(base).policyPin.sha256);
});

test('caps and historical source references remain unchanged', () => {
  assert.deepEqual(POLICY.limits, {
    requests: 5, headerPairs: 64, headerBytes: 16384,
    bodyBytes: 1048576, aggregateBodyBytes: 2097152,
    readsPerResponse: 1024, aggregateReads: 2048,
    requestMilliseconds: 10000, workMilliseconds: 27000,
    totalMilliseconds: 30000, cleanupReserveMilliseconds: 3000,
    outputBytes: 16777216, outputDepth: 64, outputNodes: 100000,
  });
  assert.equal(POLICY.sourceRef.schemeSelection, 'fixed-https-upgrade-not-extracted-url');
  assert.equal(POLICY.sourceRef.scope, 'ordinary-necessary-toolchain-preparation-license-notices');
  assert.equal(POLICY.sourceRef.preparationBytes, 2724242);
  assert.equal(POLICY.sourceRef.preparationSha256, '3ae1a4949a913b972695a32dfab2076354e49a70a960021a34050c63a9bb281b');
  assert.equal(POLICY.sourceRef.rootReadmeBytes, 1093);
  assert.equal(POLICY.sourceRef.rootReadmeSha256, 'fa0b24cb67e660a5aebe2f4d4705b5a7ca2e5860e2e0405ddf6fddad40d4a41a');
});

test('new image exposes no prior root or notice entry or policy', () => {
  assert.deepEqual(Object.keys(notices).sort(), [
    'BOOTLIN_GCC_NOTICES_V2_PROFILE', 'SOURCE_BIND_PARENT_CLOCK_ORIGIN',
    'collectRegisteredBootlinGccNoticesV2', 'createBootlinDirectoryMetadataFixture',
  ]);
  for (const name of ['collectRegisteredBootlinDirectoriesV1', 'collectRegisteredBootlinDirectoriesV2', 'collectRegisteredBootlinGccNoticesV1', 'BOOTLIN_DIRECTORY_METADATA_V1_PROFILE', 'BOOTLIN_DIRECTORY_METADATA_V2_PROFILE', 'BOOTLIN_GCC_NOTICES_V1_PROFILE', 'production']) assert.equal(notices[name], undefined);
  assert.doesNotMatch(image.sourceText, /collectRegisteredBootlinDirectories|BOOTLIN_DIRECTORY_METADATA_V[12]_PROFILE|registered-bootlin-gcc-notices-v1/);
});

test('the original 794-byte parent-clock bridge remains identical', () => {
  const bridge = image.sourceText.slice(-794);
  assert.equal(bridge, base.slice(-794));
  assert.equal(hash(bridge), '28bbe878605dc95eaa7d15d27e1ae9d162c86a755e7d76f8f8e69a97291cf334');
});

test('five absent-media responses preserve exposure, body EOF, bytes, hash, order, and passive flags', async () => {
  const fixture = harness({ responses: FILES.map(() => ({ headers: [] })), onFetch(state, index) {
    if (index > 0) {
      assert.equal(state.records[index - 1].eof, true);
      assert.equal(state.records[index - 1].releases, 1);
      assert.equal(state.records[index - 1].cancels, 0);
    }
  } });
  const { data, exitCode } = await fixture.run();
  assert.equal(exitCode, 0);
  assert.equal(data.status, 'BOOTLIN_LICENSE_NOTICES_DATA');
  assert.equal(data.profile, 'registered-bootlin-gcc-notices-v2');
  assert.equal(data.mockOnly, true);
  assert.deepEqual(fixture.state.calls.map(call => call.url), URLS);
  assert.equal(fixture.state.maximumFetches, 1);
  assert.equal(data.observations.length, 5);
  for (const [index, observation] of data.observations.entries()) {
    assert.equal(observation.role, POLICY.roles[index]);
    assert.equal(observation.requestedUrl, URLS[index]);
    assert.equal(observation.sourceKind, 'PUBLIC_LICENSE_NOTICE_TEXT');
    assert.equal(observation.contentTypeExposed, false);
    assert.equal(observation.declaredContentType, null);
    assert.deepEqual(observation.exposedHeaders, []);
    assert.ok(observation.bodyUtf8.includes('\f'));
    assert.equal(hash(Buffer.from(observation.bodyUtf8)), observation.bodySha256);
    assert.equal(Buffer.byteLength(observation.bodyUtf8), observation.observedBodyBytes);
    assert.equal(observation.eof, true);
    assert.equal(observation.utf8Validated, true);
    for (const key of ['urlsFollowed', 'interpreted', 'sourceAuthenticated', 'licenseComplianceVerified']) assert.equal(observation[key], false);
  }
  for (const key of [
    'sourceAuthenticated', 'publisherAuthenticated', 'sourceRootAuthentication', 'licenseComplianceVerified',
    'pythonFreeSubsetVerified', 'runtimeProvidersQualified', 'abiVerified', 'imagePrepared', 'nativeQualified',
    'rustReady', 'trainingReady', 'hardDeadlineGuaranteed', 'hardRssBounded', 'wireByteBounded',
    'rawWireHeadersObserved', 'transportClosureVerified', 'ioIsolated', 'secureErasureVerified',
  ]) assert.equal(data[key], false);
  assert.equal(data.counts.requestsAttempted, 5);
  assert.equal(data.counts.fetchCalls, 5);
  assert.equal(data.counts.eofObservations, 5);
  assert.equal(data.counts.completedObservations, 5);
  assert.equal(data.counts.cancellations, 0);
  assert.equal(data.counts.releases, 5);
  assert.equal(data.counts.clearedTimers, 6);
  assert.equal(data.counts.activeTimers, 0);
  assert.equal(data.counts.transportClosedVerified, false);
  assert.deepEqual(fixture.state.scheduled.map(timer => timer.delay), [30000, 10000, 10000, 10000, 10000, 10000]);
  assert.equal(fixture.state.timers.size, 0);
  frozenTree(data);
});

test('all five requests keep the exact original GET options and never follow body links', async () => {
  const fixture = harness();
  assert.equal((await fixture.run()).exitCode, 0);
  assert.deepEqual(fixture.state.calls.map(call => call.url), URLS);
  for (const { init } of fixture.state.calls) {
    assert.deepEqual(Object.keys(init), ['method', 'redirect', 'credentials', 'cache', 'referrer', 'referrerPolicy', 'headers', 'signal']);
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'manual');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.referrer, '');
    assert.equal(init.referrerPolicy, 'no-referrer');
    assert.deepEqual(init.headers, { Accept: 'text/html', 'Accept-Encoding': 'identity' });
  }
});

test('mixed exposed and absent media record original exposed strings without a default MIME', async () => {
  const media = ['text/plain', null, 'application/octet-stream', 'TEXT/PLAIN ; CHARSET = UTF8', null];
  const fixture = harness({ responses: media.map(value => ({ headers: value === null ? [['content-length', '1']] : [['Content-Type', value]], bytes: Buffer.from('A') })) });
  const result = await fixture.run();
  assert.equal(result.exitCode, 0);
  for (const [index, observation] of result.data.observations.entries()) {
    assert.equal(observation.contentTypeExposed, media[index] !== null);
    assert.equal(observation.declaredContentType, media[index]);
    assert.deepEqual(observation.exposedHeaders, media[index] === null ? [['content-length', '1']] : [['Content-Type', media[index]]]);
  }
});

test('header helper uses Map.has to distinguish absence from exposed empty and null fields', async () => {
  const local = await importImage(source => `${source}\nexport const TEST_HEADERS = headersOf;`);
  const response = headers => ({ status: 200, redirected: false, type: 'basic', headers });
  assert.deepEqual(local.TEST_HEADERS(response([])), { pairs: [], length: null, asciiOnly: false, contentTypeExposed: false, declaredContentType: null });
  for (const value of ['', ' ', null, undefined, 0]) assert.throws(() => local.TEST_HEADERS(response([['content-type', value]])), /E_HEADERS/);
  assert.match(image.sourceText, /const contentTypeExposed = selected\.has\('content-type'\);/);
  assert.match(image.sourceText, /const media = contentTypeExposed \? selected\.get\('content-type'\) : null;/);
});

for (const media of ['text/plain', 'text/plain; charset=utf-8', 'text/plain; charset=utf8', 'text/plain; charset=us-ascii', 'TEXT/PLAIN ; CHARSET = US-ASCII', 'application/octet-stream']) {
  test(`five FF bodies accept exposed ${media}`, async () => {
    const fixture = harness({ responses: FILES.map(() => ({ media, bytes: Buffer.from('A\fB\t\r\n') })) });
    const result = await fixture.run();
    assert.equal(result.exitCode, 0);
    for (const observation of result.data.observations) {
      assert.equal(observation.bodyUtf8, 'A\fB\t\r\n');
      assert.equal(observation.contentTypeExposed, true);
      assert.equal(observation.declaredContentType, media);
    }
  });
}

for (let position = 1; position <= 5; position++) {
  for (const media of ['', ' ', 'text/html', 'text/plain; charset=latin1', 'text/plain; charset="utf-8"', 'text/plain; charset=utf-16', 'application/octet-stream; charset=utf-8', 'application/json']) {
    test(`exposed ${JSON.stringify(media)} at ${position}/5 fails before reading without later GET`, async () => {
      const responses = FILES.map((_, index) => index === position - 1 ? { media } : { headers: [] });
      const fixture = await stopped({ responses }, 'E_HEADERS', position);
      assert.equal(fixture.state.records.at(-1).readers, 0);
      assert.equal(fixture.state.records.at(-1).reads, 0);
      assert.equal(fixture.result.data.counts.completedObservations, position - 1);
    });
  }
}

for (const media of [null, 'text/plain', 'text/plain; charset=utf-8', 'application/octet-stream']) {
  test(`${media ?? 'absent media'} preserves BOM and FF bytes without interpretation`, async () => {
    const bytes = Buffer.from('\ufeffnotice\f\u00e9');
    const fixture = harness({ responses: FILES.map(() => ({ headers: media === null ? [] : [['content-type', media]], bytes })) });
    const result = await fixture.run();
    assert.equal(result.exitCode, 0);
    for (const observation of result.data.observations) {
      assert.equal(observation.bodyUtf8, '\ufeffnotice\f\u00e9');
      assert.equal(observation.bodySha256, hash(bytes));
      assert.equal(observation.observedBodyBytes, bytes.length);
    }
  });
}

for (const [name, bytes] of [['high bytes', Buffer.from('\u00e9')], ['BOM', Buffer.from('\ufeffA')], ['invalid high byte', Buffer.from([255])]]) {
  test(`US-ASCII still rejects ${name}`, async () => { await stopped({ responses: [{ media: 'text/plain; charset=us-ascii', bytes }] }, 'E_UTF8'); });
}

for (const [name, bytes] of [
  ['overlong UTF-8', Buffer.from([0xc0, 0xaf])], ['truncated UTF-8', Buffer.from([0xe2, 0x82])],
  ['invalid continuation', Buffer.from([0xff])], ['UTF-8 surrogate', Buffer.from([0xed, 0xa0, 0x80])],
  ['NUL', Buffer.from('A\0B')], ['ANSI escape', Buffer.from('\x1b[31m')], ['C1', Buffer.from('\u0085')],
  ['DEL', Buffer.from('\x7f')], ['vertical tab', Buffer.from('\x0b')], ['unit separator', Buffer.from('\x1f')],
]) {
  for (const absent of [false, true]) {
    test(`${absent ? 'absent' : 'present'} media cannot bypass ${name} rejection`, async () => {
      await stopped({ responses: [{ bytes, ...(absent ? { headers: [] } : {}) }] }, 'E_UTF8');
    });
  }
}

for (const [name, bytes, error] of [['empty', Buffer.alloc(0), 'E_BODY'], ['FF only', Buffer.from('\f'), null], ['zero digit', Buffer.from('0'), null]]) {
  test(`absent-media ${name} body enforces byte validation only`, async () => {
    const fixture = harness({ responses: FILES.map(() => ({ headers: [], bytes })) });
    const result = await fixture.run();
    if (error) {
      assert.equal(result.data.error, error);
      assert.equal(result.data.counts.eofObservations, 1);
    } else {
      assert.equal(result.exitCode, 0);
      assert.ok(result.data.observations.every(observation => observation.bodyUtf8 === bytes.toString('utf8') && observation.licenseComplianceVerified === false));
    }
  });
}

test('absent media rejects every body control outside the unchanged four-code allowlist', async () => {
  const allowed = new Set([9, 10, 12, 13]);
  const controls = [...Array.from({ length: 32 }, (_, index) => index), ...Array.from({ length: 33 }, (_, index) => 127 + index)];
  for (const code of controls.filter(code => !allowed.has(code))) {
    await stopped({ responses: [{ headers: [], bytes: Buffer.from(`A${String.fromCodePoint(code)}B`) }] }, 'E_UTF8');
  }
});

test('missing media never hides an exposed content-length mismatch or empty-body declaration', async () => {
  for (const declared of ['0', '2']) {
    await stopped({ responses: [{ headers: [['content-length', declared]], bytes: Buffer.from('A') }] }, 'E_BODY');
  }
  await stopped({ responses: [{ headers: [['content-length', '0']], bytes: Buffer.alloc(0) }] }, 'E_BODY');
});

for (const value of ['A\fB', 'A\u0085B', 'A\tB', 'A\nB']) {
  test(`header control ${JSON.stringify(value)} remains forbidden with absent media`, async () => {
    const fixture = await stopped({ responses: [{ headers: [['x-test', value]] }] }, 'E_HEADERS');
    assert.equal(fixture.state.records[0].readers, 0);
  });
}

for (let position = 1; position <= 5; position++) {
  test(`failure ${position}/5 wipes hidden prefix body and headers from STOP`, async () => {
    const marker = `HIDDENMARKER_${position}`;
    const responses = FILES.map((_, index) => ({
      bytes: Buffer.from(`${marker}_${index}`), headers: [['x-hidden-marker', marker]],
      ...(index === position - 1 ? { readError: 'fake failure' } : {}),
    }));
    const fixture = await stopped({ responses }, 'E_BODY', position);
    assert.equal(fixture.result.data.counts.completedObservations, position - 1);
    assert.equal(JSON.stringify(fixture.result).includes(marker), false);
    assert.equal(fixture.state.records.at(-1).cancels, 1);
    assert.equal(fixture.state.timers.size, 0);
  });
}

test('successful fixture cannot retry and independent fixtures do not share the latch', async () => {
  const first = harness();
  const second = harness();
  assert.equal((await first.run()).exitCode, 0);
  const result = await first.run();
  assert.equal(result.data.error, 'E_ARGUMENTS');
  assert.equal(first.state.calls.length, 5);
  assert.equal(result.data.counts.fetchCalls, 0);
  assert.equal((await second.run()).exitCode, 0);
  assert.equal(second.state.calls.length, 5);
});

for (const argument of [{ urls: ['https://not-allowed.invalid/'] }, { gateway: true }, undefined]) {
  test(`argument ${JSON.stringify(argument)} consumes only its fresh fixture latch without I/O`, async () => {
    const fixture = harness();
    assert.equal((await fixture.run(argument)).data.error, 'E_ARGUMENTS');
    assert.equal((await fixture.run()).data.error, 'E_ARGUMENTS');
    assert.equal(fixture.state.calls.length, 0);
    assert.equal(fixture.state.scheduled.length, 0);
  });
}

test('failed fixture cannot retry or refund counters', async () => {
  const fixture = await stopped({ responses: [{ fetchError: 'failure' }] }, 'E_FETCH');
  assert.equal((await fixture.run()).data.error, 'E_ARGUMENTS');
  assert.equal(fixture.state.calls.length, 1);
});

for (const [name, spec, error] of [
  ['redirected response', { redirected: true }, 'E_HEADERS'],
  ['redirect status', { status: 302 }, 'E_HEADERS'],
  ['opaque response', { type: 'opaque' }, 'E_HEADERS'],
  ['different URL', { url: 'https://elsewhere.invalid/' }, 'E_HEADERS'],
  ['duplicate media', { headers: [['content-type', 'text/plain'], ['Content-Type', 'text/plain']] }, 'E_HEADERS'],
  ['duplicate absent-media header', { headers: [['X-A', '1'], ['x-a', '2']] }, 'E_HEADERS'],
  ['null media', { headers: [['content-type', null]] }, 'E_HEADERS'],
  ['malformed header pair', { headers: [['content-type']] }, 'E_HEADERS'],
  ['gzip encoding', { headers: [['content-encoding', 'gzip']] }, 'E_HEADERS'],
  ['length mismatch', { headers: [['content-length', '1']] }, 'E_BODY'],
  ['oversized declared length', { headers: [['content-length', '1048577']] }, 'E_LIMIT'],
  ['malformed length', { headers: [['content-length', '01']] }, 'E_HEADERS'],
]) {
  test(`${name} stops without alternate GET`, async () => { await stopped({ responses: [spec] }, error); });
}

test('per-file limit accepts exactly 1 MiB', async () => {
  const fixture = harness({ responses: [{ bytes: Buffer.alloc(1048576, 65), headers: [] }] });
  const result = await fixture.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.observations[0].observedBodyBytes, 1048576);
});

test('per-file +1 overrun rejects the chunk without retaining it', async () => {
  const fixture = await stopped({ responses: [{ bytes: Buffer.alloc(1048577, 65), headers: [] }] }, 'E_LIMIT');
  assert.equal(fixture.result.data.counts.deliveredBytes, 1048577);
  assert.equal(fixture.result.data.counts.retainedBytes, 0);
  assert.equal(fixture.result.data.counts.rejectedChunks, 1);
});

test('aggregate accepts exactly 2 MiB across five files', async () => {
  const fixture = harness({ responses: [1048576, 1048573, 1, 1, 1].map(length => ({ bytes: Buffer.alloc(length, 65), headers: [] })) });
  const result = await fixture.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.counts.retainedBytes, 2097152);
});

test('aggregate +1 on file five wipes all four completed bodies', async () => {
  const fixture = await stopped({ responses: [1048576, 1048573, 1, 1, 2].map(length => ({ bytes: Buffer.alloc(length, 65), headers: [] })) }, 'E_LIMIT', 5);
  assert.equal(fixture.result.data.counts.completedObservations, 4);
  assert.equal(fixture.result.data.counts.retainedBytes, 2097151);
  assert.equal(fixture.result.data.counts.rejectedChunks, 1);
});

for (const [chunks, pass] of [[1023, true], [1024, false]]) {
  test(`per-response ${chunks} chunks plus EOF ${pass ? 'passes' : 'exceeds'} 1024 reads`, async () => {
    const fixture = harness({ responses: [{ chunks: Array.from({ length: chunks }, () => Buffer.from('A')), headers: [] }] });
    const result = await fixture.run();
    assert.equal(result.exitCode, pass ? 0 : 1);
    if (!pass) assert.equal(result.data.error, 'E_LIMIT');
    assert.equal(fixture.state.records[0].reads, 1024);
  });
}

test('aggregate read limit accepts exactly 2048 reads', async () => {
  const fixture = harness({ responses: [1023, 1017, 1, 1, 1].map(count => ({ chunks: Array.from({ length: count }, () => Buffer.from('A')) })) });
  const result = await fixture.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.counts.readAttempts, 2048);
});

test('aggregate read overrun never attempts read 2049', async () => {
  const fixture = await stopped({ responses: [1023, 1023, 1].map(count => ({ chunks: Array.from({ length: count }, () => Buffer.from('A')) })) }, 'E_LIMIT', 3);
  assert.equal(fixture.result.data.counts.readAttempts, 2048);
  assert.equal(fixture.state.records[2].reads, 0);
});

for (const pairs of [64, 65]) {
  test(`absent-media header ${pairs}-pair boundary remains exact`, async () => {
    const headers = Array.from({ length: pairs }, (_, index) => [`x-${index}`, 'a']);
    const fixture = harness({ responses: [{ headers }] });
    const result = await fixture.run();
    assert.equal(result.exitCode, pairs === 64 ? 0 : 1);
    if (pairs > 64) assert.equal(result.data.error, 'E_LIMIT');
  });
}

for (const bytes of [16384, 16385]) {
  test(`absent-media ${bytes}-byte header boundary remains exact`, async () => {
    const fixture = harness({ responses: [{ headers: [['x', 'A'.repeat(bytes - 1)]] }] });
    const result = await fixture.run();
    assert.equal(result.exitCode, bytes === 16384 ? 0 : 1);
    if (bytes > 16384) assert.equal(result.data.error, 'E_LIMIT');
  });
}

test('fixture requires all four explicit fake capabilities and mockOnly true', () => {
  const fixture = harness();
  for (const key of ['fetch', 'now', 'setTimeout', 'clearTimeout']) {
    const dependencies = { ...fixture.dependencies };
    delete dependencies[key];
    assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: true }, dependencies), /E_MOCK_TCB/);
    const global = key === 'now' ? performance.now : globalThis[key];
    assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: true }, { ...fixture.dependencies, [key]: global }), /E_MOCK_TCB/);
  }
  assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: false }, fixture.dependencies), /E_MOCK_TCB/);
  assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: true }), /E_MOCK_TCB/);
});

test('fixture rejects proxy, getter, function-proxy, and extra capability keys without invoking them', () => {
  const fixture = harness();
  assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: true }, new Proxy(fixture.dependencies, { get() { assert.fail('proxy trap'); } })), /E_MOCK_TCB/);
  const getter = { ...fixture.dependencies };
  Object.defineProperty(getter, 'fetch', { get() { assert.fail('getter'); }, enumerable: true });
  assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: true }, getter), /E_MOCK_TCB/);
  assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: true }, { ...fixture.dependencies, urls: URLS }), /E_MOCK_TCB/);
  assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: true }, { ...fixture.dependencies, fetch: new Proxy(fixture.dependencies.fetch, {}) }), /E_MOCK_TCB/);
});

test('output preflight includes ASCII JSON escaping and final LF at exact 16 MiB', async () => {
  const local = await importImage(source => `${source}\nexport const TEST_PREFLIGHT = outputPreflight;`);
  const exact = 'A'.repeat(16777216 - 3);
  assert.equal(`${JSON.stringify(exact)}\n`.length, 16777216);
  assert.doesNotThrow(() => local.TEST_PREFLIGHT(exact));
  assert.throws(() => local.TEST_PREFLIGHT(`${exact}A`), /E_LIMIT/);
  const unicode = '\u00e9'.repeat(Math.floor((16777216 - 3) / 6));
  assert.doesNotThrow(() => local.TEST_PREFLIGHT(unicode));
  assert.throws(() => local.TEST_PREFLIGHT(`${unicode}\u00e9`), /E_LIMIT/);
});

test('output depth and node limits stay exact', async () => {
  const local = await importImage(source => `${source}\nexport const TEST_PREFLIGHT = outputPreflight;`);
  const nest = depth => { let value = null; while (depth--) value = { child: value }; return value; };
  assert.doesNotThrow(() => local.TEST_PREFLIGHT(nest(64)));
  assert.throws(() => local.TEST_PREFLIGHT(nest(65)), /E_LIMIT/);
  assert.doesNotThrow(() => local.TEST_PREFLIGHT(Array(99998).fill(null)));
  assert.throws(() => local.TEST_PREFLIGHT(Array(99999).fill(null)), /E_LIMIT/);
});

async function fakeProduction() {
  const fixture = harness({ responses: FILES.map(() => ({ headers: [] })) });
  const module = await importImage(source => {
    for (const [oldText, newText] of [
      ['const FETCH = globalThis.fetch;', 'const FETCH = (...args) => TEST_TCB.fetch(...args);'],
      ['const NOW = performance.now;', 'const NOW = () => TEST_TCB.now();'],
      ['const CLOCK = performance;', 'const CLOCK = {};'],
      ['const SET_TIMEOUT = globalThis.setTimeout;', 'const SET_TIMEOUT = (...args) => TEST_TCB.setTimeout(...args);'],
      ['const CLEAR_TIMEOUT = globalThis.clearTimeout;', 'const CLEAR_TIMEOUT = (...args) => TEST_TCB.clearTimeout(...args);'],
    ]) source = replaceOnce(source, oldText, newText);
    return `${source}\nlet TEST_TCB; export function TEST_BIND(tcb) { TEST_TCB = tcb; }`;
  });
  module.TEST_BIND(fixture.dependencies);
  return { ...fixture, module };
}

test('production clock charges 9s preparation, retains original 27s work end, and clips later requests', async () => {
  const fixture = await fakeProduction();
  fixture.state.clock = 9000;
  fixture.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  const originalFetch = fixture.dependencies.fetch;
  fixture.dependencies.fetch = async (...args) => {
    const result = await originalFetch(...args);
    fixture.state.clock += 4000;
    return result;
  };
  const result = await fixture.module.collectRegisteredBootlinGccNoticesV2();
  assert.equal(result.data.error, 'E_DEADLINE');
  assert.equal(result.data.mockOnly, false);
  assert.equal(fixture.state.scheduled[0].delay, 21000);
  assert.deepEqual(fixture.state.scheduled.slice(1).map(timer => timer.end), [19000, 23000, 27000, 27000, 27000]);
  assert.equal(fixture.state.calls.length, 5);
  assert.equal(result.data.counts.completedObservations, 4);
  assert.equal(Object.hasOwn(result.data, 'observations'), false);
});

test('original origin 0 bound at 9s then invoked at 27s performs zero GET and retains 3s outer', async () => {
  const fixture = await fakeProduction();
  fixture.state.clock = 9000;
  fixture.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  fixture.state.clock = 27000;
  const result = await fixture.module.collectRegisteredBootlinGccNoticesV2();
  assert.equal(result.data.error, 'E_DEADLINE');
  assert.equal(fixture.state.calls.length, 0);
  assert.equal(fixture.state.scheduled[0].delay, 3000);
});

test('production origin cannot reset or renew the one-shot budget', async () => {
  const fixture = await fakeProduction();
  fixture.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  assert.throws(() => fixture.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0), /E_CLOCK/);
  assert.equal((await fixture.module.collectRegisteredBootlinGccNoticesV2()).exitCode, 0);
  assert.equal((await fixture.module.collectRegisteredBootlinGccNoticesV2()).data.error, 'E_ARGUMENTS');
  assert.equal(fixture.state.calls.length, 5);
});

test('unbound instrumented production performs no fake transport', async () => {
  const fixture = await fakeProduction();
  assert.equal((await fixture.module.collectRegisteredBootlinGccNoticesV2()).data.error, 'E_CLOCK');
  assert.equal(fixture.state.calls.length, 0);
});

test('raw new production invalid arguments consume the latch without touching transport or clock', async () => {
  const result = await notices.collectRegisteredBootlinGccNoticesV2({ forbidden: true });
  assert.equal(result.data.error, 'E_ARGUMENTS');
  assert.equal(result.data.mockOnly, false);
  assert.equal(result.data.counts.fetchCalls, 0);
  assert.equal(result.data.counts.activeTimers, 0);
  assert.equal((await notices.collectRegisteredBootlinGccNoticesV2()).data.error, 'E_ARGUMENTS');
});

for (const pending of ['pendingFetch', 'pendingRead']) {
  test(`${pending} ignoring abort preserves uncertainty through the original outer deadline`, async () => {
    const fixture = harness({ responses: [{ [pending]: true, cancelPending: true }] });
    let settled = false;
    const running = fixture.run().then(result => { settled = true; return result; });
    for (let turn = 0; turn < 30; turn++) await Promise.resolve();
    assert.equal(fixture.state.calls.length, 1);
    const request = fixture.state.scheduled[1];
    fixture.state.clock = request.end;
    request.callback();
    for (let turn = 0; turn < 30; turn++) await Promise.resolve();
    assert.equal(settled, pending === 'pendingFetch');
    assert.deepEqual(fixture.state.scheduled.map(timer => timer.end), [30000, 10000]);
    const outer = fixture.state.scheduled[0];
    fixture.state.clock = outer.end;
    outer.callback();
    const result = await running;
    assert.equal(result.data.error, 'E_DEADLINE');
    assert.equal(result.data.cleanupUncertain, true);
    assert.equal(result.data.counts[pending === 'pendingFetch' ? 'pendingFetchKnown' : 'pendingReadKnown'], true);
    assert.equal(result.data.counts.transportClosedVerified, false);
    assert.equal(fixture.state.calls[0].init.signal.aborted, true);
    assert.equal(fixture.state.calls.length, 1);
    assert.equal(Object.hasOwn(result.data, 'observations'), false);
  });
}

for (const phase of ['fetch', 'read']) {
  test(`late ${phase} settlement cannot redeem a frozen uncertain STOP or start a later GET`, async () => {
    let unblock;
    const gate = new Promise(resolve => { unblock = resolve; });
    const fixture = harness({
      responses: FILES.map(() => ({ headers: [] })),
      ...(phase === 'fetch' ? { onFetch: () => gate } : { onRead: () => gate }),
    });
    const running = fixture.run();
    for (let turn = 0; turn < 30; turn++) await Promise.resolve();
    assert.equal(fixture.state.calls.length, 1);
    assert.equal(fixture.state.records[0].reads, phase === 'fetch' ? 0 : 1);
    const request = fixture.state.scheduled[1];
    fixture.state.clock = request.end;
    request.callback();
    const result = await running;
    assert.equal(result.data.error, 'E_DEADLINE');
    assert.equal(result.data.cleanupUncertain, true);
    const pendingKey = phase === 'fetch' ? 'pendingFetchKnown' : 'pendingReadKnown';
    assert.equal(result.data.counts[pendingKey], true);
    assert.equal(result.data.counts.transportClosedVerified, false);
    assert.equal(fixture.state.calls[0].init.signal.aborted, true);
    const snapshot = JSON.stringify(result);
    unblock();
    for (let turn = 0; turn < 30; turn++) await Promise.resolve();
    assert.equal(JSON.stringify(result), snapshot);
    assert.equal(result.data.counts[pendingKey], true);
    assert.equal(Object.hasOwn(result.data, 'observations'), false);
    assert.equal((await fixture.run()).data.error, 'E_ARGUMENTS');
    assert.equal(fixture.state.calls.length, 1);
    assert.equal(fixture.state.timers.size, 0);
    frozenTree(result);
  });
}

test('clock regression fails before a request without resetting origin', async () => {
  let calls = 0;
  await stopped({ now: () => calls++ === 0 ? 100 : 99 }, 'E_CLOCK', 0);
});

test('timer cleanup uncertainty suppresses all observations', async () => {
  const fixture = await stopped({ clearResult: Promise.resolve() }, 'E_CLEANUP');
  assert.equal(fixture.result.data.cleanupUncertain, true);
});

test('handoff reports only owned-file and inert source/policy pins', context => {
  for (const name of ['bootlin-gcc-notices-v2.mjs', 'bootlin-gcc-notices-v2.test.mjs']) {
    const bytes = readFileSync(new URL(`./${name}`, import.meta.url));
    context.diagnostic(`${name} bytes=${bytes.length} sha256=${hash(bytes)}`);
  }
  context.diagnostic(`pure V1 adapter bytes=${noticeBuilderBytes.length} sha256=${hash(noticeBuilderBytes)}`);
  context.diagnostic(`generated source bytes=${image.sourceText.length} sha256=${hash(image.sourceText)}`);
  context.diagnostic(`generated policy bytes=${Buffer.byteLength(`${JSON.stringify(POLICY)}\n`)} sha256=${hash(`${JSON.stringify(POLICY)}\n`)}`);
});
