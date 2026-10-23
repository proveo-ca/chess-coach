# F9 M3 — XZ birth-metadata STOP, consumed grant and retained custody

**[Unverified] 2026-10-23 · SUPPLIED TOOL DATA / STOP:STAT / ARCHIVE CHILD EXIT3 / GRANT CONSUMED / NOT INSTALLED / trainingReady:false.**

## 1. Provenance and exact consumed scope

This document transcribes the parent's supplied terminal record; the keeper used repository reads and patches only.
Parent supplies HEAD `6e89fcb88464172b8572791f1d6ced93356fcb9c`, PR50 OPEN/pushed/clean before the operation.
The keeper did not independently verify Git, registrations, hashes, runtime state or external checks.

| Binding | Supplied identity / meaning |
|---|---|
| Fresh actual user choice | `Approve staging once`; ONE frozen attempt with THIS whole XZ packet's residual acceptance. |
| Whole [XZ acquisition proposal](native-ingress-host-preparation-m3-xz-acquisition.md) SHA-256 | `dc449d752bbfce5ed97d0b15f5c7d82e549aefc3e1458482fc048506012dbc07` |
| Exact command SHA-256 | `87014faee1b92cd191ebbf9a473e4c77462f7b35dc834e7ac05d3b135e93fd0a` |
| Frozen Node SHA-256 / UTF-8 bytes / LF lines | `2ccd28e4e351f7bad7444ad2d71aefee2f5ca7f4dbd9518bf70220a7cd36930b` /12759 /244 |
| Frozen Bash SHA-256 / UTF-8 bytes / LF lines | `76b8b069b95a93b8b53039da684d23ef6f54301ec1aebc9998ad84f85adc00c5` /177 /5 |
| Reported result | Explicit Tool exit3 and `F9_M3_XZ_CHILD_EXIT=3`; no stderr or timeout reported. |
| Grant disposition | CONSUMED for the entire attempt, even though source GET count is zero; all earlier grants remain consumed. |

The whole approved XZ proposal remains byte-exact; its earlier pending labels are historical for this single attempt.
Do not mutate that frozen packet to add logging, retry, guard relaxation or RootModeRepair.
The waiting-parent marker and Tool status are supplied ordinary-host data, not independent Native termination, clock, descriptor or custody receipts.

## 2. Exact copied stdout — one JSONLF then markerLF

This text fence preserves the supplied record, not a newly acquired Native observation.

```text
{"schema":"M3_XZ_CONTENT_ACQUISITION_V1","phase":"OPAQUE_ARCHIVE_ACQUISITION_ONLY","realm":"CURRENT_AGENT_SANDBOX_ONLY","provenance":"DATA_ONLY","status":"STOP","reason":"STAT","root":"/tmp/opencode/f9-m3-xz-inputs-01","rootCreated":true,"createdPaths":["/tmp/opencode/f9-m3-xz-inputs-01/cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz"],"inputs":[{"role":"cargo","name":"cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz","expectedLength":10984780,"url":"https://static.rust-lang.org/dist/2026-04-16/cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz","sha256":"e74edd2cf7d0f1f1383b4f00eb90c843750bc489e2ccf7214e6476678a907425","destination":"/tmp/opencode/f9-m3-xz-inputs-01/cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz"},{"role":"rustc","name":"rustc-1.95.0-x86_64-unknown-linux-gnu.tar.xz","expectedLength":80351960,"url":"https://static.rust-lang.org/dist/2026-04-16/rustc-1.95.0-x86_64-unknown-linux-gnu.tar.xz","sha256":"8426a3d170a5879f5682f5fbdd024a1779b3951e7baba685af2d6dc32a6dfc15","destination":"/tmp/opencode/f9-m3-xz-inputs-01/rustc-1.95.0-x86_64-unknown-linux-gnu.tar.xz"},{"role":"rust-std","name":"rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.xz","expectedLength":29573972,"url":"https://static.rust-lang.org/dist/2026-04-16/rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.xz","sha256":"047ea7098803d3500fa1072e9cee5392697e21525559e4458128a2bf874aa382","destination":"/tmp/opencode/f9-m3-xz-inputs-01/rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.xz"},{"role":"rustfmt-preview","name":"rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.xz","expectedLength":2164880,"url":"https://static.rust-lang.org/dist/2026-04-16/rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.xz","sha256":"f1b2a7301513ffdd95ebf22ebbdd932e4d17fc806f748d93924740d0297b1396","destination":"/tmp/opencode/f9-m3-xz-inputs-01/rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.xz"},{"role":"clippy-preview","name":"clippy-1.95.0-x86_64-unknown-linux-gnu.tar.xz","expectedLength":4697128,"url":"https://static.rust-lang.org/dist/2026-04-16/clippy-1.95.0-x86_64-unknown-linux-gnu.tar.xz","sha256":"ac779bc9839dd47180806b133e4e2563c4a34716284cd5b8fede8ef289f452ca","destination":"/tmp/opencode/f9-m3-xz-inputs-01/clippy-1.95.0-x86_64-unknown-linux-gnu.tar.xz"}],"completedCount":0,"records":[],"counts":{"clock":19,"mkdir":1,"opens":2,"closes":2,"fstats":3,"euid":1,"reads":0,"writes":0,"gets":0,"data":0,"acceptedBytes":0,"stdout":0},"closeFailed":false,"httpCloseUncertain":false,"contentHashOnly":true,"nativeAuthority":false,"trainingReady":false,"captureRootCandidate":null,"lArtifact":null,"snapshotCandidate":null,"pinComplete":false,"installed":false}
F9_M3_XZ_CHILD_EXIT=3
```

