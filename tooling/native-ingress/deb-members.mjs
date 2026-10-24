// SPEC: _spec/tooling/native-ingress/deb-members.puml
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import zlib from 'node:zlib';
import { createTarMemberInventory } from './tar-inventory.mjs';

export const DEB_MEMBER_LIMITS = Object.freeze({
  maxInputBytes: 8_388_608,
  maxDecodedBytes: 67_108_864,
  maxCompressedMemberBytes: 8_388_608,
  maxArMembers: 3,
  maxTargets: 8,
  maxZstdWindowLog: 26,
  maxZstdBlocks: 65_536,
  maxOutputBytes: 65_536,
});

export class DebMemberError extends Error {
  constructor(code) {
    super(code);
    this.name = 'DebMemberError';
    this.code = code;
    Object.freeze(this);
  }
}

const fail = (code) => { throw new DebMemberError(code); };
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length').get;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer').get;
const typedOffset = Object.getOwnPropertyDescriptor(typedPrototype, 'byteOffset').get;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable').get;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hashPattern = /^[0-9a-f]{64}$/;

function ownRecord(value, keys, code, exact = true) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) fail(code);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(code);
  const names = Reflect.ownKeys(value);
  if (exact && names.length !== keys.length) fail(code);
  const result = Object.create(null);
  for (const key of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !keys.includes(key) || !Object.hasOwn(descriptor, 'value')) fail(code);
    result[key] = descriptor.value;
  }
  if (exact && keys.some(key => !Object.hasOwn(result, key))) fail(code);
  return result;
}

function limitsFrom(overrides) {
  const values = ownRecord(overrides, Object.keys(DEB_MEMBER_LIMITS), 'E_LIMITS', false);
  const limits = { ...DEB_MEMBER_LIMITS };
  for (const key of Object.keys(values)) {
    const value = values[key];
    if (!Number.isSafeInteger(value) || value < 1 || value > limits[key]) fail('E_LIMITS');
    limits[key] = value;
  }
  return limits;
}

function reference(value, code) {
  const result = ownRecord(value, ['byteLength', 'sha256'], code);
  if (!Number.isSafeInteger(result.byteLength) || result.byteLength < 0 || result.byteLength > DEB_MEMBER_LIMITS.maxInputBytes ||
      typeof result.sha256 !== 'string' || result.sha256.length !== 64 || !hashPattern.test(result.sha256)) fail(code);
  return { byteLength: result.byteLength, sha256: result.sha256 };
}

function targetsFrom(value, limits) {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail('E_TARGETS');
  const length = Object.getOwnPropertyDescriptor(value, 'length').value;
  if (length < 1 || length > limits.maxTargets || Reflect.ownKeys(value).length !== length + 1) fail('E_TARGETS');
  const paths = new Set();
  const result = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('E_TARGETS');
    const record = ownRecord(descriptor.value, ['path', 'byteLength', 'sha256'], 'E_TARGETS');
    const path = record.path;
    if (typeof path !== 'string' || !path || Buffer.byteLength(path, 'utf8') > 1024 ||
        /[\u0000-\u001f\u007f-\u009f\\]/u.test(path) || /[\ud800-\udfff]/u.test(path) ||
        path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..') || paths.has(path)) fail('E_TARGETS');
    const ref = reference({ byteLength: record.byteLength, sha256: record.sha256 }, 'E_TARGETS');
    paths.add(path);
    result.push({ path, ...ref });
  }
  return result;
}

function snapshot(bytes, limit) {
  try {
    if (types.isProxy(bytes) || !types.isUint8Array(bytes)) fail('E_INPUT');
    const length = typedLength.call(bytes);
    const backing = typedBuffer.call(bytes);
    const offset = typedOffset.call(bytes);
    if (length < 8 || length > limit || types.isSharedArrayBuffer(backing) || resizable.call(backing)) fail('E_INPUT');
    return Buffer.from(new Uint8Array(backing, offset, length));
  } catch { fail('E_INPUT'); }
}

