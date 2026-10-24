// SPEC: _spec/tooling/native-ingress/gnu-sdk-driver-controls.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { SDK_DRIVER_DECODED_SHA256, SDK_DRIVER_EXPECTATION, SDK_DRIVER_TARGETS, SDK_DRIVER_LIMITS,
  parseSdkLocation, parseSdkRelocationManifest, createSdkDriverControlsFixture } from './sdk-driver-controls.mjs';
import { SDK_DRIVER_SOURCE_PINS, transformSdkDriverControlsCoreSource, runRegisteredGnuSdkDriverControls } from './gnu-sdk-driver-controls-operation.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const read = name => fs.readFileSync(new URL('./' + name + '.mjs', import.meta.url));
const names = ['tar-inventory', 'elf-metadata', 'xz-staging', 'gnu-sdk-inventory', 'gnu-sdk-inventory-v2-operation', 'gnu-sdk-inventory-v4-operation', 'sdk-driver-controls'];
const captured = new Map(names.map(name => [name, read(name)]));
const source = read('gnu-sdk-driver-controls-operation').toString();
const moduleSource = captured.get('sdk-driver-controls').toString();
const link = (bytes, name, dependencyUri) => Buffer.from(bytes.toString().replace("from './" + name + ".mjs'", "from '" + dependencyUri + "'"));
const [v2, v4] = await Promise.all([import(uri(captured.get('gnu-sdk-inventory-v2-operation'))), import(uri(captured.get('gnu-sdk-inventory-v4-operation')))]);
const tarSource = v4.transformTarInventoryV4Source(captured.get('tar-inventory'));
const tar = await import(uri(tarSource));
const core = transformSdkDriverControlsCoreSource(v2.transformSdkInventoryV2Source(captured.get('gnu-sdk-inventory')));
const linkedCollector = link(captured.get('sdk-driver-controls'), 'tar-inventory', uri(tarSource));
const collectorUri = uri(linkedCollector), linkedPipeline = link(core, 'tar-inventory', collectorUri);
const collectorModule = await import(collectorUri);
const receiptBytes = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/xz-qualification.receipt.json', import.meta.url));
const root = 'x86-64--glibc--stable-2026.08-1';
const metricKeys = Object.keys(SDK_DRIVER_EXPECTATION);
function header(path, size = 0, type = '0', target = '') {
  const bytes = Buffer.alloc(512); bytes.write(path, 0, 100);
  for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, size], [136, 12, 0]]) {
    bytes.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  }
  bytes[156] = type.charCodeAt(0); bytes.write(target, 157, 100); bytes.write('ustar\0', 257, 6); bytes.write('00', 263, 2); bytes.fill(32, 148, 156);
  const sum = bytes.reduce((total, byte) => total + byte, 0); bytes.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii'); return bytes;
}
const member = (path, body = Buffer.alloc(0), type = '0', target = '') => Buffer.concat([
  header(path, body.length, type, target), body, Buffer.alloc((512 - body.length % 512) % 512),
]);
function elfFixture(size = 64) {
  const bytes = Buffer.alloc(size); bytes.set([0x7f, 69, 76, 70, 2, 1, 1]);
  bytes.writeUInt16LE(2, 16); bytes.writeUInt16LE(62, 18); bytes.writeUInt32LE(1, 20);
  bytes.writeBigUInt64LE(64n, 32); bytes.writeUInt16LE(64, 52); bytes.writeUInt16LE(56, 54); return bytes;
}
function pieces(bytes, count = 1, cuts = null) {
  const offsets = [0, ...(cuts ?? Array.from({ length: count - 1 }, (_, i) => Math.floor(bytes.length * (i + 1) / count))), bytes.length];
  return offsets.slice(1).map((end, i) => bytes.subarray(offsets[i], end));
}
function fixture(options = {}) {
  const driver = options.driver ?? elfFixture(), location = options.location ?? Buffer.from('/opt/sdk\n');
  const relocs = options.relocs ?? Buffer.from('bin/data\n');
  const references = options.references ?? [{ path: 'bin/data', body: Buffer.from('private-reference-body') }];
  const members = [];
  if (!options.missingDriver) members.push(member(SDK_DRIVER_TARGETS[0].path, driver));
  members.push(options.linkLocation ? member(SDK_DRIVER_TARGETS[1].path, Buffer.alloc(0), '2', 'outside') : member(SDK_DRIVER_TARGETS[1].path, location));
  const extra = references.map(value => member(root + '/' + value.path, value.body ?? Buffer.alloc(0), value.type ?? '0', value.target ?? ''));
  if (options.relocsAfterExtra) members.push(...extra);
  if (!options.missingRelocs) members.push(member(SDK_DRIVER_TARGETS[2].path, relocs));
  if (!options.relocsAfterExtra) members.push(...extra);
  const bytes = Buffer.concat([...members, Buffer.alloc(1024)]), feeds = options.feeds ?? 1;
  assert.ok(bytes.length <= 1048576);
  const parser = tar.createTarMemberInventory(); for (const chunk of pieces(bytes, feeds)) parser.feed(chunk);
  const original = parser.finish(), find = path => original.fileSpans.find(span => span.path === path);
  const driverSpan = find(SDK_DRIVER_TARGETS[0].path), locationSpan = find(SDK_DRIVER_TARGETS[1].path);
  const profile = { expectedSummary: { ...Object.fromEntries(metricKeys.map(key => [key, original[key]])), ...options.expected },
    expectedDecodedSha256: options.expectedDigest ?? sha(bytes), targets: options.targets ?? [
      { size: driver.length, index: driverSpan?.index ?? 1, bodyOffset: driverSpan?.bodyOffset ?? 512 },
      { size: location.length, index: locationSpan?.index ?? 2, bodyOffset: locationSpan?.bodyOffset ?? 1536 },
      { maxSize: options.relocsMax ?? 1048576 },
    ], limits: options.limits ?? {} };
  return { bytes, driver, location, relocs, feeds, profile, original, api: collectorModule.createSdkDriverControlsFixture(profile) };
}
function coreReceipt(inventory, extra = {}) {
  return { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: true, inventory, archivePasses: 2, closeAttempts: 2,
    stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true, exitCode: 0, signal: null,
    extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false, ...extra };
}
function memberPass(f, cuts = null) {
  f.api.beginMemberPass(); const parser = f.api.createTarInventory({ maxHeaders: 32768 });
  for (const chunk of pieces(f.bytes, f.feeds, cuts)) parser.feed(chunk); return parser.finish();
}
function acceptFirst(f, cuts = null) { return f.api.acceptMemberPass(coreReceipt(memberPass(f, cuts))); }
function capturePass(f, bytes = f.bytes, cuts = null) {
  f.api.beginCapturePass(); const parser = f.api.createTarInventory({ maxHeaders: 32768 });
  for (const chunk of pieces(bytes, f.feeds, cuts)) parser.feed(chunk); return parser.finish();
}
function acceptSecond(f, bytes = f.bytes, cuts = null) {
  const pending = capturePass(f, bytes, cuts); f.api.acceptCapturePass(coreReceipt(pending)); return f.api.getInspectionData();
}
let mockId = 0;
async function fixtureGraph(f) {
  const key = '__sdkDriverFixture' + ++mockId; globalThis[key] = f.api;
  const adapterUri = uri(`const a = globalThis[${JSON.stringify(key)}];
    export const beginMemberPass = () => a.beginMemberPass(); export const createTarInventory = x => a.createTarInventory(x);
    export const acceptMemberPass = x => a.acceptMemberPass(x); export const beginCapturePass = () => a.beginCapturePass();
    export const acceptCapturePass = x => a.acceptCapturePass(x); export const getInspectionData = () => a.getInspectionData();
    export const snapshotDriverInspection = () => a.snapshot(); export const abortDriverInspection = () => a.abortInspection();`);
  try {
    const [pipeline, adapter] = await Promise.all([import(uri(link(core, 'tar-inventory', adapterUri))), import(adapterUri)]);
    return { pipeline, adapter, adapterUri };
  } finally { delete globalThis[key]; }
}
async function spanFixture(change) {
  const f = fixture(), summary = { ...f.original, fileSpans: f.original.fileSpans.map(value => ({ ...value })) };
  change(summary.fileSpans); const key = '__sdkDriverSpans' + ++mockId; globalThis[key] = summary;
  const fakeTarUri = uri(`const s = globalThis[${JSON.stringify(key)}];
    export function createTarMemberInventory() { return Object.freeze({ feed: () => Object.freeze([]), finish: () => s }); }
    export function createTarInventory() { throw new Error('unused fixture'); }`);
  try {
    const module = await import(uri(link(captured.get('sdk-driver-controls'), 'tar-inventory', fakeTarUri)));
    const api = module.createSdkDriverControlsFixture(f.profile); api.beginMemberPass(); const parser = api.createTarInventory(); parser.feed(f.bytes);
    return { api, parser, summary };
  } finally { delete globalThis[key]; }
}
function ioHarness(graph, options = {}) {
  const input = Buffer.from('0123456789'), stats = {
    root: { dev: 11n, ino: 101n, mode: 0o40700n, uid: 1000n, gid: 1000n, nlink: 2n, size: 4096n, mtimeNs: 100n, ctimeNs: 101n },
    file: { dev: 22n, ino: 202n, mode: 0o100600n, uid: 1000n, gid: 1000n, nlink: 1n, size: 10n, mtimeNs: 200n, ctimeNs: 201n },
  };
  const expected = Object.fromEntries(Object.entries(stats).map(([kind, value]) => [kind, Object.fromEntries(Object.entries(value).map(([key, value]) => [key, String(value)]))]));
  const log = { reads: [], closes: [], spawns: [], kills: [], listenerCounts: [] }; let pass = 0, child;
  const kind = path => path === graph.pipeline.GNU_SDK_DESCRIPTOR.root ? 'root' : path === graph.pipeline.GNU_SDK_DESCRIPTOR.file ? 'file' : assert.fail('unexpected path');
  const io = {
    lstatSync: path => ({ ...stats[kind(path)] }), fstatSync: fd => ({ ...stats[fd === 41 ? 'root' : 'file'] }), openSync: path => kind(path) === 'root' ? 41 : 42,
    readSync(fd, buffer, offset, length, position) { assert.equal(fd, 42); log.reads.push([pass, position, length]); return input.copy(buffer, offset, position, position + length); },
    closeSync(fd) { log.closes.push([pass, fd]); if (options.closeFailure === pass && fd === 42) throw new Error('mock close'); },
  };
  function spawn(...args) {
    log.spawns.push(args); child = new EventEmitter(); for (const name of ['stdin', 'stdout', 'stderr']) child[name] = new EventEmitter();
    child.stdout.on('newListener', event => { if (event === 'data') log.listenerCounts.push(child.stdout.listenerCount('data')); });
    child.stdin.write = (bytes, callback) => { assert.ok(Buffer.isBuffer(bytes)); queueMicrotask(callback); return true; };
    child.kill = signal => { log.kills.push(signal); queueMicrotask(() => child.emit('close', null, signal)); };
    child.stdin.end = () => {
      child.stdin.emit('finish'); for (const chunk of options.output(pass)) child.stdout.emit('data', chunk);
      if (log.kills.length) return; child.stdout.emit('end'); if (log.kills.length) return;
      child.stderr.emit('end'); child.stdout.emit('close'); child.stderr.emit('close'); child.emit('exit', 0, null); child.emit('close', 0, null); child.stdin.emit('close');
    };
    assert.equal(child.stdout.listenerCount('data'), 0);
    queueMicrotask(() => options.spawnFailure === pass ? child.emit('error', new Error('mock spawn')) : child.emit('spawn')); return child;
  }
  async function run(deps = {}) {
    pass++;
    return graph.pipeline.createSdkInventoryFixtureRunner({ archiveBytes: 10, archiveSha256: sha(input) }, { fs: io, spawn, now: options.now ?? (() => 0),
      beforeDecode: () => ({ stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true }),
      afterDecode: () => ({ stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true }), ...deps })(expected);
  }
  return { run, spawn, log, get child() { return child; } };
}
async function mockOperation(options = {}) {
  const f = fixture(options.fixture), graph = await fixtureGraph(f), clock = { value: 0 };
  const h = ioHarness(graph, { ...options, now: () => clock.value,
    output: pass => pieces(pass === 2 && options.changedSecond ? options.changedSecond(f.bytes) : f.bytes) });
  const log = { reads: [], stages: [], preloads: 0, calls: 0 }; let nowCalls = 0;
  const key = '__sdkDriverOperation' + ++mockId;
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
    ["profile: 'registered-gnu-sdk-driver-controls-v1'", "profile: 'mock-sdk-driver-controls-fixture'"], ['realArchiveInspected: error === null', 'realArchiveInspected: false'],
  ]) { assert.ok(mocked.includes(from)); mocked = mocked.replace(from, to); }
  try {
    const operation = await import(uri(mocked)); assert.equal(log.reads.length, 0);
    return { f, graph, h, log, run: async () => { const result = await operation.runRegisteredGnuSdkDriverControls(); assert.ok(Object.isFrozen(result)); return { ...result, receipt: JSON.parse(result.text) }; } };
  } finally { delete globalThis[key]; }
}

