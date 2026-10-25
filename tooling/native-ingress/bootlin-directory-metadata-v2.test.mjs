// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  BOOTLIN_DIRECTORY_METADATA_V2_PINS as PINS,
  buildBootlinDirectoryMetadataV2Source as build,
} from './bootlin-directory-metadata-v2.mjs';

const raw = await readFile(new URL('./bootlin-directory-metadata.mjs', import.meta.url));
const adapter = (await readFile(new URL('./bootlin-directory-metadata-v2.mjs', import.meta.url))).toString('utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const EXPECTED = {
  raw: [19649, '1a625ec28479ac28efeaa19a51095924f7db5c48524a1cd74570e0c4b7f3890f'],
  profile: [19649, '2ba1287648b7c42bdd5abcd8f36d77c726e7bbc7b67cc66440898ff2080381ca'],
  bodyLimits: [19652, 'c6c7fe77de2115988cc80f110193d145565e7a7811e170cf733a2bb280141b6d'],
  outputLimit: [19653, '76dd78b668d5cf71c73f229b3f85afb0aab9752b391e5a3269a269938ea9bd69'],
  entryNames: [19653, 'fe18ce7d1df28e5113b6c1273c7c53722bb17fdc4c096666007779dcaa796d53'],
  policyNames: [19653, '243026d3f1b63abc6674102d55a89c0950bac86a97f318bbac52de96e8eaf7d9'],
  routed: [19644, 'f5ce1d23732051048b8ea10499d4cf1e861bfc74bc31f0febbde95d070e129a1'],
  clockBridge: [794, '28bbe878605dc95eaa7d15d27e1ae9d162c86a755e7d76f8f8e69a97291cf334'],
  final: [20438, 'ece2c9edbb3068bc65ce78454b7f8dbc5236d36f046849f4f30085c58c567557'],
};
assert.equal(raw.length, EXPECTED.raw[0]);
assert.equal(sha(raw), EXPECTED.raw[1]);
const built = build(raw);
const source = built.sourceText;
let sequence = 0;
const importSource = text => import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}#v2-test-${sequence++}`);
const generated = await importSource(source);
const policy = generated.BOOTLIN_DIRECTORY_METADATA_V2_PROFILE;
const URLS = [
  'https://toolchains.bootlin.com/downloads/releases/sources/',
  'https://toolchains.bootlin.com/downloads/releases/licenses/',
];
const MAX = 1048576;

function frozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) frozen(child);
}

function fixture(options = {}) {
  const timers = new Map(), history = [], calls = [], events = [];
  let clock = 0, id = 0;
  const responses = options.responses ?? [{}, {}];
  const caps = {
    fetch(url, init) {
      const index = calls.length;
      calls.push({ url, init });
      if (options.fetch) return options.fetch(url, init, index);
      const config = responses[index] ?? {};
      const chunks = config.chunks ?? [Buffer.from('<html>directory</html>')];
      let read = 0;
      const reader = {
        read() {
          events.push(['read', index]);
          if (config.read) return config.read(read++);
          return read < chunks.length ? { done: false, value: chunks[read++] } : { done: true };
        },
        cancel() { events.push(['cancel', index]); return config.cancel?.(); },
        releaseLock() { events.push(['release', index]); return config.release?.(); },
      };
      return {
        status: config.status ?? 200, redirected: config.redirected ?? false,
        type: config.type ?? 'basic', url: config.url ?? url,
        headers: config.headers ?? [['content-type', 'text/html']],
        body: { getReader() { return reader; }, cancel() { return config.cancel?.(); } },
      };
    },
    now() { return options.now ? options.now() : clock; },
    setTimeout(callback, milliseconds) {
      const timer = { id: ++id, callback, milliseconds };
      history.push(timer);
      timers.set(timer.id, timer);
      return timer.id;
    },
    clearTimeout(handle) { timers.delete(handle); },
  };
  return {
    ...generated.createBootlinDirectoryMetadataFixture({ mockOnly: true }, caps),
    caps, calls, events, history, timers,
    setClock(value) { clock = value; },
    fire(milliseconds) {
      const timer = [...timers.values()].find(item => item.milliseconds === milliseconds);
      assert.ok(timer, `missing fake timer ${milliseconds}`);
      timers.delete(timer.id);
      timer.callback();
    },
  };
}

async function stopped(options, code) {
  const fake = fixture(options);
  const result = await fake.run();
  assert.equal(result.exitCode, 1);
  assert.equal(result.data.status, 'STOP');
  assert.equal(result.data.error, code);
  assert.equal(Object.hasOwn(result.data, 'observations'), false);
  assert.equal(fake.timers.size, 0);
  return { fake, result };
}

test('adapter exports exactly the two approved names', async () => {
  const module = await import('./bootlin-directory-metadata-v2.mjs');
  assert.deepEqual(Object.keys(module), ['BOOTLIN_DIRECTORY_METADATA_V2_PINS', 'buildBootlinDirectoryMetadataV2Source']);
  assert.equal(build.length, 1);
});

