// SPEC: _spec/tooling/native-ingress/gnu-sdk-manifest-diagnostics.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { MANIFEST_DIAGNOSTIC_SOURCE_PINS, instrumentSdkManifestCollectorSource,
  transformSdkManifestCoreSource, runRegisteredGnuSdkManifestDiagnostics } from './gnu-sdk-manifest-diagnostics-operation.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const read = name => fs.readFileSync(new URL('./' + name + '.mjs', import.meta.url));
const names = ['tar-inventory', 'elf-metadata', 'xz-staging', 'gnu-sdk-inventory', 'gnu-sdk-inventory-v2-operation', 'gnu-sdk-inventory-v4-operation', 'sdk-driver-controls'];
const captured = new Map(names.map(name => [name, read(name)]));
const source = read('gnu-sdk-manifest-diagnostics-operation').toString();
const raw = captured.get('sdk-driver-controls');
const patches = JSON.parse(source.match(/const manifestPatches = (\[[\s\S]*?\n\])\.map/)[1]);
const appendix = source.match(/const manifestAppendix = `([\s\S]*?)`;/)[1];
const link = (bytes, name, dependencyUri) => Buffer.from(bytes.toString().replace("from './" + name + ".mjs'", "from '" + dependencyUri + "'"));
const [v2, v4] = await Promise.all([import(uri(captured.get('gnu-sdk-inventory-v2-operation'))), import(uri(captured.get('gnu-sdk-inventory-v4-operation')))]);
const tarSource = v4.transformTarInventoryV4Source(captured.get('tar-inventory'));
const tar = await import(uri(tarSource));
const core = transformSdkManifestCoreSource(v2.transformSdkInventoryV2Source(captured.get('gnu-sdk-inventory')));
const instrumented = instrumentSdkManifestCollectorSource(raw);
const linkedCollector = link(instrumented, 'tar-inventory', uri(tarSource));
const collectorUri = uri(linkedCollector), linkedPipeline = link(core, 'tar-inventory', collectorUri);
const originalModule = await import(uri(link(raw, 'tar-inventory', uri(tarSource))));
const receiptBytes = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/xz-qualification.receipt.json', import.meta.url));
const root = 'x86-64--glibc--stable-2026.08-1';
let serial = 0;
const fresh = async (bytes = linkedCollector) => import(uri(bytes) + '#fixture-' + ++serial);
function sameThrow(fn, value) {
  let threw = false; try { fn(); } catch (error) { threw = true; assert.equal(error, value); }
  assert.equal(threw, true);
}
function expectedDiagnostic(bytes, reason, pathLineOrdinal = null, byteLength = 0) {
  return { reason, pathLineOrdinal, byteLength, prefixHex: bytes.subarray(0, 128).toString('hex'), manifestByteLength: bytes.length, manifestSha256: sha(bytes) };
}
function header(path, size = 0) {
  const bytes = Buffer.alloc(512); bytes.write(path, 0, 100);
  for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, size], [136, 12, 0]]) {
    bytes.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  }
  bytes[156] = 48; bytes.write('ustar\0', 257, 6); bytes.write('00', 263, 2); bytes.fill(32, 148, 156);
  const sum = bytes.reduce((total, byte) => total + byte, 0); bytes.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii'); return bytes;
}
const member = (path, bytes) => Buffer.concat([header(path, bytes.length), bytes, Buffer.alloc((512 - bytes.length % 512) % 512)]);
function elfFixture() {
  const bytes = Buffer.alloc(64); bytes.set([0x7f, 69, 76, 70, 2, 1, 1]);
  bytes.writeUInt16LE(2, 16); bytes.writeUInt16LE(62, 18); bytes.writeUInt32LE(1, 20); bytes.writeBigUInt64LE(64n, 32);
  bytes.writeUInt16LE(64, 52); bytes.writeUInt16LE(56, 54); return bytes;
}
async function fixture(options = {}) {
  const ns = await fresh(), driver = elfFixture(), location = options.location ?? Buffer.from('/opt/sdk\n');
  const relocs = options.relocs ?? Buffer.from('./bin/data\n');
  const bytes = Buffer.concat([member(ns.SDK_DRIVER_TARGETS[0].path, driver), member(ns.SDK_DRIVER_TARGETS[1].path, location),
    member(ns.SDK_DRIVER_TARGETS[2].path, relocs), member(root + '/bin/data', Buffer.from('unselected-body')), Buffer.alloc(1024)]);
  assert.ok(bytes.length < 1048576);
  const parser = tar.createTarMemberInventory(); parser.feed(bytes); const summary = parser.finish();
  const profile = { expectedSummary: Object.fromEntries(Object.keys(ns.SDK_DRIVER_EXPECTATION).map(key => [key, summary[key]])),
    expectedDecodedSha256: options.expectedDigest ?? sha(bytes), targets: [
      ...summary.fileSpans.slice(0, 2).map(({ size, index, bodyOffset }) => ({ size, index, bodyOffset })), { maxSize: 1048576 },
    ], limits: options.limits ?? {} };
  return { ns, driver, location, relocs, bytes, api: ns.createSdkDriverControlsFixture(profile) };
}
const receipt = (inventory, extra = {}) => ({ state: 'GNU_SDK_DATA_INVENTORY', mockOnly: true, inventory,
  archivePasses: 2, closeAttempts: 2, stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true,
  exitCode: 0, signal: null, extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false, ...extra });
