// SPEC: _spec/tooling/native-ingress/deb-members.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import zlib from 'node:zlib';
import { compareDebMembers, DebMemberError, DEB_MEMBER_LIMITS } from './deb-members.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const path = 'usr/share/doc/readme';
const abcSha = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const expected = [{ path, byteLength: 3, sha256: abcSha }];

function tarHeader(name = path, size = 3, type = '0', link = '') {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100);
  for (const [offset, width, value] of [[100, 8, 420], [108, 8, 0], [116, 8, 0], [124, 12, size], [136, 12, 0]]) {
    header.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  }
  header[156] = type.charCodeAt(0);
  header.write(link, 157, 100);
  header.write('ustar\0', 257, 6);
  header.write('00', 263, 2);
  header.fill(32, 148, 156);
  header.write(header.reduce((a, b) => a + b, 0).toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return header;
}

function tarMember(name = path, body = Buffer.from('abc'), type = '0', link = '') {
  return Buffer.concat([tarHeader(name, body.length, type, link), body, Buffer.alloc((512 - body.length % 512) % 512)]);
}

const tar = (...members) => Buffer.concat([...members, Buffer.alloc(1024)]);
const basicTar = () => tar(tarMember());

function arMember(name, body, slash = true) {
  const header = Buffer.alloc(60, 32);
  header.write(name + (slash ? '/' : ''), 0, 16, 'ascii');
  header.write('0', 16);
  header.write('0', 28);
  header.write('0', 34);
  header.write('100644', 40);
  header.write(String(body.length), 48, 10, 'ascii');
  header.write('`\n', 58, 2);
  return Buffer.concat([header, body, body.length % 2 ? Buffer.from('\n') : Buffer.alloc(0)]);
}

function debWithData(data, name = 'data.tar.gz', controlName = 'control.tar.xz', control = Buffer.from('inert')) {
  return Buffer.concat([Buffer.from('!<arch>\n'), arMember('debian-binary', Buffer.from('2.0\n')),
    arMember(controlName, control), arMember(name, data)]);
}

function deb(bytes = basicTar(), kind = 'gzip') {
  return debWithData(kind === 'gzip' ? zlib.gzipSync(bytes) : zlib.zstdCompressSync(bytes), kind === 'gzip' ? 'data.tar.gz' : 'data.tar.zst');
}

const ref = bytes => ({ byteLength: bytes.length, sha256: sha(bytes) });
const compare = (bytes, targets = expected, overrides = {}) => compareDebMembers(bytes, ref(bytes), targets, overrides);

function rejects(bytes, code, targets = expected, overrides = {}) {
  assert.throws(() => compare(bytes, targets, overrides), error => {
    assert.ok(error instanceof DebMemberError);
    assert.equal(error.message, code);
    assert.equal(error.code, code);
    assert.equal(Object.isFrozen(error), true);
    assert.equal(Object.hasOwn(error, 'cause'), false);
    return true;
  });
}

function deepData(value) {
  if (value && typeof value === 'object') {
    assert.equal(Object.isFrozen(value), true);
    assert.equal(ArrayBuffer.isView(value), false);
    for (const item of Object.values(value)) deepData(item);
  } else assert.ok(['string', 'number', 'boolean'].includes(typeof value));
}

function pax(key, value) {
  const body = ` ${key}=${value}\n`;
  let length = Buffer.byteLength(body) + 1;
  while (String(length).length + Buffer.byteLength(body) !== length) length = String(length).length + Buffer.byteLength(body);
  return Buffer.from(String(length) + body);
}

function rawZstd(bytes, { unknown = false, dictionary = false, wd = 8 } = {}) {
  const descriptor = unknown ? (dictionary ? 1 : 0) : 96;
  const prefix = [Buffer.from([0x28, 0xb5, 0x2f, 0xfd, descriptor])];
  if (unknown) prefix.push(Buffer.from([wd]));
  if (dictionary) prefix.push(Buffer.from([0]));
  if (!unknown) {
    const size = Buffer.alloc(2);
    size.writeUInt16LE(bytes.length - 256);
    prefix.push(size);
  }
  const block = Buffer.alloc(3);
  block.writeUIntLE((bytes.length << 3) | 1, 0, 3);
  return Buffer.concat([...prefix, block, bytes]);
}

