// SPEC: _spec/tooling/native-ingress/gnu-sdk-inventory-v4.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { GNU_SDK_LIMITS as v1Limits } from './gnu-sdk-inventory.mjs';
import { GNU_SDK_V4_PINS, transformTarInventoryV4Source, runRegisteredGnuSdkInventoryV4 } from './gnu-sdk-inventory-v4-operation.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const read = name => fs.readFileSync(new URL('./' + name + '.mjs', import.meta.url));
const names = ['tar-inventory', 'elf-metadata', 'xz-staging', 'gnu-sdk-inventory', 'gnu-sdk-inventory-v2-operation', 'tar-observer'];
const captured = new Map(names.map(name => [name, read(name)]));
const source = read('gnu-sdk-inventory-v4-operation').toString('utf8');
const rawTar = captured.get('tar-inventory');
const defaultNeedle = 'maxExtensionBytes: 65_536';
const guardNeedle = "if (size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');";
const guardReplacement = "if (size > 65_536 || size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');";
const intermediateTar = Buffer.from(rawTar.toString().replace(defaultNeedle, 'maxExtensionBytes: 4_194_304'));
const transformedTar = transformTarInventoryV4Source(rawTar);
const link = (bytes, name, dependencyUri) => Buffer.from(bytes.toString('utf8')
  .replace("from './" + name + ".mjs'", "from '" + dependencyUri + "'"));
const helper = await import(uri(captured.get('gnu-sdk-inventory-v2-operation')));
const transformedCore = helper.transformSdkInventoryV2Source(captured.get('gnu-sdk-inventory'));
const linkedObserver = link(captured.get('tar-observer'), 'tar-inventory', uri(transformedTar));
const observerUri = uri(linkedObserver);
const linkedInventory = link(transformedCore, 'tar-inventory', observerUri);
const [originalTar, privateTar, pipeline, observer] = await Promise.all([
  import(uri(rawTar)), import(uri(transformedTar)), import(uri(linkedInventory)), import(observerUri),
]);
const receiptBytes = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/xz-qualification.receipt.json', import.meta.url));
const blank = { feedCalls: 0, completedFeedCalls: 0, attemptedFeedBytes: 0,
  errorPhase: null, errorCode: null, diagnosticCountersComplete: true };
const gate = () => ({ stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true });
const turns = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const rejects = (pending, code) => assert.rejects(pending, error => {
  assert.equal(error.code, code); assert.ok(Object.isFrozen(error));
  for (const key of ['inventory', 'selected', 'diagnostics', 'cause']) assert.equal(Object.hasOwn(error, key), false);
  return true;
});

function checksum(bytes) {
  bytes.fill(32, 148, 156);
  const sum = bytes.reduce((total, byte) => total + byte, 0);
  bytes.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return bytes;
}
function header({ path = 'sdk/file', size = 0, type = '0', gnu = false } = {}) {
  const bytes = Buffer.alloc(512);
  bytes.write(path, 0, 100, 'utf8');
  for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, size], [136, 12, 0]]) {
    bytes.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  }
  bytes[156] = type.charCodeAt(0);
  bytes.write(gnu ? 'ustar ' : 'ustar\0', 257, 6, 'ascii'); bytes.write(gnu ? ' \0' : '00', 263, 2, 'ascii');
  return checksum(bytes);
}
const member = (options = {}, body = Buffer.alloc(0)) => Buffer.concat([
  header({ ...options, size: body.length }), body, Buffer.alloc((512 - body.length % 512) % 512),
]);
const archive = (...members) => Buffer.concat([...members, Buffer.alloc(1024)]);
const tinyTar = () => archive(member({ path: 'sdk/bin/gcc' }));
function paxRecord(key, value) {
  const body = ` ${key}=${value}\n`;
  let size = Buffer.byteLength(body) + 1;
  while (String(size).length + Buffer.byteLength(body) !== size) size = String(size).length + Buffer.byteLength(body);
  return Buffer.from(String(size) + body);
}
function longFixture(count = 68, payloadBytes = 1000, lastPayloadBytes = payloadBytes) {
  const paths = [], members = [];
  let extensionBytes = 0;
  for (let i = 0; i < count; i++) {
    const size = i === count - 1 ? lastPayloadBytes : payloadBytes;
    const prefix = 'sdk/' + String(i).padStart(3, '0') + '-';
    const path = prefix + 'a'.repeat(size - prefix.length - 1);
    const body = Buffer.from(path + '\0');
    assert.equal(body.length, size); assert.ok(Buffer.byteLength(path) <= 1024);
    paths.push(path); extensionBytes += body.length;
    members.push(member({ path: '././@LongLink', type: 'L', gnu: true }, body), member({ path: 'sdk/short-' + i, gnu: true }));
  }
  return { bytes: archive(...members), paths, extensionBytes };
}
function parse(factory, bytes, overrides = {}, chunkSize = 65536) {
  const parser = factory(overrides), events = [];
  for (let i = 0; i < bytes.length; i += chunkSize) events.push(...parser.feed(bytes.subarray(i, i + chunkSize)));
  return { events, summary: parser.finish() };
}
const expectedEvents = paths => paths.map((path, index) => ({ index: index + 1, path, type: 'file', size: 0, mode: 420, uid: 1000, gid: 1000, mtime: '0' }));

