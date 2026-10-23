# F9 M3 — advertised archive lengths, HEAD metadata proposal

**[Unverified] 2026-10-23 · SOURCE ONLY / SOURCE MEASURED + SYNTAX CHECKED / HEAD GRANT NONE / NO ARCHIVE VERIFICATION / trainingReady:false.**

## 1. Scope and provenance

The [manifest outcome](native-ingress-host-preparation-m3-manifest-outcome.md) records one completed manifest attempt and ten historical advertised references.
Executor's existing `Exact pins (Recommended)` direction covers this reference-registration continuation; no new mode vote is needed.
Parent supplies Architect `ses_e997921cfffec0LQ27LEBoMyZX` for the minimal closed metadata contract.
This Markdown adapts that supplied advice; it grants no operation or Native authority.
The keeper uses repository reads/patches only, without commands, hashes, tests, agents or network.
All prior grants are CONSUMED; this HEAD packet needs its OWN explicit residual acceptance and exact fresh grant after freeze/review.
Keep the whole approved manifest proposal `b6f2ad64…`, M3 `fdb740d9…`, Node01 `fdfed77…`, outcomes and every old byte unchanged.

Ten descriptors cover BOTH observed formats for five roles, not ten selected downloads or an acquisition-complete set.
HEAD observes advertised metadata only; it neither chooses compression nor downloads, hashes or verifies an archive.
Do not refetch the frozen manifest; its expected SHA is `821ff14e4c4a1cbe1e8915f35aff0a3fbbdf8d293ad48ab8f31e3b0440c581f9`.
Version1.95.0/date2026-04-16/targetx86_64-unknown-linux-gnu are literal observed URL data, not inferred replacements.
The original ten `byteLength:null` ledger entries remain immutable even after later HEAD observations.

## 2. Closed request, header and completion contract

Make at most ten explicit HTTPS HEAD requests, SEQUENTIALLY in the literal source order below.
Stop on the first failure, preserving only the completed prefix; do not request the remaining suffix.
Never retry, redirect, use mirrors/proxies/other authorities/channels, accept worker URLs, or issue payload GET.
Each request fixes HTTPS host `static.rust-lang.org`, port443 and its dated literal path from the reference ledger.
Use agent:false, TLS verification true, maxHeaderSize16384 and fixed identity/Connection-close/nonsecret-UA headers.
Require status200, at most64 raw header entries/32 pairs, exactly one canonical Content-Length matching `[1-9][0-9]{0,9}` and BigInt1..536870912 inclusive.
Absent/duplicate/invalid/over-limit Content-Length STOPs; encoding must be absent or ONE identity value.
Header parser allocations precede these application checks; no whole-process memory bound follows.
Accept at most16 pre-STOP data callbacks, each an empty Buffer; the next callback or any nonempty Buffer selects STOP without retaining contents.
Ignored late callbacks and Node's internal processing are not covered by that application counter or an exact native-call claim.
Node HEAD semantics may consume unsolicited wire bytes internally; absence of a payload GET is not proof of zero unsolicited archive bytes on the wire.
Retain/hash no archive body and never treat Content-Length as measured body length.
Require response end/complete AND response close AND request close before resolving EACH successful probe.
The next request starts only after that probe resolves, its references drop, and the global deadline check passes.
Error, aborted/premature close, deadline or unexpected data selects absorbing STOP; late events cannot restore success or restart the chain.

Each completed observation has state `HEADER_ADVERTISED_LENGTH`, canonical decimal STRING `advertisedLength` and `payloadVerified:false`.
The optional sum is a decimal BigInt string bounded by10*512MiB; it measures neither downloaded bytes nor current disk reservation.
Failure preserves the first N completed observations; the active failed descriptor is not completed and its suffix stays unknown.
Even ten completed records leave `pinComplete:false` and `payloadsVerified:false`; partial output is overall STOP, not complete metadata or complete pins.

## 3. Time, ordinary host and transport residuals

