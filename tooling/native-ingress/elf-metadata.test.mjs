// SPEC: _spec/tooling/native-ingress/elf-metadata.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ELF_METADATA_LIMITS, ElfMetadataError, inspectElf64 } from './elf-metadata.mjs';

const baseAddress = 0x400000n;
const maximumU64 = (1n << 64n) - 1n;
const assertions = [
  'candidateExecuted', 'decoderQualified', 'realCandidateRead', 'realArchiveInspected',
  'provenanceVerified', 'noPythonRuntimeVerified', 'loaderClosureVerified', 'nativeAuthority',
  'nativeQualified', 'installedUsability', 'rustReady', 'trainingReady',
];

function elf(programs = [], length = 4096) {
  assert.ok(length <= 1048576);
  const bytes = Buffer.alloc(length);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]);
  bytes.writeUInt16LE(3, 16);
  bytes.writeUInt16LE(62, 18);
  bytes.writeUInt32LE(1, 20);
  bytes.writeBigUInt64LE(programs.length === 0 ? 0n : 64n, 32);
  bytes.writeUInt16LE(64, 52);
  bytes.writeUInt16LE(56, 54);
  bytes.writeUInt16LE(programs.length, 56);
  programs.forEach((program, index) => {
    const at = 64 + index * 56;
    bytes.writeUInt32LE(program.type ?? 1, at);
    bytes.writeUInt32LE(program.flags ?? 4, at + 4);
    for (const [name, displacement, fallback] of [
      ['offset', 8, 0n], ['virtualAddress', 16, baseAddress], ['physicalAddress', 24, 0n],
      ['fileBytes', 32, 0n], ['memoryBytes', 40, program.fileBytes ?? 0n], ['alignment', 48, 1n],
    ]) bytes.writeBigUInt64LE(BigInt(program[name] ?? fallback), at + displacement);
  });
  return bytes;
}

function stringTable(...values) {
  const offsets = [];
  const chunks = [Buffer.from([0])];
  let length = 1;
  for (const value of values) {
    offsets.push(BigInt(length));
    const chunk = Buffer.concat([Buffer.from(value), Buffer.from([0])]);
    chunks.push(chunk);
    length += chunk.length;
  }
  return { bytes: Buffer.concat(chunks), offsets };
}

function dynamicElf(options = {}) {
  const table = options.table ?? stringTable('libalpha.so').bytes;
  const tableOffset = options.tableOffset ?? 2048;
  const address = options.baseAddress ?? baseAddress;
  const length = options.length ?? Math.max(4096, tableOffset + table.length);
  const entries = options.entries ?? [[5n, address + BigInt(tableOffset)], [10n, BigInt(table.length)], [1n, 1n], [0n, 0n]];
  const declaredBytes = options.declaredBytes ?? entries.length * 16;
  const loads = options.loads ?? [{ offset: 0n, virtualAddress: address, fileBytes: BigInt(length) }];
  const programs = [
    ...loads,
    { type: 2, offset: 512n, virtualAddress: address + 512n, fileBytes: BigInt(declaredBytes) },
  ];
  if (options.interpreter !== undefined) {
    programs.push({ type: 3, offset: 1024n, fileBytes: BigInt(options.interpreter.length) });
  }
  const bytes = elf(programs, length);
  entries.forEach(([tag, value], index) => {
    bytes.writeBigInt64LE(tag, 512 + index * 16);
    bytes.writeBigUInt64LE(value, 520 + index * 16);
  });
  table.copy(bytes, tableOffset);
  if (options.interpreter !== undefined) options.interpreter.copy(bytes, 1024);
  return bytes;
}

function interpElf(value) {
  const bytes = elf([{ type: 3, offset: 256n, fileBytes: BigInt(value.length) }]);
  value.copy(bytes, 256);
  return bytes;
}

function rejects(bytes, code, overrides) {
  assert.throws(() => inspectElf64(bytes, overrides), error => {
    assert.ok(error instanceof ElfMetadataError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.equal(error.name, 'ElfMetadataError');
    assert.equal(Object.isFrozen(error), true);
    assert.deepEqual(Object.keys(error).sort(), ['code', 'name']);
    assert.equal(Object.hasOwn(error, 'cause'), false);
    return true;
  });
}

function verifyFrozen(value) {
  if (value === null || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value));
  assert.equal(ArrayBuffer.isView(value), false);
  assert.ok(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype);
  for (const child of Object.values(value)) verifyFrozen(child);
}

test('minimal metadata has the exact profile, schema and negative authority assertions', () => {
  const bytes = elf([], 64);
  const result = inspectElf64(bytes);
  assert.deepEqual(Object.keys(result), [
    'profile', 'state', 'byteLength', 'inputSha256', 'header', 'programHeaders', 'interpreter', 'dynamic', ...assertions,
  ]);
  assert.equal(result.profile, 'elf64le-x86-64-metadata-v1');
  assert.equal(result.state, 'ELF_METADATA');
  assert.equal(result.byteLength, 64);
  assert.deepEqual(result.header, {
    type: 3, machine: 62, version: 1, osAbi: 0, abiVersion: 0, entryPoint: '0', flags: 0,
    programHeaderOffset: '0', programHeaderCount: 0, programHeaderBytes: 56,
  });
  assert.deepEqual(result.programHeaders, []);
  assert.equal(result.interpreter, null);
  assert.deepEqual(result.dynamic, {
    present: false, declaredSlots: 0, activeEntries: 0, needed: [], soname: null,
    rpath: null, runpath: null, stringTable: null, unknownTags: [],
  });
  for (const key of assertions) assert.equal(result[key], false);
  assert.equal(result.inputSha256, createHash('sha256').update(bytes).digest('hex'));
  verifyFrozen(result);
});

