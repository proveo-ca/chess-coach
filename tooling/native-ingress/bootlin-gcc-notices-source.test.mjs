// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as builder from './bootlin-gcc-notices-source.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ownSource = readFileSync(new URL('./bootlin-gcc-notices-source.mjs', import.meta.url), 'utf8');
const adapterBytes = readFileSync(new URL('./bootlin-directory-metadata-v2.mjs', import.meta.url));
assert.equal(adapterBytes.length, 5760);
assert.equal(hash(adapterBytes), 'd09558231e7ea5f27c2ed0d1b34c599c087bc34a4c6e5e75e3e4ecf3f1ff9f80');
const adapter = await import('./bootlin-directory-metadata-v2.mjs');
const rawBytes = readFileSync(new URL('./bootlin-directory-metadata.mjs', import.meta.url));
assert.equal(rawBytes.length, 19649);
assert.equal(hash(rawBytes), '1a625ec28479ac28efeaa19a51095924f7db5c48524a1cd74570e0c4b7f3890f');
const base = adapter.buildBootlinDirectoryMetadataV2Source(rawBytes).sourceText;
const { buildBootlinGccNoticesSource: build, BOOTLIN_GCC_NOTICES_SOURCE_V1_PINS: pins } = builder;
const image = build(base);
const FINAL = 'ab907eccc60c8f58c351ca82b449d2fd774c96e343e07cf49ceda74b86e77a44';
const POLICY_HASH = '5c6998988e94606c75ec2be7f18f513e4e1520d2f2b53ad0bfd3a7373bc5f7df';
const FILES = ['COPYING', 'COPYING.LIB', 'COPYING.RUNTIME', 'COPYING3', 'COPYING3.LIB'];
const URLS = FILES.map(name => `https://toolchains.bootlin.com/downloads/releases/licenses/gcc-final-15.3.0/${name}`);
let serial = 0;

function uri(source) {
  return `data:text/javascript;base64,${Buffer.from(`${source}\n// TEST ${serial++}\n`).toString('base64')}`;
}

async function importImage(instrument = source => source) {
  assert.equal(Buffer.byteLength(image.sourceText), 21227);
  assert.equal(hash(image.sourceText), FINAL);
  return import(uri(instrument(image.sourceText)));
}

const notices = await importImage();
const POLICY = notices.BOOTLIN_GCC_NOTICES_V1_PROFILE;

