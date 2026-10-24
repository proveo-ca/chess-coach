// SPEC: _spec/tooling/native-ingress/acquisition.puml
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { CustodyError } from './custody.mjs';
import { acquireArtifact as rawAcquireArtifact, acquireGnu2026 as rawAcquireGnu2026,
  createArtifactDescriptor, GNU2026_ARTIFACT,
  MAX_ARTIFACT_BYTES, MAX_CHUNK_BYTES, MAX_DATA_EVENTS, MAX_CLOCK_READS,
  MAX_FS_CALLS, MAX_LIFECYCLE_EVENTS } from './acquisition.mjs';

const PREFIX = 'https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const payload = Buffer.from('mocked archive bytes\n');
const descriptor = (bytes = payload) => ({ name: 'fixture.tar.xz', url: PREFIX + 'fixture.tar.xz',
  byteLength: bytes.length, sha256: sha(bytes) });
const rejects = (promise, code) => assert.rejects(promise,
  error => error instanceof CustodyError && error.code === code);
const realWrite = fs.writeSync;
const rootContexts = new Map(), clocks = new WeakMap();
let fixtureWrites = 0;
mock.method(https, 'request', () => { throw Error('HTTPS outside mocked harness'); });
mock.method(https, 'get', () => { throw Error('HTTPS get forbidden'); });
mock.method(fs, 'writeSync', (fd, bytes, offset, length, position) => {
  assert.equal(typeof position, 'number');
  assert.ok(position >= 0 && position + length <= 1_048_576);
  assert.ok(fixtureWrites + length <= 8_388_608);
  const written = realWrite(fd, bytes, offset, length, position);
  fixtureWrites += written;
  return written;
});

