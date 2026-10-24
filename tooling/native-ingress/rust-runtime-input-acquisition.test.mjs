// SPEC: _spec/tooling/native-ingress/rust-runtime-inputs.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { acquireRegisteredRustInputs, acquireMockRustInputs, REGISTERED_RUST_INPUTS,
  RUST_INPUT_ROOT } from './rust-runtime-input-acquisition.mjs';
import { captureRegisteredRustAcquisitionSource, RUST_INPUT_ACQUISITION_SOURCE_PIN,
  runRegisteredRustRuntimeInputAcquisition } from './rust-runtime-input-acquisition-operation.mjs';

const LENGTHS = [3, 5, 7, 11, 13];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceBytes = fs.readFileSync(new URL('./rust-runtime-input-acquisition.mjs', import.meta.url));
const operationSource = fs.readFileSync(new URL('./rust-runtime-input-acquisition-operation.mjs', import.meta.url), 'utf8');
const source = sourceBytes.toString('utf8');

test('Rust input pointers, owner and coverage index agree', () => {
  const spec = '_spec/tooling/native-ingress/rust-runtime-inputs.puml';
  const files = ['rust-runtime-input-acquisition', 'rust-runtime-input-acquisition.test', 'rust-runtime-input-acquisition-operation'].map(name => 'tooling/native-ingress/' + name + '.mjs');
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(value => value.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) {
    assert.ok(diagram.includes("' covers: " + file + '\n'));
    assert.ok(fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8').startsWith('// SPEC: ' + spec + '\n'));
  }
});

function fixture(options = {}) {
  const state = { time: 0n, clocks: 0, log: [], files: new Map(), fds: new Map(), requests: [],
    timers: [], nextFd: 10, fstats: 0, named: 0, closeAttempts: 0, writes: 0, reads: 0 };
  const root = { dev: 28n, ino: 100n, mode: 0o040700n, uid: 1000n, gid: 1000n,
    nlink: 2n, size: 4096n, mtimeNs: 1n, ctimeNs: 1n };
  state.root = root;
  const record = (name, ...args) => state.log.push([name, ...args]);
  const stat = (target, named) => {
    const node = target === RUST_INPUT_ROOT ? root : state.files.get(target).stat;
    const s = { ...node };
    return options.stat ? options.stat(s, { target, named, state }) : s;
  };
  const mockFs = {
    constants: { ...fs.constants, ...options.constants },
    mkdirSync(target, opts) {
      record('mkdir', target, opts);
      assert.equal(target, RUST_INPUT_ROOT);
      assert.deepEqual(opts, { mode: 0o700, recursive: false });
      if (options.mkdirError) throw Object.assign(new Error(), { code: options.mkdirError });
      options.afterMkdir?.(state);
    },
    openSync(target, flags, mode) {
      record('open', target, flags, mode);
      assert.ok(target === RUST_INPUT_ROOT || REGISTERED_RUST_INPUTS.some(d => d.destination === target));
      if (flags & fs.constants.O_CREAT) {
        assert.equal(mode, 0o600);
        assert.ok(flags & fs.constants.O_EXCL);
        assert.equal(state.files.has(target), false);
        const index = state.files.size;
        state.files.set(target, { bytes: Buffer.alloc(0), stat: { dev: 29n, ino: BigInt(200 + index),
          mode: 0o100600n, uid: 1000n, gid: 1000n, nlink: 1n, size: 0n, mtimeNs: 1n, ctimeNs: 1n } });
        root.size += 32n; root.mtimeNs++; root.ctimeNs++;
        options.afterCreate?.(state, target);
      }
      assert.ok(flags & fs.constants.O_NOFOLLOW);
      assert.ok(flags & fs.constants.O_NONBLOCK);
      if (target === RUST_INPUT_ROOT) assert.ok(flags & fs.constants.O_DIRECTORY);
      const fd = state.nextFd++;
      state.fds.set(fd, target);
      assert.ok(state.fds.size <= 2);
      return fd;
    },
    fstatSync(fd, opts) {
      record('fstat', fd); state.fstats++;
      assert.deepEqual(opts, { bigint: true });
      options.beforeFstat?.(state, state.fds.get(fd));
      return stat(state.fds.get(fd), false);
    },
    lstatSync(target, opts) {
      record('lstat', target); state.named++;
      assert.deepEqual(opts, { bigint: true });
      return stat(target, true);
    },
    writeSync(fd, bytes, offset, length, position) {
      record('write', fd, length, position); state.writes++;
      const node = state.files.get(state.fds.get(fd));
      if (options.writeError) throw Object.assign(new Error(), { code: 'PRIVATE_ERROR_TEXT' });
      assert.equal(position, node.bytes.length);
      const n = options.shortWrite ? length - 1 : length;
      node.bytes = Buffer.concat([node.bytes, bytes.subarray(offset, offset + n)]);
      node.stat.size = BigInt(node.bytes.length); node.stat.mtimeNs++; node.stat.ctimeNs++;
      options.afterWrite?.(state, bytes);
      return n;
    },
    readSync(fd, scratch, offset, want, position) {
      record('read', fd, want, position); state.reads++;
      const node = state.files.get(state.fds.get(fd));
      let n = Math.min(want, node.bytes.length - position);
      if (options.extraEof && position === node.bytes.length) n = 1;
      if (options.shortRead && n > 0) n--;
      if (n > 0) {
        node.bytes.copy(scratch, offset, position, position + n);
        if (options.corruptRead) scratch[offset] ^= 1;
      }
      options.afterRead?.(state, node, n);
      return n;
    },
    closeSync(fd) {
      record('close', fd); state.closeAttempts++;
      if (options.closeError === state.closeAttempts) throw new Error('PRIVATE_CLOSE_TEXT');
      assert.ok(state.fds.has(fd)); state.fds.delete(fd);
    },
  };
  const mockHttps = { request(requestOptions) {
    const index = state.requests.length;
    record('request', requestOptions);
    assert.equal(requestOptions.hostname, 'static.rust-lang.org');
    assert.equal(requestOptions.servername, 'static.rust-lang.org');
    assert.equal(requestOptions.path, REGISTERED_RUST_INPUTS[index].url.slice('https://static.rust-lang.org'.length));
    assert.equal(requestOptions.rejectUnauthorized, true);
    assert.equal(requestOptions.agent, false);
    assert.equal(requestOptions.insecureHTTPParser, false);
    assert.deepEqual(requestOptions.headers, { 'Accept-Encoding': 'identity', Connection: 'close' });
    assert.equal(requestOptions.method, 'GET');
    const req = new EventEmitter(), res = new EventEmitter();
    const length = options.registered ? REGISTERED_RUST_INPUTS[index].expectedLength : LENGTHS[index];
    let reqClosed = false, resClosed = false;
    const closeReq = () => { if (!reqClosed) { reqClosed = true; req.emit('close'); } };
    const closeRes = () => { if (!resClosed) { resClosed = true; res.emit('close'); } };
    req.destroy = () => {
      record('destroyRequest', index);
      if (options.destroyThrows) throw new Error();
      if (!options.missingRequestClose) queueMicrotask(closeReq);
    };
    res.destroy = () => {
      record('destroyResponse', index); res.destroyed = true;
      if (!options.missingResponseClose) queueMicrotask(closeRes);
    };
    req.end = () => {
      record('endRequest', index);
      options.afterRequest?.(state);
      queueMicrotask(() => {
        if (options.requestError) { req.emit('error', new Error('PRIVATE_NETWORK_TEXT')); return; }
        res.statusCode = options.status ?? 200;
        res.rawHeaders = options.headers ?? ['Content-Length', String(length)];
        res.socket = { authorized: options.authorized !== false };
        res.complete = options.complete !== false;
        req.emit('response', res);
        if (res.destroyed && !options.lateChunks) return;
        if (options.requestCloseFirst) closeReq();
        if (options.earlyResponseClose) { closeRes(); return; }
        const chunks = options.chunks ? options.chunks(length, index) : [Buffer.alloc(length, index + 1)];
        for (const chunk of chunks) {
          if (res.destroyed && !options.lateChunks) break;
          res.emit('data', chunk);
        }
        if (res.destroyed && !options.lateChunks) return;
        if (options.responseError) { res.emit('error', new Error()); return; }
        res.emit('end');
        options.afterEnd?.(state);
        if (!options.missingResponseClose) closeRes();
        if (!options.missingRequestClose) closeReq();
        if (options.lateErrors) queueMicrotask(() => {
          req.emit('error', new Error()); res.emit('error', new Error());
        });
      });
    };
    state.requests.push({ req, res });
    return req;
  } };
  const deps = { fs: mockFs, https: mockHttps,
    createHash: algorithm => options.hash ? options.hash(algorithm, state) : createHash(algorithm),
    now() {
      state.clocks++; state.time++;
      return options.clock ? options.clock(state) : state.time;
    },
    geteuid: () => options.uid === undefined ? 1000 : options.uid,
    setTimeout(callback, delay) {
      const timer = { callback, delay, cancelled: false }; state.timers.push(timer);
      if (options.fireCleanup && delay <= 3000 || options.fireWorkTimer && delay > 3000) {
        queueMicrotask(() => { if (!timer.cancelled) callback(); });
      }
      return timer;
    },
    clearTimeout(timer) { if (timer) timer.cancelled = true; },
  };
  return { state, deps, run: () => options.registered ? acquireRegisteredRustInputs(deps) : acquireMockRustInputs(deps) };
}

async function stopped(options, code) {
  const f = fixture(options), result = await f.run();
  assert.equal(result.status, 'STOP'); assert.equal(result.error, code);
  assert.equal(result.nativeQualified, false); assert.equal(result.trainingReady, false);
  return { ...f, result };
}

test('frozen production manifest retains all five literal tuples and the total', () => {
  assert.equal(REGISTERED_RUST_INPUTS.length, 5);
  assert.equal(REGISTERED_RUST_INPUTS.reduce((n, d) => n + d.expectedLength, 0), 127772720);
  const expected = [
    ['cargo', 10984780, 'e74edd2cf7d0f1f1383b4f00eb90c843750bc489e2ccf7214e6476678a907425'],
    ['rustc', 80351960, '8426a3d170a5879f5682f5fbdd024a1779b3951e7baba685af2d6dc32a6dfc15'],
    ['rust-std', 29573972, '047ea7098803d3500fa1072e9cee5392697e21525559e4458128a2bf874aa382'],
    ['rustfmt-preview', 2164880, 'f1b2a7301513ffdd95ebf22ebbdd932e4d17fc806f748d93924740d0297b1396'],
    ['clippy-preview', 4697128, 'ac779bc9839dd47180806b133e4e2563c4a34716284cd5b8fede8ef289f452ca'],
  ];
  assert.deepEqual(REGISTERED_RUST_INPUTS.map(d => [d.role, d.expectedLength, d.sha256]), expected);
  assert.deepEqual(REGISTERED_RUST_INPUTS.map(d => d.name), [
    'cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz', 'rustc-1.95.0-x86_64-unknown-linux-gnu.tar.xz',
    'rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.xz', 'rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.xz',
    'clippy-1.95.0-x86_64-unknown-linux-gnu.tar.xz',
  ]);
  for (const d of REGISTERED_RUST_INPUTS) {
    assert.ok(Object.isFrozen(d));
    assert.equal(d.url, 'https://static.rust-lang.org/dist/2026-04-16/' + d.name);
    assert.equal(d.destination, RUST_INPUT_ROOT + '/' + d.name);
  }
  assert.ok(Object.isFrozen(REGISTERED_RUST_INPUTS));
});

test('mock-only five-input success uses independent real tiny hashes and never publishes a production match', async () => {
  const { result, state } = await stopped({}, 'E_MOCK_ONLY');
  assert.equal(result.mockOnly, true); assert.equal(result.verifiedInputs.length, 5);
  assert.equal(result.counts.acceptedBytes, 39); assert.equal(result.counts.readbackBytes, 39);
  assert.equal(result.counts.opens, 11); assert.equal(result.counts.closes, 11);
  assert.equal(result.counts.fstats, 32); assert.equal(result.counts.namedStats, 32);
  assert.equal(result.counts.reads, 10); assert.equal(result.counts.gets, 5);
  assert.equal(result.counts.peakOwnedFds, 2); assert.equal(state.fds.size, 0);
  assert.deepEqual([...state.files.keys()], REGISTERED_RUST_INPUTS.map(d => d.destination));
  for (const [i, d] of result.verifiedInputs.entries()) {
    assert.equal(d.incomingSha256, sha(Buffer.alloc(LENGTHS[i], i + 1)));
    assert.equal(d.readbackSha256, d.incomingSha256);
    assert.equal(d.snapshots.born.dev, '29'); assert.equal(d.snapshots.rootAfterCreate.dev, '28');
    assert.equal(Object.keys(d.snapshots.born).length, 9);
    assert.equal(d.counts.fstats, 6); assert.equal(d.counts.namedStats, 6);
    assert.equal(d.counts.opens, 2); assert.equal(d.counts.closeAttempts, 2);
    assert.equal(d.counts.reads, 2); assert.equal(d.counts.gets, 1);
    assert.ok(Object.isFrozen(d)); assert.ok(Object.isFrozen(d.snapshots.born));
  }
  for (const key of ['archiveExtracted', 'installedUsability', 'nativeQualified', 'rustReady', 'trainingReady']) assert.equal(result[key], false);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.counts));
});

