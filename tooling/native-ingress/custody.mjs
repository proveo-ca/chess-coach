// SPEC: _spec/tooling/native-ingress/custody.puml
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { CustodyError, MAX_FIXTURE_BYTES, validateFixtureDescriptor } from './input-descriptor.mjs';

export { CustodyError, MAX_FIXTURE_BYTES, validateFixtureDescriptor };
export const MAX_CHUNKS = 16;
export const MAX_CHUNK_BYTES = 4096;
const SECURITY = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink'];
const CONTENT = [...SECURITY, 'size', 'mtimeNs', 'ctimeNs'];
const TYPE = 0o170000n;
const TYPED_LENGTH = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'length').get;
const COPY_BYTES = Uint8Array.prototype.set;
const TYPED_BUFFER = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'buffer').get;
const ARRAY_BUFFER_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;

function requireThat(ok, code) {
  if (!ok) throw new CustodyError(code);
}

function metadata(stat) {
  requireThat(stat !== null && typeof stat === 'object', 'E_METADATA');
  for (const key of CONTENT) {
    requireThat(typeof stat[key] === 'bigint', 'E_METADATA');
  }
  for (const key of [...SECURITY, 'size']) {
    requireThat(stat[key] >= 0n && stat[key] <= (1n << 64n) - 1n, 'E_METADATA');
  }
}

function equal(a, b, keys) {
  metadata(a);
  metadata(b);
  return keys.every(key => a[key] === b[key]);
}

export function assertRoot(named, opened, uid) {
  metadata(named);
  metadata(opened);
  requireThat((opened.mode & TYPE) === 0o040000n && opened.uid === uid &&
    (opened.mode & 0o7777n) === 0o700n, 'E_ROOT');
  requireThat(equal(named, opened, SECURITY), 'E_BINDING');
}

export function assertFilePhase(named, opened, uid, expectedSize) {
  metadata(named);
  metadata(opened);
  requireThat((opened.mode & TYPE) === 0o100000n && opened.uid === uid &&
    (opened.mode & 0o7777n) === 0o600n && opened.nlink === 1n, 'E_FILE');
  requireThat(opened.size === expectedSize, 'E_LENGTH');
  requireThat(equal(named, opened, CONTENT), 'E_BINDING');
}

