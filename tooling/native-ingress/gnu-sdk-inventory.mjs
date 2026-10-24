// SPEC: _spec/tooling/native-ingress/gnu-sdk-inventory.puml
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn as nodeSpawn } from 'node:child_process';
import { types } from 'node:util';
import { createTarInventory } from './tar-inventory.mjs';

export const GNU_SDK_DESCRIPTOR = Object.freeze({
  root: '/tmp/opencode/f9-gnu-2026-data-only-01',
  file: '/tmp/opencode/f9-gnu-2026-data-only-01/x86-64--glibc--stable-2026.08-1.tar.xz',
  archiveBytes: 102_296_280,
  archiveSha256: 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3',
  decoderRoot: '/tmp/opencode/f9-xz-qualification-01',
});
export const GNU_SDK_LIMITS = Object.freeze({
  maxTotalMs: 120_000, cleanupMs: 3000, maxReadsPerPass: 4096,
  maxFsOperations: 10_000, maxExpandedBytes: 1_073_741_824,
  maxHeaders: 32_768, maxStreamEvents: 32_768, maxStderrBytes: 8192,
  maxSelectedEntries: 128, maxSelectedBytes: 131_072, maxSummaryBytes: 262_144,
});
const fields = Object.freeze(['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']);
const gateKeys = Object.freeze(['stagedImagesVerified', 'preloadAbsent', 'ordinaryProfileObserved']);
const dependencyKeys = Object.freeze(['fs', 'spawn', 'now', 'setTimeout', 'clearTimeout', 'hash', 'beforeDecode', 'afterDecode']);
const codes = new Set(['E_INPUT', 'E_METADATA', 'E_BINDING', 'E_IO', 'E_CLOSE', 'E_LENGTH', 'E_HASH',
  'E_PREREQUISITE', 'E_SPAWN', 'E_PIPE', 'E_DECODER', 'E_TAR', 'E_OUTPUT', 'E_DEADLINE', 'E_CLEANUP', 'E_CLOCK', 'E_LIMIT']);
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length').get;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer').get;
const typedOffset = Object.getOwnPropertyDescriptor(typedPrototype, 'byteOffset').get;
const selectors = Object.freeze([
  Object.freeze({ category: 'layout', pattern: /^(?:[^/]+\/)?(?:bin|sbin|lib|lib64|\.config)$/u }),
  Object.freeze({ category: 'setup-or-manifest', pattern: /(?:^|\/)(?:relocate-sdk\.sh|toolchain-wrapper|environment-setup[^/]*|[^/]*(?:manifest|\.manifest)[^/]*|\.config)$/u }),
  Object.freeze({ category: 'compiler-or-binutils-name', pattern: /(?:^|\/)bin\/(?:[^/]*-)?(?:gcc|g\+\+|cc|c\+\+|cpp|ld(?:\.bfd|\.gold)?|as|ar|ranlib|strip|objcopy|objdump|readelf|nm|size|strings)(?:-[0-9.]+)?$/u }),
  Object.freeze({ category: 'runtime-name', pattern: /(?:^|\/)(?:ld-linux[^/]*|libc\.so(?:\.[^/]*)?|libgcc_s\.so(?:\.[^/]*)?|libstdc\+\+\.so(?:\.[^/]*)?)$/u }),
  Object.freeze({ category: 'python-name', pattern: /(?:^|\/)[^/]*(?:python|libpython)[^/]*$/u }),
]);
const negativeFlags = Object.freeze({
  extracted: false, extractionAuthorized: false, pythonFreeSubsetVerified: false,
  installedUsability: false, nativeQualified: false, decoderQualified: false,
  rustReady: false, trainingReady: false, provenanceVerified: false,
  hardRssBounded: false, processTreeBounded: false, hardDeadlineGuaranteed: false,
});

export class GnuSdkInventoryError extends Error {
  constructor(code) {
    const fixed = codes.has(code) ? code : 'E_INPUT';
    super(fixed);
    this.name = 'GnuSdkInventoryError';
    this.code = fixed;
    Object.freeze(this);
  }
}
const fail = (code) => { throw new GnuSdkInventoryError(code); };
const normalized = (error, fallback) => error instanceof GnuSdkInventoryError ? error : new GnuSdkInventoryError(fallback);

