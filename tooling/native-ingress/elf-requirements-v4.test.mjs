// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as old from './elf-requirements-v3.mjs';
import * as current from './elf-requirements-v4.mjs';

const { inspectElf64RequirementsV4: inspect, ELF_REQUIREMENTS_V4_LIMITS: limits } = current;
const base = 9007199254740993n, maximum = (1n << 64n) - 1n;
const read = name => readFileSync(new URL('./' + name + '.mjs', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const prefix = '// SPEC: _spec/tooling/native-ingress/step2.puml\n';
const appendix = `
export const ELF_REQUIREMENTS_V4_LIMITS = Object.freeze({
  ...ELF_REQUIREMENTS_V3_LIMITS,
  maxStringTableBytes: 16777216,
});

export function inspectElf64RequirementsV4(bytes) {
  try {
    if (arguments.length !== 1) fail('E_INPUT');
    const limits = ELF_REQUIREMENTS_V4_LIMITS;
    const result = {
      ...inspect(snapshotInput(bytes, limits), limits, true),
      profile: 'elf64le-x86-64-requirements-v4',
    };
    if (Buffer.byteLength(JSON.stringify(result), 'utf8') > limits.maxOutputBytes) fail('E_OUTPUT');
    return Object.freeze(result);
  } catch (error) {
    if (error instanceof ElfMetadataError) throw error;
    fail('E_INPUT');
  }
}
`;
const negativeFlags = ['candidateExecuted', 'decoderQualified', 'realCandidateRead', 'realArchiveInspected',
  'provenanceVerified', 'noPythonRuntimeVerified', 'loaderClosureVerified', 'nativeAuthority',
  'nativeQualified', 'installedUsability', 'rustReady', 'trainingReady'];

function elf(programs = [], length = 8192) {
  const bytes = Buffer.alloc(length);
  bytes.set([127, 69, 76, 70, 2, 1, 1]);
  bytes.writeUInt16LE(2, 16); bytes.writeUInt16LE(62, 18); bytes.writeUInt32LE(1, 20);
  bytes.writeBigUInt64LE(programs.length ? 64n : 0n, 32);
  bytes.writeUInt16LE(64, 52); bytes.writeUInt16LE(56, 54); bytes.writeUInt16LE(programs.length, 56);
  programs.forEach((row, i) => {
    const at = 64 + i * 56;
    bytes.writeUInt32LE(row.type ?? 1, at); bytes.writeUInt32LE(4, at + 4);
    for (const [key, offset, fallback] of [['offset', 8, 0n], ['address', 16, base], ['physical', 24, 0n],
      ['size', 32, 0n], ['memory', 40, row.size ?? 0n], ['alignment', 48, 1n]]) {
      bytes.writeBigUInt64LE(BigInt(row[key] ?? fallback), at + offset);
    }
  });
  return bytes;
}
function dynamic(options = {}) {
  const table = options.table ?? Buffer.from('\0libalpha.so\0GLIBC_2.17\0SYNTH_1.0\0');
  const size = options.size ?? table.length;
  const entries = options.entries ?? [[5n, base + 2048n], [10n, BigInt(size)], [1n, 1n], [0n, 0n]];
  const length = options.length ?? Math.max(8192, 2048 + size);
  const bytes = elf([...(options.loads ?? [{ size: BigInt(length) }]),
    { type: 2, offset: 512n, size: options.dynamicSize ?? BigInt(entries.length * 16) },
    ...(options.extra ?? [])], length);
  entries.forEach(([tag, value], i) => { bytes.writeBigInt64LE(tag, 512 + i * 16); bytes.writeBigUInt64LE(value, 520 + i * 16); });
  table.copy(bytes, 2048);
  return bytes;
}
function versioned() {
  const bytes = dynamic({ entries: [[5n, base + 2048n], [10n, 34n], [1n, 1n],
    [0x6ffffffen, base + 1024n], [0x6fffffffn, 1n], [0x6ffffffcn, base + 1280n], [0x6ffffffdn, 1n], [0n, 0n]] });
  bytes.writeUInt16LE(1, 1024); bytes.writeUInt16LE(1, 1026); bytes.writeUInt32LE(1, 1028); bytes.writeUInt32LE(32, 1032);
  bytes.writeUInt32LE(17, 1056); bytes.writeUInt16LE(2, 1060); bytes.writeUInt16LE(3, 1062); bytes.writeUInt32LE(13, 1064);
  bytes.writeUInt16LE(1, 1280); bytes.writeUInt16LE(7, 1284); bytes.writeUInt16LE(1, 1286); bytes.writeUInt32LE(32, 1292);
  bytes.writeUInt32LE(24, 1312);
  return bytes;
}
function note(type, payload, name = Buffer.from('GNU\0')) {
  const bytes = Buffer.alloc(12 + Math.ceil(name.length / 4) * 4 + Math.ceil(payload.length / 4) * 4);
  bytes.writeUInt32LE(name.length); bytes.writeUInt32LE(payload.length, 4); bytes.writeUInt32LE(type, 8);
  name.copy(bytes, 12); payload.copy(bytes, 12 + Math.ceil(name.length / 4) * 4); return bytes;
}
function withNotes(payload) {
  const bytes = elf([{ type: 4, offset: 3072n, size: BigInt(payload.length) }], Math.max(8192, 3072 + payload.length));
  payload.copy(bytes, 3072); return bytes;
}
function reject(bytes, code) {
  assert.throws(() => inspect(bytes), error => {
    assert.ok(error instanceof current.ElfMetadataError); assert.equal(error.code, code); assert.equal(error.message, code);
    assert.equal(Object.isFrozen(error), true); assert.deepEqual(Object.keys(error).sort(), ['code', 'name']);
    assert.equal(Object.hasOwn(error, 'cause'), false); return true;
  });
}
function frozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true); assert.equal(ArrayBuffer.isView(value), false);
  for (const child of Object.values(value)) frozen(child);
}