function fixtures(t) {
  fakeClock(t);
  const parent = fs.mkdtempSync('/tmp/opencode/f9-acquisition-test-'), roots = [];
  assert.equal(fs.statSync(parent).mode & 0o7777, 0o700);
  t.after(() => {
    t.mock.restoreAll();
    for (const root of roots.reverse()) {
      rootContexts.delete(root);
      let stat;
      try { stat = fs.lstatSync(root); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (stat.isSymbolicLink()) { fs.unlinkSync(root); continue; }
      try { fs.unlinkSync(path.join(root, 'fixture.tar.xz')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      fs.rmdirSync(root);
    }
    fs.rmdirSync(parent);
  });
  return () => {
    const root = path.join(parent, `case-${roots.length}`);
    roots.push(root);
    rootContexts.set(root, t);
    return root;
  };
}

function transport(t, options = {}) {
  const ledger = [], calls = [];
  const bytes = options.bytes ?? payload;
  class Response extends EventEmitter {
    statusCode = options.status ?? 200;
    rawHeaders = options.headers ?? ['Content-Length', String(bytes.length)];
    complete = false;
    destroys = 0;
    destroy() {
      this.destroys++;
      ledger.push('destroyResponse');
      if (options.onDestroyResponse) options.onDestroyResponse();
      if (options.destroyResponseCloses !== false) queueMicrotask(() => closeResponse());
      if (options.destroyResponseThrows) throw Error('response destroy uncertainty');
    }
  }
  class Request extends EventEmitter {
    destroys = 0;
    ends = 0;
    end() {
      this.ends++;
      ledger.push('endRequest');
      assert.equal(this.maxHeadersCount, 33);
      if (options.endThrows) throw Error('end failure');
      queueMicrotask(() => {
        if (options.script) { options.script(api); return; }
        respond();
        for (const chunk of options.chunks ?? [bytes]) data(chunk);
        if (options.end !== false) end();
        if (options.closeResponse !== false) closeResponse();
        if (options.closeRequest !== false) closeRequest();
      });
    }
    destroy() {
      this.destroys++;
      ledger.push('destroyRequest');
      if (options.onDestroyRequest) options.onDestroyRequest();
      if (options.destroyRequestCloses !== false) queueMicrotask(() => closeRequest());
      if (options.destroyRequestThrows) throw Error('request destroy uncertainty');
    }
  }
  const request = new Request(), response = new Response();
  const respond = () => { ledger.push('response'); request.emit('response', response); };
  const data = chunk => { ledger.push('data'); response.emit('data', chunk); };
  const end = () => { ledger.push('endResponse'); response.complete = options.complete !== false; response.emit('end'); };
  const closeRequest = () => { ledger.push('closeRequest'); request.emit('close'); };
  const closeResponse = () => { ledger.push('closeResponse'); response.emit('close'); };
  const api = { request, response, ledger, calls, respond, data, end, closeRequest, closeResponse };
  t.mock.method(https, 'get', () => { throw Error('unused HTTPS get forbidden'); });
  t.mock.method(https, 'request', (url, config) => {
    calls.push({ url, config });
    ledger.push('request');
    if (options.onRequest) options.onRequest(api);
    if (options.requestThrows) throw Error('request failure');
    return request;
  });
  return api;
}

function trackFds(t, hooks = {}) {
  const open = fs.openSync, close = fs.closeSync, active = new Set();
  const counts = { opens: 0, closes: 0, peak: 0 };
  t.mock.method(fs, 'openSync', (...args) => {
    const fd = open(...args);
    assert.equal(active.has(fd), false);
    active.add(fd);
    counts.opens++;
    counts.peak = Math.max(counts.peak, active.size);
    if (hooks.afterOpen) hooks.afterOpen(counts.opens);
    return fd;
  });
  t.mock.method(fs, 'closeSync', fd => {
    assert.equal(active.delete(fd), true);
    counts.closes++;
    const value = close(fd);
    if (hooks.afterClose) hooks.afterClose(counts.closes);
    return value;
  });
  return { active, counts };
}

function fakeClock(t) {
  if (clocks.has(t)) return clocks.get(t);
  let time = 0n;
  let sample = () => time;
  t.mock.method(process.hrtime, 'bigint', () => sample());
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => t.mock.timers.reset());
  const advance = milliseconds => {
    time += BigInt(milliseconds) * 1_000_000n;
    t.mock.timers.tick(milliseconds);
  };
  advance.sample = read => { sample = read; };
  advance.elapsed = () => time;
  clocks.set(t, advance);
  return advance;
}

async function drainMicrotasks() {
  for (let turn = 0; turn < 16; turn++) await Promise.resolve();
}

async function boundedSettlement(t, promise) {
  let settled = false, value, failure;
  Promise.resolve(promise).then(result => {
    value = result;
    settled = true;
  }, error => {
    failure = error;
    settled = true;
  });
  await drainMicrotasks();
  const forced = !settled;
  if (!settled) {
    fakeClock(t)(119_000);
    await drainMicrotasks();
  }
  if (!settled) {
    fakeClock(t)(1000);
    await drainMicrotasks();
  }
  assert.equal(settled, true, 'acquisition did not settle within bounded fake work and cleanup deadlines');
  assert.equal(forced, false, 'acquisition required a forced fake deadline instead of expected settlement');
  if (failure) throw failure;
  return value;
}

function acquireArtifact(root, input) {
  const t = rootContexts.get(root);
  assert.ok(t, 'acquisition root must belong to the active fixture context');
  return boundedSettlement(t, rawAcquireArtifact(root, input));
}

test('SOURCE_SPEC acquisition pointers, diagram covers and index agree', () => {
  const spec = '_spec/tooling/native-ingress/acquisition.puml';
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  for (const name of ['acquisition.mjs', 'acquisition.test.mjs']) {
    assert.equal(fs.readFileSync(new URL(name, import.meta.url), 'utf8').split('\n')[0],
      '// SPEC: ' + spec);
    assert.ok(diagram.includes("' covers: tooling/native-ingress/" + name + '\n'));
  }
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(entry => entry.spec === spec), [{ spec,
    covers: ['tooling/native-ingress/acquisition.mjs', 'tooling/native-ingress/acquisition.test.mjs'], fingerprint: null }]);
});

test('descriptor exact immutable snapshot and advertised GNU metadata', () => {
  const input = descriptor(), result = createArtifactDescriptor(input);
  input.byteLength = 1;
  assert.deepEqual(Object.keys(result), ['name', 'url', 'byteLength', 'sha256']);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.byteLength, payload.length);
  assert.equal(createArtifactDescriptor(Object.assign(Object.create(null), descriptor())).sha256, sha(payload));
  assert.equal(MAX_ARTIFACT_BYTES, 134_217_728);
  assert.equal(GNU2026_ARTIFACT.byteLength, 102_296_280);
  assert.equal(GNU2026_ARTIFACT.sha256, 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3');
  assert.equal(GNU2026_ARTIFACT.url, PREFIX + GNU2026_ARTIFACT.name);
  assert.equal(Object.isFrozen(GNU2026_ARTIFACT), true);
  assert.equal(createArtifactDescriptor({ ...descriptor(), byteLength: MAX_ARTIFACT_BYTES }).byteLength, MAX_ARTIFACT_BYTES);
});

for (const [label, change] of [
  ['zero bytes', { byteLength: 0 }], ['oversize bytes', { byteLength: MAX_ARTIFACT_BYTES + 1 }],
  ['fraction bytes', { byteLength: 1.5 }], ['unsafe bytes', { byteLength: Number.MAX_SAFE_INTEGER + 1 }],
  ['uppercase hash', { sha256: 'A'.repeat(64) }], ['short hash', { sha256: 'a' }],
  ['wrong origin', { url: 'https://example.com/fixture.tar.xz' }],
  ['port', { url: PREFIX.replace('.com/', '.com:443/') + 'fixture.tar.xz' }],
  ['userinfo', { url: PREFIX.replace('https://', 'https://user@') + 'fixture.tar.xz' }],
  ['query', { url: PREFIX + 'fixture.tar.xz?x' }], ['fragment', { url: PREFIX + 'fixture.tar.xz#x' }],
  ['encoding', { name: 'f%69xture.tar.xz', url: PREFIX + 'f%69xture.tar.xz' }],
  ['normalization', { url: PREFIX + './fixture.tar.xz' }],
  ['path segment', { name: '../fixture.tar.xz', url: PREFIX + '../fixture.tar.xz' }],
  ['nonarchive', { name: 'fixture.bin', url: PREFIX + 'fixture.bin' }],
  ['long name', { name: 'a'.repeat(122) + '.tar.xz', url: PREFIX + 'a'.repeat(122) + '.tar.xz' }],
  ['extra field', { authorization: 'no' }],
]) {
  test(`descriptor rejects ${label}`, () => {
    assert.throws(() => createArtifactDescriptor({ ...descriptor(), ...change }), { code: 'E_INPUT' });
  });
}

test('descriptor rejects accessors, proxies, symbols and inherited custom prototypes without invocation', () => {
  let calls = 0;
  const getter = { ...descriptor(), get name() { calls++; throw Error('not invoked'); } };
  const proxy = new Proxy({}, { ownKeys() { calls++; throw Error('not invoked'); } });
  for (const value of [null, 1, getter, proxy, { ...descriptor(), [Symbol('extra')]: 1 },
    Object.assign(Object.create({ inherited: true }), descriptor())]) {
    assert.throws(() => createArtifactDescriptor(value), { code: 'E_INPUT' });
  }
  assert.equal(calls, 0);
});

test('invalid paths and descriptors cause no filesystem or request effects', async t => {
  const root = fixtures(t)(), net = transport(t);
  for (const value of ['relative', '/', root + '/', root + '/../other', root + '\0']) {
    await rejects(boundedSettlement(t, rawAcquireArtifact(value, descriptor())), 'E_INPUT');
  }
  await rejects(acquireArtifact(root, { ...descriptor(), extra: true }), 'E_INPUT');
  await rejects(boundedSettlement(t, rawAcquireGnu2026('relative')), 'E_INPUT');
  assert.equal(net.calls.length, 0);
  assert.equal(fs.existsSync(root), false);
});

test('positive acquisition hashes incoming and independent readback with all negative authority flags', async t => {
  const root = fixtures(t)(), net = transport(t), fds = trackFds(t);
  const result = await acquireArtifact(root, descriptor());
  t.mock.restoreAll();
  assert.deepEqual(fs.readFileSync(result.file), payload);
  assert.equal(fs.statSync(root).mode & 0o7777, 0o700);
  assert.equal(fs.statSync(result.file).mode & 0o7777, 0o600);
  assert.equal(result.profile, 'ordinary-archive-acquisition-v1');
  assert.equal(result.state, 'DATA_ONLY');
  assert.equal(result.contentMatched, true);
  for (const key of ['expectedSha256', 'incomingSha256', 'readbackSha256']) assert.equal(result[key], sha(payload));
  for (const key of ['nativeAuthority', 'nativeQualified', 'provenanceVerified', 'pythonFreeSubsetVerified',
    'installedUsability', 'rustReady', 'trainingReady', 'installationPerformed', 'immutabilityVerified']) {
    assert.equal(result[key], false);
  }
  assert.equal(Object.hasOwn(result, 'installed'), false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.counts), true);
  assert.deepEqual(fds.counts, { opens: 3, closes: 3, peak: 2 });
  assert.equal(fds.active.size, 0);
  assert.equal(result.counts.peakOwnedFds, 2);
  assert.equal(result.counts.closeAttempts, 3);
  assert.equal(result.counts.requestCalls, 1);
  assert.equal(result.counts.networkCalls, 2);
  assert.equal(result.counts.dataEvents, 1);
  for (const key of ['copiedBytes', 'writtenBytes', 'readBytes']) assert.equal(result.counts[key], payload.length);
  assert.ok(result.counts.clockReads <= MAX_CLOCK_READS);
  assert.ok(result.counts.fsCalls <= MAX_FS_CALLS);
  assert.ok(result.counts.lifecycleEvents <= MAX_LIFECYCLE_EVENTS);
  assert.equal(typeof result.rootDevice, 'string');
  assert.equal(typeof result.fileDevice, 'string');
  assert.deepEqual(net.calls, [{ url: descriptor().url, config: { method: 'GET', agent: false,
    rejectUnauthorized: true, insecureHTTPParser: false, maxHeaderSize: 16_384,
    headers: { 'Accept-Encoding': 'identity', Connection: 'close' } } }]);
  assert.equal(net.request.ends, 1);
  assert.equal(net.request.destroys + net.response.destroys, 0);
});