function frozenTree(value) {
  if (value && typeof value === 'object') {
    assert.equal(Object.isFrozen(value), true);
    assert.equal(ArrayBuffer.isView(value), false);
    for (const child of Object.values(value)) frozenTree(child);
  } else assert.ok(['string', 'number', 'boolean'].includes(typeof value) || value === null);
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
        const body = {
          getReader() { record.readers++; return reader; },
          cancel() { record.cancels++; return undefined; },
        };
        return {
          status: spec.status ?? 200, redirected: spec.redirected ?? false, type: spec.type ?? 'basic',
          url: spec.url ?? url,
          headers: spec.headers ?? [['content-type', spec.media ?? 'text/plain; charset=utf-8']],
          body,
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
  assert.equal(result.data.status, 'STOP');
  assert.equal(result.data.error, code);
  assert.equal(fixture.state.calls.length, requests);
  assert.equal(Object.hasOwn(result.data, 'observations'), false);
  assert.equal(Object.hasOwn(result.data, 'exposedHeaders'), false);
  frozenTree(result);
  return { ...fixture, result };
}

function replaceOnce(source, oldText, newText) {
  assert.equal(source.split(oldText).length, 2);
  return source.replace(oldText, newText);
}

test('builder exposes exactly the two approved exports', () => {
  assert.deepEqual(Object.keys(builder).sort(), ['BOOTLIN_GCC_NOTICES_SOURCE_V1_PINS', 'buildBootlinGccNoticesSource']);
  assert.deepEqual(Object.keys(image), ['profile', 'sourceText', 'graphPins', 'policyPin']);
  assert.equal(image.profile, 'BOOTLIN_GCC_NOTICES_SOURCE_V1');
  assert.equal(Object.keys(pins).length, 17);
  frozenTree(pins);
  frozenTree(image);
});

test('builder contains only the builtin crypto import and never evaluates the image', () => {
  assert.deepEqual([...ownSource.matchAll(/^import .+ from '([^']+)';$/gm)].map(match => match[1]), ['node:crypto']);
  assert.doesNotMatch(ownSource, /\b(?:process|fetch|eval|Function|readFile|writeFile)\b|import\s*\(/);
  assert.doesNotMatch(ownSource, /^\s*(?:const|let|return)\b[^\n]*\bBuffer\./m);
});

test('base admission precedes ASCII scan, hashing, and transforms', () => {
  const start = ownSource.indexOf('export function buildBootlinGccNoticesSource');
  const admission = ownSource.slice(start);
  assert.ok(admission.indexOf('arguments.length') < admission.indexOf('typeof baseV2Source'));
  assert.ok(admission.indexOf('baseV2Source.length') < admission.indexOf('/[^'));
  assert.ok(admission.indexOf('/[^') < admission.indexOf('verify(baseV2Source'));
  assert.ok(admission.indexOf('verify(baseV2Source') < admission.indexOf('source = replace'));
});

test('invalid type, arity, size, and Unicode never reach a hash or transform', async () => {
  let source = replaceOnce(ownSource, 'function verify(source, pin) {', "function verify(source, pin) { fail('E_UNEXPECTED_HASH');");
  source = replaceOnce(source, 'function replace(source, oldText, newText, count, pin) {', "function replace(source, oldText, newText, count, pin) { fail('E_UNEXPECTED_TRANSFORM');");
  const local = await import(uri(source));
  const entry = local.buildBootlinGccNoticesSource;
  for (const value of [null, new String(base), 'A'.repeat(2 ** 22), '\u00e9'.repeat(base.length), base.slice(1)]) {
    assert.throws(() => entry(value), /^Error: E_SOURCE$/);
  }
  assert.throws(() => entry(base, {}), /^Error: E_ARGUMENTS$/);
  assert.throws(() => entry(base), /^Error: E_UNEXPECTED_HASH$/);
});

for (const [name, value] of [
  ['undefined', undefined], ['null', null], ['number', 20438], ['boolean', true], ['array', [base]],
  ['buffer', Buffer.from(base)], ['boxed string', new String(base)], ['symbol', Symbol('source')],
  ['huge ASCII', 'x'.repeat(2 ** 22)], ['huge Unicode', '\u{1f600}'.repeat(2 ** 20)],
  ['short source', base.slice(1)], ['long source', `${base} `],
  ['same-length non-ASCII', `\u00e9${base.slice(1)}`], ['same-length surrogate', `\ud800${base.slice(1)}`],
]) {
  test(`admission rejects ${name}`, () => assert.throws(() => build(value), /^Error: E_SOURCE$/));
}

test('proxy admission never executes proxy traps or coercion', () => {
  const proxy = new Proxy(new String(base), { get() { assert.fail('proxy trap'); }, getPrototypeOf() { assert.fail('proxy prototype'); } });
  assert.throws(() => build(proxy), /^Error: E_SOURCE$/);
  assert.throws(() => build({ toString() { assert.fail('coercion'); } }), /^Error: E_SOURCE$/);
});

for (const args of [[], [base, undefined], [base, {}], [base, pins]]) {
  test(`arity ${args.length} rejects without production override`, () => assert.throws(() => build(...args), /^Error: E_ARGUMENTS$/));
}

test('full input digest rejects a same-size ASCII mutation', () => {
  assert.throws(() => build(` ${base.slice(1)}`), /^Error: E_PIN$/);
});

test('input remains immutable and deterministic with exact final pin', () => {
  const snapshot = base;
  assert.deepEqual(build(base), image);
  assert.equal(base, snapshot);
  assert.equal(base.length, 20438);
  assert.equal(hash(base), pins.base.sha256);
  assert.equal(image.sourceText.length, 21227);
  assert.equal(hash(image.sourceText), FINAL);
  assert.throws(() => { pins.base.bytes = 1; }, TypeError);
  assert.throws(() => { image.sourceText = ''; }, TypeError);
});

for (const [stage, pin] of Object.entries(image.graphPins)) {
  test(`static ${stage} byte pin fails closed in a test-local module`, async () => {
    const source = replaceOnce(ownSource, `${stage}: { bytes: ${pin.bytes},`, `${stage}: { bytes: ${pin.bytes + 1},`);
    const local = await import(uri(source));
    assert.throws(() => local.buildBootlinGccNoticesSource(base), stage === 'base' ? /^Error: E_SOURCE$/ : /^Error: E_PIN$/);
  });
  test(`static ${stage} digest pin fails closed in a test-local module`, async () => {
    const local = await import(uri(replaceOnce(ownSource, pin.sha256, '0'.repeat(64))));
    assert.throws(() => local.buildBootlinGccNoticesSource(base), /^Error: E_PIN$/);
  });
}

for (const stage of Object.keys(image.graphPins).slice(1)) {
  test(`${stage} transformation cardinality fails closed`, async () => {
    const count = ['entryNames', 'policyNames'].includes(stage) ? 2 : 1;
    const local = await import(uri(replaceOnce(ownSource, `, ${count}, graphPins.${stage});`, `, ${count + 1}, graphPins.${stage});`)));
    assert.throws(() => local.buildBootlinGccNoticesSource(base), /^Error: E_TRANSFORM$/);
  });
}

test('policy image matches independently supplied static bytes and digest', () => {
  const text = `${JSON.stringify(POLICY)}\n`;
  assert.equal(Buffer.byteLength(text), 1468);
  assert.equal(hash(text), POLICY_HASH);
  assert.deepEqual(image.policyPin, { bytes: 1468, sha256: POLICY_HASH });
  frozenTree(POLICY);
  assert.deepEqual(POLICY.urls, URLS);
  assert.deepEqual(POLICY.roles, ['copying', 'copying-lib', 'runtime-exception', 'copying3', 'copying3-lib']);
  assert.equal(POLICY.bodyFormat, 'LICENSE_NOTICE_TEXT');
  assert.deepEqual(POLICY.allowedBodyControls, [9, 10, 12, 13]);
});

test('policy pin mutation cannot qualify the generated policy', async () => {
  const local = await import(uri(replaceOnce(ownSource, POLICY_HASH, '0'.repeat(64))));
  assert.notEqual(hash(`${JSON.stringify(POLICY)}\n`), local.buildBootlinGccNoticesSource(base).policyPin.sha256);
});

test('caps and historical references stay unchanged except the authorized request count', () => {
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
  assert.equal(POLICY.sourceRef.rootReadmeSha256, 'fa0b24cb67e660a5aebe2f4d4705b5a7ca2e5860e2e0405ddf6fddad40d4a41a');
});

test('new image exposes only the new production entry and policy plus inherited test and clock hooks', () => {
  assert.deepEqual(Object.keys(notices).sort(), [
    'BOOTLIN_GCC_NOTICES_V1_PROFILE', 'SOURCE_BIND_PARENT_CLOCK_ORIGIN',
    'collectRegisteredBootlinGccNoticesV1', 'createBootlinDirectoryMetadataFixture',
  ]);
  assert.doesNotMatch(image.sourceText, /collectRegisteredBootlinDirectories|BOOTLIN_DIRECTORY_METADATA_V[12]_PROFILE|PUBLIC_DIRECTORY_METADATA|status: 'BOOTLIN_DIRECTORY_METADATA'/);
});

test('the 794-byte original parent-clock bridge stays byte-identical', () => {
  const bridge = image.sourceText.slice(-794);
  assert.equal(bridge, base.slice(-794));
  assert.equal(hash(bridge), '28bbe878605dc95eaa7d15d27e1ae9d162c86a755e7d76f8f8e69a97291cf334');
});

test('five sequential fake responses preserve FF, body bytes, hashes, order, and passive flags', async () => {
  const fixture = harness({ onFetch(state, index) {
    if (index > 0) {
      assert.equal(state.records[index - 1].eof, true);
      assert.equal(state.records[index - 1].releases, 1);
      assert.equal(state.records[index - 1].cancels, 0);
    }
  } });
  const { data, exitCode } = await fixture.run();
  assert.equal(exitCode, 0);
  assert.equal(data.status, 'BOOTLIN_LICENSE_NOTICES_DATA');
  assert.equal(data.mockOnly, true);
  assert.deepEqual(fixture.state.calls.map(call => call.url), URLS);
  assert.equal(fixture.state.maximumFetches, 1);
  assert.equal(data.observations.length, 5);
  for (const [index, observation] of data.observations.entries()) {
    assert.equal(observation.role, POLICY.roles[index]);
    assert.equal(observation.requestedUrl, URLS[index]);
    assert.equal(observation.sourceKind, 'PUBLIC_LICENSE_NOTICE_TEXT');
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

test('all five fake requests retain exact GET/no-redirect/no-credentials/no-referrer options', async () => {
  const fixture = harness();
  assert.equal((await fixture.run()).exitCode, 0);
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

for (const media of ['text/plain', 'text/plain; charset=utf-8', 'text/plain; charset=utf8', 'text/plain; charset=us-ascii', 'TEXT/PLAIN ; CHARSET = US-ASCII', 'application/octet-stream']) {
  test(`five FF notices accept media ${media}`, async () => {
    const fixture = harness({ responses: FILES.map(() => ({ media, bytes: Buffer.from('A\fB\t\r\n') })) });
    const result = await fixture.run();
    assert.equal(result.exitCode, 0);
    assert.ok(result.data.observations.every(observation => observation.bodyUtf8 === 'A\fB\t\r\n'));
  });
}

for (const media of ['text/html', 'text/plain; charset=latin1', 'text/plain; charset="utf-8"', 'text/plain; charset=utf-16', 'application/octet-stream; charset=utf-8', 'application/json', '']) {
  test(`media ${JSON.stringify(media)} stops before reader without fallback`, async () => {
    const fixture = await stopped({ responses: [{ media }] }, 'E_HEADERS');
    assert.equal(fixture.state.records[0].readers, 0);
    assert.equal(fixture.state.records[0].reads, 0);
  });
}

for (const media of ['text/plain; charset=utf-8', 'application/octet-stream']) {
  test(`${media} preserves UTF-8 BOM bytes and hash`, async () => {
    const bytes = Buffer.from('\ufeffnotice\f\u00e9');
    const fixture = harness({ responses: FILES.map(() => ({ media, bytes })) });
    const result = await fixture.run();
    assert.equal(result.exitCode, 0);
    for (const observation of result.data.observations) {
      assert.equal(observation.bodyUtf8, '\ufeffnotice\f\u00e9');
      assert.equal(observation.bodySha256, hash(bytes));
      assert.equal(observation.observedBodyBytes, bytes.length);
    }
  });
}

for (const [name, bytes] of [['UTF-8 high bytes', Buffer.from('\u00e9')], ['BOM', Buffer.from('\ufeffA')], ['invalid high byte', Buffer.from([255])]]) {
  test(`US-ASCII rejects ${name}`, async () => {
    await stopped({ responses: [{ media: 'text/plain; charset=us-ascii', bytes }] }, 'E_UTF8');
  });
}

for (const [name, bytes] of [
  ['invalid UTF-8', Buffer.from([0xc0, 0xaf])], ['truncated UTF-8', Buffer.from([0xe2, 0x82])],
  ['NUL', Buffer.from('A\0B')], ['ANSI escape', Buffer.from('\x1b[31m')], ['C1', Buffer.from('\u0085')],
  ['DEL', Buffer.from('\x7f')], ['vertical tab', Buffer.from('\x0b')], ['unit separator', Buffer.from('\x1f')],
]) {
  test(`notice body rejects ${name}`, async () => { await stopped({ responses: [{ bytes }] }, 'E_UTF8'); });
}

test('form feed remains forbidden in headers', async () => {
  const fixture = await stopped({ responses: [{ headers: [['content-type', 'text/plain'], ['x-test', 'A\fB']] }] }, 'E_HEADERS');
  assert.equal(fixture.state.records[0].readers, 0);
});

test('empty body rejects after EOF', async () => {
  const fixture = await stopped({ responses: [{ bytes: Buffer.alloc(0) }] }, 'E_BODY');
  assert.equal(fixture.result.data.counts.eofObservations, 1);
});

test('one-byte bodies are nonempty notices', async () => {
  const fixture = harness({ responses: FILES.map(() => ({ bytes: Buffer.from('x') })) });
  assert.equal((await fixture.run()).exitCode, 0);
});

for (let position = 1; position <= 5; position++) {
  test(`failure ${position}/5 wipes all prefix notice text and headers`, async () => {
    const marker = `PRIVATE_PREFIX_MARKER_${position}`;
    const responses = FILES.map((_, index) => ({
      bytes: Buffer.from(`${marker}_${index}`),
      headers: [['content-type', 'text/plain'], ['x-private-marker', marker]],
      ...(index === position - 1 ? { readError: 'fake failure' } : {}),
    }));
    const fixture = await stopped({ responses }, 'E_BODY', position);
    assert.equal(fixture.result.data.counts.completedObservations, position - 1);
    assert.equal(fixture.result.data.counts.eofObservations, position - 1);
    assert.equal(JSON.stringify(fixture.result).includes(marker), false);
    assert.equal(fixture.state.records.length, position);
    assert.equal(fixture.state.records.at(-1).cancels, 1);
    assert.equal(fixture.state.timers.size, 0);
  });
}

test('reentry never starts another request after success', async () => {
  const fixture = harness();
  assert.equal((await fixture.run()).exitCode, 0);
  const result = await fixture.run();
  assert.equal(result.data.error, 'E_ARGUMENTS');
  assert.equal(fixture.state.calls.length, 5);
  assert.equal(result.data.counts.fetchCalls, 0);
});

for (const argument of [{ urls: ['https://not-allowed.invalid/'] }, { gateway: true }, undefined]) {
  test(`choice argument ${JSON.stringify(argument)} consumes the one-shot gate`, async () => {
    const fixture = harness();
    assert.equal((await fixture.run(argument)).data.error, 'E_ARGUMENTS');
    assert.equal((await fixture.run()).data.error, 'E_ARGUMENTS');
    assert.equal(fixture.state.calls.length, 0);
    assert.equal(fixture.state.scheduled.length, 0);
  });
}

test('failure consumes the gate without retry or counter refund', async () => {
  const fixture = await stopped({ responses: [{ fetchError: 'failure' }] }, 'E_FETCH');
  const result = await fixture.run();
  assert.equal(result.data.error, 'E_ARGUMENTS');
  assert.equal(fixture.state.calls.length, 1);
});

for (const [name, spec, error] of [
  ['redirected response', { redirected: true }, 'E_HEADERS'],
  ['redirect status', { status: 302 }, 'E_HEADERS'],
  ['opaque response', { type: 'opaque' }, 'E_HEADERS'],
  ['different URL', { url: 'https://elsewhere.invalid/' }, 'E_HEADERS'],
  ['duplicate header', { headers: [['content-type', 'text/plain'], ['Content-Type', 'text/plain']] }, 'E_HEADERS'],
  ['gzip encoding', { headers: [['content-type', 'text/plain'], ['content-encoding', 'gzip']] }, 'E_HEADERS'],
  ['length mismatch', { headers: [['content-type', 'text/plain'], ['content-length', '1']] }, 'E_BODY'],
  ['oversized declared length', { headers: [['content-type', 'text/plain'], ['content-length', '1048577']] }, 'E_LIMIT'],
  ['malformed length', { headers: [['content-type', 'text/plain'], ['content-length', '01']] }, 'E_HEADERS'],
]) {
  test(`${name} stops without alternate GET`, async () => { await stopped({ responses: [spec] }, error); });
}

test('exact 1 MiB file passes inside the unchanged aggregate cap', async () => {
  const fixture = harness({ responses: [{ bytes: Buffer.alloc(1048576, 65) }] });
  const result = await fixture.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.observations[0].observedBodyBytes, 1048576);
});

test('file overrun rejects the delivered chunk without widening limits', async () => {
  const fixture = await stopped({ responses: [{ bytes: Buffer.alloc(1048577, 65) }] }, 'E_LIMIT');
  assert.equal(fixture.result.data.counts.deliveredBytes, 1048577);
  assert.equal(fixture.result.data.counts.retainedBytes, 0);
  assert.equal(fixture.result.data.counts.rejectedChunks, 1);
});

test('aggregate accepts exactly 2 MiB across all five files', async () => {
  const fixture = harness({ responses: [1048576, 1048573, 1, 1, 1].map(length => ({ bytes: Buffer.alloc(length, 65) })) });
  const result = await fixture.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.counts.retainedBytes, 2097152);
});

test('aggregate overrun on the third file wipes both completed files', async () => {
  const fixture = await stopped({ responses: [1048576, 1048576, 1].map(length => ({ bytes: Buffer.alloc(length, 65) })) }, 'E_LIMIT', 3);
  assert.equal(fixture.result.data.counts.completedObservations, 2);
  assert.equal(fixture.result.data.counts.retainedBytes, 2097152);
  assert.equal(fixture.result.data.counts.rejectedChunks, 1);
});

test('per-response read cap permits 1023 chunks plus EOF', async () => {
  const fixture = harness({ responses: [{ chunks: Array.from({ length: 1023 }, () => Buffer.from('A')) }] });
  const result = await fixture.run();
  assert.equal(result.exitCode, 0);
  assert.equal(fixture.state.records[0].reads, 1024);
});

test('per-response read cap rejects a required 1025th EOF read', async () => {
  const fixture = await stopped({ responses: [{ chunks: Array.from({ length: 1024 }, () => Buffer.from('A')) }] }, 'E_LIMIT');
  assert.equal(fixture.state.records[0].reads, 1024);
});

test('aggregate read cap accepts exactly 2048 reads for five files', async () => {
  const responses = [1023, 1017, 1, 1, 1].map(count => ({ chunks: Array.from({ length: count }, () => Buffer.from('A')) }));
  const fixture = harness({ responses });
  const result = await fixture.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.counts.readAttempts, 2048);
});

test('aggregate read overrun stops without widening or sixth request', async () => {
  const responses = [1023, 1023, 1].map(count => ({ chunks: Array.from({ length: count }, () => Buffer.from('A')) }));
  const fixture = await stopped({ responses }, 'E_LIMIT', 3);
  assert.equal(fixture.result.data.counts.readAttempts, 2048);
  assert.equal(fixture.state.records[2].reads, 0);
});

test('header pair cap stays 64', async () => {
  const headers = [['content-type', 'text/plain'], ...Array.from({ length: 64 }, (_, index) => [`x-${index}`, 'a'])];
  await stopped({ responses: [{ headers }] }, 'E_LIMIT');
});

test('header byte cap stays 16384', async () => {
  await stopped({ responses: [{ headers: [['content-type', 'text/plain'], ['x-large', 'A'.repeat(16384)]] }] }, 'E_LIMIT');
});

test('fixture rejects incomplete capability sets and real global methods', () => {
  const fixture = harness();
  for (const key of ['fetch', 'now', 'setTimeout', 'clearTimeout']) {
    const dependencies = { ...fixture.dependencies };
    delete dependencies[key];
    assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: true }, dependencies), /E_MOCK_TCB/);
    const global = key === 'now' ? performance.now : globalThis[key];
    assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: true }, { ...fixture.dependencies, [key]: global }), /E_MOCK_TCB/);
  }
  assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: false }, fixture.dependencies), /E_MOCK_TCB/);
});

