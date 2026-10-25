// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import {
  EVIDENCE_PUBLICATION_PATH as PATH, EVIDENCE_PUBLICATION_LIMITS as LIMITS,
  reserveToolchainEvidencePublication, createEvidencePublicationFixture,
} from './evidence-publication.mjs';

const ROOT = '/tmp/opencode/f9-bootstrap-correspondence';
const DIR = ROOT + '/_spec/tooling/native-ingress';
const DIRS = [ROOT, ROOT + '/_spec', ROOT + '/_spec/tooling', DIR];
const DATA = Buffer.from('{"collection":{"sha256":"member-digest","complete":true}}\n');
const error = code => Object.assign(new Error(code), { code });
const hasCode = suffix => failure => failure.code === 'E_PUBLICATION_' + suffix &&
  Object.hasOwn(failure, 'code') && !failure.message.includes('secret');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function memory() {
  let inode = 10n, fd = 100;
  const model = { nodes: new Map(), fds: new Map(), calls: [], writeBuffers: [], readBuffers: [],
    hook: null, guardHook: null, guardCalls: 0, writeCap: Infinity, readCap: Infinity };
  function node(mode, data = Buffer.alloc(0)) {
    return { dev: 7n, ino: inode++, mode: BigInt(mode), uid: 1000n, gid: 1000n,
      nlink: mode === 0o40755 ? 2n : 1n, size: BigInt(data.length), mtimeNs: 1n, ctimeNs: 1n, data };
  }
  for (const path of DIRS) model.nodes.set(path, node(0o40755));
  const copyStat = value => Object.fromEntries(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink',
    'size', 'mtimeNs', 'ctimeNs'].map(key => [key, value[key]]));
  const implementations = {
    lstatSync(path, options) {
      assert.equal(options.bigint, true);
      const value = model.nodes.get(path);
      if (!value) throw error('ENOENT');
      return copyStat(value);
    },
    fstatSync(id, options) {
      assert.equal(options.bigint, true);
      assert.ok(model.fds.has(id));
      return copyStat(model.fds.get(id).node);
    },
    openSync(path, flags, mode) {
      assert.ok((flags & fs.constants.O_NOFOLLOW) !== 0);
      assert.ok((flags & fs.constants.O_NONBLOCK) !== 0);
      let value = model.nodes.get(path);
      if ((flags & fs.constants.O_CREAT) !== 0) {
        assert.equal(path, PATH);
        assert.equal(mode, 0o600);
        assert.ok((flags & fs.constants.O_EXCL) !== 0);
        assert.ok((flags & fs.constants.O_WRONLY) !== 0);
        if (value) throw error('EEXIST');
        value = node(0o100600);
        value.dev = 19n;
        model.nodes.set(path, value);
        model.nodes.get(DIR).ctimeNs++;
        model.nodes.get(DIR).mtimeNs++;
        model.nodes.get(DIR).size++;
      } else if (path === DIR) {
        assert.ok((flags & fs.constants.O_DIRECTORY) !== 0);
      } else {
        assert.equal(path, PATH);
        assert.equal(flags & fs.constants.O_ACCMODE, 0);
      }
      if (!value) throw error('ENOENT');
      const id = fd++;
      model.fds.set(id, { node: value, path, flags });
      return id;
    },
    fsyncSync(id) { assert.ok(model.fds.has(id)); },
    fchmodSync(id, mode) {
      const value = model.fds.get(id);
      assert.equal(value.path, PATH);
      assert.ok((value.flags & fs.constants.O_WRONLY) !== 0);
      assert.equal(mode, 0o444);
      value.node.mode = BigInt(0o100000 | mode);
      value.node.ctimeNs++;
    },
    writeSync(id, bytes, offset, length, position) {
      const value = model.fds.get(id);
      assert.equal(value.path, PATH);
      assert.ok((value.flags & fs.constants.O_WRONLY) !== 0);
      assert.ok(length > 0 && length <= 65536);
      const amount = Math.min(length, model.writeCap);
      model.writeBuffers.push(bytes);
      const next = Buffer.alloc(Math.max(value.node.data.length, position + amount));
      value.node.data.copy(next);
      bytes.copy(next, position, offset, offset + amount);
      value.node.data = next;
      value.node.size = BigInt(next.length);
      value.node.mtimeNs++;
      value.node.ctimeNs++;
      return amount;
    },
    readSync(id, bytes, offset, length, position) {
      const value = model.fds.get(id);
      assert.equal(value.path, PATH);
      assert.ok(length > 0 && length <= 65536);
      model.readBuffers.push(bytes);
      const amount = Math.min(length, model.readCap, Math.max(0, value.node.data.length - position));
      value.node.data.copy(bytes, offset, position, position + amount);
      return amount;
    },
    closeSync(id) {
      assert.ok(model.fds.has(id));
      model.fds.delete(id);
    },
  };
  model.fs = Object.fromEntries(Object.entries(implementations).map(([method, implementation]) => [method,
    function (...args) {
      const call = { method, args, when: 'before' };
      model.calls.push(call);
      model.hook?.(call, model);
      const result = Reflect.apply(implementation, null, args);
      const after = { method, args, when: 'after', result };
      model.hook?.(after, model);
      return after.result;
    }]));
  model.guard = () => { model.guardCalls++; model.guardHook?.(model); };
  model.file = () => model.nodes.get(PATH);
  model.existing = (mode = 0o100444) => {
    const value = node(mode, Buffer.from('existing-secret'));
    model.nodes.set(PATH, value);
    return value;
  };
  return model;
}
function setup(limits, model = memory()) {
  const fixture = createEvidencePublicationFixture({ mockOnly: true, ...(limits ? { limits } : {}) },
    { fs: model.fs, guard: model.guard });
  return { model, fixture, reserve: () => fixture.reserveToolchainEvidencePublication() };
}
function successful(limits, model = memory(), bytes = DATA) {
  const state = setup(limits, model);
  const capability = state.reserve();
  const publication = capability.publish(bytes);
  return { ...state, capability, publication };
}
function assertClosedOnce(model, capability) {
  const closes = model.calls.filter(call => call.method === 'closeSync').map(call => call.args[0]);
  assert.equal(new Set(closes).size, closes.length);
  if (capability) assert.equal(capability.snapshot().ownedFDCount, 0);
}
function failPublication(model, code, limits, bytes = DATA) {
  const state = setup(limits, model);
  const capability = state.reserve();
  assert.throws(() => capability.publish(bytes), hasCode(code));
  assert.equal(capability.snapshot().phase, 'FAILED');
  assert.equal(capability.snapshot().error, 'E_PUBLICATION_' + code);
  assert.equal(capability.snapshot().ownedFDCount, 0);
  assert.equal(model.nodes.has(PATH), true);
  assertClosedOnce(model, capability);
  return { ...state, capability };
}