test('cold imports and the zero-argument operation expose no CLI, SDK execution, filesystem writes, extraction or networking', () => {
  assert.equal(runRegisteredGnuSdkDriverControls.length, 0);
  assert.doesNotMatch(source, /await runRegisteredGnuSdkDriverControls|process\.(?:env|argv)|runRegisteredGnuSdkControls\(|runRegisteredGnuSdkInventoryV[1234]\(/);
  assert.doesNotMatch(source, /\b(?:fetch|writeFileSync|writeSync|mkdirSync|unlink|rmSync|rename|execFileSync)\s*\(/);
  assert.doesNotMatch(moduleSource, /node:(?:fs|child_process)|\.on\(|\.resume\(|\.pause\(/);
});
test('every captured raw source, receipt and deterministic linked program matches its registered pin', () => {
  const pins = [...source.matchAll(/\['([a-z0-9-]+)', (\d+), '([a-f0-9]{64})'\]/g)]; assert.deepEqual(pins.map(pin => pin[1]), names);
  for (const [, name, size, digest] of pins) { assert.equal(captured.get(name).length, Number(size)); assert.equal(sha(captured.get(name)), digest); }
  for (const [bytes, pin] of [[core, SDK_DRIVER_SOURCE_PINS.controlsCore], [tarSource, SDK_DRIVER_SOURCE_PINS.transformedTar],
    [captured.get('sdk-driver-controls'), SDK_DRIVER_SOURCE_PINS.collector], [linkedCollector, SDK_DRIVER_SOURCE_PINS.linkedCollector], [linkedPipeline, SDK_DRIVER_SOURCE_PINS.linkedPipeline]]) {
    assert.deepEqual({ bytes: bytes.length, sha256: sha(bytes) }, pin); assert.ok(Object.isFrozen(pin));
  }
  assert.equal(receiptBytes.length, 4239); assert.equal(sha(receiptBytes), 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233');
  const stage = link(captured.get('xz-staging'), 'elf-metadata', uri(captured.get('elf-metadata')));
  assert.equal(stage.length, 43154); assert.equal(sha(stage), '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2');
});
test('all older operator, collector and test hashes remain frozen', () => {
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
  ]) assert.equal(sha(read(name)), digest);
});
test('production binds the independent decoded SHA and the exact three approved target names and tuples', () => {
  assert.equal(SDK_DRIVER_DECODED_SHA256, '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f');
  assert.deepEqual(SDK_DRIVER_TARGETS.map(value => [value.key, value.size, value.index, value.bodyOffset]), [
    ['driver', 2349760, 29, 61895680], ['location', 79, 279, 265943552], ['relocs', undefined, undefined, undefined],
  ]);
  assert.equal(SDK_DRIVER_TARGETS[2].path, root + '/share/buildroot/sdk-relocs'); assert.equal(SDK_DRIVER_TARGETS[2].maxSize, 1048576);
  assert.equal(SDK_DRIVER_LIMITS.maxPayloadBytes, 3398415); assert.equal(SDK_DRIVER_LIMITS.maxJoinedBytes, 1048576);
  assert.equal(SDK_DRIVER_LIMITS.maxManifestLines, 4096); assert.equal(SDK_DRIVER_EXPECTATION.entries, 8412);
});
test('only the already accepted summary-envelope literal changes in the core and the captured collector URI is shared', async () => {
  const stream = v2.transformSdkInventoryV2Source(captured.get('gnu-sdk-inventory'));
  assert.deepEqual(Buffer.from(core.toString().replace('maxSummaryBytes: 4_194_304', 'maxSummaryBytes: 262_144')), stream);
  for (const bytes of [Buffer.from('bad'), Buffer.concat([stream, Buffer.from('maxSummaryBytes: 262_144')]), core]) assert.throws(() => transformSdkDriverControlsCoreSource(bytes), { code: 'E_SOURCE_PIN' });
  assert.ok(linkedPipeline.toString().includes("from '" + collectorUri + "'")); assert.equal(await import(collectorUri), collectorModule);
  assert.match(source, /import\(collectorUri\)/); assert.doesNotMatch(source, /import\(['"]\.\//);
  assert.match(source, /function guard\(limit = 250000\)/); assert.match(source, /started \+ 250000 - guard\(\) < 120000/);
  assert.match(source, /guard\(10000\)/); assert.match(source, /Buffer.byteLength\(text\) > 2097152/);
  assert.match(source, /inspectElf64Requirements\(driver.bytes\)/); assert.match(source, /> 131072/);
  assert.equal(source.match(/const identity = \{[\s\S]*?\n\};/)[0], read('gnu-sdk-controls-operation').toString().match(/const identity = \{[\s\S]*?\n\};/)[0]);
});
test('location permits exactly one canonical absolute-prefix line with an optional terminal LF', () => {
  assert.equal(parseSdkLocation(Buffer.from('/opt/sdk')), '/opt/sdk'); assert.equal(parseSdkLocation(Buffer.from('/opt/sdk\n')), '/opt/sdk');
  assert.equal(parseSdkLocation(Buffer.from('/' + 'a'.repeat(77) + '\n')), '/' + 'a'.repeat(77));
  assert.throws(() => parseSdkLocation(Buffer.from('/' + 'a'.repeat(78) + '\n')), { code: 'E_INPUT' });
});
for (const value of ['relative/path', '/', '/a/../b', '/a/./b', '/a//b', '/a/', '/a\r\n', '/a\n\n', '/a\nb', '/a\0', '/a\tb', '/a b', ' /a', '/a\\b', '/a/$HOME', '/a/"b"', '\ufeff/a']) {
  test('location rejects unsupported literal ' + JSON.stringify(value), () => assert.throws(() => parseSdkLocation(Buffer.from(value)), { code: 'E_LOCATION' }));
}
test('location and manifest decoding reject malformed UTF8 instead of replacing bytes', () => {
  for (const parse of [parseSdkLocation, parseSdkRelocationManifest]) assert.throws(() => parse(Buffer.from([0xff])), { code: 'E_TEXT' });
});
test('literal manifest supports ordinary file spellings without granting any authority', () => {
  const result = parseSdkRelocationManifest(Buffer.from('bin/x-g++\nlib/.hidden\n__proto__\nshare/gdb/python/gdb.py\n'));
  assert.deepEqual(result, ['bin/x-g++', 'lib/.hidden', '__proto__', 'share/gdb/python/gdb.py']); assert.ok(Object.isFrozen(result));
});
for (const value of ['\n', '/absolute', 'C:drive', '.', '..', './a', 'a/../b', 'a/./b', 'a//b', 'a/', 'a\\b', 'a\0b', 'a\tb', 'a\rb',
  'a\n\n', '\na', 'a\na\n', 'a b', ' a', 'a ', '$HOME/a', '${SDK}/a', '$(echo a)', '`echo a`', 'a;b', 'a|b', 'a&b', 'a>b', 'a*b', 'a?b', '"a"', "'a'", '#comment', 'a\r\n']) {
  test('manifest rejects unsupported literal ' + JSON.stringify(value), () => assert.throws(() => parseSdkRelocationManifest(Buffer.from(value)), { code: 'E_MANIFEST' }));
}
test('manifest accepts 4096 unique short lines and rejects the 4097th before an unbounded allocation', () => {
  const paths = Array.from({ length: 4096 }, (_, i) => 'f' + i); assert.equal(parseSdkRelocationManifest(Buffer.from(paths.join('\n') + '\n')).length, 4096);
  assert.throws(() => parseSdkRelocationManifest(Buffer.from([...paths, 'extra'].join('\n'))), { code: 'E_MANIFEST' });
  assert.throws(() => parseSdkRelocationManifest(Buffer.alloc(1048577, 97)), { code: 'E_INPUT' });
});
test('member acceptance locks the three exact range snapshots and no body data is available early', () => {
  const f = fixture(), pending = memberPass(f); assert.equal(pending.state, 'TAR_MEMBER_INVENTORY');
  assert.equal(f.api.snapshot().hasCompleteMemberPass, true); assert.throws(() => f.api.beginCapturePass(), { code: 'E_PHASE' });
  const metadata = f.api.acceptMemberPass(coreReceipt(pending));
  assert.equal(metadata.targets.length, 3); assert.equal(metadata.decodedSha256, f.profile.expectedDecodedSha256);
  assert.equal(metadata.targets[2].path, root + '/share/buildroot/sdk-relocs'); assert.ok(Object.isFrozen(metadata.targets[2]));
  assert.equal(Object.hasOwn(metadata, 'lookup'), false); assert.equal(Object.hasOwn(metadata, 'fileSpans'), false);
});
test('all three bodies cross arbitrary chunk boundaries while unknown member bytes are never retained', () => {
  const f = fixture({ feeds: 5 }); acceptFirst(f, [100, 600, 1800, 3000]);
  const result = acceptSecond(f, f.bytes, [513, 1538, 2561, 3585]);
  assert.deepEqual(result.driver.bytes, f.driver); assert.equal(result.location.prefix, '/opt/sdk'); assert.deepEqual(result.relocs.paths, ['bin/data']);
  assert.equal(result.driver.sha256, sha(f.driver)); assert.equal(result.location.sha256, sha(f.location)); assert.equal(result.relocs.sha256, sha(f.relocs));
  assert.equal(f.api.snapshot().copiedBytes, f.driver.length + f.location.length + f.relocs.length);
  assert.equal(result.relocs.joined.length, 1); assert.equal(Object.hasOwn(result.relocs.joined[0], 'bytes'), false);
  assert.equal(f.api.snapshot().phase, 'released'); assert.throws(() => f.api.getInspectionData(), { code: 'E_PHASE' });
});
test('the new third target obtains its index and offset only from complete accepted metadata', () => {
  const f = fixture({ relocsAfterExtra: true }), metadata = acceptFirst(f);
  assert.equal(metadata.targets[2].index, 4); assert.equal(metadata.targets[2].bodyOffset, 3584); assert.equal(acceptSecond(f).relocs.index, 4);
});
test('the independent first digest rejects a self-consistent alternative archive before capture can start', () => {
  const f = fixture({ expectedDigest: '0'.repeat(64) }); assert.throws(() => memberPass(f), { code: 'E_HASH' });
  assert.equal(f.api.snapshot().hasCompleteMemberPass, false); assert.throws(() => f.api.beginCapturePass(), { code: 'E_PHASE' });
});
for (const [name, options] of [['missing driver', { missingDriver: true }], ['missing relocs', { missingRelocs: true }],
  ['linked location', { linkLocation: true }], ['oversized relocs', { relocsMax: 1 }]]) {
  test('fixed target binding rejects ' + name, () => { const f = fixture(options); assert.throws(() => acceptFirst(f), { code: 'E_TARGET' }); });
}
for (const [key, value] of [['size', 65], ['index', 2], ['bodyOffset', 513]]) test('the driver tuple independently binds ' + key, () => {
  const f = fixture(); f.profile.targets[0][key] = value; const api = collectorModule.createSdkDriverControlsFixture(f.profile); f.api = api;
  assert.throws(() => acceptFirst(f), { code: 'E_TARGET' });
});
for (const [name, change, code] of [
  ['out-of-range span', spans => { spans[0].bodyOffset = 999999; }, 'E_SPAN'],
  ['overlap', spans => { spans[1].bodyOffset = spans[0].bodyOffset; }, 'E_SPAN'],
  ['invalid index', spans => { spans[0].index = 0; }, 'E_SPAN'],
  ['duplicate regular key', spans => { spans[3].path = spans[0].path; }, 'E_SPAN'],
]) test('private dictionary rejects ' + name, async () => {
  const f = await spanFixture(change), pending = f.parser.finish(); assert.throws(() => f.api.acceptMemberPass(coreReceipt(pending)), { code });
});
test('regular metadata getters and proxies fail without traps, and accepted copies do not alias the caller array', async () => {
  for (const change of [spans => { Object.defineProperty(spans[0], 'path', { get() { assert.fail('path getter'); } }); },
    spans => { spans[0] = new Proxy(spans[0], { get() { assert.fail('proxy trap'); } }); }]) {
    const f = await spanFixture(change); assert.throws(() => f.parser.finish(), { code: 'E_INPUT' });
  }
  const f = await spanFixture(() => {}), pending = f.parser.finish(), metadata = f.api.acceptMemberPass(coreReceipt(pending));
  f.summary.fileSpans[0].bodyOffset = 9; f.summary.fileSpans.length = 0; assert.equal(metadata.targets[0].bodyOffset, 512);
});
test('lookup keys named __proto__ stay inert Map entries and Python/GDB references authorize no payload selection', () => {
  const references = [{ path: '__proto__' }, { path: 'share/gdb/python/gdb.py' }];
  const f = fixture({ references, relocs: Buffer.from('__proto__\nshare/gdb/python/gdb.py\n') }); acceptFirst(f); const result = acceptSecond(f);
  assert.equal(result.relocs.joined.length, 2); assert.equal(result.relocs.joined[0].path, root + '/__proto__');
  assert.equal(f.api.snapshot().copiedBytes, f.driver.length + f.location.length + f.relocs.length);
});
for (const [name, references] of [['missing', []], ['linked', [{ path: 'bin/data', type: '2', target: 'outside' }]]]) {
  test('manifest join rejects a ' + name + ' regular reference after both complete passes', () => {
    const f = fixture({ references }); acceptFirst(f); assert.throws(() => acceptSecond(f), { code: 'E_REFERENCE' }); assert.equal(f.api.snapshot().phase, 'failed');
  });
}
test('span, key, payload, internal-summary and joined JSON budgets fail without truncation', () => {
  for (const [limits, expected] of [[{ maxLookupKeyBytes: 1 }, 'E_OUTPUT'], [{ maxPayloadBytes: 1 }, 'E_OUTPUT']]) {
    assert.throws(() => acceptFirst(fixture({ limits })), { code: expected });
  }
  assert.throws(() => memberPass(fixture({ limits: { maxInternalSummaryBytes: 1 } })), { code: 'E_OUTPUT' });
  assert.throws(() => memberPass(fixture({ limits: { maxSpanBytes: 1 } })), { code: 'E_SPAN_BYTES' });
  const normal = fixture(); acceptFirst(normal); const joinedSize = Buffer.byteLength(JSON.stringify(acceptSecond(normal).relocs.joined));
  const exact = fixture({ limits: { maxJoinedBytes: joinedSize } }); acceptFirst(exact); assert.equal(acceptSecond(exact).relocs.joined.length, 1);
  const tooSmall = fixture({ limits: { maxJoinedBytes: joinedSize - 1 } }); acceptFirst(tooSmall); assert.throws(() => acceptSecond(tooSmall), { code: 'E_OUTPUT' });
});
test('later hash, TAR EOF and post-core close failures suppress all payloads and joins', () => {
  const changed = fixture(); acceptFirst(changed); const copy = Buffer.from(changed.bytes); copy[512 + 60] ^= 1;
  assert.throws(() => capturePass(changed, copy), { code: 'E_HASH' }); assert.throws(() => changed.api.getInspectionData(), { code: 'E_PHASE' });
  const truncated = fixture(); acceptFirst(truncated); assert.throws(() => capturePass(truncated, truncated.bytes.subarray(0, -512)), { code: 'E_TRUNCATED' });
  const close = fixture(); acceptFirst(close); const pending = capturePass(close);
  assert.throws(() => close.api.acceptCapturePass(coreReceipt(pending, { closeAttempts: 1 })), { code: 'E_RECEIPT' }); assert.throws(() => close.api.getInspectionData(), { code: 'E_PHASE' });
});
test('full summary and exact core-result identity remain required before accepting any first-pass span', () => {
  const bad = fixture({ expected: { metadataSha256: '0'.repeat(64) } }); assert.throws(() => memberPass(bad), { code: 'E_SUMMARY' });
  const f = fixture(), pending = memberPass(f); assert.throws(() => f.api.acceptMemberPass(coreReceipt({ ...pending })), { code: 'E_RECEIPT' });
});
test('fixture configuration cannot raise resource bounds, change target paths or supply accessor/proxy records', () => {
  const f = fixture();
  for (const profile of [{ ...f.profile, limits: { maxManifestLines: 4097 } }, { ...f.profile, limits: { maxPayloadBytes: 3398416 } },
    { ...f.profile, targets: [{ ...f.profile.targets[0], path: '/other' }, ...f.profile.targets.slice(1)] },
    new Proxy(f.profile, { get() { assert.fail('profile proxy'); } })]) assert.throws(() => createSdkDriverControlsFixture(profile), { code: 'E_INPUT' });
  const limits = Object.defineProperty({}, 'maxJoinedBytes', { enumerable: true, get() { assert.fail('limits getter'); } });
  assert.throws(() => createSdkDriverControlsFixture({ ...f.profile, limits }), { code: 'E_INPUT' });
});
test('native view getters protect split input shapes and a third parser factory can never be created', () => {
  const f = fixture(), bytes = Buffer.from(f.bytes); for (const key of ['length', 'buffer', 'byteOffset']) Object.defineProperty(bytes, key, { get() { assert.fail(key); } });
  f.api.beginMemberPass(); const parser = f.api.createTarInventory(); parser.feed(bytes); f.api.acceptMemberPass(coreReceipt(parser.finish()));
  const result = acceptSecond(f); f.bytes.fill(0); assert.deepEqual(result.driver.bytes, f.driver);
  assert.throws(() => f.api.createTarInventory(), { code: 'E_PHASE' }); assert.equal(f.api.snapshot().factoryCalls, 2);
  for (const value of [new Proxy(Buffer.alloc(1), { get() { assert.fail('chunk proxy'); } }), new Uint8Array(new SharedArrayBuffer(1))]) {
    const fresh = fixture(); fresh.api.beginMemberPass(); assert.throws(() => fresh.api.createTarInventory().feed(value), { code: 'E_INPUT' });
  }
});
test('two actual fixture-core runs retain fixed FD/hash/EOF, dictionary, 16MiB decoder and C/UTC pipe contracts', async () => {
  const f = fixture(), graph = await fixtureGraph(f), h = ioHarness(graph, { output: () => [f.bytes] });
  f.api.beginMemberPass(); const first = await h.run(); f.api.acceptMemberPass(first); f.api.beginCapturePass(); const second = await h.run(); f.api.acceptCapturePass(second);
  assert.equal(first.mockOnly, true); assert.equal(second.realArchiveInspected, false); assert.equal(f.api.getInspectionData().relocs.joined.length, 1);
  assert.equal(h.log.reads.length, 8); assert.deepEqual(h.log.closes, [[1, 42], [1, 41], [2, 42], [2, 41]]);
  const decoderRoot = graph.pipeline.GNU_SDK_DESCRIPTOR.decoderRoot;
  for (const [command, args, options] of h.log.spawns) {
    assert.equal(command, decoderRoot + '/ld-linux-x86-64.so.2');
    assert.deepEqual(args, ['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', decoderRoot, decoderRoot + '/xz', '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=16777216', '--', '-']);
    assert.deepEqual(options, { cwd: decoderRoot, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  }
});
test('mocked operation returns bounded ELF declarations and three refs only after full second-core acceptance', async () => {
  const h = await mockOperation(), { exitCode, receipt, text } = await h.run(); assert.equal(exitCode, 0); assert.equal(receipt.profile, 'mock-sdk-driver-controls-fixture');
  assert.equal(receipt.realArchiveInspected, false); assert.equal(receipt.result.driver.declarations.header.machine, 62);
  assert.equal(receipt.result.location.prefix, '/opt/sdk'); assert.deepEqual(receipt.result.relocs.paths, ['bin/data']);
  assert.equal(receipt.result.decodedSha256, h.f.profile.expectedDecodedSha256); assert.equal(receipt.result.relocs.joined[0].path, root + '/bin/data');
  assert.equal(Object.hasOwn(receipt.result.driver, 'bytes'), false); assert.equal(Object.hasOwn(receipt.result, 'fileSpans'), false);
  assert.equal(receipt.counts.archivePasses, 4); assert.equal(receipt.counts.archiveDataBytes, 40); assert.equal(receipt.counts.archiveRequestedBytes, 44);
  assert.equal(receipt.counts.stageChecks, 4); assert.equal(h.log.preloads, 4); assert.ok(h.log.stages.every(value => value === h.log.stages[0]));
  assert.deepEqual(h.h.log.listenerCounts, [0, 1, 0, 1]); assert.equal(receipt.packetDiagnostics.length, 2); assert.ok(Buffer.byteLength(text) < 2097152);
  for (const key of ['nativeQualified', 'installedUsability', 'pythonFreeSubsetVerified', 'rustReady', 'trainingReady', 'archiveExtracted', 'filesInstalled', 'pythonRuntimeInvoked', 'hardRssBounded', 'hardDeadlineGuaranteed', 'processTreeBounded']) assert.equal(receipt[key], false);
});
test('unmodified production joint-core guards reject fixture results and never start the second decoder', async () => {
  const h = await mockOperation({ productionGuards: true }), { receipt } = await h.run(); assert.equal(receipt.error, 'E_RECEIPT');
  assert.equal(h.log.calls, 1); assert.equal(h.h.log.spawns.length, 1); assert.equal(Object.hasOwn(receipt, 'result'), false);
});
test('independent first hash failure and insufficient remaining time each forbid pass two', async () => {
  const hash = await mockOperation({ fixture: { expectedDigest: '0'.repeat(64) } }), first = await hash.run();
  assert.equal(first.receipt.error, 'E_TAR'); assert.equal(hash.log.calls, 1); assert.equal(first.receipt.inspection.copiedBytes, 0);
  const time = await mockOperation({ insufficientBudget: true }), second = await time.run(); assert.equal(second.receipt.error, 'E_DEADLINE');
  assert.equal(time.log.calls, 1); assert.equal(second.receipt.inspection.factoryCalls, 1); assert.equal(second.receipt.inspection.captureBytes, 0);
});
test('preflight and final global deadlines suppress all output without any extra cleanup allowance', async () => {
  const early = await mockOperation({ preflightExpired: true }), first = await early.run(); assert.equal(first.receipt.error, 'E_DEADLINE'); assert.equal(early.log.reads.length, 0);
  const late = await mockOperation({ expireAfterSecond: true }), second = await late.run(); assert.equal(second.receipt.error, 'E_DEADLINE');
  assert.equal(late.h.log.spawns.length, 2); assert.equal(Object.hasOwn(second.receipt, 'result'), false);
});
test('second-pass close or decoded-hash failures never return location, manifest or driver declarations', async () => {
  for (const options of [{ closeFailure: 2 }, { changedSecond: bytes => { const copy = Buffer.from(bytes); copy[512 + 60] ^= 1; return copy; } }]) {
    const h = await mockOperation(options), { receipt, text } = await h.run(); assert.equal(receipt.error, options.closeFailure ? 'E_CLOSE' : 'E_TAR');
    assert.equal(Object.hasOwn(receipt, 'result'), false); assert.doesNotMatch(text, /"prefix"|"joined"|"declarations"/);
  }
});
test('a third child attempt fails before launch and no fallback or retry occurs', async () => {
  const h = await mockOperation({ thirdSpawn: true }), { receipt } = await h.run(); assert.equal(receipt.error, 'E_LIMIT');
  assert.equal(receipt.counts.spawnAttempts, 3); assert.equal(h.h.log.spawns.length, 2); assert.equal(Object.hasOwn(receipt, 'result'), false);
});
for (const [name, options, code] of [['location', { fixture: { location: Buffer.from('/a/../b\n') } }, 'E_LOCATION'],
  ['manifest', { fixture: { relocs: Buffer.from('bin/../data\n') } }, 'E_MANIFEST'], ['missing reference', { fixture: { references: [] } }, 'E_REFERENCE'],
  ['malformed ELF', { fixture: { driver: Buffer.alloc(64) } }, 'E_ELF'], ['join envelope', { fixture: { limits: { maxJoinedBytes: 1 } } }, 'E_OUTPUT']]) {
  test('late ' + name + ' failure suppresses every provisional output after both decoder passes', async () => {
    const h = await mockOperation(options), { receipt, text } = await h.run(); assert.equal(receipt.error, code); assert.equal(h.h.log.spawns.length, 2);
    assert.equal(receipt.counts.completedCorePasses, 2); assert.equal(receipt.realArchiveInspected, false); assert.equal(Object.hasOwn(receipt, 'result'), false);
    assert.doesNotMatch(text, /"prefix"|"joined"|"declarations"/);
  });
}
test('source pins, receipt, stage and spawn failures preserve narrow errors and zero provisional data', async () => {
  for (const options of [{ corrupt: 'sdk-driver-controls' }, { receiptFailure: true }, { stageFailure: true }, { preloadFailure: true }, { spawnFailure: 1 }]) {
    const h = await mockOperation(options), { receipt } = await h.run();
    assert.equal(receipt.error, options.corrupt || options.receiptFailure ? 'E_SOURCE_PIN' : options.spawnFailure ? 'E_SPAWN' : 'E_PREREQUISITE');
    assert.equal(Object.hasOwn(receipt, 'result'), false); assert.ok(h.h.log.spawns.length <= 1);
  }
});
test('all three new files reference the parent-owned driver SPEC without requiring an unpublished diagram or index', () => {
  const pointer = '// SPEC: _spec/tooling/native-ingress/gnu-sdk-driver-controls.puml\n';
  for (const name of ['sdk-driver-controls', 'gnu-sdk-driver-controls-operation', 'gnu-sdk-driver-controls-operation.test']) assert.ok(read(name).toString().startsWith(pointer));
  const spec = '_spec/tooling/native-ingress/gnu-sdk-driver-controls.puml';
  const files = ['tooling/native-ingress/sdk-driver-controls.mjs', 'tooling/native-ingress/gnu-sdk-driver-controls-operation.mjs', 'tooling/native-ingress/gnu-sdk-driver-controls-operation.test.mjs'];
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(x => x.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) assert.ok(diagram.includes("' covers: " + file + '\n'));
});
