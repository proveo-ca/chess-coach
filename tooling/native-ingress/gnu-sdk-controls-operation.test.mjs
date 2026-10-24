// SPEC: _spec/tooling/native-ingress/gnu-sdk-controls.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  SDK_CONTROLS, SDK_CONTROL_EXPECTATION, SDK_CONTROL_LIMITS, createControlInspectionFixture,
} from './sdk-control-inspection.mjs';
import {
  SDK_CONTROLS_SOURCE_PINS, transformSdkControlsCoreSource, runRegisteredGnuSdkControls,
} from './gnu-sdk-controls-operation.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const read = name => fs.readFileSync(new URL('./' + name + '.mjs', import.meta.url));
const names = ['tar-inventory', 'elf-metadata', 'xz-staging', 'gnu-sdk-inventory', 'gnu-sdk-inventory-v2-operation', 'gnu-sdk-inventory-v4-operation', 'sdk-control-inspection'];
const captured = new Map(names.map(name => [name, read(name)]));
const source = read('gnu-sdk-controls-operation').toString('utf8');
const controlSource = captured.get('sdk-control-inspection').toString('utf8');
const link = (bytes, dependency, dependencyUri) => Buffer.from(bytes.toString().replace("from './" + dependency + ".mjs'", "from '" + dependencyUri + "'"));
const [v2, v4] = await Promise.all([import(uri(captured.get('gnu-sdk-inventory-v2-operation'))), import(uri(captured.get('gnu-sdk-inventory-v4-operation')))]);
const tarSource = v4.transformTarInventoryV4Source(captured.get('tar-inventory'));
const tar = await import(uri(tarSource));
const streamCore = v2.transformSdkInventoryV2Source(captured.get('gnu-sdk-inventory'));
const controlsCore = transformSdkControlsCoreSource(streamCore);
const linkedInspection = link(captured.get('sdk-control-inspection'), 'tar-inventory', uri(tarSource));
const inspectionUri = uri(linkedInspection);
const linkedPipeline = link(controlsCore, 'tar-inventory', inspectionUri);
const linkedModule = await import(inspectionUri);
const root = 'x86-64--glibc--stable-2026.08-1';
const receipts = new Map(['xz-qualification', 'gnu-sdk-inventory-v4'].map(name =>
  [name, fs.readFileSync(new URL('../../_spec/tooling/native-ingress/' + name + '.receipt.json', import.meta.url))]));
const turns = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

function header(path, size = 0, type = '0', target = '') {
  const bytes = Buffer.alloc(512); bytes.write(path, 0, 100, 'utf8');
  for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, size], [136, 12, 0]]) {
    bytes.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  }
  bytes[156] = type.charCodeAt(0); bytes.write(target, 157, 100, 'utf8');
  bytes.write('ustar\0', 257, 6, 'ascii'); bytes.write('00', 263, 2, 'ascii'); bytes.fill(32, 148, 156);
  const sum = bytes.reduce((total, byte) => total + byte, 0);
  bytes.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii'); return bytes;
}
const member = (path, body = Buffer.alloc(0), type = '0', target = '') => Buffer.concat([
  header(path, body.length, type, target), body, Buffer.alloc((512 - body.length % 512) % 512),
]);
function elfFixture(size = 14704) {
  const bytes = Buffer.alloc(size); bytes.set([0x7f, 69, 76, 70, 2, 1, 1]);
  bytes.writeUInt16LE(2, 16); bytes.writeUInt16LE(62, 18); bytes.writeUInt32LE(1, 20);
  bytes.writeBigUInt64LE(64n, 32); bytes.writeUInt16LE(64, 52); bytes.writeUInt16LE(56, 54); return bytes;
}
function pieces(bytes, count = 1, cuts = null) {
  const offsets = [0, ...(cuts ?? Array.from({ length: count - 1 }, (_, i) => Math.floor(bytes.length * (i + 1) / count))), bytes.length];
  return offsets.slice(1).map((end, i) => bytes.subarray(offsets[i], end));
}
const metricKeys = Object.keys(SDK_CONTROL_EXPECTATION);
function fixture(options = {}) {
  const wrapper = options.wrapper ?? elfFixture(), script = options.script ?? Buffer.alloc(1383, 35);
  const extra = options.extra ?? [];
  const members = [member(SDK_CONTROLS[0].path, wrapper)];
  if (!options.missingScript) members.push(options.linkScript ? member(SDK_CONTROLS[1].path, Buffer.alloc(0), '2', 'outside') : member(SDK_CONTROLS[1].path, script));
  members.push(...extra);
  const bytes = Buffer.concat([...members, Buffer.alloc(1024)]), feeds = options.feeds ?? 1;
  assert.ok(bytes.length < 1048576);
  const parser = tar.createTarInventory();
  for (const chunk of pieces(bytes, feeds)) parser.feed(chunk);
  const summary = parser.finish();
  const expectedSummary = Object.fromEntries(metricKeys.map(key => [key, summary[key]]));
  const profile = { expectedSummary: { ...expectedSummary, ...options.expected },
    controls: options.controls ?? [{ index: 1, size: wrapper.length }, { index: 2, size: script.length }], limits: options.limits ?? {} };
  const api = linkedModule.createControlInspectionFixture(profile);
  return { bytes, wrapper, script, feeds, profile, api };
}
function coreReceipt(inventory, extra = {}) {
  return { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: true, inventory, archivePasses: 2, closeAttempts: 2,
    stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true, exitCode: 0, signal: null,
    extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false, ...extra };
}
function memberPass(f, cuts = null) {
  f.api.beginMemberPass(); const parser = f.api.createTarInventory({ maxHeaders: 32768 });
  for (const chunk of pieces(f.bytes, f.feeds, cuts)) parser.feed(chunk);
  return parser.finish();
}
function acceptFirst(f, cuts = null) { const result = memberPass(f, cuts); return f.api.acceptMemberPass(coreReceipt(result)); }
function capturePass(f, bytes = f.bytes, cuts = null) {
  f.api.beginCapturePass(); const parser = f.api.createTarInventory({ maxHeaders: 32768 });
  for (const chunk of pieces(bytes, f.feeds, cuts)) parser.feed(chunk);
  return parser.finish();
}
function acceptSecond(f, bytes = f.bytes, cuts = null) {
  const result = capturePass(f, bytes, cuts); f.api.acceptCapturePass(coreReceipt(result)); return f.api.getCapturedControls();
}