test('exact fixed exports and frozen bounds', () => {
  assert.equal(PATH, DIR + '/toolchain-evidence-collection-v1.result.json');
  assert.deepEqual(LIMITS, { maxBytes: 16777216, chunkBytes: 65536, maxFsOperations: 8192,
    maxWriteAttempts: 4096, maxReadAttempts: 1024, maxRequestedReadBytes: 16777217 });
  assert.equal(Object.isFrozen(LIMITS), true);
});

test('production rejects missing, proxy, and extra arguments without reservation', () => {
  for (const args of [[], [undefined], [{}], [new Proxy(() => {}, {})], [() => {}, {}]]) {
    assert.throws(() => reserveToolchainEvidencePublication(...args), hasCode('ARGUMENT'));
  }
});

test('reserve is early, empty, frozen, owns two FDs, and syncs its new name', () => {
  const { model, reserve } = setup();
  const capability = reserve();
  assert.deepEqual(Object.keys(capability), ['publish', 'abort', 'snapshot']);
  assert.equal(Object.isFrozen(capability), true);
  assert.equal(model.file().data.length, 0);
  assert.equal(model.file().mode, 0o100600n);
  assert.equal(capability.snapshot().phase, 'RESERVED');
  assert.equal(capability.snapshot().ownedFDCount, 2);
  assert.equal(capability.snapshot().created, true);
  assert.equal(capability.snapshot().counts.fsyncs, 1);
  assert.equal(capability.snapshot().counts.writeAttempts, 0);
  assert.equal(capability.snapshot().counts.readAttempts, 0);
  capability.abort();
  assert.equal(model.file().data.length, 0);
  assert.equal(capability.snapshot().phase, 'FAILED');
  assertClosedOnce(model, capability);
});

for (const mode of [0o100444, 0o120777, 0o40755]) test(`EEXIST ${mode.toString(8)} never reads, chmods, or overwrites existing evidence`, () => {
  const model = memory(), previous = model.existing(mode);
  const before = Buffer.from(previous.data);
  const { reserve, fixture } = setup(undefined, model);
  assert.throws(reserve, hasCode('EXISTS'));
  assert.equal(model.file(), previous);
  assert.deepEqual(previous.data, before);
  for (const method of ['writeSync', 'readSync', 'fchmodSync']) {
    assert.equal(model.calls.some(call => call.method === method), false);
  }
  assert.equal(model.calls.some(call => call.method === 'lstatSync' && call.args[0] === PATH), false);
  assert.throws(() => fixture.reserveToolchainEvidencePublication(), hasCode('STATE'));
  assertClosedOnce(model);
});

for (const path of DIRS) for (const [key, value] of [
  ['mode', 0o120777n], ['mode', 0o40775n], ['mode', 0o40757n], ['uid', 0n], ['gid', 0n],
]) test(`reject directory ${path.slice(ROOT.length) || 'repo'} ${key}=${value}`, () => {
  const model = memory();
  model.nodes.get(path)[key] = value;
  assert.throws(setup(undefined, model).reserve, hasCode('DIRECTORY'));
  assert.equal(model.nodes.has(PATH), false);
  assertClosedOnce(model);
});

