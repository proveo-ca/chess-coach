// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectXzPrefix, crc32XzPrefix, createMockRustXzPrefixes, assertRustXzPrefixReceipt,
  RUST_XZ_PREFIX_INPUTS as INPUTS, RUST_XZ_PREFIX_LIMITS as LIMITS } from './rust-xz-prefixes.mjs';
import { captureRegisteredRustXzPrefixSource, captureRegisteredRustXzPrefixReceipt,
  RUST_XZ_PREFIX_SOURCE_PIN, RUST_XZ_PREFIX_RECEIPT_PIN, runRegisteredRustXzPrefixes,
  createMockRustXzPrefixesOperation, inspectRustXzPrefixObservationAccounting } from './rust-xz-prefixes-operation.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const source = fs.readFileSync(new URL('./rust-xz-prefixes.mjs', import.meta.url));
const operation = fs.readFileSync(new URL('./rust-xz-prefixes-operation.mjs', import.meta.url));
const receiptRaw = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/rust-runtime-inputs.receipt.json', import.meta.url));
const receipt = JSON.parse(receiptRaw);
const table = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function fixtureCrc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = table[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function vli(number) {
  let value = BigInt(number);
  const bytes = [];
  do {
    const byte = Number(value & 127n); value >>= 7n;
    bytes.push(byte | (value ? 128 : 0));
  } while (value);
  return bytes;
}
function prefix(options = {}) {
  const filters = options.filters ?? [{ id: 33, properties: [28] }];
  let flags = filters.length - 1, body = [];
  if (options.compressed !== undefined) { flags |= 0x40; body.push(...vli(options.compressed)); }
  if (options.uncompressed !== undefined) { flags |= 0x80; body.push(...vli(options.uncompressed)); }
  for (const filter of filters) body.push(...vli(filter.id), ...vli(filter.properties.length), ...filter.properties);
  if (options.body) body = options.body;
  flags = options.flags ?? flags;
  const blockBytes = options.blockBytes ?? Math.max(8, Math.ceil((body.length + 6) / 4) * 4);
  const block = Buffer.alloc(blockBytes);
  block[0] = blockBytes / 4 - 1; block[1] = flags;
  Buffer.from(body).copy(block, 2, 0, blockBytes - 6);
  options.mutateBlock?.(block);
  block.writeUInt32LE(fixtureCrc(block.subarray(0, -4)), blockBytes - 4);
  const result = Buffer.alloc(1040, 0xa5);
  Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0, 0, options.check ?? 4]).copy(result);
  result.writeUInt32LE(fixtureCrc(result.subarray(6, 8)), 8);
  block.copy(result, 12);
  return result;
}
const rejects = (bytes, code) => assert.throws(() => inspectXzPrefix(bytes), { code });
const clone = value => JSON.parse(JSON.stringify(value));

