// SPEC: _spec/tooling/native-ingress/step2.puml
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const originalLstat = fs.lstatSync;
let physicalAttempts = 0;
function physicalGuard() {
  physicalAttempts++;
  assert.fail('physical metadata observations are forbidden in this suite');
}
fs.lstatSync = physicalGuard;
after(() => {
  fs.lstatSync = originalLstat;
  assert.equal(physicalAttempts, 0);
});

const moduleUrl = new URL('./preparation-helper-metadata.mjs', import.meta.url);
const source = fs.readFileSync(moduleUrl, 'utf8');
const api = await import(moduleUrl.href);
const { PREPARATION_HELPER_METADATA_V1_POLICY: POLICY,
  observeRegisteredPreparationHelpersV1, createPreparationHelperMetadataFixture } = api;
const instrumented = await import('data:text/javascript;base64,' + Buffer.from(source +
  '\nexport const TEST_ONLY = Object.freeze({ serializeBounded, LSTAT, NOW, ORIGINAL_LSTAT, ORIGINAL_NOW });\n').toString('base64'));
const privateApi = instrumented.TEST_ONLY;
const PATHS = ['/usr/local/bin/node', '/usr/bin/docker'];
const FIELDS = ['dev', 'ino', 'mode', 'nlink', 'uid', 'gid', 'size', 'mtimeNs', 'ctimeNs'];
const FALSE_FLAGS = ['installed', 'usability', 'helperQualified', 'providerQualified',
  'runtimeProvidersQualified', 'sourceAuthenticated', 'publisherAuthenticated', 'abiVerified',
  'pythonFreeSubsetVerified', 'noPythonRuntimeVerified', 'imagePrepared', 'dockerProviderQualified',
  'nativeQualified', 'nativeAuthority', 'rustReady', 'trainingReady', 'hardDeadlineGuaranteed',
  'hardRssBounded', 'ancestorRacesExcluded', 'atomicSnapshotVerified', 'ioIsolated'];
const ZERO_COUNTERS = ['fdAcquisitions', 'opens', 'reads', 'contentBytes', 'hashBytes', 'execs', 'daemonCalls'];
const CODES = ['E_ARGUMENTS', 'E_CONSUMED', 'E_IO', 'E_METADATA', 'E_TYPE', 'E_CHANGED',
  'E_CLOCK', 'E_DEADLINE', 'E_OUTPUT'];
const U64 = (1n << 64n) - 1n;
const I64_MIN = -(1n << 63n);
const I64_MAX = (1n << 63n) - 1n;
const asciiJson = value => JSON.stringify(value).replace(/[\u007f-\uffff]/g,
  unit => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
const sha = value => createHash('sha256').update(value).digest('hex');

function metadata(overrides = {}) {
  return { dev: 10n, ino: 20n, mode: 0o100777n, nlink: 3n, uid: 1000n,
    gid: 1001n, size: 100n, mtimeNs: -1n, ctimeNs: 2n, ...overrides };
}

function missing() {
  return Object.assign(new Error('SECRET ignored error text'), { code: 'ENOENT' });
}

function fixture(options = {}) {
  const state = { calls: [], clockReads: 0, time: 0 };
  const deps = {
    lstatSync(path, opts) {
      assert.equal(arguments.length, 2);
      assert.equal(PATHS.includes(path), true);
      assert.deepEqual(opts, { bigint: true });
      assert.equal(Object.getPrototypeOf(opts), Object.prototype);
      const index = state.calls.length;
      state.calls.push({ path, opts });
      return options.lstat ? options.lstat(index, state, path) : metadata({ ino: BigInt(20 + index % 2) });
    },
    now() {
      assert.equal(arguments.length, 0);
      state.clockReads++;
      return options.now ? options.now(state) : state.time;
    },
  };
  const fixtureApi = createPreparationHelperMetadataFixture({ mockOnly: true }, deps);
  return { state, deps, api: fixtureApi,
    run: (...args) => fixtureApi.observeRegisteredPreparationHelpersV1(...args) };
}

function deepFrozen(value) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) deepFrozen(child);
}

function common(result, mockOnly = true) {
  assert.deepEqual(Object.keys(result), ['exitCode', 'data']);
  assert.equal(result.data.profile, POLICY.profile);
  assert.equal(result.data.mockOnly, mockOnly);
  for (const flag of FALSE_FLAGS) assert.equal(result.data[flag], false, flag);
  for (const counter of ZERO_COUNTERS) assert.equal(result.data.counters[counter], 0, counter);
  for (const count of Object.values(result.data.counters)) {
    assert.equal(Number.isSafeInteger(count) && count >= 0, true);
  }
  assert.ok(result.data.counters.metadataCallAttempts <= 4);
  assert.ok(result.data.counters.metadataCallCompletions <= result.data.counters.metadataCallAttempts);
  const text = asciiJson(result);
  assert.match(text, /^[\x00-\x7f]*\n$/);
  assert.ok(Buffer.byteLength(text, 'utf8') <= 8192);
  deepFrozen(result);
}

