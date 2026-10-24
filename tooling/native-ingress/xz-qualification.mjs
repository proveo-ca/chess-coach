// SPEC: _spec/tooling/native-ingress/xz-qualification.puml
import { spawn as nodeSpawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const XZ_QUALIFICATION_ROOT = '/tmp/opencode/f9-xz-qualification-01';
export const XZ_QUALIFICATION_LIMITS = Object.freeze({
  maxCaseMs: 2000, maxTotalMs: 60000, cleanupMs: 3000,
  maxFixtures: 32, maxInputBytes: 65536, maxTotalInputBytes: 131072,
  maxOutputBytes: 65536, maxStderrBytes: 8192, maxChunkEvents: 4096,
});
const codes = ['E_INPUT', 'E_PREREQUISITE', 'E_SPAWN', 'E_PIPE', 'E_OUTPUT', 'E_STDERR', 'E_EVENTS',
  'E_EXIT', 'E_MISMATCH', 'E_DEADLINE', 'E_CLOCK', 'E_CLEANUP'];
const prerequisiteKeys = ['publisherAssociationCorroborated', 'imagesStagedAndVerified',
  'preloadAbsent', 'opaqueLoadingTagsRejected'];

export class XzQualificationError extends Error {
  constructor(code, cleanupObserved = false) {
    const fixed = codes.includes(code) ? code : 'E_INPUT';
    super(fixed);
    this.name = 'XzQualificationError';
    this.code = fixed;
    this.cleanupObserved = cleanupObserved === true;
    Object.freeze(this);
  }
}
const fail = (code) => { throw new XzQualificationError(code); };

function record(value, allowed, code = 'E_INPUT') {
  if (!value || typeof value !== 'object' || types.isProxy(value)) fail(code);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) fail(code);
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) fail(code);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail(code);
    result[key] = descriptor.value;
  }
  return result;
}

function receipt(value) {
  const captured = record(value, ['preloadAbsent'], 'E_PREREQUISITE');
  if (captured.preloadAbsent !== true) fail('E_PREREQUISITE');
}

function capture(profile) {
  const p = record(profile, ['root', 'fixtures', 'prerequisites', 'maxCaseMs', 'maxTotalMs', 'cleanupMs']);
  if (p.root !== XZ_QUALIFICATION_ROOT) fail('E_INPUT');
  const prerequisites = record(p.prerequisites, prerequisiteKeys, 'E_PREREQUISITE');
  if (!prerequisiteKeys.every((key) => prerequisites[key] === true)) fail('E_PREREQUISITE');
  const limits = {};
  for (const key of ['maxCaseMs', 'maxTotalMs', 'cleanupMs']) {
    const value = Object.hasOwn(p, key) ? p[key] : XZ_QUALIFICATION_LIMITS[key];
    if (!Number.isSafeInteger(value) || value < 1 || value > XZ_QUALIFICATION_LIMITS[key]) fail('E_INPUT');
    limits[key] = value;
  }
  if (limits.cleanupMs >= limits.maxTotalMs) fail('E_INPUT');
  if (!Array.isArray(p.fixtures) || types.isProxy(p.fixtures)) fail('E_INPUT');
  const arrayKeys = Reflect.ownKeys(p.fixtures);
  const length = Object.getOwnPropertyDescriptor(p.fixtures, 'length').value;
  if (length < 1 || length > 32 || arrayKeys.length !== length + 1) fail('E_INPUT');
  const fixtures = [];
  const ids = new Set();
  let totalBytes = 0;
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(p.fixtures, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('E_INPUT');
    const f = record(descriptor.value, ['id', 'inputHex', 'expectedExitCode', 'expectedOutputHex',
      'acceptOutput', 'memoryLimitBytes', 'coverage', 'integrityCheck']);
    if (typeof f.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(f.id) || ids.has(f.id)) fail('E_INPUT');
    ids.add(f.id);
    if (typeof f.inputHex !== 'string' || f.inputHex.length > 131072 || !/^(?:[0-9a-f]{2})*$/.test(f.inputHex)) fail('E_INPUT');
    totalBytes += f.inputHex.length / 2;
    if (totalBytes > 131072) fail('E_INPUT');
    if (f.expectedExitCode !== 0 && f.expectedExitCode !== 1) fail('E_INPUT');
    if (typeof f.acceptOutput !== 'boolean' || (f.acceptOutput && f.expectedExitCode !== 0)) fail('E_INPUT');
    if (f.acceptOutput) {
      if (typeof f.expectedOutputHex !== 'string' || f.expectedOutputHex.length > 131072 || !/^(?:[0-9a-f]{2})*$/.test(f.expectedOutputHex)) fail('E_INPUT');
    } else if (f.expectedOutputHex !== null) fail('E_INPUT');
    if (!Number.isSafeInteger(f.memoryLimitBytes) || f.memoryLimitBytes < 1 || f.memoryLimitBytes > 16777216) fail('E_INPUT');
    if (typeof f.integrityCheck !== 'boolean') fail('E_INPUT');
    if (typeof f.coverage !== 'string' || f.coverage.length < 1 || f.coverage.length > 256) fail('E_INPUT');
    fixtures.push(Object.freeze(f));
  }
  return Object.freeze({ root: p.root, fixtures: Object.freeze(fixtures), ...limits });
}