for (const kind of ['gzip', 'zstd']) {
  test(`${kind} compares independently expected literal payload hash and publishes frozen data only`, () => {
    const bytes = deb(basicTar(), kind);
    const result = compare(bytes);
    assert.equal(result.profile, 'deb-data-members-v1');
    assert.equal(result.state, 'DEB_MEMBER_COMPARISON');
    assert.deepEqual(result.packageRef, ref(bytes));
    assert.equal(result.packageBytesMatched, true);
    assert.deepEqual(result.memberMatches, [{ ...expected[0], matched: true }]);
    assert.equal(result.dataCompression, kind);
    assert.equal(result.decompressedBytes, 2048);
    assert.equal(result.tarSummary.entries, 1);
    assert.equal(result.tarSummary.headers, 1);
    assert.match(result.tarSummary.metadataSha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(result.arMemberNames, ['debian-binary', 'control.tar.xz', `data.tar.${kind === 'gzip' ? 'gz' : 'zst'}`]);
    for (const flag of ['archiveSignatureVerified', 'provenanceVerified', 'sourceAuthenticated', 'pythonFreeSubsetVerified',
      'nativeQualified', 'decoderQualified', 'extractionAuthorized', 'maintainerScriptsExecuted', 'fileWritesPerformed',
      'runtimeInvoked', 'installedUsability', 'rustReady', 'trainingReady']) assert.equal(result[flag], false);
    assert.equal(Object.hasOwn(result, 'fileSpans'), false);
    assert.equal(Object.hasOwn(result.tarSummary, 'fileSpans'), false);
    deepData(result);
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 65536);
  });
}

for (const name of ['control.tar.gz', 'control.tar.zst', 'control.tar.xz']) {
  test(`${name} stays inert even when not a compressed stream`, () => {
    assert.equal(compare(debWithData(zlib.gzipSync(basicTar()), 'data.tar.gz', name, Buffer.from('not compressed'))).packageBytesMatched, true);
  });
}

test('package length and digest mismatch stop before decompression', t => {
  let calls = 0;
  t.mock.method(zlib, 'gunzipSync', () => { calls++; throw new Error('private'); });
  t.mock.method(zlib, 'zstdDecompressSync', () => { calls++; throw new Error('private'); });
  const bytes = debWithData(Buffer.from('unread'), 'data.tar.zst');
  for (const bad of [{ ...ref(bytes), byteLength: bytes.length - 1 }, { ...ref(bytes), sha256: '0'.repeat(64) }]) {
    assert.throws(() => compareDebMembers(bytes, bad, expected), { code: 'E_PACKAGE' });
  }
  assert.equal(calls, 0);
});

test('whole private snapshot survives caller mutation at decompression', t => {
  const bytes = deb();
  const originalRef = ref(bytes);
  const original = zlib.gunzipSync;
  t.mock.method(zlib, 'gunzipSync', (input, options) => { bytes.fill(255); return original(input, options); });
  const result = compareDebMembers(bytes, originalRef, expected);
  assert.deepEqual(result.packageRef, originalRef);
  assert.equal(result.memberMatches[0].sha256, abcSha);
});

test('native typed intrinsics ignore getters and poisoned prototype traps', () => {
  const bytes = deb();
  const backing = new Uint8Array(bytes.length + 20);
  backing.set(bytes, 10);
  const view = backing.subarray(10, -10);
  const expectedRef = ref(bytes);
  let traps = 0;
  for (const key of ['length', 'buffer', 'byteOffset']) Object.defineProperty(view, key, { get() { traps++; throw new Error('private'); } });
  Object.setPrototypeOf(view, new Proxy({}, { get() { traps++; throw new Error('private'); }, getPrototypeOf() { traps++; throw new Error('private'); } }));
  assert.equal(compareDebMembers(view, expectedRef, expected).packageBytesMatched, true);
  assert.equal(traps, 0);
});

for (const [label, input] of [
  ['string', 'private'], ['null', null], ['array', [1]], ['empty', Buffer.alloc(0)], ['short', Buffer.alloc(7)],
  ['data view', new DataView(new ArrayBuffer(10))], ['uint16', new Uint16Array(10)],
  ['proxy', new Proxy(new Uint8Array(10), {})], ['shared', new Uint8Array(new SharedArrayBuffer(10))],
  ['resizable', new Uint8Array(new ArrayBuffer(10, { maxByteLength: 20 }))],
]) {
  test(`rejects ${label} input with fixed error`, () => {
    assert.throws(() => compareDebMembers(input, { byteLength: 10, sha256: '0'.repeat(64) }, expected), { code: 'E_INPUT' });
  });
}