let mockId = 0;
async function fixtureGraph(f) {
  const key = '__sdkControlsFixture' + ++mockId;
  globalThis[key] = { api: f.api, SDK_CONTROLS, SDK_CONTROL_EXPECTATION };
  const adapterSource = `const d = globalThis[${JSON.stringify(key)}]; const a = d.api;
    export const SDK_CONTROLS = d.SDK_CONTROLS; export const SDK_CONTROL_EXPECTATION = d.SDK_CONTROL_EXPECTATION;
    export const beginMemberPass = () => a.beginMemberPass(); export const createTarInventory = x => a.createTarInventory(x);
    export const acceptMemberPass = x => a.acceptMemberPass(x); export const beginCapturePass = () => a.beginCapturePass();
    export const acceptCapturePass = x => a.acceptCapturePass(x); export const getCapturedControls = () => a.getCapturedControls();
    export const snapshotControlInspection = () => a.snapshot(); export const abortControlInspection = () => a.abortInspection();`;
  const adapterUri = uri(adapterSource);
  try {
    const [pipeline, adapter] = await Promise.all([import(uri(link(controlsCore, 'tar-inventory', adapterUri))), import(adapterUri)]);
    return { pipeline, adapter, adapterUri };
  } finally { delete globalThis[key]; }
}
async function spanFixture(transform) {
  const f = fixture(), parser = tar.createTarMemberInventory(); parser.feed(f.bytes);
  const original = parser.finish(), summary = { ...original, fileSpans: original.fileSpans.map(span => ({ ...span })) };
  transform(summary.fileSpans);
  const key = '__sdkControlSpans' + ++mockId;
  globalThis[key] = summary;
  const fakeTarUri = uri(`const result = globalThis[${JSON.stringify(key)}];
    export function createTarMemberInventory() { return Object.freeze({ feed: () => Object.freeze([]), finish: () => result }); }
    export function createTarInventory() { throw new Error('unused fixture factory'); }`);
  try {
    const module = await import(uri(link(captured.get('sdk-control-inspection'), 'tar-inventory', fakeTarUri)));
    const api = module.createControlInspectionFixture(f.profile);
    api.beginMemberPass(); const reader = api.createTarInventory(); reader.feed(f.bytes);
    const pending = reader.finish();
    return { api, pending, summary };
  } finally { delete globalThis[key]; }
}
function ioHarness(graph, options = {}) {
  const input = Buffer.from('0123456789');
  const stats = {
    root: { dev: 11n, ino: 101n, mode: 0o40700n, uid: 1000n, gid: 1000n, nlink: 2n, size: 4096n, mtimeNs: 100n, ctimeNs: 101n },
    file: { dev: 22n, ino: 202n, mode: 0o100600n, uid: 1000n, gid: 1000n, nlink: 1n, size: 10n, mtimeNs: 200n, ctimeNs: 201n },
  };
  const expected = Object.fromEntries(Object.entries(stats).map(([kind, value]) => [kind, Object.fromEntries(Object.entries(value).map(([key, value]) => [key, String(value)]))]));
  const log = { reads: [], closes: [], spawns: [], writes: [], kills: [], listenerCounts: [] };
  let pass = 0, child;
  const kind = path => path === graph.pipeline.GNU_SDK_DESCRIPTOR.root ? 'root' : path === graph.pipeline.GNU_SDK_DESCRIPTOR.file ? 'file' : assert.fail('unexpected path');
  const io = {
    lstatSync: path => ({ ...stats[kind(path)] }), fstatSync: fd => ({ ...stats[fd === 41 ? 'root' : 'file'] }),
    openSync: path => kind(path) === 'root' ? 41 : 42,
    readSync(fd, buffer, offset, length, position) { assert.equal(fd, 42); log.reads.push([pass, position, length]); return input.copy(buffer, offset, position, position + length); },
    closeSync(fd) { log.closes.push([pass, fd]); if (pass === options.closeFailure && fd === 42) throw new Error('mock close'); },
  };
  function spawn(...args) {
    log.spawns.push(args); child = new EventEmitter();
    for (const name of ['stdin', 'stdout', 'stderr']) child[name] = new EventEmitter();
    child.stdout.on('newListener', name => { if (name === 'data') log.listenerCounts.push(child.stdout.listenerCount('data')); });
    child.stdin.write = (bytes, callback) => { log.writes.push(Buffer.from(bytes)); queueMicrotask(callback); return true; };
    child.kill = signal => { log.kills.push(signal); queueMicrotask(() => child.emit('close', null, signal)); };
    child.stdin.end = () => {
      child.stdin.emit('finish');
      for (const chunk of options.output(pass)) child.stdout.emit('data', chunk);
      if (log.kills.length) return;
      child.stdout.emit('end'); if (log.kills.length) return;
      child.stderr.emit('end'); child.stdout.emit('close'); child.stderr.emit('close');
      child.emit('exit', 0, null); child.emit('close', 0, null); child.stdin.emit('close');
    };
    assert.equal(child.stdout.listenerCount('data'), 0);
    queueMicrotask(() => options.spawnFailure === pass ? child.emit('error', new Error('mock spawn')) : child.emit('spawn'));
    return child;
  }
  async function run(deps = {}) {
    pass++;
    const runner = graph.pipeline.createSdkInventoryFixtureRunner({ archiveBytes: 10, archiveSha256: sha(input) }, {
      fs: io, spawn, now: options.now ?? (() => 0), beforeDecode: () => ({ stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true }),
      afterDecode: () => ({ stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true }), ...deps,
    });
    return runner(expected);
  }
  return { run, spawn, log, get child() { return child; } };
}

