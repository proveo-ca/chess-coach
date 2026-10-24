// SPEC: _spec/tooling/native-ingress/gnu-sdk-driver-controls-v2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { SDK_DRIVER_V2_SOURCE_PINS, SDK_DRIVER_V2_MANIFEST_PIN, transformSdkDriverAliasSource,
  transformSdkDriverV2CoreSource, runRegisteredGnuSdkDriverControlsV2 } from './gnu-sdk-driver-controls-v2-operation.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const read = name => fs.readFileSync(new URL('./' + name + '.mjs', import.meta.url));
const names = ['tar-inventory', 'elf-metadata', 'xz-staging', 'gnu-sdk-inventory', 'gnu-sdk-inventory-v2-operation', 'gnu-sdk-inventory-v4-operation', 'sdk-driver-controls'];
const captured = new Map(names.map(name => [name, read(name)]));
const source = read('gnu-sdk-driver-controls-v2-operation').toString(), raw = captured.get('sdk-driver-controls');
const initializer = 'const path = value.slice(start, end);';
const aliasInitializer = "const rawLine = value.slice(start, end);\n    const path = rawLine.startsWith('./') ? rawLine.slice(2) : rawLine;";
const originalInterpretation = 'DATA_ONLY_LITERAL_PATHS_NOT_MUTATION_AUTHORITY';
const aliasInterpretation = 'DATA_ONLY_SINGLE_LEADING_DOT_ALIAS_PATHS_NOT_MUTATION_AUTHORITY';
const link = (bytes, name, dependencyUri) => Buffer.from(bytes.toString().replace("from './" + name + ".mjs'", "from '" + dependencyUri + "'"));
const [v2, v4] = await Promise.all([import(uri(captured.get('gnu-sdk-inventory-v2-operation'))), import(uri(captured.get('gnu-sdk-inventory-v4-operation')))]);
const tarSource = v4.transformTarInventoryV4Source(captured.get('tar-inventory')), tar = await import(uri(tarSource));
const core = transformSdkDriverV2CoreSource(v2.transformSdkInventoryV2Source(captured.get('gnu-sdk-inventory')));
const aliasRaw = transformSdkDriverAliasSource(raw), linkedCollector = link(aliasRaw, 'tar-inventory', uri(tarSource));
const collectorUri = uri(linkedCollector), linkedPipeline = link(core, 'tar-inventory', collectorUri);
const aliasModule = await import(collectorUri), strictModule = await import(uri(link(raw, 'tar-inventory', uri(tarSource))));
const elf = await import(uri(captured.get('elf-metadata')));
const receiptBytes = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/xz-qualification.receipt.json', import.meta.url));
const root = 'x86-64--glibc--stable-2026.08-1';
function header(path, size = 0, type = '0', target = '') {
  const bytes = Buffer.alloc(512); bytes.write(path, 0, 100);
  for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, size], [136, 12, 0]]) bytes.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  bytes[156] = type.charCodeAt(0); bytes.write(target, 157, 100); bytes.write('ustar\0', 257, 6); bytes.write('00', 263, 2); bytes.fill(32, 148, 156);
  const sum = bytes.reduce((total, byte) => total + byte, 0); bytes.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii'); return bytes;
}
const member = (path, body = Buffer.alloc(0), type = '0', target = '') => Buffer.concat([header(path, body.length, type, target), body, Buffer.alloc((512 - body.length % 512) % 512)]);
function elfFixture() {
  const bytes = Buffer.alloc(64); bytes.set([0x7f, 69, 76, 70, 2, 1, 1]); bytes.writeUInt16LE(2, 16); bytes.writeUInt16LE(62, 18);
  bytes.writeUInt32LE(1, 20); bytes.writeBigUInt64LE(64n, 32); bytes.writeUInt16LE(64, 52); bytes.writeUInt16LE(56, 54); return bytes;
}
function fixture(options = {}, ns = aliasModule) {
  const driver = options.driver ?? elfFixture(), location = options.location ?? Buffer.from('/opt/sdk\n'), relocs = options.relocs ?? Buffer.from('./bin/data\n');
  const references = options.references ?? [{ path: 'bin/data', body: Buffer.from('unselected-body') }];
  const bytes = Buffer.concat([member(ns.SDK_DRIVER_TARGETS[0].path, driver), member(ns.SDK_DRIVER_TARGETS[1].path, location),
    member(ns.SDK_DRIVER_TARGETS[2].path, relocs), ...references.map(value => member(root + '/' + value.path, value.body, value.type, value.target)), Buffer.alloc(1024)]);
  assert.ok(bytes.length < 1048576);
  const parser = tar.createTarMemberInventory(); parser.feed(bytes); const summary = parser.finish();
  const profile = { expectedSummary: Object.fromEntries(Object.keys(ns.SDK_DRIVER_EXPECTATION).map(key => [key, summary[key]])),
    expectedDecodedSha256: options.expectedDigest ?? sha(bytes), targets: [
      ...summary.fileSpans.slice(0, 2).map(({ size, index, bodyOffset }) => ({ size, index, bodyOffset })), { maxSize: 1048576 },
    ], limits: options.limits ?? {} };
  return { driver, location, relocs, bytes, profile, api: ns.createSdkDriverControlsFixture(profile) };
}
const receipt = (inventory, extra = {}) => ({ state: 'GNU_SDK_DATA_INVENTORY', mockOnly: true, inventory, archivePasses: 2, closeAttempts: 2,
  stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true, exitCode: 0, signal: null,
  extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false, ...extra });
