// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as split from './split-evidence-publication.mjs';

const { SPLIT_EVIDENCE_PARTS: PARTS, SPLIT_EVIDENCE_PATHS: PATHS,
  SPLIT_EVIDENCE_PUBLICATION_LIMITS: LIMITS, reserveSplitEvidencePublication,
  createSplitEvidencePublicationFixture } = split;
const ROOT = '/tmp/opencode/f9-bootstrap-correspondence';
const DIR = ROOT + '/_spec/tooling/native-ingress';
const DIRS = [ROOT, ROOT + '/_spec', ROOT + '/_spec/tooling', DIR];
const V1 = DIR + '/toolchain-evidence-collection-v1.result.json';
const FULL = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs'];
const DATA = Buffer.from('{"collection":{"sha256":"member-digest","complete":true}}\n');
const error = code => Object.assign(new Error(code), { code });
const hasCode = suffix => failure => failure.code === 'E_PUBLICATION_' + suffix &&
  Object.hasOwn(failure, 'code') && !failure.message.includes('secret');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function memory(selected = 'gnu') {
  let inode = 10n, fd = 100;
  const model = { nodes: new Map(), fds: new Map(), calls: [], writeBuffers: [], readBuffers: [],
    hook: null, guardHook: null, guardCalls: 0, writeCap: Infinity, readCap: Infinity };
  function node(mode, data = Buffer.alloc(0)) {
    return { dev: 7n, ino: inode++, mode: BigInt(mode), uid: 1000n, gid: 1000n,
      nlink: mode === 0o40755 ? 2n : 1n, size: BigInt(data.length), mtimeNs: 1n, ctimeNs: 1n, data };
  }
  for (const path of DIRS) model.nodes.set(path, node(0o40755));
  const retained = Object.freeze(node(0o100600));
  model.nodes.set(V1, retained);
  const copyStat = value => Object.fromEntries(FULL.map(key => [key, value[key]]));
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
        assert.ok(Object.values(PATHS).includes(path));
        assert.equal(mode, 0o600);
        assert.ok((flags & fs.constants.O_EXCL) !== 0);
        assert.ok((flags & fs.constants.O_WRONLY) !== 0);
        if (value) throw error('EEXIST');
        value = node(0o100600);
        value.dev = path === PATHS.gnu ? 19n : 23n;
        model.nodes.set(path, value);
        model.nodes.get(DIR).ctimeNs++;
        model.nodes.get(DIR).mtimeNs++;
        model.nodes.get(DIR).size++;
      } else if (path === DIR) {
        assert.ok((flags & fs.constants.O_DIRECTORY) !== 0);
      } else {
        assert.ok(Object.values(PATHS).includes(path));
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
      assert.ok(Object.values(PATHS).includes(value.path));
      assert.ok((value.flags & fs.constants.O_WRONLY) !== 0);
      assert.equal(mode, 0o444);
      value.node.mode = BigInt(0o100000 | mode);
      value.node.ctimeNs++;
    },
    writeSync(id, bytes, offset, length, position) {
      const value = model.fds.get(id);
      assert.ok(Object.values(PATHS).includes(value.path));
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
      assert.ok(Object.values(PATHS).includes(value.path));
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
      if (typeof args[0] === 'string') {
        assert.ok([...DIRS, ...Object.values(PATHS)].includes(args[0]));
        assert.notEqual(args[0], V1);
      }
      assert.equal(model.nodes.get(V1), retained);
      assert.equal(retained.data.length, 0);
      const call = { method, args, when: 'before' };
      model.calls.push(call);
      model.hook?.(call, model);
      const result = Reflect.apply(implementation, null, args);
      const after = { method, args, when: 'after', result };
      model.hook?.(after, model);
      return after.result;
    }]));
  model.guard = () => { model.guardCalls++; model.guardHook?.(model); };
  model.file = (part = selected) => model.nodes.get(PATHS[part]);
  model.existing = (mode = 0o100444, part = selected) => {
    const value = node(mode, Buffer.from('existing-secret'));
    model.nodes.set(PATHS[part], value);
    return value;
  };
  return model;
}
function fixtureFor(model, limits) {
  return createSplitEvidencePublicationFixture({ mockOnly: true, ...(limits ? { limits } : {}) },
    { fs: model.fs, guard: model.guard });
}
function assertClosedOnce(model, capability) {
  const closes = model.calls.filter(call => call.method === 'closeSync').map(call => call.args[0]);
  assert.equal(new Set(closes).size, closes.length);
  if (capability) assert.equal(capability.snapshot().ownedFDCount, 0);
}