test('missing directories fail without mkdir or target creation', () => {
  const model = memory();
  model.nodes.delete(DIR);
  assert.throws(setup(undefined, model).reserve, hasCode('IO'));
  assert.equal(model.nodes.has(PATH), false);
});

test('directory FD/name security disagreement fails before creation', () => {
  const model = memory();
  model.hook = call => {
    if (call.method === 'fstatSync' && call.when === 'after') call.result.ino++;
  };
  assert.throws(setup(undefined, model).reserve, hasCode('BINDING'));
  assert.equal(model.nodes.has(PATH), false);
  assertClosedOnce(model);
});

test('independent file device and directory timestamp/size changes are supported', () => {
  const { model, capability, publication } = successful();
  assert.notEqual(model.file().dev, model.nodes.get(DIR).dev);
  assert.ok(model.nodes.get(DIR).ctimeNs > 1n);
  assert.equal(publication.state, 'PUBLISHED_READBACK_MATCHED');
  assert.equal(publication.path, PATH);
  assert.equal(publication.byteLength, DATA.length);
  assert.equal(publication.sha256, digest(DATA));
  assert.equal(publication.mode, '0444');
  assert.equal(publication.fileMetadata.mode, '33060');
  assert.equal(publication.directorySynced, true);
  assert.equal(publication.readbackVerified, true);
  assert.equal(Object.hasOwn(publication, 'publicationAccepted'), false);
  for (const key of ['sourceRootAuthentication', 'ancestorRacesExcluded', 'atomicCrashCommit',
    'storageFailureSurvival', 'hardDeadlineGuaranteed', 'nativeQualified', 'abiQualified', 'authenticatedStorage']) {
    assert.equal(publication[key], false);
  }
  assert.match(publication.accountingScope, /not RSS or collector stage\/archive owners/);
  assert.deepEqual(model.file().data, DATA);
  assert.equal(model.fds.size, 0);
  assert.equal(capability.snapshot().ownedFDCount, 0);
  assert.equal(publication.counts.peakOwnedFDs, 2);
  assert.equal(Object.isFrozen(publication), true);
  assert.equal(Object.isFrozen(publication.fileMetadata), true);
  assert.equal(Object.isFrozen(publication.counts), true);
  assertClosedOnce(model, capability);
});

test('input snapshot, single scratch, accounting, wipes, and metadata-only snapshots', () => {
  const original = Buffer.from(DATA);
  const { model, publication, capability } = successful(undefined, memory(), original);
  assert.deepEqual(original, DATA);
  assert.equal(new Set(model.writeBuffers).size, 1);
  assert.equal(new Set(model.readBuffers).size, 1);
  assert.ok(model.writeBuffers.every(bytes => bytes.every(byte => byte === 0)));
  assert.ok(model.readBuffers.every(bytes => bytes.every(byte => byte === 0)));
  assert.notEqual(model.writeBuffers[0], original);
  assert.equal(publication.counts.inputBytes, DATA.length);
  assert.equal(publication.counts.copiedBytes, DATA.length);
  assert.equal(publication.counts.inputHashBytes, DATA.length);
  assert.equal(publication.counts.readbackHashBytes, DATA.length);
  assert.equal(publication.counts.wipedSnapshotBytes, DATA.length);
  assert.equal(publication.counts.ownedSnapshotBytes, 0);
  assert.equal(publication.counts.ownedScratchBytes, 0);
  assert.equal(publication.counts.peakOwnedScratchBytes, 65536);
  assert.ok(!JSON.stringify(capability.snapshot()).includes('member-digest'));
  assert.equal(Object.isFrozen(capability.snapshot()), true);
});

test('source mutation during writes cannot change the owned snapshot', () => {
  const model = memory(), original = Buffer.from(DATA);
  model.hook = call => {
    if (call.method === 'writeSync' && call.when === 'before') original.fill(120);
  };
  const { publication } = successful(undefined, model, original);
  assert.equal(publication.sha256, digest(DATA));
  assert.deepEqual(model.file().data, DATA);
});

test('native Uint8Array offset view works without inherited input methods', () => {
  const backing = new Uint8Array(DATA.length + 7);
  backing.set(DATA, 3);
  const bytes = new Uint8Array(backing.buffer, 3, DATA.length);
  bytes.subarray = () => { throw error('input-secret'); };
  assert.equal(successful(undefined, memory(), bytes).publication.sha256, digest(DATA));
});

test('partial positive writes and reads make bounded progress', () => {
  const model = memory();
  model.writeCap = 3;
  model.readCap = 2;
  const { publication } = successful({ chunkBytes: 7 }, model);
  assert.ok(publication.counts.writeAttempts > 1);
  assert.ok(publication.counts.readAttempts > 1);
  assert.equal(publication.counts.writtenBytes, DATA.length);
  assert.equal(publication.counts.readbackBytes, DATA.length);
  assert.ok(model.calls.filter(call => call.method === 'writeSync').every(call => call.args[3] <= 7));
  assert.ok(model.calls.filter(call => call.method === 'readSync').every(call => call.args[3] <= 7));
});