test('checked file birth and root binding precede GET and both closes precede reader', async t => {
  const root = fixtures(t)(), lstat = fs.lstatSync, open = fs.openSync;
  let births = 0, rootChecks = 0, checked = false;
  const net = transport(t, { onRequest() { assert.equal(checked, true); } });
  t.mock.method(fs, 'lstatSync', (...args) => {
    const stat = lstat(...args);
    if (args[0] === root) rootChecks++;
    else births++;
    checked = births === 1 && rootChecks === 2;
    return stat;
  });
  t.mock.method(fs, 'openSync', (name, flags, ...rest) => {
    if (name !== root && (flags & fs.constants.O_WRONLY) === 0) {
      assert.ok(net.ledger.includes('closeRequest'));
      assert.ok(net.ledger.includes('closeResponse'));
    }
    return open(name, flags, ...rest);
  });
  await acquireArtifact(root, descriptor());
});

test('one MiB multichunk fixture uses positional writes and bounded 64 KiB reads', async t => {
  const root = fixtures(t)(), bytes = Buffer.alloc(MAX_CHUNK_BYTES, 0x5a);
  transport(t, { bytes, chunks: [bytes.subarray(0, 600_000), bytes.subarray(600_000)] });
  const write = fs.writeSync, read = fs.readSync, positions = [], reads = [];
  t.mock.method(fs, 'writeSync', (...args) => { positions.push(args[4]); return write(...args); });
  t.mock.method(fs, 'readSync', (...args) => { assert.ok(args[3] <= 65_536); reads.push(args[4]); return read(...args); });
  const result = await acquireArtifact(root, descriptor(bytes));
  assert.deepEqual(positions, [0, 600_000]);
  assert.equal(reads.length, 17);
  assert.equal(reads.at(-1), bytes.length);
  assert.equal(result.readbackSha256, sha(bytes));
});

test('one MiB single chunk is admitted at its exact bound', async t => {
  const root = fixtures(t)(), bytes = Buffer.alloc(MAX_CHUNK_BYTES, 0x33);
  transport(t, { bytes });
  assert.equal((await acquireArtifact(root, descriptor(bytes))).counts.copiedBytes, MAX_CHUNK_BYTES);
});

for (const [label, options, code] of [
  ['redirect', { status: 302 }, 'E_HTTP'], ['partial status', { status: 206 }, 'E_HTTP'],
  ['missing length', { headers: [] }, 'E_HEADERS'],
  ['duplicate length', { headers: ['Content-Length', String(payload.length), 'content-length', String(payload.length)] }, 'E_HEADERS'],
  ['wrong length', { headers: ['Content-Length', '1'] }, 'E_HEADERS'],
  ['noncanonical length', { headers: ['Content-Length', '0' + payload.length] }, 'E_HEADERS'],
  ['transfer encoding', { headers: ['Content-Length', String(payload.length), 'Transfer-Encoding', ''] }, 'E_HEADERS'],
  ['content range', { headers: ['Content-Length', String(payload.length), 'Content-Range', ''] }, 'E_HEADERS'],
  ['gzip', { headers: ['Content-Length', String(payload.length), 'Content-Encoding', 'gzip'] }, 'E_HEADERS'],
  ['identity case', { headers: ['Content-Length', String(payload.length), 'Content-Encoding', 'Identity'] }, 'E_HEADERS'],
  ['duplicate encoding', { headers: ['Content-Length', String(payload.length), 'Content-Encoding', 'identity', 'content-encoding', 'identity'] }, 'E_HEADERS'],
  ['odd raw headers', { headers: ['Content-Length'] }, 'E_HEADERS'],
  ['nonarray headers', { headers: {} }, 'E_HEADERS'],
  ['nonstring value', { headers: ['Content-Length', payload.length] }, 'E_HEADERS'],
  ['invalid field name', { headers: ['Content-Length', String(payload.length), 'bad name', 'x'] }, 'E_HEADERS'],
  ['header newline', { headers: ['Content-Length', String(payload.length), 'X-Test', 'x\r\ny'] }, 'E_HEADERS'],
  ['nonlatin1 value', { headers: ['Content-Length', String(payload.length), 'X-Test', '\u0100'] }, 'E_HEADERS'],
  ['pair count sentinel', { headers: ['Content-Length', String(payload.length), ...Array.from({ length: 32 }, () => ['X', 'a']).flat()] }, 'E_HEADERS'],
  ['field byte budget', { headers: ['Content-Length', String(payload.length), 'X', 'a'.repeat(16_384)] }, 'E_HEADERS'],
]) {
  test(`reject ${label} before any body write and never open reader`, async t => {
    const root = fixtures(t)(), net = transport(t, options), fds = trackFds(t);
    let writes = 0;
    t.mock.method(fs, 'writeSync', () => { writes++; throw Error('no header-rejected writes'); });
    await rejects(acquireArtifact(root, descriptor()), code);
    assert.equal(writes, 0);
    assert.equal(net.calls.length, 1);
    assert.equal(net.request.destroys, 1);
    assert.equal(net.response.destroys, 1);
    assert.equal(fds.counts.opens, 2);
    assert.equal(fds.active.size, 0);
  });
}

