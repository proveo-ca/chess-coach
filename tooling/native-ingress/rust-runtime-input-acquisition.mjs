// SPEC: _spec/tooling/native-ingress/rust-runtime-inputs.puml
import fs from 'node:fs';
import https from 'node:https';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const RUST_INPUT_ROOT = '/tmp/opencode/f9-rust-runtime-inputs-01';
const ORIGIN = 'https://static.rust-lang.org';
export const REGISTERED_RUST_INPUTS = Object.freeze([
  ['cargo', 'cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz', 10984780, 'e74edd2cf7d0f1f1383b4f00eb90c843750bc489e2ccf7214e6476678a907425'],
  ['rustc', 'rustc-1.95.0-x86_64-unknown-linux-gnu.tar.xz', 80351960, '8426a3d170a5879f5682f5fbdd024a1779b3951e7baba685af2d6dc32a6dfc15'],
  ['rust-std', 'rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.xz', 29573972, '047ea7098803d3500fa1072e9cee5392697e21525559e4458128a2bf874aa382'],
  ['rustfmt-preview', 'rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.xz', 2164880, 'f1b2a7301513ffdd95ebf22ebbdd932e4d17fc806f748d93924740d0297b1396'],
  ['clippy-preview', 'clippy-1.95.0-x86_64-unknown-linux-gnu.tar.xz', 4697128, 'ac779bc9839dd47180806b133e4e2563c4a34716284cd5b8fede8ef289f452ca'],
].map(([role, name, expectedLength, sha256]) => Object.freeze({ role, name,
  url: ORIGIN + '/dist/2026-04-16/' + name, destination: RUST_INPUT_ROOT + '/' + name,
  expectedLength, sha256 })));
const SECURITY = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink'];
const FULL = [...SECURITY, 'size', 'mtimeNs', 'ctimeNs'];
const FLAGS = ['O_RDONLY', 'O_WRONLY', 'O_CREAT', 'O_EXCL', 'O_DIRECTORY', 'O_NOFOLLOW', 'O_NONBLOCK'];
const TYPED = Object.getPrototypeOf(Uint8Array.prototype);
const LENGTH = Object.getOwnPropertyDescriptor(TYPED, 'length').get;
const BACKING = Object.getOwnPropertyDescriptor(TYPED, 'buffer').get;
const ARRAY_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const RESIZABLE = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const COPY = Uint8Array.prototype.set;
const PRODUCTION = Object.freeze({ fs, https, createHash, now: () => process.hrtime.bigint(),
  geteuid: typeof process.geteuid === 'function' ? process.geteuid.bind(process) : null,
  setTimeout, clearTimeout });
const LIMITS = Object.freeze({ mkdir: 1, opens: 11, closes: 11, fstats: 32, namedStats: 32,
  euid: 1, reads: 4096, writes: 32768, gets: 5 });
const CODES = Object.freeze(['E_METADATA', 'E_BINDING', 'E_ROOT', 'E_FILE', 'E_FLAGS', 'E_UID', 'E_MKDIR',
  'E_DEADLINE', 'E_CLOCK', 'E_LIMIT', 'E_CLOSE', 'E_CLEANUP', 'E_HTTP', 'E_HEADERS', 'E_CHUNK', 'E_LENGTH', 'E_HASH', 'E_IO']);
const reject = code => { const error = new Error(code); error.code = code; throw error; };
const requireThat = (ok, code) => { if (!ok) reject(code); };
const equal = (a, b, keys = FULL) => keys.every(key => a[key] === b[key]);
const printable = value => Object.freeze(Object.fromEntries(FULL.map(key => [key, value[key].toString()])));

function metadata(value) {
  requireThat(value && typeof value === 'object' && !types.isProxy(value), 'E_METADATA');
  const result = {};
  for (const key of FULL) {
    const field = Object.getOwnPropertyDescriptor(value, key);
    requireThat(field && Object.hasOwn(field, 'value') && typeof field.value === 'bigint', 'E_METADATA');
    requireThat(field.value <= 0xffffffffffffffffn &&
      field.value >= (key.endsWith('Ns') ? -0x8000000000000000n : 0n), 'E_METADATA');
    result[key] = field.value;
  }
  return Object.freeze(result);
}

