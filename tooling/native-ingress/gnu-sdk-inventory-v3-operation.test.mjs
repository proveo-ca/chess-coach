// SPEC: _spec/tooling/native-ingress/gnu-sdk-inventory-v3.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { GNU_SDK_LIMITS as v1Limits } from './gnu-sdk-inventory.mjs';
import { GNU_SDK_V3_PINS, runRegisteredGnuSdkInventoryV3 } from './gnu-sdk-inventory-v3-operation.mjs';
import { createTarInventory, observeTarInventory, snapshotTarInventoryDiagnostics } from './tar-observer.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const read = name => fs.readFileSync(new URL('./' + name + '.mjs', import.meta.url));
const names = ['tar-inventory', 'elf-metadata', 'xz-staging', 'gnu-sdk-inventory', 'gnu-sdk-inventory-v2-operation', 'tar-observer'];
const captured = new Map(names.map(name => [name, read(name)]));
const source = read('gnu-sdk-inventory-v3-operation').toString('utf8');
const observerRaw = captured.get('tar-observer');
const receiptBytes = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/xz-qualification.receipt.json', import.meta.url));
const link = (bytes, name, dependencyUri) => Buffer.from(bytes.toString('utf8')
  .replace("from './" + name + ".mjs'", "from '" + dependencyUri + "'"));
const helper = await import(uri(captured.get('gnu-sdk-inventory-v2-operation')));
const transformed = helper.transformSdkInventoryV2Source(captured.get('gnu-sdk-inventory'));
const linkedObserver = link(observerRaw, 'tar-inventory', uri(captured.get('tar-inventory')));
const observerUri = uri(linkedObserver);
const linkedInventory = link(transformed, 'tar-inventory', observerUri);
const [pipeline, sharedObserver] = await Promise.all([import(uri(linkedInventory)), import(observerUri)]);
const blank = { feedCalls: 0, completedFeedCalls: 0, attemptedFeedBytes: 0,
  errorPhase: null, errorCode: null, diagnosticCountersComplete: true };
const snapshot = snapshotTarInventoryDiagnostics;
const stub = (feed = () => [], finish = () => ({})) => Object.freeze({ feed, finish });
const turns = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const gate = () => ({ stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true });
function sameThrow(fn, expected) {
  let threw = false;
  try { fn(); } catch (error) { threw = true; assert.equal(error, expected); }
  assert.equal(threw, true);
}
const rejects = (pending, code) => assert.rejects(pending, error => {
  assert.equal(error.code, code); assert.ok(Object.isFrozen(error));
  for (const key of ['inventory', 'selected', 'diagnostics', 'cause']) assert.equal(Object.hasOwn(error, key), false);
  return true;
});

function header(path = 'sdk/bin/gcc', size = 0, type = '0') {
  const bytes = Buffer.alloc(512);
  bytes.write(path, 0, 100, 'utf8');
  for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, size], [136, 12, 0]]) {
    bytes.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
  }
  bytes.fill(32, 148, 156); bytes[156] = type.charCodeAt(0);
  bytes.write('ustar\0', 257, 6, 'ascii'); bytes.write('00', 263, 2, 'ascii');
  const checksum = bytes.reduce((sum, byte) => sum + byte, 0);
  bytes.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return bytes;
}
const tar = (paths = ['sdk/bin/gcc']) => Buffer.concat([...paths.map(path => header(path)), Buffer.alloc(1024)]);
const malformed = () => { const bytes = tar(); bytes[0] ^= 1; return bytes; };

function harness(options = {}) {
  const archive = options.archive ?? Buffer.from('0123456789');
  const chunks = options.chunks ?? [tar()];
  const diagnostics = helper.createSdkV2Diagnostics();
  const log = { spawns: [], writes: [], kills: [], closes: [], hooks: [], listenerCounts: [], spawnEvents: 0 };
  const stats = {
    root: { dev: 11n, ino: 101n, mode: 0o40700n, uid: 1000n, gid: 1000n, nlink: 2n, size: 4096n, mtimeNs: 100n, ctimeNs: 101n },
    file: { dev: 22n, ino: 202n, mode: 0o100600n, uid: 1000n, gid: 1000n, nlink: 1n, size: BigInt(archive.length), mtimeNs: 200n, ctimeNs: 201n },
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
      return archive.copy(buffer, offset, position, position + length);
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
    child.kill = signal => {
      log.kills.push(signal);
      if (!options.noKillClose) queueMicrotask(() => child.emit('close', null, signal));
    };
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
    child.once('spawn', () => {
      log.spawnEvents++;
      assert.equal(child.stdout.listenerCount('data'), 1); assert.equal(child.stderr.listenerCount('data'), 1);
      diagnostics.observeSdkChild(child);
    });
    assert.equal(child.stdout.listenerCount('data'), 0); assert.equal(child.stderr.listenerCount('data'), 0);
    queueMicrotask(() => options.spawnError ? child.emit('error', new Error('mock failure')) : child.emit('spawn'));
    return child;
  };
  const run = pipeline.createSdkInventoryFixtureRunner({ archiveBytes: archive.length, archiveSha256: sha(archive), limits: options.limits ?? {} }, {
    fs: io, spawn,
    beforeDecode: () => { log.hooks.push('before'); return gate(); },
    afterDecode: () => { log.hooks.push('after'); return gate(); },
  });
  return { run: () => run(expected), diagnostics, log, get child() { return child; } };
}

