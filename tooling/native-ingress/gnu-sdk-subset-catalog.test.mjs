// SPEC: _spec/tooling/native-ingress/gnu-sdk-subset-catalog.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createTarMemberInventory } from './tar-inventory.mjs';
import { createSdkSubsetCatalogFixture, SDK_CATALOG_EXPECTATION, SDK_CATALOG_LIMITS, SDK_CATALOG_ROOT as root } from './gnu-sdk-subset-catalog.mjs';

const target = 'x86_64-buildroot-linux-gnu', gcc = 'lib/gcc/' + target + '/15.3.0/';
const source = fs.readFileSync(new URL('./gnu-sdk-subset-catalog.mjs', import.meta.url), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
let serial = 0;
function member(relative, type = 'file', link = '../../UNINTERPRETED', body = Buffer.from('x')) {
  const path = root + '/' + relative, header = Buffer.alloc(512), slash = path.lastIndexOf('/');
  if (Buffer.byteLength(path) <= 100) header.write(path, 0, 100);
  else { header.write(path.slice(slash + 1), 0, 100); header.write(path.slice(0, slash), 345, 155); }
  const size = type === 'file' ? body.length : 0;
  for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, size], [136, 12, 0]]) header.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  header[156] = { file: 48, directory: 53, symlink: 50, hardlink: 49 }[type];
  if (type === 'symlink' || type === 'hardlink') header.write(link, 157, 100);
  header.write('ustar\0', 257, 6); header.write('00', 263, 2); header.fill(32, 148, 156);
  let checksum = 0; for (const byte of header) checksum += byte;
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return Buffer.concat([header, size ? body : Buffer.alloc(0), Buffer.alloc((512 - size % 512) % 512)]);
}
function fixture(paths = ['bin/' + target + '-gcc'], options = {}) {
  const bytes = Buffer.concat([...paths.map(path => typeof path === 'string' ? member(path) : member(path.path, path.type, path.link, path.body)), Buffer.alloc(1024)]);
  const parser = createTarMemberInventory(), events = [];
  for (let offset = 0; offset < bytes.length; offset += 65536) events.push(...parser.feed(bytes.subarray(offset, offset + 65536)));
  const inventory = parser.finish();
  const profile = { expectedSummary: Object.fromEntries(Object.keys(SDK_CATALOG_EXPECTATION).map(key => [key, inventory[key]])),
    expectedDecodedSha256: options.digest ?? sha(bytes), regularFileCount: inventory.fileSpans.length, limits: options.limits ?? {} };
  return { bytes, events, inventory, profile, api: createSdkSubsetCatalogFixture(profile) };
}
const receipt = (inventory, extra = {}) => ({ state: 'GNU_SDK_DATA_INVENTORY', mockOnly: true, inventory,
  archiveBytes: 10, archiveSha256: sha(Buffer.from('0123456789')), archivePasses: 2, archiveDataBytes: 20, archiveRequestedBytes: 22,
  closeAttempts: 2, stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true, exitCode: 0, signal: null,
  extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false, ...extra });
function finish(f) {
  f.api.beginCatalogPass(); const parser = f.api.createTarInventory();
  for (let offset = 0; offset < f.bytes.length; offset += 65536) parser.feed(f.bytes.subarray(offset, offset + 65536));
  return parser.finish();
}
function catalog(f) { f.api.acceptCatalogPass(receipt(finish(f))); return f.api.getCatalogData(); }
async function fakeParser(f, change = {}) {
  const log = { feeds: 0, finishes: 0 }, key = '__catalogParser' + ++serial;
  globalThis[key] = { events: f.events, result: f.inventory, log, ...change };
  const dependency = uri(`const d = globalThis[${JSON.stringify(key)}]; export function createTarMemberInventory() { return {
    feed(bytes) { d.log.feeds++; if (d.feedError) throw d.feedError; return d.events; },
    finish() { d.log.finishes++; if (d.finishError) throw d.finishError; return d.result; } }; }`);
  try {
    const ns = await import(uri(source.replace("from './tar-inventory.mjs'", "from '" + dependency + "'")) + '#fixture-' + serial);
    return { api: ns.createSdkSubsetCatalogFixture(f.profile), log };
  } finally { delete globalThis[key]; }
}

