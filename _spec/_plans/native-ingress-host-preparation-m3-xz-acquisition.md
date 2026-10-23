# F9 M3 — XZ input set, opaque acquisition proposal only

**[Unverified] 2026-10-23 · XZ DESIGN-SELECTED / INERT SOURCE MEASURED + SYNTAX CHECKED / FILESYSTEM + NETWORK GRANTS NONE / NOT INSTALLED / trainingReady:false.**

## 1. Actual selection, provenance and scope

Executor actually selected `XZ only (Recommended)` for INPUT-SET DESIGN ONLY.
This resolves the former format-NONE checkpoint, not a timer vote or operational grant.
Parent supplies HEAD `7ef254ed43315825642164ae821e8bf0d109a802`, PR50 OPEN/clean and Architect `ses_e99441d55ffezZyja068S735Jf` (clarification resolved) plus DevOps `ses_e99441bdaffeifYrUScVFywbvU` advice.
Those advisers support opaque content acquisition without a decompressor, not installer/XZ/rustup compatibility proof; the keeper did not call agents or verify that checkpoint.
No command, hash, syntax check, test, mock, network or runtime operation ran in this authoring pass.
This proposal is one Node literal-eval body plus one waiting Bash parent; Node imports ONLY fs/https/crypto and starts no other program.
No extraction, archive execution/decoding/parsing, rustup, mise, installation, helper, dependency, target, project source/test or control-file creation belongs to this packet.
Gzip is UNSELECTED, not fallback. Unsupported XZ in a later installer means STOP.

## 2. Independent frozen expectations — advertised is not actual

