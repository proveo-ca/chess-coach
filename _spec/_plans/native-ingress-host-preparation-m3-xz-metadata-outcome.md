# F9 M3 — current device divergence, consumed diagnostic and policy gate

**[Unverified] 2026-10-23 · SUPPLIED TOOL DATA / DIAGNOSTIC_METADATA_ONLY / METADATA_OBSERVED / METADATA GRANT CONSUMED / STAGING POLICY UNSELECTED / trainingReady:false.**

## 1. Provenance and exact consumed scope

This document transcribes the parent's supplied diagnostic record; the keeper used repository reads and patches only.
Parent supplies HEAD `8a8c132ab43424272cdaaa2cf0b7f8d7b66998d3`, PR50 OPEN and clean before the operation.
The keeper did not independently verify Git, registrations, hashes, runtime state or external checks.

| Binding | Supplied identity / meaning |
|---|---|
| Actual user choice | `Approve metadata once`; ONE exact two-path read-only metadata diagnostic, not acquisition or policy approval. |
| Whole [metadata proposal](native-ingress-host-preparation-m3-xz-metadata-proposal.md) SHA-256 | `d863564787e0264db574099ac11db4705b966f728f8d2bbc300c2fbf89a9ab80` |
| Exact command SHA-256 | `dd2a9fd089fdc00f642bebcd53351d4b2e02c10ffb39d6846e76219d997d65ad` |
| Frozen Node SHA-256 / UTF-8 bytes / LF lines | `64357689835eb55c08fe0ca95294cb5410abfd64128ec1fea4860a42cd23226b` /5458 /107 |
| Frozen Bash SHA-256 / UTF-8 bytes / LF lines | `241b87ac6316b8bb8410fa3e5955b2f61c87b77e1873d197478365a88fa3991a` /182 /5 |
| Supplied result | ONE completed `DIAGNOSTIC_METADATA_ONLY` / `METADATA_OBSERVED` record and `F9_M3_XZ_META_CHILD_EXIT=0`; no stderr or timeout reported. |
| Grant disposition | CONSUMED; all earlier grants remain consumed, including the failed zero-GET acquisition grant. |

The whole approved diagnostic remains byte-exact; its pending labels are historical for this single attempt.
The parent marker reports an ordinary-host child exit, not an independent Native receipt or qualification.

## 2. Exact copied stdout — one JSONLF then parent markerLF

The following fence copies the supplied record exactly; it is not an independently captured Native observation.

```text
{"schema":"M3_XZ_METADATA_DIAGNOSTIC_V1","phase":"RETAINED_PATH_METADATA_ONLY","realm":"CURRENT_AGENT_SANDBOX_ONLY","provenance":"DATA_ONLY","failedProposalDigest":"dc449d752bbfce5ed97d0b15f5c7d82e549aefc3e1458482fc048506012dbc07","status":"DIAGNOSTIC_METADATA_ONLY","reason":"METADATA_OBSERVED","root":"/tmp/opencode/f9-m3-xz-inputs-01","file":"/tmp/opencode/f9-m3-xz-inputs-01/cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz","currentEuid":"1000","namedRoot":{"dev":"28","ino":"10381","mode":"16832","uid":"1000","gid":"1000","nlink":"2","size":"4096","kind":"DIRECTORY"},"namedFile":{"dev":"29","ino":"1210705","mode":"33152","uid":"1000","gid":"1000","nlink":"1","size":"0","kind":"REGULAR"},"openedRootBefore":{"dev":"28","ino":"10381","mode":"16832","uid":"1000","gid":"1000","nlink":"2","size":"4096","kind":"DIRECTORY"},"openedRootAfter":{"dev":"28","ino":"10381","mode":"16832","uid":"1000","gid":"1000","nlink":"2","size":"4096","kind":"DIRECTORY"},"openedFileBefore":{"dev":"29","ino":"1210705","mode":"33152","uid":"1000","gid":"1000","nlink":"1","size":"0","kind":"REGULAR"},"openedFileAfter":{"dev":"29","ino":"1210705","mode":"33152","uid":"1000","gid":"1000","nlink":"1","size":"0","kind":"REGULAR"},"comparisons":{"rootNamedVsFD":true,"fileNamedVsFD":true,"rootSnapshotStable":true,"fileSnapshotStable":true,"fileIsRegular":true,"fileUidMatchesCURRENT":true,"filePermissions600":true,"fileNlink1":true,"fileSize0":true,"fileDevMatchesCURRENTrootFD":false},"counts":{"clockSnapshot":22,"lstats":2,"opens":2,"fstats":4,"closes":2,"euid":1,"stdout":0},"closeFailed":false,"nativeAuthority":false,"trainingReady":false,"captureRootCandidate":null,"lArtifact":null,"snapshotCandidate":null,"pinComplete":false,"installed":false,"contentRead":false,"contentHash":false,"historicalFailureIdentified":false}
F9_M3_XZ_META_CHILD_EXIT=0
```