test('accepts ET_EXEC and retains OS ABI, ABI version, entry point and flags without qualification', () => {
  const bytes = elf();
  bytes.writeUInt16LE(2, 16);
  bytes[7] = 255;
  bytes[8] = 127;
  bytes.writeBigUInt64LE(maximumU64, 24);
  bytes.writeUInt32LE(0xffffffff, 48);
  const result = inspectElf64(bytes);
  assert.deepEqual([result.header.type, result.header.osAbi, result.header.abiVersion, result.header.entryPoint, result.header.flags],
    [2, 255, 127, maximumU64.toString(), 0xffffffff]);
  for (const key of assertions) assert.equal(result[key], false);
});

for (const [name, offset, value, width] of [
  ['magic byte zero', 0, 0, 1], ['magic E', 1, 0, 1], ['magic L', 2, 0, 1], ['magic F', 3, 0, 1],
  ['class', 4, 1, 1], ['endianness', 5, 2, 1], ['identity version', 6, 2, 1],
  ['header version', 20, 2, 4], ['machine', 18, 183, 2], ['type', 16, 1, 2],
  ['header size', 52, 63, 2], ['program header size', 54, 55, 2],
]) {
  test(`rejects unsupported ${name}`, () => {
    const bytes = elf();
    if (width === 1) bytes[offset] = value;
    if (width === 2) bytes.writeUInt16LE(value, offset);
    if (width === 4) bytes.writeUInt32LE(value, offset);
    rejects(bytes, 'E_ELF');
  });
}

for (const length of [0, 1, 7, 16, 32, 63]) {
  test(`rejects a ${length}-byte truncated header`, () => rejects(Buffer.alloc(length), 'E_INPUT'));
}

test('ignores section-header fields without traversing sections', () => {
  const bytes = elf();
  bytes.writeBigUInt64LE(maximumU64, 40);
  bytes.writeUInt16LE(65535, 58);
  bytes.writeUInt16LE(65535, 60);
  bytes.writeUInt16LE(65535, 62);
  assert.deepEqual(inspectElf64(bytes).programHeaders, []);
});

test('rejects PN_XNUM before program header traversal', () => {
  const bytes = elf();
  bytes.writeUInt16LE(65535, 56);
  rejects(bytes, 'E_PROGRAM_HEADERS');
});

test('program header count cap accepts equality and rejects one over a tightened cap', () => {
  assert.equal(inspectElf64(elf([{}, {}]), { maxProgramHeaders: 2 }).programHeaders.length, 2);
  rejects(elf([{}, {}, {}]), 'E_PROGRAM_HEADERS', { maxProgramHeaders: 2 });
});

test('program header count default cap accepts 128 and rejects 129', () => {
  assert.equal(inspectElf64(elf(Array.from({ length: 128 }, () => ({})), 8192)).programHeaders.length, 128);
  rejects(elf(Array.from({ length: 129 }, () => ({})), 8192), 'E_PROGRAM_HEADERS');
});

for (const offset of [4096n, 4097n, 9007199254740993n, maximumU64]) {
  test(`rejects out-of-bounds program header span at ${offset}`, () => {
    const bytes = elf([{}]);
    bytes.writeBigUInt64LE(offset, 32);
    rejects(bytes, 'E_PROGRAM_HEADERS');
  });
}

test('zero program headers still require an in-file header offset', () => {
  const bytes = elf();
  bytes.writeBigUInt64LE(maximumU64, 32);
  rejects(bytes, 'E_PROGRAM_HEADERS');
  bytes.writeBigUInt64LE(BigInt(bytes.length), 32);
  assert.equal(inspectElf64(bytes).programHeaders.length, 0);
});

test('truncated program header span fails without a raw DataView error', () => {
  const bytes = elf([{}]);
  rejects(bytes.subarray(0, 119), 'E_PROGRAM_HEADERS');
  assert.equal(inspectElf64(bytes.subarray(0, 120)).programHeaders.length, 1);
});

test('retains unknown program types and exact unsigned 64-bit fields', () => {
  const bytes = elf([{
    type: 0xffffffff, flags: 0xffffffff, offset: 4096n, virtualAddress: maximumU64,
    physicalAddress: maximumU64, fileBytes: 0n, memoryBytes: 1n, alignment: 1n << 63n,
  }]);
  assert.deepEqual(inspectElf64(bytes).programHeaders[0], {
    index: 0, type: 0xffffffff, flags: 0xffffffff, fileOffset: '4096',
    virtualAddress: maximumU64.toString(), physicalAddress: maximumU64.toString(),
    fileBytes: '0', memoryBytes: '1', alignment: (1n << 63n).toString(),
  });
});

