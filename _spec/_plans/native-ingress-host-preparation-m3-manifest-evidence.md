# F9 M3 — exact-pin direction, manifest evidence first

**[Unverified] 2026-10-23 · SOURCE-ONLY DESIGN / EXACT PINS SELECTED / MANIFEST GET APPROVAL NONE / NO PAYLOAD REGISTRATION / trainingReady:false.**

## 1. Actual selection and frozen history

Executor selected `Exact pins (Recommended)` for downstream DESIGN ONLY.
This resolves the acquisition-direction fork, not its evidence or operational gates.
Bounded downstream distribution-origin trust and deferral remain UNSELECTED, not fallbacks.
Strict pins establish neither publisher authentication, network enforcement nor Native context.
No manifest fetch, payload HEAD/GET, installation, metadata observation or mise execution is granted.
All prior grants remain consumed, including M3-P0 and Node01 residual acceptances.
Keep the WHOLE approved M3 proposal `fdb740d9…` and Node01 proposal `fdfed77…` unchanged.
Their whole outcomes, old prefixes, programs, raw records and approval histories remain unchanged.

Parent supplies HEAD `6b58a0101e4c71a20034149d9ae4d7a2706e40bc`, branch `docs/f9-private-initializer`, PR50 OPEN/pushed/clean.
The keeper did not verify Git state or perform commands, hashing, tests, agents or network operations.
Parent supplies Architect `ses_e999cedfeffexUEApmoeLHTS7C` and DevOps `ses_e999cedefffehgg81BSqWzLu9z` source-only advice.
The architect recommends RAW LEXICAL EXCERPTS first, not an untested TOML-section parser.
DevOps confirms the five GNU minimal-plus-fmt/clippy roles; neither advice supplies runtime qualification.
Navigation: [ownership §27](native-ingress-ownership.md#27-m3-exact-payload-pins--manifest-evidence-first), [implementation §26](native-ingress-implementation.md#26-m3-pinned-manifest-evidence-before-payload-registration).

## 2. Evidence boundary and ordered gates

| Gate | Required artifact / remaining STOP |
|---|---|
| Source-only proposal | This inert collector and its explicit residuals; no execution or artifact creation. |
| External registration | Source/wrapper measurements appear in §7; parent registers whole-document and exact command identities externally after final writing. |
| Static review | Separately authorized stdin-only Node `--check`, preservation/link checks and source review; no body/mock execution. |
| Fresh exact decision | Explicitly accept THIS packet's startup, TLS/DNS/host, cooperative-time and output-capture residuals; approval NONE. |
| One future manifest attempt | Only the pinned manifest GET below; output raw lexical DATA or STOP, never payload records. |
| Payload interpretation | Review authenticated excerpts with a separately justified interpretation method; register nothing automatically. |
| Complete acquisition graph | Establish ALL lengths, URLs, hashes and auxiliary acquisitions independently before installer approval. |
| Later installer/capture | Separate exact permissions and complete qualifications; later build/runtime remain offline allowlist-only. |

This packet makes NO payload pin, archive length, installation or exact-closure claim.
Some archive URL/SHA references may later derive from reviewed excerpts; they are not registered here.
Full rustup acquisition, compression choices, auxiliary sidecars and preseed/archive behavior remain OPEN.
Actual installed mise version, source and backend qualification remain OPEN; no mise program runs here.
Captured full N3 source/native closure, normal dependencies, licenses and exact offline recipe remain OPEN.
The five roles alone do not prove the full acquisition graph or actual component availability.

## 3. Independent manifest expectation and transport

The following expectation is copied from tracked [M3 source expectations §3](native-ingress-host-preparation-m3.md#3-source-pins-and-still-open-acquisition-scope), derived from tracked M2.
It is historical SOURCE DATA, not freshly fetched bytes or an independently authenticated publisher statement.

| Fixed manifest input | Value |
|---|---|
| URL | `https://static.rust-lang.org/dist/channel-rust-1.95.0.toml` |
| Exact body bytes | `848342` |
| Expected SHA-256 | `821ff14e4c4a1cbe1e8915f35aff0a3fbbdf8d293ad48ab8f31e3b0440c581f9` |
| Roles / target | cargo, rustc, rust-std, rustfmt-preview, clippy-preview; `x86_64-unknown-linux-gnu` only. |
| Intended later toolchain | Rust1.95.0 minimal plus rustfmt/clippy; no extra target/component selected. |

Package-version text belongs to each package body; never infer it from the compiler release.
Public TLS trust plus the already expected hash authenticates neither publisher independence nor provenance beyond that premise.
The hash expectation comes from historical source expectations, NOT a returned HTTP header.

Proposed transport: ONE fixed `/usr/local/bin/node --input-type=module --eval` with the exact quoted literal body in registered argv.
Use the registered Bash parent below, an `exec -c` child with empty environment, and cwd `/tmp/opencode/f9-bootstrap-correspondence` (W).
Register the complete exact command externally after source measurement; do not execute this prose as a command.
No heredoc, temporary program, pipeline, on-disk control, input argument, PATH/runtime fallback or body self-hash cycle.
The requested outer tool timeout is20000ms, not physical termination or a kernel hard bound.
P0/Node01 runtime availability is ordinary historical DATA, not qualified Native startup or continuing availability.
Missing Node, unsupported CLI/API or failed startup means STOP with no alternate runtime or acquisition.

The outer tool command uses `exec -c /bin/bash -c` with this literal wrapper and the registered collector as its sole argument:

<!-- BEGIN F9 M3 MANIFEST ENTRY V1 -->
```bash
if (( $# != 1 )); then exit 3; fi
( exec -c /usr/local/bin/node --input-type=module --eval "$1" )
status=$?
printf 'F9_M3_MANIFEST_CHILD_EXIT=%s\n' "$status" || exit 3
exit "$status"
```
<!-- END F9 M3 MANIFEST ENTRY V1 -->

The trusted Bash parent waits for its one child and appends the actual shell-observed status; this is ordinary host data, not Native authority.
There is one Node invocation and one waiting Bash parent; the subshell immediately replaces itself with Node under `exec -c`.
The wrapper creates no source file, heredoc, pipeline, receipt or process group and performs no network request itself.
Its one printf invocation adds at most64 bytes, so authored output is at most24640 bytes including both terminal LFs.
Startup output remains uncapped; no hard timeout or process-tree cleanup guarantee follows from the parent wrapper.

## 4. Source-level HTTP, retention and lifecycle contract

One explicit HTTPS request is the policy bound, NOT one DNS query, socket or connection primitive.
Node may perform DNS/IPv6 attempts and ordinary native HTTPS/TLS/CA startup I/O.
Default TLS verification remains enabled; no custom CA, authority switch or manifest-provided request occurs.
Literal options fix host,443,path,GET,agent:false,rejectUnauthorized:true and16KiB maximum HTTP headers.
Headers fix identity encoding, connection close and a nonsecret user agent; no cookie/auth/credential/proxy discovery.
No redirect, retry, mirror, HTTP fallback, payload request or secondary fetch is implemented.
The native HTTP parser allocates before application checks; this is not an application-only allocation bound.
Raw header arrays come from Node's native HTTP interface, not an arbitrary worker object graph.

Require status200, at most64 raw header entries/32 pairs, and exactly ONE Content-Length value equal to `848342`.
Missing, duplicate or malformed Content-Length STOPs; Content-Encoding must be absent or one identity value.
Reject a noncompliant response without consuming it into an archive or extracting any evidence.
Require Buffer chunks BEFORE retaining/concatenating; at most1024 data callbacks and848342 retained body bytes.
The exact cap is also below the1048576-byte ceiling; neither bound supplies a whole-process RSS limit.
Concatenate once after end/complete and both request/response close events; exact length and SHA precede decoding.
One bounded concatenation copy, UTF-8 round-trip and later string/JSON copies are not zero-copy or total-memory claims.
Response aborted/error/premature close, request error or request close without a response select absorbing STOP.
Request error/close listeners are installed before its sole end call; response listeners precede validation.
Late data/error/end callbacks cannot restore success after STOP or emit a second record after completion.
Failure drops retained chunks and attempts request/response destroy at most once each, without retry.

The cooperative15000ms deadline begins at the first body clock read after imports, not CLI startup.
One absolute timer uses remaining time without renewal; failure cleanup targets MIN(START+16000ms, failure+1000ms).
STOP may emit when close events complete or that cleanup timer fires; uncertain cleanup never yields RAW success.
Event-loop delay can make even STOP emission late; timers cannot interrupt synchronous decode or stdout write.
Request/response lifecycle events are DATA only, not socket/process kill, physical teardown or Native authority.
No child/process kill, new privilege, mount, enforcement control, root, sink, receipt or log is created.
Do not suppress runtime stderr or warnings; startup and tool-capture residuals remain outside the body cap.

## 5. Inert collector — one fixed manifest only, never run here

Imports are exactly `node:https`, `node:crypto`, `node:fs`; the filesystem API serves ONLY one FD1 stdout write.
No application file open/read/stat/write, os import, child creation or environment read exists in the body.
Builtin loading and ordinary Node native startup remain implicit host activity; no zero-filesystem claim follows.

<!-- BEGIN F9 M3 MANIFEST EVIDENCE NODE V1 -->
```mjs
import https from 'node:https';
import crypto from 'node:crypto';
import fs from 'node:fs';
const START = process.hrtime.bigint(), END = START + 15000000000n;
process.exitCode = 3;
const URL = 'https://static.rust-lang.org/dist/channel-rust-1.95.0.toml';
const SIZE = 848342, SHA = '821ff14e4c4a1cbe1e8915f35aff0a3fbbdf8d293ad48ab8f31e3b0440c581f9';
const headers = [
  '[pkg.cargo.target.x86_64-unknown-linux-gnu]',
  '[pkg.rustc.target.x86_64-unknown-linux-gnu]',
  '[pkg.rust-std.target.x86_64-unknown-linux-gnu]',
  '[pkg.rustfmt-preview.target.x86_64-unknown-linux-gnu]',
  '[pkg.clippy-preview.target.x86_64-unknown-linux-gnu]'
];
let req = null, res = null, timer = null, cleanup = null;
let stopped = false, finished = false, reason = 'INTERNAL_STOP';
let reqClosed = false, resClosed = false, ended = false, seen = false;
let reqDestroyed = false, resDestroyed = false, chunks = [], bytes = 0, events = 0;
const remaining = until => Math.max(0, Math.ceil(Number(until - process.hrtime.bigint()) / 1e6));
const live = () => process.hrtime.bigint() < END;
const closed = () => (!req || reqClosed) && (!res || resClosed);
function base(status, why) {
  return { schema: 'M3_MANIFEST_RAW_EVIDENCE_V1', phase: 'MANIFEST_EVIDENCE_ONLY',
    realm: 'CURRENT_AGENT_SANDBOX_ONLY', status, reason: why, provenance: 'DATA_ONLY',
    nativeAuthority: false, trainingReady: false, captureRootCandidate: null,
    lArtifact: null, snapshotCandidate: null,
    manifest: { url: URL, expectedBytes: SIZE, expectedSha: SHA } };
}
function encode(record) {
  return Buffer.from((JSON.stringify(record) + '\n').replace(/[\u007f-\uffff]/g,
    c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')), 'ascii');
}
function emit(excerpts = null) {
  if (finished) return;
  const ok = excerpts !== null && !stopped;
  if (ok && !live()) { fail('DEADLINE'); return; }
  let payload;
  try {
    const record = base(ok ? 'RAW_EXCERPTS_ONLY' : 'STOP', ok ? 'RAW_LEXICAL_EXCERPTS' : reason);
    if (ok) Object.assign(record, { observedBytes: bytes, observedSha: SHA, excerpts });
    payload = encode(record);
    if (payload.length > 24576) {
      if (ok) { fail('OUTPUT_LIMIT'); return; }
      payload = encode(base('STOP', 'OUTPUT_LIMIT'));
    }
  } catch {
    if (ok) { fail('INTERNAL_STOP'); return; }
    try { payload = encode(base('STOP', 'INTERNAL_STOP')); } catch { payload = null; }
  }
  if (ok && !live()) { fail('DEADLINE'); return; }
  finished = true; chunks = []; clearTimeout(timer); clearTimeout(cleanup);
  if (!payload || payload.length > 24576) return;
  try {
    const written = fs.writeSync(1, payload);
    if (ok && written === payload.length && live()) process.exitCode = 0;
  } catch { process.exitCode = 3; }
}
function destroy() {
  if (req && !reqDestroyed) { reqDestroyed = true; try { req.destroy(); } catch {} }
  if (res && !resDestroyed) { resDestroyed = true; try { res.destroy(); } catch {} }
}
function fail(code) {
  if (finished || stopped) return;
  stopped = true; reason = code; chunks = []; clearTimeout(timer);
  const until = process.hrtime.bigint() + 1000000000n;
  cleanup = setTimeout(() => emit(), remaining(until < START + 16000000000n ? until : START + 16000000000n));
  destroy();
  if (closed()) emit();
}
function need(ok, code) { if (!ok) { fail(code); throw null; } }
function guard(fn) {
  if (finished || stopped) return;
  try { need(live(), 'DEADLINE'); fn(); } catch { fail('INTERNAL_STOP'); }
}
function extract(body) {
  need(body.length === SIZE, 'BODY_LENGTH');
  need(crypto.createHash('sha256').update(body).digest('hex') === SHA, 'BODY_HASH');
  const text = body.toString('utf8');
  need(Buffer.from(text, 'utf8').equals(body) && !text.startsWith('\ufeff') && !text.includes('\r'), 'UTF8_TEXT');
  const lines = text.split('\n'), offsets = []; let offset = 0;
  need(lines.length <= 65536, 'LINE_LIMIT');
  for (const line of lines) {
    need(Buffer.byteLength(line, 'utf8') <= 8192, 'LINE_LIMIT');
    offsets.push(offset); offset += line.length + 1;
  }
  return headers.map(header => {
    const start = lines.indexOf(header);
    need(start >= 0 && lines.lastIndexOf(header) === start, 'HEADER_MATCH');
    let end = start + 1;
    while (end < lines.length && !lines[end].startsWith('[')) end++;
    const raw = text.slice(offsets[start], end < lines.length ? offsets[end] : text.length);
    need(Buffer.byteLength(raw, 'utf8') <= 4096, 'EXCERPT_LIMIT');
    const count = raw.split('\n').length - (raw.endsWith('\n') ? 1 : 0);
    need(count <= 32, 'EXCERPT_LIMIT');
    return { header, startLine: start + 1, raw };
  });
}
function maybe() {
  if (finished) return;
  if (stopped) { if (closed()) emit(); return; }
  if (!ended || !reqClosed || !resClosed) return;
  guard(() => {
    need(res.complete === true && bytes === SIZE, 'BODY_LENGTH');
    const body = Buffer.concat(chunks, bytes); chunks = [];
    const excerpts = extract(body); need(live(), 'DEADLINE'); emit(excerpts);
  });
}
function response(r) {
  r.on('error', () => fail('RESPONSE_ERROR'));
  if (finished) return;
  if (seen) { fail('RESPONSE_MULTIPLE'); return; }
  seen = true; res = r;
  r.on('aborted', () => fail('RESPONSE_ABORTED'));
  r.on('close', () => {
    if (finished) return;
    resClosed = true;
    if (!stopped && (!ended || !r.complete)) fail('RESPONSE_CLOSE');
    maybe();
  });
  r.on('end', () => guard(() => {
    need(!ended && r.complete === true, 'RESPONSE_END'); ended = true; maybe();
  }));
  r.on('data', chunk => guard(() => {
    need(Buffer.isBuffer(chunk), 'CHUNK_TYPE');
    events++; need(events <= 1024, 'DATA_LIMIT');
    need(bytes + chunk.length <= SIZE && bytes + chunk.length <= 1048576, 'DATA_LIMIT');
    bytes += chunk.length; chunks.push(chunk);
  }));
  if (stopped) { destroy(); maybe(); return; }
  guard(() => {
    need(r.statusCode === 200, 'HTTP_STATUS');
    const raw = r.rawHeaders;
    need(Array.isArray(raw) && raw.length <= 64 && raw.length % 2 === 0, 'HEADER_LIMIT');
    let lengths = 0, encodings = 0;
    for (let i = 0; i < raw.length; i += 2) {
      const name = raw[i].toLowerCase(), value = raw[i + 1];
      if (name === 'content-length') { lengths++; need(value === '848342', 'CONTENT_LENGTH'); }
      if (name === 'content-encoding') { encodings++; need(value.toLowerCase() === 'identity', 'CONTENT_ENCODING'); }
    }
    need(lengths === 1, 'CONTENT_LENGTH'); need(encodings <= 1, 'CONTENT_ENCODING');
  });
}
try {
  need(live(), 'DEADLINE');
  timer = setTimeout(() => fail('DEADLINE'), remaining(END));
  req = https.request({ hostname: 'static.rust-lang.org', port: 443,
    path: '/dist/channel-rust-1.95.0.toml', method: 'GET', agent: false,
    rejectUnauthorized: true, maxHeaderSize: 16384,
    headers: { 'Accept-Encoding': 'identity', Connection: 'close', 'User-Agent': 'F9-M3-Manifest-Evidence-V1' }
  }, response);
  req.on('error', () => fail('REQUEST_ERROR'));
  req.on('close', () => {
    if (finished) return;
    reqClosed = true; if (!seen && !stopped) fail('REQUEST_CLOSE'); maybe();
  });
  need(live(), 'DEADLINE'); if (!stopped) req.end();
} catch { fail('INTERNAL_STOP'); }
```
<!-- END F9 M3 MANIFEST EVIDENCE NODE V1 -->

## 6. Lexical excerpts, output and refusal semantics

Each of the five literal header lines must occur EXACTLY once across the whole verified body.
Decode only after exact bytes/hash; require UTF-8 round-trip, no BOM/CR, at most65536 split lines and8192 UTF-8 bytes per line.
For each header, slice from its original string offset through the line BEFORE the next line beginning `[` or EOF.
Offsets are JavaScript string units, not claimed byte offsets; `startLine` is1-based.
Preserve the exact substring, including existing LF and EOF behavior; invent no terminal LF.
Each raw excerpt must fit32 lines and4096 UTF-8 bytes with NO truncation.
These are LEXICAL matches, NOT parsed TOML sections or validated table membership.
Quoted table syntax, multiline values and dynamic semantics are unsupported and never resolved.
A matching line inside quoted/multiline text remains lexical DATA; later interpretation must address that limitation.
The pinned whole-body digest authenticates expected bytes only, not extraction semantics or valid TOML.
Never emit the full manifest, partial body, arbitrary exception, payload record or automatic URL request.

The record schema is `M3_MANIFEST_RAW_EVIDENCE_V1`, phase `MANIFEST_EVIDENCE_ONLY`, realm `CURRENT_AGENT_SANDBOX_ONLY`.
Statuses are `RAW_EXCERPTS_ONLY` or `STOP`; all branches retain DATA_ONLY, false authority/readiness and null artifact candidates.
Success adds only observed manifest length/digest and five `{header,startLine,raw}` excerpts; STOP includes NO excerpts.
Observed manifest bytes are not a new independent payload pin, archive length or trust anchor.
Closed reasons: RAW_LEXICAL_EXCERPTS, INTERNAL_STOP, DEADLINE, OUTPUT_LIMIT, BODY_LENGTH, BODY_HASH,
UTF8_TEXT, LINE_LIMIT, HEADER_MATCH, EXCERPT_LIMIT, RESPONSE_ERROR, RESPONSE_MULTIPLE, RESPONSE_ABORTED,
RESPONSE_CLOSE, RESPONSE_END, CHUNK_TYPE, DATA_LIMIT, HTTP_STATUS, HEADER_LIMIT, CONTENT_LENGTH,
CONTENT_ENCODING, REQUEST_ERROR and REQUEST_CLOSE.

JSON escapes every non-ASCII code unit with literal Unicode escapes; encode one ASCII JSON line plus LF, maximum24576 bytes.
Raw excerpt caps do not guarantee escaped JSON fits; overflow selects a small fixed-code STOP before any write.
Fallback records use the same fixed false/null envelope without excerpts; unrecoverable encoding yields no record/exit3.
Mark finished and clear timers BEFORE the sole fs.writeSync(1,payload) attempt; no second append or fallback write follows.
A short/error write keeps exit3; no atomic-write, flush-to-storage or tool-retention guarantee is claimed.
Exit starts at3; exit0 requires RAW completion, both close events/end/complete, a full write and positive remaining time afterward.
A fully printed RAW record followed by deadline expiry remains exit3 and is outer STOP, never accepted success.
Any nonzero exit, stderr/warning, timeout, truncation, missing/malformed record or record/exit mismatch means STOP.
Accept success only for the complete collector JSONLF followed by exactly `F9_M3_MANIFEST_CHILD_EXIT=0\n`, normal tool completion and no stderr/timeout/truncation.
The marker comes from the waiting Bash parent's captured status, not a collector self-report; it remains trusted-host data, not an independent Native receipt.
Reject missing/duplicate markers, extra output, nonzero status or record/status mismatch; the wrapper preserves the child status unless its printf fails, which yields exit3.
Preserve returned output only; no receipt, retained-control reread, retry, alternate format/proxy or payload fetch follows.
One failed attempt consumes its future exact grant even when no complete record reaches the caller.

## 7. Registration, residual acceptance and unchanged laws

| Registration / approval item | Current state |
|---|---|
| Fence SHA-256 / UTF-8 bytes / LF lines | `6ace2a4c41ca32aba7a9c709d8b7ee15ebe38e20eaf7fe65f650e55c24080b79` /7122 /157; source target140–180 lines. |
| Bash wrapper SHA-256 / UTF-8 bytes / LF lines | `7640198ff533c0ee9a001c89b1667918d194027445b6c98e3153119e57eda2aa` /183 /5. |
| Whole-document SHA-256 | UNREGISTERED; external record only, no self-hash cycle. |
| Exact exec-c/literal-eval argv, environment, cwd and20000ms tool timeout | UNREGISTERED; external exact-command record PENDING. |
| Stdin-only Node --check / static preservation / links / review | Parent Node syntax-only and Bash wrapper syntax checks passed without source execution; preservation/link/transport checks and scoped review remain pending. |
| Fresh exact manifest GET grant / THIS packet's residual acceptance | NONE / NONE; earlier P0/Node01 acceptances not renewed. |
| Payload records / ALL payload lengths and graph closure | NONE / UNPROVED; no installer approval is ready. |
| Mise execution / installer source and identities / installation exception | NONE / SOURCE NOT WRITTEN / NONE. |

Fresh acceptance must explicitly cover ordinary trusted Node/Bash startup, public CA/DNS/native HTTPS I/O and stable runtime path.
It must also cover cooperative timer/cleanup limits, synchronous work/write residuals and tool-output capture outside body bounds.
Neither source-request count nor strict hash comparison supplies a firewall, closed native loading graph or zero incidental I/O.
The ordinary host premise is not accepted for THIS packet yet; do not inherit an old exception.
Only after external registration and review may the parent request a fresh exact one-shot manifest permission.
This document runs nothing and creates no root, control, program, source target, Cargo/dependency, test, diagram or index entry.
Later F9 capture/build/runtime ALWAYS remain offline, explicit installed-byte allowlist-only, with NO runtime acquisition fallback.
Preserve source470e540, accepted BAF3476/17, bf38/D1/B1/O9, frozen corpus/model and all old program/approval/outcome bytes.
Source Root B, one BOTH-seat1048576 counter, unchanged F1/charged replay and no extra credit remain unchanged.
Keep original cold10s/lifecycle300s including reserved3s cleanup and separate generator2048; this proposal renews none.
Native loading/custody/clock/source/invoice/full-plan gates remain OPEN; capture root/L/snapshot remain unproved/null here.
All five exclusions persist: full-training-closure, genuine-native-authority, whole-decision-adequacy, calibration, training-readiness.
`trainingReady:false`; the parent owns separately authorized registration, checks and review, not an automatic operation.