test('detached and revoked input fail without exposing traps', () => {
  const bytes = new Uint8Array(10);
  structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
  assert.throws(() => compareDebMembers(bytes, { byteLength: 10, sha256: '0'.repeat(64) }, expected), { code: 'E_INPUT' });
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  assert.throws(() => compareDebMembers(proxy, { byteLength: 10, sha256: '0'.repeat(64) }, expected), { code: 'E_INPUT' });
});

for (const [label, value] of [
  ['null', null], ['array', []], ['inherited', Object.create({ byteLength: 0, sha256: '0'.repeat(64) })],
  ['proxy', new Proxy({}, {})], ['extra', { byteLength: 0, sha256: '0'.repeat(64), extra: 1 }],
  ['accessor', Object.defineProperty({ sha256: '0'.repeat(64) }, 'byteLength', { get() { throw new Error('private'); } })],
  ['uppercase', { byteLength: 0, sha256: 'A'.repeat(64) }], ['newline hash', { byteLength: 0, sha256: '0'.repeat(64) + '\n' }],
  ['short hash', { byteLength: 0, sha256: '0' }], ['object hash', { byteLength: 0, sha256: {} }],
  ['negative', { byteLength: -1, sha256: '0'.repeat(64) }], ['fraction', { byteLength: 0.5, sha256: '0'.repeat(64) }],
  ['too large', { byteLength: 8_388_609, sha256: '0'.repeat(64) }], ['symbol', { byteLength: 0, sha256: '0'.repeat(64), [Symbol()]: 0 }],
]) {
  test(`strict package reference rejects ${label}`, () => assert.throws(() => compareDebMembers(deb(), value, expected), { code: 'E_REFERENCE' }));
}

for (const [label, value] of [
  ['null', null], ['object', {}], ['empty', []], ['too many', Array(9).fill(expected[0])],
  ['sparse', Array(1)], ['proxy', new Proxy(expected, {})], ['extra', Object.assign([...expected], { extra: 1 })],
  ['record extra', [{ ...expected[0], extra: 1 }]], ['record inherited', [Object.create(expected[0])]],
  ['record proxy', [new Proxy(expected[0], {})]], ['record accessor', [Object.defineProperty({ ...expected[0] }, 'path', { get() { throw new Error('private'); } })]],
  ['array accessor', Object.defineProperty([], '0', { get() { throw new Error('private'); } })],
  ['duplicate', [expected[0], expected[0]]], ['size negative', [{ ...expected[0], byteLength: -1 }]],
  ['size too large', [{ ...expected[0], byteLength: 8_388_609 }]], ['bad hash', [{ ...expected[0], sha256: 'A'.repeat(64) }]],
]) {
  test(`strict targets reject ${label}`, () => rejects(deb(), 'E_TARGETS', value));
}

for (const name of ['', '/a', './a', '../a', 'a/../b', 'a/./b', 'a//b', 'a/', 'C:a', 'a\\b', 'a\0b', 'a\nb', 'a\u0085b', '\ud800', 'a'.repeat(1025)]) {
  test(`target path rejects ${JSON.stringify(name)}`, () => rejects(deb(), 'E_TARGETS', [{ ...expected[0], path: name }]));
}

for (const [label, value] of [
  ['null', null], ['array', []], ['inherited', Object.create({ maxTargets: 1 })], ['proxy', new Proxy({}, {})],
  ['unknown', { extra: 1 }], ['symbol', { [Symbol()]: 1 }], ['accessor', Object.defineProperty({}, 'maxTargets', { get() { throw new Error('private'); } })],
  ['zero', { maxTargets: 0 }], ['negative', { maxTargets: -1 }], ['fraction', { maxTargets: 1.5 }],
  ['NaN', { maxTargets: NaN }], ['infinity', { maxTargets: Infinity }], ['string', { maxTargets: '1' }], ['bigint', { maxTargets: 1n }],
]) {
  test(`strict limits reject ${label}`, () => rejects(deb(), 'E_LIMITS', expected, value));
}

for (const key of Object.keys(DEB_MEMBER_LIMITS)) {
  test(`limit ${key} cannot exceed its root ceiling`, () => rejects(deb(), 'E_LIMITS', expected, { [key]: DEB_MEMBER_LIMITS[key] + 1 }));
}

test('revoked records, arrays and limits reject with fixed errors', () => {
  for (const [value, code, call] of [
    [{}, 'E_REFERENCE', value => compareDebMembers(deb(), value, expected)],
    [[], 'E_TARGETS', value => compare(deb(), value)],
    [{}, 'E_LIMITS', value => compare(deb(), expected, value)],
  ]) {
    const { proxy, revoke } = Proxy.revocable(value, {});
    revoke();
    assert.throws(() => call(proxy), { code });
  }
});

