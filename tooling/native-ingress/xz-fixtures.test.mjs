// SPEC: _spec/tooling/native-ingress/xz-qualification.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fixturesModule from './xz-fixtures.mjs';

const { createXzQualificationFixtures } = fixturesModule;
const fixtures = createXzQualificationFixtures();
const fixture = id => fixtures.find(record => record.id === id);
const bytes = id => Buffer.from(fixture(id).inputHex, 'hex');
const HELLO_HEX = '787a207175616c696669636174696f6e0a';
const EMPTY_CRC32_HEX = 'fd377a585a0000016922de36000000001cdf44219042990d010000000001595a';
const table = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function oracleCrc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = table[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function assertCrc(input, start, end) {
  assert.equal(input.readUInt32LE(end), oracleCrc(input.subarray(start, end)));
}

function readVli(input, cursor) {
  const digits = [];
  let value = 0;
  let power = 1;
  do {
    assert.ok(cursor.offset < input.length);
    const byte = input[cursor.offset++];
    digits.push(byte);
    assert.ok(digits.length <= 9);
    value += (byte & 127) * power;
    power *= 128;
    if (!(byte & 128)) break;
  } while (true);
  assert.ok(digits.length === 1 || digits.at(-1) !== 0, 'canonical VLI');
  assert.ok(Number.isSafeInteger(value));
  return value;
}

function inspectStream(input, start = 0) {
  assert.equal(input.subarray(start, start + 6).toString('hex'), 'fd377a585a00');
  assert.equal(input[start + 6], 0);
  const check = input[start + 7];
  assert.ok(check === 0 || check === 1);
  assertCrc(input, start + 6, start + 8);
  let offset = start + 12;
  const blocks = [];
  while (input[offset] !== 0) {
    const headerStart = offset;
    const headerSize = (input[offset] + 1) * 4;
    assert.equal(headerSize, 12);
    assert.deepEqual([...input.subarray(offset + 1, offset + 4)], [0, 0x21, 1]);
    const dictionaryProperty = input[offset + 4];
    assert.ok(dictionaryProperty <= 40);
    assert.equal(input.subarray(offset + 5, offset + 8).toString('hex'), '000000');
    assertCrc(input, offset, offset + 8);
    offset += headerSize;
    const dataStart = offset;
    const chunks = [];
    while (input[offset] !== 0) {
      assert.equal(input[offset++], 1);
      const size = input.readUInt16BE(offset) + 1;
      offset += 2;
      assert.ok(offset + size <= input.length);
      chunks.push(input.subarray(offset, offset + size));
      offset += size;
    }
    offset++;
    const compressedSize = offset - dataStart;
    const paddingStart = offset;
    while ((offset - headerStart) % 4) assert.equal(input[offset++], 0);
    const checkOffset = offset;
    const output = Buffer.concat(chunks);
    if (check === 1) {
      assert.equal(input.readUInt32LE(offset), oracleCrc(output));
      offset += 4;
    }
    blocks.push({ headerStart, dictionaryProperty, dataStart, compressedSize, paddingStart, checkOffset,
      unpaddedSize: headerSize + compressedSize + (check ? 4 : 0), output });
  }
  const indexStart = offset;
  const cursor = { offset: offset + 1 };
  const count = readVli(input, cursor);
  assert.equal(count, blocks.length);
  for (const block of blocks) {
    assert.equal(readVli(input, cursor), block.unpaddedSize);
    assert.equal(readVli(input, cursor), block.output.length);
  }
  while ((cursor.offset - indexStart) % 4) assert.equal(input[cursor.offset++], 0);
  assertCrc(input, indexStart, cursor.offset);
  offset = cursor.offset + 4;
  const footerStart = offset;
  assert.equal(input.readUInt32LE(offset), oracleCrc(input.subarray(offset + 4, offset + 10)));
  assert.equal(input.readUInt32LE(offset + 4), (footerStart - indexStart) / 4 - 1);
  assert.equal(input.subarray(offset + 8, offset + 10).toString('hex'), input.subarray(start + 6, start + 8).toString('hex'));
  assert.equal(input.subarray(offset + 10, offset + 12).toString(), 'YZ');
  return { end: offset + 12, indexStart, footerStart, check, blocks, output: Buffer.concat(blocks.map(block => block.output)) };
}

function inspectFile(input) {
  let offset = 0;
  const streams = [];
  while (offset < input.length) {
    const stream = inspectStream(input, offset);
    streams.push(stream);
    offset = stream.end;
    const paddingStart = offset;
    while (offset < input.length && input[offset] === 0) offset++;
    assert.equal((offset - paddingStart) % 4, 0);
  }
  return { streams, output: Buffer.concat(streams.map(stream => stream.output)) };
}

test('exports only the fixture factory', () => {
  assert.deepEqual(Object.keys(fixturesModule), ['createXzQualificationFixtures']);
});

test('returns a frozen bounded array with explicit missing compressed coverage', () => {
  assert.ok(Object.isFrozen(fixtures));
  assert.equal(fixtures.length, 32);
  assert.equal(fixtures.missingCompressedKnownAnswer, true);
  assert.throws(() => { fixtures.missingCompressedKnownAnswer = false; }, TypeError);
});

test('records contain frozen primitive-only data and unique identifiers', () => {
  assert.equal(new Set(fixtures.map(record => record.id)).size, fixtures.length);
  for (const record of fixtures) {
    assert.ok(Object.isFrozen(record));
    assert.deepEqual(Object.keys(record).sort(), ['id', 'inputHex', 'expectedExitCode', 'expectedOutputHex', 'acceptOutput', 'memoryLimitBytes', 'coverage', 'integrityCheck'].sort());
    for (const value of Object.values(record)) assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
    assert.throws(() => { record.inputHex = ''; }, TypeError);
  }
});

test('hex inputs remain below 4096 bytes and limits are positive integers', () => {
  for (const record of fixtures) {
    assert.match(record.inputHex, /^(?:[0-9a-f]{2})+$/);
    assert.ok(record.inputHex.length / 2 < 4096);
    assert.ok(Number.isSafeInteger(record.memoryLimitBytes) && record.memoryLimitBytes > 0);
    assert.ok(record.memoryLimitBytes <= 16 * 1024 * 1024);
  }
});

test('repeated construction returns identical data without shared mutable records', () => {
  const again = createXzQualificationFixtures();
  assert.deepEqual(again, fixtures);
  assert.notEqual(again, fixtures);
  assert.notEqual(again[0], fixtures[0]);
  const copy = bytes('literal-crc32');
  copy.fill(0);
  assert.equal(fixture('literal-crc32').inputHex, again.find(record => record.id === 'literal-crc32').inputHex);
});

test('table oracle matches independent CRC32 IEEE check values', () => {
  assert.equal(oracleCrc(Buffer.alloc(0)), 0);
  assert.equal(oracleCrc(Buffer.from('123456789')), 0xcbf43926);
});

test('pins the complete empty CRC32 stream to literal format bytes', () => {
  assert.equal(fixture('empty-crc32').inputHex, EMPTY_CRC32_HEX);
  assert.equal(inspectStream(Buffer.from(EMPTY_CRC32_HEX, 'hex')).end, 32);
});

test('known-answer payload stores little-endian IEEE CRC32', () => {
  const input = bytes('crc32-known-answer');
  const { blocks } = inspectStream(input);
  assert.equal(input.subarray(blocks[0].checkOffset, blocks[0].checkOffset + 4).toString('hex'), '2639f4cb');
  assert.equal(fixture('crc32-known-answer').expectedOutputHex, '313233343536373839');
});

test('literal stream has the exact minimal LZMA2 filter header', () => {
  const input = bytes('literal-crc32');
  assert.equal(input.subarray(12, 20).toString('hex'), '0200210100000000');
  assertCrc(input, 12, 20);
  const block = inspectStream(input).blocks[0];
  assert.equal(block.dictionaryProperty, 0);
  assert.equal(2 ** (12 + (block.dictionaryProperty >> 1)) * (2 | (block.dictionaryProperty & 1)) / 2, 4096);
});

test('literal chunk uses dictionary reset, big-endian size minus one, and end marker', () => {
  const input = bytes('literal-crc32');
  assert.equal(input.subarray(24, 27).toString('hex'), '010010');
  assert.equal(input.subarray(27, 44).toString('hex'), HELLO_HEX);
  assert.equal(input[44], 0);
  assert.equal(fixture('literal-crc32').expectedOutputHex, HELLO_HEX);
});

test('block padding precedes the payload check and is excluded from unpadded size', () => {
  const input = bytes('literal-crc32');
  const parsed = inspectStream(input);
  assert.equal(parsed.blocks[0].compressedSize, 21);
  assert.equal(parsed.blocks[0].unpaddedSize, 37);
  assert.equal(input.subarray(45, 48).toString('hex'), '000000');
  assert.equal(parsed.blocks[0].checkOffset, 48);
  assert.equal(parsed.indexStart, 52);
});

test('single-block index and footer backward size use exact canonical bytes', () => {
  const input = bytes('literal-crc32');
  const parsed = inspectStream(input);
  assert.equal(input.subarray(parsed.indexStart, parsed.indexStart + 4).toString('hex'), '00012511');
  assert.equal(input.readUInt32LE(parsed.footerStart + 4), 1);
});

test('all success cases pass independent structural and literal-only interpretation', () => {
  for (const record of fixtures.filter(record => record.acceptOutput)) {
    assert.equal(inspectFile(Buffer.from(record.inputHex, 'hex')).output.toString('hex'), record.expectedOutputHex, record.id);
    assert.equal(record.expectedExitCode, 0);
    assert.equal(record.memoryLimitBytes, 16 * 1024 * 1024);
  }
});

test('CheckNone cases explicitly lack payload integrity checks', () => {
  for (const id of ['empty-check-none', 'literal-check-none']) {
    assert.equal(fixture(id).integrityCheck, false);
    assert.equal(inspectStream(bytes(id)).check, 0);
  }
  const input = bytes('literal-check-none');
  input[27] ^= 1;
  assert.notEqual(inspectFile(input).output.toString('hex'), HELLO_HEX);
});

test('CRC32 success cases declare payload-integrity framing', () => {
  for (const record of fixtures.filter(record => record.acceptOutput && record.integrityCheck)) {
    for (const stream of inspectFile(Buffer.from(record.inputHex, 'hex')).streams) assert.equal(stream.check, 1);
  }
});

test('concatenation produces two streams and two literal outputs', () => {
  const parsed = inspectFile(bytes('concatenated-streams'));
  assert.equal(parsed.streams.length, 2);
  assert.equal(parsed.output.toString('hex'), HELLO_HEX.repeat(2));
});

test('legal trailing and inter-stream padding stays aligned to four bytes', () => {
  assert.equal(inspectFile(bytes('stream-padding-four')).streams.length, 1);
  assert.equal(bytes('stream-padding-four').length - bytes('literal-crc32').length, 4);
  assert.equal(bytes('stream-padding-eight').length - bytes('empty-crc32').length, 8);
  assert.equal(inspectFile(bytes('inter-stream-padding')).streams.length, 3);
});

test('multiple blocks each reset the dictionary and have separate index records', () => {
  const input = bytes('multiple-blocks');
  const parsed = inspectStream(input);
  assert.equal(parsed.blocks.length, 2);
  assert.equal(input[parsed.indexStart + 1], 2);
  for (const block of parsed.blocks) assert.equal(input[block.dataStart], 1);
  assert.equal(parsed.output.toString('hex'), HELLO_HEX.repeat(2));
});

test('multibyte VLI boundary encodes unpadded 156 and uncompressed 136 canonically', () => {
  const input = bytes('multibyte-index-vli');
  const parsed = inspectStream(input);
  assert.equal(input.subarray(parsed.indexStart, parsed.indexStart + 6).toString('hex'), '00019c018801');
  assert.equal(parsed.output.toString('hex'), HELLO_HEX.repeat(8));
});

test('output-limit payload remains a valid success input for a future controller cap', () => {
  const record = fixture('output-limit-payload');
  assert.equal(record.expectedExitCode, 0);
  assert.equal(record.expectedOutputHex, HELLO_HEX.repeat(64));
  assert.equal(inspectFile(bytes(record.id)).output.length, 1088);
  assert.ok(record.inputHex.length / 2 < 4096);
});

test('negative cases reject acceptance without asserting unknown partial output', () => {
  for (const record of fixtures.filter(record => !record.acceptOutput)) {
    assert.equal(record.expectedExitCode, 1);
    assert.equal(record.expectedOutputHex, null);
  }
});

test('CRC corruptions change only their intended CRC byte', () => {
  const good = bytes('literal-crc32');
  for (const [id, offset] of [['corrupt-header-crc', 8], ['corrupt-block-header-crc', 20], ['corrupt-index-crc', 56], ['corrupt-footer-crc', 60], ['corrupt-payload-check', 48]]) {
    const input = bytes(id);
    assert.deepEqual([...input.keys()].filter(index => input[index] !== good[index]), [offset]);
    assert.throws(() => inspectFile(input));
  }
});

test('payload corruption retains valid structural CRCs but fails decoded payload CRC', () => {
  const input = bytes('corrupt-payload');
  assertCrc(input, 6, 8);
  assertCrc(input, 12, 20);
  assert.equal(input.readUInt32LE(48), oracleCrc(Buffer.from(HELLO_HEX, 'hex')));
  assert.notEqual(input.readUInt32LE(48), oracleCrc(input.subarray(27, 44)));
  assert.throws(() => inspectFile(input));
});

test('truncation cases are strict prefixes at distinct framing boundaries', () => {
  const good = bytes('literal-crc32');
  for (const [id, size] of [['truncated-header', 11], ['truncated-block', 28], ['truncated-index', 55], ['truncated-footer', 71]]) {
    assert.deepEqual(bytes(id), good.subarray(0, size));
    assert.throws(() => inspectFile(bytes(id)));
  }
});

test('invalid trailing and inter-stream padding fails structural interpretation', () => {
  for (const id of ['invalid-trailing-padding-length', 'invalid-trailing-byte', 'invalid-trailing-padding-content', 'invalid-inter-stream-padding']) {
    assert.throws(() => inspectFile(bytes(id)), undefined, id);
  }
});

test('one-byte memory refusal uses an otherwise valid ordinary dictionary stream', () => {
  assert.deepEqual(bytes('memory-limit-one-byte'), bytes('literal-crc32'));
  assert.equal(fixture('memory-limit-one-byte').memoryLimitBytes, 1);
  assert.equal(inspectFile(bytes('memory-limit-one-byte')).output.toString('hex'), HELLO_HEX);
});

test('large dictionary declaration changes only header metadata without allocating a dictionary', () => {
  const input = bytes('large-declared-dictionary');
  const block = inspectStream(input).blocks[0];
  assert.equal(block.dictionaryProperty, 40);
  assert.equal(0xffffffff, 4 * 1024 ** 3 - 1);
  assert.equal(input.length, bytes('literal-crc32').length);
  assert.equal(fixture('large-declared-dictionary').memoryLimitBytes, 1024 * 1024);
  assert.equal(block.output.toString('hex'), HELLO_HEX);
});

test('nonzero block padding changes only the first padding byte', () => {
  const input = bytes('nonzero-block-padding');
  const good = bytes('literal-crc32');
  assert.deepEqual([...input.keys()].filter(index => input[index] !== good[index]), [45]);
  assert.throws(() => inspectFile(input));
});

test('noncanonical count has a valid index CRC and backward size', () => {
  const input = bytes('noncanonical-index-vli');
  assert.equal(input.subarray(52, 57).toString('hex'), '0081002511');
  assertCrc(input, 52, 60);
  assert.equal(input.readUInt32LE(68), 2);
  assert.throws(() => inspectFile(input), /canonical VLI/);
});

test('incorrect index size preserves canonical integers and valid index CRC', () => {
  const input = bytes('incorrect-index-unpadded-size');
  assert.equal(input.subarray(52, 56).toString('hex'), '00012611');
  assertCrc(input, 52, 56);
  assert.throws(() => inspectFile(input));
});

test('incorrect footer backward size preserves footer CRC and flags', () => {
  const input = bytes('incorrect-footer-backward-size');
  assert.equal(input.readUInt32LE(60), oracleCrc(input.subarray(64, 70)));
  assert.equal(input.readUInt32LE(64), 2);
  assert.equal(input.subarray(68).toString('hex'), '0001595a');
  assert.throws(() => inspectFile(input));
});

test('coverage never claims compressed LZMA2 or decoder qualification', () => {
  for (const record of fixtures) {
    assert.equal(record.coverage, 'uncompressed-lzma2-only');
    assert.equal(Object.hasOwn(record, 'decoderQualified'), false);
    assert.equal(Object.hasOwn(record, 'nativeQualified'), false);
  }
  assert.equal(fixtures.missingCompressedKnownAnswer, true);
});
