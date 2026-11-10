# Gate0 / F9 / R4 closure contract

## CURRENT precedence amendment — accepted 2026-11-09

Executor's latest explicit priority is **training first on a supported functional path; ALL security/privacy hardening and isolation come LAST, after the planned training phase is complete and its results are validated**.
Do not resume hardening after one episode or a first checkpoint while the accepted training plan remains unfinished.
This accepted policy supersedes earlier pretraining sequencing, including the prior strict STOP, escaped-group and dual-crash requirements.
It accepts neither an implementation nor a gate result.
The architect advisory in session `ses_e43068215ffeuugrCoynxn0LkH` supports this training-first ordering.

The newly selected **training-functional profile** is distinct from the retained **full-assurance profile** below.
Historical exact-contract and amended full-assurance Gate0/F9/R4 remain OPEN; functional acceptance must never be reported as their PASS or closure.
The older matrices, C1 implementation packet, critical path and execution-packet requirements below retain their full-assurance meaning, not authority to restore pretraining hardening gates.
Where their present-tense instructions conflict with this amendment, this amendment governs current roadmap priority.
Read [readiness.md](readiness.md#current-precedence--training-functional-readiness-2026-11-09), [recovery.md](recovery.md#current-priority--training-first-2026-11-09) and [gate-closure.puml](gate-closure.puml) with this distinction.

### Current accepted critical path

Every phase below is planned work, not a new execution grant or a claim that its exit condition passed.

| Phase | Deliverable | Functional exit condition / authority boundary |
|---|---|---|
| 0 | One bounded upfront inventory of training-critical dependencies and blockers | Record dependency, current evidence, genuine functional blocker, required proof and separate approval; accept and freeze the functional gate set before implementation or operations |
| 1 | Supported runtime/toolchain and actual GPU feasibility on the selected host-backed shared-GPU Docker container path | Establish the chosen path's actual startup, build/runtime compatibility and F64 GPU feasibility; determine whether it needs any part of the old isolated diagnostic pipeline rather than mandating completion of that pipeline |
| 2 | Functional canonical init/BOTH/reference/close evidence and integrated R4 game/model/economic correctness | Obtain genuine source-bound canonical init/open/pass, BOTH histories, independent reference comparison and orderly close/EOF/reap; verify recipient facts, economic conservation, scoring/context, episode/artifact binding and deterministic game eligibility on the selected path |
| 3 | Actual GPU F64 numerical and learner validation | Retain all 4,670 finite-difference coordinates at `eps=1e-6`, `atol=1e-8`, `rtol=1e-5`; prove actual GPU scoring, backward, SGD, checkpoint reload and exact C12 redundant-learner digest agreement; leave CPU Flex and master initialization unchanged |
| 4 | Accepted functional readiness, then **COMPLETE PLANNED TRAINING AND VALIDATE RESULTS** | Explicitly accept the frozen functional evidence; obtain a separate explicit training-execution grant before any training; complete the authorized planned training phase and validate its results under the unchanged model, five-master experiment, learning and eligibility contracts |
| LAST | **ALL security/privacy hardening, isolation and full-assurance qualification** | Only after completion of the planned training phase and validation of its results: separately scope, approve, implement and qualify runtime-domain security, isolation, custody/provenance assurance and final full-assurance acceptance; no historical finding or gate passes by deferral |

### Phase 0 — bounded dependency/blocker inventory

Use one inventory for the selected functional path, not a new open-ended prerequisite audit at each slice.
The rows below identify known evidence gaps; they do not establish missing host facts or approve a concrete implementation.

<a id="current-runtime-packaging"></a>

#### CURRENT 2026-11-10 — Publish+receive selected; coding/operator grants APPROVED / UNCONSUMED / UNRUN

The new [builder-detail paste](../_work/gpu-owner-recovery/runs/host-builder-inputs-1/operator-details-paste.txt) and [normalized detail record](../_work/gpu-owner-recovery/runs/host-builder-inputs-1/operator-details.json) now report Linux/amd64, Debian 12 bookworm, cc/c++ GCC 12.2.0 (`12.2.0-14+deb12u1`), GNU ar/ld 2.40, glibc 2.36 and `/usr/lib/gcc/x86_64-linux-gnu/12/libstdc++.so`.
All 12 command frames and the C++ query report exit 0; these concatenate existing outputs, not original files or separately bounded streams, and they required no new Docker/compiler replay.
Executable Rust/Cargo versions remain null; Rust 1.95.0 is registry-declared only.
The pasted image ID repeats the pinned manifest digest while retained config digest is `d617f1b5c2a18778ba357ba0528e973bd24992b0dd18000dfbca059f4a15ebda`; cause unknown, wrong image not established, no acquisition invalidation or new custody gate.
The old root observation/paste remain byte-unchanged details-pending snapshots; current received facts supersede that missing-detail state without rewriting history.
Latest confirmed pushed source is now `f3e277dbbf33c0aa69172cca1890792656d4cd09`; earlier `d3bb6bcc6420f50c559ad7260f968578e20cf725` and original pre-handoff `2c17a189ecba08cb7078ea8daf991317d09c3ef1` stay history, with actual operator-executed commit unknown.

Executor selected `Rust base+Bun Recommended` in the [source-only runtime request](../_work/gpu-owner-recovery/qualification/runtime-request.json).
The qualification recipe now uses the same Rust pin for inputs/runtime and copies only the Bun interpreter from its own pinned stage, removes only its builder rootfs copy, and guards future actual Rust/Cargo 1.95.0 and Bun 1.4.0 startup.
All RUN instructions remain network-disabled; four locked/offline Cargo no-run builds, CPU/GPU paths and UID 1000 scratch remain; production Dockerfiles/Rust/math/F64/C12/initialization/master contracts remain unchanged.
The current [source-6 publisher receipt](../_work/gpu-owner-recovery/runs/gpu-input-transfer-source-6/receipt.json) records **PASS_TRANSFER_SOURCE_ONLY**, sourceChanged:false, **316 frozen hashes / 65 unchanged native inputs**, six passing stages, **89 helper tests / 438 assertions**, **37 qualification tests / 280 assertions** and **four typechecks**.
The active identity request binds **source-6 exactly**, not source-5/source-4.
Source-5 **311 hashes / 88 helper tests / 428 assertions + 37/280 qualification + four types** remains immutable closed-second-attempt proof, not current modified-publisher proof.
Transfer source-4 **87/422** remains historical before the final private-origin capture fix; source-3 **303 hashes / 83 helper tests / 371 assertions / 37 qualification tests / 280 assertions + four types** remains immutable original preparation lineage, not current full-publisher proof.
Shared `sourceInputPaths`/`sourceInventory` now include unchanged `schemas/feature-layout.json`, required by policy-io's CPU score test through compile-time `include_str!`; this changes inventory completeness, not schema/Rust/math semantics.
Ten shell -n RUN-body checks still parse syntax only; current source checks execute no version preflight, Cargo/LLVM build, image or GPU operation.
The [qualification-source-4 receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-source-4/receipt.json) remains unchanged historical **36/278 + four types, PRE_65_SCHEMA_INPUT**, 289 bound inputs/64 native entries and manifest `db8a83709b8c6813fe406cc1325fa2c6987691eecb74dd98c769327d937a7f14`.
Qualification source-3 36/265 and source-2 32/223 PRE_RUST_BASE remain historical; the independent inventory-helper 8/64 types/Fish proof stays separate.
Transfer source-1/source-2 80/359 are historical; source-1 predates registry binding, source-2 predates the four accepted MEDIUM fixes.
None of these source-only receipts establishes live preparation/publication, native linking/ABI, image usability, current CPU regression or GPU qualification; entrypoints remain SOURCE_ONLY_DISABLED and trainingReady:false.

The original [libdevice proposal](../_work/gpu-owner-recovery/qualification/libdevice-proposal.json) retains its metadata-only capture: libnvvm 13.0.48 linux-x86_64 archive 43,941,232 bytes, SHA `8c5676a65a2e6d13e3c229f025af18677de46c220d77992fe932200fa798b19b`, old unknown member/null extracted hash and no acquisition at that phase.
The later completed preparation establishes the actual bitcode/LICENSE identities separately without changing that proposal.
CUDARC 13000 remains a candidate, not selected or PTX qualified; the traced LLVM-route library observations are source-scoped and actual runtime-library coverage stays false.
Only libdevice bitcode plus host driver/JIT support is proposed, not a full toolkit or compiler installation.
The [host-build proposal](../_work/gpu-owner-recovery/qualification/host-build-proposal.json), old [transfer proposal](../_work/gpu-owner-recovery/qualification/input-transfer-proposal.json) and runtime/libdevice/source-2 host-inputs projections retain their original false/null fields unchanged.
Those historical flags do not deny or enlarge later grants; original preparation and all three publication attempts are now consumed.
The distinct HTTPS second attempt failed at commit and remains consumed.
Executor's **Inherit Identity Recommended** third attempt completed **PASS in 21,178.921619 ms**: normal commit/fixed-HTTPS OID push **1/1**, **DRAFT release 439935095**, **two verified uploads**, grant **CONSUMED**.
The [current outcome](#current-identity-publication) establishes input preparation/DRAFT publication only, not a created Git tag, public release, host execution or training readiness.
Executor has selected **Publish+receive Recommended** at the [combined HOST-command decision](#current-host-receive); both fresh allowances are approved/unconsumed/unrun, and parent will publish once then stop only awaiting operator receipt/stdout verification.
Canonical BOTH/reference/close, integrated R4, five-master activation and literal-UUID telemetry/coexistence remain outside backend feasibility; hardening stays LAST after ALL planned training completes and results validate, full assurance OPEN and trainingReady:false.

<a id="current-input-transfer"></a>

#### Original transfer request — preparation and first publication consumed, mutation invocations zero

Executor selected **Draft assets Recommended** after the previous documentation pass.
[transfer/request.json](../_work/gpu-owner-recovery/qualification/transfer/request.json) records **APPROVED_ONE_PREPARATION_AND_DRAFT_ASSET_PUBLICATION**; [gpu-input-transfer.puml](gpu-input-transfer.puml) owns its implemented helpers and [current readiness](gpu-readiness.md#current-input-transfer) records the exact bounds.
The [preparation receipt](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/receipt.json) retains **PASS_PREPARATION_ONLY_PUBLICATION_PENDING**, both workers PASS/exit 0, **download 1/1 and preparation 1/1 consumed / zero remaining**, publicationPerformed:false and publicationContinuationAuthorized:true as its pre-publication snapshot.
The later [publication receipt](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/publication.json) supersedes that pending/continuation state with **FAIL / PUBLICATION_ORIGIN_MISMATCH** and a consumed publication attempt.
Original request/preparation fields remain unchanged and authorize neither preparation replay nor a new publisher attempt or source fix.
The later explicit-HTTPS request independently supplied the second grant, now consumed too; it reopens or overwrites none of these records.
Consumed download scope: one exact libnvvm 13.0.48 NVIDIA archive, **43,941,232 bytes**, SHA `8c5676a65a2e6d13e3c229f025af18677de46c220d77992fe932200fa798b19b`, <=600s; unique positive-size REGULAR libdevice <=2 MiB and regular vendor LICENSE/EULA total <=1 MiB, otherwise STOP without fallback.
Consumed existing-input preparation scope: LLVM <=400 MiB from the retained 2,684-entry tree without LLVM execution/re-download/old archive pipeline; public Cargo <=2 GiB/671 frozen lock-matching identities/checksums/zero fetches, excluding credentials/home configuration/rustup/binaries; source/tools <=16 MiB excluding training/state.
Context <=3 GiB, compressed bundle <=1 GiB and local preparation <=900s; >=8 GiB initial free workspace and <=8 GiB soft payload use are ordinary budgets, not filesystem-quota assurance.
Historical publication maxima were **one normal source commit and one HTTPS push**, fixed `proveo-ca/chess-coach` / `feat-ml-adjuntant-ii`, **one DRAFT release** `gpu-feasibility-inputs-20261110-1` and **two uploads** `host-feasibility-inputs-1.tar.gz` / `host-feasibility-inputs-1.manifest.json`.
Its historical shrinking **600s budget** included permissions/mutations/callbacks; the attempt stopped after 31.82 ms at local origin validation, before auth/API or any mutation.
Actual commit/push/release/upload invocations remain **zero**, not a consumed commit invocation/grant and not permission to retry the consumed publication attempt.

Implemented `prepare.ts` uses fresh exclusive markers/directories and one exact archive stream; `archive.ts` performs bounded GNU tar listing/selected-member extraction only on that new vendor archive, not the halted old LLVM archive pipeline.
Completed preparation staged five explicit roots and packaged an explicit NUL member list with `--no-recursion`; it recorded missing approved Cargo archives/metadata and kept completeOfflineBuildCoverageQualified:false.
`sourceInputPaths`/`requireReviewedNativePaths` reject new native paths outside the gate and compare hashes before copy; the source gate freezes imported `provision.ts` and detects native filename-set changes.
The original `publish-prepared.ts` entry belongs to the closed first attempt; `publish-https.ts` now exports shared `publishPreparedHttps(activeRequest)`, and the fresh `publish-inherited-identity.ts` entry supplies the identity request/source-6 gate.
`runPublisher` remains TOP LEVEL, with ordinary commands in `runBounded` and private origin/rewrite callbacks on the same shrinking budget.
The third attempt created its asset manifest in ignored cache after exact source push to avoid a commit/hash cycle; the first two attempts never reached that path, and no grant remains for replay.
The publisher's actual remote tag/peeled resolution before create and finally permits only absence or the exact pushed commit; wrong/malformed refs stop without repair.
Mutation attempts are recorded before execution; attempted commitSucceeded stays null until success is confirmed, retaining unknown/partial outcomes without retry.
API asset digests must match when supplied; absent digests explicitly record null rather than remote hash-verification success.
These document the four accepted MEDIUM pivots, not a new assurance gate.

Executor previously reported DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` READY within the then-active grant and adversarial `ses_e3cea2a1cffeBacqiaDdQkXxlq` accepting all four fixes.
Executor reports security `ses_e3cea2a12ffe9TMeXvXBhDE8n7` without scoped findings for the same operational/auth scope; its source-2 review predates the fixes and is not represented as a source-3 re-review.
These retained source/authority reviews do not claim functional readiness READY, override the later STOP, grant retry or establish publication success.

<a id="current-prepared-input-bytes"></a>

##### Completed preparation and byte-check snapshot — not build/publication qualification

The [download record](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/download.json) records HTTP 200 with exact archive bytes/hash; download and preparation workers passed under configured 600s/900s client deadlines.
The [preparation record](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/preparation.json) establishes regular `libnvvm-linux-x86_64-13.0.48-archive/nvvm/libdevice/libdevice.10.bc`, **464,132 bytes**, SHA `91334d6e12748f6cb5bbf0a1cd965a56bcd93dc4f496d2e5c5f8c6e523094356`.
Regular vendor `LICENSE` is **67,875 bytes**, SHA `f176e5fd245a4ff1d7aee743e345e14b29c4b724f150e4858c4c6a313966d1fb`; no NVIDIA compiler libraries/executables were staged.
LLVM **329,242,172 payload bytes** were hashed/copied from 2,684 retained metadata entries without invoking LLVM.
The preparation binds **65 native inputs / 663,642 source-tools bytes** and **98,780,903 Cargo bytes**, **568** existing locked archives / **618** index metadata files, **103 missing locked archives / zero missing metadata**, with zero fetches.
Context **429,218,730 bytes** comprises **3,800 files / 137 recorded directories / two symlinks** checked separately.
Bundle **140,694,281 bytes** has SHA `9001bfeb88ce5433138d5f0fd23b3c7ab0590cc0bd47900cc1c0a1d6923c65f7`; **614,911,523 workspace payload bytes** remain a soft accounting measure, not filesystem-quota assurance.
The independent [checker](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/verify-prepared.ts) and [result](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/prepared-check.json) record **PASS_PREPARED_INPUT_BYTES_ONLY**.
It rehashed all 3,800 files and the bundle, checked recorded directories/links and unlisted non-directory payload, bound 65 native inputs and 303 frozen source hashes, and checked four preparation captures.
Its **three spec-index matches ran before this docs update**; they remain historical snapshot evidence, not a fresh receipt for changed diagrams/index.
This docs pass rehashes nothing and reruns no checker; original source-3 proof/review records remain immutable preparation history, not fresh acceptance of modified publisher code.
Ignored-cache payloads stay out of Git; the bounded run-directory coverage follows receipts/manifests/captures/checker, not thousands of payload filenames.
Offline-build completeness remains **UNPROVEN**, completeOfflineBuildCoverageQualified:false.
Missing archives do not establish selected-build failure or which future inputs are needed, and grant no fetch/repair authority or new per-library prerequisite before publication.

<a id="current-publication-stop"></a>

##### Closed first publication FAIL / consumed STOP — original outcome retained

Executor reports exactly one approved top-level `publish-prepared.ts` invocation.
The retained [publication.json](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/publication.json) records **FAIL / PUBLICATION_ORIGIN_MISMATCH / origin-fetch**, elapsed **31.820182000000003 ms**, with [publication.operation](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/publication.operation) retained.
The branch capture matches `feat-ml-adjuntant-ii`; [publish-02 stdout](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/publish-02/command.stdout) is exactly **`git@github.com:proveo-ca/chess-coach.git`**.
That local URL query exited 0 with empty stderr, but the initial publisher's origin-metadata rule admitted only HTTPS; this was not an auth/API/network failure, and push-origin inspection was not reached.
**No GitHub auth/API/permission check or external mutation occurred.**
Actual counters: **commit 0 / push 0 / createRelease 0 / upload 0 / validateFrozen 0 / commitManifest 0**.
SourceCommit/pushedCommit/releaseId are **null**, assets/uploadedAssets/verifiedAssets are **empty**, and commitSucceeded:false means **not attempted**, not failed capture or a failed commit.
The first publication attempt remains **consumed / STOP**, with **no automatic retry**; the later explicit-HTTPS request supplies distinct fresh scope, not permission derived from unused mutation maxima.
Do not call a commit grant consumed when invocations were zero, and do not infer retry permission from those zeros or the historical preparation/request flags.
At the first STOP, latest confirmed push was `d3bb6bcc6420f50c559ad7260f968578e20cf725`; that attempt committed/pushed/published nothing, while the later third outcome confirms `f3e277dbbf33c0aa69172cca1890792656d4cd09`.
At the first STOP, Executor reported **122 controlled text paths staged but uncommitted**.
That staging projection and later 161-file snapshot are historical; the third outcome records 193 controlled changed text paths in the actual source commit.
The retained [stage audit](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/stage-audit.json) is the expected pre-attempt snapshot, not a fresh result for these later docs edits; do not rewrite it, reset/clear the stage or manually commit.
Prepared context/bundle/byte-check and original source-3 receipt remain unchanged; download/preparation stay consumed and are not rerun here.
Executor subsequently resolved the three-route fork by selecting **Explicit HTTPS Recommended**; local-only retention and alternate HTTPS destination were not selected.
At that first STOP, completed operational evidence was **prepared bytes only plus the first FAIL**.
The later second failure below adds no publication success or functional readiness READY.
At that first STOP, operator download/extraction and host/build/GPU/training work remained unauthorized; all previous native/LLVM/Mise/cache/metadata/operator allowances stay spent. The later [handoff request](#current-host-receive) separately approves one bounded operator receive only, not build/GPU/training.
This docs pass stages/runs nothing and edits no source, request, audit or outcome record; host/build/GPU limits remain unapproved.
ALL security/privacy/isolation hardening remains AFTER ALL planned training completes and results validate; full assurance OPEN, trainingReady:false.

<a id="current-https-publication"></a>

##### Explicit-HTTPS publication-2 — FAIL at commit; consumed attempt and commit invocation

The distinct [https-publication-request.json](../_work/gpu-owner-recovery/qualification/transfer/https-publication-request.json) records **APPROVED_ONE_FRESH_PUBLICATION_ATTEMPT_ONLY**, selected AFTER the closed first failure.
It approved helper fix/source-5 proof and **ONE fresh 600s attempt**, with maxima **one normal commit, one explicit fixed-HTTPS push, one DRAFT release and two named uploads**, existing authentication only.
Its approval status remains an unchanged historical projection; that second attempt is now consumed, not current replay permission.
Earlier **APPROVED/UNCONSUMED / NOT RUN** and **future / NOT CREATED** descriptions retain their pre-attempt chronology, not current status.
Fixed repository/branch/tag/assets remain `proveo-ca/chess-coach` / `feat-ml-adjuntant-ii` / `gpu-feasibility-inputs-20261110-1` / the original bundle and manifest names.
No Git/auth configuration change, automatic retry, overwrite/public publish/delete, new acquisition/copy/repack/preparation replay, operator download/extraction, image/native build, host/GPU execution or training is authorized.
The original **140,694,281-byte** bundle SHA `9001bfeb88ce5433138d5f0fd23b3c7ab0590cc0bd47900cc1c0a1d6923c65f7`, context-manifest SHA `64e8c6f2ea895fb8fac1821d48fc5b39a93122e8fdb5f35c4f8fbcd6494c7838` and **65 native identities** are fixed reuse inputs.

The source-5 [publisher](../_work/gpu-owner-recovery/qualification/transfer/publish.ts) used by the second attempt accepted exact repository SSH origin forms **only as metadata**.
Every Git network target is literal `https://github.com/proveo-ca/chess-coach.git`; push uses the inspected commit OID rather than mutable HEAD or an origin alias.
Read-only origin/rewrite queries use the same cwd/environment and remaining publication timeout with **64 KiB buffer limits**.
Any applicable `insteadOf`/`pushInsteadOf` rejects without configuration repair, including an identity rewrite.
Origin checks return a private Boolean; rewrite checks return verdict/count information.
Both raw query outputs stay in memory and never enter persisted command streams, avoiding expanded credential-bearing URL capture.
Those source contracts remain unchanged; actual private origins/rewrite preflight passed in this second attempt, not asset-upload qualification or a new assurance gate.

At the second attempt, [publish-https.ts](../_work/gpu-owner-recovery/qualification/transfer/publish-https.ts) separated immutable preparation/source-3 receipt lineage from its then-current **source-5** publisher gate.
The current shared export instead takes the active request's gate, now source-6 for the approved identity attempt below.
It checks exactly matching original/current/reviewed **65 native path/hash entries**, approved bundle/context identities and the hash of the retained original source-3 receipt.
It deliberately does not apply source-3's obsolete full helper hash set to the authorized publisher edits.
The second attempt's unexecuted post-commit path required raw committed Git blobs to match its then-current source-5 without lazy fetch; its unreached external manifest path would write exclusively **after exact source push** in ignored cache, binding both generations without a commit/hash cycle.
No LLVM prefix read/copy, Cargo fetch, NVIDIA acquisition or preparation replay follows from this split lineage.

Output root `_work/gpu-owner-recovery/runs/host-feasibility-publication-2` **NOW EXISTS** and has bounded diagram/index coverage.
It retains [publication.json](../_work/gpu-owner-recovery/runs/host-feasibility-publication-2/publication.json), [publication.operation](../_work/gpu-owner-recovery/runs/host-feasibility-publication-2/publication.operation), [reuse.json](../_work/gpu-owner-recovery/runs/host-feasibility-publication-2/reuse.json), `publish-01..04` streams and the separate [verify-outcome.ts](../_work/gpu-owner-recovery/runs/host-feasibility-publication-2/verify-outcome.ts) / [outcome-check.json](../_work/gpu-owner-recovery/runs/host-feasibility-publication-2/outcome-check.json).
The second attempt ran **ONCE**, then stopped **FAIL / PUBLICATION_COMMAND_FAILED / commit** after **838.463473 ms**, not a deadline failure.
Branch/private fetch/private push-origin checks and HTTPS rewrite preflight passed, with **rules:0**.
The second attempt's existing-auth `gh` repository permission API passed with **permissions.push:true**; that attempt did not prove release-asset upload rights, unlike the later completed third uploads.
The second freeze/reuse PASS bound original native65/bundle/context/source-3 lineage plus then-current source-5; that retained observation does not qualify modified source-6 helpers.

Actual counters are **commit 1 / push 0 / createRelease 0 / upload 0**, **validateFrozen 1 / checkOrigin 2 / checkTransport 1 / commitManifest 0**.
The one Git commit command returned **128**; [publish-04 stderr](../_work/gpu-owner-recovery/runs/host-feasibility-publication-2/publish-04/command.stderr) records **Author identity unknown / fatal: empty ident name**.
No post-commit/tag/release check, source push or sidecar asset-manifest creation occurred.
The receipt retains **commitSucceeded:null**, null source/pushed commits/release ID and empty asset arrays; do not rewrite these historical bytes.
The separate **PASS_RETAINED_FAILURE_RECORD_CHECK_ONLY** observes HEAD unchanged at `d3bb6bcc6420f50c559ad7260f968578e20cf725` and **observedNewHeadCommitCreated:false**.
That supplemental observation distinguishes a consumed invocation from a created commit; it does not convert the old receipt's null to a different outcome.

The old source-5 publisher child allowlist omitted **GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME and GIT_COMMITTER_EMAIL**.
The outcome check records all four parent presence booleans **true**, no identity values and child forwarding **false**.
Source inspection confirms the omission; the presence booleans do not validate an author or authorize inventing/setting identity or changing Git configuration.
The metadata-only check reads retained text/source-gate records and observes HEAD read-only; it does not read prepared payloads, copy, repack, fetch or run native build/GPU work.
This docs pass reruns no checker, query or hash operation.

**Both prior publication attempts and the second attempt's one actual commit invocation are CONSUMED / STOP**.
Unused push/release/upload maxima authorize no replay, and neither old request grants another attempt.
Executor has since resolved the three-proposal fork by selecting **Inherit Identity Recommended** under the distinct active request below.
Existing-field inheritance is implemented and source-6-verified; operator-owned commit/push and stop-local were not selected.
The later third attempt has now passed under its own distinct authority; neither consumed prior request supplied replay permission.
Do not follow captured Git configuration advice, invent an author or replay either publication or original download/preparation.

The second-STOP snapshot reported **161 text files / 2,235,091 text bytes staged**, original 122 preserved, with pub2 evidence untracked.
That snapshot and subsequent pre-third-attempt unstaged state remain history; the actual third source commit includes the controlled identity helpers/request/source-6 proof and prepublication docs/status, matching its own 193-path audit.
The old stage audit/staged snapshots retain pre-attempt scope, not fresh validation of these later docs; this pass stages/resets nothing.
The [readiness outcome](gpu-readiness.md#current-https-publication) records the same consumed boundary; [gpu-input-transfer.puml](gpu-input-transfer.puml) owns the lineage/environment reasoning.
At the second STOP, latest push was `d3bb6bcc6420f50c559ad7260f968578e20cf725`; third publication now confirms `f3e277dbbf33c0aa69172cca1890792656d4cd09`, with unchanged native65/preparation/production Rust/model/math and source-6-frozen publisher code.
No new approval loop or hardening prerequisite is introduced; ALL security/privacy/isolation hardening remains AFTER ALL planned training completes and results validate, full assurance OPEN and trainingReady:false.

<a id="current-identity-publication"></a>

##### Inherit Identity publication-3 — PASS / grant CONSUMED; DRAFT and two assets verified

The [identity-publication-request.json](../_work/gpu-owner-recovery/qualification/transfer/identity-publication-request.json) records Executor's **Inherit Identity Recommended** selection after the second STOP.
It supplied **ONE fresh 600s publication attempt**, now completed PASS: **normal commit 1 / fixed-HTTPS verified commit-OID push 1 / DRAFT 1 / uploads 2**, existing auth and existing four identity fields unchanged.
The unchanged approval projection is historical; that third grant is **CONSUMED** and grants no further attempt/commit/push, while the later host-receive handoff request separately supplies fresh coding/operator scope.
The original repository/branch/tag/asset names, approved bundle/context hashes and native65 are fixed reuse inputs; original download/preparation remain **1/1 consumed**, not replay permission.
No identity value change/persistence, Git/auth configuration change, hooks bypass, automatic retry, acquisition/copy/repack, operator download/extraction, image/native build, host/GPU execution or training is approved.

Implemented `publicationEnvironment` forwards existing **GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME and GIT_COMMITTER_EMAIL** unchanged in memory.
It creates no defaults/new author, mutates no parent identity and serializes no identity values into helper results/captures.
The new private **identity-preflight/checkIdentity** uses the same child cwd/environment, remaining publication budget and **64 KiB** buffer bound for **git var GIT_AUTHOR_IDENT** and **GIT_COMMITTER_IDENT**.
It requires all four fields and both exit-0/empty-stderr/nonempty-output results; only a Boolean decision reaches publication status, never raw identity command streams.
False stops **EXISTING_GIT_IDENTITY_NOT_ACCEPTED** before mutation.
The actual `identity-preflight` passed once within the selected publication budget; only the Boolean result persists, not raw private identity output.
This creates no further authorization or identity-hardening gate.
Private origin/rewrite handling and literal HTTPS/commit-OID transport remain unchanged, with no configuration setter or hooks bypass.

The completed single top-level [publish-inherited-identity.ts](../_work/gpu-owner-recovery/qualification/transfer/publish-inherited-identity.ts) invocation passed the request to shared exported **publishPreparedHttps(activeRequest)**.
The shared helper preserves original preparation/source-3/native65/bundle/context/first-failure lineage and uses current **source-6** for modified publisher code, never source-3's obsolete full helper set or source-5 as current full proof.
Optional `priorFailure` validates the retained second FAIL at commit with **1/0/0/0** commit/push/create/upload counters.
Source-6 additionally binds original pub2 **publication.json, reuse.json and outcome-check.json** metadata.
No old request, receipt, null/false field or consumed-attempt marker changes; raw post-hook committed blobs and exclusive post-exact-push manifest contracts remain.

Current proof is **PASS_TRANSFER_SOURCE_ONLY**, **316 hashes / 65 native / 89 helper tests / 438 assertions / 37 qualification tests / 280 assertions + four types**, six PASS/exit-0 stages and sourceChanged:false.
That source-only evidence remains separate from the actual publication result.
Now-existing `_work/gpu-owner-recovery/runs/host-feasibility-publication-3` is covered/indexed with [publication.json](../_work/gpu-owner-recovery/runs/host-feasibility-publication-3/publication.json), `publication.operation`, [reuse.json](../_work/gpu-owner-recovery/runs/host-feasibility-publication-3/reuse.json), **publish-01..17** streams, [verify-outcome.ts](../_work/gpu-owner-recovery/runs/host-feasibility-publication-3/verify-outcome.ts) and [outcome-check.json](../_work/gpu-owner-recovery/runs/host-feasibility-publication-3/outcome-check.json) plus stdout/stderr.
The receipt records **PASS**, `failure:null`, `failedStep:null`, **21,178.921619 ms**, `commitSucceeded:true` and sourceCommit=pushedCommit=**`f3e277dbbf33c0aa69172cca1890792656d4cd09`**.
Actual mutation counts are **1/1/1/2**; callbacks **validateFrozen 3 / commitManifest 1 / checkIdentity 1 / checkOrigin 6 / checkTransport 4** all passed, with rewrite rules 0.
The normal commit's exact OID was pushed once to **feat-ml-adjuntant-ii** over literal **https://github.com/proveo-ca/chess-coach.git**, not an origin alias or mutable HEAD.
Reuse passed against original native65/bundle/context/source-3/first failure/second priorFailure/current source-6 without acquisition/copy/repack/preparation replay or compilation.

Final retained API metadata establishes **DRAFT release 439935095**, target exact source OID, `tag_name:gpu-feasibility-inputs-20261110-1`, **draft:true / published_at:null**.
Its actual [HTML URL](https://github.com/proveo-ca/chess-coach/releases/tag/untagged-56714ddf138f3c4ba16c) uses an untagged DRAFT path.
The final retained Git tag lookup is empty: **ABSENT_WHILE_DRAFT**, accepted; do not claim a created remote Git tag or publicly published release.

| Uploaded asset / ID | Bytes | Final API SHA-256 |
|---|---:|---|
| `host-feasibility-inputs-1.tar.gz` / **730047564** | **140,694,281** | `9001bfeb88ce5433138d5f0fd23b3c7ab0590cc0bd47900cc1c0a1d6923c65f7` |
| `host-feasibility-inputs-1.manifest.json` / **730048215** | **868,843** | `2676780f2b932d0453fef05ad39581152f47efeaea11ae22b9079875fece1829` |

Both assets have **state:uploaded** with matching size/digest in the retained final API response.
The separate **PASS_RETAINED_PUBLICATION_EVIDENCE_ONLY** checker rehashed the external sidecar/source binding, validated that retained DRAFT/target/tag/asset metadata, checked **316 raw committed source blobs** and **193 controlled changed text paths** against stage audit, and hashed **38 pre-check evidence files**.
It repeated no live GitHub query or download/copy/repack; this docs pass reruns no checker/hash/query and reads no payload.
The external manifest was created exclusively **after exact source push**, intentionally uncommitted to avoid a source/hash cycle; source commit and publication outcomes remain separate generations.

Latest confirmed push is now **`f3e277dbbf33c0aa69172cca1890792656d4cd09`**.
Executor reports local origin tracking still `d3bb6bcc6420f50c559ad7260f968578e20cf725` after explicit-URL push; `ahead 1` is not evidence of an unpushed commit, and no fetch is needed or authorized.
The 193-path source commit contains controlled text/source-6 proof/prepublication docs/status, **no binary/cache payloads**.
New pub3 outcome evidence and these postpublication docs/status remain **LOCAL / UNCOMMITTED** per Executor; no stage/commit/push by this pass or extra mutation allowance.
Source-6 helper/request/proof bytes and both failure receipts stay frozen; no receipt is rewritten to claim inclusion in the commit it describes.
The [readiness outcome](gpu-readiness.md#current-identity-publication) and [owning diagram](gpu-input-transfer.puml) record the same PASS/consumed boundary.

**Upgrade complete: input preparation + DRAFT publication only.**
Original prepared context/LLVM/Cargo/native bounds and **103 missing archives / zero missing metadata / offline-build UNPROVEN** remain unchanged.
The [active host-receive handoff request](#current-host-receive) now approves the exact combined coding-publication/operator-command scope; both allowances remain unconsumed/unrun, with build/GPU/training excluded.
No functional F64/4,670-coordinate/tolerance/C12/CPU Flex/master/BOTH/reference/close/R4/telemetry/coexistence qualification follows; native65/Rust/model/math/production contracts stay unchanged, runtime/training entrypoints disabled and trainingReady:false.
ALL security/privacy/isolation hardening remains AFTER ALL planned training completes and results validate; no new functional or assurance gate is introduced.

<a id="current-host-receive"></a>

##### Publish+receive Recommended selected — coding/operator scope APPROVED / UNCONSUMED / UNRUN

Executor's correction is **"stop only when a decision of a host command verification is needed"**.
Source work continued to that exact combined decision; Executor has now selected **Publish+receive Recommended**, not adjust destination or defer, and no new planning question remains.
The distinct active [handoff-1/request.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/request.json) records **APPROVED_ONE_SOURCE_PUBLICATION_AND_ONE_OPERATOR_RECEIVE_INVOCATION**.
It approves **ONE coding normal commit + ONE literal fixed-HTTPS commit-OID push <=600s**, existing identity/auth only, then **ONE operator receive invocation <=900s** under the unchanged helper/download/extract limits.
Both allowances are **APPROVED / UNCONSUMED / UNRUN**; no actual coding publication, helper fetch, host asset download or extraction has occurred.
Approved coding scope includes reviewed helper/evidence/docs and retained pub3 outcomes, **no new release/assets/uploads** or unrelated maintenance publication.
The [plan.json proposal](../_work/gpu-owner-recovery/qualification/host-receive/plan.json) keeps **codingSourcePublicationApproved:false / operatorReceiveCommandApproved:false** as immutable history, not current authority.
The referenced [host-command-approval.json proposal](../_work/gpu-owner-recovery/runs/host-input-receive-source-2/host-command-approval.json) also retains its original AWAITING/false fields; active authority lives in the later request, never a rewrite or replay of an old consumed grant.

[gpu-host-receive.puml](gpu-host-receive.puml) owns the source/command contract and links back to transfer/qualification/build; the [readiness packet](gpu-readiness.md#current-host-receive) records the same bounds/options.
Asset source remains **`f3e277dbbf33c0aa69172cca1890792656d4cd09`**, distinct from the **unknown future helper-handoff OID** after the approved but unrun coding commit/push.
Helper **receive.ts / 17,994 bytes / SHA-256 `091a431757ef83710a95156816e085cb1ed36b632e4923c9632695ffe821bafa`** is fixed; only that actual future OID is late-bound, not a branch/HEAD/tag/zero-placeholder ref.
Existing DRAFT **439935095**, manifest asset **730048215 / 868,843 bytes / SHA `2676780f2b932d0453fef05ad39581152f47efeaea11ae22b9079875fece1829`** and bundle **730047564 / 140,694,281 bytes / SHA `9001bfeb88ce5433138d5f0fd23b3c7ab0590cc0bd47900cc1c0a1d6923c65f7`** remain unchanged.
Remote Git tag remains **ABSENT_WHILE_DRAFT**, no created-tag/public-release claim or new upload scope.

The [source-2 receipt](../_work/gpu-owner-recovery/runs/host-input-receive-source-2/receipt.json) is **PASS_HOST_RECEIVE_SOURCE_ONLY**, failure:null/sourceChanged:false: **34 receiver tests / 352 assertions + 89 transfer / 438 + 37 qualification / 280 + five typechecks**, eight stages PASS/exit 0.
[Source-1](../_work/gpu-owner-recovery/runs/host-input-receive-source-1/receipt.json) stays historical **31 receiver tests / 280 assertions** before the final fixes.
Coding Fish syntax is **NOT RUN** because `/usr/bin/fish` is absent and the Mise shim is unconfigured; no Fish installation or substitute coding-syntax gate is authorized.
Pure fixtures check one/two/three quote layers and backslash/apostrophe round trips; the approved but unrun host command checks `fish --no-config -n` before helper fetch.

The new [publish-source.ts](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/publish-source.ts) is the coding-only task entry, with a single shrinking **600s** clock and private in-memory origin/rewrite/identity checks using the same cwd/environment and **64 KiB** buffer cap.
Controlled text audit requires an initially empty index, exact allowed helper/evidence/doc roots, regular UTF-8 text <=**4 MiB/file / 16 MiB total**, no binary/cache/home/tmp/node_modules/target payloads; it then stages audit/text and makes one normal commit.
Frozen checks bind the unchanged source-2 **318 source hashes/raw committed blobs** and original **65 native inputs**, rechecking branch/transport before the literal fixed-HTTPS OID push, with lazy fetch disabled and no config setters/hooks bypass/retry.
Only after successful source push and frozen/HEAD checks does it create the literal future `host-command.fish` and `handoff.json`; successful coding status would be **PASS_SOURCE_PUBLISHED_OPERATOR_OUTPUT_PENDING**, never host receive acceptance.
Executor reports strict standalone task-script **TSC PASS** separately from the unchanged source-2 five-typecheck evidence; this docs pass reruns no checker.
The existing handoff directory has **request.json + publish-source.ts only**; `publication.started`, `stage-audit.json`, command captures, `publication.json`, `host-command.fish` and `handoff.json` are **ABSENT**, not generated results.
Parent will publish this approved source once after ordinary review, provide the actual-pushed-OID-pinned command and **stop only awaiting operator receipt/stdout verification**, not repeat the resolved planning/scope choice.

The surviving Fish parent exclusively creates `_work/gpu-owner-recovery/runs/host-input-bootstrap-1` and retains `command.exit`; its worker uses GNU timeout **895s TERM + 5s KILL grace within 900s**, not physical-containment assurance.
Exactly ONE plaintext helper contents GET binds **github.com + actual helper OID + fixed SHA**, **55s TERM + 5s grace**, with **128 KiB post-fetch soft admission**, not a streaming byte quota.
Use existing Bun **1.4.0**, gh, Fish, GNU tar/coreutils and auth only; Mise auto-install false, no install/new login/auth/config change.
Receiver creates separate evidence `_work/gpu-owner-recovery/runs/host-input-receive-1/receipt.json` and fresh `_work/gpu-owner-recovery/cache/host-receive-1/context` under its own workspace.
All approved but unrun host output roots are **ABSENT/uncovered**; the existing handoff directory now has bounded coverage alongside actual source-1/source-2 proofs, without inventing any result file.

The manifest-first and bundle-second asset-ID GETs share **600s**, exact byte/SHA checks and a deadline check after every completion including the last.
Standard GNU tar listing must equal the unique union of **3,939 recorded manifest rows + five literal roots**; one extraction and verification share **180s** inside the outer **900s**.
Verify **3,800 regular hashes / 137 recorded directories / two LLVM links / embedded native65 manifest**, **429,218,730 context bytes**, <=3 GiB; >=8 GiB free and <=8 GiB soft workspace use are not filesystem quotas.
Only the child drops `TAR_OPTIONS`; no global configuration change, replacement tar engine, arbitrary-archive audit or old LLVM pipeline replay follows.
Counters consume attempts before execution; partial writes update captured size/hash per actual retained bytes before later failure, preserving partial records without retry/delete/overwrite.

Executor reports the preselection DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` READY to present the combined decision, adversarial `ses_e3c122320ffdrHp4JsMATl2iN7` all four findings resolved/READY, scoped security `ses_e3cea2a12ffe9TMeXvXBhDE8n7` two MEDIUM fixes accepted; those source reviews were not authority, but the later active request now approves the two bounded operations.
Latest confirmed push remains **`f3e277dbbf33c0aa69172cca1890792656d4cd09`**; stale origin/ahead 1 does not establish new unpushed source or call for a fetch.
Pub3 outcomes/postpublication docs remain local/uncommitted and are intended controlled text in the approved future source commit; none is staged/committed/pushed by this pass.
No installs/auth/config changes, retry/overwrite/delete, new release/assets/uploads, coding payload acquisition/copy/repack, LLVM/Cargo execution, image/native build, GPU or training work is approved; no extraneous template fetch or maintenance publication belongs to this fresh scope.
Source/helper/proof bytes remain frozen; no docs-side source/proposal/receipt changes, commands, network/auth/native/payload operations or agents.
Original **568 Cargo archives / 618 index files / 103 missing archives / zero missing metadata** and `completeOfflineBuildCoverageQualified:false` remain unchanged.
No coding-prefix payload read/copy/refetch/repack/preparation replay, LLVM/Cargo/Docker/native compilation, GPU or training command is authorized; future host receive success would qualify only receipt/extraction, not build or training readiness.
Native65/Rust/model/F64/4,670 coordinates/existing tolerances/exact C12/CPU Flex/masters `101..105`/production recipes remain unchanged; BOTH/reference/orderly-close/R4/telemetry/coexistence stay unqualified, runtime/training entrypoints disabled and trainingReady:false.
ALL security/privacy/isolation hardening remains LAST after ALL planned training completes and results validate; no additional gates.

<a id="current-input-inventory"></a>

#### Inventory snapshots — consumed grants; old root detail-pending fields are historical

Executor freshly selected `Inventory inputs Recommended`; [input-request.json](../_work/gpu-owner-recovery/qualification/input-request.json), the [current readiness section](gpu-readiness.md#current-input-inventory) and [owning diagram](gpu-qualification.puml) separate the two narrow allowances.
The [actual coding receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-input-inventory-1/receipt.json) records **`PASS_METADATA_ONLY`**, `sourceChanged:false`, complete **2,684 entries = 137 directories + 2,545 files + 2 symlinks**, and **one invocation consumed / zero remaining**.
It retained 331,823 metadata bytes before the final summary, 332,260 stdout bytes including that summary and zero stderr bytes; 329,242,172 apparent regular-file bytes sum directory entries, not allocated/deduplicated storage.
The resolved root matches the existing candidate, nested symlink targets were recorded without traversal, and no prefix payload read/hash, LLVM execution/query, compile, copy, staging or automatic selection occurred.
The source uses an exclusive run/worker marker, 20,000-entry / 60-second / 10-MiB grant ceilings and unchanged 4-MiB-per-stream supervision, with 64 KiB reserved inside stdout for its final summary and no duplicate full inventory file.
The request's original authority projection stays unchanged; this coding metadata allowance is SPENT, not replay permission or completed-record review acceptance.

The separate [input-helper source-3 proof](../_work/gpu-owner-recovery/runs/gpu-input-inventory-source-3/receipt.json) records **8 mocked/static tests / 64 assertions**, strict qualification types and direct existing Fish 4.9.3 syntax, all three stages exit 0, `sourceChanged:false`; those checks executed no inventory/host/image/LLVM/build/GPU operation.
Input-helper source-1 remains FAIL at a Mise shim's trust error before Fish parsing; its [classification](../_work/gpu-owner-recovery/runs/gpu-input-inventory-source-1/classification.json) preserves syntax **NOT established**, without rewriting the misleading old counter or trusting/installing anything.
Input-helper source-2's 7/59 PASS is historical before final MEDIUM receipt-write/read/output failure handling and LOW actual-launched-syntax accounting fixes.
The lead reports adversarial `ses_e3db08ecaffe7JpgpwIKHCgyMl` READY after both fixes, security `ses_e3db08ecaffd8jrnYUsS9UQS84` READY within this grant and DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` READY source-only, not completed-metadata post-outcome or host acceptance.
Qualification source-2 below is historical PRE_RUST_BASE at 32/223; qualification source-4 is historical PRE_65_SCHEMA_INPUT at 36/278.
Current publisher source-6 remains source-only; source-5 is closed-second-attempt proof, while transfer-source-3 supplies preparation lineage, not current publisher or actual CPU/GPU qualification.

The new [operator paste](../_work/gpu-owner-recovery/runs/host-builder-inputs-1/operator-paste.txt) and [normalized observation](../_work/gpu-owner-recovery/runs/host-builder-inputs-1/operator-observation.json) record **`OPERATOR_REPORTED_INPUT_METADATA_PASS_AUTHORITY_CONSUMED_DETAILS_PENDING`**, with reported `PASS_INPUT_METADATA_ONLY` and pull/inspection/image/container/cleanup exits all `0`.
The exact reported Rust pin is `4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb`, lock SHA `77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955`, CID `9411a17c3a9f678b625749a6c86668afba5b778d87d6822f67119c674e24f32f`.
**One pull / one container / one cleanup are now CONSUMED, zero remaining, no automatic retry.** The original request, prior coding outcomes and approval/review projections remain byte-unchanged history, not available permission.
The report clears the pinned-image acquisition blocker at its reported scope; the broader host-inputs.json old `ABSENT` and all-false fields remain historical projections, not a current missing-image or pending-pull state.
These two coding-side records normalize pasted output, not original host files; local directory existence does not establish receipt of the operator's phase outputs.
The original root summary's null fields remain unchanged, but the newer concatenated details above now report OS/compiler/libc/C++ path facts; original files and individual stream boundaries remain unestablished, not a new custody gate.
Do not request replay or treat already supplied builder details as still missing.
Prepared inputs are retained and the first STOP stays closed.
Executor resolved the original transport fork through the [distinct HTTPS grant](#current-https-publication), whose second attempt failed at commit.
Executor resolved the later fork through [Inherit Identity Recommended](#current-identity-publication); its source-6-bound third DRAFT publication passed and consumed its grant.
Reported timestamps `1794266630` to `1794266641` span 11 wall seconds, not independent proof of the prescribed 600s pull / 60s combined inspection / 30s cleanup deadlines or physical stop.
Original pre-handoff source `2c17a189ecba08cb7078ea8daf991317d09c3ef1` and later `d3bb6bcc6420f50c559ad7260f968578e20cf725` remain history; latest confirmed push is now `f3e277dbbf33c0aa69172cca1890792656d4cd09`, with actual operator commit unknown and no custody gate.
The [Fish source](../_work/gpu-owner-recovery/qualification/inspect-builder.fish) and prescribed 1 CPU / 1 GiB non-CUDA contract remain unchanged; no compiled ABI/linking, qualification-image build, GPU/training proof or post-record review acceptance follows.
The report authorizes no new installation/acquisition, LLVM query/prefix-payload read, copy/staging, build or host/GPU/training execution; the broad packet is still not a complete runnable acquisition/build/GPU packet.
The report itself grants no operation; original preparation and all three publication attempts are consumed, preserving the second attempt's failed commit invocation and third attempt's successful commit/push.
None of those grants qualifies CUDARC/PTX or authorizes image/native builds, host/GPU work, training or preparation replay.
Do not replay the spent inventory or add assurance gates; ALL hardening stays LAST after ALL planned training completes and results validate, full assurance stays OPEN and `trainingReady:false` stays unchanged.

<a id="current-qualification-source-and-flags"></a>

#### Historical PRE_RUST_BASE source-2 and flags — no current native/GPU or training acceptance

Executor selected `Prepare + query Recommended`; the [new owning diagram](gpu-qualification.puml) and [current readiness section](gpu-readiness.md#current-qualification-source-and-flags) document the separate qualification recipe/runner, persisted tests and [consolidated host input packet](../_work/gpu-owner-recovery/qualification/host-inputs.json).
Both production recipes, existing recipe tests and all six Rust GPU fixtures/mathematics remain unchanged.
The historical [source-2 receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-source-2/receipt.json) records `PASS_SOURCE_ONLY`: **32 tests / 223 assertions plus four typechecks**, five stages exit 0, `failure:null`, `sourceChanged:false`, 277 bound inputs / 64 native entries and manifest SHA-256 `48d4c9705a02d775d6f58a3bce58346e34a8f43e58e604dcdbcd0de5dda72f3b` for its PRE_RUST_BASE generation.
Those static checks ran zero Cargo/LLVM/native-build/image/host/GPU operations; the new LLVM-receipt case reads JSON only and repeats no query.
The [source-1 receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-source-1/receipt.json) remains immutable historical pre-review-fix evidence at 28 tests / 201 assertions, not current source proof.
The HIGH approval-replay fix requires `approval.runId === CLI label` plus exclusive directory creation within retained persistent evidence; the same approval cannot select a different label, and the same existing directory cannot be reused.
This functional one-attempt scope is not hardened cross-container anti-replay or physical custody assurance.
The two MEDIUM fixes retain `STARTED`/attempt data and the command result before stream capture, classify later capture failure as `FAIL_EXECUTION` with available exit code, and turn post-check unreadable/deleted source inputs into changed-source/failure data for a terminal static failure receipt.
Both final recipe stages now restore `_work` ownership after all copies; host receipts record approval SHA, run ID and test-loop limits.
The lead reports final adversarial `ses_e3dde36f7ffe7zUOt5TLO5go8p` READY with all three findings resolved, security `ses_e3dde36f6ffeV2dAqWyTQ89u5u` READY without findings, backend `ses_e3df78573ffeXo04nE7v4wNCrB` without functional findings and DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` READY; all verdicts stay **source-only**.
DevOps's LOW budget ambiguity is resolved by `TEST_LOOP_ONLY_NOT_OVERALL_HOST_INVOCATION`: preflight and final receipt/source work fall outside the loop clock, while `overallHostInvocationMs` remains null and unapproved.
None of this qualifies actual native Cargo artifacts, compiled linking/ABI, image usability, current native CPU regression, GPU behavior or completed-record/hash-integrity acceptance.
The separate [flag-query receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-llvm-flags-1/receipt.json) records `PASS_FLAGS_ONLY`: five exact non-CUDA `llvm-config --link-static` queries, 10 seconds each, first-failure STOP, **five consumed / zero remaining**, no version replay or prefix modification/copy/selection.
Reported C++17/GNU C++11 ABI 1 flags, NVPTX libraries and only `-lrt -ldl -lm` system libraries do not qualify compiled linking/ABI, relocation, C++ runtime or dynamic dependency closure.
Future GPU feasibility runs the score/round-trip and direct backward/SGD/reload pair; separately approved full qualification runs that pair, both 2,335-coordinate sweeps and the two exact C12 fixtures in fixed order.
Future CPU regression checks 16 default-feature harnesses with frozen counts totaling 39 tests; the old CPU39 receipt stays historical pre-prepared evidence, and current-generation CPU/GPU campaigns remain UNRUN.
The historical packet leaves its approvals false and original resource fields unresolved; separately recorded preparation PASS and both consumed publication FAILs do not make it a complete runnable host build/GPU packet.
The distinct [explicit-HTTPS attempt](#current-https-publication) failed at commit; the later [third identity outcome](#current-identity-publication) independently records DRAFT publication PASS/consumed, without per-library approvals, assurance prerequisites or further mutation authority.
No pending operator pull/container/cleanup allowance remains. All previous install/fetch/metadata/version/visibility grants, the five-query batch and coding metadata walk remain consumed; the new transfer request does not renew them.
The [prepared local-6 snapshot](gpu-build.puml) remains evidence for its recorded unchanged inputs, not for the new whole qualification generation.
Canonical init/BOTH/reference/orderly-close, integrated R4, activation/five-master scheduling and accepted functional telemetry/coexistence remain outside qualification; no test pass sets `trainingReady:true`.
ALL security/privacy/isolation hardening remains LAST, after **ALL planned training completes and results validate**; full-assurance Gate0/F9/R4 remain OPEN.
The older runtime/toolchain chronology below retains its original phase-specific evidence and exclusions; the current operator report supersedes old Rust-image absence and pending-pull wording without rewriting historical records.

#### Retained runtime/toolchain chronology — historical phases, renewal-2 consumed

The permission exclusions below retain their capture-time scope.
The later [original transfer request](#current-input-transfer) separately approved bounded acquisition/preparation/publication; preparation and first publication are consumed, not replay or host/build/GPU authority.
The still later [HTTPS attempt](#current-https-publication) also ran once and stopped at commit; missing-input and exclusion statements in this chronology retain their original phase scope, not new replay or repair authority.
The subsequent [third identity outcome](#current-identity-publication) records DRAFT publication PASS and a consumed grant, not replay of this chronology.

The [latest visibility result](gpu-readiness.md#current-cached-visibility-result--renewal-2-consumed-packet-fail) reports a started container process and `/usr/bin/nvidia-smi`, correct RTX 3070 Laptop UUID/driver CSV and 8,192 MiB total / 7,742 MiB free snapshot, then `No devices were found`; query exit 6 makes the complete packet **FAIL**, while cleanup exit 0 is operator-reported only.
Rust inspect 1 reports the expected absent pin without approved pull; Bun inspect 0 reports the exact cached `linux/amd64` pin. Original host files were not received.
Renewal-2 is **CONSUMED: one invocation / one container, zero remaining**; its retained pending bytes are historical, as are the immutable original request, renewal-1, packet and old receipts. **NOT RERUN.**
The last source command's environment-scoped UUID memory-detail query is only the apparent failure step: neither the actual in-container device value nor individual command exits were captured, so attribution is unproved and the cause remains unknown. Do not diagnose a mapping, environment or driver bug.
The first OCI launcher failure remains a distinct historical failure, not a PASS rewritten from the later process startup.

Executor explicitly selected existing LLVM (recommended option 1), and its [one bounded coding-prefix metadata pass](gpu-readiness.md#current-compiler-prefix-inventory) is now **CONSUMED, zero remaining**; it is not a pending route or permission for another inspection.
The [request](../_work/gpu-owner-recovery/gpu-functional-llvm-prefix-inventory-request.json), [metadata](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-prefix-inventory-1/metadata.json) and [stat transcript](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-prefix-inventory-1/stat-transcript.txt) record actual coding-environment metadata-tool returns, normalized rather than original raw streams: 13 fixed stat paths and four directory listings capped at 64 entries/depth 2, with 73 names retained and `lib` truncated at 64.
Four stat-client invocations each had a 10-second deadline plus three-second kill-after; no aggregate hard deadline was enforced.
The prefix, `bin`, `include`, `lib` and `include/llvm` are directories; `bin/llvm-config` is regular, 362,392 bytes, mode `755`; NVPTX CodeGen/Desc/Info and Core/Support `.a` files are positive-size regular files. That metadata phase used no file/archive bytes, symlink targets or LLVM execution; its unchanged flags do not describe the later version phase.
The marker `.tracel-llvm-installed` and `share` returned `ENOENT`, preserving layout stat exit 1; the capture-time `NOT_READY_FOR_CURRENT_RECIPE` status referred to the older marker-requiring recipe, not the later explicit prepared-only mode.
Genuine installation, usable compiler and ELF/link closure remain unverified; no marker content was read or fabricated. The old candidate JSON, metadata records/check and syntax receipt remain immutable historical phases, not current whole-generation source evidence.
Executor then actually selected `Verify version Recommended`, approving one exact coding-prefix `llvm-config --version` with a 10-second client deadline plus three-second kill-after and source-only CubeCL integration review. The [request](../_work/gpu-owner-recovery/gpu-functional-llvm-version-request.json) retains its original pending authority projection, while the [receipt](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-version-1/receipt.json), [stdout](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-version-1/command.stdout) and [empty stderr](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-version-1/command.stderr) record **PASS_VERSION_ONLY: `23.1.0`, exit 0; CONSUMED one invocation, zero remaining** under minimal PATH and `LANG=LC_ALL=C`. A non-CUDA native program ran, but no compilation, prefix modification/copy, marker creation, input selection, host/GPU work or training followed; the grant supplies no retry.
The [source-only review](../_work/gpu-owner-recovery/gpu-functional-llvm-integration-review.json) reports that CubeCL `0.11.3` uses bundler `llvm_path()` and `link()`, the fixed XDG suffix and absent-marker installer path; `LLVM_SYS_231_PREFIX` alone does not redirect this chain. Public bundler `xtask=[]` skips the installer only, leaving native shims/static linking; this source-supported use is not a documented external-prefix API.
The review JSON retains its historical **PROPOSED, NOT APPROVED OR IMPLEMENTED** state unchanged; Executor subsequently selected `Reuse LLVM Recommended` and separately [authorized implementation](../_work/gpu-owner-recovery/gpu-functional-prepared-llvm-implementation-request.json), accepting public `xtask` use outside its primary upstream purpose without calling it a documented external-prefix API.
Current source adds learning's optional host build dependency on exact bundler `23.1.0-4` with `xtask` and policy-io's `gpu-prepared-llvm` forwarding; `Cargo.lock` adds only learning's existing-bundler edge, with no registry/version changes reported. The prepared-only GPU recipe now selects that feature, removes marker admission only for that mode and retains executable-config/version/fixed-XDG/nonempty-libdevice guards; input contract v2 records the mode and bypass with every selection still null.
Both CPU defaults and ordinary `gpu-cuda` declarations remain unchanged; ordinary CUDA retains the upstream installer route. Native shim compilation/static linking remain required and unrun; same-invocation host-feature unification can affect shared consumers, so unchanged ordinary feature declarations are not per-package installer-isolation proof.
[Inference] Inspected Cargo `1.95.0` resolver source supports host-feature activation without a learning `build.rs`; that earlier source review did not establish the actual graph, while local-6 now supplies separate-mode feature-tree evidence, not compiled host-unit coupling. The no-op build-script alternative adds CPU overhead; historical dependency sources were unavailable in that review, and no archives were acquired in that phase. Never substitute a fake marker, `DOCS_RS` or manual `CARGO_FEATURE_XTASK`.
The [current completed graph receipt, local-6](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/receipt.json), records **`PASS_STATIC_AND_FEATURE_TREE_ONLY`** / `graphStatus:PASS_FEATURE_TREE_ONLY`: six static stages exit 0, recipe 9/97 and pure helper 5/12 total 14 cases / 109 assertions plus four typechecks, 277 unchanged inputs with manifest SHA-256 `710a658592d3f7ef89f04a654f0d30213315eb33ba8a0f927c24061db1a01fba`, and `sourcesChangedDuringRun:false`. All three separate actual `Cargo tree --locked --offline` modes passed at exit 0 with `expectedFeatureTextPresent:true`; existing runner logic and the six prepared bridge inputs remain unchanged.
Earlier prepared receipts remain unchanged history: local-1 before pin refinement, local-2 before paired binding, local-3 before pure tests, local-4's preinstallation `UNAVAILABLE_CARGO`, and [local-5 `FAIL_OR_INCOMPLETE_GRAPH`](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-5/receipt.json) at its first reported uncached bundler. Those are not the latest feature-tree result or fresh CPU regression proof.
The lead reports an adversarial MEDIUM missing-binding finding; future graphs now require eligible known Rust `1.95.0` Cargo and same-bin rustc, both `X_OK`, plus exact paired `RUSTC` and pinned-bin PATH prefix in a separate graph environment. Stage receipts record the actual environment passed without mutating root/static environment; pure fixtures cover binding, missing rustc, unversioned/no-Cargo rejection and immutability, not actual toolchain coupling.
At that preinstallation snapshot all five checked Cargo candidates and both paired-rustc checks were unavailable, with zero native queries, `graphEnvironment:null` and `graphs:[]`; these selected-path observations are neither global/permanent absence nor the outcome of the later authorized installation. Unversioned PATH candidates remain diagnostic only, never substitution; the earlier missing repo cache/global Mise symlink report remains historical evidence.
Executor's one scoped `Provision Rust Recommended` grant has completed: the [actual receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/receipt.json) records **`TOOLCHAIN_INSTALLED_OFFLINE_GRAPHS_NOT_VERIFIED`**, eight preflight PASS results, install exit 0 and `sourceChanged:false`; the [outcome](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/outcome.json) records **CONSUMED one install / zero remaining**. The original request remains immutable as its authority projection, not replay permission; no Rust reinstall, helper retry or dependency acquisition follows.
The [source driver](../_work/gpu-owner-recovery/prepared-llvm-mise/provision.ts) uses only existing `prepare`/`environment` and `runBounded`, not the old main or a runner repair. It validates the existing exact two-line Mise config, fresh sole config path/tool and repo rustup/Cargo homes/host, scopes trust to repository Mise state, runs eight preflight commands at 10 seconds each, rereads the config unchanged and permits one `mise install --jobs 1 core:rust` with a 600-second client deadline; exclusive run ID, first failure STOP, no retry/fallback.
Raw [install stderr](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/install/command.stderr) reports five components and `rustc 1.95.0 (59807616e 2026-04-14)` installed for the configured minimal + rustfmt/Clippy setup. Its HOME/euid-mismatch `error:` lines and missing-`cc` warning remain intact despite exit 0; that warning establishes no C compiler prerequisite for this graph check or permission to install one.
After install PASS, local-5 selected the exact available repo Cargo/rustc pair and ran **one** actual `Cargo tree --locked --offline` for prepared mode, target `x86_64-unknown-linux-gnu`, package policy-io; exit 101 and stdout 0 bytes report `no matching package named tracel-llvm-bundler found`, location `crates.io index`. Ordinary-CUDA/CPU graphs did not run after first failure. This is a first reported project-registry cache miss, not absent Cargo, broken LLVM, a complete missing-dependency inventory or native/link/GPU proof; neither Cargo's online-retry advice nor an installer retry was followed.
The [preinstall source receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-source-1/receipt.json) records `PASS_SOURCE_PREINSTALL_ONLY`, 7 mocked cases / 46 assertions plus strict helper types at exit 0, zero Mise/install/download operations in those checks and all 277 prepared-source hashes unchanged. Pre-execution adversarial `ses_e3e4db93fffe3vnYU3U3f7pPFD` accepted source/authority and security `ses_e3e4db930ffeG4ZPzaPQNdpunU` accepted only the new explicit grant, not native qualification; cached payloads remain excluded by the existing repo-cache ignore rule.
Local-6's [prepared stdout](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/graph-prepared/command.stdout) contains `cubecl-llvm v0.11.3`, `tracel-llvm-bundler v23.1.0-4` and bundler `xtask` at line 2429; [ordinary-CUDA stdout](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/graph-ordinary-cuda/command.stdout) passes the same-version/`xtask`-absent predicate, and [CPU stdout](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/graph-cpu/command.stdout) passes the bundler-absent predicate. This is positive actual resolved feature-tree evidence, not compiled host dependency sharing/coupling, static-link/ABI, NVPTX kernel, relocation, native CPU regression, image or GPU/training proof.
The [integrity receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/integrity-check.json) records **`PASS_RECORD_INTEGRITY_ONLY`**, 34 checked streams and 285 source hashes (277 prepared + eight helper inputs), preserving install PASS and graph FAIL. Recorded Mise/local-5 post-outcome adversarial/security acceptance covers these records only, not runtime/graph/build/GPU qualification or further operations; it does not apply to the new cache attempt below.
Executor selected `Fetch cache Recommended`; automatic completion has now arrived for `gpu-prepared-llvm-cache-1`. The [actual cache receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/receipt.json) records **`CACHE_AND_FEATURE_TREES_PASS_NO_COMPILATION`**, `failure:null`, `sourceChanged:false`, 282 bound sources and fetch/offline-verifier exit 0. The [outcome](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/outcome.json) records **CONSUMED one fetch / zero remaining**; the [original request](../_work/gpu-owner-recovery/prepared-llvm-cache/request.json) remains immutable as its authority projection, not replay permission. This docs pass reads completed evidence only and executes nothing.
Frozen `Cargo.lock` remained unchanged at SHA-256 `77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955`: 675 packages = four workspace + 671 checksummed registry package versions at `registry+https://github.com/rust-lang/crates.io-index`, recorded in the [registry manifest](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/registry-manifest.json); no Git/private dependencies, upgrades or lock repair. The outcome reports 568 `Downloaded` name/version messages in [raw fetch stderr](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/fetch/command.stderr), all within the approved manifest, **not** a claim that all 671 entries were downloaded. The limit counts package versions, not HTTP requests/bytes; metadata containing other version records does not select upgrades.
The [helper](../_work/gpu-owner-recovery/prepared-llvm-cache/fetch.ts) clones the exported environment for the fetch only, binds exact repo `RUSTC`/pinned-bin PATH/homes, and sets `CARGO_NET_OFFLINE=false`, `CARGO_NET_RETRY=0`, `CARGO_HTTP_TIMEOUT=30`, sparse protocol and `RUSTUP_AUTO_INSTALL=0`; shared/root/static environment remains unchanged. Fixed exclusive run, first failure STOP, retained partial cache and post-fetch lock/source stability checks on failure-result paths permit no retry, lock removal/repair, toolchain substitution or Mise reinstall.
The one installed repo Rust `1.95.0` `fetch --locked --target x86_64-unknown-linux-gnu` passed under its 600-second client deadline, without reinstalling tools. Its unchanged-input success invoked existing local-6 static checks and **three separate OFFLINE** trees under the 780-second wrapper deadline; pure `graphResultVerified` accepted three PASS trees, exact repo Cargo/rustc and unchanged prepared/helper inputs. This completes the approved cache/tree task, not native compilation or further execution authority.
The [cache integrity receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/integrity-check.json) records **`PASS_RECORD_STREAM_AND_SOURCE_INTEGRITY_ONLY`**: 22 streams, 282 bound fetch-source hashes and 277 prepared-source hashes checked unchanged; no repeated fetch/native query. This is records/streams/source integrity only, not compiled host-unit, native/link/ABI/kernel, image, GPU or CPU-regression qualification.
The [latest prefetch source receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-source-2/receipt.json) is **`PASS_SOURCE_PREFETCH_ONLY`**: [mock tests](../_work/gpu-owner-recovery/prepared-llvm-cache/fetch.test.ts) report 8 cases / 23 assertions, [strict helper types](../_work/gpu-owner-recovery/prepared-llvm-cache/tsconfig.json) exit 0, zero real fetches/downloads in those checks and all 277 prepared hashes unchanged; new helper-folder/source proof remains separate. Cache-source-1 PASS at 6/16 is historical before two MEDIUM failure-reporting fixes/regressions for unreadable bound inputs and missing verifier receipts; no runtime evidence files were edited by those fixes.
Pre-execution adversarial and security READY remain source/grant-scoped. The separate [completed-record review](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/review.json) records post-outcome READY for cache/feature-tree records only, not native-build/GPU qualification or further operations. Normal locked `.crate` download/unpack belonged to the now-consumed fetch grant, not the halted LLVM release-archive pipeline; no per-crate body security-audit gate applies. See [the completed cache boundary](gpu-readiness.md#current-locked-cache-fetch) and [owning diagram](gpu-build.puml).
Exactly six baseline inputs changed: `Cargo.lock`, both Cargo manifests, recipe tests, GPU recipe and input contract. Prior local-3 273-input CPU/F64 evidence is **HISTORICAL PRE-PREPARED GENERATION**, not current whole-generation or CPU-behavior regression proof; earlier metadata/version integrity receipts remain correct for their recorded phases, not fresh current-source validation. No CPU numerical tests or native/e2e compilation ran; compilation is outside the grant and actual GPU tests remain host-only under separate authority.
The [scoped source-review record](../_work/gpu-owner-recovery/gpu-functional-prepared-llvm-source-review.json) records backend and monorepo static acceptance plus DevOps, adversarial and security READY for source/static scope only, not graph/build/operational qualification. Adversarial recheck resolves the MEDIUM binding finding; no new operation or input selection follows.
The lead reports architect `ses_e3eea8cfeffecDxOMiTQwd2chs` accepts read-only input planning from the CSV without another metadata/NVML gauntlet or archived Bun audit; this preserves packet FAIL and later actual functional telemetry/GPU proof.
Actual `crates/gpu-owner/src/telemetry.rs:6–11` uses literal `--id={uuid}` with UUID/driver/total/used/free CSV and strict UUID/driver decoding; the packet's apparent environment-scoped detail failure neither qualifies nor fails this different provider. Selected-path functional telemetry qualification still precedes training, not input planning; cooperative selector/eligibility remains unchanged.
The LLVM candidate remains unselected after bounded metadata and version-only execution; both grants are consumed and authorize no further metadata/native inspection, content read, copy, archive access, download or symlink-target traversal. Prepared LLVM/builder/runtime inputs and CUDA selection remain null, libdevice remains missing/unselected and the GPU image remains unbuilt. The pinned Rust image was absent at the last received inspection, with no approved acquisition/pull.
Both Rust install and locked-cache fetch grants are consumed; no further fetch/retry/download, tool install or acquisition is authorized. Remaining functional work concerns prepared input preparation/selection/staging and actual compiled API/ABI binding, not tooling availability or the historical cache miss; any such operation, compilation, native LLVM, image or host/GPU work needs separate explicit scope, with no automatically approved proposal. All prepared selections/CUDARC remain null, prefix uncopied/unstaged, libdevice missing/unselected and the pinned Rust image historically absent without acquisition authority; F64/all 4,670 coordinates/tolerances/exact C12 and CPU Flex/master `101..105` remain unchanged, with `trainingReady:false`. ALL security/privacy hardening and isolation remain LAST, after completed planned training and validated results.
The metadata record-check and later version integrity-check retain their historical PASS scopes; their then-unchanged 273-input source claims predate the six prepared-mode edits. This docs pass adds no tests/source/code or fresh verification claim and rewrites no earlier evidence.
Defer signature/provenance assurance with ALL security/privacy hardening and isolation until LAST, after completed planned training and validated results; do not revive the old Bun/archive pipeline or add an assurance gauntlet to this functional integration gap.

**HISTORICAL — NOT RERUN:** only the `Selected supported runtime/toolchain` row in the retained table below preserves the pre-attempt inventory generation. Its `PENDING`, launch-unknown and probe-permission wording is superseded by the current replacement above and supplies zero remaining authority; the other dependency rows keep their stated functional scope.

| Dependency | Current evidence | Genuine functional blocker | Required proof | Separate approval |
|---|---|---|---|---|
| Selected supported runtime/toolchain | CPU recipe and Rust source/manifests remain unchanged; optional GPU recipe [local-3 scoped PASS](gpu-readiness.md#current-local-evidence--gpu-functional-local-3-only) is not host proof; the [historical Bun attempt](gpu-readiness.md#historical-bun-only-operator-result--authority-consumed) failed before process/GPU-query start; the [current host-2 report and renewal](gpu-readiness.md#current-cached-visibility-renewal--operator-only-pending) supply all four RPMs `1.20.1-1.x86_64` / package query 0, ctk owner base RPM / exit 0, and all six tools at `/usr/bin` / exit 0; first lookup misses remain historical; see [gpu-build.puml](gpu-build.puml) | Installation history is not supplied; reported shell availability establishes neither physical daemon host, daemon PATH nor successful launch; `default`/Unix-socket context and info exit 0 omit DOCKER overrides, version fields/exit and formatted info values, leaving Engine/default runtime/effective endpoint unknown; no GPU visibility/F64 or selected CUDA/prepared-input proof | Renewal-2 permits the same unchanged cached-Bun metadata attempt with explicit `--runtime=nvidia` plus `--gpus`; fresh Engine/default-runtime facts need not block it because the default runtime is not used; actual launch remains unknown until the attempt; later selected-input build and GPU F64 execution retain phase 3 numerical/C12 requirements; no new prerequisite gauntlet or runc substitution; lead local checks for the three new records/prior-proof integrity are pending, not PASS; six lookup inputs / 273 functional source hashes remain unchanged, requiring no new CPU test | Parent explicitly offered three routes and Executor selected `One visibility probe`; [renewal-2](../_work/gpu-owner-recovery/gpu-container-visibility-renewal-2.json) is **PENDING, not executed**: operator-only, one fresh invocation / at most one container, zero pulls, unchanged exact Bun pin/UUID/packet/resource caps/deadlines/fresh-CID cleanup, no retry; first pull/probe grant stays **CONSUMED, zero remaining** and old request/renewal/receipts stay unchanged; no substitution, install, configuration/restart, build, archives, native/CUDA kernel, training, full-pipeline renewal or agent host/GPU calls; existing host-checkout Fish file needs no new Git pull/publication |
| Functional GPU training activation | `tooling/runtime/Dockerfile.gpu:49` retains `job.ts`; `packages/runtime/src/job.ts:11` permits only `native-proof`; `packages/runtime/src/gpu-job.ts:142` and `crates/gpu-owner/src/main.rs:10` retain `SOURCE_ONLY_DISABLED` normal mains | The prepared recipe still does not enable or connect operational GPU training; this known activation gap is functional work, not deferred security hardening or a new input-planning gate | After selected-host GPU capability proof, separately implement and verify approved activation/wiring through ordinary source/test/readiness checks; preserve numerical/model contracts and keep capability distinct from training enablement | Rust installation, locked fetch and three separate local-6 feature trees passed; this is not activation/build/GPU/training approval, and all install/fetch/visibility/metadata/version authority is consumed |
| Bun on that functional path | The private quarantine Bun audit aborted; cause remains `UNDETERMINED`; diagnostics remain 0/3 with no accepted binding | The abort is a functional blocker only if the chosen path depends on the failing behavior; its relevance remains unresolved | Determine that dependency and prove required startup/work on the selected supported path; do not require completing the old isolated diagnostic pipeline by default | A fresh explicit scope decision before any diagnostic, alternative runtime operation or replay; existing blocked requests do not suffice |
| Canonical game/reference and integrated R4 | Retained source/synthetic receipts do not supply actual selected-path integrated proof | Missing actual functional init/BOTH/reference/close and game/model/economic evidence | Phase 2 proof and existing functional negatives, without adding new privacy/isolation assurance | Separate exact runtime/reference verification grant |
| F64 GPU and C12 learner path | Recorded CPU evidence covers 4,670 coordinates; actual GPU F64/C12 remains unqualified | Missing real required GPU computation, numerical agreement and update/reload evidence | Phase 3 actual F64 scoring/backward/SGD/reload and exact C12 digest comparison | Separate bounded actual-GPU verification grant; no CPU or reduced-precision fallback |
| Bounded execution, coexistence and ordinary outputs | Host uses the reported GPU; the [received operator snapshot](gpu-readiness.md#current-host-observations--received-operator-reported-metadata-only) reports an RTX 3070 Laptop GPU with 8,192 MiB total / 7,742 MiB free, not a reservation or fit qualification; actual admitted target and state/output locations remain unresolved | Insufficient capacity, unsupported ordinary limits or failure to produce/reload the required functional outputs | Selected-path resource/VRAM fit, ordinary bounded job controls and truthful output/checkpoint receipts | Exact resource, target and output scope before execution; no new cgroup/custody proof prerequisite |

Accept the bounded inventory's proof requirements explicitly before using it as the functional readiness checklist.
Freeze those accepted functional gates to prevent scope ratcheting.
Route every newly identified security/privacy/isolation requirement to LAST, even when a review rates it HIGH; retain its finding, severity and deferred disposition rather than fabricating a fix or PASS.
Reopen the functional inventory only for a demonstrated training-critical correctness or supported-path feasibility blocker, with its evidence, minimal proof and explicit approval recorded.
Do not disguise a deferred assurance requirement as a functional dependency.

### Retained correctness and operational limits

Game/model correctness remains pretraining work; new privacy/security hardening does not.
Keep genuine recipient-authorized facts, hidden-fact exclusion, history/lineage, economic accounting, existing privacy-twin/noninterference tests, deterministic replay and game eligibility unchanged.
Do not remove or relabel existing functional tests, alter model inputs or expose hidden facts by calling that a privacy deferral.
Keep the model/objective, master seeds `101..105`, initialization, RNG/curriculum, sampling, baselines, checkpoint binding/reload, reward/failure classification and retained experiment contracts unchanged.
Infrastructure, timeout or failed-output episodes cannot become learned rewards.

Keep ordinary bounded-resource execution, original clocks/deadlines, bounded cleanup and honest failure reporting.
Retain C2 job ceilings, aggregate 24,000,000,000-byte RAM / 12-thread ceilings, output bounds and the final three-second cleanup reserve; do not renew clocks or retry automatically.
Preserve GPU cooperative admission/operational ceilings and coexistence with the host's reported in-use 8 GB GPU; a free-VRAM sample is neither a reservation nor guaranteed availability.
Keep the GPU attached to its host driver; CPU fallback and actual GPU work inside the coding sandbox remain excluded.
Ordinary output/receipt evidence must identify the work, result and failure scope truthfully; end-to-end hardened capture is not a pretraining dependency.
Require genuine successful close/EOF/reap for the functional positive; do not substitute forced removal or claim unconditional physical termination.

Defer strict physical-stop guarantees, escaped-group and dual-crash proof, native bridge/pidfd/cgroup/service/helper implementation, bwrap/namespace qualification, hardened read-only closures, anti-race/custody proofs, private custody storage, provenance-assurance qualification and runtime-domain security acceptance to LAST.
No new isolation or hardened capture/storage mechanism becomes a covert pretraining gate.
This roadmap does not remove or disable any existing configuration, safeguard or source path.

### Reviews, observed status and authority

AGENTS.md implementation reviews remain process requirements after feasible authorized verification.
Scope applicable reviews to functional correctness, the frozen supported-path gates and an explicit deferred assurance backlog; review participation does not require security hardening first.
Executor's latest instruction already supplies the policy decision to defer security/privacy/isolation-hardening findings until LAST.
Keep such findings open/deferred with their original severity; do not claim reviewer acceptance, clear an old HIGH, or reopen the same policy-deferral question merely because it is HIGH.
A genuine functional-correctness finding still requires resolution or its own explicit human decision.

Observed status remains **0/3 diagnostic cases, no accepted diagnostic binding, full pipeline halted, `trainingReady:false`**.
Only future explicitly accepted functional proof can change the observed readiness result; this plan cannot set that flag.
The unspent diagnostic allowance does not authorize invoking the existing blocked pipeline.
The full LLVM/archive request remains halted; no execution grant is renewed or inferred.
This amendment authorizes no source/tooling/request/receipt changes, archive acquisition/capture/replay, downloads, runtime upgrades, helper compilation, credentials, host/GPU inspection, process launch, native load, test, render, training or publication.
Any future implementation or operation needs its own applicable explicit scope and execution approval.

## Retained full-assurance contract — historical sequencing, not pretraining gates

All original text below remains intact for traceability.
Its historical grants, findings, gate matrices and proposed ordering do not override the current amendment or renew authority.

## Status and authority

Gate0 is OPEN.
F9 is OPEN.
R4 is OPEN.
`trainingReady:false` remains in force.

This matrix records retained obligations, explicit rebuild decisions and unresolved contract changes.
It does not accept its own proposal or authorize execution.
Historical contracts and evidence remain unchanged in the reference worktree at `b4b241481fb12de4a7344e6dba8eda775af57675`.
No historical gate result or operational grant transfers to this branch.

The current development grant covers bounded Rust/Cargo/Bun implementation, synthetic tests and static analysis.
Game-data collection, training, production host operations and deployment remain unauthorized.
Executor separately approved commit/publication of the current 19-file admission/GPU phase and its exact one-shot operator-run metadata packet; no broader publication or host operation follows.
The one-container synthetic Docker grant is consumed.
AGENTS.md requires adversarial review after implementation and feasible verification, before completion.
This runtime/permissions slice also requires security review; resolve BLOCKER/HIGH findings before completion or obtain the human decision required by AGENTS.md.

## Historical acceptance sources

The following paths are relative to `/home/gu1lty/Projects/proveo/chess-coach/`.

| Source | Governing scope |
|---|---|
| `_spec/_plans/native-ingress-rust-first-full-plan-packet.md`, §8, especially lines 583–604 | Gate0 design/prerequisite acceptance; separate capture, build, runtime qualification and Native proof |
| `_spec/_plans/native-ingress-gate0-checker.md`, §§2,4–6 | 36-record inventory; mechanical readiness never grants acceptance; finalization remains unapproved |
| `_spec/_plans/native-ingress-authority.md`, N1–N10 | Accepted historical F9 mapping; native-only proof, confinement, handoff, opening, lifecycle and negatives |
| `_spec/_plans/ml-adjutant-r4-economic-amendment.md`, §§3–12 | Historical economic model, features, binding and verification |
| `_spec/_plans/ml-adjutant-r4-economic-corrective-annex.md`, A1–A7 | Historical schema, independent expectations, economic/spatial calculus and statistical acceptance |
| `_spec/_plans/ml-adjutant-r4-owned-ingress-addendum.md`, O2–O10 | Historical owned ingress, permits, handoff, accounting and combined authority |
| `_spec/_plans/ml-adjutant-r4-weights.md`, §§3–9 | Candidate coverage, lineage, knowledge, objective, frozen inference and persistent validation |
| `_spec/_plans/PLAN-ml-adjutant.md`, lines 538–588 | R4 implementation versus R5 readiness, R6 training, R7 artifact and R8 challenge |

## Explicitly approved replacements

These rows record existing decisions, not newly inferred waivers.

| Historical implementation | Approved current implementation | Retained acceptance obligation |
|---|---|---|
| Bespoke DIRECT scalar meter, tariffs and prepaid ownership bootstrap | Shared standard OS CPU/memory/task envelope | BOTH-seat aggregate coverage; original S0+10s / S0+300s; final 3s cleanup; no reset after failure; real enforcement evidence |
| Custom compiler/linker/bootstrap/kernel infrastructure | Standard Cargo/Burn and supported runtime controls | Independent selected inputs, reproducible recipe, selected dependency/native closure and actual execution verification |
| V2 observation wire, Float64Hex and bespoke codecs | Versioned Zod/JSON Schema and standard JSON/Serde | Bounded validated data, recipient isolation, sequence/replay integrity and no schema-as-authority claim |
| 7,501-state estimator and old 418 feature meanings | `chess-coach.features.v1`, 2,271 coordinates | Genuine authorized facts, explicit unknown/memory channels, economic conservation, no hidden inputs or invented calibrated estimates |
| Historical linear scorer/checkpoint | Burn Linear(2271,32) → ReLU → Linear(32,1), native record | F64; state-dependent preferences; exact configuration/layout/checkpoint binding; incompatible artifacts fail |
| Eight-lane/family quotas and 2,048 attempted extensions | `chess-coach.enumeration.v1`, depth-cyclic FIFO / round-robin, 4,096 attempts | Pass; four actions maximum; 512 candidates maximum; recipient-only pruning; documented bounded coverage |
| Old provenance companion/frame wire and bespoke ownership machinery | Typed TypeScript/Zod causal journal | Stable identities, actual mutation causes, action references, deployment dispositions and causal recipient visibility |

The removed estimator's 24,000-group fitting, temperature calibration and probability-coverage calculations cannot verify the new representation.
Do not fabricate replacement probability outputs or report those historical checks as passed.
The gate-profile decision below must make this supersession explicit before current R4 closure.
Actual rule-level promotion/origin behavior remains required even though the old promotion-feature formulas are replaced.

## Accepted decision C1: amended current-branch profile

Executor selected `Rebaseline (Recommended)` in the interactive gate-profile question.
Proposal A below now governs current-branch Gate0/F9/R4 closure.
Alternatives B and C remain unselected reference.
Historical exact-contract results remain unchanged.
This choice accepts the stated supersessions and trust premise, not the unfinished implementation packet, concrete resource limits, any gate result or an operational grant.

Replacing DIRECT or the feature layout does not establish a replacement for every historical F9 trust requirement.
The original requirements include protected opened-object → actual exec/loading custody, actual daemon-used init identity, creator A before PID-derived `/proc`, separate B, Rust-only authority types, both main/reference process identities, and each independent FD0/1/2 route.
Current source implements none of that full qualification.

### Proposal A: explicitly rebaseline the current profile

Use Gate0/F9/R4 for the explicitly amended current-branch profile.
Keep historical exact-contract results OPEN rather than retroactively marking them passed.
Accept the selected supported runtime, host kernel, manager and operator-controlled immutable artifact store as trusted infrastructure.
Exclude a malicious host/daemon/administrator or hostile mutation of that infrastructure from the claim.
Do not claim kernel-witness or same-opened-object attestation.

Freeze an independent source/test/lockfile/build/runtime/reference expectation set before execution claims.
Replace prior-branch F8 publication and legacy named-auditor prerequisites with an independently registered current source snapshot and current selected-closure/partition/static audits.
Apply the active AGENTS.md review gates before implementation completion; do not defer reviews until training readiness.
Local gate closure does not require or authorize Git publication.
Build a read-only, offline runtime from the selected captured closure.
Fix the output-registration method before build; register actual artifacts after build and before qualification.
Use a pinned image-contained init with supported process supervision, rather than asserting identity of an unmeasured daemon-injected init.
Define exact policy controls without weakening nonroot, network, mount, namespace or capability restrictions by implication.

Replace creator A/B, kernel G1 consume and imported-FD custody with supported-runtime process creation, owned process handles and supervisor-created pipes.
Verify main/reference separation, inherited stdio endpoints, isolation, process death and complete reap under that declared trust premise.
Keep independent source-bound reference execution and comparison.
Select the reference from the frozen canonical rules snapshot, not the main worker's claimed output or a second invocation of the new resolver.
Pin the reference adapter and its dependency closure independently.
Hashes/manifests alone remain insufficient evidence of actual selected runtime behavior.
Keep all data/session/recipient/sequence/close/EOF/deadline negatives.

Replace ownership-registry/visitor mechanics with bounded serialized recipient batches and a private transactional coordinator.
Preserve independent expectations, no model-selected paths/entrypoints, genuine session/boundary/candidate binding, no partial BOTH-seat commit and no post-close use.
Replace old F1 implementation/wire identity with one current recipient-ledger pair initialized once and advanced from the actual ordered boundaries, with independent economic comparison and no replayed facts or reset.
This proposal changes mechanism-specific guarantees and records that change explicitly.
It does not claim equivalent kernel-level assurance.

The same rebaseline explicitly removes estimator-only R4 calibration/spatial-feature requirements and retains rule correctness, lineage, paid accounting, witnessed losses, noninterference, version binding and numerical validation for the approved new model.
It replaces the old Rust-only host/Node topology with the approved TypeScript game/policy and Rust Burn split.

### Alternative B: retain exact historical F9

Keep protected-backing custody, creator A/B, actual daemon init, Rust-only host controls and original FD proof strength.
The current supported-runtime design does not supply a qualified implementation of those mechanisms.
Require a separately accepted design and explicit scope/privilege approvals before implementing them.
Do not silently revive archived kernel/bootstrap machinery.

### Alternative C: name separate successor gates

Keep historical Gate0/F9/R4 OPEN.
Apply proposal A only to separately named `runtime-plan-v1`, `native-proof-v1` and `policy-pipeline-v1` gates.
Do not describe successor success as historical-gate closure.

The actual interactive selection, not this document's self-declaration, supplies the C1 decision.

## Gate0 closure matrix

Current design decisions C8–C14 are recorded in [supervision.md](supervision.md), [runtime-output-limits.md](runtime-output-limits.md), [learning-runtime.md](learning-runtime.md), [checkpoint-runtime.md](checkpoint-runtime.md), [state-persistence.md](state-persistence.md) and [reference-bundles.md](reference-bundles.md).
The final input/output-registration method and deliberately unset host bindings are in [gate0-packet.md](gate0-packet.md).
Executor selected host-executed mise for preflight/seeding/provisioning and initially selected sbx for training execution; see [host-entrypoint.md](host-entrypoint.md).
Executor then made real F64 GPU learning mandatory, reported an in-use GPU, selected host-backed state and amended learning execution to a supported shared-GPU host Docker job.
No VFIO rebind, GPU runtime installation, creation, qualification or training authority follows from that design choice.
C16/C17 remain consumed sbx-local receipts, not actual host bindings or capacity limits.
The metadata-only task and tighter fixed-write storage bound do not close a gate or grant an operation.
The admission/GPU phase's earlier 74-test Python suite includes 16 admission tests for bounded metadata collection and synthetic CLI behavior, not GPU implementation or computation.
Its current source/static/synthetic evidence is indexed in [verification.md](verification.md).
Executor selected `Commit + push (Recommended)` for this 19-file phase and the exact delegated one-shot host facts packet.
Executor returned `PASS_METADATA_ONLY` admission facts; [host-entrypoint.md](host-entrypoint.md#received-observations-and-provenance-boundary) records reported identities and [verification.md](verification.md#operator-reported-admission-evidence) preserves the unknown source/invocation/time provenance.
The Python CLI proposal is superseded and removed; the [Rust fixed-API v2 collector](host-runtime-inventory-request.md) has accepted Rust/handoff-source reviews, a locally frozen/inspected static asset, release-musl 72 tests and passing prebuilt-task/configuration checks, while actual-host registration and all publication/transfer/query grants remain pending.
No design selection grants an operation or accepts the packet.

The original 36 IDs remain a traceability inventory, not a requirement to recreate the old checker or build DAG.
All current acceptance rows remain OPEN.

| Historical records | Current closure artifact / acceptance | Current gap |
|---|---|---|
| `PLAN`, `VERIFICATION` | Exact current file/API/test plan, gate-profile decision and Executor acceptance | [runtime-plan.md](runtime-plan.md) assigns the draft APIs/tests; its acceptance checklist remains open |
| `INPUTS`, `RECIPE`, `OUTPUT_METHOD` | Independently expected source/tests/locks/reference; pinned supported build recipe; pre-build output-registration method | Exact selected capture, recipe and independent registration roles remain unset |
| `UNITS`, `U-ROOT`, `U-RESOLVE` | Selected Cargo + TypeScript resolution inventory and host/model partition | Current development inventories include native, policy, whole-match, selected old source and control-plane imports; final captured/bundled/runtime closure remains unregistered |
| `PRODUCERS`, `U-PRODUCER`, `U-QUERY`, `U-GENERATED`, `U-MACRO`, `U-METADATA`, `U-LINK`, `U-NATIVE` | Standard Cargo/compiler evidence for selected producers, generated outputs and native dependencies | Lockfile membership alone does not establish the selected graph |
| `TRUST`, `G1`, `CREATOR.A`, `INIT.B` | Explicit C1 trust/guarantee decision and exact runtime/init/launcher controls | C1 accepted; exact selected runtime/init/launcher packet remains open |
| `NODE.MAIN`, `NODE.REFERENCE`, `FD.MAIN.0/1/2`, `FD.REFERENCE.0/1/2` | Exact main/reference topology and independent owned I/O plan under selected profile | Fixed workers/job, staged coordinator, bounded JSONL and owned pipes implemented; captured/qualified runtime remains absent |
| `S0`, `FIRST_EFFECT`, `INVOICE` | Original deadline origin before launch-causal work; shared resource admission before game work; no renewed budget | Outside standard supervisor, boot barrier and C8 observer pass fake fixtures; actual admitted runtime and enforcement qualification remain absent |
| `FIT`, `U-BOUNDS`, `U-ENFORCE` | Concrete CPU/memory/swap/tasks/tmp/output/storage/FD bounds; selected GPU/VRAM coexistence; peak coexistence and whole-job cleanup design | C2/C9/C15 retain the design ceilings; fixed writes plus outside evidence and 8 GiB planning allowance total 191,396,683,776 usable bytes; actual host Docker/GPU runtime, IDs, view, durable target/headroom and effective enforcement remain open |
| `U-HANDOFF` | Versioned recipient/session/sequence transactional protocol and independent reference comparison | Actual-mutation producer/journal/recipients and staged BOTH protocol implemented; reference init/open/pass fixtures pass; cold confined independent process proof remains unrun |
| `AUDITS` | Current source/dependency/native-closure, partition and negative audit results | Historical passes do not transfer; active AGENTS.md adversarial/security review gates apply before completion |

Gate0 closes on explicit acceptance of the complete selected-profile design and prerequisites.
It does not require runtime results before their separately approved launch.
It does not itself authorize capture, image building, runtime qualification or native proof.
Existing development approval remains separate from that future operational sequence.

## F9 closure matrix

| Historical scope | Required current evidence | Current state |
|---|---|---|
| N1/N2 native-only scope | Native verification cannot score, sample, prepare model episodes or train; private/recipient partition tests | Fixed native-only job/worker source and standard Bun closure checks exclude policy/scoring/learning dispatch; captured/live qualification remains open |
| N3/N4 expectations/loading | Current selected graph, capture, actual runtime/loading confinement, exact policy/init and effective controls under accepted C1 | C1 accepted; no production qualification |
| N5/N7 handoff/lifecycle | Genuine session and boundary bindings; wrong side/session/cursor/replay/reentry/close refusal; atomic BOTH commit | Staged runtime cursors, reentry/close and BOTH publication after both ACKs pass synthetic tests; real confined lifecycle remains pending |
| N6 canonical opening | Actual native init: banks 3/3; CC e1/e8; Marines c2–f2/c7–f7; endowed paid basis 0; no initial grant; combat replacement 4 per side | Canonical constructor and both initial recipient producers pass source tests; cold F9 process proof remains unrun |
| N6 causal laws | Final geometric cells versus transient assertions; casualty-before-delta order; mine multiplicity; stable recipient lineage; native origin/promotion rules; private labels excluded | Canonical B/C/F physics, journal/producer privacy, explicit bank/receipt ownership and source replay have persisted tests; supervised native/reference evidence remains pending |
| N8 positive proof | Cold source-bound init for BOTH; actual turn-open + pass/pass settlement; independently launched reference reconstruction/comparison; one recipient pair initialized once and advanced from actual ordered boundaries; clean close/EOF/reap | Not run; synthetic observations and forced Docker removal cannot substitute |
| N8 time/resources | Same original S0 through cold 10s proof and 300s lifecycle, final 3s cleanup; aggregate main/reference/children limits; bounded outputs/storage | Partial synthetic limit proof only; deadline-triggered cleanup and kernel disappearance unverified |
| N9 negative proof | Substituted inputs/runtime/init/entrypoint; worker-selected expectations; mutable/unsupported loading; stale contexts; reordered/tampered boundaries; post-close use; model dispatch; incomplete cleanup | Artifact/protocol/stdio/policy/closure/job/fake-manager negatives exist; selected-image/effective-host negative qualification remains absent |
| N10 operations | Fresh exact capture/build/qualification/native-proof grants and retained failure evidence | No grant supplied by this matrix |

F9 closes only after actual selected-profile runtime qualification and positive/negative native evidence pass.
A forced-removal cleanup negative cannot supply the genuine clean-close positive.
F9 grants no model or training permission.

## R4 closure matrix

| Retained obligation | Existing foundation | Missing closure evidence |
|---|---|---|
| Canonical game/causal source | Rules, queue edits, collision fingerprints, 122,160 classical cases, 11,045 full-turn cases and matching actual-mutation sink outcomes | Independent supervised source-bound reference/protocol comparison |
| Recipient-local history | Actual continuing init/open/settled data, local IDs, standard closed batches, privacy twins and deterministic source-bound replay | Runtime-owned sessions/cursors, genuine process-close boundary and supervised independent comparison |
| Own paid accounting | Explicit bank owner, actual accepted debits and capped grants, receipt dispositions, promotion/crush/mine retirement and paid conservation tests | Native/runtime transaction ownership, adversarial protocol/replay audit and independent comparison |
| Opponent knowledge | Actual pre-destruction witnesses and target-only consumption, deduplication, casualty-memory/dead-vision tests and private paid-history separation | Supervised producer/reference and protocol-substitution evidence |
| Candidate/context scoring | Approved enumerator/encoding, hidden twins, frozen argmax/ties, exact sampling/ACK/admission and checked whole-match barriers | Actual captured immutable runtime, effective bounds and qualified native/learner integration |
| Independent artifact binding | Model config, feature version/layout/dimensions and exact checkpoint SHA-256 | Supervisor-selected expectations through the real coordinator; session/model/version substitution and stale-episode rejection |
| Numerical validation | C6/C7, redundant logical-F64 proposals/reload and real synthetic whole-match/Burn/SQL completion pass | Actual selected GPU F64 scoring/learning, unchanged numerical checks and redundant learner agreement; GPU runtime/VRAM/cleanup and final artifact qualification remain open |
| Phase/atomicity controls | Closed child-owned match loop, owner native/decision/stop reconstruction, C12 learners, retained private journal bytes, atomic C11 completion and C13 source publisher | Actual durable state/clock/process-group/descendant qualification; complete final-envelope/initialization path qualification remains open |

R4 is implementation closure for the accepted current profile, not successful game-data training.
The original R5 cross-cutting readiness checks remain a separate verification stage.
Any change to retained validation tolerances, training experiment, reward/eligibility, RNG/curriculum, checkpoint protocol or strict challenge requires its own explicit decision.
The model replacement does not silently waive those downstream contracts.

## Critical path and proposed file plan

Unimplemented paths in this table remain PROPOSED.
Canonical initialization and initial recipient production now exist; their persisted tests are indexed in [verification.md](verification.md).
Persisted synthetic resolver fixtures do not authorize collection or a gameplay rollout.

| Order | Deliverable | Source / test targets | Exit condition / boundary |
|---:|---|---|---|
| 1 | Select current versus exact versus separately named gates | This document; [gate-closure.puml](gate-closure.puml) | COMPLETE: Executor selected proposal A; no host execution |
| 2 | Full implementation/runtime packet | [runtime-plan.md](runtime-plan.md); `_spec/native-job.md`; actual source/API inventory | Draft persisted; exact identities/closure/limits/registration and Executor Gate0 acceptance remain open |
| 3 | Canonical init and complete simultaneous mutations | `packages/game-core/src/initialization.ts`, `classical-resolution.ts`, `resolve.ts`, `causal-events.ts`, `causal-producer.ts`; persisted initialization/classical/turn/causal tests | Source fixtures pass canonical physics and actual-mutation identity/visibility integration; independent runtime evidence remains separate |
| 4 | Trusted recipients, economics and replay | Implemented `packages/contracts/src/recipient.ts`, `recipient-codec.ts`, `game-session.ts`; persisted privacy, codec, bank/session/replay and policy-noninterference tests | Source fixtures pass BOTH conservation, causal knowledge, deterministic replay and twins; runtime-owned protocol remains pending |
| 5 | Native proof coordinator and reference worker | Implemented `native-session.ts`, `reference-driver.ts`, `reference-worker.ts`, `current-driver.ts`, `process-transport.ts`; protocol/process/reference/closure fixtures | Synthetic checks and pinned in-process reference fingerprints pass; live confined proof remains unrun |
| 6 | Supported supervisor and frozen artifact selection | Implemented outside supervisor/evidence writer, native job and artifact guards; C13 state-mount checker; fake-manager/job/artifact fixtures | Actual CPU IDs/cgroup/observation view, private storage, outside admission and Gate0 acceptance remain open |
| 7 | Capture/build → output registration → live qualification → native proof | Exact separately approved commands and private append-only evidence paths from order 2 | Actual limits/loading/init/stdio/deadline/cleanup negatives and cold BOTH positive; close F9 only after pass |
| 8 | Bind genuine observations and immutable model to policy/admission | Whole-match worker/session, fixed dependency factory, two native learners, private publisher and SQLite coordinator | Actual separate-process synthetic completion/update/retained-journal/SQL integration passes; no actual corpus/strategic rollout, durable target or confined qualification |
| 9 | Cross-cutting technical readiness | `_spec/verification.md` plus persisted current tests/e2e/static evidence | Current R5-equivalent verification; `trainingReady` changes only on evidence; each implementation slice already requires applicable AGENTS.md reviews |

Independent source tasks may proceed under the development grant after applicable contract decisions.
The linked gate-closure diagram now applies active AGENTS adversarial and security review gates.
Those gates apply to each implementation slice before completion, not only at the final readiness stage shown in the diagram; [verification.md](verification.md#blocked-docker-metadata-proposal-python-verification) retains its render receipt alongside the superseded Python verification and failed review.
Do not turn this sequence into a prohibition on already approved synthetic development.
Do not run a canonical live game or reference rollout merely because its source tests exist.

## Fresh execution packet required later

Before requesting host execution, supply the exact command/allowlist, source/build/runtime identities, reference identity, CPU quota/period, memory/swap/tasks, tmp/output/storage/FD ceilings, owned resources, allowed side effects, absolute deadlines, cleanup/absence verification and stop-without-retry behavior.
Keep runtime qualification separate from the native-game proof.
Declare whether any required kernel-level cleanup observation needs additional host access.
Do not assume the BusyBox limits, historical 2 CPU / 4 GiB / 256 PID profile, or synthetic removal evidence establishes the current production envelope.

## Non-goals for these three gates

Product/UI migration, optional H≤3 search, estimator-only fitting, actual policy training, the five-run experiment, learned 54/54 wins, deployment and publication do not become prerequisites merely because they appear later in the historical roadmap.
Training still requires its own downstream readiness and execution approval.
Never label a foundation slice `Gate0 CLOSED`, `F9 CLOSED`, `R4 CLOSED` or `trainingReady:true`.