for (const amount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 65537, undefined]) {
  test(`invalid write progress ${amount} stops without repair`, () => {
    const model = memory();
    model.hook = call => { if (call.method === 'writeSync' && call.when === 'after') call.result = amount; };
    const { capability } = failPublication(model, 'WRITE');
    const count = model.calls.length;
    assert.throws(() => capability.publish(DATA), hasCode('STATE'));
    capability.abort(); capability.abort();
    assert.equal(model.calls.length, count);
  });
}

for (const amount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 65537, undefined]) {
  test(`invalid read progress ${amount} stops and retains sealed evidence`, () => {
    const model = memory();
    model.hook = call => { if (call.method === 'readSync' && call.when === 'after') call.result = amount; };
    const { capability } = failPublication(model, 'READ');
    assert.equal(capability.snapshot().sealed, true);
    assert.equal(model.file().mode, 0o100444n);
    assert.ok(model.readBuffers[0].every(byte => byte === 0));
  });
}

for (const [limits, prepare] of [
  [{ maxWriteAttempts: 1 }, model => { model.writeCap = 1; }],
  [{ maxReadAttempts: 1 }, model => { model.readCap = 1; }],
  [{ maxRequestedReadBytes: 2 }, () => {}],
  [{ maxFsOperations: 17 }, () => {}],
]) test(`operation budget stops with ${JSON.stringify(limits)}`, () => {
  const model = memory(); prepare(model);
  const { capability } = failPublication(model, 'LIMIT', limits);
  const counts = capability.snapshot().counts;
  assert.ok(counts.fsOperations <= (limits.maxFsOperations ?? LIMITS.maxFsOperations));
  assert.ok(counts.writeAttempts <= (limits.maxWriteAttempts ?? LIMITS.maxWriteAttempts));
  assert.ok(counts.readAttempts <= (limits.maxReadAttempts ?? LIMITS.maxReadAttempts));
  assert.ok(counts.requestedReadBytes <= (limits.maxRequestedReadBytes ?? LIMITS.maxRequestedReadBytes));
});

test('EOF consumes a physical one-byte request and exact requested-byte budget', () => {
  const { model, publication } = successful({ maxRequestedReadBytes: DATA.length + 1 });
  const reads = model.calls.filter(call => call.method === 'readSync');
  assert.equal(reads.at(-1).args[3], 1);
  assert.equal(reads.at(-1).args[4], DATA.length);
  assert.equal(publication.counts.requestedReadBytes, DATA.length + 1);
});

test('missing EOF request budget fails rather than accepting known logical size', () => {
  failPublication(memory(), 'LIMIT', { maxRequestedReadBytes: DATA.length });
});

test('lowered size cap includes terminal LF at exact boundary and rejects boundary plus one', () => {
  const cap = 96;
  const exact = Buffer.from('{"x":"' + 'a'.repeat(cap - 9) + '"}\n');
  assert.equal(exact.length, cap);
  assert.equal(successful({ maxBytes: cap, maxRequestedReadBytes: cap + 1 }, memory(), exact).publication.byteLength, cap);
  failPublication(memory(), 'BYTES', { maxBytes: cap }, Buffer.concat([exact.subarray(0, -1), Buffer.from(' \n')]));
});

for (const [label, bytes] of [
  ['missing LF', Buffer.from('{"x":1}')], ['NUL', Buffer.from('{"x":"\0"}\n')],
  ['non-ASCII', Buffer.from('{"x":"é"}\n')], ['two values', Buffer.from('{} {}\n')],
  ['array', Buffer.from('[]\n')], ['null', Buffer.from('null\n')], ['number', Buffer.from('42\n')],
  ['invalid JSON', Buffer.from('{x:1}\n')], ['root self digest', Buffer.from('{"selfDigest":"x"}\n')],
  ['root acceptance false', Buffer.from('{"publicationAccepted":false}\n')],
  ['root readback flag', Buffer.from('{"readbackVerified":true}\n')],
  ['root postwrite accounting', Buffer.from('{"postWriteCounts":{}}\n')],
]) test(`JSON rejection: ${label}`, () => {
  const { model } = failPublication(memory(), 'JSON', undefined, bytes);
  assert.equal(model.file().data.length, 0);
  assert.equal(model.calls.some(call => call.method === 'fchmodSync'), false);
});

test('member digests, escaped Unicode, and nested fields are not forbidden', () => {
  const bytes = Buffer.from('{"sha256":"allowed","member":{"selfDigest":"ok","publicationAccepted":false},"text":"\\u00e9"}\n');
  assert.equal(successful(undefined, memory(), bytes).publication.sha256, digest(bytes));
});