function observed(result) {
  common(result);
  assert.equal(result.exitCode, 0);
  assert.equal(result.data.status, 'PREPARATION_HELPER_METADATA');
  assert.equal(Object.hasOwn(result.data, 'error'), false);
  assert.equal(result.data.entries.length, 2);
  assert.deepEqual(result.data.entries.map(entry => entry.path), PATHS);
  for (const entry of result.data.entries) {
    assert.equal(entry.stableObserved, true);
    assert.ok(['REGULAR', 'SYMLINK', 'MISSING'].includes(entry.kind));
    if (entry.kind === 'MISSING') assert.equal(entry.metadata, null);
    else {
      assert.deepEqual(Object.keys(entry.metadata), FIELDS);
      for (const value of Object.values(entry.metadata)) assert.match(value, /^-?(0|[1-9][0-9]*)$/);
    }
  }
}

function stopped(result, code, mockOnly = true) {
  common(result, mockOnly);
  assert.equal(result.exitCode, 1);
  assert.equal(result.data.status, 'STOP');
  assert.equal(result.data.error, code);
  assert.ok(CODES.includes(result.data.error));
  assert.deepEqual(Object.keys(result.data), ['profile', 'status', 'mockOnly', 'error', 'counters', ...FALSE_FLAGS]);
  const text = asciiJson(result);
  assert.doesNotMatch(text, /SECRET|stableObserved|metadata"|entries"/);
  for (const path of PATHS) assert.equal(text.includes(path), false);
}

test('production exports only the fixed policy and two entrypoints', () => {
  assert.deepEqual(Object.keys(api).sort(), ['PREPARATION_HELPER_METADATA_V1_POLICY',
    'createPreparationHelperMetadataFixture', 'observeRegisteredPreparationHelpersV1'].sort());
  assert.equal(observeRegisteredPreparationHelpersV1.length, 0);
  assert.equal(createPreparationHelperMetadataFixture.length, 2);
});

test('policy fixes paths, observation limits, and non-execution semantics', () => {
  assert.equal(POLICY.profile, 'registered-preparation-helper-metadata-v1');
  assert.deepEqual(POLICY.paths, PATHS);
  assert.equal(POLICY.maxLstats, 4);
  assert.equal(POLICY.workMs, 3500);
  assert.equal(POLICY.outerMs, 5000);
  assert.equal(POLICY.outputBytes, 8192);
  assert.equal(POLICY.outputDepth, 64);
  assert.equal(POLICY.outputNodes, 10000);
  assert.equal(POLICY.observationsOnly, true);
  assert.equal(POLICY.executionGranted, false);
  assert.equal(POLICY.metadataCallCompletion, 'normal-return-only');
  assert.equal(POLICY.stableObservedMeaning, 'equal-pre-post-fields-not-uninterrupted-identity');
  deepFrozen(POLICY);
  assert.throws(() => { POLICY.paths[0] = '/SECRET'; }, TypeError);
});

test('source restricts physical APIs and imports without module-load observation', () => {
  assert.equal(source.split('\n')[0], '// SPEC: _spec/tooling/native-ingress/step2.puml');
  assert.deepEqual([...source.matchAll(/^import .* from '([^']+)';$/gm)].map(match => match[1]),
    ['node:fs', 'node:util']);
  assert.deepEqual([...source.matchAll(/\bfs\.(\w+)/g)].map(match => match[1]), ['lstatSync']);
  assert.doesNotMatch(source, /\b(?:statSync|fstatSync|readlinkSync|realpathSync|openSync|readSync|readFileSync|readdirSync|opendirSync|writeFileSync|unlinkSync|createHash|fetch|execSync|spawnSync|require)\b/);
  assert.equal(physicalAttempts, 0);
});

test('real production invalid arguments consume the latch without metadata access', () => {
  stopped(observeRegisteredPreparationHelpersV1({ path: '/SECRET' }), 'E_ARGUMENTS', false);
  stopped(observeRegisteredPreparationHelpersV1(undefined), 'E_CONSUMED', false);
  assert.equal(physicalAttempts, 0);
});

