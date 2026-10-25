// SPEC: _spec/tooling/native-ingress/step2.puml
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as old from './elf-requirements-v4.mjs';
import * as current from './elf-requirements-v5.mjs';

const { inspectElf64RequirementsV5: inspect, ELF_REQUIREMENTS_V5_LIMITS: limits } = current;
const base = 9007199254740993n, maximum = (1n << 64n) - 1n;
const MiB = 1024 * 1024;
const read = name => readFileSync(new URL('./' + name + '.mjs', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const appendix = `
export const ELF_REQUIREMENTS_V5_LIMITS = Object.freeze({
  ...ELF_REQUIREMENTS_V4_LIMITS,
  maxInputBytes: 268435456,
});

export function inspectElf64RequirementsV5(bytes) {
  try {
    if (arguments.length !== 1) fail('E_INPUT');
    const limits = ELF_REQUIREMENTS_V5_LIMITS;
    const result = {
      ...inspect(snapshotInput(bytes, limits), limits, true),
      profile: 'elf64le-x86-64-requirements-v5',
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
function definitions(records, aux = 1) {
  const stride = 20 + aux * 8;
  const bytes = dynamic({ entries: [[5n, base + 2048n], [10n, 34n],
    [0x6ffffffcn, base + 4096n], [0x6ffffffdn, BigInt(records)], [0n, 0n]], length: 4096 + records * stride });
  for (let i = 0; i < records; i++) {
    const at = 4096 + i * stride;
    bytes.writeUInt16LE(1, at); bytes.writeUInt16LE(i + 1, at + 4); bytes.writeUInt16LE(aux, at + 6);
    bytes.writeUInt32LE(20, at + 12); bytes.writeUInt32LE(i === records - 1 ? 0 : stride, at + 16);
    for (let j = 0; j < aux; j++) {
      bytes.writeUInt32LE(24, at + 20 + j * 8); bytes.writeUInt32LE(j === aux - 1 ? 0 : 8, at + 24 + j * 8);
    }
  }
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
function reject(bytes, code, api = inspect) {
  assert.throws(() => api(bytes), error => {
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

describe('synthetic V5 requirements, sequential fixtures', { concurrency: 1 }, () => {
  test('the entire pinned 21142-byte V4 source is an unchanged byte prefix', () => {
    const prior = read('elf-requirements-v4'), source = read('elf-requirements-v5');
    assert.equal(prior.length, 21142);
    assert.equal(sha(prior), 'f5a428aae91593853acfd289c4e91fb715ca530744defa2fe9447f6dda0602f3');
    assert.deepEqual(source.subarray(0, prior.length), prior);
    assert.deepEqual(source, Buffer.concat([prior, Buffer.from(appendix)]));
    for (const name of ['inspectElf64', 'inspectElf64Requirements', 'inspectElf64RequirementsV3', 'inspectElf64RequirementsV4']) {
      assert.equal(current[name].toString(), old[name].toString());
    }
  });
  test('source adds no filesystem, execution, network or dynamic-import authority', () => {
    const source = read('elf-requirements-v5').toString();
    assert.deepEqual([...source.matchAll(/^import .* from '([^']+)';$/gm)].map(m => m[1]), ['node:crypto', 'node:util']);
    assert.doesNotMatch(source, /\b(?:process|fetch|require|eval|Function)\b|\bimport\s*\(/);
    assert.equal(source.split('\n').filter(line => line.startsWith('//')).length, 1);
    assert.ok(source.indexOf('length > limits.maxInputBytes') < source.indexOf('const snapshot = new Uint8Array(length)'));
  });
  test('frozen V5 limits change only the static 256 MiB input cap', () => {
    assert.deepEqual(limits, { ...old.ELF_REQUIREMENTS_V4_LIMITS, maxInputBytes: 256 * MiB });
    assert.equal(Object.isFrozen(limits), true); assert.equal(inspect.length, 1);
    assert.throws(() => { limits.maxInputBytes = 1; }, TypeError);
    for (const key of ['ELF_METADATA_LIMITS', 'ELF_REQUIREMENTS_LIMITS', 'ELF_REQUIREMENTS_V3_LIMITS', 'ELF_REQUIREMENTS_V4_LIMITS']) {
      assert.deepEqual(current[key], old[key]); assert.equal(Object.isFrozen(current[key]), true);
    }
    assert.deepEqual(Object.keys(current).sort(), [...Object.keys(old), 'ELF_REQUIREMENTS_V5_LIMITS', 'inspectElf64RequirementsV5'].sort());
  });
  test('copied public APIs 1 through 4 retain their result and error behavior', () => {
    for (const name of ['inspectElf64', 'inspectElf64Requirements', 'inspectElf64RequirementsV3', 'inspectElf64RequirementsV4']) {
      for (const bytes of [elf([], 64), dynamic(), versioned()]) assert.deepEqual(current[name](bytes), old[name](bytes));
      reject(Buffer.alloc(64), 'E_ELF', current[name]);
    }
    for (const name of ['inspectElf64', 'inspectElf64Requirements', 'inspectElf64RequirementsV3']) {
      assert.deepEqual(current[name](elf([], 64), { maxInputBytes: 64 }), old[name](elf([], 64), { maxInputBytes: 64 }));
      assert.throws(() => current[name](elf([], 65), { maxInputBytes: 64 }), { code: 'E_INPUT' });
      assert.throws(() => current[name](elf([], 64), { maxStringBytes: 1025 }), { code: 'E_LIMITS' });
    }
    assert.throws(() => current.inspectElf64RequirementsV4(elf([], 64), {}), { code: 'E_INPUT' });
  });
  test('old V1 and V2 input ceilings remain 1 MiB and 4 MiB', () => {
    for (const [name, cap] of [['inspectElf64', MiB], ['inspectElf64Requirements', 4 * MiB]]) {
      const bytes = elf([], cap + 1);
      assert.equal(current[name](bytes.subarray(0, cap)).byteLength, cap);
      reject(bytes, 'E_INPUT', current[name]);
    }
  });
  test('copied V3 and V4 each keep the real 64 MiB input boundary', t => {
    let bytes = elf([], 64 * MiB + 1);
    try {
      for (const name of ['inspectElf64RequirementsV3', 'inspectElf64RequirementsV4']) {
        const capName = name === 'inspectElf64RequirementsV3' ? 'ELF_REQUIREMENTS_V3_LIMITS' : 'ELF_REQUIREMENTS_V4_LIMITS';
        assert.equal(current[capName].maxInputBytes, 64 * MiB);
        assert.equal(current[name](bytes.subarray(0, 64 * MiB)).byteLength, 64 * MiB);
      }
      t.mock.method(Uint8Array.prototype, 'set', () => assert.fail('old oversized snapshot copy'));
      for (const name of ['inspectElf64RequirementsV3', 'inspectElf64RequirementsV4']) reject(bytes, 'E_INPUT', current[name]);
    } finally { bytes = null; }
  });
  test('synchronous V5 results preserve the schema and all negative assurances', () => {
    const bytes = versioned(), result = inspect(bytes);
    assert.equal(result instanceof Promise, false);
    assert.deepEqual(result, { ...old.inspectElf64RequirementsV4(bytes), profile: 'elf64le-x86-64-requirements-v5' });
    assert.equal(result.inputSha256, sha(bytes)); assert.equal(result.state, 'ELF_REQUIREMENTS_METADATA');
    assert.equal(result.byteLength, bytes.length); assert.equal(result.header.entryPoint, '0');
    assert.deepEqual(result.dynamic.needed, ['libalpha.so']);
    assert.equal(result.requirements.versionNeeds[0].aux[0].name, 'GLIBC_2.17');
    assert.deepEqual(result.requirements.versionDefinitions[0].names, ['SYNTH_1.0']);
    for (const key of negativeFlags) assert.equal(result[key], false);
    for (const key of ['symbolBindingsVerified', 'hardwareCompatibilityVerified', 'instructionCoverageVerified',
      'propertyEnforcementVerified', 'buildIdAuthenticated']) assert.equal(result.requirements[key], false);
  });
  test('deeply frozen publication never mutates or retains mutable caller bytes', () => {
    const bytes = versioned(), digest = sha(bytes), result = inspect(bytes), text = JSON.stringify(result);
    assert.equal(sha(bytes), digest); frozen(result); bytes.fill(255);
    assert.equal(JSON.stringify(result), text); assert.throws(() => result.dynamic.needed.push('x'), TypeError);
  });
  for (const args of [[], [elf([], 64), undefined], [elf([], 64), {}], [elf([], 64), null],
    [elf([], 64), { maxInputBytes: 1 }], [elf([], 64), { profile: 'other' }], [elf([], 64), {}, {}]]) {
    test('fixed V5 rejects argument list ' + args.length + ':' + JSON.stringify(args.slice(1)), () => {
      assert.throws(() => inspect(...args), { code: 'E_INPUT' });
    });
  }
  test('extra arguments fail before touching hostile input or override objects', t => {
    const trap = () => assert.fail('argument trap'), bytes = new Proxy({}, { get: trap, getPrototypeOf: trap });
    const overrides = new Proxy({}, { get: trap, ownKeys: trap, getPrototypeOf: trap });
    t.mock.method(Uint8Array.prototype, 'set', () => assert.fail('argument copy'));
    assert.throws(() => inspect(bytes, overrides), { code: 'E_INPUT' });
  });
  for (const size of [65536, 65537, 16 * MiB]) test('bounded, file-backed string table accepts ' + size + ' declared bytes', t => {
    const bytes = dynamic({ size }); bytes.fill(255, 2100);
    const digest = sha(bytes), decode = TextDecoder.prototype.decode;
    let decodedBytes = 0, calls = 0;
    t.mock.method(TextDecoder.prototype, 'decode', function (input, ...args) {
      calls++; decodedBytes += input.length; assert.equal(input.length, Buffer.byteLength('libalpha.so'));
      return Reflect.apply(decode, this, [input, ...args]);
    });
    const result = inspect(bytes);
    assert.equal(result.dynamic.stringTable.byteLength, size); assert.equal(result.dynamic.stringTable.fileOffset, '2048');
    assert.equal(BigInt(result.dynamic.stringTable.virtualAddress), base + 2048n);
    assert.equal(decodedBytes, Buffer.byteLength('libalpha.so')); assert.equal(calls, 1);
    assert.equal(result.inputSha256, digest); assert.equal(sha(bytes), digest);
  });
  test('a referenced 17 MiB table still fails inside an input larger than the old 64 MiB cap', () => {
    let bytes = dynamic({ size: 17 * MiB, length: 64 * MiB + 1 });
    try {
      assert.equal(bytes.length > current.ELF_REQUIREMENTS_V4_LIMITS.maxInputBytes, true);
      assert.equal(17 * MiB, 16 * MiB + MiB); reject(bytes, 'E_STRING_TABLE');
    } finally { bytes = null; }
  });
  test('16 MiB plus one table byte fails even with complete file backing', () => reject(dynamic({ size: 16 * MiB + 1 }), 'E_STRING_TABLE'));
  test('a selected string can end at the final declared table byte', () => {
    const size = 16 * MiB, bytes = dynamic({ size, entries: [[5n, base + 2048n], [10n, BigInt(size)], [1n, BigInt(size - 2)], [0n, 0n]] });
    bytes[2048 + size - 2] = 97; assert.deepEqual(inspect(bytes).dynamic.needed, ['a']);
  });
  test('V3 retains the 64 KiB string table cap while V4 and V5 retain 16 MiB', () => {
    const bytes = dynamic({ size: 65537 });
    reject(bytes, 'E_STRING_TABLE', current.inspectElf64RequirementsV3);
    assert.equal(current.inspectElf64RequirementsV4(bytes).dynamic.stringTable.byteLength, 65537);
    assert.equal(inspect(bytes).dynamic.stringTable.byteLength, 65537);
  });
  for (const name of ['inspectElf64', 'inspectElf64Requirements', 'inspectElf64RequirementsV3', 'inspectElf64RequirementsV4', 'inspectElf64RequirementsV5']) {
    test(name + ' retains the 1024-byte referenced-name guard, not a reference-count limit', () => {
      const accepted = Buffer.from('\0' + 'a'.repeat(1023) + '\0'), refused = Buffer.from('\0' + 'a'.repeat(1024) + '\0');
      assert.equal(accepted.length - 1, 1024); assert.equal(refused.length - 1, 1025);
      assert.equal(Buffer.byteLength(current[name](dynamic({ table: accepted })).dynamic.needed[0]) + 1, 1024);
      reject(dynamic({ table: refused }), 'E_STRING', current[name]);
    });
  }
  test('string guards count encoded bytes rather than Unicode characters', () => {
    const text = 'é'.repeat(511) + 'a'; assert.equal(Buffer.byteLength(text), 1023);
    assert.deepEqual(inspect(dynamic({ table: Buffer.from('\0' + text + '\0') })).dynamic.needed, [text]);
    reject(dynamic({ table: Buffer.from('\0' + 'é'.repeat(512) + '\0') }), 'E_STRING');
  });
  for (const bytes of [null, undefined, 'ELF', {}, [], new ArrayBuffer(64), new DataView(new ArrayBuffer(64)),
    new Uint16Array(64), new Uint8ClampedArray(64), new (class extends Uint8Array {})(64)]) {
    test('unsafe input refuses ' + Object.prototype.toString.call(bytes) + ' before copying', t => {
      t.mock.method(Uint8Array.prototype, 'set', () => assert.fail('unsafe view copy')); reject(bytes, 'E_INPUT');
    });
  }
  test('proxy and revoked proxy inputs reject without any proxy traps or copying', t => {
    const bytes = elf([], 64), trap = () => assert.fail('proxy trap');
    const { proxy, revoke } = Proxy.revocable(bytes, {}); revoke();
    t.mock.method(Uint8Array.prototype, 'set', () => assert.fail('proxy copy'));
    reject(new Proxy(bytes, { get: trap, getPrototypeOf: trap, ownKeys: trap }), 'E_INPUT'); reject(proxy, 'E_INPUT');
  });
  test('custom prototype inputs reject without getters or copying', t => {
    const bytes = new Uint8Array(64);
    Object.setPrototypeOf(bytes, Object.create(Uint8Array.prototype, { length: { get() { assert.fail('length getter'); } } }));
    t.mock.method(Uint8Array.prototype, 'set', () => assert.fail('prototype copy')); reject(bytes, 'E_INPUT');
  });
  test('native Buffer and Uint8Array offset spans ignore caller size, backing and method getters', () => {
    for (const buffer of [false, true]) {
      const backing = Buffer.alloc(128); elf([], 64).copy(backing, 32);
      const bytes = buffer ? backing.subarray(32, 96) : new Uint8Array(backing.buffer, backing.byteOffset + 32, 64);
      const digest = sha(bytes);
      for (const key of ['length', 'buffer', 'byteOffset', 'byteLength', 'set', 'subarray', 'constructor', Symbol.iterator]) {
        Object.defineProperty(bytes, key, { get() { assert.fail('caller getter'); } });
      }
      assert.equal(inspect(bytes).byteLength, 64); assert.equal(inspect(bytes).inputSha256, digest);
    }
  });
  test('shared backing rejects Buffer and Uint8Array before copying or caller sizing', t => {
    const inputs = [new Uint8Array(new SharedArrayBuffer(64)), Buffer.from(new SharedArrayBuffer(64))];
    for (const bytes of inputs) Object.defineProperty(bytes, 'length', { get() { assert.fail('shared size'); } });
    t.mock.method(Uint8Array.prototype, 'set', () => assert.fail('shared copy'));
    for (const bytes of inputs) reject(bytes, 'E_INPUT');
  });
  test('resizable backing rejects Buffer and Uint8Array before copying or caller sizing', t => {
    const backing = new ArrayBuffer(64, { maxByteLength: 128 }); assert.equal(backing.resizable, true);
    const inputs = [new Uint8Array(backing), Buffer.from(backing)];
    for (const bytes of inputs) Object.defineProperty(bytes, 'length', { get() { assert.fail('resizable size'); } });
    t.mock.method(Uint8Array.prototype, 'set', () => assert.fail('resizable copy'));
    for (const bytes of inputs) reject(bytes, 'E_INPUT');
  });
  test('detached backing rejects before copying or caller sizing', t => {
    const bytes = new Uint8Array(elf([], 64)); structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
    Object.defineProperty(bytes, 'length', { get() { assert.fail('detached size'); } });
    t.mock.method(Uint8Array.prototype, 'set', () => assert.fail('detached copy')); reject(bytes, 'E_INPUT');
  });
  for (const size of [0, 1, 7, 32, 63]) test('truncated input of ' + size + ' bytes fails', () => reject(Buffer.alloc(size), 'E_INPUT'));
  for (const [at, value, width] of [[0, 0, 1], [4, 1, 1], [5, 2, 1], [6, 2, 1], [16, 1, 2], [18, 183, 2], [20, 2, 4], [52, 63, 2], [54, 55, 2]]) {
    test('invalid ELF header field at byte ' + at, () => {
      const bytes = elf([], 64); bytes['writeUInt' + (width * 8) + (width === 1 ? '' : 'LE')](value, at); reject(bytes, 'E_ELF');
    });
  }
  test('program-header cap, truncation and file offset overflow stay fixed', () => {
    assert.equal(inspect(elf(Array.from({ length: 128 }, () => ({ type: 0 })))).programHeaders.length, 128);
    reject(elf(Array.from({ length: 129 }, () => ({ type: 0 }))), 'E_PROGRAM_HEADERS');
    const bytes = elf(); bytes.writeUInt16LE(65535, 56); reject(bytes, 'E_PROGRAM_HEADERS');
    reject(elf([{}]).subarray(0, 119), 'E_PROGRAM_HEADERS'); reject(elf([{ offset: maximum, size: 1n }]), 'E_RANGE');
  });
  test('memory, virtual and physical overflow, and alignment checks stay fixed', () => {
    reject(elf([{ size: 2n, memory: 1n }]), 'E_PROGRAM_HEADERS'); reject(elf([{ address: maximum, memory: 2n }]), 'E_RANGE');
    reject(elf([{ physical: maximum, memory: 2n }]), 'E_RANGE'); reject(elf([{ alignment: 3n }]), 'E_PROGRAM_HEADERS');
    reject(elf([{ offset: 2n, alignment: 4096n }]), 'E_PROGRAM_HEADERS');
  });
  for (const tag of [5n, 10n, 14n, 15n, 29n]) test('duplicate dynamic singleton tag ' + tag + ' fails', () => {
    reject(dynamic({ entries: [[tag, 1n], [tag, 1n], [0n, 0n]] }), 'E_DYNAMIC');
  });
  for (const entries of [[[5n, base + 2048n], [0n, 0n]], [[10n, 64n], [0n, 0n]], [[1n, 1n], [0n, 0n]],
    [[5n, base + 2048n], [10n, 0n], [0n, 0n]], [[5n, maximum], [10n, 2n], [0n, 0n]]]) {
    test('invalid table pair, size or address ' + entries.map(e => e.join(':')).join(','), () => reject(dynamic({ entries }), 'E_STRING_TABLE'));
  }
  for (const loads of [[], [{ size: 8192n }, { size: 8192n }], [{ size: 1024n, memory: 8192n }], [{ size: 2050n }]]) {
    test('invalid file-backed mapping ' + loads.length + ':' + String(loads[0]?.size), () => reject(dynamic({ loads }), 'E_STRING_TABLE'));
  }
  test('declared table cannot cross the end of the input', () => reject(dynamic({ size: 65537, length: 8192 }), 'E_STRING_TABLE'));
  test('dynamic segment shape, duplicates and termination stay fixed', () => {
    for (const dynamicSize of [0n, 1n, 17n, 16400n]) reject(dynamic({ dynamicSize, length: 20000 }), 'E_DYNAMIC');
    reject(dynamic({ entries: [[42n, 0n]] }), 'E_DYNAMIC'); reject(elf([{ type: 2 }, { type: 2 }]), 'E_DYNAMIC');
  });
  test('dynamic entry budget counts 1024 slots including the terminator', () => {
    const bytes = elf([{ size: 20000n }, { type: 2, offset: 512n, size: 1024n * 16n }], 20000);
    for (let i = 0; i < 1023; i++) bytes.writeBigInt64LE(42n, 512 + i * 16);
    const result = inspect(bytes);
    assert.equal(result.dynamic.declaredSlots, 1024); assert.equal(result.dynamic.activeEntries, 1024);
    assert.equal(result.dynamic.unknownTags.length, 1023);
    bytes.writeBigUInt64LE(1025n * 16n, 64 + 56 + 32); bytes.writeBigUInt64LE(1025n * 16n, 64 + 56 + 40);
    reject(bytes, 'E_DYNAMIC');
  });
  test('DT_NEEDED accepts 32 references but not 33', () => {
    const entries = n => [[5n, base + 2048n], [10n, 34n], ...Array.from({ length: n }, () => [1n, 1n]), [0n, 0n]];
    assert.equal(inspect(dynamic({ entries: entries(32) })).dynamic.needed.length, 32);
    reject(dynamic({ entries: entries(33) }), 'E_DYNAMIC');
  });
  test('unterminated and out-of-span references stay refused', () => {
    reject(dynamic({ table: Buffer.from('\0abc') }), 'E_STRING');
    reject(dynamic({ entries: [[5n, base + 2048n], [10n, 34n], [1n, 34n], [0n, 0n]] }), 'E_STRING');
  });
  for (const value of [Buffer.from([255]), Buffer.from('a\nb'), Buffer.from('a\u007fb'), Buffer.alloc(0)]) {
    test('invalid referenced string ' + value.toString('hex') + ' fails strict decoding', () => reject(dynamic({ table: Buffer.concat([Buffer.from([0]), value, Buffer.from([0])]) }), 'E_STRING'));
  }
  test('version records accept 512 and reject 513', () => {
    assert.equal(inspect(definitions(512)).requirements.versionDefinitions.length, 512); reject(definitions(513), 'E_VERSIONS');
  });
  test('version auxiliary records accept 1024 and reject 1025', () => {
    assert.equal(inspect(definitions(1, 1024)).requirements.versionDefinitions[0].names.length, 1024);
    reject(definitions(1, 1025), 'E_VERSIONS');
  });
  test('missing or duplicate version tags stay refused', () => {
    const missing = versioned(); missing.writeBigInt64LE(42n, 576); reject(missing, 'E_VERSIONS');
    const duplicate = versioned(); duplicate.writeBigInt64LE(0x6ffffffen, 592); reject(duplicate, 'E_VERSIONS');
  });
  for (const [at, value] of [[1024, 2], [1026, 0], [1280, 0], [1286, 1025]]) test('invalid version field at ' + at, () => {
    const bytes = versioned(); bytes.writeUInt16LE(value, at); reject(bytes, 'E_VERSIONS');
  });
  test('version links, names and mappings stay bounded', () => {
    for (const [at, value] of [[1032, 1], [1036, 16], [1068, 16], [1292, 1], [1296, 20]]) {
      const bytes = versioned(); bytes.writeUInt32LE(value, at); reject(bytes, 'E_VERSIONS');
    }
    const bytes = versioned(); bytes.writeUInt32LE(0xffffffff, 1064); reject(bytes, 'E_STRING');
    const overflow = versioned(); overflow.writeBigUInt64LE(maximum, 568); reject(overflow, 'E_VERSIONS');
  });
  test('interpreter byte cap, duplicate detection and strict decoding stay fixed', () => {
    const fixture = payload => { const bytes = elf([{ type: 3, offset: 256n, size: BigInt(payload.length) }]); payload.copy(bytes, 256); return bytes; };
    assert.equal(inspect(fixture(Buffer.from('a'.repeat(255) + '\0'))).interpreter.length, 255);
    for (const payload of [Buffer.from('a'.repeat(256) + '\0'), Buffer.from('abc'), Buffer.from([255, 0]), Buffer.from('a\nb\0')]) reject(fixture(payload), 'E_INTERPRETER');
    reject(elf([{ type: 3 }, { type: 3 }]), 'E_INTERPRETER');
  });
  test('note count accepts 128 and rejects 129', () => {
    assert.equal(inspect(withNotes(Buffer.concat(Array.from({ length: 128 }, () => note(42, Buffer.alloc(0)))))).requirements.notes.length, 128);
    reject(withNotes(Buffer.concat(Array.from({ length: 129 }, () => note(42, Buffer.alloc(0))))), 'E_NOTES');
  });
  test('note aggregate bytes accept exactly 65536 and reject the next padded record size', () => {
    const accepted = note(42, Buffer.alloc(65520)), refused = note(42, Buffer.alloc(65521));
    assert.equal(accepted.length, 12 + 4 + 65520); assert.equal(accepted.length, 65536);
    assert.equal(refused.length, 12 + 4 + 4 * Math.ceil(65521 / 4));
    assert.equal(inspect(withNotes(accepted)).requirements.notes[0].byteLength, 65520); reject(withNotes(refused), 'E_NOTES');
  });
  test('note name byte caps and zero padding stay fixed', () => {
    assert.equal(inspect(withNotes(note(42, Buffer.alloc(0), Buffer.from('a'.repeat(1023) + '\0')))).requirements.notes[0].name.length, 1023);
    reject(withNotes(note(42, Buffer.alloc(0), Buffer.from('a'.repeat(1024) + '\0'))), 'E_NOTES');
    const payload = note(42, Buffer.from([1])); payload[17] = 1; reject(withNotes(payload), 'E_NOTES');
  });
  test('build ID limits, ABI fields and unauthenticated hashes stay fixed', () => {
    assert.equal(inspect(withNotes(note(3, Buffer.alloc(64)))).requirements.buildIds[0].length, 128);
    for (const size of [0, 65]) reject(withNotes(note(3, Buffer.alloc(size))), 'E_NOTES');
    reject(withNotes(note(1, Buffer.alloc(15))), 'E_NOTES');
    assert.deepEqual(inspect(withNotes(note(1, Buffer.alloc(16)))).requirements.abiTags, [{ osId: 0, major: 0, minor: 0, patch: 0 }]);
  });
  test('property bytes accept 4096 and reject 4097', () => {
    const payload = Buffer.alloc(4096); payload.writeUInt32LE(42); payload.writeUInt32LE(4088, 4);
    const properties = inspect(withNotes(note(5, payload))).requirements.properties;
    assert.deepEqual(properties, [{ type: 42, byteLength: 4088, sha256: sha(payload.subarray(8)) }]);
    reject(withNotes(note(5, Buffer.alloc(4097))), 'E_PROPERTIES');
    const known = Buffer.alloc(16); known.writeUInt32LE(0xc0000002); known.writeUInt32LE(3, 4);
    reject(withNotes(note(5, known)), 'E_PROPERTIES');
  });
  test('property count accepts 128 but refuses 129', () => {
    const fixture = count => { const payload = Buffer.alloc(count * 8); for (let i = 0; i < count; i++) payload.writeUInt32LE(42, i * 8); return withNotes(note(5, payload)); };
    assert.equal(inspect(fixture(128)).requirements.properties.length, 128); reject(fixture(129), 'E_PROPERTIES');
  });
  test('the 131072-byte output ceiling uses actual UTF-8 JSON expansion equations', () => {
    const name = '"'.repeat(1023), table = Buffer.from('\0' + name + '\0x\0');
    const fixture = (count, reference) => {
      const entries = [[5n, base + 2048n], [10n, BigInt(table.length)], ...Array.from({ length: 32 }, () => [1n, BigInt(reference)]), [0n, 0n]];
      const payload = Buffer.concat(Array.from({ length: count }, () => note(42, Buffer.alloc(0), Buffer.from('"'.repeat(500) + '\0'))));
      const bytes = dynamic({ table, entries, extra: [{ type: 4, offset: 4096n, size: BigInt(payload.length) }], length: 40000 });
      payload.copy(bytes, 4096); return bytes;
    };
    const accepted = inspect(fixture(50, 1)), serialized = Buffer.byteLength(JSON.stringify(accepted), 'utf8');
    assert.ok(serialized > 120000); assert.ok(serialized <= 131072);
    const baseline = inspect(fixture(60, 1025));
    const expanded = { ...baseline, dynamic: { ...baseline.dynamic, needed: Array(32).fill(name) } };
    const baselineBytes = Buffer.byteLength(JSON.stringify(baseline), 'utf8');
    const expandedBytes = Buffer.byteLength(JSON.stringify(expanded), 'utf8');
    assert.equal(Buffer.byteLength(name) + 1, 1024); assert.equal(JSON.stringify(name).length, 2 * 1023 + 2);
    assert.equal(expandedBytes, baselineBytes + 32 * (JSON.stringify(name).length - JSON.stringify('x').length));
    assert.ok(expandedBytes > 131072); reject(fixture(60, 1), 'E_OUTPUT');
  });
  test('final profile output recheck and unexpected failures retain fixed error codes', t => {
    let calls = 0; const length = Buffer.byteLength;
    const mock = t.mock.method(Buffer, 'byteLength', (...args) => ++calls === 2 ? 131073 : length(...args));
    reject(elf([], 64), 'E_OUTPUT'); assert.equal(calls, 2); mock.mock.restore(); calls = 0;
    t.mock.method(Buffer, 'byteLength', (...args) => { if (++calls === 2) throw new Error('private'); return length(...args); });
    reject(elf([], 64), 'E_INPUT'); assert.equal(calls, 2);
  });
  test('failed parses leave later calls usable', () => { reject(Buffer.alloc(64), 'E_ELF'); assert.deepEqual(inspect(dynamic()).dynamic.needed, ['libalpha.so']); });
  test('REAL 256 MiB boundary: one actual input and one actual owned snapshot copy', t => {
    let bytes = dynamic({ length: 256 * MiB });
    try {
      assert.equal(bytes.length, 268435456); assert.equal(Buffer.isBuffer(bytes), true);
      const digest = sha(bytes), set = Uint8Array.prototype.set; let copies = 0;
      t.mock.method(Uint8Array.prototype, 'set', function (input, offset) {
        copies++; assert.equal(this.length, 268435456); assert.equal(input.length, 268435456);
        assert.notEqual(this.buffer, bytes.buffer); assert.equal(input.buffer, bytes.buffer);
        return Reflect.apply(set, this, [input, offset]);
      });
      const result = inspect(bytes);
      assert.equal(copies, 1); assert.equal(result.byteLength, 268435456);
      assert.equal(result.profile, 'elf64le-x86-64-requirements-v5'); assert.equal(result.inputSha256, digest);
      assert.deepEqual(result.dynamic.needed, ['libalpha.so']); assert.equal(sha(bytes), digest);
      assert.equal(result.programHeaders[0].fileBytes, '268435456');
      assert.equal(result.dynamic.stringTable.byteLength, 34);
      t.diagnostic('Executed a real 256 MiB Buffer and owned 256 MiB copy: 512 MiB payload plus Node/test overhead; not an RSS bound or hardware guarantee.');
    } finally { bytes = null; }
  });
  test('REAL 256 MiB plus one input rejects before any snapshot copy', t => {
    let bytes = Buffer.allocUnsafe(256 * MiB + 1);
    try {
      assert.equal(bytes.length, 268435457); assert.equal(Buffer.isBuffer(bytes), true);
      let copies = 0;
      t.mock.method(Uint8Array.prototype, 'set', () => { copies++; assert.fail('oversized copy'); });
      reject(bytes, 'E_INPUT'); assert.equal(copies, 0);
      t.diagnostic('Independent unfilled 256 MiB + 1 input; previous fixture releases references without asserting GC. No oversized snapshot copy.');
    } finally { bytes = null; }
  });
  test('handoff file pins', t => {
    for (const name of ['elf-requirements-v5', 'elf-requirements-v5.test']) {
      const bytes = read(name); t.diagnostic(name + '.mjs bytes=' + bytes.length + ' sha256=' + sha(bytes));
    }
  });
});