let mockId = 0;
async function mockOperation(runInventory, options = {}) {
  const key = '__gnuSdkV3Mock' + ++mockId;
  const log = { reads: [], stages: [], preloads: 0, spawns: 0 };
  const context = {
    fs: { readFileSync(path) {
      log.reads.push(path);
      if (options.readFailure) throw new Error('mock source read');
      const prefix = '/tmp/opencode/f9-bootstrap-correspondence/';
      if (path === prefix + '_spec/tooling/native-ingress/xz-qualification.receipt.json') {
        if (options.receiptFailure) throw new Error('mock receipt read');
        return receiptBytes;
      }
      const name = path.slice((prefix + 'tooling/native-ingress/').length, -4);
      assert.equal(path, prefix + 'tooling/native-ingress/' + name + '.mjs'); assert.ok(captured.has(name));
      return options.corrupt === name ? Buffer.from('corrupt') : captured.get(name);
    } },
    spawn() {
      log.spawns++;
      const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
      queueMicrotask(() => { if (!options.noSpawnEvent) child.emit('spawn'); });
      return child;
    },
    verifyStagedXzImages(input) {
      log.stages.push(input);
      if (options.stageFailure) throw new helper.NewGnuSdkInventoryError('E_BINDING');
      return { counters: { fsCalls: 10, readBytes: 100, closeAttempts: 5 } };
    },
    assertNoSystemPreload() { log.preloads++; return !options.preloadFailure; },
    runGnuSdkInventory: (identity, deps) => runInventory(identity, deps, log),
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
    const operation = await import(uri(mockedSource));
    assert.equal(log.reads.length, 0);
    return { log, run: async () => {
      const result = await operation.runRegisteredGnuSdkInventoryV3();
      assert.ok(Object.isFrozen(result)); return { ...result, receipt: JSON.parse(result.text) };
    } };
  } finally { delete globalThis[key]; }
}

const mockSuccess = async (identity, deps) => {
  assert.equal(identity.file.size, '102296280');
  const parser = sharedObserver.createTarInventory();
  await deps.beforeDecode(); const child = deps.spawn('mock-only'); await turns();
  const bytes = tar(); child.stdout.emit('data', bytes); parser.feed(bytes);
  await deps.afterDecode();
  return { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: false, archiveDataBytes: 204592560,
    closeAttempts: 2, extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false,
    selected: [], inventory: parser.finish() };
};

