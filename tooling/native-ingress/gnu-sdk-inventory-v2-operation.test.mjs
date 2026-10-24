// SPEC: _spec/tooling/native-ingress/gnu-sdk-inventory-v2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { GNU_SDK_LIMITS as v1Limits } from './gnu-sdk-inventory.mjs';
import {
  GNU_SDK_V2_PINS, NewGnuSdkInventoryError, transformSdkInventoryV2Source,
  createSdkV2Diagnostics, runRegisteredGnuSdkInventoryV2,
} from './gnu-sdk-inventory-v2-operation.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:text/javascript;base64,' + Buffer.from(bytes).toString('base64');
const read = name => fs.readFileSync(new URL('./' + name, import.meta.url));
const raw = read('gnu-sdk-inventory.mjs');
const source = read('gnu-sdk-inventory-v2-operation.mjs').toString('utf8');
const originals = new Map(['tar-inventory', 'elf-metadata', 'xz-staging', 'gnu-sdk-inventory']
  .map(name => [name, read(name + '.mjs')]));
const receiptBytes = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/xz-qualification.receipt.json', import.meta.url));
const link = (bytes, name, dependency) => Buffer.from(bytes.toString('utf8')
  .replace("from './" + name + ".mjs'", "from '" + uri(dependency) + "'"));
const transformed = transformSdkInventoryV2Source(raw);
const linked = link(transformed, 'tar-inventory', originals.get('tar-inventory'));
const v2 = await import(uri(linked));
const gate = () => ({ stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true });
const turns = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const rejects = (pending, code) => assert.rejects(pending, error => {
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  assert.ok(Object.isFrozen(error));
  for (const key of ['selected', 'inventory', 'diagnostics', 'cause']) assert.equal(Object.hasOwn(error, key), false);
  return true;
});

function tar(paths = ['sdk/bin/gcc']) {
  const headers = paths.map(path => {
    const header = Buffer.alloc(512);
    header.write(path, 0, 100, 'utf8');
    for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, 0], [136, 12, 0]]) {
      header.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width, 'ascii');
    }
    header.fill(32, 148, 156); header[156] = 48;
    header.write('ustar\0', 257, 6, 'ascii'); header.write('00', 263, 2, 'ascii');
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
    return header;
  });
  return Buffer.concat([...headers, Buffer.alloc(1024)]);
}

