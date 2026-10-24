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

export const ELF_REQUIREMENTS_LIMITS = Object.freeze({
  ...ELF_METADATA_LIMITS,
  maxInputBytes: 4194304,
  maxOutputBytes: 131072,
  maxVersionRecords: 512,
  maxVersionAux: 1024,
  maxNoteBytes: 65536,
  maxNotes: 128,
  maxBuildIdBytes: 64,
  maxPropertyBytes: 4096,
});

const errorCodes = Object.freeze([
  'E_INPUT', 'E_LIMITS', 'E_ELF', 'E_RANGE', 'E_PROGRAM_HEADERS',
  'E_INTERPRETER', 'E_DYNAMIC', 'E_STRING_TABLE', 'E_STRING', 'E_OUTPUT',
  'E_VERSIONS', 'E_NOTES', 'E_PROPERTIES',
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

function limitsFrom(overrides, defaults = ELF_METADATA_LIMITS) {
  if (overrides === null || typeof overrides !== 'object' || types.isProxy(overrides)) fail('E_LIMITS');
  const prototype = Object.getPrototypeOf(overrides);
  if (prototype !== Object.prototype && prototype !== null) fail('E_LIMITS');
  const limits = { ...defaults };
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

function inspect(snapshot, limits, requirementsProfile = false) {
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
  const noteSegments = [];
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
    if (requirementsProfile && [4, 0x6474e553].includes(type)) noteSegments.push(segment);
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
  const versionTags = new Map();
  const versionTagNumbers = [0x6ffffffen, 0x6fffffffn, 0x6ffffffcn, 0x6ffffffdn];
  const resolveSpan = (address, size, code) => {
    const end = addressEnd(address, size, code);
    const intersections = loads.filter(load => load.fileBytes > 0n &&
      load.virtualAddress < end && load.virtualAddress + load.fileBytes > address);
    if (intersections.length !== 1) fail(code);
    const load = intersections[0];
    if (load.virtualAddress > address || load.virtualAddress + load.fileBytes < end) fail(code);
    return fileSpan(load.offset + address - load.virtualAddress, size, code);
  };
  let versionStringAt = null;
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
        if (requirementsProfile && versionTagNumbers.includes(tag)) {
          if (versionTags.has(tag)) fail('E_VERSIONS');
          versionTags.set(tag, value);
        }
        dynamic.unknownTags.push({ tag: tag.toString(), value: value.toString() });
      }
    }
    if (!terminated) fail('E_DYNAMIC');
    const hasTable = singletons.has(5n);
    const hasSize = singletons.has(10n);
    const hasReferences = needed.length > 0 || [14n, 15n, 29n].some(tag => singletons.has(tag)) || versionTags.size > 0;
    if (hasTable !== hasSize || (hasReferences && !hasTable)) fail('E_STRING_TABLE');
    if (hasTable) {
      const address = singletons.get(5n);
      const size = singletons.get(10n);
      if (size < 1n || size > BigInt(limits.maxStringTableBytes)) fail('E_STRING_TABLE');
      const start = resolveSpan(address, size, 'E_STRING_TABLE');
      const tableOffset = BigInt(start);
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
      versionStringAt = reference => stringAt(reference, false);
      dynamic.needed = needed.map(reference => stringAt(reference, false));
      for (const [tag, name, allowEmpty] of [[14n, 'soname', false], [15n, 'rpath', true], [29n, 'runpath', true]]) {
        if (singletons.has(tag)) dynamic[name] = stringAt(singletons.get(tag), allowEmpty);
      }
    }
  }
  const result = {
    profile: requirementsProfile ? 'elf64le-x86-64-requirements-v2' : 'elf64le-x86-64-metadata-v1',
    state: requirementsProfile ? 'ELF_REQUIREMENTS_METADATA' : 'ELF_METADATA',
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
  if (requirementsProfile) {
    result.requirements = inspectRequirements(snapshot, limits, {
      u16, u32, addressEnd, resolveSpan, versionTags, versionStringAt, dynamic, noteSegments, decodeText,
    });
  }
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

export function inspectElf64Requirements(bytes, overrides = {}) {
  try {
    const limits = limitsFrom(overrides, ELF_REQUIREMENTS_LIMITS);
    return inspect(snapshotInput(bytes, limits), limits, true);
  } catch (error) {
    if (error instanceof ElfMetadataError) throw error;
    fail('E_INPUT');
  }
}

function inspectRequirements(snapshot, limits, context) {
  const { u16, u32, addressEnd, resolveSpan, versionTags, versionStringAt, dynamic, noteSegments, decodeText } = context;
  const requirements = {
    versionNeeds: [], versionDefinitions: [], notes: [], buildIds: [], abiTags: [], properties: [],
    symbolBindingsVerified: false, hardwareCompatibilityVerified: false,
    instructionCoverageVerified: false, propertyEnforcementVerified: false, buildIdAuthenticated: false,
  };
  const occupied = [];
  let recordCount = 0;
  let auxCount = 0;
  const versionSpan = (address, size) => {
    const end = addressEnd(address, BigInt(size), 'E_VERSIONS');
    const start = resolveSpan(address, BigInt(size), 'E_VERSIONS');
    if (occupied.some(span => (address < span.end && span.address < end) ||
      (start < span.start + span.size && span.start < start + size))) fail('E_VERSIONS');
    occupied.push({ address, end, start, size });
    return start;
  };
  const relative = (address, offset, minimum) => {
    if (offset < minimum) fail('E_VERSIONS');
    const next = addressEnd(address, BigInt(offset), 'E_VERSIONS');
    if (next === addressLimit) fail('E_VERSIONS');
    return next;
  };
  for (const [tag, countTag, definition] of [[0x6ffffffen, 0x6fffffffn, false], [0x6ffffffcn, 0x6ffffffdn, true]]) {
    if (versionTags.has(tag) !== versionTags.has(countTag)) fail('E_VERSIONS');
    if (!versionTags.has(tag)) continue;
    const count = versionTags.get(countTag);
    if (count < 1n || count > BigInt(limits.maxVersionRecords) ||
      BigInt(recordCount) + count > BigInt(limits.maxVersionRecords)) fail('E_VERSIONS');
    recordCount += Number(count);
    let address = versionTags.get(tag);
    for (let index = 0; index < Number(count); index++) {
      const size = definition ? 20 : 16;
      const at = versionSpan(address, size);
      if (u16(at) !== 1) fail('E_VERSIONS');
      const countAux = u16(at + (definition ? 6 : 2));
      if (countAux < 1 || countAux > limits.maxVersionAux - auxCount) fail('E_VERSIONS');
      auxCount += countAux;
      const item = definition ? { index: u16(at + 4), flags: u16(at + 2), hash: u32(at + 8), names: [] } :
        { file: versionStringAt(BigInt(u32(at + 4))), version: 1, aux: [] };
      if (!definition && !dynamic.needed.includes(item.file)) fail('E_VERSIONS');
      let auxAddress = relative(address, u32(at + (definition ? 12 : 8)), size);
      for (let auxIndex = 0; auxIndex < countAux; auxIndex++) {
        const auxSize = definition ? 8 : 16;
        const auxAt = versionSpan(auxAddress, auxSize);
        const name = versionStringAt(BigInt(u32(auxAt + (definition ? 0 : 8))));
        if (definition) item.names.push(name);
        else item.aux.push({ name, hash: u32(auxAt), flags: u16(auxAt + 4), other: u16(auxAt + 6) });
        const nextAux = u32(auxAt + (definition ? 4 : 12));
        if (auxIndex === countAux - 1) {
          if (nextAux !== 0) fail('E_VERSIONS');
        } else auxAddress = relative(auxAddress, nextAux, auxSize);
      }
      const next = u32(at + (definition ? 16 : 12));
      if (index === Number(count) - 1) {
        if (next !== 0) fail('E_VERSIONS');
      } else address = relative(address, next, size);
      (definition ? requirements.versionDefinitions : requirements.versionNeeds).push(item);
    }
  }
  const ranges = [];
  let noteBytes = 0n;
  let noteCount = 0;
  let propertyCount = 0;
  const sha256 = (start, end) => createHash('sha256').update(snapshot.subarray(start, end)).digest('hex');
  const zeroPadding = (start, end, code) => {
    for (let at = start; at < end; at++) if (snapshot[at] !== 0) fail(code);
  };
  const align = (size, boundary) => Math.ceil(size / boundary) * boundary;
  for (const segment of noteSegments) {
    if (segment.fileBytes === 0n) continue;
    const start = Number(segment.offset);
    const end = start + Number(segment.fileBytes);
    if (ranges.some(range => range.start === start && range.end === end)) continue;
    if (ranges.some(range => start < range.end && range.start < end)) fail('E_NOTES');
    noteBytes += segment.fileBytes;
    if (noteBytes > BigInt(limits.maxNoteBytes)) fail('E_NOTES');
    ranges.push({ start, end });
    let at = start;
    while (at < end) {
      if (end - at < 12 || ++noteCount > limits.maxNotes) fail('E_NOTES');
      const nameBytes = u32(at);
      const descBytes = u32(at + 4);
      const type = u32(at + 8);
      if (nameBytes < 1 || nameBytes > 1024) fail('E_NOTES');
      const nameAt = at + 12;
      const descAt = nameAt + align(nameBytes, 4);
      const next = descAt + align(descBytes, 4);
      if (next > end || snapshot[nameAt + nameBytes - 1] !== 0) fail('E_NOTES');
      const name = decodeText(nameAt, nameAt + nameBytes - 1, false, 'E_NOTES');
      zeroPadding(nameAt + nameBytes, descAt, 'E_NOTES');
      zeroPadding(descAt + descBytes, next, 'E_NOTES');
      requirements.notes.push({ fileOffset: String(at), name, type, byteLength: descBytes, sha256: sha256(descAt, descAt + descBytes) });
      if (nameBytes === 4 && name === 'GNU') {
        if (type === 3) {
          if (descBytes < 1 || descBytes > limits.maxBuildIdBytes) fail('E_NOTES');
          const id = Buffer.from(snapshot.subarray(descAt, descAt + descBytes)).toString('hex');
          if (requirements.buildIds.some(previous => previous !== id)) fail('E_NOTES');
          if (!requirements.buildIds.includes(id)) requirements.buildIds.push(id);
        } else if (type === 1) {
          if (descBytes !== 16) fail('E_NOTES');
          requirements.abiTags.push({ osId: u32(descAt), major: u32(descAt + 4), minor: u32(descAt + 8), patch: u32(descAt + 12) });
        } else if (type === 5) {
          if (descBytes < 8 || descBytes > limits.maxPropertyBytes) fail('E_PROPERTIES');
          const descEnd = descAt + descBytes;
          let propertyAt = descAt;
          while (propertyAt < descEnd) {
            if (descEnd - propertyAt < 8 || ++propertyCount > limits.maxNotes) fail('E_PROPERTIES');
            const propertyType = u32(propertyAt);
            const size = u32(propertyAt + 4);
            const payload = propertyAt + 8;
            const propertyNext = payload + align(size, 8);
            if (propertyNext > descEnd) fail('E_PROPERTIES');
            zeroPadding(payload + size, propertyNext, 'E_PROPERTIES');
            const property = { type: propertyType, byteLength: size };
            if ([0xc0008002, 0xc0000002].includes(propertyType)) {
              if (size !== 4) fail('E_PROPERTIES');
              const bits = u32(payload);
              const isa = propertyType === 0xc0008002;
              const labels = isa ? [[1, 'baseline'], [2, 'v2'], [4, 'v3'], [8, 'v4']] : [[1, 'IBT'], [2, 'SHSTK']];
              Object.assign(property, { bits, labels: labels.filter(([bit]) => (bits & bit) !== 0).map(([, label]) => label),
                unknownBits: (bits & ~(isa ? 15 : 3)) >>> 0 });
            } else property.sha256 = sha256(payload, payload + size);
            requirements.properties.push(property);
            propertyAt = propertyNext;
          }
        }
      }
      at = next;
    }
  }
  return requirements;
}