test('null-prototype own records and limits are accepted without retaining caller objects', () => {
  const bytes = deb();
  const descriptor = Object.assign(Object.create(null), ref(bytes));
  const target = Object.assign(Object.create(null), expected[0]);
  const result = compareDebMembers(bytes, descriptor, [target], Object.assign(Object.create(null), { maxTargets: 1 }));
  descriptor.sha256 = '0'.repeat(64);
  target.path = 'changed';
  assert.equal(result.packageRef.sha256, sha(bytes));
  assert.equal(result.memberMatches[0].path, path);
});

test('input cap admits exact size and rejects one byte below before decoding', t => {
  const bytes = deb();
  assert.equal(compare(bytes, expected, { maxInputBytes: bytes.length }).packageBytesMatched, true);
  let calls = 0;
  t.mock.method(zlib, 'gunzipSync', () => { calls++; });
  rejects(bytes, 'E_INPUT', expected, { maxInputBytes: bytes.length - 1 });
  assert.equal(calls, 0);
});

test('output budget measures exact UTF8 JSON and refuses an unpublished result', () => {
  const bytes = deb();
  const size = Buffer.byteLength(JSON.stringify(compare(bytes)));
  assert.equal(compare(bytes, expected, { maxOutputBytes: size }).packageBytesMatched, true);
  rejects(bytes, 'E_OUTPUT', expected, { maxOutputBytes: size - 1 });
});

for (const [label, mutate, code = 'E_AR'] of [
  ['magic', bytes => { bytes[0] = 0; }],
  ['header terminator', bytes => { bytes[66] = 0; }],
  ['version', bytes => { bytes[68] = 51; }],
  ['size negative', bytes => { bytes.write('-1        ', 56); }],
  ['size plus', bytes => { bytes.write('+4        ', 56); }],
  ['size NUL', bytes => { bytes[56] = 0; }],
  ['size junk', bytes => { bytes.write('4x        ', 56); }],
  ['size decimal', bytes => { bytes.write('4.0       ', 56); }],
  ['size tab', bytes => { bytes.write('4\t        ', 56); }],
  ['size LF', bytes => { bytes.write('4        \n', 56); }],
  ['size overflow span', bytes => { bytes.write('9999999999', 56); }],
  ['size empty', bytes => { bytes.fill(32, 56, 66); }],
  ['metadata NUL', bytes => { bytes[24] = 0; }],
  ['metadata signed', bytes => { bytes[24] = 45; }],
  ['mode non-octal', bytes => { bytes.write('100648  ', 48); }],
  ['odd padding', bytes => { bytes[8 + 64 + 60 + 5] = 0; }],
  ['absolute name', bytes => { bytes[8] = 47; }],
  ['double slash', bytes => { bytes.write('debian-binary// ', 8); }],
  ['BSD extended name', bytes => { bytes.write('#1/13           ', 8); }],
  ['GNU string table', bytes => { bytes.write('//              ', 8); }],
  ['GNU symbol table', bytes => { bytes.write('/               ', 8); }],
  ['name control', bytes => { bytes[8] = 10; }],
  ['name high ASCII', bytes => { bytes[8] = 255; }],
  ['unknown name', bytes => { bytes.write('other           ', 8); }, 'E_UNSUPPORTED'],
  ['trailing byte', bytes => Buffer.concat([bytes, Buffer.from([0])])],
  ['truncated last body', bytes => bytes.subarray(0, -2)],
]) {
  test(`AR rejects ${label}`, () => {
    const bytes = deb();
    rejects(mutate(bytes) ?? bytes, code);
  });
}

for (const cut of [8, 9, 30, 67, 68, 71, 72, 73, 100]) {
  test(`AR rejects split or incomplete headers at ${cut}`, () => rejects(deb().subarray(0, cut), 'E_AR'));
}

for (const name of ['data.tar.xz', 'data.tar.br', 'control.tar.gz', 'debian-binary']) {
  test(`AR stops at unsupported or duplicate data member ${name}`, () => rejects(debWithData(Buffer.from('not decoded'), name), 'E_UNSUPPORTED'));
}