function record(value, allowed, code = 'E_INPUT', exact = false) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) fail(code);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(code);
  const keys = Reflect.ownKeys(value);
  if (exact && keys.length !== allowed.length) fail(code);
  const captured = Object.create(null);
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.includes(key)) fail(code);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail(code);
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function captureIdentity(value, profile) {
  const outer = record(value, ['root', 'file'], 'E_INPUT', true);
  const result = {};
  for (const kind of ['root', 'file']) {
    const snapshot = record(outer[kind], fields, 'E_INPUT', true);
    for (const field of fields) {
      const v = snapshot[field];
      if (typeof v !== 'string' || v.length > 40 || !/^(?:0|[1-9][0-9]*|-[1-9][0-9]*)$/u.test(v)) fail('E_INPUT');
      if (v.startsWith('-') && field !== 'mtimeNs' && field !== 'ctimeNs') fail('E_INPUT');
    }
    if (BigInt(snapshot.ino) === 0n || snapshot.uid !== '1000') fail('E_METADATA');
    if (kind === 'root') {
      if (snapshot.mode !== String(0o40700) || snapshot.nlink !== '2') fail('E_METADATA');
    } else if (snapshot.mode !== String(0o100600) || snapshot.gid !== '1000' || snapshot.nlink !== '1'
      || snapshot.size !== String(profile.archiveBytes)) fail('E_METADATA');
    result[kind] = snapshot;
  }
  return Object.freeze(result);
}

// WHAT: Fixed-path, two-pass archive inventory with parent-owned decoder gates.
export function runGnuSdkInventory(expectedIdentity, trustedDeps = {}) {
  return runInventory(GNU_SDK_DESCRIPTOR, GNU_SDK_LIMITS, expectedIdentity, trustedDeps, false);
}

// WHAT: Reduced in-memory fixture runner; never reports real archive inspection.
export function createSdkInventoryFixtureRunner(fixtureProfile, trustedDeps) {
  const p = record(fixtureProfile, ['archiveBytes', 'archiveSha256', 'limits'], 'E_INPUT');
  if (!Number.isSafeInteger(p.archiveBytes) || p.archiveBytes < 1 || p.archiveBytes > 1_048_576
    || typeof p.archiveSha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(p.archiveSha256)) fail('E_INPUT');
  const overrides = p.limits === undefined ? {} : record(p.limits, Object.keys(GNU_SDK_LIMITS));
  const limits = { ...GNU_SDK_LIMITS };
  for (const [key, value] of Object.entries(overrides)) {
    if (!Number.isSafeInteger(value) || value < 1 || value > limits[key]) fail('E_LIMIT');
    limits[key] = value;
  }
  if (limits.cleanupMs >= limits.maxTotalMs) fail('E_LIMIT');
  const profile = Object.freeze({ ...GNU_SDK_DESCRIPTOR, archiveBytes: p.archiveBytes, archiveSha256: p.archiveSha256 });
  const capturedLimits = Object.freeze(limits);
  const deps = record(trustedDeps, dependencyKeys);
  if (!Object.hasOwn(deps, 'fs') || !Object.hasOwn(deps, 'spawn')) fail('E_INPUT');
  return (expectedIdentity) => runInventory(profile, capturedLimits, expectedIdentity, deps, true);
}

