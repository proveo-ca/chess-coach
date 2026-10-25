// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { runRegisteredGnuEvidenceCollectionV1, runRegisteredRustEvidenceCollectionV1,
  createSplitToolchainEvidenceOperationFixture, SPLIT_TOOLCHAIN_OPERATION_PARTS as PARTS,
  SPLIT_TOOLCHAIN_OPERATION_INPUTS as INPUTS, SPLIT_TOOLCHAIN_OPERATION_PROFILES as PROFILES,
  SPLIT_TOOLCHAIN_OPERATION_PATHS as PATHS, SPLIT_TOOLCHAIN_SOURCE_PINS as PINS,
  SPLIT_TOOLCHAIN_GRAPH_PINS as GRAPH_PINS,
  SPLIT_TOOLCHAIN_OPERATION_LIMITS as LIMITS, splitToolchainEvidenceOperationSource as source,
} from './split-toolchain-evidence-operation.mjs';

const REPO = '/tmp/opencode/f9-bootstrap-correspondence';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = bytes => ({ bytes: bytes.length, sha256: sha(bytes) });
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const decode = target => Buffer.from(target.slice(target.indexOf(',') + 1), 'base64').toString('utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const error = code => Object.assign(new Error(code), { code });
const throws = (fn, code) => assert.throws(fn, value => value.code === code);
const collectorBytes = Buffer.from("// MOCK_ONLY_SPLIT_COLLECTOR\nimport { createTarInventory } from './tar-inventory.mjs';\nimport { inspectElf64RequirementsV5 } from './elf-requirements-v5.mjs';\nimport { SOURCE_FORMAT_INSPECTORS } from './sdk-payload-inspection.mjs';\n");
const writerBytes = Buffer.from('// MOCK_ONLY_SPLIT_WRITER\n');
const retained = new Map(source.rows.map(([key, path]) => [key,
  key === 'collector' ? collectorBytes : key === 'writer' ? writerBytes : readFileSync(path)]));
const helperPins = { collector: pin(collectorBytes), writer: pin(writerBytes) };
const rawPins = { ...PINS, ...helperPins };
const graphs = Object.fromEntries(PARTS.map(part => [part, source.prepareSourceGraph(retained, null, true, part, rawPins)]));
const sdk = await import(graphs.gnu.sdkUri);
const receipts = Object.fromEntries([...retained].filter(([key]) => key.endsWith('Receipt')).map(([key, bytes]) => [key, JSON.parse(bytes)]));
const expectations = {
  gnu: [{ role: 'gnu-sdk', expandedBytes: 505333760, entries: 8412, headers: 10181, regularFiles: 6891,
    decodedSha256: receipts.sdkCatalogReceipt.decodedSha256,
    metadataSha256: receipts.sdkInventoryReceipt.inventory.metadataSha256, metadataHashKind: 'LEGACY_WITHOUT_BODY_OFFSET' }],
  rust: receipts.rustLayoutReceipt.roles.map(row => ({ role: row.role, expandedBytes: row.expandedBytes,
    entries: row.entries, headers: row.headers, regularFiles: row.regularFiles, decodedSha256: row.decodedSha256,
    metadataSha256: row.metadataSha256, metadataHashKind: 'OFFSET_EVENT_METADATA' })),
};
const targets = {
  gnu: [...sdk.SDK_PAYLOAD_TARGETS.map(row => ({ artifactRole: 'gnu-sdk', path: INPUTS.gnu[0].expectedRoot + '/' + row.path,
    index: row.index, bodyOffset: row.bodyOffset, size: row.size, expectedSha256: null, kind: row.kind, domain: row.domain,
    selectionRole: row.role, optionalForMinimalC: row.optionalForMinimalC,
    maxBytes: row.kind === 'AR' ? 8388608 : row.kind === 'LINKER_TEXT' ? 1048576 : 67108864 })),
  { artifactRole: 'gnu-sdk', path: INPUTS.gnu[0].expectedRoot + '/x86_64-buildroot-linux-gnu/sysroot/lib/libmvec.so.1',
    index: null, bodyOffset: null, size: null, expectedSha256: null, kind: 'ELF_EXEC_DSO', domain: 'TARGET',
    selectionRole: 'TARGET_LIBMVEC_PROVIDER', optionalForMinimalC: false, maxBytes: 8388608 }],
  rust: receipts.rustLayoutReceipt.runtimeInspectionCandidates.map(row => ({ artifactRole: row.role, path: row.path,
    index: row.index, bodyOffset: row.bodyOffset, size: row.size, expectedSha256: row.sha256,
    kind: row.size === 42 ? 'LINKER_TEXT' : 'ELF_EXEC_DSO', domain: row.role === 'rust-std' ? 'TARGET' : 'HOST',
    selectionRole: 'RUST_RUNTIME_CANDIDATE', optionalForMinimalC: false, maxBytes: row.size === 42 ? 1048576 : 268435456 })),
};
function stat(size, ino = 10, directory = false) {
  return { dev: directory ? 28n : 29n, ino: BigInt(ino), mode: directory ? 0o40700n : 0o100600n,
    uid: 1000n, gid: 1000n, nlink: directory ? 2n : 1n, size: BigInt(size), mtimeNs: 123n, ctimeNs: 456n };
}
function sourceFs(options = {}) {
  const files = new Map(source.rows.map(([key, path], index) => [path,
    { bytes: retained.get(key), stat: stat(retained.get(key).length, index + 10), key }]));
  const fds = new Map(), calls = []; let next = 3;
  const backend = {
    lstatSync(path, flags) {
      calls.push(['lstat', path]); options.event?.('sourceStat', path);
      assert.deepEqual(flags, { bigint: true });
      const value = path === REPO ? stat(4096, 2, true) : files.get(path)?.stat;
      if (!value) throw error('ENOENT');
      return options.stat ? options.stat({ ...value }, path) : { ...value };
    },
    openSync(path, flags) {
      calls.push(['open', path]); options.event?.('sourceOpen', path);
      assert.equal(flags, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
      if (options.openError) throw error('ENOENT');
      assert.ok(files.has(path), 'source capture never acquires archives or outputs');
      const fd = next++; fds.set(fd, files.get(path)); return fd;
    },
    fstatSync(fd, flags) {
      assert.deepEqual(flags, { bigint: true }); const entry = fds.get(fd); assert.ok(entry);
      return options.fdStat ? options.fdStat({ ...entry.stat }, entry.key) : { ...entry.stat };
    },
    readSync(fd, buffer, offset, length, position) {
      calls.push(['read', fd, length, position]); options.event?.('sourceRead', position);
      const entry = fds.get(fd); assert.ok(entry);
      if (options.readError) throw error('EIO');
      if (options.shortRead) return 0;
      if (options.extraEof && position === entry.bytes.length) return 1;
      const amount = Math.min(length, Math.max(0, entry.bytes.length - position));
      entry.bytes.copy(buffer, offset, position, position + amount);
      if (options.corrupt && position === 0) buffer[offset] ^= 1;
      return amount;
    },
    closeSync(fd) {
      calls.push(['close', fd]); assert.ok(fds.has(fd)); fds.delete(fd);
      options.event?.('sourceClose', fd);
      if (options.closeError) throw error('EIO');
    },
  };
  return { backend, files, fds, calls };
}
function coreValue(part, index) {
  const input = INPUTS[part][index], expected = expectations[part][index];
  return { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: false, archiveBytes: input.archiveBytes,
    archiveSha256: input.archiveSha256, archivePasses: 2, archiveDataBytes: input.archiveBytes * 2,
    archiveRequestedBytes: input.archiveBytes * 2 + 2, closeAttempts: 2, expandedBytes: expected.expandedBytes,
    streamEvents: 10, inventory: { entries: expected.entries, headers: expected.headers, metadataSha256: expected.metadataSha256 },
    exitCode: 0, signal: null, stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true,
    extracted: false, extractionAuthorized: false, installedUsability: false, decoderQualified: false,
    provenanceVerified: false, hardRssBounded: false, processTreeBounded: false, hardDeadlineGuaranteed: false,
    nativeQualified: false, pythonFreeSubsetVerified: false, rustReady: false, trainingReady: false };
}
function mockRole(part, index) {
  const input = INPUTS[part][index], expected = expectations[part][index];
  const members = Array.from({ length: expected.entries }, (_, ordinal) => ({ index: ordinal + 1,
    path: input.expectedRoot + '/mock-' + ordinal, bodyOffset: (ordinal + 1) * 512, size: 0,
    type: ordinal < expected.regularFiles ? 'file' : 'directory',
    ...(ordinal < expected.regularFiles ? { bodySha256: sha('') } : { bodySha256: null, linkFollowed: false }) }));
  const protectedIndices = new Set();
  const selected = targets[part].filter(row => row.artifactRole === input.role).map(target => {
    const ordinal = (target.index ?? 6000) - 1, member = members[ordinal]; protectedIndices.add(ordinal);
    Object.assign(member, { path: target.path, type: 'file', size: target.size ?? 512,
      bodyOffset: target.bodyOffset ?? 400000000, bodySha256: target.expectedSha256 ?? sha('MOCK_ONLY:' + target.path) });
    return { ...target, index: ordinal + 1, size: member.size, bodyOffset: member.bodyOffset, bodySha256: member.bodySha256,
      hashObservation: target.expectedSha256 === null ? 'FRESH_BODY_HASH' : 'MATCHED_EXPECTED_BODY_HASH',
      metadata: target.kind === 'ELF_EXEC_DSO' ? { state: 'ELF_EXEC_DSO_REQUIREMENT_DATA',
        requirements: { dynamic: { needed: [] } }, unsafeLoadingTags: [], loadingTagsQualification: 'NOT_QUALIFIED', qualified: false } :
        { state: 'SOURCE_FORMAT_DATA', observation: { mockOnly: true }, qualified: false },
      qualified: false, abiVerified: false, roleSatisfied: false };
  });
  const manifests = Array.from({ length: part === 'gnu' ? 2 : 3 }, (_, ordinal) => {
    const text = 'MOCK_ONLY_FULL_TEXT\n', bodySha256 = sha(text); protectedIndices.add(ordinal);
    Object.assign(members[ordinal], { path: input.expectedRoot + '/mock-manifest-' + ordinal, type: 'file',
      size: text.length, bodySha256 });
    return { path: members[ordinal].path, kind: 'MOCK_ONLY', bodySha256, text, declarations: [], interpreted: false };
  });
  let regular = members.filter(row => row.type === 'file').length;
  for (let ordinal = members.length - 1; regular > expected.regularFiles && ordinal >= 0; ordinal--) {
    if (members[ordinal].type !== 'file' || protectedIndices.has(ordinal)) continue;
    Object.assign(members[ordinal], { type: 'directory', bodySha256: null, linkFollowed: false }); regular--;
  }
  const offset = part === 'gnu' ? sha('MOCK_ONLY_OFFSET') : expected.metadataSha256;
  return { ...expected, offsetMetadataSha256: offset, legacyMetadataSha256: expected.metadataSha256,
    inventory: { metadataSha256: offset }, completeNamespace: true, members, selected, manifests };
}
function mockCollection(part) {
  const profile = PROFILES[part];
  return { profile: 'SPLIT_TOOLCHAIN_EVIDENCE_DATA', state: 'SPLIT_TOOLCHAIN_EVIDENCE_DATA', part,
    mockOnly: false, entries: profile.entries, regularFiles: profile.regularFiles, expandedBytes: profile.expandedBytes,
    completeNamespace: true, selectedPayloads: profile.targetCount, artifactCount: profile.artifactCount,
    declaredNeededEdges: [], roles: INPUTS[part].map((_, index) => mockRole(part, index)) };
}
function publicationCounts(length) {
  return { fsOperations: 70, guardChecks: 100, opens: 3, closeAttempts: 3, closes: 3, cleanupCloseAttempts: 0,
    namedStats: 15, fdStats: 10, fsyncs: 4, chmods: 1, writeAttempts: Math.ceil(length / 65536),
    readAttempts: Math.ceil(length / 65536) + 1, requestedWriteBytes: length, requestedReadBytes: length + 1,
    writtenBytes: length, readbackBytes: length, inputBytes: length, copiedBytes: length, inputHashBytes: length,
    readbackHashBytes: length, peakOwnedFDs: 2, ownedSnapshotBytes: 0, ownedScratchBytes: 0 };
}
function harness(options = {}) {
  let clock = 0, activePart = null;
  const events = [], imports = [], written = new Map(), states = new Map();
  const setClock = value => { clock = value; };
  const event = (name, value) => { events.push([name, value]); options.event?.(name, value, setClock); };
  const io = sourceFs({ ...options.source, event });
  const helper = {
    SPLIT_TOOLCHAIN_EVIDENCE_PARTS: PARTS, SPLIT_TOOLCHAIN_EVIDENCE_INPUTS: INPUTS,
    SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS: expectations, SPLIT_TOOLCHAIN_EVIDENCE_TARGETS: targets,
    SPLIT_TOOLCHAIN_EVIDENCE_PROFILES: PROFILES, SPLIT_TOOLCHAIN_EVIDENCE_LIMITS: source.collectorLimits,
    SOURCE_CREATE_COLLECTOR(part) { return this.createSplitToolchainEvidenceCollector(part); },
    createSplitToolchainEvidenceCollector(part) {
      event('createCollector', part);
      let accepted = 0, current = null, phase = 'ACTIVE', entries = 0, expandedBytes = 0;
      const collector = {
        beginToolchainEvidenceBatch() { event('begin', part); },
        beginToolchainEvidenceRole(role) { current = role; event('role', role); },
        createTarInventory() { throw new Error('MOCK_ONLY_NO_ARCHIVE_PARSER'); },
        acceptToolchainEvidenceRole(core) {
          event('accept', current);
          if (options.acceptFailure === current) throw error('E_COLLECTION');
          accepted++; current = null; entries += core.inventory.entries; expandedBytes += core.expandedBytes;
        },
        snapshotToolchainEvidenceBatch() { return { part, state: phase, mockOnly: false, acceptedRoles: accepted, currentRole: current,
          entries, expandedBytes, metadataBytes: 0, manifestBytes: 0, capturedBytes: 0, selectedPayloads: 0,
          activeBufferBytes: 0, activeBodyHashes: 0 }; },
        finishToolchainEvidenceBatch() {
          event('finish', part); const value = mockCollection(part);
          const result = options.collection ? options.collection(value, part) : value;
          return options.shallowFrozen ? Object.freeze(result) : source.freeze(result);
        },
        abortToolchainEvidenceBatch() {
          event('abortCollector', part); accepted = 0; current = null; phase = 'ABORTED';
          if (options.collectorAbortError) throw error('E_IO');
        },
        getToolchainEvidenceFailure() { return null; },
      };
      states.set(part, collector); return collector;
    },
  };
  options.constants?.(helper);
  const writer = {
    SPLIT_EVIDENCE_PARTS: PARTS, SPLIT_EVIDENCE_PATHS: PATHS, SPLIT_EVIDENCE_PUBLICATION_LIMITS: source.writerLimits,
    reserveSplitEvidencePublication(part, guard) {
      event('reserve', part); activePart = part; guard();
      assert.equal(events.some(([name, role]) => name === 'archive' && PROFILES[part].roles.includes(role)), false);
      if (options.exists) throw error('E_PUBLICATION_EXISTS');
      if (options.deliveredMemory) return deliveredWriter.createSplitEvidencePublicationFixture({ mockOnly: true },
        { fs: options.deliveredMemory.fs, guard }).reserveSplitEvidencePublication(part);
      let phase = 'RESERVED', c = { writtenBytes: 0 };
      return {
        snapshot() {
          event('publicationSnapshot', phase);
          const value = { part, phase, ownedFDCount: phase === 'RESERVED' ? 2 : 0, counts: c, created: true,
            sealed: phase === 'PUBLISHED_READBACK_MATCHED', error: null, closeFailed: false, cleanupUncertain: false };
          return options.snapshot ? options.snapshot(value) : value;
        },
        publish(bytes) {
          event('publish', part);
          assert.equal(events.filter(([name, role]) => name === 'accept' && PROFILES[part].roles.includes(role)).length, INPUTS[part].length);
          assert.equal(bytes.at(-1), 10); assert.ok(bytes.every(byte => byte <= 127));
          written.set(part, Buffer.from(bytes)); c = publicationCounts(bytes.length);
          if (options.publishError) throw error(options.publishError);
          phase = 'PUBLISHED_READBACK_MATCHED';
          const fileMetadata = Object.fromEntries(Object.entries(stat(bytes.length, 200)).map(([key, value]) => [key, String(value)]));
          fileMetadata.mode = '33060';
          const record = { state: phase, part, path: PATHS[part], byteLength: bytes.length, sha256: sha(bytes),
            mode: '0444', readbackVerified: true, directorySynced: true, counts: c, fileMetadata,
            sourceRootAuthentication: false, ancestorRacesExcluded: false, atomicCrashCommit: false, storageFailureSurvival: false,
            hardDeadlineGuaranteed: false, nativeQualified: false, abiQualified: false, authenticatedStorage: false };
          return options.record ? options.record(record) : record;
        },
        abort() {
          event('abortWriter', part);
          if (options.writerAbortError) throw error('E_IO');
          return { counts: c, closeFailed: options.abortUncertain ?? false, cleanupUncertain: options.abortUncertain ?? false };
        },
      };
    },
  };
  const stage = {
    verifyStagedXzImages() {
      event('stage', events.filter(([name]) => name === 'stage').length + 1);
      if (options.stageFailure === events.filter(([name]) => name === 'stage').length) throw error('E_METADATA');
      return { counters: { fsCalls: 80, readBytes: 2758216, closeAttempts: 5 } };
    },
    assertNoSystemPreload() { event('preload'); return !options.preload; },
  };
  const dependencies = {
    fs: io.backend, now: () => options.now ? options.now(clock) : clock,
    spawn() { event('spawn'); return new EventEmitter(); },
    async moduleImporter(target) {
      imports.push(target); event('import', imports.length); const text = decode(target);
      if (text.includes('// MOCK_ONLY_SPLIT_COLLECTOR')) return helper;
      if (text.includes('// MOCK_ONLY_SPLIT_WRITER')) return writer;
      if (text.includes('export const SOURCE_FORMAT_INSPECTORS')) return sdk;
      if (text.includes('export const GNU_SDK_DESCRIPTOR')) {
        const descriptor = JSON.parse(text.match(/export const GNU_SDK_DESCRIPTOR = Object\.freeze\((\{[\s\S]*?\})\);/)[1]);
        const part = descriptor.root === INPUTS.gnu[0].root ? 'gnu' : 'rust';
        const index = INPUTS[part].findIndex(input => input.file === descriptor.file), input = INPUTS[part][index];
        return { GNU_SDK_DESCRIPTOR: descriptor, GNU_SDK_LIMITS: source.coreLimits(part),
          async runGnuSdkInventory(identity, deps) {
            assert.deepEqual(identity, input.identity); assert.equal(activePart, part); event('archive', input.role);
            await deps.beforeDecode();
            const d = descriptor.decoderRoot;
            const child = deps.spawn(d + '/ld-linux-x86-64.so.2', ['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', d,
              d + '/xz', '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=' + input.decoderMemoryBytes,
              '--', '-'], { cwd: d, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false,
              stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
            child.emit('spawn'); child.emit('close', 0, null); await deps.afterDecode(); event('afterCore', index);
            if (options.coreFailure === index) throw error(options.failureCode ?? 'E_HASH');
            const value = coreValue(part, index); return options.core ? options.core(value, index) : value;
          } };
      }
      if (text.includes('verifyStagedXzImages')) return stage;
      throw error('E_COMPONENT');
    },
  };
  return { fixture: createSplitToolchainEvidenceOperationFixture({ mockOnly: true, helperPins }, dependencies),
    events, imports, io, states, written, dependencies, setClock, get clock() { return clock; } };
}
const entry = part => part === 'gnu' ? 'runRegisteredGnuEvidenceCollectionV1' : 'runRegisteredRustEvidenceCollectionV1';
async function run(part, options = {}) {
  const h = harness(options), output = await h.fixture[entry(part)]();
  assert.ok(Object.isFrozen(output)); assert.match(output.text, /^[\x00-\x7f]*\n$/); assert.ok(output.text.length <= 65536);
  return { h, output, receipt: JSON.parse(output.text) };
}
function stop(result, code) {
  assert.equal(result.output.exitCode, 1, result.output.text); assert.equal(result.receipt.status, 'STOP');
  assert.equal(result.receipt.publicationAccepted, false); assert.equal(result.receipt.jointEvidenceSetComplete, false);
  assert.equal(result.receipt.realArchiveInspected, false);
  if (code) assert.equal(result.receipt.error, code, result.output.text);
  for (const key of ['collection', 'members', 'selected', 'payloads']) assert.equal(Object.hasOwn(result.receipt, key), false);
}

test('production entries reject caller overrides before latching and independently stop pending', async () => {
  for (const fn of [runRegisteredGnuEvidenceCollectionV1, runRegisteredRustEvidenceCollectionV1]) {
    assert.equal(JSON.parse((await fn({ part: 'other' })).text).error, 'E_INPUT');
    if (PINS.collector === null) {
      const first = JSON.parse((await fn()).text); assert.equal(first.error, 'E_HELPER_PENDING');
      assert.equal(first.repoCapture.openAttempts, 0); assert.equal(first.collectionCounts.spawnAttempts, 0);
      assert.equal(JSON.parse((await fn()).text).error, 'E_INPUT');
    }
  }
});
test('controller is raw-data-URI bootable and never derives repository paths from module location', async () => {
  const bytes = readFileSync(REPO + '/tooling/native-ingress/split-toolchain-evidence-operation.mjs');
  assert.doesNotMatch(bytes.toString(), /import\.meta|^import .*from ['"]\.\.?\//m);
  const module = await import(uri(bytes));
  assert.equal(JSON.parse((await module.runRegisteredGnuEvidenceCollectionV1('no')).text).error, 'E_INPUT');
  assert.equal(JSON.parse((await module.runRegisteredRustEvidenceCollectionV1('no')).text).error, 'E_INPUT');
});
test('fixed source graph consumes no managed result files or old physical collectors', () => {
  assert.equal(source.rows.length, 14);
  assert.ok(source.rows.every(([, path]) => path.startsWith(REPO + '/') && !path.endsWith('.result.json')));
  assert.ok(!source.rows.some(([, path]) => /\/(toolchain-evidence|evidence-publication|toolchain-evidence-operation)\.mjs$/.test(path)));
  for (const [key] of source.rows) if (!['collector', 'writer'].includes(key)) assert.deepEqual(pin(retained.get(key)), PINS[key]);
});
test('outer/source/publication clocks retain exact fixed ceilings', () => {
  assert.deepEqual(LIMITS, { sourceMs: 10000, totalMs: 300000, cleanupMs: 3000, publicationMs: 30000,
    sourceBytes: 1048576, sourceFsOperations: 8192, sourceReadsPerFile: 128, dataBytes: 16777216,
    receiptBytes: 65536, depth: 64, nodes: 1048576 });
  assert.deepEqual(source.roleMs, { gnu: 120000, rust: 40000 });
  assert.deepEqual(source.admissionMs, { gnu: 150000, rust: 70000 });
});
test('unknown part rejects without invoking graph capture or consuming fixture entries', async () => {
  throws(() => source.prepareSourceGraph(retained, null, true, 'other', rawPins), 'E_INPUT');
  throws(() => source.transformCore(retained.get('rawCore'), 'other', 'cargo'), 'E_INPUT');
  const h = harness(); assert.equal(JSON.parse((await h.fixture[entry('gnu')]('other')).text).error, 'E_INPUT');
  assert.equal((await h.fixture[entry('rust')]()).exitCode, 0);
});
for (const part of PARTS) {
  const n = INPUTS[part].length, roleMs = source.roleMs[part];
  test(`${part}: exact independent partition input/count/memory constants`, () => {
    assert.equal(n, part === 'gnu' ? 1 : 5); assert.equal(targets[part].length, part === 'gnu' ? 46 : 13);
    for (const input of INPUTS[part]) {
      assert.equal(input.decoderMemoryBytes, part === 'gnu' ? 16777216 : 268435456);
      assert.equal(Object.keys(input.identity.file).length, 9); assert.notEqual(input.identity.file.dev, input.identity.root.dev);
      assert.ok(Object.isFrozen(input.identity.file));
    }
  });
  test(`${part}: private core retains cleanup within total and pins every transformation`, () => {
    for (const input of INPUTS[part]) {
      const stages = [], bytes = source.transformCore(retained.get('rawCore'), part, input.role, (name, bytes) => stages.push([name, pin(bytes)]));
      assert.match(bytes.toString(), new RegExp('maxTotalMs: ' + (part === 'gnu' ? '120_000' : '40_000') + ', cleanupMs: 3000'));
      assert.match(bytes.toString(), new RegExp('--memlimit-decompress=' + input.decoderMemoryBytes));
      assert.deepEqual(stages.map(([name]) => name), ['descriptor', ...(part === 'rust' ? ['duration'] : []),
        'events', 'summary', 'selectors', ...(part === 'rust' ? ['memory'] : []), 'parserBinding']);
      for (const [name, value] of stages) assert.deepEqual(value, graphs[part].pins[input.role + ':' + name]);
    }
  });
  test(`${part}: parent and every part core use exactly one identical helper URI`, () => {
    const graph = graphs[part]; assert.equal(graph.coreUris.length, n);
    for (const target of graph.coreUris) assert.ok(decode(target).includes("from '" + graph.collectorUri + "'"));
    assert.doesNotMatch(decode(graph.collectorUri), /from '\.\//);
    assert.deepEqual(graph.pins.appendedSdk, { bytes: 31647, sha256: '22be684fb42feecbf6ac629f8e1fbf310bb31635325a9d1dc5a9e81fd75ee3b8' });
    assert.deepEqual(graph.pins.linkedSdk, { bytes: 79779, sha256: 'aeeafd8124729ef1ee3d54787c40249a6740796ae806a8d97d370e042690d2f2' });
    assert.ok(graph.outputs.appendedSdk.toString().endsWith('\nexport const SOURCE_FORMAT_INSPECTORS = Object.freeze({rel,archive,linker});\n'));
  });
  test(`${part}: success publishes only full partition and never claims joint evidence`, async () => {
    const result = await run(part); assert.equal(result.output.exitCode, 0, result.output.text);
    const { h, receipt } = result, bytes = h.written.get(part);
    assert.equal(receipt.publicationAccepted, true); assert.equal(receipt.jointEvidenceSetComplete, false);
    assert.equal(receipt.profile, 'registered-split-toolchain-evidence-v1'); assert.equal(receipt.part, part);
    assert.equal(receipt.status, 'SPLIT_TOOLCHAIN_EVIDENCE_DATA'); assert.equal(receipt.path, PATHS[part]);
    assert.equal(receipt.byteLength, bytes.length); assert.equal(receipt.sha256, sha(bytes));
    assert.equal(h.imports.length, 4 + n); assert.equal(h.imports[0], graphs[part].collectorUri);
    assert.deepEqual(h.events.filter(([name]) => name === 'archive').map(([, role]) => role), PROFILES[part].roles);
    assert.equal(h.events.findIndex(([name]) => name === 'reserve') < h.events.findIndex(([name]) => name === 'archive'), true);
    const data = JSON.parse(bytes); assert.equal(data.collection.roles.length, n); assert.equal(data.collection.selectedPayloads, PROFILES[part].targetCount);
    for (const key of ['publicationAccepted', 'selfDigest', 'publicationCounts', 'publication', 'postWriteCounts']) assert.equal(Object.hasOwn(data, key), false);
    assert.equal(Object.hasOwn(receipt, 'collection'), false);
  });
  test(`${part}: pass/hash/EOF/close/stage accounting equals partition totals`, async () => {
    const { receipt } = await run(part), c = receipt.collectionCounts;
    const data = part === 'gnu' ? 204592560 : 255545440;
    assert.equal(c.archivePasses, n * 2); assert.equal(c.archiveDataBytes, data); assert.equal(c.archiveRequestedBytes, data + n * 2);
    assert.equal(c.archiveCloseAttempts, n * 2); assert.equal(c.childCloses, n); assert.equal(c.peakChildren, 1);
    assert.equal(c.stageChecks, n * 2); assert.equal(c.preloadChecks, n * 2); assert.equal(c.stageCloses, n * 10);
    assert.equal(c.expandedBytes, PROFILES[part].expandedBytes); assert.equal(c.entries, PROFILES[part].entries);
    assert.equal(receipt.repoCapture.completedCaptures, 14); assert.equal(receipt.repoCapture.closes, 14); assert.equal(receipt.repoCapture.peakOwnedFds, 1);
  });
  test(`${part}: EEXIST stops before collector/archive/decoder and retains no accepted publication`, async () => {
    const result = await run(part, { exists: true }); stop(result, 'E_PUBLICATION_EXISTS');
    assert.equal(result.h.events.some(([name]) => ['archive', 'spawn', 'createCollector'].includes(name)), false);
    assert.equal(result.h.written.size, 0);
    assert.ok(result.h.io.calls.every(call => !String(call[1]).includes('toolchain-evidence-collection-v1.result.json')));
  });
  for (const code of ['E_HASH', 'E_TAR', 'E_METADATA', 'E_CLOSE', 'E_PIPE', 'E_DECODER']) {
    test(`${part}: last-role ${code} aborts both owners without publication`, async () => {
      const result = await run(part, { coreFailure: n - 1, failureCode: code }); stop(result, code);
      assert.ok(result.h.events.some(([name]) => name === 'abortWriter')); assert.ok(result.h.events.some(([name]) => name === 'abortCollector'));
      assert.equal(result.h.written.size, 0);
    });
  }
  for (const [name, mutate] of [
    ['archive SHA', value => { value.archiveSha256 = '0'.repeat(64); }],
    ['archive EOF', value => { value.archiveRequestedBytes--; }], ['close count', value => { value.closeAttempts--; }],
    ['pipe completion', value => { value.stdoutEnded = false; }], ['decoder exit', value => { value.exitCode = 1; }],
    ['stream cap', value => { value.streamEvents = 262145; }], ['core qualification', value => { value.nativeQualified = true; }],
  ]) test(`${part}: last core ${name} mutation never reaches publication`, async () => {
    const result = await run(part, { core(value, index) { if (index === n - 1) mutate(value); return value; } });
    stop(result, 'E_RECEIPT'); assert.equal(result.h.written.size, 0);
  });
  test(`${part}: last stage check and preload failure keep reserved file unaccepted`, async () => {
    stop(await run(part, { stageFailure: n * 2 }), 'E_METADATA'); stop(await run(part, { preload: true }), 'E_PRELOAD');
  });
  test(`${part}: controller role clock accepts limit-1 and rejects exact limit including cleanup`, async () => {
    const equal = await run(part, { event(name, index, set) { if (name === 'afterCore' && index === 0) set(roleMs); } });
    stop(equal, 'E_DEADLINE');
    const below = await run(part, { event(name, index, set) { if (name === 'afterCore' && index === 0) set(roleMs - 1); } });
    assert.equal(below.output.exitCode, 0, below.output.text);
  });
  test(`${part}: remaining admission equality admits; one millisecond less denies`, async () => {
    const start = 300000 - source.admissionMs[part];
    const equal = await run(part, { event(name, value, set) { if (name === 'begin') set(start); } });
    assert.equal(equal.output.exitCode, 0, equal.output.text);
    const below = await run(part, { event(name, value, set) { if (name === 'begin') set(start + 1); } });
    stop(below, 'E_DEADLINE'); assert.equal(below.h.events.some(([name]) => name === 'archive'), false);
  });
  test(`${part}: source deadline starts before first capture and includes final import`, async () => {
    for (const at of ['sourceRead', 'import']) {
      const result = await run(part, { event(name, value, set) { if (name === at && (at !== 'import' || value === 4 + n)) set(10000); } });
      stop(result, 'E_DEADLINE'); assert.equal(result.h.events.some(([name]) => name === 'reserve'), false); assert.equal(result.h.io.fds.size, 0);
    }
  });
  test(`${part}: publication deadline covers finish and late valid-looking publication`, async () => {
    for (const at of ['finish', 'publish']) {
      const result = await run(part, { event(name, value, set) { if (name === at) set(30000); } });
      stop(result, 'E_DEADLINE'); assert.equal(result.h.written.has(part), at === 'publish');
    }
  });
  test(`${part}: original 300s outer deadline never resets at publication`, async () => {
    const result = await run(part, { event(name, value, set) {
      if (name === 'begin') set(300000 - source.admissionMs[part]);
      if (name === 'finish') set(300000);
    } }); stop(result, 'E_DEADLINE'); assert.equal(result.h.written.size, 0);
  });
  for (const [name, mutate] of [
    ['partial roles', value => { value.roles.pop(); }], ['wrong part', value => { value.part = 'other'; }],
    ['selected count', value => { value.selectedPayloads = 59; }], ['artifact count', value => { value.artifactCount = 6; }],
    ['partial namespace', value => { value.roles[0].members.pop(); }],
    ['missing body SHA', value => { delete value.roles[0].members[0].bodySha256; }],
    ['nonregular fabricated SHA', value => { value.roles[0].members.at(-1).bodySha256 = sha(''); }],
    ['nonregular missing null SHA', value => { delete value.roles[0].members.at(-1).bodySha256; }],
    ['followed nonregular link', value => { value.roles[0].members.at(-1).linkFollowed = true; }],
    ['duplicate path', value => { value.roles[0].members[1].path = value.roles[0].members[0].path; }],
    ['path escape', value => { value.roles[0].members[0].path += '/../escape'; }],
    ['decoded hash', value => { value.roles[0].decodedSha256 = '0'.repeat(64); }],
    ['offset metadata', value => { value.roles[0].offsetMetadataSha256 = '0'.repeat(64); }],
    ['selected missing metadata', value => { delete value.roles[0].selected[0].metadata; }],
    ['selected hash', value => { value.roles[0].selected[0].bodySha256 = '0'.repeat(64); }],
    ['partial manifests', value => { value.roles[0].manifests.pop(); }],
    ['modified manifest', value => { value.roles[0].manifests[0].text += 'drift'; }],
  ]) test(`${part}: final ${name} mutation withholds DATA`, async () => {
    const result = await run(part, { collection(value) { mutate(value); return value; } }); stop(result, 'E_COLLECTION');
    assert.equal(result.h.written.size, 0);
  });
  for (const code of ['E_PUBLICATION_WRITE', 'E_PUBLICATION_CLOSE', 'E_PUBLICATION_HASH', 'E_PUBLICATION_EOF']) {
    test(`${part}: writer ${code} keeps bytes but withholds acceptance`, async () => {
      const result = await run(part, { publishError: code }); stop(result, code); assert.ok(result.h.written.has(part));
    });
  }
  for (const [name, mutate] of [
    ['digest', record => { record.sha256 = '0'.repeat(64); }], ['length', record => { record.byteLength++; }],
    ['mode', record => { record.mode = '0600'; }], ['readback', record => { record.readbackVerified = false; }],
    ['directory sync', record => { record.directorySynced = false; }], ['part', record => { record.part = 'other'; }],
    ['path', record => { record.path = PATHS[part === 'gnu' ? 'rust' : 'gnu']; }],
    ['positive closes', record => { record.counts.closes--; }],
    ['underreported reads', record => { record.counts.requestedReadBytes = record.byteLength; }],
    ['over-budget reads', record => { record.counts.requestedReadBytes = 16777218; }],
    ['readback hash count', record => { record.counts.readbackHashBytes--; }],
  ]) test(`${part}: invalid publication ${name} leaves valid-looking bytes unaccepted`, async () => {
    const result = await run(part, { record(value) { mutate(value); return value; } }); stop(result, 'E_PUBLICATION_RECORD');
    assert.ok(result.h.written.has(part));
  });
  test(`${part}: shallow freezing cannot bypass recursive own-DATA guard`, async () => {
    const result = await run(part, { shallowFrozen: true }); stop(result, 'E_COLLECTION'); assert.equal(result.h.written.size, 0);
  });
  for (const flag of ['nativeQualified', 'rustReady', 'pythonFreeSubsetVerified', 'compilerExecuted', 'jointEvidenceSetComplete', 'memberExecuted']) {
    test(`${part}: nested ${flag}=true cannot establish authority`, async () => {
      stop(await run(part, { collection(value) { value.roles[0][flag] = true; return value; } }), 'E_RECEIPT');
    });
  }
}
for (const [name, config, code] of [
  ['short source', { shortRead: true }, 'E_LENGTH'], ['positive source EOF', { extraEof: true }, 'E_LENGTH'],
  ['source hash drift', { corrupt: true }, 'E_SOURCE_PIN'], ['source read error', { readError: true }, 'E_IO'],
  ['source close error', { closeError: true }, 'E_CLOSE'], ['source missing', { openError: true }, 'E_IO'],
  ['source nonregular', { stat: value => ({ ...value, mode: 0o120600n }) }, 'E_SOURCE_PIN'],
  ['source metadata mismatch', { fdStat: value => ({ ...value, ino: value.ino + 1n }) }, 'E_BINDING'],
]) test(`${name} closes acquired owner and stops before reservation for either part`, async () => {
  for (const part of PARTS) { const result = await run(part, { source: config }); stop(result, code); assert.equal(result.h.io.fds.size, 0); }
});
test('source size mismatch rejects before allocation/open', () => {
  const io = sourceFs({ stat: (value, path) => path === REPO ? value : { ...value, size: value.size + 1n } });
  const counts = source.captureCounts(); throws(() => source.captureSource('rawCore', io.backend, counts, () => {}), 'E_SOURCE_PIN');
  assert.equal(counts.allocations, 0); assert.equal(counts.openAttempts, 0);
});
test('source cumulative allocation and FS caps retain a cleanup close', () => {
  for (const dimension of ['allocatedBytes', 'fsCalls']) {
    const io = sourceFs(), counts = source.captureCounts(); counts[dimension] = dimension === 'fsCalls' ? 8188 : 1048576 - PINS.rawCore.bytes;
    throws(() => source.captureSource('rawCore', io.backend, counts, () => {}), 'E_LIMIT');
    assert.equal(io.fds.size, 0); assert.equal(counts.allocations, 0); assert.ok(counts.fsCalls <= 8192);
  }
});
test('source cleanup closes once despite expired guard', () => {
  const io = sourceFs(), counts = source.captureCounts(); let checks = 0;
  throws(() => source.captureSource('rawCore', io.backend, counts, () => { if (++checks === 7) throw error('E_DEADLINE'); }), 'E_DEADLINE');
  assert.equal(counts.closes, 1); assert.equal(io.fds.size, 0);
});
test('every raw source is pinned before graph transformation and no import occurs on drift', () => {
  for (const key of ['rawCore', 'rawTar', 'sdk', 'elfV3', 'elfV5', 'stage', 'elfMetadata', 'collector', 'writer']) {
    const values = new Map(retained), bytes = Buffer.from(values.get(key)); bytes[0] ^= 1; values.set(key, bytes);
    throws(() => source.prepareSourceGraph(values, null, true, 'gnu', rawPins), 'E_SOURCE_PIN');
  }
});
test('missing/duplicate relative links reject exactly-once graph linking', () => {
  throws(() => source.link(Buffer.from("from './x.mjs'; from './x.mjs'"), 'x', uri('')), 'E_SOURCE_PIN');
  throws(() => source.link(Buffer.from(''), 'x', uri('')), 'E_SOURCE_PIN');
});
for (const [name, mutate] of [
  ['mixed roles', helper => { helper.SPLIT_TOOLCHAIN_EVIDENCE_PROFILES = clone(PROFILES); helper.SPLIT_TOOLCHAIN_EVIDENCE_PROFILES.rust.roles.unshift('gnu-sdk'); }],
  ['partition subset', helper => { helper.SPLIT_TOOLCHAIN_EVIDENCE_INPUTS = clone(INPUTS); helper.SPLIT_TOOLCHAIN_EVIDENCE_INPUTS.rust.pop(); }],
  ['cargo legacy key', helper => { helper.SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS = clone(expectations); helper.SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS.rust[0].metadataHashKind = 'LEGACY_WITHOUT_BODY_OFFSET'; }],
  ['Rust known body SHA', helper => { helper.SPLIT_TOOLCHAIN_EVIDENCE_TARGETS = clone(targets); helper.SPLIT_TOOLCHAIN_EVIDENCE_TARGETS.rust[0].expectedSha256 = null; }],
  ['GNU libmvec invented span', helper => { helper.SPLIT_TOOLCHAIN_EVIDENCE_TARGETS = clone(targets); helper.SPLIT_TOOLCHAIN_EVIDENCE_TARGETS.gnu.at(-1).index = 1; }],
]) test(`constants reject ${name} before reservation`, async () => {
  for (const part of PARTS) {
    const result = await run(part, { constants: mutate }); stop(result, 'E_COMPONENT');
    assert.equal(result.h.events.some(([name]) => name === 'reserve'), false);
  }
});
test('Rust cargo at partition index zero uses offset hash, not GNU legacy hash', async () => {
  const result = await run('rust', { collection(value) { value.roles[0].legacyMetadataSha256 = '0'.repeat(64); return value; } });
  assert.equal(result.output.exitCode, 0, result.output.text);
});
for (const [name, now] of [['NaN', () => NaN], ['Infinity', () => Infinity], ['overflow', () => Number.MAX_VALUE]]) {
  test(`${name} clock stops before I/O`, async () => { for (const part of PARTS) stop(await run(part, { now }), 'E_CLOCK'); });
}
test('backwards clock never establishes acceptance', async () => {
  stop(await run('rust', { event(name, index, set) { if (name === 'import') set(index === 2 ? -1 : 1); } }), 'E_CLOCK');
});
test('failed GNU entry does not consume Rust entry and invalid calls do not consume either', async () => {
  const h = harness({ coreFailure: 0 });
  assert.equal(JSON.parse((await h.fixture[entry('gnu')]('other')).text).error, 'E_INPUT');
  assert.equal(JSON.parse((await h.fixture[entry('gnu')]()).text).error, 'E_HASH');
  assert.equal(JSON.parse((await h.fixture[entry('gnu')]()).text).error, 'E_INPUT');
  const output = await h.fixture[entry('rust')](); assert.notEqual(JSON.parse(output.text).error, 'E_INPUT');
});
test('own-DATA preflight does not invoke hostile getters, proxy traps, or toJSON', () => {
  let invoked = false;
  for (const value of [Object.defineProperty({}, 'x', { enumerable: true, get() { invoked = true; } }),
    new Proxy({}, { ownKeys() { invoked = true; } }), { toJSON() { invoked = true; } }]) {
    throws(() => source.preflight(value, 16777216), 'E_OUTPUT'); assert.equal(invoked, false);
  }
});
test('final collection accessor rejects without getter invocation before structural validation', async () => {
  let invoked = false;
  const result = await run('rust', { shallowFrozen: true, collection(value) {
    source.freeze(value.roles); source.freeze(value.declaredNeededEdges);
    Object.defineProperty(value, 'roles', { enumerable: true, get() { invoked = true; return []; } }); return value;
  } }); stop(result, 'E_OUTPUT'); assert.equal(invoked, false);
});
test('ASCII own-DATA handles escaped UTF16 including lone surrogates', () => {
  assert.equal(source.asciiJson({ x: 'é😀\ud800\n' }, 1024), '{"x":"\\u00e9\\ud83d\\ude00\\ud800\\n"}\n');
});
for (const maximum of [65536, 16777216]) test(`ASCII full JSON plus LF exact ${maximum} cap`, () => {
  const value = { x: 'x'.repeat(maximum - 9) };
  assert.equal(source.preflight(value, maximum), maximum); assert.equal(source.asciiJson(value, maximum).length, maximum);
  value.x += 'x'; throws(() => source.preflight(value, maximum), 'E_OUTPUT');
});
for (const [name, make] of [
  ['cycle', () => { const v = {}; v.x = v; return v; }], ['sparse', () => new Array(2)],
  ['symbol', () => ({ [Symbol('x')]: 1 })], ['typed array', () => Buffer.from('x')],
  ['undefined', () => ({ x: undefined })], ['NaN', () => ({ x: NaN })],
]) test(`preflight refuses ${name}`, () => { throws(() => source.preflight(make(), 16777216), 'E_OUTPUT'); });
test('preflight retains depth64 and node1M limits', () => {
  let value = null; for (let i = 0; i < 66; i++) value = { x: value };
  throws(() => source.preflight(value, 16777216), 'E_OUTPUT');
  throws(() => source.preflight(new Array(1048576).fill(null), 16777216), 'E_OUTPUT');
});

function publicationMemory(part, options = {}) {
  const directory = REPO + '/_spec/tooling/native-ingress';
  const paths = [REPO, REPO + '/_spec', REPO + '/_spec/tooling', directory];
  const nodes = new Map(paths.map((path, index) => [path, { ...stat(4096, 100 + index, true), data: Buffer.alloc(0) }]));
  const fds = new Map(), calls = []; let next = 100;
  const copy = value => Object.fromEntries(Object.keys(stat(0)).map(key => [key, value[key]]));
  const methods = {
    lstatSync(path) { if (!nodes.has(path)) throw error('ENOENT'); return copy(nodes.get(path)); },
    fstatSync(fd) { assert.ok(fds.has(fd)); return copy(fds.get(fd)); },
    openSync(path, flags, mode) {
      assert.ok(flags & constants.O_NOFOLLOW); assert.ok(flags & constants.O_NONBLOCK);
      if (flags & constants.O_CREAT) {
        assert.equal(path, PATHS[part]); assert.equal(mode, 0o600); assert.ok(flags & constants.O_EXCL);
        if (nodes.has(path)) throw error('EEXIST');
        nodes.set(path, { ...stat(0, 300), data: Buffer.alloc(0) }); nodes.get(directory).mtimeNs++; nodes.get(directory).ctimeNs++;
      }
      assert.ok(nodes.has(path)); const fd = next++; fds.set(fd, nodes.get(path)); return fd;
    },
    fsyncSync(fd) { assert.ok(fds.has(fd)); },
    fchmodSync(fd, mode) { assert.equal(mode, 0o444); fds.get(fd).mode = 0o100444n; fds.get(fd).ctimeNs++; },
    writeSync(fd, bytes, offset, length, position) {
      const value = fds.get(fd); assert.ok(value); const data = Buffer.alloc(Math.max(value.data.length, position + length));
      value.data.copy(data); bytes.copy(data, position, offset, offset + length); value.data = data; value.size = BigInt(data.length);
      value.mtimeNs++; value.ctimeNs++; return length;
    },
    readSync(fd, bytes, offset, length, position) {
      const value = fds.get(fd); assert.ok(value);
      const amount = Math.min(length, options.readCap ?? Infinity, Math.max(0, value.data.length - position));
      value.data.copy(bytes, offset, position, position + amount); return amount;
    },
    closeSync(fd) { assert.ok(fds.has(fd)); fds.delete(fd); },
  };
  const backend = Object.fromEntries(Object.entries(methods).map(([name, fn]) => [name, (...args) => {
    calls.push([name, args]); options.before?.(name, args); return fn(...args);
  }]));
  return { fs: backend, nodes, fds, calls, file: () => nodes.get(PATHS[part]) };
}
const deliveredWriterBytes = readFileSync(REPO + '/tooling/native-ingress/split-evidence-publication.mjs');
assert.deepEqual(pin(deliveredWriterBytes), PINS.writer);
const deliveredWriter = await import(uri(deliveredWriterBytes));
for (const part of PARTS) {
  test(`${part}: delivered pinned writer partial read requests pass unchanged controller validation`, () => {
    const memory = publicationMemory(part, { readCap: 7 });
    const publisher = deliveredWriter.createSplitEvidencePublicationFixture({ mockOnly: true }, { fs: memory.fs, guard() {} })
      .reserveSplitEvidencePublication(part);
    assert.equal(memory.file().data.length, 0); assert.equal(publisher.snapshot().ownedFDCount, 2);
    const bytes = Buffer.from('{"collection":{"mockOnly":true,"complete":true}}\n'), record = publisher.publish(bytes);
    source.validatePublication(record, publisher.snapshot(), bytes.length, sha(bytes), part);
    assert.ok(record.counts.requestedReadBytes > bytes.length + 1); assert.ok(record.counts.requestedReadBytes <= 16777217);
    assert.equal(record.counts.readbackBytes, bytes.length); assert.equal(record.counts.readbackHashBytes, bytes.length);
    assert.equal(record.counts.closes, 3); assert.equal(record.counts.fsyncs, 4); assert.equal(memory.fds.size, 0);
    assert.deepEqual(memory.file().data, bytes); assert.equal(memory.file().mode, 0o100444n);
  });
  test(`${part}: full mock controller accepts delivered writer partial read record with matching final SHA`, async () => {
    const memory = publicationMemory(part, { readCap: 32768 }), result = await run(part, { deliveredMemory: memory });
    assert.equal(result.output.exitCode, 0, result.output.text);
    assert.equal(result.receipt.sha256, sha(memory.file().data)); assert.equal(result.receipt.byteLength, memory.file().data.length);
    assert.equal(result.receipt.publicationAccepted, true); assert.equal(result.receipt.jointEvidenceSetComplete, false);
    assert.ok(result.receipt.publicationCounts.requestedReadBytes > memory.file().data.length + 1);
    assert.equal(memory.fds.size, 0);
  });
}

const deliveredSources = new Map(source.rows.map(([key, path]) => [key, readFileSync(path)]));
const deliveredGraphs = Object.fromEntries(PARTS.map(part => [part,
  source.prepareSourceGraph(deliveredSources, GRAPH_PINS, false, part)]));
assert.equal(deliveredGraphs.gnu.collectorUri, deliveredGraphs.rust.collectorUri);
const deliveredHelper = await import(deliveredGraphs.gnu.collectorUri);
const deliveredTar = await import(uri(deliveredGraphs.gnu.outputs.eventTar));
const deliveredSdk = await import(deliveredGraphs.gnu.sdkUri);
const deliveredElf = await import(uri(deliveredSources.get('elfV5')));
const deliveredCores = Object.fromEntries(await Promise.all(PARTS.map(async part => [part,
  await Promise.all(deliveredGraphs[part].coreUris.map(target => import(target)))])));

test('delivered raw, appended, linked and every private part-core source matches immutable pins before import', () => {
  for (const [key, bytes] of deliveredSources) assert.deepEqual(pin(bytes), PINS[key]);
  for (const part of PARTS) for (const [key, bytes] of Object.entries(deliveredGraphs[part].outputs)) assert.deepEqual(pin(bytes), GRAPH_PINS[key]);
});
test('delivered helper constants match independent retained receipts and pure SDK targets', () => {
  const result = source.compareConstants(deliveredHelper, deliveredSdk, receipts);
  assert.deepEqual(result.expectations, expectations); assert.deepEqual(result.targets, targets);
  const manifestReceipt = JSON.parse(readFileSync(REPO + '/_spec/tooling/native-ingress/gnu-sdk-manifest-membership.receipt.json'));
  const helperText = deliveredSources.get('collector').toString();
  assert.equal(helperText.match(/^const SDK_RELOCS_SHA256 = '([a-f0-9]{64})';$/m)[1], manifestReceipt.manifest.sha256);
  assert.equal(manifestReceipt.manifest.byteLength, 9367);
});
for (const part of PARTS) {
  test(`${part}: delivered cores import their part bridge from the parent-identical helper URI`, () => {
    for (const [index, core] of deliveredCores[part].entries()) {
      assert.deepEqual(core.GNU_SDK_DESCRIPTOR, source.descriptorFor(INPUTS[part][index]));
      assert.deepEqual(core.GNU_SDK_LIMITS, source.coreLimits(part));
      assert.ok(decode(deliveredGraphs[part].coreUris[index]).includes('SOURCE_' + part.toUpperCase() + '_TAR as createTarInventory'));
    }
  });
  test(`${part}: delivered internal core clock reserves exactly3s inside fixed total using only fake capabilities`, async () => {
    const batch = deliveredHelper.SOURCE_CREATE_COLLECTOR(part), core = deliveredCores[part][0];
    batch.beginToolchainEvidenceBatch(); batch.beginToolchainEvidenceRole(INPUTS[part][0].role);
    const archive = Buffer.from('MOCK_ONLY_COMPRESSED_BYTES'), owned = new Set(), closed = [], scheduled = [];
    let clock = 0, spawned = false;
    const descriptor = core.GNU_SDK_DESCRIPTOR;
    const metadata = { root: stat(4096, 501, true), file: stat(archive.length, 502) };
    const identity = Object.fromEntries(Object.entries(metadata).map(([key, value]) =>
      [key, Object.fromEntries(Object.entries(value).map(([field, amount]) => [field, String(amount)]))]));
    const kind = target => target === descriptor.root || target === 501 ? 'root' :
      target === descriptor.file || target === 502 ? 'file' : assert.fail('unexpected fake core target');
    const backend = {
      lstatSync(path) { return { ...metadata[kind(path)] }; }, fstatSync(fd) { assert.ok(owned.has(fd)); return { ...metadata[kind(fd)] }; },
      openSync(path) { const fd = kind(path) === 'root' ? 501 : 502; assert.equal(owned.has(fd), false); owned.add(fd); return fd; },
      readSync(fd, bytes, offset, length, position) {
        assert.equal(fd, 502); const count = archive.copy(bytes, offset, position, position + length);
        clock = source.roleMs[part] - 3000; return count;
      },
      closeSync(fd) { assert.ok(owned.delete(fd)); closed.push(fd); },
    };
    const runner = core.createSdkInventoryFixtureRunner({ archiveBytes: archive.length, archiveSha256: sha(archive) }, {
      fs: backend, spawn() { spawned = true; throw new Error('NO_REAL_DECODER'); }, now: () => clock,
      setTimeout(fn, delay) { scheduled.push(delay); return 1; }, clearTimeout() {},
      beforeDecode() { assert.fail('clock must stop before decoder gate'); }, afterDecode() { assert.fail('no decoder'); },
    });
    await assert.rejects(runner(identity), value => value.code === 'E_DEADLINE');
    assert.deepEqual(scheduled, [source.roleMs[part] - 3000]); assert.equal(spawned, false);
    assert.deepEqual(closed, [502, 501]); assert.equal(owned.size, 0); batch.abortToolchainEvidenceBatch();
  });
}

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
function elfBody(type = 3) {
  const bytes = Buffer.alloc(type === 1 ? 128 : 512); bytes.set([127, 69, 76, 70, 2, 1, 1]);
  bytes.writeUInt16LE(type, 16); bytes.writeUInt16LE(62, 18); bytes.writeUInt32LE(1, 20); bytes.writeUInt16LE(64, 52);
  bytes.writeUInt16LE(type === 1 ? 0 : 56, 54);
  if (type === 1) { bytes.writeBigUInt64LE(64n, 40); bytes.writeUInt16LE(64, 58); bytes.writeUInt16LE(1, 60); }
  return bytes;
}
function arBody() {
  const bytes = elfBody(1), field = (value, length) => String(value).padEnd(length, ' ');
  return Buffer.concat([Buffer.from('!<arch>\n'), Buffer.from(field('obj.o/', 16) + field(0, 12) + field(0, 6) +
    field(0, 6) + field('644', 8) + field(bytes.length, 10) + '`\n'), bytes]);
}
const legacyEvent = event => {
  const row = { index: event.index, path: event.path, type: event.type, size: event.size };
  if (['symlink', 'hardlink'].includes(event.type)) { row.linkpath = event.linkpath; row.linkKind = event.linkKind; }
  return { ...row, mode: event.mode, uid: event.uid, gid: event.gid, mtime: event.mtime };
};
function deliveredFixture(part) {
  const archives = [], selected = new Map(), expected = [];
  for (const [index, input] of INPUTS[part].entries()) {
    const root = input.expectedRoot, chunks = [];
    const add = (path, body = Buffer.alloc(0), type = '0', link = '') => chunks.push(Buffer.concat([
      tarHeader(path, body.length, type, link), body, Buffer.alloc((512 - body.length % 512) % 512)]));
    add(root, Buffer.alloc(0), '5');
    if (part === 'gnu') {
      add(root + '/share/buildroot/sdk-relocs', Buffer.from('MOCK_ONLY_RAW_RELOCATION_TEXT\n'));
      add(root + '/share/buildroot/sdk-location', Buffer.from('/fixture/original\n'));
      add(root + '/alias', Buffer.alloc(0), '2', '../literal-only');
    } else {
      const component = input.role === 'rust-std' ? 'rust-std-x86_64-unknown-linux-gnu' : input.role;
      add(root + '/components', Buffer.from(component + '\n')); add(root + '/rust-installer-version', Buffer.from('3\n'));
      add(root + '/' + component + '/manifest.in', Buffer.from('file:bin/mock\ndir:lib\nunknown:DATA\n'));
    }
    add(root + '/unselected/license', Buffer.from('MOCK_ONLY_UNSELECTED\n')); add(root + '/unselected/zero');
    for (const target of targets[part].filter(row => row.artifactRole === input.role).sort((a, b) => (a.index ?? 10000) - (b.index ?? 10000))) {
      const body = target.kind === 'ELF_EXEC_DSO' ? elfBody() : target.kind === 'ET_REL' ? elfBody(1) :
        target.kind === 'AR' ? arBody() : Buffer.from('INPUT ( libmock.so )\n');
      const supplemental = target.index === null;
      selected.set(target.path, { ...target, index: supplemental ? null : chunks.length + 1,
        bodyOffset: supplemental ? null : chunks.reduce((sum, bytes) => sum + bytes.length, 0) + 512,
        size: supplemental ? null : body.length, expectedSha256: target.expectedSha256 === null ? null : sha(body) });
      add(target.path, body);
    }
    const bytes = Buffer.concat([...chunks, Buffer.alloc(1024)]), parser = deliveredTar.createTarInventory(), events = [];
    for (let at = 0; at < bytes.length; at += 65536) events.push(...parser.feed(bytes.subarray(at, at + 65536)));
    const inventory = parser.finish();
    expected.push({ ...expectations[part][index], expandedBytes: bytes.length, entries: inventory.entries,
      headers: inventory.headers, regularFiles: events.filter(event => event.type === 'file').length, decodedSha256: sha(bytes),
      metadataSha256: part === 'gnu' ? sha(events.map(event => JSON.stringify(legacyEvent(event)) + '\n').join('')) : inventory.metadataSha256 });
    archives.push(bytes);
  }
  const inputs = INPUTS[part].map((input, index) => ({ ...input, root: '/fixture/split-' + index,
    file: '/fixture/split-' + index + '/' + input.expectedRoot + '.tar.xz', archiveBytes: index + 3,
    archiveSha256: sha('MOCK_ONLY_COMPRESSED_' + part + index), identity: { root: input.identity.root,
      file: { ...input.identity.file, size: String(index + 3) } } }));
  return { archives, profile: { mockOnly: true, inputs, targets: targets[part].map(target => selected.get(target.path)), expectations: expected, limits: {} } };
}
for (const part of PARTS) test(`${part}: delivered shared-URI helper/TAR/ELF/formats finish complete synthetic partition with fake capabilities only`, () => {
  const { archives, profile } = deliveredFixture(part), formats = [], elfCalls = [];
  const batch = deliveredHelper.createSplitToolchainEvidenceFixture(part, profile, {
    parserFactory: deliveredTar.createTarInventory,
    elfInspector(bytes) { elfCalls.push(bytes.length); return deliveredElf.inspectElf64RequirementsV5(bytes); },
    formatInspectors: Object.fromEntries(Object.entries(deliveredSdk.SOURCE_FORMAT_INSPECTORS).map(([name, fn]) =>
      [name, bytes => { formats.push(name); return fn(bytes); }])),
  });
  batch.beginToolchainEvidenceBatch();
  for (const [index, input] of profile.inputs.entries()) {
    batch.beginToolchainEvidenceRole(input.role); const parser = batch.createTarInventory();
    for (let at = 0; at < archives[index].length; at += 65536) parser.feed(archives[index].subarray(at, at + 65536));
    const inventory = parser.finish();
    const core = { ...coreValue(part, index), mockOnly: true, inventory, archiveBytes: input.archiveBytes,
      archiveSha256: input.archiveSha256, archiveDataBytes: input.archiveBytes * 2, archiveRequestedBytes: input.archiveBytes * 2 + 2 };
    batch.acceptToolchainEvidenceRole(core);
  }
  const result = batch.finishToolchainEvidenceBatch(); source.preflight(result, 16777216, () => {}, true);
  assert.equal(result.part, part); assert.equal(result.selectedPayloads, PROFILES[part].targetCount); assert.equal(result.artifactCount, INPUTS[part].length);
  assert.equal(result.mockOnly, true); assert.equal(result.nativeQualified, false); assert.equal(result.rustReady, false);
  assert.ok(elfCalls.length > 0); assert.ok(formats.includes('linker')); if (part === 'gnu') assert.ok(formats.includes('archive') && formats.includes('rel'));
  for (const role of result.roles) {
    assert.equal(role.members.filter(member => member.type === 'file').length, profile.expectations.find(row => row.role === role.role).regularFiles);
    for (const member of role.members.filter(member => member.type !== 'file')) { assert.equal(member.bodySha256, null); assert.equal(member.linkFollowed, false); }
  }
});

test('both independent fixture entries can succeed without claiming joint acceptance or touching V1', async () => {
  const h = harness(), outputs = [];
  for (const part of PARTS) {
    const output = await h.fixture[entry(part)](); assert.equal(output.exitCode, 0, output.text); outputs.push(JSON.parse(output.text));
    assert.equal(JSON.parse((await h.fixture[entry(part)]()).text).error, 'E_INPUT');
  }
  assert.equal(h.written.size, 2);
  for (const receipt of outputs) { assert.equal(receipt.publicationAccepted, true); assert.equal(receipt.jointEvidenceSetComplete, false); }
  assert.ok(h.io.calls.filter(([name]) => name === 'open').every(([, path]) => !path.endsWith('.result.json')));
});
test('production latches remain independent in a raw-URI graph with fake builtins and zero real I/O', async () => {
  const bytes = readFileSync(REPO + '/tooling/native-ingress/split-toolchain-evidence-operation.mjs');
  const fakeFs = uri(`const stop = () => { throw new Error('MOCK_ONLY_NO_IO'); };
    export default Object.freeze({ constants: Object.freeze(${JSON.stringify({ O_RDONLY: constants.O_RDONLY,
      O_NOFOLLOW: constants.O_NOFOLLOW, O_NONBLOCK: constants.O_NONBLOCK })}),
      lstatSync: stop, openSync: stop, fstatSync: stop, readSync: stop, closeSync: stop });`);
  const fakeChild = uri("export const spawn = () => { throw new Error('MOCK_ONLY_NO_CHILD'); };\n");
  const linked = source.replaceOnce(source.replaceOnce(bytes.toString(), "from 'node:fs'", "from '" + fakeFs + "'"),
    "from 'node:child_process'", "from '" + fakeChild + "'");
  const operation = await import(uri(linked));
  for (const part of PARTS) {
    assert.equal(JSON.parse((await operation[entry(part)]('invalid')).text).error, 'E_INPUT');
    const first = JSON.parse((await operation[entry(part)]()).text);
    assert.equal(first.error, 'E_IO'); assert.equal(first.repoCapture.openAttempts, 0); assert.equal(first.collectionCounts.spawnAttempts, 0);
    assert.equal(first.publicationAccepted, false); assert.equal(first.jointEvidenceSetComplete, false);
    assert.equal(JSON.parse((await operation[entry(part)]()).text).error, 'E_INPUT');
  }
});
for (const part of PARTS) {
  test(`${part}: expired clock cleanup records uncertainty without double close or retry`, async () => {
    const result = await run(part, { publishError: 'E_PUBLICATION_GUARD', abortUncertain: true });
    stop(result, 'E_PUBLICATION_CLOSE'); assert.equal(result.receipt.abortUncertain, true);
    assert.equal(result.h.events.filter(([name]) => name === 'abortWriter').length, 1);
    assert.equal(result.h.events.filter(([name]) => name === 'abortCollector').length, 1);
  });
  for (const [option, code] of [['writerAbortError', 'E_PUBLICATION_ABORT'], ['collectorAbortError', 'E_COLLECTION_ABORT']]) {
    test(`${part}: ${option} withholds receipt acceptance`, async () => {
      stop(await run(part, { coreFailure: INPUTS[part].length - 1, [option]: true }), code);
    });
  }
  test(`${part}: last collector acceptance failure never publishes`, async () => {
    const result = await run(part, { acceptFailure: PROFILES[part].roles.at(-1) }); stop(result, 'E_COLLECTION');
    assert.equal(result.h.written.size, 0);
  });
  test(`${part}: delivered writer keeps its early empty reservation after collection failure without touching V1`, async () => {
    const memory = publicationMemory(part), result = await run(part, { deliveredMemory: memory, coreFailure: 0 });
    stop(result, 'E_HASH'); assert.equal(memory.file().data.length, 0); assert.equal(memory.fds.size, 0);
    assert.equal(memory.file().mode, 0o100600n);
    assert.ok(memory.calls.filter(([name]) => name === 'openSync').every(([, args]) => args[0] === PATHS[part] || args[0] === REPO + '/_spec/tooling/native-ingress'));
  });
}
test('each Rust role repeats the70s admission check instead of relying on first-role admission', async () => {
  const equal = await run('rust', { event(name, role, set) { if (name === 'accept' && role === 'rustfmt-preview') set(230000); } });
  assert.equal(equal.output.exitCode, 0, equal.output.text);
  const below = await run('rust', { event(name, role, set) { if (name === 'accept' && role === 'rustfmt-preview') set(230001); } });
  stop(below, 'E_DEADLINE'); assert.equal(below.h.events.some(([name, role]) => name === 'archive' && role === 'clippy-preview'), false);
});
test('final collection freeze visits shared descendants even when their parent is already frozen', () => {
  const child = { nested: {} }, value = Object.freeze({ child, alias: child }); source.freeze(value);
  assert.ok(Object.isFrozen(child)); assert.ok(Object.isFrozen(child.nested));
});