for (const mkdirError of ['EEXIST', 'EACCES', 'EIO']) test(`mkdir ${mkdirError} stops without any subsequent path observation`, async () => {
  const { state, result } = await stopped({ mkdirError }, 'E_MKDIR');
  assert.deepEqual(state.log.map(x => x[0]), ['mkdir']);
  assert.equal(result.rootCreated, false); assert.equal(result.attempts.mkdir, 1);
  assert.equal(result.counts.mkdir, 0); assert.equal(result.counts.gets, 0);
});

for (const [key, value] of [['O_NOFOLLOW', 0], ['O_NONBLOCK', 1], ['O_CREAT', -1], ['O_RDONLY', 1]]) {
  test(`invalid actual flag ${key} rejects before mkdir`, async () => {
    const { state } = await stopped({ constants: { [key]: value } }, 'E_FLAGS');
    assert.equal(state.log.length, 0);
  });
}
for (const uid of [-1, 4294967296, 1.5, NaN, '1000']) test(`invalid UID ${uid} rejects before mkdir`, async () => {
  const { state, result } = await stopped({ uid }, 'E_UID');
  assert.equal(state.log.length, 0); assert.equal(result.counts.euid, 1);
});

for (const [field, value] of [['mode', 0o040755n], ['uid', 1001n], ['nlink', 3n]]) {
  test(`root ${field} requires private exact directory metadata`, async () => {
    await stopped({ afterMkdir: state => { state.root[field] = value; } }, 'E_ROOT');
  });
}
test('root named and FD full metadata must agree', async () => {
  await stopped({ stat: (s, c) => c.named && c.target === RUST_INPUT_ROOT ? { ...s, mtimeNs: s.mtimeNs + 1n } : s }, 'E_BINDING');
});
test('BigInt metadata cannot use a getter', async () => {
  await stopped({ stat: s => Object.defineProperty(s, 'ino', { get() { throw new Error(); } }) }, 'E_METADATA');
});
test('file birth must have size zero', async () => {
  await stopped({ afterCreate: (s, p) => { s.files.get(p).stat.size = 1n; } }, 'E_FILE');
});
test('file birth must be a regular, single-link, private owner file', async () => {
  for (const [field, value] of [['mode', 0o120600n], ['nlink', 2n], ['uid', 1001n], ['mode', 0o100644n]]) {
    await stopped({ afterCreate: (s, p) => { s.files.get(p).stat[field] = value; } }, 'E_FILE');
  }
});
test('file named/FD identity swaps stop', async () => {
  await stopped({ stat: (s, c) => c.named && c.target !== RUST_INPUT_ROOT ? { ...s, ino: s.ino + 1n } : s }, 'E_BINDING');
});

