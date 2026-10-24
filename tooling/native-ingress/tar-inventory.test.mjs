// SPEC: _spec/tooling/native-ingress/inventory.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createTarInventory, createTarMemberInventory, INVENTORY_LIMITS, InventoryError } from './tar-inventory.mjs';

function checksum(header) {
  header.fill(32, 148, 156);
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  return header;
}

function header(options = {}) {
  const bytes = Buffer.alloc(512);
  bytes.write(options.path ?? 'root/file', 0, 100, 'utf8');
  for (const [key, offset, width, fallback] of [
    ['mode', 100, 8, 0o644], ['uid', 108, 8, 1], ['gid', 116, 8, 2],
    ['size', 124, 12, 0], ['mtime', 136, 12, 3],
  ]) bytes.write(`${(options[key] ?? fallback).toString(8).padStart(width - 1, '0')}\0`, offset, width, 'ascii');
  bytes[156] = (options.type ?? '0').charCodeAt(0);
  bytes.write(options.link ?? '', 157, 100, 'utf8');
  if (options.format !== 'v7') {
    bytes.write(options.format === 'gnu' ? 'ustar ' : 'ustar\0', 257, 6, 'ascii');
    bytes.write(options.format === 'gnu' ? ' \0' : '00', 263, 2, 'ascii');
  }
  if (options.prefix) bytes.write(options.prefix, 345, 155, 'utf8');
  return checksum(bytes);
}

function member(options = {}, body = Buffer.alloc(options.size ?? 0)) {
  return Buffer.concat([header({ ...options, size: options.size ?? body.length }), body, Buffer.alloc((512 - body.length % 512) % 512)]);
}

function archive(...members) {
  return Buffer.concat([...members, Buffer.alloc(1024)]);
}

function paxRecord(key, value) {
  const body = Buffer.from(` ${key}=${value}\n`, 'utf8');
  let length = body.length + 1;
  while (String(length).length + body.length !== length) length = String(length).length + body.length;
  return Buffer.concat([Buffer.from(String(length)), body]);
}

function extension(type, body) {
  return member({ path: 'extension', type }, body);
}

function run(bytes, overrides = {}, chunk = bytes.length) {
  const parser = createTarInventory(overrides);
  const events = [];
  for (let offset = 0; offset < bytes.length; offset += chunk) events.push(...parser.feed(bytes.subarray(offset, offset + chunk)));
  return { events, summary: parser.finish(), parser };
}

function rejects(bytes, code, overrides = {}) {
  assert.throws(() => run(bytes, overrides), (error) => error instanceof InventoryError && error.code === code);
}

test('basic metadata, canonical JSON digest and frozen interfaces', () => {
  const { events, summary, parser } = run(archive(member({}, Buffer.from('secret-payload'))));
  assert.deepEqual(events, [{ index: 1, path: 'root/file', type: 'file', size: 14, mode: 420, uid: 1, gid: 2, mtime: '3' }]);
  const serialized = `${JSON.stringify(events[0])}\n`;
  assert.equal(summary.metadataSha256, createHash('sha256').update(serialized).digest('hex'));
  assert.equal(summary.outputBytes, Buffer.byteLength(serialized));
  assert.equal(summary.headers, 1);
  assert.equal(summary.entries, 1);
  assert.equal(summary.state, 'TAR_INVENTORY');
  for (const object of [events[0], summary, parser, INVENTORY_LIMITS]) assert.equal(Object.isFrozen(object), true);
  for (const key of ['mockOnly', 'decoderQualified', 'realArchiveInspected', 'extractionAuthorized', 'pythonFreeSubsetVerified', 'installedUsability', 'rustReady', 'trainingReady', 'nativeQualified', 'provenanceVerified']) assert.equal(summary[key], false);
  assert.equal(JSON.stringify({ events, summary }).includes('secret-payload'), false);
});

test('empty archive has no records and SHA256 of empty metadata', () => {
  const { events, summary } = run(archive());
  assert.deepEqual(events, []);
  assert.equal(summary.metadataSha256, createHash('sha256').digest('hex'));
  assert.equal(summary.expandedBytes, 1024);
});

for (const format of ['v7', 'gnu', 'posix']) {
  test(`supports ${format} header`, () => assert.equal(run(archive(member({ format }))).events[0].path, 'root/file'));
}

test('POSIX prefixes compose while old GNU fields do not become prefixes', () => {
  assert.equal(run(archive(member({ path: 'file', prefix: 'root' }))).events[0].path, 'root/file');
  assert.equal(run(archive(member({ path: 'file', prefix: '../ignored', format: 'gnu' }))).events[0].path, 'file');
});

for (const [type, expected] of [['\0', 'file'], ['0', 'file'], ['5', 'directory'], ['1', 'hardlink'], ['2', 'symlink']]) {
  test(`ordinary type ${JSON.stringify(type)}`, () => {
    const event = run(archive(member({ path: 'a', type, link: 'target' }))).events[0];
    assert.equal(event.type, expected);
    assert.equal(Object.hasOwn(event, 'linkpath'), type === '1' || type === '2');
  });
}

for (const type of ['3', '4', '6', '7', 'S', 'V', 'D', 'X', 'z']) {
  test(`rejects unsupported member ${type}`, () => rejects(archive(member({ type })), 'E_TYPE'));
}

for (const type of ['5', '1', '2']) {
  test(`rejects body on non-file ${type}`, () => rejects(archive(member({ type, link: 'target' }, Buffer.from('x'))), 'E_NONFILE_BODY'));
}

