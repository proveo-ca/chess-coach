// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import * as operation from './rust-helper-evidence-operation.mjs';

const REPO = '/tmp/opencode/f9-bootstrap-correspondence';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = bytes => ({ bytes: bytes.length, sha256: sha(bytes) });
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const decode = value => Buffer.from(value.slice(value.indexOf(',') + 1), 'base64').toString();
const clone = value => JSON.parse(JSON.stringify(value));
const error = code => Object.assign(new Error(code), { code });
const throws = (fn, code) => assert.throws(fn, value => value.code === code);
const { rustHelperEvidenceOperationSource: source, RUST_HELPER_TARGETS: TARGETS, RUST_HELPER_PATH: PATH,
  RUST_HELPER_SOURCE_PINS: PINS, RUST_HELPER_BOOTSTRAP_PINS: BOOT, RUST_HELPER_GRAPH_PINS: GRAPH,
  createRustHelperEvidenceOperationFixture: fixture } = operation;
const retained = new Map([...source.bootstrapRows, ...source.rows].map(([key, path]) => [key, readFileSync(path)]));
assert.deepEqual(pin(retained.get('oldOperation')), BOOT.oldOperation);
const old = await import(uri(retained.get('oldOperation'))), src = old.rustArchiveEvidenceOperationSource;
const accepted = JSON.parse(retained.get('acceptedRustc')), input = old.RUST_ARCHIVE_INPUTS.rustc;
function constructGraph() {
  const outputs = {}, put = (key, value) => (outputs[key] = value);
  const tar = put('eventTar', src.transformTar(retained.get('rawTar'))), tarUri = uri(tar);
  const sdk1 = put('appendedSdk', Buffer.concat([retained.get('sdk'), Buffer.from(source.sdkAppend)]));
  const sdk2 = put('tarLinkedSdk', src.link(sdk1, 'tar-inventory', tarUri));
  const sdk = put('linkedSdk', src.link(sdk2, 'elf-requirements-v3', uri(retained.get('elfV3'))));
  const c0 = put('appendedCollector', Buffer.concat([retained.get('collector'), Buffer.from(source.collectorAppend)]));
  const c1 = put('tarLinkedCollector', src.link(c0, 'tar-inventory', tarUri));
  const c2 = put('elfLinkedCollector', src.link(c1, 'elf-requirements-v5', uri(retained.get('elfV5'))));
  const c = put('linkedCollector', src.link(c2, 'sdk-payload-inspection', uri(sdk)));
  put('linkedStage', src.link(retained.get('stage'), 'elf-metadata', uri(retained.get('elfMetadata'))));
  const w1 = put('writerParts', Buffer.from(src.replaceOnce(retained.get('writer').toString(), source.writerParts,
    "export const SPLIT_EVIDENCE_PARTS = Object.freeze(['rust-helper']);")));
  put('linkedWriter', Buffer.from(src.replaceOnce(w1.toString(), source.writerPaths,
    'export const SPLIT_EVIDENCE_PATHS = Object.freeze(' + JSON.stringify({ 'rust-helper': PATH }, null, 2) + ');')));
  const core = src.transformCore(retained.get('rawCore'), 'rustc', (name, bytes) => put('rustc:' + name, bytes));
  put('rustc:linkedCore', src.link(core, 'tar-inventory', uri(c)));
  return outputs;
}
test('record deterministic private graph image pins', () => {
  const outputs = constructGraph();
  for (const [key, bytes] of Object.entries(outputs)) {
    assert.deepEqual(pin(bytes), GRAPH[key], key);
  }
});
const graph = source.prepareGraph(src, retained), helper = await import(graph.collectorUri), writer = await import(graph.writerUri);
const tar = await import(uri(graph.outputs.eventTar)), elf = await import(uri(retained.get('elfV5'))), core = await import(graph.coreUri);
function stat(size, ino = 10, directory = false) {
  return { dev: directory ? 28n : 29n, ino: BigInt(ino), mode: directory ? 0o40700n : 0o100600n,
    uid: 1000n, gid: 1000n, nlink: directory ? 2n : 1n, size: BigInt(size), mtimeNs: 123n, ctimeNs: 456n };
}
function sourceFs(options = {}, event = () => {}) {
  const files = new Map([...source.bootstrapRows, ...source.rows].map(([key, path], index) => [path,
    { bytes: retained.get(key), stat: stat(retained.get(key).length, index + 10), key }]));
  const fds = new Map(), calls = []; let next = 3;
  const active = value => !options.key || options.key === value?.key;
  const backend = {
    lstatSync(path, flags) {
      calls.push(['lstat', path]); event('sourceStat', path); assert.deepEqual(flags, { bigint: true });
      const file = files.get(path), value = path === REPO ? stat(4096, 2, true) : file?.stat;
      assert.ok(value, 'closed repository capture paths only');
      return options.stat && active(file) ? options.stat({ ...value }, path) : { ...value };
    },
    openSync(path, flags) {
      calls.push(['open', path]); event('sourceOpen', path);
      assert.equal(flags, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
      const value = files.get(path); assert.ok(value);
      if (options.openError && active(value)) throw error('EIO');
      const fd = next++; fds.set(fd, value); return fd;
    },
    fstatSync(fd, flags) {
      assert.deepEqual(flags, { bigint: true }); const value = fds.get(fd); assert.ok(value);
      return options.fdStat && active(value) ? options.fdStat({ ...value.stat }) : { ...value.stat };
    },
    readSync(fd, bytes, offset, length, position) {
      calls.push(['read', fd, length, position]); event('sourceRead', position);
      const value = fds.get(fd); assert.ok(value); assert.ok(length <= 65536);
      if (active(value)) {
        if (options.readError) throw error('EIO');
        if (options.shortRead) return 0;
        if (options.extraEof && position === value.bytes.length) return 1;
      }
      const amount = Math.min(length, Math.max(0, value.bytes.length - position));
      value.bytes.copy(bytes, offset, position, position + amount);
      if (active(value) && options.corrupt && position === 0) bytes[offset] ^= 1;
      return amount;
    },
    closeSync(fd) {
      calls.push(['close', fd]); const value = fds.get(fd); assert.ok(fds.delete(fd)); event('sourceClose', fd);
      if (active(value) && options.closeError) throw error('EIO');
    },
    writeSync() { assert.fail('source cannot publish'); }, fsyncSync() { assert.fail('source cannot fsync'); },
    fchmodSync() { assert.fail('source cannot chmod'); },
  };
  return { backend, files, fds, calls };
}
function publicationMemory(options = {}) {
  const directory = REPO + '/_spec/tooling/native-ingress';
  const nodes = new Map([REPO, REPO + '/_spec', REPO + '/_spec/tooling', directory].map((path, index) =>
    [path, { ...stat(4096, 100 + index, true), data: Buffer.alloc(0) }]));
  const fds = new Map(), calls = []; let next = 100;
  const copy = value => Object.fromEntries(Object.keys(stat(0)).map(key => [key, value[key]]));
  const methods = {
    lstatSync(path) { if (!nodes.has(path)) throw error('ENOENT'); return copy(nodes.get(path)); },
    fstatSync(fd) { assert.ok(fds.has(fd)); return copy(fds.get(fd)); },
    openSync(path, flags, mode) {
      assert.ok(flags & constants.O_NOFOLLOW); assert.ok(flags & constants.O_NONBLOCK);
      assert.ok(path === directory || path === PATH, 'new result only');
      if (flags & constants.O_CREAT) {
        assert.equal(path, PATH); assert.equal(mode, 0o600); assert.ok(flags & constants.O_EXCL);
        if (options.exists || nodes.has(path)) throw error('EEXIST');
        nodes.set(path, { ...stat(0, 300), data: Buffer.alloc(0) }); nodes.get(directory).mtimeNs++; nodes.get(directory).ctimeNs++;
      }
      assert.ok(nodes.has(path)); const fd = next++; fds.set(fd, nodes.get(path)); return fd;
    },
    fsyncSync(fd) { assert.ok(fds.has(fd)); },
    fchmodSync(fd, mode) { assert.equal(mode, 0o444); fds.get(fd).mode = 0o100444n; fds.get(fd).ctimeNs++; },
    writeSync(fd, bytes, offset, length, position) {
      const value = fds.get(fd); assert.ok(value);
      const amount = Math.min(length, options.writeCap ?? Infinity), data = Buffer.alloc(Math.max(value.data.length, position + amount));
      value.data.copy(data); bytes.copy(data, position, offset, offset + amount); value.data = data;
      value.size = BigInt(data.length); value.mtimeNs++; value.ctimeNs++; return amount;
    },
    readSync(fd, bytes, offset, length, position) {
      const value = fds.get(fd); assert.ok(value);
      const amount = Math.min(length, options.readCap ?? Infinity, Math.max(0, value.data.length - position));
      value.data.copy(bytes, offset, position, position + amount);
      if (options.extraEof && position === value.data.length) return 1;
      if (options.corrupt && amount) bytes[offset] ^= 1;
      return amount;
    },
    closeSync(fd) { assert.ok(fds.delete(fd)); if (options.closeError) throw error('EIO'); },
  };
  const backend = Object.fromEntries(Object.entries(methods).map(([name, method]) => [name, (...args) => {
    calls.push([name, args]); options.before?.(name, args); return method(...args);
  }]));
  return { fs: backend, nodes, fds, calls, file: () => nodes.get(PATH) };
}
function coreValue() {
  return { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: false, archiveBytes: input.archiveBytes,
    archiveSha256: input.archiveSha256, archivePasses: 2, archiveDataBytes: 160703920,
    archiveRequestedBytes: 160703922, closeAttempts: 2, expandedBytes: 402308096, streamEvents: 10,
    inventory: { entries: 70, headers: 71, metadataSha256: helper.SOURCE_HELPER_PROFILE.expectations[0].metadataSha256 },
    exitCode: 0, signal: null, stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true,
    extracted: false, extractionAuthorized: false, installedUsability: false, decoderQualified: false, provenanceVerified: false,
    hardRssBounded: false, processTreeBounded: false, hardDeadlineGuaranteed: false, nativeQualified: false,
    pythonFreeSubsetVerified: false, rustReady: false, trainingReady: false };
}
function mockCollection() {
  const value = clone(accepted.collection), role = value.roles[0];
  value.targetCount = 3; value.selectedPayloads = 3; value.declaredNeededEdges = [];
  value.constraints = clone(helper.SOURCE_HELPER_PROFILE.limits);
  value.resourceAccounting = { ...value.resourceAccounting, capturedBytes: 6995632, maxAdditionalElfSnapshotBytes: 8388608,
    peakPayloadBytes: 5156664, buffersAllocated: 6, buffersErased: 6 };
  role.selected = TARGETS.map(target => ({ ...target, bodySha256: target.expectedSha256,
    hashObservation: 'MATCHED_EXPECTED_BODY_HASH', qualified: false, abiVerified: false, roleSatisfied: false,
    metadata: { state: 'ELF_EXEC_DSO_REQUIREMENT_DATA', qualified: false, loadingTagsQualification: 'NOT_QUALIFIED',
      unsafeLoadingTags: [], requirements: { byteLength: target.size, inputSha256: target.expectedSha256, dynamic: { needed: [] } } } }));
  return value;
}
function harness(options = {}) {
  let clock = 0, memory = null, rawCore = null, acceptedCore = null;
  const events = [], imports = [], setClock = value => { clock = value; };
  const event = (name, value) => { events.push([name, value]); options.event?.(name, value, setClock); };
  const io = sourceFs(options.source, event);
  const mockedHelper = { ...helper, createSplitToolchainEvidenceCollector() { assert.fail('old public collector'); },
    SOURCE_CREATE_HELPERS() {
      event('createCollector'); let acceptedRoles = 0, currentRole = null, state = 'ACTIVE';
      return {
        beginToolchainEvidenceBatch() { event('begin'); },
        beginToolchainEvidenceRole(role) { assert.equal(role, 'rustc'); currentRole = role; event('role'); },
        createTarInventory() { assert.fail('controller mock cannot parse'); },
        acceptToolchainEvidenceRole(value) {
          event('accept'); assert.equal(value, rawCore); acceptedCore = value;
          if (options.acceptFailure) throw error('E_COLLECTION'); acceptedRoles++; currentRole = null;
        },
        snapshotToolchainEvidenceBatch() { return { part: 'rust', state, mockOnly: false, acceptedRoles, currentRole,
          entries: acceptedRoles ? 70 : 0, expandedBytes: acceptedRoles ? 402308096 : 0,
          metadataBytes: 0, manifestBytes: 0, capturedBytes: acceptedRoles ? 6995632 : 0,
          selectedPayloads: acceptedRoles ? 3 : 0, activeBufferBytes: 0, activeBodyHashes: 0 }; },
        finishToolchainEvidenceBatch() {
          event('finish'); const value = mockCollection(), result = options.collection ? options.collection(value) : value;
          return options.shallowFrozen ? Object.freeze(result) : src.freeze(result);
        },
        abortToolchainEvidenceBatch() { event('abortCollector'); state = 'ABORTED'; if (options.collectorAbortError) throw error('E_IO'); },
        getToolchainEvidenceFailure() { return null; },
      };
    } };
  options.constants?.(mockedHelper);
  const mockedWriter = { ...writer, reserveSplitEvidencePublication(part, guard) {
    event('reserve'); assert.equal(part, 'rust-helper');
    assert.equal(events.some(([name]) => name === 'archive'), false);
    if (options.reserveCloseFailure) throw error('E_PUBLICATION_CLOSE');
    memory = publicationMemory(options.publication);
    const actual = writer.createSplitEvidencePublicationFixture({ mockOnly: true }, { fs: memory.fs, guard }).reserveSplitEvidencePublication(part);
    return {
      snapshot() { event('writerSnapshot'); return actual.snapshot(); },
      publish(bytes) {
        event('publish'); assert.ok(acceptedCore);
        const record = actual.publish(bytes); event('published'); return options.record ? options.record(clone(record)) : record;
      },
      abort() { event('abortWriter'); const value = actual.abort(); if (options.writerAbortError) throw error('E_IO'); return value; },
    };
  } };
  const stage = {
    verifyStagedXzImages() {
      event('stage'); if (options.stageFailure) throw error('E_METADATA');
      return { counters: { fsCalls: 80, readBytes: 2758216, closeAttempts: options.stageCloses ?? 5 } };
    },
    assertNoSystemPreload() { event('preload'); return !options.preload; },
  };
  const config = { mockOnly: true, fs: io.backend, now: () => options.now ? options.now(clock) : clock,
    spawn() { event('spawn'); return new EventEmitter(); }, setTimeout() { return 1; }, clearTimeout() {},
    async moduleImporter(target) {
      imports.push(target); event('import', imports.length); await options.importWait?.(target);
      if (target === uri(retained.get('oldOperation'))) return { ...old,
        runRegisteredRustcEvidenceV1() { assert.fail('old physical runner'); },
        createRustArchiveEvidenceOperationFixture() { assert.fail('old fixture'); },
        rustArchiveEvidenceOperationSource: { ...src,
          prepareSourceGraph() { assert.fail('old graph'); }, transformWriter() { assert.fail('old writer'); },
          compareConstants() { assert.fail('old targets'); }, validateCollection() { assert.fail('old validator'); } } };
      if (target === graph.collectorUri) return mockedHelper;
      if (target === graph.writerUri) return mockedWriter;
      if (target === graph.stageUri) return stage;
      assert.equal(target, graph.coreUri, 'pinned graph imports only');
      return { GNU_SDK_DESCRIPTOR: core.GNU_SDK_DESCRIPTOR, GNU_SDK_LIMITS: core.GNU_SDK_LIMITS,
        async runGnuSdkInventory(identity, deps) {
          assert.deepEqual(identity, input.identity); event('archive'); deps.beforeDecode();
          const d = core.GNU_SDK_DESCRIPTOR.decoderRoot;
          const child = deps.spawn(d + '/ld-linux-x86-64.so.2', ['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', d,
            d + '/xz', '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=268435456', '--', '-'],
          { cwd: d, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
          if (!options.noSpawnEvent) child.emit('spawn');
          if (!options.noChildClose) child.emit('close', options.badChildClose ? 1 : 0, null);
          deps.afterDecode(); event('afterCore'); if (options.coreFailure) throw error(options.coreFailure);
          const value = coreValue(); rawCore = options.core ? options.core(value) : value; return rawCore;
        } };
    } };
  return { fixture: fixture(config), config, io, events, imports, setClock, memory: () => memory };
}
async function run(options = {}) {
  const h = harness(options), output = await h.fixture.runRegisteredRustHelperEvidenceV1();
  assert.ok(Object.isFrozen(output)); assert.ok(output.text.length <= 65536); assert.match(output.text, /^[\x00-\x7f]*\n$/);
  const receipt = JSON.parse(output.text); assert.equal(receipt.mockOnly, true); assert.equal(receipt.realArchiveInspected, false);
  return { h, output, receipt };
}
function stop(result, code) {
  assert.equal(result.output.exitCode, 1, result.output.text); assert.equal(result.receipt.status, 'STOP');
  assert.equal(result.receipt.publicationAccepted, false); assert.equal(result.receipt.jointEvidenceSetComplete, false);
  assert.equal(result.receipt.selectedPayloads, 0); assert.equal(Object.hasOwn(result.receipt, 'collection'), false);
  assert.deepEqual(result.receipt.failure, { role: 'rustc', path: null, kind: null, index: null });
  if (code) assert.equal(result.receipt.error, code, result.output.text);
}
test('one closed zero-argument production entry rejects overrides without computation', async () => {
  assert.equal(operation.runRegisteredRustHelperEvidenceV1.length, 0);
  const value = await operation.runRegisteredRustHelperEvidenceV1({ path: '/forbidden', profile: {} });
  assert.equal(JSON.parse(value.text).error, 'E_INPUT');
});
test('operation boots from data URI using only Node builtin imports and absolute repository paths', async () => {
  const bytes = readFileSync(REPO + '/tooling/native-ingress/rust-helper-evidence-operation.mjs');
  assert.doesNotMatch(bytes.toString(), /import\.meta|^import .*from ['"]\.\.?\//m);
  const loaded = await import(uri(bytes));
  assert.equal(JSON.parse((await loaded.runRegisteredRustHelperEvidenceV1('invalid')).text).error, 'E_INPUT');
});
test('all sixteen immutable capture pins match exact repository bytes', () => {
  for (const [key] of [...source.bootstrapRows, ...source.rows]) assert.deepEqual(pin(retained.get(key)), BOOT[key] ?? PINS[key], key);
  assert.equal(source.rows.length, 14); assert.deepEqual(src.rows, source.rows);
  assert.deepEqual(old.RUST_ARCHIVE_SOURCE_PINS, PINS); assert.ok(Object.isFrozen(PINS.elfV5));
  assert.equal([...retained.values()].reduce((n, bytes) => n + bytes.length, 0), 383472);
});
test('three literal regular targets bind accepted83556-byte fixture and full offset metadata', () => {
  assert.deepEqual(pin(retained.get('acceptedRustc')), BOOT.acceptedRustc);
  const profile = source.compareProfile(src, helper, input, accepted);
  assert.deepEqual(profile.targets, TARGETS); assert.equal(profile.targets.length, 3);
  assert.equal(TARGETS.reduce((n, row) => n + row.size, 0), 6995632);
  assert.deepEqual(TARGETS.map(row => [row.index, row.bodyOffset, row.size]), [[28, 14370304, 5156664], [63, 400383488, 1557840], [70, 402025472, 281128]]);
  assert.ok(TARGETS.every(row => row.kind === 'ELF_EXEC_DSO' && row.domain === 'HOST' && row.maxBytes === 8388608 &&
    row.optionalForMinimalC === false && row.selectionRole === 'RUST_SUPPLEMENTAL_HELPER_CANDIDATE'));
  assert.equal(profile.expectations[0].headers, 71); assert.equal(Object.keys(input.identity.root).length, 9);
});
test('profile changes only payload and ELF snapshot caller caps to8MiB', () => {
  const limits = { ...helper.SOURCE_HELPER_PROFILE.limits };
  assert.equal(limits.maxPayloadBytes, 8388608); assert.equal(limits.maxElfSnapshotBytes, 8388608);
  limits.maxPayloadBytes = src.collectorLimits.maxPayloadBytes; limits.maxElfSnapshotBytes = src.collectorLimits.maxElfSnapshotBytes;
  assert.deepEqual(limits, src.collectorLimits); assert.equal(limits.maxAggregatePayloadBytes, 805306368);
  assert.equal(operation.RUST_HELPER_LIMITS.aggregateSelectedBytes, 25165824);
});
test('private graph pins cover every intermediate and raw collector prefix remains byte-identical', () => {
  assert.equal(Object.keys(GRAPH).length, 18);
  for (const [key, bytes] of Object.entries(graph.outputs)) assert.deepEqual(pin(bytes), GRAPH[key], key);
  assert.ok(graph.outputs.appendedCollector.subarray(0, PINS.collector.bytes).equals(retained.get('collector')));
  assert.ok(graph.outputs.appendedSdk.subarray(0, PINS.sdk.bytes).equals(retained.get('sdk')));
  assert.doesNotMatch(decode(graph.collectorUri), /from '\.\//);
});
test('writer specializes only two complete declaration blocks', () => {
  const strip = text => text.replace(/export const SPLIT_EVIDENCE_PARTS = Object\.freeze\([^;]*\);/, '<PARTS>')
    .replace(/export const SPLIT_EVIDENCE_PATHS = Object\.freeze\([\s\S]*?\);/, '<PATHS>');
  assert.equal(strip(retained.get('writer').toString()), strip(decode(graph.writerUri)));
  assert.deepEqual(writer.SPLIT_EVIDENCE_PARTS, ['rust-helper']); assert.deepEqual(writer.SPLIT_EVIDENCE_PATHS, { 'rust-helper': PATH });
  assert.deepEqual(writer.SPLIT_EVIDENCE_PUBLICATION_LIMITS, src.writerLimits);
});
test('static rustc bridge shares exact private helper URI and keeps unchanged120s core/parser transform', () => {
  const observed = [];
  const transformed = src.transformCore(retained.get('rawCore'), 'rustc', (name, bytes) => observed.push([name, pin(bytes)]));
  for (const [name, value] of observed) assert.deepEqual(value, GRAPH['rustc:' + name]);
  assert.equal(src.link(transformed, 'tar-inventory', graph.collectorUri).equals(graph.outputs['rustc:linkedCore']), true);
  assert.ok(decode(graph.coreUri).includes("from '" + graph.collectorUri + "'"));
  assert.match(decode(graph.coreUri), /SOURCE_RUSTC_TAR as createTarInventory/);
  assert.match(decode(graph.coreUri), /maxTotalMs: 120_000, cleanupMs: 3000/);
  assert.deepEqual(core.GNU_SDK_LIMITS, src.coreLimits());
});
test('full mocked controller publishes new DATA without own digest or final acceptance in raw file', async () => {
  const result = await run(); assert.equal(result.output.exitCode, 0, result.output.text);
  const { receipt, h } = result, bytes = h.memory().file().data, data = JSON.parse(bytes);
  assert.equal(receipt.status, 'RUST_HELPER_EVIDENCE_DATA'); assert.equal(receipt.profile, 'registered-rust-helper-evidence-v1');
  assert.equal(receipt.publicationAccepted, true); assert.equal(receipt.selectedPayloads, 3); assert.equal(receipt.artifactRole, 'rustc');
  assert.equal(receipt.scope, 'FRESH_STATIC_HELPER_DATA_NOT_ROLE_OR_RUNTIME_QUALIFICATION');
  assert.equal(receipt.sha256, sha(bytes)); assert.equal(receipt.byteLength, bytes.length); assert.equal(h.memory().fds.size, 0);
  assert.equal(data.collection.roles[0].members.length, 70); assert.equal(data.collection.roles[0].selected.length, 3);
  assert.equal(data.collection.roles[0].members.filter(row => row.type === 'file').length, 53);
  assert.equal(bytes.at(-1), 10); assert.ok(bytes.every(byte => byte <= 127));
  for (const key of ['selfDigest', 'publicationAccepted', 'publicationCounts', 'postwriteCounts']) assert.equal(Object.hasOwn(data, key), false);
  assert.equal(h.imports.length, 5); assert.ok(h.events.findIndex(([name]) => name === 'reserve') < h.events.findIndex(([name]) => name === 'archive'));
});
test('success accounts sixteen sameFD captures and two full archive SHA/EOF passes, all positive closes and global6 scope', async () => {
  const { output, receipt } = await run(); assert.equal(output.exitCode, 0, output.text);
  const s = receipt.repoCapture, c = receipt.collectionCounts, p = receipt.publicationCounts;
  assert.equal(s.completedCaptures, 16); assert.equal(s.closes, 16); assert.equal(s.closeAttempts, 16); assert.equal(s.peakOwnedFds, 1);
  assert.equal(s.readBytes, 383472); assert.equal(s.requestedBytes, 383488); assert.equal(s.allocatedBytes, 383488);
  assert.equal(c.archivePasses, 2); assert.equal(c.archiveDataBytes, 160703920); assert.equal(c.archiveRequestedBytes, 160703922);
  assert.equal(c.archiveCloseAttempts, 2); assert.equal(c.spawnEvents, 1); assert.equal(c.childCloses, 1); assert.equal(c.ownedChildren, 0);
  assert.equal(c.stageChecks, 2); assert.equal(c.preloadChecks, 2); assert.equal(c.stageCloses, 10);
  assert.equal(p.opens, 3); assert.equal(p.closes, 3); assert.equal(p.fsyncs, 4); assert.match(receipt.descriptorScope, /at most6/);
  for (const flag of ['nativeQualified', 'rustReady', 'trainingReady', 'roleSatisfied', 'abiVerified', 'noPythonRuntimeVerified',
    'sourceReady', 'imagePrepared', 'nodeIoQualified', 'sourceRootAuthentication', 'hardRssBounded', 'jointEvidenceSetComplete']) assert.equal(receipt[flag], false);
});
test('EEXIST stops before collector/archive/spawn without existing result read/probe/reuse', async () => {
  const result = await run({ publication: { exists: true } }); stop(result, 'E_PUBLICATION_EXISTS');
  assert.equal(result.h.events.some(([name]) => ['archive', 'spawn', 'createCollector'].includes(name)), false);
  assert.equal(result.h.memory().fds.size, 0); assert.equal(result.h.memory().file(), undefined);
  assert.equal(result.h.memory().calls.some(([name]) => ['readSync', 'writeSync', 'fchmodSync'].includes(name)), false);
});
for (const [name, options, code] of [
  ['short read', { shortRead: true }, 'E_LENGTH'], ['extra EOF', { extraEof: true }, 'E_LENGTH'],
  ['digest', { corrupt: true }, 'E_SOURCE_PIN'], ['read', { readError: true }, 'E_IO'],
  ['close', { closeError: true }, 'E_CLOSE'], ['open', { openError: true }, 'E_IO'],
  ['nonregular', { stat: value => ({ ...value, mode: 0o120600n }) }, 'E_SOURCE_PIN'],
  ['binding', { fdStat: value => ({ ...value, ino: value.ino + 1n }) }, 'E_BINDING'],
]) for (const key of ['oldOperation', 'acceptedRustc', 'elfV5']) test(`${key} ${name} refuses admission and closes exactly once`, async () => {
  const result = await run({ source: { ...options, key } }); stop(result, code);
  assert.equal(result.h.io.fds.size, 0); assert.equal(result.h.memory(), null);
  if (key === 'oldOperation') assert.equal(result.h.imports.length, 0);
});
test('bootstrap rejects wrong exact size before opening or allocation', () => {
  const io = sourceFs({ stat: (value, path) => path === REPO ? value : { ...value, size: value.size + 1n } });
  const counts = source.captureCounts(); throws(() => source.bootstrapCapture('oldOperation', io.backend, counts, () => {}), 'E_SOURCE_PIN');
  assert.equal(counts.openAttempts, 0); assert.equal(counts.allocations, 0);
});
test('bootstrap shares cumulative1MiB allocation and8192 operation ledger while reserving cleanup close', () => {
  for (const dimension of ['allocatedBytes', 'fsCalls']) {
    const io = sourceFs(), counts = source.captureCounts();
    counts[dimension] = dimension === 'fsCalls' ? 8188 : 1048576 - BOOT.oldOperation.bytes;
    throws(() => source.bootstrapCapture('oldOperation', io.backend, counts, () => {}), 'E_LIMIT');
    assert.equal(io.fds.size, 0); assert.equal(counts.allocations, 0); assert.ok(counts.fsCalls <= 8192);
  }
});
test('bootstrap expired guard still closes acquired descriptor once before digest or import', () => {
  const io = sourceFs(), counts = source.captureCounts(); let checks = 0;
  throws(() => source.bootstrapCapture('oldOperation', io.backend, counts, () => { if (++checks === 7) throw error('E_DEADLINE'); }), 'E_DEADLINE');
  assert.equal(counts.closeAttempts, 1); assert.equal(counts.closes, 1); assert.equal(counts.completedCaptures, 0);
});
test('all raw graph pins reject drift before private imports', () => {
  for (const [key] of source.rows) {
    const values = new Map(retained), bytes = Buffer.from(values.get(key)); bytes[0] ^= 1; values.set(key, bytes);
    throws(() => source.prepareGraph(src, values), 'E_SOURCE_PIN');
  }
});
for (const key of ['path', 'index', 'bodyOffset', 'size', 'bodySha256', 'type']) test(`accepted target tuple rejects changed ${key} before archive`, () => {
  const changed = clone(accepted); changed.collection.roles[0].members[69][key] = null;
  throws(() => source.compareProfile(src, helper, input, changed), 'E_RECEIPT');
});
for (const code of ['E_HASH', 'E_TAR', 'E_METADATA', 'E_CLOSE', 'E_PIPE', 'E_DECODER', 'E_EVIDENCE_BODY_HASH', 'E_EVIDENCE_INSPECT']) {
  test(`${code} withholds all three metadata rows and retains only own empty0600 reservation`, async () => {
    const result = await run({ coreFailure: code }); stop(result, code);
    assert.equal(result.h.memory().file().data.length, 0); assert.equal(result.h.memory().file().mode, 0o100600n);
    assert.equal(result.h.memory().fds.size, 0); assert.equal(result.receipt.archiveAccountingComplete, false);
    assert.match(result.receipt.archiveCountersScope, /failed-pass bytes remain unaccounted, not zero/);
    assert.equal(result.h.events.filter(([name]) => name === 'abortWriter').length, 1);
    assert.equal(result.h.events.filter(([name]) => name === 'abortCollector').length, 1);
  });
}
for (const [name, mutate] of [
  ['SHA', value => { value.archiveSha256 = '0'.repeat(64); }], ['passes', value => { value.archivePasses--; }],
  ['EOF request', value => { value.archiveRequestedBytes--; }], ['archive close', value => { value.closeAttempts--; }],
  ['stdin', value => { value.stdinFinished = false; }], ['stdout', value => { value.stdoutEnded = false; }],
  ['stderr', value => { value.stderrEnded = false; }], ['close', value => { value.closeObserved = false; }],
  ['decoder exit', value => { value.exitCode = 1; }], ['header count', value => { value.inventory.headers--; }],
  ['stream cap', value => { value.streamEvents = 262145; }], ['qualification', value => { value.nativeQualified = true; }],
]) test(`core ${name} gate withholds all metadata`, async () => {
  const result = await run({ core(value) { mutate(value); return value; } }); stop(result, 'E_RECEIPT');
  assert.equal(result.h.memory().file().data.length, 0);
});
for (const [name, mutate] of [
  ['partial namespace', value => { value.roles[0].members.pop(); }], ['missing selected', value => { value.roles[0].selected.pop(); }],
  ['old7 count', value => { value.targetCount = 7; }], ['metadata input hash', value => { value.roles[0].selected[2].metadata.requirements.inputSha256 = '0'.repeat(64); }],
  ['metadata input bytes', value => { value.roles[0].selected[2].metadata.requirements.byteLength--; }],
  ['body hash', value => { value.roles[0].selected[2].bodySha256 = '0'.repeat(64); }],
  ['decoded hash', value => { value.roles[0].decodedSha256 = '0'.repeat(64); }],
  ['offset metadata', value => { value.roles[0].offsetMetadataSha256 = '0'.repeat(64); }],
  ['manifest text', value => { value.roles[0].manifests[0].text += 'drift'; }],
  ['capture bytes', value => { value.resourceAccounting.capturedBytes--; }],
  ['snapshot cap', value => { value.resourceAccounting.maxAdditionalElfSnapshotBytes++; }],
]) test(`collection ${name} rejects before DATA publication`, async () => {
  const result = await run({ collection(value) { mutate(value); return value; } }); stop(result, 'E_COLLECTION');
  assert.equal(result.h.memory().file().data.length, 0);
});
for (const flag of ['nativeQualified', 'rustReady', 'noPythonRuntimeVerified', 'pythonFreeSubsetVerified', 'jointEvidenceSetComplete']) {
  test(`nested ${flag} cannot qualify data`, async () => {
    stop(await run({ collection(value) { value.roles[0][flag] = true; return value; } }), 'E_RECEIPT');
  });
}
test('recursive collection freeze rejects shallow frozen values', async () => { stop(await run({ shallowFrozen: true }), 'E_COLLECTION'); });
test('staged images/preload gates and exact10 stage closes precede DATA', async () => {
  stop(await run({ stageFailure: true }), 'E_METADATA'); stop(await run({ preload: true }), 'E_PRELOAD');
  stop(await run({ stageCloses: 4 }), 'E_RECEIPT');
});
test('child requires one spawn event and one positive close', async () => {
  stop(await run({ noSpawnEvent: true }), 'E_RECEIPT'); stop(await run({ noChildClose: true }), 'E_RECEIPT');
  stop(await run({ badChildClose: true }), 'E_RECEIPT');
});
test('controller120s includes cleanup and accepts119999ms', async () => {
  stop(await run({ event(name, _, set) { if (name === 'afterCore') set(120000); } }), 'E_DEADLINE');
  const below = await run({ event(name, _, set) { if (name === 'afterCore') set(119999); } }); assert.equal(below.output.exitCode, 0, below.output.text);
});
test('150s remaining admission is inclusive and149999ms refuses archive', async () => {
  const equal = await run({ event(name, _, set) { if (name === 'begin') set(150000); } }); assert.equal(equal.output.exitCode, 0, equal.output.text);
  const below = await run({ event(name, _, set) { if (name === 'begin') set(150001); } }); stop(below, 'E_DEADLINE');
  assert.equal(below.h.events.some(([name]) => name === 'archive'), false);
});
test('source10s starts before first bootstrap read and covers fifth final module import', async () => {
  for (const at of ['sourceRead', 'import']) {
    const result = await run({ event(name, value, set) { if (name === at && (at !== 'import' || value === 5)) set(10000); } });
    stop(result, 'E_DEADLINE'); assert.equal(result.h.memory(), null); assert.equal(result.h.io.fds.size, 0);
  }
});
test('publication30s begins before finish/serialization and covers final sealed file', async () => {
  for (const at of ['finish', 'published']) {
    const result = await run({ event(name, _, set) { if (name === at) set(30000); } }); stop(result, 'E_DEADLINE');
    if (at === 'published') assert.equal(result.h.memory().file().mode, 0o100444n);
  }
});
test('outer300s original clock never resets during publication and cleanup still aborts both owners', async () => {
  const result = await run({ event(name, _, set) {
    if (name === 'begin') set(150000); if (name === 'afterCore') set(269999); if (name === 'published') set(300000);
  } }); stop(result, 'E_DEADLINE');
  assert.equal(result.h.events.filter(([name]) => name === 'abortWriter').length, 1);
  assert.equal(result.h.events.filter(([name]) => name === 'abortCollector').length, 1);
});
for (const [name, now] of [['NaN', () => NaN], ['Infinity', () => Infinity], ['overflow', () => Number.MAX_VALUE]]) {
  test(`${name} clock refuses source IO`, async () => { const result = await run({ now }); stop(result, 'E_CLOCK'); assert.equal(result.h.io.calls.length, 0); });
}
test('nonmonotonic clock refuses admission', async () => {
  stop(await run({ event(name, value, set) { if (name === 'import') set(value === 2 ? -1 : 1); } }), 'E_CLOCK');
});
test('concurrent invocation rejects before additional captures and failure consumes one-shot latch', async () => {
  let release, entered; const gate = new Promise(resolve => { release = resolve; }), waiting = new Promise(resolve => { entered = resolve; });
  let first = true;
  const h = harness({ coreFailure: 'E_HASH', async importWait() { if (first) { first = false; entered(); await gate; } } });
  const pending = h.fixture.runRegisteredRustHelperEvidenceV1(); await waiting;
  const before = h.io.calls.length;
  assert.equal(JSON.parse((await h.fixture.runRegisteredRustHelperEvidenceV1()).text).error, 'E_IN_FLIGHT');
  assert.equal(h.io.calls.length, before); release(); assert.equal(JSON.parse((await pending).text).error, 'E_HASH');
  assert.equal(JSON.parse((await h.fixture.runRegisteredRustHelperEvidenceV1()).text).error, 'E_INPUT');
});
test('invalid arguments perform no computation and do not consume latch', async () => {
  const h = harness(); assert.equal(JSON.parse((await h.fixture.runRegisteredRustHelperEvidenceV1({ profile: {} })).text).error, 'E_INPUT');
  assert.equal(h.io.calls.length, 0); assert.equal((await h.fixture.runRegisteredRustHelperEvidenceV1()).exitCode, 0);
});
test('fixture requires complete fake capabilities, immutable profile, mockOnly true and no global fallbacks', () => {
  const h = harness();
  for (const key of ['fs', 'spawn', 'now', 'moduleImporter', 'setTimeout', 'clearTimeout']) {
    const config = { ...h.config }; delete config[key]; throws(() => fixture(config), 'E_INPUT');
  }
  for (const key of ['path', 'profile', 'limits', 'sourcePins', 'graphPins']) throws(() => fixture({ ...h.config, [key]: {} }), 'E_INPUT');
  throws(() => fixture({ ...h.config, mockOnly: false }), 'E_INPUT');
  throws(() => fixture({ ...h.config, setTimeout: globalThis.setTimeout }), 'E_INPUT');
});
test('real writer fixture supports bounded partial reads without exact requested-byte equality', async () => {
  const result = await run({ publication: { readCap: 7777, writeCap: 9001 } }); assert.equal(result.output.exitCode, 0, result.output.text);
  const c = result.receipt.publicationCounts;
  assert.ok(c.requestedReadBytes > result.receipt.byteLength + 1); assert.ok(c.requestedReadBytes <= 16777217);
  assert.equal(c.readbackHashBytes, result.receipt.byteLength);
});
for (const [name, options, code] of [
  ['positive close', { closeError: true }, 'E_PUBLICATION_CLOSE'], ['readback hash', { corrupt: true }, 'E_PUBLICATION_HASH'],
  ['EOF', { extraEof: true }, 'E_PUBLICATION_EOF'],
]) test(`real writer ${name} failure never accepts file`, async () => {
  const result = await run({ publication: options }); stop(result, code); assert.equal(result.h.memory().fds.size, 0);
});
for (const [name, mutate] of [
  ['hash', value => { value.sha256 = '0'.repeat(64); }], ['path', value => { value.path = accepted.path; }],
  ['read lower', value => { value.counts.requestedReadBytes = value.byteLength; }],
  ['read upper', value => { value.counts.requestedReadBytes = 16777218; }],
  ['read hash count', value => { value.counts.readbackHashBytes--; }],
]) test(`publication ${name} rejects after sealing`, async () => {
  const result = await run({ record(value) { mutate(value); return value; } }); stop(result, 'E_PUBLICATION_RECORD');
  assert.equal(result.h.memory().file().mode, 0o100444n);
});
test('abort returns flags/counts only; controller obtains ownedFDCount from separate post-abort snapshot', async () => {
  const result = await run({ coreFailure: 'E_HASH' }); stop(result, 'E_HASH'); assert.equal(result.receipt.abortUncertain, false);
  const index = result.h.events.findIndex(([name]) => name === 'abortWriter'); assert.equal(result.h.events[index + 1][0], 'writerSnapshot');
});
test('reservation close failure before capability assignment marks cleanup uncertain', async () => {
  const result = await run({ reserveCloseFailure: true }); stop(result, 'E_PUBLICATION_CLOSE'); assert.equal(result.receipt.abortUncertain, true);
  assert.equal(result.h.events.some(([name]) => name === 'archive'), false);
});
test('real writer reservation poison close before returned capability marks cleanup uncertain without duplicate close', async () => {
  const result = await run({ publication: { exists: true, closeError: true } }); stop(result, 'E_PUBLICATION_CLOSE');
  assert.equal(result.receipt.abortUncertain, true); assert.equal(result.h.memory().fds.size, 0);
  assert.equal(result.h.memory().calls.filter(([name]) => name === 'closeSync').length, 1);
  assert.equal(result.h.events.some(([name]) => name === 'archive'), false);
});
test('DT_NEEDED edges remain unresolved and raw RPATH/$ORIGIN/unsafe loading tags remain DATA without lookup', async () => {
  const result = await run({ collection(value) {
    const selected = value.roles[0].selected[0], raw = { tag: '2147483645', value: '17' };
    selected.metadata.requirements.dynamic = { needed: ['libmock.so'], rpath: '$ORIGIN/../unsafe', runpath: '', unknownTags: [raw] };
    selected.metadata.unsafeLoadingTags = [raw];
    value.declaredNeededEdges = [{ artifactRole: 'rustc', from: selected.path, domain: 'HOST', needed: 'libmock.so', status: 'UNRESOLVED',
      providerQualified: false, abiVerified: false, aliasFollowed: false, hostTargetPromotion: false }]; return value;
  } });
  assert.equal(result.output.exitCode, 0, result.output.text);
  const collection = JSON.parse(result.h.memory().file().data).collection;
  assert.equal(collection.roles[0].selected[0].metadata.requirements.dynamic.rpath, '$ORIGIN/../unsafe');
  assert.deepEqual(collection.roles[0].selected[0].metadata.unsafeLoadingTags, [{ tag: '2147483645', value: '17' }]);
  assert.equal(collection.declaredNeededEdges[0].status, 'UNRESOLVED');
});
test('both owners abort once even when either cleanup fails', async () => {
  for (const [key, code] of [['writerAbortError', 'E_PUBLICATION_ABORT'], ['collectorAbortError', 'E_COLLECTION_ABORT']]) {
    const result = await run({ coreFailure: 'E_HASH', [key]: true }); stop(result, code); assert.equal(result.receipt.abortUncertain, true);
    assert.equal(result.h.events.filter(([name]) => name === 'abortWriter').length, 1);
    assert.equal(result.h.events.filter(([name]) => name === 'abortCollector').length, 1);
  }
});
for (const maximum of [65536, 16777216]) test(`ASCII JSON LF cap${maximum} includes exact boundary`, () => {
  const value = { x: 'x'.repeat(maximum - 9) }; assert.equal(src.asciiJson(value, maximum).length, maximum);
  value.x += 'x'; throws(() => src.asciiJson(value, maximum), 'E_OUTPUT');
});
test('ASCII JSON escapes nonASCII and lone surrogates and rejects getters without invoking them', () => {
  assert.equal(src.asciiJson({ x: 'é😀\ud800\n' }, 1024), '{"x":"\\u00e9\\ud83d\\ude00\\ud800\\n"}\n');
  let touched = false; const value = Object.defineProperty({}, 'x', { enumerable: true, get() { touched = true; } });
  throws(() => src.preflight(value, 65536), 'E_OUTPUT'); assert.equal(touched, false);
});
function tarHeader(path, size = 0, type = '0') {
  const bytes = Buffer.alloc(512), slash = path.lastIndexOf('/');
  if (Buffer.byteLength(path) > 100) { bytes.write(path.slice(slash + 1), 0, 100); bytes.write(path.slice(0, slash), 345, 155); }
  else bytes.write(path, 0, 100);
  for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, size], [136, 12, 0]]) {
    bytes.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  }
  bytes[156] = type.charCodeAt(0); bytes.write('ustar\0', 257, 6); bytes.write('00', 263, 2); bytes.fill(32, 148, 156);
  bytes.write(bytes.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0') + '\0 ', 148, 8); return bytes;
}
function elfBody(marker) {
  const bytes = Buffer.alloc(512); bytes.set([127, 69, 76, 70, 2, 1, 1]);
  bytes.writeUInt16LE(3, 16); bytes.writeUInt16LE(62, 18); bytes.writeUInt32LE(1, 20); bytes.writeUInt16LE(64, 52);
  bytes.writeUInt16LE(56, 54); bytes[80] = marker; return bytes;
}
function synthetic(kind) {
  const root = input.expectedRoot, chunks = [], targets = [];
  const add = (path, body = Buffer.alloc(0), type = '0') => chunks.push(Buffer.concat([
    tarHeader(path, body.length, type), body, Buffer.alloc((512 - body.length % 512) % 512)]));
  add(root, Buffer.alloc(0), '5'); add(root + '/components', Buffer.from('rustc\n'));
  add(root + '/rust-installer-version', Buffer.from('3\n'));
  add(root + '/rustc/manifest.in', Buffer.from('file:bin/mock\ndir:lib\nunknown:DATA\n'));
  add(root + '/unselected', Buffer.from('MOCK_ONLY_UNSELECTED\n'));
  for (const [ordinal, target] of TARGETS.entries()) {
    const body = elfBody(ordinal + 1);
    if (kind === 'elfRefusal' && ordinal === 2) body[0] = 0;
    targets.push({ ...target, index: chunks.length + 1, bodyOffset: chunks.reduce((n, bytes) => n + bytes.length, 0) + 512,
      size: body.length, expectedSha256: sha(body) }); add(target.path, body);
  }
  const bytes = Buffer.concat([...chunks, Buffer.alloc(1024)]), reference = tar.createTarInventory();
  const events = reference.feed(bytes), inventory = reference.finish(), compressed = Buffer.from('MCK');
  const loweredInput = { ...input, root: '/fixture/rust-helper', file: '/fixture/rust-helper/' + root + '.tar.xz',
    archiveBytes: 3, archiveSha256: sha(compressed), identity: { root: input.identity.root, file: { ...input.identity.file, size: '3' } } };
  const expected = { role: 'rustc', expandedBytes: bytes.length, entries: inventory.entries, headers: inventory.headers,
    regularFiles: events.filter(row => row.type === 'file').length, decodedSha256: sha(bytes),
    metadataSha256: inventory.metadataSha256, metadataHashKind: 'OFFSET_EVENT_METADATA' };
  if (kind === 'lateHash') bytes[targets[2].bodyOffset + 90] ^= 1;
  if (kind === 'decodedHash') expected.decodedSha256 = '0'.repeat(64);
  return { bytes, compressed, input: loweredInput, expected, targets };
}
const MOCK_GRAPH_PINS = Object.fromEntries([
  ['success', 208949, 'fa68b870fa8fd7ac7fe182df9ae1525464b48981471e330d2bcfd24736e1950b', 301151, 'c101d21b6d9c328618f1d29577ba99902f0bb2c33f44ae3bf19d4b12621ba036'],
  ['lateHash', 208950, '0161429fd29056bbf167b2307465da5c482705cf9a2df1ddd5b53695a18678fa', 301151, '9cea06cb8cf5a5f6ba130c4d8fe778ec8337a166ecba3cca7cb33913617eb52c'],
  ['decodedHash', 208953, 'c02df79e3dc4bce5a2fddaac32900808e20f1cbf8faa7e554302eb9b7a7ce5d8', 301155, 'f05795b1610dc2aa21422f3c0a33bf8e9e27dff870323f8b8fc80189a6416d0a'],
  ['elfRefusal', 208952, 'a27d58646a615bac55fc1d52d694c5c23056b30dfcad02c0c5a731b4c57a8a69', 301155, '134637b07c12665bb443d255c71075b42668d5bb0f6e853056c023c3b44beebf'],
  ['decoder', 208949, '9843d3c0eb42763c51bbe4f67682734bc732a3882ed08d3631d415894018032a', 301151, '4682d47fbf4e9603fb952d6608c5340386360a9aec669b5b415a5a8d96d92ad5'],
  ['pipe', 208946, '5ea0429b7078444c6d3c9bdca68d08ba9fae4ef11bfc14be1add4309fad61ad1', 301147, '20cac81c8fde1afbc3970d073e8a16e983a9ffbbdfea379eb1f883a340efb8c1'],
  ['archiveClose', 208954, '6a29119988c4349286570ba48455e6329e6c8a4b7f1c50d0283da05d92182221', 301159, '743b629a3ae79d5e5eaf22470b99c27aa8af77d9a41960292a5d9a5f8789464f'],
  ['stage', 208947, '5ccca9cdcc0a5952a3bd5717fac39bad79c4dcc83dcbdc63ba7461ef2fc09086', 301147, '4a66dea845891fffa88afcffce863ab13f868ddd137f47932ecd0c89b21ac8ae'],
  ['workDeadline', 208954, 'd40b7dc48abe7bfd47b372684d2aaafa7a12f87ce6df4b37ac7c46e21fa86955', 301159, '23d509a1bfb82c901309d7663c1335ae4d8a3de43f6eb5136dc61b4bb1ca6061'],
].map(([key, helperBytes, helperSha, coreBytes, coreSha]) => [key,
  { helper: { bytes: helperBytes, sha256: helperSha }, core: { bytes: coreBytes, sha256: coreSha } }]));
function mockGraph(kind) {
  const value = synthetic(kind), text = graph.outputs.linkedCollector.toString();
  const declaration = text.slice(text.indexOf('export const SOURCE_HELPER_PROFILE'), text.indexOf('let SOURCE_HELPER_INSTANCE'));
  const profile = { part: 'rust', mockOnly: true, inputs: [value.input], expectations: [value.expected],
    targets: value.targets, limits: helper.SOURCE_HELPER_PROFILE.limits };
  const specialized = src.replaceOnce(text, declaration, 'export const SOURCE_HELPER_PROFILE = freeze(' + JSON.stringify(profile) + ');\n') +
    '\nexport const MOCK_ONLY_CASE = ' + JSON.stringify(kind) + ';\n';
  assert.equal(specialized.slice(specialized.indexOf('let SOURCE_HELPER_INSTANCE'), specialized.lastIndexOf('\nexport const MOCK_ONLY_CASE')),
    text.slice(text.indexOf('let SOURCE_HELPER_INSTANCE')));
  const mockUri = uri(specialized), linkedCore = src.replaceOnce(decode(graph.coreUri), "from '" + graph.collectorUri + "'", "from '" + mockUri + "'");
  const helperBytes = Buffer.from(specialized), coreBytes = Buffer.from(linkedCore);
  src.pinned(helperBytes, MOCK_GRAPH_PINS[kind].helper); src.pinned(coreBytes, MOCK_GRAPH_PINS[kind].core);
  return { ...value, helperBytes, coreBytes, helperUri: mockUri, coreUri: uri(coreBytes) };
}
for (const [kind, code, failureCode] of [
  ['success', null, null], ['lateHash', 'E_TAR', 'E_EVIDENCE_BODY_HASH'], ['decodedHash', 'E_TAR', 'E_EVIDENCE_DECODED_HASH'],
  ['elfRefusal', 'E_TAR', 'E_EVIDENCE_INSPECT'], ['decoder', 'E_DECODER', null], ['pipe', 'E_PIPE', null],
  ['archiveClose', 'E_CLOSE', null], ['stage', 'E_PREREQUISITE', null], ['workDeadline', 'E_DEADLINE', null],
]) test(`delivered private collector+core+TAR+ELF5+writer fake-only integration: ${kind}`, async () => {
  const fixtureGraph = mockGraph(kind), actual = await import(fixtureGraph.helperUri), privateCore = await import(fixtureGraph.coreUri);
  const batch = actual.SOURCE_CREATE_HELPERS(); batch.beginToolchainEvidenceBatch(); batch.beginToolchainEvidenceRole('rustc');
  const descriptor = privateCore.GNU_SDK_DESCRIPTOR, owned = new Map(), closes = [], reads = [], hooks = [], schedules = [], argv = [];
  let clock = 0, spawnCount = 0, childCloses = 0, killCount = 0;
  const metadata = Object.fromEntries(Object.entries(fixtureGraph.input.identity).map(([key, value]) => [key,
    Object.fromEntries(Object.entries(value).map(([field, amount]) => [field, BigInt(amount)]))]));
  const kindOf = path => path === descriptor.root ? 'root' : path === descriptor.file ? 'file' : assert.fail('unregistered fake path');
  const backend = {
    lstatSync(path) { return { ...metadata[kindOf(path)] }; },
    fstatSync(fd) { assert.ok(owned.has(fd)); return { ...metadata[owned.get(fd)] }; },
    openSync(path, flags) {
      assert.ok(flags & constants.O_NOFOLLOW); assert.ok(flags & constants.O_NONBLOCK);
      const key = kindOf(path), fd = key === 'root' ? 501 : 502;
      assert.equal(owned.has(fd), false); owned.set(fd, key); return fd;
    },
    readSync(fd, buffer, offset, length, position) {
      assert.equal(owned.get(fd), 'file'); reads.push([fd, position, length]);
      if (kind === 'workDeadline') clock = 117000;
      return fixtureGraph.compressed.copy(buffer, offset, position, position + length);
    },
    closeSync(fd) { assert.ok(owned.delete(fd)); closes.push(fd); if (kind === 'archiveClose') throw error('EIO'); },
  };
  const runner = privateCore.createSdkInventoryFixtureRunner({ archiveBytes: 3, archiveSha256: sha(fixtureGraph.compressed) }, {
    fs: backend, now: () => clock, setTimeout(_, delay) { schedules.push(delay); return schedules.length; }, clearTimeout() {},
    beforeDecode() { hooks.push('before'); return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true }; },
    afterDecode() {
      hooks.push('after'); if (kind === 'stage') throw error('E_METADATA');
      return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true };
    },
    spawn(command, args, options) {
      spawnCount++; argv.push([command, args, options]); assert.equal(command, descriptor.decoderRoot + '/ld-linux-x86-64.so.2');
      assert.ok(args.includes('--memlimit-decompress=268435456'));
      assert.deepEqual(options, { cwd: descriptor.decoderRoot, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' },
        shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      const child = new EventEmitter(); child.stdin = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
      child.kill = signal => { assert.equal(signal, 'SIGKILL'); killCount++; return true; };
      child.stdin.write = (chunk, callback) => { assert.deepEqual(chunk, fixtureGraph.compressed); queueMicrotask(callback); return true; };
      child.stdin.end = () => {
        child.stdin.emit('finish'); child.stdout.emit('data', kind === 'pipe' ? 'NOT_BYTES' : fixtureGraph.bytes);
        child.stdout.emit('end'); child.stderr.emit('end');
        const exit = kind === 'decoder' ? 1 : 0;
        child.emit('exit', exit, null); child.emit('close', exit, null); childCloses++;
        for (const stream of [child.stdin, child.stdout, child.stderr]) stream.emit('close');
      };
      queueMicrotask(() => child.emit('spawn')); return child;
    },
  });
  if (code) {
    await assert.rejects(runner(fixtureGraph.input.identity), value => value.code === code);
    if (failureCode) {
      const failure = batch.getToolchainEvidenceFailure(); assert.equal(failure.code, failureCode);
      assert.equal(failure.role, 'rustc'); assert.equal(failure.path, null); assert.equal(failure.kind, null); assert.equal(failure.index, null);
      assert.equal(failure.scope, 'ATTEMPTED_LITERAL_ONLY_NOT_PROVISIONAL_EVIDENCE');
    }
    batch.abortToolchainEvidenceBatch(); const after = batch.snapshotToolchainEvidenceBatch();
    for (const key of ['acceptedRoles', 'capturedBytes', 'selectedPayloads', 'activeBufferBytes', 'activeBodyHashes', 'metadataBytes']) assert.equal(after[key], 0);
    throws(() => batch.finishToolchainEvidenceBatch(), 'E_EVIDENCE_STATE');
    assert.equal(owned.size, 0); assert.deepEqual(closes, [502, 501]);
    if (kind === 'workDeadline') { assert.equal(spawnCount, 0); assert.deepEqual(schedules, [117000]); }
    else { assert.equal(spawnCount, 1); assert.equal(childCloses, 1); }
    return;
  }
  const result = await runner(fixtureGraph.input.identity);
  assert.equal(result.mockOnly, true); assert.equal(result.realArchiveInspected, false);
  batch.acceptToolchainEvidenceRole(result); const collection = batch.finishToolchainEvidenceBatch();
  assert.equal(collection.mockOnly, true); assert.equal(collection.selectedPayloads, 3); assert.equal(collection.artifactCount, 1);
  for (const [ordinal, selected] of collection.roles[0].selected.entries()) {
    assert.equal(selected.metadata.requirements.inputSha256, fixtureGraph.targets[ordinal].expectedSha256);
    assert.equal(selected.metadata.requirements.byteLength, 512);
  }
  for (const flag of ['nativeQualified', 'rustReady', 'noPythonRuntimeVerified', 'roleSatisfied']) assert.equal(collection[flag], false);
  assert.equal(collection.resourceAccounting.capturedBytes, 1536); assert.equal(collection.resourceAccounting.maxAdditionalElfSnapshotBytes, 8388608);
  assert.equal(owned.size, 0); assert.deepEqual(closes, [502, 501]); assert.deepEqual(hooks, ['before', 'after']);
  assert.equal(spawnCount, 1); assert.equal(childCloses, 1); assert.equal(killCount, 0); assert.deepEqual(schedules, [117000]);
  assert.equal(reads.length, 4); assert.equal(reads.reduce((n, [, , length]) => n + length, 0), 8);
  assert.ok(reads.every(([fd]) => fd === 502)); assert.equal(argv.length, 1);
  const memory = publicationMemory(), publisher = writer.createSplitEvidencePublicationFixture({ mockOnly: true }, { fs: memory.fs, guard() {} })
    .reserveSplitEvidencePublication('rust-helper');
  const full = Buffer.from(src.asciiJson({ profile: 'registered-rust-helper-evidence-v1', status: 'RUST_HELPER_EVIDENCE_DATA',
    part: 'rust', artifactRole: 'rustc', mockOnly: true, collection }, 16777216));
  const record = publisher.publish(full); source.validatePublication(src, record, publisher.snapshot(), full.length, sha(full));
  assert.equal(memory.fds.size, 0); assert.equal(memory.file().mode, 0o100444n);
});
test('private zeroarg helper factory is one-shot and bridge binds only the new instance', () => {
  throws(() => helper.SOURCE_CREATE_HELPERS('rustc'), 'E_EVIDENCE_INPUT');
  const batch = helper.SOURCE_CREATE_HELPERS(); batch.beginToolchainEvidenceBatch(); batch.beginToolchainEvidenceRole('rustc');
  const parser = helper.SOURCE_RUSTC_TAR({}); parser.feed(tarHeader(input.expectedRoot, 0, '5'));
  assert.equal(batch.snapshotToolchainEvidenceBatch().entries, 1);
  throws(() => helper.SOURCE_CREATE_HELPERS(), 'E_EVIDENCE_STATE'); batch.abortToolchainEvidenceBatch();
});
test('trusted ELF5 API retains256MiB file,16MiB table and1024-byte strings without new runtime proof', () => {
  assert.equal(elf.ELF_REQUIREMENTS_V5_LIMITS.maxInputBytes, 268435456);
  assert.equal(elf.ELF_REQUIREMENTS_V5_LIMITS.maxStringTableBytes, 16777216);
  assert.equal(elf.ELF_REQUIREMENTS_V5_LIMITS.maxStringBytes, 1024); assert.equal(typeof elf.inspectElf64RequirementsV5, 'function');
});
test('final new files record exact bytes and SHA256 while retained files stay unchanged', () => {
  for (const [key, path] of [...source.bootstrapRows, ...source.rows]) assert.deepEqual(pin(readFileSync(path)), BOOT[key] ?? PINS[key]);
  for (const path of ['tooling/native-ingress/rust-helper-evidence-operation.mjs', 'tooling/native-ingress/rust-helper-evidence-operation.test.mjs']) {
    const bytes = readFileSync(REPO + '/' + path); console.log(JSON.stringify({ path, ...pin(bytes), lines: bytes.toString().split('\n').length - 1 }));
  }
});
