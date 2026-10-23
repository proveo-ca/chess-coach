// SPEC: _spec/tooling/native-ingress/custody.puml
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { CustodyError, MAX_FIXTURE_BYTES, MAX_CHUNKS, MAX_CHUNK_BYTES, stageFixtureChunks } from './custody.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const payload = Buffer.from('offline chunks');
const descriptor = (bytes = payload) => ({ name: 'fixture.bin', byteLength: bytes.length, sha256: sha(bytes) });
const rejects = (action, code) => assert.throws(action,
  error => error instanceof CustodyError && error.code === code);

function fixtures(t) {
  const parent = fs.mkdtempSync('/tmp/opencode/f9-chunks-test-'), roots = [];
  t.after(() => {
    t.mock.restoreAll();
    for (const root of roots.reverse()) {
      try { fs.unlinkSync(path.join(root, 'fixture.bin')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      try { fs.rmdirSync(root); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    fs.rmdirSync(parent);
  });
  return () => {
    const root = path.join(parent, `case-${roots.length}`); roots.push(root); return root;
  };
}

function producer(next, finish = () => ({ done: true })) {
  const state = { pulls: 0, returns: 0, acquisitions: 0 };
  const iterator = {
    next() { assert.equal(this, iterator); state.pulls++; return next(state.pulls); },
    return() { assert.equal(this, iterator); state.returns++; return finish(); },
  };
  const chunks = { [Symbol.iterator]() { assert.equal(this, chunks); state.acquisitions++; return iterator; } };
  return { state, iterator, chunks };
}

function trackFds(t) {
  const open = fs.openSync, close = fs.closeSync, active = new Set();
  const counts = { opens: 0, closes: 0, peak: 0 };
  t.mock.method(fs, 'openSync', (...args) => {
    const fd = open(...args); active.add(fd); counts.opens++; counts.peak = Math.max(counts.peak, active.size); return fd;
  });
  t.mock.method(fs, 'closeSync', fd => {
    assert.equal(active.delete(fd), true); counts.closes++; return close(fd);
  });
  return { active, counts };
}

test('validate descriptor and root before acquiring a producer or creating paths', t => {
  const root = fixtures(t)(); let acquired = 0;
  const chunks = { [Symbol.iterator]() { acquired++; throw Error('not called'); } };
  rejects(() => stageFixtureChunks(root, { ...descriptor(), url: 'https://example.com' }, chunks), 'E_INPUT');
  rejects(() => stageFixtureChunks('relative', descriptor(), chunks), 'E_INPUT');
  assert.equal(acquired, 0); assert.equal(fs.existsSync(root), false);
});

test('incrementally write each private snapshot before requesting the next chunk', t => {
  const root = fixtures(t)(), request = descriptor(), first = Buffer.from('offline '), last = Buffer.from('chunks');
  const write = fs.writeSync, positions = [];
  t.mock.method(fs, 'writeSync', (...args) => { positions.push(args[4]); return write(...args); });
  const source = producer(pull => {
    if (pull === 1) { request.byteLength = 1; request.sha256 = '0'.repeat(64); return { done: false, value: first }; }
    if (pull === 2) { assert.deepEqual(positions, [0]); first.fill(0); return { done: false, value: last }; }
    assert.deepEqual(positions, [0, 8]); last.fill(0); return { done: true };
  });
  const result = stageFixtureChunks(root, request, source.chunks);
  t.mock.restoreAll();
  assert.deepEqual(fs.readFileSync(result.file), payload);
  assert.equal(result.state, 'DATA_ONLY'); assert.equal(result.nativeAuthority, false);
  assert.equal(result.installed, false); assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(source.state, { pulls: 3, returns: 0, acquisitions: 1 });
  t.diagnostic(`observed devices: directory=${result.rootDevice}, file=${result.fileDevice}`);
});

test('maximum lazy fixture bounds chunks, pulls, reads, writes and owned FDs', t => {
  const root = fixtures(t)(), bytes = Buffer.alloc(MAX_FIXTURE_BYTES, 0x5a), chunk = Buffer.alloc(MAX_CHUNK_BYTES, 0x5a);
  const fd = trackFds(t), read = fs.readSync, write = fs.writeSync;
  let reads = 0, writes = 0;
  t.mock.method(fs, 'readSync', (...args) => { reads++; return read(...args); });
  t.mock.method(fs, 'writeSync', (...args) => {
    assert.equal(args[4], writes * MAX_CHUNK_BYTES); writes++; return write(...args);
  });
  const source = producer(pull => pull <= MAX_CHUNKS ? { done: false, value: chunk } : { done: true });
  stageFixtureChunks(root, descriptor(bytes), source.chunks);
  assert.deepEqual(source.state, { pulls: 17, returns: 0, acquisitions: 1 });
  assert.deepEqual(fd.counts, { opens: 3, closes: 3, peak: 2 }); assert.equal(fd.active.size, 0);
  assert.deepEqual({ reads, writes }, { reads: 17, writes: 16 });
});

test('native chunk size and backing checks ignore shadowed properties', t => {
  const next = fixtures(t), bytes = Buffer.from(payload); let getters = 0;
  for (const key of ['length', 'buffer']) Object.defineProperty(bytes, key, { get() { getters++; throw Error('shadow'); } });
  stageFixtureChunks(next(), descriptor(), [bytes]);
  assert.equal(getters, 0);
  const big = Buffer.alloc(MAX_CHUNK_BYTES + 1);
  Object.defineProperty(big, 'length', { get: () => 1 });
  rejects(() => stageFixtureChunks(next(), descriptor(), [big]), 'E_CHUNK');
});

for (const [label, value] of [['empty', Buffer.alloc(0)], ['typed array', new Uint8Array([1])],
  ['string', 'bytes'], ['oversized', Buffer.alloc(MAX_CHUNK_BYTES + 1)],
  ['shared backing', Buffer.from(new SharedArrayBuffer(1))]]) {
  test(`reject ${label} chunk before writing it and clean producer after FD closes`, t => {
    const root = fixtures(t)(), fd = trackFds(t), write = fs.writeSync; let writes = 0;
    t.mock.method(fs, 'writeSync', (...args) => { writes++; return write(...args); });
    const source = producer(() => ({ done: false, value }), () => {
      assert.equal(fd.active.size, 0); return { done: true };
    });
    rejects(() => stageFixtureChunks(root, descriptor(), source.chunks), 'E_CHUNK');
    assert.equal(writes, 0); assert.equal(source.state.returns, 1);
  });
}

test('reject excess total before writing the excess chunk', t => {
  const root = fixtures(t)(), source = producer(() => ({ done: false, value: payload }));
  rejects(() => stageFixtureChunks(root, descriptor(), source.chunks), 'E_LENGTH');
  assert.deepEqual(source.state, { pulls: 2, returns: 1, acquisitions: 1 });
  t.mock.restoreAll(); assert.deepEqual(fs.readFileSync(path.join(root, 'fixture.bin')), payload);
});

test('endlessly yielding producer stops within seventeen pulls and gets one cleanup', t => {
  const root = fixtures(t)(), source = producer(() => ({ done: false, value: Buffer.alloc(1) }));
  rejects(() => stageFixtureChunks(root, { ...descriptor(), byteLength: 32 }, source.chunks), 'E_LIMIT');
  assert.deepEqual(source.state, { pulls: 17, returns: 1, acquisitions: 1 });
});

test('terminal completion is required, including when exact bytes already arrived', t => {
  const next = fixtures(t);
  for (const withBytes of [false, true]) {
    const source = producer(pull => withBytes && pull === 1 ? { done: false, value: payload } : { done: true });
    if (withBytes) stageFixtureChunks(next(), descriptor(), source.chunks);
    else rejects(() => stageFixtureChunks(next(), descriptor(), source.chunks), 'E_LENGTH');
    assert.equal(source.state.returns, 0);
  }
  const source = producer(pull => { if (pull === 1) return { done: false, value: payload }; throw Error('no terminal'); });
  rejects(() => stageFixtureChunks(next(), descriptor(), source.chunks), 'E_SOURCE');
  assert.equal(source.state.returns, 1);
});

test('incoming hash failure retains bytes but never opens a reader or cleans a completed source', t => {
  const root = fixtures(t)(), fd = trackFds(t);
  const source = producer(pull => pull === 1 ? { done: false, value: payload } : { done: true });
  rejects(() => stageFixtureChunks(root, { ...descriptor(), sha256: '0'.repeat(64) }, source.chunks), 'E_HASH');
  assert.equal(fd.counts.opens, 2); assert.equal(fd.active.size, 0); assert.equal(source.state.returns, 0);
});

test('acquire iterator and methods once with the original receiver', t => {
  const root = fixtures(t)(); let methods = 0, pulls = 0;
  const iterator = {
    get return() { methods++; return () => { throw Error('completed'); }; },
    get next() { methods++; return function() {
      assert.equal(this, iterator); return ++pulls === 1 ? { done: false, value: payload } : { done: true };
    }; },
  };
  const chunks = { get [Symbol.iterator]() { methods++; return () => iterator; } };
  stageFixtureChunks(root, descriptor(), chunks); assert.equal(methods, 3);
});

test('acquisition failure after capturing return still calls cleanup without creating a root', t => {
  const root = fixtures(t)(); let returns = 0, nextReads = 0, returnReads = 0;
  const iterator = {
    get return() { returnReads++; return function() { assert.equal(this, iterator); returns++; return { done: true }; }; },
    get next() { nextReads++; throw Error('next getter'); },
  };
  rejects(() => stageFixtureChunks(root, descriptor(), { [Symbol.iterator]: () => iterator }), 'E_SOURCE');
  assert.deepEqual({ returns, nextReads, returnReads }, { returns: 1, nextReads: 1, returnReads: 1 });
  assert.equal(fs.existsSync(root), false);
});

test('invalid acquisition methods fail without re-reading or inventing cleanup callbacks', t => {
  const next = fixtures(t); let reads = 0;
  for (const chunks of [null, {}, { [Symbol.iterator]: 1 }, { [Symbol.iterator]: () => null },
    { [Symbol.iterator]: () => ({ return: 1, next() {} }) },
    { [Symbol.iterator]: () => ({ get return() { reads++; throw Error('getter'); } }) },
    { get [Symbol.iterator]() { throw Error('getter'); } }]) {
    const root = next(); rejects(() => stageFixtureChunks(root, descriptor(), chunks), 'E_SOURCE');
    assert.equal(fs.existsSync(root), false);
  }
  assert.equal(reads, 1);
});

for (const [label, result] of [['null', null], ['primitive', 1], ['missing done', {}],
  ['coerced done', { done: 1 }], ['missing value', { done: false }],
  ['inherited done', Object.create({ done: true })],
  ['done accessor', { get done() { throw Error('not invoked'); } }],
  ['value accessor', { done: false, get value() { throw Error('not invoked'); } }],
  ['proxy', new Proxy({}, { getOwnPropertyDescriptor() { throw Error('not invoked'); } })]]) {
  test(`reject ${label} iterator result and clean once`, t => {
    const root = fixtures(t)(), source = producer(() => result);
    rejects(() => stageFixtureChunks(root, descriptor(), source.chunks), 'E_SOURCE');
    assert.equal(source.state.pulls, 1); assert.equal(source.state.returns, 1);
  });
}

test('short later write stops without another pull, retry or readback', t => {
  const root = fixtures(t)(), write = fs.writeSync; let writes = 0, reads = 0;
  const source = producer(() => ({ done: false, value: Buffer.from('a') }));
  t.mock.method(fs, 'writeSync', (...args) => { if (++writes === 2) return 0; return write(...args); });
  t.mock.method(fs, 'readSync', () => { reads++; throw Error('no readback'); });
  rejects(() => stageFixtureChunks(root, { ...descriptor(), byteLength: 3 }, source.chunks), 'E_IO');
  assert.equal(writes, 2); assert.equal(reads, 0); assert.equal(source.state.pulls, 2); assert.equal(source.state.returns, 1);
});

test('readback remains an independent digest after incoming content matched', t => {
  const root = fixtures(t)(), read = fs.readSync;
  t.mock.method(fs, 'readSync', (...args) => {
    const count = read(...args); if (count) args[1][0] ^= 1; return count;
  });
  rejects(() => stageFixtureChunks(root, descriptor(), [payload]), 'E_HASH');
});

test('same-size name replacement before streaming readback rejects the candidate', t => {
  const root = fixtures(t)(), target = path.join(root, 'fixture.bin'), lstat = fs.lstatSync; let checks = 0;
  t.mock.method(fs, 'lstatSync', (...args) => {
    const stat = lstat(...args);
    return args[0] === target && ++checks === 3 ? { ...stat, ino: stat.ino + 1n } : stat;
  });
  rejects(() => stageFixtureChunks(root, descriptor(), [payload]), 'E_BINDING');
});

test('producer failure without return still closes every custody descriptor', t => {
  const root = fixtures(t)(), fd = trackFds(t);
  rejects(() => stageFixtureChunks(root, descriptor(), {
    [Symbol.iterator]: () => ({ next() { throw Error('producer'); } }),
  }), 'E_SOURCE');
  assert.deepEqual(fd.counts, { opens: 2, closes: 2, peak: 2 }); assert.equal(fd.active.size, 0);
});

for (const [label, finish] of [['throw', () => { throw Error('cleanup'); }],
  ['nonterminal', () => ({ done: false })], ['primitive', () => 1],
  ['accessor', () => ({ get done() { throw Error('getter'); } })],
  ['proxy', () => new Proxy({}, {})]]) {
  test(`cleanup ${label} takes precedence over the original failure`, t => {
    const root = fixtures(t)(), source = producer(() => { throw Error('producer'); }, finish);
    assert.throws(() => stageFixtureChunks(root, descriptor(), source.chunks), error =>
      error.code === 'E_SOURCE_CLEANUP' && error.cause.code === 'E_SOURCE');
    assert.equal(source.state.returns, 1);
  });
}

test('close uncertainty retains priority while cleanup still runs after close attempts', t => {
  const root = fixtures(t)(), close = fs.closeSync, open = fs.openSync; let opens = 0, closes = 0;
  const source = producer(() => { throw Error('producer'); }, () => {
    assert.equal(closes, 2); assert.equal(opens, 2); throw Error('cleanup');
  });
  t.mock.method(fs, 'openSync', (...args) => { opens++; return open(...args); });
  t.mock.method(fs, 'closeSync', fd => { close(fd); if (++closes === 1) throw Error('close'); });
  assert.throws(() => stageFixtureChunks(root, descriptor(), source.chunks), error =>
    error.code === 'E_CLOSE' && error.cause.code === 'E_SOURCE_CLEANUP' && error.cause.cause.code === 'E_CLOSE');
  assert.equal(source.state.returns, 1); assert.equal(opens, 2); assert.equal(closes, 2);
});

test('deadline after iterator acquisition still calls captured return without filesystem effects', t => {
  const root = fixtures(t)(); let time = 0n;
  t.mock.method(process.hrtime, 'bigint', () => time);
  const source = producer(() => { throw Error('no next'); });
  const chunks = { [Symbol.iterator]() { time = 4_000_000_000n; return source.iterator; } };
  rejects(() => stageFixtureChunks(root, descriptor(), chunks), 'E_DEADLINE');
  assert.equal(source.state.returns, 1); assert.equal(fs.existsSync(root), false);
});

test('deadline inside next closes FDs before unconditional cleanup even beyond the deadline', t => {
  const root = fixtures(t)(), fd = trackFds(t); let time = 0n;
  t.mock.method(process.hrtime, 'bigint', () => time);
  const source = producer(() => { time = 4_000_000_000n; return { done: false, value: payload }; }, () => {
    assert.equal(fd.active.size, 0); time += 1_000_000_000n; return { done: true, get value() { throw Error('ignored'); } };
  });
  rejects(() => stageFixtureChunks(root, descriptor(), source.chunks), 'E_DEADLINE');
  assert.equal(source.state.returns, 1); assert.equal(fd.active.size, 0);
});

test('valid terminal result suppresses return even when its post-call deadline check fails', t => {
  const root = fixtures(t)(); let time = 0n;
  t.mock.method(process.hrtime, 'bigint', () => time);
  const source = producer(() => { time = 4_000_000_000n; return { done: true }; });
  rejects(() => stageFixtureChunks(root, descriptor(), source.chunks), 'E_DEADLINE');
  assert.equal(source.state.returns, 0);
});