## 3. Separate derived observations — source snapshot, not physical proof

The serialized counters report mkdir1, opens2, closes2, fstats3 and geteuid1; completedCount0 and records[] report no completed archive.
Source ordering plus the first two successful fstats support that initial root type/owner/mode and the subsequent root-security check passed under the source profile.
The third fstat reached the first cargo writer's birth-metadata group, before GET, file-data write or readback.
That guard requires `.isFile()`, uid=euid, permissions0600, nlink1, size0 and dev equal to the initial root device.
The output includes none of the actual stat fields or original euid; WHICH predicate failed is UNKNOWN.
Do not diagnose device mismatch, umask, link count, proxy behavior, filesystem corruption or a race from this record.

`rootCreated:true` and the one `createdPaths` entry report source creation of the staging directory and first archive pathname.
They do not report the actual file size at stat time; do not call the retained file empty.
Source reads0/writes0/GETs0/data0/acceptedBytes0 mean no authored archive data operations occurred before STOP, not zero kernel or implicit runtime I/O.
No archive was downloaded or content-matched in this attempt; expected input descriptors are not actual payload measurements.
`contentHashOnly:true` identifies the profile and does not assert that any content hash succeeded.
The M3 installation root was uncreated by this phase; no extraction, mise, rustup, installation, build, capture or training followed.

`counts.stdout:0` was serialized BEFORE the one FD1 write attempt; the copied stdout demonstrates output occurred.
`counts.clock:19` is the serialization snapshot, not a final clock count or elapsed-time measurement.
`closeFailed:false` and `httpCloseUncertain:false` are data fields, not Native FD-release, physical cleanup or process-termination receipts.
Source close attempts do not establish independent physical custody or kernel descriptor state.

## 4. Retained custody and next source-only gate

Retain exactly the reported staging root and first archive pathname without further access:

```text
/tmp/opencode/f9-m3-xz-inputs-01
/tmp/opencode/f9-m3-xz-inputs-01/cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz
```

Do not assume other created files from the five expected descriptors.
No read/stat/hash/delete/exec, retry, suffix resumption, next payload, fallback, mode repair, cleanup or further filesystem/network operation follows without a fresh exact grant.
The [metadata diagnostic proposal](native-ingress-host-preparation-m3-xz-metadata-proposal.md) is inert source for these TWO retained paths only, not that grant or permission to run a command now.
Present-time metadata could reveal current predicate values but cannot identify the historical failing predicate.
Any later acquisition change or repair needs separate reasoning, review and HITL; gzip remains unselected, not fallback.

## 5. Unchanged boundaries and handoff

Whole XZdc449/HEADd971/manifestb6f2/M3fdb740/Node01fdfed proposals, outcomes, historical null ledgers and every old prefix/program/model/law/corpus/cap remain byte-exact.
Preserve source470e540, BAF3476/17, bf38/D1/B1/O9, Root B/sole counter/F1/charged replay/original clocks and unresolved numeric-B/invoice/private-guard proofs.
ONE BOTH-seat1048576, cold10s/lifecycle300s including reserved3s and separate generator2048 remain unchanged.
Actual mise/source/backend, installer/compression/preseed/full acquisition/dependency/license/native graph, N3, source clock/loading/custody and read-only namespace remain OPEN.
Later capture/build/runtime remain offline, explicit installed-byte allowlist-only, with no acquisition fallback.
Full-training-closure, genuine-native-authority, whole-decision-adequacy, calibration and training-readiness remain unproved.
`nativeAuthority:false`, `trainingReady:false`, `captureRootCandidate:null`, `lArtifact:null`, `snapshotCandidate:null`, `pinComplete:false`, `installed:false` remain unconditional.
Parent owns external registration, authorized verification and review; this persistence claims no test or qualification PASS.
Navigation: [ownership §31](native-ingress-ownership.md#31-m3-xz-stat-stop--retained-custody-and-diagnostic-gate), [implementation §30](native-ingress-implementation.md#30-m3-birth-metadata-stop-before-acquisition), [current PLAN](PLAN-ml-adjutant.md).