for (const type of [0, 1, 0x6474e551]) {
  test(`all program types receive strict file-span checks: ${type}`, () => {
    rejects(elf([{ type, offset: 4096n, fileBytes: 1n }]), 'E_RANGE');
    rejects(elf([{ type, offset: maximumU64, fileBytes: maximumU64 }]), 'E_RANGE');
    assert.equal(inspectElf64(elf([{ type, offset: 4095n, fileBytes: 1n }])).programHeaders.length, 1);
  });
}

test('rejects file bytes larger than memory bytes', () => {
  rejects(elf([{ fileBytes: 2n, memoryBytes: 1n }]), 'E_PROGRAM_HEADERS');
});

for (const field of ['virtualAddress', 'physicalAddress']) {
  test(`${field} range accepts exclusive 2^64 and rejects overflow`, () => {
    assert.equal(inspectElf64(elf([{ [field]: maximumU64, memoryBytes: 1n }])).programHeaders.length, 1);
    rejects(elf([{ [field]: maximumU64, memoryBytes: 2n }]), 'E_RANGE');
  });
}

for (const alignment of [0n, 1n, 2n, 4096n, 1n << 63n]) {
  test(`accepts valid non-load alignment ${alignment}`, () => {
    assert.equal(inspectElf64(elf([{ type: 0, alignment }])).programHeaders[0].alignment, alignment.toString());
  });
}

test('rejects non-power-of-two alignment', () => rejects(elf([{ alignment: 3n }]), 'E_PROGRAM_HEADERS'));

test('checks PT_LOAD alignment congruence only on load segments', () => {
  rejects(elf([{ offset: 1n, alignment: 4096n }]), 'E_PROGRAM_HEADERS');
  assert.equal(inspectElf64(elf([{ offset: 1n, virtualAddress: baseAddress + 1n, alignment: 4096n }])).programHeaders.length, 1);
  assert.equal(inspectElf64(elf([{ type: 7, offset: 1n, alignment: 4096n }])).programHeaders.length, 1);
});

test('interpreter cap counts its terminator at equality and one over', () => {
  assert.equal(inspectElf64(interpElf(Buffer.from('abc\0')), { maxInterpreterBytes: 4 }).interpreter, 'abc');
  rejects(interpElf(Buffer.from('abcd\0')), 'E_INTERPRETER', { maxInterpreterBytes: 4 });
});

test('default interpreter cap accepts 256 bytes and rejects 257', () => {
  assert.equal(inspectElf64(interpElf(Buffer.from(`${'a'.repeat(255)}\0`))).interpreter.length, 255);
  rejects(interpElf(Buffer.from(`${'a'.repeat(256)}\0`)), 'E_INTERPRETER');
});

for (const [name, bytes] of [
  ['zero bytes', Buffer.alloc(0)], ['empty', Buffer.from([0])], ['no terminator', Buffer.from('abc')],
  ['embedded NUL', Buffer.from('ab\0c\0')], ['double terminator', Buffer.from('ab\0\0')],
  ['invalid UTF-8', Buffer.from([0xff, 0])], ['C0 control', Buffer.from('a\nb\0')],
  ['DEL', Buffer.from([0x61, 0x7f, 0])], ['C1 control', Buffer.from('a\u0085\0')],
]) {
  test(`rejects interpreter ${name}`, () => rejects(interpElf(bytes), 'E_INTERPRETER'));
}

for (const path of ['/raw/ld.so', 'relative/ld.so', '$ORIGIN/../ld.so', 'C:\\raw\\ld.so', '\ufeffld-é.so']) {
  test(`preserves inert interpreter text ${JSON.stringify(path)}`, () => {
    assert.equal(inspectElf64(interpElf(Buffer.from(`${path}\0`))).interpreter, path);
  });
}

test('rejects duplicate PT_INTERP even when identical', () => {
  rejects(elf([{ type: 3, offset: 256n, fileBytes: 2n }, { type: 3, offset: 256n, fileBytes: 2n }]), 'E_INTERPRETER');
});

test('rejects duplicate PT_DYNAMIC even when identical', () => {
  rejects(elf([{ type: 2, offset: 512n, fileBytes: 16n }, { type: 2, offset: 512n, fileBytes: 16n }]), 'E_DYNAMIC');
});

test('DT_NULL-only dynamic array needs no string table and includes the terminator in active entries', () => {
  const result = inspectElf64(dynamicElf({ entries: [[0n, maximumU64]] }));
  assert.equal(result.dynamic.present, true);
  assert.equal(result.dynamic.declaredSlots, 1);
  assert.equal(result.dynamic.activeEntries, 1);
  assert.equal(result.dynamic.stringTable, null);
});

test('bytes after the first DT_NULL are hashed but not interpreted or validated as padding', () => {
  const bytes = dynamicElf({ entries: [[0n, 1n], [1n, maximumU64], [5n, maximumU64]] });
  const first = inspectElf64(bytes);
  assert.equal(first.dynamic.declaredSlots, 3);
  assert.equal(first.dynamic.activeEntries, 1);
  assert.deepEqual(first.dynamic.needed, []);
  assert.equal(first.dynamic.stringTable, null);
  bytes[540] ^= 255;
  const second = inspectElf64(bytes);
  assert.notEqual(second.inputSha256, first.inputSha256);
  assert.deepEqual(second.dynamic, first.dynamic);
});