## 3. Derived CURRENT metadata — not original acquisition metadata

| Selected field | Root: named / opened before / opened after | Cargo file: named / opened before / opened after |
|---|---|---|
| dev | `28` / `28` / `28` | `29` / `29` / `29` |
| ino | `10381` / `10381` / `10381` | `1210705` / `1210705` / `1210705` |
| mode | `16832` / `16832` / `16832`; permissions `0700` | `33152` / `33152` / `33152`; permissions `0600` |
| uid / gid | `1000` / `1000` in each snapshot | `1000` / `1000` in each snapshot |
| nlink | `2` / `2` / `2` | `1` / `1` / `1` |
| size | `4096` / `4096` / `4096` | `0` / `0` / `0` |
| kind | `DIRECTORY` in each snapshot | `REGULAR` in each snapshot |

For EACH object, named lstat and opened-FD before/after snapshots agree on all seven selected fields: dev, ino, mode, uid, gid, nlink and size.
`fileDevMatchesCURRENTrootFD:false` is the ONLY false comparison; all other nine comparisons are true.
The currently opened file reports device29 while the currently opened root reports device28.
The current file size0 is now observed data, not the earlier unreported size or a prior empty-file assumption.
Selected-key snapshot equality establishes neither global immutability, absence of aliases, future pathname binding nor a continuing read-only Native graph.
Equality also cannot exclude intervening changes or changes to unselected fields.

Current euid1000 matches the currently observed file UID; the original acquisition did not capture its euid value.
Current UID equality therefore supplies no historical UID proof.
`historicalFailureIdentified:false` remains unchanged: CURRENT device inequality does NOT establish which old acquisition predicate failed.
This record does not establish any underlying storage cause, virtualization, filesystem provider, mount semantics, corruption or race.
The failed [acquisition outcome](native-ingress-host-preparation-m3-xz-outcome.md) remains immutable STOP:STAT/exit3 with zero authored GETs, file-data writes and readback.

## 4. Counters, retained paths and no renewed authority

The serialized source counters report lstat2/open2/fstat4/close2/geteuid1 and `closeFailed:false`.
These are source API observations, not kernel-call counts, physical FD-release proof or Native custody.
`clockSnapshot:22` and `stdout:0` were serialized before the sole output write; neither is a final clock/output count or an output-suppression claim.
No archive-content read/hash, readback, network, installer, capture, Native execution, GPU or CPU/source-clock qualification followed from this diagnostic.
No zero-implicit-host-I/O or hard physical-termination guarantee follows from the read-only profile or parent marker.

Retain both literal paths exactly as left after the diagnostic:

```text
/tmp/opencode/f9-m3-xz-inputs-01
/tmp/opencode/f9-m3-xz-inputs-01/cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz
```

No further root/file read, stat, hash, delete or exec is permitted without a fresh exact grant.
No chmod, unlink, repair, retry, suffix resumption, automatic switch, next payload or stage02/root02 creation follows.
Metadata permission and GET permission are not automatically reissued; available operational grants remain zero.
No archive body has been acquired under the recorded attempts.

## 5. Next consequential policy TUI — after publication, NONE selected or granted

