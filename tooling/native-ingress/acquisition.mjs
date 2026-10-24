// SPEC: _spec/tooling/native-ingress/acquisition.puml
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { CustodyError, assertRoot, assertFileBirth, assertFilePhase } from './custody.mjs';

export const MAX_ARTIFACT_BYTES = 134_217_728;
export const MAX_CHUNK_BYTES = 1_048_576;
export const MAX_DATA_EVENTS = 32_768;
export const MAX_FS_CALLS = 65_533;
export const MAX_CLOCK_READS = 200_000;
export const MAX_LIFECYCLE_EVENTS = 32;
const PREFIX = 'https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/';
const SECURITY = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink'];
const CONTENT = [...SECURITY, 'size', 'mtimeNs', 'ctimeNs'];
const TYPED = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_LENGTH = Object.getOwnPropertyDescriptor(TYPED, 'length').get;
const TYPED_BUFFER = Object.getOwnPropertyDescriptor(TYPED, 'buffer').get;
const ARRAY_BUFFER_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const COPY_BYTES = Uint8Array.prototype.set;

function requireThat(ok, code) {
  if (!ok) throw new CustodyError(code);
}

export function createArtifactDescriptor(input) {
  requireThat(input !== null && typeof input === 'object' && !types.isProxy(input), 'E_INPUT');
  const prototype = Object.getPrototypeOf(input);
  requireThat(prototype === Object.prototype || prototype === null, 'E_INPUT');
  const expected = ['name', 'url', 'byteLength', 'sha256'];
  const keys = Reflect.ownKeys(input);
  requireThat(keys.length === expected.length && keys.every(key => expected.includes(key)), 'E_INPUT');
  const fields = expected.map(key => Object.getOwnPropertyDescriptor(input, key));
  requireThat(fields.every(field => field && Object.hasOwn(field, 'value')), 'E_INPUT');
  const [name, url, byteLength, sha256] = fields.map(field => field.value);
  requireThat(typeof name === 'string' && name.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._+-]*\.tar\.xz$/.test(name) &&
    typeof url === 'string' && url === PREFIX + name &&
    Number.isSafeInteger(byteLength) && byteLength >= 1 && byteLength <= MAX_ARTIFACT_BYTES &&
    typeof sha256 === 'string' && /^[a-f0-9]{64}$/.test(sha256), 'E_INPUT');
  return Object.freeze({ name, url, byteLength, sha256 });
}

export const GNU2026_ARTIFACT = createArtifactDescriptor({
  name: 'x86-64--glibc--stable-2026.08-1.tar.xz',
  url: PREFIX + 'x86-64--glibc--stable-2026.08-1.tar.xz',
  byteLength: 102_296_280,
  sha256: 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3',
});

function normalize(error, code = 'E_IO') {
  return error instanceof CustodyError ? error : new CustodyError(code, error);
}

function snapshot(stat) {
  return Object.freeze(Object.fromEntries(CONTENT.map(key => [key, stat[key]])));
}

function equal(a, b, keys) {
  return keys.every(key => typeof a[key] === 'bigint' && typeof b[key] === 'bigint' && a[key] === b[key]);
}

function assertHeaders(response, byteLength) {
  requireThat(response.statusCode === 200, 'E_HTTP');
  const raw = response.rawHeaders;
  requireThat(!types.isProxy(raw) && Array.isArray(raw) && raw.length <= 64 && raw.length % 2 === 0, 'E_HEADERS');
  let bytes = 2, lengths = 0, encodings = 0;
  for (let index = 0; index < raw.length; index += 2) {
    const field = Object.getOwnPropertyDescriptor(raw, String(index));
    const value = Object.getOwnPropertyDescriptor(raw, String(index + 1));
    requireThat(field && value && Object.hasOwn(field, 'value') && Object.hasOwn(value, 'value'), 'E_HEADERS');
    const name = field.value, text = value.value;
    requireThat(typeof name === 'string' && typeof text === 'string' && name.length <= 16_384 &&
      text.length <= 16_384 && /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) &&
      /^[\t\x20-\x7e\x80-\xff]*$/.test(text), 'E_HEADERS');
    bytes += name.length + text.length + 4;
    requireThat(bytes <= 16_384, 'E_HEADERS');
    const key = name.toLowerCase();
    if (key === 'content-length') {
      lengths++;
      requireThat(lengths === 1 && text === String(byteLength), 'E_HEADERS');
    }
    if (key === 'content-encoding') {
      encodings++;
      requireThat(encodings === 1 && text === 'identity', 'E_HEADERS');
    }
    requireThat(key !== 'transfer-encoding' && key !== 'content-range', 'E_HEADERS');
  }
  requireThat(lengths === 1, 'E_HEADERS');
}