for (const declaredBytes of [0, 1, 15, 17, 31]) {
  test(`rejects dynamic size ${declaredBytes}`, () => rejects(dynamicElf({ declaredBytes }), 'E_DYNAMIC'));
}

test('requires DT_NULL within the declared slots', () => {
  rejects(dynamicElf({ entries: [[42n, 0n], [43n, 0n]] }), 'E_DYNAMIC');
  rejects(dynamicElf({ entries: [[42n, 0n], [0n, 0n]], declaredBytes: 16 }), 'E_DYNAMIC');
});

test('dynamic slot cap counts DT_NULL and non-active trailing slots', () => {
  const bytes = dynamicElf({ entries: [[0n, 0n], [42n, 0n]] });
  assert.equal(inspectElf64(bytes, { maxDynamicEntries: 2 }).dynamic.declaredSlots, 2);
  rejects(bytes, 'E_DYNAMIC', { maxDynamicEntries: 1 });
});

test('default dynamic cap accepts 1024 slots and rejects 1025 without large fixtures', () => {
  const entries = Array.from({ length: 1024 }, () => [0n, 0n]);
  assert.equal(inspectElf64(dynamicElf({ entries, tableOffset: 20000, length: 22000 })).dynamic.declaredSlots, 1024);
  entries.push([0n, 0n]);
  rejects(dynamicElf({ entries, tableOffset: 20000, length: 22000 }), 'E_DYNAMIC');
});

for (const tag of [5n, 10n, 14n, 15n, 29n]) {
  test(`rejects duplicate singleton dynamic tag ${tag} even with equal values`, () => {
    rejects(dynamicElf({ entries: [[tag, 1n], [tag, 1n], [0n, 0n]] }), 'E_DYNAMIC');
  });
}

for (const entries of [
  [[5n, baseAddress + 2048n], [0n, 0n]], [[10n, 12n], [0n, 0n]],
  [[1n, 1n], [0n, 0n]], [[14n, 1n], [0n, 0n]], [[15n, 0n], [0n, 0n]], [[29n, 0n], [0n, 0n]],
]) {
  test(`requires paired string-table tags for references ${entries[0][0]}`, () => {
    rejects(dynamicElf({ entries }), 'E_STRING_TABLE');
  });
}

test('preserves unknown negative and large signed tags and unsigned values without dereferencing', () => {
  const dynamic = inspectElf64(dynamicElf({ entries: [
    [-1n, maximumU64], [-(1n << 63n), maximumU64], [(1n << 63n) - 1n, maximumU64], [0n, 0n],
  ] })).dynamic;
  assert.deepEqual(dynamic.unknownTags, [
    { tag: '-1', value: maximumU64.toString() },
    { tag: (-(1n << 63n)).toString(), value: maximumU64.toString() },
    { tag: ((1n << 63n) - 1n).toString(), value: maximumU64.toString() },
  ]);
  assert.equal(dynamic.activeEntries, 4);
});

test('default dynamic metadata includes exact string-table translation', () => {
  const result = inspectElf64(dynamicElf());
  assert.deepEqual(result.dynamic.needed, ['libalpha.so']);
  assert.deepEqual(result.dynamic.stringTable, {
    virtualAddress: (baseAddress + 2048n).toString(), byteLength: 13, fileOffset: '2048',
  });
  assert.equal(result.dynamic.declaredSlots, 4);
  assert.equal(result.dynamic.activeEntries, 4);
});

test('maps large virtual addresses above 2^53 without rounding', () => {
  const address = 9007199254740993n;
  const result = inspectElf64(dynamicElf({ baseAddress: address }));
  assert.equal(result.programHeaders[0].virtualAddress, address.toString());
  assert.equal(result.dynamic.stringTable.virtualAddress, (address + 2048n).toString());
  assert.equal(result.dynamic.stringTable.fileOffset, '2048');
  assert.deepEqual(result.dynamic.needed, ['libalpha.so']);
});

test('maps a string table through a nonzero load file offset', () => {
  const result = inspectElf64(dynamicElf({
    loads: [{ offset: 1024n, virtualAddress: baseAddress + 1024n, fileBytes: 3072n }],
  }));
  assert.equal(result.dynamic.stringTable.fileOffset, '2048');
});

test('string table cap accepts equality and rejects one over a tightened cap', () => {
  const bytes = dynamicElf();
  assert.equal(inspectElf64(bytes, { maxStringTableBytes: 13 }).dynamic.stringTable.byteLength, 13);
  rejects(bytes, 'E_STRING_TABLE', { maxStringTableBytes: 12 });
});

test('default string table cap accepts 65536 bytes and rejects 65537', () => {
  const table = Buffer.alloc(65536);
  table.set(Buffer.from('\0a\0'));
  assert.equal(inspectElf64(dynamicElf({ table })).dynamic.stringTable.byteLength, 65536);
  rejects(dynamicElf({ table: Buffer.alloc(65537) }), 'E_STRING_TABLE');
});