test('parser: independent CRC32 check vector and empty input', () => {
  assert.equal(fixtureCrc(Buffer.from('123456789')), 0xcbf43926);
  assert.equal(crc32XzPrefix(Buffer.from('123456789')), 0xcbf43926);
  assert.equal(crc32XzPrefix(Buffer.alloc(0)), 0);
});
test('parser: first block declares 64 MiB, not decoder RSS or minimum memory', () => {
  const result = inspectXzPrefix(prefix());
  assert.equal(result.declaredDictionaryBytes, '67108864');
  assert.equal(result.filters[0].id, '33');
  assert.equal(result.filters[0].propertiesHex, '1c');
  assert.equal(result.compressedSizeDeclared, null);
  assert.equal(result.uncompressedSizeDeclared, null);
  assert.equal(result.scope, 'PREFIX_DECLARATIONS_NOT_FULL_ARCHIVE_INTEGRITY_OR_DECODER_MEMORY_PROOF');
  assert.equal('minimumMemory' in result, false);
  assert.equal('rss' in result, false);
});
for (const check of [0, 1, 4, 10]) test(`parser: permitted stream Check ID ${check}`, () => {
  assert.equal(inspectXzPrefix(prefix({ check })).streamCheckId, check);
});
test('parser: property zero declares 4096 bytes', () => {
  assert.equal(inspectXzPrefix(prefix({ filters: [{ id: 33, properties: [0] }] })).declaredDictionaryBytes, '4096');
});
test('parser: property 40 special dictionary declaration', () => {
  assert.equal(inspectXzPrefix(prefix({ filters: [{ id: 33, properties: [40] }] })).declaredDictionaryBytes, '4294967295');
});
test('parser: odd dictionary property uses the three-times base', () => {
  assert.equal(inspectXzPrefix(prefix({ filters: [{ id: 33, properties: [1] }] })).declaredDictionaryBytes, '6144');
});
test('parser: canonical optional sizes include maximum 63-bit VLI', () => {
  const result = inspectXzPrefix(prefix({ compressed: 1n, uncompressed: (1n << 63n) - 1n }));
  assert.equal(result.compressedSizeDeclared, '1');
  assert.equal(result.uncompressedSizeDeclared, '9223372036854775807');
});
test('parser: CRC-correct canonical compressed size zero rejects', () => {
  rejects(prefix({ compressed: 0n }), 'E_BLOCK_LENGTH');
});
test('parser: compressed size one and uncompressed size zero remain declarations', () => {
  const result = inspectXzPrefix(prefix({ compressed: 1n, uncompressed: 0n }));
  assert.equal(result.compressedSizeDeclared, '1');
  assert.equal(result.uncompressedSizeDeclared, '0');
});
test('parser: Delta and x86 BCJ precede final LZMA2 declarations', () => {
  const result = inspectXzPrefix(prefix({ filters: [
    { id: 3, properties: [255] }, { id: 4, properties: [] }, { id: 33, properties: [28] },
  ] }));
  assert.deepEqual(result.filters.map(filter => filter.id), ['3', '4', '33']);
});
test('parser: four-filter bound and x86 four-byte properties', () => {
  const filters = [{ id: 4, properties: [0, 1, 2, 3] }, { id: 3, properties: [0] },
    { id: 4, properties: [] }, { id: 33, properties: [28] }];
  assert.equal(inspectXzPrefix(prefix({ filters })).filters.length, 4);
});
test('parser: maximum 1024-byte block header fits bounded prefix', () => {
  assert.equal(inspectXzPrefix(prefix({ blockBytes: 1024 })).blockHeaderBytes, 1024);
});
test('parser: Uint8Array subview snapshots only its explicit range', () => {
  const backing = new Uint8Array(1100); backing.set(prefix(), 20);
  const bytes = backing.subarray(20, 1060), result = inspectXzPrefix(bytes);
  bytes.fill(0);
  assert.equal(result.prefixSha256, digest(prefix()));
});
test('parser: hash scopes all supplied prefix bytes, not compressed body validity', () => {
  const first = prefix(), second = Buffer.from(first); second[1039] ^= 1;
  assert.notEqual(inspectXzPrefix(first).prefixSha256, inspectXzPrefix(second).prefixSha256);
  assert.equal(inspectXzPrefix(second).declaredDictionaryBytes, '67108864');
});
test('parser: deeply frozen declaration graph', () => {
  const result = inspectXzPrefix(prefix());
  for (const value of [result, result.filters, ...result.filters]) assert.equal(Object.isFrozen(value), true);
  assert.throws(() => { result.filters[0].id = '0'; }, TypeError);
});
test('parser: magic mismatch', () => { const bytes = prefix(); bytes[0] = 0; rejects(bytes, 'E_MAGIC'); });
test('parser: stream reserved byte', () => { const bytes = prefix(); bytes[6] = 1; rejects(bytes, 'E_STREAM_FLAGS'); });
test('parser: unsupported stream Check ID', () => rejects(prefix({ check: 2 }), 'E_STREAM_FLAGS'));
test('parser: stream CRC corruption', () => { const bytes = prefix(); bytes[8] ^= 1; rejects(bytes, 'E_STREAM_CRC'); });
test('parser: empty first stream stops as unsupported', () => {
  const bytes = prefix(); bytes[12] = 0; rejects(bytes, 'UNSUPPORTED_FIRST_BLOCK');
});
test('parser: truncated stream header', () => rejects(prefix().subarray(0, 12), 'E_LENGTH'));
test('parser: truncated first block header', () => rejects(prefix().subarray(0, 23), 'E_BLOCK_LENGTH'));
test('parser: prefix over 1040 bytes rejects before parsing', () => rejects(Buffer.alloc(1041), 'E_BYTES'));
for (const reserved of [4, 8, 16, 32]) test(`parser: block reserved flag ${reserved}`, () => {
  rejects(prefix({ flags: reserved }), 'E_BLOCK_FLAGS');
});
test('parser: block CRC corruption', () => { const bytes = prefix(); bytes[23] ^= 1; rejects(bytes, 'E_BLOCK_CRC'); });
test('parser: nonzero header padding with valid CRC', () => {
  rejects(prefix({ mutateBlock: block => { block[5] = 1; } }), 'E_PADDING');
});
test('parser: redundant VLI zero high group', () => rejects(prefix({ body: [0xa1, 0, 1, 28] }), 'E_VLI'));
test('parser: overrun VLI at CRC boundary', () => rejects(prefix({ blockBytes: 8, body: [128, 128] }), 'E_VLI'));
test('parser: ninth continuation rejects VLI', () => rejects(prefix({ body: Array(9).fill(255) }), 'E_VLI'));
test('parser: optional compressed VLI rejects redundant high zero', () => {
  rejects(prefix({ flags: 0x40, body: [128, 0, 33, 1, 28] }), 'E_VLI');
});
test('parser: optional uncompressed VLI rejects ninth continuation', () => {
  rejects(prefix({ flags: 0x80, body: [...Array(9).fill(255), 33, 1, 28] }), 'E_VLI');
});
test('parser: property-length VLI rejects noncanonical encoding', () => {
  rejects(prefix({ body: [33, 129, 0, 28] }), 'E_VLI');
});
test('parser: property span cannot cross header CRC', () => {
  rejects(prefix({ body: [33, ...vli((1n << 63n) - 1n)] }), 'E_PROPERTIES');
});
for (const properties of [[], [0, 0], [41], [255]]) test(`parser: invalid LZMA2 properties ${JSON.stringify(properties)}`, () => {
  rejects(prefix({ filters: [{ id: 33, properties }] }), 'E_PROPERTIES');
});
test('parser: final filter must be LZMA2', () => rejects(prefix({ filters: [{ id: 4, properties: [] }] }), 'UNSUPPORTED_FILTER'));
test('parser: other official BCJ IDs remain unsupported in this finite profile', () => {
  rejects(prefix({ filters: [{ id: 5, properties: [] }, { id: 33, properties: [28] }] }), 'UNSUPPORTED_FILTER');
});
test('parser: LZMA2 cannot appear as a preceding filter', () => {
  rejects(prefix({ filters: [{ id: 33, properties: [28] }, { id: 33, properties: [28] }] }), 'UNSUPPORTED_FILTER');
});
test('parser: x86 properties length must be zero or four', () => {
  rejects(prefix({ filters: [{ id: 4, properties: [0] }, { id: 33, properties: [28] }] }), 'E_PROPERTIES');
});
test('parser: Delta requires one property byte', () => {
  rejects(prefix({ filters: [{ id: 3, properties: [] }, { id: 33, properties: [28] }] }), 'E_PROPERTIES');
});
test('parser: Proxy rejects without invoking traps', () => {
  let traps = 0;
  rejects(new Proxy(prefix(), { get() { traps++; throw Error(); }, getPrototypeOf() { traps++; throw Error(); } }), 'E_BYTES');
  assert.equal(traps, 0);
});
test('parser: accessor lengths reject without invoking getters', () => {
  const bytes = prefix(); let getters = 0;
  Object.defineProperty(bytes, 'length', { get() { getters++; throw Error(); } });
  rejects(bytes, 'E_BYTES'); assert.equal(getters, 0);
});
test('parser: shared backing store rejects', () => rejects(new Uint8Array(new SharedArrayBuffer(1040)), 'E_BYTES'));
test('parser: resizable backing store rejects', { skip: !Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable') }, () => {
  rejects(new Uint8Array(new ArrayBuffer(1040, { maxByteLength: 2080 })), 'E_BYTES');
});
test('parser: detached backing store rejects', () => {
  const bytes = new Uint8Array(1040); structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
  rejects(bytes, 'E_BYTES');
});
test('parser: other typed arrays, spoofed views and subclasses reject', () => {
  rejects(new Uint16Array(520), 'E_BYTES');
  rejects(Object.create(Uint8Array.prototype), 'E_BYTES');
  class Subclass extends Uint8Array {}
  rejects(new Subclass(1040), 'E_BYTES');
});