for (const path of ['/a', '../a', 'a/../b', 'a/./b', '././a', 'a//b', 'a/', '', '//a', 'C:foo', 'a\\b', 'a\nb', 'a\u007fb', 'a\u0085b']) {
  test(`rejects entry path ${JSON.stringify(path)}`, () => rejects(archive(member({ path })), /[\\\n\u007f\u0085]/u.test(path) ? 'E_TEXT' : 'E_PATH'));
}

for (const path of ['.', './', './dir/', 'dir/']) {
  test(`directory alias ${path}`, () => {
    assert.equal(run(archive(member({ type: '5', path }))).events[0].path, path === '.' || path === './' ? '.' : 'dir');
  });
}

for (const [first, second, type] of [['a', './a', '0'], ['dir', 'dir/', '5'], ['.', './', '5']]) {
  test(`rejects collision ${first} and ${second}`, () => rejects(archive(member({ path: first, type }), member({ path: second, type })), 'E_COLLISION'));
}

test('file and directory keys collide', () => rejects(archive(member({ path: 'a' }), member({ path: 'a/', type: '5' })), 'E_COLLISION'));

for (const [link, kind] of [['target', 'relative'], ['../target', 'parent-components'], ['a/../target', 'parent-components'], ['/outside', 'absolute'], ['C:/outside', 'absolute']]) {
  test(`links preserve metadata ${link}`, () => {
    const event = run(archive(member({ type: '2', link }))).events[0];
    assert.equal(event.linkpath, link);
    assert.equal(event.linkKind, kind);
    assert.equal(Object.hasOwn(event, 'safeToExtract'), false);
  });
}

test('empty links fail', () => rejects(archive(member({ type: '1' })), 'E_LINK'));
test('link controls fail', () => rejects(archive(member({ type: '2', link: 'x\ny' })), 'E_TEXT'));
test('link limit exact and one over', () => {
  const bytes = archive(member({ type: '2', link: 'abc' }));
  assert.equal(run(bytes, { maxLinkBytes: 3 }).events.length, 1);
  rejects(bytes, 'E_LINK', { maxLinkBytes: 2 });
});

test('path limit counts UTF8 bytes', () => {
  const bytes = archive(member({ path: 'éé' }));
  assert.equal(run(bytes, { maxPathBytes: 4 }).events[0].path, 'éé');
  rejects(bytes, 'E_PATH', { maxPathBytes: 3 });
});

test('embedded NUL does not silently truncate names', () => {
  const bytes = header();
  bytes[2] = 0;
  rejects(archive(checksum(bytes)), 'E_TEXT');
});

test('invalid UTF8 fails rather than replacing bytes', () => {
  const bytes = header();
  bytes[0] = 0xff;
  rejects(archive(checksum(bytes)), 'E_UTF8');
});

test('invalid prefix path fails', () => rejects(archive(member({ prefix: '../root' })), 'E_PATH'));
test('BOM remains part of the name', () => assert.equal(run(archive(member({ path: '\ufeffa' }))).events[0].path, '\ufeffa'));

for (const offset of [100, 108, 116, 124, 136]) {
  test(`base256 numeric field ${offset}`, () => {
    const bytes = header();
    const width = offset >= 124 ? 12 : 8;
    bytes.fill(0, offset, offset + width);
    bytes[offset] = 0x80;
    bytes[offset + width - 1] = offset === 124 ? 0 : 17;
    const event = run(archive(checksum(bytes))).events[0];
    assert.equal(event[{ 100: 'mode', 108: 'uid', 116: 'gid', 124: 'size', 136: 'mtime' }[offset]], offset === 124 ? 0 : offset === 136 ? '17' : 17);
  });
}

for (const [label, mutate] of [
  ['negative base256', (bytes) => { bytes[108] = 0xc0; }],
  ['unsafe base256', (bytes) => { bytes.fill(0xff, 109, 116); bytes[108] = 0x80; }],
  ['invalid octal', (bytes) => { bytes[108] = 56; }],
  ['embedded padding octal', (bytes) => { bytes[110] = 0; }],
  ['negative octal mtime', (bytes) => { bytes[136] = 45; }],
  ['empty numeric', (bytes) => { bytes.fill(0, 108, 116); }],
]) {
  test(`rejects ${label}`, () => {
    const bytes = header();
    mutate(bytes);
    rejects(archive(checksum(bytes)), 'E_NUMBER');
  });
}

test('space padded octal succeeds', () => {
  const bytes = header();
  bytes.write('  0007  ', 108, 8, 'ascii');
  assert.equal(run(archive(checksum(bytes))).events[0].uid, 7);
});

