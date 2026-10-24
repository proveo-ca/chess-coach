// SPEC: _spec/tooling/native-ingress/gnu-sdk-manifest-membership.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { MANIFEST_MEMBERSHIP_SOURCE_PINS, transformSdkManifestMembershipSource, runRegisteredGnuSdkManifestMembership } from './gnu-sdk-manifest-membership-operation.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const read = name => fs.readFileSync(new URL('./' + name + '.mjs', import.meta.url));
const names = ['tar-inventory', 'elf-metadata', 'xz-staging', 'gnu-sdk-inventory', 'gnu-sdk-inventory-v2-operation', 'gnu-sdk-inventory-v4-operation', 'sdk-driver-controls', 'gnu-sdk-driver-controls-v2-operation'];
const captured = new Map(names.map(name => [name, read(name)])), source = read('gnu-sdk-manifest-membership-operation').toString();
const patches = JSON.parse(source.match(/const membershipPatches = (\[[\s\S]*?\n\])\.map/)[1]);
const appendixRaw = source.match(/const membershipAppendix = `([\s\S]*?)`;/)[1];
const appendix = JSON.parse('"' + appendixRaw.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"');
const link = (bytes, name, dependencyUri) => Buffer.from(bytes.toString().replace("from './" + name + ".mjs'", "from '" + dependencyUri + "'"));
const [v2, v4, driverV2] = await Promise.all([import(uri(captured.get('gnu-sdk-inventory-v2-operation'))), import(uri(captured.get('gnu-sdk-inventory-v4-operation'))), import(uri(captured.get('gnu-sdk-driver-controls-v2-operation')))]);
const alias = driverV2.transformSdkDriverAliasSource(captured.get('sdk-driver-controls')), membershipRaw = transformSdkManifestMembershipSource(alias);
const tarSource = v4.transformTarInventoryV4Source(captured.get('tar-inventory')), tar = await import(uri(tarSource)), elf = await import(uri(captured.get('elf-metadata')));
const core = driverV2.transformSdkDriverV2CoreSource(v2.transformSdkInventoryV2Source(captured.get('gnu-sdk-inventory')));
const linkedCollector = link(membershipRaw, 'tar-inventory', uri(tarSource)), collectorUri = uri(linkedCollector), linkedPipeline = link(core, 'tar-inventory', collectorUri);
const aliasModule = await import(uri(link(alias, 'tar-inventory', uri(tarSource))));
const receiptBytes = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/xz-qualification.receipt.json', import.meta.url));
const root = 'x86-64--glibc--stable-2026.08-1';
const manifestPinLine = "const membershipManifestPin = Object.freeze({ byteLength: 9367, sha256: '60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e' });";
const testExports = '\nexport const testMembership = Object.freeze({ newMembershipMetadata, retainMembershipEvents, acceptMembershipMetadata, classifyManifestMembership, requireMembershipManifest, membershipEncodedSizes, releaseMembershipMetadata });\n';
let serial = 0;
async function testModule(bytes = Buffer.from('./bin/missing\n'), options = {}) {
  let text = linkedCollector.toString();
  if (!options.productionManifestPin) { assert.equal(text.split(manifestPinLine).length, 2); text = text.replace(manifestPinLine, 'const membershipManifestPin = Object.freeze({ byteLength: ' + bytes.length + ", sha256: '" + sha(bytes) + "' });"); }
  if (options.replace) text = options.replace(text);
  return import(uri(text + testExports) + '#fixture-' + ++serial);
}
const record = (index, path, type = 'file', extra = {}) => Object.freeze({ index, path, type, size: 0,
  ...(type === 'symlink' || type === 'hardlink' ? { linkpath: '../../UNINTERPRETED', linkKind: 'parent-components' } : {}), ...extra });
function acceptedMap(ns, records, options = {}) {
  const api = ns.testMembership, state = api.newMembershipMetadata(records.length, options.maxBytes ?? 4194304);
  api.retainMembershipEvents(state, records);
  const spans = new Map(records.filter(entry => entry.type === 'file').map(entry => [entry.path, Object.freeze({ index: entry.index, path: entry.path, bodyOffset: 512 + entry.index * 512, size: entry.size })]));
  if (options.changeSpans) options.changeSpans(spans);
  api.acceptMembershipMetadata(state, spans, { entries: records.length, expandedBytes: 505333760 }); return { api, state, spans };
}
function header(path, size = 0, type = '0', target = '') {
  const bytes = Buffer.alloc(512); bytes.write(path, 0, 100);
  for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, size], [136, 12, 0]]) bytes.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  bytes[156] = type.charCodeAt(0); bytes.write(target, 157, 100); bytes.write('ustar\0', 257, 6); bytes.write('00', 263, 2); bytes.fill(32, 148, 156);
  const sum = bytes.reduce((total, byte) => total + byte, 0); bytes.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii'); return bytes;
}
const member = (path, bytes = Buffer.alloc(0), type = '0', target = '') => Buffer.concat([header(path, bytes.length, type, target), bytes, Buffer.alloc((512 - bytes.length % 512) % 512)]);
function elfFixture() { const bytes = Buffer.alloc(64); bytes.set([0x7f, 69, 76, 70, 2, 1, 1]); bytes.writeUInt16LE(2, 16); bytes.writeUInt16LE(62, 18); bytes.writeUInt32LE(1, 20); bytes.writeBigUInt64LE(64n, 32); bytes.writeUInt16LE(64, 52); bytes.writeUInt16LE(56, 54); return bytes; }
async function fixture(options = {}, moduleOverride = null) {
  const relocs = options.relocs ?? Buffer.from('./bin/missing\n'), ns = moduleOverride ?? await testModule(relocs, options);
  const driver = elfFixture(), location = Buffer.from('/opt/sdk\n'), references = options.references ?? [];
  const bytes = Buffer.concat([member(ns.SDK_DRIVER_TARGETS[0].path, driver), member(ns.SDK_DRIVER_TARGETS[1].path, location), member(ns.SDK_DRIVER_TARGETS[2].path, relocs),
    ...references.map(value => member(root + '/' + value.path, value.body, value.type, value.target)), Buffer.alloc(1024)]);
  assert.ok(bytes.length < 1048576);
  const parser = tar.createTarMemberInventory(); parser.feed(bytes); const summary = parser.finish();
  const profile = { expectedSummary: Object.fromEntries(Object.keys(ns.SDK_DRIVER_EXPECTATION).map(key => [key, summary[key]])), expectedDecodedSha256: options.expectedDigest ?? sha(bytes),
    targets: [...summary.fileSpans.slice(0, 2).map(({ size, index, bodyOffset }) => ({ size, index, bodyOffset })), { maxSize: 1048576 }], limits: options.limits ?? {} };
  return { ns, driver, location, relocs, bytes, summary, profile, api: ns.createSdkDriverControlsFixture(profile) };
}
const receipt = (inventory, extra = {}) => ({ state: 'GNU_SDK_DATA_INVENTORY', mockOnly: true, inventory, archivePasses: 2, closeAttempts: 2,
  stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true, exitCode: 0, signal: null, extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false, ...extra });