async function mockOperation(options = {}) {
  const f = fixture(options.fixture), graph = await fixtureGraph(f);
  const clock = { value: 0 }, h = ioHarness(graph, { ...options, now: () => clock.value,
    output: pass => pieces(pass === 2 && options.changedSecond ? options.changedSecond(f.bytes) : f.bytes) });
  const log = { reads: [], stages: [], preloads: 0, calls: 0 };
  const key = '__sdkControlsOperation' + ++mockId;
  let nowCalls = 0;
  const context = {
    now: () => ++nowCalls > 1 && options.preflightExpired ? 10000 : clock.value,
    fs: { readFileSync(path) {
      log.reads.push(path); if (options.readFailure) throw new Error('mock source read');
      for (const [name, bytes] of receipts) if (path.endsWith('/' + name + '.receipt.json')) return options.receiptFailure ? Buffer.from('invalid') : bytes;
      const name = path.slice('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/'.length, -4);
      assert.ok(captured.has(name)); return options.corrupt === name ? Buffer.from('corrupt') : captured.get(name);
    } },
    spawn: h.spawn,
    verifyStagedXzImages(value) { log.stages.push(value); if (options.stageFailure) throw new Error('mock stage'); return { counters: { fsCalls: 10, readBytes: 100, closeAttempts: 5 } }; },
    assertNoSystemPreload() { log.preloads++; return !options.preloadFailure; },
    async runGnuSdkInventory(identity, deps) {
      assert.equal(identity.file.size, '102296280'); log.calls++;
      const result = await h.run(deps);
      if (options.insufficientBudget && log.calls === 1) clock.value = 130001;
      if (options.expireAfterSecond && log.calls === 2) clock.value = 250000;
      if (options.thirdSpawn && log.calls === 2) deps.spawn('mock-only');
      return result;
    },
  };
  globalThis[key] = context;
  const dependencyUri = uri(`const d = globalThis[${JSON.stringify(key)}]; export default d.fs;
    export const spawn = d.spawn; export const fixtureNow = d.now; export const verifyStagedXzImages = d.verifyStagedXzImages;
    export const assertNoSystemPreload = d.assertNoSystemPreload; export const runGnuSdkInventory = d.runGnuSdkInventory;`);
  let mocked = source.replace("from 'node:fs'", "from '" + dependencyUri + "'")
    .replace("from 'node:child_process'", "from '" + dependencyUri + "'")
    .replaceAll('performance.now()', 'fixtureNow()')
    .replace('import(uri(stageSource))', 'import(' + JSON.stringify(dependencyUri) + ')')
    .replace('import(uri(pipelineSource))', 'import(' + JSON.stringify(dependencyUri) + ')')
    .replace('import(inspectionUri)', 'import(' + JSON.stringify(graph.adapterUri) + ')');
  mocked = `import { fixtureNow } from '${dependencyUri}';\n` + mocked;
  if (!options.productionGuards) {
    for (const [from, to] of [["value.mockOnly !== false", "value.mockOnly !== true"], ['value.archiveBytes !== 102296280', 'value.archiveBytes !== 10'],
      ["value.archiveSha256 !== 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3'", "value.archiveSha256 !== '" + sha(Buffer.from('0123456789')) + "'"],
      ['value.archiveDataBytes !== 204592560', 'value.archiveDataBytes !== 20'], ['value.archiveRequestedBytes !== 204592562', 'value.archiveRequestedBytes !== 22'],
      ['counts.archiveDataBytes !== 409185120', 'counts.archiveDataBytes !== 40'], ['counts.archiveRequestedBytes !== 409185124', 'counts.archiveRequestedBytes !== 44'],
      ["profile: 'registered-gnu-sdk-controls-v1'", "profile: 'mock-sdk-controls-fixture'"], ['realArchiveInspected: error === null', 'realArchiveInspected: false']]) {
      assert.ok(mocked.includes(from)); mocked = mocked.replace(from, to);
    }
  }
  try {
    const operation = await import(uri(mocked)); assert.equal(log.reads.length, 0);
    return { f, graph, h, log, run: async () => {
      const result = await operation.runRegisteredGnuSdkControls(); assert.ok(Object.isFrozen(result));
      return { ...result, receipt: JSON.parse(result.text) };
    } };
  } finally { delete globalThis[key]; }
}