test('pre-both then post-both uses four exact bigint lstat calls', () => {
  const f = fixture();
  const result = f.run();
  observed(result);
  assert.deepEqual(f.state.calls.map(call => call.path), [...PATHS, ...PATHS]);
  assert.equal(new Set(f.state.calls.map(call => call.opts)).size, 4);
  assert.equal(result.data.counters.metadataCallAttempts, 4);
  assert.equal(result.data.counters.metadataCallCompletions, 4);
  assert.deepEqual(result.data.entries.map(entry => entry.kind), ['REGULAR', 'REGULAR']);
});

test('each object snapshots all nine fields independently even with shared mutable fake objects', () => {
  const shared = metadata();
  const rows = [metadata(), metadata({ dev: 88n, ino: 99n, mode: 0o120777n,
    nlink: 0n, uid: 77n, gid: 66n, size: 44n, mtimeNs: -33n, ctimeNs: 22n })];
  const result = fixture({ lstat(index) { return Object.assign(shared, rows[index % 2]); } }).run();
  observed(result);
  rows.forEach((row, index) => assert.deepEqual(result.data.entries[index].metadata,
    Object.fromEntries(FIELDS.map(key => [key, String(row[key])]))));
  assert.notEqual(result.data.entries[0].metadata, result.data.entries[1].metadata);
  shared.ino = 1000n;
  assert.equal(result.data.entries[1].metadata.ino, '99');
});

test('different path devices and ownership IDs do not impose root matching or qualification', () => {
  const result = fixture({ lstat(index) {
    return metadata({ dev: index % 2 === 0 ? 0n : U64, uid: U64, gid: 55n, nlink: 0n });
  } }).run();
  observed(result);
  assert.deepEqual(result.data.entries.map(entry => entry.metadata.dev), ['0', String(U64)]);
  assert.equal(result.data.entries[0].metadata.mode, String(0o100777n));
});

test('opaque symlink metadata does not inspect targets or stat classification methods', () => {
  const row = metadata({ mode: 0o120777n });
  for (const key of ['target', 'isSymbolicLink', 'isFile']) Object.defineProperty(row, key,
    { get() { assert.fail('opaque metadata accessor'); } });
  const result = fixture({ lstat: () => row }).run();
  observed(result);
  assert.deepEqual(result.data.entries.map(entry => entry.kind), ['SYMLINK', 'SYMLINK']);
});

test('Stats-like own-data instances remain accepted without calling methods', () => {
  class FakeStats {
    constructor() { Object.assign(this, metadata()); }
    isFile() { assert.fail('method must remain unused'); }
  }
  observed(fixture({ lstat: () => new FakeStats() }).run());
});

test('exact own-data ENOENT yields stable absence with no claimed completions', () => {
  const result = fixture({ lstat() { throw missing(); } }).run();
  observed(result);
  assert.deepEqual(result.data.entries.map(entry => entry.kind), ['MISSING', 'MISSING']);
  assert.equal(result.data.counters.metadataCallAttempts, 4);
  assert.equal(result.data.counters.metadataCallCompletions, 0);
});

test('missing and existing paths remain independent', () => {
  const result = fixture({ lstat(index) { if (index % 2 === 0) throw { code: 'ENOENT' }; return metadata(); } }).run();
  observed(result);
  assert.deepEqual(result.data.entries.map(entry => entry.kind), ['MISSING', 'REGULAR']);
  assert.equal(result.data.counters.metadataCallCompletions, 2);
});

for (const key of FIELDS) {
  test(`pre/post change in ${key} withholds every provisional entry`, () => {
    const f = fixture({ lstat(index) { return metadata(index === 2 ? { [key]: metadata()[key] + 1n } : {}); } });
    const result = f.run();
    stopped(result, 'E_CHANGED');
    assert.equal(f.state.calls.length, 4);
  });

  test(`${key} requires a bigint own-data field`, () => {
    const result = fixture({ lstat: () => metadata({ [key]: 'SECRET' }) }).run();
    stopped(result, 'E_METADATA');
    assert.equal(result.data.counters.metadataCallAttempts, 1);
    assert.equal(result.data.counters.metadataCallCompletions, 1);
  });

  test(`${key} accessors never execute`, () => {
    const row = metadata();
    let getterCalls = 0;
    Object.defineProperty(row, key, { get() { getterCalls++; throw new Error('SECRET'); } });
    stopped(fixture({ lstat: () => row }).run(), 'E_METADATA');
    assert.equal(getterCalls, 0);
  });

  test(`missing own ${key} never falls back to inherited metadata`, () => {
    const row = Object.assign(Object.create({ [key]: metadata()[key] }), metadata());
    delete row[key];
    stopped(fixture({ lstat: () => row }).run(), 'E_METADATA');
  });
}