function assertHeaders(response, expectedLength) {
  requireThat(response.statusCode === 200 && response.socket?.authorized === true, 'E_HTTP');
  const raw = response.rawHeaders;
  requireThat(Array.isArray(raw) && !types.isProxy(raw) && raw.length <= 64 && raw.length % 2 === 0, 'E_HEADERS');
  let bytes = 2, lengths = 0, encodings = 0;
  for (let i = 0; i < raw.length; i += 2) {
    const key = Object.getOwnPropertyDescriptor(raw, String(i));
    const value = Object.getOwnPropertyDescriptor(raw, String(i + 1));
    requireThat(key && value && Object.hasOwn(key, 'value') && Object.hasOwn(value, 'value'), 'E_HEADERS');
    const name = key.value, text = value.value;
    requireThat(typeof name === 'string' && typeof text === 'string' && name.length <= 16384 && text.length <= 16384 &&
      /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) && /^[\t\x20-\x7e\x80-\xff]*$/.test(text), 'E_HEADERS');
    bytes += name.length + text.length + 4;
    requireThat(bytes <= 16384, 'E_HEADERS');
    const lower = name.toLowerCase();
    if (lower === 'content-length') {
      lengths++;
      requireThat(lengths === 1 && text === String(expectedLength), 'E_HEADERS');
    }
    if (lower === 'content-encoding') {
      encodings++;
      requireThat(encodings === 1 && text.toLowerCase() === 'identity', 'E_HEADERS');
    }
    requireThat(lower !== 'transfer-encoding' && lower !== 'content-range', 'E_HEADERS');
  }
  requireThat(lengths === 1, 'E_HEADERS');
}

// WHAT: Optional dependencies are the test TCB and cannot produce a production match.
export function acquireRegisteredRustInputs(trustedDeps) {
  const start = (trustedDeps === undefined ? PRODUCTION : trustedDeps).now();
  return acquire(start, trustedDeps === undefined ? PRODUCTION : trustedDeps,
    REGISTERED_RUST_INPUTS, trustedDeps !== undefined);
}

// WHAT: Fixed tiny mock profile; requires a complete mock dependency bundle.
export function acquireMockRustInputs(trustedDeps) {
  const start = trustedDeps.now();
  for (const key of ['fs', 'https', 'now', 'geteuid', 'createHash', 'setTimeout', 'clearTimeout']) {
    requireThat(Object.hasOwn(trustedDeps, key) && trustedDeps[key] !== PRODUCTION[key], 'E_MOCK_TCB');
  }
  const lengths = [3, 5, 7, 11, 13];
  const inputs = REGISTERED_RUST_INPUTS.map((d, index) => Object.freeze({ ...d,
    expectedLength: lengths[index],
    sha256: createHash('sha256').update(Buffer.alloc(lengths[index], index + 1)).digest('hex') }));
  return acquire(start, trustedDeps, inputs, true);
}