for (const [name, offset, width] of [
  ['mode', 100, 8], ['uid', 108, 8], ['gid', 116, 8],
  ['size', 124, 12], ['mtime', 136, 12], ['checksum', 148, 8],
]) {
  for (const [label, vector] of [
    ['leading NUL before digit', [0, 48]],
    ['space then leading NUL before digit', [32, 0, 48]],
    ['digit after NUL', [48, 0, 49]],
    ['digit after spaced NUL', [48, 32, 0, 32, 49]],
    ['junk after NUL', [48, 0, 120]],
    ['leading tab', [9, 48]],
    ['trailing tab', [48, 9]],
    ['digit after repeated NUL', [48, 0, 32, 0, 48]],
    ['terminal LF', [...Array(width - 1).fill(48), 10]],
    ['terminal CR', [...Array(width - 1).fill(48), 13]],
    ['terminal CRLF', [...Array(width - 2).fill(48), 13, 10]],
  ]) {
    test(`strict octal ${name} rejects ${label} before emission and stays failed`, () => {
      const bytes = header();
      bytes.fill(32, offset, offset + width);
      bytes.set(vector, offset);
      if (name !== 'checksum') checksum(bytes);
      const parser = createTarInventory();
      let emitted;
      let failure;
      assert.throws(() => { emitted = parser.feed(bytes); }, (error) => {
        failure = error;
        return error instanceof InventoryError && error.code === 'E_NUMBER';
      });
      assert.equal(emitted, undefined);
      assert.throws(() => parser.feed(archive()), (error) => error === failure);
      assert.throws(() => parser.finish(), (error) => error === failure);
    });
  }
  for (const [label, format] of [
    ['space padding', (digits, width) => `${digits.padStart(width - 2, ' ')}  `],
    ['NUL terminator', (digits, width) => `${digits.padStart(width - 1, '0')}\0`],
    ['space before NUL', (digits, width) => `${digits.padStart(width - 2, ' ')} \0`],
    ['mixed trailing NUL and space', (digits, width) => `${digits}\0${' \0'.repeat(width).slice(0, width - digits.length - 1)}`],
  ]) {
    test(`strict octal ${name} accepts ${label}`, () => {
      const bytes = header();
      const value = name === 'checksum'
        ? bytes.reduce((total, byte, index) => total + (index >= 148 && index < 156 ? 32 : byte), 0)
        : 0;
      const encoded = Buffer.from(format(value.toString(8), width), 'ascii');
      assert.equal(encoded.length, width);
      bytes.set(encoded, offset);
      if (name !== 'checksum') checksum(bytes);
      const { events } = run(archive(bytes));
      assert.equal(events.length, 1);
      if (name !== 'checksum') assert.equal(events[0][name], name === 'mtime' ? '0' : 0);
    });
  }
}

test('checksum mismatch fails', () => {
  const bytes = header();
  bytes[0] ^= 1;
  rejects(archive(bytes), 'E_CHECKSUM');
});
test('base256 checksum fails', () => {
  const bytes = header();
  bytes[148] = 0x80;
  rejects(archive(bytes), 'E_NUMBER');
});
test('unknown magic fails', () => {
  const bytes = header();
  bytes.write('other!', 257);
  rejects(archive(checksum(bytes)), 'E_MAGIC');
});
test('unsupported ustar version fails', () => {
  const bytes = header();
  bytes.write('01', 263);
  rejects(archive(checksum(bytes)), 'E_MAGIC');
});

test('local PAX applies documented primitives and discards usernames', () => {
  const data = Buffer.concat(Object.entries({ path: 'é/file', uid: '42', gid: '43', mtime: '-123.125', uname: 'PRIVATE-NAME', gname: 'PRIVATE-GROUP' }).map(([key, value]) => paxRecord(key, value)));
  const { events, summary } = run(archive(extension('x', data), member()));
  assert.equal(events[0].path, 'é/file');
  assert.equal(events[0].uid, 42);
  assert.equal(events[0].gid, 43);
  assert.equal(events[0].mtime, '-123.125');
  assert.equal(summary.extensionBytes, data.length);
  assert.equal(summary.headers, 2);
  assert.equal(JSON.stringify(events).includes('PRIVATE'), false);
});

test('PAX effective size controls physical body framing', () => {
  const raw = Buffer.concat([header({ size: 0 }), Buffer.from('abc'), Buffer.alloc(509)]);
  assert.equal(run(archive(extension('x', paxRecord('size', '3')), raw)).events[0].size, 3);
});

test('PAX effective size can reset header size to zero', () => {
  assert.equal(run(archive(extension('x', paxRecord('size', '0')), header({ size: 10 }))).events[0].size, 0);
});

test('global PAX persists and empty globals remove defaults', () => {
  const bytes = archive(extension('g', paxRecord('uid', '9')), member({ path: 'a' }), extension('g', paxRecord('uid', '')), member({ path: 'b' }));
  assert.deepEqual(run(bytes).events.map((event) => event.uid), [9, 1]);
});

test('empty local PAX clears a global value for one member only', () => {
  const bytes = archive(extension('g', paxRecord('uid', '9')), extension('x', paxRecord('uid', '')), member({ path: 'a' }), member({ path: 'b' }));
  assert.deepEqual(run(bytes).events.map((event) => event.uid), [1, 9]);
});

test('global PAX then GNU then local PAX precedence', () => {
  const bytes = archive(extension('g', paxRecord('path', 'global')), extension('L', Buffer.from('gnu\0')), extension('x', paxRecord('path', 'local')), member());
  assert.equal(run(bytes).events[0].path, 'local');
});
test('GNU name overrides global path and clears after one entry', () => {
  const bytes = archive(extension('g', paxRecord('path', 'global')), extension('L', Buffer.from('gnu\0')), member(), member());
  assert.deepEqual(run(bytes).events.map((event) => event.path), ['gnu', 'global']);
});
test('empty local path removes effective overrides and uses raw header', () => {
  const bytes = archive(extension('g', paxRecord('path', 'global')), extension('L', Buffer.from('gnu\0')), extension('x', paxRecord('path', '')), member());
  assert.equal(run(bytes).events[0].path, 'root/file');
});
test('extension physical size ignores global PAX size', () => {
  const bytes = archive(extension('g', paxRecord('size', '0')), extension('L', Buffer.from('long\0')), member());
  assert.equal(run(bytes).events[0].path, 'long');
});
test('GNU link override precedes global link but local wins', () => {
  const bytes = archive(extension('g', paxRecord('linkpath', 'global')), extension('K', Buffer.from('../gnu\0')), extension('x', paxRecord('linkpath', '/local')), member({ type: '2' }));
  assert.equal(run(bytes).events[0].linkpath, '/local');
});
test('GNU long names exceed header name capacity', () => {
  const name = 'a'.repeat(200);
  assert.equal(run(archive(extension('L', Buffer.from(`${name}\0`)), member())).events[0].path, name);
});

