// SPEC: _spec/tooling/native-ingress/xz-qualification.puml
const HELLO = 'xz qualification\n';
const MEMORY_LIMIT = 16 * 1024 * 1024;

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function le32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

function checked(bytes) {
  return Buffer.concat([bytes, le32(crc32(bytes))]);
}

function vli(value) {
  const bytes = [];
  do {
    const digit = value % 128;
    value = Math.floor(value / 128);
    bytes.push(digit | (value ? 0x80 : 0));
  } while (value);
  return Buffer.from(bytes);
}

function padded(bytes) {
  return Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4)]);
}

function footer(indexLength, check) {
  const fields = Buffer.concat([le32(indexLength / 4 - 1), Buffer.from([0, check])]);
  return Buffer.concat([le32(crc32(fields)), fields, Buffer.from('YZ')]);
}

function stream(payloads, check = 1, dictionaryProperty = 0) {
  const blocks = [];
  const records = [];
  for (const payload of payloads) {
    const length = Buffer.alloc(2);
    length.writeUInt16BE(payload.length - 1);
    const data = Buffer.concat([Buffer.from([1]), length, payload, Buffer.from([0])]);
    const header = checked(Buffer.from([2, 0, 0x21, 1, dictionaryProperty, 0, 0, 0]));
    const checkBytes = check === 1 ? le32(crc32(payload)) : Buffer.alloc(0);
    blocks.push(Buffer.concat([header, padded(data), checkBytes]));
    records.push(vli(header.length + data.length + checkBytes.length), vli(payload.length));
  }
  const flags = Buffer.from([0, check]);
  const index = checked(padded(Buffer.concat([Buffer.from([0]), vli(payloads.length), ...records])));
  return Buffer.concat([Buffer.from('fd377a585a00', 'hex'), checked(flags), ...blocks, index, footer(index.length, check)]);
}

function flipped(bytes, offset) {
  const copy = Buffer.from(bytes);
  copy[offset] ^= 1;
  return copy;
}

export function createXzQualificationFixtures() {
  if (crc32(Buffer.alloc(0)) !== 0 || crc32(Buffer.from('123456789')) !== 0xcbf43926) {
    throw new Error('E_FIXTURE_CRC32');
  }
  const hello = Buffer.from(HELLO);
  const empty = stream([]);
  const literal = stream([hello]);
  const none = stream([hello], 0);
  const indexOffset = literal.length - 20;
  const fixtures = [];
  const add = (id, input, output = null, options = {}) => {
    if (input.length >= 4096 || fixtures.length >= 32) throw new Error('E_FIXTURE_BOUNDS');
    fixtures.push(Object.freeze({
      id,
      inputHex: input.toString('hex'),
      expectedExitCode: output === null ? 1 : 0,
      expectedOutputHex: output === null ? null : Buffer.from(output).toString('hex'),
      acceptOutput: output !== null,
      memoryLimitBytes: options.memoryLimitBytes ?? MEMORY_LIMIT,
      coverage: 'uncompressed-lzma2-only',
      integrityCheck: options.integrityCheck ?? true,
    }));
  };

  add('empty-crc32', empty, '');
  add('literal-crc32', literal, HELLO);
  add('crc32-known-answer', stream([Buffer.from('123456789')]), '123456789');
  add('literal-check-none', none, HELLO, { integrityCheck: false });
  add('empty-check-none', stream([], 0), '', { integrityCheck: false });
  add('concatenated-streams', Buffer.concat([literal, literal]), HELLO + HELLO);
  add('stream-padding-four', Buffer.concat([literal, Buffer.alloc(4)]), HELLO);
  add('stream-padding-eight', Buffer.concat([empty, Buffer.alloc(8)]), '');
  add('inter-stream-padding', Buffer.concat([literal, Buffer.alloc(4), empty, literal]), HELLO + HELLO);
  add('multiple-blocks', stream([hello, hello]), HELLO + HELLO);
  add('multibyte-index-vli', stream([Buffer.from(HELLO.repeat(8))]), HELLO.repeat(8));
  add('output-limit-payload', stream([Buffer.from(HELLO.repeat(64))]), HELLO.repeat(64));
  add('corrupt-header-crc', flipped(literal, 8));
  add('corrupt-block-header-crc', flipped(literal, 20));
  add('corrupt-index-crc', flipped(literal, literal.length - 16));
  add('corrupt-footer-crc', flipped(literal, literal.length - 12));
  add('corrupt-payload', flipped(literal, 27));
  add('corrupt-payload-check', flipped(literal, indexOffset - 4));
  add('truncated-header', literal.subarray(0, 11));
  add('truncated-block', literal.subarray(0, 28));
  add('truncated-index', literal.subarray(0, indexOffset + 3));
  add('truncated-footer', literal.subarray(0, -1));
  add('invalid-trailing-padding-length', Buffer.concat([literal, Buffer.alloc(1)]));
  add('invalid-trailing-byte', Buffer.concat([literal, Buffer.from([1])]));
  add('invalid-trailing-padding-content', Buffer.concat([literal, Buffer.from([0, 0, 1, 0])]));
  add('invalid-inter-stream-padding', Buffer.concat([literal, Buffer.alloc(1), empty]));
  add('memory-limit-one-byte', literal, null, { memoryLimitBytes: 1 });
  add('large-declared-dictionary', stream([hello], 1, 40), null, { memoryLimitBytes: 1024 * 1024 });
  add('nonzero-block-padding', flipped(literal, 24 + 4 + hello.length));

  const noncanonicalIndex = checked(Buffer.from([0, 0x81, 0, 37, 17, 0, 0, 0]));
  add('noncanonical-index-vli', Buffer.concat([literal.subarray(0, indexOffset), noncanonicalIndex, footer(noncanonicalIndex.length, 1)]));
  const wrongSizeIndex = checked(Buffer.from([0, 1, 38, 17]));
  add('incorrect-index-unpadded-size', Buffer.concat([literal.subarray(0, indexOffset), wrongSizeIndex, footer(wrongSizeIndex.length, 1)]));
  add('incorrect-footer-backward-size', Buffer.concat([literal.subarray(0, -12), footer(12, 1)]));

  Object.defineProperty(fixtures, 'missingCompressedKnownAnswer', { value: true, enumerable: true });
  return Object.freeze(fixtures);
}
