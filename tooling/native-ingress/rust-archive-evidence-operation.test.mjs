// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import * as operation from './rust-archive-evidence-operation.mjs';

const { RUST_ARCHIVE_ROLES: ROLES, RUST_ARCHIVE_INPUTS: INPUTS, RUST_ARCHIVE_PROFILES: PROFILES,
  RUST_ARCHIVE_PATHS: PATHS, RUST_ARCHIVE_SOURCE_PINS: PINS, RUST_ARCHIVE_GRAPH_PINS: GRAPH,
  RUST_ARCHIVE_LIMITS: LIMITS, rustArchiveEvidenceOperationSource: source,
  createRustArchiveEvidenceOperationFixture: fixture } = operation;
const REPO = '/tmp/opencode/f9-bootstrap-correspondence';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = bytes => ({ bytes: bytes.length, sha256: sha(bytes) });
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const decode = target => Buffer.from(target.slice(target.indexOf(',') + 1), 'base64').toString();
const clone = value => JSON.parse(JSON.stringify(value));
const error = code => Object.assign(new Error(code), { code });
const throws = (fn, code) => assert.throws(fn, value => value.code === code);
const entry = role => ({ cargo: 'runRegisteredCargoEvidenceV1', rustc: 'runRegisteredRustcEvidenceV1',
  'rust-std': 'runRegisteredRustStdEvidenceV1', 'rustfmt-preview': 'runRegisteredRustfmtEvidenceV1',
  'clippy-preview': 'runRegisteredClippyEvidenceV1' })[role];
