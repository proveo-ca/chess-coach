// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readSync, constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { runRegisteredGnuPreparationEvidenceV1, createGnuPreparationEvidenceOperationFixture,
  GNU_PREPARATION_OPERATION_PATH as PATH, GNU_PREPARATION_OPERATION_LIMITS as LIMITS,
  GNU_PREPARATION_TARGETS as TARGETS, GNU_PREPARATION_INPUT as INPUT,
  gnuPreparationEvidenceOperationSource as source } from './gnu-preparation-evidence-operation.mjs';

const REPO = '/tmp/opencode/f9-bootstrap-correspondence';
const PART = 'gnu-preparation';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = bytes => ({ bytes: bytes.length, sha256: sha(bytes) });
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const decode = target => Buffer.from(target.slice(target.indexOf(',') + 1), 'base64').toString('utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const error = code => Object.assign(new Error(code), { code });
const throws = (fn, code) => assert.throws(fn, cause => cause.code === code);
const operationBytes = readFileSync(source.operationPath);
assert.deepEqual(pin(operationBytes), source.operationPin);
const old = (await import(uri(operationBytes))).splitToolchainEvidenceOperationSource;
const retained = new Map(source.rows.map(([key, path]) => [key, readFileSync(path)]));
for (const [key, bytes] of retained) assert.deepEqual(pin(bytes), source.sourcePins[key]);
const dataBytes = readFileSync(source.dataPath);
assert.deepEqual(pin(dataBytes), source.dataPin);
const acceptedData = JSON.parse(dataBytes), accepted = acceptedData.collection.roles[0];
const graph = source.buildGraph(retained, old);
source.admitGraph(graph);
const deliveredTar = await import(uri(graph.outputs.eventTar));
const deliveredWriter = await import(graph.writerUri);
const deliveredCore = await import(graph.coreUri);
const deliveredHelper = await import(graph.collectorUri);
const ownBytes = readFileSync(REPO + '/tooling/native-ingress/gnu-preparation-evidence-operation.mjs');

function stat(size, ino = 10, directory = false) {
  return { dev: directory ? 28n : 29n, ino: BigInt(ino), mode: directory ? 0o40700n : 0o100600n,
    uid: 1000n, gid: 1000n, nlink: directory ? 2n : 1n, size: BigInt(size), mtimeNs: 123n, ctimeNs: 456n };
}
function sourceFs(options = {}, event = () => {}) {
  const rows = [['operation', source.operationPath, operationBytes],
    ...source.rows.map(([key, path]) => [key, path, retained.get(key)]), ['data', source.dataPath, dataBytes]];
  const files = new Map(rows.map(([key, path, bytes], i) => [path, { key, bytes, metadata: stat(bytes.length, i + 10) }]));
  const fds = new Map(), calls = []; let next = 3;
  const backend = {
    lstatSync(path, flags) {
      calls.push(['lstat', path]); event('sourceStat', path); assert.deepEqual(flags, { bigint: true });
      const entry = files.get(path);
      const value = path === REPO ? stat(4096, 2, true) : entry?.metadata;
      assert.ok(value, 'closed source/data paths');
      return options.stat ? options.stat({ ...value }, entry?.key ?? 'root', calls) : { ...value };
    },
    openSync(path, flags) {
      calls.push(['open', path]); event('sourceOpen', path);
      assert.equal(flags, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
      assert.ok(files.has(path), 'no archive/output acquisition by source reader');
      if (options.openFailure === files.get(path).key) throw error('EIO');
      const fd = next++; fds.set(fd, files.get(path)); return fd;
    },
    fstatSync(fd, flags) {
      assert.deepEqual(flags, { bigint: true }); const entry = fds.get(fd); assert.ok(entry);
      calls.push(['fstat', entry.key]);
      return options.fdStat ? options.fdStat({ ...entry.metadata }, entry.key, calls) : { ...entry.metadata };
    },
    readSync(fd, buffer, offset, length, position) {
      const entry = fds.get(fd); assert.ok(entry);
      calls.push(['read', entry.key, length, position]); event('sourceRead', entry.key);
      if (options.readFailure === entry.key) throw error('EIO');
      if (options.shortRead === entry.key) return 0;
      if (options.extraEof === entry.key && position === entry.bytes.length) return 1;
      const amount = Math.min(length, Math.max(0, entry.bytes.length - position));
      entry.bytes.copy(buffer, offset, position, position + amount);
      if (options.corrupt === entry.key && position === 0) buffer[offset] ^= 1;
      return amount;
    },
    closeSync(fd) {
      const entry = fds.get(fd); assert.ok(entry); fds.delete(fd);
      calls.push(['close', entry.key]); event('sourceClose', entry.key);
      if (options.closeFailure === entry.key) throw error('EIO');
    },
  };
  return { backend, files, fds, calls };
}
function coreValue() {
  return { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: false, archiveBytes: INPUT.archiveBytes,
    archiveSha256: INPUT.archiveSha256, archivePasses: 2, archiveDataBytes: 204592560,
    archiveRequestedBytes: 204592562, closeAttempts: 2, expandedBytes: 505333760, streamEvents: 10,
    inventory: clone(accepted.inventory), exitCode: 0, signal: null,
    stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true,
    extracted: false, extractionAuthorized: false, installedUsability: false, decoderQualified: false,
    provenanceVerified: false, hardRssBounded: false, processTreeBounded: false, hardDeadlineGuaranteed: false,
    nativeQualified: false, pythonFreeSubsetVerified: false, rustReady: false, trainingReady: false };
}
function collectionValue() {
  const role = clone(accepted);
  role.selected = TARGETS.map(target => ({ ...target, bodySha256: target.expectedSha256,
    hashObservation: 'MATCHED_EXPECTED_BODY_HASH', qualified: false, abiVerified: false, roleSatisfied: false,
    metadata: { state: 'SOURCE_FORMAT_DATA', qualified: false,
      observation: source.inspectPreparationText(Buffer.from('x'.repeat(target.size))) } }));
  return { state: 'SPLIT_TOOLCHAIN_EVIDENCE_DATA', profile: 'SPLIT_TOOLCHAIN_EVIDENCE_DATA', part: 'gnu', mockOnly: false,
    completeNamespace: true, entries: 8412, regularFiles: 6891, expandedBytes: 505333760,
    artifactCount: 1, targetCount: 3, selectedPayloads: 3, roles: [role], declaredNeededEdges: [],
    resourceAccounting: { metadataBytes: 3000000, manifestBytes: 9446, capturedBytes: 12234,
      buffersAllocated: 5, buffersErased: 5, peakPayloadBytes: 10391, maxAdditionalElfSnapshotBytes: 16384,
      secureStringErasureClaimed: false, hardRssBounded: false }, ...source.flags };
}
function publicationCounts(length) {
  return { fsOperations: 70, guardChecks: 100, opens: 3, closeAttempts: 3, closes: 3, cleanupCloseAttempts: 0,
    namedStats: 15, fdStats: 10, fsyncs: 4, chmods: 1, writeAttempts: Math.ceil(length / 65536),
    readAttempts: Math.ceil(length / 65536) + 1, requestedWriteBytes: length, requestedReadBytes: length + 1,
    writtenBytes: length, readbackBytes: length, inputBytes: length, copiedBytes: length, inputHashBytes: length,
    readbackHashBytes: length, peakOwnedFDs: 2, ownedSnapshotBytes: 0, ownedScratchBytes: 0,
    peakOwnedSnapshotBytes: length, peakOwnedScratchBytes: 65536, jsonStringCodeUnits: length, wipedSnapshotBytes: length };
}
function harness(options = {}) {
  let clock = 0, phase = 'RESERVED', pubCounts = { writtenBytes: 0 }, acceptedRoles = 0, current = null;
  let entries = 0, expandedBytes = 0, collectorPhase = 'ACTIVE', written = null;
  const events = [], imports = [];
  const setClock = n => { clock = n; };
  const event = (name, value) => { events.push([name, value]); options.event?.(name, value, setClock); };
  const io = sourceFs(options.source, event);
  const collector = {
    beginToolchainEvidenceBatch() { event('begin'); },
    beginToolchainEvidenceRole(role) { assert.equal(role, 'gnu-sdk'); current = role; event('role'); },
    createTarInventory() { assert.fail('mock controller does not parse archive bytes'); },
    acceptToolchainEvidenceRole(value) {
      event('accept'); if (options.acceptFailure) throw error(options.acceptFailure);
      acceptedRoles = 1; current = null; entries = value.inventory.entries; expandedBytes = value.expandedBytes;
    },
    snapshotToolchainEvidenceBatch() {
      return { part: 'gnu', state: collectorPhase, mockOnly: false, acceptedRoles, currentRole: current, entries, expandedBytes,
        metadataBytes: 0, manifestBytes: 0, capturedBytes: 0, selectedPayloads: 0, activeBufferBytes: 0, activeBodyHashes: 0 };
    },
    finishToolchainEvidenceBatch() {
      event('finish'); const value = collectionValue(); options.collection?.(value);
      return options.shallowFrozen ? Object.freeze(value) : source.freeze(value);
    },
    abortToolchainEvidenceBatch() { event('abortCollector'); collectorPhase = 'ABORTED'; if (options.collectorAbortFailure) throw error('EIO'); },
    getToolchainEvidenceFailure() { return options.diagnostic ?? null; },
  };
  const helper = { SOURCE_CREATE_GNU_PREPARATION() { event('createCollector'); return collector; }, SOURCE_GNU_TAR() {} };
  const publisher = {
    snapshot() {
      event('publicationSnapshot', phase);
      const value = { part: PART, phase, ownedFDCount: phase === 'RESERVED' ? 2 : 0, counts: pubCounts,
        created: true, sealed: phase === 'PUBLISHED_READBACK_MATCHED', error: null,
        closeFailed: options.abortUncertain && phase === 'ABORTED' ? true : false, cleanupUncertain: false };
      options.snapshot?.(value); return value;
    },
    publish(bytes) {
      event('publish'); assert.equal(acceptedRoles, 1); assert.equal(bytes.at(-1), 10); assert.ok(bytes.every(b => b < 128));
      written = Buffer.from(bytes); pubCounts = publicationCounts(bytes.length);
      if (options.publishFailure) throw error(options.publishFailure);
      phase = 'PUBLISHED_READBACK_MATCHED';
      const fileMetadata = Object.fromEntries(Object.entries(stat(bytes.length, 200)).map(([key, n]) => [key, String(n)]));
      fileMetadata.mode = '33060';
      const record = { state: phase, part: PART, path: PATH, byteLength: bytes.length, sha256: sha(bytes), mode: '0444',
        readbackVerified: true, directorySynced: true, counts: pubCounts, fileMetadata,
        sourceRootAuthentication: false, ancestorRacesExcluded: false, atomicCrashCommit: false,
        storageFailureSurvival: false, hardDeadlineGuaranteed: false, nativeQualified: false, abiQualified: false, authenticatedStorage: false };
      options.record?.(record); return record;
    },
    abort() {
      event('abortWriter'); phase = 'ABORTED';
      if (options.writerAbortFailure) throw error('EIO');
      return { counts: pubCounts, closeFailed: options.abortUncertain ?? false, cleanupUncertain: false };
    },
  };
  const writer = {
    SPLIT_EVIDENCE_PARTS: [PART], SPLIT_EVIDENCE_PATHS: { [PART]: PATH }, SPLIT_EVIDENCE_PUBLICATION_LIMITS: old.writerLimits,
    reserveSplitEvidencePublication(part, guard) {
      assert.equal(part, PART); event('reserve'); guard();
      assert.equal(events.some(([name]) => name === 'archive'), false);
      if (options.exists) throw error('E_PUBLICATION_EXISTS');
      if (options.reserveCloseFailure) throw error('E_PUBLICATION_CLOSE');
      if (options.memory) return deliveredWriter.createSplitEvidencePublicationFixture({ mockOnly: true },
        { fs: options.memory.fs, guard }).reserveSplitEvidencePublication(PART);
      return publisher;
    },
  };
  const stage = {
    verifyStagedXzImages() {
      event('stage');
      if (options.stageFailure) throw error('E_METADATA');
      return { counters: { fsCalls: 80, readBytes: 2758216, closeAttempts: options.stageCloseFailure ? 4 : 5 } };
    },
    assertNoSystemPreload() { event('preload'); return !options.preload; },
  };
  const core = {
    GNU_SDK_DESCRIPTOR: old.descriptorFor(INPUT), GNU_SDK_LIMITS: old.coreLimits('gnu'),
    async runGnuSdkInventory(identity, deps) {
      event('archive'); assert.deepEqual(identity, INPUT.identity);
      await deps.beforeDecode();
      const d = '/tmp/opencode/f9-xz-qualification-01';
      const child = deps.spawn(d + '/ld-linux-x86-64.so.2', ['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', d,
        d + '/xz', '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=16777216', '--', '-'],
      { cwd: d, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      child.emit('spawn'); child.emit('close', options.childCode ?? 0, options.childSignal ?? null);
      await deps.afterDecode(); event('afterCore');
      if (options.coreFailure) throw error(options.coreFailure);
      const value = coreValue(); options.core?.(value); return value;
    },
  };
  const dependencies = { fs: io.backend, now: () => options.now ? options.now(clock) : clock,
    spawn() { event('spawn'); return new EventEmitter(); }, setTimeout() { assert.fail('no timer fallback'); }, clearTimeout() {},
    async moduleImporter(target) {
      imports.push(target); event('import', imports.length);
      if (target === uri(operationBytes)) return { splitToolchainEvidenceOperationSource: options.utilities ?? old };
      if (target === graph.collectorUri) return helper;
      if (target === graph.stageUri) return stage;
      if (target === graph.writerUri) return writer;
      if (target === graph.coreUri) return core;
      assert.fail('unregistered import');
    } };
  const fixture = createGnuPreparationEvidenceOperationFixture({ mockOnly: true }, dependencies);
  return { fixture, events, imports, io, dependencies, collector, publisher, setClock, get written() { return written; } };
}
async function run(options = {}) {
  const h = harness(options), output = await h.fixture.runRegisteredGnuPreparationEvidenceV1();
  assert.ok(Object.isFrozen(output)); assert.match(output.text, /^[\x00-\x7f]*\n$/); assert.ok(output.text.length <= 65536);
  return { h, output, receipt: JSON.parse(output.text) };
}
function stop(result, code) {
  assert.equal(result.output.exitCode, 1, result.output.text); assert.equal(result.receipt.status, 'STOP');
  assert.equal(result.receipt.publicationAccepted, false); assert.equal(result.receipt.realArchiveInspected, false);
  if (code) assert.equal(result.receipt.error, code, result.output.text);
  for (const key of ['collection', 'members', 'selected', 'headerLedger', 'text', 'preparation']) assert.equal(Object.hasOwn(result.receipt, key), false);
  for (const [key] of Object.entries(source.flags)) assert.equal(result.receipt[key], false);
}

test('all raw and eighteen private graph pins match before execution', () => {
  source.admitGraph(graph);
  assert.equal(Object.keys(graph.pins).length, 18);
  assert.deepEqual(graph.pins, source.graphPins);
  assert.deepEqual(source.acceptedRole(acceptedData, () => {}), accepted);
});

test('mock-only controller publishes complete evidence and compact receipt', async () => {
  const result = await run(); assert.equal(result.output.exitCode, 0, result.output.text);
  assert.equal(result.receipt.publicationAccepted, true); assert.equal(result.receipt.mockOnly, true);
  assert.equal(result.receipt.sourceContext, 'UNQUALIFIED');
  const data = JSON.parse(result.h.written);
  assert.equal(data.collection.roles[0].members.length, 8412); assert.equal(data.headerLedger.length, 150);
  assert.equal(data.selectedTextBytes, 12234); assert.equal(data.totalCapturedTextBytes, 21680);
  assert.equal(data.totalTextCaptures, 5); assert.equal(data.actualElfInspections, 0);
  for (const key of ['publicationAccepted', 'selfDigest', 'publicationCounts', 'postWriteCounts', 'publication']) assert.equal(Object.hasOwn(data, key), false);
  assert.equal(result.receipt.sha256, sha(result.h.written)); assert.equal(result.receipt.byteLength, result.h.written.length);
  for (const key of ['collection', 'headerLedger', 'selected']) assert.equal(Object.hasOwn(result.receipt, key), false);
  assert.deepEqual(data.includeFixedContext, { selectedREADMEOnly: true, admittedHeaders: 0, headersInferred: false, copyAuthorized: false });
  assert.equal(data.pluginSummary.regularFiles, 560); assert.equal(data.pluginSummary.bytes, 9731900); assert.equal(data.pluginSummary.admitted, false);
  for (const [key] of Object.entries(source.flags)) assert.equal(data[key], false);
});
test('mock collection validates against pinned accepted namespace', () => {
  source.validateCollection(collectionValue(), accepted);
});

test('fixed three target tuples use only raw distribution text', () => {
  assert.deepEqual(TARGETS.map(t => [t.index, t.bodyOffset, t.size, t.expectedSha256]), [
    [8379, 504808448, 750, '32baa94efdf4fb418c20321f14a1b66982a6cd3c2b5bc8fbfbe438f687c528d6'],
    [8391, 505059840, 10391, 'da71ea6f278ae7314e122fb382a8860b19e88252bc89a730eea2a7f8d3c95621'],
    [8412, 505326592, 1093, 'fa0b24cb67e660a5aebe2f4d4705b5a7ca2e5860e2e0405ddf6fddad40d4a41a']]);
  assert.equal(TARGETS.reduce((n, t) => n + t.size, 0), 12234);
  for (const t of TARGETS) {
    assert.equal(t.kind, 'PREPARATION_TEXT'); assert.equal(t.domain, 'DISTRIBUTION_DATA'); assert.equal(t.maxBytes, 16384);
    assert.equal(t.selectionRole, 'GNU_PREPARATION_CONTEXT_TEXT'); assert.equal(t.optionalForMinimalC, false); assert.ok(Object.isFrozen(t));
  }
});
test('classifier changes exactly one dispatch and preserves every other original byte', () => {
  const original = retained.get('collector').toString(), classified = graph.outputs.classifiedCollector.toString();
  assert.equal(original.split(source.dispatch).length - 1, 1);
  assert.equal(classified.replace(source.newDispatch, source.dispatch), original);
  assert.equal(classified.split(source.newDispatch).length - 1, 1);
  assert.equal(graph.outputs.appendedCollector.toString(), classified + source.collectorAppend);
  assert.ok(source.collectorAppend.startsWith('\n'));
  assert.doesNotMatch(source.collectorAppend, /PREPARATION_TEXT[^\n]*LINKER_TEXT|csvParser|eval\(|fetch\(/);
  assert.ok(original.indexOf('sha256 !== b.target.expectedSha256') < original.indexOf('const metadata = inspect(b.target'));
  assert.deepEqual(pin(retained.get('collector')), source.sourcePins.collector);
});
test('SDK, stage and core transforms retain exact static identities and shared collector binding', () => {
  assert.deepEqual(graph.pins.appendedSdk, { bytes: 31647, sha256: '22be684fb42feecbf6ac629f8e1fbf310bb31635325a9d1dc5a9e81fd75ee3b8' });
  assert.equal(graph.outputs.appendedSdk.toString(), retained.get('sdk').toString() + source.sdkAppend);
  assert.deepEqual(deliveredCore.GNU_SDK_DESCRIPTOR, old.descriptorFor(INPUT));
  assert.deepEqual(deliveredCore.GNU_SDK_LIMITS, old.coreLimits('gnu'));
  assert.ok(decode(graph.coreUri).includes("from '" + graph.collectorUri + "'"));
  assert.doesNotMatch(decode(graph.collectorUri), /from '\.\//);
  assert.match(decode(graph.coreUri), /SOURCE_GNU_TAR as createTarInventory/);
  assert.match(decode(graph.coreUri), /maxTotalMs: 120_000, cleanupMs: 3000/);
  assert.match(decode(graph.coreUri), /--memlimit-decompress=16777216/);
  assert.equal(graph.pins.linkedStage.sha256, '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2');
});
test('writer replaces exactly two declarations and closes its part and result path', () => {
  const text = graph.outputs.linkedWriter.toString();
  assert.deepEqual(deliveredWriter.SPLIT_EVIDENCE_PARTS, [PART]);
  assert.deepEqual(deliveredWriter.SPLIT_EVIDENCE_PATHS, { [PART]: PATH });
  const restored = text.replace("export const SPLIT_EVIDENCE_PARTS = Object.freeze(['gnu-preparation']);",
    "export const SPLIT_EVIDENCE_PARTS = Object.freeze(['gnu', 'rust']);")
    .replace("export const SPLIT_EVIDENCE_PATHS = Object.freeze({ 'gnu-preparation': '" + PATH + "' });",
      `export const SPLIT_EVIDENCE_PATHS = Object.freeze({\n  gnu: '${REPO}/_spec/tooling/native-ingress/gnu-evidence-collection-v1.result.json',\n  rust: '${REPO}/_spec/tooling/native-ingress/rust-evidence-collection-v1.result.json',\n});`);
  assert.equal(restored, retained.get('writer').toString());
});
test('fixed archive identities preserve independent file and directory devices', () => {
  assert.equal(INPUT.archiveBytes, 102296280); assert.equal(INPUT.decoderMemoryBytes, 16777216);
  assert.equal(Object.keys(INPUT.identity.file).length, 9); assert.equal(Object.keys(INPUT.identity.root).length, 9);
  assert.notEqual(INPUT.identity.root.dev, INPUT.identity.file.dev);
  assert.equal(INPUT.archiveSha256, 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3');
});
test('separate source/data ledgers retain exact bytes EOF positive closes and allocation caps', async () => {
  const { receipt, output, h } = await run(); assert.equal(output.exitCode, 0, output.text);
  const a = receipt.repoCapture, b = receipt.acceptedDataCapture;
  assert.deepEqual([a.completedCaptures, a.readBytes, a.requestedBytes, a.eofChecks, a.closeAttempts, a.closes], [15, 301950, 301965, 15, 15, 15]);
  assert.deepEqual([b.completedCaptures, b.readBytes, b.requestedBytes, b.eofChecks, b.closeAttempts, b.closes], [1, 2829942, 2829943, 1, 1, 1]);
  assert.equal(a.allocatedBytes, 301965); assert.equal(b.allocatedBytes, 2829943);
  assert.equal(a.peakOwnedFds, 1); assert.equal(b.peakOwnedFds, 1); assert.equal(h.io.fds.size, 0);
  assert.ok(a.fsCalls < 8192); assert.ok(b.fsCalls < 8192);
  assert.ok(h.io.calls.filter(([name]) => name === 'read').every(([, , length]) => length <= 65536));
  assert.ok(h.events.findIndex(([name]) => name === 'reserve') < h.events.findIndex(([name, key]) => name === 'sourceRead' && key === 'data'));
});
test('successful archive and staging accounting retains two passes and ten closes', async () => {
  const { receipt, output } = await run(); assert.equal(output.exitCode, 0, output.text);
  const c = receipt.collectionCounts;
  assert.deepEqual([c.archiveDataBytes, c.archiveRequestedBytes, c.archivePasses, c.archiveCloseAttempts], [204592560, 204592562, 2, 2]);
  assert.deepEqual([c.stageChecks, c.preloadChecks, c.stageReadBytes, c.stageCloses], [2, 2, 5516432, 10]);
  assert.deepEqual([c.spawnAttempts, c.spawnEvents, c.childCloses, c.ownedChildren, c.peakChildren], [1, 1, 1, 0, 1]);
});
test('one-shot production rejects any argument before I/O and consumes the entry', async () => {
  assert.equal(runRegisteredGnuPreparationEvidenceV1.length, 0);
  const first = await runRegisteredGnuPreparationEvidenceV1({ file: '/not-authorized' });
  assert.equal(JSON.parse(first.text).error, 'E_INPUT');
  assert.equal(JSON.parse((await runRegisteredGnuPreparationEvidenceV1()).text).error, 'E_INPUT');
});
test('mock latch rejects arguments and repeated in-flight attempts without second I/O', async () => {
  const h = harness(); const first = h.fixture.runRegisteredGnuPreparationEvidenceV1();
  assert.equal(JSON.parse((await h.fixture.runRegisteredGnuPreparationEvidenceV1()).text).error, 'E_INPUT');
  assert.equal((await first).exitCode, 0); assert.equal(h.events.filter(([name]) => name === 'archive').length, 1);
  const other = harness();
  assert.equal(JSON.parse((await other.fixture.runRegisteredGnuPreparationEvidenceV1(undefined)).text).error, 'E_INPUT');
  assert.equal(JSON.parse((await other.fixture.runRegisteredGnuPreparationEvidenceV1()).text).error, 'E_INPUT');
  assert.equal(other.io.calls.length, 0);
});
test('controller boots from a private data URI with no relative imports', async () => {
  assert.doesNotMatch(ownBytes.toString(), /import\.meta|^import .*from ['"]\.\.?\//m);
  const module = await import(uri(ownBytes));
  assert.equal(JSON.parse((await module.runRegisteredGnuPreparationEvidenceV1('reject')).text).error, 'E_INPUT');
  assert.equal(JSON.parse((await module.runRegisteredGnuPreparationEvidenceV1()).text).error, 'E_INPUT');
});
test('fixture requires all fake capabilities and rejects real FS methods', () => {
  const h = harness();
  throws(() => createGnuPreparationEvidenceOperationFixture({ mockOnly: false }, h.dependencies), 'E_INPUT');
  const missing = { ...h.dependencies }; delete missing.setTimeout;
  throws(() => createGnuPreparationEvidenceOperationFixture({ mockOnly: true }, missing), 'E_INPUT');
  throws(() => createGnuPreparationEvidenceOperationFixture({ mockOnly: true, inputs: [] }, h.dependencies), 'E_INPUT');
  throws(() => createGnuPreparationEvidenceOperationFixture({ mockOnly: true }, { ...h.dependencies,
    fs: { ...h.dependencies.fs, readSync: undefined } }), 'E_COMPONENT');
  throws(() => createGnuPreparationEvidenceOperationFixture({ mockOnly: true }, { ...h.dependencies,
    fs: { ...h.dependencies.fs, readSync } }), 'E_INPUT');
});
test('EEXIST stops before accepted-data reads or archive work without opening an old destination', async () => {
  const result = await run({ exists: true }); stop(result, 'E_PUBLICATION_EXISTS');
  assert.equal(result.receipt.collectionCounts.spawnAttempts, 0); assert.equal(result.receipt.acceptedDataCapture.openAttempts, 0);
  assert.equal(result.h.io.calls.some(([name, path]) => name === 'open' && path === PATH), false);
  assert.equal(result.h.events.some(([name]) => name === 'archive'), false);
});
test('reservation close failure remains explicitly uncertain before publisher assignment', async () => {
  const result = await run({ reserveCloseFailure: true }); stop(result, 'E_PUBLICATION_CLOSE');
  assert.equal(result.receipt.publicationReservationUncertain, true); assert.equal(result.receipt.abortUncertain, true);
  assert.equal(result.receipt.acceptedDataCapture.openAttempts, 0);
});
for (const [name, options, code] of [
  ['source hash', { corrupt: 'rawTar' }, 'E_SOURCE_PIN'], ['operation hash', { corrupt: 'operation' }, 'E_SOURCE_PIN'],
  ['accepted data hash', { corrupt: 'data' }, 'E_SOURCE_PIN'], ['source EOF', { extraEof: 'collector' }, 'E_LENGTH'],
  ['data EOF', { extraEof: 'data' }, 'E_LENGTH'], ['source short read', { shortRead: 'rawCore' }, 'E_LENGTH'],
  ['data short read', { shortRead: 'data' }, 'E_LENGTH'], ['source read failure', { readFailure: 'elfV3' }, 'E_IO'],
  ['source open failure', { openFailure: 'rawCore' }, 'E_IO'], ['source positive close', { closeFailure: 'writer' }, 'E_CLOSE'],
  ['data positive close', { closeFailure: 'data' }, 'E_CLOSE'],
]) test(name + ' failure withholds all evidence and retains attempt/completion distinction', async () => {
  const result = await run({ source: options }); stop(result, code);
  assert.equal(result.h.events.some(([event]) => event === 'archive'), false);
  assert.equal(result.h.io.fds.size, 0);
  if (options.corrupt === 'operation') assert.equal(result.h.imports.length, 0);
  if (options.closeFailure === 'writer') {
    assert.equal(result.receipt.repoCapture.closeAttempts, 10); assert.equal(result.receipt.repoCapture.closes, 9);
  }
  if (options.closeFailure === 'data') assert.equal(result.receipt.acceptedDataCapture.closes, 0);
});
test('all nine source binding fields are checked before and after reads', async () => {
  for (const field of source.fields) {
    const result = await run({ source: { fdStat(value, key) { if (key === 'operation') value[field]++; return value; } } });
    stop(result); assert.equal(result.h.io.fds.size, 0); assert.equal(result.h.imports.length, 0);
  }
});
test('nonregular named sources fail before open and allocation', async () => {
  const result = await run({ source: { stat(value, key) { if (key === 'operation') value.mode = 0o120600n; return value; } } });
  stop(result, 'E_METADATA'); assert.equal(result.receipt.repoCapture.openAttempts, 0); assert.equal(result.receipt.repoCapture.allocations, 0);
});
test('renamed source binding after read fails despite unchanged body hash', async () => {
  let named = 0;
  const result = await run({ source: { stat(value, key) { if (key === 'operation' && ++named === 2) value.ino++; return value; } } });
  stop(result, 'E_BINDING'); assert.equal(result.h.imports.length, 0);
});
test('data over four MiB rejects before allocation or any filesystem operation', () => {
  const counts = source.captureCounts(), h = sourceFs();
  throws(() => source.capture(source.dataPath, { bytes: 4194304, sha256: '0'.repeat(64) }, h.backend, counts, 4194304, () => {}), 'E_LIMIT');
  assert.equal(counts.allocations, 0); assert.equal(h.calls.length, 0);
});
test('one MiB source allocation budget never resets between captures', () => {
  const counts = source.captureCounts(), h = sourceFs();
  counts.allocatedBytes = 1048576 - operationBytes.length;
  throws(() => source.capture(source.operationPath, source.operationPin, h.backend, counts, 1048576, () => {}), 'E_LIMIT');
  assert.equal(counts.allocations, 0); assert.equal(h.calls.length, 0);
});
test('unexpected old utility source row rejects before source graph acquisition', async () => {
  const result = await run({ utilities: { ...old, rows: [...old.rows.slice(0, -1), ['unexpected', '/untrusted']] } });
  stop(result, 'E_COLLECTION'); assert.equal(result.receipt.repoCapture.completedCaptures, 1);
});
test('mutated private transformation fails its hard pin before helper import', async () => {
  const result = await run({ utilities: { ...old, transformTar(bytes) { const value = Buffer.from(old.transformTar(bytes)); value[0] ^= 1; return value; } } });
  stop(result, 'E_SOURCE_PIN'); assert.equal(result.h.imports.length, 1);
});
test('all 150 header ledger rows exactly bind accepted path index span and body hash', () => {
  const ledger = source.headerLedger(accepted, accepted);
  const originals = accepted.members.filter(m => m.type === 'file' && m.path.startsWith(source.headerPrefix));
  assert.equal(ledger.length, 150); assert.equal(ledger.reduce((n, m) => n + m.size, 0), 2907751);
  ledger.forEach((row, i) => {
    const member = originals[i];
    for (const key of ['index', 'path', 'bodyOffset', 'size', 'bodySha256']) assert.equal(row[key], member[key]);
    assert.equal(row.proposedRelativeDestination, 'gnu/' + member.path.slice(INPUT.expectedRoot.length + 1));
    assert.equal(row.copyAuthorized, false); assert.equal(row.includeClosureVerified, false); assert.equal(row.domain, 'TARGET');
    assert.equal(row.disposition, 'C_HEADER_CANDIDATE');
  });
  assert.deepEqual([ledger[0].index, ledger[0].bodyOffset, ledger[0].size, ledger[0].bodySha256],
    [8223, 500496384, 18212, 'ae12fbc1021c07745a9137ce21d5750c1bb3eece2d9d85ae6e4be9eee66237d0']);
  assert.ok(ledger[0].path.endsWith('/avx10_2-512convertintrin.h'));
  assert.deepEqual([ledger[149].index, ledger[149].bodyOffset, ledger[149].size, ledger[149].bodySha256],
    [8373, 503549952, 2348, 'a62edac6e530ae4e5ab300b127fd51740ef944bf9f4bf12d6566f9c17a9805c8']);
  assert.ok(ledger[149].path.endsWith('/movdirintrin.h'));
  assert.ok(ledger.every(m => !m.path.includes('/include-fixed/') && !m.path.includes('/plugin/')));
});
for (const field of ['path', 'index', 'bodyOffset', 'size', 'bodySha256']) test('same-count 150-header mutation rejects changed ' + field, async () => {
  const result = await run({ collection(value) {
    const rows = value.roles[0].members.filter(m => m.type === 'file' && m.path.startsWith(source.headerPrefix));
    if (field === 'path') rows[0].path += '.different';
    else if (field === 'bodySha256') rows[0][field] = '0'.repeat(64);
    else { rows[0][field]++; rows[1][field]--; }
    assert.equal(rows.length, 150);
  } }); stop(result, 'E_COLLECTION');
  assert.equal(result.h.written, null);
});
test('unselected regular member body mismatch rejects despite exact selected targets', async () => {
  const result = await run({ collection(value) {
    value.roles[0].members.find(m => m.type === 'file' && !TARGETS.some(t => t.path === m.path)).bodySha256 = '0'.repeat(64);
  } }); stop(result, 'E_COLLECTION');
});
for (const [name, change] of [
  ['decoded hash', v => { v.roles[0].decodedSha256 = '0'.repeat(64); }],
  ['legacy hash', v => { v.roles[0].legacyMetadataSha256 = '0'.repeat(64); }],
  ['offset hash', v => { v.roles[0].offsetMetadataSha256 = '0'.repeat(64); }],
  ['distribution domain', v => { v.roles[0].selected[0].domain = 'TARGET'; }],
  ['raw text kind', v => { v.roles[0].selected[1].kind = 'LINKER_TEXT'; }],
  ['raw text controls', v => { v.roles[0].selected[0].metadata.observation.text = '\0' + 'x'.repeat(749); }],
  ['raw text URL flag', v => { v.roles[0].selected[0].metadata.observation.urlsFollowed = true; }],
  ['raw text interpretation', v => { v.roles[0].selected[0].metadata.observation.interpreted = true; }],
  ['extra selected target', v => { v.roles[0].selected.push(v.roles[0].selected[0]); }],
  ['buffer erasure', v => { v.resourceAccounting.buffersErased = 4; }],
  ['five-buffer accounting', v => { v.resourceAccounting.buffersAllocated = 3; }],
  ['payload peak', v => { v.resourceAccounting.peakPayloadBytes = 16384; }],
  ['license authority', v => { v.licenseComplianceVerified = true; }],
  ['ELF authority', v => { v.nativeQualified = true; }],
]) test('late ' + name + ' failure withholds every text and header record', async () => {
  const result = await run({ collection: change }); stop(result); assert.equal(result.h.written, null);
  assert.ok(result.h.events.some(([name]) => name === 'abortWriter')); assert.ok(result.h.events.some(([name]) => name === 'abortCollector'));
});
for (const [name, change] of [
  ['compressed SHA', v => { v.archiveSha256 = '0'.repeat(64); }], ['compressed EOF', v => { v.archiveRequestedBytes--; }],
  ['archive positive close', v => { v.closeAttempts--; }], ['stdin', v => { v.stdinFinished = false; }],
  ['stdout', v => { v.stdoutEnded = false; }], ['stderr', v => { v.stderrEnded = false; }],
  ['child result', v => { v.exitCode = 1; }], ['core TAR offset', v => { v.inventory.metadataSha256 = '0'.repeat(64); }],
]) test('late ' + name + ' receipt failure never accepts provisional collection', async () => {
  const result = await run({ core: change }); stop(result, 'E_RECEIPT'); assert.equal(result.h.written, null);
  assert.equal(result.h.events.some(([name]) => name === 'accept'), false);
});
for (const [name, options, code] of [
  ['compressed hash exception', { coreFailure: 'E_HASH' }, 'E_HASH'],
  ['nonzero child close', { childCode: 1 }, 'E_RECEIPT'], ['signaled child', { childSignal: 'SIGTERM' }, 'E_RECEIPT'],
  ['staged identity', { stageFailure: true }, 'E_METADATA'], ['staged closes', { stageCloseFailure: true }, 'E_RECEIPT'],
  ['preload', { preload: true }, 'E_PRELOAD'], ['collector acceptance', { acceptFailure: 'E_EVIDENCE_CORE' }, 'E_EVIDENCE_CORE'],
]) test(name + ' failure always aborts publisher and collector', async () => {
  const result = await run(options); stop(result, code);
  assert.ok(result.h.events.some(([name]) => name === 'abortWriter')); assert.ok(result.h.events.some(([name]) => name === 'abortCollector'));
});
test('failed core accounting states unknown bytes instead of claiming zero-I/O', async () => {
  const result = await run({ coreFailure: 'E_HASH' }); stop(result, 'E_HASH');
  assert.equal(result.receipt.archiveAccountingComplete, false);
  assert.match(result.receipt.archiveCountersScope, /failed-pass bytes remain unaccounted, not zero/);
});
test('failure diagnostic exposes no provisional target or arbitrary source string', async () => {
  const result = await run({ acceptFailure: 'E_EVIDENCE_INSPECT', diagnostic: { code: 'E_EVIDENCE_INSPECT',
    role: 'gnu-sdk', path: '/private/SECRET', kind: 'PREPARATION_TEXT', index: 8379, underlyingCode: 'SECRET' } });
  stop(result, 'E_EVIDENCE_INSPECT');
  assert.deepEqual(result.receipt.diagnostic, { code: 'E_EVIDENCE_INSPECT', role: 'gnu-sdk', path: null, kind: null, index: null, underlyingCode: null });
  assert.doesNotMatch(result.output.text, /SECRET/);
});
test('raw text preserves UTF-8 BOM and permits only TAB LF CR among controls', () => {
  const bytes = Buffer.from('\ufeffa\tβ\n\r');
  assert.deepEqual(source.inspectPreparationText(bytes), { state: 'GNU_PREPARATION_RAW_TEXT_DATA', text: '\ufeffa\tβ\n\r', interpreted: false, urlsFollowed: false });
  for (let c = 0; c <= 0x9f; c++) if (c < 32 && ![9, 10, 13].includes(c) || c >= 127) {
    throws(() => source.inspectPreparationText(Buffer.from(String.fromCharCode(c))), 'E_INPUT');
  }
});
test('raw text rejects invalid UTF-8 and enforces exact 16-KiB byte boundary', () => {
  for (const bytes of [Buffer.from([0xff]), Buffer.from([0xc0, 0x80]), Buffer.from([0xe2, 0x82])]) throws(() => source.inspectPreparationText(bytes), 'E_INPUT');
  assert.equal(source.inspectPreparationText(Buffer.alloc(16384, 97)).text.length, 16384);
  throws(() => source.inspectPreparationText(Buffer.alloc(16385, 97)), 'E_INPUT');
  assert.equal(source.inspectPreparationText(Buffer.from('β'.repeat(8192))).text.length, 8192);
  throws(() => source.inspectPreparationText(Buffer.from('β'.repeat(8193))), 'E_INPUT');
});
test('CSV shell URL and license-looking content remain inert raw observations', () => {
  const text = 'a,b\n"$(touch /never)",https://invalid.example/\nSPDX-License-Identifier: UNKNOWN\n';
  const result = source.inspectPreparationText(Buffer.from(text));
  assert.deepEqual(Object.keys(result), ['state', 'text', 'interpreted', 'urlsFollowed']);
  assert.equal(result.text, text); assert.equal(result.interpreted, false); assert.equal(result.urlsFollowed, false);
});
test('ASCII serializer charges six bytes per non-ASCII code unit and final LF', () => {
  const text = source.safeJson({ text: 'β\ufeff😀' }, 65536);
  assert.equal(text, '{"text":"\\u03b2\\ufeff\\ud83d\\ude00"}\n');
  throws(() => source.safeJson({ text: 'β'.repeat(10923) }, 65536), 'E_OUTPUT');
  const hostile = {}; Object.defineProperty(hostile, 'text', { enumerable: true, get() { assert.fail('getter evaluated'); } });
  throws(() => source.safeJson(hostile, 65536), 'E_OUTPUT');
  throws(() => source.safeJson(new Proxy({}, {}), 65536), 'E_OUTPUT');
});
test('fixed clocks preserve outer source role work cleanup publication and admission budgets', () => {
  assert.deepEqual([LIMITS.totalMs, LIMITS.sourceMs, LIMITS.roleMs, LIMITS.workMs, LIMITS.cleanupMs, LIMITS.publicationMs, LIMITS.admissionMs],
    [300000, 10000, 120000, 117000, 3000, 30000, 150000]);
  assert.equal(LIMITS.targetBytes, 16384); assert.equal(LIMITS.aggregateSelectedBytes, 49152);
  assert.match(retained.get('rawCore').toString(), /workDeadline = totalDeadline - limits\.cleanupMs/);
});
for (const [name, eventName, value, deadline] of [
  ['source', 'sourceOpen', 10000, 'E_DEADLINE'], ['role', 'archive', 120000, 'E_DEADLINE'],
  ['publication', 'finish', 30000, 'E_DEADLINE'], ['outer', 'publish', 300000, 'E_DEADLINE'],
]) test(name + ' clock expiration withholds text and still performs cleanup', async () => {
  const result = await run({ event(name, _, setClock) { if (name === eventName) setClock(value); } }); stop(result, deadline);
  if (eventName !== 'sourceOpen') {
    assert.ok(result.h.events.some(([name]) => name === 'abortWriter')); assert.ok(result.h.events.some(([name]) => name === 'abortCollector'));
  }
});
test('admission refuses less than 150 seconds remaining without spawning', async () => {
  const result = await run({ event(name, _, setClock) { if (name === 'begin') setClock(150001); } });
  stop(result, 'E_DEADLINE'); assert.equal(result.receipt.collectionCounts.spawnAttempts, 0);
});
test('clock regression rejects and cleanup does not consult the expired guard', async () => {
  const result = await run({ event(name, _, setClock) { if (name === 'archive') setClock(-1); } });
  stop(result, 'E_CLOCK'); assert.ok(result.h.events.some(([name]) => name === 'abortCollector'));
});
for (const [name, change] of [
  ['readback hash', r => { r.sha256 = '0'.repeat(64); }], ['wrong result path', r => { r.path = source.dataPath; }],
  ['wrong part', r => { r.part = 'gnu'; }], ['unsealed mode', r => { r.mode = '0600'; }],
  ['positive publication close', r => { r.counts.closes = 2; }], ['directory fsync', r => { r.counts.fsyncs = 3; }],
  ['EOF request', r => { r.counts.requestedReadBytes = r.byteLength; }], ['read request budget', r => { r.counts.requestedReadBytes = 16777218; }],
]) test('publication ' + name + ' failure keeps file unaccepted and withholds all body data', async () => {
  const result = await run({ record: change }); stop(result, 'E_PUBLICATION_RECORD'); assert.ok(result.h.written);
  assert.ok(result.h.events.some(([name]) => name === 'abortWriter')); assert.ok(result.h.events.some(([name]) => name === 'abortCollector'));
});
test('publication close uncertainty dominates and collector cleanup still runs', async () => {
  const result = await run({ publishFailure: 'E_PUBLICATION_CLOSE', abortUncertain: true });
  stop(result, 'E_PUBLICATION_CLOSE'); assert.equal(result.receipt.abortUncertain, true);
  assert.ok(result.h.events.some(([name]) => name === 'abortCollector'));
});
test('publisher abort failure cannot skip collector abort', async () => {
  const result = await run({ publishFailure: 'E_PUBLICATION_HASH', writerAbortFailure: true });
  stop(result, 'E_PUBLICATION_ABORT'); assert.equal(result.receipt.abortUncertain, true);
  assert.ok(result.h.events.some(([name]) => name === 'abortCollector'));
  const abort = result.h.events.findIndex(([name]) => name === 'abortWriter');
  assert.equal(result.h.events[abort + 1][0], 'publicationSnapshot');
});

function publicationMemory(options = {}) {
  const directory = REPO + '/_spec/tooling/native-ingress';
  const directories = [REPO, REPO + '/_spec', REPO + '/_spec/tooling', directory];
  const nodes = new Map(directories.map((path, i) => [path, { ...stat(4096, 100 + i, true), data: Buffer.alloc(0) }]));
  const fds = new Map(), calls = []; let next = 100;
  const copy = value => Object.fromEntries(source.fields.map(key => [key, value[key]]));
  const methods = {
    lstatSync(path) { if (!nodes.has(path)) throw error('ENOENT'); return copy(nodes.get(path)); },
    fstatSync(fd) { assert.ok(fds.has(fd)); return copy(fds.get(fd)); },
    openSync(path, flags, mode) {
      assert.ok(flags & constants.O_NOFOLLOW); assert.ok(flags & constants.O_NONBLOCK);
      if (flags & constants.O_CREAT) {
        assert.equal(path, PATH); assert.equal(mode, 0o600); assert.ok(flags & constants.O_EXCL);
        if (nodes.has(path)) throw error('EEXIST');
        nodes.set(path, { ...stat(0, 300), data: Buffer.alloc(0) });
        nodes.get(directory).mtimeNs++; nodes.get(directory).ctimeNs++;
      }
      assert.ok(nodes.has(path)); const fd = next++; fds.set(fd, nodes.get(path)); return fd;
    },
    fsyncSync(fd) { assert.ok(fds.has(fd)); },
    fchmodSync(fd, mode) { assert.equal(mode, 0o444); fds.get(fd).mode = 0o100444n; fds.get(fd).ctimeNs++; },
    writeSync(fd, bytes, offset, length, position) {
      const value = fds.get(fd); assert.ok(value);
      const data = Buffer.alloc(Math.max(value.data.length, position + length));
      value.data.copy(data); bytes.copy(data, position, offset, offset + length); value.data = data; value.size = BigInt(data.length);
      value.mtimeNs++; value.ctimeNs++; return length;
    },
    readSync(fd, bytes, offset, length, position) {
      const value = fds.get(fd); assert.ok(value);
      const amount = Math.min(length, options.readCap ?? Infinity, Math.max(0, value.data.length - position));
      value.data.copy(bytes, offset, position, position + amount);
      if (options.corruptRead && amount) bytes[offset] ^= 1;
      if (options.extraEof && !amount) return 1;
      return amount;
    },
    closeSync(fd) { assert.ok(fds.has(fd)); fds.delete(fd); if (options.closeFailure) throw error('EIO'); },
  };
  const backend = Object.fromEntries(Object.entries(methods).map(([name, method]) => [name, (...args) => {
    calls.push([name, args]); options.before?.(name, args); return method(...args);
  }]));
  return { fs: backend, nodes, fds, calls, file: () => nodes.get(PATH) };
}
test('delivered pinned writer reserves O_EXCL0600 seals0444 reads EOF and closes three descriptors positively', () => {
  const memory = publicationMemory({ readCap: 7 });
  const publisher = deliveredWriter.createSplitEvidencePublicationFixture({ mockOnly: true }, { fs: memory.fs, guard() {} })
    .reserveSplitEvidencePublication(PART);
  assert.equal(publisher.snapshot().ownedFDCount, 2); assert.equal(memory.file().mode, 0o100600n);
  const bytes = Buffer.from('{"raw":"data only","qualified":false}\n');
  const record = publisher.publish(bytes);
  source.validatePublication(record, publisher.snapshot(), bytes.length, sha(bytes));
  assert.equal(record.counts.closes, 3); assert.equal(record.counts.fsyncs, 4); assert.equal(memory.fds.size, 0);
  assert.ok(record.counts.requestedReadBytes > bytes.length + 1); assert.ok(record.counts.requestedReadBytes <= 16777217);
  assert.equal(record.counts.readbackBytes, bytes.length); assert.equal(record.counts.readbackHashBytes, bytes.length);
  assert.equal(memory.file().mode, 0o100444n); assert.deepEqual(memory.file().data, bytes);
});
test('full mock controller accepts the delivered writer with partial-read request range', async () => {
  const memory = publicationMemory({ readCap: 32768 });
  const result = await run({ memory }); assert.equal(result.output.exitCode, 0, result.output.text);
  assert.equal(result.receipt.sha256, sha(memory.file().data)); assert.equal(result.receipt.byteLength, memory.file().data.length);
  assert.equal(result.receipt.publicationAccepted, true); assert.ok(result.receipt.publicationCounts.requestedReadBytes > memory.file().data.length + 1);
  assert.equal(memory.fds.size, 0); assert.equal(memory.file().mode, 0o100444n);
  assert.equal(JSON.parse(memory.file().data).headerLedger.length, 150);
});
for (const [name, options, code] of [
  ['readback bytes', { corruptRead: true }, 'E_PUBLICATION_HASH'],
  ['readback EOF', { extraEof: true }, 'E_PUBLICATION_EOF'],
  ['positive close', { closeFailure: true }, 'E_PUBLICATION_CLOSE'],
]) test('delivered writer ' + name + ' failure retains an unaccepted file without fallback', async () => {
  const memory = publicationMemory(options), result = await run({ memory }); stop(result, code);
  assert.ok(memory.file()); assert.ok(memory.file().data.length > 0);
  assert.ok(result.h.events.some(([name]) => name === 'abortCollector'));
});
test('delivered writer EEXIST never opens existing result content', async () => {
  const memory = publicationMemory();
  memory.nodes.set(PATH, { ...stat(4, 400), data: Buffer.from('KEEP') });
  const result = await run({ memory }); stop(result, 'E_PUBLICATION_EXISTS');
  assert.equal(result.receipt.acceptedDataCapture.openAttempts, 0); assert.equal(result.receipt.collectionCounts.spawnAttempts, 0);
  assert.equal(memory.file().data.toString(), 'KEEP');
  assert.equal(memory.calls.some(([name]) => name === 'readSync'), false);
  assert.equal(memory.fds.size, 0);
});

function tarHeader(path, size = 0, type = '0', link = '') {
  const bytes = Buffer.alloc(512), slash = path.lastIndexOf('/');
  if (Buffer.byteLength(path) > 100) { bytes.write(path.slice(slash + 1), 0, 100); bytes.write(path.slice(0, slash), 345, 155); }
  else bytes.write(path, 0, 100);
  for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, size], [136, 12, 0]]) {
    bytes.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  }
  bytes[156] = type.charCodeAt(0); bytes.write(link, 157, 100); bytes.write('ustar\0', 257, 6); bytes.write('00', 263, 2); bytes.fill(32, 148, 156);
  bytes.write(bytes.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0') + '\0 ', 148, 8); return bytes;
}
function legacyEvent(event) {
  const result = { index: event.index, path: event.path, type: event.type, size: event.size };
  if (['hardlink', 'symlink'].includes(event.type)) { result.linkpath = event.linkpath; result.linkKind = event.linkKind; }
  return { ...result, mode: event.mode, uid: event.uid, gid: event.gid, mtime: event.mtime };
}
const syntheticCollector = await import(uri(Buffer.concat([graph.outputs.linkedCollector, Buffer.from(`
export const TEST_PREPARATION_PROFILE = SOURCE_PREPARATION_PROFILE;
export function TEST_CREATE_MOCK_PREPARATION(profile) {
  return collector(profile, { parserFactory: originalCreateTarInventory,
    elfInspector() { throw new Error('NO_TARGET_ELF_INSPECTION'); },
    formatInspectors: { ...SOURCE_FORMAT_INSPECTORS, text: inspectPreparationText } });
}
`)])));
function syntheticPreparation(options = {}) {
  const root = INPUT.expectedRoot, chunks = [], bodies = new Map();
  const add = (path, body = Buffer.alloc(0), type = '0', link = '') => {
    chunks.push(Buffer.concat([tarHeader(path, body.length, type, link), body, Buffer.alloc((512 - body.length % 512) % 512)]));
    if (type === '0') bodies.set(path, body);
  };
  add(root, Buffer.alloc(0), '5');
  add(root + '/share/buildroot/sdk-relocs', Buffer.from('$(NEVER_EVALUATED) https://invalid.example/\n'));
  add(root + '/share/buildroot/sdk-location', Buffer.from('/fixture/raw-origin\n'));
  add(root + '/alias', Buffer.alloc(0), '2', '../literal-only');
  add(root + '/unselected/header.h', Buffer.from('UNRETAINED_BODY_DATA\n'));
  const selectedBodies = [Buffer.from('\ufeffREADME β\n'), Buffer.from('key,value\n"$(ignored)",https://invalid.example/\n'), Buffer.from('RAW DATA\n')];
  if (options.invalidUtf8) selectedBodies[0] = Buffer.from([0xff]);
  if (options.control) selectedBodies[0] = Buffer.from('raw\0data');
  if (options.oversize) selectedBodies[0] = Buffer.alloc(16385, 97);
  for (const [i, target] of TARGETS.entries()) add(target.path, selectedBodies[i]);
  const bytes = Buffer.concat([...chunks, Buffer.alloc(1024)]), parser = deliveredTar.createTarInventory(), events = [];
  for (let at = 0; at < bytes.length; at += 65536) events.push(...parser.feed(bytes.subarray(at, at + 65536)));
  const inventory = parser.finish();
  const targets = TARGETS.map(target => {
    const event = events.find(e => e.path === target.path);
    return { ...target, index: event.index, bodyOffset: event.bodyOffset, size: event.size, expectedSha256: sha(bodies.get(target.path)) };
  });
  if (options.wrongBodyHash) targets[0].expectedSha256 = '0'.repeat(64);
  const expected = { ...source.expected, expandedBytes: bytes.length, entries: events.length, headers: inventory.headers,
    regularFiles: events.filter(e => e.type === 'file').length, decodedSha256: sha(bytes),
    metadataSha256: sha(events.map(e => JSON.stringify(legacyEvent(e)) + '\n').join('')) };
  if (options.wrongDecodedHash) expected.decodedSha256 = '0'.repeat(64);
  if (options.wrongLegacyHash) expected.metadataSha256 = '0'.repeat(64);
  const input = { ...INPUT, root: '/fixture/preparation', file: '/fixture/preparation/' + root + '.tar.xz',
    archiveBytes: 3, archiveSha256: sha('mock compressed input') };
  const profile = { part: 'gnu', mockOnly: true, inputs: [input], expectations: [expected], targets,
    limits: { ...old.collectorLimits, maxPayloadBytes: 16384, maxElfSnapshotBytes: 16384 } };
  const batch = syntheticCollector.TEST_CREATE_MOCK_PREPARATION(profile);
  batch.beginToolchainEvidenceBatch(); batch.beginToolchainEvidenceRole('gnu-sdk');
  const sink = batch.createTarInventory();
  return { bytes, batch, sink, input, targets, expected, bodies };
}
function finishSynthetic(value) {
  for (let at = 0; at < value.bytes.length; at += 65536) value.sink.feed(value.bytes.subarray(at, at + 65536));
  const inventory = value.sink.finish(), core = { ...coreValue(), mockOnly: true, inventory,
    archiveBytes: value.input.archiveBytes, archiveSha256: value.input.archiveSha256,
    archiveDataBytes: 6, archiveRequestedBytes: 8, expandedBytes: value.bytes.length };
  value.batch.acceptToolchainEvidenceRole(core); return value.batch.finishToolchainEvidenceBatch();
}
test('delivered private classifier hashes every synthetic regular member and dispatches raw text without ELF inspection', () => {
  const value = syntheticPreparation(), result = finishSynthetic(value);
  assert.equal(result.mockOnly, true); assert.equal(result.selectedPayloads, 3); assert.equal(result.completeNamespace, true);
  const role = result.roles[0];
  assert.equal(role.members.filter(m => m.type === 'file').length, value.bodies.size);
  for (const member of role.members) {
    if (member.type === 'file') assert.equal(member.bodySha256, sha(value.bodies.get(member.path)));
    else { assert.equal(member.bodySha256, null); assert.equal(member.linkFollowed, false); }
  }
  role.selected.forEach((selected, i) => {
    assert.equal(selected.kind, 'PREPARATION_TEXT'); assert.equal(selected.domain, 'DISTRIBUTION_DATA');
    assert.equal(selected.metadata.state, 'SOURCE_FORMAT_DATA'); assert.equal(selected.metadata.qualified, false);
    assert.deepEqual(selected.metadata.observation, source.inspectPreparationText(value.bodies.get(value.targets[i].path)));
  });
  assert.equal(result.resourceAccounting.buffersAllocated, 5); assert.equal(result.resourceAccounting.buffersErased, 5);
  assert.equal(result.resourceAccounting.maxAdditionalElfSnapshotBytes, 16384);
  assert.equal(role.manifests.length, 2); assert.ok(role.manifests.every(m => m.interpreted === false));
  assert.ok(Object.isFrozen(role.selected[0].metadata.observation));
});
test('private preparation profile lowers only payload and ELF snapshot policy and preserves GNU controls', () => {
  const profile = syntheticCollector.TEST_PREPARATION_PROFILE;
  assert.deepEqual(profile.targets, TARGETS); assert.deepEqual(profile.inputs, [INPUT]);
  assert.deepEqual(profile.expectations, [source.expected]); assert.equal(profile.mockOnly, false); assert.equal(profile.part, 'gnu');
  assert.deepEqual(Object.keys(profile.limits).filter(key => profile.limits[key] !== old.collectorLimits[key]).sort(),
    ['maxElfSnapshotBytes', 'maxPayloadBytes']);
  assert.equal(profile.limits.maxPayloadBytes, 16384); assert.equal(profile.limits.maxElfSnapshotBytes, 16384);
  assert.equal(profile.limits.maxManifestBytes, 1048576); assert.equal(profile.limits.maxAggregatePayloadBytes, 805306368);
  assert.match(retained.get('collector').toString(), /const SDK_RELOCS_SHA256 = '60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e'/);
  assert.match(retained.get('collector').toString(), /const SDK_RELOCS_BYTES = 9367/);
});
test('delivered collector checks selected file SHA before attempting invalid UTF-8 decode', () => {
  const value = syntheticPreparation({ invalidUtf8: true, wrongBodyHash: true });
  throws(() => finishSynthetic(value), 'E_EVIDENCE_BODY_HASH');
  const failure = value.batch.getToolchainEvidenceFailure();
  assert.equal(failure.role, 'gnu-sdk'); assert.equal(failure.path, null); assert.equal(failure.kind, null); assert.equal(failure.index, null);
  const state = value.batch.snapshotToolchainEvidenceBatch();
  assert.equal(state.activeBufferBytes, 0); assert.equal(state.activeBodyHashes, 0);
  assert.equal(state.state, 'FAILED'); value.batch.abortToolchainEvidenceBatch();
});
for (const [name, options, code] of [
  ['invalid raw UTF-8', { invalidUtf8: true }, 'E_EVIDENCE_INSPECT'],
  ['forbidden raw controls', { control: true }, 'E_EVIDENCE_INSPECT'],
  ['16-KiB target bound', { oversize: true }, 'E_EVIDENCE_LIMIT'],
  ['decoded stream hash', { wrongDecodedHash: true }, 'E_EVIDENCE_DECODED_HASH'],
  ['legacy metadata hash', { wrongLegacyHash: true }, 'E_EVIDENCE_METADATA_HASH'],
]) test('delivered collector rejects ' + name + ' and releases provisional bodies', () => {
  const value = syntheticPreparation(options); throws(() => finishSynthetic(value), code);
  const state = value.batch.snapshotToolchainEvidenceBatch();
  assert.equal(state.activeBufferBytes, 0); assert.equal(state.activeBodyHashes, 0);
  throws(() => value.batch.finishToolchainEvidenceBatch(), 'E_EVIDENCE_STATE'); value.batch.abortToolchainEvidenceBatch();
});
let deliveredBatch;
test('private zero-argument production collector has one instance and frozen controls', () => {
  assert.equal(deliveredHelper.SOURCE_CREATE_GNU_PREPARATION.length, 0);
  const batch = deliveredHelper.SOURCE_CREATE_GNU_PREPARATION(); deliveredBatch = batch; assert.ok(Object.isFrozen(batch));
  throws(() => deliveredHelper.SOURCE_CREATE_GNU_PREPARATION(), 'E_EVIDENCE_STATE');
  batch.beginToolchainEvidenceBatch(); batch.beginToolchainEvidenceRole('gnu-sdk');
  assert.ok(Object.isFrozen(batch.snapshotToolchainEvidenceBatch()));
});
test('delivered unchanged GNU core stops at117s and positively closes fake archive descriptors before any decoder', async () => {
  const archive = Buffer.from('mock compressed input'), owned = new Set(), closed = [], scheduled = [];
  let clock = 0, spawned = false;
  const descriptor = deliveredCore.GNU_SDK_DESCRIPTOR, values = { root: stat(4096, 501, true), file: stat(archive.length, 502) };
  const identity = Object.fromEntries(Object.entries(values).map(([key, value]) =>
    [key, Object.fromEntries(Object.entries(value).map(([field, n]) => [field, String(n)]))]));
  const kind = target => target === descriptor.root || target === 501 ? 'root' :
    target === descriptor.file || target === 502 ? 'file' : assert.fail('unexpected fake core path');
  const backend = {
    lstatSync(path) { return { ...values[kind(path)] }; },
    fstatSync(fd) { assert.ok(owned.has(fd)); return { ...values[kind(fd)] }; },
    openSync(path) { const fd = kind(path) === 'root' ? 501 : 502; assert.equal(owned.has(fd), false); owned.add(fd); return fd; },
    readSync(fd, bytes, offset, length, position) { assert.equal(fd, 502); const amount = archive.copy(bytes, offset, position, position + length); clock = 117000; return amount; },
    closeSync(fd) { assert.ok(owned.delete(fd)); closed.push(fd); },
  };
  const runner = deliveredCore.createSdkInventoryFixtureRunner({ archiveBytes: archive.length, archiveSha256: sha(archive) },
    { fs: backend, spawn() { spawned = true; assert.fail('no decoder'); }, now: () => clock,
      setTimeout(callback, delay) { scheduled.push(delay); return 1; }, clearTimeout() {},
      beforeDecode() { assert.fail('clock stops before staging'); }, afterDecode() { assert.fail('no decoder'); } });
  await assert.rejects(runner(identity), cause => cause.code === 'E_DEADLINE');
  assert.deepEqual(scheduled, [117000]); assert.deepEqual(closed, [502, 501]); assert.equal(owned.size, 0); assert.equal(spawned, false);
  deliveredBatch.abortToolchainEvidenceBatch();
});
test('malformed collector schema never invokes data getters', async () => {
  let invoked = false;
  const result = await run({ shallowFrozen: true, collection(value) {
    Object.defineProperty(value, 'roles', { enumerable: true, get() { invoked = true; return []; } });
  } }); stop(result, 'E_OUTPUT'); assert.equal(invoked, false);
});
test('shallow-frozen collector output fails recursive frozen-data admission', async () => {
  const result = await run({ shallowFrozen: true }); stop(result, 'E_COLLECTION'); assert.equal(result.h.written, null);
});
test('unknown evidence error codes cannot serialize arbitrary strings', async () => {
  const result = await run({ coreFailure: 'E_EVIDENCE_SECRET', diagnostic: null }); stop(result, 'E_COLLECTION');
  assert.doesNotMatch(result.output.text, /SECRET/);
});
test('known collector underlying codes survive while all provisional source fields remain null', async () => {
  const result = await run({ acceptFailure: 'E_EVIDENCE_INSPECT', diagnostic: { code: 'E_EVIDENCE_INSPECT',
    role: 'gnu-sdk', path: TARGETS[0].path, kind: TARGETS[0].kind, index: TARGETS[0].index, underlyingCode: 'E_INPUT' } });
  stop(result, 'E_EVIDENCE_INSPECT');
  assert.deepEqual(result.receipt.diagnostic, { code: 'E_EVIDENCE_INSPECT', role: 'gnu-sdk',
    path: null, kind: null, index: null, underlyingCode: 'E_INPUT' });
});
test('source positive-close failure explicitly marks close state uncertain', async () => {
  const result = await run({ source: { closeFailure: 'operation' } }); stop(result, 'E_CLOSE');
  assert.equal(result.receipt.sourceCloseUncertain, true); assert.equal(result.receipt.repoCapture.closes, 0);
});
test('publication clock starts after accepted role rather than before the decoder', async () => {
  const result = await run({ event(name, _, setClock) {
    if (name === 'archive') setClock(100000);
    if (name === 'publish') setClock(120000);
  } });
  assert.equal(result.output.exitCode, 0, result.output.text);
});
test('exact 150-second admission remainder succeeds with fixed budgets', async () => {
  const result = await run({ event(name, _, setClock) { if (name === 'begin') setClock(150000); } });
  assert.equal(result.output.exitCode, 0, result.output.text);
});
test('invalid initial clock fails before bootstrap filesystem access', async () => {
  for (const value of [NaN, Infinity, Number.MAX_VALUE]) {
    const result = await run({ now: () => value }); stop(result, 'E_CLOCK'); assert.equal(result.h.io.calls.length, 0);
  }
});
test('publication missing counter and negative metadata cannot be accepted', async () => {
  const missing = await run({ record(r) { delete r.counts.peakOwnedScratchBytes; } }); stop(missing, 'E_PUBLICATION_RECORD');
  const metadata = await run({ record(r) { r.fileMetadata.dev = '-1'; } }); stop(metadata, 'E_PUBLICATION_RECORD');
});
test('verification preserves all consumed source and accepted-result bytes', () => {
  assert.deepEqual(pin(readFileSync(source.operationPath)), source.operationPin);
  assert.deepEqual(pin(readFileSync(source.dataPath)), source.dataPin);
  for (const [key, path] of source.rows) assert.deepEqual(pin(readFileSync(path)), source.sourcePins[key]);
  assert.doesNotMatch(ownBytes.toString(), /prepareSourceGraph|compareConstants|\.validateCollection|\.validatePublication|oldMemberReport|\.receipt\.json['"]\s*[,)]\s*$/m);
  console.log('NEW_FILE_PINS=' + JSON.stringify(['gnu-preparation-evidence-operation.mjs', 'gnu-preparation-evidence-operation.test.mjs']
    .map(name => ({ path: 'tooling/native-ingress/' + name, ...pin(readFileSync(REPO + '/tooling/native-ingress/' + name)) }))));
});
