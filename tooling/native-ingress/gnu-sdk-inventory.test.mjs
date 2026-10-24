// SPEC: _spec/tooling/native-ingress/gnu-sdk-inventory.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import {
  GNU_SDK_DESCRIPTOR, GNU_SDK_LIMITS, GnuSdkInventoryError,
  runGnuSdkInventory, createSdkInventoryFixtureRunner,
} from './gnu-sdk-inventory.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gateReceipt = () => ({ stagedImagesVerified: true, preloadAbsent: true, ordinaryProfileObserved: true });
const turns = async (count = 30) => { for (let i = 0; i < count; i++) await Promise.resolve(); };
const rejects = (promise, code) => assert.rejects(promise, (error) => {
  assert.ok(error instanceof GnuSdkInventoryError);
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  assert.equal(Object.hasOwn(error, 'cause'), false);
  assert.equal(Object.hasOwn(error, 'inventory'), false);
  assert.equal(Object.hasOwn(error, 'selected'), false);
  return true;
});

function tar(paths = ['sdk/bin/x86_64-linux-gcc', 'sdk/relocate-sdk.sh', 'sdk/lib/libpython3.so']) {
  const blocks = [];
  for (const path of paths) {
    const header = Buffer.alloc(512);
    header.write(path, 0, 100, 'utf8');
    for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 1000], [116, 8, 1000], [124, 12, 0], [136, 12, 0]]) {
      header.write(`${value.toString(8).padStart(width - 1, '0')}\0`, offset, width, 'ascii');
    }
    header.fill(32, 148, 156);
    header[156] = 48;
    header.write('ustar\0', 257, 6, 'ascii');
    header.write('00', 263, 2, 'ascii');
    const sum = header.reduce((total, byte) => total + byte, 0);
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
    blocks.push(header);
  }
  const bytes = Buffer.concat([...blocks, Buffer.alloc(1024)]);
  assert.ok(bytes.length <= 16_384);
  return bytes;
}

function harness(options = {}) {
  const archive = options.archive ?? Buffer.from('mock compressed archive');
  const output = options.output ?? tar();
  const stats = {
    root: { dev: 11n, ino: 101n, mode: 0o40700n, uid: 1000n, gid: 1000n, nlink: 2n,
      size: 4096n, mtimeNs: 100n, ctimeNs: 101n, atimeNs: 99n },
    file: { dev: 22n, ino: 202n, mode: 0o100600n, uid: 1000n, gid: 1000n, nlink: 1n,
      size: BigInt(archive.length), mtimeNs: 200n, ctimeNs: 201n, atimeNs: 199n },
  };
  const snapshot = (stat) => Object.fromEntries(Object.entries(stat).filter(([key]) => key !== 'atimeNs').map(([key, value]) => [key, String(value)]));
  const expected = { root: snapshot(stats.root), file: snapshot(stats.file) };
  const log = { opens: [], reads: [], closes: [], stats: [], spawns: [], writes: [], kills: [], hooks: [] };
  let child;
  const io = {
    lstatSync(path, opts) {
      assert.deepEqual(opts, { bigint: true });
      const kind = path === GNU_SDK_DESCRIPTOR.root ? 'root' : path === GNU_SDK_DESCRIPTOR.file ? 'file' : assert.fail('unexpected path');
      log.stats.push({ operation: 'lstat', kind });
      return options.stat?.({ ...stats[kind] }, kind, 'named', log) ?? { ...stats[kind] };
    },
    fstatSync(fd, opts) {
      assert.deepEqual(opts, { bigint: true });
      const kind = fd === 41 ? 'root' : fd === 42 ? 'file' : assert.fail('unexpected fd');
      log.stats.push({ operation: 'fstat', kind });
      return options.stat?.({ ...stats[kind] }, kind, 'fd', log) ?? { ...stats[kind] };
    },
    openSync(path, flags) {
      assert.ok(path === GNU_SDK_DESCRIPTOR.root || path === GNU_SDK_DESCRIPTOR.file);
      log.opens.push({ path, flags });
      if (options.openError) throw new Error('private open failure');
      return path === GNU_SDK_DESCRIPTOR.root ? 41 : 42;
    },
    readSync(fd, buffer, offset, length, position) {
      assert.equal(fd, 42);
      assert.equal(offset, 0);
      assert.ok(length >= 1 && length <= 65_536);
      log.reads.push({ position, length, fd });
      stats.file.atimeNs++;
      const override = options.read?.({ fd, buffer, offset, length, position, archive, log });
      if (override !== undefined) return override;
      return archive.copy(buffer, offset, position, position + length);
    },
    closeSync(fd) {
      assert.ok(fd === 41 || fd === 42);
      log.closes.push(fd);
      if (options.closeError === fd) throw new Error('private close failure');
    },
  };
  const normalEnd = (instance) => {
    instance.stdin.emit('finish');
    const chunks = options.chunks ?? [output];
    for (const chunk of chunks) instance.stdout.emit('data', chunk);
    if (options.stderr) instance.stderr.emit('data', options.stderr);
    instance.stdout.emit('end');
    instance.stderr.emit('end');
    instance.emit('exit', 0, null);
    instance.emit('close', 0, null);
    instance.stdout.emit('close');
    instance.stderr.emit('close');
    instance.stdin.emit('close');
  };
  const spawn = (command, argv, opts) => {
    log.spawns.push({ command, argv, opts });
    if (options.spawnError) throw new Error('private spawn failure');
    child = new EventEmitter();
    child.stdin = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = (signal) => {
      log.kills.push(signal);
      if (options.killClose !== false) queueMicrotask(() => child.emit('close', null, 'SIGKILL'));
      if (options.killError) throw new Error('private kill failure');
    };
    child.stdin.write = (bytes, callback) => {
      const record = { bytes, snapshot: Buffer.from(bytes), callback };
      log.writes.push(record);
      if (options.write) return options.write(record, child, log);
      queueMicrotask(() => callback());
      return true;
    };
    child.stdin.end = () => {
      if (options.end) options.end(child, normalEnd, log);
      else normalEnd(child);
    };
    options.onSpawn?.(child, log);
    return child;
  };
  const deps = {
    fs: io, spawn,
    beforeDecode: async () => {
      log.hooks.push('before');
      return options.before ? options.before({ stats, archive, log }) : gateReceipt();
    },
    afterDecode: async () => {
      log.hooks.push('after');
      return options.after ? options.after({ stats, archive, log }) : gateReceipt();
    },
    ...options.deps,
  };
  const profile = { archiveBytes: archive.length, archiveSha256: sha(archive), limits: options.limits ?? {} };
  const run = createSdkInventoryFixtureRunner(profile, deps);
  return { run: (identity = expected) => run(identity), expected, stats, log, archive, output, deps, io, get child() { return child; } };
}