test('AR rejects missing, extra and reordered members', () => {
  const binary = arMember('debian-binary', Buffer.from('2.0\n'));
  const control = arMember('control.tar.gz', Buffer.alloc(0));
  const data = arMember('data.tar.gz', zlib.gzipSync(basicTar()));
  rejects(Buffer.concat([Buffer.from('!<arch>\n'), binary, data, control]), 'E_UNSUPPORTED');
  rejects(Buffer.concat([Buffer.from('!<arch>\n'), binary, control]), 'E_AR');
  rejects(Buffer.concat([deb(), arMember('data.tar.gz', Buffer.alloc(0))]), 'E_AR');
  rejects(deb(), 'E_AR', expected, { maxArMembers: 2 });
});

test('AR accepts unadorned simple names and all-space optional metadata', () => {
  const parts = [['debian-binary', Buffer.from('2.0\n')], ['control.tar.xz', Buffer.alloc(0)], ['data.tar.gz', zlib.gzipSync(basicTar())]]
    .map(([name, body]) => { const bytes = arMember(name, body, false); bytes.fill(32, 16, 48); return bytes; });
  assert.equal(compare(Buffer.concat([Buffer.from('!<arch>\n'), ...parts])).packageBytesMatched, true);
});

test('AR caps every member before selecting the data payload', () => {
  const gzip = zlib.gzipSync(basicTar());
  const bytes = debWithData(gzip);
  assert.equal(compare(bytes, expected, { maxCompressedMemberBytes: gzip.length }).packageBytesMatched, true);
  rejects(bytes, 'E_AR', expected, { maxCompressedMemberBytes: gzip.length - 1 });
  rejects(debWithData(gzip, 'data.tar.gz', 'control.tar.xz', Buffer.alloc(gzip.length + 1)), 'E_AR', expected, { maxCompressedMemberBytes: gzip.length });
  rejects(bytes, 'E_AR', expected, { maxCompressedMemberBytes: 3 });
});

for (const [label, mutate, code = 'E_DECOMPRESS'] of [
  ['magic', bytes => { bytes[0] = 0; }, 'E_UNSUPPORTED'],
  ['method', bytes => { bytes[2] = 7; }, 'E_UNSUPPORTED'],
  ['CRC', bytes => { bytes[bytes.length - 8] ^= 1; }],
  ['truncation', bytes => bytes.subarray(0, -1)],
  ['junk', bytes => Buffer.concat([bytes, Buffer.from('junk')])],
  ['zero tail', bytes => Buffer.concat([bytes, Buffer.alloc(4)])],
]) {
  test(`gzip rejects ${label}`, () => {
    const bytes = zlib.gzipSync(basicTar());
    rejects(debWithData(mutate(bytes) ?? bytes), code);
  });
}

test('gzip accepts fully consumed concatenated streams only when the combined TAR remains valid', () => {
  const bytes = basicTar();
  const joined = Buffer.concat([zlib.gzipSync(bytes.subarray(0, 700)), zlib.gzipSync(bytes.subarray(700))]);
  assert.equal(compare(debWithData(joined)).packageBytesMatched, true);
  rejects(debWithData(Buffer.concat([zlib.gzipSync(bytes), zlib.gzipSync(tarMember('late'))])), 'E_TAR');
});

for (const kind of ['gzip', 'zstd']) {
  test(`${kind} decoded byte limit admits exact output and rejects one byte below`, () => {
    const bytes = deb(basicTar(), kind);
    assert.equal(compare(bytes, expected, { maxDecodedBytes: 2048 }).decompressedBytes, 2048);
    rejects(bytes, 'E_DECOMPRESS', expected, { maxDecodedBytes: 2047 });
  });
}

test('gzip native errors and invalid decoder results reveal no private messages', t => {
  const bytes = deb();
  t.mock.method(zlib, 'gunzipSync', () => { throw new Error('PRIVATE PACKAGE BYTES'); });
  rejects(bytes, 'E_DECOMPRESS');
});

test('zstd supports bounded standard raw frames with known and unknown content sizes', () => {
  for (const unknown of [false, true]) {
    const bytes = debWithData(rawZstd(basicTar(), { unknown }), 'data.tar.zst');
    assert.equal(compare(bytes).decompressedBytes, 2048);
  }
});

test('zstd permits an explicitly zero dictionary ID but never a nonzero ID', () => {
  const bytes = rawZstd(basicTar(), { unknown: true, dictionary: true });
  assert.equal(compare(debWithData(bytes, 'data.tar.zst')).packageBytesMatched, true);
  bytes[6] = 1;
  rejects(debWithData(bytes, 'data.tar.zst'), 'E_UNSUPPORTED');
});

