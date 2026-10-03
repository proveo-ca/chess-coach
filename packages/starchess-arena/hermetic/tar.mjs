// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { evidenceLimits } from './evidence-limits.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const utf8 = new TextDecoder('utf-8', { fatal: true });
const fail = (message) => { throw new Error(`Invalid tar evidence: ${message}`); };
export function evidenceBudget(limits = evidenceLimits) {
  return { limits, scan: 0, retained: 0, metadata: 0, entries: 0 };
}
function charge(budget, field, bytes, maximum) {
  budget[field] += bytes;
  if (budget[field] > maximum) fail(`${field} resource limit`);
}
function text(bytes) {
  const end = bytes.indexOf(0);
  if (end !== -1 && bytes.subarray(end).some((byte) => byte !== 0)) fail('nonzero string terminator');
  return utf8.decode(end === -1 ? bytes : bytes.subarray(0, end));
}
function number(bytes, binary = true) {
  if (bytes[0] & 0x80) {
    if (!binary || bytes[0] & 0x40) fail('negative or binary numeric field');
    let value = BigInt(bytes[0] & 0x7f);
    for (const byte of bytes.subarray(1)) value = value * 256n + BigInt(byte);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail('numeric overflow');
    return Number(value);
  }
  const value = bytes.toString('ascii');
  if (!/^[ \0]*[0-7]*[ \0]*$/.test(value)) fail('malformed numeric field');
  const result = parseInt(value.replace(/[ \0]/g, '') || '0', 8);
  if (!Number.isSafeInteger(result)) fail('numeric overflow');
  return result;
}
export function archivePath(value, limits = evidenceLimits) {
  if (typeof value !== 'string' || Buffer.byteLength(value) > limits.pathBytes || /[\x00-\x1f\x7f\\]/.test(value) || value.startsWith('/')) fail('unsafe path');
  while (value.startsWith('./')) value = value.slice(2);
  if (value.endsWith('/')) value = value.slice(0, -1);
  if (!value || value.split('/').some((part) => !part || part === '.' || part === '..')) fail('unsafe path');
  return value;
}
function pax(bytes, limits) {
  const result = Object.create(null);
  let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(32, offset);
    if (space < 0 || space - offset > 12) fail('PAX length');
    const lengthText = bytes.subarray(offset, space).toString('ascii');
    if (!/^[1-9][0-9]*$/.test(lengthText)) fail('PAX length');
    const length = Number(lengthText);
    const end = offset + length;
    if (!Number.isSafeInteger(length) || end > bytes.length || end <= space + 2 || bytes[end - 1] !== 10) fail('PAX truncation');
    const record = utf8.decode(bytes.subarray(space + 1, end - 1));
    const equals = record.indexOf('=');
    if (equals <= 0) fail('PAX record');
    const key = record.slice(0, equals);
    if (Object.hasOwn(result, key)) fail('duplicate PAX key');
    result[key] = record.slice(equals + 1);
    if (['path', 'linkpath'].includes(key) && Buffer.byteLength(result[key]) > limits.pathBytes) fail('PAX path limit');
    offset = end;
  }
  return result;
}

async function checkedFile(path, limits, action) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size > limits.archiveBytes) fail('archive size or file type');
    const result = await action(file, before.size);
    const after = await file.stat();
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) fail('archive changed during scan');
    return result;
  } finally { await file.close(); }
}

