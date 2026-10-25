// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { runRegisteredToolchainEvidenceCollectionV1, createToolchainEvidenceOperationFixture,
  TOOLCHAIN_EVIDENCE_OPERATION_INPUTS as INPUTS, TOOLCHAIN_EVIDENCE_OPERATION_ROLES as ROLES,
  TOOLCHAIN_EVIDENCE_SOURCE_PINS as PINS, TOOLCHAIN_EVIDENCE_PUBLICATION_PATH as DESTINATION,
  TOOLCHAIN_EVIDENCE_GRAPH_PINS as GRAPH_PINS,
  TOOLCHAIN_EVIDENCE_OPERATION_LIMITS as LIMITS, toolchainEvidenceOperationSource as source } from './toolchain-evidence-operation.mjs';

const REPO = '/tmp/opencode/f9-bootstrap-correspondence';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = bytes => ({ bytes: bytes.length, sha256: sha(bytes) });
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const decode = target => Buffer.from(target.slice(target.indexOf(',') + 1), 'base64').toString('utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const fixedError = code => Object.assign(new Error(code), { code });
const collectorBytes = Buffer.from("// MOCK_ONLY_TOOLCHAIN_COLLECTOR\nimport { createTarInventory, INVENTORY_LIMITS } from './tar-inventory.mjs';\nimport { inspectElf64RequirementsV5 } from './elf-requirements-v5.mjs';\nimport { SOURCE_FORMAT_INSPECTORS } from './sdk-payload-inspection.mjs';\n");
const writerBytes = Buffer.from('// MOCK_ONLY_TOOLCHAIN_WRITER\nexport const mockOnly = true;\n');
const retained = new Map(source.rows.map(([key, path]) => [key,
  key === 'collector' ? collectorBytes : key === 'writer' ? writerBytes : readFileSync(path)]));
const helperPins = { collector: pin(collectorBytes), writer: pin(writerBytes) };
const receipts = Object.fromEntries([...retained].filter(([key]) => key.endsWith('Receipt')).map(([key, bytes]) => [key, JSON.parse(bytes)]));
const graph = source.prepareSourceGraph(retained, null, true);
const sdk = await import(graph.sdkUri);
const expectations = [{ role: 'gnu-sdk', expandedBytes: 505333760, entries: 8412, headers: 10181,
  regularFiles: 6891, decodedSha256: receipts.sdkCatalogReceipt.decodedSha256,
  metadataSha256: receipts.sdkInventoryReceipt.inventory.metadataSha256, metadataHashKind: 'LEGACY_WITHOUT_BODY_OFFSET' },
...receipts.rustLayoutReceipt.roles.map(row => ({ role: row.role, expandedBytes: row.expandedBytes,
  entries: row.entries, headers: row.headers, regularFiles: row.regularFiles, decodedSha256: row.decodedSha256,
  metadataSha256: row.metadataSha256, metadataHashKind: 'OFFSET_EVENT_METADATA' }))];
const targets = [
  ...sdk.SDK_PAYLOAD_TARGETS.map(row => ({ artifactRole: 'gnu-sdk', path: INPUTS[0].expectedRoot + '/' + row.path,
    index: row.index, bodyOffset: row.bodyOffset, size: row.size, expectedSha256: null, kind: row.kind,
    domain: row.domain, selectionRole: row.role, optionalForMinimalC: row.optionalForMinimalC,
    maxBytes: row.kind === 'LINKER_TEXT' ? 1048576 : row.kind === 'AR' ? 8388608 : 67108864 })),
  ...receipts.rustLayoutReceipt.runtimeInspectionCandidates.map(row => ({ artifactRole: row.role, path: row.path,
    index: row.index, bodyOffset: row.bodyOffset, size: row.size, expectedSha256: row.sha256,
    kind: row.size === 42 ? 'LINKER_TEXT' : 'ELF_EXEC_DSO', domain: row.role === 'rust-std' ? 'TARGET' : 'HOST',
    selectionRole: 'RUST_RUNTIME_CANDIDATE', optionalForMinimalC: false, maxBytes: row.size === 42 ? 1048576 : 268435456 })),
  { artifactRole: 'gnu-sdk', path: INPUTS[0].expectedRoot + '/x86_64-buildroot-linux-gnu/sysroot/lib/libmvec.so.1',
    index: null, bodyOffset: null, size: null, expectedSha256: null, kind: 'ELF_EXEC_DSO', domain: 'TARGET',
    selectionRole: 'TARGET_LIBMVEC_PROVIDER', optionalForMinimalC: false, maxBytes: 8388608 },
];
function stat(size, ino = 10, directory = false) {
  return { dev: directory ? 28n : 29n, ino: BigInt(ino), mode: directory ? 0o40700n : 0o100600n,
    uid: 1000n, gid: 1000n, nlink: directory ? 2n : 1n, size: BigInt(size), mtimeNs: 123n, ctimeNs: 456n };
}
function sourceFs(options = {}) {
  const files = new Map(source.rows.map(([key, path], index) => [path, { bytes: retained.get(key), stat: stat(retained.get(key).length, index + 10), key }]));
  const descriptors = new Map(), log = [], closed = [];
  let next = 3;
  const backend = {
    lstatSync(path, flags) {
      log.push(['lstat', path]); options.event?.('sourceStat', path);
      assert.deepEqual(flags, { bigint: true });
      const result = path === REPO ? stat(4096, 2, true) : files.get(path)?.stat;
      if (!result) throw fixedError('ENOENT');
      return options.stat ? options.stat({ ...result }, path) : { ...result };
    },
    openSync(path, flags) {
      log.push(['open', path, flags]); options.event?.('sourceOpen', path);
      assert.equal(flags, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
      if (options.openError) throw fixedError('ENOENT');
      assert.ok(files.has(path), 'no archive or extra source acquisition through source capture');
      const fd = next++; descriptors.set(fd, files.get(path)); return fd;
    },
    fstatSync(fd, flags) {
      log.push(['fstat', fd]); assert.deepEqual(flags, { bigint: true });
      const entry = descriptors.get(fd); assert.ok(entry);
      return options.fdStat ? options.fdStat({ ...entry.stat }, entry.key) : { ...entry.stat };
    },
    readSync(fd, buffer, offset, length, position) {
      log.push(['read', fd, length, position]); options.event?.('sourceRead', position);
      const entry = descriptors.get(fd); assert.ok(entry);
      if (options.readError) throw fixedError('EIO');
      if (options.shortRead && position === 0) return 0;
      if (options.extraEof && position === entry.bytes.length) return 1;
      const amount = Math.min(length, Math.max(0, entry.bytes.length - position));
      entry.bytes.copy(buffer, offset, position, position + amount);
      if (options.corrupt && position === 0) buffer[offset] ^= 1;
      return amount;
    },
    closeSync(fd) {
      log.push(['close', fd]); assert.ok(descriptors.has(fd)); descriptors.delete(fd); closed.push(fd);
      if (options.closeError) throw fixedError('EIO');
      options.event?.('sourceClose', fd);
    },
  };
  return { backend, files, log, descriptors, closed };
}
function coreValue(index) {
  const input = INPUTS[index], expected = expectations[index];
  return { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: false,
    archiveBytes: input.archiveBytes, archiveSha256: input.archiveSha256,
    archivePasses: 2, archiveDataBytes: input.archiveBytes * 2, archiveRequestedBytes: input.archiveBytes * 2 + 2,
    closeAttempts: 2, expandedBytes: expected.expandedBytes, streamEvents: 10,
    inventory: { entries: expected.entries, headers: expected.headers, metadataSha256: expected.metadataSha256 },
    exitCode: 0, signal: null, stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true,
    extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false, rustReady: false, trainingReady: false };
}
function publicationCounts(length = 0) {
  return { fsOperations: 70, guardChecks: 100, opens: 3, closeAttempts: 3, closes: 3, cleanupCloseAttempts: 0,
    namedStats: 15, fdStats: 10, fsyncs: 4, chmods: 1, writeAttempts: Math.ceil(length / 65536),
    readAttempts: Math.ceil(length / 65536) + 1, requestedWriteBytes: length, requestedReadBytes: length + 1,
    writtenBytes: length, readbackBytes: length, inputBytes: length, copiedBytes: length,
    inputHashBytes: length, readbackHashBytes: length, peakOwnedFDs: 2,
    ownedSnapshotBytes: 0, peakOwnedSnapshotBytes: length, ownedScratchBytes: 0,
    peakOwnedScratchBytes: 65536, jsonStringCodeUnits: length, wipedSnapshotBytes: length };
}
function mockCollectionRole(index) {
  const expected = expectations[index], input = INPUTS[index], selectedTargets = targets.filter(row => row.artifactRole === input.role);
  const members = Array.from({ length: expected.entries }, (_, ordinal) => ({ index: ordinal + 1,
    path: input.expectedRoot + '/mock-member-' + ordinal, bodyOffset: (ordinal + 1) * 512, size: 0,
    type: ordinal < expected.regularFiles ? 'file' : 'directory',
    ...(ordinal < expected.regularFiles ? { bodySha256: sha('') } : { bodySha256: null, linkFollowed: false }) }));
  const protectedIndices = new Set();
  const selected = selectedTargets.map(target => {
    const ordinal = (target.index ?? 6000) - 1, member = members[ordinal]; protectedIndices.add(ordinal);
    Object.assign(member, { path: target.path, type: 'file', size: target.size ?? 512,
      bodyOffset: target.bodyOffset ?? 400000000, bodySha256: target.expectedSha256 ?? sha('MOCK_ONLY_FRESH_HASH:' + target.path) });
    return { ...target, index: ordinal + 1, bodyOffset: member.bodyOffset, size: member.size, bodySha256: member.bodySha256,
      hashObservation: target.expectedSha256 === null ? 'FRESH_BODY_HASH' : 'MATCHED_EXPECTED_BODY_HASH',
      metadata: target.kind === 'ELF_EXEC_DSO' ? { mockOnly: true, state: 'ELF_EXEC_DSO_REQUIREMENT_DATA',
        requirements: { dynamic: { needed: [] } }, unsafeLoadingTags: [], loadingTagsQualification: 'NOT_QUALIFIED', qualified: false } :
        { mockOnly: true, state: 'SOURCE_FORMAT_DATA', observation: { mockOnly: true }, qualified: false },
      qualified: false, abiVerified: false, roleSatisfied: false };
  });
  const component = input.role === 'rust-std' ? 'rust-std-x86_64-unknown-linux-gnu' : input.role;
  const manifestPaths = index === 0 ? ['share/buildroot/sdk-relocs', 'share/buildroot/sdk-location'] :
    ['components', 'rust-installer-version', component + '/manifest.in'];
  const manifests = manifestPaths.map((path, ordinal) => {
    protectedIndices.add(ordinal); const text = 'MOCK_ONLY_FULL_TEXT\n', hash = sha(text);
    Object.assign(members[ordinal], { path: input.expectedRoot + '/' + path, type: 'file', size: Buffer.byteLength(text), bodySha256: hash });
    return { path: members[ordinal].path, kind: 'MOCK_ONLY_MANIFEST', bodySha256: hash, text, declarations: [], interpreted: false };
  });
  let regular = members.filter(row => row.type === 'file').length;
  for (let ordinal = members.length - 1; regular > expected.regularFiles && ordinal >= 0; ordinal--) {
    if (members[ordinal].type !== 'file' || protectedIndices.has(ordinal)) continue;
    members[ordinal].type = 'directory'; members[ordinal].bodySha256 = null; members[ordinal].linkFollowed = false; regular--;
  }
  const offset = index === 0 ? sha('MOCK_ONLY_OFFSET') : expected.metadataSha256;
  return { ...expected, decodedSha256: expected.decodedSha256, offsetMetadataSha256: offset,
    legacyMetadataSha256: expected.metadataSha256, inventory: { metadataSha256: offset },
    completeNamespace: true, members, selected, manifests };
}
function harness(options = {}) {
  let clock = 0, accepted = 0, current = null, phase = 'ACTIVE', entries = 0, expandedBytes = 0;
  let publicationPhase = 'RESERVED', written = null, c = { writtenBytes: 0 };
  const events = [], imports = [], sourceBackend = sourceFs({ ...options.source,
    event(name, value) { options.event?.(name, value, setClock); } });
  const setClock = value => { clock = value; };
  const collector = {
    TOOLCHAIN_EVIDENCE_ROLES: ROLES, TOOLCHAIN_EVIDENCE_INPUTS: INPUTS,
    TOOLCHAIN_EVIDENCE_EXPECTATIONS: expectations, TOOLCHAIN_EVIDENCE_TARGETS: targets,
    TOOLCHAIN_EVIDENCE_LIMITS: source.collectorLimits,
    beginToolchainEvidenceBatch() { events.push('begin'); options.event?.('begin', null, setClock); },
    beginToolchainEvidenceRole(role) { current = role; events.push('role:' + role); options.event?.('role', role, setClock); },
    createTarInventory() { throw new Error('mock controller never parses an actual archive'); },
    acceptToolchainEvidenceRole(core) {
      options.event?.('accept', current, setClock);
      if (options.acceptFailure === current) throw fixedError(options.failureCode ?? 'E_COLLECTION');
      events.push('accept:' + current); accepted++; current = null; entries += core.inventory.entries; expandedBytes += core.expandedBytes;
    },
    snapshotToolchainEvidenceBatch() { return { state: phase, mockOnly: false, acceptedRoles: accepted,
      currentRole: current, entries, expandedBytes, metadataBytes: 0, manifestBytes: 0, capturedBytes: 0,
      selectedPayloads: 0, activeBufferBytes: 0, activeBodyHashes: 0 }; },
    finishToolchainEvidenceBatch() {
      events.push('finish'); options.event?.('finish', null, setClock);
      const result = { profile: 'TOOLCHAIN_EVIDENCE_COLLECTION_DATA', state: 'TOOLCHAIN_EVIDENCE_COLLECTION_DATA',
        mockOnly: false, entries: 8675, regularFiles: 7106, expandedBytes: 1148080640,
        completeNamespace: true, selectedPayloads: 59, artifactCount: 6, declaredNeededEdges: [],
        roles: ROLES.map((_, index) => mockCollectionRole(index)) };
      return options.collection ? options.collection(result) : result;
    },
    abortToolchainEvidenceBatch() { events.push('abortCollector'); accepted = 0; current = null; entries = 0; expandedBytes = 0; phase = 'ABORTED';
      if (options.collectorAbortError) throw fixedError('E_IO'); },
    getToolchainEvidenceFailure() { return null; },
  };
  options.constants?.(collector);
  const publisher = {
    snapshot() {
      options.event?.('publicationSnapshot', publicationPhase, setClock);
      const result = { phase: publicationPhase, ownedFDCount: publicationPhase === 'RESERVED' ? 2 : 0, counts: c,
        created: true, sealed: publicationPhase === 'PUBLISHED_READBACK_MATCHED', error: null, closeFailed: false, cleanupUncertain: false };
      return options.snapshot ? options.snapshot(result) : result;
    },
    publish(bytes) {
      events.push('publish'); assert.equal(accepted, 6); assert.equal(current, null);
      assert.equal(events.filter(value => value.startsWith('accept:')).length, 6);
      assert.equal(bytes.at(-1), 10); assert.ok(bytes.every(byte => byte <= 127));
      written = Buffer.from(bytes); c = publicationCounts(bytes.length);
      options.event?.('publish', null, setClock);
      if (options.publishError) throw fixedError(options.publishError);
      publicationPhase = 'PUBLISHED_READBACK_MATCHED';
      const metadata = Object.fromEntries(Object.entries(stat(bytes.length, 200)).map(([key, value]) => [key, String(value)]));
      metadata.mode = '33060';
      const record = { state: publicationPhase, path: DESTINATION, byteLength: bytes.length, sha256: sha(bytes),
        mode: '0444', readbackVerified: true, directorySynced: true, fileMetadata: metadata, counts: c,
        sourceRootAuthentication: false, ancestorRacesExcluded: false, atomicCrashCommit: false,
        storageFailureSurvival: false, hardDeadlineGuaranteed: false, nativeQualified: false, abiQualified: false, authenticatedStorage: false };
      return options.record ? options.record(record) : record;
    },
    abort() { events.push('abortWriter'); publicationPhase = 'FAILED';
      if (options.writerAbortError) throw fixedError('E_IO');
      return { counts: c, closeFailed: options.abortUncertain ?? false, cleanupUncertain: options.abortUncertain ?? false }; },
  };
  const writer = { EVIDENCE_PUBLICATION_PATH: DESTINATION, EVIDENCE_PUBLICATION_LIMITS: source.writerLimits,
    reserveToolchainEvidencePublication(guard) {
      events.push('reserve'); guard(); options.event?.('reserve', null, setClock);
      assert.equal(events.some(value => value.startsWith('archive:')), false);
      assert.equal(sourceBackend.descriptors.size, 0);
      if (options.exists) throw fixedError('E_PUBLICATION_EXISTS');
      if (options.realWriterMemory) return deliveredWriter.createEvidencePublicationFixture({ mockOnly: true },
        { fs: options.realWriterMemory.fs, guard }).reserveToolchainEvidencePublication();
      return publisher;
    } };
  const stage = {
    verifyStagedXzImages() {
      events.push('stage'); options.event?.('stage', events.filter(value => value === 'stage').length, setClock);
      if (options.stageFailure === events.filter(value => value === 'stage').length) throw fixedError('E_METADATA');
      return { counters: { fsCalls: 80, readBytes: 2758216, closeAttempts: 5 } };
    },
    assertNoSystemPreload() { events.push('preload'); return !options.preload; },
  };
  const dependencies = { fs: sourceBackend.backend, now: () => options.now ? options.now(clock) : clock,
    spawn(...args) { events.push('spawn:' + args[1][10]); return new EventEmitter(); },
    async moduleImporter(target) {
      imports.push(target); options.event?.('import', imports.length, setClock);
      const text = decode(target);
      if (text.includes('// MOCK_ONLY_TOOLCHAIN_COLLECTOR')) return collector;
      if (text.includes('// MOCK_ONLY_TOOLCHAIN_WRITER')) return writer;
      if (text.includes('export const SOURCE_FORMAT_INSPECTORS')) return sdk;
      if (text.includes('export const GNU_SDK_DESCRIPTOR')) {
        const descriptor = JSON.parse(text.match(/export const GNU_SDK_DESCRIPTOR = Object\.freeze\((\{[\s\S]*?\})\);/)[1]);
        const index = INPUTS.findIndex(input => input.file === descriptor.file);
        return { GNU_SDK_DESCRIPTOR: descriptor, GNU_SDK_LIMITS: source.coreLimits,
          async runGnuSdkInventory(identity, d) {
            assert.deepEqual(identity, INPUTS[index].identity);
            assert.equal(events.includes('reserve'), true);
            events.push('archive:' + ROLES[index]); options.event?.('archive', index, setClock);
            await d.beforeDecode();
            const decoder = descriptor.decoderRoot;
            const child = d.spawn(decoder + '/ld-linux-x86-64.so.2', ['--inhibit-cache', '--glibc-hwcaps-mask', '',
              '--library-path', decoder, decoder + '/xz', '--decompress', '--stdout', '--format=xz', '--threads=1',
              '--memlimit-decompress=' + INPUTS[index].decoderMemoryBytes, '--', '-'],
            { cwd: decoder, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false,
              stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
            child.emit('spawn'); child.emit('close', 0, null);
            await d.afterDecode(); options.event?.('afterCore', index, setClock);
            if (options.coreFailure === index) throw fixedError(options.failureCode ?? 'E_HASH');
            const result = coreValue(index);
            return options.core ? options.core(result, index) : result;
          } };
      }
      if (text.includes('verifyStagedXzImages')) return stage;
      throw new Error('unrecognized captured module');
    },
  };
  const fixture = createToolchainEvidenceOperationFixture({ mockOnly: true, helperPins }, dependencies);
  return { fixture, dependencies, events, imports, collector, publisher, sourceBackend,
    setClock, get written() { return written; }, get clock() { return clock; } };
}
async function run(options = {}) {
  const h = harness(options), output = await h.fixture.run();
  assert.ok(Object.isFrozen(output)); assert.match(output.text, /^[\x00-\x7f]*\n$/);
  assert.ok(output.text.length <= 65536);
  return { h, output, receipt: JSON.parse(output.text) };
}
function assertStop(result, code) {
  assert.equal(result.output.exitCode, 1); assert.equal(result.receipt.status, 'STOP');
  assert.equal(result.receipt.publicationAccepted, false);
  if (code) assert.equal(result.receipt.error, code);
  for (const key of ['collection', 'members', 'selected', 'candidates', 'layout', 'texts', 'result']) assert.equal(Object.hasOwn(result.receipt, key), false);
  assert.equal(result.receipt.realArchiveInspected, false);
}
const throws = (fn, code) => assert.throws(fn, error => error.code === code);

test('fixed profile uses exact six ordered existing inputs and different root/file devices', () => {
  assert.deepEqual(ROLES, ['gnu-sdk', 'cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview']);
  assert.equal(INPUTS.reduce((total, input) => total + input.archiveBytes * 2, 0), 460138000);
  for (const [index, input] of INPUTS.entries()) {
    assert.equal(input.decoderMemoryBytes, index === 0 ? 16777216 : 268435456);
    assert.notEqual(input.identity.root.dev, input.identity.file.dev);
    for (const value of [input, input.identity, input.identity.root, input.identity.file]) assert.ok(Object.isFrozen(value));
    assert.equal(Object.keys(input.identity.file).length, 9);
  }
});
test('all controller limits retain independent 10/300/40/3/30 second scopes', () => {
  assert.deepEqual(LIMITS, { sourceMs: 10000, totalMs: 300000, roleMs: 40000, cleanupMs: 3000,
    publicationMs: 30000, roleAdmissionMs: 70000, sourceBytes: 1048576, sourceFsOperations: 8192,
    sourceReadsPerFile: 128, dataBytes: 16777216, receiptBytes: 65536, depth: 64, nodes: 1048576 });
});
test('production rejects arguments without running; pending invocation consumes permanently before any I/O', async () => {
  assert.equal(JSON.parse((await runRegisteredToolchainEvidenceCollectionV1({})).text).error, 'E_INPUT');
  if (PINS.collector === null) {
    const pending = JSON.parse((await runRegisteredToolchainEvidenceCollectionV1()).text);
    assert.equal(pending.error, 'E_HELPER_PENDING'); assert.equal(pending.repoCapture.openAttempts, 0);
    assert.equal(JSON.parse((await runRegisteredToolchainEvidenceCollectionV1()).text).error, 'E_INPUT');
  }
});
test('captured operation boots as a data URI without import.meta or relative imports', async () => {
  const bytes = readFileSync(REPO + '/tooling/native-ingress/toolchain-evidence-operation.mjs');
  assert.ok(bytes.toString().startsWith('// SPEC: _spec/tooling/native-ingress/step2.puml\n'));
  assert.doesNotMatch(bytes.toString(), /import\.meta|^import .*from ['"]\.\.?\//m);
  const operation = await import(uri(bytes));
  const result = await operation.runRegisteredToolchainEvidenceCollectionV1({ mockOnly: true });
  assert.equal(JSON.parse(result.text).error, 'E_INPUT');
});
test('production zero-argument one-shot contract holds in an explicitly fake builtin source graph', async () => {
  const bytes = readFileSync(REPO + '/tooling/native-ingress/toolchain-evidence-operation.mjs');
  const noIo = uri(`const stop = () => { throw new Error('MOCK_ONLY_NO_IO'); };
    export default Object.freeze({ constants: Object.freeze(${JSON.stringify({ O_RDONLY: constants.O_RDONLY,
      O_NOFOLLOW: constants.O_NOFOLLOW, O_NONBLOCK: constants.O_NONBLOCK })}),
      lstatSync: stop, openSync: stop, fstatSync: stop, readSync: stop, closeSync: stop });`);
  const noChild = uri("export const spawn = () => { throw new Error('MOCK_ONLY_NO_CHILD'); };\n");
  const text = source.replaceOnce(source.replaceOnce(bytes.toString(), "from 'node:fs'", "from '" + noIo + "'"),
    "from 'node:child_process'", "from '" + noChild + "'");
  const operation = await import(uri(text));
  assert.equal(JSON.parse((await operation.runRegisteredToolchainEvidenceCollectionV1('no overrides')).text).error, 'E_INPUT');
  const first = JSON.parse((await operation.runRegisteredToolchainEvidenceCollectionV1()).text);
  assert.equal(first.status, 'STOP'); assert.equal(first.error, 'E_IO'); assert.equal(first.repoCapture.openAttempts, 0);
  assert.equal(first.collectionCounts.spawnAttempts, 0);
  assert.equal(JSON.parse((await operation.runRegisteredToolchainEvidenceCollectionV1()).text).error, 'E_INPUT');
});
test('private TAR pins each extension and offset stage without changing the raw source', () => {
  const before = Buffer.from(retained.get('rawTar'));
  const transformed = source.transformTar(before);
  assert.deepEqual(pin(transformed), PINS.eventTar); assert.deepEqual(before, retained.get('rawTar'));
  assert.match(transformed.toString(), /size > 65_536 \|\| size > limits.maxExtensionBytes - extensionBytes/);
});
for (const [index, role] of ROLES.entries()) test(`private ${role} core lowers total to40s, keeps3s cleanup and correct memory`, () => {
  const stages = [], bytes = source.transformCore(retained.get('rawCore'), role, (name, data) => stages.push([name, pin(data)]));
  const text = bytes.toString();
  assert.match(text, /maxTotalMs: 40_000, cleanupMs: 3000/); assert.doesNotMatch(text, /45_000|120_000/);
  assert.match(text, /const selectors = Object.freeze\(\[\]\)/);
  assert.match(text, /maxStreamEvents: 262_144/); assert.match(text, /maxSummaryBytes: 4_194_304/);
  assert.match(text, new RegExp('--memlimit-decompress=' + INPUTS[index].decoderMemoryBytes));
  assert.deepEqual(stages.map(([name]) => name), ['descriptor', 'duration', 'events', 'summary', 'selectors', ...(index ? ['memory'] : [])]);
});
test('all six linked pipelines and the parent use one identical collector URI', () => {
  for (const target of graph.coreUris) assert.ok(decode(target).includes("from '" + graph.collectorUri + "'"));
  for (const name of ['tarLinkedCollector', 'elfLinkedCollector', 'linkedCollector', 'appendedSdk', 'tarLinkedSdk', 'linkedSdk']) assert.equal(graph.pins[name].sha256.length, 64);
  assert.ok(graph.outputs.appendedSdk.toString().endsWith('\nexport const SOURCE_FORMAT_INSPECTORS = Object.freeze({rel,archive,linker});\n'));
  assert.doesNotMatch(decode(graph.collectorUri), /from '\.\//);
});
test('source graph rejects duplicate or missing linking needles', () => {
  throws(() => source.link(Buffer.from("from './x.mjs'; from './x.mjs'"), 'x', uri('')), 'E_SOURCE_PIN');
  throws(() => source.link(Buffer.from(''), 'x', uri('')), 'E_SOURCE_PIN');
  throws(() => source.replaceOnce('aa', 'a', 'x'), 'E_SOURCE_PIN');
});
test('all fixed retained raw sources and selected receipt pins match before imports', () => {
  for (const [key] of source.rows) if (!['collector', 'writer'].includes(key)) assert.deepEqual(pin(retained.get(key)), PINS[key]);
  assert.equal(source.rows.length, 14);
  assert.ok(source.rows.every(([, path]) => path.startsWith(REPO + '/')));
  assert.ok(source.rows.every(([, path]) => !path.includes('/home/') && !path.endsWith('.result.json')));
});
test('source capture verifies exact size before allocation and positive-close/hash/EOF on one FD', () => {
  const io = sourceFs(), counts = source.captureCounts();
  const captured = source.captureSource('rawCore', io.backend, counts, () => {});
  assert.deepEqual(captured, retained.get('rawCore'));
  assert.equal(counts.allocations, 1); assert.equal(counts.allocatedBytes, PINS.rawCore.bytes + 1);
  assert.equal(counts.peakOwnedFds, 1); assert.equal(counts.ownedFds, 0);
  assert.equal(counts.closeAttempts, 1); assert.equal(counts.closes, 1);
  assert.equal(counts.completedCaptures, 1); assert.equal(counts.readAttempts, 2);
  assert.equal(counts.requestedBytes, PINS.rawCore.bytes + 1);
});
for (const [name, configuration, code] of [
  ['short read', { shortRead: true }, 'E_LENGTH'], ['positive EOF', { extraEof: true }, 'E_LENGTH'],
  ['source hash drift', { corrupt: true }, 'E_SOURCE_PIN'], ['read failure', { readError: true }, 'E_IO'],
  ['uncertain close', { closeError: true }, 'E_CLOSE'], ['missing source', { openError: true }, 'E_IO'],
  ['nonregular source', { stat: value => ({ ...value, mode: 0o120600n }) }, 'E_SOURCE_PIN'],
  ['size drift', { fdStat: value => ({ ...value, size: value.size + 1n }) }, 'E_SOURCE_PIN'],
  ['metadata identity drift', { fdStat: value => ({ ...value, ino: value.ino + 1n }) }, 'E_BINDING'],
]) test(`source ${name} stops, closes any acquired FD, never reserves or consumes artifacts`, async () => {
  const result = await run({ source: configuration }); assertStop(result, code);
  assert.equal(result.h.events.includes('reserve'), false); assert.equal(result.h.sourceBackend.descriptors.size, 0);
});
test('size mismatch allocates no source buffer', () => {
  const io = sourceFs({ stat: (value, path) => path === REPO ? value : ({ ...value, size: value.size + 1n }) });
  const counts = source.captureCounts();
  throws(() => source.captureSource('rawCore', io.backend, counts, () => {}), 'E_SOURCE_PIN');
  assert.equal(counts.allocations, 0); assert.equal(counts.openAttempts, 0);
});
test('source cleanup closes even when the original clock expires', () => {
  const io = sourceFs(); let checks = 0; const counts = source.captureCounts();
  throws(() => source.captureSource('rawCore', io.backend, counts, () => { if (++checks === 7) throw fixedError('E_DEADLINE'); }), 'E_DEADLINE');
  assert.equal(counts.closes, 1); assert.equal(io.descriptors.size, 0);
});
test('source global FS budget reserves a cleanup close', () => {
  const io = sourceFs(), counts = source.captureCounts(); counts.fsCalls = 8188;
  throws(() => source.captureSource('rawCore', io.backend, counts, () => {}), 'E_LIMIT');
  assert.ok(counts.fsCalls <= 8192); assert.equal(io.descriptors.size, 0);
});
test('source total allocation ceiling rejects before oversized allocation', () => {
  const io = sourceFs(), counts = source.captureCounts(); counts.allocatedBytes = 1048576 - PINS.rawCore.bytes;
  throws(() => source.captureSource('rawCore', io.backend, counts, () => {}), 'E_LIMIT');
  assert.equal(counts.allocations, 0); assert.equal(counts.closes, 1);
});
test('successful mock publishes only after all six ordered roles and returns a compact receipt', async () => {
  const result = await run(); assert.equal(result.output.exitCode, 0, result.output.text);
  const { h, receipt } = result;
  assert.equal(receipt.mockOnly, true); assert.equal(receipt.realArchiveInspected, false);
  assert.equal(receipt.publicationAccepted, true); assert.equal(receipt.path, DESTINATION);
  assert.deepEqual(h.events.filter(value => value.startsWith('archive:')), ROLES.map(role => 'archive:' + role));
  assert.equal(h.events.filter(value => value === 'stage').length, 12); assert.equal(h.events.filter(value => value === 'preload').length, 12);
  assert.equal(h.events.indexOf('reserve') < h.events.indexOf('archive:gnu-sdk'), true);
  assert.equal(h.events.indexOf('finish') < h.events.indexOf('publish'), true);
  assert.equal(h.imports.length, 10); assert.equal(h.imports[0], graph.collectorUri);
  assert.equal(receipt.sha256, sha(h.written)); assert.equal(receipt.byteLength, h.written.length);
  const data = JSON.parse(h.written);
  for (const key of ['publicationAccepted', 'selfDigest', 'publicationCounts', 'publication']) assert.equal(Object.hasOwn(data, key), false);
  assert.equal(Object.hasOwn(receipt, 'collection'), false);
  assert.equal(receipt.rawHistoricalResultsRestored, false);
});
test('successful synthetic counters retain12 passes/EOFs,12 archive closes,6 child closes and60 stage closes', async () => {
  const { receipt } = await run();
  assert.deepEqual(receipt.collectionCounts, { spawnAttempts: 6, spawnEvents: 6, ownedChildren: 0, peakChildren: 1,
    childCloses: 6, stageChecks: 12, preloadChecks: 12, stageFsCalls: 960, stageReadBytes: 33098592,
    stageCloses: 60, completedCorePasses: 6, archivePasses: 12, archiveDataBytes: 460138000,
    archiveRequestedBytes: 460138012, archiveCloseAttempts: 12, expandedBytes: 1148080640, streamEvents: 60, entries: 8675 });
  assert.equal(receipt.repoCapture.completedCaptures, 14); assert.equal(receipt.repoCapture.closes, 14);
  assert.equal(receipt.repoCapture.peakOwnedFds, 1);
});
test('EEXIST reservation stops before any archive or child consumption', async () => {
  const result = await run({ exists: true }); assertStop(result, 'E_PUBLICATION_EXISTS');
  assert.equal(result.h.events.some(value => value.startsWith('archive:') || value.startsWith('spawn:')), false);
  assert.equal(result.h.events.includes('begin'), false); assert.equal(result.h.written, null);
});
for (const code of ['E_HASH', 'E_TAR', 'E_METADATA', 'E_CLOSE', 'E_PIPE', 'E_DECODER']) test(`sixth late ${code} suppresses whole batch and aborts reserved publication`, async () => {
  const result = await run({ coreFailure: 5, failureCode: code }); assertStop(result, code);
  assert.ok(result.h.events.includes('abortWriter')); assert.ok(result.h.events.includes('abortCollector'));
  assert.equal(result.h.events.includes('publish'), false); assert.equal(result.h.written, null);
  assert.equal(result.h.collector.snapshotToolchainEvidenceBatch().acceptedRoles, 0);
});
test('late sixth role collection acceptance failure suppresses all earlier accepted roles', async () => {
  const result = await run({ acceptFailure: 'clippy-preview' }); assertStop(result, 'E_COLLECTION');
  assert.equal(result.h.events.includes('publish'), false); assert.equal(result.h.collector.snapshotToolchainEvidenceBatch().acceptedRoles, 0);
});
test('twelfth stage check failure never starts publication', async () => {
  const result = await run({ stageFailure: 12 }); assertStop(result, 'E_METADATA'); assert.equal(result.h.written, null);
});
test('preload failure remains a STOP without fallback', async () => { assertStop(await run({ preload: true }), 'E_PRELOAD'); });
for (const [name, mutation] of [
  ['GNU legacy metadata hash', c => { c.TOOLCHAIN_EVIDENCE_EXPECTATIONS = clone(expectations); c.TOOLCHAIN_EVIDENCE_EXPECTATIONS[0].metadataSha256 = '0'.repeat(64); }],
  ['Rust metadata hash', c => { c.TOOLCHAIN_EVIDENCE_EXPECTATIONS = clone(expectations); c.TOOLCHAIN_EVIDENCE_EXPECTATIONS[1].metadataSha256 = '0'.repeat(64); }],
  ['GNU fabricated old body SHA', c => { c.TOOLCHAIN_EVIDENCE_TARGETS = clone(targets); c.TOOLCHAIN_EVIDENCE_TARGETS[0].expectedSha256 = '0'.repeat(64); }],
  ['Rust selected SHA', c => { c.TOOLCHAIN_EVIDENCE_TARGETS = clone(targets); c.TOOLCHAIN_EVIDENCE_TARGETS[45].expectedSha256 = '0'.repeat(64); }],
  ['libmvec inferred span', c => { c.TOOLCHAIN_EVIDENCE_TARGETS = clone(targets); c.TOOLCHAIN_EVIDENCE_TARGETS[58].index = 1; }],
  ['missing role', c => { c.TOOLCHAIN_EVIDENCE_ROLES = ROLES.slice(1); }],
  ['lowered input descriptor', c => { c.TOOLCHAIN_EVIDENCE_INPUTS = clone(INPUTS); c.TOOLCHAIN_EVIDENCE_INPUTS[0].archiveBytes = 3; }],
]) test(`refuses ${name} constant drift before reservation`, async () => {
  const result = await run({ constants: mutation }); assertStop(result, 'E_COMPONENT');
  assert.equal(result.h.events.includes('reserve'), false);
});
for (const [name, mutation] of [
  ['missing EOF evidence', value => { value.archiveRequestedBytes--; }],
  ['incomplete close', value => { value.closeAttempts = 1; }],
  ['incomplete pipe', value => { value.stdoutEnded = false; }],
  ['failed decoder', value => { value.exitCode = 1; }],
  ['extra pass', value => { value.archivePasses = 3; }],
  ['over stream budget', value => { value.streamEvents = 262145; }],
  ['qualified flag', value => { value.nativeQualified = true; }],
]) test(`refuses sixth core ${name}`, async () => {
  const result = await run({ core(value, index) { if (index === 5) mutation(value); return value; } });
  assertStop(result, 'E_RECEIPT'); assert.equal(result.h.written, null);
});
for (const code of ['E_PUBLICATION_WRITE', 'E_PUBLICATION_CLOSE', 'E_PUBLICATION_HASH', 'E_PUBLICATION_EOF', 'E_PUBLICATION_IO', 'E_PUBLICATION_GUARD']) test(`${code} preserves unaccepted bytes and never reports success`, async () => {
  const result = await run({ publishError: code }); assertStop(result, code);
  assert.ok(result.h.written); assert.ok(result.h.events.includes('abortWriter')); assert.ok(result.h.events.includes('abortCollector'));
});
for (const [name, mutation] of [
  ['digest', record => { record.sha256 = '0'.repeat(64); }], ['length', record => { record.byteLength++; }],
  ['mode', record => { record.mode = '0600'; }], ['readback', record => { record.readbackVerified = false; }],
  ['directory fsync', record => { record.directorySynced = false; }], ['positive close count', record => { record.counts = { ...record.counts, closes: 2 }; }],
  ['inode metadata', record => { record.fileMetadata.ino = '0'; }], ['destination', record => { record.path = '/fixture/other'; }],
]) test(`controller refuses writer ${name} mismatch even after valid-looking file`, async () => {
  const result = await run({ record(record) { mutation(record); return record; } });
  assertStop(result); assert.ok(result.h.written);
});
test('writer uncertainty after success record remains unaccepted', async () => {
  const result = await run({ snapshot(value) { if (value.phase === 'PUBLISHED_READBACK_MATCHED') value.cleanupUncertain = true; return value; } });
  assertStop(result, 'E_PUBLICATION_RECORD'); assert.ok(result.h.written);
});
test('abort ignores an expired work clock but records close uncertainty', async () => {
  const result = await run({ publishError: 'E_PUBLICATION_GUARD', abortUncertain: true });
  assertStop(result, 'E_PUBLICATION_CLOSE'); assert.equal(result.receipt.abortUncertain, true);
});
for (const [name, option, code] of [['writer', 'writerAbortError', 'E_PUBLICATION_ABORT'], ['collector', 'collectorAbortError', 'E_COLLECTION_ABORT']]) test(`${name} abort failure returns only fixed cleanup evidence`, async () => {
  assertStop(await run({ coreFailure: 5, [option]: true }), code);
});
test('every role enforces remaining>=70000; exactly70000 admits and less rejects', async () => {
  const equal = await run({ event(name, role, set) { if (name === 'accept' && role === 'rustfmt-preview') set(230000); } });
  assert.equal(equal.output.exitCode, 0, equal.output.text);
  const below = await run({ event(name, role, set) { if (name === 'accept' && role === 'rustfmt-preview') set(230001); } });
  assertStop(below, 'E_DEADLINE'); assert.equal(below.h.events.includes('archive:clippy-preview'), false);
});
test('one role total40s includes its cleanup rather than adding3s', async () => {
  const result = await run({ event(name, index, set) { if (name === 'afterCore' && index === 0) set(40000); } });
  assertStop(result, 'E_DEADLINE'); assert.equal(result.h.events.includes('archive:cargo'), false);
});
test('40s role guard permits39999ms and never resets outer clock', async () => {
  let elapsed = 0;
  const result = await run({ event(name, index, set) { if (name === 'afterCore') { elapsed += 39999; set(elapsed); } } });
  assert.equal(result.output.exitCode, 0, result.output.text); assert.equal(result.h.clock, 239994);
});
test('source10s includes every linked import', async () => {
  const result = await run({ event(name, index, set) { if (name === 'import' && index === 10) set(10000); } });
  assertStop(result, 'E_DEADLINE'); assert.equal(result.h.events.includes('reserve'), false);
});
test('source10s starts before first capture', async () => {
  const result = await run({ event(name, value, set) { if (name === 'sourceRead') set(10000); } });
  assertStop(result, 'E_DEADLINE'); assert.equal(result.h.sourceBackend.descriptors.size, 0);
});
test('publication30s starts immediately after sixth acceptance and covers finish', async () => {
  const result = await run({ event(name, value, set) { if (name === 'finish') set(30000); } });
  assertStop(result, 'E_DEADLINE'); assert.equal(result.h.events.includes('publish'), false);
});
test('publication30s includes write/readback and leaves valid-looking file unaccepted on late clock', async () => {
  const result = await run({ event(name, value, set) { if (name === 'publish') set(30000); } });
  assertStop(result, 'E_DEADLINE'); assert.ok(result.h.written);
});
for (const [name, now] of [['NaN', () => NaN], ['infinity', () => Infinity], ['overflow', () => Number.MAX_VALUE]]) test(`${name} original clock rejects before archive consumption`, async () => {
  const result = await run({ now }); assertStop(result, 'E_CLOCK'); assert.equal(result.h.written, null);
});
test('backwards original clock never establishes acceptance', async () => {
  const result = await run({ event(name, index, set) { if (name === 'import') set(index === 2 ? -1 : 1); } });
  assertStop(result, 'E_CLOCK');
});
test('own-data ASCII uses six bytes per UTF16 nonASCII unit including lone surrogates', () => {
  const value = { a: 'é😀\ud800\u0000\n\b\t\f\r"\\' }, encoded = source.asciiJson(value, 1024);
  assert.equal(encoded, '{"a":"\\u00e9\\ud83d\\ude00\\ud800\\u0000\\n\\b\\t\\f\\r\\\"\\\\"}\n');
  assert.deepEqual(JSON.parse(encoded), value);
});
for (const maximum of [65536, 16777216]) test(`ASCII LF exact${maximum} boundary accepts and+1 rejects before serialization`, () => {
  const value = { x: 'x'.repeat(maximum - 10) };
  assert.equal(source.asciiJson(value, maximum).length, maximum - 1);
  value.x += 'x'; assert.equal(source.asciiJson(value, maximum).length, maximum);
  value.x += 'x'; throws(() => source.asciiJson(value, maximum), 'E_OUTPUT');
});
test('Unicode expansion rather than UTF8 length enforces output cap', () => {
  throws(() => source.asciiJson({ x: 'é'.repeat(100) }, 500), 'E_OUTPUT');
});
for (const [name, make] of [
  ['accessor', () => Object.defineProperty({}, 'x', { enumerable: true, get() { throw new Error('getter must not run'); } })],
  ['proxy', () => new Proxy({}, { ownKeys() { throw new Error('proxy must not run'); } })],
  ['toJSON', () => ({ toJSON() { throw new Error('must not run'); } })],
  ['symbol', () => ({ [Symbol('x')]: 1 })], ['sparse array', () => new Array(2)],
  ['typed array', () => Buffer.from('x')], ['inherited object', () => Object.create({ x: 1 })],
  ['undefined', () => ({ x: undefined })], ['nonfinite', () => ({ x: NaN })],
  ['cyclic', () => { const value = {}; value.x = value; return value; }],
]) test(`own-data serializer refuses ${name} without invoking hooks`, () => { throws(() => source.asciiJson(make(), 65536), 'E_OUTPUT'); });
test('own-data depth64 and1M node gates reject oversized structures', () => {
  let value = null; for (let i = 0; i < 66; i++) value = { x: value };
  throws(() => source.asciiJson(value, 65536), 'E_OUTPUT');
  throws(() => source.asciiJson(new Array(1048576).fill(null), 16777216), 'E_OUTPUT');
});
for (const name of ['nativeQualified', 'rustReady', 'trainingReady', 'pythonFreeSubsetVerified', 'rawHistoricalResultsRestored', 'imagePrepared']) test(`refuses elevated nested ${name} assertion`, async () => {
  const result = await run({ collection(value) { value.roles[0][name] = true; return value; } });
  assertStop(result, 'E_RECEIPT'); assert.equal(result.h.written, null);
});
test('malicious final collection getter never executes and withholds all data', async () => {
  let invoked = false;
  const result = await run({ collection(value) { Object.defineProperty(value, 'members', { enumerable: true, get() { invoked = true; return []; } }); return value; } });
  assertStop(result, 'E_OUTPUT'); assert.equal(invoked, false); assert.equal(result.h.written, null);
});
for (const [name, mutation] of [
  ['partial roles', value => { value.roles.pop(); }], ['role reordering', value => { value.roles.reverse(); }],
  ['missing counts', value => { delete value.entries; }], ['missing regular files', value => { delete value.regularFiles; }],
  ['mock flag', value => { value.mockOnly = true; }], ['incomplete state', value => { value.state = 'PARTIAL'; }],
  ['missing namespace', value => { delete value.roles[5].members; }],
  ['partial namespace', value => { value.roles[5].members.pop(); }],
  ['missing regular body hash', value => { delete value.roles[0].members[0].bodySha256; }],
  ['nonregular fabricated body hash', value => { value.roles[0].members.at(-1).bodySha256 = sha(''); }],
  ['duplicate member path', value => { value.roles[0].members[1].path = value.roles[0].members[0].path; }],
  ['parent-path escape', value => { value.roles[0].members[0].path = INPUTS[0].expectedRoot + '/../escape'; }],
  ['decoded hash mismatch', value => { value.roles[5].decodedSha256 = '0'.repeat(64); }],
  ['Rust offset metadata mismatch', value => { value.roles[5].metadataSha256 = '0'.repeat(64); }],
  ['missing selected metadata', value => { delete value.roles[0].selected[0].metadata; }],
  ['partial selected list', value => { value.roles[0].selected.pop(); }],
  ['fabricated fresh body hash', value => { value.roles[0].selected[0].bodySha256 = '0'.repeat(64); }],
  ['libmvec fallback alias', value => { value.roles[0].selected.find(row => row.selectionRole === 'TARGET_LIBMVEC_PROVIDER').path += '.alias'; }],
  ['missing full manifests', value => { value.roles[5].manifests.pop(); }],
  ['modified full manifest', value => { value.roles[5].manifests[0].text += 'drift'; }],
  ['qualified edge', value => { value.declaredNeededEdges.push({ status: 'RESOLVED', providerQualified: false, abiVerified: false, aliasFollowed: false, hostTargetPromotion: false }); }],
]) test(`final collection ${name} never reaches writer`, async () => {
  const result = await run({ collection(value) { mutation(value); return value; } }); assertStop(result, 'E_COLLECTION'); assert.equal(result.h.written, null);
});
test('fixture runner is permanently one-shot and cannot redirect destination', async () => {
  const h = harness(); assert.equal((await h.fixture.run()).exitCode, 0);
  assert.equal(JSON.parse((await h.fixture.run()).text).error, 'E_INPUT');
  assert.equal(JSON.parse((await h.fixture.run('/other')).text).error, 'E_INPUT');
  throws(() => createToolchainEvidenceOperationFixture({ mockOnly: true, helperPins, path: '/other' }, h.dependencies), 'E_INPUT');
});
test('fixture refuses missing complete capabilities, accessors, proxies and real production providers', () => {
  const h = harness();
  throws(() => createToolchainEvidenceOperationFixture({ mockOnly: false, helperPins }, h.dependencies), 'E_INPUT');
  throws(() => createToolchainEvidenceOperationFixture({ mockOnly: true, helperPins }, { ...h.dependencies, fs: {} }), 'E_COMPONENT');
  throws(() => createToolchainEvidenceOperationFixture({ mockOnly: true, helperPins }, new Proxy({}, {})), 'E_INPUT');
  const deps = { ...h.dependencies }; Object.defineProperty(deps, 'now', { get() { throw new Error('must not run'); } });
  throws(() => createToolchainEvidenceOperationFixture({ mockOnly: true, helperPins }, deps), 'E_INPUT');
});
test('malicious publisher abort getter never executes during failure cleanup', async () => {
  const h = harness(); let invoked = false;
  Object.defineProperty(h.publisher, 'abort', { get() { invoked = true; throw new Error('must not run'); } });
  const output = await h.fixture.run(), receipt = JSON.parse(output.text);
  assertStop({ h, output, receipt }, 'E_PUBLICATION_ABORT'); assert.equal(invoked, false); assert.equal(h.written, null);
});

function publicationMemory(options = {}) {
  const directory = REPO + '/_spec/tooling/native-ingress';
  const paths = [REPO, REPO + '/_spec', REPO + '/_spec/tooling', directory];
  const nodes = new Map(paths.map((path, index) => [path, { ...stat(4096, 100 + index, true), data: Buffer.alloc(0) }]));
  const fds = new Map(), calls = [];
  let next = 100;
  const copy = value => Object.fromEntries(Object.keys(stat(0)).map(key => [key, value[key]]));
  const backend = {
    lstatSync(path) { if (!nodes.has(path)) throw fixedError('ENOENT'); return copy(nodes.get(path)); },
    fstatSync(fd) { assert.ok(fds.has(fd)); return copy(fds.get(fd)); },
    openSync(path, flags, mode) {
      assert.ok(flags & constants.O_NOFOLLOW); assert.ok(flags & constants.O_NONBLOCK);
      if (flags & constants.O_CREAT) {
        assert.equal(path, DESTINATION); assert.equal(mode, 0o600); assert.ok(flags & constants.O_EXCL);
        if (nodes.has(path)) throw fixedError('EEXIST');
        nodes.set(path, { ...stat(0, 300), data: Buffer.alloc(0) });
        nodes.get(directory).mtimeNs++; nodes.get(directory).ctimeNs++;
      }
      assert.ok(nodes.has(path)); const fd = next++; fds.set(fd, nodes.get(path)); return fd;
    },
    fsyncSync(fd) { assert.ok(fds.has(fd)); },
    fchmodSync(fd, mode) { assert.equal(mode, 0o444); fds.get(fd).mode = 0o100444n; fds.get(fd).ctimeNs++; },
    writeSync(fd, bytes, offset, length, position) {
      const value = fds.get(fd); assert.ok(value); assert.ok(length <= 65536);
      const next = Buffer.alloc(Math.max(value.data.length, position + length));
      value.data.copy(next); bytes.copy(next, position, offset, offset + length);
      value.data = next; value.size = BigInt(next.length); value.mtimeNs++; value.ctimeNs++; return length;
    },
    readSync(fd, bytes, offset, length, position) {
      const value = fds.get(fd); assert.ok(value);
      const amount = Math.min(length, options.readCap ?? Infinity, Math.max(0, value.data.length - position));
      value.data.copy(bytes, offset, position, position + amount); return amount;
    },
    closeSync(fd) { assert.ok(fds.has(fd)); fds.delete(fd); },
  };
  const captured = Object.fromEntries(Object.entries(backend).map(([name, method]) => [name, (...args) => {
    calls.push({ name, args }); options.before?.(name, args, nodes, fds);
    return method(...args);
  }]));
  return { fs: captured, nodes, fds, calls, file: () => nodes.get(DESTINATION) };
}
const deliveredWriterBytes = readFileSync(REPO + '/tooling/native-ingress/evidence-publication.mjs');
assert.deepEqual(pin(deliveredWriterBytes), PINS.writer);
const deliveredWriter = await import(uri(deliveredWriterBytes));
test('DELIVERED writer source imports from checked data URI and matches controller record/limits against pure fake FS', () => {
  const memory = publicationMemory(), fixture = deliveredWriter.createEvidencePublicationFixture({ mockOnly: true },
    { fs: memory.fs, guard() {} });
  assert.equal(deliveredWriter.EVIDENCE_PUBLICATION_PATH, DESTINATION);
  assert.deepEqual(deliveredWriter.EVIDENCE_PUBLICATION_LIMITS, source.writerLimits);
  const publisher = fixture.reserveToolchainEvidencePublication();
  assert.equal(publisher.snapshot().ownedFDCount, 2); assert.equal(memory.file().data.length, 0);
  const bytes = Buffer.from('{"collection":{"mockOnly":true,"complete":true}}\n');
  const record = publisher.publish(bytes);
  source.validatePublication(record, publisher.snapshot(), bytes.length, sha(bytes));
  assert.deepEqual(memory.file().data, bytes); assert.equal(memory.file().mode, 0o100444n);
  assert.equal(memory.fds.size, 0); assert.equal(record.counts.fsyncs, 4); assert.equal(record.counts.closes, 3);
  assert.equal(Object.hasOwn(record, 'publicationAccepted'), false);
});
function deliveredPartialPublication() {
  const memory = publicationMemory({ readCap: 7 }), publisher = deliveredWriter.createEvidencePublicationFixture({ mockOnly: true },
    { fs: memory.fs, guard() {} }).reserveToolchainEvidencePublication();
  const bytes = Buffer.from('{"collection":{"mockOnly":true,"complete":true}}\n');
  const record = publisher.publish(bytes);
  return { memory, publisher, bytes, record, snapshot: publisher.snapshot() };
}
test('DELIVERED positive partial readback requests pass validation within the unchanged fixed request budget', () => {
  const { memory, bytes, record, snapshot } = deliveredPartialPublication();
  assert.ok(record.counts.requestedReadBytes > bytes.length + 1);
  assert.ok(record.counts.requestedReadBytes <= source.writerLimits.maxRequestedReadBytes);
  assert.equal(record.counts.readbackBytes, bytes.length); assert.equal(record.counts.readbackHashBytes, bytes.length);
  assert.equal(record.counts.readAttempts, Math.ceil(bytes.length / 7) + 1);
  assert.equal(record.counts.closes, 3); assert.equal(record.counts.fsyncs, 4);
  const lastRead = memory.calls.filter(call => call.name === 'readSync').at(-1);
  assert.equal(lastRead.args[3], 1); assert.equal(lastRead.args[4], bytes.length);
  assert.deepEqual(memory.file().data, bytes); assert.equal(memory.fds.size, 0);
  source.validatePublication(record, snapshot, bytes.length, sha(bytes));
});
test('full captured-module controller accepts DELIVERED writer positive partial reads without changing any production bounds', async () => {
  const memory = publicationMemory({ readCap: 32768 }), result = await run({ realWriterMemory: memory });
  assert.equal(result.output.exitCode, 0, result.output.text); assert.equal(result.receipt.publicationAccepted, true);
  const bytes = memory.file().data, counts = result.receipt.publicationCounts;
  assert.ok(counts.requestedReadBytes > bytes.length + 1);
  assert.ok(counts.requestedReadBytes <= 16777217); assert.equal(source.writerLimits.maxRequestedReadBytes, 16777217);
  assert.equal(counts.readbackBytes, bytes.length); assert.equal(counts.readbackHashBytes, bytes.length);
  assert.equal(counts.closes, 3); assert.equal(counts.fsyncs, 4); assert.equal(counts.closeAttempts, 3);
  assert.equal(result.receipt.byteLength, bytes.length); assert.equal(result.receipt.sha256, sha(bytes));
  assert.equal(memory.file().mode, 0o100444n); assert.equal(memory.fds.size, 0);
  assert.equal(result.h.imports.length, 10); assert.equal(result.h.events.filter(event => event.startsWith('archive:')).length, 6);
  assert.equal(Object.hasOwn(JSON.parse(bytes), 'publicationAccepted'), false);
});
for (const [name, amount] of [['underreported', length => length], ['above fixed cap', () => 16777218]]) {
  test(`DELIVERED partial-read publication rejects ${name} requested-byte accounting`, () => {
    const actual = deliveredPartialPublication(), record = clone(actual.record), snapshot = clone(actual.snapshot);
    record.counts.requestedReadBytes = amount(actual.bytes.length); snapshot.counts.requestedReadBytes = record.counts.requestedReadBytes;
    throws(() => source.validatePublication(record, snapshot, actual.bytes.length, sha(actual.bytes)), 'E_PUBLICATION_RECORD');
  });
}
for (const [name, mutation] of [
  ['readback bytes', counts => { counts.readbackBytes--; }],
  ['readback hash bytes', counts => { counts.readbackHashBytes--; }],
  ['read attempts', counts => { counts.readAttempts = 1025; }],
  ['positive closes', counts => { counts.closes = 2; }],
  ['fsync gates', counts => { counts.fsyncs = 3; }],
]) test(`positive partial requests do not relax ${name} validation`, () => {
  const actual = deliveredPartialPublication(), record = clone(actual.record), snapshot = clone(actual.snapshot);
  mutation(record.counts); snapshot.counts = clone(record.counts);
  throws(() => source.validatePublication(record, snapshot, actual.bytes.length, sha(actual.bytes)), 'E_PUBLICATION_RECORD');
});
for (const name of ['writeSync', 'closeSync', 'fsyncSync', 'readSync']) test(`DELIVERED writer actual ${name} failure never yields accepted publication`, () => {
  let armed = false;
  const memory = publicationMemory({ before(method) { if (armed && method === name) throw fixedError('EIO'); } });
  const fixture = deliveredWriter.createEvidencePublicationFixture({ mockOnly: true }, { fs: memory.fs, guard() {} });
  const publisher = fixture.reserveToolchainEvidencePublication(); armed = true;
  assert.throws(() => publisher.publish(Buffer.from('{"collection":{"mockOnly":true}}\n')));
  const snapshot = publisher.snapshot();
  assert.equal(snapshot.phase, 'FAILED'); assert.equal(snapshot.ownedFDCount, 0);
  assert.ok(memory.file()); assert.equal(Object.hasOwn(snapshot, 'publicationAccepted'), false);
});

const deliveredSources = new Map(source.rows.map(([key, path]) => [key, readFileSync(path)]));
for (const [key, bytes] of deliveredSources) assert.deepEqual(pin(bytes), PINS[key]);
const deliveredGraph = source.prepareSourceGraph(deliveredSources, GRAPH_PINS, false);
const deliveredCollector = await import(deliveredGraph.collectorUri);
const deliveredTar = await import(uri(deliveredGraph.outputs.eventTar));
const deliveredFormats = await import(deliveredGraph.sdkUri);
const deliveredElf = await import(uri(deliveredSources.get('elfV5')));
test('DELIVERED pinned raw collector production SDK relocation constants bind the authoritative selected manifest receipt', () => {
  const bytes = deliveredSources.get('collector'), raw = bytes.toString('utf8');
  assert.deepEqual(pin(bytes), { bytes: 48345, sha256: 'a59213bf419d509d222d84e8a870ff4fb895f510a058a956725c84e47e154365' });
  assert.deepEqual(pin(bytes), PINS.collector);
  const receipt = JSON.parse(readFileSync(REPO + '/_spec/tooling/native-ingress/gnu-sdk-manifest-membership.receipt.json', 'utf8'));
  assert.equal(receipt.status, 'MANIFEST_MEMBERSHIP_OBSERVED');
  const hash = [...raw.matchAll(/^const SDK_RELOCS_SHA256 = '([0-9a-f]+)';$/gm)];
  const length = [...raw.matchAll(/^const SDK_RELOCS_BYTES = ([0-9]+);$/gm)];
  assert.equal(hash.length, 1); assert.equal(length.length, 1);
  assert.match(receipt.manifest.sha256, /^[0-9a-f]{64}$/);
  assert.equal(hash[0][1], receipt.manifest.sha256);
  assert.equal(Number(length[0][1]), receipt.manifest.byteLength); assert.equal(receipt.manifest.byteLength, 9367);
  assert.ok(raw.includes("if (!mockOnly && b.manifest === 'GNU_RAW_TEXT' && b.event.path.endsWith('/sdk-relocs')\n" +
    '        && (b.event.size !== SDK_RELOCS_BYTES || sha256 !== SDK_RELOCS_SHA256))'));
  assert.ok(raw.includes("if (!mockOnly && active.input.role === 'gnu-sdk' && p.size !== (p.path.endsWith('/sdk-relocs') ? SDK_RELOCS_BYTES : 79))"));
});
test('DELIVERED checked raw/intermediate/final graph matches every manifest pin before execution', async () => {
  assert.deepEqual(deliveredGraph.pins, GRAPH_PINS);
  assert.equal(deliveredGraph.pins.appendedSdk.bytes, 31647);
  source.compareConstants(deliveredCollector, deliveredFormats, receipts);
  const cores = await Promise.all(deliveredGraph.coreUris.map(target => import(target)));
  for (let i = 0; i < 6; i++) {
    assert.ok(decode(deliveredGraph.coreUris[i]).includes("from '" + deliveredGraph.collectorUri + "'"));
    assert.deepEqual(cores[i].GNU_SDK_DESCRIPTOR, source.descriptorFor(INPUTS[i]));
    assert.deepEqual(cores[i].GNU_SDK_LIMITS, source.coreLimits);
  }
  assert.equal(await import(deliveredGraph.collectorUri), deliveredCollector);
  assert.equal(deliveredCollector.TOOLCHAIN_EVIDENCE_LIMITS.maxAggregatePayloadBytes, 805306368);
  assert.equal(deliveredElf.ELF_REQUIREMENTS_V5_LIMITS.maxInputBytes, 268435456);
  assert.deepEqual(Object.keys(deliveredFormats.SOURCE_FORMAT_INSPECTORS), ['rel', 'archive', 'linker']);
});
function tarMember(path, body = Buffer.alloc(0), type = '0', linkpath = '') {
  const header = Buffer.alloc(512), slash = path.lastIndexOf('/');
  if (Buffer.byteLength(path) > 100) { header.write(path.slice(slash + 1), 0, 100); header.write(path.slice(0, slash), 345, 155); }
  else header.write(path, 0, 100);
  for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, body.length], [136, 12, 0]]) {
    header.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  }
  header[156] = type.charCodeAt(0); header.write(linkpath, 157, 100);
  header.write('ustar\0', 257, 6); header.write('00', 263, 2);
  header.fill(32, 148, 156);
  header.write(header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return Buffer.concat([header, body, Buffer.alloc((512 - body.length % 512) % 512)]);
}
function minimalElf(type = 3) {
  const bytes = Buffer.alloc(type === 1 ? 128 : 512);
  bytes.set([127, 69, 76, 70, 2, 1, 1]); bytes.writeUInt16LE(type, 16); bytes.writeUInt16LE(62, 18);
  bytes.writeUInt32LE(1, 20); bytes.writeUInt16LE(64, 52); bytes.writeUInt16LE(type === 1 ? 0 : 56, 54);
  if (type === 1) { bytes.writeBigUInt64LE(64n, 40); bytes.writeUInt16LE(64, 58); bytes.writeUInt16LE(1, 60); }
  return bytes;
}
function minimalAr() {
  const body = minimalElf(1), field = (value, width) => String(value).padEnd(width, ' ');
  return Buffer.concat([Buffer.from('!<arch>\n'), Buffer.from(field('obj.o/', 16) + field(0, 12) +
    field(0, 6) + field(0, 6) + field('644', 8) + field(body.length, 10) + '`\n'), body]);
}
function actualFixtureProfile(options = {}) {
  const archives = [], selected = new Map(), expected = [], bodies = new Map();
  for (let index = 0; index < 6; index++) {
    const input = INPUTS[index], root = input.expectedRoot, parts = [];
    const add = (path, body = Buffer.alloc(0), type = '0', linkpath = '') => {
      parts.push(tarMember(path, body, type, linkpath)); if (type === '0') bodies.set(path, Buffer.from(body));
    };
    add(root, Buffer.alloc(0), '5');
    if (index === 0) {
      add(root + '/share/buildroot/sdk-relocs', Buffer.from('MOCK_ONLY_RELOCATIONS\n'));
      add(root + '/share/buildroot/sdk-location', Buffer.from('/fixture/original\n'));
    } else {
      const component = input.role === 'rust-std' ? 'rust-std-x86_64-unknown-linux-gnu' : input.role;
      add(root + '/components', Buffer.from(component + '\n'));
      add(root + '/rust-installer-version', Buffer.from('3\n'));
      add(root + '/' + component + '/manifest.in', Buffer.from('file:bin/tool\nopaque-future:verbatim\n'));
    }
    add(root + '/unselected-license', Buffer.from('许可证\n'));
    if (options.links && index === 0) {
      add(root + '/mock-symlink', Buffer.alloc(0), '2', 'unselected-license');
      add(root + '/mock-hardlink', Buffer.alloc(0), '1', root + '/unselected-license');
    }
    for (const target of deliveredCollector.TOOLCHAIN_EVIDENCE_TARGETS.filter(row => row.artifactRole === input.role)
      .sort((a, b) => (a.index ?? 10000) - (b.index ?? 10000))) {
      const body = target.kind === 'ELF_EXEC_DSO' ? minimalElf() : target.kind === 'ET_REL' ? minimalElf(1) :
        target.kind === 'AR' ? minimalAr() : Buffer.from('INPUT ( libfixture.so )\n');
      const bodyOffset = parts.reduce((total, bytes) => total + bytes.length, 0) + 512;
      selected.set(target.path, { ...target, index: target.index === null ? null : parts.length + 1,
        bodyOffset: target.bodyOffset === null ? null : bodyOffset, size: target.size === null ? null : body.length,
        expectedSha256: target.expectedSha256 === null ? null : sha(body) });
      add(target.path, body);
    }
    const bytes = Buffer.concat([...parts, Buffer.alloc(1024)]), parser = deliveredTar.createTarInventory();
    const events = [];
    for (let at = 0; at < bytes.length; at += 65536) events.push(...parser.feed(bytes.subarray(at, at + 65536)));
    const summary = parser.finish();
    const legacy = events.map(event => {
      const { index, path, type, size, mode, uid, gid, mtime } = event;
      return JSON.stringify({ index, path, type, size,
        ...(['symlink', 'hardlink'].includes(type) ? { linkpath: event.linkpath, linkKind: event.linkKind } : {}),
        mode, uid, gid, mtime }) + '\n';
    }).join('');
    expected.push({ ...expectations[index], expandedBytes: bytes.length, entries: summary.entries, headers: summary.headers,
      regularFiles: events.filter(event => event.type === 'file').length, decodedSha256: sha(bytes),
      metadataSha256: index === 0 ? sha(legacy) : summary.metadataSha256 });
    archives.push(bytes);
  }
  return { archives, bodies, profile: { mockOnly: true,
    inputs: INPUTS.map((input, index) => { const root = '/fixture/controller-delivered-' + index, archiveBytes = index + 3;
      return { ...input, root, file: root + '/' + input.expectedRoot + '.tar.xz', archiveBytes,
        archiveSha256: sha('MOCK_ONLY_COMPRESSED:' + index), identity: { root: { ...input.identity.root, ino: String(index + 1) },
          file: { ...input.identity.file, ino: String(index + 10), size: String(archiveBytes) } } }; }),
    targets: deliveredCollector.TOOLCHAIN_EVIDENCE_TARGETS.map(target => selected.get(target.path)), expectations: expected, limits: {} } };
}
function deliveredBatch(p) {
  return deliveredCollector.createToolchainEvidenceFixture(p, {
    parserFactory: deliveredTar.createTarInventory,
    elfInspector: deliveredElf.inspectElf64RequirementsV5,
    formatInspectors: deliveredFormats.SOURCE_FORMAT_INSPECTORS,
  });
}
function parseDelivered(batch, fixture, index) {
  batch.beginToolchainEvidenceRole(ROLES[index]); const parser = batch.createTarInventory();
  const bytes = fixture.archives[index];
  for (let at = 0; at < bytes.length; at += 513) parser.feed(bytes.subarray(at, at + 513));
  const inventory = parser.finish(), input = fixture.profile.inputs[index];
  return { ...coreValue(index), mockOnly: true, archiveBytes: input.archiveBytes, archiveSha256: input.archiveSha256,
    archiveDataBytes: input.archiveBytes * 2, archiveRequestedBytes: input.archiveBytes * 2 + 2, inventory,
    extracted: false, extractionAuthorized: false, installedUsability: false, decoderQualified: false,
    provenanceVerified: false, hardRssBounded: false, processTreeBounded: false, hardDeadlineGuaranteed: false };
}
test('DELIVERED collector+ELF5+private SDK formats+offset TAR+writer integrate with complete pure fake capabilities', () => {
  const fixture = actualFixtureProfile(), batch = deliveredBatch(fixture.profile);
  batch.beginToolchainEvidenceBatch();
  for (let index = 0; index < 6; index++) batch.acceptToolchainEvidenceRole(parseDelivered(batch, fixture, index));
  const collection = batch.finishToolchainEvidenceBatch();
  assert.equal(collection.mockOnly, true); assert.equal(collection.roles.length, 6); assert.equal(collection.selectedPayloads, 59);
  assert.equal(collection.completeNamespace, true);
  for (const role of collection.roles) {
    for (const member of role.members.filter(row => row.type === 'file')) assert.equal(member.bodySha256, sha(fixture.bodies.get(member.path)));
    for (const manifest of role.manifests) {
      assert.equal(manifest.interpreted, false); assert.equal(manifest.text, fixture.bodies.get(manifest.path).toString('utf8'));
    }
    for (const selected of role.selected) assert.ok(selected.metadata);
  }
  assert.equal(collection.roles[0].legacyMetadataSha256, fixture.profile.expectations[0].metadataSha256);
  assert.notEqual(collection.roles[0].offsetMetadataSha256, collection.roles[0].legacyMetadataSha256);
  assert.equal(collection.nativeQualified, false); assert.equal(collection.pythonFreeSubsetVerified, false);
  const bytes = Buffer.from(source.asciiJson({ profile: 'registered-toolchain-evidence-collection-v1', mockOnly: true,
    rawHistoricalResultsRestored: false, collection }, 16777216), 'ascii');
  const memory = publicationMemory(), publisher = deliveredWriter.createEvidencePublicationFixture({ mockOnly: true },
    { fs: memory.fs, guard() {} }).reserveToolchainEvidencePublication();
  const record = publisher.publish(bytes);
  source.validatePublication(record, publisher.snapshot(), bytes.length, sha(bytes));
  assert.equal(memory.fds.size, 0); assert.deepEqual(memory.file().data, bytes);
  assert.equal(Object.hasOwn(JSON.parse(bytes), 'publicationAccepted'), false);
  assert.equal(batch.snapshotToolchainEvidenceBatch().acceptedRoles, 0);
});
for (const kind of ['decoded', 'metadata', 'body']) test(`DELIVERED late sixth ${kind} hash mismatch withholds entire fixture before writer`, () => {
  const fixture = actualFixtureProfile();
  if (kind === 'body') fixture.profile.targets.find(target => target.artifactRole === 'clippy-preview').expectedSha256 = '0'.repeat(64);
  else fixture.profile.expectations[5][kind === 'decoded' ? 'decodedSha256' : 'metadataSha256'] = '0'.repeat(64);
  const batch = deliveredBatch(fixture.profile); batch.beginToolchainEvidenceBatch();
  for (let index = 0; index < 5; index++) batch.acceptToolchainEvidenceRole(parseDelivered(batch, fixture, index));
  assert.throws(() => parseDelivered(batch, fixture, 5), error => error.code ===
    (kind === 'decoded' ? 'E_EVIDENCE_DECODED_HASH' : kind === 'metadata' ? 'E_EVIDENCE_METADATA_HASH' : 'E_EVIDENCE_BODY_HASH'));
  assert.equal(batch.snapshotToolchainEvidenceBatch().acceptedRoles, 0);
  assert.throws(() => batch.finishToolchainEvidenceBatch()); batch.abortToolchainEvidenceBatch();
});
let representativeNonregular;
function deliveredNonregularRecords() {
  if (representativeNonregular) return representativeNonregular;
  const fixture = actualFixtureProfile({ links: true }), batch = deliveredBatch(fixture.profile);
  batch.beginToolchainEvidenceBatch();
  for (let index = 0; index < 6; index++) batch.acceptToolchainEvidenceRole(parseDelivered(batch, fixture, index));
  representativeNonregular = batch.finishToolchainEvidenceBatch().roles[0].members.filter(member => member.type !== 'file');
  assert.deepEqual(representativeNonregular.map(member => member.type), ['directory', 'symlink', 'hardlink']);
  for (const member of representativeNonregular) {
    assert.equal(member.size, 0); assert.equal(member.bodySha256, null); assert.equal(member.linkFollowed, false);
    assert.ok(Object.hasOwn(member, 'bodySha256')); assert.ok(Object.hasOwn(member, 'linkFollowed')); assert.ok(Object.isFrozen(member));
  }
  return representativeNonregular;
}
function retainActualNonregular(collection, member) {
  const members = collection.roles[0].members, index = member.index - 1, displaced = members[index];
  assert.equal(displaced.type, 'file');
  const vacant = members.findLastIndex(candidate => candidate.type === 'directory');
  assert.ok(vacant > index);
  members[vacant] = { ...displaced, index: vacant + 1 };
  members[index] = member;
}
for (const type of ['directory', 'symlink', 'hardlink']) {
  test(`full controller accepts unchanged DELIVERED ${type} record with null body hash and inert link flag`, async () => {
    const member = deliveredNonregularRecords().find(candidate => candidate.type === type);
    const result = await run({ collection(value) { retainActualNonregular(value, member); return value; } });
    assert.equal(result.output.exitCode, 0, result.output.text); assert.equal(result.receipt.publicationAccepted, true);
    const retainedMember = JSON.parse(result.h.written).collection.roles[0].members[member.index - 1];
    assert.deepEqual(retainedMember, member);
    assert.equal(retainedMember.bodySha256, null); assert.equal(retainedMember.linkFollowed, false);
  });
  for (const [name, mutation] of [
    ['hex body SHA', member => { member.bodySha256 = sha(''); }],
    ['nonhex body SHA string', member => { member.bodySha256 = 'not-a-body-hash'; }],
    ['nonzero body size', member => { member.size = 1; }],
    ['missing body SHA', member => { delete member.bodySha256; }],
    ['missing inert-link flag', member => { delete member.linkFollowed; }],
    ['followed-link assertion', member => { member.linkFollowed = true; }],
    ['null inert-link flag', member => { member.linkFollowed = null; }],
  ]) test(`full controller rejects DELIVERED ${type} with ${name} before publishing`, async () => {
    const member = deliveredNonregularRecords().find(candidate => candidate.type === type), invalid = { ...member };
    mutation(invalid);
    const result = await run({ collection(value) { retainActualNonregular(value, invalid); return value; } });
    assertStop(result, 'E_COLLECTION'); assert.equal(result.h.written, null);
    assert.ok(result.h.events.includes('abortWriter')); assert.ok(result.h.events.includes('abortCollector'));
  });
}