test('fixture inventories two complete passes with independent devices and all authority flags false', async () => {
  const h = harness();
  const result = await h.run();
  assert.equal(result.state, 'GNU_SDK_DATA_INVENTORY');
  assert.equal(result.mockOnly, true);
  assert.equal(result.realArchiveInspected, false);
  assert.equal(result.inventory.realArchiveInspected, false);
  for (const key of ['extracted', 'extractionAuthorized', 'pythonFreeSubsetVerified', 'installedUsability',
    'nativeQualified', 'decoderQualified', 'rustReady', 'trainingReady', 'hardRssBounded', 'processTreeBounded', 'hardDeadlineGuaranteed']) {
    assert.equal(result[key], false, key);
  }
  assert.equal(result.archivePasses, 2);
  assert.equal(result.archiveDataBytes, h.archive.length * 2);
  assert.equal(result.archiveRequestedBytes, h.archive.length * 2 + 2);
  assert.equal(result.archiveReadAttempts, 4);
  assert.equal(result.inventory.entries, 3);
  assert.match(result.inventory.metadataSha256, /^[a-f0-9]{64}$/u);
  assert.equal(result.selected.length, 3);
  assert.deepEqual(h.log.closes, [42, 41]);
  assert.deepEqual(h.log.hooks, ['before', 'after']);
  assert.equal(h.log.kills.length, 0);
  assert.ok(Object.isFrozen(result.selected[0].categories));
});

test('decoder uses exactly the qualified fixed argv, clean environment, and no shell', async () => {
  const h = harness();
  await h.run();
  const root = GNU_SDK_DESCRIPTOR.decoderRoot;
  assert.deepEqual(h.log.spawns, [{ command: `${root}/ld-linux-x86-64.so.2`, argv: [
    '--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', root, `${root}/xz`,
    '--decompress', '--stdout', '--format=xz', '--threads=1', '--memlimit-decompress=16777216', '--', '-',
  ], opts: { cwd: root, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, shell: false,
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true } }]);
});

test('only fixed archive paths open read-only, nonblocking and nofollow; root uses O_DIRECTORY', async () => {
  const h = harness();
  await h.run();
  assert.deepEqual(h.log.opens, [
    { path: GNU_SDK_DESCRIPTOR.root, flags: constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW | constants.O_DIRECTORY },
    { path: GNU_SDK_DESCRIPTOR.file, flags: constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW },
  ]);
  assert.ok(h.log.reads.every(({ fd }) => fd === 42));
});