START is the first body clock read after imports; global END=START+150000ms.
Each probe uses MIN(probeStart+15000ms, END), with no global renewal.
Failure cleanup targets MIN(failure+1000ms, END+1000ms); the absolute cooperative envelope is151000ms, excluding startup.
Requested outer tool timeout180000ms is not physical termination, process-group cleanup or a kernel deadline.
Timers cannot interrupt synchronous native work, JSON serialization or stdout writes; late output is STOP at the outer boundary.
DNS/IPv6 may involve multiple attempts; public CA/TLS/native protocol and builtin-module startup I/O remain ordinary-host residuals.
Request policy is not a firewall, one-wire/one-connect claim, closed Native graph, RSS/disk enforcement or zero-filesystem guarantee.
Do not infer future C/daemon-host binding or protected namespace from P0's historical Node cwd.
No child API, environment read, filesystem open, root/control/sink/receipt/log/proc access, secret, capability or policy change exists in the body.
The ONLY explicit filesystem API operation is one FD1 stdout write; ordinary native CA/builtin loading remains implicit.
Missing Node, unsupported flags/APIs/timers or failed setup means STOP, without alternate transport/runtime/proxy.

Proposed transport uses `exec -c /bin/bash -c` with the wrapper below and ONE exact quoted Node source argument; cwd W=`/tmp/opencode/f9-bootstrap-correspondence`.
There is one waiting Bash parent and one Node; the subshell immediately replaces itself via exec-c under an empty environment.
Parent captures native `$?`, prints at most64 bytes of marker, then exits with child status or3 if printf fails.
Literal quote transport belongs in a later external exact-command registration, never a heredoc/tempfile/pipeline/source callback/self-hash.
No actual command or grant is registered here; ordinary startup diagnostics and tool capture remain outside the body cap.

<!-- BEGIN F9 M3 HEAD ENTRY V1 -->
```bash
if (( $# != 1 )); then exit 3; fi
( exec -c /usr/local/bin/node --input-type=module --eval "$1" )
status=$?
printf 'F9_M3_HEAD_CHILD_EXIT=%s\n' "$status" || exit 3
exit "$status"
```
<!-- END F9 M3 HEAD ENTRY V1 -->

## 4. Inert literal Node body — DO NOT EXECUTE

Imports are ONLY `node:https` and `node:fs`; archive hashes below are unverified manifest literals, not computed payload digests.
This source has no generic TOML processing, rustup source-graph privilege or production budget-meter authority.