for (const body of [Buffer.from('missing-nul'), Buffer.from('a\0\0'), Buffer.from('a\0b\0'), Buffer.from([0]), Buffer.from([255, 0])]) {
  test(`rejects malformed GNU long payload ${body.toString('hex')}`, () => rejects(archive(extension('L', body), member()), body[0] === 255 ? 'E_UTF8' : 'E_GNU_LONG'));
}
for (const type of ['x', 'L', 'K']) {
  const body = type === 'x' ? paxRecord('uid', '1') : Buffer.from('value\0');
  test(`rejects repeated pending ${type}`, () => rejects(archive(extension(type, body), extension(type, body), member()), 'E_EXTENSION_REPEAT'));
  test(`rejects dangling pending ${type}`, () => rejects(archive(extension(type, body)), 'E_DANGLING_EXTENSION'));
}
test('global-only end is permitted', () => assert.equal(run(archive(extension('g', paxRecord('uid', '1')))).summary.entries, 0));

for (const key of ['GNU.sparse.map', 'GNU.sparse.size', 'atime', 'ctime', 'SCHILY.xattr.test', '__proto__', 'unknown']) {
  test(`rejects unknown PAX ${key}`, () => rejects(archive(extension('x', paxRecord(key, '1')), member()), 'E_PAX_KEY'));
}
test('duplicate PAX keys fail within a record', () => rejects(archive(extension('x', Buffer.concat([paxRecord('uid', '1'), paxRecord('uid', '2')])), member()), 'E_PAX_DUPLICATE'));
for (const value of ['01', '-1', '1.5', '+1', '9007199254740992', '1'.repeat(33), ' 1']) {
  test(`rejects PAX unsigned numeric ${value}`, () => rejects(archive(extension('x', paxRecord('uid', value)), member()), 'E_PAX_NUMBER'));
}
for (const value of ['1e3', '.5', '1.', '--1', '-9007199254740992']) {
  test(`rejects PAX mtime ${value}`, () => rejects(archive(extension('x', paxRecord('mtime', value)), member()), 'E_PAX_NUMBER'));
}
for (const body of ['0 path=a\n', '09 path=a\n', '99 path=a\n', 'x path=a\n', '9 path=a!', '2 \n', '11 noequals\n', '12345678901 path=a\n']) {
  test(`rejects malformed PAX framing ${JSON.stringify(body)}`, () => rejects(archive(extension('x', Buffer.from(body)), member()), 'E_PAX'));
}
test('PAX byte lengths handle multibyte characters', () => assert.equal(run(archive(extension('x', paxRecord('path', 'é/猫')), member())).events[0].path, 'é/猫'));
test('PAX invalid UTF8 fails', () => {
  const body = paxRecord('path', 'a');
  body[body.length - 2] = 255;
  rejects(archive(extension('x', body), member()), 'E_UTF8');
});
test('PAX control characters fail', () => rejects(archive(extension('x', paxRecord('path', 'a\nb')), member()), 'E_TEXT'));
test('PAX path traversal fails', () => rejects(archive(extension('x', paxRecord('path', '../outside')), member()), 'E_PATH'));

for (const size of [0, 1, 511, 512, 513]) {
  test(`payload size ${size} and boundary chunk splits`, () => {
    const bytes = archive(member({}, Buffer.alloc(size, 99)));
    for (const chunk of [1, 7, 511, 512, 513, 1023]) {
      const result = run(bytes, {}, chunk);
      assert.equal(result.events[0].size, size);
      assert.equal(result.summary.expandedBytes, bytes.length);
    }
  });
}
test('every offset splits UTF8/PAX/header/terminal correctly', () => {
  const bytes = archive(extension('x', paxRecord('path', 'é/猫')), member({}, Buffer.from('x')));
  const reference = run(bytes).summary.metadataSha256;
  for (let split = 1; split < bytes.length; split++) {
    const parser = createTarInventory();
    parser.feed(bytes.subarray(0, split));
    parser.feed(bytes.subarray(split));
    assert.equal(parser.finish().metadataSha256, reference);
  }
});

for (const cut of [0, 1, 511, 512, 513, 1023, 1024, 1535, 1536, 2047]) {
  test(`truncated archive at ${cut}`, () => {
    const bytes = archive(member({}, Buffer.from('x'))).subarray(0, cut);
    const parser = createTarInventory();
    if (bytes.length) parser.feed(bytes);
    assert.throws(() => parser.finish(), { code: 'E_TRUNCATED' });
  });
}
test('truncated extension fails', () => rejects(Buffer.concat([header({ type: 'x', size: 20 }), Buffer.from('5 uid')]), 'E_TRUNCATED'));
test('single zero block followed by member fails', () => rejects(Buffer.concat([Buffer.alloc(512), archive(member())]), 'E_TERMINATOR'));
test('nonzero payload padding fails', () => {
  const bytes = archive(member({}, Buffer.from('x')));
  bytes[513] = 1;
  rejects(bytes, 'E_PADDING');
});
test('nonzero extension padding fails', () => {
  const bytes = archive(extension('x', paxRecord('uid', '1')), member());
  bytes[1023] = 1;
  rejects(bytes, 'E_PADDING');
});
test('zero trailing blocks accepted and counted', () => assert.equal(run(Buffer.concat([archive(), Buffer.alloc(512)])).summary.expandedBytes, 1536));
test('nonzero trailing bytes fail', () => rejects(Buffer.concat([archive(), Buffer.from([1])]), 'E_TRAILING'));
test('partial trailing zero block fails', () => rejects(Buffer.concat([archive(), Buffer.alloc(1)]), 'E_TRUNCATED'));