function arDecimal(bytes, optional = false) {
  const raw = bytes.toString('latin1');
  if (optional && bytes.every(byte => byte === 32)) return 0;
  if (!/^ *[0-9]+ *$/.test(raw) || /[^0-9 ]/.test(raw)) fail('E_AR');
  const value = Number(raw.trim());
  if (!Number.isSafeInteger(value)) fail('E_AR');
  return value;
}

function arData(bytes, limits) {
  if (!bytes.subarray(0, 8).equals(Buffer.from('!<arch>\n'))) fail('E_AR');
  const names = [];
  let offset = 8;
  let data;
  while (offset < bytes.length) {
    if (names.length >= limits.maxArMembers || bytes.length - offset < 60) fail('E_AR');
    const header = bytes.subarray(offset, offset + 60);
    if (header[58] !== 96 || header[59] !== 10) fail('E_AR');
    let name = header.subarray(0, 16).toString('latin1').replace(/ +$/, '');
    if (name.endsWith('/')) name = name.slice(0, -1);
    if (!name || /[^a-z0-9.-]/.test(name)) fail('E_AR');
    const allowed = names.length === 0 ? ['debian-binary'] : names.length === 1
      ? ['control.tar.zst', 'control.tar.gz', 'control.tar.xz'] : ['data.tar.zst', 'data.tar.gz'];
    if (!allowed.includes(name)) fail('E_UNSUPPORTED');
    arDecimal(header.subarray(16, 28), true);
    arDecimal(header.subarray(28, 34), true);
    arDecimal(header.subarray(34, 40), true);
    const mode = header.subarray(40, 48).toString('latin1');
    if (!/^ *(?:[0-7]+ *)?$/.test(mode) || /[^0-7 ]/.test(mode)) fail('E_AR');
    const size = arDecimal(header.subarray(48, 58));
    if (size > limits.maxCompressedMemberBytes) fail('E_AR');
    offset += 60;
    if (size > bytes.length - offset) fail('E_AR');
    const body = bytes.subarray(offset, offset + size);
    if (names.length === 0 && !body.equals(Buffer.from('2.0\n'))) fail('E_AR');
    if (names.length === 2) data = body;
    names.push(name);
    offset += size;
    if (size % 2) {
      if (offset === bytes.length || bytes[offset] !== 10) fail('E_AR');
      offset++;
    }
  }
  if (names.length !== 3) fail('E_AR');
  return { names, data, kind: names[2] === 'data.tar.gz' ? 'gzip' : 'zstd' };
}

function zstdFrame(bytes, limits) {
  let offset = 0;
  function take(count) {
    if (count > bytes.length - offset) fail('E_DECOMPRESS');
    const value = bytes.subarray(offset, offset + count);
    offset += count;
    return value;
  }
  function integer(count) {
    const value = take(count);
    let result = 0n;
    for (let i = value.length - 1; i >= 0; i--) result = result * 256n + BigInt(value[i]);
    return result;
  }
  if (integer(4) !== 0xfd2fb528n) fail('E_UNSUPPORTED');
  const descriptor = Number(integer(1));
  if (descriptor & 24) fail('E_UNSUPPORTED');
  const single = Boolean(descriptor & 32);
  let window;
  if (!single) {
    const wd = Number(integer(1));
    const base = 1n << BigInt(10 + (wd >> 3));
    window = base + (base >> 3n) * BigInt(wd & 7);
  }
  const dictionarySize = [0, 1, 2, 4][descriptor & 3];
  if (integer(dictionarySize) !== 0n) fail('E_UNSUPPORTED');
  const sizeFlag = descriptor >> 6;
  const sizeBytes = sizeFlag === 0 ? (single ? 1 : 0) : [0, 2, 4, 8][sizeFlag];
  let contentSize = sizeBytes ? integer(sizeBytes) : null;
  if (sizeFlag === 1) contentSize += 256n;
  if (single) window = contentSize;
  if (window > (1n << BigInt(limits.maxZstdWindowLog)) ||
      (contentSize !== null && contentSize > BigInt(limits.maxDecodedBytes))) fail('E_DECOMPRESS');
  let blocks = 0;
  let last;
  do {
    if (++blocks > limits.maxZstdBlocks) fail('E_DECOMPRESS');
    const header = Number(integer(3));
    last = Boolean(header & 1);
    const type = (header >> 1) & 3;
    const size = header >> 3;
    if (type === 3 || size > 131_072) fail('E_UNSUPPORTED');
    take(type === 1 ? 1 : size);
  } while (!last);
  if (descriptor & 4) take(4);
  if (offset !== bytes.length) fail('E_UNSUPPORTED');
  return contentSize;
}