test('v3 imports inertly and exposes one zero-argument fixed production operation', () => {
  assert.equal(runRegisteredGnuSdkInventoryV3.length, 0);
  assert.doesNotMatch(source, /await runRegisteredGnuSdkInventoryV3|process\.(?:env|argv)|createSdkInventoryFixtureRunner/);
  assert.doesNotMatch(source, /\b(?:fetch|unlink|rmSync|mkdirSync|writeFileSync|writeSync|rename|execFileSync)\s*\(/);
});

test('v1 and the current separately namespaced v2 source, operators and tests remain exact', () => {
  for (const [name, bytes, digest] of [
    ['gnu-sdk-inventory', 23261, 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29'],
    ['gnu-sdk-inventory.test', 33532, '67825a3e8c685c0fddafc554076b9203a9b6e9ac5e1a83cfb4d4459e5e84e9cc'],
    ['gnu-sdk-inventory-operation', 6666, '3b9dfbf8c7b045884af420b43c24bff6f90eea04aa8e5b6e967af1b22ec3411f'],
    ['gnu-sdk-inventory-operation.test', 4010, '79a915de890809dc3284cd9e5204b08af6239e120f0f49177d98512d3de51ad4'],
    ['gnu-sdk-inventory-v2-operation', 10102, '39da4bc85f6e7eaaecb0abd157d59ec4c2dcb6191a19c9247cbadd0080ae767a'],
    ['gnu-sdk-inventory-v2-operation.test', 30930, '3c4c3ebb98a0880d487c3d638714aeba0423bc3aabef4122d474bf506308a3c2'],
  ]) { const actual = read(name); assert.equal(actual.length, bytes); assert.equal(sha(actual), digest); }
});

test('all six raw source pins and the unchanged qualification receipt match captured bytes', () => {
  const pins = [...source.matchAll(/\['([a-z0-9-]+)', (\d+), '([a-f0-9]{64})'\]/g)];
  assert.deepEqual(pins.map(pin => pin[1]), names);
  for (const [, name, size, digest] of pins) {
    assert.equal(captured.get(name).length, Number(size)); assert.equal(sha(captured.get(name)), digest);
  }
  assert.equal(receiptBytes.length, 4239);
  assert.equal(sha(receiptBytes), 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233');
  assert.ok(source.includes(sha(receiptBytes)));
});

test('observer and full pipeline links match independent deterministic byte pins', () => {
  for (const [bytes, pin] of [[observerRaw, GNU_SDK_V3_PINS.observerSourcePin], [linkedObserver, GNU_SDK_V3_PINS.linkedObserverSourcePin],
    [linkedInventory, GNU_SDK_V3_PINS.linkedSourcePin], [transformed, GNU_SDK_V3_PINS.transformedSourcePin]]) {
    assert.deepEqual({ bytes: bytes.length, sha256: sha(bytes) }, pin); assert.ok(Object.isFrozen(pin));
  }
  const stage = link(captured.get('xz-staging'), 'elf-metadata', uri(captured.get('elf-metadata')));
  assert.equal(stage.length, 43154); assert.equal(sha(stage), '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2');
});

test('the source graph uses one exact observer URI and captured helper bytes, never relative runtime imports', () => {
  assert.ok(linkedInventory.toString().includes("from '" + observerUri + "'"));
  assert.equal(linkedObserver.toString().includes("from './tar-inventory.mjs'"), false);
  assert.match(source, /const observerUri = uri\(observerSource\)/);
  assert.match(source, /link\(transformed, 'tar-inventory', observerUri\)/);
  assert.match(source, /import\(observerUri\)/);
  assert.match(source, /import\(uri\(sources.get\('gnu-sdk-inventory-v2-operation'\)\)\)/);
  assert.doesNotMatch(source, /import\(['"]\.\//);
});

test('only the accepted raw stream literal changes; every parser/header/byte/time bound remains intact', () => {
  assert.deepEqual(Buffer.from(transformed.toString().replace('maxStreamEvents: 262_144', 'maxStreamEvents: 32_768')), captured.get('gnu-sdk-inventory'));
  assert.equal(pipeline.GNU_SDK_LIMITS.maxStreamEvents, 262144); assert.equal(v1Limits.maxStreamEvents, 32768);
  assert.deepEqual({ ...pipeline.GNU_SDK_LIMITS, maxStreamEvents: 32768 }, v1Limits);
  assert.match(transformed.toString(), /--memlimit-decompress=16777216/);
  assert.match(transformed.toString(), /Buffer.alloc\(65_536\)/);
});

test('all archive identity fields and the complete parent gate retain v2 bytes', () => {
  const old = captured.get('gnu-sdk-inventory-v2-operation').toString();
  for (const pattern of [/const identity = \{[\s\S]*?\n\};/u, /const gate = \(\) => \{[\s\S]*?\n    \};/u]) {
    assert.equal(source.match(pattern)?.[0], old.match(pattern)?.[0]); assert.ok(source.match(pattern));
  }
  assert.match(source, /function guard\(limit = 130000\)/);
  assert.match(source, /guard\(10000\)/);
});

test('observer error whitelist equals the exact constants supported by the frozen TAR source', () => {
  const originalCodes = [...captured.get('tar-inventory').toString().matchAll(/(?:fail|new InventoryError)\('([A-Z_]+)'/g)].map(match => match[1]);
  const list = observerRaw.toString().match(/const codes = new Set\(\[([\s\S]*?)\]\)/)[1];
  const observedCodes = [...list.matchAll(/'(E_[A-Z_]+)'/g)].map(match => match[1]);
  assert.deepEqual([...new Set(observedCodes)].sort(), [...new Set(originalCodes)].sort());
  assert.doesNotMatch(observerRaw.toString(), /\.message|node:(?:fs|crypto|child_process)|\.on\(|\.resume\(|\.pause\(/);
});

test('trusted parser feed and finish results pass through by exact identity with original arguments', () => {
  const events = Object.freeze([Object.freeze({ privateTestPath: 'not-in-snapshot' })]), result = Object.freeze({ complete: true });
  const bytes = Buffer.alloc(7), extra = {};
  const parser = observeTarInventory(stub((...args) => { assert.deepEqual(args, [bytes, extra]); return events; }, () => result));
  assert.ok(Object.isFrozen(parser)); assert.deepEqual(Object.keys(parser), ['feed', 'finish']);
  assert.equal(parser.feed(bytes, extra), events); assert.equal(parser.finish(), result);
  assert.deepEqual(snapshot(), { ...blank, feedCalls: 1, completedFeedCalls: 1, attemptedFeedBytes: 7 });
  assert.doesNotMatch(JSON.stringify(snapshot()), /not-in-snapshot|complete":true/);
});

test('feed errors pass through by identity with attempted bytes but no completed call', () => {
  const error = Object.freeze(Object.assign(new Error('private message'), { code: 'E_CHECKSUM' }));
  const parser = observeTarInventory(stub(() => { throw error; }));
  sameThrow(() => parser.feed(Buffer.alloc(5)), error);
  assert.deepEqual(snapshot(), { ...blank, feedCalls: 1, attemptedFeedBytes: 5, errorPhase: 'feed', errorCode: 'E_CHECKSUM' });
  assert.doesNotMatch(JSON.stringify(snapshot()), /private message/);
});

test('finish errors pass through by identity and cannot overwrite a prior feed failure', () => {
  const first = { code: 'E_HEADERS' }, later = { code: 'E_SEALED' };
  const parser = observeTarInventory(stub(() => { throw first; }, () => { throw later; }));
  sameThrow(() => parser.feed(Buffer.alloc(3)), first); sameThrow(() => parser.finish(), later);
  assert.equal(snapshot().errorPhase, 'feed'); assert.equal(snapshot().errorCode, 'E_HEADERS');
  const next = observeTarInventory(stub(undefined, () => { throw later; }));
  sameThrow(() => next.finish(), later);
  assert.deepEqual(snapshot(), { ...blank, errorPhase: 'finish', errorCode: 'E_SEALED' });
});

test('unknown own codes and inherited codes remain UNCLASSIFIED instead of leaking arbitrary text', () => {
  for (const error of [{ code: 'E_SECRET_PRIVATE_HEADER' }, { code: 123 }, Object.create({ code: 'E_CHECKSUM' }), null, 'private-thrown-string']) {
    const parser = observeTarInventory(stub(() => { throw error; })); sameThrow(() => parser.feed(Buffer.alloc(1)), error);
    assert.equal(snapshot().errorCode, 'UNCLASSIFIED'); assert.doesNotMatch(JSON.stringify(snapshot()), /PRIVATE_HEADER|private-thrown-string/);
  }
});

test('error code/message getters and proxy traps never execute while classifying the original exception', () => {
  const error = Object.defineProperties({}, {
    code: { get() { assert.fail('code getter invoked'); } }, message: { get() { assert.fail('message getter invoked'); } },
  });
  for (const thrown of [error, new Proxy(error, { getOwnPropertyDescriptor() { assert.fail('proxy trap'); }, get() { assert.fail('proxy get'); } })]) {
    const parser = observeTarInventory(stub(() => { throw thrown; }));
    sameThrow(() => parser.feed(Buffer.alloc(1)), thrown); assert.equal(snapshot().errorCode, 'UNCLASSIFIED');
  }
});

test('intrinsic byte length ignores a shadowed length getter without altering the delegated input', () => {
  const bytes = Buffer.alloc(9); Object.defineProperty(bytes, 'length', { get() { assert.fail('length getter'); } });
  const parser = observeTarInventory(stub(value => { assert.equal(value, bytes); return []; }));
  parser.feed(bytes); assert.equal(snapshot().attemptedFeedBytes, 9); assert.equal(snapshot().diagnosticCountersComplete, true);
});

test('invalid chunks mark diagnostics incomplete but still reach and preserve the original parser outcome', () => {
  const proxy = new Proxy(Buffer.alloc(1), { get() { assert.fail('chunk proxy'); } });
  for (const value of [null, {}, proxy]) {
    let calls = 0;
    const parser = observeTarInventory(stub(input => { calls++; assert.equal(input, value); return null; }));
    assert.equal(parser.feed(value), null); assert.equal(calls, 1);
    assert.equal(snapshot().diagnosticCountersComplete, false); assert.equal(snapshot().completedFeedCalls, 1);
  }
  const real = createTarInventory(); assert.throws(() => real.feed(proxy), { code: 'E_CHUNK' });
  assert.equal(snapshot().errorCode, 'E_CHUNK'); assert.equal(snapshot().diagnosticCountersComplete, false);
});

test('feed call counters saturate without stopping the trusted delegate or counting returned entries', () => {
  let calls = 0;
  const parser = observeTarInventory(stub(() => { calls++; return [1, 2, 3]; }));
  const bytes = Buffer.alloc(0);
  for (let i = 0; i < 32769; i++) parser.feed(bytes);
  assert.equal(snapshot().diagnosticCountersComplete, true);
  parser.feed(bytes); assert.equal(calls, 32770);
  assert.equal(snapshot().feedCalls, 32769); assert.equal(snapshot().completedFeedCalls, 32769);
  assert.equal(snapshot().diagnosticCountersComplete, false);
});

test('attempted byte counters saturate independently using repeated small owned memory', () => {
  const parser = observeTarInventory(stub()); const bytes = Buffer.alloc(1048576);
  for (let i = 0; i < 1025; i++) parser.feed(bytes);
  assert.equal(snapshot().attemptedFeedBytes, 1073741824 + 1048576); assert.equal(snapshot().diagnosticCountersComplete, true);
  parser.feed(Buffer.alloc(1)); assert.equal(snapshot().attemptedFeedBytes, 1073741824 + 1048576);
  assert.equal(snapshot().completedFeedCalls, 1026); assert.equal(snapshot().diagnosticCountersComplete, false);
});

test('latest snapshots reset for a new parser, remain frozen, and ignore subsequent calls on an older parser', () => {
  const first = observeTarInventory(stub()); first.feed(Buffer.alloc(2)); const prior = snapshot();
  const second = observeTarInventory(stub()); assert.deepEqual(snapshot(), blank);
  first.feed(Buffer.alloc(3)); assert.deepEqual(snapshot(), blank);
  second.feed(Buffer.alloc(1)); assert.equal(snapshot().attemptedFeedBytes, 1);
  assert.ok(Object.isFrozen(prior)); assert.equal(prior.attemptedFeedBytes, 2);
});

test('constructor exceptions preserve original identity with no fabricated create error phase', async () => {
  const key = '__gnuSdkV3Factory' + ++mockId, error = { code: 'E_LIMITS' };
  globalThis[key] = error;
  const factoryUri = uri(`export function createTarInventory() { throw globalThis[${JSON.stringify(key)}]; }`);
  try {
    const observed = await import(uri(link(observerRaw, 'tar-inventory', factoryUri)));
    const previous = observed.observeTarInventory(stub(() => { throw { code: 'E_CHECKSUM' }; }));
    assert.throws(() => previous.feed(Buffer.alloc(1)), { code: 'E_CHECKSUM' });
    assert.equal(observed.snapshotTarInventoryDiagnostics().errorPhase, 'feed');
    sameThrow(() => observed.createTarInventory(), error); assert.deepEqual(observed.snapshotTarInventoryDiagnostics(), blank);
  } finally { delete globalThis[key]; }
});

test('real tiny TAR success records calls and bytes without serializing paths or provisional events', () => {
  const parser = createTarInventory(); const bytes = tar(['sdk/bin/private-gcc']);
  const events = parser.feed(bytes), result = parser.finish();
  assert.ok(Object.isFrozen(events)); assert.equal(events.length, 1); assert.equal(result.entries, 1);
  assert.equal(result.realArchiveInspected, false);
  assert.deepEqual(snapshot(), { ...blank, feedCalls: 1, completedFeedCalls: 1, attemptedFeedBytes: bytes.length });
  assert.deepEqual(Object.keys(snapshot()), Object.keys(blank)); assert.doesNotMatch(JSON.stringify(snapshot()), /private-gcc|metadataSha/);
});

test('real checksum errors preserve the first feed failure on subsequent finish calls', () => {
  const parser = createTarInventory(); const bytes = malformed(); let original;
  assert.throws(() => parser.feed(bytes), error => { original = error; return error.code === 'E_CHECKSUM'; });
  sameThrow(() => parser.finish(), original);
  assert.deepEqual(snapshot(), { ...blank, feedCalls: 1, attemptedFeedBytes: bytes.length, errorPhase: 'feed', errorCode: 'E_CHECKSUM' });
});

test('real truncated finish and sealed parser failures retain their exact narrow categories', () => {
  const parser = createTarInventory(); parser.feed(header()); assert.throws(() => parser.finish(), { code: 'E_TRUNCATED' });
  assert.equal(snapshot().errorPhase, 'finish'); assert.equal(snapshot().errorCode, 'E_TRUNCATED');
  const sealed = createTarInventory(); sealed.feed(tar()); sealed.finish(); assert.throws(() => sealed.finish(), { code: 'E_SEALED' });
  assert.equal(snapshot().errorPhase, 'finish'); assert.equal(snapshot().errorCode, 'E_SEALED');
});

test('unchanged header and extension byte limits still reject through the real parser', () => {
  const parser = createTarInventory({ maxHeaders: 1 }); assert.throws(() => parser.feed(tar(['sdk/a', 'sdk/b'])), { code: 'E_HEADERS' });
  assert.equal(snapshot().errorCode, 'E_HEADERS');
  const extension = createTarInventory({ maxExtensionBytes: 1 });
  assert.throws(() => extension.feed(header('sdk/extension', 2, 'x')), { code: 'E_EXTENSION_BYTES' });
  assert.equal(snapshot().errorCode, 'E_EXTENSION_BYTES');
});

test('the original 32768 parser-feed event limit still fails exactly at plus one', () => {
  const parser = createTarInventory(); parser.feed(tar()); const zero = Buffer.alloc(1);
  for (let i = 1; i < 32768; i++) parser.feed(zero);
  assert.throws(() => parser.feed(zero), { code: 'E_DATA_EVENTS' });
  assert.equal(snapshot().feedCalls, 32769); assert.equal(snapshot().completedFeedCalls, 32768);
  assert.equal(snapshot().errorCode, 'E_DATA_EVENTS'); assert.equal(snapshot().diagnosticCountersComplete, true);
});

test('captured observer and actual mocked inventory pipeline share the exact module instance', async () => {
  const h = harness(); const result = await h.run();
  assert.equal(await import(observerUri), sharedObserver);
  assert.equal(result.mockOnly, true); assert.equal(result.realArchiveInspected, false);
  assert.equal(sharedObserver.snapshotTarInventoryDiagnostics().feedCalls, 1);
  assert.equal(sharedObserver.snapshotTarInventoryDiagnostics().completedFeedCalls, 1);
  assert.equal(sharedObserver.snapshotTarInventoryDiagnostics().attemptedFeedBytes, tar().length);
  assert.equal(sharedObserver.snapshotTarInventoryDiagnostics().errorCode, null);
  assert.deepEqual(h.log.hooks, ['before', 'after']); assert.deepEqual(h.log.closes, [42, 41]);
});

test('real malformed TAR through the mocked pipeline stays E_TAR while observer exposes E_CHECKSUM', async () => {
  const h = harness({ chunks: [malformed()] }); await rejects(h.run(), 'E_TAR');
  assert.deepEqual(sharedObserver.snapshotTarInventoryDiagnostics(), { ...blank, feedCalls: 1,
    attemptedFeedBytes: malformed().length, errorPhase: 'feed', errorCode: 'E_CHECKSUM' });
  assert.equal(h.diagnostics.snapshot().stdoutEvents, 1); assert.equal(h.diagnostics.snapshot().stdoutBytes, malformed().length);
  assert.deepEqual(h.log.hooks, ['before']); assert.deepEqual(h.log.kills, ['SIGKILL']);
});

test('a late finish failure discards provisional selections after both parent gates and owned FD closes', async () => {
  const h = harness({ chunks: [header()] }); await rejects(h.run(), 'E_TAR');
  assert.deepEqual(sharedObserver.snapshotTarInventoryDiagnostics(), { ...blank, feedCalls: 1,
    completedFeedCalls: 1, attemptedFeedBytes: 512, errorPhase: 'finish', errorCode: 'E_TRUNCATED' });
  assert.deepEqual(h.log.hooks, ['before', 'after']); assert.deepEqual(h.log.closes, [42, 41]);
  assert.deepEqual(h.log.kills, []);
});

test('close and cleanup error precedence remain unchanged without erasing the first parser category', async () => {
  await rejects(harness({ chunks: [malformed()], closeError: 42 }).run(), 'E_CLOSE');
  assert.equal(sharedObserver.snapshotTarInventoryDiagnostics().errorCode, 'E_CHECKSUM');
  await rejects(harness({ chunks: [malformed()], noKillClose: true, limits: { cleanupMs: 5, maxTotalMs: 1000 } }).run(), 'E_CLEANUP');
  assert.equal(sharedObserver.snapshotTarInventoryDiagnostics().errorCode, 'E_CHECKSUM');
});

test('fragmented output still coalesces at 64 KiB and passive packet handlers attach after the core', async () => {
  const output = Buffer.concat([tar(), Buffer.alloc(65536)]), chunks = [];
  for (let i = 0; i < output.length; i += 19) chunks.push(output.subarray(i, i + 19));
  const h = harness({ chunks }); const result = await h.run();
  assert.equal(result.inventory.dataEvents, 2); assert.equal(sharedObserver.snapshotTarInventoryDiagnostics().feedCalls, 2);
  assert.equal(sharedObserver.snapshotTarInventoryDiagnostics().attemptedFeedBytes, output.length);
  assert.equal(h.diagnostics.snapshot().stdoutEvents, chunks.length);
  assert.deepEqual(h.log.listenerCounts, [['stdout', 0], ['stderr', 0], ['stdout', 1], ['stderr', 1]]);
});

test('raw packet and expanded byte boundaries remain independent of TAR diagnostics', async () => {
  const bytes = tar();
  const boundary = harness({ chunks: [bytes.subarray(0, 1024), bytes.subarray(1024)], limits: { maxStreamEvents: 2 } });
  assert.equal((await boundary.run()).streamEvents, 2);
  await rejects(harness({ chunks: [bytes.subarray(0, 512), bytes.subarray(512, 1024), bytes.subarray(1024)], limits: { maxStreamEvents: 2 } }).run(), 'E_LIMIT');
  assert.equal(sharedObserver.snapshotTarInventoryDiagnostics().feedCalls, 0);
  await rejects(harness({ limits: { maxExpandedBytes: bytes.length - 1 } }).run(), 'E_OUTPUT');
  assert.equal(sharedObserver.snapshotTarInventoryDiagnostics().errorCode, null);
});

test('one private outstanding write still requires callback and drain before buffer reuse', async () => {
  const h = harness({ archive: Buffer.alloc(65537, 7), deferWrites: true }); const pending = h.run(); await turns();
  assert.equal(h.log.writes.length, 1); h.log.writes[0].callback(); await turns(); assert.equal(h.log.writes.length, 1);
  h.child.stdin.emit('drain'); await turns(); assert.equal(h.log.writes.length, 2);
  h.child.stdin.emit('drain'); await turns(); h.log.writes[1].callback(); await pending;
  for (const write of h.log.writes) assert.deepEqual(write.bytes, write.snapshot);
  assert.equal(h.child.stdin.listenerCount('drain'), 0);
});

test('decoder argv, 16 MiB dictionary bound, clean C/UTC environment and three pipes stay exact', async () => {
  const h = harness(); await h.run(); const root = pipeline.GNU_SDK_DESCRIPTOR.decoderRoot;
  assert.deepEqual(h.log.spawns, [[`${root}/ld-linux-x86-64.so.2`, [
    '--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', root, `${root}/xz`,
    '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=16777216', '--', '-',
  ], { cwd: root, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }]]);
});

test('late child and pipe errors remain handled after observation without stripping core listeners', async () => {
  const h = harness(); await h.run();
  for (const emitter of [h.child, h.child.stdin, h.child.stdout, h.child.stderr]) {
    assert.ok(emitter.listenerCount('error') > 0); assert.doesNotThrow(() => emitter.emit('error', new Error('mock late error')));
  }
});

test('successful mocked outer receipt includes the shared TAR snapshot, exact pins and all old negative claims', async () => {
  const h = await mockOperation(mockSuccess); const { exitCode, receipt } = await h.run();
  assert.equal(exitCode, 0); assert.equal(receipt.profile, 'registered-gnu-sdk-inventory-v3');
  for (const [key, pin] of Object.entries(GNU_SDK_V3_PINS)) assert.deepEqual(receipt[key], pin);
  assert.equal(receipt.rawStreamEventLimit, 262144); assert.equal(receipt.tarDiagnostics.feedCalls, 1);
  assert.equal(receipt.tarDiagnostics.completedFeedCalls, 1); assert.equal(receipt.tarDiagnostics.errorCode, null);
  assert.equal(h.log.reads.length, 7); assert.equal(h.log.stages.length, 2); assert.equal(h.log.stages[0], h.log.stages[1]);
  assert.deepEqual(h.log.stages[0], JSON.parse(receiptBytes).staged); assert.equal(h.log.preloads, 2);
  assert.equal(receipt.sourceAccountingComplete, true); assert.equal(receipt.receiptAccountingComplete, true);
  assert.equal(receipt.stageAccountingComplete, true); assert.equal(receipt.counts.receiptBytes, 4239);
  for (const key of ['archiveExtracted', 'filesInstalled', 'pythonRuntimeInvoked', 'pythonFreeSubsetVerified', 'nativeQualified',
    'rustReady', 'trainingReady', 'hardRssBounded', 'hardDeadlineGuaranteed', 'processTreeBounded']) assert.equal(receipt[key], false);
});

test('failed mocked outer receipt reports E_TAR and the original category without a provisional inventory prefix', async () => {
  const h = await mockOperation(async (identity, deps) => {
    const parser = sharedObserver.createTarInventory(); await deps.beforeDecode(); const child = deps.spawn('mock-only'); await turns();
    const bytes = malformed(); child.stdout.emit('data', bytes);
    try { parser.feed(bytes); } catch { throw new pipeline.GnuSdkInventoryError('E_TAR'); }
  });
  const { exitCode, receipt, text } = await h.run();
  assert.equal(exitCode, 1); assert.equal(receipt.error, 'E_TAR'); assert.equal(receipt.status, 'STOP');
  assert.equal(receipt.tarDiagnostics.errorCode, 'E_CHECKSUM'); assert.equal(receipt.tarDiagnostics.errorPhase, 'feed');
  assert.equal(receipt.diagnostics.stdoutEvents, 1); assert.equal(receipt.diagnostics.stdoutBytes, malformed().length);
  assert.equal(receipt.candidateExecuted, null); assert.equal(receipt.realArchiveInspected, false);
  assert.equal(Object.hasOwn(receipt, 'result'), false); assert.equal(Object.hasOwn(receipt, 'selected'), false);
  assert.doesNotMatch(text, /sdk\/bin|metadataSha256/);
});

for (const corrupt of ['gnu-sdk-inventory-v2-operation', 'tar-observer']) test(corrupt + ' pin failure stops before pipeline imports or a candidate', async () => {
  const h = await mockOperation(() => assert.fail('pipeline invoked'), { corrupt }); const { receipt } = await h.run();
  assert.equal(receipt.error, 'E_SOURCE_PIN'); assert.equal(receipt.sourceAccountingComplete, false);
  assert.equal(receipt.candidateExecuted, false); assert.equal(h.log.spawns, 0); assert.deepEqual(receipt.tarDiagnostics, blank);
});

test('failed source and receipt reads carry explicit partial-accounting labels and no stale TAR state', async () => {
  for (const options of [{ readFailure: true }, { receiptFailure: true }]) {
    const h = await mockOperation(() => assert.fail('pipeline invoked'), options); const { receipt } = await h.run();
    assert.equal(receipt.error, 'E_IO'); assert.equal(receipt.sourceAccountingComplete, !options.readFailure);
    assert.equal(receipt.receiptAccountingComplete, false); assert.equal(receipt.stageAccountingComplete, false);
    assert.deepEqual(receipt.tarDiagnostics, blank); assert.equal(receipt.candidateExecuted, false);
    assert.match(receipt.sourceCountersScope, /attempted source reads/); assert.match(receipt.receiptCountersScope, /completed reads/);
  }
});

test('stage and preload refusals keep scoped accounting and block the child', async () => {
  for (const options of [{ stageFailure: true }, { preloadFailure: true }]) {
    const h = await mockOperation(mockSuccess, options); const { receipt } = await h.run();
    assert.equal(receipt.error, options.stageFailure ? 'E_BINDING' : 'E_PRELOAD');
    assert.equal(receipt.stageAccountingComplete, !options.stageFailure); assert.equal(h.log.spawns, 0);
    assert.equal(receipt.candidateExecuted, false); assert.equal(receipt.tarDiagnostics.feedCalls, 0);
  }
});

test('spawn failure without a spawn event retains nullable execution and zero packet diagnostics', async () => {
  const h = await mockOperation(async (identity, deps) => {
    sharedObserver.createTarInventory(); await deps.beforeDecode(); deps.spawn('mock-only'); await turns(); throw new pipeline.GnuSdkInventoryError('E_SPAWN');
  }, { noSpawnEvent: true });
  const { receipt } = await h.run(); assert.equal(receipt.error, 'E_SPAWN'); assert.equal(receipt.candidateExecuted, null);
  assert.equal(receipt.counts.spawnEvents, 0); assert.equal(receipt.diagnostics.stdoutEvents, 0); assert.deepEqual(receipt.tarDiagnostics, blank);
});

test('a second child attempt never becomes a second spawn or automatic retry', async () => {
  const h = await mockOperation(async (identity, deps) => {
    sharedObserver.createTarInventory(); await deps.beforeDecode(); deps.spawn('mock-only'); await turns(); deps.spawn('mock-only');
  });
  const { receipt } = await h.run(); assert.equal(receipt.error, 'E_LIMIT'); assert.equal(h.log.spawns, 1);
  assert.equal(receipt.counts.spawnAttempts, 2); assert.equal(Object.hasOwn(receipt, 'result'), false);
});

test('late joint-gate rejection and outer byte overflow retain diagnostics but discard all inventory claims', async () => {
  for (const extra of [{ nativeQualified: true, selected: ['private-provisional-prefix'] }, { selected: ['x'.repeat(1048576)] }]) {
    const h = await mockOperation(async (...args) => ({ ...await mockSuccess(...args), ...extra }));
    const { receipt, text } = await h.run(); assert.equal(receipt.error, extra.nativeQualified ? 'E_RECEIPT' : 'E_OUTPUT');
    assert.equal(receipt.realArchiveInspected, false); assert.equal(Object.hasOwn(receipt, 'result'), false);
    assert.equal(receipt.tarDiagnostics.feedCalls, 1); assert.doesNotMatch(text, /private-provisional-prefix/);
    assert.ok(Buffer.byteLength(text) < 1048576);
  }
});

test('all three new files point only to the parent-owned v3 namespace without requiring unpublished owner metadata', () => {
  const pointer = '// SPEC: _spec/tooling/native-ingress/gnu-sdk-inventory-v3.puml\n';
  for (const name of ['tar-observer', 'gnu-sdk-inventory-v3-operation', 'gnu-sdk-inventory-v3-operation.test']) assert.ok(read(name).toString().startsWith(pointer));
  const spec = '_spec/tooling/native-ingress/gnu-sdk-inventory-v3.puml';
  const files = ['tooling/native-ingress/tar-observer.mjs', 'tooling/native-ingress/gnu-sdk-inventory-v3-operation.mjs', 'tooling/native-ingress/gnu-sdk-inventory-v3-operation.test.mjs'];
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(x => x.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) assert.ok(diagram.includes("' covers: " + file + '\n'));
});