test('sealing is single use', () => {
  const { parser } = run(archive());
  assert.throws(() => parser.finish(), { code: 'E_SEALED' });
  assert.throws(() => parser.feed(Buffer.from([0])), { code: 'E_SEALED' });
});
test('failure is absorbing with stable error identity', () => {
  const parser = createTarInventory();
  let failure;
  try { parser.feed(Buffer.alloc(0)); } catch (error) { failure = error; }
  assert.equal(failure.code, 'E_CHUNK');
  assert.equal(Object.isFrozen(failure), true);
  assert.throws(() => { failure.code = 'FORGED'; }, TypeError);
  for (const action of [() => parser.feed(archive()), () => parser.finish()]) assert.throws(action, (error) => error === failure);
});
test('late failure cannot finalize earlier provisional events', () => {
  const parser = createTarInventory();
  assert.equal(parser.feed(member()).length, 1);
  assert.throws(() => parser.feed(Buffer.alloc(512, 1)), InventoryError);
  assert.throws(() => parser.finish(), InventoryError);
});
test('feed event arrays are frozen', () => {
  const parser = createTarInventory();
  assert.equal(Object.isFrozen(parser.feed(header())), true);
});
test('mutating a split header input cannot mutate held state', () => {
  const bytes = archive(member());
  const first = Buffer.from(bytes.subarray(0, 200));
  const parser = createTarInventory();
  parser.feed(first);
  first.fill(255);
  assert.equal(parser.feed(bytes.subarray(200))[0].path, 'root/file');
  parser.finish();
});
test('mutating a split extension input cannot mutate held state', () => {
  const bytes = archive(extension('x', paxRecord('path', 'good')), member());
  const first = Buffer.from(bytes.subarray(0, 518));
  const parser = createTarInventory();
  parser.feed(first);
  first.fill(255);
  assert.equal(parser.feed(bytes.subarray(518))[0].path, 'good');
  parser.finish();
});

test('Uint8Array views honor native offsets', () => {
  const bytes = archive(member());
  const backing = new Uint8Array(bytes.length + 20);
  backing.set(bytes, 10);
  const view = backing.subarray(10, -10);
  Object.defineProperty(view, 'length', { get() { throw new Error('untrusted getter'); } });
  Object.defineProperty(view, 'buffer', { get() { throw new Error('untrusted getter'); } });
  Object.defineProperty(view, 'byteOffset', { get() { throw new Error('untrusted getter'); } });
  const parser = createTarInventory();
  assert.equal(parser.feed(view).length, 1);
  parser.finish();
});
test('typed input accessor properties are not invoked by feed', () => {
  const bytes = new Uint8Array(archive());
  Object.defineProperty(bytes, 'length', { get() { throw new Error('getter'); } });
  const parser = createTarInventory();
  parser.feed(bytes);
  assert.equal(parser.finish().entries, 0);
});
for (const [label, value] of [
  ['empty', Buffer.alloc(0)], ['string', 'x'], ['array', [0]], ['data view', new DataView(new ArrayBuffer(8))],
  ['uint16', new Uint16Array(8)], ['plain', {}], ['null', null], ['proxy', new Proxy(new Uint8Array(1), {})],
  ['shared', new Uint8Array(new SharedArrayBuffer(10))],
]) {
  test(`rejects chunk ${label}`, () => assert.throws(() => createTarInventory().feed(value), { code: 'E_CHUNK' }));
}
test('detached typed input fails', () => {
  const bytes = new Uint8Array(10);
  structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
  assert.throws(() => createTarInventory().feed(bytes), { code: 'E_CHUNK' });
});
test('resizable views use current native length and private copies', () => {
  const backing = new ArrayBuffer(512, { maxByteLength: 2048 });
  const view = new Uint8Array(backing);
  view.set(header());
  const parser = createTarInventory();
  assert.equal(parser.feed(view)[0].path, 'root/file');
  backing.resize(1024);
  view.fill(0);
  parser.feed(view);
  assert.equal(parser.finish().entries, 1);
});

for (const [label, value] of [
  ['null', null], ['array', []], ['inherited', Object.create({ maxHeaders: 1 })], ['proxy', new Proxy({}, {})],
  ['unknown', { extra: 1 }], ['symbol', { [Symbol('limit')]: 1 }], ['zero', { maxHeaders: 0 }],
  ['negative', { maxHeaders: -1 }], ['fractional', { maxHeaders: 1.5 }], ['infinite', { maxHeaders: Infinity }],
  ['NaN', { maxHeaders: NaN }], ['bigint', { maxHeaders: 1n }], ['string', { maxHeaders: '1' }],
  ['increase', { maxHeaders: INVENTORY_LIMITS.maxHeaders + 1 }],
  ['accessor', Object.defineProperty({}, 'maxHeaders', { get() { throw new Error('getter'); } })],
]) {
  test(`rejects limit override ${label}`, () => assert.throws(() => createTarInventory(value), { code: 'E_LIMITS' }));
}
test('limits are captured once without retaining caller objects', () => {
  const overrides = { maxHeaders: 1 };
  const parser = createTarInventory(overrides);
  overrides.maxHeaders = 100;
  assert.throws(() => parser.feed(archive(member({ path: 'a' }), member({ path: 'b' }))), { code: 'E_HEADERS' });
});
test('null prototype own-data limits accepted', () => assert.equal(run(archive(), Object.assign(Object.create(null), { maxHeaders: 1 })).summary.entries, 0));