The [immutable manifest ledger](native-ingress-host-preparation-m3-manifest-outcome.md#4-immutable-historical-reference-ledger) supplies the five XZ URL/hash pairs; the [HEAD outcome](native-ingress-host-preparation-m3-length-outcome.md#3-separate-derived-observations--metadata-only) supplies advertised lengths.
Manifest expectation:848342 bytes, SHA-256 `821ff14e4c4a1cbe1e8915f35aff0a3fbbdf8d293ad48ab8f31e3b0440c581f9`; this is historical metadata, not new publisher authentication.
Register THESE independent expected inputs before any future actual GET-body digest claim; no worker/model/manifest-supplied dynamic input is accepted by the source.
The expectedLength column promotes a previously advertised length to a future exact comparison target, not an observation of downloaded bytes.

| Role | Full literal URL | Exact local filename | expectedLength | Expected SHA-256 |
|---|---|---|---|---|
| cargo | https://static.rust-lang.org/dist/2026-04-16/cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz | cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz | 10984780 | e74edd2cf7d0f1f1383b4f00eb90c843750bc489e2ccf7214e6476678a907425 |
| rustc | https://static.rust-lang.org/dist/2026-04-16/rustc-1.95.0-x86_64-unknown-linux-gnu.tar.xz | rustc-1.95.0-x86_64-unknown-linux-gnu.tar.xz | 80351960 | 8426a3d170a5879f5682f5fbdd024a1779b3951e7baba685af2d6dc32a6dfc15 |
| rust-std | https://static.rust-lang.org/dist/2026-04-16/rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.xz | rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.xz | 29573972 | 047ea7098803d3500fa1072e9cee5392697e21525559e4458128a2bf874aa382 |
| rustfmt-preview | https://static.rust-lang.org/dist/2026-04-16/rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.xz | rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.xz | 2164880 | f1b2a7301513ffdd95ebf22ebbdd932e4d17fc806f748d93924740d0297b1396 |
| clippy-preview | https://static.rust-lang.org/dist/2026-04-16/clippy-1.95.0-x86_64-unknown-linux-gnu.tar.xz | clippy-1.95.0-x86_64-unknown-linux-gnu.tar.xz | 4697128 | ac779bc9839dd47180806b133e4e2563c4a34716284cd5b8fede8ef289f452ca |

Expected sum127772720 bytes; changing representation, length or hash means STOP, never alternate bytes or compression.
Historical MANIFEST_ADVERTISED/byteLength:null/pinComplete:false/payloadVerified:false ledgers and all HEAD metadata remain unchanged forever.
Even five future matches leave `pinComplete:false`: the full acquisition/source/native graph is not closed.

## 3. Proposed destinations, custody and residuals

Installation root `/tmp/opencode/f9-host-rust-1.95.0-m3` MUST remain uncreated by this packet.
The SEPARATE new staging literal `/tmp/opencode/f9-m3-xz-inputs-01` is UNOBSERVED, not reserved or approved for creation.

```text
/tmp/opencode/f9-m3-xz-inputs-01/cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz
/tmp/opencode/f9-m3-xz-inputs-01/rustc-1.95.0-x86_64-unknown-linux-gnu.tar.xz
/tmp/opencode/f9-m3-xz-inputs-01/rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.xz
/tmp/opencode/f9-m3-xz-inputs-01/rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.xz
/tmp/opencode/f9-m3-xz-inputs-01/clippy-1.95.0-x86_64-unknown-linux-gnu.tar.xz
```

Exclusively mkdir0700/recursive:false once. EEXIST OR ANY mkdir error stops without reading/statting/reusing/repairing/deleting it or choosing another root.
Validate real builtin flag constants before mkdir; only O_RDONLY may be zero, and no O_CLOEXEC constant is invented.
Open root read-only/directory/nofollow/nonblock; fstat requires directory, exact0700 and the one U32 geteuid result.
Open each file before its GET, write-only/create/exclusive/nofollow/nonblock0600; born fstat requires regular file, uid=euid, exact0600, nlink1, size0 and root device.
Retain root plus ONE writer OR reader: at most two managed owned file FDs; implicit runtime/network descriptors are outside that count.
Every acquired FD enters an already-active owned try/finally; release its holder BEFORE exactly one closeSync attempt, never retry.
Cleanup always attempts active-file close then root close, even after deadline/counter failure; uncertain physical close is not physical-FD proof.
Any close failure is absorbing STOP and forbids new opens; partial files and root remain retained indefinitely absent fresh grants, without rollback/delete/resume/fsync/durability claims.
Root is a private intended write scope, NOT an OS access barrier, protected Native capture root or descriptor-relative openat namespace.
Node builtins here lack openat; stable absolute-path ancestors and ordinary host/kernel/path behavior remain explicit residuals.
No directory listing, source/cache/home/proc/log/receipt/control/daemon/installed-root observation belongs to this packet.

## 4. Finite source profile and clock contract — not a public fee

START is the FIRST body statement immediately after imports, using process.hrtime.bigint(), BEFORE mkdir, DNS or request creation; NEVER the first HTTP body byte.
END=START+600000ms includes root setup, all HTTP, writes and readback; establish each file deadline MIN(file-entry+120000ms,END) BEFORE file creation/request.
Network failure requests destroy once per active object and settles after observed closes or cooperative1000ms cleanup, bounded by absolute START+601000ms; requested outer620000ms remains a request only.
All timers/guards are cooperative ordinary-host checks, not synchronous-call interruption, kernel scheduling, DNS/TLS cancellation or process-tree hard termination guarantees.
Native CA/module startup, resolver/connect attempts, native buffering, hidden builtin I/O and RSS/CPU are not source-call counters or a closed native graph.

| Source counter / storage | Proposed cap / interpretation |
|---|---|
| mkdir / opens / closes / fstats / geteuid | 1 /11 /11 /32 /1; close attempts stay unconditional, even on failure |
| fstat breakdown | Root initial1 + before/after each file10 + final1 =12; files born/after-write/read-before/read-after =20 |
| readSync / writeSync on files | 4096 including five EOF probes /32768; one write per accepted chunk, no short-write retry |
| Accepted bytes / data events | Per-file exact expectedLength; global≤127772720; per-file≤16384/global≤32768 accepted data events |
| Buffer-first admission / scratch | Every incoming chunk Buffer, positive1..1048576 BEFORE counters/hash/write; one current≤1MiB chunk plus one64KiB read buffer, no payload buffer array |
| Clock / source GETs | ≤262144 samples including START /≤5 sequential fixed GET calls; not native syscall/callback/socket/DNS counts |
| Authored output | One ASCII JSONLF≤24576 bytes via ONE EXTRA FD1 write plus parent marker≤64; total≤24640, not hard startup/capture cap |

Overflow callbacks reject and late callbacks are ignored; accepted-event bounds do not claim a bound on every native callback or wire byte.
`acceptedBytes` counts logically admitted file chunks, not all transport bytes or successful durable bytes; partial output may remain on disk.
No exact kernel-write count, memory hard limit, CPU hard limit, game-work meter, public game-work fee change, credit restoration, escrow or new public allowance follows.
Preserve ONE BOTH-seat1048576, unchanged F1/charged replay, original cold10s/lifecycle300s including3s and separate generator2048.

## 5. Inert source — NEVER execute before registration, review and ONE fresh HITL

The closed reason set is NONE, TIME, COUNTER, FLAGS, UID, MKDIR, IO, STAT, HTTP, CHUNK, LENGTH, HASH, CLOSE, OUTPUT, CONTENT_MATCHED.
Each GET requires status200, exactly one canonical exact Content-Length, absent/one identity encoding, no Transfer-Encoding,16KiB headers/64 raw entries/32 pairs and default verified TLS.
There are no redirects/retries/mirrors/Range/alternate GETs/suffix resumption/auth/custom CA/env-proxy behavior in this authored request policy; this is not a firewall or zero-implicit-I/O assertion.
Success requires incoming end/complete AND both closes before final incoming SHA, writer stat/close, same-file readback and publication; failure cannot restore success.
Writer birth security dev/ino/mode/uid/gid/nlink stays equal; size/times may change through writes. Full BigInt dev/ino/mode/uid/gid/nlink/size/mtimeNs/ctimeNs snapshots bind read-before/read-after to after-write.
Readback requests exact64KiB slices without short-read retry, then one1-byte EOF probe returning0 and an independent SHA match; each prefix record follows reader-close success and root-after check.
Final root check AND successful root close precede overall CONTENT_MATCHED_NOW; five prefix records can honestly coexist with overall STOP after root-close failure.

<!-- BEGIN F9 M3 XZ ACQUISITION NODE V1 -->
```mjs
import fs from 'node:fs';
import https from 'node:https';
import crypto from 'node:crypto';
const START = process.hrtime.bigint();
const MS = 1000000n, END = START + 600000n * MS, CLEANEND = END + 1000n * MS;
const ROOT = '/tmp/opencode/f9-m3-xz-inputs-01', TOTAL = 127772720;
const inputs = [
  { role: 'cargo', name: 'cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz', expectedLength: 10984780,
    url: 'https://static.rust-lang.org/dist/2026-04-16/cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz',
    sha256: 'e74edd2cf7d0f1f1383b4f00eb90c843750bc489e2ccf7214e6476678a907425' },
  { role: 'rustc', name: 'rustc-1.95.0-x86_64-unknown-linux-gnu.tar.xz', expectedLength: 80351960,
    url: 'https://static.rust-lang.org/dist/2026-04-16/rustc-1.95.0-x86_64-unknown-linux-gnu.tar.xz',
    sha256: '8426a3d170a5879f5682f5fbdd024a1779b3951e7baba685af2d6dc32a6dfc15' },
  { role: 'rust-std', name: 'rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.xz', expectedLength: 29573972,
    url: 'https://static.rust-lang.org/dist/2026-04-16/rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.xz',
    sha256: '047ea7098803d3500fa1072e9cee5392697e21525559e4458128a2bf874aa382' },
  { role: 'rustfmt-preview', name: 'rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.xz', expectedLength: 2164880,
    url: 'https://static.rust-lang.org/dist/2026-04-16/rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.xz',
    sha256: 'f1b2a7301513ffdd95ebf22ebbdd932e4d17fc806f748d93924740d0297b1396' },
  { role: 'clippy-preview', name: 'clippy-1.95.0-x86_64-unknown-linux-gnu.tar.xz', expectedLength: 4697128,
    url: 'https://static.rust-lang.org/dist/2026-04-16/clippy-1.95.0-x86_64-unknown-linux-gnu.tar.xz',
    sha256: 'ac779bc9839dd47180806b133e4e2563c4a34716284cd5b8fede8ef289f452ca' },
].map(d => ({ ...d, destination: ROOT + '/' + d.name }));
const counts = {
  clock: 1, mkdir: 0, opens: 0, closes: 0, fstats: 0, euid: 0,
  reads: 0, writes: 0, gets: 0, data: 0, acceptedBytes: 0, stdout: 0,
};
const root = { fd: null }, file = { fd: null }, records = [], createdPaths = [];
let reason = 'NONE', rootCreated = false, closeFailed = false, httpCloseUncertain = false;
let lastNow = START, euid, rootStat;
process.exitCode = 3;
function poison(r) {
  if (reason === 'NONE') reason = r;
}
function fail(r) { poison(r); throw new Error('STOP'); }
function sample() {
  if (counts.clock >= 262144) fail('COUNTER');
  counts.clock += 1; lastNow = process.hrtime.bigint(); return lastNow;
}
function guard(dl = END) {
  if (reason !== 'NONE') throw new Error('STOP');
  if (sample() >= dl) fail('TIME');
}
function bump(k, cap) {
  if (counts[k] >= cap) fail('COUNTER');
  counts[k] += 1;
}
function call(k, cap, fn, dl = END) {
  guard(dl); bump(k, cap); const value = fn(); guard(dl); return value;
}
function close(h) {
  if (h.fd === null) return;
  const fd = h.fd; h.fd = null; counts.closes += 1;
  try { fs.closeSync(fd); } catch { closeFailed = true; reason = 'CLOSE'; }
}
function stat(h, dl) {
  return call('fstats', 32, () => fs.fstatSync(h.fd, { bigint: true }), dl);
}
const security = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink'];
const full = [...security, 'size', 'mtimeNs', 'ctimeNs'];
function same(a, b, keys) {
  return keys.every(k => typeof a[k] === 'bigint' && a[k] === b[k]);
}
function checkRoot(dl) {
  const s = stat(root, dl);
  if (!s.isDirectory() || !same(s, rootStat, security)) fail('STAT');
}
function checkFile(s, born, size) {
  if (!s.isFile() || !same(s, born, security) || s.size !== BigInt(size)) fail('STAT');
}
function acquire(d, dl, hash) {
  return new Promise((resolve, reject) => {
    let req, res, rqClose = false, rsClose = false, ended = false, settled = false, failed = false;
    let reqDestroyed = false, resDestroyed = false, timer, cleanup, bytes = 0, events = 0;
    const finish = () => {
      if (settled) return;
      const closed = (!req || rqClose) && (!res || rsClose);
      if (failed ? closed : ended && rqClose && rsClose) {
        settled = true; clearTimeout(timer); clearTimeout(cleanup);
        if (failed) reject(new Error('STOP')); else resolve(bytes);
      }
    };
    const destroy = () => {
      if (res && !resDestroyed) { resDestroyed = true; try { res.destroy(); } catch {} }
      if (req && !reqDestroyed) { reqDestroyed = true; try { req.destroy(); } catch {} }
    };
    const abort = r => {
      if (settled) return;
      poison(r);
      if (!failed) {
        failed = true; clearTimeout(timer);
        let wait = 0;
        try { wait = Math.max(0, Math.min(1000, Number((CLEANEND - sample()) / MS))); } catch {}
        cleanup = setTimeout(() => {
          if (settled) return;
          httpCloseUncertain = true; settled = true; reject(new Error('STOP'));
        }, wait);
      }
      destroy(); finish();
    };
    const run = fn => {
      if (settled || failed) return;
      try { guard(dl); fn(); guard(dl); finish(); } catch { abort(reason === 'NONE' ? 'IO' : reason); }
    };
    try {
      guard(dl); bump('gets', 5);
      timer = setTimeout(() => abort('TIME'), Math.max(0, Number((dl - lastNow) / MS)));
      req = https.request({ hostname: 'static.rust-lang.org', servername: 'static.rust-lang.org', port: 443,
        path: d.url.slice('https://static.rust-lang.org'.length), method: 'GET', agent: false,
        rejectUnauthorized: true, maxHeaderSize: 16384,
        headers: { 'Accept-Encoding': 'identity', Connection: 'close', 'User-Agent': 'F9-M3-XZ-V1' } }, r => {
        res = r;
        res.on('error', () => abort('HTTP')); res.on('aborted', () => abort('HTTP'));
        res.on('close', () => {
          rsClose = true;
          if (!ended) abort('HTTP'); else run(() => {});
          finish();
        });
        res.on('end', () => run(() => {
          if (!res.complete || bytes !== d.expectedLength) fail('LENGTH'); ended = true;
        }));
        if (settled || failed) { destroy(); return; }
        run(() => {
          const raw = res.rawHeaders, lengths = [], encodings = [];
          if (res.statusCode !== 200 || !Array.isArray(raw) || raw.length > 64 || raw.length % 2) fail('HTTP');
          for (let i = 0; i < raw.length; i += 2) {
            if (typeof raw[i] !== 'string' || typeof raw[i + 1] !== 'string') fail('HTTP');
            const key = raw[i].toLowerCase();
            if (key === 'content-length') lengths.push(raw[i + 1]);
            if (key === 'content-encoding') encodings.push(raw[i + 1]);
            if (key === 'transfer-encoding') fail('HTTP');
          }
          if (lengths.length !== 1 || lengths[0] !== String(d.expectedLength) ||
              encodings.length > 1 || (encodings.length === 1 && encodings[0].toLowerCase() !== 'identity')) fail('HTTP');
        });
        res.on('data', chunk => run(() => {
          if (!Buffer.isBuffer(chunk) || chunk.length < 1 || chunk.length > 1048576) fail('CHUNK');
          if (events >= 16384 || counts.data >= 32768) fail('COUNTER');
          if (bytes + chunk.length > d.expectedLength || counts.acceptedBytes + chunk.length > TOTAL) fail('LENGTH');
          events += 1; counts.data += 1; bytes += chunk.length; counts.acceptedBytes += chunk.length;
          const n = call('writes', 32768, () => fs.writeSync(file.fd, chunk, 0, chunk.length), dl);
          if (n !== chunk.length) fail('IO'); hash.update(chunk);
        }));
      });
      req.on('error', () => abort('HTTP'));
      req.on('close', () => {
        rqClose = true;
        if (!ended) abort('HTTP'); else run(() => {});
        finish();
      });
      guard(dl); if (!failed && !settled) req.end(); guard(dl);
    } catch { abort(reason === 'NONE' ? 'HTTP' : reason); }
  });
}
try {
  guard(); const C = fs.constants;
  for (const k of ['O_DIRECTORY', 'O_WRONLY', 'O_CREAT', 'O_EXCL', 'O_NOFOLLOW', 'O_NONBLOCK']) {
    if (!Number.isInteger(C[k]) || C[k] <= 0) fail('FLAGS');
  }
  if (C.O_RDONLY !== 0) fail('FLAGS');
  euid = call('euid', 1, () => process.geteuid());
  if (!Number.isInteger(euid) || euid < 0 || euid > 4294967295) fail('UID');
  call('mkdir', 1, () => {
    try { fs.mkdirSync(ROOT, { mode: 0o700, recursive: false }); rootCreated = true; }
    catch { fail('MKDIR'); }
  });
  try {
    call('opens', 11, () => {
      root.fd = fs.openSync(ROOT, C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW | C.O_NONBLOCK);
    });
    rootStat = stat(root, END);
    if (!rootStat.isDirectory() || rootStat.uid !== BigInt(euid) || (rootStat.mode & 0o7777n) !== 0o700n) fail('STAT');
    const scratch = Buffer.alloc(65536); guard();
    for (const d of inputs) {
      const entry = sample(), dl = entry + 120000n * MS < END ? entry + 120000n * MS : END;
      guard(dl); checkRoot(dl);
      let observedBytes, incomingSha, readbackSha;
      try {
        call('opens', 11, () => {
          file.fd = fs.openSync(d.destination, C.O_WRONLY | C.O_CREAT | C.O_EXCL | C.O_NOFOLLOW | C.O_NONBLOCK, 0o600);
          createdPaths.push(d.destination);
        }, dl);
        const born = stat(file, dl);
        if (!born.isFile() || born.uid !== BigInt(euid) || (born.mode & 0o7777n) !== 0o600n ||
            born.nlink !== 1n || born.size !== 0n || born.dev !== rootStat.dev) fail('STAT');
        guard(dl); const incoming = crypto.createHash('sha256'); guard(dl);
        observedBytes = await acquire(d, dl, incoming); guard(dl);
        incomingSha = incoming.digest('hex'); guard(dl);
        if (observedBytes !== d.expectedLength || incomingSha !== d.sha256) fail('HASH');
        const written = stat(file, dl); checkFile(written, born, d.expectedLength);
        close(file); guard(dl);
        call('opens', 11, () => {
          file.fd = fs.openSync(d.destination, C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK);
        }, dl);
        const before = stat(file, dl); checkFile(before, born, d.expectedLength);
        if (!same(before, written, full)) fail('STAT');
        guard(dl); const readback = crypto.createHash('sha256'); guard(dl);
        for (let offset = 0; offset < d.expectedLength;) {
          const want = Math.min(scratch.length, d.expectedLength - offset);
          const n = call('reads', 4096, () => fs.readSync(file.fd, scratch, 0, want, offset), dl);
          if (n !== want) fail('IO');
          guard(dl); readback.update(scratch.subarray(0, n)); guard(dl); offset += n;
        }
        if (call('reads', 4096, () => fs.readSync(file.fd, scratch, 0, 1, d.expectedLength), dl) !== 0) fail('LENGTH');
        guard(dl); readbackSha = readback.digest('hex'); guard(dl);
        if (readbackSha !== d.sha256) fail('HASH');
        const after = stat(file, dl); checkFile(after, born, d.expectedLength);
        if (!same(after, written, full)) fail('STAT');
      } finally { close(file); }
      guard(dl); checkRoot(dl); guard(dl);
      records.push({ ...d, observedBytes, incomingSha, readbackSha, contentMatchedNow: true });
    }
    guard(); if (records.length !== 5 || counts.acceptedBytes !== TOTAL) fail('LENGTH');
    checkRoot(END);
  } finally { close(file); close(root); }
  guard();
  const expectedReads = inputs.reduce((sum, d) => sum + Math.ceil(d.expectedLength / 65536) + 1, 0);
  if (counts.mkdir !== 1 || counts.opens !== 11 || counts.closes !== 11 || counts.fstats !== 32 ||
      counts.euid !== 1 || counts.gets !== 5 || counts.reads !== expectedReads) fail('COUNTER');
} catch { poison('IO'); }
function report() {
  return { schema: 'M3_XZ_CONTENT_ACQUISITION_V1', phase: 'OPAQUE_ARCHIVE_ACQUISITION_ONLY',
    realm: 'CURRENT_AGENT_SANDBOX_ONLY', provenance: 'DATA_ONLY',
    status: reason === 'NONE' ? 'CONTENT_MATCHED_NOW' : 'STOP',
    reason: reason === 'NONE' ? 'CONTENT_MATCHED' : reason,
    root: ROOT, rootCreated, createdPaths, inputs, completedCount: records.length, records, counts,
    closeFailed, httpCloseUncertain, contentHashOnly: true, nativeAuthority: false, trainingReady: false,
    captureRootCandidate: null, lArtifact: null, snapshotCandidate: null, pinComplete: false, installed: false };
}
try { if (reason === 'NONE') guard(); } catch { poison('TIME'); }
let line;
try {
  line = JSON.stringify(report()) + '\n';
  if (!/^[\x20-\x7e]*\n$/.test(line) || Buffer.byteLength(line) > 24576) throw new Error('STOP');
} catch {
  poison('OUTPUT');
  line = '{"schema":"M3_XZ_CONTENT_ACQUISITION_V1","phase":"OPAQUE_ARCHIVE_ACQUISITION_ONLY","realm":"CURRENT_AGENT_SANDBOX_ONLY","status":"STOP","reason":"OUTPUT","provenance":"DATA_ONLY","contentHashOnly":true,"nativeAuthority":false,"trainingReady":false,"captureRootCandidate":null,"lArtifact":null,"snapshotCandidate":null,"pinComplete":false,"installed":false}\n';
}
try {
  counts.stdout = 1;
  if (fs.writeSync(1, line) === Buffer.byteLength(line) && reason === 'NONE') {
    guard(); process.exitCode = 0;
  }
} catch { poison('OUTPUT'); }
```
<!-- END F9 M3 XZ ACQUISITION NODE V1 -->

<!-- BEGIN F9 M3 XZ ENTRY V1 -->
```bash
if (( $# != 1 )); then exit 3; fi
( exec -c /usr/local/bin/node --input-type=module --eval "$1" )
status=$?
printf 'F9_M3_XZ_CHILD_EXIT=%s\n' "$status" || exit 3
exit "$status"
```
<!-- END F9 M3 XZ ENTRY V1 -->

## 6. Output acceptance and retained-state honesty

The registered parent must supply EXACT Node fence text as Bash positional `$1` via independently registered literal argv quoting; placeholders, dynamic source, temp programs, heredocs, pipelines and on-disk controls are not transports.
The `( ... exec -c ... )` subshell empties the Node environment; the waiting parent prints actual `$?`, ordinary DATA rather than a Native-authoritative exit/EOF/custody receipt.
Node defaults exit3; only complete five-file checks/root-close/full ONE stdout write/final remaining-global-time check select0.
Any nonempty stderr, timeout, truncation, malformed/additional output, missing/bad marker, nonzero or status/exit mismatch means outer STOP, including printed positive JSON followed by exit3.
The compact emergency OUTPUT/STOP record deliberately omits uncertain detail and can NEVER satisfy the normal success schema; there is no fallback append after a partial/error write.
Normal output includes all five frozen input descriptors, known actual exclusive-created paths, rootCreated DATA, completedCount and only the completed prefix, fixed reasons and finite source counters.
`counts.stdout` in serialized normal output is the pre-write snapshot0; the sole write attempt sets the live counter1, and later clock samples are not reflected in serialization.
No exception text, stack, unbounded metadata, dynamic manifest value or NativeIssuer/authority-install flag is emitted; optional stat metadata is omitted, not coerced from BigInt to Number.
Future five-file success means source-checked expected versus actual incoming/readback archive bytes NOW under ordinary host assumptions, not protected immutability, future-load freshness, installed software or Native proof.
`contentHashOnly:true` names this limited checking profile, including on STOP; it never asserts successful content matching by itself.
Root/files, including partial failed files, remain after any attempt; after a future grant is consumed, no reread/stat/hash/delete/retry/resume follows without fresh permission.
Source no-new-opens after a failed close does not prove physical descriptor release; uncertain HTTP close/physical cleanup precludes positive acceptance.

## 7. Registration and next real gate — all PENDING

| Artifact / check | Current identity / result |
|---|---|
| Exact Node fence body (excluding fences/delimiters, retaining final LF) | SHA-256 `2ccd28e4e351f7bad7444ad2d71aefee2f5ca7f4dbd9518bf70220a7cd36930b` /12759 UTF-8 bytes /244 LF lines |
| Exact Bash fence body, same convention | SHA-256 `76b8b069b95a93b8b53039da684d23ef6f54301ec1aebc9998ad84f85adc00c5` /177 UTF-8 bytes /5 LF lines |
| Whole this document | SHA-256/bytes/lines UNREGISTERED |
| Exact command/argv quote transport, W cwd, outer620000ms | UNREGISTERED; no executable operation packet yet |
| Node --check stdin / Bash -n stdin | Parent syntax-only checks passed without source execution; full transport/static review remains pending |
| Static guards/API counts/BigInt totals/literals/links/preservation/output/reviews | PENDING; no PASS claimed |
| ONE fresh exact filesystem + five-GET grant with THIS packet's residual acceptance | NONE; both capabilities must be explicit |

Parent must statically reconcile source guards and I/O counts, including the full readback ceiling plus EOF probes, before any grant request; code-authored bounds are proposed, not verified results.
Fresh human acceptance must explicitly cover THIS acquisition's startup/DNS/CA/native-I/O/path/source-bounds/disk/partial-retention/cooperative-cleanup/output residuals; earlier metadata acceptances do not transfer.
Host-exception DESIGN is not filesystem/network authorization; no generic timer question remains pending.
After registration, parse-only/static checks and adversarial/security review, the next real gate is ONE fresh exact five-GET + NEW staging mkdir/files/readback approval, not installation approval.
No runtime/mocks/new project tests, installed/retained/proc/log/receipt/daemon access, network or publication occurs in this authoring pass.

## 8. Still blocked — acquisition is not installer qualification

Installer/unpacker/rustup-cache/file:// support, actual mise version/source/backend, full auxiliary/compression/preseed/normal dependency/license graph, N3/full capture and read-only namespace are UNPROVEN.
The selected compression does not prove rustup uses XZ; unsupported later behavior STOPs without gzip fallback.
D1 graph, source470e540 audit, full-plan B/invoice/private guard, actual source clock/loading/custody and all Native gates remain OPEN.
Preserve whole approved HEAD `d9718021…`, manifest `b6f2ad64…`, M3 `fdb740d9…`, Node01 `fdfed77…`, every outcome/null ledger/old prefix/program/model/corpus/law and accepted BAF3476/17/bf38/D1/B1/O9.
Capture/build/runtime stay offline, explicit installed-byte allowlist-only/no-acquisition-fallback; no fee/F1/source/clock/budget change follows.
All five exclusions remain not established: full-training-closure, genuine-native-authority, whole-decision-adequacy, calibration, training-readiness.
Navigation: [ownership §30](native-ingress-ownership.md#30-m3-xz-input-set--opaque-acquisition-proposal-only), [implementation §29](native-ingress-implementation.md#29-m3-xz-content-checks-before-installer-qualification), [current PLAN](PLAN-ml-adjutant.md).
`nativeAuthority:false`, `trainingReady:false`, `captureRootCandidate:null`, `lArtifact:null`, `snapshotCandidate:null`, `pinComplete:false`, `installed:false` remain unconditional.
