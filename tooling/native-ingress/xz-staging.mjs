// SPEC: _spec/tooling/native-ingress/xz-qualification.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { inspectElf64Requirements } from './elf-metadata.mjs';

const ROOT = '/tmp/opencode/f9-xz-qualification-01';
const FIELDS = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs'];
const SECURITY = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink'];
const CODES = ['E_INPUT', 'E_PLATFORM', 'E_METADATA', 'E_BINDING', 'E_HASH', 'E_ELF',
  'E_LOADING', 'E_EXISTS', 'E_IO', 'E_LENGTH', 'E_CLOSE', 'E_PRELOAD', 'E_LAYOUT'];
const HIDDEN = new Set(['1879047932', '1879047931', '2147483647', '2147483645']);
const METHODS = ['lstatSync', 'fstatSync', 'openSync', 'closeSync', 'readSync', 'writeSync',
  'mkdirSync', 'fchmodSync', 'fsyncSync', 'readdirSync'];

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export const XZ_STAGING_PROFILE = freeze({
  profile: 'fixed-xz-ordinary-staging-v1', root: ROOT, chunkBytes: 65536,
  totalSourceBytes: 2758216, maxFsCalls: 1024, maxTransferredBytes: 33554432,
  images: [
    { source: '/usr/bin/xz', name: 'xz', size: 101392,
      sha256: '1f6ca26fd33066c9d5b95e58a0d9e2f5789cb18fd5741518574113b37ea1934d',
      sourceMode: 0o100755, mode: 0o500, interpreter: '/lib64/ld-linux-x86-64.so.2',
      needed: ['liblzma.so.5', 'libc.so.6'], soname: null },
    { source: '/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2', name: 'ld-linux-x86-64.so.2', size: 254864,
      sha256: 'c5e80a563850d6ab5c2f2482e4202d9c1b71fbf44854b8c399e63527202c64e1',
      sourceMode: 0o100755, mode: 0o500, interpreter: null, needed: [], soname: 'ld-linux-x86-64.so.2' },
    { source: '/lib/x86_64-linux-gnu/liblzma.so.5.8.3', name: 'liblzma.so.5', size: 215448,
      sha256: '515749273a91ca5e3b273b4025dc2c1f8827f90005baea0ab85ffb594e74f72f',
      sourceMode: 0o100644, mode: 0o400, interpreter: null, needed: ['libc.so.6'], soname: 'liblzma.so.5' },
    { source: '/lib/x86_64-linux-gnu/libc.so.6', name: 'libc.so.6', size: 2186512,
      sha256: 'a3947513a02831ec692ebf13053c07614882ab54a2101fb91a1b15724062ed0c',
      sourceMode: 0o100755, mode: 0o400, interpreter: '/lib64/ld-linux-x86-64.so.2',
      needed: ['ld-linux-x86-64.so.2'], soname: 'libc.so.6' },
  ],
  assurances: {
    ordinaryStage: true, nativeAuthority: false, nativeQualified: false, decoderQualified: false,
    sourceRootAuthentication: false, treeMetadataAuthenticated: false, candidateExecuted: false,
    ancestorRacesExcluded: false, sameUidRacesExcluded: false, rootRacesExcluded: false,
    hardDeadlineEnforced: false, symbolBindingsVerified: false,
  },
});

export class XzStagingError extends Error {
  constructor(code) {
    const fixed = CODES.includes(code) ? code : 'E_INPUT';
    super(fixed);
    this.name = 'XzStagingError';
    this.code = fixed;
    Object.freeze(this);
  }
}

function check(ok, code) {
  if (!ok) throw new XzStagingError(code);
}