test('fixture rejects capability proxies, accessors, and extra keys without invoking them', () => {
  const fixture = harness();
  const proxy = new Proxy(fixture.dependencies, { get() { assert.fail('proxy trap'); } });
  assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: true }, proxy), /E_MOCK_TCB/);
  const getter = { ...fixture.dependencies };
  Object.defineProperty(getter, 'fetch', { get() { assert.fail('getter'); }, enumerable: true });
  assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: true }, getter), /E_MOCK_TCB/);
  assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: true }, { ...fixture.dependencies, urls: URLS }), /E_MOCK_TCB/);
  assert.throws(() => notices.createBootlinDirectoryMetadataFixture({ mockOnly: true }, {
    ...fixture.dependencies, fetch: new Proxy(fixture.dependencies.fetch, {}),
  }), /E_MOCK_TCB/);
});

test('16 MiB ASCII output preflight includes the trailing LF exactly', async () => {
  const local = await importImage(source => `${source}\nexport const TEST_PREFLIGHT = outputPreflight;`);
  const exact = 'A'.repeat(16777216 - 3);
  assert.equal(`${JSON.stringify(exact)}\n`.length, 16777216);
  assert.doesNotThrow(() => local.TEST_PREFLIGHT(exact));
  assert.throws(() => local.TEST_PREFLIGHT(`${exact}A`), /E_LIMIT/);
  assert.throws(() => local.TEST_PREFLIGHT('\u00e9'.repeat(Math.floor(16777216 / 6) + 1)), /E_LIMIT/);
});