function decode(data, kind, limits) {
  let result;
  let contentSize = null;
  if (kind === 'zstd') {
    if (typeof zlib.zstdDecompressSync !== 'function' || !Number.isInteger(zlib.constants.ZSTD_d_windowLogMax)) fail('E_UNSUPPORTED');
    contentSize = zstdFrame(data, limits);
  } else if (data.length < 3 || data[0] !== 31 || data[1] !== 139 || data[2] !== 8) fail('E_UNSUPPORTED');
  try {
    if (kind === 'zstd') {
      result = zlib.zstdDecompressSync(data, { maxOutputLength: limits.maxDecodedBytes,
        params: { [zlib.constants.ZSTD_d_windowLogMax]: limits.maxZstdWindowLog } });
    } else {
      const decoded = zlib.gunzipSync(data, { maxOutputLength: limits.maxDecodedBytes, info: true });
      if (decoded.engine.bytesWritten !== data.length) fail('E_DECOMPRESS');
      result = decoded.buffer;
    }
    if (!Buffer.isBuffer(result) || result.length > limits.maxDecodedBytes ||
        (contentSize !== null && BigInt(result.length) !== contentSize)) fail('E_DECOMPRESS');
  } catch { fail('E_DECOMPRESS'); }
  return result;
}

function freezeData(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freezeData(item);
    Object.freeze(value);
  }
  return value;
}

export function compareDebMembers(debBytes, expectedDebRef, expectedMembers, overrides = {}) {
  try {
    const limits = limitsFrom(overrides);
    const packageRef = reference(expectedDebRef, 'E_REFERENCE');
    const targets = targetsFrom(expectedMembers, limits);
    const bytes = snapshot(debBytes, limits.maxInputBytes);
    if (bytes.length !== packageRef.byteLength || digest(bytes) !== packageRef.sha256) fail('E_PACKAGE');
    const { names, data, kind } = arData(bytes, limits);
    const decoded = decode(data, kind, limits);
    let summary;
    try {
      const inventory = createTarMemberInventory({ maxExpandedBytes: limits.maxDecodedBytes });
      for (let offset = 0; offset < decoded.length; offset += 1_048_576) inventory.feed(decoded.subarray(offset, offset + 1_048_576));
      summary = inventory.finish();
    } catch { fail('E_TAR'); }
    const memberMatches = targets.map(target => {
      const span = summary.fileSpans.find(item => item.path === target.path);
      if (!span || span.size !== target.byteLength || span.bodyOffset > decoded.length || span.size > decoded.length - span.bodyOffset) fail('E_MEMBER');
      if (digest(decoded.subarray(span.bodyOffset, span.bodyOffset + span.size)) !== target.sha256) fail('E_MEMBER');
      return { ...target, matched: true };
    });
    const result = {
      state: 'DEB_MEMBER_COMPARISON',
      profile: 'deb-data-members-v1',
      packageRef,
      packageBytesMatched: true,
      memberMatches,
      dataCompression: kind,
      compressedBytes: data.length,
      decompressedBytes: decoded.length,
      arMemberNames: names,
      tarSummary: { headers: summary.headers, entries: summary.entries, metadataSha256: summary.metadataSha256 },
      archiveSignatureVerified: false,
      provenanceVerified: false,
      sourceAuthenticated: false,
      pythonFreeSubsetVerified: false,
      nativeQualified: false,
      decoderQualified: false,
      extractionAuthorized: false,
      maintainerScriptsExecuted: false,
      fileWritesPerformed: false,
      runtimeInvoked: false,
      installedUsability: false,
      rustReady: false,
      trainingReady: false,
    };
    if (Buffer.byteLength(JSON.stringify(result), 'utf8') > limits.maxOutputBytes) fail('E_OUTPUT');
    return freezeData(result);
  } catch (error) {
    if (error instanceof DebMemberError) throw error;
    fail('E_INTERNAL');
  }
}