Parent supplies Architect `ses_e98dac53dffe6i25eblOwWQ8qT` and DevOps `ses_e98dac52cffezchg4AlgRQXJuq` advice recommending option1 conditionally for ordinary software-input staging.
The keeper did not call agents; this supplied advice grants no design selection, source change or operation.
Lead must present these THREE design-only proposals through a fresh human TUI after publication; no option is currently selected or granted.

| Design-only proposal | Consequence and remaining gate |
|---|---|
| **1. New per-object custody profile (Recommended)** | Permit differing parent/file devices ONLY for ordinary software-input staging under explicit ordinary stable-host trust. Each file must independently bind its named dev/ino to its owned FD and retain complete security/stat/cursor/incoming-content/readback checks. Preserve birth regular-file/owner/0600/nlink1/size0 and root owner/0700 guards. Human must explicitly approve this profile DESIGN before any new-version `stage02` proposal. |
| **2. Keep uniform-device staging** | Retain the same-device requirement and request an operator-qualified FRESH storage/host specification. This selects no alternate root and grants no probe, remote connection or access; no uniform-device candidate elsewhere is proved. |
| **3. Defer staging; source-only** | Make no staging-policy change and perform no operations. Retain the stopped01 state and all remaining approval gates. |

Option1 would replace ONLY the old defensive SAME-DEVICE staging predicate in a NEW VERSION; it never rewrites or retries frozen01.
The XZ input-format selection did NOT approve this waiver.
Same-parent-device equality is not a security attestation; inequality alone does not invalidate ordinary opaque-input checks under the explicitly selected ordinary-host assumptions.
That distinction supplies no openat, OS barrier, immutable-backing, protected-name or Native-capture qualification.
No current or future captureRoot is qualified by these snapshots or by the proposed profile.
Do not write profile code, a payload program or a root02 proposal until the actual policy choice.
Every later route still requires fresh source/identity registration, authorized static verification, reviews and exact applicable filesystem/network approval.

## 6. Frozen contracts and remaining stops

Preserve WHOLE diagnosticd863/XZdc449/HEADd971/manifestb6f2/M3fdb740/Node01fdfed, all outcomes/null ledgers/source470e540 and every old prefix/suffix/program/model/law/corpus byte-exact.
No ordinary staging-profile change weakens frozen F9 N1–N10, actual-source qualification, protected naming, Native loading, continuing read-only enforcement, actual custody or typed positive Native controls.
Input staging is neither captured compiler-source qualification nor a public-work fee exemption; cleanup/resource accounting supplies no source-policy credit.
Accepted BAF3476/17 classification remains unpriced; numeric B, invoice, private guard and full-plan approval remain OPEN.
Preserve Root B, ONE direct counter shared by BOTH seats1048576, unchanged F1 fees and charged replay, original source clocks, cold10s/lifecycle300s including reserved3s and separate generator2048.
Actual mise version/source/backend, installer, rustup auxiliary inputs, offline preseed/recipe, full acquisition graph, normal dependencies/licenses, safe APIs and N3 source/native/loading/custody gates remain OPEN.
Hypothetical dependency counts remain context data, not Native-policy evidence.
Later capture/build/runtime remain offline explicit installed-byte allowlist-only with no acquisition fallback.
Full-training-closure, genuine-native-authority, whole-decision-adequacy, calibration and training-readiness remain unproved.
`nativeAuthority:false`, `trainingReady:false`, `pinComplete:false`, `installed:false`, `contentRead:false`, `contentHash:false`, `historicalFailureIdentified:false` and captureRootCandidate/lArtifact/snapshotCandidate null remain unchanged.
No model work, collection, fitting, training, activation or deployment follows; this repository-only persistence runs no command, hash, test, agent, network or external-path operation.
Navigation: [ownership §32](native-ingress-ownership.md#32-m3-current-device-divergence--consumed-diagnostic-and-policy-gate), [implementation §31](native-ingress-implementation.md#31-m3-per-object-staging-policy-remains-unselected), [current PLAN](PLAN-ml-adjutant.md).