for (const key of FIELDS.filter(key => !['mtimeNs', 'ctimeNs'].includes(key))) {
  for (const value of [-1n, U64 + 1n]) {
    test(`${key} rejects unsigned-64 overflow ${value < 0n ? 'below' : 'above'} range`, () => {
      stopped(fixture({ lstat: () => metadata({ [key]: value }) }).run(), 'E_METADATA');
    });
  }
}

for (const key of ['mtimeNs', 'ctimeNs']) {
  for (const value of [I64_MIN - 1n, I64_MAX + 1n]) {
    test(`${key} rejects signed-64 overflow ${value < 0n ? 'below' : 'above'} range`, () => {
      stopped(fixture({ lstat: () => metadata({ [key]: value }) }).run(), 'E_METADATA');
    });
  }
}

test('bigint boundary values become decimal strings without native JSON bigint encoding', () => {
  const row = Object.fromEntries(FIELDS.map(key => [key, U64]));
  row.mode = (U64 & ~0o170000n) | 0o100000n;
  row.mtimeNs = I64_MIN;
  row.ctimeNs = I64_MAX;
  const result = fixture({ lstat: () => row }).run();
  observed(result);
  assert.equal(result.data.entries[0].metadata.size, '18446744073709551615');
  assert.equal(result.data.entries[0].metadata.mtimeNs, '-9223372036854775808');
  assert.equal(result.data.entries[0].metadata.ctimeNs, '9223372036854775807');
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('zero inode stops existing metadata', () => {
  stopped(fixture({ lstat: () => metadata({ ino: 0n }) }).run(), 'E_METADATA');
});

test('every field rejects non-bigint primitives and objects without coercion', () => {
  let coercions = 0;
  const object = { valueOf() { coercions++; return 1n; }, toString() { coercions++; return '1'; } };
  for (const key of FIELDS) {
    for (const value of [0, null, undefined, false, object, Object(1n), Symbol('SECRET')]) {
      stopped(fixture({ lstat: () => metadata({ [key]: value }) }).run(), 'E_METADATA');
    }
  }
  assert.equal(coercions, 0);
});

for (const mode of [0n, 0o040755n, 0o010600n, 0o020600n, 0o060600n, 0o140600n]) {
  test(`unsupported type ${mode.toString(8)} stops without partial metadata`, () => {
    stopped(fixture({ lstat: () => metadata({ mode }) }).run(), 'E_TYPE');
  });
}

for (const value of [null, undefined, false, 1, 1n, 'SECRET']) {
  test(`non-object metadata ${typeof value}:${String(value)} stops safely`, () => {
    stopped(fixture({ lstat: () => value }).run(), 'E_METADATA');
  });
}

test('proxy and revoked proxy metadata trigger no traps', () => {
  let traps = 0;
  const proxy = new Proxy(metadata(), { getOwnPropertyDescriptor() { traps++; throw new Error('SECRET'); } });
  const revoked = Proxy.revocable(metadata(), {});
  revoked.revoke();
  for (const row of [proxy, revoked.proxy]) stopped(fixture({ lstat: () => row }).run(), 'E_METADATA');
  assert.equal(traps, 0);
});

for (const [before, after] of [['REGULAR', 'SYMLINK'], ['SYMLINK', 'REGULAR'],
  ['MISSING', 'REGULAR'], ['REGULAR', 'MISSING'], ['MISSING', 'SYMLINK'], ['SYMLINK', 'MISSING']]) {
  test(`${before} to ${after} transition withholds both entries`, () => {
    const result = fixture({ lstat(index) {
      const kind = index < 2 ? before : after;
      if (kind === 'MISSING') throw missing();
      return metadata({ mode: kind === 'SYMLINK' ? 0o120777n : 0o100777n });
    } }).run();
    stopped(result, 'E_CHANGED');
    assert.equal(result.data.counters.metadataCallAttempts, 4);
  });
}

for (const code of ['EACCES', 'ELOOP', 'ENOTDIR', 'enoent', 'ENOENT ', 2, null, undefined]) {
  test(`only exact ENOENT maps missing, not ${String(code)}`, () => {
    const result = fixture({ lstat() { throw { code, message: 'SECRET' }; } }).run();
    stopped(result, 'E_IO');
    assert.equal(result.data.counters.metadataCallCompletions, 0);
  });
}

test('thrown error getters and inherited code stay opaque', () => {
  let getterCalls = 0;
  const getter = { get code() { getterCalls++; throw new Error('SECRET'); },
    get message() { getterCalls++; throw new Error('SECRET'); } };
  const inherited = Object.create({ get code() { getterCalls++; return 'ENOENT'; } });
  for (const error of [getter, inherited]) stopped(fixture({ lstat() { throw error; } }).run(), 'E_IO');
  assert.equal(getterCalls, 0);
});

test('safe ENOENT does not inspect error messages or other properties', () => {
  let getterCalls = 0;
  const error = { code: 'ENOENT', get message() { getterCalls++; throw new Error('SECRET'); } };
  observed(fixture({ lstat() { throw error; } }).run());
  assert.equal(getterCalls, 0);
});

test('thrown proxy errors and primitive exceptions use only fixed E_IO', () => {
  let traps = 0;
  const proxy = new Proxy({ code: 'ENOENT' }, { getOwnPropertyDescriptor() { traps++; throw new Error('SECRET'); } });
  for (const error of [proxy, null, undefined, 'SECRET', 1, Symbol('SECRET'), { code: 'E_DEADLINE' }]) {
    stopped(fixture({ lstat() { throw error; } }).run(), 'E_IO');
  }
  assert.equal(traps, 0);
});

test('late second-path failures discard already captured first-path data', () => {
  const result = fixture({ lstat(index) { if (index === 3) throw { code: 'EACCES' }; return metadata(); } }).run();
  stopped(result, 'E_IO');
  assert.equal(result.data.counters.metadataCallAttempts, 4);
  assert.equal(result.data.counters.metadataCallCompletions, 3);
});

test('fixture invalid arguments consume before clock or metadata work', () => {
  const f = fixture();
  stopped(f.run(undefined), 'E_ARGUMENTS');
  stopped(f.run(), 'E_CONSUMED');
  assert.equal(f.state.calls.length, 0);
  assert.equal(f.state.clockReads, 0);
});

test('success consumes each independent fixture latch without cumulative counters', () => {
  const first = fixture(), second = fixture();
  const success = first.run();
  observed(success);
  const reused = first.run();
  stopped(reused, 'E_CONSUMED');
  assert.equal(reused.data.counters.metadataCallAttempts, 0);
  assert.notEqual(reused.data.counters, success.data.counters);
  observed(second.run());
  assert.equal(first.state.calls.length, 4);
  assert.equal(second.state.calls.length, 4);
});

test('failure consumes the latch and cannot retry observation', () => {
  const f = fixture({ lstat() { throw new Error('SECRET'); } });
  stopped(f.run(), 'E_IO');
  stopped(f.run('SECRET'), 'E_CONSUMED');
  assert.equal(f.state.calls.length, 1);
});

test('reentrant fixture calls see the consumed latch before dependency work', () => {
  let f, nested;
  f = fixture({ lstat() { nested = f.run(); return metadata(); } });
  observed(f.run());
  stopped(nested, 'E_CONSUMED');
  assert.equal(f.state.calls.length, 4);
});

test('factory requires exactly two arguments and complete fake capabilities', () => {
  const good = { lstatSync: () => metadata(), now: () => 0 };
  for (const args of [[], [{ mockOnly: true }], [{ mockOnly: true }, good, 'SECRET']]) {
    assert.throws(() => createPreparationHelperMetadataFixture(...args), /E_MOCK_TCB/);
  }
  for (const caps of [{}, { lstatSync: good.lstatSync }, { now: good.now },
    { ...good, extra: true }, { ...good, lstatSync: undefined }, { ...good, now: 0 },
    Object.create(good), null, [], { ...good, [Symbol('SECRET')]: 1 }]) {
    assert.throws(() => createPreparationHelperMetadataFixture({ mockOnly: true }, caps), /E_MOCK_TCB/);
  }
  assert.equal(physicalAttempts, 0);
});

for (const config of [null, {}, { mockOnly: false }, { mockOnly: 1 }, { mockOnly: true, paths: PATHS },
  { mockOnly: true, profile: POLICY.profile }, Object.create({ mockOnly: true }), []]) {
  test(`fixture rejects non-exact configuration ${config === null ? 'null' : Object.keys(config).join(',')}`, () => {
    assert.throws(() => createPreparationHelperMetadataFixture(config,
      { lstatSync: () => metadata(), now: () => 0 }), /E_MOCK_TCB/);
  });
}

test('null-prototype own-data fixture configurations remain valid', () => {
  const config = Object.assign(Object.create(null), { mockOnly: true });
  const deps = Object.assign(Object.create(null), { lstatSync: () => metadata(), now: () => 0 });
  observed(createPreparationHelperMetadataFixture(config, deps).observeRegisteredPreparationHelpersV1());
});

test('factory rejects configuration and capability getters without invoking them', () => {
  let calls = 0;
  const good = { lstatSync: () => metadata(), now: () => 0 };
  const config = { get mockOnly() { calls++; return true; } };
  assert.throws(() => createPreparationHelperMetadataFixture(config, good), /E_MOCK_TCB/);
  for (const key of ['lstatSync', 'now']) {
    const caps = { ...good };
    Object.defineProperty(caps, key, { get() { calls++; throw new Error('SECRET'); } });
    assert.throws(() => createPreparationHelperMetadataFixture({ mockOnly: true }, caps), /E_MOCK_TCB/);
  }
  assert.equal(calls, 0);
});

test('factory rejects proxy configs, capability objects, and callable proxies without traps', () => {
  let traps = 0;
  const handler = { getPrototypeOf() { traps++; throw new Error('SECRET'); },
    apply() { traps++; throw new Error('SECRET'); } };
  const good = { lstatSync: () => metadata(), now: () => 0 };
  assert.throws(() => createPreparationHelperMetadataFixture(new Proxy({ mockOnly: true }, handler), good), /E_MOCK_TCB/);
  assert.throws(() => createPreparationHelperMetadataFixture({ mockOnly: true }, new Proxy(good, handler)), /E_MOCK_TCB/);
  for (const key of ['lstatSync', 'now']) assert.throws(() => createPreparationHelperMetadataFixture(
    { mockOnly: true }, { ...good, [key]: new Proxy(good[key], handler) }), /E_MOCK_TCB/);
  assert.equal(traps, 0);
});

test('fixture rejects original and captured global lstat and clock functions in either slot', () => {
  for (const method of [fs.lstatSync, performance.now, privateApi.ORIGINAL_LSTAT,
    privateApi.LSTAT, privateApi.ORIGINAL_NOW, privateApi.NOW]) {
    for (const key of ['lstatSync', 'now']) assert.throws(() => instrumented.createPreparationHelperMetadataFixture(
      { mockOnly: true }, { lstatSync: () => metadata(), now: () => 0, [key]: method }), /E_MOCK_TCB/);
  }
  assert.equal(physicalAttempts, 0);
});

test('fixture capabilities snapshot own data without retaining caller dictionaries', () => {
  const f = fixture();
  f.deps.lstatSync = physicalGuard;
  f.deps.now = () => { throw new Error('SECRET'); };
  observed(f.run());
  assert.equal(physicalAttempts, 0);
  assert.equal(Object.isFrozen(f.api), true);
});

for (const value of [NaN, Infinity, -Infinity, -1, Number.MAX_SAFE_INTEGER + 1,
  Number.MAX_SAFE_INTEGER - 3499, '0', null, 0n]) {
  test(`invalid initial clock ${typeof value}:${String(value)} stops before metadata`, () => {
    const f = fixture({ now: () => value });
    stopped(f.run(), 'E_CLOCK');
    assert.equal(f.state.calls.length, 0);
  });
}

test('safe-horizon clock boundary remains valid with a constant clock', () => {
  observed(fixture({ now: () => Number.MAX_SAFE_INTEGER - 3500 }).run());
});

test('fractional monotone clocks remain valid', () => {
  observed(fixture({ now: state => state.clockReads / 1000 }).run());
});

test('backwards clock stops before the first metadata call', () => {
  const f = fixture({ now: state => state.clockReads === 1 ? 100 : 99 });
  stopped(f.run(), 'E_CLOCK');
  assert.equal(f.state.calls.length, 0);
});

test('clock exceptions use fixed diagnostics and consume the latch', () => {
  const f = fixture({ now() { throw { get message() { assert.fail('exception getter'); } }; } });
  stopped(f.run(), 'E_CLOCK');
  stopped(f.run(), 'E_CONSUMED');
  assert.equal(f.state.calls.length, 0);
});

test('3500ms strict boundary stops before the first metadata call', () => {
  const f = fixture({ now: state => state.clockReads === 1 ? 0 : 3500 });
  stopped(f.run(), 'E_DEADLINE');
  assert.equal(f.state.calls.length, 0);
});

test('post-call guard charges call time and withholds normal-return metadata at 3500ms', () => {
  const f = fixture({ lstat(index, state) { state.time = 3500; return metadata(); } });
  const result = f.run();
  stopped(result, 'E_DEADLINE');
  assert.equal(result.data.counters.metadataCallAttempts, 1);
  assert.equal(result.data.counters.metadataCallCompletions, 1);
});

test('post-call guard also charges throwing ENOENT call time', () => {
  const result = fixture({ lstat(index, state) { state.time = 3500; throw missing(); } }).run();
  stopped(result, 'E_DEADLINE');
  assert.equal(result.data.counters.metadataCallAttempts, 1);
  assert.equal(result.data.counters.metadataCallCompletions, 0);
});

test('work starts once before the first metadata call rather than resetting per call', () => {
  const f = fixture({ lstat(index, state) { state.time += 1000; return metadata(); } });
  stopped(f.run(), 'E_DEADLINE');
  assert.equal(f.state.calls.length, 4);
});

test('3499ms remains below the cooperative boundary without claiming a hard deadline', () => {
  const result = fixture({ lstat(index, state) { state.time = 3499; return metadata(); } }).run();
  observed(result);
  assert.equal(result.data.hardDeadlineGuaranteed, false);
});

for (const value of [NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1]) {
  test(`post-call invalid clock ${String(value)} withholds metadata`, () => {
    const result = fixture({ now: state => state.calls.length > 0 ? value : 0 }).run();
    stopped(result, 'E_CLOCK');
    assert.equal(result.data.counters.metadataCallAttempts, 1);
  });
}

test('post-call backwards time withholds metadata', () => {
  stopped(fixture({ now: state => state.calls.length > 0 ? 10 : 11 }).run(), 'E_CLOCK');
});

for (const distance of [0, 1, 2, 10, 50, 100]) {
  test(`serialization and final guards reject lateness ${distance} clock checks before normal return`, () => {
    const baseline = fixture();
    observed(baseline.run());
    const boundary = baseline.state.clockReads - distance;
    const f = fixture({ now: state => state.clockReads >= boundary ? 3500 : 0 });
    const result = f.run();
    stopped(result, 'E_DEADLINE');
    assert.equal(f.state.calls.length, 4);
    assert.equal(f.state.clockReads, boundary);
  });
}

test('late clock failure cannot publish valid-looking provisional data', () => {
  const baseline = fixture();
  observed(baseline.run());
  stopped(fixture({ now(state) {
    if (state.clockReads === baseline.state.clockReads) throw new Error('SECRET');
    return 0;
  } }).run(), 'E_CLOCK');
});

test('serializer returns actual ASCII JSON plus LF at the inclusive 8192-byte boundary', () => {
  const { snapshot, text } = privateApi.serializeBounded('a'.repeat(8189), () => {});
  assert.equal(snapshot.length, 8189);
  assert.equal(text.length, 8192);
  assert.equal(Buffer.byteLength(text, 'utf8'), 8192);
  assert.equal(text.at(-1), '\n');
  assert.equal(JSON.parse(text), snapshot);
  assert.throws(() => privateApi.serializeBounded('a'.repeat(8190), () => {}), /E_OUTPUT/);
});

test('serializer bounds escaped ASCII encoding rather than input UTF-8 length', () => {
  const good = 'a'.repeat(8183) + '\u0080';
  const result = privateApi.serializeBounded(good, () => {});
  assert.equal(result.text.length, 8192);
  assert.equal(Buffer.byteLength(result.text), 8192);
  assert.throws(() => privateApi.serializeBounded('a' + good, () => {}), /E_OUTPUT/);
});

test('serializer escapes controls, DEL, non-ASCII, paired and lone surrogate code units', () => {
  const value = '"\\\u0000\n\r\t\b\f\u001f\u007f\u0080\u00e9\ud83d\ude00\ud800X\udfff';
  const { text } = privateApi.serializeBounded(value, () => {});
  assert.match(text, /^[\x20-\x7e]*\n$/);
  assert.match(text, /\\u0000/);
  assert.match(text, /\\u007f/);
  assert.match(text, /\\ud83d\\ude00/);
  assert.match(text, /\\ud800X\\udfff/);
  assert.equal(JSON.parse(text), value);
});

test('serializer preflight rejects toJSON and accessors without invoking user code', () => {
  let calls = 0;
  for (const value of [{ toJSON() { calls++; return 'SECRET'; } },
    { get toJSON() { calls++; return () => 'SECRET'; } },
    { get field() { calls++; return 'SECRET'; } }]) {
    assert.throws(() => privateApi.serializeBounded(value, () => {}), /E_OUTPUT/);
  }
  assert.equal(calls, 0);
});

test('serializer rejects proxies, cycles, sparse arrays, hidden data, extra array keys and symbols', () => {
  let traps = 0;
  const proxy = new Proxy({}, { ownKeys() { traps++; throw new Error('SECRET'); } });
  const cycle = {}; cycle.self = cycle;
  const hidden = Object.defineProperty({}, 'hidden', { value: 1 });
  const extra = Object.assign([1], { extra: 2 });
  for (const value of [proxy, cycle, new Array(1), hidden, extra, { [Symbol('SECRET')]: 1 },
    Object.create({ inherited: true })]) {
    assert.throws(() => privateApi.serializeBounded(value, () => {}), /E_OUTPUT/);
  }
  assert.equal(traps, 0);
});

test('serializer rejects bigint, functions, undefined and non-finite or unsafe numbers', () => {
  for (const value of [1n, () => 0, undefined, Symbol('SECRET'), NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => privateApi.serializeBounded({ value }, () => {}), /E_OUTPUT/);
  }
});

test('serializer enforces depth 64 and nodes 10000 before publication', () => {
  const nest = depth => {
    let value = null;
    for (let index = 0; index < depth; index++) value = { value };
    return value;
  };
  assert.doesNotThrow(() => privateApi.serializeBounded(nest(64), () => {}));
  assert.throws(() => privateApi.serializeBounded(nest(65), () => {}), /E_OUTPUT/);
  let checks = 0;
  const many = Array.from({ length: 9999 }, () => null);
  assert.throws(() => privateApi.serializeBounded(many, () => { checks++; }), /E_OUTPUT/);
  assert.ok(checks > 10000);
  checks = 0;
  assert.throws(() => privateApi.serializeBounded([...many, null], () => { checks++; }), /E_OUTPUT/);
  assert.equal(checks, 1);
});

test('serializer copies and freezes data without sharing caller dictionaries', () => {
  const input = { rows: [{ value: 1 }], counters: { attempts: 4 } };
  const { snapshot, text } = privateApi.serializeBounded(input, () => {});
  deepFrozen(snapshot);
  assert.notEqual(snapshot, input);
  assert.notEqual(snapshot.rows[0], input.rows[0]);
  assert.notEqual(snapshot.counters, input.counters);
  input.rows[0].value = 2;
  assert.equal(snapshot.rows[0].value, 1);
  assert.equal(text, '{"rows":[{"value":1}],"counters":{"attempts":4}}\n');
});

test('serializer stops traversal at node 10001 independently of per-object key and byte limits', () => {
  const rows = Array.from({ length: 5000 }, () => [null]);
  let checks = 0;
  assert.throws(() => privateApi.serializeBounded(rows, () => { checks++; }), /E_OUTPUT/);
  assert.equal(checks, 25000);
});

test('serializer guards preflight and encoding and propagates a guard failure', () => {
  let checks = 0;
  const value = { text: 'x'.repeat(1024) };
  privateApi.serializeBounded(value, () => { checks++; });
  assert.ok(checks > 10);
  let actual = 0;
  assert.throws(() => privateApi.serializeBounded(value, () => {
    if (++actual === checks) throw new Error('fixed test guard');
  }), /fixed test guard/);
  assert.equal(actual, checks);
});

test('success and STOP snapshots reject root, entry and counter mutation', () => {
  const success = fixture().run();
  const stop = fixture({ lstat() { throw new Error('SECRET'); } }).run();
  for (const value of [success, stop]) {
    deepFrozen(value);
    assert.throws(() => { value.exitCode = 99; }, TypeError);
    assert.throws(() => { value.data.mockOnly = false; }, TypeError);
    assert.throws(() => { value.data.counters.opens = 1; }, TypeError);
  }
  assert.throws(() => { success.data.entries[0].metadata.ino = '99'; }, TypeError);
  assert.throws(() => { success.data.entries.push({}); }, TypeError);
});

test('handoff identities cover exactly authored source, test, and policy JSON plus LF', t => {
  const testBytes = fs.readFileSync(new URL('./preparation-helper-metadata.test.mjs', import.meta.url));
  const sourceBytes = Buffer.from(source, 'utf8');
  const policyBytes = Buffer.from(asciiJson(POLICY), 'ascii');
  assert.equal(sourceBytes.length, source.length);
  assert.match(source, /^[\x00-\x7f]*$/);
  assert.equal(policyBytes.at(-1), 10);
  t.diagnostic(JSON.stringify({
    source: { bytes: sourceBytes.length, sha256: sha(sourceBytes) },
    test: { bytes: testBytes.length, sha256: sha(testBytes) },
    policyJsonLf: { bytes: policyBytes.length, sha256: sha(policyBytes) },
    clockRoutingLiteral: 'const NOW = ORIGINAL_NOW.bind(CLOCK);',
  }));
  assert.equal(physicalAttempts, 0);
});
