# F9 M3 — retained XZ two-path metadata diagnostic proposal only

**[Unverified] 2026-10-23 · INERT SOURCE MEASURED + SYNTAX CHECKED / FRESH GRANT NONE / NO EXPLICIT CONTENT-READ API / trainingReady:false.**

## 1. Purpose, provenance and exact proposed scope

The [supplied acquisition outcome](native-ingress-host-preparation-m3-xz-outcome.md) stopped at cargo birth metadata before GET/file-data write/readback; the historical failing predicate remains UNKNOWN.
Parent supplies Architect `ses_e98efeaacffePv0bH5v3nGaeOm` and DevOps `ses_e98efea09ffe4FatX4plJK1U7W` semantic advice for this minimal fresh diagnostic; the keeper did not call agents.
No generic priority/timer vote is pending; authoring the diagnostic does not approve it.
All earlier grants, including staging, are consumed and transfer NO retained-path permission.
This source proposes current ordinary-host metadata observations of exactly these two literals, not the future C/daemon host or protected Native source/capture root:

```text
/tmp/opencode/f9-m3-xz-inputs-01
/tmp/opencode/f9-m3-xz-inputs-01/cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz
```

One Node literal eval imports only `node:fs`; one five-line Bash parent waits in fixed W cwd with Node's empty environment.
Proposed outer transport is `exec -c /bin/bash -c` with the exact wrapper and ONE literal-quoted Node body argument; W=`/tmp/opencode/f9-bootstrap-correspondence`, requested outer5000ms.
No helper/control/source/test/dependency file, heredoc, temporary program, pipeline or other child program belongs to the packet.
No archive-content read/hash/readFile, readdir/root listing, network, mkdir, write to retained paths, truncation, permissions repair, removal, ioctl/flag mutation, proc/log/receipt/cache/secrets/environment discovery or installed-path observation belongs to it.
Read-only opens can cause ordinary kernel/host implicit activity; no zero-effects or zero-implicit-I/O guarantee is made.
The program uses no application file-content read API.

## 2. Collection order, source bounds and residuals

Parent-first bigint lstat must identify a nonsymlink directory before ANY child lookup or open.
Then child bigint lstat must identify a nonsymlink regular filename before ANY open.
Validate actual positive O_DIRECTORY/O_NOFOLLOW/O_NONBLOCK constants and zero O_RDONLY before path operations.
Open root RDONLY|DIRECTORY|NOFOLLOW|NONBLOCK, root fstat BEFORE; open file RDONLY|NOFOLLOW|NONBLOCK, file fstat BEFORE; file fstat AFTER, root fstat AFTER; close file then root.
Open-path races may still yield OTHER opened kinds; report actual FD metadata and predicate values without treating a birth-guard mismatch as collection failure.
Named-type failures STOP before unsafe lookup/open; syscall, unsupported metadata, clock/counter, close or output failures STOP.
At most two managed owned file FDs exist; every acquisition assigns its holder inside the already-active try/finally immediately.
Release the holder before ONE closeSync attempt; never retry, including EINTR, and never open after a close failure.
Cleanup attempts file then root unconditionally, even after a deadline/counter failure, without a pre-close guard.

| Authored source bound | Interpretation |
|---|---|
| lstat / open / fstat / close / geteuid | ≤2 /2 /4 /2 /1; complete collection uses all these counts. |
| Clock | ≤64 samples including START, with before/after guards on ordinary metadata calls. |
| Time | START is first program-body statement after import; cooperative3500ms through final output check; requested outer5000ms. |
| Output | ONE FD1 write of ASCII JSONLF≤16384 plus parent marker≤64, total≤16448 authored bytes. |
| Metadata | Seven bigint keys dev/ino/mode/uid/gid/nlink/size plus kind; values remain canonical decimal strings. |

These are source API counts, not kernel/syscall counts, physical termination, RSS/CPU/disk limits or a hard capture bound.
Startup/import/native I/O, synchronous open/fstat latency, cooperative clocks, outer capture/output and current-host absolute-path ancestors remain THIS packet's fresh residuals.
No openat, ancestor/alias exclusion, read-only namespace qualification or Native FD-custody guarantee exists.
Current selected-key equality can miss intervening changes or changes to unselected fields; it proves neither history nor immutable objects.
Current geteuid is a U32 fact only; the acquisition output did not record its original euid, so this cannot establish original UID provenance.