for (const [label, factory] of [
  ['string', () => '{}\n'], ['plain object', () => ({ length: 3 })],
  ['proxy', () => new Proxy(DATA, { get() { throw error('getter-secret'); } })],
  ['shared backing', () => new Uint8Array(new SharedArrayBuffer(4))],
  ['Uint16Array', () => new Uint16Array(4)],
  ['subclass', () => new (class extends Uint8Array {})(4)],
  ['accessor length', () => Object.defineProperty(Buffer.from(DATA), 'length', { get() { throw error('getter-secret'); } })],
  ['detached backing', () => { const bytes = new Uint8Array(4); structuredClone(bytes.buffer, { transfer: [bytes.buffer] }); return bytes; }],
]) test(`hostile bytes rejected before copy: ${label}`, () => {
  const { model, capability } = failPublication(memory(), 'BYTES', undefined, factory());
  assert.equal(capability.snapshot().counts.copiedBytes, 0);
  assert.equal(model.file().data.length, 0);
});

test('resizable backing is rejected before copy when supported', { skip: !Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable') }, () => {
  failPublication(memory(), 'BYTES', undefined, new Uint8Array(new ArrayBuffer(8, { maxByteLength: 16 })));
});

for (const [label, change, expected] of [
  ['inode', value => { value.ino++; }, 'BINDING'],
  ['size', value => { value.size++; }, 'FILE'],
  ['hardlink', value => { value.nlink++; }, 'FILE'],
  ['mode', value => { value.mode = 0o100644n; }, 'FILE'],
  ['uid', value => { value.uid = 0n; }, 'FILE'],
  ['gid', value => { value.gid = 0n; }, 'FILE'],
]) test(`write-time ${label} tamper stops sealing`, () => {
  const model = memory();
  model.hook = call => { if (call.method === 'writeSync' && call.when === 'after') change(model.file()); };
  const { capability } = failPublication(model, expected);
  assert.equal(capability.snapshot().sealed, false);
  assert.equal(model.calls.some(call => call.method === 'fchmodSync'), false);
});

for (const [label, change] of [
  ['inode', value => { value.ino++; }], ['size', value => { value.size++; }],
  ['hardlink', value => { value.nlink++; }], ['mode', value => { value.mode = 0o100644n; }],
  ['mtime', value => { value.mtimeNs++; }], ['ctime', value => { value.ctimeNs++; }],
]) test(`read-time ${label} change fails full sealed metadata match`, () => {
  const model = memory(); let changed = false;
  model.hook = call => {
    if (!changed && call.method === 'readSync' && call.when === 'after') { changed = true; change(model.file()); }
  };
  failPublication(model, 'BINDING');
});

test('named-file replacement after writing is rejected against owned FD', () => {
  const model = memory();
  model.hook = call => {
    if (call.method === 'writeSync' && call.when === 'after') {
      model.nodes.set(PATH, { ...model.file(), ino: 999n });
    }
  };
  failPublication(model, 'BINDING');
});

test('wrong chmod result cannot become sealed evidence', () => {
  const model = memory();
  model.hook = call => {
    if (call.method === 'fchmodSync' && call.when === 'after') model.file().mode = 0o100644n;
  };
  failPublication(model, 'FILE');
});

test('new file must bind empty full metadata before reservation returns', () => {
  const model = memory();
  model.hook = call => {
    if (call.method === 'openSync' && call.when === 'after' && call.args[0] === PATH) model.file().size = 1n;
  };
  assert.throws(setup(undefined, model).reserve, hasCode('FILE'));
  assert.equal(model.nodes.has(PATH), true);
  assertClosedOnce(model);
});

test('creation-time named/FD full metadata discrepancy fails reservation', () => {
  const model = memory();
  model.hook = call => {
    if (call.method === 'lstatSync' && call.when === 'after' && call.args[0] === PATH) call.result.ctimeNs++;
  };
  assert.throws(setup(undefined, model).reserve, hasCode('BINDING'));
  assertClosedOnce(model);
});

test('readback digest mismatch never yields publication record', () => {
  const model = memory();
  model.hook = call => {
    if (call.method === 'readSync' && call.when === 'after' && call.result > 0) call.args[1][0] ^= 1;
  };
  failPublication(model, 'HASH');
});

test('physical trailing byte fails EOF even when named size stays expected', () => {
  const model = memory(); let changed = false;
  model.hook = call => {
    if (!changed && call.method === 'readSync' && call.when === 'before') {
      changed = true;
      model.file().data = Buffer.concat([model.file().data, Buffer.from('x')]);
    }
  };
  failPublication(model, 'EOF');
});

test('final directory security change invalidates a matching sealed file', () => {
  const model = memory(); let syncs = 0;
  model.hook = call => {
    if (call.method === 'fsyncSync' && call.when === 'after' && ++syncs === 4) model.nodes.get(DIR).nlink++;
  };
  failPublication(model, 'BINDING');
});

