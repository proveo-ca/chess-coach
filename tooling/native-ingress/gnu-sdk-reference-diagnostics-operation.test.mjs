// SPEC: _spec/tooling/native-ingress/gnu-sdk-reference-diagnostics.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { SDK_REFERENCE_SOURCE_PINS, instrumentSdkReferenceCollectorSource, runRegisteredGnuSdkReferenceDiagnostics } from './gnu-sdk-reference-diagnostics-operation.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const read = name => fs.readFileSync(new URL('./' + name + '.mjs', import.meta.url));
const names = ['tar-inventory', 'elf-metadata', 'xz-staging', 'gnu-sdk-inventory', 'gnu-sdk-inventory-v2-operation', 'gnu-sdk-inventory-v4-operation', 'sdk-driver-controls', 'gnu-sdk-driver-controls-v2-operation'];
const captured = new Map(names.map(name => [name, read(name)]));
const source = read('gnu-sdk-reference-diagnostics-operation').toString();
const patches = JSON.parse(source.match(/const referencePatches = (\[[\s\S]*?\n\])\.map/)[1]);
const appendixRaw = source.match(/const referenceAppendix = `([\s\S]*?)`;/)[1];
const appendix = JSON.parse('"' + appendixRaw.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"');
const link = (bytes, name, dependencyUri) => Buffer.from(bytes.toString().replace("from './" + name + ".mjs'", "from '" + dependencyUri + "'"));
const [v2, v4, driverV2] = await Promise.all([import(uri(captured.get('gnu-sdk-inventory-v2-operation'))), import(uri(captured.get('gnu-sdk-inventory-v4-operation'))), import(uri(captured.get('gnu-sdk-driver-controls-v2-operation')))]);
const alias = driverV2.transformSdkDriverAliasSource(captured.get('sdk-driver-controls'));
const instrumented = instrumentSdkReferenceCollectorSource(alias), tarSource = v4.transformTarInventoryV4Source(captured.get('tar-inventory'));
const tar = await import(uri(tarSource)), elf = await import(uri(captured.get('elf-metadata')));
const core = driverV2.transformSdkDriverV2CoreSource(v2.transformSdkInventoryV2Source(captured.get('gnu-sdk-inventory')));
const linkedCollector = link(instrumented, 'tar-inventory', uri(tarSource)), collectorUri = uri(linkedCollector);
const linkedPipeline = link(core, 'tar-inventory', collectorUri), aliasModule = await import(uri(link(alias, 'tar-inventory', uri(tarSource))));
const receiptBytes = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/xz-qualification.receipt.json', import.meta.url));
const root = 'x86-64--glibc--stable-2026.08-1';
const pinNeedle = "const referenceManifestPin = Object.freeze({ byteLength: 9367, sha256: '60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e' });";
const testExports = '\nexport const testReferenceInternals = Object.freeze({ newReferenceDiagnostics, retainReferenceEvents, acceptReferenceMetadata, checkReferenceManifest, recordRejectedReference, referenceFailureSnapshot, releaseReferenceMetadata });\n';
let serial = 0;
async function testModule(bytes = Buffer.from('./bin/missing\n'), options = {}) {
  let text = linkedCollector.toString();
  if (!options.productionManifestPin) {
    assert.equal(text.split(pinNeedle).length, 2);
    text = text.replace(pinNeedle, 'const referenceManifestPin = Object.freeze({ byteLength: ' + bytes.length + ", sha256: '" + sha(bytes) + "' });");
  }
  if (options.replace) text = options.replace(text);
  return import(uri(text + testExports) + '#fixture-' + ++serial);
}
const entry = (index, path, type = 'file', extra = {}) => Object.freeze({ index, path, type, size: 0,
  ...(type === 'symlink' || type === 'hardlink' ? { linkpath: 'uninterpreted-target', linkKind: 'relative' } : {}), ...extra });
function acceptedState(ns, entries, manifestBytes = Buffer.from('./bin/missing\n')) {
  const api = ns.testReferenceInternals, state = api.newReferenceDiagnostics(entries.length);
  api.retainReferenceEvents(state, Object.freeze(entries)); api.acceptReferenceMetadata(state, entries.length); api.checkReferenceManifest(state, manifestBytes);
  return { api, state };
}
function header(path, size = 0, type = '0', target = '') {
  const bytes = Buffer.alloc(512); bytes.write(path, 0, 100);
  for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, size], [136, 12, 0]]) bytes.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  bytes[156] = type.charCodeAt(0); bytes.write(target, 157, 100); bytes.write('ustar\0', 257, 6); bytes.write('00', 263, 2); bytes.fill(32, 148, 156);
  const sum = bytes.reduce((total, byte) => total + byte, 0); bytes.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii'); return bytes;
}
const member = (path, body = Buffer.alloc(0), type = '0', target = '') => Buffer.concat([header(path, body.length, type, target), body, Buffer.alloc((512 - body.length % 512) % 512)]);
function elfFixture() {
  const bytes = Buffer.alloc(64); bytes.set([0x7f, 69, 76, 70, 2, 1, 1]); bytes.writeUInt16LE(2, 16); bytes.writeUInt16LE(62, 18); bytes.writeUInt32LE(1, 20);
  bytes.writeBigUInt64LE(64n, 32); bytes.writeUInt16LE(64, 52); bytes.writeUInt16LE(56, 54); return bytes;
}
async function fixture(options = {}) {
  const relocs = options.relocs ?? Buffer.from('./bin/missing\n'), ns = await testModule(relocs, options);
  const driver = elfFixture(), location = Buffer.from('/opt/sdk\n');
  const references = options.references ?? [];
  const bytes = Buffer.concat([member(ns.SDK_DRIVER_TARGETS[0].path, driver), member(ns.SDK_DRIVER_TARGETS[1].path, location), member(ns.SDK_DRIVER_TARGETS[2].path, relocs),
    ...references.map(value => member(root + '/' + value.path, value.body, value.type, value.target)), Buffer.alloc(1024)]);
  assert.ok(bytes.length < 1048576);
  const parser = tar.createTarMemberInventory(); parser.feed(bytes); const summary = parser.finish();
  const profile = { expectedSummary: Object.fromEntries(Object.keys(ns.SDK_DRIVER_EXPECTATION).map(key => [key, summary[key]])),
    expectedDecodedSha256: options.expectedDigest ?? sha(bytes), targets: [...summary.fileSpans.slice(0, 2).map(({ size, index, bodyOffset }) => ({ size, index, bodyOffset })), { maxSize: 1048576 }], limits: {} };
  return { ns, bytes, relocs, driver, location, summary, profile, api: ns.createSdkDriverControlsFixture(profile) };
}
const receipt = (inventory, extra = {}) => ({ state: 'GNU_SDK_DATA_INVENTORY', mockOnly: true, inventory, archivePasses: 2, closeAttempts: 2,
  stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true, exitCode: 0, signal: null,
  extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false, ...extra });