function firstPass(f) { f.api.beginMemberPass(); const p = f.api.createTarInventory(); p.feed(f.bytes); return f.api.acceptMemberPass(receipt(p.finish())); }
function secondPass(f, bytes = f.bytes, beforeAccept = null) {
  f.api.beginCapturePass(); const p = f.api.createTarInventory(); p.feed(bytes); const pending = p.finish();
  if (beforeAccept) beforeAccept(pending);
  f.api.acceptCapturePass(receipt(pending)); return f.api.getInspectionData();
}
let serial = 0;
async function fixtureGraph(f, options, log) {
  const key = '__sdkDriverAliasFixture' + ++serial;
  globalThis[key] = { a: f.api, options, log };
  const adapterUri = uri(`const d = globalThis[${JSON.stringify(key)}], a = d.a;
    export const beginMemberPass = () => a.beginMemberPass(); export const createTarInventory = x => a.createTarInventory(x);
    export const acceptMemberPass = x => a.acceptMemberPass(x); export const beginCapturePass = () => a.beginCapturePass();
    export const acceptCapturePass = x => a.acceptCapturePass(x); export const snapshotDriverInspection = () => a.snapshot();
    export const abortDriverInspection = () => a.abortInspection(); export function getInspectionData() {
      d.log.getCalls++; const result = a.getInspectionData(); d.log.order.push('parse-and-join-complete'); d.log.driverSnapshot = result.driver.bytes;
      if (!d.options.pinnedManifestRef) return result;
      return Object.freeze({ ...result, relocs: Object.freeze({ ...result.relocs, size: 9367,
        byteLength: d.options.badLength ? 9366 : 9367,
        sha256: d.options.badHash ? '0'.repeat(64) : '60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e' }) });
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
  async function run(deps) {
    pass++;
    return graph.pipeline.createSdkInventoryFixtureRunner({ archiveBytes: 10, archiveSha256: sha(input) }, { fs: io, spawn, now: options.now, ...deps })(identity);
  }
  return { run, spawn, log };
}
async function mockOperation(options = {}) {
  const f = fixture(options.fixture), log = { reads: [], stages: [], preloads: 0, calls: 0, getCalls: 0, elfCalls: 0, order: [], driverSnapshot: null };
  const graph = await fixtureGraph(f, options, log), clock = { value: 0 };
  const h = ioHarness(graph, { ...options, now: () => clock.value, output: pass => pass === 2 && options.changedSecond ? options.changedSecond(f.bytes) : f.bytes });
  const key = '__sdkDriverAliasOperation' + ++serial; let nowCalls = 0;
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
    inspectElf64Requirements(bytes) { log.elfCalls++; log.order.push('driver-elf-inspection'); return elf.inspectElf64Requirements(bytes); },
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
    ["profile: 'registered-gnu-sdk-driver-controls-v2'", "profile: 'mock-sdk-driver-controls-v2-fixture'"], ['realArchiveInspected: error === null', 'realArchiveInspected: false'],
  ]) { assert.ok(mocked.includes(from)); mocked = mocked.replace(from, to); }
  try {
    const operation = await import(uri(mocked)); assert.equal(log.reads.length, 0);
    return { f, graph, h, log, run: async () => { const result = await operation.runRegisteredGnuSdkDriverControlsV2(); assert.ok(Object.isFrozen(result)); return { ...result, receipt: JSON.parse(result.text) }; } };
  } finally { delete globalThis[key]; }
}

test('v2 imports inertly with a fixed zero-argument operation and no CLI, scripts, network or filesystem writes', () => {
  assert.equal(runRegisteredGnuSdkDriverControlsV2.length, 0);
  assert.doesNotMatch(source, /await runRegisteredGnuSdkDriverControlsV2|process\.(?:env|argv)|runRegisteredGnuSdkDriverControls\(|runRegisteredGnuSdkManifestDiagnostics\(/);
  assert.doesNotMatch(source, /\b(?:fetch|writeFileSync|writeSync|mkdirSync|unlink|rmSync|rename|execFileSync)\s*\(/);
});
test('all captures and original/intermediate/final/linked images match independently computed length and SHA', () => {
  const refs = [...source.matchAll(/\['([a-z0-9-]+)', (\d+), '([a-f0-9]{64})'\]/g)]; assert.deepEqual(refs.map(ref => ref[1]), names);
  for (const [, name, size, digest] of refs) { assert.equal(captured.get(name).length, Number(size)); assert.equal(sha(captured.get(name)), digest); }
  const intermediate = Buffer.from(raw.toString().replace(initializer, aliasInitializer));
  for (const [bytes, pin] of [[raw, SDK_DRIVER_V2_SOURCE_PINS.originalCollector], [intermediate, SDK_DRIVER_V2_SOURCE_PINS.initializerCollector],
    [aliasRaw, SDK_DRIVER_V2_SOURCE_PINS.aliasCollector], [linkedCollector, SDK_DRIVER_V2_SOURCE_PINS.linkedCollector], [linkedPipeline, SDK_DRIVER_V2_SOURCE_PINS.linkedPipeline],
    [core, SDK_DRIVER_V2_SOURCE_PINS.controlsCore], [tarSource, SDK_DRIVER_V2_SOURCE_PINS.transformedTar]]) {
    assert.deepEqual({ bytes: bytes.length, sha256: sha(bytes) }, pin); assert.ok(Object.isFrozen(pin));
  }
  assert.equal(receiptBytes.length, 4239); assert.equal(sha(receiptBytes), 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233');
  const stage = link(captured.get('xz-staging'), 'elf-metadata', uri(captured.get('elf-metadata')));
  assert.equal(stage.length, 43154); assert.equal(sha(stage), '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2');
});
test('the private collector changes exactly one initializer and one interpretation string with no other edits or exports', () => {
  assert.equal(raw.toString().split(initializer).length, 2); assert.equal(raw.toString().split(originalInterpretation).length, 2);
  assert.equal(aliasRaw.toString().split(aliasInitializer).length, 2); assert.equal(aliasRaw.toString().split(aliasInterpretation).length, 2);
  assert.deepEqual(Buffer.from(aliasRaw.toString().replace(aliasInitializer, initializer).replace(aliasInterpretation, originalInterpretation)), raw);
  assert.deepEqual(Object.keys(aliasModule), Object.keys(strictModule));
  assert.deepEqual(aliasModule.SDK_DRIVER_LIMITS, strictModule.SDK_DRIVER_LIMITS);
});
for (const [name, needle] of [['initializer', initializer], ['interpretation', originalInterpretation]]) for (const mutation of ['missing', 'duplicate']) {
  test('source transform rejects ' + mutation + ' ' + name, () => {
    const input = mutation === 'missing' ? Buffer.from(raw.toString().replace(needle, '')) : Buffer.concat([raw, Buffer.from(needle)]);
    assert.throws(() => transformSdkDriverAliasSource(input), { code: 'E_SOURCE_PIN' });
  });
}
test('wrong hashes and transformed/proxy/shared source input fail while native shadow properties remain inert', () => {
  const wrong = Buffer.from(raw); wrong[100] ^= 1;
  const shared = new SharedArrayBuffer(raw.length); new Uint8Array(shared).set(raw);
  for (const input of [wrong, aliasRaw, Buffer.from(shared), new Proxy(raw, { get() { assert.fail('source proxy'); } })]) assert.throws(() => transformSdkDriverAliasSource(input), { code: 'E_SOURCE_PIN' });
  const shadow = Buffer.from(raw); for (const key of ['length', 'buffer', 'byteOffset', 'toString']) Object.defineProperty(shadow, key, { get() { assert.fail(key); } });
  assert.deepEqual(transformSdkDriverAliasSource(shadow), aliasRaw); assert.equal(sha(raw), SDK_DRIVER_V2_SOURCE_PINS.originalCollector.sha256);
});
test('strict v1 and its diagnostic image still reject the leading-dot alias with unchanged historical pins', async () => {
  assert.throws(() => strictModule.parseSdkRelocationManifest(Buffer.from('./bin/data\n')), { code: 'E_MANIFEST' });
  const diagnosticOp = await import(uri(read('gnu-sdk-manifest-diagnostics-operation')));
  const diagnostic = await import(uri(link(diagnosticOp.instrumentSdkManifestCollectorSource(raw), 'tar-inventory', uri(tarSource))) + '#strict-v2-comparison');
  assert.throws(() => diagnostic.parseSdkRelocationManifest(Buffer.from('./bin/data\n')), { code: 'E_MANIFEST' });
  assert.equal(diagnostic.readManifestFailureDiagnostic().reason, 'PATH_GRAMMAR');
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
  ]) assert.equal(sha(read(name)), digest);
});
test('one leading ./ is accepted and the returned path array remains canonical and frozen', () => {
  const result = aliasModule.parseSdkRelocationManifest(Buffer.from('./bin/data\nlib/a\n./__proto__\n'));
  assert.deepEqual(result, ['bin/data', 'lib/a', '__proto__']); assert.ok(Object.isFrozen(result));
  assert.deepEqual(aliasModule.parseSdkRelocationManifest(Buffer.from('bin/data\n')), strictModule.parseSdkRelocationManifest(Buffer.from('bin/data\n')));
});
for (const value of ['a\n./a\n', './a\na\n', './a\n./a\n']) test('duplicate detection uses canonical names: ' + JSON.stringify(value), () => {
  assert.throws(() => aliasModule.parseSdkRelocationManifest(Buffer.from(value)), { code: 'E_MANIFEST' });
});
for (const value of ['././a', './', './/a', '/', '/a', '../a', './../a', 'a/../b', './a/../b', 'a/./b', './a/./b', 'C:drive', './C:drive',
  'a\\b', './a\\b', ' a', './ a', 'a ', './a ', 'a\t', 'a\0b', './a\r\n', 'a\r\n', '\n', './a\n\n', '\n./a',
  '"a"', "'a'", './"a"', '$HOME/a', './${ROOT}/a', '$(echo a)', '`echo a`', 'a;b', 'a|b', 'a&b', 'a>b', 'a*b', 'a?b']) {
  test('all other prohibited grammar still rejects ' + JSON.stringify(value), () => assert.throws(() => aliasModule.parseSdkRelocationManifest(Buffer.from(value)), { code: 'E_MANIFEST' }));
}
test('canonical rooted path length, raw byte cap, line count and strict UTF8 remain unchanged', () => {
  const boundary = 'a'.repeat(1024 - Buffer.byteLength(root) - 1);
  assert.deepEqual(aliasModule.parseSdkRelocationManifest(Buffer.from('./' + boundary)), [boundary]);
  assert.throws(() => aliasModule.parseSdkRelocationManifest(Buffer.from('./' + boundary + 'a')), { code: 'E_MANIFEST' });
  assert.throws(() => aliasModule.parseSdkRelocationManifest(Buffer.alloc(1048577, 97)), { code: 'E_INPUT' });
  assert.throws(() => aliasModule.parseSdkRelocationManifest(Buffer.from([0xff])), { code: 'E_TEXT' });
  const lines = Array.from({ length: 4096 }, (_, i) => './f' + i); assert.equal(aliasModule.parseSdkRelocationManifest(Buffer.from(lines.join('\n'))).length, 4096);
  assert.throws(() => aliasModule.parseSdkRelocationManifest(Buffer.from([...lines, './extra'].join('\n'))), { code: 'E_MANIFEST' });
});
test('the private alias collector joins canonical names to accepted regular metadata and hashes original raw text bytes', () => {
  const f = fixture(); const metadata = firstPass(f), result = secondPass(f);
  assert.deepEqual(result.relocs.paths, ['bin/data']); assert.equal(result.relocs.joined[0].path, root + '/bin/data');
  assert.equal(result.relocs.interpretation, aliasInterpretation); assert.equal(result.relocs.sha256, sha(f.relocs));
  assert.notEqual(result.relocs.sha256, sha(Buffer.from('bin/data\n'))); assert.equal(result.relocs.byteLength, f.relocs.length);
  assert.equal(metadata.decodedSha256, sha(f.bytes)); assert.equal(f.api.snapshot().copiedBytes, f.driver.length + f.location.length + f.relocs.length);
});
for (const [name, references] of [['missing', []], ['symlink', [{ path: 'bin/data', type: '2', target: 'outside' }]], ['hardlink', [{ path: 'bin/data', type: '1', target: 'outside' }]]]) {
  test('canonical alias lookup rejects ' + name + ' regular reference without following or synthesizing', () => {
    const f = fixture({ references }); firstPass(f); assert.throws(() => secondPass(f), { code: 'E_REFERENCE' });
  });
}
test('non-prohibited Python/GDB references remain inert metadata, not payload selection or exclusion authority', () => {
  const f = fixture({ relocs: Buffer.from('./share/gdb/python/a.py\n'), references: [{ path: 'share/gdb/python/a.py', body: Buffer.from('unselected') }] });
  firstPass(f); const result = secondPass(f); assert.equal(result.relocs.joined[0].path, root + '/share/gdb/python/a.py');
  assert.equal(f.api.snapshot().copiedBytes, f.driver.length + f.location.length + f.relocs.length); assert.equal(Object.hasOwn(result.relocs.joined[0], 'bytes'), false);
});
test('fixed targets, independent decoded SHA and immutable lookup/span budgets remain unchanged', () => {
  assert.deepEqual(aliasModule.SDK_DRIVER_TARGETS, strictModule.SDK_DRIVER_TARGETS); assert.deepEqual(aliasModule.SDK_DRIVER_EXPECTATION, strictModule.SDK_DRIVER_EXPECTATION);
  assert.equal(aliasModule.SDK_DRIVER_DECODED_SHA256, '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f');
  const bad = fixture({ expectedDigest: '0'.repeat(64) }); assert.throws(() => firstPass(bad), { code: 'E_HASH' }); assert.throws(() => bad.api.beginCapturePass(), { code: 'E_PHASE' });
  const small = fixture({ limits: { maxJoinedBytes: 1 } }); firstPass(small); assert.throws(() => secondPass(small), { code: 'E_OUTPUT' });
});
test('all original lifecycle, stage, input byte and global/core deadline contracts are byte-identical to strict v1', () => {
  const previous = read('gnu-sdk-driver-controls-operation').toString();
  for (const pattern of [/const identity = \{[\s\S]*?\n\};/u, /const gate = \(\) => \{[\s\S]*?\n    \};/u, /async function runPass\(number\) \{[\s\S]*?\n    \}/u]) {
    assert.ok(source.match(pattern)); assert.equal(source.match(pattern)[0], previous.match(pattern)[0]);
  }
  const stream = v2.transformSdkInventoryV2Source(captured.get('gnu-sdk-inventory'));
  assert.deepEqual(Buffer.from(core.toString().replace('maxSummaryBytes: 4_194_304', 'maxSummaryBytes: 262_144')), stream);
  assert.match(source, /function guard\(limit = 250000\)/); assert.match(source, /started \+ 250000 - guard\(\) < 120000/);
  assert.match(source, /guard\(10000\)/); assert.match(source, /Buffer.byteLength\(text\) > 2097152/);
  assert.match(source, /inspectElf64Requirements\(driver.bytes\)/); assert.ok(linkedPipeline.toString().includes("from '" + collectorUri + "'")); assert.match(source, /import\(collectorUri\)/);
});
test('the fixed raw manifest pin is frozen and explicitly checked after parsing/joining but before ELF inspection', () => {
  assert.deepEqual(SDK_DRIVER_V2_MANIFEST_PIN, { byteLength: 9367, sha256: '60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e' }); assert.ok(Object.isFrozen(SDK_DRIVER_V2_MANIFEST_PIN));
  const get = source.indexOf('data = collector.getInspectionData();'), check = source.indexOf('if (data.relocs.byteLength !== SDK_DRIVER_V2_MANIFEST_PIN.byteLength'), inspect = source.indexOf('elf.inspectElf64Requirements(driver.bytes)');
  assert.ok(get >= 0 && check > get && inspect > check); assert.match(source, /data.relocs.sha256 !== SDK_DRIVER_V2_MANIFEST_PIN.sha256\) fail\('E_HASH'\)/);
});
test('successful mocked operation supplies pinned refs and preserves the post-parse publication guard unchanged', async () => {
  const h = await mockOperation({ pinnedManifestRef: true }), { exitCode, receipt: result, text } = await h.run();
  assert.equal(exitCode, 0); assert.equal(result.profile, 'mock-sdk-driver-controls-v2-fixture'); assert.equal(result.manifestInterpretation, 'single-leading-dot-slash-v1');
  assert.equal(result.result.relocs.byteLength, 9367); assert.equal(result.result.relocs.sha256, SDK_DRIVER_V2_MANIFEST_PIN.sha256);
  assert.equal(result.result.relocs.interpretation, aliasInterpretation); assert.deepEqual(result.result.relocs.paths, ['bin/data']);
  assert.match(result.result.manifestPinScope, /after parsing\/joining/); assert.match(result.result.manifestJoinScope, /no extraction, exclusion or mutation permission/);
  assert.match(result.result.canonicalJoinScope, /data only, no host opens or mutation permission/);
  assert.deepEqual(h.log.order, ['parse-and-join-complete', 'driver-elf-inspection']); assert.equal(h.log.elfCalls, 1); assert.equal(result.realArchiveInspected, false);
  assert.equal(result.counts.archivePasses, 4); assert.equal(result.counts.archiveDataBytes, 40); assert.equal(result.counts.archiveRequestedBytes, 44);
  assert.equal(result.counts.stageChecks, 4); assert.equal(h.log.preloads, 4); assert.ok(h.log.stages.every(value => value === h.log.stages[0]));
  assert.deepEqual(h.h.log.closes, [[1, 42], [1, 41], [2, 42], [2, 41]]); assert.deepEqual(h.h.log.listenerCounts, [0, 1, 0, 1]);
  assert.equal(h.h.log.spawns.length, 2); assert.equal(Object.hasOwn(result.result.driver, 'bytes'), false); assert.ok(Buffer.byteLength(text) < 2097152);
  for (const key of ['nativeQualified', 'installedUsability', 'pythonFreeSubsetVerified', 'rustReady', 'trainingReady', 'archiveExtracted', 'filesInstalled', 'pythonRuntimeInvoked', 'hardRssBounded', 'hardDeadlineGuaranteed', 'processTreeBounded']) assert.equal(result[key], false);
  assert.ok(h.log.driverSnapshot.every(byte => byte === 0));
});
for (const options of [{}, { pinnedManifestRef: true, badLength: true }, { pinnedManifestRef: true, badHash: true }]) {
  test('post-parse raw manifest mismatch suppresses ELF inspection and all result publication: ' + Object.keys(options).join(','), async () => {
    const h = await mockOperation(options), { receipt: result, text } = await h.run();
    assert.equal(result.error, 'E_HASH'); assert.equal(result.counts.completedCorePasses, 2); assert.equal(result.inspection.hasAcceptedSecondPass, true);
    assert.equal(h.log.getCalls, 1); assert.equal(h.log.elfCalls, 0); assert.deepEqual(h.log.order, ['parse-and-join-complete']);
    assert.equal(Object.hasOwn(result, 'result'), false); assert.doesNotMatch(text, /"paths"|"prefix"|"declarations"/); assert.ok(h.log.driverSnapshot.every(byte => byte === 0));
  });
}
for (const [name, fixtureOptions, code] of [['repeated prefix', { relocs: Buffer.from('././bad\n') }, 'E_MANIFEST'],
  ['canonical duplicate', { relocs: Buffer.from('bin/data\n./bin/data\n') }, 'E_MANIFEST'], ['missing reference', { references: [] }, 'E_REFERENCE'],
  ['linked reference', { references: [{ path: 'bin/data', type: '2', target: 'outside' }] }, 'E_REFERENCE']]) {
  test('remaining ' + name + ' failure is still STOP before raw-hash publication or ELF inspection', async () => {
    const h = await mockOperation({ pinnedManifestRef: true, fixture: fixtureOptions }), { receipt: result } = await h.run();
    assert.equal(result.error, code); assert.equal(result.counts.completedCorePasses, 2); assert.equal(h.log.elfCalls, 0); assert.deepEqual(h.log.order, []);
    assert.equal(Object.hasOwn(result, 'result'), false);
  });
}
test('untampered physical profile guards reject fixture results without starting a second child', async () => {
  const h = await mockOperation({ productionGuards: true, pinnedManifestRef: true }), { receipt: result } = await h.run();
  assert.equal(result.error, 'E_RECEIPT'); assert.equal(h.log.calls, 1); assert.equal(h.h.log.spawns.length, 1); assert.equal(h.log.getCalls, 0);
});
for (const options of [{ fixture: { expectedDigest: '0'.repeat(64) } }, { insufficientBudget: true }, { preflightExpired: true }, { spawnFailure: 1 }]) {
  test('early failure forbids the second child and post-parse pin processing: ' + Object.keys(options)[0], async () => {
    const h = await mockOperation({ ...options, pinnedManifestRef: true }), { receipt: result } = await h.run();
    assert.equal(result.status, 'STOP'); assert.ok(h.h.log.spawns.length <= 1); assert.equal(h.log.getCalls, 0); assert.equal(h.log.elfCalls, 0); assert.equal(Object.hasOwn(result, 'result'), false);
  });
}
for (const options of [{ closeFailure: 2 }, { expireAfterSecond: true }, { thirdSpawn: true }, { changedSecond: bytes => { const copy = Buffer.from(bytes); copy[572] ^= 1; return copy; } }]) {
  test('late core/lifecycle failure keeps result private and cannot launch a third child: ' + Object.keys(options)[0], async () => {
    const h = await mockOperation({ ...options, pinnedManifestRef: true }), { receipt: result } = await h.run();
    assert.equal(result.status, 'STOP'); assert.ok(h.h.log.spawns.length <= 2); assert.equal(h.log.getCalls, 0); assert.equal(h.log.elfCalls, 0); assert.equal(Object.hasOwn(result, 'result'), false);
    if (options.thirdSpawn) { assert.equal(result.error, 'E_LIMIT'); assert.equal(result.counts.spawnAttempts, 3); }
  });
}
test('source, receipt and staged-image failures retain narrow errors and no partially parsed data', async () => {
  for (const options of [{ corrupt: 'sdk-driver-controls' }, { receiptFailure: true }, { stageFailure: true }, { preloadFailure: true }]) {
    const h = await mockOperation({ ...options, pinnedManifestRef: true }), { receipt: result } = await h.run();
    assert.equal(result.error, options.corrupt || options.receiptFailure ? 'E_SOURCE_PIN' : 'E_PREREQUISITE'); assert.equal(h.h.log.spawns.length, 0); assert.equal(Object.hasOwn(result, 'result'), false);
  }
});
test('both new files reference only the parent-owned v2 SPEC without an unpublished owner/index dependency', () => {
  const pointer = '// SPEC: _spec/tooling/native-ingress/gnu-sdk-driver-controls-v2.puml\n';
  for (const name of ['gnu-sdk-driver-controls-v2-operation', 'gnu-sdk-driver-controls-v2-operation.test']) assert.ok(read(name).toString().startsWith(pointer));
  const spec = '_spec/tooling/native-ingress/gnu-sdk-driver-controls-v2.puml';
  const files = ['tooling/native-ingress/gnu-sdk-driver-controls-v2-operation.mjs', 'tooling/native-ingress/gnu-sdk-driver-controls-v2-operation.test.mjs'];
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(x => x.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) assert.ok(diagram.includes("' covers: " + file + '\n'));
});