test('adapter imports only crypto and util and does not evaluate source', () => {
  assert.deepEqual([...adapter.matchAll(/from '([^']+)'/g)].map(match => match[1]), ['node:crypto', 'node:util']);
  assert.doesNotMatch(adapter, /\b(?:import\s*\(|eval\s*\(|Function\s*\(|fetch\s*\(|process\.|readFile|writeFile)/);
});

test('result has the exact immutable source-only contract', () => {
  assert.deepEqual(Object.keys(built), ['profile', 'sourceText', 'graphPins', 'policyPin']);
  assert.equal(built.profile, 'BOOTLIN_DIRECTORY_METADATA_V2_SOURCE');
  assert.equal(typeof built.sourceText, 'string');
  frozen(built);
  frozen(PINS);
  assert.throws(() => { built.sourceText = ''; }, TypeError);
  assert.throws(() => { PINS.raw.bytes = 1; }, TypeError);
  assert.deepEqual(Object.keys(built.graphPins), Object.keys(EXPECTED));
});

const edits = [
  ['profile', "const PROFILE = 'registered-bootlin-directories-v1';", "const PROFILE = 'registered-bootlin-directories-v2';", 1],
  ['bodyLimits', 'bodyBytes: 65536, aggregateBodyBytes: 131072,', 'bodyBytes: 1048576, aggregateBodyBytes: 2097152,', 1],
  ['outputLimit', 'outputBytes: 1048576, outputDepth: 64, outputNodes: 100000,', 'outputBytes: 16777216, outputDepth: 64, outputNodes: 100000,', 1],
  ['entryNames', 'collectRegisteredBootlinDirectoriesV1', 'collectRegisteredBootlinDirectoriesV2', 2],
  ['policyNames', 'BOOTLIN_DIRECTORY_METADATA_V1_PROFILE', 'BOOTLIN_DIRECTORY_METADATA_V2_PROFILE', 2],
  ['routed', 'now: () => Reflect.apply(NOW, CLOCK, []),', 'now: () => SOURCE_CAPTURE_NOW(),', 1],
];
let expectedSource = raw.toString('ascii');
const stages = { raw: expectedSource };
for (const [name, before, after, count] of edits) {
  assert.equal(expectedSource.split(before).length - 1, count);
  expectedSource = expectedSource.split(before).join(after);
  stages[name] = expectedSource;
}
stages.clockBridge = source.slice(EXPECTED.routed[0]);
stages.final = expectedSource + stages.clockBridge;
for (const [name, [bytes, digest]] of Object.entries(EXPECTED)) {
  test(`independent ${name} byte length and full SHA-256 pin`, () => {
    const encoded = Buffer.from(stages[name], 'ascii');
    assert.equal(encoded.length, bytes);
    assert.equal(sha(encoded), digest);
    assert.deepEqual(PINS[name], { bytes, sha256: digest });
    assert.deepEqual(built.graphPins[name], PINS[name]);
  });
  test(`adapter rejects a corrupted ${name} hard pin before returning importable source`, async () => {
    const needle = `sha256: '${digest}'`;
    assert.equal(adapter.split(needle).length, 2);
    const privateAdapter = await importSource(adapter.replace(needle, `sha256: '${'0'.repeat(64)}'`));
    assert.throws(() => privateAdapter.buildBootlinDirectoryMetadataV2Source(raw), /^Error: E_PIN$/);
  });
}

test('only the approved substitutions and exact LF bridge change V1 bytes', () => {
  assert.equal(source, stages.final);
  assert.ok(stages.clockBridge.startsWith('\nlet SOURCE_PARENT_ORIGIN'));
  assert.ok(stages.clockBridge.endsWith('\n}\n'));
  assert.ok(!stages.clockBridge.endsWith('\n}\n\n'));
  assert.doesNotMatch(source, /collectRegisteredBootlinDirectoriesV1|BOOTLIN_DIRECTORY_METADATA_V1_PROFILE|directories-v1/);
  let restored = source.slice(0, EXPECTED.routed[0]);
  for (const [, before, after, count] of [...edits].reverse()) {
    assert.equal(restored.split(after).length - 1, count);
    restored = restored.split(after).join(before);
  }
  assert.deepEqual(Buffer.from(restored, 'ascii'), raw);
});

test('every intermediate transform is verified before the next stage', () => {
  for (const [name] of edits) assert.match(adapter, new RegExp(`, graphPins\\.${name}\\);`));
  assert.ok(adapter.indexOf('verify(copy, graphPins.raw)') < adapter.indexOf(".toString('ascii')"));
  assert.ok(adapter.indexOf('verify(Buffer.from(CLOCK_BRIDGE') < adapter.indexOf('source += CLOCK_BRIDGE'));
  assert.ok(adapter.indexOf('verify(Buffer.from(source') < adapter.indexOf('return freeze({ profile:'));
});

test('actual generated policy matches the independent 1027-byte policy pin', context => {
  const bytes = Buffer.from(JSON.stringify(policy) + '\n');
  assert.equal(bytes.length, 1027);
  assert.equal(sha(bytes), '47336055ae39a95bdccb99e4a3fcee3a5618016fd946c6d15f1300a4a6e1ef16');
  assert.deepEqual(built.policyPin, { bytes: 1027, sha256: sha(bytes) });
  assert.deepEqual(PINS.policy, built.policyPin);
  frozen(policy);
  context.diagnostic(JSON.stringify({ generatedPolicy: { bytes: bytes.length, sha256: sha(bytes) } }));
});

test('generated exports include no callable V1 entry or mislabeled V1 policy', () => {
  assert.deepEqual(Object.keys(generated), [
    'BOOTLIN_DIRECTORY_METADATA_V2_PROFILE', 'SOURCE_BIND_PARENT_CLOCK_ORIGIN',
    'collectRegisteredBootlinDirectoriesV2', 'createBootlinDirectoryMetadataFixture',
  ]);
  assert.equal(generated.collectRegisteredBootlinDirectoriesV1, undefined);
});

test('exact URLs, unchanged source reference and all fixed resource limits', () => {
  assert.deepEqual(policy.urls, URLS);
  assert.deepEqual(policy.roles, ['sources', 'licenses']);
  assert.equal(policy.sourceRef.registration, '33');
  assert.equal(policy.sourceRef.rootReadmeSha256, 'fa0b24cb67e660a5aebe2f4d4705b5a7ca2e5860e2e0405ddf6fddad40d4a41a');
  assert.equal(policy.sourceRef.lifecycle, 'outside-offline-capture-build-runtime');
  assert.deepEqual(policy.limits, {
    requests: 2, headerPairs: 64, headerBytes: 16384,
    bodyBytes: MAX, aggregateBodyBytes: 2 * MAX,
    readsPerResponse: 1024, aggregateReads: 2048,
    requestMilliseconds: 10000, workMilliseconds: 27000,
    totalMilliseconds: 30000, cleanupReserveMilliseconds: 3000,
    outputBytes: 16777216, outputDepth: 64, outputNodes: 100000,
  });
});

for (const [name, value] of [
  ['undefined', undefined], ['null', null], ['string', 'not bytes'], ['array', []],
  ['plain object', {}], ['Uint8Array', new Uint8Array(19649)],
  ['DataView', new DataView(new ArrayBuffer(19649))], ['ArrayBuffer', new ArrayBuffer(19649)],
  ['empty Buffer', Buffer.alloc(0)], ['short Buffer', Buffer.alloc(19500)],
  ['one-byte oversized Buffer', Buffer.alloc(19650)], ['large Buffer', Buffer.alloc(2 * MAX)],
]) test(`rejects ${name} without accepting a caller profile`, () => assert.throws(() => build(value), /^Error: E_BUFFER$/));

test('exactly one argument is mandatory', () => {
  assert.throws(() => build(), /^Error: E_ARGUMENTS$/);
  assert.throws(() => build(raw, undefined), /^Error: E_ARGUMENTS$/);
  assert.throws(() => build(raw, PINS), /^Error: E_ARGUMENTS$/);
});

test('rejects transparent and revoked proxies without invoking traps', () => {
  let touched = 0;
  const proxy = new Proxy(raw, { get() { touched++; }, getPrototypeOf() { touched++; }, ownKeys() { touched++; } });
  assert.throws(() => build(proxy), /^Error: E_BUFFER$/);
  const revoked = Proxy.revocable(raw, {});
  revoked.revoke();
  assert.throws(() => build(revoked.proxy), /^Error: E_BUFFER$/);
  assert.equal(touched, 0);
});

for (const key of ['length', 'byteLength', 'buffer', 'byteOffset', 'set', 'toString', 'x', '019649', '1e0', Symbol('custom'), Symbol.iterator]) {
  test(`rejects custom/accessor property ${String(key)} without invoking it`, () => {
    const bytes = Buffer.from(raw);
    let touched = 0;
    Object.defineProperty(bytes, key, { get() { touched++; throw new Error('untrusted'); } });
    assert.throws(() => build(bytes), /^Error: E_BUFFER$/);
    assert.equal(touched, 0);
  });
}

test('rejects custom data properties and Buffer subclasses', () => {
  const bytes = Buffer.from(raw);
  bytes.extra = true;
  assert.throws(() => build(bytes), /^Error: E_BUFFER$/);
  const subclass = Buffer.from(raw);
  class Child extends Buffer {}
  Object.setPrototypeOf(subclass, Child.prototype);
  assert.throws(() => build(subclass), /^Error: E_BUFFER$/);
});

test('numeric index mutation fails the raw pin and numeric accessors cannot be installed', () => {
  const bytes = Buffer.from(raw);
  let touched = false;
  for (const key of ['0', '-1', String(raw.length)]) {
    assert.throws(() => Object.defineProperty(bytes, key, { get() { touched = true; return 0; } }), TypeError);
  }
  bytes[0] ^= 1;
  assert.throws(() => build(bytes), /^Error: E_PIN$/);
  assert.equal(touched, false);
});

test('rejects SharedArrayBuffer backing', () => {
  const bytes = Buffer.from(new SharedArrayBuffer(raw.length));
  bytes.set(raw);
  assert.throws(() => build(bytes), /^Error: E_BUFFER$/);
});

test('rejects resizable backing', { skip: !Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable') }, () => {
  const bytes = Buffer.from(new ArrayBuffer(raw.length, { maxByteLength: raw.length + 1 }));
  bytes.set(raw);
  assert.throws(() => build(bytes), /^Error: E_BUFFER$/);
});

test('rejects detached backing', () => {
  const backing = new ArrayBuffer(raw.length);
  const bytes = Buffer.from(backing);
  bytes.set(raw);
  structuredClone(backing, { transfer: [backing] });
  assert.throws(() => build(bytes), /^Error: E_BUFFER$/);
});

test('size admission precedes private-copy allocation', async () => {
  const needle = 'const copy = new Uint8Array(length);';
  assert.equal(adapter.split(needle).length, 2);
  const instrumented = await importSource(adapter.replace(needle, `throw new Error('TEST_COPY_REACHED'); ${needle}`));
  const probe = instrumented.buildBootlinDirectoryMetadataV2Source;
  for (const size of [0, 19500, 19648, 19650, MAX]) assert.throws(() => probe(Buffer.alloc(size)), /^Error: E_BUFFER$/);
  assert.throws(() => probe(raw), /^Error: TEST_COPY_REACHED$/);
});

test('known raw bytes stay unchanged and no mutable caller view escapes', () => {
  const bytes = Buffer.from(raw), snapshot = Buffer.from(bytes);
  const result = build(bytes);
  assert.deepEqual(bytes, snapshot);
  bytes.fill(0);
  assert.equal(result.sourceText, source);
  assert.equal(sha(raw), EXPECTED.raw[1]);
});

test('accepts a correctly pinned exact Buffer view with nonzero offset', () => {
  const bytes = Buffer.alloc(raw.length + 16);
  bytes.set(raw, 8);
  assert.equal(build(bytes.subarray(8, 8 + raw.length)).sourceText, source);
});

for (const [name, before] of edits) {
  test(`rejects missing ${name} substitution in raw before any generated import`, () => {
    const bytes = Buffer.from(raw);
    const at = bytes.indexOf(before);
    assert.ok(at >= 0);
    bytes[at] ^= 1;
    assert.throws(() => build(bytes), /^Error: E_PIN$/);
  });
  test(`rejects duplicate ${name} substitution rather than accepting caller pins`, () => {
    const bytes = Buffer.from(raw);
    bytes.write(before, 0, 'ascii');
    assert.throws(() => build(bytes), /^Error: E_PIN$/);
  });
}

test('rejects same-size ASCII tampering and non-ASCII before decode', () => {
  for (const value of [0, 127, 128, 255]) {
    const bytes = Buffer.from(raw);
    bytes[0] = value;
    assert.throws(() => build(bytes), /^Error: E_PIN$/);
  }
});

test('64 KiB + 1 now succeeds as V2 metadata only', async () => {
  const fake = fixture({ responses: [{ chunks: [Buffer.alloc(65537, 120)] }, {}] });
  const result = await fake.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.mockOnly, true);
  assert.equal(result.data.profile, 'registered-bootlin-directories-v2');
  assert.equal(result.data.observations[0].observedBodyBytes, 65537);
  assert.equal(fake.timers.size, 0);
  frozen(result);
});

test('both exact 1 MiB bodies succeed at the exact 2 MiB aggregate cap', async () => {
  const fake = fixture({ responses: [0, 1].map(() => ({ chunks: [Buffer.alloc(MAX, 120)] })) });
  const result = await fake.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.counts.retainedBytes, 2 * MAX);
  assert.equal(result.data.counts.deliveredBytes, 2 * MAX);
  assert.equal(result.data.counts.eofObservations, 2);
  assert.equal(result.data.counts.fetchCalls, 2);
});

test('1 MiB + 1 delivery rejects its chunk, withholds HTML and prevents request two', async () => {
  const { result, fake } = await stopped({ responses: [{ chunks: [Buffer.alloc(MAX, 120), Buffer.from('x')] }] }, 'E_LIMIT');
  assert.equal(result.data.counts.deliveredBytes, MAX + 1);
  assert.equal(result.data.counts.retainedBytes, MAX);
  assert.equal(result.data.counts.rejectedChunks, 1);
  assert.equal(result.data.counts.eofObservations, 0);
  assert.equal(fake.calls.length, 1);
});

test('oversized single delivery is counted but never retained', async () => {
  const { result } = await stopped({ responses: [{ chunks: [Buffer.alloc(MAX + 1, 120)] }] }, 'E_LIMIT');
  assert.equal(result.data.counts.deliveredBytes, MAX + 1);
  assert.equal(result.data.counts.retainedBytes, 0);
});

test('aggregate limit never expands after the first full body', async () => {
  const { result } = await stopped({ responses: [
    { chunks: [Buffer.alloc(MAX, 120)] },
    { chunks: [Buffer.alloc(MAX, 120), Buffer.from('x')] },
  ] }, 'E_LIMIT');
  assert.equal(result.data.counts.deliveredBytes, 2 * MAX + 1);
  assert.equal(result.data.counts.retainedBytes, 2 * MAX);
  assert.equal(result.data.counts.completedObservations, 1);
  assert.equal(result.data.counts.fetchCalls, 2);
});

test('declared content-length accepts exactly 1 MiB', async () => {
  const result = await fixture({ responses: [{
    chunks: [Buffer.alloc(MAX, 120)],
    headers: [['content-type', 'text/html'], ['content-length', String(MAX)]],
  }, {}] }).run();
  assert.equal(result.exitCode, 0);
});

test('declared content-length over 1 MiB stops before a body read', async () => {
  const { result } = await stopped({ responses: [{ headers: [['content-type', 'text/html'], ['content-length', String(MAX + 1)]] }] }, 'E_LIMIT');
  assert.equal(result.data.counts.readAttempts, 0);
});

test('declared content-length mismatch still rejects', async () => {
  await stopped({ responses: [{ headers: [['content-type', 'text/html'], ['content-length', '0']] }] }, 'E_BODY');
});

test('UTF-8 BOM remains visible and hash covers exact bytes', async () => {
  const body = Buffer.from('\ufeff<html>ok</html>');
  const result = await fixture({ responses: [{ chunks: [body] }, {}] }).run();
  assert.equal(result.exitCode, 0);
  assert.ok(result.data.observations[0].bodyUtf8.startsWith('\ufeff'));
  assert.equal(result.data.observations[0].bodySha256, sha(body));
});

for (const [name, body] of [
  ['invalid continuation', Buffer.from([0xc3, 0x28])],
  ['truncated UTF-8', Buffer.from([0xe2, 0x82])],
  ['overlong UTF-8', Buffer.from([0xc0, 0xaf])],
  ['NUL control', Buffer.from('a\0b')],
  ['DEL control', Buffer.from('a\x7fb')],
  ['C1 control', Buffer.from('a\u0080b')],
]) test(`unchanged UTF-8 validation rejects ${name}`, async () => {
  await stopped({ responses: [{ chunks: [body] }] }, 'E_UTF8');
});

test('tab LF and CR remain accepted without HTML interpretation', async () => {
  const result = await fixture({ responses: [{ chunks: [Buffer.from('\t\n\r<html>ok</html>')] }, {}] }).run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.observations[0].interpreted, false);
});

test('64 header pairs still succeed', async () => {
  const headers = [['content-type', 'text/html'], ...Array.from({ length: 63 }, (_, index) => [`x-${index}`, 'v'])];
  assert.equal((await fixture({ responses: [{ headers }, {}] }).run()).exitCode, 0);
});

test('65 header pairs still stop', async () => {
  const headers = [['content-type', 'text/html'], ...Array.from({ length: 64 }, (_, index) => [`x-${index}`, 'v'])];
  await stopped({ responses: [{ headers }] }, 'E_LIMIT');
});

for (const extra of [0, 1]) test(`header aggregate 16 KiB ${extra ? '+ 1 rejects' : 'exact succeeds'}`, async () => {
  const headers = [['content-type', 'text/html'], ['x', 'x'.repeat(16384 - 22 + extra)]];
  if (extra) await stopped({ responses: [{ headers }] }, 'E_LIMIT');
  else assert.equal((await fixture({ responses: [{ headers }, {}] }).run()).exitCode, 0);
});

for (const [name, response] of [
  ['redirected flag', { redirected: true }], ['redirect status', { status: 302 }],
  ['opaque response', { type: 'opaque' }], ['different URL', { url: 'https://invalid.example/' }],
  ['compressed encoding', { headers: [['content-type', 'text/html'], ['content-encoding', 'gzip']] }],
  ['duplicate header', { headers: [['content-type', 'text/html'], ['Content-Type', 'text/html']] }],
  ['non-HTML type', { headers: [['content-type', 'application/octet-stream']] }],
  ['header control', { headers: [['content-type', 'text/html'], ['x', 'bad\nvalue']] }],
]) test(`HTTP policy still rejects ${name}`, async () => { await stopped({ responses: [response] }, 'E_HEADERS'); });

test('two 1024-read responses meet the unchanged 2048-read aggregate ceiling', async () => {
  const responses = [0, 1].map(() => ({ chunks: Array.from({ length: 1023 }, () => Buffer.from('x')) }));
  const result = await fixture({ responses }).run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.counts.readAttempts, 2048);
});

test('response requiring read 1025 stops without probing EOF', async () => {
  const { result } = await stopped({ responses: [{ chunks: Array.from({ length: 1024 }, () => Buffer.from('x')) }] }, 'E_LIMIT');
  assert.equal(result.data.counts.readAttempts, 1024);
  assert.equal(result.data.counts.eofObservations, 0);
});

test('escaped Unicode from two full bodies fits the actual new output allowance', async () => {
  const body = Buffer.from('\u0100'.repeat(MAX / 2));
  assert.equal(body.length, MAX);
  const result = await fixture({ responses: [{ chunks: [body] }, { chunks: [body] }] }).run();
  assert.equal(result.exitCode, 0);
  const ascii = JSON.stringify(result.data).replace(/[\u007f-\uffff]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`) + '\n';
  assert.ok(ascii.length > MAX);
  assert.ok(ascii.length <= 16777216);
});

const outputTest = await importSource(source + '\nexport { outputPreflight as TEST_OUTPUT_PREFLIGHT };\n');
test('actual output preflight accepts exactly 16 MiB', () => {
  assert.doesNotThrow(() => outputTest.TEST_OUTPUT_PREFLIGHT('x'.repeat(16777216 - 3)));
});
test('actual output preflight rejects 16 MiB + 1', () => {
  assert.throws(() => outputTest.TEST_OUTPUT_PREFLIGHT('x'.repeat(16777216 - 2)), /^Error: E_LIMIT$/);
});
test('output depth remains capped at 64', () => {
  let value = 'x';
  for (let index = 0; index < 64; index++) value = { value };
  assert.doesNotThrow(() => outputTest.TEST_OUTPUT_PREFLIGHT(value));
  assert.throws(() => outputTest.TEST_OUTPUT_PREFLIGHT({ value }), /^Error: E_LIMIT$/);
});
test('output node count remains capped at 100000', () => {
  assert.doesNotThrow(() => outputTest.TEST_OUTPUT_PREFLIGHT(Array(99998).fill(null)));
  assert.throws(() => outputTest.TEST_OUTPUT_PREFLIGHT(Array(99999).fill(null)), /^Error: E_LIMIT$/);
});

test('fake fixture rejects missing, surplus or real captured capabilities', () => {
  const caps = fixture().caps;
  const factory = generated.createBootlinDirectoryMetadataFixture;
  assert.throws(() => factory({ mockOnly: false }, caps), /^Error: E_MOCK_TCB$/);
  assert.throws(() => factory({ mockOnly: true }, { ...caps, now: undefined }), /^Error: E_MOCK_TCB$/);
  assert.throws(() => factory({ mockOnly: true }, { ...caps, other: () => {} }), /^Error: E_MOCK_TCB$/);
  assert.throws(() => factory({ mockOnly: true }, { ...caps, fetch: globalThis.fetch }), /^Error: E_MOCK_TCB$/);
  assert.throws(() => factory({ mockOnly: true }, { ...caps, now: performance.now }), /^Error: E_MOCK_TCB$/);
  assert.throws(() => factory({ mockOnly: true }, { ...caps, setTimeout: globalThis.setTimeout }), /^Error: E_MOCK_TCB$/);
  assert.throws(() => factory({ mockOnly: true }, { ...caps, clearTimeout: globalThis.clearTimeout }), /^Error: E_MOCK_TCB$/);
});

test('fixture rejects accessor configuration without invoking it', () => {
  let touched = false;
  const configuration = { get mockOnly() { touched = true; return true; } };
  assert.throws(() => generated.createBootlinDirectoryMetadataFixture(configuration, fixture().caps), /^Error: E_MOCK_TCB$/);
  assert.equal(touched, false);
});

test('one-shot fake fixture cannot retry after success', async () => {
  const fake = fixture();
  assert.equal((await fake.run()).exitCode, 0);
  const result = await fake.run();
  assert.equal(result.data.error, 'E_ARGUMENTS');
  assert.equal(fake.calls.length, 2);
});

test('invalid fixture arguments consume its local latch without fetch', async () => {
  const fake = fixture();
  assert.equal((await fake.run('untrusted error text')).data.error, 'E_ARGUMENTS');
  assert.equal((await fake.run()).data.error, 'E_ARGUMENTS');
  assert.equal(fake.calls.length, 0);
});

test('fixed fetch errors never leak arbitrary input text', async () => {
  const { result } = await stopped({ fetch() { throw new Error('secret arbitrary input'); } }, 'E_FETCH');
  assert.doesNotMatch(JSON.stringify(result), /secret|arbitrary/);
});

test('fetches remain two exact metadata GETs without acquisition fallback', async () => {
  const fake = fixture();
  const result = await fake.run();
  assert.equal(result.exitCode, 0);
  assert.deepEqual(fake.calls.map(call => call.url), URLS);
  for (const { init } of fake.calls) {
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'manual');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.cache, 'no-store');
    assert.deepEqual(init.headers, { Accept: 'text/html', 'Accept-Encoding': 'identity' });
  }
  for (const [key, value] of Object.entries(result.data)) {
    if (/(?:Authenticated|Verified|Qualified|Ready|Guaranteed|Bounded|Observed|Isolated)$/.test(key)) assert.equal(value, false, key);
  }
  assert.equal(result.data.sourceRootAuthentication, false);
  assert.equal(result.data.licenseComplianceVerified, false);
});

function productionImage(configuration = {}) {
  const prefix = `
const TEST_STATE = { clock: 0, history: [], timers: new Map(), calls: [], clears: 0, skip: 0, jump: false };
const TEST_CONFIG = ${JSON.stringify(configuration)};
const TEST_CAPS = {
  fetch(url, init) {
    const index = TEST_STATE.calls.length;
    TEST_STATE.calls.push({ url, init });
    if (TEST_CONFIG.hangFetch) return new Promise(() => {});
    let read = 0;
    return { status: 200, redirected: false, type: 'basic', url,
      headers: [['content-type', 'text/html']],
      body: { getReader() { return {
        read() {
          if (TEST_CONFIG.hangRead) return new Promise(() => {});
          if (read++ === 0) {
            if (TEST_CONFIG.finishFirst && index === 0) TEST_STATE.clock = 18999;
            return { done: false, value: Buffer.from('<html>fake</html>') };
          }
          return { done: true };
        },
        cancel() { return TEST_CONFIG.hangCancel ? new Promise(() => {}) : undefined; },
        releaseLock() {},
      }; } },
    };
  },
  now() {
    if (TEST_STATE.jump) {
      if (TEST_STATE.skip-- === 0) { TEST_STATE.clock = 26999; TEST_STATE.jump = false; }
    }
    return TEST_STATE.clock;
  },
  setTimeout(callback, milliseconds) {
    const id = TEST_STATE.history.length + 1;
    const timer = { id, callback, milliseconds };
    TEST_STATE.history.push(timer);
    TEST_STATE.timers.set(id, timer);
    return id;
  },
  clearTimeout(id) {
    TEST_STATE.timers.delete(id);
    TEST_STATE.clears++;
    if (TEST_CONFIG.pauseAfterFirst && TEST_STATE.clears === 1) { TEST_STATE.skip = 1; TEST_STATE.jump = true; }
  },
};
export { TEST_STATE };
export function TEST_SET_CLOCK(value) { TEST_STATE.clock = value; }
export function TEST_FIRE(milliseconds) {
  const timer = [...TEST_STATE.timers.values()].find(item => item.milliseconds === milliseconds);
  if (!timer) throw new Error('E_TEST_TIMER');
  TEST_STATE.timers.delete(timer.id);
  timer.callback();
}
`;
  const replacements = [
    ['const FETCH = globalThis.fetch;', 'const FETCH = TEST_CAPS.fetch;'],
    ['const NOW = performance.now;', 'const NOW = TEST_CAPS.now;'],
    ['const CLOCK = performance;', 'const CLOCK = TEST_CAPS;'],
    ['const SET_TIMEOUT = globalThis.setTimeout;', 'const SET_TIMEOUT = TEST_CAPS.setTimeout;'],
    ['const CLEAR_TIMEOUT = globalThis.clearTimeout;', 'const CLEAR_TIMEOUT = TEST_CAPS.clearTimeout;'],
  ];
  let image = source;
  for (const [before, after] of replacements) {
    assert.equal(image.split(before).length, 2);
    image = image.replace(before, after);
  }
  for (const [before] of replacements) assert.equal(image.includes(before), false);
  return importSource(prefix + image);
}

async function microtasksUntil(predicate) {
  for (let index = 0; index < 200; index++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail('fake operation did not reach expected state');
}

test('production image uses original origin: 9s prep, 21s outer, 10s first, 1ms second', async () => {
  const module = await productionImage({ finishFirst: true, pauseAfterFirst: true });
  module.TEST_SET_CLOCK(9000);
  module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  const result = await module.collectRegisteredBootlinDirectoriesV2();
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.mockOnly, false);
  assert.deepEqual(module.TEST_STATE.history.map(timer => timer.milliseconds), [21000, 10000, 1]);
  assert.equal(module.TEST_STATE.calls.length, 2);
  assert.equal(module.TEST_STATE.timers.size, 0);
  assert.deepEqual(module.TEST_STATE.calls.map(call => call.url), URLS);
});

test('late production invocation at original 27s stops with zero fetch and 3s outer', async () => {
  const module = await productionImage();
  module.TEST_SET_CLOCK(9000);
  module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  module.TEST_SET_CLOCK(27000);
  const result = await module.collectRegisteredBootlinDirectoriesV2();
  assert.equal(result.data.error, 'E_DEADLINE');
  assert.equal(module.TEST_STATE.calls.length, 0);
  assert.deepEqual(module.TEST_STATE.history.map(timer => timer.milliseconds), [3000]);
  assert.equal(module.TEST_STATE.timers.size, 0);
});

test('production cannot run without the private parent clock binding', async () => {
  const module = await productionImage();
  const result = await module.collectRegisteredBootlinDirectoriesV2();
  assert.equal(result.data.error, 'E_CLOCK');
  assert.equal(module.TEST_STATE.calls.length, 0);
});

test('production invalid arguments consume only that fresh URI latch', async () => {
  const module = await productionImage();
  assert.equal((await module.collectRegisteredBootlinDirectoriesV2({ fetch: () => {} })).data.error, 'E_ARGUMENTS');
  module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  assert.equal((await module.collectRegisteredBootlinDirectoriesV2()).data.error, 'E_ARGUMENTS');
  assert.equal(module.TEST_STATE.calls.length, 0);
  assert.equal(module.collectRegisteredBootlinDirectoriesV1, undefined);
  const independent = await productionImage();
  independent.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  assert.equal((await independent.collectRegisteredBootlinDirectoriesV2()).exitCode, 0);
});

for (const origin of [-1, NaN, Infinity, '0', null, Number.MAX_SAFE_INTEGER - 29999]) {
  test(`clock binding rejects invalid origin ${String(origin)}`, async () => {
    const module = await productionImage();
    assert.throws(() => module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(origin), /^Error: E_CLOCK$/);
    assert.equal(module.TEST_STATE.calls.length, 0);
  });
}

test('clock binding checks exact arity and rejects rebinding', async () => {
  const module = await productionImage();
  assert.throws(() => module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(), /^Error: E_CLOCK$/);
  assert.throws(() => module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0, undefined), /^Error: E_CLOCK$/);
  module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  assert.throws(() => module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0), /^Error: E_CLOCK$/);
});

test('clock binding rejects expired preparation and future origin', async () => {
  const module = await productionImage();
  module.TEST_SET_CLOCK(10000);
  assert.throws(() => module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0), /^Error: E_CLOCK$/);
  assert.throws(() => module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(10001), /^Error: E_CLOCK$/);
});

test('subsequent actual clock rollback stops without further acquisition', async () => {
  const module = await productionImage();
  module.TEST_SET_CLOCK(9000);
  module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(9000);
  module.TEST_SET_CLOCK(8999);
  const result = await module.collectRegisteredBootlinDirectoriesV2();
  assert.equal(result.data.error, 'E_CLOCK');
  assert.equal(module.TEST_STATE.calls.length, 0);
});

for (const hang of ['hangFetch', 'hangRead']) test(`original parent request timeout handles ignored abort: ${hang}`, async () => {
  const module = await productionImage({ [hang]: true });
  module.TEST_SET_CLOCK(9000);
  module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  const pending = module.collectRegisteredBootlinDirectoriesV2();
  await microtasksUntil(() => hang === 'hangFetch' ? module.TEST_STATE.calls.length === 1 : module.TEST_STATE.history.length === 2);
  if (hang === 'hangRead') for (let index = 0; index < 30; index++) await Promise.resolve();
  module.TEST_SET_CLOCK(19000);
  module.TEST_FIRE(10000);
  const result = await pending;
  assert.equal(result.data.error, 'E_DEADLINE');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(Object.hasOwn(result.data, 'observations'), false);
  assert.equal(module.TEST_STATE.calls.length, 1);
  assert.equal(module.TEST_STATE.calls[0].init.signal.aborted, true);
  assert.equal(module.TEST_STATE.timers.size, 0);
});

test('ignored cancellation remains uncertain and ends at original parent 30s', async () => {
  const module = await productionImage({ hangRead: true, hangCancel: true });
  module.TEST_SET_CLOCK(9000);
  module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
  const pending = module.collectRegisteredBootlinDirectoriesV2();
  await microtasksUntil(() => module.TEST_STATE.calls.length === 1);
  for (let index = 0; index < 30; index++) await Promise.resolve();
  module.TEST_SET_CLOCK(19000);
  module.TEST_FIRE(10000);
  for (let index = 0; index < 30; index++) await Promise.resolve();
  module.TEST_SET_CLOCK(30000);
  module.TEST_FIRE(21000);
  const result = await pending;
  assert.equal(result.data.error, 'E_DEADLINE');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(result.data.counts.cancellations, 1);
  assert.equal(result.data.counts.pendingReadKnown, true);
  assert.equal(Object.hasOwn(result.data, 'observations'), false);
  assert.equal(module.TEST_STATE.timers.size, 0);
});

test('cleanup failure withholds previously completed metadata and keeps uncertainty', async () => {
  const { result } = await stopped({ responses: [{}, { release() { throw new Error('private cleanup error'); } }] }, 'E_CLEANUP');
  assert.equal(result.data.cleanupUncertain, true);
  assert.equal(result.data.counts.completedObservations, 1);
  assert.doesNotMatch(JSON.stringify(result), /private cleanup error/);
});