test('identity encoding and exactly 32 header pairs pass', async t => {
  const root = fixtures(t)();
  transport(t, { headers: ['Content-Length', String(payload.length), 'Content-Encoding', 'identity',
    ...Array.from({ length: 30 }, () => ['X-Test', 'v']).flat()] });
  await acquireArtifact(root, descriptor());
});

test('raw header accessors are rejected without invoking getters', async t => {
  const root = fixtures(t)(), headers = ['Content-Length', String(payload.length)];
  let calls = 0;
  Object.defineProperty(headers, '1', { get() { calls++; throw Error('not invoked'); } });
  transport(t, { headers });
  await rejects(acquireArtifact(root, descriptor()), 'E_HEADERS');
  assert.equal(calls, 0);
});

for (const [label, chunk] of [['zero', Buffer.alloc(0)], ['typed array', new Uint8Array([1])],
  ['string', 'x'], ['oversize', Buffer.alloc(MAX_CHUNK_BYTES + 1)],
  ['shared backing', Buffer.from(new SharedArrayBuffer(1))]]) {
  test(`reject ${label} chunk before writing`, async t => {
    const root = fixtures(t)(), net = transport(t, { chunks: [chunk] });
    let writes = 0;
    t.mock.method(fs, 'writeSync', () => { writes++; return 0; });
    await rejects(acquireArtifact(root, descriptor()), 'E_CHUNK');
    assert.equal(writes, 0);
    assert.equal(net.request.destroys, 1);
    assert.equal(net.response.destroys, 1);
  });
}

test('native chunk getters ignore shadow length and backing properties', async t => {
  const root = fixtures(t)(), chunk = Buffer.from(payload);
  let calls = 0;
  for (const key of ['length', 'buffer']) Object.defineProperty(chunk, key, {
    get() { calls++; throw Error('shadow accessor'); },
  });
  transport(t, { chunks: [chunk] });
  await acquireArtifact(root, descriptor());
  assert.equal(calls, 0);
});

test('growing shadow length cannot admit oversized native buffer', async t => {
  const root = fixtures(t)(), chunk = Buffer.alloc(MAX_CHUNK_BYTES + 1);
  let calls = 0;
  Object.defineProperty(chunk, 'length', { get() { return ++calls === 1 ? 1 : MAX_CHUNK_BYTES + 1; } });
  transport(t, { chunks: [chunk] });
  await rejects(acquireArtifact(root, descriptor()), 'E_CHUNK');
  assert.equal(calls, 0);
});

test('body proxies are rejected without invoking prototype or property traps', async t => {
  const root = fixtures(t)();
  let calls = 0;
  const chunk = new Proxy(Buffer.from(payload), {
    getPrototypeOf() { calls++; throw Error('not invoked'); },
    get() { calls++; throw Error('not invoked'); },
  });
  transport(t, { chunks: [chunk] });
  await rejects(acquireArtifact(root, descriptor()), 'E_CHUNK');
  assert.equal(calls, 0);
});

test('private snapshot survives caller mutation during write callback', async t => {
  const root = fixtures(t)(), chunk = Buffer.from(payload), write = fs.writeSync;
  transport(t, { chunks: [chunk] });
  t.mock.method(fs, 'writeSync', (...args) => { chunk.fill(0); return write(...args); });
  const input = descriptor(), result = await acquireArtifact(root, input);
  assert.equal(result.incomingSha256, sha(payload));
  assert.deepEqual(fs.readFileSync(result.file), payload);
});

for (const [label, options, code] of [
  ['short body', { chunks: [payload.subarray(1)] }, 'E_LENGTH'],
  ['excess body', { chunks: [payload, Buffer.from('x')] }, 'E_LENGTH'],
  ['empty body', { chunks: [] }, 'E_LENGTH'],
  ['incomplete response', { complete: false }, 'E_NETWORK'],
  ['missing end with response close', { end: false }, 'E_NETWORK'],
]) {
  test(`${label} prevents reader acquisition`, async t => {
    const root = fixtures(t)();
    transport(t, options);
    const fds = trackFds(t);
    await rejects(acquireArtifact(root, descriptor()), code);
    assert.equal(fds.counts.opens, 2);
    assert.equal(fds.active.size, 0);
  });
}

test('incoming hash mismatch at end opens no reader', async t => {
  const root = fixtures(t)();
  transport(t);
  const fds = trackFds(t);
  await rejects(acquireArtifact(root, { ...descriptor(), sha256: '0'.repeat(64) }), 'E_HASH');
  assert.equal(fds.counts.opens, 2);
});

