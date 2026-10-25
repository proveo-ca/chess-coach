// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import * as operation from './rust-payload-inspection-operation.mjs';

const { rustPayloadSource: source, RUST_PAYLOAD_INPUTS: inputs, RUST_PAYLOAD_ROLES: roles,
  RUST_PAYLOAD_TARGETS: targets, RUST_PAYLOAD_EXPECTATIONS: expectations } = operation;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = bytes => ({ bytes: bytes.length, sha256: hash(bytes) });
const uri = source.uri;
const fromUri = value => Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
const copy = value => JSON.parse(JSON.stringify(value));
const repo = '/tmp/opencode/f9-bootstrap-correspondence';
const decoder = '/tmp/opencode/f9-xz-qualification-01';
const helperBytes = Buffer.from("import { createTarInventory } from './tar-inventory.mjs';\nimport { inspectElf64RequirementsV5 } from './elf-requirements-v5.mjs';\nexport { createTarInventory };\n");
const elfBytes = Buffer.from('export const mockOnly = true;\n');
const mockPins = Object.freeze({
  helper: { bytes: 161, sha256: 'ac5ede80c130969f5b14ed180dedee592bc93acc2a24b879c2dba1297713187a' },
  elfV5: { bytes: 30, sha256: '03579bc6d316421fec75067e164dd76396bab3e4ceb879b9e09f30ed13957c35' },
  tarLinkedHelper: { bytes: 20966, sha256: 'ac7cba2738acbe47d5611bcbd6318129a1e3dc8e0670998d71a9aea2feaed62a' },
  linkedHelper: { bytes: 21009, sha256: '813e9decf00ba2d17c47f9d33bf6534592772ac5ae723e53aa9b7994272fece5' },
  linkedCores: {
    cargo: { bytes: 50542, sha256: '260cc473a78a3b18931f6ee2c5738e1c44cff139fd8fb76724e2d4942c0f2032' },
    rustc: { bytes: 50542, sha256: '39068ea38a8314b60c75ac1932fc1fb1cc7f63a1a1ea93c2d2d46c9cec900705' },
    'rust-std': { bytes: 50545, sha256: 'a1397ac3b94dcaab29f8c10f75555a65b5fdabda53e4fb9c0599f71e50350066' },
    'rustfmt-preview': { bytes: 50543, sha256: 'd5018c97f732b9090f223a90e424662273a238ff293f8cb9da9e30e580a5f59f' },
    'clippy-preview': { bytes: 50542, sha256: 'aa7ee7da4fb181020042f5843701cf07102c896f28e40456bf1b0c3adfb1ec17' },
  },
});
const stored = new Map(source.rows.map(([key, path]) => [key, key === 'helper' ? helperBytes : key === 'elfV5' ? elfBytes :
  readFileSync(new URL('../../' + path, import.meta.url))]));
const originalOperation = readFileSync(new URL('./rust-payload-inspection-operation.mjs', import.meta.url), 'utf8');
const manifestPattern = /^const DELIVERED_PINS = freeze\([^\n]*\);$/gm;
assert.equal([...originalOperation.matchAll(manifestPattern)].length, 1);
const mocked = await import(uri(Buffer.from(originalOperation.replace(manifestPattern,
  'const DELIVERED_PINS = freeze(' + JSON.stringify(mockPins) + ');'))));
const old = await import(uri(source.pinned(stored.get('layoutOperation'), operation.RUST_PAYLOAD_SOURCE_PINS.layoutOperation)));
const oldSource = old.rustLayoutSource;
const deliveredHelper = source.pinned(readFileSync(new URL('./rust-payload-inspection.mjs', import.meta.url)), operation.RUST_PAYLOAD_SOURCE_PINS.helper);
const deliveredElf = source.pinned(readFileSync(new URL('./elf-requirements-v5.mjs', import.meta.url)), operation.RUST_PAYLOAD_SOURCE_PINS.elfV5);
const deliveredTar = source.pinned(oldSource.transformTar(stored.get('rawTar')), operation.RUST_PAYLOAD_SOURCE_PINS.eventTar);
const deliveredTarLinked = source.pinned(source.link(deliveredHelper, 'tar-inventory', uri(deliveredTar)), operation.RUST_PAYLOAD_SOURCE_PINS.tarLinkedHelper);
const deliveredLinked = source.pinned(source.link(deliveredTarLinked, 'elf-requirements-v5', uri(deliveredElf)), operation.RUST_PAYLOAD_SOURCE_PINS.linkedHelper);
const deliveredUri = uri(deliveredLinked);
const deliveredModule = await import(deliveredUri);
const deliveredTarModule = await import(uri(deliveredTar));
const metadata = (size, directory = false) => ({ dev: 28n, ino: directory ? 2n : 3n,
  mode: directory ? 0o40755n : 0o100644n, uid: 1000n, gid: 1000n, nlink: directory ? 2n : 1n,
  size: BigInt(size), mtimeNs: 10n, ctimeNs: 20n });
const args = ['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', decoder, decoder + '/xz',
  '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=268435456', '--', '-'];