const bigMetadata = value => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, BigInt(item)]));
function memoryContext(hooks = {}) {
  const state = { opens: [], closes: [], calls: [], live: new Map(), reads: 0, rootNamedStats: 0,
    clock: 0n, clockCalls: 0, throwClock: false, nextFd: 100 };
  const paths = new Map([[INPUTS.root, INPUTS.rootFinal],
    ...INPUTS.inputs.map(input => [INPUTS.root + '/' + input.name, input.finalMetadata])]);
  const fake = {
    constants: { ...fs.constants, ...hooks.constants },
    openSync(path, flags) {
      assert.equal(paths.has(path), true); state.calls.push(['open', path, flags]);
      hooks.open?.(state, path, flags);
      const fd = state.nextFd++;
      state.live.set(fd, path); state.opens.push({ fd, path, flags });
      assert.ok(state.live.size <= 2);
      return fd;
    },
    closeSync(fd) {
      assert.equal(state.closes.includes(fd), false); assert.equal(state.live.has(fd), true);
      state.calls.push(['close', fd]); state.closes.push(fd); state.live.delete(fd);
      hooks.close?.(state, fd);
    },
    fstatSync(fd, options) {
      assert.deepEqual(options, { bigint: true }); assert.equal(state.live.has(fd), true);
      const path = state.live.get(fd), result = bigMetadata(paths.get(path));
      state.calls.push(['fstat', fd]);
      return hooks.fstat?.(state, path, result) ?? result;
    },
    lstatSync(path, options) {
      assert.deepEqual(options, { bigint: true }); assert.equal(paths.has(path), true);
      if (path === INPUTS.root) state.rootNamedStats++;
      const result = bigMetadata(paths.get(path)); state.calls.push(['lstat', path]);
      return hooks.lstat?.(state, path, result) ?? result;
    },
    readSync(fd, target, offset, length, position) {
      const path = state.live.get(fd);
      assert.ok(path && path !== INPUTS.root);
      assert.deepEqual([offset, length, position, target.length], [0, 1040, 0, 1040]);
      state.calls.push(['read', fd]); state.reads++;
      (hooks.prefix ?? prefix()).copy(target);
      return hooks.read?.(state, path, target) ?? 1040;
    },
  };
  const now = () => {
    state.clockCalls++;
    if (state.throwClock) throw Error('mock clock');
    return hooks.now?.(state) ?? state.clock;
  };
  return { state, fake, deps: { fs: fake, now }, observe: () => createMockRustXzPrefixes({ fs: fake, now })() };
}
function stopped(ctx, expected, reads) {
  const result = ctx.observe();
  assert.equal(result.status, 'STOP');
  if (expected) assert.equal(result.error, expected);
  assert.deepEqual(result.observations, []); assert.equal(result.rootFinalUnchanged, false);
  assert.equal(result.rootFinal, null); assert.equal(ctx.state.live.size, 0);
  assert.equal(new Set(ctx.state.closes).size, ctx.state.closes.length);
  if (reads !== undefined) assert.equal(ctx.state.reads, reads);
  return result;
}

test('custody: exact five-file mock success uses 6 opens, 6 closes, 5 reads and 5200 bytes', () => {
  const ctx = memoryContext(), result = ctx.observe();
  assert.equal(result.status, 'RUST_XZ_PREFIXES_OBSERVED'); assert.equal(result.mockOnly, true);
  assert.equal(result.observations.length, 5);
  assert.deepEqual([result.counts.opens, result.counts.closeAttempts, result.counts.closes,
    result.counts.reads, result.counts.prefixAttempts, result.counts.prefixBytes, result.counts.requestedPrefixBytes,
    result.counts.peakOwnedFds, result.counts.fsOperations], [6, 6, 6, 5, 5, 5200, 5200, 2, 61]);
  assert.equal(ctx.state.live.size, 0); assert.equal(result.cleanupUncertain, false);
  assert.equal(result.ioAccountingComplete, true); assert.ok(result.counts.clockReads <= LIMITS.clockReads);
  assert.deepEqual(result.rootFinal, INPUTS.rootFinal);
  assert.equal(INPUTS.rootFinal.dev, '28'); assert.equal(result.observations[0].metadata.dev, '29');
  for (let i = 0; i < 5; i++) {
    assert.equal(result.observations[i].expectedWholeSha256, INPUTS.inputs[i].expectedWholeSha256);
    assert.equal(result.observations[i].declarations.prefixSha256, digest(prefix()));
  }
  assert.match(JSON.stringify(result), /^[\x20-\x7e]*$/); assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 16384);
});
test('custody: nofollow/nonblock flags on every open and directory flag on root only', () => {
  const ctx = memoryContext(); ctx.observe();
  const C = fs.constants;
  assert.equal(ctx.state.opens[0].flags, C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW | C.O_NONBLOCK);
  for (const item of ctx.state.opens.slice(1)) assert.equal(item.flags, C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK);
});
test('custody: no decoding, execution, readiness, installation, whole hash or EOF claim', () => {
  const result = memoryContext().observe();
  for (const key of ['nativeQualified', 'rustReady', 'trainingReady', 'installedUsability', 'filesChanged',
    'filesInstalled', 'archiveDecoded', 'archiveExtracted', 'pythonRuntimeInvoked', 'rustExecuted',
    'nativeAuthority', 'toolRuntimeAdmission', 'wholeArchiveHashVerifiedThisOperation', 'eofProbed',
    'hardDeadlineGuaranteed', 'hardRssBounded']) assert.equal(result[key], false, key);
  assert.match(result.executionProfile, /not_F9_not_1M_meter/);
});
test('custody: root metadata change stops before first leaf', () => {
  const ctx = memoryContext({ fstat: (s, path, meta) => path === INPUTS.root ? { ...meta, mtimeNs: meta.mtimeNs + 1n } : meta });
  const result = stopped(ctx, 'E_BINDING', 0); assert.equal(result.counts.closeAttempts, 1);
});
for (const key of ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']) {
  test(`custody: own file ${key} mismatch stops without reading`, () => {
    const ctx = memoryContext({ fstat: (s, path, meta) => path !== INPUTS.root ? { ...meta, [key]: meta[key] + 1n } : meta });
    stopped(ctx, 'E_BINDING', 0);
  });
}
test('custody: named leaf symlink metadata rejects', () => {
  stopped(memoryContext({ lstat: (s, path, meta) => path !== INPUTS.root ? { ...meta, mode: 0o120777n } : meta }), 'E_BINDING', 0);
});
test('custody: missing leaf stops without attempting a later archive', () => {
  const ctx = memoryContext({ open: (s, path) => { if (path !== INPUTS.root) throw Error('missing'); } });
  const result = stopped(ctx, 'E_IO', 0);
  assert.equal(result.counts.openAttempts, 2); assert.equal(result.counts.closes, 1);
  assert.equal(result.counterLowerBoundsOnFailure, true);
});
test('custody: short read stops without retry or EOF probe', () => {
  const result = stopped(memoryContext({ read: () => 1000 }), 'E_LENGTH', 1);
  assert.equal(result.counts.prefixBytes, 1000); assert.equal(result.counts.requestedPrefixBytes, 1040);
});
test('custody: throwing read closes both owned descriptors once', () => {
  const result = stopped(memoryContext({ read: () => { throw Error('read'); } }), 'E_IO', 1);
  assert.equal(result.counts.reads, 0); assert.equal(result.counts.prefixAttempts, 1);
  assert.equal(result.counts.closeAttempts, 2);
});
test('custody: malformed prefix stops without opening the second file', () => {
  stopped(memoryContext({ prefix: Buffer.alloc(1040) }), 'E_MAGIC', 1);
});
test('custody: file metadata changes after read suppress all provisional results', () => {
  const ctx = memoryContext({ fstat: (s, path, meta) => path !== INPUTS.root && s.reads ? { ...meta, ctimeNs: meta.ctimeNs + 1n } : meta });
  stopped(ctx, 'E_BINDING', 1);
});
test('custody: root metadata changes after read suppress all provisional results', () => {
  const ctx = memoryContext({ lstat: (s, path, meta) => path === INPUTS.root && s.reads ? { ...meta, size: meta.size + 1n } : meta });
  stopped(ctx, 'E_BINDING', 1);
});
test('custody: final root check withholds all five parsed observations', () => {
  const ctx = memoryContext({ lstat: (s, path, meta) => path === INPUTS.root && s.rootNamedStats === 12 ? { ...meta, ino: meta.ino + 1n } : meta });
  const result = stopped(ctx, 'E_BINDING', 5); assert.equal(result.counts.closes, 6);
});
test('custody: named stat failure cleans both descriptors', () => {
  stopped(memoryContext({ lstat: (s, path) => { if (path !== INPUTS.root) throw Error('lstat'); } }), 'E_IO', 0);
});
test('custody: accessor stat metadata rejects without getter invocation', () => {
  let invoked = false;
  const ctx = memoryContext({ fstat: (s, path, meta) => {
    if (path !== INPUTS.root) Object.defineProperty(meta, 'size', { get() { invoked = true; throw Error(); } });
    return meta;
  } });
  stopped(ctx, 'E_METADATA', 0); assert.equal(invoked, false);
});
test('custody: Proxy stat metadata rejects without traps', () => {
  let invoked = false;
  const ctx = memoryContext({ fstat: (s, path, meta) => path !== INPUTS.root ? new Proxy(meta, {
    getOwnPropertyDescriptor() { invoked = true; throw Error(); },
  }) : meta });
  stopped(ctx, 'E_METADATA', 0); assert.equal(invoked, false);
});
test('custody: leaf close error clears ownership and still closes root', () => {
  const ctx = memoryContext({ close: (s, fd) => { if (fd !== 100) throw Error('close'); } });
  const result = stopped(ctx, 'E_CLOSE', 1);
  assert.deepEqual(ctx.state.closes, [101, 100]); assert.equal(result.closeFailed, true);
  assert.equal(result.cleanupUncertain, true);
});
test('custody: final root close failure withholds every observation', () => {
  const ctx = memoryContext({ close: (s, fd) => { if (fd === 100) throw Error('root close'); } });
  const result = stopped(ctx, 'E_CLOSE', 5); assert.equal(result.counts.closeAttempts, 6);
});
test('custody: deadlines stop work while cleanup still attempts both closes', () => {
  const ctx = memoryContext({ read: s => { s.clock = 4000000000n; return 1040; } });
  const result = stopped(ctx, 'E_DEADLINE', 1);
  assert.equal(result.counts.closeAttempts, 2); assert.equal(result.cleanupUncertain, false);
});
test('custody: synchronous work can exceed total deadline but cleanup still runs', () => {
  const result = stopped(memoryContext({ read: s => { s.clock = 6000000000n; return 1040; } }), 'E_DEADLINE', 1);
  assert.equal(result.cleanupUncertain, true); assert.equal(result.counts.closeAttempts, 2);
});
test('custody: clock exceptions never bypass owned descriptor cleanup', () => {
  const result = stopped(memoryContext({ read: s => { s.throwClock = true; return 1040; } }), 'E_IO', 1);
  assert.equal(result.cleanupUncertain, true); assert.equal(result.counts.closeAttempts, 2);
});
test('custody: backwards clock stops and preserves cleanup', () => {
  stopped(memoryContext({ read: s => { s.clock = -1n; return 1040; } }), 'E_CLOCK', 1);
});
test('custody: invalid flags stop before any root open', () => {
  const result = stopped(memoryContext({ constants: { O_NOFOLLOW: 0 } }), 'E_FLAGS', 0);
  assert.equal(result.counts.openAttempts, 0);
});
test('custody: complete mock dependencies required; real filesystem methods forbidden', () => {
  assert.throws(() => createMockRustXzPrefixes({}), { code: 'E_MOCK_TCB' });
  assert.throws(() => createMockRustXzPrefixes({ fs, now: () => 0n }), { code: 'E_MOCK_TCB' });
  const ctx = memoryContext(); ctx.fake.readSync = fs.readSync;
  assert.throws(() => createMockRustXzPrefixes(ctx.deps), { code: 'E_MOCK_TCB' });
});
test('custody: mock observer takes no input path, metadata, role or URL', () => {
  const ctx = memoryContext(), observer = createMockRustXzPrefixes(ctx.deps);
  assert.throws(() => observer({ path: '/anything' }), { code: 'E_MOCK_TCB' });
  assert.equal(ctx.state.opens.length, 0);
});
test('custody: mock result remains deeply immutable', () => {
  const result = memoryContext().observe();
  for (const value of [result, result.counts, result.observations, result.observations[0],
    result.observations[0].metadata, INPUTS, INPUTS.inputs, ...INPUTS.inputs]) assert.equal(Object.isFrozen(value), true);
});