<!-- BEGIN F9 M3 HEAD LENGTH NODE V1 -->
```mjs
import https from 'node:https';
import fs from 'node:fs';
const START = process.hrtime.bigint(), END = START + 150000000000n;
process.exitCode = 3;
const manifestSha = '821ff14e4c4a1cbe1e8915f35aff0a3fbbdf8d293ad48ab8f31e3b0440c581f9';
const refs = [
  { role: 'cargo', artifact: 'cargo', format: 'tar.gz',
    url: 'https://static.rust-lang.org/dist/2026-04-16/cargo-1.95.0-x86_64-unknown-linux-gnu.tar.gz',
    sha256: '47ebc468721a6ff3fb27dff33e632a4cb6246d0ea061814bcd4fe601d18c69a8' },
  { role: 'cargo', artifact: 'cargo', format: 'tar.xz',
    url: 'https://static.rust-lang.org/dist/2026-04-16/cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz',
    sha256: 'e74edd2cf7d0f1f1383b4f00eb90c843750bc489e2ccf7214e6476678a907425' },
  { role: 'rustc', artifact: 'rustc', format: 'tar.gz',
    url: 'https://static.rust-lang.org/dist/2026-04-16/rustc-1.95.0-x86_64-unknown-linux-gnu.tar.gz',
    sha256: 'fef749c4abb4b4bde5ebf773bec550003ce5b4410579cecd69a365e5c0c5106a' },
  { role: 'rustc', artifact: 'rustc', format: 'tar.xz',
    url: 'https://static.rust-lang.org/dist/2026-04-16/rustc-1.95.0-x86_64-unknown-linux-gnu.tar.xz',
    sha256: '8426a3d170a5879f5682f5fbdd024a1779b3951e7baba685af2d6dc32a6dfc15' },
  { role: 'rust-std', artifact: 'rust-std', format: 'tar.gz',
    url: 'https://static.rust-lang.org/dist/2026-04-16/rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.gz',
    sha256: 'edbd20f8fc0a617f85ffb79fa6c22aa6def0e570de3f94be1a6e5ab1f77f763c' },
  { role: 'rust-std', artifact: 'rust-std', format: 'tar.xz',
    url: 'https://static.rust-lang.org/dist/2026-04-16/rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.xz',
    sha256: '047ea7098803d3500fa1072e9cee5392697e21525559e4458128a2bf874aa382' },
  { role: 'rustfmt-preview', artifact: 'rustfmt', format: 'tar.gz',
    url: 'https://static.rust-lang.org/dist/2026-04-16/rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.gz',
    sha256: '6d3e64adc505ad4bef6935f6e6f5e4c6956d9782607fb8394df3a5d2b30d2733' },
  { role: 'rustfmt-preview', artifact: 'rustfmt', format: 'tar.xz',
    url: 'https://static.rust-lang.org/dist/2026-04-16/rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.xz',
    sha256: 'f1b2a7301513ffdd95ebf22ebbdd932e4d17fc806f748d93924740d0297b1396' },
  { role: 'clippy-preview', artifact: 'clippy', format: 'tar.gz',
    url: 'https://static.rust-lang.org/dist/2026-04-16/clippy-1.95.0-x86_64-unknown-linux-gnu.tar.gz',
    sha256: '5230c92fb0ae1346ee30a1b4e01413cc3e1ead8ded20391fb2826619775f1ccb' },
  { role: 'clippy-preview', artifact: 'clippy', format: 'tar.xz',
    url: 'https://static.rust-lang.org/dist/2026-04-16/clippy-1.95.0-x86_64-unknown-linux-gnu.tar.xz',
    sha256: 'ac779bc9839dd47180806b133e4e2563c4a34716284cd5b8fede8ef289f452ca' }
];
const codes = new Set(['INTERNAL_STOP', 'DEADLINE', 'REQUEST_ERROR', 'REQUEST_CLOSE',
  'RESPONSE_ERROR', 'RESPONSE_ABORTED', 'RESPONSE_CLOSE', 'RESPONSE_END',
  'RESPONSE_MULTIPLE', 'HTTP_STATUS', 'HEADER_LIMIT', 'CONTENT_LENGTH',
  'CONTENT_ENCODING', 'CHUNK_TYPE', 'DATA_LIMIT', 'UNEXPECTED_DATA', 'OUTPUT_LIMIT']);
const now = () => process.hrtime.bigint();
const remaining = until => Math.max(0, Math.ceil(Number(until - now()) / 1e6));
const need = (ok, code) => { if (!ok) throw new Error(code); };
const codeOnly = error => error instanceof Error && codes.has(error.message)
  ? error.message : 'INTERNAL_STOP';
async function probe(ref) {
  const start = now(), local = start + 15000000000n;
  const deadline = local < END ? local : END;
  return await new Promise((resolve, reject) => {
    let req = null, res = null, timer = null, cleanup = null;
    let reqClosed = false, resClosed = false, ended = false, seen = false;
    let reqDestroyed = false, resDestroyed = false, stopped = false, done = false;
    let reason = 'INTERNAL_STOP', advertisedLength = null, callbacks = 0;
    const closed = () => (!req || reqClosed) && (!res || resClosed);
    function settle() {
      if (done) return;
      done = true; clearTimeout(timer); clearTimeout(cleanup);
      req = null; res = null;
      if (stopped) reject(new Error(reason));
      else resolve({ ...ref, state: 'HEADER_ADVERTISED_LENGTH', advertisedLength,
        payloadVerified: false });
    }
    function destroy() {
      if (req && !reqDestroyed) { reqDestroyed = true; try { req.destroy(); } catch {} }
      if (res && !resDestroyed) { resDestroyed = true; try { res.destroy(); } catch {} }
    }
    function fail(code) {
      if (done || stopped) return;
      stopped = true; reason = codes.has(code) ? code : 'INTERNAL_STOP';
      clearTimeout(timer);
      const until = now() + 1000000000n, absolute = END + 1000000000n;
      cleanup = setTimeout(settle, remaining(until < absolute ? until : absolute));
      destroy(); if (closed()) settle();
    }
    function guard(fn) {
      if (done || stopped) return;
      try { need(now() < deadline, 'DEADLINE'); fn(); }
      catch (error) { fail(codeOnly(error)); }
    }
    function maybe() {
      if (done) return;
      if (stopped) { if (closed()) settle(); return; }
      if (ended && reqClosed && resClosed) guard(() => {
        need(res.complete === true && advertisedLength !== null, 'RESPONSE_END'); settle();
      });
    }
    function response(r) {
      r.on('error', () => fail('RESPONSE_ERROR'));
      if (done) { try { r.destroy(); } catch {} return; }
      if (seen) { fail('RESPONSE_MULTIPLE'); try { r.destroy(); } catch {} return; }
      seen = true; res = r;
      r.on('aborted', () => fail('RESPONSE_ABORTED'));
      r.on('close', () => {
        if (done) return;
        resClosed = true;
        if (!stopped && (!ended || !r.complete)) fail('RESPONSE_CLOSE');
        maybe();
      });
      r.on('end', () => guard(() => {
        need(!ended && r.complete === true, 'RESPONSE_END'); ended = true; maybe();
      }));
      r.on('data', chunk => guard(() => {
        need(callbacks < 16, 'DATA_LIMIT'); callbacks++;
        need(Buffer.isBuffer(chunk), 'CHUNK_TYPE'); need(chunk.length === 0, 'UNEXPECTED_DATA');
      }));
      if (stopped) { destroy(); maybe(); return; }
      guard(() => {
        need(r.statusCode === 200, 'HTTP_STATUS');
        const raw = r.rawHeaders;
        need(Array.isArray(raw) && raw.length <= 64 && raw.length % 2 === 0, 'HEADER_LIMIT');
        let lengths = 0, encodings = 0;
        for (let i = 0; i < raw.length; i += 2) {
          need(typeof raw[i] === 'string' && typeof raw[i + 1] === 'string', 'HEADER_LIMIT');
          const name = raw[i].toLowerCase(), value = raw[i + 1];
          if (name === 'content-length') {
            lengths++; need(/^[1-9][0-9]{0,9}$/.test(value), 'CONTENT_LENGTH');
            const length = BigInt(value);
            need(length.toString() === value, 'CONTENT_LENGTH');
            need(length >= 1n && length <= 536870912n, 'CONTENT_LENGTH'); advertisedLength = value;
          }
          if (name === 'content-encoding') {
            encodings++; need(value.toLowerCase() === 'identity', 'CONTENT_ENCODING');
          }
        }
        need(lengths === 1, 'CONTENT_LENGTH'); need(encodings <= 1, 'CONTENT_ENCODING');
      });
    }
    try {
      need(now() < deadline, 'DEADLINE');
      timer = setTimeout(() => fail('DEADLINE'), remaining(deadline));
      req = https.request({ hostname: 'static.rust-lang.org', port: 443,
        path: ref.url.slice('https://static.rust-lang.org'.length), method: 'HEAD', agent: false,
        rejectUnauthorized: true, maxHeaderSize: 16384,
        headers: { 'Accept-Encoding': 'identity', Connection: 'close', 'User-Agent': 'F9-M3-Head-Length-V1' }
      }, response);
      req.on('error', () => fail('REQUEST_ERROR'));
      req.on('close', () => {
        if (done) return;
        reqClosed = true; if (!seen && !stopped) fail('REQUEST_CLOSE'); maybe();
      });
      need(now() < deadline, 'DEADLINE'); if (!stopped) req.end();
    } catch (error) { fail(codeOnly(error)); }
  });
}
const observations = [];
let reason = 'METADATA_OBSERVED', ok = false;
try {
  for (const ref of refs) {
    need(now() < END, 'DEADLINE');
    const observation = await probe(ref);
    observations.push(observation); need(now() < END, 'DEADLINE');
  }
  need(observations.length === 10, 'INTERNAL_STOP'); ok = true;
} catch (error) { reason = codeOnly(error); }
function record() {
  return { schema: 'M3_HEAD_LENGTH_METADATA_V1', phase: 'HEAD_LENGTH_METADATA_ONLY',
    realm: 'CURRENT_AGENT_SANDBOX_ONLY', status: ok ? 'HEADER_METADATA_ONLY' : 'STOP',
    reason, provenance: 'DATA_ONLY', nativeAuthority: false, trainingReady: false,
    captureRootCandidate: null, lArtifact: null, snapshotCandidate: null,
    manifestSha, pinComplete: false, payloadsVerified: false,
    completedCount: observations.length, observations,
    advertisedLengthSum: observations.reduce((sum, row) => sum + BigInt(row.advertisedLength), 0n).toString() };
}
function encode(value) {
  return Buffer.from((JSON.stringify(value) + '\n').replace(/[\u007f-\uffff]/g,
    c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')), 'ascii');
}
try {
  if (ok && now() >= END) { ok = false; reason = 'DEADLINE'; }
  let payload = encode(record());
  if (ok && now() >= END) {
    ok = false; reason = 'DEADLINE'; payload = encode(record());
  }
  need(payload.length <= 24576, 'OUTPUT_LIMIT');
  const written = fs.writeSync(1, payload);
  if (ok && written === payload.length && now() < END) process.exitCode = 0;
} catch { process.exitCode = 3; }
```
<!-- END F9 M3 HEAD LENGTH NODE V1 -->