for (const size of [0n, maximumU64]) {
  test(`rejects invalid DT_STRSZ ${size}`, () => {
    rejects(dynamicElf({ entries: [[5n, baseAddress + 2048n], [10n, size], [0n, 0n]] }), 'E_STRING_TABLE');
  });
}

test('rejects overflowing string-table virtual address range', () => {
  rejects(dynamicElf({ entries: [[5n, maximumU64], [10n, 2n], [0n, 0n]] }), 'E_STRING_TABLE');
});

test('accepts a string-table exclusive end at 2^64', () => {
  const address = (1n << 64n) - 4096n;
  const table = Buffer.alloc(2048);
  table.set(Buffer.from('\0a\0'));
  assert.deepEqual(inspectElf64(dynamicElf({ baseAddress: address, table })).dynamic.needed, ['a']);
});

for (const [name, loads] of [
  ['no load', []],
  ['unmapped table', [{ virtualAddress: baseAddress + 5000n, fileBytes: 100n }]],
  ['BSS-only coverage', [{ virtualAddress: baseAddress, fileBytes: 1024n, memoryBytes: 4096n }]],
  ['zero-file-byte BSS coverage', [{ virtualAddress: baseAddress + 2048n, fileBytes: 0n, memoryBytes: 4096n }]],
  ['partial coverage', [{ virtualAddress: baseAddress, fileBytes: 2050n }]],
  ['table starts before load', [{ virtualAddress: baseAddress + 2049n, fileBytes: 100n }]],
  ['identical mappings', [{ fileBytes: 4096n }, { fileBytes: 4096n }]],
  ['full plus partial mapping', [{ fileBytes: 4096n }, { virtualAddress: baseAddress + 2050n, fileBytes: 10n }]],
  ['split adjacent mappings', [
    { virtualAddress: baseAddress + 2048n, fileBytes: 6n },
    { virtualAddress: baseAddress + 2054n, fileBytes: 7n },
  ]],
]) {
  test(`rejects string-table mapping: ${name}`, () => rejects(dynamicElf({ loads }), 'E_STRING_TABLE'));
}

test('ignores a non-intersecting or zero-file-byte load when one mapping contains the table', () => {
  const bytes = dynamicElf({ loads: [
    { fileBytes: 4096n }, { virtualAddress: baseAddress + 2048n, fileBytes: 0n, memoryBytes: 128n },
    { virtualAddress: baseAddress + 4096n, fileBytes: 10n },
  ] });
  assert.deepEqual(inspectElf64(bytes).dynamic.needed, ['libalpha.so']);
});

test('rejects a load whose backing span exceeds the file before table translation', () => {
  rejects(dynamicElf({ loads: [{ offset: 4090n, fileBytes: 4096n }] }), 'E_RANGE');
});

test('preserves ordered duplicate NEEDED references and applies the count cap without deduplication', () => {
  const table = stringTable('alpha', 'beta');
  const entries = [
    [5n, baseAddress + 2048n], [10n, BigInt(table.bytes.length)],
    [1n, table.offsets[1]], [1n, table.offsets[0]], [1n, table.offsets[1]], [0n, 0n],
  ];
  const bytes = dynamicElf({ table: table.bytes, entries });
  assert.deepEqual(inspectElf64(bytes, { maxNeeded: 3 }).dynamic.needed, ['beta', 'alpha', 'beta']);
  rejects(bytes, 'E_DYNAMIC', { maxNeeded: 2 });
});

test('default NEEDED cap accepts 32 references and rejects 33', () => {
  const prefix = [[5n, baseAddress + 2048n], [10n, 13n]];
  const needed = Array.from({ length: 32 }, () => [1n, 1n]);
  assert.equal(inspectElf64(dynamicElf({ entries: [...prefix, ...needed, [0n, 0n]] })).dynamic.needed.length, 32);
  rejects(dynamicElf({ entries: [...prefix, ...needed, [1n, 1n], [0n, 0n]] }), 'E_DYNAMIC');
});

test('preserves SONAME, RPATH and RUNPATH together without normalizing or resolving paths', () => {
  const values = ['../raw/name.so', '$ORIGIN/../lib::relative\\dir', '/absolute:../raw/$LIB'];
  const table = stringTable(...values);
  const entries = [[5n, baseAddress + 2048n], [10n, BigInt(table.bytes.length)],
    [14n, table.offsets[0]], [15n, table.offsets[1]], [29n, table.offsets[2]], [0n, 0n]];
  const result = inspectElf64(dynamicElf({ table: table.bytes, entries }));
  assert.deepEqual([result.dynamic.soname, result.dynamic.rpath, result.dynamic.runpath], values);
  for (const key of assertions) assert.equal(result[key], false);
});

test('permits empty RPATH and RUNPATH unchanged', () => {
  const entries = [[5n, baseAddress + 2048n], [10n, 1n], [15n, 0n], [29n, 0n], [0n, 0n]];
  const result = inspectElf64(dynamicElf({ table: Buffer.from([0]), entries }));
  assert.equal(result.dynamic.rpath, '');
  assert.equal(result.dynamic.runpath, '');
});