export function acquireGnu2026(rootPath) {
  return acquireArtifact(rootPath, GNU2026_ARTIFACT);
}

export async function acquireArtifact(rootPath, input) {
  const start = process.hrtime.bigint();
  const end = start + 120_000_000_000n, workEnd = start + 119_000_000_000n;
  const counts = { fsCalls: 0, requestCalls: 0, networkCalls: 0, lifecycleEvents: 0,
    dataEvents: 0, clockReads: 1, copiedBytes: 0, writtenBytes: 0, readBytes: 0,
    closeAttempts: 0, peakOwnedFds: 0 };
  const root = { fd: null }, file = { fd: null };
  let lastTime = start, deadlineHit = false, failNetwork, workTimer, failure, result;

  function now(cleanup = false) {
    requireThat(counts.clockReads < MAX_CLOCK_READS - (cleanup ? 0 : 4), 'E_LIMIT');
    counts.clockReads++;
    const time = process.hrtime.bigint();
    requireThat(typeof time === 'bigint' && time >= lastTime, 'E_PLATFORM');
    lastTime = time;
    return time;
  }
  function guard(final = false) {
    requireThat(!deadlineHit && now(final) < (final ? end : workEnd), 'E_DEADLINE');
  }
  function work(action) {
    guard();
    const value = action();
    guard();
    return value;
  }
  function io(action) {
    return work(() => {
      requireThat(counts.fsCalls < MAX_FS_CALLS, 'E_LIMIT');
      counts.fsCalls++;
      return action();
    });
  }
  function opened(holder, target, flags, mode) {
    io(() => {
      holder.fd = fs.openSync(target, flags, mode);
      counts.peakOwnedFds = Math.max(counts.peakOwnedFds,
        Number(root.fd !== null) + Number(file.fd !== null));
    });
  }
  function close(holder) {
    if (holder.fd === null) return;
    const fd = holder.fd;
    holder.fd = null;
    counts.closeAttempts++;
    try { fs.closeSync(fd); }
    catch (error) { throw new CustodyError('E_CLOSE', error); }
  }
  const stat = holder => io(() => fs.fstatSync(holder.fd, { bigint: true }));
  const named = target => io(() => fs.lstatSync(target, { bigint: true }));

  function transfer(descriptor) {
    return new Promise((resolve, reject) => {
      let request, response, responseSeen = false, requestClosed = false, responseClosed = false;
      let requestDestroyed = false, responseDestroyed = false, endSeen = false;
      let failed = false, settled = false, cleaning = false, acquiringRequest = false;
      let firstFailure, cleanupUncertain = false, cleanupTimer, cleanupEnd;
      let offset = 0, incomingSha256;
      const incoming = work(() => createHash('sha256'));

      function finish() {
        if (settled || cleaning || acquiringRequest) return;
        if (failed) {
          if (request && !requestClosed || response && !responseClosed) return;
          settled = true;
          clearTimeout(cleanupTimer);
          reject(cleanupUncertain ? new CustodyError('E_NETWORK_CLEANUP', firstFailure) : firstFailure);
        } else if (endSeen && requestClosed && responseClosed) {
          if (response.complete !== true) { fail(new CustodyError('E_NETWORK')); return; }
          settled = true;
          resolve(incomingSha256);
        }
      }
      function destroyResponse() {
        if (!response || responseDestroyed) return;
        responseDestroyed = true;
        counts.networkCalls++;
        try { response.destroy(); }
        catch { cleanupUncertain = true; }
      }
      function destroyRequest() {
        if (!request || requestDestroyed) return;
        requestDestroyed = true;
        counts.networkCalls++;
        try { request.destroy(); }
        catch { cleanupUncertain = true; }
      }
      function fail(error) {
        if (settled || failed) return;
        failed = true;
        cleaning = true;
        firstFailure = normalize(error, 'E_NETWORK');
        clearTimeout(workTimer);
        let failureTime = lastTime;
        try { failureTime = now(true); } catch { cleanupUncertain = true; }
        cleanupEnd = failureTime + 1_000_000_000n < end ? failureTime + 1_000_000_000n : end;
        const delay = Math.max(0, Number((cleanupEnd - failureTime + 999_999n) / 1_000_000n));
        cleanupTimer = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new CustodyError('E_NETWORK_CLEANUP', firstFailure));
        }, delay);
        destroyRequest();
        destroyResponse();
        cleaning = false;
        finish();
      }
      failNetwork = fail;
      function cleanupClose() {
        if (!failed || settled) return;
        try { requireThat(now(true) < cleanupEnd, 'E_DEADLINE'); }
        catch { cleanupUncertain = true; }
      }
      function event(action) {
        if (failed || settled) return;
        try {
          requireThat(counts.lifecycleEvents < MAX_LIFECYCLE_EVENTS, 'E_LIMIT');
          counts.lifecycleEvents++;
          guard();
          action();
          guard();
        } catch (error) { fail(error); }
        finish();
      }
      function data(chunk) {
        if (failed || settled) return;
        try {
          guard();
          requireThat(!endSeen, 'E_NETWORK');
          requireThat(counts.dataEvents < MAX_DATA_EVENTS, 'E_LIMIT');
          counts.dataEvents++;
          requireThat(!types.isProxy(chunk) && Buffer.isBuffer(chunk), 'E_CHUNK');
          const length = Reflect.apply(TYPED_LENGTH, chunk, []);
          requireThat(length > 0 && length <= MAX_CHUNK_BYTES, 'E_CHUNK');
          try { Reflect.apply(ARRAY_BUFFER_LENGTH, Reflect.apply(TYPED_BUFFER, chunk, []), []); }
          catch { throw new CustodyError('E_CHUNK'); }
          requireThat(length <= descriptor.byteLength - offset, 'E_LENGTH');
          guard();
          const bytes = Buffer.alloc(length);
          Reflect.apply(COPY_BYTES, bytes, [chunk]);
          guard();
          counts.copiedBytes += length;
          incoming.update(bytes);
          const written = io(() => fs.writeSync(file.fd, bytes, 0, length, offset));
          requireThat(written === length, 'E_IO');
          counts.writtenBytes += length;
          offset += length;
        } catch (error) { fail(normalize(error)); }
      }
      function receive(value) {
        if (responseSeen) {
          if (!failed && !settled) fail(new CustodyError('E_NETWORK'));
          return;
        }
        responseSeen = true;
        response = value;
        response.on('error', error => event(() => { throw normalize(error, 'E_NETWORK'); }));
        response.on('aborted', () => event(() => { throw new CustodyError('E_NETWORK'); }));
        response.on('end', () => event(() => {
          requireThat(!endSeen && response.complete === true, 'E_NETWORK');
          requireThat(offset === descriptor.byteLength, 'E_LENGTH');
          incomingSha256 = work(() => incoming.digest('hex'));
          requireThat(incomingSha256 === descriptor.sha256, 'E_HASH');
          endSeen = true;
        }));
        response.on('close', () => {
          if (!responseClosed) cleanupClose();
          responseClosed = true;
          event(() => requireThat(endSeen, 'E_NETWORK'));
          finish();
        });
        if (failed || settled) { destroyResponse(); return; }
        event(() => {
          assertHeaders(response, descriptor.byteLength);
          response.on('data', data);
        });
      }
      try {
        work(() => {
          counts.requestCalls++;
          counts.networkCalls++;
          acquiringRequest = true;
          try {
            request = https.request(descriptor.url, { method: 'GET', agent: false,
              rejectUnauthorized: true, insecureHTTPParser: false, maxHeaderSize: 16_384,
              headers: { 'Accept-Encoding': 'identity', Connection: 'close' } });
            request.on('error', error => event(() => { throw normalize(error, 'E_NETWORK'); }));
            request.on('close', () => {
              if (!requestClosed) cleanupClose();
              requestClosed = true;
              event(() => {});
              finish();
            });
            request.on('response', receive);
          } finally {
            acquiringRequest = false;
            if (failed) {
              cleaning = true;
              destroyRequest();
              destroyResponse();
              cleaning = false;
              finish();
            }
          }
        });
        work(() => { request.maxHeadersCount = 33; });
        work(() => { counts.networkCalls++; request.end(); });
      } catch (error) { fail(normalize(error, 'E_NETWORK')); }
    });
  }

  try {
    workTimer = setTimeout(() => {
      deadlineHit = true;
      if (failNetwork) failNetwork(new CustodyError('E_DEADLINE'));
    }, Math.max(0, Number((workEnd - now() + 999_999n) / 1_000_000n)));
    guard();
    requireThat(typeof rootPath === 'string' && path.isAbsolute(rootPath) &&
      path.normalize(rootPath) === rootPath && rootPath !== path.parse(rootPath).root &&
      !rootPath.endsWith(path.sep) && !rootPath.includes('\0'), 'E_INPUT');
    const descriptor = work(() => createArtifactDescriptor(input));
    const filePath = path.join(rootPath, descriptor.name);
    const flags = fs.constants;
    for (const key of ['O_DIRECTORY', 'O_NOFOLLOW', 'O_NONBLOCK', 'O_WRONLY', 'O_CREAT', 'O_EXCL']) {
      requireThat(Number.isInteger(flags[key]) && flags[key] > 0, 'E_PLATFORM');
    }
    requireThat(flags.O_RDONLY === 0 && typeof process.geteuid === 'function', 'E_PLATFORM');
    const uidValue = work(() => process.geteuid());
    requireThat(Number.isSafeInteger(uidValue) && uidValue >= 0 && uidValue <= 4_294_967_295, 'E_PLATFORM');
    const uid = BigInt(uidValue);
    io(() => fs.mkdirSync(rootPath, { mode: 0o700, recursive: false }));
    opened(root, rootPath, flags.O_RDONLY | flags.O_DIRECTORY | flags.O_NOFOLLOW | flags.O_NONBLOCK);
    const rootOpened = stat(root);
    assertRoot(named(rootPath), rootOpened, uid);
    const rootBirth = snapshot(rootOpened);
    function rootBinding() {
      const current = stat(root);
      assertRoot(named(rootPath), current, uid);
      requireThat(equal(rootBirth, current, SECURITY), 'E_BINDING');
    }
    opened(file, filePath, flags.O_WRONLY | flags.O_CREAT | flags.O_EXCL | flags.O_NOFOLLOW | flags.O_NONBLOCK, 0o600);
    const born = stat(file);
    assertFileBirth(named(filePath), born, uid);
    const birth = snapshot(born);
    rootBinding();
    const incomingSha256 = await transfer(descriptor);
    guard();
    const writtenStat = stat(file);
    assertFilePhase(named(filePath), writtenStat, uid, BigInt(descriptor.byteLength));
    requireThat(equal(birth, writtenStat, SECURITY), 'E_BINDING');
    const written = snapshot(writtenStat);
    rootBinding();
    close(file);
    guard();
    opened(file, filePath, flags.O_RDONLY | flags.O_NOFOLLOW | flags.O_NONBLOCK);
    const before = stat(file);
    assertFilePhase(named(filePath), before, uid, BigInt(descriptor.byteLength));
    requireThat(equal(written, before, CONTENT), 'E_BINDING');
    const hash = work(() => createHash('sha256')), scratch = work(() => Buffer.alloc(65_536));
    for (let offset = 0; offset < descriptor.byteLength;) {
      const want = Math.min(scratch.length, descriptor.byteLength - offset);
      const count = io(() => fs.readSync(file.fd, scratch, 0, want, offset));
      requireThat(count === want, 'E_IO');
      work(() => hash.update(scratch.subarray(0, count)));
      counts.readBytes += count;
      offset += count;
    }
    requireThat(io(() => fs.readSync(file.fd, scratch, 0, 1, descriptor.byteLength)) === 0, 'E_LENGTH');
    const readbackSha256 = work(() => hash.digest('hex'));
    requireThat(readbackSha256 === descriptor.sha256, 'E_HASH');
    const after = stat(file);
    assertFilePhase(named(filePath), after, uid, BigInt(descriptor.byteLength));
    requireThat(equal(written, after, CONTENT), 'E_BINDING');
    close(file);
    rootBinding();
    result = { profile: 'ordinary-archive-acquisition-v1', state: 'DATA_ONLY', contentMatched: true,
      root: rootPath, file: filePath, byteLength: descriptor.byteLength,
      expectedSha256: descriptor.sha256, incomingSha256, readbackSha256,
      rootDevice: rootBirth.dev.toString(), fileDevice: birth.dev.toString(),
      nativeAuthority: false, nativeQualified: false, provenanceVerified: false,
      pythonFreeSubsetVerified: false, installedUsability: false, rustReady: false, trainingReady: false,
      installationPerformed: false, immutabilityVerified: false };
  } catch (error) {
    failure = normalize(error);
  } finally {
    clearTimeout(workTimer);
    for (const holder of [file, root]) {
      try { close(holder); }
      catch { failure = new CustodyError('E_CLOSE', failure); }
    }
  }
  if (failure) throw failure;
  guard(true);
  return Object.freeze({ ...result, counts: Object.freeze({ ...counts }) });
}
