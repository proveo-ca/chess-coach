// SPEC: _spec/tooling/native-ingress/elf-metadata.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  ELF_METADATA_LIMITS, ELF_REQUIREMENTS_LIMITS, ElfMetadataError, inspectElf64, inspectElf64Requirements,
} from './elf-metadata.mjs';

const base = 9007199254740993n;
const maximumU64 = (1n << 64n) - 1n;
const NEED = 0x6ffffffen;
const NEEDNUM = 0x6fffffffn;
const DEF = 0x6ffffffcn;
const DEFNUM = 0x6ffffffdn;
const negativeFlags = [
  'candidateExecuted', 'decoderQualified', 'realCandidateRead', 'realArchiveInspected', 'provenanceVerified',
  'noPythonRuntimeVerified', 'loaderClosureVerified', 'nativeAuthority', 'nativeQualified',
  'installedUsability', 'rustReady', 'trainingReady',
];

function elf(programs = [], length = 8192) {
  assert.ok(length <= 1048576);
  const bytes = Buffer.alloc(length);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]);
  bytes.writeUInt16LE(3, 16);
  bytes.writeUInt16LE(62, 18);
  bytes.writeUInt32LE(1, 20);
  bytes.writeBigUInt64LE(programs.length ? 64n : 0n, 32);
  bytes.writeUInt16LE(64, 52);
  bytes.writeUInt16LE(56, 54);
  bytes.writeUInt16LE(programs.length, 56);
  programs.forEach((program, index) => {
    const at = 64 + index * 56;
    bytes.writeUInt32LE(program.type ?? 1, at);
    bytes.writeUInt32LE(4, at + 4);
    for (const [key, offset, fallback] of [
      ['offset', 8, 0n], ['address', 16, base], ['physical', 24, 0n],
      ['size', 32, 0n], ['memory', 40, program.size ?? 0n], ['alignment', 48, 1n],
    ]) bytes.writeBigUInt64LE(BigInt(program[key] ?? fallback), at + offset);
  });
  return bytes;
}

function strings(values) {
  const chunks = [Buffer.from([0])];
  const refs = [];
  let length = 1;
  for (const value of values) {
    refs.push(length);
    const chunk = Buffer.concat([Buffer.from(value), Buffer.from([0])]);
    length += chunk.length;
    chunks.push(chunk);
  }
  return { bytes: Buffer.concat(chunks), refs };
}

function writeNeed(bytes, at, { version = 1, count = 1, file = 1, aux = 32, next = 0 } = {}) {
  bytes.writeUInt16LE(version, at);
  bytes.writeUInt16LE(count, at + 2);
  bytes.writeUInt32LE(file, at + 4);
  bytes.writeUInt32LE(aux, at + 8);
  bytes.writeUInt32LE(next, at + 12);
}

function writeNeedAux(bytes, at, { hash = 0x12345678, flags = 2, other = 0x8002, name, next = 0 }) {
  bytes.writeUInt32LE(hash, at);
  bytes.writeUInt16LE(flags, at + 4);
  bytes.writeUInt16LE(other, at + 6);
  bytes.writeUInt32LE(name, at + 8);
  bytes.writeUInt32LE(next, at + 12);
}

function writeDef(bytes, at, { version = 1, flags = 1, index = 7, count = 1, hash = 0x90abcdef, aux = 32, next = 0 } = {}) {
  bytes.writeUInt16LE(version, at);
  bytes.writeUInt16LE(flags, at + 2);
  bytes.writeUInt16LE(index, at + 4);
  bytes.writeUInt16LE(count, at + 6);
  bytes.writeUInt32LE(hash, at + 8);
  bytes.writeUInt32LE(aux, at + 12);
  bytes.writeUInt32LE(next, at + 16);
}

function writeDefAux(bytes, at, name, next = 0) {
  bytes.writeUInt32LE(name, at);
  bytes.writeUInt32LE(next, at + 4);
}

function versions(options = {}) {
  const address = options.address ?? base;
  const table = strings(options.values ?? ['libalpha.so', 'GLIBC_2.17', 'SYNTH_1.0', 'PARENT']);
  const entries = options.entries ?? [
    [5n, address + 2048n], [10n, BigInt(table.bytes.length)], [1n, BigInt(table.refs[0])],
    ...(options.need === false ? [] : [[NEED, address + 1024n], [NEEDNUM, 1n]]),
    ...(options.definition === false ? [] : [[DEF, address + 1280n], [DEFNUM, 1n]]), [0n, 0n],
  ];
  const bytes = elf([
    ...(options.loads ?? [{ size: 8192n, address }]),
    { type: 2, offset: 512n, address: address + 512n, size: BigInt(entries.length * 16) },
  ]);
  entries.forEach(([tag, value], index) => {
    bytes.writeBigInt64LE(tag, 512 + index * 16);
    bytes.writeBigUInt64LE(value, 520 + index * 16);
  });
  table.bytes.copy(bytes, 2048);
  writeNeed(bytes, 1024, { file: table.refs[0] });
  writeNeedAux(bytes, 1056, { name: table.refs[1] });
  writeDef(bytes, 1280);
  writeDefAux(bytes, 1312, table.refs[2]);
  return { bytes, refs: table.refs, entries, address };
}

function setTag(fixture, tag, value) {
  const index = fixture.entries.findIndex(([key]) => key === tag);
  assert.ok(index >= 0);
  fixture.bytes.writeBigUInt64LE(value, 520 + index * 16);
}

