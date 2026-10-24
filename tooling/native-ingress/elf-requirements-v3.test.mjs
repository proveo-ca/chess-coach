// SPEC: _spec/tooling/native-ingress/elf-requirements-v3.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as original from './elf-metadata.mjs';
import {
  ELF_METADATA_LIMITS, ELF_REQUIREMENTS_LIMITS, ELF_REQUIREMENTS_V3_LIMITS,
  ElfMetadataError, inspectElf64, inspectElf64Requirements, inspectElf64RequirementsV3,
} from './elf-requirements-v3.mjs';

const base = 9007199254740993n;
const maximumU64 = (1n << 64n) - 1n;
const NEED = 0x6ffffffen;
const NEEDNUM = 0x6fffffffn;
const DEF = 0x6ffffffcn;
const DEFNUM = 0x6ffffffdn;
const negativeFlags = [
  'candidateExecuted', 'decoderQualified', 'realCandidateRead', 'realArchiveInspected',
  'provenanceVerified', 'noPythonRuntimeVerified', 'loaderClosureVerified', 'nativeAuthority',
  'nativeQualified', 'installedUsability', 'rustReady', 'trainingReady',
];
const requirementsFlags = [
  'symbolBindingsVerified', 'hardwareCompatibilityVerified', 'instructionCoverageVerified',
  'propertyEnforcementVerified', 'buildIdAuthenticated',
];
const appendedApi = `
export const ELF_REQUIREMENTS_V3_LIMITS = Object.freeze({
  ...ELF_REQUIREMENTS_LIMITS,
  maxInputBytes: 67108864,
});

export function inspectElf64RequirementsV3(bytes, overrides = {}) {
  try {
    const limits = limitsFrom(overrides, ELF_REQUIREMENTS_V3_LIMITS);
    const result = {
      ...inspect(snapshotInput(bytes, limits), limits, true),
      profile: 'elf64le-x86-64-requirements-v3',
    };
    if (Buffer.byteLength(JSON.stringify(result), 'utf8') > limits.maxOutputBytes) fail('E_OUTPUT');
    return Object.freeze(result);
  } catch (error) {
    if (error instanceof ElfMetadataError) throw error;
    fail('E_INPUT');
  }
}
`;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function elf(programs = [], length = 8192) {
  const bytes = Buffer.alloc(length);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]);
  bytes.writeUInt16LE(2, 16);
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
    chunks.push(chunk);
    length += chunk.length;
  }
  return { bytes: Buffer.concat(chunks), refs };
}

function dynamicFixture(options = {}) {
  const table = options.table ?? strings(['libalpha.so', 'GLIBC_2.17', 'SYNTH_1.0']).bytes;
  const entries = options.entries ?? [[5n, base + 2048n], [10n, BigInt(table.length)], [1n, 1n], [0n, 0n]];
  const length = options.length ?? Math.max(8192, 2048 + table.length);
  const payload = options.notes;
  const interpreter = options.interpreter;
  const programs = [
    ...(options.loads ?? [{ size: BigInt(length) }]),
    { type: 2, offset: 512n, size: options.dynamicSize ?? BigInt(entries.length * 16) },
    ...(interpreter ? [{ type: 3, offset: 1536n, size: BigInt(interpreter.length) }] : []),
    ...(payload ? [{ type: 4, offset: 4096n, size: BigInt(payload.length) }] : []),
  ];
  const bytes = elf(programs, length);
  entries.forEach(([tag, value], index) => {
    bytes.writeBigInt64LE(tag, 512 + index * 16);
    bytes.writeBigUInt64LE(value, 520 + index * 16);
  });
  table.copy(bytes, 2048);
  if (interpreter) interpreter.copy(bytes, 1536);
  if (payload) payload.copy(bytes, 4096);
  return bytes;
}

function versions(values = ['libalpha.so', 'GLIBC_2.17', 'SYNTH_1.0'], options = {}) {
  const table = strings(values);
  const entries = [
    [5n, base + 2048n], [10n, BigInt(table.bytes.length)], [1n, BigInt(table.refs[0])],
    [NEED, base + 1024n], [NEEDNUM, 1n], [DEF, base + 1280n], [DEFNUM, 1n], [0n, 0n],
  ];
  const bytes = dynamicFixture({ ...options, table: table.bytes, entries });
  bytes.writeUInt16LE(1, 1024);
  bytes.writeUInt16LE(1, 1026);
  bytes.writeUInt32LE(table.refs[0], 1028);
  bytes.writeUInt32LE(32, 1032);
  bytes.writeUInt32LE(0x12345678, 1056);
  bytes.writeUInt16LE(2, 1060);
  bytes.writeUInt16LE(0x8002, 1062);
  bytes.writeUInt32LE(table.refs[1], 1064);
  bytes.writeUInt16LE(1, 1280);
  bytes.writeUInt16LE(1, 1282);
  bytes.writeUInt16LE(7, 1284);
  bytes.writeUInt16LE(1, 1286);
  bytes.writeUInt32LE(0x90abcdef, 1288);
  bytes.writeUInt32LE(32, 1292);
  bytes.writeUInt32LE(table.refs[2], 1312);
  return bytes;
}