function harness(options = {}) {
  const input = options.input ?? Buffer.from('0123456789');
  const chunks = options.chunks ?? [tinyTar()];
  const diagnostics = helper.createSdkV2Diagnostics();
  const log = { reads: [], spawns: [], writes: [], kills: [], closes: [], hooks: [], listenerCounts: [], spawnEvents: 0 };
  const stats = {
    root: { dev: 11n, ino: 101n, mode: 0o40700n, uid: 1000n, gid: 1000n, nlink: 2n, size: 4096n, mtimeNs: 100n, ctimeNs: 101n },
    file: { dev: 22n, ino: 202n, mode: 0o100600n, uid: 1000n, gid: 1000n, nlink: 1n, size: BigInt(input.length), mtimeNs: 200n, ctimeNs: 201n },
  };
  const expected = Object.fromEntries(Object.entries(stats).map(([kind, stat]) =>
    [kind, Object.fromEntries(Object.entries(stat).map(([key, value]) => [key, String(value)]))]));
  const kind = path => path === pipeline.GNU_SDK_DESCRIPTOR.root ? 'root' : path === pipeline.GNU_SDK_DESCRIPTOR.file ? 'file' : assert.fail('unexpected path');
  const io = {
    lstatSync: path => ({ ...stats[kind(path)] }),
    fstatSync: fd => ({ ...stats[fd === 41 ? 'root' : fd === 42 ? 'file' : assert.fail('unexpected FD')] }),
    openSync: path => kind(path) === 'root' ? 41 : 42,
    readSync(fd, buffer, offset, length, position) {
      assert.equal(fd, 42); assert.equal(offset, 0); assert.ok(length <= 65536);
      log.reads.push({ position, length });
      if (options.extraEof && position === input.length) return 1;
      return input.copy(buffer, offset, position, position + length);
    },
    closeSync(fd) { log.closes.push(fd); if (options.closeError === fd) throw new Error('mock close'); },
  };
  let child;
  const spawn = (...args) => {
    log.spawns.push(args);
    if (options.spawnThrow) throw new Error('mock spawn');
    child = new EventEmitter();
    for (const name of ['stdin', 'stdout', 'stderr']) child[name] = new EventEmitter();
    for (const name of ['stdout', 'stderr']) child[name].on('newListener', event => {
      if (event === 'data') log.listenerCounts.push([name, child[name].listenerCount('data')]);
    });
    child.kill = signal => { log.kills.push(signal); if (!options.noKillClose) queueMicrotask(() => child.emit('close', null, signal)); };
    child.stdin.write = (bytes, callback) => {
      log.writes.push({ bytes, snapshot: Buffer.from(bytes), callback });
      if (options.deferWrites) return false;
      queueMicrotask(callback); return true;
    };
    child.stdin.end = () => {
      child.stdin.emit('finish');
      for (const chunk of chunks) child.stdout.emit('data', chunk);
      for (const chunk of options.stderr ?? []) child.stderr.emit('data', chunk);
      if (log.kills.length) return;
      for (const name of ['stdout', 'stderr']) { child[name].emit('end'); if (log.kills.length) return; child[name].emit('close'); }
      child.emit('exit', 0, null); child.emit('close', 0, null); child.stdin.emit('close');
    };
    if (options.instrument !== false) child.once('spawn', () => {
      log.spawnEvents++;
      assert.equal(child.stdout.listenerCount('data'), 1); assert.equal(child.stderr.listenerCount('data'), 1);
      diagnostics.observeSdkChild(child);
    });
    assert.equal(child.stdout.listenerCount('data'), 0); assert.equal(child.stderr.listenerCount('data'), 0);
    queueMicrotask(() => options.spawnError ? child.emit('error', new Error('mock failure')) : child.emit('spawn'));
    return child;
  };
  const deps = {
    fs: io, spawn,
    beforeDecode: () => { log.hooks.push('before'); if (options.changeHash) input[0] ^= 1; return gate(); },
    afterDecode: () => { log.hooks.push('after'); if (options.changeMetadata) stats.file.ino++; return gate(); },
  };
  const profile = { archiveBytes: input.length, archiveSha256: sha(input), limits: options.limits ?? {} };
  return { run: () => pipeline.createSdkInventoryFixtureRunner(profile, deps)(expected), deps, profile, expected,
    log, diagnostics, get child() { return child; } };
}