for (const side of ['request', 'response', 'abort']) {
  test(`${side} failure latches before late body/end/error events`, async t => {
    const root = fixtures(t)();
    const net = transport(t, { script(api) {
      api.respond();
      if (side === 'abort') api.response.emit('aborted');
      else api[side].emit('error', Error('network failure'));
      api.data(payload);
      api.end();
      api.request.emit('error', Error('late request error'));
      api.response.emit('error', Error('late response error'));
    } });
    let writes = 0;
    t.mock.method(fs, 'writeSync', () => { writes++; return 0; });
    await rejects(acquireArtifact(root, descriptor()), 'E_NETWORK');
    assert.equal(writes, 0);
    assert.equal(net.request.destroys, 1);
    assert.equal(net.response.destroys, 1);
    assert.doesNotThrow(() => { net.request.emit('error', Error('later')); net.response.emit('error', Error('later')); });
  });
}

for (const key of ['requestThrows', 'endThrows']) {
  test(`${key} closes owned FDs without a reader or retry`, async t => {
    const root = fixtures(t)(), net = transport(t, { [key]: true }), fds = trackFds(t);
    await rejects(acquireArtifact(root, descriptor()), 'E_NETWORK');
    assert.equal(net.calls.length, 1);
    assert.equal(fds.counts.opens, 2);
    assert.equal(fds.active.size, 0);
    assert.equal(net.request.destroys, key === 'endThrows' ? 1 : 0);
  });
}

test('late first response after failure is destroyed once with inert errors', async t => {
  const root = fixtures(t)();
  const net = transport(t, { script(api) {
    api.request.emit('error', Error('early'));
    api.respond();
    api.data(payload);
    api.end();
    api.response.emit('error', Error('late'));
  } });
  await rejects(acquireArtifact(root, descriptor()), 'E_NETWORK');
  assert.equal(net.request.destroys, 1);
  assert.equal(net.response.destroys, 1);
  assert.equal(fs.statSync(path.join(root, 'fixture.tar.xz')).size, 0);
});

for (const missing of ['closeRequest', 'closeResponse', 'end']) {
  test(`missing ${missing} cannot succeed and bounded cleanup settles`, async t => {
    const root = fixtures(t)(), advance = fakeClock(t);
    const net = transport(t, { [missing]: false,
      ...(missing === 'end' ? { closeResponse: false } : {}) });
    const promise = rawAcquireArtifact(root, descriptor());
    await Promise.resolve();
    let settled = false;
    const checked = rejects(promise, 'E_DEADLINE').then(() => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, false);
    advance(119_000);
    await boundedSettlement(t, checked);
    assert.equal(settled, true);
    assert.equal(net.request.destroys, 1);
    assert.equal(net.response.destroys, 1);
  });
}

test('unobserved network cleanup overrides initial failure and closes filesystem FDs', async t => {
  const root = fixtures(t)(), advance = fakeClock(t);
  transport(t, { status: 302, closeRequest: false, closeResponse: false,
    destroyRequestCloses: false, destroyResponseCloses: false });
  const fds = trackFds(t), promise = rawAcquireArtifact(root, descriptor());
  const checked = assert.rejects(promise, error => error.code === 'E_NETWORK_CLEANUP' && error.cause.code === 'E_HTTP');
  await Promise.resolve();
  advance(1000);
  await boundedSettlement(t, checked);
  assert.equal(fds.active.size, 0);
  assert.equal(fds.counts.closes, 2);
});

test('work deadline leaves exactly one second for missing network close cleanup', async t => {
  const root = fixtures(t)(), advance = fakeClock(t);
  transport(t, { end: false, closeRequest: false, closeResponse: false,
    destroyRequestCloses: false, destroyResponseCloses: false });
  const promise = rawAcquireArtifact(root, descriptor());
  let settled = false;
  const checked = assert.rejects(promise,
    error => error.code === 'E_NETWORK_CLEANUP' && error.cause.code === 'E_DEADLINE').then(() => { settled = true; });
  await Promise.resolve();
  advance(119_000);
  await Promise.resolve();
  assert.equal(settled, false);
  advance(1000);
  await boundedSettlement(t, checked);
  assert.equal(settled, true);
});

test('closes observed after the cleanup deadline cannot beat a delayed timer callback', async t => {
  const root = fixtures(t)();
  let time = 0n;
  fakeClock(t).sample(() => time);
  transport(t, { status: 302, onDestroyRequest() { time = 2_000_000_000n; } });
  const fds = trackFds(t);
  await assert.rejects(acquireArtifact(root, descriptor()),
    error => error.code === 'E_NETWORK_CLEANUP' && error.cause.code === 'E_HTTP');
  assert.equal(fds.active.size, 0);
});

for (const side of ['Request', 'Response']) {
  test(`destroy${side} uncertainty has network cleanup priority`, async t => {
    const root = fixtures(t)();
    transport(t, { status: 302, [`destroy${side}Throws`]: true });
    await assert.rejects(acquireArtifact(root, descriptor()),
      error => error.code === 'E_NETWORK_CLEANUP' && error.cause.code === 'E_HTTP');
  });
}

test('lifecycle event cap fails closed without subsequent writes', async t => {
  const root = fixtures(t)();
  const net = transport(t, { script(api) {
    api.respond();
    for (let index = 0; index <= MAX_LIFECYCLE_EVENTS; index++) api.closeRequest();
    api.data(payload);
    api.end();
  } });
  await rejects(acquireArtifact(root, descriptor()), 'E_LIMIT');
  assert.equal(net.request.destroys, 1);
  assert.equal(net.response.destroys, 1);
  assert.equal(fs.statSync(path.join(root, 'fixture.tar.xz')).size, 0);
});

test('exact data event ceiling succeeds with real small writes and bounded counters', async t => {
  const root = fixtures(t)(), bytes = Buffer.alloc(MAX_DATA_EVENTS, 0x61), one = Buffer.from('a');
  transport(t, { bytes, script(api) {
    api.respond();
    for (let index = 0; index < MAX_DATA_EVENTS; index++) api.data(one);
    api.end(); api.closeResponse(); api.closeRequest();
  } });
  const result = await acquireArtifact(root, descriptor(bytes));
  assert.equal(result.counts.dataEvents, MAX_DATA_EVENTS);
  assert.ok(result.counts.clockReads <= MAX_CLOCK_READS);
  assert.ok(result.counts.fsCalls <= MAX_FS_CALLS);
});