test('pinned V1 raw bytes and split-only source adaptation remain exact', () => {
  const original = fs.readFileSync(new URL('./evidence-publication.mjs', import.meta.url));
  assert.equal(original.length, 17766);
  assert.equal(digest(original), '877bcf4484ef220df25e97a436ad8a408d8dbe990f4d779470216acb9f63b6f0');
  let expected = original.toString('utf8');
  const change = (from, to) => {
    assert.equal(expected.split(from).length, 2, from);
    expected = expected.replace(from, to);
  };
  change(`export const EVIDENCE_PUBLICATION_PATH = '${V1}';`,
    `export const SPLIT_EVIDENCE_PARTS = Object.freeze(['gnu', 'rust']);\n` +
    `export const SPLIT_EVIDENCE_PATHS = Object.freeze({\n` +
    `  gnu: '${DIR}/gnu-evidence-collection-v1.result.json',\n` +
    `  rust: '${DIR}/rust-evidence-collection-v1.result.json',\n});`);
  expected = expected.replaceAll('EVIDENCE_PUBLICATION_LIMITS', 'SPLIT_EVIDENCE_PUBLICATION_LIMITS');
  change('let productionReserved = false;', 'const productionReserved = new Map();');
  change(`export function reserveToolchainEvidencePublication(guard) {
  requireThat(arguments.length === 1, 'ARGUMENT');
  trustedFunction(guard, 'ARGUMENT');
  requireThat(!productionReserved, 'STATE');
  productionReserved = true;
  return reserve(fs, guard, SPLIT_EVIDENCE_PUBLICATION_LIMITS);
}`, `export function reserveSplitEvidencePublication(part, guard) {
  requireThat(arguments.length === 2 && SPLIT_EVIDENCE_PARTS.includes(part), 'ARGUMENT');
  trustedFunction(guard, 'ARGUMENT');
  requireThat(!productionReserved.has(part), 'STATE');
  productionReserved.set(part, true);
  return reserve(fs, guard, SPLIT_EVIDENCE_PUBLICATION_LIMITS, part);
}`);
  change('export function createEvidencePublicationFixture(options, dependencies)',
    'export function createSplitEvidencePublicationFixture(options, dependencies)');
  change(`  let consumed = false;
  return Object.freeze({ reserveToolchainEvidencePublication() {
    requireThat(arguments.length === 0, 'ARGUMENT');
    requireThat(!consumed, 'STATE');
    consumed = true;
    return reserve(Object.freeze(captured), guard, Object.freeze(limits));`,
  `  const consumed = new Map();
  return Object.freeze({ reserveSplitEvidencePublication(part) {
    requireThat(arguments.length === 1 && SPLIT_EVIDENCE_PARTS.includes(part), 'ARGUMENT');
    requireThat(!consumed.has(part), 'STATE');
    consumed.set(part, true);
    return reserve(Object.freeze(captured), guard, Object.freeze(limits), part);`);
  change('function reserve(backend, guard, limits) {',
    'function reserve(backend, guard, limits, part) {\n  const path = SPLIT_EVIDENCE_PATHS[part];');
  change('return Object.freeze({ phase, ownedFDCount:', 'return Object.freeze({ part, phase, ownedFDCount:');
  expected = expected.replaceAll('EVIDENCE_PUBLICATION_PATH', 'path');
  change('return Object.freeze({ state: phase, path: path, byteLength:',
    'return Object.freeze({ state: phase, part, path, byteLength:');
  assert.equal(fs.readFileSync(new URL('./split-evidence-publication.mjs', import.meta.url), 'utf8'), expected);
});

test('exact exports, two fixed paths, and frozen V1 bounds', () => {
  assert.deepEqual(Object.keys(split).sort(), ['SPLIT_EVIDENCE_PARTS', 'SPLIT_EVIDENCE_PATHS',
    'SPLIT_EVIDENCE_PUBLICATION_LIMITS', 'createSplitEvidencePublicationFixture', 'reserveSplitEvidencePublication'].sort());
  assert.deepEqual(PARTS, ['gnu', 'rust']);
  assert.deepEqual(PATHS, { gnu: DIR + '/gnu-evidence-collection-v1.result.json',
    rust: DIR + '/rust-evidence-collection-v1.result.json' });
  assert.deepEqual(LIMITS, { maxBytes: 16777216, chunkBytes: 65536, maxFsOperations: 8192,
    maxWriteAttempts: 4096, maxReadAttempts: 1024, maxRequestedReadBytes: 16777217 });
  for (const object of [PARTS, PATHS, LIMITS]) assert.equal(Object.isFrozen(object), true);
  assert.equal(reserveSplitEvidencePublication.length, 2);
  assert.equal(createSplitEvidencePublicationFixture.length, 2);
});

test('production rejects unsupported argument shapes before guard or filesystem', () => {
  let touched = false;
  const guard = () => { touched = true; };
  for (const args of [[], ['gnu'], [undefined, guard], ['GNU', guard], ['rust ', guard],
    ['../gnu', guard], [V1, guard], [PATHS.gnu, guard], [new URL('file://' + PATHS.gnu), guard],
    [Object('gnu'), guard], [Symbol('gnu'), guard], [{ toString() { touched = true; return 'gnu'; } }, guard],
    [new Proxy({}, { get() { touched = true; throw error('secret'); } }), guard],
    ['gnu', undefined], ['rust', {}], ['gnu', new Proxy(guard, {})], ['rust', guard, {}]]) {
    assert.throws(() => reserveSplitEvidencePublication(...args), hasCode('ARGUMENT'));
  }
  assert.equal(touched, false);
});

test('production guard-only failures consume independent one-shot part latches before filesystem', () => {
  const calls = [];
  for (const part of PARTS) {
    const guard = () => { calls.push(part); throw error('original-deadline-secret'); };
    assert.throws(() => reserveSplitEvidencePublication(part, guard), hasCode('GUARD'));
    assert.deepEqual(calls, PARTS.slice(0, calls.length));
    const count = calls.length;
    assert.throws(() => reserveSplitEvidencePublication(part, guard), hasCode('STATE'));
    assert.equal(calls.length, count);
  }
  assert.deepEqual(calls, PARTS);
});

test('fixture rejects invalid parts and extra arguments without consuming either latch', () => {
  const model = memory(), fixture = fixtureFor(model);
  assert.deepEqual(Object.keys(fixture), ['reserveSplitEvidencePublication']);
  assert.equal(Object.isFrozen(fixture), true);
  assert.equal(fixture.reserveSplitEvidencePublication.length, 1);
  for (const args of [[], [undefined], ['GNU'], [V1], [PATHS.rust], [new URL('file://' + PATHS.gnu)],
    [Object('rust')], [Symbol('gnu')], [new Proxy({}, {})], ['gnu', {}], ['rust', model.guard]]) {
    assert.throws(() => fixture.reserveSplitEvidencePublication(...args), hasCode('ARGUMENT'));
  }
  assert.equal(model.calls.length, 0);
  for (const part of PARTS) fixture.reserveSplitEvidencePublication(part).abort();
});

test('EEXIST consumes only GNU and never grants input authority over existing evidence', () => {
  const model = memory(), old = model.existing(), before = Buffer.from(old.data), fixture = fixtureFor(model);
  assert.throws(() => fixture.reserveSplitEvidencePublication('gnu'), hasCode('EXISTS'));
  assert.equal(model.file(), old);
  assert.deepEqual(old.data, before);
  assert.ok(model.calls.every(call => !['writeSync', 'readSync', 'fchmodSync'].includes(call.method)));
  assert.ok(model.calls.every(call => !(call.method === 'lstatSync' && call.args[0] === PATHS.gnu)));
  const count = model.calls.length;
  assert.throws(() => fixture.reserveSplitEvidencePublication('gnu'), hasCode('STATE'));
  assert.equal(model.calls.length, count);
  const rust = fixture.reserveSplitEvidencePublication('rust');
  assert.equal(rust.publish(DATA).part, 'rust');
  assert.deepEqual(old.data, before);
  assertClosedOnce(model, rust);
});