test('static module is the exact pinned v3 source prefix with only the fixed v4 appendix', () => {
  const prior = read('elf-requirements-v3');
  assert.equal(prior.length, 20493); assert.equal(sha(prior), '3bd878fe2a6de57a2b8252163cdf2a4d3093c6605a903105a9f531f039b84f10');
  assert.equal(read('elf-requirements-v4').toString(), prior.toString().replace(/^\/\/ SPEC:.*\n/, prefix) + appendix);
});
test('new source has no filesystem, execution, network or dynamic-import authority', () => {
  const source = read('elf-requirements-v4').toString();
  assert.deepEqual([...source.matchAll(/^import .* from '([^']+)';$/gm)].map(m => m[1]), ['node:crypto', 'node:util']);
  assert.doesNotMatch(source, /\b(?:process|fetch|require|eval|Function)\b|\bimport\s*\(/);
  assert.equal(source.split('\n').filter(line => line.startsWith('//')).length, 1);
});
test('fixed v4 limits change only the declared string-table span', () => {
  assert.deepEqual(limits, { ...old.ELF_REQUIREMENTS_V3_LIMITS, maxStringTableBytes: 16777216 });
  assert.equal(Object.isFrozen(limits), true); assert.equal(inspect.length, 1);
  assert.throws(() => { limits.maxStringTableBytes = 1; }, TypeError);
  for (const name of ['ELF_METADATA_LIMITS', 'ELF_REQUIREMENTS_LIMITS', 'ELF_REQUIREMENTS_V3_LIMITS']) assert.deepEqual(current[name], old[name]);
});
test('old public exports in the clone preserve input, output and override behavior', () => {
  for (const name of ['inspectElf64', 'inspectElf64Requirements', 'inspectElf64RequirementsV3']) {
    for (const bytes of [elf([], 64), dynamic(), versioned()]) assert.deepEqual(current[name](bytes), old[name](bytes));
    assert.deepEqual(current[name](elf([], 64), { maxInputBytes: 64 }), old[name](elf([], 64), { maxInputBytes: 64 }));
    assert.throws(() => current[name](elf([], 65), { maxInputBytes: 64 }), { code: 'E_INPUT' });
    assert.throws(() => current[name](elf([], 64), { maxStringTableBytes: 65537 }), { code: 'E_LIMITS' });
  }
});
test('v4 synchronously emits the unchanged schema, new profile and false assurances', () => {
  const bytes = versioned(), value = inspect(bytes);
  assert.equal(value instanceof Promise, false);
  assert.deepEqual(value, { ...old.inspectElf64RequirementsV3(bytes), profile: 'elf64le-x86-64-requirements-v4' });
  assert.equal(value.inputSha256, sha(bytes)); assert.equal(value.state, 'ELF_REQUIREMENTS_METADATA');
  for (const key of negativeFlags) assert.equal(value[key], false);
  for (const key of ['symbolBindingsVerified', 'hardwareCompatibilityVerified', 'instructionCoverageVerified',
    'propertyEnforcementVerified', 'buildIdAuthenticated']) assert.equal(value.requirements[key], false);
});
test('publication is deeply frozen and independent of later caller mutation', () => {
  const bytes = versioned(), value = inspect(bytes), text = JSON.stringify(value); frozen(value); bytes.fill(255);
  assert.equal(JSON.stringify(value), text); assert.throws(() => { value.dynamic.needed.push('x'); }, TypeError);
});
for (const args of [[], [elf([], 64), undefined], [elf([], 64), {}], [elf([], 64), null], [elf([], 64), { maxStringTableBytes: 1 }]]) {
  test('fixed API refuses arity ' + args.length + ' without an override route ' + String(args[1]), () => {
    assert.throws(() => inspect(...args), { code: 'E_INPUT' });
  });
}
for (const size of [65536, 65537, 16777215, 16777216]) test('fully file-backed declared string span accepts ' + size + ' bytes', () => {
  const bytes = dynamic({ size }), digest = sha(bytes), result = inspect(bytes);
  assert.equal(result.dynamic.stringTable.byteLength, size); assert.equal(result.dynamic.stringTable.fileOffset, '2048');
  assert.deepEqual(result.dynamic.needed, ['libalpha.so']); assert.equal(sha(bytes), digest); assert.equal(result.inputSha256, digest);
  if (size > 65536) for (const api of [old.inspectElf64RequirementsV3, current.inspectElf64RequirementsV3]) {
    assert.throws(() => api(bytes), { code: 'E_STRING_TABLE' });
  }
});
test('16 MiB plus one remains refused with correct file backing', () => reject(dynamic({ size: 16777217 }), 'E_STRING_TABLE'));
test('sparse synthetic image decodes only selected bounded strings, not the declared table', t => {
  const bytes = dynamic({ size: 16777216 }); bytes.fill(255, 2100);
  let decoded = 0, copies = 0;
  const decode = TextDecoder.prototype.decode, set = Uint8Array.prototype.set;
  t.mock.method(TextDecoder.prototype, 'decode', function (input, ...args) {
    decoded++; assert.ok(input.length <= 1023); return Reflect.apply(decode, this, [input, ...args]);
  });
  t.mock.method(Uint8Array.prototype, 'set', function (input, offset) {
    copies++; assert.equal(this.length, bytes.length); assert.notEqual(this.buffer, bytes.buffer);
    return Reflect.apply(set, this, [input, offset]);
  });
  assert.deepEqual(inspect(bytes).dynamic.needed, ['libalpha.so']); assert.equal(decoded, 1); assert.equal(copies, 1);
});
test('selected string near the final table byte remains bounded and usable', () => {
  const size = 16777216, bytes = dynamic({ size, entries: [[5n, base + 2048n], [10n, BigInt(size)], [1n, BigInt(size - 2)], [0n, 0n]] });
  bytes[2048 + size - 2] = 97;
  assert.deepEqual(inspect(bytes).dynamic.needed, ['a']);
});
for (const apiName of ['inspectElf64RequirementsV3', 'inspectElf64RequirementsV4']) test(apiName + ' keeps exactly the 64 MiB input ceiling', () => {
  const size = 67108864, bytes = elf([{ size: BigInt(size) }], size);
  const api = current[apiName]; assert.equal(api(bytes).byteLength, size);
  if (apiName === 'inspectElf64RequirementsV3') assert.equal(old[apiName](bytes).byteLength, size);
  assert.throws(() => api(new Uint8Array(size + 1)), { code: 'E_INPUT' });
});
test('oversized input fails before a private snapshot copy', t => {
  const bytes = new Uint8Array(67108865); let copies = 0;
  t.mock.method(Uint8Array.prototype, 'set', () => { copies++; throw new Error('copy'); });
  reject(bytes, 'E_INPUT'); assert.equal(copies, 0);
});
test('older v1 and v2 copied APIs retain their original exact input ceilings', () => {
  for (const [name, cap] of [['inspectElf64', 1048576], ['inspectElf64Requirements', 4194304]]) {
    const bytes = elf([{ size: BigInt(cap) }], cap + 1);
    for (const api of [old[name], current[name]]) {
      assert.equal(api(bytes.subarray(0, cap)).byteLength, cap); assert.throws(() => api(bytes), { code: 'E_INPUT' });
    }
  }
});
for (const bytes of [null, undefined, 'ELF', {}, [], new ArrayBuffer(64), new DataView(new ArrayBuffer(64)),
  new Uint16Array(64), new Uint8ClampedArray(64), new (class extends Uint8Array {})(64)]) {
  test('non-native input refuses ' + Object.prototype.toString.call(bytes), () => reject(bytes, 'E_INPUT'));
}
test('proxy and revoked proxy bytes fail without traps', () => {
  const trap = () => assert.fail('proxy trap'); reject(new Proxy(elf([], 64), { get: trap, getPrototypeOf: trap }), 'E_INPUT');
  const { proxy, revoke } = Proxy.revocable(elf([], 64), {}); revoke(); reject(proxy, 'E_INPUT');
});
test('native Buffer and Uint8Array offset spans ignore caller getters', () => {
  for (const buffer of [false, true]) {
    const backing = Buffer.alloc(128); elf([], 64).copy(backing, 32);
    const bytes = buffer ? backing.subarray(32, 96) : new Uint8Array(backing.buffer, backing.byteOffset + 32, 64);
    const digest = sha(bytes);
    for (const key of ['length', 'buffer', 'byteOffset', 'byteLength', 'set', 'subarray', 'constructor', Symbol.iterator]) {
      Object.defineProperty(bytes, key, { get() { assert.fail('caller getter'); } });
    }
    assert.equal(inspect(bytes).inputSha256, digest);
  }
});
test('custom prototype bytes fail without getter execution', () => {
  const bytes = new Uint8Array(64); Object.setPrototypeOf(bytes, Object.create(Uint8Array.prototype, { length: { get() { assert.fail('getter'); } } }));
  reject(bytes, 'E_INPUT');
});
test('shared backing fails before copying for Buffer and Uint8Array', t => {
  const inputs = [new Uint8Array(new SharedArrayBuffer(64)), Buffer.from(new SharedArrayBuffer(64))];
  t.mock.method(Uint8Array.prototype, 'set', () => assert.fail('shared copy'));
  for (const bytes of inputs) reject(bytes, 'E_INPUT');
});
test('resizable backing fails before copying for Buffer and Uint8Array', t => {
  const backing = new ArrayBuffer(64, { maxByteLength: 128 }); assert.equal(backing.resizable, true);
  const inputs = [new Uint8Array(backing), Buffer.from(backing)];
  t.mock.method(Uint8Array.prototype, 'set', () => assert.fail('resizable copy'));
  for (const bytes of inputs) reject(bytes, 'E_INPUT');
});
test('detached backing yields only E_INPUT', () => {
  const bytes = new Uint8Array(elf([], 64)); structuredClone(bytes.buffer, { transfer: [bytes.buffer] }); reject(bytes, 'E_INPUT');
});
for (const size of [0, 1, 7, 32, 63]) test('truncated input ' + size + ' fails', () => reject(Buffer.alloc(size), 'E_INPUT'));
for (const [at, value, width] of [[0, 0, 1], [4, 1, 1], [5, 2, 1], [6, 2, 1], [16, 1, 2], [18, 183, 2], [20, 2, 4], [52, 63, 2], [54, 55, 2]]) {
  test('header refusal at byte ' + at, () => {
    const bytes = elf([], 64); bytes['writeUInt' + (width * 8) + (width === 1 ? '' : 'LE')](value, at); reject(bytes, 'E_ELF');
  });
}
test('program-header count and file-span bounds remain fixed', () => {
  const bytes = elf(); bytes.writeUInt16LE(129, 56); reject(bytes, 'E_PROGRAM_HEADERS');
  bytes.writeUInt16LE(65535, 56); reject(bytes, 'E_PROGRAM_HEADERS');
  reject(elf([{}]).subarray(0, 119), 'E_PROGRAM_HEADERS'); reject(elf([{ offset: maximum, size: 1n }]), 'E_RANGE');
});
test('memory, address overflow and alignment validation remain fixed', () => {
  reject(elf([{ size: 2n, memory: 1n }]), 'E_PROGRAM_HEADERS'); reject(elf([{ address: maximum, memory: 2n }]), 'E_RANGE');
  reject(elf([{ physical: maximum, memory: 2n }]), 'E_RANGE'); reject(elf([{ alignment: 3n }]), 'E_PROGRAM_HEADERS');
  reject(elf([{ offset: 2n, alignment: 4096n }]), 'E_PROGRAM_HEADERS');
});
for (const tag of [5n, 10n, 14n, 15n, 29n]) test('duplicate singleton tag ' + tag + ' fails', () => {
  reject(dynamic({ entries: [[tag, 1n], [tag, 1n], [0n, 0n]] }), 'E_DYNAMIC');
});
for (const entries of [[[5n, base + 2048n], [0n, 0n]], [[10n, 64n], [0n, 0n]], [[1n, 1n], [0n, 0n]],
  [[5n, base + 2048n], [10n, 0n], [0n, 0n]], [[5n, maximum], [10n, 2n], [0n, 0n]],
  [[5n, base + 2048n], [10n, 67108865n], [0n, 0n]]]) {
  test('invalid table pair, size or overflow ' + entries.map(e => e.join(':')).join(','), () => reject(dynamic({ entries }), 'E_STRING_TABLE'));
}
for (const loads of [[], [{ size: 8192n }, { size: 8192n }], [{ size: 1024n, memory: 8192n }], [{ size: 2050n }]]) {
  test('invalid file-backed table mapping ' + loads.length + ':' + String(loads[0]?.size), () => reject(dynamic({ loads }), 'E_STRING_TABLE'));
}
test('declared table cannot exceed available file bytes', () => reject(dynamic({ size: 65537, length: 8192 }), 'E_STRING_TABLE'));
test('dynamic segment bounds, count and termination remain fixed', () => {
  for (const dynamicSize of [0n, 1n, 17n, 16400n]) reject(dynamic({ dynamicSize, length: 20000 }), 'E_DYNAMIC');
  reject(dynamic({ entries: [[42n, 0n]] }), 'E_DYNAMIC'); reject(elf([{ type: 2 }, { type: 2 }]), 'E_DYNAMIC');
});
test('DT_NEEDED retains 32 entries and rejects a 33rd without widening output', () => {
  const entries = n => [[5n, base + 2048n], [10n, 33n], ...Array.from({ length: n }, () => [1n, 1n]), [0n, 0n]];
  assert.equal(inspect(dynamic({ entries: entries(32) })).dynamic.needed.length, 32);
  reject(dynamic({ entries: entries(33) }), 'E_DYNAMIC');
});
test('per-string bound remains 1024 bytes including NUL', () => {
  assert.equal(inspect(dynamic({ table: Buffer.from('\0' + 'a'.repeat(1023) + '\0') })).dynamic.needed[0].length, 1023);
  reject(dynamic({ table: Buffer.from('\0' + 'a'.repeat(1024) + '\0') }), 'E_STRING');
});
test('unterminated and out-of-span references fail even in a widened table', () => {
  reject(dynamic({ table: Buffer.from('\0abc') }), 'E_STRING');
  reject(dynamic({ entries: [[5n, base + 2048n], [10n, 33n], [1n, 33n], [0n, 0n]] }), 'E_STRING');
});
for (const value of [Buffer.from([255]), Buffer.from('a\nb'), Buffer.from('a\u007fb'), Buffer.alloc(0)]) {
  test('selected invalid string stays refused ' + value.toString('hex'), () => reject(dynamic({ table: Buffer.concat([Buffer.from([0]), value, Buffer.from([0])]) }), 'E_STRING'));
}
test('version tags and record caps remain unchanged', () => {
  const bytes = versioned(); bytes.writeBigUInt64LE(513n, 584); reject(bytes, 'E_VERSIONS');
  const missing = versioned(); missing.writeBigInt64LE(42n, 576); reject(missing, 'E_VERSIONS');
  const duplicate = versioned(); duplicate.writeBigInt64LE(0x6ffffffen, 592); reject(duplicate, 'E_VERSIONS');
});
for (const [at, value] of [[1024, 2], [1026, 0], [1280, 0], [1286, 1025]]) test('version field refusal ' + at, () => {
  const bytes = versioned(); bytes.writeUInt16LE(value, at); reject(bytes, 'E_VERSIONS');
});
test('version links, names and address mappings remain bounded', () => {
  for (const [at, value] of [[1032, 1], [1036, 16], [1068, 16], [1292, 1], [1296, 20]]) {
    const bytes = versioned(); bytes.writeUInt32LE(value, at); reject(bytes, 'E_VERSIONS');
  }
  const bytes = versioned(); bytes.writeUInt32LE(0xffffffff, 1064); reject(bytes, 'E_STRING');
});
test('interpreter caps and strict decoding remain unchanged', () => {
  const fixture = payload => { const bytes = elf([{ type: 3, offset: 256n, size: BigInt(payload.length) }]); payload.copy(bytes, 256); return bytes; };
  assert.equal(inspect(fixture(Buffer.from('a'.repeat(255) + '\0'))).interpreter.length, 255);
  for (const payload of [Buffer.from('a'.repeat(256) + '\0'), Buffer.from('abc'), Buffer.from([255, 0]), Buffer.from('a\nb\0')]) reject(fixture(payload), 'E_INTERPRETER');
  reject(elf([{ type: 3 }, { type: 3 }]), 'E_INTERPRETER');
});
test('note count and aggregate byte caps remain fixed', () => {
  assert.equal(inspect(withNotes(Buffer.concat(Array.from({ length: 128 }, () => note(42, Buffer.alloc(0)))))).requirements.notes.length, 128);
  reject(withNotes(Buffer.concat(Array.from({ length: 129 }, () => note(42, Buffer.alloc(0))))), 'E_NOTES');
  reject(withNotes(note(42, Buffer.alloc(65536))), 'E_NOTES');
});
test('build IDs, ABI and note padding retain validation', () => {
  assert.equal(inspect(withNotes(note(3, Buffer.alloc(64)))).requirements.buildIds[0].length, 128);
  for (const size of [0, 65]) reject(withNotes(note(3, Buffer.alloc(size))), 'E_NOTES');
  reject(withNotes(note(1, Buffer.alloc(15))), 'E_NOTES');
  const payload = note(42, Buffer.from([1])); payload[17] = 1; reject(withNotes(payload), 'E_NOTES');
});
test('property caps and known payload sizes remain fixed', () => {
  reject(withNotes(note(5, Buffer.alloc(4097))), 'E_PROPERTIES');
  const payload = Buffer.alloc(16); payload.writeUInt32LE(0xc0000002); payload.writeUInt32LE(3, 4);
  reject(withNotes(note(5, payload)), 'E_PROPERTIES');
});
test('default output ceiling still refuses oversized escaped metadata', () => {
  const table = Buffer.from('\0' + '"'.repeat(1023) + '\0');
  const entries = [[5n, base + 2048n], [10n, BigInt(table.length)], ...Array.from({ length: 32 }, () => [1n, 1n]), [0n, 0n]];
  const payload = Buffer.concat(Array.from({ length: 60 }, () => note(42, Buffer.alloc(0), Buffer.from('"'.repeat(500) + '\0'))));
  const bytes = dynamic({ table, entries, extra: [{ type: 4, offset: 4096n, size: BigInt(payload.length) }], length: 40000 });
  payload.copy(bytes, 4096); reject(bytes, 'E_OUTPUT');
});
test('final profile output recheck remains bounded and failures become fixed codes', t => {
  let calls = 0; const length = Buffer.byteLength;
  const mock = t.mock.method(Buffer, 'byteLength', (...args) => ++calls === 2 ? 131073 : length(...args));
  reject(elf([], 64), 'E_OUTPUT'); assert.equal(calls, 2); mock.mock.restore(); calls = 0;
  t.mock.method(Buffer, 'byteLength', (...args) => { if (++calls === 2) throw new Error('private'); return length(...args); });
  reject(elf([], 64), 'E_INPUT'); assert.equal(calls, 2);
});
test('failed parses do not poison later calls', () => { reject(Buffer.alloc(64), 'E_ELF'); assert.equal(inspect(dynamic()).dynamic.needed[0], 'libalpha.so'); });