const options = () => ({ cwd: decoder, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false,
  stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
const descriptor = input => ({ root: input.root, file: input.file, archiveBytes: input.archiveBytes,
  archiveSha256: input.archiveSha256, decoderRoot: decoder });
const expectCode = (fn, code) => assert.throws(fn, error => error.code === code);

function memoryFs(hooks = {}) {
  const paths = new Map(source.rows.map(([key, path]) => [repo + '/' + path, Buffer.from(stored.get(key))]));
  const opened = new Map(), calls = [];
  let nextFd = 50;
  const api = {
    lstatSync(path) {
      calls.push(['lstat', path]);
      if (path === repo) return hooks.rootStat ? hooks.rootStat(calls) : metadata(4096, true);
      assert.ok(paths.has(path), 'fixed repository whitelist');
      const stat = metadata(paths.get(path).length);
      return hooks.namedStat ? hooks.namedStat(path, stat, calls) : stat;
    },
    openSync(path, flags) {
      calls.push(['open', path, flags]); assert.equal(opened.size, 0); assert.ok(paths.has(path));
      const fd = nextFd++; opened.set(fd, path); return fd;
    },
    fstatSync(fd) {
      calls.push(['fstat', fd]); assert.ok(opened.has(fd));
      const stat = metadata(paths.get(opened.get(fd)).length);
      return hooks.fdStat ? hooks.fdStat(fd, stat, calls) : stat;
    },
    readSync(fd, bytes, offset, length, position) {
      calls.push(['read', fd, length, position]); assert.ok(opened.has(fd)); assert.ok(length <= 65536);
      if (hooks.read) return hooks.read({ fd, bytes, offset, length, position, path: opened.get(fd), paths });
      return paths.get(opened.get(fd)).copy(bytes, offset, position, position + length);
    },
    closeSync(fd) {
      calls.push(['close', fd]); assert.ok(opened.has(fd)); opened.delete(fd);
      if (hooks.close) hooks.close(fd);
    },
  };
  return { api, paths, opened, calls };
}
function fixture(settings = {}) {
  const io = memoryFs(settings.fsHooks), accepted = [], calledRoles = [], imports = [], spawnCalls = [];
  const state = { time: 0, aborted: 0, finished: 0, pending: null, stage: 0, preload: 0, begun: 0,
    live: 0, peak: 0, publicationReads: 0, entries: 0, expandedBytes: 0, capturedBytes: 0 };
  const helper = {
    RUST_PAYLOAD_ROLES: roles, RUST_PAYLOAD_INPUTS: inputs, RUST_PAYLOAD_TARGETS: targets,
    RUST_PAYLOAD_EXPECTATIONS: expectations, RUST_PAYLOAD_LIMITS: operation.RUST_PAYLOAD_LIMITS,
    beginRustPayloadBatch() { state.begun++; },
    beginRustPayloadRole(role) { assert.equal(state.pending, null); state.pending = role; calledRoles.push(role); },
    createTarInventory() { assert.fail('fake core owns pure in-memory inventory'); },
    acceptRustPayloadRole(value) {
      assert.equal(state.pending, roles[accepted.length]); accepted.push(state.pending); state.pending = null;
      state.entries += value.inventory.entries; state.expandedBytes += value.expandedBytes;
      state.capturedBytes += targets.filter(target => target.role === roles[accepted.length - 1]).reduce((n, t) => n + t.size, 0);
      if (settings.afterAccept) settings.afterAccept(accepted.length, state);
      if (accepted.length === 4 && settings.beforeFifthTime !== undefined) { state.admissionJump = settings.beforeFifthTime; state.waitOneRead = true; }
    },
    snapshotRustPayloadBatch() {
      const result = { state: 'ACTIVE', mockOnly: false, acceptedRoles: accepted.length, currentRole: state.pending,
        entries: state.entries, expandedBytes: state.expandedBytes, capturedBytes: state.capturedBytes, observationBytes: 0 };
      return settings.snapshot ? settings.snapshot(result, state) : result;
    },
    finishRustPayloadBatch() {
      assert.deepEqual(accepted, roles); assert.equal(state.stage, 10); assert.equal(state.preload, 10);
      assert.equal(io.opened.size, 0); state.finished++;
      const result = { state: 'RUST_PAYLOAD_DATA_INSPECTED', mockOnly: false,
        members: targets.map(target => ({ ...target, roleSatisfied: false })), declaredNeededEdges: [],
        roles: expectations.map(row => ({ ...row, roleSatisfied: false })), targetCount: 13,
        capturedBytes: state.capturedBytes, expandedBytes: state.expandedBytes, entries: state.entries, candidateExecuted: false };
      return settings.finish ? settings.finish(result, state) : result;
    },
    getRustPayloadFailure() { return settings.failure ?? null; },
    abortRustPayloadBatch() {
      state.aborted++; accepted.length = 0; state.pending = null; state.entries = 0; state.expandedBytes = 0; state.capturedBytes = 0;
    },
  };
  if (settings.helper) settings.helper(helper);
  const stage = {
    verifyStagedXzImages(receipt) {
      state.stage++; assert.equal(receipt.profile, 'fixed-xz-ordinary-staging-v1');
      if (settings.stage) settings.stage(state);
      return { counters: { fsCalls: 80, readBytes: 2758216, closeAttempts: settings.stageCloses ?? 5 } };
    },
    assertNoSystemPreload() { state.preload++; return settings.preload ? settings.preload(state) : true; },
  };
  const config = {
    fs: io.api,
    spawn(...parameters) {
      spawnCalls.push(parameters); const child = new EventEmitter(); state.live++; state.peak = Math.max(state.peak, state.live);
      queueMicrotask(() => { child.emit('spawn'); if (!settings.noClose) { child.emit('close', 0, null); state.live--; } });
      return child;
    },
    now() {
      if (settings.now) return settings.now(state);
      if (state.admissionJump !== undefined) {
        if (state.waitOneRead) state.waitOneRead = false;
        else { state.time = state.admissionJump; delete state.admissionJump; }
      }
      if (state.finished && settings.serializationDeadline && ++state.publicationReads === 2) state.time += 30000;
      return state.time;
    },
    async moduleImporter(target) {
      assert.equal(io.opened.size, 0); imports.push(target);
      if (settings.importLatency) state.time += settings.importLatency;
      const actual = pin(fromUri(target));
      if (actual.sha256 === operation.RUST_PAYLOAD_SOURCE_PINS.layoutOperation.sha256) return old;
      if (actual.sha256 === mockPins.linkedHelper.sha256) return helper;
      if (actual.sha256 === operation.RUST_PAYLOAD_SOURCE_PINS.linkedStage.sha256) return stage;
      const index = roles.findIndex(role => actual.sha256 === mockPins.linkedCores[role].sha256);
      assert.notEqual(index, -1, 'only fully pinned fake graph modules');
      const input = inputs[index];
      return {
        GNU_SDK_DESCRIPTOR: settings.wrongModule === index ? descriptor(inputs[(index + 1) % 5]) : descriptor(input),
        GNU_SDK_LIMITS: operation.RUST_PAYLOAD_CORE_LIMITS,
        async runGnuSdkInventory(identity, deps) {
          assert.deepEqual(identity, input.identity); assert.equal(io.opened.size, 0);
          if (settings.failBefore === index) throw Object.assign(new Error('SECRET_PAYLOAD'), { code: settings.failureCode ?? 'E_HASH' });
          await deps.beforeDecode();
          deps.spawn(decoder + '/ld-linux-x86-64.so.2', settings.wrongArg ? [...args, '--threads=2'] : [...args], options());
          await Promise.resolve();
          if (settings.extraSpawn) deps.spawn(decoder + '/ld-linux-x86-64.so.2', [...args], options());
          if (settings.failAfter === index) throw Object.assign(new Error('SECRET_PAYLOAD'), { code: settings.failureCode ?? 'E_TAR' });
          await deps.afterDecode();
          const { role: ignoredRole, decodedSha256: privateDecodedHash, ...summary } = expectations[index];
          const value = { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: false, archiveBytes: input.archiveBytes,
            archiveSha256: input.archiveSha256, archivePasses: 2, archiveDataBytes: input.archiveBytes * 2,
            archiveRequestedBytes: input.archiveBytes * 2 + 2, closeAttempts: 2, exitCode: 0, signal: null,
            stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true,
            extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false, rustReady: false, trainingReady: false,
            extractionAuthorized: false, installedUsability: false, decoderQualified: false, provenanceVerified: false,
            hardRssBounded: false, processTreeBounded: false, hardDeadlineGuaranteed: false,
            expandedBytes: summary.expandedBytes, streamEvents: 1, inventory: summary };
          if (settings.result) settings.result(value, index, state);
          return value;
        },
      };
    },
  };
  return { config, io, state, accepted, calledRoles, imports, spawnCalls, helper };
}
async function execute(settings) {
  const f = fixture(settings), outcome = await mocked.runRegisteredRustPayloadInspectionMock(f.config);
  return { ...f, outcome, data: JSON.parse(outcome.text) };
}

test('fixed inputs preserve all old roles and device-independent root/file metadata', () => {
  assert.deepEqual(inputs, old.RUST_LAYOUT_INPUTS); assert.deepEqual(roles, old.RUST_LAYOUT_ROLES);
  for (const input of inputs) { assert.equal(input.identity.root.dev, '28'); assert.equal(input.identity.file.dev, '29'); }
  assert.match(inputs[3].expectedRoot, /^rustfmt-1/); assert.match(inputs[4].expectedRoot, /^clippy-1/);
});
test('literal selection matches all thirteen accepted receipt tuples with no Python selection', () => {
  const receipt = JSON.parse(stored.get('layoutReceipt'));
  assert.equal(targets.length, 13); assert.equal(targets.reduce((n, t) => n + t.size, 0), 457372178);
  assert.deepEqual(targets.map(({ kind, domain, ...target }) => target), receipt.runtimeInspectionCandidates);
  assert.equal(targets.filter(t => t.kind === 'ELF_EXEC_DSO').length, 12);
  assert.equal(targets.filter(t => t.kind === 'LINKER_TEXT')[0].size, 42);
  assert.equal(targets.filter(t => t.domain === 'TARGET').length, 1);
  assert.ok(targets.every(t => !t.path.endsWith('.py') && !t.path.includes('wrapper')));
});
test('all five accepted receipt summaries match exact known fields only', () => {
  const receipt = JSON.parse(stored.get('layoutReceipt'));
  assert.deepEqual(expectations, receipt.roles.map(({ role, expandedBytes, entries, headers, metadataSha256, decodedSha256 }) =>
    ({ role, expandedBytes, entries, headers, metadataSha256, decodedSha256 })));
});
test('every raw repository source pin remains independently checked', () => {
  for (const [key] of source.rows) assert.deepEqual(pin(stored.get(key)), mockPins[key] ?? operation.RUST_PAYLOAD_SOURCE_PINS[key]);
});
test('delivered ELF v5 raw pin preserves its exact v4 prefix and fixed policy', async () => {
  const bytes = source.pinned(readFileSync(new URL('./elf-requirements-v5.mjs', import.meta.url)), operation.RUST_PAYLOAD_SOURCE_PINS.elfV5);
  assert.deepEqual(pin(bytes.subarray(0, 21142)), { bytes: 21142, sha256: 'f5a428aae91593853acfd289c4e91fb715ca530744defa2fe9447f6dda0602f3' });
  const elf = await import(uri(bytes));
  assert.equal(elf.ELF_REQUIREMENTS_V5_LIMITS.maxInputBytes, 268435456);
  assert.equal(elf.ELF_REQUIREMENTS_V5_LIMITS.maxStringTableBytes, 16777216);
  assert.equal(typeof elf.inspectElf64RequirementsV5, 'function');
  expectCode(() => elf.inspectElf64RequirementsV5(Buffer.alloc(0)), 'E_INPUT');
});
test('explicit fake raw, TAR-linked, final-linked and role pins bind the shared counterpart graph', () => {
  const tar = oldSource.transformTar(stored.get('rawTar'));
  assert.deepEqual(pin(tar), operation.RUST_PAYLOAD_SOURCE_PINS.eventTar);
  const tarLinked = source.link(helperBytes, 'tar-inventory', uri(tar));
  const linked = source.link(tarLinked, 'elf-requirements-v5', uri(elfBytes));
  assert.deepEqual(pin(tarLinked), mockPins.tarLinkedHelper); assert.deepEqual(pin(linked), mockPins.linkedHelper);
  for (const role of roles) assert.deepEqual(pin(source.link(oldSource.transformCore(stored.get('rawCore'), role),
    'tar-inventory', uri(linked))), mockPins.linkedCores[role]);
});
for (const role of roles) test('old exact transformation pins and lifecycle bodies stay unchanged: ' + role, () => {
  const core = oldSource.transformCore(stored.get('rawCore'), role);
  assert.deepEqual(pin(core), old.RUST_LAYOUT_SOURCE_PINS.coreStages[role][3]);
  assert.deepEqual(operation.RUST_PAYLOAD_SOURCE_PINS.coreStages[role], old.RUST_LAYOUT_SOURCE_PINS.coreStages[role]);
  const text = core.toString(), original = stored.get('rawCore').toString();
  assert.equal(text.slice(text.indexOf('async function runInventory')).replace('--memlimit-decompress=268435456', '--memlimit-decompress=16777216'),
    original.slice(original.indexOf('async function runInventory')));
  assert.ok(text.includes('const selectors = Object.freeze([]);'));
  assert.ok(text.includes('maxTotalMs: 45_000')); assert.ok(text.includes('cleanupMs: 3000'));
});
test('consumed operation, helper, and old tests retain their exact pins without execution', () => {
  const expected = [
    ['rust-component-layout-operation.mjs', 34052, 'faed15d44d6f88c73f6a9ad219de712a5d012012ec970c3f82189d9195b1041a'],
    ['rust-component-layout.mjs', 30039, 'c1f84c8141ee2ea5019e1df299c53ee41ca83f83f27275750f7a82fe7be2e162'],
    ['rust-component-layout-operation.test.mjs', 59374, '54eeb7c87c68e94ece610a7f1120d1b2106a4543c55a82bedeabe8e3602daaed'],
    ['rust-component-layout.test.mjs', 60556, '9142340eefd0fddc96f01b557408d7bc68fe99c350c2057efff6be4466f66a5d'],
  ];
  for (const [path, bytes, sha256] of expected) assert.deepEqual(pin(readFileSync(new URL(path, import.meta.url))), { bytes, sha256 });
  assert.ok(stored.get('rawCore').toString().includes('--memlimit-decompress=16777216'));
});
test('private binding replacement requires exactly one literal occurrence', () => {
  expectCode(() => source.link(Buffer.from('none'), 'tar-inventory', 'data:x'), 'E_SOURCE_PIN');
  expectCode(() => source.link(Buffer.from(helperBytes.toString() + helperBytes), 'tar-inventory', 'data:x'), 'E_SOURCE_PIN');
});
test('source byte capture rejects proxies and shared backing', () => {
  expectCode(() => source.pinned(new Proxy(helperBytes, {}), mockPins.helper), 'E_SOURCE_PIN');
  const shared = Buffer.from(new SharedArrayBuffer(helperBytes.length)); shared.set(helperBytes);
  expectCode(() => source.pinned(shared, mockPins.helper), 'E_SOURCE_PIN');
});
test('oversized named source metadata fails before allocation/read/open/import', async () => {
  const f = await execute({ fsHooks: { namedStat: (_path, stat) => ({ ...stat, size: stat.size + 1n }) } });
  assert.equal(f.data.error, 'E_SOURCE_PIN'); assert.equal(f.data.repoCapture.allocations, 0);
  assert.equal(f.data.repoCapture.readAttempts, 0); assert.equal(f.data.repoCapture.openAttempts, 0); assert.equal(f.imports.length, 0);
});
test('oversized FD metadata closes before allocation/read/import', async () => {
  const f = await execute({ fsHooks: { fdStat: (_fd, stat) => ({ ...stat, size: stat.size + 1n }) } });
  assert.equal(f.data.error, 'E_SOURCE_PIN'); assert.equal(f.data.repoCapture.allocations, 0);
  assert.equal(f.data.repoCapture.readAttempts, 0); assert.equal(f.data.repoCapture.closes, 1); assert.equal(f.imports.length, 0);
});
test('positive EOF probe suppresses every import and closes once', async () => {
  const f = await execute({ fsHooks: { read: ({ paths, path, bytes, offset, length, position }) =>
    position === paths.get(path).length ? 1 : paths.get(path).copy(bytes, offset, position, position + length) } });
  assert.equal(f.data.error, 'E_LENGTH'); assert.equal(f.data.repoCapture.closes, 1); assert.equal(f.imports.length, 0);
  assert.equal(f.data.repoCapture.readBytes, stored.get('layoutOperation').length + 1);
});
test('source short read does not retry or import', async () => {
  const f = await execute({ fsHooks: { read: () => 3 } });
  assert.equal(f.data.error, 'E_LENGTH'); assert.equal(f.data.repoCapture.readAttempts, 1); assert.equal(f.imports.length, 0);
});
test('source FD identity swap aborts and closes before hash/import', async () => {
  let n = 0;
  const f = await execute({ fsHooks: { fdStat: (_fd, stat) => ({ ...stat, ino: ++n === 2 ? 999n : stat.ino }) } });
  assert.equal(f.data.error, 'E_BINDING'); assert.equal(f.data.repoCapture.closes, 1); assert.equal(f.imports.length, 0);
});
test('source root drift aborts without root repair', () => {
  let n = 0;
  const f = memoryFs({ rootStat: () => ({ ...metadata(4096, true), ctimeNs: ++n === 2 ? 21n : 20n }) });
  const counts = source.captureCounts();
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_BINDING');
  assert.equal(counts.closes, 1); assert.equal(f.opened.size, 0);
});
test('source metadata accessor is rejected without invocation', () => {
  let invoked = 0;
  const f = memoryFs({ fdStat: (_fd, stat) => Object.defineProperty(stat, 'ino', { get() { invoked++; return 3n; } }) });
  expectCode(() => source.captureSource('rawCore', f.api, source.captureCounts(), () => 0), 'E_METADATA');
  assert.equal(invoked, 0);
});
test('source close fault clears retry ownership and prevents all imports', async () => {
  const f = await execute({ fsHooks: { close() { throw new Error('SECRET_PAYLOAD'); } } });
  assert.equal(f.data.error, 'E_CLOSE'); assert.equal(f.data.repoCapture.closeAttempts, 1);
  assert.equal(f.data.repoCapture.closes, 0); assert.equal(f.data.repoCapture.ownedFds, 0); assert.equal(f.imports.length, 0);
});
test('source deadline after open still attempts exactly one positive close', () => {
  const f = memoryFs(), counts = source.captureCounts();
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => {
    if (f.opened.size) throw Object.assign(new Error(), { code: 'E_CLOCK' });
  }), 'E_CLOCK');
  assert.equal(counts.closeAttempts, 1); assert.equal(counts.closes, 1); assert.equal(counts.allocations, 0);
});
test('source capture enforces nofollow/nonblock and all nine metadata fields', () => {
  const f = memoryFs(), counts = source.captureCounts();
  source.captureSource('rawCore', f.api, counts, () => 0);
  assert.equal(f.calls.find(row => row[0] === 'open')[2], 0x20000 | 0x800);
  assert.equal(counts.fdChecks, 2); assert.equal(counts.namedChecks, 2); assert.equal(counts.rootChecks, 2);
  assert.equal(counts.peakOwnedFds, 1); assert.equal(counts.closes, 1);
});
test('source capture refuses unknown paths without I/O', () => {
  const f = memoryFs();
  expectCode(() => source.captureSource('arbitrary-path', f.api, source.captureCounts(), () => 0), 'E_SOURCE_PIN');
  assert.equal(f.calls.length, 0);
});
test('source allocation budget permits exactly 512 KiB but not one byte more', () => {
  for (const excess of [0, 1]) {
    const f = memoryFs(), counts = source.captureCounts(); counts.allocatedBytes = 524288 - 23262 + excess;
    if (excess) expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_LIMIT');
    else source.captureSource('rawCore', f.api, counts, () => 0);
    assert.equal(counts.readAttempts, excess ? 0 : 2); assert.equal(counts.closes, 1);
  }
});
test('source FS ceiling reserves its last attempt for close', () => {
  const f = memoryFs(), counts = source.captureCounts(); counts.fsCalls = 4088;
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_LIMIT');
  assert.equal(counts.fsCalls, 4096); assert.equal(counts.closes, 1);
});
test('source hash verification occurs only after positive close', () => {
  let retained;
  const f = memoryFs({ read({ paths, path, bytes, offset, length, position }) {
    retained = bytes; return paths.get(path).copy(bytes, offset, position, position + length);
  }, close() { retained[0] ^= 1; } }), counts = source.captureCounts();
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_SOURCE_PIN');
  assert.equal(counts.closes, 1); assert.equal(counts.completedCaptures, 0);
});
test('five fake roles finish only after independent source, stage and archive closure gates', async () => {
  const f = await execute();
  assert.equal(f.outcome.exitCode, 0); assert.equal(f.data.status, 'MOCK_RUST_PAYLOAD_DATA_INSPECTED');
  assert.equal(f.data.mockOnly, true); assert.equal(f.data.realArchiveInspected, false); assert.equal(f.data.candidateExecuted, false);
  assert.equal(f.data.decoderExecuted, null);
  assert.deepEqual(f.calledRoles, roles); assert.equal(f.data.counts.spawnAttempts, 5); assert.equal(f.data.counts.peakChildren, 1);
  assert.equal(f.data.counts.childCloses, 5); assert.equal(f.data.counts.stageChecks, 10); assert.equal(f.data.counts.preloadChecks, 10);
  assert.equal(f.data.counts.stageCloses, 50); assert.equal(f.data.counts.archiveCloseAttempts, 10);
  assert.equal(f.data.counts.archiveDataBytes, 255545440); assert.equal(f.data.counts.archiveRequestedBytes, 255545450);
  assert.equal(f.data.repoCapture.closes, 10); assert.equal(f.data.repoCapture.completedCaptures, 10);
  assert.equal(f.data.repoCapture.peakOwnedFds, 1); assert.ok(f.data.repoCapture.allocatedBytes < 524288);
  assert.equal(f.state.finished, 1); assert.equal(f.state.aborted, 0); assert.equal(f.imports.length, 8);
  assert.equal(f.data.result.members.length, 13); assert.match(f.outcome.text, /\n$/); assert.doesNotMatch(f.outcome.text, /[^\x00-\x7f]/);
  for (const call of f.spawnCalls) assert.deepEqual(call, [decoder + '/ld-linux-x86-64.so.2', args, options()]);
});
for (const failureCode of ['E_HASH', 'E_TAR', 'E_DECODER', 'E_PIPE', 'E_CLOSE']) test('late fifth-role ' + failureCode + ' suppresses every prior observation', async () => {
  const f = await execute({ failAfter: 4, failureCode });
  assert.equal(f.data.error, failureCode); assert.equal(f.data.role, 'clippy-preview'); assert.equal(f.data.status, 'STOP');
  assert.equal(f.data.counts.completedCorePasses, 4); assert.equal(f.state.finished, 0); assert.equal(f.state.aborted, 1);
  assert.deepEqual(f.accepted, []); assert.equal(f.state.capturedBytes, 0); assert.equal(f.data.result, undefined);
  assert.doesNotMatch(f.outcome.text, /SECRET_PAYLOAD|decodedSha256|metadataSha256|libLLVM|librustc_driver/);
  assert.equal(f.data.candidateExecuted, false); assert.equal(f.data.decoderExecuted, null); assert.equal(f.data.archiveAccountingComplete, false);
});
test('late pre-spawn hash failure preserves completed counters without a zero attempted-I/O claim', async () => {
  const f = await execute({ failBefore: 4 });
  assert.equal(f.data.error, 'E_HASH'); assert.equal(f.data.counts.spawnAttempts, 4); assert.equal(f.data.counts.archiveCloseAttempts, 8);
  assert.match(f.data.archiveCountersScope, /failed-pass bytes are not zero-I\/O assertions/); assert.deepEqual(f.accepted, []);
});
test('late stage fault suppresses all earlier accepted members', async () => {
  const f = await execute({ stage: state => { if (state.stage === 10) throw Object.assign(new Error('SECRET_PAYLOAD'), { code: 'E_IO' }); } });
  assert.equal(f.data.error, 'E_IO'); assert.equal(f.data.stageAccountingComplete, false); assert.equal(f.data.counts.stageChecks, 9);
  assert.deepEqual(f.accepted, []); assert.equal(f.state.finished, 0);
});
test('late preload fault suppresses every member despite all fifty stage closes', async () => {
  const f = await execute({ preload: state => state.preload !== 10 });
  assert.equal(f.data.error, 'E_PRELOAD'); assert.equal(f.data.counts.stageCloses, 50); assert.equal(f.data.counts.preloadChecks, 9);
  assert.equal(f.data.result, undefined); assert.deepEqual(f.accepted, []);
});
test('source, stage, and archive counters do not substitute for missing positive stage close', async () => {
  const f = await execute({ stageCloses: 4 });
  assert.equal(f.data.error, 'E_RECEIPT'); assert.equal(f.data.repoCapture.closes, 10); assert.equal(f.data.counts.stageChecks, 0);
  assert.equal(f.data.counts.archiveCloseAttempts, 0); assert.equal(f.spawnCalls.length, 0);
});
test('missing child close blocks subsequent spawn and publication', async () => {
  const f = await execute({ noClose: true });
  assert.equal(f.data.error, 'E_RECEIPT'); assert.equal(f.data.counts.ownedChildren, 1); assert.equal(f.data.counts.spawnAttempts, 1);
  assert.deepEqual(f.accepted, []); assert.equal(f.state.finished, 0);
});
test('second spawn in the same role never reaches the capability', async () => {
  const f = await execute({ extraSpawn: true });
  assert.equal(f.data.error, 'E_LIMIT'); assert.equal(f.data.counts.spawnAttempts, 2); assert.equal(f.spawnCalls.length, 1);
});
test('unexpected decoder options stop before a capability invocation', async () => {
  const f = await execute({ wrongArg: true });
  assert.equal(f.data.error, 'E_SPAWN'); assert.equal(f.spawnCalls.length, 0);
});
test('all helper constants compare before any archive role begins', async () => {
  for (const key of ['RUST_PAYLOAD_INPUTS', 'RUST_PAYLOAD_TARGETS', 'RUST_PAYLOAD_EXPECTATIONS', 'RUST_PAYLOAD_ROLES', 'RUST_PAYLOAD_LIMITS']) {
    const f = await execute({ helper: helper => { helper[key] = []; } });
    assert.equal(f.data.error, 'E_RECEIPT'); assert.equal(f.calledRoles.length, 0); assert.equal(f.spawnCalls.length, 0);
  }
});
for (const key of ['expandedBytes', 'entries', 'headers', 'metadataSha256']) test('core parser finish must match accepted ' + key, async () => {
  const f = await execute({ result: (value, index) => { if (index === 4) value.inventory[key] = typeof value.inventory[key] === 'string' ? '0'.repeat(64) : value.inventory[key] + 1; } });
  assert.equal(f.data.error, 'E_SUMMARY'); assert.deepEqual(f.accepted, []); assert.equal(f.data.result, undefined);
});
test('75000ms remaining is inclusive without adding cleanup again', async () => {
  const f = await execute({ beforeFifthTime: 225000 });
  assert.equal(f.outcome.exitCode, 0); assert.equal(f.data.counts.completedCorePasses, 5);
});
test('74999ms remaining refuses the fifth role and clears all observations', async () => {
  const f = await execute({ beforeFifthTime: 225001 });
  assert.equal(f.data.error, 'E_DEADLINE'); assert.equal(f.calledRoles.length, 4); assert.deepEqual(f.accepted, []);
});
test('source import latency consumes one original ten-second deadline', async () => {
  const f = await execute({ importLatency: 2000 });
  assert.equal(f.data.error, 'E_DEADLINE'); assert.equal(f.imports.length, 5); assert.equal(f.calledRoles.length, 0);
});
test('stage latency consumes the role clock including cleanup allowance', async () => {
  const f = await execute({ stage: state => { state.time += 22500; } });
  assert.equal(f.data.error, 'E_DEADLINE'); assert.equal(f.data.counts.completedCorePasses, 0); assert.deepEqual(f.accepted, []);
});
test('source time does not reset the outer clock before role five', async () => {
  const f = await execute({ importLatency: 1000, beforeFifthTime: 232000 });
  assert.equal(f.data.error, 'E_DEADLINE'); assert.equal(f.data.counts.spawnAttempts, 4);
});
test('nonfinite and unrepresentable clocks fail before source I/O', async () => {
  for (const value of [NaN, Infinity, Number.MAX_VALUE]) {
    const f = await execute({ now: () => value });
    assert.equal(f.data.error, 'E_CLOCK'); assert.equal(f.io.calls.length, 0);
  }
});
test('backward clock is not reset between roles', async () => {
  const f = await execute({ afterAccept: (_n, state) => { state.time = -1; } });
  assert.equal(f.data.error, 'E_CLOCK'); assert.equal(f.calledRoles.length, 1); assert.deepEqual(f.accepted, []);
});
test('publication clock failure aborts the full accepted batch', async () => {
  const f = await execute({ finish: (result, state) => { state.time += 30000; return result; } });
  assert.equal(f.data.error, 'E_DEADLINE'); assert.equal(f.data.result, undefined); assert.equal(f.state.aborted, 1);
  assert.deepEqual(f.accepted, []);
});
test('post-serialization clock failure cannot leak the prebuilt result', async () => {
  const f = await execute({ serializationDeadline: true });
  assert.equal(f.data.error, 'E_DEADLINE'); assert.equal(f.data.status, 'STOP'); assert.equal(f.data.result, undefined);
  assert.deepEqual(f.accepted, []);
});
test('all qualification flags remain false recursively without coercion', async () => {
  for (const value of [true, 0, null, 'false']) {
    const f = await execute({ finish: result => ({ ...result, nested: { nativeAuthority: value } }) });
    assert.equal(f.data.error, 'E_RECEIPT'); assert.equal(f.data.nativeAuthority, false); assert.deepEqual(f.accepted, []);
  }
  const f = await execute();
  for (const key of ['roleSatisfied', 'nativeQualified', 'nativeAuthority', 'rustReady', 'trainingReady', 'pythonFreeSubsetVerified',
    'dockerProviderQualified', 'installedUsability', 'relocationReady', 'extracted', 'runtimeExecuted']) assert.equal(f.data[key], false);
});
test('ASCII JSON counts the exact 2MiB complete envelope including LF', () => {
  const prefix = source.asciiJson({ padding: '' }, 2097152).length;
  const value = { padding: 'x'.repeat(2097152 - prefix) };
  assert.equal(source.asciiJson(value, 2097152).length, 2097152);
  expectCode(() => source.asciiJson({ padding: value.padding + 'x' }, 2097152), 'E_OUTPUT');
});
test('actual operation envelope accepts exactly 2MiB including LF and refuses the next byte', async () => {
  const empty = await execute({ finish: result => ({ ...result, padding: '' }) });
  assert.equal(empty.outcome.exitCode, 0);
  const available = 2097152 - empty.outcome.text.length;
  const exact = await execute({ finish: result => ({ ...result, padding: 'x'.repeat(available) }) });
  assert.equal(exact.outcome.exitCode, 0); assert.equal(exact.outcome.text.length, 2097152);
  const excess = await execute({ finish: result => ({ ...result, padding: 'x'.repeat(available + 1) }) });
  assert.equal(excess.data.error, 'E_OUTPUT'); assert.equal(excess.data.result, undefined); assert.deepEqual(excess.accepted, []);
});
test('Unicode costs six bytes per UTF16 code unit before stringify', () => {
  assert.equal(source.asciiJson({ text: 'é😀\n' }, 64), '{"text":"\\u00e9\\ud83d\\ude00\\n"}\n');
  expectCode(() => source.asciiJson({ text: 'é'.repeat(350000) }, 2097152), 'E_OUTPUT');
});
test('serializer refuses getters, toJSON, proxies, cycles and depth overflow without invoking hooks', () => {
  let invoked = 0;
  const cycle = {}; cycle.self = cycle;
  let deep = {}; for (let n = 0; n < 65; n++) deep = { next: deep };
  for (const value of [{ get secret() { invoked++; return 'SECRET_PAYLOAD'; } },
    { toJSON() { invoked++; return 'SECRET_PAYLOAD'; } }, new Proxy({}, {}), cycle, deep]) {
    expectCode(() => source.asciiJson(value, 2097152), 'E_OUTPUT');
  }
  assert.equal(invoked, 0);
});
test('serializer enforces its incremental node ceiling before stringify', () => {
  expectCode(() => source.preflight(Array(1048576).fill(null), 16777216), 'E_OUTPUT');
});
test('final envelope overflow clears all members and emits no provisional references', async () => {
  const f = await execute({ finish: result => ({ ...result, secret: 'é'.repeat(350000) }) });
  assert.equal(f.data.error, 'E_OUTPUT'); assert.equal(f.data.result, undefined); assert.ok(f.outcome.text.length <= 65536);
  assert.deepEqual(f.accepted, []); assert.doesNotMatch(f.outcome.text, /libLLVM|decodedSha256|secret/);
});
const failure = { sourceProfile: 'RUST_COMPONENT_LAYOUT_DATA', role: targets[0].role, path: targets[0].path, index: targets[0].index, kind: targets[0].kind,
  code: 'E_PAYLOAD_ELF', underlyingCode: 'E_STRING_TABLE', scope: 'ATTEMPTED_LITERAL_TARGET_NOT_ACCEPTED_PAYLOAD_EVIDENCE' };