test('expanded bytes admission exact and cap plus one', () => {
  const bytes = archive(member());
  assert.equal(run(bytes, { maxExpandedBytes: bytes.length }).summary.expandedBytes, bytes.length);
  rejects(bytes, 'E_EXPANDED_BYTES', { maxExpandedBytes: bytes.length - 1 });
});
test('physical headers include extensions in admission', () => {
  const bytes = archive(extension('x', paxRecord('uid', '1')), member());
  assert.equal(run(bytes, { maxHeaders: 2 }).summary.headers, 2);
  rejects(bytes, 'E_HEADERS', { maxHeaders: 1 });
});
test('extension payload budget is cumulative and admitted before allocation', () => {
  const data = paxRecord('uid', '1');
  const bytes = archive(extension('g', data), extension('g', data), member());
  assert.equal(run(bytes, { maxExtensionBytes: data.length * 2 }).summary.extensionBytes, data.length * 2);
  rejects(bytes, 'E_EXTENSION_BYTES', { maxExtensionBytes: data.length * 2 - 1 });
  const parser = createTarInventory({ maxExtensionBytes: 1 });
  assert.throws(() => parser.feed(header({ type: 'L', size: 2 })), { code: 'E_EXTENSION_BYTES' });
});
test('per-entry size admission precedes payload', () => {
  const parser = createTarInventory({ maxExpandedBytes: 1024 });
  assert.throws(() => parser.feed(header({ size: 1025 })), { code: 'E_SIZE' });
});
test('effective PAX size cannot exceed expanded cap', () => rejects(archive(extension('x', paxRecord('size', '99999')), member()), 'E_SIZE', { maxExpandedBytes: 4096 }));
test('PAX max-safe integer remains exact', () => {
  const bytes = archive(extension('x', paxRecord('uid', String(Number.MAX_SAFE_INTEGER))), member());
  assert.equal(run(bytes).events[0].uid, Number.MAX_SAFE_INTEGER);
});
test('base256 max-safe integer remains exact', () => {
  const bytes = header();
  let value = BigInt(Number.MAX_SAFE_INTEGER);
  for (let i = 115; i >= 108; i--) {
    bytes[i] = Number(value & 255n);
    value >>= 8n;
  }
  bytes[108] |= 0x80;
  assert.equal(run(archive(checksum(bytes))).events[0].uid, Number.MAX_SAFE_INTEGER);
});
test('fractional PAX mtime preserves exact decimal text', () => {
  const value = '9007199254740991.123456789';
  assert.equal(run(archive(extension('x', paxRecord('mtime', value)), member())).events[0].mtime, value);
});
test('non-file effective PAX size must also be zero', () => rejects(archive(extension('x', paxRecord('size', '1')), member({ type: '5' })), 'E_NONFILE_BODY'));
test('GNU long paths still obey logical path limits', () => rejects(archive(extension('L', Buffer.from('abcd\0')), member()), 'E_PATH', { maxPathBytes: 3 }));
test('PAX long links still obey logical link limits', () => rejects(archive(extension('x', paxRecord('linkpath', 'abcd')), member({ type: '2' })), 'E_LINK', { maxLinkBytes: 3 }));
test('GNU long link clears after one logical member', () => {
  const bytes = archive(extension('K', Buffer.from('../first\0')), member({ path: 'a', type: '1', link: 'raw' }), member({ path: 'b', type: '2', link: 'raw' }));
  assert.deepEqual(run(bytes).events.map((event) => event.linkpath), ['../first', 'raw']);
});
test('empty PAX payload is a pending local record and can precede a member', () => {
  assert.equal(run(archive(extension('x', Buffer.alloc(0)), member())).summary.entries, 1);
  rejects(archive(extension('x', Buffer.alloc(0))), 'E_DANGLING_EXTENSION');
});
test('zero-length GNU payload fails', () => rejects(archive(extension('L', Buffer.alloc(0)), member()), 'E_GNU_LONG'));
test('UTF8 decoding rejects overlong and surrogate encodings', () => {
  for (const prefix of [[0xc0, 0xaf], [0xed, 0xa0, 0x80], [0xe2, 0x82]]) {
    const bytes = header({ path: '' });
    bytes.set(prefix);
    rejects(archive(checksum(bytes)), 'E_UTF8');
  }
});
test('unsigned checksum handles non-ASCII names', () => {
  const bytes = header({ path: '猫' });
  assert.equal(run(archive(bytes)).events[0].path, '猫');
  bytes.fill(32, 148, 156);
  const sum = bytes.reduce((total, byte) => total + (byte >= 128 ? byte - 256 : byte), 0);
  bytes.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  rejects(archive(bytes), 'E_CHECKSUM');
});
test('proxy chunks fail before invoking any traps', () => {
  let traps = 0;
  const bytes = new Proxy(new Uint8Array(10), { get() { traps++; throw new Error('trap'); }, getPrototypeOf() { traps++; throw new Error('trap'); } });
  assert.throws(() => createTarInventory().feed(bytes), { code: 'E_CHUNK' });
  assert.equal(traps, 0);
});
test('native typed-array validation does not traverse poisoned prototypes', () => {
  const bytes = new Uint8Array(archive());
  let traps = 0;
  Object.setPrototypeOf(bytes, new Proxy({}, { getPrototypeOf() { traps++; throw new Error('trap'); }, get() { traps++; throw new Error('trap'); } }));
  const parser = createTarInventory();
  parser.feed(bytes);
  assert.equal(parser.finish().entries, 0);
  assert.equal(traps, 0);
});
test('JSON escape, LF and multibyte bytes all count toward event admission', () => {
  const bytes = archive(member({ path: 'é"猫' }));
  const { events, summary } = run(bytes);
  assert.equal(summary.outputBytes, Buffer.byteLength(`${JSON.stringify(events[0])}\n`, 'utf8'));
  assert.ok(summary.outputBytes > JSON.stringify(events[0]).length + 1);
  rejects(bytes, 'E_OUTPUT_BYTES', { maxOutputBytes: summary.outputBytes - 1 });
});
test('event JSON budget exact and cap plus one', () => {
  const bytes = archive(member());
  const size = run(bytes).summary.outputBytes;
  assert.equal(run(bytes, { maxEventBytes: size }).summary.outputBytes, size);
  rejects(bytes, 'E_EVENT_BYTES', { maxEventBytes: size - 1 });
});
test('standalone total metadata budget exact and cap plus one', () => {
  const bytes = archive(member({ path: 'a' }), member({ path: 'b' }));
  const size = run(bytes).summary.outputBytes;
  assert.equal(run(bytes, { maxOutputBytes: size }).summary.outputBytes, size);
  rejects(bytes, 'E_OUTPUT_BYTES', { maxOutputBytes: size - 1 });
});
test('collision key UTF8 byte budget exact and cap plus one', () => {
  const bytes = archive(member({ path: 'é' }), member({ path: '猫' }));
  assert.equal(run(bytes, { maxCollisionBytes: 5 }).summary.collisionBytes, 5);
  rejects(bytes, 'E_COLLISION_BYTES', { maxCollisionBytes: 4 });
});
test('chunk admission exact and cap plus one', () => {
  const parser = createTarInventory({ maxChunkBytes: 1024 });
  parser.feed(archive());
  parser.finish();
  assert.throws(() => createTarInventory({ maxChunkBytes: 1023 }).feed(archive()), { code: 'E_CHUNK' });
  assert.equal(INVENTORY_LIMITS.maxChunkBytes, 1048576);
});
test('data-event budget counts zero blocks and rejects before processing', () => {
  const parser = createTarInventory({ maxDataEvents: 2 });
  parser.feed(Buffer.alloc(512));
  parser.feed(Buffer.alloc(512));
  assert.equal(parser.finish().dataEvents, 2);
  const limited = createTarInventory({ maxDataEvents: 1 });
  limited.feed(Buffer.alloc(512));
  assert.throws(() => limited.feed(Buffer.alloc(512)), { code: 'E_DATA_EVENTS' });
});
test('metadata digest ignores payload contents rather than claiming payload integrity', () => {
  const a = run(archive(member({}, Buffer.from('AAA')))).summary;
  const b = run(archive(member({}, Buffer.from('BBB')))).summary;
  assert.equal(a.metadataSha256, b.metadataSha256);
  assert.equal(a.provenanceVerified, false);
});