async function acquire(start, deps, inputs, mockOnly) {
  const end = typeof start === 'bigint' ? start + 600000000000n : 0n;
  const workEnd = end - 3000000000n, total = inputs.reduce((n, d) => n + d.expectedLength, 0);
  const counts = { clockReads: 1, mkdir: 0, opens: 0, closes: 0, fstats: 0, namedStats: 0,
    euid: 0, reads: 0, writes: 0, gets: 0, dataEvents: 0, acceptedBytes: 0, copiedBytes: 0,
    writtenBytes: 0, readbackBytes: 0, peakOwnedFds: 0, destroyRequests: 0, destroyResponses: 0 };
  const attempts = Object.fromEntries(Object.keys(LIMITS).map(key => [key, 0]));
  const root = { fd: null }, file = { fd: null }, attemptedInputs = [], verifiedInputs = [];
  let error = null, last = start, rootCreated = false, closeFailed = false, cleanupUncertain = false;
  let ioAccountingComplete = true, uid, rootBirth, rootCurrent, rootFinal;
  let activeRecord = null, activeCounts = null, activeCloseAttempts = 0;
  const poison = code => { if (error === null) error = CODES.includes(code) ? code : 'E_IO'; };
  function completeRecordCounts() {
    if (!activeRecord) return;
    activeRecord.counts = Object.freeze(Object.fromEntries(
      ['clockReads', 'opens', 'closes', 'fstats', 'namedStats', 'reads', 'writes', 'gets']
        .map(key => [key, counts[key] - activeCounts[key]]).concat([
          ['closeAttempts', attempts.closes - activeCloseAttempts],
        ])));
  }
  function sample(cleanup = false) {
    requireThat(counts.clockReads < (cleanup ? 262144 : 262140), 'E_LIMIT');
    counts.clockReads++;
    const value = deps.now();
    requireThat(typeof value === 'bigint' && value >= last, 'E_CLOCK');
    last = value;
    return value;
  }
  function guard(deadline = workEnd) {
    if (error) reject(error);
    requireThat(sample() < deadline, 'E_DEADLINE');
  }
  function admit(key) {
    requireThat(attempts[key] < LIMITS[key], 'E_LIMIT');
    attempts[key]++;
  }
  function call(key, action, deadline = workEnd) {
    guard(deadline); admit(key);
    let value;
    try { value = action(); counts[key]++; }
    catch (failure) { ioAccountingComplete = false; throw failure; }
    guard(deadline);
    return value;
  }
  function work(action, deadline) {
    guard(deadline); const value = action(); guard(deadline); return value;
  }
  function open(holder, target, flags, mode, deadline) {
    requireThat(!closeFailed && holder.fd === null, 'E_CLOSE');
    call('opens', () => {
      holder.fd = deps.fs.openSync(target, flags, mode);
      counts.peakOwnedFds = Math.max(counts.peakOwnedFds, Number(root.fd !== null) + Number(file.fd !== null));
    }, deadline);
  }
  function close(holder) {
    if (holder.fd === null) return;
    const fd = holder.fd;
    holder.fd = null;
    attempts.closes++;
    try { deps.fs.closeSync(fd); counts.closes++; }
    catch { closeFailed = true; ioAccountingComplete = false; error = 'E_CLOSE'; }
  }
  function pair(holder, target, deadline) {
    const fd = metadata(call('fstats', () => deps.fs.fstatSync(holder.fd, { bigint: true }), deadline));
    const named = metadata(call('namedStats', () => deps.fs.lstatSync(target, { bigint: true }), deadline));
    requireThat(equal(fd, named), 'E_BINDING');
    return fd;
  }
  function checkRoot(deadline, stable = false) {
    const current = pair(root, RUST_INPUT_ROOT, deadline);
    requireThat((current.mode & 0o170000n) === 0o040000n &&
      (current.mode & 0o7777n) === 0o700n && current.uid === uid && current.nlink === 2n, 'E_ROOT');
    if (rootBirth) requireThat(equal(current, rootBirth, SECURITY), 'E_BINDING');
    if (rootCurrent) requireThat(stable ? equal(current, rootCurrent) : current.size >= rootCurrent.size, 'E_BINDING');
    rootCurrent = current;
    return current;
  }
  function checkFile(value, born, size) {
    requireThat((value.mode & 0o170000n) === 0o100000n && (value.mode & 0o7777n) === 0o600n &&
      value.uid === uid && value.nlink === 1n && value.size === BigInt(size), 'E_FILE');
    if (born) requireThat(equal(value, born, SECURITY), 'E_BINDING');
  }

  function transfer(d, record, deadline) {
    return new Promise((resolve, rejectPromise) => {
      let request, response, requestClosed = false, responseClosed = false, ended = false;
      let failed = false, settled = false, acquiring = false, cleaning = false;
      let destroyedRequest = false, destroyedResponse = false, timer, cleanupTimer, cleanupEnd;
      const incoming = work(() => deps.createHash('sha256'), deadline);
      function finish() {
        if (settled || acquiring || cleaning) return;
        if (failed ? (!request || requestClosed) && (!response || responseClosed) : ended && requestClosed && responseClosed) {
          settled = true;
          deps.clearTimeout(timer); deps.clearTimeout(cleanupTimer);
          if (failed) rejectPromise(new Error(error)); else resolve(incoming);
        }
      }
      function destroy() {
        if (response && !destroyedResponse) {
          destroyedResponse = true; counts.destroyResponses++;
          try { response.destroy(); } catch { cleanupUncertain = true; error = 'E_CLEANUP'; }
        }
        if (request && !destroyedRequest) {
          destroyedRequest = true; counts.destroyRequests++;
          try { request.destroy(); } catch { cleanupUncertain = true; error = 'E_CLEANUP'; }
        }
      }
      function abort(code) {
        if (settled) return;
        poison(code);
        if (!failed) {
          failed = true; cleaning = true;
          deps.clearTimeout(timer);
          let time = last;
          try { time = sample(true); } catch { cleanupUncertain = true; error = 'E_CLEANUP'; }
          cleanupEnd = time + 3000000000n < end ? time + 3000000000n : end;
          cleanupTimer = deps.setTimeout(() => {
            if (settled) return;
            cleanupUncertain = true; error = 'E_CLEANUP'; settled = true;
            rejectPromise(new Error('E_CLEANUP'));
          }, Math.max(0, Number((cleanupEnd - time + 999999n) / 1000000n)));
        }
        destroy(); cleaning = false; finish();
      }
      function event(action) {
        if (settled || failed) return;
        try { guard(deadline); action(); guard(deadline); finish(); }
        catch (failure) { abort(failure?.code ?? 'E_IO'); }
      }
      function closed(kind) {
        if (kind === 'request') requestClosed = true; else responseClosed = true;
        if (failed && !settled) {
          try { requireThat(sample(true) < cleanupEnd, 'E_CLEANUP'); }
          catch { cleanupUncertain = true; error = 'E_CLEANUP'; }
        }
        if (kind === 'response') event(() => requireThat(ended, 'E_HTTP'));
        else if (!response) event(() => reject('E_HTTP'));
        finish();
      }
      function receive(value) {
        if (response) { abort('E_HTTP'); return; }
        response = value;
        response.on('error', () => abort('E_HTTP'));
        response.on('aborted', () => abort('E_HTTP'));
        response.on('close', () => closed('response'));
        response.on('end', () => event(() => {
          requireThat(!ended && response.complete === true, 'E_HTTP');
          requireThat(record.acceptedBytes === d.expectedLength, 'E_LENGTH');
          ended = true;
        }));
        response.on('data', chunk => event(() => {
          requireThat(!ended && !responseClosed, 'E_HTTP');
          requireThat(!types.isProxy(chunk) && Buffer.isBuffer(chunk), 'E_CHUNK');
          let length;
          try {
            length = LENGTH.call(chunk);
            const backing = BACKING.call(chunk);
            ARRAY_LENGTH.call(backing);
            requireThat(!RESIZABLE || !RESIZABLE.call(backing), 'E_CHUNK');
          } catch { reject('E_CHUNK'); }
          requireThat(length > 0 && length <= 1048576, 'E_CHUNK');
          requireThat(record.dataEvents < 16384 && counts.dataEvents < 32768 && attempts.writes < 32768, 'E_LIMIT');
          requireThat(length <= d.expectedLength - record.acceptedBytes && length <= total - counts.acceptedBytes, 'E_LENGTH');
          const offset = record.acceptedBytes;
          const bytes = work(() => {
            const copy = Buffer.alloc(length); COPY.call(copy, chunk); return copy;
          }, deadline);
          record.dataEvents++; counts.dataEvents++;
          record.acceptedBytes += length; counts.acceptedBytes += length; counts.copiedBytes += length;
          work(() => incoming.update(bytes), deadline);
          const written = call('writes', () => {
            const n = deps.fs.writeSync(file.fd, bytes, 0, length, offset);
            if (Number.isInteger(n) && n >= 0 && n <= length) { counts.writtenBytes += n; record.writtenBytes += n; }
            return n;
          }, deadline);
          requireThat(written === length, 'E_IO');
        }));
        if (failed || settled) { destroy(); return; }
        event(() => assertHeaders(response, d.expectedLength));
      }
      try {
        guard(deadline);
        timer = deps.setTimeout(() => abort('E_DEADLINE'), Math.max(0, Number((deadline - last + 999999n) / 1000000n)));
        acquiring = true;
        try {
          call('gets', () => {
            request = deps.https.request({ hostname: 'static.rust-lang.org', servername: 'static.rust-lang.org',
              port: 443, path: d.url.slice(ORIGIN.length), method: 'GET', agent: false,
              rejectUnauthorized: true, insecureHTTPParser: false, maxHeaderSize: 16384,
              headers: { 'Accept-Encoding': 'identity', Connection: 'close' } });
            request.on('error', () => abort('E_HTTP'));
            request.on('close', () => closed('request'));
            request.on('response', receive);
            request.maxHeadersCount = 33;
          }, deadline);
        } finally { acquiring = false; }
        if (failed) { destroy(); finish(); }
        else work(() => request.end(), deadline);
      } catch (failure) { acquiring = false; abort(failure?.code ?? 'E_HTTP'); }
    });
  }

  try {
    requireThat(typeof start === 'bigint' && start >= 0n, 'E_CLOCK');
    guard();
    const C = deps.fs.constants;
    for (const key of FLAGS) {
      requireThat(Number.isInteger(C[key]) && C[key] === fs.constants[key] &&
        (key === 'O_RDONLY' ? C[key] === 0 : C[key] > 0), 'E_FLAGS');
    }
    requireThat(typeof deps.geteuid === 'function', 'E_UID');
    const euid = call('euid', () => deps.geteuid());
    requireThat(Number.isInteger(euid) && euid >= 0 && euid <= 4294967295, 'E_UID');
    uid = BigInt(euid);
    try { call('mkdir', () => { deps.fs.mkdirSync(RUST_INPUT_ROOT, { mode: 0o700, recursive: false }); rootCreated = true; }); }
    catch (failure) { reject(failure?.code === 'E_DEADLINE' ? 'E_DEADLINE' : 'E_MKDIR'); }
    open(root, RUST_INPUT_ROOT, C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW | C.O_NONBLOCK);
    rootBirth = checkRoot();
    const scratch = work(() => Buffer.alloc(65536));
    for (const d of inputs) {
      const baseline = { ...counts }, closeBaseline = attempts.closes;
      const entry = sample(), deadline = entry + 119000000000n < workEnd ? entry + 119000000000n : workEnd;
      guard(deadline);
      const record = { ...d, dataEvents: 0, acceptedBytes: 0, writtenBytes: 0, readbackBytes: 0,
        incomingSha256: null, readbackSha256: null, verified: false, snapshots: {} };
      attemptedInputs.push(record);
      activeRecord = record; activeCounts = baseline; activeCloseAttempts = closeBaseline;
      try {
        open(file, d.destination, C.O_WRONLY | C.O_CREAT | C.O_EXCL | C.O_NOFOLLOW | C.O_NONBLOCK, 0o600, deadline);
        const born = pair(file, d.destination, deadline); checkFile(born, null, 0);
        record.snapshots.born = printable(born);
        record.snapshots.rootAfterCreate = printable(checkRoot(deadline));
        const incoming = await transfer(d, record, deadline);
        record.incomingSha256 = work(() => incoming.digest('hex'), deadline);
        requireThat(record.incomingSha256 === d.sha256, 'E_HASH');
        const written = pair(file, d.destination, deadline); checkFile(written, born, d.expectedLength);
        record.snapshots.written = printable(written);
        close(file); guard(deadline);
        open(file, d.destination, C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK, undefined, deadline);
        const before = pair(file, d.destination, deadline); checkFile(before, born, d.expectedLength);
        requireThat(equal(before, written), 'E_BINDING'); record.snapshots.readBefore = printable(before);
        const readback = work(() => deps.createHash('sha256'), deadline);
        for (let offset = 0; offset < d.expectedLength;) {
          const want = Math.min(65536, d.expectedLength - offset);
          const n = call('reads', () => {
            const n = deps.fs.readSync(file.fd, scratch, 0, want, offset);
            if (Number.isInteger(n) && n > 0 && n <= want) { counts.readbackBytes += n; record.readbackBytes += n; }
            return n;
          }, deadline);
          requireThat(n === want, 'E_IO');
          work(() => readback.update(scratch.subarray(0, n)), deadline); offset += n;
        }
        const eof = call('reads', () => {
          const n = deps.fs.readSync(file.fd, scratch, 0, 1, d.expectedLength);
          if (n === 1) { counts.readbackBytes++; record.readbackBytes++; }
          return n;
        }, deadline);
        requireThat(eof === 0, 'E_LENGTH');
        record.readbackSha256 = work(() => readback.digest('hex'), deadline);
        requireThat(record.readbackSha256 === d.sha256, 'E_HASH');
        const after = pair(file, d.destination, deadline); checkFile(after, born, d.expectedLength);
        requireThat(equal(after, written), 'E_BINDING'); record.snapshots.readAfter = printable(after);
      } finally { close(file); }
      guard(deadline); record.snapshots.rootAfterRead = printable(checkRoot(deadline, true));
      completeRecordCounts(); activeRecord = null;
      record.verified = true; verifiedInputs.push(record);
    }
    rootFinal = checkRoot(workEnd, true);
    requireThat(verifiedInputs.length === 5 && counts.acceptedBytes === total && counts.readbackBytes === total, 'E_LENGTH');
    const expectedReads = inputs.reduce((n, d) => n + Math.ceil(d.expectedLength / 65536) + 1, 0);
    requireThat(counts.fstats === 32 && counts.namedStats === 32 && counts.opens === 11 &&
      counts.gets === 5 && counts.reads === expectedReads, 'E_LIMIT');
  } catch (failure) {
    completeRecordCounts();
    poison(failure?.code);
  } finally { close(file); close(root); }
  for (const record of attemptedInputs) { Object.freeze(record.snapshots); Object.freeze(record); }
  const rootBirthOutput = rootBirth ? printable(rootBirth) : null;
  const rootFinalOutput = rootFinal ? printable(rootFinal) : null;
  if (!error) {
    try { guard(end); requireThat(counts.closes === 11 && attempts.closes === 11, 'E_CLOSE'); }
    catch (failure) { poison(failure?.code ?? 'E_IO'); }
  }
  if (mockOnly && !error) error = 'E_MOCK_ONLY';
  return Object.freeze({ profile: 'registered-rust-runtime-inputs-v1', status: error ? 'STOP' : 'RUST_INPUT_BYTES_MATCHED',
    error, mockOnly, root: RUST_INPUT_ROOT, rootCreated, expectedTotalBytes: total,
    registeredExpectedTotalBytes: 127772720, verifiedInputs: Object.freeze(verifiedInputs),
    attemptedInputs: Object.freeze(attemptedInputs), counts: Object.freeze(counts), attempts: Object.freeze(attempts),
    rootBirth: rootBirthOutput, rootFinal: rootFinalOutput,
    closeFailed, cleanupUncertain, ioAccountingComplete,
    counterScope: 'completedLogicalNodeOperations; attempts separately; returned positive IO bytes only',
    acceptedBytesScope: 'logically admitted copied chunks, not all wire bytes',
    ownedFdScope: 'root plus one file; excludes implicit runtime and network descriptors',
    counterLowerBoundsOnFailure: !ioAccountingComplete,
    archiveExtracted: false, installedUsability: false, nativeQualified: false, rustReady: false,
    trainingReady: false, nativeAuthority: false, filesInstalled: false, pinComplete: false,
    ancestorStabilityProved: false, sameUidRaceExcluded: false, durableStorageProved: false,
    nodeBootstrapAuthenticated: false, tlsCertificatePinned: false, hardDeadlineGuaranteed: false,
    trustScope: 'ordinary trusted Node and default verified TLS; finite metadata observations; DATA only' });
}