test('approved failure target exposes only source identity and whitelisted parser codes', async () => {
  const f = await execute({ failAfter: 4, failure });
  assert.deepEqual(f.data.failedTargetAttempt, failure); assert.ok(source.asciiJson(failure, 4096).length <= 4096);
  assert.doesNotMatch(f.outcome.text, /decodedSha256|metadataSha256|needed|linkerRefs|SECRET_PAYLOAD/);
});
test('failure target rejects extra fields, unknown identity and messages', () => {
  for (const value of [{ ...failure, message: 'SECRET_PAYLOAD' }, { ...failure, path: 'SECRET_PAYLOAD' },
    { ...failure, index: 9999 }, { ...failure, code: 'SECRET_PAYLOAD' }, { ...failure, underlyingCode: 'SECRET_PAYLOAD' }]) {
    expectCode(() => source.captureFailure(value), 'E_OUTPUT');
  }
});
test('failure code and target accessors never run or leak', async () => {
  let invoked = 0;
  const diagnostic = { ...failure }; Object.defineProperty(diagnostic, 'code', { get() { invoked++; return 'E_ELF'; } });
  const f = await execute({ failAfter: 4, failure: diagnostic });
  assert.equal(invoked, 0); assert.equal(f.data.failedTargetAttempt, undefined);
  const g = await execute({ stage() { throw Object.defineProperty({}, 'code', { get() { invoked++; return 'E_HASH'; } }); } });
  assert.equal(g.data.error, 'E_IO'); assert.equal(invoked, 0);
});
test('snapshot own-data validation prevents getter access before publication', async () => {
  let invoked = 0;
  const f = await execute({ snapshot: result => Object.defineProperty(result, 'capturedBytes', { get() { invoked++; return 0; } }) });
  assert.equal(f.data.error, 'E_OUTPUT'); assert.equal(invoked, 0); assert.equal(f.spawnCalls.length, 0);
});
test('core result accessor cannot execute during validation', async () => {
  let invoked = 0;
  const f = await execute({ result: value => Object.defineProperty(value, 'inventory', { get() { invoked++; return {}; } }) });
  assert.equal(f.data.error, 'E_OUTPUT'); assert.equal(invoked, 0); assert.deepEqual(f.accepted, []);
});
test('member serialization hook cannot execute or publish provisional hashes', async () => {
  let invoked = 0;
  const f = await execute({ finish: result => ({ ...result, toJSON() { invoked++; return { secret: 'SECRET_PAYLOAD' }; } }) });
  assert.equal(f.data.error, 'E_OUTPUT'); assert.equal(invoked, 0); assert.equal(f.data.result, undefined);
  assert.doesNotMatch(f.outcome.text, /SECRET_PAYLOAD|decodedSha256|libLLVM/);
});
test('plain reordered constant fields compare by strict shape rather than insertion order', async () => {
  const f = await execute({ helper: helper => {
    helper.RUST_PAYLOAD_TARGETS = targets.map(target => Object.fromEntries(Object.entries(target).reverse()));
  } });
  assert.equal(f.outcome.exitCode, 0);
});
test('unknown extra target fields stop before any role', async () => {
  const f = await execute({ helper: helper => {
    helper.RUST_PAYLOAD_TARGETS = targets.map(target => ({ ...target, extra: false }));
  } });
  assert.equal(f.data.error, 'E_RECEIPT'); assert.equal(f.calledRoles.length, 0); assert.equal(f.spawnCalls.length, 0);
});
test('production rejects arbitrary arguments without consuming or touching any source', async () => {
  const outcome = await operation.runRegisteredRustPayloadInspection({ role: 'cargo' });
  assert.equal(JSON.parse(outcome.text).error, 'E_INPUT'); assert.equal(operation.runRegisteredRustPayloadInspection.length, 0);
});
test('mock requires complete fake capabilities and rejects paths, roles, URLs and source overrides', async () => {
  for (const extra of [{ role: 'cargo' }, { root: '/host' }, { moduleUrl: 'file:evil' }, { sourcePins: {} }]) {
    const f = fixture(), outcome = await mocked.runRegisteredRustPayloadInspectionMock({ ...f.config, ...extra });
    assert.equal(JSON.parse(outcome.text).error, 'E_INPUT'); assert.equal(f.io.calls.length, 0);
  }
  for (const key of ['fs', 'spawn', 'now', 'moduleImporter']) {
    const f = fixture(); delete f.config[key];
    assert.equal(JSON.parse((await mocked.runRegisteredRustPayloadInspectionMock(f.config)).text).error, 'E_INPUT');
    assert.equal(f.io.calls.length, 0);
  }
  const f = fixture();
  assert.equal(JSON.parse((await mocked.runRegisteredRustPayloadInspectionMock(f.config, {})).text).error, 'E_INPUT');
  assert.equal(f.io.calls.length, 0);
});
test('source serial capture rejects nonregular and multiply linked files before allocation', async () => {
  for (const change of [{ mode: 0o120777n }, { nlink: 2n }]) {
    const f = await execute({ fsHooks: { namedStat: (_path, stat) => ({ ...stat, ...change }) } });
    assert.equal(f.data.error, 'E_SOURCE_PIN'); assert.equal(f.data.repoCapture.allocations, 0);
    assert.equal(f.data.repoCapture.openAttempts, 0); assert.equal(f.imports.length, 0);
  }
});
test('source close failure wins over a simultaneous post-open clock failure without retrying', () => {
  const f = memoryFs({ close() { throw new Error('SECRET_PAYLOAD'); } }), counts = source.captureCounts();
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => {
    if (f.opened.size) throw Object.assign(new Error(), { code: 'E_DEADLINE' });
  }), 'E_CLOSE');
  assert.equal(counts.closeAttempts, 1); assert.equal(counts.closes, 0); assert.equal(counts.ownedFds, 0);
});
test('stage failure exception messages and unsupported codes never enter STOP JSON', async () => {
  const f = await execute({ stage() { throw Object.assign(new Error('SECRET_PAYLOAD'), { code: 'SECRET_CODE', stack: 'SECRET_STACK' }); } });
  assert.equal(f.data.error, 'E_IO'); assert.doesNotMatch(f.outcome.text, /SECRET_PAYLOAD|SECRET_CODE|SECRET_STACK/);
});
test('mock-labelled core output never serves as a production-shaped accepted role', async () => {
  const f = await execute({ result: value => { value.mockOnly = true; } });
  assert.equal(f.data.error, 'E_RECEIPT'); assert.equal(f.data.mockOnly, true); assert.equal(f.data.realArchiveInspected, false);
  assert.deepEqual(f.accepted, []);
});
test('delivered graph freezes all raw, intermediate and shared-URI role pins before imports', async () => {
  source.compareConstants(deliveredModule, JSON.parse(stored.get('rustReceipt')), JSON.parse(stored.get('layoutReceipt')), old);
  assert.deepEqual(pin(readFileSync(new URL('./rust-payload-inspection.test.mjs', import.meta.url))), {
    bytes: 52296, sha256: '1e556a73b386a3075ea4a7966113cc50262549b0c8a9ae456080d74811fdfbad' });
  for (const role of roles) {
    const bytes = source.pinned(source.link(oldSource.transformCore(stored.get('rawCore'), role), 'tar-inventory', deliveredUri),
      operation.RUST_PAYLOAD_SOURCE_PINS.linkedCores[role]);
    assert.equal(bytes.toString().split("from '" + deliveredUri + "'").length, 2);
    const core = await import(uri(bytes));
    assert.deepEqual(core.GNU_SDK_LIMITS, operation.RUST_PAYLOAD_CORE_LIMITS);
    assert.equal(typeof core.runGnuSdkInventory, 'function');
  }
  const rawTotal = source.rows.reduce((sum, [key]) => sum + operation.RUST_PAYLOAD_SOURCE_PINS[key].bytes, 0);
  assert.equal(rawTotal, 185559); assert.ok(rawTotal + source.rows.length < 524288);
});
test('decoded hash stays private and returned role declarations must match the fixed expectations', async () => {
  const f = await execute({ result: value => { assert.equal(Object.hasOwn(value.inventory, 'decodedSha256'), false); },
    finish: result => ({ ...result, roles: result.roles.map((row, index) => index === 4 ? { ...row, decodedSha256: '0'.repeat(64) } : row) }) });
  assert.equal(f.data.error, 'E_PAYLOAD'); assert.equal(f.data.result, undefined); assert.deepEqual(f.accepted, []);
});
test('nested member execution and edge qualification claims cannot reach publication', async () => {
  for (const field of ['candidateExecuted', 'roleSatisfied', 'providerQualified', 'abiVerified', 'runtimeProvidersQualified']) {
    const f = await execute({ finish: result => ({ ...result, extra: { [field]: true } }) });
    assert.equal(f.data.error, 'E_RECEIPT'); assert.equal(f.data.result, undefined); assert.deepEqual(f.accepted, []);
  }
});
test('final literal tuple changes and missing role satisfaction markers suppress the entire batch', async () => {
  const changed = await execute({ finish: result => ({ ...result,
    members: result.members.map((member, index) => index === 12 ? { ...member, sha256: '0'.repeat(64) } : member) }) });
  assert.equal(changed.data.error, 'E_PAYLOAD'); assert.equal(changed.data.result, undefined); assert.deepEqual(changed.accepted, []);
  const missing = await execute({ finish: result => {
    const member = result.members[0]; delete member.roleSatisfied; return result;
  } });
  assert.equal(missing.outcome.exitCode, 1); assert.equal(missing.data.result, undefined); assert.deepEqual(missing.accepted, []);
});
test('failure sourceProfile accessor is rejected without invocation', () => {
  let invoked = 0;
  const value = Object.defineProperty({ ...failure }, 'sourceProfile', { get() { invoked++; return 'RUST_COMPONENT_LAYOUT_DATA'; } });
  expectCode(() => source.captureFailure(value), 'E_OUTPUT'); assert.equal(invoked, 0);
});
for (const flag of ['extractionAuthorized', 'installedUsability', 'decoderQualified', 'provenanceVerified',
  'hardRssBounded', 'processTreeBounded', 'hardDeadlineGuaranteed']) test('original core flag is mandatory false: ' + flag, async () => {
  const f = await execute({ result: value => { delete value[flag]; } });
  assert.equal(f.outcome.exitCode, 1); assert.deepEqual(f.accepted, []); assert.equal(f.data.result, undefined);
});
test('failure capture enforces the fixed source profile and real helper code namespace', () => {
  expectCode(() => source.captureFailure({ ...failure, sourceProfile: 'MOCK_LAYOUT' }), 'E_OUTPUT');
  expectCode(() => source.captureFailure({ ...failure, code: 'E_ELF' }), 'E_OUTPUT');
  const textTarget = targets.find(target => target.kind === 'LINKER_TEXT');
  const textFailure = { sourceProfile: 'RUST_COMPONENT_LAYOUT_DATA', role: textTarget.role, path: textTarget.path,
    index: textTarget.index, kind: textTarget.kind, code: 'E_PAYLOAD_LINKER_UNSUPPORTED', underlyingCode: null,
    scope: failure.scope };
  assert.deepEqual(source.captureFailure(textFailure), textFailure);
});

