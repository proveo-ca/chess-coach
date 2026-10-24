// SPEC: _spec/tooling/native-ingress/elf-metadata.puml
import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const ELF_METADATA_LIMITS = Object.freeze({
  maxInputBytes: 1048576,
  maxProgramHeaders: 128,
  maxDynamicEntries: 1024,
  maxStringTableBytes: 65536,
  maxStringBytes: 1024,
  maxInterpreterBytes: 256,
  maxNeeded: 32,
  maxOutputBytes: 65536,
});

const errorCodes = Object.freeze([
  'E_INPUT', 'E_LIMITS', 'E_ELF', 'E_RANGE', 'E_PROGRAM_HEADERS',
  'E_INTERPRETER', 'E_DYNAMIC', 'E_STRING_TABLE', 'E_STRING', 'E_OUTPUT',
]);
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'length').get;
const typedBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer').get;
const typedOffset = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteOffset').get;
const arrayBufferResizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const addressLimit = 1n << 64n;

export class ElfMetadataError extends Error {
  constructor(code) {
    const fixedCode = errorCodes.includes(code) ? code : 'E_INPUT';
    super(fixedCode);
    this.name = 'ElfMetadataError';
    this.code = fixedCode;
    Object.freeze(this);
  }
}

function fail(code) {
  throw new ElfMetadataError(code);
}

function limitsFrom(overrides) {
  if (overrides === null || typeof overrides !== 'object' || types.isProxy(overrides)) fail('E_LIMITS');
  const prototype = Object.getPrototypeOf(overrides);
  if (prototype !== Object.prototype && prototype !== null) fail('E_LIMITS');
  const limits = { ...ELF_METADATA_LIMITS };
  for (const key of Reflect.ownKeys(overrides)) {
    if (typeof key !== 'string' || !Object.hasOwn(limits, key)) fail('E_LIMITS');
    const descriptor = Object.getOwnPropertyDescriptor(overrides, key);
    if (!Object.hasOwn(descriptor, 'value')) fail('E_LIMITS');
    const value = descriptor.value;
    if (!Number.isSafeInteger(value) || value < 1 || value > limits[key]) fail('E_LIMITS');
    limits[key] = value;
  }
  return limits;
}

function snapshotInput(bytes, limits) {
  if (types.isProxy(bytes) || !types.isUint8Array(bytes)) fail('E_INPUT');
  const prototype = Object.getPrototypeOf(bytes);
  if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) fail('E_INPUT');
  const length = typedLength.call(bytes);
  const backing = typedBuffer.call(bytes);
  const offset = typedOffset.call(bytes);
  if (types.isSharedArrayBuffer(backing) || (arrayBufferResizable && arrayBufferResizable.call(backing))) fail('E_INPUT');
  if (length < 64 || length > limits.maxInputBytes) fail('E_INPUT');
  const snapshot = new Uint8Array(length);
  snapshot.set(new Uint8Array(backing, offset, length));
  return snapshot;
}