test('both pending reservations publish with independent ledgers and changing directory timestamps', () => {
  const model = memory(), fixture = fixtureFor(model);
  const gnu = fixture.reserveSplitEvidencePublication('gnu');
  const beforeRust = gnu.snapshot();
  const rust = fixture.reserveSplitEvidencePublication('rust');
  assert.deepEqual(gnu.snapshot(), beforeRust);
  assert.equal(model.fds.size, 4);
  const rustPending = rust.snapshot();
  const gnuBytes = Buffer.from('{"part":"gnu","text":"\\u00e9"}\n');
  const rustBytes = Buffer.from('{"part":"rust"}\n');
  const gnuRecord = gnu.publish(gnuBytes);
  assert.deepEqual(rust.snapshot(), rustPending);
  const rustRecord = rust.publish(rustBytes);
  for (const [part, capability, record, bytes] of [
    ['gnu', gnu, gnuRecord, gnuBytes], ['rust', rust, rustRecord, rustBytes],
  ]) {
    assert.equal(record.part, part);
    assert.equal(record.path, PATHS[part]);
    assert.equal(record.sha256, digest(bytes));
    assert.equal(record.counts.closes, 3);
    assert.equal(record.counts.fsyncs, 4);
    assert.equal(record.counts.peakOwnedFDs, 2);
    assert.equal(record.counts.inputBytes, bytes.length);
    assert.deepEqual(model.file(part).data, bytes);
    assert.equal(capability.snapshot().part, part);
    assert.equal(Object.hasOwn(record, 'publicationAccepted'), false);
    assert.throws(() => fixture.reserveSplitEvidencePublication(part), hasCode('STATE'));
  }
  assert.notEqual(gnuRecord.fileMetadata.dev, rustRecord.fileMetadata.dev);
  assert.ok(model.nodes.get(DIR).ctimeNs > 2n);
  assert.equal(model.fds.size, 0);
  assert.equal(model.calls.length, gnuRecord.counts.fsOperations + rustRecord.counts.fsOperations);
  assertClosedOnce(model);
});

