// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { SDK_PAYLOAD_V2_SOURCE_PINS as pins, transformSdkPayloadV2AdapterSource, runRegisteredSdkPayloadInspectionV2 } from './sdk-payload-inspection-v2-operation.mjs';

const read = name => fs.readFileSync(new URL('./' + name + '.mjs', import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
const uri = b => 'data:text/javascript;base64,' + Buffer.from(b).toString('base64');
const link = (b, name, dependency) => Buffer.from(b.toString().replace("from './" + name + ".mjs'", "from '" + dependency + "'"));
const names = ['tar-inventory', 'elf-metadata', 'xz-staging', 'gnu-sdk-inventory', 'gnu-sdk-inventory-v2-operation',
  'gnu-sdk-inventory-v4-operation', 'elf-requirements-v3', 'elf-requirements-v4', 'sdk-payload-inspection', 'sdk-payload-inspection-operation'];
const captured = new Map(names.map(name => [name, read(name)]));
const source = read('sdk-payload-inspection-v2-operation').toString();
const receiptBytes = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/xz-qualification.receipt.json', import.meta.url));
const [v2, v4, oldOperator] = await Promise.all(['gnu-sdk-inventory-v2-operation', 'gnu-sdk-inventory-v4-operation',
  'sdk-payload-inspection-operation'].map(name => import(uri(captured.get(name)))));
const tarSource = v4.transformTarInventoryV4Source(captured.get('tar-inventory'));
const eventCore = v2.transformSdkInventoryV2Source(captured.get('gnu-sdk-inventory'));
const core = oldOperator.transformSdkPayloadCoreSource(eventCore);
const privateAdapter = transformSdkPayloadV2AdapterSource(captured.get('sdk-payload-inspection'));
const tarLinkedAdapter = link(privateAdapter, 'tar-inventory', uri(tarSource));
const adapterSource = link(tarLinkedAdapter, 'elf-requirements-v4', uri(captured.get('elf-requirements-v4'))), adapterUri = uri(adapterSource);
const pipelineSource = link(core, 'tar-inventory', adapterUri);
const privateApi = await import(adapterUri);
const targets = privateApi.SDK_PAYLOAD_TARGETS, root = privateApi.SDK_PAYLOAD_ROOT;
const archive = Buffer.from('0123456789');
const expectedSummary = Object.freeze({ expandedBytes: 47104, headers: 45, entries: 45, extensionBytes: 0, outputBytes: 7592,
  collisionBytes: 3416, dataEvents: 1, metadataSha256: '8f05c471b5dc2703300ca18a09190cefdffac06f92994c163cb17a141c5456a9' });
const expectedDecodedSha256 = 'd708b51922d212fdd281364583bc6a037ba662f492bc705816eae37eeb899b30';

function fixture(options = {}) {
  const elf = rel => {
    const b = Buffer.alloc(rel ? 128 : 512); b.set([127, 69, 76, 70, 2, 1, 1]); b.writeUInt16LE(rel ? 1 : 2, 16);
    b.writeUInt16LE(62, 18); b.writeUInt32LE(1, 20); b.writeUInt16LE(64, 52); b.writeUInt16LE(rel ? 0 : 56, 54);
    if (rel) { b.writeBigUInt64LE(64n, 40); b.writeUInt16LE(64, 58); b.writeUInt16LE(1, 60); } return b;
  };
  const spans = [], members = [];
  for (const [i, row] of targets.entries()) {
    let body;
    if (row.kind === 'ELF_EXEC_DSO') body = elf(false);
    else if (row.kind === 'ET_REL') body = elf(true);
    else if (row.kind === 'LINKER_TEXT') body = Buffer.from('GROUP ( /lib64/libc.so.6 AS_NEEDED ( -lgcc ) )'.padEnd(110, ' '));
    else {
      const field = (s, n) => String(s).padEnd(n, ' ');
      body = Buffer.concat([Buffer.from('!<arch>\n' + field('object.o/', 16) + field(0, 12) + field(0, 6) + field(0, 6) + field('644', 8) + field(128, 10) + '`\n'), elf(true)]);
    }
    const h = Buffer.alloc(512), path = root + '/' + row.path, slash = path.lastIndexOf('/');
    if (Buffer.byteLength(path) <= 100) h.write(path, 0, 100);
    else { h.write(path.slice(slash + 1), 0, 100); h.write(path.slice(0, slash), 345, 155); }
    for (const [at, n, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, body.length], [136, 12, 0]]) {
      h.write(value.toString(8).padStart(n - 1, '0') + '\0', at, n, 'ascii');
    }
    h[156] = 48; h.write('ustar\0', 257, 6); h.write('00', 263, 2); h.fill(32, 148, 156);
    h.write(h.reduce((a, b) => a + b, 0).toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
    spans.push({ path: row.path, index: i + 1, bodyOffset: i * 1024 + 512, size: body.length });
    members.push(h, body, Buffer.alloc(512 - body.length));
  }
  const bytes = Buffer.concat([...members, Buffer.alloc(1024)]); assert.equal(sha(bytes), expectedDecodedSha256);
  if (options.payloadFailureKind) {
    const ordinal = targets.findIndex(row => row.kind === options.payloadFailureKind), at = spans[ordinal].bodyOffset;
    if (options.payloadFailureKind === 'ELF_EXEC_DSO') bytes.writeUInt16LE(129, at + 56);
    else if (options.payloadFailureKind === 'ET_REL') bytes.writeUInt16LE(2, at + 16);
    else if (options.payloadFailureKind === 'AR') bytes.write('#1/PRIVATE_NAME'.padEnd(16), at + 8);
    else { bytes.fill(32, at, at + spans[ordinal].size); bytes.write('INCLUDE(/PRIVATE_REFERENCE)', at); }
  }
  return { bytes, api: privateApi.createSdkPayloadInspectionFixture({ targets: spans, expectedSummary,
    expectedDecodedSha256: options.wrongFullDecodedSha ? '0'.repeat(64) : expectedDecodedSha256, limits: {} }) };
}
function harness(pipeline, f, options, clock, log) {
  const stats = {
    root: { dev: 11n, ino: 101n, mode: 0o40700n, uid: 1000n, gid: 1000n, nlink: 2n, size: 4096n, mtimeNs: 100n, ctimeNs: 101n },
    file: { dev: 22n, ino: 202n, mode: 0o100600n, uid: 1000n, gid: 1000n, nlink: 1n, size: 10n, mtimeNs: 200n, ctimeNs: 201n },
  };
  const identity = Object.fromEntries(Object.entries(stats).map(([kind, values]) => [kind,
    Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]))]));
  const kind = path => path === pipeline.GNU_SDK_DESCRIPTOR.root ? 'root' : path === pipeline.GNU_SDK_DESCRIPTOR.file ? 'file' : assert.fail('unexpected fixture path');
  let reads = 0;
  const io = {
    lstatSync(path) { if (options.earlyFsFailure) throw new Error('mock fs'); return { ...stats[kind(path)] }; },
    fstatSync: fd => ({ ...stats[fd === 41 ? 'root' : 'file'] }), openSync: path => kind(path) === 'root' ? 41 : 42,
    readSync(fd, buffer, offset, length, position) {
      assert.equal(fd, 42); log.archiveReads.push([position, length]); reads++;
      if ((options.archiveHashFailure && reads === 1) || (options.secondHashFailure && reads === 3)) { buffer.fill(0, offset, offset + length); return length; }
      return archive.copy(buffer, offset, position, position + length);
    },
    closeSync(fd) { log.closes.push(fd); if (options.closeFailure && fd === 42) throw new Error('mock close'); },
  };
  function spawn(...args) {
    log.spawns.push(args); log.order.push('spawn'); assert.deepEqual(log.archiveReads.slice(0, 2), [[0, 10], [10, 1]]);
    const child = new EventEmitter(); for (const name of ['stdin', 'stdout', 'stderr']) child[name] = new EventEmitter();
    child.stdin.write = (bytes, callback) => { assert.ok(Buffer.isBuffer(bytes)); queueMicrotask(callback); return true; };
    child.kill = signal => { log.kills.push(signal); queueMicrotask(() => child.emit('close', null, signal)); };
    child.stdin.end = () => {
      child.stdin.emit('finish'); child.stdout.emit('data', f.bytes); if (log.kills.length) return;
      if (!options.missingStdoutEof) child.stdout.emit('end');
      child.stderr.emit('end'); child.stdout.emit('close'); child.stderr.emit('close');
      child.emit('exit', options.badExit ? 1 : 0, null); child.emit('close', options.badExit ? 1 : 0, null); child.stdin.emit('close');
    };
    queueMicrotask(() => { assert.equal(child.stdout.listenerCount('data'), 1); child.emit('spawn'); assert.equal(child.stdout.listenerCount('data'), 2); });
    return child;
  }
  async function run(deps) {
    assert.equal(log.repoOwned, 0); assert.equal(log.repoCloses.length, 11); log.coreCalls++;
    const result = await pipeline.createSdkInventoryFixtureRunner({ archiveBytes: 10, archiveSha256: sha(archive) },
      { fs: io, spawn, now: () => clock.value, ...deps })(identity);
    log.order.push('core-complete');
    if (options.lateCoreFailure) throw Object.assign(new Error('E_CLOSE'), { code: 'E_CLOSE' });
    if (options.expireCore) clock.value = 160000;
    if (options.secondSpawn) deps.spawn('forbidden-second-child');
    return options.coreResult ? options.coreResult(result) : result;
  }
  return { spawn, run };
}
function repoFs(options, clock, log) {
  const prefix = '/tmp/opencode/f9-bootstrap-correspondence', records = new Map(), owned = new Map();
  const rootStat = { dev: 17n, ino: 2000n, mode: 0o40700n, uid: 1000n, gid: 1000n, nlink: 3n, size: 4096n, mtimeNs: 100n, ctimeNs: 101n };
  for (const [i, name] of [...names, 'receipt'].entries()) {
    const path = name === 'receipt' ? prefix + '/_spec/tooling/native-ingress/xz-qualification.receipt.json' : prefix + '/tooling/native-ingress/' + name + '.mjs';
    let bytes = name === 'receipt' ? receiptBytes : captured.get(name);
    if (options.corrupt === name || (name === 'receipt' && options.receiptHashFailure)) { bytes = Buffer.from(bytes); bytes[100] ^= 1; }
    records.set(path, { name, path, bytes, namedCalls: 0, stat: { dev: 18n, ino: 3000n + BigInt(i), mode: 0o100644n, uid: 1000n,
      gid: 1000n, nlink: 1n, size: BigInt(bytes.length), mtimeNs: 200n, ctimeNs: 201n } });
  }
  const target = row => row.name === (options.repoFaultName ?? 'tar-inventory');
  function ioFailure() { throw Object.defineProperty(new Error('PRIVATE_REPO_IO'), 'code', { get() { assert.fail('I/O getter'); } }); }
  let fd = 1000, rootChecks = 0;
  return {
    constants: Object.freeze({ O_RDONLY: 0, O_NOFOLLOW: 131072, O_NONBLOCK: 2048 }),
    readFileSync() { assert.fail('real or unbounded repository route'); },
    lstatSync(path, args) {
      assert.deepEqual(args, { bigint: true }); log.repoStats.push(['named', path]);
      if (path === prefix) {
        rootChecks++; if (options.repoIoFailure === 'root') ioFailure();
        return { ...rootStat, ...(options.repoRootSymlink ? { mode: 0o120777n } : {}), ...(options.repoRootDrift && rootChecks === 2 ? { ino: 2001n } : {}) };
      }
      const row = records.get(path); assert.ok(row, 'fixed fixture repository path'); row.namedCalls++;
      if (target(row) && options.repoIoFailure === 'named') ioFailure();
      const stat = { ...row.stat };
      if (target(row)) {
        if (options.repoOversized) stat.size = 1n << 60n;
        if (options.repoSymlink) stat.mode = 0o120777n;
        if (options.repoFifo) stat.mode = 0o10600n;
        if (options.repoNamedDrift && row.namedCalls === 2) stat.ino++;
      }
      return stat;
    },
    openSync(path, flags) {
      const row = records.get(path); assert.ok(row, 'fixed fixture repository open'); assert.equal(flags, 131072 | 2048); assert.equal(owned.size, 0);
      log.sourceReads.push(path); log.repoOpenFlags.push(flags);
      if (target(row) && (options.repoIoFailure === 'open' || options.repoOpenSymlink)) ioFailure();
      const next = ++fd; owned.set(next, { row, fdChecks: 0 }); log.repoOwned = owned.size;
      if (options.slowCapture) clock.value = 10000; return next;
    },
    fstatSync(fd, args) {
      assert.deepEqual(args, { bigint: true }); const entry = owned.get(fd); assert.ok(entry); entry.fdChecks++; log.repoStats.push(['fd', fd]);
      const { row } = entry; if (target(row) && options.repoIoFailure === 'fd') ioFailure(); const stat = { ...row.stat };
      if (target(row)) {
        if (options.repoFdOversized) stat.size = 1n << 60n;
        if (options.repoFdFifo) stat.mode = 0o10600n;
        if (options.repoFdBeforeDrift) stat.uid++;
        if (options.repoDriftField && entry.fdChecks === 2) stat[options.repoDriftField] += options.repoDriftField === 'mode' ? 0o100n : 1n;
        if (options.repoMetadataGetter) Object.defineProperty(stat, 'uid', { get() { assert.fail('metadata getter'); } });
      }
      return stat;
    },
    readSync(fd, buffer, offset, length, position) {
      const { row } = owned.get(fd) ?? {}; assert.ok(row); assert.equal(offset, position); assert.ok(length > 0 && length <= 65536);
      assert.equal(buffer.length, row.bytes.length + 1); log.repoReads.push({ path: row.path, fd, position, length });
      if (target(row) && options.repoIoFailure === 'read') ioFailure();
      if (target(row) && options.repoInvalidRead) return length + 1;
      let n;
      if (target(row) && options.repoExtraByte && position === row.bytes.length) { buffer[offset] = 120; n = 1; }
      else {
        const end = target(row) && options.repoEarlyEof ? row.bytes.length - 1 : row.bytes.length;
        n = row.bytes.copy(buffer, offset, position, Math.min(position + length, end, position + (options.repoChunkBytes ?? length)));
      }
      if (target(row) && (options.repoReadDeadline || (options.repoEofDeadline && position === row.bytes.length))) clock.value = 10000;
      return n;
    },
    closeSync(fd) {
      const { row } = owned.get(fd) ?? {}; assert.ok(row, 'one fixture close authority'); owned.delete(fd); log.repoOwned = owned.size; log.repoCloses.push(fd);
      if (target(row) && (options.repoCloseFailure || options.repoIoFailure === 'close')) ioFailure();
      if (target(row) && options.repoCloseDeadline) clock.value = 10000;
    },
  };
}
let serial = 0;
async function mocked(options = {}) {
  const f = fixture(options), clock = { value: 0 }, log = { sourceReads: [], archiveReads: [], closes: [], spawns: [], kills: [], order: [], coreCalls: 0,
    stages: 0, preloads: 0, acceptCalls: 0, getCalls: 0, attemptReads: 0, repoOwned: 0, repoCloses: [], repoOpenFlags: [], repoStats: [], repoReads: [], repoAllocations: [], sourceUris: 0 };
  const key = '__payloadV2OperationMock' + ++serial; let nowCalls = 0;
  const d = {
    now() { nowCalls++; if (options.preflightExpired && nowCalls >= 2) return 10000; if (options.invalidClock && nowCalls >= 2) return NaN; return clock.value; },
    fs: repoFs(options, clock, log), repoAlloc(n) { log.repoAllocations.push(n); return Buffer.alloc(n); }, sourceUri() { log.sourceUris++; },
    verifyStagedXzImages() {
      log.stages++; if (options.stageFailure || (options.lateStageFailure && log.stages === 2)) throw new Error('mock stage');
      return { counters: { fsCalls: 10, readBytes: options.stageOverflow ? 5516433 : 100, closeAttempts: 5 } };
    },
    assertNoSystemPreload() { log.preloads++; return !options.preloadFailure && !(options.latePreloadFailure && log.preloads === 2); },
    beginPayloadPass: () => f.api.beginPayloadPass(), createTarInventory: overrides => f.api.createTarInventory(overrides),
    acceptPayloadPass(value) { log.acceptCalls++; log.order.push('payload-accept'); return f.api.acceptPayloadPass(value); },
    getPayloadData() {
      log.getCalls++; const value = f.api.getPayloadData(); log.order.push('payload-release'); if (options.publicationExpired) clock.value += 30000;
      if (options.outputOverflow) return { ...value, mockPadding: 'π'.repeat(400000) };
      return options.payloadResult ? options.payloadResult(value) : value;
    },
    abortPayloadInspection: () => f.api.abortPayloadInspection(), SDK_PAYLOAD_TARGETS: Object.freeze(targets.map((row, i) => Object.freeze({ ...row, index: i + 1 }))),
    getFailedTargetAttempt() { log.attemptReads++; const value = f.api.getFailedTargetAttempt(); return options.attemptOverride ? options.attemptOverride(value) : value; },
  };
  globalThis[key] = d;
  const dependencyUri = uri(`const d=globalThis[${JSON.stringify(key)}];export default d.fs;export const fixtureNow=()=>d.now();
    export const fixtureRepoAlloc=n=>d.repoAlloc(n);export const fixtureSourceUri=()=>d.sourceUri();export const spawn=(...args)=>d.spawn(...args);
    export const verifyStagedXzImages=d.verifyStagedXzImages;export const assertNoSystemPreload=d.assertNoSystemPreload;
    export const runGnuSdkInventory=(...args)=>d.runGnuSdkInventory(...args);export const beginPayloadPass=d.beginPayloadPass;
    export const createTarInventory=d.createTarInventory;export const acceptPayloadPass=d.acceptPayloadPass;
    export const getPayloadData=d.getPayloadData;export const abortPayloadInspection=d.abortPayloadInspection;
    export const SDK_PAYLOAD_TARGETS=d.SDK_PAYLOAD_TARGETS;export const getFailedTargetAttempt=d.getFailedTargetAttempt;`);
  try {
    const pipeline = await import(uri(link(core, 'tar-inventory', dependencyUri))), h = harness(pipeline, f, options, clock, log);
    d.spawn = h.spawn; d.runGnuSdkInventory = async (identity, deps) => {
      assert.equal(identity.file.size, '102296280'); assert.equal(identity.root.ino, '13894'); return h.run(deps);
    };
    let text = source.replace("from 'node:fs'", "from '" + dependencyUri + "'").replace("from 'node:child_process'", "from '" + dependencyUri + "'")
      .replaceAll('performance.now()', 'fixtureNow()').replace('import(uri(stageSource))', 'import(' + JSON.stringify(dependencyUri) + ')')
      .replace('import(uri(pipelineSource))', 'import(' + JSON.stringify(dependencyUri) + ')').replace('import(collectorUri)', 'import(' + JSON.stringify(dependencyUri) + ')');
    const uriNeedle = "const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');";
    assert.equal(text.split(uriNeedle).length, 2); assert.equal(text.split('Buffer.alloc(pin.bytes + 1)').length, 2);
    text = text.replace(uriNeedle, "const uri = bytes => { fixtureSourceUri(); return 'data:text/javascript;base64,' + bytes.toString('base64'); };");
    text = `import { fixtureNow, fixtureRepoAlloc, fixtureSourceUri } from '${dependencyUri}';\n` + text.replace('Buffer.alloc(pin.bytes + 1)', 'fixtureRepoAlloc(pin.bytes + 1)');
    if (options.badLinkedPin) text = text.replace('const adapterSource = pinned(link(tarLinkedAdapter,', 'const adapterSource = pinned(link(Buffer.concat([tarLinkedAdapter, Buffer.from(" ")]),');
    if (!options.productionGuards) for (const [from, to] of [
      ['value.mockOnly !== false', 'value.mockOnly !== true'], ['value.archiveBytes !== 102296280', 'value.archiveBytes !== 10'],
      ["value.archiveSha256 !== 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3'", "value.archiveSha256 !== '" + sha(archive) + "'"],
      ['value.archiveDataBytes !== 204592560', 'value.archiveDataBytes !== 20'], ['value.archiveRequestedBytes !== 204592562', 'value.archiveRequestedBytes !== 22'],
      ['result.mockOnly !== false', 'result.mockOnly !== true'], ['result.capturedBytes !== 184285137', 'result.capturedBytes !== 16730'],
      ["result.decodedSha256 !== '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f'", "result.decodedSha256 !== '" + expectedDecodedSha256 + "'"],
      ["profile: 'registered-sdk-payload-inspection-v2'", "profile: 'mock-sdk-payload-inspection-v2'"], ['realArchiveInspected: !error', 'realArchiveInspected: false'],
    ]) { assert.equal(text.split(from).length, 2); text = text.replace(from, to); }
    const operation = await import(uri(text)); assert.equal(log.sourceReads.length, 0);
    return { f, log, run: async (...args) => { const response = await operation.runRegisteredSdkPayloadInspectionV2(...args); return { response, packet: JSON.parse(response.text) }; } };
  } finally { delete globalThis[key]; }
}
const stopped = value => {
  assert.equal(value.response.exitCode, 1); assert.equal(value.packet.status, 'STOP'); assert.equal(Object.hasOwn(value.packet, 'result'), false);
  assert.equal(value.packet.realArchiveInspected, false); assert.doesNotMatch(value.response.text, /"members"|"capturedBytes"|"decodedSha256"|"unsafeLoadingTags"/);
};