function tarMember(path, body = Buffer.alloc(0), directory = false) {
  const header = Buffer.alloc(512), slash = path.lastIndexOf('/');
  if (Buffer.byteLength(path) > 100) { header.write(path.slice(slash + 1), 0, 100); header.write(path.slice(0, slash), 345, 155); }
  else header.write(path, 0, 100);
  for (const [at, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, body.length], [136, 12, 0]]) {
    header.write(value.toString(8).padStart(width - 1, '0') + '\0', at, width, 'ascii');
  }
  header[156] = directory ? 53 : 48; header.write('ustar\0', 257, 6, 'ascii'); header.write('00', 263, 2, 'ascii');
  header.fill(32, 148, 156); header.write(header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return Buffer.concat([header, body, Buffer.alloc((512 - body.length % 512) % 512)]);
}
function syntheticPayloadProfile() {
  const elf = Buffer.alloc(96);
  elf.set([127, 69, 76, 70, 2, 1, 1]); elf.writeUInt16LE(3, 16); elf.writeUInt16LE(62, 18);
  elf.writeUInt32LE(1, 20); elf.writeUInt16LE(64, 52); elf.writeUInt16LE(56, 54);
  const archives = [], selected = [], summaries = [];
  for (let i = 0; i < 5; i++) {
    const parts = [tarMember(inputs[i].expectedRoot, Buffer.alloc(0), true)];
    let cursor = 512, index = 1;
    for (const target of targets.filter(target => target.role === roles[i])) {
      const body = target.kind === 'LINKER_TEXT' ? Buffer.from('INPUT ( libLLVM.so )\n') : elf;
      selected.push({ ...target, index: ++index, bodyOffset: cursor + 512, size: body.length, sha256: hash(body) });
      const bytes = tarMember(target.path, body); parts.push(bytes); cursor += bytes.length;
    }
    const bytes = Buffer.concat([...parts, Buffer.alloc(1024)]); archives.push(bytes);
    const parser = deliveredTarModule.createTarInventory(); parser.feed(bytes); const summary = parser.finish();
    summaries.push({ role: roles[i], expandedBytes: summary.expandedBytes, entries: summary.entries,
      headers: summary.headers, metadataSha256: summary.metadataSha256, decodedSha256: hash(bytes) });
  }
  return { archives, profile: { mockOnly: true, inputs: inputs.map((input, index) => {
    const root = '/fixture/rust-payload-operation-' + index, archiveBytes = index + 3;
    return { ...input, root, file: root + '/' + input.expectedRoot + '.tar.xz', archiveBytes,
      archiveSha256: hash('operation mock compressed ' + index), identity: { root: { ...input.identity.root },
        file: { ...input.identity.file, size: String(archiveBytes) } } };
  }), targets: selected, expectations: summaries, limits: {} } };
}
function fixtureCore(input, inventory) {
  return { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: true, inventory, archiveBytes: input.archiveBytes,
    archiveSha256: input.archiveSha256, archivePasses: 2, archiveDataBytes: input.archiveBytes * 2,
    archiveRequestedBytes: input.archiveBytes * 2 + 2, closeAttempts: 2, stdinFinished: true,
    stdoutEnded: true, stderrEnded: true, closeObserved: true, exitCode: 0, signal: null,
    extracted: false, extractionAuthorized: false, pythonFreeSubsetVerified: false, installedUsability: false,
    nativeQualified: false, decoderQualified: false, rustReady: false, trainingReady: false,
    provenanceVerified: false, hardRssBounded: false, processTreeBounded: false, hardDeadlineGuaranteed: false };
}
test('same captured helper URI and real ELF v5 inspect all thirteen tiny synthetic payloads with five fake cores', async () => {
  const { profile, archives } = syntheticPayloadProfile();
  const batch = deliveredModule.createRustPayloadInspectionFixture(profile, deliveredTarModule.createTarInventory);
  let finished = 0;
  const cores = await Promise.all(roles.map(async (role, index) => {
    const sameHelper = await import(deliveredUri); assert.equal(sameHelper, deliveredModule);
    return () => {
      batch.beginRustPayloadRole(role); const parser = batch.createTarInventory({});
      for (let at = 0; at < archives[index].length; at += 513) parser.feed(archives[index].subarray(at, at + 513));
      const inventory = parser.finish(); const value = fixtureCore(profile.inputs[index], inventory);
      batch.acceptRustPayloadRole(value); finished++;
    };
  }));
  batch.beginRustPayloadBatch();
  for (const core of cores) core();
  assert.equal(finished, 5);
  const result = batch.finishRustPayloadBatch();
  assert.equal(result.mockOnly, true); assert.equal(result.members.length, 13); assert.equal(result.roles.length, 5);
  assert.ok(result.members.filter(member => member.kind === 'ELF_EXEC_DSO').every(member =>
    member.metadata.requirements.profile === 'elf64le-x86-64-requirements-v5'));
  assert.equal(result.members.find(member => member.kind === 'LINKER_TEXT').metadata.state, 'GNU_LD_REFERENCE_DATA');
  assert.ok(Array.isArray(result.declaredNeededEdges)); assert.equal(result.runtimeProvidersQualified, false);
  assert.equal(result.nativeAuthority, false); assert.equal(result.candidateExecuted, false);
  assert.ok(source.asciiJson({ mockOnly: true, status: 'MOCK_RUST_PAYLOAD_DATA_INSPECTED', result }, 2097152).length < 2097152);
});
test('same captured helper clears all four earlier synthetic role observations on fifth-body hash failure', () => {
  const { profile, archives } = syntheticPayloadProfile();
  const batch = deliveredModule.createRustPayloadInspectionFixture(profile, deliveredTarModule.createTarInventory);
  batch.beginRustPayloadBatch();
  for (let index = 0; index < 4; index++) {
    batch.beginRustPayloadRole(roles[index]); const parser = batch.createTarInventory(); parser.feed(archives[index]);
    batch.acceptRustPayloadRole(fixtureCore(profile.inputs[index], parser.finish()));
  }
  assert.equal(batch.snapshotRustPayloadBatch().acceptedRoles, 4);
  const corrupt = Buffer.from(archives[4]); corrupt[profile.targets.find(target => target.role === roles[4]).bodyOffset] ^= 1;
  batch.beginRustPayloadRole(roles[4]); const parser = batch.createTarInventory();
  expectCode(() => parser.feed(corrupt), 'E_PAYLOAD_BODY_HASH');
  const diagnostic = source.captureFailure(batch.getRustPayloadFailure());
  assert.equal(diagnostic.sourceProfile, 'RUST_COMPONENT_LAYOUT_DATA');
  assert.equal(diagnostic.index, targets.find(target => target.role === roles[4]).index);
  batch.abortRustPayloadBatch();
  const snapshot = batch.snapshotRustPayloadBatch();
  for (const key of ['acceptedRoles', 'targetCount', 'capturedBytes', 'expandedBytes', 'entries', 'observationBytes']) assert.equal(snapshot[key], 0);
});
test('operation uses the delivered pinned helper and ELF v5 URI with complete fake capabilities and no native calls', async () => {
  const f = fixture(), importFake = f.config.moduleImporter;
  f.io.paths.set(repo + '/tooling/native-ingress/rust-payload-inspection.mjs', Buffer.from(deliveredHelper));
  f.io.paths.set(repo + '/tooling/native-ingress/elf-requirements-v5.mjs', Buffer.from(deliveredElf));
  const importedCores = [];
  f.config.moduleImporter = async target => {
    assert.equal(f.io.opened.size, 0);
    const actual = pin(fromUri(target));
    if (actual.sha256 === operation.RUST_PAYLOAD_SOURCE_PINS.linkedHelper.sha256) {
      assert.equal(target, deliveredUri); return deliveredModule;
    }
    const index = roles.findIndex(role => actual.sha256 === operation.RUST_PAYLOAD_SOURCE_PINS.linkedCores[role].sha256);
    if (index === -1) return importFake(target);
    const bytes = source.pinned(fromUri(target), operation.RUST_PAYLOAD_SOURCE_PINS.linkedCores[roles[index]]);
    assert.equal(bytes.toString().split("from '" + deliveredUri + "'").length, 2);
    const core = await import(target); importedCores.push(roles[index]);
    return { GNU_SDK_DESCRIPTOR: core.GNU_SDK_DESCRIPTOR, GNU_SDK_LIMITS: core.GNU_SDK_LIMITS,
      async runGnuSdkInventory(identity, deps) {
        assert.deepEqual(identity, inputs[index].identity);
        const sameHelper = await import(deliveredUri); assert.equal(sameHelper, deliveredModule);
        const parser = sameHelper.createTarInventory({ maxExpandedBytes: 1073741824, maxHeaders: 32768 });
        await deps.beforeDecode(); deps.spawn(decoder + '/ld-linux-x86-64.so.2', args, options());
        await Promise.resolve(); await deps.afterDecode();
        parser.feed(Buffer.alloc(1024)); return parser.finish();
      } };
  };
  const outcome = await operation.runRegisteredRustPayloadInspectionMock(f.config), data = JSON.parse(outcome.text);
  assert.equal(outcome.exitCode, 1); assert.equal(data.mockOnly, true); assert.equal(data.realArchiveInspected, false);
  assert.equal(data.error, 'E_PAYLOAD_SUMMARY'); assert.equal(data.result, undefined); assert.deepEqual(importedCores, roles);
  assert.equal(data.repoCapture.closes, 10); assert.equal(data.repoCapture.readBytes, 185559);
  assert.equal(data.repoCapture.allocatedBytes, 185569); assert.equal(data.sourceAccountingComplete, true);
  assert.equal(data.counts.stageChecks, 2); assert.equal(data.counts.stageCloses, 10); assert.equal(data.counts.childCloses, 1);
  assert.equal(data.counts.archivePasses, 0); assert.equal(data.archiveAccountingComplete, false);
  assert.match(data.archiveCountersScope, /failed-pass bytes are not zero-I\/O assertions/);
  const snapshot = deliveredModule.snapshotRustPayloadBatch();
  assert.equal(snapshot.state, 'FAILED'); assert.equal(snapshot.acceptedRoles, 0); assert.equal(snapshot.targetCount, 0);
  assert.equal(snapshot.capturedBytes, 0); assert.equal(snapshot.currentRole, null);
  assert.doesNotMatch(outcome.text, /decodedSha256|metadataSha256|libLLVM|librustc_driver/);
});