test('production descriptor and operation limits are fixed and frozen', () => {
  assert.equal(GNU_SDK_DESCRIPTOR.archiveBytes, 102296280);
  assert.equal(GNU_SDK_DESCRIPTOR.archiveSha256, 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3');
  assert.equal(GNU_SDK_LIMITS.maxTotalMs - GNU_SDK_LIMITS.cleanupMs, 117000);
  assert.equal(GNU_SDK_LIMITS.maxHeaders, 32768);
  assert.ok(Object.isFrozen(GNU_SDK_DESCRIPTOR));
  assert.ok(Object.isFrozen(GNU_SDK_LIMITS));
});

test('production rejects a reduced fixture identity before opening or spawning', async () => {
  const h = harness();
  await rejects(runGnuSdkInventory(h.expected, h.deps), 'E_METADATA');
  assert.equal(h.log.opens.length, 0);
  assert.equal(h.log.spawns.length, 0);
});

for (const [name, modify] of [
  ['missing snapshot', (v) => { delete v.root; }],
  ['extra outer field', (v) => { v.path = '/other'; }],
  ['missing snapshot field', (v) => { delete v.file.ctimeNs; }],
  ['extra snapshot field', (v) => { v.file.atimeNs = '1'; }],
  ['number instead of decimal string', (v) => { v.file.ino = 202; }],
  ['bigint instead of decimal string', (v) => { v.file.ino = 202n; }],
  ['noncanonical decimal', (v) => { v.root.dev = '011'; }],
  ['accessor field', (v) => { Object.defineProperty(v.file, 'ino', { get() { assert.fail('getter invoked'); }, enumerable: true }); }],
  ['proxy snapshot', (v) => { v.file = new Proxy(v.file, { get() { assert.fail('proxy invoked'); } }); }],
]) {
  test(`strict identity rejects ${name} without IO`, async () => {
    const h = harness();
    const identity = structuredClone(h.expected);
    modify(identity);
    await rejects(h.run(identity), 'E_INPUT');
    assert.equal(h.log.opens.length + h.log.stats.length + h.log.spawns.length, 0);
  });
}

for (const [kind, field, value] of [
  ['root', 'mode', String(0o40755)], ['root', 'uid', '0'], ['root', 'nlink', '3'],
  ['file', 'mode', String(0o120600)], ['file', 'gid', '0'], ['file', 'nlink', '2'], ['file', 'size', '1'],
]) {
  test(`rejects invalid pinned ${kind}.${field} before IO`, async () => {
    const h = harness();
    h.expected[kind][field] = value;
    await rejects(h.run(), 'E_METADATA');
    assert.equal(h.log.opens.length, 0);
  });
}

test('snapshot capture prevents caller mutation across the asynchronous gate', async () => {
  const h = harness({ before: () => { h.expected.file.ino = '999'; return gateReceipt(); } });
  assert.equal((await h.run()).inventory.entries, 3);
});

test('named metadata mismatch fails before any open', async () => {
  const h = harness({ stat: (stat, kind) => kind === 'file' ? { ...stat, ino: 999n } : stat });
  await rejects(h.run(), 'E_BINDING');
  assert.equal(h.log.opens.length, 0);
});

test('retained root FD identity mismatch stops before decoder despite stable names', async () => {
  const h = harness({ stat: (stat, kind, where, log) => kind === 'root' && where === 'fd' && log.reads.length
    ? { ...stat, ctimeNs: 999n } : stat });
  await rejects(h.run(), 'E_BINDING');
  assert.equal(h.log.spawns.length, 0);
  assert.deepEqual(h.log.closes, [42, 41]);
});

test('retained file FD replacement stops before decoding', async () => {
  const h = harness({ stat: (stat, kind, where) => kind === 'file' && where === 'fd' ? { ...stat, ino: 999n } : stat });
  await rejects(h.run(), 'E_BINDING');
  assert.equal(h.log.spawns.length, 0);
});

test('root timestamp mutation inside the pre-decode gate stops before spawn', async () => {
  const h = harness({ before: ({ stats }) => { stats.root.mtimeNs++; return gateReceipt(); } });
  await rejects(h.run(), 'E_BINDING');
  assert.equal(h.log.spawns.length, 0);
});

test('post-decode binding mutation prevents a receipt', async () => {
  const h = harness({ after: ({ stats }) => { stats.file.ctimeNs++; return gateReceipt(); } });
  await rejects(h.run(), 'E_BINDING');
  assert.deepEqual(h.log.closes, [42, 41]);
});

for (const pass of [1, 2]) {
  test(`short read in pass ${pass} fails without retry`, async () => {
    const h = harness({ read: ({ length, position, log }) => position === 0 && log.reads.length === (pass === 1 ? 1 : 3) ? length - 1 : undefined });
    await rejects(h.run(), 'E_LENGTH');
    assert.equal(h.log.reads.length, pass === 1 ? 1 : 3);
    assert.equal(h.log.spawns.length, pass - 1);
    assert.equal(h.log.kills.length, pass - 1);
  });
  test(`extra byte at physical EOF in pass ${pass} fails closed`, async () => {
    const h = harness({ read: ({ position, archive, log }) => position === archive.length && log.reads.length === pass * 2 ? 1 : undefined });
    await rejects(h.run(), 'E_LENGTH');
    assert.equal(h.log.spawns.length, pass - 1);
  });
}

test('full first-pass hash mismatch prevents child creation', async () => {
  const h = harness({ deps: { hash: () => ({ update() {}, digest: () => '0'.repeat(64) }) } });
  await rejects(h.run(), 'E_HASH');
  assert.equal(h.log.spawns.length, 0);
  assert.equal(h.log.reads.length, 2);
});

test('second-pass content mutation fails hash, kills once, and publishes no partial inventory', async () => {
  const h = harness({ before: ({ archive }) => { archive[0] ^= 1; return gateReceipt(); } });
  await rejects(h.run(), 'E_HASH');
  assert.equal(h.log.spawns.length, 1);
  assert.deepEqual(h.log.kills, ['SIGKILL']);
});

test('spawn occurs after full first hash, EOF probe and verified pre-decode gate', async () => {
  let digests = 0;
  const h = harness({ deps: { hash: (algorithm) => {
    const value = createHash(algorithm);
    return { update: (bytes) => value.update(bytes), digest: (encoding) => { digests++; return value.digest(encoding); } };
  } }, onSpawn: () => {
    assert.equal(digests, 1);
    assert.equal(h.log.reads.length, 2);
    assert.deepEqual(h.log.hooks, ['before']);
  } });
  await h.run();
  assert.equal(digests, 2);
});

for (const receipt of [false, {}, { ...gateReceipt(), preloadAbsent: false }, { ...gateReceipt(), extra: true }]) {
  test(`invalid prerequisite receipt ${JSON.stringify(receipt)} prevents spawn`, async () => {
    const h = harness({ before: () => receipt });
    await rejects(h.run(), 'E_PREREQUISITE');
    assert.equal(h.log.spawns.length, 0);
  });
}

test('both gate functions are mandatory before opening any input', async () => {
  const h = harness();
  const runner = createSdkInventoryFixtureRunner({ archiveBytes: h.archive.length, archiveSha256: sha(h.archive) },
    { fs: h.io, spawn: h.deps.spawn, beforeDecode: gateReceipt });
  await rejects(runner(h.expected), 'E_INPUT');
  assert.equal(h.log.opens.length, 0);
});

test('post-decode prerequisite refusal rejects completed decoding', async () => {
  const h = harness({ after: () => ({ ...gateReceipt(), ordinaryProfileObserved: false }) });
  await rejects(h.run(), 'E_PREREQUISITE');
  assert.equal(h.log.spawns.length, 1);
});

test('producer retains a private copy until both callback and drain complete', async () => {
  const archive = Buffer.alloc(131089);
  archive.fill(1, 0, 65536); archive.fill(2, 65536, 131072); archive.fill(3, 131072);
  const h = harness({ archive, write: () => false });
  const pending = h.run();
  await turns();
  assert.equal(h.log.writes.length, 1);
  assert.equal(h.log.reads.length, 5);
  h.log.writes[0].callback();
  await turns();
  assert.equal(h.log.writes.length, 1);
  h.child.stdin.emit('drain');
  await turns();
  assert.equal(h.log.writes.length, 2);
  assert.deepEqual(h.log.writes[0].bytes, h.log.writes[0].snapshot);
  h.child.stdin.emit('drain');
  await turns();
  assert.equal(h.log.writes.length, 2);
  h.log.writes[1].callback();
  await turns();
  assert.equal(h.log.writes.length, 3);
  h.log.writes[2].callback();
  h.child.stdin.emit('drain');
  const result = await pending;
  assert.equal(result.archiveDataBytes, 262178);
  assert.equal(h.child.stdin.listenerCount('drain'), 0);
  for (const record of h.log.writes) assert.deepEqual(record.bytes, record.snapshot);
});

test('stdout listeners parse output while a stdin write is outstanding', async () => {
  const output = tar();
  const h = harness({ output, write: (record, child) => {
    child.stdout.emit('data', output);
    queueMicrotask(() => record.callback());
    return true;
  }, end: (child) => {
    child.stdin.emit('finish');
    child.stdout.emit('end'); child.stderr.emit('end');
    child.stdout.emit('close'); child.stderr.emit('close');
    child.emit('exit', 0, null); child.emit('close', 0, null);
  } });
  assert.equal((await h.run()).inventory.entries, 3);
});

test('tiny stdout fragments coalesce into a single bounded parser event', async () => {
  const output = tar();
  const h = harness({ output, chunks: Array.from(output, (byte) => Buffer.from([byte])) });
  const result = await h.run();
  assert.equal(result.expandedBytes, output.length);
  assert.equal(result.inventory.dataEvents, 1);
  assert.equal(result.streamEvents, output.length);
});

test('parser rejects late invalid trailing bytes without a partial receipt', async () => {
  const h = harness({ output: Buffer.concat([tar(), Buffer.from([1])]) });
  await rejects(h.run(), 'E_TAR');
  assert.deepEqual(h.log.kills, ['SIGKILL']);
});

test('parser finish rejects truncated terminators after closed child and owned descriptors', async () => {
  const h = harness({ output: tar().subarray(0, 1536) });
  await rejects(h.run(), 'E_TAR');
  assert.deepEqual(h.log.closes, [42, 41]);
  assert.equal(h.log.kills.length, 0);
});

test('selected candidate overflow stops instead of silently truncating names', async () => {
  const h = harness({ limits: { maxSelectedEntries: 2 } });
  await rejects(h.run(), 'E_OUTPUT');
  assert.deepEqual(h.log.kills, ['SIGKILL']);
});

test('selected metadata byte cap stops without publishing records', async () => {
  await rejects(harness({ limits: { maxSelectedBytes: 100 } }).run(), 'E_OUTPUT');
});

test('ordinary nonselected entries still contribute to full count and digest', async () => {
  const output = tar(['sdk/share/a', 'sdk/share/b']);
  const result = await harness({ output }).run();
  assert.equal(result.selected.length, 0);
  assert.equal(result.inventory.entries, 2);
  assert.equal(result.inventory.outputBytes > 0, true);
});

test('Python basename selection does not expand to every descendant payload', async () => {
  const h = harness({ output: tar(['sdk/lib/python3.14', 'sdk/lib/python3.14/abc.py', 'sdk/lib/libpython3.14.so']) });
  const result = await h.run();
  assert.deepEqual(result.selected.map(x => x.path), ['sdk/lib/python3.14', 'sdk/lib/libpython3.14.so']);
  assert.equal(result.inventory.entries, 3);
  assert.equal(result.pythonFreeSubsetVerified, false);
});

test('candidate names remain metadata and never trigger additional opens', async () => {
  const h = harness({ output: tar(['sdk/bin/x86_64-gcc', 'sdk/relocate-sdk.sh', 'sdk/bin/python3']) });
  const result = await h.run();
  assert.equal(result.selected.length, 3);
  assert.equal(result.pythonFreeSubsetVerified, false);
  assert.equal(h.log.opens.length, 2);
});

test('expanded byte cap rejects bytes before feeding the TAR parser', async () => {
  await rejects(harness({ limits: { maxExpandedBytes: 1024 } }).run(), 'E_OUTPUT');
});

test('stderr is bounded independently without retaining its contents', async () => {
  const h = harness({ stderr: Buffer.alloc(8193, 65) });
  await rejects(h.run(), 'E_OUTPUT');
  assert.deepEqual(h.log.kills, ['SIGKILL']);
});

test('oversized source views fail before copying into the parser', async () => {
  await rejects(harness({ chunks: [Buffer.alloc(1048577)] }).run(), 'E_PIPE');
});

test('shared source buffers fail without parsing', async () => {
  await rejects(harness({ chunks: [new Uint8Array(new SharedArrayBuffer(10))] }).run(), 'E_PIPE');
});

test('stream event cap bounds even empty events', async () => {
  await rejects(harness({ chunks: Array(5).fill(Buffer.alloc(0)), limits: { maxStreamEvents: 4 } }).run(), 'E_LIMIT');
});

test('parser header cap rejects metadata floods', async () => {
  await rejects(harness({ limits: { maxHeaders: 2 } }).run(), 'E_TAR');
});

test('per-pass read cap stops before issuing the next read', async () => {
  const h = harness({ limits: { maxReadsPerPass: 1 } });
  await rejects(h.run(), 'E_LIMIT');
  assert.equal(h.log.reads.length, 1);
  assert.equal(h.log.spawns.length, 0);
});

test('filesystem operation cap stops and still closes owned descriptors once', async () => {
  const h = harness({ limits: { maxFsOperations: 4 } });
  await rejects(h.run(), 'E_LIMIT');
  assert.deepEqual(h.log.closes, [41]);
});

test('summary size cap rejects the final report', async () => {
  await rejects(harness({ limits: { maxSummaryBytes: 100 } }).run(), 'E_OUTPUT');
});

test('spawn failure normalizes private messages and closes both descriptors', async () => {
  const h = harness({ spawnError: true });
  await rejects(h.run(), 'E_SPAWN');
  assert.deepEqual(h.log.closes, [42, 41]);
});

test('open failure normalizes private messages without writes or closes of unowned fds', async () => {
  const h = harness({ openError: true });
  await rejects(h.run(), 'E_IO');
  assert.equal(h.log.closes.length, 0);
});

test('failed close invalidates success and never retries either descriptor', async () => {
  const h = harness({ closeError: 42 });
  await rejects(h.run(), 'E_CLOSE');
  assert.deepEqual(h.log.closes, [42, 41]);
});

test('nonzero decoder exit stops without retry, dead-process kill or memory cap escalation', async () => {
  const h = harness({ end: (child) => {
    child.emit('exit', 1, null); child.emit('error', new Error('late decoder failure')); child.emit('close', 1, null);
  } });
  await rejects(h.run(), 'E_DECODER');
  assert.equal(h.log.kills.length, 0);
  assert.equal(h.log.spawns.length, 1);
});

test('early child close cancels the producer before any further reads', async () => {
  const h = harness({ archive: Buffer.alloc(131089), write: (record, child) => {
    child.emit('exit', 0, null); child.emit('close', 0, null);
    return false;
  } });
  await rejects(h.run(), 'E_PIPE');
  assert.equal(h.log.reads.length, 5);
  assert.equal(h.log.writes.length, 1);
  assert.equal(h.log.kills.length, 0);
});

test('stdin write callback failure latches once and stops the producer', async () => {
  const h = harness({ write: (record) => { queueMicrotask(() => record.callback(new Error('private pipe error'))); return false; } });
  await rejects(h.run(), 'E_PIPE');
  assert.deepEqual(h.log.kills, ['SIGKILL']);
  assert.equal(h.log.writes.length, 1);
});

test('missing stream end cannot be replaced by child exit and close', async () => {
  const h = harness({ end: (child) => {
    child.stdin.emit('finish'); child.stdout.emit('close');
    child.emit('exit', 0, null); child.emit('close', 0, null);
  } });
  await rejects(h.run(), 'E_PIPE');
});

test('cleanup uncertainty yields E_CLEANUP and still closes descriptors once', async () => {
  const h = harness({ killClose: false, stderr: Buffer.alloc(8193), limits: { cleanupMs: 2 }, end: (child) => {
    child.stderr.emit('data', Buffer.alloc(8193));
  } });
  await rejects(h.run(), 'E_CLEANUP');
  assert.deepEqual(h.log.kills, ['SIGKILL']);
  assert.deepEqual(h.log.closes, [42, 41]);
  h.child.emit('error', new Error('late child error'));
  for (const stream of [h.child.stdin, h.child.stdout, h.child.stderr]) stream.emit('error', new Error('late stream error'));
  h.child.emit('close', null, 'SIGKILL');
});

test('close observation confirms cleanup even if kill throws', async () => {
  const h = harness({ killError: true, end: (child) => { child.stderr.emit('error', new Error('private')); } });
  await rejects(h.run(), 'E_PIPE');
  assert.deepEqual(h.log.kills, ['SIGKILL']);
});

test('late stream errors remain handled after successful completion', async () => {
  const h = harness();
  await h.run();
  h.child.emit('error', new Error('late'));
  for (const stream of [h.child.stdin, h.child.stdout, h.child.stderr]) stream.emit('error', new Error('late'));
  assert.equal(h.log.kills.length, 0);
});

test('backwards clocks stop before filesystem access without replacing globals', async () => {
  const originalNow = performance.now;
  const originalTimeout = globalThis.setTimeout;
  let calls = 0;
  const h = harness({ deps: { now: () => ++calls === 1 ? 10 : 9 } });
  await rejects(h.run(), 'E_CLOCK');
  assert.equal(h.log.opens.length, 0);
  assert.equal(performance.now, originalNow);
  assert.equal(globalThis.setTimeout, originalTimeout);
});

test('deadline interrupts a stalled gate under the original work deadline', async () => {
  let time = 0;
  const jobs = new Map();
  let next = 0;
  const h = harness({ before: () => new Promise(() => {}), deps: {
    now: () => time,
    setTimeout: (fn, delay) => { const id = ++next; jobs.set(id, { fn, delay }); return id; },
    clearTimeout: (id) => jobs.delete(id),
  } });
  const pending = h.run();
  await turns();
  assert.deepEqual(h.log.hooks, ['before']);
  const job = [...jobs.values()][0];
  assert.equal(job.delay, 117000);
  time = 117000; job.fn();
  await rejects(pending, 'E_DEADLINE');
  assert.equal(h.log.spawns.length, 0);
  assert.deepEqual(h.log.closes, [42, 41]);
  assert.equal(jobs.size, 0);
});

test('synchronous archive reads check the clock and stop without creating a decoder', async () => {
  let ticks = 0;
  const h = harness({ deps: { now: () => ++ticks * 5000 } });
  await rejects(h.run(), 'E_DEADLINE');
  assert.equal(h.log.spawns.length, 0);
  assert.ok(h.log.closes.length <= 2);
});

test('fixture profiles cannot widen bounds, relocate fixed paths, or claim real inspection', () => {
  const h = harness();
  const base = { archiveBytes: 1, archiveSha256: '0'.repeat(64) };
  for (const profile of [{ ...base, archiveBytes: 1048577 }, { ...base, root: '/other' },
    { ...base, limits: { maxHeaders: 32769 } }, { ...base, limits: { cleanupMs: 3001 } }]) {
    assert.throws(() => createSdkInventoryFixtureRunner(profile, h.deps), GnuSdkInventoryError);
  }
});

test('synchronous write failure latches before queued stdout can replace the error', async () => {
  const h = harness({ limits: { maxExpandedBytes: 1024 }, write: (record, child) => {
    queueMicrotask(() => child.stdout.emit('data', Buffer.alloc(2048)));
    throw new Error('private synchronous write failure');
  } });
  await rejects(h.run(), 'E_PIPE');
  assert.deepEqual(h.log.kills, ['SIGKILL']);
});

test('synchronous producer read failure latches before queued output overflow', async () => {
  const h = harness({ limits: { maxExpandedBytes: 1024 }, read: ({ log }) => {
    if (log.reads.length === 3) {
      queueMicrotask(() => h.child.stdout.emit('data', Buffer.alloc(2048)));
      throw new Error('private synchronous read failure');
    }
  } });
  await rejects(h.run(), 'E_IO');
  assert.equal(h.log.writes.length, 0);
  assert.deepEqual(h.log.kills, ['SIGKILL']);
});

test('provisional parsed selections cannot escape a later second-pass hash failure', async () => {
  const h = harness({ before: ({ archive }) => { archive[0] ^= 1; return gateReceipt(); }, write: (record, child) => {
    child.stdout.emit('data', tar());
    child.stdout.emit('end');
    queueMicrotask(() => record.callback());
    return true;
  } });
  await rejects(h.run(), 'E_HASH');
  assert.deepEqual(h.log.kills, ['SIGKILL']);
});

test('parser failure during an outstanding write stops reads and kills only once', async () => {
  const h = harness({ archive: Buffer.alloc(131089), write: (record, child) => {
    child.stdout.emit('data', Buffer.concat([tar(), Buffer.from([1])]));
    child.stdout.emit('end');
    child.stderr.emit('error', new Error('secondary pipe error'));
    return false;
  } });
  await rejects(h.run(), 'E_TAR');
  assert.equal(h.log.reads.length, 5);
  assert.equal(h.log.writes.length, 1);
  assert.deepEqual(h.log.kills, ['SIGKILL']);
});

test('stdin finish before the second physical EOF fails closed', async () => {
  const h = harness({ write: (record, child) => {
    child.stdin.emit('finish');
    return false;
  } });
  await rejects(h.run(), 'E_PIPE');
  assert.equal(h.log.reads.length, 3);
});

test('decoder signals never count as a successful exit', async () => {
  const h = harness({ end: (child) => { child.emit('exit', null, 'SIGTERM'); child.emit('close', null, 'SIGTERM'); } });
  await rejects(h.run(), 'E_DECODER');
  assert.equal(h.log.kills.length, 0);
});

test('child close without an exit observation fails closed', async () => {
  const h = harness({ end: (child) => { child.emit('close', 0, null); } });
  await rejects(h.run(), 'E_DECODER');
});

test('thrown prerequisite errors expose no callback messages', async () => {
  for (const hook of ['before', 'after']) {
    const h = harness({ [hook]: () => { throw new Error('private prerequisite message'); } });
    await rejects(h.run(), 'E_PREREQUISITE');
    assert.equal(h.log.spawns.length, hook === 'before' ? 0 : 1);
  }
});

test('a prerequisite receipt getter cannot run', async () => {
  const receipt = gateReceipt();
  Object.defineProperty(receipt, 'preloadAbsent', { get() { assert.fail('receipt getter invoked'); } });
  const h = harness({ before: () => receipt });
  await rejects(h.run(), 'E_PREREQUISITE');
  assert.equal(h.log.spawns.length, 0);
});

test('deadline cancels a backpressured producer and reserves exactly three cleanup seconds', async () => {
  let time = 0;
  let next = 0;
  const jobs = new Map();
  const delays = [];
  const h = harness({ archive: Buffer.alloc(131089), write: () => false, deps: {
    now: () => time,
    setTimeout: (fn, delay) => { delays.push(delay); jobs.set(++next, { fn, delay }); return next; },
    clearTimeout: (id) => jobs.delete(id),
  } });
  const pending = h.run();
  await turns();
  assert.equal(h.log.writes.length, 1);
  time = 117000;
  [...jobs.values()][0].fn();
  await rejects(pending, 'E_DEADLINE');
  assert.deepEqual(delays, [117000, 3000]);
  assert.equal(jobs.size, 0);
  assert.equal(h.log.reads.length, 5);
  assert.deepEqual(h.log.kills, ['SIGKILL']);
});

test('a late cleanup close cannot beat an expired cleanup budget through timer ordering', async () => {
  let time = 0;
  let next = 0;
  const jobs = new Map();
  const h = harness({ killClose: false, end: (child) => child.stderr.emit('error', new Error('private')), deps: {
    now: () => time,
    setTimeout: (fn, delay) => { jobs.set(++next, { fn, delay }); return next; },
    clearTimeout: (id) => jobs.delete(id),
  } });
  const pending = h.run();
  await turns();
  assert.deepEqual(h.log.kills, ['SIGKILL']);
  time = 3000;
  h.child.emit('close', null, 'SIGKILL');
  await rejects(pending, 'E_CLEANUP');
  assert.equal(jobs.size, 0);
});

test('a stalled post-decode gate shares the original deadline and never creates another child', async () => {
  let time = 0;
  let next = 0;
  const jobs = new Map();
  const h = harness({ after: () => new Promise(() => {}), deps: {
    now: () => time,
    setTimeout: (fn, delay) => { jobs.set(++next, { fn, delay }); return next; },
    clearTimeout: (id) => jobs.delete(id),
  } });
  const pending = h.run();
  await turns();
  assert.deepEqual(h.log.hooks, ['before', 'after']);
  time = 117000;
  [...jobs.values()][0].fn();
  await rejects(pending, 'E_DEADLINE');
  assert.equal(h.log.spawns.length, 1);
  assert.equal(h.log.kills.length, 0);
  assert.deepEqual(h.log.closes, [42, 41]);
});

test('timer scheduling failures normalize before any filesystem operation', async () => {
  const h = harness({ deps: { setTimeout: () => { throw new Error('private timer message'); } } });
  await rejects(h.run(), 'E_CLOCK');
  assert.equal(h.log.opens.length, 0);
});

test('cleanup timer failure still kills once and reports unconfirmed cleanup', async () => {
  let schedules = 0;
  const h = harness({ end: (child) => child.stderr.emit('error', new Error('private')), deps: {
    setTimeout: () => { if (++schedules > 1) throw new Error('private timer message'); return 1; },
    clearTimeout() {},
  } });
  await rejects(h.run(), 'E_CLEANUP');
  assert.deepEqual(h.log.kills, ['SIGKILL']);
  assert.deepEqual(h.log.closes, [42, 41]);
});

test('timer cancellation failure cannot publish success or leak raw messages', async () => {
  const h = harness({ deps: { setTimeout: () => 1, clearTimeout: () => { throw new Error('private cancellation message'); } } });
  await rejects(h.run(), 'E_CLOCK');
  assert.deepEqual(h.log.closes, [42, 41]);
});