function firstPass(f) { f.api.beginMemberPass(); const p = f.api.createTarInventory(); p.feed(f.bytes); return f.api.acceptMemberPass(receipt(p.finish())); }
function captureFinished(f) { f.api.beginCapturePass(); const p = f.api.createTarInventory(); p.feed(f.bytes); return p.finish(); }
function sameThrow(fn, expected) { let threw = false; try { fn(); } catch (error) { threw = true; assert.equal(error, expected); } assert.equal(threw, true); }
async function fixtureGraph(f, options) {
  const key = '__sdkReferenceFixture' + ++serial;
  const cached = Object.freeze({ reason: 'REFERENCE_NOT_REGULAR', canonicalRelativePath: 'cached', rootedPath: root + '/cached', matchedEntry: 'ABSENT', ancestorLinks: Object.freeze([]) });
  globalThis[key] = { a: f.api, ns: f.ns, options, cached, getStarted: false };
  const adapterUri = uri(`const d = globalThis[${JSON.stringify(key)}], a = d.a;
    export const beginMemberPass = () => a.beginMemberPass(); export const createTarInventory = x => a.createTarInventory(x);
    export const acceptMemberPass = x => a.acceptMemberPass(x); export const beginCapturePass = () => a.beginCapturePass();
    export const acceptCapturePass = x => d.options.skipOwnAcceptance ? undefined : a.acceptCapturePass(x);
    export const snapshotDriverInspection = () => a.snapshot(); export const abortDriverInspection = () => a.abortInspection();
    export const readReferenceFailureDiagnostic = () => d.options.cachedDiagnostic || (d.options.skipOwnAcceptance && d.getStarted) ? d.cached : a.readReferenceFailureDiagnostic();
    export function getInspectionData() {
      d.getStarted = true;
      if (d.options.skipOwnAcceptance) throw new d.ns.SdkDriverControlsError('E_REFERENCE');
      const result = a.getInspectionData();
      if (!d.options.pinnedManifestRef) return result;
      return { ...result, relocs: { ...result.relocs, byteLength: 9367, sha256: '60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e' } };
    }`);
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
  async function run(deps) { pass++; return graph.pipeline.createSdkInventoryFixtureRunner({ archiveBytes: 10, archiveSha256: sha(input) }, { fs: io, spawn, now: options.now, ...deps })(identity); }
  return { run, spawn, log };
}
async function mockOperation(options = {}) {
  const f = await fixture(options.fixture), graph = await fixtureGraph(f, options), clock = { value: 0 };
  const h = ioHarness(graph, { ...options, now: () => clock.value, output: pass => pass === 2 && options.changedSecond ? options.changedSecond(f.bytes) : f.bytes });
  const log = { reads: [], stages: [], preloads: 0, calls: 0, elfCalls: 0 }; let nowCalls = 0;
  const key = '__sdkReferenceOperation' + ++serial;
  const context = {
    now: () => ++nowCalls > 1 && options.preflightExpired ? 10000 : clock.value,
    fs: { readFileSync(path) {
      log.reads.push(path); if (path.endsWith('/xz-qualification.receipt.json')) return options.receiptFailure ? Buffer.from('bad') : receiptBytes;
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
    inspectElf64Requirements(bytes) { log.elfCalls++; return elf.inspectElf64Requirements(bytes); },
  };
  globalThis[key] = context;
  const dependencyUri = uri(`const d = globalThis[${JSON.stringify(key)}]; export default d.fs;
    export const spawn = d.spawn; export const fixtureNow = d.now; export const verifyStagedXzImages = d.verifyStagedXzImages;
    export const assertNoSystemPreload = d.assertNoSystemPreload; export const runGnuSdkInventory = d.runGnuSdkInventory;
    export const inspectElf64Requirements = d.inspectElf64Requirements;`);
  let mocked = source.replace("from 'node:fs'", "from '" + dependencyUri + "'").replace("from 'node:child_process'", "from '" + dependencyUri + "'")
    .replaceAll('performance.now()', 'fixtureNow()').replace('import(uri(stageSource))', 'import(' + JSON.stringify(dependencyUri) + ')')
    .replace('import(uri(pipelineSource))', 'import(' + JSON.stringify(dependencyUri) + ')').replace('import(collectorUri)', 'import(' + JSON.stringify(graph.adapterUri) + ')')
    .replace('import(elfUri)', 'import(' + JSON.stringify(dependencyUri) + ')');
  mocked = `import { fixtureNow } from '${dependencyUri}';\n` + mocked;
  if (!options.productionGuards) for (const [from, to] of [
    ['value.mockOnly !== false', 'value.mockOnly !== true'], ['value.archiveBytes !== 102296280', 'value.archiveBytes !== 10'],
    ["value.archiveSha256 !== 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3'", "value.archiveSha256 !== '" + sha(Buffer.from('0123456789')) + "'"],
    ['value.archiveDataBytes !== 204592560', 'value.archiveDataBytes !== 20'], ['value.archiveRequestedBytes !== 204592562', 'value.archiveRequestedBytes !== 22'],
    ['counts.archiveDataBytes !== 409185120', 'counts.archiveDataBytes !== 40'], ['counts.archiveRequestedBytes !== 409185124', 'counts.archiveRequestedBytes !== 44'],
    ["profile: 'registered-gnu-sdk-reference-diagnostics-v1'", "profile: 'mock-sdk-reference-diagnostics-fixture'"], ['realArchiveInspected: error === null', 'realArchiveInspected: false'],
  ]) { assert.ok(mocked.includes(from)); mocked = mocked.replace(from, to); }
  try {
    const operation = await import(uri(mocked)); assert.equal(log.reads.length, 0);
    return { f, h, log, run: async () => { const result = await operation.runRegisteredGnuSdkReferenceDiagnostics(); assert.ok(Object.isFrozen(result)); return { ...result, receipt: JSON.parse(result.text) }; } };
  } finally { delete globalThis[key]; }
}

test('operation imports inertly with zero arguments and no SDK, shell, network, extraction or write calls', () => {
  assert.equal(runRegisteredGnuSdkReferenceDiagnostics.length, 0);
  assert.doesNotMatch(source, /await runRegisteredGnuSdkReferenceDiagnostics|process\.(?:argv|env)|runRegisteredGnuSdkDriverControlsV2\(/);
  assert.doesNotMatch(source, /\b(?:fetch|writeFileSync|writeSync|mkdirSync|unlink|rmSync|rename|execFileSync)\s*\(/);
});
test('all raw captures, private transform stages, linked graphs and the staged receipt match exact independent pins', () => {
  const refs = [...source.matchAll(/\['([a-z0-9-]+)', (\d+), '([a-f0-9]{64})'\]/g)]; assert.deepEqual(refs.map(ref => ref[1]), names);
  for (const [, name, size, digest] of refs) { assert.equal(captured.get(name).length, Number(size)); assert.equal(sha(captured.get(name)), digest); }
  let branch = alias.toString(); for (const [needle, replacement] of patches) { assert.equal(branch.split(needle).length, 2); branch = branch.replace(needle, replacement); }
  for (const [bytes, pin] of [[alias, SDK_REFERENCE_SOURCE_PINS.aliasCollector], [Buffer.from(branch), SDK_REFERENCE_SOURCE_PINS.branchCollector],
    [instrumented, SDK_REFERENCE_SOURCE_PINS.instrumentedCollector], [linkedCollector, SDK_REFERENCE_SOURCE_PINS.linkedCollector], [linkedPipeline, SDK_REFERENCE_SOURCE_PINS.linkedPipeline],
    [core, SDK_REFERENCE_SOURCE_PINS.controlsCore], [tarSource, SDK_REFERENCE_SOURCE_PINS.transformedTar]]) assert.deepEqual({ bytes: bytes.length, sha256: sha(bytes) }, pin);
  assert.equal(receiptBytes.length, 4239); assert.equal(sha(receiptBytes), 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233');
  assert.ok(linkedPipeline.toString().includes("from '" + collectorUri + "'")); assert.match(source, /import\(collectorUri\)/);
});
test('only passive hooks and their read-only appendix change the private alias collector', () => {
  let restored = instrumented.toString(); assert.ok(restored.endsWith(appendix)); restored = restored.slice(0, -appendix.length);
  for (const [needle, replacement] of [...patches].reverse()) { assert.equal(restored.split(replacement).length, 2); restored = restored.replace(replacement, needle); }
  assert.deepEqual(Buffer.from(restored), alias);
  assert.doesNotMatch(appendix, /\.message|node:|\.on\(|\.resume\(|\.pause\(|normalize\(|resolve\(/);
  assert.equal((appendix.match(/state\.entries\.get\(/g) ?? []).length, 1);
});
for (let i = 0; i < patches.length; i++) for (const kind of ['missing', 'duplicate']) test('checked transform rejects ' + kind + ' needle ' + (i + 1), () => {
  const needle = patches[i][0], bytes = kind === 'missing' ? Buffer.from(alias.toString().replace(needle, '')) : Buffer.concat([alias, Buffer.from(needle)]);
  assert.throws(() => instrumentSdkReferenceCollectorSource(bytes), { code: 'E_SOURCE_PIN' });
});
test('source input hash/proxy/shared protections and native getter snapshots stay strict', () => {
  const changed = Buffer.from(alias); changed[100] ^= 1;
  const shared = new SharedArrayBuffer(alias.length); new Uint8Array(shared).set(alias);
  for (const value of [changed, instrumented, Buffer.from(shared), new Proxy(alias, { get() { assert.fail('source proxy'); } })]) assert.throws(() => instrumentSdkReferenceCollectorSource(value), { code: 'E_SOURCE_PIN' });
  const shadow = Buffer.from(alias); for (const key of ['length', 'buffer', 'byteOffset', 'toString']) Object.defineProperty(shadow, key, { get() { assert.fail(key); } });
  assert.deepEqual(instrumentSdkReferenceCollectorSource(shadow), instrumented);
});
test('older operators, collectors and tests retain every current frozen hash', () => {
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
    ['gnu-sdk-manifest-diagnostics-operation', '9bc50dc9e1115170bda3d483d727b1ad488ab167513dedbf2a3e1d0767acb2ab'],
    ['gnu-sdk-manifest-diagnostics-operation.test', '0224b5ecd1f6c35e73bbb3891f56dfde132140a69140fc2b79fc6c6935a6e9f0'],
    ['gnu-sdk-driver-controls-v2-operation', 'c87985fb61eeba3e6188a5dc5fa8f3fbe6c3db856c9ab4e745debad39be728e1'],
    ['gnu-sdk-driver-controls-v2-operation.test', '610de8f2d116a9e717f1d157808e434365b4f8db7d6caea4780b85dd0c998e9e'],
  ]) assert.equal(sha(read(name)), digest);
});
test('all old archive identity, core/stage gates, quotas and deadline reserves remain byte-identical', async () => {
  const previous = read('gnu-sdk-driver-controls-v2-operation').toString();
  for (const pattern of [/const identity = \{[\s\S]*?\n\};/u, /const gate = \(\) => \{[\s\S]*?\n    \};/u, /async function runPass\(number\) \{[\s\S]*?\n    \}/u]) assert.equal(source.match(pattern)?.[0], previous.match(pattern)?.[0]);
  assert.match(source, /function guard\(limit = 250000\)/); assert.match(source, /guard\(10000\)/); assert.match(source, /started \+ 250000 - guard\(\) < 120000/);
  assert.match(source, /Buffer.byteLength\(text\) > 2097152/); assert.match(source, /inspectElf64Requirements\(driver.bytes\)/);
  const base = await import(collectorUri); assert.deepEqual(base.SDK_DRIVER_LIMITS, aliasModule.SDK_DRIVER_LIMITS); assert.equal(base.SDK_DRIVER_DECODED_SHA256, aliasModule.SDK_DRIVER_DECODED_SHA256);
  assert.deepEqual(Object.keys(base).filter(key => !Object.hasOwn(aliasModule, key)), ['readReferenceFailureDiagnostic']);
});
for (const type of ['file', 'directory', 'hardlink', 'symlink']) test('exact rejected metadata match is typed ' + type + ' without resolving or accepting it', async () => {
  const ns = await testModule(), row = entry(1, root + '/bin/missing', type, type === 'file' ? { size: 12 } : {}), { api, state } = acceptedState(ns, [row]);
  api.recordRejectedReference(state, 'bin/missing'); const value = api.referenceFailureSnapshot(state, true);
  assert.equal(value.reason, 'REFERENCE_NOT_REGULAR'); assert.deepEqual(value.matchedEntry, row); assert.equal(value.canonicalRelativePath, 'bin/missing');
  assert.equal(Object.hasOwn(value, 'pathLineOrdinal'), false); assert.ok(Object.isFrozen(value.matchedEntry)); assert.deepEqual(value.ancestorLinks, []);
});
test('ABSENT requires the complete accepted metadata map rather than a partial known-path cache', async () => {
  const ns = await testModule(), api = ns.testReferenceInternals, state = api.newReferenceDiagnostics(2);
  api.retainReferenceEvents(state, [entry(1, root + '/known', 'symlink')]); api.acceptReferenceMetadata(state, 2); api.checkReferenceManifest(state, Buffer.from('./bin/missing\n'));
  api.recordRejectedReference(state, 'bin/missing'); assert.equal(api.referenceFailureSnapshot(state, true), null); assert.equal(state.metadataAccepted, false);
  const full = acceptedState(ns, [entry(1, root + '/known', 'symlink')]); full.api.recordRejectedReference(full.state, 'bin/missing');
  assert.equal(full.api.referenceFailureSnapshot(full.state, true).matchedEntry, 'ABSENT');
});
test('ancestor links use proper component prefixes and never perform any target lookup or chain traversal', async () => {
  const ns = await testModule(), rows = [entry(1, root + '/a', 'symlink'), entry(2, root + '/ab', 'symlink'), entry(3, root + '/ab/c', 'hardlink', { linkpath: '../../unopened', linkKind: 'parent-components' })];
  const { api, state } = acceptedState(ns, rows), originalGet = state.entries.get, gets = [];
  state.entries.get = function(key) { gets.push(key); return originalGet.call(this, key); };
  api.recordRejectedReference(state, 'ab/c/leaf'); const value = api.referenceFailureSnapshot(state, true);
  assert.deepEqual(gets, [root + '/ab/c/leaf']); assert.equal(value.matchedEntry, 'ABSENT');
  assert.deepEqual(value.ancestorLinks.map(value => value.path), [root + '/ab', root + '/ab/c']);
  assert.equal(value.ancestorLinks[1].linkpath, '../../unopened'); assert.ok(Object.isFrozen(value.ancestorLinks));
});
test('the exact link itself is not a proper ancestor and the first rejected reference stays latched', async () => {
  const ns = await testModule(), { api, state } = acceptedState(ns, [entry(1, root + '/bin', 'symlink'), entry(2, root + '/bin/missing', 'hardlink')]);
  api.recordRejectedReference(state, 'bin/missing'); const first = api.referenceFailureSnapshot(state, true);
  assert.deepEqual(first.ancestorLinks.map(value => value.path), [root + '/bin']); api.recordRejectedReference(state, 'other');
  assert.equal(api.referenceFailureSnapshot(state, true), first); assert.throws(() => { first.rootedPath = '/changed'; }, TypeError);
});
test('sixteen ancestors are complete metadata but a seventeenth withholds the whole diagnostic rather than truncating', async () => {
  const ns = await testModule();
  for (const count of [16, 17]) {
    const rows = Array.from({ length: count }, (_, i) => entry(i + 1, root + '/' + Array(i + 1).fill('a').join('/'), 'symlink'));
    const { api, state } = acceptedState(ns, rows); api.recordRejectedReference(state, Array(count + 1).fill('a').join('/'));
    const value = api.referenceFailureSnapshot(state, true); if (count === 16) assert.equal(value.ancestorLinks.length, 16); else assert.equal(value, null);
  }
});
test('diagnostic ASCII JSON overflow withholds the whole value without changing rejection behavior', async () => {
  const ns = await testModule(), stem = 'a'.repeat(900);
  const rows = Array.from({ length: 16 }, (_, i) => entry(i + 1, root + '/' + stem + '/a'.repeat(i), 'symlink', { linkpath: 'π'.repeat(512) }));
  const relativePath = stem + '/a'.repeat(18), { api, state } = acceptedState(ns, rows);
  const proposed = { reason: 'REFERENCE_NOT_REGULAR', canonicalRelativePath: relativePath, rootedPath: root + '/' + relativePath, matchedEntry: 'ABSENT', ancestorLinks: rows };
  assert.ok(Buffer.byteLength(JSON.stringify(proposed).replace(/[^\x00-\x7f]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'))) > 65536);
  assert.equal(state.metadataAccepted, true); api.recordRejectedReference(state, relativePath);
  assert.equal(api.referenceFailureSnapshot(state, true), null); assert.equal(state.failure, null);
});
test('metadata records copy only own data without retaining or evaluating extra getters', async () => {
  const ns = await testModule(), api = ns.testReferenceInternals, state = api.newReferenceDiagnostics(1), original = { index: 1, path: root + '/x', type: 'file', size: 0 };
  Object.defineProperty(original, 'mode', { get() { assert.fail('unselected getter'); } }); api.retainReferenceEvents(state, [original]);
  const stored = state.entries.get(root + '/x'); original.path = 'changed'; assert.equal(stored.path, root + '/x'); assert.ok(Object.isFrozen(stored));
  assert.deepEqual(Object.keys(stored), ['index', 'path', 'type', 'size']);
});
for (const [name, value] of [
  ['getter', Object.defineProperty({ index: 1, type: 'file', size: 0 }, 'path', { get() { assert.fail('path getter'); } })],
  ['proxy', new Proxy({}, { get() { assert.fail('event proxy'); } })],
  ['invalid type', { index: 1, path: 'x', type: 'device', size: 0 }], ['unsafe size', { index: 1, path: 'x', type: 'file', size: Infinity }],
  ['oversized path', { index: 1, path: 'a'.repeat(1025), type: 'file', size: 0 }],
  ['oversized link label', { index: 1, path: 'x', type: 'symlink', size: 0, linkpath: 'a'.repeat(1025), linkKind: 'relative' }],
]) test('invalid ' + name + ' metadata latches incomplete state without throwing or later retaining', async () => {
  const ns = await testModule(), api = ns.testReferenceInternals, state = api.newReferenceDiagnostics(1);
  assert.doesNotThrow(() => api.retainReferenceEvents(state, [value])); assert.equal(state.metadataComplete, false); assert.equal(state.entries.size, 0);
  api.retainReferenceEvents(state, [entry(1, 'safe')]); assert.equal(state.entries.size, 0); api.acceptReferenceMetadata(state, 1); assert.equal(state.metadataAccepted, false);
});
test('entry-count and serialized key-plus-record budget saturation are bounded and never throw', async () => {
  const ns = await testModule(), api = ns.testReferenceInternals, count = api.newReferenceDiagnostics(8412);
  assert.doesNotThrow(() => api.retainReferenceEvents(count, Array(8413).fill(entry(1, 'x')))); assert.equal(count.metadataComplete, false);
  const budget = api.newReferenceDiagnostics(8412);
  for (let i = 0; i < 8412 && budget.metadataComplete; i++) api.retainReferenceEvents(budget, [entry(i + 1, 'p' + i + '/' + 'a'.repeat(1000))]);
  assert.equal(budget.metadataComplete, false); assert.ok(budget.serializedBytes <= 4194304); assert.equal(budget.entries.size, 0);
});
test('manifest byte length and SHA are independently required before a reference snapshot is disclosed', async () => {
  const ns = await testModule(), { api, state } = acceptedState(ns, [entry(1, 'known')]);
  api.checkReferenceManifest(state, Buffer.from('./different\n')); api.recordRejectedReference(state, 'bin/missing');
  assert.equal(state.manifestChecked, false); assert.equal(api.referenceFailureSnapshot(state, true), null);
  const production = await testModule(undefined, { productionManifestPin: true }), expected = acceptedState(production, [entry(1, 'known')]);
  expected.api.recordRejectedReference(expected.state, 'bin/missing'); assert.equal(expected.api.referenceFailureSnapshot(expected.state, true), null);
  assert.ok(instrumented.toString().includes(pinNeedle));
});
test('real tiny TAR metadata includes all first-pass entries exactly once and nothing from the second pass is re-counted', async () => {
  const f = await fixture({ references: [{ path: 'dir', type: '5' }, { path: 'bin/missing', type: '2', target: '../unopened' }] });
  const first = firstPass(f); assert.equal(f.api.readReferenceFailureDiagnostic(), null); assert.equal(first.summary.entries, 5);
  f.api.acceptCapturePass(receipt(captureFinished(f))); assert.throws(() => f.api.getInspectionData(), { code: 'E_REFERENCE' });
  const value = f.api.readReferenceFailureDiagnostic(); assert.equal(value.matchedEntry.type, 'symlink'); assert.equal(value.matchedEntry.index, 5);
  assert.equal(value.matchedEntry.linkpath, '../unopened'); assert.equal(value.ancestorLinks.length, 0);
});
test('feed return arrays and finish results retain original identity and thrown feed errors are untouched', async () => {
  const f = await fixture(), events = Object.freeze([entry(1, 'inert')]), key = '__sdkReferenceIdentity' + ++serial;
  const sentinel = Object.defineProperty({}, 'message', { get() { assert.fail('error message'); } });
  globalThis[key] = { events, summary: f.summary, sentinel, throws: false };
  const fake = uri(`const d = globalThis[${JSON.stringify(key)}]; export function createTarMemberInventory() {
    return Object.freeze({ feed() { if (d.throws) throw d.sentinel; return d.events; }, finish: () => d.summary }); }
    export function createTarInventory() { throw new Error('unused'); }`);
  try {
    const ns = await import(uri(link(instrumented, 'tar-inventory', fake))), api = ns.createSdkDriverControlsFixture(f.profile);
    api.beginMemberPass(); const parser = api.createTarInventory(); assert.equal(parser.feed(f.bytes), events); assert.equal(parser.finish(), f.summary);
    const other = ns.createSdkDriverControlsFixture(f.profile); other.beginMemberPass(); const failed = other.createTarInventory(); globalThis[key].throws = true;
    sameThrow(() => failed.feed(f.bytes), sentinel);
  } finally { delete globalThis[key]; }
});
test('the original E_REFERENCE exception is rethrown by identity after diagnostic recording and RAM cleanup', async () => {
  const key = '__sdkReferenceFailure' + ++serial, sentinel = Object.defineProperty({}, 'message', { get() { assert.fail('message getter'); } }); globalThis[key] = sentinel;
  try {
    const f = await fixture({ replace: text => text.replace("const fail = code => { throw new SdkDriverControlsError(code); };", "const fail = code => { if (code === 'E_REFERENCE') throw globalThis[" + JSON.stringify(key) + "]; throw new SdkDriverControlsError(code); };") });
    firstPass(f); f.api.acceptCapturePass(receipt(captureFinished(f))); sameThrow(() => f.api.getInspectionData(), sentinel);
    assert.equal(f.api.readReferenceFailureDiagnostic().reason, 'REFERENCE_NOT_REGULAR'); assert.equal(f.api.snapshot().phase, 'failed');
  } finally { delete globalThis[key]; }
});
test('a partial first map with a known entry cannot publish false ABSENT after both otherwise valid core passes', async () => {
  const f = await fixture({ replace: text => text.replace('if (members) retainReferenceEvents(referenceDiagnostics, events);', 'if (members) retainReferenceEvents(referenceDiagnostics, events.slice(0, 2));') });
  firstPass(f); f.api.acceptCapturePass(receipt(captureFinished(f))); assert.throws(() => f.api.getInspectionData(), { code: 'E_REFERENCE' });
  assert.equal(f.api.snapshot().hasAcceptedSecondPass, true); assert.equal(f.api.readReferenceFailureDiagnostic(), null);
});
test('separate fixture instances never share accepted maps or diagnostics through the module cache', async () => {
  const f = await fixture(); firstPass(f); f.api.acceptCapturePass(receipt(captureFinished(f))); assert.throws(() => f.api.getInspectionData(), { code: 'E_REFERENCE' });
  assert.ok(f.api.readReferenceFailureDiagnostic()); const other = f.ns.createSdkDriverControlsFixture(f.profile);
  assert.equal(other.readReferenceFailureDiagnostic(), null); assert.equal(f.ns.readReferenceFailureDiagnostic(), null);
});
test('post-failure operation keeps E_REFERENCE and releases only one bounded archive-data diagnostic after all gates', async () => {
  const h = await mockOperation(), { exitCode, receipt: result, text } = await h.run(); assert.equal(exitCode, 1); assert.equal(result.error, 'E_REFERENCE'); assert.equal(result.status, 'STOP');
  assert.equal(result.counts.completedCorePasses, 2); assert.equal(result.inspection.hasAcceptedSecondPass, true); assert.equal(result.referenceDiagnostic.matchedEntry, 'ABSENT');
  assert.equal(result.referenceDiagnostic.canonicalRelativePath, 'bin/missing'); assert.equal(Object.hasOwn(result, 'result'), false); assert.equal(h.log.elfCalls, 0);
  assert.match(result.diagnosticDisclosureScope, /no target lookup, link resolution or path permission/); assert.doesNotMatch(text, /"fileSpans"|"declarations"|"prefix"/);
  assert.equal(result.counts.archivePasses, 4); assert.equal(result.counts.archiveDataBytes, 40); assert.equal(result.counts.archiveRequestedBytes, 44); assert.equal(result.counts.archiveCloseAttempts, 4);
  assert.equal(result.counts.stageChecks, 4); assert.equal(h.log.preloads, 4); assert.ok(h.log.stages.every(value => value === h.log.stages[0]));
  assert.deepEqual(h.h.log.closes, [[1, 42], [1, 41], [2, 42], [2, 41]]); assert.deepEqual(h.h.log.listenerCounts, [0, 1, 0, 1]);
  for (const name of ['nativeQualified', 'installedUsability', 'pythonFreeSubsetVerified', 'rustReady', 'trainingReady', 'archiveExtracted', 'filesInstalled', 'pythonRuntimeInvoked', 'hardRssBounded', 'hardDeadlineGuaranteed', 'processTreeBounded']) assert.equal(result[name], false);
});
test('production manifest pin mismatch still returns the original reference error but withholds every diagnostic field', async () => {
  const h = await mockOperation({ fixture: { productionManifestPin: true } }), { receipt: result } = await h.run();
  assert.equal(result.error, 'E_REFERENCE'); assert.equal(result.counts.completedCorePasses, 2); assert.equal(result.inspection.hasAcceptedSecondPass, true);
  assert.equal(result.referenceDiagnostic, null); assert.equal(Object.hasOwn(result, 'result'), false);
});
test('two completed counters without the collector-owned second acceptance cannot release even a fresh mock diagnostic', async () => {
  const h = await mockOperation({ skipOwnAcceptance: true }), { receipt: result } = await h.run();
  assert.equal(result.error, 'E_REFERENCE'); assert.equal(result.counts.completedCorePasses, 2); assert.equal(result.inspection.hasAcceptedSecondPass, false); assert.equal(result.referenceDiagnostic, null);
});
test('an earlier cached diagnostic is never reused for current disclosure', async () => {
  const h = await mockOperation({ cachedDiagnostic: true }), { receipt: result } = await h.run();
  assert.equal(result.error, 'E_REFERENCE'); assert.equal(result.inspection.hasAcceptedSecondPass, true); assert.equal(result.referenceDiagnostic, null);
});
for (const options of [{ fixture: { expectedDigest: '0'.repeat(64) } }, { closeFailure: 2 }, { spawnFailure: 1 }, { insufficientBudget: true }, { preflightExpired: true },
  { expireAfterSecond: true }, { thirdSpawn: true }, { productionGuards: true }, { corrupt: 'sdk-driver-controls' }, { corrupt: 'gnu-sdk-driver-controls-v2-operation' },
  { stageFailure: true }, { receiptFailure: true }, { changedSecond: bytes => { const copy = Buffer.from(bytes); copy[572] ^= 1; return copy; } }]) {
  test('failed or incomplete core/source gates disclose no reference metadata: ' + Object.keys(options)[0], async () => {
    const h = await mockOperation(options), { receipt: result } = await h.run(); assert.equal(result.status, 'STOP'); assert.equal(result.referenceDiagnostic, null);
    assert.equal(Object.hasOwn(result, 'result'), false); assert.ok(h.h.log.spawns.length <= 2); assert.equal(h.log.elfCalls, 0);
  });
}
test('the ordinary success path remains possible without diagnostic rescue, altered grammar or additional permissions', async () => {
  const h = await mockOperation({ pinnedManifestRef: true, fixture: { relocs: Buffer.from('./bin/data\n'), references: [{ path: 'bin/data', body: Buffer.from('not-captured') }] } });
  const { exitCode, receipt: result } = await h.run(); assert.equal(exitCode, 0); assert.equal(result.referenceDiagnostic, null); assert.deepEqual(result.result.relocs.paths, ['bin/data']);
  assert.equal(h.log.elfCalls, 1); assert.equal(result.realArchiveInspected, false);
});
test('both new files use only the parent-owned reference diagnostic SPEC without an unpublished index dependency', () => {
  const pointer = '// SPEC: _spec/tooling/native-ingress/gnu-sdk-reference-diagnostics.puml\n';
  for (const name of ['gnu-sdk-reference-diagnostics-operation', 'gnu-sdk-reference-diagnostics-operation.test']) assert.ok(read(name).toString().startsWith(pointer));
  const spec = '_spec/tooling/native-ingress/gnu-sdk-reference-diagnostics.puml';
  const files = ['tooling/native-ingress/gnu-sdk-reference-diagnostics-operation.mjs', 'tooling/native-ingress/gnu-sdk-reference-diagnostics-operation.test.mjs'];
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(x => x.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) assert.ok(diagram.includes("' covers: " + file + '\n'));
});