function reject(bytes, code, limits) {
  assert.throws(() => inspectElf64Requirements(bytes, limits), error => {
    assert.ok(error instanceof ElfMetadataError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.equal(Object.isFrozen(error), true);
    assert.deepEqual(Object.keys(error).sort(), ['code', 'name']);
    assert.equal(Object.hasOwn(error, 'cause'), false);
    return true;
  });
}

function frozenTree(value) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  assert.equal(ArrayBuffer.isView(value), false);
  assert.ok(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype);
  for (const child of Object.values(value)) frozenTree(child);
}

function note(type, descriptor, name = Buffer.from('GNU\0')) {
  const nameSize = Math.ceil(name.length / 4) * 4;
  const bytes = Buffer.alloc(12 + nameSize + Math.ceil(descriptor.length / 4) * 4);
  bytes.writeUInt32LE(name.length, 0);
  bytes.writeUInt32LE(descriptor.length, 4);
  bytes.writeUInt32LE(type, 8);
  name.copy(bytes, 12);
  descriptor.copy(bytes, 12 + nameSize);
  return bytes;
}

function property(type, payload) {
  const bytes = Buffer.alloc(8 + Math.ceil(payload.length / 8) * 8);
  bytes.writeUInt32LE(type, 0);
  bytes.writeUInt32LE(payload.length, 4);
  payload.copy(bytes, 8);
  return bytes;
}