async function runInventory(profile, limits, expectedIdentity, dependencies, mockOnly) {
  const expected = captureIdentity(expectedIdentity, profile);
  const d = record(dependencies, dependencyKeys);
  const io = Object.hasOwn(d, 'fs') ? d.fs : fs;
  const spawn = Object.hasOwn(d, 'spawn') ? d.spawn : nodeSpawn;
  const now = Object.hasOwn(d, 'now') ? d.now : () => performance.now();
  const schedule = Object.hasOwn(d, 'setTimeout') ? d.setTimeout : globalThis.setTimeout;
  const cancel = Object.hasOwn(d, 'clearTimeout') ? d.clearTimeout : globalThis.clearTimeout;
  const hash = Object.hasOwn(d, 'hash') ? d.hash : createHash;
  for (const fn of [spawn, now, schedule, cancel, hash, d.beforeDecode, d.afterDecode]) {
    if (typeof fn !== 'function' || types.isProxy(fn)) fail('E_INPUT');
  }
  if (!io || types.isProxy(io)) fail('E_INPUT');
  for (const name of ['lstatSync', 'openSync', 'fstatSync', 'readSync', 'closeSync']) {
    if (typeof io[name] !== 'function' || types.isProxy(io[name])) fail('E_INPUT');
  }
  let previous = -Infinity;
  function clock() {
    let value;
    try { value = now(); } catch { fail('E_CLOCK'); }
    if (!Number.isFinite(value) || value < previous) fail('E_CLOCK');
    previous = value;
    return value;
  }
  const started = clock();
  const totalDeadline = started + limits.maxTotalMs;
  const workDeadline = totalDeadline - limits.cleanupMs;
  if (!Number.isFinite(totalDeadline) || totalDeadline <= started) fail('E_CLOCK');
  let failure = null;
  let abort;
  const interrupted = new Promise((resolve, reject) => { abort = reject; });
  interrupted.catch(() => {});
  let failureListener = null;
  function stop(code) {
    if (failure) return;
    failure = new GnuSdkInventoryError(code);
    abort(failure);
    if (failureListener) failureListener();
  }
  function check() {
    if (failure) throw failure;
    if (clock() >= workDeadline) fail('E_DEADLINE');
  }
  let rootFd = null;
  let fileFd = null;
  let timer;
  let fsOperations = 0;
  let closeAttempts = 0;
  let archiveDataBytes = 0;
  let archiveRequestedBytes = 0;
  let archiveReadAttempts = 0;
  const selected = [];
  let selectedBytes = 2;
  let expandedBytes = 0;
  let stderrBytes = 0;
  let streamEvents = 0;
  const parser = createTarInventory({ maxExpandedBytes: limits.maxExpandedBytes, maxHeaders: limits.maxHeaders });
  const coalescer = Buffer.alloc(65_536);
  let coalesced = 0;

  function syscall(name, ...args) {
    check();
    if (++fsOperations > limits.maxFsOperations) fail('E_LIMIT');
    let result;
    try { result = io[name](...args); } catch { fail('E_IO'); }
    check();
    return result;
  }
  function verify(stat, snapshot) {
    if (!stat || typeof stat !== 'object' || types.isProxy(stat)) fail('E_METADATA');
    for (const field of fields) {
      let value;
      try { value = stat[field]; } catch { fail('E_METADATA'); }
      if (typeof value !== 'bigint' || value.toString() !== snapshot[field]) fail('E_BINDING');
    }
  }
  function named() {
    verify(syscall('lstatSync', profile.root, { bigint: true }), expected.root);
    verify(syscall('lstatSync', profile.file, { bigint: true }), expected.file);
  }
  function bound() {
    named();
    if (rootFd !== null) verify(syscall('fstatSync', rootFd, { bigint: true }), expected.root);
    if (fileFd !== null) verify(syscall('fstatSync', fileFd, { bigint: true }), expected.file);
  }
  function open(path, flags) {
    check();
    if (++fsOperations > limits.maxFsOperations) fail('E_LIMIT');
    let fd;
    try { fd = io.openSync(path, flags); } catch { fail('E_IO'); }
    if (!Number.isSafeInteger(fd) || fd < 0 || fd === rootFd) fail('E_IO');
    return fd;
  }
  function closeOwned() {
    let error = false;
    for (const kind of ['file', 'root']) {
      const fd = kind === 'file' ? fileFd : rootFd;
      if (kind === 'file') fileFd = null; else rootFd = null;
      if (fd === null) continue;
      closeAttempts++;
      try { io.closeSync(fd); } catch { error = true; }
    }
    if (error) fail('E_CLOSE');
  }
  function newHash() {
    try { return hash('sha256'); } catch { fail('E_HASH'); }
  }
  function update(h, chunk) {
    try { h.update(chunk); } catch { fail('E_HASH'); }
  }
  function digest(h) {
    let value;
    try { value = h.digest('hex'); } catch { fail('E_HASH'); }
    if (value !== profile.archiveSha256) fail('E_HASH');
    return value;
  }
  const scratch = Buffer.alloc(65_536);
  function read(position, length, attempts) {
    check();
    if (attempts > limits.maxReadsPerPass) fail('E_LIMIT');
    archiveReadAttempts++;
    archiveRequestedBytes += length;
    const count = syscall('readSync', fileFd, scratch, 0, length, position);
    if (count !== (position === profile.archiveBytes ? 0 : length)) fail('E_LENGTH');
    archiveDataBytes += count;
    return scratch.subarray(0, count);
  }
  function firstPass() {
    const h = newHash();
    let attempts = 0;
    for (let position = 0; position < profile.archiveBytes;) {
      const length = Math.min(scratch.length, profile.archiveBytes - position);
      update(h, read(position, length, ++attempts));
      position += length;
    }
    read(profile.archiveBytes, 1, ++attempts);
    return digest(h);
  }
  async function gate(fn) {
    check();
    let value;
    try { value = await Promise.race([Promise.resolve().then(() => { check(); return fn(); }), interrupted]); }
    catch (error) { throw normalized(error, 'E_PREREQUISITE'); }
    check();
    const receipt = record(value, gateKeys, 'E_PREREQUISITE', true);
    if (!gateKeys.every((key) => receipt[key] === true)) fail('E_PREREQUISITE');
  }
  function feed(bytes) {
    check();
    let events;
    try { events = parser.feed(bytes); } catch { fail('E_TAR'); }
    for (const event of events) {
      const categories = selectors.filter((selector) => selector.pattern.test(event.path)).map((selector) => selector.category);
      if (!categories.length) continue;
      if (selected.length >= limits.maxSelectedEntries) fail('E_OUTPUT');
      const candidate = Object.freeze({ ...event, categories: Object.freeze(categories) });
      const cost = Buffer.byteLength(JSON.stringify(candidate)) + 1;
      if (cost > limits.maxSelectedBytes - selectedBytes) fail('E_OUTPUT');
      selectedBytes += cost;
      selected.push(candidate);
    }
  }
  function data(which, chunk) {
    check();
    if (++streamEvents > limits.maxStreamEvents) fail('E_LIMIT');
    if (types.isProxy(chunk) || !types.isUint8Array(chunk)) fail('E_PIPE');
    const length = typedLength.call(chunk);
    const backing = typedBuffer.call(chunk);
    const offset = typedOffset.call(chunk);
    if (types.isSharedArrayBuffer(backing) || length > 1_048_576) fail('E_PIPE');
    if (which === 'stderr') {
      if (length > limits.maxStderrBytes - stderrBytes) fail('E_OUTPUT');
      stderrBytes += length;
      return;
    }
    if (length > limits.maxExpandedBytes - expandedBytes) fail('E_OUTPUT');
    expandedBytes += length;
    const bytes = new Uint8Array(backing, offset, length);
    for (let cursor = 0; cursor < length;) {
      const count = Math.min(coalescer.length - coalesced, length - cursor);
      coalescer.set(bytes.subarray(cursor, cursor + count), coalesced);
      cursor += count;
      coalesced += count;
      if (coalesced === coalescer.length) { feed(coalescer); coalesced = 0; }
    }
  }

  function decode() {
    return new Promise((resolve, reject) => {
      let child;
      let settled = false;
      let closed = false;
      let killed = false;
      let exited = false;
      let exitCode;
      let exitSignal;
      let producerDone = false;
      let stdinFinished = false;
      const ended = { stdout: false, stderr: false };
      const streamClosed = { stdout: false, stderr: false };
      let cleanupTimer;
      let cleanupDeadline = -Infinity;
      let cancelWrite = null;
      function finish(error) {
        if (settled) return;
        settled = true;
        failureListener = null;
        if (cleanupTimer !== undefined) {
          try { cancel(cleanupTimer); }
          catch { if (!error) error = new GnuSdkInventoryError('E_CLOCK'); }
        }
        if (error) reject(error); else resolve();
      }
      function cleanup() {
        if (settled) return;
        if (cancelWrite) cancelWrite();
        if (closed) { finish(failure); return; }
        let remaining = 0;
        try {
          const current = clock();
          cleanupDeadline = Math.min(totalDeadline, current + limits.cleanupMs);
          remaining = Math.max(0, cleanupDeadline - current);
        } catch { /* WHAT: Unobserved cleanup receives no clock allowance. */ }
        let timerFailed = false;
        try { cleanupTimer = schedule(() => finish(new GnuSdkInventoryError('E_CLEANUP')), remaining); }
        catch { timerFailed = true; }
        if (child && !killed && !exited) {
          killed = true;
          try { child.kill('SIGKILL'); } catch { /* WHAT: Only a close event confirms cleanup. */ }
        }
        if (timerFailed) finish(new GnuSdkInventoryError('E_CLEANUP'));
      }
      function guarded(fn, fallback = 'E_PIPE') {
        return (...args) => {
          if (settled || failure) return;
          try { check(); fn(...args); } catch (error) { stop(normalized(error, fallback).code); }
        };
      }
      function write(bytes) {
        return new Promise((done, rejectWrite) => {
          let callbackDone = false;
          let drained = false;
          let returned = false;
          let backpressured = false;
          let writeSettled = false;
          const settle = (error) => {
            if (writeSettled) return;
            writeSettled = true;
            child.stdin.removeListener('drain', onDrain);
            cancelWrite = null;
            if (error) rejectWrite(error); else done();
          };
          const complete = () => {
            if (returned && callbackDone && (!backpressured || drained)) {
              settle();
            }
          };
          const onDrain = () => { drained = true; complete(); };
          cancelWrite = () => settle(failure);
          child.stdin.on('drain', onDrain);
          try {
            check();
            const accepted = child.stdin.write(bytes, (error) => {
              if (writeSettled) return;
              if (error) { stop('E_PIPE'); return; }
              callbackDone = true;
              complete();
            });
            if (typeof accepted !== 'boolean') fail('E_PIPE');
            backpressured = !accepted;
            returned = true;
            complete();
          } catch (error) {
            const fixed = normalized(error, 'E_PIPE');
            stop(fixed.code);
            settle(fixed);
          }
        });
      }
      async function produce() {
        try {
          const h = newHash();
          let attempts = 0;
          for (let position = 0; position < profile.archiveBytes;) {
            check();
            const length = Math.min(scratch.length, profile.archiveBytes - position);
            const bytes = read(position, length, ++attempts);
            update(h, bytes);
            const copy = Buffer.alloc(length);
            copy.set(bytes);
            await write(copy);
            check();
            position += length;
          }
          read(profile.archiveBytes, 1, ++attempts);
          digest(h);
          bound();
          check();
          producerDone = true;
          child.stdin.end();
        } catch (error) {
          stop(normalized(error, 'E_PIPE').code);
        }
      }
      try {
        check();
        const root = profile.decoderRoot;
        child = spawn(`${root}/ld-linux-x86-64.so.2`, [
          '--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', root,
          `${root}/xz`, '--decompress', '--stdout', '--format=xz', '--threads=1',
          '--memlimit-decompress=16777216', '--', '-',
        ], { cwd: root, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' },
          shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      } catch (error) { finish(normalized(error, 'E_SPAWN')); return; }
      failureListener = cleanup;
      try {
        child.on('error', guarded(() => stop('E_SPAWN')));
        child.on('exit', guarded((code, signal) => {
          if (exited) fail('E_DECODER');
          exited = true; exitCode = code; exitSignal = signal;
          if (code !== 0 || signal !== null) fail('E_DECODER');
        }));
        child.on('close', (code, signal) => {
          closed = true;
          queueMicrotask(() => {
            if (settled) return;
            if (failure) {
              let error = failure;
              try { if (clock() >= cleanupDeadline) error = new GnuSdkInventoryError('E_CLEANUP'); }
              catch { error = new GnuSdkInventoryError('E_CLEANUP'); }
              finish(error);
              return;
            }
            try {
              check();
              if (!exited || code !== 0 || signal !== null || exitCode !== code || exitSignal !== null) fail('E_DECODER');
              if (!producerDone || !stdinFinished || !ended.stdout || !ended.stderr
                || !streamClosed.stdout || !streamClosed.stderr) fail('E_PIPE');
              finish();
            } catch (error) { stop(normalized(error, 'E_PIPE').code); }
          });
        });
        child.stdin.on('error', guarded(() => stop('E_PIPE')));
        child.stdin.on('finish', guarded(() => {
          if (stdinFinished || !producerDone) fail('E_PIPE');
          stdinFinished = true;
        }));
        child.stdin.on('close', guarded(() => { if (!stdinFinished) fail('E_PIPE'); }));
        for (const [stream, which] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) {
          stream.on('error', guarded(() => stop('E_PIPE')));
          stream.on('data', guarded((chunk) => {
            if (ended[which] || streamClosed[which]) fail('E_PIPE');
            data(which, chunk);
          }));
          stream.on('end', guarded(() => {
            if (ended[which]) fail('E_PIPE');
            if (which === 'stdout' && coalesced) { feed(coalescer.subarray(0, coalesced)); coalesced = 0; }
            ended[which] = true;
          }));
          stream.on('close', guarded(() => {
            if (streamClosed[which] || !ended[which]) fail('E_PIPE');
            streamClosed[which] = true;
          }));
        }
        if (failure) cleanup();
        else Promise.resolve().then(produce).catch((error) => stop(normalized(error, 'E_PIPE').code));
      } catch (error) { stop(normalized(error, 'E_PIPE').code); }
    });
  }

  let result;
  let error;
  try {
    try { timer = schedule(() => stop('E_DEADLINE'), Math.max(0, workDeadline - clock())); }
    catch (cause) { throw normalized(cause, 'E_CLOCK'); }
    named();
    const c = fs.constants;
    if (c.O_RDONLY !== 0 || !['O_NOFOLLOW', 'O_DIRECTORY', 'O_NONBLOCK']
      .every(key => Number.isInteger(c[key]) && c[key] > 0)) fail('E_PREREQUISITE');
    rootFd = open(profile.root, c.O_RDONLY | c.O_NOFOLLOW | c.O_DIRECTORY | c.O_NONBLOCK);
    bound();
    fileFd = open(profile.file, c.O_RDONLY | c.O_NOFOLLOW | c.O_NONBLOCK);
    bound();
    firstPass();
    bound();
    await gate(d.beforeDecode);
    bound();
    await decode();
    check();
    await gate(d.afterDecode);
    bound();
    closeOwned();
    check();
    let inventory;
    try { inventory = parser.finish(); } catch { fail('E_TAR'); }
    result = Object.freeze({
      state: 'GNU_SDK_DATA_INVENTORY', scope: mockOnly ? 'mock-fixture' : 'ordinary-host-source-context',
      mockOnly, realArchiveInspected: !mockOnly, ...negativeFlags,
      archiveBytes: profile.archiveBytes, archiveSha256: profile.archiveSha256,
      archivePasses: 2, archiveDataBytes, archiveRequestedBytes, archiveReadAttempts,
      fsOperations, closeAttempts, expandedBytes, stderrBytes, streamEvents,
      stdinFinished: true, stdoutEnded: true, stderrEnded: true, closeObserved: true,
      exitCode: 0, signal: null, inventory, selected: Object.freeze(selected),
    });
    if (Buffer.byteLength(JSON.stringify(result)) > limits.maxSummaryBytes) fail('E_OUTPUT');
    check();
  } catch (cause) {
    error = normalized(cause, 'E_IO');
    stop(error.code);
  } finally {
    if (timer !== undefined) {
      try { cancel(timer); }
      catch { if (!error) error = new GnuSdkInventoryError('E_CLOCK'); }
    }
    try { closeOwned(); } catch (cause) { if (error?.code !== 'E_CLEANUP') error = normalized(cause, 'E_CLOSE'); }
  }
  if (error) throw error;
  return result;
}