test('production profile stays frozen and exposes no caller-configurable discovery selectors', () => {
  assert.ok(Object.isFrozen(SDK_CATALOG_EXPECTATION)); assert.ok(Object.isFrozen(SDK_CATALOG_LIMITS));
  assert.equal(SDK_CATALOG_EXPECTATION.entries, 8412); assert.equal(SDK_CATALOG_LIMITS.maxCandidates, 512);
  assert.doesNotMatch(source, /node:(?:fs|path|child_process)|\b(?:fetch|resolve|readlink|writeFile|spawn)\s*\(/);
});
test('tiny independently checksummed TAR has one 1 KiB record and a complete terminator', () => {
  const f = fixture(); assert.equal(f.bytes.length, 2048); const result = catalog(f);
  assert.equal(result.state, 'SUBSET_CANDIDATE_CATALOG'); assert.equal(result.namespaceComplete, true); assert.equal(result.namespaceEntryCount, 1);
  assert.equal(result.candidates[0].regularSpan.bodyOffset, 512); assert.equal(result.mockOnly, true);
});
test('same original events and finish object return by identity with exactly one parser call', async () => {
  const f = fixture(), fake = await fakeParser(f); fake.api.beginCatalogPass(); const parser = fake.api.createTarInventory();
  assert.equal(parser.feed(f.bytes), f.events); assert.equal(parser.finish(), f.inventory);
  assert.deepEqual(fake.log, { feeds: 1, finishes: 1 }); fake.api.acceptCatalogPass(receipt(f.inventory)); assert.equal(fake.api.getCatalogData().candidates.length, 1);
});
test('no candidates release before explicit complete-core acceptance', () => {
  const f = fixture(); finish(f); assert.throws(() => f.api.getCatalogData(), { code: 'E_PHASE' });
  assert.equal(f.api.snapshot().phase, 'failed'); assert.equal(f.api.snapshot().retainedEntries, 0);
});
test('late core failure invalidates a complete map permanently', () => {
  const f = fixture(), inventory = finish(f); assert.throws(() => f.api.acceptCatalogPass(receipt(inventory, { closeAttempts: 1 })), { code: 'E_RECEIPT' });
  assert.throws(() => f.api.getCatalogData(), { code: 'E_PHASE' }); assert.equal(f.api.snapshot().retainedSpans, 0);
});
test('decoded hash verifies independently before completion', () => {
  const f = fixture(undefined, { digest: '0'.repeat(64) }); assert.throws(() => finish(f), { code: 'E_HASH' }); assert.equal(f.api.snapshot().phase, 'failed');
});
test('all authority and fulfillment flags remain false even for complete candidate presence', () => {
  const result = catalog(fixture());
  for (const key of ['relocationReady', 'pythonFreeSubsetVerified', 'installedUsability', 'rustReady', 'nativeQualified', 'nativeAuthority', 'trainingReady', 'extractionAuthorized']) assert.equal(result[key], false);
  assert.equal(result.interpretation, 'DATA_NOT_MEMBER_SELECTION_OR_PERMISSION');
  assert.ok(result.roleObservations.every(role => role.roleSatisfied === false));
  assert.ok(result.roleObservations.some(role => role.status === 'NO_CANDIDATE_MATCH' && role.candidateIndices.length === 0));
});
for (const [path, role] of [
  ['bin/toolchain-wrapper', 'TOOLCHAIN_WRAPPER'], ['bin/' + target + '-gcc-15.3.0.br_real', 'COMPILER_DRIVER'], ['bin/cc', 'COMPILER_DRIVER'],
  ['bin/' + target + '-g++.br_real', 'COMPILER_DRIVER'], ['bin/' + target + '-cpp', 'COMPILER_DRIVER'],
  ['bin/' + target + '-ld.bfd', 'BINUTILS_LD_BFD'], [target + '/bin/as', 'BINUTILS_AS'],
  ['libexec/gcc/' + target + '/15.3.0/cc1', 'GCC_CC1'], ['libexec/gcc/' + target + '/15.3.0/cc1plus', 'GCC_CC1PLUS'],
  ['libexec/gcc/' + target + '/15.3.0/lto1', 'GCC_LTO1'], ['libexec/gcc/' + target + '/15.3.0/collect2', 'GCC_COLLECT2'],
  ['lib/ld-linux-x86-64.so.2', 'HOST_RUNTIME_PROVIDER'], ['lib64/ld-2.40.so', 'HOST_RUNTIME_PROVIDER'],
  ['lib/libstdc++.so.6.0.34', 'HOST_RUNTIME_PROVIDER'], ['lib/libbfd-2.45.so', 'HOST_RUNTIME_PROVIDER'],
  ['lib/libsframe.so.1', 'HOST_RUNTIME_PROVIDER'], ['lib/libncursesw.so.6', 'HOST_RUNTIME_PROVIDER'],
  [target + '/sysroot/usr/lib/crt1.o', 'TARGET_LINK_INPUT'], [target + '/lib64/libc_nonshared.a', 'TARGET_LINK_INPUT'],
  [target + '/sysroot/lib/libpthread.a', 'TARGET_LINK_INPUT'], [gcc + 'crtbeginS.o', 'GCC_PRIVATE_LINK_INPUT'],
  [gcc + 'crtendT.o', 'TARGET_LINK_INPUT'], [gcc + 'libgcc_s.so.1', 'GCC_PRIVATE_LINK_INPUT'],
  [gcc + 'liblto_plugin.so.0.0.0', 'GCC_LTO_PLUGIN'], ['libexec/gcc/' + target + '/15.3.0/liblto_plugin.so', 'GCC_LTO_PLUGIN'],
  [gcc + 'specs', 'GCC_SPECS_TEXT'],
]) test('anchored positive discovery: ' + path, () => {
  const result = catalog(fixture([path])), candidate = result.candidates[0]; assert.equal(result.candidates.length, 1);
  assert.ok(candidate.matchedRoles.includes(role)); assert.equal(candidate.index, 1);
  assert.deepEqual(result.roleObservations.find(value => value.role === role).candidateIndices, [1]);
});
for (const path of ['other/bin/gcc', 'bin/python', 'bin/gdb', 'lib/libpython.so.3', 'lib/internal/libc.so.6',
  'lib/libc.so.bad', 'lib/ld-alpha.so', 'lib/libunlisted.so.1', 'lib/libgcc.a', 'lib/libc.so.6/child',
  'libexec/gcc/' + target + '/15.2.0/cc1', gcc + 'crtbeginX.o', gcc + 'crtendST.o', target + '/sysroot/usr/lib/internal/libc.so',
  target + '/bin/python', 'bin/other-gcc', 'bin/' + target + '-gcc-16', 'libexec/gcc/' + target + '/15.3.0/cc1/child']) {
  test('anchored negative discovery: ' + path, () => { assert.deepEqual(catalog(fixture([path])).candidates, []); });
}
test('overlapping selectors deduplicate by ordinal and preserve every matched role', () => {
  const result = catalog(fixture(['not-selected', gcc + 'libgcc.a'])); assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].index, 2); assert.deepEqual(result.candidates[0].matchedRoles, ['GCC_PRIVATE_LINK_INPUT', 'TARGET_LINK_INPUT']);
});
for (const type of ['directory', 'symlink', 'hardlink']) test(type + ' structural aliases remain data with no regular span or target interpretation', () => {
  const result = catalog(fixture([{ path: 'lib64', type, link: '/outside/../never-resolve' }]));
  assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].regularSpan, null);
  assert.equal(result.candidates[0].link, type === 'directory' ? null : '/outside/../never-resolve');
});
test('optional compiler internals stay cataloged without claiming a minimal NoPython role', () => {
  const result = catalog(fixture(['libexec/gcc/' + target + '/15.3.0/cc1plus', 'libexec/gcc/' + target + '/15.3.0/lto1']));
  for (const role of ['GCC_CC1PLUS', 'GCC_LTO1']) assert.equal(result.roleObservations.find(value => value.role === role).optionalForMinimalNoPython, true);
});
for (const [name, change] of [
  ['ordinal gap', event => ({ ...event, index: 2 })], ['wrong root', event => ({ ...event, path: 'wrong/' + event.path })],
  ['root prefix confusion', event => ({ ...event, path: root + '-evil/bin/gcc' })], ['parent component', event => ({ ...event, path: root + '/a/../bin/gcc' })],
  ['dot component', event => ({ ...event, path: root + '/./bin/gcc' })], ['empty component', event => ({ ...event, path: root + '//bin/gcc' })],
  ['oversized path', event => ({ ...event, path: root + '/' + 'a'.repeat(1024) })], ['nonregular size', event => ({ ...event, type: 'directory' })],
  ['accessor', event => Object.defineProperty({ ...event }, 'path', { get() { assert.fail('getter called'); } })],
  ['unused accessor', event => Object.defineProperty({ ...event }, 'unused', { get() { assert.fail('unused getter called'); } })],
  ['proxy', () => new Proxy({}, { get() { assert.fail('proxy called'); } })],
  ['file link data', event => ({ ...event, linkpath: 'anything' })], ['unknown type', event => ({ ...event, type: 'device' })],
]) test('rejects returned metadata ' + name + ' without executing getters', async () => {
  const f = fixture(), fake = await fakeParser(f, { events: [change(f.events[0])] });
  fake.api.beginCatalogPass(); const parser = fake.api.createTarInventory(); assert.throws(() => parser.feed(f.bytes), { code: 'E_INPUT' });
  assert.equal(fake.api.snapshot().phase, 'failed'); assert.equal(fake.api.snapshot().retainedEntries, 0);
});
test('duplicate canonical keys halt the complete namespace rather than selecting the first', async () => {
  const f = fixture(['a', 'b']), events = [f.events[0], { ...f.events[1], path: f.events[0].path }], fake = await fakeParser(f, { events });
  fake.api.beginCatalogPass(); assert.throws(() => fake.api.createTarInventory().feed(f.bytes), { code: 'E_INPUT' });
});
for (const [name, change] of [
  ['missing span', spans => []], ['different path', spans => [{ ...spans[0], path: root + '/other' }]],
  ['different ordinal', spans => [{ ...spans[0], index: 2 }]], ['different size', spans => [{ ...spans[0], size: 0 }]],
  ['negative offset', spans => [{ ...spans[0], bodyOffset: -1 }]], ['out-of-range end', spans => [{ ...spans[0], bodyOffset: 2048 }]],
  ['unsafe offset', spans => [{ ...spans[0], bodyOffset: Number.MAX_SAFE_INTEGER + 1 }]],
  ['accessor offset', spans => [Object.defineProperty({ ...spans[0] }, 'bodyOffset', { get() { assert.fail('span getter called'); } })]],
]) test('complete map rejects ' + name, async () => {
  const f = fixture(), fake = await fakeParser(f, { result: { ...f.inventory, fileSpans: change(f.inventory.fileSpans) } });
  fake.api.beginCatalogPass(); const parser = fake.api.createTarInventory(); parser.feed(f.bytes); assert.throws(() => parser.finish());
  assert.equal(fake.api.snapshot().phase, 'failed');
});
test('overlapping regular bodies reject even when index/path/size match', async () => {
  const f = fixture(['a', 'b']), spans = f.inventory.fileSpans.map(span => ({ ...span, bodyOffset: 512 }));
  const fake = await fakeParser(f, { result: { ...f.inventory, fileSpans: spans } }); fake.api.beginCatalogPass();
  const parser = fake.api.createTarInventory(); parser.feed(f.bytes); assert.throws(() => parser.finish(), { code: 'E_SPAN' });
});
test('missing metadata events reject despite a complete original summary', async () => {
  const f = fixture(['a', 'b']), fake = await fakeParser(f, { events: f.events.slice(0, 1) }); fake.api.beginCatalogPass();
  const parser = fake.api.createTarInventory(); parser.feed(f.bytes); assert.throws(() => parser.finish(), { code: 'E_LENGTH' });
});
test('nonregular metadata cannot acquire a regular span', async () => {
  const f = fixture([{ path: 'lib64', type: 'directory' }]), fake = await fakeParser(f, { result: { ...f.inventory, fileSpans: [{ index: 1, path: root + '/lib64', size: 0, bodyOffset: 512 }] } });
  fake.api.beginCatalogPass(); const parser = fake.api.createTarInventory(); parser.feed(f.bytes); assert.throws(() => parser.finish(), { code: 'E_SPAN' });
});
for (const limit of ['maxMetadataBytes', 'maxSpanBytes', 'maxCoreBytes', 'maxSelectedBytes', 'maxOutputBytes']) test('lowered ' + limit + ' fails closed without partial publication', () => {
  const f = fixture(undefined, { limits: { [limit]: 1 } }); assert.throws(() => catalog(f)); assert.equal(f.api.snapshot().retainedEntries, 0);
});
test('exact lowered candidate cap accepts and cap plus one rejects without truncation', () => {
  const paths = ['bin/cc', 'bin/gcc']; assert.equal(catalog(fixture(paths, { limits: { maxCandidates: 2 } })).candidates.length, 2);
  const f = fixture(paths, { limits: { maxCandidates: 1 } }); assert.throws(() => catalog(f), { code: 'E_OUTPUT' }); assert.equal(f.api.snapshot().phase, 'failed');
});
test('512 candidates accept and 513 stop the whole catalog', () => {
  const paths = Array.from({ length: 513 }, (_, i) => 'lib/libc.so.' + i);
  assert.equal(catalog(fixture(paths.slice(0, 512))).candidates.length, 512);
  assert.throws(() => catalog(fixture(paths)), { code: 'E_OUTPUT' });
});
test('escaped ASCII selected budget applies independently of UTF8', () => {
  const paths = [{ path: 'lib64', type: 'symlink', link: 'π'.repeat(40) }], initial = catalog(fixture(paths));
  const utf8 = Buffer.byteLength(JSON.stringify(initial.candidates)); assert.ok(utf8 < Buffer.byteLength(JSON.stringify(initial.candidates).replace(/π/g, '\\u03c0')));
  assert.throws(() => catalog(fixture(paths, { limits: { maxSelectedBytes: utf8 } })), { code: 'E_OUTPUT' });
});
test('core inventory identity and all own data are mandatory at acceptance', () => {
  const f = fixture(), inventory = finish(f); assert.throws(() => f.api.acceptCatalogPass(receipt({ ...inventory })), { code: 'E_RECEIPT' });
  const g = fixture(), next = finish(g), core = receipt(next); Object.defineProperty(core, 'lateField', { get() { assert.fail('core getter'); } });
  assert.throws(() => g.api.acceptCatalogPass(core), { code: 'E_INPUT' });
});
test('factory, finish, and release never repeat or restart', () => {
  const f = fixture(); catalog(f); assert.throws(() => f.api.beginCatalogPass(), { code: 'E_PHASE' });
  const g = fixture(); g.api.beginCatalogPass(); const p = g.api.createTarInventory(); p.feed(g.bytes); p.finish();
  assert.throws(() => p.finish(), { code: 'E_PHASE' });
});
test('chunks above 64 KiB and shared/proxy inputs reject before the original parser', async () => {
  for (const bytes of [Buffer.alloc(65537), new Uint8Array(new SharedArrayBuffer(10)), new Proxy(Buffer.from('x'), {})]) {
    const f = fixture(), fake = await fakeParser(f); fake.api.beginCatalogPass(); assert.throws(() => fake.api.createTarInventory().feed(bytes), { code: 'E_INPUT' }); assert.equal(fake.log.feeds, 0);
  }
});
test('fixture profile cannot increase any registered cap or accept accessor expectations', () => {
  const f = fixture(); assert.throws(() => createSdkSubsetCatalogFixture({ ...f.profile, limits: { maxCandidates: 513 } }), { code: 'E_INPUT' });
  const expectedSummary = Object.defineProperty({ ...f.profile.expectedSummary }, 'entries', { get() { assert.fail('profile getter'); } });
  assert.throws(() => createSdkSubsetCatalogFixture({ ...f.profile, expectedSummary }), { code: 'E_INPUT' });
});
for (const [name, change] of [
  ['oversized raw link', event => ({ ...event, linkpath: 'x'.repeat(1025) })],
  ['unknown link classification', event => ({ ...event, linkKind: 'resolved' })],
  ['link getter', event => Object.defineProperty({ ...event }, 'linkpath', { get() { assert.fail('link getter called'); } })],
]) test('link metadata rejects ' + name + ' without following any target', async () => {
  const f = fixture([{ path: 'lib64', type: 'symlink', link: '../lib' }]), fake = await fakeParser(f, { events: [change(f.events[0])] });
  fake.api.beginCatalogPass(); assert.throws(() => fake.api.createTarInventory().feed(f.bytes), { code: 'E_INPUT' });
});
test('returned event array accessors never execute', async () => {
  const f = fixture(), events = Object.defineProperty([null], '0', { get() { assert.fail('array getter called'); } });
  const fake = await fakeParser(f, { events }); fake.api.beginCatalogPass(); assert.throws(() => fake.api.createTarInventory().feed(f.bytes), { code: 'E_INPUT' });
});
for (const phase of ['feed', 'finish']) test('original parser ' + phase + ' failure keeps identity and clears private metadata', async () => {
  const f = fixture(), failure = Object.freeze(new Error('fixture parser failure')), fake = await fakeParser(f, { [phase + 'Error']: failure });
  fake.api.beginCatalogPass(); const parser = fake.api.createTarInventory();
  if (phase === 'finish') parser.feed(f.bytes);
  assert.throws(() => phase === 'finish' ? parser.finish() : parser.feed(f.bytes), error => error === failure);
  assert.equal(fake.api.snapshot().retainedEntries, 0); assert.equal(fake.api.snapshot().phase, 'failed');
});