for (const [label, mutate, code = 'E_UNSUPPORTED'] of [
  ['nonstandard magic', bytes => { bytes[0] = 0; }],
  ['skippable magic', bytes => { bytes.writeUInt32LE(0x184d2a50, 0); }],
  ['reserved descriptor', bytes => { bytes[4] |= 8; }],
  ['unused descriptor', bytes => { bytes[4] |= 16; }],
  ['reserved block', bytes => { bytes[7] |= 6; }],
  ['oversized block', bytes => { bytes.writeUIntLE((131073 << 3) | 1, 7, 3); }],
  ['missing last block', bytes => { bytes[7] &= 254; }, 'E_DECOMPRESS'],
  ['truncated block', bytes => bytes.subarray(0, -1), 'E_DECOMPRESS'],
  ['truncated checksum', bytes => { bytes[4] |= 4; }, 'E_DECOMPRESS'],
  ['trailing zero', bytes => Buffer.concat([bytes, Buffer.alloc(1)])],
  ['trailing junk', bytes => Buffer.concat([bytes, Buffer.from('junk')])],
  ['second standard frame', bytes => Buffer.concat([bytes, bytes])],
  ['skippable following frame', bytes => Buffer.concat([bytes, Buffer.from([0x50, 0x2a, 0x4d, 0x18, 0, 0, 0, 0])])],
]) {
  test(`zstd framing rejects ${label}`, () => {
    const bytes = rawZstd(basicTar());
    rejects(debWithData(mutate(bytes) ?? bytes, 'data.tar.zst'), code);
  });
}

for (const cut of [0, 1, 4, 5, 6, 7, 8, 9]) {
  test(`zstd framing rejects truncation at ${cut}`, () => rejects(debWithData(rawZstd(basicTar()).subarray(0, cut), 'data.tar.zst'), 'E_DECOMPRESS'));
}

test('zstd independently bounds known sizes, unknown-size windows and native output', () => {
  const known = rawZstd(basicTar());
  rejects(debWithData(known, 'data.tar.zst'), 'E_DECOMPRESS', expected, { maxZstdWindowLog: 10 });
  assert.equal(compare(debWithData(known, 'data.tar.zst'), expected, { maxZstdWindowLog: 11 }).decompressedBytes, 2048);
  rejects(debWithData(rawZstd(basicTar(), { unknown: true, wd: 255 }), 'data.tar.zst'), 'E_DECOMPRESS');
  rejects(debWithData(rawZstd(basicTar(), { unknown: true }), 'data.tar.zst'), 'E_DECOMPRESS', expected, { maxDecodedBytes: 2047 });
});

test('zstd rejects FCS overflow before native decode and requires exact known output size', t => {
  const bytes = rawZstd(basicTar());
  const huge = Buffer.concat([bytes.subarray(0, 4), Buffer.from([224]), Buffer.alloc(8, 255), bytes.subarray(7)]);
  let calls = 0;
  t.mock.method(zlib, 'zstdDecompressSync', () => { calls++; return Buffer.alloc(1); });
  rejects(debWithData(huge, 'data.tar.zst'), 'E_DECOMPRESS');
  assert.equal(calls, 0);
  rejects(debWithData(bytes, 'data.tar.zst'), 'E_DECOMPRESS');
  assert.equal(calls, 1);
});

test('zstd bounds block count before calling the native decoder', () => {
  const first = Buffer.from([0, 0, 0]);
  const raw = rawZstd(basicTar());
  const two = Buffer.concat([raw.subarray(0, 7), first, raw.subarray(7)]);
  assert.equal(compare(debWithData(two, 'data.tar.zst'), expected, { maxZstdBlocks: 2 }).packageBytesMatched, true);
  rejects(debWithData(two, 'data.tar.zst'), 'E_DECOMPRESS', expected, { maxZstdBlocks: 1 });
});

for (const width of [4, 8]) {
  test(`zstd reads exact ${width}-byte content-size fields`, () => {
    const raw = rawZstd(basicTar());
    const size = Buffer.alloc(width);
    if (width === 4) size.writeUInt32LE(2048);
    else size.writeBigUInt64LE(2048n);
    const bytes = Buffer.concat([raw.subarray(0, 4), Buffer.from([width === 4 ? 160 : 224]), size, raw.subarray(7)]);
    assert.equal(compare(debWithData(bytes, 'data.tar.zst')).decompressedBytes, 2048);
  });
}

test('zstd reads a one-byte single-segment content size before full TAR validation', () => {
  const bytes = Buffer.concat([Buffer.from([0x28, 0xb5, 0x2f, 0xfd, 32, 128, 1, 4, 0]), Buffer.alloc(128)]);
  rejects(debWithData(bytes, 'data.tar.zst'), 'E_TAR');
});

