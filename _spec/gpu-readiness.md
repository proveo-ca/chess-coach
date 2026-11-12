# Mandatory GPU learning readiness

## CURRENT priority amendment — 2026-11-09

The [canonical training-first roadmap](gate-closure.md#current-precedence-amendment--accepted-2026-11-09) and [functional readiness checklist](readiness.md#current-precedence--training-functional-readiness-2026-11-09) take precedence over mixed full-assurance prerequisites below.
Real F64 GPU feasibility, all 4,670 coordinates/tolerances, exact C12 scoring/backward/SGD/reload, unchanged CPU Flex/master initialization and cooperative ceilings/coexistence on the host's reported in-use 8 GB GPU remain functional requirements.
ALL security/privacy/isolation, custody/provenance and strict stop/escape/crash qualification follow the completed planned training phase and validated results; do not restore them through runtime-closure, observer or cleanup wording below.
Ordinary bounded execution, truthful output evidence and existing functional correctness tests remain.
This plan disables no configuration.
CPU fallback remains excluded; actual GPU work stays outside the coding sandbox.
The retained status/evidence below change neither the reported 0/3 diagnostics, absent binding, full-pipeline halt nor `trainingReady:false`.
This amendment renews no execution, acquisition, installation, runtime-change or training grant.

<a id="current-host-build-inventory"></a>

## CURRENT 2026-11-11 — HOST2 reported native-build PASS/consumed; GPU feasibility preparation pending

The full [receive-2 paste](../_work/gpu-owner-recovery/runs/host-input-receive-observation-2/operator-paste.txt) reports **PASS_HOST_RECEIVE_AND_EXTRACT_ONLY**, `FETCH_EXIT=0`, `HELPER_HASH_VERIFIED`, `RECEIVE_EXIT=0` and `HOST_COMMAND_EXIT=0` in **9,074.734218 ms**.
The [observation](../_work/gpu-owner-recovery/runs/host-input-receive-observation-2/observation.json) accepts functional receive/extraction facts and closes the operator allowance **1/1 CONSUMED, zero remaining, no retries**.
Reported attempts are **2 downloads / 1 listing / 1 extraction / 1 verification** against the fixed asset IDs/digests and DRAFT **439935095** at asset source **f3e277d…**, using helper **9874941… / ac1cd8af… / 18,396 bytes**.
Reported context is **429,218,730 bytes / 3,800 files / 137 recorded directories / 2 links / native65**, native-manifest SHA **`9141aaefa2fab3f3a812aeabec4bdfdd818415333f9e5cba6d5ef822dac90863`**.

**Exact missing-list equality is FALSE:** the reported **`ntapi@0.3.1`** differs from prepared **`ntapi@0.4.3`**, exactly one entry among **103 missing archives**, with **zero missing metadata**.
The [initial checker FAIL](../_work/gpu-owner-recovery/runs/host-input-receive-observation-2/initial-check-failure.json) remains retained.
The later [scoped check](../_work/gpu-owner-recovery/runs/host-input-receive-observation-2/record-check.json) is **PASS_OPERATOR_REPORTED_RECEIVE2_RECORDS_WITH_LIST_DISCREPANCY**, validating reported lineage/context/assets and eight artifact metadata records, not exact-list PASS or original host bytes.
`reported-receipt.json` copies the paste; original host files and independently verified actual operator command bytes remain unreceived, and no host artefact bytes were read or rehashed in coding.
The discrepancy's cause is unknown; it establishes neither asset corruption nor retry/reacquisition authority and does not invalidate report-scope metadata acceptance.
Offline-build completeness remains false; no compilation, LLVM/Cargo, GPU or training result follows.

The [HOST inventory-1 observation](../_work/gpu-owner-recovery/runs/host-build-inventory-observation-1/observation.json) now reports **FAIL_METADATA_ONLY / QUERY_NONZERO:selected-builder**, query exits **[0,0,125]**, outer exit **1**, and consumes HOST1 **1/1 / zero remaining / no retry**.
The first two reported queries identify `default` / `unix:///var/run/docker.sock`, without a `DOCKER_HOST` override; query 3 reports stdout **0 bytes**, stderr **118 bytes**, SHA **`efc09f33c161340d92b67de0d7b3cdf5b7e414f3730315c879d9bfedcacb2353`**.
The [scoped record check](../_work/gpu-owner-recovery/runs/host-build-inventory-observation-1/record-check.json) is **PASS_OPERATOR_REPORTED_FAILED_INVENTORY_RECORDS_ONLY**, not metadata PASS; original HOST files and stderr text remain unreceived, exact HOST diagnostic **UNKNOWN**.
The supplied official CLI/source references independently establish the **source defect: `docker buildx inspect` has no `--format` option**; they do not establish an unknown-flag HOST message, absent Buildx or installation need.

[gpu-host-build-inventory.puml](gpu-host-build-inventory.puml) owns the retained corrected inventory contract; plan2/proposal/proof/review false flags and original handoff-2 approval fields remain unchanged historical snapshots, not replay authority after the accepted report consumes HOST2.
Query 3 now uses **only `docker buildx inspect`**, without flags/bootstrap/fallback/retry; `parseBuilderInspect` reads raw column-zero headers/node fields, ignores indented CDI/label names **before trimming**, supports CRLF/error/stopped/multiple/empty-node states and rejects ambiguous duplicate/malformed fields.
Builder/node errors retain **SKIPPED_BUILDER_REPORTED_ERROR** without another container query/setup; other supported Docker `--format` calls remain unchanged.
The attributed [fixture](../_work/gpu-owner-recovery/qualification/host-build-inventory/fixtures/buildx-inspect.json) is **DOCS_DERIVED_TEST_FIXTURES_NOT_HOST_EVIDENCE**; mocks now reject the invalid legacy flag with exit 125 instead of returning invented JSON.

The [inventory-2 observation](../_work/gpu-owner-recovery/runs/host-build-inventory-observation-2/observation.json) accepts **PASS_METADATA_ONLY / eight query exits 0 / HOST_BUILD_INVENTORY_EXIT=0** at report scope; HOST2 allowance **1/1 CONSUMED / zero remaining / no retries**.
Its provenance is **SEMANTICALLY_NORMALIZED_COMPLETE_OPERATOR_JSON_AND_SUMMARY_NOT_ORIGINAL_HOST_BYTES**: complete structured operator JSON is semantically normalized in format, **not a raw original-stream copy**.
The [record check](../_work/gpu-owner-recovery/runs/host-build-inventory-observation-2/record-check.json) is **PASS_OPERATOR_REPORTED_INVENTORY2_RECORDS_ONLY**, accepting eight exit facts and **16 capture metadata rows**, not original-file byte hashes or independently verified actual command bytes.
Reported local default/Unix Docker endpoint uses shared builder **proveo-multiarch / docker-container / proveo-multiarch0 running**, existing shared CID **672c2d1a…**; `NanoCpus/CpuQuota/CpuPeriod/Memory/MemorySwap` are all **0**, bridge network, empty cgroup parent. **Leave that shared builder untouched**; zero values establish neither finite bounds nor modification/stop authority.
Reported Engine **29.9.2 / 16 CPU / MemTotal 41,706,151,936 bytes / systemd cgroup v2**; exact pinned Rust/Bun images appear in Engine metadata, linux/amd64, sizes **2,191,335,435 / 309,607,108 bytes**. Host **MemAvailable 27,194,428 KiB (~25.9 GiB)** and **available disk 168,915,672 KiB (~161 GiB)** are snapshots, not reservations, BuildKit-store/offline-image or executable-usability proof; no bad-image inference or custody gate follows a repeated image digest.
Retained source4 [publication result](#current-gpu-feasibility) records **PASS /250d438685d2fc7560b0e31439f282bb2c145888 /feat-ml-adjuntant-ii /244 text entries /one normal commit +one fixed HTTPS push CONSUMED0**. Publication-result/actions are separate post-publication LOCAL_UNCOMMITTED metadata, as are the new feasibility observation/docs at that generation; no fresh Git grant follows. [Current source3 publication](#current-gpu-full-source-preparation) records the later3d351 commit separately. Older25bc/corrected-source-cache-reuse428 entries/8 SOURCE links and prior65feb/435/425 publications/precommit audits retain their historical generations; helper9874941/assetsf3e277d/frozen327 and old307 source proofs stay unchanged. The known whole-index whitespace **FAIL** retains its **one RAW red stderr source excerpt**; scoped PASS does not establish whole-index PASS.
Inventory-source-5 **298 hashes / 34 tests / 302 assertions + 37/280 qualification + four types**, command **078a6ae2…/14,816 bytes** and proof **d2d049b0…** remain inventory-only snapshots, **not verification of the new build source**; source-4/source-3/old requests/all failure records remain immutable.

<a id="current-host-native-build"></a>

### OPERATOR_REPORTED_PASS_NATIVE_BUILD_ONLY_CONSUMED — separate GPU feasibility pair reported PASS/consumed

The [HOST2 reported receipt](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/reported-receipt.json), [summary](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/operator-summary.txt) and [observation](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/observation.json) report **PASS_HOST_GPU_NATIVE_BUILD_ONLY /failure:null**, inner **PASS_NATIVE_COMPILATION_ONLY**, and **HOST_NATIVE_BUILD_EXIT=0**. Accept native-build-only PASS at report scope; **HOST2 CONSUMED1/1 /remaining0 /no retry**, not full GPU qualification/training readiness. [Current reuse status](#current-host-build-reuse) owns that report; the separate [current GPU feasibility report](#current-gpu-feasibility) now accepts the exact pair's functional PASS and consumes its own HOST1 allowance to0, never renewing build2 authority.

#### Build1 retained failure — HISTORICAL, not the HOST2 outcome

The [complete reported receipt](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-1/reported-receipt.json), [operator summary](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-1/operator-summary.txt) and [separate observation](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-1/observation.json) report **outer `FAIL_HOST_GPU_NATIVE_BUILD_ONLY / SUCCESSFUL_NATIVE_COMPILATION_RECEIPT_REQUIRED`**, **inner `FAIL_NATIVE_COMPILATION_ONLY / NATIVE_COMMAND_FAILED:gpu-policy`**, and **`HOST_NATIVE_BUILD_EXIT=1`**. This consumes **build1 ONLY /1/1 /zero remaining /no retry**; its issued request's remaining-1/unobserved fields stay immutable. The later separate HOST2 report above also consumes its own grant without changing build1's failure.

That failure observation's provenance is **`SEMANTICALLY_NORMALIZED_COMPLETE_OPERATOR_JSON_AND_SUMMARY_NOT_ORIGINAL_HOST_BYTES`**. Its cause-unknown fields remain an immutable **PRE-DIAGNOSTIC snapshot**; link the later diagnostic below instead of editing those records. Original HOST files/full capture bytes remain unreceived and un-rehashed here. Retained [record-check-2](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-1/record-check-2.json) is **`PASS_OPERATOR_REPORTED_FAILED_NATIVE_BUILD_RECORDS_ONLY`**, **7 sources /9 complete owned-CID Docker argv /28 capture metadata rows**; [typecheck-2](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-1/typecheck-2.json) is **PASS**. Initial checks remain **PRE_REVIEW_CHECKER_SOURCE_CHANGED_NOT_CURRENT_ACCEPTANCE**; records-only adversarial recheck **ses_e3849d24fffeF9A2jxyE1zKENR** closed the incomplete-argv MEDIUM. None verifies the new correction or original HOST bytes; no custody/hardening gate follows.

| Reported native step | Outcome |
|---|---|
| Bun property/startup | **1.4.0 PASS**; not a sixth supervised command |
| Rust/Cargo/LLVM guards | **1.95.0 /1.95.0 /23.1.0**, three native guard commands **PASS /exit 0** |
| `gpu-learning`, `finite_difference --no-run` | **PASS /exit 0**, retain this partial compilation success |
| `gpu-policy`, `gpu --no-run` | **FAIL /exit 101**; later compiler-text paste reports **E0277**, not a repaired build |

Reported native work took **921,820.616072 ms**; outer work took **923,501.887534 ms (~15m23.5s)**. Staging used **99,444,545 bytes /1,253 files**, with **2 compilation attempts /5 native results**; all five have empty **captureFailures/canonicalCopyFailures**. Reported source check is **sourceStabilityChecked:true /sourceChanged:false /sourceCheckFailure:null**, manifest **`9141aaefa2fab3f3a812aeabec4bdfdd818415333f9e5cba6d5ef822dac90863`**.

All **nine fixed Docker operations report PASS /exit 0**, including worker-stop/state/worker-remove/donor-remove; **cleanupFailures:[]**, no kill needed. Reported terminal state is **Running:false /ExitCode:1 /OOMKilled:false**; it does **not identify the failure cause**. Artifact admission was not reached, **artifacts:[]**. Successful Docker/log-follow/cleanup and the learning compilation do not promote the overall failed build or prove offline coverage complete.

Actual native compilation ran **ONLY inside the approved OPERATOR container**: reported **2 CPU /8 GiB /no extra swap /network none /pull never /uid:gid 1000:1000**. No native execution occurred in coding; no project test binary, GPU device/test, training or qualification-image build ran. Binding **13000** remains an **unqualified trial**. Shared BuildKit stays untouched; this establishes no effective security/privacy/isolation-hardening assurance PASS.

<a id="current-policy-record-correction"></a>

#### Reported compiler text — diagnostic received, no native-build PASS

The new [operator-diagnostic.txt](../_work/gpu-owner-recovery/runs/host-gpu-policy-record-diagnostic-1/operator-diagnostic.txt) faithfully preserves the available saved-log extraction paste: policy stderr plus the rendered Cargo error, **`ERROR_RECORDS=1`**. Its [separate observation](../_work/gpu-owner-recovery/runs/host-gpu-policy-record-diagnostic-1/observation.json) records **`USER_PASTED_DIAGNOSTIC_TEXT_NOT_ORIGINAL_HOST_CAPTURE_BYTES`**. Reported **E0277** identifies **`crates/policy-io/tests/gpu.rs:345:30`**, where **`fs::write(&record_path, &record).unwrap();`** passes `burn::tensor::Bytes` without the required **`AsRef<[u8]>`**; the compiler suggests **`&*record`**. Accept this compiler-text fact without a custody gauntlet; the old outer rejection guard/state alone did not identify it.

**No `POLICY_DIAGNOSTIC_READ_EXIT` marker was pasted.** The full original **334,214-byte stdout**, original HOST capture bytes and independent HOST digest rehash remain absent. These limits neither invalidate the supplied diagnostic nor require a new capture before source-only correction. They establish no extraction-command success, full-capture proof, build PASS or renewed read/build/staging/native-query/GPU/training/install/acquisition/Git authority. Earlier cause-unknown metadata and all original failure/source proofs remain byte-unchanged history.

The original expected capture metadata stays historical, not independently verified by the pasted text:

| Existing HOST path under `_work/gpu-owner-recovery/runs/host-gpu-native-build-1/native/gpu-policy/` | Reported bytes /SHA-256 |
|---|---|
| `command.stderr` | **1,919 /`af41c7f5a3f964c289f6ce2a6dc3489e7fc481bab06beaf00be524844c20ab4a`** |
| `command.stdout` | **334,214 /`28819440f6b1ef9b57a061d80197274dd92853649bc1b1fbecb7fce724683ff1`** |

#### Current one-line source correction — verified SOURCE ONLY

Architect **ses_e36f4b6d9ffeCMclo9ifqwusMu** was consulted **before** implementation and accepted the exact one-line correction. The [captured red regression](../_work/gpu-owner-recovery/runs/host-gpu-policy-record-diagnostic-1/red-regression.json) records **PASS_EXPECTED_RED_STATIC_RECORD_REGRESSION /exit 1**, reported **3 pass /1 fail**. The sole native-source edit then changed line345 to **`fs::write(&record_path, &*record).unwrap();`** inside **`cuda_f64_policy_channel_subprocesses_agree_and_reload`**. This borrows underlying `[u8]`, preserves the record owner/serialized bytes, and performs no clone/reserialization or semantic change. The later consumed HOST2 report accepts compilation of the existing ignored test, **not its execution or remaining authority**; Rust harness counts/recipes/qualification runner/existing host drivers/supervisors stay unchanged.

Actual [correction.ts](../_work/gpu-owner-recovery/qualification/policy-record-fix/correction.ts), [verify.ts](../_work/gpu-owner-recovery/qualification/policy-record-fix/verify.ts), [gpu-policy-record.test.ts](../packages/runtime/tests/gpu-policy-record.test.ts) and [tsconfig.json](../_work/gpu-owner-recovery/qualification/policy-record-fix/tsconfig.json) own the exact scoped delta/static proof. Historical [correction-source-1 receipt](../_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-1/receipt.json) remains **FAIL_POLICY_RECORD_SOURCE_CORRECTION_ONLY /SOURCE_CHECK_FAILED:types-1**: the new static test used ES2023 **toReversed** under project ES2022. The fixture now uses **`[...corrected].reverse()`**; retain that failed receipt/raw captures unchanged.

Fresh [correction-source-2 receipt](../_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/receipt.json) records **PASS_POLICY_RECORD_SOURCE_CORRECTION_ONLY /291 frozen hashes /sourceChanged:false /eight PASS stages**: bounded baseline Git show, **41 tests /296 assertions** (**4 record regressions +37 existing qualification**), **162 pure-mock lifecycle/unit tests /8,133 assertions** with **3 persisted MOCK e2e**, and **5 TypeScript checks**. Scope is **BUN_STATIC_ASSERTIONS_MOCKED_LIFECYCLE_AND_TYPES_NOT_NATIVE_COMPILATION**, not Rust/CUDA/LLVM/test-binary/Docker/GPU execution or native-build PASS.

The proof binds baseline Git show at **65febc83b9ab6e043b233f03d390d6b262538118** to the original prepared native entry and exact **old.replace(incorrectLine, correctedLine)** inside the named function. Original prepared sourceInventory **metadata only** supplies the baseline: **65 members unchanged /64 hashes unchanged /ONLY crates/policy-io/tests/gpu.rs changed**, old source-5 **other 282 of 283 inputs equal**. Actual new [native-source-manifest.json](../_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/native-source-manifest.json) SHA is **`7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec`**. Original **9141…** manifests/received contexts/requests/source-1..5/host-build plan stay immutable; the new generation makes the **original build command NOT reusable**. Old guards correctly reject **PREPARED_NATIVE_GENERATION_CHANGED**; do not rerun, rewrite or loosen them to accept new bytes.

Executor reports correction-source-2 **backend ses_e36f4b6cbffdofbGVKAUJzfiBO READY/no findings**, **adversarial ses_e36e97fdfffeVGF6ZBu1ANNkto READY/no findings**, and **security ses_e3845fff1ffeE092hXAV6pfhiW READY/source-only/low/no findings/no new hardening gate**. These scopes remain accepted for the one-line correction; they do not verify the additive adapter. Its separate fresh source proof/review scopes appear below; this docs pass reruns no source checker.

#### Retained strategy selection — source planning only, later HOST2 grant consumed

Executor previously selected **Reuse cache Recommended**; [selection.json](../_work/gpu-owner-recovery/qualification/host-build-reuse/selection.json) keeps **sourcePreparationSelected:true /operational flags false** as an immutable source-planning snapshot. The later separate **Approve+push** HOST2/publication grant is now **CONSUMED**, without rewriting that selection or any proof/proposal. Do not re-ask the old cache strategy or treat it as GPU-feasibility approval.

<a id="current-host-build-reuse"></a>

#### CURRENT — operator-reported HOST2 native-build PASS; both grants consumed

[gpu-host-build-reuse.puml](gpu-host-build-reuse.puml) owns the actual **host-gpu-native-build-observation-2/** root, including complete semantically normalized receipt/summary/observation and **contract.ts /verify-report.ts /verify-report.test.ts**. Actual [verification.json](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/verification.json) now records **PASS_BUILD_TWO_OBSERVATION_VERIFICATION_ONLY /three PASS stages**: **17 Bun record/mutation tests /19 assertions**, **one strict TypeScript check**, and current [record-check.json](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/record-check.json) **PASS_OPERATOR_REPORTED_NATIVE_BUILD_TWO_RECORDS_ONLY**. The checker binds **10 local input hashes /five reported native argv /five COMPLETE reported owned-CID Docker argv /20 capture metadata rows /five artifact metadata entries**. Raw local verification streams remain under **observation-2/verification/**. Pure imported builders construct argv strings only, without calling old main/native/HOST operations.

Actual [review.json](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/review.json) records architect **ses_e36783826ffetiRNpE54VUigWv**'s records-now/source-planning-before-wrapper boundary, DevOps **ses_e384ffa7bffecNc429YDN25STS**'s SOURCE-ONLY runtime/headroom advice, adversarial **ses_e36649e3affeJjY53mEb5Dxjo5 READY_TO_MERGE_YES**, and security **ses_e3845fff1ffeE092hXAV6pfhiW**'s **no serialization/authority-overclaim findings /risk low /no additional hardening gate**. Acceptance remains **records and source-planning decision ONLY**, not operational approval.

Provenance remains **SEMANTICALLY_NORMALIZED_COMPLETE_OPERATOR_JSON_AND_SUMMARY_NOT_ORIGINAL_HOST_BYTES**. Original HOST files/logs/binaries remain unreceived, artifact hashes remain **reported, not independently rehashed**, and actual operator command bytes remain independently unverified. Local verification streams are not original HOST logs or GPU/native evidence. These limits do not invalidate functional report acceptance or add a custody gauntlet.

The initial [final-records-and-docs-check.json](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/final-records-and-docs-check.json) records **PASS_NATIVE_BUILD_TWO_REPORTED_RECORDS_AND_DOCS_ONLY** for **PRE_CLOSEOUT_DOCS_GENERATION**: **10 doc hashes /7 ordered diagram-index matches /1 observation owner /307 protected source hashes /10 record input hashes /6 local verification stream hashes**. The later [closeout-records-and-docs-check.json](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/closeout-records-and-docs-check.json) records **PASS_NATIVE_BUILD_TWO_REPORTED_RECORDS_AND_DOCS_CLOSEOUT_ONLY**, binding corrected ten-doc wording/record proofs **before GPU wrapper implementation**. [docs-closeout-review.json](../_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/docs-closeout-review.json) closes the HIGH unconsumed-inventory and MEDIUM stale-check findings with **READY_TO_MERGE_YES**, accepting the **5,465-byte /SHA13dfd22ca6403277689316cec2b352edb434727672578fd3a49663025bb494e3** receipt. Build2 report-only closeout is complete for that historical generation, not original HOST-byte rehash/GPU proof. Source-4 [final-docs-and-source-check.json](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/final-docs-and-source-check.json) PASS bound the generation before the three-passage history fix: **11 docs /8 ordered index matches /327 sources /65 native members /24 evidence hashes /7 metadata inputs /3 Git captures /HEAD25bc /scoped diff PASS**. Later check-2 PASS/docs-closeout READY completed that fix before authority issuance. Every check/review retains its generation, not current-report wording verification; subsequent publication250d and the new feasibility report consume both allowances to0. Source-only proof/command/original false fields stay unchanged. Fresh current-doc/index/hash/HEAD-diff check and final DOCS review remain future work.

At the pre-implementation records checkpoint, the parent confirmed **HEAD25bcfb61ddde6849d10e61536266b5e2f50c5598**, then observed only **ten docs +observation-2 uncommitted**, and reported **git diff --check -- _spec PASS**. Those observations are **not fields of the consistency receipt or a current workspace count after feasibility implementation**. Native7e graph65/protected307 inputs remain unchanged; the new source proof below has its own generation.

Reported **Bun1.4 property**, **three Rust/Cargo1.95 /LLVM23.1 guards** and **BOTH learning/policy `gpu-prepared-llvm --no-run` compilations** pass, **five native commands /exit0**. Source is **checked:true /changed:false /checkFailure:null**, corrected manifest **7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec** paired with previous **9141aaefa2fab3f3a812aeabec4bdfdd818415333f9e5cba6d5ef822dac90863**. Staging **663,642 bytes /66 files**, **copiedCargoCache:false /retainedCachesWritable:true**; native **16,200.1312 ms**, outer **18,384.74729 ms (~18.4s)**. The receipt reports exact sizes/hashes for **five artifacts /769,483,104 bytes**; no actual binary files were received in coding.

All **five normal Docker create/start/logs/state/remove operations report exit0**, **cleanupFailures:[]**; owned worker **df7a70975f260ebe1c10944439e030dce200cc246302c83db859df36815eccfe** was reported removed with **exited /Running:false /ExitCode:0 /OOMKilled:false**. The shared builder and original failed source/evidence remain preserved; only the old Cargo-home/target RW cache contents could change under that consumed grant, Bun stayed RO. No project test binary, GPU/kernel JIT, qualification image or training executed; dispatch stays disabled and **trainingReady:false**.

The original [handoff-2/request.json](../_work/gpu-owner-recovery/runs/host-gpu-build-handoff-2/request.json) **remaining1/unobserved** and source-3 proof/proposal false fields remain immutable issued/pre-approval snapshots. Separate observation consumes **HOST2 1/1 /remaining0**; source-3 stays **307-input SOURCE-ONLY proof**, not retroactive native/GPU evidence. Publication25bc and its old grant remain consumed. Later source4 publication250d and the separate GPU feasibility report below also consume their own grants to0; no old request is live authority or renewed. Current observation/docs/post-publication metadata remain **LOCAL_UNCOMMITTED**; those consumed grants supply no fresh authority. The separate [source4 full2 HOST-only approval](#current-gpu-full-source-preparation) renews none of them and leaves delivery/publication unapproved.

<a id="current-gpu-feasibility"></a>

**REPORTED_PAIR_PASS_CONSUMED.** [gpu-feasibility.puml](gpu-feasibility.puml) alone owns actual **host-gpu-feasibility-observation-1/**. Its normalized [receipt](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-observation-1/reported-receipt.json), [summary](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-observation-1/operator-summary.txt) and [observation](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-observation-1/observation.json) retain reported **PASS_HOST_GPU_FEASIBILITY_ONLY +PASS_GPU_FEASIBILITY_TESTS_ONLY +HOST_GPU_FEASIBILITY_EXIT=0**. Functional REPORT acceptance/consumed0 stays unchanged. The separate [full-source-only PASS](#current-gpu-full-source-preparation) below is not full GPU numerical/C12/CPU39/BOTH/reference/close/R4/training evidence or execution approval.

Reported **cuda_f64_nonzero_native_scores_round_trip** and **cuda_f64_direct_sgd_changes_policy_parameters** each have **exit0 /1 passed /0 failed /0 ignored**, durations **0.81s /1.55s**, covering score/record roundtrip and direct-SGD/backward/reload. Source is **checked:true /changed:false /sourceCheckFailure:null /manifest7e**, all five artifacts admitted with expected path/size/SHA metadata. **guardComplete:true**, two same-container UUID **GPU-713c95e0-6952-a576-794b-9ef1fb527ff0** CSV queries PASS0, **8 GiB total /7740 and7582 MiB free**, satisfy the reported ordinary **3/2 GiB /2s query-start /1s query /4s-age** profile. Five COMPLETE Docker argv report PASS0; owned worker removed, **exited0 /OOMKilled:false /cleanupFailures:[]**, inner **3407.88992ms**, outer **4514.140361ms**.

Actual observation-1 [verification.json](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-observation-1/verification.json) records **PASS_GPU_FEASIBILITY_OBSERVATION_RECORDS_ONLY /three stages /26 Bun record-mutation tests /28 assertions /one strict TSC** plus [record-check.json](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-observation-1/record-check.json) **PASS_OPERATOR_REPORTED_GPU_F64_FEASIBILITY_RECORDS_ONLY**. It checks **12 local input hashes /327 frozen source4 hashes /2 test argv /2 query argv /5 COMPLETE Docker argv /28 capture metadata rows /18 unique paths /5 artifact metadata rows**. It models only **two reported scalar samples through the pure guard**; it does not receive/verify original raw CSV or replay the journal. Journal **8 events /1476 bytes /SHAb7cf001762c0080b757f56aae50823bce66fd7629b218b6600d039b7e3caa17d** is **METADATA ONLY**. Original HOST files/artifact bytes remain unreceived/not rehashed in coding; actual operator command bytes independently unverified, **operatorSourceCommit:null**. These limits do not invalidate functional report acceptance or add a custody gauntlet; no cold-JIT/full telemetry/strict-stop/full-assurance PASS follows.

Actual observation-1 [review.json](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-observation-1/review.json) records adversarial **ses_e36649e3affeJjY53mEb5Dxjo5 READY_TO_MERGE_YES /no findings** and security **ses_e3845fff1ffeE092hXAV6pfhiW READY records/source-planning only /low /no findings /no added gate**. Architect **ses_e36783826ffetiRNpE54VUigWv** and DevOps **ses_e384ffa7bffecNc429YDN25STS** accepted the additive source-planning boundary before full-wrapper code. That review's **UNSELECTED** field remains immutable pre-selection history; the later current selection lives separately below.

**HOST feasibility1 CONSUMED1/1 /remaining0 /no retry.** Original [host-command-approval.json](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/host-command-approval.json) remaining1/unobserved fields stay immutable issued history, not live authority. Actual [publication-result.json](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/publication-result.json) records **PASS_SOURCE_FOUR_NORMAL_COMMIT_AND_FIXED_HTTPS_PUSH /250d438685d2fc7560b0e31439f282bb2c145888 /feat-ml-adjuntant-ii /244 text entries /normal commit1 +fixed HTTPS push1 CONSUMED0**. The original publication-request **APPROVED_PENDING** fields stay immutable issued snapshots, not pending/current authority. Publication-result/actions are separate **post-publication LOCAL_UNCOMMITTED metadata**, not retroactively included in250d; new observation/docs also remain LOCAL_UNCOMMITTED. Native-build2/pub25bc grants stay separately consumed0. No authority follows from these grants; full1 retry is also consumed0, and separate source4 full2 HOST-only approval renews none of them. Preserve all prior/partial work, no retry/deletion.

The unchanged [source-4 proof](../_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/receipt.json) remains **SOURCE-ONLY /327 inputs /48 tests322 +41 qualification296 /four TSC/four PURE MOCK e2e**, SHA **cf632c5896bd5d46b453a67aeb87d2f0bd735b252960c7eca6917cee802d6f60**; packet checks bind12 streams/3 programs/8 MOCK JSON hashes and historical **49,023-byte command /SHAc690e8b0261e6bf09e834a41394369f694393ec6c60e18aa31b0375110f00054**. It is not retroactive GPU/full evidence. Failed history/source-plan-proposal-proof-review false fields/issued requests remain immutable; old checks/DOCS reviews/publication handoffs retain their generations. Current full source4 and full1 failure/consumed retry are separate below. Source3 DOCS closeout completed PRE_APPROVAL only; the parent owns pending fresh current-doc/index/hash/HEAD-diff closeout.

<a id="current-gpu-full-source-preparation"></a>

#### CURRENT source4 — fresh manual HOST reported NOT_STARTED; replacement text pending publication

**EXECUTOR_REPORTED_NOT_STARTED_APPROVED_ONE_POST_PUBLICATION_INVOCATION_TEXT_REDELIVERY /existing HOST grant:full2-manual-grant-1 /REPORT NOT_STARTED /reported existing HOST allowance unused1 /new HOST allowance0 /first manual text consumed1/rem0 /replacement text:full2-manual-redelivery-1 approved1, NOT DELIVERED/pending successful commit+push /old TUI outcome UNKNOWN/grant0/status0 /trainingReady:false.** The interactive report describes only the fresh manual grant, not an independent HOST query or a new execution budget. [gpu-full-qualification.puml](gpu-full-qualification.puml) owns the existing **15-file** implementation; existing **source4/** coverage includes the new local replacement-text approval, not original HOST/cache/full-run evidence. All issued records remain immutable.

Executor supplied complete approved manual read-only HOST status output: **`/home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/cache/host-gpu-full-2` ABSENT**, the corresponding **`runs/host-gpu-full-2` ABSENT**, **Docker label block empty /query exit0**, **receipt ABSENT /FULL2_STATUS_ONLY_EXIT=0**. Accept these time-specific facts at **REPORT scope**, provenance **USER_PASTED_COMPLETE_STATUS_OUTPUT_NOT_ORIGINAL_HOST_BYTES /queryTimestamp:null**. No original-HOST-byte or custody prerequisite follows. The separate manual status grant is now **1/1 CONSUMED /remaining0**; no fresh status query follows.

The retained [terminal submission observation](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/terminal-submission-observation.json) records **ONE TUI write acknowledgment**, not HOST command output, and consumes the old full2 allowance **1/1 /remaining0**. **Previous actual execution and test outcome remain UNKNOWN despite reported absence at the later query**; absence now proves neither never-attempted work nor campaign PASS/FAIL. The earlier never-attempted answer and issued remaining1/unobserved records retain their historical generations.

Local [reported-status.txt](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/full2-status-report-1/reported-status.txt), [observation.json](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/full2-status-report-1/observation.json) and [fresh-manual-host-request.json](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/full2-status-report-1/fresh-manual-host-request.json) retain the report and immutable **PRE_APPROVAL false fields**. Retained [verification-4 receipt](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/full2-status-report-1/verification-4/receipt.json) records **PASS_STATUS_REPORT_AND_FRESH_MANUAL_APPROVAL_RECORDS_ONLY /8 local bindings /sourceChanged:false /four PASS stages /11 tests141 assertions /strict TSC**, plus passive Git comparison/scoped docs whitespace. Verification1..4 are **HISTORICAL**, before the new replacement-text record, not fresh HOST/native/GPU evidence or frozen-manifest rehash. Earlier **7/75** and **9/109** records, PRE_APPROVAL adversarial **ses_e31d1b57dffeE0VApmmEeB2XmN READY**/security **ses_e31d1b57cffeij86laTtsGS0e4 READY**, pre-delivery pending and **LOCAL_UNCOMMITTED/no-global-Git-grant** projections retain their generations. Current [verification-5 receipt](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/full2-status-report-1/verification-5/receipt.json) records **PASS_STATUS_REPORT_AND_FRESH_MANUAL_APPROVAL_RECORDS_ONLY /9 local bindings /sourceChanged:false /four PASS stages /12 tests163 assertions /strict TSC**, passive four-checkout-input diff/scoped docs whitespace, source/records-only, not HOST/native/GPU proof or frozen-member rehash. Final docs/publication checks and review remain pending, not a Git result. Manual HOST/text grants themselves supply no Git authority.

Executor reports HOST **feat-ml-adjuntant-ii /HEAD `f6bce72a2cd10f66acf77162166a1d03fc87cd13`** at REPORT scope. The parent's passive Git comparison confirms that revision retains the exact canonical **56,981-byte /SHA8705a79ab07681a82531c411f200cee7a82d015ee3a401d3be617919abf7e210** command, **Cargo.lock** and required **verify.ts/supervisor helpers**. Existing mount admission checks retained **native65 /manifest7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec**; HOST branch/HEAD is neither runtime proof nor an additional gate. This grant authorizes neither a branch change nor installation.

**Executor selected Not started — reissue.** [manual-redelivery-approval.json](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/full2-status-report-1/manual-redelivery-approval.json) records **REPORT NOT_STARTED /existing full2-manual-grant-1 allowance unused1 /new HOST allowance0**, provenance **EXECUTOR_INTERACTIVE_REPORT_AND_TEXT_REDELIVERY_APPROVAL_NOT_INDEPENDENT_HOST_QUERY**. Separate **full2-manual-redelivery-1** approves **ONE replacement invocation text/issued remaining1 ONLY AFTER successful current-packet commit+push**; replacement has **NOT been delivered**. It binds existing HOST approval SHA **7030c3b743a98c9c8a5d03a0450361907c67343cd3b7ec80809682fa676012fe**, unchanged **56,981-byte command /SHA8705a79ab07681a82531c411f200cee7a82d015ee3a401d3be617919abf7e210**, cwd/argv and all existing bounds. [First manual-delivery observation](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/full2-status-report-1/manual-delivery-observation.json) stays **DELIVERED1/rem0** with **HISTORICAL null HOST facts**; the later report supersedes that uncertainty only for the fresh manual grant. [Existing HOST approval](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/full2-status-report-1/fresh-manual-host-approval.json) keeps issued fields and its **2,825-byte request /SHA78db7a2d4dcbe86fbb3587a719c2a5a403cd242fff5fc205a7f1af09fd201c4a** binding immutable. Any actual attempt including preflight consumes the existing ONE HOST allowance; **no second attempt, automatic retry, new status query, Rust build, installation, retained-input copy/mutation or training** follows. Old TUI outcome remains **UNKNOWN/grant0/status0**; no readiness lift or source regeneration follows.

**Separate publication authority — PRE_PUBLICATION snapshot, not an outcome:** [publication-request.json](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/full2-status-report-1/publication-request.json), **status-report-publication-1**, authorizes **ONE ordinary commit from `2b24d9c5ab4a3904d792e93c83e0715a862ab3ea` +ONE fixed `https://github.com/proveo-ca/chess-coach.git` push to existing `refs/heads/feat-ml-adjuntant-ii-continuation-2b24d9c5a`, expected remote same2b**, only these three docs and regular text under the status-report root. [Preflight receipt](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/full2-status-report-1/publication-preflight-1/receipt.json) records read-only exact-ref **PASS /commit-push attempts0/0 /no raw identity-config-credential persistence** at that snapshot. The new replacement-text record fits this **SAME pending cohort; no second publication grant is needed**. Use Git tool output/object history for result and separate consumption; preserve issued fields, with no self-referential new SHA or post-action commit. Original-feature updates, force/amend/hook bypass, merge/rebase and retry remain excluded. This Git grant itself renews neither manual-text nor HOST allowances and supplies no native/GPU/training or functional-readiness evidence.

The complete normalized [full1 receipt](../_work/gpu-owner-recovery/runs/host-gpu-full-observation-1/reported-receipt.json), [summary](../_work/gpu-owner-recovery/runs/host-gpu-full-observation-1/operator-summary.txt) and [observation](../_work/gpu-owner-recovery/runs/host-gpu-full-observation-1/observation.json) report **FAIL_HOST_GPU_FULL_ONLY /DRIVER_ABORT:Error: TELEMETRY_QUERY_CADENCE /HOST_GPU_FULL_EXIT=1 /9865.080253ms**. Accept **REPORT scope**, provenance **SEMANTICALLY_NORMALIZED_COMPLETE_OPERATOR_JSON_AND_SUMMARY_NOT_ORIGINAL_HOST_BYTES**. **inner:null /guardComplete:false /testExecutionAttempted:null /testsExecuted:null** leave native-test execution **UNKNOWN**, not completed or skipped. Worker **e98bce6459f8dad22a36085fae1f68cbe2c03d30818fcdd644a34253a87ef025** reports removed, **exited137 /OOMKilled:false /cleanupFailures:[]**; six complete Docker **create/start/logs/stop/state/remove** operations report **PASS0**. Exit137 alone establishes no OOM cause. Original HOST captures, samples, journal, artifact bytes and per-test results remain unreceived; these limits add no custody prerequisite.

Separate observation1 consumes the issued [retry approval](../_work/gpu-owner-recovery/runs/host-gpu-full-source-3/host-command-retry-approval-1.json), SHA **79e605b7dc999597206d1642260ccf4b098c0de3a7cde65dd84e100b1412fcff**, **1/1 CONSUMED /remaining0 /no automatic retry**. Its literal **APPROVED_ONE_OPERATOR_HOST_FULL_RETRY_UNCONSUMED_UNOBSERVED /issued remaining1 /observed:false** fields stay immutable, not live authority. The earlier [manual-alias launch report](../_work/gpu-owner-recovery/runs/host-gpu-full-source-3/host-launch-observation-1/observation.json) still records missing `./host-gpu-full-1.fish` /os error2/script not loaded/launcher exit:null/no campaign receipt **at that earlier generation**. Original grant **3be5e0f26e602928af6c41127a53cf41516c04c1dc84fb266a5e713a2b427e76** stays conservatively CLOSED/consumed1/remaining0. Neither issued snapshot supplies another attempt; actual operator source commit remains independently unverified.

Actual observation1 [verification.json](../_work/gpu-owner-recovery/runs/host-gpu-full-observation-1/verification.json) records **PASS_REPORTED_FULL_CADENCE_ABORT_RECORDS_AND_SCOPED_SOURCE_DELTA_ONLY**, strict checker TSC plus records PASS. [record-check.json](../_work/gpu-owner-recovery/runs/host-gpu-full-observation-1/record-check.json) records **PASS_OPERATOR_REPORTED_CADENCE_ABORT_AND_SEPARATE_CONSUMPTION_RECORDS_ONLY /six COMPLETE Docker argv /24 capture metadata rows /12 unique paths** and preserves null test facts. It checks local records, not original HOST captures or the original Bun/HOST timing sequence.

The retained [red1 receipt](../_work/gpu-owner-recovery/runs/host-gpu-full-cadence-red-1/receipt.json) literally records **FAIL /exit1 /failure:null**. Its raw **0 pass /3 fail** are expected pre-fix regressions: two early-timer cases produce **TELEMETRY_QUERY_CADENCE**, and a held sample journal produces **1003 schedules**. Raw streams and [three byte-identical source snapshots](../_work/gpu-owner-recovery/runs/host-gpu-full-cadence-red-1/source-snapshots.json) remain immutable. [green1 PASS /3 tests /24 assertions](../_work/gpu-owner-recovery/runs/host-gpu-full-cadence-green-1/receipt.json) is **intermediate deterministic MOCK evidence**, not final-source proof or proof of original Bun/HOST timer behavior.

The correction rounds positive timer delays upward to integers, rechecks a fresh snapshot/current time for exact query eligibility, and calls **ensureActive before admission**. It omits cadence wakes while query/journal work remains pending, retaining applicable query-timeout, sample-age and phase deadlines. Tests cover early/fractional/exact-boundary/pending-journal/stale/query-timeout/late-wake/phase-deadline/last-fractional-ms cases without cadence tolerance, catch-up bursts or policy weakening. [source-delta-check.json](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/source-delta-check.json) is **PASS_SCOPED_FOUR_FILE_CADENCE_AND_FRESH_IDENTITY_CORRECTION_ONLY**: only **driver.ts /driver.test.ts /plan.ts /plan.test.ts** changed, **343 of347 unchanged /all frozen327 unchanged**, strict guard **2s /1s /4s /400** unchanged. No new orchestration layer or original timing-sequence claim follows.

Current [source4 receipt](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/receipt.json) records **PASS_GPU_FULL_SOURCE_ONLY /347 sources /protected327 /sourceChanged:false /seven PASS stages /71 full tests688 assertions +48 feasibility322 +41 qualification296 +four strict TSC /four persisted PURE MOCK e2e**. Proof SHA **b3c6f85338b295e466fa2edb9625e36b89b84f977e97be492bfa7d6b931b9683**. [record-check.json](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/record-check.json) **PASS_GPU_FULL_SOURCE_PACKET_RECORDS_ONLY** binds **14 streams /3 program-plan hashes /full regenerated56,981-byte command /SHA8705a79ab07681a82531c411f200cee7a82d015ee3a401d3be617919abf7e210**; [records-verification.json](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/records-verification.json) records **PASS/exit0/captured**. Scope remains **BUN_STATIC_AND_PURE_MOCK_E2E_NOT_HOST_GPU_NATIVE_OR_JIT_EXECUTION /actualDocker0 /native0 /GPU:false**, not full qualification or a runtime-fit guarantee.

Architect **ses_e3422250bffe3HkEcFXdeqg0SK** accepted the existing four-file generation4 boundary before implementation; the parent accepted DevOps advisory. Persisted [source4 review](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/review.json) retains **READY_SOURCE_FOUR_CORRECTION_AND_UNAPPROVED_FULL_TWO_REQUEST_ONLY**: adversarial **ses_e340bb15bffe86c4P5emUBuYUL READY/no findings**, security **ses_e340bb158ffe4KsU34VYavEHL5 READY/no findings/LOW_FOR_REVIEWED_DELTA**, including request addition. Its scope excludes HOST/GPU and docs closeout; no new hardening gate. [Full2 request](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/host-command-request.json), SHA **cd8120322c11cd1107a07d1cab883933d1327b1e06ba463d930f23d51a6ab4bf**, retains **AWAITING_FRESH_EXACT_OPERATOR_HOST_APPROVAL/all false fields** as an immutable **PRE_APPROVAL snapshot**, not live permission or denial. The proposal and separate issued approval below retain historical scopes; neither supplies current authority after consumption.

**HISTORICAL issued approval, now separately consumed:** Executor selected **Approve HOST only (Recommended)**. Actual [host-command-approval.json](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/host-command-approval.json) records **APPROVED_ONE_OPERATOR_HOST_FULL_TWO_INVOCATION_UNCONSUMED_UNOBSERVED /ONE OPERATOR_HOST_ONLY_NEVER_CODING /remaining1 /unobserved**, bound to request **cd812032...**, exact **56,981-byte command /8705a79ab07681a82531c411f200cee7a82d015ee3a401d3be617919abf7e210**, proof **b3c6f853...** and unchanged bounds. Its then-issued scope permitted HOST-local read preflight, fresh embedded TEXT/scratch/evidence/JIT writes, one owned container, same-container telemetry, six exact GPU tests with LLVM/NVPTX/CUDA kernel JIT and owned-CID cleanup. **Any attempt including preflight failure consumes1; no automatic retry.** Separate terminal submission now records consumption1/remaining0; preserve issued remaining1/unobserved fields. No retained-input copy/mutation/native Rust compile/acquisition/install/coding HOST-native-GPU-JIT/training authority follows.

**HISTORICAL pre-delivery snapshot, not the current grant:** **manualCommandTextDeliveryApproved:false /commandDeliveryOrPublicationAuthorized:false /publicationApproved:false**, source4 **LOCAL_UNPUBLISHED** and delivery pending described the generation before source4 publication **35048e5c70ca9658a5faf8dbff73bd786c3d9cee** and the later TUI submission. They establish no current remaining allowance or never-executed outcome. **host-gpu-full-2 /--approved-host-gpu-full-2** is never authorization by string; the separate fresh manual approval preserves fresh-root refusal and never permits reuse/deletion of failed full1 workspace/cache/evidence. Published source3 stays failed-generation history; no fresh commit/push grant follows.

The unchanged source contract uses **qualificationPlan('gpu','full')**, all six exact selectors: feasibility pair **again**, active2335 +inactive2335 (**4670 /eps1e-6 /atol1e-8 /rtol1e-5**), C12 redundant channels and policy subprocess agreement/reload; **each1 passed /0 failed /0 ignored /exit0**. Steps3/4 use the learning finite-difference harness, all others policy; absolute policy-channel binary/env and frozen pure guard stay unchanged. **commandInvoked:false** before journal/mkdir and **true** immediately before runCommand remain required for full admission. Host attempted/executed stays **false/false** for registration only, **true/null** without observed integer exit>=0 after invocation, **true/true** with such an exit, **null/null** for missing/non-array results. Event **chess-coach.gpu-full-event.v1**, inner **chess-coach.gpu-full-driver.v1**, outer **chess-coach.owned-gpu-full.v1** stay unchanged; success markers are conditional, never the reported full1 outcome.

**Manual HOST bounds unchanged; fresh attempt NOT_STARTED/existing allowance unused1 at REPORT scope, no new HOST allowance:** **120000ms/test /750000ms loop INCLUDING30000ms cleanup reserve /driver890s=120 preflight+750 campaign+20 final /HOST1080s=960 normal+90 cleanup+30 receipt**, clipped to HOST normal remaining **minus20s**. Same RO **native2/target1/Bun1/prepared LLVM/CUDA** and fresh-only scratch/JIT/evidence; **/scratch** and **/build/native/_work/gpu-owner-recovery/scratch** alias one fresh HOST scratch directory, counted once. Same **2 CPU /8 GiB memory and memory+swap /no extra swap /3/2 GiB /2s query-start /1s query /4s age /400 queries /journal1 MiB**. Workspace+evidence **SOFT4 GiB /free8 GiB initial /4 GiB running**, worst captures **3248+56=3304 MiB**, remaining **792 MiB**, not a fit guarantee/quota/reservation or deletion/bypass permission.

Frozen327/old wrapper/qualification/Rust/Dockerfiles/image pins/math/CPU Flex/masters101..105 remain unchanged. No accepted **full-six numerical/C12 /CPU39 /canonical BOTH/reference/close /integratedR4** evidence exists; full1's report is a failure, source4 is not runtime proof, and training remains unauthorized. Visibility-probe-2 FAIL/exit6 stays distinct; strict pure-policy **10/297/300 unchanged/unqualified**, dispatch disabled, **trainingReady:false**. Accept all functional evidence before any readiness lift. ALL security/privacy/isolation hardening follows **ALL planned training and validated results**, not a new source-preparation or custody gate.

**Historical generations remain immutable.** Source1 types-3 FAIL, source2 PASS plus NOT_READY execution-fact MEDIUM, partial plan3/38/regression48+41 and source3 PASS347/62 full tests629/four TSC/four MOCK retain their scopes. Source3 proof **62d0fad77fc9538673ef0d69b2bdade57fc320dacb1168ea31564e4e61e5f7a5**, command **56,775 bytes /83919afa384f09b2f597d8c8d3e6eeee108fc47c68aaf32c3a2fba2fc0b50666**, request **bf06597608243ae4ed83c716e795f5628d0ac7d0a3e44a58a35aadd948644b54**, pre-approval false fields, scoped READY reviews and retry-check retain their original generations, not source4 verification. [Source3 publication](../_work/gpu-owner-recovery/runs/host-gpu-full-source-3/publication-result.json) records **PASS /3d35125bdcf27542e6a0ad266a9ed118f9d14658 /parent250d438685d2fc7560b0e31439f282bb2c145888 /feat-ml-adjuntant-ii /fixed https://github.com/proveo-ca/chess-coach.git /302 text members /normal commit1+HTTPS push1 CONSUMED0**. Issued publication-request PENDING fields stay immutable, not live authority. Its prepublication **12-doc+15-source+retained source1/2/3+feasibility observation1+old feasibility source4 post-publication receipt** membership, literal-text audit, manifest, checks and reviews keep their generations; later records outside3d351 are not retrocommitted. No force/amend/hook bypass/new credentials/transport change/retry/follow-up Git grant exists.

**HISTORICAL closeout generations:** Source3 checks/reviews retain their PRE_APPROVAL/PRE_PUBLICATION generations. Source4 [closeout-1.json](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/closeout-1.json) **PASS_CURRENT_SOURCE_FOUR_DOCS_RECORDS_AND_UNAPPROVED_FULL_TWO_REQUEST_ONLY**, [docs-closeout-review.json](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/docs-closeout-review.json) **READY_TO_MERGE_YES** and [post-review-check.json](../_work/gpu-owner-recovery/runs/host-gpu-full-source-4/post-review-check.json) **PASS_CURRENT_REVIEWED_SOURCE_FOUR_FULL_TWO_DECISION_ONLY/fresh closeout2** completed **PRE_APPROVAL** nine-index/12-doc/347+327+343/captures/request+reviews/HEAD-diff closeout. Those hashes/false authority fields and then-pending issued-doc checks retain that generation, not verification of this status amendment or a renewed twelve-doc closeout gate. The parent owns bounded current record/docs verification and review. The bounded verifier stays outside frozen347; source proof and four-file implementation remain unchanged.

#### Retained HOST2 source proof and accepted execution contract — HISTORICAL

The following explanatory paragraphs describe the then-issued HOST2 contract, now **CONSUMED**, rather than reproduce a live grant. Original requests/proofs keep their issued snapshots, including remaining1/unobserved fields; those fields are **not current authority or next-run instructions**. Existing HOST2 coverage includes the actual normalized observation-2 root, not original HOST/cache paths; that coverage stays unchanged. The separate full owner adds only the four actual roots above. No source, record, proof or request changes occur in this docs-only projection.

[gpu-host-build-reuse.puml](gpu-host-build-reuse.puml) owns actual **qualification/host-build-reuse/**: plan/native/render/host/runtime/verify, four test files, selection and local types. Architect **ses_e36f4b6d9ffeCMclo9ifqwusMu** was reconsulted BEFORE implementation and accepted the ADDITIVE adapter, preserving old host-build code/helpers. The **291-input correction-source-2 proof stays CURRENT for the one-line fix only**; the adapter now has its own fresh **307-input** source proof, never native/HOST/cache-admission acceptance.

Historical **host-gpu-cache-reuse-source-1** remains **FAIL /89 tests /88 pass /one fragile renderer regex failure**: Bun constant-folded an absolute dynamic helper import instead of retaining the test's expected root concatenation. Only the test's module-path assertion changed; delivery stayed identical. **Source-2 PASS** remains **PRE_LOW_PROPOSAL_METADATA_FIX**. Security's **LOW CWE269** concerned proposal.cacheMutationScope wrongly listing RO Bun, **not a writable Bun mount**. Only verify.ts proposal metadata changed to exactly **cargoHome +cargoTarget**, with **retainedBunReadOnly separate**; old source-1/2 proofs/proposals/raw captures remain immutable.

Fresh [reuse-source-3 receipt](../_work/gpu-owner-recovery/runs/host-gpu-cache-reuse-source-3/receipt.json) records **PASS_CACHE_REUSE_SOURCE_ONLY /307 frozen inputs /sourceChanged:false /nine PASS stages**: **89 adapter tests /6,444 assertions +41 qualification /296 +162 original mock /8,133 +6 TSC**. Three new pure-MOCK lifecycle cases plus three retained old cases establish **no actual Docker/native compatibility or HOST cache validation**. All native65/Rust/old291 proof inputs remain unchanged from the already bound one-line correction; new source checks are static/local-JS/mock/types, no native compiler/LLVM/CUDA/HOST operation.

Source-3 proposal/plan/proof/review/check **false approval fields remain immutable PRE-APPROVAL snapshots**. Original [handoff-2/request.json](../_work/gpu-owner-recovery/runs/host-gpu-build-handoff-2/request.json) recorded the then-issued authority, now **CONSUMED**: **APPROVED_ONE_HOST_BUILD_ONLY_INVOCATION_UNCONSUMED_UNOBSERVED /remaining1 /observed:false**, from **Approve+push Recommended**. It bound proof SHA **268a7750faeca4c349769e62b67276fe16a3d5f9347f3d2448f45bfccbed5c5e** and exact **76,732-byte /SHA47cdea246668505ef6b2fe682900c7735adf59f388cbfcfde3abb20a306559c4** command, not rehashed here. It renewed neither build1 nor old publications. At issuance it had no HOST2 result; separate observation-2 now accepts the reported native-build-only PASS/zero marker and consumes HOST2 **1/1 /remaining0** without rewriting the request.

Existing source-3 [record-check.json](../_work/gpu-owner-recovery/runs/host-gpu-cache-reuse-source-3/record-check.json) is **PASS_EXACT_CACHE_REUSE_DRAFT_RECORDS_ONLY**: **307 hashes /18 streams /3 programs /regenerated full command+plan /24 fixture files across6 PURE MOCK cases /ONLY two writable caches +Bun RO**. [review.json](../_work/gpu-owner-recovery/runs/host-gpu-cache-reuse-source-3/review.json) persists source-3 adversarial re-review **ses_e36ba7131ffeo2U1MjPrDpWjkp READY/no findings**, DevOps **ses_e384ffa7bffecNc429YDN25STS READY exact-decision-only**, security **ses_e3845fff1ffeE092hXAV6pfhiW LOW CLOSED/no remaining/risk low/no hardening gate**. Source/records-only results did not perform HOST/native execution or grant it themselves. The later recorded consistency PASS above covers its bound PRE_CLOSEOUT_DOCS_GENERATION, not these subsequent wording changes.

Existing [approved-handoff-check.json](../_work/gpu-owner-recovery/runs/host-gpu-cache-reuse-source-3/approved-handoff-check.json) records **PASS_APPROVED_CACHE_REUSE_HOST_HANDOFF_RECORDS_ONLY** for the then-issued request2/command/proof/307 inputs, ONLY two mutable caches/Bun RO and historical **HOST2 remaining1/unobserved +normal commit1/HTTPS push1 allowed**. Existing [publication-preflight.json](../_work/gpu-owner-recovery/runs/host-gpu-cache-reuse-source-3/publication-preflight.json) records **PASS_READ_ONLY_PUBLICATION_TRANSPORT_IDENTITY_PREFLIGHT**, inherited identity/fixed HTTPS/no applicable rewrite/**NO executable or linked Git hooks**; that recorded configuration selected no native Cargo hook for ordinary commit. Its precommit snapshot recorded commit/push0 and no execution during that check; later publication and HOST2 consumed both separate grants.

Existing [publication-source-audit.json](../_work/gpu-owner-recovery/runs/host-gpu-cache-reuse-source-3/publication-source-audit.json) records **PASS_NON_SPEC_CORRECTED_SOURCE_AND_REUSE_PACKET_PUBLICATION_AUDIT**: **413 NON-SPEC entries before itself /2,900,794 text-link bytes /8 bounded relative SOURCE-fixture links**, excluding **_spec AND itself**, binaries and caches. This remained a **PRECOMMIT/PRE_FINAL_SPEC_ENVELOPE** snapshot, not proof of later publication or an audit self-hash. All307 checked source inputs/regenerated programs/full76,732-byte command remain unchanged. Later publication25bc and the recorded PRE_CLOSEOUT_DOCS_GENERATION consistency PASS retain their separate scopes; existing source-3 root coverage already includes these three historical records.

Pinned **Bun.build does not support a write:false option**. Actual rendering uses **no outdir/outfile**, in-memory BuildArtifacts read via **Blob.text**, with only local JavaScript definitions. Static checks allow Bun-normalized bare builtin imports (`fs`, `fs/promises`, `crypto`, `url`) using node:module builtinModules/stripped `node:` prefix; expected absolute dynamic HOST helper imports remain hash-bound at runtime. Bundle/export checks activate no old CLI/native executable or Docker operation.

The then-issued contract approved exclusive HOST **cache/host-gpu-native-build-2/native /runs/host-gpu-native-build-2**, retained **cache1/bun RO**, ONLY **cargo-home /native/target-gpu RW**, whose contents **could change only during that now-consumed OPERATOR grant**. It preserved old source/evidence/Bun. The overlay bound old9141/new7e manifests and gpu.rs **b1cb7ebe67ec15cb198db413ad5ad03d883aa07e408e78afbb9d6d8e9dc5f9ce →89b80da22602fbfa679e79e1fb6339d08714ea89ed3e7e81b692f61324f0394c**, fresh source/manifest ONLY. It supplies no current donor/cp/pull/install/acquisition/shared-builder mutation/project-test/GPU/train/deletion/overwrite/retry/coding Docker-native authority.

The historical native contract required staging ONLY **current-native +qualification-tools** into fresh source (**<=512 MiB /3,800 files**, no target traversal/clear), verifying the FULL old native65/**9141…** manifest/exact old gpu.rs hash, then overlaying ONLY fresh **gpu.rs +qualification/source-manifest.json** from embedded corrected UTF-8/metadata. It required full new native65/**7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec**, same 65 members/64 hashes/one delta. Original received context/LLVM stayed RO; old manifests/proofs/requests remain immutable. Plan/source metadata were embedded, not binaries; the contract required no helper fetch or HOST Git/source-publication prerequisite. The same two repository-helper SHAs/Cargo.lock were pre-import requirements, not new read authority.

The historical HOST2 contract specified one pinned Rust worker, **2 CPU /8 GiB memory+swap8 GiB /no extra swap /current numeric UID /jobs2 /network none /pull never**, retained Bun ordinary regular/positive/executable **<=128 MiB** admission and **Bun1.4** property check, not an invented Bun SHA/custody gate. **13000** remains an unqualified trial. It bounded **7 Docker operations**, normal path **5**: create/separate start/log-follow/state/rm, plus failure stop/conditional kill; it required captured full64hex CID validation, invocation-local recovery and deferred stop while start was pending. It selected no start --attach or generic executor/broker/manager.

The historical native contract required fresh captures of **three baseline guards +BOTH exact locked/offline GNU GPU Cargo --no-run commands**, even on cache hits, without substituting old learning PASS. HOST admission required **compilationAttempts:2 /sourceStabilityChecked:true /sourceChanged:false AND sourceManifestSha256 == new7e… AND previousSourceManifestSha256 == old9141…**, successful terminal state/all five artifacts within NORMAL time. It retained attempts/results before mirrors, primary/auxiliary failures and unchecked:null rather than false. Reused watcher/treeBytes/signal-guardian primitives and pure-MOCK tests were source evidence, not actual Docker results; observation-2 separately supplies the reported build outcome.

Historical bounds were **4020s normal +120s cleanup +60s receipt =4200s**, outer **4080s TERM+120s KILL** from the pre-syntax/Mise epoch. Native max **3600s clipped to normal cutoff MINUS120s acceptance reserve**, with **30s internal receipt reserve** in helper remaining; artifact work stayed <=min(120s, normal remaining). Logical **32 GiB SOFT /5s** counted fresh workspace/evidence PLUS retained RW Cargo/target once; the fresh host target was an empty bind point, target mount only in the container namespace. The contract required **64 GiB initial /16 GiB running free**, excluded Docker writable layers/quotas and rejected oversized cache without deletion/bypass. Stream goals were **56 HOST +40 native +16 canonical COPY =112 MiB**, excluding plan/receipts/Bun/compiler outputs/parent; parent64KiB post-exit SOFT/receipt2MiB stayed separate. Guardian lifetime covered monitor close/drain through immutable wx pre-marker receipt/post-write exit check; PASS required **PASS receipt AND zero HOST marker**, not physical/NTP/signal/crash assurance.

**The historical Approve+push selection and both grants are CONSUMED.** It issued OPERATOR-only HOST2 scope of **one command /7 Docker maximum /4200s /2 CPU /8 GiB memory+swap8 GiB /no extra swap /network none /pull never /offline jobs2 /current UID /pinned Rust+Bun**, fresh staging/overlay/three guards/two no-run compilations/build scripts/proc macros, ONLY named cache writes/new owned-container cleanup. Build1 remains consumed; HOST2 is now **1/1 CONSUMED /remaining0**. Issued remaining1/unobserved fields are immutable history, not live permission or a reason to rerun.

**The historical publication/delivery request completed at25bcfb61ddde6849d10e61536266b5e2f50c5598; its ONE commit/push grant is CONSUMED.** Saved-file delivery required an actual published commit/path already on HOST; the alternative was the whole unchanged **76,732-byte literal COPY** with existing helpers/Cargo.lock, never an implicit fetch or helper acquisition. Publication order was a delivery request, not a native dependency. The invocation has now been reported: accept existing **HOST_NATIVE_BUILD_EXIT=0 /observation-2**, never rerun/overwrite/delete partials. Any attempt consumed the allowance, including preflight failure; issued remaining1 is not current permission. Recorded consistency PASS covers PRE_CLOSEOUT_DOCS_GENERATION only; final review remains pending. This docs pass executes/publishes nothing; hardening remains LAST after ALL training/validated results, no old LLVM archive/native-global Upgrade PASS.

Old failed source/evidence/all partial outputs remain retained; only exact Cargo/target contents could change within the now-consumed OPERATOR HOST2 grant, never through this coding session. Original HOST2 evidence/cache remain unreceived/uncovered. Existing owner/index coverage includes the issued request, actual reuse-source roots/dependencies and normalized observation-2, not original HOST/cache roots; this HOST2 section changes no coverage. Old291 proof/failure/diagnostic snapshots remain immutable; this docs pass runs no checker/command/HOST/native operation.

#### Retained accepted execution contract and source proof — HISTORICAL, no remaining authority

[gpu-host-build.puml](gpu-host-build.puml) owns **OWNED_DOCKER_CONTAINER_NATIVE_BUILD_ONLY_NOT_QUALIFICATION_IMAGE_BUILD**, historically accepted under the now-consumed [issued request](../_work/gpu-owner-recovery/runs/host-gpu-build-handoff-1/request.json). The retained contract below describes that original one-shot scope, **not permission to run again**; exact Rust-base+Bun-interpreter inputs, native65/layout, qualification runner and both production/qualification Dockerfiles remain unchanged.
Actual [source-1](../_work/gpu-owner-recovery/runs/host-gpu-build-source-1/receipt.json) **FAIL** from the fragile transpiler `false` versus `!1` assertion and [source-2](../_work/gpu-owner-recovery/runs/host-gpu-build-source-2/receipt.json) **PASS / 282 hashes / 76 tests / 4777 assertions / three pure MOCKED lifecycle e2e + 37 qualification/280/four types** are **PRE_FUNCTIONAL_REVIEW_FIX history**, not current modified-source proof.
Actual [source-3](../_work/gpu-owner-recovery/runs/host-gpu-build-source-3/receipt.json) records **PASS / 282 frozen hashes / 148 tests / 7329 assertions / three pure MOCKED lifecycle cases +37 qualification/280/four typechecks**, but is **PRE_FINAL_TWO_REVIEW_CORRECTIONS history**, not proof for the latest source.
Actual [source-4](../_work/gpu-owner-recovery/runs/host-gpu-build-source-4/receipt.json) records **FAIL / 162 tests /161 pass +one formatting-regex trailing-whitespace assertion failure**; preserve that snapshot without rewriting its receipt or captures.
Retained pre-correction [source-5](../_work/gpu-owner-recovery/runs/host-gpu-build-source-5/receipt.json) records **PASS_HOST_NATIVE_BUILD_SOURCE_ONLY /sourceChanged:false /283 frozen hashes /162 tests /8133 assertions +37 qualification/280/four typechecks**, all **six stages PASS**. Its **three persisted PURE MOCK lifecycle cases** validate no real Docker API/CLI compatibility or native execution; this verifies only that frozen generation, **not the corrected policy-record generation** or HOST/build/GPU/overall readiness. The recorded exact command is **40,054 bytes /SHA-256 `50123eaff0efebb93f7c03210afd765c0ddb02273c08b7ac63a262e37dcd962e`**; this docs pass did not rehash it.
Initial DevOps **3 MEDIUM**, adversarial **2 HIGH +4 MEDIUM** and security start/stop-race findings remain functional lifecycle/evidence history, **not hardening deferred to LAST**. Source-3 re-review historically closed DevOps's three findings and scoped security races, while adversarial then returned **two new MEDIUM/NOT READY** for signal-handler lifetime and overwritten supervisor cause; source-1..4 snapshots and those findings remain immutable.
Existing source-5 [review.json](../_work/gpu-owner-recovery/runs/host-gpu-build-source-5/review.json) records **architect acceptance of the ten-operation method**, **DevOps READY**, **adversarial all eight prior findings resolved/no findings/READY**, and final security **READY_FOR_PROPOSAL_DECISION_ONLY/low/no findings/no additional hardening prerequisite**. These completed source/proposal reviews alone grant no operation or assurance PASS; the separate now-consumed request supplied the historical HOST-only authority, not a successful HOST result.
Approved HOST scope is **<=10** fixed-local-endpoint Docker operations: never-started Bun donor create/**cp -L exact interpreter only**, Rust worker create, **separate `docker start CID` <=120s then `docker logs --follow CID` <=min(3600s, normal remaining)**, one state inspection, owned stop/conditional kill/two removals. **Never start --attach**; only fresh captured CIDs, no shared-builder/query/setup addition. Worker **2 CPU / 8 GiB memory / 8 GiB memory+swap (no extra swap) / network none / pull never / numeric uid:gid**, no GPU/NVIDIA runtime request, interactive stdin or TTY.
`startPending` precedes operation admission: watcher records failure but neither stops nor memoizes stop while start is pending; failure before admission prevents start, and after settlement failure prevents log-follow before owned cleanup handles a possibly started worker. Interruption during log-follow stops only the owned worker and closes log following.
The historical HOST-only staging scope included current-native/qualification-tools/Cargo cache (**<=512 MiB /3800 files**); prepared LLVM/Bun/context stayed RO with exact `/build/native`/`/capture/cargo-home` layout. That consumed authority included the Bun property check, **three native Rust/Cargo/LLVM guards**, build scripts/proc macros/compiler execution and **two existing GPU Cargo `--no-run` compilations**, not project test execution; **13000 is an accepted binding trial, not qualified**.
Inline delivery is **not dependency-free**: existing HOST checkout must supply the two SHA-pinned unchanged repository helpers plus Cargo.lock, checked before absolute import; native staging reuses their baseline copies. Missing dependencies fail without fetch/repair; unchanged `runBounded`/supervisor retains **4 MiB per stream**.
GOALS bounds remain **4020s normal +120s cleanup +60s receipt / outer Fish 4080s TERM +120s KILL**. ONE future read-only HOST date timestamp sets `HOST_NATIVE_BUILD_STARTED_MS` **before syntax/Mise**; HOST `startedAt` accounts for elapsed bootstrap/preflight and writes `deadline.json` normalDeadlineEpoch, clipping native **<=3600s including staging/guards/compile** to HOST normal time rather than granting a new clock. Ordinary cooperative date correlation is not NTP/physical-stop assurance; no date query ran in coding.
Storage remains **64 GiB initial /16 GiB running free /32 GiB new-work+evidence SOFT /5s monitor**, excluding Docker writable layers; Bun **128 MiB POST-COPY admission**, no quota. `treeBytes` tolerates child ENOENT during Cargo churn, not missing roots/other errors; async watcher close rejects ticks/removes handlers/drains in-flight scans and their stop calls **before final cleanup/removals/receipt**, so a late scan cannot mutate PASS.
`protectFinalizationSignals` installs **BEFORE preflight** and retains HOST-main **SIGTERM/SIGINT** handlers after watcher close/drain through owned cleanup, receipt write, **post-write check**, console status and exit-code selection; final `finally` alone releases it after metadata I/O/logging. It only records interruption, never starts late Docker actions; preflight interruption blocks Docker, and signals observed **before OR after receipt I/O** downgrade final console/process exit to FAIL without overwriting an earlier primary failure. Fake-emitter source tests cover this logic, not real signal delivery; existing **120s cleanup +60s receipt /4080s TERM /cleanup through 4140s /4200s KILL** remain cooperative bounds, not NTP/crash/physical-stop assurance.
The receipt is an **immutable exclusive-wx pre-marker snapshot** carrying **receiptStatusRequiresZeroHostMarker:true**. A signal during receipt writing can leave a PASS file while post-write console/process status and **HOST_NATIVE_BUILD_EXIT** fail; never rewrite raw evidence. Overall build-only acceptance therefore requires **PASS receipt AND HOST_NATIVE_BUILD_EXIT=0**, never the file alone.
Artifact validation is **NORMAL phase <=min(120s, remaining normal time)**, checks around log/stat reads and per hash chunk, never spending cleanup reserve. Terminal state is inspected once before normal-path artifacts; failure cleanup inspects only if not previously attempted.
Native attempts register **before runBounded**, results persist **before capture/mirror**; primary command failures survive auxiliary `captureFailures`/`canonicalCopyFailures`. Post-try/catch source comparison also covers failed builds when initial inventory/time allow; unchecked/read-failed/deadline yields **sourceChanged:null / sourceStabilityChecked:false + reason**, never falsely unchanged.
HOST operation records retain raw **supervisorResult status/exitCode/failure**; `entry.failure` preserves the actual deadline/output-bound cause separately from contextual `operationFailure`, and a pre-result throw retains its message. Receipt metadata does **not duplicate stdout**, so a 4 MiB raw stream cannot overflow the 2 MiB receipt through that duplication; separate raw captures remain unchanged.
Retention GOALS now **80 MiB Docker raw +40 MiB native raw +16 MiB canonical Cargo COPY =136 MiB supervised/mirror bytes**, excluding receipts/artifact metadata/Bun/compiler outputs/parent diagnostics. Native **40 MiB excludes mirrors**; separate evidence bind mount/canonical copies, parent diagnostics **64 KiB post-exit SOFT**, HOST receipt **2 MiB** remain unchanged.
Future success requires terminal `Running:false / ExitCode:0 / OOMKilled:false`, inner native PASS/exactly two compilations/**sourceStabilityChecked:true AND sourceChanged:false**, five artifacts within NORMAL deadline, drained watcher/no first or cleanup failure, **PASS receipt AND zero HOST_NATIVE_BUILD_EXIT**, not start/log-follow exit alone. `PASS_HOST_GPU_NATIVE_BUILD_ONLY` still proves no qualification image/F64 feasibility/CPU39/full 4670/C12/canonical BOTH/reference/close/R4/telemetry/training readiness.
`qualification/host-build/verify-records.ts` completed **PASS_HOST_NATIVE_BUILD_SOURCE_AND_COMMAND_RECORDS_ONLY**; existing [record-check.json](../_work/gpu-owner-recovery/runs/host-gpu-build-source-5/record-check.json) records **283 source hashes/12 verification streams/12 files across three PURE MOCK cases/generated programs and exact command/six ordered diagram-index matches**. This **PRE_APPROVAL/PRE_AUTHORITY_METADATA_UPDATE snapshot** does not verify this new authority/coverage projection; the source graph excludes docs, frozen source/proof remain unchanged, and no checker/source-proof rerun occurred. Original source plan/proof/proposal/review false HOST/publication approval flags remain historical and untouched; [host-command-approval.json](../_work/gpu-owner-recovery/runs/host-gpu-build-source-5/host-command-approval.json) stays the pre-approval proposal.
**Issued authority snapshot:** the original Build-only selection/request retains **APPROVED_ONE_HOST_BUILD_ONLY_INVOCATION_UNCONSUMED_UNOBSERVED /remaining 1 /observed:false** and **gitPublicationAuthorized:false** unchanged. The separate current observation consumes HOST **1/1 /remaining 0**; original source-plan/proof/proposal/review false flags remain historical. None changes to manufacture current consumption or operational PASS.
**Delivery/publication history:** the later separate request supplied ONE normal commit/fixed-HTTPS push, now completed at **4350306f9** and **CONSUMED**. Lead then delivered the SAME command; “once more” meant redisplay, never a second invocation. Saved-file delivery required the actual published commit/command already on HOST; whole-literal COPY was the alternative, with no implicit Git/helper fetch. That original delivery contract grants no current run, retry, read, extraction or publication.
Coverage retains source-1..5, exact **handoff-1/request.json** and prior observation-1/**, with actual diagnostic/contract/test/native source and **both correction-source-1/** and **correction-source-2/** roots**. Source-5 counts/reviews/six index matches remain frozen baseline facts; the separate source-2 proof accepts the correction only within its source/static/mock/type scope. No source, plan, proof, request or diagnostic-record changes occur here. Later recorded consistency PASS covers its bound PRE_CLOSEOUT_DOCS_GENERATION, not these subsequent wording edits; final review remains pending.
Actual native byte delta is ONLY **gpu.rs**; native65 membership/Rust harness counts/model/F64/all **4,670** coordinates/`eps=1e-6`/`atol=1e-8`/`rtol=1e-5`/exact C12/CPU Flex/masters **101..105**/recipes stay unchanged. Dispatch stays disabled, **trainingReady:false**; ALL security/privacy/isolation hardening follows **ALL planned training and validated results**. This docs-only pass runs no command/verification/native/HOST/network/agent operation, performs no source change and claims no native/global Upgrade or assurance PASS.

<a id="current-runtime-packaging"></a>

## Historical runtime/publication packet — before receive-2 report and docs push 283897c

The packet below preserves its pre-observation-2/pre-283897c snapshot; its unrun/unconsumed, pending-publication and LOCAL_UNCOMMITTED wording is historical, not current authority.
The [current status and next decision](#current-host-build-inventory) above govern.

Executor selected **`Rust base+Bun Recommended`** for **source packaging only** after the reported builder details arrived.
The [runtime request](../_work/gpu-owner-recovery/qualification/runtime-request.json) records `SAME_PINNED_RUST_BASE_PLUS_PINNED_BUN_INTERPRETER` and retains its original false operation flags.
Executor later selected **`Draft assets Recommended`** in the distinct [original transfer request](../_work/gpu-owner-recovery/qualification/transfer/request.json).
That request approved **one bounded preparation and DRAFT-asset publication**, not image construction, compilation, host/GPU execution or training.
[gpu-qualification.puml](gpu-qualification.puml) owns qualification; [gpu-input-transfer.puml](gpu-input-transfer.puml) owns the helpers, completed preparation, two closed STOPs and successful third DRAFT publication.
The [preparation receipt](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/receipt.json) retains **PASS_PREPARATION_ONLY_PUBLICATION_PENDING** as its pre-attempt snapshot.
The first [publication receipt](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/publication.json) remains **FAIL / PUBLICATION_ORIGIN_MISMATCH**, closed and consumed with zero mutation invocations.
**After that STOP**, Executor selected **Explicit HTTPS Recommended** in the distinct [HTTPS publication request](../_work/gpu-owner-recovery/qualification/transfer/https-publication-request.json).
It approved the HTTPS helper fix, source-5 proof and **ONE fresh 600s publication attempt**, not preparation or first-attempt replay.
That second attempt has now run once and stopped **FAIL / PUBLICATION_COMMAND_FAILED / commit**, after **838.463473 ms**.
The second publication attempt and **one actual commit invocation stay CONSUMED**.
The separate [publication-2 outcome](#current-https-publication) retains the failure and narrow inherited-identity evidence without changing earlier records.
Executor has now selected **Inherit Identity Recommended** in the distinct [identity publication request](../_work/gpu-owner-recovery/qualification/transfer/identity-publication-request.json).
That request supplied one distinct third attempt, not replay of either STOP or preparation.
The [third publication](#current-identity-publication) completed **PASS in 21,178.921619 ms**: one normal commit and fixed-HTTPS push of **`f3e277dbbf33c0aa69172cca1890792656d4cd09`**, one **DRAFT release 439935095** and two verified uploads.
Its grant is **CONSUMED** and authorizes no further attempt, commit or push; the later host-receive handoff supplied distinct scope, now also consumed as [recorded below](#current-host-receive).
Upgrade completion covers **input preparation and DRAFT publication only**, not operator acquisition, build/GPU qualification or training readiness.
Executor has now selected **Publish+receive Recommended** at the [exact combined HOST-command decision](#current-host-receive).
The coding source allowance remains **PASS / CONSUMED** at helper commit **`33b29dd095a3582a02861cef0f155e675a6721cc`**; the operator now reports **BOOTSTRAP_STARTED / BUN_VERSION_MISMATCH / HOST_COMMAND_EXIT=1**, consuming **1/1 invocation at report scope**, zero remaining.
The original full-index whitespace check remains **FAIL**; its scoped source/spec/task check passed during an internal continuation inside the original deadline, not an operational retry or renewed budget.
The actual Bun version at the failed run-1 invocation remains unknown; its record-only check proves no host qualification/download history, while the later alignment report below accepts current functional version facts at report scope.
Executor then directed **"the host needs to adjust to bun/rust versions set in this runtime"**.
Executor's [alignment report](#current-host-toolchain) now supplies six exit-0 phases, exact Bun/Rust/Cargo banners and **PASS_HOST_TOOLCHAIN_ALIGNMENT_ONLY / HOST_TOOLCHAIN_EXIT=0**; alignment/install **1/1** and queries **3/3 CONSUMED**, zero remaining.
Executor's [receive-2 SOURCE_ONLY publication](#current-host-receive-run2) completed **PASS** with one normal commit and one fixed-HTTPS OID push of **`98749410eda3dcadd7a210d3ddb1ac097a9ba13d`**.
The source-publication grant is **CONSUMED 1/1**; **ONE operator receive-2 invocation remains APPROVED_UNCONSUMED / UNRUN**.
Parent next delivers the generated literal command for **COPY into host Fish at repository root**, then waits **only for HOST output verification**, with no new planning question.
Latest helper-source commit/push remains **98749410eda3dcadd7a210d3ddb1ac097a9ba13d**; prior alignment push **5c236ef…**, run-1 helper **33b29dd…** and immutable asset source **f3e277d…** retain distinct roles.
The post-push command/records and this outcome documentation remain **LOCAL_UNCOMMITTED**, with publication separately approved by Executor's later explicit **"commit & push"** request.
No additional publication is authorized under the consumed helper-source request; the later approval covers current docs/evidence/command records only, not helper/code changes or operational replay.
This docs pass reads retained sources/evidence only; it runs no command, syntax check, test, native tool, network request, host operation or agent.
Earlier requests, receipts, summaries and the source-2 `host-inputs.json` remain byte-unchanged historical projections.

### Selected qualification source — same Rust userspace, pinned Bun interpreter only

The qualification [Dockerfile](../tooling/runtime/Dockerfile.gpu-qualification) now uses the same exact Rust pin for `inputs` and `runtime`.
A separate `bun-interpreter` stage uses pinned Bun `18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038` and copies **only `/usr/local/bin/bun`** into the Rust runtime.
The qualification-only `COPY gpu-build/rootfs/` is removed; the source uses base-provided builder tools rather than a speculative GNU library transplant into a different Bun userspace.
The prepared runtime overlay now contains the selected **libdevice bitcode and vendor LICENSE**, not a full toolkit or proved runtime-library closure.
Future build preflight checks actual executable Rust/Cargo **1.95.0** before project compilation; runtime construction checks Bun **1.4.0** startup.
These guards have not executed in an image; all `RUN` instructions declare `--network=none`.
The four locked/offline Cargo `--no-run` commands, prepared GPU feature, separate absolute CPU/GPU targets and UID `1000` scratch/evidence behavior stay intact.
Both production Dockerfiles remain unchanged; new static assertions compare their SHA-256 values against retained local-6 baselines.
No Rust/model/learning-math, F64/4,670-coordinate/tolerance, exact C12, CPU Flex initialization or master `101..105` change follows.

### Retained DRAFT publisher source proof — source-6, separate from original payload lineage and receive-2

The [source-6 receipt](../_work/gpu-owner-recovery/runs/gpu-input-transfer-source-6/receipt.json) records **PASS_TRANSFER_SOURCE_ONLY**, `failure:null`, `sourceChanged:false`, **316 frozen source hashes / 65 unchanged native inputs**, and six passing stages.
Its [raw transfer-unit summary](../_work/gpu-owner-recovery/runs/gpu-input-transfer-source-6/transfer-unit/command.stderr) confirms **89 helper tests / 438 assertions**.
Its [raw qualification-unit summary](../_work/gpu-owner-recovery/runs/gpu-input-transfer-source-6/qualification-unit/command.stderr) confirms **37 tests / 280 assertions**: 23 qualification + 9 existing recipe + 5 prepared-verifier cases.
Four typechecks cover root source, tests, qualification and transfer helper configurations.
This is the active identity request's exact publisher gate; **do not substitute source-5 or source-4**.
The unchanged [source-5 receipt](../_work/gpu-owner-recovery/runs/gpu-input-transfer-source-5/receipt.json) preserves the closed second attempt's **311 hashes / 88 helper tests / 428 assertions / 37 qualification tests / 280 assertions + four types**.
It is historical full-publisher proof after the authorized identity/helper edits, not current source-6 proof.
Transfer source-4 remains historical **87/422**, before the final private-origin capture fix.
The unchanged [source-3 receipt](../_work/gpu-owner-recovery/runs/gpu-input-transfer-source-3/receipt.json) remains original preparation lineage: **303 hashes / 83 helper tests / 371 assertions / 37 qualification tests / 280 assertions + four types**.
It is not current full-publisher proof after the authorized helper edits.
Shared `sourceInputPaths`/`sourceInventory` now include unchanged `schemas/feature-layout.json`, required by policy-io's CPU score test through compile-time `include_str!`; the prior native inventory had 64 entries.
Source-6 freezes current publisher/request/helper sources, original preparation/first failure, and the second attempt's **publication.json, reuse.json and outcome-check.json** metadata.
It retains the unchanged 65-native filename/hash binding.
The third retained outcome check matched all **316 raw committed source blobs** to source-6 at that snapshot; changed shared-publisher/receive-2 sources now bind source-4, while old requests/proofs/receipts stay immutable and this docs pass edits no helper or evidence.
The earlier second-attempt reuse/outcome check matched source-5 at its own capture time, not the later modified publisher.
The qualification tests retain **ten `/bin/sh -n` RUN-body syntax checks only**; those checks execute no RUN body, compiler/version preflight, Cargo build or image operation.
Production Dockerfiles, the retained local-6 baseline JSON and the LLVM receipt used by static tests remain explicitly bound.
The [qualification-source-4 receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-source-4/receipt.json) remains unchanged historical **36/278 + four types, PRE_65_SCHEMA_INPUT**, 289 bound inputs/64 native entries and manifest `db8a83709b8c6813fe406cc1325fa2c6987691eecb74dd98c769327d937a7f14`.
Qualification source-3 **36/265** and source-2 **32/223, PRE_RUST_BASE** remain historical.
Transfer source-1/source-2 **80/359** remain historical; source-1 predates registry binding, and source-2 predates the four accepted MEDIUM fixes.
The separate inventory input-helper **8/64 + strict types + direct Fish syntax** proof stays separate from these transfer/qualification stages.
The source-6 receipt records acquisition, LLVM payload reads, preparation, publication, LLVM/Cargo execution and host/GPU execution **false during its checks**.
The pure/mock tests performed no live identity/git-var, origin, rewrite or authentication query.
The original actual preparation outcome below is separate; source-only false fields describe those checks, not denial of completed preparation.
No native-build/image/CUDA/current CPU-regression or publication success follows from source-only proof; the separate third outcome below establishes DRAFT publication only.
Runtime/training entrypoints remain **`SOURCE_ONLY_DISABLED`** and `trainingReady:false`.

### Historical libdevice research — metadata projection retained; actual preparation recorded separately

The [libdevice proposal](../_work/gpu-owner-recovery/qualification/libdevice-proposal.json) records a public official CUDA 13.0 redistribution JSON read, **not a binary archive download**.
Candidate provider **libnvvm 13.0.48 / linux-x86_64** declares **43,941,232 archive bytes**, SHA-256 `8c5676a65a2e6d13e3c229f025af18677de46c220d77992fe932200fa798b19b` and vendor license metadata.
That original proposal's exact-member field remains unknown, `containsRequiredBitcodeEstablished:false`, and extracted SHA remains `null` as its unchanged capture-time projection.
The completed preparation below now establishes the actual selected member and extracted hash without rewriting the proposal.
`13000` is only a CUDARC binding candidate; it is not selected and proves no PTX/driver compatibility.
The [host-build proposal](../_work/gpu-owner-recovery/qualification/host-build-proposal.json) records a cached-source trace of the LLVM route emitting PTX through driver APIs: NVRTC is feature-enabled/lazy but unused on that traced branch, no shared NVVM compiler call was found, and NCCL is an optional presence probe rather than a required single-device collective.
Those are scoped source observations, **not actual runtime library coverage**; `actualLibraryCoverageQualified:false` remains explicit.
The proposed added NVIDIA payload is libdevice bitcode only, plus host-injected driver/PTX-JIT support; no full CUDA toolkit or compiler installation is proposed.

<a id="current-input-transfer"></a>

### Original transfer scope — preparation consumed; first publication STOP remains closed

The [original transfer request](../_work/gpu-owner-recovery/qualification/transfer/request.json) retains **`APPROVED_ONE_PREPARATION_AND_DRAFT_ASSET_PUBLICATION`** from Executor's `Draft assets Recommended` selection.
The old [input-transfer proposal](../_work/gpu-owner-recovery/qualification/input-transfer-proposal.json) retains `selectedTransport:null` and false operation flags as historical projections, not current authority.
The original runtime/host/libdevice requests/proposals and old `host-inputs.json` also remain unchanged.
That request independently approved the exact acquisition, payload read/hash/copy/local staging and single publication attempt with the mutation maxima below.
Download/preparation remain **1/1 consumed each, zero remaining**.
The preparation receipt's old `publicationPerformed:false` / `publicationContinuationAuthorized:true` fields describe the capture before publication, not current permission after STOP.
The first publication attempt is consumed even though its actual commit/push/release/upload invocations were zero; **no commit invocation/grant was consumed**, and unused mutation maxima do not authorize replay.
Original flags remain unchanged; the later **https-publication-request.json** supplied the distinct second grant, now also consumed, never replay authority from old preparation or failure fields.

| Original approved limit / retained result | Bound / stop rule |
|---|---|
| Exact NVIDIA download — CONSUMED | 43,941,232 bytes and SHA `8c5676a65a2e6d13e3c229f025af18677de46c220d77992fe932200fa798b19b`; <=600s; no redirect/fallback/retry |
| Archive inventory/selected extraction — COMPLETED | Exactly one positive-size REGULAR `libdevice.10.bc` <=2 MiB; regular vendor LICENSE/EULA total <=1 MiB; no fallback |
| Existing LLVM payload hash/copy — COMPLETED | <=400 MiB / retained 2,684-entry tree; no LLVM execution, re-download or old archive-pipeline renewal |
| Existing public Cargo payloads — COMPLETED | <=2 GiB / 671 frozen lock-matching identities/checksums; zero fetches; exclude credentials/home configuration/rustup/binaries |
| Frozen native source/tools — COMPLETED | <=16 MiB; unchanged feature schema included; no training data/runtime state |
| Context / compressed bundle — PREPARED | <=3 GiB / <=1 GiB; five explicit roots and a NUL member list, `--no-recursion` |
| Local preparation — CONSUMED | >=8 GiB initial free; <=8 GiB soft payload-use cap, **not filesystem-quota assurance**; hash/copy/package <=900s |
| First publication attempt — CONSUMED / STOP | Historical <=600s clock; origin-fetch STOP after 31.82 ms; later fresh request is distinct, no automatic retry |
| First-attempt mutation invocations — ALL ZERO | Commit 0 / push 0 / release creation 0 / uploads 0; no external mutation or consumed commit invocation/grant; not replay permission |
| Historical mutation maxima — NOT REPLAY AUTHORITY | One normal source commit/HTTPS push, one DRAFT `gpu-feasibility-inputs-20261110-1` and two uploads in fixed `proveo-ca/chess-coach` / `feat-ml-adjuntant-ii` |

The only assets are **`host-feasibility-inputs-1.tar.gz`** and **`host-feasibility-inputs-1.manifest.json`**.
The initial publisher rejected SSH origin metadata before auth/API; that closed failure is retained below.
The HTTPS transport contract still accepts exact repository SSH metadata while fixing every Git network target to HTTPS.
The second scope is consumed; the distinct [identity scope](#current-identity-publication) supplied the third DRAFT publication, now successful and consumed too.
No credential/auth/Git configuration changes, overwrite, public release publication, deletion, automatic retry or preparation replay is authorized.
That old transfer grant authorizes no further operator download/extraction or host work; the later [handoff observation](#current-host-receive) records its distinct operator invocation consumed 1/1 at report scope, never build/GPU/training authority.
All earlier pull/container/cleanup, LLVM/Mise/cache/metadata and other native grants remain spent; that narrow transfer grant did not renew them.
The download/preparation allowances are now also spent and **cannot be rerun**, even though their original request remains approved in source.

#### Implemented helpers and accepted review pivots

- [prepare.ts](../_work/gpu-owner-recovery/qualification/transfer/prepare.ts) uses exclusive directories/fresh attempt markers, streams the exact single archive, and invokes bounded GNU tar only on that **new** vendor archive through [archive.ts](../_work/gpu-owner-recovery/qualification/transfer/archive.ts).
  It lists before selected-member stdout extraction, hashes extracted files, stages `current-native`, `qualification-tools`, `cargo-home`, `gpu-build/llvm` and `gpu-runtime/rootfs`, then packages only the explicit NUL list with `--no-recursion`.
  LLVM binaries never run; missing approved Cargo archives/metadata are recorded without fetching or repairing them.
  The successful preparation retains `completeOfflineBuildCoverageQualified:false`.
- `checkSourceGate` and `requireReviewedNativePaths` reject newly discovered native paths outside the reviewed gate.
  Native hashes must match the gate before copy and the streamed copied bytes must match those hashes.
  The source verifier also freezes imported `provision.ts` and detects native filename-set changes.
- The original [publish-prepared.ts](../_work/gpu-owner-recovery/qualification/transfer/publish-prepared.ts) belongs to the closed first attempt.
  [publish-https.ts](../_work/gpu-owner-recovery/qualification/transfer/publish-https.ts) now exports shared `publishPreparedHttps(activeRequest)`; the fresh [publish-inherited-identity.ts](../_work/gpu-owner-recovery/qualification/transfer/publish-inherited-identity.ts) entry supplies the new identity request and source-6 gate.
  [runPublisher](../_work/gpu-owner-recovery/qualification/transfer/publish.ts) runs **at top level**, never inside a `runBounded` worker; only individual commands use `runBounded` with the shrinking remaining publication budget.
- The third attempt created the asset manifest **after the exact source push**, inside ignored cache, to name that commit without a commit/hash cycle or changed bundle.
  The first two attempts reached neither source push nor manifest creation; the successful third grant is consumed, not replay authority.
  Before release creation and finally, the publisher uses actual `git ls-remote` tag/peeled resolution; only absence or the exact pushed commit is allowed.
  Wrong/malformed refs, changed source/bundle, non-draft/wrong-target releases or unexpected assets stop without repair.
- Attempts are recorded **before** mutations; `commitSucceeded` becomes `null` after an attempted commit until success is confirmed.
  Lost capture is an unknown outcome, not proof that a commit failed or permission to retry.
  Partial releases/uploads and available evidence remain retained; supplied API asset SHA digests must match, while absent API digests are explicitly recorded `null` rather than called remote hash verification.

Executor previously reported DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` **READY within the then-active grant** and adversarial `ses_e3cea2a1cffeBacqiaDdQkXxlq` accepting all four MEDIUM fixes.
Executor reports security `ses_e3cea2a12ffe9TMeXvXBhDE8n7` without scoped findings for the approved operational/auth scope; that source-2 review predates the four fixes and is not a source-3 re-review claim.
These retained source/authority verdicts supply neither current functional READY, permission to override the later STOP, completed-operation acceptance nor native/build/GPU proof.

<a id="current-prepared-input-bytes"></a>

#### Completed preparation and independent byte-check snapshot

One approved [prepare.ts](../_work/gpu-owner-recovery/qualification/transfer/prepare.ts) invocation completed; the [parent receipt](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/receipt.json) records both download and preparation workers **PASS / exit 0**, with configured 600s/900s client bounds and no retry.
The [download record](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/download.json) records **HTTP 200**, exactly **43,941,232 bytes** and SHA-256 `8c5676a65a2e6d13e3c229f025af18677de46c220d77992fe932200fa798b19b`.
The [preparation record](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/preparation.json) and retained [archive listing](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/archive-list.stdout) establish the unique regular selected bitcode and regular vendor LICENSE.

| Prepared input / output | Recorded bytes / identity |
|---|---|
| `libnvvm-linux-x86_64-13.0.48-archive/nvvm/libdevice/libdevice.10.bc` | **464,132**; SHA `91334d6e12748f6cb5bbf0a1cd965a56bcd93dc4f496d2e5c5f8c6e523094356` |
| `libnvvm-linux-x86_64-13.0.48-archive/LICENSE` | **67,875**; SHA `f176e5fd245a4ff1d7aee743e345e14b29c4b724f150e4858c4c6a313966d1fb` |
| Native inventory / source-tools budget use | **65 inputs / 663,642 bytes**; schema path preserved |
| Existing LLVM payloads | **329,242,172 bytes** hashed/copied from 2,684 retained metadata entries; no LLVM execution |
| Existing public Cargo payloads | **98,780,903 bytes**; **568** locked archives / **618** index metadata files; **103** locked archives missing / **0** missing metadata; no fetch |
| Prepared context | **429,218,730 bytes**; **3,800 files / 137 recorded directories / 2 symlinks** checked separately |
| Compressed bundle | **140,694,281 bytes**; SHA `9001bfeb88ce5433138d5f0fd23b3c7ab0590cc0bd47900cc1c0a1d6923c65f7` |
| Workspace payload accounting | **614,911,523 bytes**, a soft usage measure, **not a filesystem quota** |

The [context manifest](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/context-manifest.json) has SHA `64e8c6f2ea895fb8fac1821d48fc5b39a93122e8fdb5f35c4f8fbcd6494c7838`.
The original source-3 gate receipt has SHA `71eacd85ecbcb69752f8814181e975eb92d7b7b5432fa921c388305eae9caaa5` and retains its **303** frozen source identities.
The separate [checker](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/verify-prepared.ts), [result](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/prepared-check.json) and [stdout](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/prepared-check.stdout) record **PASS_PREPARED_INPUT_BYTES_ONLY**.
It rehashed all 3,800 context files and the bundle, checked recorded directories/links and absence of unlisted non-directory payload, bound 65 native inputs/embedded inventory and 303 source hashes, and checked four captured preparation streams.
It also matched **three** diagram coverage lists to the index **before this documentation update**.
Those matches remain historical evidence for that snapshot, not a fresh verification receipt for the changed diagrams/index; this docs pass reruns neither checker nor payload reads/hashing.
Original source-3 proof/review records remain immutable preparation history, not fresh acceptance of modified publisher code.
Payloads remain in ignored cache, outside tracked evidence; coverage follows the bounded run directory, not thousands of payload filenames.
**Offline-build completeness remains UNPROVEN** with `completeOfflineBuildCoverageQualified:false`; the 103 absent locked archives do not establish which a future selected build needs, prove build failure or authorize fetching/repair.

<a id="current-publication-stop"></a>

#### Closed first publication FAIL — origin mismatch before auth/API or external mutation

Executor reports exactly one approved **top-level `publish-prepared.ts` invocation**.
The retained [publication.json](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/publication.json) records **FAIL**, `failure:PUBLICATION_ORIGIN_MISMATCH`, `failedStep:origin-fetch` and **31.820182000000003 ms** elapsed.
[publication.operation](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/publication.operation) retains the attempted publication marker for the fixed tag.
The [branch capture](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/publish-01/command.stdout) matches `feat-ml-adjuntant-ii`.
The [fetch-origin capture](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/publish-02/command.stdout) is exactly **`git@github.com:proveo-ca/chess-coach.git`**, with exit 0 and empty stderr.
The initial publisher's HTTPS-only origin-metadata validator rejected that SSH URL; this was a local contract mismatch, **not an authentication/API/network failure**.
The attempt did not reach the push-origin query or any GitHub auth/permission API check.

| Actual publication accounting | Retained result |
|---|---|
| Publication invocation | One, consumed / STOP; no automatic retry |
| Mutation invocations | **commit 0 / push 0 / createRelease 0 / upload 0** |
| Frozen/manifest callbacks | **validateFrozen 0 / commitManifest 0** |
| Source/pushed commit and release ID | **null / null / null** |
| Assets / uploaded assets / verified assets | **[] / [] / []** |
| `commitSucceeded:false` | Commit never attempted here; not a failed commit or lost-capture outcome |
| External mutation | **None** |

**The first attempt remains consumed; the distinct later HTTPS attempt is now consumed too.**
Zero commit invocations do not mean that a commit grant was consumed, and they do not leave the stopped publication replayable.
Do not change the Git remote/auth configuration, rerun the publisher, manually commit/push, clear/reset the stage or rerun preparation under the old request.
At that first STOP, the latest confirmed pushed source was **`d3bb6bcc6420f50c559ad7260f968578e20cf725`**; the later third outcome advances it to **`f3e277dbbf33c0aa69172cca1890792656d4cd09`**.
At the first STOP, Executor reported **122 controlled text paths staged but NOT committed/pushed**.
That state and the later **161-file** stage snapshot remain chronology; the third outcome records **193 controlled changed text paths** in the actual source commit.
The [stage audit](../_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/stage-audit.json) and its expected pre-attempt snapshot remain historical; these later documentation edits are not a fresh stage-audit result.
This docs pass changes only working-tree `_spec/` text, never the Git index/stage, requests, audit or receipts.
Prepared bytes/context/bundle and original source-3 receipt remain retained; the DRAFT-generation publisher was separately frozen by source-6, while current receive-2/shared-publisher changes bind source-4 rather than old helper hashes.
This pass rereads no payload and runs no integrity checker.
At that first STOP, completed operational evidence was **prepared-input bytes only plus the first FAIL**.
The distinct second outcome below adds another closed failure, not publication success or functional readiness READY.

<a id="current-https-publication"></a>

#### Explicit-HTTPS publication-2 — FAIL at commit; attempt and commit invocation consumed

Executor resolved the previous three-route fork by selecting **Explicit HTTPS Recommended** after the first STOP.
The [fresh request](../_work/gpu-owner-recovery/qualification/transfer/https-publication-request.json) records **APPROVED_ONE_FRESH_PUBLICATION_ATTEMPT_ONLY**.
Local-only retention and alternate HTTPS destination were not selected at that earlier fork.
The request's original approval status remains unchanged as a historical authority projection; the one allowed second attempt is now consumed.
Earlier **APPROVED/UNCONSUMED / NOT RUN** and **future / NOT CREATED** documentation described the pre-attempt boundary correctly, not the current outcome.

| Consumed second scope — historical maxima, not remaining authority | Exact bound / exclusion |
|---|---|
| One fresh publication attempt | **600s total shrinking budget**, including origin/rewrite callbacks, permissions, commit/push/tag checks, manifest and release/uploads; no automatic retry |
| Source mutation maxima | **One normal commit / one explicit HTTPS push**, verified commit OID to `feat-ml-adjuntant-ii`, fixed repository `proveo-ca/chess-coach` |
| Git network destination | Literal **`https://github.com/proveo-ca/chess-coach.git`**, never an origin alias or SSH destination |
| Release/assets | **One DRAFT** `gpu-feasibility-inputs-20261110-1`, **two uploads** with the unchanged approved asset names; no overwrite/public publish/delete |
| Existing prepared payload | **140,694,281-byte** bundle, SHA `9001bfeb88ce5433138d5f0fd23b3c7ab0590cc0bd47900cc1c0a1d6923c65f7`; context manifest SHA `64e8c6f2ea895fb8fac1821d48fc5b39a93122e8fdb5f35c4f8fbcd6494c7838`; **65** unchanged native inputs |
| Historical second source gate | Exactly **gpu-input-transfer-source-5/receipt.json**, then-current 311-hash proof; current identity publisher instead binds source-6 |
| Authentication/configuration | Existing auth only; **no Git/auth configuration changes**, no applicable transport rewrite allowed |
| Excluded replay/work | **No download, LLVM prefix read/copy, Cargo fetch, copy/repack/preparation replay, operator download/extraction, build/compilation, host/GPU execution or training** |

The source-5 [publisher](../_work/gpu-owner-recovery/qualification/transfer/publish.ts) used by the second attempt admitted only exact repository HTTPS/SSH origin forms as metadata.
Every Git push and tag-read target is the fixed HTTPS literal; push uses the inspected **commit OID**, not mutable `HEAD` or an origin alias.
Read-only rewrite queries use the **same cwd/environment and shrinking timeout** as publication, with a **64 KiB buffer cap**.
Any applicable `insteadOf` or `pushInsteadOf` prefix rejects, even an identity rewrite; the helper sets no configuration and makes no remote/auth configuration repair.
Origin expansion also uses a private Boolean query rather than a persisted command result.
Both raw origin and rewrite outputs stay **in memory**; only verdicts/counts enter publication results, so expanded credential-bearing URLs are not copied into command captures.
These source contracts remain unchanged.
The second attempt's actual private origin/rewrite results passed as recorded below; that scoped result is neither asset-upload proof nor a new pretraining hardening requirement.

At the second attempt, [publish-https.ts](../_work/gpu-owner-recovery/qualification/transfer/publish-https.ts) checked the then-current full **source-5** gate and immutable original preparation/failure records.
The exported shared helper now uses the active request's gate; the new third request binds source-6 as described below.
It hashes the original source-3 receipt bytes as lineage; it deliberately does **not** compare source-3's old full helper hash set against the authorized publisher edits.
`requireUnchangedNative` requires exactly 65 original/current native path+hash entries and unchanged membership in the new gate.
It revalidates the approved prepared bundle/context identities without recopying LLVM, fetching Cargo or repacking anything.
The second attempt never reached its post-commit raw-blob check or external manifest path.
Those paths subsequently passed under source-6 in the third attempt, with no lazy fetch and an exclusive ignored-cache manifest created **after exact source push**, outside the source commit.

The evidence root `_work/gpu-owner-recovery/runs/host-feasibility-publication-2` **NOW EXISTS**.
It retains [publication.json](../_work/gpu-owner-recovery/runs/host-feasibility-publication-2/publication.json), [publication.operation](../_work/gpu-owner-recovery/runs/host-feasibility-publication-2/publication.operation), [reuse.json](../_work/gpu-owner-recovery/runs/host-feasibility-publication-2/reuse.json), `publish-01..04` command streams and the separate [verify-outcome.ts](../_work/gpu-owner-recovery/runs/host-feasibility-publication-2/verify-outcome.ts) / [outcome-check.json](../_work/gpu-owner-recovery/runs/host-feasibility-publication-2/outcome-check.json).
Its bounded run-directory glob is now covered and indexed; original preparation/source-3/first-failure records remain unchanged.

| Actual second-attempt result | Retained evidence / limit |
|---|---|
| Attempt | One top-level HTTPS publisher invocation; **FAIL / PUBLICATION_COMMAND_FAILED / commit**, **838.463473 ms**, not a deadline failure |
| Branch / private origins / HTTPS rewrites | PASS; both origin callbacks passed; one rewrite check allowed with **rules:0**; no raw private-query output persisted |
| Existing authentication / repository permission | `gh api repos/proveo-ca/chess-coach` PASS, **permissions.push:true**; **release-asset upload rights NOT PROVED** |
| Historical freeze/reuse | **PASS_UNCHANGED_PREPARED_BYTES_AND_CURRENT_PUBLISHER**; original **65** native identities, approved bundle/context, original source-3 receipt lineage and then-current source-5 gate matched |
| Git commit | **Invoked once / exit 128**; [publish-04 stderr](../_work/gpu-owner-recovery/runs/host-feasibility-publication-2/publish-04/command.stderr) says **Author identity unknown** and **fatal: empty ident name** |
| Actual mutation counters | **commit 1 / push 0 / createRelease 0 / upload 0**; second commit invocation is consumed despite failure |
| Callbacks | **validateFrozen 1 / checkOrigin 2 / checkTransport 1 / commitManifest 0**; post-commit/tag/release checks not reached; no sidecar manifest created |
| Historical receipt fields | **commitSucceeded:null**, sourceCommit/pushedCommit/releaseId null, asset arrays empty; retain these bytes unchanged |
| Separate read-only HEAD observation | Outcome check records `d3bb6bcc6420f50c559ad7260f968578e20cf725`, unchanged from last confirmed push, **observedNewHeadCommitCreated:false** |

The old source-5 [publisher allowlist](../_work/gpu-owner-recovery/qualification/transfer/publish.ts) omitted **GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME and GIT_COMMITTER_EMAIL** from its child environment.
The metadata-only outcome check records **all four parent presence flags true** and `childPublisherForwardsGitIdentityEnvironmentFields:false`.
It records **no identity values**; this docs pass reads no parent environment values.
These facts support the narrow inherited-identity omission finding, not a validated author identity, a Git configuration defect diagnosis or permission to invent/set an author.
The check's **PASS_RETAINED_FAILURE_RECORD_CHECK_ONLY** is a separate retained observation, not a rewrite of `commitSucceeded:null`, successful publication or acceptance of a repair.
It checks retained text/record/source-gate metadata and observes HEAD read-only; it does not reacquire, copy, repack or read prepared payloads.
This docs pass does not rerun that checker or any query/hash operation.

**Both prior publication attempts are CONSUMED / STOP.**
The second attempt consumed **one actual commit invocation**; unused push/release/upload maxima authorize no retry.
At that second STOP, inheritance/new proof/a third attempt were not yet approved or implemented.
Executor has since resolved the three-proposal fork through **Inherit Identity Recommended** and the distinct active request below:

1. **Selected and implemented in source:** forward the existing four inherited identity fields unchanged, with source-6 proof and one separately approved third attempt.
2. **Not selected:** operator-owned normal commit/push.
3. **Not selected:** stop local without publication.

Do not set/invent an identity, follow captured Git configuration advice, retry either old attempt or replay preparation.
At the second STOP, Executor reported **161 bounded text files / 2,235,091 text bytes staged**, original 122 preserved, with pub2 evidence untracked and no new HEAD commit.
That snapshot and the later pre-third-attempt unstaged state remain historical; the third source commit now includes the controlled identity helpers/request/source-6 proof and prepublication docs/status.
This docs pass does not stage/reset or modify those snapshots.
The [gate-closure outcome](gate-closure.md#current-https-publication) records the same consumed boundary; [gpu-input-transfer.puml](gpu-input-transfer.puml) owns its lineage and environment reasoning.
At the second STOP, the last confirmed push was `d3bb6bcc6420f50c559ad7260f968578e20cf725`; the third outcome below confirms `f3e277dbbf33c0aa69172cca1890792656d4cd09`.
No new functional or hardening gate is introduced here.
The [host-build proposal](../_work/gpu-owner-recovery/qualification/host-build-proposal.json) keeps its original false/null fields; this grant does not populate or approve operator destination/download, image/native build, host deadline/CPU/RAM or cooperative GPU limits.
Original requests and both failure receipts remain retained; the HTTPS publisher ran once but its attempt failed at commit, without a source push or broader host/build/GPU grant.
Canonical BOTH/reference/orderly-close, integrated R4, five-master activation and literal-UUID telemetry/coexistence remain outside backend feasibility.
ALL security/privacy/isolation hardening remains LAST after **ALL planned training completes and results validate**; full assurance stays OPEN and `trainingReady:false` stays unchanged.

<a id="current-identity-publication"></a>

#### Inherit Identity publication-3 — PASS / grant CONSUMED; DRAFT and two assets verified

Executor selected **Inherit Identity Recommended** after the second STOP.
The [identity-publication-request.json](../_work/gpu-owner-recovery/qualification/transfer/identity-publication-request.json) supplied **ONE fresh 600s publication attempt**, not replay of either old request.
The approved top-level invocation completed **PASS**, consuming **one normal commit / one literal fixed-HTTPS commit-OID push / one DRAFT / two named uploads** with existing auth and unchanged inherited identity.
Its original approval projection stays byte-unchanged; the retained outcome now closes that grant with **zero further attempt/commit/push authority**.
Repository, branch, tag, assets, original **140,694,281-byte bundle/context identities** and **65 native inputs** retain the exact bounds above.
It authorizes no identity value changes/persistence, configuration changes, hooks bypass, automatic retry, download/copy/repack/preparation replay, operator download/extraction, image/native build, host/GPU execution or training.

Implemented [publicationEnvironment](../_work/gpu-owner-recovery/qualification/transfer/publish.ts) copies only existing **GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME and GIT_COMMITTER_EMAIL** values unchanged into the in-memory child environment.
It supplies no defaults or invented author, does not mutate the parent environment and does not serialize identity values into helper results/captures.
The same child environment and cwd serve the commit and private checks.
The new private `identity-preflight` first requires all four fields, then queries **git var GIT_AUTHOR_IDENT** and **GIT_COMMITTER_IDENT**.
Both queries use the shrinking publication deadline and **64 KiB** buffer cap; they require exit 0, empty stderr and nonempty stdout.
Only the Boolean callback decision reaches publication status; raw identity output stays in memory, outside persisted command streams.
False stops with **EXISTING_GIT_IDENTITY_NOT_ACCEPTED** before mutations.
The actual private `identity-preflight` passed once within the publication budget; no raw identity output or identity values enter these docs.
This is the selected bounded check, not a new identity-hardening gate.
Private origin/rewrite handling and literal HTTPS/verified commit-OID push remain unchanged, with no config setters or hooks bypass.

The single completed top-level entry was [publish-inherited-identity.ts](../_work/gpu-owner-recovery/qualification/transfer/publish-inherited-identity.ts), calling exported **publishPreparedHttps(activeRequest)** from [publish-https.ts](../_work/gpu-owner-recovery/qualification/transfer/publish-https.ts).
The shared helper preserves original preparation/source-3 receipt/native65/bundle/context/first-failure lineage and uses **source-6**, not obsolete full source-3 or source-5 helper hashes, for current publisher proof.
Its optional `priorFailure` validates the retained second FAIL at commit with **commit 1 / push 0 / createRelease 0 / upload 0**.
Source-6 additionally freezes the second publication/reuse/outcome metadata; no old receipt or `commitSucceeded:null` value changes.
Post-hook raw committed Git blobs matched the active gate without lazy fetch; the exclusive external manifest was created after exact source push and intentionally remains outside that commit.
Reuse validation checks existing identities; it is not another preparation, LLVM prefix read/copy, Cargo fetch or repack grant.

The exact completed DRAFT-publication gate is [gpu-input-transfer-source-6/receipt.json](../_work/gpu-owner-recovery/runs/gpu-input-transfer-source-6/receipt.json): **316 hashes / 89 helper tests / 438 assertions / 37 qualification tests / 280 assertions / four typechecks**, six PASS/exit-0 stages and unchanged native65; changed receive-2/shared-publisher source uses the separate source-4 gate below.
Its source-only/mocked checks remain separate from the actual publication outcome.
The now-existing [publication-3 receipt](../_work/gpu-owner-recovery/runs/host-feasibility-publication-3/publication.json) records **PASS**, `failure:null`, `failedStep:null`, **21,178.921619 ms** and `commitSucceeded:true`.
Its root also retains `publication.operation`, [reuse.json](../_work/gpu-owner-recovery/runs/host-feasibility-publication-3/reuse.json), **publish-01..17** streams, [verify-outcome.ts](../_work/gpu-owner-recovery/runs/host-feasibility-publication-3/verify-outcome.ts) and [outcome-check.json](../_work/gpu-owner-recovery/runs/host-feasibility-publication-3/outcome-check.json) plus stdout/stderr.
The bounded root is now covered/indexed; both prior STOPs and original preparation remain unchanged.

| Actual third-attempt result | Retained evidence / boundary |
|---|---|
| Mutations | **commit 1 / push 1 / createRelease 1 / upload 2**; no retry or pipeline replay |
| Source/pushed commit | **`f3e277dbbf33c0aa69172cca1890792656d4cd09`**, normal commit and explicit `https://github.com/proveo-ca/chess-coach.git` OID push to `feat-ml-adjuntant-ii` |
| Private checks/callbacks | **checkIdentity 1 / checkOrigin 6 / checkTransport 4**, all PASS, rewrite rules 0; **validateFrozen 3 / commitManifest 1** PASS |
| Reuse | **PASS_UNCHANGED_PREPARED_BYTES_AND_CURRENT_PUBLISHER**, original native65/source-3/bundle/context/both failures plus current source-6; no download/copy/repack/compilation |
| Release | **439935095**, **draft:true**, **published_at:null**, target exact source OID, `tag_name:gpu-feasibility-inputs-20261110-1` |
| Final Git tag lookup | Empty retained `publish-17/command.stdout`: **ABSENT_WHILE_DRAFT**, accepted; API `tag_name` is not a created remote Git tag or public release |
| Source commit boundary | **193 controlled changed text paths**, matching stage audit; no binary/cache payloads; prepublication docs/status only |

The final retained API supplies the actual [DRAFT release HTML URL](https://github.com/proveo-ca/chess-coach/releases/tag/untagged-56714ddf138f3c4ba16c).
Both final assets have **state:uploaded** and matching size/SHA-256 metadata:

| Asset / ID | Bytes | SHA-256 |
|---|---:|---|
| `host-feasibility-inputs-1.tar.gz` / **730047564** | **140,694,281** | `9001bfeb88ce5433138d5f0fd23b3c7ab0590cc0bd47900cc1c0a1d6923c65f7` |
| `host-feasibility-inputs-1.manifest.json` / **730048215** | **868,843** | `2676780f2b932d0453fef05ad39581152f47efeaea11ae22b9079875fece1829` |

The separate checker records **PASS_RETAINED_PUBLICATION_EVIDENCE_ONLY**.
It rehashed the external sidecar and checked its source/gate binding, validated the retained final API's exact DRAFT/target/tag/two uploaded asset metadata, checked **316 raw committed source hashes** and **193 controlled changed text paths** against stage audit, and hashed **38 pre-check evidence files**.
It repeated **no live GitHub query**, download/copy/repack or preparation; this docs pass reruns neither it nor any hash/query/payload read.
The sidecar was written **after source push**, intentionally uncommitted to avoid a source-commit/hash cycle; publication outcomes likewise do not belong inside the source commit they describe.

At that DRAFT-asset publication, confirmed push was **`f3e277dbbf33c0aa69172cca1890792656d4cd09`**; the later helper handoff below confirms **`33b29dd095a3582a02861cef0f155e675a6721cc`**, without changing the asset source.
Executor reports local `origin` tracking still at `d3bb6bcc6420f50c559ad7260f968578e20cf725` after the explicit-URL push; `ahead 1` does not establish an unpushed commit, and no fetch is needed or authorized.
Earlier 122/161-file/source-5 stage snapshots remain history, not the final source-6 commit audit.
The later helper handoff published retained pub3 evidence/pre-handoff docs at **33b29dd…**; Executor subsequently reports docs/post-handoff records published at **cca45f6…**, both grants consumed. New observation/alignment/source-proof records and latest documentation edits remain **LOCAL / UNCOMMITTED**; this pass stages/commits/pushes nothing.
Source-6 requests/proof and historical receipts remain immutable; changed shared-publisher/receive-2 helpers bind source-4, not the old snapshot's full helper hashes.
The [gate-closure outcome](gate-closure.md#current-identity-publication) records the same consumed boundary; [gpu-input-transfer.puml](gpu-input-transfer.puml) owns environment/lineage contracts.

**Upgrade complete: input preparation + DRAFT publication only.**
Offline-build completeness stays **UNPROVEN**; original preparation sizes/missing-archive counts and all bounds remain unchanged, with no compiler/Cargo/GPU execution in this publication step.
The [host-receive observation](#current-host-receive) now records source publication PASS/consumed plus operator-reported Bun-version bootstrap FAIL, invocation consumed at report scope; build/GPU/training remain excluded.
No functional readiness follows: native65/Rust/model/F64/all 4,670 coordinates/exact C12/CPU Flex/masters `101..105`/production recipes remain unchanged; canonical BOTH/reference/orderly-close/R4/telemetry/coexistence remain unproved, runtime/training entrypoints disabled and `trainingReady:false`.
ALL security/privacy/isolation hardening remains AFTER **ALL planned training completes and results validate**, with no new gates.

<a id="current-host-receive"></a>

#### Operator-reported Bun-version FAIL — invocation CONSUMED 1/1; approved alignment separate

Executor corrected the prior stop: **"stop only when a decision of a host command verification is needed"**.
The lead continued source work to the exact combined decision with a reviewed standalone receiver/bootstrap and retained source-only proof.
Executor resolved that prior fork by selecting **Publish+receive Recommended**; the later [approved alignment handoff](#current-host-toolchain) supplies distinct operator-only scope:

| Resolved choice | Exact scope |
|---|---|
| **Publish+receive Recommended — SELECTED** | Coding normal commit/HTTPS push **1/1 completed**, grant consumed; operator now reports bootstrap version FAIL, **1/1 invocation consumed at report scope / zero remaining**, no automatic retry |
| **Adjust host destination — NOT SELECTED** | No destination change or new source rework is authorized by this selection |
| **Defer — NOT SELECTED** | Historical unselected route, not a new planning question or current authority |

The original [handoff-1/request.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/request.json) retains **APPROVED_ONE_SOURCE_PUBLICATION_AND_ONE_OPERATOR_RECEIVE_INVOCATION** from Executor's prior selection; those approval fields stay unchanged history, not fresh scope.
It supplied one normal coding commit/one fixed-HTTPS OID push <=600s and one operator receive invocation <=900s; the source grant is consumed and the operator invocation is now consumed **at report scope**.
That consumed receive request grants no automatic retry/refetch, install/auth/config change, new native version query or dependency inventory; actual host command bytes, source identity and download history remain independently unverified.
The [plan.json proposal](../_work/gpu-owner-recovery/qualification/host-receive/plan.json) keeps **codingSourcePublicationApproved:false / operatorReceiveCommandApproved:false** unchanged as history, not current authority.
The referenced [host-command-approval.json proposal](../_work/gpu-owner-recovery/runs/host-input-receive-source-2/host-command-approval.json) likewise retains its original **AWAITING/false** fields; the later request supplied distinct, now-consumed authority without rewriting either proposal or replaying an old grant.
All old publication/host grants remain consumed.
The [focused owning diagram](gpu-host-receive.puml) documents the contract; [transfer](gpu-input-transfer.puml), [qualification](gpu-qualification.puml) and [build](gpu-build.puml) reference it rather than duplicating receiver internals.

**Keep three published identities distinct; none establishes actual operator execution identity.**

| Identity | Scope / evidence limit |
|---|---|
| Latest docs/evidence **`cca45f6b2978398f68d0db1a84119e1b5a3c0ee2`** | Executor reports one normal commit/HTTPS push, **24 controlled text paths**, worktree clean before this new observation; that publication allowance is consumed |
| Expected receiver helper **`33b29dd095a3582a02861cef0f155e675a6721cc`** | Existing generated command pins this helper; actual operator bytes/source identity are **not independently verified** |
| Prepared assets **`f3e277dbbf33c0aa69172cca1890792656d4cd09`** | Unchanged DRAFT **439935095**, manifest **730048215**, bundle **730047564**, sizes/SHA [recorded above](#current-identity-publication) |

The historical run-1 standalone helper was **17,994 bytes**, SHA-256 **`091a431757ef83710a95156816e085cb1ed36b632e4923c9632695ffe821bafa`**.
Its coding-known command pins **33b29dd…**; the command/receipt remain unchanged history, not current [receive.ts](../_work/gpu-owner-recovery/qualification/host-receive/receive.ts) proof after the receive-2 changes. The current helper SHA and source-4 gate appear below; no zero-OID template is runnable.
That completed helper commit publishes reviewed source/evidence/pre-handoff docs, including retained pub3 records, not new assets or a replacement asset-source commit; retained remote Git tag remains **ABSENT_WHILE_DRAFT**, not a created/public tag.

The [source-2 receipt](../_work/gpu-owner-recovery/runs/host-input-receive-source-2/receipt.json) records **PASS_HOST_RECEIVE_SOURCE_ONLY**, `failure:null`, `sourceChanged:false`, **34 receiver tests / 352 assertions**, **89 transfer tests / 438 assertions**, **37 qualification tests / 280 assertions** and **five typechecks**, eight stages PASS/exit 0.
[Source-1](../_work/gpu-owner-recovery/runs/host-input-receive-source-1/receipt.json) remains historical **31 receiver tests / 280 assertions**, before the final fixes.
The receiver source-proof coding Fish syntax result remains historical **NOT RUN**: it recorded `/usr/bin/fish` absent and the Mise shim unconfigured; pure quote fixtures do not prove Fish parsing, and the new alignment source proof also runs no local Fish parser.
The source-proven [bootstrap.ts](../_work/gpu-owner-recovery/qualification/host-receive/bootstrap.ts) embeds host `fish --no-config -n` before helper fetch, with pure one/two/three-layer backslash/apostrophe quote round trips.

The original [publish-source.ts](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/publish-source.ts) reached private metadata/frozen checks and controlled UTF-8 text audit/staging, then stopped **before commit/push**.
Its retained [publication.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/publication.json) remains **FAIL / SOURCE_PUBLICATION_COMMAND_FAILED**, **213.214362 ms**, commit/push **0/0**, `commitSucceeded:false`.
[command-06 stdout](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/command-06/command.stdout) identifies the unrestricted **git diff --cached --check / exit 2** failure: unchanged raw pub3 GitHub `publish-07/command.stderr` contains trailing whitespace.
Those captured bytes were **not trimmed or rewritten**; the full-check FAIL remains true, and no hooks were bypassed.

The internal [continue-source.ts](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/continue-source.ts) correction admitted only that exact static-check failure with prior commit/push **0/0**.
It anchored remaining time to **publication.started mtime + the original 600s deadline**, with **210,411 ms** left at continuation start; it did not renew the budget or retry a completed operational mutation.
[continuation-02](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/continuation.json) records a **scoped** whitespace check over `_spec`, qualification source and `runs/**/*.ts`, **PASS / exit 0**.
Raw captured streams stay in the evidence/commit but outside that source/spec/task whitespace gate; this is **not an unrestricted full-index PASS**.

The separate [continuation.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/continuation.json) records **PASS_SOURCE_PUBLISHED_OPERATOR_OUTPUT_PENDING**, `failure:null`, `commitSucceeded:true`, commit/push **1/1**, and sourceCommit=pushedCommit=**`33b29dd095a3582a02861cef0f155e675a6721cc`**.
Actual normal commit **continuation-03** and literal fixed-HTTPS OID push **continuation-06** both exited 0, without force/amend/no-verify, identity/auth/config changes or new release/assets.
Frozen source-2 **318 hashes/raw committed blobs** matched; the reviewed helper/original native65 remained unchanged, with lazy fetch disabled and branch/private transport rechecked.
This completed the original run-1 source-publication allowance **once**, now **CONSUMED**; no further commit/push is authorized under that original request.
The bounded run root now retains original marker/audit/command-01..06/FAIL, continuation script/marker/typecheck streams/continuation-01..06/PASS, plus actual generated command/handoff files.
Those task/continuation typecheck streams are separate from the unchanged source-2 five-typecheck receipt; this docs pass reruns no verifier or Fish parser.

The actual [host-command.fish](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/host-command.fish) and [handoff.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-1/handoff.json) were generated **AFTER the successful source push**.
Handoff status is **READY_FOR_ONE_APPROVED_OPERATOR_INVOCATION**, helper OID **33b29dd…**, original asset OID **f3e277d…**, unchanged helper bytes/SHA, and recorded command SHA-256 **`8def4344fb3179ed0c6fc3d7275c9c644da2ae6dd61eb9950c749dba3af7eb76`**.
Those handoff fields retain their pre-invocation meaning; they no longer authorize replay of the now-consumed operator invocation.
The receiver receipt `_work/gpu-owner-recovery/runs/host-input-receive-1/receipt.json` has **not been received**; neither its existence nor absence is independently established.

The new [operator paste](../_work/gpu-owner-recovery/runs/host-input-receive-observation-1/operator-paste.txt) contains exactly:

```text
BOOTSTRAP_STARTED
BUN_VERSION_MISMATCH
HOST_COMMAND_EXIT=1
```

[observation.json](../_work/gpu-owner-recovery/runs/host-input-receive-observation-1/observation.json) records **OPERATOR_REPORTED_BOOTSTRAP_FAIL_BUN_VERSION_MISMATCH**, normalized from terminal paste, **not original host files**.
It records **reportedActualBunVersion:null**, actualOperatorCommandBytesVerified:false, originalHostFilesReceived:false and one consumed invocation/zero remaining.
The first [record-check.json](../_work/gpu-owner-recovery/runs/host-input-receive-observation-1/record-check.json) stays immutable history.
The current [record-check-2.json](../_work/gpu-owner-recovery/runs/host-input-receive-observation-1/record-check-2.json) is **PASS_OPERATOR_REPORT_RECORDS_ONLY** after corrected marker checks.
Its [checker](../_work/gpu-owner-recovery/runs/host-input-receive-observation-1/verify-report.ts) requires both source markers to exist before comparing guard-before-helper-fetch ordering, verifies the three report frames/consumption and the **coding-known expected command SHA 8def…**, not actual operator bytes or source identity.
Under the published mismatch branch, the guard precedes helper fetch/receiver invocation/root creation; this **does not independently prove no download occurred, or prove any host path exists/is absent**.
Reported bootstrap/guard progress is not a formal all-host Fish syntax/runtime PASS; the source-proof coding Fish **NOT RUN** remains its historical scope.

**Superseded saved-file-only next step.** The earlier cat-loop proposal remains history; Executor's later alignment directive does not require these saved records before presenting the host-command decision.
Earlier requested paths remain **NOT RECEIVED**:

- `_work/gpu-owner-recovery/runs/host-input-bootstrap-1/bun-version.stdout`
- `_work/gpu-owner-recovery/runs/host-input-bootstrap-1/bun-version.stderr`
- `_work/gpu-owner-recovery/runs/host-input-bootstrap-1/bun-version.exit`
- `_work/gpu-owner-recovery/runs/host-input-bootstrap-1/command.exit`

The old receive request grants no fresh version query, installation, authentication/config change, helper/asset refetch or receiver retry.
The later alignment handoff below supplies separate scoped approval, not authority derived from the consumed receive request or the proposal's historical false flags.
Bun **1.4.0** remains the unchanged requirement, not a diagnosed host version or a relaxed pin.

| Consumed operator-command bounds | Published contract, not independent execution evidence |
|---|---|
| Outer worker | GNU timeout TERM **895s** + KILL grace **5s**, within **900s** worker budget; surviving parent owns exclusive bootstrap evidence and retains `command.exit` even after worker timeout |
| Helper fetch | ONE plaintext GitHub contents GET at the actual full helper OID, explicit `--hostname github.com`, TERM **55s** + KILL grace **5s**; **128 KiB post-fetch soft admission**, then fixed SHA check before execution |
| Asset downloads | Exact manifest asset first, validate it, then exact bundle asset; explicit GitHub hostname, exact bytes/SHA, **one shared 600s** deadline checked after every completion including the last |
| Archive/verification | Standard GNU tar listing exactly matches unique union of **3,939 manifest rows + five literal roots**, then **one extraction** into fresh context; listing/extraction/verification share **180s** inside outer **900s** |
| Extracted context | **3,800 regular-file hashes / 137 recorded directories / two recorded LLVM links / embedded native65 manifest**, **429,218,730 bytes**, <=3 GiB |
| Workspace | >=**8 GiB** initial free, <=**8 GiB soft workspace use**, bundle <=1 GiB; no filesystem-quota or physical-containment claim |
| Failure accounting | Increment attempts before work; hash/count actual retained bytes after each partial write; preserve partial files/status, no retry/delete/overwrite |

Only the child command environment drops `TAR_OPTIONS`; parent/global configuration remains unchanged, and no new tar engine/arbitrary-archive auditor is introduced.
The file-kind scope is the known generated/published bundle, not the old halted LLVM archive pipeline.
The published, now-consumed command required existing **Bun 1.4.0, gh, Fish, GNU tar/coreutils and authentication** with Mise auto-install false; it supplies no current permission to install, log in or change auth/config.
Published workspace/receiver/bootstrap paths remain `_work/gpu-owner-recovery/cache/host-receive-1`, `_work/gpu-owner-recovery/runs/host-input-receive-1/receipt.json` and separate `_work/gpu-owner-recovery/runs/host-input-bootstrap-1`.
No original host records were received and actual path existence/absence is unverified; none receives coverage as an established local artefact. Coverage follows the coding-side observation/alignment/source-proof records only, not future host outputs.

Executor reports DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` READY **to present this combined decision**, adversarial `ses_e3c122320ffdrHp4JsMATl2iN7` all four findings resolved/READY, and scoped security `ses_e3cea2a12ffe9TMeXvXBhDE8n7` accepting two MEDIUM fixes.
Those preselection source-review verdicts were not operation authority; Executor's later request supplied the now-consumed source/operator allowances and adds no further gate.
At the run-1 observation, Executor reported docs/evidence push **`cca45f6b2978398f68d0db1a84119e1b5a3c0ee2`**, separate from helper **33b29dd…** and assets **f3e277d…**; the later prior-alignment packet was confirmed pushed at **5c236ef…**, no fresh Git operation by this docs pass.
That docs commit published prior post-handoff receipts/docs under its now-consumed allowance; the then-current observation/alignment/source-proof/docs-local state remains historical.
The [current receive-2 packet](#current-host-receive-run2) records the later fixed helper-source publication and separate explicit docs/evidence publication approval.
This docs pass stages/commits/pushes nothing.
No coding installation/native query, configuration/auth change, retry/overwrite/delete, new release/assets/uploads, coding payload acquisition/copy/repack, LLVM/Cargo execution, image/native build, GPU or training operation is authorized; the separate approved operator alignment below adds none of those coding permissions or unrelated template-fetch/maintenance publication scope.
Historical requests/receipts/source proofs remain immutable; current receive-2 source changes bind source-4. This docs pass changes no source/helper/proposal/receipt, runs no command/test/render/query/agent and reads no payload.
Prepared Cargo still has **568 archives / 618 index files / 103 missing archives / zero missing metadata**; `completeOfflineBuildCoverageQualified:false` remains honest, not fetch authority or offline-build proof.
No coding-prefix payload read/copy, refetch/repack, preparation replay, LLVM/Cargo/Docker/native compilation, GPU or training command is authorized.
Native65/Rust/model/F64/all 4,670 coordinates/`eps=1e-6`/`atol=1e-8`/`rtol=1e-5`/exact C12/CPU Flex/masters `101..105`/production recipes remain unchanged; BOTH/reference/orderly-close/R4/telemetry/coexistence remain unqualified, runtime/training entrypoints disabled and `trainingReady:false`.
ALL security/privacy/isolation hardening remains LAST, after **ALL planned training completes and results validate**, with no extra gate.
The [gate-closure observation](gate-closure.md#current-host-receive) records the same consumed-report/unknown-host-data boundary.

<a id="current-host-toolchain"></a>

#### Operator-reported alignment PASS — functional version facts accepted; grant CONSUMED

Executor directed **"the host needs to adjust to bun/rust versions set in this runtime"** after the reported failure.
Executor has now selected **Align host Recommended**.
The distinct [host-toolchain-align-handoff-1/request.json](../_work/gpu-owner-recovery/runs/host-toolchain-align-handoff-1/request.json) records **APPROVED_ONE_OPERATOR_ALIGNMENT_INVOCATION_NOT_YET_OBSERVED**.
That request granted **ONE operator invocation / ONE existing-Mise install / THREE version queries**; its original NOT_YET_OBSERVED/false fields remain a pre-execution snapshot, while the newer report consumes all three allowances at report scope, **zero remaining**.
The source-only [alignment proposal](../_work/gpu-owner-recovery/qualification/host-toolchain/plan.json) retains **AWAITING_HOST_COMMAND_APPROVAL** and `hostInstallationOrVersionVerificationApproved:false` as unchanged preapproval history.
The later actual request supplies approval without rewriting that proposal or the source receipt.
The pure [renderer](../_work/gpu-owner-recovery/qualification/host-toolchain/render.ts) reuses unchanged `quoteFish` and emits a fixed inline Fish command.
It needs no helper download, Git commit placeholder or source-publication prerequisite.
The prior three-choice decision is resolved, not a prompt to ask again:

| Resolved choice | Scope |
|---|---|
| Align host Recommended — SELECTED | ONE operator invocation, ONE explicit pinned install, at most THREE pinned version queries, 900s worker budget including kill grace |
| Inspect command only — NOT SELECTED | Historical alternative, not a prerequisite |
| Defer host changes — NOT SELECTED | Historical alternative, not current authority |

The earlier inline alignment handoff required COPY into host Fish, not an assumed unpushed host path or helper fetch.
That handoff is now consumed history, **not a command to repeat**; actual operator command bytes/source identity remain independently unverified.
The prior alignment packet's normal commit/push is now confirmed at **5c236ef…**, with that separate publication grant consumed too.
The new alignment report resolves the functional version handoff, so source work continued to the [fresh receive-2 combined HOST decision](#current-host-receive-run2), without reinstalling or querying native versions again.

| Historical consumed alignment contract | Bound / evidence limit, not replay authority |
|---|---|
| Existing runtime pins | Root [mise.toml](../mise.toml): `core:bun = 1.4.0`; `core:rust = 1.95.0`, minimal profile, components `rustfmt`, `clippy`, `llvm-tools`, target `x86_64-unknown-linux-musl` |
| Unchanged pin binding | Root SHA-256 `d8f7c2e137514c6cd051fff8972bed14dd1039bc8d00454aa27db6add83168d7`; package Bun 1.4.0 and qualification actual Rust/Cargo 1.95.0 guards stay unchanged |
| Mise prerequisite | Existing Mise required; no installation/upgrade of Mise itself |
| Sole intentional install | `mise install --jobs 1 core:bun@1.4.0 core:rust@1.95.0`; includes configured Rust components/target and routine Rustup bootstrap if missing |
| Three serial queries | `mise exec core:bun@1.4.0 core:rust@1.95.0 -- <tool> --version` for `bun`, `rustc`, `cargo`; exact Bun `1.4.0`, stable `rustc 1.95.0` and `cargo 1.95.0` tokens, rejecting nightly/precision drift |
| No automatic install/trust | Root `auto_install` / `task.run_auto_install` false; child `MISE_AUTO_INSTALL`, `MISE_EXEC_AUTO_INSTALL`, `MISE_TASK_RUN_AUTO_INSTALL` false; explicit install only, step stdin `/dev/null`, stop on untrusted config instead of auto-trusting |
| Config and storage preflight | Verify root config digest before install; GNU `df --output=avail -B1 -- "$HOME" .` requires both values >=8 GiB before install and observes afterward; ordinary checks, not complete tool-store-filesystem coverage, quotas or storage-isolation assurance |
| Evidence ownership and deadline | Prescribed parent-owned `runs/host-toolchain-align-1` metadata outside timed worker; TERM 895s + KILL grace 5s = 900s; original files/unmixed streams and deadline performance are not independently established by the paste |
| Per-step evidence / failure | Separate stdout/stderr/exit for pre/post `df`, install and each query; first failure stops, partial outputs retained, no retry/force/deletion/overwrite |
| Success scope | Reported `PASS_HOST_TOOLCHAIN_ALIGNMENT_ONLY` accepts functional version facts at report scope, not receiver acquisition, image/native build, GPU or training |

Explicit `mise exec` selection applies only to each child.
It changes no global default and makes no PATH-repair claim; plain system `bun` outside Mise is not changed by that child selection.
A later receiver needs **fresh scope/run-2 using the Mise context**, not a rerun of consumed bootstrap-1/receive-1 directories.
The alignment command includes no `mise use/trust/settings/upgrade`, sudo, force/retry, config/auth setter, helper/asset fetch or receive replay.

The actual coding handoff directory `_work/gpu-owner-recovery/runs/host-toolchain-align-handoff-1` contains **request.json**, **verify-handoff.ts** and **handoff-check.json**, covered by its bounded directory glob.
The checker records **PASS_APPROVED_ALIGNMENT_COMMAND_RECORDS_ONLY** for the fixed command SHA, 23 frozen source hashes and four diagram/index matches captured **before this correction**; those matches are historical, not a fresh check of these edits, host execution or Fish parsing.
The new coding-side [operator paste](../_work/gpu-owner-recovery/runs/host-toolchain-align-observation-1/operator-paste.txt), [observation](../_work/gpu-owner-recovery/runs/host-toolchain-align-observation-1/observation.json), [checker](../_work/gpu-owner-recovery/runs/host-toolchain-align-observation-1/verify-report.ts) and [record-check.json](../_work/gpu-owner-recovery/runs/host-toolchain-align-observation-1/record-check.json) now exist; the check is **PASS_OPERATOR_REPORTED_ALIGNMENT_RECORDS_ONLY**.

| Received operator-reported fact | Accepted scope |
|---|---|
| `free-before/install/bun/rustc/cargo/free-after_EXIT=0` | Six reported exit codes; no original separated host streams |
| Bun | **1.4.0** |
| Rust | **rustc 1.95.0 (59807616e 2026-04-14)** |
| Cargo | **cargo 1.95.0 (f2d3ce0bd 2026-03-21)** |
| Final frames | **PASS_HOST_TOOLCHAIN_ALIGNMENT_ONLY / HOST_TOOLCHAIN_EXIT=0** |
| Consumption | **alignment 1 / install 1 / version queries 3**, all consumed, zero remaining |

The observation records **functionalVersionFactsAccepted:true**; the record check accepts reported version facts, not independently verified component/target availability.
Original host files, individual stdout/stderr boundaries and actual executed command/source identity remain unestablished; no custody/assurance gate follows.
Original `_work/gpu-owner-recovery/runs/host-toolchain-align-1` files stay unreceived/uncovered; reported versions apply to the host Mise child context, not the previously inspected builder image or global plain Bun.
No reinstall, new native version query, old receiver replay or download/extraction authority remains.
The historical [alignment source-proof receipt](../_work/gpu-owner-recovery/runs/host-toolchain-align-source-1/receipt.json) records **PASS_HOST_TOOLCHAIN_ALIGNMENT_SOURCE_ONLY**, `sourceChanged:false`, all four stages PASS/exit 0 at its pre-receive-2 snapshot:

1. **10 alignment tests / 91 assertions** in [render.test.ts](../_work/gpu-owner-recovery/qualification/host-toolchain/render.test.ts).
2. Fresh **34 receiver regression tests / 352 assertions** against unchanged bootstrap/receiver sources.
3. Strict TypeScript for the new [alignment project](../_work/gpu-owner-recovery/qualification/host-toolchain/tsconfig.json).
4. Corrected failure-record check producing **record-check-2.json**, with report-only scope.

The retained [host-command.fish](../_work/gpu-owner-recovery/runs/host-toolchain-align-source-1/host-command.fish) has recorded SHA-256 **`aff6b95234f47a031fa41f929922f3a05a0b3b8bdcb152c97c8886de281037e7`**.
The source receipt's `operatorExecutionApproved:false` remains its preapproval snapshot, not a denial of the later handoff's actual approval.
It records local Fish syntax **NOT_RUN_LOCALLY_HOST_PRECHECK_EMBEDDED** and host installation/version query, receiver retry, source publication, native Rust/LLVM execution, compilation and GPU execution **false during source checks**.
The prescribed host `fish -n` precedes installation, but the paste is not formal Fish-parse PASS evidence; local parsing remains NOT RUN.
The old receiver source-2 **34/352 + 89/438 + 37/280 + five types** remains separate proof, not fresh transfer/qualification verification for this alignment.

Executor reports architect `ses_e3b8133fcffefFIv2vv6VoYyeG` accepting minimal reuse/no framework, DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` READY for the host install/verify TUI, adversarial `ses_e3b76f121ffeprkWd1uLezbJvD` no findings/READY and security `ses_e3cea2a12ffe9TMeXvXBhDE8n7` READY for scoped approval, not execution or extra assurance gates.
The [owning sequence](gpu-host-receive.puml) and [gate-closure outcome](gate-closure.md#current-host-toolchain) share this **report PASS / consumed** boundary.
No receiver, asset or rootfs inputs were downloaded in coding; old requests/receipts/pins remain unchanged, while authorized receive-2 source changes bind the new proof below.
The prior alignment packet push **5c236ef24785d937f415cae70900d7825f7baa5f** is historical; latest confirmed receive-2 SOURCE_ONLY helper push is **98749410eda3dcadd7a210d3ddb1ac097a9ba13d**, distinct from run-1 helper **33b29dd…** and assets **f3e277d…**.
Actual CPU regression/GPU/backend/canonical BOTH/reference/close/R4/telemetry/coexistence remain unproved and `trainingReady:false` remains unchanged.
ALL security/privacy/isolation hardening remains AFTER **ALL planned training completes and results validate**, with no additional gates.

<a id="current-host-receive-run2"></a>

#### Historical receive-2 publication/handoff snapshot — before operator report and docs push

**Snapshot scope:** the pending/unrun/local wording in this section predates the accepted receive-2 report and completed docs push **283897c**; preserve it as history, not permission to replay.
The [current report, discrepancy, consumed grants and fresh inventory decision](#current-host-build-inventory) supersede that next-step projection without changing old requests, proofs or receipts.

The lead continued source work under Executor's instruction to stop only at the exact HOST-command decision.
Executor has selected **Publish+receive 2 Recommended**.
The new [handoff-2/request.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/request.json) records **APPROVED_ONE_SOURCE_PUBLICATION_AND_ONE_OPERATOR_RECEIVE_RUN2**, with **sourcePublicationApproved:true / operatorReceiveApproved:true**.
The later [publication receipt](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/publication/publication.json) records **SOURCE_ONLY / PASS**, consuming source commit/push **1/1**.
**ONE operator receive-2 invocation remains APPROVED_UNCONSUMED / UNRUN**; inspect/defer remain unselected historical alternatives, not another prompt.
[plan-run2.json](../_work/gpu-owner-recovery/qualification/host-receive/plan-run2.json) and the source-4 approval proposal retain their **AWAITING/false** preapproval snapshots unchanged; the actual later request supplies authority, not those false flags or an old consumed grant.
The actual handoff-2 root now contains **request.json, stage-audit.json, publication/, host-command.fish, handoff.json, verify-handoff.ts and handoff-check.json**.
The [stage audit](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/stage-audit.json) records **65 controlled text files / 1,005,678 bytes / native65 / binaryOrCacheIncluded:false**.
Its `sourcePublicationPerformed:false` is the unchanged precommit snapshot, not current publication status.
The lead completed **ONE top-level [publish-run2.ts](../_work/gpu-owner-recovery/qualification/host-receive/publish-run2.ts) invocation**, one normal hooks-enabled commit and one fixed-HTTPS OID push to `feat-ml-adjuntant-ii`.
The source commit includes controlled source/spec/evidence and prior alignment records, with no cache/binary payloads.
`publication/` now retains `publication.operation`, `publish-01..09` captured streams and `publication.json`.
The retained [verify-handoff.ts](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/verify-handoff.ts) produced [handoff-check.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/handoff-check.json), **PASS_PUBLISHED_MISE_RUN2_HANDOFF_RECORDS_ONLY**.
Its **329 committed source hashes / four ordered diagram-index matches** describe the pre-correction check, not a fresh verification of this correction or host execution.
This pass reruns no checker; source-4's 329-source proof excludes docs and remains unchanged.

| Actual SOURCE_ONLY outcome | Recorded value |
|---|---|
| Result | **PASS / failure:null / commitSucceeded:true / elapsedMs:5045.911266** |
| Source/pushed commit | **`98749410eda3dcadd7a210d3ddb1ac097a9ba13d`**, both equal |
| Mutation attempts | **commit 1 / push 1 / createRelease 0 / upload 0 / commitManifest 0** |
| Checks | **validateFrozen 3 / checkTransport 2 / checkOrigin 6 / checkIdentity 1**; every recorded operation PASS |
| Scope-specific fields | **publicationScope:SOURCE_ONLY**, `releaseId:null`, `releaseDraft:null`, `assets:[]`, `uploadedAssets:[]`, `verifiedAssets:[]` |
| Non-results | `actualHostExecuted:false`, `cudaGpuCodeExecuted:false`, `trainingReady:false` |

These null/empty release fields describe **source-only publication**, not the retained earlier DRAFT-asset publication.
No tag/release/manifest/upload operation, cached payload read or coding acquisition occurred in this source publication.

Parent NEXT delivers the generated [host-command.fish](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/host-command.fish) **literal contents for COPY into host Fish at repository root**, then waits **only for actual HOST output verification**.
The command was generated **AFTER** checked push; it is **not in the helper commit** and must not be assumed present on the host.
The generated [handoff.json](../_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/handoff.json) records **READY_FOR_ONE_APPROVED_MISE_OPERATOR_RECEIVE_RUN2 / hostExecuted:false / trainingReady:false**.
It binds contents ref/helperCommit **98749410eda3dcadd7a210d3ddb1ac097a9ba13d**, source-4 receipt SHA **9a34af…** and command SHA **`f0feb2c81df00e635e920ad55fd24396305b323a99e5ca87302bf545bf19e95b`**.
Its expected **future** host receipt is `_work/gpu-owner-recovery/runs/host-input-receive-2/receipt.json`, status **PASS_HOST_RECEIVE_AND_EXTRACT_ONLY**; no such result has been received.
Post-push receipts/command and this outcome documentation remain **LOCAL_UNCOMMITTED**.
The helper-source grant remains **CONSUMED 1/1**; it authorizes no additional publication under that request.
Executor's later explicit **"commit & push"** separately authorizes publishing the current post-push outcome/spec/command records only; that docs/evidence publication remains pending, not a helper-source rerun.
Executor identifies the pending set as **seven `_spec` docs/index files plus 24 controlled-text outcome files**, with no implementation/product change.
The helper/source code and helper-source OID **98749410eda3dcadd7a210d3ddb1ac097a9ba13d** stay unchanged after a later docs/evidence commit; no future commit OID or self-containing commit requirement is asserted here.
This later publication approval adds no receive/install/release/asset/native/build/GPU/training or rerun authority; operator receive-2 remains separately APPROVED_UNCONSUMED/unobserved.
No repeated planning question or additional proof gate follows.

| Separate source/operator scope | Fixed contract |
|---|---|
| Frozen request binding | Exact source-4 receipt SHA **`9a34af7785ff55ee1b52bb7c5d71a7297847d3a3a0a1d0cc49316f1c1fa71efd`**; helper **18,396 bytes / ac1cd8af…**, exact current source bytes unchanged |
| Coding SOURCE_ONLY publication — PASS/CONSUMED | ONE normal hooks-enabled commit / ONE literal fixed-HTTPS OID push of **9874941…** to `feat-ml-adjuntant-ii`, within shared **600s**, existing auth/identity only; zero remaining |
| Later docs/evidence publication — separately APPROVED / PENDING | Executor's explicit **"commit & push"** covers current post-push outcome/spec/command records only; no helper/code change, new helper OID or operational replay |
| Operator receive-2 — APPROVED_UNCONSUMED / UNRUN | ONE invocation, **895s TERM + 5s KILL grace within 900s**, helper GET **55s + 5s <=60s**, at most one helper GET/two asset GETs/one extraction |
| Host runtime context | All `MISE_AUTO_INSTALL` / `MISE_EXEC_AUTO_INSTALL` / `MISE_TASK_RUN_AUTO_INSTALL` false **before** `mise exec core:bun@1.4.0 core:rust@1.95.0 -- fish --no-config -c program < /dev/null`; host `fish -n` before helper fetch |
| Same-context guard/helper | Both Bun 1.4.0 guard and verified standalone helper execute inside that Mise context; no install, Rust/Cargo query, trust/global use/settings/PATH/auth/config change |
| Fresh fixed paths | `cache/host-receive-2`, `runs/host-input-bootstrap-2`, `runs/host-input-receive-2`; **future host paths, not captured coding evidence**, old run-1/alignment directories untouched |
| Parent failure capture | Parent exclusively owns bootstrap-2 before timed worker and saves worker stdout/stderr plus exit even if Mise fails before the inner body |
| Assets / extraction | Original manifest **730048215 / 868,843 bytes / 2676780…** first, bundle **730047564 / 140,694,281 bytes / 9001bfeb…** second; full SHA identities [above](#current-identity-publication), one shared **600s** download clock and **180s** listing/extraction/hash phase |
| Ordinary space bounds | >=8 GiB free, <=8 GiB soft workspace use, <=3 GiB context; not quotas, complete tool-store coverage, storage isolation or physical-containment assurance |

[receive.ts](../_work/gpu-owner-recovery/qualification/host-receive/receive.ts) adds closed `selectReceivePaths`: only grants **1/2**, with main artifact labels, receipt fields and stdout receipt path all using the selected generation.
The numerical/asset `receivePlan` constants and `receive(io)` algorithm remain unchanged.
[bootstrap.ts](../_work/gpu-owner-recovery/qualification/host-receive/bootstrap.ts) shares a private renderer, preserves legacy `renderHostReceive`'s exact old **8def4344…** command and adds `renderHostReceive2` for the fresh paths/grant/context.
Per-run selection preserves failed evidence without deleting/reusing earlier directories; it does not grant retries or switch global plain Bun.

[publish-run2.ts](../_work/gpu-owner-recovery/qualification/host-receive/publish-run2.ts) validates the **actual exact approved version/status**, proof receipt SHA, safe integer proof revision **>=3**, helper path/size/SHA and exact mutation/time limits; accepted revisions include **10/29/30**, not a first-digit restriction.
Its three PASS frozen callbacks checked all **329 source-4 hashes** and original preparation's exact **native65** inventory.
After hooks and after push, the callbacks also checked raw committed Git blobs with **GIT_NO_LAZY_FETCH=1**, before generating the command.
It reads source/record metadata, not cached payload bytes.
Reusable [transfer/publish.ts](../_work/gpu-owner-recovery/qualification/transfer/publish.ts) admits `sourceOnly:true` **only** with `runs/host-input-receive-handoff-2/publication`, now actual evidence, retaining existing private metadata/identity/auth guards, counters, clock and explicit HTTPS normal commit/push.
SOURCE_ONLY skips bundle validation/payload reads and returns after the **post-push frozen check**, **before manifest/tag/release/upload**; original DRAFT **439935095**, asset source **f3e277d…** and both uploaded assets remain unchanged.
Successful checked push generated the literal Mise command/handoff using **98749410eda3dcadd7a210d3ddb1ac097a9ba13d**; old **5c236ef… / 33b29dd… / f3e277d…** identities and the zero-OID template remain distinct history, not substitute helper identities.

The current [source-4 receipt](../_work/gpu-owner-recovery/runs/host-input-receive-source-4/receipt.json) is **PASS_HOST_RECEIVE_SOURCE_ONLY**, failure:null/sourceChanged:false, **329 sources**, eight PASS/exit-0 stages: **40 receiver tests / 410 assertions**, **91 transfer / 453**, **37 qualification / 280**, **five TypeScript projects**.
The current helper is **18,396 bytes**, SHA-256 **`ac1cd8afdf8332917d153e871d9400fec1e926eaa4a2380265df646c3f53b6f2`**.
[Source-3](../_work/gpu-owner-recovery/runs/host-input-receive-source-3/receipt.json) remains historical **40/407 + 91/453 + 37/280 + five types**, before the proof-revision regex LOW fix.
Old source-2 **318 inputs / helper 091a…**, alignment-source-1 and DRAFT source-6 remain immutable snapshots, not current acceptance of modified receiver/bootstrap/shared-publisher sources.
Local Fish syntax remains **NOT RUN**; source-4 executes no publication/auth query/acquisition, Cargo/LLVM/Docker/native build, host/GPU or training work.
Executor reports architect **ses_e3b8133fcffefFIv2vv6VoYyeG** accepting the plan, DevOps READY for this scoped fresh HOST decision, adversarial **ses_e3a0074baffeSZU9bZbE1aaeb3** LOW revision fix/current recheck and security **ses_e3cea2a12ffe9TMeXvXBhDE8n7** no scoped findings/READY to the decision, not execution.
The [owning sequence](gpu-host-receive.puml), [transfer](gpu-input-transfer.puml), [qualification](gpu-qualification.puml), [build](gpu-build.puml) and [gate-closure packet](gate-closure.md#current-host-receive-run2) retain this **source PASS/CONSUMED versus operator APPROVED_UNCONSUMED/UNRUN** boundary.
Bounded `handoff-2/**` coverage includes actual audit/publication/command/handoff records and verify-handoff.ts/handoff-check.json; future host bootstrap-2/receive-2/cache-2 directories remain unreceived and uncovered.
Operator receive-2 has not executed in coding; no new install/Rust-version query/global config/auth change/retry/overwrite/delete/release or asset creation/upload/GPU/training scope is added. Immutable asset source **f3e277d…** and original DRAFT/asset IDs remain unchanged, with no coding payload acquisition or mutation.
Native65/Rust/model/F64/all 4,670 coordinates/`eps=1e-6`/`atol=1e-8`/`rtol=1e-5`/exact C12/CPU Flex/masters `101..105`/production Dockerfiles remain unchanged; canonical BOTH/reference/close/R4/telemetry/coexistence remain unqualified, entrypoints disabled, **trainingReady:false**.
ALL security/privacy/isolation hardening remains AFTER **ALL planned training completes and results validate**, without extra gates or template download.

<a id="current-input-inventory"></a>

## Inventory evidence — coding/operator grants consumed; builder details now received

Executor freshly selected `Inventory inputs Recommended`; the separate [input request](../_work/gpu-owner-recovery/qualification/input-request.json) records two bounded scopes, not a new complete build or acquisition packet.
The [owning diagram](gpu-qualification.puml) separates completed coding metadata from the new **operator-reported completed** Rust pull/inspection; both one-shot allowances are now consumed.
This docs pass reads sources and retained evidence only; it runs no command, test, render, LLVM/native program, network request, host operation or agent.
The broader [host-input packet](../_work/gpu-owner-recovery/qualification/host-inputs.json) retains its original all-false approvals and old `ABSENT` observation as historical projections.
The original request, prior coding outcomes and review/approval records remain byte-unchanged; the new operator report controls current reported acquisition state, not those retained projections.
The current runtime/details sections supersede older Rust-absence, missing-builder-detail and pending-pull wording below; those statements retain only their capture-time scope.

### Completed coding-prefix metadata — one consumed, zero remaining

The [metadata receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-input-inventory-1/receipt.json) records **`PASS_METADATA_ONLY`**, `sourceChanged:false`, a complete walk, exit 0, **one invocation consumed / zero remaining**, and no retry.
Its [retained NDJSON stdout](../_work/gpu-owner-recovery/runs/gpu-qualification-input-inventory-1/command.stdout) reports **2,684 entries = 137 directories + 2,545 files + 2 symlinks + 0 other**.
The resolved root equals the existing coding-prefix candidate; both nested symlink targets (`bin/ld64.lld` and `bin/lld-link` → `lld`) were recorded, not traversed.
The summary's **331,823 metadata bytes exclude the final summary line**; stdout contains **332,260 bytes** including that line, and stderr is empty.
**329,242,172 apparent regular-file bytes** sum each directory entry; they do not establish allocated storage, unique/deduplicated bytes or a selected/staged input size.
No prefix payload was opened, read or hashed; no LLVM executable/query, compilation, copy, staging or automatic selection occurred.
Source and captured-stream hashes remain ordinary receipt evidence, not prefix-payload inspection.
The original request remains unchanged as its authority projection; this completed coding allowance is **SPENT**, not replay permission.

The [walker](../_work/gpu-owner-recovery/qualification/input-inventory.ts) uses root `realpath`, `lstat`, directory iteration and recorded `readlink` targets only.
Its approved ceilings were 20,000 entries, 10 MiB retained output and 60 seconds; unchanged `runBounded` retains at most 4 MiB per stream, while the worker caps metadata NDJSON at `4 MiB - 64 KiB` to reserve summary space.
It keeps one streamed inventory rather than duplicating a full inventory file, and exclusive evidence-directory creation plus the worker marker prevents replay within that retained run.
This is bounded metadata evidence, not compiler usability, native/static link/ABI, relocation, payload integrity, image or GPU proof.
This docs pass does not claim completed-metadata post-outcome review acceptance.

### Standalone inventory-helper source proof — separate from current publisher source-6

The [input-helper source-3 receipt](../_work/gpu-owner-recovery/runs/gpu-input-inventory-source-3/receipt.json) records **`PASS_INPUT_SOURCE_ONLY`**, `sourceChanged:false`, 11 bound sources and three stages at exit 0.
Its [raw unit summary](../_work/gpu-owner-recovery/runs/gpu-input-inventory-source-3/unit/command.stderr) confirms **8 mocked/static tests / 64 assertions**; strict qualification types and direct existing Fish **4.9.3** `--no-config --no-execute` syntax also pass.
These checks executed neither the metadata inventory nor the host packet, images, LLVM, compilation or GPU work.
The [verifier](../_work/gpu-owner-recovery/qualification/verify-inputs.ts) distinguishes available Fish from an actually launched syntax stage and records the launch before awaiting its result.
The final [tests](../_work/gpu-owner-recovery/qualification/input-inventory.test.ts) also cover host receipt write/read/output failure handling without running Docker.

- [Input-helper source-1](../_work/gpu-owner-recovery/runs/gpu-input-inventory-source-1/receipt.json) remains **FAIL**: `Bun.which` selected a Mise shim that encountered the root config's untrusted status before Fish parsed the script.
  Its [classification](../_work/gpu-owner-recovery/runs/gpu-input-inventory-source-1/classification.json) explicitly records **syntax NOT established**, despite the original receipt's misleading `fishSyntaxChecked:true` field; neither record is rewritten.
  No trust, installation, prefix inventory or host operation followed that failure.
- [Input-helper source-2](../_work/gpu-owner-recovery/runs/gpu-input-inventory-source-2/receipt.json) remains historical PASS at **7 tests / 59 assertions**, direct Fish syntax and strict types, before the final MEDIUM receipt-failure and LOW syntax-attempt accounting fixes.
- Input-helper source-3 supplies its final **8/64** proof; it does not replace or combine with current publisher source-6, historical publisher source-5, original transfer-source-3 preparation lineage or historical qualification source-4/source-2.
  No Rust/math/production-recipe edits follow; the qualification recipe has changed, so an unchanged native-inventory count does not make the old source-2 manifest current.

The lead reports adversarial `ses_e3db08ecaffe7JpgpwIKHCgyMl` READY with both findings resolved, security `ses_e3db08ecaffd8jrnYUsS9UQS84` READY **within this new grant**, and DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` READY source-only.
Those source/pre-execution verdicts are not completed-metadata record acceptance or actual host outcome acceptance.

### Operator-reported result — historical root summary, then received concatenated details

The [operator paste](../_work/gpu-owner-recovery/runs/host-builder-inputs-1/operator-paste.txt) and [normalized observation](../_work/gpu-owner-recovery/runs/host-builder-inputs-1/operator-observation.json) record **`OPERATOR_REPORTED_INPUT_METADATA_PASS_AUTHORITY_CONSUMED_DETAILS_PENDING`** and reported `PASS_INPUT_METADATA_ONLY`.
These are newly retained coding-side records normalized from pasted output, **not original host files**; creating this local evidence directory did not transfer the operator's phase outputs.

| Operator-reported field | Result / limit |
|---|---|
| Exact Rust image | `docker.io/library/rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb` |
| Frozen lock SHA | `77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955` |
| Pull / combined inspection / image inspection / container / cleanup exits | All reported `0` |
| Container and cleanup | One of each; CID `9411a17c3a9f678b625749a6c86668afba5b778d87d6822f67119c674e24f32f` |
| Started / finished | `1794266630` / `1794266641`; 11 reported wall seconds, not independent per-phase deadline proof |
| Remaining authority | **One pull / one container / one cleanup CONSUMED; zero remaining**, no automatic retry |
| Compilation / GPU execution / training readiness | Reported `false` |

This report **clears the pinned Rust-image acquisition blocker at report scope**; do not describe the current state as image still absent, pull pending or an unexecuted available grant.
It does not establish compiled builder ABI/native linking, a built qualification image, actual GPU work or training readiness.
The original summary's pre-handoff publication `2c17a189ecba08cb7078ea8daf991317d09c3ef1` remains correct historical context.
Earlier docs/evidence push **`cca45f6b2978398f68d0db1a84119e1b5a3c0ee2`**, run-1 helper **33b29dd…**, asset source **f3e277d…** and **d3bb6bcc…** keep distinct historical roles; latest prior-alignment push is **5c236ef…**. Actual operator-executed command/source identity remains independently unestablished.
That unknown does not add a hardened source-custody gate.
This docs pass claims no post-record review acceptance.

The new [detail paste](../_work/gpu-owner-recovery/runs/host-builder-inputs-1/operator-details-paste.txt) and [detail record](../_work/gpu-owner-recovery/runs/host-builder-inputs-1/operator-details.json) now supply **received, concatenated** existing-output details; the operator read existing files without a Docker/compiler replay.
These are normalized pasted records, **not original host files**, and individual stdout/stderr boundaries are not established.
The old root summary's null fields and `DETAILS_PENDING` status remain byte-unchanged capture-time history, not current missing-detail claims.

| Received operator-reported detail | Value / evidence limit |
|---|---|
| Platform/OS | Linux/amd64; Debian GNU/Linux 12 bookworm |
| cc/c++ | `/usr/bin/cc`, `/usr/bin/c++`; GCC `12.2.0`, Debian `12.2.0-14+deb12u1` |
| ar/ld | `/usr/bin/ar`, `/usr/bin/ld`; GNU Binutils `2.40` |
| Other paths | `/usr/bin/getconf`, `/usr/bin/readelf` |
| libc | glibc `2.36` |
| Command results | All 12 `COMMAND` frames report exit 0; C++ path query exit 0 |
| C++ library path | `/usr/lib/gcc/x86_64-linux-gnu/12/libstdc++.so`; no runtime-closure/ABI/link qualification |
| Actual executable Rust/Cargo versions | Still `null`; Rust `1.95.0` is registry-declared, not an executed version result |

The pasted `.Id` repeats manifest digest `4c2...`, while retained registry config digest is `d617f1b5c2a18778ba357ba0528e973bd24992b0dd18000dfbca059f4a15ebda`.
The identity-field discrepancy has **unknown cause**; it does not establish a wrong image, invalidate reported acquisition or create a security/custody gate.
The detail record's earlier `runtimeStrategySelected:false` remains its original snapshot; the later runtime request separately records Executor's source-packaging choice.
No new host/native operation or operational grant follows from this read-existing-files detail handoff, and no detail-record integrity-check acceptance is claimed by this docs pass.

The unchanged [Fish source](../_work/gpu-owner-recovery/qualification/inspect-builder.fish) retains the consumed contract: pull <=600 seconds; combined image/non-CUDA inspection <=60 seconds at 1 CPU / 1 GiB; separate saved-exact-CID cleanup <=30 seconds.
It specifies per-command tool/library result handling and plaintext phase/receipt evidence without host Bun, compilation, GPU, installation or staging.
Those prescribed bounds and source declarations are not independently verified by the pasted 11-second summary.
The original request and older approval projections remain history, **NOT RERUN**; the report grants no new install/acquisition, LLVM query/prefix-payload read, copy/staging, build, GPU or training operation.
The coding agent must not invoke Docker or any host tool or repeat the spent coding inventory/LLVM queries.
The broader host operational packet remains unresolved; original preparation and all three publication attempts are consumed.
The [second HTTPS outcome](#current-https-publication) records its closed failure; the distinct [third identity outcome](#current-identity-publication) records DRAFT publication PASS, not replay authority or expanded host scope.
Host builds, actual GPU qualification and training still require separate explicit scope; do not repeat the spent inventory or add full-assurance gates.
ALL security/privacy/isolation hardening remains LAST, after **ALL planned training completes and results validate**; full-assurance gates remain OPEN and `trainingReady:false` remains unchanged.

<a id="current-qualification-source-and-flags"></a>

## Qualification runtime contract — publisher source-6 current; earlier receipts retained

Executor selected `Prepare + query Recommended` in the parent session.
The [preparation request](../_work/gpu-owner-recovery/qualification/request.json) authorizes the qualification source target, persisted tests/spec and consolidated input packet, plus one exact five-query non-CUDA LLVM batch.
[gpu-qualification.puml](gpu-qualification.puml) owns this concern; [gpu-build.puml](gpu-build.puml) retains the separate prepared-bridge and production-recipe history.
This docs pass reads sources and existing evidence only; it runs no command, render, test, native program, query, image or host operation, network request, archive operation or agent.

### Implemented source contract — host qualification remains unrun

- The separate [qualification Dockerfile](../tooling/runtime/Dockerfile.gpu-qualification) leaves both production Dockerfiles and existing recipe tests unchanged.
  Its inputs/runtime now share the Rust pin; a separate Bun stage contributes only the interpreter, no qualification builder rootfs copy remains, and actual Rust/Cargo/Bun guards await image construction.
  Its future CPU/GPU builds use locked, offline Cargo `--no-run --message-format=json`; they do not run tests during image construction.
  CPU uses default features across both packages; GPU selects `gpu-prepared-llvm` for the existing `finite_difference` and `gpu` integration targets.
- CPU and GPU outputs remain separate at `/build/native/target-cpu` and `/build/native/target-gpu`, copied to those same absolute runtime paths so embedded `CARGO_BIN_EXE` policy subprocess locations survive.
  Both final stages apply `chown` to `/build/native/_work` **after** their copies and before `USER 1000:1000`, preserving scratch/evidence ownership by design rather than claiming an executed image-write check.
  The runtime overlay must supply libdevice; the host driver still supplies `libcuda` without replacement.
- The [Bun runner](../tooling/runtime/qualification.ts) admits only matching `compiler-artifact` records with exact package IDs, test profiles, features and mode-specific executable prefixes.
  Each Cargo log must end with one successful `build-finished`; Docker must separately accept Cargo's exit status.
  Build-script records never select executables, and complete unique harness coverage plus all three policy binary paths is mandatory.
- GPU feasibility reuses the first two existing exact ignored tests: nonzero F64 scoring/record round trip, then direct backward/SGD/update/reload.
  GPU full reuses all six in order: that same pair, the active 2,335-coordinate sweep, inactive 2,335-coordinate sweep, exact redundant learning channels, then exact policy-channel subprocess agreement/reload.
  Each GPU invocation must report exactly one pass, zero failures and zero ignored tests; zero-match execution fails.
- CPU regression freezes 16 default-feature harnesses and their individual expected counts: 22 learning + 17 policy-io = 39 tests.
  A known zero-test CPU harness is valid; an empty aggregate or missing harness is not substitute regression evidence.
  **Current-generation native CPU regression and all GPU campaigns remain UNRUN.**
- Each campaign runs serially through the two unchanged copied supervision files, [runBounded](../_work/gpu-owner-recovery/verify.ts) and [command-supervisor.ts](../_work/gpu-owner-recovery/command-supervisor.ts), with 4 MiB per stream, first-failure STOP and no retry or automatic feasibility-to-full escalation.
  Explicit positive per-test, total and cleanup-reserve budgets are mandatory, with `totalMs >= steps * perTestMs + cleanupReserveMs`.
  These limits cover **the test loop only**, not preflight, final source checks or receipt work; `proposedLimitsNotApproved.scope` is `TEST_LOOP_ONLY_NOT_OVERALL_HOST_INVOCATION` and `overallHostInvocationMs` remains `null`.
  GPU child environment retains `CUDA_PATH` plus host-injected `LD_LIBRARY_PATH` and visible-device variables when present; it does not fall back to the old default environment that omits CUDA.
- A future invocation requires fresh `chess-coach.host-qualification-approval.v1`, `hostExecutionApproved:true`, matching image mode, `maximumCampaignInvocations:1`, approved source-manifest SHA and `approval.runId === CLI label`.
  `validateHostApproval` rejects the same approval under a different label; exclusive `mkdir` rejects an existing run directory within retained persistent evidence.
  This is a functional one-attempt contract, not hardened cross-container anti-replay or physical-custody proof.
  The generation manifest now binds **65 native inputs**, including root Cargo files, every crate manifest/Rust source, the unchanged feature schema, runner, recipe, input contract and both supervision files; runtime compares source inventory before and after execution.
  Host receipt fields now retain `approvalSha256`, `runId` and `testLoopLimits` alongside source/artifact identity.
  Even `PASS_TESTS_ONLY` keeps all training/readiness qualification flags false.
- `recordAttempt` appends `STARTED` before command execution and stores the command result before reading output streams.
  A later capture failure retains attempt identity, argv, timeout and available exit code, and the host runner classifies it as `FAIL_EXECUTION`, not `FAIL_PREFLIGHT`.
  The static verifier's post-run `checkSources` catches deleted/unreadable bound inputs and returns `sourceChanged:true` plus failure data, allowing its terminal `FAIL_SOURCE_ONLY` receipt rather than losing the outcome to that read exception.

F64, all 4,670 coordinates at `eps=1e-6`, `atol=1e-8`, `rtol=1e-5`, exact C12 with no tolerance substitution, CPU Flex initialization and masters `101..105` remain unchanged.
No new toy fixture, model/mathematics change, activation or training dispatch follows.

### Historical source-2 evidence — PRE_RUST_BASE, not current packaging proof

The historical [source-2 receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-source-2/receipt.json) records **`PASS_SOURCE_ONLY`**, `failure:null`, `sourceChanged:false`, five stages at exit 0, 277 bound inputs and 64 native-manifest entries for its PRE_RUST_BASE generation.
Its [raw test stderr](../_work/gpu-owner-recovery/runs/gpu-qualification-source-2/tests/command.stderr) confirms **32 tests / 223 assertions**: 18 qualification cases + 9 existing recipe cases + 5 prepared-verifier cases, followed by four successful typechecks.
The receipt records zero Cargo/LLVM invocations, native compilation, downloads, image operations or host/GPU operations in those static checks.
Its manifest SHA-256 is `48d4c9705a02d775d6f58a3bce58346e34a8f43e58e604dcdbcd0de5dda72f3b`; the equal 277-input count does **not** identify it with either the prior source-1 or older local-6 manifest.
The four added cases cover run-ID binding, capture-failure attempt retention, unreadable-source terminal failure data and the retained LLVM receipt contract.
The LLVM receipt case reads JSON only; it does not execute LLVM, repeat a query or renew authority.
The [source-1 receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-source-1/receipt.json), its [28-test / 201-assertion summary](../_work/gpu-owner-recovery/runs/gpu-qualification-source-1/tests/command.stderr) and manifest `f493636ab6d2b03816553671db77ea2ad736f2b6b21f7d836c461ec57aa6eac9` remain immutable **HISTORICAL PRE-REVIEW-FIX** evidence, not the current source proof.

The lead reported these source-only review outcomes for that earlier slice; they do not accept the new Rust-based packaging, and this docs pass invokes no reviewer:

| Reviewer session | Reported source-only outcome |
|---|---|
| Adversarial `ses_e3dde36f7ffe7zUOt5TLO5go8p` | READY; HIGH approval replay and both MEDIUM attempt/capture and unreadable-source reporting findings resolved |
| Security `ses_e3dde36f6ffeV2dAqWyTQ89u5u` | READY; no findings in this source-only fix scope, not physical-custody or runtime assurance |
| Backend `ses_e3df78573ffeXo04nE7v4wNCrB` | No functional findings |
| DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` | READY source-only; LOW test-loop/whole-host-invocation budget ambiguity resolved by explicit scope and null overall bound |

Source-only READY does not qualify actual native Cargo artifact compatibility, compiled linking/ABI, image usability, current native CPU regression or GPU behavior.
This pass claims no fresh verification, completed-record/hash-integrity acceptance, host operation approval or training readiness.

The separate [LLVM flag receipt](../_work/gpu-owner-recovery/runs/gpu-qualification-llvm-flags-1/receipt.json) records **`PASS_FLAGS_ONLY`**, five PASS/exit-0 results, `sourceChanged:false`, batch closed and **CONSUMED five invocations / zero remaining**, with no retry.
The exact existing coding-prefix `llvm-config --link-static` queries were `--cxxflags`, `--includedir`, `--libdir`, `--libs`, `--system-libs`, each bounded to 10 seconds with first-failure STOP.
The lead completed that native non-CUDA batch; this docs pass does not repeat it or the already-consumed version query.
Retained outputs report C++17, `_GLIBCXX_USE_CXX11_ABI=1`, `-fno-exceptions`, coding-prefix include/lib paths and NVPTX CodeGen/Desc/Info libraries.
**`--system-libs` reports only `-lrt -ldl -lm`**; it does not prove the C++ standard-library/runtime closure, dynamically loaded dependencies, compiled ABI compatibility, static linking or relocation/copy readiness.
At that flag-query capture the prefix remained unmodified, uncopied and unselected; the receipt records no compilation, download, image or host/GPU operation and keeps `trainingReady:false`.
The later transfer request separately permitted that bounded payload copy, now completed and consumed, not another LLVM query, build or retry.

### Consolidated host inputs — choices and bounds still unresolved

The [host input packet](../_work/gpu-owner-recovery/qualification/host-inputs.json) consolidates context roles, image pins, exact campaign ordering/paths and proposed limits without approving any operation.
All its acquisition, installation, context-copy/staging, image-build, host-execution, GPU-execution and training approval fields are **false**.
The old packet retains its original null selections; source packaging, completed preparation, both consumed FAILs and the successful/consumed third DRAFT publication are recorded separately, while host build/GPU bounds remain unapproved.
Proposed per-campaign timings are not approved bounds, so this is **not a complete approved runnable host packet**.
The Rust pin's old `ABSENT` field remains unchanged only as historical projection; current operator details are received as concatenated paste, not original streams. Bun was last reported cached, not freshly inspected here, with no new Bun grant.
The original Draft-assets choice/failure are historical; Executor has resolved the transport fork through the [distinct explicit-HTTPS request](#current-https-publication), without rewriting old false/null fields.
No prior pull/container/cleanup, download/preparation or first-publication allowance remains; zero original commit invocations do not permit replay.
The distinct second publication attempt is also consumed, including one actual commit invocation.
The later [identity request/outcome](#current-identity-publication) independently supplied the successful third DRAFT publication, now consumed; no preparation/prior-attempt replay or further commit/push is authorized.
Native/image builds, host/GPU campaigns and training still need separate explicit scope.
Prior Rust-install, Cargo-fetch, LLVM-metadata/version and visibility grants remain consumed, as do the flag-query batch and coding metadata walk.
Canonical init/BOTH/independent-reference/orderly-close proof, integrated R4, operational activation/five-master scheduling and accepted selected-path telemetry/coexistence remain outside this qualification.
ALL security/privacy/isolation hardening remains LAST, after **ALL planned training completes and its results validate**; full-assurance Gate0/F9/R4 stay OPEN and `trainingReady:false` remains unchanged.

## Prepared/offline bridge snapshot — locked cache and three feature trees PASS; no compilation

The local-6 evidence below retains its completed prepared-bridge scope; it is historical relative to the newly added qualification generation, not invalidated evidence for unchanged inputs.
It neither covers the new qualification files nor establishes a current whole-generation native build or CPU regression result.
Bridge-phase exclusions and missing-input statements below retain their capture-time scope unless explicitly updated.
The [completed preparation](#current-prepared-input-bytes), [consumed HTTPS outcome](#current-https-publication) and [active identity scope](#current-identity-publication) record later input/publication boundaries, not the old bridge projections.

[gpu-build.puml](gpu-build.puml) documents the optional [GPU recipe](../tooling/runtime/Dockerfile.gpu), [input contract](../tooling/runtime/gpu-build-inputs.json), static recipe tests and scoped local verification evidence.
Executor explicitly selected `Reuse LLVM Recommended` in the parent session; the [implementation request](../_work/gpu-owner-recovery/gpu-functional-prepared-llvm-implementation-request.json) authorizes source implementation, static checks and available offline Cargo graph checks only.
Executor accepted public `xtask` use outside its primary upstream purpose; this remains source-supported use, not a documented external-prefix API or build qualification.
The prepared bridge exists in source; both the coding Rust-toolchain grant and the later frozen-lock cache-fetch grant completed once and are consumed. The exact cache fetch and three separate offline feature trees passed; no further fetch/retry/download, provisioning, package upgrade, compilation, LLVM/prefix staging/selection, image/host/GPU work or training is authorized.

- `crates/learning/Cargo.toml` adds `gpu-prepared-llvm = ["gpu-cuda", "dep:tracel-llvm-bundler"]` and optional **host build dependency** `tracel-llvm-bundler =23.1.0-4` with public `xtask`; policy-io forwards the new feature to learning alongside `gpu-cuda`.
- Both default feature lists remain empty; existing `gpu-cuda` feature declarations and the CPU Dockerfile remain unchanged. This static source fact is not a fresh CPU numerical/regression result.
- `Cargo.lock` adds only learning's edge to the already pinned bundler; the lead reports no registry/version changes.
- The opt-in GPU recipe retains the same three pinned stages, three policy binaries and six reference bundles; it now selects `-p chess-coach-policy-io --features gpu-prepared-llvm`.
- `CUDARC_CUDA_VERSION` has no default and must match the contract's supported encoded list; its selected value remains `null`.
- With `XDG_DATA_HOME=/opt/tracel-data`, the prepared-only recipe declares a prefix at `/opt/tracel-data/tracel/tracel-llvm-23.1.0-4`; it retains executable-config and `23.1.0` version guards, but removes marker admission only for this explicit prepared mode. No prefix has actually been copied or selected, and no marker is fabricated.
- Input contract `chess-coach.gpu-build-inputs.v2` declares `feature:gpu-prepared-llvm`, `llvm.mode:prepared-offline`, `installationMarkerRequired:false` and the exact bundler/`xtask` installer bypass. Ordinary `gpu-cuda` declarations still use the upstream installer route; native CubeCL shim compilation and static linking remain necessary and unrun.
- Prepared builder/runtime rootfs overlays precede application inputs/outputs; runtime `CUDA_PATH=/usr/local/cuda` has a nonempty `nvvm/libdevice/libdevice.10.bc` guard. Actual ELF dependencies, dynamically loaded userspace libraries and host-driver `libcuda` injection still need functional qualification; no host-driver replacement or copy is invented.
- Bound versions remain Burn `0.22.0`, `burn-cuda` `0.22.1`, CubeCL `0.11.3`, LLVM bundle `23.1.0-4` and CUDARC `0.19.10`, with the declared `cubecl-llvm-nvptx` route. Backend/F64 capability metadata is not actual kernel proof and permits no dependency/backend/precision substitution.

The input contract remains `AWAITING_PREPARED_INPUT_SELECTION`: LLVM, builder-dependency and runtime-dependency selections and `CUDARC_CUDA_VERSION` are `null`; libdevice remains missing/unselected, the pinned Rust image was absent at the last received inspection with no approved acquisition/pull, and all qualification flags remain `false`.
[Inference] Reviewed Cargo resolver source permits host-feature unification across selected packages in one invocation; unchanged ordinary `gpu-cuda` declarations do not prove installer isolation when prepared mode is also selected in that invocation.
Local-6 now supplies actual resolved feature-tree evidence for the three separate modes, not just declarations or mocks. Compiled host-unit dependency coupling/sharing, native/static linking, ABI/NVPTX kernels, relocation and the actual build remain unqualified.

<a id="current-scoped-rust-recovery"></a>

### Coding Rust result — installed; local-5 failure historical; install grant consumed

Executor selected `Provision Rust Recommended`; automatic completion has now been received for `gpu-prepared-llvm-mise-1`.
The [actual execution receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/receipt.json) records **`TOOLCHAIN_INSTALLED_OFFLINE_GRAPHS_NOT_VERIFIED`**, `sourceChanged:false`, eight preflight PASS results and one install PASS at exit 0; the [outcome record](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/outcome.json) records **CONSUMED: one install, zero remaining**, not overall graph success.
The [original request](../_work/gpu-owner-recovery/prepared-llvm-mise/request.json) remains byte-unchanged as its original authority projection; it authorizes no repeat install, helper replay, dependency acquisition or retry, and no installer/Cargo advice was followed to remove `--offline`.
This docs pass reads completed evidence manually only; it runs no command, test, native query, download or retry.

| Consumed boundary | Recorded contract / result |
|---|---|
| Toolchain and location | Coding environment only; Rust `1.95.0`, minimal profile, configured `rustfmt`/`clippy`, `targets:[]`, host `x86_64-unknown-linux-gnu`; reuse repository-owned cache/Mise/rustup/Cargo homes, not root/global/host configuration |
| Fresh scope checks | All eight preflights PASS: exact existing config/sole path/tool, repo rustup/Cargo homes and host; trust stayed scoped to repo-owned Mise state, not root/global/host configuration |
| Bounded attempt | One `mise install --jobs 1 core:rust` at exit 0 under its 600-second client deadline after unchanged-config reread; one consumed, no retry/fallback or runner repair; per-step bounds do not prove physical hard stop |
| Install evidence | Raw stderr reports `rustc 1.95.0 (59807616e 2026-04-14)` installed, downloading five components for the configured minimal + rustfmt/Clippy setup; the exact repo Cargo/rustc pair is now available and was selected, not the old global Mise link |
| Offline recheck | Actual local-5 ran six static stages successfully, then one prepared Cargo tree at exit 101; first-failure STOP prevented ordinary-CUDA and CPU tree attempts |
| Success ceiling | Install PASS alone was not graph PASS: local-5 obtained no complete tree. The later separate local-6 passes below supply tree-only evidence, not compiled host coupling, linking or GPU readiness |
| Downloads and exclusions | Rust-toolchain acquisition completed; that phase neither authorized nor performed project-dependency downloads. The separate later cache grant below does not renew any toolchain/LLVM/archive/image/host/GPU/training authority |

The new [provision driver](../_work/gpu-owner-recovery/prepared-llvm-mise/provision.ts), [mock tests](../_work/gpu-owner-recovery/prepared-llvm-mise/provision.test.ts) and [strict configuration](../_work/gpu-owner-recovery/prepared-llvm-mise/tsconfig.json) import only existing `prepare`/`environment` from the old provision module and reuse `runBounded`; they do not invoke the historical main or repair the runner.
The [source-only receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-source-1/receipt.json) records `PASS_SOURCE_PREINSTALL_ONLY`: 7 mocked tests / 46 assertions and strict helper types both exit 0, zero Mise commands/install invocations/downloads in **those checks**, and all 277 prepared-source hashes unchanged with zero mismatches.
Those mock/type results remain preinstall source evidence only; actual outcomes come from the separate execution/local-5 receipts, and app source, CPU/GPU F64 mathematics, all 4,670 coordinates, exact C12, initialization and cooperative policy remain unchanged.
Pre-execution adversarial `ses_e3e4db93fffe3vnYU3U3f7pPFD` accepted source/authority and security `ses_e3e4db930ffeG4ZPzaPQNdpunU` accepted only this fresh explicit grant; neither supplies native qualification or a completion result.
The existing `.gitignore` excludes `_work/gpu-owner-recovery/cache/`; cached toolchain payloads/binaries remain outside tracked evidence, and this docs pass changes no ignore rule.
The [raw install stderr](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/install/command.stderr) retains the redirected-HOME/euid-home-mismatch `error:` lines and the missing-`cc` warning despite install exit 0; do not delete, relabel or hide them.
That C-toolchain warning does not establish a C compiler prerequisite for this graph check: the actual graph failure reports registry resolution, not linking, and no C compiler installation is approved.
The [integrity receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-mise-1/integrity-check.json) records **`PASS_RECORD_INTEGRITY_ONLY`**, 34 streams and 285 source hashes (277 prepared + eight helper inputs); it preserves install PASS and graph FAIL, not overall installation/graph qualification or post-outcome runtime acceptance.
Post-outcome adversarial `ses_e3e4db93fffe3vnYU3U3f7pPFD` and security `ses_e3e4db930ffeG4ZPzaPQNdpunU` accept these completed-operation records only; neither accepts graph/build/GPU qualification or further execution.

<a id="current-locked-cache-fetch"></a>

### Completed locked cache fetch — PASS, three offline trees PASS; grant consumed

Executor selected `Fetch cache Recommended`; automatic completion has now been received for `gpu-prepared-llvm-cache-1`.
The [actual execution receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/receipt.json) records **`CACHE_AND_FEATURE_TREES_PASS_NO_COMPILATION`**, `failure:null`, `sourceChanged:false`, 282 bound inputs, 671 approved registry entries and both fetch/offline-verifier steps PASS at exit 0.
The [outcome](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/outcome.json) records **CONSUMED: one fetch / zero remaining**, unchanged frozen lock and three passed offline modes; no further fetch, retry, tool install or download scope remains.
The [original request](../_work/gpu-owner-recovery/prepared-llvm-cache/request.json) retains its approved authority projection unchanged; it is not replay permission. This docs pass reads completed evidence only and runs no command, test, native query, download or retry.

| Consumed authority | Recorded contract / result |
|---|---|
| Frozen input | `Cargo.lock` remained unchanged at SHA-256 `77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955`; 675 packages = four workspace + 671 registry package versions |
| Registry admission | Only `registry+https://github.com/rust-lang/crates.io-index` with locked identities and checksums; no Git/private dependencies, lock repair or package upgrades |
| Entry budget | At most 671 locked registry package versions, **not** an HTTP-request or byte cap; index metadata may contain other version records without selecting upgrades or changing the frozen lock |
| One fetch | Exact installed repo Rust `1.95.0` Cargo: `fetch --locked --target x86_64-unknown-linux-gnu`, one invocation PASS at exit 0 under its 600-second client deadline; fixed run `gpu-prepared-llvm-cache-1`, one consumed / zero remaining |
| Recorded fetch environment | Fetch-specific clone of the exported environment bound repo rustup/Cargo homes, exact paired `RUSTC` and pinned-bin PATH, with `CARGO_NET_OFFLINE=false`, `CARGO_NET_RETRY=0`, `CARGO_HTTP_TIMEOUT=30`, `CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse`, `RUSTUP_AUTO_INSTALL=0`; shared exported/root/static environment remained unchanged |
| Stop and stability | First failure STOP; retain partial cache, no retries/fallback, lock removal/repair or toolchain substitution. Post-fetch lock/source stability checks also run on failed-fetch result paths; changed or unreadable bound inputs stop verification, and helper sources remain separately bound |
| Executed local-6 | Fetch PASS with unchanged inputs invoked the existing prepared verifier as `gpu-prepared-llvm-local-6`, under its 780-second wrapper deadline; six static stages and **three separate OFFLINE** prepared/ordinary-CUDA/CPU trees all exit 0 |
| Final admission | Pure `graphResultVerified` accepted three expected PASS trees and exact repo Cargo/rustc binding with `sourcesChangedDuringRun:false`; outer `sourceChanged:false` preserves all 282 bound inputs, including the unchanged 277 prepared sources. Actual feature-tree PASS supplies no compiled host coupling, native linking or GPU readiness |

The [fetch helper](../_work/gpu-owner-recovery/prepared-llvm-cache/fetch.ts), [mock tests](../_work/gpu-owner-recovery/prepared-llvm-cache/fetch.test.ts) and [strict helper configuration](../_work/gpu-owner-recovery/prepared-llvm-cache/tsconfig.json) reuse existing `prepare`/`environment`, `runBounded`, the verifier and pure graph-result predicate; they call no Mise install and do not rerun the historical provision main or repair the runner.
The [registry manifest](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/registry-manifest.json) records 671 frozen names/versions/checksums at the exact approved registry source. The outcome reports **568 `Downloaded` name/version messages** in [raw fetch stderr](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/fetch/command.stderr), all within that manifest; it explicitly does **not** claim all 671 entries were downloaded, an HTTP/byte total or acquisition outside the frozen set.
The [integrity receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/integrity-check.json) records **`PASS_RECORD_STREAM_AND_SOURCE_INTEGRITY_ONLY`**: 22 streams, all 282 bound fetch-source hashes and all 277 prepared-source hashes checked unchanged, no repeated fetch/native query. This is record/stream/source integrity only, not compiled host-unit, ABI, relocation, kernel, image or GPU qualification.
Source-declared failure states distinguish `FAIL_BOUND_INPUT_CHANGED`, `FAIL_FETCH`, and successful fetch without accepted verification (`CACHE_FETCHED_OFFLINE_GRAPHS_NOT_VERIFIED`); none supplies permission to retry, bypass offline checks or relabel the prior graph failure.
The [latest prefetch-only receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-source-2/receipt.json) records **`PASS_SOURCE_PREFETCH_ONLY`**: [unit stderr](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-source-2/unit/command.stderr) confirms 8 mocked cases / 23 assertions, strict helper types exit 0, `sourceChanged:false`, all 277 prepared-source hashes unchanged with no prior mismatches, and **zero real fetch invocations/downloads** in those checks.
The helper's new folder/source proof remains separate from the unchanged 277-input prepared manifest; no app, feature, F64/C12, initialization or cooperative-policy change follows.
The earlier [cache-source-1 receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-source-1/receipt.json) remains historical PASS at 6 mocked cases / 16 assertions, before two adversarial MEDIUM failure-reporting fixes and their regression cases; it is not the latest source proof.
The lead reports both findings resolved: unreadable bound sources now yield bounded changed-input failure, and missing/invalid verifier receipts preserve successful-fetch/unverified-graph scope rather than a preflight label. These are source/test changes, not edits to runtime evidence files or proof of actual fetch failure handling.
The lead reports final pre-execution adversarial `ses_e3e279074ffecatzIlWgyKAeHe` READY with both findings resolved and security `ses_e3e279068ffdYBUGpvUXWkOlML` READY **within this explicit grant only**. Neither verdict accepts an actual network/Cargo outcome, native graph/build, GPU qualification or any post-outcome record for this new attempt.
The [completed-record review](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/review.json) records adversarial `ses_e3e279074ffecatzIlWgyKAeHe` and security `ses_e3e279068ffdYBUGpvUXWkOlML` READY for the cache/feature-tree records only; it accepts no compilation, GPU/training qualification or further operation.
Normal locked crates.io metadata and `.crate` download/unpack were approved within the completed one-fetch grant; they are **not** the halted LLVM release-archive pipeline, and no per-crate body security-audit gate is required. That grant is now consumed and supplies no additional acquisition.
Package upgrades, compilation, native/CPU numerical/e2e tests, LLVM bundles or old archive capture/replay, prefix staging/selection, images, host/GPU operations, training and Rust/toolchain reinstallation remain excluded; the Mise install grant stays consumed and `trainingReady:false` stays unchanged.

### Current completed graph recheck — local-6 static and three feature trees PASS

The [current local-6 receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/receipt.json) records **`PASS_STATIC_AND_FEATURE_TREE_ONLY`**, `graphStatus:PASS_FEATURE_TREE_ONLY` and `staticChecksPassed:true`: six static stages exit 0, 14 cases / 109 assertions plus four typechecks, 277 unchanged inputs and `sourcesChangedDuringRun:false`; all three actual Cargo trees exit 0 with `expectedFeatureTextPresent:true`.
Its source-manifest SHA-256 is `710a658592d3f7ef89f04a654f0d30213315eb33ba8a0f927c24061db1a01fba`.
Earlier prepared-mode receipts remain immutable history: local-1 predates pin refinement, local-2 predates paired binding, local-3 predates pure tests, and [local-4](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-4/receipt.json) is preinstallation `PASS_STATIC_GRAPH_UNAVAILABLE` / `UNAVAILABLE_CARGO`. The [local-5 receipt](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-5/receipt.json) retains `FAIL_OR_INCOMPLETE_GRAPH`: one prepared tree exit 101, stdout 0, first reported uncached bundler; ordinary-CUDA/CPU trees did not run in **that** phase. Local-6's later PASS changes neither earlier receipt nor historical CPU regression scope.
The [nested verifier](../_work/gpu-owner-recovery/prepared-llvm/verify.ts), [pure helper tests](../_work/gpu-owner-recovery/prepared-llvm/verify.test.ts) and [configuration](../_work/gpu-owner-recovery/prepared-llvm/tsconfig.json) reuse existing `runBounded`; the configuration includes `*.ts`, and this slice changes no lifecycle implementation or qualification.

| Recorded stage | Result / scope |
|---|---|
| `recipe` | PASS: 9 cases / 97 assertions; prepared feature/host dependency/pin, unchanged defaults and ordinary `gpu-cuda`, mode-specific guards and no fake marker/manual feature environment/`DOCS_RS` |
| `verifier-tests` | PASS: 5 pure cases / 12 assertions; paired binding, missing rustc, unversioned substitution rejection, unavailable Cargo and static-environment immutability; no native tool query |
| `types-source` | PASS, exit 0: `tsconfig.json` |
| `types-tests` | PASS, exit 0: `tsconfig.tests.json` |
| `types-tools` | PASS, exit 0: `_work/gpu-owner-recovery/tsconfig.json` |
| `types-verifier` | PASS, exit 0: `_work/gpu-owner-recovery/prepared-llvm/tsconfig.json` |
| `graph-prepared` | **PASS**, actual repo Cargo tree exit 0; `--locked --offline`, target `x86_64-unknown-linux-gnu`, package `chess-coach-policy-io`, `gpu-prepared-llvm`; exact versions and bundler `xtask` present |
| `graph-ordinary-cuda` | **PASS**, separate actual offline tree exit 0 with `gpu-cuda`; same exact LLVM/bundler versions, bundler `xtask` absent per matched predicate |
| `graph-cpu` | **PASS**, separate actual offline tree exit 0 with `--no-default-features`; bundler absent per matched predicate, not a native CPU regression test |
| CPU numerical tests, native/cross-language e2e and GPU tests | Not run: the consumed grant covered static/offline feature trees only, not compilation; actual GPU execution stays host-only under separate authority |

At local-4's preinstallation snapshot the checked Cargo/rustc candidates were unavailable; local-5 observed restored tool availability but encountered the cache miss. Local-6 now records three passed trees using the installed repo pair at `_work/gpu-owner-recovery/cache/rustup/toolchains/1.95.0-x86_64-unknown-linux-gnu/bin/`, exact `RUSTC` and pinned-bin PATH, not the old global Mise link or a reinstall. Tool/cache availability for this tree task is no longer the current blocker.
Only `_work/gpu-owner-recovery/cache/rustup/toolchains/1.95.0-x86_64-unknown-linux-gnu/bin/cargo` and `/home/agent/toolchains/linux-amd64/.local/share/mise/installs/rust/1.95.0/bin/cargo` are eligible for future graph probes, and each also requires an executable `rustc` in the same `bin` directory (`X_OK` for both).
The unversioned `/usr/local/bin/cargo`, `/usr/bin/cargo` and `/bin/cargo` checks are diagnostic only; the helper cannot select them as an automatic toolchain substitute.
The lead reports an adversarial MEDIUM finding for missing `RUSTC`/PATH binding; the helper now derives a separate graph environment with `RUSTC` set to that exact paired rustc and the selected Cargo `bin` prepended to PATH.
Each stage receipt records its actual environment; local-6 binds the exact repo pair with `CARGO_NET_OFFLINE=true` without mutating root/static environment. Three resolved feature trees now provide positive tree-only evidence, not compiled host-unit coupling or native/linking proof.

| Observed local-6 tree-only predicate; all three PASS | Recorded resolved feature text |
|---|---|
| Prepared mode | [Actual stdout](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/graph-prepared/command.stdout) contains `cubecl-llvm v0.11.3`, `tracel-llvm-bundler v23.1.0-4` and bundler `xtask` at line 2429 |
| Ordinary CUDA mode | [Actual stdout](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/graph-ordinary-cuda/command.stdout) contains both exact crate/version strings; matched predicate requires bundler `xtask` absent |
| CPU mode | [Actual stdout](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/graph-cpu/command.stdout) passes the bundler-absent predicate |

The historical [local-5 graph stderr](../_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-5/graph-prepared/command.stderr) still reports `no matching package named tracel-llvm-bundler found`, location `crates.io index`; it identified the first cache miss, not absent Cargo, broken LLVM or the only missing crate. It is not the current graph result.
Local-6 has three PASS results, with all expected text predicates matched; this establishes actual resolved feature-tree evidence but not compiled host-unit sharing, static linking/ABI, NVPTX kernels, relocation, image readiness or fresh native CPU regression.
Local-5's generic online-retry advice was not followed. The later separately approved locked fetch completed once, offline graph predicates remained offline, and both install/fetch grants now have zero remaining invocations.
The lead reports backend `ses_e3eb390a0ffevPYsyX7nd2VlAn` and monorepo coordinator `ses_e3e975903ffemhEzKAbgl5dmRP` accept static source wiring, and DevOps `ses_e3ec46b44ffe7CbnV5rwv23shT` reports source READY yes; none supplies graph/build/operational qualification.
The lead reports security `ses_e3e8e2af2ffeghBA7pJPnxjio9` READY for source/static scope only; this accepts no native graph, build, host/GPU qualification or broader operation.
Adversarial `ses_e3e8e2af9ffea4WmRI4iPfFWdJ` reports the MEDIUM binding finding resolved and READY for the source-only slice; security reconfirms the same limited scope after the fix and pure tests.
The [scoped review record](../_work/gpu-owner-recovery/gpu-functional-prepared-llvm-source-review.json) records those source-phase verdicts without accepting the then-unavailable graph, native build or GPU qualification; later local-6 evidence does not retroactively broaden them.

Exactly six baseline paths changed: `Cargo.lock`, both learning/policy-io Cargo manifests, `packages/runtime/tests/gpu-recipe.test.ts`, `tooling/runtime/Dockerfile.gpu` and `tooling/runtime/gpu-build-inputs.json`.
Run stability is not baseline identity: the current receipt's `sourcesChangedDuringRun:false` does not restore the old 273-input manifest's applicability.
The prior `gpu-functional-local-3` CPU/F64 evidence is now **HISTORICAL, PRE-PREPARED GENERATION**, not current whole-generation evidence; no fresh CPU numerical or CPU-behavior regression proof follows.
All earlier unchanged-273-hash statements below describe their recorded pre-prepared phases, not the current source tree; their receipts remain immutable.

<a id="current-local-evidence--gpu-functional-local-3-only"></a>

### Historical local-3 — pre-prepared CPU/F64 generation

The [historical receipt](../_work/gpu-owner-recovery/runs/gpu-functional-local-3/receipt.json) records `PASS`, all six stages at exit 0, `sourceChanged:false`, and scope `LOCAL_RECIPE_TYPES_AND_DEFAULT_CPU_ONLY` for that earlier generation.
It records 273 selected source inputs with manifest SHA-256 `3e5b58c02eeab08783051e087c57381dc0059605c2de6b07fac70e240bf09d45`.
Its retained stdout/stderr confirm the following bounded results; empty typecheck streams accompany the receipt's exit-0 statuses.

| Stage under `_work/gpu-owner-recovery/runs/gpu-functional-local-3/` | Recorded result | Scope |
|---|---|---|
| `recipe` | PASS: 8 tests / 83 assertions | Static GPU recipe/input-contract checks, not a GPU build or execution |
| `types-source` | PASS | `tsconfig.json` |
| `types-tests` | PASS | `tsconfig.tests.json` |
| `types-tools` | PASS | `_work/gpu-owner-recovery/tsconfig.json`; includes `gpu-functional-verify.ts` itself |
| `cpu` | PASS: 39 learning/policy-io tests | Default CPU Flex F64; two 2,335-coordinate sweeps cover all 4,670 coordinates at unchanged `eps=1e-6`, `atol=1e-8`, `rtol=1e-5` |
| `cpu-recipe` | PASS: 2 tests | CPU `chess-coach-host-facts` recipe tests, not actual host execution |

Preserve [local-1 FAIL](../_work/gpu-owner-recovery/runs/gpu-functional-local-1/receipt.json) and its streams: `types-tests` exited 2 with three TS2339 errors in the new recipe test before its typing correction.
[Local-2 PASS](../_work/gpu-owner-recovery/runs/gpu-functional-local-2/receipt.json) remains an earlier 272-input, five-stage generation with 8 recipe tests / 82 assertions.
It predates the two LOW source-coverage corrections: builder-root-before-LLVM ordering coverage, and tooling/verifier typecheck plus tooling-config manifest coverage.
Local-3 supplied that pre-prepared generation's result; its six now-changed inputs prevent promotion to current whole-generation proof, and no earlier receipt is rewritten.
Those results qualified the earlier local source/test stage only, not current CPU regression, image construction, selected-host GPU capability, training dispatch, full assurance or review acceptance.
The retained scoped adversarial, DevOps and security source-wiring acceptance in `_work/gpu-owner-recovery/gpu-functional-source-review.json` belongs to that earlier slice; it does not accept the prepared implementation.
This acceptance supplies no image, runtime, activation or training qualification.
The operator has supplied GPU/driver and Docker-runtime metadata in [the normalized host-observation record](../_work/gpu-owner-recovery/gpu-functional-host-observations.json); these are operator-reported facts, not an agent-run host verification or selected bindings.
The lookup packet, nested tests and later operator records sit outside the local-3 manifest; the prior visibility-record integrity check confirmed its 273 inputs unchanged without a new CPU test run.
That receipt does not validate the later LLVM inventory records; their separate record-only check confirms consistency and unchanged 273 functional / 6 lookup / 4 syntax source hashes without executing LLVM or rerunning tests.
That metadata-only check predates the separately approved version execution and integration review below; their separate integrity receipt validates the new records and streams without repeating the version probe.

The existing six ignored host GPU tests remain unrun evidence targets: two sweeps in `crates/learning/tests/finite_difference.rs` and four score/update/channel/reload tests in `crates/policy-io/tests/gpu.rs`.
Future selected-host verification must retain F64, all 4,670 coordinates at `eps=1e-6`, `atol=1e-8`, `rtol=1e-5`, actual scoring/backward/SGD/reload and exact C12 digests; CPU Flex/master `101..105` initialization and all model/objective/RNG/curriculum/checkpoint/eligibility semantics stay unchanged.

### Known functional activation gap — recipe is not training enablement

`tooling/runtime/Dockerfile.gpu:49` retains the application CMD `/app/packages/runtime/src/job.ts` through the existing init; `packages/runtime/src/job.ts:11` accepts only `native-proof`.
The actual `gpuJobMain` at `packages/runtime/src/gpu-job.ts:142` throws `SOURCE_ONLY_DISABLED`, and `crates/gpu-owner/src/main.rs:10` retains its disabled operational main.
The recipe has neither approved nor implemented activation of those normal GPU training paths.
After selected-host GPU capability is established, activation remains separately scoped functional implementation/wiring with ordinary source/test/readiness verification and separate execution/training authority.
It is not deferred security hardening, a new audit gauntlet, or an extra decision before the current prepared-input choice.

Executor's original `Cached-image probe (Recommended)` selection led to an operator-reported cache-inspection stop: both exact pinned images were missing, so the unchanged [Fish packet](../_work/gpu-owner-recovery/gpu-container-visibility.fish) created no container and ran no GPU query.
Executor then selected `Bun only (Recommended)`; the [first renewal](../_work/gpu-owner-recovery/gpu-container-visibility-renewal.json) retains its original pending status byte-unchanged, but the [historical operator result](#historical-bun-only-operator-result--authority-consumed) records **CONSUMED: one pull and one container attempt; zero remaining under that grant**.
That historical Bun pull succeeded; its OCI launcher lookup failed before any container process or GPU query started. The separate [renewal-2 result](#current-cached-visibility-result--renewal-2-consumed-packet-fail) now reports process startup and GPU enumeration, but the complete query packet **FAILS at exit 6**; its one-attempt authority is also **CONSUMED, zero remaining**.
Executor's metadata/version invocations and coding Rust install are consumed. The [completed locked-cache fetch](#current-locked-cache-fetch) and three offline feature trees now PASS with the fetch grant consumed; they supply no GPU probe, native compilation, runtime repair or additional acquisition authority.
No context-assembly helper is added by this spec pass, and neither version-only success nor source-only review implies prepared inputs or automatic selection.
The coding Rust provisioning and frozen-lock cache-fetch grants are consumed; no fetch/retry/download or tool install remains approved. No further probe, image pull/container/build, old LLVM archive read/rehash/mount/capture, acquisition, configuration change, restart, upgrade, compilation, staging/selection, native/host/GPU operation, training or publication is authorized without separate explicit scope. Both visibility grants remain spent, the prior full-pipeline hold remains and actual GPU work stays outside the coding sandbox.
Do not require reenacting the old isolated Bun/archive pipeline; its requests remain unchanged, diagnostics remain 0/3 with no accepted binding, and the full request stays halted.
Native capture, pidfd/cgroup/strict-stop work and ALL security/privacy hardening and isolation remain LAST, after **COMPLETE PLANNED TRAINING AND VALIDATE RESULTS**.

### Current host observations — received, operator-reported metadata only

[The host-observation record](../_work/gpu-owner-recovery/gpu-functional-host-observations.json) is normalized from pasted operator output, not an original machine capture.
Its displayed `Sun 08 Nov 2026 08:13:50 PM MST` GPU time and `08:14:01 PM MST` Docker time are not independently attested execution times.

| Reported field | Operator-reported value |
|---|---|
| GPU | NVIDIA GeForce RTX 3070 Laptop GPU |
| UUID | `GPU-713c95e0-6952-a576-794b-9ef1fb527ff0` |
| Driver | `615.78.08` |
| VRAM | 8,192 MiB total; 7,742 MiB free at the reported snapshot |
| Docker | `linux/x86_64`; runtime names `io.containerd.runc.v2`, `nvidia`, `runc` |
| NVIDIA runtime path | `nvidia-container-runtime`, reported registered, not functionally qualified |

Free VRAM is neither a reservation nor a sustained availability or admitted-fit guarantee.
The record cites [NVIDIA minor-version compatibility](https://docs.nvidia.com/deploy/cuda-compatibility/minor-version-compatibility.html): CUDA 13.x has a minimum driver branch of 580, so reported branch 615 meets that family floor only.
This comparison establishes neither an exact CUDA API/PTX ceiling nor actual F64 scoring, backward, SGD, reload or C12 agreement.
`13000` is an **ADVISORY candidate only**, not a selected CUDARC binding or compatible-input proof; the CUDA version and all three prepared-input selections remain `null`.
No global `selectedUuid`, host binding or Gate0 acceptance follows from this reported identity.

The consumed operator-only Bun pull and visibility attempt were functional work, not a security inspection, GPU-kernel test or training activation.
The first visibility paste reports only a container object and OCI launcher failure; the latest separate paste reports a started process, `/usr/bin/nvidia-smi` and the correct GPU CSV, followed by `No devices were found` and overall query exit 6.
This positive enumeration/memory snapshot does not turn the complete packet into PASS or establish Bun/CUDA numerical behavior; the failure cause remains unknown.
No host commands or operator tools ran through this agent; no Rust pull, image build, LLVM/libdevice preparation, native CUDA compilation or training is authorized.
The local-3 273-input source verification is historical pre-prepared evidence; six current baseline inputs changed, and lookup source checks below cover only their recorded earlier scope.

### Historical visibility packet — unchanged, authority consumed

The original [request](../_work/gpu-owner-recovery/gpu-container-visibility-request.json) and [packet](../_work/gpu-owner-recovery/gpu-container-visibility.fish) remain byte-unchanged, including the original no-pull rule and retained request status.
The limits below describe the historical probe, not a runnable handoff or remaining authority.
The original cache guard stopped before container creation; renewal-1 spent its separate one-pull/one-container allowance and failed at launcher lookup, while renewal-2 later spent its one cached attempt with process startup but query exit 6.
**HISTORICAL — NOT RERUN:** both renewals are consumed with zero remaining; neither the unchanged no-pull packet nor any retained pending status supplies replay authority. The coding agent must not invoke Docker or any host tool, even for metadata.

| Historical approved operation | Exact boundary |
|---|---|
| Cached-image inspection | Inspect the request's pinned Rust and Bun images with 10-second client deadlines each and a three-second kill-after. Bun must already exist as `linux/amd64`, or stop without pull/substitution; report missing Rust for later input selection without pulling it. |
| One conditional container | Use only the pinned cached Bun base, `nvidia` runtime, GPU UUID `GPU-713c95e0-6952-a576-794b-9ef1fb527ff0`, UID/GID `1000:1000` and `compute,utility` driver capabilities. No additional user mounts. |
| Metadata and ordinary caps | Resolve `nvidia-smi`, collect its fixed GPU CSV and UUID-scoped memory query only; use `--pull=never`, 2 CPUs, `512m` memory and 64 PIDs. These are probe limits, not production runtime or containment qualification. |
| Client deadline | The Docker query client has 30 seconds plus a three-second kill-after. This does not guarantee a physical hard stop, daemon/container termination or a hard return from native work. |
| Cleanup | A 10-second client deadline plus three-second kill-after applies only to force-removing the valid 64-hex CID recorded in this attempt's fresh CID file. Missing/invalid CID or failed cleanup remains unverified; do not target other containers. |
| Output | Use the packet's fresh `_work/gpu-owner-recovery/runs/host-visibility-XXXXXXXX` directory for query/cleanup streams, CID and reported exit statuses; no evidence directory is created by this spec pass. |

The unchanged probe packet itself grants no pull; the separate first renewal is consumed and grants no repeat pull/probe, Rust pull, image build, install, additional user mount, libdevice/LLVM archive operation, native CUDA compilation, CUDA kernel, training or host configuration change.
It supplies no new isolation/containment proof and does not reopen deferred hardening work.
Driver branch 615 still establishes only the reported CUDA 13.x family-floor comparison; the exact API/PTX ceiling, CUDARC binding version and three prepared-input selections remain unestablished/unselected.
The operator packet and runtime-lookup source checks are outside the existing local-3 result; that PASS is not operator execution, GPU visibility, activation or training acceptance.
The complete visibility packet has not passed; retained `containerGpuVisibilityEstablished:false` is not a denial of the latest reported enumeration, and `trainingReady:false` remains unchanged. Old diagnostic cases remain 0/3 unspent and the full pipeline remains halted.
ALL security/privacy hardening and isolation remain LAST, after completed planned training and validated results.

#### Operator cache-inspection result — not a runtime or CUDA failure

[The retained operator observation](../_work/gpu-owner-recovery/runs/gpu-container-visibility-host-inspection-1/operator-observation.json) is normalized from pasted output, not an original machine capture, and reports packet checkout `17a0ed9cf`.
Both pinned-image inspections returned exit 1 with `No such image`; the Bun result was empty, so the conditional prevented all container creation and in-container GPU queries.
Recorded counts are zero containers and zero GPU queries; query and cleanup exit codes are `null` because those operations never ran.
This establishes a reported cache prerequisite failure only, not NVIDIA runtime, CUDA, F64 or cleanup failure; the result itself grants no pull.
Missing Rust remains informational for this Bun-only probe and must not require a Rust pull or block the probe after Bun is successfully acquired.

#### Public registry metadata — declarations, not executed image versions

[The registry record](../_work/gpu-owner-recovery/gpu-functional-base-image-metadata.json) records public Docker Hub manifest/config metadata only: both exact pinned digest requests returned HTTP 200 with matching digest headers, OCI platform manifests and `linux/amd64` metadata.

| Exact pin from the record | Metadata-declared version | Compressed layers |
|---|---|---|
| Bun | OCI version label `1.4.0`; revision `34cbb9a40b4bd1bd767d134a7065e66c2432a676` | 7 layers; 89,195,521 bytes |
| Rust | Config environment `RUST_VERSION=1.95.0` | 5 layers; 563,746,315 bytes |

These are manifest/config declarations, not versions executed in an image; no layer payload was fetched and no image was pulled or container created by those metadata reads.
Compressed-layer sums are neither exact network-transfer totals nor unpacked disk requirements.
No base-image metadata implies GPU capability, selected compiler inputs or permission to acquire Rust.

### Historical Bun-only operator result — authority consumed

The [historical first visibility observation](../_work/gpu-owner-recovery/runs/gpu-container-visibility-host-probe-1/operator-observation.json) normalizes the retained [operator paste](../_work/gpu-owner-recovery/runs/gpu-container-visibility-host-probe-1/operator-paste.txt), not original machine files; the executed source commit remains unknown.
The original request, renewal, packet and earlier syntax receipts remain byte-unchanged; their pending statuses are historical, not current unspent authority.
The historical acquisition command remains in the renewal record for traceability, **not rerun**.

| Historical operator-reported result | Boundary |
|---|---|
| Bun pull succeeded; inspect exit 0, `linux/amd64` | Exact digest `sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038`; no numeric pull exit was supplied and no Bun version executed |
| Rust inspect exit 1, missing | Expected informational result; no Rust pull authorized |
| One container object created | CID `48633c91974748c087e2f49c511b91d746f7379a80af7863b788fd6b53b30a0b`; no container process started |
| OCI launcher lookup failed | `exec: "nvidia-container-runtime": executable file not found in $PATH`; query exit 127, zero started in-container GPU queries |
| Cleanup exit 0 | Operator-reported removal only; original `_work/gpu-owner-recovery/runs/host-visibility-tRp94up1` machine files were not received |
| First renewal authority **CONSUMED** | One pull / one container attempt used; zero remaining under that grant; the separate renewal-2 is now also consumed |

The lookup failure does not distinguish missing installation, a service PATH issue or a different daemon execution host; the root cause remains undetermined.
No `nvidia-smi`, CUDA kernel or Bun application ran, so no Bun/CUDA numerical failure or GPU proof follows.
Engine version, effective daemon endpoint, default runtime, daemon/containerd PATH and NVIDIA hook mode remain unknown after the later partial lookup; `runc 1.5.2` is not the Docker Engine version.
`containerGpuVisibilityEstablished` and `trainingReady` remain `false`; CUDA and all three prepared-input selections remain `null`.
Existing gpu-functional-local-3 and visibility-local-1 syntax receipts remain unchanged and cover neither runtime-lookup source checks nor the later operator lookup records.
ALL security/privacy hardening and isolation remain LAST, after completed planned training and validated results.

<a id="current-cached-visibility-renewal--operator-only-pending"></a>

#### Current cached visibility result — renewal-2 consumed, packet FAIL

The later [partial paste](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-host-2/operator-paste.txt) and [normalized observation](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-host-2/operator-observation.json) supersede the first lookup's shell-tool availability summary, not its retained historical bytes.
They are operator-reported metadata, not original machine captures; installation history, the source commit and exact executed handoff remain unknown.

| Prior host-2 lookup result | Boundary |
|---|---|
| RPM query exit 0: `nvidia-container-toolkit`, `nvidia-container-toolkit-base`, `libnvidia-container-tools`, `libnvidia-container1`, all `1.20.1-1.x86_64`; ctk-owner exit 0 identifies the base RPM | Reports the shell machine's installed packages; supplies no installation actions or runtime qualification |
| All six path lookups exit 0 under `/usr/bin`: `nvidia-container-runtime`, `nvidia-container-runtime-hook`, `nvidia-container-cli`, `nvidia-cdi-hook`, `nvidia-ctk`, `runc` | Does not establish the physical daemon host, daemon/containerd PATH or a successful launcher |
| Context show/inspect exit 0: `default`, `unix:///var/run/docker.sock`; info exit 0 | `DOCKER_HOST`/`DOCKER_CONTEXT`, version fields/exit and formatted info values remain omitted; effective endpoint, Engine and default runtime remain unknown |

After explicitly offering three routes in the parent session, the lead received Executor's actual selection `One visibility probe`; this was not child-agent advice.
The separate [renewal-2](../_work/gpu-owner-recovery/gpu-container-visibility-renewal-2.json) retains **APPROVED_OPERATOR_CACHED_IMAGE_VISIBILITY_ATTEMPT_PENDING** byte-unchanged as history, not current authority.
The [new normalized observation](../_work/gpu-owner-recovery/runs/gpu-container-visibility-host-probe-2/operator-observation.json) and [operator paste](../_work/gpu-owner-recovery/runs/gpu-container-visibility-host-probe-2/operator-paste.txt) record **FAIL_QUERY_EXIT_6_WITH_GPU_ENUMERATION_REPORTED_AUTHORITY_CONSUMED**.
They are operator-reported output, not original host machine files; the executed source commit remains unknown.

| Latest operator-reported result | Meaning / limit |
|---|---|
| Rust inspect exit 1, `No such image` | Expected informational missing pin; no Rust pull approved |
| Bun inspect exit 0, `linux/amd64` | Exact cached pin `sha256:18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038`; no new pull or executed Bun version follows |
| Container process started; `nvidia-smi=/usr/bin/nvidia-smi` | Distinct from the first attempt's pre-process OCI launcher failure; does not explain or rewrite that historical failure |
| CSV: NVIDIA GeForce RTX 3070 Laptop GPU | UUID `GPU-713c95e0-6952-a576-794b-9ef1fb527ff0`, driver `615.78.08`, total 8,192 MiB / free 7,742 MiB; positive enumeration and memory snapshot, not a reservation or admitted fit |
| Then `No devices were found`; overall query exit 6 | Complete visibility packet **FAIL**, not PASS; individual command exit codes and the UUID memory-detail result were not supplied |
| CID `ccb4eea1008855df75383447e27e4d02dddc8852d0a9f2c537b6b0e692c18f3c`; cleanup exit 0 | Operator reports cleanup success; original `_work/gpu-owner-recovery/runs/host-visibility-A2lyzIc2` machine files were not received |
| Renewal-2 **CONSUMED** | One invocation / one container used, zero remaining, zero pulls authorized and no automatic retry |

The unchanged packet's final source command scopes memory detail through `-i "$NVIDIA_VISIBLE_DEVICES" -q -d MEMORY`; this is the **apparent**, not independently proved, failure step.
The paste omits the actual in-container `NVIDIA_VISIBLE_DEVICES` value and per-command exit codes, so it cannot independently attribute exit 6 to that command; the cause remains unknown.
Do not diagnose a mapping, environment or driver bug from this output.
The lead-supplied [NVIDIA return-value reference](https://docs.nvidia.com/deploy/nvidia-smi/index.html#return-value) supports UUID selection with `-i` and defines exit 6 as a query to find an object being unsuccessful; that definition does not identify the cause here.

**HISTORICAL — NOT RERUN:** the original request, both renewal records, packet and old receipts remain byte-unchanged; all retained pending statuses describe earlier authority generations, and both attempt grants are now spent.
No new probe, pull, runtime/image substitution, retry, install, configuration change, restart, image build, archive operation, compiler/native execution, CUDA kernel, training or full-pipeline renewal is granted; the coding agent runs no host/GPU command.
The [renewal-2-local-1 receipt](../_work/gpu-owner-recovery/runs/gpu-container-visibility-renewal-2-local-1/receipt.json) is historical pre-attempt record-integrity PASS for its three records and 4 syntax / 6 lookup / 273 functional source hashes, not validation of these two later operator records.
Adversarial `ses_e3ef69e6bfferfNKS5hDky5X6K` and security `ses_e3ef69e63ffe3gge4Idewgy4nV` accepted the earlier scoped handoff, not the new result or runtime/GPU qualification.
The [current local receipt](../_work/gpu-owner-recovery/runs/gpu-container-visibility-host-probe-2-local-1/receipt.json) records PASS for record/paste consistency, consumed authority, unchanged 4 syntax / 6 lookup / 3 renewal / 273 functional source hashes, preserved literal UUID telemetry selection and matching diagram/index coverage; it executes no host/GPU command and reruns no tests.
Adversarial `ses_e3ee00270ffeTZYU4IG9C79aM7` and security `ses_e3ee00264ffd1cJ7tuxc7DZ8OP` accept this docs/data scope, not the failed packet or operational/GPU qualification.
The new records change no source/test/verifier or prior receipt; no new CPU test is required by this observation.

##### Actual cooperative telemetry contract — qualification still pending

[`crates/gpu-owner/src/telemetry.rs:6–11`](../crates/gpu-owner/src/telemetry.rs) explicitly constructs literal `--id={uuid}`, `--query-gpu=uuid,driver_version,memory.total,memory.used,memory.free` and `--format=csv,noheader,nounits`; it is not an unscoped all-visible-device provider.
Its decoder requires one bounded ASCII line and exact expected UUID/driver agreement before accepting numeric memory fields.
The packet's apparent environment-scoped memory-detail failure neither qualifies nor fails this distinct literal-UUID CSV provider.
Actual selected-path functional telemetry qualification remains pending before training, alongside unchanged cooperative selector/eligibility, ceilings and host coexistence; it is not a prerequisite for read-only input planning.
No extra NVML gauntlet or archived Bun audit precedes that planning.
The full packet remains FAIL, no actual CUDA GPU code or F64 work is established, and `trainingReady:false` remains unchanged.
F64, all 4,670 coordinates/tolerances, exact C12 and CPU Flex/master `101..105` initialization remain unchanged; ALL security/privacy hardening and isolation remain LAST, after completed planned training and validated results.

#### Historical first partial runtime lookup — operator-reported only

The earlier [partial operator paste](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-host-1/operator-paste.txt) and [normalized observation](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-host-1/operator-observation.json) retain `OPERATOR_REPORTED_PARTIAL_LOOKUP_REQUIRED_HEADER_FIELDS_MISSING`, not an original machine capture or current shell inventory.
The source commit and exact executed handoff remain unknown: the paste does not attest inline handoff versus repository script.

| Partial operator-reported result | Boundary / missing evidence |
|---|---|
| Context show/inspect exit 0; `default`, `unix:///var/run/docker.sock` | Reported context endpoint only; exported `DOCKER_HOST`/`DOCKER_CONTEXT` lines were omitted, so the effective endpoint and physical daemon host remain unknown |
| Docker info exit 0 | Formatted values omitted; all version values and version exit omitted; Engine version, server OS, default runtime and current runtime map remain unknown |
| Shell OS: Fedora Linux 44 Workstation | Describes the shell machine, not an established daemon execution host |
| Shell PATH: `nvidia-container-runtime`, `nvidia-container-runtime-hook`, `nvidia-container-cli` each exit 127 with empty path | Does not establish installed RPMs, daemon/containerd PATH or the daemon-side cause |
| Shell PATH: `nvidia-ctk` and `runc` exit 0 at `/usr/bin`; executable candidates also reported under `/bin` | Path/executable checks only; no tool-execution, package-owner or base-only-installation proof |

No RPM inventory, package-owner result or `nvidia-cdi-hook` lookup was supplied; daemon-side root cause remains unknown.
The [record-only check](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-host-record-local-2/receipt.json) passes paste consistency and unchanged six lookup / 273 functional source hashes; it reruns no tests or host commands.
The earlier record-local-1 receipt predates the correction from an asserted CDI lookup history to the supplied result's absence; retain it as prior-generation evidence only.
At this historical generation, the next lead/operator decision concerned missing existing headers or a small read-only RPM/package-owner inventory, not a new prerequisite gauntlet; that record issued no operation or authority.
The first pull/probe allowance and the separate renewal-2 are both consumed with zero remaining; neither grants a further attempt, runc variant, install, configuration/restart/tool/driver change or training.

##### Repository handoff source and local evidence — unchanged

[gpu-runtime-lookup.fish](../_work/gpu-owner-recovery/gpu-runtime-lookup.fish) remains operator-handoff source; the partial paste does not prove execution of that exact script or supply fresh authority.
It reports only exported `DOCKER_HOST`/`DOCKER_CONTEXT` values (`set -qx`; otherwise `<unset>`), Docker version/info/current context/context endpoint with at most four 10-second client deadlines plus three-second kill-after, and shell-machine `/etc/os-release` and fixed path checks.
The five names are `nvidia-container-runtime`, `nvidia-container-runtime-hook`, `nvidia-container-cli`, `nvidia-ctk` and `runc`; the six directories are `/usr/bin`, `/usr/sbin`, `/usr/local/bin`, `/usr/local/sbin`, `/bin` and `/sbin`.
It resolves/checks paths without executing those tools or starting a container; client/context and shell-machine paths do not prove the daemon execution host or daemon/containerd PATH.
No shell access to a remote daemon host is supplied or assumed, and a context endpoint need not be the effective endpoint under environment overrides.
The current [lookup-local-3 receipt](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-local-3/receipt.json) records `PASS`, scope `FISH_SYNTAX_STATIC_TESTS_AND_TEST_TYPES_ONLY`, and `sourceChanged:false`.
Under `_work/gpu-owner-recovery/tests/`, `gpu-runtime-lookup.test.ts` and `verify-runtime-lookup.ts` use strict `tsconfig.json`; Fish `4.9.3 --no-config --no-execute`, [five static tests / 53 assertions](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-local-3/static-tests.stderr), and test/verifier typechecking all exit 0.
The verifier records six input SHA-256s and stdout/stderr with 10/30/30-second stage deadlines plus three-second kill-after; it freshly rechecks all 273 prior gpu-functional-local-3 source hashes with zero mismatches.
The original gpu-functional-local-3 inputs/evidence stay unchanged; this is no new CPU test run and requires no full CPU rerun.
Earlier [lookup-local-2 PASS](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-local-2/receipt.json) recorded 52 assertions before the exported-environment fix and regression assertion.
Preserve [lookup-local-1 FAIL](../_work/gpu-owner-recovery/runs/gpu-runtime-lookup-local-1/receipt.json): Fish syntax exit 0, four static passes/one failure because the negative regex matched `build` in the `SPEC:` filename, not a forbidden command; typechecking did not run.
The corrected test excludes the `SPEC:` line; the pointer and original packet remain intact.
Within the unchanged **LOCAL** receipt, `lookupPacketExecuted`, `dockerCommandsExecuted` and `cudaGpuCodeExecuted` remain `false`; these scoped flags do not negate the separate partial operator report.
The two first-lookup operator files lie outside its six hashed inputs and the older 273-input CPU manifest; no source/test/verifier or receipt changed, and no tests were rerun for that docs-only addition.
The lead reports adversarial `ses_e41520899ffeQKIuTNgX9L1MpP` READY yes after the LOW stale-doc fix and security `ses_e41520898ffer9yrOkXEAM23ZI` READY yes for the narrow operator proposal.
DevOps `ses_e415ccaf5ffeKtkUCGX1sfkYVh` confirms proposal-only readiness after the exported-variable correction covered by lookup-local-3.
These scoped source/proposal reviews grant no operational authority or GPU qualification; the later partial report supplies shell/context observations, not established daemon-host facts.

##### Prior DevOps read-only upstream research — not host inventory

- The lead reports prior official-source research of [NVIDIA's v1.20.1 RPM spec](https://github.com/NVIDIA/nvidia-container-toolkit/blob/v1.20.1/packaging/rpm/SPECS/nvidia-container-toolkit.spec#L159-L169): the base package supplies `nvidia-ctk`, the runtime and CDI hook; the full toolkit adds the legacy hook and a `libnvidia-container-tools` dependency, which supplies the CLI. `nvidia-ctk` alone therefore does **not** prove base-only installation: the upstream base also supplies the runtime unresolved by the first historical shell PATH lookup.
- NVIDIA publishes [Fedora DNF instructions](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html#with-dnf-rhel-centos-fedora-amazon-linux), but its [tested-platform table](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/supported-platforms.html) does not list Fedora. These sources do not qualify Fedora 44 or identify installed packages here.

**Candidate only:** a later explicit `--runtime=runc` + `--gpus` route depends on the actual Engine's NVIDIA hook registration and required executables; it is neither selected nor approved, and current evidence neither rules it in nor rules it out.
Legacy handling uses `nvidia-container-runtime-hook`; [pinned modern Moby](https://github.com/moby/moby/blob/561a5a9b36f971b4b543e1aac3efda12998a6e33/daemon/devices_nvidia_linux.go#L38-L79) also recognizes `nvidia-cdi-hook` independently, per the lead's prior DevOps research.
The first lookup supplied no `nvidia-cdi-hook` result; the later paste supplies its shell path but still no Engine version or actual Engine hook-registration proof, so neither a working route nor a universal legacy-only restriction follows.
Omitting `--runtime` does not establish runc because the default runtime is unknown.
Retained upstream references: [Moby v27.5.1 NVIDIA hook registration](https://github.com/moby/moby/blob/v27.5.1/daemon/nvidia_linux.go) and [NVIDIA's direct `--gpus` mode caveat](https://github.com/NVIDIA/nvidia-container-toolkit/blob/main/cmd/nvidia-container-runtime/README.md#notes-on-using-the-docker-cli).
These references describe candidates, not this unknown Engine/host; they grant no operation or publication by themselves.

#### Local packet syntax evidence — no packet commands executed

[The syntax-only receipt](../_work/gpu-owner-recovery/runs/gpu-container-visibility-local-1/receipt.json) records Fish `4.9.3` with `--no-config --no-execute`, `PASS`, exit 0, and scope `FISH_SYNTAX_ONLY_NO_PACKET_COMMAND_EXECUTION`.
It records four artifact SHA-256s: the Fish packet, visibility request, normalized host observations and compiler-candidate inventory.
This proves only the recorded syntax check; it executed no Docker commands and establishes no image availability, container launch, NVML visibility, compiler usability or native/GPU qualification.
The earlier visibility-handoff DevOps READY covered proposal source only; current lookup review dispositions appear above, not as host/GPU qualification.
Those checks are distinct from recipe/source-wiring acceptance; the original request retains `APPROVED_OPERATOR_EXECUTION_PENDING` unchanged as history, while both later operator attempts have consumed their separate grants. Renewal-2 reports enumeration but complete-packet FAIL, not a pending attempt or accepted visibility qualification.

<a id="coding-realm-compiler-candidate--directory-metadata-only-unselected"></a>
<a id="current-compiler-prefix-inventory"></a>

### Coding-realm LLVM metadata phase — consumed, unchanged

Executor explicitly selected `Oh yes, existing LLVM then (recommended #1)` after the scope explanation.
The [inventory request](../_work/gpu-owner-recovery/gpu-functional-llvm-prefix-inventory-request.json) records `AUTHORIZED_METADATA_PASS_CONSUMED`: one coding-environment metadata pass used, zero remaining, no automatic retry.
The [new metadata record](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-prefix-inventory-1/metadata.json) and [stat transcript](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-prefix-inventory-1/stat-transcript.txt) normalize actual agent stat/directory-tool returns, not operator-host observations or original raw stream files.
They cover only this exact prefix:

`/home/agent/toolchains/linux-amd64/.local/share/mise/installs/github-tracel-ai-tracel-llvm/23.1.0-4`

| Captured metadata | Meaning / limit |
|---|---|
| Prefix, `bin`, `include`, `lib` and `include/llvm` are directories | Fixed-path layout evidence only; no full-tree or installed-version proof |
| `bin/llvm-config` is a regular file, 362,392 bytes, mode `755` | Not execution, actual-version verification, ELF inspection or dependency/link-closure proof |
| `libLLVMNVPTXCodeGen.a`, `libLLVMNVPTXDesc.a`, `libLLVMNVPTXInfo.a`, `libLLVMCore.a` and `libLLVMSupport.a` are positive-size regular files | Metadata only; no library/archive bytes read or compiler usability established |
| `.tracel-llvm-installed` and `share` return `ENOENT`; layout stat phase exits 1 | Preserve the historical failure; the marker blocked the then-current recipe, not the later prepared-only mode or proof of a broken LLVM installation |
| 13 fixed stat paths; four directory listings, at most 64 entries each, relative depth at most 2; 73 names retained | `lib` stops at its first 64 names and is explicitly truncated; no full-tree inventory |
| Four stat-client invocations, each with a 10-second deadline plus three-second kill-after | Per-client bounds only; no aggregate hard deadline was enforced or claimed |

At inventory time the GPU recipe required the upstream marker, so retained `NOT_READY_FOR_CURRENT_RECIPE` status describes that earlier recipe, not today's prepared-only mode.
The current [`Dockerfile.gpu:16–18`](../tooling/runtime/Dockerfile.gpu) retains executable-config/version guards and selects `gpu-prepared-llvm` without marker admission; the later source request, not either probe, approved that explicit mode change.
No marker content was read or fabricated; the prefix remains unstaged/unselected, and neither missing historical cache metadata nor version success requires mandatory redownload or extra host installs.
The old [compiler-candidate JSON](../_work/gpu-owner-recovery/gpu-functional-compiler-candidates.json) stays byte-unchanged as historical directory-only evidence hashed by the old syntax receipt; the new records supersede that knowledge without selecting the prefix.
This metadata phase executed no LLVM, read no file contents or archive bytes, copied/downloaded nothing and traversed no symlink targets; those unchanged phase-local flags do not deny the later separately approved version execution.
The single-pass permission is consumed and grants no further metadata read, native probe, copy, acquisition, installation or configuration change.
The [record-only check](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-prefix-inventory-1/record-check.json) records PASS for request/metadata/transcript consistency and unchanged 273 functional / 6 lookup / 4 syntax source hashes; it preserves layout-stat exit 1 and the truncated library listing, executes no LLVM and reruns no tests.
Adversarial `ses_e3eb7aea6ffebo6aRh5VVuBKIj` and security `ses_e3eb7ae97ffeGv1dFaz9Od9N4i` accept this metadata/docs scope, not LLVM selection, execution or GPU qualification.

<a id="current-llvm-version-and-integration"></a>

### Retained LLVM version result — version-only PASS, no build proof

Executor actually selected `Verify version Recommended` in the parent session, approving one exact non-CUDA version invocation plus source-only CubeCL integration review.
The [version request](../_work/gpu-owner-recovery/gpu-functional-llvm-version-request.json) retains `APPROVED_ONE_NON_CUDA_VERSION_PROBE_PENDING` as the original authority projection; it is not current unspent permission.
The [receipt](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-version-1/receipt.json), [stdout](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-version-1/command.stdout) and [empty stderr](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-version-1/command.stderr) record **PASS_VERSION_ONLY; CONSUMED: one invocation, zero remaining**, with no automatic retry.

| Recorded result | Scope / limit |
|---|---|
| Exact recorded prefix `bin/llvm-config --version`; exit 0; stdout `23.1.0` plus newline (7 bytes); stderr 0 bytes | Establishes that this coding-environment native program ran and reported the expected version, not compilation, linker closure, GPU capability or host inputs |
| 10-second client deadline plus three-second kill-after | Bounds this one client invocation; establishes no physical hard-stop guarantee or renewed execution grant |
| `PATH=/usr/local/bin:/usr/bin:/bin`, `LANG=C`, `LC_ALL=C` | Recorded minimal environment, not a selected container build/runtime environment |
| `nativeNonCudaProgramExecuted:true`; `prefixModified:false`, `prefixSelected:false`, `markerCreated:false` | No compiler build, copy, download, archive-byte access, host/GPU operation or training followed; `trainingReady:false` remains unchanged |

The old candidate, metadata request/records, record-check and syntax evidence remain unchanged historical phases; their no-LLVM-execution flags describe those phases only.
The [version integrity check](../_work/gpu-owner-recovery/runs/gpu-functional-llvm-version-1/integrity-check.json) records PASS for the exact one-invocation authority, captured stdout/stderr bytes and hashes, unimplemented proposal, unchanged prior source hashes and matching diagram/index coverage; it repeats no probe, reruns no tests and proves no project graph or GPU build.
Adversarial `ses_e3ea24973ffe02t83o0wqJK0EE` and security `ses_e3ea24967ffdwKa0LTUepgBPxd` accept this records/research scope, not integration implementation or operational/GPU qualification.

#### Historical source-only CubeCL review — proposal record unchanged

The [primary review record](../_work/gpu-owner-recovery/gpu-functional-llvm-integration-review.json) cites released upstream source and Cargo `1.95.0` resolver source, not a local dependency build or verified project graph.
At that phase architect `ses_e3eea8cfeffecDxOMiTQwd2chs` and backend `ses_e3eb390a0ffevPYsyX7nd2VlAn` recommended a proposal only; the JSON retains that historical `PROPOSED_NOT_APPROVED_OR_IMPLEMENTED` status byte-unchanged.
The later implementation request and current source/evidence above supersede its approval/implementation state without rewriting the research record or claiming a verified project graph.

| Reviewed source / proposal | Finding and boundary |
|---|---|
| [CubeCL LLVM `0.11.3` build script](https://docs.rs/crate/cubecl-llvm/0.11.3/source/build.rs) and [bundler `23.1.0-4` source](https://docs.rs/crate/tracel-llvm-bundler/23.1.0-4/source/build.rs) | GPU shims use the bundler's `llvm_path()` and `link()`; its fixed XDG suffix is `tracel/tracel-llvm-23.1.0-4`, and an absent marker normally triggers installation |
| `LLVM_SYS_231_PREFIX` alone | Does not redirect this chain; the reviewed `llvm-sys` no-linking/disabled-target-initialization combination returns before config lookup; skipping checksum download does not skip archive installation |
| Public bundler `xtask = []` feature | Skips the bundler installer only; CubeCL native shim compilation and static linking remain. This source-supported use lies outside its primary xtask-tooling purpose; it is not a documented external-prefix API |
| **PROPOSED**, explicit `gpu-prepared-llvm` feature | Learning feature edges: `gpu-cuda` + `dep:tracel-llvm-bundler`; optional **host build dependency** `tracel-llvm-bundler =23.1.0-4` with `xtask`; policy-io forwards `gpu-cuda` + `chess-coach-learning/gpu-prepared-llvm` |
| **REVIEW-TIME PROPOSAL**, prepared/offline recipe mode | Supply a prepared prefix at `/opt/tracel-data/tracel/tracel-llvm-23.1.0-4`; remove marker admission only in that explicit mode and retain the version guard, CPU defaults, `gpu-cuda` and pinned versions. That proposal is now implemented in source only; no prefix is actually supplied |

[Inference] The reviewed [Cargo resolver source](https://github.com/rust-lang/cargo/blob/rust-1.95.0/src/cargo/core/resolver/features.rs#L629-L668) indicates that the optional host build dependency can activate host features without adding a learning `build.rs`; this is not verified against the project's actual selected host-feature graph.
The review records a no-op build-script alternative with additional CPU build-script overhead, not a proven requirement.
Historical local dependency-source paths were unavailable; the review read source HTTP documents and acquired no dependency crate archives.
Never substitute a fake marker, `DOCS_RS`, manually set `CARGO_FEATURE_XTASK`, or an unverified `LLVM_SYS_231_PREFIX` bypass for a genuine integration.
The version/research phase changed no recipe, manifest, prefix or selection; the separately authorized prepared source implementation followed, but still establishes no native/GPU build qualification.

<a id="current-prepared-input-route-choice--planning-only"></a>
<a id="current-prepared-input-decision"></a>

### Retained prepared-bridge phase — tools/cache and feature trees PASS before the transfer grant

The status and exclusions in this phase describe its original grant projections, not current transfer authority.
The later [original transfer request](#current-input-transfer) separately approved bounded preparation/publication, now preparation PASS and first publication consumed/STOP.
The still later [explicit-HTTPS attempt](#current-https-publication) also ran once and stopped at commit; both grants are consumed, without reopening preparation or rewriting production-contract/receipt projections.

The lead reports architect `ses_e3eea8cfeffecDxOMiTQwd2chs` accepts read-only input planning from the reported CSV without a new metadata gauntlet; complete-packet FAIL and future actual functional telemetry/GPU validation remain explicit.
Both the metadata pass and separately approved version invocation are **CONSUMED**, not pending or renewable by this document.
Executor selected `Reuse LLVM Recommended`; the source/static/offline-graph scope is accepted, not a pending bridge-choice question.
The implementation request accepts the public-feature primary-purpose exception, but grants no compilation, prefix copy/selection, acquisition, marker creation, image/host/GPU operation or training.
Executor's later Rust-toolchain grant is **CONSUMED**, one install / zero remaining; it does not cover project dependency restoration/acquisition or another verifier/helper invocation, and selects no LLVM or image input.

| Retained phase state | Boundary |
|---|---|
| Prepared bridge source | Implemented under the separate request; unchanged 277-source manifest, six static stages PASS and scoped source acceptance retained; local-6 now proves separate-mode feature trees, not compiled host/native/GPU qualification |
| Scoped Rust tool recovery | Completed install PASS at exit 0, repo Cargo/rustc available; overall helper status remains `TOOLCHAIN_INSTALLED_OFFLINE_GRAPHS_NOT_VERIFIED`, consumed grant, no reinstall |
| Locked registry-cache grant | Completed `CACHE_AND_FEATURE_TREES_PASS_NO_COMPILATION`, fetch/offline-verifier exit 0; **CONSUMED one fetch / zero remaining**, 282 bound sources unchanged, no additional downloads |
| Latest completed offline project graph | Local-6 `PASS_STATIC_AND_FEATURE_TREE_ONLY` / `PASS_FEATURE_TREE_ONLY`: three separate actual offline trees exit 0 with all predicates matched, unchanged 277-source manifest; local-5 FAIL stays historical |
| Operational qualification | Rust provisioning does not select LLVM/builder/runtime/CUDARC inputs or a Rust image; no compilation, prefix staging, image/host/GPU work or training; no broader operation grant follows |

Prepared LLVM and builder/runtime inputs remain unselected, the prefix uncopied/unstaged and libdevice missing/unselected; all three selections and `CUDARC_CUDA_VERSION` remain `null`. The GPU image is unbuilt; the pinned Rust image was absent at the last received inspection, with no approved acquisition/pull.
Input planning changes no F64/4,670-coordinate/tolerance/C12 or CPU Flex/master `101..105` contract, cooperative selector/eligibility, ceilings or host coexistence requirement.
The visibility packet remains FAIL at exit 6 despite positive enumeration, and actual literal-UUID telemetry qualification remains pending; no old Bun/archive pipeline is revived.
Defer signature/provenance assurance with ALL security/privacy hardening and isolation until LAST, after completed planned training and validated results; add no new assurance gauntlet before this functional integration decision.
The selected tool/cache task is complete with positive actual feature-tree evidence; remaining functional work concerns prepared input selection/staging and actual compiled API/ABI binding, not missing Cargo or this prior cache-resolution failure.
Any further acquisition/cache operation, compilation, staging/selection, native LLVM, image or host/GPU work requires separate explicit scope; no automatic proposal or operation is approved here, and all old retry advice/grants remain spent. `trainingReady:false` remains unchanged.

Retained prepared-bridge status: `SOURCE_RECONSTRUCTED` / `VERIFIED_TEST_SUBSETS` / `PREPARED_SOURCE_REVIEWS_ACCEPTED_SCOPED` / `PREPARED_STATIC_PASS` / `RUST_TOOLCHAIN_PROVISIONED` / `LOCKED_CACHE_AND_FEATURE_TREES_PASS_NO_COMPILATION` / `INSTALL_AND_FETCH_AUTHORITY_CONSUMED` / `AWAITING_PREPARED_INPUT_SELECTION` / GPU LEARNING REQUIRED / SHARED-GPU HOST DOCKER DESIGN SELECTED / BACKEND AND TARGET UNQUALIFIED / `trainingReady:false`.

## CURRENT restored GPU goals

[recovery.md](recovery.md) records accepted retained scope, missing bytes, consumed grants, and historical-only test/review reports.
[gpu-owner.md](gpu-owner.md) and [gpu-cooperative-policy.md](gpu-cooperative-policy.md) record the connected disabled-owner/job and cooperative-policy source contracts.
Corrected owner/job/policy source is connected; 72 owner cases including 15 lifecycle and 19 observation cases pass, with locked/offline Clippy and direct rustfmt checks.
Persisted Rust C1 security, authenticated TypeScript packet-5 security, scoped integer-contract, and final adversarial verdicts accept reviewed source only; authenticated reference guards retain 25/194, and no source slice establishes GPU or operational readiness.
The parent reports nine reconstructed CUDA leaf files and six ignored actual-GPU fixtures, without fresh compilation; app initialization remains unchanged.
Restore optional CUDA score/channel selection in F64 without CPU fallback; keep default CPU Flex and master-101..105 initialization unchanged.
Retain all 4,670 finite differences, `eps=1e-6`, `atol=1e-8`, `rtol=1e-5`, and exact C12 digests.
The historical `cubek-fft 0.3.1` and four lock-list approval is reconstructed history, not permission for new network or dependency acquisition.
The earlier missing-libdevice state was superseded by [completed preparation](#current-prepared-input-bytes), which retains the exact selected bitcode/LICENSE and prepared bundle identities.
The acquisition/preparation grants stay consumed; retained bytes authorize no new download, prefix read/copy, repacking or preparation replay.
The cooperative policy rejects expired old leases before accepting replacement telemetry and cannot reserve VRAM or guarantee uninterrupted host use.
Legacy NVIDIA runtime/device-request injection is only a candidate with independently required inventory; inspect cannot certify hidden OCI/loader closure.
Actual UUID, thresholds, controls/paths, state/evidence locations, provider, image, proc permissions, provider caching, and Gate0 acceptance remain unset.
Both ordinary new mains remain disabled; host/GPU/image/capture/build/production/acquisition/training operations still need separate exact grants.
The [second publication-only attempt](#current-https-publication) failed at commit and stays consumed; the separate [third identity outcome](#current-identity-publication) is DRAFT publication PASS/consumed, without functional readiness or further mutation authority.
Historical input restoration recorded `TOOLCHAIN_OWNER_DEFAULT_CPU_RESTORED` / `LOCKED_INPUTS_RESTORED_AND_FRESHLY_VERIFIED`: Rust `1.95.0` minimal/rustfmt/Clippy, restored Zig `0.15.2` CPU linker, and selected locked owner/default-CPU inputs under scoped minimal-config mise trust; root mise remains untrusted/unchanged.
That earlier restoration status is not current build/GPU readiness: local-4 absence and local-5 cache failure are historical, while the separate install/cache grants now completed and local-6 passed three actual offline feature trees; no compiled host coupling, build or fresh CPU regression follows.
Zig restoration changes no CUDA compiler route and supplies no CUDA/LLVM/NVIDIA/SDK/image/host/GPU grant.
Retained [bounded receipts](verification.md#preferred-corrected-source-receipts) also record 39 CPU tests / all 4,670 finite differences, policy 352/1,262, bridge 27/388, authenticated reference guards 25/194, runner/audit 12/72, and passing snapshot typechecks with `sourceChanged:false`.
The guard compares the exact original-tree/stage-0 index set without worktree/cached diffs or source clean/textconv execution; prior 13/88 evidence remains `PRE_FILTER_EXECUTION_FIX`.
The [implemented repair](reference/object-graph-authentication.puml) authenticates raw commit/tree ancestry and refuses missing objects without lazy acquisition; 25/194 and affected test types pass with current scoped source acceptance, while prior 16/108 remains `PRE_OBJECT_GRAPH_AUTHENTICATION`.
The Rust shared-policy case passes all 33 reconstructed traces; 61 contradiction mutations remain inside one wire case, not extra top-level tests or historical-byte recovery.
The earlier TypeScript security verdict is historical before physical-reference pinning and integer regressions; it closes no current review gate.
The corrected workspace/lock/frozen-file audit now includes required actual `policy-initialize.rs`; earlier 38-case passes remain `PRE_SECURITY_AND_INTEGER_CORRECTION`, and the 70-case checkpoint remains `PRE_LINK_COUNT_GUARD`.
Held-leaf `nlink()==0` under stable ancestors proves namespace unlinking, not inode destruction; actual cgroupfs link-count semantics and non-atomic state/Docker bind behavior remain unqualified.
Actual storage, GPU/driver coexistence, CUDA inputs, Gate0/F9/R4, and full legacy Bun/C14/native proof remain open; no operational grant follows from source passes.
All twelve selected `closure-*-1` reruns pass with `sourceChanged:false`, and `closure-verification-integrity-2` validates complete closing manifests/raw streams, all 198 packet-5 inputs, and the accepted 27-input Rust/root-Cargo scope while preserving the first historical whole-packet mismatch FAIL.
The current frozen-boundary audit and final three-diagram render `source-accepted-diagrams-2` pass; `closure.json` separately indexes staged namespace/scoped-whitespace evidence.
The production Dockerfile stays CPU-only; actual GPU F64/C12, storage fsync and driver/proc/cgroupfs/coexistence qualification remain absent, with no renewal of consumed CUDA/LLVM/NVIDIA/libdevice acquisition authority.
The earlier investigation and verification language below is historical context, not a fresh recovered implementation claim.

Executor requires the admitted execution target to access the GPU and reports 8 GB VRAM.
Executor selected `Host uses the GPU` and `GPU learning (Recommended)`.
This changes the readiness acceptance condition, not host-operation authority.
Executor then selected `Host Docker GPU job (Recommended)`.
Host mise remains the entrypoint and the coding agent remains in sbx.
The selected training target is a supported shared-GPU host Docker container, replacing the earlier dedicated-training-sbx design.
Keep the active GPU attached to its host driver.
Executor also selected host-backed private state; no actual filesystem, GPU identity, Docker endpoint or runtime installation has been selected or qualified.
Executor subsequently supplied NVIDIA identity, driver and 8,192 MiB total-memory observations in the operator-reported admission packet; see [host-entrypoint.md](host-entrypoint.md#received-observations-and-provenance-boundary).
These reported observations do not independently select or qualify the device, runtime or measured availability.
Do not infer device availability or display ownership from capacity, vendor or the additional Intel `i915` device.
Do not detach a host/display GPU, enable experimental settings, load modules, bind PCI devices, install drivers or build a driver bundle without a separate exact approved plan.

## Official findings

- https://docs.docker.com/ai/sandboxes/configuration/gpu-passthrough/
- https://docs.docker.com/ai/sandboxes/configuration/environment-files/
- https://docs.rs/crate/burn/0.22.0/source/
- https://docs.rs/crate/burn-cuda/0.22.1/source/
- https://docs.docker.com/engine/containers/resource_constraints/
- https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/docker-specialized.html
- https://docs.nvidia.com/deploy/nvidia-smi/index.html

Docker documents experimental local GPU passthrough through VFIO on x86_64 Linux with NVIDIA hardware.
Its supported setup requires an unused/headless or additional GPU, IOMMU and kernel modules, feature flags, and a driver/module bundle matching the sbx guest kernel.
The `--gpu` option remains hidden until the experimental and GPU feature flags are enabled.
GPU assignment takes effect at sandbox creation, not when reattaching to an existing sandbox.
The documented VFIO path assigns the device to the VM instead of the host driver.
It is not a shared-GPU substitute for a device the host actively uses.
The installed ordinary create help did not expose `--gpu`.
Do not silently enable settings to change that result.

Burn documents CUDA through its standard `cuda` feature and runtime `Device` selection.
The CUDA backend describes a CUDA 12.x runtime dependency.
The fetched 0.22.0 rustdoc pages report documentation build failures; use exact released source for API/feature checks rather than importing a newer release's working API as proof.
No backend declaration or device enumeration proves actual F64 support, model/update correctness or VRAM fit on this host.
The retained manifests and executable entrypoints select CPU Flex as the CPU reference foundation; fresh verification is pending.
The current lockfile records Burn facade 0.22.0, `burn-cuda` 0.22.1 and CubeCL 0.11.3; optional lockfile membership does not mean a CUDA build was selected.
[Unverified] The backend investigation reports an unsupported-F64 test in `burn-cuda` 0.22.1 and F64 registration in CubeCL 0.11.3.
End-to-end feasibility remains unresolved; neither finding alone proves absolute impossibility or working Burn model/gradient/record support on this target.
Do not change dependencies, select deprecated LibTorch, reduce precision or waive numerical checks on the strength of this investigation.
NVIDIA documents Docker GPU selection by UUID/index and runtime-managed driver capability injection.
Its `compute` and `utility` capabilities support CUDA and NVML without requesting display/graphics capabilities.
The operator-reported NVIDIA device makes this a candidate, not a selected runtime; the required supported runtime must still be identified or separately approved for installation.
Do not use the documentation's `--gpus all`, `--privileged`, `--rm`, or unpinned image examples as approved job commands.
The future exact packet must account for GPU device access, driver-library injection, selected device identity and supported VRAM policy without weakening C2/C8/C13.

## Runtime alternatives (shared-GPU host container selected)

| Proposal | Consequence | Separate evidence / authority |
|---|---|---|
| Shared-GPU host container (selected) | Keep host mise as entrypoint and the coding agent in sbx; run the isolated learning job through a supported host GPU container runtime instead of VFIO | Executor amended the design only; select vendor/backend/driver/image/device mapping; retain C2/C8/C13/C15 and host-backed state; obtain exact host grants |
| Separate GPU for training sbx | Keep dedicated sbx execution using a genuinely unused supported NVIDIA card | Confirm hardware availability, exact sbx/guest-kernel/driver bundle and controlled VFIO setup under fresh grants; never rebind the in-use card |
| Keep GPU gate blocked | Keep the current execution design without unsafe detachment or CPU fallback | Continue source/metadata work; readiness remains false until a safe GPU target or execution amendment is supplied |

## Required GPU evidence

1. Independently select the real GPU identity, vendor/backend, driver and complete supported runtime/library closure.
2. Expose the selected GPU inside the actual admitted learning job, not just on the host or in an unrelated probe container.
3. Prove real F64 allocation/forward/scoring/backward/SGD, declared numerical checks, record reload and C12 redundant learner agreement with bounded synthetic fixtures.
4. Preserve the model, objective, initialization/master seeds, baselines, sampling, tolerances and checkpoint semantics.
5. Measure/enforce the selected supported VRAM/memory policy and coexistence with host use; do not treat a sampled free-VRAM reading as a planning limit or guaranteed reservation.
6. Preserve the 24,000,000,000-byte host RAM ceiling, 12-thread ceiling, C2 job envelope, original clocks, fixed permits and final three-second cleanup.
7. Qualify owned process/device-context cleanup and retained failure evidence without GPU resets or operational retry.

Do not silently use F32/TF32, CPU training, a remote GPU service, privileged host execution or a different model to close the gate.
If strict F64 or another retained obligation cannot be met on the selected supported GPU path, keep readiness false and present the actual decision boundary.
Actual game-data collection and training remain unauthorized.

## Received admission metadata and next source slice

`host:admission-facts` records the selected Docker client version, Linux self CPU/RAM/kernel/membership metadata, an existing private-state parent filesystem and read-only GPU identity metadata.
The optional NVIDIA query selects only index, UUID, name, total memory, driver version and PCI bus ID.
It never uses the unqualified `nvidia-smi` summary, compute-process/accounting queries, resets, setters, clock controls, GPU kernels or model work.
Tool absence is not proof of absent hardware.
The packet explicitly reports GPU learning required, GPU qualification absent and `trainingReady:false`.
The operator report has arrived; actual backend/runtime selection and GPU qualification remain open under later separate grants.
Executor selected `Commit + push (Recommended)` for the 19-file admission/GPU source/spec/test phase and the exact one-shot operator-run metadata command in [host-entrypoint.md](host-entrypoint.md).
Its retained provenance leaves the executed source commit, exact invocation and execution timestamp unknown; see [verification.md](verification.md#operator-reported-admission-evidence).
This approval grants no host execution to the coding agent and no installation, daemon query, container, storage creation, GPU change, qualification or training.
The Python CLI proposal failed review and was removed; the [Rust fixed Unix HTTP API v2 collector](host-runtime-inventory-request.md) has accepted Rust/handoff-source reviews, a verified local static asset and passing musl/task/configuration tests, while actual-host staging/execution approvals remain pending.
The metadata-helper musl/LLVM tooling change selects no CUDA/model dependency or feature and supplies no GPU build, host execution or F64 qualification.
No registered operator packet or host/publication grant follows, and the old Python fixture counts prove no Rust or GPU readiness.