function freezeTree(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

function inspect(snapshot, limits) {
  const view = new DataView(snapshot.buffer);
  const fileLength = BigInt(snapshot.length);
  const u16 = offset => view.getUint16(offset, true);
  const u32 = offset => view.getUint32(offset, true);
  const u64 = offset => view.getBigUint64(offset, true);
  const fileSpan = (offset, length, code) => {
    if (offset > fileLength || length > fileLength - offset) fail(code);
    return Number(offset);
  };
  const addressEnd = (address, length, code) => {
    const end = address + length;
    if (end > addressLimit) fail(code);
    return end;
  };
  if (snapshot[0] !== 0x7f || snapshot[1] !== 0x45 || snapshot[2] !== 0x4c || snapshot[3] !== 0x46 ||
    snapshot[4] !== 2 || snapshot[5] !== 1 || snapshot[6] !== 1 || u32(20) !== 1 ||
    u16(18) !== 62 || ![2, 3].includes(u16(16)) || u16(52) !== 64 || u16(54) !== 56) fail('E_ELF');
  const programHeaderOffset = u64(32);
  const programHeaderCount = u16(56);
  if (programHeaderCount === 65535 || programHeaderCount > limits.maxProgramHeaders) fail('E_PROGRAM_HEADERS');
  const programStart = fileSpan(programHeaderOffset, BigInt(programHeaderCount) * 56n, 'E_PROGRAM_HEADERS');
  const programHeaders = [];
  const loads = [];
  let interpreterSegment = null;
  let dynamicSegment = null;
  for (let index = 0; index < programHeaderCount; index++) {
    const at = programStart + index * 56;
    const type = u32(at);
    const flags = u32(at + 4);
    const offset = u64(at + 8);
    const virtualAddress = u64(at + 16);
    const physicalAddress = u64(at + 24);
    const fileBytes = u64(at + 32);
    const memoryBytes = u64(at + 40);
    const alignment = u64(at + 48);
    fileSpan(offset, fileBytes, 'E_RANGE');
    if (fileBytes > memoryBytes) fail('E_PROGRAM_HEADERS');
    addressEnd(virtualAddress, memoryBytes, 'E_RANGE');
    addressEnd(physicalAddress, memoryBytes, 'E_RANGE');
    if (alignment > 1n && (alignment & (alignment - 1n)) !== 0n) fail('E_PROGRAM_HEADERS');
    if (type === 1 && alignment > 1n && offset % alignment !== virtualAddress % alignment) fail('E_PROGRAM_HEADERS');
    const segment = { offset, virtualAddress, fileBytes };
    if (type === 1) loads.push(segment);
    if (type === 3) {
      if (interpreterSegment !== null) fail('E_INTERPRETER');
      interpreterSegment = segment;
    }
    if (type === 2) {
      if (dynamicSegment !== null) fail('E_DYNAMIC');
      dynamicSegment = segment;
    }
    programHeaders.push({
      index, type, flags,
      fileOffset: offset.toString(),
      virtualAddress: virtualAddress.toString(),
      physicalAddress: physicalAddress.toString(),
      fileBytes: fileBytes.toString(),
      memoryBytes: memoryBytes.toString(),
      alignment: alignment.toString(),
    });
  }
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const decodeText = (start, end, allowEmpty, code) => {
    if (!allowEmpty && start === end) fail(code);
    let text;
    try {
      text = decoder.decode(snapshot.subarray(start, end));
    } catch {
      fail(code);
    }
    if (/[\u0000-\u001f\u007f-\u009f]/u.test(text)) fail(code);
    return text;
  };
  let interpreter = null;
  if (interpreterSegment !== null) {
    const { offset, fileBytes } = interpreterSegment;
    if (fileBytes < 2n || fileBytes > BigInt(limits.maxInterpreterBytes)) fail('E_INTERPRETER');
    const start = Number(offset);
    const end = start + Number(fileBytes);
    if (snapshot[end - 1] !== 0) fail('E_INTERPRETER');
    interpreter = decodeText(start, end - 1, false, 'E_INTERPRETER');
  }
  const dynamic = {
    present: dynamicSegment !== null,
    declaredSlots: 0,
    activeEntries: 0,
    needed: [],
    soname: null,
    rpath: null,
    runpath: null,
    stringTable: null,
    unknownTags: [],
  };
  if (dynamicSegment !== null) {
    const { offset, fileBytes } = dynamicSegment;
    if (fileBytes === 0n || fileBytes % 16n !== 0n || fileBytes / 16n > BigInt(limits.maxDynamicEntries)) fail('E_DYNAMIC');
    dynamic.declaredSlots = Number(fileBytes / 16n);
    const needed = [];
    const singletons = new Map();
    let terminated = false;
    for (let index = 0; index < dynamic.declaredSlots; index++) {
      const at = Number(offset) + index * 16;
      const tag = view.getBigInt64(at, true);
      const value = u64(at + 8);
      dynamic.activeEntries++;
      if (tag === 0n) {
        terminated = true;
        break;
      }
      if (tag === 1n) {
        if (needed.length >= limits.maxNeeded) fail('E_DYNAMIC');
        needed.push(value);
      } else if ([5n, 10n, 14n, 15n, 29n].includes(tag)) {
        if (singletons.has(tag)) fail('E_DYNAMIC');
        singletons.set(tag, value);
      } else {
        dynamic.unknownTags.push({ tag: tag.toString(), value: value.toString() });
      }
    }
    if (!terminated) fail('E_DYNAMIC');
    const hasTable = singletons.has(5n);
    const hasSize = singletons.has(10n);
    const hasReferences = needed.length > 0 || [14n, 15n, 29n].some(tag => singletons.has(tag));
    if (hasTable !== hasSize || (hasReferences && !hasTable)) fail('E_STRING_TABLE');
    if (hasTable) {
      const address = singletons.get(5n);
      const size = singletons.get(10n);
      if (size < 1n || size > BigInt(limits.maxStringTableBytes)) fail('E_STRING_TABLE');
      const end = addressEnd(address, size, 'E_STRING_TABLE');
      const intersections = loads.filter(load => load.fileBytes > 0n &&
        load.virtualAddress < end && load.virtualAddress + load.fileBytes > address);
      if (intersections.length !== 1) fail('E_STRING_TABLE');
      const load = intersections[0];
      if (load.virtualAddress > address || load.virtualAddress + load.fileBytes < end) fail('E_STRING_TABLE');
      const tableOffset = load.offset + address - load.virtualAddress;
      const start = fileSpan(tableOffset, size, 'E_STRING_TABLE');
      dynamic.stringTable = { virtualAddress: address.toString(), byteLength: Number(size), fileOffset: tableOffset.toString() };
      const stringAt = (reference, allowEmpty) => {
        if (reference >= size) fail('E_STRING');
        const from = start + Number(reference);
        const bound = from + Math.min(Number(size - reference), limits.maxStringBytes);
        let until = from;
        while (until < bound && snapshot[until] !== 0) until++;
        if (until === bound) fail('E_STRING');
        return decodeText(from, until, allowEmpty, 'E_STRING');
      };
      dynamic.needed = needed.map(reference => stringAt(reference, false));
      for (const [tag, name, allowEmpty] of [[14n, 'soname', false], [15n, 'rpath', true], [29n, 'runpath', true]]) {
        if (singletons.has(tag)) dynamic[name] = stringAt(singletons.get(tag), allowEmpty);
      }
    }
  }
  const result = {
    profile: 'elf64le-x86-64-metadata-v1',
    state: 'ELF_METADATA',
    byteLength: snapshot.length,
    inputSha256: createHash('sha256').update(snapshot).digest('hex'),
    header: {
      type: u16(16), machine: 62, version: 1,
      osAbi: snapshot[7], abiVersion: snapshot[8],
      entryPoint: u64(24).toString(), flags: u32(48),
      programHeaderOffset: programHeaderOffset.toString(), programHeaderCount, programHeaderBytes: 56,
    },
    programHeaders,
    interpreter,
    dynamic,
    candidateExecuted: false,
    decoderQualified: false,
    realCandidateRead: false,
    realArchiveInspected: false,
    provenanceVerified: false,
    noPythonRuntimeVerified: false,
    loaderClosureVerified: false,
    nativeAuthority: false,
    nativeQualified: false,
    installedUsability: false,
    rustReady: false,
    trainingReady: false,
  };
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > limits.maxOutputBytes) fail('E_OUTPUT');
  return freezeTree(result);
}

export function inspectElf64(bytes, overrides = {}) {
  try {
    const limits = limitsFrom(overrides);
    return inspect(snapshotInput(bytes, limits), limits);
  } catch (error) {
    if (error instanceof ElfMetadataError) throw error;
    fail('E_INPUT');
  }
}
