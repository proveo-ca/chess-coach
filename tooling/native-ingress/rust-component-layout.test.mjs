// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { RUST_LAYOUT_INPUTS, RUST_LAYOUT_LIMITS, RUST_LAYOUT_ROLES, createRustLayoutFixture } from './rust-component-layout.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const escapedAscii = value => JSON.stringify(value).replace(/[^\x00-\x7f]/g, char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
const escapedBytes = value => escapedAscii(value).length;
const read = name => readFileSync(new URL(name, import.meta.url));
const originalTar = read('./tar-inventory.mjs');
const layoutSource = read('./rust-component-layout.mjs').toString('utf8');
assert.equal(originalTar.length, 15548);
assert.equal(sha(originalTar), '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139');
const extensionDefault = 'maxExtensionBytes: 65_536';
const extensionGuard = "if (size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');";
const v4Tar = originalTar.toString('utf8').replace(extensionDefault, 'maxExtensionBytes: 4_194_304')
  .replace(extensionGuard, "if (size > 65_536 || size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');");
assert.equal(Buffer.byteLength(v4Tar), 15568);
assert.equal(sha(v4Tar), '56cac49b3cfe51dbf2a7f7d1f4a0d877ae8773f940585ebea72740373689fae2');
const eventNeedle = '{ index: entries + 1, path: key, type: kind, size }';
assert.equal(v4Tar.split(eventNeedle).length, 2);
const privateTarSource = v4Tar.replace(eventNeedle, '{ index: entries + 1, path: key, type: kind, size, bodyOffset: consumedBytes }');
const privateTar = await import(uri(privateTarSource));
let moduleSerial = 0;
const productionModule = () => import(uri(layoutSource.replace("from './tar-inventory.mjs'", `from '${uri(privateTarSource)}'`)) + '#' + ++moduleSerial);
const receipt = JSON.parse(read('../../_spec/tooling/native-ingress/rust-runtime-inputs.receipt.json'));
const fixedPins = [
  ['tar-inventory.mjs', 15548, '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139'],
  ['gnu-sdk-inventory.mjs', 23261, 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29'],
  ['gnu-sdk-inventory-v4-operation.mjs', 12608, '2ea3c1bfe71676c37d01a05b64f9d3f11e4a7d7d93541cfdc4707a378bae17db'],
];
const oldSources = new Map(fixedPins.map(([name]) => [name, read('./' + name)]));

function checksum(header) {
  header.fill(32, 148, 156);
  header.write(header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return header;
}
function header({ path = RUST_LAYOUT_INPUTS[0].expectedRoot + '/file', size = 0, type = '0', link = '', format = 'posix' } = {}) {
  const bytes = Buffer.alloc(512);
  bytes.write(path, 0, 100, 'utf8');
  for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, size], [136, 12, 0]]) {
    bytes.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  }
  bytes[156] = type.charCodeAt(0);
  bytes.write(link, 157, 100, 'utf8');
  if (format !== 'v7') { bytes.write(format === 'gnu' ? 'ustar ' : 'ustar\0', 257, 6, 'ascii'); bytes.write(format === 'gnu' ? ' \0' : '00', 263, 2, 'ascii'); }
  return checksum(bytes);
}
const member = (options = {}, body = Buffer.alloc(0)) => Buffer.concat([header({ ...options, size: body.length }), body, Buffer.alloc((512 - body.length % 512) % 512)]);
const archive = (...members) => Buffer.concat([...members, Buffer.alloc(1024)]);
const pathAt = (i, suffix) => RUST_LAYOUT_INPUTS[i].expectedRoot + (suffix ? '/' + suffix : '');
const regular = (i, suffix = 'file', body = '') => member({ path: pathAt(i, suffix) }, typeof body === 'string' ? Buffer.from(body) : body);
const manifest = (i, text, prefix = 'component') => regular(i, prefix + '/manifest.in', text);
function pax(key, value) {
  const body = ` ${key}=${value}\n`;
  let length = Buffer.byteLength(body) + 1;
  while (String(length).length + Buffer.byteLength(body) !== length) length = String(length).length + Buffer.byteLength(body);
  return Buffer.from(String(length) + body);
}
function profile(limits = {}) {
  return { mockOnly: true, limits, inputs: RUST_LAYOUT_INPUTS.map((input, i) => {
    const root = '/fixture/rust-layout-' + i, archiveBytes = i + 3;
    const identity = { root: { ...input.identity.root, dev: '101', ino: String(i + 1) },
      file: { ...input.identity.file, dev: '202', ino: String(i + 11), size: String(archiveBytes) } };
    return { ...input, root, file: `${root}/${input.expectedRoot}.tar.xz`, archiveBytes, archiveSha256: sha('synthetic-compressed-' + i), identity };
  }) };
}
function coreFor(input, inventory, mockOnly = true) {
  return { state: 'GNU_SDK_DATA_INVENTORY', mockOnly, inventory,
    archiveBytes: input.archiveBytes, archiveSha256: input.archiveSha256, archivePasses: 2,
    archiveDataBytes: input.archiveBytes * 2, archiveRequestedBytes: input.archiveBytes * 2 + 2,
    closeAttempts: 2, stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true,
    exitCode: 0, signal: null, extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false };
}
function harness(options = {}) {
  const p = profile(options.limits);
  const log = { arrays: [], events: [], summaries: [], parserLimits: [], calls: 0 };
  const factory = options.factory ?? (limits => {
    log.calls++; log.parserLimits.push(limits);
    const parser = privateTar.createTarInventory(limits);
    return Object.freeze({
      feed(bytes) {
        const original = parser.feed(bytes);
        const events = options.events ? options.events(original, bytes, log.arrays.length) : original;
        log.arrays.push(events); log.events.push(...original);
        return events;
      },
      finish() { const summary = parser.finish(); log.summaries.push(summary); return options.summary ? options.summary(summary) : summary; },
    });
  });
  const batch = createRustLayoutFixture(p, factory);
  return { batch, p, log };
}
function parseRole(h, i, bytes = archive(regular(i)), chunkSize = 65536, overrides) {
  h.batch.beginLayoutRole(RUST_LAYOUT_ROLES[i]);
  const parser = overrides === undefined ? h.batch.createTarInventory() : h.batch.createTarInventory(overrides);
  const arrays = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) arrays.push(parser.feed(bytes.subarray(offset, offset + chunkSize)));
  const inventory = parser.finish();
  return { parser, arrays, inventory, core: coreFor(h.p.inputs[i], inventory) };
}
function runBatch(options = {}, archives = []) {
  const h = harness(options);
  h.batch.beginLayoutBatch();
  for (let i = 0; i < 5; i++) { const parsed = parseRole(h, i, archives[i]); h.batch.acceptLayoutRole(parsed.core); }
  return { ...h, result: h.batch.finishLayoutBatch() };
}
function throwsCode(fn, code) {
  assert.throws(fn, error => {
    assert.equal(error.code, code);
    assert.equal(Object.isFrozen(error), true);
    for (const key of ['result', 'inventory', 'members', 'texts', 'cause']) assert.equal(Object.hasOwn(error, key), false);
    return true;
  });
}
function assertReleased(batch) {
  const snapshot = batch.snapshotLayout();
  assert.equal(snapshot.currentRole, null);
  for (const key of ['acceptedRoles', 'entries', 'expandedBytes', 'metadataBytes', 'manifestBytes', 'outputBytes']) assert.equal(snapshot[key], 0);
  assert.equal(JSON.stringify(snapshot).includes('manifest.in'), false);
}