test('final named-file mutation invalidates a matching completed readback', () => {
  const model = memory(); let syncs = 0;
  model.hook = call => {
    if (call.method === 'fsyncSync' && call.when === 'after' && ++syncs === 4) model.file().mode = 0o100600n;
  };
  failPublication(model, 'BINDING');
});

for (const which of [1, 2, 3, 4]) test(`fsync failure #${which} retains evidence and closes without retry`, () => {
  const model = memory(); let syncs = 0;
  model.hook = call => {
    if (call.method === 'fsyncSync' && call.when === 'before' && ++syncs === which) throw error('ENOTSUP');
  };
  const state = setup(undefined, model);
  if (which === 1) {
    assert.throws(state.reserve, hasCode('IO'));
    assert.equal(model.file().data.length, 0);
    assert.equal(model.file().mode, 0o100600n);
  } else {
    const capability = state.reserve();
    assert.throws(() => capability.publish(DATA), hasCode('IO'));
    assert.equal(capability.snapshot().ownedFDCount, 0);
    assert.deepEqual(model.file().data, DATA);
  }
  assert.equal(syncs, which);
  assert.equal(model.nodes.has(PATH), true);
  assertClosedOnce(model);
  assert.throws(state.reserve, hasCode('STATE'));
});

for (const which of [1, 2, 3]) test(`positive close failure #${which} clears ownership once and closes others`, () => {
  const model = memory(); let closes = 0;
  model.hook = call => {
    if (call.method === 'closeSync' && call.when === 'before' && ++closes === which) throw error('close-secret');
  };
  const { capability } = failPublication(model, 'CLOSE');
  assert.equal(capability.snapshot().closeFailed, true);
  assert.equal(capability.snapshot().cleanupUncertain, true);
  const before = model.calls.length;
  const cleanup = capability.abort(); capability.abort();
  assert.equal(cleanup.closeFailed, true);
  assert.equal(cleanup.cleanupUncertain, true);
  assert.equal(model.calls.length, before);
});

test('expired guard cannot prevent any cleanup close, even when one close fails', () => {
  const model = memory();
  const { reserve } = setup(undefined, model);
  const capability = reserve();
  model.guardHook = () => { throw error('outer-deadline-secret'); };
  let closes = 0;
  model.hook = call => {
    if (call.method === 'closeSync' && call.when === 'before' && ++closes === 1) throw error('close-secret');
  };
  assert.throws(() => capability.publish(DATA), hasCode('CLOSE'));
  assert.equal(closes, 2);
  assert.equal(capability.snapshot().ownedFDCount, 0);
  assert.equal(capability.snapshot().cleanupUncertain, true);
  assert.equal(model.file().data.length, 0);
  assertClosedOnce(model, capability);
});

test('post-open guard failure still owns and cleans newly created descriptors', () => {
  const model = memory(); let expired = false;
  model.hook = call => {
    if (call.method === 'openSync' && call.when === 'after' && call.args[0] === PATH) expired = true;
  };
  model.guardHook = () => { if (expired) throw error('deadline-secret'); };
  assert.throws(setup(undefined, model).reserve, hasCode('GUARD'));
  assert.equal(model.file().data.length, 0);
  assert.equal(model.calls.filter(call => call.method === 'closeSync').length, 2);
  assertClosedOnce(model);
});

test('original guard remains active across the collection interval', () => {
  const model = memory(); let expired = false;
  model.guardHook = () => { if (expired) throw error('total-deadline'); };
  const { reserve } = setup(undefined, model);
  const capability = reserve();
  expired = true;
  assert.throws(() => capability.publish(DATA), hasCode('GUARD'));
  assert.equal(model.file().data.length, 0);
  assertClosedOnce(model, capability);
});

test('late original guard after valid-looking file prevents publication return', () => {
  const model = memory(); let closes = 0;
  model.hook = call => { if (call.method === 'closeSync' && call.when === 'after') closes++; };
  model.guardHook = () => { if (closes === 3) throw error('late-clock-secret'); };
  const { capability } = failPublication(model, 'GUARD');
  assert.deepEqual(model.file().data, DATA);
  assert.equal(model.file().mode, 0o100444n);
  assert.equal(capability.snapshot().sealed, true);
  assert.equal(capability.snapshot().counts.ownedSnapshotBytes, 0);
});

test('abort after success cannot delete evidence or assert controller acceptance', () => {
  const { model, capability, publication } = successful();
  const count = model.calls.length;
  assert.throws(() => capability.publish(DATA), hasCode('STATE'));
  const cleanup = capability.abort(); capability.abort();
  assert.equal(model.calls.length, count);
  assert.equal(capability.snapshot().phase, 'PUBLISHED_READBACK_MATCHED');
  assert.equal(Object.hasOwn(publication, 'publicationAccepted'), false);
  assert.equal(Object.hasOwn(cleanup, 'publicationAccepted'), false);
  assert.deepEqual(model.file().data, DATA);
});