function data(value, keys, code = 'E_INPUT') {
  check(value !== null && typeof value === 'object' && !types.isProxy(value), code);
  check([Object.prototype, null].includes(Object.getPrototypeOf(value)), code);
  const own = Reflect.ownKeys(value);
  check(own.length === keys.length && own.every(key => keys.includes(key)), code);
  return Object.fromEntries(keys.map(key => {
    const field = Object.getOwnPropertyDescriptor(value, key);
    check(field && Object.hasOwn(field, 'value'), code);
    return [key, field.value];
  }));
}

function list(value, maximum, code = 'E_ELF') {
  check(Array.isArray(value) && !types.isProxy(value) && value.length <= maximum, code);
  const result = [];
  for (let index = 0; index < value.length; index++) {
    const field = Object.getOwnPropertyDescriptor(value, String(index));
    check(field && Object.hasOwn(field, 'value'), code);
    result.push(field.value);
  }
  return result;
}

// Trusted test capabilities.
function context(deps) {
  check(deps !== null && typeof deps === 'object' && !types.isProxy(deps), 'E_INPUT');
  const keys = Reflect.ownKeys(deps);
  check(keys.every(key => ['fs', 'hash', 'inspect'].includes(key)), 'E_INPUT');
  const options = data(deps, keys);
  const adapter = Object.hasOwn(options, 'fs') ? options.fs : fs;
  const hash = Object.hasOwn(options, 'hash') ? options.hash :
    (bytes => createHash('sha256').update(bytes).digest('hex'));
  const inspect = Object.hasOwn(options, 'inspect') ? options.inspect : inspectElf64Requirements;
  check(typeof hash === 'function' && typeof inspect === 'function', 'E_INPUT');
  check(adapter !== null && typeof adapter === 'object' && !types.isProxy(adapter), 'E_INPUT');
  check(METHODS.every(name => typeof adapter[name] === 'function'), 'E_INPUT');
  const c = fs.constants;
  check(process.platform === 'linux' && process.arch === 'x64' &&
    ['O_NOFOLLOW', 'O_NONBLOCK', 'O_DIRECTORY'].every(key => Number.isInteger(c[key]) && c[key] !== 0), 'E_PLATFORM');
  const counts = { fsCalls: 0, readCalls: 0, writeCalls: 0, readBytes: 0,
    writtenBytes: 0, closeAttempts: 0, peakOwnedFds: 0 };
  let owned = 0;
  const io = (method, ...args) => {
    check(counts.fsCalls < XZ_STAGING_PROFILE.maxFsCalls - 2, 'E_IO');
    counts.fsCalls++;
    try { return adapter[method](...args); }
    catch { throw new XzStagingError('E_IO'); }
  };
  const close = holder => {
    if (holder.fd === null) return;
    const fd = holder.fd;
    holder.fd = null;
    owned--;
    counts.fsCalls++;
    counts.closeAttempts++;
    try { adapter.closeSync(fd); }
    catch { throw new XzStagingError('E_CLOSE'); }
  };
  const using = (path, flags, mode, action) => {
    const holder = { fd: io('openSync', path, flags, mode) };
    check(Number.isSafeInteger(holder.fd) && holder.fd >= 0, 'E_IO');
    counts.peakOwnedFds = Math.max(counts.peakOwnedFds, ++owned);
    try { return action(holder.fd); }
    finally { close(holder); }
  };
  const named = path => snapshot(io('lstatSync', path, { bigint: true }));
  const stat = fd => snapshot(io('fstatSync', fd, { bigint: true }));
  const digest = bytes => {
    let result;
    try { result = hash(bytes); }
    catch { throw new XzStagingError('E_HASH'); }
    check(typeof result === 'string' && /^[a-f0-9]{64}$/.test(result), 'E_HASH');
    return result;
  };
  return { adapter, hash: digest, inspect, counts, io, using, named, stat, c };
}

function snapshot(stat) {
  check(stat !== null && typeof stat === 'object', 'E_METADATA');
  const result = {};
  for (const key of FIELDS) {
    const field = Object.getOwnPropertyDescriptor(stat, key);
    check(field && Object.hasOwn(field, 'value') && typeof field.value === 'bigint' && field.value >= 0n, 'E_METADATA');
    result[key] = field.value;
  }
  check(result.ino > 0n, 'E_METADATA');
  return result;
}