async function fakeProduction() {
  const fixture = harness();
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

test('production clock bridge charges 9 seconds preparation and clips later requests to original 27s', async () => {
  const fixture = await fakeProduction();
  fixture.state.clock = 9000;
  fixture.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  const originalFetch = fixture.dependencies.fetch;
  fixture.dependencies.fetch = async (...args) => {
    const result = await originalFetch(...args);
    fixture.state.clock += 4000;
    return result;
  };
  const result = await fixture.module.collectRegisteredBootlinGccNoticesV1();
  assert.equal(result.data.error, 'E_DEADLINE');
  assert.equal(result.data.mockOnly, false);
  assert.equal(fixture.state.scheduled[0].delay, 21000);
  assert.deepEqual(fixture.state.scheduled.slice(1).map(timer => timer.end), [19000, 23000, 27000, 27000, 27000]);
  assert.equal(fixture.state.calls.length, 5);
  assert.equal(result.data.counts.completedObservations, 4);
  assert.equal(Object.hasOwn(result.data, 'observations'), false);
});

test('production entry at original 27s expires before GET1', async () => {
  const fixture = await fakeProduction();
  fixture.state.clock = 9000;
  fixture.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  fixture.state.clock = 27000;
  const result = await fixture.module.collectRegisteredBootlinGccNoticesV1();
  assert.equal(result.data.error, 'E_DEADLINE');
  assert.equal(fixture.state.calls.length, 0);
  assert.equal(fixture.state.scheduled[0].delay, 3000);
});

test('production origin cannot reset, resume, or renew the budget', async () => {
  const fixture = await fakeProduction();
  fixture.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  assert.throws(() => fixture.module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0), /E_CLOCK/);
  assert.equal((await fixture.module.collectRegisteredBootlinGccNoticesV1()).exitCode, 0);
  assert.equal((await fixture.module.collectRegisteredBootlinGccNoticesV1()).data.error, 'E_ARGUMENTS');
  assert.equal(fixture.state.calls.length, 5);
});

