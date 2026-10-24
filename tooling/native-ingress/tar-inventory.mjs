// SPEC: _spec/tooling/native-ingress/inventory.puml
import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const INVENTORY_LIMITS = Object.freeze({
  maxExpandedBytes: 1_073_741_824,
  maxHeaders: 65_536,
  maxExtensionBytes: 65_536,
  maxPathBytes: 1024,
  maxLinkBytes: 1024,
  maxEventBytes: 32_768,
  maxOutputBytes: 16_777_216,
  maxCollisionBytes: 33_554_432,
  maxChunkBytes: 1_048_576,
  maxDataEvents: 32_768,
});

export class InventoryError extends Error {
  constructor(code, cause) {
    super(code);
    this.name = 'InventoryError';
    this.code = code;
    if (cause !== undefined) Object.defineProperty(this, 'cause', { value: cause });
    Object.freeze(this);
  }
}

const fail = (code) => { throw new InventoryError(code); };
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length').get;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer').get;
const typedOffset = Object.getOwnPropertyDescriptor(typedPrototype, 'byteOffset').get;
const byteLength = (text) => Buffer.byteLength(text, 'utf8');
const zero = (bytes) => bytes.every((byte) => byte === 0);
const paxKeys = new Set(['path', 'linkpath', 'size', 'uid', 'gid', 'uname', 'gname', 'mtime']);
const negativeFlags = Object.freeze({
  extractionAuthorized: false,
  pythonFreeSubsetVerified: false,
  installedUsability: false,
  rustReady: false,
  trainingReady: false,
  nativeQualified: false,
  provenanceVerified: false,
});

function limitsFrom(overrides) {
  if (!overrides || typeof overrides !== 'object' || types.isProxy(overrides)) fail('E_LIMITS');
  const prototype = Object.getPrototypeOf(overrides);
  if (prototype !== Object.prototype && prototype !== null) fail('E_LIMITS');
  const limits = { ...INVENTORY_LIMITS };
  for (const key of Reflect.ownKeys(overrides)) {
    const descriptor = Object.getOwnPropertyDescriptor(overrides, key);
    if (typeof key !== 'string' || !Object.hasOwn(limits, key) || !Object.hasOwn(descriptor, 'value')) fail('E_LIMITS');
    const value = descriptor.value;
    if (!Number.isSafeInteger(value) || value < 1 || value > limits[key]) fail('E_LIMITS');
    limits[key] = value;
  }
  return Object.freeze(limits);
}

function text(bytes) {
  let value;
  try { value = decoder.decode(bytes); } catch { fail('E_UTF8'); }
  if (/[\u0000-\u001f\u007f-\u009f\\]/u.test(value)) fail('E_TEXT');
  return value;
}

function field(bytes) {
  const end = bytes.indexOf(0);
  if (end < 0) return text(bytes);
  if (!zero(bytes.subarray(end))) fail('E_TEXT');
  return text(bytes.subarray(0, end));
}

function number(bytes, base256 = true) {
  let value = 0n;
  if (bytes[0] & 0x80) {
    if (!base256 || bytes[0] & 0x40) fail('E_NUMBER');
    value = BigInt(bytes[0] & 0x7f);
    for (let i = 1; i < bytes.length; i++) value = value * 256n + BigInt(bytes[i]);
  } else {
    const raw = String.fromCharCode(...bytes);
    const octal = raw.match(/^ *([0-7]+) *(?:\0[ \0]*)?$/);
    if (!octal || octal[0].length !== raw.length) fail('E_NUMBER');
    value = BigInt(`0o${octal[1]}`);
  }
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail('E_NUMBER');
  return Number(value);
}

function decimal(value, mtime = false) {
  if (value.length > 32 || !(mtime ? /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/ : /^(?:0|[1-9][0-9]*)$/).test(value)) fail('E_PAX_NUMBER');
  const integer = BigInt(value.split('.')[0]);
  if (integer > BigInt(Number.MAX_SAFE_INTEGER) || integer < -BigInt(Number.MAX_SAFE_INTEGER)) fail('E_PAX_NUMBER');
  if (mtime) return value;
  return Number(value);
}