for (const tag of [1n, 14n]) {
  test(`rejects empty non-path string for tag ${tag}`, () => {
    rejects(dynamicElf({ entries: [[5n, baseAddress + 2048n], [10n, 13n], [tag, 0n], [0n, 0n]] }), 'E_STRING');
  });
}

for (const reference of [13n, 14n, 9007199254740993n, maximumU64]) {
  test(`rejects out-of-table string reference ${reference}`, () => {
    rejects(dynamicElf({ entries: [[5n, baseAddress + 2048n], [10n, 13n], [1n, reference], [0n, 0n]] }), 'E_STRING');
  });
}

test('string cap includes NUL and accepts equality but rejects one byte over', () => {
  assert.deepEqual(inspectElf64(dynamicElf(), { maxStringBytes: 12 }).dynamic.needed, ['libalpha.so']);
  rejects(dynamicElf(), 'E_STRING', { maxStringBytes: 11 });
});

test('default string cap accepts 1024 bytes and rejects 1025', () => {
  assert.equal(inspectElf64(dynamicElf({ table: stringTable('a'.repeat(1023)).bytes })).dynamic.needed[0].length, 1023);
  rejects(dynamicElf({ table: stringTable('a'.repeat(1024)).bytes }), 'E_STRING');
});

test('string cap counts UTF-8 bytes rather than UTF-16 code units', () => {
  const bytes = dynamicElf({ table: stringTable('é🙂').bytes });
  assert.deepEqual(inspectElf64(bytes, { maxStringBytes: 7 }).dynamic.needed, ['é🙂']);
  rejects(bytes, 'E_STRING', { maxStringBytes: 6 });
});

test('does not scan past DT_STRSZ to find an adjacent NUL', () => {
  const bytes = dynamicElf({ table: Buffer.from([0, 0x61, 0]), entries: [
    [5n, baseAddress + 2048n], [10n, 2n], [1n, 1n], [0n, 0n],
  ] });
  rejects(bytes, 'E_STRING');
});

test('does not scan past the final file byte for a missing terminator', () => {
  const bytes = dynamicElf({ table: Buffer.from([0, 0x61]), tableOffset: 4094, entries: [
    [5n, baseAddress + 4094n], [10n, 2n], [1n, 1n], [0n, 0n],
  ] });
  rejects(bytes, 'E_STRING');
});

for (const [name, value] of [
  ['invalid continuation', Buffer.from([0x80])], ['overlong UTF-8', Buffer.from([0xc0, 0xaf])],
  ['truncated multibyte', Buffer.from([0xe2, 0x82])], ['surrogate', Buffer.from([0xed, 0xa0, 0x80])],
  ['C0', Buffer.from('a\tb')], ['DEL', Buffer.from([0x61, 0x7f])], ['C1', Buffer.from('a\u009f')],
]) {
  test(`rejects requested dynamic string ${name}`, () => rejects(dynamicElf({ table: stringTable(value).bytes }), 'E_STRING'));
}

test('preserves BOM and non-ASCII text in requested dynamic strings', () => {
  assert.deepEqual(inspectElf64(dynamicElf({ table: stringTable('\ufeffé🙂').bytes })).dynamic.needed, ['\ufeffé🙂']);
});

test('does not validate or expose unreferenced invalid string-table bytes', () => {
  const bytes = dynamicElf({ table: Buffer.from([0, 0x61, 0, 0xff, 0x01]) });
  const first = inspectElf64(bytes);
  assert.deepEqual(first.dynamic.needed, ['a']);
  bytes[2051] = 0xfe;
  assert.notEqual(inspectElf64(bytes).inputSha256, first.inputSha256);
});

test('permits a bounded string table without string references', () => {
  const result = inspectElf64(dynamicElf({ table: Buffer.from([0xff]), entries: [
    [5n, baseAddress + 2048n], [10n, 1n], [0n, 0n],
  ] }));
  assert.equal(result.dynamic.stringTable.byteLength, 1);
  assert.deepEqual(result.dynamic.needed, []);
});

test('input byte cap accepts equality and rejects one byte over without a large allocation', () => {
  assert.equal(inspectElf64(elf([], 64), { maxInputBytes: 64 }).byteLength, 64);
  rejects(elf([], 65), 'E_INPUT', { maxInputBytes: 64 });
});

test('accepts native Uint8Array and snapshots only its exact offset span', () => {
  const backing = new Uint8Array(128);
  backing.fill(0xaa);
  backing.set(elf([], 64), 32);
  const bytes = new Uint8Array(backing.buffer, 32, 64);
  const result = inspectElf64(bytes);
  assert.equal(result.byteLength, 64);
  assert.equal(result.inputSha256, createHash('sha256').update(bytes).digest('hex'));
});

test('accepts normal pooled Buffer backing and ignores bytes outside the Buffer span', () => {
  const bytes = Buffer.allocUnsafe(80).subarray(8, 72);
  elf([], 64).copy(bytes);
  assert.equal(inspectElf64(bytes).inputSha256, createHash('sha256').update(elf([], 64)).digest('hex'));
});