function equal(a, b, keys = FIELDS) {
  check(keys.every(key => a[key] === b[key]), 'E_BINDING');
}

function imageStat(value, image, source, uid) {
  check(value.mode === BigInt(source ? image.sourceMode : 0o100000 | image.mode) &&
    value.size === BigInt(image.size) && value.nlink === 1n &&
    value.uid === (source ? 0n : uid) && (!source || value.gid === 0n), source ? 'E_METADATA' : 'E_LAYOUT');
}

function directoryStat(value, mode) {
  check(value.mode === BigInt(0o040000 | mode) && value.nlink === 2n, 'E_LAYOUT');
}

function transfer(ctx, fd, bytes, writing) {
  for (let at = 0; at < bytes.length; at += XZ_STAGING_PROFILE.chunkBytes) {
    const size = Math.min(XZ_STAGING_PROFILE.chunkBytes, bytes.length - at);
    const method = writing ? 'writeSync' : 'readSync';
    ctx.counts[writing ? 'writeCalls' : 'readCalls']++;
    const count = ctx.io(method, fd, bytes, at, size, at);
    check(count === size, 'E_LENGTH');
    ctx.counts[writing ? 'writtenBytes' : 'readBytes'] += count;
    check(ctx.counts.writtenBytes + ctx.counts.readBytes <= XZ_STAGING_PROFILE.maxTransferredBytes, 'E_LENGTH');
  }
  if (!writing) {
    ctx.counts.readCalls++;
    check(ctx.io('readSync', fd, Buffer.alloc(1), 0, 1, bytes.length) === 0, 'E_LENGTH');
  }
}

function readImage(ctx, path, image, source, uid, expected) {
  const before = ctx.named(path);
  imageStat(before, image, source, uid);
  if (expected) equal(before, expected);
  return ctx.using(path, ctx.c.O_RDONLY | ctx.c.O_NOFOLLOW | ctx.c.O_NONBLOCK, undefined, fd => {
    equal(before, ctx.stat(fd));
    const bytes = Buffer.alloc(image.size);
    transfer(ctx, fd, bytes, false);
    equal(before, ctx.stat(fd));
    equal(before, ctx.named(path));
    check(ctx.hash(bytes) === image.sha256, 'E_HASH');
    return bytes;
  });
}

function loadingMetadata(ctx, bytes, image) {
  let meta;
  try { meta = ctx.inspect(bytes); }
  catch { throw new XzStagingError('E_ELF'); }
  try {
    check(meta.profile === 'elf64le-x86-64-requirements-v2' && meta.state === 'ELF_REQUIREMENTS_METADATA' &&
      meta.byteLength === image.size && meta.inputSha256 === image.sha256, 'E_ELF');
    const d = meta.dynamic;
    const needed = list(d.needed, 32);
    check(d.present === true && needed.length === image.needed.length &&
      needed.every((name, index) => name === image.needed[index]) && d.soname === image.soname &&
      d.rpath === null && d.runpath === null && meta.interpreter === image.interpreter, 'E_LOADING');
    const groups = [list(d.unknownTags, 1024)];
    if (Object.hasOwn(d, 'opaqueTags')) {
      groups.push(list(d.opaqueTags, 1024));
    }
    for (const tags of groups) for (const entry of tags) {
      check(entry && typeof entry.tag === 'string' && /^-?(0|[1-9][0-9]{0,19})$/.test(entry.tag), 'E_ELF');
      check(!HIDDEN.has(entry.tag), 'E_LOADING');
    }
    const needs = list(meta.requirements.versionNeeds, 512);
    const definitions = list(meta.requirements.versionDefinitions, 512);
    check(needs.length + definitions.length <= 512, 'E_ELF');
    let auxiliaryCount = 0;
    for (const record of [...needs, ...definitions]) {
      const entries = list(Object.hasOwn(record, 'aux') ? record.aux : record.names, 1024);
      check(entries.length > 0, 'E_ELF');
      auxiliaryCount += entries.length;
      check(auxiliaryCount <= 1024, 'E_ELF');
    }
    return meta;
  } catch (error) {
    if (error instanceof XzStagingError) throw error;
    throw new XzStagingError('E_ELF');
  }
}