test('one extra data event fails before copy/write despite remaining descriptor bytes', async t => {
  const root = fixtures(t)(), bytes = Buffer.alloc(MAX_DATA_EVENTS + 1, 0x61), one = Buffer.from('a');
  transport(t, { bytes, script(api) {
    api.respond();
    for (let index = 0; index <= MAX_DATA_EVENTS; index++) api.data(one);
    api.end(); api.closeResponse(); api.closeRequest();
  } });
  await rejects(acquireArtifact(root, descriptor(bytes)), 'E_LIMIT');
  assert.equal(fs.statSync(path.join(root, 'fixture.tar.xz')).size, MAX_DATA_EVENTS);
});

test('existing root collision is neither inspected nor repaired', async t => {
  const root = fixtures(t)(), net = transport(t);
  fs.mkdirSync(root, { mode: 0o700 });
  t.mock.method(fs, 'lstatSync', () => { throw Error('no collision inspection'); });
  await rejects(acquireArtifact(root, descriptor()), 'E_IO');
  assert.equal(net.calls.length, 0);
});

for (const phase of [1, 2, 3, 4]) {
  test(`file named/FD binding mismatch at phase ${phase} rejects`, async t => {
    const root = fixtures(t)(), target = path.join(root, 'fixture.tar.xz'), lstat = fs.lstatSync;
    const net = transport(t);
    let checks = 0;
    t.mock.method(fs, 'lstatSync', (...args) => {
      const stat = lstat(...args);
      return args[0] === target && ++checks === phase ? { ...stat, ino: stat.ino + 1n } : stat;
    });
    await rejects(acquireArtifact(root, descriptor()), 'E_BINDING');
    if (phase === 1) assert.equal(net.calls.length, 0);
  });
}

for (const phase of [2, 3, 4]) {
  test(`root binding phase ${phase} rejects without new authority`, async t => {
    const root = fixtures(t)(), lstat = fs.lstatSync, net = transport(t);
    let checks = 0;
    t.mock.method(fs, 'lstatSync', (...args) => {
      const stat = lstat(...args);
      return args[0] === root && ++checks === phase ? { ...stat, ino: stat.ino + 1n } : stat;
    });
    await rejects(acquireArtifact(root, descriptor()), 'E_BINDING');
    if (phase === 2) assert.equal(net.calls.length, 0);
  });
}

for (const [key, value, code] of [['uid', 4_294_967_295n, 'E_FILE'], ['mode', 0o100644n, 'E_FILE'],
  ['nlink', 2n, 'E_FILE'], ['dev', -1n, 'E_METADATA'], ['ino', 3, 'E_METADATA']]) {
  test(`invalid writer birth ${key} blocks GET`, async t => {
    const root = fixtures(t)(), fstat = fs.fstatSync, net = transport(t);
    let calls = 0;
    t.mock.method(fs, 'fstatSync', (...args) => {
      const stat = fstat(...args);
      return ++calls === 2 ? { ...stat, [key]: value } : stat;
    });
    await rejects(acquireArtifact(root, descriptor()), code);
    assert.equal(net.calls.length, 0);
  });
}

test('independent device metadata is accepted without directory-file equality', async t => {
  const root = fixtures(t)(), fstat = fs.fstatSync, lstat = fs.lstatSync;
  transport(t);
  const alter = stat => ({ ...stat, dev: (stat.mode & 0o170000n) === 0o040000n ? 28n : 29n });
  t.mock.method(fs, 'fstatSync', (...args) => alter(fstat(...args)));
  t.mock.method(fs, 'lstatSync', (...args) => alter(lstat(...args)));
  const result = await acquireArtifact(root, descriptor());
  assert.equal(result.rootDevice, '28');
  assert.equal(result.fileDevice, '29');
});

test('root size and timestamps do not enter directory binding equality', async t => {
  const root = fixtures(t)(), lstat = fs.lstatSync;
  transport(t);
  t.mock.method(fs, 'lstatSync', (...args) => {
    const stat = lstat(...args);
    return args[0] === root ? { ...stat, size: stat.size + 1n, mtimeNs: 77n, ctimeNs: 88n } : stat;
  });
  await acquireArtifact(root, descriptor());
});

for (const [label, readChange, code] of [
  ['short read', (read, args) => read(...args.slice(0, 3), args[3] - 1, args[4]), 'E_IO'],
  ['corrupt readback', (read, args) => { const count = read(...args); if (count) args[1][0] ^= 1; return count; }, 'E_HASH'],
  ['unexpected EOF byte', (read, args) => args[4] === payload.length ? 1 : read(...args), 'E_LENGTH'],
]) {
  test(`${label} prevents independent readback success`, async t => {
    const root = fixtures(t)(), read = fs.readSync;
    transport(t);
    let reads = 0;
    t.mock.method(fs, 'readSync', (...args) => { reads++; return readChange(read, args); });
    await rejects(acquireArtifact(root, descriptor()), code);
    if (label === 'short read') assert.equal(reads, 1);
  });
}

for (const [label, action, code] of [
  ['short', (write, args) => write(...args.slice(0, 3), args[3] - 1, args[4]), 'E_IO'],
  ['zero', () => 0, 'E_IO'], ['thrown', () => { throw Error('write failure'); }, 'E_IO'],
]) {
  test(`${label} write is never retried and opens no reader`, async t => {
    const root = fixtures(t)(), write = fs.writeSync;
    transport(t);
    const fds = trackFds(t);
    let writes = 0;
    t.mock.method(fs, 'writeSync', (...args) => { writes++; return action(write, args); });
    await rejects(acquireArtifact(root, descriptor()), code);
    assert.equal(writes, 1);
    assert.equal(fds.counts.opens, 2);
    assert.equal(fds.active.size, 0);
  });
}

for (const at of [1, 2, 3]) {
  test(`uncertain close ${at} consumes holder once and closes other owners`, async t => {
    const root = fixtures(t)();
    transport(t);
    const fds = trackFds(t, { afterClose(count) {
      if (count === at) throw Error('closed then uncertain');
    } });
    await rejects(acquireArtifact(root, descriptor()), 'E_CLOSE');
    assert.equal(fds.counts.opens, at === 1 ? 2 : 3);
    assert.equal(fds.counts.closes, at === 1 ? 2 : 3);
    assert.equal(fds.active.size, 0);
  });
}