for (const [name, value] of [
  ['null', null], ['undefined', undefined], ['string', 'ELF'], ['plain object', {}],
  ['array', [0x7f]], ['ArrayBuffer', new ArrayBuffer(64)], ['DataView', new DataView(new ArrayBuffer(64))],
  ['Uint16Array', new Uint16Array(64)], ['Uint8ClampedArray', new Uint8ClampedArray(64)],
]) {
  test(`rejects non-native byte input: ${name}`, () => rejects(value, 'E_INPUT'));
}

test('rejects a proxy input without invoking its traps', () => {
  let calls = 0;
  const bytes = new Proxy(elf(), { get() { calls++; throw new Error('trap'); }, getPrototypeOf() { calls++; throw new Error('trap'); } });
  rejects(bytes, 'E_INPUT');
  assert.equal(calls, 0);
});

test('rejects revoked input proxies with only a fixed error', () => {
  const { proxy, revoke } = Proxy.revocable(elf(), {});
  revoke();
  rejects(proxy, 'E_INPUT');
});

test('rejects shared backing instead of copying it', () => {
  const bytes = new Uint8Array(new SharedArrayBuffer(64));
  bytes.set(elf([], 64));
  rejects(bytes, 'E_INPUT');
});

test('rejects Buffer views over shared backing', () => {
  const bytes = Buffer.from(new SharedArrayBuffer(64));
  elf([], 64).copy(bytes);
  rejects(bytes, 'E_INPUT');
});

test('rejects resizable backing even when its current bytes fit', () => {
  const backing = new ArrayBuffer(64, { maxByteLength: 128 });
  assert.equal(backing.resizable, true);
  const bytes = new Uint8Array(backing);
  bytes.set(elf([], 64));
  rejects(bytes, 'E_INPUT');
});

test('rejects Buffer views over resizable backing', () => {
  const backing = new ArrayBuffer(64, { maxByteLength: 128 });
  const bytes = Buffer.from(backing);
  elf([], 64).copy(bytes);
  rejects(bytes, 'E_INPUT');
});

test('rejects detached backing with only a fixed error', () => {
  const bytes = new Uint8Array(elf([], 64));
  structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
  rejects(bytes, 'E_INPUT');
});

test('rejects custom typed-array prototypes without invoking inherited getters', () => {
  let calls = 0;
  const prototype = Object.create(Uint8Array.prototype, {
    length: { get() { calls++; throw new Error('getter'); } },
  });
  const bytes = new Uint8Array(elf([], 64));
  Object.setPrototypeOf(bytes, prototype);
  rejects(bytes, 'E_INPUT');
  assert.equal(calls, 0);
});

test('rejects Uint8Array subclasses', () => {
  class CustomBytes extends Uint8Array {}
  rejects(new CustomBytes(elf([], 64)), 'E_INPUT');
});

test('bypasses input own length, buffer, offset, iterator and method getters', () => {
  let calls = 0;
  const bytes = elf([], 64);
  for (const key of ['length', 'buffer', 'byteOffset', 'byteLength', 'set', 'subarray', 'constructor', Symbol.iterator]) {
    Object.defineProperty(bytes, key, { get() { calls++; throw new Error('getter'); } });
  }
  assert.equal(inspectElf64(bytes).byteLength, 64);
  assert.equal(calls, 0);
});

test('limits defaults are exact and frozen', () => {
  assert.deepEqual(ELF_METADATA_LIMITS, {
    maxInputBytes: 1048576, maxProgramHeaders: 128, maxDynamicEntries: 1024,
    maxStringTableBytes: 65536, maxStringBytes: 1024, maxInterpreterBytes: 256,
    maxNeeded: 32, maxOutputBytes: 65536,
  });
  assert.equal(Object.isFrozen(ELF_METADATA_LIMITS), true);
  assert.throws(() => { ELF_METADATA_LIMITS.maxInputBytes = 1; }, TypeError);
});

test('accepts a null-prototype own-data limits record without retaining it', () => {
  const limits = Object.assign(Object.create(null), { maxInputBytes: 64 });
  assert.equal(inspectElf64(elf([], 64), limits).byteLength, 64);
  limits.maxInputBytes = 1;
  assert.equal(inspectElf64(elf([], 64)).byteLength, 64);
});

test('accepts non-enumerable own-data limit properties', () => {
  const limits = Object.defineProperty({}, 'maxInputBytes', { value: 64 });
  rejects(elf([], 65), 'E_INPUT', limits);
});

for (const [name, value] of [
  ['null', null], ['array', []], ['function', () => {}], ['number', 1], ['string', 'x'],
  ['custom prototype', Object.create({})], ['boxed number', new Number(64)],
]) {
  test(`rejects invalid limits record: ${name}`, () => rejects(elf(), 'E_LIMITS', value));
}

