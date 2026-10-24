// SPEC: _spec/tooling/native-ingress/package-claims.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectPackageClaims, PackageClaimError } from './package-claims.mjs';

const parse = text => selectPackageClaims(Buffer.from(text));
const reject = text => assert.throws(() => parse(text), error => error instanceof PackageClaimError && error.code === 'E_PACKAGE');

test('only the three registered package claims and selected fields escape', () => {
  const rows = parse('Package: unrelated\nVersion: private\n\nPackage: xz-utils\nVersion: 5.8.3-1\nDescription: private\n continuation\n\nPackage: liblzma5\nSource: xz-utils\nArchitecture: amd64\n\nPackage: libc6\nStatus: install ok installed\n');
  assert.deepEqual(rows, [{ Package: 'xz-utils', Version: '5.8.3-1' }, { Package: 'liblzma5', Source: 'xz-utils', Architecture: 'amd64' }, { Package: 'libc6', Status: 'install ok installed' }]);
  assert.ok(Object.isFrozen(rows));
  assert.ok(rows.every(Object.isFrozen));
  assert.equal(JSON.stringify(rows).includes('private'), false);
});
test('folded Built-Using claims retain every continuation', () => {
  assert.deepEqual(parse('Package: xz-utils\nBuilt-Using: alpha (= 1),\n beta (= 2),\n\tgamma (= 3)\n'), [{ Package: 'xz-utils', 'Built-Using': 'alpha (= 1), beta (= 2), gamma (= 3)' }]);
});
test('field names are case-insensitive and output names are canonical', () => {
  assert.deepEqual(parse('package: xz-utils\nVeRsIoN: 1\nbuilt-using: alpha,\n beta\n'), [{ Package: 'xz-utils', Version: '1', 'Built-Using': 'alpha, beta' }]);
  reject('Package: xz-utils\nVersion: 1\nversion: 2\n');
  reject('Package: xz-utils\npackage: liblzma5\n');
});
test('value limit covers the complete folded UTF8 value', () => {
  const first = 'a'.repeat(255), second = 'b'.repeat(256);
  assert.equal(parse(`Package: xz-utils\nBuilt-Using: ${first}\n ${second}\n`)[0]['Built-Using'].length, 512);
  reject(`Package: xz-utils\nBuilt-Using: ${first}\n ${second}b\n`);
  assert.equal(Buffer.byteLength(parse('Package: xz-utils\nSource: ' + 'é'.repeat(256) + '\n')[0].Source), 512);
  reject('Package: xz-utils\nSource: ' + 'é'.repeat(257) + '\n');
});
test('continuations bind only to their preceding field', () => {
  assert.deepEqual(parse('Package: xz-utils\nDescription: not reported\n ignored\nVersion: 1\n'), [{ Package: 'xz-utils', Version: '1' }]);
  assert.deepEqual(parse('Package: xz-utils\n not-a-target\nVersion: 1\n'), []);
});
for (const text of [' orphan\n', 'Package xz-utils\n', 'Bad Field: x\n', 'Package: xz-utils\nPackage: xz-utils\n', 'Package: xz-utils\nVersion: 1\nVersion: 2\n', 'Package: xz-utils\n\nPackage: xz-utils\n', 'Package: xz-utils\r\n', 'Package: xz-utils\nVersion: a\0b\n', 'Package: xz-utils\nVersion: a\u0085b\n']) {
  test(`malformed claim rejects ${JSON.stringify(text)}`, () => reject(text));
}
test('paragraph and paragraph-count limits are inclusive', () => {
  const prefix = 'Package: other\nDescription: ';
  assert.deepEqual(parse(prefix + 'x'.repeat(131072 - prefix.length)), []);
  reject(prefix + 'x'.repeat(131073 - prefix.length));
  assert.deepEqual(parse(Array(4096).fill('Package: other').join('\n\n')), []);
  reject(Array(4097).fill('Package: other').join('\n\n'));
});
test('missing selected packages yield no invented provenance', () => {
  assert.deepEqual(parse('Package: unrelated\nVersion: 1\n'), []);
});
test('invalid UTF8 and unsupported inputs yield fixed errors', () => {
  for (const input of [null, 'x', [], new DataView(new ArrayBuffer(8)), Buffer.alloc(0), Buffer.from([255]), new Uint8Array(new SharedArrayBuffer(8)), new Proxy(Buffer.from('x'), {})]) assert.throws(() => selectPackageClaims(input), PackageClaimError);
  const backing = new ArrayBuffer(64, { maxByteLength: 128 });
  assert.throws(() => selectPackageClaims(new Uint8Array(backing)), PackageClaimError);
  const detached = new Uint8Array(8);
  structuredClone(detached.buffer, { transfer: [detached.buffer] });
  assert.throws(() => selectPackageClaims(detached), PackageClaimError);
});
test('native input offsets and shadow properties cannot change parsed bytes', () => {
  const raw = Buffer.from('xxPackage: xz-utils\nVersion: 1\nyy');
  const input = raw.subarray(2, -2);
  for (const key of ['length', 'buffer', 'byteOffset']) Object.defineProperty(input, key, { get() { assert.fail('shadow accessor'); } });
  assert.deepEqual(selectPackageClaims(input), [{ Package: 'xz-utils', Version: '1' }]);
});
test('input ceiling may tighten only and applies before copying', () => {
  const input = Buffer.from('Package: xz-utils');
  assert.equal(selectPackageClaims(input, input.length).length, 1);
  assert.throws(() => selectPackageClaims(input, input.length - 1), PackageClaimError);
  for (const limit of [0, -1, 4194305, NaN, 1.5, '20', 20n]) assert.throws(() => selectPackageClaims(input, limit), PackageClaimError);
});
test('source/test SPEC pointers, diagram covers and index agree', async () => {
  const spec = '_spec/tooling/native-ingress/package-claims.puml';
  const files = ['tooling/native-ingress/package-claims.mjs', 'tooling/native-ingress/package-claims.test.mjs'];
  const diagram = await readFile(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(await readFile(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(entry => entry.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) {
    assert.ok(diagram.includes("' covers: " + file + '\n'));
    const source = await readFile(new URL('../../' + file, import.meta.url), 'utf8');
    assert.equal(source.split('\n')[0], '// SPEC: ' + spec);
  }
});