function purePass(f, members) {
  if (members) f.api.beginMemberPass(); else f.api.beginCapturePass();
  const parser = f.api.createTarInventory({ maxHeaders: 32768 }); parser.feed(f.bytes); return parser.finish();
}
let mockId = 0;
async function fixtureGraph(f, options) {
  const key = '__sdkManifestFixture' + ++mockId;
  globalThis[key] = { a: f.api, ns: f.ns, relocs: f.relocs, options };
  const adapterUri = uri(`const d = globalThis[${JSON.stringify(key)}], a = d.a;
    export const beginMemberPass = () => a.beginMemberPass(); export const createTarInventory = x => a.createTarInventory(x);
    export const acceptMemberPass = x => a.acceptMemberPass(x); export const beginCapturePass = () => a.beginCapturePass();
    export const acceptCapturePass = x => d.options.skipOwnAcceptance ? undefined : a.acceptCapturePass(x);
    export const getInspectionData = () => d.options.skipOwnAcceptance ? d.ns.parseSdkRelocationManifest(d.relocs) : a.getInspectionData();
    export const snapshotDriverInspection = () => d.options.fakeAcceptedSnapshot ? { ...a.snapshot(), hasAcceptedSecondPass: true } : a.snapshot();
    export const abortDriverInspection = () => a.abortInspection(); export const readManifestFailureDiagnostic = () => d.ns.readManifestFailureDiagnostic();`);
  try {
    const [pipeline, adapter] = await Promise.all([import(uri(link(core, 'tar-inventory', adapterUri))), import(adapterUri)]);
    return { pipeline, adapter, adapterUri };
  } finally { delete globalThis[key]; }
}
function ioHarness(graph, options) {
  const input = Buffer.from('0123456789'), stats = {
    root: { dev: 11n, ino: 101n, mode: 0o40700n, uid: 1000n, gid: 1000n, nlink: 2n, size: 4096n, mtimeNs: 100n, ctimeNs: 101n },
    file: { dev: 22n, ino: 202n, mode: 0o100600n, uid: 1000n, gid: 1000n, nlink: 1n, size: 10n, mtimeNs: 200n, ctimeNs: 201n },
  };
  const identity = Object.fromEntries(Object.entries(stats).map(([kind, value]) => [kind, Object.fromEntries(Object.entries(value).map(([key, value]) => [key, String(value)]))]));
  const log = { reads: [], closes: [], spawns: [], kills: [], listenerCounts: [] }; let pass = 0;
  const kind = path => path === graph.pipeline.GNU_SDK_DESCRIPTOR.root ? 'root' : path === graph.pipeline.GNU_SDK_DESCRIPTOR.file ? 'file' : assert.fail('unexpected path');
  const io = {
    lstatSync: path => ({ ...stats[kind(path)] }), fstatSync: fd => ({ ...stats[fd === 41 ? 'root' : 'file'] }), openSync: path => kind(path) === 'root' ? 41 : 42,
    readSync(fd, buffer, offset, length, position) { assert.equal(fd, 42); log.reads.push([pass, position, length]); return input.copy(buffer, offset, position, position + length); },
    closeSync(fd) { log.closes.push([pass, fd]); if (options.closeFailure === pass && fd === 42) throw new Error('mock close'); },
  };
  function spawn(...args) {
    log.spawns.push(args); const child = new EventEmitter(); for (const name of ['stdin', 'stdout', 'stderr']) child[name] = new EventEmitter();
    child.stdout.on('newListener', event => { if (event === 'data') log.listenerCounts.push(child.stdout.listenerCount('data')); });
    child.stdin.write = (bytes, callback) => { assert.ok(Buffer.isBuffer(bytes)); queueMicrotask(callback); return true; };
    child.kill = signal => { log.kills.push(signal); queueMicrotask(() => child.emit('close', null, signal)); };
    child.stdin.end = () => {
      child.stdin.emit('finish'); child.stdout.emit('data', options.output(pass)); if (log.kills.length) return;
      child.stdout.emit('end'); if (log.kills.length) return; child.stderr.emit('end'); child.stdout.emit('close'); child.stderr.emit('close');
      child.emit('exit', 0, null); child.emit('close', 0, null); child.stdin.emit('close');
    };
    assert.equal(child.stdout.listenerCount('data'), 0);
    queueMicrotask(() => options.spawnFailure === pass ? child.emit('error', new Error('mock spawn')) : child.emit('spawn')); return child;
  }
  async function run(deps) {
    pass++;
    return graph.pipeline.createSdkInventoryFixtureRunner({ archiveBytes: 10, archiveSha256: sha(input) }, { fs: io, spawn, now: options.now, ...deps })(identity);
  }
  return { run, spawn, log };
}
async function mockOperation(options = {}) {
  const f = await fixture(options.fixture), graph = await fixtureGraph(f, options), clock = { value: 0 };
  if (options.seedDiagnostic) assert.throws(() => f.ns.parseSdkRelocationManifest(Buffer.from('./cached-prior')));
  const h = ioHarness(graph, { ...options, now: () => clock.value,
    output: pass => pass === 2 && options.changedSecond ? options.changedSecond(f.bytes) : f.bytes });
  const log = { reads: [], stages: [], preloads: 0, calls: 0 }; let nowCalls = 0;
  const key = '__sdkManifestOperation' + ++mockId;
  const context = {
    now: () => ++nowCalls > 1 && options.preflightExpired ? 10000 : clock.value,
    fs: { readFileSync(path) {
      log.reads.push(path); if (options.readFailure) throw new Error('mock source read');
      if (path.endsWith('/xz-qualification.receipt.json')) return options.receiptFailure ? Buffer.from('bad') : receiptBytes;
      const prefix = '/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/', name = path.slice(prefix.length, -4);
      assert.equal(path, prefix + name + '.mjs'); assert.ok(captured.has(name)); return options.corrupt === name ? Buffer.from('bad') : captured.get(name);
    } }, spawn: h.spawn,
    verifyStagedXzImages(value) { log.stages.push(value); if (options.stageFailure) throw new Error('mock stage'); return { counters: { fsCalls: 10, readBytes: 100, closeAttempts: 5 } }; },
    assertNoSystemPreload() { log.preloads++; return !options.preloadFailure; },
    async runGnuSdkInventory(identity, deps) {
      assert.equal(identity.file.size, '102296280'); log.calls++; const result = await h.run(deps);
      if (options.insufficientBudget && log.calls === 1) clock.value = 130001;
      if (options.expireAfterSecond && log.calls === 2) clock.value = 250000;
      if (options.thirdSpawn && log.calls === 2) deps.spawn('mock-only'); return result;
    },
  };
  globalThis[key] = context;
  const dependencyUri = uri(`const d = globalThis[${JSON.stringify(key)}]; export default d.fs;
    export const spawn = d.spawn; export const fixtureNow = d.now; export const verifyStagedXzImages = d.verifyStagedXzImages;
    export const assertNoSystemPreload = d.assertNoSystemPreload; export const runGnuSdkInventory = d.runGnuSdkInventory;`);
  let mocked = source.replace("from 'node:fs'", "from '" + dependencyUri + "'").replace("from 'node:child_process'", "from '" + dependencyUri + "'")
    .replaceAll('performance.now()', 'fixtureNow()').replace('import(uri(stageSource))', 'import(' + JSON.stringify(dependencyUri) + ')')
    .replace('import(uri(pipelineSource))', 'import(' + JSON.stringify(dependencyUri) + ')').replace('import(collectorUri)', 'import(' + JSON.stringify(graph.adapterUri) + ')');
  mocked = `import { fixtureNow } from '${dependencyUri}';\n` + mocked;
  if (!options.productionGuards) for (const [from, to] of [
    ['value.mockOnly !== false', 'value.mockOnly !== true'], ['value.archiveBytes !== 102296280', 'value.archiveBytes !== 10'],
    ["value.archiveSha256 !== 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3'", "value.archiveSha256 !== '" + sha(Buffer.from('0123456789')) + "'"],
    ['value.archiveDataBytes !== 204592560', 'value.archiveDataBytes !== 20'], ['value.archiveRequestedBytes !== 204592562', 'value.archiveRequestedBytes !== 22'],
    ['counts.archiveDataBytes !== 409185120', 'counts.archiveDataBytes !== 40'], ['counts.archiveRequestedBytes !== 409185124', 'counts.archiveRequestedBytes !== 44'],
    ["profile: 'registered-gnu-sdk-manifest-diagnostics-v1'", "profile: 'mock-sdk-manifest-diagnostics-fixture'"], ['realArchiveInspected: error === null', 'realArchiveInspected: false'],
  ]) { assert.ok(mocked.includes(from)); mocked = mocked.replace(from, to); }
  try {
    const operation = await import(uri(mocked)); assert.equal(log.reads.length, 0);
    return { f, graph, h, log, run: async () => { const result = await operation.runRegisteredGnuSdkManifestDiagnostics(); assert.ok(Object.isFrozen(result)); return { ...result, receipt: JSON.parse(result.text) }; } };
  } finally { delete globalThis[key]; }
}