test('abort is idempotent and prevents publication of a pending empty file', () => {
  const { model, reserve } = setup();
  const capability = reserve();
  const first = capability.abort();
  const count = model.calls.length;
  assert.deepEqual(capability.abort(), first);
  assert.equal(model.calls.length, count);
  assert.throws(() => capability.publish(DATA), hasCode('STATE'));
  assert.equal(model.file().data.length, 0);
  assert.equal(capability.snapshot().error, 'E_PUBLICATION_ABORTED');
});

test('fixture reservation accepts zero arguments only and consumes one attempt', () => {
  const { model, fixture } = setup();
  assert.throws(() => fixture.reserveToolchainEvidencePublication({ path: 'secret' }), hasCode('ARGUMENT'));
  assert.equal(model.calls.length, 0);
  const capability = fixture.reserveToolchainEvidencePublication();
  assert.throws(() => fixture.reserveToolchainEvidencePublication(), hasCode('STATE'));
  capability.abort();
});

test('publication extra arguments fail pending file without writing', () => {
  const { model, reserve } = setup();
  const capability = reserve();
  assert.throws(() => capability.publish(DATA, {}), hasCode('ARGUMENT'));
  assert.equal(model.file().data.length, 0);
  assertClosedOnce(model, capability);
});

for (const [label, options] of [
  ['no mock marker', {}], ['false mock marker', { mockOnly: false }],
  ['path override', { mockOnly: true, path: PATH }],
  ['increased bound', { mockOnly: true, limits: { maxBytes: LIMITS.maxBytes + 1 } }],
  ['zero bound', { mockOnly: true, limits: { chunkBytes: 0 } }],
  ['fractional bound', { mockOnly: true, limits: { maxReadAttempts: 1.5 } }],
  ['unknown bound', { mockOnly: true, limits: { maxDurationMs: 1 } }],
  ['accessor options', Object.defineProperty({}, 'mockOnly', { get() { throw error('getter-secret'); } })],
  ['proxy options', new Proxy({}, { ownKeys() { throw error('proxy-secret'); } })],
  ['proxy limits', { mockOnly: true, limits: new Proxy({}, {}) }],
]) test(`fixture rejects ${label} before filesystem`, () => {
  const model = memory();
  assert.throws(() => createEvidencePublicationFixture(options, { fs: model.fs, guard: model.guard }), hasCode('FIXTURE'));
  assert.equal(model.calls.length, 0);
});

for (const label of ['real fs', 'proxy fs', 'missing method', 'real method', 'accessor method', 'proxy method',
  'proxy guard', 'accessor dependency', 'proxy dependency']) test(`fixture rejects ${label} TCB before filesystem`, () => {
  const model = memory();
  let deps = { fs: model.fs, guard: model.guard };
  if (label === 'real fs') deps.fs = fs;
  if (label === 'proxy fs') deps.fs = new Proxy(model.fs, {});
  if (label === 'missing method') delete model.fs.readSync;
  if (label === 'real method') model.fs.readSync = fs.readSync;
  if (label === 'accessor method') Object.defineProperty(model.fs, 'readSync', { get() { throw error('getter-secret'); } });
  if (label === 'proxy method') model.fs.readSync = new Proxy(model.fs.readSync, {});
  if (label === 'proxy guard') deps.guard = new Proxy(model.guard, {});
  if (label === 'accessor dependency') Object.defineProperty(deps, 'guard', { get() { throw error('getter-secret'); } });
  if (label === 'proxy dependency') deps = new Proxy(deps, {});
  assert.throws(() => createEvidencePublicationFixture({ mockOnly: true }, deps), hasCode('FIXTURE'));
  assert.equal(model.calls.length, 0);
});

test('captured fake methods cannot switch to a later replacement', () => {
  const { model, reserve } = setup();
  model.fs.openSync = () => { throw error('replacement-secret'); };
  const capability = reserve();
  assert.equal(capability.publish(DATA).readbackVerified, true);
});

test('metadata accessors and proxies are rejected without invocation', () => {
  for (const proxy of [false, true]) {
    const model = memory();
    model.hook = call => {
      if (call.method === 'lstatSync' && call.when === 'after') {
        if (proxy) call.result = new Proxy(call.result, {});
        else Object.defineProperty(call.result, 'uid', { get() { throw error('metadata-secret'); } });
      }
    };
    assert.throws(setup(undefined, model).reserve, hasCode('METADATA'));
    assert.equal(model.nodes.has(PATH), false);
  }
});

test('filesystem guards surround calls and cleanup never introduces unregistered operations', () => {
  const model = memory(); let last = 0;
  model.hook = call => {
    if (call.when === 'before') { assert.ok(model.guardCalls > last); last = model.guardCalls; }
    else assert.equal(model.guardCalls, last);
  };
  const { publication } = successful(undefined, model);
  assert.equal(publication.counts.fsOperations, model.calls.length);
  assert.equal(publication.counts.guardChecks, model.guardCalls);
  assert.ok(publication.counts.guardChecks >= 2 * model.calls.length);
  assert.ok(model.calls.every(call => ['lstatSync', 'openSync', 'fstatSync', 'fsyncSync',
    'fchmodSync', 'writeSync', 'readSync', 'closeSync'].includes(call.method)));
});