for (const status of [206, 301, 404]) test(`HTTP ${status} never follows or retries`, async () => {
  const { result } = await stopped({ status }, 'E_HTTP');
  assert.equal(result.counts.gets, 1); assert.equal(result.counts.writes, 0);
});
test('TLS authorization must be true', async () => { await stopped({ authorized: false }, 'E_HTTP'); });
const badHeaders = [
  [], ['Content-Length', '03'], ['Content-Length', '+3'], ['Content-Length', '3', 'content-length', '3'],
  ['Content-Length', '3', 'Content-Encoding', 'gzip'],
  ['Content-Length', '3', 'Content-Encoding', 'identity', 'content-encoding', 'identity'],
  ['Content-Length', '3', 'Transfer-Encoding', 'chunked'],
  ['Content-Length', '3', 'Content-Range', 'bytes 0-2/3'],
  ['Content-Length', '3', 'X', 'x'.repeat(16384)],
  ['Content-Length', '3', ...Array.from({ length: 32 }, () => ['X', 'x']).flat()],
  ['Content-Length', '3', 'odd'], ['Content-Length', '3', 'Bad Name', 'x'],
];
for (const [index, headers] of badHeaders.entries()) test(`strict raw header rejection ${index}`, async () => {
  const { result } = await stopped({ headers }, 'E_HEADERS');
  assert.equal(result.counts.writes, 0);
});
test('one identity encoding is accepted', async () => {
  const f = fixture();
  const request = f.deps.https.request;
  f.deps.https.request = options => {
    const req = request(options);
    req.prependListener('response', res => { res.rawHeaders.push('Content-Encoding', 'identity'); });
    return req;
  };
  assert.equal((await f.run()).verifiedInputs.length, 5);
});