test('fixed descriptors exactly transcribe all receipt identity fields without a same-device condition', () => {
  assert.deepEqual(RUST_LAYOUT_ROLES, ['cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview']);
  assert.equal(RUST_LAYOUT_INPUTS.length, 5);
  for (let i = 0; i < 5; i++) {
    const input = RUST_LAYOUT_INPUTS[i], expected = receipt.inputs[i];
    assert.deepEqual(input, { role: expected.role, root: receipt.root, file: receipt.root + '/' + expected.name,
      archiveBytes: expected.byteLength, archiveSha256: expected.readbackSha256,
      expectedRoot: expected.name.slice(0, -7), identity: { root: receipt.rootFinal, file: expected.finalMetadata } });
    assert.equal(input.identity.root.gid, '1000'); assert.notEqual(input.identity.root.dev, input.identity.file.dev);
    for (const value of [input, input.identity, input.identity.root, input.identity.file]) assert.ok(Object.isFrozen(value));
  }
  for (const value of [RUST_LAYOUT_ROLES, RUST_LAYOUT_INPUTS, RUST_LAYOUT_LIMITS]) assert.ok(Object.isFrozen(value));
});
test('all fixed bounds use the accepted camel-case contract', () => {
  assert.deepEqual(RUST_LAYOUT_LIMITS, { maxExpandedBytes: 1073741824, maxBatchExpandedBytes: 2147483648,
    maxEntries: 32768, maxBatchEntries: 65536, maxRoleMetadataBytes: 4194304, maxBatchMetadataBytes: 8388608,
    maxManifestBytes: 1048576, maxBatchManifestBytes: 4194304, maxOutputBytes: 16777216 });
});
test('private source changes only the pinned V4 budgets and exact event literal', () => {
  assert.equal(privateTarSource.replace('{ index: entries + 1, path: key, type: kind, size, bodyOffset: consumedBytes }', eventNeedle), v4Tar);
  assert.equal(layoutSource.split("from './tar-inventory.mjs'").length, 2);
  assert.ok(layoutSource.startsWith('// SPEC: _spec/tooling/native-ingress/step2.puml\n'));
  assert.doesNotMatch(layoutSource, /node:(?:fs|child_process)|readFile|spawn\(|createTarMemberInventory/u);
});
test('original source pins remain unchanged by private transformation', () => {
  for (const [name, length, digest] of fixedPins) {
    const bytes = read('./' + name);
    assert.deepEqual(bytes, oldSources.get(name));
    assert.equal(bytes.length, length); assert.equal(sha(bytes), digest);
  }
});
test('decoded hashing includes accepted trailing zero blocks', () => {
  const bytes = Buffer.concat([archive(regular(0, 'file', 'x')), Buffer.alloc(1024)]);
  const { result } = runBatch({}, [bytes]);
  assert.equal(result.roles[0].decodedSha256, sha(bytes)); assert.equal(result.roles[0].members[0].bodySha256, sha('x'));
});
test('actual privately linked production collector records spans and body hashes with original event identity', async () => {
  const m = await productionModule();
  m.beginLayoutBatch();
  for (let i = 0; i < 5; i++) {
    m.beginLayoutRole(RUST_LAYOUT_ROLES[i]);
    const parser = m.createTarInventory({ maxExpandedBytes: 1073741824, maxHeaders: 32768 });
    const data = archive(regular(i, 'file', 'production-linked-synthetic'));
    const events = parser.feed(data);
    assert.equal(events[0].bodyOffset, 512); assert.ok(Object.isFrozen(events[0]));
    const inventory = parser.finish();
    m.acceptLayoutRole(coreFor(RUST_LAYOUT_INPUTS[i], inventory, false));
  }
  const result = m.finishLayoutBatch();
  assert.equal(result.profile, 'RUST_COMPONENT_LAYOUT_DATA'); assert.equal(result.mockOnly, false);
  assert.equal(result.roles[0].members[0].bodySha256, sha('production-linked-synthetic'));
  for (const flag of ['nativeAuthority', 'completeInstallMap', 'completeInstallerInterpretation', 'rustReady', 'dockerProviderQualified']) assert.equal(result[flag], false);
  assert.match(result.verificationScope, /do not prove real decoder/u);
  assertReleased(m);
});
test('fixture returns the original frozen feed arrays, event objects, and pending summary by identity', () => {
  const h = harness(); h.batch.beginLayoutBatch();
  const parsed = parseRole(h, 0, archive(regular(0, 'file', 'body')), 513);
  parsed.arrays.forEach((events, i) => assert.equal(events, h.log.arrays[i]));
  assert.equal(parsed.arrays.flat()[0], h.log.events[0]);
  assert.equal(parsed.inventory, h.log.summaries[0]);
  assert.equal(h.batch.snapshotLayout().acceptedRoles, 0);
  h.batch.acceptLayoutRole(parsed.core);
  assert.equal(h.batch.snapshotLayout().acceptedRoles, 1);
});
for (const chunkSize of [1, 7, 511, 512, 513, 700, 1023, 1024, 4096, 65536]) {
  test(`header/body/padding boundaries preserve hashes at chunk size ${chunkSize}`, () => {
    const h = harness(); h.batch.beginLayoutBatch();
    const body = Buffer.from('abc'.repeat(351));
    const data = archive(regular(0, 'file', body));
    const parsed = parseRole(h, 0, data, chunkSize);
    h.batch.acceptLayoutRole(parsed.core);
    for (let i = 1; i < 5; i++) h.batch.acceptLayoutRole(parseRole(h, i).core);
    const result = h.batch.finishLayoutBatch();
    assert.equal(result.roles[0].members[0].bodySha256, sha(body));
    assert.equal(result.roles[0].decodedSha256, sha(data));
    assert.equal(result.roles[0].members[0].bodyOffset, 512);
    assert.equal(result.mockOnly, true);
  });
}
test('a previous body and multiple new bodies end in one chunk without hashing headers or padding', () => {
  const h = harness(); h.batch.beginLayoutBatch(); h.batch.beginLayoutRole('cargo');
  const parser = h.batch.createTarInventory();
  const a = Buffer.alloc(900, 97), b = Buffer.from('bb'), c = Buffer.from('ccc');
  const bytes = archive(regular(0, 'a', a), regular(0, 'b', b), regular(0, 'c', c), regular(0, 'empty'));
  parser.feed(bytes.subarray(0, 600)); const events = parser.feed(bytes.subarray(600));
  assert.equal(events.length, 3);
  const inventory = parser.finish(); h.batch.acceptLayoutRole(coreFor(h.p.inputs[0], inventory));
  for (let i = 1; i < 5; i++) h.batch.acceptLayoutRole(parseRole(h, i).core);
  assert.deepEqual(h.batch.finishLayoutBatch().roles[0].members.map(file => file.bodySha256), [sha(a), sha(b), sha(c), sha('')]);
});
test('empty regular bodies get the SHA256 empty digest and do not consume the following header', () => {
  const { result } = runBatch({}, [archive(regular(0, 'a'), regular(0, 'b'), regular(0, 'c', 'x'))]);
  assert.deepEqual(result.roles[0].members.map(file => file.bodySha256), [sha(''), sha(''), sha('x')]);
});
test('empty archives require no component list, manifest, installer version, or component count', () => {
  const { result } = runBatch({}, Array.from({ length: 5 }, () => archive()));
  assert.equal(result.entries, 0); assert.equal(result.roles.length, 5); assert.equal(result.manifestBytes, 0);
});
for (const format of ['gnu', 'v7', 'posix']) {
  test(`original ${format} TAR headers remain authoritative`, () => {
    const { result } = runBatch({}, [archive(member({ path: pathAt(0, 'file'), format }, Buffer.from('x')))]);
    assert.equal(result.roles[0].members[0].bodySha256, sha('x'));
  });
}
test('PAX and GNU extension bodies do not become files or distort body offsets', () => {
  const longPath = pathAt(0, 'nested/' + 'z'.repeat(150));
  const bytes = archive(member({ path: 'extension', type: 'x' }, pax('path', longPath)), regular(0, 'short', 'abc'),
    member({ path: 'extension', type: 'L', format: 'gnu' }, Buffer.from(pathAt(0, 'long') + '\0')), regular(0, 'ignored', 'def'));
  const { result } = runBatch({}, [bytes]);
  assert.deepEqual(result.roles[0].members.map(file => [file.path, file.bodyOffset, file.bodySha256]), [
    [longPath, 1536, sha('abc')], [pathAt(0, 'long'), 3584, sha('def')],
  ]);
});
for (const [name, mutate] of [
  ['nonzero padding', bytes => { bytes[513] = 1; return bytes; }],
  ['nonzero trailer', bytes => { bytes[bytes.length - 1] = 1; return bytes; }],
  ['header checksum', bytes => { bytes[0] ^= 1; return bytes; }],
  ['truncated terminator', bytes => bytes.subarray(0, -512)],
  ['partial trailer', bytes => Buffer.concat([bytes, Buffer.alloc(1)])],
]) {
  test(`${name} fails closed through the original parser`, () => {
    const h = harness(); h.batch.beginLayoutBatch();
    throwsCode(() => parseRole(h, 0, mutate(archive(regular(0, 'file', 'x')))), 'E_LAYOUT_DATA');
    assertReleased(h.batch); throwsCode(() => h.batch.finishLayoutBatch(), 'E_LAYOUT_STATE');
  });
}
test('V4 independently rejects an extension payload larger than 64 KiB', () => {
  const h = harness(); h.batch.beginLayoutBatch();
  throwsCode(() => parseRole(h, 0, archive(member({ path: 'extension', type: 'L' }, Buffer.alloc(65537, 97)))), 'E_LAYOUT_DATA');
});
test('V4 cumulative extension payload exceeds the old 64 KiB total without expanding individual payloads', () => {
  const members = [];
  for (let i = 0; i < 70; i++) {
    const path = pathAt(0, String(i).padStart(3, '0') + '-' + 'z'.repeat(900));
    members.push(member({ path: 'extension', type: 'L', format: 'gnu' }, Buffer.from(path + '\0')), regular(0, 'ignored-' + i));
  }
  const { result } = runBatch({}, [archive(...members)]);
  assert.ok(result.roles[0].inventory.extensionBytes > 65536); assert.equal(result.roles[0].members.length, 70);
});
for (const [name, bytes] of [
  ['dangling local PAX', archive(member({ path: 'extension', type: 'x' }, pax('path', pathAt(0, 'file'))))],
  ['one zero header before a member', archive(Buffer.alloc(512), regular(0))],
  ['duplicate archive path', archive(regular(0), regular(0))],
  ['invalid extension record', archive(member({ path: 'extension', type: 'x' }, Buffer.from('1 invalid\n')), regular(0))],
]) {
  test(`original parser rejects ${name} without a partial layout result`, () => {
    const h = harness(); h.batch.beginLayoutBatch(); throwsCode(() => parseRole(h, 0, bytes), 'E_LAYOUT_DATA'); assertReleased(h.batch);
  });
}
test('links remain un-followed data, including absolute and parent-component targets', () => {
  const bytes = archive(member({ path: pathAt(0, 'link'), type: '2', link: '/not-read/host' }),
    member({ path: pathAt(0, 'hard'), type: '1', link: '../../not-read' }));
  const { result } = runBatch({}, [bytes]);
  assert.deepEqual(result.roles[0].members.map(file => [file.type, file.linkpath, file.linkKind]), [
    ['symlink', '/not-read/host', 'absolute'], ['hardlink', '../../not-read', 'parent-components'],
  ]);
  for (const file of result.roles[0].members) assert.equal(Object.hasOwn(file, 'bodySha256'), false);
});
test('only root components/version and descendant manifest.in regular files become text data', () => {
  const bytes = archive(regular(0, 'components', ' component\n\n'), regular(0, 'rust-installer-version', 'unknown\r\n'),
    manifest(0, 'file:bin/a\n'), regular(0, 'component/components', Buffer.from([255])),
    regular(0, 'component/rust-installer-version', Buffer.from([255])), regular(0, 'component/manifest.in.bak', Buffer.from([255])),
    member({ path: pathAt(0, 'linked/manifest.in'), type: '2', link: '/opaque' }));
  const { result } = runBatch({}, [bytes]);
  assert.deepEqual(result.roles[0].texts.map(text => [text.kind, text.text]), [
    ['components', ' component\n\n'], ['installer-version', 'unknown\r\n'], ['manifest', 'file:bin/a\n'],
  ]);
});
test('rustfmt and clippy roles use their archive basenames rather than preview role names', () => {
  const { result } = runBatch();
  assert.equal(result.roles[3].members[0].path, 'rustfmt-1.95.0-x86_64-unknown-linux-gnu/file');
  assert.equal(result.roles[4].members[0].path, 'clippy-1.95.0-x86_64-unknown-linux-gnu/file');
});
test('a root directory itself is allowed but a root regular file is not', () => {
  const { result } = runBatch({}, [archive(member({ path: pathAt(0), type: '5' }))]);
  assert.equal(result.roles[0].members[0].type, 'directory');
  const h = harness(); h.batch.beginLayoutBatch(); throwsCode(() => parseRole(h, 0, archive(member({ path: pathAt(0) }))), 'E_LAYOUT_ROOT');
});
for (const suffix of ['evil/file', '-extra/file', '2/file']) {
  test(`root prefix lookalike ${suffix} is rejected`, () => {
    const h = harness(); h.batch.beginLayoutBatch();
    throwsCode(() => parseRole(h, 0, archive(member({ path: pathAt(0) + suffix }))), 'E_LAYOUT_ROOT');
  });
}
test('unmodified old parser cannot silently omit body offsets', () => {
  const h = harness({ events: events => Object.freeze(events.map(event => { const { bodyOffset, ...rest } = event; return Object.freeze(rest); })) });
  h.batch.beginLayoutBatch(); throwsCode(() => parseRole(h, 0), 'E_LAYOUT_EVENT'); assertReleased(h.batch);
});
for (const [name, change] of [
  ['unaligned offset', event => ({ ...event, bodyOffset: event.bodyOffset + 1 })],
  ['offset before header', event => ({ ...event, bodyOffset: 0 })],
  ['future offset', event => ({ ...event, bodyOffset: 999936 })],
  ['unsafe offset', event => ({ ...event, bodyOffset: 2 ** 53 })],
  ['wrong index', event => ({ ...event, index: 2 })],
  ['unknown field', event => ({ ...event, provisional: true })],
  ['negative size', event => ({ ...event, size: -1 })],
  ['unsafe uid', event => ({ ...event, uid: 2 ** 53 })],
  ['bad mtime', event => ({ ...event, mtime: 'NaN' })],
  ['bad mode', event => ({ ...event, mode: -1 })],
]) {
  test(`collector independently rejects ${name}`, () => {
    const h = harness({ events: events => Object.freeze(events.map(event => Object.freeze(change(event)))) });
    h.batch.beginLayoutBatch(); throwsCode(() => parseRole(h, 0), 'E_LAYOUT_EVENT'); assertReleased(h.batch);
  });
}
test('overlapping body intervals from a trusted mock fail before publication', () => {
  const h = harness({ events: events => Object.freeze(events.map((event, i) => Object.freeze(i ? { ...event, bodyOffset: 512 } : event))) });
  h.batch.beginLayoutBatch(); throwsCode(() => parseRole(h, 0, archive(regular(0, 'a'), regular(0, 'b'))), 'E_LAYOUT_EVENT');
});
test('proxy and accessor events are rejected without executing traps/getters', () => {
  for (const wrap of [event => new Proxy(event, { ownKeys() { assert.fail('proxy trap ran'); } }),
    event => Object.freeze(Object.defineProperty({ ...event }, 'path', { get() { assert.fail('getter ran'); }, enumerable: true }))]) {
    const h = harness({ events: events => Object.freeze(events.map(wrap)) }); h.batch.beginLayoutBatch();
    throwsCode(() => parseRole(h, 0), 'E_LAYOUT_INPUT');
  }
});
test('manifest unsupported lines remain opaque data and terminal LF is not an extra line', () => {
  const text = 'file:bin/a\nopaque:../../data\n\nDIR:unchecked\n';
  const { result } = runBatch({}, [archive(manifest(0, text))]);
  const captured = result.roles[0].texts[0];
  assert.equal(captured.text, text);
  assert.deepEqual(captured.lines, [{ lineNumber: 1, recognized: true, type: 'file', destination: 'bin/a' },
    { lineNumber: 2, text: 'opaque:../../data', recognized: false }, { lineNumber: 3, text: '', recognized: false },
    { lineNumber: 4, text: 'DIR:unchecked', recognized: false }]);
  assert.equal(result.unknownManifestLines, 3); assert.equal(result.completeInstallerInterpretation, false);
});
test('unknown lines may contain control characters, BOM, backslashes and foreign installer syntax as data', () => {
  const text = '\ufefffile:../../opaque\n#\\anything\u0000\r\nFILE:C:\\opaque\n';
  const { result } = runBatch({}, [archive(manifest(0, text))]);
  assert.equal(result.roles[0].texts[0].text, text); assert.equal(result.roles[0].declarations.length, 0);
});
test('an empty manifest is one opaque empty line while a single LF has no terminal sentinel', () => {
  for (const text of ['', '\n']) {
    const { result } = runBatch({}, [archive(manifest(0, text))]);
    assert.deepEqual(result.roles[0].texts[0].lines, [{ lineNumber: 1, text: '', recognized: false }]);
  }
});
for (const destination of ['', '/abs', '../up', 'a/../b', 'a/./b', 'a//b', 'a/', 'C:drive', 'D:/drive', 'a\\b', 'a\r', 'a\u0000b', 'a\u0085b', 'a'.repeat(1025)]) {
  test(`recognized manifest paths reject ${JSON.stringify(destination).slice(0, 80)}`, () => {
    const h = harness(); h.batch.beginLayoutBatch();
    throwsCode(() => parseRole(h, 0, archive(manifest(0, 'file:' + destination))), 'E_LAYOUT_DECLARATION'); assertReleased(h.batch);
  });
}
test('canonical file/dir declarations are data and do not imply an install map', () => {
  const { result } = runBatch({}, [archive(manifest(0, 'dir:lib\nfile:lib/a\nfile:space name\n'))]);
  assert.deepEqual(result.roles[0].declarations.map(item => [item.type, item.destination]), [['directory', 'lib'], ['file', 'lib/a'], ['file', 'space name']]);
  assert.equal(result.completeInstallMap, false); assert.equal(result.relocationReady, false); assert.equal(result.nativeQualified, false);
});
test('aggregate duplicate and file/directory kind conflicts retain every role declaration', () => {
  const archives = [archive(manifest(0, 'file:bin/tool\nfile:lib/mixed\n')),
    archive(manifest(1, 'file:bin/tool\ndir:lib/mixed\n'))];
  const { result } = runBatch({}, archives);
  assert.equal(result.roles[0].declarations.length, 2); assert.equal(result.roles[1].declarations.length, 2);
  const duplicate = result.destinations.find(item => item.destination === 'bin/tool');
  assert.equal(duplicate.count, 2); assert.deepEqual(duplicate.roles, ['cargo', 'rustc']);
  assert.equal(result.collisions.find(item => item.destination === 'bin/tool').conflict, true);
  assert.equal(result.collisions.find(item => item.destination === 'lib/mixed').kindConflict, true);
});
test('repeated directory declarations are observations, not automatic conflicts', () => {
  const { result } = runBatch({}, [archive(manifest(0, 'dir:lib\ndir:lib\n')), archive(manifest(1, 'dir:lib\n'))]);
  const item = result.collisions[0]; assert.equal(item.declarationCount, 3); assert.equal(item.repeatedDirectoryOnly, true);
  assert.equal(item.conflict, false); assert.equal(item.kindConflict, false);
});
test('non-directory ancestor conflicts count all ancestors without Cartesian declaration pairs', () => {
  const { result } = runBatch({}, [archive(manifest(0, 'file:a\nfile:a/b\nfile:a/b/c\nfile:aa/c\n')),
    archive(manifest(1, 'file:a\nfile:a\n'))]);
  const descendant = result.collisions.find(item => item.destination === 'a/b/c');
  assert.equal(descendant.nonDirectoryAncestorCount, 2); assert.equal(descendant.firstNonDirectoryAncestor, 'a');
  assert.equal(result.collisions.some(item => item.destination === 'aa/c'), false);
  assert.equal(result.collisions.length, 3);
});
test('many repeated declarations use one destination aggregate and one collision observation', () => {
  const { result } = runBatch({}, [archive(manifest(0, 'file:bin/a\n'.repeat(1000)))]);
  assert.equal(result.roles[0].declarations.length, 1000); assert.equal(result.destinations.length, 1); assert.equal(result.collisions.length, 1);
  assert.equal(result.destinations[0].count, 1000);
});
for (const suffix of ['components', 'rust-installer-version', 'part/manifest.in']) {
  test(`fatal UTF-8 in captured ${suffix} withholds the batch`, () => {
    const h = harness(); h.batch.beginLayoutBatch();
    throwsCode(() => parseRole(h, 0, archive(regular(0, suffix, Buffer.from([0xc3, 0x28])))), 'E_LAYOUT_DATA'); assertReleased(h.batch);
  });
}
test('ordinary file bytes do not require UTF-8', () => {
  const body = Buffer.from([255, 0, 128]); const { result } = runBatch({}, [archive(regular(0, 'binary', body))]);
  assert.equal(result.roles[0].members[0].bodySha256, sha(body)); assert.equal(result.roles[0].texts.length, 0);
});
test('capture decoding preserves a UTF-8 character split between incoming chunks', () => {
  const h = harness(); h.batch.beginLayoutBatch();
  h.batch.acceptLayoutRole(parseRole(h, 0, archive(regular(0, 'components', '😀é\n')), 513).core);
  for (let i = 1; i < 5; i++) h.batch.acceptLayoutRole(parseRole(h, i).core);
  assert.equal(h.batch.finishLayoutBatch().roles[0].texts[0].text, '😀é\n');
});
test('safe nonzero-offset Uint8Array views are hashed using only their declared span', () => {
  const h = harness(); h.batch.beginLayoutBatch(); h.batch.beginLayoutRole('cargo'); const parser = h.batch.createTarInventory();
  const data = archive(regular(0, 'file', 'abc')); const backing = Buffer.alloc(data.length + 20, 255); backing.set(data, 10);
  parser.feed(new Uint8Array(backing.buffer, backing.byteOffset + 10, data.length)); const inventory = parser.finish();
  h.batch.acceptLayoutRole(coreFor(h.p.inputs[0], inventory));
  for (let i = 1; i < 5; i++) h.batch.acceptLayoutRole(parseRole(h, i).core);
  const result = h.batch.finishLayoutBatch(); assert.equal(result.roles[0].decodedSha256, sha(data)); assert.equal(result.roles[0].members[0].bodySha256, sha('abc'));
});
for (const [name, make] of [
  ['proxy', () => new Proxy(new Uint8Array(10), { get() { assert.fail('proxy trap'); } })],
  ['shared backing', () => new Uint8Array(new SharedArrayBuffer(10))],
  ['empty', () => new Uint8Array(0)], ['oversized', () => new Uint8Array(65537)],
  ['wrong view', () => new Uint16Array(10)],
  ['accessor object', () => ({ get byteLength() { assert.fail('getter'); } })],
  ['detached', () => { const buffer = new ArrayBuffer(8); const view = new Uint8Array(buffer); structuredClone(buffer, { transfer: [buffer] }); return view; }],
]) {
  test(`rejects ${name} chunks before parser calls or copies`, () => {
    let calls = 0;
    const h = harness({ factory: () => ({ feed() { calls++; assert.fail('parser called'); }, finish() { assert.fail('finish called'); } }) });
    h.batch.beginLayoutBatch(); h.batch.beginLayoutRole('cargo'); const parser = h.batch.createTarInventory();
    throwsCode(() => parser.feed(make()), 'E_LAYOUT_CHUNK'); assert.equal(calls, 0); assertReleased(h.batch);
  });
}
test('resizable backing buffers are rejected before parsing when supported', { skip: !Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable') }, () => {
  const h = harness(); h.batch.beginLayoutBatch(); h.batch.beginLayoutRole('cargo');
  throwsCode(() => h.batch.createTarInventory().feed(new Uint8Array(new ArrayBuffer(8, { maxByteLength: 16 }))), 'E_LAYOUT_CHUNK');
});
test('chunk property accessors cannot override the intrinsic view bounds', () => {
  const h = harness(); h.batch.beginLayoutBatch(); h.batch.beginLayoutRole('cargo'); const parser = h.batch.createTarInventory();
  const bytes = archive(regular(0));
  Object.defineProperty(bytes, 'length', { get() { assert.fail('length getter'); } });
  Object.defineProperty(bytes, 'buffer', { get() { assert.fail('buffer getter'); } });
  parser.feed(bytes); h.batch.abortLayoutBatch(); assertReleased(h.batch);
});
test('per-role decoded budget accepts equality and stops one byte over before parser feed', () => {
  const data = archive(regular(0));
  runBatch({ limits: { maxExpandedBytes: data.length } });
  let calls = 0;
  const h = harness({ limits: { maxExpandedBytes: data.length - 1 }, factory: () => ({ feed() { calls++; }, finish() {} }) });
  h.batch.beginLayoutBatch(); h.batch.beginLayoutRole('cargo');
  throwsCode(() => h.batch.createTarInventory().feed(data), 'E_LAYOUT_EXPANDED'); assert.equal(calls, 0); assertReleased(h.batch);
});
test('batch decoded budget accepts equality and rejects the fifth role at +1 before parsing', () => {
  const total = archive(regular(0)).length * 5;
  assert.equal(runBatch({ limits: { maxBatchExpandedBytes: total } }).result.expandedBytes, total);
  const h = harness({ limits: { maxBatchExpandedBytes: total - 1 } }); h.batch.beginLayoutBatch();
  for (let i = 0; i < 4; i++) h.batch.acceptLayoutRole(parseRole(h, i).core);
  const before = h.log.arrays.length; throwsCode(() => parseRole(h, 4), 'E_LAYOUT_EXPANDED');
  assert.equal(h.log.arrays.length, before); assertReleased(h.batch);
});
test('parser limits match core bounds and never expand caller budgets', () => {
  const h = harness(); h.batch.beginLayoutBatch(); const parsed = parseRole(h, 0, undefined, 65536, { maxHeaders: 32768, maxExpandedBytes: 1073741824 });
  assert.equal(h.log.parserLimits[0].maxHeaders, 32768); assert.equal(h.log.parserLimits[0].maxChunkBytes, 65536);
  assert.equal(h.log.parserLimits[0].maxExtensionBytes, 4194304); h.batch.acceptLayoutRole(parsed.core);
});
for (const overrides of [{ maxHeaders: 32769 }, { maxChunkBytes: 65537 }, { maxExpandedBytes: 1073741825 }, { maxHeaders: 0 }, { maxHeaders: NaN }, { arbitrary: 1 }]) {
  test(`rejects parser budget expansion ${JSON.stringify(overrides)}`, () => {
    const h = harness(); h.batch.beginLayoutBatch(); h.batch.beginLayoutRole('cargo');
    throwsCode(() => h.batch.createTarInventory(overrides), 'E_LAYOUT_LIMIT'); assert.equal(h.log.calls, 0);
  });
}
test('per-role entry budget accepts equality and rejects +1', () => {
  runBatch({ limits: { maxEntries: 1 } });
  const h = harness({ limits: { maxEntries: 1 } }); h.batch.beginLayoutBatch();
  throwsCode(() => parseRole(h, 0, archive(regular(0, 'a'), regular(0, 'b'))), 'E_LAYOUT_ENTRIES'); assertReleased(h.batch);
});
test('batch entry budget accepts equality and rejects fifth-role +1', () => {
  runBatch({ limits: { maxBatchEntries: 5 } });
  const h = harness({ limits: { maxBatchEntries: 4 } }); h.batch.beginLayoutBatch();
  for (let i = 0; i < 4; i++) h.batch.acceptLayoutRole(parseRole(h, i).core);
  throwsCode(() => parseRole(h, 4), 'E_LAYOUT_ENTRIES'); assertReleased(h.batch);
});
test('manifest per-file limit accepts equality and rejects +1 before capture allocation', () => {
  const bytes = archive(regular(0, 'components', '12345678'));
  assert.equal(runBatch({ limits: { maxManifestBytes: 8 } }, [bytes]).result.manifestBytes, 8);
  const h = harness({ limits: { maxManifestBytes: 7 } }); h.batch.beginLayoutBatch();
  throwsCode(() => parseRole(h, 0, bytes), 'E_LAYOUT_MANIFEST'); assertReleased(h.batch);
});
test('batch manifest budget accepts equality and rejects fifth-role +1', () => {
  const archives = Array.from({ length: 5 }, (_, i) => archive(regular(i, 'components', 'ab')));
  assert.equal(runBatch({ limits: { maxBatchManifestBytes: 10 } }, archives).result.manifestBytes, 10);
  const h = harness({ limits: { maxBatchManifestBytes: 9 } }); h.batch.beginLayoutBatch();
  for (let i = 0; i < 4; i++) h.batch.acceptLayoutRole(parseRole(h, i, archives[i]).core);
  throwsCode(() => parseRole(h, 4, archives[4]), 'E_LAYOUT_MANIFEST'); assertReleased(h.batch);
});
test('batch metadata budget uses exact escaped JSON sizes at equality and +1', () => {
  const archives = [archive(manifest(0, 'file:quote"name\nopaque\\line\nfile:a\nfile:a/b\n'))];
  const baseline = runBatch({}, archives).result;
  const exact = baseline.metadataBytes;
  assert.equal(runBatch({ limits: { maxBatchMetadataBytes: exact } }, archives).result.metadataBytes, exact);
  const h = harness({ limits: { maxBatchMetadataBytes: exact - 1 } }); h.batch.beginLayoutBatch();
  throwsCode(() => { for (let i = 0; i < 5; i++) h.batch.acceptLayoutRole(parseRole(h, i, archives[i]).core); h.batch.finishLayoutBatch(); }, 'E_LAYOUT_METADATA');
  assertReleased(h.batch);
});
test('metadata accounting independently equals retained escaped JSON with every text property excluded', () => {
  const { result } = runBatch({}, [archive(manifest(0, 'file:quote"path\nopaque\u0000data\nfile:a\nfile:a/b\n')), archive(manifest(1, 'file:a\n'))]);
  const withoutText = value => {
    if (Array.isArray(value)) return value.map(withoutText);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'text').map(([key, item]) => [key, withoutText(item)]));
  };
  const envelope = { roles: result.roles, destinations: result.destinations, collisions: result.collisions };
  const emptyEnvelope = { roles: [], destinations: [], collisions: [] };
  assert.equal(result.metadataBytes, escapedBytes(withoutText(envelope)) - escapedBytes(emptyEnvelope));
});
test('role metadata budget accepts exact retained bytes and rejects +1 without retaining text bytes', () => {
  const h = harness(); h.batch.beginLayoutBatch(); h.batch.acceptLayoutRole(parseRole(h, 0).core);
  const exact = h.batch.snapshotLayout().metadataBytes;
  const same = harness({ limits: { maxRoleMetadataBytes: exact } }); same.batch.beginLayoutBatch(); same.batch.acceptLayoutRole(parseRole(same, 0).core);
  const over = harness({ limits: { maxRoleMetadataBytes: exact - 1 } }); over.batch.beginLayoutBatch();
  throwsCode(() => over.batch.acceptLayoutRole(parseRole(over, 0).core), 'E_LAYOUT_METADATA'); assertReleased(over.batch);
});
test('escaped text counts toward exact output equality and +1 rather than raw UTF-8 length', () => {
  const archives = [archive(regular(0, 'components', '"\\\u0000\n😀'.repeat(100)))];
  const baseline = runBatch({}, archives).result;
  const exact = escapedBytes(baseline);
  assert.equal(escapedBytes(runBatch({ limits: { maxOutputBytes: exact } }, archives).result), exact);
  const h = harness({ limits: { maxOutputBytes: exact - 1 } }); h.batch.beginLayoutBatch();
  for (let i = 0; i < 5; i++) h.batch.acceptLayoutRole(parseRole(h, i, archives[i]).core);
  throwsCode(() => h.batch.finishLayoutBatch(), 'E_LAYOUT_OUTPUT'); assertReleased(h.batch);
});
test('output exhaustion during text capture releases the partial body and metadata', () => {
  const h = harness({ limits: { maxOutputBytes: 1000 } }); h.batch.beginLayoutBatch();
  throwsCode(() => parseRole(h, 0, archive(regular(0, 'components', '\u0000'.repeat(500)))), 'E_LAYOUT_OUTPUT'); assertReleased(h.batch);
});
for (const outcome of ['abort', 'invalid UTF-8', 'successful decoding']) {
  test(`capture buffers are wiped after ${outcome}`, () => {
    const h = harness(); h.batch.beginLayoutBatch(); h.batch.beginLayoutRole('cargo'); const parser = h.batch.createTarInventory();
    const body = Buffer.alloc(37, 97); if (outcome === 'invalid UTF-8') body[36] = 255;
    const bytes = archive(regular(0, 'components', body));
    const allocate = Buffer.alloc;
    const observed = [];
    Buffer.alloc = function (...args) { const buffer = Reflect.apply(allocate, Buffer, args); if (args[0] === 37) observed.push(buffer); return buffer; };
    try {
      if (outcome === 'abort') {
        parser.feed(bytes.subarray(0, 517)); assert.deepEqual(observed[0].subarray(0, 5), Buffer.from('aaaaa'));
        h.batch.abortLayoutBatch();
      } else if (outcome === 'invalid UTF-8') throwsCode(() => parser.feed(bytes), 'E_LAYOUT_DATA');
      else { parser.feed(bytes); h.batch.abortLayoutBatch(); }
      assert.equal(observed.length, 1); assert.equal(observed[0].every(byte => byte === 0), true); assertReleased(h.batch);
    } finally { Buffer.alloc = allocate; }
  });
}
for (const [name, update] of [
  ['late compressed hash', { archiveSha256: '0'.repeat(64) }], ['late archive length', { archiveBytes: 1 }],
  ['late custody bytes', { archiveDataBytes: 0 }], ['late requested bytes', { archiveRequestedBytes: 0 }],
  ['late pass count', { archivePasses: 1 }], ['late close count', { closeAttempts: 1 }],
  ['late stdin finish', { stdinFinished: false }], ['late stdout end', { stdoutEnded: false }],
  ['late stderr end', { stderrEnded: false }], ['late child close', { closeObserved: false }],
  ['late child exit', { exitCode: 1 }], ['late child signal', { signal: 'SIGKILL' }],
  ['late core state', { state: 'OTHER' }], ['late mockOnly', { mockOnly: false }],
  ['late extraction', { extracted: true }], ['late native claim', { nativeQualified: true }],
  ['late python-free claim', { pythonFreeSubsetVerified: true }],
]) {
  test(`${name} failure withholds all five roles`, () => {
    const h = harness(); h.batch.beginLayoutBatch();
    for (let i = 0; i < 4; i++) h.batch.acceptLayoutRole(parseRole(h, i).core);
    const fifth = parseRole(h, 4);
    throwsCode(() => h.batch.acceptLayoutRole({ ...fifth.core, ...update }), 'E_LAYOUT_CORE');
    assertReleased(h.batch); throwsCode(() => h.batch.finishLayoutBatch(), 'E_LAYOUT_STATE');
  });
}
test('core inventory equality is object identity, not structural equivalence', () => {
  const h = harness(); h.batch.beginLayoutBatch(); const parsed = parseRole(h, 0);
  throwsCode(() => h.batch.acceptLayoutRole({ ...parsed.core, inventory: { ...parsed.inventory } }), 'E_LAYOUT_CORE'); assertReleased(h.batch);
});
test('core result proxy/accessor rejection never reads properties through traps', () => {
  for (const wrap of [core => new Proxy(core, { ownKeys() { assert.fail('proxy trap'); } }),
    core => Object.defineProperty({ ...core }, 'archiveSha256', { get() { assert.fail('getter'); } })]) {
    const h = harness(); h.batch.beginLayoutBatch(); const parsed = parseRole(h, 0);
    throwsCode(() => h.batch.acceptLayoutRole(wrap(parsed.core)), 'E_LAYOUT_INPUT'); assertReleased(h.batch);
  }
});
for (const change of [summary => ({ ...summary, entries: 99 }), summary => ({ ...summary, expandedBytes: 1 }),
  summary => ({ ...summary, headers: 32769 }), summary => ({ ...summary, metadataSha256: 'invalid' }),
  summary => ({ ...summary, extractionAuthorized: true })]) {
  test(`invalid parser summary ${String(change)} cannot become pending inventory`, () => {
    const h = harness({ summary: summary => Object.freeze(change(summary)) }); h.batch.beginLayoutBatch();
    throwsCode(() => parseRole(h, 0), 'E_LAYOUT_SUMMARY'); assertReleased(h.batch);
  });
}
test('batch uses fixed role order and forbids an overlapping role', () => {
  const wrong = harness(); wrong.batch.beginLayoutBatch(); throwsCode(() => wrong.batch.beginLayoutRole('rustc'), 'E_LAYOUT_STATE');
  const overlapping = harness(); overlapping.batch.beginLayoutBatch(); overlapping.batch.beginLayoutRole('cargo');
  throwsCode(() => overlapping.batch.beginLayoutRole('cargo'), 'E_LAYOUT_STATE'); assertReleased(overlapping.batch);
});
test('one parser factory per role and no acceptance before parser.finish', () => {
  const h = harness(); h.batch.beginLayoutBatch(); h.batch.beginLayoutRole('cargo'); h.batch.createTarInventory();
  throwsCode(() => h.batch.createTarInventory(), 'E_LAYOUT_STATE'); assert.equal(h.log.calls, 1);
  const early = harness(); early.batch.beginLayoutBatch(); early.batch.beginLayoutRole('cargo');
  throwsCode(() => early.batch.acceptLayoutRole(coreFor(early.p.inputs[0], {})), 'E_LAYOUT_STATE'); assertReleased(early.batch);
});
test('batch completion requires all five accepted roles', () => {
  const h = harness(); h.batch.beginLayoutBatch(); for (let i = 0; i < 4; i++) h.batch.acceptLayoutRole(parseRole(h, i).core);
  throwsCode(() => h.batch.finishLayoutBatch(), 'E_LAYOUT_STATE'); assertReleased(h.batch);
});
test('abort releases a partial capture and every retained reference without enabling restart', () => {
  const h = harness(); h.batch.beginLayoutBatch(); h.batch.beginLayoutRole('cargo'); const parser = h.batch.createTarInventory();
  parser.feed(archive(regular(0, 'components', 'partial-body')).subarray(0, 515));
  h.batch.abortLayoutBatch(); assert.equal(h.batch.snapshotLayout().state, 'ABORTED'); assertReleased(h.batch);
  throwsCode(() => parser.feed(Buffer.alloc(1)), 'E_LAYOUT_STATE'); throwsCode(() => h.batch.beginLayoutBatch(), 'E_LAYOUT_STATE');
});
test('success releases private state and cannot be regained by abort or restart', () => {
  const { batch, result } = runBatch(); assertReleased(batch); assert.equal(batch.snapshotLayout().state, 'FINISHED');
  batch.abortLayoutBatch(); assert.equal(batch.snapshotLayout().state, 'FINISHED');
  throwsCode(() => batch.beginLayoutBatch(), 'E_LAYOUT_STATE'); assert.equal(result.roles.length, 5);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.roles[0].members)); assert.ok(Object.isFrozen(result.destinations));
});
test('old parser closures cannot access a newer active role', () => {
  const h = harness(); h.batch.beginLayoutBatch(); const old = parseRole(h, 0); h.batch.acceptLayoutRole(old.core);
  h.batch.beginLayoutRole('rustc'); h.batch.createTarInventory();
  throwsCode(() => old.parser.finish(), 'E_LAYOUT_STATE'); assertReleased(h.batch);
});
test('snapshot contains only counts, state, mock label, fixed role codes and bounded failure diagnostics', () => {
  const h = harness(); h.batch.beginLayoutBatch(); h.batch.beginLayoutRole('cargo'); h.batch.createTarInventory().feed(archive(manifest(0, 'file:private/path')));
  const snapshot = h.batch.snapshotLayout();
  assert.deepEqual(Object.keys(snapshot), ['state', 'mockOnly', 'acceptedRoles', 'currentRole', 'entries', 'expandedBytes', 'metadataBytes', 'manifestBytes', 'outputBytes', 'failureCode', 'failureRole']);
  assert.equal(snapshot.failureCode, null); assert.equal(snapshot.failureRole, null);
  assert.equal(snapshot.currentRole, 'cargo'); assert.doesNotMatch(JSON.stringify(snapshot), /private\/path|manifest\.in/u);
});
function retainedMetadataBytes(result) {
  const withoutText = value => {
    if (Array.isArray(value)) return value.map(withoutText);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'text').map(([key, item]) => [key, withoutText(item)]));
  };
  return escapedBytes(withoutText({ roles: result.roles, destinations: result.destinations, collisions: result.collisions }))
    - escapedBytes({ roles: [], destinations: [], collisions: [] });
}
for (const sample of ['é', '漢字', '😀']) {
  test(`escaped ASCII final output and metadata preserve Unicode manifest data and destinations: ${sample}`, () => {
    const text = `file:bin/${sample}\ndir:lib/${sample}\nopaque:${sample}\n`;
    const archives = [archive(manifest(0, text, 'component-' + sample)), archive(manifest(1, `file:bin/${sample}\n`))];
    const baseline = runBatch({}, archives).result;
    const exact = escapedBytes(baseline);
    assert.ok(exact > Buffer.byteLength(JSON.stringify(baseline)));
    assert.equal(baseline.metadataBytes, retainedMetadataBytes(baseline));
    assert.equal(baseline.roles[0].texts[0].text, text);
    assert.equal(baseline.roles[0].members[0].bodySha256, sha(text));
    assert.equal(baseline.roles[0].declarations[0].destination, 'bin/' + sample);
    assert.equal(baseline.destinations.find(item => item.destination === 'bin/' + sample).count, 2);
    assert.equal(baseline.collisions[0].destination, 'bin/' + sample);
    assert.equal(JSON.parse(escapedAscii(baseline)).roles[0].texts[0].text, text);
    const actualOperationBytes = (JSON.stringify(baseline) + '\n').replace(/[^\x00-\x7f]/g,
      char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')).length;
    assert.equal(actualOperationBytes, exact + 1);
    assert.equal(escapedBytes(runBatch({ limits: { maxOutputBytes: exact } }, archives).result), exact);
    const over = harness({ limits: { maxOutputBytes: exact - 1 } }); over.batch.beginLayoutBatch();
    for (let i = 0; i < 5; i++) over.batch.acceptLayoutRole(parseRole(over, i, archives[i]).core);
    throwsCode(() => over.batch.finishLayoutBatch(), 'E_LAYOUT_OUTPUT'); assertReleased(over.batch);
    assert.equal(over.batch.snapshotLayout().failureCode, 'E_LAYOUT_OUTPUT');
    assert.equal(over.batch.snapshotLayout().failureRole, null);
  });
  test(`Unicode capture output refuses the next escaped byte before examining another member: ${sample}`, () => {
    const first = manifest(0, 'opaque:' + sample.repeat(4));
    const baseline = harness(); baseline.batch.beginLayoutBatch(); baseline.batch.beginLayoutRole('cargo');
    baseline.batch.createTarInventory().feed(first);
    const exact = baseline.batch.snapshotLayout().outputBytes;
    const complete = runBatch({}, [archive(first)]).result;
    const { inventory, archiveBytes, archiveSha256, ...record } = complete.roles[0];
    const observed = { ...record, expandedBytes: first.length, decodedSha256: '' };
    assert.equal(exact, escapedBytes({ roles: [observed], destinations: [], collisions: [] }) - escapedBytes({ roles: [], destinations: [], collisions: [] }));
    baseline.batch.abortLayoutBatch();
    const equal = harness({ limits: { maxOutputBytes: exact } }); equal.batch.beginLayoutBatch(); equal.batch.beginLayoutRole('cargo');
    equal.batch.createTarInventory().feed(first); assert.equal(equal.batch.snapshotLayout().outputBytes, exact); equal.batch.abortLayoutBatch();
    const over = harness({ limits: { maxOutputBytes: exact - 1 },
      events: events => Object.freeze(events.map((event, i) => i ? { ...event } : event)) });
    over.batch.beginLayoutBatch(); over.batch.beginLayoutRole('cargo');
    throwsCode(() => over.batch.createTarInventory().feed(Buffer.concat([first, regular(0, 'unexamined')])), 'E_LAYOUT_OUTPUT');
    assertReleased(over.batch); assert.equal(over.batch.snapshotLayout().failureRole, 'cargo');
  });
  for (const bound of ['maxRoleMetadataBytes', 'maxBatchMetadataBytes']) {
    test(`Unicode destination metadata enforces exact escaped ${bound} and +1 before another member: ${sample}`, () => {
      const first = manifest(0, `file:bin/${sample}\n`);
      const baseline = harness(); baseline.batch.beginLayoutBatch(); baseline.batch.beginLayoutRole('cargo');
      baseline.batch.createTarInventory().feed(first);
      const exact = baseline.batch.snapshotLayout().metadataBytes; baseline.batch.abortLayoutBatch();
      const equal = harness({ limits: { [bound]: exact } }); equal.batch.beginLayoutBatch(); equal.batch.beginLayoutRole('cargo');
      equal.batch.createTarInventory().feed(first); assert.equal(equal.batch.snapshotLayout().metadataBytes, exact); equal.batch.abortLayoutBatch();
      const over = harness({ limits: { [bound]: exact - 1 },
        events: events => Object.freeze(events.map((event, i) => i ? { ...event } : event)) });
      over.batch.beginLayoutBatch(); over.batch.beginLayoutRole('cargo');
      throwsCode(() => over.batch.createTarInventory().feed(Buffer.concat([first, regular(0, 'unexamined')])), 'E_LAYOUT_METADATA');
      assertReleased(over.batch); assert.equal(over.batch.snapshotLayout().failureCode, 'E_LAYOUT_METADATA');
      assert.equal(over.batch.snapshotLayout().failureRole, 'cargo');
    });
  }
}
test('ASCII quote, backslash, short escapes, low controls and DEL match JSON serialization exactly', () => {
  const text = '"\\' + Array.from({ length: 32 }, (_, code) => String.fromCharCode(code)).join('') + '\x7f';
  assert.equal(escapedAscii(text), JSON.stringify(text));
  const archives = [archive(regular(0, 'components', text))];
  const baseline = runBatch({}, archives).result, exact = escapedBytes(baseline);
  assert.equal(escapedBytes(runBatch({ limits: { maxOutputBytes: exact } }, archives).result), exact);
  const over = harness({ limits: { maxOutputBytes: exact - 1 } }); over.batch.beginLayoutBatch();
  for (let i = 0; i < 5; i++) over.batch.acceptLayoutRole(parseRole(over, i, archives[i]).core);
  throwsCode(() => over.batch.finishLayoutBatch(), 'E_LAYOUT_OUTPUT');
});
test('every non-ASCII UTF16 unit uses six bytes without normalizing text or merging an astral pair', () => {
  assert.equal(escapedAscii('é'), '"\\u00e9"'); assert.equal(escapedAscii('漢'), '"\\u6f22"');
  assert.equal(escapedAscii('😀'), '"\\ud83d\\ude00"');
  const text = 'é/e\u0301/😀';
  const { result } = runBatch({}, [archive(manifest(0, `file:${text}\nopaque:${text}\n`))]);
  assert.equal(result.roles[0].texts[0].text, `file:${text}\nopaque:${text}\n`);
  assert.equal(result.roles[0].declarations[0].destination, text); assert.equal(result.metadataBytes, retainedMetadataBytes(result));
});
test('normal begin, per-role activity, successful finish and clean abort have null failure diagnostics', () => {
  const h = harness();
  const assertNull = batch => { assert.equal(batch.snapshotLayout().failureCode, null); assert.equal(batch.snapshotLayout().failureRole, null); };
  assertNull(h.batch); h.batch.beginLayoutBatch(); assertNull(h.batch);
  for (let i = 0; i < 5; i++) { h.batch.acceptLayoutRole(parseRole(h, i).core); assertNull(h.batch); }
  h.batch.finishLayoutBatch(); assertNull(h.batch); h.batch.abortLayoutBatch(); assertNull(h.batch);
  const aborted = harness(); aborted.batch.beginLayoutBatch(); aborted.batch.beginLayoutRole('cargo'); aborted.batch.abortLayoutBatch(); assertNull(aborted.batch);
});
test('a fifth-role declaration failure releases all layout data and preserves only fixed diagnostics across abort', () => {
  const h = harness(); h.batch.beginLayoutBatch();
  for (let i = 0; i < 4; i++) h.batch.acceptLayoutRole(parseRole(h, i, archive(manifest(i, `file:private-${i}/destination\nopaque-private-${i}\n`))).core);
  assert.equal(h.batch.snapshotLayout().acceptedRoles, 4);
  throwsCode(() => parseRole(h, 4, archive(manifest(4, 'file:../private-fifth'))), 'E_LAYOUT_DECLARATION');
  const snapshot = h.batch.snapshotLayout(); assertReleased(h.batch);
  assert.equal(snapshot.failureCode, 'E_LAYOUT_DECLARATION'); assert.equal(snapshot.failureRole, 'clippy-preview');
  assert.doesNotMatch(JSON.stringify(snapshot), /private|destination|sha256|manifest\.in|candidate|members|texts|inventory/u);
  throwsCode(() => h.batch.finishLayoutBatch(), 'E_LAYOUT_STATE'); h.batch.abortLayoutBatch(); assertReleased(h.batch);
  assert.equal(h.batch.snapshotLayout().failureCode, 'E_LAYOUT_DECLARATION'); assert.equal(h.batch.snapshotLayout().failureRole, 'clippy-preview');
  throwsCode(() => h.batch.beginLayoutBatch(), 'E_LAYOUT_STATE');
  assert.equal(h.batch.snapshotLayout().failureCode, 'E_LAYOUT_DECLARATION'); assert.equal(h.batch.snapshotLayout().failureRole, 'clippy-preview');
  const fresh = harness(); fresh.batch.beginLayoutBatch(); assert.equal(fresh.batch.snapshotLayout().failureCode, null); assert.equal(fresh.batch.snapshotLayout().failureRole, null);
});
for (const [name, mutate, expected] of [
  ['header checksum', bytes => { bytes[0] ^= 1; return bytes; }, 'E_CHECKSUM'],
  ['incomplete terminator', bytes => bytes.subarray(0, -512), 'E_TRUNCATED'],
]) {
  test(`fifth-role parser ${name} records its finite data code without returning earlier layout`, () => {
    const h = harness(); h.batch.beginLayoutBatch();
    for (let i = 0; i < 4; i++) h.batch.acceptLayoutRole(parseRole(h, i).core);
    throwsCode(() => parseRole(h, 4, mutate(archive(regular(4, 'private-fifth', 'body-secret')))), 'E_LAYOUT_DATA'); assertReleased(h.batch);
    assert.equal(h.batch.snapshotLayout().failureCode, expected); assert.equal(h.batch.snapshotLayout().failureRole, 'clippy-preview');
    h.batch.abortLayoutBatch(); assert.equal(h.batch.snapshotLayout().failureCode, expected); assert.equal(h.batch.snapshotLayout().failureRole, 'clippy-preview');
    throwsCode(() => h.batch.finishLayoutBatch(), 'E_LAYOUT_STATE'); assertReleased(h.batch);
  });
}
for (const code of ['E_TYPE', 'E_PAX_KEY', 'E_UTF8', 'E_PATH', 'E_EXTENSION_BYTES', 'E_PADDING', 'E_TRAILING']) {
  test(`parser diagnostics preserve whitelisted own data code ${code} without inspecting messages or stacks`, () => {
    const error = Object.defineProperties({ name: 'InventoryError', code }, {
      message: { get() { assert.fail('message getter'); } }, stack: { get() { assert.fail('stack getter'); } },
    });
    const h = harness({ factory: () => ({ feed() { throw error; }, finish() {} }) });
    h.batch.beginLayoutBatch(); h.batch.beginLayoutRole('cargo');
    throwsCode(() => h.batch.createTarInventory().feed(Buffer.alloc(512)), 'E_LAYOUT_DATA'); assertReleased(h.batch);
    assert.equal(h.batch.snapshotLayout().failureCode, code); assert.equal(h.batch.snapshotLayout().failureRole, 'cargo');
  });
}
const diagnosticGetter = () => { assert.fail('diagnostic getter or proxy trap ran'); };
for (const [name, make] of [
  ['code getter', () => Object.defineProperty({ name: 'InventoryError' }, 'code', { get: diagnosticGetter })],
  ['name getter', () => Object.defineProperty({ code: 'E_CHECKSUM' }, 'name', { get: diagnosticGetter })],
  ['unknown code', () => ({ name: 'InventoryError', code: 'private/unknown-code' })],
  ['oversized code', () => ({ name: 'InventoryError', code: 'E_' + 'x'.repeat(10000) })],
  ['object code', () => ({ name: 'InventoryError', code: { toString: diagnosticGetter } })],
  ['inherited code getter', () => Object.assign(Object.create({ get code() { diagnosticGetter(); } }), { name: 'InventoryError' })],
  ['inherited name getter', () => Object.assign(Object.create({ get name() { diagnosticGetter(); } }), { code: 'E_CHECKSUM' })],
  ['forged collector code', () => ({ name: 'RustLayoutError', code: 'E_LAYOUT_DECLARATION' })],
  ['proxy', () => new Proxy({}, { get: diagnosticGetter, getOwnPropertyDescriptor: diagnosticGetter, getPrototypeOf: diagnosticGetter })],
  ['revoked proxy', () => { const pair = Proxy.revocable({}, {}); pair.revoke(); return pair.proxy; }],
  ['symbol', () => Symbol('private-fifth')], ['null', () => null],
]) {
  test(`fifth-role ${name} becomes fixed E_LAYOUT_DATA without reading unknown diagnostics`, () => {
    const error = make(); let roleIndex = 0;
    const h = harness({ factory: limits => ++roleIndex === 5
      ? { feed() { throw error; }, finish() {} } : privateTar.createTarInventory(limits) });
    h.batch.beginLayoutBatch(); for (let i = 0; i < 4; i++) h.batch.acceptLayoutRole(parseRole(h, i).core);
    throwsCode(() => parseRole(h, 4), 'E_LAYOUT_DATA'); assertReleased(h.batch);
    assert.equal(h.batch.snapshotLayout().failureCode, 'E_LAYOUT_DATA'); assert.equal(h.batch.snapshotLayout().failureRole, 'clippy-preview');
    h.batch.abortLayoutBatch(); assert.equal(h.batch.snapshotLayout().failureCode, 'E_LAYOUT_DATA');
    assert.equal(h.batch.snapshotLayout().failureRole, 'clippy-preview');
    assert.doesNotMatch(JSON.stringify(h.batch.snapshotLayout()), /private|unknown-code|sha256|candidate|member|text|inventory/u);
  });
}
test('zero-argument batch entry points reject caller data', () => {
  for (const method of ['beginLayoutBatch', 'finishLayoutBatch', 'abortLayoutBatch', 'snapshotLayout']) {
    const h = harness(); throwsCode(() => h.batch[method]({}), 'E_LAYOUT_INPUT');
  }
});
test('fixture requires an explicit trusted factory and a complete mock-only profile', () => {
  throwsCode(() => createRustLayoutFixture(profile()), 'E_LAYOUT_INPUT');
  throwsCode(() => createRustLayoutFixture({ ...profile(), mockOnly: false }, privateTar.createTarInventory), 'E_LAYOUT_INPUT');
  throwsCode(() => createRustLayoutFixture({ inputs: profile().inputs }, privateTar.createTarInventory), 'E_LAYOUT_INPUT');
});
test('fixture descriptors reject live roots, changed roles/expected roots and missing identity fields', () => {
  for (const mutate of [p => { p.inputs[0].root = RUST_LAYOUT_INPUTS[0].root; },
    p => { p.inputs[0].role = 'arbitrary'; }, p => { p.inputs[0].expectedRoot = 'custom'; },
    p => { delete p.inputs[0].identity.root.ctimeNs; }, p => { p.inputs[0].identity.root.gid = '0'; }]) {
    const p = profile(); mutate(p); throwsCode(() => createRustLayoutFixture(p, privateTar.createTarInventory), 'E_LAYOUT_INPUT');
  }
});
test('fixture bounds only lower production bounds', () => {
  for (const limits of [{ maxEntries: 32769 }, { maxOutputBytes: 16777217 }, { unknown: 1 }, { maxEntries: 0 }]) {
    throwsCode(() => createRustLayoutFixture(profile(limits), privateTar.createTarInventory), 'E_LAYOUT_LIMIT');
  }
});
test('profile, identity, limit and array proxies/accessors never execute user getters', () => {
  const forbidden = () => { assert.fail('getter/trap invoked'); };
  for (const mutate of [p => new Proxy(p, { ownKeys: forbidden }),
    p => Object.defineProperty(p, 'limits', { get: forbidden }),
    p => { p.inputs = new Proxy(p.inputs, { get: forbidden }); return p; },
    p => { Object.defineProperty(p.inputs[0].identity.root, 'dev', { get: forbidden }); return p; },
    p => { p.limits = { get maxEntries() { forbidden(); } }; return p; },
    p => { Object.defineProperty(p.inputs, '0', { get: forbidden }); return p; }]) {
    throwsCode(() => createRustLayoutFixture(mutate(profile()), privateTar.createTarInventory), 'E_LAYOUT_INPUT');
  }
});
test('normal direct production import has no arbitrary descriptor or dependency entry point', async () => {
  const m = await import('./rust-component-layout.mjs');
  throwsCode(() => m.beginLayoutBatch(profile(), privateTar.createTarInventory), 'E_LAYOUT_INPUT'); assertReleased(m);
  assert.deepEqual(Object.keys(m).sort(), ['RUST_LAYOUT_INPUTS', 'RUST_LAYOUT_LIMITS', 'RUST_LAYOUT_ROLES', 'abortLayoutBatch', 'acceptLayoutRole', 'beginLayoutBatch', 'beginLayoutRole', 'createRustLayoutFixture', 'createTarInventory', 'finishLayoutBatch', 'snapshotLayout'].sort());
});
test('handoff prints repository-only source pins', t => {
  for (const name of ['rust-component-layout.mjs', 'rust-component-layout.test.mjs', 'gnu-sdk-inventory-v4-operation.mjs']) {
    const bytes = read('./' + name);
    t.diagnostic(`${name} bytes=${bytes.length} sha256=${sha(bytes)}`);
  }
  t.diagnostic(`private-event-tar bytes=${Buffer.byteLength(privateTarSource)} sha256=${sha(privateTarSource)}`);
});