for (const part of PARTS) {
  const PATH = PATHS[part];
  const fresh = () => memory(part);
  function setup(limits, model = fresh()) {
    const fixture = fixtureFor(model, limits);
    return { model, fixture, reserve: () => fixture.reserveSplitEvidencePublication(part) };
  }
  function successful(limits, model = fresh(), bytes = DATA) {
    const state = setup(limits, model), capability = state.reserve();
    const publication = capability.publish(bytes);
    return { ...state, capability, publication };
  }
  function failure(model, code, limits, bytes = DATA) {
    const state = setup(limits, model), capability = state.reserve();
    assert.throws(() => capability.publish(bytes), hasCode(code));
    const snapshot = capability.snapshot();
    assert.equal(snapshot.part, part);
    assert.equal(snapshot.phase, 'FAILED');
    assert.equal(snapshot.error, 'E_PUBLICATION_' + code);
    assert.equal(snapshot.ownedFDCount, 0);
    assert.equal(Object.hasOwn(snapshot, 'publicationAccepted'), false);
    assert.equal(model.nodes.has(PATH), true);
    assertClosedOnce(model, capability);
    return { ...state, capability };
  }
  const check = (name, fn) => test(part + ': ' + name, fn);

  check('early reservation keeps two FDs, creates empty 0600, and syncs once', () => {
    const { model, reserve } = setup(), capability = reserve();
    assert.deepEqual(Object.keys(capability), ['publish', 'abort', 'snapshot']);
    assert.equal(Object.isFrozen(capability), true);
    assert.equal(model.file().data.length, 0);
    assert.equal(model.file().mode, 0o100600n);
    const snapshot = capability.snapshot();
    assert.equal(snapshot.part, part);
    assert.equal(snapshot.phase, 'RESERVED');
    assert.equal(snapshot.created, true);
    assert.equal(snapshot.sealed, false);
    assert.equal(snapshot.ownedFDCount, 2);
    assert.equal(snapshot.counts.fsyncs, 1);
    assert.equal(snapshot.counts.writeAttempts, 0);
    assert.equal(snapshot.counts.readAttempts, 0);
    capability.abort();
    assert.equal(model.file().data.length, 0);
    assertClosedOnce(model, capability);
  });

  for (const mode of [0o100444, 0o120777, 0o40755]) check(`EEXIST ${mode.toString(8)} retains exact file`, () => {
    const model = fresh(), previous = model.existing(mode), before = Buffer.from(previous.data);
    const { reserve } = setup(undefined, model);
    assert.throws(reserve, hasCode('EXISTS'));
    assert.equal(model.file(), previous);
    assert.deepEqual(previous.data, before);
    assert.ok(model.calls.every(call => !['writeSync', 'readSync', 'fchmodSync'].includes(call.method)));
    assert.ok(model.calls.every(call => !(call.method === 'lstatSync' && call.args[0] === PATH)));
    assert.throws(reserve, hasCode('STATE'));
    assertClosedOnce(model);
  });

  for (const path of DIRS) for (const [key, value] of [
    ['mode', 0o120777n], ['mode', 0o40775n], ['mode', 0o40757n], ['uid', 0n], ['gid', 0n],
  ]) check(`reject directory ${path.slice(ROOT.length) || 'repo'} ${key}=${value}`, () => {
    const model = fresh();
    model.nodes.get(path)[key] = value;
    assert.throws(setup(undefined, model).reserve, hasCode('DIRECTORY'));
    assert.equal(model.nodes.has(PATH), false);
    assertClosedOnce(model);
  });

  check('missing directories fail without target creation', () => {
    const model = fresh();
    model.nodes.delete(DIR);
    assert.throws(setup(undefined, model).reserve, hasCode('IO'));
    assert.equal(model.nodes.has(PATH), false);
  });

  check('directory FD/name security mismatch rejects before creation', () => {
    const model = fresh();
    model.hook = call => { if (call.method === 'fstatSync' && call.when === 'after') call.result.ino++; };
    assert.throws(setup(undefined, model).reserve, hasCode('BINDING'));
    assert.equal(model.nodes.has(PATH), false);
    assertClosedOnce(model);
  });

  check('full success preserves V1 metadata, bounds, accounting and negative assurances', () => {
    const original = Buffer.from(DATA), { model, capability, publication: record } = successful(undefined, fresh(), original);
    assert.equal(record.state, 'PUBLISHED_READBACK_MATCHED');
    assert.equal(record.part, part);
    assert.equal(record.path, PATH);
    assert.equal(record.byteLength, DATA.length);
    assert.equal(record.sha256, digest(DATA));
    assert.equal(record.mode, '0444');
    assert.equal(record.fileMetadata.mode, '33060');
    assert.deepEqual(record.fileMetadata,
      Object.fromEntries(FULL.map(key => [key, model.file()[key].toString()])));
    assert.equal(record.directorySynced, true);
    assert.equal(record.readbackVerified, true);
    assert.equal(Object.hasOwn(record, 'publicationAccepted'), false);
    for (const key of ['sourceRootAuthentication', 'ancestorRacesExcluded', 'atomicCrashCommit',
      'storageFailureSurvival', 'hardDeadlineGuaranteed', 'nativeQualified', 'abiQualified', 'authenticatedStorage']) {
      assert.equal(record[key], false);
    }
    assert.match(record.accountingScope, /not RSS or collector stage\/archive owners/);
    assert.deepEqual(model.file().data, DATA);
    assert.deepEqual(original, DATA);
    assert.notEqual(model.file().dev, model.nodes.get(DIR).dev);
    assert.ok(model.nodes.get(DIR).ctimeNs > 1n);
    assert.equal(record.counts.closes, 3);
    assert.equal(record.counts.fsyncs, 4);
    assert.equal(record.counts.peakOwnedFDs, 2);
    for (const key of ['inputBytes', 'copiedBytes', 'inputHashBytes', 'readbackHashBytes', 'wipedSnapshotBytes']) {
      assert.equal(record.counts[key], DATA.length);
    }
    assert.equal(record.counts.ownedSnapshotBytes, 0);
    assert.equal(record.counts.ownedScratchBytes, 0);
    assert.equal(record.counts.peakOwnedSnapshotBytes, DATA.length);
    assert.equal(record.counts.peakOwnedScratchBytes, 65536);
    assert.equal(record.counts.jsonStringCodeUnits, DATA.length);
    assert.equal(new Set(model.writeBuffers).size, 1);
    assert.equal(new Set(model.readBuffers).size, 1);
    assert.notEqual(model.writeBuffers[0], original);
    assert.notEqual(model.writeBuffers[0].buffer, original.buffer);
    assert.notEqual(model.readBuffers[0].buffer, model.writeBuffers[0].buffer);
    assert.ok(model.writeBuffers.every(bytes => bytes.every(byte => byte === 0)));
    assert.ok(model.readBuffers.every(bytes => bytes.every(byte => byte === 0)));
    assert.ok(!JSON.stringify(capability.snapshot()).includes('member-digest'));
    for (const value of [record, record.fileMetadata, record.counts, capability.snapshot(), capability.snapshot().counts]) {
      assert.equal(Object.isFrozen(value), true);
    }
    assert.equal(model.fds.size, 0);
    assertClosedOnce(model, capability);
  });

  check('caller mutation during writes cannot mutate the private snapshot', () => {
    const model = fresh(), bytes = Buffer.from(DATA);
    model.hook = call => { if (call.method === 'writeSync' && call.when === 'before') bytes.fill(120); };
    assert.equal(successful(undefined, model, bytes).publication.sha256, digest(DATA));
    assert.deepEqual(model.file().data, DATA);
  });

  check('native offset Uint8Array ignores caller methods', () => {
    const backing = new Uint8Array(DATA.length + 7);
    backing.set(DATA, 3);
    const bytes = new Uint8Array(backing.buffer, 3, DATA.length);
    bytes.subarray = () => { throw error('input-secret'); };
    assert.equal(successful(undefined, fresh(), bytes).publication.sha256, digest(DATA));
  });

  check('partial positive writes and reads progress within lower chunk bounds', () => {
    const model = fresh(); model.writeCap = 3; model.readCap = 2;
    const { publication } = successful({ chunkBytes: 7 }, model);
    assert.ok(publication.counts.writeAttempts > 1);
    assert.ok(publication.counts.readAttempts > 1);
    assert.equal(publication.counts.writtenBytes, DATA.length);
    assert.equal(publication.counts.readbackBytes, DATA.length);
    assert.ok(model.calls.filter(call => call.method === 'writeSync').every(call => call.args[3] <= 7));
    assert.ok(model.calls.filter(call => call.method === 'readSync').every(call => call.args[3] <= 7));
  });

  for (const method of ['writeSync', 'readSync']) for (const amount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 65537, undefined]) {
    check(`${method} rejects progress ${amount} without repair`, () => {
      const model = fresh();
      model.hook = call => { if (call.method === method && call.when === 'after') call.result = amount; };
      const { capability } = failure(model, method === 'writeSync' ? 'WRITE' : 'READ');
      const count = model.calls.length;
      assert.throws(() => capability.publish(DATA), hasCode('STATE'));
      capability.abort(); capability.abort();
      assert.equal(model.calls.length, count);
      assert.ok(model.writeBuffers.every(bytes => bytes.every(byte => byte === 0)));
      assert.ok(model.readBuffers.every(bytes => bytes.every(byte => byte === 0)));
    });
  }

  for (const [limits, prepare] of [
    [{ maxWriteAttempts: 1 }, model => { model.writeCap = 1; }],
    [{ maxReadAttempts: 1 }, model => { model.readCap = 1; }],
    [{ maxRequestedReadBytes: 2 }, () => {}], [{ maxFsOperations: 17 }, () => {}],
  ]) check(`bounded failure ${JSON.stringify(limits)}`, () => {
    const model = fresh(); prepare(model);
    const { capability } = failure(model, 'LIMIT', limits);
    for (const key of ['fsOperations', 'writeAttempts', 'readAttempts', 'requestedReadBytes']) {
      const limit = 'max' + key[0].toUpperCase() + key.slice(1);
      assert.ok(capability.snapshot().counts[key] <= (limits[limit] ?? LIMITS[limit]));
    }
  });

  check('EOF makes a physical one-byte request within the exact byte budget', () => {
    const { model, publication } = successful({ maxRequestedReadBytes: DATA.length + 1 });
    const reads = model.calls.filter(call => call.method === 'readSync');
    assert.equal(reads.at(-1).args[3], 1);
    assert.equal(reads.at(-1).args[4], DATA.length);
    assert.equal(publication.counts.requestedReadBytes, DATA.length + 1);
    failure(fresh(), 'LIMIT', { maxRequestedReadBytes: DATA.length });
  });

  check('scaled size bound includes terminal LF and rejects one extra byte', () => {
    const cap = 96, bytes = Buffer.from('{"x":"' + 'a'.repeat(cap - 9) + '"}\n');
    assert.equal(bytes.length, cap);
    assert.equal(successful({ maxBytes: cap, maxRequestedReadBytes: cap + 1 }, fresh(), bytes).publication.byteLength, cap);
    failure(fresh(), 'BYTES', { maxBytes: cap }, Buffer.concat([bytes.subarray(0, -1), Buffer.from(' \n')]));
  });

  for (const [label, text] of [
    ['missing LF', '{"x":1}'], ['NUL', '{"x":"\0"}\n'], ['non-ASCII', '{"x":"é"}\n'],
    ['two values', '{} {}\n'], ['array', '[]\n'], ['null', 'null\n'], ['number', '42\n'], ['syntax', '{x:1}\n'],
    ...['selfDigest', 'publicationAccepted', 'publication', 'publicationRecord', 'readbackVerified',
      'directorySynced', 'fileMetadata', 'publicationCounts', 'postwriteCounts', 'postWriteCounts', 'sealedMetadata']
      .map(key => [key, JSON.stringify({ [key]: false }) + '\n']),
  ]) check(`reject JSON ${label} before writes`, () => {
    const { model } = failure(fresh(), 'JSON', undefined, Buffer.from(text));
    assert.equal(model.file().data.length, 0);
    assert.ok(model.calls.every(call => !['writeSync', 'fchmodSync'].includes(call.method)));
  });

  check('ASCII Unicode escapes, member digests, and nested fields survive unchanged', () => {
    const bytes = Buffer.from('{"sha256":"allowed","member":{"selfDigest":"ok","publicationAccepted":false},"text":"\\u00e9"}\n');
    const { model, publication } = successful(undefined, fresh(), bytes);
    assert.equal(publication.sha256, digest(bytes));
    assert.deepEqual(model.file().data, bytes);
  });

  for (const [label, factory] of [
    ['string', () => '{}\n'], ['object', () => ({ length: 3 })],
    ['proxy', () => new Proxy(DATA, { get() { throw error('getter-secret'); } })],
    ['shared', () => new Uint8Array(new SharedArrayBuffer(4))], ['uint16', () => new Uint16Array(4)],
    ['subclass', () => new (class extends Uint8Array {})(4)],
    ['accessor', () => Object.defineProperty(Buffer.from(DATA), 'length', { get() { throw error('getter-secret'); } })],
    ['detached', () => { const bytes = new Uint8Array(4); structuredClone(bytes.buffer, { transfer: [bytes.buffer] }); return bytes; }],
  ]) check(`reject hostile bytes ${label} before copy`, () => {
    const { capability, model } = failure(fresh(), 'BYTES', undefined, factory());
    assert.equal(capability.snapshot().counts.copiedBytes, 0);
    assert.equal(model.file().data.length, 0);
  });

  check('resizable backing rejects before copy when the runtime supports it', () => {
    if (!Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')) return;
    const { capability } = failure(fresh(), 'BYTES', undefined,
      new Uint8Array(new ArrayBuffer(8, { maxByteLength: 16 })));
    assert.equal(capability.snapshot().counts.copiedBytes, 0);
  });

  for (const [label, change, code] of [
    ['inode', value => { value.ino++; }, 'BINDING'], ['size', value => { value.size++; }, 'FILE'],
    ['hardlink', value => { value.nlink++; }, 'FILE'], ['mode', value => { value.mode = 0o100644n; }, 'FILE'],
    ['uid', value => { value.uid = 0n; }, 'FILE'], ['gid', value => { value.gid = 0n; }, 'FILE'],
  ]) check(`write-time ${label} tamper stops sealing`, () => {
    const model = fresh();
    model.hook = call => { if (call.method === 'writeSync' && call.when === 'after') change(model.file()); };
    const { capability } = failure(model, code);
    assert.equal(capability.snapshot().sealed, false);
    assert.equal(model.calls.some(call => call.method === 'fchmodSync'), false);
  });

  for (const [label, change] of [
    ['dev', value => { value.dev++; }], ['inode', value => { value.ino++; }], ['size', value => { value.size++; }],
    ['hardlink', value => { value.nlink++; }], ['mode', value => { value.mode = 0o100644n; }],
    ['uid', value => { value.uid = 0n; }], ['gid', value => { value.gid = 0n; }],
    ['mtime', value => { value.mtimeNs++; }], ['ctime', value => { value.ctimeNs++; }],
  ]) check(`read-time ${label} tamper fails sealed nine-field match`, () => {
    const model = fresh(); let changed = false;
    model.hook = call => {
      if (!changed && call.method === 'readSync' && call.when === 'after') { changed = true; change(model.file()); }
    };
    failure(model, 'BINDING');
  });

  check('named replacement after writing rejects FD/name binding', () => {
    const model = fresh();
    model.hook = call => {
      if (call.method === 'writeSync' && call.when === 'after') model.nodes.set(PATH, { ...model.file(), ino: 999n });
    };
    failure(model, 'BINDING');
  });

  check('wrong chmod result cannot qualify as sealed', () => {
    const model = fresh();
    model.hook = call => {
      if (call.method === 'fchmodSync' && call.when === 'after') model.file().mode = 0o100644n;
    };
    failure(model, 'FILE');
  });

  check('new file must bind empty full metadata before reserve returns', () => {
    const model = fresh();
    model.hook = call => {
      if (call.method === 'openSync' && call.when === 'after' && call.args[0] === PATH) model.file().size = 1n;
    };
    assert.throws(setup(undefined, model).reserve, hasCode('FILE'));
    assertClosedOnce(model);
  });

  check('creation-time named/FD timestamp mismatch rejects before input', () => {
    const model = fresh();
    model.hook = call => {
      if (call.method === 'lstatSync' && call.when === 'after' && call.args[0] === PATH) call.result.ctimeNs++;
    };
    assert.throws(setup(undefined, model).reserve, hasCode('BINDING'));
    assertClosedOnce(model);
  });

  check('readback digest mismatch never returns a record', () => {
    const model = fresh();
    model.hook = call => {
      if (call.method === 'readSync' && call.when === 'after' && call.result > 0) call.args[1][0] ^= 1;
    };
    failure(model, 'HASH');
  });

  check('trailing byte fails physical EOF even with unchanged metadata', () => {
    const model = fresh(); let changed = false;
    model.hook = call => {
      if (!changed && call.method === 'readSync' && call.when === 'before') {
        changed = true; model.file().data = Buffer.concat([model.file().data, Buffer.from('x')]);
      }
    };
    failure(model, 'EOF');
  });

  for (const target of ['directory', 'file']) check(`final ${target} mutation invalidates readback`, () => {
    const model = fresh(); let syncs = 0;
    model.hook = call => {
      if (call.method === 'fsyncSync' && call.when === 'after' && ++syncs === 4) {
        if (target === 'directory') model.nodes.get(DIR).nlink++;
        else model.file().mode = 0o100600n;
      }
    };
    failure(model, 'BINDING');
  });

  for (const which of [1, 2, 3, 4]) check(`fsync failure ${which} retains evidence without retry`, () => {
    const model = fresh(); let syncs = 0;
    model.hook = call => {
      if (call.method === 'fsyncSync' && call.when === 'before' && ++syncs === which) throw error('ENOTSUP');
    };
    const state = setup(undefined, model);
    if (which === 1) assert.throws(state.reserve, hasCode('IO'));
    else {
      const capability = state.reserve();
      assert.throws(() => capability.publish(DATA), hasCode('IO'));
      assert.equal(capability.snapshot().ownedFDCount, 0);
    }
    assert.equal(syncs, which);
    assert.equal(model.nodes.has(PATH), true);
    assertClosedOnce(model);
    assert.throws(state.reserve, hasCode('STATE'));
  });

  for (const which of [1, 2, 3]) check(`positive close failure ${which} clears ownership once`, () => {
    const model = fresh(); let closes = 0;
    model.hook = call => {
      if (call.method === 'closeSync' && call.when === 'before' && ++closes === which) throw error('close-secret');
    };
    const { capability } = failure(model, 'CLOSE');
    assert.equal(capability.snapshot().closeFailed, true);
    assert.equal(capability.snapshot().cleanupUncertain, true);
    const before = model.calls.length, cleanup = capability.abort(); capability.abort();
    assert.equal(cleanup.cleanupUncertain, true);
    assert.equal(model.calls.length, before);
  });

  check('expired original guard cannot prevent cleanup after a failed close', () => {
    const model = fresh(), capability = setup(undefined, model).reserve(); let closes = 0;
    model.guardHook = () => { throw error('outer-deadline-secret'); };
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

  check('post-open expired guard still closes the newly owned FD', () => {
    const model = fresh(); let expired = false;
    model.hook = call => {
      if (call.method === 'openSync' && call.when === 'after' && call.args[0] === PATH) expired = true;
    };
    model.guardHook = () => { if (expired) throw error('deadline-secret'); };
    assert.throws(setup(undefined, model).reserve, hasCode('GUARD'));
    assert.equal(model.calls.filter(call => call.method === 'closeSync').length, 2);
    assert.equal(model.file().data.length, 0);
    assertClosedOnce(model);
  });

  check('original guard remains authoritative across collection', () => {
    const model = fresh(); let expired = false;
    model.guardHook = () => { if (expired) throw error('total-deadline-secret'); };
    const capability = setup(undefined, model).reserve();
    expired = true;
    assert.throws(() => capability.publish(DATA), hasCode('GUARD'));
    assert.equal(model.file().data.length, 0);
    assertClosedOnce(model, capability);
  });

  check('late guard rejects valid-looking sealed bytes without acceptance or deletion', () => {
    const model = fresh(); let closes = 0;
    model.hook = call => { if (call.method === 'closeSync' && call.when === 'after') closes++; };
    model.guardHook = () => { if (closes === 3) throw error('late-clock-secret'); };
    const { capability } = failure(model, 'GUARD');
    assert.deepEqual(model.file().data, DATA);
    assert.equal(model.file().mode, 0o100444n);
    assert.equal(capability.snapshot().sealed, true);
    assert.equal(capability.snapshot().counts.ownedSnapshotBytes, 0);
  });

  check('abort after success preserves readback fact without controller acceptance', () => {
    const { model, capability, publication } = successful(), count = model.calls.length;
    assert.throws(() => capability.publish(DATA), hasCode('STATE'));
    const cleanup = capability.abort(); capability.abort();
    assert.equal(model.calls.length, count);
    assert.equal(capability.snapshot().phase, 'PUBLISHED_READBACK_MATCHED');
    assert.equal(Object.hasOwn(publication, 'publicationAccepted'), false);
    assert.equal(Object.hasOwn(cleanup, 'publicationAccepted'), false);
    assert.deepEqual(model.file().data, DATA);
  });

  check('pending abort is idempotent and prevents publish without deletion', () => {
    const { model, reserve } = setup(), capability = reserve();
    const first = capability.abort(), count = model.calls.length;
    assert.deepEqual(capability.abort(), first);
    assert.equal(model.calls.length, count);
    assert.throws(() => capability.publish(DATA), hasCode('STATE'));
    assert.equal(model.file().data.length, 0);
    assert.equal(capability.snapshot().error, 'E_PUBLICATION_ABORTED');
  });

  check('extra publish arguments fail pending file before writes', () => {
    const { model, reserve } = setup(), capability = reserve();
    assert.throws(() => capability.publish(DATA, {}), hasCode('ARGUMENT'));
    assert.equal(model.file().data.length, 0);
    assertClosedOnce(model, capability);
  });

  check('abort extra arguments reject without discarding pending ownership', () => {
    const { reserve } = setup(), capability = reserve();
    assert.throws(() => capability.abort({}), hasCode('ARGUMENT'));
    assert.equal(capability.snapshot().ownedFDCount, 2);
    capability.abort();
  });

  check('guards surround FS calls and all operation counters match the fake backend', () => {
    const model = fresh(); let last = 0;
    model.hook = call => {
      if (call.when === 'before') { assert.ok(model.guardCalls > last); last = model.guardCalls; }
      else assert.equal(model.guardCalls, last);
    };
    const { publication } = successful(undefined, model);
    assert.equal(publication.counts.fsOperations, model.calls.length);
    assert.equal(publication.counts.guardChecks, model.guardCalls);
    assert.ok(publication.counts.guardChecks >= 2 * model.calls.length);
    for (const [counter, method] of Object.entries({ opens: 'openSync', closeAttempts: 'closeSync',
      namedStats: 'lstatSync', fdStats: 'fstatSync', fsyncs: 'fsyncSync', chmods: 'fchmodSync',
      writeAttempts: 'writeSync', readAttempts: 'readSync' })) {
      assert.equal(publication.counts[counter], model.calls.filter(call => call.method === method).length);
    }
  });

  check('every FS failure boundary closes owned FDs once and never repairs', () => {
    const baseline = successful().model.calls;
    for (let boundary = 0; boundary < baseline.length; boundary++) {
      const model = fresh(); let ordinal = 0;
      model.hook = call => {
        if (call.when === 'before' && ordinal++ === boundary) throw error('EIO-secret');
      };
      const { reserve } = setup(undefined, model); let capability;
      assert.throws(() => { capability = reserve(); capability.publish(DATA); },
        hasCode(baseline[boundary].method === 'closeSync' ? 'CLOSE' : 'IO'), String(boundary));
      assertClosedOnce(model, capability);
      if (capability) {
        assert.equal(capability.snapshot().phase, 'FAILED');
        assert.equal(capability.snapshot().counts.ownedSnapshotBytes, 0);
        assert.equal(capability.snapshot().counts.ownedScratchBytes, 0);
        const count = model.calls.length; capability.abort(); capability.abort();
        assert.equal(model.calls.length, count);
      }
      assert.throws(reserve, hasCode('STATE'));
    }
  });

  check('every guard boundary blocks acceptance while permitting all cleanup closes', () => {
    const baseline = successful().publication.counts.guardChecks;
    for (let boundary = 1; boundary <= baseline; boundary++) {
      const model = fresh();
      model.guardHook = current => { if (current.guardCalls >= boundary) throw error('deadline-secret'); };
      const { reserve } = setup(undefined, model); let capability;
      assert.throws(() => { capability = reserve(); capability.publish(DATA); }, hasCode('GUARD'), String(boundary));
      assertClosedOnce(model, capability);
      assert.equal(model.fds.size, 0);
      assert.ok(model.writeBuffers.every(bytes => bytes.every(byte => byte === 0)));
      assert.ok(model.readBuffers.every(bytes => bytes.every(byte => byte === 0)));
      if (capability) assert.equal(capability.snapshot().phase, 'FAILED');
    }
  });

  check('all lower filesystem budgets reserve cleanup capacity', () => {
    const needed = successful().publication.counts.fsOperations;
    for (let maxFsOperations = 1; maxFsOperations <= needed; maxFsOperations++) {
      const model = fresh(), { reserve } = setup({ maxFsOperations }, model); let capability;
      try { capability = reserve(); capability.publish(DATA); }
      catch (cause) { assert.equal(cause.code, 'E_PUBLICATION_LIMIT'); }
      assert.ok(model.calls.length <= maxFsOperations, String(maxFsOperations));
      assertClosedOnce(model, capability);
      assert.equal(model.fds.size, 0);
    }
  });

  check('partial write error retains exact prefix and never reopens for repair', () => {
    const model = fresh(); let writes = 0; model.writeCap = 5;
    model.hook = call => {
      if (call.method === 'writeSync' && call.when === 'before' && ++writes === 3) throw error('EIO');
    };
    const { capability } = failure(model, 'IO');
    assert.deepEqual(model.file().data, DATA.subarray(0, 10));
    assert.equal(model.file().mode, 0o100600n);
    assert.ok(model.writeBuffers.every(bytes => bytes.every(byte => byte === 0)));
    const count = model.calls.length; capability.abort();
    assert.equal(model.calls.length, count);
  });

  check('replacement before read-open fails sealed identity check', () => {
    const model = fresh();
    model.hook = call => {
      if (call.method === 'openSync' && call.when === 'before' && call.args[0] === PATH &&
        (call.args[1] & fs.constants.O_CREAT) === 0) model.nodes.set(PATH, { ...model.file(), ino: model.file().ino + 1n });
    };
    failure(model, 'BINDING');
  });

  for (const [label, change, expected] of [
    ['symlink', value => { value.mode = 0o120777n; }, 'FILE'], ['hardlink', value => { value.nlink++; }, 'FILE'],
    ['owner', value => { value.uid = 0n; }, 'FILE'], ['inode', value => { value.ino++; }, 'BINDING'],
  ]) check(`seal-time ${label} tamper stops readback`, () => {
    const model = fresh();
    model.hook = call => { if (call.method === 'fchmodSync' && call.when === 'after') change(model.file()); };
    failure(model, expected);
    assert.ok(model.calls.every(call => call.method !== 'readSync'));
  });
}

for (const [label, options] of [
  ['no marker', {}], ['false marker', { mockOnly: false }], ['path override', { mockOnly: true, path: PATHS.gnu }],
  ['root override', { mockOnly: true, root: ROOT }], ['URL override', { mockOnly: true, path: new URL('file://' + PATHS.gnu) }],
  ['increased bound', { mockOnly: true, limits: { maxBytes: LIMITS.maxBytes + 1 } }],
  ['zero bound', { mockOnly: true, limits: { chunkBytes: 0 } }],
  ['fractional bound', { mockOnly: true, limits: { maxReadAttempts: 1.5 } }],
  ['unknown bound', { mockOnly: true, limits: { maxDurationMs: 1 } }],
  ['accessor options', Object.defineProperty({}, 'mockOnly', { get() { throw error('getter-secret'); } })],
  ['proxy options', new Proxy({}, { ownKeys() { throw error('proxy-secret'); } })],
  ['proxy limits', { mockOnly: true, limits: new Proxy({}, {}) }],
]) test(`fixture rejects ${label} before filesystem`, () => {
  const model = memory();
  assert.throws(() => createSplitEvidencePublicationFixture(options, { fs: model.fs, guard: model.guard }), hasCode('FIXTURE'));
  assert.equal(model.calls.length, 0);
});

for (const label of ['real fs', 'proxy fs', 'missing method', 'real method', 'accessor method', 'proxy method',
  'proxy guard', 'accessor dependency', 'proxy dependency']) test(`fixture rejects ${label} TCB`, () => {
  const model = memory(); let deps = { fs: model.fs, guard: model.guard };
  if (label === 'real fs') deps.fs = fs;
  if (label === 'proxy fs') deps.fs = new Proxy(model.fs, {});
  if (label === 'missing method') delete model.fs.readSync;
  if (label === 'real method') model.fs.readSync = fs.readSync;
  if (label === 'accessor method') Object.defineProperty(model.fs, 'readSync', { get() { throw error('getter-secret'); } });
  if (label === 'proxy method') model.fs.readSync = new Proxy(model.fs.readSync, {});
  if (label === 'proxy guard') deps.guard = new Proxy(model.guard, {});
  if (label === 'accessor dependency') Object.defineProperty(deps, 'guard', { get() { throw error('getter-secret'); } });
  if (label === 'proxy dependency') deps = new Proxy(deps, {});
  assert.throws(() => createSplitEvidencePublicationFixture({ mockOnly: true }, deps), hasCode('FIXTURE'));
  assert.equal(model.calls.length, 0);
});

test('fixture arity checks precede backend use', () => {
  const model = memory(), options = { mockOnly: true }, deps = { fs: model.fs, guard: model.guard };
  for (const args of [[], [options], [options, deps, {}]]) {
    assert.throws(() => createSplitEvidencePublicationFixture(...args), hasCode('FIXTURE'));
  }
  assert.equal(model.calls.length, 0);
});

test('captured fake methods cannot switch to a later replacement for either part', () => {
  const model = memory(), fixture = fixtureFor(model);
  model.fs.openSync = () => { throw error('replacement-secret'); };
  for (const part of PARTS) assert.equal(fixture.reserveSplitEvidencePublication(part).publish(DATA).readbackVerified, true);
});

test('metadata accessors and proxies reject without invoking them', () => {
  for (const part of PARTS) for (const proxy of [false, true]) {
    const model = memory(part);
    model.hook = call => {
      if (call.method === 'lstatSync' && call.when === 'after') {
        if (proxy) call.result = new Proxy(call.result, {});
        else Object.defineProperty(call.result, 'uid', { get() { throw error('metadata-secret'); } });
      }
    };
    assert.throws(() => fixtureFor(model).reserveSplitEvidencePublication(part), hasCode('METADATA'));
    assert.equal(model.nodes.has(PATHS[part]), false);
  }
});

test('failed GNU publishing leaves pending Rust counts and metadata untouched', () => {
  const model = memory(), fixture = fixtureFor(model);
  const gnu = fixture.reserveSplitEvidencePublication('gnu'), rust = fixture.reserveSplitEvidencePublication('rust');
  const rustBefore = rust.snapshot(), rustNode = { ...model.file('rust') };
  model.hook = call => {
    if (call.method === 'writeSync' && call.when === 'before' && model.fds.get(call.args[0]).path === PATHS.gnu) throw error('EIO');
  };
  assert.throws(() => gnu.publish(DATA), hasCode('IO'));
  assert.deepEqual(rust.snapshot(), rustBefore);
  assert.deepEqual(model.file('rust'), rustNode);
  assert.equal(rust.publish(DATA).part, 'rust');
  assertClosedOnce(model);
});

for (const part of PARTS) test(`${part}: cross-part read-open substitution rejects even identical bytes`, () => {
  const other = part === 'gnu' ? 'rust' : 'gnu', model = memory(), fixture = fixtureFor(model);
  const capabilities = Object.fromEntries(PARTS.map(key => [key, fixture.reserveSplitEvidencePublication(key)]));
  capabilities[other].publish(DATA);
  model.hook = call => {
    if (call.method === 'openSync' && call.when === 'after' && call.args[0] === PATHS[part] &&
      (call.args[1] & fs.constants.O_CREAT) === 0) model.fds.get(call.result).node = model.file(other);
  };
  assert.throws(() => capabilities[part].publish(DATA), hasCode('BINDING'));
  assert.equal(capabilities[part].snapshot().phase, 'FAILED');
  assert.deepEqual(model.file(other).data, DATA);
  assertClosedOnce(model);
});

for (const part of PARTS) test(`${part}: cross-part named-path substitution rejects`, () => {
  const other = part === 'gnu' ? 'rust' : 'gnu', model = memory(), fixture = fixtureFor(model);
  const capabilities = Object.fromEntries(PARTS.map(key => [key, fixture.reserveSplitEvidencePublication(key)]));
  capabilities[other].publish(DATA);
  model.hook = call => {
    if (call.method === 'writeSync' && call.when === 'after') model.nodes.set(PATHS[part], model.file(other));
  };
  assert.throws(() => capabilities[part].publish(DATA), hasCode('BINDING'));
  assertClosedOnce(model);
});