for (const width of [2, 4]) {
  test(`zstd permits only zero ${width}-byte dictionary IDs`, () => {
    const raw = rawZstd(basicTar());
    const dictionary = Buffer.alloc(width);
    const prefix = Buffer.concat([raw.subarray(0, 4), Buffer.from([width === 2 ? 98 : 99]), dictionary]);
    assert.equal(compare(debWithData(Buffer.concat([prefix, raw.subarray(5)]), 'data.tar.zst')).packageBytesMatched, true);
    prefix[5 + width - 1] = 1;
    rejects(debWithData(Buffer.concat([prefix, raw.subarray(5)]), 'data.tar.zst'), 'E_UNSUPPORTED');
  });
}

test('zstd parses non-single known-size frames and window mantissa before decoding', () => {
  const raw = rawZstd(basicTar());
  const bytes = Buffer.concat([raw.subarray(0, 4), Buffer.from([64, 9]), raw.subarray(5)]);
  assert.equal(compare(debWithData(bytes, 'data.tar.zst'), expected, { maxZstdWindowLog: 12 }).packageBytesMatched, true);
  rejects(debWithData(bytes, 'data.tar.zst'), 'E_DECOMPRESS', expected, { maxZstdWindowLog: 11 });
});

test('zstd RLE blocks consume exactly one compressed byte and preserve TAR offsets', () => {
  const bytes = basicTar();
  const raw = rawZstd(bytes);
  const rawHeader = Buffer.alloc(3);
  rawHeader.writeUIntLE(1024 << 3, 0, 3);
  const rleHeader = Buffer.alloc(3);
  rleHeader.writeUIntLE((1024 << 3) | 3, 0, 3);
  const compressed = Buffer.concat([raw.subarray(0, 7), rawHeader, bytes.subarray(0, 1024), rleHeader, Buffer.from([0])]);
  assert.equal(compare(debWithData(compressed, 'data.tar.zst')).memberMatches[0].sha256, abcSha);
});

test('native output admission rejects non-Buffer, oversized and unconsumed results', t => {
  const bytes = deb();
  const mock = t.mock.method(zlib, 'gunzipSync', () => ({ buffer: new Uint8Array(2048), engine: { bytesWritten: zlib.gzipSync(basicTar()).length } }));
  rejects(bytes, 'E_DECOMPRESS');
  mock.mock.mockImplementation(() => ({ buffer: Buffer.alloc(2049), engine: { bytesWritten: zlib.gzipSync(basicTar()).length } }));
  rejects(bytes, 'E_DECOMPRESS', expected, { maxDecodedBytes: 2048 });
  mock.mock.mockImplementation(() => ({ buffer: basicTar(), engine: { bytesWritten: 0 } }));
  rejects(bytes, 'E_DECOMPRESS');
});

test('zstd checksum corruption stops comparison without disabling builtin verification', () => {
  assert.equal(Number.isInteger(zlib.constants.ZSTD_c_checksumFlag), true);
  const data = zlib.zstdCompressSync(basicTar(), { params: { [zlib.constants.ZSTD_c_checksumFlag]: 1 } });
  assert.ok(data[4] & 4);
  assert.equal(compare(debWithData(data, 'data.tar.zst')).packageBytesMatched, true);
  data[data.length - 1] ^= 1;
  rejects(debWithData(data, 'data.tar.zst'), 'E_DECOMPRESS');
});

test('missing builtin zstd returns unsupported without fallback', () => {
  const bytes = deb(basicTar(), 'zstd');
  const original = zlib.zstdDecompressSync;
  try {
    zlib.zstdDecompressSync = undefined;
    rejects(bytes, 'E_UNSUPPORTED');
  } finally { zlib.zstdDecompressSync = original; }
});

test('native zstd failures normalize without private decoder messages', t => {
  const bytes = deb(basicTar(), 'zstd');
  t.mock.method(zlib, 'zstdDecompressSync', () => { throw new Error('PRIVATE'); });
  rejects(bytes, 'E_DECOMPRESS');
});

for (const [label, mutate] of [
  ['checksum', bytes => { bytes[0] ^= 1; }],
  ['padding', bytes => { bytes[515] = 1; }],
  ['EOF truncation', bytes => bytes.subarray(0, -1)],
  ['late nonzero', bytes => Buffer.concat([bytes, Buffer.from([1])])],
  ['unsupported type', () => tar(tarMember(path, Buffer.alloc(0), 'S'))],
  ['duplicate alias', () => tar(tarMember(), tarMember('./' + path))],
  ['unsafe path', () => tar(tarMember('../outside'))],
  ['unsupported PAX', () => tar(tarMember('pax', pax('GNU.sparse.size', '3'), 'x'), tarMember())],
]) {
  test(`full shared TAR validation rejects ${label} after package matching`, () => {
    const bytes = basicTar();
    rejects(deb(mutate(bytes) ?? bytes), 'E_TAR');
  });
}