function harness(options = {}) {
  const archive = options.archive ?? Buffer.from('0123456789');
  const chunks = options.chunks ?? [tar()];
  const diagnostics = createSdkV2Diagnostics();
  const log = { spawns: [], writes: [], closes: [], kills: [], hooks: [], listenerCounts: [], spawnEvents: 0 };
  const stats = {
    root: { dev: 11n, ino: 101n, mode: 0o40700n, uid: 1000n, gid: 1000n, nlink: 2n, size: 4096n, mtimeNs: 100n, ctimeNs: 101n },
    file: { dev: 22n, ino: 202n, mode: 0o100600n, uid: 1000n, gid: 1000n, nlink: 1n, size: BigInt(archive.length), mtimeNs: 200n, ctimeNs: 201n },
  };
  const expected = Object.fromEntries(Object.entries(stats).map(([kind, stat]) =>
    [kind, Object.fromEntries(Object.entries(stat).map(([key, value]) => [key, String(value)]))]));
  const kindOf = path => path === v2.GNU_SDK_DESCRIPTOR.root ? 'root' : path === v2.GNU_SDK_DESCRIPTOR.file ? 'file' : assert.fail('unexpected path');
  const io = {
    lstatSync: path => ({ ...stats[kindOf(path)] }),
    fstatSync: fd => ({ ...stats[fd === 41 ? 'root' : fd === 42 ? 'file' : assert.fail('unexpected fd')] }),
    openSync: path => kindOf(path) === 'root' ? 41 : 42,
    readSync(fd, buffer, offset, length, position) {
      assert.equal(fd, 42); assert.equal(offset, 0); assert.ok(length <= 65536);
      return archive.copy(buffer, offset, position, position + length);
    },
    closeSync: fd => { log.closes.push(fd); },
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
    child.kill = signal => { log.kills.push(signal); queueMicrotask(() => child.emit('close', null, signal)); };
    child.stdin.write = (bytes, callback) => {
      log.writes.push({ bytes, snapshot: Buffer.from(bytes), callback });
      if (options.deferWrites) return false;
      queueMicrotask(callback);
      return true;
    };
    child.stdin.end = () => {
      child.stdin.emit('finish');
      for (const chunk of chunks) child.stdout.emit('data', chunk);
      for (const chunk of options.stderr ?? []) child.stderr.emit('data', chunk);
      for (const name of ['stdout', 'stderr']) { child[name].emit('end'); child[name].emit('close'); }
      child.emit('exit', 0, null); child.emit('close', 0, null); child.stdin.emit('close');
    };
    child.once('spawn', () => {
      log.spawnEvents++;
      assert.equal(child.stdout.listenerCount('data'), 1);
      assert.equal(child.stderr.listenerCount('data'), 1);
      diagnostics.observeSdkChild(child);
    });
    assert.equal(child.stdout.listenerCount('data'), 0);
    assert.equal(child.stderr.listenerCount('data'), 0);
    queueMicrotask(() => options.spawnError ? child.emit('error', new Error('mock failure')) : child.emit('spawn'));
    return child;
  };
  const runner = v2.createSdkInventoryFixtureRunner({ archiveBytes: archive.length, archiveSha256: sha(archive), limits: options.limits ?? {} }, {
    fs: io, spawn,
    beforeDecode: () => { log.hooks.push('before'); return gate(); },
    afterDecode: () => { log.hooks.push('after'); return gate(); },
  });
  return { run: () => runner(expected), diagnostics, log, get child() { return child; } };
}

let mockId = 0;
async function mockOperation(runInventory, options = {}) {
  const key = '__gnuSdkV2Mock' + ++mockId;
  const log = { reads: [], stages: [], preloads: 0, spawns: 0 };
  const captured = new Map([...originals].map(([name, bytes]) =>
    ['/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/' + name + '.mjs', bytes]));
  captured.set('/tmp/opencode/f9-bootstrap-correspondence/_spec/tooling/native-ingress/xz-qualification.receipt.json', receiptBytes);
  const context = {
    fs: { readFileSync(path) {
      log.reads.push(path);
      if (options.readFailure) throw new Error('mock source read');
      assert.ok(captured.has(path));
      return options.corrupt ? Buffer.from('corrupt') : captured.get(path);
    } },
    spawn() {
      log.spawns++;
      const child = new EventEmitter();
      child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
      queueMicrotask(() => { if (!options.noSpawnEvent) child.emit('spawn'); });
      return child;
    },
    verifyStagedXzImages(input) {
      log.stages.push(input);
      if (options.stageFailure) throw new NewGnuSdkInventoryError('E_BINDING');
      return { counters: { fsCalls: 10, readBytes: 100, closeAttempts: 5 } };
    },
    assertNoSystemPreload() { log.preloads++; return options.preloadFailure ? false : true; },
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
    return { run: async () => {
      const result = await operation.runRegisteredGnuSdkInventoryV2();
      assert.ok(Object.isFrozen(result));
      return { ...result, receipt: JSON.parse(result.text) };
    }, log };
  } finally { delete globalThis[key]; }
}

const mockSuccess = async (identity, deps) => {
  assert.equal(identity.file.size, '102296280');
  await deps.beforeDecode();
  const child = deps.spawn('mock-only');
  await turns();
  child.stdout.emit('data', Buffer.alloc(9)); child.stderr.emit('data', Buffer.alloc(2));
  await deps.afterDecode();
  return { state: 'GNU_SDK_DATA_INVENTORY', mockOnly: false, archiveDataBytes: 204592560,
    closeAttempts: 2, extracted: false, nativeQualified: false, pythonFreeSubsetVerified: false,
    selected: [], inventory: { mockReceiptOnly: true } };
};