for (const [name, chunk] of [['empty', Buffer.alloc(0)], ['string', 'abc'], ['oversize', Buffer.alloc(1048577)],
  ['proxy', new Proxy(Buffer.from('abc'), {})], ['shared', Buffer.from(new SharedArrayBuffer(3))]]) {
  test(`reject ${name} chunk before payload admission`, async () => {
    const { result } = await stopped({ chunks: () => [chunk] }, 'E_CHUNK');
    assert.equal(result.counts.acceptedBytes, 0); assert.equal(result.counts.writes, 0);
  });
}
test('Buffer intrinsic lengths bypass hostile shadow properties', async () => {
  const chunk = Buffer.alloc(3, 1);
  Object.defineProperty(chunk, 'length', { get() { throw new Error(); } });
  const { result } = await stopped({ chunks: (length, i) => i === 0 ? [chunk] : [Buffer.alloc(length, i + 1)] }, 'E_MOCK_ONLY');
  assert.equal(result.verifiedInputs.length, 5);
});

test('reject resizable-backed chunk before payload admission', async () => {
  const backing = new ArrayBuffer(3, { maxByteLength: 6 });
  new Uint8Array(backing).fill(1);
  const { result } = await stopped({ chunks: () => [Buffer.from(backing)] }, 'E_CHUNK');
  assert.equal(result.counts.acceptedBytes, 0);
  assert.equal(result.counts.writes, 0);
});
test('overflow bytes reject before hash/write admission', async () => {
  const { result } = await stopped({ chunks: () => [Buffer.alloc(4)] }, 'E_LENGTH');
  assert.equal(result.counts.acceptedBytes, 0); assert.equal(result.counts.writes, 0);
});
test('source chunk mutation cannot change the captured write bytes', async () => {
  let original;
  const { result } = await stopped({ chunks: (length, index) => [original = Buffer.alloc(length, index + 1)],
    afterWrite: () => original.fill(0) }, 'E_MOCK_ONLY');
  assert.equal(result.verifiedInputs.length, 5);
});
test('short write stops without retry and reports returned positive bytes', async () => {
  const { result } = await stopped({ shortWrite: true }, 'E_IO');
  assert.equal(result.counts.writes, 1); assert.equal(result.counts.writtenBytes, 2);
  assert.equal(result.counts.acceptedBytes, 3); assert.equal(result.counts.opens, 2);
});
test('throwing write records attempts and only completed-call lower bounds', async () => {
  const { result } = await stopped({ writeError: true }, 'E_IO');
  assert.equal(result.attempts.writes, 1); assert.equal(result.counts.writes, 0);
  assert.equal(result.counts.writtenBytes, 0); assert.equal(result.counterLowerBoundsOnFailure, true);
});
test('incoming digest mismatch stops before reader open', async () => {
  const { result } = await stopped({ chunks: length => [Buffer.alloc(length, 9)] }, 'E_HASH');
  assert.equal(result.counts.opens, 2); assert.equal(result.counts.reads, 0);
});
test('short body stops on end', async () => { await stopped({ chunks: () => [Buffer.alloc(2, 1)] }, 'E_LENGTH'); });
test('end requires complete true', async () => { await stopped({ complete: false }, 'E_HTTP'); });
test('response close before end stops', async () => { await stopped({ earlyResponseClose: true }, 'E_HTTP'); });
test('request close may precede response end', async () => {
  const { result } = await stopped({ requestCloseFirst: true }, 'E_MOCK_ONLY');
  assert.equal(result.verifiedInputs.length, 5);
});
test('request failure before body retains an exclusive zero-length file', async () => {
  const { state, result } = await stopped({ requestError: true }, 'E_HTTP');
  assert.equal(state.files.size, 1); assert.equal([...state.files.values()][0].bytes.length, 0);
  assert.equal(result.counts.writes, 0); assert.equal(result.counts.closes, 2);
});
test('response errors destroy both objects exactly once', async () => {
  const { result } = await stopped({ responseError: true }, 'E_HTTP');
  assert.equal(result.counts.destroyRequests, 1); assert.equal(result.counts.destroyResponses, 1);
});
test('late error observers remain installed after successful mock passes', async () => {
  await stopped({ lateErrors: true }, 'E_MOCK_ONLY');
});
test('late payload after failure performs no additional writes', async () => {
  const { result } = await stopped({ shortWrite: true, lateChunks: true,
    chunks: () => [Buffer.alloc(3, 1), Buffer.alloc(3, 1)] }, 'E_IO');
  assert.equal(result.counts.writes, 1); assert.equal(result.counts.acceptedBytes, 3);
});
test('uncertain response close exhausts cleanup and still closes filesystem holders', async () => {
  const { state, result } = await stopped({ responseError: true, missingResponseClose: true, fireCleanup: true }, 'E_CLEANUP');
  assert.equal(result.cleanupUncertain, true); assert.equal(state.fds.size, 0);
});
test('missing request close cannot accept bytes', async () => {
  const { result } = await stopped({ requestError: true, missingRequestClose: true, fireCleanup: true }, 'E_CLEANUP');
  assert.equal(result.verifiedInputs.length, 0);
});
test('destroy failure remains cleanup-uncertain', async () => {
  const { result } = await stopped({ requestError: true, destroyThrows: true, fireCleanup: true }, 'E_CLEANUP');
  assert.equal(result.cleanupUncertain, true);
});
test('short read stops without retry and counts actual positive bytes', async () => {
  const { result } = await stopped({ shortRead: true }, 'E_IO');
  assert.equal(result.counts.reads, 1); assert.equal(result.counts.readbackBytes, 2);
});
test('independent readback hash catches altered bytes', async () => { await stopped({ corruptRead: true }, 'E_HASH'); });
test('EOF probe rejects extra bytes and includes them in observed read count', async () => {
  const { result } = await stopped({ extraEof: true }, 'E_LENGTH');
  assert.equal(result.counts.reads, 2); assert.equal(result.counts.readbackBytes, 4);
});
test('file security identity cannot change after writing', async () => {
  await stopped({ afterEnd: state => { [...state.files.values()][0].stat.ino++; } }, 'E_BINDING');
});
test('readback metadata must equal the full written snapshot', async () => {
  await stopped({ afterRead: (_s, node, n) => { if (n > 0) node.stat.mtimeNs++; } }, 'E_BINDING');
});
test('root security cannot change during exclusive creation', async () => {
  await stopped({ afterCreate: s => { s.root.ino++; } }, 'E_BINDING');
});
test('root metadata cannot change during readback', async () => {
  await stopped({ afterRead: s => { s.root.ctimeNs++; } }, 'E_BINDING');
});
test('final root comparison remains mandatory after all five prefix records', async () => {
  const { result } = await stopped({ beforeFstat: s => { if (s.fstats === 32) s.root.ctimeNs++; } }, 'E_BINDING');
  assert.equal(result.verifiedInputs.length, 5); assert.equal(result.status, 'STOP');
});
test('failed writer close absorbs success, forbids reader open, and still closes root', async () => {
  const { result, state } = await stopped({ closeError: 1 }, 'E_CLOSE');
  assert.equal(result.counts.opens, 2); assert.equal(result.attempts.closes, 2);
  assert.equal(state.closeAttempts, 2); assert.equal(result.closeFailed, true);
});
test('failed reader close forbids opening the next file', async () => {
  const { result } = await stopped({ closeError: 2 }, 'E_CLOSE');
  assert.equal(result.counts.opens, 3); assert.equal(result.verifiedInputs.length, 0);
});
test('failed final root close retains five prefix records but publishes STOP', async () => {
  const { result } = await stopped({ closeError: 11 }, 'E_CLOSE');
  assert.equal(result.verifiedInputs.length, 5); assert.equal(result.counts.closes, 10);
  assert.equal(result.attempts.closes, 11);
});
test('clock starts before mkdir and includes setup time', async () => {
  const { state, result } = await stopped({ afterMkdir: s => { s.time = 597000000000n; } }, 'E_DEADLINE');
  assert.equal(state.log.filter(x => x[0] === 'open').length, 0); assert.equal(result.rootCreated, true);
});
test('clock monotonicity rejects backwards samples', async () => {
  const { state } = await stopped({ clock: s => s.clocks === 1 ? 2n : 1n }, 'E_CLOCK');
  assert.equal(state.log.length, 0);
});
test('per-file deadline is 119 seconds from entry, not body arrival', async () => {
  const { result } = await stopped({ afterRequest: s => { s.time = 119000001000n; } }, 'E_DEADLINE');
  assert.equal(result.counts.writes, 0); assert.equal(result.counts.closes, 2);
});
test('global work deadline reserves three cleanup seconds', async () => {
  const { result } = await stopped({ afterRequest: s => { s.time = 597000000000n; } }, 'E_DEADLINE');
  assert.equal(result.counts.closes, 2); assert.equal(result.counts.opens, 2);
});
test('work timer cancels active network work and releases held filesystem descriptors', async () => {
  const { state } = await stopped({ fireWorkTimer: true }, 'E_DEADLINE');
  assert.equal(state.fds.size, 0);
});
test('data-event per-file bound precedes the 16385th write', async () => {
  const { result } = await stopped({ registered: true,
    chunks: () => Array.from({ length: 16385 }, () => Buffer.alloc(1)) }, 'E_LIMIT');
  assert.equal(result.counts.dataEvents, 16384); assert.equal(result.counts.writes, 16384);
  assert.ok(result.counts.clockReads <= 262144);
});
test('clock-read ceiling stops payload work and preserves cleanup samples and unconditional FD closes', async () => {
  let hashIndex = 0;
  const f = fixture({ registered: true,
    hash: () => {
      const d = REGISTERED_RUST_INPUTS[Math.floor(hashIndex++ / 2)];
      return { update() { return this; }, digest() { return d.sha256; } };
    },
    chunks: function* (length) {
      const base = Math.floor(length / 16384), extra = length % 16384;
      for (let i = 0; i < 16384; i++) yield Buffer.alloc(base + Number(i < extra));
    },
  });
  f.deps.fs.writeSync = (fd, bytes, offset, length, position) => {
    const node = f.state.files.get(f.state.fds.get(fd));
    assert.equal(position, Number(node.stat.size));
    node.stat.size += BigInt(length); node.stat.mtimeNs++; node.stat.ctimeNs++;
    return length;
  };
  f.deps.fs.readSync = (fd, scratch, offset, want, position) => {
    const node = f.state.files.get(f.state.fds.get(fd));
    const n = Math.min(want, Number(node.stat.size) - position);
    scratch.fill(0, offset, offset + n); return n;
  };
  const result = await f.run();
  assert.equal(result.error, 'E_LIMIT'); assert.equal(result.status, 'STOP');
  assert.equal(result.verifiedInputs.length, 1);
  assert.ok(result.counts.clockReads >= 262140 && result.counts.clockReads <= 262144);
  assert.equal(f.state.fds.size, 0); assert.equal(result.counts.opens, result.counts.closes);
  assert.equal(result.counts.destroyRequests, 1); assert.equal(result.counts.destroyResponses, 1);
});
test('a complete body still cannot pass without observed request and response closes', async () => {
  const { result } = await stopped({ missingRequestClose: true, fireCleanup: true,
    afterEnd: s => { s.timers.find(timer => timer.delay > 3000).callback(); } }, 'E_CLEANUP');
  assert.equal(result.verifiedInputs.length, 0); assert.equal(result.cleanupUncertain, true);
});
test('cleanup reaching the absolute global end still releases filesystem holders', async () => {
  const { state, result } = await stopped({ responseError: true,
    clock: s => s.log.some(item => item[0] === 'destroyResponse') ? 600000000000n : s.time }, 'E_CLEANUP');
  assert.equal(result.cleanupUncertain, true); assert.equal(state.fds.size, 0);
});
test('partial completed prefix remains explicit when a later file fails', async () => {
  const { result } = await stopped({ chunks: (length, index) => [Buffer.alloc(length, index === 2 ? 9 : index + 1)] }, 'E_HASH');
  assert.equal(result.verifiedInputs.length, 2); assert.equal(result.attemptedInputs.length, 3);
  assert.equal(result.attemptedInputs[2].verified, false); assert.equal(result.status, 'STOP');
});
test('all source ceilings stay explicit and production does not accept URL or root parameters', () => {
  assert.match(source, /reads: 4096, writes: 32768, gets: 5/);
  assert.match(source, /opens: 11, closes: 11, fstats: 32, namedStats: 32/);
  assert.match(source, /cleanup \? 262144 : 262140/);
  assert.match(source, /record\.dataEvents < 16384 && counts\.dataEvents < 32768/);
  assert.match(source, /export function acquireRegisteredRustInputs\(trustedDeps\)/);
});
test('mock fixture requires explicit dependencies and cannot silently borrow production FS', () => {
  const f = fixture(); f.deps.fs = fs;
  assert.throws(() => acquireMockRustInputs(f.deps), { code: 'E_MOCK_TCB' });
});
test('source contains no execution, decoder, environment lookup, repair, deletion, or old-pipeline import', () => {
  for (const forbidden of ['child_process', 'process.env', 'unlink', 'renameSync', 'rmSync', 'fsync',
    "from './acquisition.mjs'", "from './custody.mjs'", 'f9-m3-xz-inputs-01']) assert.equal(source.includes(forbidden), false);
  assert.deepEqual([...source.matchAll(/from '(node:[^']+)'/g)].map(m => m[1]),
    ['node:fs', 'node:https', 'node:crypto', 'node:util']);
});
test('operation source pin matches the exact authored helper bytes', () => {
  assert.equal(RUST_INPUT_ACQUISITION_SOURCE_PIN.bytes, sourceBytes.length);
  assert.equal(RUST_INPUT_ACQUISITION_SOURCE_PIN.sha256, sha(sourceBytes));
  assert.equal(captureRegisteredRustAcquisitionSource(sourceBytes).equals(sourceBytes), true);
});
test('source capture rejects changed bytes, length, proxy, and shared backing', () => {
  const changed = Buffer.from(sourceBytes); changed[0] ^= 1;
  for (const bytes of [changed, sourceBytes.subarray(1), new Proxy(sourceBytes, {}), Buffer.from(new SharedArrayBuffer(sourceBytes.length))]) {
    assert.throws(() => captureRegisteredRustAcquisitionSource(bytes), { code: 'E_SOURCE_PIN' });
  }
});
test('source capture snapshots bytes independently of the mutable caller input', () => {
  const input = Buffer.from(sourceBytes), captured = captureRegisteredRustAcquisitionSource(input);
  input.fill(0); assert.equal(captured.equals(sourceBytes), true);
});