## 5. Output and outer STOP interpretation

One ASCII JSON line plus LF is capped at24576 bytes; parent marker≤64 makes total authored output≤24640 bytes.
The schema is `M3_HEAD_LENGTH_METADATA_V1`, phase `HEAD_LENGTH_METADATA_ONLY`, provenance `DATA_ONLY` in every branch.
Statuses are `HEADER_METADATA_ONLY` or `STOP`; authority/readiness are false, artifact candidates null, pins/payloads unverified throughout.
The closed reason set is the source `codes` set plus success-only `METADATA_OBSERVED`; unknown host exceptions map to INTERNAL_STOP.
No raw error strings, stack traces, arbitrary worker graphs, response bodies or native-proof flags enter output.
The sole fs.writeSync makes one full-length attempt; short/error write keeps exit3 with no retry/fallback append.
Unrecoverable encoding or output overflow emits no record and exit3; it never truncates a completed prefix into success.
Default exit3 becomes0 only after all ten end/complete/both-close gates, complete write and final global-deadline check.
A printed metadata-positive record with exit3, any stderr/warning, timeout, truncation, extra/malformed output or missing/duplicate marker is outer STOP.
Accept only complete JSONLF plus exactly `F9_M3_HEAD_CHILD_EXIT=0\n`, normal tool completion and no stderr/timeout/truncation.
The marker records ordinary shell-observed child exit, not independent Native closure or physical process-tree termination.
On error, retain returned completed-prefix metadata as unverified DATA; never repair the tail by retry or treat the unknown suffix as measured.