function note(type, descriptor, name = Buffer.from('GNU\0')) {
  const nameSize = Math.ceil(name.length / 4) * 4;
  const bytes = Buffer.alloc(12 + nameSize + Math.ceil(descriptor.length / 4) * 4);
  bytes.writeUInt32LE(name.length);
  bytes.writeUInt32LE(descriptor.length, 4);
  bytes.writeUInt32LE(type, 8);
  name.copy(bytes, 12);
  descriptor.copy(bytes, 12 + nameSize);
  return bytes;
}

function word(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

function property(type, payload) {
  const bytes = Buffer.alloc(8 + Math.ceil(payload.length / 8) * 8);
  bytes.writeUInt32LE(type);
  bytes.writeUInt32LE(payload.length, 4);
  payload.copy(bytes, 8);
  return bytes;
}

function notes(payload, programs = [{ type: 4, offset: 3072n, size: BigInt(payload.length) }]) {
  const bytes = elf(programs);
  payload.copy(bytes, 3072);
  return bytes;
}

function reject(bytes, code, overrides, api = inspectElf64RequirementsV3) {
  assert.throws(() => api(bytes, overrides), error => {
    assert.equal(error.name, 'ElfMetadataError');
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.equal(Object.isFrozen(error), true);
    assert.deepEqual(Object.keys(error).sort(), ['code', 'name']);
    assert.equal(Object.hasOwn(error, 'cause'), false);
    if (api === inspectElf64RequirementsV3) assert.ok(error instanceof ElfMetadataError);
    return true;
  });
}

function rejectParity(bytes, code, overrides) {
  for (const api of [original.inspectElf64Requirements, inspectElf64Requirements, inspectElf64RequirementsV3]) {
    reject(bytes, code, overrides, api);
  }
}

function parity(bytes, overrides) {
  const expected = original.inspectElf64Requirements(bytes, overrides);
  assert.deepEqual(inspectElf64Requirements(bytes, overrides), expected);
  const result = inspectElf64RequirementsV3(bytes, overrides);
  assert.deepEqual(result, { ...expected, profile: 'elf64le-x86-64-requirements-v3' });
  return result;
}

function frozenTree(value) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  assert.equal(ArrayBuffer.isView(value), false);
  assert.ok(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype);
  for (const child of Object.values(value)) frozenTree(child);
}

test('source preserves the pinned original byte body and appends only the fixed v3 API', async t => {
  const raw = await readFile(new URL('./elf-metadata.mjs', import.meta.url));
  assert.equal(raw.length, 19842);
  assert.equal(sha256(raw), 'b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85');
  const source = await readFile(new URL('./elf-requirements-v3.mjs', import.meta.url));
  const oldPointer = '// SPEC: _spec/tooling/native-ingress/elf-metadata.puml\n';
  const pointer = '// SPEC: _spec/tooling/native-ingress/elf-requirements-v3.puml\n';
  assert.ok(raw.toString('utf8').startsWith(oldPointer));
  const expected = Buffer.concat([Buffer.from(pointer), raw.subarray(Buffer.byteLength(oldPointer)), Buffer.from(appendedApi)]);
  assert.deepEqual(source, expected);
  assert.equal((raw.toString('utf8').match(/maxInputBytes: 4194304/g) ?? []).length, 1);
  const frozenPins = {
    'elf-metadata.mjs': 'b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85',
    'elf-metadata.test.mjs': 'c717327d5960e4c631497476fe7ee97778708bedfc69606a31a10fdeea2b31c3',
    'elf-requirements.test.mjs': '77d46252f3e86ee0ce0be0641e35541b747a2cf302ce2f30209315cf3bcad53c',
  };
  for (const name of [...Object.keys(frozenPins), 'elf-requirements-v3.mjs', 'elf-requirements-v3.test.mjs']) {
    const bytes = await readFile(new URL('./' + name, import.meta.url));
    if (Object.hasOwn(frozenPins, name)) assert.equal(sha256(bytes), frozenPins[name]);
    t.diagnostic(`${name}: ${bytes.length} bytes sha256 ${sha256(bytes)}`);
  }
});