## 3. Inert source — NEVER execute before registration, review and fresh HITL

The fixed reasons are METADATA_OBSERVED, TIME, COUNTER, FLAGS, UID, NAMED_TYPE, METADATA, IO, CLOSE and OUTPUT.
The advisory failedProposalDigest below is a literal reference, not a runtime document read, source hash check or provenance proof.
Each selected bigint must lie in [-2^63,2^64-1]; unsupported values STOP rather than convert through Number or emit raw exceptions.
Mode comparisons select permission bits07777; CURRENT UID/device predicates do not refer back to unreported original acquisition metadata.

<!-- BEGIN F9 M3 XZ METADATA NODE V1 -->
```mjs
import fs from 'node:fs';
const START = process.hrtime.bigint();
const END = START + 3500n * 1000000n;
const ROOT = '/tmp/opencode/f9-m3-xz-inputs-01';
const FILE = ROOT + '/cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz';
const failedProposalDigest = 'dc449d752bbfce5ed97d0b15f5c7d82e549aefc3e1458482fc048506012dbc07';
const keys = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size'];
const counts = { clockSnapshot: 1, lstats: 0, opens: 0, fstats: 0, closes: 0, euid: 0, stdout: 0 };
const root = { fd: null }, file = { fd: null };
let reason = 'NONE', closeFailed = false, currentEuid = null, comparisons = null;
let namedRoot = null, namedFile = null, openedRootBefore = null, openedRootAfter = null;
let openedFileBefore = null, openedFileAfter = null;
process.exitCode = 3;
function poison(r) { if (reason === 'NONE') reason = r; }
function fail(r) { poison(r); throw new Error('STOP'); }
function guard() {
  if (reason !== 'NONE') throw new Error('STOP');
  if (counts.clockSnapshot >= 64) fail('COUNTER');
  counts.clockSnapshot += 1;
  if (process.hrtime.bigint() >= END) fail('TIME');
}
function call(k, cap, fn) {
  guard(); if (counts[k] >= cap) fail('COUNTER');
  counts[k] += 1; const value = fn(); guard(); return value;
}
function close(h) {
  if (h.fd === null) return;
  const fd = h.fd; h.fd = null; counts.closes += 1;
  try { fs.closeSync(fd); } catch { closeFailed = true; reason = 'CLOSE'; }
  if (counts.closes > 2) poison('COUNTER');
}
function snapshot(s) {
  const out = {};
  for (const k of keys) {
    if (typeof s[k] !== 'bigint' || s[k] < -(1n << 63n) || s[k] > (1n << 64n) - 1n) fail('METADATA');
    out[k] = s[k].toString();
  }
  out.kind = s.isDirectory() ? 'DIRECTORY' : s.isFile() ? 'REGULAR' : s.isSymbolicLink() ? 'SYMLINK' : 'OTHER';
  return out;
}
function stat(h) { return snapshot(call('fstats', 4, () => fs.fstatSync(h.fd, { bigint: true }))); }
function same(a, b) { return keys.every(k => a[k] === b[k]); }
try {
  guard(); const C = fs.constants;
  for (const k of ['O_DIRECTORY', 'O_NOFOLLOW', 'O_NONBLOCK']) {
    if (!Number.isInteger(C[k]) || C[k] <= 0) fail('FLAGS');
  }
  if (C.O_RDONLY !== 0) fail('FLAGS');
  const uid = call('euid', 1, () => process.geteuid());
  if (!Number.isInteger(uid) || uid < 0 || uid > 4294967295) fail('UID');
  currentEuid = String(uid);
  namedRoot = snapshot(call('lstats', 2, () => fs.lstatSync(ROOT, { bigint: true })));
  if (namedRoot.kind !== 'DIRECTORY') fail('NAMED_TYPE');
  namedFile = snapshot(call('lstats', 2, () => fs.lstatSync(FILE, { bigint: true })));
  if (namedFile.kind !== 'REGULAR') fail('NAMED_TYPE');
  try {
    call('opens', 2, () => { root.fd = fs.openSync(ROOT, C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW | C.O_NONBLOCK); });
    openedRootBefore = stat(root);
    call('opens', 2, () => { file.fd = fs.openSync(FILE, C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK); });
    openedFileBefore = stat(file);
    openedFileAfter = stat(file);
    openedRootAfter = stat(root);
    comparisons = {
      rootNamedVsFD: same(namedRoot, openedRootBefore),
      fileNamedVsFD: same(namedFile, openedFileBefore),
      rootSnapshotStable: same(openedRootBefore, openedRootAfter),
      fileSnapshotStable: same(openedFileBefore, openedFileAfter),
      fileIsRegular: openedFileBefore.kind === 'REGULAR',
      fileUidMatchesCURRENT: openedFileBefore.uid === currentEuid,
      filePermissions600: (BigInt(openedFileBefore.mode) & 0o7777n) === 0o600n,
      fileNlink1: openedFileBefore.nlink === '1',
      fileSize0: openedFileBefore.size === '0',
      fileDevMatchesCURRENTrootFD: openedFileBefore.dev === openedRootBefore.dev,
    };
  } finally { close(file); close(root); }
  guard();
  if (counts.lstats !== 2 || counts.opens !== 2 || counts.fstats !== 4 || counts.closes !== 2 || counts.euid !== 1) fail('COUNTER');
} catch { poison('IO'); }
function report() {
  return {
    schema: 'M3_XZ_METADATA_DIAGNOSTIC_V1', phase: 'RETAINED_PATH_METADATA_ONLY',
    realm: 'CURRENT_AGENT_SANDBOX_ONLY', provenance: 'DATA_ONLY', failedProposalDigest,
    status: reason === 'NONE' ? 'DIAGNOSTIC_METADATA_ONLY' : 'STOP',
    reason: reason === 'NONE' ? 'METADATA_OBSERVED' : reason,
    root: ROOT, file: FILE, currentEuid, namedRoot, namedFile,
    openedRootBefore, openedRootAfter, openedFileBefore, openedFileAfter, comparisons, counts, closeFailed,
    nativeAuthority: false, trainingReady: false, captureRootCandidate: null, lArtifact: null,
    snapshotCandidate: null, pinComplete: false, installed: false,
    contentRead: false, contentHash: false, historicalFailureIdentified: false,
  };
}
let line;
try {
  if (reason === 'NONE') guard();
  line = JSON.stringify(report()) + '\n';
  if (reason === 'NONE') guard();
  if (!/^[\x20-\x7e]*\n$/.test(line) || Buffer.byteLength(line) > 16384) throw new Error('STOP');
} catch {
  poison('OUTPUT');
  line = '{"schema":"M3_XZ_METADATA_DIAGNOSTIC_V1","phase":"RETAINED_PATH_METADATA_ONLY","realm":"CURRENT_AGENT_SANDBOX_ONLY","provenance":"DATA_ONLY","status":"STOP","reason":"OUTPUT","nativeAuthority":false,"trainingReady":false,"captureRootCandidate":null,"lArtifact":null,"snapshotCandidate":null,"pinComplete":false,"installed":false,"contentRead":false,"contentHash":false,"historicalFailureIdentified":false}\n';
}
try {
  counts.stdout = 1;
  if (fs.writeSync(1, line) === Buffer.byteLength(line) && reason === 'NONE') {
    guard(); process.exitCode = 0;
  }
} catch { poison('OUTPUT'); }
```
<!-- END F9 M3 XZ METADATA NODE V1 -->