function pax(bytes) {
  const result = Object.create(null);
  let offset = 0;
  while (offset < bytes.length) {
    let space = offset;
    while (space < bytes.length && bytes[space] !== 32) {
      if (bytes[space] < 48 || bytes[space] > 57 || space - offset >= 10) fail('E_PAX');
      space++;
    }
    if (space === offset || space === bytes.length || bytes[offset] === 48) fail('E_PAX');
    const length = Number(bytes.subarray(offset, space).toString('ascii'));
    const end = offset + length;
    if (!Number.isSafeInteger(length) || end > bytes.length || end <= space + 2 || bytes[end - 1] !== 10) fail('E_PAX');
    const body = bytes.subarray(space + 1, end - 1);
    const equals = body.indexOf(61);
    if (equals < 1) fail('E_PAX');
    const key = text(body.subarray(0, equals));
    if (!paxKeys.has(key)) fail('E_PAX_KEY');
    if (Object.hasOwn(result, key)) fail('E_PAX_DUPLICATE');
    const value = text(body.subarray(equals + 1));
    if (value !== '' && ['size', 'uid', 'gid', 'mtime'].includes(key)) decimal(value, key === 'mtime');
    result[key] = value;
    offset = end;
  }
  return result;
}

function canonicalPath(value, directory, limit) {
  if (!value || byteLength(value) > limit) fail('E_PATH');
  if (directory && (value === '.' || value === './')) return '.';
  let path = value.startsWith('./') ? value.slice(2) : value;
  if (directory && path.endsWith('/')) path = path.slice(0, -1);
  if (!path || path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.split('/').some((part) => part === '' || part === '.' || part === '..')) fail('E_PATH');
  return path;
}

export function createTarInventory(overrides = {}) {
  return createInventory(overrides, false, 0);
}

export function createTarMemberInventory(overrides = {}, maxSpanBytes = 4_194_304) {
  if (!Number.isSafeInteger(maxSpanBytes) || maxSpanBytes < 1 || maxSpanBytes > 4_194_304) fail('E_LIMITS');
  return createInventory(overrides, true, maxSpanBytes);
}