test('source imports only crypto and util and has no dynamic authority or extra comments', async () => {
  const source = await readFile(new URL('./elf-requirements-v3.mjs', import.meta.url), 'utf8');
  assert.deepEqual([...source.matchAll(/^import .* from '([^']+)';$/gm)].map(match => match[1]), ['node:crypto', 'node:util']);
  assert.equal(/\b(?:process|fetch|require|eval|Function)\b|\bimport\s*\(/u.test(source), false);
  assert.equal(/node:(?:fs|net|http|https|child_process|worker_threads)/u.test(source), false);
  assert.equal(source.split('\n').filter(line => line.trim().startsWith('//')).length, 1);
  const tests = await readFile(new URL('./elf-requirements-v3.test.mjs', import.meta.url), 'utf8');
  assert.ok(tests.startsWith('// SPEC: _spec/tooling/native-ingress/elf-requirements-v3.puml\n'));
});

test('v3 frozen defaults change only the input ceiling without changing copied v1 or v2 limits', () => {
  assert.deepEqual(ELF_METADATA_LIMITS, original.ELF_METADATA_LIMITS);
  assert.deepEqual(ELF_REQUIREMENTS_LIMITS, original.ELF_REQUIREMENTS_LIMITS);
  assert.deepEqual(ELF_REQUIREMENTS_V3_LIMITS, { ...ELF_REQUIREMENTS_LIMITS, maxInputBytes: 67108864 });
  assert.equal(ELF_REQUIREMENTS_V3_LIMITS.maxStringTableBytes, 65536);
  assert.equal(ELF_REQUIREMENTS_V3_LIMITS.maxOutputBytes, 131072);
  for (const value of [ELF_METADATA_LIMITS, ELF_REQUIREMENTS_LIMITS, ELF_REQUIREMENTS_V3_LIMITS]) {
    assert.ok(Object.isFrozen(value));
    assert.throws(() => { value.maxInputBytes = 1; }, TypeError);
  }
});

test('v3 synchronously returns the same exact schema with a distinct profile and false assurances', () => {
  const bytes = elf([], 64);
  const result = parity(bytes);
  assert.equal(result instanceof Promise, false);
  assert.equal(result.state, 'ELF_REQUIREMENTS_METADATA');
  assert.deepEqual(Object.keys(result), Object.keys(original.inspectElf64Requirements(bytes)));
  for (const name of negativeFlags) assert.equal(result[name], false);
  for (const name of requirementsFlags) assert.equal(result.requirements[name], false);
  assert.equal(result.inputSha256, sha256(bytes));
  assert.equal(inspectElf64(bytes).profile, 'elf64le-x86-64-metadata-v1');
  assert.equal(Object.hasOwn(inspectElf64(bytes), 'requirements'), false);
});

test('populated dynamic, interpreter, version, note and property metadata match v2 except profile', () => {
  const payload = Buffer.concat([
    note(3, Buffer.from([0xab, 0xcd])),
    note(1, Buffer.concat([word(0), word(3), word(2), word(17)])),
    note(5, Buffer.concat([property(0xc0008002, word(0x8000000f)), property(0xc0000002, word(3))])),
  ]);
  const bytes = versions(undefined, { notes: payload, interpreter: Buffer.from('$ORIGIN/../ld.so\0') });
  const result = parity(bytes);
  assert.equal(result.interpreter, '$ORIGIN/../ld.so');
  assert.deepEqual(result.dynamic.needed, ['libalpha.so']);
  assert.deepEqual(result.requirements.versionNeeds, [{ file: 'libalpha.so', version: 1,
    aux: [{ name: 'GLIBC_2.17', hash: 0x12345678, flags: 2, other: 0x8002 }] }]);
  assert.deepEqual(result.requirements.versionDefinitions, [{ index: 7, flags: 1, hash: 0x90abcdef, names: ['SYNTH_1.0'] }]);
  assert.equal(result.programHeaders[0].virtualAddress, base.toString());
  assert.deepEqual(result.requirements.buildIds, ['abcd']);
  assert.deepEqual(result.requirements.abiTags, [{ osId: 0, major: 3, minor: 2, patch: 17 }]);
  assert.deepEqual(result.requirements.properties[0].labels, ['baseline', 'v2', 'v3', 'v4']);
  assert.equal(result.requirements.properties[0].unknownBits, 0x80000000);
  for (const name of negativeFlags) assert.equal(result[name], false);
  for (const name of requirementsFlags) assert.equal(result.requirements[name], false);
});

test('published results contain only deeply frozen plain metadata independent of later input mutation', () => {
  const bytes = versions();
  const result = inspectElf64RequirementsV3(bytes);
  const encoded = JSON.stringify(result);
  frozenTree(result);
  bytes.fill(0xff);
  assert.equal(JSON.stringify(result), encoded);
  assert.throws(() => { result.profile = 'changed'; }, TypeError);
  assert.throws(() => { result.requirements.versionNeeds[0].aux[0].name = 'changed'; }, TypeError);
  assert.throws(() => { result.programHeaders.push({}); }, TypeError);
});

test('v3 accepts exactly 64 MiB of synthetic ET_EXEC PT_LOAD bytes without granting authority', () => {
  const size = 67108864;
  const bytes = elf([{ size: BigInt(size) }], size);
  const result = inspectElf64RequirementsV3(bytes);
  assert.equal(result.byteLength, size);
  assert.equal(result.header.type, 2);
  assert.equal(result.programHeaders[0].fileBytes, String(size));
  assert.equal(result.inputSha256, sha256(bytes));
  for (const name of negativeFlags) assert.equal(result[name], false);
  for (const name of requirementsFlags) assert.equal(result.requirements[name], false);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 131072);
  for (const api of [original.inspectElf64, inspectElf64, original.inspectElf64Requirements, inspectElf64Requirements]) {
    reject(bytes, 'E_INPUT', undefined, api);
  }
});

test('v3 rejects 64 MiB plus one before snapshot copying or ELF header inspection', t => {
  const bytes = new Uint8Array(67108865);
  let copies = 0;
  t.mock.method(Uint8Array.prototype, 'set', () => { copies++; throw new Error('copy'); });
  reject(bytes, 'E_INPUT');
  assert.equal(copies, 0);
});

test('original and copied v1 still accept 1 MiB and reject one extra byte', () => {
  const bytes = elf([{ size: 1048576n }], 1048577);
  for (const api of [original.inspectElf64, inspectElf64]) {
    assert.equal(api(bytes.subarray(0, 1048576)).byteLength, 1048576);
    reject(bytes, 'E_INPUT', undefined, api);
    reject(elf([], 64), 'E_LIMITS', { maxInputBytes: 1048577 }, api);
  }
});

test('original and copied v2 still accept 4 MiB and reject one extra byte while v3 accepts it', () => {
  const bytes = elf([{ size: 4194304n }], 4194305);
  for (const api of [original.inspectElf64Requirements, inspectElf64Requirements]) {
    assert.equal(api(bytes.subarray(0, 4194304)).byteLength, 4194304);
    reject(bytes, 'E_INPUT', undefined, api);
    reject(elf([], 64), 'E_LIMITS', { maxInputBytes: 4194305 }, api);
  }
  assert.equal(inspectElf64RequirementsV3(bytes).byteLength, 4194305);
});

test('lowered input cap admits equality and rejects one over and all truncated ELF headers', () => {
  assert.equal(inspectElf64RequirementsV3(elf([], 64), { maxInputBytes: 64 }).byteLength, 64);
  reject(elf([], 65), 'E_INPUT', { maxInputBytes: 64 });
  for (const length of [0, 1, 7, 32, 63]) reject(Buffer.alloc(length), 'E_INPUT');
});

test('every v3 override remains lower-only and only v3 admits input ceilings above 4 MiB', () => {
  for (const [key, cap] of Object.entries(ELF_REQUIREMENTS_V3_LIMITS)) {
    reject(elf([], 64), 'E_LIMITS', { [key]: cap + 1 });
    assert.equal(inspectElf64RequirementsV3(elf([], 64), { [key]: cap }).byteLength, 64);
  }
  assert.equal(inspectElf64RequirementsV3(elf([], 64), { maxInputBytes: 4194305 }).byteLength, 64);
});

test('invalid numeric limit values retain fixed E_LIMITS errors', () => {
  for (const value of [0, -1, NaN, Infinity, 1.5, '64', 64n, null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    reject(elf([], 64), 'E_LIMITS', { maxInputBytes: value });
  }
});

test('nonordinary override records are refused without coercion', () => {
  for (const value of [null, [], 1, 'x', () => {}, Object.create({}), new Number(64)]) {
    reject(elf([], 64), 'E_LIMITS', value);
  }
});

test('null-prototype nonenumerable own-data overrides work without being retained', () => {
  const limits = Object.defineProperty(Object.create(null), 'maxInputBytes', { value: 64, writable: true });
  assert.equal(inspectElf64RequirementsV3(elf([], 64), limits).byteLength, 64);
  reject(elf([], 65), 'E_INPUT', limits);
  limits.maxInputBytes = 1;
  assert.equal(inspectElf64RequirementsV3(elf([], 64)).byteLength, 64);
});

test('accessor, callback, unknown and symbol limits fail without invoking supplied code', () => {
  let calls = 0;
  const callback = () => { calls++; throw new Error('private'); };
  reject(elf([], 64), 'E_LIMITS', Object.defineProperty({}, 'maxNotes', { get: callback }));
  for (const key of ['reader', 'resolve', 'callback', '__proto__', Symbol('limit')]) {
    reject(elf([], 64), 'E_LIMITS', Object.defineProperty({}, key, { value: callback }));
  }
  assert.equal(calls, 0);
});

test('proxy and revoked proxy overrides fail without triggering traps', () => {
  let calls = 0;
  const trap = () => { calls++; throw new Error('trap'); };
  reject(elf([], 64), 'E_LIMITS', new Proxy({}, { ownKeys: trap, getPrototypeOf: trap, get: trap }));
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  reject(elf([], 64), 'E_LIMITS', proxy);
  assert.equal(calls, 0);
});

test('proxy and revoked proxy inputs fail without triggering traps', () => {
  let calls = 0;
  const trap = () => { calls++; throw new Error('trap'); };
  reject(new Proxy(elf([], 64), { get: trap, getPrototypeOf: trap }), 'E_INPUT');
  const { proxy, revoke } = Proxy.revocable(elf([], 64), {});
  revoke();
  reject(proxy, 'E_INPUT');
  assert.equal(calls, 0);
});

test('native Uint8Array and Buffer offset spans bypass all input own getters', () => {
  let calls = 0;
  for (const asBuffer of [false, true]) {
    const backing = Buffer.alloc(128, 0xaa);
    elf([], 64).copy(backing, 32);
    const bytes = asBuffer ? backing.subarray(32, 96) : new Uint8Array(backing.buffer, backing.byteOffset + 32, 64);
    const expected = sha256(bytes);
    for (const key of ['length', 'buffer', 'byteOffset', 'byteLength', 'set', 'subarray', 'constructor', Symbol.iterator]) {
      Object.defineProperty(bytes, key, { get() { calls++; throw new Error('getter'); } });
    }
    const result = inspectElf64RequirementsV3(bytes);
    assert.equal(result.byteLength, 64);
    assert.equal(result.inputSha256, expected);
  }
  assert.equal(calls, 0);
});

test('non-native byte objects, subclasses and custom prototypes are refused without getters', () => {
  class CustomBytes extends Uint8Array {}
  for (const value of [null, undefined, 'ELF', {}, [], new ArrayBuffer(64), new DataView(new ArrayBuffer(64)),
    new Uint16Array(64), new Uint8ClampedArray(64), new CustomBytes(64)]) reject(value, 'E_INPUT');
  let calls = 0;
  const bytes = new Uint8Array(elf([], 64));
  Object.setPrototypeOf(bytes, Object.create(Uint8Array.prototype, { length: {
    get() { calls++; throw new Error('getter'); },
  } }));
  reject(bytes, 'E_INPUT');
  assert.equal(calls, 0);
});

test('shared Uint8Array and Buffer backing is refused before any copy', t => {
  const inputs = [new Uint8Array(new SharedArrayBuffer(64)), Buffer.from(new SharedArrayBuffer(64))];
  let copies = 0;
  t.mock.method(Uint8Array.prototype, 'set', () => { copies++; throw new Error('copy'); });
  for (const bytes of inputs) reject(bytes, 'E_INPUT');
  assert.equal(copies, 0);
});

test('resizable Uint8Array and Buffer backing is refused before any copy', t => {
  const backing = new ArrayBuffer(64, { maxByteLength: 128 });
  assert.equal(backing.resizable, true);
  const inputs = [new Uint8Array(backing), Buffer.from(backing)];
  let copies = 0;
  t.mock.method(Uint8Array.prototype, 'set', () => { copies++; throw new Error('copy'); });
  for (const bytes of inputs) reject(bytes, 'E_INPUT');
  assert.equal(copies, 0);
});

test('detached backing yields only a fixed E_INPUT error', () => {
  const bytes = new Uint8Array(elf([], 64));
  structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
  reject(bytes, 'E_INPUT');
});

test('all ELF identity and header field checks preserve v2 refusal behavior', () => {
  for (const [offset, value, width] of [[0, 0, 1], [1, 0, 1], [2, 0, 1], [3, 0, 1], [4, 1, 1],
    [5, 2, 1], [6, 2, 1], [20, 2, 4], [18, 183, 2], [16, 1, 2], [52, 63, 2], [54, 55, 2]]) {
    const bytes = elf([], 64);
    if (width === 1) bytes[offset] = value;
    if (width === 2) bytes.writeUInt16LE(value, offset);
    if (width === 4) bytes.writeUInt32LE(value, offset);
    rejectParity(bytes, 'E_ELF');
  }
  const bytes = elf([], 64);
  bytes.writeUInt16LE(3, 16);
  bytes.writeBigUInt64LE(maximumU64, 40);
  bytes.writeUInt16LE(65535, 60);
  assert.equal(parity(bytes).header.type, 3);
});

test('program header counts, spans, memory, alignment and u64 checks preserve v2 behavior', () => {
  assert.equal(parity(elf([{}, {}]), { maxProgramHeaders: 2 }).programHeaders.length, 2);
  rejectParity(elf([{}, {}]), 'E_PROGRAM_HEADERS', { maxProgramHeaders: 1 });
  const extended = elf();
  extended.writeUInt16LE(65535, 56);
  rejectParity(extended, 'E_PROGRAM_HEADERS');
  const truncated = elf([{}]).subarray(0, 119);
  rejectParity(truncated, 'E_PROGRAM_HEADERS');
  rejectParity(elf([{ offset: maximumU64, size: 1n }]), 'E_RANGE');
  rejectParity(elf([{ size: 2n, memory: 1n }]), 'E_PROGRAM_HEADERS');
  rejectParity(elf([{ address: maximumU64, memory: 2n }]), 'E_RANGE');
  rejectParity(elf([{ alignment: 3n }]), 'E_PROGRAM_HEADERS');
  rejectParity(elf([{ offset: 2n, alignment: 4096n }]), 'E_PROGRAM_HEADERS');
  assert.equal(parity(elf([{ address: maximumU64, memory: 1n }])).programHeaders[0].virtualAddress, maximumU64.toString());
});

test('interpreter byte ceilings, terminators, UTF-8, controls and duplicates preserve v2 checks', () => {
  const fixture = value => {
    const bytes = elf([{ type: 3, offset: 256n, size: BigInt(value.length) }]);
    value.copy(bytes, 256);
    return bytes;
  };
  assert.equal(parity(fixture(Buffer.from('abc\0')), { maxInterpreterBytes: 4 }).interpreter, 'abc');
  rejectParity(fixture(Buffer.from('abcd\0')), 'E_INTERPRETER', { maxInterpreterBytes: 4 });
  assert.equal(parity(fixture(Buffer.from('a'.repeat(255) + '\0'))).interpreter.length, 255);
  rejectParity(fixture(Buffer.from('a'.repeat(256) + '\0')), 'E_INTERPRETER');
  for (const value of [Buffer.from('abc'), Buffer.from('a\0b\0'), Buffer.from([0xff, 0]), Buffer.from('a\nb\0')]) {
    rejectParity(fixture(value), 'E_INTERPRETER');
  }
  rejectParity(elf([{ type: 3 }, { type: 3 }]), 'E_INTERPRETER');
});

test('dynamic entry ceilings, singleton duplication and termination preserve v2 checks', () => {
  const bytes = dynamicFixture({ entries: [[0n, 1n], [NEED, maximumU64]] });
  assert.equal(parity(bytes, { maxDynamicEntries: 2 }).dynamic.activeEntries, 1);
  rejectParity(bytes, 'E_DYNAMIC', { maxDynamicEntries: 1 });
  rejectParity(dynamicFixture({ entries: [[42n, 0n]] }), 'E_DYNAMIC');
  rejectParity(dynamicFixture({ entries: [[5n, 1n], [5n, 1n], [0n, 0n]] }), 'E_DYNAMIC');
  for (const dynamicSize of [0n, 1n, 17n]) rejectParity(dynamicFixture({ dynamicSize }), 'E_DYNAMIC');
  rejectParity(elf([{ type: 2 }, { type: 2 }]), 'E_DYNAMIC');
});

test('string table ceiling stays exactly 65536 with paired tags and unique file-backed mapping', () => {
  const table = Buffer.alloc(65536);
  table.set(Buffer.from('\0a\0'));
  assert.equal(parity(dynamicFixture({ table })).dynamic.stringTable.byteLength, 65536);
  rejectParity(dynamicFixture({ table: Buffer.alloc(65537) }), 'E_STRING_TABLE');
  rejectParity(dynamicFixture({ entries: [[5n, base + 2048n], [0n, 0n]] }), 'E_STRING_TABLE');
  rejectParity(dynamicFixture({ loads: [] }), 'E_STRING_TABLE');
  rejectParity(dynamicFixture({ loads: [{ size: 8192n }, { size: 8192n }] }), 'E_STRING_TABLE');
  rejectParity(dynamicFixture({ loads: [{ size: 1024n, memory: 8192n }] }), 'E_STRING_TABLE');
});

test('string and NEEDED ceilings still count NUL, UTF-8 bytes and ordered duplicates', () => {
  const table = strings(['é🙂']).bytes;
  assert.deepEqual(parity(dynamicFixture({ table }), { maxStringBytes: 7 }).dynamic.needed, ['é🙂']);
  rejectParity(dynamicFixture({ table }), 'E_STRING', { maxStringBytes: 6 });
  assert.equal(parity(dynamicFixture({ table: strings(['a'.repeat(1023)]).bytes })).dynamic.needed[0].length, 1023);
  rejectParity(dynamicFixture({ table: strings(['a'.repeat(1024)]).bytes }), 'E_STRING');
  const entries = [[5n, base + 2048n], [10n, BigInt(table.length)], [1n, 1n], [1n, 1n], [0n, 0n]];
  assert.deepEqual(parity(dynamicFixture({ table, entries }), { maxNeeded: 2 }).dynamic.needed, ['é🙂', 'é🙂']);
  rejectParity(dynamicFixture({ table, entries }), 'E_DYNAMIC', { maxNeeded: 1 });
});

test('version record and auxiliary budgets remain cumulative across needs and definitions', () => {
  const bytes = versions();
  assert.equal(parity(bytes, { maxVersionRecords: 2, maxVersionAux: 2 }).requirements.versionNeeds.length, 1);
  rejectParity(bytes, 'E_VERSIONS', { maxVersionRecords: 1 });
  rejectParity(bytes, 'E_VERSIONS', { maxVersionAux: 1 });
  for (const [at, count] of [[584, 0n], [584, 513n], [616, 513n]]) {
    const value = versions();
    value.writeBigUInt64LE(count, at);
    rejectParity(value, 'E_VERSIONS');
  }
});

test('version format, tag pairing, links, membership, overlap and mapping checks stay unchanged', () => {
  for (const [at, value, width] of [[1024, 2, 2], [1026, 0, 2], [1032, 1, 4], [1036, 16, 4],
    [1068, 16, 4], [1280, 0, 2], [1292, 1, 4], [1296, 20, 4], [1316, 8, 4], [1028, 13, 4]]) {
    const bytes = versions();
    if (width === 2) bytes.writeUInt16LE(value, at);
    if (width === 4) bytes.writeUInt32LE(value, at);
    rejectParity(bytes, 'E_VERSIONS');
  }
  const missing = versions();
  missing.writeBigInt64LE(42n, 576);
  rejectParity(missing, 'E_VERSIONS');
  const duplicate = versions();
  duplicate.writeBigInt64LE(NEED, 592);
  rejectParity(duplicate, 'E_VERSIONS');
  const overlapping = versions();
  overlapping.writeBigUInt64LE(base + 1056n, 600);
  rejectParity(overlapping, 'E_VERSIONS');
  const unmapped = versions();
  unmapped.writeBigUInt64LE(maximumU64, 568);
  rejectParity(unmapped, 'E_VERSIONS');
});

test('version strings keep strict bounds and decoding while literal names remain unqualified', () => {
  for (const value of ['', Buffer.from([0xff]), 'a\nb', 'a\u007fb', 'a\u0085b']) {
    rejectParity(versions(['libalpha.so', value, 'SYNTH_1.0']), 'E_STRING');
  }
  for (const at of [1028, 1064, 1312]) {
    const bytes = versions();
    bytes.writeUInt32LE(0xffffffff, at);
    rejectParity(bytes, 'E_STRING');
  }
  const result = parity(versions(['libalpha.so', 'GLIBC_PRIVATE', '\ufeffé🙂']));
  assert.equal(result.requirements.versionNeeds[0].aux[0].name, 'GLIBC_PRIVATE');
  assert.deepEqual(result.requirements.versionDefinitions[0].names, ['\ufeffé🙂']);
  assert.equal(result.requirements.symbolBindingsVerified, false);
});

test('note byte and count budgets deduplicate identical physical ranges but not separate notes', () => {
  const payload = note(3, word(1));
  const programs = [4, 0x6474e553].map(type => ({ type, offset: 3072n, size: BigInt(payload.length) }));
  assert.equal(parity(notes(payload, programs), { maxNotes: 1, maxNoteBytes: 20 }).requirements.notes.length, 1);
  rejectParity(notes(payload), 'E_NOTES', { maxNoteBytes: 19 });
  const twice = notes(Buffer.concat([payload, payload]));
  assert.equal(parity(twice, { maxNotes: 2 }).requirements.notes.length, 2);
  rejectParity(twice, 'E_NOTES', { maxNotes: 1 });
  rejectParity(twice, 'E_NOTES', { maxNoteBytes: 39 });
});

test('malformed note names, lengths, padding and overlapping segments preserve fixed errors', () => {
  for (const name of [Buffer.from([0]), Buffer.from('GNU!'), Buffer.from('G\0N\0'), Buffer.from([0xff, 0])]) {
    rejectParity(notes(note(42, word(1), name)), 'E_NOTES');
  }
  const payload = note(42, Buffer.from([1]));
  const badPadding = Buffer.from(payload);
  badPadding[17] = 1;
  rejectParity(notes(badPadding), 'E_NOTES');
  rejectParity(notes(payload.subarray(0, -1)), 'E_NOTES');
  rejectParity(notes(Buffer.concat([payload, Buffer.alloc(1)])), 'E_NOTES');
  rejectParity(notes(Buffer.concat([payload, payload]), [
    { type: 4, offset: 3072n, size: 40n }, { type: 4, offset: 3092n, size: 20n },
  ]), 'E_NOTES');
});

test('build-ID and ABI lengths, conflicting IDs and lower-only ID caps remain unchanged', () => {
  for (const length of [0, 65]) rejectParity(notes(note(3, Buffer.alloc(length))), 'E_NOTES');
  assert.equal(parity(notes(note(3, Buffer.alloc(64)))).requirements.buildIds[0].length, 128);
  assert.deepEqual(parity(notes(note(3, Buffer.from([0xab, 0xcd]))), { maxBuildIdBytes: 2 }).requirements.buildIds, ['abcd']);
  rejectParity(notes(note(3, Buffer.alloc(3))), 'E_NOTES', { maxBuildIdBytes: 2 });
  rejectParity(notes(Buffer.concat([note(3, word(1)), note(3, word(2))])), 'E_NOTES');
  for (const length of [0, 15, 17]) rejectParity(notes(note(1, Buffer.alloc(length))), 'E_NOTES');
});

test('property byte, count, known payload size and padding checks preserve v2 behavior', () => {
  const payload = property(0xc0008002, word(1));
  assert.equal(parity(notes(note(5, payload)), { maxPropertyBytes: 16 }).requirements.properties.length, 1);
  rejectParity(notes(note(5, payload)), 'E_PROPERTIES', { maxPropertyBytes: 15 });
  rejectParity(notes(note(5, Buffer.alloc(4097))), 'E_PROPERTIES');
  const pair = notes(note(5, Buffer.concat([property(42, Buffer.alloc(0)), property(43, Buffer.alloc(0))])));
  assert.equal(parity(pair, { maxNotes: 2 }).requirements.properties.length, 2);
  rejectParity(pair, 'E_PROPERTIES', { maxNotes: 1 });
  for (const size of [0, 3, 5, 8]) rejectParity(notes(note(5, property(0xc0000002, Buffer.alloc(size)))), 'E_PROPERTIES');
  payload[12] = 1;
  rejectParity(notes(note(5, payload)), 'E_PROPERTIES');
});

test('unknown note and property payloads stay bounded hashes without exposed raw descriptors', () => {
  const secret = Buffer.from('inert-descriptor-not-output');
  const bytes = notes(Buffer.concat([
    note(999, secret, Buffer.from('vendor\0')), note(5, property(0x12345678, secret)),
  ]));
  const result = parity(bytes);
  assert.equal(result.requirements.notes[0].sha256, sha256(secret));
  assert.deepEqual(result.requirements.properties, [{ type: 0x12345678, byteLength: secret.length, sha256: sha256(secret) }]);
  assert.equal(JSON.stringify(result).includes(secret.toString()), false);
  frozenTree(result);
});

test('output cap counts final v3 JSON UTF-8 bytes at equality and one byte over', () => {
  const bytes = versions(['libalpha.so', 'é🙂"\\', 'SYNTH_1.0']);
  const result = parity(bytes);
  const size = Buffer.byteLength(JSON.stringify(result), 'utf8');
  assert.ok(size > JSON.stringify(result).length);
  assert.deepEqual(inspectElf64RequirementsV3(bytes, { maxOutputBytes: size }), result);
  reject(bytes, 'E_OUTPUT', { maxOutputBytes: size - 1 });
});

test('unchanged default 131072-byte output cap refuses oversized escaped metadata', () => {
  const table = strings(['"'.repeat(1023)]).bytes;
  const entries = [[5n, base + 2048n], [10n, BigInt(table.length)],
    ...Array.from({ length: 32 }, () => [1n, 1n]), [0n, 0n]];
  const payload = Buffer.concat(Array.from({ length: 60 }, () => note(42, Buffer.alloc(0), Buffer.from('"'.repeat(500) + '\0'))));
  const bytes = dynamicFixture({ table, entries, notes: payload, length: 40000 });
  rejectParity(bytes, 'E_OUTPUT');
});

test('v3 takes exactly one ordinary private input snapshot before parsing', t => {
  const bytes = elf([{ size: 8192n }]);
  const set = Uint8Array.prototype.set;
  let copies = 0;
  t.mock.method(Uint8Array.prototype, 'set', function (source, offset) {
    copies++;
    assert.equal(Object.getPrototypeOf(this), Uint8Array.prototype);
    assert.equal(this.length, bytes.length);
    assert.notEqual(this.buffer, bytes.buffer);
    assert.equal(this.buffer instanceof SharedArrayBuffer, false);
    assert.equal(this.buffer.resizable, false);
    return Reflect.apply(set, this, [source, offset]);
  });
  assert.equal(inspectElf64RequirementsV3(bytes).byteLength, bytes.length);
  assert.equal(copies, 1);
});

test('v3 rechecks final encoding and normalizes unexpected final-encoding failures', t => {
  const bytes = elf([], 64);
  let calls = 0;
  const length = Buffer.byteLength;
  const mocked = t.mock.method(Buffer, 'byteLength', (...args) => ++calls === 2 ? 131073 : length(...args));
  reject(bytes, 'E_OUTPUT');
  assert.equal(calls, 2);
  mocked.mock.restore();
  calls = 0;
  t.mock.method(Buffer, 'byteLength', (...args) => {
    if (++calls === 2) throw new Error('private-runtime-detail');
    return length(...args);
  });
  reject(bytes, 'E_INPUT');
  assert.equal(calls, 2);
});

test('errors remain fixed frozen records and failures do not poison subsequent calls', () => {
  for (const code of ['E_INPUT', 'E_LIMITS', 'E_ELF', 'E_RANGE', 'E_PROGRAM_HEADERS', 'E_INTERPRETER',
    'E_DYNAMIC', 'E_STRING_TABLE', 'E_STRING', 'E_OUTPUT', 'E_VERSIONS', 'E_NOTES', 'E_PROPERTIES']) {
    const error = new ElfMetadataError(code);
    assert.equal(error.code, code);
    assert.equal(Object.isFrozen(error), true);
  }
  assert.equal(new ElfMetadataError('private-detail').code, 'E_INPUT');
  reject(versions(), 'E_OUTPUT', { maxOutputBytes: 1 });
  reject(Buffer.alloc(64), 'E_ELF');
  assert.equal(parity(versions()).requirements.versionNeeds[0].file, 'libalpha.so');
});
