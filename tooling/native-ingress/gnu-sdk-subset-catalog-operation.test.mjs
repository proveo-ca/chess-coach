// SPEC: _spec/tooling/native-ingress/gnu-sdk-subset-catalog.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createSdkSubsetCatalogFixture, SDK_CATALOG_EXPECTATION } from './gnu-sdk-subset-catalog.mjs';
import { SDK_SUBSET_CATALOG_SOURCE_PINS as pins, transformSdkSubsetCatalogCoreSource, runRegisteredGnuSdkSubsetCatalog } from './gnu-sdk-subset-catalog-operation.mjs';

const read = name => fs.readFileSync(new URL('./' + name + '.mjs', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const link = (bytes, name, dependency) => Buffer.from(bytes.toString().replace("from './" + name + ".mjs'", "from '" + dependency + "'"));
const names = ['tar-inventory', 'elf-metadata', 'xz-staging', 'gnu-sdk-inventory', 'gnu-sdk-inventory-v2-operation', 'gnu-sdk-inventory-v4-operation', 'gnu-sdk-subset-catalog'];
const captured = new Map(names.map(name => [name, read(name)])), source = read('gnu-sdk-subset-catalog-operation').toString();
const receiptBytes = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/xz-qualification.receipt.json', import.meta.url));
const [v2, v4] = await Promise.all([import(uri(captured.get('gnu-sdk-inventory-v2-operation'))), import(uri(captured.get('gnu-sdk-inventory-v4-operation')))]);
const tarSource = v4.transformTarInventoryV4Source(captured.get('tar-inventory')), tar = await import(uri(tarSource));
const eventCore = v2.transformSdkInventoryV2Source(captured.get('gnu-sdk-inventory')), core = transformSdkSubsetCatalogCoreSource(eventCore);
const adapterSource = link(captured.get('gnu-sdk-subset-catalog'), 'tar-inventory', uri(tarSource)), adapterUri = uri(adapterSource);
const pipelineSource = link(core, 'tar-inventory', adapterUri);
const archive = Buffer.from('0123456789'), root = 'x86-64--glibc--stable-2026.08-1';

test('catalog pointers, owner and coverage index agree', () => {
  const spec = '_spec/tooling/native-ingress/gnu-sdk-subset-catalog.puml';
  const files = ['gnu-sdk-subset-catalog', 'gnu-sdk-subset-catalog.test', 'gnu-sdk-subset-catalog-operation', 'gnu-sdk-subset-catalog-operation.test'].map(name => 'tooling/native-ingress/' + name + '.mjs');
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(value => value.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) {
    assert.ok(diagram.includes("' covers: " + file + '\n'));
    assert.ok(fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8').startsWith('// SPEC: ' + spec + '\n'));
  }
});

let serial = 0;
function fixture() {
  const header = Buffer.alloc(512); header.write(root + '/bin/gcc', 0, 100);
  for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, 1], [136, 12, 0]]) header.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  header[156] = 48; header.write('ustar\0', 257, 6); header.write('00', 263, 2); header.fill(32, 148, 156);
  const checksum = header.reduce((sum, byte) => sum + byte, 0); header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  const bytes = Buffer.concat([header, Buffer.from('x'), Buffer.alloc(511 + 1024)]), parser = tar.createTarMemberInventory();
  parser.feed(bytes); const summary = parser.finish();
  const api = createSdkSubsetCatalogFixture({ expectedSummary: Object.fromEntries(Object.keys(SDK_CATALOG_EXPECTATION).map(key => [key, summary[key]])),
    expectedDecodedSha256: sha(bytes), regularFileCount: 1, limits: {} });
  return { bytes, api };
}
function harness(pipeline, f, options, clock, log) {
  const stats = {
    root: { dev: 11n, ino: 101n, mode: 0o40700n, uid: 1000n, gid: 1000n, nlink: 2n, size: 4096n, mtimeNs: 100n, ctimeNs: 101n },
    file: { dev: 22n, ino: 202n, mode: 0o100600n, uid: 1000n, gid: 1000n, nlink: 1n, size: 10n, mtimeNs: 200n, ctimeNs: 201n },
  };
  const identity = Object.fromEntries(Object.entries(stats).map(([kind, values]) => [kind, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]))]));
  const kind = path => path === pipeline.GNU_SDK_DESCRIPTOR.root ? 'root' : path === pipeline.GNU_SDK_DESCRIPTOR.file ? 'file' : assert.fail('unexpected path');
  let reads = 0;
  const io = {
    lstatSync: path => ({ ...stats[kind(path)] }), fstatSync: fd => ({ ...stats[fd === 41 ? 'root' : 'file'] }), openSync: path => kind(path) === 'root' ? 41 : 42,
    readSync(fd, buffer, offset, length, position) {
      assert.equal(fd, 42); log.archiveReads.push([position, length]); reads++;
      if (options.archiveHashFailure && reads === 1) { buffer.fill(0, offset, offset + length); return length; }
      return archive.copy(buffer, offset, position, position + length);
    },
    closeSync(fd) { log.closes.push(fd); if (options.closeFailure && fd === 42) throw new Error('mock close'); },
  };
  function spawn(...args) {
    log.spawns.push(args); log.order.push('spawn'); assert.deepEqual(log.archiveReads.slice(0, 2), [[0, 10], [10, 1]]);
    const child = new EventEmitter(); for (const name of ['stdin', 'stdout', 'stderr']) child[name] = new EventEmitter();
    assert.equal(child.stdout.listenerCount('data'), 0);
    child.stdin.write = (bytes, callback) => { assert.ok(Buffer.isBuffer(bytes)); queueMicrotask(callback); return true; };
    child.kill = signal => { log.kills.push(signal); queueMicrotask(() => child.emit('close', null, signal)); };
    child.stdin.end = () => {
      child.stdin.emit('finish'); child.stdout.emit('data', f.bytes); if (log.kills.length) return;
      child.stdout.emit('end'); child.stderr.emit('end'); child.stdout.emit('close'); child.stderr.emit('close');
      child.emit('exit', 0, null); child.emit('close', 0, null); child.stdin.emit('close');
    };
    queueMicrotask(() => {
      assert.equal(child.stdout.listenerCount('data'), 1); log.pipelineHandlersAtSpawn = true;
      child.emit('spawn'); assert.equal(child.stdout.listenerCount('data'), 2);
    }); return child;
  }
  async function run(deps) {
    log.coreCalls++;
    const result = await pipeline.createSdkInventoryFixtureRunner({ archiveBytes: 10, archiveSha256: sha(archive) }, { fs: io, spawn, now: () => clock.value, ...deps })(identity);
    log.order.push('core-complete');
    if (options.lateCoreFailure) throw Object.assign(new Error('E_CLOSE'), { code: 'E_CLOSE' });
    if (options.expireCore) clock.value = 130000;
    if (options.secondSpawn) deps.spawn('forbidden-second-child');
    return options.coreResult ? options.coreResult(result) : result;
  }
  return { spawn, run };
}
async function mocked(options = {}) {
  const f = fixture(), clock = { value: 0 }, log = { sourceReads: [], archiveReads: [], closes: [], spawns: [], kills: [],
    order: [], coreCalls: 0, stages: 0, preloads: 0, acceptCalls: 0, getCalls: 0, pipelineHandlersAtSpawn: false };
  const key = '__subsetCatalogMock' + ++serial;
  let nowCalls = 0;
  const d = {
    api: f.api, log,
    now() {
      nowCalls++;
      if (options.preflightExpired && nowCalls >= 2) return 5000;
      if (options.insufficientBudget && nowCalls >= 13) return 5001;
      if (options.invalidClock && nowCalls >= 2) return NaN;
      return clock.value;
    },
    fs: { readFileSync(path) {
      log.sourceReads.push(path);
      if (path.endsWith('/xz-qualification.receipt.json')) return options.receiptFailure ? Buffer.from('bad') : receiptBytes;
      const prefix = '/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/', name = path.slice(prefix.length, -4);
      assert.equal(path, prefix + name + '.mjs'); assert.ok(captured.has(name));
      const bytes = options.corrupt === name ? Buffer.from('bad') : captured.get(name);
      if (options.slowCapture) clock.value = 5000;
      return bytes;
    } },
    verifyStagedXzImages() {
      log.stages++; if (options.stageFailure || (options.lateStageFailure && log.stages === 2)) throw new Error('mock stage');
      return { counters: { fsCalls: 10, readBytes: options.stageOverflow ? 5516433 : 100, closeAttempts: 5 } };
    },
    assertNoSystemPreload() { log.preloads++; return !options.preloadFailure; },
    beginCatalogPass: () => f.api.beginCatalogPass(), createTarInventory: overrides => f.api.createTarInventory(overrides),
    acceptCatalogPass(value) { log.acceptCalls++; log.order.push('catalog-accept'); return f.api.acceptCatalogPass(value); },
    getCatalogData() {
      log.getCalls++; const value = f.api.getCatalogData(); log.order.push('catalog-release');
      if (options.publicationExpired) clock.value += 5000;
      return options.outputOverflow ? { ...value, mockPadding: 'π'.repeat(400000) } : value;
    },
    abortCatalog: () => f.api.abortCatalog(),
  };
  globalThis[key] = d;
  const dependencyUri = uri(`const d = globalThis[${JSON.stringify(key)}]; export default d.fs;
    export const fixtureNow = () => d.now(); export const spawn = (...args) => d.spawn(...args);
    export const verifyStagedXzImages = d.verifyStagedXzImages; export const assertNoSystemPreload = d.assertNoSystemPreload;
    export const runGnuSdkInventory = (...args) => d.runGnuSdkInventory(...args);
    export const beginCatalogPass = d.beginCatalogPass; export const createTarInventory = d.createTarInventory;
    export const acceptCatalogPass = d.acceptCatalogPass; export const getCatalogData = d.getCatalogData; export const abortCatalog = d.abortCatalog;`);
  try {
    const pipeline = await import(uri(link(core, 'tar-inventory', dependencyUri))), h = harness(pipeline, f, options, clock, log);
    d.spawn = h.spawn; d.runGnuSdkInventory = async (identity, deps) => {
      assert.equal(identity.file.size, '102296280'); assert.equal(identity.root.ino, '13894'); return h.run(deps);
    };
    let text = source.replace("from 'node:fs'", "from '" + dependencyUri + "'").replace("from 'node:child_process'", "from '" + dependencyUri + "'")
      .replaceAll('performance.now()', 'fixtureNow()').replace('import(uri(stageSource))', 'import(' + JSON.stringify(dependencyUri) + ')')
      .replace('import(uri(pipelineSource))', 'import(' + JSON.stringify(dependencyUri) + ')').replace('import(collectorUri)', 'import(' + JSON.stringify(dependencyUri) + ')');
    text = `import { fixtureNow } from '${dependencyUri}';\n` + text;
    if (!options.productionGuards) for (const [from, to] of [
      ['value.mockOnly !== false', 'value.mockOnly !== true'], ['value.archiveBytes !== 102296280', 'value.archiveBytes !== 10'],
      ["value.archiveSha256 !== 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3'", "value.archiveSha256 !== '" + sha(archive) + "'"],
      ['value.archiveDataBytes !== 204592560', 'value.archiveDataBytes !== 20'], ['value.archiveRequestedBytes !== 204592562', 'value.archiveRequestedBytes !== 22'],
      ['result.mockOnly !== false', 'result.mockOnly !== true'], ['result.namespaceEntryCount !== 8412', 'result.namespaceEntryCount !== 1'],
      ['result.regularFileCount !== 6891', 'result.regularFileCount !== 1'],
      ["result.decodedSha256 !== '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f'", "result.decodedSha256 !== '" + sha(f.bytes) + "'"],
      ["profile: 'registered-gnu-sdk-subset-catalog-v1'", "profile: 'mock-gnu-sdk-subset-catalog-v1'"], ['realArchiveInspected: !error', 'realArchiveInspected: false'],
    ]) { assert.equal(text.split(from).length, 2); text = text.replace(from, to); }
    const operation = await import(uri(text)); assert.equal(log.sourceReads.length, 0);
    return { f, log, run: async () => { const response = await operation.runRegisteredGnuSdkSubsetCatalog(); return { response, packet: JSON.parse(response.text) }; } };
  } finally { delete globalThis[key]; }
}
const stopped = value => { assert.equal(value.response.exitCode, 1); assert.equal(value.packet.status, 'STOP'); assert.equal(Object.hasOwn(value.packet, 'result'), false); assert.equal(value.packet.realArchiveInspected, false); };