function createInventory(overrides, trackSpans, maxSpanBytes) {
  const limits = limitsFrom(overrides);
  const hash = createHash('sha256');
  const collisions = new Set();
  const header = Buffer.alloc(512);
  let phase = 'header';
  let headerUsed = 0;
  let zeroBlocks = 0;
  let trailingBytes = 0;
  let bodyRemaining = 0;
  let paddingRemaining = 0;
  let extension = null;
  let extensionUsed = 0;
  let extensionType = null;
  let globalPax = Object.create(null);
  let localPax = null;
  let longPath = null;
  let longLink = null;
  let error = null;
  let sealed = false;
  let expandedBytes = 0;
  let headers = 0;
  let entries = 0;
  let extensionBytes = 0;
  let outputBytes = 0;
  let collisionBytes = 0;
  let dataEvents = 0;
  let consumedBytes = 0;
  let spanBytes = 2;
  const fileSpans = [];

  function guard() {
    if (error) throw error;
    if (sealed) fail('E_SEALED');
  }

  function absorb(cause) {
    error = cause instanceof InventoryError ? cause : new InventoryError('E_INTERNAL');
    extension = null;
    localPax = null;
    globalPax = Object.create(null);
    longPath = null;
    longLink = null;
    collisions.clear();
    fileSpans.length = 0;
    throw error;
  }

  function endBody() {
    if (extension !== null) {
      if (extensionType === 'x' || extensionType === 'g') {
        const record = pax(extension);
        if (extensionType === 'x') localPax = record;
        else {
          for (const [key, value] of Object.entries(record)) {
            if (value === '') delete globalPax[key];
            else globalPax[key] = value;
          }
        }
      } else {
        if (extension.length < 2 || extension[extension.length - 1] !== 0 || extension.subarray(0, -1).includes(0)) fail('E_GNU_LONG');
        const value = text(extension.subarray(0, -1));
        if (extensionType === 'L') longPath = value;
        else longLink = value;
      }
      extension = null;
    }
    phase = paddingRemaining ? 'padding' : 'header';
  }

  function parseHeader(events) {
    if (zero(header)) {
      zeroBlocks++;
      if (zeroBlocks === 2) {
        if (localPax !== null || longPath !== null || longLink !== null) fail('E_DANGLING_EXTENSION');
        phase = 'trailing';
      }
      return;
    }
    if (zeroBlocks) fail('E_TERMINATOR');
    if (++headers > limits.maxHeaders) fail('E_HEADERS');
    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : header[i];
    if (checksum !== number(header.subarray(148, 156), false)) fail('E_CHECKSUM');
    const magic = header.subarray(257, 263);
    const version = header.subarray(263, 265);
    const posix = magic.equals(Buffer.from('ustar\0')) && version.equals(Buffer.from('00'));
    const gnu = magic.equals(Buffer.from('ustar ')) && version.equals(Buffer.from(' \0'));
    if (!posix && !gnu && !(zero(magic) && zero(version))) fail('E_MAGIC');
    let path = field(header.subarray(0, 100));
    if (posix) {
      const prefix = field(header.subarray(345, 500));
      if (prefix) path = `${prefix}/${path}`;
    }
    const mode = number(header.subarray(100, 108));
    let uid = number(header.subarray(108, 116));
    let gid = number(header.subarray(116, 124));
    let size = number(header.subarray(124, 136));
    let mtime = String(number(header.subarray(136, 148)));
    if (size > limits.maxExpandedBytes) fail('E_SIZE');
    const type = String.fromCharCode(header[156]);
    let linkpath = field(header.subarray(157, 257));
    field(header.subarray(265, 297));
    field(header.subarray(297, 329));
    if (['x', 'g', 'L', 'K'].includes(type)) {
      if ((type === 'x' && localPax !== null) || (type === 'L' && longPath !== null) || (type === 'K' && longLink !== null)) fail('E_EXTENSION_REPEAT');
      if (size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');
      extensionBytes += size;
      extension = Buffer.alloc(size);
      extensionUsed = 0;
      extensionType = type;
    } else {
      const kind = { '0': 'file', '\0': 'file', '5': 'directory', '1': 'hardlink', '2': 'symlink' }[type];
      if (!kind) fail('E_TYPE');
      const effective = { ...globalPax };
      if (longPath !== null) effective.path = longPath;
      if (longLink !== null) effective.linkpath = longLink;
      if (localPax !== null) {
        for (const [key, value] of Object.entries(localPax)) {
          if (value === '') delete effective[key];
          else effective[key] = value;
        }
      }
      if (effective.path !== undefined) path = effective.path;
      if (effective.linkpath !== undefined) linkpath = effective.linkpath;
      if (effective.size !== undefined) size = decimal(effective.size);
      if (effective.uid !== undefined) uid = decimal(effective.uid);
      if (effective.gid !== undefined) gid = decimal(effective.gid);
      if (effective.mtime !== undefined) mtime = decimal(effective.mtime, true);
      if (size > limits.maxExpandedBytes) fail('E_SIZE');
      if (kind !== 'file' && size !== 0) fail('E_NONFILE_BODY');
      const key = canonicalPath(path, kind === 'directory', limits.maxPathBytes);
      if (byteLength(linkpath) > limits.maxLinkBytes) fail('E_LINK');
      if (collisions.has(key)) fail('E_COLLISION');
      const keyBytes = byteLength(key);
      if (keyBytes > limits.maxCollisionBytes - collisionBytes) fail('E_COLLISION_BYTES');
      const event = { index: entries + 1, path: key, type: kind, size };
      if (kind === 'symlink' || kind === 'hardlink') {
        if (!linkpath) fail('E_LINK');
        event.linkpath = linkpath;
        event.linkKind = linkpath.startsWith('/') || /^[A-Za-z]:/.test(linkpath)
          ? 'absolute' : linkpath.split('/').includes('..') ? 'parent-components' : 'relative';
      }
      event.mode = mode;
      event.uid = uid;
      event.gid = gid;
      event.mtime = mtime;
      const serialized = `${JSON.stringify(event)}\n`;
      const eventBytes = byteLength(serialized);
      if (eventBytes > limits.maxEventBytes) fail('E_EVENT_BYTES');
      if (eventBytes > limits.maxOutputBytes - outputBytes) fail('E_OUTPUT_BYTES');
      if (trackSpans && kind === 'file') {
        const span = { index: entries + 1, path: key, bodyOffset: consumedBytes, size };
        const cost = byteLength(JSON.stringify(span)) + (fileSpans.length ? 1 : 0);
        if (cost > maxSpanBytes - spanBytes) fail('E_SPAN_BYTES');
        spanBytes += cost;
        fileSpans.push(Object.freeze(span));
      }
      collisions.add(key);
      collisionBytes += keyBytes;
      entries++;
      outputBytes += eventBytes;
      hash.update(serialized, 'utf8');
      events.push(Object.freeze(event));
      localPax = null;
      longPath = null;
      longLink = null;
    }
    bodyRemaining = size;
    paddingRemaining = (512 - size % 512) % 512;
    phase = 'body';
    if (!bodyRemaining) endBody();
  }

  function feed(bytes) {
    guard();
    try {
      if (types.isProxy(bytes) || !types.isUint8Array(bytes)) fail('E_CHUNK');
      const length = typedLength.call(bytes);
      const backing = typedBuffer.call(bytes);
      const offset = typedOffset.call(bytes);
      if (types.isSharedArrayBuffer(backing)) fail('E_CHUNK');
      if (!length || length > limits.maxChunkBytes) fail('E_CHUNK');
      if (dataEvents >= limits.maxDataEvents) fail('E_DATA_EVENTS');
      if (length > limits.maxExpandedBytes - expandedBytes) fail('E_EXPANDED_BYTES');
      const copy = Buffer.from(new Uint8Array(backing, offset, length));
      dataEvents++;
      expandedBytes += length;
      const events = [];
      let cursor = 0;
      while (cursor < copy.length) {
        if (phase === 'trailing') {
          if (!zero(copy.subarray(cursor))) fail('E_TRAILING');
          trailingBytes += copy.length - cursor;
          consumedBytes += copy.length - cursor;
          break;
        }
        if (phase === 'header') {
          const count = Math.min(512 - headerUsed, copy.length - cursor);
          copy.copy(header, headerUsed, cursor, cursor + count);
          headerUsed += count;
          cursor += count;
          consumedBytes += count;
          if (headerUsed === 512) {
            headerUsed = 0;
            parseHeader(events);
          }
        } else if (phase === 'body') {
          const count = Math.min(bodyRemaining, copy.length - cursor);
          if (extension !== null) {
            copy.copy(extension, extensionUsed, cursor, cursor + count);
            extensionUsed += count;
          }
          bodyRemaining -= count;
          cursor += count;
          consumedBytes += count;
          if (!bodyRemaining) endBody();
        } else {
          const count = Math.min(paddingRemaining, copy.length - cursor);
          if (!zero(copy.subarray(cursor, cursor + count))) fail('E_PADDING');
          paddingRemaining -= count;
          cursor += count;
          consumedBytes += count;
          if (!paddingRemaining) phase = 'header';
        }
      }
      return Object.freeze(events);
    } catch (cause) { return absorb(cause); }
  }

  function finish() {
    guard();
    try {
      if (phase !== 'trailing' || trailingBytes % 512) fail('E_TRUNCATED');
      if (trackSpans && spanBytes > maxSpanBytes) fail('E_SPAN_BYTES');
      sealed = true;
      return Object.freeze({
        state: trackSpans ? 'TAR_MEMBER_INVENTORY' : 'TAR_INVENTORY',
        mockOnly: false,
        decoderQualified: false,
        realArchiveInspected: false,
        ...negativeFlags,
        expandedBytes,
        headers,
        entries,
        extensionBytes,
        outputBytes,
        collisionBytes,
        dataEvents,
        metadataSha256: hash.digest('hex'),
        ...(trackSpans ? { fileSpans: Object.freeze(fileSpans) } : {}),
      });
    } catch (cause) { return absorb(cause); }
  }

  return Object.freeze({ feed, finish });
}