const retained = new Map(source.rows.map(([key, path]) => [key, readFileSync(path)]));
const receipts = Object.fromEntries([...retained].filter(([key]) => key.endsWith('Receipt')).map(([key, bytes]) => [key, JSON.parse(bytes)]));
const graph = source.prepareSourceGraph(retained, GRAPH, false, 'cargo');
const helper = await import(graph.collectorUri);
const writer = await import(graph.writerUri);
const tar = await import(uri(graph.outputs.eventTar));
const sdk = await import(graph.sdkUri);
const elf = await import(uri(retained.get('elfV5')));
const cores = Object.fromEntries(await Promise.all(ROLES.map(async role => [role, await import(graph.coreUris[role])])));
const expectations = helper.SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS.rust;
const targets = helper.SPLIT_TOOLCHAIN_EVIDENCE_TARGETS.rust;
function stat(size, ino = 10, directory = false) {
  return { dev: directory ? 28n : 29n, ino: BigInt(ino), mode: directory ? 0o40700n : 0o100600n,
    uid: 1000n, gid: 1000n, nlink: directory ? 2n : 1n, size: BigInt(size), mtimeNs: 123n, ctimeNs: 456n };
}
function sourceFs(options = {}, event = () => {}) {
  const files = new Map(source.rows.map(([key, path], index) => [path,
    { bytes: retained.get(key), stat: stat(retained.get(key).length, index + 10), key }]));
  const fds = new Map(), calls = []; let next = 3;
  const backend = {
    lstatSync(path, flags) {
      calls.push(['lstat', path]); event('sourceStat', path); assert.deepEqual(flags, { bigint: true });
      const value = path === REPO ? stat(4096, 2, true) : files.get(path)?.stat;
      if (!value) throw error('ENOENT');
      return options.stat ? options.stat({ ...value }, path) : { ...value };
    },
    openSync(path, flags) {
      calls.push(['open', path]); event('sourceOpen', path);
      assert.equal(flags, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
      assert.ok(files.has(path), 'only repository source/receipt files may be captured');
      if (options.openError) throw error('ENOENT');
      const fd = next++; fds.set(fd, files.get(path)); return fd;
    },
    fstatSync(fd, flags) {
      assert.deepEqual(flags, { bigint: true }); const value = fds.get(fd); assert.ok(value);
      return options.fdStat ? options.fdStat({ ...value.stat }, value.key) : { ...value.stat };
    },
    readSync(fd, bytes, offset, length, position) {
      calls.push(['read', fd, length, position]); event('sourceRead', position);
      const value = fds.get(fd); assert.ok(value); assert.ok(length <= 65536);
      if (options.readError) throw error('EIO');
      if (options.shortRead) return 0;
      if (options.extraEof && position === value.bytes.length) return 1;
      const amount = Math.min(length, Math.max(0, value.bytes.length - position));
      value.bytes.copy(bytes, offset, position, position + amount);
      if (options.corrupt && position === 0) bytes[offset] ^= 1;
      return amount;
    },
    closeSync(fd) {
      calls.push(['close', fd]); assert.ok(fds.delete(fd)); event('sourceClose', fd);
      if (options.closeError) throw error('EIO');
    },
  };
  return { backend, files, fds, calls };
}
function publicationMemory(role, options = {}) {
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
      assert.ok(path === directory || path === PATHS[role], 'no old, accepted, alternate or other-role result path');
      if (flags & constants.O_CREAT) {
        assert.equal(path, PATHS[role]); assert.equal(mode, 0o600); assert.ok(flags & constants.O_EXCL);
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
  const backend = Object.fromEntries(Object.entries(methods).map(([name, fn]) => [name, (...args) => {
    calls.push([name, args]); options.before?.(name, args); return fn(...args);
  }]));
  return { fs: backend, nodes, fds, calls, file: () => nodes.get(PATHS[role]) };
}
function coreValue(role) {
  const input = INPUTS[role], expected = expectations.find(row => row.role === role);
  return { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: false, archiveBytes: input.archiveBytes,
    archiveSha256: input.archiveSha256, archivePasses: 2, archiveDataBytes: input.archiveBytes * 2,
    archiveRequestedBytes: input.archiveBytes * 2 + 2, closeAttempts: 2, expandedBytes: expected.expandedBytes,
    streamEvents: 10, inventory: { entries: expected.entries, headers: expected.headers, metadataSha256: expected.metadataSha256 },
    exitCode: 0, signal: null, stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true,
    extracted: false, extractionAuthorized: false, installedUsability: false, decoderQualified: false,
    provenanceVerified: false, hardRssBounded: false, processTreeBounded: false, hardDeadlineGuaranteed: false,
    nativeQualified: false, pythonFreeSubsetVerified: false, rustReady: false, trainingReady: false };
}
function mockCollection(role) {
  const input = INPUTS[role], profile = PROFILES[role], expected = expectations.find(row => row.role === role);
  const members = Array.from({ length: expected.entries }, (_, ordinal) => ({ index: ordinal + 1,
    path: input.expectedRoot + '/mock-' + ordinal, bodyOffset: (ordinal + 1) * 512, size: 0,
    type: ordinal < expected.regularFiles ? 'file' : 'directory',
    ...(ordinal < expected.regularFiles ? { bodySha256: sha('') } : { bodySha256: null, linkFollowed: false }) }));
  const protectedIndices = new Set();
  const selected = targets.filter(row => row.artifactRole === role).map(target => {
    const ordinal = target.index - 1, member = members[ordinal]; protectedIndices.add(ordinal);
    Object.assign(member, { path: target.path, type: 'file', size: target.size,
      bodyOffset: target.bodyOffset, bodySha256: target.expectedSha256 });
    return { ...target, bodySha256: member.bodySha256, hashObservation: 'MATCHED_EXPECTED_BODY_HASH',
      metadata: target.kind === 'ELF_EXEC_DSO' ? { state: 'ELF_EXEC_DSO_REQUIREMENT_DATA', requirements: { dynamic: { needed: [] } },
        unsafeLoadingTags: [], loadingTagsQualification: 'NOT_QUALIFIED', qualified: false } :
        { state: 'SOURCE_FORMAT_DATA', observation: { mockOnly: true }, qualified: false },
      qualified: false, abiVerified: false, roleSatisfied: false };
  });
  const manifests = Array.from({ length: 3 }, (_, ordinal) => {
    const text = 'MOCK_ONLY_FULL_TEXT\n', bodySha256 = sha(text); protectedIndices.add(ordinal);
    Object.assign(members[ordinal], { path: input.expectedRoot + '/mock-manifest-' + ordinal, type: 'file', size: text.length, bodySha256 });
    return { path: members[ordinal].path, kind: 'MOCK_ONLY', bodySha256, text, declarations: [], interpreted: false };
  });
  let regular = members.filter(row => row.type === 'file').length;
  for (let ordinal = members.length - 1; regular > expected.regularFiles && ordinal >= 0; ordinal--) {
    if (members[ordinal].type !== 'file' || protectedIndices.has(ordinal)) continue;
    Object.assign(members[ordinal], { type: 'directory', size: 0, bodySha256: null, linkFollowed: false }); regular--;
  }
  return { profile: 'SPLIT_TOOLCHAIN_EVIDENCE_DATA', state: 'SPLIT_TOOLCHAIN_EVIDENCE_DATA', part: 'rust', mockOnly: false,
    entries: profile.entries, regularFiles: profile.regularFiles, expandedBytes: profile.expandedBytes,
    completeNamespace: true, selectedPayloads: profile.targetCount, targetCount: profile.targetCount, artifactCount: 1,
    declaredNeededEdges: [], roles: [{ ...input, ...expected, offsetMetadataSha256: expected.metadataSha256,
      legacyMetadataSha256: sha('MOCK_ONLY_LEGACY_NOT_OFFSET'), inventory: { metadataSha256: expected.metadataSha256 },
      completeNamespace: true, members, selected, manifests }] };
}
function harness(options = {}) {
  let clock = 0, activeRole = null;
  const events = [], imports = [], memories = new Map();
  const setClock = value => { clock = value; };
  const event = (name, value) => { events.push([name, value]); options.event?.(name, value, setClock); };
  const io = sourceFs(options.source, event);
  const mockedHelper = { ...helper, createSplitToolchainEvidenceCollector() { assert.fail('old public factory must never run'); },
    SOURCE_CREATE_ARCHIVE(role) {
      event('createCollector', role); let accepted = 0, current = null, phase = 'ACTIVE', entries = 0, expandedBytes = 0;
      return {
        beginToolchainEvidenceBatch() { event('begin', role); },
        beginToolchainEvidenceRole(value) { assert.equal(value, role); current = value; event('role', value); },
        createTarInventory() { assert.fail('mock controller never parses archives'); },
        acceptToolchainEvidenceRole(core) {
          event('accept', role); if (options.acceptFailure) throw error('E_COLLECTION');
          accepted++; current = null; entries += core.inventory.entries; expandedBytes += core.expandedBytes;
        },
        snapshotToolchainEvidenceBatch() { return { part: 'rust', state: phase, mockOnly: false, acceptedRoles: accepted, currentRole: current,
          entries, expandedBytes, metadataBytes: 0, manifestBytes: 0, capturedBytes: 0, selectedPayloads: 0,
          activeBufferBytes: 0, activeBodyHashes: 0 }; },
        finishToolchainEvidenceBatch() {
          event('finish', role); const value = mockCollection(role), result = options.collection ? options.collection(value, role) : value;
          return options.shallowFrozen ? Object.freeze(result) : source.freeze(result);
        },
        abortToolchainEvidenceBatch() { event('abortCollector', role); phase = 'ABORTED'; if (options.collectorAbortError) throw error('E_IO'); },
        getToolchainEvidenceFailure() { return null; },
      };
    },
  };
  options.constants?.(mockedHelper);
  const mockedWriter = { ...writer, reserveSplitEvidencePublication(role, guard) {
    event('reserve', role); activeRole = role;
    assert.equal(events.some(([name, value]) => name === 'archive' && value === role), false);
    const memory = publicationMemory(role, { ...options.publication, exists: options.exists }); memories.set(role, memory);
    const actual = writer.createSplitEvidencePublicationFixture({ mockOnly: true }, { fs: memory.fs, guard }).reserveSplitEvidencePublication(role);
    return {
      snapshot: () => actual.snapshot(),
      publish(bytes) {
        event('publish', role); assert.equal(events.filter(([name, value]) => name === 'accept' && value === role).length, 1);
        const record = actual.publish(bytes); event('published', role);
        if (options.record) return options.record(clone(record));
        return record;
      },
      abort() { event('abortWriter', role); const result = actual.abort(); if (options.writerAbortError) throw error('E_IO'); return result; },
    };
  } };
  const stage = {
    verifyStagedXzImages() {
      event('stage', activeRole); if (options.stageFailure) throw error('E_METADATA');
      return { counters: { fsCalls: 80, readBytes: 2758216, closeAttempts: options.stageCloses ?? 5 } };
    },
    assertNoSystemPreload() { event('preload', activeRole); return !options.preload; },
  };
  const config = { mockOnly: true, fs: io.backend, now: () => options.now ? options.now(clock) : clock,
    spawn() { event('spawn', activeRole); return new EventEmitter(); }, setTimeout() { return 1; }, clearTimeout() {},
    async moduleImporter(target) {
      imports.push(target); event('import', imports.length); if (options.importWait) await options.importWait(target);
      if (target === graph.collectorUri) return mockedHelper;
      if (target === graph.writerUri) return mockedWriter;
      if (target === graph.stageUri) return stage;
      const role = ROLES.find(key => graph.coreUris[key] === target); assert.ok(role, 'only pinned private graph imports');
      return { GNU_SDK_DESCRIPTOR: cores[role].GNU_SDK_DESCRIPTOR, GNU_SDK_LIMITS: cores[role].GNU_SDK_LIMITS,
        async runGnuSdkInventory(identity, deps) {
          const input = INPUTS[role]; assert.equal(activeRole, role); assert.deepEqual(identity, input.identity); event('archive', role);
          deps.beforeDecode(); const d = cores[role].GNU_SDK_DESCRIPTOR.decoderRoot;
          const child = deps.spawn(d + '/ld-linux-x86-64.so.2', ['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', d,
            d + '/xz', '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=268435456', '--', '-'],
          { cwd: d, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
          child.emit('spawn'); child.emit('close', 0, null); deps.afterDecode(); event('afterCore', role);
          if (options.coreFailure && (!options.failRole || options.failRole === role)) throw error(options.coreFailure);
          const value = coreValue(role); return options.core ? options.core(value) : value;
        } };
    },
  };
  return { fixture: fixture(config), config, io, events, imports, memories, setClock };
}
async function run(role = 'cargo', options = {}) {
  const h = harness(options), output = await h.fixture[entry(role)]();
  assert.ok(Object.isFrozen(output)); assert.ok(output.text.length <= 65536); assert.match(output.text, /^[\x00-\x7f]*\n$/);
  const receipt = JSON.parse(output.text); assert.equal(receipt.mockOnly, true); assert.equal(receipt.realArchiveInspected, false);
  return { h, output, receipt };
}
function stop(result, code) {
  assert.equal(result.output.exitCode, 1, result.output.text); assert.equal(result.receipt.status, 'STOP');
  assert.equal(result.receipt.publicationAccepted, false); assert.equal(result.receipt.jointEvidenceSetComplete, false);
  if (code) assert.equal(result.receipt.error, code, result.output.text);
  assert.equal(Object.hasOwn(result.receipt, 'collection'), false);
}

test('only five closed zero-argument production entry points reject overrides without real I/O', async () => {
  for (const role of ROLES) {
    assert.equal(operation[entry(role)].length, 0);
    assert.equal(JSON.parse((await operation[entry(role)]({ path: '/forbidden', profile: {} })).text).error, 'E_INPUT');
  }
});
test('operation boots directly from captured data URI with only Node builtin imports and absolute repository paths', async () => {
  const bytes = readFileSync(REPO + '/tooling/native-ingress/rust-archive-evidence-operation.mjs');
  assert.doesNotMatch(bytes.toString(), /import\.meta|^import .*from ['"]\.\.?\//m);
  const module = await import(uri(bytes));
  for (const role of ROLES) assert.equal(JSON.parse((await module[entry(role)]('invalid')).text).error, 'E_INPUT');
});
test('raw sources remain immutable; fourteen repository captures exclude all result/archive/provider paths', () => {
  assert.equal(source.rows.length, 14);
  for (const [key, path] of source.rows) {
    assert.deepEqual(pin(retained.get(key)), PINS[key]); assert.ok(path.startsWith(REPO + '/'));
    assert.doesNotMatch(path, /\.result\.json$|\.tar\.xz$|\/host-|split-toolchain-evidence-operation/);
  }
  assert.deepEqual(pin(readFileSync(REPO + '/tooling/native-ingress/split-toolchain-evidence-operation.mjs')),
    { bytes: 60938, sha256: '47969e039e9f3bd192c869b0a43dd9ec88b2b934aeb11fc5e4f56da9918475b1' });
});
test('full graph pins cover every raw/appended/linked writer/helper and five static core images before imports', () => {
  assert.equal(Object.keys(GRAPH).length, 46);
  for (const [key, bytes] of Object.entries(graph.outputs)) assert.deepEqual(pin(bytes), GRAPH[key], key);
  assert.equal(decode(graph.collectorUri).slice(0, retained.get('collector').length).split("from '")[0], retained.get('collector').toString().split("from '")[0]);
  assert.ok(graph.outputs.appendedCollector.subarray(0, PINS.collector.bytes).equals(retained.get('collector')));
  assert.ok(graph.outputs.appendedSdk.subarray(0, PINS.sdk.bytes).equals(retained.get('sdk')));
  assert.ok(graph.outputs.appendedSdk.toString().endsWith('\nexport const SOURCE_FORMAT_INSPECTORS = Object.freeze({rel,archive,linker});\n'));
  assert.doesNotMatch(decode(graph.collectorUri), /from '\.\//);
});
test('private writer changes only its two complete constant declaration blocks', () => {
  const original = retained.get('writer').toString(), specialized = decode(graph.writerUri);
  const strip = text => text.replace(/export const SPLIT_EVIDENCE_PARTS = Object\.freeze\([^;]*\);/, '<PARTS>')
    .replace(/export const SPLIT_EVIDENCE_PATHS = Object\.freeze\([\s\S]*?\);/, '<PATHS>');
  assert.equal(strip(original), strip(specialized));
  assert.deepEqual(writer.SPLIT_EVIDENCE_PARTS, ROLES); assert.deepEqual(writer.SPLIT_EVIDENCE_PATHS, PATHS);
  assert.deepEqual(writer.SPLIT_EVIDENCE_PUBLICATION_LIMITS, source.writerLimits);
  assert.equal(source.transformWriter(retained.get('writer')).equals(graph.outputs.linkedWriter), true);
});
test('all five profiles keep120s including3s cleanup,150s admission,10s source,30s publication and300s outer', () => {
  assert.deepEqual(LIMITS, { sourceMs: 10000, totalMs: 300000, roleMs: 120000, cleanupMs: 3000, publicationMs: 30000,
    admissionMs: 150000, sourceBytes: 1048576, sourceFsOperations: 8192, sourceReadsPerFile: 128,
    dataBytes: 16777216, receiptBytes: 65536, depth: 64, nodes: 1048576 });
  assert.deepEqual(ROLES.map(role => [PROFILES[role].entries, PROFILES[role].regularFiles, PROFILES[role].expandedBytes, PROFILES[role].targetCount]),
    [[68, 56, 42864128, 1], [70, 53, 402308096, 7], [81, 74, 166755840, 1], [22, 16, 9112576, 2], [22, 16, 21706240, 2]]);
});
test('std and preview basenames derive from original input constants, not artifact role', () => {
  assert.equal(INPUTS['rust-std'].expectedRoot, 'rust-std-1.95.0-x86_64-unknown-linux-gnu');
  assert.equal(INPUTS['rustfmt-preview'].expectedRoot, 'rustfmt-1.95.0-x86_64-unknown-linux-gnu');
  assert.equal(INPUTS['clippy-preview'].expectedRoot, 'clippy-1.95.0-x86_64-unknown-linux-gnu');
});
for (const role of ROLES) {
  test(`${role}: singleton profile, thirteen distributed known-body targets and nine-field identity match old Rust constants`, () => {
    const result = source.compareConstants(helper, receipts, role);
    assert.deepEqual(result.inputs, [INPUTS[role]]); assert.equal(result.targets.length, PROFILES[role].targetCount);
    assert.equal(result.expectations.length, 1); assert.equal(result.expectations[0].metadataHashKind, 'OFFSET_EVENT_METADATA');
    assert.equal(INPUTS[role].decoderMemoryBytes, 268435456); assert.equal(Object.keys(INPUTS[role].identity.file).length, 9);
    assert.ok(result.targets.every(row => row.artifactRole === role && /^[a-f0-9]{64}$/.test(row.expectedSha256)));
  });
  test(`${role}: static bridge binds same private collector URI and unchanged parser bodies`, () => {
    const text = decode(graph.coreUris[role]), observed = [];
    source.transformCore(retained.get('rawCore'), role, (name, bytes) => observed.push([name, pin(bytes)]));
    assert.deepEqual(observed.map(([name]) => name), ['descriptor', 'events', 'summary', 'selectors', 'memory', 'parserBinding']);
    for (const [name, value] of observed) assert.deepEqual(value, GRAPH[role + ':' + name]);
    assert.ok(text.includes(source.bridges[role] + ' as createTarInventory')); assert.ok(text.includes("from '" + graph.collectorUri + "'"));
    assert.match(text, /maxTotalMs: 120_000, cleanupMs: 3000/); assert.match(text, /const selectors = Object.freeze\(\[\]\);/);
    assert.deepEqual(cores[role].GNU_SDK_DESCRIPTOR, source.descriptorFor(INPUTS[role])); assert.deepEqual(cores[role].GNU_SDK_LIMITS, source.coreLimits());
  });
  test(`${role}: full mock controller publishes exactly one archive with full DATA but no acceptance/selfdigest in file`, async () => {
    const result = await run(role), { h, receipt } = result; assert.equal(result.output.exitCode, 0, result.output.text);
    const bytes = h.memories.get(role).file().data, data = JSON.parse(bytes);
    assert.equal(receipt.publicationAccepted, true); assert.equal(receipt.jointEvidenceSetComplete, false);
    assert.equal(receipt.artifactRole, role); assert.equal(receipt.part, 'rust'); assert.equal(receipt.profile, 'RUST_ARCHIVE_EVIDENCE_DATA');
    assert.equal(receipt.path, PATHS[role]); assert.equal(receipt.sha256, sha(bytes)); assert.equal(receipt.byteLength, bytes.length);
    assert.equal(data.collection.artifactCount, 1); assert.equal(data.collection.roles[0].role, role);
    assert.equal(data.artifactRole, role); assert.equal(data.collection.profile, 'SPLIT_TOOLCHAIN_EVIDENCE_DATA');
    assert.equal(data.collection.part, 'rust'); assert.equal(data.mockOnly, true); assert.equal(bytes.at(-1), 10);
    assert.ok(bytes.every(byte => byte <= 127));
    for (const key of ['selfDigest', 'publicationAccepted', 'publication', 'publicationRecord', 'publicationCounts', 'postwriteCounts', 'postWriteCounts']) {
      assert.equal(Object.hasOwn(data, key), false);
    }
    assert.equal(h.imports.length, 4); assert.deepEqual(h.events.filter(([name]) => name === 'archive').map(([, value]) => value), [role]);
    assert.ok(h.events.findIndex(([name]) => name === 'reserve') < h.events.findIndex(([name]) => name === 'archive'));
    assert.equal(h.memories.get(role).fds.size, 0); assert.equal(Object.hasOwn(receipt, 'collection'), false);
  });
  test(`${role}: two compressed SHA/EOF passes,positive archive/child/stage/publication closes and global6 scope`, async () => {
    const { receipt } = await run(role), c = receipt.collectionCounts, p = receipt.publicationCounts;
    assert.equal(c.archivePasses, 2); assert.equal(c.archiveDataBytes, INPUTS[role].archiveBytes * 2);
    assert.equal(c.archiveRequestedBytes, INPUTS[role].archiveBytes * 2 + 2); assert.equal(c.archiveCloseAttempts, 2);
    assert.equal(c.childCloses, 1); assert.equal(c.stageChecks, 2); assert.equal(c.preloadChecks, 2); assert.equal(c.stageCloses, 10);
    assert.equal(c.ownedChildren, 0); assert.equal(c.peakChildren, 1); assert.equal(receipt.repoCapture.peakOwnedFds, 1);
    assert.equal(receipt.repoCapture.completedCaptures, 14); assert.equal(receipt.repoCapture.closes, 14);
    assert.equal(p.closes, 3); assert.equal(p.fsyncs, 4); assert.equal(p.ownedSnapshotBytes, 0); assert.equal(p.ownedScratchBytes, 0);
    assert.match(receipt.descriptorScope, /at most6/); assert.equal(receipt.nativeQualified, false); assert.equal(receipt.noPythonRuntimeVerified, false);
  });
  test(`${role}: EEXIST stops before collector/archive/decoder and never reads or alters existing reservation`, async () => {
    const result = await run(role, { exists: true }); stop(result, 'E_PUBLICATION_EXISTS');
    assert.equal(result.h.events.some(([name]) => ['archive', 'spawn', 'createCollector'].includes(name)), false);
    const memory = result.h.memories.get(role); assert.equal(memory.fds.size, 0); assert.equal(memory.file(), undefined);
    assert.equal(memory.calls.some(([name]) => name === 'readSync' || name === 'writeSync' || name === 'fchmodSync'), false);
  });
  test(`${role}: controller exact120s stops while119999ms accepts including cleanup`, async () => {
    stop(await run(role, { event(name, _, set) { if (name === 'afterCore') set(120000); } }), 'E_DEADLINE');
    const below = await run(role, { event(name, _, set) { if (name === 'afterCore') set(119999); } });
    assert.equal(below.output.exitCode, 0, below.output.text);
  });
  test(`${role}:150000ms remaining admits inclusively;149999ms blocks archive`, async () => {
    const equal = await run(role, { event(name, _, set) { if (name === 'begin') set(150000); } }); assert.equal(equal.output.exitCode, 0, equal.output.text);
    const below = await run(role, { event(name, _, set) { if (name === 'begin') set(150001); } }); stop(below, 'E_DEADLINE');
    assert.equal(below.h.events.some(([name]) => name === 'archive'), false);
  });
  test(`${role}: delivered writer accepts bounded partial read records without strict requested-byte equality`, async () => {
    const result = await run(role, { publication: { readCap: 7777 } }); assert.equal(result.output.exitCode, 0, result.output.text);
    const c = result.receipt.publicationCounts; assert.ok(c.requestedReadBytes > result.receipt.byteLength + 1);
    assert.ok(c.requestedReadBytes <= 16777217); assert.equal(c.readbackHashBytes, result.receipt.byteLength);
  });
  test(`${role}: actual private factory and static bridge have independent one-shot ownership`, async () => {
    const isolated = await import(uri(Buffer.concat([graph.outputs.linkedCollector, Buffer.from('\n')])));
    const batch = isolated.SOURCE_CREATE_ARCHIVE(role); batch.beginToolchainEvidenceBatch(); batch.beginToolchainEvidenceRole(role);
    assert.equal(batch.snapshotToolchainEvidenceBatch().currentRole, role);
    const parser = isolated[source.bridges[role]]({}); assert.equal(typeof parser.feed, 'function');
    throws(() => isolated.SOURCE_CREATE_ARCHIVE(role), 'E_EVIDENCE_STATE');
    batch.abortToolchainEvidenceBatch(); assert.equal(batch.snapshotToolchainEvidenceBatch().activeBufferBytes, 0);
  });
  test(`${role}: delivered core work clock ends at117s and reserves3s cleanup without any real decoder`, async () => {
    const batch = helper.SOURCE_CREATE_ARCHIVE(role); batch.beginToolchainEvidenceBatch(); batch.beginToolchainEvidenceRole(role);
    const core = cores[role], archive = Buffer.from('MOCK_ONLY_COMPRESSED'), owned = new Set(), closed = [], scheduled = [];
    const descriptor = core.GNU_SDK_DESCRIPTOR; let clock = 0;
    const metadata = { root: stat(4096, 501, true), file: stat(archive.length, 502) };
    const identity = Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key,
      Object.fromEntries(Object.entries(value).map(([field, amount]) => [field, String(amount)]))]));
    const kind = target => target === descriptor.root || target === 501 ? 'root' :
      target === descriptor.file || target === 502 ? 'file' : assert.fail('unexpected fake core target');
    const backend = {
      lstatSync(path) { return { ...metadata[kind(path)] }; },
      fstatSync(fd) { assert.ok(owned.has(fd)); return { ...metadata[kind(fd)] }; },
      openSync(path) { const fd = kind(path) === 'root' ? 501 : 502; assert.equal(owned.has(fd), false); owned.add(fd); return fd; },
      readSync(fd, bytes, offset, length, position) { assert.equal(fd, 502); const amount = archive.copy(bytes, offset, position, position + length); clock = 117000; return amount; },
      closeSync(fd) { assert.ok(owned.delete(fd)); closed.push(fd); },
    };
    const runner = core.createSdkInventoryFixtureRunner({ archiveBytes: archive.length, archiveSha256: sha(archive) }, {
      fs: backend, spawn() { assert.fail('NO_REAL_DECODER'); }, now: () => clock,
      setTimeout(_, delay) { scheduled.push(delay); return 1; }, clearTimeout() {},
      beforeDecode() { assert.fail('expired work deadline'); }, afterDecode() { assert.fail('no decoder'); },
    });
    await assert.rejects(runner(identity), value => value.code === 'E_DEADLINE');
    assert.deepEqual(scheduled, [117000]); assert.deepEqual(closed, [502, 501]); assert.equal(owned.size, 0);
    batch.abortToolchainEvidenceBatch();
  });
}
for (const code of ['E_HASH', 'E_TAR', 'E_METADATA', 'E_CLOSE', 'E_PIPE', 'E_DECODER']) test(`${code}: failed selected archive leaves only empty0600 own reservation`, async () => {
  const result = await run('cargo', { coreFailure: code }); stop(result, code);
  const memory = result.h.memories.get('cargo'); assert.equal(memory.file().data.length, 0); assert.equal(memory.file().mode, 0o100600n);
  assert.equal(memory.fds.size, 0); assert.equal(result.receipt.archiveAccountingComplete, false);
  assert.match(result.receipt.archiveCountersScope, /failed-pass bytes remain unaccounted, not zero/);
  assert.equal(result.h.events.filter(([name]) => name === 'abortWriter').length, 1);
  assert.equal(result.h.events.filter(([name]) => name === 'abortCollector').length, 1);
});
for (const [name, mutate] of [
  ['compressed SHA', value => { value.archiveSha256 = '0'.repeat(64); }], ['EOF passes', value => { value.archivePasses--; }],
  ['requested EOF', value => { value.archiveRequestedBytes--; }], ['positive archive close', value => { value.closeAttempts--; }],
  ['stdout completion', value => { value.stdoutEnded = false; }], ['decoder exit', value => { value.exitCode = 1; }],
  ['stream cap', value => { value.streamEvents = 262145; }], ['qualification', value => { value.nativeQualified = true; }],
]) test(`core rejects ${name} before full DATA`, async () => {
  const result = await run('cargo', { core(value) { mutate(value); return value; } }); stop(result, 'E_RECEIPT');
  assert.equal(result.h.memories.get('cargo').file().data.length, 0);
});
for (const [name, mutate] of [
  ['partial namespace', value => { value.roles[0].members.pop(); }], ['partial artifact', value => { value.roles.pop(); }],
  ['wrong partition', value => { value.part = 'gnu'; }], ['missing selected', value => { value.roles[0].selected.pop(); }],
  ['known body SHA', value => { value.roles[0].selected[0].bodySha256 = '0'.repeat(64); }],
  ['nonregular null SHA', value => { value.roles[0].members.at(-1).bodySha256 = sha(''); }],
  ['nonregular missing SHA', value => { delete value.roles[0].members.at(-1).bodySha256; }],
  ['followed nonregular', value => { value.roles[0].members.at(-1).linkFollowed = true; }],
  ['decoded hash', value => { value.roles[0].decodedSha256 = '0'.repeat(64); }],
  ['offset metadata hash', value => { value.roles[0].offsetMetadataSha256 = '0'.repeat(64); }],
  ['manifest bytes', value => { value.roles[0].manifests[0].text += 'drift'; }],
  ['path escape', value => { value.roles[0].members[0].path += '/../escape'; }],
]) test(`collection rejects ${name} without publishing DATA`, async () => {
  const result = await run('cargo', { collection(value) { mutate(value); return value; } }); stop(result, 'E_COLLECTION');
  assert.equal(result.h.memories.get('cargo').file().data.length, 0);
});
for (const flag of ['nativeQualified', 'rustReady', 'noPythonRuntimeVerified', 'pythonFreeSubsetVerified', 'compilerExecuted', 'jointEvidenceSetComplete']) {
  test(`nested ${flag} remains explicitly inert`, async () => {
    stop(await run('cargo', { collection(value) { value.roles[0][flag] = true; return value; } }), 'E_RECEIPT');
  });
}
for (const [name, options, code] of [
  ['source short read', { shortRead: true }, 'E_LENGTH'], ['source EOF', { extraEof: true }, 'E_LENGTH'],
  ['source digest', { corrupt: true }, 'E_SOURCE_PIN'], ['source read', { readError: true }, 'E_IO'],
  ['source close', { closeError: true }, 'E_CLOSE'], ['missing source', { openError: true }, 'E_IO'],
  ['source nonregular', { stat: value => ({ ...value, mode: 0o120600n }) }, 'E_SOURCE_PIN'],
  ['source FD binding', { fdStat: value => ({ ...value, ino: value.ino + 1n }) }, 'E_BINDING'],
]) test(`${name} stops before any import or reservation and closes once`, async () => {
  const result = await run('cargo', { source: options }); stop(result, code);
  assert.equal(result.h.io.fds.size, 0); assert.equal(result.h.imports.length, 0); assert.equal(result.h.memories.size, 0);
});
test('source rejects wrong exact size before allocation and opening', () => {
  const io = sourceFs({ stat: (value, path) => path === REPO ? value : { ...value, size: value.size + 1n } });
  const counts = source.captureCounts(); throws(() => source.captureSource('rawCore', io.backend, counts, () => {}), 'E_SOURCE_PIN');
  assert.equal(counts.allocations, 0); assert.equal(counts.openAttempts, 0);
});
test('source cumulative1MiB and8192 FS budgets reserve cleanup close', () => {
  for (const dimension of ['allocatedBytes', 'fsCalls']) {
    const io = sourceFs(), counts = source.captureCounts(); counts[dimension] = dimension === 'fsCalls' ? 8188 : 1048576 - PINS.rawCore.bytes;
    throws(() => source.captureSource('rawCore', io.backend, counts, () => {}), 'E_LIMIT');
    assert.equal(io.fds.size, 0); assert.equal(counts.allocations, 0); assert.ok(counts.fsCalls <= 8192);
  }
});
test('source expiry still closes acquired descriptor once before any hash/import', () => {
  const io = sourceFs(), counts = source.captureCounts(); let checks = 0;
  throws(() => source.captureSource('rawCore', io.backend, counts, () => { if (++checks === 7) throw error('E_DEADLINE'); }), 'E_DEADLINE');
  assert.equal(counts.closeAttempts, 1); assert.equal(counts.closes, 1); assert.equal(counts.completedCaptures, 0);
});
test('all raw pins reject drift before transforming graph or URI import', () => {
  for (const [key] of source.rows) {
    const values = new Map(retained), bytes = Buffer.from(values.get(key)); bytes[0] ^= 1; values.set(key, bytes);
    throws(() => source.prepareSourceGraph(values, GRAPH, false, 'cargo'), 'E_SOURCE_PIN');
  }
});
test('missing and duplicated transformations reject exactly once; role/path literals stay closed', () => {
  throws(() => source.replaceOnce('xx', 'x', 'y'), 'E_SOURCE_PIN'); throws(() => source.replaceOnce('', 'x', 'y'), 'E_SOURCE_PIN');
  throws(() => source.link(Buffer.from("from './x.mjs';from './x.mjs'"), 'x', uri('')), 'E_SOURCE_PIN');
  for (const role of ['gnu', '../cargo', PATHS.cargo, '__proto__', {}, null]) {
    throws(() => source.transformCore(retained.get('rawCore'), role), 'E_INPUT');
    throws(() => source.prepareSourceGraph(retained, GRAPH, false, role), 'E_INPUT');
    throws(() => helper.SOURCE_CREATE_ARCHIVE(role), 'E_EVIDENCE_INPUT');
  }
});
test('every graph output requires immutable pin even for nonselected roles before imports', () => {
  const pins = clone(GRAPH); pins['clippy-preview:linkedCore'].sha256 = '0'.repeat(64);
  throws(() => source.prepareSourceGraph(retained, pins, false, 'cargo'), 'E_SOURCE_PIN');
  delete pins['clippy-preview:linkedCore']; throws(() => source.prepareSourceGraph(retained, pins, false, 'cargo'), 'E_HELPER_PENDING');
});
for (const [name, mutate] of [
  ['input isolation', value => { value.SPLIT_TOOLCHAIN_EVIDENCE_INPUTS = clone(value.SPLIT_TOOLCHAIN_EVIDENCE_INPUTS); value.SPLIT_TOOLCHAIN_EVIDENCE_INPUTS.rust.pop(); }],
  ['cargo legacy metadata', value => { value.SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS = clone(value.SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS); value.SPLIT_TOOLCHAIN_EVIDENCE_EXPECTATIONS.rust[0].metadataHashKind = 'LEGACY_WITHOUT_BODY_OFFSET'; }],
  ['known body digest', value => { value.SPLIT_TOOLCHAIN_EVIDENCE_TARGETS = clone(value.SPLIT_TOOLCHAIN_EVIDENCE_TARGETS); value.SPLIT_TOOLCHAIN_EVIDENCE_TARGETS.rust[0].expectedSha256 = null; }],
  ['singleton wrong input', value => { value.SOURCE_ARCHIVE_PROFILES = clone(value.SOURCE_ARCHIVE_PROFILES); value.SOURCE_ARCHIVE_PROFILES.cargo.inputs.push(INPUTS.rustc); }],
]) test(`constant gate rejects ${name} before reservation`, async () => {
  const result = await run('cargo', { constants: mutate }); stop(result, 'E_COMPONENT'); assert.equal(result.h.memories.size, 0);
});
test('cargo singleton at index zero uses offset rather than legacy metadata hash', async () => {
  const result = await run('cargo', { collection(value) { value.roles[0].legacyMetadataSha256 = '0'.repeat(64); return value; } });
  assert.equal(result.output.exitCode, 0, result.output.text);
});
test('source10s includes first read and final private core import', async () => {
  for (const at of ['sourceRead', 'import']) {
    const result = await run('cargo', { event(name, value, set) { if (name === at && (at !== 'import' || value === 4)) set(10000); } });
    stop(result, 'E_DEADLINE'); assert.equal(result.h.memories.size, 0); assert.equal(result.h.io.fds.size, 0);
  }
});
test('publication30s covers final collection and valid-looking sealed final file', async () => {
  for (const at of ['finish', 'published']) {
    const result = await run('cargo', { event(name, _, set) { if (name === at) set(30000); } }); stop(result, 'E_DEADLINE');
    if (at === 'published') assert.equal(result.h.memories.get('cargo').file().mode, 0o100444n);
  }
});
test('original300s outer clock never resets during publication', async () => {
  const result = await run('cargo', { event(name, _, set) {
    if (name === 'begin') set(150000); if (name === 'afterCore') set(269999); if (name === 'published') set(300000);
  } }); stop(result, 'E_DEADLINE'); assert.equal(result.h.memories.get('cargo').file().mode, 0o100444n);
});
for (const [name, now] of [['NaN', () => NaN], ['Infinity', () => Infinity], ['overflow', () => Number.MAX_VALUE]]) {
  test(`${name} clock stops before I/O`, async () => { const result = await run('cargo', { now }); stop(result, 'E_CLOCK'); assert.equal(result.h.io.calls.length, 0); });
}
test('backwards clock cannot establish acceptance', async () => {
  stop(await run('cargo', { event(name, value, set) { if (name === 'import') set(value === 2 ? -1 : 1); } }), 'E_CLOCK');
});
test('busy second role rejects before capture/reservation without consuming latch, then independently admits', async () => {
  let release, entered; const gate = new Promise(resolve => { release = resolve; }); const waiting = new Promise(resolve => { entered = resolve; });
  let first = true;
  const h = harness({ async importWait() { if (first) { first = false; entered(); await gate; } } });
  const cargo = h.fixture[entry('cargo')](); await waiting;
  const before = h.io.calls.length, busy = JSON.parse((await h.fixture[entry('rustc')]()).text);
  assert.equal(busy.error, 'E_IN_FLIGHT'); assert.equal(h.io.calls.length, before); assert.equal(h.memories.size, 0);
  release(); assert.equal((await cargo).exitCode, 0); assert.equal((await h.fixture[entry('rustc')]()).exitCode, 0);
  assert.equal(JSON.parse((await h.fixture[entry('rustc')]()).text).error, 'E_INPUT');
});
test('invalid arguments do not consume latches; physical failure consumes only selected role', async () => {
  const h = harness({ coreFailure: 'E_HASH', failRole: 'cargo' });
  assert.equal(JSON.parse((await h.fixture[entry('cargo')]('no')).text).error, 'E_INPUT');
  assert.equal(JSON.parse((await h.fixture[entry('cargo')]()).text).error, 'E_HASH');
  assert.equal(JSON.parse((await h.fixture[entry('cargo')]()).text).error, 'E_INPUT');
  assert.equal((await h.fixture[entry('rustc')]()).exitCode, 0);
});
test('fifth-role failure cannot invalidate four separately accepted role files or read old GNU/host/V1 reservations', async () => {
  const h = harness({ coreFailure: 'E_HASH', failRole: 'clippy-preview' }), accepted = new Map();
  for (const role of ROLES.slice(0, 4)) {
    const output = await h.fixture[entry(role)](); assert.equal(output.exitCode, 0, output.text);
    assert.equal(JSON.parse(output.text).jointEvidenceSetComplete, false); accepted.set(role, Buffer.from(h.memories.get(role).file().data));
  }
  const output = await h.fixture[entry('clippy-preview')](); assert.equal(JSON.parse(output.text).error, 'E_HASH');
  for (const [role, bytes] of accepted) assert.deepEqual(h.memories.get(role).file().data, bytes);
  assert.ok(h.io.calls.filter(([name]) => name === 'open').every(([, path]) => !path.endsWith('.result.json')));
});
test('fixture requires complete explicit fake capabilities and cannot override production pins/profiles/paths', () => {
  const h = harness();
  for (const key of ['fs', 'spawn', 'now', 'moduleImporter', 'setTimeout', 'clearTimeout']) {
    const config = { ...h.config }; delete config[key]; assert.throws(() => fixture(config));
  }
  for (const extra of ['path', 'profiles', 'sourcePins', 'helperPins', 'role']) throws(() => fixture({ ...h.config, [extra]: {} }), 'E_INPUT');
  throws(() => fixture({ ...h.config, mockOnly: false }), 'E_INPUT');
  throws(() => fixture({ ...h.config, setTimeout: globalThis.setTimeout }), 'E_INPUT');
});
for (const [name, options, code] of [
  ['positive-close failure', { closeError: true }, 'E_PUBLICATION_CLOSE'],
  ['readback corruption', { corrupt: true }, 'E_PUBLICATION_HASH'], ['nonzero EOF', { extraEof: true }, 'E_PUBLICATION_EOF'],
]) test(`delivered writer ${name} never accepts valid-looking file`, async () => {
  const result = await run('cargo', { publication: options }); stop(result, code); assert.equal(result.h.memories.get('cargo').fds.size, 0);
});
for (const [name, mutate] of [
  ['hash', value => { value.sha256 = '0'.repeat(64); }], ['fixed path', value => { value.path = PATHS.rustc; }],
  ['length', value => { value.byteLength++; }], ['mode', value => { value.mode = '0600'; }],
  ['read request lower range', value => { value.counts.requestedReadBytes = value.byteLength; }],
  ['read request upper range', value => { value.counts.requestedReadBytes = 16777218; }],
  ['readback hash bytes', value => { value.counts.readbackHashBytes--; }],
]) test(`publication record rejects ${name} after file sealing`, async () => {
  const result = await run('cargo', { record(value) { mutate(value); return value; } }); stop(result, 'E_PUBLICATION_RECORD');
  assert.equal(result.h.memories.get('cargo').file().mode, 0o100444n);
});
test('stage pre/post and preload gates fail before any full DATA', async () => {
  stop(await run('cargo', { stageFailure: true }), 'E_METADATA'); stop(await run('cargo', { preload: true }), 'E_PRELOAD');
  stop(await run('cargo', { stageCloses: 4 }), 'E_RECEIPT');
});
test('both abort owners run once and release admission even on cleanup uncertainty', async () => {
  for (const [option, code] of [['writerAbortError', 'E_PUBLICATION_ABORT'], ['collectorAbortError', 'E_COLLECTION_ABORT']]) {
    const h = harness({ coreFailure: 'E_HASH', [option]: true }), output = await h.fixture[entry('cargo')]();
    assert.equal(JSON.parse(output.text).error, code); assert.equal(JSON.parse(output.text).abortUncertain, true);
    assert.equal(h.events.filter(([name]) => name === 'abortWriter').length, 1); assert.equal(h.events.filter(([name]) => name === 'abortCollector').length, 1);
    assert.notEqual(JSON.parse((await h.fixture[entry('rustc')]()).text).error, 'E_IN_FLIGHT');
  }
});
test('own-DATA rejects getters/proxies/toJSON without invoking them', () => {
  let invoked = false;
  for (const value of [Object.defineProperty({}, 'x', { enumerable: true, get() { invoked = true; } }),
    new Proxy({}, { ownKeys() { invoked = true; } }), { toJSON() { invoked = true; } }]) {
    throws(() => source.preflight(value, 16777216), 'E_OUTPUT'); assert.equal(invoked, false);
  }
});
test('ASCII encoding handles Unicode and lone UTF16 surrogates without undercounting', () => {
  assert.equal(source.asciiJson({ x: 'é😀\ud800\n' }, 1024), '{"x":"\\u00e9\\ud83d\\ude00\\ud800\\n"}\n');
});
for (const maximum of [65536, 16777216]) test(`ASCII JSON including LF accepts exact${maximum} and rejects+1`, () => {
  const value = { x: 'x'.repeat(maximum - 9) };
  assert.equal(source.preflight(value, maximum), maximum); assert.equal(source.asciiJson(value, maximum).length, maximum);
  value.x += 'x'; throws(() => source.preflight(value, maximum), 'E_OUTPUT');
});
for (const [name, make] of [
  ['cycle', () => { const v = {}; v.x = v; return v; }], ['sparse', () => new Array(2)],
  ['symbol', () => ({ [Symbol('x')]: 1 })], ['typed array', () => Buffer.from('x')],
  ['undefined', () => ({ x: undefined })], ['NaN', () => ({ x: NaN })],
]) test(`own-DATA rejects ${name}`, () => { throws(() => source.preflight(make(), 16777216), 'E_OUTPUT'); });
test('own-DATA enforces depth64 and1M nodes', () => {
  let value = null; for (let i = 0; i < 64; i++) value = { x: value }; source.preflight(value, 16777216);
  value = { x: value }; throws(() => source.preflight(value, 16777216), 'E_OUTPUT');
  throws(() => source.preflight(new Array(1048576).fill(null), 16777216), 'E_OUTPUT');
});
test('recursive collection freeze cannot accept merely shallow-frozen descendants', async () => {
  stop(await run('cargo', { shallowFrozen: true }), 'E_COLLECTION');
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
function elfBody() {
  const bytes = Buffer.alloc(512); bytes.set([127, 69, 76, 70, 2, 1, 1]);
  bytes.writeUInt16LE(3, 16); bytes.writeUInt16LE(62, 18); bytes.writeUInt32LE(1, 20); bytes.writeUInt16LE(64, 52);
  bytes.writeUInt16LE(56, 54); return bytes;
}
const fixtureHelper = await import(uri(Buffer.concat([graph.outputs.linkedCollector, Buffer.from(`
export function MOCK_ONLY_ARCHIVE(profile, trusted) {
  if (profile.mockOnly !== true) fail('E_EVIDENCE_INPUT');
  return collector(profile, trusted);
}
`)])));
function synthetic(role) {
  const original = INPUTS[role], root = original.expectedRoot, chunks = [], loweredTargets = [];
  const add = (path, body = Buffer.alloc(0), type = '0') => chunks.push(Buffer.concat([
    tarHeader(path, body.length, type), body, Buffer.alloc((512 - body.length % 512) % 512)]));
  add(root, Buffer.alloc(0), '5');
  const component = role === 'rust-std' ? 'rust-std-x86_64-unknown-linux-gnu' : role;
  add(root + '/components', Buffer.from(component + '\n')); add(root + '/rust-installer-version', Buffer.from('3\n'));
  add(root + '/' + component + '/manifest.in', Buffer.from('file:bin/mock\ndir:lib\nunknown:DATA\n'));
  add(root + '/unselected', Buffer.from('MOCK_ONLY_UNSELECTED\n'));
  for (const target of targets.filter(row => row.artifactRole === role)) {
    const body = target.kind === 'ELF_EXEC_DSO' ? elfBody() : Buffer.from('INPUT ( libmock.so )\n');
    loweredTargets.push({ ...target, index: chunks.length + 1, bodyOffset: chunks.reduce((n, bytes) => n + bytes.length, 0) + 512,
      size: body.length, expectedSha256: sha(body) }); add(target.path, body);
  }
  const bytes = Buffer.concat([...chunks, Buffer.alloc(1024)]), reference = tar.createTarInventory(), events = reference.feed(bytes), inventory = reference.finish();
  const compressed = Buffer.from('MCK');
  const input = { ...original, root: '/fixture/' + role, file: '/fixture/' + role + '/' + root + '.tar.xz', archiveBytes: compressed.length,
    archiveSha256: sha(compressed), identity: { root: original.identity.root, file: { ...original.identity.file, size: String(compressed.length) } } };
  const expected = { role, expandedBytes: bytes.length, entries: inventory.entries, headers: inventory.headers,
    regularFiles: events.filter(event => event.type === 'file').length, decodedSha256: sha(bytes),
    metadataSha256: inventory.metadataSha256, metadataHashKind: 'OFFSET_EVENT_METADATA' };
  return { bytes, compressed, input, expected, loweredTargets };
}
for (const role of ROLES) test(`${role}: delivered internal collector+TAR+ELF5+formats+writer process lowered synthetic singleton only as mockOnly`, () => {
  const { bytes, input, expected, loweredTargets } = synthetic(role);
  const batch = fixtureHelper.MOCK_ONLY_ARCHIVE({ part: 'rust', mockOnly: true, inputs: [input], targets: loweredTargets,
    expectations: [expected], limits: source.collectorLimits }, { parserFactory: tar.createTarInventory,
    elfInspector: elf.inspectElf64RequirementsV5, formatInspectors: sdk.SOURCE_FORMAT_INSPECTORS });
  batch.beginToolchainEvidenceBatch(); batch.beginToolchainEvidenceRole(role);
  const parser = batch.createTarInventory(); parser.feed(bytes); const observed = parser.finish();
  batch.acceptToolchainEvidenceRole({ ...coreValue(role), mockOnly: true, inventory: observed, archiveBytes: 3,
    archiveSha256: input.archiveSha256, archiveDataBytes: 6, archiveRequestedBytes: 8 });
  const collection = batch.finishToolchainEvidenceBatch(); assert.equal(collection.mockOnly, true); assert.equal(collection.artifactCount, 1);
  assert.equal(collection.roles[0].role, role); assert.equal(collection.selectedPayloads, PROFILES[role].targetCount);
  assert.equal(collection.nativeQualified, false); assert.equal(collection.noPythonRuntimeVerified, false);
  for (const member of collection.roles[0].members.filter(row => row.type !== 'file')) {
    assert.equal(member.bodySha256, null); assert.equal(member.linkFollowed, false);
  }
  const memory = publicationMemory(role), publisher = writer.createSplitEvidencePublicationFixture({ mockOnly: true }, { fs: memory.fs, guard() {} })
    .reserveSplitEvidencePublication(role);
  const data = Buffer.from(source.asciiJson({ profile: 'RUST_ARCHIVE_EVIDENCE_DATA', part: 'rust', artifactRole: role, mockOnly: true, collection }, 16777216));
  const record = publisher.publish(data); source.validatePublication(record, publisher.snapshot(), data.length, sha(data), role);
  assert.equal(memory.fds.size, 0); assert.equal(memory.file().mode, 0o100444n);
});
for (const role of ROLES) test(`${role}: actual private factory/static core bridge share one URI through fake FS+spawn into pinned ELF5/formats and writer`, async () => {
  const fixtures = Object.fromEntries(ROLES.map(key => [key, synthetic(key)]));
  const profiles = Object.fromEntries(ROLES.map(key => {
    const value = fixtures[key];
    return [key, { part: 'rust', mockOnly: true, inputs: [value.input], expectations: [value.expected],
      targets: value.loweredTargets, limits: source.collectorLimits }];
  }));
  const text = graph.outputs.linkedCollector.toString();
  const declaration = text.slice(text.indexOf('export const SOURCE_ARCHIVE_PROFILES'), text.indexOf('export function SOURCE_CREATE_ARCHIVE'));
  const transformed = source.replaceOnce(text, declaration, 'export const SOURCE_ARCHIVE_PROFILES = freeze(' + JSON.stringify(profiles) + ');\n');
  const factoryBody = text.slice(text.indexOf('export function SOURCE_CREATE_ARCHIVE'));
  assert.equal(transformed.slice(transformed.indexOf('export function SOURCE_CREATE_ARCHIVE')), factoryBody);
  const mockUri = uri(transformed), actual = await import(mockUri);
  const linkedCore = source.replaceOnce(decode(graph.coreUris[role]), "from '" + graph.collectorUri + "'", "from '" + mockUri + "'");
  const core = await import(uri(linkedCore)), { input, bytes, compressed } = fixtures[role], owned = new Map();
  const descriptor = core.GNU_SDK_DESCRIPTOR, closes = [], reads = [], hooks = [], schedules = [];
  const metadata = Object.fromEntries(Object.entries(input.identity).map(([key, value]) => [key,
    Object.fromEntries(Object.entries(value).map(([field, amount]) => [field, BigInt(amount)]))]));
  const kind = path => path === descriptor.root ? 'root' : path === descriptor.file ? 'file' : assert.fail('unregistered fake archive path');
  const backend = {
    lstatSync(path) { return { ...metadata[kind(path)] }; },
    fstatSync(fd) { assert.ok(owned.has(fd)); return { ...metadata[owned.get(fd)] }; },
    openSync(path, flags) {
      assert.ok(flags & constants.O_NOFOLLOW); assert.ok(flags & constants.O_NONBLOCK);
      const key = kind(path), fd = key === 'root' ? 501 : 502; assert.equal(owned.has(fd), false); owned.set(fd, key); return fd;
    },
    readSync(fd, buffer, offset, length, position) {
      assert.equal(owned.get(fd), 'file'); reads.push([position, length]); return compressed.copy(buffer, offset, position, position + length);
    },
    closeSync(fd) { assert.ok(owned.delete(fd)); closes.push(fd); },
  };
  let spawnCount = 0, childCloses = 0;
  const batch = actual.SOURCE_CREATE_ARCHIVE(role); batch.beginToolchainEvidenceBatch(); batch.beginToolchainEvidenceRole(role);
  const runner = core.createSdkInventoryFixtureRunner({ archiveBytes: compressed.length, archiveSha256: sha(compressed) }, {
    fs: backend, now: () => 0, setTimeout(_, delay) { schedules.push(delay); return 1; }, clearTimeout() {},
    beforeDecode() { hooks.push('before'); return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true }; },
    afterDecode() { hooks.push('after'); return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true }; },
    spawn(command, args, options) {
      spawnCount++; assert.equal(command, descriptor.decoderRoot + '/ld-linux-x86-64.so.2');
      assert.ok(args.includes('--memlimit-decompress=268435456')); assert.equal(options.shell, false);
      const child = new EventEmitter(); child.stdin = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
      child.kill = () => assert.fail('successful fake decoder needs no cleanup kill');
      child.stdin.write = (chunk, callback) => { assert.deepEqual(chunk, compressed); queueMicrotask(callback); return true; };
      child.stdin.end = () => {
        child.stdin.emit('finish'); child.stdout.emit('data', bytes); child.stdout.emit('end'); child.stderr.emit('end');
        child.emit('exit', 0, null); child.emit('close', 0, null); childCloses++;
        for (const stream of [child.stdin, child.stdout, child.stderr]) stream.emit('close');
      };
      queueMicrotask(() => child.emit('spawn')); return child;
    },
  });
  const result = await runner(input.identity); assert.equal(result.mockOnly, true); assert.equal(result.realArchiveInspected, false);
  batch.acceptToolchainEvidenceRole(result); const collection = batch.finishToolchainEvidenceBatch();
  assert.equal(collection.mockOnly, true); assert.equal(collection.artifactCount, 1); assert.equal(collection.roles[0].role, role);
  assert.equal(collection.selectedPayloads, PROFILES[role].targetCount); assert.equal(collection.nativeQualified, false);
  assert.equal(collection.noPythonRuntimeVerified, false); assert.equal(collection.rustReady, false);
  assert.deepEqual(closes, [502, 501]); assert.equal(owned.size, 0); assert.deepEqual(hooks, ['before', 'after']);
  assert.equal(spawnCount, 1); assert.equal(childCloses, 1); assert.deepEqual(schedules, [117000]);
  assert.equal(reads.length, 4); assert.equal(reads.reduce((n, [, length]) => n + length, 0), compressed.length * 2 + 2);
  const memory = publicationMemory(role), publisher = writer.createSplitEvidencePublicationFixture({ mockOnly: true }, { fs: memory.fs, guard() {} })
    .reserveSplitEvidencePublication(role);
  const full = Buffer.from(source.asciiJson({ profile: 'RUST_ARCHIVE_EVIDENCE_DATA', part: 'rust', artifactRole: role, mockOnly: true, collection }, 16777216));
  const record = publisher.publish(full); source.validatePublication(record, publisher.snapshot(), full.length, sha(full), role);
  assert.equal(memory.fds.size, 0);
});
test('static bridges never route a concurrently active cargo parser into the last-created rustc collector', async () => {
  const isolated = await import(uri(Buffer.concat([graph.outputs.linkedCollector, Buffer.from('\n\n')])));
  const cargo = isolated.SOURCE_CREATE_ARCHIVE('cargo'), rustc = isolated.SOURCE_CREATE_ARCHIVE('rustc');
  for (const [batch, role] of [[cargo, 'cargo'], [rustc, 'rustc']]) { batch.beginToolchainEvidenceBatch(); batch.beginToolchainEvidenceRole(role); }
  const cargoParser = isolated.SOURCE_CARGO_TAR({}), rustcParser = isolated.SOURCE_RUSTC_TAR({});
  cargoParser.feed(tarHeader(INPUTS.cargo.expectedRoot, 0, '5'));
  assert.equal(cargo.snapshotToolchainEvidenceBatch().entries, 1); assert.equal(rustc.snapshotToolchainEvidenceBatch().entries, 0);
  rustcParser.feed(tarHeader(INPUTS.rustc.expectedRoot, 0, '5'));
  assert.equal(rustc.snapshotToolchainEvidenceBatch().entries, 1);
  cargo.abortToolchainEvidenceBatch(); rustc.abortToolchainEvidenceBatch();
});
test('private writer preserves defensive snapshot and full JSON parser gates', () => {
  for (const bytes of [Buffer.from('{"publicationAccepted":true}\n'), Buffer.from('{"x":"é"}\n'), Buffer.from('{"x":}\n'), Buffer.from('{}')]) {
    const memory = publicationMemory('cargo'), publisher = writer.createSplitEvidencePublicationFixture({ mockOnly: true }, { fs: memory.fs, guard() {} })
      .reserveSplitEvidencePublication('cargo');
    assert.throws(() => publisher.publish(bytes)); assert.equal(memory.fds.size, 0); assert.equal(memory.file().data.length, 0);
  }
  const memory = publicationMemory('cargo'), bytes = Buffer.from('{"mockOnly":true}\n'); let touched = false;
  let publisher = null;
  publisher = writer.createSplitEvidencePublicationFixture({ mockOnly: true }, { fs: memory.fs, guard() {
    if (!touched && publisher?.snapshot().phase === 'PUBLISHING' && publisher.snapshot().counts.copiedBytes) { bytes.fill(120); touched = true; }
  } }).reserveSplitEvidencePublication('cargo');
  const record = publisher.publish(bytes); assert.equal(touched, true); assert.equal(record.sha256, sha('{"mockOnly":true}\n'));
});