let mockId = 0;
async function mockOperation(options = {}) {
  const key = '__gnuSdkV4Mock' + ++mockId;
  const fixture = harness({ ...options, instrument: false });
  const log = { reads: [], stages: [], preloads: 0, inventoryCalls: 0, originalIdentity: null };
  const context = {
    fs: { readFileSync(path) {
      log.reads.push(path);
      if (options.readFailure) throw new Error('mock source read');
      const prefix = '/tmp/opencode/f9-bootstrap-correspondence/';
      if (path === prefix + '_spec/tooling/native-ingress/xz-qualification.receipt.json') {
        if (options.receiptFailure) throw new Error('mock receipt read');
        return options.badReceipt ? Buffer.from('invalid') : receiptBytes;
      }
      const name = path.slice((prefix + 'tooling/native-ingress/').length, -4);
      assert.equal(path, prefix + 'tooling/native-ingress/' + name + '.mjs'); assert.ok(captured.has(name));
      return options.corrupt === name ? Buffer.from('corrupt') : captured.get(name);
    } },
    spawn: fixture.deps.spawn,
    verifyStagedXzImages(input) {
      log.stages.push(input);
      if (options.stageFailure) throw new helper.NewGnuSdkInventoryError('E_BINDING');
      return { counters: { fsCalls: 10, readBytes: 100, closeAttempts: 5 } };
    },
    assertNoSystemPreload() { log.preloads++; return !options.preloadFailure; },
    async runGnuSdkInventory(identity, deps) {
      log.inventoryCalls++; log.originalIdentity = identity;
      const result = await pipeline.createSdkInventoryFixtureRunner(fixture.profile, { ...fixture.deps, ...deps })(fixture.expected);
      if (options.secondAttempt) deps.spawn('mock-only');
      return result;
    },
  };
  globalThis[key] = context;
  const mockUri = uri(`const d = globalThis[${JSON.stringify(key)}]; export default d.fs;
    export const spawn = d.spawn; export const verifyStagedXzImages = d.verifyStagedXzImages;
    export const assertNoSystemPreload = d.assertNoSystemPreload; export const runGnuSdkInventory = d.runGnuSdkInventory;`);
  const mockedSource = source.replace("from 'node:fs'", "from '" + mockUri + "'")
    .replace("from 'node:child_process'", "from '" + mockUri + "'")
    .replace('import(uri(stageSource))', 'import(' + JSON.stringify(mockUri) + ')')
    .replace('import(uri(inventorySource))', 'import(' + JSON.stringify(mockUri) + ')');
  try {
    const operation = await import(uri(mockedSource)); assert.equal(log.reads.length, 0);
    return { fixture, log, run: async () => {
      const result = await operation.runRegisteredGnuSdkInventoryV4();
      assert.ok(Object.isFrozen(result)); return { ...result, receipt: JSON.parse(result.text) };
    } };
  } finally { delete globalThis[key]; }
}