export function assertFileBirth(named, opened, uid) {
  assertFilePhase(named, opened, uid, 0n);
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalize(error) {
  return error instanceof CustodyError ? error : new CustodyError('E_FS');
}

function assertPath(rootPath) {
  requireThat(typeof rootPath === 'string' && path.isAbsolute(rootPath) &&
    path.normalize(rootPath) === rootPath && rootPath !== path.parse(rootPath).root &&
    !rootPath.endsWith(path.sep) && !rootPath.includes('\0'), 'E_INPUT');
}

function copyBuffer(source, maximum, code, ordinaryBacking = false) {
  requireThat(Buffer.isBuffer(source), code);
  try {
    const length = Reflect.apply(TYPED_LENGTH, source, []);
    requireThat(length > 0 && length <= maximum, code);
    if (ordinaryBacking) Reflect.apply(ARRAY_BUFFER_LENGTH, Reflect.apply(TYPED_BUFFER, source, []), []);
    const copy = Buffer.alloc(length);
    Reflect.apply(COPY_BYTES, copy, [source]);
    return copy;
  } catch { throw new CustodyError(code); }
}

export function stageFixture(rootPath, input) {
  const deadline = process.hrtime.bigint() + 3_500_000_000n;
  assertPath(rootPath);
  requireThat(input !== null && typeof input === 'object', 'E_INPUT');
  let sourceBytes, expectedSha256;
  try { sourceBytes = input.bytes; expectedSha256 = input.expectedSha256; }
  catch { throw new CustodyError('E_INPUT'); }
  requireThat(Buffer.isBuffer(sourceBytes) && typeof expectedSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(expectedSha256), 'E_INPUT');
  const bytes = copyBuffer(sourceBytes, MAX_FIXTURE_BYTES, 'E_INPUT');
  requireThat(digest(bytes) === expectedSha256, 'E_HASH');
  const descriptor = { name: 'fixture.bin', byteLength: bytes.length, sha256: expectedSha256 };
  return stage(rootPath, descriptor, deadline, { bytes });
}

export function stageFixtureChunks(rootPath, descriptor, chunks) {
  const deadline = process.hrtime.bigint() + 3_500_000_000n;
  assertPath(rootPath);
  return stage(rootPath, validateFixtureDescriptor(descriptor), deadline, { chunks });
}

function stage(rootPath, descriptor, deadline, source) {
  const { byteLength, sha256: expectedSha256 } = descriptor;
  const filePath = path.join(rootPath, descriptor.name);
  const root = { fd: null }, file = { fd: null };
  let iterator, next, finish, completed = false;
  let failure, result, operations = 0;

  function guard() {
    requireThat(process.hrtime.bigint() < deadline, 'E_DEADLINE');
  }
  function io(action) {
    guard();
    requireThat(operations < 96, 'E_LIMIT');
    operations++;
    const value = action();
    guard();
    return value;
  }
  function close(holder) {
    if (holder.fd === null) return;
    const fd = holder.fd;
    holder.fd = null;
    try { fs.closeSync(fd); }
    catch { throw new CustodyError('E_CLOSE'); }
  }
  function stat(holder) {
    return io(() => fs.fstatSync(holder.fd, { bigint: true }));
  }
  function named(target) {
    return io(() => fs.lstatSync(target, { bigint: true }));
  }
  function producer(action) {
    return io(() => {
      try { return action(); }
      catch { throw new CustodyError('E_SOURCE'); }
    });
  }
  function stepResult(value, cleanup = false) {
    const code = cleanup ? 'E_SOURCE_CLEANUP' : 'E_SOURCE';
    requireThat(value !== null && typeof value === 'object' && !types.isProxy(value), code);
    const done = Object.getOwnPropertyDescriptor(value, 'done');
    requireThat(done && Object.hasOwn(done, 'value') && typeof done.value === 'boolean', code);
    if (done.value) return { done: true };
    requireThat(!cleanup, code);
    const chunk = Object.getOwnPropertyDescriptor(value, 'value');
    requireThat(chunk && Object.hasOwn(chunk, 'value'), code);
    return { done: false, value: chunk.value };
  }

  try {
    if (!source.bytes) {
      producer(() => {
        const method = source.chunks?.[Symbol.iterator];
        requireThat(typeof method === 'function', 'E_SOURCE');
        const acquired = Reflect.apply(method, source.chunks, []);
        requireThat(acquired !== null && typeof acquired === 'object', 'E_SOURCE');
        iterator = acquired;
        const cleanup = iterator.return;
        requireThat(cleanup === undefined || typeof cleanup === 'function', 'E_SOURCE');
        finish = cleanup;
        next = iterator.next;
        requireThat(typeof next === 'function', 'E_SOURCE');
      });
    }
    const flags = fs.constants;
    for (const key of ['O_DIRECTORY', 'O_NOFOLLOW', 'O_NONBLOCK', 'O_WRONLY', 'O_CREAT', 'O_EXCL']) {
      requireThat(Number.isInteger(flags[key]) && flags[key] > 0, 'E_PLATFORM');
    }
    requireThat(flags.O_RDONLY === 0 && typeof process.geteuid === 'function', 'E_PLATFORM');
    const uidValue = io(() => process.geteuid());
    requireThat(Number.isSafeInteger(uidValue) && uidValue >= 0 && uidValue <= 4_294_967_295, 'E_PLATFORM');
    const uid = BigInt(uidValue);
    io(() => fs.mkdirSync(rootPath, { mode: 0o700, recursive: false }));
    io(() => {
      root.fd = fs.openSync(rootPath, flags.O_RDONLY | flags.O_DIRECTORY | flags.O_NOFOLLOW | flags.O_NONBLOCK);
    });
    const rootBirth = stat(root);
    assertRoot(named(rootPath), rootBirth, uid);

    function rootBinding() {
      const current = stat(root);
      assertRoot(named(rootPath), current, uid);
      requireThat(equal(rootBirth, current, SECURITY), 'E_BINDING');
    }

    io(() => {
      file.fd = fs.openSync(filePath,
        flags.O_WRONLY | flags.O_CREAT | flags.O_EXCL | flags.O_NOFOLLOW | flags.O_NONBLOCK, 0o600);
    });
    const birth = stat(file);
    assertFileBirth(named(filePath), birth, uid);
    function write(bytes, offset) {
      const writtenBytes = io(() => fs.writeSync(file.fd, bytes, 0, bytes.length, offset));
      requireThat(writtenBytes === bytes.length, 'E_IO');
    }
    if (source.bytes) {
      write(source.bytes, 0);
    } else {
      const incoming = createHash('sha256');
      let offset = 0, chunks = 0;
      for (let pull = 0; pull <= MAX_CHUNKS; pull++) {
        const current = producer(() => {
          const value = stepResult(Reflect.apply(next, iterator, []));
          if (value.done) completed = true;
          return value;
        });
        if (current.done) break;
        requireThat(chunks < MAX_CHUNKS, 'E_LIMIT');
        const bytes = copyBuffer(current.value, MAX_CHUNK_BYTES, 'E_CHUNK', true);
        requireThat(bytes.length <= byteLength - offset, 'E_LENGTH');
        incoming.update(bytes);
        write(bytes, offset);
        offset += bytes.length;
        chunks++;
      }
      requireThat(completed && offset === byteLength, 'E_LENGTH');
      requireThat(incoming.digest('hex') === expectedSha256, 'E_HASH');
    }
    const written = stat(file);
    assertFilePhase(named(filePath), written, uid, BigInt(byteLength));
    requireThat(equal(birth, written, SECURITY), 'E_BINDING');
    rootBinding();
    close(file);
    guard();

    io(() => {
      file.fd = fs.openSync(filePath, flags.O_RDONLY | flags.O_NOFOLLOW | flags.O_NONBLOCK);
    });
    const before = stat(file);
    assertFilePhase(named(filePath), before, uid, BigInt(byteLength));
    requireThat(equal(written, before, CONTENT), 'E_BINDING');
    const hash = createHash('sha256'), scratch = Buffer.alloc(4096);
    for (let offset = 0; offset < byteLength;) {
      const want = Math.min(scratch.length, byteLength - offset);
      const count = io(() => fs.readSync(file.fd, scratch, 0, want, offset));
      requireThat(count === want, 'E_IO');
      hash.update(scratch.subarray(0, count));
      offset += count;
    }
    requireThat(io(() => fs.readSync(file.fd, scratch, 0, 1, byteLength)) === 0, 'E_LENGTH');
    const readbackSha256 = hash.digest('hex');
    requireThat(readbackSha256 === expectedSha256, 'E_HASH');
    const after = stat(file);
    assertFilePhase(named(filePath), after, uid, BigInt(byteLength));
    requireThat(equal(written, after, CONTENT), 'E_BINDING');
    close(file);
    rootBinding();
    result = Object.freeze({ profile: 'ordinary-per-object-v1', state: 'DATA_ONLY',
      root: rootPath, file: filePath, byteLength, sha256: readbackSha256,
      rootDevice: rootBirth.dev.toString(), fileDevice: birth.dev.toString(),
      nativeAuthority: false, installed: false });
  } catch (error) {
    failure = normalize(error);
  } finally {
    for (const holder of [file, root]) {
      try { close(holder); }
      catch { failure = new CustodyError('E_CLOSE', failure); }
    }
    if (iterator && !completed && finish) {
      const cleanup = finish;
      finish = undefined;
      try { stepResult(Reflect.apply(cleanup, iterator, []), true); }
      catch {
        const cleanupFailure = new CustodyError('E_SOURCE_CLEANUP', failure);
        failure = failure?.code === 'E_CLOSE' ? new CustodyError('E_CLOSE', cleanupFailure) : cleanupFailure;
      }
    }
  }
  if (failure) throw failure;
  guard();
  return result;
}