test('registration: helper, receipt and operation hashes for parent handoff', t => {
  t.diagnostic('helper=' + JSON.stringify({ bytes: source.length, sha256: digest(source) }));
  t.diagnostic('receipt=' + JSON.stringify({ bytes: receiptRaw.length, sha256: digest(receiptRaw) }));
  t.diagnostic('operation=' + JSON.stringify({ bytes: operation.length, sha256: digest(operation) }));
  assert.deepEqual(RUST_XZ_PREFIX_SOURCE_PIN, { bytes: source.length, sha256: digest(source) });
  assert.deepEqual(RUST_XZ_PREFIX_RECEIPT_PIN, { bytes: receiptRaw.length, sha256: digest(receiptRaw) });
});
test('registration: receipt constants match all fixed archived input declarations', () => {
  assert.equal(assertRustXzPrefixReceipt(receiptRaw), true);
  assert.equal(INPUTS.inputs.length, 5); assert.equal(INPUTS.root, receipt.root);
  assert.deepEqual(INPUTS.rootFinal, receipt.rootFinal);
  for (const [index, input] of INPUTS.inputs.entries()) {
    assert.equal(input.expectedWholeSha256, receipt.inputs[index].readbackSha256);
    assert.deepEqual(input.finalMetadata, receipt.inputs[index].finalMetadata);
  }
});
for (const mutate of [
  r => { r.root += '-other'; }, r => { r.rootFinal.ino = '1'; }, r => { r.inputs.pop(); },
  r => { r.inputs[0].name = '../other'; }, r => { r.inputs[0].role = 'other'; },
  r => { r.inputs[0].byteLength++; }, r => { r.inputs[0].incomingSha256 = '0'.repeat(64); },
  r => { r.inputs[0].readbackSha256 = '0'.repeat(64); }, r => { r.inputs[0].verified = false; },
  r => { r.inputs[0].finalMetadata.extra = '1'; }, r => { r.inputs[0].finalMetadata.mode = '33188'; },
  r => { r.nativeQualified = true; },
]) test(`registration: receipt mismatch rejects ${mutate.toString()}`, () => {
  const copy = clone(receipt); mutate(copy);
  assert.throws(() => assertRustXzPrefixReceipt(Buffer.from(JSON.stringify(copy))), { code: 'E_RECEIPT' });
});
test('registration: captured helper and receipt copies do not alias caller buffers', () => {
  const rawSource = Buffer.from(source), rawReceipt = Buffer.from(receiptRaw);
  const capturedSource = captureRegisteredRustXzPrefixSource(rawSource), capturedReceipt = captureRegisteredRustXzPrefixReceipt(rawReceipt);
  rawSource.fill(0); rawReceipt.fill(0);
  assert.equal(digest(capturedSource), RUST_XZ_PREFIX_SOURCE_PIN.sha256);
  assert.equal(digest(capturedReceipt), RUST_XZ_PREFIX_RECEIPT_PIN.sha256);
});
test('registration: byte changes, excessive sources and unsafe views reject pins', () => {
  const changed = Buffer.from(source); changed[100] ^= 1;
  assert.throws(() => captureRegisteredRustXzPrefixSource(changed), { code: 'E_SOURCE_PIN' });
  assert.throws(() => captureRegisteredRustXzPrefixSource(Buffer.alloc(100001)), { code: 'E_SOURCE_PIN' });
  assert.throws(() => captureRegisteredRustXzPrefixSource(new Proxy(source, {})), { code: 'E_SOURCE_PIN' });
  assert.throws(() => captureRegisteredRustXzPrefixSource(Buffer.from(new SharedArrayBuffer(source.length))), { code: 'E_SOURCE_PIN' });
  assert.throws(() => captureRegisteredRustXzPrefixReceipt(Buffer.from('{}')), { code: 'E_RECEIPT_PIN' });
});
test('registration: captured source imports privately without older physical code', async () => {
  const captured = captureRegisteredRustXzPrefixSource(source);
  const helper = await import('data:text/javascript;base64,' + captured.toString('base64'));
  assert.deepEqual(helper.RUST_XZ_PREFIX_INPUTS, INPUTS);
  assert.equal(helper.inspectXzPrefix(prefix()).prefixSha256, digest(prefix()));
  assert.equal(helper.assertRustXzPrefixReceipt(captureRegisteredRustXzPrefixReceipt(receiptRaw)), true);
});
test('registration: closed source graph and zero-argument operation', () => {
  assert.equal(runRegisteredRustXzPrefixes.length, 0);
  for (const bytes of [source, operation]) {
    const text = bytes.toString();
    const imports = [...text.matchAll(/from '([^']+)'/g)].map(match => match[1]);
    assert.deepEqual(imports, ['node:fs', 'node:crypto', 'node:util']);
    assert.doesNotMatch(text, /node:(?:child_process|https?|os|worker_threads)|\b(?:spawn|execSync|writeFileSync|unlinkSync|mkdirSync|setTimeout|setInterval)\s*\(/);
  }
  const text = operation.toString();
  assert.doesNotMatch(text, /readFileSync/);
  assert.ok(text.indexOf('const capturedSource = readFixed(0), capturedReceipt = readFixed(1)') < text.indexOf('await deps.importSource(capturedSource)'));
  assert.ok(text.indexOf('helper.assertRustXzPrefixReceipt(capturedReceipt)') < text.indexOf('helper.observeRegisteredRustXzPrefixes(started)'));
  assert.match(text, /run\(PRODUCTION, false, arguments\.length\)/);
  assert.match(text, /requireThat\(argumentCount === 0, 'E_ARGUMENTS'\)/);
});
test('registration: original acquisition source byte hashes remain unchanged', () => {
  for (const [name, length, sha] of [
    ['rust-runtime-input-acquisition.mjs', receipt.registration.helperBytes, receipt.registration.helperSha256],
    ['rust-runtime-input-acquisition-operation.mjs', receipt.registration.operationBytes, receipt.registration.operationSha256],
  ]) {
    const bytes = fs.readFileSync(new URL('./' + name, import.meta.url));
    assert.equal(bytes.length, length); assert.equal(digest(bytes), sha);
  }
});

const SOURCE_PATH = '/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/rust-xz-prefixes.mjs';
const RECEIPT_PATH = '/tmp/opencode/f9-bootstrap-correspondence/_spec/tooling/native-ingress/rust-runtime-inputs.receipt.json';
function repositoryContext(hooks = {}) {
  const data = new Map([[SOURCE_PATH, Buffer.from(source)], [RECEIPT_PATH, Buffer.from(receiptRaw)]]);
  hooks.data?.(data);
  const state = { live: new Map(), calls: [], opens: [], closes: [], imports: 0, observations: 0,
    clock: 0n, clockThrows: false, nextFd: 500, reads: new Map(), stats: new Map() };
  const result = hooks.result ?? memoryContext().observe();
  const fake = {
    constants: { ...fs.constants, ...hooks.constants },
    openSync(path, flags) {
      assert.equal(data.has(path), true); assert.equal(state.live.size, 0);
      state.calls.push(['open', path]); state.opens.push({ path, flags });
      hooks.open?.(state, path);
      const fd = state.nextFd++; state.live.set(fd, path); return fd;
    },
    closeSync(fd) {
      assert.equal(state.live.has(fd), true); assert.equal(state.closes.includes(fd), false);
      const path = state.live.get(fd); state.live.delete(fd); state.closes.push(fd); state.calls.push(['close', path]);
      hooks.close?.(state, path);
    },
    fstatSync(fd, options) {
      assert.deepEqual(options, { bigint: true }); assert.equal(state.live.has(fd), true);
      const path = state.live.get(fd); state.calls.push(['fstat', path]);
      state.stats.set(path, (state.stats.get(path) ?? 0) + 1);
      const meta = { dev: 28n, ino: path === SOURCE_PATH ? 1001n : 1002n, mode: 0o100644n,
        uid: 1000n, gid: 1000n, nlink: 1n, size: BigInt(data.get(path).length), mtimeNs: 7n, ctimeNs: 8n };
      return hooks.fstat?.(state, path, meta) ?? meta;
    },
    lstatSync(path, options) {
      assert.deepEqual(options, { bigint: true }); assert.equal(data.has(path), true);
      state.calls.push(['lstat', path]);
      const meta = { dev: 28n, ino: path === SOURCE_PATH ? 1001n : 1002n, mode: 0o100644n,
        uid: 1000n, gid: 1000n, nlink: 1n, size: BigInt(data.get(path).length), mtimeNs: 7n, ctimeNs: 8n };
      return hooks.lstat?.(state, path, meta) ?? meta;
    },
    readSync(fd, target, offset, length, position) {
      assert.equal(state.live.has(fd), true);
      const path = state.live.get(fd), saved = data.get(path);
      assert.ok(Buffer.isBuffer(target)); assert.equal(target.length, saved.length + 1);
      assert.equal(offset, position); assert.ok(length > 0 && length <= 65536);
      assert.ok(position <= saved.length); assert.ok(offset + length <= target.length);
      state.calls.push(['read', path, position, length]); state.reads.set(path, (state.reads.get(path) ?? 0) + 1);
      const n = saved.copy(target, offset, position, Math.min(saved.length, position + length));
      return hooks.read?.(state, path, target, position, length, n) ?? n;
    },
  };
  const deps = { fs: fake, now: () => {
    if (state.clockThrows) throw Error('mock clock');
    return state.clock;
  }, importSource: async captured => {
    assert.equal(state.live.size, 0); assert.equal(digest(captured), digest(source));
    state.calls.push(['import']); state.imports++;
    hooks.import?.(state);
    return {
      assertRustXzPrefixReceipt(bytes) {
        assert.equal(state.live.size, 0); state.calls.push(['receiptParse']);
        if (hooks.receiptReject) return false;
        return assertRustXzPrefixReceipt(bytes);
      },
      observeRegisteredRustXzPrefixes(started) {
        assert.equal(state.live.size, 0); assert.equal(started, 0n);
        state.observations++; state.calls.push(['observe']);
        hooks.observe?.(state);
        return result;
      },
    };
  } };
  return { state, deps, async run(...args) {
    const returned = await createMockRustXzPrefixesOperation(deps)(...args);
    return { ...returned, output: JSON.parse(returned.text) };
  } };
}
async function repositoryStopped(ctx, expected) {
  const returned = await ctx.run(), output = returned.output;
  assert.equal(returned.exitCode, 1); assert.equal(output.status, 'STOP');
  if (expected) assert.equal(output.error, expected);
  assert.equal(output.observationValidationPassed, false);
  assert.ok(output.result === null || output.result.observations.length === 0);
  assert.equal(ctx.state.live.size, 0);
  assert.equal(new Set(ctx.state.closes).size, ctx.state.closes.length);
  return output;
}

test('repository: fixed bounded source and receipt captures close before import and JSON parsing', async () => {
  const ctx = repositoryContext(), { output, exitCode, text } = await ctx.run();
  assert.equal(exitCode, 0); assert.equal(output.status, 'RUST_XZ_PREFIXES_OBSERVED'); assert.equal(output.mockOnly, true);
  assert.equal(output.counts.repositoryPeakOwnedFds, 1);
  assert.equal(output.counts.sourceImports, 1); assert.equal(output.counts.observationCalls, 1);
  assert.equal(output.observationReturned, true); assert.equal(output.observationAccountingComplete, true);
  assert.equal(output.observationCountersLowerBounds, false); assert.equal(output.observationValidationPassed, true);
  assert.equal(output.receiptDeclarationMatched, true);
  for (const [record, pin] of [[output.sourcePhase, RUST_XZ_PREFIX_SOURCE_PIN], [output.receiptPhase, RUST_XZ_PREFIX_RECEIPT_PIN]]) {
    assert.equal(record.pinValidated, true); assert.equal(record.closed, true);
    assert.equal(record.ioAccountingComplete, true);
    assert.deepEqual([record.counts.openAttempts, record.counts.opens, record.counts.closeAttempts, record.counts.closes], [1, 1, 1, 1]);
    assert.deepEqual([record.counts.readAttempts, record.counts.reads, record.counts.requestedBytes,
      record.counts.returnedBytes, record.counts.positiveReadBytes, record.counts.allocatedBytes], [2, 2, pin.bytes + 1, pin.bytes, pin.bytes, pin.bytes + 1]);
  }
  assert.equal(output.sourcePhase.counts.fsOperations + output.receiptPhase.counts.fsOperations, 16);
  assert.equal(output.sourcePhase.counts.fsOperations + output.receiptPhase.counts.fsOperations + output.result.counts.fsOperations, 77);
  assert.equal(output.result.counts.opens, 6); assert.equal(output.result.counts.closes, 6);
  assert.equal(output.result.counts.requestedPrefixBytes, 5200); assert.equal(output.result.eofProbed, false);
  assert.deepEqual(ctx.state.calls.filter(call => ['open', 'close', 'import', 'receiptParse', 'observe'].includes(call[0])), [
    ['open', SOURCE_PATH], ['close', SOURCE_PATH], ['open', RECEIPT_PATH], ['close', RECEIPT_PATH], ['import'], ['receiptParse'], ['observe'],
  ]);
  for (const item of ctx.state.opens) assert.equal(item.flags, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  assert.match(text, /^[\x20-\x7e]*\n$/); assert.ok(Buffer.byteLength(text) <= 16384);
});
for (const path of [SOURCE_PATH, RECEIPT_PATH]) test(`repository: oversized ${path} rejects before payload allocation/read/import`, async () => {
  const ctx = repositoryContext({ fstat: (s, name, meta) => name === path ? { ...meta, size: 100001n } : meta });
  const output = await repositoryStopped(ctx, 'E_SOURCE_LENGTH'), record = path === SOURCE_PATH ? output.sourcePhase : output.receiptPhase;
  assert.equal(record.counts.allocations, 0); assert.equal(record.counts.readAttempts, 0);
  assert.equal(record.counts.closeAttempts, 1); assert.equal(record.pinValidated, false);
  assert.equal(ctx.state.imports, 0); assert.equal(ctx.state.observations, 0);
});
test('repository: invalid regular-file type rejects before allocation or read', async () => {
  const ctx = repositoryContext({ fstat: (s, path, meta) => ({ ...meta, mode: 0o040755n }) });
  const output = await repositoryStopped(ctx, 'E_SOURCE_LENGTH');
  assert.equal(output.sourcePhase.counts.allocations, 0); assert.equal(output.sourcePhase.counts.reads, 0);
});
for (const key of ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']) {
  test(`repository: named source ${key} mismatch rejects before read`, async () => {
    const ctx = repositoryContext({ lstat: (s, path, meta) => path === SOURCE_PATH ? { ...meta, [key]: meta[key] + 1n } : meta });
    const output = await repositoryStopped(ctx, 'E_BINDING');
    assert.equal(output.sourcePhase.counts.allocations, 0); assert.equal(ctx.state.imports, 0);
    assert.equal(output.sourceAccountingComplete, true); assert.equal(output.sourceCountersLowerBounds, false);
    assert.equal(output.sourcePhase.pinValidated, false);
  });
}
test('repository: changed FD identity after source reads withholds source import', async () => {
  const ctx = repositoryContext({ fstat: (s, path, meta) => path === SOURCE_PATH && s.reads.has(path) ? { ...meta, ino: meta.ino + 1n } : meta });
  const output = await repositoryStopped(ctx, 'E_BINDING');
  assert.equal(output.sourcePhase.counts.positiveReadBytes, source.length); assert.equal(ctx.state.imports, 0);
});
test('repository: changed named receipt identity after reads withholds import and JSON', async () => {
  const ctx = repositoryContext({ lstat: (s, path, meta) => path === RECEIPT_PATH && s.reads.has(path) ? { ...meta, nlink: 2n } : meta });
  const output = await repositoryStopped(ctx, 'E_BINDING');
  assert.equal(output.receiptPhase.counts.positiveReadBytes, receiptRaw.length); assert.equal(ctx.state.imports, 0);
});
test('repository: short source read fails closed without retry', async () => {
  const ctx = repositoryContext({ read: (s, path, target, position, length, n) => n > 0 ? n - 1 : n });
  const output = await repositoryStopped(ctx, 'E_SOURCE_LENGTH');
  assert.equal(output.sourcePhase.counts.readAttempts, 1);
  assert.equal(output.sourcePhase.counts.positiveReadBytes, source.length - 1);
  assert.equal(output.sourceAccountingComplete, true); assert.equal(ctx.state.imports, 0);
});
test('repository: premature zero-length read rejects without false EOF success', async () => {
  const ctx = repositoryContext({ read: () => 0 });
  const output = await repositoryStopped(ctx, 'E_SOURCE_LENGTH');
  assert.equal(output.sourcePhase.counts.positiveReadBytes, 0); assert.equal(output.sourcePhase.counts.readAttempts, 1);
});
test('repository: source grows one byte beyond size admission and fails extra-byte EOF check', async () => {
  const ctx = repositoryContext({ read: (s, path, target, position, length, n) => {
    if (path === SOURCE_PATH && position === source.length) { target[position] = 1; return 1; }
    return n;
  } });
  const output = await repositoryStopped(ctx, 'E_SOURCE_LENGTH');
  assert.equal(output.sourcePhase.counts.positiveReadBytes, source.length + 1);
  assert.equal(output.sourcePhase.counts.requestedBytes, source.length + 1); assert.equal(ctx.state.imports, 0);
});
test('repository: invalid read return type marks counters as lower bounds', async () => {
  const output = await repositoryStopped(repositoryContext({ read: () => '1' }), 'E_IO');
  assert.equal(output.sourcePhase.ioAccountingComplete, false); assert.equal(output.sourceCountersLowerBounds, true);
  assert.equal(output.sourcePhase.counts.positiveReadBytes, 0); assert.equal(output.sourcePhase.counts.reads, 0);
});
test('repository: throwing read preserves attempted request counters and closes once', async () => {
  const output = await repositoryStopped(repositoryContext({ read: () => { throw Error('read'); } }), 'E_IO');
  assert.equal(output.sourcePhase.counts.readAttempts, 1); assert.equal(output.sourcePhase.counts.requestedBytes, source.length);
  assert.equal(output.sourcePhase.counts.reads, 0); assert.equal(output.sourcePhase.counts.closeAttempts, 1);
  assert.equal(output.sourceCountersLowerBounds, true);
});
test('repository: throwing stat marks source counters lower bounds and still closes', async () => {
  const output = await repositoryStopped(repositoryContext({ fstat: () => { throw Error('stat'); } }), 'E_IO');
  assert.equal(output.sourceCountersLowerBounds, true); assert.equal(output.sourcePhase.counts.fstatAttempts, 1);
  assert.equal(output.sourcePhase.counts.fstats, 0); assert.equal(output.sourcePhase.counts.closeAttempts, 1);
});
test('repository: missing source counts attempted open without allocating or importing', async () => {
  const ctx = repositoryContext({ open: () => { throw Error('missing'); } });
  const output = await repositoryStopped(ctx, 'E_IO');
  assert.equal(output.sourcePhase.counts.openAttempts, 1); assert.equal(output.sourcePhase.counts.opens, 0);
  assert.equal(output.sourcePhase.counts.closeAttempts, 0); assert.equal(output.sourcePhase.counts.allocations, 0);
  assert.equal(output.sourceCountersLowerBounds, true); assert.equal(ctx.state.imports, 0);
});
test('repository: failed named stat preserves counters and closes the opened source', async () => {
  const ctx = repositoryContext({ lstat: () => { throw Error('named stat'); } });
  const output = await repositoryStopped(ctx, 'E_IO');
  assert.equal(output.sourcePhase.counts.namedStatAttempts, 1); assert.equal(output.sourcePhase.counts.namedStats, 0);
  assert.equal(output.sourcePhase.counts.closeAttempts, 1); assert.equal(output.sourceCountersLowerBounds, true);
});
test('repository: invalid source flags stop before opening a repository file', async () => {
  const ctx = repositoryContext({ constants: { O_NONBLOCK: 0 } });
  const output = await repositoryStopped(ctx, 'E_FLAGS');
  assert.equal(output.sourcePhase.counts.openAttempts, 0); assert.equal(ctx.state.opens.length, 0);
});
test('repository: receipt extra byte rejects without importing the source', async () => {
  const ctx = repositoryContext({ read: (s, path, target, position, length, n) => {
    if (path === RECEIPT_PATH && position === receiptRaw.length) { target[position] = 1; return 1; }
    return n;
  } });
  const output = await repositoryStopped(ctx, 'E_SOURCE_LENGTH');
  assert.equal(output.receiptPhase.counts.positiveReadBytes, receiptRaw.length + 1);
  assert.equal(output.receiptPhase.counts.closes, 1); assert.equal(ctx.state.imports, 0);
});
test('repository: metadata getter rejects without invocation, with completed-call accounting', async () => {
  let invoked = false;
  const ctx = repositoryContext({ fstat: (s, path, meta) => {
    Object.defineProperty(meta, 'size', { get() { invoked = true; throw Error(); } }); return meta;
  } });
  const output = await repositoryStopped(ctx, 'E_METADATA');
  assert.equal(invoked, false); assert.equal(output.sourceAccountingComplete, true);
  assert.equal(output.sourcePhase.pinValidated, false);
});
for (const path of [SOURCE_PATH, RECEIPT_PATH]) test(`repository: ${path} close failure absorbs success before import`, async () => {
  const ctx = repositoryContext({ close: (s, name) => { if (name === path) throw Error('close'); } });
  const output = await repositoryStopped(ctx, 'E_CLOSE'), record = path === SOURCE_PATH ? output.sourcePhase : output.receiptPhase;
  assert.equal(record.counts.closeAttempts, 1); assert.equal(record.counts.closes, 0);
  assert.equal(record.closeFailed, true); assert.equal(record.cleanupUncertain, true);
  assert.equal(record.ioAccountingComplete, false); assert.equal(record.pinValidated, false);
  assert.equal(ctx.state.imports, 0); assert.equal(ctx.state.observations, 0);
  assert.equal(path === SOURCE_PATH ? output.sourceCountersLowerBounds : output.receiptCountersLowerBounds, true);
});
test('repository: deadline after open still closes owned FD without reading', async () => {
  const ctx = repositoryContext({ open: s => { s.clock = 4000000000n; } });
  const output = await repositoryStopped(ctx, 'E_DEADLINE');
  assert.equal(output.sourcePhase.counts.closeAttempts, 1); assert.equal(output.sourcePhase.counts.readAttempts, 0);
  assert.equal(output.sourcePhase.cleanupUncertain, false); assert.equal(output.sourceAccountingComplete, true);
});
test('repository: expired cleanup budget never skips descriptor close', async () => {
  const ctx = repositoryContext({ read: (s, path, target, position, length, n) => { s.clock = 6000000000n; return n; } });
  const output = await repositoryStopped(ctx, 'E_DEADLINE');
  assert.equal(output.sourcePhase.counts.closeAttempts, 1); assert.equal(output.sourcePhase.cleanupUncertain, true);
  assert.equal(output.sourceCountersLowerBounds, true);
});
test('repository: broken cleanup clock never skips descriptor close', async () => {
  const ctx = repositoryContext({ read: (s, path, target, position, length, n) => { s.clockThrows = true; return n; } });
  const output = await repositoryStopped(ctx, 'E_IO');
  assert.equal(output.sourcePhase.counts.closeAttempts, 1); assert.equal(output.sourcePhase.cleanupUncertain, true);
});
test('repository: original clock origin reaches prefix helper after both captures', async () => {
  const ctx = repositoryContext({ read: (s, path, target, position, length, n) => { s.clock += 100000000n; return n; } });
  const { output } = await ctx.run();
  assert.equal(output.status, 'RUST_XZ_PREFIXES_OBSERVED'); assert.equal(ctx.state.clock, 400000000n);
  assert.equal(ctx.state.observations, 1);
});
test('repository: altered fixed source hash rejects after bounded capture and close', async () => {
  const ctx = repositoryContext({ data: data => { data.get(SOURCE_PATH)[100] ^= 1; } });
  const output = await repositoryStopped(ctx, 'E_SOURCE_PIN');
  assert.equal(output.sourceAccountingComplete, true); assert.equal(output.sourcePhase.closed, true);
  assert.equal(output.sourcePhase.pinValidated, false); assert.equal(ctx.state.imports, 0);
});
test('repository: receipt declaration rejection is not a counter incompleteness claim', async () => {
  const ctx = repositoryContext({ receiptReject: true }), output = await repositoryStopped(ctx, 'E_RECEIPT');
  assert.equal(output.sourceAccountingComplete, true); assert.equal(output.receiptAccountingComplete, true);
  assert.equal(output.receiptDeclarationMatched, false); assert.equal(output.observationReturned, false);
  assert.equal(output.observationAccountingComplete, false); assert.equal(ctx.state.observations, 0);
});
test('repository: throwing helper has no returned-envelope accounting', async () => {
  const ctx = repositoryContext({ observe: () => { throw Error('helper'); } });
  const output = await repositoryStopped(ctx, 'E_IO');
  assert.equal(output.observationReturned, false); assert.equal(output.observationAccountingComplete, false);
  assert.equal(output.observationCountersLowerBounds, true);
});
test('repository: no arbitrary arguments or real filesystem methods in mock TCB', async () => {
  const ctx = repositoryContext(), returned = await ctx.run({ path: '/ignored' });
  assert.equal(returned.output.error, 'E_ARGUMENTS'); assert.equal(ctx.state.opens.length, 0);
  assert.throws(() => createMockRustXzPrefixesOperation({}), { code: 'E_MOCK_TCB' });
  assert.throws(() => createMockRustXzPrefixesOperation({ ...ctx.deps, fs }), { code: 'E_MOCK_TCB' });
  ctx.deps.fs.readSync = fs.readSync;
  assert.throws(() => createMockRustXzPrefixesOperation(ctx.deps), { code: 'E_MOCK_TCB' });
});

function stoppedEnvelope(overrides = {}) {
  return { profile: 'registered-rust-xz-prefix-declarations-v1', status: 'STOP', error: 'E_BINDING', mockOnly: true,
    observations: [], ioAccountingComplete: true, closeFailed: false, cleanupUncertain: false, ...overrides };
}
for (const [label, overrides, complete] of [
  ['known complete validation STOP', {}, true],
  ['returned STOP with incomplete I/O', { ioAccountingComplete: false }, false],
  ['returned STOP with close failure', { closeFailed: true }, false],
  ['returned STOP with cleanup uncertainty', { cleanupUncertain: true }, false],
]) test(`accounting: ${label} never claims validation success`, async () => {
  const result = stoppedEnvelope(overrides), accounting = inspectRustXzPrefixObservationAccounting(result);
  assert.equal(accounting.observationAccountingComplete, complete);
  assert.equal(accounting.observationCountersLowerBounds, !complete); assert.equal(accounting.observationValidationPassed, false);
  const output = await repositoryStopped(repositoryContext({ result }), 'E_BINDING');
  assert.equal(output.observationReturned, true); assert.equal(output.observationAccountingComplete, complete);
  assert.equal(output.observationCountersLowerBounds, !complete); assert.equal(output.status, 'STOP');
});
test('accounting: observed status cannot override incomplete I/O into success', async () => {
  const result = clone(memoryContext().observe()); result.ioAccountingComplete = false;
  const output = await repositoryStopped(repositoryContext({ result }), 'E_ACCOUNTING');
  assert.deepEqual(output.result.observations, []); assert.equal(output.observationAccountingComplete, false);
});
test('accounting: STOP with nonempty provisional observations suppresses them', async () => {
  const output = await repositoryStopped(repositoryContext({ result: stoppedEnvelope({ observations: [{ provisional: true }] }) }), 'E_BINDING');
  assert.deepEqual(output.result.observations, []); assert.equal(output.observationAccountingComplete, true);
});
for (const overrides of [{ ioAccountingComplete: 'true' }, { closeFailed: 0 }, { cleanupUncertain: null },
  { error: '' }, { error: null }, { profile: 'other' }]) test(`accounting: rejects malformed typed envelope ${JSON.stringify(overrides)}`, () => {
  assert.throws(() => inspectRustXzPrefixObservationAccounting(stoppedEnvelope(overrides)), { code: 'E_RESULT' });
});
test('accounting: own-data envelope rejects getters and proxies without invoking them', async () => {
  let invoked = false;
  const result = stoppedEnvelope();
  Object.defineProperty(result, 'ioAccountingComplete', { enumerable: true, get() { invoked = true; throw Error(); } });
  assert.throws(() => inspectRustXzPrefixObservationAccounting(result), { code: 'E_RESULT' });
  assert.throws(() => inspectRustXzPrefixObservationAccounting(new Proxy(stoppedEnvelope(), {
    ownKeys() { invoked = true; throw Error(); },
  })), { code: 'E_RESULT' });
  const output = await repositoryStopped(repositoryContext({ result }), 'E_RESULT');
  assert.equal(invoked, false); assert.equal(output.observationReturned, true);
  assert.equal(output.observationAccountingComplete, false);
});
test('registration: raw capture rejects resizable backing stores and own accessor lengths', () => {
  if (Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')) {
    const backing = new ArrayBuffer(source.length, { maxByteLength: source.length + 1 });
    new Uint8Array(backing).set(source);
    assert.throws(() => captureRegisteredRustXzPrefixSource(Buffer.from(backing)), { code: 'E_SOURCE_PIN' });
  }
  const raw = Buffer.from(source); let invoked = false;
  Object.defineProperty(raw, 'length', { get() { invoked = true; throw Error(); } });
  assert.throws(() => captureRegisteredRustXzPrefixSource(raw), { code: 'E_SOURCE_PIN' });
  assert.equal(invoked, false);
});