for (const type of ['1', '2', '5']) {
  test(`selected target cannot resolve through TAR type ${type}`, () => {
    rejects(deb(tar(tarMember(path, Buffer.alloc(0), type, 'other'), tarMember('other'))), 'E_MEMBER');
  });
}

for (const [label, target] of [
  ['missing', { ...expected[0], path: 'missing' }],
  ['size mismatch', { ...expected[0], byteLength: 2 }],
  ['hash mismatch', { ...expected[0], sha256: '0'.repeat(64) }],
]) {
  test(`member comparison rejects ${label} without partial matches`, () => rejects(deb(), 'E_MEMBER', [target]));
}

test('member comparison preserves operator target order and hashes zero-length members', () => {
  const empty = { path: 'empty', byteLength: 0, sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' };
  const bytes = deb(tar(tarMember(), tarMember('empty', Buffer.alloc(0))));
  assert.deepEqual(compare(bytes, [empty, expected[0]]).memberMatches, [{ ...empty, matched: true }, { ...expected[0], matched: true }]);
  rejects(bytes, 'E_TARGETS', [empty, expected[0]], { maxTargets: 1 });
  rejects(bytes, 'E_MEMBER', [expected[0], { ...empty, sha256: '0'.repeat(64) }]);
});

for (const [label, extension] of [
  ['GNU', tarMember('extension', Buffer.from(path + '\0'), 'L')],
  ['local PAX', tarMember('extension', Buffer.concat([pax('path', path), pax('size', '3')]), 'x')],
  ['global PAX', tarMember('extension', pax('path', path), 'g')],
]) {
  test(`member comparison uses shared ${label} effective spans`, () => {
    const bytes = deb(tar(extension, tarMember('raw')));
    assert.equal(compare(bytes).memberMatches[0].sha256, abcSha);
  });
}

test('member comparison honors PAX physical size over the raw header', () => {
  const raw = Buffer.concat([tarHeader('raw', 0), Buffer.from('abc'), Buffer.alloc(509)]);
  assert.equal(compare(deb(tar(tarMember('extension', Buffer.concat([pax('path', path), pax('size', '3')]), 'x'), raw))).packageBytesMatched, true);
});

test('Unicode member paths count JSON UTF8 bytes without payload disclosure', () => {
  const name = '文/猫';
  const result = compare(deb(tar(tarMember(name))), [{ ...expected[0], path: name }]);
  assert.equal(result.memberMatches[0].path, name);
  assert.equal(JSON.stringify(result).includes('"abc"'), false);
});

test('static pure-unit source contracts and handoff hashes', async t => {
  const spec = '_spec/tooling/native-ingress/deb-members.puml';
  const covers = ['tooling/native-ingress/deb-members.mjs', 'tooling/native-ingress/deb-members.test.mjs'];
  const diagram = await readFile(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(await readFile(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(entry => entry.spec === spec), [{ spec, covers, fingerprint: null }]);
  for (const file of covers) assert.ok(diagram.includes("' covers: " + file + '\n'));
  for (const name of ['tar-inventory.mjs', 'tar-inventory.test.mjs', 'deb-members.mjs', 'deb-members.test.mjs']) {
    const bytes = await readFile(new URL(name, import.meta.url));
    const source = bytes.toString('utf8');
    assert.equal(source.split('\n')[0], '// SPEC: _spec/tooling/native-ingress/' + (name.startsWith('deb-') ? 'deb-members.puml' : 'inventory.puml'));
    t.diagnostic(`${name} sha256=${sha(bytes)}`);
    if (name.endsWith('.test.mjs')) continue;
    const allowed = ['node:crypto', 'node:util', 'node:zlib', './tar-inventory.mjs'];
    for (const match of source.matchAll(/from '([^']+)'/g)) assert.ok(allowed.includes(match[1]));
    assert.doesNotMatch(source, /\b(?:fetch|spawn|exec|require|import)\s*\(/);
    assert.doesNotMatch(source, /\bprocess\s*[.[]/);
    assert.doesNotMatch(source, /\b(?:readFile|writeFile|createReadStream|createWriteStream)\s*\(/);
  }
});