function versionClosure(metadata) {
  try {
    const providers = new Map();
    for (const meta of metadata) {
      const names = new Set();
      for (const definition of list(meta.requirements.versionDefinitions, 512)) {
        for (const name of list(definition.names, 1024)) {
          check(typeof name === 'string' && name.length > 0 && name.length <= 1024, 'E_ELF');
          names.add(name);
        }
      }
      if (meta.dynamic.soname !== null) providers.set(meta.dynamic.soname, names);
    }
    for (const meta of metadata) for (const need of list(meta.requirements.versionNeeds, 512)) {
      check(meta.dynamic.needed.includes(need.file) && providers.has(need.file), 'E_LOADING');
      for (const aux of list(need.aux, 1024)) {
        check(typeof aux.name === 'string' && providers.get(need.file).has(aux.name), 'E_LOADING');
      }
    }
  } catch (error) {
    if (error instanceof XzStagingError) throw error;
    throw new XzStagingError('E_ELF');
  }
}

const encode = value => Object.fromEntries(FIELDS.map(key => [key, value[key].toString()]));
function decode(value) {
  const record = data(value, FIELDS);
  const result = {};
  for (const key of FIELDS) {
    check(typeof record[key] === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(record[key]), 'E_INPUT');
    result[key] = BigInt(record[key]);
  }
  return result;
}

function layout(ctx, directory, mode) {
  const current = ctx.named(ROOT);
  directoryStat(current, mode);
  equal(current, directory, SECURITY);
  const names = ctx.io('readdirSync', ROOT);
  check(Array.isArray(names) && names.length === 4 && names.every(name => typeof name === 'string') &&
    [...names].sort().every((name, index) => name === ['ld-linux-x86-64.so.2', 'libc.so.6', 'liblzma.so.5', 'xz'][index]), 'E_LAYOUT');
  return current;
}

function verify(ctx, directory, files) {
  equal(layout(ctx, directory, 0o500), directory);
  ctx.using(ROOT, ctx.c.O_RDONLY | ctx.c.O_DIRECTORY | ctx.c.O_NOFOLLOW | ctx.c.O_NONBLOCK, undefined, fd => {
    equal(ctx.stat(fd), directory);
    for (let i = 0; i < XZ_STAGING_PROFILE.images.length; i++) {
      const image = XZ_STAGING_PROFILE.images[i];
      readImage(ctx, `${ROOT}/${image.name}`, image, false, directory.uid, files[i]);
    }
    equal(ctx.stat(fd), directory);
    equal(layout(ctx, directory, 0o500), directory);
  });
}

function receipt(ctx, directory, files) {
  return freeze({ profile: XZ_STAGING_PROFILE.profile, root: ROOT, directory: encode(directory),
    files: files.map((value, index) => ({ name: XZ_STAGING_PROFILE.images[index].name, metadata: encode(value) })),
    assurances: { ...XZ_STAGING_PROFILE.assurances }, counters: { ...ctx.counts } });
}