test('v2 exposes one inert zero-argument production entry without a CLI or adaptive live profile', () => {
  assert.equal(runRegisteredGnuSdkInventoryV2.length, 0);
  assert.doesNotMatch(source, /await runRegisteredGnuSdkInventoryV2|process\.(?:argv|env)|createSdkInventoryFixtureRunner/);
  assert.doesNotMatch(source, /\b(?:fetch|unlink|rmSync|mkdirSync|writeFileSync|writeSync|rename|execFileSync)\s*\(/);
});

test('frozen v1 raw source, operator, and both tests retain their published exact bytes', () => {
  for (const [name, size, digest] of [
    ['gnu-sdk-inventory.mjs', 23261, 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29'],
    ['gnu-sdk-inventory-operation.mjs', 6666, '3b9dfbf8c7b045884af420b43c24bff6f90eea04aa8e5b6e967af1b22ec3411f'],
    ['gnu-sdk-inventory.test.mjs', 33532, '67825a3e8c685c0fddafc554076b9203a9b6e9ac5e1a83cfb4d4459e5e84e9cc'],
    ['gnu-sdk-inventory-operation.test.mjs', 4010, '79a915de890809dc3284cd9e5204b08af6239e120f0f49177d98512d3de51ad4'],
  ]) { const bytes = read(name); assert.equal(bytes.length, size); assert.equal(sha(bytes), digest); }
});

test('all four source captures and the consumed receipt match the unchanged v1 registration', () => {
  const pins = [...source.matchAll(/\['([a-z-]+)', (\d+), '([a-f0-9]{64})'\]/g)];
  assert.deepEqual(pins.map(pin => pin[1]), [...originals.keys()]);
  for (const [, name, size, digest] of pins) {
    assert.equal(originals.get(name).length, Number(size)); assert.equal(sha(originals.get(name)), digest);
  }
  assert.equal(receiptBytes.length, 4239);
  assert.equal(sha(receiptBytes), 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233');
  assert.ok(source.includes(sha(receiptBytes)));
  assert.doesNotMatch(source, /stageXzImages\(|runRegisteredXzQualification\(|runXzFixtures\(/);
});

test('the checked transform changes exactly one number and no function body, import, or other byte', () => {
  assert.equal(raw.toString().split('maxStreamEvents: 32_768').length, 2);
  assert.equal(transformed.toString().split('maxStreamEvents: 262_144').length, 2);
  assert.deepEqual(Buffer.from(transformed.toString().replace('maxStreamEvents: 262_144', 'maxStreamEvents: 32_768')), raw);
  assert.deepEqual(transformSdkInventoryV2Source(raw), transformed);
  assert.deepEqual({ bytes: transformed.length, sha256: sha(transformed) }, GNU_SDK_V2_PINS.transformedSourcePin);
});

for (const [name, bytes] of [
  ['missing literal', Buffer.from(raw.toString().replace('maxStreamEvents: 32_768', 'maxStreamEvents: 32_769'))],
  ['duplicate literal', Buffer.concat([raw, Buffer.from('maxStreamEvents: 32_768')])],
  ['same-length wrong source hash', Buffer.from(raw.toString().replace('maxHeaders: 32_768', 'maxHeaders: 32_769'))],
]) test('transform rejects ' + name, () => {
  assert.throws(() => transformSdkInventoryV2Source(bytes), error => error instanceof NewGnuSdkInventoryError && error.code === 'E_SOURCE_PIN');
});

test('transformation preserves caller bytes and rejects non-buffers without invoking proxy traps', () => {
  const before = Buffer.from(raw); const output = transformSdkInventoryV2Source(raw); output.fill(0);
  assert.deepEqual(raw, before);
  const proxy = new Proxy(raw, { get() { assert.fail('proxy trap'); } });
  for (const value of [raw.toString(), new Uint8Array(raw), null, proxy]) {
    assert.throws(() => transformSdkInventoryV2Source(value), { code: 'E_SOURCE_PIN' });
  }
});

test('deterministic linked v2 and unchanged stage-to-ELF images match registered length and SHA', () => {
  assert.deepEqual({ bytes: linked.length, sha256: sha(linked) }, GNU_SDK_V2_PINS.linkedSourcePin);
  assert.deepEqual(link(transformSdkInventoryV2Source(raw), 'tar-inventory', originals.get('tar-inventory')), linked);
  const stage = link(originals.get('xz-staging'), 'elf-metadata', originals.get('elf-metadata'));
  assert.equal(stage.length, 43154);
  assert.equal(sha(stage), '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2');
});

test('only the raw packet cap changes while byte, header, read, memory and deadline limits stay fixed', () => {
  assert.equal(v1Limits.maxStreamEvents, 32768);
  assert.equal(v2.GNU_SDK_LIMITS.maxStreamEvents, 262144);
  assert.deepEqual({ ...v2.GNU_SDK_LIMITS, maxStreamEvents: 32768 }, v1Limits);
  assert.equal(v2.GNU_SDK_LIMITS.maxHeaders, 32768);
  assert.equal(v2.GNU_SDK_LIMITS.maxExpandedBytes, 1073741824);
  assert.match(transformed.toString(), /--memlimit-decompress=16777216/);
  assert.ok(Object.isFrozen(v2.GNU_SDK_LIMITS));
});

test('all nine root and file identity fields and the complete parent gate retain v1 registration bytes', () => {
  const old = read('gnu-sdk-inventory-operation.mjs').toString('utf8');
  for (const pattern of [/const identity = \{[\s\S]*?\n\};/u, /const gate = \(\) => \{[\s\S]*?\n    \};/u]) {
    const before = old.match(pattern), after = source.match(pattern);
    assert.ok(before); assert.ok(after); assert.equal(after[0], before[0]);
  }
});

test('public narrow errors and pin metadata are frozen and carry no mutable diagnostics', () => {
  const error = new NewGnuSdkInventoryError('E_LIMIT');
  assert.ok(Object.isFrozen(error)); assert.equal(error.code, 'E_LIMIT');
  assert.throws(() => { error.code = 'E_IO'; }, TypeError);
  assert.equal(Object.hasOwn(error, 'diagnostics'), false);
  assert.equal(new NewGnuSdkInventoryError('arbitrary').code, 'E_INPUT');
  assert.ok(Object.isFrozen(GNU_SDK_V2_PINS));
  for (const pin of Object.values(GNU_SDK_V2_PINS)) assert.ok(Object.isFrozen(pin));
});

test('a reduced two-packet boundary succeeds with diagnostics attached after both core data listeners', async () => {
  const output = tar();
  const h = harness({ chunks: [output.subarray(0, 1024), output.subarray(1024)], limits: { maxStreamEvents: 2 } });
  const result = await h.run();
  assert.equal(result.streamEvents, 2); assert.equal(result.mockOnly, true); assert.equal(result.realArchiveInspected, false);
  assert.equal(result.selected.length, 1);
  assert.deepEqual(h.log.listenerCounts, [['stdout', 0], ['stderr', 0], ['stdout', 1], ['stderr', 1]]);
  assert.equal(h.diagnostics.snapshot().stdoutEvents, 2); assert.equal(h.diagnostics.snapshot().stdoutBytes, output.length);
  assert.deepEqual(h.log.closes, [42, 41]); assert.deepEqual(h.log.hooks, ['before', 'after']);
});

test('cap plus one fails with no provisional selections while the last observer sees the failing packet', async () => {
  const output = tar();
  const h = harness({ chunks: [output.subarray(0, 512), output.subarray(512, 1024), output.subarray(1024)], limits: { maxStreamEvents: 2 } });
  await rejects(h.run(), 'E_LIMIT');
  assert.equal(h.diagnostics.snapshot().stdoutEvents, 3);
  assert.equal(h.diagnostics.snapshot().stdoutBytes, output.length);
  assert.equal(h.diagnostics.snapshot().diagnosticCountersComplete, true);
  assert.deepEqual(h.log.kills, ['SIGKILL']); assert.deepEqual(h.log.hooks, ['before']);
});

test('stdout and stderr packets share the core event budget but retain separate passive counters', async () => {
  const h = harness({ stderr: [Buffer.from('ok')], limits: { maxStreamEvents: 2 } });
  const result = await h.run();
  assert.equal(result.streamEvents, 2); assert.equal(result.stderrBytes, 2);
  assert.equal(h.diagnostics.snapshot().stderrEvents, 1); assert.equal(h.diagnostics.snapshot().stderrBytes, 2);
  const overflow = harness({ stderr: [Buffer.from('a'), Buffer.from('b')], limits: { maxStreamEvents: 2 } });
  await rejects(overflow.run(), 'E_LIMIT');
  assert.equal(overflow.diagnostics.snapshot().stderrEvents, 2);
});

test('fragmented stdout retains 64 KiB coalescing without changing the expanded byte cap', async () => {
  const output = Buffer.concat([tar(), Buffer.alloc(65536)]);
  const chunks = [];
  for (let i = 0; i < output.length; i += 17) chunks.push(output.subarray(i, i + 17));
  const h = harness({ chunks });
  const result = await h.run();
  assert.equal(result.expandedBytes, output.length); assert.equal(result.inventory.dataEvents, 2);
  assert.equal(result.streamEvents, chunks.length); assert.equal(h.diagnostics.snapshot().stdoutEvents, chunks.length);
  assert.equal(h.diagnostics.snapshot().stdoutBytes, output.length);
  await rejects(harness({ chunks, limits: { maxExpandedBytes: output.length - 1 } }).run(), 'E_OUTPUT');
});

test('unchanged header and stderr byte bounds still fail closed', async () => {
  await rejects(harness({ chunks: [tar(['sdk/bin/gcc', 'sdk/bin/ld'])], limits: { maxHeaders: 1 } }).run(), 'E_TAR');
  await rejects(harness({ stderr: [Buffer.alloc(8193)] }).run(), 'E_OUTPUT');
});

test('the fixed decoder argv, clean environment and three pipes remain identical', async () => {
  const h = harness(); await h.run();
  const root = v2.GNU_SDK_DESCRIPTOR.decoderRoot;
  assert.deepEqual(h.log.spawns, [[`${root}/ld-linux-x86-64.so.2`, [
    '--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', root, `${root}/xz`,
    '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=16777216', '--', '-',
  ], { cwd: root, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }]]);
});

test('one private outstanding stdin write still requires both callback and drain before reuse', async () => {
  const h = harness({ archive: Buffer.alloc(131073, 7), deferWrites: true });
  const pending = h.run(); await turns();
  assert.equal(h.log.writes.length, 1);
  h.log.writes[0].callback(); await turns(); assert.equal(h.log.writes.length, 1);
  h.child.stdin.emit('drain'); await turns(); assert.equal(h.log.writes.length, 2);
  h.child.stdin.emit('drain'); await turns(); assert.equal(h.log.writes.length, 2);
  h.log.writes[1].callback(); await turns(); assert.equal(h.log.writes.length, 3);
  h.log.writes[2].callback(); h.child.stdin.emit('drain');
  const result = await pending;
  assert.equal(result.archiveDataBytes, 262146); assert.equal(h.child.stdin.listenerCount('drain'), 0);
  for (const write of h.log.writes) assert.deepEqual(write.bytes, write.snapshot);
});

for (const failure of ['spawnThrow', 'spawnError']) test(failure + ' leaves zero observed packets without an executed claim', async () => {
  const h = harness({ [failure]: true }); await rejects(h.run(), 'E_SPAWN');
  assert.equal(h.log.spawnEvents, 0);
  assert.equal(h.diagnostics.snapshot().stdoutEvents, 0); assert.equal(h.diagnostics.snapshot().stderrEvents, 0);
  assert.equal(h.diagnostics.snapshot().stdoutBytes, 0); assert.equal(h.diagnostics.snapshot().stderrBytes, 0);
});

test('late child and pipe errors remain handled without stripping core listeners', async () => {
  const h = harness(); await h.run();
  for (const emitter of [h.child, h.child.stdin, h.child.stdout, h.child.stderr]) {
    assert.ok(emitter.listenerCount('error') > 0);
    assert.doesNotThrow(() => emitter.emit('error', new Error('late mock error')));
  }
});

test('queued packets after the first core failure remain diagnostic-only and do not resume parsing', async () => {
  const h = harness({ chunks: [tar(), Buffer.alloc(0), Buffer.alloc(0), Buffer.alloc(0)], limits: { maxStreamEvents: 2 } });
  await rejects(h.run(), 'E_LIMIT');
  assert.equal(h.diagnostics.snapshot().stdoutEvents, 4); assert.equal(h.log.spawns.length, 1);
  assert.deepEqual(h.log.kills, ['SIGKILL']);
});

test('diagnostic packet counts saturate at the bounded event ceiling without throwing', () => {
  const child = { stdout: new EventEmitter(), stderr: new EventEmitter() };
  const diagnostics = createSdkV2Diagnostics(); diagnostics.observeSdkChild(child);
  const empty = Buffer.alloc(0);
  for (let i = 0; i < 262144 + 64; i++) child.stdout.emit('data', empty);
  assert.equal(diagnostics.snapshot().diagnosticCountersComplete, true);
  child.stderr.emit('data', empty); child.stdout.emit('data', Buffer.alloc(9));
  assert.equal(diagnostics.snapshot().stdoutEvents, 262208); assert.equal(diagnostics.snapshot().stderrEvents, 0);
  assert.equal(diagnostics.snapshot().stdoutBytes, 0); assert.equal(diagnostics.snapshot().diagnosticCountersComplete, false);
});

test('diagnostic byte counts saturate independently without retaining or serializing payloads', () => {
  const child = { stdout: new EventEmitter(), stderr: new EventEmitter() };
  const diagnostics = createSdkV2Diagnostics(); diagnostics.observeSdkChild(child);
  const chunk = Buffer.alloc(1048576, 65);
  for (let i = 0; i < 1025; i++) child.stdout.emit('data', chunk);
  child.stderr.emit('data', Buffer.alloc(8192));
  assert.equal(diagnostics.snapshot().stdoutBytes + diagnostics.snapshot().stderrBytes, 1073741824 + 1048576 + 8192);
  assert.equal(diagnostics.snapshot().diagnosticCountersComplete, true);
  child.stderr.emit('data', Buffer.from('private payload'));
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.diagnosticCountersComplete, false); assert.equal(snapshot.stderrEvents, 1);
  assert.ok(Object.isFrozen(snapshot)); assert.doesNotMatch(JSON.stringify(snapshot), /private payload|AAAA/);
  assert.match(snapshot.diagnosticCountersScope, /not OS syscall counts/);
});

test('observers avoid malicious length getters, reject proxies, and swallow listener setup failures', () => {
  const child = { stdout: new EventEmitter(), stderr: new EventEmitter() };
  const diagnostics = createSdkV2Diagnostics(); diagnostics.observeSdkChild(child);
  const chunk = Buffer.from('safe'); Object.defineProperty(chunk, 'length', { get() { assert.fail('length getter invoked'); } });
  assert.doesNotThrow(() => child.stdout.emit('data', chunk));
  assert.equal(diagnostics.snapshot().stdoutBytes, 4);
  assert.doesNotThrow(() => child.stdout.emit('data', new Proxy(chunk, { get() { assert.fail('proxy trap'); } })));
  assert.equal(diagnostics.snapshot().diagnosticCountersComplete, false);
  const broken = createSdkV2Diagnostics();
  assert.doesNotThrow(() => broken.observeSdkChild({ get stdout() { throw new Error('mock getter'); } }));
  assert.equal(broken.snapshot().diagnosticCountersComplete, false);
});

test('duplicate observer attachment fails diagnostic completeness without duplicate listeners', () => {
  const child = { stdout: new EventEmitter(), stderr: new EventEmitter() };
  const diagnostics = createSdkV2Diagnostics(); diagnostics.observeSdkChild(child); diagnostics.observeSdkChild(child);
  assert.equal(child.stdout.listenerCount('data'), 1); assert.equal(child.stderr.listenerCount('data'), 1);
  assert.equal(diagnostics.snapshot().diagnosticCountersComplete, false);
});

test('mocked outer receipt preserves parent gates, source pins and scoped negative claims', async () => {
  const h = await mockOperation(mockSuccess);
  const { exitCode, receipt } = await h.run();
  assert.equal(exitCode, 0); assert.equal(receipt.profile, 'registered-gnu-sdk-inventory-v2');
  assert.equal(receipt.rawStreamEventLimit, 262144);
  for (const [key, pin] of Object.entries(GNU_SDK_V2_PINS)) assert.deepEqual(receipt[key], pin);
  assert.equal(h.log.reads.length, 5); assert.equal(h.log.stages.length, 2); assert.equal(h.log.preloads, 2);
  assert.equal(h.log.stages[0], h.log.stages[1]);
  assert.deepEqual(h.log.stages[0], JSON.parse(receiptBytes).staged);
  assert.equal(receipt.counts.spawnAttempts, 1); assert.equal(receipt.counts.spawnEvents, 1);
  assert.equal(receipt.stageAccountingComplete, true); assert.equal(receipt.stageCountersScope, 'completed verification helpers');
  assert.equal(receipt.diagnostics.stdoutBytes, 9); assert.equal(receipt.diagnostics.stderrBytes, 2);
  for (const field of ['archiveExtracted', 'filesInstalled', 'pythonRuntimeInvoked', 'pythonFreeSubsetVerified',
    'nativeQualified', 'rustReady', 'trainingReady', 'hardRssBounded', 'hardDeadlineGuaranteed', 'processTreeBounded']) assert.equal(receipt[field], false);
});

test('source-pin failure stops before stage verification and reports zero diagnostics and no inventory', async () => {
  const h = await mockOperation(() => assert.fail('inventory invoked'), { corrupt: true });
  const { exitCode, receipt } = await h.run();
  assert.equal(exitCode, 1); assert.equal(receipt.error, 'E_SOURCE_PIN'); assert.equal(receipt.status, 'STOP');
  assert.equal(receipt.stageAccountingComplete, false); assert.equal(receipt.candidateExecuted, false);
  assert.equal(receipt.diagnostics.stdoutEvents, 0); assert.equal(receipt.diagnostics.stderrBytes, 0);
  assert.equal(Object.hasOwn(receipt, 'result'), false); assert.equal(h.log.spawns, 0);
});

test('failed stage accounting records only completed helpers and never invokes a candidate', async () => {
  const h = await mockOperation(mockSuccess, { stageFailure: true });
  const { receipt } = await h.run();
  assert.equal(receipt.error, 'E_BINDING'); assert.equal(receipt.stageAccountingComplete, false);
  assert.equal(receipt.counts.stageChecks, 0); assert.equal(receipt.counts.stageReadBytes, 0);
  assert.equal(receipt.candidateExecuted, false); assert.equal(receipt.counts.spawnAttempts, 0);
});

test('preload refusal blocks the child after completed readonly stage accounting', async () => {
  const h = await mockOperation(mockSuccess, { preloadFailure: true });
  const { receipt } = await h.run();
  assert.equal(receipt.error, 'E_PRELOAD'); assert.equal(receipt.stageAccountingComplete, true);
  assert.equal(receipt.counts.stageChecks, 1); assert.equal(receipt.counts.preloadChecks, 1);
  assert.equal(receipt.counts.spawnAttempts, 0); assert.equal(receipt.candidateExecuted, false);
});

test('failed outer receipt retains observed packets but no provisional TAR metadata or executed claim', async () => {
  const h = await mockOperation(async (identity, deps) => {
    await deps.beforeDecode(); const child = deps.spawn('mock-only'); await turns();
    child.stdout.emit('data', Buffer.from('sensitive-mock-bytes'));
    throw new v2.GnuSdkInventoryError('E_LIMIT');
  });
  const { exitCode, receipt, text } = await h.run();
  assert.equal(exitCode, 1); assert.equal(receipt.error, 'E_LIMIT'); assert.equal(receipt.status, 'STOP');
  assert.equal(receipt.candidateInvocationAttempted, true); assert.equal(receipt.candidateExecuted, null);
  assert.equal(receipt.realArchiveInspected, false); assert.equal(receipt.diagnostics.stdoutEvents, 1);
  assert.equal(Object.hasOwn(receipt, 'result'), false); assert.equal(Object.hasOwn(receipt, 'selected'), false);
  assert.doesNotMatch(text, /sensitive-mock-bytes/);
});

test('spawn failure without a spawn event reports zero packets and nullable execution semantics', async () => {
  const h = await mockOperation(async (identity, deps) => {
    await deps.beforeDecode(); deps.spawn('mock-only'); await turns(); throw new v2.GnuSdkInventoryError('E_SPAWN');
  }, { noSpawnEvent: true });
  const { receipt } = await h.run();
  assert.equal(receipt.error, 'E_SPAWN'); assert.equal(receipt.counts.spawnEvents, 0);
  assert.equal(receipt.candidateExecuted, null); assert.equal(receipt.diagnostics.stdoutEvents, 0);
  assert.equal(receipt.diagnostics.stderrEvents, 0); assert.equal(receipt.diagnostics.diagnosticCountersComplete, true);
});

test('a second child attempt fails without spawning twice or publishing successful selections', async () => {
  const h = await mockOperation(async (identity, deps) => {
    await deps.beforeDecode(); deps.spawn('mock-only'); await turns(); deps.spawn('mock-only');
  });
  const { receipt } = await h.run();
  assert.equal(receipt.error, 'E_LIMIT'); assert.equal(h.log.spawns, 1);
  assert.equal(receipt.counts.spawnAttempts, 2); assert.equal(Object.hasOwn(receipt, 'result'), false);
});

test('late receipt validation failure discards completed but unacceptable selections', async () => {
  const h = await mockOperation(async (...args) => ({ ...await mockSuccess(...args), nativeQualified: true, selected: ['must-not-publish'] }));
  const { receipt, text } = await h.run();
  assert.equal(receipt.error, 'E_RECEIPT'); assert.equal(receipt.candidateExecuted, true);
  assert.equal(receipt.realArchiveInspected, false); assert.equal(Object.hasOwn(receipt, 'result'), false);
  assert.doesNotMatch(text, /must-not-publish/);
});

test('the unchanged outer byte bound discards oversized output without retaining inspected or selection claims', async () => {
  const h = await mockOperation(async (...args) => ({ ...await mockSuccess(...args), selected: ['x'.repeat(1048576)] }));
  const { exitCode, receipt, text } = await h.run();
  assert.equal(exitCode, 1); assert.equal(receipt.error, 'E_OUTPUT'); assert.equal(receipt.status, 'STOP');
  assert.equal(receipt.realArchiveInspected, false); assert.equal(Object.hasOwn(receipt, 'result'), false);
  assert.equal(receipt.diagnostics.stdoutEvents, 1); assert.ok(Buffer.byteLength(text) < 1048576);
});

test('both new files retain the parent-owned SPEC pointer without changing owner documentation', () => {
  const pointer = '// SPEC: _spec/tooling/native-ingress/gnu-sdk-inventory-v2.puml\n';
  assert.ok(source.startsWith(pointer)); assert.ok(read('gnu-sdk-inventory-v2-operation.test.mjs').toString().startsWith(pointer));
  const spec = '_spec/tooling/native-ingress/gnu-sdk-inventory-v2.puml';
  const files = ['tooling/native-ingress/gnu-sdk-inventory-v2-operation.mjs', 'tooling/native-ingress/gnu-sdk-inventory-v2-operation.test.mjs'];
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(x => x.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) assert.ok(diagram.includes("' covers: " + file + '\n'));
});