export async function scanTarFile(path, { limits = evidenceLimits, budget = evidenceBudget(limits), retain = () => false, inspect, finish } = {}) {
  return checkedFile(path, limits, async (file, size) => {
    const whole = createHash('sha256');
    let position = 0;
    const read = async (length) => {
      if (position + length > size) fail('truncated archive');
      charge(budget, 'scan', length, limits.scanBytes);
      const buffer = Buffer.alloc(length);
      let done = 0;
      while (done < length) {
        const { bytesRead } = await file.read(buffer, done, length - done, position + done);
        if (!bytesRead) fail('truncated archive');
        done += bytesRead;
      }
      position += length;
      whole.update(buffer);
      return buffer;
    };
    const entries = new Map();
    let global = Object.create(null);
    let local;
    let ended = false;
    while (position < size) {
      const header = await read(512);
      if (header.every((byte) => byte === 0)) {
        if (local || !(await read(512)).every((byte) => byte === 0)) fail('invalid end marker');
        while (position < size) if (!(await read(Math.min(65536, size - position))).every((byte) => byte === 0)) fail('data after end marker');
        if (size % 512) fail('unaligned end padding');
        ended = true;
        break;
      }
      charge(budget, 'entries', 1, limits.entries);
      const checksum = number(header.subarray(148, 156), false);
      let sum = 0;
      for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : header[i];
      if (sum !== checksum) fail('header checksum');
      const magic = header.subarray(257, 263).toString('ascii');
      if (!['ustar\0', 'ustar ', '\0\0\0\0\0\0'].includes(magic)) fail('header magic');
      if (magic === 'ustar\0' && header.subarray(263, 265).toString('ascii') !== '00') fail('USTAR version');
      const mode = number(header.subarray(100, 108));
      if (mode > 0o7777) fail('mode overflow');
      for (const [start, end] of [[108, 116], [116, 124], [136, 148], [329, 337], [337, 345]]) number(header.subarray(start, end));
      let bytes = number(header.subarray(124, 136));
      const flag = header[156] === 0 ? '0' : String.fromCharCode(header[156]);
      if (!['0', '1', '2', '5', 'x', 'g'].includes(flag)) fail(`unsupported entry type ${flag}`);
      const prefix = magic === 'ustar\0' ? text(header.subarray(345, 500)) : '';
      let name = text(header.subarray(0, 100));
      if (prefix) name = `${prefix}/${name}`;
      let target = text(header.subarray(157, 257));
      const extended = flag === 'x' || flag === 'g';
      archivePath(name, limits);
      if (!extended) {
        const attributes = { ...global, ...local };
        local = undefined;
        name = attributes.path ?? name;
        target = attributes.linkpath ?? target;
        if (attributes.size !== undefined) {
          if (!/^(0|[1-9][0-9]*)$/.test(attributes.size) || !Number.isSafeInteger(Number(attributes.size))) fail('PAX size');
          bytes = Number(attributes.size);
        }
      }
      name = archivePath(name, limits);
      if (Buffer.byteLength(target) > limits.pathBytes || /[\x00-\x1f\x7f]/.test(target)) fail('link target limit');
      if (bytes > size - position) fail('truncated entry');
      if (['1', '2', '5'].includes(flag) && bytes) fail('non-file payload');
      const entry = { path: name, mode: mode.toString(8), type: ({ '0': 'file', '1': 'hardlink', '2': 'symlink', '5': 'directory' })[flag], bytes, target, offset: position };
      if (!extended && entries.has(name)) fail(`duplicate path ${name}`);
      const keep = extended || retain(entry);
      if (keep && bytes > limits.fileBytes) fail('retained file limit');
      if (extended) charge(budget, 'metadata', bytes, limits.metadataBytes);
      else charge(budget, 'metadata', Buffer.byteLength(name) + Buffer.byteLength(target) + 160, limits.metadataBytes);
      if (keep && !extended) charge(budget, 'retained', bytes, limits.retainedBytes);
      const chunks = [];
      const hash = createHash('sha256');
      let remaining = bytes;
      while (remaining) {
        const chunk = await read(Math.min(65536, remaining));
        hash.update(chunk);
        if (keep) chunks.push(chunk);
        remaining -= chunk.length;
      }
      const padding = (512 - bytes % 512) % 512;
      if (padding && (await read(padding)).some((byte) => byte !== 0)) fail('nonzero entry padding');
      if (extended) {
        const attributes = pax(Buffer.concat(chunks, bytes), limits);
        if (flag === 'g') {
          if (local || ['path', 'linkpath', 'size'].some((key) => Object.hasOwn(attributes, key))) fail('ambiguous global PAX');
          global = { ...global, ...attributes };
        } else {
          if (local) fail('stacked local PAX');
          local = attributes;
        }
      } else {
        entry.sha256 = hash.digest('hex');
        if (keep) entry.data = Buffer.concat(chunks, bytes);
        entries.set(name, entry);
        if (inspect) await inspect(entry, file, budget);
      }
    }
    if (!ended) fail('missing end marker');
    const result = { sha256: whole.digest('hex'), bytes: size, entries };
    return finish ? finish(result, file, budget) : result;
  });
}