test('E_CLOSE outranks E_NETWORK_CLEANUP while preserving the operational cause chain', async t => {
  const root = fixtures(t)(), advance = fakeClock(t), close = fs.closeSync;
  transport(t, { status: 302, closeRequest: false, closeResponse: false,
    destroyRequestCloses: false, destroyResponseCloses: false });
  let closes = 0;
  t.mock.method(fs, 'closeSync', fd => { close(fd); if (++closes === 1) throw Error('uncertain'); });
  const checked = assert.rejects(rawAcquireArtifact(root, descriptor()), error =>
    error.code === 'E_CLOSE' && error.cause.code === 'E_NETWORK_CLEANUP' && error.cause.cause.code === 'E_HTTP');
  await Promise.resolve();
  advance(1000);
  await boundedSettlement(t, checked);
  assert.equal(closes, 2);
});

for (const at of [1, 2, 3]) {
  test(`post-open deadline ${at} still closes every acquired FD without another acquisition`, async t => {
    const root = fixtures(t)(), advance = fakeClock(t);
    transport(t);
    const fds = trackFds(t, { afterOpen(count) {
      if (count === at) advance(119_000);
    } });
    await rejects(acquireArtifact(root, descriptor()), 'E_DEADLINE');
    assert.equal(fds.counts.opens, at);
    assert.equal(fds.counts.closes, at);
    assert.equal(fds.active.size, 0);
  });
}

test('post-request deadline still attaches error/close handlers and never calls end', async t => {
  const root = fixtures(t)(), advance = fakeClock(t);
  const net = transport(t, { onRequest() { advance(119_000); } });
  const fds = trackFds(t);
  await rejects(acquireArtifact(root, descriptor()), 'E_DEADLINE');
  assert.equal(net.request.ends, 0);
  assert.equal(net.request.destroys, 1);
  assert.equal(fds.active.size, 0);
  assert.doesNotThrow(() => net.request.emit('error', Error('late')));
});

test('final close crossing total deadline cannot return a DATA_ONLY result', async t => {
  const root = fixtures(t)(), advance = fakeClock(t), close = fs.closeSync;
  transport(t);
  let closes = 0;
  t.mock.method(fs, 'closeSync', fd => { close(fd); if (++closes === 3) advance(120_000); });
  await rejects(acquireArtifact(root, descriptor()), 'E_DEADLINE');
  assert.equal(closes, 3);
});

test('single effective UID capture rejects invalid platform identity before mkdir', async t => {
  const root = fixtures(t)(), net = transport(t);
  let calls = 0;
  t.mock.method(process, 'geteuid', () => { calls++; return -1; });
  await rejects(acquireArtifact(root, descriptor()), 'E_PLATFORM');
  assert.equal(calls, 1);
  assert.equal(net.calls.length, 0);
  assert.equal(fs.existsSync(root), false);
});

test('descriptor snapshot cannot change during mocked request acquisition', async t => {
  const root = fixtures(t)(), input = descriptor();
  transport(t, { onRequest() { input.byteLength = 1; input.sha256 = '0'.repeat(64); input.name = 'other.tar.xz'; } });
  const result = await acquireArtifact(root, input);
  assert.equal(result.byteLength, payload.length);
  assert.equal(result.expectedSha256, sha(payload));
  assert.equal(result.file, path.join(root, 'fixture.tar.xz'));
});

test('recheck response completeness at the final network closure gate', async t => {
  const root = fixtures(t)();
  transport(t, { script(api) {
    api.respond(); api.data(payload); api.end();
    api.response.complete = false;
    api.closeResponse(); api.closeRequest();
  } });
  const fds = trackFds(t);
  await rejects(acquireArtifact(root, descriptor()), 'E_NETWORK');
  assert.equal(fds.counts.opens, 2);
});

test('duplicate response event fails without retry or a second destroy of the owned response', async t => {
  const root = fixtures(t)();
  const net = transport(t, { script(api) {
    api.respond(); api.respond(); api.data(payload); api.end();
  } });
  await rejects(acquireArtifact(root, descriptor()), 'E_NETWORK');
  assert.equal(net.request.destroys, 1);
  assert.equal(net.response.destroys, 1);
});

test('open flags enforce exclusive writer creation and nofollow nonblocking readers', async t => {
  const root = fixtures(t)(), open = fs.openSync, seen = [];
  transport(t);
  t.mock.method(fs, 'openSync', (...args) => { seen.push(args); return open(...args); });
  await acquireArtifact(root, descriptor());
  assert.equal(seen.length, 3);
  const c = fs.constants;
  assert.equal(seen[0][1], c.O_RDONLY | c.O_DIRECTORY | c.O_NOFOLLOW | c.O_NONBLOCK);
  assert.equal(seen[1][1], c.O_WRONLY | c.O_CREAT | c.O_EXCL | c.O_NOFOLLOW | c.O_NONBLOCK);
  assert.equal(seen[1][2], 0o600);
  assert.equal(seen[2][1], c.O_RDONLY | c.O_NOFOLLOW | c.O_NONBLOCK);
});

test('writer open failure closes the root before any request', async t => {
  const root = fixtures(t)(), open = fs.openSync, close = fs.closeSync, net = transport(t);
  let opens = 0, closes = 0;
  t.mock.method(fs, 'openSync', (...args) => {
    if (++opens === 2) throw Error('writer open failed');
    return open(...args);
  });
  t.mock.method(fs, 'closeSync', fd => { closes++; return close(fd); });
  await rejects(acquireArtifact(root, descriptor()), 'E_IO');
  assert.equal(opens, 2);
  assert.equal(closes, 1);
  assert.equal(net.calls.length, 0);
});

