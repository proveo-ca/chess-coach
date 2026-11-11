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

<a id="current-host-build-inventory"></a>

#### CURRENT 2026-11-11 — HOST2 reported native-build PASS/consumed; GPU feasibility preparation pending

The [current readiness status](gpu-readiness.md#current-host-build-inventory) and [owning receive diagram](gpu-host-receive.puml) accept the full receive-2 report as **PASS_HOST_RECEIVE_AND_EXTRACT_ONLY**, all three reported exits **0**, and operator allowance **1/1 CONSUMED / zero remaining / no retries**.
The [scoped record check](../_work/gpu-owner-recovery/runs/host-input-receive-observation-2/record-check.json) retains **exact missing-list match FALSE**: reported **ntapi@0.3.1** versus prepared **ntapi@0.4.3**, one differing entry among **103 missing archives**, zero missing metadata; the initial checker FAIL remains immutable.
Original host files/actual command bytes and host artefact hashes remain independently unverified, not a custody gate; the unknown discrepancy cause establishes neither corrupt assets nor reacquisition authority and does not block read-only metadata.
The [HOST inventory-1 observation](../_work/gpu-owner-recovery/runs/host-build-inventory-observation-1/observation.json) reports **FAIL_METADATA_ONLY / QUERY_NONZERO:selected-builder / query exits [0,0,125] / outer exit 1**, consuming HOST1 **1/1 / zero remaining / no retry**.
The [record-only check](../_work/gpu-owner-recovery/runs/host-build-inventory-observation-1/record-check.json) preserves that FAIL, not metadata PASS; third-query stderr is reported **118 bytes / efc09f33…**, text/original HOST files unreceived and exact diagnostic unknown. Official-reference source analysis establishes unsupported `buildx inspect --format`, not a specific HOST message, missing Buildx or installation need.
The [inventory-2 observation](../_work/gpu-owner-recovery/runs/host-build-inventory-observation-2/observation.json) accepts **PASS_METADATA_ONLY/eight query exits 0/HOST_BUILD_INVENTORY_EXIT=0**, grant **1/1 CONSUMED / zero remaining / no retry**. Provenance is **SEMANTICALLY_NORMALIZED_COMPLETE_OPERATOR_JSON_AND_SUMMARY_NOT_ORIGINAL_HOST_BYTES**, not a raw original-stream copy; [record-only PASS](../_work/gpu-owner-recovery/runs/host-build-inventory-observation-2/record-check.json) accepts **16 capture metadata rows**, not original-file bytes/actual command identity.
Shared **proveo-multiarch/docker-container/proveo-multiarch0 running**, CID **672c2d1a…**, reports all five CPU/memory cap fields **0**, bridge/empty cgroup parent. Keep the shared worker untouched; metadata authorizes neither finite-bound claims nor reconfiguration/stop. Engine/image/memory/disk snapshots in [current readiness](gpu-readiness.md#current-host-build-inventory) establish no BuildKit-store or compiler/interpreter usability; do not infer corrupt images or add a custody gate.
Executor reports completed publication **25bcfb61ddde6849d10e61536266b5e2f50c5598**, corrected source/cache-reuse **428-entry packet /8 bounded relative SOURCE-fixture links**, working tree clean afterward. Its **ONE normal commit/push grant stays CONSUMED**. The separate [current publication request](#current-gpu-feasibility) now approves **one ordinary commit +one fixed HTTPS push, PENDING**, not renewed old authority or publication success. Current work remains **LOCAL_UNCOMMITTED**, no new OID/success claimed. Prior65feb/435/425 publications/precommit audits keep their historical scopes; helper9874941/assetsf3e277d/frozen307 source proof remain unchanged. The known whole-index whitespace **FAIL /one preserved RAW red stderr source excerpt** remains true; scoped source/spec PASS is not whole-index PASS.

<a id="current-host-native-build"></a>

#### OPERATOR_REPORTED_PASS_NATIVE_BUILD_ONLY_CONSUMED — separate GPU feasibility grant issued/unobserved

The [HOST2 receipt](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/reported-receipt.json), [summary](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/operator-summary.txt) and [observation](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/observation.json) report **PASS_HOST_GPU_NATIVE_BUILD_ONLY /failure:null +PASS_NATIVE_COMPILATION_ONLY /HOST_NATIVE_BUILD_EXIT=0**. Accept functional native-build-only PASS; **HOST2 CONSUMED1/1 /remaining0 /no retry**. Original HOST bytes/logs/binaries remain unreceived, hashes reported rather than independently rehashed; no custody gauntlet follows. [Current reuse status](#current-host-build-reuse) owns that report; the separate [current GPU feasibility grant](#current-gpu-feasibility) has **one operator-only invocation remaining/unobserved**, not renewed build2 authority.

##### Build1 retained failure — HISTORICAL, not the HOST2 outcome

The [complete operator-reported receipt](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-1/reported-receipt.json), [summary](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-1/operator-summary.txt) and [separate observation](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-1/observation.json) report **FAIL_HOST_GPU_NATIVE_BUILD_ONLY /SUCCESSFUL_NATIVE_COMPILATION_RECEIPT_REQUIRED**, inner **FAIL_NATIVE_COMPILATION_ONLY /NATIVE_COMMAND_FAILED:gpu-policy**, and **HOST_NATIVE_BUILD_EXIT=1**. **Build1 ONLY is1/1 CONSUMED /zero remaining /no retry**; its request/command/proof/source-5 false/unobserved fields remain immutable snapshots. The later separate HOST2 report above also consumes its own grant without changing build1's failure.

That failure report's provenance is **SEMANTICALLY_NORMALIZED_COMPLETE_OPERATOR_JSON_AND_SUMMARY_NOT_ORIGINAL_HOST_BYTES**. Its cause-unknown fields remain an immutable **PRE-DIAGNOSTIC snapshot**; the later compiler-text observation below does not rewrite them. Original HOST full-capture bytes remain unreceived/un-rehashed here. Retained [record-check-2](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-1/record-check-2.json) is **PASS_OPERATOR_REPORTED_FAILED_NATIVE_BUILD_RECORDS_ONLY**, **7 sources /9 complete owned-CID Docker argv /28 capture metadata rows**; [typecheck-2](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-1/typecheck-2.json) is **PASS**. Initial checks remain **PRE_REVIEW_CHECKER_SOURCE_CHANGED_NOT_CURRENT_ACCEPTANCE**; adversarial recheck **ses_e3849d24fffeF9A2jxyE1zKENR** closed the incomplete-argv MEDIUM. Those retained checks accept failure-record facts, not the corrected generation/original HOST bytes; no custody or assurance gate follows.

Reported **Bun 1.4.0 startup/property** and **three Rust/Cargo 1.95.0 /LLVM 23.1.0 guards PASS /exit 0** precede **gpu-learning --no-run PASS /exit 0** and **gpu-policy --no-run FAIL /exit 101**. Retain the learning compilation's partial success, never overall build PASS/offline completeness. Native elapsed **921,820.616072 ms**, outer **923,501.887534 ms (~15m23.5s)**; staging **99,444,545 bytes /1,253 files**, **2 compilation attempts /5 results**, all captureFailures/canonicalCopyFailures empty. Reported source **checked:true /changed:false /checkFailure:null**, manifest **9141aaefa2fab3f3a812aeabec4bdfdd818415333f9e5cba6d5ef822dac90863**.

All **nine fixed Docker operations PASS /exit 0**, including worker-stop/state/worker-remove/donor-remove, **cleanupFailures:[]**, no kill needed. State **Running:false /ExitCode:1 /OOMKilled:false** identifies no compiler/linker/CUDA/OOM cause; **artifacts:[]**, admission not reached. Native compilation ran **ONLY in the approved OPERATOR container**, reported **2 CPU /8 GiB /no extra swap /network none /pull never /uid:gid 1000:1000**, not coding/project test binaries/GPU/training/qualification-image execution. **13000** remains an unqualified trial; shared BuildKit stays untouched, no effective-hardening assurance PASS.

<a id="current-policy-record-correction"></a>

##### Diagnostic received as text — source-only correction now verified

New [operator-diagnostic.txt](../_work/gpu-owner-recovery/runs/host-gpu-policy-record-diagnostic-1/operator-diagnostic.txt) faithfully retains the available policy stderr/rendered Cargo-error paste; [observation.json](../_work/gpu-owner-recovery/runs/host-gpu-policy-record-diagnostic-1/observation.json) records **USER_PASTED_DIAGNOSTIC_TEXT_NOT_ORIGINAL_HOST_CAPTURE_BYTES**. **ERROR_RECORDS=1 /E0277** identifies **crates/policy-io/tests/gpu.rs:345:30**, **`fs::write(&record_path, &record).unwrap();`**, and the unsatisfied **`burn::tensor::Bytes: AsRef<[u8]>`** bound; compiler suggestion **`&*record`**. Accept that provided compiler-text fact without a custody gauntlet; the outer rejection guard/state alone did not establish it.

No **POLICY_DIAGNOSTIC_READ_EXIT** marker was pasted; full original **334,214-byte stdout**, independently verified original stderr bytes and HOST digest rehash remain absent. The prior expected stderr metadata **1,919 bytes /af41c7f5…** and stdout **334,214 bytes /28819440…** remain [retained capture metadata](gpu-readiness.md#current-policy-record-correction), not a full-capture or extraction-command PASS. These limits do not block source-only correction or require another capture; they grant no new read/build/staging/native-query/GPU/training/install/acquisition/Git operation.

Architect **ses_e36f4b6d9ffeCMclo9ifqwusMu** was consulted **before** continuation; goals and the [captured expected-red regression](../_work/gpu-owner-recovery/runs/host-gpu-policy-record-diagnostic-1/red-regression.json) preceded the native edit, reported **3 pass /1 fail /exit 1**. Actual line345 is now **`fs::write(&record_path, &*record).unwrap();`** inside **cuda_f64_policy_channel_subprocesses_agree_and_reload**: borrow underlying `[u8]`, preserve record ownership/serialized bytes, no clone/reserialization/semantic or Rust harness-count change. The later consumed HOST2 report accepts compilation of the existing ignored test, **not its execution or remaining authority**.

Actual [correction.ts](../_work/gpu-owner-recovery/qualification/policy-record-fix/correction.ts), [verify.ts](../_work/gpu-owner-recovery/qualification/policy-record-fix/verify.ts), [tsconfig.json](../_work/gpu-owner-recovery/qualification/policy-record-fix/tsconfig.json) and [gpu-policy-record.test.ts](../packages/runtime/tests/gpu-policy-record.test.ts) enforce the exact whole-file replacement in the named test. Bounded baseline Git show **65febc83…** matches the original prepared native entry; sourceInventory **metadata only** establishes **65 members unchanged /64 hashes unchanged /ONLY gpu.rs changed**, old source-5 **other 282 of 283 inputs equal**. Actual source-2 [native-source-manifest.json](../_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/native-source-manifest.json) SHA is **7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec**; old **9141** manifests/contexts/requests/source-1..5/host-build plan stay immutable. New generation binding makes the **original build command NOT reusable**; old guards correctly reject PREPARED_NATIVE_GENERATION_CHANGED, never rerun/rewrite/loosen them to accept changed inputs.

Both correction proof roots now exist. Historical [source-1](../_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-1/receipt.json) retains **FAIL_POLICY_RECORD_SOURCE_CORRECTION_ONLY /SOURCE_CHECK_FAILED:types-1** from new test **toReversed** (ES2023 under project ES2022); static fixture now uses **`[...corrected].reverse()`**, old failed receipt/raw captures preserved. Fresh [source-2](../_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/receipt.json) records **PASS_POLICY_RECORD_SOURCE_CORRECTION_ONLY /291 frozen hashes /sourceChanged:false /eight PASS stages**: baseline Git show, **41 tests /296 assertions (4 new +37 qualification)**, **162 pure-mock tests /8,133 assertions /3 persisted MOCK e2e**, **5 TSC**. Scope is static Bun/mock/type/source verification only, **not native Rust/CUDA/LLVM/test-binary/Docker/GPU execution or build PASS**.

Executor reports correction-source-2 **backend ses_e36f4b6cbffdofbGVKAUJzfiBO**, **adversarial ses_e36e97fdfffeVGF6ZBu1ANNkto**, and **security ses_e3845fff1ffeE092hXAV6pfhiW READY/source-only/no findings**, security low/no new hardening gate. Those remain one-line-correction scopes, not the additive adapter's verification. Its separate current proof/review scopes appear below; this docs pass reruns no source checker.

**Retained strategy selection:** Reuse cache Recommended/[selection.json](../_work/gpu-owner-recovery/qualification/host-build-reuse/selection.json) stays sourcePreparationSelected:true/operations false as an immutable source-planning snapshot. The later separate **Approve+push** HOST2/publication grant is now **CONSUMED**; do not rewrite old flags, re-ask the old cache strategy or treat it as GPU-feasibility approval.

<a id="current-host-build-reuse"></a>

##### CURRENT — HOST2 native-build-only PASS reported; GPU feasibility preparation pending

[gpu-host-build-reuse.puml](gpu-host-build-reuse.puml) owns actual **host-gpu-native-build-observation-2/** and its normalized receipt/summary/observation/contract/checker/tests. Reported **five native commands /three Rust/Cargo1.95/LLVM23.1 guards /BOTH learning+policy `gpu-prepared-llvm --no-run` compilations /exit0**, Bun1.4 property, source **checked:true /changed:false /checkFailure:null**, corrected **7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec** plus previous **9141aaefa2fab3f3a812aeabec4bdfdd818415333f9e5cba6d5ef822dac90863**. Staging **663,642 bytes /66 files /copiedCargoCache:false /retainedCachesWritable:true**; native **16,200.1312 ms**, outer **18,384.74729 ms (~18.4s)**. Five admitted artifacts total **769,483,104 bytes** with exact metadata/hashes in the report, not received binaries or independent rehash.

Reported **five normal Docker create/start/logs/state/remove operations /exit0 /cleanupFailures:[]**, owned worker **df7a70975f260ebe1c10944439e030dce200cc246302c83db859df36815eccfe** removed, terminal **exited /Running:false /ExitCode:0 /OOMKilled:false**. Original failed source/evidence/shared builder stay preserved; only old Cargo-home/target RW cache contents could change within the consumed grant, Bun RO. No project test binary/GPU/kernel JIT/qualification image/training executed; dispatch stays disabled, **trainingReady:false**.

Actual [verification.json](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/verification.json) now records **PASS_BUILD_TWO_OBSERVATION_VERIFICATION_ONLY /three PASS stages /17 Bun record-mutation tests /19 assertions /one strict TSC /current record-check PASS_OPERATOR_REPORTED_NATIVE_BUILD_TWO_RECORDS_ONLY**. The checker binds **10 local input hashes /five reported native argv /five COMPLETE reported owned-CID Docker argv /20 capture metadata rows /five artifact metadata entries**; raw local verification streams remain in **observation-2/verification/**. These are not original HOST logs/binary rehashes or coding HOST/native/GPU operations; pure imported builders construct argv strings only.

Actual [review.json](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/review.json) records architect **ses_e36783826ffetiRNpE54VUigWv**'s records-now/source-planning boundary, DevOps **ses_e384ffa7bffecNc429YDN25STS**'s SOURCE-ONLY future-runtime/headroom advice, adversarial **ses_e36649e3affeJjY53mEb5Dxjo5 READY_TO_MERGE_YES**, and security **ses_e3845fff1ffeE092hXAV6pfhiW**'s **no serialization/authority-overclaim findings /risk low /no extra hardening gate**. That saved acceptance covers **records/source-planning decision ONLY**, not final acceptance of later wording.

The initial [final-records-and-docs-check.json](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/final-records-and-docs-check.json) records **PASS_NATIVE_BUILD_TWO_REPORTED_RECORDS_AND_DOCS_ONLY** for **PRE_CLOSEOUT_DOCS_GENERATION**: **10 doc hashes /7 ordered diagram-index matches /1 observation owner /307 protected source hashes /10 record input hashes /6 local verification stream hashes**. The later [closeout-records-and-docs-check.json](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/closeout-records-and-docs-check.json) records **PASS_NATIVE_BUILD_TWO_REPORTED_RECORDS_AND_DOCS_CLOSEOUT_ONLY** for the corrected ten-doc generation plus record proofs **before GPU wrapper implementation**. [docs-closeout-review.json](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/docs-closeout-review.json) records both HIGH unconsumed-inventory and MEDIUM stale-check findings **CLOSED /READY_TO_MERGE_YES**, accepting the **5,465-byte /SHA13dfd22ca6403277689316cec2b352edb434727672578fd3a49663025bb494e3** consistency receipt. That completes historical build2 report-only records/docs acceptance and consumed-grant projection, not original HOST-byte rehash or GPU qualification. The separate source-4 [final-docs-and-source-check.json](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/final-docs-and-source-check.json) records **PASS_GPU_FEASIBILITY_SOURCE_FOUR_DOCS_AND_RECORDS_ONLY**: **11 doc hashes /8 ordered index matches /327 sources /65 native members /24 evidence hashes /7 metadata inputs /3 read-only Git captures /HEAD25bc /scoped diff PASS**, bound **before the three-passage history fix**. Later source-4 check-2 PASS/docs-closeout-review READY completed that fix before the authority decision below. Preserve every receipt/review as an immutable **PRE_THIS_AUTHORITY_PROJECTION** snapshot; only the new authority-binding/doc recheck and narrow gate remain pending. Source proof/command/original false fields remain unchanged; the separate issued request now supplies operator-only authority.

At the pre-implementation records checkpoint, the parent separately confirmed **HEAD25bcfb61ddde6849d10e61536266b5e2f50c5598**, then observed only **ten docs +observation-2 uncommitted**, and reported **git diff --check -- _spec PASS**. These are **not consistency-receipt fields or a current workspace count after feasibility implementation**. Native7e graph65/protected307 inputs remain unchanged; the new source proof below has a separate generation.

Source-3 remains **307-input SOURCE-ONLY proof**, not native/GPU evidence; handoff-2/request.json **remaining1/unobserved** and proof/proposal false flags remain immutable snapshots. The later observation consumes HOST2 **1/1 /remaining0**, and publication **25bcfb61ddde6849d10e61536266b5e2f50c5598** consumes its ONE commit/push grant. Neither old grant is renewed; separate current HOST1/unobserved and publication-PENDING requests below supply only their named scopes. Current work **LOCAL_UNCOMMITTED**, no new OID/publication/GPU result claimed. Observation-2 coverage stays only in its owner/index, never original HOST/cache paths.

<a id="current-gpu-feasibility"></a>

**APPROVED_ONE_OPERATOR_HOST_FEASIBILITY_INVOCATION_UNCONSUMED_UNOBSERVED — source-4.** Executor selected **Approve HOST (Recommended)**; separate [host-command-approval.json](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/host-command-approval.json) records **OPERATOR_HOST_ONLY_NEVER_CODING /remaining1 /hostInvocationObserved:false**. It binds the unchanged **49,023-byte command /SHAc690e8b0261e6bf09e834a41394369f694393ec6c60e18aa31b0375110f00054** and proof **cf632c5896bd5d46b453a67aeb87d2f0bd735b252960c7eca6917cee802d6f60**. [gpu-feasibility.puml](gpu-feasibility.puml) retains [source-4 receipt](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/receipt.json) **PASS_GPU_FEASIBILITY_SOURCE_ONLY /327 hashes /sourceChanged:false /six stages /48 tests322 +41 qualification296 /four TSC/four PURE MOCK e2e** and [packet check](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/record-check.json) **327 inputs/12 streams/3 programs/fullplan/8 fixture JSON hashes**. No operator receipt or **HOST_GPU_FEASIBILITY_EXIT** marker has been reported/received. Execution remains unobserved, not proven absent; runtime compatibility/first functional GPU pair remain unqualified.

The **PRE_APPROVAL** source-4 [review.json](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/review.json) retains **READY_GPU_FEASIBILITY_SOURCE_FOUR_EXACT_APPROVAL_DECISION_ONLY** and its no-findings/low-risk/no-added-hardening-gate scopes. Reviews themselves are not execution permission; source/selection/plan/proposal/proof/review false fields remain **IMMUTABLE_PRE_APPROVAL_SNAPSHOTS**, not live denial of the separate issued grant. Inner Bun1.4.0/cwd property, all three earlier functional fixes and source-1 FAIL/source-2 PRE_PHASE_END_CAPTURE_FIX/source-3 PRE_INNER_BUN_PROPERTY_GUARD history remain unchanged. Source-4 [final-docs-and-source-check-2.json](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/final-docs-and-source-check-2.json) records **PASS /11 doc hashes /8 ordered index matches /327 sources /65 native members /24 evidence hashes /7 metadata inputs /3 read-only Git captures /HEAD25bc**; [docs-closeout-review.json](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/docs-closeout-review.json) records **READY_TO_MERGE_YES /MEDIUM closed /no remaining findings**. These and older checks/reviews are immutable **PRE_THIS_AUTHORITY_PROJECTION** checkpoints, not validation of this wording. Fresh authority-binding/doc hashes and the narrow adversarial gate remain pending.

**Separate publication: APPROVED_ONE_NORMAL_COMMIT_AND_FIXED_HTTPS_PUSH_PENDING.** Executor requested commit & push, then output the actual command. [publication-request.json](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/publication-request.json) permits **one ordinary commit +one fixed HTTPS push** to **https://github.com/proveo-ca/chess-coach.git**, branch **feat-ml-adjuntant-ii**, parent **25bcfb61ddde6849d10e61536266b5e2f50c5598**. Scope: verified source4/retained source evidence/native-build2 observation/matching docs/bounded publication records, no binaries/dependency caches; inherited identity/auth only, no force/amend/hook bypass/new credentials/transport changes/retry. It grants no native compilation/coding HOST-GPU/training or renewed HOST attempt. Original HOST-only publication:false fields stay immutable; separate request supplies publication authority. [issued-approval-check.json](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/issued-approval-check.json) PASS and [issued-approval-review.json](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/issued-approval-review.json) adversarial/security READY low bind HOST request **3,483 bytes /SHAfbdbdf94fa605dc325cd1e617fce05a4228d5b93faf5b2dbeb8e56568c0ded1d**, remaining1/unobserved, not this later publication wording. Parent read-only Git preflight/UTF8 manifest/fresh authority-doc-index check/final adversarial gate remain pending; no new OID or publication success claimed.

**NEXT: COMMIT & PUSH FIRST after those checks, THEN output the SAME WHOLE UNCHANGED49,023-byte literal command, not just a link.** No assumed HOST source-4/host-command.fish or HOST fetch. Require existing HOST checkout/hash-bound helpers/Cargo.lock; missing inputs fail boundedly without fetching. **Run ONLY if NEVER attempted; ANY attempt consumes the one allowance, even preflight failure.** If already attempted, return the existing printed receipt and **HOST_GPU_FEASIBILITY_EXIT** marker without retry/deletion. Preserve prior/partial work; acceptance requires **PASS receipt AND marker0**, neither reported/received. Existing HOST1/unobserved is not renewed; old build2/pub25bc grants remain **CONSUMED0**. Current work LOCAL_UNCOMMITTED/publication PENDING; protected307/native65 generation7e unchanged.

The issued **operator-only** scope permits named RO **source2/target1/Bun1/prepared LLVM/CUDA** reads/hashes with five exact artifact bindings; embedded plan/driver **TEXT** plus fresh scratch/evidence/JIT writes; same-container selected-UUID CSV telemetry, the two unchanged F64 tests and runtime LLVM/NVPTX/CUDA kernel JIT; only new owned-CID stop/conditional kill/removal, **one container/max7 Docker operations**. Limits remain **600=480 normal+90 cleanup+30 receipt /2 CPU /8 GiB memory and memory+swap /no extra swap /3 GiB startup /abort below2 GiB /2s query-start /1s query /4s stale**, **120s/test /270s including30s cleanup /inner<=410s clipped to HOST normal MINUS20s**. No coding HOST/native/GPU execution, source/Cargo recompilation, image build/pull, install/acquisition/fallback, retained-cache writes or experiment/training authority. This HOST request supplies no publication authority; the separate publication request above does. Image pins/Dockerfiles/math/context/CPU/master/full4,670/C12/CPU39/BOTH/reference/close/R4 and all numerical contracts remain unchanged; strict pure-policy **10/297/300 unchanged/unqualified**, dispatch disabled, **trainingReady:false**. ALL hardening follows ALL planned training and validated results.

##### Retained HOST2 source proof and accepted execution contract — HISTORICAL

The following explanatory paragraphs describe the then-issued HOST2 contract, now **CONSUMED**. Original requests/proofs keep their remaining1/unobserved snapshots; these docs grant **no current execution or publication authority**. No coverage, source, record, proof, request or plan changes in this docs-only fix.

[gpu-host-build-reuse.puml](gpu-host-build-reuse.puml) owns actual **qualification/host-build-reuse/**, verifier/four tests/bounded dependencies and the historical HOST2 contract; [readiness](gpu-readiness.md#current-host-build-reuse) owns the later reported PASS/consumed status. Architect **ses_e36f4b6d9ffeCMclo9ifqwusMu** accepted the additive boundary before implementation, old code unchanged. **Old291-input correction proof remains CURRENT for the one-line fix only**; separate source-3 **PASS_CACHE_REUSE_SOURCE_ONLY /307 frozen inputs /sourceChanged:false /nine stages /89-6444 +41-296 +162-8133 +6 TSC** and six PURE MOCK cases remain SOURCE-ONLY, not native-build/GPU evidence.

Actual reuse-source-1 retains **FAIL/89 tests/88 pass/one fragile renderer regex assumption** about root concatenation versus Bun's constant-folded absolute dynamic import; test-only module-path assertion fix left delivery unchanged. Source-2 PASS remains **PRE_LOW_PROPOSAL_METADATA_FIX**. Security **LOW CWE269** concerned proposal.cacheMutationScope including RO Bun, not an actual writable mount; only verify.ts proposal metadata changed to exactly **cargoHome +cargoTarget**, **retainedBunReadOnly separate**. Old source-1/2 proofs/proposals/raw captures stay immutable; fresh source-3 is current, with the **same command all three generations**.

Original proposal/plan/proof/review/check false flags stay immutable PRE-APPROVAL snapshots. Original [handoff-2/request.json](../_work/gpu-owner-recovery/runs/host-gpu-build-handoff-2/request.json) recorded the then-issued authority, now **CONSUMED**, retaining **APPROVED_ONE_HOST_BUILD_ONLY_INVOCATION_UNCONSUMED_UNOBSERVED /remaining1 /observed:false**, proof SHA **268a7750faeca4c349769e62b67276fe16a3d5f9347f3d2448f45bfccbed5c5e** and exact **76,732-byte /SHA47cdea246668505ef6b2fe682900c7735adf59f388cbfcfde3abb20a306559c4** command, not rehashed here. At issuance it had no HOST2 result; separate observation-2 now accepts the reported native-build-only PASS/zero marker and consumes HOST2 **1/1 /remaining0**. Existing source-3 record-check **PASS_EXACT_CACHE_REUSE_DRAFT_RECORDS_ONLY** checked307 hashes/18 streams/3 programs/full regenerated command+plan/24 files across6 MOCK cases/ONLY two writable caches+Bun RO. Source-3 review persists adversarial **ses_e36ba7131ffeo2U1MjPrDpWjkp READY/no findings**, DevOps **ses_e384ffa7bffecNc429YDN25STS READY exact-decision-only**, security **ses_e3845fff1ffeE092hXAV6pfhiW LOW CLOSED/no remaining/risk low**, not HOST execution. The later recorded consistency PASS above covers its bound PRE_CLOSEOUT_DOCS_GENERATION, not this subsequent wording.

Existing source-3 [approved-handoff-check.json](../_work/gpu-owner-recovery/runs/host-gpu-cache-reuse-source-3/approved-handoff-check.json) is **PASS_APPROVED_CACHE_REUSE_HOST_HANDOFF_RECORDS_ONLY** for the then-issued request2/command/proof307/two mutable caches/Bun RO and historical **HOST2 remaining1/unobserved +commit1/HTTPS push1 allowed**. [publication-preflight.json](../_work/gpu-owner-recovery/runs/host-gpu-cache-reuse-source-3/publication-preflight.json) is **PASS_READ_ONLY_PUBLICATION_TRANSPORT_IDENTITY_PREFLIGHT**, inherited identity/fixed HTTPS/no applicable rewrite/**NO executable or linked Git hooks**; that configuration selected no native Cargo hook. Its precommit snapshot recorded commit/push0 and no execution during that check, not remaining authority after later publication/HOST2 consumed both grants.

Existing [publication-source-audit.json](../_work/gpu-owner-recovery/runs/host-gpu-cache-reuse-source-3/publication-source-audit.json) is **PASS_NON_SPEC_CORRECTED_SOURCE_AND_REUSE_PACKET_PUBLICATION_AUDIT**: **413 NON-SPEC entries before itself /2,900,794 text-link bytes /8 bounded relative SOURCE-fixture links**, excludes **_spec AND itself**, binaries/caches. It remained a **PRECOMMIT/PRE_FINAL_SPEC_ENVELOPE** snapshot, not proof of later publication or an audit self-hash. All307 checked inputs/regenerated programs/full76,732-byte command stay unchanged; later publication25bc and PRE_CLOSEOUT_DOCS_GENERATION consistency PASS retain their separate scopes. Existing source-3 root coverage includes these three historical records, no additional edge.

Pinned Bun.build supports **no write:false option**; actual local-JS bundling has **no outdir/outfile**, in-memory BuildArtifacts/Blob.text, normalized bare/node-prefixed builtins. Export/body checks activate no old CLI/native/HOST work; expected dynamic absolute helpers retain baseline hash checks. No source publication or saved HOST Git revision prerequisite follows.

The then-issued contract approved exclusive HOST roots **cache/host-gpu-native-build-2/native /runs/host-gpu-native-build-2**, not received coding files or coverage. It allowed ONLY old **Bun RO /Cargo RW /native/target-gpu RW** reuse; cache contents could change only within that now-consumed HOST2 grant, preserving old source/evidence/Bun. It bound old9141/new7e and gpu.rs **b1cb7ebe67ec15cb198db413ad5ad03d883aa07e408e78afbb9d6d8e9dc5f9ce →89b80da22602fbfa679e79e1fb6339d08714ea89ed3e7e81b692f61324f0394c**, ONLY fresh source/manifest overlay. No current donor/cp/pull/install/acquisition/shared-builder mutation/project-test/GPU/train/deletion/overwrite/retry/coding Docker-native authority follows. Existing helpers/Cargo.lock were required, not helper fetch/new HOST metadata permission.

The historical fixed method specified pinned Rust+retained Bun, **2 CPU /8 GiB /no extra swap /jobs2 /network none /pull never /current UID**, Bun regular/executable/positive <=128MiB plus property1.4 check, **13000 unqualified**. It bounded **7 Docker operations /5 normal**, required separate start/log-follow, validated captured64hex CID before store/recovery, deferred stop during pending start and excluded start --attach. It required staging only current-native+qualification-tools <=512MiB/3800 files without target traversal/clear, plus three guards+BOTH no-run Cargo captures even on cache hits. HOST admission required **comp2 /source checked:true /changed:false AND new7e sourceManifestSha256 AND old9141 previousSourceManifestSha256**, terminal PASS/five artifacts NORMAL deadline; no old learning-PASS substitution or general executor/broker.

The historical contract bounded **4020+120+60=4200s /outer4080TERM+120KILL** from the pre-syntax/Mise epoch; native <=3600 clipped to normal cutoff **minus120s acceptance reserve**, helper remaining retained30s native receipt reserve. Logical32GiB SOFT/5s counted fresh roots+retained RW Cargo/target once, free64GiB initial/16GiB running, Docker writable layer excluded/no quota. Stream goals **56+40+16=112MiB** excluded plan/receipts/Bun/compiler/parent; parent64KiB post-exit SOFT/receipt2MiB stayed separate. Guardian lifetime covered closed/drained monitor through immutable wx pre-marker receipt/post-write failure check; PASS required zero HOST marker too. The contract preserved partial paths and rejected oversized cache without deletion/bypass. None established strict crash/physical-stop/NTP/signal/isolation assurance.

**The historical Approve+push selection and both grants are CONSUMED.** It issued ONE OPERATOR-only HOST2 command/7 Docker/4200s/2 CPU/8 GiB memory+swap8 GiB/no extra swap/network none/pull never/offline jobs2/current UID/pinned images, fresh staging/overlay/three guards/two compilations/build scripts/proc macros and new owned-container cleanup, only named Cargo/target writes. Build1 remains consumed; HOST2 is now **1/1 CONSUMED /remaining0**, not live remaining1/unobserved or coding permission.

**The historical publication/delivery request completed at25bcfb61ddde6849d10e61536266b5e2f50c5598; its ONE commit/push grant is CONSUMED.** Saved-file delivery required an actual published commit/path already on HOST; whole unchanged **76,732-byte literal COPY** was the alternative, never implicit fetch/pull/helper acquisition. Publication order was a delivery request, not a native dependency. The invocation has now been reported: accept existing **HOST_NATIVE_BUILD_EXIT=0 /observation-2**, never rerun/overwrite/delete partials. Any attempt consumed the allowance, including preflight failure; issued remaining1 is no current permission. Recorded consistency PASS covers PRE_CLOSEOUT_DOCS_GENERATION only; final review remains pending. Hardening stays AFTER ALL training/validated results; this docs pass executes/publishes nothing, no old LLVM archive/native-global Upgrade PASS.

Old failed source/evidence/all partial outputs remain retained; only exact Cargo/target contents could change within the now-consumed OPERATOR HOST2 grant, never in coding. Original HOST2 evidence/cache remain unreceived/uncovered. Existing owner/index coverage includes the issued request/source-proof roots/dependencies/normalized observation-2, not original HOST/cache paths; this projection changes no coverage. Prior publication25bc/build2 grants remain consumed; current work LOCAL_UNCOMMITTED, separate new publication PENDING as scoped above. No source/request/proof/record edits/commands/agents occur in this docs pass, no extra assurance gate/old LLVM archive/native-global Upgrade PASS.

##### Retained accepted execution contract and source proof — HISTORICAL, no remaining authority

[gpu-host-build.puml](gpu-host-build.puml) owns **OWNED_DOCKER_CONTAINER_NATIVE_BUILD_ONLY_NOT_QUALIFICATION_IMAGE_BUILD** under the now-consumed [issued request](../_work/gpu-owner-recovery/runs/host-gpu-build-handoff-1/request.json), not a silently substituted qualification image. The contract below describes original scope, **not permission to run again**. Exact Rust base+Bun interpreter/native65/layout, qualification runner and both production/qualification Dockerfiles remain unchanged; the shared builder stays outside ownership/scope.
Actual native-build source-1 FAIL (fragile transpiler assertion) and source-2 **PASS/282 hashes/76 tests/4777 assertions/three pure MOCKED e2e +37 qualification/280/four types** remain **PRE_FUNCTIONAL_REVIEW_FIX history**. Actual source-3 **PASS/282 frozen hashes/148 tests/7329 assertions/three pure MOCKED lifecycle cases +37 qualification/280/four types** is **PRE_FINAL_TWO_REVIEW_CORRECTIONS history**, not current-source proof; all snapshots/failure findings remain intact.
Actual source-4 **FAIL/162 tests/161 pass +one formatting-regex trailing-whitespace assertion failure** remains immutable history. Retained pre-correction source-5 records **PASS_HOST_NATIVE_BUILD_SOURCE_ONLY/sourceChanged:false/283 frozen hashes/162 tests/8133 assertions +37 qualification/280/four types**, all **six stages PASS**, with **three persisted PURE MOCK lifecycle cases**; this verifies its frozen baseline, **not the corrected generation** or real Docker API/CLI compatibility/native/HOST result. Recorded command **40,054 bytes/SHA-256 `50123eaff0efebb93f7c03210afd765c0ddb02273c08b7ac63a262e37dcd962e`** passed the existing pre-docs-update check, not a fresh rehash by this docs pass.
Historical source-3 re-review closed DevOps's three initial findings and scoped security races, then adversarial returned **two new MEDIUM/NOT READY** for signal-handler lifetime and overwritten supervisor cause. Those and initial DevOps 3 MEDIUM/adversarial 2 HIGH+4 MEDIUM/security start-race findings remain functional lifecycle/evidence history, not deferred hardening. Existing source-5 `review.json` now records **architect ten-operation method acceptance/DevOps READY/adversarial all eight prior findings resolved/no findings/READY/final security READY_FOR_PROPOSAL_DECISION_ONLY/low/no additional hardening prerequisite**. Current source/proposal reviews are complete, not operational or deferred-assurance acceptance.
Current goals use **<=10 Docker operations**, with **separate start <=120s then logs --follow <=min(3600s, normal remaining)**, NEVER start --attach; same donor/worker/two owned CIDs/state/stop/conditional kill/two removals, no new metadata/setup/shared-builder operation. `startPending` blocks watcher stop/memoization until start settles; prior failure prevents start, pending-start failure prevents logs, log-follow interruption stops owned work.
The owning diagram binds one pre-syntax/Mise HOST timestamp to normal/cleanup time, `deadline.json` clips native <=3600s to remaining normal budget, outer **4080s TERM+120s KILL/4200s** unchanged. Artifact admission is **NORMAL <=min(120s, remaining normal)**, one normal-path state inspection/no repeat in failure cleanup; it cannot spend cleanup reserve. Monitor async close drains scans/stop calls before final cleanup/removals/receipt, tolerates child ENOENT only; root/other errors fail.
Independent HOST-main `protectFinalizationSignals` installs **BEFORE preflight**, remains after watcher close/drain through owned cleanup/receipt write/**post-write check**/console status/exit-code selection, and releases only in final `finally` after metadata I/O/logging. It records only a flag, never late Docker callbacks; preflight interruption blocks Docker and observations **before OR after receipt I/O** downgrade console/process exit to FAIL while preserving earlier primary failures. Fake-emitter tests cover source logic, not real signal delivery; existing **120s cleanup/60s receipt /4080s TERM /cleanup ending 4140s /4200s KILL** are cooperative, not NTP/crash/physical-stop assurance.
Receipt **exclusive-wx /immutable PRE-MARKER snapshot /receiptStatusRequiresZeroHostMarker:true** means a signal during writing may leave file status PASS while final console/process status and **HOST_NATIVE_BUILD_EXIT** fail. Preserve that evidence unchanged; overall build-only acceptance requires **PASS receipt AND HOST_NATIVE_BUILD_EXIT=0**, not receipt alone.
Native attempt/result retention precedes capture/mirror; auxiliary failures do not erase primary command failures. Source recheck after try/catch includes failed builds when possible; unchecked/read-failed/deadline is **null/unchecked with reason**, not sourceChanged:false. Native/HOST PASS requires **sourceStabilityChecked:true AND sourceChanged:false**, complete artifacts, drained watcher and no failures.
HOST results preserve raw **supervisorResult status/exitCode/failure**; `entry.failure` keeps the actual deadline/output-bound cause separately from contextual `operationFailure`, and pre-result exceptions retain their message. Stdout is **not duplicated into receipt metadata**, avoiding a 4 MiB raw stream overflowing the 2 MiB receipt through duplication; separate raw captures remain unchanged.
Stream goals now **80+40+16=136 MiB HOST raw/native raw/canonical COPY**, excluding receipts/artifacts/Bun/compiler outputs/parent logs; 40 excludes mirrors. Existing pinned helpers+Cargo.lock, **64/16 GiB free/32 GiB SOFT**, separate evidence mount/copies, ordinary cooperative clocks—not quotas/NTP/physical-stop proof—remain unchanged; no helper fetch/repair.
Existing source-5 `record-check.json` records **PASS_HOST_NATIVE_BUILD_SOURCE_AND_COMMAND_RECORDS_ONLY** from `host-build/verify-records.ts`: **283 source hashes/12 streams/12 fixture files across three PURE MOCK cases/programs and exact command/six ordered diagram-index matches**. This **PRE_APPROVAL/PRE_AUTHORITY_METADATA_UPDATE snapshot** does not freshly verify the new authority/coverage projection; source graph excludes docs, frozen source/proof are unchanged, no new proof/checker run. Source plan/proof/proposal/review false HOST/publication approval flags remain historical and untouched; the original proposal is not the active authority.
**Issued approval snapshot:** existing **handoff-1/request.json** retains **APPROVED_ONE_HOST_BUILD_ONLY_INVOCATION_UNCONSUMED_UNOBSERVED /hostExecutionApproved:true /remaining 1 /observed:false** unchanged, bound to source-5 command/proof. That original ONE HOST-only method accepted donor extraction/staging/guards/two offline compilations/cleanup within **10 operations/4200s/2 CPU/8 GiB/136 MiB**, not coding execution. The separate observation now consumes HOST **1/1 /remaining 0**; it never rewrites the source-plan/proof/proposal/review false approval fields or the request's **gitPublicationAuthorized:false**.
**Delivery/publication history:** the separate later ONE normal commit/fixed-HTTPS push completed at **4350306f9**, grant **CONSUMED**. Lead delivered the SAME **40,054-byte** command; “once more” meant redisplay, never a second invocation. Saved-file delivery required that actual published commit/command already on HOST; whole-literal COPY was the alternative, no implicit Git/helper fetch. None grants a current run/retry/read/extraction or publication.
Coverage retains source-1..5/handoff-1/request.json/prior observation-1/**, actual diagnostic/contract/test/native source and BOTH existing correction-source-1/**/correction-source-2/** roots. Original HOST files/cache remain uncovered; original six ordered diagram/index matches and source-5 proof stay frozen baseline facts, while correction-source-2 accepts the source correction only. No source/plan/proof/request/diagnostic-record edit or command occurs here. Later recorded consistency PASS covers its bound PRE_CLOSEOUT_DOCS_GENERATION, not these subsequent wording edits; final review remains pending.
Actual native delta is ONLY gpu.rs bytes; **native65 membership**, Rust harness counts/model/all **4,670** coordinates/`eps=1e-6`/`atol=1e-8`/`rtol=1e-5`/exact C12/CPU Flex/masters **101..105**/production recipes stay unchanged. Dispatch stays disabled and **trainingReady:false**; ALL security/privacy/isolation hardening stays after **ALL planned training and validated results**, not a new pretraining gate or assurance PASS.

<a id="current-runtime-packaging"></a>

#### Historical runtime/publication packet — before receive-2 report and docs push 283897c

The packet below preserves its pre-observation-2/pre-283897c snapshot; pending/unrun/local-publication wording is historical, not current authority.
The [current next decision](#current-host-build-inventory) above governs without rewriting old requests, proofs, FAIL receipts or alignment PASS.

The new [builder-detail paste](../_work/gpu-owner-recovery/runs/host-builder-inputs-1/operator-details-paste.txt) and [normalized detail record](../_work/gpu-owner-recovery/runs/host-builder-inputs-1/operator-details.json) now report Linux/amd64, Debian 12 bookworm, cc/c++ GCC 12.2.0 (`12.2.0-14+deb12u1`), GNU ar/ld 2.40, glibc 2.36 and `/usr/lib/gcc/x86_64-linux-gnu/12/libstdc++.so`.
All 12 command frames and the C++ query report exit 0; these concatenate existing outputs, not original files or separately bounded streams, and they required no new Docker/compiler replay.
Executable Rust/Cargo versions in that builder-image inspection remain null; the later host-Mise alignment report accepts host version facts, not executed versions inside the image.
The pasted image ID repeats the pinned manifest digest while retained config digest is `d617f1b5c2a18778ba357ba0528e973bd24992b0dd18000dfbca059f4a15ebda`; cause unknown, wrong image not established, no acquisition invalidation or new custody gate.
The old root observation/paste remain byte-unchanged details-pending snapshots; current received facts supersede that missing-detail state without rewriting history.
Latest confirmed SOURCE_ONLY helper push is **`98749410eda3dcadd7a210d3ddb1ac097a9ba13d`**, source grant consumed; prior alignment push **5c236ef…**, earlier docs **cca45f6…**, run-1 helper **33b29dd095a3582a02861cef0f155e675a6721cc** and asset source **f3e277dbbf33c0aa69172cca1890792656d4cd09** keep distinct historical roles.
Receive-2 operator execution remains unrun; post-push receipts/command and this outcome documentation stay **LOCAL_UNCOMMITTED**, with publication separately approved by Executor's later explicit **"commit & push"** request.
No additional publication is authorized under the consumed helper-source request; the later docs/evidence approval covers current outcome/spec/command records only, not helper/code changes or operational replay.

Executor selected `Rust base+Bun Recommended` in the [source-only runtime request](../_work/gpu-owner-recovery/qualification/runtime-request.json).
The qualification recipe now uses the same Rust pin for inputs/runtime and copies only the Bun interpreter from its own pinned stage, removes only its builder rootfs copy, and guards future actual Rust/Cargo 1.95.0 and Bun 1.4.0 startup.
All RUN instructions remain network-disabled; four locked/offline Cargo no-run builds, CPU/GPU paths and UID 1000 scratch remain; production Dockerfiles/Rust/math/F64/C12/initialization/master contracts remain unchanged.
The retained DRAFT-generation [source-6 publisher receipt](../_work/gpu-owner-recovery/runs/gpu-input-transfer-source-6/receipt.json) records **PASS_TRANSFER_SOURCE_ONLY**, sourceChanged:false, **316 hashes / 65 unchanged native inputs**, six PASS stages, **89/438 helper / 37/280 qualification / four types**; new receive-2/shared-publisher code binds separate source-4, not those old full helper hashes.
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
The [operator observation](#current-host-receive) reports **BOOTSTRAP_STARTED / BUN_VERSION_MISMATCH / HOST_COMMAND_EXIT=1**, consuming **1/1 invocation at report scope**.
Executor's [alignment report](#current-host-toolchain) now reports six exit-0 phases, exact Bun/Rust/Cargo banners and **PASS_HOST_TOOLCHAIN_ALIGNMENT_ONLY / HOST_TOOLCHAIN_EXIT=0**, consuming alignment/install **1/1** and queries **3/3** at report scope, zero remaining.
Executor's [receive-2 publication outcome](#current-host-receive-run2) is **PASS / SOURCE_ONLY** at **98749410eda3dcadd7a210d3ddb1ac097a9ba13d** after one top-level adapter invocation, consuming the source commit/push grant **1/1**.
**ONE operator receive-2 invocation remains APPROVED_UNCONSUMED / UNRUN**; parent next delivers the generated literal for **COPY into host Fish at repo root**, then waits only for HOST output verification, no planning question.
Frozen source-4 **329 inputs / 40-410 / 91-453 / 37-280 / five types** remains applicable to unchanged helper/source code; this docs pass reruns no checks.
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
At that first STOP, operator download/extraction and host/build/GPU/training work remained unauthorized; all previous native/LLVM/Mise/cache/metadata/operator allowances stay spent. The later [handoff observation](#current-host-receive) records its distinct operator invocation consumed 1/1 at report scope, not build/GPU/training authority.
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
The unchanged approval projection is historical; that third grant is **CONSUMED** and grants no further attempt/commit/push, while the later host-receive handoff supplied distinct coding/operator scope, now also consumed.
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

At that DRAFT-asset publication, confirmed push was **`f3e277dbbf33c0aa69172cca1890792656d4cd09`**; the later helper handoff confirms **`33b29dd095a3582a02861cef0f155e675a6721cc`** without changing the asset source.
Executor reports local origin tracking still `d3bb6bcc6420f50c559ad7260f968578e20cf725` after explicit-URL push; `ahead 1` is not evidence of an unpushed commit, and no fetch is needed or authorized.
The 193-path source commit contains controlled text/source-6 proof/prepublication docs/status, **no binary/cache payloads**.
Source handoff 33b29dd… published retained pub3 evidence/pre-handoff docs; Executor reports later docs/post-handoff records published at cca45f6… under a now-consumed allowance. The then-current observation/alignment/source-proof/docs-local state remains historical; the [current receive-2 packet](#current-host-receive-run2) records later helper-source publication and separate explicit docs/evidence approval, with no staging/commit/push by this docs pass.
Source-6 request/proof bytes and both failure receipts stay immutable; changed shared-publisher/receive-2 source binds source-4, and no receipt is rewritten to claim inclusion in the commit it describes.
The [readiness outcome](gpu-readiness.md#current-identity-publication) and [owning diagram](gpu-input-transfer.puml) record the same PASS/consumed boundary.

**Upgrade complete: input preparation + DRAFT publication only.**
Original prepared context/LLVM/Cargo/native bounds and **103 missing archives / zero missing metadata / offline-build UNPROVEN** remain unchanged.
The [host-receive observation](#current-host-receive) records source publication PASS/consumed and operator-reported bootstrap FAIL/consumed at report scope, with build/GPU/training excluded and actual host version/files unknown.
No functional F64/4,670-coordinate/tolerance/C12/CPU Flex/master/BOTH/reference/close/R4/telemetry/coexistence qualification follows; native65/Rust/model/math/production contracts stay unchanged, runtime/training entrypoints disabled and trainingReady:false.
ALL security/privacy/isolation hardening remains AFTER ALL planned training completes and results validate; no new functional or assurance gate is introduced.

<a id="current-host-receive"></a>

##### Operator-reported Bun-version FAIL — invocation CONSUMED 1/1; approved alignment separate

Executor's correction is **"stop only when a decision of a host command verification is needed"**.
Source work continued to that prior combined decision; Executor selected **Publish+receive Recommended**, not adjust destination or defer.
Executor's later [approved alignment handoff](#current-host-toolchain) supplies distinct operator-only scope; it does not reopen this consumed receive allowance.
The original [handoff-1/request.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/request.json) retains **APPROVED_ONE_SOURCE_PUBLICATION_AND_ONE_OPERATOR_RECEIVE_INVOCATION** as unchanged grant history, not fresh scope.
It supplied source commit/push <=600s and one operator invocation <=900s under the bounds below; source publication remains PASS/consumed, operator invocation is now **CONSUMED 1/1 at report scope / zero remaining**.
That consumed receive request authorizes no automatic receive retry/refetch, install/auth/config change or new native/dependency query; actual operator bytes/source identity and download history remain independently unverified.
The consumed coding scope included reviewed helper/evidence/docs and retained pub3 outcomes, **no new release/assets/uploads** or unrelated maintenance publication.
The [plan.json proposal](../_work/gpu-owner-recovery/qualification/host-receive/plan.json) keeps **codingSourcePublicationApproved:false / operatorReceiveCommandApproved:false** as immutable history, not current authority.
The referenced [host-command-approval.json proposal](../_work/gpu-owner-recovery/runs/host-input-receive-source-2/host-command-approval.json) also retains its original AWAITING/false fields; the later request supplied distinct, now-consumed authority, never a rewrite or replay of an old grant.

[gpu-host-receive.puml](gpu-host-receive.puml) owns the source/command contract and links back to transfer/qualification/build; the [readiness packet](gpu-readiness.md#current-host-receive) records the same bounds/options.
Keep historical run-1 identities separate: **DOCS cca45f6b2978398f68d0db1a84119e1b5a3c0ee2**, **helper 33b29dd095a3582a02861cef0f155e675a6721cc**, **assets f3e277dbbf33c0aa69172cca1890792656d4cd09**; later alignment push **5c236ef…** changes none into independently verified operator-executed identity.
Historical run-1 helper **17,994 bytes / SHA-256 `091a431757ef83710a95156816e085cb1ed36b632e4923c9632695ffe821bafa`** stays bound to old receipts and the 33b29dd… command; current receive-2 helper differs and binds source-4 below. Actual operator bytes remain unverified.
Existing DRAFT **439935095**, manifest asset **730048215 / 868,843 bytes / SHA `2676780f2b932d0453fef05ad39581152f47efeaea11ae22b9079875fece1829`** and bundle **730047564 / 140,694,281 bytes / SHA `9001bfeb88ce5433138d5f0fd23b3c7ab0590cc0bd47900cc1c0a1d6923c65f7`** remain unchanged.
Remote Git tag remains **ABSENT_WHILE_DRAFT**, no created-tag/public-release claim or new upload scope.

The [source-2 receipt](../_work/gpu-owner-recovery/runs/host-input-receive-source-2/receipt.json) is **PASS_HOST_RECEIVE_SOURCE_ONLY**, failure:null/sourceChanged:false: **34 receiver tests / 352 assertions + 89 transfer / 438 + 37 qualification / 280 + five typechecks**, eight stages PASS/exit 0.
[Source-1](../_work/gpu-owner-recovery/runs/host-input-receive-source-1/receipt.json) stays historical **31 receiver tests / 280 assertions** before the final fixes.
The source-proof coding Fish syntax result remains historical **NOT RUN**: it recorded `/usr/bin/fish` absent and the Mise shim unconfigured; no Fish installation or substitute coding-syntax gate is authorized.
Pure fixtures check one/two/three quote layers and backslash/apostrophe round trips; published `fish --no-config -n` precedes fetch, but the new reported guard stage is not formal all-host syntax/runtime PASS evidence.

The original [publish-source.ts](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/publish-source.ts) passed preflight/frozen metadata and controlled text audit/staging, then stopped at unrestricted **git diff --cached --check / exit 2**, before any commit/push.
Its [publication.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/publication.json) remains **FAIL / SOURCE_PUBLICATION_COMMAND_FAILED / 213.214362 ms**, commit/push **0/0**, commitSucceeded:false.
[command-06 stdout](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/command-06/command.stdout) names trailing whitespace in unchanged raw pub3 GitHub `publish-07/command.stderr`; no capture was trimmed, no hook bypassed, and that full-check FAIL is not overwritten or relabelled PASS.

The internal [continue-source.ts](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/continue-source.ts) correction requires exactly this static-only failure with commit/push **0/0**.
It shares **publication.started mtime + the original 600s deadline**, starting with **210,411 ms** left, not a renewed budget or operational retry.
Its **continuation-02 scoped check PASS / exit 0** covers `_spec`, qualification source and `runs/**/*.ts`; raw capture streams remain retained/in the source commit but outside that source/spec/task whitespace gate.
**The unrestricted full-index check remains FAIL; only the scoped check passed.**

[continuation.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/continuation.json) records **PASS_SOURCE_PUBLISHED_OPERATOR_OUTPUT_PENDING**, failure:null, commitSucceeded:true, actual commit/push **1/1**, sourceCommit=pushedCommit=**`33b29dd095a3582a02861cef0f155e675a6721cc`**, rawEvidenceWhitespacePreserved:true.
Normal commit **continuation-03** and literal fixed-HTTPS OID push **continuation-06** exited 0 within the remaining original clock, with frozen source-2 **318 raw committed hashes** and reviewed helper/native65 unchanged.
The original run-1 source-publication grant is **CONSUMED**, with no additional commit/push authority under that request; original FAIL/marker/command-01..06 and separate continuation script/marker/types/captures/result all remain retained.
Continuation typecheck streams remain separate from source-2's five-typecheck evidence; no checker/Fish syntax operation is rerun by this docs pass.

The actual [host-command.fish](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/host-command.fish) and [handoff.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/handoff.json) now exist, generated **AFTER the successful source push**.
Handoff **READY_FOR_ONE_APPROVED_OPERATOR_INVOCATION** binds helper OID **33b29dd…**, asset OID **f3e277d…**, fixed helper bytes/SHA and command SHA-256 **`8def4344fb3179ed0c6fc3d7275c9c644da2ae6dd61eb9950c749dba3af7eb76`**.
That handoff retains its pre-invocation READY meaning, not permission to replay the now-consumed command.
Receiver receipt `_work/gpu-owner-recovery/runs/host-input-receive-1/receipt.json` has **not been received**; its actual existence/absence is not independently established.

The new [operator-paste.txt](../_work/gpu-owner-recovery/runs/host-input-receive-observation-1/operator-paste.txt) contains exactly **BOOTSTRAP_STARTED / BUN_VERSION_MISMATCH / HOST_COMMAND_EXIT=1**.
[observation.json](../_work/gpu-owner-recovery/runs/host-input-receive-observation-1/observation.json) is **OPERATOR_REPORTED_BOOTSTRAP_FAIL_BUN_VERSION_MISMATCH**, normalized from terminal paste, not original host files; actual Bun version **null**, operator command bytes/source identity unverified.
First [record-check.json](../_work/gpu-owner-recovery/runs/host-input-receive-observation-1/record-check.json) remains immutable history; current [record-check-2.json](../_work/gpu-owner-recovery/runs/host-input-receive-observation-1/record-check-2.json) records **PASS_OPERATOR_REPORT_RECORDS_ONLY** after corrected marker checks.
Its [checker](../_work/gpu-owner-recovery/runs/host-input-receive-observation-1/verify-report.ts) requires both markers >=0 before comparing guard-before-fetch ordering, verifies report frames/consumption and the coding-known expected command SHA **8def…**, not actual operator bytes or host qualification.
Published mismatch control flow precedes helper fetch/receiver invocation/root creation; this does not independently prove no downloads occurred or prove host file existence/absence.

The earlier **saved-file-only next step is superseded** by Executor's host-alignment directive.
These four previously requested paths remain **NOT RECEIVED**, not a prerequisite for the new host-command decision:

- `_work/gpu-owner-recovery/runs/host-input-bootstrap-1/bun-version.stdout`
- `_work/gpu-owner-recovery/runs/host-input-bootstrap-1/bun-version.stderr`
- `_work/gpu-owner-recovery/runs/host-input-bootstrap-1/bun-version.exit`
- `_work/gpu-owner-recovery/runs/host-input-bootstrap-1/command.exit`

The consumed receive grant supplies no fresh version query, installation, auth/config change, refetch or receive replay.
The later alignment handoff supplies separate scoped approval below, with Bun **1.4.0** and Rust/Cargo **1.95.0** unchanged; the old proposal's false flags stay historical.

The published, now-consumed contract gives the Fish parent exclusive bootstrap creation/`command.exit` retention; its worker uses GNU timeout **895s TERM + 5s KILL grace within 900s**, not actual host-file or physical-containment proof.
Exactly ONE plaintext helper contents GET binds **github.com + actual helper OID + fixed SHA**, **55s TERM + 5s grace**, with **128 KiB post-fetch soft admission**, not a streaming byte quota.
That published contract required existing Bun **1.4.0**, gh, Fish, GNU tar/coreutils and auth/Mise auto-install false; it grants no current install/login/auth/config scope.
Under that contract, the receiver would create separate evidence `_work/gpu-owner-recovery/runs/host-input-receive-1/receipt.json` and fresh `_work/gpu-owner-recovery/cache/host-receive-1/context`, not a claim those files exist.
No original host records were received; these published host paths have **unverified existence/absence** and remain uncovered, not established coding-side artefacts. Observation-1 coverage includes its five coding-side report/checker records, including both retained check generations.

The manifest-first and bundle-second asset-ID GETs share **600s**, exact byte/SHA checks and a deadline check after every completion including the last.
Standard GNU tar listing must equal the unique union of **3,939 recorded manifest rows + five literal roots**; one extraction and verification share **180s** inside the outer **900s**.
Verify **3,800 regular hashes / 137 recorded directories / two LLVM links / embedded native65 manifest**, **429,218,730 context bytes**, <=3 GiB; >=8 GiB free and <=8 GiB soft workspace use are not filesystem quotas.
Only the child drops `TAR_OPTIONS`; no global configuration change, replacement tar engine, arbitrary-archive audit or old LLVM pipeline replay follows.
Counters consume attempts before execution; partial writes update captured size/hash per actual retained bytes before later failure, preserving partial records without retry/delete/overwrite.

Executor reports the preselection DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` READY to present the combined decision, adversarial `ses_e3c122320ffdrHp4JsMATl2iN7` all four findings resolved/READY, scoped security `ses_e3cea2a12ffe9TMeXvXBhDE8n7` two MEDIUM fixes accepted; those source reviews were not authority, while the later request supplied the now-consumed source/operator allowances.
At the run-1 observation, Executor reported docs/post-handoff-evidence normal commit/HTTPS push **`cca45f6b2978398f68d0db1a84119e1b5a3c0ee2`**, **24 controlled texts**, worktree clean before that observation; that publication grant is consumed, with no fresh Git query/fetch/publication authorized under that allowance.
The run-1 helper **33b29dd…**, assets **f3e277d…** and then-current local observation/alignment/source-proof/docs state retain their historical meaning; actual operator execution identity remains unknown. The [current receive-2 packet](#current-host-receive-run2) records later fixed helper-source publication and separate explicit docs/evidence approval; this pass stages/commits/pushes nothing.
No coding installation/native query, auth/config change, retry/overwrite/delete, new release/assets/uploads, coding payload acquisition/copy/repack, LLVM/Cargo execution, image/native build, GPU or training work is approved; the separate operator alignment below adds none of those coding permissions or extraneous template-fetch/maintenance publication scope.
Historical requests/receipts/proofs remain immutable, while current receive-2 source binds source-4; no docs-side source/proposal/receipt changes, commands, network/auth/native/payload operations or agents.
Original **568 Cargo archives / 618 index files / 103 missing archives / zero missing metadata** and `completeOfflineBuildCoverageQualified:false` remain unchanged.
No coding-prefix payload read/copy/refetch/repack/preparation replay, LLVM/Cargo/Docker/native compilation, GPU or training command is authorized; future host receive success would qualify only receipt/extraction, not build or training readiness.
Native65/Rust/model/F64/4,670 coordinates/existing tolerances/exact C12/CPU Flex/masters `101..105`/production recipes remain unchanged; BOTH/reference/orderly-close/R4/telemetry/coexistence stay unqualified, runtime/training entrypoints disabled and trainingReady:false.
ALL security/privacy/isolation hardening remains LAST after ALL planned training completes and results validate; no additional gates.

<a id="current-host-toolchain"></a>

##### Operator-reported alignment PASS — functional version facts accepted; grant CONSUMED

Executor directed **"the host needs to adjust to bun/rust versions set in this runtime"** after the failed bootstrap report.
Executor has selected **Align host Recommended** in distinct [host-toolchain-align-handoff-1/request.json](../_work/gpu-owner-recovery/runs/host-toolchain-align-handoff-1/request.json).
Its original **APPROVED_ONE_OPERATOR_ALIGNMENT_INVOCATION_NOT_YET_OBSERVED / operatorResultsReceived:false** fields stay pre-execution history; the newer report consumes alignment/install **1/1** and version queries **3/3** at report scope, **zero remaining**.
The [alignment proposal](../_work/gpu-owner-recovery/qualification/host-toolchain/plan.json) retains its **AWAITING/false** fields as preapproval history; the actual later request supplies approval without rewriting proposal or source-proof receipt.
Inspect-only and deferral remain unselected historical alternatives, not a repeated prompt.
The earlier inline COPY handoff is consumed history, not a command to repeat or a host-path assumption.
Its prior alignment packet is now confirmed pushed at **5c236ef…**; that publication grant is consumed too, no fresh receive/helper publication authority.
The report resolves the functional-version handoff; source work continued to [receive-2's exact combined HOST decision](#current-host-receive-run2), not reinstall/native-version-query replay, general planning or an assurance gate.
The [readiness contract](gpu-readiness.md#current-host-toolchain) and [owning sequence](gpu-host-receive.puml) give the exact fixed inline Fish command and bounds.

- Root [mise.toml](../mise.toml) stays unchanged: **core:bun 1.4.0 / core:rust 1.95.0**, minimal profile, **rustfmt/clippy/llvm-tools**, target **x86_64-unknown-linux-musl**, `auto_install` / `task.run_auto_install` false.
- Root digest guard binds **`d8f7c2e137514c6cd051fff8972bed14dd1039bc8d00454aa27db6add83168d7`**; package Bun and qualification Rust/Cargo pins agree and do not relax.
- Existing Mise is required; the only intentional install is **`mise install --jobs 1 core:bun@1.4.0 core:rust@1.95.0`**, including configured components/target and routine Rustup bootstrap if missing, not installation/upgrade of Mise.
- Three serial **`mise exec core:bun@1.4.0 core:rust@1.95.0 -- <tool> --version`** queries require exact Bun **1.4.0** and stable Rust/Cargo **1.95.0** tokens; each retains separate stdout/stderr/exit.
- Child `MISE_AUTO_INSTALL` / `MISE_EXEC_AUTO_INSTALL` / `MISE_TASK_RUN_AUTO_INSTALL` stay false; step stdin `/dev/null` stops untrusted configuration instead of auto-trusting. No `mise use/trust/settings/upgrade`, sudo, force/retry, config/auth setter or global default/PATH repair is included.
- Parent exclusively creates future metadata output outside the timed worker; **895s TERM + 5s KILL grace = 900s worker budget**; parent preserves **HOST_TOOLCHAIN_EXIT / command.exit** and per-step captures after timeout, not physical-containment assurance.
- GNU `df` requires HOME and repository available bytes >=**8 GiB** before install and observes afterward; ordinary preflight only, not complete tool-store-filesystem coverage, quota, storage-isolation or install-size assurance.
- Explicit child selection does not change global defaults or plain system `bun` outside Mise; a later receiver needs **fresh scope/run-2 using Mise context**, never replay of consumed bootstrap-1/receive-1.

The actual coding handoff directory contains **request.json**, **verify-handoff.ts** and **handoff-check.json**, covered by its bounded directory glob, not hypothetical host results.
Its **PASS_APPROVED_ALIGNMENT_COMMAND_RECORDS_ONLY** checks the fixed command SHA, 23 frozen source hashes and four diagram/index matches **before this correction**, not fresh verification of these edits, host installation/version queries or Fish parsing.
New coding-side [operator-paste.txt](../_work/gpu-owner-recovery/runs/host-toolchain-align-observation-1/operator-paste.txt), [observation.json](../_work/gpu-owner-recovery/runs/host-toolchain-align-observation-1/observation.json), [verify-report.ts](../_work/gpu-owner-recovery/runs/host-toolchain-align-observation-1/verify-report.ts) and [record-check.json](../_work/gpu-owner-recovery/runs/host-toolchain-align-observation-1/record-check.json) now record **PASS_OPERATOR_REPORTED_ALIGNMENT_RECORDS_ONLY**.
The paste reports **free-before/install/bun/rustc/cargo/free-after_EXIT=0**, **Bun 1.4.0**, **rustc 1.95.0 (59807616e 2026-04-14)**, **cargo 1.95.0 (f2d3ce0bd 2026-03-21)** and **PASS_HOST_TOOLCHAIN_ALIGNMENT_ONLY / HOST_TOOLCHAIN_EXIT=0**.
**functionalVersionFactsAccepted:true** accepts those host Mise-context facts at report scope; it proves neither independently available components/target, actual executed bytes/source identity nor individual stream boundaries.
Original host `runs/host-toolchain-align-1` files remain unreceived/uncovered; child selection establishes no global plain Bun switch or builder-image executable version. No reinstall/new native-version query or receiver/download/extraction grant remains, and no custody gate is added.
The historical [alignment source receipt](../_work/gpu-owner-recovery/runs/host-toolchain-align-source-1/receipt.json) is **PASS_HOST_TOOLCHAIN_ALIGNMENT_SOURCE_ONLY**, sourceChanged:false, **four stages PASS/exit 0**: **10/91 alignment**, **34/352 receiver regression**, strict new-project TypeScript and corrected report check; its old helper hashes do not qualify receive-2 changes.
Its retained [literal command](../_work/gpu-owner-recovery/runs/host-toolchain-align-source-1/host-command.fish) SHA is **`aff6b95234f47a031fa41f929922f3a05a0b3b8bdcb152c97c8886de281037e7`**; the source receipt's operatorExecutionApproved:false stays preapproval history, not current authority after the later request.
Local Fish syntax is **NOT_RUN_LOCALLY_HOST_PRECHECK_EMBEDDED**; old unconfigured shim/no `/usr/bin/fish` history stays unchanged, and the reported stages are not formal host Fish-parse PASS evidence.
Old receiver source-2 **34/352 + 89/438 + 37/280 + five types** remains separate, not fresh alignment transfer/qualification proof.

Executor reports architect **ses_e3b8133fcffefFIv2vv6VoYyeG** accepting minimal reuse/no framework, DevOps **ses_e3ec46b44ffe7CbnV5rwv23shT** READY for the install/verify TUI, adversarial **ses_e3b76f121ffeprkWd1uLezbJvD** no findings/READY and security **ses_e3cea2a12ffe9TMeXvXBhDE8n7** READY for scoped approval, not execution or extra assurance gates.
No host installation/native Rust query, receiver/asset/rootfs input download, native/image build, GPU or training operation occurred in coding.
Old requests/receipts/pins remain unchanged; receive-2 helper/source-4/prior alignment records and prepublication docs were published at latest SOURCE_ONLY push **98749410eda3dcadd7a210d3ddb1ac097a9ba13d**, source grant consumed.
Prior alignment push **5c236ef…**, run-1 helper **33b29dd…** and assets **f3e277d…** retain distinct roles; post-push records/command and this outcome documentation remain local, pending the later separately approved docs/evidence commit and push.
Actual CPU regression/GPU/backend/canonical BOTH/reference/close/R4/telemetry/coexistence remain unproved and **trainingReady:false** remains unchanged.
ALL security/privacy/isolation hardening remains AFTER **ALL planned training completes and results validate**, with no additional gates.

<a id="current-host-receive-run2"></a>

##### Historical receive-2 publication/handoff snapshot — before operator report and docs push

**Snapshot scope:** pending/unrun/local wording in this section predates the accepted receive-2 report and completed docs push **283897c**, not authority to repeat them.
The [current status](#current-host-build-inventory) records the list discrepancy, consumed grants and fresh inventory-only decision; original source proofs/requests/receipts stay immutable.

The lead continued source work until the exact HOST decision, not another implementation/planning fork.
Executor selected **Publish+receive 2 Recommended**; actual [handoff-2/request.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/request.json) now records **APPROVED_ONE_SOURCE_PUBLICATION_AND_ONE_OPERATOR_RECEIVE_RUN2 / sourcePublicationApproved:true / operatorReceiveApproved:true**.
The later [publication receipt](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/publication/publication.json) consumes source commit/push **1/1**; **ONE operator receive-2 invocation remains APPROVED_UNCONSUMED / UNRUN**.
[plan-run2.json](../_work/gpu-owner-recovery/qualification/host-receive/plan-run2.json), source-4 proposal false flags and the approved request retain their historical fields unchanged; they are not mutable consumption records.
The handoff-2 root now contains **request.json, stage-audit.json, publication/, host-command.fish, handoff.json, verify-handoff.ts and handoff-check.json**.
The request binds source-4 receipt SHA **`9a34af7785ff55ee1b52bb7c5d71a7297847d3a3a0a1d0cc49316f1c1fa71efd`** and helper **18,396 bytes / ac1cd8af…**, current source bytes/proof unchanged.
The [stage audit](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/stage-audit.json) records **65 controlled text files / 1,005,678 bytes / native65 / binaryOrCacheIncluded:false**.
Its `sourcePublicationPerformed:false` remains the precommit snapshot; the later PASS supersedes that pending state without editing the audit.
The lead completed **ONE top-level publish-run2.ts invocation**, normal hooks-enabled commit **1** and literal fixed-HTTPS OID push **1** within shared **600s**.
The source commit includes controlled source/spec/evidence and prior alignment records, excluding cache/binary payloads.
Actual publication records retain `publication.operation`, `publish-01..09` streams and `publication.json`.
The retained [verify-handoff.ts](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/verify-handoff.ts) produced [handoff-check.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/handoff-check.json), **PASS_PUBLISHED_MISE_RUN2_HANDOFF_RECORDS_ONLY**, with **329 committed source hashes / four ordered diagram-index matches**.
Those matches describe the pre-correction check, not fresh acceptance of this correction or host execution; this pass reruns no checker.
Source-4's 329-source proof excludes docs and remains unchanged.

| Actual publication outcome | Recorded value |
|---|---|
| Scope/result | **SOURCE_ONLY / PASS / failure:null / commitSucceeded:true / elapsedMs:5045.911266** |
| Source/pushed commit | Both **`98749410eda3dcadd7a210d3ddb1ac097a9ba13d`** |
| Mutation attempts | **commit 1 / push 1 / createRelease 0 / upload 0 / commitManifest 0** |
| Checks | **validateFrozen 3 / checkTransport 2 / checkOrigin 6 / checkIdentity 1**, all recorded operations PASS |
| Source-only fields | `releaseId:null`, `releaseDraft:null`, `assets:[]`, `uploadedAssets:[]`, `verifiedAssets:[]` |
| Non-results | `actualHostExecuted:false`, `cudaGpuCodeExecuted:false`, `trainingReady:false` |

The null/empty release fields describe **SOURCE_ONLY**, not missing or republished historical DRAFT assets.
No tag/release/manifest/upload operation, cache payload read or coding acquisition occurred in this publication.
After hooks and post-push, PASS callbacks checked all **329 raw committed source-4 blobs** with lazy fetch off and **native65 equal original preparation** before generating the literal command.

Parent NEXT delivers [host-command.fish](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/host-command.fish) **literal contents for COPY into host Fish at repository root**, then waits **only for HOST output verification**.
The command was generated **AFTER** checked push and is **not in the helper commit**; do not tell the operator to run an assumed already-present host file.
Generated [handoff.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/handoff.json) records **READY_FOR_ONE_APPROVED_MISE_OPERATOR_RECEIVE_RUN2 / hostExecuted:false / trainingReady:false**.
It binds contents ref/helperCommit **98749410eda3dcadd7a210d3ddb1ac097a9ba13d**, source-4 SHA **9a34af…** and command SHA **`f0feb2c81df00e635e920ad55fd24396305b323a99e5ca87302bf545bf19e95b`**.
Expected **future** receipt: `_work/gpu-owner-recovery/runs/host-input-receive-2/receipt.json`, status **PASS_HOST_RECEIVE_AND_EXTRACT_ONLY**, not a received host PASS.
Post-push records/command and this outcome documentation stay **LOCAL_UNCOMMITTED**.
The helper-source grant remains **CONSUMED 1/1**, with no additional publication authorized under that request.
Executor's later explicit **"commit & push"** separately approves publishing current post-push outcome/spec/command records only; that docs/evidence publication remains pending, not a helper-source rerun.
Executor identifies the pending set as **seven `_spec` docs/index files plus 24 controlled-text outcome files**, with no implementation/product change.
Helper/source code and helper-source OID **98749410eda3dcadd7a210d3ddb1ac097a9ba13d** stay fixed after a later docs/evidence commit; this document invents no future commit OID or self-containing commit requirement.
The later publication approval adds no receive/install/release/asset/native/build/GPU/training or rerun authority; operator receive-2 stays separately APPROVED_UNCONSUMED/unobserved.
Inspect/defer remain unselected history; no repeated planning/approval question or new proof gate follows.
The [readiness packet](gpu-readiness.md#current-host-receive-run2) and [owning sequence](gpu-host-receive.puml) bind the exact source-only publication and per-run path contract.

- Coding publication, **PASS/CONSUMED**: **ONE normal hooks-enabled commit / ONE literal fixed-HTTPS commit-OID push / shared 600s**, existing private identity/origin/auth/transport checks, same counters and no automatic retry; zero remaining.
- Later docs/evidence publication, **separately APPROVED / PENDING**: Executor's explicit **"commit & push"** covers current post-push outcome/spec/command records only, not helper/code changes, a new helper OID or operational replay.
- [publish-run2.ts](../_work/gpu-owner-recovery/qualification/host-receive/publish-run2.ts) validates actual exact approved version/status, safe proof revision **>=3** including **10/29/30**, receipt SHA, helper identity and exact source/operator limits; checks current source hashes/raw committed blobs with lazy fetch off and original preparation's exact native65 metadata.
- [transfer/publish.ts](../_work/gpu-owner-recovery/qualification/transfer/publish.ts) admits `sourceOnly:true` only at `runs/host-input-receive-handoff-2/publication`, now actual evidence; skip bundle validation/payload reads and return after **post-push frozen check before manifest/tag/release/upload**. Assets/DRAFT/original preparation stay unchanged, no repack or acquisition.
- Checked source push generated the literal using **98749410eda3dcadd7a210d3ddb1ac097a9ba13d**, not old 33b29dd… or a zero-OID template.
- Approved operator scope, UNRUN: **ONE receive-2 invocation**, worker **895s TERM + 5s KILL grace = 900s**, helper **55s + 5s <=60s**, helper GET 1/assets 2/extraction 1; fresh cache/host-receive-2, bootstrap-2 and receive-2 paths, old run-1/alignment directories never deleted/reused.
- Closed `selectReceivePaths` accepts grants 1/2 only; all main artifact labels, receipt fields and stdout paths use that selection, while asset/numeric receivePlan and receive(io) remain unchanged. Legacy renderHostReceive still reproduces exact old **8def4344…** literal; new renderHostReceive2 owns the new grant/paths/context.
- Set **all three Mise auto-install flags false BEFORE** `mise exec core:bun@1.4.0 core:rust@1.95.0 -- fish --no-config -c program < /dev/null`; host fish -n precedes helper GET. Both Bun guard and helper share the pinned context, no install/Rust-Cargo query/global PATH/trust/settings/config/auth change.
- Parent saves worker stdout/stderr and exit even if Mise fails before the body. Manifest-first asset-ID downloads retain exact bytes/SHA and shared **600s**; listing/one extraction/hash retain shared **180s** within outer **900s**, >=8 GiB free/8 GiB soft/context <=3 GiB, not quota/storage-isolation assurance.

Current [source-4](../_work/gpu-owner-recovery/runs/host-input-receive-source-4/receipt.json): **PASS_HOST_RECEIVE_SOURCE_ONLY**, failure:null/sourceChanged:false, **329 sources**, **40 receiver tests / 410 assertions + 91 transfer / 453 + 37 qualification / 280 + five types**, eight stages PASS/exit 0.
Current helper: **18,396 bytes / SHA `ac1cd8afdf8332917d153e871d9400fec1e926eaa4a2380265df646c3f53b6f2`**.
[Source-3](../_work/gpu-owner-recovery/runs/host-input-receive-source-3/receipt.json) **40/407** is history before the numeric revision regex LOW fix; old source-2/318, alignment source-1 and DRAFT source-6 remain immutable snapshots, not current modified-helper proof.
Local Fish syntax remains **NOT RUN**, not a new host syntax PASS; no publication/auth query/acquisition/Cargo/LLVM/Docker/native build/host/GPU/training operation occurred in coding checks.
Executor reports accepted architect/DevOps fresh-host-decision plan, adversarial **ses_e3a0074baffeSZU9bZbE1aaeb3** LOW fixed/current recheck and security **ses_e3cea2a12ffe9TMeXvXBhDE8n7** no scoped findings/READY to that decision, not execution.
Bounded **handoff-2/** coverage includes actual audit/publication/command/handoff records and verify-handoff.ts/handoff-check.json; future host bootstrap-2/receive-2/cache-2 outputs remain unreceived and uncovered, no operator execution in coding.
Original asset source **f3e277d…**, release **439935095**, manifest **730048215** and bundle **730047564** stay unchanged; no coding asset payload read/mutation, new install/native query/global config/auth change/retry/release/upload/build/GPU/training is authorized.
Latest helper-source commit/push remains **98749410eda3dcadd7a210d3ddb1ac097a9ba13d** under the now-spent helper-source grant, independent of later docs/evidence publication; prior alignment **5c236ef…**, old helper **33b29dd…** and assets **f3e277d…** retain distinct roles, no origin fetch needed.
Native65/Rust/model/F64/4,670 coordinates/`eps=1e-6`/`atol=1e-8`/`rtol=1e-5`/exact C12/CPU Flex/masters `101..105`/production Dockerfiles remain unchanged; canonical BOTH/reference/close/R4/telemetry/coexistence unqualified, entrypoints disabled, **trainingReady:false**.
ALL security/privacy/isolation hardening remains AFTER **ALL planned training completes and results validate**, no extra gates or template fetch.

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
Original pre-handoff/earlier publication identities remain historical; earlier docs push **cca45f6b2978398f68d0db1a84119e1b5a3c0ee2**, run-1 helper **33b29dd…**, assets **f3e277d…** and latest prior-alignment push **5c236ef…** remain distinct. Actual operator-executed identities remain independently unestablished, no new custody gate.
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