## 6. Registration and later gates — none complete here

| Required item | Current state |
|---|---|
| Node fence SHA-256 / UTF-8 bytes / LF lines | `aa04d5a40470254293252ba418c71602968a03a84c98e3e9ec850d1fae3e89a1` /9454 /178. |
| Bash fence SHA-256 / UTF-8 bytes / LF lines | `922a1b92bc7af355052e713de9b37b17484cbdd9462696c9138e4290dd92acee` /179 /5. |
| Whole-document SHA-256 and exact literal-argv command/cwd/empty-env/180000ms record | UNREGISTERED; no self-hash cycle. |
| Node --check stdin ONLY / Bash -n ONLY | Parent syntax-only checks passed; source bodies were NOT executed and no network request followed. |
| Static past-data correspondence, digest64/suffix/role and preservation/link checks | PENDING with parent; never execute body/mocks/tests/network or fetched TOML. |
| Adversarial/security review | PENDING; supplied architecture advice is not final review. |
| THIS HEAD packet's startup/native-CA/DNS/path/time/output residual acceptance | NONE; manifest/P0/Node01 acceptance is not inherited. |
| Fresh exact one-shot ten-HEAD grant | NONE; source-only until registration/review and fresh real-human approval. |
| Payload acquisition / verification / installer source / install grant | NONE / NONE / UNWRITTEN / NONE. |

The later decision must explicitly ratify THIS packet's trusted Node/Bash startup, runtime path, implicit native I/O, cooperative-time and external output-capture residuals.
Neither source review nor exact pins supplies a closed Rust/Node native graph, resource enforcement or Native permission.
Ten HEAD observations will not close mise version/source/backend, rustup auxiliary/compression/preseed/offline source, dependencies or licenses.
No source target/project/test/config/program/control/root/sink/receipt is created; the new body exists in Markdown ONLY.
Preserve source470e540, accepted BAF3476/17, bf38/D1/B1/O9, programs/models/corpora/caps, Root B and numeric-B/invoice/source-clock proof gaps.
ONE BOTH-seat1048576, unchanged F1/charged replay, original cold10s/lifecycle300s including reserved3s and generator2048 stay unchanged.
This ordinary-host metadata phase is not a new public fee exemption, production meter boundary or physical allowance.
Later F9 capture/build/runtime stay offline, explicit installed-byte allowlist-only, without acquisition fallback.
All five exclusions stand: full-training-closure, genuine-native-authority, whole-decision-adequacy, calibration, training-readiness.
Navigation: [ownership §28](native-ingress-ownership.md#28-m3-manifest-evidence--consumed-grant-and-unverified-references), [implementation §27](native-ingress-implementation.md#27-m3-advertised-lengths-before-archive-verification).
`trainingReady:false`; no Native proof, capture/L/snapshot, activation, deployment or training follows.