async function layerHash(entry, file, budget) {
  const head = Buffer.alloc(Math.min(2, entry.bytes));
  if (head.length) await file.read(head, 0, head.length, entry.offset);
  if (head.length !== 2 || head[0] !== 0x1f || head[1] !== 0x8b) return entry.sha256;
  if (!entry.bytes) fail('empty layer');
  const stream = Readable.from((async function* () {
    let position = entry.offset;
    const end = entry.offset + entry.bytes;
    while (position < end) {
      const chunk = Buffer.alloc(Math.min(65536, end - position));
      const { bytesRead } = await file.read(chunk, 0, chunk.length, position);
      if (!bytesRead) fail('truncated compressed layer');
      charge(budget, 'scan', bytesRead, budget.limits.scanBytes);
      position += bytesRead;
      yield chunk.subarray(0, bytesRead);
    }
  })());
  const unzip = createGunzip();
  stream.on('error', (error) => unzip.destroy(error));
  const hash = createHash('sha256');
  try {
    for await (const chunk of stream.pipe(unzip)) {
      charge(budget, 'scan', chunk.length, budget.limits.scanBytes);
      hash.update(chunk);
    }
    return hash.digest('hex');
  } finally { stream.destroy(); unzip.destroy(); }
}

export async function assertImageArchive(path, image) {
  if (!/^sha256:[0-9a-f]{64}$/.test(image)) throw new Error('Expected immutable image ID');
  return scanTarFile(path, {
    retain: (entry) => entry.path === 'manifest.json',
    inspect: async (entry, file, budget) => {
      if (entry.type === 'file') entry.diffId = await layerHash(entry, file, budget);
    },
    finish: async (scanned, file, budget) => {
  const manifestEntry = scanned.entries.get('manifest.json');
  if (manifestEntry?.type !== 'file' || !manifestEntry.data) fail('missing Docker save manifest.json');
  const manifest = JSON.parse(utf8.decode(manifestEntry.data));
  if (!Array.isArray(manifest) || manifest.length !== 1) fail('expected exactly one saved image');
  const record = manifest[0];
  if (!record || typeof record.Config !== 'string' || !Array.isArray(record.Layers) || !record.Layers.length) fail('Docker save manifest fields');
  const configPath = archivePath(record.Config);
  const configEntry = scanned.entries.get(configPath);
  if (configEntry?.type !== 'file' || configEntry.sha256 !== image.slice(7)) fail('config image ID mismatch');
  if (configEntry.bytes > evidenceLimits.fileBytes) fail('config file limit');
  charge(budget, 'retained', configEntry.bytes, evidenceLimits.retainedBytes);
  charge(budget, 'scan', configEntry.bytes, evidenceLimits.scanBytes);
  const configBytes = Buffer.alloc(configEntry.bytes);
  let done = 0;
  while (done < configBytes.length) {
    const { bytesRead } = await file.read(configBytes, done, configBytes.length - done, configEntry.offset + done);
    if (!bytesRead) fail('truncated config');
    done += bytesRead;
  }
  if (digest(configBytes) !== configEntry.sha256) fail('config changed during scan');
  const config = JSON.parse(utf8.decode(configBytes));
  const diffIds = config.rootfs?.diff_ids;
  if (config.rootfs?.type !== 'layers' || !Array.isArray(diffIds) || diffIds.length !== record.Layers.length || diffIds.some((id) => !/^sha256:[0-9a-f]{64}$/.test(id))) fail('rootfs diff_ids');
  const listed = new Set();
  const checkBlob = (name, entry) => {
    const match = /^blobs\/sha256\/([0-9a-f]{64})$/.exec(name);
    if (match && entry.sha256 !== match[1]) fail('blob content hash');
  };
  checkBlob(configPath, configEntry);
  for (let i = 0; i < record.Layers.length; i++) {
    const name = archivePath(record.Layers[i]);
    if (listed.has(name)) fail('duplicate listed layer');
    listed.add(name);
    const entry = scanned.entries.get(name);
    if (entry?.type !== 'file' || `sha256:${entry.diffId}` !== diffIds[i]) fail('ordered layer diff_id mismatch');
    checkBlob(name, entry);
  }
  return { sha256: scanned.sha256, bytes: scanned.bytes };
    },
  });
}