<!-- BEGIN F9 M3 XZ METADATA ENTRY V1 -->
```bash
if (( $# != 1 )); then exit 3; fi
( exec -c /usr/local/bin/node --input-type=module --eval "$1" )
status=$?
printf 'F9_M3_XZ_META_CHILD_EXIT=%s\n' "$status" || exit 3
exit "$status"
```
<!-- END F9 M3 XZ METADATA ENTRY V1 -->

## 4. Output interpretation and outer acceptance

Normal output reports six snapshots, currentEuid, present-time comparisons, closeFailed and source counters; no raw error/stack or unbounded path/metadata graph is serialized.
Each snapshot is exactly the seven selected decimal-string keys plus kind DIRECTORY/REGULAR/SYMLINK/OTHER; no BigInt becomes Number.
Comparisons use selected metadata only; file predicates describe openedFileBefore against CURRENT euid/root FD, never original acquisition provenance.
False predicates are diagnostic DATA and do not make otherwise complete collection fail or prove the original cause.
`DIAGNOSTIC_METADATA_ONLY`/exit0 means collection and normal source-close/output/time gates completed, NOT that acquisition security predicates passed.
`historicalFailureIdentified:false`, contentRead/contentHash false, authority/training/pin/installed false and captureRootCandidate/lArtifact/snapshotCandidate null are unconditional, including emergency STOP.
The emergency encoding record omits all uncertain metadata; it cannot satisfy normal acceptance.
`counts.clockSnapshot` and stdout0 are serialized before the sole output attempt; later clock checks and live stdout1 are not reflected.
No deliberate stderr is authored, and no second stdout attempt follows a short/error write.
Any Node/CLI/default warning, unsupported API, startup failure, nonempty stderr, nonzero, missing/bad marker, timeout, malformed/additional/truncated output or status/exit mismatch means outer STOP and consumes the grant.
Even positive JSON followed by exit3 is STOP; normal positive acceptance requires `F9_M3_XZ_META_CHILD_EXIT=0` plus complete valid output.
EOF/marker are ordinary host data, not independent Native source/clock/custody/physical-termination receipts.

