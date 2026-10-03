// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { createHash } from 'node:crypto';
import {
  closeSync, constants, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync,
  openSync, opendirSync, readSync, realpathSync, rmSync, unlinkSync, writeSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { evidenceLimits } from './evidence-limits.mjs';

const markerName = '.publication-complete';
const temporaryName = '.publication-complete.tmp';
const version = 'phase2-publication-v1';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const invalid = (message) => Object.assign(new Error(message), { code: 'ERR_INVALID_BUNDLE' });

export class PublicationError extends Error {
  constructor(target, state, phase, cause) {
    const durability = state === 'committed' ? 'unconfirmed' : 'not-applicable';
    super(`Publication ${state}; durability ${durability}; ${phase}: ${cause.message}`, { cause });
    this.name = 'PublicationError';
    this.code = cause.code ?? 'ERR_PUBLICATION';
    this.state = state;
    this.target = target;
    this.phase = phase;
    this.durability = durability;
  }
}

// Trust contract: private host-owned ancestor; no malicious same-UID mutation.
function trustedTarget(target) {
  if (typeof target !== 'string' || !target || target.includes('\0')) throw invalid('Invalid publication target');
  const absolute = resolve(target);
  const parent = dirname(absolute);
  if (parent === absolute || realpathSync(parent) !== parent) throw invalid('Publication requires a real canonical parent');
  let trusted = false;
  for (let path = parent; ; path = dirname(path)) {
    const stat = lstatSync(path);
    if (stat.isDirectory() && stat.uid === process.getuid() && (stat.mode & 0o077) === 0) trusted = true;
    if (path === dirname(path)) break;
  }
  if (!trusted) throw invalid('Publication requires a private host-owned ancestor');
  return absolute;
}

function canonicalPath(path) {
  if (typeof path !== 'string' || !path || path.normalize('NFC') !== path ||
      !path.isWellFormed() || /[\\\x00-\x1f\x7f]/.test(path) ||
      Buffer.byteLength(path) > evidenceLimits.pathBytes) throw invalid('Invalid canonical artifact path');
  const parts = path.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || part === markerName || part === temporaryName)) {
    throw invalid(`Invalid or reserved artifact path: ${path}`);
  }
  return parts;
}

function safeLength(bytes, limit, label) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > limit) throw invalid(`${label} exceeds its byte limit`);
}

function inventoryShape(entries, publication) {
  if (!Array.isArray(entries) || entries.length > evidenceLimits.entries - 2) throw invalid('Artifact entry limit exceeded');
  const files = new Set();
  const directories = new Set();
  let retained = 0;
  let metadata = Buffer.byteLength(`{"version":"${version}","artifacts":[]}\n`);
  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== 'object') throw invalid('Invalid artifact entry');
    const parts = canonicalPath(entry.path);
    if (files.has(entry.path)) throw invalid(`Duplicate artifact path: ${entry.path}`);
    files.add(entry.path);
    if (publication && !(entry.bytes instanceof Uint8Array)) throw invalid('Artifact bytes must be Uint8Array');
    const length = publication ? entry.bytes.byteLength : entry.bytes;
    safeLength(length, evidenceLimits.fileBytes, 'Artifact');
    retained += length;
    safeLength(retained, evidenceLimits.retainedBytes, 'Retained artifacts');
    if (!publication && (!closedKeys(entry, ['path', 'bytes', 'sha256']) ||
        typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256))) throw invalid('Invalid marker artifact schema');
    metadata += Buffer.byteLength(JSON.stringify({ path: entry.path, bytes: length, sha256: '0'.repeat(64) })) + (index === 0 ? 0 : 1);
    safeLength(metadata, evidenceLimits.metadataBytes, 'Marker metadata');
    let directory = '';
    for (const part of parts.slice(0, -1)) {
      directory = directory ? `${directory}/${part}` : part;
      directories.add(directory);
      if (files.size + directories.size + 2 > evidenceLimits.entries) throw invalid('Bundle entry limit exceeded');
    }
  }
  for (const directory of directories) if (files.has(directory)) throw invalid(`File/directory conflict: ${directory}`);
  if (files.size + directories.size + 2 > evidenceLimits.entries) throw invalid('Bundle entry limit exceeded');
  return { files, directories };
}

function closedKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function syncDirectory(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function writeFileExclusive(path, bytes, write) {
  const fd = openSync(path, 'wx', 0o600);
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const count = write(fd, bytes, offset, bytes.length - offset, offset);
      if (!Number.isInteger(count) || count <= 0 || count > bytes.length - offset) throw invalid('Artifact write made invalid progress');
      offset += count;
    }
    fsyncSync(fd);
  } finally { closeSync(fd); }
}