function firstPass(f) { f.api.beginMemberPass(); const p = f.api.createTarInventory(); p.feed(f.bytes); return f.api.acceptMemberPass(receipt(p.finish())); }
function captureFinished(f, bytes = f.bytes) { f.api.beginCapturePass(); const p = f.api.createTarInventory(); p.feed(bytes); return p.finish(); }
function finish(f) { f.api.acceptCapturePass(receipt(captureFinished(f))); return f.api.getInspectionData(); }
function sameThrow(fn, expected) { let threw = false; try { fn(); } catch (error) { threw = true; assert.equal(error, expected); } assert.equal(threw, true); }
async function fixtureGraph(f, options, log) {
  const key = '__sdkMembershipFixture' + ++serial; globalThis[key] = { a: f.api, options, log };
  const adapterUri = uri(`const d = globalThis[${JSON.stringify(key)}], a = d.a;
    export const beginMemberPass = () => a.beginMemberPass(); export const createTarInventory = x => a.createTarInventory(x);
    export const acceptMemberPass = x => a.acceptMemberPass(x); export const beginCapturePass = () => a.beginCapturePass();
    export const acceptCapturePass = x => a.acceptCapturePass(x); export const snapshotDriverInspection = () => a.snapshot();
    export const abortDriverInspection = () => a.abortInspection(); export function getInspectionData() {
      d.log.getCalls++; const result = a.getInspectionData(); d.log.driverSnapshot = result.driver.bytes; d.log.order.push('membership-complete');
      const relocs = { ...result.relocs };
      if (d.options.pinnedManifestRef) { relocs.byteLength = 9367; relocs.sha256 = '60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e'; }
      if (d.options.escapedOutputOverflow) relocs.testOnlyPadding = 'π'.repeat(400000);
      return { ...result, relocs };
    }`);
  try { const [pipeline, adapter] = await Promise.all([import(uri(link(core, 'tar-inventory', adapterUri))), import(adapterUri)]); return { pipeline, adapter, adapterUri }; }
  finally { delete globalThis[key]; }
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
    child.stdin.end = () => { child.stdin.emit('finish'); child.stdout.emit('data', options.output(pass)); if (log.kills.length) return;
      child.stdout.emit('end'); if (log.kills.length) return; child.stderr.emit('end'); child.stdout.emit('close'); child.stderr.emit('close'); child.emit('exit', 0, null); child.emit('close', 0, null); child.stdin.emit('close'); };
    assert.equal(child.stdout.listenerCount('data'), 0); queueMicrotask(() => options.spawnFailure === pass ? child.emit('error', new Error('mock spawn')) : child.emit('spawn')); return child;
  }
  async function run(deps) { pass++; return graph.pipeline.createSdkInventoryFixtureRunner({ archiveBytes: 10, archiveSha256: sha(input) }, { fs: io, spawn, now: options.now, ...deps })(identity); }
  return { run, spawn, log };
}
async function mockOperation(options = {}) {
  const f = await fixture(options.fixture), log = { reads: [], stages: [], preloads: 0, calls: 0, getCalls: 0, elfCalls: 0, order: [], driverSnapshot: null };
  const graph = await fixtureGraph(f, options, log), clock = { value: 0 }; let nowCalls = 0;
  const h = ioHarness(graph, { ...options, now: () => clock.value, output: pass => pass === 2 && options.changedSecond ? options.changedSecond(f.bytes) : f.bytes });
  const key = '__sdkMembershipOperation' + ++serial;
  const context = {
    now: () => ++nowCalls > 1 && options.preflightExpired ? 10000 : clock.value,
    fs: { readFileSync(path) {
      log.reads.push(path); if (path.endsWith('/xz-qualification.receipt.json')) return options.receiptFailure ? Buffer.from('bad') : receiptBytes;
      const prefix = '/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/', name = path.slice(prefix.length, -4); assert.equal(path, prefix + name + '.mjs');
      assert.ok(captured.has(name)); return options.corrupt === name ? Buffer.from('bad') : captured.get(name);
    } }, spawn: h.spawn,
    verifyStagedXzImages(value) { log.stages.push(value); if (options.stageFailure) throw new Error('mock stage'); return { counters: { fsCalls: 10, readBytes: 100, closeAttempts: 5 } }; },
    assertNoSystemPreload() { log.preloads++; return !options.preloadFailure; },
    async runGnuSdkInventory(identity, deps) { assert.equal(identity.file.size, '102296280'); log.calls++; const result = await h.run(deps);
      if (options.insufficientBudget && log.calls === 1) clock.value = 130001; if (options.expireAfterSecond && log.calls === 2) clock.value = 250000;
      if (options.thirdSpawn && log.calls === 2) deps.spawn('mock-only'); return result; },
    inspectElf64Requirements(bytes) { log.elfCalls++; log.order.push('driver-elf-inspection'); return elf.inspectElf64Requirements(bytes); },
  };
  globalThis[key] = context;
  const dependencyUri = uri(`const d = globalThis[${JSON.stringify(key)}]; export default d.fs;
    export const spawn = d.spawn; export const fixtureNow = d.now; export const verifyStagedXzImages = d.verifyStagedXzImages;
    export const assertNoSystemPreload = d.assertNoSystemPreload; export const runGnuSdkInventory = d.runGnuSdkInventory; export const inspectElf64Requirements = d.inspectElf64Requirements;`);
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
    ["profile: 'registered-gnu-sdk-manifest-membership-v1'", "profile: 'mock-sdk-manifest-membership-fixture'"], ['realArchiveInspected: error === null', 'realArchiveInspected: false'],
  ]) { assert.ok(mocked.includes(from)); mocked = mocked.replace(from, to); }
  try { const operation = await import(uri(mocked)); assert.equal(log.reads.length, 0); return { f, h, log, run: async () => {
    const result = await operation.runRegisteredGnuSdkManifestMembership(); assert.ok(Object.isFrozen(result)); return { ...result, receipt: JSON.parse(result.text) };
  } }; } finally { delete globalThis[key]; }
}