## 5. Registration and fresh authorization — all pending

| Artifact / gate | Current state |
|---|---|
| Exact Node fence body / bytes / LF lines / SHA-256 | 5458 UTF-8 bytes /107 LF lines; `64357689835eb55c08fe0ca95294cb5410abfd64128ec1fea4860a42cd23226b`. |
| Exact five-line Bash body / bytes / SHA-256 | 182 UTF-8 bytes /5 LF lines; `241b87ac6316b8bb8410fa3e5955b2f61c87b77e1873d197478365a88fa3991a`. |
| Whole proposal / literal command argv / fixed W cwd / requested outer5000ms | UNREGISTERED. |
| Authorized parse-only/static/API-count/guard/output/preservation review | Parent Node/Bash syntax-only checks passed without body execution or retained-path access; remaining static/review gates pending. |
| ONE fresh exact TWO-path metadata grant + THIS packet's residual acceptance | NONE. |

Register the exact fence bodies retaining final LF and independently registered literal argv transport; supply the Node body as Bash `$1`, not a placeholder or dynamically generated source.
Parent must complete externally authorized measurement/parse-only checks and adversarial/security review before requesting the exact fresh grant.
Fresh acceptance must cover THIS startup/current-host-path/open-fstat/cooperative-clock/output-capture residual frame; old acquisition or metadata acceptances do not transfer.
No runtime, mock, test, command, hash, network, retained/installed/proc/log/receipt/daemon/staging access occurs in this persistence pass.
This proposal changes no acquisition guard, permissions or retained state; a future repair/guard relaxation needs separate reasoning, review and HITL, never an automatic rewrite/retry/fallback.
An operator may interpret separately approved future metadata or choose a fresh different external context; neither route is selected or authorized here.

## 6. Preserved gates

Whole frozen XZdc449/HEADd971/manifestb6f2/M3fdb740/Node01fdfed, all outcomes/null ledgers/old prefixes/programs/models/laws/corpora and source470e540 remain byte-exact.
Preserve accepted BAF3476/17/bf38/D1/B1/O9, Root B/sole counter/F1/charged replay/original source clocks and ONE BOTH-seat1048576/cold10s/lifecycle300s/reserved3s/generator2048.
No downloaded archive, full compiler/installer/N3/safe API/numeric-B/full graph/offline-source/capture/calibration/belief acceptance or Native/policy truth follows.
Installer/mise/source/backend/normal dependencies/licenses/loading/custody remain OPEN; later capture/build/runtime remain offline installed-byte allowlist-only with no acquisition fallback.
All five exclusions remain unproved: full-training-closure, genuine-native-authority, whole-decision-adequacy, calibration and training-readiness.
Navigation: [outcome](native-ingress-host-preparation-m3-xz-outcome.md), [ownership §31](native-ingress-ownership.md#31-m3-xz-stat-stop--retained-custody-and-diagnostic-gate), [implementation §30](native-ingress-implementation.md#30-m3-birth-metadata-stop-before-acquisition), [current PLAN](PLAN-ml-adjutant.md).