test('every filesystem failure boundary closes known ownership once without repair', () => {
  const baseline = successful().model.calls;
  for (let boundary = 0; boundary < baseline.length; boundary++) {
    const model = memory(); let ordinal = 0;
    model.hook = call => {
      if (call.when === 'before' && ordinal++ === boundary) throw error('EIO-secret');
    };
    const { reserve, fixture } = setup(undefined, model);
    let capability;
    assert.throws(() => {
      capability = reserve();
      capability.publish(DATA);
    }, hasCode(baseline[boundary].method === 'closeSync' ? 'CLOSE' : 'IO'), String(boundary));
    assertClosedOnce(model, capability);
    if (capability) {
      assert.equal(capability.snapshot().phase, 'FAILED');
      assert.equal(capability.snapshot().counts.ownedSnapshotBytes, 0);
      assert.equal(capability.snapshot().counts.ownedScratchBytes, 0);
      const calls = model.calls.length;
      capability.abort(); capability.abort();
      assert.equal(model.calls.length, calls);
    }
    assert.throws(() => fixture.reserveToolchainEvidencePublication(), hasCode('STATE'));
    if (model.nodes.has(PATH)) assert.ok(model.file().data.length <= DATA.length);
  }
});

test('every original-guard boundary stops acceptance and permits all owned cleanup closes', () => {
  const baselineChecks = successful().publication.counts.guardChecks;
  for (let boundary = 1; boundary <= baselineChecks; boundary++) {
    const model = memory();
    model.guardHook = current => { if (current.guardCalls >= boundary) throw error('deadline-secret'); };
    const { reserve } = setup(undefined, model);
    let capability;
    assert.throws(() => {
      capability = reserve();
      capability.publish(DATA);
    }, hasCode('GUARD'), String(boundary));
    assertClosedOnce(model, capability);
    assert.equal(model.fds.size, 0);
    assert.ok(model.writeBuffers.every(bytes => bytes.every(byte => byte === 0)));
    assert.ok(model.readBuffers.every(bytes => bytes.every(byte => byte === 0)));
    if (capability) assert.equal(capability.snapshot().phase, 'FAILED');
  }
});

test('all lower filesystem budgets include mandatory cleanup attempts', () => {
  const needed = successful().publication.counts.fsOperations;
  for (let maxFsOperations = 1; maxFsOperations <= needed; maxFsOperations++) {
    const model = memory();
    const { reserve } = setup({ maxFsOperations }, model);
    let capability;
    try { capability = reserve(); capability.publish(DATA); }
    catch (failure) { assert.equal(failure.code, 'E_PUBLICATION_LIMIT'); }
    assert.ok(model.calls.length <= maxFsOperations, String(maxFsOperations));
    assertClosedOnce(model, capability);
    assert.equal(model.fds.size, 0);
  }
});

test('write error retains exact partial bytes, wipes the snapshot, and never reopens for repair', () => {
  const model = memory(); let writes = 0;
  model.writeCap = 5;
  model.hook = call => {
    if (call.method === 'writeSync' && call.when === 'before' && ++writes === 3) throw error('EIO');
  };
  const { capability } = failPublication(model, 'IO');
  assert.deepEqual(model.file().data, DATA.subarray(0, 10));
  assert.equal(model.file().mode, 0o100600n);
  assert.ok(model.writeBuffers.every(bytes => bytes.every(byte => byte === 0)));
  const count = model.calls.length;
  assert.throws(() => capability.publish(DATA), hasCode('STATE'));
  capability.abort();
  assert.equal(model.calls.length, count);
});

test('file replacement before read-open fails the sealed identity check', () => {
  const model = memory();
  model.hook = call => {
    if (call.method === 'openSync' && call.when === 'before' && call.args[0] === PATH &&
      (call.args[1] & fs.constants.O_CREAT) === 0) {
      model.nodes.set(PATH, { ...model.file(), ino: model.file().ino + 1n });
    }
  };
  failPublication(model, 'BINDING');
});

for (const [label, change, expected] of [
  ['symlink', value => { value.mode = 0o120777n; }, 'FILE'],
  ['hardlink', value => { value.nlink++; }, 'FILE'],
  ['owner', value => { value.uid = 0n; }, 'FILE'],
  ['inode', value => { value.ino++; }, 'BINDING'],
]) test(`seal-time ${label} mutation stops readback`, () => {
  const model = memory();
  model.hook = call => {
    if (call.method === 'fchmodSync' && call.when === 'after') change(model.file());
  };
  failPublication(model, expected);
  assert.equal(model.calls.some(call => call.method === 'readSync'), false);
});