test('cold production import exposes only an unregistered zero-argument operation', () => {
  assert.equal(runRegisteredGnuSdkSubsetCatalog.length, 0);
  assert.doesNotMatch(source, /await runRegisteredGnuSdkSubsetCatalog|process\.(?:env|argv)|\b(?:fetch|writeFileSync|mkdirSync|unlink|rmSync|execFileSync)\s*\(/);
  assert.doesNotMatch(source, /runRegisteredGnuSdkInventoryV[1-4]\(/);
});
test('all raw sources, transforms and expanded private images match exact frozen pins', () => {
  const refs = [...source.matchAll(/\['([a-z0-9-]+)', (\d+), '([a-f0-9]{64})'\]/g)]; assert.deepEqual(refs.map(value => value[1]), names.slice(0, 6));
  for (const [, name, bytes, digest] of refs) { assert.equal(captured.get(name).length, Number(bytes)); assert.equal(sha(captured.get(name)), digest); }
  for (const [bytes, pin] of [[captured.get('gnu-sdk-subset-catalog'), pins.adapter], [eventCore, pins.eventCore], [core, pins.metadataCore],
    [tarSource, pins.transformedTar], [adapterSource, pins.linkedAdapter], [pipelineSource, pins.linkedPipeline],
    [link(captured.get('xz-staging'), 'elf-metadata', uri(captured.get('elf-metadata'))), pins.linkedStage]]) assert.deepEqual({ bytes: bytes.length, sha256: sha(bytes) }, pin);
  assert.equal(receiptBytes.length, 4239); assert.equal(sha(receiptBytes), 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233');
  assert.equal(adapterSource.toString().split("from '" + uri(tarSource) + "'").length, 2);
  assert.equal(pipelineSource.toString().split("from '" + adapterUri + "'").length, 2);
});
test('private core transform changes only summary budget and leaves 120s core cleanup, selectors and hash-before-spawn intact', () => {
  assert.deepEqual(Buffer.from(core.toString().replace('maxSummaryBytes: 4_194_304', 'maxSummaryBytes: 262_144')), eventCore);
  assert.match(core.toString(), /maxTotalMs: 120_000, cleanupMs: 3000/); assert.match(core.toString(), /maxStreamEvents: 262_144/);
  assert.match(core.toString(), /firstPass\(\);[\s\S]*await gate\(d.beforeDecode\)/);
  assert.match(source, /function guard\(limit = 130000\)/); assert.match(source, /guard\(5000\)/); assert.match(source, /started \+ 130000 - guard\(\) < 125000/);
});
test('core transform rejects modified images, shared storage and proxies without getters', () => {
  const bad = Buffer.from(eventCore); bad[100] ^= 1;
  const shared = Buffer.from(new SharedArrayBuffer(eventCore.length)); shared.set(eventCore);
  for (const bytes of [bad, core, shared, new Proxy(eventCore, { get() { assert.fail('proxy getter'); } })]) assert.throws(() => transformSdkSubsetCatalogCoreSource(bytes), { code: 'E_SOURCE_PIN' });
});
test('one mock decoder child completes two archive hash/EOF passes before accepted catalog publication', async () => {
  const m = await mocked(), { response, packet } = await m.run(); assert.equal(response.exitCode, 0); assert.ok(Object.isFrozen(response));
  assert.equal(packet.status, 'SUBSET_CANDIDATE_CATALOG'); assert.equal(packet.result.candidates.length, 1);
  assert.equal(m.log.coreCalls, 1); assert.equal(m.log.spawns.length, 1); assert.equal(m.log.pipelineHandlersAtSpawn, true);
  assert.deepEqual(m.log.archiveReads, [[0, 10], [10, 1], [0, 10], [10, 1]]); assert.deepEqual(m.log.closes, [42, 41]);
  assert.deepEqual(m.log.order, ['spawn', 'core-complete', 'catalog-accept', 'catalog-release']);
  assert.equal(packet.counts.archivePasses, 2); assert.equal(packet.counts.archiveDataBytes, 20); assert.equal(packet.counts.archiveRequestedBytes, 22);
  assert.equal(packet.sourceAccountingComplete, true); assert.equal(packet.receiptAccountingComplete, true); assert.equal(packet.stageAccountingComplete, true);
  assert.equal(packet.archiveAccountingComplete, true); assert.equal(packet.counts.sourceReads, 7); assert.equal(packet.counts.stageChecks, 2); assert.equal(packet.counts.stageCloses, 10);
  assert.equal(packet.packetDiagnostics.stdoutEvents, 1); assert.equal(packet.packetDiagnostics.diagnosticCountersComplete, true);
});
for (const name of names) test('failed raw source pin stops before any child: ' + name, async () => {
  const m = await mocked({ corrupt: name }), result = await m.run(); stopped(result); assert.equal(result.packet.error, 'E_SOURCE_PIN');
  assert.equal(result.packet.sourceAccountingComplete, false); assert.equal(m.log.spawns.length, 0); assert.equal(m.log.coreCalls, 0); assert.equal(m.log.getCalls, 0);
});
test('failed Step 1 receipt stops before any archive core or staging check', async () => {
  const m = await mocked({ receiptFailure: true }), result = await m.run(); stopped(result);
  assert.equal(result.packet.receiptAccountingComplete, false); assert.equal(m.log.stages, 0); assert.equal(m.log.coreCalls, 0);
});
for (const option of ['preflightExpired', 'slowCapture', 'insufficientBudget', 'invalidClock']) test(option + ' stops before starting the 120s core', async () => {
  const m = await mocked({ [option]: true }), result = await m.run(); stopped(result); assert.equal(m.log.coreCalls, 0); assert.equal(m.log.spawns.length, 0);
});
test('unchanged core rejects archive hash failure before decoder spawn', async () => {
  const m = await mocked({ archiveHashFailure: true }), result = await m.run(); stopped(result); assert.equal(result.packet.error, 'E_HASH');
  assert.equal(m.log.spawns.length, 0); assert.equal(m.log.stages, 0); assert.equal(m.log.getCalls, 0); assert.deepEqual(m.log.closes, [42, 41]);
});
for (const option of ['stageFailure', 'preloadFailure', 'stageOverflow']) test(option + ' suppresses all candidate publication', async () => {
  const m = await mocked({ [option]: true }), result = await m.run(); stopped(result); assert.equal(m.log.spawns.length, 0); assert.equal(m.log.getCalls, 0);
  assert.equal(result.packet.archiveAccountingComplete, false);
});
for (const option of ['lateCoreFailure', 'lateStageFailure', 'closeFailure', 'expireCore']) test(option + ' suppresses complete-parser output before acceptance', async () => {
  const m = await mocked({ [option]: true }), result = await m.run(); stopped(result); assert.equal(m.log.spawns.length, 1);
  assert.equal(m.log.acceptCalls, 0); assert.equal(m.log.getCalls, 0); assert.equal(m.f.api.snapshot().phase, 'failed');
});
test('second spawn attempt fails without retry, fallback or a second actual child', async () => {
  const m = await mocked({ secondSpawn: true }), result = await m.run(); stopped(result); assert.equal(result.packet.error, 'E_LIMIT');
  assert.equal(result.packet.counts.spawnAttempts, 2); assert.equal(m.log.spawns.length, 1); assert.equal(m.log.coreCalls, 1);
});
for (const option of ['publicationExpired', 'outputOverflow']) test(option + ' removes all catalog data from final response', async () => {
  const m = await mocked({ [option]: true }), result = await m.run(); stopped(result); assert.equal(m.log.getCalls, 1);
  assert.equal(m.f.api.snapshot().phase, 'failed'); assert.doesNotMatch(result.response.text, /candidates|namespaceComplete/);
});
test('production guards reject reduced fixtures instead of granting live namespace completion', async () => {
  const m = await mocked({ productionGuards: true }), result = await m.run(); stopped(result); assert.equal(result.packet.error, 'E_RECEIPT'); assert.equal(m.log.acceptCalls, 0);
});
test('core callback result requires complete lifecycle fields before any catalog release', async () => {
  const m = await mocked({ coreResult: result => ({ ...result, stdoutEnded: false }) }), result = await m.run(); stopped(result);
  assert.equal(result.packet.error, 'E_RECEIPT'); assert.equal(m.log.getCalls, 0);
});
test('mock catalog result never grants Native, training, installation, relocation or a hard resource guarantee', async () => {
  const m = await mocked(), result = await m.run(); assert.equal(result.response.exitCode, 0);
  for (const key of ['nativeQualified', 'nativeAuthority', 'trainingReady', 'pythonFreeSubsetVerified', 'installedUsability', 'rustReady', 'relocationReady',
    'archiveExtracted', 'filesInstalled', 'pythonRuntimeInvoked', 'archiveImmutable', 'nodeBootstrapAuthenticated', 'hardRssBounded', 'hardDeadlineGuaranteed', 'processTreeBounded']) assert.equal(result.packet[key], false);
});
test('older operations and tests retain their frozen source images', () => {
  for (const [name, digest] of [
    ['gnu-sdk-inventory', 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29'], ['gnu-sdk-inventory.test', '67825a3e8c685c0fddafc554076b9203a9b6e9ac5e1a83cfb4d4459e5e84e9cc'],
    ['gnu-sdk-inventory-operation', '3b9dfbf8c7b045884af420b43c24bff6f90eea04aa8e5b6e967af1b22ec3411f'], ['gnu-sdk-inventory-operation.test', '79a915de890809dc3284cd9e5204b08af6239e120f0f49177d98512d3de51ad4'],
    ['gnu-sdk-inventory-v2-operation', '39da4bc85f6e7eaaecb0abd157d59ec4c2dcb6191a19c9247cbadd0080ae767a'], ['gnu-sdk-inventory-v2-operation.test', '3c4c3ebb98a0880d487c3d638714aeba0423bc3aabef4122d474bf506308a3c2'],
    ['gnu-sdk-inventory-v3-operation', '2714854c2fe0521abcb6b4acf2a80b8a5e46b7026922f2ff849c970167d80ea1'], ['gnu-sdk-inventory-v3-operation.test', 'd48ac4a1c6a9ae154452d56d7f95df1303b3db25b4022263c58e9a3f1eba20ac'],
    ['gnu-sdk-inventory-v4-operation', '2ea3c1bfe71676c37d01a05b64f9d3f11e4a7d7d93541cfdc4707a378bae17db'], ['gnu-sdk-inventory-v4-operation.test', '96d9660717568b56dbdf962701d1d296883c495df494b8dbf67a1cd4dd6c6f08'],
    ['gnu-sdk-manifest-membership-operation', '7273341b5857152d1c4ce62fc5bd5cf4bc438a82c8845504a7d84b3cb3b82250'],
    ['gnu-sdk-manifest-membership-operation.test', '1512c3c4f4fe60235c31252851a57c78f4961b08f5b3713f66d339f67a8d36bb'],
  ]) assert.equal(sha(read(name)), digest);
});
