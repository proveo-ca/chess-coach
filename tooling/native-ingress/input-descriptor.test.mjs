// SPEC: _spec/tooling/native-ingress/custody.puml
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CustodyError, MAX_FIXTURE_BYTES, validateFixtureDescriptor } from './input-descriptor.mjs';

const valid = () => ({ name: 'fixture.bin', byteLength: 1, sha256: 'a'.repeat(64) });
const rejects = value => assert.throws(() => validateFixtureDescriptor(value),
  error => error instanceof CustodyError && error.code === 'E_INPUT');

test('snapshot exact ordinary and null-prototype records without freezing callers', () => {
  for (const source of [valid(), Object.freeze(valid()), Object.assign(Object.create(null), valid())]) {
    const result = validateFixtureDescriptor(source);
    assert.deepEqual(result, valid());
    assert.notEqual(result, source);
    assert.equal(Object.isFrozen(result), true);
  }
  const source = valid(), result = validateFixtureDescriptor(source);
  source.byteLength = 9;
  assert.equal(result.byteLength, 1);
  assert.equal(validateFixtureDescriptor({ ...valid(), byteLength: MAX_FIXTURE_BYTES }).byteLength, MAX_FIXTURE_BYTES);
});

test('reject non-records, inherited fields and nonstandard prototypes', () => {
  for (const value of [null, undefined, true, 1, 'input', [], () => {}, new Date(),
    Object.create(valid()), Object.assign(Object.create({ extra: 1 }), valid())]) rejects(value);
});

test('reject missing, extra, symbol and authority fields', () => {
  for (const key of Object.keys(valid())) {
    const value = valid(); delete value[key]; rejects(value);
  }
  for (const key of ['url', 'destination', 'nativeAuthority', '__proto__', Symbol('hash')]) {
    const value = valid(); Object.defineProperty(value, key, { value: 'extra' }); rejects(value);
  }
});

test('reject traversal and alternative filenames', () => {
  for (const name of ['', '../fixture.bin', '/fixture.bin', 'a/b', 'a\\b', 'fixture.bin\0',
    '.', '..', 'cargo.tar.xz', new String('fixture.bin')]) rejects({ ...valid(), name });
});

test('reject invalid lengths and hashes without coercion', () => {
  for (const byteLength of [0, -1, 1.5, NaN, Infinity, MAX_FIXTURE_BYTES + 1, Number.MAX_SAFE_INTEGER,
    '1', 1n, new Number(1)]) rejects({ ...valid(), byteLength });
  for (const sha256 of ['', 'A'.repeat(64), 'g'.repeat(64), 'a'.repeat(63), 'a'.repeat(65),
    'a'.repeat(64) + '\n', new String('a'.repeat(64))]) rejects({ ...valid(), sha256 });
});

test('reject accessor fields and proxies without running getters or traps', () => {
  let calls = 0;
  for (const key of Object.keys(valid())) {
    const value = valid();
    Object.defineProperty(value, key, { get() { calls++; throw Error('not data'); } });
    rejects(value);
  }
  rejects(new Proxy(valid(), {
    getPrototypeOf() { calls++; throw Error('trap'); },
    ownKeys() { calls++; throw Error('trap'); },
  }));
  const { proxy, revoke } = Proxy.revocable(valid(), {}); revoke(); rejects(proxy);
  assert.equal(calls, 0);
});
