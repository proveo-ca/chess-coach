// SPEC: _spec/tooling/native-ingress/xz-qualification.puml

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createCompressedXzKnownAnswerFixture } from './xz-compressed-fixture.mjs';

const INPUT_SHA256 = 'b63524a70c61afe5904bd6cf0b45c589ff2b58bc4ac1cc5e360318412e57994d';
const EXPECTED_OUTPUT_SHA256 = 'b64857892c3f1ff008e910d6f8786bffb7f6651b7c5ea58ae3b7975d3ac119de';
const SPEC_LINE = '// SPEC: _spec/tooling/native-ingress/xz-qualification.puml';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

test('returns exactly the fixture fields with no readiness flags or aliases', () => {
  const fixture = createCompressedXzKnownAnswerFixture();
  assert.deepEqual(Reflect.ownKeys(fixture).sort(), [
    'acceptOutput',
    'coverage',
    'expectedExitCode',
    'expectedOutputHex',
    'id',
    'inputHex',
    'integrityCheck',
    'memoryLimitBytes',
  ]);
  assert.equal(Object.getPrototypeOf(fixture), Object.prototype);
  for (const value of Object.values(fixture)) {
    assert.ok(['string', 'number', 'boolean'].includes(typeof value));
  }
});

test('returns a fresh frozen record on every call', () => {
  const first = createCompressedXzKnownAnswerFixture();
  const second = createCompressedXzKnownAnswerFixture();
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(second));
});

test('rejects mutation without changing subsequent fixtures', () => {
  const fixture = createCompressedXzKnownAnswerFixture();
  assert.throws(() => { fixture.inputHex = ''; }, TypeError);
  assert.throws(() => { fixture.ready = true; }, TypeError);
  assert.throws(() => { delete fixture.coverage; }, TypeError);
  assert.deepEqual(createCompressedXzKnownAnswerFixture(), fixture);
});

test('sets the requested acceptance, integrity, and memory metadata', () => {
  const fixture = createCompressedXzKnownAnswerFixture();
  assert.equal(fixture.id, 'compressed-lzma2-crc64-known-answer');
  assert.equal(fixture.expectedExitCode, 0);
  assert.equal(fixture.acceptOutput, true);
  assert.equal(fixture.memoryLimitBytes, 16777216);
  assert.equal(fixture.coverage, 'compressed-lzma2-known-answer');
  assert.equal(fixture.integrityCheck, true);
});

test('preserves all 1056 published XZ bytes against a literal SHA256 pin', () => {
  const { inputHex } = createCompressedXzKnownAnswerFixture();
  assert.match(inputHex, /^(?:[0-9a-f]{2})+$/);
  const input = Buffer.from(inputHex, 'hex');
  assert.equal(input.length, 1056);
  assert.equal(createHash('sha256').update(input).digest('hex'), INPUT_SHA256);
});

test('preserves all 1921 published plaintext bytes against a literal SHA256 pin', () => {
  const { expectedOutputHex } = createCompressedXzKnownAnswerFixture();
  assert.match(expectedOutputHex, /^(?:[0-9a-f]{2})+$/);
  const output = Buffer.from(expectedOutputHex, 'hex');
  assert.equal(output.length, 1921);
  assert.equal(createHash('sha256').update(output).digest('hex'), EXPECTED_OUTPUT_SHA256);
});

test('matches the independent plaintext CRC32 with a bitwise implementation', () => {
  assert.equal(crc32(Buffer.from('123456789', 'ascii')), 0xcbf43926);
  const { expectedOutputHex } = createCompressedXzKnownAnswerFixture();
  assert.equal(crc32(Buffer.from(expectedOutputHex, 'hex')), 0xb05baee2);
});

test('retains XZ magic and CRC64 flags with a valid stream-header CRC32', () => {
  const { inputHex } = createCompressedXzKnownAnswerFixture();
  const input = Buffer.from(inputHex, 'hex');
  assert.equal(input.subarray(0, 6).toString('hex'), 'fd377a585a00');
  assert.equal(input.subarray(6, 8).toString('hex'), '0004');
  assert.equal(crc32(input.subarray(6, 8)), input.readUInt32LE(8));
});

test('retains the LZMA2 filter and the actual compressed-chunk header', () => {
  const { inputHex } = createCompressedXzKnownAnswerFixture();
  const input = Buffer.from(inputHex, 'hex');
  assert.equal(input.subarray(12, 24).toString('hex'), '0200210116000000742fe5a3');
  assert.equal(input.subarray(24, 30).toString('hex'), 'e0078003df5d');
  assert.equal(crc32(input.subarray(12, 20)), input.readUInt32LE(20));
  const unpackedSize = ((input[24] & 0x1f) << 16) + input.readUInt16BE(25) + 1;
  const packedSize = input.readUInt16BE(27) + 1;
  assert.equal(unpackedSize, 1921);
  assert.equal(packedSize, 992);
  assert.equal(input[30], 0);
  assert.equal(input[30 + packedSize], 0);
});

test('preserves literal Hamlet boundaries, indentation, apostrophes, and LF bytes', () => {
  const { expectedOutputHex } = createCompressedXzKnownAnswerFixture();
  const output = Buffer.from(expectedOutputHex, 'hex');
  const text = output.toString('utf8');
  assert.ok(text.startsWith('\nLAERTES\n\n       O, fear me not.\n'));
  assert.ok(text.endsWith('\nLAERTES\n\n       Farewell.\n'));
  assert.ok(text.includes("       And you are stay'd for. There; my blessing with thee!\n"));
  assert.ok(text.includes("       'Tis in my memory lock'd,\n"));
  assert.ok(!text.includes('\r'));
  assert.ok(output.every((byte) => byte < 128));
});

test('both new files point to the parent-owned qualification specification', () => {
  for (const url of [new URL('./xz-compressed-fixture.mjs', import.meta.url), new URL(import.meta.url)]) {
    assert.equal(readFileSync(url, 'utf8').split('\n')[0], SPEC_LINE);
  }
});

test('fixture source has no imports, I/O, runtime selection, or executable loaders', () => {
  const source = readFileSync(new URL('./xz-compressed-fixture.mjs', import.meta.url), 'utf8');
  const license = SPEC_LINE + '\n// SPDX-License-Identifier: PSF-2.0\n// Copyright (c) 2001-2024 Python Software Foundation; All Rights Reserved\n';
  assert.ok(source.startsWith(license));
  const code = source.slice(license.length);
  assert.doesNotMatch(code, /\bimport\b|\brequire\s*\(|\bexport\s*\*/);
  assert.doesNotMatch(code, /\b(?:process|fetch|WebSocket|XMLHttpRequest|eval|Function)\b/);
  assert.doesNotMatch(code, /\b(?:python|spawn|exec|readFile|writeFile|decompress|decode)\b/i);
  assert.doesNotMatch(code, /\/\/|\/\*/);
});