test('every raw and intermediate private graph source matches its length and SHA pin', () => {
  const images = { adapter: captured.get('sdk-payload-inspection'), oldOperator: captured.get('sdk-payload-inspection-operation'),
    elfV3: captured.get('elf-requirements-v3'), elfV4: captured.get('elf-requirements-v4'),
    adapterBindings: Buffer.from(captured.get('sdk-payload-inspection').toString().replaceAll('inspectElf64RequirementsV3', 'inspectElf64RequirementsV4')),
    transformedAdapter: privateAdapter, eventCore, metadataCore: core, transformedTar: tarSource,
    linkedStage: link(captured.get('xz-staging'), 'elf-metadata', uri(captured.get('elf-metadata'))), tarLinkedAdapter,
    linkedAdapter: adapterSource, linkedPipeline: pipelineSource };
  assert.deepEqual(Object.keys(images), Object.keys(pins));
  for (const [key, bytes] of Object.entries(images)) { assert.deepEqual({ bytes: bytes.length, sha256: sha(bytes) }, pins[key]); assert.ok(Object.isFrozen(pins[key])); }
  assert.ok(Object.isFrozen(pins));
  for (const [, name, length, digest] of source.matchAll(/\['([a-z0-9-]+)', (\d+), '([a-f0-9]{64})'\]/g)) {
    assert.equal(captured.get(name).length, Number(length)); assert.equal(sha(captured.get(name)), digest);
  }
});
test('private adapter differs only by exactly two ELF bindings and one module path', () => {
  const original = captured.get('sdk-payload-inspection').toString();
  assert.equal(original.split('inspectElf64RequirementsV3').length, 3); assert.equal(original.split('./elf-requirements-v3.mjs').length, 2);
  assert.deepEqual(Buffer.from(privateAdapter.toString().replaceAll('inspectElf64RequirementsV4', 'inspectElf64RequirementsV3')
    .replace('./elf-requirements-v4.mjs', './elf-requirements-v3.mjs')), captured.get('sdk-payload-inspection'));
  assert.equal(pipelineSource.toString().split("from '" + adapterUri + "'").length, 2);
  assert.equal(source.split('import(collectorUri)').length, 2);
  assert.deepEqual(privateApi.SDK_PAYLOAD_EXPECTATION, { expandedBytes: 505333760, headers: 10181, entries: 8412, extensionBytes: 193768,
    outputBytes: 1812885, collisionBytes: 783392, dataEvents: 7711, metadataSha256: 'efe53c8fda0b0f1e8b8ba6b7868707a88f33aa26b5692b9c76dc0e6da694d901' });
  assert.equal(targets.length, 45); assert.equal(targets.find(row => row.path.endsWith('/lto1')).index, 85);
  assert.equal(targets.find(row => row.path.endsWith('/cc1plus')).index, 86);
  assert.equal(privateApi.SDK_PAYLOAD_DECODED_SHA256, '5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f');
});
test('private transform refuses altered, already-transformed, proxy and shared images', () => {
  const bytes = captured.get('sdk-payload-inspection'), bad = Buffer.from(bytes); bad[100] ^= 1;
  const shared = Buffer.from(new SharedArrayBuffer(bytes.length)); shared.set(bytes);
  for (const input of [bad, privateAdapter, shared, new Proxy(bytes, { get() { assert.fail('proxy getter'); } })]) {
    assert.throws(() => transformSdkPayloadV2AdapterSource(input), { code: 'E_SOURCE_PIN' });
  }
});
test('production import remains inert and exposes a zero-argument fixed operation', () => {
  assert.equal(runRegisteredSdkPayloadInspectionV2.length, 0);
  assert.doesNotMatch(source, /await runRegisteredSdkPayloadInspectionV2|process\.(?:env|argv)|\b(?:fetch|eval|writeFileSync|mkdirSync|unlink|rmSync|execFileSync)\s*\(/);
  assert.doesNotMatch(source, /oldOperator\.run|import\(['"]\.\//);
  assert.match(source, /oldOperator\.transformSdkPayloadCoreSource\(eventCore\)/);
});
test('repository capture body and clock budgets match the consumed operator exactly', () => {
  const prior = captured.get('sdk-payload-inspection-operation').toString();
  const section = text => text.slice(text.indexOf('  function repoStat('), text.indexOf('\n  try {\n', text.indexOf('  function readPinnedRepoSource(')));
  assert.equal(section(source), section(prior));
  assert.match(source, /function guard\(limit = 160000\)/); assert.match(source, /started \+ 160000 - guard\(\) < 150000/);
  assert.match(source, /publicationStarted >= 30000/); assert.match(source, /guard\(10000\)/);
  assert.deepEqual(Buffer.from(core.toString().replace('maxSummaryBytes: 4_194_304', 'maxSummaryBytes: 262_144')), eventCore);
  assert.match(core.toString(), /maxTotalMs: 120_000, cleanupMs: 3000/);
});
test('one pure mocked joint pass accepts all 45 members with ELF v4 and no readiness claims', async () => {
  const m = await mocked(), { response, packet } = await m.run(); assert.equal(response.exitCode, 0); assert.ok(Object.isFrozen(response));
  assert.equal(packet.status, 'SDK_PAYLOAD_DATA_INSPECTED'); assert.equal(packet.result.members.length, 45); assert.equal(packet.result.mockOnly, true);
  assert.equal(packet.realArchiveInspected, false); assert.equal(packet.elfRequirementsProfile, 'elf64le-x86-64-requirements-v4');
  assert.equal(packet.maxStringTableSpanBytes, 16777216); assert.equal(packet.elfPolicyScope, 'FIXED_SOURCE_POLICY_NOT_OBSERVED_DT_STRSZ');
  assert.equal(Object.hasOwn(packet, 'actualDeclaredStringTableBytes'), false);
  for (const member of packet.result.members) {
    assert.equal(member.roleSatisfied, false); assert.equal(member.qualified, false);
    if (member.kind === 'ELF_EXEC_DSO') {
      const requirements = member.metadata.requirements; assert.equal(requirements.profile, 'elf64le-x86-64-requirements-v4');
      assert.equal(requirements.nativeQualified, false); assert.equal(requirements.candidateExecuted, false); assert.equal(requirements.dynamic.stringTable, null);
    }
  }
  for (const key of ['nativeQualified', 'nativeAuthority', 'trainingReady', 'pythonFreeSubsetVerified', 'installedUsability', 'rustReady', 'relocationReady',
    'archiveExtracted', 'filesInstalled', 'pythonRuntimeInvoked', 'archiveImmutable', 'nodeBootstrapAuthenticated', 'hardRssBounded', 'hardDeadlineGuaranteed', 'processTreeBounded']) assert.equal(packet[key], false);
  assert.equal(m.log.coreCalls, 1); assert.equal(m.log.spawns.length, 1); assert.deepEqual(m.log.archiveReads, [[0, 10], [10, 1], [0, 10], [10, 1]]);
  assert.deepEqual(m.log.closes, [42, 41]); assert.deepEqual(m.log.order, ['spawn', 'core-complete', 'payload-accept', 'payload-release']);
  const [command, args, options] = m.log.spawns[0]; assert.equal(command, '/tmp/opencode/f9-xz-qualification-01/ld-linux-x86-64.so.2');
  assert.deepEqual(args, ['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', '/tmp/opencode/f9-xz-qualification-01',
    '/tmp/opencode/f9-xz-qualification-01/xz', '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=16777216', '--', '-']);
  assert.deepEqual(options.env, { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }); assert.deepEqual(options.stdio, ['pipe', 'pipe', 'pipe']); assert.equal(options.shell, false);
});
test('eleven repository captures finish before core and report exact added source accounting', async () => {
  const m = await mocked(), { packet, response } = await m.run(); assert.equal(response.exitCode, 0);
  const sourceBytes = [...captured.values()].reduce((n, b) => n + b.length, 0), total = sourceBytes + receiptBytes.length;
  assert.equal(packet.counts.sourceReads, 10); assert.equal(packet.counts.sourceBytes, sourceBytes); assert.equal(packet.counts.receiptBytes, receiptBytes.length);
  assert.deepEqual(packet.repoCapture, { fsCalls: 110, rootChecks: 22, namedChecks: 22, fdChecks: 22, openAttempts: 11, readAttempts: 22,
    requestedBytes: total + 11, readBytes: total, closeAttempts: 11, closes: 11, completedCaptures: 11, sourceCaptures: 10, receiptCaptures: 1,
    allocations: 11, allocatedBytes: total + 11, ownedFds: 0, peakOwnedFds: 1 });
  for (const key of ['repoCaptureAccountingComplete', 'sourceAccountingComplete', 'receiptAccountingComplete', 'stageAccountingComplete', 'archiveAccountingComplete']) assert.equal(packet[key], true);
  assert.equal(packet.counts.stageChecks, 2); assert.equal(packet.counts.stageCloses, 10); assert.equal(packet.counts.preloadChecks, 2);
  assert.equal(packet.counts.archiveDataBytes, 20); assert.equal(packet.counts.archiveRequestedBytes, 22);
  assert.match(packet.sourceCountersScope, /ten source pins/); assert.equal(new Set(m.log.repoCloses).size, 11); assert.equal(m.log.repoAllocations.length, 11);
});
for (const name of names) test('raw source pin failure stops before core: ' + name, async () => {
  const m = await mocked({ corrupt: name }), value = await m.run(); stopped(value); assert.equal(value.packet.error, 'E_SOURCE_PIN');
  assert.equal(m.log.coreCalls, 0); assert.equal(m.log.spawns.length, 0); assert.equal(m.log.sourceUris, 0);
});
test('linked adapter pin failure stops before private import', async () => {
  const m = await mocked({ badLinkedPin: true }), value = await m.run(); stopped(value); assert.equal(value.packet.error, 'E_SOURCE_PIN'); assert.equal(m.log.coreCalls, 0);
});
test('fixed operation rejects supplied arguments before repository work', async () => {
  const m = await mocked(), value = await m.run({ callback() { assert.fail('callback'); } }); stopped(value);
  assert.equal(value.packet.error, 'E_INPUT'); assert.equal(m.log.sourceReads.length, 0); assert.equal(m.log.coreCalls, 0);
});
for (const option of ['receiptHashFailure', 'preflightExpired', 'slowCapture', 'invalidClock', 'archiveHashFailure', 'stageFailure', 'preloadFailure', 'stageOverflow']) {
  test(option + ' fails before a mock child', async () => {
    const m = await mocked({ [option]: true }), value = await m.run(); stopped(value); assert.equal(m.log.spawns.length, 0); assert.equal(m.log.getCalls, 0);
  });
}
for (const option of ['secondHashFailure', 'lateCoreFailure', 'lateStageFailure', 'latePreloadFailure', 'closeFailure', 'expireCore', 'badExit', 'missingStdoutEof', 'wrongFullDecodedSha']) {
  test(option + ' withholds all provisional observations', async () => {
    const m = await mocked({ [option]: true }), value = await m.run(); stopped(value); assert.equal(m.log.spawns.length, 1);
    assert.equal(m.log.acceptCalls, 0); assert.equal(m.log.getCalls, 0); assert.equal(m.f.api.snapshot().phase, 'failed');
    assert.equal(m.f.api.snapshot().retainedObservations, 0); assert.equal(m.f.api.snapshot().activePayloadBytes, 0);
  });
}
test('second child attempt never retries or creates a second child', async () => {
  const m = await mocked({ secondSpawn: true }), value = await m.run(); stopped(value); assert.equal(value.packet.error, 'E_LIMIT');
  assert.equal(value.packet.counts.spawnAttempts, 2); assert.equal(m.log.spawns.length, 1);
});
for (const option of ['publicationExpired', 'outputOverflow']) test(option + ' suppresses final payload metadata', async () => {
  const m = await mocked({ [option]: true }), value = await m.run(); stopped(value); assert.equal(m.log.getCalls, 1); assert.equal(m.f.api.snapshot().phase, 'failed');
});
test('production guards cannot accept the reduced synthetic profile', async () => {
  const m = await mocked({ productionGuards: true }), value = await m.run(); stopped(value); assert.equal(value.packet.error, 'E_RECEIPT'); assert.equal(m.log.acceptCalls, 0);
});
for (const mutate of [r => ({ ...r, stdoutEnded: false }), r => ({ ...r, closeAttempts: 1 }), r => ({ ...r, archiveSha256: '0'.repeat(64) }),
  r => ({ ...r, archivePasses: 1 }), r => ({ ...r, nativeQualified: true })]) test('joint core lifecycle mutation remains refused ' + String(mutate), async () => {
  const m = await mocked({ coreResult: mutate }), value = await m.run(); stopped(value); assert.equal(value.packet.error, 'E_RECEIPT'); assert.equal(m.log.acceptCalls, 0);
});
test('published full decoded SHA mutation fails fixed outer receipt check', async () => {
  const m = await mocked({ payloadResult: r => ({ ...r, decodedSha256: '0'.repeat(64) }) }), value = await m.run(); stopped(value); assert.equal(value.packet.error, 'E_RECEIPT');
});
for (const [kind, code, underlyingCode] of [['ELF_EXEC_DSO', 'E_ELF', 'E_PROGRAM_HEADERS'], ['ET_REL', 'E_REL', null], ['AR', 'E_AR_UNSUPPORTED', null], ['LINKER_TEXT', 'E_LINKER_UNSUPPORTED', null]]) {
  test('fixed pipeline preserves E_TAR and bounded attempted category for ' + kind, async () => {
    const m = await mocked({ payloadFailureKind: kind }), value = await m.run(), ordinal = targets.findIndex(row => row.kind === kind); stopped(value);
    assert.equal(value.packet.error, 'E_TAR'); assert.deepEqual(value.packet.failedTargetAttempt, { path: targets[ordinal].path, index: ordinal + 1,
      kind, code, underlyingCode, scope: 'ATTEMPTED_LITERAL_TARGET_NOT_ACCEPTED_PAYLOAD_EVIDENCE' });
    assert.equal(m.log.spawns.length, 1); assert.equal(m.log.acceptCalls, 0); assert.equal(m.log.getCalls, 0);
    assert.doesNotMatch(value.response.text, /PRIVATE|"underlyingMessage"|"stack"|"cause"/); assert.equal(value.packet.archiveAccountingComplete, false);
  });
}
for (const mode of ['extra', 'getter', 'path', 'underlying']) test('STOP category refuses ' + mode + ' without leaking data or invoking getters', async () => {
  const m = await mocked({ payloadFailureKind: 'ELF_EXEC_DSO', attemptOverride(value) {
    if (mode === 'extra') return { ...value, privateMetadata: 'PRIVATE' };
    if (mode === 'getter') return Object.defineProperty({ ...value }, 'code', { get() { assert.fail('diagnostic getter'); } });
    if (mode === 'path') return { ...value, path: 'PRIVATE' }; return { ...value, underlyingCode: 'PRIVATE' };
  } }), value = await m.run(); stopped(value); assert.equal(value.packet.error, 'E_TAR'); assert.equal(value.packet.failedTargetAttempt, null); assert.doesNotMatch(value.response.text, /PRIVATE/);
});
for (const option of ['repoOversized', 'repoFdOversized', 'repoFifo', 'repoSymlink', 'repoFdFifo', 'repoOpenSymlink', 'repoRootSymlink']) {
  test(option + ' refuses before allocation and repository reads', async () => {
    const m = await mocked({ [option]: true }), value = await m.run(); stopped(value);
    assert.equal(value.packet.error, option === 'repoOpenSymlink' ? 'E_IO' : 'E_SOURCE_PIN');
    assert.equal(m.log.repoAllocations.length, 0); assert.equal(m.log.repoReads.length, 0); assert.equal(m.log.sourceUris, 0); assert.equal(m.log.coreCalls, 0);
    assert.equal(m.log.repoOwned, 0); assert.equal(value.packet.repoCapture.closeAttempts, ['repoFdOversized', 'repoFdFifo'].includes(option) ? 1 : 0);
  });
}
for (const field of ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']) test('post-read repository FD ' + field + ' drift fails', async () => {
  const m = await mocked({ repoDriftField: field }), value = await m.run(); stopped(value); assert.equal(value.packet.error, field === 'size' ? 'E_SOURCE_PIN' : 'E_BINDING');
  assert.equal(m.log.repoCloses.length, 1); assert.equal(m.log.repoOwned, 0); assert.equal(m.log.sourceUris, 0); assert.equal(value.packet.repoCapture.completedCaptures, 0);
});
for (const option of ['repoFdBeforeDrift', 'repoNamedDrift', 'repoRootDrift', 'repoMetadataGetter', 'repoEarlyEof', 'repoExtraByte', 'repoInvalidRead']) test(option + ' refuses a changed or partial source', async () => {
  const m = await mocked({ [option]: true }), value = await m.run(); stopped(value); assert.equal(m.log.repoCloses.length, 1); assert.equal(m.log.repoOwned, 0);
  assert.equal(m.log.sourceUris, 0); assert.equal(m.log.coreCalls, 0); assert.equal(value.packet.repoCapture.completedCaptures, 0);
  if (option === 'repoExtraByte') assert.equal(value.packet.counts.sourceBytes, captured.get('tar-inventory').length + 1);
  if (option === 'repoEarlyEof') assert.equal(value.packet.counts.sourceBytes, captured.get('tar-inventory').length - 1);
});
test('bounded positive short reads complete all eleven images and EOFs', async () => {
  const m = await mocked({ repoChunkBytes: 1024 }), value = await m.run(); assert.equal(value.response.exitCode, 0);
  for (const path of m.log.sourceReads) { const rows = m.log.repoReads.filter(row => row.path === path); assert.ok(rows.length <= 64); assert.equal(rows.at(-1).length, 1); }
  assert.equal(value.packet.repoCapture.completedCaptures, 11);
});
test('tiny source reads stop within 64 calls and close exactly once', async () => {
  const m = await mocked({ repoChunkBytes: 1 }), value = await m.run(); stopped(value); assert.equal(value.packet.error, 'E_LIMIT');
  assert.equal(m.log.repoReads.length, 63); assert.equal(m.log.repoCloses.length, 1); assert.equal(m.log.sourceUris, 0);
});
for (const method of ['root', 'named', 'open', 'fd', 'read', 'close']) test('unknown repository ' + method + ' errors never invoke code getters', async () => {
  const m = await mocked({ repoIoFailure: method }), value = await m.run(); stopped(value); assert.equal(value.packet.error, method === 'close' ? 'E_CLOSE' : 'E_IO');
  assert.equal(m.log.repoOwned, 0); assert.equal(m.log.sourceUris, 0); assert.equal(m.log.coreCalls, 0); assert.doesNotMatch(value.response.text, /PRIVATE/);
});
for (const option of ['repoReadDeadline', 'repoEofDeadline', 'repoCloseDeadline', 'slowCapture']) test(option + ' retains one close attempt after deadline', async () => {
  const m = await mocked({ [option]: true }), value = await m.run(); stopped(value); assert.equal(value.packet.error, 'E_DEADLINE');
  assert.equal(m.log.repoCloses.length, 1); assert.equal(value.packet.repoCapture.closeAttempts, 1); assert.equal(value.packet.repoCapture.closes, 1);
  assert.equal(value.packet.repoCapture.ownedFds, 0); assert.equal(value.packet.repoCapture.completedCaptures, 0); assert.equal(m.log.sourceUris, 0);
});
for (const other of [{}, { corrupt: 'tar-inventory' }, { slowCapture: true }]) test('repository close failure wins without retry ' + JSON.stringify(other), async () => {
  const m = await mocked({ ...other, repoCloseFailure: true }), value = await m.run(); stopped(value); assert.equal(value.packet.error, 'E_CLOSE');
  assert.equal(value.packet.repoCapture.closeAttempts, 1); assert.equal(value.packet.repoCapture.closes, 0); assert.equal(value.packet.repoCapture.ownedFds, 0);
  assert.equal(m.log.repoCloses.length, 1); assert.equal(m.log.sourceUris, 0);
});
for (const option of ['repoFdOversized', 'repoCloseFailure', 'receiptHashFailure']) test('receipt ' + option + ' stops after ten closed sources without imports', async () => {
  const m = await mocked({ repoFaultName: 'receipt', [option]: true }), value = await m.run(); stopped(value);
  assert.equal(value.packet.sourceAccountingComplete, true); assert.equal(value.packet.receiptAccountingComplete, false);
  assert.equal(value.packet.repoCapture.sourceCaptures, 10); assert.equal(value.packet.repoCapture.receiptCaptures, 0); assert.equal(m.log.repoCloses.length, 11); assert.equal(m.log.sourceUris, 0);
});
test('prior sources and failed source prefixes keep separate truthful counts', async () => {
  const m = await mocked({ repoFaultName: 'elf-requirements-v4', repoEarlyEof: true }), value = await m.run(); stopped(value);
  const index = names.indexOf('elf-requirements-v4'), expected = names.slice(0, index + 1).reduce((sum, name) => sum + captured.get(name).length, 0) - 1;
  assert.equal(value.packet.repoCapture.sourceCaptures, index); assert.equal(value.packet.counts.sourceBytes, expected);
  assert.equal(value.packet.repoCapture.closes, index + 1); assert.equal(value.packet.sourceAccountingComplete, false); assert.equal(m.log.sourceUris, 0);
});
test('older implementation and test source bytes remain frozen to the consumed metadata epoch', () => {
  const frozen = [
    ['elf-metadata', 19842, 'b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85'],
    ['elf-metadata.test', 34963, 'c717327d5960e4c631497476fe7ee97778708bedfc69606a31a10fdeea2b31c3'],
    ['elf-requirements.test', 36918, '77d46252f3e86ee0ce0be0641e35541b747a2cf302ce2f30209315cf3bcad53c'],
    ['elf-requirements-v3', 20493, '3bd878fe2a6de57a2b8252163cdf2a4d3093c6605a903105a9f531f039b84f10'],
    ['elf-requirements-v3.test', 34165, 'bcd699c04813d5f65e1bdcc6b75ac10c56a1b8e9ff3d8b8c27e98378f5cbd554'],
    ['sdk-payload-inspection', 31569, 'fc301816588aa16360ce30a9c18ea7d5d82838432e7bd28f54155024e4445469'],
    ['sdk-payload-inspection.test', 32066, '2f24025b95a29160151d629797e0da49d16bec6169f046297bc317fb39180dec'],
    ['sdk-payload-inspection-operation', 20620, 'fa19e0512fc6a74b09de9fc0039b8f44ffa8ba61566c676683a5b8ce48e2b295'],
    ['sdk-payload-inspection-operation.test', 39569, 'a31a14472e209fca2e02f6b42c1a1ed86d4520803b99c584749b185cd411169b'],
  ];
  for (const [name, length, digest] of frozen) { const bytes = read(name); assert.equal(bytes.length, length); assert.equal(sha(bytes), digest); }
  assert.equal(receiptBytes.length, 4239); assert.equal(sha(receiptBytes), 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233');
});
test('source-only handoff reports all four new file pins', t => {
  for (const name of ['elf-requirements-v4', 'elf-requirements-v4.test', 'sdk-payload-inspection-v2-operation', 'sdk-payload-inspection-v2-operation.test']) {
    const bytes = read(name); t.diagnostic(JSON.stringify({ file: 'tooling/native-ingress/' + name + '.mjs', bytes: bytes.length, sha256: sha(bytes) }));
  }
});