for (const value of [0, -1, NaN, Infinity, 1.5, '64', 64n, null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
  test(`rejects invalid numeric limit ${String(value)} (${typeof value})`, () => {
    rejects(elf(), 'E_LIMITS', { maxInputBytes: value });
  });
}

for (const [name, cap] of Object.entries(ELF_METADATA_LIMITS)) {
  test(`rejects increasing ${name} above its default`, () => rejects(elf(), 'E_LIMITS', { [name]: cap + 1 }));
}

test('rejects unknown, symbol and routing/callback limit keys without invoking their values', () => {
  for (const key of ['unknown', 'reader', 'callback', 'route', '__proto__', Symbol('limit')]) {
    const limits = Object.defineProperty({}, key, { value: () => { throw new Error('callback'); } });
    rejects(elf(), 'E_LIMITS', limits);
  }
});

test('rejects accessor limits without invoking getters', () => {
  let calls = 0;
  const limits = Object.defineProperty({}, 'maxInputBytes', { get() { calls++; throw new Error('getter'); } });
  rejects(elf(), 'E_LIMITS', limits);
  assert.equal(calls, 0);
});

test('rejects proxy limits without invoking traps', () => {
  let calls = 0;
  const limits = new Proxy({}, { ownKeys() { calls++; throw new Error('trap'); }, getPrototypeOf() { calls++; throw new Error('trap'); } });
  rejects(elf(), 'E_LIMITS', limits);
  assert.equal(calls, 0);
});

test('rejects revoked proxy limits', () => {
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  rejects(elf(), 'E_LIMITS', proxy);
});

test('output cap accepts exact JSON UTF-8 bytes and rejects one byte over a tightened cap', () => {
  const bytes = dynamicElf({ table: stringTable('é🙂"\\').bytes });
  const result = inspectElf64(bytes);
  const size = Buffer.byteLength(JSON.stringify(result), 'utf8');
  assert.ok(size <= 65536);
  assert.deepEqual(inspectElf64(bytes, { maxOutputBytes: size }), result);
  rejects(bytes, 'E_OUTPUT', { maxOutputBytes: size - 1 });
  assert.ok(size > JSON.stringify(result).length);
});

test('default 64-KiB output cap rejects bounded input with oversized escaped metadata', () => {
  const table = stringTable('"'.repeat(1023)).bytes;
  const entries = [[5n, baseAddress + 2048n], [10n, BigInt(table.length)],
    ...Array.from({ length: 32 }, () => [1n, 1n]), [0n, 0n]];
  rejects(dynamicElf({ table, entries }), 'E_OUTPUT');
});

test('returned objects are deeply immutable and independent of later input mutation', () => {
  const bytes = dynamicElf({ interpreter: Buffer.from('/raw/ld.so\0') });
  const result = inspectElf64(bytes);
  const json = JSON.stringify(result);
  verifyFrozen(result);
  assert.throws(() => { result.dynamic.needed[0] = 'changed'; }, TypeError);
  assert.throws(() => { result.programHeaders.push({}); }, TypeError);
  assert.throws(() => { result.header.type = 2; }, TypeError);
  bytes.fill(0xff);
  assert.equal(JSON.stringify(result), json);
});

test('failures publish no partial result and do not poison subsequent calls', () => {
  rejects(dynamicElf(), 'E_OUTPUT', { maxOutputBytes: 1 });
  rejects(Buffer.alloc(64), 'E_ELF');
  assert.deepEqual(inspectElf64(dynamicElf()).dynamic.needed, ['libalpha.so']);
});

test('public error constructor fixes unknown codes and exposes no supplied data', () => {
  const error = new ElfMetadataError('sensitive-buffer-content');
  assert.equal(error.code, 'E_INPUT');
  assert.equal(error.message, 'E_INPUT');
  assert.equal(Object.isFrozen(error), true);
  assert.equal(JSON.stringify(error).includes('sensitive-buffer-content'), false);
});

test('unexpected runtime failures normalize to fixed errors without partial metadata', t => {
  const bytes = dynamicElf();
  t.mock.method(Buffer, 'byteLength', () => { throw new Error('private-runtime-detail'); });
  rejects(bytes, 'E_INPUT');
});

test('source/test pointers, diagram covers and index agree; source imports only crypto and util', async () => {
  const source = await readFile(new URL('./elf-metadata.mjs', import.meta.url), 'utf8');
  const tests = await readFile(new URL('./elf-metadata.test.mjs', import.meta.url), 'utf8');
  const spec = '_spec/tooling/native-ingress/elf-metadata.puml';
  const files = ['tooling/native-ingress/elf-metadata.mjs', 'tooling/native-ingress/elf-metadata.test.mjs'];
  const diagram = await readFile(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(await readFile(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(entry => entry.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) assert.ok(diagram.includes("' covers: " + file + '\n'));
  const pointer = '// SPEC: ' + spec + '\n';
  assert.ok(source.startsWith(pointer));
  assert.ok(tests.startsWith(pointer));
  assert.deepEqual([...source.matchAll(/^import .* from '([^']+)';$/gm)].map(match => match[1]), ['node:crypto', 'node:util']);
  assert.equal(/\b(?:process|fetch|require)\b|\bimport\s*\(/u.test(source), false);
  assert.equal(/node:(?:fs|net|http|https|child_process|worker_threads)/u.test(source), false);
  assert.equal(source.split('\n').filter(line => line.trim().startsWith('//')).length, 1);
});