test('v4 imports inertly with a zero-argument fixed operation and no adaptive CLI or additional execution method', () => {
  assert.equal(runRegisteredGnuSdkInventoryV4.length, 0);
  assert.doesNotMatch(source, /await runRegisteredGnuSdkInventoryV4|process\.(?:argv|env)|createSdkInventoryFixtureRunner|runRegisteredGnuSdkInventoryV[123]\(/);
  assert.doesNotMatch(source, /\b(?:fetch|unlink|rmSync|mkdirSync|writeFileSync|writeSync|rename|execFileSync)\s*\(/);
});

test('all frozen v1-v3 sources, operators, observer and tests retain exact pre-v4 bytes', () => {
  for (const [name, size, digest] of [
    ['tar-inventory', 15548, '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139'],
    ['tar-inventory.test', 39591, '63f4582fe58c0ba0784798aa7bd628ed0cdec4973c5d43a1d965f549635733ca'],
    ['gnu-sdk-inventory', 23261, 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29'],
    ['gnu-sdk-inventory.test', 33532, '67825a3e8c685c0fddafc554076b9203a9b6e9ac5e1a83cfb4d4459e5e84e9cc'],
    ['gnu-sdk-inventory-operation', 6666, '3b9dfbf8c7b045884af420b43c24bff6f90eea04aa8e5b6e967af1b22ec3411f'],
    ['gnu-sdk-inventory-operation.test', 4010, '79a915de890809dc3284cd9e5204b08af6239e120f0f49177d98512d3de51ad4'],
    ['gnu-sdk-inventory-v2-operation', 10102, '39da4bc85f6e7eaaecb0abd157d59ec4c2dcb6191a19c9247cbadd0080ae767a'],
    ['gnu-sdk-inventory-v2-operation.test', 30930, '3c4c3ebb98a0880d487c3d638714aeba0423bc3aabef4122d474bf506308a3c2'],
    ['tar-observer', 3288, '6211785adf6470eb6af8f437a6815aa194b75063f0f7ad9a90c48ad9e3747ab1'],
    ['gnu-sdk-inventory-v3-operation', 10103, '2714854c2fe0521abcb6b4acf2a80b8a5e46b7026922f2ff849c970167d80ea1'],
    ['gnu-sdk-inventory-v3-operation.test', 37965, 'd48ac4a1c6a9ae154452d56d7f95df1303b3db25b4022263c58e9a3f1eba20ac'],
  ]) { const bytes = read(name); assert.equal(bytes.length, size); assert.equal(sha(bytes), digest); }
});

test('all six captured source pins and the consumed receipt remain exact without any reopening', () => {
  const pins = [...source.matchAll(/\['([a-z0-9-]+)', (\d+), '([a-f0-9]{64})'\]/g)];
  assert.deepEqual(pins.map(pin => pin[1]), names);
  for (const [, name, size, digest] of pins) {
    assert.equal(captured.get(name).length, Number(size)); assert.equal(sha(captured.get(name)), digest);
  }
  assert.equal(receiptBytes.length, 4239); assert.equal(sha(receiptBytes), 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233');
  assert.ok(source.includes(sha(receiptBytes)));
});

test('the two single-occurrence replacements are the only changes to the private TAR source', () => {
  for (const needle of [defaultNeedle, guardNeedle]) assert.equal(rawTar.toString().split(needle).length, 2);
  assert.equal(transformedTar.toString().split(guardReplacement).length, 2);
  const restored = transformedTar.toString().replace('maxExtensionBytes: 4_194_304', defaultNeedle).replace(guardReplacement, guardNeedle);
  assert.deepEqual(Buffer.from(restored), rawTar);
  assert.deepEqual(transformTarInventoryV4Source(rawTar), transformedTar);
});

test('original, intermediate, final TAR, core and both fully linked graph pins bind independently computed bytes', () => {
  for (const [bytes, pin] of [[rawTar, GNU_SDK_V4_PINS.originalTarSourcePin], [intermediateTar, GNU_SDK_V4_PINS.intermediateTarSourcePin],
    [transformedTar, GNU_SDK_V4_PINS.transformedTarSourcePin], [transformedCore, GNU_SDK_V4_PINS.transformedSourcePin],
    [linkedObserver, GNU_SDK_V4_PINS.linkedObserverSourcePin], [linkedInventory, GNU_SDK_V4_PINS.linkedSourcePin]]) {
    assert.deepEqual({ bytes: bytes.length, sha256: sha(bytes) }, pin); assert.ok(Object.isFrozen(pin));
  }
  assert.ok(Object.isFrozen(GNU_SDK_V4_PINS));
  const stage = link(captured.get('xz-staging'), 'elf-metadata', uri(captured.get('elf-metadata')));
  assert.equal(stage.length, 43154); assert.equal(sha(stage), '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2');
});

for (const [name, bytes] of [
  ['missing default literal', Buffer.from(rawTar.toString().replace(defaultNeedle, 'maxExtensionBytes: 65_537'))],
  ['duplicate default literal', Buffer.concat([rawTar, Buffer.from(defaultNeedle)])],
  ['missing guard', Buffer.from(rawTar.toString().replace(guardNeedle, guardReplacement))],
  ['duplicate guard', Buffer.concat([rawTar, Buffer.from(guardNeedle)])],
  ['same-length wrong source hash', Buffer.from(rawTar.toString().replace('E_CHECKSUM', 'E_CHECKSUN'))],
  ['already transformed input', transformedTar],
]) test('the private transform rejects ' + name, () => {
  assert.throws(() => transformTarInventoryV4Source(bytes), error => error.code === 'E_SOURCE_PIN' && Object.isFrozen(error));
});

test('native source capture ignores shadowed accessors, rejects proxies/shared buffers and never mutates input', () => {
  const bytes = Buffer.from(rawTar), before = Buffer.from(bytes);
  for (const key of ['length', 'buffer', 'byteOffset', 'toString']) Object.defineProperty(bytes, key, { get() { assert.fail(key + ' getter'); } });
  assert.deepEqual(transformTarInventoryV4Source(bytes), transformedTar);
  assert.deepEqual(Buffer.from(new Uint8Array(bytes)), before);
  const shared = new SharedArrayBuffer(rawTar.length); new Uint8Array(shared).set(rawTar);
  for (const value of [null, rawTar.toString(), new Uint8Array(rawTar), new Proxy(rawTar, { get() { assert.fail('proxy trap'); } }), Buffer.from(shared)]) {
    assert.throws(() => transformTarInventoryV4Source(value), { code: 'E_SOURCE_PIN' });
  }
  const changed = transformTarInventoryV4Source(rawTar); changed.fill(0); assert.equal(sha(rawTar), GNU_SDK_V4_PINS.originalTarSourcePin.sha256);
});

test('the private default changes only cumulative extension bytes; all other TAR and GNU core limits stay fixed', () => {
  assert.equal(originalTar.INVENTORY_LIMITS.maxExtensionBytes, 65536); assert.equal(privateTar.INVENTORY_LIMITS.maxExtensionBytes, 4194304);
  assert.deepEqual({ ...privateTar.INVENTORY_LIMITS, maxExtensionBytes: 65536 }, originalTar.INVENTORY_LIMITS);
  assert.equal(privateTar.INVENTORY_LIMITS.maxHeaders, 65536); assert.equal(privateTar.INVENTORY_LIMITS.maxDataEvents, 32768);
  assert.deepEqual({ ...pipeline.GNU_SDK_LIMITS, maxStreamEvents: 32768 }, v1Limits);
  assert.deepEqual(Buffer.from(transformedCore.toString().replace('maxStreamEvents: 262_144', 'maxStreamEvents: 32_768')), captured.get('gnu-sdk-inventory'));
  assert.match(transformedCore.toString(), /--memlimit-decompress=16777216/);
});

test('paths, all nine identity fields, parent gates, accounting scopes and outer byte/time bounds retain v3 text', () => {
  const prior = read('gnu-sdk-inventory-v3-operation').toString();
  for (const pattern of [/const identity = \{[\s\S]*?\n\};/u, /const gate = \(\) => \{[\s\S]*?\n    \};/u,
    /function guard\(limit = 130000\) \{[\s\S]*?\n  \}/u,
    /sourceCountersScope:[\s\S]*?stageCountersScope: 'completed verification helpers'/u]) {
    assert.ok(source.match(pattern)); assert.equal(source.match(pattern)[0], prior.match(pattern)[0]);
  }
  assert.match(source, /Buffer.byteLength\(text\) > 1048576/); assert.match(source, /guard\(10000\)/);
});

test('only captured transformed TAR bytes enter the unchanged observer and the pipeline shares its exact URI', async () => {
  assert.ok(linkedObserver.toString().includes("from '" + uri(transformedTar) + "'"));
  assert.ok(linkedInventory.toString().includes("from '" + observerUri + "'"));
  assert.equal(await import(observerUri), observer);
  assert.match(source, /link\(sources.get\('tar-observer'\), 'tar-inventory', uri\(transformedTar\)\)/);
  assert.match(source, /link\(transformed, 'tar-inventory', observerUri\)/); assert.match(source, /import\(observerUri\)/);
  assert.doesNotMatch(source, /import\(['"]\.\//);
});

test('68 valid interleaved GNU long records exceed the old cumulative budget but produce a complete private inventory', () => {
  const fixture = longFixture(); assert.equal(fixture.extensionBytes, 68000); assert.ok(fixture.bytes.length < 150000);
  assert.throws(() => parse(originalTar.createTarInventory, fixture.bytes), { code: 'E_EXTENSION_BYTES' });
  const parsed = parse(privateTar.createTarInventory, fixture.bytes), expected = expectedEvents(fixture.paths);
  assert.deepEqual(parsed.events, expected); assert.equal(parsed.summary.entries, 68); assert.equal(parsed.summary.headers, 136);
  assert.equal(parsed.summary.extensionBytes, 68000); assert.equal(parsed.summary.expandedBytes, fixture.bytes.length);
  assert.equal(parsed.summary.metadataSha256, sha(Buffer.from(expected.map(event => JSON.stringify(event) + '\n').join(''))));
  assert.equal(parsed.summary.realArchiveInspected, false);
});

test('under the old budget both actual TAR implementations return identical complete events and metadata hashes', () => {
  const fixture = longFixture(4, 1000);
  assert.deepEqual(parse(privateTar.createTarInventory, fixture.bytes), parse(originalTar.createTarInventory, fixture.bytes));
});

test('lower cumulative limits accept the exact 200-byte boundary and reject 201 without dropping a record', () => {
  const boundary = longFixture(4, 50), plusOne = longFixture(4, 50, 51);
  assert.equal(parse(privateTar.createTarInventory, boundary.bytes, { maxExtensionBytes: 200 }).summary.extensionBytes, 200);
  assert.throws(() => parse(privateTar.createTarInventory, plusOne.bytes, { maxExtensionBytes: 200 }), { code: 'E_EXTENSION_BYTES' });
  const parsed = parse(privateTar.createTarInventory, plusOne.bytes, { maxExtensionBytes: 201 });
  assert.equal(parsed.summary.extensionBytes, 201); assert.deepEqual(parsed.events, expectedEvents(plusOne.paths));
  assert.throws(() => parse(privateTar.createTarInventory, boundary.bytes, { maxExtensionBytes: 199 }), { code: 'E_EXTENSION_BYTES' });
});

test('private overrides only lower the new cumulative ceiling and never remove the individual payload guard', () => {
  for (const value of [0, -1, 4194305, Infinity, 1.5]) assert.throws(() => privateTar.createTarInventory({ maxExtensionBytes: value }), { code: 'E_LIMITS' });
  assert.throws(() => originalTar.createTarInventory({ maxExtensionBytes: 65537 }), { code: 'E_LIMITS' });
  assert.throws(() => privateTar.createTarInventory({ maxExtensionBytes: 4194304 }).feed(header({ type: 'L', size: 65537 })), { code: 'E_EXTENSION_BYTES' });
});

test('a 65536-byte extension header is admitted without claiming a valid complete long name', () => {
  const parser = privateTar.createTarInventory(); assert.deepEqual(parser.feed(header({ type: 'L', size: 65536 })), []);
  assert.throws(() => parser.finish(), { code: 'E_TRUNCATED' });
});

test('all four extension types reject individual payloads above 65536 before allocating their body', t => {
  const allowed = header({ type: 'L', size: 65536 });
  const rejected = ['x', 'g', 'L', 'K'].map(type => header({ type, size: 65537 }));
  const allocations = [], allocate = Buffer.alloc;
  t.mock.method(Buffer, 'alloc', (size, ...args) => { allocations.push(size); return Reflect.apply(allocate, Buffer, [size, ...args]); });
  privateTar.createTarInventory().feed(allowed);
  for (const bytes of rejected) assert.throws(() => privateTar.createTarInventory().feed(bytes), { code: 'E_EXTENSION_BYTES' });
  assert.ok(allocations.includes(65536)); assert.ok(allocations.every(size => size <= 65536));
});

test('an admitted maximum-size long-name body still fails the unchanged 1024-byte path gate', () => {
  const body = Buffer.alloc(65536, 97); body[body.length - 1] = 0;
  const bytes = archive(member({ type: 'L', gnu: true }, body), member());
  assert.throws(() => parse(privateTar.createTarInventory, bytes), { code: 'E_PATH' });
});

for (const [name, bytes, code] of [
  ['unknown PAX key', archive(member({ type: 'x' }, paxRecord('private.key', 'value')), member()), 'E_PAX_KEY'],
  ['PAX traversal', archive(member({ type: 'x' }, paxRecord('path', '../escape')), member()), 'E_PATH'],
  ['GNU traversal', archive(member({ type: 'L', gnu: true }, Buffer.from('../escape\0')), member()), 'E_PATH'],
  ['ordinary path collision', archive(member(), member()), 'E_COLLISION'],
  ['unsupported entry type', archive(member({ type: '3' })), 'E_TYPE'],
  ['unterminated GNU long name', archive(member({ type: 'L', gnu: true }, Buffer.from('not-terminated')), member()), 'E_GNU_LONG'],
  ['repeated pending GNU long names', archive(member({ type: 'L' }, Buffer.from('sdk/a\0')), member({ type: 'L' }, Buffer.from('sdk/b\0')), member()), 'E_EXTENSION_REPEAT'],
  ['dangling extension', archive(member({ type: 'L' }, Buffer.from('sdk/a\0'))), 'E_DANGLING_EXTENSION'],
  ['nonzero trailer', Buffer.concat([tinyTar(), Buffer.from([1])]), 'E_TRAILING'],
]) test('unchanged parser rules still reject ' + name, () => {
  assert.throws(() => parse(privateTar.createTarInventory, bytes), { code });
});

test('nonzero file padding and truncated terminators still fail closed', () => {
  const padded = member({}, Buffer.from('a')); padded[513] = 1;
  assert.throws(() => parse(privateTar.createTarInventory, archive(padded)), { code: 'E_PADDING' });
  assert.throws(() => parse(privateTar.createTarInventory, Buffer.concat([member(), Buffer.alloc(512)])), { code: 'E_TRUNCATED' });
});

test('the unchanged default 65536-header ceiling rejects the next streamed header without a giant fixture', () => {
  const parser = privateTar.createTarInventory();
  for (let i = 0; i < 65536; i += 4) parser.feed(Buffer.concat(Array.from({ length: 4 }, (_, j) => header({ path: 'sdk/' + (i + j) }))));
  assert.throws(() => parser.feed(header({ path: 'sdk/65536' })), { code: 'E_HEADERS' });
});

test('header, byte, output and stream-event overrides retain their original lower-only checks', () => {
  const bytes = archive(member({ path: 'sdk/a' }), member({ path: 'sdk/b' }));
  assert.throws(() => parse(privateTar.createTarInventory, bytes, { maxHeaders: 1 }), { code: 'E_HEADERS' });
  assert.throws(() => parse(privateTar.createTarInventory, bytes, { maxExpandedBytes: bytes.length - 1 }), { code: 'E_EXPANDED_BYTES' });
  assert.throws(() => parse(privateTar.createTarInventory, bytes, { maxOutputBytes: 1 }), { code: 'E_OUTPUT_BYTES' });
  assert.throws(() => parse(privateTar.createTarInventory, bytes, { maxDataEvents: 1 }, 512), { code: 'E_DATA_EVENTS' });
});

test('the unchanged observer delegates results and exceptions by identity and preserves its first error', () => {
  const events = Object.freeze([]), result = Object.freeze({ fixture: true }), first = { code: 'E_EXTENSION_BYTES' }, later = { code: 'E_SEALED' };
  const success = observer.observeTarInventory(Object.freeze({ feed: () => events, finish: () => result }));
  assert.equal(success.feed(Buffer.alloc(2)), events); assert.equal(success.finish(), result);
  const failure = observer.observeTarInventory(Object.freeze({ feed() { throw first; }, finish() { throw later; } }));
  assert.throws(() => failure.feed(Buffer.alloc(3)), error => error === first);
  assert.throws(() => failure.finish(), error => error === later);
  assert.deepEqual(observer.snapshotTarInventoryDiagnostics(), { ...blank, feedCalls: 1, attemptedFeedBytes: 3, errorPhase: 'feed', errorCode: 'E_EXTENSION_BYTES' });
});

test('the actual mocked core fully parses all 68 long records with two hashes, EOF probes, parent gates and FD closes', async () => {
  const fixture = longFixture(), h = harness({ chunks: [fixture.bytes] }); const result = await h.run();
  assert.equal(result.mockOnly, true); assert.equal(result.realArchiveInspected, false);
  assert.equal(result.inventory.entries, 68); assert.equal(result.inventory.extensionBytes, 68000);
  assert.equal(result.archivePasses, 2); assert.equal(result.archiveDataBytes, 20); assert.equal(result.archiveReadAttempts, 4);
  assert.deepEqual(h.log.reads, [{ position: 0, length: 10 }, { position: 10, length: 1 }, { position: 0, length: 10 }, { position: 10, length: 1 }]);
  assert.deepEqual(h.log.hooks, ['before', 'after']); assert.deepEqual(h.log.closes, [42, 41]);
  assert.equal(observer.snapshotTarInventoryDiagnostics().feedCalls, 3); assert.equal(observer.snapshotTarInventoryDiagnostics().completedFeedCalls, 3);
  assert.equal(observer.snapshotTarInventoryDiagnostics().attemptedFeedBytes, fixture.bytes.length);
  assert.equal(observer.snapshotTarInventoryDiagnostics().errorCode, null);
});

test('an oversized individual extension remains E_TAR through the core with E_EXTENSION_BYTES diagnostic and no accepted metadata', async () => {
  const h = harness({ chunks: [header({ type: 'L', size: 65537 })] }); await rejects(h.run(), 'E_TAR');
  assert.equal(observer.snapshotTarInventoryDiagnostics().errorCode, 'E_EXTENSION_BYTES');
  assert.equal(observer.snapshotTarInventoryDiagnostics().completedFeedCalls, 0);
  assert.deepEqual(h.log.kills, ['SIGKILL']); assert.deepEqual(h.log.hooks, ['before']);
});

test('fragmentation preserves 64 KiB coalescing and installs passive packet handlers only after core data handlers', async () => {
  const output = Buffer.concat([tinyTar(), Buffer.alloc(65536)]), chunks = [];
  for (let i = 0; i < output.length; i += 17) chunks.push(output.subarray(i, i + 17));
  const h = harness({ chunks }); const result = await h.run();
  assert.equal(result.inventory.dataEvents, 2); assert.equal(observer.snapshotTarInventoryDiagnostics().feedCalls, 2);
  assert.equal(h.diagnostics.snapshot().stdoutEvents, chunks.length); assert.equal(h.diagnostics.snapshot().stdoutBytes, output.length);
  assert.deepEqual(h.log.listenerCounts, [['stdout', 0], ['stderr', 0], ['stdout', 1], ['stderr', 1]]);
});

test('raw packet cap plus one and stderr/expanded byte limits remain independent of the new extension budget', async () => {
  const bytes = tinyTar();
  assert.equal((await harness({ chunks: [bytes.subarray(0, 1024), bytes.subarray(1024)], limits: { maxStreamEvents: 2 } }).run()).streamEvents, 2);
  await rejects(harness({ chunks: [bytes.subarray(0, 512), bytes.subarray(512, 1024), bytes.subarray(1024)], limits: { maxStreamEvents: 2 } }).run(), 'E_LIMIT');
  await rejects(harness({ stderr: [Buffer.alloc(8193)] }).run(), 'E_OUTPUT');
  await rejects(harness({ limits: { maxExpandedBytes: bytes.length - 1 } }).run(), 'E_OUTPUT');
});

test('full EOF, metadata and hash failures still prevent a successful fixture result', async () => {
  await rejects(harness({ extraEof: true }).run(), 'E_LENGTH');
  await rejects(harness({ changeHash: true }).run(), 'E_HASH');
  await rejects(harness({ changeMetadata: true }).run(), 'E_BINDING');
});

test('owned close and cleanup error precedence retain the original parser failure category', async () => {
  await rejects(harness({ chunks: [header({ type: 'L', size: 65537 })], closeError: 42 }).run(), 'E_CLOSE');
  assert.equal(observer.snapshotTarInventoryDiagnostics().errorCode, 'E_EXTENSION_BYTES');
  await rejects(harness({ chunks: [header({ type: 'L', size: 65537 })], noKillClose: true, limits: { cleanupMs: 5, maxTotalMs: 1000 } }).run(), 'E_CLEANUP');
  assert.equal(observer.snapshotTarInventoryDiagnostics().errorCode, 'E_EXTENSION_BYTES');
});

test('one private outstanding stdin write still waits for both callback and drain', async () => {
  const h = harness({ input: Buffer.alloc(65537, 7), deferWrites: true }); const pending = h.run(); await turns();
  assert.equal(h.log.writes.length, 1); h.log.writes[0].callback(); await turns(); assert.equal(h.log.writes.length, 1);
  h.child.stdin.emit('drain'); await turns(); assert.equal(h.log.writes.length, 2);
  h.child.stdin.emit('drain'); await turns(); h.log.writes[1].callback(); await pending;
  for (const write of h.log.writes) assert.deepEqual(write.bytes, write.snapshot);
  assert.equal(h.child.stdin.listenerCount('drain'), 0);
});

test('the fixed decoder argv, 16 MiB decoder memory option, clean C/UTC environment and three pipes are unchanged', async () => {
  const h = harness(); await h.run(); const root = pipeline.GNU_SDK_DESCRIPTOR.decoderRoot;
  assert.deepEqual(h.log.spawns, [[`${root}/ld-linux-x86-64.so.2`, [
    '--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', root, `${root}/xz`,
    '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=16777216', '--', '-',
  ], { cwd: root, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }]]);
});

test('a completely parsed fixture cannot pass the physical operation receipt gate or claim real archive inspection', async () => {
  const fixture = longFixture(), h = await mockOperation({ chunks: [fixture.bytes] }); const { exitCode, receipt } = await h.run();
  assert.equal(exitCode, 1); assert.equal(receipt.error, 'E_RECEIPT'); assert.equal(receipt.status, 'STOP');
  assert.equal(receipt.profile, 'registered-gnu-sdk-inventory-v4'); assert.equal(receipt.realArchiveInspected, false);
  assert.equal(receipt.cumulativeExtensionBytesLimit, 4194304); assert.equal(receipt.individualExtensionPayloadLimit, 65536);
  assert.equal(receipt.rawStreamEventLimit, 262144);
  for (const [key, pin] of Object.entries(GNU_SDK_V4_PINS)) assert.deepEqual(receipt[key], pin);
  assert.equal(receipt.tarDiagnostics.feedCalls, 3); assert.equal(receipt.tarDiagnostics.errorCode, null);
  assert.equal(receipt.candidateExecuted, true); assert.equal(Object.hasOwn(receipt, 'result'), false);
  assert.equal(receipt.sourceAccountingComplete, true); assert.equal(receipt.receiptAccountingComplete, true); assert.equal(receipt.stageAccountingComplete, true);
  assert.equal(h.log.reads.length, 7); assert.equal(h.log.stages.length, 2); assert.equal(h.log.stages[0], h.log.stages[1]);
  assert.deepEqual(h.log.stages[0], JSON.parse(receiptBytes).staged); assert.equal(h.log.preloads, 2);
  assert.equal(h.log.originalIdentity.file.size, '102296280'); assert.equal(h.fixture.log.spawns.length, 1);
  assert.deepEqual(h.fixture.log.closes, [42, 41]); assert.equal(h.fixture.log.reads.length, 4);
  for (const key of ['archiveExtracted', 'filesInstalled', 'pythonRuntimeInvoked', 'pythonFreeSubsetVerified', 'nativeQualified',
    'rustReady', 'trainingReady', 'hardRssBounded', 'hardDeadlineGuaranteed', 'processTreeBounded']) assert.equal(receipt[key], false);
});

test('the mocked zero-argument entry returns narrow E_TAR diagnostics without paths or provisional selections', async () => {
  const h = await mockOperation({ chunks: [header({ type: 'L', size: 65537 })] }); const { exitCode, receipt, text } = await h.run();
  assert.equal(exitCode, 1); assert.equal(receipt.error, 'E_TAR'); assert.equal(receipt.tarDiagnostics.errorCode, 'E_EXTENSION_BYTES');
  assert.equal(receipt.tarDiagnostics.errorPhase, 'feed'); assert.equal(receipt.diagnostics.stdoutEvents, 1);
  assert.equal(receipt.diagnostics.stdoutBytes, 512); assert.equal(receipt.diagnostics.stderrEvents, 0);
  assert.equal(receipt.candidateExecuted, null); assert.equal(receipt.realArchiveInspected, false);
  assert.equal(Object.hasOwn(receipt, 'result'), false); assert.equal(Object.hasOwn(receipt, 'selected'), false);
  assert.doesNotMatch(text, /sdk\/file|metadataSha256/);
});

for (const corrupt of ['tar-inventory', 'gnu-sdk-inventory-v2-operation', 'tar-observer']) test(corrupt + ' raw pin failure stops before any pipeline invocation', async () => {
  const h = await mockOperation({ corrupt }); const { receipt } = await h.run();
  assert.equal(receipt.error, 'E_SOURCE_PIN'); assert.equal(receipt.sourceAccountingComplete, false);
  assert.equal(h.log.inventoryCalls, 0); assert.equal(h.fixture.log.spawns.length, 0);
  assert.equal(receipt.candidateExecuted, false); assert.deepEqual(receipt.tarDiagnostics, blank);
});

test('source and receipt read failures preserve explicit partial-accounting labels and zero current-call observations', async () => {
  for (const options of [{ readFailure: true }, { receiptFailure: true }, { badReceipt: true }]) {
    const h = await mockOperation(options); const { receipt } = await h.run();
    assert.equal(receipt.error, options.badReceipt ? 'E_SOURCE_PIN' : 'E_IO');
    assert.equal(receipt.sourceAccountingComplete, !options.readFailure); assert.equal(receipt.receiptAccountingComplete, false);
    assert.equal(receipt.stageAccountingComplete, false); assert.deepEqual(receipt.tarDiagnostics, blank);
    assert.equal(receipt.candidateExecuted, false); assert.equal(h.log.inventoryCalls, 0);
    assert.match(receipt.sourceCountersScope, /attempted source reads/); assert.match(receipt.receiptCountersScope, /completed reads/);
  }
});

test('stage and preload refusals stop before the child with only completed-helper accounting', async () => {
  for (const options of [{ stageFailure: true }, { preloadFailure: true }]) {
    const h = await mockOperation(options); const { receipt } = await h.run();
    assert.equal(receipt.error, 'E_PREREQUISITE');
    assert.equal(receipt.stageAccountingComplete, !options.stageFailure); assert.equal(h.fixture.log.spawns.length, 0);
    assert.equal(receipt.candidateExecuted, false); assert.equal(receipt.tarDiagnostics.feedCalls, 0);
  }
});

test('spawn errors remain nullable execution with zero packets and retained late-error handlers', async () => {
  const h = await mockOperation({ spawnError: true }); const { receipt } = await h.run();
  assert.equal(receipt.error, 'E_SPAWN'); assert.equal(receipt.candidateExecuted, null); assert.equal(receipt.counts.spawnEvents, 0);
  assert.equal(receipt.diagnostics.stdoutEvents, 0); assert.equal(receipt.diagnostics.stderrBytes, 0);
  for (const emitter of [h.fixture.child, h.fixture.child.stdin, h.fixture.child.stdout, h.fixture.child.stderr]) {
    assert.ok(emitter.listenerCount('error') > 0); assert.doesNotThrow(() => emitter.emit('error', new Error('late mock error')));
  }
});

test('the one-child wrapper blocks a second attempt without launching a second mock child', async () => {
  const h = await mockOperation({ secondAttempt: true }); const { receipt } = await h.run();
  assert.equal(receipt.error, 'E_LIMIT'); assert.equal(receipt.counts.spawnAttempts, 2);
  assert.equal(h.fixture.log.spawns.length, 1); assert.equal(Object.hasOwn(receipt, 'result'), false);
});

test('the new operation and tests point only to the parent-owned v4 namespace without requiring unpublished index entries', () => {
  const pointer = '// SPEC: _spec/tooling/native-ingress/gnu-sdk-inventory-v4.puml\n';
  for (const name of ['gnu-sdk-inventory-v4-operation', 'gnu-sdk-inventory-v4-operation.test']) assert.ok(read(name).toString().startsWith(pointer));
  const spec = '_spec/tooling/native-ingress/gnu-sdk-inventory-v4.puml';
  const files = ['tooling/native-ingress/gnu-sdk-inventory-v4-operation.mjs', 'tooling/native-ingress/gnu-sdk-inventory-v4-operation.test.mjs'];
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(x => x.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) assert.ok(diagram.includes("' covers: " + file + '\n'));
});