// WHAT: Ordinary-host finite-fixture controller with parent-owned staging gates.
export async function runXzFixtures(profile, dependencies = {}) {
  const d = record(dependencies, ['spawn', 'now', 'setTimeout', 'clearTimeout', 'beforeCase', 'afterCase']);
  const spawn = Object.hasOwn(d, 'spawn') ? d.spawn : nodeSpawn;
  const now = Object.hasOwn(d, 'now') ? d.now : () => performance.now();
  const schedule = Object.hasOwn(d, 'setTimeout') ? d.setTimeout : globalThis.setTimeout;
  const cancel = Object.hasOwn(d, 'clearTimeout') ? d.clearTimeout : globalThis.clearTimeout;
  for (const fn of [spawn, now, schedule, cancel, d.beforeCase, d.afterCase]) {
    if (typeof fn !== 'function' || types.isProxy(fn)) fail('E_INPUT');
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
  const p = capture(profile);
  const totalDeadline = started + p.maxTotalMs;
  const workDeadline = totalDeadline - p.cleanupMs;
  let chunkEvents = 0;
  const check = (deadline) => { if (clock() >= deadline) fail('E_DEADLINE'); };

  async function gate(fn, context, deadline) {
    check(deadline);
    let timer;
    try {
      const value = await Promise.race([
        Promise.resolve().then(() => { check(deadline); return fn(context); }),
        new Promise((resolve, reject) => {
          timer = schedule(() => reject(new XzQualificationError('E_DEADLINE')), Math.max(0, deadline - clock()));
        }),
      ]);
      check(deadline);
      receipt(value);
    } catch (error) {
      throw error instanceof XzQualificationError ? error : new XzQualificationError('E_PREREQUISITE');
    } finally {
      if (timer !== undefined) cancel(timer);
    }
  }

  function runCase(fixture, deadline) {
    return new Promise((resolve, reject) => {
      let child;
      let settled = false;
      let failure;
      let killed = false;
      let closed = false;
      let exited = false;
      let exitCode;
      let exitSignal;
      let stdinFinished = false;
      let stdoutEnded = false;
      let stderrEnded = false;
      let stdoutClosed = false;
      let stderrClosed = false;
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let workTimer;
      let cleanupTimer;
      let stdoutHash;
      let stderrHash;
      const output = [];

      function finish(error, observation) {
        if (settled) return;
        settled = true;
        if (workTimer !== undefined) cancel(workTimer);
        if (cleanupTimer !== undefined) cancel(cleanupTimer);
        if (error) reject(new XzQualificationError(error, closed));
        else resolve(observation);
      }

      function stop(code) {
        if (settled || failure) return;
        failure = code;
        if (workTimer !== undefined) cancel(workTimer);
        if (closed) { finish(code); return; }
        let remaining;
        try { remaining = Math.min(p.cleanupMs, totalDeadline - clock()); } catch { remaining = 0; }
        cleanupTimer = schedule(() => finish('E_CLEANUP'), Math.max(0, remaining));
        if (child && !killed) {
          killed = true;
          try { child.kill('SIGKILL'); } catch { /* WHAT: Cleanup remains unobserved until close. */ }
        }
      }

      function guarded(fn) {
        return (...args) => {
          if (settled) return;
          try { fn(...args); } catch (error) {
            stop(error instanceof XzQualificationError ? error.code : 'E_PIPE');
          }
        };
      }

      function data(which, chunk) {
        if (failure) return;
        check(deadline);
        if (++chunkEvents > XZ_QUALIFICATION_LIMITS.maxChunkEvents) { stop('E_EVENTS'); return; }
        if (types.isProxy(chunk) || !types.isUint8Array(chunk)) { stop('E_PIPE'); return; }
        const size = chunk.byteLength;
        if (which === 'stdout') {
          stdoutBytes += size;
          if (stdoutBytes > 65536) { stop('E_OUTPUT'); return; }
          stdoutHash.update(chunk);
          if (fixture.acceptOutput) output.push(Buffer.from(chunk));
        } else {
          stderrBytes += size;
          if (stderrBytes > 8192) { stop('E_STDERR'); return; }
          stderrHash.update(chunk);
        }
      }

      function onClose(code, signal) {
        closed = true;
        if (failure) { finish(failure); return; }
        check(deadline);
        if (!exited || signal !== null || exitSignal !== null || code !== fixture.expectedExitCode || exitCode !== code) {
          finish('E_EXIT'); return;
        }
        if (!stdinFinished || !stdoutEnded || !stderrEnded || !stdoutClosed || !stderrClosed) {
          finish('E_PIPE'); return;
        }
        const hex = fixture.acceptOutput ? Buffer.concat(output, stdoutBytes).toString('hex') : null;
        if (fixture.acceptOutput && hex !== fixture.expectedOutputHex) { finish('E_MISMATCH'); return; }
        const observation = Object.freeze({
          id: fixture.id, exitCode, signal: null, stdinFinished: true,
          stdoutEnded: true, stderrEnded: true, closeObserved: true,
          outputByteLength: stdoutBytes, outputSha256: stdoutHash.digest('hex'),
          stderrByteLength: stderrBytes, stderrSha256: stderrHash.digest('hex'),
          acceptedOutputByteLength: fixture.acceptOutput ? stdoutBytes : 0,
          integrityCheck: fixture.integrityCheck, coverage: fixture.coverage,
        });
        check(deadline);
        finish(null, observation);
      }

      try {
        check(deadline);
        stdoutHash = createHash('sha256');
        stderrHash = createHash('sha256');
        child = spawn(`${p.root}/ld-linux-x86-64.so.2`, [
          '--inhibit-cache', '--glibc-hwcaps-mask', '', '--library-path', p.root,
          `${p.root}/xz`, '--decompress', '--stdout', '--format=xz', '--threads=1',
          `--memlimit-decompress=${fixture.memoryLimitBytes}`, '--', '-',
        ], {
          cwd: p.root, env: { LC_ALL: 'C', LANG: 'C', TZ: 'UTC' },
          shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
        });
      } catch (error) {
        finish(error instanceof XzQualificationError ? error.code : 'E_SPAWN');
        return;
      }
      try {
        child.on('error', guarded(() => stop('E_SPAWN')));
        child.on('exit', guarded((code, signal) => {
          if (exited) { stop('E_EXIT'); return; }
          check(deadline);
          exited = true; exitCode = code; exitSignal = signal;
          if (signal !== null || code !== fixture.expectedExitCode) stop('E_EXIT');
        }));
        child.on('close', guarded((code, signal) => {
          closed = true;
          queueMicrotask(guarded(() => onClose(code, signal)));
        }));
        child.stdin.on('error', guarded(() => stop('E_PIPE')));
        child.stdout.on('error', guarded(() => stop('E_PIPE')));
        child.stderr.on('error', guarded(() => stop('E_PIPE')));
        child.stdin.on('finish', guarded(() => { check(deadline); stdinFinished = true; }));
        for (const [stream, which] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) {
          stream.on('data', guarded((chunk) => data(which, chunk)));
          stream.on('end', guarded(() => {
            check(deadline);
            if (which === 'stdout') stdoutEnded = true; else stderrEnded = true;
          }));
          stream.on('close', guarded(() => {
            if (which === 'stdout') stdoutClosed = true; else stderrClosed = true;
            if ((which === 'stdout' && !stdoutEnded) || (which === 'stderr' && !stderrEnded)) stop('E_PIPE');
          }));
        }
        check(deadline);
        workTimer = schedule(() => stop('E_DEADLINE'), Math.max(0, deadline - clock()));
        child.stdin.end(Buffer.from(fixture.inputHex, 'hex'));
      } catch (error) {
        stop(error instanceof XzQualificationError ? error.code : 'E_PIPE');
      }
    });
  }

  const observations = [];
  for (const fixture of p.fixtures) {
    const deadline = Math.min(workDeadline, clock() + p.maxCaseMs);
    const context = Object.freeze({ root: p.root, fixtureId: fixture.id });
    await gate(d.beforeCase, context, deadline);
    let observation;
    let caseError;
    try { observation = await runCase(fixture, deadline); } catch (error) { caseError = error; }
    if (caseError?.code === 'E_CLEANUP') throw caseError;
    await gate(d.afterCase, context, totalDeadline);
    if (caseError) throw caseError;
    observations.push(observation);
    check(workDeadline);
  }
  return Object.freeze({
    state: 'FINITE_XZ_FIXTURES_PASSED', scope: 'ordinary-host-source-context',
    root: p.root, observations: Object.freeze(observations),
    hardRssBounded: false, processTreeBounded: false, hardDeadlineGuaranteed: false,
    nativeQualified: false, decoderQualified: false, rustReady: false, trainingReady: false,
  });
}