test('production imports stay inert and expose a fixed zero-argument operation without CLI, shell, extraction or filesystem writes', () => {
  assert.equal(runRegisteredGnuSdkControls.length, 0);
  assert.doesNotMatch(source, /await runRegisteredGnuSdkControls|process\.(?:argv|env)|runRegisteredGnuSdkInventoryV[1234]\(/);
  assert.doesNotMatch(source, /\b(?:fetch|writeFileSync|writeSync|mkdirSync|unlink|rmSync|rename|execFileSync)\s*\(/);
  assert.doesNotMatch(controlSource, /node:(?:fs|child_process)|\.on\(|\.resume\(|\.pause\(/);
});
test('raw source graph and both repository receipts bind the exact registered bytes', () => {
  const pins = [...source.matchAll(/\['([a-z0-9-]+)', (\d+), '([a-f0-9]{64})'\]/g)];
  assert.deepEqual(pins.map(pin => pin[1]), names);
  for (const [, name, size, hash] of pins) { assert.equal(captured.get(name).length, Number(size)); assert.equal(sha(captured.get(name)), hash); }
  for (const [name, size, hash] of [['xz-qualification', 4239, 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233'],
    ['gnu-sdk-inventory-v4', 2732, '755a922e587e17b5978e3df77f96ac4a6fb43499d19df895c9148f0952fedcf5']]) {
    assert.equal(receipts.get(name).length, size); assert.equal(sha(receipts.get(name)), hash); assert.ok(source.includes(hash));
  }
});
test('v1-v4 operators, core, observer and tests retain their pre-controls exact hashes', () => {
  for (const [name, hash] of [
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
  ]) assert.equal(sha(read(name)), hash);
});
test('only the explicit internal summary envelope changes after the accepted stream-cap transform', async () => {
  assert.deepEqual(Buffer.from(controlsCore.toString().replace('maxSummaryBytes: 4_194_304', 'maxSummaryBytes: 262_144')), streamCore);
  const bare = await import(uri(link(controlsCore, 'tar-inventory', uri(tarSource))));
  const original = await import(uri(link(streamCore, 'tar-inventory', uri(tarSource))));
  assert.deepEqual({ ...bare.GNU_SDK_LIMITS, maxSummaryBytes: 262144 }, original.GNU_SDK_LIMITS);
  assert.equal(bare.GNU_SDK_LIMITS.maxSummaryBytes, 4194304);
  for (const bytes of [Buffer.from('missing'), Buffer.concat([streamCore, Buffer.from('maxSummaryBytes: 262_144')]), controlsCore]) {
    assert.throws(() => transformSdkControlsCoreSource(bytes), { code: 'E_SOURCE_PIN' });
  }
});
test('all transformed and linked byte images match deterministic independent source pins', () => {
  for (const [bytes, pin] of [[streamCore, SDK_CONTROLS_SOURCE_PINS.streamCore], [controlsCore, SDK_CONTROLS_SOURCE_PINS.controlsCore],
    [tarSource, SDK_CONTROLS_SOURCE_PINS.transformedTar], [captured.get('sdk-control-inspection'), SDK_CONTROLS_SOURCE_PINS.inspection],
    [linkedInspection, SDK_CONTROLS_SOURCE_PINS.linkedInspection], [linkedPipeline, SDK_CONTROLS_SOURCE_PINS.linkedPipeline]]) {
    assert.deepEqual({ bytes: bytes.length, sha256: sha(bytes) }, pin); assert.ok(Object.isFrozen(pin));
  }
  assert.ok(linkedPipeline.toString().includes("from '" + inspectionUri + "'"));
  assert.match(source, /import\(inspectionUri\)/); assert.doesNotMatch(source, /import\(['"]\.\//);
});
test('fixed production controls and independent complete V4 summary match the receipt transcription', () => {
  const receipt = JSON.parse(receipts.get('gnu-sdk-inventory-v4'));
  assert.deepEqual(SDK_CONTROL_EXPECTATION, receipt.inventory);
  assert.deepEqual(SDK_CONTROLS.map(({ path, index, size }) => ({ path, index, type: 'file', size })), receipt.registeredControlMembers);
  assert.equal(SDK_CONTROLS.reduce((sum, target) => sum + target.size, 0), 16087);
  assert.equal(SDK_CONTROL_LIMITS.maxSpanBytes, 4194304); assert.equal(SDK_CONTROL_LIMITS.maxCandidateBytes, 65536);
});
test('archive identity, decoder limits and global/per-pass budget remain fixed with a full 120-second second-pass allowance', () => {
  assert.equal(source.match(/const identity = \{[\s\S]*?\n\};/)[0], read('gnu-sdk-inventory-v4-operation').toString().match(/const identity = \{[\s\S]*?\n\};/)[0]);
  assert.match(source, /function guard\(limit = 250000\)/); assert.match(source, /guard\(10000\)/);
  assert.match(source, /started \+ 250000 - guard\(\) < 120000/);
  assert.match(controlsCore.toString(), /maxTotalMs: 120_000, cleanupMs: 3000/);
  assert.match(controlsCore.toString(), /--memlimit-decompress=16777216/);
});
test('member pass retains final frozen regular spans but capture stays unavailable before full core acceptance', () => {
  const f = fixture(), pending = memberPass(f);
  assert.equal(pending.state, 'TAR_MEMBER_INVENTORY'); assert.equal(pending.fileSpans.length, 2);
  assert.ok(Object.isFrozen(pending.fileSpans)); assert.equal(f.api.snapshot().hasCompleteMemberPass, true);
  assert.throws(() => f.api.beginCapturePass(), { code: 'E_PHASE' }); assert.throws(() => f.api.getCapturedControls(), { code: 'E_PHASE' });
  const metadata = f.api.acceptMemberPass(coreReceipt(pending));
  assert.equal(metadata.decodedSha256, sha(f.bytes)); assert.equal(metadata.targets.length, 2);
  assert.ok(Object.isFrozen(metadata.targets[0])); assert.equal(Object.hasOwn(metadata, 'fileSpans'), false);
});
test('two approved bodies copy exactly across independently split headers and payload boundaries', () => {
  const f = fixture({ feeds: 5 }); acceptFirst(f, [200, 700, 5000, 13000]);
  const controls = acceptSecond(f, f.bytes, [600, 15212, 16386, 18000]);
  assert.equal(controls.length, 2); assert.deepEqual(controls[0].bytes, f.wrapper); assert.deepEqual(controls[1].bytes, f.script);
  assert.equal(controls[0].sha256, sha(f.wrapper)); assert.equal(controls[1].sha256, sha(f.script));
  assert.equal(f.api.snapshot().copiedBytes, 16087); assert.equal(f.api.snapshot().factoryCalls, 2);
  assert.equal(f.api.snapshot().hasAcceptedSecondPass, true); assert.equal(f.api.snapshot().phase, 'released');
});
test('private target buffers are not allocated before accepted member metadata and stay bounded to 16087 bytes', t => {
  const f = fixture(), allocate = Buffer.alloc, sizes = [];
  t.mock.method(Buffer, 'alloc', (size, ...args) => { sizes.push(size); return Reflect.apply(allocate, Buffer, [size, ...args]); });
  const pending = memberPass(f); assert.equal(sizes.includes(14704), false); assert.equal(sizes.includes(1383), false);
  f.api.acceptMemberPass(coreReceipt(pending)); f.api.beginCapturePass();
  assert.deepEqual(sizes.filter(size => size === 14704 || size === 1383), [14704, 1383]);
});
test('returned payloads never alias the decoded source and release permits no repeated body reads or third parser', () => {
  const f = fixture(); acceptFirst(f); const controls = acceptSecond(f), before = Buffer.from(controls[0].bytes);
  f.bytes.fill(0); assert.deepEqual(controls[0].bytes, before); controls[0].bytes.fill(1);
  assert.throws(() => f.api.getCapturedControls(), { code: 'E_PHASE' }); assert.throws(() => f.api.createTarInventory(), { code: 'E_PHASE' });
  assert.throws(() => f.api.beginMemberPass(), { code: 'E_PHASE' }); assert.equal(f.api.snapshot().factoryCalls, 2);
});
test('candidate metadata includes only narrow regular compiler/helper/manifest names, never Python or GDB', () => {
  const extra = ['bin/x-gcc.br_real', 'libexec/gcc/x86/15/cc1', 'share/buildroot/sdk-location', 'bin/gdb.br_real', 'bin/python.br_real', 'libexec/gcc/x86/15/gdb.py', 'lib/python3.14/a.py']
    .map(path => member(root + '/' + path, Buffer.from('unselected-payload')));
  const f = fixture({ extra }), metadata = acceptFirst(f);
  assert.deepEqual(metadata.candidates.map(value => value.category), ['compiler-real-name', 'compiler-helper-name', 'relocation-manifest-name']);
  assert.doesNotMatch(JSON.stringify(metadata.candidates), /gdb|python/); const bodies = acceptSecond(f);
  assert.equal(bodies.reduce((sum, value) => sum + value.bytes.length, 0), 16087);
});
for (const [name, options] of [
  ['missing script', { missingScript: true }], ['symlink script', { linkScript: true }],
  ['wrong size', { wrapper: elfFixture(14703), controls: [{ index: 1, size: 14704 }, { index: 2, size: 1383 }] }],
  ['wrong index', { controls: [{ index: 2, size: 14704 }, { index: 2, size: 1383 }] }],
]) test('accepted-member target binding rejects ' + name, () => {
  const f = fixture(options), pending = memberPass(f);
  assert.throws(() => f.api.acceptMemberPass(coreReceipt(pending)), { code: 'E_TARGET' });
  assert.throws(() => f.api.beginCapturePass(), { code: 'E_PHASE' });
});
test('duplicate paths fail in the unchanged TAR state machine before any accepted span set', () => {
  const f = fixture(), bytes = Buffer.concat([member(SDK_CONTROLS[0].path, f.wrapper), member(SDK_CONTROLS[0].path, f.wrapper), Buffer.alloc(1024)]);
  f.api.beginMemberPass(); const parser = f.api.createTarInventory();
  assert.throws(() => parser.feed(bytes.subarray(0, f.bytes.length)), { code: 'E_COLLISION' });
  assert.equal(f.api.snapshot().phase, 'failed');
});
test('candidate count and exact JSON budgets fail closed without truncation', () => {
  const extra = [member(root + '/bin/x-gcc.br_real')], accepted = acceptFirst(fixture({ extra }));
  const cost = Buffer.byteLength(JSON.stringify(accepted.candidates));
  assert.equal(acceptFirst(fixture({ extra, limits: { maxCandidateBytes: cost } })).candidates.length, 1);
  for (const limits of [{ maxCandidateEntries: 0 }, { maxCandidateBytes: cost - 1 }]) {
    const f = fixture({ extra, limits }); assert.throws(() => acceptFirst(f), { code: 'E_OUTPUT' });
  }
  const tooMany = fixture({ extra: Array.from({ length: 129 }, (_, i) => member(root + '/bin/x' + i + '.br_real')) });
  assert.throws(() => acceptFirst(tooMany), { code: 'E_OUTPUT' });
});
for (const [name, transform, code] of [
  ['negative offset', spans => { spans[0].bodyOffset = -1; }, 'E_SPAN'],
  ['out-of-range offset', spans => { spans[0].bodyOffset = 505333761; }, 'E_SPAN'],
  ['body end outside the decoded source', spans => { spans[1].bodyOffset = 18431; }, 'E_SPAN'],
  ['overlapping ranges', spans => { spans[1].bodyOffset = spans[0].bodyOffset + spans[0].size - 1; }, 'E_SPAN'],
  ['zero index', spans => { spans[0].index = 0; }, 'E_SPAN'],
  ['index beyond entry count', spans => { spans[1].index = 3; }, 'E_SPAN'],
  ['duplicated target binding', spans => { spans[1].path = spans[0].path; }, 'E_TARGET'],
]) test('private span validation rejects ' + name, async () => {
  const f = await spanFixture(transform);
  assert.throws(() => f.api.acceptMemberPass(coreReceipt(f.pending)), { code });
  assert.throws(() => f.api.beginCapturePass(), { code: 'E_PHASE' });
});
test('accepted span records are private frozen copies rather than aliases to the caller array', async () => {
  const f = await spanFixture(() => {}), accepted = f.api.acceptMemberPass(coreReceipt(f.pending));
  const offset = accepted.targets[0].bodyOffset;
  f.summary.fileSpans[0].bodyOffset = 999999; f.summary.fileSpans.length = 0;
  assert.equal(accepted.targets[0].bodyOffset, offset); assert.ok(Object.isFrozen(accepted.targets));
  assert.equal(accepted.targets.length, 2);
});
test('span and internal summary envelopes reject overflow rather than publishing prefixes', () => {
  const span = fixture({ limits: { maxSpanBytes: 1 } }); span.api.beginMemberPass(); const parser = span.api.createTarInventory();
  assert.throws(() => parser.feed(span.bytes), { code: 'E_SPAN_BYTES' });
  const summary = fixture({ limits: { maxInternalSummaryBytes: 1 } }); assert.throws(() => memberPass(summary), { code: 'E_OUTPUT' });
  assert.throws(() => summary.api.beginCapturePass(), { code: 'E_PHASE' });
});
test('first core post-finish rejection invalidates the member marker instead of authorizing capture', () => {
  const f = fixture(), pending = memberPass(f);
  assert.throws(() => f.api.acceptMemberPass(coreReceipt(pending, { closeAttempts: 1 })), { code: 'E_RECEIPT' });
  assert.equal(f.api.snapshot().hasAcceptedMemberPass, false); assert.throws(() => f.api.beginCapturePass(), { code: 'E_PHASE' });
});
test('core acceptance binds the exact finalized summary object instead of a caller-provided copy', () => {
  const f = fixture(), pending = memberPass(f);
  assert.throws(() => f.api.acceptMemberPass(coreReceipt({ ...pending })), { code: 'E_RECEIPT' });
});
test('second decoded digest mismatch suppresses already collected bodies even when all TAR metadata matches', () => {
  const f = fixture(); acceptFirst(f); const changed = Buffer.from(f.bytes); changed[512 + 100] ^= 1;
  assert.throws(() => capturePass(f, changed), { code: 'E_HASH' });
  assert.equal(f.api.snapshot().copiedBytes, 16087); assert.equal(f.api.snapshot().phase, 'failed');
  assert.throws(() => f.api.getCapturedControls(), { code: 'E_PHASE' });
});
test('late second-pass TAR EOF failure drops captured bytes and never exposes payloads', () => {
  const f = fixture(); acceptFirst(f);
  assert.throws(() => capturePass(f, f.bytes.subarray(0, f.bytes.length - 512)), { code: 'E_TRUNCATED' });
  assert.equal(f.api.snapshot().copiedBytes, 16087); assert.throws(() => f.api.getCapturedControls(), { code: 'E_PHASE' });
});
test('second post-parser core rejection suppresses bodies after a complete second parser finish', () => {
  const f = fixture(); acceptFirst(f); const pending = capturePass(f);
  assert.equal(f.api.snapshot().hasCompleteSecondPass, true); assert.throws(() => f.api.getCapturedControls(), { code: 'E_PHASE' });
  assert.throws(() => f.api.acceptCapturePass(coreReceipt(pending, { closeObserved: false })), { code: 'E_RECEIPT' });
  assert.throws(() => f.api.getCapturedControls(), { code: 'E_PHASE' });
});
for (const key of metricKeys) test('first-pass validation independently binds complete summary field ' + key, () => {
  const baseline = fixture().profile.expectedSummary;
  const value = key === 'metadataSha256' ? '0'.repeat(64) : baseline[key] + (key === 'expandedBytes' ? 512 : 1);
  const f = fixture({ expected: { [key]: value } });
  assert.throws(() => memberPass(f), { code: 'E_SUMMARY' }); assert.equal(f.api.snapshot().hasCompleteMemberPass, false);
});
test('input validation uses native view lengths and rejects proxy/shared views before payload capture', () => {
  const f = fixture(), bytes = Buffer.from(f.bytes); Object.defineProperty(bytes, 'length', { get() { assert.fail('length getter'); } });
  f.api.beginMemberPass(); const parser = f.api.createTarInventory(); parser.feed(bytes); const pending = parser.finish(); f.api.acceptMemberPass(coreReceipt(pending));
  for (const value of [new Proxy(Buffer.alloc(1), { get() { assert.fail('proxy trap'); } }), new Uint8Array(new SharedArrayBuffer(1))]) {
    const fresh = fixture(); fresh.api.beginMemberPass(); assert.throws(() => fresh.api.createTarInventory().feed(value), { code: 'E_INPUT' });
  }
});
test('fixture profiles cannot change paths, raise budgets or invoke accessor/proxy data', () => {
  const f = fixture();
  for (const profile of [{ ...f.profile, controls: [{ index: 1, size: 14705 }, { index: 2, size: 1383 }] },
    { ...f.profile, limits: { maxCandidateEntries: 129 } }, { ...f.profile, limits: { maxSpanBytes: 4194305 } },
    { ...f.profile, controls: [{ index: 1, size: 1, path: '/other' }, { index: 2, size: 1 }] },
    new Proxy(f.profile, { get() { assert.fail('proxy getter'); } })]) assert.throws(() => createControlInspectionFixture(profile), { code: 'E_INPUT' });
  const limits = Object.defineProperty({}, 'maxCandidateBytes', { enumerable: true, get() { assert.fail('limits getter'); } });
  assert.throws(() => createControlInspectionFixture({ ...f.profile, limits }), { code: 'E_INPUT' });
});
test('real fixture core completes both passes sequentially with unchanged FD/hash/EOF/lifecycle validation', async () => {
  const f = fixture(), graph = await fixtureGraph(f), h = ioHarness(graph, { output: () => [f.bytes] });
  f.api.beginMemberPass(); const first = await h.run(); const metadata = f.api.acceptMemberPass(first);
  f.api.beginCapturePass(); const second = await h.run(); f.api.acceptCapturePass(second); const controls = f.api.getCapturedControls();
  assert.equal(first.mockOnly, true); assert.equal(second.mockOnly, true); assert.equal(first.realArchiveInspected, false);
  assert.equal(metadata.decodedSha256, sha(f.bytes)); assert.deepEqual(controls[0].bytes, f.wrapper);
  assert.equal(h.log.spawns.length, 2); assert.equal(h.log.reads.length, 8); assert.equal(h.log.closes.length, 4);
  assert.deepEqual(h.log.closes, [[1, 42], [1, 41], [2, 42], [2, 41]]);
  const decoderRoot = graph.pipeline.GNU_SDK_DESCRIPTOR.decoderRoot;
  for (const [command, args, options] of h.log.spawns) {
    assert.equal(command, decoderRoot + '/ld-linux-x86-64.so.2');
    assert.deepEqual(args, ['--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', decoderRoot,
      decoderRoot + '/xz', '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=16777216', '--', '-']);
    assert.deepEqual(options, { cwd: decoderRoot, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' },
      shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  }
  assert.equal(first.archiveDataBytes + second.archiveDataBytes, 40); assert.equal(first.archiveRequestedBytes + second.archiveRequestedBytes, 44);
  assert.equal(graph.adapter.snapshotControlInspection().factoryCalls, 2);
});
test('mocked zero-argument operation publishes only two inspected controls after both complete fixture-core passes', async () => {
  const h = await mockOperation(), { exitCode, receipt } = await h.run();
  assert.equal(exitCode, 0); assert.equal(receipt.profile, 'mock-sdk-controls-fixture'); assert.equal(receipt.realArchiveInspected, false);
  assert.equal(receipt.status, 'SDK_CONTROL_DATA_INSPECTION'); assert.equal(receipt.result.script.interpretation, 'DATA_ONLY_NOT_EXECUTED');
  assert.equal(receipt.result.script.byteLength, 1383); assert.equal(receipt.result.wrapper.byteLength, 14704);
  assert.equal(receipt.result.wrapper.metadata.header.machine, 62); assert.deepEqual(receipt.result.wrapper.metadata.needed, []);
  assert.equal(receipt.counts.archivePasses, 4); assert.equal(receipt.counts.archiveDataBytes, 40); assert.equal(receipt.counts.archiveRequestedBytes, 44);
  assert.equal(receipt.counts.spawnAttempts, 2); assert.equal(receipt.counts.spawnEvents, 2);
  assert.equal(receipt.counts.stageChecks, 4); assert.equal(h.log.preloads, 4);
  assert.ok(h.log.stages.every(value => value === h.log.stages[0]));
  assert.deepEqual(h.h.log.listenerCounts, [0, 1, 0, 1]);
  assert.equal(receipt.packetDiagnostics.length, 2); assert.equal(receipt.inspection.copiedBytes, 16087);
  assert.equal(Object.hasOwn(receipt.result, 'fileSpans'), false);
  for (const key of ['archiveExtracted', 'filesInstalled', 'pythonRuntimeInvoked', 'nativeQualified', 'installedUsability',
    'pythonFreeSubsetVerified', 'rustReady', 'trainingReady', 'hardRssBounded', 'hardDeadlineGuaranteed', 'processTreeBounded']) assert.equal(receipt[key], false);
});
test('unmodified production receipt guards reject fixture results and do not start pass two', async () => {
  const h = await mockOperation({ productionGuards: true }), { receipt } = await h.run();
  assert.equal(receipt.error, 'E_RECEIPT'); assert.equal(h.log.calls, 1); assert.equal(h.h.log.spawns.length, 1);
  assert.equal(receipt.realArchiveInspected, false); assert.equal(Object.hasOwn(receipt, 'result'), false);
});
test('insufficient global remaining budget prevents capture configuration and any second child', async () => {
  const h = await mockOperation({ insufficientBudget: true }), { receipt } = await h.run();
  assert.equal(receipt.error, 'E_DEADLINE'); assert.equal(h.log.calls, 1); assert.equal(h.h.log.spawns.length, 1);
  assert.equal(receipt.inspection.hasAcceptedMemberPass, true); assert.equal(receipt.inspection.factoryCalls, 1);
  assert.equal(receipt.inspection.captureBytes, 0); assert.equal(Object.hasOwn(receipt, 'result'), false);
});
test('candidate admission failure after complete first-core acceptance never starts the capture pass', async () => {
  const h = await mockOperation({ fixture: { extra: [member(root + '/bin/x-gcc.br_real')], limits: { maxCandidateEntries: 0 } } });
  const { receipt } = await h.run();
  assert.equal(receipt.error, 'E_OUTPUT'); assert.equal(receipt.counts.completedCorePasses, 1);
  assert.equal(h.log.calls, 1); assert.equal(h.h.log.spawns.length, 1); assert.equal(receipt.inspection.factoryCalls, 1);
  assert.equal(receipt.inspection.copiedBytes, 0); assert.equal(Object.hasOwn(receipt, 'result'), false);
});
test('the ten-second preflight deadline stops before any captured-source reads or core invocation', async () => {
  const h = await mockOperation({ preflightExpired: true }), { receipt } = await h.run();
  assert.equal(receipt.error, 'E_DEADLINE'); assert.equal(h.log.reads.length, 0); assert.equal(h.log.calls, 0);
  assert.equal(receipt.sourceAccountingComplete, false); assert.equal(receipt.counts.spawnAttempts, 0);
});
test('the final global deadline suppresses bodies after the second parser and core have completed', async () => {
  const h = await mockOperation({ expireAfterSecond: true }), { receipt, text } = await h.run();
  assert.equal(receipt.error, 'E_DEADLINE'); assert.equal(receipt.inspection.copiedBytes, 16087);
  assert.equal(Object.hasOwn(receipt, 'result'), false); assert.doesNotMatch(text, /scriptText/);
});
test('first child failure never starts a second core pass or publishes a payload', async () => {
  const h = await mockOperation({ spawnFailure: 1 }), { receipt } = await h.run();
  assert.equal(receipt.error, 'E_SPAWN'); assert.equal(h.log.calls, 1); assert.equal(receipt.counts.spawnEvents, 0);
  assert.equal(receipt.packetDiagnostics[0].stdoutBytes, 0); assert.equal(Object.hasOwn(receipt, 'result'), false);
});
test('late second close failure suppresses captured payloads despite complete decoded bytes', async () => {
  const h = await mockOperation({ closeFailure: 2 }), { receipt } = await h.run();
  assert.equal(receipt.error, 'E_CLOSE'); assert.equal(receipt.inspection.copiedBytes, 16087);
  assert.equal(receipt.realArchiveInspected, false); assert.equal(Object.hasOwn(receipt, 'result'), false);
});
test('second decoded digest mismatch remains a failed core result and never leaks script text', async () => {
  const h = await mockOperation({ changedSecond: bytes => { const copy = Buffer.from(bytes); copy[512 + 100] ^= 1; return copy; } });
  const { receipt, text } = await h.run(); assert.equal(receipt.error, 'E_TAR'); assert.equal(receipt.inspection.copiedBytes, 16087);
  assert.equal(Object.hasOwn(receipt, 'result'), false); assert.doesNotMatch(text, /scriptText|ELF_REQUIREMENTS_METADATA/);
});
test('a third spawn attempt is blocked before a third child and suppresses the second-pass result', async () => {
  const h = await mockOperation({ thirdSpawn: true }), { receipt } = await h.run();
  assert.equal(receipt.error, 'E_LIMIT'); assert.equal(receipt.counts.spawnAttempts, 3); assert.equal(h.h.log.spawns.length, 2);
  assert.equal(Object.hasOwn(receipt, 'result'), false);
});
for (const script of [Buffer.alloc(1383, 0), Buffer.alloc(1383, 255), Buffer.alloc(1383, 27)]) test('invalid script UTF8/control bytes produce a STOP without any script text', async () => {
  const h = await mockOperation({ fixture: { script } }), { receipt, text } = await h.run();
  assert.equal(receipt.error, 'E_TEXT'); assert.equal(receipt.counts.completedCorePasses, 2);
  assert.equal(Object.hasOwn(receipt, 'result'), false); assert.doesNotMatch(text, /scriptText/);
});
test('TAB/LF/CR stay inert script data while malformed wrapper ELF fails after both accepted passes', async () => {
  const script = Buffer.alloc(1383, 35); script.set([9, 10, 13]);
  const allowed = await mockOperation({ fixture: { script } }); assert.equal((await allowed.run()).exitCode, 0);
  const rejected = await mockOperation({ fixture: { wrapper: Buffer.alloc(14704) } }); const { receipt } = await rejected.run();
  assert.equal(receipt.error, 'E_ELF'); assert.equal(receipt.realArchiveInspected, false); assert.equal(Object.hasOwn(receipt, 'result'), false);
});
for (const corrupt of ['sdk-control-inspection', 'gnu-sdk-inventory-v4-operation']) test(corrupt + ' pin failure blocks all parser and child activity', async () => {
  const h = await mockOperation({ corrupt }), { receipt } = await h.run();
  assert.equal(receipt.error, 'E_SOURCE_PIN'); assert.equal(h.log.calls, 0); assert.equal(h.h.log.spawns.length, 0);
  assert.equal(receipt.sourceAccountingComplete, false); assert.equal(receipt.inspection, null);
});
test('receipt and stage failures keep truthful accounting and do not invoke a decoder', async () => {
  for (const options of [{ receiptFailure: true }, { stageFailure: true }, { preloadFailure: true }]) {
    const h = await mockOperation(options), { receipt } = await h.run();
    assert.equal(receipt.error, options.receiptFailure ? 'E_SOURCE_PIN' : 'E_PREREQUISITE');
    assert.equal(h.h.log.spawns.length, 0); assert.equal(Object.hasOwn(receipt, 'result'), false);
    if (options.stageFailure) assert.equal(receipt.stageAccountingComplete, false);
    if (options.receiptFailure) assert.equal(receipt.receiptAccountingComplete, false);
  }
});
test('all three new files reference only the parent-owned controls SPEC without requiring an unpublished index entry', () => {
  const pointer = '// SPEC: _spec/tooling/native-ingress/gnu-sdk-controls.puml\n';
  for (const name of ['sdk-control-inspection', 'gnu-sdk-controls-operation', 'gnu-sdk-controls-operation.test']) assert.ok(read(name).toString().startsWith(pointer));
  const spec = '_spec/tooling/native-ingress/gnu-sdk-controls.puml';
  const files = ['tooling/native-ingress/sdk-control-inspection.mjs', 'tooling/native-ingress/gnu-sdk-controls-operation.mjs', 'tooling/native-ingress/gnu-sdk-controls-operation.test.mjs'];
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(x => x.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) assert.ok(diagram.includes("' covers: " + file + '\n'));
});