test('unbound production entry never starts fake transport', async () => {
  const fixture = await fakeProduction();
  const result = await fixture.module.collectRegisteredBootlinGccNoticesV1();
  assert.equal(result.data.error, 'E_CLOCK');
  assert.equal(fixture.state.calls.length, 0);
});

for (const pending of ['pendingFetch', 'pendingRead']) {
  test(`${pending} ignoring abort retains uncertainty without renewing the absolute deadline`, async () => {
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
    assert.equal(result.exitCode, 1);
    assert.equal(result.data.error, 'E_DEADLINE');
    assert.equal(result.data.cleanupUncertain, true);
    assert.equal(result.data.counts[pending === 'pendingFetch' ? 'pendingFetchKnown' : 'pendingReadKnown'], true);
    assert.equal(result.data.counts.transportClosedVerified, false);
    assert.equal(fixture.state.calls[0].init.signal.aborted, true);
    assert.equal(fixture.state.calls.length, 1);
    assert.equal(Object.hasOwn(result.data, 'observations'), false);
  });
}

test('clock regression stops before a request instead of resetting origin', async () => {
  let calls = 0;
  await stopped({ now: () => calls++ === 0 ? 100 : 99 }, 'E_CLOCK', 0);
});

test('clearTimeout uncertainty stops and suppresses completed observations', async () => {
  const fixture = await stopped({ clearResult: Promise.resolve() }, 'E_CLEANUP');
  assert.equal(fixture.result.data.cleanupUncertain, true);
});

test('source-only handoff records the two owned file pins and generated image pins', context => {
  for (const name of ['bootlin-gcc-notices-source.mjs', 'bootlin-gcc-notices-source.test.mjs']) {
    const bytes = readFileSync(new URL(`./${name}`, import.meta.url));
    context.diagnostic(`${name} bytes=${bytes.length} sha256=${hash(bytes)}`);
  }
  context.diagnostic(`generated source bytes=${image.sourceText.length} sha256=${hash(image.sourceText)}`);
  context.diagnostic(`generated policy bytes=${Buffer.byteLength(`${JSON.stringify(POLICY)}\n`)} sha256=${hash(`${JSON.stringify(POLICY)}\n`)}`);
});
