// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import * as operation from './rust-component-layout-operation.mjs';

const { rustLayoutSource: source, RUST_LAYOUT_INPUTS: inputs, RUST_LAYOUT_ROLES: roles } = operation;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = bytes => ({ bytes: bytes.length, sha256: hash(bytes) });
const uri = bytes => 'data:text/javascript;base64,' + bytes.toString('base64');
const fromUri = value => Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
const repo = '/tmp/opencode/f9-bootstrap-correspondence';
const decoder = '/tmp/opencode/f9-xz-qualification-01';
const collectorBytes = Buffer.from("export { createTarInventory } from './tar-inventory.mjs';\n");
const mockPins = Object.freeze({
  collector: { bytes: 58, sha256: 'e43599fdb79cc5adc403291e467f048a9c088f5bf4766b923d25eeb00c0ac410' },
  linkedCollector: { bytes: 20863, sha256: 'a65da2a3dc4251cac27a35e219f9889d709d9407d20c66082b775b28f7b6d697' },
  linkedCores: {
    cargo: { bytes: 50350, sha256: '94a0d5576a2ede57f0523a8a518928949bc6c715db20509f98783a1aa7fba411' },
    rustc: { bytes: 50350, sha256: 'ff33e074c8a638d5a1042289b1d7b64d68ea30beac4ccef8d104046214ceed4a' },
    'rust-std': { bytes: 50353, sha256: 'd284282593d9da1edcb35b1a37f7c5e894f3066004a370551783902fd9e2513a' },
    'rustfmt-preview': { bytes: 50351, sha256: '8ae378b78a90b3b88fdb89d658153becb332af177bbde1c47ab8e4c95615d98d' },
    'clippy-preview': { bytes: 50350, sha256: '993bce8a62367ce8708767b04be9094ce3aef09e45ef1cfbbdd077eb5c1efd1f' },
  },
});
const stored = new Map(source.rows.map(([key, path]) => [key,
  key === 'collector' ? Buffer.from(collectorBytes) : readFileSync(new URL('../../' + path, import.meta.url))]));
const originalOperation = readFileSync(new URL('./rust-component-layout-operation.mjs', import.meta.url), 'utf8');
let mockSource = originalOperation;
for (const key of ['collector', 'linkedCollector']) {
  mockSource = source.replaceOnce(mockSource, new RegExp('^  ' + key + ': \\{[^\\n]+\\},$', 'gm'), '  ' + key + ': ' + JSON.stringify(mockPins[key]) + ',');
}
mockSource = source.replaceOnce(mockSource, /^  linkedCores: \{\n(?:    [^\n]*\n)+  \},$/gm,
  '  linkedCores: ' + JSON.stringify(mockPins.linkedCores) + ',');
const mocked = await import(uri(Buffer.from(mockSource)));
const limits = Object.freeze({ maxTotalMs: 45000, cleanupMs: 3000, maxReadsPerPass: 4096,
  maxFsOperations: 10000, maxExpandedBytes: 1073741824, maxHeaders: 32768, maxStreamEvents: 262144,
  maxStderrBytes: 8192, maxSelectedEntries: 128, maxSelectedBytes: 131072, maxSummaryBytes: 4194304 });
const args = Object.freeze(['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', decoder,
  decoder + '/xz', '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=268435456', '--', '-']);
const options = () => ({ cwd: decoder, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false,
  stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
const descriptor = input => ({ root: input.root, file: input.file, archiveBytes: input.archiveBytes,
  archiveSha256: input.archiveSha256, decoderRoot: decoder });
const metadata = (size, directory = false) => ({ dev: 28n, ino: directory ? 2n : 3n,
  mode: directory ? 0o40755n : 0o100644n, uid: 1000n, gid: 1000n, nlink: directory ? 2n : 1n,
  size: BigInt(size), mtimeNs: 10n, ctimeNs: 20n });

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
      calls.push(['open', path, flags]); assert.equal(opened.size, 0);
      assert.ok(paths.has(path));
      const fd = nextFd++; opened.set(fd, path); return fd;
    },
    fstatSync(fd) {
      calls.push(['fstat', fd]); assert.ok(opened.has(fd));
      const stat = metadata(paths.get(opened.get(fd)).length);
      return hooks.fdStat ? hooks.fdStat(fd, stat, calls) : stat;
    },
    readSync(fd, bytes, offset, length, position) {
      calls.push(['read', fd, length, position]); assert.ok(opened.has(fd));
      assert.ok(length <= 65536);
      if (hooks.read) return hooks.read({ fd, bytes, offset, length, position, path: opened.get(fd), paths });
      return paths.get(opened.get(fd)).copy(bytes, offset, position, position + length);
    },
    closeSync(fd) {
      calls.push(['close', fd]); assert.ok(opened.has(fd)); opened.delete(fd);
      if (hooks.close) hooks.close(fd);
    },
  };
  return { api, paths, calls, opened };
}
function fixture(settings = {}) {
  const io = memoryFs(settings.fsHooks), accepted = [], calledRoles = [], imports = [], spawnCalls = [];
  const state = { time: 0, aborted: 0, finished: 0, pending: null, stage: 0, preload: 0,
    begun: 0, live: 0, peak: 0, publicationReads: 0, moduleImports: 0, acceptedEntries: 0, acceptedExpandedBytes: 0 };
  const collector = {
    RUST_LAYOUT_ROLES: roles, RUST_LAYOUT_INPUTS: inputs,
    beginLayoutBatch() { state.begun++; accepted.length = 0; },
    beginLayoutRole(role) { assert.equal(state.pending, null); state.pending = role; calledRoles.push(role); },
    createTarInventory() { throw new Error('mock core owns in-memory inventory'); },
    acceptLayoutRole(value) {
      assert.equal(value, state.coreValue);
      assert.equal(state.pending, roles[accepted.length]);
      accepted.push(state.pending); state.pending = null;
      state.acceptedEntries += value.inventory.entries; state.acceptedExpandedBytes += value.expandedBytes;
      if (settings.failAccept === accepted.length) throw Object.assign(new Error('secretPayloadMember'), { code: 'E_LAYOUT_CORE' });
      if (settings.afterAccept) settings.afterAccept(accepted.length, state);
    },
    finishLayoutBatch() {
      assert.deepEqual(accepted, roles); state.finished++;
      const layout = { profile: 'RUST_COMPONENT_LAYOUT_DATA', state: 'RUST_COMPONENT_LAYOUT_DATA', mockOnly: false,
        roles: accepted.map(role => ({ role })), entries: state.acceptedEntries, expandedBytes: state.acceptedExpandedBytes,
        rustReady: false, nativeQualified: false };
      return settings.finish ? { ...layout, ...settings.finish(state) } : layout;
    },
    abortLayoutBatch() { state.aborted++; accepted.length = 0; state.pending = null; state.acceptedEntries = 0; state.acceptedExpandedBytes = 0; },
    snapshotLayout() {
      if (settings.snapshot) return settings.snapshot(state, accepted);
      return { state: 'ACTIVE', mockOnly: false, acceptedRoles: accepted.length, currentRole: state.pending,
        entries: state.acceptedEntries, expandedBytes: state.acceptedExpandedBytes, metadataBytes: 0, manifestBytes: 0, outputBytes: 0,
        failureCode: null, failureRole: null, ...(settings.diagnostic && state.stage > 0 ? settings.diagnostic : {}) };
    },
  };
  if (settings.collectorInputs) collector.RUST_LAYOUT_INPUTS = settings.collectorInputs;
  const stage = {
    verifyStagedXzImages(receipt) {
      state.stage++; assert.equal(receipt.profile, 'fixed-xz-ordinary-staging-v1');
      if (settings.stage) settings.stage(state);
      return { counters: { fsCalls: 100, readBytes: 2758216, closeAttempts: settings.stageCloses ?? 5 } };
    },
    assertNoSystemPreload() { state.preload++; return settings.preload ? settings.preload(state) : true; },
  };
  const config = {
    fs: io.api,
    spawn(...parameters) {
      spawnCalls.push(parameters); const child = new EventEmitter();
      state.live++; state.peak = Math.max(state.peak, state.live);
      queueMicrotask(() => {
        child.emit('spawn');
        if (!settings.noClose) { child.emit('close', 0, null); state.live--; }
      });
      return child;
    },
    now() {
      if (settings.now) return settings.now(state);
      if (state.finished && settings.serializationDeadline && ++state.publicationReads === 2) state.time += 30000;
      return state.time;
    },
    async moduleImporter(target) {
      assert.equal(io.opened.size, 0); imports.push(target); state.moduleImports++;
      if (settings.importLatency) state.time += settings.importLatency;
      const bytes = fromUri(target), actual = pin(bytes);
      if (actual.sha256 === mockPins.linkedCollector.sha256) return collector;
      if (actual.sha256 === operation.RUST_LAYOUT_SOURCE_PINS.linkedStage.sha256) return stage;
      const index = roles.findIndex(role => actual.sha256 === mockPins.linkedCores[role].sha256);
      assert.notEqual(index, -1, 'only fully pinned mock graph modules');
      const input = inputs[index];
      return {
        GNU_SDK_DESCRIPTOR: settings.wrongModule === index ? descriptor(inputs[(index + 1) % 5]) : descriptor(input),
        GNU_SDK_LIMITS: limits,
        async runGnuSdkInventory(identity, deps) {
          assert.deepEqual(identity, input.identity);
          assert.equal(io.opened.size, 0);
          if (settings.failBefore === index) throw Object.assign(new Error('secretPayloadMember'), { code: settings.failureCode ?? 'E_HASH' });
          await deps.beforeDecode();
          const child = deps.spawn(decoder + '/ld-linux-x86-64.so.2', settings.wrongArg ? [...args, '--threads=2'] : [...args], options());
          await Promise.resolve(); assert.ok(child instanceof EventEmitter);
          if (settings.extraSpawn) deps.spawn(decoder + '/ld-linux-x86-64.so.2', [...args], options());
          if (settings.failAfter === index) throw Object.assign(new Error('secretPayloadMember'), { code: settings.failureCode ?? 'E_TAR' });
          await deps.afterDecode();
          const value = { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: false, archiveBytes: input.archiveBytes,
            archiveSha256: input.archiveSha256, archivePasses: 2, archiveDataBytes: input.archiveBytes * 2,
            archiveRequestedBytes: input.archiveBytes * 2 + 2, closeAttempts: 2, exitCode: 0, signal: null,
            stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true,
            extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false, rustReady: false, trainingReady: false,
            expandedBytes: settings.expandedBytes ?? 1024, streamEvents: 1, inventory: { entries: settings.entries ?? 2 } };
          if (settings.result) settings.result(value, index, state);
          state.coreValue = value;
          return value;
        },
      };
    },
  };
  return { config, state, accepted, calledRoles, imports, spawnCalls, io, collector };
}
const execute = async settings => {
  const f = fixture(settings), outcome = await mocked.runRegisteredRustComponentLayoutMock(f.config);
  return { ...f, outcome, data: JSON.parse(outcome.text) };
};
const expectCode = (fn, code) => assert.throws(fn, error => error.code === code);
const copy = value => JSON.parse(JSON.stringify(value));