test('cold import exposes one fixed zero-argument operation and no path, CLI, retry, networking or write capability', () => {
  assert.equal(runRegisteredGnuSdkManifestDiagnostics.length, 0);
  assert.doesNotMatch(source, /await runRegisteredGnuSdkManifestDiagnostics|process\.(?:env|argv)|runRegisteredGnuSdkDriverControls\(/);
  assert.doesNotMatch(source, /\b(?:fetch|writeFileSync|writeSync|mkdirSync|unlink|rmSync|rename|execFileSync)\s*\(/);
});
test('all captured sources, each transform stage and both linked graphs match exact deterministic pins', () => {
  const refs = [...source.matchAll(/\['([a-z0-9-]+)', (\d+), '([a-f0-9]{64})'\]/g)]; assert.deepEqual(refs.map(ref => ref[1]), names);
  for (const [, name, size, digest] of refs) { assert.equal(captured.get(name).length, Number(size)); assert.equal(sha(captured.get(name)), digest); }
  let branch = raw.toString(); for (const [needle, replacement] of patches) { assert.equal(branch.split(needle).length, 2); branch = branch.replace(needle, replacement); }
  for (const [bytes, pin] of [[Buffer.from(branch), MANIFEST_DIAGNOSTIC_SOURCE_PINS.branchCollector], [instrumented, MANIFEST_DIAGNOSTIC_SOURCE_PINS.instrumentedCollector],
    [linkedCollector, MANIFEST_DIAGNOSTIC_SOURCE_PINS.linkedCollector], [linkedPipeline, MANIFEST_DIAGNOSTIC_SOURCE_PINS.linkedPipeline],
    [core, MANIFEST_DIAGNOSTIC_SOURCE_PINS.controlsCore], [tarSource, MANIFEST_DIAGNOSTIC_SOURCE_PINS.transformedTar]]) {
    assert.deepEqual({ bytes: bytes.length, sha256: sha(bytes) }, pin); assert.ok(Object.isFrozen(pin));
  }
  assert.equal(receiptBytes.length, 4239); assert.equal(sha(receiptBytes), 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233');
  assert.ok(linkedPipeline.toString().includes("from '" + collectorUri + "'")); assert.match(source, /import\(collectorUri\)/);
});
test('reversing only diagnostic statements and the read-only appendix restores every original source byte', () => {
  assert.ok(instrumented.toString().endsWith(appendix));
  let restored = instrumented.toString().slice(0, -appendix.length);
  for (const [needle, replacement] of [...patches].reverse()) { assert.equal(restored.split(replacement).length, 2); restored = restored.replace(replacement, needle); }
  assert.deepEqual(Buffer.from(restored), raw);
  assert.doesNotMatch(appendix, /\.message|\.code|node:|\.on\(|\.resume\(|\.pause\(/);
});
for (let i = 0; i < patches.length; i++) for (const kind of ['missing', 'duplicate']) test('checked transform rejects ' + kind + ' needle ' + (i + 1), () => {
  const needle = patches[i][0]; const input = kind === 'missing' ? Buffer.from(raw.toString().replace(needle, '')) : Buffer.concat([raw, Buffer.from(needle)]);
  assert.throws(() => instrumentSdkManifestCollectorSource(input), { code: 'E_SOURCE_PIN' });
});
test('same-length hash changes, already-instrumented bytes and proxy input fail before source import', () => {
  const wrong = Buffer.from(raw); wrong[100] ^= 1;
  for (const value of [wrong, instrumented, new Proxy(raw, { get() { assert.fail('proxy trap'); } })]) assert.throws(() => instrumentSdkManifestCollectorSource(value), { code: 'E_SOURCE_PIN' });
});
test('old source, operators and all historical tests retain their exact current hashes', () => {
  for (const [name, digest] of [
    ['gnu-sdk-inventory', 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29'],
    ['gnu-sdk-inventory.test', '67825a3e8c685c0fddafc554076b9203a9b6e9ac5e1a83cfb4d4459e5e84e9cc'],
    ['gnu-sdk-inventory-operation', '3b9dfbf8c7b045884af420b43c24bff6f90eea04aa8e5b6e967af1b22ec3411f'],
    ['gnu-sdk-inventory-operation.test', '79a915de890809dc3284cd9e5204b08af6239e120f0f49177d98512d3de51ad4'],
    ['gnu-sdk-inventory-v2-operation', '39da4bc85f6e7eaaecb0abd157d59ec4c2dcb6191a19c9247cbadd0080ae767a'],
    ['gnu-sdk-inventory-v2-operation.test', '3c4c3ebb98a0880d487c3d638714aeba0423bc3aabef4122d474bf506308a3c2'],
    ['tar-observer', '6211785adf6470eb6af8f437a6815aa194b75063f0f7ad9a90c48ad9e3747ab1'],
    ['gnu-sdk-inventory-v3-operation', '2714854c2fe0521abcb6b4acf2a80b8a5e46b7026922f2ff849c970167d80ea1'],
    ['gnu-sdk-inventory-v3-operation.test', 'd48ac4a1c6a9ae154452d56d7f95df1303b3db25b4022263c58e9a3f1eba20ac'],
    ['gnu-sdk-inventory-v4-operation', '2ea3c1bfe71676c37d01a05b64f9d3f11e4a7d7d93541cfdc4707a378bae17db'],
    ['gnu-sdk-inventory-v4-operation.test', '96d9660717568b56dbdf962701d1d296883c495df494b8dbf67a1cd4dd6c6f08'],
    ['sdk-control-inspection', 'f6736f8f00524782a32784b7a2f3bba350d39633545f521f12924524b8a856fa'],
    ['gnu-sdk-controls-operation', '504b1dbaaca54cc7613092717da4732afb63e68c01ee5554db41309b4dd83ff7'],
    ['gnu-sdk-controls-operation.test', '44451f319b02d6c2c9c12873a92850dbd185e0065bd9e287b717d9d8688cc6bd'],
    ['sdk-driver-controls', '3e9acafe464aa0a4418d5c9c7522683c2948035b93f95c96a290b8fdb264ec93'],
    ['gnu-sdk-driver-controls-operation', '77c3e004a68cd7b860354da5e3f83053bfd5352136ce0e7cc6cfd4f008a65a3a'],
    ['gnu-sdk-driver-controls-operation.test', '026e88458806fcdecc72286acc3c593f21c5ecf7544e8b9e37a7006bc5990122'],
  ]) assert.equal(sha(read(name)), digest);
});
test('identity, lifecycle, stage checks, byte totals, time reserves and all core parser caps remain unchanged', async () => {
  const previous = read('gnu-sdk-driver-controls-operation').toString();
  for (const pattern of [/const identity = \{[\s\S]*?\n\};/u, /const gate = \(\) => \{[\s\S]*?\n    \};/u,
    /async function runPass\(number\) \{[\s\S]*?\n    \}/u]) assert.equal(source.match(pattern)?.[0], previous.match(pattern)?.[0]);
  assert.match(source, /function guard\(limit = 250000\)/); assert.match(source, /started \+ 250000 - guard\(\) < 120000/);
  assert.match(source, /guard\(10000\)/); assert.match(source, /Buffer.byteLength\(text\) > 2097152/);
  const stream = v2.transformSdkInventoryV2Source(captured.get('gnu-sdk-inventory'));
  assert.deepEqual(Buffer.from(core.toString().replace('maxSummaryBytes: 4_194_304', 'maxSummaryBytes: 262_144')), stream);
  const ns = await fresh(); assert.deepEqual(ns.SDK_DRIVER_LIMITS, originalModule.SDK_DRIVER_LIMITS);
  assert.equal(ns.SDK_DRIVER_DECODED_SHA256, '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f');
  assert.deepEqual(Object.keys(ns).filter(key => !Object.hasOwn(originalModule, key)), ['readManifestFailureDiagnostic']);
});
for (const [bytes, reason, ordinal, length, code] of [
  [Buffer.from('./bin/data\n'), 'PATH_GRAMMAR', 1, 10, 'E_MANIFEST'],
  [Buffer.from('ok\n./bad\n'), 'PATH_GRAMMAR', 2, 5, 'E_MANIFEST'],
  [Buffer.from('a\na\n'), 'DUPLICATE_LITERAL_LINE', 2, 1, 'E_MANIFEST'],
  [Buffer.from('x'.repeat(1000)), 'ROOTED_PATH_TOO_LONG', 1, 1000, 'E_MANIFEST'],
  [Buffer.from('\n'), 'EMPTY_BODY', null, 0, 'E_MANIFEST'],
  [Buffer.alloc(0), 'EMPTY_BODY', null, 0, 'E_INPUT'],
  [Buffer.from([0xff]), 'INVALID_UTF8', null, 0, 'E_TEXT'],
]) test('strict failure retains ' + code + ' with fixed diagnostic ' + reason + '/' + ordinal, async () => {
  const ns = await fresh(); assert.throws(() => originalModule.parseSdkRelocationManifest(bytes), { code });
  assert.throws(() => ns.parseSdkRelocationManifest(bytes), { code });
  assert.deepEqual(ns.readManifestFailureDiagnostic(), expectedDiagnostic(bytes, reason, ordinal, length));
});
test('line-count diagnostic stops at the next unconsumed line with ordinal 4097 and no line byte count', async () => {
  const ns = await fresh(), bytes = Buffer.from(Array.from({ length: 4097 }, (_, i) => 'f' + i).join('\n'));
  assert.throws(() => ns.parseSdkRelocationManifest(bytes), { code: 'E_MANIFEST' });
  assert.deepEqual(ns.readManifestFailureDiagnostic(), expectedDiagnostic(bytes, 'LINE_COUNT_LIMIT', 4097));
});
test('prefix is the first raw manifest bytes even when byte 128 splits a UTF8 character on a later line', async () => {
  const ns = await fresh(), bytes = Buffer.from('ok\n' + 'a'.repeat(124) + 'π');
  assert.throws(() => ns.parseSdkRelocationManifest(bytes), { code: 'E_MANIFEST' });
  const diagnostic = ns.readManifestFailureDiagnostic();
  assert.deepEqual(diagnostic, expectedDiagnostic(bytes, 'PATH_GRAMMAR', 2, 126));
  assert.ok(diagnostic.prefixHex.endsWith('cf')); assert.equal(diagnostic.prefixHex.length, 256);
  assert.equal(diagnostic.manifestByteLength, 129);
});
test('one huge bounded offending line yields only fixed primitive metrics and never a path or payload array', async () => {
  const ns = await fresh(), bytes = Buffer.alloc(1048576, 97);
  assert.throws(() => ns.parseSdkRelocationManifest(bytes), { code: 'E_MANIFEST' });
  const diagnostic = ns.readManifestFailureDiagnostic(); assert.equal(diagnostic.byteLength, 1048576);
  assert.deepEqual(Object.keys(diagnostic), ['reason', 'pathLineOrdinal', 'byteLength', 'prefixHex', 'manifestByteLength', 'manifestSha256']);
  assert.ok(Object.values(diagnostic).every(value => value === null || ['string', 'number'].includes(typeof value)));
  assert.ok(Object.isFrozen(diagnostic)); assert.ok(Buffer.byteLength(JSON.stringify(diagnostic)) <= 512);
  assert.throws(() => { diagnostic.reason = 'changed'; }, TypeError);
});
test('the first diagnostic stays latched by identity across subsequent failures and valid parser calls', async () => {
  const ns = await fresh(); assert.equal(ns.readManifestFailureDiagnostic(), null);
  assert.throws(() => ns.parseSdkRelocationManifest(Buffer.from('./first')), { code: 'E_MANIFEST' }); const first = ns.readManifestFailureDiagnostic();
  assert.throws(() => ns.parseSdkRelocationManifest(Buffer.from('a\na')), { code: 'E_MANIFEST' });
  assert.deepEqual(ns.parseSdkRelocationManifest(Buffer.from('valid')), ['valid']); assert.equal(ns.readManifestFailureDiagnostic(), first);
});
test('successful grammar output is unchanged and returns the exact original frozen result object', async () => {
  const key = '__sdkManifestReturn' + ++serial;
  const observed = Buffer.from(linkedCollector.toString().replace('return Object.freeze(paths);', `return (globalThis[${JSON.stringify(key)}] = Object.freeze(paths));`));
  const ns = await fresh(observed); const bytes = Buffer.from('bin/a\nlib/.hidden\n__proto__\n');
  try {
    const value = ns.parseSdkRelocationManifest(bytes); assert.equal(value, globalThis[key]);
    assert.deepEqual(value, originalModule.parseSdkRelocationManifest(bytes)); assert.ok(Object.isFrozen(value)); assert.equal(ns.readManifestFailureDiagnostic(), null);
  } finally { delete globalThis[key]; }
});
for (const [needle, reason] of [['function literalPath(path, code) {', 'PATH_GRAMMAR'], ['function text(bytes, max) {', 'INVALID_UTF8']]) {
  test('diagnostic catch rethrows the original ' + reason + ' exception without reading getters or messages', async () => {
    const key = '__sdkManifestError' + ++serial;
    const sentinel = Object.defineProperties({}, { code: { get() { assert.fail('code getter'); } }, message: { get() { assert.fail('message getter'); } } });
    globalThis[key] = sentinel;
    try {
      const ns = await fresh(Buffer.from(linkedCollector.toString().replace(needle, needle + ` throw globalThis[${JSON.stringify(key)}];`)));
      sameThrow(() => ns.parseSdkRelocationManifest(Buffer.from('valid')), sentinel);
      assert.equal(ns.readManifestFailureDiagnostic().reason, reason);
    } finally { delete globalThis[key]; }
  });
}
test('native view capture honors shadowed accessors while invalid proxy/shared/oversized data keeps original input failures', async () => {
  const ns = await fresh(), bytes = Buffer.from('./bad'); for (const key of ['length', 'buffer', 'byteOffset']) Object.defineProperty(bytes, key, { get() { assert.fail(key); } });
  assert.throws(() => ns.parseSdkRelocationManifest(bytes), { code: 'E_MANIFEST' }); assert.equal(ns.readManifestFailureDiagnostic().manifestByteLength, 5);
  for (const value of [new Proxy(Buffer.alloc(1), { get() { assert.fail('proxy'); } }), new Uint8Array(new SharedArrayBuffer(1)), Buffer.alloc(1048577)]) {
    const freshNs = await fresh(); assert.throws(() => freshNs.parseSdkRelocationManifest(value), { code: 'E_INPUT' }); assert.equal(freshNs.readManifestFailureDiagnostic(), null);
  }
});
test('post-failure metrics are released only after both actual fixture cores and collector second acceptance', async () => {
  const h = await mockOperation(), { exitCode, receipt, text } = await h.run();
  assert.equal(exitCode, 1); assert.equal(receipt.status, 'STOP'); assert.equal(receipt.error, 'E_MANIFEST');
  assert.equal(receipt.profile, 'mock-sdk-manifest-diagnostics-fixture'); assert.equal(receipt.counts.completedCorePasses, 2);
  assert.equal(receipt.inspection.hasAcceptedSecondPass, true); assert.equal(receipt.inspection.phase, 'failed');
  assert.deepEqual(receipt.manifestDiagnostic, expectedDiagnostic(h.f.relocs, 'PATH_GRAMMAR', 1, 10));
  assert.equal(receipt.counts.archivePasses, 4); assert.equal(receipt.counts.archiveDataBytes, 40); assert.equal(receipt.counts.archiveRequestedBytes, 44);
  assert.equal(receipt.counts.archiveCloseAttempts, 4); assert.equal(receipt.counts.stageChecks, 4); assert.equal(h.log.preloads, 4);
  assert.deepEqual(h.h.log.closes, [[1, 42], [1, 41], [2, 42], [2, 41]]); assert.deepEqual(h.h.log.listenerCounts, [0, 1, 0, 1]);
  assert.equal(Object.hasOwn(receipt, 'result'), false); assert.doesNotMatch(text, /"joined"|"paths"|"declarations"|"bytes"\s*:\s*\[/);
  assert.equal(receipt.realArchiveInspected, false);
  for (const key of ['nativeQualified', 'installedUsability', 'pythonFreeSubsetVerified', 'rustReady', 'trainingReady', 'archiveExtracted', 'filesInstalled', 'pythonRuntimeInvoked', 'hardRssBounded', 'hardDeadlineGuaranteed', 'processTreeBounded']) assert.equal(receipt[key], false);
});
test('two core counters without collector-owned second acceptance cannot release a fresh diagnostic', async () => {
  const h = await mockOperation({ skipOwnAcceptance: true }), { receipt } = await h.run();
  assert.equal(receipt.error, 'E_MANIFEST'); assert.equal(receipt.counts.completedCorePasses, 2); assert.equal(receipt.inspection.hasAcceptedSecondPass, false);
  assert.ok(h.f.ns.readManifestFailureDiagnostic()); assert.equal(receipt.manifestDiagnostic, null);
});
test('a previously cached diagnostic cannot authorize or replace evidence from the current approved capture', async () => {
  const h = await mockOperation({ seedDiagnostic: true }), { receipt } = await h.run();
  assert.equal(receipt.error, 'E_MANIFEST'); assert.equal(receipt.counts.completedCorePasses, 2); assert.equal(receipt.inspection.hasAcceptedSecondPass, true);
  assert.equal(receipt.manifestDiagnostic, null); assert.equal(h.f.ns.readManifestFailureDiagnostic().prefixHex, Buffer.from('./cached-prior').toString('hex'));
});
test('valid grammar retains normal inspection success with no diagnostic and no new permissions', async () => {
  const h = await mockOperation({ fixture: { relocs: Buffer.from('bin/data\n') } }), { exitCode, receipt } = await h.run();
  assert.equal(exitCode, 0); assert.equal(receipt.status, 'SDK_DRIVER_CONTROL_DATA_INSPECTION'); assert.equal(receipt.manifestDiagnostic, null);
  assert.deepEqual(receipt.result.relocs.paths, ['bin/data']); assert.equal(receipt.result.driver.declarations.candidateExecuted, false);
  assert.equal(receipt.realArchiveInspected, false);
});
test('invalid UTF8 and lower fixture line-count failures retain their old errors with only the approved metrics', async () => {
  const utf8 = await mockOperation({ fixture: { relocs: Buffer.from([0xff]) } }), first = await utf8.run();
  assert.equal(first.receipt.error, 'E_TEXT'); assert.deepEqual(first.receipt.manifestDiagnostic, expectedDiagnostic(utf8.f.relocs, 'INVALID_UTF8'));
  const limited = await mockOperation({ fixture: { relocs: Buffer.from('a\nb\n'), limits: { maxManifestLines: 1 } } }), second = await limited.run();
  assert.equal(second.receipt.error, 'E_MANIFEST'); assert.deepEqual(second.receipt.manifestDiagnostic, expectedDiagnostic(limited.f.relocs, 'LINE_COUNT_LIMIT', 2));
});
test('first-core hash failure cannot release cached diagnostics even when a mock snapshot claims acceptance', async () => {
  const h = await mockOperation({ seedDiagnostic: true, fakeAcceptedSnapshot: true, fixture: { expectedDigest: '0'.repeat(64) } });
  const { receipt } = await h.run(); assert.equal(receipt.error, 'E_TAR'); assert.equal(h.log.calls, 1); assert.equal(receipt.manifestDiagnostic, null);
});
for (const options of [{ closeFailure: 2 }, { spawnFailure: 1 }, { insufficientBudget: true }, { preflightExpired: true }, { expireAfterSecond: true },
  { thirdSpawn: true }, { productionGuards: true }, { corrupt: 'sdk-driver-controls' }, { receiptFailure: true }, { stageFailure: true },
  { changedSecond: bytes => { const copy = Buffer.from(bytes); copy[572] ^= 1; return copy; } }]) {
  test('unapproved or incomplete failure suppresses diagnostic and normal result: ' + Object.keys(options)[0], async () => {
    const h = await mockOperation({ ...options, seedDiagnostic: true }), { receipt } = await h.run();
    assert.equal(receipt.status, 'STOP'); assert.equal(receipt.manifestDiagnostic, null); assert.equal(Object.hasOwn(receipt, 'result'), false);
    assert.ok(h.h.log.spawns.length <= 2);
  });
}
test('non-manifest validation failure does not expose a diagnostic after both core passes', async () => {
  const h = await mockOperation({ fixture: { location: Buffer.from('/a/../b\n') } }), { receipt } = await h.run();
  assert.equal(receipt.error, 'E_LOCATION'); assert.equal(receipt.counts.completedCorePasses, 2); assert.equal(receipt.manifestDiagnostic, null);
});
test('both new files use only the parent-owned diagnostic SPEC namespace without requiring an unpublished index entry', () => {
  const pointer = '// SPEC: _spec/tooling/native-ingress/gnu-sdk-manifest-diagnostics.puml\n';
  for (const name of ['gnu-sdk-manifest-diagnostics-operation', 'gnu-sdk-manifest-diagnostics-operation.test']) assert.ok(read(name).toString().startsWith(pointer));
  const spec = '_spec/tooling/native-ingress/gnu-sdk-manifest-diagnostics.puml';
  const files = ['tooling/native-ingress/gnu-sdk-manifest-diagnostics-operation.mjs', 'tooling/native-ingress/gnu-sdk-manifest-diagnostics-operation.test.mjs'];
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(x => x.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) assert.ok(diagram.includes("' covers: " + file + '\n'));
});