test('metadata schema and digest match literal UTF8 JSON-LF framing for files and links', () => {
  const { events, summary } = run(archive(member({ path: 'r/猫' }, Buffer.from('x')),
    member({ path: 'link', type: '2', link: '../outside' })));
  const expected = '{"index":1,"path":"r/猫","type":"file","size":1,"mode":420,"uid":1,"gid":2,"mtime":"3"}\n' +
    '{"index":2,"path":"link","type":"symlink","size":0,"linkpath":"../outside","linkKind":"parent-components","mode":420,"uid":1,"gid":2,"mtime":"3"}\n';
  assert.equal(events.map(event => JSON.stringify(event) + '\n').join(''), expected);
  assert.equal(summary.metadataSha256, createHash('sha256').update(expected, 'utf8').digest('hex'));
  assert.equal(summary.outputBytes, Buffer.byteLength(expected, 'utf8'));
});

test('static source contracts stay offline and point to the parent-owned SPEC', async () => {
  const spec = '_spec/tooling/native-ingress/inventory.puml';
  const names = ['tar-inventory.mjs', 'tar-inventory.test.mjs', 'inventory-controller.mjs', 'inventory-controller.test.mjs'];
  const diagram = await readFile(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(await readFile(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(entry => entry.spec === spec), [{ spec,
    covers: names.map(name => 'tooling/native-ingress/' + name), fingerprint: null }]);
  for (const name of names) {
    const source = await readFile(new URL(name, import.meta.url), 'utf8');
    assert.equal(source.split('\n')[0], '// SPEC: ' + spec);
    assert.ok(diagram.includes("' covers: tooling/native-ingress/" + name + '\n'));
    if (name.endsWith('.test.mjs')) continue;
    assert.doesNotMatch(source, /(?:node:|from ['"])(?:fs|child_process|net|http|https|dns|worker_threads|process)/);
    assert.doesNotMatch(source, /\b(?:fetch|spawn|exec|inspectArchive|safeToExtract|compressedArchiveVerified)\s*[:(]/);
    assert.doesNotMatch(source, /\bprocess\s*[.[]/);
    for (const match of source.matchAll(/from '([^']+)'/g)) assert.ok(['node:crypto', 'node:util', './tar-inventory.mjs'].includes(match[1]));
  }
});

function spans(bytes, chunk = bytes.length, budget = 4_194_304, overrides = {}) {
  const parser = createTarMemberInventory(overrides, budget);
  const events = [];
  for (let offset = 0; offset < bytes.length; offset += chunk) events.push(...parser.feed(bytes.subarray(offset, offset + chunk)));
  return { events, summary: parser.finish() };
}

for (const chunk of [1, 7, 511, 512, 513, 1023, 4096]) {
  test(`member spans measure consumed bytes across chunks ${chunk}`, () => {
    const bytes = archive(member({ path: 'a' }, Buffer.from('abc')), member({ path: 'empty' }), member({ path: 'b' }, Buffer.alloc(513, 42)));
    const { events, summary } = spans(bytes, chunk);
    assert.equal(summary.state, 'TAR_MEMBER_INVENTORY');
    assert.deepEqual(summary.fileSpans, [
      { index: 1, path: 'a', bodyOffset: 512, size: 3 },
      { index: 2, path: 'empty', bodyOffset: 1536, size: 0 },
      { index: 3, path: 'b', bodyOffset: 2048, size: 513 },
    ]);
    const old = run(bytes, {}, chunk);
    const { fileSpans, ...base } = summary;
    assert.deepEqual({ ...base, state: 'TAR_INVENTORY' }, old.summary);
    assert.deepEqual(events, old.events);
    assert.equal(Object.isFrozen(summary), true);
    assert.equal(Object.isFrozen(fileSpans), true);
    for (const span of fileSpans) assert.equal(Object.isFrozen(span), true);
    assert.equal(bytes.subarray(fileSpans[0].bodyOffset, fileSpans[0].bodyOffset + 3).toString(), 'abc');
  });
}

test('member spans omit directories and links while preserving entry indices', () => {
  const bytes = archive(member({ path: 'dir/', type: '5' }), member({ path: 's', type: '2', link: 'a' }),
    member({ path: 'h', type: '1', link: 'a' }), member({ path: './a', type: '\0' }, Buffer.from('x')));
  assert.deepEqual(spans(bytes).summary.fileSpans, [{ index: 4, path: 'a', bodyOffset: 2048, size: 1 }]);
});

for (const [label, extensions, name] of [
  ['GNU', [extension('L', Buffer.from('long/name\0'))], 'long/name'],
  ['local PAX', [extension('x', paxRecord('path', 'local'))], 'local'],
  ['global PAX', [extension('g', paxRecord('path', 'global'))], 'global'],
  ['precedence', [extension('g', paxRecord('path', 'global')), extension('L', Buffer.from('gnu\0')), extension('x', paxRecord('path', 'local'))], 'local'],
]) {
  test(`member spans use effective ${label} path and physical extension offsets`, () => {
    assert.deepEqual(spans(archive(...extensions, member({}, Buffer.from('x'))), 13).summary.fileSpans,
      [{ index: 1, path: name, bodyOffset: extensions.reduce((sum, item) => sum + item.length, 512), size: 1 }]);
  });
}

test('member spans use effective local size over global and header sizes', () => {
  const bytes = archive(extension('g', paxRecord('size', '9')), extension('x', paxRecord('size', '3')),
    Buffer.concat([header({ size: 0 }), Buffer.from('abc'), Buffer.alloc(509)]));
  assert.deepEqual(spans(bytes, 29).summary.fileSpans, [{ index: 1, path: 'root/file', bodyOffset: 2560, size: 3 }]);
});

test('member spans clear a global size locally to the physical header size', () => {
  const bytes = archive(extension('g', paxRecord('size', '9')), extension('x', paxRecord('size', '')), member({}, Buffer.from('abc')));
  assert.equal(spans(bytes).summary.fileSpans[0].size, 3);
});

test('member span JSON budget admits exact bytes and rejects before retention', () => {
  const bytes = archive(member({ path: 'é' }), member({ path: 'b' }));
  const size = Buffer.byteLength(JSON.stringify(spans(bytes).summary.fileSpans));
  assert.equal(spans(bytes, 19, size).summary.fileSpans.length, 2);
  assert.throws(() => spans(bytes, 19, size - 1), { code: 'E_SPAN_BYTES' });
  assert.deepEqual(spans(archive(), 512, 2).summary.fileSpans, []);
  assert.throws(() => spans(archive(), 512, 1), { code: 'E_SPAN_BYTES' });
});

for (const budget of [0, -1, 1.5, NaN, Infinity, '1', 4_194_305]) {
  test(`member span budget rejects ${String(budget)}`, () => assert.throws(() => createTarMemberInventory({}, budget), { code: 'E_LIMITS' }));
}

for (const [label, mutate] of [
  ['late checksum', bytes => { bytes[1024] = 1; }],
  ['padding', bytes => { bytes[513] = 1; }],
  ['late EOF', bytes => Buffer.concat([bytes, Buffer.from([1])])],
  ['truncation', bytes => bytes.subarray(0, -1)],
]) {
  test(`member spans never publish on ${label}`, () => {
    const initial = archive(member({ path: 'a' }, Buffer.from('x')));
    const bytes = mutate(initial) ?? initial;
    const parser = createTarMemberInventory();
    assert.throws(() => { parser.feed(bytes); parser.finish(); }, InventoryError);
    assert.throws(() => parser.finish(), InventoryError);
  });
}

test('member spans reject aliases and retain every existing admission limit', () => {
  assert.throws(() => spans(archive(member({ path: 'a' }), member({ path: './a' }))), { code: 'E_COLLISION' });
  assert.throws(() => spans(archive(member()), 512, 1024, { maxHeaders: 1, maxExpandedBytes: 1024 }), { code: 'E_EXPANDED_BYTES' });
});