test('cold import exposes a zero-argument DATA_ONLY operation and no CLI, SDK execution, networking or file writes', () => {
  assert.equal(runRegisteredGnuSdkManifestMembership.length, 0); assert.doesNotMatch(source, /await runRegisteredGnuSdkManifestMembership|process\.(?:env|argv)|runRegisteredGnuSdkDriverControlsV2\(/);
  assert.doesNotMatch(source, /\b(?:fetch|writeFileSync|writeSync|mkdirSync|unlink|rmSync|rename|execFileSync)\s*\(/);
});
test('every raw source, private transformation stage and expanded graph binds exact repository bytes', () => {
  const refs = [...source.matchAll(/\['([a-z0-9-]+)', (\d+), '([a-f0-9]{64})'\]/g)]; assert.deepEqual(refs.map(ref => ref[1]), names);
  for (const [, name, size, digest] of refs) { assert.equal(captured.get(name).length, Number(size)); assert.equal(sha(captured.get(name)), digest); }
  let branch = alias.toString(); for (const [needle, replacement] of patches) { assert.equal(branch.split(needle).length, 2); branch = branch.replace(needle, replacement); }
  for (const [bytes, pin] of [[alias, MANIFEST_MEMBERSHIP_SOURCE_PINS.aliasCollector], [Buffer.from(branch), MANIFEST_MEMBERSHIP_SOURCE_PINS.branchCollector], [membershipRaw, MANIFEST_MEMBERSHIP_SOURCE_PINS.membershipCollector],
    [linkedCollector, MANIFEST_MEMBERSHIP_SOURCE_PINS.linkedCollector], [linkedPipeline, MANIFEST_MEMBERSHIP_SOURCE_PINS.linkedPipeline], [core, MANIFEST_MEMBERSHIP_SOURCE_PINS.controlsCore], [tarSource, MANIFEST_MEMBERSHIP_SOURCE_PINS.transformedTar]]) assert.deepEqual({ bytes: bytes.length, sha256: sha(bytes) }, pin);
  assert.equal(receiptBytes.length, 4239); assert.equal(sha(receiptBytes), 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233');
  assert.ok(linkedPipeline.toString().includes("from '" + collectorUri + "'")); assert.match(source, /import\(collectorUri\)/);
});
test('all private changes are explicitly reversible and no grammar or target tuple is changed', () => {
  let restored = membershipRaw.toString(); assert.ok(restored.endsWith(appendix)); restored = restored.slice(0, -appendix.length);
  for (const [needle, replacement] of [...patches].reverse()) { assert.equal(restored.split(replacement).length, 2); restored = restored.replace(replacement, needle); }
  assert.deepEqual(Buffer.from(restored), alias); assert.doesNotMatch(appendix, /\.message|node:|normalize\(|resolve\(|\.on\(|\.resume\(/);
});
for (let i = 0; i < patches.length; i++) for (const kind of ['missing', 'duplicate']) test('fixed transform rejects ' + kind + ' needle ' + (i + 1), () => {
  const needle = patches[i][0], bytes = kind === 'missing' ? Buffer.from(alias.toString().replace(needle, '')) : Buffer.concat([alias, Buffer.from(needle)]);
  assert.throws(() => transformSdkManifestMembershipSource(bytes), { code: 'E_SOURCE_PIN' });
});
test('source snapshots reject wrong hashes, proxies/shared storage and ignore shadowed native properties', () => {
  const wrong = Buffer.from(alias); wrong[100] ^= 1; const shared = new SharedArrayBuffer(alias.length); new Uint8Array(shared).set(alias);
  for (const value of [wrong, membershipRaw, Buffer.from(shared), new Proxy(alias, { get() { assert.fail('source proxy'); } })]) assert.throws(() => transformSdkManifestMembershipSource(value), { code: 'E_SOURCE_PIN' });
  const shadow = Buffer.from(alias); for (const key of ['length', 'buffer', 'byteOffset', 'toString']) Object.defineProperty(shadow, key, { get() { assert.fail(key); } }); assert.deepEqual(transformSdkManifestMembershipSource(shadow), membershipRaw);
});
test('older raw sources, operators and tests retain all frozen hashes', () => {
  for (const [name, digest] of [
    ['gnu-sdk-inventory', 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29'], ['gnu-sdk-inventory.test', '67825a3e8c685c0fddafc554076b9203a9b6e9ac5e1a83cfb4d4459e5e84e9cc'],
    ['gnu-sdk-inventory-operation', '3b9dfbf8c7b045884af420b43c24bff6f90eea04aa8e5b6e967af1b22ec3411f'], ['gnu-sdk-inventory-operation.test', '79a915de890809dc3284cd9e5204b08af6239e120f0f49177d98512d3de51ad4'],
    ['gnu-sdk-inventory-v2-operation', '39da4bc85f6e7eaaecb0abd157d59ec4c2dcb6191a19c9247cbadd0080ae767a'], ['gnu-sdk-inventory-v2-operation.test', '3c4c3ebb98a0880d487c3d638714aeba0423bc3aabef4122d474bf506308a3c2'],
    ['tar-observer', '6211785adf6470eb6af8f437a6815aa194b75063f0f7ad9a90c48ad9e3747ab1'], ['gnu-sdk-inventory-v3-operation', '2714854c2fe0521abcb6b4acf2a80b8a5e46b7026922f2ff849c970167d80ea1'],
    ['gnu-sdk-inventory-v3-operation.test', 'd48ac4a1c6a9ae154452d56d7f95df1303b3db25b4022263c58e9a3f1eba20ac'], ['gnu-sdk-inventory-v4-operation', '2ea3c1bfe71676c37d01a05b64f9d3f11e4a7d7d93541cfdc4707a378bae17db'],
    ['gnu-sdk-inventory-v4-operation.test', '96d9660717568b56dbdf962701d1d296883c495df494b8dbf67a1cd4dd6c6f08'], ['sdk-control-inspection', 'f6736f8f00524782a32784b7a2f3bba350d39633545f521f12924524b8a856fa'],
    ['gnu-sdk-controls-operation', '504b1dbaaca54cc7613092717da4732afb63e68c01ee5554db41309b4dd83ff7'], ['gnu-sdk-controls-operation.test', '44451f319b02d6c2c9c12873a92850dbd185e0065bd9e287b717d9d8688cc6bd'],
    ['sdk-driver-controls', '3e9acafe464aa0a4418d5c9c7522683c2948035b93f95c96a290b8fdb264ec93'], ['gnu-sdk-driver-controls-operation', '77c3e004a68cd7b860354da5e3f83053bfd5352136ce0e7cc6cfd4f008a65a3a'],
    ['gnu-sdk-driver-controls-operation.test', '026e88458806fcdecc72286acc3c593f21c5ecf7544e8b9e37a7006bc5990122'], ['gnu-sdk-manifest-diagnostics-operation', '9bc50dc9e1115170bda3d483d727b1ad488ab167513dedbf2a3e1d0767acb2ab'],
    ['gnu-sdk-manifest-diagnostics-operation.test', '0224b5ecd1f6c35e73bbb3891f56dfde132140a69140fc2b79fc6c6935a6e9f0'], ['gnu-sdk-driver-controls-v2-operation', 'c87985fb61eeba3e6188a5dc5fa8f3fbe6c3db856c9ab4e745debad39be728e1'],
    ['gnu-sdk-driver-controls-v2-operation.test', '610de8f2d116a9e717f1d157808e434365b4f8db7d6caea4780b85dd0c998e9e'], ['gnu-sdk-reference-diagnostics-operation', 'cf8a98ce858c92dce00a597ed078694799384a8006388d69daddfbd792b6ff88'],
    ['gnu-sdk-reference-diagnostics-operation.test', 'ec94c7ec6afad841c81fe2385b22c8ebfce6f37aaecc336055327d470aed9151'],
  ]) assert.equal(sha(read(name)), digest);
});
test('source identity, stage/core validation, decoder caps and global deadline reserves remain unchanged', () => {
  const prior = read('gnu-sdk-driver-controls-v2-operation').toString();
  for (const pattern of [/const identity = \{[\s\S]*?\n\};/u, /const gate = \(\) => \{[\s\S]*?\n    \};/u, /async function runPass\(number\) \{[\s\S]*?\n    \}/u]) assert.equal(source.match(pattern)?.[0], prior.match(pattern)?.[0]);
  assert.match(source, /function guard\(limit = 250000\)/); assert.match(source, /guard\(10000\)/); assert.match(source, /started \+ 250000 - guard\(\) < 120000/); assert.match(source, /Buffer.byteLength\(text\) > 2097152/);
  assert.match(core.toString(), /--memlimit-decompress=16777216/); assert.match(core.toString(), /maxTotalMs: 120_000, cleanupMs: 3000/);
});
for (const [type, status] of [['file', 'REGULAR_FILE'], ['directory', 'NONREGULAR_ENTRY'], ['hardlink', 'NONREGULAR_ENTRY'], ['symlink', 'NONREGULAR_ENTRY']]) {
  test('exact ' + type + ' membership is data-only ' + status, async () => {
    const ns = await testModule(), { api, state } = acceptedMap(ns, [record(1, root + '/a', type)]);
    const result = api.classifyManifestMembership(state, ['a'], true, 1048576), row = result.observations[0];
    assert.equal(row.status, status); assert.equal(row.exactEntry.type, type); assert.equal(row.regularSpan !== null, type === 'file'); assert.equal(result.histogram[status], 1);
    assert.deepEqual(row.ancestorLinks, []); assert.ok(Object.isFrozen(row));
  });
}
test('absent references are represented rather than skipped, invented or accepted as regular files', async () => {
  const ns = await testModule(), { api, state } = acceptedMap(ns, [record(1, root + '/other')]);
  const row = api.classifyManifestMembership(state, ['missing'], true, 1048576).observations[0];
  assert.equal(row.status, 'ABSENT_FROM_ARCHIVE'); assert.equal(row.exactEntry, null); assert.equal(row.regularSpan, null); assert.deepEqual(row.ancestorLinks, []);
});
test('ancestor-link status takes first precedence but retains exact file evidence and its consistent span', async () => {
  const ns = await testModule(), rows = [record(1, root + '/a', 'symlink'), record(2, root + '/a/file', 'file', { size: 3 })], { api, state } = acceptedMap(ns, rows);
  const row = api.classifyManifestMembership(state, ['a/file'], true, 1048576).observations[0];
  assert.equal(row.status, 'ANCESTOR_LINK'); assert.equal(row.exactEntry.type, 'file'); assert.equal(row.regularSpan.size, 3); assert.equal(row.ancestorLinks[0].linkpath, '../../UNINTERPRETED');
});
test('ancestor precedence also retains exact nonregular evidence and does not include a link as its own ancestor', async () => {
  const ns = await testModule(), { api, state } = acceptedMap(ns, [record(1, root + '/a', 'hardlink'), record(2, root + '/a/link', 'symlink')]);
  const row = api.classifyManifestMembership(state, ['a/link'], true, 1048576).observations[0];
  assert.equal(row.status, 'ANCESTOR_LINK'); assert.equal(row.exactEntry.type, 'symlink'); assert.deepEqual(row.ancestorLinks.map(value => value.path), [root + '/a']);
});
test('component prefixes are exact and link targets are never looked up, normalized or followed', async () => {
  const ns = await testModule(), { api, state } = acceptedMap(ns, [record(1, root + '/a', 'symlink'), record(2, root + '/ab', 'hardlink')]);
  const gets = [], original = state.entries.get; state.entries.get = function(key) { gets.push(key); return original.call(this, key); };
  const row = api.classifyManifestMembership(state, ['ab/leaf'], true, 1048576).observations[0];
  assert.deepEqual(gets, [root + '/ab/leaf']); assert.deepEqual(row.ancestorLinks.map(value => value.path), [root + '/ab']); assert.equal(row.status, 'ANCESTOR_LINK');
});
test('all references retain input order and the histogram totals account for every row exactly once', async () => {
  const ns = await testModule(), { api, state } = acceptedMap(ns, [record(1, root + '/file'), record(2, root + '/dir', 'directory'), record(3, root + '/link', 'symlink')]);
  const paths = ['absent', 'file', 'link/child', 'dir'], result = api.classifyManifestMembership(state, paths, true, 1048576);
  assert.deepEqual(result.observations.map(value => value.relativePath), paths); assert.equal(result.totalReferences, 4); assert.equal(Object.values(result.histogram).reduce((a, b) => a + b, 0), 4);
  assert.deepEqual(result.observations.map(value => value.status), ['ABSENT_FROM_ARCHIVE', 'REGULAR_FILE', 'ANCESTOR_LINK', 'NONREGULAR_ENTRY']); assert.ok(Object.isFrozen(result.observations));
});
test('sixteen ancestor links are retained completely and seventeen stop the entire observation', async () => {
  const ns = await testModule(); for (const count of [16, 17]) {
    const rows = Array.from({ length: count }, (_, i) => record(i + 1, root + '/' + Array(i + 1).fill('a').join('/'), 'symlink')), { api, state } = acceptedMap(ns, rows);
    if (count === 16) assert.equal(api.classifyManifestMembership(state, [Array(18).fill('a').join('/')], true, 1048576).observations[0].ancestorLinks.length, 16);
    else assert.throws(() => api.classifyManifestMembership(state, [Array(19).fill('a').join('/')], true, 1048576), { code: 'E_OUTPUT' });
  }
});
test('complete-map count and collector second acceptance are mandatory before any classification', async () => {
  const ns = await testModule(), api = ns.testMembership, state = api.newMembershipMetadata(2, 4194304); api.retainMembershipEvents(state, [record(1, root + '/known')]);
  assert.throws(() => api.acceptMembershipMetadata(state, new Map(), { entries: 2, expandedBytes: 10000 }), { code: 'E_SPAN' });
  assert.throws(() => api.classifyManifestMembership(state, ['unknown'], true, 1048576), { code: 'E_PHASE' });
  const accepted = acceptedMap(ns, [record(1, root + '/known')]); assert.throws(() => accepted.api.classifyManifestMembership(accepted.state, ['unknown'], false, 1048576), { code: 'E_PHASE' });
});
for (const [name, change] of [['missing regular span', spans => spans.clear()], ['different size', spans => { const [key, value] = [...spans][0]; spans.set(key, { ...value, size: 1 }); }],
  ['different index', spans => { const [key, value] = [...spans][0]; spans.set(key, { ...value, index: 2 }); }], ['outside body range', spans => { const [key, value] = [...spans][0]; spans.set(key, { ...value, bodyOffset: 505333761 }); }],
  ['unknown extra span', spans => spans.set('other', { index: 2, path: 'other', bodyOffset: 512, size: 0 })]]) {
  test('every regular record must match its span: ' + name, async () => {
    const ns = await testModule(); assert.throws(() => acceptedMap(ns, [record(1, root + '/file')], { changeSpans: change }), { code: 'E_SPAN' });
  });
}
test('nonregular entries cannot have regular spans and accepted spans are private own-data copies', async () => {
  const ns = await testModule(); assert.throws(() => acceptedMap(ns, [record(1, root + '/dir', 'directory')], { changeSpans: spans => spans.set(root + '/dir', { index: 1, path: root + '/dir', bodyOffset: 512, size: 0 }) }), { code: 'E_SPAN' });
  let external; const { state } = acceptedMap(ns, [record(1, root + '/file')], { changeSpans: spans => { external = { ...spans.get(root + '/file') }; spans.set(root + '/file', external); } });
  external.bodyOffset = 9; assert.notEqual(state.spans.get(root + '/file').bodyOffset, 9); assert.ok(Object.isFrozen(state.spans.get(root + '/file')));
});
for (const [name, value] of [['getter', Object.defineProperty({ index: 1, type: 'file', size: 0 }, 'path', { get() { assert.fail('metadata getter'); } })],
  ['proxy', new Proxy({}, { get() { assert.fail('metadata proxy'); } })], ['unknown type', { index: 1, path: 'x', type: 'device', size: 0 }],
  ['oversized name', { index: 1, path: 'a'.repeat(1025), type: 'file', size: 0 }]]) {
  test('invalid ' + name + ' metadata is passively latched then stops observation instead of yielding false absence', async () => {
    const ns = await testModule(), api = ns.testMembership, state = api.newMembershipMetadata(1, 4194304);
    assert.doesNotThrow(() => api.retainMembershipEvents(state, [value])); assert.equal(state.complete, false); assert.throws(() => api.acceptMembershipMetadata(state, new Map(), { entries: 1 }), { code: 'E_INPUT' });
  });
}
test('entry and key-plus-record budget saturation stop observation without changing feed processing', async () => {
  const ns = await testModule(), api = ns.testMembership, count = api.newMembershipMetadata(8412, 4194304);
  api.retainMembershipEvents(count, Array(8413).fill(record(1, 'x'))); assert.equal(count.complete, false);
  const bytes = api.newMembershipMetadata(8412, 4194304); for (let i = 0; i < 8412 && bytes.complete; i++) api.retainMembershipEvents(bytes, [record(i + 1, 'p' + i + '/' + 'a'.repeat(1000))]);
  assert.equal(bytes.complete, false); assert.equal(bytes.failureCode, 'E_OUTPUT'); assert.ok(bytes.serializedBytes <= 4194304); assert.throws(() => api.acceptMembershipMetadata(bytes, new Map(), { entries: 8412 }), { code: 'E_OUTPUT' });
});
test('full classification metadata respects exact UTF8 and escaped JSON budgets without partial returns', async () => {
  const ns = await testModule(), { api, state } = acceptedMap(ns, [record(1, root + '/link', 'symlink', { linkpath: 'π'.repeat(100) })]);
  const paths = ['absent', 'link', 'link/child'], full = api.classifyManifestMembership(state, paths, true, 1048576), sizes = api.membershipEncodedSizes(full);
  assert.ok(sizes.ascii > sizes.utf8); assert.deepEqual(api.classifyManifestMembership(state, paths, true, sizes.ascii), full);
  assert.throws(() => api.classifyManifestMembership(state, paths, true, sizes.ascii - 1), { code: 'E_OUTPUT' });
  const long = 'a'.repeat(900), many = Array.from({ length: 600 }, (_, i) => long + i); assert.throws(() => api.classifyManifestMembership(state, many, true, 1048576), { code: 'E_OUTPUT' });
});
test('strict v2 still rejects a missing regular file while membership observes absence without relocation readiness', async () => {
  const old = await fixture({}, aliasModule); firstPass(old); old.api.acceptCapturePass(receipt(captureFinished(old))); assert.throws(() => old.api.getInspectionData(), { code: 'E_REFERENCE' });
  const current = await fixture(); firstPass(current); const data = finish(current); assert.equal(data.relocs.observations[0].status, 'ABSENT_FROM_ARCHIVE');
  assert.equal(data.relocs.interpretation, 'MANIFEST_MEMBERSHIP_DATA_NOT_RELOCATION_AUTHORITY'); assert.equal(data.relocs.relocationReady, false); assert.equal(data.relocs.totalReferences, 1);
});
test('all canonical references are observed in order including Python/GDB metadata without extra payload capture', async () => {
  const f = await fixture({ relocs: Buffer.from('./share/gdb/python/a.py\n./dir\n./missing\n'), references: [{ path: 'share/gdb/python/a.py', body: Buffer.from('not-captured') }, { path: 'dir', type: '5' }] });
  firstPass(f); const data = finish(f); assert.deepEqual(data.relocs.observations.map(value => value.status), ['REGULAR_FILE', 'NONREGULAR_ENTRY', 'ABSENT_FROM_ARCHIVE']);
  assert.deepEqual(data.relocs.paths, ['share/gdb/python/a.py', 'dir', 'missing']); assert.equal(f.api.snapshot().copiedBytes, f.driver.length + f.location.length + f.relocs.length);
  assert.equal(data.driver.sha256, sha(f.driver)); assert.equal(data.relocs.sha256, sha(f.relocs));
});
test('manifest pin is checked before interpretation and the independent whole-output SHA remains mandatory twice', async () => {
  const bad = await fixture({ productionManifestPin: true, relocs: Buffer.from('././invalid\n') }); firstPass(bad); bad.api.acceptCapturePass(receipt(captureFinished(bad)));
  assert.throws(() => bad.api.getInspectionData(), { code: 'E_HASH' });
  const first = await fixture({ expectedDigest: '0'.repeat(64) }); assert.throws(() => firstPass(first), { code: 'E_HASH' });
  const second = await fixture(); firstPass(second); const changed = Buffer.from(second.bytes); changed[572] ^= 1; assert.throws(() => captureFinished(second, changed), { code: 'E_HASH' });
  assert.throws(() => second.api.getInspectionData(), { code: 'E_PHASE' }); assert.ok(membershipRaw.toString().includes(manifestPinLine));
});
for (const relocs of ['a\n./a\n', '././a\n', '../a\n', '/absolute\n', 'a b\n', 'a\r\n', '\n', '${ROOT}/a\n']) {
  test('membership does not relax canonical grammar: ' + JSON.stringify(relocs), async () => {
    const f = await fixture({ relocs: Buffer.from(relocs) }); firstPass(f); f.api.acceptCapturePass(receipt(captureFinished(f))); assert.throws(() => f.api.getInspectionData(), { code: 'E_MANIFEST' });
  });
}
test('passive observation preserves original feed-array and finish-result identity and original thrown errors', async () => {
  const f = await fixture(), events = Object.freeze([record(1, 'inert')]), key = '__membershipIdentity' + ++serial;
  const sentinel = Object.defineProperty({}, 'message', { get() { assert.fail('error message'); } }); globalThis[key] = { events, summary: f.summary, sentinel, throws: false };
  const fakeTar = uri(`const d = globalThis[${JSON.stringify(key)}]; export function createTarMemberInventory() { return Object.freeze({ feed() { if (d.throws) throw d.sentinel; return d.events; }, finish: () => d.summary }); } export function createTarInventory() { throw new Error('unused'); }`);
  try {
    const ns = await import(uri(link(membershipRaw, 'tar-inventory', fakeTar))), api = ns.createSdkDriverControlsFixture(f.profile); api.beginMemberPass(); const p = api.createTarInventory();
    assert.equal(p.feed(f.bytes), events); assert.equal(p.finish(), f.summary);
    const failed = ns.createSdkDriverControlsFixture(f.profile); failed.beginMemberPass(); const other = failed.createTarInventory(); globalThis[key].throws = true; sameThrow(() => other.feed(f.bytes), sentinel);
  } finally { delete globalThis[key]; }
});
test('first-pass metadata omissions stop before capture instead of reporting absence', async () => {
  const f = await fixture({ replace: text => text.replace('if (members) retainMembershipEvents(membershipState, events);', 'if (members) retainMembershipEvents(membershipState, events.slice(0, 2));') });
  assert.throws(() => firstPass(f), { code: 'E_SPAN' }); assert.throws(() => f.api.beginCapturePass(), { code: 'E_PHASE' });
});
test('all regular event/span mismatches, not just the three approved targets, stop after first core success', async () => {
  const f = await fixture({ references: [{ path: 'bin/data', body: Buffer.from('abc') }] }), key = '__membershipSpans' + ++serial;
  const altered = { ...f.summary, fileSpans: f.summary.fileSpans.map(value => value.path === root + '/bin/data' ? { ...value, size: 2 } : value) }; globalThis[key] = { altered, events: [] };
  const originalParser = tar.createTarInventory(); globalThis[key].events = originalParser.feed(f.bytes);
  const fakeTar = uri(`const d = globalThis[${JSON.stringify(key)}]; export function createTarMemberInventory() { return { feed: () => d.events, finish: () => d.altered }; } export function createTarInventory() { throw new Error('unused'); }`);
  try {
    const ns = await import(uri(link(membershipRaw, 'tar-inventory', fakeTar))), api = ns.createSdkDriverControlsFixture(f.profile); api.beginMemberPass(); const p = api.createTarInventory(); p.feed(f.bytes);
    assert.throws(() => api.acceptMemberPass(receipt(p.finish())), { code: 'E_SPAN' }); assert.throws(() => api.beginCapturePass(), { code: 'E_PHASE' });
  } finally { delete globalThis[key]; }
});
test('mocked operation publishes DATA observations for every reference without any relocation permission', async () => {
  const h = await mockOperation({ pinnedManifestRef: true }), { exitCode, receipt: result } = await h.run(); assert.equal(exitCode, 0);
  assert.equal(result.status, 'MANIFEST_MEMBERSHIP_OBSERVED'); assert.equal(result.result.state, 'MANIFEST_MEMBERSHIP_OBSERVED'); assert.equal(result.interpretation, 'MANIFEST_MEMBERSHIP_DATA_NOT_RELOCATION_AUTHORITY');
  assert.equal(result.result.manifestRefs.observations[0].status, 'ABSENT_FROM_ARCHIVE'); assert.equal(result.result.manifestRefs.totalReferences, 1); assert.equal(result.result.manifestRefs.histogram.ABSENT_FROM_ARCHIVE, 1);
  assert.equal(result.result.locationPrefixData, '/opt/sdk'); assert.equal(result.result.manifestByteRef.byteLength, 9367); assert.equal(result.result.manifestByteRef.sha256, driverV2.SDK_DRIVER_V2_MANIFEST_PIN.sha256);
  assert.deepEqual(h.log.order, ['membership-complete', 'driver-elf-inspection']); assert.equal(h.log.elfCalls, 1); assert.equal(result.realArchiveInspected, false);
  assert.equal(result.counts.archivePasses, 4); assert.equal(result.counts.archiveDataBytes, 40); assert.equal(result.counts.archiveRequestedBytes, 44); assert.equal(result.counts.archiveCloseAttempts, 4);
  assert.equal(result.counts.stageChecks, 4); assert.equal(h.log.preloads, 4); assert.deepEqual(h.h.log.listenerCounts, [0, 1, 0, 1]); assert.deepEqual(h.h.log.closes, [[1, 42], [1, 41], [2, 42], [2, 41]]);
  for (const key of ['relocationReady', 'installedUsability', 'nativeQualified', 'pythonFreeSubsetVerified', 'rustReady', 'trainingReady', 'archiveExtracted', 'filesInstalled', 'pythonRuntimeInvoked', 'hardRssBounded', 'hardDeadlineGuaranteed', 'processTreeBounded']) assert.equal(result[key], false);
  assert.ok(h.log.driverSnapshot.every(byte => byte === 0));
});
test('post-collector raw pin failure occurs before ELF or publication even with valid synthetic membership', async () => {
  const h = await mockOperation(), { receipt: result } = await h.run(); assert.equal(result.error, 'E_HASH'); assert.equal(h.log.elfCalls, 0); assert.equal(h.log.getCalls, 1); assert.equal(Object.hasOwn(result, 'result'), false);
});
test('the final two-MiB ASCII cap includes escaping and suppresses all output rather than truncating', async () => {
  const h = await mockOperation({ pinnedManifestRef: true, escapedOutputOverflow: true }), { receipt: result, text } = await h.run();
  assert.equal(result.error, 'E_OUTPUT'); assert.equal(result.status, 'STOP'); assert.equal(h.log.elfCalls, 1); assert.equal(Object.hasOwn(result, 'result'), false); assert.ok(Buffer.byteLength(text) < 2097152);
});
for (const options of [{ fixture: { expectedDigest: '0'.repeat(64) } }, { fixture: { productionManifestPin: true } }, { closeFailure: 2 }, { spawnFailure: 1 }, { insufficientBudget: true },
  { preflightExpired: true }, { expireAfterSecond: true }, { thirdSpawn: true }, { productionGuards: true }, { corrupt: 'sdk-driver-controls' }, { corrupt: 'gnu-sdk-driver-controls-v2-operation' },
  { stageFailure: true }, { receiptFailure: true }, { changedSecond: bytes => { const value = Buffer.from(bytes); value[572] ^= 1; return value; } }]) {
  test('failed source/core/hash/lifecycle gates suppress all membership rows: ' + Object.keys(options)[0], async () => {
    const h = await mockOperation({ ...options, pinnedManifestRef: true }), { receipt: result } = await h.run(); assert.equal(result.status, 'STOP'); assert.equal(Object.hasOwn(result, 'result'), false); assert.ok(h.h.log.spawns.length <= 2); assert.equal(h.log.elfCalls, 0);
    if (options.insufficientBudget || options.spawnFailure || options.productionGuards) assert.ok(h.h.log.spawns.length <= 1);
    if (options.thirdSpawn) { assert.equal(result.error, 'E_LIMIT'); assert.equal(result.counts.spawnAttempts, 3); }
  });
}
test('row limits and ancestor limits stop the operation without partial observations after both complete cores', async () => {
  const small = await mockOperation({ pinnedManifestRef: true, fixture: { limits: { maxJoinedBytes: 1 } } }), result = await small.run();
  assert.equal(result.receipt.error, 'E_OUTPUT'); assert.equal(result.receipt.counts.completedCorePasses, 2); assert.equal(Object.hasOwn(result.receipt, 'result'), false); assert.equal(small.log.elfCalls, 0);
});
test('new file SPEC pointers do not depend on unpublished parent diagrams or index changes', () => {
  const pointer = '// SPEC: _spec/tooling/native-ingress/gnu-sdk-manifest-membership.puml\n';
  for (const name of ['gnu-sdk-manifest-membership-operation', 'gnu-sdk-manifest-membership-operation.test']) assert.ok(read(name).toString().startsWith(pointer));
  const spec = '_spec/tooling/native-ingress/gnu-sdk-manifest-membership.puml';
  const files = ['tooling/native-ingress/gnu-sdk-manifest-membership-operation.mjs', 'tooling/native-ingress/gnu-sdk-manifest-membership-operation.test.mjs'];
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(x => x.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) assert.ok(diagram.includes("' covers: " + file + '\n'));
});