for (const key of ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink']) {
  test(`writer birth-to-written ${key} mismatch rejects even when named and FD agree`, async t => {
    const root = fixtures(t)(), fstat = fs.fstatSync, lstat = fs.lstatSync;
    transport(t);
    let fileStats = 0, changed = false;
    function alter(stat) {
      return changed && (stat.mode & 0o170000n) === 0o100000n ? { ...stat, [key]: stat[key] + 1n } : stat;
    }
    t.mock.method(fs, 'fstatSync', (...args) => {
      const stat = fstat(...args);
      if ((stat.mode & 0o170000n) === 0o100000n && ++fileStats === 2) changed = true;
      return alter(stat);
    });
    t.mock.method(fs, 'lstatSync', (...args) => alter(lstat(...args)));
    const code = ['mode', 'uid', 'nlink'].includes(key) ? 'E_FILE' : 'E_BINDING';
    await rejects(acquireArtifact(root, descriptor()), code);
  });
}

for (const key of ['dev', 'ino', 'gid', 'mtimeNs', 'ctimeNs']) {
  test(`written-to-reader ${key} mismatch rejects matching named/FD metadata`, async t => {
    const root = fixtures(t)(), fstat = fs.fstatSync, lstat = fs.lstatSync;
    transport(t);
    let fileStats = 0, changed = false;
    const alter = stat => changed && (stat.mode & 0o170000n) === 0o100000n ? { ...stat, [key]: stat[key] + 1n } : stat;
    t.mock.method(fs, 'fstatSync', (...args) => {
      const stat = fstat(...args);
      if ((stat.mode & 0o170000n) === 0o100000n && ++fileStats === 3) changed = true;
      return alter(stat);
    });
    t.mock.method(fs, 'lstatSync', (...args) => alter(lstat(...args)));
    await rejects(acquireArtifact(root, descriptor()), 'E_BINDING');
  });
}

test('reader-after timestamp change rejects otherwise matching named/FD snapshots', async t => {
  const root = fixtures(t)(), fstat = fs.fstatSync, lstat = fs.lstatSync;
  transport(t);
  let fileStats = 0, changed = false;
  const alter = stat => changed && (stat.mode & 0o170000n) === 0o100000n ? { ...stat, mtimeNs: stat.mtimeNs + 1n } : stat;
  t.mock.method(fs, 'fstatSync', (...args) => {
    const stat = fstat(...args);
    if ((stat.mode & 0o170000n) === 0o100000n && ++fileStats === 4) changed = true;
    return alter(stat);
  });
  t.mock.method(fs, 'lstatSync', (...args) => alter(lstat(...args)));
  await rejects(acquireArtifact(root, descriptor()), 'E_BINDING');
});

test('root birth comparison rejects mutually matching replacement metadata before GET', async t => {
  const root = fixtures(t)(), fstat = fs.fstatSync, lstat = fs.lstatSync, net = transport(t);
  let rootStats = 0, changed = false;
  const alter = stat => changed && (stat.mode & 0o170000n) === 0o040000n ? { ...stat, ino: stat.ino + 1n } : stat;
  t.mock.method(fs, 'fstatSync', (...args) => {
    const stat = fstat(...args);
    if ((stat.mode & 0o170000n) === 0o040000n && ++rootStats === 2) changed = true;
    return alter(stat);
  });
  t.mock.method(fs, 'lstatSync', (...args) => alter(lstat(...args)));
  await rejects(acquireArtifact(root, descriptor()), 'E_BINDING');
  assert.equal(net.calls.length, 0);
});

test('actual owned-file replacement before reader acquisition fails the metadata gate', async t => {
  const root = fixtures(t)(), target = path.join(root, 'fixture.tar.xz');
  const open = fs.openSync, write = fs.writeSync, close = fs.closeSync;
  transport(t);
  t.mock.method(fs, 'openSync', (name, flags, ...rest) => {
    if (name === target && (flags & fs.constants.O_WRONLY) === 0) {
      fs.unlinkSync(target);
      const fd = open(target, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
      try { write(fd, payload, 0, payload.length, 0); } finally { close(fd); }
    }
    return open(name, flags, ...rest);
  });
  await rejects(acquireArtifact(root, descriptor()), 'E_BINDING');
});

test('reader refuses an owned replacement symlink without following it', async t => {
  const root = fixtures(t)(), target = path.join(root, 'fixture.tar.xz'), open = fs.openSync;
  transport(t);
  t.mock.method(fs, 'openSync', (name, flags, ...rest) => {
    if (name === target && (flags & fs.constants.O_WRONLY) === 0) {
      fs.unlinkSync(target);
      fs.symlinkSync(root, target);
    }
    return open(name, flags, ...rest);
  });
  await rejects(acquireArtifact(root, descriptor()), 'E_IO');
  assert.equal(fs.lstatSync(target).isSymbolicLink(), true);
});

test('monotonic clock regression stops work without creating a root', async t => {
  const root = fixtures(t)(), net = transport(t);
  let calls = 0;
  fakeClock(t).sample(() => ++calls === 1 ? 2n : 1n);
  await rejects(acquireArtifact(root, descriptor()), 'E_PLATFORM');
  assert.equal(net.calls.length, 0);
  assert.equal(fs.existsSync(root), false);
});

test('default settlement driver fails unexpected pending acquisition after fake work and cleanup deadlines', async t => {
  const root = fixtures(t)(), advance = fakeClock(t);
  const net = transport(t, { end: false, closeRequest: false, closeResponse: false,
    destroyRequestCloses: false, destroyResponseCloses: false });
  const fds = trackFds(t);
  await assert.rejects(acquireArtifact(root, descriptor()), error => error.code === 'ERR_ASSERTION' &&
    error.message.includes('required a forced fake deadline'));
  assert.equal(advance.elapsed(), 120_000_000_000n);
  assert.equal(net.request.destroys, 1);
  assert.equal(net.response.destroys, 1);
  assert.equal(fds.active.size, 0);
  assert.deepEqual(fds.counts, { opens: 2, closes: 2, peak: 2 });
});

test('all real fixture writes stay inside the aggregate eight MiB allowance', t => {
  assert.ok(fixtureWrites > 2_097_152);
  assert.ok(fixtureWrites <= 8_388_608);
  t.diagnostic('production SHA-256: ' + sha(fs.readFileSync(new URL('acquisition.mjs', import.meta.url))));
});