export function stageXzImages(deps = {}) {
  const ctx = context(deps);
  const images = XZ_STAGING_PROFILE.images;
  const captured = images.map(image => readImage(ctx, image.source, image, true));
  versionClosure(captured.map((bytes, index) => loadingMetadata(ctx, bytes, images[index])));
  check(ctx.counts.readBytes === XZ_STAGING_PROFILE.totalSourceBytes, 'E_LENGTH');
  ctx.counts.fsCalls++;
  try { ctx.adapter.mkdirSync(ROOT, { mode: 0o700 }); }
  catch (error) { throw new XzStagingError(error?.code === 'EEXIST' ? 'E_EXISTS' : 'E_IO'); }
  const initial = ctx.named(ROOT);
  directoryStat(initial, 0o700);
  const files = [];
  let directory;
  ctx.using(ROOT, ctx.c.O_RDONLY | ctx.c.O_DIRECTORY | ctx.c.O_NOFOLLOW | ctx.c.O_NONBLOCK, undefined, rootFd => {
    equal(ctx.stat(rootFd), initial);
    for (let index = 0; index < images.length; index++) {
      const image = images[index];
      equal(ctx.named(ROOT), initial, SECURITY);
      const path = `${ROOT}/${image.name}`;
      ctx.using(path, ctx.c.O_WRONLY | ctx.c.O_CREAT | ctx.c.O_EXCL | ctx.c.O_NOFOLLOW | ctx.c.O_NONBLOCK, 0o600, fd => {
        const birth = ctx.stat(fd);
        check(birth.mode === 0o100600n && birth.uid === initial.uid && birth.nlink === 1n && birth.size === 0n, 'E_LAYOUT');
        transfer(ctx, fd, captured[index], true);
        ctx.io('fchmodSync', fd, image.mode);
        ctx.io('fsyncSync', fd);
        const done = ctx.stat(fd);
        equal(done, birth, ['dev', 'ino', 'uid', 'gid', 'nlink']);
        imageStat(done, image, false, initial.uid);
        equal(done, ctx.named(path));
        files.push(done);
      });
    }
    layout(ctx, initial, 0o700);
    ctx.io('fchmodSync', rootFd, 0o500);
    ctx.io('fsyncSync', rootFd);
    directory = ctx.stat(rootFd);
    directoryStat(directory, 0o500);
    equal(directory, initial, ['dev', 'ino', 'uid', 'gid', 'nlink']);
    equal(directory, ctx.named(ROOT));
  });
  verify(ctx, directory, files);
  return receipt(ctx, directory, files);
}

export function verifyStagedXzImages(input, deps = {}) {
  const value = data(input, ['profile', 'root', 'directory', 'files', 'assurances', 'counters']);
  check(value.profile === XZ_STAGING_PROFILE.profile && value.root === ROOT &&
    Array.isArray(value.files) && !types.isProxy(value.files) && value.files.length === 4, 'E_INPUT');
  const directory = decode(value.directory);
  const files = [];
  for (let index = 0; index < 4; index++) {
    const field = Object.getOwnPropertyDescriptor(value.files, String(index));
    check(field && Object.hasOwn(field, 'value'), 'E_INPUT');
    const file = data(field.value, ['name', 'metadata']);
    check(file.name === XZ_STAGING_PROFILE.images[index].name, 'E_INPUT');
    files.push(decode(file.metadata));
  }
  const ctx = context(deps);
  verify(ctx, directory, files);
  return receipt(ctx, directory, files);
}

export function assertNoSystemPreload(deps = {}) {
  check(deps !== null && typeof deps === 'object' && !types.isProxy(deps), 'E_INPUT');
  const options = data(deps, Reflect.ownKeys(deps));
  check(Reflect.ownKeys(options).every(key => key === 'fs'), 'E_INPUT');
  const adapter = Object.hasOwn(options, 'fs') ? options.fs : fs;
  check(adapter !== null && typeof adapter === 'object' && !types.isProxy(adapter) &&
    typeof adapter.lstatSync === 'function', 'E_INPUT');
  try { adapter.lstatSync('/etc/ld.so.preload', { bigint: true }); }
  catch (error) {
    if (error?.code === 'ENOENT') return true;
    throw new XzStagingError('E_PRELOAD');
  }
  throw new XzStagingError('E_PRELOAD');
}