export function publishBundleExclusive(target, artifacts, {
  syncDirectory: sync = syncDirectory, write = writeSync, beforeClaim, link = linkSync,
} = {}) {
  let state = 'uncommitted';
  let phase = 'validate';
  let owned;
  try {
    target = trustedTarget(target);
    const { directories } = inventoryShape(artifacts, true);
    const snapshot = artifacts.map(({ path, bytes }) => ({ path, bytes: Buffer.from(bytes) }))
      .sort((a, b) => compare(a.path, b.path));
    const marker = { version, artifacts: snapshot.map(({ path, bytes }) => ({ path, bytes: bytes.length, sha256: digest(bytes) })) };
    const markerBytes = Buffer.from(JSON.stringify(marker) + '\n');
    safeLength(markerBytes.length, evidenceLimits.metadataBytes, 'Marker metadata');
    phase = 'claim';
    beforeClaim?.(target);
    mkdirSync(target, { mode: 0o700 });
    owned = lstatSync(target);
    phase = 'write-artifacts';
    const shallowFirst = [...directories].sort((a, b) => a.split('/').length - b.split('/').length || compare(a, b));
    for (const directory of shallowFirst) mkdirSync(join(target, directory), { mode: 0o700 });
    for (const { path, bytes } of snapshot) writeFileExclusive(join(target, path), bytes, write);
    phase = 'write-marker';
    const temporary = join(target, temporaryName);
    writeFileExclusive(temporary, markerBytes, write);
    phase = 'sync-directories';
    for (const directory of [...shallowFirst].reverse()) sync(join(target, directory));
    sync(target);
    phase = 'commit-marker';
    link(temporary, join(target, markerName));
    state = 'committed';
    phase = 'remove-temporary-marker';
    unlinkSync(temporary);
    phase = 'sync-root';
    sync(target);
    phase = 'sync-parent';
    sync(dirname(target));
    return { target, state, durability: 'confirmed', markerSha256: digest(markerBytes) };
  } catch (cause) {
    const error = new PublicationError(target, state, phase, cause);
    if (state !== 'committed' && owned) {
      try {
        const current = lstatSync(target);
        if (current.dev === owned.dev && current.ino === owned.ino && current.isDirectory()) rmSync(target, { recursive: true });
      } catch (cleanupCause) {
        if (cleanupCause.code !== 'ENOENT') error.cleanupCause = cleanupCause;
      }
    }
    throw error;
  }
}

function readSizedFile(path, expected) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size !== expected) throw invalid(`File length changed: ${path}`);
    const bytes = Buffer.alloc(expected);
    let offset = 0;
    while (offset < expected) {
      const count = readSync(fd, bytes, offset, expected - offset, offset);
      if (count === 0) throw invalid(`Truncated artifact: ${path}`);
      offset += count;
    }
    if (readSync(fd, Buffer.alloc(1), 0, 1, expected) !== 0) throw invalid(`Artifact grew: ${path}`);
    return bytes;
  } finally { closeSync(fd); }
}

export function readPublishedBundle(target) {
  target = trustedTarget(target);
  const root = lstatSync(target);
  if (!root.isDirectory() || root.isSymbolicLink() || realpathSync(target) !== target) throw invalid('Bundle root must be a real directory');
  const markerPath = join(target, markerName);
  let markerStat;
  try { markerStat = lstatSync(markerPath); } catch (cause) {
    if (cause.code === 'ENOENT') throw invalid('Bundle has no publication completion marker');
    throw cause;
  }
  if (!markerStat.isFile() || markerStat.isSymbolicLink()) throw invalid('Completion marker must be a regular file');
  safeLength(markerStat.size, evidenceLimits.metadataBytes, 'Marker metadata');
  const markerBytes = readSizedFile(markerPath, markerStat.size);
  let marker;
  try { marker = JSON.parse(markerBytes.toString('utf8')); } catch { throw invalid('Invalid completion marker JSON'); }
  if (!closedKeys(marker, ['version', 'artifacts']) || marker.version !== version) throw invalid('Invalid completion marker schema');
  const { files, directories } = inventoryShape(marker.artifacts, false);
  for (let i = 1; i < marker.artifacts.length; i++) {
    if (compare(marker.artifacts[i - 1].path, marker.artifacts[i].path) >= 0) throw invalid('Marker inventory is not in canonical order');
  }
  if (!markerBytes.equals(Buffer.from(JSON.stringify(marker) + '\n'))) throw invalid('Completion marker encoding is not canonical');
  const expected = new Map(marker.artifacts.map((entry) => [entry.path, entry]));
  const observed = new Map();
  const pending = [''];
  let entries = 0;
  let retained = 0;
  while (pending.length) {
    const directory = pending.pop();
    const handle = opendirSync(join(target, directory));
    try {
      for (let entry; (entry = handle.readSync()) !== null;) {
        if (++entries > evidenceLimits.entries) throw invalid('Bundle entry limit exceeded');
        const path = directory ? `${directory}/${entry.name}` : entry.name;
        const stat = lstatSync(join(target, path));
        if (stat.isSymbolicLink()) throw invalid(`Bundle symlink rejected: ${path}`);
        if (path === markerName) continue;
        if (path === temporaryName) {
          if (!stat.isFile() || stat.dev !== markerStat.dev || stat.ino !== markerStat.ino) throw invalid('Unexpected temporary marker');
          continue;
        }
        canonicalPath(path);
        if (stat.isDirectory()) {
          if (!directories.has(path)) throw invalid(`Extra bundle directory: ${path}`);
          pending.push(path);
        } else if (stat.isFile()) {
          safeLength(stat.size, evidenceLimits.fileBytes, 'Artifact');
          retained += stat.size;
          safeLength(retained, evidenceLimits.retainedBytes, 'Retained artifacts');
          if (!files.has(path)) throw invalid(`Extra bundle artifact: ${path}`);
          if (stat.size !== expected.get(path).bytes) throw invalid(`Artifact length mismatch: ${path}`);
          observed.set(path, stat.size);
        } else throw invalid(`Unsupported bundle entry: ${path}`);
      }
    } finally { handle.closeSync(); }
  }
  if (observed.size !== files.size) throw invalid('Required bundle artifact is missing');
  const artifacts = new Map();
  for (const { path, bytes, sha256 } of marker.artifacts) {
    const content = readSizedFile(join(target, path), bytes);
    if (digest(content) !== sha256) throw invalid(`Artifact hash mismatch: ${path}`);
    artifacts.set(path, content);
  }
  return { marker, artifacts };
}