test('source capture rejects matching pinned bytes on resizable backing', () => {
  const backing = new ArrayBuffer(sourceBytes.length, { maxByteLength: sourceBytes.length + 1 });
  new Uint8Array(backing).set(sourceBytes);
  assert.throws(() => captureRegisteredRustAcquisitionSource(Buffer.from(backing)), { code: 'E_SOURCE_PIN' });
});
test('operation is inert on import, zero-argument, reads one fixed helper and imports captured same bytes', () => {
  assert.equal(runRegisteredRustRuntimeInputAcquisition.length, 0);
  assert.equal([...operationSource.matchAll(/fs\.readFileSync\(/g)].length, 1);
  assert.match(operationSource, /const captured = captureRegisteredRustAcquisitionSource\(raw\)/);
  assert.match(operationSource, /const uri = 'data:text\/javascript;base64,' \+ captured\.toString\('base64'\)/);
  assert.match(operationSource, /const helper = await import\(uri\)/);
  assert.equal([...operationSource.matchAll(/await helper\.acquireRegisteredRustInputs\(\)/g)].length, 1);
  assert.equal(/lstat|fstat|f9-m3-xz|child_process|process\.env|stdout|writeSync/.test(operationSource), false);
  assert.match(operationSource, /Buffer\.byteLength\(text\) > 24576/);
});
test('full mock output remains ASCII JSONLF below the operation output cap', async () => {
  const { result } = await stopped({}, 'E_MOCK_ONLY');
  const text = JSON.stringify({ result }) + '\n';
  assert.match(text, /^[\x20-\x7e]*\n$/); assert.ok(Buffer.byteLength(text) + 2000 < 24576);
});
test('registered-sized identity DATA also fits the output cap without executing registered acquisition', async () => {
  const { result } = await stopped({}, 'E_MOCK_ONLY');
  const shaped = JSON.parse(JSON.stringify(result));
  const shape = (s, size) => ({ ...s, ino: '1211332', size: String(size),
    mtimeNs: '1792805605531830652', ctimeNs: '1792805605531830652' });
  for (const list of [shaped.verifiedInputs, shaped.attemptedInputs]) {
    for (const [index, record] of list.entries()) {
      Object.assign(record, REGISTERED_RUST_INPUTS[index]);
      for (const [key, snapshot] of Object.entries(record.snapshots)) {
        record.snapshots[key] = shape(snapshot, key.startsWith('root') ? 4096 : key === 'born' ? 0 : record.expectedLength);
      }
    }
  }
  shaped.rootBirth = shape(shaped.rootBirth, 4096); shaped.rootFinal = shape(shaped.rootFinal, 4096);
  const text = JSON.stringify({ result: shaped }) + '\n';
  assert.match(text, /^[\x20-\x7e]*\n$/); assert.ok(Buffer.byteLength(text) + 2000 < 24576);
});