function word(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

function notes(payload, ranges = [{ type: 4, offset: 3072n, size: BigInt(payload.length) }]) {
  const bytes = elf(ranges);
  payload.copy(bytes, 3072);
  return bytes;
}

test('v2 defaults explicitly raise only input/output ceilings and add bounded requirements limits', () => {
  assert.deepEqual(ELF_REQUIREMENTS_LIMITS, {
    ...ELF_METADATA_LIMITS, maxInputBytes: 4194304, maxOutputBytes: 131072,
    maxVersionRecords: 512, maxVersionAux: 1024, maxNoteBytes: 65536,
    maxNotes: 128, maxBuildIdBytes: 64, maxPropertyBytes: 4096,
  });
  assert.equal(ELF_METADATA_LIMITS.maxInputBytes, 1048576);
  assert.equal(ELF_METADATA_LIMITS.maxOutputBytes, 65536);
  assert.ok(Object.isFrozen(ELF_REQUIREMENTS_LIMITS));
});

test('minimal v2 output has a separate profile, exact requirements shape and all negative authority flags', () => {
  const bytes = elf([], 64);
  const result = inspectElf64Requirements(bytes);
  assert.equal(result.profile, 'elf64le-x86-64-requirements-v2');
  assert.equal(result.state, 'ELF_REQUIREMENTS_METADATA');
  assert.deepEqual(result.requirements, {
    versionNeeds: [], versionDefinitions: [], notes: [], buildIds: [], abiTags: [], properties: [],
    symbolBindingsVerified: false, hardwareCompatibilityVerified: false,
    instructionCoverageVerified: false, propertyEnforcementVerified: false, buildIdAuthenticated: false,
  });
  assert.equal(result.inputSha256, createHash('sha256').update(bytes).digest('hex'));
  for (const key of negativeFlags) assert.equal(result[key], false);
  assert.equal(Object.hasOwn(inspectElf64(bytes), 'requirements'), false);
  assert.equal(inspectElf64(bytes).profile, 'elf64le-x86-64-metadata-v1');
  frozenTree(result);
});

test('v2 tight input cap admits 64 bytes and rejects 65 without a multi-MiB allocation', () => {
  assert.equal(inspectElf64Requirements(elf([], 64), { maxInputBytes: 64 }).byteLength, 64);
  reject(elf([], 65), 'E_INPUT', { maxInputBytes: 64 });
  assert.throws(() => inspectElf64(elf([], 64), { maxInputBytes: 1048577 }), { code: 'E_LIMITS' });
  assert.equal(inspectElf64Requirements(elf([], 64), { maxInputBytes: 2186512 }).byteLength, 64);
});

for (const [key, cap] of Object.entries(ELF_REQUIREMENTS_LIMITS)) {
  test(`v2 rejects increased ${key}`, () => reject(elf([], 64), 'E_LIMITS', { [key]: cap + 1 }));
}

test('v2 rejects callback, symbol, unknown, accessor and proxy limits without invoking them', () => {
  let calls = 0;
  const callback = () => { calls++; throw new Error('private'); };
  for (const key of ['reader', 'resolve', 'unknown', Symbol('cap')]) reject(elf([], 64), 'E_LIMITS', { [key]: callback });
  reject(elf([], 64), 'E_LIMITS', Object.defineProperty({}, 'maxNotes', { get: callback }));
  reject(elf([], 64), 'E_LIMITS', new Proxy({}, { ownKeys: callback, getPrototypeOf: callback }));
  assert.equal(calls, 0);
});

test('v2 captures null-prototype and nonenumerable own-data limits', () => {
  const caps = Object.defineProperty(Object.create(null), 'maxInputBytes', { value: 64 });
  assert.equal(inspectElf64Requirements(elf([], 64), caps).byteLength, 64);
  reject(elf([], 65), 'E_INPUT', caps);
});

for (const caps of [null, [], 1, { maxNotes: 0 }, { maxNotes: 1.5 }, { maxNotes: NaN }, { maxNotes: 1n }]) {
  test(`v2 normalizes invalid limits ${String(caps)}`, () => reject(elf([], 64), 'E_LIMITS', caps));
}

test('version requirements preserve literal hashes, flags and indices above 2^53', () => {
  const result = inspectElf64Requirements(versions().bytes);
  assert.deepEqual(result.requirements.versionNeeds, [
    { file: 'libalpha.so', version: 1, aux: [{ name: 'GLIBC_2.17', hash: 0x12345678, flags: 2, other: 0x8002 }] },
  ]);
  assert.deepEqual(result.requirements.versionDefinitions, [
    { index: 7, flags: 1, hash: 0x90abcdef, names: ['SYNTH_1.0'] },
  ]);
  assert.equal(result.programHeaders[0].virtualAddress, '9007199254740993');
  assert.equal(result.dynamic.stringTable.virtualAddress, '9007199254743041');
  assert.deepEqual(result.dynamic.unknownTags.map(entry => entry.tag), ['1879048190', '1879048191', '1879048188', '1879048189']);
  for (const key of negativeFlags) assert.equal(result[key], false);
});

test('v1 continues treating duplicate version tags as opaque without new requirements validation', () => {
  const bytes = versions({ entries: [[NEED, maximumU64], [NEED, maximumU64], [0n, 0n]] }).bytes;
  assert.deepEqual(inspectElf64(bytes).dynamic.unknownTags, [
    { tag: '1879048190', value: '18446744073709551615' },
    { tag: '1879048190', value: '18446744073709551615' },
  ]);
  reject(bytes, 'E_VERSIONS');
});

for (const tag of [NEED, NEEDNUM, DEF, DEFNUM]) {
  test(`rejects duplicate active version tag ${tag}`, () => {
    const fixture = versions();
    const duplicate = fixture.entries.find(([key]) => key === tag);
    const entries = [...fixture.entries.slice(0, -1), duplicate, [0n, 0n]];
    reject(versions({ entries }).bytes, 'E_VERSIONS');
  });
  test(`requires the paired version tag for ${tag}`, () => {
    const entries = versions().entries.filter(([key]) => key !== tag);
    reject(versions({ entries }).bytes, 'E_VERSIONS');
  });
}

test('version references require the original paired dynamic string table', () => {
  const entries = versions().entries.filter(([tag]) => ![5n, 10n, 1n].includes(tag));
  reject(versions({ entries }).bytes, 'E_STRING_TABLE');
});

test('inactive version tags after DT_NULL remain hashed but uninterpreted', () => {
  const fixture = versions({ entries: [[0n, 0n], [NEED, maximumU64], [NEED, maximumU64]] });
  const first = inspectElf64Requirements(fixture.bytes);
  assert.deepEqual(first.requirements.versionNeeds, []);
  fixture.bytes[550] ^= 255;
  assert.notEqual(inspectElf64Requirements(fixture.bytes).inputSha256, first.inputSha256);
});

for (const countTag of [NEEDNUM, DEFNUM]) {
  for (const count of [0n, 513n, maximumU64]) {
    test(`rejects invalid version count ${countTag}:${count}`, () => {
      const fixture = versions();
      setTag(fixture, countTag, count);
      reject(fixture.bytes, 'E_VERSIONS');
    });
  }
}

test('record cap applies across both version tables at equality and one above', () => {
  const bytes = versions().bytes;
  assert.equal(inspectElf64Requirements(bytes, { maxVersionRecords: 2 }).requirements.versionDefinitions.length, 1);
  reject(bytes, 'E_VERSIONS', { maxVersionRecords: 1 });
});

test('auxiliary cap applies across both version tables at equality and one above', () => {
  const bytes = versions().bytes;
  assert.equal(inspectElf64Requirements(bytes, { maxVersionAux: 2 }).requirements.versionNeeds.length, 1);
  reject(bytes, 'E_VERSIONS', { maxVersionAux: 1 });
});

for (const [at, label] of [[1024, 'need'], [1280, 'definition']]) {
  for (const version of [0, 2, 65535]) {
    test(`rejects unsupported ${label} format ${version}`, () => {
      const fixture = versions();
      fixture.bytes.writeUInt16LE(version, at);
      reject(fixture.bytes, 'E_VERSIONS');
    });
  }
  for (const count of [0, 1025, 65535]) {
    test(`rejects ${label} auxiliary count ${count}`, () => {
      const fixture = versions();
      fixture.bytes.writeUInt16LE(count, at + (at === 1024 ? 2 : 6));
      reject(fixture.bytes, 'E_VERSIONS');
    });
  }
}

test('matches version library filenames against active NEEDED membership', () => {
  const fixture = versions();
  fixture.bytes.writeUInt32LE(fixture.refs[2], 1028);
  reject(fixture.bytes, 'E_VERSIONS');
});

test('duplicate active NEEDED references still satisfy filename membership', () => {
  const fixture = versions();
  const entries = [...fixture.entries.slice(0, -1), [1n, 1n], [0n, 0n]];
  const result = inspectElf64Requirements(versions({ entries }).bytes);
  assert.deepEqual(result.dynamic.needed, ['libalpha.so', 'libalpha.so']);
  assert.equal(result.requirements.versionNeeds[0].file, 'libalpha.so');
});

test('an absent NEEDED filename cannot qualify a version requirement', () => {
  const entries = versions().entries.filter(([tag]) => tag !== 1n);
  reject(versions({ entries }).bytes, 'E_VERSIONS');
});

for (const [label, tag, at, size, auxAt, auxSize, countAt, auxNextAt, recordNextAt] of [
  ['need', NEED, 1024, 16, 1056, 16, 1026, 1068, 1036],
  ['definition', DEF, 1280, 20, 1312, 8, 1286, 1316, 1296],
]) {
  for (const relativeOffset of [0, 1, size - 1]) {
    test(`rejects ${label} auxiliary relative pointer ${relativeOffset}`, () => {
      const fixture = versions();
      fixture.bytes.writeUInt32LE(relativeOffset, at + (tag === NEED ? 8 : 12));
      reject(fixture.bytes, 'E_VERSIONS');
    });
  }
  test(`rejects ${label} final record with nonzero next`, () => {
    const fixture = versions();
    fixture.bytes.writeUInt32LE(128, recordNextAt);
    reject(fixture.bytes, 'E_VERSIONS');
  });
  test(`rejects ${label} final auxiliary with nonzero next`, () => {
    const fixture = versions();
    fixture.bytes.writeUInt32LE(auxSize, auxNextAt);
    reject(fixture.bytes, 'E_VERSIONS');
  });
  for (const next of [0, 1, size - 1]) {
    test(`rejects ${label} early record next ${next}`, () => {
      const fixture = versions();
      setTag(fixture, tag === NEED ? NEEDNUM : DEFNUM, 2n);
      fixture.bytes.writeUInt32LE(next, recordNextAt);
      reject(fixture.bytes, 'E_VERSIONS');
    });
  }
  for (const next of [0, 1, auxSize - 1]) {
    test(`rejects ${label} early auxiliary next ${next}`, () => {
      const fixture = versions();
      fixture.bytes.writeUInt16LE(2, countAt);
      fixture.bytes.writeUInt32LE(next, auxNextAt);
      reject(fixture.bytes, 'E_VERSIONS');
    });
  }
  test(`rejects ${label} auxiliary pointer beyond mapped backing`, () => {
    const fixture = versions();
    fixture.bytes.writeUInt32LE(0xffffffff, at + (tag === NEED ? 8 : 12));
    reject(fixture.bytes, 'E_VERSIONS');
  });
  test(`rejects ${label} next record overlapping an already visited auxiliary`, () => {
    const fixture = versions();
    setTag(fixture, tag === NEED ? NEEDNUM : DEFNUM, 2n);
    fixture.bytes.writeUInt32LE(auxAt - at, recordNextAt);
    reject(fixture.bytes, 'E_VERSIONS');
  });
}

test('accepts two linked needs with noncontiguous record and auxiliary offsets', () => {
  const fixture = versions({ definition: false });
  setTag(fixture, NEEDNUM, 2n);
  fixture.bytes.writeUInt32LE(128, 1036);
  writeNeed(fixture.bytes, 1152, { file: fixture.refs[0] });
  writeNeedAux(fixture.bytes, 1184, { name: fixture.refs[2], hash: 0xffffffff, flags: 0xffff, other: 0xffff });
  assert.deepEqual(inspectElf64Requirements(fixture.bytes).requirements.versionNeeds, [
    { file: 'libalpha.so', version: 1, aux: [{ name: 'GLIBC_2.17', hash: 0x12345678, flags: 2, other: 0x8002 }] },
    { file: 'libalpha.so', version: 1, aux: [{ name: 'SYNTH_1.0', hash: 0xffffffff, flags: 0xffff, other: 0xffff }] },
  ]);
});

test('accepts two linked definitions and multiple auxiliary parent names', () => {
  const fixture = versions({ need: false });
  setTag(fixture, DEFNUM, 2n);
  writeDef(fixture.bytes, 1280, { count: 2, next: 128 });
  writeDefAux(fixture.bytes, 1312, fixture.refs[2], 16);
  writeDefAux(fixture.bytes, 1328, fixture.refs[3]);
  writeDef(fixture.bytes, 1408, { flags: 0xffff, index: 0xffff, hash: 0xffffffff });
  writeDefAux(fixture.bytes, 1440, fixture.refs[1]);
  assert.deepEqual(inspectElf64Requirements(fixture.bytes).requirements.versionDefinitions, [
    { index: 7, flags: 1, hash: 0x90abcdef, names: ['SYNTH_1.0', 'PARENT'] },
    { index: 0xffff, flags: 0xffff, hash: 0xffffffff, names: ['GLIBC_2.17'] },
  ]);
});

test('accepts multiple Vernaux entries with literal field values', () => {
  const fixture = versions({ definition: false });
  fixture.bytes.writeUInt16LE(2, 1026);
  fixture.bytes.writeUInt32LE(32, 1068);
  writeNeedAux(fixture.bytes, 1088, { name: fixture.refs[2], hash: 9, flags: 0, other: 3 });
  assert.deepEqual(inspectElf64Requirements(fixture.bytes).requirements.versionNeeds[0].aux[1],
    { name: 'SYNTH_1.0', hash: 9, flags: 0, other: 3 });
});

for (const tag of [NEED, DEF]) {
  for (const pointer of [base + 8192n, base + 8191n, maximumU64, 0n]) {
    test(`rejects unmapped or overflowing version record ${tag}:${pointer}`, () => {
      const fixture = versions();
      setTag(fixture, tag, pointer);
      reject(fixture.bytes, 'E_VERSIONS');
    });
  }
}

for (const [label, loads] of [
  ['BSS-only records', [{ size: 512n, memory: 2048n }, { offset: 2048n, address: base + 2048n, size: 6144n }]],
  ['split need record', [
    { size: 1032n }, { offset: 1032n, address: base + 1032n, size: 7160n },
  ]],
  ['partial extra mapping', [{ size: 8192n }, { offset: 1030n, address: base + 1030n, size: 2n }]],
  ['identical record aliases', [{ size: 8192n }, { offset: 1024n, address: base + 1024n, size: 16n }]],
  ['split need auxiliary', [{ size: 1064n }, { offset: 1064n, address: base + 1064n, size: 7128n }]],
  ['split definition record', [{ size: 1290n }, { offset: 1290n, address: base + 1290n, size: 6902n }]],
  ['split definition auxiliary', [{ size: 1316n }, { offset: 1316n, address: base + 1316n, size: 6876n }]],
]) {
  test(`version mapping rejects ${label}`, () => reject(versions({ loads }).bytes, 'E_VERSIONS'));
}

test('version mapping accepts nonzero file-backed segment offsets', () => {
  const loads = [{ offset: 1000n, address: base + 1000n, size: 7192n }];
  assert.equal(inspectElf64Requirements(versions({ loads }).bytes).requirements.versionNeeds[0].aux[0].name, 'GLIBC_2.17');
});

test('cross-table overlapping virtual record spans reject before interpreting aliases', () => {
  const fixture = versions();
  setTag(fixture, DEF, base + 1056n);
  reject(fixture.bytes, 'E_VERSIONS');
});

test('cross-table physical aliases reject even when virtual spans do not overlap', () => {
  const fixture = versions({ loads: [
    { size: 8192n }, { offset: 1024n, address: base + 10000n, size: 64n },
  ] });
  setTag(fixture, DEF, base + 10000n);
  reject(fixture.bytes, 'E_VERSIONS');
});

test('forward-link cycle attempts stop on previously occupied auxiliary spans', () => {
  const fixture = versions({ definition: false });
  setTag(fixture, NEEDNUM, 2n);
  fixture.bytes.writeUInt32LE(32, 1036);
  reject(fixture.bytes, 'E_VERSIONS');
});

test('version relative address arithmetic rejects unsigned-64 overflow', () => {
  const address = (1n << 64n) - 8192n;
  const fixture = versions({ address });
  fixture.bytes.writeUInt32LE(0xffffffff, 1032);
  reject(fixture.bytes, 'E_VERSIONS');
});

test('version auxiliary pointers cannot equal the exclusive unsigned-64 address limit', () => {
  const fixture = versions({ address: (1n << 64n) - 8192n });
  fixture.bytes.writeUInt32LE(7168, 1032);
  reject(fixture.bytes, 'E_VERSIONS');
});

test('version string caps include NUL and count UTF-8 bytes', () => {
  const fixture = versions({ values: ['libalpha.so', 'é🙂', 'SYNTH_1.0', 'PARENT'] });
  assert.equal(inspectElf64Requirements(fixture.bytes, { maxStringBytes: 12 }).requirements.versionNeeds[0].aux[0].name, 'é🙂');
  const short = versions({ values: ['a', 'é🙂', 'b', 'c'] });
  assert.equal(inspectElf64Requirements(short.bytes, { maxStringBytes: 7 }).requirements.versionNeeds[0].aux[0].name, 'é🙂');
  reject(short.bytes, 'E_STRING', { maxStringBytes: 6 });
});

for (const [label, value] of [
  ['empty', ''], ['invalid UTF-8', Buffer.from([0xff])], ['C0 control', 'a\nb'],
  ['DEL', 'a\u007fb'], ['C1 control', 'a\u0085b'],
]) {
  test(`rejects requested version string ${label}`, () => {
    reject(versions({ values: ['libalpha.so', value, 'SYNTH_1.0', 'PARENT'] }).bytes, 'E_STRING');
  });
}

test('GLIBC_PRIVATE and non-ASCII names stay inert declarations with no semantic authority', () => {
  const fixture = versions({ values: ['libalpha.so', 'GLIBC_PRIVATE', '\ufeffé🙂', 'PARENT'] });
  const result = inspectElf64Requirements(fixture.bytes);
  assert.equal(result.requirements.versionNeeds[0].aux[0].name, 'GLIBC_PRIVATE');
  assert.deepEqual(result.requirements.versionDefinitions[0].names, ['\ufeffé🙂']);
  assert.equal(result.requirements.symbolBindingsVerified, false);
});

for (const referenceAt of [1028, 1064, 1312]) {
  test(`rejects out-of-table version string offset at ${referenceAt}`, () => {
    const fixture = versions();
    fixture.bytes.writeUInt32LE(0xffffffff, referenceAt);
    reject(fixture.bytes, 'E_STRING');
  });
}

test('version string decoding never scans past DT_STRSZ for a NUL', () => {
  const fixture = versions();
  setTag(fixture, 10n, BigInt(fixture.refs[2] + 'SYNTH_1.0'.length));
  reject(fixture.bytes, 'E_STRING');
});

test('GNU build ID publishes lowercase immutable hex without authentication', () => {
  const bytes = notes(note(3, Buffer.from([0, 0xab, 0xff, 0x42])));
  const result = inspectElf64Requirements(bytes);
  assert.deepEqual(result.requirements.buildIds, ['00abff42']);
  assert.equal(result.requirements.notes[0].sha256, 'bf919c4d1441447317f1cd630c8199f0238bc3a24bd4ba893c003262fd54df17');
  assert.equal(result.requirements.buildIdAuthenticated, false);
  frozenTree(result);
});

test('GNU ABI tag retains exact declared OS and minimum version observations', () => {
  const descriptor = Buffer.concat([word(0), word(3), word(2), word(17)]);
  assert.deepEqual(inspectElf64Requirements(notes(note(1, descriptor))).requirements.abiTags,
    [{ osId: 0, major: 3, minor: 2, patch: 17 }]);
});

test('known GNU ISA and feature properties preserve raw bits, labels and unknown bits', () => {
  const descriptor = Buffer.concat([
    property(0xc0008002, word(0x8000000f)), property(0xc0000002, word(0x80000003)),
  ]);
  const result = inspectElf64Requirements(notes(note(5, descriptor)));
  assert.deepEqual(result.requirements.properties, [
    { type: 0xc0008002, byteLength: 4, bits: 0x8000000f, labels: ['baseline', 'v2', 'v3', 'v4'], unknownBits: 0x80000000 },
    { type: 0xc0000002, byteLength: 4, bits: 0x80000003, labels: ['IBT', 'SHSTK'], unknownBits: 0x80000000 },
  ]);
  assert.equal(result.requirements.hardwareCompatibilityVerified, false);
  assert.equal(result.requirements.instructionCoverageVerified, false);
  assert.equal(result.requirements.propertyEnforcementVerified, false);
});

test('unknown GNU properties publish only bounded type, length and payload hash', () => {
  const result = inspectElf64Requirements(notes(note(5, property(0x12345678, Buffer.from('abc')))));
  assert.deepEqual(result.requirements.properties, [{
    type: 0x12345678, byteLength: 3, sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  }]);
  assert.equal(JSON.stringify(result).includes('"abc"'), false);
});

test('unknown note names and types publish descriptor hashes instead of bytes', () => {
  const result = inspectElf64Requirements(notes(note(0xffffffff, Buffer.from('abc'), Buffer.from('é\0'))));
  assert.deepEqual(result.requirements.notes, [{
    fileOffset: '3072', name: 'é', type: 0xffffffff, byteLength: 3,
    sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  }]);
  assert.deepEqual(result.requirements.buildIds, []);
});

test('identical PT_NOTE and PT_GNU_PROPERTY ranges deduplicate physical notes and byte budgets', () => {
  const payload = note(5, property(0xc0008002, word(3)));
  const ranges = [4, 0x6474e553].map(type => ({ type, offset: 3072n, size: BigInt(payload.length) }));
  const result = inspectElf64Requirements(notes(payload, ranges), { maxNotes: 1, maxNoteBytes: payload.length });
  assert.equal(result.requirements.notes.length, 1);
  assert.equal(result.requirements.properties.length, 1);
});

test('PT_GNU_PROPERTY alone parses its bounded GNU property note', () => {
  const payload = note(5, property(0xc0008002, word(1)));
  const ranges = [{ type: 0x6474e553, offset: 3072n, size: BigInt(payload.length) }];
  assert.deepEqual(inspectElf64Requirements(notes(payload, ranges)).requirements.properties[0].labels, ['baseline']);
});

test('nonidentical overlapping note segment ranges fail closed', () => {
  const payload = Buffer.concat([note(3, word(1)), note(3, word(1))]);
  reject(notes(payload, [
    { type: 4, offset: 3072n, size: BigInt(payload.length) },
    { type: 0x6474e553, offset: 3092n, size: 20n },
  ]), 'E_NOTES');
});

test('separate physical duplicate build IDs deduplicate the identifier but count both notes', () => {
  const payload = Buffer.concat([note(3, word(1)), note(3, word(1))]);
  const result = inspectElf64Requirements(notes(payload));
  assert.deepEqual(result.requirements.buildIds, ['01000000']);
  assert.equal(result.requirements.notes.length, 2);
  reject(notes(payload), 'E_NOTES', { maxNotes: 1 });
});

test('conflicting GNU build IDs reject rather than picking one', () => {
  reject(notes(Buffer.concat([note(3, word(1)), note(3, word(2))])), 'E_NOTES');
});

test('note byte cap admits exact unique bytes and rejects one byte over', () => {
  const payload = note(3, word(1));
  assert.equal(inspectElf64Requirements(notes(payload), { maxNoteBytes: 20 }).requirements.notes.length, 1);
  reject(notes(payload), 'E_NOTES', { maxNoteBytes: 19 });
});

test('note byte cap sums disjoint segment bytes', () => {
  const payload = Buffer.concat([note(3, word(1)), note(3, word(1))]);
  const ranges = [3072n, 3092n].map(offset => ({ type: 4, offset, size: 20n }));
  assert.equal(inspectElf64Requirements(notes(payload, ranges), { maxNoteBytes: 40 }).requirements.notes.length, 2);
  reject(notes(payload, ranges), 'E_NOTES', { maxNoteBytes: 39 });
});

test('physical note count cap admits equality and rejects one over', () => {
  const payload = Buffer.concat([note(42, word(1)), note(42, word(2))]);
  assert.equal(inspectElf64Requirements(notes(payload), { maxNotes: 2 }).requirements.notes.length, 2);
  reject(notes(payload), 'E_NOTES', { maxNotes: 1 });
});

test('default 128-note ceiling rejects a 129th small note', () => {
  const payload = Buffer.concat(Array.from({ length: 128 }, () => note(42, Buffer.alloc(0))));
  assert.equal(inspectElf64Requirements(notes(payload)).requirements.notes.length, 128);
  reject(notes(Buffer.concat([payload, note(42, Buffer.alloc(0))])), 'E_NOTES');
});

test('empty note segments consume no physical notes', () => {
  const ranges = [{ type: 4, offset: 8192n, size: 0n }];
  assert.deepEqual(inspectElf64Requirements(notes(Buffer.alloc(0), ranges)).requirements.notes, []);
});

for (const length of [0, 65]) {
  test(`rejects GNU build-ID length ${length}`, () => reject(notes(note(3, Buffer.alloc(length))), 'E_NOTES'));
}

test('build-ID cap admits equality and rejects one over a tightened cap', () => {
  assert.deepEqual(inspectElf64Requirements(notes(note(3, Buffer.from([0xab, 0xcd]))), { maxBuildIdBytes: 2 }).requirements.buildIds, ['abcd']);
  reject(notes(note(3, Buffer.alloc(3))), 'E_NOTES', { maxBuildIdBytes: 2 });
  assert.equal(inspectElf64Requirements(notes(note(3, Buffer.alloc(64)))).requirements.buildIds[0].length, 128);
});

for (const length of [0, 15, 17, 20]) {
  test(`rejects GNU ABI descriptor length ${length}`, () => reject(notes(note(1, Buffer.alloc(length))), 'E_NOTES'));
}

for (const [label, name] of [
  ['empty', Buffer.from([0])], ['unterminated', Buffer.from('GNU!')],
  ['embedded NUL', Buffer.from('GN\0U\0')], ['invalid UTF-8', Buffer.from([0xff, 0])],
  ['C0', Buffer.from('G\nU\0')], ['DEL', Buffer.from('G\u007fU\0')],
  ['C1', Buffer.from('G\u0085U\0')], ['overlong', Buffer.alloc(1025)],
]) {
  test(`rejects note name ${label}`, () => reject(notes(note(42, word(1), name)), 'E_NOTES'));
}

test('GNU recognition requires exactly GNU plus NUL, not a prefix', () => {
  const result = inspectElf64Requirements(notes(note(3, Buffer.alloc(0), Buffer.from('GNUx\0'))));
  assert.deepEqual(result.requirements.buildIds, []);
  assert.equal(result.requirements.notes[0].name, 'GNUx');
});

test('note name bound admits exactly 1024 bytes including NUL', () => {
  const name = Buffer.from('a'.repeat(1023) + '\0');
  assert.equal(inspectElf64Requirements(notes(note(42, Buffer.alloc(0), name))).requirements.notes[0].name.length, 1023);
});

for (const offset of [0, 4]) {
  test(`rejects overflowing note length field ${offset}`, () => {
    const payload = note(42, word(1));
    payload.writeUInt32LE(0xffffffff, offset);
    reject(notes(payload), 'E_NOTES');
  });
}

for (const tail of [Buffer.from([0]), Buffer.alloc(4), Buffer.from([1]), Buffer.alloc(11)]) {
  test(`rejects incomplete trailing note header of ${tail.length} bytes with ${tail[0]}`, () => {
    reject(notes(Buffer.concat([note(42, word(1)), tail])), 'E_NOTES');
  });
}

test('rejects truncated note descriptor and missing outer padding', () => {
  const payload = note(42, Buffer.from([1]));
  reject(notes(payload.subarray(0, -1)), 'E_NOTES');
  reject(notes(payload.subarray(0, 15)), 'E_NOTES');
});

test('rejects nonzero note-name padding', () => {
  const payload = note(42, word(1), Buffer.from('A\0'));
  payload[14] = 1;
  reject(notes(payload), 'E_NOTES');
});

test('rejects nonzero note-descriptor padding', () => {
  const payload = note(42, Buffer.from([1]));
  payload[17] = 1;
  reject(notes(payload), 'E_NOTES');
});

test('property byte cap admits equality and rejects one byte over', () => {
  const payload = note(5, property(0xc0008002, word(1)));
  assert.equal(inspectElf64Requirements(notes(payload), { maxPropertyBytes: 16 }).requirements.properties.length, 1);
  reject(notes(payload), 'E_PROPERTIES', { maxPropertyBytes: 15 });
});

test('property count has a bounded total across notes independent of note count', () => {
  const descriptor = Buffer.concat([property(42, Buffer.alloc(0)), property(43, Buffer.alloc(0))]);
  const payload = note(5, descriptor);
  assert.equal(inspectElf64Requirements(notes(payload), { maxNotes: 2 }).requirements.properties.length, 2);
  reject(notes(payload), 'E_PROPERTIES', { maxNotes: 1 });
});

test('property count cap sums all GNU property descriptors', () => {
  const payload = Buffer.concat([
    note(5, Buffer.concat([property(42, Buffer.alloc(0)), property(43, Buffer.alloc(0))])),
    note(5, property(44, Buffer.alloc(0))),
  ]);
  reject(notes(payload), 'E_PROPERTIES', { maxNotes: 2 });
});

test('unknown empty property payload has the SHA256 of empty bytes', () => {
  const result = inspectElf64Requirements(notes(note(5, property(42, Buffer.alloc(0)))));
  assert.deepEqual(result.requirements.properties, [{
    type: 42, byteLength: 0, sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  }]);
});

for (const length of [0, 1, 7, 9]) {
  test(`rejects malformed property descriptor length ${length}`, () => {
    reject(notes(note(5, Buffer.alloc(length))), 'E_PROPERTIES');
  });
}

for (const propertyType of [0xc0008002, 0xc0000002]) {
  for (const size of [0, 3, 5, 8]) {
    test(`rejects known property ${propertyType} payload length ${size}`, () => {
      reject(notes(note(5, property(propertyType, Buffer.alloc(size)))), 'E_PROPERTIES');
    });
  }
}

test('rejects property payload size overflow', () => {
  const descriptor = property(42, word(1));
  descriptor.writeUInt32LE(0xffffffff, 4);
  reject(notes(note(5, descriptor)), 'E_PROPERTIES');
});

test('rejects nonzero 8-byte property padding', () => {
  const descriptor = property(0xc0008002, word(1));
  descriptor[12] = 1;
  reject(notes(note(5, descriptor)), 'E_PROPERTIES');
});

test('rejects property descriptor with a trailing partial TLV even if zero', () => {
  const descriptor = Buffer.concat([property(42, word(1)), Buffer.alloc(4)]);
  reject(notes(note(5, descriptor)), 'E_PROPERTIES');
});

test('rejects property descriptor above the default 4096-byte cap using a small RAM fixture', () => {
  reject(notes(note(5, Buffer.alloc(4097))), 'E_PROPERTIES');
});

test('unrecognized GNU note types remain inert hashed observations', () => {
  const result = inspectElf64Requirements(notes(note(999, Buffer.from('abc'))));
  assert.deepEqual(result.requirements.properties, []);
  assert.equal(result.requirements.notes[0].type, 999);
});

test('v1 still treats note contents as opaque even when v2 rejects their structure', () => {
  const bytes = notes(Buffer.from([1, 2, 3]));
  assert.equal(inspectElf64(bytes).state, 'ELF_METADATA');
  reject(bytes, 'E_NOTES');
});

test('v2 output byte cap includes requirements before freezing and publication', () => {
  const bytes = versions({ values: ['libalpha.so', 'é🙂"\\', 'SYNTH_1.0', 'PARENT'] }).bytes;
  const result = inspectElf64Requirements(bytes);
  const length = Buffer.byteLength(JSON.stringify(result), 'utf8');
  assert.ok(length <= 131072);
  assert.deepEqual(inspectElf64Requirements(bytes, { maxOutputBytes: length }), result);
  reject(bytes, 'E_OUTPUT', { maxOutputBytes: length - 1 });
  assert.ok(length > JSON.stringify(result).length);
});

test('v2 uses an ordinary private snapshot and exposes only deeply frozen plain metadata', () => {
  const bytes = versions().bytes;
  const result = inspectElf64Requirements(bytes);
  const json = JSON.stringify(result);
  frozenTree(result);
  bytes.fill(0xff);
  assert.equal(JSON.stringify(result), json);
  assert.throws(() => { result.requirements.versionNeeds[0].aux[0].name = 'mutated'; }, TypeError);
  assert.throws(() => { result.requirements.notes.push({}); }, TypeError);
});

test('v2 hashes only the exact input view and bypasses input own getters', () => {
  const bytes = new Uint8Array(128);
  bytes.set(elf([], 64), 32);
  const input = new Uint8Array(bytes.buffer, 32, 64);
  const expected = createHash('sha256').update(input).digest('hex');
  let calls = 0;
  for (const key of ['length', 'buffer', 'byteOffset', 'subarray', Symbol.iterator]) {
    Object.defineProperty(input, key, { get() { calls++; throw new Error('private'); } });
  }
  assert.equal(inspectElf64Requirements(input).inputSha256, expected);
  assert.equal(calls, 0);
});

test('v2 rejects shared, resizable, detached and proxy input before parsing', () => {
  reject(new Uint8Array(new SharedArrayBuffer(64)), 'E_INPUT');
  reject(new Uint8Array(new ArrayBuffer(64, { maxByteLength: 128 })), 'E_INPUT');
  const detached = new Uint8Array(64);
  structuredClone(detached.buffer, { transfer: [detached.buffer] });
  reject(detached, 'E_INPUT');
  let calls = 0;
  reject(new Proxy(elf([], 64), { get() { calls++; throw new Error('private'); } }), 'E_INPUT');
  assert.equal(calls, 0);
});

test('v2 failures retain fixed errors and do not poison later calls', t => {
  reject(versions().bytes, 'E_OUTPUT', { maxOutputBytes: 1 });
  assert.equal(inspectElf64Requirements(versions().bytes).requirements.versionNeeds.length, 1);
  t.mock.method(Buffer, 'byteLength', () => { throw new Error('private-runtime-detail'); });
  reject(elf([], 64), 'E_INPUT');
});

test('new fixed error codes accept only their names and unknown errors stay E_INPUT', () => {
  for (const code of ['E_VERSIONS', 'E_NOTES', 'E_PROPERTIES']) assert.equal(new ElfMetadataError(code).message, code);
  assert.equal(new ElfMetadataError('private').message, 'E_INPUT');
});