test('literal receipt identities match all five immutable operation descriptors', () => {
  const receipt = JSON.parse(stored.get('rustReceipt'));
  assert.deepEqual(roles, ['cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview']);
  for (let index = 0; index < 5; index++) {
    const input = inputs[index], row = receipt.inputs[index];
    assert.equal(input.root, receipt.root); assert.equal(input.file, receipt.root + '/' + row.name);
    assert.equal(input.expectedRoot, row.name.slice(0, -7));
    assert.equal(input.archiveBytes, row.byteLength); assert.equal(input.archiveSha256, row.readbackSha256);
    assert.deepEqual(input.identity, { root: receipt.rootFinal, file: row.finalMetadata });
    assert.equal(input.identity.root.dev, '28'); assert.equal(input.identity.file.dev, '29');
    assert.ok(Object.isFrozen(input.identity.file));
  }
});
test('preview roles retain non-preview archive roots', () => {
  assert.match(inputs[3].expectedRoot, /^rustfmt-1/); assert.match(inputs[4].expectedRoot, /^clippy-1/);
  assert.ok(!inputs[3].expectedRoot.includes('preview')); assert.ok(!inputs[4].expectedRoot.includes('preview'));
});
test('raw captured graph pins have fixed lengths and independent digests', () => {
  assert.deepEqual(pin(stored.get('rawCore')), { bytes: 23261, sha256: 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29' });
  assert.deepEqual(pin(stored.get('rawTar')), { bytes: 15548, sha256: '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139' });
  assert.deepEqual(pin(stored.get('rustReceipt')), { bytes: 4012, sha256: 'c068579e97c9c01c707bae0cdffb082bf23d7f089bcd404a114d290e0476be87' });
  for (const [key] of source.rows) if (key !== 'collector') assert.deepEqual(pin(stored.get(key)), operation.RUST_LAYOUT_SOURCE_PINS[key]);
});
test('all role transformation stages have independently hardpinned variants', () => {
  const expected = [
    [[23275, '110dcdd97383fb76f68233110013cf3523c1b3cf5e98cf02defad9ff83bb988b'], [23277, '6624b9afc2118d5076e680b8abc9be5bf1237d1a6fb78b2a7c8e1a1cb24b0fc8'], [22520, 'b1ccc79cc2c222b23b0977b1bd40beebe34db42977a8294dda430b915b5268ef'], [22521, '34b2f9c0c17ce279c1bee10f8bcdc4cb2c1356c34fda39d3ccf2d78a6a13bcdb']],
    [[23275, 'f454d03eb05e38c6d6cbf35b0ac6e7d124fa35d67ce571e3809c2ec7a57e2920'], [23277, 'c69c365a709d20c8acb03763df98aeeb794a49ef458ffd5658aee4a01c67ac40'], [22520, '0d4009e537dfbf1d68207b54a4f20d88fd445c84503b79e69b33d0dd37804bf2'], [22521, '9337f4726a133b3924416f97e4614a80db24eba376a87cb0d7af0dae7f552935']],
    [[23278, '91daf6b52b5b6e584e853ab2a7ca4a28f71e33cae760d427b2d84cabf55b8774'], [23280, 'a38105ded2e84f2ba6fa85dab4846d50be880754e191c9b3bfcd457f3e1fa77e'], [22523, '9124f7230bace6a5ad472cbd4d444dcd2870bf5827e0cd08b00ada571b6b60f1'], [22524, '0c5e04dba9504071b9fc474a189448ef669c8e4f4c61ec86ba594c376591838a']],
    [[23276, 'f9d96eebdb7cd9ccb36842dd895e8cbe1df62c8f5c3d39117b85a68fa445b44b'], [23278, '49694ab9b884b7ab43c97f16b683a256f5d77748202f5f253dfde77bdddbdbae'], [22521, 'd5bb2b780709858b124b0f4f0b850684d09b4c47a3a4241374b1d1fb4208be38'], [22522, '31d73f69bc7ba36d0000ca8d413011b3d30ada226706848d6bdd132c628f11ae']],
    [[23275, '20f4b9a83e4d2aac41406b8ef5854fb22a05e3039211d320ade3920b1987080b'], [23277, '5658694ca65d2f146579ce3af8f817a3d0174babadeb508c05630c2634c95c62'], [22520, '3195aafe805d126cb58184222d30b20e990a9e75fca85132e927cb2dbdfbcecb'], [22521, '54b063b2fe9bd69bb0029171ddbcb1a16b10fb23f5e0d8b3a090a689591a5e02']],
  ];
  for (let index = 0; index < 5; index++) {
    assert.deepEqual(operation.RUST_LAYOUT_SOURCE_PINS.coreStages[roles[index]].map(p => [p.bytes, p.sha256]), expected[index]);
    assert.deepEqual(pin(source.transformCore(stored.get('rawCore'), roles[index])), { bytes: expected[index][3][0], sha256: expected[index][3][1] });
  }
});
for (const role of roles) test('fixed role transform preserves all lifecycle bodies: ' + role, () => {
  const transformed = source.transformCore(stored.get('rawCore'), role).toString();
  const original = stored.get('rawCore').toString();
  assert.equal(transformed.slice(transformed.indexOf('async function runInventory')).replace("'--memlimit-decompress=268435456'", "'--memlimit-decompress=16777216'"), original.slice(original.indexOf('async function runInventory')));
  assert.ok(transformed.includes('const selectors = Object.freeze([]);'));
  assert.equal(transformed.split('--memlimit-decompress=').length, 2);
  assert.ok(transformed.includes('cleanupMs: 3000'));
});
test('GNU profile stays at original 16 MiB and original budgets', () => {
  const original = stored.get('rawCore').toString();
  assert.ok(original.includes("'--memlimit-decompress=16777216'"));
  assert.ok(original.includes('maxTotalMs: 120_000')); assert.ok(original.includes('maxStreamEvents: 32_768'));
  assert.ok(!original.includes('--memlimit-decompress=268435456'));
});
test('core source rejects wrong old hash and unknown role', () => {
  const bytes = Buffer.from(stored.get('rawCore')); bytes[100] ^= 1;
  expectCode(() => source.transformCore(bytes, 'cargo'), 'E_SOURCE_PIN');
  expectCode(() => source.transformCore(stored.get('rawCore'), 'rustfmt'), 'E_INPUT');
});
test('counted string needles reject missing and duplicate matches', () => {
  expectCode(() => source.replaceOnce('none', 'needle', 'x'), 'E_SOURCE_PIN');
  expectCode(() => source.replaceOnce('needle needle', 'needle', 'x'), 'E_SOURCE_PIN');
  assert.equal(source.replaceOnce('needle', 'needle', '$&'), '$&');
});
test('counted exact block regex rejects duplicates and malformed descriptor blocks', () => {
  const pattern = /export const GNU_SDK_DESCRIPTOR = Object\.freeze\(\{\n(?:  [^\n]*\n)+\}\);/g;
  const block = stored.get('rawCore').toString().match(pattern)[0];
  expectCode(() => source.replaceOnce(block + '\n' + block, pattern, 'x'), 'E_SOURCE_PIN');
  expectCode(() => source.replaceOnce(block.replace('});', '];'), pattern, 'x'), 'E_SOURCE_PIN');
});
test('TAR intermediate and bodyOffset event transform are hardpinned', () => {
  let bytes = Buffer.from(stored.get('rawTar').toString().replace('maxExtensionBytes: 65_536', 'maxExtensionBytes: 4_194_304'));
  assert.deepEqual(pin(bytes), { bytes: 15551, sha256: 'b22db5d375d966016f5551b9161119079960d24f9611cf87d145893887575824' });
  bytes = Buffer.from(bytes.toString().replace("if (size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');", "if (size > 65_536 || size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');"));
  assert.deepEqual(pin(bytes), { bytes: 15568, sha256: '56cac49b3cfe51dbf2a7f7d1f4a0d877ae8773f940585ebea72740373689fae2' });
  assert.deepEqual(pin(source.transformTar(stored.get('rawTar'))), { bytes: 15595, sha256: 'bf8c7fcc56c26aa0618c014d74046dc29b79c09340728b27dd0363a758b9ef9a' });
});
test('TAR transform rejects mutated input without changing original bytes', () => {
  const bytes = Buffer.from(stored.get('rawTar')); bytes[0] ^= 1;
  expectCode(() => source.transformTar(bytes), 'E_SOURCE_PIN');
  assert.equal(hash(stored.get('rawTar')), '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139');
});
test('shared backing and proxy source bytes fail before transformation', () => {
  expectCode(() => source.transformCore(new Proxy(stored.get('rawCore'), {}), 'cargo'), 'E_SOURCE_PIN');
  const shared = Buffer.from(new SharedArrayBuffer(23261)); shared.set(stored.get('rawCore'));
  expectCode(() => source.transformCore(shared, 'cargo'), 'E_SOURCE_PIN');
});
test('same captured collector URI links every mock role with hardpinned outputs', () => {
  const tar = source.transformTar(stored.get('rawTar'));
  const linked = source.link(collectorBytes, 'tar-inventory', uri(tar));
  assert.deepEqual(pin(collectorBytes), mockPins.collector); assert.deepEqual(pin(linked), mockPins.linkedCollector);
  for (const role of roles) assert.deepEqual(pin(source.link(source.transformCore(stored.get('rawCore'), role), 'tar-inventory', uri(linked))), mockPins.linkedCores[role]);
});
test('source capture rejects oversized named metadata before opening or allocating', () => {
  const f = memoryFs({ namedStat: (_path, stat) => ({ ...stat, size: stat.size + 1n }) }), counts = source.captureCounts();
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_SOURCE_PIN');
  assert.equal(counts.allocations, 0); assert.equal(counts.openAttempts, 0); assert.equal(counts.readAttempts, 0);
});
test('source capture rejects oversized opened metadata before allocating or reading', () => {
  const f = memoryFs({ fdStat: (_fd, stat) => ({ ...stat, size: stat.size + 1n }) }), counts = source.captureCounts();
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_SOURCE_PIN');
  assert.equal(counts.allocations, 0); assert.equal(counts.readAttempts, 0); assert.equal(counts.closes, 1);
});
test('source capture requires EOF and positively closes on appended data', () => {
  const f = memoryFs({ read: ({ paths, path, bytes, offset, length, position }) => position === paths.get(path).length ? 1 : paths.get(path).copy(bytes, offset, position, position + length) });
  const counts = source.captureCounts();
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_LENGTH');
  assert.equal(counts.readAttempts, 2); assert.equal(counts.closes, 1); assert.equal(counts.completedCaptures, 0);
});
test('source capture rejects short reads without retry', () => {
  const f = memoryFs({ read: () => 3 }), counts = source.captureCounts();
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_LENGTH');
  assert.equal(counts.readAttempts, 1); assert.equal(counts.closes, 1);
});
test('source capture detects same-FD metadata rebinding and closes', () => {
  let calls = 0;
  const f = memoryFs({ fdStat: (_fd, stat) => ({ ...stat, ino: ++calls === 2 ? 999n : stat.ino }) }), counts = source.captureCounts();
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_BINDING');
  assert.equal(counts.closes, 1); assert.equal(counts.completedCaptures, 0);
});
test('source capture rejects root metadata drift', () => {
  let calls = 0;
  const f = memoryFs({ rootStat: () => ({ ...metadata(4096, true), ctimeNs: ++calls === 2 ? 21n : 20n }) }), counts = source.captureCounts();
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_BINDING');
  assert.equal(counts.closes, 1);
});
test('source capture rejects metadata accessors without invoking them', () => {
  let invoked = 0;
  const f = memoryFs({ fdStat: (_fd, stat) => Object.defineProperty(stat, 'ino', { get() { invoked++; return 3n; } }) });
  expectCode(() => source.captureSource('rawCore', f.api, source.captureCounts(), () => 0), 'E_METADATA');
  assert.equal(invoked, 0);
});
test('source close fault prevents hashing and completed capture accounting', () => {
  const f = memoryFs({ close: () => { throw new Error('secret'); } }), counts = source.captureCounts();
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_CLOSE');
  assert.equal(counts.closeAttempts, 1); assert.equal(counts.closes, 0); assert.equal(counts.completedCaptures, 0);
});
test('source capture uses no-follow nonblocking flags and one positive close', () => {
  const f = memoryFs(), counts = source.captureCounts();
  assert.deepEqual(source.captureSource('rawCore', f.api, counts, () => 0), stored.get('rawCore'));
  assert.equal(counts.peakOwnedFds, 1); assert.equal(counts.ownedFds, 0); assert.equal(counts.closes, 1);
  assert.equal(counts.fdChecks, 2); assert.equal(counts.namedChecks, 2); assert.equal(counts.rootChecks, 2);
  assert.equal(f.calls.find(row => row[0] === 'open')[2], 0x20000 | 0x800);
});
test('source capture enforces global FS attempt ceiling before IO', () => {
  const f = memoryFs(), counts = source.captureCounts(); counts.fsCalls = 4096;
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_LIMIT');
  assert.equal(f.calls.length, 0);
});
test('source capture enforces aggregate allocation ceiling before read', () => {
  const f = memoryFs(), counts = source.captureCounts(); counts.allocatedBytes = 1048570;
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_LIMIT');
  assert.equal(counts.allocations, 0); assert.equal(counts.readAttempts, 0); assert.equal(counts.closes, 1);
});
test('source whitelist rejects arbitrary paths without IO', () => {
  const f = memoryFs(); expectCode(() => source.captureSource('/proc/self/environ', f.api, source.captureCounts(), () => 0), 'E_SOURCE_PIN');
  assert.equal(f.calls.length, 0);
});
test('five sequential mock roles produce ten gates, fifty stage closes, ten archive closes', async () => {
  const f = await execute();
  assert.equal(f.outcome.exitCode, 0); assert.deepEqual(f.calledRoles, roles);
  assert.equal(f.data.status, 'MOCK_RUST_COMPONENT_LAYOUT'); assert.equal(f.data.mockOnly, true);
  assert.equal(f.data.realArchiveInspected, false); assert.equal(f.state.peak, 1);
  assert.equal(f.data.counts.stageChecks, 10); assert.equal(f.data.counts.preloadChecks, 10);
  assert.equal(f.data.counts.stageCloses, 50); assert.equal(f.data.counts.archiveCloseAttempts, 10);
  assert.equal(f.data.counts.archivePasses, 10); assert.equal(f.data.counts.completedCorePasses, 5);
  assert.equal(f.data.counts.spawnAttempts, 5); assert.equal(f.data.counts.spawnEvents, 5);
  assert.equal(f.data.counts.peakChildren, 1); assert.equal(f.data.counts.childCloses, 5);
  assert.equal(f.data.repoCapture.closes, 8); assert.equal(f.data.repoCapture.peakOwnedFds, 1);
  assert.equal(f.imports.length, 7); assert.equal(f.state.finished, 1); assert.equal(f.state.aborted, 0);
  assert.equal(f.data.counts.archiveDataBytes, 255545440); assert.ok(Object.isFrozen(f.outcome));
  assert.match(f.outcome.text, /\n$/); assert.doesNotMatch(f.outcome.text, /[^\x00-\x7f]/);
});
test('all decoder spawns use only the fixed 256 MiB Rust memory option', async () => {
  const f = await execute();
  for (const call of f.spawnCalls) {
    assert.deepEqual(call, [decoder + '/ld-linux-x86-64.so.2', [...args], options()]);
    assert.equal(call[1].filter(arg => arg.startsWith('--memlimit-decompress=')).length, 1);
  }
});
for (const failureCode of ['E_HASH', 'E_TAR', 'E_DECODER', 'E_PIPE', 'E_CLOSE']) test('fifth role ' + failureCode + ' aborts all accepted and pending data', async () => {
  const f = await execute({ failAfter: 4, failureCode });
  assert.equal(f.outcome.exitCode, 1); assert.equal(f.data.error, failureCode); assert.equal(f.state.aborted, 1);
  assert.equal(f.data.counts.completedCorePasses, 4); assert.equal(f.data.counts.archiveCloseAttempts, 8);
  assert.equal(f.data.candidateExecuted, null); assert.equal(f.data.role, 'clippy-preview');
  assert.deepEqual(f.accepted, []); assert.equal(f.state.pending, null); assert.equal(f.state.finished, 0);
  assert.equal(f.data.layout, undefined); assert.ok(f.outcome.text.length <= 65536);
  assert.doesNotMatch(f.outcome.text, /secretPayloadMember|manifestText|partialMembers|repoCredentials/);
});
test('fifth pre-spawn hash failure preserves completed counts but does not claim zero attempted bytes', async () => {
  const f = await execute({ failBefore: 4 });
  assert.equal(f.data.counts.spawnAttempts, 4); assert.equal(f.data.counts.completedCorePasses, 4);
  assert.equal(f.data.archiveAccountingComplete, false); assert.equal(f.data.candidateExecuted, null);
  assert.match(f.data.archiveCountersScope, /completed frozen-core results only/); assert.deepEqual(f.accepted, []);
});
test('missing child close cannot clear in-flight ownership or publish layout', async () => {
  const f = await execute({ noClose: true });
  assert.equal(f.outcome.exitCode, 1); assert.equal(f.data.counts.ownedChildren, 1);
  assert.equal(f.data.counts.spawnAttempts, 1); assert.equal(f.data.candidateExecuted, null); assert.deepEqual(f.accepted, []);
});
test('unexpected loader arguments stop before a process capability is called', async () => {
  const f = await execute({ wrongArg: true });
  assert.equal(f.data.error, 'E_SPAWN'); assert.equal(f.spawnCalls.length, 0);
  assert.equal(f.data.counts.spawnAttempts, 1); assert.equal(f.data.candidateExecuted, null);
});
test('wrong component module descriptor stops before any archive role', async () => {
  const f = await execute({ wrongModule: 3 });
  assert.equal(f.data.error, 'E_COMPONENT'); assert.equal(f.calledRoles.length, 0); assert.equal(f.spawnCalls.length, 0);
});
test('collector receipt mismatch stops before any input open', async () => {
  const changed = copy(inputs); changed[3].expectedRoot = changed[3].expectedRoot.replace('rustfmt', 'rustfmt-preview');
  const f = await execute({ collectorInputs: changed });
  assert.equal(f.data.error, 'E_RECEIPT'); assert.equal(f.calledRoles.length, 0); assert.equal(f.spawnCalls.length, 0);
});
test('positive stage close count must equal five on every completed gate', async () => {
  const f = await execute({ stageCloses: 4 });
  assert.equal(f.data.error, 'E_RECEIPT'); assert.equal(f.data.counts.stageChecks, 0); assert.equal(f.spawnCalls.length, 0);
});
test('after-decode preload failure stops first failed role and clears accepted data', async () => {
  const f = await execute({ preload: state => state.preload !== 10 });
  assert.equal(f.data.error, 'E_PRELOAD'); assert.equal(f.data.counts.stageChecks, 10);
  assert.equal(f.data.counts.preloadChecks, 9); assert.deepEqual(f.accepted, []); assert.equal(f.state.finished, 0);
});
test('stage latency consumes the same per-role deadline and aborts', async () => {
  const f = await execute({ stage: state => { state.time += 22500; } });
  assert.equal(f.data.error, 'E_DEADLINE'); assert.equal(f.data.counts.completedCorePasses, 0); assert.deepEqual(f.accepted, []);
});
test('source/link/import phase stops at ten seconds without resetting the outer clock', async () => {
  const f = await execute({ importLatency: 2000 });
  assert.equal(f.data.error, 'E_DEADLINE'); assert.equal(f.calledRoles.length, 0); assert.equal(f.imports.length, 5);
});
test('75000 ms remaining is inclusive before the fifth role', async () => {
  const f = await execute({ afterAccept: (count, state) => { if (count === 4) state.time = 225000; } });
  assert.equal(f.outcome.exitCode, 0); assert.equal(f.data.counts.completedCorePasses, 5);
});
test('74999 ms remaining stops before the fifth role without adding cleanup twice', async () => {
  const f = await execute({ afterAccept: (count, state) => { if (count === 4) state.time = 225001; } });
  assert.equal(f.data.error, 'E_DEADLINE'); assert.equal(f.calledRoles.length, 4); assert.equal(f.data.counts.spawnAttempts, 4);
  assert.deepEqual(f.accepted, []);
});
test('publication deadline failure clears the full five-role batch', async () => {
  const f = await execute({ finish: state => { state.time += 30000; return { partialMembers: ['secretPayloadMember'] }; } });
  assert.equal(f.data.error, 'E_DEADLINE'); assert.equal(f.data.counts.completedCorePasses, 5);
  assert.deepEqual(f.accepted, []); assert.equal(f.state.aborted, 1); assert.equal(f.data.layout, undefined);
  assert.doesNotMatch(f.outcome.text, /partialMembers|secretPayloadMember/);
});
test('post-serialization clock failure cannot leak a prebuilt success result', async () => {
  const f = await execute({ serializationDeadline: true });
  assert.equal(f.data.error, 'E_DEADLINE'); assert.equal(f.data.status, 'STOP'); assert.equal(f.data.layout, undefined);
  assert.deepEqual(f.accepted, []); assert.equal(f.data.realArchiveInspected, false);
});
test('batch decoded-byte ceiling aborts before the third role can be accepted', async () => {
  const f = await execute({ expandedBytes: 1073741824 });
  assert.equal(f.data.error, 'E_LIMIT'); assert.equal(f.data.counts.completedCorePasses, 2); assert.deepEqual(f.accepted, []);
});
test('batch entry ceiling aborts after exactly two maximum-entry roles', async () => {
  const f = await execute({ entries: 32768 });
  assert.equal(f.data.error, 'E_LIMIT'); assert.equal(f.data.counts.entries, 65536); assert.deepEqual(f.accepted, []);
});
test('per-role stream event ceiling rejects returned over-limit data', async () => {
  const f = await execute({ result: value => { value.streamEvents = 262145; } });
  assert.equal(f.data.error, 'E_LIMIT'); assert.equal(f.data.counts.completedCorePasses, 0); assert.deepEqual(f.accepted, []);
});
test('negative native qualification flags cannot become positive via core results', async () => {
  const f = await execute({ result: value => { value.nativeQualified = true; } });
  assert.equal(f.data.error, 'E_RECEIPT'); assert.equal(f.data.nativeQualified, false); assert.deepEqual(f.accepted, []);
});
test('a mock-labelled frozen-core result never qualifies as a live core result', async () => {
  const f = await execute({ result: value => { value.mockOnly = true; } });
  assert.equal(f.data.error, 'E_RECEIPT'); assert.equal(f.data.mockOnly, true); assert.equal(f.data.realArchiveInspected, false);
});
test('every public qualification flag remains false on successful mocks', async () => {
  const f = await execute();
  for (const key of ['archiveExtracted', 'filesInstalled', 'rustExecuted', 'pythonRuntimeInvoked', 'nativeQualified',
    'rustReady', 'trainingReady', 'dockerProviderQualified', 'hardRssBounded', 'hardDeadlineGuaranteed', 'processTreeBounded']) assert.equal(f.data[key], false);
});
test('nonfinite initial clock fails before repository IO', async () => {
  const f = await execute({ now: () => Infinity });
  assert.equal(f.data.error, 'E_CLOCK'); assert.equal(f.io.calls.length, 0); assert.equal(f.data.candidateExecuted, false);
});
test('backward outer clock stops before another role starts', async () => {
  const f = await execute({ afterAccept: (_count, state) => { state.time = -1; } });
  assert.equal(f.data.error, 'E_CLOCK'); assert.equal(f.calledRoles.length, 1); assert.deepEqual(f.accepted, []);
});
test('unknown failures expose no messages, stacks, getters or credential values', async () => {
  let called = 0;
  const f = await execute({ stage: () => { throw Object.defineProperty({}, 'code', { get() { called++; return 'repoCredentials'; } }); } });
  assert.equal(f.data.error, 'E_IO'); assert.equal(called, 0); assert.doesNotMatch(f.outcome.text, /repoCredentials|stack|secretPayloadMember/);
});
test('ASCII serializer preflights aggregate escaping before allocating escaped JSON', () => {
  assert.equal(source.asciiJson({ text: 'é😀\n' }, 64), '{"text":"\\u00e9\\ud83d\\ude00\\n"}\n');
  expectCode(() => source.asciiJson({ text: 'é'.repeat(1000) }, 2000), 'E_OUTPUT');
  expectCode(() => source.asciiJson({ text: 'a'.repeat(1000) }, 1000), 'E_OUTPUT');
});
test('ASCII serializer rejects getters, proxies, cycles and serialization hooks', () => {
  let called = 0;
  expectCode(() => source.asciiJson({ get member() { called++; return 'secret'; } }, 1000), 'E_OUTPUT');
  expectCode(() => source.asciiJson({ toJSON() { called++; return 'secret'; } }, 1000), 'E_OUTPUT');
  expectCode(() => source.asciiJson(new Proxy({}, {}), 1000), 'E_OUTPUT');
  const cycle = {}; cycle.self = cycle; expectCode(() => source.asciiJson(cycle, 1000), 'E_OUTPUT');
  assert.equal(called, 0);
});
test('oversized final escaped layout aborts and emits a bounded fixed-counter STOP', async () => {
  const f = await execute({ finish: () => ({ manifestText: 'é'.repeat(2800000) }) });
  assert.equal(f.data.error, 'E_OUTPUT'); assert.equal(f.state.aborted, 1); assert.deepEqual(f.accepted, []);
  assert.equal(f.data.layout, undefined); assert.ok(f.outcome.text.length <= 65536); assert.doesNotMatch(f.outcome.text, /manifestText/);
});
test('production entry rejects all overrides before touching repository or host inputs', async () => {
  const outcome = await operation.runRegisteredRustComponentLayout({ role: 'cargo', decoderRoot: '/host' });
  assert.equal(outcome.exitCode, 1); assert.equal(JSON.parse(outcome.text).error, 'E_INPUT');
  assert.equal(operation.runRegisteredRustComponentLayout.length, 0);
});
test('mock entry rejects paths, role replacement and caller-supplied source overrides', async () => {
  for (const extra of [{ role: 'cargo' }, { root: '/host' }, { source: new Map() }, { decoderRoot: '/host' }]) {
    const f = fixture(), outcome = await mocked.runRegisteredRustComponentLayoutMock({ ...f.config, ...extra });
    assert.equal(JSON.parse(outcome.text).error, 'E_INPUT'); assert.equal(f.io.calls.length, 0);
  }
});
test('production manifest requires all delivered collector and role link pins', () => {
  for (const key of ['collector', 'linkedCollector']) {
    assert.ok(operation.RUST_LAYOUT_SOURCE_PINS[key].bytes > 0);
    assert.match(operation.RUST_LAYOUT_SOURCE_PINS[key].sha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(Object.keys(operation.RUST_LAYOUT_SOURCE_PINS.linkedCores), roles);
});

function frozenCoreFixture(input, fault = null, tarBytes = Buffer.alloc(1024)) {
  const root = Object.fromEntries(Object.entries(input.identity.root).map(([key, value]) => [key, BigInt(value)]));
  const file = Object.fromEntries(Object.entries(input.identity.file).map(([key, value]) => [key, BigInt(value)]));
  const owned = new Map(), timers = new Map();
  const counters = { closes: 0, reads: 0, eof: 0, digests: 0, bytes: 0, child: 0, gates: 0, peakFds: 0 };
  let nextFd = 80, nextTimer = 1;
  const stat = path => path === input.root ? { ...root } : path === input.file ? { ...file } : assert.fail('unknown archive mock path');
  const deps = {
    fs: {
      lstatSync: path => stat(path),
      fstatSync: fd => stat(owned.get(fd)),
      openSync(path) { assert.ok(path === input.root || path === input.file); const fd = nextFd++; owned.set(fd, path); counters.peakFds = Math.max(counters.peakFds, owned.size); return fd; },
      closeSync(fd) { assert.ok(owned.has(fd)); owned.delete(fd); counters.closes++; if (fault === 'close') throw new Error('mock close fault'); },
      readSync(fd, bytes, offset, length, position) {
        assert.equal(owned.get(fd), input.file); counters.reads++;
        if (position === input.archiveBytes) { counters.eof++; return fault === 'eof' ? 1 : 0; }
        bytes.fill(0, offset, offset + length); counters.bytes += length; return length;
      },
    },
    hash() {
      return { update() {}, digest() { counters.digests++; return fault === 'hash' ? '0'.repeat(64) : input.archiveSha256; } };
    },
    now: () => 0,
    setTimeout(fn, ms) { assert.ok(ms === 42000 || ms <= 3000); const id = nextTimer++; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    beforeDecode() { counters.gates++; return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true }; },
    afterDecode() { counters.gates++; return { stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true }; },
    spawn(...parameters) {
      counters.child++; assert.deepEqual(parameters, [decoder + '/ld-linux-x86-64.so.2', [...args], options()]);
      const child = new EventEmitter(); child.stdin = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
      child.stdin.write = (_bytes, callback) => { queueMicrotask(() => callback()); return true; };
      child.stdin.end = () => queueMicrotask(() => {
        child.stdin.emit('finish');
        child.stdout.emit('data', tarBytes); child.stdout.emit('end'); child.stdout.emit('close');
        child.stderr.emit('end'); child.stderr.emit('close'); child.stdin.emit('close');
        child.emit('exit', 0, null); child.emit('close', 0, null);
      });
      child.kill = () => { queueMicrotask(() => child.emit('close', null, 'SIGKILL')); return true; };
      queueMicrotask(() => child.emit('spawn'));
      return child;
    },
  };
  return { deps, counters, owned, timers };
}
async function importFrozenMockCore(role) {
  const tar = source.transformTar(stored.get('rawTar'));
  const collector = source.pinned(source.link(collectorBytes, 'tar-inventory', uri(tar)), mockPins.linkedCollector);
  const bytes = source.pinned(source.link(source.transformCore(stored.get('rawCore'), role), 'tar-inventory', uri(collector)), mockPins.linkedCores[role]);
  return import(uri(bytes));
}
for (const input of inputs) test('actual frozen transformed core performs two hash/EOF passes with in-memory IO only: ' + input.role, async () => {
  const core = await importFrozenMockCore(input.role), f = frozenCoreFixture(input);
  const result = await core.runGnuSdkInventory(input.identity, f.deps);
  assert.equal(result.archivePasses, 2); assert.equal(result.archiveDataBytes, input.archiveBytes * 2);
  assert.equal(result.archiveRequestedBytes, input.archiveBytes * 2 + 2); assert.equal(result.closeAttempts, 2);
  assert.equal(f.counters.eof, 2); assert.equal(f.counters.digests, 2); assert.equal(f.counters.closes, 2);
  assert.equal(f.counters.child, 1); assert.equal(f.counters.gates, 2); assert.equal(f.counters.peakFds, 2);
  assert.equal(f.owned.size, 0); assert.equal(f.timers.size, 0); assert.equal(result.closeObserved, true);
  assert.equal(result.inventory.entries, 0); assert.deepEqual(result.selected, []);
});
test('actual frozen transformed core rejects a hash mismatch before the mock decoder spawn', async () => {
  const core = await importFrozenMockCore('cargo'), f = frozenCoreFixture(inputs[0], 'hash');
  await assert.rejects(core.runGnuSdkInventory(inputs[0].identity, f.deps), error => error.code === 'E_HASH');
  assert.equal(f.counters.eof, 1); assert.equal(f.counters.child, 0); assert.equal(f.counters.closes, 2); assert.equal(f.owned.size, 0);
});
test('actual frozen transformed core refuses archive EOF growth without reopening input', async () => {
  const core = await importFrozenMockCore('cargo'), f = frozenCoreFixture(inputs[0], 'eof');
  await assert.rejects(core.runGnuSdkInventory(inputs[0].identity, f.deps), error => error.code === 'E_LENGTH');
  assert.equal(f.counters.child, 0); assert.equal(f.counters.closes, 2); assert.equal(f.owned.size, 0);
});
test('actual frozen transformed core refuses a close fault after both completed decoder gates', async () => {
  const core = await importFrozenMockCore('cargo'), f = frozenCoreFixture(inputs[0], 'close');
  await assert.rejects(core.runGnuSdkInventory(inputs[0].identity, f.deps), error => error.code === 'E_CLOSE');
  assert.equal(f.counters.eof, 2); assert.equal(f.counters.gates, 2); assert.equal(f.counters.closes, 2); assert.equal(f.owned.size, 0);
});
test('nested readiness claims from a mock collector cannot reach publication', async () => {
  const f = await execute({ finish: () => ({ nested: { rustReady: true } }) });
  assert.equal(f.data.error, 'E_RECEIPT'); assert.equal(f.state.aborted, 1); assert.deepEqual(f.accepted, []); assert.equal(f.data.layout, undefined);
});
test('clock arithmetic that cannot represent the outer deadline fails before source capture', async () => {
  const f = await execute({ now: () => Number.MAX_VALUE });
  assert.equal(f.data.error, 'E_CLOCK'); assert.equal(f.io.calls.length, 0);
});
test('source capture reserves its final permitted FS attempt for positive close', () => {
  const f = memoryFs(), counts = source.captureCounts(); counts.fsCalls = 4088;
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_LIMIT');
  assert.equal(counts.fsCalls, 4096); assert.equal(counts.closes, 1); assert.equal(f.opened.size, 0);
});
test('repository hashing happens only after a positive source close', () => {
  let captured = null;
  const f = memoryFs({ read: ({ paths, path, bytes, offset, length, position }) => {
    captured = bytes; return paths.get(path).copy(bytes, offset, position, position + length);
  }, close: () => { captured[0] ^= 1; } }), counts = source.captureCounts();
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => 0), 'E_SOURCE_PIN');
  assert.equal(counts.closes, 1); assert.equal(counts.completedCaptures, 0);
});
test('a source-phase deadline after open still closes the owned repository FD', () => {
  const f = memoryFs(), counts = source.captureCounts();
  expectCode(() => source.captureSource('rawCore', f.api, counts, () => {
    if (f.opened.size) throw Object.assign(new Error(), { code: 'E_DEADLINE' });
    return 0;
  }), 'E_DEADLINE');
  assert.equal(counts.closes, 1); assert.equal(counts.allocations, 0); assert.equal(f.opened.size, 0);
});
test('source-phase time stays charged to the original outer deadline before role five', async () => {
  const f = await execute({ importLatency: 1000, afterAccept: (count, state) => { if (count === 4) state.time = 232000; } });
  assert.equal(f.data.error, 'E_DEADLINE'); assert.equal(f.data.counts.spawnAttempts, 4); assert.deepEqual(f.accepted, []);
});
test('a second spawn in one role stops even after the first mock child closes', async () => {
  const f = await execute({ extraSpawn: true });
  assert.equal(f.data.error, 'E_LIMIT'); assert.equal(f.data.counts.spawnAttempts, 2); assert.equal(f.spawnCalls.length, 1);
  assert.equal(f.data.counts.peakChildren, 1); assert.deepEqual(f.accepted, []);
});
test('source admission allows the exact remaining 512 KiB aggregate allocation boundary', () => {
  const f = memoryFs(), counts = source.captureCounts(); counts.allocatedBytes = 524288 - 23262;
  assert.deepEqual(source.captureSource('rawCore', f.api, counts, () => 0), stored.get('rawCore'));
  assert.equal(counts.allocatedBytes, 524288); assert.equal(counts.closes, 1);
});
test('same-object collector acceptance state must agree before publication', async () => {
  const f = await execute({ snapshot: (state, accepted) => ({ state: 'ACTIVE', mockOnly: false,
    acceptedRoles: accepted.length + (accepted.length === 5 ? 1 : 0), currentRole: state.pending,
    entries: state.acceptedEntries, expandedBytes: state.acceptedExpandedBytes, metadataBytes: 0, manifestBytes: 0, outputBytes: 0 }) });
  assert.equal(f.data.error, 'E_LAYOUT'); assert.equal(f.state.finished, 0); assert.equal(f.state.aborted, 1); assert.deepEqual(f.accepted, []);
});
test('approved collector failure diagnostics retain only fixed code, role and evidence scope', async () => {
  const f = await execute({ failAfter: 4, failureCode: 'E_TAR', diagnostic: {
    failureCode: 'E_LAYOUT_MANIFEST', failureRole: 'clippy-preview', path: 'secretPayloadMember', body: 'repoCredentials' } });
  assert.deepEqual(f.data.layoutFailure, { failureCode: 'E_LAYOUT_MANIFEST', failureRole: 'clippy-preview', scope: 'DATA_NOT_ACCEPTED_LAYOUT_EVIDENCE' });
  assert.doesNotMatch(f.outcome.text, /secretPayloadMember|repoCredentials/);
});
test('unapproved collector failure codes and non-enum roles never enter STOP output', async () => {
  for (const diagnostic of [{ failureCode: 'repoCredentials', failureRole: 'cargo' },
    { failureCode: 'E_LAYOUT_EVENT', failureRole: 'secretPayloadMember' }]) {
    const f = await execute({ failAfter: 4, diagnostic });
    assert.equal(f.data.layoutFailure, undefined); assert.doesNotMatch(f.outcome.text, /secretPayloadMember|repoCredentials/);
  }
});
test('collector failure diagnostic accessors are never invoked', async () => {
  let invoked = 0;
  const f = await execute({ failAfter: 4, snapshot: (state, accepted) => Object.defineProperties({
    state: 'ACTIVE', mockOnly: false, acceptedRoles: accepted.length, currentRole: state.pending,
    entries: state.acceptedEntries, expandedBytes: state.acceptedExpandedBytes, metadataBytes: 0, manifestBytes: 0, outputBytes: 0,
  }, { failureCode: { get() { invoked++; return 'E_LAYOUT_EVENT'; } }, failureRole: { value: 'clippy-preview' } }) });
  assert.equal(f.data.layoutFailure, undefined); assert.equal(invoked, 0);
});
test('successful mocks cannot claim candidate native execution or publish failure diagnostics', async () => {
  const f = await execute();
  assert.equal(f.data.candidateExecuted, null); assert.equal(f.data.mockOnly, true); assert.equal(f.data.layoutFailure, undefined);
});

async function deliveredGraphFixture() {
  const f = fixture();
  const bytes = source.pinned(readFileSync(new URL('./rust-component-layout.mjs', import.meta.url)), operation.RUST_LAYOUT_SOURCE_PINS.collector);
  f.io.paths.set(repo + '/tooling/native-ingress/rust-component-layout.mjs', bytes);
  const repository = f.config.fs, importMock = f.config.moduleImporter;
  let active = null, collector = null;
  const cores = [];
  f.config.fs = {
    lstatSync(path, ...parameters) { return path.startsWith(repo + '/') || path === repo ? repository.lstatSync(path, ...parameters) : active.deps.fs.lstatSync(path, ...parameters); },
    openSync(path, ...parameters) { return path.startsWith(repo + '/') || path === repo ? repository.openSync(path, ...parameters) : active.deps.fs.openSync(path, ...parameters); },
    fstatSync(fd, ...parameters) { return f.io.opened.has(fd) ? repository.fstatSync(fd, ...parameters) : active.deps.fs.fstatSync(fd, ...parameters); },
    readSync(fd, ...parameters) { return f.io.opened.has(fd) ? repository.readSync(fd, ...parameters) : active.deps.fs.readSync(fd, ...parameters); },
    closeSync(fd) { return f.io.opened.has(fd) ? repository.closeSync(fd) : active.deps.fs.closeSync(fd); },
  };
  f.config.spawn = (...parameters) => active.deps.spawn(...parameters);
  f.config.moduleImporter = async target => {
    assert.equal(f.io.opened.size, 0);
    const bytes = fromUri(target), actual = pin(bytes);
    if (actual.sha256 === operation.RUST_LAYOUT_SOURCE_PINS.linkedCollector.sha256) {
      assert.deepEqual(actual, operation.RUST_LAYOUT_SOURCE_PINS.linkedCollector);
      collector = await import(target);
      return collector;
    }
    if (actual.sha256 === operation.RUST_LAYOUT_SOURCE_PINS.linkedStage.sha256) return importMock(target);
    const index = roles.findIndex(role => actual.sha256 === operation.RUST_LAYOUT_SOURCE_PINS.linkedCores[role].sha256);
    assert.notEqual(index, -1); assert.deepEqual(actual, operation.RUST_LAYOUT_SOURCE_PINS.linkedCores[roles[index]]);
    const core = await import(target);
    return { ...core, async runGnuSdkInventory(identity, deps) {
      active = frozenCoreFixture(inputs[index], null, layoutTar(inputs[index]));
      const current = active;
      try {
        const value = await core.runGnuSdkInventory(identity, { ...current.deps, ...deps,
          hash: current.deps.hash, setTimeout: current.deps.setTimeout, clearTimeout: current.deps.clearTimeout });
        cores.push(current); return value;
      } finally { active = null; }
    } };
  };
  return { ...f, cores, snapshot: () => collector.snapshotLayout() };
}

function layoutTar(input) {
  const member = (path, content, directory = false) => {
    const body = Buffer.from(content), header = Buffer.alloc(512);
    const octal = (number, offset, width) => header.write(number.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
    header.write(path, 0, 100, 'utf8'); octal(directory ? 0o755 : 0o644, 100, 8);
    octal(1000, 108, 8); octal(1000, 116, 8); octal(body.length, 124, 12); octal(0, 136, 12);
    header.fill(32, 148, 156); header[156] = directory ? 53 : 48;
    header.write('ustar\0', 257, 6, 'ascii'); header.write('00', 263, 2, 'ascii');
    const sum = header.reduce((total, byte) => total + byte, 0);
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
    return Buffer.concat([header, body, Buffer.alloc((512 - body.length % 512) % 512)]);
  };
  return Buffer.concat([member(input.expectedRoot, '', true), member(input.expectedRoot + '/components', input.role + '\n'),
    member(input.expectedRoot + '/manifest.in', 'dir:lib\nfile:bin/' + input.role + '\nunknown-é😀\n'),
    member(input.expectedRoot + '/bin/mock', 'DATA'), Buffer.alloc(1024)]);
}

test('delivered collector and all five fully linked production variants have independent fixed pins', () => {
  const bytes = readFileSync(new URL('./rust-component-layout.mjs', import.meta.url));
  assert.deepEqual(pin(bytes), { bytes: 30039, sha256: 'c1f84c8141ee2ea5019e1df299c53ee41ca83f83f27275750f7a82fe7be2e162' });
  const tar = source.transformTar(stored.get('rawTar'));
  const linked = source.link(bytes, 'tar-inventory', uri(tar));
  assert.deepEqual(pin(linked), { bytes: 50844, sha256: '25660c7d5df166b909b6128a76c70c0714f5f4f23273b613f934e583877a0ee9' });
  assert.deepEqual(pin(linked), operation.RUST_LAYOUT_SOURCE_PINS.linkedCollector);
  const expected = [
    [90322, 'ba235bdf200bc270f0c7d95bd9f6341f7237303c663336b7baebf480b2b749fc'],
    [90322, 'd97fcc85bb657eb29ccc1338563a43c66ded2583309096650c3344d34a071257'],
    [90325, '4794ac95f3a9772bc84e228ad8a05c81daf3380b3a930835b26c000e47a14d37'],
    [90323, 'acddb2185c9a62a2122d7211932470e2503fe1172394e181b871698c418a162f'],
    [90322, 'e548f24984d73545f532198fdc5d09457a00041f33e16a610a31ff7dd175e3b3'],
  ];
  for (let index = 0; index < 5; index++) {
    const pipeline = source.link(source.transformCore(stored.get('rawCore'), roles[index]), 'tar-inventory', uri(linked));
    assert.deepEqual(pin(pipeline), { bytes: expected[index][0], sha256: expected[index][1] });
    assert.deepEqual(pin(pipeline), operation.RUST_LAYOUT_SOURCE_PINS.linkedCores[roles[index]]);
  }
});
test('delivered same-URI collector and all frozen cores complete a data-only batch using synthetic bytes and fake capabilities', async () => {
  const f = await deliveredGraphFixture(), outcome = await operation.runRegisteredRustComponentLayoutMock(f.config);
  const data = JSON.parse(outcome.text);
  assert.equal(outcome.exitCode, 0, outcome.text);
  assert.equal(data.status, 'MOCK_RUST_COMPONENT_LAYOUT'); assert.equal(data.mockOnly, true);
  assert.equal(data.realArchiveInspected, false); assert.equal(data.candidateExecuted, null);
  assert.equal(data.counts.completedCorePasses, 5); assert.equal(data.counts.archivePasses, 10);
  assert.equal(data.counts.stageChecks, 10); assert.equal(data.counts.preloadChecks, 10);
  assert.equal(data.counts.stageCloses, 50); assert.equal(data.counts.archiveCloseAttempts, 10);
  assert.equal(data.counts.spawnAttempts, 5); assert.equal(data.counts.spawnEvents, 5); assert.equal(data.counts.peakChildren, 1);
  assert.equal(data.repoCapture.completedCaptures, 8); assert.equal(data.repoCapture.closes, 8); assert.equal(data.repoCapture.peakOwnedFds, 1);
  assert.equal(data.layout.state, 'RUST_COMPONENT_LAYOUT_DATA'); assert.equal(data.layout.entries, 20);
  assert.equal(data.layout.expandedBytes, 23040); assert.equal(data.layout.unknownManifestLines, 5);
  assert.equal(data.layout.collisions.length, 1); assert.equal(data.layout.collisions[0].destination, 'lib');
  assert.equal(data.layout.collisions[0].repeatedDirectoryOnly, true); assert.equal(data.layout.collisions[0].conflict, false);
  for (let index = 0; index < 5; index++) {
    const role = data.layout.roles[index]; assert.equal(role.role, roles[index]); assert.equal(role.members.length, 4);
    assert.equal(role.decodedSha256, hash(layoutTar(inputs[index])));
    assert.equal(role.members[3].bodySha256, hash(Buffer.from('DATA')));
    const manifest = role.texts.find(value => value.kind === 'manifest');
    assert.equal(manifest.text, 'dir:lib\nfile:bin/' + roles[index] + '\nunknown-é😀\n');
    assert.equal(manifest.lines.length, 3); assert.equal(manifest.lines[2].text, 'unknown-é😀');
    assert.equal(f.cores[index].counters.eof, 2); assert.equal(f.cores[index].counters.digests, 2);
    assert.equal(f.cores[index].counters.closes, 2); assert.equal(f.cores[index].owned.size, 0);
  }
  const snapshot = f.snapshot();
  assert.equal(snapshot.state, 'FINISHED'); assert.equal(snapshot.acceptedRoles, 0); assert.equal(snapshot.currentRole, null);
  assert.equal(snapshot.failureCode, null); assert.equal(snapshot.failureRole, null);
  assert.equal(data.layoutFailure, undefined); assert.ok(Object.isFrozen(outcome));
  assert.doesNotMatch(outcome.text, /[^\x00-\x7f]/); assert.ok(outcome.text.endsWith('\n'));
});
test('final ASCII publication counts wrapper and envelope beyond an individually valid 16 MiB layout', async () => {
  const shell = { profile: 'RUST_COMPONENT_LAYOUT_DATA', state: 'RUST_COMPONENT_LAYOUT_DATA', mockOnly: false,
    roles: roles.map(role => ({ role })), entries: 10, expandedBytes: 5120, rustReady: false, nativeQualified: false, manifestText: '' };
  const emptyBytes = source.asciiJson(shell, 16777216).length;
  const manifestText = 'é'.repeat(Math.floor((16777216 - emptyBytes) / 6));
  const individuallyBounded = source.asciiJson({ ...shell, manifestText }, 16777216);
  assert.ok(individuallyBounded.length <= 16777216); assert.ok(individuallyBounded.length >= 16777211);
  const f = await execute({ finish: () => ({ manifestText }) });
  assert.equal(f.data.error, 'E_OUTPUT'); assert.equal(f.data.counts.completedCorePasses, 5);
  assert.equal(f.data.status, 'STOP'); assert.equal(f.data.layout, undefined); assert.equal(f.data.realArchiveInspected, false);
  assert.equal(f.state.aborted, 1); assert.equal(f.state.acceptedEntries, 0); assert.deepEqual(f.accepted, []);
  assert.ok(f.outcome.text.length <= 65536); assert.doesNotMatch(f.outcome.text, /manifestText/);
});
test('fifth-role late collector acceptance failure withholds every accepted role after all ten gates', async () => {
  const f = await execute({ failAccept: 5, diagnostic: { failureCode: 'E_LAYOUT_CORE', failureRole: 'clippy-preview' } });
  assert.equal(f.data.error, 'E_LAYOUT_CORE'); assert.equal(f.data.counts.completedCorePasses, 5);
  assert.equal(f.data.counts.stageChecks, 10); assert.equal(f.data.counts.preloadChecks, 10);
  assert.equal(f.data.counts.stageCloses, 50); assert.equal(f.data.counts.archiveCloseAttempts, 10);
  assert.equal(f.data.counts.spawnEvents, 5); assert.equal(f.state.finished, 0); assert.equal(f.state.aborted, 1);
  assert.deepEqual(f.accepted, []); assert.equal(f.state.pending, null); assert.equal(f.state.acceptedEntries, 0);
  assert.equal(f.data.layout, undefined); assert.equal(f.data.status, 'STOP');
  assert.deepEqual(f.data.layoutFailure, { failureCode: 'E_LAYOUT_CORE', failureRole: 'clippy-preview', scope: 'DATA_NOT_ACCEPTED_LAYOUT_EVIDENCE' });
  assert.doesNotMatch(f.outcome.text, /secretPayloadMember/);
});
test('late fifth-role archive-close accounting mismatch blocks helper finish despite ten complete stage gates', async () => {
  const f = await execute({ result: (value, index) => { if (index === 4) value.closeAttempts = 1; } });
  assert.equal(f.data.error, 'E_RECEIPT'); assert.equal(f.data.counts.stageChecks, 10); assert.equal(f.data.counts.stageCloses, 50);
  assert.equal(f.data.counts.completedCorePasses, 4); assert.equal(f.data.counts.archiveCloseAttempts, 8);
  assert.equal(f.state.finished, 0); assert.deepEqual(f.accepted, []); assert.equal(f.data.layout, undefined);
});
test('ASCII publication budgeting treats the terminal LF as exactly one additional byte', () => {
  assert.equal(source.asciiJson('a', 4), '"a"\n');
  expectCode(() => source.asciiJson('a', 3), 'E_OUTPUT');
});

test('complete publication accepts exactly 16 MiB including LF and rejects one byte more', async () => {
  const maximum = 16777216;
  const empty = await execute({ finish: () => ({ manifestText: '' }) });
  assert.equal(empty.outcome.exitCode, 0);
  const amount = maximum - empty.outcome.text.length;
  const exact = await execute({ finish: () => ({ manifestText: 'a'.repeat(amount) }) });
  assert.equal(exact.outcome.exitCode, 0);
  assert.equal(exact.outcome.text.length, maximum);
  assert.ok(exact.outcome.text.endsWith('\n'));
  const overflow = await execute({ finish: () => ({ manifestText: 'a'.repeat(amount + 1) }) });
  assert.equal(overflow.outcome.exitCode, 1);
  assert.equal(overflow.data.error, 'E_OUTPUT');
  assert.equal(overflow.data.layout, undefined);
  assert.equal(overflow.state.aborted, 1);
  assert.ok(overflow.outcome.text.length <= 65536);
});
