# [Unverified] ML runtime redesign — selected goals, unproved implementation

**Entire document: [Unverified] local architecture, qualification and performance remain unproved.**
This is the canonical current design continuation, not an approved source plan or execution grant.
User steering selects #1: a NEW per-object ordinary software-input staging profile, not Native guard relaxation.
Training has not happened; no learned checkpoint requires migration, but existing consumers, data and labels remain protected.
Older failed-attempt packets remain literal historical evidence, not the current selected design or reusable permission.
Navigation: [ownership §33](native-ingress-ownership.md#33-per-object-input-profile-selected--redesign-before-learning), [implementation §32](native-ingress-implementation.md#32-burn-runtime-redesign--validate-before-cleanup), [main plan](PLAN-ml-adjutant.md).

## 1. Evidence and permission boundary

Local source observations below come from repository reads; research facts come from the parent's completed public-source review.
Parent supplied Architect ses_e98c0b322ffeYO1iV7x6ktFiVn, Backend ses_e98c0b2d0ffehvJr0oKKhnOH10 and DevOps ses_e98c0b26dffeBOy2czP1Vj9nPz advice.
Upstream statements describe published implementations; they do not establish local execution, filesystem behavior or performance.
Proposed architecture and acceptance criteria are design inferences, not shipped behavior or new test results.
This pass permits four planning-document edits through repository reads/patches only.
Fresh filesystem, artifact GET, installation, build, test, training, retained-root access, repair and cleanup permissions are NONE.
All previous operational grants are consumed; public online research authorization does not renew them.
No actual stage02 code, installer, new program, control, diagram, index entry or source assignment is introduced here.

## 2. Current facts, not a historical diagnosis

Supplied current metadata reports root dev28 and file dev29; named/opened-before/opened-after agree per object on seven selected fields.
Only the current parent/file device comparison is false; the other nine comparisons are true, including observed file size0.
`historicalFailureIdentified:false` remains unchanged because the original failed predicate and original UID were not captured.
Do not diagnose a provider, mount, proxy, corruption, race or Burn defect from that current observation.
The frozen acquisition stopped before any archive GET, file-data write or readback; descriptors contain URL/SHA/HEAD-length metadata only.
Root01 and its cargo pathname remain retained, with supplied current modes0700/0600 and file size0, not newly accessed evidence.
No read/stat/hash/delete/reuse/repair/retry/resume of either retained object follows from this design selection.
XZ-only remains selected for opaque content acquisition; an archive does not itself qualify an installed executable or confer Native authority.
Content custody, installed-binary qualification and Native authority remain separate proof obligations.
A string record, artifact hash, checkpoint or successful JSON result cannot mint clocks, counters, custody or admission authority.

## 3. Selected ordinary-input profile — replace an assumption, retain identity

Only a NEW VERSION may replace `file.dev == parent.dev` in ordinary software-input staging.
Each file retains its independent DEV+INO identity; device checks are replaced with per-object binding, not removed.
Bind named lstat/path identity to the owned FD before and after relevant phases, retaining root named/FD/security coupling.
Keep root directory ownership/0700 and file regular-type/current-owner/0600/nlink1/size0 birth predicates.
Retain full phase-appropriate metadata snapshots, security checks, write cursor, exact length, incoming hash and independent readback/EOF/hash.
Require successful close handling and final root checks before any overall success claim; close uncertainty blocks success and new opens.
Both same-device and different-device parent/file pairs can be valid under this profile; neither geometry is required universally.
Trust remains ordinary stable host paths/user assumptions, without an openat, alias-exclusion, OS-barrier or immutable-backing claim.
This profile does not change protected Native names, actual source identity, read-only loading, process/channels or positive Native controls.
It grants no physical-software classification, F9 public-work waiver, installer qualification or acquisition fallback.
Never modify or rerun01; any future stage02 needs fresh concrete source, proposed paths, I/O bounds, registration and review.
Exact filesystem/GET approvals remain separate later gates, with the new proposal's explicit residual acceptance.

## 4. Prove the small custody boundary before another archive program

The first proposed implementation unit is a bounded offline custody fixture, not another large acquisition packet.
Specify the fixture's source identity, exact writable paths, byte/operation/time bounds and cleanup behavior before requesting its scope.
Use positive cases for valid same-device objects and the observed device-diverse geometry where an approved integration environment permits it.
Pure negative cases must reject wrong named-to-FD binding, owner, mode, link count, nonzero birth size, truncation and hash mismatch.
Include incomplete writes/readback, close failure and root-binding changes; prove no positive publication follows uncertainty.
Integration must test actual approved filesystem behavior; synthetic metadata alone cannot qualify the current host.
Do not probe retained01, fabricate cross-device support or require every filesystem to produce differing devices.
Only after the small proof works should a separately approved unit validate acquisition descriptors and propose bounded opaque XZ acquisition.
Five matching archive hashes would establish only scoped content matching, not the working-runtime condition in §10.

## 5. Six logical responsibilities, not six new crates

| Responsibility | Boundary and goal |
| --- | --- |
| Acquisition/build inputs | Validate separately approved source/artifact descriptors and offline inputs; never acquire inside capture/build/runtime. |
| Runtime initialization/device | Select explicit Flex f64 before tensor creation; isolate device configuration and inference context. |
| Dataset/features | Own one versioned Rust representation/encoder for offline training and arena inference; enforce permitted observations. |
| Offline trainer | Own fitting, seeds, sampler, optimizer, scheduler and checkpoints outside current Native A2/F9. |
| Arena inferencer | Consume validated inference weights and the shared encoder without mutable optimizer/training state. |
| Verification/artifact lifecycle | Own scoped numerical, process, persistence and resource proofs plus separately authorized retention. |

Keep shared ML/model/feature logic in Rust; the thin Node bridge executes the unchanged TypeScript engine, not scoring or training.
Separate offline fit/cache/seeds/config from Native admission and engine state; current F9 always prohibits model/training work.
History must remain within authorized observations; host-private truth and evaluation-only labels must not leak into policy features.
Preserve raw-terminal D+B matching and closeout gas0 independently of model/data pipelines and all other frozen contracts.
Keep the accepted belief gate: 24000 ancestry groups split14400/4800/4800 before policy training.
Feature width418 and padding alone do not prove the full accepted encoder or training/serving parity.

## 6. Burn 0.22 runtime and numerical baseline

Local `packages/training/Cargo.toml` pins Burn=0.22.0, Rust1.95 and features std/flex/optim/store with defaults disabled.
Do not enable the train/dataset features, change dependencies, Node engine/lock identity or select another backend implicitly.
Local `packages/training/src/model.rs:42-53` initializes `Device::flex()` and configures FloatDType::F64 through OnceLock before tensors.
Its synthetic scorer uses fixed coefficients, 418 input columns and f64/shape/finite checks; it is not a learned policy.
Existing model tests exercise bounded autodiff/SGD/Burnpack behavior; historical PASS reports are not new runs or completed real training.
Published 0.22 uses runtime `Device` and `Tensor<D>`, not older backend-generic `Tensor<B,D>` examples [R1].
Configure defaults before first tensor creation; explicit constructors avoid accidental default-backend feature unification [R1].
Flex is a pure-Rust eager CPU backend with f64 support, distinct from CubeCL CPU/LLVM JIT [R2].
No native tensor-library dependency does not prove absence of PT_INTERP/DT_NEEDED or closure of the installed Native graph.
Keep the CPU/f64 baseline first; no automatic GPU, f32, fusion, quantization, SIMD/Rayon or performance guarantee follows.
Use `model.valid()` for inference snapshots while retaining the training model; `to_device` preserves autodiff links, while `fork` creates new trainable leaves [R1].
Device equality ignores autodiff context, so equality alone cannot establish safe inference/training separation [R1].
An explicit custom loop can use backward → GradientsParams → optimizer.step without Learner [R4].
Gradients are consumed; do not copy a Python zero_grad convention or assume accumulated sums are means [R4].
Define partial accumulation windows and scheduler update units before implementation; this document selects no model or hyperparameters.
Flex seed state is a global mutex-protected optional RNG, not a proved independent RNG stream per device [R3].
Seed before model/data randomness; isolate experiments/inference and specify application RNG, sampler progress and controlled scheduling.
Seeding alone proves neither exact resume nor platform determinism; do not claim a public serializer for private backend RNG state.

## 7. Persistence: inference weights are not complete training resume

Published ModuleRecord stores model weights; OptimizerRecord and LrSchedulerRecord carry distinct state [R5].
Learner's checkpoint support is background information, not permission to enable this project's absent train feature.
Design a versioned bundle manifest binding exact module/parameter IDs, optimizer/scheduler states and the committed update.
Bind encoder/schema, data/splits, configuration, build identity and the claimed RNG/sampler/cursor scope into that same bundle.
Never serialize or restore live permits, Native controls, meters or deadlines as training state.
Load into an isolated candidate and reject missing/extra keys, shape/name/ID/version/dtype/finite inconsistencies before promotion.
Default ModuleRecord loading adopts stored dtype; an f32 store may change an f64 model, so test stored and loaded f64 explicitly [R1].
A subsequent cast is not proof that the original artifact retained f64 precision.
Require application completeness tests for optimizer/scheduler restoration; serialization success alone does not prove complete state or exact resume.
Keep inference-only weight loading separate from full interrupted-versus-uninterrupted training-resume qualification.

## 8. Checkpoint publication: qualify the actual storage behavior

Parent reviewed v0.22.0 atomic/writer source at commit b8d75ad07f426537594a5beb9309d62d916bcf05 [R7,R8].
That upstream identity is not proof of byte-equivalence to any local registry installation.
The writer creates an exclusive scratch sibling, materializes tensor data, syncs the file and publishes; Unix also syncs the parent.
Eight-MiB view windows where backing supports them are not an eight-MiB process RSS bound [R8].
Scratch collision retry is unbounded in the source; never borrow it inside bounded F9 without source-cost/attempt-limit qualification.
Checkpoint work belongs to the offline trainer, outside current F9; do not use in_place for protected checkpoints.
`commit_new` tries a no-replace hard link, but unsupported-link fallback checks absence then renames with a race window [R7].
Do not promise unconditional race-free no-clobber across storage types; qualify single-publisher/unique-version candidates and actual fallback behavior.
A temporary two-link publication phase can be valid; ordinary archive nlink1 birth rules do not automatically apply to checkpoint publishing.
An error after rename/link publication, cleanup or directory sync can mean published-but-unconfirmed, not old-file-untouched.
Distinguish pre-publication failure from publication with unconfirmed durability/cleanup; do not treat every Err as rollback.
Validate/hash/reload the complete candidate bundle and publish its commit pointer last; three record files do not become atomic as a group.
Qualify rename/link/sync against the actual approved filesystem; cross-mount rename can fail [R9].
Do not infer rename support from current DEV metadata or substitute copy/delete as equivalent atomic publication.
Power-loss/durability claims remain platform/filesystem-specific and unproved locally.

## 9. Verification plan — future purposes, not persisted new tests or runs

Existing anchors include `packages/training/src/model.rs`, `packages/training/tests/feature_input.rs`, `packages/training/tests/feature_manifest.rs`, `apps/arena/src/engine_v2.rs` and `apps/arena/tests/smoke.rs`.
These are navigation anchors, not assertions that all future acceptance cases already exist there.
| Future verification | Required evidence before its corresponding claim |
| --- | --- |
| Small custody fixture first | Valid same/diverse-device cases where supported; negative binding/security/length/hash/truncation/close cases from §4. |
| Runtime/numerics | f64 pre-initialization, independent numerical-gradient and actual SGD oracle, finite/shape checks and target-platform repeatability. |
| Strict persistence | Full-precision roundtrip plus wrong shape/key/ID/f32/corrupt/partial-state rejection before candidate activation. |
| Shared features | Identical train/arena encoding and history bounds; host-private-truth and evaluation-label noninterference. |
| Resume scope | Interrupted/uninterrupted optimizer/scheduler/parameter-ID/sampler comparisons with explicit supported RNG and scheduling scope. |
| Save failure | Disk-full/cancel/pre- and post-publication failures, source fallback behavior, no mixed bundle and no false rollback claim. |
| Engine/process boundary | Actual Node EOF and reap, unchanged TS bridge, process/channels, original lifecycle/resource counters and N1–N10 regressions. |
| Resource measurement | Separate compile, cold startup, warm forward, synchronization and serialization/I/O; record RSS/CPU/I/O only after runtime approval. |
| Native qualification | Independently establish complete actual source/name/read-only/loading/custody/clock/dependency closure; content tests cannot substitute. |

Research recommends simple pipelines, independently tested infrastructure and shared feature code to prevent training-serving skew [R6].
Discussion4254 separates compilation and queue/autodiff effects from forward latency; it supplies no local benchmark [R12].
Issue2312's Device.seed guidance is not a determinism proof; issues4792/4347 concern other GPU versions/paths, not demonstrated Flex0.22 defects.
Do not install a GPU workaround or change our backend based on those reports.

## 10. Working condition, then conditional cleanup

“Working” requires one accepted source revision, the small custody proof and affected numerical/persistence/feature-parity/TS-bridge/safety checks.
Include approved cold/warm resource checks and source constraints, with reviewed changes and no unresolved HIGH/BLOCKER findings.
Synthetic fixtures can qualify those scoped architecture properties without real training; learned-policy quality/calibration remains unproved.
Before policy training require affected verification/reviews and the 24000-group gate; collection/fitting/training/activation/deployment approval remains NONE.
Five content hashes, a synthetic SGD step, a source comment or a publication marker alone cannot satisfy this working condition.
The condition is not met by this research/design pass; all five exclusions remain unestablished: full-training closure, genuine Native authority, whole-decision adequacy, calibration and training readiness.
Preserve ONE BOTH-seat1048576, unchanged F1/charged replay, no meter clone/restore/refund, original source clocks, cold10s/lifecycle300s including reserved3s cleanup, and generator2048.
Keep Root B/sole counter, BAF/Core data/N1–N10 and accepted contracts unchanged; full-plan/source/numeric-B/invoice/private-guard gates remain open.
Capture/build/runtime stay offline installed-byte allowlist-only, without acquisition fallback or model work in F9.
After independently verified acceptance, consolidate current documentation instead of retaining failed packets as active navigation forever.
Classify device/backend memory cleanup, filesystem build cache, verified download/source cache, run logs/checkpoints and failed-experiment docs separately.
Define bounded retention by both count and bytes; protect active checkpoints, rollback candidates, pins and active writers.
No learned-weight migration project is needed now; existing legacy consumers/data/labels are not thereby failed garbage.
Prepare minimal summaries, Git reference snapshots and old-to-canonical link mappings before retiring superseded failed documentation.
Enumerate exact obsolete cache/doc paths, exclusions and writer checks in an independently reviewed cleanup manifest.
Then request fresh HITL approval for those exact destructive targets; delete only after approval and recheck links afterward.
No broad recursive wipe or automatic eligibility for Root01/Node01, other M2 roots, evidence, datasets, accepted contracts or legacy-consumer work.
Git history may retain failed-iteration detail after approved obsolete active files are pruned; this is future conditional cleanup, not a present grant.

## 11. Public references — parent/specialist research, not fresh retrieval here

- [R1: Burn0.22 migration](https://raw.githubusercontent.com/tracel-ai/burn/v0.22.0/burn-book/src/migrating-to-0.22.md) — runtime devices, Rust1.95, configuration, autodiff and stored dtype.
- [R2: Flex README](https://raw.githubusercontent.com/tracel-ai/burn/v0.22.0/crates/burn-flex/README.md) — eager pure-Rust CPU/f64 backend and separate optional acceleration.
- [R3: Flex backend](https://raw.githubusercontent.com/tracel-ai/burn/v0.22.0/crates/burn-flex/src/backend.rs) — global seeded RNG implementation.
- [R4: Custom loop](https://raw.githubusercontent.com/tracel-ai/burn/v0.22.0/burn-book/src/custom-training-loop.md) — backward/gradient extraction/optimizer stepping.
- [R5: Records](https://raw.githubusercontent.com/tracel-ai/burn/v0.22.0/burn-book/src/building-blocks/record.md) — distinct module, optimizer and scheduler records.
- [R6: Google Rules of ML](https://developers.google.com/machine-learning/guides/rules-of-ml) — rules4/5/32/37: simple pipelines, infrastructure tests and shared features/skew.
- [R7: Pinned atomic source](https://github.com/tracel-ai/burn/blob/b8d75ad07f426537594a5beb9309d62d916bcf05/crates/burn-pack/src/atomic.rs) — scratch creation, hard-link/fallback publication and failure ordering.
- [R8: Pinned writer source](https://github.com/tracel-ai/burn/blob/b8d75ad07f426537594a5beb9309d62d916bcf05/crates/burn-pack/src/writer.rs) — materialization, streaming and publication entry points.
- [R9: Rust1.95 rename](https://doc.rust-lang.org/1.95.0/std/fs/fn.rename.html) — platform behavior and cross-mount failure.
- [Issue2312](https://github.com/tracel-ai/burn/issues/2312), [issue4792](https://github.com/tracel-ai/burn/issues/4792), [issue4347](https://github.com/tracel-ai/burn/issues/4347) — scoped upstream reports, not local reproduction evidence.
- [R12: Discussion4254](https://github.com/tracel-ai/burn/discussions/4254) — accessible maintainer/author discussion of compilation, queue completion and inference autodiff.

**Next action:** define the bounded offline custody proof and its negative cases before any large Root02 archive attempt; seek only the concrete later permissions it needs, not another vote on already-selected #1.

## 12. Actual `apply` implementation unit — ordinary offline custody only

**[Unverified] Parent-reported execution receipt, not keeper rerun or full architecture acceptance.**
The user's later `apply` authorizes this first actual source-plus-offline-test unit, superseding §§1/4/9 and the preceding next-action line only for this concrete unit.
The earlier planning-only scope remains historical; this does not approve stage02 acquisition, installation, Native execution, training or cleanup of retained objects.
Purpose: connect the selected per-object spec goal to executable source, persisted offline tests and parent-owned static verification before attempting a larger acquisition or ML runtime.

### 12.1 Implemented boundary

Source: `tooling/native-ingress/custody.mjs`; persisted tests: `tooling/native-ingress/custody.test.mjs`.
Current behavior diagram: [`_spec/tooling/native-ingress/custody.puml`](../tooling/native-ingress/custody.puml), covering exactly those two files.
This standalone Node helper is not the F9 private initializer, standard-slot mapping, Root A issuer, counter or original-clock implementation.
`CustodyError`, `MAX_FIXTURE_BYTES=65536`, `assertRoot`, `assertFileBirth`, `assertFilePhase` and `stageFixture(rootPath, {bytes, expectedSha256})` are actual exports, not proposed Rust types or inert Markdown programs.

- Validate normalized absolute non-root paths, nonempty bounded Buffer input and lowercase SHA-256 before mkdir; copy the input and check its incoming hash.
- Create the root exclusively with mode0700 and no collision inspection/repair; bind its named lstat to the owned directory FD and effective UID.
- Create `fixture.bin` with WRONLY/CREAT/EXCL/NOFOLLOW/NONBLOCK and mode0600; require a regular file, effective UID, nlink1 and size0 at birth.
- Require BigInt `dev`, `ino`, `mode`, `uid`, `gid`, `nlink`, `size`, `mtimeNs` and `ctimeNs`; root binding compares the six security fields only, excluding size/timestamps.
- Bind named and opened file snapshots on all nine content fields within each phase; compare birth-to-written security fields and written-to-readback full snapshots.
- Retain independent per-object DEV+INO identities without requiring file.dev == root.dev; either same-device or diverse-device geometry may qualify.
- Make one positional write at offset0; a short write stops without retry or readback. Close the writer before opening the read-only descriptor for the same checked object.
- Read exact positional chunks of at most4096 bytes, probe EOF, verify an independent SHA-256, recheck the full file snapshot and final root binding, and require successful closes.
- Normalize other filesystem failures to `E_FS`; prioritize `E_CLOSE` on close uncertainty. Clear each holder before its single close attempt; do not reopen or retry after uncertain writer closure.
- Keep descriptor acquisition inside the active outer try and assign holders inside the guarded open action, so a post-open clock failure still reaches finalization.
- Use a cooperative3.5s deadline and96 ordinary-operation cap, with at most two managed FDs. Close attempts bypass guards and the operation cap; at most three are needed, without a hard OS blocking-I/O or termination guarantee.
- Return only a frozen `profile:'ordinary-per-object-v1'`, `state:'DATA_ONLY'` record with observed paths/length/hash/device strings and `nativeAuthority:false`, `installed:false`.

### 12.2 Persisted verification and parent-supplied evidence

| File / command | Actual scope and evidence boundary |
| --- | --- |
| `tooling/native-ingress/custody.test.mjs` | Node built-in suite: parent reports41 PASS,0 fail,0 skip. Pure BigInt metadata cases cover independent same/diverse-device binding, security/phase predicates, invalid metadata ranges and invalid input; real fresh fixtures cover staging/readback, bounded I/O, replacement/symlink/truncation/hash/EOF/short-I/O failures, collisions, input-field snapshotting, shadowed Buffer length, open/write failures, close uncertainty and post-acquisition deadline cleanup. |
| `node --test tooling/native-ingress/custody.test.mjs` | Parent reports a real current fixture with rootDevice28/fileDevice29 and passing named/FD identity/content checks. This proves this ordinary per-object fixture only, not every filesystem or historical failure cause. |
| Maximum64KiB fixture case | Persisted assertions require one write,17 reads including EOF, three opens/three closes and peak two managed FDs; parent reports this suite passed. These are source-level calls, not kernel syscall counts. |
| `node --test --experimental-test-coverage tooling/native-ingress/custody.test.mjs` | Parent reports all41 tests passed; custody module line/function coverage100%, branch coverage98.57%. Coverage is a test-scope measure, not Native or whole-runtime assurance. |
| `node --check tooling/native-ingress/custody.mjs` and `node --check tooling/native-ingress/custody.test.mjs` | Parent syntax checks passed; the source keeper did not independently rerun them. |
| PlantUML `-checkonly` and `-tsvg` for the linked diagram | Parent validation and SVG rendering passed using the installed renderer and remote identity theme. |
| Oxlint | Skipped: neither the repository binary nor a PATH binary is available. No installation or substitute lint PASS is claimed. |

Filesystem I/O and clock mocks stay inside Node test scopes; the public helper exposes no injected-filesystem interface.
Adversarial review identified an own-property Buffer length bypass. The implementation now measures native typed-array length and copies into an independently bounded Buffer; a persisted changing/throwing-length regression passes. Closing adversarial/security reviews accepted the repaired ordinary offline unit; neither accepted broader Native/runtime qualification.
The diagram follows the house remote-theme convention. Its mutable upstream theme remains a non-hermetic rendering dependency, not a runtime dependency or unchanged-render guarantee.
Tests create fresh private `/tmp/opencode/f9-custody-test-<nonce>` parents and tear down only their fixed owned paths with unlink/rmdir.
The library preserves partial roots; test-owned fixture teardown is not authority to delete retained Root01/Node01 or other existing objects.
The parent reports no downloads, training, retained-root access or retained-artifact cleanup, and no changes to existing Rust/engine source, NamedDataset or legacy behavior.
The existing training verifier includes `_spec/.spec-index.json` in its identity. Its new coverage entry changes that identity; previous native-suite receipts remain historical and are not reissued by this Node-only proof.
The keeper performed repository reads/patches only; no commands, hashes, renderer, network, installation, probes or retained-root access occurred in this spec pass.

### 12.3 Remaining gates — route before training

The content hash/readback establishes bytes at the checked phase, not future immutability, race-free ancestor resolution, openat-relative binding, alias exclusion or an OS barrier.
Ordinary stable-host-path/user assumptions remain explicit; this result grants no protected-name/loading/custody/source-clock or Native authority.
Stage02 large acquisition and installer qualification remain unimplemented; Burn runtime redesign, shared feature parity, numerical/persistence/resume checks and the full §10 working condition remain unproved.
This receipt supplies no current full rebuild/Burn test run, new quality checkpoint,24k-group collection result, policy training, calibration or readiness claim; closing reviews apply only to this custody unit and `trainingReady:false` remains unchanged.
Preserve all prior Native/retention/authority bindings, Root B/sole counter, unchanged F1/charged replay, BOTH-seat1048576, original clocks/budgets, N1–N10 and offline allowlist-only capture/build/runtime.
The parent completed this unit's syntax, diagram, Node-suite and closing source-review gates; Oxlint remains explicitly skipped because it is unavailable. The repaired MEDIUM is closed; the remote rendering-theme LOW remains documented and nonblocking.
Then route the next separately scoped input-descriptor/acquisition or runtime design unit through the existing approval gates before training; do not repeat the selected #1 policy vote or treat this receipt as a larger operation grant.

## 13. Actual `Pull with cleanup` unit — bounded offline streaming

**[Unverified] Parent-reported current Node receipt; keeper read source/tests but ran nothing.**
The user's subsequent Proceed and explicit TUI **`Pull with cleanup`** select this next small offline unit, not a large/five-archive catalog or an acquisition program.
§12 remains the historical first41-test acceptance, including its then-current two-file diagram coverage, coverage percentages, syntax/rendering receipts and closing reviews; those gates do not certify this changed unit.
Current behavior: [`custody.puml`](../tooling/native-ingress/custody.puml) covers both production modules and all three Node test files.

**Design and contract.** `input-descriptor.mjs` owns `CustodyError`, `MAX_FIXTURE_BYTES=65536` and pure `validateFixtureDescriptor`; custody re-exports them unchanged, preserving constructor identity/`instanceof`.
The validator freezes an independent exact ordinary/null-prototype record: `name:'fixture.bin'`, safe-integer `byteLength:1..65536`,64 lowercase hexadecimal `sha256` characters; proxies fail before traps, and accessors/symbols/extra keys including URLs/destinations/authority fail.
There are no dynamic destinations or archive pins.
`stageFixtureChunks(rootPath, descriptor, chunks)` shares the private filesystem engine with legacy `stageFixture`, preventing divergent security policies while preserving legacy prehash-before-mkdir/single-write behavior.

- Validate before producer access; acquire/store the iterator inside the guarded action before mkdir/post-deadline checks; capture callable optional `return` before callable `next`, once each. One acquisition plus <=17 pulls share96 operations; malformed producers/results yield `E_SOURCE`.
- Accept <=16 Buffer chunks of1..4096 bytes, <=65536 total, with intrinsic lengths/ordinary ArrayBuffer backing, not SharedArrayBuffer. Copy/hash/write each snapshot at its exact offset before another pull; no arrays/concat/replay/retry. Require own-data boolean terminal completion, exact length and incoming hash before independent readback; mark completion inside the producer action before its post-deadline guard.
- Finally clear/close file/root holders once before one captured `return` with iterator receiver; clear its holder first, bypass guards even after `E_CLOSE`, and require non-proxy own-data `done:true`, ignoring value. Missing return supplies no producer-resource proof; valid completion suppresses cleanup even after length/hash/deadline failure. Priority: `E_CLOSE > E_SOURCE_CLEANUP > original`, preserving causes.

**Evidence — parent receipt, not keeper execution.** `node --test --experimental-test-coverage tooling/native-ingress/custody.test.mjs tooling/native-ingress/input-descriptor.test.mjs tooling/native-ingress/custody-chunks.test.mjs` reports **85 PASS =41 unchanged legacy +38 stream +6 descriptor,0 fail/skip**, both production modules **100% line/branch/function coverage**.
Real streamed rootDevice28/fileDevice29 integration passes; maximum64KiB uses16 writes,17 next calls,17 reads including EOF, three opens/closes and peak two managed FDs; legacy41 preserve one-write assertions.
Tests persist descriptor, malformed-producer/result, backing/length/hash, binding, short-write, receiver/capture, cleanup-priority and deadline-finalization regressions; counts describe source calls, not syscalls.

**Residuals and remaining.** Trusted producers run arbitrary unsandboxed work; cleanup can block forever beyond cooperative3.5s, so call bounds prove no physical-time/runtime-resource/lifecycle bound, hard OS barrier, full Native authority or new game allowance.
The library retains partial paths; stream teardown targets only exact owned new `/tmp/opencode/f9-chunks-test-*` parents/children, not retained objects.
All five Node syntax checks, spec-index/SPEC-pointer checks and `git diff --check` passed. Oxlint remains unavailable in the repository and on PATH; lint is explicitly skipped without installation.
The user separately approved rendering with the existing remote house theme; PlantUML checkonly and SVG rendering passed. This documentation fetch grants no archive-acquisition permission; the mutable theme remains a non-hermetic, nonblocking rendering dependency.
Adversarial and security reviewers reported no new findings and `READY TO MERGE: yes` for this bounded offline unit only. Final spec consistency review reported no findings and `SPEC STATUS: in-sync`.
Full existing suites/Native checks were **not rerun**; prior receipts stay historical.
The spec-index edit changes the old470-input verifier identity from `55d51fec3832e1ec5597d9a359980dbd0afc00374427e674a1cfe5e2aa171ea6` to `204e47320db30a1450a9e02e0d4e056e9dec3725d45a57d232e0c278447d56b1`; all other469 inputs remain unchanged.
The five custody/descriptor source/test files covered by this diagram have separate SHA-256 identity `e1affcf35910d8d65f4c790f9230774b399b6c7016449b48b2e5fd7397e652c4`, using sorted UTF-8 paths followed by bytes, each field prefixed with its unsigned64 big-endian byte length. This is an ordinary-unit identity, not a Native invoice or test receipt for the old verifier.
No retained/installed-root access, archive acquisition, installation, training, publishing, broader cleanup, dependency/Rust/TypeScript changes or further operational grant follows; the only network permission used was the separately approved diagram-theme rendering. §10 and larger runtime/Native/training gates remain open.

## 14. Selected synthetic runtime boundary — source prepared, compilation blocked

**[Unverified] Source inspected; execution, publication and discovery details below are parent-reported, not keeper reruns.**
The user requested custody commit/push followed by step2 Rust ML runtime work, then selected the NEW TUI **`Synthetic boundary (Recommended)`**, not a full learned runtime or production trainer.
The parent reports custody commit `3efdcc93d978268fcb9619012b189406df4000b6` was pushed with PR50 OPEN against `feat-ml-adjuntant` and a clean worktree at publication.
§13 remains the published custody85-test receipt; its syntax, coverage, diagram and closing-review results do not certify this later Rust delta.
The parent consulted Architect `ses_e96c23f05ffezGIWfv7JIp4rzJ` and Backend `ses_e96c23ec2ffe87TlWq58681YYi` before preparing the source.
Those consultations are not closing reviews or compilation evidence.

### 14.1 Selected scope and source contracts

This unit separates the existing fixed synthetic scorer into runtime initialization, borrowed input validation, infer-only context and test-only numerical fixtures within the existing crate.
It supersedes §6's old `model.rs:42-53` initialization location for this source delta only; prior design and evidence retain their historical scope.

| Source | Prepared contract; not an executed result |
| --- | --- |
| `packages/training/src/runtime.rs` | Public `F64Runtime::initialize() -> Result<Self, ScoreError>` owns an opaque private `Device`; crate-private access only. A cached `OnceLock<Result<Device, ScoreError>>` configures `Device::flex()` with `FloatDType::F64` before tensor creation. The shared backend wrapper catches unwind panics as `BackendFailure`, without backend/precision fallback. |
| `packages/training/src/synthetic_batch.rs` | Crate-private `SyntheticBatch<'a>` borrows the caller's slice. Validate checked shape `1..512 x 418` first, then finite values, then `abs(value)<=1e6`, retaining error messages and precedence. Tensor materialization copies values and normalizes only signed zero; this is a synthetic boundary, not the accepted encoder or a new learner-math bound. |
| `packages/training/src/inference.rs` | Public `SyntheticInferenceContext::new()` initializes runtime before its private fixed model; `score(&self, values, rows)` validates through the same batch guard. There is no optimizer, artifact path or mutable training API. Check input/parameter/output f64, output shape/count and finite ordered scores; normalize zero outputs. The unchanged public `score_synthetic_f64(values: &[f64], rows: usize) -> Result<Vec<f64>, ScoreError>` adapter validates BEFORE creating its context/backend. |
| `packages/training/src/model.rs` | `SyntheticLinear`, parameters and callable model methods remain at most `pub(crate)`, never public weight admission. Retain `w=[0.5,-0.25,0,...]`, `b=0.125`, ParamIds1/2, tensor shapes and the same matmul-then-bias arithmetic. Existing Burnpack memory/file/corruption tests remain here, delegating their relocated `updated_model` fixture. Store/load semantics are not redesigned. |
| `packages/training/src/offline_trainer.rs` | The entire module is included ONLY under `lib.rs` `#[cfg(test)]`. It contains the original two-row analytic MSE fixture and actual Burn autodiff/SGD(.125) test code, not a callable production trainer. Its snapshot-isolation test retains the SAME explicit autodiff `Device` for the later update and uses `model.valid()` for inference snapshots; device equality supplies no isolation proof. |
| `packages/training/src/lib.rs` | Re-export `F64Runtime`, `SyntheticInferenceContext` and the existing scorer. Keep runtime/inference/batch/model modules private and offline trainer test-only. |
| `apps/arena/src/lib.rs` | Smoke constructs one explicit inference context then scores its existing synthetic features. Its report, bridge, tiny fixture and selection remain scoped to compatibility; `run` baseline selectors are not replaced with learned scoring. |

The biased fixture is NOT the accepted policy: zero418 initialization, no bias, REINFORCE/scalar learner contracts and table/belief contracts remain unchanged.
No Cargo manifest, lockfile, dependency, feature flag or TypeScript change belongs to this unit.
No actual training, learned checkpoint, production fitter, artifact admission/loading, resume bundle, training CLI, complete feature encoder/parity or F9 counter/model permit is introduced.
No archive/network operation, installation, retained-object access or cleanup follows from selecting this boundary.

### 14.2 Persisted tests — all uncompiled and unrun

The four new files contain eight new `#[test]` declarations; declaration counts are not test execution counts.

| Test location | Prepared checks; required future execution |
| --- | --- |
| `runtime.rs` (2 new tests) | Repeat initialization before tensors, non-autodiff inference settings, f64 dtype/sub-f32 precision and caught-panic `BackendFailure`. |
| `synthetic_batch.rs` (2 new tests) | Shape/overflow and error precedence; maximum bounded borrowed input, unchanged source bits and signed-zero-only copying. |
| `inference.rs` (2 new tests) | Context/wrapper/repeated-score bit agreement, sub-f32 difference, parameter shapes/non-autodiff runtime, disabled parameter gradients, input errors and positive-zero output. |
| `offline_trainer.rs` (2 new tests) | Independent scalar central differences for two active weights and bias; fixed-update `model.valid()` snapshot isolation from a later update and the public baseline scorer. The test-only snapshot constructor asserts disabled weight/bias gradients. |
| `offline_trainer.rs` helper via retained `model.rs` test | Original full-vector oracle: predictions `[.125,.625]`, loss `.8515625`, weight gradients `[2,2.375,0,...]`, bias gradient `.375`; SGD(.125) yields weights `[.25,-.546875,0,...]` and bias `.078125`. These are expected assertions, not observed current outputs. |
| Retained `model.rs`, protocol and arena tests | Rerun current affected scoring, f64, Burnpack and smoke/regression tests after compilation is available; historical passing receipts cannot certify relocation or the new context call. |

No new Rust test has compiled or run.
No current synthetic SGD step, snapshot isolation, numerical-gradient, persistence or arena-runtime acceptance result is established.
The parent reports only `git diff --check` PASS for the prepared source; whitespace checking is not Rust compilation, formatting, static analysis or runtime proof.
The custody85-test rerun passed before its commit, not against this Rust runtime contract.

### 14.3 Approved offline host check — discovery STOP, no fallback

The user separately selected **`Offline host check (Recommended)`** for PATH-only discovery, excluding retained F9/M2/M3 roots and stopping at shims rather than executing them.
Frozen offline verification with a fresh build target was conditional on existing direct executable tools AND required local inputs being available.
The parent reports **ZERO candidates** for `cargo`, `rustc`, `rustfmt`, `cargo-clippy`, `cc`, `clang` and `ld` in that approved discovery scope.
This is a scoped discovery result, not proof of host-global absence or permission to search other roots.
No version command, Cargo command, formatter, Clippy, compiler, linker or Rust test ran.
No target directory was created, cache accessed, download/install attempted or fallback used.
No retained-root, `/proc` or daemon access occurred; consumed earlier permissions remain consumed.
Compilation and Rust runtime acceptance are therefore **BLOCKED**.
Any next execution needs approved exact direct toolchain paths, required cache/input paths and a fresh build-target path; this paragraph grants no new probe, path access, installation or execution.

### 14.4 Diagram ownership and remaining acceptance gates

[`training/burn-compat.puml`](../packages/training/burn-compat.puml) owns runtime/device, shared batch, infer-only context, fixed model and cfg(test) trainer structure.
Its coverage gains exactly the four new Rust files, reaching54 explicit paths; existing coverage and the matching index entry are retained with `fingerprint:null`.
[`arena/burn-compat.puml`](../apps/arena/burn-compat.puml) updates only the smoke scorer component label plus status/navigation headers; its59 existing coverage paths and `fingerprint:null` remain unchanged.
Both existing sibling `burn-compat.svg` files remain unchanged and **historical / NOT CURRENT** for these edits.
No current PlantUML validation or rendering PASS is claimed.
Existing remote house-theme includes are retained, not fetched; §13's theme-access grant does not silently authorize rendering this unit.
The mutable remote theme remains the documented non-hermetic LOW dependency, not an installation requirement.

Required gates remain current Rust compilation/format/static checks, affected persisted tests and regressions, separately qualified diagram validation/rendering, and closing adversarial/security/spec reviews on the accepted complete delta.
Adversarial first-pass review found no concrete source defect, but records a BLOCKER for missing current Rust compilation/tests and MEDIUM for current diagram validation/rendering; `READY TO MERGE: no` remains binding.
Security first-pass review found no concrete security issue, but also reports `READY TO MERGE: no` because current-source verification remains blocked. Backend static review found no likely compile error and requested explicit disabled-gradient assertions, now persisted but unrun. These reviews do not waive execution gates.
The changed spec index also invalidates reuse of old verifier identities; this pass computes no fingerprint, source hash or new invoice.
§10's working condition and larger runtime/Native/training gates remain open, with `trainingReady:false`.
Report **SOURCE PREPARED / COMPILATION BLOCKED**, not `Upgrade Complete`, step2 done or an unqualified complete ML runtime.

## 15. Fresh setup proposal and offline theme — selected, no execution grant

**[Unverified] User selections and adviser/review receipts are parent-reported; this section proposes no executed setup or qualified host.**
The user selected NEW TUI **`Plan fresh setup (Recommended)`** for a proposal ONLY and **`Provide offline theme`** for the two runtime diagrams.
Neither choice authorizes preflight, acquisition, extraction, installation, setup execution, retained-root access or remote-theme fetching.
No exact offline-theme path has been supplied; theme closure and current diagram validation/rendering therefore remain pending.
The parent consulted Architect `ses_e96c23f05ffezGIWfv7JIp4rzJ` and DevOps `ses_e96a85611ffeK8GfP8rmtoXWE4` read-only for this infrastructure proposal.
Keep the selected synthetic boundary and per-object custody profile; do not repeat XZ/profile votes or relax Native policy.

### 15.1 Proposed locations and candidate inputs — not observed or reserved

All four paths below are **UNOBSERVED / NOT RESERVED / NOT CREATED**; naming them grants no access:
- `/tmp/opencode/f9-rust-runtime-inputs-01`
- `/tmp/opencode/f9-rust-runtime-toolchain-01`
- `/tmp/opencode/f9-rust-runtime-build-01`
- `/tmp/opencode/f9-rust-runtime-tmp-01`

Any future approved exclusive creation encountering EEXIST must STOP without probing/inspecting, reuse, repair, deletion or a new suffix.
Preserve partial objects on failure; this proposal grants no automatic cleanup, rollback or resume.
Candidate inputs are the five Rust1.95.0 `x86_64-unknown-linux-gnu` XZ archives whose exact URLs/SHA-256 expectations remain solely in [historical acquisition §2](native-ingress-host-preparation-m3-xz-acquisition.md#2-independent-frozen-expectations--advertised-is-not-actual).
Their expected compressed lengths are10984780,80351960,29573972,2164880,4697128 bytes, totaling127772720; these are descriptors, not verified payloads, current-host target proof or full graph closure.
Do not execute the historical acquisition body or inherit its old guards/bounds/grants; all original packets, retained objects and consumed grants remain untouched.

### 15.2 Unknown closure and bounds — STOP before operations

Current host architecture/ABI/libc, loader, linker/compiler, sysroot, startup objects, standard/native libraries and build-script tool inputs remain UNKNOWN.
Rust archives alone do not establish linking capability; invent no GCC/sysroot pins, and do not treat Cargo.lock as cached dependency bytes or Flex's pure-Rust description as full Native graph proof.
Freeze exact direct Cargo/rustc/rustfmt/cargo-clippy/clippy-driver and linker/compiler executables, every required loader/library/startup object and extraction/setup interpreter/tool/source dependency before their use; no rustup/mise shim, automatic setup or implicit downloader is allowed.
Enumerate all startup, temp, Cargo-home, target, environment/configuration, dependency checksum/license and preseeded-cache inputs, plus every test write and output path.
Include direct Node/tsx and their closure only if arena smoke is explicitly in the approved scope; package names/argv are not frozen here.
Expanded bytes, archive entry counts, peak disk/RSS, CPU/wall-time and source/memory bounds remain UNKNOWN; define and review them before operations rather than inferring safety from compressed length.
Network acquisition must stay outside capture/build/runtime; builds and build scripts must stay offline with no acquisition fallback.
Require an approved exact local theme path plus complete include/dependency and renderer closure; no remote include fetch or silently substituted theme may count as offline verification of the two diagrams.

### 15.3 Ordered proposal gates — no phase currently authorizes an operation

| Phase | Required scope and STOP |
| --- | --- |
| 1 · Input evidence | Accept a human-supplied complete host audit with exact direct-binary/dependency/theme descriptors, OR prepare a separately approved narrow metadata-preflight proposal. Preflight execution approval is NONE. |
| 2 · Freeze source | Freeze input/executable/source closure and the larger acquisition source plan, persisted tests and reviews. The64KiB fixture cannot scale by changing constants; retain selected per-object binding/security/hash/readback guards. |
| 3 · Acquisition gate | Only after bounds/review, request a separate exact filesystem + GET grant for the five literal serial XZ inputs. No redirects, retry, mirror, gzip fallback or current grant. |
| 4 · Setup gate | Separately approve bounded extraction/installation and qualified setup scripts/tools, loader/linker and execution closure. Do not execute an installed binary until that closure is qualified. |
| 5 · Offline verification | Separately approve exact direct executable paths, frozen/offline rustfmt/check/clippy/affected-test invocations, inputs and all test-write scopes; include Node smoke only with explicit complete qualification. |
| 6 · Closing gates | Bind adversarial/security/spec reviews to current source identity; validate/render both diagrams offline only after the supplied theme path and complete rendering closure qualify. |

### 15.4 Current blockers and next input scope

§14's binding adversarial BLOCKER (missing Rust runs), MEDIUM (current diagram rendering) and both reviewers' `READY TO MERGE: no` remain open; static advice and selected setup direction waive nothing.
The LOW disabled-gradient strengthening is persisted in the test-only snapshot constructor and ordinary inference-context test; the eight new tests still have not compiled or run.
Four new Rust source files and the changed index require a new current verifier input count/identity; old receipts are not reissued or made current by this proposal.
At this proposal's preparation checkpoint, the runtime delta was uncommitted/unpublished; the verified custody push was `3efdcc93d978268fcb9619012b189406df4000b6` with PR50 OPEN against `feat-ml-adjuntant`.
The user subsequently requested commit/push of the prepared delta as work in progress. Publication does not waive either review finding, authorize a merge, or establish compilation/runtime acceptance; operational grants remain unchanged.
The85 old Node passes prove neither current Rust compilation nor runtime acceptance; unchanged SVGs remain historical / NOT CURRENT.
Next input-scope decision: supply complete audited inputs/theme, prepare an exact preflight proposal, or hold; none is an execution grant or a repeat of setup/XZ policy selection.
This keeper pass performs repository reads/patches only, with no commands, agents, probes, network or unrelated document edits.
`trainingReady:false`; §10 remains OPEN, step2 remains NOT DONE, and no complete ML runtime/Upgrade Complete claim follows.

## 16. Exact metadata preflight — proposal prepared, execution unapproved

**[Unverified] The user selected `Exact preflight (Recommended)` to prepare this proposal, not run it.**
The preceding runtime WIP was published as `166a0bd922948f08530745ea8aa8cc266dc3649d`; PR50 remains OPEN/unmerged and its Rust-verification BLOCKER and diagram MEDIUM remain binding.
This section uses ordinary host trust for metadata collection, not Native qualification or a renewed prior observation grant.

### 16.1 Exact read scope and exclusions

- Runtime hints: `process.platform`, `process.arch`, `os.endianness()`; these do not establish physical CPU, libc, host ABI or target compatibility.
- One `lstatSync('/tmp/opencode', {bigint:true})`, requiring a named directory rather than a final-component symlink, then one `statfsSync` of that same literal path.
- One `lstatSync` for each of the eight literal candidate paths in the program below. No Cargo/PATH scan, directory enumeration, link resolution, candidate open/content/hash or candidate execution.
- Candidate ENOENT records MISSING; final-component symlinks record UNQUALIFIED_SYMLINK without following them. Continuing the independently fixed list is not link resolution or an executable fallback. Other filesystem errors STOP.
- Named metadata and capacity are point-time, unreserved observations; there is no FD binding, ancestor-race protection, installed-state determination or executable-usability claim.
- No filesystem creation/deletion, retained-root/cache/home/configuration access, `/proc`, daemon, network, subprocess or theme access belongs to the program.

### 16.2 Source bounds and launch binding

| Item | Proposed limit / permission boundary |
| --- | --- |
| Filesystem attempts | <=9 lstat +1 statfs, sequential, zero retries |
| Clock samples | <=32 including START; cooperative3500ms collection deadline |
| Output | One ASCII JSONLF <=8192 bytes, at most one borrowed-FD1 write, checked full count, no retry |
| Filesystem objects / owned FDs | Zero created; zero opened/owned; stdout remains borrowed |
| Error publication | Bounded fixed reason, prefix records allowed only with overall STOP; no stack/raw error/env output |
| Launcher / argv / cwd / environment | UNBOUND: supply an approved exact Node launcher and launch context before requesting execution |

The collection clock starts at the first body statement after imports. Imports, launcher/module startup, inherited hooks, native allocations and tool capture are outside this authored collection bound; no hard blocking-I/O, RSS, CPU, kernel-syscall or physical-time bound follows.
The single diagnostic stdout attempt bypasses the collection guard so a STOP can be reported after expiry. A late/short/failed output leaves exit3 and may leave partial JSON; an isolated METADATA_ONLY line never establishes successful overall delivery.
`countsAtEncoding` snapshots collection clock/filesystem counters before serialization; it excludes the later output-delivery clock sample and is not a final operation invoice.
No exact execution command or execution approval exists while launcher/environment binding remains UNBOUND. Do not discover a launcher through PATH, retained roots or implicit fallback under this proposal; ordinary bootstrap trust must be explicit in a later exact approval.
The offline theme path remains missing; this program does not search for it or authorize remote rendering.

### 16.3 Inert proposed program — never evaluate without fresh approval

<!-- BEGIN RUST RUNTIME METADATA PREFLIGHT V1 -->
```mjs
import fs from 'node:fs';
import os from 'node:os';
const START = process.hrtime.bigint();
const END = START + 3_500_000_000n;
const ROOT = '/tmp/opencode';
const PATHS = [
  '/usr/bin/cc', '/usr/bin/gcc', '/usr/bin/clang', '/usr/bin/ld',
  '/usr/local/bin/cc', '/usr/local/bin/gcc', '/usr/local/bin/clang', '/usr/local/bin/ld',
];
const counts = { clock: 1, lstat: 0, statfs: 0, writes: 0 };
const reasons = new Set(['TIME', 'LIMIT', 'ROOT', 'METADATA', 'FS']);
const report = {
  profile: 'rust-runtime-preflight-metadata-v1', status: 'STOP', reason: 'FS',
  runtimeHints: null, root: null, capacity: null, candidates: [],
  nativeAuthority: false, rustReady: false, trainingReady: false,
};
process.exitCode = 3;
function fail(code) {
  const error = new Error('STOP'); error.code = code; throw error;
}
function guard() {
  if (counts.clock >= 32) fail('LIMIT');
  counts.clock++;
  if (process.hrtime.bigint() >= END) fail('TIME');
}
function io(kind, action) {
  guard();
  if (counts[kind] >= (kind === 'lstat' ? 9 : 1)) fail('LIMIT');
  counts[kind]++;
  let value;
  try { value = action(); }
  catch (error) { guard(); throw error; }
  guard();
  return value;
}
function unsigned(value) {
  if (typeof value !== 'bigint' || value < 0n || value > (1n << 64n) - 1n) fail('METADATA');
  return value.toString();
}
function metadata(stat) {
  const result = {};
  for (const key of ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size']) result[key] = unsigned(stat[key]);
  return result;
}
function token(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_+-]{1,32}$/.test(value)) fail('METADATA');
  return value;
}
try {
  guard();
  report.runtimeHints = { platform: token(process.platform), arch: token(process.arch), endianness: token(os.endianness()) };
  const root = io('lstat', () => fs.lstatSync(ROOT, { bigint: true }));
  report.root = metadata(root);
  if ((root.mode & 0o170000n) !== 0o040000n) fail('ROOT');
  const capacity = io('statfs', () => fs.statfsSync(ROOT, { bigint: true }));
  report.capacity = {};
  for (const key of ['type', 'bsize', 'blocks', 'bavail']) report.capacity[key] = unsigned(capacity[key]);
  for (const name of PATHS) {
    let stat;
    try { stat = io('lstat', () => fs.lstatSync(name, { bigint: true })); }
    catch (error) {
      if (error?.code === 'ENOENT') { report.candidates.push({ path: name, kind: 'MISSING' }); continue; }
      throw error;
    }
    const snapshot = metadata(stat);
    const type = stat.mode & 0o170000n;
    const kind = type === 0o120000n ? 'UNQUALIFIED_SYMLINK'
      : type === 0o100000n ? 'UNQUALIFIED_REGULAR' : 'UNQUALIFIED_OTHER';
    report.candidates.push({ path: name, kind, metadata: snapshot, executeBit: (stat.mode & 0o111n) !== 0n });
  }
  guard();
  report.status = 'METADATA_ONLY'; report.reason = null;
} catch (error) {
  report.reason = reasons.has(error?.code) ? error.code : 'FS';
}
try {
  counts.writes = 1;
  report.countsAtEncoding = { clock: counts.clock, lstat: counts.lstat, statfs: counts.statfs };
  const text = JSON.stringify(report) + '\n';
  if (text.length > 8192 || /[^\x00-\x7f]/.test(text)) throw new Error('OUTPUT');
  const bytes = Buffer.from(text, 'ascii');
  const written = fs.writeSync(1, bytes, 0, bytes.length);
  if (written === bytes.length && report.status === 'METADATA_ONLY') {
    guard();
    process.exitCode = 0;
  }
} catch { process.exitCode = 3; }
```
<!-- END RUST RUNTIME METADATA PREFLIGHT V1 -->

### 16.4 Admission before any future observation

Syntax-only `node --input-type=module --check` with the extracted program on stdin passed; the program was parsed, not evaluated. Static comparison confirmed the eight literal candidate paths. No preflight root/candidate/capacity observation followed.
Proposed program identity:3400 UTF-8 bytes including its final LF, SHA-256 `13bdcdce51718f6c19812fc89ec2b0d5b753c3f27343bf86281f3275294d2113`; this binds only the inert body, not an approved launcher, whole proposal or execution grant.
Adversarial review identified a LOW pre-output clock-counter ambiguity; the record now explicitly snapshots `countsAtEncoding`, excluding the later delivery check. Closing adversarial/security reviews accepted the repaired proposal only with no new findings; both preserve EXECUTION NOT READY and the independent runtime verification gates.
Final spec review reported in-sync. Rust verification and current diagram rendering remain blocked independently.
Freeze this program's bytes, the whole approved proposal, exact launcher/argv/cwd/environment, output/capture disposition and explicit bootstrap residuals before asking for a one-time metadata grant.
Review the literal scope, error/clock/output paths and prohibited-operation absence first. Syntax parsing without evaluation, if performed, proves neither collection behavior nor host observations.
No target/candidate metadata has been observed through this program. Acquisition/setup/build/Native/training permissions and the original shared meter, clocks, fees and resource limits remain unchanged.
Even a successful METADATA_ONLY result leaves linker/ABI usability, complete offline inputs, archive payload verification, installation, Rust tests and diagram rendering unqualified.

### 16.5 Launcher identification and proposed exact launch — no preflight grant

The user separately approved ONE identity-only query through the ordinary harness: `node -e 'process.stdout.write(JSON.stringify({node:process.execPath})+"\n")'`, repository cwd, tool timeout10000ms, inherited PATH/Node startup trusted without a hard startup/capture bound.
That query ran once with reported tool exit0 and stdout `{"node":"/usr/local/bin/node"}`; stderr included the existing experimental EnvHttpProxyAgent warning.
The identity-only grant is consumed. This is a reported launcher path, not named/FD binding, executable-byte verification, toolchain qualification or preflight execution.

The following launch profile is a NEW proposal and supersedes §16.2's UNBOUND fields only as proposed command/context, not as approval:

| Field | Proposed exact binding |
| --- | --- |
| Tool command | `/usr/local/bin/node --input-type=module <<'RUST_RUNTIME_PREFLIGHT_V1'` with §16.3's3400-byte program on stdin, followed by the delimiter line `RUST_RUNTIME_PREFLIGHT_V1`; no second authored program or parent marker |
| cwd | `/tmp/opencode/f9-bootstrap-correspondence` |
| Environment policy | Inherit the ordinary harness environment without enumeration or modification; trust its startup/hooks as an explicit metadata-only bootstrap residual, not a closed source/environment graph |
| Tool timeout | 10000ms; not an OS/process-tree termination or physical-runtime guarantee |
| Output policy | One authored ASCII JSONLF <=8192 bytes; ordinary tool stdout/stderr capture, including startup diagnostics, is not hard-bounded by that authored record cap |
| Retries / grants | Zero retries; preflight execution approval remains NONE |

The interpreter consumes stdin as fixed program source, not caller data. Absolute launch avoids a new PATH search but does not qualify its symlink/ancestor/loader/byte identity; those remain ordinary trusted-bootstrap residuals.
The exact shell command is3496 UTF-8 bytes including its final LF, SHA-256 `80d4662b9d4fd254d6015a2ba69c350a97d7bc4944452518555417705b0b35ea`: the literal heredoc launch line in the table, LF, the complete §16.3 program including its final LF, then `RUST_RUNTIME_PREFLIGHT_V1` and LF. Static registration did not execute that command.
Register the exact resulting shell-command bytes and whole current proposal before asking for one-time execution approval that explicitly accepts these residuals.
No runtime candidate, root or capacity metadata was observed by the identity-only query; the original Rust BLOCKER and diagram MEDIUM remain open.
Closing adversarial/security launch-profile reviews found no new findings and accepted the proposal only; spec review reported in-sync. Whole-proposal registration and fresh execution approval remain required, and neither review grants them.

## 17. Metadata preflight outcome — one grant consumed, toolchain still unqualified

**[Unverified] Harness-supplied execution receipt, not independently authenticated host/Native evidence.**
The user explicitly selected `Approve metadata once`, accepting §16's ordinary bootstrap/startup/capture residuals for ONE execution only.
Immediately before execution, repository-only verification matched whole canonical SHA-256 `86a561928b3608ecbe079f976cd4260f958ad6cfe2f3152d622de905a7b7ae23`, whole §16 SHA-256 `535ebd25a295d84fe0b0bcfd446b0cf9f9419c7606bbf4b50ed12ca4a6853f32`, body `13bdcdce51718f6c19812fc89ec2b0d5b753c3f27343bf86281f3275294d2113` and command `80d4662b9d4fd254d6015a2ba69c350a97d7bc4944452518555417705b0b35ea`.
The registered3496-byte command ran once in `/tmp/opencode/f9-bootstrap-correspondence`, using `/usr/local/bin/node`, inherited harness environment and10000ms tool timeout; the tool returned normally without a timeout/error marker.
Its authored JSONLF was the following single line; stderr contained the existing experimental EnvHttpProxyAgent warning, outside the authored-record bound:

```json
{"profile":"rust-runtime-preflight-metadata-v1","status":"METADATA_ONLY","reason":null,"runtimeHints":{"platform":"linux","arch":"x64","endianness":"LE"},"root":{"dev":"28","ino":"725","mode":"16877","uid":"1000","gid":"1000","nlink":"4","size":"4096"},"capacity":{"type":"2035054128","bsize":"4096","blocks":"5116564","bavail":"4206825"},"candidates":[{"path":"/usr/bin/cc","kind":"MISSING"},{"path":"/usr/bin/gcc","kind":"MISSING"},{"path":"/usr/bin/clang","kind":"MISSING"},{"path":"/usr/bin/ld","kind":"MISSING"},{"path":"/usr/local/bin/cc","kind":"MISSING"},{"path":"/usr/local/bin/gcc","kind":"MISSING"},{"path":"/usr/local/bin/clang","kind":"MISSING"},{"path":"/usr/local/bin/ld","kind":"MISSING"}],"nativeAuthority":false,"rustReady":false,"trainingReady":false,"countsAtEncoding":{"clock":23,"lstat":9,"statfs":1}}
```

Repository-only checks confirmed the approved canonical prefix and complete §16 bytes remain unchanged. The persisted JSONLF copy is824 bytes, SHA-256 `b404af3e5037124563be5a89c7fb4bc02eb51a14419258182dcd2cfceaae4b79`; hashing this copy supplies no independent transport/host authenticity.

### 17.1 What this closes, and what it does not

- Collection completed with METADATA_ONLY, not qualification. The observed counters are nine lstats and one statfs; `clock:23` is the pre-encoding snapshot, not the later final delivery sample or an original Native clock.
- Every one of the eight fixed linker-candidate paths returned MISSING in this collection. This establishes neither host-global absence nor permission to inspect alternate directories or repeat PATH discovery.
- Linux/x64/LE are Node runtime hints only. Current host ABI/libc, loader, GNU target compatibility, compiler/linker usability and dependency/source closure remain unqualified.
- Root and capacity values are named, point-time and unreserved metadata; they do not bind a descriptor, explain historical device divergence, reserve storage or prove sufficient expanded/build capacity.
- Neither this program nor the identity-only query ran Rust, compiled/ran its eight new tests, executed a candidate, acquired/extracted/installed archives, inspected retained roots/caches, created an authored filesystem object, trained a model or fetched/rendered a theme.
- The one-shot metadata permission is CONSUMED. No retry, follow-up probe, alternate path, installation, build or other operation follows automatically; §§16/16.5 remain the immutable revision-scoped approved proposal, not a continuing grant.

### 17.2 Remaining setup decision

The five Rust archive descriptors alone cannot establish a usable GNU linking/sysroot or offline dependency context; existing runtime verification and diagram blockers remain open.
Next select either a complete prepared verification context with audited direct tools/linker/sysroot/dependency inputs, or a separately reviewed expansion of setup planning to close those missing components. Neither route grants acquisition, host access or execution.
The offline theme path remains unsupplied. The published runtime remains unverified WIP `166a0bd922948f08530745ea8aa8cc266dc3649d` on OPEN/unmerged PR50; this outcome does not waive either `READY TO MERGE: no` or change `trainingReady:false`.
Closing adversarial/security reviews accepted this documentation receipt only with no new findings; spec review reported in-sync. These results authorize neither further observation nor runtime merge acceptance.

## 18. Complete setup closure — GNU family selected, operational closure NOT CLOSED

**[Unverified] Parent-supplied official research and repository-only inventory; requirements below are a PLAN, not qualified setup.**
The user selected `Complete setup closure` for RESEARCH + PLAN only, then `GNU bundle (Recommended)` for family planning only.
Architect `ses_e96c23f05ffezGIWfv7JIp4rzJ` and DevOps `ses_e9693b724ffe1scNv9YY7Q7eLq` supplied read-only advice.
This append supersedes §17.2's unselected planning direction only; all preceding bytes, approved proposal/body bindings and receipts remain historical and unchanged.
Runtime WIP `166a0bd922948f08530745ea8aa8cc266dc3649d` remains published on OPEN/unmerged PR50, with source unchanged by this pass.
Rust compilation/tests BLOCKER, diagram-validation/rendering MEDIUM and both `READY TO MERGE: no` decisions remain binding without waiver.
Every original and one-shot metadata grant is consumed; no follow-up host/proc/cache/environment observation, artifact HEAD/GET, installation or execution is authorized.
The parent fetched documentation only, not archive bodies; this keeper performs repository-document reads/patches only, with no network, probes, scripts or new agents.

### 18.1 Selected direction and compatibility requirements

| Item | Selected requirement / limit |
| --- | --- |
| Rust / target | Rust1.95.0; `x86_64-unknown-linux-gnu` remains selected, but local host compatibility is UNKNOWN. |
| ML baseline | Burn=0.22.0; Flex f64; defaults disabled; exactly std/flex/optim/store retained. |
| Native tool direction | Prebuilt GNU compiler DRIVER plus compatible GNU sysroot/runtime; not a naked linker or a compiler source bootstrap. |
| Provider | Bootlin is a CANDIDATE only; version, origin, payload and installer are unselected and acquisition is unapproved. |
| Exclusions | No Python; no dependency/backend/target/feature changes, Clang/Zig wrapper selection or automatic fallback. |
| Policy | Accepted zero-initialization/no-bias policy, table/belief contracts, Node bridge configuration/locks/RNG and all F9 controls stay unchanged. |

Rust1.95's Tier1 host-tools table lists kernel3.2+ and glibc2.17+ for the selected GNU target [R18-1]; Node Linux/x64/LE hints prove neither requirement locally.
On Unix, Rust normally uses a C compiler such as cc/clang as the linker DRIVER to supply system-library conventions [R18-2].
For GNU x86-64, documented defaults use shipped rust-lld through the +lld linker feature; actual selected archive contents remain unverified [R18-2].
Missing `/usr/bin/ld` alone therefore never proves a standalone GNU ld is required; driver, sysroot, loader and ABI closure remain UNKNOWN.
Qualify the chosen GCC driver with Rust's shipped LLD where applicable; do not blindly substitute a raw ld executable.
Do not disable LLD or change RUSTFLAGS, panic strategy, static linkage, musl target or backend to evade qualification.
Bootlin publishes prebuilt GCC/binutils/C-library toolchains and license/source links [R18-9]; a newer glibc sysroot is not evidence of compatibility with an unknown host.
Distinguish executable-platform loader/glibc requirements from compilation-target glibc, GLIBCXX, CRT, headers, libgcc_s and unwind requirements; establish each only where actually needed.
Clang requires explicit runtime/sysroot closure; a local LLVM source bootstrap requires Python and is excluded [R18-10].
Zig capabilities and cargo-zigbuild's flag/glibc/static limitations do not qualify this Rust GNU context [R18-11/12]; no helper, pip route or wrapper is selected.
The cited closed-not-planned Zig GNU-static issue concerns upstream scope, not a demonstrated local Flex defect; infer no general glibc static-linking prohibition.

### 18.2 Repository lock inventory — lexical evidence, not an active build graph

The parent used a reproducible Node text pattern, not Cargo parsing, metadata, resolution or execution; this keeper does not rerun it.
`Cargo.lock`:170624 UTF-8 bytes; SHA-256 `6907d97e5a09dc1b68f053194b50224bfba422047ca9e32e2d1b0497dac912c1`.
Observed666 package entries comprise663 registry entries plus three without source, matching workspace arena/training-native/xtask, each version0.1.0.
All663 registry sources equal `registry+https://github.com/rust-lang/crates.io-index`, with valid64-character lowercase checksum strings and zero duplicate identity records.
No Git source entries were observed IN THIS LOCKFILE; this does not prove external manifest/configuration/source-replacement absence.
Locked cc/pkg-config/bindgen/clang-sys/zstd-sys/torch-sys/cudarc/wgpu names belong to a SUPERSET, not proof of active features or a native/GPU/Torch/Python requirement.
Selected dependency graph, cached bytes, actual source/build.rs contents and licenses remain UNKNOWN until separately approved Cargo/source evidence exists.
Parent repository reads found the three-crate workspace, Cargo configuration limited to the xtask alias, and unchanged exact Burn CPU manifest features.
Arena smoke declares tsx4.23.12; direct Node, pnpm-lock/module closure and actual smoke context need future qualification, not just §16.5's reported Node path.
No environment values were read; lock inventory does not establish selected HOST build-script/proc-macro dependencies or installed tool usability.

### 18.3 Formal BOM worksheet — required fields, not a completed pin catalog

Every item needs an exact acquisition URL/origin or approved local-input path, revision/source identity, byte length + SHA-256, executablePlatform versus compilationTarget, dependency edges, preparation method and license/source proof; archive inputs additionally need their representation and compressed/expanded bounds.
Record archive format, entry/expanded-byte bounds, setup interpreter, direct executable paths and every loader/library input; unresolved fields remain UNKNOWN rather than inferred.
Track `contentVerified`, `installedUsability` and `nativeQualified` independently, all false here; `pinComplete:false` remains unchanged and no whole-BOM completion is claimed.

| Role | Status / current evidence | Required unresolved descriptor or qualification |
| --- | --- | --- |
| Rust bundle | SELECTED direction; five historical XZ descriptors, total127772720 compressed bytes | Payloads, installation layout, direct tools and shipped linker usability unverified; retain §15.1 identities without reissuing receipts. |
| GNU compiler driver | SELECTED family; Bootlin CANDIDATE | Exact version/origin/length/hash, executable platform, GCC driver, dependencies and setup/license proof UNKNOWN. |
| GNU sysroot + CRT | REQUIRED compatible closure | Target headers/libc/startup objects, ABI baseline and source/license evidence UNKNOWN; do not install every optional library. |
| Runtime / compiler / unwind / host loader | REQUIRED where actually used | Distinct host and target loader/libs, GLIBC/GLIBCXX/libgcc_s/unwind edges and exact identities UNKNOWN. |
| Preparation tools | REQUIRED before unpack/setup | Exact decompressor/tar, installer shell/core utilities, verification utilities and ALL transitive preparation subprocess/runtime dependencies UNKNOWN; bound archive/setup policy and allow no Python. |
| Locked sources |663 CANDIDATE registry identities, not selected bytes | Active subset, original .crate URLs/lengths/bytes/provenance/licenses and offline source closure UNKNOWN. |
| Build-time executables | UNKNOWN selected HOST/TARGET graph | Native build.rs tools, proc macros and any child executables require source audit and qualified closure before execution. |
| Arena Node/tsx verification | REQUIRED for affected smoke gate | Direct Node, tsx4.23.12, lock/module inputs, child paths and writable fixture scope UNKNOWN. |
| Containment / enforcement | REQUIRED before controlled build/test execution | Identified process-tree network/filesystem/subprocess/resource mechanism, bootstrap dependencies and necessary privileges UNKNOWN; a policy statement or tool timeout is not enforcement. |
| Offline diagrams | REQUIRED independent rendering gate | Supplied local theme path, include closure, renderer/runtime/font inputs and exact output scope UNKNOWN; no theme fetch. |

### 18.4 Offline Cargo preparation and execution boundary

Future preparation must derive the selected graph without all-features expansion; metadata's resolve graph covers all platforms by default, while filter-platform narrows that graph, not the complete packages inventory [R18-7]. Neither inventory alone establishes the selected compilation graph.
Audit HOST build-script/proc-macro and TARGET dependency edges explicitly; target flags alone do not govern host compilation [R18-4].
Cargo vendor can vendor registry/Git inputs and print source-replacement configuration; these are future templates, not commands run here [R18-3].
Require unchanged resolution with --locked; --frozen means locked + offline, not source availability or whole-process network containment.
Vendor ignores [source] configuration by default unless respect-source-config is chosen; freeze that choice against the approved source map.
Use a separately approved fresh destination; collision means STOP, not reuse, --no-delete, repair, deletion or suffix fallback.
Inventory hierarchical current/ancestor/CARGO_HOME configuration, source replacements, environment and Rust wrappers/linkers using a frozen allowlist; --config does not disable discovery [R18-4].
Exclude credential files/tokens/helpers and unapproved wrappers/preloads from that future context. Freeze CC/CXX/AR/linker and HOST/TARGET settings without inspecting current secret or environment values now.
Cargo1.95 documents automatic global-cache deletion as disabled under offline/frozen mode [R18-4]; this grants no retained-cache access or write permission. Require a separate fresh Cargo home and explicitly bound its necessary cache/lock/database writes.
Directory-source per-file checksum metadata is necessary but rewritable; trusted preparation must bind vendor contents to lock-pinned original crate bytes [R18-5].
Registry cksum is the expected .crate SHA-256; registry download templates may redirect and do not register a closed body/endpoint set [R18-6].
Approve .crate format, origin/redirect policy, exact catalog and acquisition bounds independently; the old Rust XZ choice authorizes none of these payloads or new third-party source archives.
No mirror, resolver fallback, current download authority or known license/preseed closure exists; establish source provenance/licenses before read-only vendor use.
Cargo compiles and runs build scripts before compiling the rest of their package; scripts can emit linking instructions. OUT_DIR persists, and the documented write convention is not an OS sandbox [R18-8].
Offline Cargo constrains resolver network use, not build.rs/proc-macro/child-process behavior; separately approve enforceable network denial, read/write/subprocess caps and resource limits.
If a selected script requires Python, STOP; do not install Python or alter features. Never serialize live F9 meters, permits or clocks as build state.

### 18.5 Construction DAG and fresh permission gates

1. Obtain approved ordinary HOST ABI/context evidence first, or an operator-supplied closed GNU descriptor pack; neither may be accessed now without fresh scope approval.
2. Qualify prebuilt preparation tools and their loaders/dependencies; do not bootstrap a compiler from source with unavailable tools or Python.
3. Freeze and separately approve acquisition/verification of exact Rust/GNU inputs, then separately qualify bounded extraction/setup and direct installed-tool/loader usability.
4. Approve source preparation, original-byte/checksum/license inventory, read-only vendor closure and frozen Cargo configuration; include all selected HOST/TARGET tool edges.
5. Separately approve frozen/offline builds with actual process-tree network/filesystem/subprocess controls, explicit CPU/RSS/time/operation bounds and fresh TMP/target/cache writes.
6. Run the eight focused new Rust tests plus retained scoring/f64/Burnpack, Node arena smoke and full affected suites/static checks only under approved exact direct-tool/input/write scopes.
7. Independently qualify offline theme/renderer and current diagram outputs, then obtain closing adversarial/security/spec reviews on the accepted current source identity.

Ordinary host metadata bootstrap does not require new F9 authority first; genuine sealed static-ELF/source closure remains a separate unqualified Native obligation.
Only §15's four proposed fresh roots are named, still UNOBSERVED/unreserved/uncreated; additional Cargo-home/vendor paths are UNBOUND, with no guessed locations or path probes.
Expanded bytes, archive entries, peak disk/RSS, CPU and time remain UNKNOWN; define actual caps before each operation, not from compressed totals or the64KiB fixture limit.
§17 capacity is point-time metadata, not space qualification; source-fixture bounds are not larger acquisition budgets.
Retention must specify approved count/byte limits; any cleanup covers only exact fresh known-owned test fixtures, never old/retained roots or a broad cache deletion.
Four new Rust files, the current delta and changed spec index require a fresh verifier input count/identity; no old receipt, hash or invoice becomes current by this plan.
This DAG does not close §10, qualify F9/training quality/calibration, authorize learning, or change `trainingReady:false`; step2 remains NOT DONE.

### 18.6 Research references and explicit remaining STOP

The parent fetched these official/upstream documents successfully; links establish requirements, not pinned artifact provenance, current host facts or local execution results.
- [R18-1: Rust1.95 platform support](https://doc.rust-lang.org/1.95.0/rustc/platform-support.html) — host-tools kernel/glibc baseline.
- [R18-2: Rust1.95 linker options](https://doc.rust-lang.org/1.95.0/rustc/codegen-options/index.html#linker), [linker features](https://doc.rust-lang.org/1.95.0/rustc/codegen-options/index.html#linker-features), [self-contained linking](https://doc.rust-lang.org/1.95.0/rustc/codegen-options/index.html#link-self-contained), [Rust1.90 LLD change](https://blog.rust-lang.org/2025/09/18/Rust-1.90.0/) — driver versus shipped linker.
- [R18-3: Rust1.95 cargo vendor](https://doc.rust-lang.org/1.95.0/cargo/commands/cargo-vendor.html) — vendor/configuration and locked/frozen semantics.
- [R18-4: Rust1.95 Cargo configuration](https://doc.rust-lang.org/1.95.0/cargo/reference/config.html) — discovery/merge, overrides and host/target scope.
- [R18-5: Rust1.95 source replacement](https://doc.rust-lang.org/1.95.0/cargo/reference/source-replacement.html) — directory-source checksum metadata.
- [R18-6: Rust1.95 registry index](https://doc.rust-lang.org/1.95.0/cargo/reference/registry-index.html) — crate checksum/download endpoint semantics.
- [R18-7: Rust1.95 cargo metadata](https://doc.rust-lang.org/1.95.0/cargo/commands/cargo-metadata.html) — resolution/platform filtering.
- [R18-8: Rust1.95 build scripts](https://doc.rust-lang.org/1.95.0/cargo/reference/build-scripts.html) — executable build inputs, output and persistence.
- [R18-9: Bootlin toolchains](https://toolchains.bootlin.com/), [x86-64 releases](https://toolchains.bootlin.com/releases_x86-64.html) — candidate prebuilt GNU families and published license/source links; no version selected.
- [R18-10: Clang toolchain](https://clang.llvm.org/docs/Toolchain.html), [cross-compilation](https://clang.llvm.org/docs/CrossCompilation.html), [LLVM source prerequisites](https://llvm.org/docs/GettingStarted.html) — explicit runtime/sysroot needs; Python>=3.8 source-build prerequisite excludes that bootstrap.
- [R18-11: Zig overview](https://ziglang.org/learn/overview/), [R18-12: cargo-zigbuild README](https://raw.githubusercontent.com/rust-cross/cargo-zigbuild/main/README.md), [issue231](https://github.com/rust-cross/cargo-zigbuild/issues/231) — unselected alternative constraints; issue closed not planned2026-08-26, not local defect evidence.
Research establishes official requirements and the reported lexical inventory ONLY; actual complete operational setup closure is **NOT CLOSED**.
Host ABI, exact tool/payload descriptors, loader/libs/extractor, offline bytes/configuration, process/network/resource enforcement and local theme path remain UNKNOWN: STOP.
Next concrete input is approved HOST ABI/context evidence or a provided closed GNU artifact descriptor pack, with fresh approval before access; no current operation or repeated family/XZ/profile vote follows.
Closing adversarial/security research-document reviews reported no findings and accepted documentation only; DevOps clarifications were applied and spec review reported in-sync. These reviews do not close the Rust/diagram blockers or qualify the setup for execution.

## 19. GNU ABI query — freeze selected, execution unapproved

**[Unverified] The user selected `Freeze ABI query (Recommended)` to prepare this proposal, not execute it.**
Research/preflight notes were published as `5aab9bb88a1f9fdd53e22f04c1425171df3e46bd`; runtime source remains the uncompiled WIP from `166a0bd9` on OPEN/unmerged PR50.
Architect `ses_e964b17c9ffegQGviJ6YtmIhNG` and DevOps `ses_e964b176dffew72K0VthfK0fYv` supplied read-only advice. All earlier grants remain consumed.
This proposal adds ONE native helper execution to a possible future metadata grant; §16's no-candidate-execution profile does not authorize it.

### 19.1 Exact proposed scope and meaning

- Parent: previously reported `/usr/local/bin/node`, repository cwd, inherited ordinary harness environment; outer harness-shell/Node startup, hooks, loader and capture remain unqualified bootstrap residuals.
- Authored observations: Node platform/architecture and `os.release()` kernel hint, plus at most two BigInt lstats of exactly `/usr/bin/getconf` before/after one possible query. No directory/PATH search, file content, open/hash/readlink, `process.report`, environment enumeration, authored retained-root/cache/home/configuration or `/proc` inspection.
- Before execution require a nonempty regular file, UID0, nlink1, an execute bit, no group/world writes and no setuid/setgid. Record each gate and valid metadata snapshot before applying that gate; missing/symlink/rejected metadata means STOP with zero children, never `/bin/getconf` or another fallback.
- The one possible child is `/usr/bin/getconf` with argv `["GNU_LIBC_VERSION"]`, shell:false, cwd `/tmp/opencode/f9-bootstrap-correspondence`, exact environment `{LC_ALL:"C",PATH:""}`, stdin ignored, stdout/stderr piped, timeout2000ms, maxBuffer256 and killSignal SIGKILL. No inherited environment entries reach that child.
- Ordinary helper bootstrap, its actual executable contents, native loader/libraries and possible system loader-cache/preload-configuration activity remain unclosed trust residuals. Empty PATH/projected environment is not confinement or a zero-implicit-I/O guarantee. The Node body authors neither a Python command nor a helper-shell invocation/fallback.
- The eligibility gates do not establish ELF format or exclude a script/shebang interpreter; shell:false is not an interpreter-free execution guarantee. This proposal relies on ordinary trust in the designated GNU host helper and selects no Python/script implementation or alternate helper; if that trust is unacceptable, use supplied audit evidence instead.
- Compare named dev/ino/mode/uid/gid/nlink/size/mtimeNs/ctimeNs before/after, excluding atime. Equal snapshots do not identify the inode actually executed, bind a descriptor or protect ancestor/race windows.
- `getconf` supplies a reported libc-version string for that helper context. It does not prove a direct `gnu_get_libc_version` call, future sysroot/linker libc selection, symbol versions, GLIBCXX/CRT/unwind compatibility or any complete host/Native ABI.
- Publish a parsed version only after exit0, no signal/error, empty stderr, bounded complete capture, exact full ASCII output match and unchanged accepted metadata. Do not compare versions as floating-point values or emit a compatibility/ready verdict.

### 19.2 Bounds and failure publication

| Item | Proposed bound / limitation |
| --- | --- |
| Authored filesystem / child calls | <=2 lstats on one literal path, <=1 direct spawn, zero retries/fallbacks; no authored file opens/creates/deletes |
| Clock / collection | <=32 samples including START; cooperative3500ms body deadline, checked before/after each lstat/spawn action |
| Child capture | Node maxBuffer256; independently require returned stdout and stderr <=256 bytes each before treating capture as complete |
| Capture failure | Oversized/unavailable or interrupted capture produces STOP with captureComplete:false and explicit raw omission/unavailability; never silently claim complete byte receipts |
| Child timeout | 2000ms/SIGKILL request; synchronous return depends on termination; no hard wall-clock, subtree, FD or reap guarantee |
| Authored output | One ASCII JSONLF <=8192 bytes, at most one checked borrowed-FD1 write, no retry; bounded streams use Base64 for byte preservation |
| Harness timeout / capture | Proposed10000ms tool limit, not a hard OS/tree bound; startup/tool stdout/stderr capture is outside the authored-record cap |

Node may buffer beyond maxBuffer before stopping a child; no hard native allocation/RSS bound follows. On overrun, raw bytes may be omitted only with explicit byte counts/flags and STOP; no glibc value or success claim follows.
Diagnostic output bypasses the collection guard after failure; a short/failed/late write leaves exit3 and may leave partial JSON. METADATA_ONLY alone never proves successful delivery.
`countsAtEncoding` is a snapshot before output serialization, not a final clock/sample invoice. Child stdio resources belong to Node's implementation; authored-call counters are not native syscall/physical-resource counts.

### 19.3 Inert proposed program — never evaluate without fresh approval

<!-- BEGIN GNU ABI QUERY V1 -->
```mjs
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
const START = process.hrtime.bigint();
const END = START + 3_500_000_000n;
const HELPER = '/usr/bin/getconf';
const CWD = '/tmp/opencode/f9-bootstrap-correspondence';
const counts = { clock: 1, lstat: 0, spawns: 0 };
const reasons = new Set(['TIME', 'LIMIT', 'HINT', 'MISSING', 'UNSAFE', 'METADATA', 'CHANGED', 'CAPTURE', 'QUERY', 'FORMAT']);
const query = { argv: ['GNU_LIBC_VERSION'], environment: { LC_ALL: 'C', PATH: '' }, shell: false,
  timeoutMs: 2000, maxBuffer: 256, killSignal: 'SIGKILL', attempted: false,
  status: null, signal: null, errorCode: null, stdoutBytes: null, stderrBytes: null,
  stdoutBase64: null, stderrBase64: null, rawOmitted: false, captureComplete: false };
const report = { profile: 'gnu-abi-query-v1', status: 'STOP', reason: 'FS', runtimeHints: null,
  helper: HELPER, before: null, beforeGates: null, after: null, afterGates: null, changedFields: [],
  rejectedField: null, helperMetadataStable: false, query, glibcVersion: null,
  nativeAuthority: false, rustReady: false, trainingReady: false };
process.exitCode = 3;
function fail(code) { const error = new Error('STOP'); error.code = code; throw error; }
function guard() {
  if (counts.clock >= 32) fail('LIMIT');
  counts.clock++;
  if (process.hrtime.bigint() >= END) fail('TIME');
}
function call(kind, action) {
  guard();
  if (counts[kind] >= (kind === 'lstat' ? 2 : 1)) fail('LIMIT');
  counts[kind]++;
  let result;
  try { result = action(); } catch (error) { guard(); throw error; }
  guard(); return result;
}
function hint(value, limit) {
  if (typeof value !== 'string' || !value.length || value.length > limit || /[^\x20-\x7e]/.test(value)) fail('HINT');
  return value;
}
function metadata(stat) {
  const result = {};
  for (const key of ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs']) {
    const value = stat[key], time = key === 'mtimeNs' || key === 'ctimeNs';
    const min = time ? -(1n << 127n) : 0n, max = time ? (1n << 127n) - 1n : (1n << 64n) - 1n;
    if (typeof value !== 'bigint' || value < min || value > max) { report.rejectedField = key; fail('METADATA'); }
    result[key] = value.toString();
  }
  return result;
}
function gates(stat) {
  return { regular: (stat.mode & 0o170000n) === 0o100000n, rootOwned: stat.uid === 0n, singleLink: stat.nlink === 1n,
    nonempty: stat.size > 0n, executable: (stat.mode & 0o111n) !== 0n,
    noGroupWorldWrite: (stat.mode & 0o022n) === 0n, noSetId: (stat.mode & 0o6000n) === 0n };
}
function capture(child) {
  query.status = Number.isInteger(child.status) ? child.status : null;
  query.signal = child.signal === null ? null : /^[A-Z0-9]{1,24}$/.test(child.signal ?? '') ? child.signal : 'OTHER';
  const codes = ['ETIMEDOUT', 'ENOBUFS', 'ENOENT', 'EACCES', 'ENOEXEC'];
  query.errorCode = child.error ? codes.includes(child.error.code) ? child.error.code : 'OTHER' : null;
  let valid = true;
  for (const key of ['stdout', 'stderr']) {
    const bytes = child[key];
    if (!Buffer.isBuffer(bytes)) { valid = false; continue; }
    query[key + 'Bytes'] = bytes.length;
    if (bytes.length > 256) { valid = false; query.rawOmitted = true; continue; }
    query[key + 'Base64'] = bytes.toString('base64');
  }
  query.captureComplete = valid && !child.error && query.signal === null;
  if (!valid) fail('CAPTURE');
}
try {
  guard();
  report.runtimeHints = { platform: hint(process.platform, 32), arch: hint(process.arch, 32), kernelRelease: hint(os.release(), 128) };
  if (process.platform !== 'linux' || process.arch !== 'x64') fail('HINT');
  const before = call('lstat', () => fs.lstatSync(HELPER, { bigint: true }));
  report.before = metadata(before); report.beforeGates = gates(before);
  if (!Object.values(report.beforeGates).every(Boolean)) fail('UNSAFE');
  const child = call('spawns', () => {
    query.attempted = true;
    const value = spawnSync(HELPER, ['GNU_LIBC_VERSION'], { shell: false, cwd: CWD, env: { LC_ALL: 'C', PATH: '' },
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 2000, maxBuffer: 256, killSignal: 'SIGKILL' });
    capture(value); return value;
  });
  if (query.errorCode !== null || query.status !== 0 || query.signal !== null || !query.captureComplete || query.stderrBytes !== 0) fail('QUERY');
  const text = child.stdout.toString('utf8');
  const match = /^glibc ([0-9]{1,4}\.[0-9]{1,4}(?:\.[0-9]{1,4})?)\n$/.exec(text);
  if (!match || match[0] !== text) fail('FORMAT');
  const after = call('lstat', () => fs.lstatSync(HELPER, { bigint: true }));
  report.after = metadata(after); report.afterGates = gates(after);
  report.changedFields = Object.keys(report.before).filter(key => report.before[key] !== report.after[key]);
  if (report.changedFields.length) fail('CHANGED');
  if (!Object.values(report.afterGates).every(Boolean)) fail('UNSAFE');
  report.helperMetadataStable = true;
  guard();
  report.glibcVersion = match[1]; report.status = 'METADATA_ONLY'; report.reason = null;
} catch (error) { report.reason = reasons.has(error?.code) ? error.code : error?.code === 'ENOENT' ? 'MISSING' : 'FS'; }
try {
  report.countsAtEncoding = { ...counts };
  const text = JSON.stringify(report) + '\n';
  if (text.length > 8192 || /[^\x00-\x7f]/.test(text)) throw new Error('OUTPUT');
  const bytes = Buffer.from(text, 'ascii');
  if (fs.writeSync(1, bytes, 0, bytes.length) === bytes.length && report.status === 'METADATA_ONLY') {
    guard(); process.exitCode = 0;
  }
} catch { process.exitCode = 3; }
```
<!-- END GNU ABI QUERY V1 -->

### 19.4 Proposed launch and approval gate

The proposed literal launch is `/usr/local/bin/node --input-type=module <<'GNU_ABI_QUERY_V1'`, LF, the complete program including final LF, then `GNU_ABI_QUERY_V1` and LF; cwd is `/tmp/opencode/f9-bootstrap-correspondence`, inherited parent harness environment, tool timeout10000ms.
Syntax-only Node parsing passed without evaluating this program; static comparison found only the helper/cwd literal paths, two lstat call sites and one spawn site. No helper or ABI observation occurred.
Body identity:5543 UTF-8 bytes including final LF, SHA-256 `90b314be80fd436ff32823e89ac903a276b6b99f1a075dc528976caedb41e5a3`. Complete shell command:5621 UTF-8 bytes including final LF, SHA-256 `167283d6b7faec69d93e9343a3c001e59eefcf77300aa4fe68b5ebb8bdec4ae2`.
Closing adversarial/security reviews accepted the proposal only with no findings; a LOW distinction between outer-shell startup and authored helper calls was clarified and closed. DevOps source review found no remaining issue, and spec review reported in-sync.
Whole-proposal registration and fresh execution approval remain pending. Neither review acceptance, syntax parsing nor these source identities supply execution approval or current ABI qualification.
Freeze the body, complete command and entire proposal bytes; perform proposal/static reviews before requesting ONE fresh grant that explicitly accepts both ordinary Node bootstrap and the helper/loader execution residuals.
No query, lstat, child, version observation or fallback has run under this proposal. An approved or successful metadata query would still leave exact GNU payload/loader/sysroot/offline-source qualification and the Rust/diagram blockers open.

## 20. GNU ABI query outcome — metadata collected, one grant consumed

**[Unverified] Harness-supplied execution/child receipt, not independently authenticated ABI or Native evidence.**
The user explicitly selected `Approve ABI query once`, accepting §19's ordinary outer-shell/Node/helper/loader/cache/capture residuals for ONE execution.
Immediately before execution, repository-only checks matched whole canonical SHA-256 `cc4f965b97a792d55d7e6f0f2d8c011432e073dbf7fe20a46b47113bdf48184b`, complete §19 SHA-256 `749bea3849d2a988a89f7a41c623d84f648058f20df71da12edc778828242abe`, body `90b314be80fd436ff32823e89ac903a276b6b99f1a075dc528976caedb41e5a3` and command `167283d6b7faec69d93e9343a3c001e59eefcf77300aa4fe68b5ebb8bdec4ae2`.
The registered5621-byte command ran once in the approved repository cwd, inherited parent harness environment and10000ms tool timeout; the tool returned normally without a timeout/error marker.
The authored JSONLF was the following single line; parent stderr contained the existing experimental EnvHttpProxyAgent startup warning outside the authored-record bound:

```json
{"profile":"gnu-abi-query-v1","status":"METADATA_ONLY","reason":null,"runtimeHints":{"platform":"linux","arch":"x64","kernelRelease":"7.0.12"},"helper":"/usr/bin/getconf","before":{"dev":"82","ino":"1286","mode":"33261","uid":"0","gid":"0","nlink":"1","size":"31088","mtimeNs":"1784741087000000000","ctimeNs":"1784741087000000000"},"beforeGates":{"regular":true,"rootOwned":true,"singleLink":true,"nonempty":true,"executable":true,"noGroupWorldWrite":true,"noSetId":true},"after":{"dev":"82","ino":"1286","mode":"33261","uid":"0","gid":"0","nlink":"1","size":"31088","mtimeNs":"1784741087000000000","ctimeNs":"1784741087000000000"},"afterGates":{"regular":true,"rootOwned":true,"singleLink":true,"nonempty":true,"executable":true,"noGroupWorldWrite":true,"noSetId":true},"changedFields":[],"rejectedField":null,"helperMetadataStable":true,"query":{"argv":["GNU_LIBC_VERSION"],"environment":{"LC_ALL":"C","PATH":""},"shell":false,"timeoutMs":2000,"maxBuffer":256,"killSignal":"SIGKILL","attempted":true,"status":0,"signal":null,"errorCode":null,"stdoutBytes":11,"stderrBytes":0,"stdoutBase64":"Z2xpYmMgMi40Mwo=","stderrBase64":"","rawOmitted":false,"captureComplete":true},"glibcVersion":"2.43","nativeAuthority":false,"rustReady":false,"trainingReady":false,"countsAtEncoding":{"clock":9,"lstat":2,"spawns":1}}
```

### 20.1 Scoped interpretation and consumed permission

Repository-only checks confirmed the approved canonical prefix and full §19 bytes remain unchanged. The persisted authored JSONLF copy is1311 bytes, SHA-256 `98e6e9447339c9e06f44cb9bd89b553423a950f02993b7cee146fa10ab7bd8a1`; decoded child stdout is11 bytes, SHA-256 `b9e88445cd5c3e93c1fd887ced19dc71d9cb6d08bda471076dbf3540668eb9d2`. These are copy-integrity checks, not independent transport, executable or host authentication.

- The child receipt reports exit0, no signal/error,11 stdout bytes encoding `glibc 2.43` plus LF, empty stderr and complete bounded capture; no raw bytes were omitted.
- Both named snapshots and every recorded eligibility gate matched. This is metadata equality only, not descriptor binding, executed-inode identity, ELF/interpreter qualification, immutable loading or a full source graph.
- Kernel7.0.12 is a Node-reported running-kernel hint; glibc2.43 belongs to this helper execution context. Neither alone establishes future compiler/target/sysroot/loader/GLIBCXX/CRT/unwind compatibility or physical Native ABI.
- `clock:9` is the pre-encoding counter snapshot; two authored lstats and one spawn attempt are source-call observations, not a physical syscall/FD/subtree/clock invoice or an independent EOF/reap proof.
- The query authored no Python command, helper-shell invocation/fallback, filesystem content read/open/create/delete, retained-root/source-cache/proc inspection, Rust command, archive acquisition, installation, model training or theme fetch. Ordinary startup/loader activity remains the explicitly accepted unclosed residual, not a zero-I/O claim.
- This one-shot grant is CONSUMED; no retry, alternate helper/path, further version probe, installation, build, acquisition or other operation follows automatically. §19 remains the immutable revision-scoped approved proposal, not ongoing permission.

### 20.2 Next concrete setup input

Use these reported versions only to screen the selected GNU-family candidate catalog. Do not select a newer sysroot or assume compatibility from a version label; exact host and target executable/library/symbol requirements and usability still require independent qualification.
The next catalog should record publisher, release/triplet, immutable artifact URL, published size/digest/signature, build configuration and source/license provenance. Keep compiler host-runtime requirements distinct from emitted-code target/sysroot requirements; sysroot2.44 alone does not reject a bundle and sysroot2.41 alone does not establish compatibility with reported2.43.
GNU provider/version/payload/installer selection, bounded artifact descriptors and source/license provenance, preparation tools, offline Cargo/Node inputs, actual containment/resource limits and the supplied offline theme path remain unresolved.
No GNU archive was requested, no Rust test compiled or ran, and no runtime verification blocker was waived. Published notes remain `5aab9bb8`, runtime source remains the uncompiled WIP from `166a0bd9`, PR50 remains OPEN/unmerged and `trainingReady:false`.
Closing adversarial/security reviews accepted this receipt documentation only with no findings; spec review reported in-sync. The one-shot permission remains consumed and all runtime/Native/diagram qualification gates remain open independently.

## 21. GNU candidate catalog — public metadata and pinned source, no payload selected

**[Unverified] Parent-reported public research; no archive bytes, installed tools or local compatibility were verified.**
The user's `continue` permits this RESEARCH-ONLY catalog, not acquisition or another metadata-query program.
Architect `ses_e957bfb3dffeOhS01plxYAbObY` and DevOps `ses_e957bfa8fffeTsH048bHF8JA83` supplied read-only advice.
The parent read public HTML, SHA plaintext, release README/fragments/CSV and commit-addressed source scripts only.
No archive HEAD/GET, extraction, installation, execution, local query, source-cache or retained-root access occurred in that research.
This keeper reads/patches only the two canonical planning documents; all bytes before §21 remain unchanged.
§§19/20 remain accepted revision-scoped history; the getconf grant is consumed and reports only glibc2.43/kernel7.0.12 hints.
Bootlin is a candidate publisher; **no provider, release, payload or installer is approved for acquisition, installation or execution**.

### 21.1 Three stable glibc XZ candidates — metadata expectations only

Observed catalog: https://toolchains.bootlin.com/releases_x86-64.html
Observed archive directory: https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/
The release index/README report these versions; they are not inspected payload contents or host-runtime requirements.

| Candidate release | GCC | GDB | Linux headers | Target glibc revision | Binutils | Rounded directory display | Exact compressed byteLength |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2024.05-1 | 13.3.0 | 14.2 | 4.19.315 | 2.39-74-g198632a05f6c7b9ab67d3331d8caace9ceabb685 | 2.41 | 82M | UNKNOWN |
| 2025.08-1 | 14.3.0 | 15.2 | 5.4.296 | 2.41-70-g1502c248d58cb99a203731707987a4342926e830 | 2.43.1 | 89M | UNKNOWN |
| 2026.08-1 | 15.3.0 | 16.3 | 5.10.269 | 2.44-36-g2d5421ffca8893534d5e02ad38c28acd8e778fa3 | 2.45.1 | 98M | UNKNOWN |

**2024.05-1 literal published references:**
- Archive href: https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/x86-64--glibc--stable-2024.05-1.tar.xz
- SHA plaintext: https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/x86-64--glibc--stable-2024.05-1.sha256
- Published expected SHA-256: `932823ca9a3e067e7e2a29810a666d20c9cc5bb550de947f6879e38ace1aa955`.

**2025.08-1 literal published references:**
- Archive href: https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/x86-64--glibc--stable-2025.08-1.tar.xz
- SHA plaintext: https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/x86-64--glibc--stable-2025.08-1.sha256
- Published expected SHA-256: `760acd5c3159448b618e237b61935335baada74fe0cdc0d7611826cb49b41c8c`.

**2026.08-1 literal published references:**
- Archive href: https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/x86-64--glibc--stable-2026.08-1.tar.xz
- SHA plaintext: https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/x86-64--glibc--stable-2026.08-1.sha256
- Published expected SHA-256: `cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3`.

Each read SHA record contained its64-character digest, two spaces and the matching `.tar.xz` basename.
The SHA reference ends in `.sha256`, NOT `.tar.xz.sha256`; directory size105 belongs to that text file, not the archive.
Neither105 nor rounded82M/89M/98M supplies an archive byteLength, extraction limit or storage requirement.
All three are `METADATA_EXPECTATION_ONLY`; same-publisher digest text is not independent signature authentication or payload readback.
Detached archive signature, signing key and independently authenticated verification remain UNKNOWN; no absence/bad-signature claim follows.
Bootlin's https://toolchains.bootlin.com/faq.html says the toolchains are built to run on x86-64 and URLs are kept long-term without an absolute guarantee.
Versioned HTTPS URLs are published references, not proven immutable objects; this qualifies §20.2's requested immutable-URL field as still UNKNOWN.
Actual host loader, GLIBC/GLIBCXX/ISA and emitted-code/sysroot requirements remain distinct UNKNOWNs for every candidate.
Do not reject2026 solely because sysroot2.44 exceeds reported2.43, or admit2025 solely because2.41 is lower.

### 21.2 Release evidence and historical source identities

Define `B = https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/` and `N(r) = x86-64--glibc--stable-<r>` for the three literal release strings above.
The parent read each `B + readmes/N(r).txt`, `B + fragments/N(r).frag`, `B + build_fragments/N(r).defconfig` and `B + summaries/N(r).csv`.
These are exact URL-construction formulas for public metadata, not shell recipes or authority to fetch another object.
README names versions/source/license links and a checkout in https://github.com/bootlin/buildroot-toolchains.git.

| Release | README checkout tag, exact punctuation | API-resolved Buildroot commit | CSV Buildroot version |
| --- | --- | --- | --- |
| 2024.05-1 | `toolchains.bootlin.com-2024.05.1` | `1bef6133191aec7b923f5ff80af077c5cdab4e20` | 2021.11-12449-g1bef613319 |
| 2025.08-1 | `toolchains.bootlin.com-2025.08.1` | `83947c7bb6158072bc2f52b58e90891cd3dc04a2` | 2021.11-18033-g83947c7bb6 |
| 2026.08-1 | `toolchains.bootlin.com-2026.08-1` | `48bfc2c656979dbbb24277ffc6746ea7a6af4a50` | toolchains.bootlin.com-2026.08-1 |

Tag API formula: `https://api.github.com/repos/bootlin/buildroot-toolchains/git/ref/tags/<exact-tag>`.
The2026 ref names annotated tag `84c5a4d7dfeff0e552e3e4bc8232c342ab8c3522`; https://api.github.com/repos/bootlin/buildroot-toolchains/git/tags/84c5a4d7dfeff0e552e3e4bc8232c342ab8c3522 supplied the peeled commit above.
Its API verification `{verified:false,reason:'unknown_key'}` is tag metadata, not archive verification, an archive bad signature or proof of an unsigned archive.
These are published source refs, not established SDK-to-source correspondence or independently authenticated release identities.
Historical builder-orchestrator revisions remain UNKNOWN; current toolchains-builder master `09655fd00bebf3f96b5912245d3db818eec0434f` dated2026-08-12 is CURRENT REFERENCE ONLY.
Do not substitute current master, current script names or a failed raw-script URL for historical build provenance; no fallback was executed.
At EACH table commit `C`, the parent read `https://raw.githubusercontent.com/bootlin/buildroot-toolchains/<C>/<P>` for these exact paths:
- `support/misc/relocate-sdk.sh`
- `docs/manual/using-buildroot-toolchain.adoc`
- `toolchain/toolchain-buildroot/Config.in`
- `package/Makefile.in`

### 21.3 Build configuration, no-Python red flag and license boundaries

External `.frag` files describe consumer integration, not how the SDK was built; they declare x86-64 glibc, C++, OpenMP, SSP and threads.
The2024/2025 integration URL uses HTTP;2026 uses HTTPS. Do not copy historical HTTP acquisition instructions; any future approved acquisition must use approved HTTPS.
Actual `.defconfig` source-build fragments explicitly set `BR2_PACKAGE_HOST_GDB=y`, `BR2_PACKAGE_HOST_GDB_TUI=y` and `BR2_PACKAGE_HOST_GDB_PYTHON3=y` in ALL THREE releases.
CSV host-GDB dependencies include host-python3, with Python rows3.11.8/3.13.5/3.14.7 respectively; this is a concrete **whole-SDK no-Python red flag**.
No GCC Python dependency follows merely from GDB's configuration; the selected GCC/sysroot execution and installation subset is still UNKNOWN.
Opaque acquisition of upstream bytes containing Python files would not itself select Python execution, but does not qualify the whole SDK as no-Python compatible.
Before installation/execution, prove an explicitly approved Python-free subset and every required helper/runtime edge, or STOP.
No Python/GDB extraction, installation or execution, source bootstrap or README reproduction recipe is approved.
The defconfigs also publish `BR2_WGET` with `--no-check-certificate`, retry3 for2024 and retry10 for2025/2026.
Those are source facts, never permission to disable TLS checks, retry, use fallback acquisition or execute upstream recipes.
CSV gcc-final records GPL-3.0-with-GCC-exception/COPYING.RUNTIME; host-GCC rows carry GPL variants and glibc components carry differing GPL/LGPL/BSD/MIT claims.
The2024/2025 metadata includes unknown skeleton licenses; license labels and visible roots do not establish a complete correspondence/compliance audit.
The parent viewed HTML roots https://toolchains.bootlin.com/downloads/releases/sources/ and https://toolchains.bootlin.com/downloads/releases/licenses/ only; no source tarball was downloaded.
Require exact per-component source, revision, applicable license/exception and installed-subset correspondence; toolchains-builder's project LICENSE is not a component-license grant.

### 21.4 Preparation and triplet — source evidence, not permission to run

Pinned manuals say to run `relocate-sdk.sh` after extraction before use; optional `environment-setup` changes a CROSS context, not proof of native HOST usability.
The manual's example `.tar.gz` does not reclassify these observed `.tar.xz` artifacts or reopen the XZ choice.
The2024/2025 relocation sources use `/bin/sh`, dirname, `readlink -f`, cat, sed, whole-SDK `grep -lr`, `file --mime-type` filtering and in-place text rewrites.
They update `share/buildroot/sdk-location`; this is a broad scan/mutation surface, not an approved blind setup step or immutable-prefix guarantee.
The2026 source uses `share/buildroot/sdk-relocs` instead of that grep/file scan, while retaining shell/dirname/readlink/cat/sed dependencies.
Manifest-driven does not mean safe: unqualified manifest paths, traversal and symlink following can escape a proposed root.
Before relocation require bounded allowlisted paths/new-root writes, actual helper/runtime closure, manifest validation and post-transform identity evidence.
No explicit Python command appears in these relocation sources; actual SDK-script correspondence and transitive no-Python runtime closure remain UNKNOWN.
No SDK script ran and no SDK environment was sourced; source instructions grant neither setup execution nor PATH/environment changes.
Pinned configuration defaults vendor to `buildroot`; Makefile defines `GNU_TARGET_NAME=$(ARCH)-$(TARGET_VENDOR)-$(TARGET_OS)-$(LIBC)$(ABI)`, with linux/gnu and TARGET_CROSS-prefixed tools.
[Inference] Fragment/default composition suggests `x86_64-buildroot-linux-gnu`; this is a source-derived hint, NOT an observed SDK prefix or executable name.
`actualSDKTriplet`, executable paths and install layout remain UNKNOWN; the Rust target stays `x86_64-unknown-linux-gnu`.
HOST tools/build scripts and TARGET outputs require separate qualification; an environment script or tuple label cannot qualify either graph.

### 21.5 Evidence tiers, unresolved fields and next research decision

| Tier | Present status / future independent evidence |
| --- | --- |
| Metadata expectations | Three useful published candidate records only; `pinComplete:false`, no selected GNU payload. |
| DATA_ONLY content verification | `contentVerified:false`; later approved bounded acquisition plus exact length/hash/independent readback, not installer approval. |
| Installed usability | `installedUsability:false`; later approved preparation, actual ELF/loader/helper/no-Python closure and scoped usability evidence. |
| Native qualification | `nativeQualified:false`; separate source/name/loading/custody/clock/authority obligations, never minted by the prior tiers. |

Do not require installed usability before proposing DATA_ONLY acquisition; do require separately reviewed exact input descriptors, source bounds and explicit acquisition permission.
No archive headers/length request or body fetch is granted now; missing exact compressed length, authenticated proof and payload manifest stay UNKNOWN.
Expanded bytes/entries, extraction caps, preparation binaries, ELF/library/symbol requirements and actual filesystem/network/process/resource controls remain UNKNOWN.
The663 candidate registry sources are not cached-byte evidence; selected offline Cargo inputs, Node/tsx closure and supplied local theme/renderer remain unqualified.
The64KiB fixture is not an archive budget; preserve per-object binding/security/hash/readback and do not scale it by changing constants.
Three versions were offered for **further source/metadata qualification ONLY**, not provider/payload approval, acquisition or another GNU-family/XZ vote:
- **2024.05-1:** older GCC/sysroot, rounded82M, broad-scan relocation; potentially smaller input, but Python/GDB and compatibility gaps remain.
- **2025.08-1:** middle GCC/sysroot, rounded89M, broad-scan relocation; no compatibility inference from sysroot2.41 versus reported2.43.
- **2026.08-1:** newer GCC/sysroot, rounded98M, manifest relocation; larger displayed input and manifest-path qualification, not rejection merely for sysroot2.44.
The user asked why not the latest2026 candidate; that question is not an artifact or operational approval. The initial2025 recommendation was not backed by compatibility evidence and is withdrawn.
Prioritize2026 for further public-source investigation in response to that steering; retain the other two as comparison candidates. No evidence retrieved here rules out2026 for qualification merely because its target sysroot is glibc2.44.
[Inference] The manifest-based2026 relocator provides a more explicit path-list audit surface than the older broad scan, but actual manifest safety, no-Python closure and executable compatibility remain unproved.
Further operational grants remain independent; this research priority authorizes no archive HEAD/GET, installation or execution and does not change Rust1.95/Burn or the fixed GNU target.
Rust1.95 GNU, Burn=0.22 Flex f64/std/flex/optim/store, five Rust XZ pins, RNG, backend, target, fees, data/labels/credits/meters/clocks and all F9/legal/Native controls remain unchanged.
Runtime WIP `166a0bd9` is unchanged/uncompiled with eight unrun new tests; Rust BLOCKER and diagram MEDIUM stay OPEN and binding.
Published notes remain `5aab9bb8`, PR50 OPEN/unmerged; this continuation grants no commit/push, merge, package change, test run, cleanup or training.
Operational closure remains NOT CLOSED; `trainingReady:false`, §10 OPEN and step2 NOT DONE.
Closing adversarial/security research-document reviews found no findings; DevOps reviewed the candidate distinctions and spec review reported in-sync. Acceptance covers catalog documentation only, not a payload, installation, execution or runtime verification waiver.

## 22. 2026 source-subset assessment — partial evidence, runtime closure blocked

**[Unverified] Public-source findings at Buildroot commit `48bfc2c656979dbbb24277ffc6746ea7a6af4a50`; no SDK bytes or local tools were inspected.**
The user's `proceed` continues2026 source qualification, not archive acquisition, host observation, setup execution or a no-Python waiver.
Architect `ses_e94e1ea90ffeCk2mArk7BMxs6n` and DevOps `ses_e94e1ea8effe1XDO0hrWhzzYdo` supplied read-only advice; the parent fetched individual public text sources only.
Define `S = https://raw.githubusercontent.com/bootlin/buildroot-toolchains/48bfc2c656979dbbb24277ffc6746ea7a6af4a50/`; paths/line ranges below refer to that exact source revision, not observed archive contents.

### 22.1 Declared dependency and packaging evidence

| Proposed component treatment | Source evidence at S | Scope / remaining obligation |
| --- | --- | --- |
| GCC driver/wrapper: investigate for retention | `package/gcc/gcc.mk:59–77,302,353–373`; `package/gcc/gcc-final/gcc-final.mk:25–27,67–77,114–129` | Reviewed declarations list binutils/GMP/MPC/MPFR, libc and conditional dependencies, not a direct GDB/Python edge. These are build declarations, not a complete delivered runtime graph. |
| GDB/Python: exclude from any proposed no-Python installation/execution subset | `package/gdb/gdb.mk:291–296`; `package/python3/python3.mk:16–18,246–251` | Configured host-GDB adds host-python3 and an explicit host Python path; host Python installs into HOST_DIR and adds aliases. Excluding GDB alone does not prove Python absent elsewhere. |
| Target sysroot/CRT/libraries: investigate for retention as actually required | `package/glibc/glibc.mk:46–55,121–123,194–204`; `package/linux-headers/linux-headers.mk:118–154`; `package/gcc/gcc-final/gcc-final.mk:131–184` | Source describes staging headers/libs and conditional libgcc_s/libstdc++/libatomic/libgomp, not exact payload files or host ELF dependencies. Do not discard host C++ runtime libraries merely because the input language is C. |
| Local source reproduction: not an accepted bootstrap route | `package/glibc/glibc.mk:50–51`; `support/dependencies/dependencies.sh:89–112` | glibc source building has a Python-host dependency variable; Buildroot source building checks a host compiler. Those do not establish a Python runtime requirement for prebuilt libc, and do not authorize local rebuilding. |
| Whole SDK: not a curated no-Python subset | `Makefile:614–640` | `prepare-sdk` depends on world; `sdk` archives the host directory, without a demonstrated GCC-only/Python-free pruning rule. Symbol stripping is not dependency removal. |

No Python interpreter, GDB, SDK or sysroot was extracted, installed or executed in this assessment. The source declarations support investigating a split, not certifying its completeness.

### 22.2 Relocation producer, consumer and build-time sanitization

`Makefile:619–629` generates `share/buildroot/sdk-relocs` by recursively grepping HOST_DIR for its old prefix, selecting text MIME results, excluding the location/list files and replacing the leading HOST_DIR with `.`.
The source format is line-oriented and generated from the whole host tree, not the proposed retained subset. Whitespace/newline names, prefix escaping, symlinks, exclusions and actual manifest completeness need explicit handling; no existing manifest was observed.
The end-user consumer `support/misc/relocate-sdk.sh` reads that list and performs in-place sed substitutions, then updates `sdk-location`; its manifest loop is not a root-containment validator or a transaction/rollback guarantee.
Build-time RPATH work is separate: `Makefile:741–750,802–805` invokes `support/scripts/fix-rpath` for host/staging/target trees.
`support/scripts/fix-rpath:1,56,66–104,114–190` uses Bash/patchelf and supporting utilities, creates work files and returns success after a path labeled to ignore errors. This is source behavior, not evidence that every delivered ELF RPATH was successfully sanitized.
No relocation, RPATH tool, SDK environment script or regeneration recipe is approved to run. A curated manifest or replacement relocator would change the preparation design and needs an explicit accepted file plan, persisted tests, review and later execution approval.

### 22.3 Wrapper and host/target boundary

`package/gcc/gcc.mk:302,353–373` describes `.br_real` backing programs, wrapper links and simple tool aliases; `toolchain/toolchain-wrapper.mk:16–55,86–96` supplies relative sysroot/configuration arguments and builds/installs the C wrapper.
`toolchain/toolchain-wrapper.c:261–302` resolves a slash-bearing argv0 using realpath; the bare-name branch reads `/proc/self/exe`. Absolute invocation can avoid that particular source branch, not prove the entire compiler process tree avoids proc or other unapproved inputs.
The wrapper constructs its sysroot at `:345–349` and eventually calls execv at `:551`; conditional ccache/environment-controlled behavior appears at `:338–344,506–530`, and debug settings can print arguments at `:245–259,532–549`.
Future direct paths, argv0, environment/configuration and optional-cache/debug policy must be frozen from actual qualified inputs. No current environment, cache or proc observation was performed here.
Reviewed source does not supply actual delivered ELF interpreters, DT_NEEDED/symbol-version closure, selected compiled wrapper macros, CPU requirements, executed-image identity or a qualified SDK prefix.
Rust's fixed GNU target, shipped-LLD branch and HOST build-script/proc-macro linking remain independent obligations; no wrapper bypass, new target, panic/static flag, SDK environment sourcing or helper selection follows.

### 22.4 Source-only gate and useful next evidence

`SourceSubsetAssessment.result = BLOCKED`: retained runtime edges, actual subset inventory, Python-free installation/execution, payload correspondence and safe relocation are unresolved.
The useful result is a referenced proposed split and concrete inspection obligations, not `pythonFreeSubsetVerified:true`, installed usability, Native authority or a completed Rust runtime.
Opaque DATA_ONLY acquisition need not wait for installed-usability proof, but it needs its own reviewed bounded implementation, exact expectations and fresh grant; the64KiB fixture is not that implementation.
The candidate archive's exact length is still UNKNOWN. A separately approved HEAD can add advertised metadata without reading/extracting its body or selecting it for installation.

### 22.5 Header-only request proposal — execution unapproved

The following is proposed Code Mode JavaScript for ONE authored Fetch call on the already published2026 candidate URL. No GET, response-body read API, filesystem/host query, shell or subprocess is authored.
The ordinary read-only integration is trusted for transport/startup; underlying DNS/TLS/proxy/cache behavior, authentication injection, internal attempts, duration, wire/header buffering, RSS and tool capture are not hard-bounded by this source. `credentials:'omit'` and `cache:'no-store'` are requested policies, not independent infrastructure-isolation proof.
No timer or physical-network/source-graph qualification is claimed; this differs from a host-side native controller. Fresh approval must explicitly accept these integration residuals rather than borrowing a previous host-query grant.
The request forbids redirects and asks for identity encoding. It requires exposed status200, exact response URL, redirected:false, canonical positive safe-integer Content-Length, absent/identity Content-Encoding, and no exposed Transfer-Encoding or Content-Range.
These are normalized Fetch header values, not raw-header uniqueness or an HTTP-validity judgment. MIME type, ETag and Last-Modified are informational; dates/ETags do not authenticate bytes or timestamps.
The returned record is ASCII JSON <=4096 bytes before integration framing; optional exposed values are rejected above256 printable ASCII characters rather than truncated. Generic STOP reasons expose no exception text, cookies or authentication headers.
`bodyReadApiCalls:0` means no authored body-consumption API, not a guarantee of zero transported bytes. A successful HEAD adds only HEADER_ADVERTISED_LENGTH metadata; it verifies neither the expected SHA nor archive contents, no-Python subset, installation, Rust readiness or Native authority.

<!-- BEGIN GNU 2026 HEAD METADATA V1 -->
```js
const URL = 'https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/x86-64--glibc--stable-2026.08-1.tar.xz';
const out = { profile: 'gnu-2026-head-metadata-v1', status: 'STOP', reason: 'FETCH_FAILED', url: URL, method: 'HEAD',
  httpStatus: null, responseUrl: null, redirected: null, headerView: 'FETCH_NORMALIZED', headers: null,
  headerAdvertisedLength: null, headerAdvertisedBytes: null, sourceFetchCalls: 0, bodyReadApiCalls: 0,
  expectedPublishedSHA256: 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3',
  payloadVerified: false, pythonFreeSubsetVerified: false, installedUsability: false,
  nativeQualified: false, rustReady: false, trainingReady: false };
function reject(reason) { out.reason = reason; throw new Error('STOP'); }
try {
  out.sourceFetchCalls = 1;
  const response = await fetch(URL, { method: 'HEAD', redirect: 'error', credentials: 'omit', cache: 'no-store',
    headers: { 'Accept-Encoding': 'identity' } });
  if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) reject('RESPONSE_POLICY');
  out.httpStatus = response.status;
  if (response.url !== URL || response.redirected !== false) reject('URL_POLICY');
  out.responseUrl = response.url; out.redirected = false;
  const headers = {};
  for (const name of ['content-length', 'content-encoding', 'transfer-encoding', 'content-range', 'content-type', 'etag', 'last-modified']) {
    const value = response.headers.get(name);
    if (value !== null && (typeof value !== 'string' || value.length > 256 || /[^\x20-\x7e]/.test(value))) reject('HEADER_VIEW_POLICY');
    headers[name] = value;
  }
  out.headers = headers;
  if (out.httpStatus !== 200) reject('STATUS_POLICY');
  if (headers['transfer-encoding'] !== null) reject('TRANSFER_ENCODING_POLICY');
  if (headers['content-range'] !== null) reject('RANGE_POLICY');
  if (headers['content-encoding'] !== null && headers['content-encoding'].toLowerCase() !== 'identity') reject('ENCODING_POLICY');
  const length = headers['content-length'];
  if (typeof length !== 'string' || !/^[1-9][0-9]*$/.test(length)) reject('LENGTH_POLICY');
  const count = Number(length);
  if (!Number.isSafeInteger(count) || count <= 0) reject('LENGTH_POLICY');
  out.headerAdvertisedLength = length; out.headerAdvertisedBytes = count;
  out.status = 'HEADER_ADVERTISED_LENGTH'; out.reason = null;
} catch {}
const text = JSON.stringify(out);
if (text.length > 4096 || /[^\x00-\x7f]/.test(text)) {
  return { profile: 'gnu-2026-head-metadata-v1', status: 'STOP', reason: 'RESULT_POLICY',
    sourceFetchCalls: out.sourceFetchCalls, bodyReadApiCalls: 0, payloadVerified: false,
    pythonFreeSubsetVerified: false, installedUsability: false, nativeQualified: false, rustReady: false, trainingReady: false };
}
return out;
```
<!-- END GNU 2026 HEAD METADATA V1 -->

### 22.6 Registration, reviews and separate permission

Register exact Code Mode body and the whole current §22 proposal after static reviews, then request ONE fresh metadata-only execution grant; an executable change invalidates that approval.
Syntax-only parsing in an uninvoked async-function wrapper passed; this does not evaluate the request or qualify integration behavior. Static comparison found one authored Fetch call and no body-read API call sites.
The exact proposed Code Mode body is2810 UTF-8 bytes including final LF, SHA-256 `1eff6117ca39ea691d83ae333db3928e0329716e49ca60bae825e461f4f576e0`. Closing adversarial/security reviews accepted research/proposal documentation only with no findings; DevOps reviewed the length-provenance boundary and spec review reported in-sync.
Whole-proposal registration and fresh execution approval remain pending. A future advertised-length result must retain that provenance; actual payload byte length/hash/readback remain unverified until separately approved acquisition.
No HEAD request has run under this proposal. Existing local query grants remain consumed; no archive GET, body read/retention, extraction, installation, candidate execution, Rust/test command, cache/proc probe, theme fetch, cleanup or publication follows.
All four evidence tiers from §21 remain separate; actual source/payload/loader/No-Python/containment qualification and the Rust BLOCKER/diagram MEDIUM remain open with `trainingReady:false`.

## 23. 2026 HEAD outcome — advertised length collected, one grant consumed

**[Unverified] Read-only integration result, not raw HTTP-wire, archive-content or Native evidence.**
The user explicitly selected `Approve HEAD once`, accepting §22's opaque transport/proxy/cache/auth-injection/internal-attempt/startup/capture residuals without hard network, duration, buffering or RSS guarantees.
Immediately before execution, repository-only checks matched whole canonical SHA-256 `637d86c9afaa5e92116d4b6c24ed4dcf5219ee65882523efc9586c80d9cb8676`, complete §22 SHA-256 `0d2b13e9c69c2153d954950c945f4b2e1864e74ef9522eaa8e92441b892814ad` and2810-byte Code Mode body `1eff6117ca39ea691d83ae333db3928e0329716e49ca60bae825e461f4f576e0`.
That exact body ran once. The integration returned the following object, represented here as compact JSON for copy integrity, not as authenticated raw response bytes:

```json
{"profile":"gnu-2026-head-metadata-v1","status":"HEADER_ADVERTISED_LENGTH","reason":null,"url":"https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/x86-64--glibc--stable-2026.08-1.tar.xz","method":"HEAD","httpStatus":200,"responseUrl":"https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/x86-64--glibc--stable-2026.08-1.tar.xz","redirected":false,"headerView":"FETCH_NORMALIZED","headers":{"content-length":"102296280","content-encoding":null,"transfer-encoding":null,"content-range":null,"content-type":"application/x-xz","etag":"\"618ead8-65acb0981cc50\"","last-modified":"Sun, 06 Sep 2026 06:59:04 GMT"},"headerAdvertisedLength":"102296280","headerAdvertisedBytes":102296280,"sourceFetchCalls":1,"bodyReadApiCalls":0,"expectedPublishedSHA256":"cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3","payloadVerified":false,"pythonFreeSubsetVerified":false,"installedUsability":false,"nativeQualified":false,"rustReady":false,"trainingReady":false}
```

### 23.1 Scope and candidate descriptor

Repository-only checks confirmed the approved canonical prefix and whole §22 bytes remain unchanged. The compact JSON copy including its storage LF is1012 bytes, SHA-256 `7c7bc3605121a7193f3492164a3c7c3f930b575359cbaafbbaafdafacaa11cc6`; this authenticates neither raw HTTP bytes nor the integration's transport encoding.

- The exposed headers advertise exactly102296280 bytes, with status200, matching URL, redirected:false and absent content/transfer encoding and content range. This is normalized-header evidence, not raw uniqueness or observed payload length.
- Content type, ETag and Last-Modified are informational. None establishes a payload digest, independently authenticated publisher, immutable object or trusted clock.
- The one authored Fetch call and zero authored body-read API calls are source observations, not a physical request/connection count or zero transported-byte guarantee.
- Preserve §21's earlier exact-length UNKNOWN as historical research status; this later result adds `headerAdvertisedLength:'102296280'`, not `actualPayloadLengthVerified:true`.
- A future independently registered comparison target may combine that advertised length with expected published SHA-256 `cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3` and the same exact2026 URL/name. Actual incoming length/digest and independent readback must still match before even DATA_ONLY content acceptance.
- That future expectation does not approve GNU provider/payload acquisition or installation, select SDK/GDB/Python files for extraction, establish the blocked source-subset graph, or qualify any executable.
- The one-shot HEAD permission is CONSUMED. No retry, GET, follow-up header/host query, body retention, filesystem staging, extraction, installation, Rust invocation, training or theme fetch follows automatically.

### 23.2 Next implementation gate

The next useful source unit is a separately accepted bounded DATA_ONLY acquisition implementation with persisted offline transport/descriptor/custody/cleanup failure tests, not a constant increase to the64KiB fixture or an immediate large-archive attempt.
It must retain independent per-object named/FD identity and security, exclusive fresh paths, bounded positional I/O, exact incoming byte/digest checks, successful single-attempt descriptor closure, independent readback/EOF/digest and absorbing failure.
Implementation/test permission, real filesystem staging, external archive GET, extraction/installation, offline build and Native qualification remain separate scopes; actual archive GET approval is NONE here.
Rust source remains the uncompiled WIP from `166a0bd9`; notes last published `5aab9bb8`/PR50 OPEN/unmerged. The Rust BLOCKER and diagram MEDIUM remain binding, `trainingReady:false`, step2 NOT DONE.
Closing adversarial/security reviews accepted this metadata receipt documentation only with no findings; spec review reported in-sync. The HEAD grant remains consumed and supplies no acquisition, installation or runtime waiver.

## 24. Offline acquisition unit — implemented and tested, real acquisition unapproved

**[Unverified] Current source mapping and parent-run evidence cover the offline unit only, not real GNU payloads or Rust/Native readiness.**
The user explicitly selected `Implement offline unit`: actual new source plus persisted tests, with ALL transport mocked and no TCP, listeners or external operations.
Architect `ses_e94c2f5ecffe6BAhVOVabqE1Ya` and DevOps `ses_e94c2f53fffeOzbRTBWZtL2s65` supplied the accepted planning advice.
The source handoff added `tooling/native-ingress/acquisition.mjs` and `tooling/native-ingress/acquisition.test.mjs`; both cite the [acquisition sequence](../tooling/native-ingress/acquisition.puml), and the persisted source/diagram/index test binds their exact coverage.
Keep this continuation in the existing canonical document; do not create another history packet or change §§1–23.

### 24.1 GOALS and permission before verification

- Create a SEPARATE bounded archive profile; preserve the old64KiB fixture, its semantics and tests without edits.
- Permit only fresh private test fixtures under `/tmp/opencode`, <=1MiB each and <=8MiB/run; typical payloads use a few bytes and real SHA-256.
- Cleanup may unlink only exact known test-owned files and rmdir their exact owned directories; no old-root access, broad deletion, repair or fallback.
- Mock both `https.request` and `https.get`; unused transport calls throw and never forward. Use fake clocks/timers, not a real120s sleep.
- Boundary cases up to128MiB use pure descriptor checks/mocks, never physical large fixtures or forged success for the published GNU digest.
- Use Node built-ins only; no new framework, dependency, manifest or license change. This keeper performs document reads/patches only, not commands or probes.
- No archive GET, external grant, extraction, installation, resume, chmod, library-path deletion, fsync or durability claim is approved.

### 24.2 Current API and source-bound resource contract

- Source exports `createArtifactDescriptor(input)`, frozen `GNU2026_ARTIFACT`, `acquireArtifact(rootPath, input)` and fixed wrapper `acquireGnu2026(rootPath)`; module initialization validates metadata without network effects.
- Accept only an exact own-data descriptor record; reject proxies, accessors, inherited/extra/symbol properties and return a frozen copy.
- Require a safe basename ending `.tar.xz`, and URL EXACTLY `https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/` plus that name.
- Reject credentials, query, fragment, explicit port, encoding/normalization variants and other origins; require integer length1..134217728 and lowercase64-hex SHA-256.
- GNU2026_ARTIFACT targets `x86-64--glibc--stable-2026.08-1.tar.xz`, advertised102296280 bytes and expected SHA-256 `cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3`.
- That comparison target derives from §23 metadata, NOT a verified archive body, authenticated provenance, immutable object or permission to use the real GET function online.
- Reject invalid paths/descriptors before filesystem or transport effects; require an exclusively created fresh0700 root and0600 regular nlink1 size0 writer before ONE request/end.
- Reuse custody `assertRoot`/`assertFileBirth`/`assertFilePhase` checks with independent per-object named/FD dev+ino and security; never require file.dev==parent.dev or inspect/reuse an existing root.
- Require verified TLS, agent:false, identity encoding, connection:close, status200 and exactly one canonical expected Content-Length; forbid TE, ranges, redirects, retries, auth, custom CA and proxy fallback.
- Check raw headers against16KiB/32 pairs with request maxHeadersCount33 as sentinel; these source checks do not bound native wire buffering.
- Limit data events to32768 and each chunk to1..1MiB; validate native typed length/backing, reject SharedArrayBuffer and copy privately before hash/full single positional write.
- Stop excess bytes/events before effects; reject partial writes without retry. Retain no whole-payload array; private chunk<=1MiB plus64KiB scratch is not a hard RSS bound.
- Cap source filesystem non-close attempts at65533 plus<=3 close attempts, total65536; own at most two file FDs: root plus writer OR reader.
- Cap source clock samples at200000, lifecycle accounting at32 and explicit network effects at4: request, end, request destroy, response destroy; no native DNS/TLS/internal-attempt, physical-FD, wire or callback bound follows.
- Take monotonic START before validation/setup; use120s total including1s cleanup reserve,119s ordinary work and early-failure cleanup deadline min(total end, failure time+1s).
- Guards/timers are cooperative; they cannot interrupt blocked filesystem/native I/O or promise hard process/close termination. Keep original F9 cold10/lifecycle300 including reserved3, generator2048 and ONE inclusive BOTH-seat1048576 unchanged.
- This ordinary-input profile stays outside F9 and preserves F1/WorkMeter, PrivateRootB/JF and source.price; grant no new allowance, reset, refund, clone, serialization or Native qualification.

### 24.3 Current completion, failure and evidence contract

- Observe response end+complete, request close AND response close before writer finalization/readback; exact incoming length/hash alone cannot publish success.
- After incoming match, require full writer metadata/root binding and close writer once; clear its holder BEFORE close so uncertainty absorbs failure and forbids a reader open.
- Assign each opened FD inside the active outer try BEFORE any post-operation guard; never lose ownership on a late deadline failure.
- Read back in exact positional64KiB slices with EOF and independent SHA-256; require full nine-field stable metadata for the written file, final root binding and successful final FD closure.
- Preserve error precedence `E_CLOSE > E_NETWORK_CLEANUP > first operation error`, retaining displaced errors through `.cause`; missing close/stat/hash evidence never yields success.
- Destroy request/response at most once on failure; late events become inert, with no reopen, write or hash after failure and no retry on uncertain close.
- The frozen `ordinary-archive-acquisition-v1` / DATA_ONLY result reports contentMatched:true only after all gates, expectedSha256/incomingSha256/readbackSha256, byteLength, root/file paths, rootDevice/fileDevice and frozen counts including copiedBytes/writtenBytes/readBytes.
- Keep nativeAuthority/nativeQualified/provenanceVerified/pythonFreeSubsetVerified/installedUsability/rustReady/trainingReady:false; report installationPerformed:false only for this function, not global installed state, and immutabilityVerified:false.
- Current-byte matching proves neither future immutability, ancestor/OS-barrier protection, provenance, a Python-free subset, controlled-root software classification nor installed usability; the API is operator-controlled, not a network daemon.

### 24.4 Persisted verification, offline diagram permission and remaining gates

The parent independently ran all four Node test files: **217 PASS =132 new +85 unchanged legacy,0 fail/cancelled/skip/todo**. Historical85 passes alone are not reused as verification of changed source.
`acquisition.test.mjs` persists descriptor/origin/header/chunk/event/clock/custody/replacement/readback/close/cause-priority failure checks, real small-payload hashes, peak2 FDs/three positive closes and exact test-owned cleanup; its global write guard limits each positional write extent to1MiB and aggregate real writes to8MiB.
Parent command: `node --test --test-reporter=tap --test-concurrency=1 --experimental-test-coverage tooling/native-ingress/acquisition.test.mjs tooling/native-ingress/input-descriptor.test.mjs tooling/native-ingress/custody.test.mjs tooling/native-ingress/custody-chunks.test.mjs`. Both new-file syntax checks passed. Acquisition-module coverage is100% lines/functions and98.93% branches; coverage is not actual-transport or Native assurance.
Closing adversarial and security source reviews found no findings and accepted the offline unit only. DevOps closed the deterministic-settlement harness LOW by source review; spec review closed the stale-legend drift and reported in-sync. None accepted global Rust/Native readiness or real acquisition.
DevOps identified a LOW regression-harness risk from real119s timers; all acquisition tests now use per-context fake clocks, bounded16-turn microtask drains and explicit settlement checks. Unexpectedly pending calls are driven through fake work/cleanup deadlines and fail rather than hanging; one persisted driver regression was added without changing production source.
The new acquisition sequence covers exactly the two new files; its appended index entry has fingerprint:null, preserving every old entry/unresolved record. No older diagram, source/test or SVG is edited by this keeper; no old474-file selection identity becomes a new verifier receipt or Native invoice.
The user now explicitly approved an offline diagram profile using tracked `_spec/themes/proveo.puml` only:6238 bytes, SHA-256 `d75f801bd90752ed50243ba05f58b37c4808b5510cbb035dc578b0441d74de39`. This supersedes earlier missing-path status, not the frozen historical statements.
Parent rendering may substitute that exact local copy for the exact house remote-include line in renderer input ONLY; persisted `.puml` files retain their house include. No upstream-byte-equivalence, remote fetch, other include/import or Native-qualified renderer/bootstrap/JRE/font/hard-RSS claim follows.
Parent offline-expanded `plantuml -checkonly -pipe` and `-tsvg -pipe` passed for acquisition, training and arena diagrams, writing only their three approved SVG counterparts below8MiB each. Source include lines remain remote; the exact local-theme substitution is the rendering input, not a claim of equality to current upstream theme bytes.
Each SVG starts with a provenance comment binding its diagram source SHA-256, approved local-theme SHA-256 and expanded-input SHA-256; those comments are rendering metadata, not independently authenticated execution evidence.

| Current offline-render artifact | Source SHA-256 | SVG SHA-256 |
| --- | --- | --- |
| `_spec/tooling/native-ingress/acquisition.svg` | `5c00f3613494cced394bea84ecb3d4cd09dd6195c4c5c12d31119cf1215f62ee` | `44d8b27d7f33e964bf320590383e5c475bfabbeb7a531b457af1281068ca79d8` |
| `_spec/packages/training/burn-compat.svg` | `45298e8a226334a255522baef397bb04460b078bccd53620aacad162efd31721` | `8b061c513200970c5864c5baeb3ad42cb77cf84f569ff17162935d7786f63b91` |
| `_spec/apps/arena/burn-compat.svg` | `94ad3c1ec3167c2cc5e1ccc0eb090ecdb7f04fbd34bde17ffb0997be0cf57e7b` | `e0dab04234c9a63524816e77fa712a126f39708c2ef34e57a4a5ae3e05d03f76` |

The existing474-input verifier identity changes from `e916a646c50a15c12b8e890fc5db4dffe95d6c92c4b9d353774491784f1d39dc` to `747f660473cc875224f371cf3852b2d8debad13d515c6d5f7e01253c668f84bf` solely through the spec index and two existing Rust diagram metadata edits; the other471 inputs remain unchanged. This repository-only port of the identity calculation is not a Rust verifier run or reissued receipt.
The two new source/test files sit outside that old selection and have separate identity `5521a1f7eeeac28680482c92727a286e8283854e36292050130b6e73475d0b29`, using sorted UTF-8 paths followed by file bytes with each field prefixed by its unsigned64 big-endian byte length.
Oxlint remains skipped because no approved binary is available; no installation or substitute lint PASS is claimed. This keeper does not independently rerun parent tests, rendering or hashes.
The original adversarial reviewer closed the diagram MEDIUM for the explicitly approved offline-theme profile; it does not supply upstream-theme equivalence, Rust compilation or Native qualification. A subsequent stale training-diagram legend was corrected before final rendering. Rust WIP `166a0bd9`, eight uncompiled/unrun new Rust tests and the Rust BLOCKER remain OPEN, with unchanged Cargo/Burn baseline; notes last published `5aab9bb8`, PR50 OPEN/unmerged.
Earlier query/HEAD permissions remain CONSUMED; real archive acquisition approval remains NONE, with no SDK body/staging/extraction/install or no-Python/Native qualification. §10 stays OPEN, step2 NOT DONE; scoped offline-unit verification never means a complete ML runtime or `trainingReady:true`.

## 25. Real GNU2026 DATA_ONLY acquisition proposal — fresh grant pending

**[Unverified] Proposed operation, not an archive receipt or executable qualification.**
The user's `continue` authorizes preparation, not the archive GET or staging writes. Repository checks found a clean checkout at `ed46e5ce7f9d8552e93a1ee725d4b9656c1ce4f0` before this proposal was added.
Architect and DevOps reviewed the operation boundary before authoring. This is non-trivial infrastructure/security/spec-impacting planning; production source, tests, diagrams and existing receipts remain unchanged.

### 25.1 Exact source, descriptor, paths and effects

The authored repository import chain is `acquisition.mjs -> custody.mjs -> input-descriptor.mjs`. Node evaluates entire imported modules, including top-level intrinsic/constant initialization; selected exports do not restrict evaluation to those functions.
The launcher uses `node:fs`, `node:crypto` and `node:util`; the imported modules additionally use `node:path` and `node:https`. These source pins do not inventory Node built-ins, the executable, PATH resolution, preloads/loaders, package discovery, native libraries, trust stores or other runtime/OS inputs.

| Repository source relative to `/tmp/opencode/f9-bootstrap-correspondence/` | Bytes | SHA-256 |
| --- | ---: | --- |
| `tooling/native-ingress/acquisition.mjs` | 17183 | `6b04bc8adf0535986393dc5d98b2899024751df00494d5bc42a09a67f2b34172` |
| `tooling/native-ingress/custody.mjs` | 11081 | `6a23185c1217132eb2286b76a215d793ea06bbca8e23b3f1367978d4cdebde33` |
| `tooling/native-ingress/input-descriptor.mjs` | 1301 | `bc7516d1b604a1bd3f6a83acecacba9a288796d1d19544edecddd2ab44c6b767` |

The fixed artifact is `https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/x86-64--glibc--stable-2026.08-1.tar.xz`, comparison length `102296280`, expected SHA-256 `cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3`. These expectations come from published/advertised metadata, not an observed payload.
The only proposed staging root is `/tmp/opencode/f9-gnu-2026-data-only-01`; its only authored file is `/tmp/opencode/f9-gnu-2026-data-only-01/x86-64--glibc--stable-2026.08-1.tar.xz`.
Neither path has been inspected or created for this proposal. The helper must create the root exclusively0700 and file exclusively0600, and stop if creation fails. It must not inspect/reuse/repair an existing root, change the suffix, overwrite, resume, delete, chmod or retry. Ordinary filesystem failures can surface as `E_IO`, not necessarily a top-level native errno.
Fresh approval would permit this exact operation's source reads, dynamic module/runtime loading, one UID query, exclusive root/file creation, bounded archive writes/readback/metadata checks and closures. It would permit at most one reached authored `https.request` GET plus `request.end`; failure before GET still consumes the approval.
It would not permit another HEAD, source acquisition, credentials/environment/proc/cache/library inspection, archive listing/decompression/extraction/execution, installation, Rust invocation, training, deployment or cleanup. No external launcher, receipt or log file is authored; stdout carries the operation record.

### 25.2 Exact launcher proposal — do not execute without fresh approval

Run the command below once through the shell tool in `/tmp/opencode/f9-bootstrap-correspondence`, with tool timeout `180000` milliseconds and no background mode. The harness resolves the existing `node` command; no executable discovery or substitute follows failure.
The launcher checks literal source sizes/hashes before the fixed absolute import, then checks the frozen exact artifact descriptor before its sole acquisition call. This is hash-before-import checking, not immutable-source loading or a race-free source closure.

<!-- BEGIN GNU2026 DATA ONLY LAUNCHER V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

const profile = 'real-gnu2026-data-only-once-v1';
const base = '/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/';
const root = '/tmp/opencode/f9-gnu-2026-data-only-01';
const expected = Object.freeze({
  name: 'x86-64--glibc--stable-2026.08-1.tar.xz',
  url: 'https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/x86-64--glibc--stable-2026.08-1.tar.xz',
  byteLength: 102296280,
  sha256: 'cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3',
});
const pins = [
  ['acquisition.mjs', 17183, '6b04bc8adf0535986393dc5d98b2899024751df00494d5bc42a09a67f2b34172'],
  ['custody.mjs', 11081, '6a23185c1217132eb2286b76a215d793ea06bbca8e23b3f1367978d4cdebde33'],
  ['input-descriptor.mjs', 1301, 'bc7516d1b604a1bd3f6a83acecacba9a288796d1d19544edecddd2ab44c6b767'],
];
const codes = new Set(['E_INPUT', 'E_PLATFORM', 'E_IO', 'E_ROOT', 'E_FILE', 'E_METADATA',
  'E_BINDING', 'E_LENGTH', 'E_HASH', 'E_CHUNK', 'E_HTTP', 'E_HEADERS', 'E_NETWORK',
  'E_NETWORK_CLEANUP', 'E_LIMIT', 'E_DEADLINE', 'E_CLOSE', 'E_SOURCE_PIN',
  'E_DESCRIPTOR', 'E_RESULT', 'E_LAUNCHER']);
const flags = ['nativeAuthority', 'nativeQualified', 'provenanceVerified',
  'pythonFreeSubsetVerified', 'installedUsability', 'rustReady', 'trainingReady',
  'installationPerformed', 'immutabilityVerified'];
let acquisitionCalled = false;

function stop(code) {
  const error = new Error();
  error.code = code;
  throw error;
}
function own(value, key) {
  if (value === null || typeof value !== 'object' || types.isProxy(value)) return undefined;
  const field = Object.getOwnPropertyDescriptor(value, key);
  return field && Object.hasOwn(field, 'value') ? field.value : undefined;
}
function emit(value) {
  try {
    const text = JSON.stringify(value) + '\n';
    if (!/^[\x20-\x7e\n]*$/.test(text) || Buffer.byteLength(text) > 16384) {
      process.exitCode = 1;
      return;
    }
    process.stdout.write(text);
  } catch { process.exitCode = 1; }
}
process.stdout.on('error', () => { process.exitCode = 1; });

try {
  for (const [name, size, expectedSha256] of pins) {
    const bytes = fs.readFileSync(base + name);
    if (bytes.length !== size || createHash('sha256').update(bytes).digest('hex') !== expectedSha256)
      stop('E_SOURCE_PIN');
  }
  const helper = await import('file:///tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/acquisition.mjs');
  const descriptor = helper.GNU2026_ARTIFACT;
  if (!descriptor || !Object.isFrozen(descriptor) || Reflect.ownKeys(descriptor).length !== 4 ||
      Object.entries(expected).some(([key, value]) => own(descriptor, key) !== value) ||
      typeof helper.acquireGnu2026 !== 'function') stop('E_DESCRIPTOR');
  acquisitionCalled = true;
  const result = await helper.acquireGnu2026('/tmp/opencode/f9-gnu-2026-data-only-01');
  const file = root + '/' + expected.name;
  if (own(result, 'profile') !== 'ordinary-archive-acquisition-v1' || own(result, 'state') !== 'DATA_ONLY' ||
      own(result, 'contentMatched') !== true || own(result, 'root') !== root || own(result, 'file') !== file ||
      own(result, 'byteLength') !== expected.byteLength || flags.some(key => own(result, key) !== false) ||
      ['expectedSha256', 'incomingSha256', 'readbackSha256'].some(key => own(result, key) !== expected.sha256))
    stop('E_RESULT');
  const devices = {};
  for (const key of ['rootDevice', 'fileDevice']) {
    const value = own(result, key);
    if (typeof value !== 'string' || !/^[0-9]{1,20}$/.test(value)) stop('E_RESULT');
    devices[key] = value;
  }
  const counts = {};
  for (const key of ['fsCalls', 'requestCalls', 'networkCalls', 'lifecycleEvents', 'dataEvents',
    'clockReads', 'copiedBytes', 'writtenBytes', 'readBytes', 'closeAttempts', 'peakOwnedFds']) {
    const value = own(own(result, 'counts'), key);
    if (!Number.isSafeInteger(value) || value < 0) stop('E_RESULT');
    counts[key] = value;
  }
  emit({ profile, status: 'DATA_ONLY', grantConsumed: true, acquisitionCalled, root, file,
    url: expected.url, byteLength: expected.byteLength, contentMatched: true,
    expectedSha256: expected.sha256, incomingSha256: expected.sha256, readbackSha256: expected.sha256,
    ...devices, counts, ...Object.fromEntries(flags.map(key => [key, false])) });
} catch (error) {
  process.exitCode = 1;
  const errors = [];
  for (let depth = 0; depth < 4 && error !== undefined; depth++) {
    const code = own(error, 'code');
    errors.push(codes.has(code) ? code : 'E_LAUNCHER');
    error = own(error, 'cause');
  }
  emit({ profile, status: 'STOP', grantConsumed: true, acquisitionCalled, root,
    errors, ...Object.fromEntries(flags.map(key => [key, false])) });
}
NODE
```
<!-- END GNU2026 DATA ONLY LAUNCHER V1 -->

### 25.3 Output, source-accounted bounds and accepted-residual decision

The launcher authors at most one ASCII JSON stdout record <=16384 bytes including LF, built from explicit fixed/scalar fields. It emits at most four allowlisted error-code labels; it never serializes error objects, native messages, stacks or arbitrary causes. Unknown codes map to `E_LAUNCHER`.
It uses `process.exitCode`, not `process.exit`, signals or forced termination. It attempts no fallback write after serialization/output failure. Success requires the expected complete record and observed zero command exit status; a successful write call alone does not prove stdout delivery, process exit, physical closure or reaping. Startup diagnostics/tool framing sit outside the JSON bound; absent/truncated/uncertain output means STOP without retry or inspection.
All failures consume the operational grant, including source-pin, descriptor, creation, network, digest/readback or output failure. `acquisitionCalled` distinguishes whether the helper call was reached, not whether a physical request occurred.
Preserve the root and any partial/full file after every outcome. No automatic retry, root replacement, deletion, repair, extraction or response-driven next action follows success or failure.

| Scope | Bound / limit |
| --- | --- |
| Proposed archive file | <=102296280 written bytes, same exact positional readback plus EOF; filesystem allocation/metadata is not a byte quota |
| Helper lifecycle | 120s cooperative total,119s ordinary work + reserved1s cleanup; early-failure cleanup min(total end, failure time+1s) |
| Helper payload | <=32768 data events; positive chunk <=1048576;64KiB readback scratch; no whole-archive array |
| Helper accounted effects | <=65533 non-close FS calls +<=3 close attempts; peak2 managed file FDs;<=200000 clock reads;<=32 lifecycle events;<=4 explicit network methods |
| Launcher preflight/runtime | Three authored source readFileSync calls before dynamic import; source hashing, module loading/startup, stdout and runtime operations sit OUTSIDE helper counts/clock |
| Shell capture | Requested timeout180000ms; not verified native containment, termination or reap |

Fresh approval must explicitly accept ordinary inherited PATH/Node/startup/preload/loader/environment/runtime/native-library/trust-store behavior without inspection or sanitization. Source bytes can change between hash checks and module loading; source preflight reads themselves rely on the trusted repository and have no adversarial file-size/I/O-time containment.
DNS/TLS/socket behavior, possible environment-mediated proxy/interposition, internal attempts, buffering, callbacks outside admitted accounting, total RSS, blocked native filesystem calls, physical close and complete executable/source closure remain unqualified. Requested TLS/agent/headers and cooperative counters do not establish independent network or OS isolation.
The ordinary operation cannot claim Native/F9 authority or borrow any original game allowance. Preserve Rust1.95.0, Burn=0.22.0 Flex CPU/f64/defaults-off/std,flex,optim,store, NoPython, all ledgers/labels, F1/shared inclusive1048576, cold10s/lifecycle300s including3s cleanup and generator2048.

### 25.4 Registration, review and post-operation gate

Before requesting approval, syntax-check the extracted launcher without evaluating it, compare literal source pins against repository bytes, and register the exact shell-command SHA-256 plus complete §25 SHA-256 in the TUI request after static reviews. Any command/source/path/bound change invalidates that approval.
No proposal launcher, real archive GET, large staging write or target-root probe has run. Previous HEAD/query grants remain consumed. Syntax-only parsing passed without evaluating the extracted body; all three literal source sizes/hashes match repository bytes, and §§1–24 remain byte-preserved. Static adversarial/security/DevOps reviews accepted this proposal only with no findings, and spec review reported in-sync. Exact-command/section registration and fresh execution consent remain pending; no new runtime verification follows from these checks.
If separately approved, execute once, retain the captured bounded record without a separate disk log, and record the result in a later canonical section. Successful incoming/readback matching remains DATA_ONLY only.
Then separately qualify bounded archive inspection, a Python-free retained subset, relocation/preparation and actual ELF/loader/library/ISA closure before any installation/use. Offline Cargo/dependency/build containment and current Rust compilation/tests remain independent blockers. No training, activation, deployment, working-architecture acceptance or retained-cache/doc cleanup follows.

## 26. Real GNU2026 acquisition receipt — DATA_ONLY match, grant consumed

**[Unverified] Ordinary-host operation evidence, not independent authenticated execution, Native qualification or SDK usability.**
The user selected `Approve acquisition once` for §25's exact network/filesystem operation and disclosed residuals. The approved complete §25 is13530 UTF-8 bytes, SHA-256 `93968ad6c82f2074edf72e1ca5d209698ed302cc5df4c4df1875d2de961e8654`; the4823-byte shell command is `3822bffcac3fc69617cc2c299409ac0fffbfce2495375df51abf56d8a11a7812`.
The4784-byte JavaScript body is `481732b69f67c7f4b827ff63282fca9ec5c729dfc85d8c336a5aa9aaff90cece`. Immediately before launch, repository-only checks matched the canonical document `2a6de2a8139b3b51f12e2e909c51b66afdd6e43cfbf30a776da8682ad9c3cf8a`, approved section and exact command.
The registered command ran once in `/tmp/opencode/f9-bootstrap-correspondence`, with shell-tool timeout180000ms and no background mode. The tool returned normally with the complete DATA_ONLY stdout record and no timeout/nonzero-exit report. Its inherited Node startup also emitted an experimental EnvHttpProxyAgent warning outside the JSON record; the proposal explicitly excluded startup diagnostics from the stdout-record bound.
The following compact JSON copies the authored stdout record, not HTTP-wire bytes or an authenticated process transcript:

```json
{"profile":"real-gnu2026-data-only-once-v1","status":"DATA_ONLY","grantConsumed":true,"acquisitionCalled":true,"root":"/tmp/opencode/f9-gnu-2026-data-only-01","file":"/tmp/opencode/f9-gnu-2026-data-only-01/x86-64--glibc--stable-2026.08-1.tar.xz","url":"https://toolchains.bootlin.com/downloads/releases/toolchains/x86-64/tarballs/x86-64--glibc--stable-2026.08-1.tar.xz","byteLength":102296280,"contentMatched":true,"expectedSha256":"cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3","incomingSha256":"cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3","readbackSha256":"cde893afab04ac7dcd15c46aac214ff550441b982536124c88a71146a0eeedd3","rootDevice":"28","fileDevice":"29","counts":{"fsCalls":14370,"requestCalls":1,"networkCalls":2,"lifecycleEvents":4,"dataEvents":12788,"clockReads":70260,"copiedBytes":102296280,"writtenBytes":102296280,"readBytes":102296280,"closeAttempts":3,"peakOwnedFds":2},"nativeAuthority":false,"nativeQualified":false,"provenanceVerified":false,"pythonFreeSubsetVerified":false,"installedUsability":false,"rustReady":false,"trainingReady":false,"installationPerformed":false,"immutabilityVerified":false}
```

### 26.1 What this operation establishes

Repository-only validation confirmed the approved complete §25 and earlier canonical bytes remain unchanged. The compact stdout-record copy including storage LF is1163 bytes, SHA-256 `be1a18eb95b528156ad008bf7f4739cfa89c6ddda6da69ef281c0c82e2a9ff50`; this is copy-integrity metadata, not authenticated HTTP or process evidence. Validation parsed the repository copy without accessing the retained archive or root.

The helper returned after exact incoming length/SHA-256 match, observed network end/completeness/request+response closure, writer checks/closure, independent positional readback+EOF/SHA-256, stable file metadata, root binding and three successful managed-FD close attempts. These are source-bound observations under the approved runtime trust, not independent physical-close or OS-barrier evidence.
The observed source counts fit §25:14370 non-close filesystem calls,1 request call,2 explicit network methods,4 lifecycle events,12788 admitted data events,70260 clock reads,3 close attempts and peak2 owned file FDs. Copied, written and read bytes each equal102296280.
The root's device28 and file's device29 are independent per-object observations. They do not imply a parent/child same-device requirement, explain historical staging failures or establish future path protection.
This closes the separately approved incoming/readback DATA_ONLY match for this exact archive instance. It does not make §23's earlier advertised length an observed length retroactively; this later operation adds separate observed length/hash evidence.
The source pins are unchanged from §25. No acquisition source/API/test/diagram changes or fresh Rust/static-analysis pass accompany this receipt; the217-test offline verification remains the revision-scoped evidence in §24.

### 26.2 Consumed grant, retained archive and next boundary

The one-shot acquisition grant is CONSUMED. Retain `/tmp/opencode/f9-gnu-2026-data-only-01` and its exact archive without any follow-up read, stat, listing, decompression, extraction, modification, removal, retry or alternate-root operation under this grant.
No archive contents have been listed or decoded. The authored operation extracted, installed or executed no Python, GDB, GCC, sysroot component or SDK setup script from the archive. Installed usability, provenance, Python-free subset, immutability, Native authority, Rust readiness and training readiness remain false/unqualified.
Any next inspection needs a separate exact plan and approval covering its reader/decompressor source/runtime, bounded compressed/uncompressed bytes, entry/path/link/header limits, output policy and failure behavior. Acquisition alone does not select an extractor, authorize a tool search or qualify a local decompressor.
The source-level whole-SDK/GDB-Python and relocation/wrapper concerns in §22 remain unresolved for actual payload inventory. Do not apply vendor relocation scripts, follow archive links, install the whole SDK or infer a Python-free subset from the content digest.
After separately approved bounded inspection, qualify any retained no-Python subset, preparation/relocation and actual ELF/loader/library/symbol/ISA closure before use. Current Rust compilation/tests remain a binding BLOCKER; §10 working-architecture acceptance, real training, activation/deployment and retained-cache/doc cleanup remain ineligible.
Receipt-copy validation passed. Closing adversarial/security reviews accepted the receipt documentation only with no findings; spec review reported in-sync. No commit, push, PR merge, cleanup or next external operation is authorized by this continuation.

## 27. Offline TAR inventory — verified offline unit, real inspection unapproved

**[Unverified] Implemented offline source unit with parent-run synthetic tests, not an archive inspection or decoder qualification.**
The user selected `Offline Node units (Recommended)` after being offered offline implementation, decoder-qualification planning or hold. This grants new parser/controller source, persistent synthetic in-memory tests and matching specs only.
Architect `ses_e947186ddffe5oZc5z4IRAl2eX` revised the plan to runnable manifest-free Node helpers; DevOps `ses_e947186a6ffe80QZqTu0d4GDz1` reviewed the separate decompressor boundary. Do not introduce an unverified Rust bootstrap, Cargo workspace, dependency or installation step.

### 27.1 Goal, file plan and exclusions

Add `tooling/native-ingress/tar-inventory.mjs` plus `tar-inventory.test.mjs` for streaming TAR validation, provisional metadata events and a bounded summary/digest.
Add `tooling/native-ingress/inventory-controller.mjs` plus `inventory-controller.test.mjs` for pull/backpressure, sink acceptance, mock completion, deadlines and bounded failure cleanup.
Both modules must remain manifest-free Node-builtins infrastructure. Reuse the existing directory without changing acquisition/custody APIs, sources/tests or any Rust, TypeScript engine, dataset, label, ledger, F1 or game allowance.
New tests use generated in-memory bytes only, <=1MiB per synthetic fixture. No file fixtures, filesystem inventory, archive read/stat/list/decode, network, listener, subprocess, tool discovery, decoder, extraction, Python, Rust invocation or package installation is authorized. Repository reads for source/SPEC/index checks are not archive or fixture access.
Do not run the older acquisition/custody fixture suites under this new in-memory-only grant. Their217 passes remain the prior revision-scoped receipt, not a fresh verification result for this unit.
Parent owns `_spec/tooling/native-ingress/inventory.puml`, exact four-file coverage in `_spec/.spec-index.json`, this goal/evidence ledger and main-plan navigation. Keep §§1–26 and the existing uncommitted acquisition receipts intact.

### 27.2 Current parser contract and conservative profile

`createTarInventory(overrides)` returns a sealed interface with incremental `feed(bytes)` and terminal `finish()`, whose frozen summary has state `TAR_INVENTORY`. Accept native ordinary-backed Buffer/Uint8Array chunks; reject proxies/shared backing and use private bounded bytes rather than shadowable `.length` values. Capture strict own-data limit overrides once; allow tightening only.
Malformed input permanently poisons the parser; later `feed`/`finish` cannot recover a successful result. Successful `finish` seals it; reject repeated finish and later feed. Serialize numeric metadata losslessly, including PAX time fractions, rather than converting large fields through imprecise Number values.
Validate512-byte basic/POSIX ustar/old-GNU headers, unsigned checksums and explicitly supported nonnegative octal/base256 numbers. Support regular files, directories, symlinks and hardlinks as metadata only; unsupported member kinds, sparse layouts or encodings STOP without fallback.
Support GNU longname/longlink and POSIX local/global PAX only within the bounded subset `path,linkpath,size,uid,gid,uname,gname,mtime`. Validate PAX UTF-8 byte-counted records, duplicate/deletion/precedence semantics and extension padding; reject unknown keys. Actual SDK-format compatibility remains unproved.
Apply global PAX, then pending GNU names/links, then local PAX; consume pending local/GNU state at the following member and reject dangling/ambiguous extensions. Extension record bodies use their own physical sizes, not pending member-size overrides.
The bounded profile must define empty-value deletion explicitly: a global empty record removes that persistent key; a local empty record selects the ordinary member header's value for that key, masking global/GNU overrides for that member without deleting persistent defaults for later members. Unsupported deletion forms must fail, not silently fall through another extension layer.
Accept explicitly defined `./` prefixes, directory root `.`/`./` and a directory's final slash; reject absolute member paths, internal empty/dot/parent segments, ambiguous separators/controls and canonical-name collisions. These alias rules do not silently normalize arbitrary unsafe paths.
The alias grammar permits at most one leading `./` and at most one final slash for a directory; strip only those allowed aliases before checking nonempty slash-separated segments. Root directory `.` and `./` share one root key. Reject `././name`, `name//child`, internal `.`/`..`, file trailing slash and repeated slash aliases. Keys remain case-sensitive UTF-8 without Unicode, URL or filesystem normalization.
Link targets remain bounded classified metadata, including relative-parent or absolute targets; never follow them or treat them as extraction permits. A TAR-inventory result cannot certify extraction safety or a Python-free subset.
Count and discard ordinary contents/padding. Require zero padding, two complete zero termination blocks, block-aligned zero-only trailing data and exact completion; reject truncation and any late invalid bytes. Provisional events from a prefix never become a successful inventory after later failure.
Charge all extension payload, including overwritten/deleted records, against the cumulative cap. Charge UTF-8 canonical collision keys and JSON+LF metadata before retaining or emitting them.

The metadata-event schema uses this property insertion order: `index,path,type,size`, then `linkpath,linkKind` ONLY for link entries, then `mode,uid,gid,mtime`. No extra fields or member contents appear. `index` is a one-based logical-entry Number; `type` is `file|directory|symlink|hardlink`; paths are validated UTF-8 strings and canonical collision keys.
`size,mode,uid,gid` are nonnegative safe-integer Numbers; reject unsupported larger integer fields rather than round them. Header mtime becomes its exact base10 integer string; accepted PAX mtime retains its validated decimal text, including sign/fractional digits, without floating-point conversion. `uname,gname` can be consumed as supported extension metadata but never appear in events.
`linkKind` is `absolute` for slash-rooted/drive-prefixed targets, otherwise `parent-components` when any slash-separated component is `..`, otherwise `relative`. This classification does not resolve targets or certify containment.
Digest framing is SHA-256 over the ordered concatenation of UTF-8 `JSON.stringify(event) + '\n'`, without indentation, BOM, summary/header framing or payload bytes. Charge the same serialized bytes to event/output limits. An empty inventory hashes the empty byte string; different accepted PAX time spellings may yield different metadata digests even when numerically equal.

| Current maximum | Value | Interpretation |
| --- | ---: | --- |
| Expanded bytes | 1073741824 | All headers, extensions, contents, padding and termination bytes |
| Physical headers | 65536 | Extension headers count; logical entries tracked separately |
| Cumulative extension payload | 65536 | PAX/GNU buffering never expands to arbitrary member size |
| Effective path / link target | 1024 bytes each | UTF-8 byte count, not JavaScript character count |
| Input chunk / data events | 1048576 bytes /32768 | Admit before copy/parse; no zero chunks |
| Serialized event / cumulative output | 32768 /16777216 bytes | Canonical JSON+LF, admitted before provisional emission |
| Retained collision-key data | 33554432 bytes | Plus bounded header/extension state; not a hard heap/RSS quota |

These conservative caps have unverified SDK fitness. Exceeding one or encountering an unsupported feature stops; it does not authorize raising limits or invoking a fallback parser.

### 27.3 Mock controller and failure contract

`runMockInventory` executes a trusted caller's mock source/sink protocol. Caller callbacks are code, not a sandbox: mock markers and completion booleans cannot enforce capability denial or authenticate a decoder.
The source is an exact own-data plain record `{mockOnly:true,next,return}` with non-proxy functions; capture its callbacks before invocation. Each next result is an exact `{done,value}` record. Data requires `done:false`; terminal `done:true` requires exactly `{mockOnly:true,integrityVerified:true,compressedInputFullyAccountedFor:true}` as its value. Sink acceptance means its returned value/promise fulfills; returned qualification objects are ignored.
Pull one chunk at a time; finish its bounded parser events and awaited sink acceptance before requesting another chunk. Require terminal TAR validity, explicit mock integrity/compressed-EOF completion and accepted sink work before a frozen `MOCK_INVENTORY` summary.
Keep `mockOnly:true`, `decoderQualified:false`, `realArchiveInspected:false`, `extractionAuthorized:false`, `nativeQualified:false`, `provenanceVerified:false`, `pythonFreeSubsetVerified:false`, `installedUsability:false`, `rustReady:false` and `trainingReady:false`. The parser's summary/digest binds metadata interpretation, not a real compressed archive or publisher.
Use a120s cooperative controller envelope including reserved1s cleanup,119s ordinary work and early-failure cleanup bounded by min(total end, failure time+1s). These are source timers, not hard cancellation of synchronous parsing, arbitrary callbacks, native work, process memory or the original F9/game clocks.
Make failure absorbing. On failure call acquired iterator return at most once and wait only within the reserved cleanup bound; uncertain/rejected cleanup overrides the original failure through a fixed cleanup error with cause. Ignore/handle late promise results without more pulls, parser effects, sink calls or success.
An accepted mock terminal receipt closes the source contract before parser finalization, so later TAR-finalization failure does not call return on that already completed source. Without accepted completion, cleanup runs only if acquired and within the total remaining budget; an expired budget yields `E_SOURCE_CLEANUP` uncertainty without invoking a late cleanup callback. No real-resource closure follows from these mock rules.
`MOCK_INVENTORY_LIMITS` adds duration/cleanup caps and `maxSourceEvents:32768` to parser caps; overrides can tighten only. Source-event accounting counts chunk steps, permitting at most one extra next call to observe completion or reject an excess step. The controller uses Node's monotonic `performance.now()` and timers; caller code and synchronous parsing remain non-preemptible.
No child is spawned; no signal, kill/reap claim, filesystem cleanup or actual decoder adapter belongs in this source unit. The acquired SDK remains untouched with its §26 grant consumed.

### 27.4 Verification and later gates

Persist synthetic tests for chunk splits, all three supported header dialects/numbers, PAX/GNU precedence/deletions, unsafe paths/aliases/link classification, duplicate names, unsupported formats, checksums, padding, truncation and every tightened cap boundary.
Persist controller tests for backpressure, malformed/mock completion, source/sink/parser failure, late rejection, timeout, cleanup uncertainty and no success before all gates. Use coordinated fake clocks/timers and bounded settlement assertions, not real120s waits.
The parent independently passed all four new-file syntax checks and **378/378 tests:305 parser +73 controller,0 failures/cancelled/skipped/todo**. Command: `node --test --test-reporter=tap --test-concurrency=1 --experimental-test-coverage tooling/native-ingress/tar-inventory.test.mjs tooling/native-ingress/inventory-controller.test.mjs`. Only these two in-memory suites ran.
Both production modules have100% line/function coverage; branch coverage is98.85% parser and98.82% controller. These figures do not verify a real archive, decoder or native resource boundary. Oxlint remains unavailable and skipped; no install permission, replacement linter or lint PASS is claimed.
Review-driven repairs reject octal digits after a NUL terminator, including leading-NUL fields and trailing control-byte partial matches. Regression vectors cover all numeric fields and checksum encodings. Deferred controller tests now use fake clocks and assert timer drainage; a new controller regression rejects nonzero trailing bytes after provisional sink delivery.
The persisted literal UTF-8 JSON+LF oracle fixes file/link event property order, byte counts and digest framing independently of the parser's event construction. The source-contract test reads all four SPEC pointers, diagram covers and exact index entry; it does not access file fixtures or the archive.
The user separately approved offline validation/rendering of the new inventory diagram only, using pinned `_spec/themes/proveo.puml` (6238 bytes, SHA-256 `d75f801bd90752ed50243ba05f58b37c4808b5510cbb035dc578b0441d74de39`). Keep the remote house include in source, substitute that local copy only in renderer input and reject other active external-input directives. Permit only `_spec/tooling/native-ingress/inventory.svg` <=8MiB; accept ordinary installed renderer/JRE/font startup trust, not Native qualification, upstream-theme equivalence, network access or hard containment.
Parent offline-expanded `plantuml -checkonly -pipe` and `-tsvg -pipe` passed after final source mapping. The47320-byte SVG binds diagram SHA-256 `414cb596a874981b00d5625d422a2edfe9e10d8877974982820b337358fe76bd`, expanded-input SHA-256 `a049544711b464ffee6d1922f1909a81fe1aaac0e044bba29d1f167c36731902` and approved theme hash in its provenance comment; SVG SHA-256 is `1b35f61dc6a631231a7b7630370cfdbd9b4d25acf65325a8285e52a026030f62`. No remote theme was fetched or older SVG changed.
Closing adversarial review closed the octal MEDIUM and prior goal ambiguities with no new findings. DevOps closed the deferred-test timer LOW; security accepted the offline unit only, and spec review reported in-sync. Reviews grant no actual archive access, decoder qualification or Rust/Native readiness.
The four new source/test files have separate identity `cb23eafbea12965e97969f2b003981404fddc077f4ed1a3eda826f9d8a4f324d`, using sorted UTF-8 paths followed by file bytes, with each field prefixed by its unsigned64 big-endian byte length. Production SHA-256 values are parser `9357f3d33859df02f78d377403ed2cc9cad6d8867a7fddc4d24c57ef5c75c55e` and controller `655b100185220c165fc38e990e90c46e5f9c3407a75d6eb73530000786ae1254`.
The sole coverage-index change appends the exact four-file inventory entry while preserving every prior entry/unresolved record. That metadata change invalidates reuse of the earlier selected verifier identity as current evidence; no current Rust verifier run or reissued Native invoice is claimed. Existing tracked source/configuration files and prior acquisition proposal/JSON receipt remain unchanged.
The offline unit cannot read XZ or qualify a decompressor. Exact tool discovery/qualification, compressed-FD custody with hashing of bytes actually decoded, XZ integrity/stream/trailing-data policy, decoder memory limits, bounded stderr and process lifecycle require separate designs and fresh operational approval.
Rust compilation/tests remain a binding BLOCKER; successful mock tests never close NoPython/ELF/relocation/build-containment gates or permit training, activation, deployment, archive cleanup, commit/push or PR merge.

## 28. XZ candidate identity proposal — fixed path, decoder execution forbidden

**[Unverified] Prospective `/usr/bin/xz` identity check, not a discovered or qualified decoder.**
The user requested `commit & push then continue`. The reviewed nine-file change was committed/pushed as `8f7f0933e32fb51b92d92739298cfeba4224c57b`; fresh pre-commit verification passed378 in-memory tests and four syntax checks. PR50 remains OPEN/unmerged, targeting `feat-ml-adjuntant`.
The publication scope ended at that commit. This continuation prepares a separate host-file read proposal; no candidate stat/read, PATH search, link resolution, decoder invocation or SDK archive access follows from `continue`.
Architect `ses_e94112164ffec22ZueXS2ndqyD` and DevOps `ses_e9411215dffeGxJAhLvE2FGmN6` reviewed the boundary before authoring. Classify this as non-trivial infrastructure/security/spec-impacting planning, with no production API/source/test change.

### 28.1 Literal candidate and narrow evidence goal

The sole prospective path is `/usr/bin/xz`. Its existence, type, contents, version, provenance and usability are UNKNOWN. This choice names a conventional candidate, not an observation or search result.
Fresh approval would permit two named lstats of exactly that path, one no-follow/nonblocking read-only open, two owned-descriptor fstats, bounded positional reads/EOF, hashing, basic ELF-header interpretation, and exactly one close attempt when a descriptor was acquired.
Require a regular file, UID0, nlink1, owner-executable bit, no setuid/setgid/sticky bits, no group/world write bits, and size64..1048576. These are conservative selection gates, not authenticity proofs; legitimate hardlinks, scripts or different binary layouts STOP without fallback or repair.
Bind the initial named snapshot, opened descriptor snapshot, final descriptor snapshot and final named snapshot across `dev,ino,mode,uid,gid,nlink,size,mtimeNs,ctimeNs`. Do not compare a file device with a parent device. Do not query parent directories or resolve symlinks; ancestor resolution remains trusted, not proven symlink-free or protected.
Read the complete accepted file through the owned FD, at exact positions in <=64KiB slices, plus one byte requested at recorded EOF. Stop on short read, nonempty EOF, metadata change or close uncertainty, without retry. Observe SHA-256 of those bytes; no independently authenticated expected candidate hash exists yet.
Interpret only the first64-byte ELF header: magic, ELF64/little-endian/version1, machine62, ET_EXEC or ET_DYN, and64-byte header size. Do not parse program/section headers, PT_INTERP, dynamic tags, DT_NEEDED, RPATH/RUNPATH or symbol versions, follow any derived paths, invoke a loader or infer minimum ISA/ABI/library requirements.
The result can be `CANDIDATE_BYTES_OBSERVED`, never `decoderQualified:true`. An ELF-shaped header and full-file digest do not establish a runnable XZ executable, source correspondence, version, provenance or exclusion of compromised origins such as XZ5.6.0/5.6.1.

### 28.2 Exact Node reader proposal — fresh approval required

Run the following command once via the shell tool in `/tmp/opencode/f9-bootstrap-correspondence`, timeout30000ms, foreground only. Plain `node` resolution and its inherited startup/environment/native runtime remain explicit ordinary-host trust; no discovery, inspection or sanitization of those inputs is authored.

<!-- BEGIN XZ CANDIDATE IDENTITY V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const profile = 'xz-candidate-bytes-once-v1';
const candidate = '/usr/bin/xz';
const started = process.hrtime.bigint();
const workEnd = started + 19_000_000_000n, totalEnd = started + 20_000_000_000n;
const counts = { fsCalls: 0, readCalls: 0, requestedBytes: 0, returnedBytes: 0, closeAttempts: 0, clockReads: 1 };
const fields = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs'];
const allowed = new Set(['E_PLATFORM', 'E_METADATA', 'E_POLICY', 'E_BINDING', 'E_IO',
  'E_MISSING', 'E_LENGTH', 'E_ELF', 'E_LIMIT', 'E_DEADLINE', 'E_CLOSE']);
const flags = { decoderQualified: false, realArchiveInspected: false, xzBehaviorVerified: false,
  provenanceVerified: false, noPythonRuntimeVerified: false, loaderClosureVerified: false,
  nativeAuthority: false, nativeQualified: false, installedUsability: false,
  rustReady: false, trainingReady: false };
let fd = null, last = started, failure = null, observation;
function stop(code) { const error = new Error(); error.code = code; throw error; }
function code(error) {
  const value = error && Object.getOwnPropertyDescriptor(error, 'code');
  if (value && Object.hasOwn(value, 'value') && allowed.has(value.value)) return value.value;
  return value && value.value === 'ENOENT' ? 'E_MISSING' : 'E_IO';
}
function guard(final = false) {
  if (counts.clockReads >= 256) stop('E_LIMIT');
  counts.clockReads++;
  const time = process.hrtime.bigint();
  if (typeof time !== 'bigint' || time < last) stop('E_PLATFORM');
  last = time;
  if (time >= (final ? totalEnd : workEnd)) stop('E_DEADLINE');
}
function work(action) { guard(); const value = action(); guard(); return value; }
function io(action) {
  return work(() => {
    if (counts.fsCalls >= 22) stop('E_LIMIT');
    counts.fsCalls++;
    return action();
  });
}
function snapshot(stat) {
  const result = {};
  for (const key of fields) {
    const value = stat[key], time = key === 'mtimeNs' || key === 'ctimeNs';
    if (typeof value !== 'bigint' || value < (time ? -(1n << 63n) : 0n) || value > (1n << 64n) - 1n)
      stop('E_METADATA');
    result[key] = value;
  }
  return result;
}
function same(a, b) { if (!fields.every(key => a[key] === b[key])) stop('E_BINDING'); }
function emit(value) {
  try {
    const text = JSON.stringify(value) + '\n';
    if (!/^[\x20-\x7e\n]*$/.test(text) || Buffer.byteLength(text) > 8192) { process.exitCode = 1; return; }
    process.stdout.write(text);
  } catch { process.exitCode = 1; }
}
process.stdout.on('error', () => { process.exitCode = 1; });
try {
  guard();
  const f = fs.constants;
  if (f.O_RDONLY !== 0 || !Number.isInteger(f.O_NOFOLLOW) || f.O_NOFOLLOW <= 0 ||
      !Number.isInteger(f.O_NONBLOCK) || f.O_NONBLOCK <= 0) stop('E_PLATFORM');
  const initial = snapshot(io(() => fs.lstatSync(candidate, { bigint: true })));
  if ((initial.mode & 0o170000n) !== 0o100000n || initial.uid !== 0n || initial.nlink !== 1n ||
      (initial.mode & 0o100n) === 0n || (initial.mode & 0o7022n) !== 0n ||
      initial.size < 64n || initial.size > 1_048_576n) stop('E_POLICY');
  io(() => { fd = fs.openSync(candidate, f.O_RDONLY | f.O_NOFOLLOW | f.O_NONBLOCK); });
  same(initial, snapshot(io(() => fs.fstatSync(fd, { bigint: true }))));
  const scratch = work(() => Buffer.alloc(65_536));
  const header = work(() => Buffer.alloc(64));
  const hash = work(() => createHash('sha256'));
  const size = Number(initial.size);
  function read(want, position) {
    return io(() => {
      if (counts.readCalls >= 17 || counts.requestedBytes + want > 1_048_577) stop('E_LIMIT');
      counts.readCalls++; counts.requestedBytes += want;
      const count = fs.readSync(fd, scratch, 0, want, position);
      if (!Number.isSafeInteger(count) || count < 0 || count > want) stop('E_IO');
      counts.returnedBytes += count;
      return count;
    });
  }
  let elfHeader;
  for (let offset = 0; offset < size;) {
    const want = Math.min(65_536, size - offset);
    if (read(want, offset) !== want) stop('E_LENGTH');
    if (offset === 0) {
      scratch.copy(header, 0, 0, 64);
      if (!header.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70])) ||
          header[4] !== 2 || header[5] !== 1 || header[6] !== 1 ||
          header.readUInt32LE(20) !== 1 || header.readUInt16LE(18) !== 62 ||
          ![2, 3].includes(header.readUInt16LE(16)) || header.readUInt16LE(52) !== 64) stop('E_ELF');
      elfHeader = { classBits: 64, endian: 'little', version: 1, machine: 62,
        type: header.readUInt16LE(16), headerBytes: 64, osAbi: header[7], abiVersion: header[8] };
    }
    work(() => hash.update(scratch.subarray(0, want)));
    offset += want;
  }
  if (read(1, size) !== 0) stop('E_LENGTH');
  const sha256 = work(() => hash.digest('hex'));
  same(initial, snapshot(io(() => fs.fstatSync(fd, { bigint: true }))));
  same(initial, snapshot(io(() => fs.lstatSync(candidate, { bigint: true }))));
  observation = { byteLength: size, sha256, elfHeader,
    identity: Object.fromEntries(fields.map(key => [key, initial[key].toString()])) };
} catch (error) { failure = [code(error)]; }
finally {
  if (fd !== null) {
    const owned = fd; fd = null; counts.closeAttempts++;
    try { fs.closeSync(owned); } catch { failure = ['E_CLOSE', ...(failure || [])]; }
  }
}
if (!failure) { try { guard(true); } catch (error) { failure = [code(error)]; } }
if (failure) process.exitCode = 1;
emit({ profile, status: failure ? 'STOP' : 'CANDIDATE_BYTES_OBSERVED', grantConsumed: true,
  candidate, ...(failure ? { errors: failure } : { observation }), counts, ...flags });
NODE
```
<!-- END XZ CANDIDATE IDENTITY V1 -->

### 28.3 Source-accounted limits, output and residual trust

The source permits at most22 non-close filesystem attempts: initial lstat, open, initial fstat, up to16 data reads, one EOF read, final fstat and final lstat. An acquired FD receives one unconditional close attempt, assigned before post-open guard and consumed before close. Close uncertainty overrides the operation error; no descriptor retry or other path follows.
Read at most1048576 data bytes, with at most1048577 requested bytes including EOF,17 read attempts, one managed FD,256 clock samples,64KiB scratch plus64-byte header. `returnedBytes` counts bytes reported by completed read calls inside their callback, before post-read guards or validation; it includes any nonempty EOF probe and is not an independently measured native-I/O count. Emit at most one ASCII JSON record <=8192 bytes including LF, with fixed/scalar header fields, lossless decimal metadata strings, counts and allowlisted error labels. No file content, native error text/stack or derived paths appear in output.
Work guards use a19s ordinary deadline and20s total including1s for finalization. They cannot interrupt blocking native I/O/close or enforce hard CPU/RSS/physical-close limits. Node imports/bootstrap precede the first authored clock; output/startup diagnostics and shell-tool framing fall outside the JSON/work accounting. The30s shell timeout does not prove process termination or reap.
Success requires complete expected output and observed zero command exit status, not a write call alone. Missing/truncated/error/uncertain capture means STOP without another probe, signal, retry or cleanup. No receipt/log/launcher file is authored.
Fresh consent must accept inherited PATH/Node resolution, options/preloads/loaders/environment, runtime/native libraries, filesystem/ancestor behavior and source/runtime replacement risks without inspection or sanitization. No candidate code, interpreter or library is loaded by the authored reader; this does not claim zero implicit startup I/O or a fully qualified Node executable closure.
No authored network, external acquisition, candidate `--version`, `ldd`, loader, readlink, directory/PATH search, dynamic ELF dependency traversal, SDK archive access, decompression, extraction, installation, mutation or deletion is included. All failures consume the one-shot grant, including missing/symlink/nonconforming candidates before a read; supplying another literal path requires a new registration and approval.
This ordinary metadata profile changes no original F9/game meter, private source graph, cold10/lifecycle300 including3s cleanup, generator2048, shared inclusive1048576, Rust1.95/Burn=0.22.0 Flex CPU/f64/features, NoPython, labels or ledgers. Candidate bytes/header evidence cannot close the current Rust BLOCKER or training readiness.

### 28.4 Registration, review and next evidence

Syntax-only parsing of the extracted body passed without evaluating it, and §§1–27 remain byte-preserved. Closing adversarial/security/source-level DevOps reviews accepted this proposal only with no remaining findings; spec review reported in-sync. The stale parsing-status LOW and failure-path returned-byte-accounting LOW are closed. Register the exact shell command and complete §28 hashes, then ask fresh consent with approve-this-candidate-once / supply-another-literal-candidate / hold choices. Registration and execution approval remain pending; no candidate probe has run.
If separately approved, retain the bounded captured result in a later canonical section and consume the grant once. No automatic next step follows. A positive result supplies only observed size/digest/stable metadata/header selection; next separately qualify source/provenance and ELF loader/library/symbol/ISA closure before any decoder execution.
Future real archive inspection still needs same-FD compressed hashing/custody, qualified XZ integrity/framing/concatenation/trailing-data and memory policies, bounded output/stderr, process termination/closure evidence and explicit cleanup authority. The verified TAR/mock-controller unit cannot supply that real adapter. The acquired archive and all retained roots remain untouched; no new commit/push or PR merge is included in this proposal stage.

## 29. XZ candidate identity receipt — observed bytes, grant consumed

**[Unverified] Ordinary-host file/header observation, not trusted XZ behavior, provenance, loader compatibility or Native qualification.**
The user selected `Approve candidate read once`, accepting §28's fixed-file scope and inherited Node/PATH/startup/environment/runtime/ancestor trust plus cooperative timing and capture limitations.
The approved complete §28 is13433 UTF-8 bytes, SHA-256 `015df1b0f000dfee359cf153d353f8eab57cf98d1e7ee09138f42fc21481488c`. The5657-byte shell command is `452c3c3af2597f03d81c7a68237547e66f6432e61371b7ab85efd16410eb7dec`; its5618-byte JavaScript body is `29be8de83ac6f549b3767f8dd7406e1271d162c685fc2668ddf9be854f5f35fe`.
Repository-only checks immediately before launch matched canonical document SHA-256 `e71078666376c79e7e860cc4c90958d8e0d4e5ef1cbb47ba65a7424634e3f581`, complete section and command identities. The exact command then ran once, foreground in `/tmp/opencode/f9-bootstrap-correspondence`, tool timeout30000ms.
The tool returned normally with the complete expected stdout record and no timeout/nonzero-exit report. An inherited Node EnvHttpProxyAgent experimental warning appeared outside the JSON record, within the disclosed startup residual. The following compact JSON copies the authored record, not an authenticated process/native-I/O transcript:

```json
{"profile":"xz-candidate-bytes-once-v1","status":"CANDIDATE_BYTES_OBSERVED","grantConsumed":true,"candidate":"/usr/bin/xz","observation":{"byteLength":101392,"sha256":"1f6ca26fd33066c9d5b95e58a0d9e2f5789cb18fd5741518574113b37ea1934d","elfHeader":{"classBits":64,"endian":"little","version":1,"machine":62,"type":3,"headerBytes":64,"osAbi":0,"abiVersion":0},"identity":{"dev":"56","ino":"295","mode":"33261","uid":"0","gid":"0","nlink":"1","size":"101392","mtimeNs":"1791561255000000000","ctimeNs":"1791561255000000000"}},"counts":{"fsCalls":8,"readCalls":3,"requestedBytes":101393,"returnedBytes":101392,"closeAttempts":1,"clockReads":31},"decoderQualified":false,"realArchiveInspected":false,"xzBehaviorVerified":false,"provenanceVerified":false,"noPythonRuntimeVerified":false,"loaderClosureVerified":false,"nativeAuthority":false,"nativeQualified":false,"installedUsability":false,"rustReady":false,"trainingReady":false}
```

### 29.1 Observed evidence and limits

Repository-only receipt-copy validation passed:925 bytes including storage LF, SHA-256 `17131dd6fbf2a4ac4a46a8701d54f51499932c16c12400ccbcea82c925b0588a`. The approved complete §28 and earlier canonical prefix remain byte-preserved. This validates the stored copy and proposal identity without reopening or statting the candidate or archive; it authenticates neither native execution nor the underlying file's provenance.

The reader reports101392 complete file bytes hashed as SHA-256 `1f6ca26fd33066c9d5b95e58a0d9e2f5789cb18fd5741518574113b37ea1934d`, two data reads plus one EOF request, and stable full nine-field named/descriptor snapshots before/after reading. It returned after its single descriptor close attempt succeeded and the final cooperative guard passed.
The basic ELF-header policy observed class64, little-endian, version1, machine62, type3/ET_DYN,64-byte header, OSABI0 and ABI-version0. These fields do not prove an XZ program, Linux compatibility, PIE versus shared-library role, minimum ISA/ABI/glibc requirement or executable loadability.
Source counters report8 non-close filesystem attempts,3 reads,101393 requested bytes,101392 bytes reported by completed reads,1 close attempt and31 clock samples. They fit the approved source limits without establishing physical I/O, CPU/RSS, process reap or independent closure guarantees.
The observed UID0/gid0/nlink1/mode33261/device56/inode295 and nanosecond timestamps are lossless metadata values from that operation, not future immutability, protected ancestors, authenticated origin or a trusted clock. No directory, alternate path or symlink target was inspected.
The candidate was opened/read as data only. The authored operation did not execute `/usr/bin/xz`, invoke a version query, loader, `ldd`, interpreter, decompressor or library, or inspect derived dependency paths. It performed no SDK archive access, extraction, mutation or cleanup.

### 29.2 Consumed authority and next qualification gate

The one-shot candidate-read grant is CONSUMED. It permits no follow-up stat/read/re-hash, program-header/dynamic-symbol parsing, link resolution, PATH search, environment/package/library/proc inspection, candidate invocation, acquisition fallback or automatic retry.
The positive observation provides an independently reusable comparison expectation only after a later operation is separately registered and approved. It supplies no authenticated version/source correspondence, provenance, NoPython runtime proof or exclusion of compromised XZ/library origins.
The next proposal must separate source/provenance evidence from bounded static ELF program/dynamic-header analysis and the actual interpreter/library/symbol/ISA closure. Reading or following any derived path requires its own exact allowance; do not treat an ELF-supplied interpreter/DT_NEEDED/RPATH string as permission to open or execute it.
Any decoder invocation still requires a separately accepted runtime/source closure, exact argv/environment policy, input/framing/integrity/memory/output/stderr bounds and lifecycle/termination authority. Do not use `--version` or archive decompression as a discovery shortcut.
The SDK archive remains retained and uninspected with its acquisition grant consumed. Rust's eight new tests remain uncompiled/unrun and the Rust BLOCKER stays OPEN; NoPython subset, SDK relocation/ELF usability, Native authority and training readiness remain unqualified. No model training, activation/deployment, cleanup or PR merge occurred.
Receipt-copy validation passed. Closing adversarial/security reviews accepted receipt documentation only with no findings; spec review closed the stale validation-status LOW and reported in-sync. Publication remains `8f7f0933`; the new proposal/receipt documents are uncommitted and not covered by an automatic further push.

## 30. Offline ELF metadata — verified offline unit, candidate analysis unapproved

**[Unverified] Implemented offline source unit with parent-run synthetic verification, not new candidate evidence or decoder qualification.**
The user requested `commit & push then proceed`; the reviewed two-document candidate proposal/receipt was committed/pushed as `ddb5c98fd7985b944effa13ea4f83b41321e9394`. Publication checked receipt/source identities and syntax-only parsing without another candidate/archive access; production source/tests were unchanged, so378 remains the earlier test receipt rather than a docs-only rerun.
The user then selected `Build offline ELF unit (Recommended)` over provenance-only planning or hold. Architect `ses_e93d30213ffedCy1e9xJ50MMIO` and DevOps `ses_e93d30206ffewTR4j8u8NcXXf0` supplied the design before implementation.

### 30.1 File plan, permission and non-goals

Add only `tooling/native-ingress/elf-metadata.mjs` plus `elf-metadata.test.mjs` as manifest-free Node infrastructure with generated in-memory fixtures <=1MiB each. The module imports only Node crypto/util and exposes no filesystem, network, resolver, loader, process, reader or adapter callback.
`inspectElf64(bytes, overrides)` returns deeply frozen plain metadata with state `ELF_METADATA` and profile `elf64le-x86-64-metadata-v1`, or throws a fixed-code `ElfMetadataError`, never partial-success metadata. Export frozen `ELF_METADATA_LIMITS`; capture strict own-data lower-only limit overrides, rejecting proxies, accessors, symbols, extra/inherited fields, non-integers and increased caps.
Accept native Buffer/Uint8Array views using intrinsic length/buffer/offset accessors. Reject shared, resizable or detached backing and oversized input before creating the private snapshot. Hash exactly that snapshot as `inputSha256`; retain no input-backed view or caller-owned profile reference.
The current input subset requires the standard local Buffer/Uint8Array prototype; subclasses, custom prototypes and other realms are unsupported rather than traversed. Own shadow properties are bypassed using captured intrinsic accessors. These checks are not a sandbox against mutation of the trusted Node runtime itself.
Add `_spec/tooling/native-ingress/elf-metadata.puml` with exact two-file coverage in `_spec/.spec-index.json`. Both new files carry its top-line SPEC pointer. Preserve all existing source/API/test/configuration files, previous coverage entries and canonical §§1–29.
No actual candidate, dependency, SDK archive, physical fixture, environment, package database, proc/cache/library or tool-search access is authorized. No decoder, loader, subprocess, network, dependency installation, Python, Rust command, extraction or cleanup belongs in this unit. Static repository reads for source/SPEC/index verification are allowed.

### 30.2 Bounded format and arithmetic contract

Support only ELF64, little-endian, x86-64 machine62, identification/header version1, ET_EXEC2 or ET_DYN3,64-byte ELF header and56-byte program headers. Reject extended program-header numbering and unsupported layouts without fallback. Section headers, relocations, symbol versions, GNU notes/build IDs and ISA requirements are outside this subset.
Check offsets, products, exclusive range ends and virtual-address arithmetic in BigInt before Number conversion. Accept only bounded file offsets as Numbers; represent exported U64 addresses/sizes as lossless decimal strings. Reject address ranges extending beyond2^64 and file ranges outside the captured snapshot.
Validate all program-header file spans, filesz<=memsz and declared alignment; require PT_LOAD file-offset/virtual-address alignment congruence. Preserve unknown program-header kinds as inert bounded metadata. Admit at most one PT_INTERP and one PT_DYNAMIC; duplicates fail even when identical.
PT_INTERP must contain a bounded, nonempty, exactly terminal-NUL UTF-8 string without controls. Record its raw value, whether absolute or relative, without host access or path normalization.

| Default hard ceiling | Value | Meaning |
| --- | ---: | --- |
| Captured input | 1048576 bytes | Admission before private allocation; no larger test fixture |
| Program headers | 128 | Count admitted before multiplication/iteration |
| Dynamic entries | 1024 | All declared16-byte slots, including DT_NULL and unused tail slots |
| String table | 65536 bytes | Entire file-backed DT_STRTAB/DT_STRSZ span |
| One dynamic string | 1024 bytes | Includes terminating NUL, not JavaScript character count |
| Interpreter | 256 bytes | Includes NUL and bounds the whole PT_INTERP payload |
| DT_NEEDED entries | 32 | Preserve order and duplicates, never resolve filenames |
| Successful serialized output | 65536 bytes | UTF-8 JSON byte count before result publication |

Caps may be tightened only. Their fit for the observed candidate is unverified until a separately approved read; unsupported content or a cap overrun stops, not auto-expands.

### 30.3 Dynamic metadata, mapping and result boundary

PT_DYNAMIC requires positive16-byte-aligned file size and DT_NULL within its bounded declared slots. Active-entry accounting includes the first DT_NULL; that terminates interpretation. Later bytes remain included in the snapshot hash and declared-slot cap but are not interpreted as active tags or claimed zero padding.
Reject duplicate DT_STRTAB, DT_STRSZ, DT_SONAME, DT_RPATH and DT_RUNPATH singleton tags. Preserve DT_NEEDED entries in order, including duplicates. Record unknown active tags as bounded signed-tag/unsigned-value decimal pairs without following pointer-like values.
Require DT_STRTAB and DT_STRSZ together; referenced strings require both. A present table must be nonempty and within its cap. An entire string-table virtual span must intersect exactly one file-backed PT_LOAD interval, fully fit that interval and translate to a bounded captured-file span. Reject BSS-only coverage, split mappings and full or partial overlapping aliases, even if resulting offsets match.
Each string reference must lie inside that table and reach a NUL within both the table remainder and per-string cap. Use fatal UTF-8 decoding and reject controls instead of silent replacement. DT_NEEDED/SONAME values must be nonempty; empty RPATH/RUNPATH remain raw metadata. No `$ORIGIN` expansion, colon splitting, search-order emulation, basename resolution, filesystem path joining or derived-path allowance follows.
The result records header/program-header metadata, nullable interpreter, bounded dynamic names/paths/opaque tags and snapshot SHA-256. It is not a full ELF-validity, executable-loadability or complete runtime-dependency proof; dynamic loading and source/provenance remain separate.
The concrete root schema is `profile,state,byteLength,inputSha256,header,programHeaders,interpreter,dynamic`, followed by the fixed false assurance fields. `header` reports type/machine/version/ABI bytes/entryPoint/flags/program-header location/count/entry size. Each program header reports index/type/flags/fileOffset/virtualAddress/physicalAddress/fileBytes/memoryBytes/alignment, with all U64 values as decimal strings.
`dynamic` reports present, declaredSlots, activeEntries, ordered needed names, nullable soname/rpath/runpath/stringTable and opaque unknownTags. A stringTable reports its virtualAddress and fileOffset as strings plus bounded byteLength as a Number. Unknown tag/value pairs use signed/unsigned decimal strings respectively. No raw input-backed bytes or deferred resolver appears in the result.
Keep candidateExecuted, decoderQualified, realCandidateRead, realArchiveInspected, provenanceVerified, noPythonRuntimeVerified, loaderClosureVerified, nativeAuthority, nativeQualified, installedUsability, rustReady and trainingReady:false. These flags describe this byte-inspection unit, not a capability sandbox or global host state.
Source caps bound loops, snapshots and serialized data, not native heap/RSS, CPU time, runtime bootstrap or the original F9/game budgets. Do not infer minimum ISA/glibc/kernel compatibility or a Python-free runtime from names or ELF labels.

### 30.4 Verification, diagram rendering and later operation

Persist synthetic tests for every cap at/exceeding tightened boundaries, truncated headers/tables, U64 overflow, >2^53 virtual addresses with small file offsets, bad header sizes/counts, BSS-only/partial/ambiguous mappings, duplicate tags, DT_NULL absence/tail handling, invalid strings/UTF-8, raw RPATH/RUNPATH labels, immutable snapshots/results and strict input/profile validation.
Run both new-file syntax checks and only `node --test --test-concurrency=1 --experimental-test-coverage tooling/native-ingress/elf-metadata.test.mjs`; use no real decoder or physical fixture. Existing378 tests are not verification of this new feature; do not rerun old acquisition/custody file-fixture suites under this grant. Oxlint's known unavailability grants no install or substitute PASS.
The parent independently passed both syntax checks and **190/190 new synthetic tests,0 failures/cancelled/skipped/todo**. Parser coverage is100% lines/branches/functions. A runtime-fault test exercises fixed unexpected-error normalization without publishing partial metadata; the source/SPEC test checks both pointers, diagram covers and the exact appended index entry. Coverage does not qualify real ELF bytes, a decoder or the Node/native runtime.
The same user choice explicitly approves offline rendering only to `_spec/tooling/native-ingress/elf-metadata.svg` <=8MiB. Pin local `_spec/themes/proveo.puml`,6238 bytes, SHA-256 `d75f801bd90752ed50243ba05f58b37c4808b5510cbb035dc578b0441d74de39`; retain the source's remote house include and substitute the local body only in renderer input, rejecting other active external-input directives. Accept ordinary renderer/JRE/font startup trust, not Native/upstream-theme equivalence, remote fetch or hard containment.
Parent offline-expanded `plantuml -checkonly -pipe` and `-tsvg -pipe` passed after current source mapping and note-width repair. Notes passed <=50 columns and2..5 lines. The29299-byte SVG binds diagram SHA-256 `eb5eeb8d3e8371350d6776ea84f6ec82ba443891c90486f089fc3d3903d86353`, expanded-input SHA-256 `afd98ebf7be22bb90d6d2933b829ce7c8a7b8e616a6b9a1ef47f1ee70f3c1bb3` and the approved local-theme hash in its provenance comment. SVG SHA-256 is `3d7b3c88357b40601040a9a3afd32859f73be65682c61944751d68e4b6071755`; no other SVG or remote theme changed.
Adversarial, security and DevOps source reviews accepted the offline unit with no findings. Spec review closed the repaired note-width LOW and reported in-sync. These reviews grant no real-candidate access or runtime qualification. Oxlint remains unavailable and skipped without installation or replacement PASS.
The separate two-file source/test identity is `1e799487cef1bc697fb9ca27a414877598f12233f534634b4120aa52d7778950`, using sorted UTF-8 paths followed by file bytes, each field prefixed by its unsigned64 big-endian length. SHA-256 values are source `c8e471b3417ec610cc3dba6c3600858646551cc2c352fb9d849d149c07ef87d0` and test `58b5cfa66b974ef8deca6a4ae665d6114d12574519cd7a9ba68e859ddfd57116`.
All published canonical §§1–29, existing source/configuration files, previous coverage entries and unresolved records remain unchanged; the index only appends this exact two-file entry. That metadata change does not reissue an older selected verifier identity, Rust receipt or Native invoice.
Implementation, parent synthetic verification and current offline rendering are complete. No real candidate reread, interpreter/library open or decoder execution is authorized. A later operation must separately pin/compare the candidate's observed101392-byte digest and use freshly approved same-FD custody/readback/metadata bounds; extracted names never authorize following their paths.
Source/version/provenance and actual interpreter/library/symbol/ISA closure remain separate gates. The SDK archive stays untouched/uninspected, Rust's eight tests remain uncompiled/unrun with BLOCKER OPEN, and `trainingReady:false`. No new publication, PR merge, model training, activation/deployment or cleanup follows from this unit's grant.

## 31. Same-candidate static ELF proposal — fresh read grant pending

**[Unverified] Exact operation proposal, not actual interpreter/library metadata or execution qualification.**
The user's `proceed` permits preparation only. Preserve the verified, uncommitted §30 source/test/spec/index work without committing, pushing or modifying its production code. Architect `ses_e9382462effe1TcUlC22mk0WCG` and DevOps `ses_e93824617ffex0W9XE4ZZJDDGh` reviewed the operation boundary before authoring.
The sole host candidate remains `/usr/bin/xz`, comparison size101392, SHA-256 `1f6ca26fd33066c9d5b95e58a0d9e2f5789cb18fd5741518574113b37ea1934d`. Reuse §29's exact nine-field identity only under a fresh grant. Previous grants are consumed; no repeat stat/read/hash or new derived-path access has occurred.

### 31.1 Source, custody and analysis contract

The launcher reads and hashes ONLY repository parser `/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/elf-metadata.mjs`:11055 bytes, SHA-256 `c8e471b3417ec610cc3dba6c3600858646551cc2c352fb9d849d149c07ef87d0`, then imports its fixed absolute URL. That module imports only `node:crypto` and `node:util`; the launcher additionally imports `node:fs`.
The source is tested but uncommitted. Byte pinning—not publication—identifies this proposal's source. Hash-before-import does not create immutable or race-free module loading. Node executable/PATH/options/preloads/environment/native libraries, module-loader/package discovery and startup inputs remain trusted ordinary-host residuals, not a complete executable/source closure.
Require initial candidate metadata to equal the literal §29 snapshot, then bind the owned FD and both final snapshots to the same nine fields. No parent, symlink target, alternate candidate or directory is inspected. A different inode, mode, timestamp, size or other field stops even when bytes might match; no repair or relaxed comparison follows.
Open read-only with NOFOLLOW/NONBLOCK, read exactly65536+35856 bytes through the same FD into one private101392-byte Buffer, request one byte at recorded EOF and compare the full expected SHA-256. Stop on short read, unexpected EOF data, hash/snapshot mismatch or unsupported platform metadata.
Clear FD ownership before its single close attempt. Parse only after successful candidate closure, using `inspectElf64` on the private buffer. Require parser byteLength/inputSha256 to match the same pinned candidate and enforce its unchanged §30 limits. Missing/failed closure forbids parser invocation and successful metadata publication.
Extracted interpreter/DT_NEEDED/SONAME/RPATH/RUNPATH strings are inert untrusted metadata. No loader, library path, token, basename or directory may be opened, searched, joined, normalized, resolved, substituted or executed from them.

### 31.2 Exact launcher proposal — not authorized until fresh consent

Run once through the shell tool in `/tmp/opencode/f9-bootstrap-correspondence`, timeout30000ms, foreground only. This operation creates no launcher, receipt, log, fixture or other file.

<!-- BEGIN XZ STATIC ELF ANALYSIS V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const started = process.hrtime.bigint();
const workEnd = started + 19_000_000_000n, totalEnd = started + 20_000_000_000n;
const profile = 'xz-static-elf-once-v1';
const candidate = '/usr/bin/xz';
const sourcePath = '/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/elf-metadata.mjs';
const sourceSha256 = 'c8e471b3417ec610cc3dba6c3600858646551cc2c352fb9d849d149c07ef87d0';
const expectedSha256 = '1f6ca26fd33066c9d5b95e58a0d9e2f5789cb18fd5741518574113b37ea1934d';
const expectedBytes = 101392;
const expectedIdentity = { dev: 56n, ino: 295n, mode: 33261n, uid: 0n, gid: 0n, nlink: 1n,
  size: 101392n, mtimeNs: 1791561255000000000n, ctimeNs: 1791561255000000000n };
const fields = Object.keys(expectedIdentity);
const limits = { maxInputBytes: 1048576, maxProgramHeaders: 128, maxDynamicEntries: 1024,
  maxStringTableBytes: 65536, maxStringBytes: 1024, maxInterpreterBytes: 256,
  maxNeeded: 32, maxOutputBytes: 65536 };
const assurances = { candidateExecuted: false, derivedPathsOpened: false, decoderQualified: false,
  realArchiveInspected: false, provenanceVerified: false, noPythonRuntimeVerified: false,
  loaderClosureVerified: false, nativeAuthority: false, nativeQualified: false,
  installedUsability: false, rustReady: false, trainingReady: false };
const parserFlags = ['candidateExecuted', 'decoderQualified', 'realCandidateRead',
  'realArchiveInspected', 'provenanceVerified', 'noPythonRuntimeVerified', 'loaderClosureVerified',
  'nativeAuthority', 'nativeQualified', 'installedUsability', 'rustReady', 'trainingReady'];
const allowed = new Set(['E_INPUT', 'E_LIMITS', 'E_ELF', 'E_RANGE', 'E_PROGRAM_HEADERS',
  'E_INTERPRETER', 'E_DYNAMIC', 'E_STRING_TABLE', 'E_STRING', 'E_OUTPUT', 'E_SOURCE_PIN',
  'E_SOURCE', 'E_PLATFORM', 'E_METADATA', 'E_BINDING', 'E_IO', 'E_MISSING', 'E_LENGTH',
  'E_HASH', 'E_LIMIT', 'E_DEADLINE', 'E_CLOSE', 'E_RESULT']);
const counts = { sourceReads: 0, sourceReturnedBytes: 0, candidateFsCalls: 0,
  candidateReadCalls: 0, candidateRequestedBytes: 0, candidateReturnedBytes: 0,
  closeAttempts: 0, clockReads: 1 };
let fd = null, last = started, failure = null, metadata, text;
let phase = 'PREFLIGHT', candidateReadAttempted = false, candidateReadPerformed = false, parserInvoked = false;
function stop(code) { const error = new Error(); error.code = code; throw error; }
function code(error) {
  const field = error && Object.getOwnPropertyDescriptor(error, 'code');
  if (field && Object.hasOwn(field, 'value') && allowed.has(field.value)) return field.value;
  return field && field.value === 'ENOENT' ? 'E_MISSING' : phase === 'OUTPUT' ? 'E_OUTPUT' : 'E_IO';
}
function guard(final = false) {
  if (counts.clockReads >= 256) stop('E_LIMIT');
  counts.clockReads++;
  const time = process.hrtime.bigint();
  if (typeof time !== 'bigint' || time < last) stop('E_PLATFORM');
  last = time;
  if (time >= (final ? totalEnd : workEnd)) stop('E_DEADLINE');
}
function work(action) { guard(); const value = action(); guard(); return value; }
function io(action) {
  return work(() => {
    if (counts.candidateFsCalls >= 8) stop('E_LIMIT');
    counts.candidateFsCalls++;
    return action();
  });
}
function snapshot(stat) {
  const result = {};
  for (const key of fields) {
    const value = stat[key];
    if (typeof value !== 'bigint') stop('E_METADATA');
    result[key] = value;
  }
  return result;
}
function same(actual, expected) {
  if (!fields.every(key => actual[key] === expected[key])) stop('E_BINDING');
}
function close() {
  if (fd === null) return;
  const owned = fd; fd = null; counts.closeAttempts++;
  try { fs.closeSync(owned); } catch { stop('E_CLOSE'); }
}
function encode(value) {
  const output = (JSON.stringify(value) + '\n').replace(/[^\x00-\x7f]/g,
    unit => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0'));
  if (!/^[\x20-\x7e\n]*$/.test(output) || Buffer.byteLength(output) > 131072) stop('E_OUTPUT');
  return output;
}
function base(status) {
  return { profile, status, grantConsumed: true, candidate, sourceSha256, expectedSha256,
    candidateReadAttempted, candidateReadPerformed, parserInvoked, phase, counts, ...assurances };
}
process.stdout.on('error', () => { process.exitCode = 1; });
try {
  const source = work(() => {
    counts.sourceReads++;
    const bytes = fs.readFileSync(sourcePath);
    counts.sourceReturnedBytes = bytes.length;
    return bytes;
  });
  if (source.length !== 11055 || work(() => createHash('sha256').update(source).digest('hex')) !== sourceSha256)
    stop('E_SOURCE_PIN');
  guard();
  const helper = await import('file:///tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/elf-metadata.mjs');
  guard();
  const configured = helper.ELF_METADATA_LIMITS;
  if (!configured || !Object.isFrozen(configured) || Reflect.ownKeys(configured).length !== 8 ||
      Object.entries(limits).some(([key, value]) => {
        const field = Object.getOwnPropertyDescriptor(configured, key);
        return !field || !Object.hasOwn(field, 'value') || field.value !== value;
      }) || typeof helper.inspectElf64 !== 'function') stop('E_SOURCE');
  phase = 'CANDIDATE';
  const f = fs.constants;
  if (f.O_RDONLY !== 0 || !Number.isInteger(f.O_NOFOLLOW) || f.O_NOFOLLOW <= 0 ||
      !Number.isInteger(f.O_NONBLOCK) || f.O_NONBLOCK <= 0) stop('E_PLATFORM');
  const initial = snapshot(io(() => fs.lstatSync(candidate, { bigint: true })));
  same(initial, expectedIdentity);
  io(() => { fd = fs.openSync(candidate, f.O_RDONLY | f.O_NOFOLLOW | f.O_NONBLOCK); });
  same(snapshot(io(() => fs.fstatSync(fd, { bigint: true }))), initial);
  const bytes = work(() => Buffer.alloc(expectedBytes));
  const eof = work(() => Buffer.alloc(1));
  function read(target, destination, want, position) {
    return io(() => {
      if (counts.candidateReadCalls >= 3 || counts.candidateRequestedBytes + want > 101393) stop('E_LIMIT');
      counts.candidateReadCalls++; counts.candidateRequestedBytes += want;
      candidateReadAttempted = true;
      const count = fs.readSync(fd, target, destination, want, position);
      if (!Number.isSafeInteger(count) || count < 0 || count > want) stop('E_IO');
      counts.candidateReturnedBytes += count;
      if (count > 0) candidateReadPerformed = true;
      return count;
    });
  }
  for (let offset = 0; offset < expectedBytes;) {
    const want = Math.min(65536, expectedBytes - offset);
    if (read(bytes, offset, want, offset) !== want) stop('E_LENGTH');
    offset += want;
  }
  if (read(eof, 0, 1, expectedBytes) !== 0) stop('E_LENGTH');
  if (work(() => createHash('sha256').update(bytes).digest('hex')) !== expectedSha256) stop('E_HASH');
  same(snapshot(io(() => fs.fstatSync(fd, { bigint: true }))), initial);
  same(snapshot(io(() => fs.lstatSync(candidate, { bigint: true }))), initial);
  close();
  phase = 'PARSER';
  metadata = work(() => { parserInvoked = true; return helper.inspectElf64(bytes); });
  if (!metadata || metadata.profile !== 'elf64le-x86-64-metadata-v1' || metadata.state !== 'ELF_METADATA' ||
      metadata.byteLength !== expectedBytes || metadata.inputSha256 !== expectedSha256 ||
      parserFlags.some(key => metadata[key] !== false) ||
      work(() => Buffer.byteLength(JSON.stringify(metadata), 'utf8')) > 65536) stop('E_RESULT');
} catch (error) { failure = [code(error)]; }
finally {
  try { close(); } catch { failure = ['E_CLOSE', ...(failure || [])]; }
}
phase = failure ? phase : 'OUTPUT';
if (!failure) {
  try {
    guard(true);
    text = encode({ ...base('STATIC_ELF_METADATA'), metadataScope: 'pure parser actions only; wrapper performed the approved read', metadata });
    guard(true);
  } catch (error) { failure = [code(error)]; }
}
if (failure) {
  process.exitCode = 1;
  try { text = encode({ ...base('STOP'), errors: failure }); } catch { text = undefined; }
}
if (text !== undefined) {
  try { process.stdout.write(text); } catch { process.exitCode = 1; }
}
NODE
```
<!-- END XZ STATIC ELF ANALYSIS V1 -->

### 31.3 Effects, output and residuals to accept

Candidate effects are capped at8 non-close calls: initial lstat/open/fstat, two exact data reads, one EOF read, final fstat/lstat; add one unconditional close attempt only if an FD was acquired. One source preflight readFileSync is counted separately. Module loading/runtime activity is outside that candidate ledger; no complete native-FD/filesystem graph is asserted.
The expected initial security/identity is exactly §29: device56/inode295/mode33261/UID0/GID0/nlink1/size101392/mtimeNs and ctimeNs1791561255000000000. This is an explicitly reused comparison target, not a new observation, immutable protection or authenticated origin. The single owned candidate FD is assigned before a post-open guard and cleared before one close attempt; close uncertainty blocks parsing/success without retry.
The code reports attempted reads separately from reads returning positive bytes. Returned-byte counts are recorded before post-read guards and are not independently metered native I/O. A failure after partial read may report performed:true but never publishes partial parsed metadata.
The helper's JSON remains <=65536 UTF-8 bytes. The entire operation envelope, including wrapper fields and LF, must fit131072 ASCII bytes after escaping every non-ASCII UTF-16 unit as `\uXXXX`; no truncation occurs. Prepare the full success record before any write. Oversize/serialization failure selects a small fixed-code STOP record before output; actual stdout emission is attempted only once, without a fallback write.
`candidateReadPerformed` belongs to the wrapper; nested `metadata.realCandidateRead:false` describes the pure parser's lack of filesystem access, not denial of the wrapper's read. All execution/provenance/NoPython/loader/Native/Rust/training fields remain false/unqualified. Extracted strings never become filesystem permissions.
Body START precedes preflight/validation; guards use19s work and20s total including1s finalization, with<=256 source clock samples. Awaited module loading, synchronous parsing/native I/O/close and stdout cannot be forcibly interrupted by these guards. The30s tool capture limit proves no hard CPU/RSS/termination/reap or physical-close bound.
Fresh consent must accept trusted-mutable-repository source reads and hash-before-import TOCTOU, inherited Node/PATH/options/preload/environment/native-library/module-loader/startup behavior, and uninspected ancestor/filesystem behavior. Source preflight readFileSync has no adversarial source-file size/I/O-time containment; input/source pin failures stop but do not qualify the runtime itself.
No candidate execution, loader/`ldd`/version query, dependency or interpreter open, link resolution, directory/PATH search, environment/package/proc/cache query, network, archive access, decompression/extraction, installation, modification, deletion, signal, retry, replacement path or cleanup is included. Every attempted launch consumes the grant, including source-preflight failure or failure before any candidate read.
Keep all original Native/F9 source/invoice/PrivateRootB controls, both-seat inclusive1048576, F1, cold10/lifecycle300 including3s cleanup, generator2048, Rust1.95/Burn0.22 Flex CPU/f64/features, NoPython, datasets/labels and separate ledgers unchanged.

### 31.4 Registration, review and next gate

Syntax-only parsing passed without evaluating the extracted launcher; the11055-byte parser source pin matches and the prior working canonical prefix remains byte-preserved. Required adversarial/security reviews accepted this proposal only with no findings; spec review reported in-sync. Retain the prior architecture/domain consultation and omit optional repeated rounds. Register exact shell-command and complete §31 hashes before asking fresh consent with approve-static-read-once / provenance-only-planning / hold choices. Registration and fresh operational consent remain pending; no same-candidate reread or metadata extraction has run.
If separately approved, record the bounded captured result in a later canonical section and consume the grant once. Successful metadata collection is not provenance, runtime compatibility, NoPython or decoder qualification. Derived paths remain unapproved; any source/version/provenance work or interpreter/library/symbol/ISA closure needs separate exact evidence and access permissions.
The SDK archive remains untouched/uninspected and all earlier read/acquisition grants remain consumed. Rust compilation/tests remain a binding BLOCKER; no actual training, activation/deployment, installation, cleanup, commit/push or PR merge follows from this proposal stage.

## 32. Same-candidate static ELF receipt — metadata collected, grant consumed

**[Unverified] Ordinary-host static metadata evidence, not decoder execution, authenticated provenance or runtime closure.**
The user selected `Approve static read once` for §31's exact source/candidate pins, filesystem effects, output limits and disclosed runtime/TOCTOU/ancestor/cooperative-timeout residuals.
The approved complete §31 is15845 UTF-8 bytes, SHA-256 `6fba5cc92aa7d50436db3cf0abda18fe428311f5541acb055b1fc011011cdba8`. The8017-byte command is `8693e7964bcaffc5b1b918bd4bdd04a686e4cbba946242c1e8a4a307cbe6694c`; its7978-byte JavaScript body is `74072d67f63685ed3cee26e4686cc57f221073f90c4da9472da163b9fdcfd27a`.
Repository-only preflight matched the complete canonical document `f54bac8a4cb58aea7b685c89cc77c11e59b34ef35f059495267e37a6a1d31890`, section, command and11055-byte parser source `c8e471b3417ec610cc3dba6c3600858646551cc2c352fb9d849d149c07ef87d0` before the exact launcher ran once, foreground with30000ms tool timeout.
The tool returned normally with the complete expected STATIC_ELF_METADATA record and no timeout/nonzero-exit report. An inherited EnvHttpProxyAgent warning appeared outside the bounded JSON record, within the accepted startup residual. This compact JSON copies the authored stdout record, not an authenticated process or native-I/O transcript:

```json
{"profile":"xz-static-elf-once-v1","status":"STATIC_ELF_METADATA","grantConsumed":true,"candidate":"/usr/bin/xz","sourceSha256":"c8e471b3417ec610cc3dba6c3600858646551cc2c352fb9d849d149c07ef87d0","expectedSha256":"1f6ca26fd33066c9d5b95e58a0d9e2f5789cb18fd5741518574113b37ea1934d","candidateReadAttempted":true,"candidateReadPerformed":true,"parserInvoked":true,"phase":"OUTPUT","counts":{"sourceReads":1,"sourceReturnedBytes":11055,"candidateFsCalls":8,"candidateReadCalls":3,"candidateRequestedBytes":101393,"candidateReturnedBytes":101392,"closeAttempts":1,"clockReads":34},"candidateExecuted":false,"derivedPathsOpened":false,"decoderQualified":false,"realArchiveInspected":false,"provenanceVerified":false,"noPythonRuntimeVerified":false,"loaderClosureVerified":false,"nativeAuthority":false,"nativeQualified":false,"installedUsability":false,"rustReady":false,"trainingReady":false,"metadataScope":"pure parser actions only; wrapper performed the approved read","metadata":{"profile":"elf64le-x86-64-metadata-v1","state":"ELF_METADATA","byteLength":101392,"inputSha256":"1f6ca26fd33066c9d5b95e58a0d9e2f5789cb18fd5741518574113b37ea1934d","header":{"type":3,"machine":62,"version":1,"osAbi":0,"abiVersion":0,"entryPoint":"26784","flags":0,"programHeaderOffset":"64","programHeaderCount":14,"programHeaderBytes":56},"programHeaders":[{"index":0,"type":6,"flags":4,"fileOffset":"64","virtualAddress":"64","physicalAddress":"64","fileBytes":"784","memoryBytes":"784","alignment":"8"},{"index":1,"type":3,"flags":4,"fileOffset":"884","virtualAddress":"884","physicalAddress":"884","fileBytes":"28","memoryBytes":"28","alignment":"1"},{"index":2,"type":1,"flags":4,"fileOffset":"0","virtualAddress":"0","physicalAddress":"0","fileBytes":"12480","memoryBytes":"12480","alignment":"4096"},{"index":3,"type":1,"flags":5,"fileOffset":"16384","virtualAddress":"16384","physicalAddress":"16384","fileBytes":"57325","memoryBytes":"57325","alignment":"4096"},{"index":4,"type":1,"flags":4,"fileOffset":"73728","virtualAddress":"73728","physicalAddress":"73728","fileBytes":"18748","memoryBytes":"18748","alignment":"4096"},{"index":5,"type":1,"flags":6,"fileOffset":"93872","virtualAddress":"97968","physicalAddress":"97968","fileBytes":"5024","memoryBytes":"24512","alignment":"4096"},{"index":6,"type":2,"flags":6,"fileOffset":"96800","virtualAddress":"100896","physicalAddress":"100896","fileBytes":"512","memoryBytes":"512","alignment":"8"},{"index":7,"type":4,"flags":4,"fileOffset":"848","virtualAddress":"848","physicalAddress":"848","fileBytes":"36","memoryBytes":"36","alignment":"4"},{"index":8,"type":4,"flags":4,"fileOffset":"92280","virtualAddress":"92280","physicalAddress":"92280","fileBytes":"48","memoryBytes":"48","alignment":"8"},{"index":9,"type":4,"flags":4,"fileOffset":"92328","virtualAddress":"92328","physicalAddress":"92328","fileBytes":"148","memoryBytes":"148","alignment":"4"},{"index":10,"type":1685382483,"flags":4,"fileOffset":"92280","virtualAddress":"92280","physicalAddress":"92280","fileBytes":"48","memoryBytes":"48","alignment":"8"},{"index":11,"type":1685382480,"flags":4,"fileOffset":"88036","virtualAddress":"88036","physicalAddress":"88036","fileBytes":"724","memoryBytes":"724","alignment":"4"},{"index":12,"type":1685382481,"flags":6,"fileOffset":"0","virtualAddress":"0","physicalAddress":"0","fileBytes":"0","memoryBytes":"0","alignment":"16"},{"index":13,"type":1685382482,"flags":4,"fileOffset":"93872","virtualAddress":"97968","physicalAddress":"97968","fileBytes":"4432","memoryBytes":"4432","alignment":"1"}],"interpreter":"/lib64/ld-linux-x86-64.so.2","dynamic":{"present":true,"declaredSlots":32,"activeEntries":28,"needed":["liblzma.so.5","libc.so.6"],"soname":null,"rpath":null,"runpath":null,"stringTable":{"virtualAddress":"4080","byteLength":1803,"fileOffset":"4080"},"unknownTags":[{"tag":"12","value":"16384"},{"tag":"13","value":"73696"},{"tag":"25","value":"97968"},{"tag":"27","value":"8"},{"tag":"26","value":"97976"},{"tag":"28","value":"8"},{"tag":"1879047925","value":"912"},{"tag":"6","value":"984"},{"tag":"11","value":"24"},{"tag":"21","value":"0"},{"tag":"3","value":"101408"},{"tag":"2","value":"2784"},{"tag":"20","value":"7"},{"tag":"23","value":"9696"},{"tag":"7","value":"6432"},{"tag":"8","value":"3264"},{"tag":"9","value":"24"},{"tag":"30","value":"8"},{"tag":"1879048187","value":"134217729"},{"tag":"1879048190","value":"6144"},{"tag":"1879048191","value":"2"},{"tag":"1879048176","value":"5884"},{"tag":"1879048185","value":"125"}]},"candidateExecuted":false,"decoderQualified":false,"realCandidateRead":false,"realArchiveInspected":false,"provenanceVerified":false,"noPythonRuntimeVerified":false,"loaderClosureVerified":false,"nativeAuthority":false,"nativeQualified":false,"installedUsability":false,"rustReady":false,"trainingReady":false}}
```

### 32.1 Supported observations and counter scope

Repository-only receipt-copy validation passed:4816 bytes including storage LF, SHA-256 `4f0fddb5eaa33eb8c3a30471807cf95d4c0092fd0462d4c42e3c6816708cbc23`. Nested metadata is3837 UTF-8 JSON bytes. The approved complete §31 and earlier working prefix remain unchanged; validation parsed the stored copy without candidate, dependency or archive access. This is copy-integrity metadata, not authenticated execution evidence.

The source-bound result reports exact candidate length/digest/full nine-field identity matching, EOF, final metadata matching and successful single FD closure before parser invocation. The parser's private-snapshot inputSha256 again equals `1f6ca26fd33066c9d5b95e58a0d9e2f5789cb18fd5741518574113b37ea1934d` for101392 bytes. This is sampled identity/content evidence, not future immutability or authenticated execution.
The supported subset reports14 program headers; interpreter `/lib64/ld-linux-x86-64.so.2`; active DT_NEEDED names `liblzma.so.5` and `libc.so.6` in that order; and no active SONAME, RPATH or RUNPATH tag. None of these names/paths has been opened or resolved. Absent declared RPATH/RUNPATH is not absence of runtime loader defaults, environment or cache effects.
The dynamic table has32 declared slots and28 active entries including the first DT_NULL; string-table span is1803 bytes at file offset4080. The parser retained23 other active tags as opaque pairs. It did not interpret those pairs as symbol-version, relocation, ISA, build-ID, loader-policy or provenance evidence.
The emitted counter snapshot reports sourceReads1/sourceReturnedBytes11055, candidateFsCalls8, candidateReadCalls3, candidateRequestedBytes101393, candidateReturnedBytes101392 and closeAttempts1. `clockReads:34` is the serialization-time snapshot; the approved positive path samples once more in its final post-encoding guard, for35 source samples overall. Preserve the original record rather than relabel its field as a complete final counter or Native invoice.
Wrapper candidateReadAttempted/candidateReadPerformed/parserInvoked are true. Nested metadata.realCandidateRead remains false because it describes the pure parser, not the wrapper; metadataScope explicitly records that separation. Candidate execution, derived-path opening, archive inspection and all qualification fields remain false/unqualified.
No new source, test, diagram or index change accompanies the operation. The verified but uncommitted §30 unit remains unchanged. No independent OS barrier, physical-close/reap, complete filesystem/source graph or hard CPU/RSS/timing guarantee follows.

### 32.2 Consumed grant and next boundary

The one-shot static-read grant is CONSUMED. Do not repeat candidate reads/stats/hashes, resolve links, follow the reported interpreter, search library names, inspect loader/package/cache/environment/proc inputs, execute a loader/`ldd`/version query, run XZ, inspect the SDK archive or acquire a replacement under this grant.
Next separate source/version/provenance evidence from exact bounded interpreter/library resolution/identity and symbol-version/ISA requirements. Declared names alone do not prove those files exist, show how they resolve, account for transitive/dynamic dependencies or establish a Python-free runtime. Any derived-path catalog and access must be explicitly registered and approved before use.
The SDK archive remains retained and unlisted/unextracted/unexecuted. Rust compilation/tests stay a binding BLOCKER; real training, activation/deployment, SDK installation, working-architecture acceptance and retained-cache/doc cleanup remain unauthorized. Publication stays at `ddb5c98f`/PR50 OPEN/unmerged; the new ELF unit and these proposal/receipt additions remain uncommitted.
Repository-only receipt-copy validation passed. Required brief parallel adversarial/security checks accepted receipt documentation only with no findings; spec review reported in-sync. Optional repeated review rounds remain omitted as requested; no further operation follows automatically.

## 33. Autonomous work order through step5 — scoped qualification first

**[Unverified] Work-order implementation/evidence ledger; no completed XZ, Native or training qualification is inferred.**
The user explicitly ordered: `Loop until achieving 5. Finish shared418 features, estimator/belief integration and strict artifact lifecycle. No more questions from this session. Commit & push after each remaining step`.
Treat that as a new work order for the previously listed steps1–5, not renewal of consumed grants: qualify XZ; qualify a Python-free SDK/offline toolchain; verify the prepared Rust runtime; complete the frozen F9 obligations; implement/verify shared418, estimator/belief integration and strict artifact lifecycle. Register bounded necessary operations here and continue without more questions. Commit/non-force push after a step actually meets its acceptance checks, not after relabeling a partial result.
Retain NoPython, Rust1.95.0/Burn=0.22.0/defaults-off/std,flex,optim,store/Flex CPU-f64, unchanged TS engine, separate ledgers/raw D+B labels, settlement controls, both gas0, one shared inclusive1048576/F1/no reset/refund/clone, original10s/300s including3s cleanup and generator2048. This work order does not waive a Native source/invoice/loading/clock requirement, authorize training/collection/fitting/calibration/activation/deployment or permit retained-data deletion. Avoid old retained M2/M3 roots; use explicitly registered fresh paths for later preparation instead of reusing old grants.
Architect `ses_e936987c0ffecQzddmWT2yoa4d`, repository exploration `ses_e936987b8ffeDC1iMTprqmt9Kz` and DevOps `ses_e93698751ffe4do5FwWMR4nB53` separated implemented foundations from missing source and hard proof gates before further coding. Current full418/belief/artifact Rust implementations remain absent, and the eight prepared runtime tests remain uncompiled/unrun. Genuine F9 numeric B, complete invoice, clock/custody/loading and whole-decision fit remain unproved; report precise blockers instead of waiving them.

### 33.1 Step1 first operation — five-name metadata catalog

This operation catalogs only the literal interpreter name from §32 plus four explicitly selected common x86-64 GNU library candidate names. The four library paths are unobserved candidates, not established loader selections. Perform at most10 lstats and5 conditional readlinks, no file-content read/open/hash, directory/PATH scan, realpath, target following, execution or network. Kernel traversal of uninspected ancestor symlinks remains the ordinary-host residual; leaf targets remain uninterpreted data.
Use the exact command below once in the repository directory, foreground, shell timeout5000ms. The3500ms guard is cooperative and cannot interrupt native metadata calls or establish hard termination/RSS/reaping. No FD is explicitly acquired. Require stable nine-field pre/post snapshots, supported regular/symlink type and root ownership; do not interpret symlink permission bits as regular-file write permission. Missing literal names produce partial metadata, never global absence or fallback selection.

<!-- BEGIN XZ FIVE NAME CATALOG V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
const started = process.hrtime.bigint();
const end = started + 3_500_000_000n;
const paths = ['/lib64/ld-linux-x86-64.so.2', '/lib/x86_64-linux-gnu/liblzma.so.5',
  '/usr/lib/x86_64-linux-gnu/liblzma.so.5', '/lib/x86_64-linux-gnu/libc.so.6',
  '/usr/lib/x86_64-linux-gnu/libc.so.6'];
const fields = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs'];
const counts = { lstats: 0, readlinks: 0 };
const rows = [];
let last = started, clocks = 1, failure;
function stop(code) { const error = new Error(); error.code = code; throw error; }
function guard() {
  if (++clocks > 100) stop('E_LIMIT');
  const time = process.hrtime.bigint();
  if (typeof time !== 'bigint' || time < last) stop('E_PLATFORM');
  last = time;
  if (time >= end) stop('E_DEADLINE');
}
function sample(path) {
  guard();
  if (counts.lstats >= 10) stop('E_LIMIT');
  counts.lstats++;
  const stat = fs.lstatSync(path, { bigint: true });
  guard();
  const value = {};
  for (const field of fields) {
    if (typeof stat[field] !== 'bigint') stop('E_METADATA');
    value[field] = stat[field];
  }
  return value;
}
try {
  for (const path of paths) {
    let before;
    try { before = sample(path); }
    catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        rows.push({ path, state: 'UNAVAILABLE' });
        continue;
      }
      throw error;
    }
    const type = before.mode & 0o170000n;
    if (before.uid !== 0n || ![0o100000n, 0o120000n].includes(type)) stop('E_POLICY');
    let target = null;
    if (type === 0o120000n) {
      guard();
      if (counts.readlinks >= 5) stop('E_LIMIT');
      counts.readlinks++;
      const raw = fs.readlinkSync(path, { encoding: 'buffer' });
      guard();
      if (!Buffer.isBuffer(raw) || raw.length < 1 || raw.length > 4096) stop('E_LINK');
      target = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw);
      if (/[\u0000-\u001f\u007f-\u009f]/u.test(target)) stop('E_LINK');
    }
    const after = sample(path);
    if (!fields.every(field => before[field] === after[field])) stop('E_BINDING');
    rows.push({ path, state: type === 0o120000n ? 'SYMLINK' : 'REGULAR_FILE', target,
      identity: Object.fromEntries(fields.map(field => [field, before[field].toString()])) });
  }
  guard();
} catch (error) {
  failure = ['E_LIMIT', 'E_PLATFORM', 'E_DEADLINE', 'E_METADATA', 'E_POLICY', 'E_LINK', 'E_BINDING'].includes(error.code)
    ? error.code : 'E_IO';
}
const status = failure ? 'STOP' : rows.some(row => row.state === 'UNAVAILABLE') ? 'CATALOG_PARTIAL' : 'CATALOG_COMPLETE';
const base = { profile: 'xz-five-name-catalog-v1', authorization: 'autonomous-steps-1-5',
  attemptConsumed: true, status, counts, candidateExecuted: false, derivedPathsOpened: false,
  contentsRead: false, decoderQualified: false, provenanceVerified: false,
  loaderClosureVerified: false, noPythonRuntimeVerified: false, nativeQualified: false,
  rustReady: false, trainingReady: false };
let text = (JSON.stringify({ ...base, ...(failure ? { error: failure } : {}), rows }) + '\n')
  .replace(/[^\x00-\x7f]/g, unit => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0'));
if (Buffer.byteLength(text) > 32768 || !/^[\x20-\x7e\n]*$/.test(text)) {
  text = JSON.stringify({ ...base, status: 'STOP', error: 'E_OUTPUT' }) + '\n';
  failure = 'E_OUTPUT';
}
if (failure) process.exitCode = 1;
process.stdout.on('error', () => { process.exitCode = 1; });
try { process.stdout.write(text); } catch { process.exitCode = 1; }
NODE
```
<!-- END XZ FIVE NAME CATALOG V1 -->

Syntax-only parsing passed without evaluating the catalog; the3581-byte command SHA-256 is `c9e07b38adb266af39a1ba06c77233a8a8619e83cc774d9a4c18a8abb98b051a`. Required quality/security source checks accepted this exact metadata catalog only with no findings; spec review reported in-sync. Register the complete current section before execution under the new work order; no more TUI questions follow. Actual catalog results, source/version provenance and complete XZ acceptance remain pending. Do not commit step1 as completed on catalog results alone.

### 33.2 Five-name catalog outcome and versioned reader work

The registered7343-byte initial §33 had SHA-256 `2dbaf377c74675f2b0a6418a04addfdbde0aaec8a510bac5a311fec5e61aa744`; its exact catalog ran once under the new work order and returned normally with CATALOG_COMPLETE,10 lstats and3 readlinks. No regular-file contents or derived target were opened.

```json
{"profile":"xz-five-name-catalog-v1","authorization":"autonomous-steps-1-5","attemptConsumed":true,"status":"CATALOG_COMPLETE","counts":{"lstats":10,"readlinks":3},"candidateExecuted":false,"derivedPathsOpened":false,"contentsRead":false,"decoderQualified":false,"provenanceVerified":false,"loaderClosureVerified":false,"noPythonRuntimeVerified":false,"nativeQualified":false,"rustReady":false,"trainingReady":false,"rows":[{"path":"/lib64/ld-linux-x86-64.so.2","state":"SYMLINK","target":"../lib/x86_64-linux-gnu/ld-linux-x86-64.so.2","identity":{"dev":"82","ino":"8619","mode":"41471","uid":"0","gid":"0","nlink":"1","size":"44","mtimeNs":"1784741087000000000","ctimeNs":"1784741087000000000"}},{"path":"/lib/x86_64-linux-gnu/liblzma.so.5","state":"SYMLINK","target":"liblzma.so.5.8.3","identity":{"dev":"56","ino":"340","mode":"41471","uid":"0","gid":"0","nlink":"1","size":"16","mtimeNs":"1791561255000000000","ctimeNs":"1791561255000000000"}},{"path":"/usr/lib/x86_64-linux-gnu/liblzma.so.5","state":"SYMLINK","target":"liblzma.so.5.8.3","identity":{"dev":"56","ino":"340","mode":"41471","uid":"0","gid":"0","nlink":"1","size":"16","mtimeNs":"1791561255000000000","ctimeNs":"1791561255000000000"}},{"path":"/lib/x86_64-linux-gnu/libc.so.6","state":"REGULAR_FILE","target":null,"identity":{"dev":"82","ino":"3878","mode":"33261","uid":"0","gid":"0","nlink":"1","size":"2186512","mtimeNs":"1784741087000000000","ctimeNs":"1784741087000000000"}},{"path":"/usr/lib/x86_64-linux-gnu/libc.so.6","state":"REGULAR_FILE","target":null,"identity":{"dev":"82","ino":"3878","mode":"33261","uid":"0","gid":"0","nlink":"1","size":"2186512","mtimeNs":"1784741087000000000","ctimeNs":"1784741087000000000"}}]}
```

The liblzma target text is a filename/version hint only. Equal `/lib` and `/usr/lib` object identities are observed aliases, not proof of loader search order or protected ancestor resolution. Register targets literally before reading them; no automatic resolver is introduced.
Libc's observed2186512 bytes exceed the existing ELF-v1 input ceiling. Preserve v1's1MiB/profile/190-test contract; implement a distinct `inspectElf64Requirements`/v2 profile with4MiB input ceiling and bounded version/ABI/ISA/build-ID metadata, using the shared parser internals rather than silently expanding v1. The planned input remains bytes-only; no library/candidate reader enters that module.
Extend `elf-metadata.mjs` and add `elf-requirements.test.mjs`; preserve all v1 behavioral tests and add corresponding exact coverage to the existing owner diagram/index after handoff. Bound version records512, auxiliaries1024, note bytes64KiB/notes128, build-ID64 bytes and property payload4096 bytes; keep source arithmetic BigInt and all qualification flags false. Source/provenance and complete symbol resolution remain distinct from version labels and GNU declarations.
The source extension is now implemented as `inspectElf64Requirements` / `ELF_REQUIREMENTS_METADATA` / profile `elf64le-x86-64-requirements-v2`. The v1 API,1MiB/64KiB ceilings, profile and190 behavioral tests remain intact. Parent verification passed381/381 tests (190 v1 +191 requirements), three syntax checks and100% module line/branch/function coverage; only synthetic in-memory inputs ran.
V2 parses paired/unique DT_VERNEED/DT_VERDEF tags, aggregate bounded records/auxiliaries, mapped forward relative chains, exact terminal links, occupied virtual/file-span rejection, string-table references and active NEEDED filename membership. It records hashes/flags/indices/names as declarations, not actual symbol bindings.
V2 parses bounded GNU notes/build IDs/ABI/property declarations; identical physical ranges deduplicate and nonidentical overlaps STOP as unsupported. Unknown descriptors/properties emit only metadata/hashes; ISA/feature labels retain raw bits and unknown bits without CPU detection, instruction-coverage or enforcement proof. SymbolBindingsVerified/hardwareCompatibilityVerified/instructionCoverageVerified/propertyEnforcementVerified/buildIdAuthenticated remain false.
The current owner diagram/index covers source plus both test files; rendering and final spec reconciliation remain pending. Historical source pins in §§28–32 retain their revision-specific meanings and are not the new source identity.

### 33.3 Registered regular-file fingerprints and package claims

Before any decoder invocation, the next work-order operation may inspect exactly `/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2`, `/lib/x86_64-linux-gnu/liblzma.so.5.8.3`, `/lib/x86_64-linux-gnu/libc.so.6` as data and read the prospective literal `/var/lib/dpkg/status` as package-claim data. These are explicitly registered literals, not runtime-resolved dependencies. No directory enumeration, implicit alternate package manager, environment query or target following is permitted.
Use source-bound no-follow/nonblocking readonly custody, root ownership, no group/world write bits or special mode bits, nlink1, full nine-field named/FD stability, exact positional64KiB reads and EOF, complete SHA-256 and one close attempt per acquired FD. Binary-file ceiling8MiB each, status-file ceiling4MiB, aggregate data ceiling16MiB. Source attempts remain bounded to300 non-close filesystem calls plus4 closes,260 reads including EOF,4096 monotonic samples,119s work/120s total cooperative including1s finalization; shell capture timeout130s. Stop on unsupported types, short reads, stale metadata, overflow or uncertain close; missing explicitly registered files may yield PARTIAL data, not a fallback search.
Read status-file text only to report whitelisted `Package,Source,Version,Architecture,Status,Built-Using` fields for `xz-utils,liblzma5,libc6`; bound selected values to512 UTF-8 bytes, paragraphs to128KiB, paragraphs4096 and selected records3. Missing/duplicate/malformed package claims do not authenticate another context. Installed package claims and MD5 records are never publisher signatures or independently authenticated source correspondence.
The exact launcher, syntax checks and required gates must be registered before this operation. It performs no XZ/loader/library execution, real archive access, filesystem writes, package-manager command, network or cleanup. Further source/version/provenance research uses bounded public official text only; no binary/package acquisition fallback follows an unsupported local context.

<!-- BEGIN XZ REGISTERED FILE FACTS V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const start = process.hrtime.bigint(), workEnd = start + 119_000_000_000n, end = start + 120_000_000_000n;
const files = [
  { path: '/var/lib/dpkg/status', kind: 'package-status', maximum: 4194304 },
  { path: '/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2', kind: 'binary', maximum: 8388608 },
  { path: '/lib/x86_64-linux-gnu/liblzma.so.5.8.3', kind: 'binary', maximum: 8388608 },
  { path: '/lib/x86_64-linux-gnu/libc.so.6', kind: 'binary', maximum: 8388608 },
];
const fields = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs'];
const counts = { sourceReads: 0, sourceReturnedBytes: 0, fsCalls: 0, reads: 0, returnedBytes: 0, requestedBytes: 0, closes: 0 };
const rows = [];
let fd = null, last = start, clocks = 1, failure;
function stop(code) { const error = new Error(); error.code = code; throw error; }
function guard(final = false) {
  if (++clocks > 4096) stop('E_LIMIT');
  const now = process.hrtime.bigint();
  if (typeof now !== 'bigint' || now < last) stop('E_PLATFORM');
  last = now;
  if (now >= (final ? end : workEnd)) stop('E_DEADLINE');
}
function work(action) { guard(); const value = action(); guard(); return value; }
function io(action) { return work(() => { if (counts.fsCalls >= 300) stop('E_LIMIT'); counts.fsCalls++; return action(); }); }
function snapshot(stat) {
  const out = {};
  for (const field of fields) { if (typeof stat[field] !== 'bigint') stop('E_METADATA'); out[field] = stat[field]; }
  return out;
}
function same(a, b) { if (!fields.every(field => a[field] === b[field])) stop('E_BINDING'); }
function close() {
  if (fd === null) return;
  const owned = fd; fd = null; counts.closes++;
  try { fs.closeSync(owned); } catch { stop('E_CLOSE'); }
}
try {
  const parserSource = work(() => {
    counts.sourceReads++;
    const bytes = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/package-claims.mjs');
    counts.sourceReturnedBytes = bytes.length;
    return bytes;
  });
  if (parserSource.length !== 2959 || work(() => createHash('sha256').update(parserSource).digest('hex')) !== 'd24f08a95e9cb923d5be98c155ba66d5f570ae3612aab6773b77c33ed7e8427a') stop('E_SOURCE_PIN');
  guard();
  const { selectPackageClaims } = await import('file:///tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/package-claims.mjs');
  guard();
  if (typeof selectPackageClaims !== 'function') stop('E_SOURCE_PIN');
  const f = fs.constants;
  if (f.O_RDONLY !== 0 || !Number.isInteger(f.O_NOFOLLOW) || f.O_NOFOLLOW <= 0 || !Number.isInteger(f.O_NONBLOCK) || f.O_NONBLOCK <= 0) stop('E_PLATFORM');
  for (const file of files) {
    let before;
    try { before = snapshot(io(() => fs.lstatSync(file.path, { bigint: true }))); }
    catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') { rows.push({ path: file.path, kind: file.kind, state: 'UNAVAILABLE' }); continue; } throw error; }
    if ((before.mode & 0o170000n) !== 0o100000n || before.uid !== 0n || before.nlink !== 1n || (before.mode & 0o7022n) !== 0n) stop('E_POLICY');
    if (before.size < BigInt(file.kind === 'binary' ? 64 : 1) || before.size > BigInt(file.maximum) || before.size > BigInt(16777216 - counts.returnedBytes)) stop('E_LIMIT');
    io(() => { fd = fs.openSync(file.path, f.O_RDONLY | f.O_NOFOLLOW | f.O_NONBLOCK); });
    same(before, snapshot(io(() => fs.fstatSync(fd, { bigint: true }))));
    const size = Number(before.size), scratch = work(() => Buffer.alloc(65536));
    const status = file.kind === 'package-status' ? work(() => Buffer.alloc(size)) : null;
    const hash = work(() => createHash('sha256'));
    for (let offset = 0; offset < size;) {
      const want = Math.min(65536, size - offset);
      const got = io(() => {
        if (counts.reads >= 260 || counts.requestedBytes + want > 16777220) stop('E_LIMIT');
        counts.reads++; counts.requestedBytes += want;
        const count = fs.readSync(fd, scratch, 0, want, offset);
        if (!Number.isSafeInteger(count) || count < 0 || count > want) stop('E_IO');
        counts.returnedBytes += count;
        return count;
      });
      if (got !== want) stop('E_LENGTH');
      work(() => hash.update(scratch.subarray(0, got)));
      if (status !== null) scratch.copy(status, offset, 0, got);
      offset += got;
    }
    const eof = io(() => {
      if (counts.reads >= 260 || counts.requestedBytes >= 16777220) stop('E_LIMIT');
      counts.reads++; counts.requestedBytes++;
      const count = fs.readSync(fd, scratch, 0, 1, size);
      if (!Number.isSafeInteger(count) || count < 0 || count > 1) stop('E_IO');
      counts.returnedBytes += count;
      return count;
    });
    if (eof !== 0) stop('E_LENGTH');
    const sha256 = work(() => hash.digest('hex'));
    same(before, snapshot(io(() => fs.fstatSync(fd, { bigint: true }))));
    same(before, snapshot(io(() => fs.lstatSync(file.path, { bigint: true }))));
    close();
    rows.push({ path: file.path, kind: file.kind, state: 'FILE_BYTES_OBSERVED', byteLength: size, sha256,
      identity: Object.fromEntries(fields.map(field => [field, before[field].toString()])),
      ...(status !== null ? { packageClaims: work(() => selectPackageClaims(status)) } : {}) });
  }
  guard(true);
} catch (error) { failure = ['E_SOURCE_PIN', 'E_PLATFORM', 'E_LIMIT', 'E_METADATA', 'E_BINDING', 'E_POLICY', 'E_IO', 'E_LENGTH', 'E_CLOSE', 'E_PACKAGE', 'E_DEADLINE'].includes(error.code) ? error.code : 'E_IO'; }
finally { try { close(); } catch { failure = 'E_CLOSE'; } }
const base = { profile: 'xz-registered-file-facts-v1', authorization: 'autonomous-steps-1-5', attemptConsumed: true,
  status: failure ? 'STOP' : rows.some(row => row.state === 'UNAVAILABLE') ? 'FILE_FACTS_PARTIAL' : 'FILE_FACTS_COMPLETE', counts,
  candidateExecuted: false, decoderQualified: false, provenanceVerified: false, loaderClosureVerified: false,
  noPythonRuntimeVerified: false, nativeQualified: false, realArchiveInspected: false, rustReady: false, trainingReady: false };
let text = (JSON.stringify({ ...base, ...(failure ? { error: failure } : {}), rows }) + '\n').replace(/[^\x00-\x7f]/g, unit => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0'));
if (Buffer.byteLength(text) > 32768 || !/^[\x20-\x7e\n]*$/.test(text)) { text = JSON.stringify({ ...base, status: 'STOP', error: 'E_OUTPUT' }) + '\n'; failure = 'E_OUTPUT'; }
if (!failure) {
  try { guard(true); }
  catch (error) {
    failure = ['E_LIMIT', 'E_PLATFORM', 'E_DEADLINE'].includes(error.code) ? error.code : 'E_IO';
    text = JSON.stringify({ ...base, status: 'STOP', error: failure }) + '\n';
  }
}
if (failure) process.exitCode = 1;
process.stdout.on('error', () => { process.exitCode = 1; });
try { process.stdout.write(text); } catch { process.exitCode = 1; }
NODE
```
<!-- END XZ REGISTERED FILE FACTS V1 -->

The first reader draft silently discarded continuation lines. Required review identified that MEDIUM before execution; extract a pure `package-claims.mjs`/test module with explicit folded-field semantics instead. A second finding fixed case-insensitive Deb822 field names and duplicate detection. Complete folded values, including Built-Using continuations, are checked against512 UTF-8 bytes; no truncation occurs. A final post-encoding guard prevents late successful publication; output flushing/native-call completion still has no hard time guarantee. This parser reports package claims, never package-manager execution or signature verification.
The current package parser passes20 synthetic tests and syntax checks with100% line/branch/function coverage, including folded and case-insensitive fields, case-variant duplicates, value/cardinality boundaries and exact source/spec/index references. The operation separately counts one2959-byte repository source preflight read and imports only that source plus Node util. Its pin is `d24f08a95e9cb923d5be98c155ba66d5f570ae3612aab6773b77c33ed7e8427a`; hash-before-import and runtime/ancestor behavior retain the disclosed ordinary-host residual, not immutable loading or a complete filesystem graph. Host-file limits stay unchanged. Binary contents are hashed but not decoded as ELF in this operation. Required quality findings for folded/case-insensitive fields and final success deadline are closed, security reported no findings and spec correspondence is in-sync. The6859-byte current command has SHA-256 `cb742a3ea5a87946082c2f69c3b5f85f1150d415a1c18b0cecc6427526a8feb5`; whole current-section registration and actual file-fact evidence remain pending.

### 33.4 Public XZ source evidence and decoder policy

Read-only official-text research pinned XZ5.8.3 tag object `9d0743bb9629e8a55ea7b1b40b981514a1f68408` to commit `4b73f2ec19a99ef465282fbce633e8deb33691b3`; GitHub reports its signature verified, which is not independent local verification. The official latest-release API reports5.8.4, published2026-09-09. A local target name ending5.8.3 does not identify the actual package revision or authenticate its code.
Sources: [official5.8.3 tag](https://api.github.com/repos/tukaani-project/xz/git/tags/9d0743bb9629e8a55ea7b1b40b981514a1f68408), [latest release](https://api.github.com/repos/tukaani-project/xz/releases/latest), [pinned coder.c](https://raw.githubusercontent.com/tukaani-project/xz/4b73f2ec19a99ef465282fbce633e8deb33691b3/src/xz/coder.c), [args.c](https://raw.githubusercontent.com/tukaani-project/xz/4b73f2ec19a99ef465282fbce633e8deb33691b3/src/xz/args.c), [stream_decoder.c](https://raw.githubusercontent.com/tukaani-project/xz/4b73f2ec19a99ef465282fbce633e8deb33691b3/src/liblzma/common/stream_decoder.c), [file_io.c](https://raw.githubusercontent.com/tukaani-project/xz/4b73f2ec19a99ef465282fbce633e8deb33691b3/src/xz/file_io.c), [fixtures README](https://raw.githubusercontent.com/tukaani-project/xz/4b73f2ec19a99ef465282fbce633e8deb33691b3/tests/files/README).
Future fixed decoding must explicitly select `--decompress --stdout --format=xz --threads=1 --memlimit-decompress=<fixed bytes> -- -`, without `--force`, `--single-stream`, `--ignore-check`, `--no-warn`, file-list options or inherited XZ_DEFAULTS/XZ_OPT. Source enables concatenated streams and four-byte NUL padding; nonpadding trailing data fails, and physical input EOF remains required. Check=None can succeed without payload-check verification, so process success alone cannot certify every integrity check. Partial output can precede decoder failure; inventory stays provisional until complete success.
Source memory accounting is not total process RSS. Runtime still needs independently bounded compressed input, expanded output, stderr, time and child/pipe lifecycle. Source libc/CLI startup may access locale data or `/dev/null` for missing standard handles; controlled descriptors and C locale do not create a Native closure proof.
[GHSA-5qpq-xqfv-j9pg](https://api.github.com/repos/tukaani-project/xz/security-advisories/GHSA-5qpq-xqfv-j9pg) affects<=5.8.3 but explicitly excludes decoders for `.xz` and raw streams. That mode exclusion is narrow, not a blanket waiver of5.8.3 or unknown host artifacts. The [CVE-2024-3094 incident](https://tukaani.org/xz-backdoor/) demonstrates why signed source-tarball provenance and Git/tag identity must not be conflated with installed binary correspondence.
The official [Debian debuginfod service](https://debuginfod.debian.net/) and [WEBAPI](https://manpages.debian.org/unstable/debuginfod/debuginfod.8.en.html#WEBAPI) document raw ELF retrieval by build-ID, including ET_DYN objects; no executable endpoint/body has been requested. Service coverage, federation configuration and mapping to independently authenticated package/source metadata remain unproved. A later bounded counterpart SHA-256 match could establish identity to that service response, not archive signatures, reproducibility or Native authority; do not use copied build-ID notes alone as provenance.

### 33.5 Registered file-fact outcome — package claims are not provenance

The26117-byte section registration `f689af48dd2c2fe4228e8b1f15eca9018869dabf133313d749c6eab442fd77e3` bound command6859/SHA-256 `cb742a3ea5a87946082c2f69c3b5f85f1150d415a1c18b0cecc6427526a8feb5` and package parser2959/SHA-256 `d24f08a95e9cb923d5be98c155ba66d5f570ae3612aab6773b77c33ed7e8427a`. That exact operation ran once under the new work order and returned normally with FILE_FACTS_COMPLETE. Source counters report76 non-close host calls,56 reads,3304041 returned bytes,3304045 requested bytes and4 positive closes; the separate source read returned2959 bytes. No file was executed or decoded as ELF in that operation.

```json
{"profile":"xz-registered-file-facts-v1","authorization":"autonomous-steps-1-5","attemptConsumed":true,"status":"FILE_FACTS_COMPLETE","counts":{"sourceReads":1,"sourceReturnedBytes":2959,"fsCalls":76,"reads":56,"returnedBytes":3304041,"requestedBytes":3304045,"closes":4},"candidateExecuted":false,"decoderQualified":false,"provenanceVerified":false,"loaderClosureVerified":false,"noPythonRuntimeVerified":false,"nativeQualified":false,"realArchiveInspected":false,"rustReady":false,"trainingReady":false,"rows":[{"path":"/var/lib/dpkg/status","kind":"package-status","state":"FILE_BYTES_OBSERVED","byteLength":647217,"sha256":"b80b0ad97af11a79060f7f212ccc373354ab5954094176620d3756a37bdf5c2d","identity":{"dev":"32","ino":"14279","mode":"33188","uid":"0","gid":"0","nlink":"1","size":"647217","mtimeNs":"1792604285000000000","ctimeNs":"1792604285000000000"},"packageClaims":[{"Package":"libc6","Status":"install ok installed","Architecture":"amd64","Source":"glibc","Version":"2.43-2ubuntu2.3"},{"Package":"liblzma5","Status":"install ok installed","Architecture":"amd64","Source":"xz-utils","Version":"5.8.3-1ubuntu0.1"},{"Package":"xz-utils","Status":"install ok installed","Architecture":"amd64","Version":"5.8.3-1ubuntu0.1"}]},{"path":"/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2","kind":"binary","state":"FILE_BYTES_OBSERVED","byteLength":254864,"sha256":"c5e80a563850d6ab5c2f2482e4202d9c1b71fbf44854b8c399e63527202c64e1","identity":{"dev":"82","ino":"3793","mode":"33261","uid":"0","gid":"0","nlink":"1","size":"254864","mtimeNs":"1784741087000000000","ctimeNs":"1784741087000000000"}},{"path":"/lib/x86_64-linux-gnu/liblzma.so.5.8.3","kind":"binary","state":"FILE_BYTES_OBSERVED","byteLength":215448,"sha256":"515749273a91ca5e3b273b4025dc2c1f8827f90005baea0ab85ffb594e74f72f","identity":{"dev":"56","ino":"343","mode":"33188","uid":"0","gid":"0","nlink":"1","size":"215448","mtimeNs":"1791561255000000000","ctimeNs":"1791561255000000000"}},{"path":"/lib/x86_64-linux-gnu/libc.so.6","kind":"binary","state":"FILE_BYTES_OBSERVED","byteLength":2186512,"sha256":"a3947513a02831ec692ebf13053c07614882ab54a2101fb91a1b15724062ed0c","identity":{"dev":"82","ino":"3878","mode":"33261","uid":"0","gid":"0","nlink":"1","size":"2186512","mtimeNs":"1784741087000000000","ctimeNs":"1784741087000000000"}}]}
```

These package records claim Ubuntu revisions, not Debian revisions; pursue the corresponding official Ubuntu publication/source evidence rather than treating Debian service presence as the relevant authority. No independently authenticated installed-package provenance, source correspondence, decoder behavior or runtime closure follows from a local status database. Its bytes were inspected as data only; no package-manager program ran.

### 33.6 Pinned four-file ELF requirements operation

Under the new work order, register the four pinned regular ELF objects below for one same-FD read/hash/stability/close-then-parse pass using the tested requirements-v2 API. Expected byte counts, hashes and nine-field identities come from §29/33.5; mismatches STOP without accepting replacements or performing a search. Read no symlink leaf or unlisted dependency, and make no package database, network, archive or code-execution call in this operation.
Candidate host effects are capped at68 non-close calls plus4 closes,48 read attempts including EOF,2758216 returned data bytes/2758220 requested bytes, one owned FD at a time and4096 clock samples. Source preflight reads only the19842-byte repository ELF module, SHA-256 `b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85`; its Node crypto/util imports and wrapper fs retain the explicit ordinary Node/source-before-import/ancestor trust residual. Guards use119s work/120s total cooperative; tool capture130s is not hard native interruption, termination or reaping.
Emit at most262144 escaped-ASCII JSON bytes including LF, selecting input hash/length, header/interpreter/dynamic names and the complete bounded requirements object; omitted program headers/opaque dynamic pairs remain unclaimed, not hidden semantic checks. All provenance/hardware/symbol-binding/enforcement/Native/decoder/training qualification flags remain false. Current source unit has381 passing synthetic tests; actual file-format compatibility remains pending.

<!-- BEGIN XZ PINNED REQUIREMENTS V2 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const start = process.hrtime.bigint(), workEnd = start + 119_000_000_000n, end = start + 120_000_000_000n;
const files = [
  { path: '/usr/bin/xz', size: 101392, sha256: '1f6ca26fd33066c9d5b95e58a0d9e2f5789cb18fd5741518574113b37ea1934d', dev: 56n, ino: 295n, mode: 33261n, time: 1791561255000000000n },
  { path: '/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2', size: 254864, sha256: 'c5e80a563850d6ab5c2f2482e4202d9c1b71fbf44854b8c399e63527202c64e1', dev: 82n, ino: 3793n, mode: 33261n, time: 1784741087000000000n },
  { path: '/lib/x86_64-linux-gnu/liblzma.so.5.8.3', size: 215448, sha256: '515749273a91ca5e3b273b4025dc2c1f8827f90005baea0ab85ffb594e74f72f', dev: 56n, ino: 343n, mode: 33188n, time: 1791561255000000000n },
  { path: '/lib/x86_64-linux-gnu/libc.so.6', size: 2186512, sha256: 'a3947513a02831ec692ebf13053c07614882ab54a2101fb91a1b15724062ed0c', dev: 82n, ino: 3878n, mode: 33261n, time: 1784741087000000000n },
];
const sourceSha256 = 'b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85';
const fields = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs'];
const counts = { sourceReads: 0, sourceReturnedBytes: 0, fsCalls: 0, reads: 0, returnedBytes: 0, requestedBytes: 0, closes: 0 };
const rows = [];
let fd = null, last = start, clocks = 1, failure;
function stop(code) { const error = new Error(); error.code = code; throw error; }
function guard(final = false) {
  if (++clocks > 4096) stop('E_LIMIT');
  const now = process.hrtime.bigint();
  if (typeof now !== 'bigint' || now < last) stop('E_PLATFORM');
  last = now;
  if (now >= (final ? end : workEnd)) stop('E_DEADLINE');
}
function work(action) { guard(); const value = action(); guard(); return value; }
function io(action) { return work(() => { if (counts.fsCalls >= 68) stop('E_LIMIT'); counts.fsCalls++; return action(); }); }
function snapshot(stat) {
  const out = {};
  for (const key of fields) { if (typeof stat[key] !== 'bigint') stop('E_METADATA'); out[key] = stat[key]; }
  return out;
}
function same(a, b) { if (!fields.every(key => a[key] === b[key])) stop('E_BINDING'); }
function close() { if (fd !== null) { const owned = fd; fd = null; counts.closes++; try { fs.closeSync(owned); } catch { stop('E_CLOSE'); } } }
const known = ['E_INPUT', 'E_LIMITS', 'E_ELF', 'E_RANGE', 'E_PROGRAM_HEADERS', 'E_INTERPRETER', 'E_DYNAMIC', 'E_STRING_TABLE', 'E_STRING', 'E_OUTPUT', 'E_VERSIONS', 'E_NOTES', 'E_PROPERTIES', 'E_LIMIT', 'E_PLATFORM', 'E_DEADLINE', 'E_METADATA', 'E_BINDING', 'E_SOURCE_PIN', 'E_IO', 'E_LENGTH', 'E_HASH', 'E_CLOSE'];
try {
  const source = work(() => { counts.sourceReads++; const value = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/elf-metadata.mjs'); counts.sourceReturnedBytes = value.length; return value; });
  if (source.length !== 19842 || work(() => createHash('sha256').update(source).digest('hex')) !== sourceSha256) stop('E_SOURCE_PIN');
  guard();
  const { inspectElf64Requirements } = await import('file:///tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/elf-metadata.mjs');
  guard();
  if (typeof inspectElf64Requirements !== 'function') stop('E_SOURCE_PIN');
  const f = fs.constants;
  if (f.O_RDONLY !== 0 || !Number.isInteger(f.O_NOFOLLOW) || f.O_NOFOLLOW <= 0 || !Number.isInteger(f.O_NONBLOCK) || f.O_NONBLOCK <= 0) stop('E_PLATFORM');
  for (const file of files) {
    const expected = { dev: file.dev, ino: file.ino, mode: file.mode, uid: 0n, gid: 0n, nlink: 1n, size: BigInt(file.size), mtimeNs: file.time, ctimeNs: file.time };
    const before = snapshot(io(() => fs.lstatSync(file.path, { bigint: true })));
    same(before, expected);
    io(() => { fd = fs.openSync(file.path, f.O_RDONLY | f.O_NOFOLLOW | f.O_NONBLOCK); });
    same(snapshot(io(() => fs.fstatSync(fd, { bigint: true }))), before);
    const bytes = work(() => Buffer.alloc(file.size)), eof = work(() => Buffer.alloc(1));
    function read(target, destination, want, position) {
      return io(() => {
        if (counts.reads >= 48 || counts.requestedBytes + want > 2758220) stop('E_LIMIT');
        counts.reads++; counts.requestedBytes += want;
        const got = fs.readSync(fd, target, destination, want, position);
        if (!Number.isSafeInteger(got) || got < 0 || got > want) stop('E_IO');
        counts.returnedBytes += got;
        return got;
      });
    }
    for (let offset = 0; offset < file.size;) {
      const want = Math.min(65536, file.size - offset);
      if (read(bytes, offset, want, offset) !== want) stop('E_LENGTH');
      offset += want;
    }
    if (read(eof, 0, 1, file.size) !== 0) stop('E_LENGTH');
    if (work(() => createHash('sha256').update(bytes).digest('hex')) !== file.sha256) stop('E_HASH');
    same(snapshot(io(() => fs.fstatSync(fd, { bigint: true }))), before);
    same(snapshot(io(() => fs.lstatSync(file.path, { bigint: true }))), before);
    close();
    const metadata = work(() => inspectElf64Requirements(bytes));
    if (metadata.profile !== 'elf64le-x86-64-requirements-v2' || metadata.state !== 'ELF_REQUIREMENTS_METADATA' || metadata.byteLength !== file.size || metadata.inputSha256 !== file.sha256) stop('E_HASH');
    for (const key of ['candidateExecuted', 'decoderQualified', 'realCandidateRead', 'realArchiveInspected', 'provenanceVerified', 'noPythonRuntimeVerified', 'loaderClosureVerified', 'nativeAuthority', 'nativeQualified', 'installedUsability', 'rustReady', 'trainingReady']) if (metadata[key] !== false) stop('E_METADATA');
    rows.push({ path: file.path, byteLength: metadata.byteLength, sha256: metadata.inputSha256, header: metadata.header,
      interpreter: metadata.interpreter, needed: metadata.dynamic.needed, soname: metadata.dynamic.soname,
      rpath: metadata.dynamic.rpath, runpath: metadata.dynamic.runpath, requirements: metadata.requirements });
  }
} catch (error) { failure = known.includes(error.code) ? error.code : 'E_IO'; }
finally { try { close(); } catch { failure = 'E_CLOSE'; } }
const base = { profile: 'xz-pinned-requirements-v2', authorization: 'autonomous-steps-1-5', attemptConsumed: true,
  status: failure ? 'STOP' : 'REQUIREMENTS_METADATA', sourceSha256, counts, candidateExecuted: false,
  provenanceVerified: false, decoderQualified: false, loaderClosureVerified: false, noPythonRuntimeVerified: false,
  nativeQualified: false, realArchiveInspected: false, rustReady: false, trainingReady: false };
let text = (JSON.stringify({ ...base, ...(failure ? { error: failure } : {}), rows }) + '\n').replace(/[^\x00-\x7f]/g, unit => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0'));
if (Buffer.byteLength(text) > 262144 || !/^[\x20-\x7e\n]*$/.test(text)) { failure = 'E_OUTPUT'; text = JSON.stringify({ ...base, status: 'STOP', error: failure }) + '\n'; }
if (!failure) { try { guard(true); } catch (error) { failure = known.includes(error.code) ? error.code : 'E_IO'; text = JSON.stringify({ ...base, status: 'STOP', error: failure }) + '\n'; } }
if (failure) process.exitCode = 1;
process.stdout.on('error', () => { process.exitCode = 1; });
try { process.stdout.write(text); } catch { process.exitCode = 1; }
NODE
```
<!-- END XZ PINNED REQUIREMENTS V2 -->

Syntax-only parsing passed for the7235-byte command SHA-256 `264bb0279cfdb847d68d6951f78f09761540eb883ab870c28f1cb958cbb0267c`, without evaluation. Required quality/security source gates accepted this exact data operation with no findings; the current source19842/SHA-256 `b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85` matches the tested381-case unit. Register the complete current section before use under the autonomous work order. No second operation or fallback follows a failed or unsupported parse. These are ordinary source-bounded data operations, not a private F9 invocation or executable loading proof; actual requirements results remain pending.

### 33.7 Requirements outcome — four pinned byte images, not executed

The39133-byte section registration `50f0677a0b599cec919c1ef489b7598afdaa9611c847b756d0055e7b23dc1b46` bound command7235/SHA-256 `264bb0279cfdb847d68d6951f78f09761540eb883ab870c28f1cb958cbb0267c` and source19842/SHA-256 `b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85`. The exact operation returned normally with REQUIREMENTS_METADATA,68 non-close calls,48 reads,2758216 returned/2758220 requested bytes and4 successful closes before parsing. Source preflight read19842 bytes separately. No image was executed and no dynamic name was followed.
The following is a selected parent transcription of returned fields, not a raw authenticated process transcript:

| Pinned object | SHA-256 | GNU build-ID | Declared dependencies |
| --- | --- | --- | --- |
| `/usr/bin/xz` | `1f6ca26fd33066c9d5b95e58a0d9e2f5789cb18fd5741518574113b37ea1934d` | `a99aaf17395b7ec6f2bc5d08f127a6053724b16e` | `liblzma.so.5`, `libc.so.6` |
| `/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2` | `c5e80a563850d6ab5c2f2482e4202d9c1b71fbf44854b8c399e63527202c64e1` | `d4bfd49ced9d6e19bb77f23bf6872b8d270a9712` | none |
| `/lib/x86_64-linux-gnu/liblzma.so.5.8.3` | `515749273a91ca5e3b273b4025dc2c1f8827f90005baea0ab85ffb594e74f72f` | `30ae5b7526e4526b7d1517a25e3ea70820ded934` | `libc.so.6` |
| `/lib/x86_64-linux-gnu/libc.so.6` | `a3947513a02831ec692ebf13053c07614882ab54a2101fb91a1b15724062ed0c` | `240c8909736b31f963346aca80667fd00c551e32` | `ld-linux-x86-64.so.2` |

All four report no active RPATH/RUNPATH. Loader SONAME is `ld-linux-x86-64.so.2`, liblzma SONAME is `liblzma.so.5`, libc SONAME is `libc.so.6`; XZ has no SONAME. XZ/libc interpreter remains `/lib64/ld-linux-x86-64.so.2`; the loader/liblzma report no interpreter.
XZ requires declared libc versions GLIBC_2.3,2.6,2.32,2.8,2.14,2.33,2.4,2.7,2.17,2.34,2.3.4,2.2.5 and liblzma versions XZ_5.6.0,5.2,5.4,5.0. Liblzma requires GLIBC_2.3.4,2.32,2.14,2.34,2.4,2.6,2.3.2,2.17,2.2.5. Libc requires loader versions GLIBC_2.2.5,2.3,2.35,GLIBC_PRIVATE. The recorded provider definitions contain those names; this is declaration compatibility, not actual symbol binding or loader-choice proof.
XZ/libc report GNU ABI Linux3.2.0 and baseline ISA bits1. All four report feature bits3 labeled IBT/SHSTK; loader/liblzma have no reported ISA-needed property. Properties do not establish actual instruction coverage, hardware capability or enforcement. Every requirements-verification/authentication flag remains false. Build-ID notes remain unauthenticated labels until independent provenance is established.
Step1 remains INCOMPLETE: installed-package claims, source behavior and declared requirements do not authenticate host bytes or authorize execution. Next verify independent Ubuntu publication evidence, exact package/member byte equality and controlled finite decoder behavior; retain all original Native/F9 and training restrictions.

### 33.8 Independent publication-comparison source units

Architecture consultation accepted a bootstrap-breaking validation path conditionally: verify signed Ubuntu Release metadata under an independently expected full key fingerprint, authenticate exact index/package hashes, and compare selected `.deb` data-member bytes with host fingerprints WITHOUT invoking XZ to decode its own provenance package. Missing key trust, historical metadata or supported compression means STOP, not a replacement package/mirror/decoder.
The new `release-signature.mjs`/test unit uses Node crypto/util only: v4 RSA primary-key clear-signatures, SHA256/SHA512, bounded packets/armor/MPI/subpackets and full PKCS1 v1.5 preimage verification. Full externally supplied fingerprint is mandatory; issuer hints never choose a key. Canonicalization handles dash escapes, ASCII trailing whitespace and CRLF/final-line semantics. Independent literal signed-preimage fixtures are used; no real key or Release has been authenticated yet.
Signature mathematics returns `signatureVerified:true` only under the supplied key; publisherTrustEstablished/publicKeyAuthenticated/nativeQualified remain false. No key revocation/expiry/current-security proof follows. `selectReleaseIndex` extracts the exact case-insensitive, duplicate-rejecting Release row and repository identity from the same canonical text; its own signatureVerified remains false. Unselected empty index rows are supported, while selected transport size must be1..16MiB. Real trust anchors remain unresolved and are not silently accepted by this module.
The new `deb-members.mjs`/test unit authenticates an expected complete package length/SHA-256 before strict three-member AR parsing. It never installs, writes, executes or decodes control scripts. Data gzip uses reported complete input consumption; zstd requires one fully framed, no-dictionary bounded-window frame and Node's bounded builtin decompressor. Data `.xz` and unsupported container/frame forms STOP without candidate fallback. Input<=8MiB, decoded<=64MiB, zstd window<=64MiB, target count<=8 and JSON<=64KiB are source ceilings, not native process RSS proof.
The additive `createTarMemberInventory` shares the existing TAR state machine and returns final regular-file payload spans only after complete validation; original feed events/summary/hash behavior remains unchanged. Spans count consumed physical bytes through GNU/PAX states and have their own4MiB serialized cap. Comparison hashes exact selected regular-file payloads and rejects link substitution. Package/member matches do not authenticate the caller's expectations or prove source/provenance/NoPython/Native/runtime qualification.
Current source/tests, actual publication-source/key trust and real-package compatibility require independent parent verification and required gates before use. All fixtures remain synthetic in-memory; no package/executable body has been fetched and no candidate/loader/XZ has run. Existing signed-byte expectations and all old source receipts remain revision-scoped.
The parent independently ran all seven affected in-memory suites:1125/1125 tests passed,0 failures/cancelled/skipped/todo, with13 syntax checks. Scopes are381 ELF v1/v2,20 package claims,119 signature/Release,332 TAR including27 span tests,73 mock controller and200 DEB comparisons. Production module line/function coverage is100% except release-signature99.02% lines and deb-members99.29% lines; those defensive error paths remain explicitly uncovered. No actual package or key was used in these tests, and no physical-fixture acquisition/custody suite ran.
The DEB parser additionally validates octal AR mode bytes. The Release extractor supports zero-byte unselected indexes while requiring a positive selected transport; both have persisted regression cases. Source-owned diagrams/index entries link all affected files. Current rendering and required cryptographic/DEB source review remain pending; do not promote source tests into software provenance.

### 33.9 Registered public key/Release mathematics operation

The work order next permits bounded read-only evidence collection from four exact official/public metadata URLs below. The archive keyring and keyserver response are independent, explicitly registered representations, not fallback executable acquisitions. Request each literal at most once; record non200/redirect locations as data without following them. No package/archive/executable body, host key file, candidate/library/SDK path or filesystem write is included.
The expected full fingerprint `F6ECB3762474EDA9D21B7022871920D1991BC93C` comes from the hashed issuer-fingerprint declaration in the official Ubuntu HTTPS-served InRelease described by the public research; it is not independently authenticated key ownership or a value inferred from the downloaded key itself. This operation observes signature mathematics under that exact pin only. PublisherTrustEstablished/publicKeyAuthenticated/provenanceVerified/Native/decoder/training remain false even if verification succeeds. Selecting a trustworthy key/source and accepting historical freshness remains a separate qualification obligation.
Pin the repository verifier before import, cap each body at1MiB and total at4MiB, chunks1..1MiB with<=4096 reads, one Fetch invocation per URL, no redirects/retries,120s cooperative envelope/119s work and bounded API cancellation<=1s within that envelope. Opaque Fetch startup/DNS/TLS/proxy/internal-attempt/buffering/socket behavior remains ordinary trusted integration, not independently bounded native transport or protected closure. The tool capture timeout130s does not establish process termination or reaping. Emit only selected descriptors/evidence hashes, escaped ASCII<=64KiB; no raw key/release body or error message is emitted.

<!-- BEGIN UBUNTU RELEASE MATH V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { types } from 'node:util';
const start = process.hrtime.bigint(), workEnd = start + 119_000_000_000n, end = start + 120_000_000_000n;
const expectedFingerprint = 'F6ECB3762474EDA9D21B7022871920D1991BC93C';
const sourceSha256 = '296cc8b4624030e54b05d60d875f67a69ea8273bff78ad0771d29f915aeea7f6';
const targets = [
  { label: 'archive-keyring', kind: 'key', url: 'https://archive.ubuntu.com/ubuntu/project/ubuntu-archive-keyring.gpg' },
  { label: 'keyserver-key', kind: 'key', url: 'https://keyserver.ubuntu.com/pks/lookup?op=get&search=0xF6ECB3762474EDA9D21B7022871920D1991BC93C' },
  { label: 'current-release', kind: 'release', url: 'https://security.ubuntu.com/ubuntu/dists/resolute-security/InRelease' },
  { label: 'historical-release', kind: 'release', url: 'https://snapshot.ubuntu.com/ubuntu/20260801T000000Z/dists/resolute-security/InRelease' },
];
const counts = { sourceReads: 0, fetchCalls: 0, bodyReads: 0, bodyBytes: 0, cancelAttempts: 0 };
const rows = [], bodies = new Map(), checks = [];
const abort = new AbortController();
const timer = setTimeout(() => abort.abort(), 119000);
let last = start, clocks = 1, failure;
function stop(code) { const error = new Error(); error.code = code; throw error; }
function guard(final = false) {
  if (++clocks > 20000) stop('E_LIMIT');
  const now = process.hrtime.bigint();
  if (typeof now !== 'bigint' || now < last) stop('E_PLATFORM');
  last = now;
  if (now >= (final ? end : workEnd)) stop('E_DEADLINE');
}
async function cancel(body) {
  if (!body) return;
  counts.cancelAttempts++;
  let timeout;
  const delay = Math.max(0, Math.min(1000, Number((end - process.hrtime.bigint()) / 1000000n)));
  try { await Promise.race([body.cancel(), new Promise((resolve, reject) => { timeout = setTimeout(() => reject(new Error('E_CLEANUP')), delay); })]); }
  catch { stop('E_CLEANUP'); }
  finally { clearTimeout(timeout); }
}
async function capture(target) {
  guard();
  counts.fetchCalls++;
  const response = await fetch(target.url, { method: 'GET', redirect: 'manual', credentials: 'omit', cache: 'no-store', signal: abort.signal, headers: { 'Accept-Encoding': 'identity' } });
  guard();
  if (response.url !== target.url || response.redirected) { await cancel(response.body); stop('E_URL'); }
  if (response.status !== 200) {
    const location = response.headers.get('location');
    if (location !== null && (location.length > 2048 || /[^\x20-\x7e]/.test(location))) { await cancel(response.body); stop('E_HEADERS'); }
    await cancel(response.body);
    return { label: target.label, url: target.url, state: 'UNAVAILABLE', httpStatus: response.status, location };
  }
  const encoding = response.headers.get('content-encoding'), length = response.headers.get('content-length');
  if ((encoding !== null && encoding.toLowerCase() !== 'identity') ||
      (length !== null && (!/^[1-9][0-9]*$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > 1048576))) { await cancel(response.body); stop('E_HEADERS'); }
  if (!response.body) stop('E_BODY');
  const reader = response.body.getReader(), chunks = [];
  let total = 0;
  try {
    while (true) {
      guard();
      if (counts.bodyReads >= 4096) stop('E_LIMIT');
      counts.bodyReads++;
      const step = await reader.read();
      guard();
      if (step.done) break;
      const value = step.value;
      if (types.isProxy(value) || !types.isUint8Array(value) || value.byteLength < 1 || value.byteLength > 1048576 || value.byteLength > 1048576 - total || value.byteLength > 4194304 - counts.bodyBytes) stop('E_BODY');
      const bytes = Buffer.from(value);
      total += bytes.length; counts.bodyBytes += bytes.length; chunks.push(bytes);
    }
  } catch (error) { await cancel(reader); throw error; }
  finally { reader.releaseLock(); }
  if (!total || (length !== null && total !== Number(length))) stop('E_BODY');
  const bytes = Buffer.concat(chunks, total);
  bodies.set(target.label, bytes);
  return { label: target.label, url: target.url, state: 'BODY_CAPTURED', httpStatus: 200, byteLength: total, sha256: createHash('sha256').update(bytes).digest('hex') };
}
const known = ['E_LIMIT', 'E_PLATFORM', 'E_DEADLINE', 'E_CLEANUP', 'E_URL', 'E_HEADERS', 'E_BODY', 'E_SOURCE_PIN', 'E_INPUT', 'E_ARMOR', 'E_PACKET', 'E_KEY', 'E_SIGNATURE', 'E_RELEASE'];
try {
  counts.sourceReads++;
  const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/release-signature.mjs');
  if (source.length !== 16186 || createHash('sha256').update(source).digest('hex') !== sourceSha256) stop('E_SOURCE_PIN');
  guard();
  const helper = await import('data:text/javascript;base64,' + source.toString('base64'));
  guard();
  if (typeof helper.verifyReleaseSignature !== 'function' || typeof helper.selectReleaseIndex !== 'function') stop('E_SOURCE_PIN');
  for (const target of targets) {
    try { rows.push(await capture(target)); }
    catch (error) {
      if (abort.signal.aborted || ['E_LIMIT', 'E_PLATFORM', 'E_DEADLINE', 'E_CLEANUP'].includes(error.code)) throw error;
      rows.push({ label: target.label, url: target.url, state: 'FETCH_ERROR', error: known.includes(error.code) ? error.code : 'E_FETCH' });
    }
  }
  for (const release of targets.filter(target => target.kind === 'release')) {
    if (!bodies.has(release.label)) continue;
    for (const key of targets.filter(target => target.kind === 'key')) {
      if (!bodies.has(key.label)) continue;
      guard();
      let evidence;
      try { evidence = helper.verifyReleaseSignature(bodies.get(release.label), bodies.get(key.label), expectedFingerprint); }
      catch (error) {
        checks.push({ release: release.label, key: key.label, signatureVerified: false, error: known.includes(error.code) ? error.code : 'E_INPUT' });
        guard();
        continue;
      }
      let indexes = [], indexError = null;
      try {
        indexes = ['main/binary-amd64/Packages.gz', 'main/binary-amd64/Packages', 'main/source/Sources.gz', 'main/source/Sources'].map(indexPath => helper.selectReleaseIndex(evidence.canonicalText, { origin: 'Ubuntu', suite: 'resolute-security', codename: 'resolute', indexPath }));
        if (indexes.some(index => index.signedTextSha256 !== evidence.signedTextSha256)) stop('E_RELEASE');
      } catch (error) { indexes = []; indexError = known.includes(error.code) ? error.code : 'E_INPUT'; }
      checks.push({ release: release.label, key: key.label, signatureVerified: true, signerFingerprint: evidence.signerFingerprint,
        hashAlgorithm: evidence.hashAlgorithm, signedTextSha256: evidence.signedTextSha256,
        publisherTrustEstablished: false, publicKeyAuthenticated: false,
        indexSelectionComplete: indexError === null, indexError, indexes });
      guard();
    }
  }
  guard(true);
} catch (error) { failure = known.includes(error.code) ? error.code : abort.signal.aborted ? 'E_DEADLINE' : 'E_FETCH'; abort.abort(); }
finally { clearTimeout(timer); }
const base = { profile: 'ubuntu-release-math-v1', authorization: 'autonomous-steps-1-5', attemptConsumed: true,
  status: failure ? 'STOP' : 'METADATA_EVIDENCE', expectedFingerprint, sourceSha256, counts,
  candidateExecuted: false, packageBodiesFetched: false, hostKeyFilesRead: false, publisherTrustEstablished: false,
  publicKeyOwnershipIndependentlyVerified: false, provenanceVerified: false, decoderQualified: false,
  nativeQualified: false, realArchiveInspected: false, rustReady: false, trainingReady: false };
let text = (JSON.stringify({ ...base, ...(failure ? { error: failure } : {}), rows, checks }) + '\n').replace(/[^\x00-\x7f]/g, unit => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0'));
if (Buffer.byteLength(text) > 65536 || !/^[\x20-\x7e\n]*$/.test(text)) { failure = 'E_OUTPUT'; text = JSON.stringify({ ...base, status: 'STOP', error: failure }) + '\n'; }
if (!failure) { try { guard(true); } catch { failure = 'E_DEADLINE'; text = JSON.stringify({ ...base, status: 'STOP', error: failure }) + '\n'; } }
if (failure) process.exitCode = 1;
process.stdout.on('error', () => { process.exitCode = 1; });
try { process.stdout.write(text); } catch { process.exitCode = 1; }
NODE
```
<!-- END UBUNTU RELEASE MATH V1 -->

Required review identified verifier hash/import binding and signature/index-state conflation before execution. The revised launcher imports a data URL built only from the same private source bytes whose exact length/hash passed, with Node crypto/util as its only imports; it never reopens the mutable verifier pathname for execution. Signature mathematics and index-selection completion now have separate result fields. Runtime/builtin/module-loader trust remains ordinary and unqualified, not a Native execution proof.
The revised8266-byte command has SHA-256 `5caf041eb93efbbe97f1d27bbbb0b8171b848570f80469e106e78fab8e17c42b`. Syntax-only parsing passed without evaluating the operator; a separate benign exact-source data-URL import confirmed its builtin-only imports. Required quality review closed the source-binding HIGH and status-conflation MEDIUM; security accepted metadata observation only and spec correspondence is in-sync. Register the current complete section before use. Unsupported mathematical forms, missing references or invalid signatures never authorize package retrieval or decoder execution. Actual signature results remain pending; network service absence/redirect metadata supplies no mirror fallback.

### 33.10 Signature-math observation and exact index-layout correction

The57487-byte section registration `5c2302959ff63def128289c06236d0e4d90a3e8866a71da272730bb99f855c96` bound command8266/SHA-256 `5caf041eb93efbbe97f1d27bbbb0b8171b848570f80469e106e78fab8e17c42b` and exact captured verifier16186/SHA-256 `296cc8b4624030e54b05d60d875f67a69ea8273bff78ad0771d29f915aeea7f6`. That operation returned normally with METADATA_EVIDENCE,4 Fetch invocations,37 body-read calls,283160 returned body bytes and0 cancellation calls.
All four URLs returned200 without redirection. Captured metadata identities were archive keyring3607/SHA-256 `80a36b0a6de2f69f49d2df75ef473ccde121e9e190b9ea01d20a4f63778d5c31`; keyserver key4747/`85309b698b7bdac6f21de64aa1eaa998470bbd9c8c853ea274d0c27a95013210`; current Release137403/`09e8bd092a1685a7a9fcacfbf8cb7ef803b797fb07ee642c1a2df83e747f7d2d`; historical Release137403/`7de474265e3601abfb8f4bbdeb8f5ff0551243e83f64253de3f6061780a77c9d`.
Both Release documents verified mathematically under BOTH registered key representations and the exact F6ECB3762474EDA9D21B7022871920D1991BC93C pin with SHA512. Canonical text SHA-256 values were current `e415f3381bfa5b988d666c76aed9dc8f0292a915231b35711e956826879d700e` and historical `87212ec2441bcc78a2d336242ed2386f132a1f59bc348aa12813baba7590a4b7`. All key-ownership/publisher/provenance/decoder/Native flags remained false; no package body, host key file, candidate or archive was used.
Index selection failed separately with E_RELEASE, without relabeling successful signature verification. A public-text layout diagnostic found450 SHA256 rows and ordinary unselected Ubuntu dep11 names such as `main/dep11/icons-128x128@2.tar.gz`; the strict filename grammar had excluded `@`. The first Code Mode diagnostic exposed no readable-stream API and failed before a body read; the second used the ordinary text integration with a post-return1MiB check, explicitly not a hard integration-buffer bound. Neither diagnostic touched host files or code.
The corrected filename subset adds literal `@` within relative components only; absolute paths, dot/parent components, repeated separators, percent escapes, backslashes, query/fragment/colon forms and duplicates remain rejected. The120-case synthetic signature/selector suite passes with a regression for signed unselected dep11 names; cryptographic verification and trust flags are unchanged. This is a new source revision, not an instruction to rerun an old registered command with changed bytes.

### 33.11 Pinned signed-index extraction operation

Under the new work order, fetch only the three already observed metadata byte images below with exact sizes/hashes, then verify signatures and extract the four registered index descriptors with the corrected, captured-source verifier. No keyserver reread, package/body acquisition, redirect, mirror fallback, host/candidate/library/SDK access or filesystem write occurs. Body changes STOP; do not silently accept a refreshed Release as the same input.
Each response is bounded by its exact expected size, total278413 bytes,<=2048 stream reads and chunks<=1MiB. Use119s work/120s total cooperative guards, bounded API cancellation<=1s,130s capture and escaped ASCII output<=32KiB. Fetch runtime/TLS/proxy/buffering/socket/closure remains the disclosed ordinary integration, not independently enforced native containment.
The expected fingerprint remains externally pinned, never read from the received key as authority. Signature-bound descriptors are mathematical evidence under that exact key; key ownership, publisher-trust acceptance, current-security freshness and Native authority remain unclaimed. Historical signed metadata proves at most historical association, not current security support.

<!-- BEGIN UBUNTU PINNED INDEX REFS V2 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const start = process.hrtime.bigint(), workEnd = start + 119_000_000_000n, end = start + 120_000_000_000n;
const sourceSha256 = '8872e764335f4c9402923c4b6a2ef595846485f342fa2e8d4dd459c12bfd5aab';
const fingerprint = 'F6ECB3762474EDA9D21B7022871920D1991BC93C';
const targets = [
  { label: 'archive-keyring', url: 'https://archive.ubuntu.com/ubuntu/project/ubuntu-archive-keyring.gpg', size: 3607, sha256: '80a36b0a6de2f69f49d2df75ef473ccde121e9e190b9ea01d20a4f63778d5c31' },
  { label: 'current-release', url: 'https://security.ubuntu.com/ubuntu/dists/resolute-security/InRelease', size: 137403, sha256: '09e8bd092a1685a7a9fcacfbf8cb7ef803b797fb07ee642c1a2df83e747f7d2d' },
  { label: 'historical-release', url: 'https://snapshot.ubuntu.com/ubuntu/20260801T000000Z/dists/resolute-security/InRelease', size: 137403, sha256: '7de474265e3601abfb8f4bbdeb8f5ff0551243e83f64253de3f6061780a77c9d' },
];
const counts = { sourceReads: 0, fetchCalls: 0, reads: 0, bodyBytes: 0, cancellations: 0 };
const bodies = [], observations = [], releases = [];
let last = start, clocks = 1, failure;
const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 119000);
const known = ['E_SOURCE_PIN', 'E_PLATFORM', 'E_DEADLINE', 'E_LIMIT', 'E_HTTP', 'E_HEADERS', 'E_LENGTH', 'E_HASH', 'E_BODY', 'E_CLEANUP', 'E_INPUT', 'E_ARMOR', 'E_PACKET', 'E_KEY', 'E_SIGNATURE', 'E_RELEASE', 'E_OUTPUT'];
function stop(code) { const error = new Error(); error.code = code; throw error; }
function guard(final = false) {
  if (++clocks > 20000) stop('E_LIMIT');
  const now = process.hrtime.bigint();
  if (typeof now !== 'bigint' || now < last) stop('E_PLATFORM');
  last = now;
  if (now >= (final ? end : workEnd)) stop('E_DEADLINE');
}
async function cancel(body) {
  if (!body) return;
  counts.cancellations++;
  let cleanup;
  const delay = Math.max(0, Math.min(1000, Number((end - process.hrtime.bigint()) / 1000000n)));
  try { await Promise.race([body.cancel(), new Promise((resolve, reject) => { cleanup = setTimeout(() => reject(new Error()), delay); })]); }
  catch { stop('E_CLEANUP'); }
  finally { clearTimeout(cleanup); }
}
try {
  counts.sourceReads++;
  const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/release-signature.mjs');
  if (source.length !== 16188 || createHash('sha256').update(source).digest('hex') !== sourceSha256) stop('E_SOURCE_PIN');
  guard();
  const helper = await import('data:text/javascript;base64,' + source.toString('base64'));
  guard();
  for (const target of targets) {
    guard(); counts.fetchCalls++;
    const response = await fetch(target.url, { method: 'GET', redirect: 'error', credentials: 'omit', cache: 'no-store', signal: abort.signal, headers: { 'Accept-Encoding': 'identity' } });
    guard();
    if (response.status !== 200 || response.url !== target.url || response.redirected) { await cancel(response.body); stop('E_HTTP'); }
    const encoding = response.headers.get('content-encoding'), length = response.headers.get('content-length');
    if ((encoding !== null && encoding.toLowerCase() !== 'identity') || (length !== null && length !== String(target.size))) { await cancel(response.body); stop('E_HEADERS'); }
    if (!response.body) stop('E_BODY');
    const reader = response.body.getReader(), chunks = [];
    let bytesRead = 0;
    try {
      while (true) {
        guard(); if (counts.reads >= 2048) stop('E_LIMIT'); counts.reads++;
        const step = await reader.read(); guard();
        if (step.done) break;
        if (!(step.value instanceof Uint8Array) || step.value.byteLength < 1 || step.value.byteLength > 1048576 || step.value.byteLength > target.size - bytesRead || step.value.byteLength > 278413 - counts.bodyBytes) stop('E_LENGTH');
        const chunk = Buffer.from(step.value); chunks.push(chunk); bytesRead += chunk.length; counts.bodyBytes += chunk.length;
      }
    } catch (error) { await cancel(reader); throw error; }
    finally { reader.releaseLock(); }
    if (bytesRead !== target.size) stop('E_LENGTH');
    const bytes = Buffer.concat(chunks, bytesRead);
    if (createHash('sha256').update(bytes).digest('hex') !== target.sha256) stop('E_HASH');
    bodies.push(bytes); observations.push({ label: target.label, byteLength: bytesRead, sha256: target.sha256 });
  }
  for (let index = 1; index < targets.length; index++) {
    guard();
    const evidence = helper.verifyReleaseSignature(bodies[index], bodies[0], fingerprint);
    guard();
    const indexes = ['main/binary-amd64/Packages.gz', 'main/binary-amd64/Packages', 'main/source/Sources.gz', 'main/source/Sources'].map(indexPath => helper.selectReleaseIndex(evidence.canonicalText, { origin: 'Ubuntu', suite: 'resolute-security', codename: 'resolute', indexPath }));
    if (indexes.some(ref => ref.signedTextSha256 !== evidence.signedTextSha256)) stop('E_RELEASE');
    releases.push({ label: targets[index].label, signatureVerified: evidence.signatureVerified,
      signerFingerprint: evidence.signerFingerprint, hashAlgorithm: evidence.hashAlgorithm,
      signedTextSha256: evidence.signedTextSha256, indexSelectionComplete: true, signatureBoundDescriptors: true, indexes });
  }
  guard(true);
} catch (error) { failure = known.includes(error.code) ? error.code : abort.signal.aborted ? 'E_DEADLINE' : 'E_FETCH'; abort.abort(); }
finally { clearTimeout(timer); }
const base = { profile: 'ubuntu-pinned-index-refs-v2', authorization: 'autonomous-steps-1-5', attemptConsumed: true,
  status: failure ? 'STOP' : 'SIGNATURE_BOUND_INDEX_REFS', sourceSha256, expectedFingerprint: fingerprint, counts,
  publisherTrustEstablished: false, publicKeyOwnershipIndependentlyVerified: false,
  provenanceVerified: false, decoderQualified: false, nativeQualified: false,
  candidateExecuted: false, packageBodiesFetched: false, realArchiveInspected: false, rustReady: false, trainingReady: false };
let text = (JSON.stringify({ ...base, ...(failure ? { error: failure } : {}), observations, releases }) + '\n').replace(/[^\x00-\x7f]/g, unit => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0'));
if (Buffer.byteLength(text) > 32768 || !/^[\x20-\x7e\n]*$/.test(text)) { failure = 'E_OUTPUT'; text = JSON.stringify({ ...base, status: 'STOP', error: failure }) + '\n'; }
if (!failure) { try { guard(true); } catch { failure = 'E_DEADLINE'; text = JSON.stringify({ ...base, status: 'STOP', error: failure }) + '\n'; } }
if (failure) process.exitCode = 1;
process.stdout.on('error', () => { process.exitCode = 1; });
try { process.stdout.write(text); } catch { process.exitCode = 1; }
NODE
```
<!-- END UBUNTU PINNED INDEX REFS V2 -->

Syntax-only parsing passed without evaluating the6680-byte new descriptor command, SHA-256 `123b21a1b7d7c21b93068f4569d4eb4234f701df8808bb313367e4ebd2c8c1ae`. The corrected verifier16188/SHA-256 `8872e764335f4c9402923c4b6a2ef595846485f342fa2e8d4dd459c12bfd5aab` matches its120-case synthetic suite. Required quality/security source gates accepted this exact metadata-only revision with no findings; active navigation is reconciled. Register complete current-section identity before use. Do not rerun an older consumed command with a new verifier or accept changed metadata under an old input pin. No package acquisition or decoder execution is authorized by a mere descriptor result.

### 33.12 Signed-index references observed; package-reference source unit

The68717-byte section registration `60b093e0ed924d6cec64631a8624766f82ff3e3b85030b53c4d2453ea7461074` bound command6680/SHA-256 `123b21a1b7d7c21b93068f4569d4eb4234f701df8808bb313367e4ebd2c8c1ae` and captured verifier16188/SHA-256 `8872e764335f4c9402923c4b6a2ef595846485f342fa2e8d4dd459c12bfd5aab`. It returned normally with SIGNATURE_BOUND_INDEX_REFS:3 Fetch calls,34 stream reads,278413 body bytes,0 cancellations. All three metadata byte pins matched exactly; both signatures and index selection succeeded. No package body or code was retrieved/executed.
Current canonical text SHA-256 remains `e415f3381bfa5b988d666c76aed9dc8f0292a915231b35711e956826879d700e`; historical remains `87212ec2441bcc78a2d336242ed2386f132a1f59bc348aa12813baba7590a4b7`. Both verify SHA512 under the exact2018 Ubuntu archive-key fingerprint; official archive keyring3607/SHA-256 `80a36b0a6de2f69f49d2df75ef473ccde121e9e190b9ea01d20a4f63778d5c31` supplied the same public key observed independently in the keyserver representation. This is pinned-key signature mathematics with official-HTTPS origin evidence, not independent out-of-band ownership, key revocation/current-security or Native proof. Module trust/provenance flags remain false.

| Release / exact relative index | Bytes | SHA-256 |
| --- | ---: | --- |
| Current `main/binary-amd64/Packages.gz` | 744998 | `5f113f573482190912c54e97deb1e67322228ea13a0dbd71f9b5986a7055781b` |
| Current `main/binary-amd64/Packages` | 3192760 | `c69a86813b52e0db2a7820d7a9c54dff5afc7a635fc58812e9928e6299beb2c5` |
| Current `main/source/Sources.gz` | 238139 | `f444e4123e85fc5ea74e75382e52b4540dff2583abc7ca508ac610b3316b12db` |
| Current `main/source/Sources` | 913429 | `d20a5ba5b0a61223879a64c3252b10bcf59beb026c2230503d11fe792fa33312` |
| Historical `main/binary-amd64/Packages.gz` | 419445 | `4710f1391e6ba21bdfdba2821b9b7329d1eb380a34655f12a3ebdb9cda164825` |
| Historical `main/binary-amd64/Packages` | 1755135 | `84c0b668c6f8641096baddfefe4fd94c54c9fea66b68ea5bce49b59226685567` |
| Historical `main/source/Sources.gz` | 167963 | `d80701f92cf534551629c530c3cb75cbf9f077a6e4001e763b9f91c4576a102e` |
| Historical `main/source/Sources` | 656733 | `018609131ef667de0161986258d59464c8c8ecb5ecce35f3c84d54843a368c6e` |

Current signed Date is `Fri, 23 Oct 2026  7:41:02 UTC`; historical is `Fri, 31 Jul 2026  8:42:38 UTC`. Neither has Valid-Until. Treat historical membership as historical association, not security freshness or an allowance to replace an installed revision.
The new `package-index.mjs`/test unit selects exact package/version/architecture/source-name/source-version stanzas only after matching complete private index bytes to an independently expected length/SHA-256. It folds case-insensitive fields and continuations, rejects missing/late ambiguous matches and unsafe Filename/size/hash, preserves requested order and returns inert frozen references. No newer/older version, amd64v3 or another source revision substitutes for the requested amd64 entry.
Source ceilings are input16MiB, paragraph128KiB/count65536, selected8/value1024 bytes, package8MiB and JSON64KiB, lower-only. Pure extraction leaves signature/provenance/source/Native/decoder/Rust/training flags false; the caller must maintain the signature-to-index-byte chain. Parent verification passed102 in-memory tests, both syntax checks and100% line/function coverage (99.42% branches), including unexpected-error normalization and exact owner/index coverage. Current source10025/SHA-256 `4f3bd4cfcd0f79cac0504b3cac46ee949a45c43f12baa27f0aaff144bbf16150` remains uncommitted with the other step1 work; source gates precede real use.

### 33.13 Registered exact package-index operation

Fetch only the current/historical Packages.gz URLs below with exact signed-bound compressed lengths/hashes. Before selecting stanzas, use Node's builtin bounded gunzip, require full compressed-input consumption, and independently compare decoded lengths/SHA-256 with the uncompressed references in §33.12. Decode output cap4MiB per index; source defaults16MiB are not automatically used as a decompressor allocation allowance.
Select current amd64 xz-utils/liblzma5 version5.8.3-1ubuntu0.1, source xz-utils sameversion, and historical amd64 libc6 version2.43-2ubuntu2.3, source glibc sameversion. All requests are exact data comparisons under the new work order, not arbitrary metadata-derived fetch capabilities; failed/missing/ambiguous entries STOP without another package, architecture or mirror.
Maximum2 authored Fetch calls,1 source preflight,1164443 compressed bytes,4947895 decoded bytes,<=2048 stream reads/chunks<=1MiB,119s work/120s total cooperative/130s tool capture, ASCII JSON<=32KiB. Builtin Node gunzip is permitted; no package-body acquisition, installation, scripts, host-key/candidate/library/SDK access, filesystem write, interpreter, candidate/XZ or external decoder execution occurs. HTTP/TLS/proxy/runtime/native buffering/crypto/zlib trust remain ordinary and unqualified. Signature/ownership/provenance/Native flags are not promoted merely by a reference result.

<!-- BEGIN UBUNTU EXACT PACKAGE REFS V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
const start = process.hrtime.bigint(), workEnd = start + 119_000_000_000n, end = start + 120_000_000_000n;
const sourceSha256 = '4f3bd4cfcd0f79cac0504b3cac46ee949a45c43f12baa27f0aaff144bbf16150';
const targets = [
  { label: 'current', url: 'https://security.ubuntu.com/ubuntu/dists/resolute-security/main/binary-amd64/Packages.gz', size: 744998, sha256: '5f113f573482190912c54e97deb1e67322228ea13a0dbd71f9b5986a7055781b', decodedSize: 3192760, decodedSha256: 'c69a86813b52e0db2a7820d7a9c54dff5afc7a635fc58812e9928e6299beb2c5', packages: [
    { package: 'xz-utils', version: '5.8.3-1ubuntu0.1', architecture: 'amd64', sourcePackage: 'xz-utils', sourceVersion: '5.8.3-1ubuntu0.1' },
    { package: 'liblzma5', version: '5.8.3-1ubuntu0.1', architecture: 'amd64', sourcePackage: 'xz-utils', sourceVersion: '5.8.3-1ubuntu0.1' }] },
  { label: 'historical', url: 'https://snapshot.ubuntu.com/ubuntu/20260801T000000Z/dists/resolute-security/main/binary-amd64/Packages.gz', size: 419445, sha256: '4710f1391e6ba21bdfdba2821b9b7329d1eb380a34655f12a3ebdb9cda164825', decodedSize: 1755135, decodedSha256: '84c0b668c6f8641096baddfefe4fd94c54c9fea66b68ea5bce49b59226685567', packages: [
    { package: 'libc6', version: '2.43-2ubuntu2.3', architecture: 'amd64', sourcePackage: 'glibc', sourceVersion: '2.43-2ubuntu2.3' }] },
];
const counts = { sourceReads: 0, fetchCalls: 0, reads: 0, compressedBytes: 0, decodedBytes: 0, cancellations: 0 };
const rows = [];
let last = start, clocks = 1, failure;
const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 119000);
const known = ['E_INPUT', 'E_LIMITS', 'E_HASH', 'E_PACKAGE', 'E_AMBIGUOUS', 'E_OUTPUT', 'E_SOURCE_PIN', 'E_PLATFORM', 'E_DEADLINE', 'E_LIMIT', 'E_HTTP', 'E_HEADERS', 'E_LENGTH', 'E_BODY', 'E_CLEANUP', 'E_DECOMPRESS'];
function stop(code) { const error = new Error(); error.code = code; throw error; }
function guard(final = false) {
  if (++clocks > 20000) stop('E_LIMIT');
  const now = process.hrtime.bigint();
  if (typeof now !== 'bigint' || now < last) stop('E_PLATFORM');
  last = now;
  if (now >= (final ? end : workEnd)) stop('E_DEADLINE');
}
async function cancel(body) {
  if (!body) return;
  counts.cancellations++;
  let cleanup;
  const delay = Math.max(0, Math.min(1000, Number((end - process.hrtime.bigint()) / 1000000n)));
  try { await Promise.race([body.cancel(), new Promise((resolve, reject) => { cleanup = setTimeout(() => reject(new Error()), delay); })]); }
  catch { stop('E_CLEANUP'); }
  finally { clearTimeout(cleanup); }
}
try {
  counts.sourceReads++;
  const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/package-index.mjs');
  if (source.length !== 10025 || createHash('sha256').update(source).digest('hex') !== sourceSha256) stop('E_SOURCE_PIN');
  guard();
  const helper = await import('data:text/javascript;base64,' + source.toString('base64'));
  guard();
  for (const target of targets) {
    guard(); counts.fetchCalls++;
    const response = await fetch(target.url, { method: 'GET', redirect: 'error', credentials: 'omit', cache: 'no-store', signal: abort.signal, headers: { 'Accept-Encoding': 'identity' } });
    guard();
    if (response.status !== 200 || response.url !== target.url || response.redirected) { await cancel(response.body); stop('E_HTTP'); }
    const encoding = response.headers.get('content-encoding'), length = response.headers.get('content-length');
    if ((encoding !== null && encoding.toLowerCase() !== 'identity') || (length !== null && length !== String(target.size))) { await cancel(response.body); stop('E_HEADERS'); }
    if (!response.body) stop('E_BODY');
    const reader = response.body.getReader(), chunks = [];
    let total = 0;
    try {
      while (true) {
        guard(); if (counts.reads >= 2048) stop('E_LIMIT'); counts.reads++;
        const step = await reader.read(); guard();
        if (step.done) break;
        if (!(step.value instanceof Uint8Array) || step.value.byteLength < 1 || step.value.byteLength > 1048576 || step.value.byteLength > target.size - total || step.value.byteLength > 1164443 - counts.compressedBytes) stop('E_LENGTH');
        const value = Buffer.from(step.value); chunks.push(value); total += value.length; counts.compressedBytes += value.length;
      }
    } catch (error) { await cancel(reader); throw error; }
    finally { reader.releaseLock(); }
    if (total !== target.size) stop('E_LENGTH');
    const compressed = Buffer.concat(chunks, total);
    if (createHash('sha256').update(compressed).digest('hex') !== target.sha256) stop('E_HASH');
    guard();
    let decoded;
    try { decoded = zlib.gunzipSync(compressed, { maxOutputLength: Math.min(4194304, target.decodedSize), info: true }); }
    catch { stop('E_DECOMPRESS'); }
    guard();
    if (decoded.engine.bytesWritten !== target.size || !Buffer.isBuffer(decoded.buffer) || decoded.buffer.length !== target.decodedSize || createHash('sha256').update(decoded.buffer).digest('hex') !== target.decodedSha256) stop('E_HASH');
    counts.decodedBytes += decoded.buffer.length;
    if (counts.decodedBytes > 4947895) stop('E_LIMIT');
    const selected = helper.selectPackageReferences(decoded.buffer, { byteLength: target.decodedSize, sha256: target.decodedSha256 }, target.packages);
    guard();
    if (!selected.indexBytesMatched || selected.inputSha256 !== target.decodedSha256 || selected.signatureVerified || selected.provenanceVerified || selected.nativeQualified) stop('E_PACKAGE');
    rows.push({ label: target.label, compressedSha256: target.sha256, indexSha256: selected.inputSha256,
      indexBytes: selected.byteLength, referenceChain: 'signature-bound Release descriptors in section 33.12', packages: selected.packages });
  }
  guard(true);
} catch (error) { failure = known.includes(error.code) ? error.code : abort.signal.aborted ? 'E_DEADLINE' : 'E_FETCH'; abort.abort(); }
finally { clearTimeout(timer); }
const base = { profile: 'ubuntu-exact-package-refs-v1', authorization: 'autonomous-steps-1-5', attemptConsumed: true,
  status: failure ? 'STOP' : 'EXACT_PACKAGE_REFS', sourceSha256, counts, packageBodiesFetched: false,
  candidateExecuted: false, publisherTrustEstablished: false, provenanceVerified: false,
  decoderQualified: false, nativeQualified: false, realArchiveInspected: false, rustReady: false, trainingReady: false };
let text = (JSON.stringify({ ...base, ...(failure ? { error: failure, rows: [] } : { rows }) }) + '\n').replace(/[^\x00-\x7f]/g, unit => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0'));
if (Buffer.byteLength(text) > 32768 || !/^[\x20-\x7e\n]*$/.test(text)) { failure = 'E_OUTPUT'; text = JSON.stringify({ ...base, status: 'STOP', error: failure }) + '\n'; }
if (!failure) { try { guard(true); } catch { failure = 'E_DEADLINE'; text = JSON.stringify({ ...base, status: 'STOP', error: failure }) + '\n'; } }
if (failure) process.exitCode = 1;
process.stdout.on('error', () => { process.exitCode = 1; });
try { process.stdout.write(text); } catch { process.exitCode = 1; }
NODE
```
<!-- END UBUNTU EXACT PACKAGE REFS V1 -->

Syntax-only parsing passed for the7176-byte command SHA-256 `da463c413c33b1587b6841b00bfdd91197fd9468c4dfc8f00e8ead3b5466bae0`, without evaluating it. Required quality review closed partial-reference publication on failure by suppressing rows in every STOP envelope; security accepted DATAREF only and spec correspondence is in-sync. Register complete current-section identity before use. An exact reference result is not automatic package-download or software-execution authority; later counterpart downloads must be separately registered under the work order with their own exact lengths/hashes/URLs and no replacement behavior.

### 33.14 Exact package references observed

The81783-byte section registration `b7eb210343f7ed85297dc3f79f4c1e34040189564ef588b4d1cb691fd89dd7a2` bound command7176/SHA-256 `da463c413c33b1587b6841b00bfdd91197fd9468c4dfc8f00e8ead3b5466bae0` and selector10025/SHA-256 `4f3bd4cfcd0f79cac0504b3cac46ee949a45c43f12baa27f0aaff144bbf16150`. The exact operation returned normally with EXACT_PACKAGE_REFS:2 Fetch calls,123 stream reads,1164443 compressed bytes,4947895 decoded bytes and0 cancellations. Both compressed/uncompressed signed-bound index hashes matched, and the exact requested amd64/source/version tuples were uniquely selected. No package body or candidate/loader was used.

| Source index / package | Exact relative Filename | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Current / xz-utils5.8.3-1ubuntu0.1 amd64 | `pool/main/x/xz-utils/xz-utils_5.8.3-1ubuntu0.1_amd64.deb` | 405688 | `5a1532b0f903040ba44a7459d20abb9163e300e081cf233eecc9cdfec33a6cd8` |
| Current / liblzma5 sameversion/arch | `pool/main/x/xz-utils/liblzma5_5.8.3-1ubuntu0.1_amd64.deb` | 145800 | `da480a60b02a80fd529904dc0a92dae5d537864a9412909e45fbd9dd46f26e2f` |
| Historical / libc62.43-2ubuntu2.3 amd64 | `pool/main/g/glibc/libc6_2.43-2ubuntu2.3_amd64.deb` | 2103290 | `49fc198d09ed1099070b8333c94c3801cc5b11d18b3a8ce9d0da15dc42547681` |

The first two associate source xz-utils5.8.3-1ubuntu0.1; libc6 associates source glibc2.43-2ubuntu2.3. These are signature-bound distribution-metadata associations, not independently reproduced source-to-binary equivalence or current security support. No alternative architecture, version, package or source record was substituted.

### 33.15 Registered non-executed package counterpart comparison

The next work-order operation permits only the three exact package data URLs below and their independently expected byte counts/SHA-256 from §33.14. This retrieves validation counterparts, not replacements, installed packages or fallback software. Authenticate whole package bytes before Node builtin decompression/TAR member comparison. Unsupported compression/member layout, missing member, stale data or mismatch STOP without an XZ fallback or software execution.
The four expected regular-file members are explicitly registered under `usr/bin/xz` and `usr/lib/x86_64-linux-gnu/...`; no link target is followed or member extracted. The local `/lib` observations remain alias/path evidence with ordinary uninspected ancestor trust; matching published member bytes would identify content only, not immutable path protection.
Bind both runtime source images: DEB11973/SHA-256 `c24c40dcf1da7c1dddfc770ee586f2d4b0e281972b0d980cb9ce4780558211f6` and TAR15548/SHA-256 `050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139`. A deterministic one-occurrence source transformation replaces only the DEB module's relative TAR import with a data URL of the captured, checked TAR bytes; expected linked source32714/SHA-256 `76b5d9dacb09e501373681f2060e1331bd845e9ba367db9aa67bbac707299908`. Import that exact linked byte image, never reopen either mutable pathname for execution. Node crypto/util/zlib imports remain the ordinary trusted runtime, not Native source/loading closure.
Maximum3 Fetch calls,2654778 compressed package bytes,4096 stream reads/chunks<=1MiB, no redirects/retries,119s work/120s total cooperative/130s capture, output ASCII<=64KiB. Node builtin decompression remains capped by DEB_MEMBER_LIMITS; no process RSS/CPU/native-interruption guarantee follows. Data input/output stays private RAM; no filesystem write, installer, maintainer script, candidate/loader/XZ, archive inspection of the GNU SDK, host/candidate/library reread or deletion is included.

<!-- BEGIN UBUNTU DEB COUNTERPARTS V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const start = process.hrtime.bigint(), workEnd = start + 119_000_000_000n, end = start + 120_000_000_000n;
const digest = value => createHash('sha256').update(value).digest('hex');
const sources = [
  { file: 'tar-inventory.mjs', size: 15548, sha256: '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139' },
  { file: 'deb-members.mjs', size: 11973, sha256: 'c24c40dcf1da7c1dddfc770ee586f2d4b0e281972b0d980cb9ce4780558211f6' },
];
const targets = [
  { package: 'xz-utils', url: 'https://security.ubuntu.com/ubuntu/pool/main/x/xz-utils/xz-utils_5.8.3-1ubuntu0.1_amd64.deb', size: 405688, sha256: '5a1532b0f903040ba44a7459d20abb9163e300e081cf233eecc9cdfec33a6cd8', members: [
    { path: 'usr/bin/xz', byteLength: 101392, sha256: '1f6ca26fd33066c9d5b95e58a0d9e2f5789cb18fd5741518574113b37ea1934d' }] },
  { package: 'liblzma5', url: 'https://security.ubuntu.com/ubuntu/pool/main/x/xz-utils/liblzma5_5.8.3-1ubuntu0.1_amd64.deb', size: 145800, sha256: 'da480a60b02a80fd529904dc0a92dae5d537864a9412909e45fbd9dd46f26e2f', members: [
    { path: 'usr/lib/x86_64-linux-gnu/liblzma.so.5.8.3', byteLength: 215448, sha256: '515749273a91ca5e3b273b4025dc2c1f8827f90005baea0ab85ffb594e74f72f' }] },
  { package: 'libc6', url: 'https://snapshot.ubuntu.com/ubuntu/20260801T000000Z/pool/main/g/glibc/libc6_2.43-2ubuntu2.3_amd64.deb', size: 2103290, sha256: '49fc198d09ed1099070b8333c94c3801cc5b11d18b3a8ce9d0da15dc42547681', members: [
    { path: 'usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2', byteLength: 254864, sha256: 'c5e80a563850d6ab5c2f2482e4202d9c1b71fbf44854b8c399e63527202c64e1' },
    { path: 'usr/lib/x86_64-linux-gnu/libc.so.6', byteLength: 2186512, sha256: 'a3947513a02831ec692ebf13053c07614882ab54a2101fb91a1b15724062ed0c' }] },
];
const counts = { sourceReads: 0, fetchCalls: 0, reads: 0, packageBytes: 0, cancellations: 0 };
const rows = [];
let last = start, clocks = 1, failure;
const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 119000);
const known = ['E_INPUT', 'E_LIMITS', 'E_REFERENCE', 'E_TARGETS', 'E_PACKAGE', 'E_AR', 'E_UNSUPPORTED', 'E_DECOMPRESS', 'E_TAR', 'E_MEMBER', 'E_OUTPUT', 'E_INTERNAL', 'E_SOURCE_PIN', 'E_PLATFORM', 'E_DEADLINE', 'E_LIMIT', 'E_HTTP', 'E_HEADERS', 'E_LENGTH', 'E_BODY', 'E_HASH', 'E_CLEANUP'];
function stop(code) { const error = new Error(); error.code = code; throw error; }
function guard(final = false) {
  if (++clocks > 20000) stop('E_LIMIT');
  const now = process.hrtime.bigint();
  if (typeof now !== 'bigint' || now < last) stop('E_PLATFORM');
  last = now;
  if (now >= (final ? end : workEnd)) stop('E_DEADLINE');
}
async function cancel(body) {
  if (!body) return;
  counts.cancellations++;
  let cleanup;
  const delay = Math.max(0, Math.min(1000, Number((end - process.hrtime.bigint()) / 1000000n)));
  try { await Promise.race([body.cancel(), new Promise((resolve, reject) => { cleanup = setTimeout(() => reject(new Error()), delay); })]); }
  catch { stop('E_CLEANUP'); }
  finally { clearTimeout(cleanup); }
}
try {
  const code = [];
  for (const source of sources) {
    counts.sourceReads++;
    const bytes = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/' + source.file);
    if (bytes.length !== source.size || digest(bytes) !== source.sha256) stop('E_SOURCE_PIN');
    code.push(bytes); guard();
  }
  const needle = "from './tar-inventory.mjs'";
  if (code[1].toString('utf8').split(needle).length !== 2) stop('E_SOURCE_PIN');
  const linked = Buffer.from(code[1].toString('utf8').replace(needle, "from 'data:text/javascript;base64," + code[0].toString('base64') + "'"));
  if (linked.length !== 32714 || digest(linked) !== '76b5d9dacb09e501373681f2060e1331bd845e9ba367db9aa67bbac707299908') stop('E_SOURCE_PIN');
  const helper = await import('data:text/javascript;base64,' + linked.toString('base64'));
  guard();
  if (typeof helper.compareDebMembers !== 'function') stop('E_SOURCE_PIN');
  for (const target of targets) {
    guard(); counts.fetchCalls++;
    const response = await fetch(target.url, { method: 'GET', redirect: 'error', credentials: 'omit', cache: 'no-store', signal: abort.signal, headers: { 'Accept-Encoding': 'identity' } });
    guard();
    if (response.status !== 200 || response.url !== target.url || response.redirected) { await cancel(response.body); stop('E_HTTP'); }
    const encoding = response.headers.get('content-encoding'), length = response.headers.get('content-length');
    if ((encoding !== null && encoding.toLowerCase() !== 'identity') || (length !== null && length !== String(target.size))) { await cancel(response.body); stop('E_HEADERS'); }
    if (!response.body) stop('E_BODY');
    const reader = response.body.getReader(), chunks = [];
    let total = 0;
    try {
      while (true) {
        guard(); if (counts.reads >= 4096) stop('E_LIMIT'); counts.reads++;
        const step = await reader.read(); guard();
        if (step.done) break;
        if (!(step.value instanceof Uint8Array) || step.value.byteLength < 1 || step.value.byteLength > 1048576 || step.value.byteLength > target.size - total || step.value.byteLength > 2654778 - counts.packageBytes) stop('E_LENGTH');
        const value = Buffer.from(step.value); chunks.push(value); total += value.length; counts.packageBytes += value.length;
      }
    } catch (error) { await cancel(reader); throw error; }
    finally { reader.releaseLock(); }
    if (total !== target.size) stop('E_LENGTH');
    const bytes = Buffer.concat(chunks, total);
    if (digest(bytes) !== target.sha256) stop('E_HASH');
    guard();
    const comparison = helper.compareDebMembers(bytes, { byteLength: target.size, sha256: target.sha256 }, target.members);
    guard();
    if (!comparison.packageBytesMatched || comparison.provenanceVerified || comparison.nativeQualified || comparison.runtimeInvoked || comparison.fileWritesPerformed) stop('E_PACKAGE');
    rows.push({ package: target.package, url: target.url, packageSize: target.size, packageSha256: target.sha256,
      referenceChain: 'section 33.12 signature-bound indexes and exact package/source tuple in 33.14', comparison });
  }
  guard(true);
} catch (error) { failure = known.includes(error.code) ? error.code : abort.signal.aborted ? 'E_DEADLINE' : 'E_FETCH'; abort.abort(); }
finally { clearTimeout(timer); }
const base = { profile: 'ubuntu-deb-counterparts-v1', authorization: 'autonomous-steps-1-5', attemptConsumed: true,
  status: failure ? 'STOP' : 'ALL_COUNTERPART_BYTES_MATCHED', counts,
  candidateExecuted: false, maintainerScriptsExecuted: false, filesInstalled: false,
  publisherTrustEstablished: false, provenanceVerified: false, decoderQualified: false,
  nativeQualified: false, realArchiveInspected: false, rustReady: false, trainingReady: false };
let text = (JSON.stringify({ ...base, ...(failure ? { error: failure, rows: [] } : { rows }) }) + '\n').replace(/[^\x00-\x7f]/g, unit => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0'));
if (Buffer.byteLength(text) > 65536 || !/^[\x20-\x7e\n]*$/.test(text)) { failure = 'E_OUTPUT'; text = JSON.stringify({ ...base, status: 'STOP', error: failure }) + '\n'; }
if (!failure) { try { guard(true); } catch { failure = 'E_DEADLINE'; text = JSON.stringify({ ...base, status: 'STOP', error: failure }) + '\n'; } }
if (failure) process.exitCode = 1;
process.stdout.on('error', () => { process.exitCode = 1; });
try { process.stdout.write(text); } catch { process.exitCode = 1; }
NODE
```
<!-- END UBUNTU DEB COUNTERPARTS V1 -->

Actual counterpart compatibility/availability is not established until the exact registered operation succeeds. Syntax-only validation passed for command7558/SHA-256 `58d16d285cf4d707f36c4ac5991260764d9021b12e7229a2394bccd5c3f36152`; both raw source pins and the deterministic linked-source pin match, and benign captured-graph import succeeds. Required quality/security source gates accepted only this data operation with no findings; active navigation is reconciled. Register complete current-section identity before use. Failed comparisons expose no package/member references or partial-success match rows; no code execution or replacement follows.

### 33.16 Counterpart byte equality observed; execution gate stays closed

The93787-byte section registration `ba3c2a21db46c462986f32ed21d20f25425a4206fd2aab308174b2f833ad45a5` bound command7558/SHA-256 `58d16d285cf4d707f36c4ac5991260764d9021b12e7229a2394bccd5c3f36152` and the two source images/linked-source identity in §33.15. The operation returned normally with ALL_COUNTERPART_BYTES_MATCHED:2 source reads,3 Fetch calls,204 stream reads,2654778 package bytes and0 cancellations. Every whole-package size/hash and all four selected regular-file member lengths/hashes matched the independently recorded expectations.

| Package | Data member | Compressed bytes | Decoded TAR bytes | TAR entries | Selected regular members |
| --- | --- | ---: | ---: | ---: | --- |
| xz-utils | `data.tar.zst` | 402966 | 593920 | 149 | `usr/bin/xz` |
| liblzma5 | `data.tar.zst` | 143799 | 286720 | 14 | `usr/lib/x86_64-linux-gnu/liblzma.so.5.8.3` |
| libc6 | `data.tar.zst` | 2044329 | 5642240 | 52 | `usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2`, `usr/lib/x86_64-linux-gnu/libc.so.6` |

All three packages used `control.tar.zst` and `data.tar.zst`. Node builtin zstd decoded only data members. No maintainer script, extracted file, installer, counterpart code, host candidate/loader/XZ, Python or SDK payload executed. Input/output remained private RAM. Preserve §33.15's command and the earlier unsuccessful/successful source revisions as historical evidence; this result does not renew any consumed operation.
The evidence chain is exact pinned key → verified Release text → exact index hashes → exact package/source/architecture tuple → whole package hash → validated regular-member bytes → prior host fingerprints. It establishes byte equality under the recorded trust inputs, not independent out-of-band key ownership, source reproducibility, current security support, actual loading identity or Native authority. PublisherTrustEstablished/provenanceVerified/decoderQualified/nativeQualified/rustReady/trainingReady remain false.
Architect follow-up `ses_e92caa483ffenhVmnj04uxXFfV` preserves §33.8's missing-key-trust STOP. No candidate invocation may follow by silently substituting a new HTTPS-origin trust policy. Independent official publisher-ownership research remains possible under the work order; finite fixture construction and independent source implementation may proceed without executing the candidate. Step1 remains INCOMPLETE; no remaining step is committed/pushed as complete.

### 33.17 Independent publisher declaration and controlled qualification design

Official [Ubuntu Security FAQ revision1347](https://wiki.ubuntu.com/w/index.php?title=Security/FAQ&oldid=1347#GPG_Keys_used_by_Ubuntu), also [retrieved as plaintext](https://wiki.ubuntu.com/w/index.php?title=Security/FAQ&oldid=1347&action=raw), explicitly states `The Ubuntu Archives are signed with keys:` and publishes `rsa4096/871920D1991BC93C`, full fingerprint `F6ECB3762474EDA9D21B7022871920D1991BC93C`, and `Ubuntu Archive Automatic Signing Key (2018) <ftpmaster@ubuntu.com>`. Parent retrieval independently confirmed the research result. This separate publisher declaration is not a key's self-claimed UID or a signature's issuer hint.
Record `ordinaryPublisherAssociationCorroborated:true` for that exact publisher/document/fingerprint under the existing ordinary official-HTTPS research basis. Architect `ses_e92caa483ffenhVmnj04uxXFfV` confirms this new evidence closes the missing publisher-association prerequisite for ordinary bootstrap; §33.8 does not require inventing an air-gapped root. Do not modify library `publisherTrustEstablished:false`, which cannot authenticate its caller's expectations. Out-of-band authentication, key-revocation/current-security status, reproducible source correspondence and Native/F9 remain unproved.
The next source units are independent `xz-fixtures.mjs`/tests and a separate real-process `xz-qualification.mjs`/mocked tests. They do not reclassify the existing inventory controller as real. Fixed XZ-format argv, exclusive staged copies of the four checked images, private library names, empty inherited environment apart from C locale/UTC, disabled loader cache/hwcaps, explicit rejection of audit/filter/auxiliary dynamic tags, and `/etc/ld.so.preload` absence checks remain execution prerequisites. No general glibc switch suppresses that global preload file; an existing entry means STOP without mutation.
The runner must observe input completion, both output EOFs, exit status/signal and child close. Byte/deadline failures latch STOP and attempt SIGKILL once; uncertain completion remains a cleanup failure. Reserve cleanup inside the original suite clock. Node timers/XZ's memory option are not hard process RSS, kernel interruption or process-tree containment; keep those limitations explicit and Native qualification false.
Independent uncompressed-LZMA2/CRC32 vectors can establish only their named finite cases. A separately sourced compressed-LZMA2 known-answer vector is required before claiming coverage of actual compressed SDK input. No candidate execution, staging write or SDK inspection follows automatically from this design; register the exact later operation after source verification and required gates.
In parallel, the existing architect accepts SOURCE-ONLY shared418, recursive belief and strict-artifact implementation planning. Current Rust compilation, complete F9 B/source/invoice/clock/resource proof, whole-decision adequacy and learned-estimator acceptance remain blocking. No source-only unit counts as a completed step or authorizes training/activation/deployment.

### 33.18 Qualification source progress — no physical invocation yet

Independent fixture construction supplies32 frozen uncompressed-LZMA2 cases: empty/literal/multiblock/concatenated streams, legal and illegal padding, checksum/header/index/footer corruption, truncation, trailing garbage and memory refusal. It uses its own format construction and independently checked CRC32 known answers, not candidate compression. Its `missingCompressedKnownAnswer:true` applies to that factory alone.
A separate fixed compressed-LZMA2/CRC64 known-answer fixture copies only the published `COMPRESSED_XZ` and `INPUT` byte constants from [CPython v3.13.0 test_lzma.py](https://raw.githubusercontent.com/python/cpython/60403a5409ff2c3f3b07dd2ca91a7a3e096839c7/Lib/test/test_lzma.py), commit `60403a5409ff2c3f3b07dd2ca91a7a3e096839c7`. Compressed bytes1056/SHA-256 `b63524a70c61afe5904bd6cf0b45c589ff2b58bc4ac1cc5e360318412e57994d`; plaintext1921/SHA-256 `b64857892c3f1ff008e910d6f8786bffb7f6651b7c5ea58ae3b7975d3ac119de`, CRC32 `b05baee2`. The published source asserts that mapping independently of the host candidate. Python source was read solely as public fixture text; no Python interpreter, package, compiler or helper was selected or executed. Preserve the PSF-2.0 copyright/license and modification summary in `tooling/native-ingress/licenses/PSF-2.0.txt`; the literal input/output bytes remain unchanged.
The process controller replaces inherited environment, uses only the fixed absolute staged loader/profile and publishes positive output only after exact comparison, stdin finish, both EOFs, pipe closure observations, exit and child close. Parent review corrected same-event-turn Node ordering: child close may occur before user pipe-close listeners, so final verification runs in a guarded microtask. A persisted regression covers that ordering without launching a process.
Parent verification passed1304/1304 tests across ten affected synthetic/mock-only suites,0 failures/cancelled/skipped/todo. This includes the previous1228-case combined source set plus32 constructed-fixture cases and44 process-controller cases; it precedes adding the separately verified12-case compressed-KAT suite and staging tests. No actual child, staging write or host probe occurred in these tests. Six current owner diagrams passed offline pinned-theme validation/rendering; the new qualification owner still awaits completed source mapping and rendering.
The physical suite will select31 constructed cases (exclude the separately labeled output-limit payload from the normal-success suite) plus the compressed known-answer case, keeping the32-case controller ceiling. Output-overflow/SIGKILL behavior remains mock-tested until separately exercised. Prerequisite hooks must check global preload absence before and after each child; parent staging/static validation remains distinct from the process controller. Complete source gates and exact operation registration remain prerequisites to actual use.

### 33.19 Registered fixed-root finite XZ qualification operation

The autonomous work order permits this bounded qualification operation after required source gates, not arbitrary host execution. Register `tooling/native-ingress/xz-operation.mjs`,7337 bytes/SHA-256 `42b566485c38c723d8c568d8c765805a5989619d0ca89131faba09ada2341876`, as the exact operation source. The launcher below imports only its checked captured bytes; the operation similarly pins all five dependency byte images and its deterministic linked staging→ELF source image. No mutable source pathname is reopened for execution.

| Captured dependency | Bytes | SHA-256 |
| --- | ---: | --- |
| `elf-metadata.mjs` | 19842 | `b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85` |
| `xz-fixtures.mjs` | 5760 | `726fb0d891d7a62dad23522652639edbdffb4bde3b6d91da32145e56cbd400ac` |
| `xz-compressed-fixture.mjs` | 4706 | `88b00aa4971b26725a4c9fe09550af714d4bb9bf06ea556f62cb45e59482aaa0` |
| `xz-staging.mjs` | 16688 | `f75c21a58bb67e6ab3f8b1dafd090e11ac2d3a70f017da35afb81b00761b71b4` |
| `xz-qualification.mjs` | 13615 | `788392807fed76480116ab31ea5221903c9c330c1091b1d0c5775961fe4be7be` |

Linked staging bytes43154/SHA-256 `89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2` replace exactly one relative ELF import with the captured checked ELF data URL. Fixture-manifest SHA-256 `632a0d812366712ae99ce2ce442ad98a59534430640184f70af53df58656b4ea` binds32 exact cases,3432 aggregate compressed bytes and their independently specified expected outputs/statuses.
Read only the four original literal ELF files/pins from §33.15/`XZ_STAGING_PROFILE`. Require exact source size/hash/mode, root UID/GID, nlink1 and stable nine-field named/FD identity with no final-link following, exact positional64KiB reads and EOF. Parse the checked private snapshots only after FD closure. Reject DT_AUDIT, DT_DEPAUDIT, DT_FILTER, DT_AUXILIARY, unexpected dependency/interpreter/SONAME/RPATH/RUNPATH declarations and uncovered version names before any staging or child.
Create only `/tmp/opencode/f9-xz-qualification-01`, exclusively, mode0700. Existing root means STOP without reuse, repair, suffix fallback or deletion. Create exactly `xz`, `ld-linux-x86-64.so.2`, `liblzma.so.5`, `libc.so.6` as exclusive regular files. Complete bounded writes, fchmod/fsync/closure, then make XZ/loader0500, libraries0400 and root0500; verify all staged bytes/identities and the exact directory layout. Up to two owned FDs coexist (root plus one image); each object's independent identity matters, not common device numbers. Retain every partial or successful file; no cleanup deletion or package installation occurs.
Check only the literal `/etc/ld.so.preload` for absence. Only ENOENT passes; any existing leaf/type or other error STOPs without reading or modifying it. Before/after every case, reverify all four staged byte images and root identities/layout, then sample preload absence. Those snapshots do not exclude same-UID/root/ancestor races and cannot establish immutable loading.
Run32 named cases sequentially through the fixed absolute staged loader. Argv disables loader cache/hwcaps and selects the private library path; XZ uses only decompression/stdout/explicit-XZ/one-thread/fixed memory limit/stdin. Environment is exactly LC_ALL=C, LANG=C, TZ=UTC; three pipes, no shell or extra inherited descriptors. After the32-case suite, one additional registered33rd child decodes36 concatenated compressed KAT streams (38016 compressed bytes,69156 expected decoded bytes) to exercise the controller's65536-byte output ceiling. Require E_OUTPUT and observed child close; never accept its partial output.
The operation caps authored spawn calls33, filesystem calls10000, read bytes256MiB, staged writes2758216 bytes and close attempts400, with each staging helper capped1024 calls/32MiB transfer. The original operation clock reserves3s inside120s; the normal suite reserves3s inside60s and caps each case2s. The overflow suite caps5s including1s cleanup. Shell capture130s is not hard native interruption or process-tree containment. Native timers, RSS, allocator behavior, Node bootstrap/intrinsics and library/same-UID races remain explicit ordinary-host residuals. No hard RSS proof is claimed by XZ's16MiB decoder memory setting.
The operation emits one bounded ASCII<=64KiB receipt with selected hashes/counters/statuses. Any failure suppresses successful fixture observations and returns a fixed STOP code. It makes no network call, installs nothing, reads no GNU SDK/archive payload, changes no environment/security policy, and deletes no retained data. A successful finite profile is evidence for those exact cases, not general decoder correctness or Native/F9 qualification.
Required quality review found three MEDIUM receipt defects before execution. The repaired controller separates stdout overflow E_OUTPUT from stderr E_STDERR and chunk-event E_EVENTS, so only the intended stdout ceiling can pass the33rd-child check. Spawn-attempt and observed spawn-event counters are separate; candidateExecuted is false before any attempt, true after the normal suite's accepted observations, and null when execution remains unconfirmed after a failed attempt. Failed staging/verification marks `ioAccountingComplete:false`; filesystem/byte/close totals explicitly cover completed helper receipts only, with source reads/preload checks separate. They are lower-bound observations on a failed helper, not a zero-I/O assertion. Partial staging may remain when completion was not returned; never delete or reuse it. The repaired171-case focused source/mock suite passes with all10 syntax checks.
Parent verification passed1399/1399 tests across13 synthetic/mock-only suites,25 syntax checks and no skipped/cancelled/todo cases. This includes76 staging mock tests,44 controller mock tests,32 constructed-fixture tests,12 compressed-KAT tests and7 operation/source-graph tests. A static fixture test initially rejected the required PSF copyright word; the repaired test exempts only the exact mandatory license header and preserves its no-runtime/no-import restrictions. No physical staging or candidate invocation has occurred yet.

<!-- BEGIN FIXED XZ QUALIFICATION V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const bytes = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/xz-operation.mjs');
if (bytes.length !== 7337 || createHash('sha256').update(bytes).digest('hex') !== '42b566485c38c723d8c568d8c765805a5989619d0ca89131faba09ada2341876') throw new Error('E_SOURCE_PIN');
const operation = await import('data:text/javascript;base64,' + bytes.toString('base64'));
const result = await operation.runRegisteredXzQualification();
process.exitCode = result.exitCode;
process.stdout.on('error', () => { process.exitCode = 1; });
process.stdout.write(result.text);
NODE
```
<!-- END FIXED XZ QUALIFICATION V1 -->

Required quality review closed all three MEDIUM receipt findings in the repaired source. Security accepted only the registered<=33-child ordinary boundary with no findings; its external RSS/wall-clock/process-tree caveat remains. Spec correspondence is in-sync. The launcher692/SHA-256 `459b3eb392f05b31d948df9d095ff752546543c91d07f8121c9a81feab95a871` passes syntax-only parsing, and its exact captured operation imports inertly without calling the physical function. The new qualification owner passes offline pinned-theme check/render. Register complete current-section identity before use. No result or step completion follows from these plans/tests alone.

### 33.20 Step1 complete — exact ordinary bootstrap profile observed

The110064-byte section registration `0bbb4252fa504187979c3e4c0c546fbd6058e7ad53d102dc54a7f68644134739` bound the692-byte launcher `459b3eb392f05b31d948df9d095ff752546543c91d07f8121c9a81feab95a871`, operation7337/`42b566485c38c723d8c568d8c765805a5989619d0ca89131faba09ada2341876`, five captured dependency images and the linked-stage/fixture-manifest pins in §33.19. The exact operation returned normally with FINITE_XZ_PROFILE_OBSERVED. All33 authored spawn calls produced observed spawn events; all32 ordinary cases matched their independently specified output/status and required stdin/EOF/exit/close lifecycle gates. The33rd child produced the distinct stdout-cap E_OUTPUT and observed close, with zero accepted partial output.
Counters report5 dependency source reads/60611 bytes,68 preload-absence checks,5599 completed staging-helper filesystem calls,190316904 read bytes,2758216 staged write bytes and349 close attempts. `ioAccountingComplete:true`; source/preload counters retain their separate declared scopes. No installer, Python, network, retained-data deletion, GNU SDK inspection or model work occurred. Failed-input cases demonstrably emitted some partial output, which remained unaccepted; successful Check=None cases retained `integrityCheck:false`.
Persist selected fields, all32 case identities, compressed-KAT result, overflow observation and exact staged nine-field identities in [`xz-qualification.receipt.json`](../tooling/native-ingress/xz-qualification.receipt.json). It is explicitly a parent transcription, not an authenticated raw transcript or Native capability. The staged root is `/tmp/opencode/f9-xz-qualification-01`, directory DEV28/INO13941/UID1000/mode0500; image files are DEV29/INOs1212099–1212102. Distinct root/file devices passed correctly. Retain this root and its files; the exclusive staging operation is consumed and must not be rerun or repaired/reused as a fresh creation.
Architect `ses_e92caa483ffenhVmnj04uxXFfV` accepts Step1's **ordinary-bootstrap XZ qualification** on this persisted exact-profile result. This closes the named preparation step, not general decoder correctness, hard RSS/process-tree/deadline guarantees, complete symbol binding, reproducible source builds, current security support, §10, Native/F9 or training readiness. All corresponding broad assurance flags remain false. No additional out-of-band key or hard-RSS prerequisite is invented for this accepted ordinary profile; stronger Native/build-resource requirements remain binding in their own phases.
Commit/non-force push only the verified Step1 infrastructure/spec/receipt delta under the user's work order. Keep in-progress, uncompiled shared418/belief/artifact Rust source outside that commit. Step2 starts with a separately registered data-only inventory of the exact retained GNU2026 archive, with staged-profile revalidation, original archive metadata/hash/FD binding, explicit compressed/expanded/entry/path/output limits and joint child/pipe/FD completion. It permits no extraction, Python/GDB/setup scripts or installation, and no acceptance of partial inventory.
Closing parent verification passed1400/1400 synthetic/mock/transcription checks across13 suites,25 syntax checks and `git diff --check`, with no failures/skips/cancellations/todo and no repeated physical invocation. Required quality review accepts only this ordinary Step1 commit; spec review reports in-sync. Security's registered ordinary-execution boundary and residual caveats remain unchanged. All seven affected source-owned diagrams have current pinned-offline validated SVGs; unrelated unresolved coverage entries remain unchanged.

### 33.21 Step2 first operation — retained archive metadata only

Step1 was committed/non-force pushed as `2a64037d`; no Rust source was included. The new Step2 metadata operation samples only `/tmp/opencode/f9-gnu-2026-data-only-01` and its exact registered archive leaf, twice each, using lstat only. It establishes current nine-field identity expectations for a later same-FD content pass; no directory listing, symlink following, open, content read, archive decoding, network, write or child occurs. Four lstat calls maximum; 2s cooperative guard/5s tool capture are not hard syscall interruption.
Require root directory0700/UID1000/nlink2 and regular archive0600/UID1000/nlink1/exact102296280 bytes, with supported BigInt metadata and stable pre/post snapshots. Preserve independent root/file devices; do not require equality. Missing/changed/unsupported metadata STOPs without another path, retry or repair. This new work-order operation does not renew the consumed acquisition or qualification operation.

<!-- BEGIN GNU SDK METADATA V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
const started = performance.now();
const fields = ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs'];
const paths = ['/tmp/opencode/f9-gnu-2026-data-only-01', '/tmp/opencode/f9-gnu-2026-data-only-01/x86-64--glibc--stable-2026.08-1.tar.xz'];
const rows = [];
let calls = 0;
function sample(path) {
  if (++calls > 4 || performance.now() - started >= 2000) throw new Error('E_LIMIT');
  const value = fs.lstatSync(path, { bigint: true });
  const out = {};
  for (const field of fields) {
    if (typeof value[field] !== 'bigint' || value[field] < 0n) throw new Error('E_METADATA');
    out[field] = value[field].toString();
  }
  return out;
}
for (let i = 0; i < paths.length; i++) {
  const before = sample(paths[i]), after = sample(paths[i]);
  if (!fields.every(field => before[field] === after[field]) || before.uid !== '1000' ||
      before.mode !== String(i === 0 ? 0o40700 : 0o100600) || before.nlink !== String(i === 0 ? 2 : 1) ||
      (i === 1 && before.size !== '102296280')) throw new Error('E_BINDING');
  rows.push({ path: paths[i], identity: before });
}
if (performance.now() - started >= 2000) throw new Error('E_DEADLINE');
console.log(JSON.stringify({ profile: 'gnu-sdk-metadata-v1', status: 'METADATA_ONLY', calls,
  archiveRead: false, archiveDecoded: false, candidateExecuted: false, nativeQualified: false, rows }));
NODE
```
<!-- END GNU SDK METADATA V1 -->

Syntax-only validation passed for command1431/SHA-256 `19c8a57a9753fa076033aff07fd4eee8d466ba4c68ff6cf5fec426bf332bbdb2`. The required bounded source check accepts only this metadata operation; no later archive reader or decoder follows automatically from a metadata result. Register the complete current section before use.

### 33.22 Step2 retained archive identity observed

Section116634/SHA-256 `7eb22cd47154b3672d3bd025ac73ed7a5fff034c2c022145c369f1776dab52ad` bound the1431-byte command `19c8a57a9753fa076033aff07fd4eee8d466ba4c68ff6cf5fec426bf332bbdb2`. It returned METADATA_ONLY after exactly4 lstats, without content reads, decoding or child execution.

```json
{"root":{"dev":"28","ino":"13894","mode":"16832","uid":"1000","gid":"1000","nlink":"2","size":"4096","mtimeNs":"1792805590304271582","ctimeNs":"1792805590304271582"},"file":{"dev":"29","ino":"1211332","mode":"33152","uid":"1000","gid":"1000","nlink":"1","size":"102296280","mtimeNs":"1792805605531830652","ctimeNs":"1792805605531830652"}}
```

These exact independent root/file expectations bind the next proposed same-FD content pass. The archive remains DATA_ONLY and uninspected. No extracted SDK path, manifest, Python/GDB component or installed tool is qualified by this metadata result.

### 33.23 Parallel Rust source handoffs — not verified steps

Accepted architect/domain plans produced a source-only numerical shared418 encoder under `packages/training/src/features/`, independent418 literal vectors/source map and34 unexecuted tests. Separate source-only artifact/checkpoint units implement canonical bytes, binary64 hex, closed DTOs, expected-reference joins and diagnostic-state validation; they grant no Native/publication/resume authority. Parent registered their module exports and the already-locked exact `sha2=0.10.9` edge without changing Rust/Burn versions/features or resolving/acquiring any dependency.
The numerical belief/spatial handoff under `packages/training/src/numerical_belief/` composes existing paired tables/accounting/evidence/normalization/reband/readout and paired F1 state. It uses an explicit Marine-provider seam pending a concrete shared-grammar adapter. Artifact hydration, store publication, arena wiring, cross-language numerical parity and composed-budget adequacy remain incomplete. All source and tests remain UNCOMPILED/UNRUN; no source handoff is a completed Step3/4/5 or belongs in the verified Step1 commit.
Static shared418 quality review reported no source-level findings, without compilation or parity claims. Strict artifact security review identified unsupported empty-table inference admission (HIGH), missing row-key ordering (MEDIUM) and unbounded initial canonical-JSON array materialization (MEDIUM). Repair those before acceptance; keep inference fail-closed while economic-model qualification is missing. Review/verification gates and the full-support1129672>1048576 refusal remain binding. No training, collection, calibration, activation, deployment, meter restoration or TS engine/legacy/data-label change occurred.

### 33.24 Registered real GNU SDK data-only inventory

This new work-order operation may read/decode only the exact retained archive/root expectations in §33.22, after revalidating the accepted staged XZ profile from the pinned Step1 receipt. It is not a rerun of exclusive staging or the33-child qualification. It creates no file, extracts no archive entry, installs no component, executes no archive-derived program/script and makes no network request.
The real `gnu-sdk-inventory.mjs` pipeline is separate from the unchanged mock-only controller. It retains two archive/root FDs, matches all nine expected fields independently, hashes the entire102296280-byte archive plus physical EOF before starting a child, then supplies a second independently hashed positional pass from the same FD. Each read is<=64KiB, each pass<=4096 attempts; exact successful totals are204592560 data bytes and204592562 requested bytes including EOF probes. Input mutation, wrong length/hash, short reads, root/FD changes or unsuccessful closure STOP without a partial inventory.
Before/after decoding, reverify the four staged images/layout and `/etc/ld.so.preload` absence using the exact Step1 staged receipt. The pipeline's two archive FDs can coexist with a gate helper's root+image FDs; peak explicitly owned application FDs can therefore reach4, separate from Node's opaque transport/pipes. No root/file device equality is required. Source/receipt preflight reads are separately counted and remain ordinary Node/ancestor/runtime trust, not protected Native loading.
Exactly one authored child uses the same fixed staged loader, cache/hwcaps/library controls, replacement C/UTC environment and three pipes. Use explicit XZ format/one thread/16MiB decoder memory setting/stdin; unsupported dictionary or resource requirements STOP without another decoder, cap increase or automatic retry. Await each stdin write callback and required drain before scratch reuse; drain both output pipes concurrently. Coalesce stdout into64KiB TAR feeds, discard payloads and follow no links. No archive-derived name ever becomes a host path.
Expanded stdout<=1GiB, headers<=32768, stream events<=32768, stderr<=8192 bytes, selected metadata<=128 entries/128KiB, parser extension/path/collision/metadata ceilings unchanged. Python selection matches a basename containing python/libpython, not every descendant of a Python-named directory; all entries still contribute to complete TAR validation/count/digest. Selected names are inert leads, never proof of Python-free SDK usability or ELF identity. Selection overflow STOPs rather than silently truncating.
Success requires both archive hashes/physical EOFs, complete stdin, stdout/stderr EOF and pipe closure, decoder exit0/no signal/child close, post-profile/preload checks, stable final root/file metadata and positive FD closure, then valid TAR finish. A latched failure stops further reads/parsing/writes and attempts bounded termination/close; uncertainty remains an explicit cleanup failure. The pipeline's original120s reserves3s cleanup; source/receipt capture must finish within10s, with an outer130s cooperative envelope and140s tool capture. These do not establish hard syscall interruption, RSS, process-tree termination or Native clocks.
Source pin `gnu-sdk-inventory.mjs`23261/SHA-256 `bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29`; operation6666/`3b9dfbf8c7b045884af420b43c24bff6f90eea04aa8e5b6e967af1b22ec3411f`. Other captured pins remain TAR15548/`050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139`, ELF19842/`b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85`, staging16688/`f75c21a58bb67e6ab3f8b1dafd090e11ac2d3a70f017da35afb81b00761b71b4`. The pinned receipt is4239/`e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233`, explicitly a parent transcription of the registered physical result, not an authentication capability.
Deterministic captured-source links are staging→ELF43154/`89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2` and inventory→TAR44002/`53d5fcc40eadb1e149340ccd7f93edbdd980f48f98ea06751f3780dea39f3078`. Check raw and expanded hashes before data-URL import; no executed source pathname is reopened. Node fs/crypto/util/child-process and runtime internals retain ordinary bootstrap trust. No Python interpreter/runtime is selected by this pipeline.
The operation prepares one escaped-ASCII envelope<=1MiB, nesting the pipeline's<=256KiB UTF-8 summary, and suppresses provisional selections on any failure. It records invocation attempts separately from observed spawn events; candidate execution is unconfirmed on a failed attempt without accepted inventory. Completed gate-helper counters carry explicit completeness/scope labels. No decoded entry, setup/relocation script, Python/GDB component, offline Cargo input or installed Rust/GNU tool is qualified by inventory alone.
Parent verification passes94 synthetic/mock/static tests and all four syntax targets; no archive content was read or decoded by those tests. The scope remains Step2 data inventory only, not Step2 completion. Required source gates and exact command/section registration precede live use.

<!-- BEGIN GNU SDK DATA INVENTORY V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/gnu-sdk-inventory-operation.mjs');
if (source.length !== 6666 || createHash('sha256').update(source).digest('hex') !== '3b9dfbf8c7b045884af420b43c24bff6f90eea04aa8e5b6e967af1b22ec3411f') throw new Error('E_SOURCE_PIN');
const operation = await import('data:text/javascript;base64,' + source.toString('base64'));
const result = await operation.runRegisteredGnuSdkInventory();
process.exitCode = result.exitCode;
process.stdout.on('error', () => { process.exitCode = 1; });
process.stdout.write(result.text);
NODE
```
<!-- END GNU SDK DATA INVENTORY V1 -->

Required quality/security source gates accept only this one-child ordinary data-inventory operation with no findings; spec correspondence is in-sync. Its owner diagram now states peak-four owned FDs, separate UTF-8/ASCII output caps and explicit false qualification flags, and passes offline pinned-theme check/render. Launcher711/SHA-256 `bddeff0efcbf846ded5eada75e981dbe5639090ff883d1c68541732c306c6e9d` passes syntax-only parsing without executing the operation. Register complete current-section identity before live use; no extraction, installation or Step2 completion follows automatically.

### 33.25 SDK inventory-v1 STOP — no provisional inventory accepted

Section125973/SHA-256 `bf875cb6e40260dfe64bd5540a84dc1c717c5fc98e167df0cc3f37d0a4dc4003` bound launcher711/`bddeff0efcbf846ded5eada75e981dbe5639090ff883d1c68541732c306c6e9d`, operation6666/`3b9dfbf8c7b045884af420b43c24bff6f90eea04aa8e5b6e967af1b22ec3411f` and the raw/expanded source pins in §33.24. The exact operation returned STOP/E_LIMIT. No inventory, selection, extraction or installation result was accepted.

```json
{"profile":"registered-gnu-sdk-inventory-v1","status":"STOP","counts":{"sourceReads":4,"sourceBytes":75339,"receiptReads":1,"spawnAttempts":1,"spawnEvents":1,"stageChecks":1,"preloadChecks":1,"stageFsCalls":80,"stageReadBytes":2758216,"stageCloses":5},"stageAccountingComplete":true,"stageCountersScope":"completed verification helpers","candidateInvocationAttempted":true,"candidateExecuted":null,"realArchiveInspected":false,"archiveExtracted":false,"filesInstalled":false,"pythonRuntimeInvoked":false,"pythonFreeSubsetVerified":false,"nativeQualified":false,"rustReady":false,"trainingReady":false,"hardRssBounded":false,"hardDeadlineGuaranteed":false,"processTreeBounded":false,"error":"E_LIMIT"}
```

[Inference] Source-path analysis points to the32768 raw pipe-event limit, not a measured counter in this v1 receipt: each exact archive pass needs1562 reads including EOF, below4096; bounded archive metadata/open work plus both passes stays below10000 calls; the observed gate/spawn counters are below their limits. Preserve that distinction rather than inventing a measured output length or accepted TAR prefix. Cleanup returned neither E_CLEANUP nor E_CLOSE; no closure or publication uncertainty is converted into success.
Keep v1 inventory/module/operator/test bytes and this STOP unchanged. Its operation is consumed; there is no automatic retry, cap increase or alternate decoder. Architect `ses_e92caa483ffenhVmnj04uxXFfV` accepts designing a **separately registered v2** with a fixed262144 raw-event ceiling and passive bounded packet/byte diagnostics, while preserving all compressed/expanded/TAR/header/memory/time/cleanup constraints. Require a one-occurrence checked source transformation, original/transformed/linked pins and fresh source gates before one explicitly registered v2 attempt. This is a successor under the autonomous work order, not permission to mutate a running/frozen v1 profile or declare Step2 complete.
The original source files remain frozen byte references for both variants; no filesystem immutability is implied. V2 instrumentation must attach only after the core reader installed its handlers, retain no payloads and neither start flow early nor change backpressure. Every derived archive name remains inert. No retained data is deleted and the accepted Step1 root remains unchanged.

### 33.26 Rust integration remains source-only and fail-closed

The shared Marine adapter now reuses the existing promotion macro compiler instead of duplicating grammar. Extra metadata preserves authored diagonal targets even when C does not act and filters only spatial-specific out-of-board rewrite/post-C-F branches; feature route families remain unchanged. Existing fees stay intact and additional metadata/copy/adapter work is charged. Independent mirrored branch/emission tests are persisted but unrun. The paired coordinator derives one economic readout/context per requested feature batch and calls the shared418 encoder/flattening through the same caller meter; it does not claim full candidate-independent geometry preparation or whole-window fit.
Strict artifact repairs reject duplicate/descending outcome keys and bound initial canonical parsing by shared node/container/depth/string budgets before materialization. Static security review closes its prior HIGH/MEDIUM findings **for diagnostic-only scope**: positive fitted-inference admission unconditionally returns MissingEvidence until concrete hydration and fitted-coverage/group/prior verification exists. That missing capability is not described as finished artifact lifecycle. Publication/storage confirmation, complete resume closure, arena adapter wiring, compiled tests and cross-language parity remain open. Preserve all uncompiled Rust work outside verified-step commits; no training, fitting, calibration or activation follows.

### 33.27 Registered SDK inventory-v2 — one fixed successor attempt

The autonomous work order next permits exactly one separately registered v2 inventory attempt under the same archive/root nine-field expectations in §33.22, same staged-profile receipt and same one-child data-only boundary in §33.24. It does not renew or rerun v1, rerun exclusive XZ staging, adapt a running limit, extract files, install tools or execute archive contents. Preserve the original v1 source/operator/test bytes and §33.25 STOP verbatim.
Only the captured inventory image changes: require one exact `maxStreamEvents: 32_768` occurrence, replace it with fixed `maxStreamEvents: 262_144`, and check both the transformed raw and fully linked hashes before import. Compressed/expanded/output/TAR/header/path/metadata/collision/FD/read/memory/time/cleanup limits remain unchanged. The byte/hash/custody/lifecycle gates still all must pass jointly. Any failure STOPs with no automatic third attempt or further increase.
Original inventory23261/SHA-256 `bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29`; transformed23262/`c163c52e915104a017d21c8e9d4db545f760d8c5c0652a270e38cad6fdeda8da`; linked inventory→TAR44003/`01e233ab98615ecbb8845f1ae3fe1f6ea1177acf7b3400a7729ac101895f8633`. Other raw/staged-link/receipt pins are identical to §33.24. V2 operation10102/SHA-256 `39da4bc85f6e7eaaecb0abd157d59ec4c2dcb6191a19c9247cbadd0080ae767a` imports only those checked captured images.
Passive stdout/stderr counters attach inside the observed spawn event, after the core installed its handlers. They neither start flow early nor call read/resume/pause, alter stdin backpressure or retain payloads. Event/byte observations saturate at262208 packets and1074798592 combined bytes; invalid chunks/overflow mark diagnostics incomplete. These are observed Node data packets, not OS syscall or hard-resource counts. Failure receipts expose only bounded diagnostics/fixed codes, not provisional TAR selections.
The unchanged outer130s cooperative/140s tool envelope includes source/receipt capture limited to10s and the pipeline's120s including3s cleanup. Staged image verification/global preload absence run before and after; the retained archive/root FDs still bind both full hash/EOF passes. Hard RSS/process-tree/deadline, immutability, Native qualification and Python-free SDK-subset readiness remain false/unproved. Decoder dictionaries over16MiB still fail without another memory setting or decoder.
V2 has its own source-owned diagram/index entry so v1's exact mapping/test expectations do not change. Parent verification passes37 v2 synthetic/mock/static tests plus retained94 v1 SDK checks, with both new syntax checks. No v2 physical operation has occurred. Required source gates, diagram validation and exact command/section identity precede use; this registration is for data inventory, not Step2 completion.

<!-- BEGIN GNU SDK DATA INVENTORY V2 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/gnu-sdk-inventory-v2-operation.mjs');
if (source.length !== 10102 || createHash('sha256').update(source).digest('hex') !== '39da4bc85f6e7eaaecb0abd157d59ec4c2dcb6191a19c9247cbadd0080ae767a') throw new Error('E_SOURCE_PIN');
const operation = await import('data:text/javascript;base64,' + source.toString('base64'));
const result = await operation.runRegisteredGnuSdkInventoryV2();
process.exitCode = result.exitCode;
process.stdout.on('error', () => { process.exitCode = 1; });
process.stdout.write(result.text);
NODE
```
<!-- END GNU SDK DATA INVENTORY V2 -->

Required quality/security source gates accept this exact separately registered one-child v2 data-only scope with no findings; spec correspondence is in-sync and v1's mapping remains unchanged. The v2 owner passes offline pinned-theme check/render. Launcher717/SHA-256 `60bc76c9e44b573a60a493ed53ddc6c5efc16dde45c4219c313bbb9bdf6044a5` passes syntax-only parsing; the37 v2 mock/static tests pass again without calling the physical function. Register the complete current section before the single v2 use. No accepted inventory, extraction or Step2 completion is inferred before its result.

### 33.28 New numerical-coordinator blockers — source only

Static quality review of the paired belief/shared-Marine source found a HIGH: the current dense primitive composition exceeds1.33 million charged units before rebanding even for a singleton settlement, so it cannot deliver settlements within the shared1048576 allowance. This is stronger than the retained full-support refusal; do not describe the coordinator as operational. A MEDIUM also identifies the detached reducer's surviving-recipient terminal-open rejection; paired F1 knows both recipients, while the detached API currently derives terminal status only from own CC loss. Both findings remain OPEN. Do not lower existing primitive fees, split/reset/refund the meter or publish one recipient to hide either defect.
An arena adapter now delegates numerical encoding to the same Rust implementation with persisted literal/bit/fee parity test source; it does not replace or activate the synthetic smoke/baseline selectors. Those additions, all Rust tests and the shared-grammar adapter remain uncompiled/unrun. Fitted artifact hydration/admission, complete resume/store closure and actual filesystem publication remain missing. No Step3/4/5 completion or current training readiness is inferred.

### 33.29 SDK inventory-v2 STOP — parser category still unknown

Section135879/SHA-256 `734ce9b434d5cccdeb02d1e9babe7001ecdb669533346c1b6e0412646cb9e36d` bound launcher717/`60bc76c9e44b573a60a493ed53ddc6c5efc16dde45c4219c313bbb9bdf6044a5` and operation10102/`39da4bc85f6e7eaaecb0abd157d59ec4c2dcb6191a19c9247cbadd0080ae767a`. That separate v2 operation returned STOP/E_TAR, with no accepted inventory, extraction or installed SDK.

```json
{"profile":"registered-gnu-sdk-inventory-v2","status":"STOP","rawStreamEventLimit":262144,"diagnostics":{"stdoutEvents":38009,"stderrEvents":0,"stdoutBytes":344383488,"stderrBytes":0,"diagnosticCountersComplete":true,"diagnosticCountersScope":"observed Node data packets; not OS syscall counts"},"counts":{"sourceReads":4,"sourceBytes":75339,"receiptReads":1,"spawnAttempts":1,"spawnEvents":1,"stageChecks":1,"preloadChecks":1,"stageFsCalls":80,"stageReadBytes":2758216,"stageCloses":5},"stageAccountingComplete":true,"candidateInvocationAttempted":true,"candidateExecuted":null,"realArchiveInspected":false,"archiveExtracted":false,"filesInstalled":false,"pythonRuntimeInvoked":false,"pythonFreeSubsetVerified":false,"nativeQualified":false,"rustReady":false,"trainingReady":false,"hardRssBounded":false,"hardDeadlineGuaranteed":false,"processTreeBounded":false,"error":"E_TAR"}
```

The observed38009 stdout packets exceed v1's32768 ceiling, without proving identical packetization across runs. V2 reached a parser failure before its own262144 limit; the outer code intentionally normalized the parser exception to E_TAR, so no exact underlying TAR error, path, extension total, header count or format accommodation is inferred. The344383488 observed pipe bytes are not an accepted TAR prefix or complete decoded length.
Preserve v1/v2 source/operator/test bytes, both STOPs and the retained files. Architect `ses_e92caa483ffenhVmnj04uxXFfV` accepts a separately designed **diagnostic-only v3 proposal** with every existing limit and acceptance gate unchanged. A pure TAR observer may delegate feed/finish transparently, return original results/rethrow original exceptions by identity, and expose only bounded call/attempted-byte counters plus first fixed whitelisted error category. It must read `.code` only through an own data descriptor, never an error message/getter, and retain no path/header/payload or provisional entries. Link its exact captured instance into the same private v2 pipeline and inspect that same instance's frozen diagnostic snapshot.
New v3 source/gates/registration remain pending; no automatic third attempt or parser relaxation follows this result. Parent retained-suite verification passes1531/1531 in-memory/mock/static checks across16 suites and `git diff --check`, with0 failures/skips/cancellations/todo and no additional native invocation. Step2 and Rust compilation remain blocked on the unaccepted SDK/toolchain context; stronger F9/source/B/invoice gates remain open.

### 33.30 Registered SDK inventory-v3 — transparent parser diagnostics only

The standing work order permits one separately registered diagnostic successor, not an automatic retry or relaxed parser. Register the same retained archive/root snapshots, same102296280-byte/cde893af… content pin, same staged profile/receipt and all v2 limits/acceptance gates. No path, extension, header, metadata, output, memory, time, dictionary or codec allowance changes. No provisional entry/path/body is accepted or retained on failure, and no extraction, setup script, SDK program, installer, Python, network or deletion operation occurs.
`tar-observer.mjs`3288/SHA-256 `6211785adf6470eb6af8f437a6815aa194b75063f0f7ad9a90c48ad9e3747ab1` wraps the unchanged captured TAR factory and transparently delegates feed/finish. It returns original results and rethrows original exceptions by identity. It records only bounded feed/completed-call/attempted-byte counters and the first fixed whitelisted parser error category/phase. `.code` is inspected only as an own data property; getters/messages are never evaluated. Unknown exceptions produce UNCLASSIFIED; diagnostics never recover or replace a parser error.
Observer counters saturate at32769 attempted/completed feed calls and1074790400 attempted feed bytes, marking incompleteness rather than altering parser behavior. Attempted feed bytes are not accepted TAR bytes; completed calls are not parsed-entry counts. No header/path/payload is copied into the diagnostic state. The observer's per-parser state is read from the exact same module instance linked into the inventory pipeline.
Captured raw pins retain TAR15548/`050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139`, ELF19842/`b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85`, staging16688/`f75c21a58bb67e6ab3f8b1dafd090e11ac2d3a70f017da35afb81b00761b71b4`, original inventory23261/`bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29` and v2 helper10102/`39da4bc85f6e7eaaecb0abd157d59ec4c2dcb6191a19c9247cbadd0080ae767a`. The helper is imported inertly for its pure transform/packet-counter functions; its physical operation is not called. The existing4239/e45d6523… Step1 receipt remains data-only evidence.
Check every raw image, the unchanged v2 event-limit transform23262/`c163c52e915104a017d21c8e9d4db545f760d8c5c0652a270e38cad6fdeda8da`, linked observer→TAR24029/`6783deaf54c6d696e5a9da6c1daabc331abc817f26ea1925019020ab6e3b1aca` and fully linked inventory→observer55311/`f2ce70caeb0e23a04095e0513965845d6a8950fbe73bb472d36c26411597e6b8` before data-URL import. Staging→ELF retains43154/89b6c5e3… . Executed source paths are not reopened.
V3 operation10103/SHA-256 `2714854c2fe0521abcb6b4acf2a80b8a5e46b7026922f2ff849c970167d80ea1` prepares one<=1MiB escaped-ASCII receipt, preserving E_TAR and cleanup/close-error precedence. The single child, two exact hash/EOF passes, parent staged/preload checks, pipeline120s including3s cleanup, source preflight10s, outer130s/tool140s remain as before. No hard RSS/tree/deadline, immutable loading, Native authority or Python-free SDK-subset claim follows.
Parent verification passes43 v3 synthetic/mock/static tests and all three syntax checks; combined retained v1/v2/v3 SDK checks pass174/174 with0 failures/skips/cancellations/todo. Tests cover result/error identity, first-error latching, descriptor/getter restrictions, saturation, shared module identity, original source pins, unchanged limits and failure suppression. E_CHECKSUM in those fixtures is not evidence about the actual SDK. Required source gates, diagram validation and exact command/section registration precede the one physical invocation; no automatic fourth attempt belongs in this operation.

<!-- BEGIN GNU SDK DATA INVENTORY V3 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/gnu-sdk-inventory-v3-operation.mjs');
if (source.length !== 10103 || createHash('sha256').update(source).digest('hex') !== '2714854c2fe0521abcb6b4acf2a80b8a5e46b7026922f2ff849c970167d80ea1') throw new Error('E_SOURCE_PIN');
const operation = await import('data:text/javascript;base64,' + source.toString('base64'));
const result = await operation.runRegisteredGnuSdkInventoryV3();
process.exitCode = result.exitCode;
process.stdout.on('error', () => { process.exitCode = 1; });
process.stdout.write(result.text);
NODE
```
<!-- END GNU SDK DATA INVENTORY V3 -->

Required quality/security source gates accept only this exact one-child diagnostic-data scope with no findings; spec correspondence is in-sync. The v3 owner passes offline pinned-theme check/render. Launcher717/SHA-256 `b8e96d47fe85edcc6a068c59f4df67d334e52aed2cc7129ce8e80e75c2bdc99e` passes syntax-only parsing without invoking the operation. Register complete current-section identity before the single v3 attempt. No parser relaxation, extraction or Step2 completion follows automatically.

### 33.31 SDK inventory-v3 STOP — extension-byte gate identified

Section143896/SHA-256 `3951c1702a743fdb018c8342b9846ae4e78ea6ff4a87c897d5c36d4b021f6e66` bound launcher717/`b8e96d47fe85edcc6a068c59f4df67d334e52aed2cc7129ce8e80e75c2bdc99e` and operation10103/`2714854c2fe0521abcb6b4acf2a80b8a5e46b7026922f2ff849c970167d80ea1`. The exact v3 attempt returned STOP/E_TAR and the unchanged parser's fixed category E_EXTENSION_BYTES. No inventory or partial prefix was accepted.

```json
{"profile":"registered-gnu-sdk-inventory-v3","status":"STOP","rawStreamEventLimit":262144,"diagnostics":{"stdoutEvents":38056,"stderrEvents":0,"stdoutBytes":344432640,"stderrBytes":0,"diagnosticCountersComplete":true},"tarDiagnostics":{"feedCalls":5254,"completedFeedCalls":5253,"attemptedFeedBytes":344326144,"errorPhase":"feed","errorCode":"E_EXTENSION_BYTES","diagnosticCountersComplete":true},"counts":{"sourceReads":6,"sourceBytes":88729,"receiptReads":1,"receiptBytes":4239,"spawnAttempts":1,"spawnEvents":1,"stageChecks":1,"preloadChecks":1,"stageFsCalls":80,"stageReadBytes":2758216,"stageCloses":5},"sourceAccountingComplete":true,"receiptAccountingComplete":true,"stageAccountingComplete":true,"candidateInvocationAttempted":true,"candidateExecuted":null,"realArchiveInspected":false,"archiveExtracted":false,"filesInstalled":false,"pythonRuntimeInvoked":false,"pythonFreeSubsetVerified":false,"nativeQualified":false,"rustReady":false,"trainingReady":false,"error":"E_TAR"}
```

The error identifies the extension-byte admission gate, not whether one record exceeded64KiB or cumulative records exhausted64KiB. Preserve that uncertainty and all v1/v2/v3 bytes/results. No path/PAX/security rule is waived and no cap changes inside any consumed operation.
Architect `ses_e92caa483ffenhVmnj04uxXFfV` accepts a separately reviewed v4 resource-profile proposal: cumulative extension payload<=4MiB, **individual extension payload still<=65536 bytes**, every other bound and parsing rule unchanged. This is not a total per-entry heap guarantee. Transform only the private captured TAR image with two exact checked replacements: the default cumulative ceiling and the admission condition's explicit64KiB per-record guard. Pin original, intermediate, transformed and linked bytes before use. An oversized individual record must still STOP. Require tests separating valid short GNU long-name records with ordinary entries, plus cumulative/per-record boundaries and unchanged malformed/PAX/traversal rejection. Source/gates/registration remain pending; no automatic fourth attempt follows v3.

### 33.32 Compact belief source revision — verification HIGH remains open

The accepted architect plan replaces dense production composition with `CompactPosterior`, canonical independent support runs, bounded active-bank settlement workspaces and direct banded construction/readout. Probability normalization precedes band-mass/conditional construction; Boolean reachability remains independent of PMF zeros. Existing charged table/source/likelihood queries remain charged. New constructors validate order, uniqueness, domains, normalization and support containment without trusted/assume-valid flags. Opening D4/B3 is constructed directly for each recipient.
The readout keeps every canonical Kahan zero-term visit and bounds scratch by nonzero cells plus marginals. Its source-derived quoted charge is223312+152P+64C+32W, where P is nonzero cells, C components and W conditional entries; this is not a measured whole-window result. Boundary readout-cache hits charge328 and caches clear on advancement or failure. Any F1 advance error now revokes both recipient publications, preserving successful expenditure without claiming rollback. The detached advance export is removed; only the paired coordinator classifies terminal status after both F1 boundaries validate.
Parent source reconciliation verifies all pre-existing `joint_math.rs` and `banded_joint.rs` function bodies, fees and private unit tests byte-for-byte against HEAD after removing the new insertion and normalizing the expanded SPEC pointer. New checked helpers are inserted before the existing test modules; a naive append-only prefix probe therefore failed before the exact insertion-aware comparison passed. Existing dense APIs/invoices and the1129672 full-support refusal remain unchanged.
The new `tests/fused_belief.rs` persists tuple-oracle, support-zero, arithmetic-order/parity, underflow, exact-budget boundary, terminal, cache/replay and uninterrupted BOTH-window assertions using the real shared Marine provider and real418 encoding. None compiled or ran. Static quality review closes the terminal MEDIUM and finds no new concrete source defect, but keeps the HIGH OPEN until qualified Rust execution and independent invoice auditing demonstrate the complete common window fits1048576. Do not report affordability, Step5 acceptance or runtime readiness from this source revision.

### 33.33 Registered SDK inventory-v4 — cumulative extension resource profile

Register one separate v4 data-inventory attempt under the same §33.22 archive/root identities and all existing staged-image/preload/hash/EOF/FD/one-child controls. The only new allowance is cumulative extension payload<=4194304 bytes. Individual extension payload remains<=65536 bytes, not a total per-entry heap guarantee. Unknown PAX keys, unsafe/duplicate paths, invalid types/padding/checksums/truncation and every other existing rejection remain fatal. No decoder, dictionary limit, stream/TAR/header/metadata/collision/output/time/cleanup allowance changes, and no automatic fifth attempt occurs.
The private original TAR image15548/`050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139` undergoes exactly two one-occurrence replacements: `maxExtensionBytes: 65_536` → `maxExtensionBytes: 4_194_304`, then `if (size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');` → `if (size > 65_536 || size > limits.maxExtensionBytes - extensionBytes) fail('E_EXTENSION_BYTES');`. Check intermediate15551/`b22db5d375d966016f5551b9161119079960d24f9611cf87d145893887575824` and final15568/`56cac49b3cfe51dbf2a7f7d1f4a0d877ae8773f940585ebea72740373689fae2` before any import. Original source/API defaults and all previous source/operator/test bytes remain unchanged on disk.
The unchanged observer3288/6211785a… links to that checked transformed TAR as24057/`f516d8d3d478a35f09135a769cd25a80830453d7ae5802750e0308bb754e8b04`; the unchanged v2-profile inventory23262/c163c52e… links to the same observer instance as55347/`62aca920ea966549edea33c7c52a607716f63701d3bf35cc868e677eabd58923`. Other raw/receipt/staged-link pins remain those in §33.30. V4 operation12608/SHA-256 `2ea3c1bfe71676c37d01a05b64f9d3f11e4a7d7d93541cfdc4707a378bae17db` imports only this checked captured graph and inert v2 helpers; no previous physical operation is called or retried.
The existing transparent parser and passive packet diagnostics remain bounded and preserve result/error identity and cleanup precedence. They reveal no header, path or payload on failure. Full success still requires both complete same-FD archive hash/EOF passes, stream/exit/close completion, post-profile/preload checks, exact root/file stability, successful owned-FD closure and TAR finish. Source/receipt preflight<=10s, pipeline120s including3s cleanup, outer130s/tool140s and one<=1MiB ASCII envelope remain unchanged ordinary-host controls, not hard native resource or immutability proofs.
Parent verification passes53 new mock/static/pure-parser tests and all332 retained TAR tests; combined TAR plus v1–v4 SDK suites pass559/559 with0 failures/skips/cancellations/todo. Tests include valid separated GNU long-name records cumulatively exceeding64KiB, lower cumulative boundaries, individual65536 admission/65537 rejection, wrong transforms, unsafe paths/PAX/type/padding rejection, fixed source pins and unchanged lifecycle/failure suppression. No live v4 operation has occurred. Source gates, diagram validation and exact command/section identity precede its one invocation. Neither this profile nor a future inventory success qualifies SDK subset extraction, installation, Python freedom, Rust/F9, training or Step2 completion.

<!-- BEGIN GNU SDK DATA INVENTORY V4 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/gnu-sdk-inventory-v4-operation.mjs');
if (source.length !== 12608 || createHash('sha256').update(source).digest('hex') !== '2ea3c1bfe71676c37d01a05b64f9d3f11e4a7d7d93541cfdc4707a378bae17db') throw new Error('E_SOURCE_PIN');
const operation = await import('data:text/javascript;base64,' + source.toString('base64'));
const result = await operation.runRegisteredGnuSdkInventoryV4();
process.exitCode = result.exitCode;
process.stdout.on('error', () => { process.exitCode = 1; });
process.stdout.write(result.text);
NODE
```
<!-- END GNU SDK DATA INVENTORY V4 -->

Required quality/security source gates accept only this exact bounded one-child v4 data scope with no findings; spec correspondence is in-sync. Its owner passes offline pinned-theme check/render. Launcher717/SHA-256 `2b23e6a5a36b736067f9256e9da1e927a3b88cddd20a1e710cf698f2e7ea4186` passes syntax-only parsing without invoking the operation. Register the complete current section before its single physical use; no extraction, installation or Step2 completion follows automatically.

### 33.34 SDK inventory-v4 accepted — data only, not a Python-free toolchain

Section153445/SHA-256 `36ab77480c2aa0441d576b74994382bd1a6576721f4c8dae6a927a84155cda2d` bound launcher717/`2b23e6a5a36b736067f9256e9da1e927a3b88cddd20a1e710cf698f2e7ea4186` and operation12608/`2ea3c1bfe71676c37d01a05b64f9d3f11e4a7d7d93541cfdc4707a378bae17db`. The exact v4 operation returned GNU_SDK_DATA_INVENTORY after both full102296280-byte hash/EOF passes, decoder exit0/no signal, stdin/output completion, post-profile/preload checks and two successful archive/root FD closes.
The validated decoded TAR has505333760 bytes,10181 headers,8412 entries and193768 cumulative extension bytes, with metadata SHA-256 `efe53c8fda0b0f1e8b8ba6b7868707a88f33aa26b5692b9c76dc0e6da694d901`. It fits the separately registered cumulative allowance while retaining64KiB individual payload and all semantic checks. Pipe diagnostics counted54612 stdout packets/505333760 bytes, no stderr; the parser accepted7711 feeds and recorded no error. Archive counters were204592560 data bytes,204592562 requested bytes,3124 read attempts,3151 filesystem operations and2 positive closes. Both staged/preload gates passed; their counters remain separately scoped.
Persist selected evidence in [`gnu-sdk-inventory-v4.receipt.json`](../tooling/native-ingress/gnu-sdk-inventory-v4.receipt.json), explicitly a parent transcription rather than an authenticated raw transcript/capability. Retain every earlier STOP and all source/profile bytes. The archive remains unextracted; no setup script, compiler, debugger or Python runtime executed.
Inventory names include Python3.14 libraries/modules and GDB/GCC Python directories. Therefore no whole-SDK Python-free claim follows. The regular control members `x86-64--glibc--stable-2026.08-1/relocate-sdk.sh` (index8406,size1383) and `.../bin/toolchain-wrapper` (index10,size14704) are data candidates only. Symlink/hardlink names, including compiler aliases and lib64, were never followed. Names do not establish ELF identity or dependency closure.
Architect accepts the next source design as **control-data inspection without extraction**: first obtain final regular-member spans and a whole decoded digest through a separately bounded member-inventory pass; second stream/validate the same archive again and capture only those two approved16087 payload bytes by accepted ranges. Require complete lifecycle/hash/TAR success on both passes, identical full decoded digests and the frozen summary above before publishing text/ELF observations. Bound internal span metadata separately; never retain the505MiB decoded archive in RAM or write it as a convenience file. Compiler-helper candidates may be emitted only as bounded inert regular-span metadata for later explicit qualification.
The two-pass inspection, source/gates/registration, NoPython subset, relocation/executable closure, offline Rust inputs and enforceable build context remain pending. No Step2 completion, current Rust verification, fitted inference or Native/F9 readiness follows from this inventory milestone; do not commit it as a completed remaining step.

### 33.35 Registered SDK control-data inspection — no member execution/extraction

Register a new deterministic two-child operation to inspect only the accepted regular control members in §33.34: wrapper14704 bytes/index10 and relocation script1383 bytes/index8406, total16087 approved payload bytes. Every derived name remains data; no member becomes a host path, file, script invocation or installed executable. Retain the original archive, staging roots and all consumed operations/profiles without modification, retry or deletion. Python/GDB payloads are not captured.
First core pass validates the complete archive using the existing TAR member-inventory state machine, retains only bounded final regular spans and computes a full decoded SHA-256. Accept its spans only after complete child/FD/hash/EOF/profile/TAR success and equality with §33.34's frozen expanded length/counts/extension/metadata digest. Require exactly one regular span for each approved name with exact index/size, safe bounded offsets and disjoint ranges. Linked/missing/duplicate/wrong-size targets STOP.
Only after complete first-pass acceptance, second core pass validates the full archive again and captures intersections with those two accepted ranges across arbitrary chunk boundaries. It recomputes the full decoded hash and requires exact equality with pass1, frozen summary equality, exact copied lengths and every original lifecycle/FD gate before releasing control bytes. Any late failure suppresses all payloads/candidates; provisional buffers remain private and are erased on failure/release. Ephemeral RAM erasure is not retained-filesystem deletion.
The operation permits at most two sequential existing-XZ children, each with the same v4 parser/decoder/input/FD/profile/limit controls and two complete compressed hash/EOF passes. Totals on success are409185120 compressed data bytes,409185124 requested bytes and4 positive archive/root closes. Before/after each child, reverify staged images and preload absence; gate limits are4 checks,4096 helper calls,11032864 read bytes and20 closes, counted separately. Start pass2 only with>=120s remaining in the authoritative250s outer clock; each core retains120s including3s cleanup, source capture<=10s and tool capture260s. These remain ordinary cooperative controls, not hard RSS/process-tree/deadline guarantees.
Explicitly increase only the private core's **internal metadata-summary envelope** from262144 to4194304 bytes via one checked source replacement. This contains spans plus other fields, not just a4MiB span array; overflow STOPs. The decoded505333760-byte archive is never retained in RAM or written as a convenience file. Retain only digest state, bounded span metadata and approved16087 payload bytes. Compiler-real/helper/relocation-manifest candidates use fixed regular-file predicates,<=128 entries/64KiB with no truncation; candidate metadata authorizes no later open/extraction/execution.
After both core passes succeed, decode the1383-byte script as strict bounded UTF-8 data, reject non-display controls and emit its escaped text/hash without invoking a shell. Inspect the14704-byte wrapper with the already-tested requirements-v2 byte parser and emit selected bounded ELF declarations/hash. Neither observation establishes relocation safety, executable usability, complete symbols/source/hardware closure, Python-free SDK suitability, Native authority or training readiness.
New inspection source15257/`f6736f8f00524782a32784b7a2f3bba350d39633545f521f12924524b8a856fa`; operation16034/`504b1dbaaca54cc7613092717da4732afb63e68c01ee5554db41309b4dd83ff7`. Raw TAR/ELF/stage/original core/v2/v4 helper pins remain those in §§33.30–33.33; no previous physical helper operation is called. The raw core23261/bd2fc436… first retains the fixed event profile23262/c163c52e…, then the internal-summary transform produces23264/`ac4aba7af508898603f7b19e37c9d31b5af488dab14192dd6560186b7654c12c`. The v4 private TAR15568/56cac49b… links inspection source as36026/`f5806e75d5d1e872e6e5ebe62f891762fdd6ec685108e8adf2d4d672508c9d4f`, and the core links that exact shared instance as71309/`dccab592815279a160181fc84d1c7aab320f8868ae209562c9abce592afa4c64`. Check every raw/intermediate/linked image before data-URL import; no executed pathname is reopened.
Receipt inputs are the unchanged4239/e45d6523… Step1 data receipt and2732/SHA-256 `755a922e587e17b5978e3df77f96ac4a6fb43499d19df895c9148f0952fedcf5` v4 inventory data receipt. Both are explicitly parent transcriptions, not authentication capabilities. The operation additionally matches their frozen profile/summary/control identities before access. Original archive/root nine-field expectations remain §33.22; independent device identities remain valid.
Parent verification passes61 synthetic/mock/static tests and all three syntax checks. No live control-member access occurred in those tests. Required source gates, diagram validation and exact command/section registration precede the one two-pass operation. A successful result is CONTROL DATA INSPECTED only, not Step2 completion, extraction approval, an automatic successor or any model/SDK execution authority.

<!-- BEGIN GNU SDK CONTROLS V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/gnu-sdk-controls-operation.mjs');
if (source.length !== 16034 || createHash('sha256').update(source).digest('hex') !== '504b1dbaaca54cc7613092717da4732afb63e68c01ee5554db41309b4dd83ff7') throw new Error('E_SOURCE_PIN');
const operation = await import('data:text/javascript;base64,' + source.toString('base64'));
const result = await operation.runRegisteredGnuSdkControls();
process.exitCode = result.exitCode;
process.stdout.on('error', () => { process.exitCode = 1; });
process.stdout.write(result.text);
NODE
```
<!-- END GNU SDK CONTROLS V1 -->

Required quality/security source gates accept only this exact bounded two-child data-inspection scope with no findings; spec correspondence is in-sync. Its owner passes offline pinned-theme check/render. Launcher710/SHA-256 `fb899f2a96fc4f895c0fcd216a69627c0c5b012adc43212c568bff3008f8ccca` passes syntax-only parsing without invoking the operation. Register complete current-section identity before its one physical use. No extraction, SDK/script execution, installation or Step2 completion follows automatically.

### 33.36 SDK controls inspected as data — relocation inputs identified

Section163062/SHA-256 `f6f4610cc043bf58e85d8da1a9b1d4ebbfe53472735d622ff811e9e40f037fe9` bound launcher710/`fb899f2a96fc4f895c0fcd216a69627c0c5b012adc43212c568bff3008f8ccca` and operation16034/`504b1dbaaca54cc7613092717da4732afb63e68c01ee5554db41309b4dd83ff7`. The exact two-child operation returned SDK_CONTROL_DATA_INSPECTION after both complete core successes,409185120 compressed data bytes/409185124 requested bytes,4 positive archive/root closes and all4 staged/preload gates. Each decoded pass matched505333760 bytes and the frozen TAR summary; full decoded SHA-256 `5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f` matched across both passes. Exactly16087 approved payload bytes were captured; no unselected payload, extracted file or SDK program was materialized/executed.
Persist selected fields and exact candidate spans in [`gnu-sdk-controls.receipt.json`](../tooling/native-ingress/gnu-sdk-controls.receipt.json), explicitly a parent transcription rather than an authenticated raw transcript or permission object. Wrapper14704/SHA-256 `d3866fc0dac5d923706f872fbc3fa58d7bfd191336c341ee608f48324700801f` declares interpreter `/lib64/ld-linux-x86-64.so.2`, only libc.so.6, no RPATH/RUNPATH and GLIBC_2.14/2.3/2.2.5; build-ID596219f675bdffc4106097f6e297a2811c2e35e1 remains an unauthenticated label. The wrapper was parsed, not executed or qualified as usable.
Relocation script1383/SHA-256 `d4a5d33d9f3976f30bd298a5f823b4b89b2c1d364bd9485aea8c35f1472279ba` was UTF-8 DATA_ONLY. Its text names `share/buildroot/sdk-location` and `share/buildroot/sdk-relocs`, rewrites listed text files and updates the location file last. No shell/sed/readlink/cat operation ran. Treat those declarations as inputs for a future checked Node preparation plan, not instructions or permission to execute the script or open its names.
Accepted regular spans identify gcc-15.3.0.br_real2349760 bytes/index29/offset61895680 and sdk-location79/index279/offset265943552. Compiler helpers cc1/cc1plus/lto1 are48–52MiB and exceed the present4MiB ELF API; defer them rather than silently raising a parser limit or following a compiler alias. No selected driver/helper is extracted or executed.
Architect accepts the next separately scoped DATA_ONLY inspection of the real GCC driver, sdk-location and the newly registered literal sdk-relocs member. Keep the prior two-target API/source unchanged. Validate exact known spans and a unique regular sdk-relocs payload1..1MiB before capture, aggregate<=3398415 bytes. Both decoded passes must now match the independently recorded5e7f9602… hash as well as metadata. Parse location/manifest as strict bounded literal data, join each manifest path to accepted regular-span metadata, reject links/traversal/duplicates/unsupported syntax and emit no mutation/execution authority. Source/gates/registration remain pending.
NoPython subset selection, safe relocation, executable/loader/library closure, offline Rust sources, build enforcement, compiled tests and F9/whole-decision acceptance remain open. No Step2 completion or further verified-step commit follows this inspection milestone.

### 33.37 Registered GCC driver and relocation-data inspection

Register one new two-child DATA_ONLY operation for exactly three literal regular archive members under `x86-64--glibc--stable-2026.08-1`: `bin/x86_64-buildroot-linux-gnu-gcc-15.3.0.br_real`2349760 bytes/index29/offset61895680; `share/buildroot/sdk-location`79/index279/offset265943552; and newly registered `share/buildroot/sdk-relocs`, whose unique final regular span must be1..1048576 bytes before capture. Aggregate payload<=3398415 bytes; linked, missing, duplicate, wrong known tuples, overlapping or out-of-range spans STOP. No captured member or manifest reference becomes a host path, mutation or execution capability.
Preserve all previous fixed-target APIs/source/operator/test bytes. The new collector first obtains accepted final member spans, then captures only those three ranges during a second ordinary TAR pass. **Both** full decoded hashes must equal the now independently recorded `5e7f960281fb93121982f95976eb59ed980e009b54aabf993d5d3fa2982e056f`, with frozen metadata/counts from §33.34. It is not enough for the two passes merely to agree with each other. Require all original archive SHA/EOF/FD/profile/preload/child closure gates before payload interpretation or publication. Failures suppress all payloads/parsed results; only ephemeral buffers are erased.
Parse the real driver with the unchanged4MiB requirements-v2 byte API, never GCC execution. Parse sdk-location as one bounded absolute-prefix data line with at most one terminal LF. Parse sdk-relocs as<=4096 unique canonical relative literal paths; reject controls, unsupported quoting/interpolation, absolute/drive/traversing/empty components, backslashes, duplicate/blank lines and malformed UTF-8. Join every list entry to accepted **regular** span metadata under the SDK prefix; missing or linked references STOP without following them. Bound lookup-key metadata<=4MiB and joined output<=1MiB. Python/GDB names remain data, not authorized exclusions or proof of a usable subset.
The operation writes no filesystem object, extracts no SDK file, executes no wrapper/driver/shell/script/Python, uses no network and deletes no retained data. It retains only bounded span/lookup/digest state and approved payloads, not the505MiB decoded archive. Internal core/span metadata envelopes remain4MiB total; final escaped-ASCII envelope<=2MiB and ELF declarations<=128KiB. No output truncation or silent reference omission is allowed.
The two deterministic core passes retain four compressed archive hash/EOF passes totaling409185120 data/409185124 requested bytes and4 positive archive/root closes on success. At most two children; no second after failure or with<120s remaining in the authoritative250s outer clock. Source preflight<=10s; each core120s includes3s cleanup; tool capture260s. Four staged/preload checks retain helper bounds4096 calls/11032864 read bytes/20 closes. All v4 parser/decoder/resource/security gates stay unchanged; hard resource/tree/time, immutability, installed usability, Python-free subset, Rust/F9 and training assurances remain false/unproved.
Collector18551/SHA-256 `3e9acafe464aa0a4418d5c9c7522683c2948035b93f95c96a290b8fdb264ec93`; operation14977/`77c3e004a68cd7b860354da5e3f83053bfd5352136ce0e7cc6cfd4f008a65a3a`. Existing raw TAR/ELF/stage/core/v2/v4 helper and4239/e45d6523… Step1 receipt pins remain unchanged. The private v4 TAR15568/56cac49b… links collector as39320/`5cad22b3e05d1246fa8cc276b73f21df6f43035c10e5ef3d1a4e7c6cb6f57af8`; the existing private metadata core23264/ac4aba7a… links that exact shared instance as75701/`c59e9f279b894e3fb422b7cf54b8e55af8f8febf2b138a75b20e2c32e2aeceb4`. Check original/intermediate/linked images before data-URL import; no executed source pathname is reopened and no previous physical helper operation is called.
Parent verification passes98 synthetic/mock/pure tests and all three syntax checks, including independent decoded-hash rejection, strict path grammar, regular-span joins, capture boundaries, late failure suppression, resource checks and unchanged decoder profile. No actual driver/manifest payload was read by those tests. Required source gates, diagram validation and exact command/section identity precede live use. No extraction, relocation, executable qualification or Step2 completion follows automatically from the result.

<!-- BEGIN GNU SDK DRIVER CONTROLS V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/gnu-sdk-driver-controls-operation.mjs');
if (source.length !== 14977 || createHash('sha256').update(source).digest('hex') !== '77c3e004a68cd7b860354da5e3f83053bfd5352136ce0e7cc6cfd4f008a65a3a') throw new Error('E_SOURCE_PIN');
const operation = await import('data:text/javascript;base64,' + source.toString('base64'));
const result = await operation.runRegisteredGnuSdkDriverControls();
process.exitCode = result.exitCode;
process.stdout.on('error', () => { process.exitCode = 1; });
process.stdout.write(result.text);
NODE
```
<!-- END GNU SDK DRIVER CONTROLS V1 -->

Required quality/security source gates accept only this exact bounded data-only two-child scope with no findings; spec correspondence is in-sync. Its owner passes offline pinned-theme check/render. Launcher723/SHA-256 `8c132abc22d93c8d07e1b29f21623a3862dd5f8b412c2956f95ac914de7247f6` passes syntax-only parsing without invoking the operation. Register complete current-section identity before its one physical use. No extraction, relocation, SDK execution, installation or Step2 completion follows automatically.

### 33.38 Driver-controls STOP — manifest grammar not accepted

Section171974/SHA-256 `d5458c6133ea3163c622af668f5c1f191231f6b392f484e7fcce1b1f23b7e977` bound launcher723/`8c132abc22d93c8d07e1b29f21623a3862dd5f8b412c2956f95ac914de7247f6` and operation14977/`77c3e004a68cd7b860354da5e3f83053bfd5352136ce0e7cc6cfd4f008a65a3a`. The exact operation returned STOP/E_MANIFEST after both complete core passes. No parsed driver/location/manifest result, relocation or executable qualification was accepted.

```json
{"profile":"registered-gnu-sdk-driver-controls-v1","status":"STOP","counts":{"sourceReads":7,"sourceBytes":116600,"receiptReads":1,"receiptBytes":4239,"spawnAttempts":2,"spawnEvents":2,"stageChecks":4,"preloadChecks":4,"stageFsCalls":320,"stageReadBytes":11032864,"stageCloses":20,"completedCorePasses":2,"archivePasses":4,"archiveDataBytes":409185120,"archiveRequestedBytes":409185124,"archiveCloseAttempts":4},"sourceAccountingComplete":true,"receiptAccountingComplete":true,"stageAccountingComplete":true,"archiveAccountingComplete":true,"inspection":{"phase":"failed","factoryCalls":2,"hasCompleteMemberPass":true,"hasAcceptedMemberPass":true,"hasCompleteSecondPass":true,"hasAcceptedSecondPass":true,"memberCompletedFeedCalls":7711,"memberBytes":505333760,"captureCompletedFeedCalls":7711,"captureBytes":505333760,"copiedBytes":2359206},"candidateExecuted":true,"realArchiveInspected":false,"archiveExtracted":false,"filesInstalled":false,"pythonRuntimeInvoked":false,"nativeQualified":false,"installedUsability":false,"pythonFreeSubsetVerified":false,"rustReady":false,"trainingReady":false,"error":"E_MANIFEST"}
```

Both full decoded hashes and frozen summaries passed; capture and lifecycle gates passed before strict manifest interpretation failed. [Inference] Exact copied-byte accounting implies a9367-byte sdk-relocs body after subtracting the two fixed target sizes, but this receipt did not publish its span/hash or rejected line. Leading `./`, duplicate entries or another grammar condition remain hypotheses, not observations. Do not normalize, omit or accept a line without evidence.
Keep this source/operator/test and STOP unchanged. Architect accepts a separately registered diagnostic proposal with unchanged grammar and execution bounds. Instrument only the private captured manifest validator to latch a fixed reason, explicit1-based line ordinal, rejected-line UTF-8 byte count and the first<=128 **original manifest bytes** as<=256 hex characters, plus manifest length/SHA-256. Preserve original exception identity/STOP, never inspect exception messages/getters and never publish the full manifest/path list or ordinary result on failure. Release that narrow diagnostic only after both complete core results **and** the collector's own second-pass acceptance; counters alone are insufficient. Existing payload buffers remain erased on abort/release; immutable diagnostic strings/runtime copies do not receive a secure-erasure claim.
The diagnostic source/gates/registration remain pending. It authorizes no grammar relaxation, relocation, extraction, SDK code execution, automatic retry/successor or Step2 completion.

### 33.39 Registered strict-manifest diagnostic — bounded disclosure after both passes

Register one new two-child diagnostic operation with the same three fixed targets, independent decoded SHA/metadata expectations, archive/root identities, staged/preload checks and resource/lifecycle envelopes as §33.37. All original strict path grammar and return/rejection behavior remain unchanged; no line normalization, omission, sorting or acceptance is introduced. Preserve the prior collector/operator/test and STOP byte-for-byte. No filesystem write/extraction/relocation, shell/GCC/Python/SDK execution, network, deletion or automatic successor occurs.
Instrument only the private checked collector source's existing manifest rejection branches and append a fixed snapshot helper. Each source needle must occur exactly once. Path/UTF-8 catches rethrow the original exception by identity; other rejected branches still invoke the original failure with the same code. The first diagnostic is latched; it never repairs a path or replaces an error. Reasons are fixed EMPTY_BODY, LINE_COUNT_LIMIT, PATH_GRAMMAR, ROOTED_PATH_TOO_LONG, DUPLICATE_LITERAL_LINE or INVALID_UTF8, not exception messages/getters.
The narrow diagnostic contains explicit1-based pathLineOrdinal (or null), measured rejected-line UTF-8 byteLength (0 when unavailable or the next line was not consumed, including LINE_COUNT_LIMIT), manifest byte length/SHA-256, and the first<=128 **original manifest bytes** encoded as<=256 lowercase hex characters. It is<=512 UTF-8 JSON bytes. Prefix bytes are not an implicitly selected/re-encoded offending path. Immutable strings/runtime copies receive no secure-erasure claim; existing private payload Buffers remain erased on abort/release.
This is an explicitly registered exception to prior failure-data suppression: publish that diagnostic only after two complete accepted core results **and** the collector's own second-pass acceptance, with an empty pre-existing diagnostic and entry into post-core interpretation. Counters or a cached old diagnostic cannot authorize release. Preserve STOP/E_MANIFEST or E_TEXT and suppress the ordinary result/full manifest/path list/provisional inventory on failure. Location failures before manifest interpretation release no manifest prefix. Diagnostic data conveys no host-path or mutation permission.
Original collector18551/`3e9acafe464aa0a4418d5c9c7522683c2948035b93f95c96a290b8fdb264ec93` produces branch-instrumented19277/`9f96f59c63adb3e4c8e2f68806b3b995b709a3cf397ef4395c1fd6c4eda6d8bc`, then final21085/`b9b4ff809e29a6c4294e81458ee77841d08df3d77b805f94a973266984957806`. Its private v4-TAR link is41854/`007a827b19db8d621ce9f5c796aee978a2da2d7c0864bb61c67162470635680b`; the existing metadata core23264/ac4aba7a… links that same instance as79081/`8aa76fef8b282867ff2f8e6f624ba0f202a01a55af19f91ae9a9202208c50214`. Other raw/helper/receipt/stage/ELF pins remain unchanged from §33.37. Verify original/intermediate/final/linked hashes before captured data-URL import; no executed source pathname is reopened.
Operation20215/SHA-256 `9bc50dc9e1115170bda3d483d727b1ad488ab167513dedbf2a3e1d0767acb2ab` retains all250s outer/10s preflight/per-core120s including3s cleanup/tool260s limits and<=2MiB final ASCII output. No third child, automatic retry, parser/schema accommodation or cap increase follows a STOP. Hard RSS/process-tree/deadline, source/immutable loading, SDK/Python-free/Rust/F9/training acceptance remain unproved/false.
Parent verification passes50 new pure/mock/static tests, both syntax checks and all98 retained strict driver-control tests (148/148 combined,0 failures/skips/cancellations/todo). Tests cover unchanged errors, every reason, raw-prefix/ordinal bounds, first-error latching, invalid UTF-8, post-core release gates and failure suppression. No actual manifest diagnosis occurred. Required source gates, diagram validation and exact command/section identity precede live use.

<!-- BEGIN GNU SDK MANIFEST DIAGNOSTICS V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/gnu-sdk-manifest-diagnostics-operation.mjs');
if (source.length !== 20215 || createHash('sha256').update(source).digest('hex') !== '9bc50dc9e1115170bda3d483d727b1ad488ab167513dedbf2a3e1d0767acb2ab') throw new Error('E_SOURCE_PIN');
const operation = await import('data:text/javascript;base64,' + source.toString('base64'));
const result = await operation.runRegisteredGnuSdkManifestDiagnostics();
process.exitCode = result.exitCode;
process.stdout.on('error', () => { process.exitCode = 1; });
process.stdout.write(result.text);
NODE
```
<!-- END GNU SDK MANIFEST DIAGNOSTICS V1 -->

Required quality/security source gates accept only this exact bounded post-core diagnostic-disclosure scope with no findings; spec correspondence is in-sync after clarifying that byteLength0 can mean an unconsumed/unavailable line. Its owner passes offline pinned-theme check/render. Launcher733/SHA-256 `f6fea5ccb4dcef941da00d1ec9446866d11087f671bd13696e1bb36b348fbf7e` passes syntax-only parsing without invoking the operation. Register complete current-section identity before its one physical use. No grammar relaxation, relocation, extraction, SDK execution or Step2 completion follows automatically.

### 33.40 Manifest diagnostic observed — one leading dot-slash alias on line1

Section180536/SHA-256 `eeb1727c525bb397ce5fd4eeb3e530892a79d358db917876ab6f562c8898f92a` bound launcher733/`f6fea5ccb4dcef941da00d1ec9446866d11087f671bd13696e1bb36b348fbf7e` and operation20215/`9bc50dc9e1115170bda3d483d727b1ad488ab167513dedbf2a3e1d0767acb2ab`. The exact operation preserved STOP/E_MANIFEST after two complete accepted cores and the collector's own second acceptance, then released only the registered bounded diagnostic.

```json
{"reason":"PATH_GRAMMAR","pathLineOrdinal":1,"byteLength":13,"prefixHex":"2e2f62696e2f69666e616d65730a2e2f62696e2f61636c6f63616c0a2e2f62696e2f796163630a2e2f62696e2f6e63757273657377362d636f6e6669670a2e2f62696e2f6175746f6d3474650a2e2f62696e2f6175746f6d616b652d312e31360a2e2f62696e2f6c6962746f6f6c0a2e2f62696e2f6175746f7570646174650a","manifestByteLength":9367,"manifestSha256":"60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e"}
```

The first original bytes decode as inert text beginning `./bin/ifnames`, followed by other `./bin/...` lines. This establishes one leading `./` on the first rejected line, not validity of every remaining line. The manifest's exact9367-byte/SHA-256 identity is now independently recorded. No ordinary parsed result, full manifest or relocation/execution permission was accepted.
Both core passes retained409185120 compressed data bytes/409185124 requested bytes,4 positive archive/root closes,4 staged/preload checks and the independent decoded/metadata matches; no SDK or Python program ran, and no file was extracted, rewritten, installed or deleted. Keep both strict and diagnostic source/operator/test bytes and STOPs unchanged.
Architect accepts a separately reviewed v2 data-interpretation proposal `single-leading-dot-slash-v1`: strip **exactly one** leading `./`, then apply all existing canonical grammar, rooted-length, duplicate and regular-span lookup checks. `a` plus `./a` must reject as duplicate; `././a`, internal dot/parent components, absolute paths and all other prohibited syntax remain rejected. Do not trim or perform general normalization. Bind the independently known manifest length/hash before driver ELF interpretation/publication; because the existing collector exposes the hash after parsing/joining, do not claim that specific check happened before parsing. Preserve raw manifest byte identity and explicitly label returned names as canonical alias interpretations, never mutation authority.
New source, grammar/security gates and one-run registration remain pending. No automatic fallback from strict to alias grammar, SDK execution, extraction, relocation, subset approval or Step2 completion follows this diagnostic.

### 33.41 Registered driver-controls-v2 — one measured manifest prefix alias

Register a separate data-interpretation profile `single-leading-dot-slash-v1` for the same three targets and two-pass workflow in §33.37. Interpret `canonical = rawLine.startsWith('./') ? rawLine.slice(2) : rawLine`, then apply all existing literal-path grammar, rooted-length, duplicate and accepted-regular-span lookup checks to canonical. Do not trim, decode escapes, strip a second prefix or perform any other normalization. `a` plus `./a` rejects as duplicate; `././a`, internal dot/parent components, absolute/drive paths, backslashes, controls, blank/duplicate lines, quotes/interpolation and missing/linked references remain fatal. The raw input remains bounded by the existing manifest envelope; canonical rooted names retain the1024-byte bound.
Preserve strict v1, diagnostic and every older source/API/operator/test byte. Only the private captured collector initializer and its output interpretation marker change through exact one-occurrence replacements. Original18551/`3e9acafe464aa0a4418d5c9c7522683c2948035b93f95c96a290b8fdb264ec93` produces initializer18626/`b53dcc3d14bf26d8225fa1dffc555a793c6c57a6e0f764dfe20d20fccbd35a0e`, then alias collector18643/`b156311ac91f5a9078124a70b1388f7ea1cb6986fa06508a71eb54cf2a3eb69d`. Its private-v4-TAR link is39412/`276b530964b75115dee14659f69376a0ce2641490f57a014e1232ebb447b8939`; the unchanged metadata core23264/ac4aba7a… links that exact instance as75825/`5d6ddaa029fa87a932430fc434dfd70f670eba49cc9bed42cf7f0063286fadf4`. Check every original/intermediate/final/linked image before data-URL import; no executed pathname is reopened.
Operation16909/SHA-256 `c87985fb61eeba3e6188a5dc5fa8f3fbe6c3db856c9ab4e745debad39be728e1` additionally requires manifest byteLength9367 and SHA-256 `60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e` after parsing/joining and before driver ELF inspection/publication. Do not claim this particular member-hash comparison occurred before parsing. Both complete decoded hashes still independently match5e7f9602… before collector acceptance. Publish the explicit alias interpretation and raw manifest reference, not an unqualified raw-literal-path description or mutation authority.
Everything else remains §33.37: exact archive/root snapshots, known driver/location tuples and unique bounded sdk-relocs span; payload aggregate<=3398415; two children/four archive hash/EOF passes409185120 data bytes/4 positive closes; complete child/pipe/profile/preload/summary gates;4MiB internal/lookup metadata,<=4096 unique lines/1MiB joins/2MiB final ASCII; source10s/core120s including3s cleanup/outer250s/tool260s and>=120s remaining before pass2. No cap increase, alternate grammar fallback, retry or automatic successor follows a failure. No filesystem write/extraction/relocation, shell/GCC/Python/SDK execution, networking or retained-data deletion occurs.
The alias strips no security boundary and confers no filesystem access: every accepted canonical name still binds only to final regular-span metadata from the exact archive. Python/GDB references do not approve exclusions or a usable subset. Native/source/loading/hard-resource/Rust/F9/training qualifiers remain false/unproved. No Step2 completion follows mere data inspection.
Parent verification passes80 new pure/mock/static tests plus retained98 strict and50 diagnostic checks (228/228 combined,0 failures/skips/cancellations/todo), and both new syntax checks. Cases cover canonical aliases/duplicates, repeated prefixes, prohibited syntax and links, post-parse fixed SHA rejection before ELF/publication, lifecycle failure suppression and unchanged source variants. No physical alias-profile use has occurred. Required fresh grammar/security/source gates, diagram validation and exact command/section identity precede its one registered use.

<!-- BEGIN GNU SDK DRIVER CONTROLS V2 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/gnu-sdk-driver-controls-v2-operation.mjs');
if (source.length !== 16909 || createHash('sha256').update(source).digest('hex') !== 'c87985fb61eeba3e6188a5dc5fa8f3fbe6c3db856c9ab4e745debad39be728e1') throw new Error('E_SOURCE_PIN');
const operation = await import('data:text/javascript;base64,' + source.toString('base64'));
const result = await operation.runRegisteredGnuSdkDriverControlsV2();
process.exitCode = result.exitCode;
process.stdout.on('error', () => { process.exitCode = 1; });
process.stdout.write(result.text);
NODE
```
<!-- END GNU SDK DRIVER CONTROLS V2 -->

Required quality/security source gates accept only this exact fixed data-only two-child alias scope with no findings; spec correspondence is in-sync. Its owner passes offline pinned-theme check/render. Launcher728/SHA-256 `755091a62ac1bbf6d8aa2afe4c334ceae5c01c3a94088a478ae9a355f415c9b3` passes syntax-only parsing without invoking the operation. Register complete current-section identity before its one physical use. No fallback, extraction, relocation, SDK execution, usable-subset or Step2 completion follows automatically.

### 33.42 Alias profile STOP — first nonregular manifest reference remains unknown

Section188506/SHA-256 `1ff15e1b7b6034dcec744e2f063a879eb99ffbe862ef9d1b442191bc2750c76b` bound launcher728/`755091a62ac1bbf6d8aa2afe4c334ceae5c01c3a94088a478ae9a355f415c9b3` and operation16909/`c87985fb61eeba3e6188a5dc5fa8f3fbe6c3db856c9ab4e745debad39be728e1`. The exact alias-profile operation preserved STOP/E_REFERENCE after two complete accepted core passes and the collector's own second acceptance. Grammar advanced past the measured leading-prefix issue, but no ordinary parsed result or member qualification was accepted.

```json
{"profile":"registered-gnu-sdk-driver-controls-v2","status":"STOP","manifestInterpretation":"single-leading-dot-slash-v1","counts":{"sourceReads":7,"sourceBytes":116600,"receiptReads":1,"receiptBytes":4239,"spawnAttempts":2,"spawnEvents":2,"stageChecks":4,"preloadChecks":4,"stageFsCalls":320,"stageReadBytes":11032864,"stageCloses":20,"completedCorePasses":2,"archivePasses":4,"archiveDataBytes":409185120,"archiveRequestedBytes":409185124,"archiveCloseAttempts":4},"sourceAccountingComplete":true,"receiptAccountingComplete":true,"stageAccountingComplete":true,"archiveAccountingComplete":true,"inspection":{"phase":"failed","factoryCalls":2,"hasCompleteMemberPass":true,"hasAcceptedMemberPass":true,"hasCompleteSecondPass":true,"hasAcceptedSecondPass":true,"memberCompletedFeedCalls":7711,"memberBytes":505333760,"captureCompletedFeedCalls":7711,"captureBytes":505333760,"copiedBytes":2359206},"candidateExecuted":true,"realArchiveInspected":false,"archiveExtracted":false,"filesInstalled":false,"pythonRuntimeInvoked":false,"nativeQualified":false,"installedUsability":false,"pythonFreeSubsetVerified":false,"rustReady":false,"trainingReady":false,"error":"E_REFERENCE"}
```

The code denotes a canonical manifest name without an accepted **regular** span. It does not identify a hardlink, symlink, ancestor alias or absence. Do not follow targets, skip a reference or broaden the join policy from this code alone. Preserve all strict, diagnostic and alias source/operator/test bytes and each STOP.
Architect accepts a separate reference-diagnostic proposal: observe the existing first-pass parser's returned metadata events (not another parser/walker), privately retain only bounded index/path/type/size/link metadata for<=8412 entries/4MiB accounted storage, and latch incompleteness on overflow without changing parsing. After full first-pass acceptance the complete map must match the accepted entry count. Instrument only the first missing-regular-span branch to record the rejected canonical/rooted archive name, its exact recorded kind or ABSENT, and<=16 component-boundary ancestor links. Targets remain uninterpreted strings; perform **no** target lookup or chain resolution. More ancestors or incomplete metadata withholds the diagnostic rather than truncating or inventing absence.
Explicitly register this narrow failure-data disclosure only after both complete cores, collector second acceptance, independently pinned manifest9367/60f1b605… verification and complete accepted metadata. Counters/cached state alone cannot authorize release. Preserve original E_REFERENCE and ordinary-result suppression. New source/gates/registration remain pending; no link following, extraction, mutation, SDK execution, automatic retry/successor or Step2 completion follows this failure.

### 33.43 Registered reference-kind diagnostic — no target resolution

Register one separate two-child data diagnostic under the same targets, archive/root identities and all §33.41 alias-profile controls. Observe only the existing first member-pass parser's returned events, without another parser/walker or changed feed results. Privately retain own-data index/path/type/size/link fields for<=8412 entries/4MiB accounted JSON storage; this is not a hard heap bound. Saturation, invalid/accessor metadata or incomplete sequencing marks metadata incomplete, stops retention and forbids diagnostic release without changing parser behavior.
After complete first-core acceptance, require the accepted map count to match the frozen entry count. At the first existing missing-regular-span branch, preserve the original E_REFERENCE failure and latch only one diagnostic: canonical relative/rooted archive name, exact recorded member kind/entry or ABSENT, and<=16 proper component-boundary ancestor links. More ancestors withholds the diagnostic rather than truncating it. Link targets remain uninterpreted strings; perform no target lookup, path-chain resolution, filesystem link following or host access. No header/body/payload/full manifest/map is published.
Release that diagnostic only after both complete accepted cores, collector-owned second acceptance, complete accepted metadata, entry into post-core interpretation, no cached prior diagnostic and independent manifest length9367/SHA-256 `60f1b6054d8f01670a9f5ac3ac0181f7148e37be91025c2c4f111df30047305e` verification. The missing-regular-span branch otherwise still STOPs with no ordinary result; counters or partial metadata cannot create an ABSENT assertion or disclosure permission. Snapshot payload<=64KiB escaped JSON; retained data is immutable metadata only, not mutation authority.
Original collector18551/3e9acafe… retains the existing checked alias18643/`b156311ac91f5a9078124a70b1388f7ea1cb6986fa06508a71eb54cf2a3eb69d`, then branch19262/`efd92df23b2c110d6c1f0812030ca530e78d5b98ccfc65be7a898598bc2c1396`, final25336/`efab1ff27d8151c3893e6dac9773c2d5a3d7f6676fac5a121c19e8eed8f80bd7`, linked46105/`4020ea57b788d4d7cc5a83a66306929459dfa1fcc37991a03ad97a9888d19b95` and pipeline84749/`7dfa0d4d270462bcfcf8e979ea9d0b1e38c5b10665b4fdf26e736b2d088f642d`. Check every raw/intermediate/final/linked image before captured data-URL import. The old strict/alias/diagnostic source/operator/test bytes and all raw helper/TAR/ELF/staged/receipt pins remain unchanged; imported old operations supply pure helpers only, never a repeated physical operation.
Operation24957/SHA-256 `cf8a98ce858c92dce00a597ed078694799384a8006388d69daddfbd792b6ff88` retains two children/four compressed hash/EOF passes,4 positive archive/root closes,4 staged/preload gates, all parser/decoder/resource caps,250s outer/source10s/per-core120s including3s cleanup/tool260s,>=120s remaining before pass2 and<=2MiB final ASCII. No automatic retry, third child, alternate resolution/grammar/cap, extraction, relocation, shell/GCC/Python/SDK execution, network or retained-file deletion occurs. No subset, Rust/F9, source/loading/hard-resource or training assurance is promoted.
Parent verification passes64 pure/mock/static tests and both syntax checks, covering passive metadata completeness, first-kind/ABSENT/ancestor classification, proper component boundaries, saturation/ancestor withholding, manifest pin and post-core disclosure gates, unchanged errors and output suppression. No actual reference diagnosis occurred. Required source gates, diagram validation and exact command/section identity precede its one physical use; result data authorizes no further resolution or Step2 completion.

<!-- BEGIN GNU SDK REFERENCE DIAGNOSTICS V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/gnu-sdk-reference-diagnostics-operation.mjs');
if (source.length !== 24957 || createHash('sha256').update(source).digest('hex') !== 'cf8a98ce858c92dce00a597ed078694799384a8006388d69daddfbd792b6ff88') throw new Error('E_SOURCE_PIN');
const operation = await import('data:text/javascript;base64,' + source.toString('base64'));
const result = await operation.runRegisteredGnuSdkReferenceDiagnostics();
process.exitCode = result.exitCode;
process.stdout.on('error', () => { process.exitCode = 1; });
process.stdout.write(result.text);
NODE
```
<!-- END GNU SDK REFERENCE DIAGNOSTICS V1 -->

Required quality/security source gates accept only this exact bounded data-only two-child reference-diagnostic scope with no findings; spec correspondence is in-sync. Its owner passes offline pinned-theme check/render. Launcher735/SHA-256 `56706d32850bcd4535120f6f8e6eeb6d8d92d8c65a77107c573a3bb9235608d5` passes syntax-only parsing without invoking the operation. Register complete current-section identity before its one physical use. No resolution, link following, extraction, relocation, SDK execution, automatic successor or Step2 completion follows automatically.

### 33.44 First rejected reference observed — absent from the accepted archive namespace

Section197064/SHA-256 `98434de7722214634b8f97a9469b0cef2bfe3fa834fb40dd304af40348e3de02` bound launcher735/`56706d32850bcd4535120f6f8e6eeb6d8d92d8c65a77107c573a3bb9235608d5` and operation24957/`cf8a98ce858c92dce00a597ed078694799384a8006388d69daddfbd792b6ff88`. The exact diagnostic preserved STOP/E_REFERENCE after both complete cores, own second acceptance, the manifest pin and the complete accepted8412-entry metadata map.

```json
{"reason":"REFERENCE_NOT_REGULAR","canonicalRelativePath":"bin/ifnames","rootedPath":"x86-64--glibc--stable-2026.08-1/bin/ifnames","matchedEntry":"ABSENT","ancestorLinks":[]}
```

This is absence from the accepted archive namespace, not global filesystem absence or a proven explanation for why the SDK does not bundle that name. No target was looked up, followed, resolved, synthesized or skipped. Preserve the strict/alias/diagnostic errors and every corresponding source/operator/test byte unchanged.
The operation completed409185120 compressed data bytes/409185124 requested bytes,4 positive archive/root closes and4 staged/preload gates. Both decoded505333760-byte streams and frozen metadata matched; no extraction, mutation, SDK/shell/GCC/Python execution, network or retained-file deletion occurred. The ordinary parsed result stayed suppressed.
Architect accepts a different next DATA_ONLY question: classify **every** validated canonical manifest name against the complete accepted archive metadata/regular spans, instead of claiming all are valid regular relocation targets. Define precedence ANCESTOR_LINK first (proper component boundaries, preserve exact-match evidence), then REGULAR_FILE, NONREGULAR_ENTRY or ABSENT_FROM_ARCHIVE. Keep all link targets uninterpreted and resolve nothing. Represent all references or STOP; >16 ancestor links, inconsistent/incomplete metadata or output overflow STOPs without truncation. Preserve strict operations unchanged.
The proposed envelope is MANIFEST_MEMBERSHIP_DATA_NOT_RELOCATION_AUTHORITY with relocationReady:false. It may report driver ELF/location data after all existing hash/closure/pin gates, but a regular match or absence authorizes no preparation, exclusion, rewrite or host access. A later Python-free subset plan must name actual members and explicitly address unresolved classifications. New source/gates/registration remain pending; no extraction, SDK execution or Step2 completion follows this observation.

### 33.45 Registered complete manifest-membership observation — not relocation admission

Register a separate DATA_ONLY question, preserving every old strict/alias/diagnostic source/operator/test and its E_REFERENCE behavior. The new result is MANIFEST_MEMBERSHIP_OBSERVED with interpretation MANIFEST_MEMBERSHIP_DATA_NOT_RELOCATION_AUTHORITY and relocationReady:false. It observes every validated canonical manifest reference; it does not claim all names are regular relocation targets, infer why a name is absent, synthesize a file, skip a line or grant preparation/mutation permission.
Retain the existing three bounded payload targets, single-leading-dot alias grammar, independent decoded/metadata expectations and fixed9367/60f1b605… manifest pin. First-pass returned parser events privately form a complete own-data map for all8412 entries/4MiB accounted metadata; final regular spans separately remain<=4MiB. Validate count/ordering/completeness and exact regular-entry/span index/path/size/range consistency before acceptance. Incomplete/inconsistent metadata or resource overflow STOPs; no partial-map ABSENT inference is allowed. No extra walker, target lookup, link chain or host-path access occurs.
For each of<=4096 canonical names, emit exactly one observation in original manifest order. Precedence is ANCESTOR_LINK first using proper component boundaries while preserving exact-match evidence, otherwise REGULAR_FILE, NONREGULAR_ENTRY or ABSENT_FROM_ARCHIVE. Include bounded exact metadata, regular span when applicable and<=16 ancestor links; link targets stay uninterpreted strings. More ancestors or a missing/oversized observation STOPs with no truncation. Histogram totals must equal all references. Classification metadata<=1MiB in both UTF-8 and escaped ASCII; final envelope<=2MiB. These are explicit output/storage profile parameters, not hard heap bounds.
Interpret/publish only after both complete cores, collector second acceptance, independently pinned decoded and metadata hashes, manifest9367/60f1b605… verification and complete accepted metadata. Driver ELF and location remain declarations/data only; a REGULAR_FILE match confers no execution or rewrite authority. The old strict operations still reject missing/nonregular references. This new observer changes the output question rather than silently loosening a relocation validator.
Operation26714/SHA-256 `7273341b5857152d1c4ce62fc5bd5cf4bc438a82c8845504a7d84b3cb3b82250` captures unchanged raw collector18551/3e9acafe… and checked alias18643/b156311a…, then produces branch18836/`5fbec232e273f85489c4ac1772bf3a6998424adc98871fb0143b6f7f0b063614`, membership collector26517/`0b84b7c5a3f3645d15876167e3001cea687aa820b64fa2c2bd406279a36effe3`, linked47286/`ee562343f3bbb2409e6503de076db7dac3b15ba25e40a4abed3d9576ac89da11` and pipeline86321/`23ab71474cb22261dd7c7835aa72377488cd583d22536e47ee44f55aef949857`. Check all original/intermediate/final/linked images before same-instance data-URL imports. Other raw/helper/TAR/ELF/stage/receipt pins and all older physical-operation code remain unchanged; none is rerun through an imported helper.
All existing two-child/four compressed hash/EOF pass/4 positive archive-root closes/4 staged-preload controls remain. Source10s, core120s including3s cleanup, outer250s/tool260s,>=120s remaining before pass2 and every v4 decoder/parser/byte/resource gate remain unchanged. No automatic retry/successor, alternate grammar/resolution/cap, extraction, relocation, script/shell/GCC/Python/SDK execution, networking or retained-file deletion follows. Native/source/loading/hard-resource/subset/Rust/F9/training assurances stay unproved/false.
Parent verification passes76 pure/mock/static tests and both syntax checks, covering all classifications and precedence, complete-map/span consistency, canonical aliases/duplicates, encoded bounds, independent pin gates, same parser results/errors and failure suppression. No live membership observation occurred. Required source gates, diagram validation and exact command/section identity precede its one physical use; even a complete observation does not complete Step2.

<!-- BEGIN GNU SDK MANIFEST MEMBERSHIP V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/gnu-sdk-manifest-membership-operation.mjs');
if (source.length !== 26714 || createHash('sha256').update(source).digest('hex') !== '7273341b5857152d1c4ce62fc5bd5cf4bc438a82c8845504a7d84b3cb3b82250') throw new Error('E_SOURCE_PIN');
const operation = await import('data:text/javascript;base64,' + source.toString('base64'));
const result = await operation.runRegisteredGnuSdkManifestMembership();
process.exitCode = result.exitCode;
process.stdout.on('error', () => { process.exitCode = 1; });
process.stdout.write(result.text);
NODE
```
<!-- END GNU SDK MANIFEST MEMBERSHIP V1 -->

Required quality/security source gates accept only this exact bounded data-only membership-observation scope with no findings; spec correspondence is in-sync. Its owner passes offline pinned-theme check/render. Launcher731/SHA-256 `b18fe5a032ea79435be99047f338fcba970ce3b026e7fade8965379f773a7807` passes syntax-only parsing without invoking the operation. Register complete current-section identity before its one physical use. No exclusion, resolution, preparation, relocation, extraction, SDK execution, automatic successor or Step2 completion follows automatically.

### 33.46 Complete membership observed — data only; executable closure remains pending

Section205126/SHA-256 `f092b781bf257a07d0182b35fe55648c30418021bf233ebc138c1a11be880c3e` bound launcher731/`b18fe5a032ea79435be99047f338fcba970ce3b026e7fade8965379f773a7807` and operation26714/`7273341b5857152d1c4ce62fc5bd5cf4bc438a82c8845504a7d84b3cb3b82250`. The exact operation returned MANIFEST_MEMBERSHIP_OBSERVED. All190 canonical references were represented:152 REGULAR_FILE,38 ABSENT_FROM_ARCHIVE,0 NONREGULAR_ENTRY and0 ANCESTOR_LINK. relocationReady remains false. No absent name was resolved, skipped, synthesized or treated as permission to exclude/relocate anything.
Recovered the complete saved result rather than rerunning the consumed operation. Persist selected fields, all38 absent names and a digest binding the complete190-observation array in [`gnu-sdk-manifest-membership.receipt.json`](../tooling/native-ingress/gnu-sdk-manifest-membership.receipt.json). It explicitly labels parent transcription and retains the raw captured-output path. The single profile JSON line including LF is104481 bytes/SHA-256 `2a0eacd3fc18a8a1074057c8fa5d4211b379e6808eca347a29a269908c4e0c33`; the complete observation-array JSON without LF has SHA-256 `4815c03bb8dd8f4ccc5f9487144bda30654e5de8e72f535e84fdc69e419d51ec`. Neither digest authenticates the parent/runtime or confers Native authority.
Both core passes matched independent decoded SHA5e7f9602… and metadataefe53c8f…, completing409185120 compressed data bytes,409185124 requested bytes,4 positive archive/root closes,4 staged/preload checks and complete accepted6891 regular-file spans/8412 metadata entries. The operation read no new source graph variant beyond its registered capture and executed no SDK program, Python, installer or relocation script. No file was extracted, installed, rewritten or deleted.
The real GCC driver2349760/index29/offset61895680 has SHA-256 `4db3aa91de31f611171a7d231c2ea10c8d50630969bdef76167dce6a62638165`. Requirements-v2 declares interpreter `/lib64/ld-linux-x86-64.so.2`, libc.so.6 and ld-linux-x86-64.so.2 dependencies, RUNPATH `$ORIGIN/../lib`, no RPATH and GLIBC2.3/2.15/2.7/2.14/2.11/2.2.5 names. These are ELF declarations, not usable/symbol/hardware/runtime qualification. The79-byte location/index279/offset265943552 has SHA-256 `e4df82547e211e82635d37dc97cd4bce2f5d941aebb24717a32b242811ea052f` and inert prefix `/builds/buildroot.org/toolchains-builder/build/x86-64--glibc--stable-2026.08-1`. No host access to that prefix occurred.
The38 absent references remain explicit unresolved whole-SDK relocation inputs. Regular observations include GDB/Python-associated files; no whole-SDK Python-free claim follows. A new minimal-role subset plan must independently enumerate actual selected members, runtime/helper/sysroot closure and every excluded or unresolved legacy reference; membership alone authorizes none of those decisions. Larger compiler helpers exceed the existing4MiB ELF profile and require a separate bounded parser profile before inspection. All old profiles/source/API/test bytes and STOPs remain preserved.
Step2 remains active. Rust/Burn compilation/tests, one-meter BOTH-window affordability, positive fitted-economic hydration/admission, complete store/resume lifecycle and frozen F9 obligations remain open. No partial milestone is committed or pushed as a completed remaining step; published Step1 remains2a64037d.

### 33.47 Accepted next preparation design — bounded candidate catalog, then literal payload batch

Architect/domain review separates HOST tool/runtime requirements from TARGET CRT/library/header inputs. The global relocation list is not an execution or extraction list. Preserve all190 legacy classifications; all38 absent names stay absent, and any future NOT_SELECTED_FOR_REGISTERED_ROLE disposition remains a distinct minimal-role context rather than a claim that those names were successfully relocated. Do not run the SDK relocation script or omit unresolved references from a whole-SDK relocation claim.
Existing receipts do not expose every actual assembler/linker/runtime provider name. A prerequisite **metadata-only candidate catalog** will therefore use one decoder child/two compressed hash/EOF passes, the same independent decoded/metadata pins and complete8412-entry/6891-span checks. Observe only existing parser events; no payload capture or extra walker. Freeze anchored component-aware discovery predicates before execution, deduplicate with all role IDs and publish candidate presence/absence—not satisfied roles or member selection. Finite families cover SDK driver/wrapper/binutils aliases, GCC helpers, HOST loader/runtime libraries, TARGET CRT/libc/linker-script providers and GCC-private CRT/libgcc/LTO metadata. Link strings remain uninterpreted; no target resolution or host-path access occurs.
Catalog bounds are<=8412 metadata entries/4MiB accounted private map, original span/summary envelope<=4MiB,<=512 candidate records/1MiB encoded selection and<=2MiB final ASCII. Incomplete/inconsistent metadata, unsupported layout or overflow STOPs without a partial catalog. Retain one child/core<=120s including cleanup; source capture<=5s, publication<=5s and authoritative outer130s/tool140s. Start the core only with its full120s plus publication reserve remaining. No extraction, installation, relocation, SDK/Python execution, retry or automatic successor follows. Source/gates/exact registration remain pending.
In parallel, the architect accepts a **separate ELF requirements-v3 API** admitting<=67108864-byte images while retaining all v2 structural/string/version/note/output ceilings and rejection rules. Keep original v1/v2 source, APIs, limits and tests byte-preserved; no widened override or alternate interpretation is added to a consumed profile. This addresses49–52MiB helpers as data, not execution qualification. Recorded lto1 size is47221664 bytes, not147MiB.
After the catalog passes, freeze actual literal members for one batched payload inspection:<=96 ELF images,<=268435456 cumulative captured payload bytes including repeats,<=67108864 per ELF,<=1048576 per selected text and<=8388608 cumulative text within the payload cap. Retain one payload at a time and account parser snapshot copies separately. Freeze members/roles before launch; candidates include actual C compile/link helpers and runtime providers, plus explicit not-selected C++/LTO candidates only where needed for bounded planning. Use complete archive/lifecycle/digest validation before publication. That later batch needs its own source/gates/registration; the catalog authorizes no payload reads automatically.
Only a subsequent separately registered preparation may materialize a fresh exact subset, safe checked aliases and approved strict-text literal relocation with expected hashes/counts, location marker last. Require provider/version closure and reject unresolved dependencies, unsafe loader tags and unapproved searches before preparation. Then qualify actual GCC-driven linking and C compilation independently. Rust1.95 bundles/shipped tools, locked Burn0.22 HOST/TARGET dependencies, build scripts/proc macros and enforceable offline build controls remain separate acceptance gates. These plans grant no Native, reproducible-build, hard-resource or training authority.

### 33.48 ELF requirements-v3 pure profile verified; empirical model evidence still missing

The separate `elf-requirements-v3.mjs` source SHA-256 `3bd878fe2a6de57a2b8252163cdf2a4d3093c6605a903105a9f531f039b84f10` copies the original pinned parser bodies unchanged after SPEC-pointer normalization and appends only new v3 limits/API. Original `elf-metadata.mjs` remains19842/b223a655… byte-for-byte; original and compatibility v1/v2 APIs retain1MiB/4MiB input limits. New v3 alone permits<=67108864 bytes and emits a distinct profile identity; all structural/string/version/note/property/output ceilings and unsafe-backing/lower-only-override rejection remain unchanged. Snapshot allocation is separately bounded, not a hard RSS or concurrency guarantee.
All42 new pure tests and both syntax checks passed. Required source/security reviews accepted this pure unit with no findings; its owner passed pinned-offline check/render. Combined named synthetic/mock/static suites passed2098/2098 across25 suites,0 failures/skips/cancellations/todo. These tests invoked no SDK child, acquisition or Rust executable. Eleven saved-output/selected-receipt conformance checks also passed without rerunning membership observation. No parser/profile/source milestone is committed as a completed Step2.
Backend review confirms fitted-table hydration cannot infer genuine membership or split coverage from aggregated rows or table count. Diagnostic schema permits0..1588 serialized tables while internal owners contain794 cohorts per family. Fractional binary64 counts and existing priors must remain unchanged; omitted cohorts can represent certified emptiness only with independent coverage evidence. Positive hydration must bind exact public rules, counts/cohorts/groups, fitted/partition/calibration evidence and the accepted14400/4800/4800 ancestry split without a training/fitting campaign, fabricated certification or a `passed:true` shortcut. Genuine empirical evidence is not supplied by this work order. Preserve `MissingEvidence` while that gate lacks inputs; do not label that refusal as a finished positive lifecycle.
Architect accepts source preparation for acquiring the five already selected Rust1.95 GNU component archives independently of GNU qualification. Use exact historical URL/length/hash tuples and a fresh exclusive `/tmp/opencode/f9-rust-runtime-inputs-01`; never inspect/reuse/repair the historical failed-acquisition root. Source/gates/registration must precede any GET/write; zero extraction/installation/execution belongs to opaque acquisition. No monolithic Rust bundle or alternate representation was selected by the unsuccessful documentation-fetch attempt. The original five descriptors remain authoritative; this plan renews no historical acquisition packet.

### 33.49 Rust input acquisition source plan — historical identities, fresh custody

The architect accepts a new fixed five-input controller, not execution of the historical packet. Preserve its failed root/first cargo path without further access. The only proposed new destination is exclusive `/tmp/opencode/f9-rust-runtime-inputs-01` with root0700/files0600. Any creation error, including EEXIST, STOPs without probing/reusing/repairing that destination, suffix selection or deletion. Each object's own named/FD identity binds custody; do not require root/file device equality.
Exact input tuples remain [historical §2](native-ingress-host-preparation-m3-xz-acquisition.md#2-independent-frozen-expectations--advertised-is-not-actual), total127772720 bytes:

| Filename under new root; literal URL uses `https://static.rust-lang.org/dist/2026-04-16/` plus this filename | Bytes | SHA-256 |
| --- | ---: | --- |
| `cargo-1.95.0-x86_64-unknown-linux-gnu.tar.xz` | 10984780 | `e74edd2cf7d0f1f1383b4f00eb90c843750bc489e2ccf7214e6476678a907425` |
| `rustc-1.95.0-x86_64-unknown-linux-gnu.tar.xz` | 80351960 | `8426a3d170a5879f5682f5fbdd024a1779b3951e7baba685af2d6dc32a6dfc15` |
| `rust-std-1.95.0-x86_64-unknown-linux-gnu.tar.xz` | 29573972 | `047ea7098803d3500fa1072e9cee5392697e21525559e4458128a2bf874aa382` |
| `rustfmt-1.95.0-x86_64-unknown-linux-gnu.tar.xz` | 2164880 | `f1b2a7301513ffdd95ebf22ebbdd932e4d17fc806f748d93924740d0297b1396` |
| `clippy-1.95.0-x86_64-unknown-linux-gnu.tar.xz` | 4697128 | `ac779bc9839dd47180806b133e4e2563c4a34716284cd5b8fede8ef289f452ca` |

Source must enforce five sequential verified-TLS fixed GETs with exact status/length/encoding/header admission, no redirects/retries/proxy route/alternate bytes or representation. Accept each only after complete response/request closure, incoming hash/length, writer closure, same-inode independent readback/hash/EOF, reader closure and root checks. Root-close failure prevents overall success even after completed prefix records. Retain partial files indefinitely without cleanup/delete/repair/resume. Zero child, decoder, extraction, installer, Rust/SDK or Python execution belongs to this phase.
Freeze600s authoritative operation lifetime including3s cleanup reserve (work ends597s), per-file work ending min(entry+119s, globalWorkEnd), tool capture620s. Bounds: root+one writer/reader<=2 owned FDs,<=11 opens/closes,<=32 named checks/32 FD checks,<=32768 writes/4096 read attempts including5 EOF probes, accepted chunks1..1MiB,<=16384 data events/file/32768 aggregate,<=262144 clock samples, one64KiB readback scratch, headers<=16KiB/64 raw entries and output<=24KiB ASCII. Cleanup attempts owned closes despite exceeded work guards; late callbacks cannot process more payload. These are cooperative ordinary controls, not hard RSS/tree/deadline or zero implicit runtime-I/O proofs.
Source implementation, mock verification, required source/security/spec gates and exact registration remain pending. Successful content matching would establish only these component bytes under the recorded ordinary HTTPS/pin basis. It would not establish installation, selected shipped-tool/helper/lib closure, locked offline Burn source/build-script/proc-macro graph, enforceable build containment, Rust execution, Native/F9, positive empirical model evidence or Step2 completion. Capture/build/runtime remain offline without an acquisition fallback.

### 33.50 Registered one-child subset candidate catalog — metadata discovery only

Register one metadata-only catalog operation using the accepted original archive/root snapshots and complete8412-entry/6891-regular-span expectations. The existing member parser runs once per feed/finalization; its original event arrays/final result return by identity. The adapter passively captures own-data metadata, independently checks decoded SHA5e7f9602… and frozen metadataefe53c8f…, and rejects duplicate/incomplete namespace or inconsistent regular spans. No member payload is captured, parsed as ELF, written, extracted or executed. Only after complete original core/hash/EOF/FD/profile/preload success may selection publish.
Discovery predicates are finite, anchored SDK-root/component matches in `gnu-sdk-subset-catalog.mjs`: named driver/wrapper/binutils families, fixed GCC helper paths/version, enumerated HOST shared-library families and directories, TARGET CRT/libc/linker-script/provider families and GCC-private CRT/libgcc/LTO/specs metadata. Retain raw links uninterpreted; no target lookup or resolution. Deduplicate candidate names with all matched role IDs. Emit CANDIDATES_PRESENT/NO_CANDIDATE_MATCH with roleSatisfied:false; optional C++/LTO candidates remain discovery only. Presence does not satisfy a role, select a member, exclude a manifest reference or establish Python freedom.
Private event metadata<=8412 entries/4MiB; spans and whole internal core-summary envelope<=4MiB; selected candidates<=512/1MiB UTF-8 and escaped ASCII; final envelope<=2MiB. Overflow or inconsistency rejects the entire result without truncation. No full decoded archive is retained or spooled. These are explicit source storage envelopes, not hard heap/RSS or concurrent-caller guarantees.
Adapter16524/SHA-256 `71567d3f2672061f27508d959208a49b1e4d15a7896423e2433a1fbe9ca2ab88`; operation13097/`5b3f19239c6d4e85ed1845bf9cdb0a5ced80d9cb34f2e20474ba6dce94d66fdf`. Retain original raw TAR/ELF/stage/core/v2/v4-helper and Step1 receipt pins. The existing private v4-TAR image15568/56cac49b… links adapter as37293/`ec5da02754e969a157dc87e970bb9bc0dc6fc8a8f0b819f2571fd88632c06ed3`; the existing metadata core23264/ac4aba7a… links that same adapter instance as72997/`c3c2e66d342ecd8a84ffd78ca5b2ce8f9cf5916501847d740924a5b622f73af0`. Verify all raw/intermediate/linked images before captured data-URL import. No old physical helper operation is called, and no mutable executed source path is reopened.
One existing staged XZ child, two complete compressed hash/EOF passes204592560 data bytes/204592562 requested bytes,2 positive archive/root closes and2 staged/preload checks remain. Source capture<=5s, existing core<=120s including3s cleanup and publication<=5s fit an authoritative130s outer/tool140s envelope; start the core only with its full120s plus5s publication reserve remaining. Keep every existing decoder/TAR/resource bound. No retry, second child, payload inspection, extraction, relocation, installation, SDK/Python execution, networking or retained-file deletion occurs. Discovery does not complete Step2 or qualify Native/Rust/training.
Parent verification passes132 pure/mock/static catalog checks (99 adapter/33 operation), all four syntax checks and frozen-source checks. No live catalog occurred. Required source/security/spec gates, offline diagram validation and exact launcher/section registration precede its one invocation.

<!-- BEGIN GNU SDK SUBSET CATALOG V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/gnu-sdk-subset-catalog-operation.mjs');
if (source.length !== 13097 || createHash('sha256').update(source).digest('hex') !== '5b3f19239c6d4e85ed1845bf9cdb0a5ced80d9cb34f2e20474ba6dce94d66fdf') throw new Error('E_SOURCE_PIN');
const operation = await import('data:text/javascript;base64,' + source.toString('base64'));
const result = await operation.runRegisteredGnuSdkSubsetCatalog();
process.exitCode = result.exitCode;
process.stdout.on('error', () => { process.exitCode = 1; });
process.stdout.write(result.text);
NODE
```
<!-- END GNU SDK SUBSET CATALOG V1 -->

Required quality/security source gates accept only this exact one-child metadata-catalog scope with no findings; spec correspondence is in-sync. Its owner passes pinned-offline check/render. Launcher721/SHA-256 `56f4dc34ba00970602308ad7b91507e0aec0eafa4547255a7f18d3abaf2e5b86` passes syntax-only parsing without invoking the operation. Register the complete current section before its one physical use. No payload selection, extraction, relocation, SDK execution or Step2 completion follows automatically.

### 33.51 Registered opaque Rust component acquisition — no installation or execution

Register one new acquisition invocation for the exact five dated URL/name/length/SHA tuples in §33.49, into **only** exclusive `/tmp/opencode/f9-rust-runtime-inputs-01`. This new operation does not touch or renew the historical failed packet/root, any Rust installation, cache, Cargo source or build directory. EEXIST/creation error STOPs without inspecting/reusing/repairing that destination or selecting another root. Retain every partial object; no delete/resume/retry/redirect/mirror/alternate compression/version/helper occurs.
Helper22259/SHA-256 `b59e0ab22f10acefbeef5aca69205f189145b06ec290eb4415fd84a2814042a7`; operation4226/`ab121f3fe4ca5700e847d30358e5efd86f3c72a7b0d2019402d3a0ca914ce06d`. Launcher captures/checks the exact operation; it captures/checks helper bytes and imports only that private data URL before one fixed acquisition call. No mutable pathname is reopened for execution. Helper imports only Node fs/https/crypto/util. Ordinary Node bootstrap, default verified TLS/CA/resolver and same-UID/ancestor behavior remain explicit residuals, not authenticated Native loading.
The helper enforces §33.49 custody/header/byte/hash/readback/EOF/close/counter/time bounds. Five fixed sequential GETs/zero children admit only exact archive bytes totaling127772720. Root/file device numbers remain independent; each object's own named/FD identity and security fields must match. File size/timestamps may change only through controlled writes; independently read back the same completed file after writer closure. All11 owned close attempts must succeed before overall RUST_INPUT_BYTES_MATCHED. Completed prefix records can remain when overall STOP; close failure is absorbing and no new open follows it.
The600s authoritative helper lifetime includes3s reserved cleanup, per-file work<=119s within global597s work end. The operation's source capture/import must complete within3s before acquisition; outer tool capture620s does not assert hard interruption. Output<=24KiB ASCII JSONLF; source counters distinguish attempted versus completed operations and positive returned I/O bytes. Partial I/O/counter uncertainty stays labeled rather than reporting zero effects. No fsync/durability, immutable path or process-tree/RSS guarantee follows.
No decoder, TAR parse, extraction, installer, Rust/SDK/Python program, build script, proc macro, training/activation or dependency acquisition belongs to this opaque archive acquisition. Capture/build/runtime remain offline without acquisition fallback. Rust component byte matches would not qualify their installed/tool/runtime/helper/loader closure, selected locked Burn graph, hard build containment, F9/whole-BOTH or Step2 completion.
Parent verification passes92 mock/static checks, all three syntax checks and fixed descriptor/source pin checks. Successful mock controllers remain STOP/E_MOCK_ONLY and cannot produce a production match. The combined catalog/acquisition suite passes224/224 checks,0 failures/skips/cancellations/todo. No root or network acquisition occurred in tests. Required source/security/spec gates, offline diagram validation and exact launcher/section identity precede the one live invocation.
The required quality gate found two MEDIUM unsafe-backing omissions before execution: resizable ArrayBuffer-backed incoming chunks and matching pinned source bytes were not rejected. Both paths now use the captured intrinsic resizable getter before admission/copy. Two new regressions reject such inputs with zero admitted payload/write effects or source import. The repaired94-case mock/static suite and all three syntax checks pass. Earlier unexecuted helper22054/c4a4bc1f… and operation4078/392f6044… identities are superseded, not consumed live-operation evidence.

<!-- BEGIN RUST RUNTIME INPUT ACQUISITION V1 -->
```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const source = fs.readFileSync('/tmp/opencode/f9-bootstrap-correspondence/tooling/native-ingress/rust-runtime-input-acquisition-operation.mjs');
if (source.length !== 4226 || createHash('sha256').update(source).digest('hex') !== 'ab121f3fe4ca5700e847d30358e5efd86f3c72a7b0d2019402d3a0ca914ce06d') throw new Error('E_SOURCE_PIN');
const operation = await import('data:text/javascript;base64,' + source.toString('base64'));
const result = await operation.runRegisteredRustRuntimeInputAcquisition();
process.exitCode = result.exitCode;
process.stdout.on('error', () => { process.exitCode = 1; });
process.stdout.write(result.text);
NODE
```
<!-- END RUST RUNTIME INPUT ACQUISITION V1 -->

Required quality review closes both resizable-backing MEDIUMs in the repaired source; security accepted the unchanged fixed-input opaque-custody boundary with no findings and spec correspondence is in-sync. Its owner passes pinned-offline check/render. Repaired launcher736/SHA-256 `8a34e4c28e2c3aa7b148f3d48cc46427306d98a35146f669a5bb0c22e43cf18e` passes syntax-only parsing without invocation. Register complete current-section identity before its one live use. No extraction, installation, decoder/Rust execution, build fallback or Step2 completion follows automatically.

### 33.52 Independent work audit strengthens the open affordability HIGH

Read-only backend invoice audit confirms the old direct-banded readout formula223312+152P+64C+32W and cache-hit328. It independently derives a **lower bound1067696** for the prospective BOTH-window fixture—19120 above1048576 before omitted ledger validation/canonicalization/copy work, fused prefixes, spatial work and feature internals. Disjoint lower-bound blocks are121040 F1 feature-parts/innovation,63936 opening compact posteriors,101752 settlement reconstruction tails,476416 two cold readouts,151216 fixed charges for26 Marine compiler calls,113184 other belief fixed work and40152 batch/flatten wrappers. This is a static source refusal bound, not a measured Rust execution. The functional HIGH remains open; do not present the existing prospective test as a positive witness.
Architect accepts a separate exact fixed-point zero-run readout design that actually eliminates arithmetic. Preserve all old readout/priced function bodies and invoices. Validate sorted strictly positive sparse cells before inferring absent cells are+0; process canonical positives and zero intervals. Execute the existing paired Kahan zero transition, comparing all four sum/compensation bit patterns before/after. Only a bitwise fixed point permits skipping the remaining **known-zero** interval; otherwise continue until convergence, exhaustion or budget refusal. Charge new scheduling/bit comparisons/branches and each actually executed transition before work. No assumed1/2-step convergence, support truncation, refunds, clone/reset or old-fee discounts apply.
This source design still requires independent full-lattice bitwise oracle tests, budget/failure tests, invoice audit and qualified Rust whole-window execution. It changes neither F1/labels/gas nor the Marine compiler. Do not close the HIGH or claim universal savings/affordability from the proof idea or unrun test source.

### 33.53 Zero-run source reviewed — old refusal bound no longer proves the new path

New `readout_sparse_runs_copy` and `readout_banded_runs_copy` implement the accepted exact fixed-point test while preserving old full-lattice functions/prices and all original tests. Production belief readout changes only its import/call. Each known-zero interval executes paired+0 compensated additions until all four sum/compensation bit patterns remain equal or the interval/budget ends; only then can it omit the deterministic fixed-point suffix. All sparse positives are validated before absence implies+0. Positive arithmetic order, tempering, marginals/quantiles and support certainty remain unchanged.
Independent source audit derives new-only sparse invoice42984+180P+32R+40V and banded invoice43304+192P+64C+32W+32R+40V, including unchanged charged sparse extraction. R counts nonempty zero intervals and V actually executed paired zero transitions; no uncharged pilot determines V. The audit found no new underbilling or fixed-point proof defect. For the prior P51/C25/W56 fixture with four intervals per seat, the previous disjoint lower bound becomes712016+40(Vw+Vb), **not** the previous1067696 numeric impossibility bound. Enclosing cold-readout overhead7504 and every previously omitted ledger/Marine/fused/feature charge still remain additional. No complete new invoice or executed affordability result is claimed.
New tests append independent full7501-visit oracles, bitwise distributions/temperature/subnormal/boundary checks, signed-zero accumulator/fallback cases, validation, exact/one-short work and immutable input/prefix assertions. All remain uncompiled/unrun. Quality review keeps the functional HIGH open; its LOW function-placement finding is addressed by moving only the new functions before existing test modules without changing their bodies or old tests. No universal savings or Step5 acceptance follows this revision.

### 33.54 Rust input bytes matched — fresh acquisition consumed, no Rust execution

Section230651/SHA-256 `9eb9588225c3bc6cae837a4bc1f38da4aeee9267549c291bc5fba9c273fd199a` bound launcher736/`8a34e4c28e2c3aa7b148f3d48cc46427306d98a35146f669a5bb0c22e43cf18e` and operation4226/`ab121f3fe4ca5700e847d30358e5efd86f3c72a7b0d2019402d3a0ca914ce06d`, with repaired helper22259/b59e0ab2… . The exact invocation returned RUST_INPUT_BYTES_MATCHED for all five dated component archives. Both incoming and independent same-inode readback hashes/lengths matched the fixed expectations for every input, totaling127772720 bytes in each direction.
Counters report5 GETs,7999 admitted data/write events,1958 read attempts including all5 EOF probes,32 named checks,32 FD checks,11 opens/positive closes and peak2 owned FDs. No close failure or cleanup uncertainty occurred; completed-I/O accounting is true. All four archive/installation/Rust-execution claims remain false: no decoder, TAR parser, installer, Rust/SDK/Python program or build child ran. These are ordinary HTTPS/custody observations, not Native/hard-resource/durable-storage qualification.
Persist selected evidence and all five exact final file identities in [`rust-runtime-inputs.receipt.json`](../tooling/native-ingress/rust-runtime-inputs.receipt.json), explicitly a parent transcription. New root `/tmp/opencode/f9-rust-runtime-inputs-01` is DEV28/INO13954/mode0700/UID1000; all five regular files are independently DEV29/INOs1211150,1211151,1211153,1211154,1211155/mode0600. Their exact final nine-field identities bind any future registered archive read. Preserve this root/files unchanged; the exclusive acquisition is consumed and cannot be rerun, repaired, resumed or deleted under this operation. The older failed root was never accessed.
Step2 remains incomplete. Next qualify the Rust archives' data-only member/dependency/layout evidence under a new bounded operation before any extraction/install/script or executable use. Preserve the five exact hashes/representation/version; do not substitute a monolithic bundle, rustup/mise route or another target. Complete compiler/runtime closure, offline locked Burn sources/build scripts/proc macros, enforceable build context, actual Rust runs, positive empirical artifact evidence and F9/whole-BOTH gates remain pending. No partial remaining step is committed/pushed as complete.

### 33.55 Subset candidate catalog observed — actual names, no selected/executable subset yet

Section230075/SHA-256 `4c8642143f27416ae5e670340112fe77971ea15e48c5cf05cab3a5f63c46ef48` bound launcher721/`56f4dc34ba00970602308ad7b91507e0aec0eafa4547255a7f18d3abaf2e5b86` and operation13097/`5b3f19239c6d4e85ed1845bf9cdb0a5ced80d9cb34f2e20474ba6dce94d66fdf`. The exact one-child operation returned SUBSET_CANDIDATE_CATALOG after complete namespace/hash/EOF/FD/profile acceptance. All8412 entries and6891 regular spans matched their frozen evidence;96 candidates matched the registered finite predicate union. Every role reports roleSatisfied:false. GCC_SPECS_TEXT had NO_CANDIDATE_MATCH; this is not a claim about built-in GCC specs or global filesystem absence.
Persist all96 candidate indexes and selected literal regular-span metadata in [`gnu-sdk-subset-catalog.receipt.json`](../tooling/native-ingress/gnu-sdk-subset-catalog.receipt.json), explicitly a parent transcription/data observation—not member-selection or extraction authority. The catalog distinguishes actual SDK host libraries, target sysroot/linker-script/CRT inputs, aliases and optional C++/LTO candidates. Link strings were reported without interpretation or target resolution. The root HOST `lib` has selected GMP/MPFR/MPC/zlib/expat/ncurses providers, but no discovered HOST libc/loader candidate; TARGET libc/loader observations must not silently become HOST providers without separate ABI/usability qualification.
The core completed204592560 compressed data bytes/204592562 requested bytes,2 positive archive/root closes and2 staged/preload gates. The complete decoded505333760-byte stream matched independent5e7f9602… and frozen metadataefe53c8f…; packet diagnostics49313 stdout events/zero stderr are observations, not syscall bounds. No candidate payload, ELF, SDK program, Python, archive entry extraction, rewrite, installation, networking or retained-file deletion belonged to this catalog operation.
Next freeze an explicit literal member/role profile from the observed candidates for the already planned bounded payload batch, separately distinguishing ELF executables/shared libraries, relocatable CRT objects, archives and strict linker-script text. The ELF requirements-v3 API covers only its accepted ELF kinds; never reinterpret a non-ELF linker script/static archive or unsupported relocatable object as a shared library. Preserve the legacy190 manifest dispositions and all unresolved38 absences. The catalog is consumed and grants no automatic repeat, payload reader, preparer, linker resolution, Native qualification or Step2 completion.

### 33.56 Current verification checkpoint — remaining steps not complete

Parent verification passes2324/2324 named synthetic/mock/static Node checks across28 suites,66 native-ingress syntax targets and `git diff --check`, with0 failures/skips/cancellations/todo. This command reran no consumed acquisition/decoder operation and invoked no Rust executable. Selected Rust-input and candidate-catalog transcriptions pass source-contract consistency checks, including exact five input tuples, readback digests/counts,96 unique candidate indexes and45 retained regular-span observations. These checks do not authenticate a transcript or qualify any candidate for execution.
The two original numeric primitive files retain all HEAD function/fee/private-test bodies byte-for-byte; new zero-run production functions now precede test modules. Independent source review closes their placement LOW and finds no new fixed-point/invoice defect. The functional HIGH remains open pending actual compiled oracle/budget/whole-BOTH verification and a complete invoice including omitted work. Current source test assertions are not passing runtime evidence.
Spec reconciliation corrects12 stale consumed-operation status headers without changing source/API/test bytes or coverage. The13 affected SDK/Rust-input/zero-run owners pass current pinned-offline check/render with no remote include fetch. Their statuses distinguish failed profiles, accepted data observations and unqualified runtime/source work. Unrelated unresolved/empty coverage entries remain unchanged.
Published verified Step1 remains2a64037d; PR50 stays unmerged. All later infrastructure, Rust source/tests and receipts remain uncommitted because Step2 and later steps have not met acceptance. No empirical collection/fitting/calibration/policy-training campaign, activation/deployment, retained-data deletion, allowance reset/refund/split, TS engine/legacy consumer or dataset/label mutation occurred. Preserve Rust1.95/Burn0.22/FlexCPU-f64 features and every original F9/resource/acceptance gate. Next work is literal SDK payload/dependency inspection, bounded Rust archive layout qualification and enforceable offline build/source closure—not an unapproved execution shortcut.

### 33.57 Explicit WIP publication request — no training-readiness waiver

The user now requests `commit & push, output remaining steps and if any repairs are required to begin training`. This explicitly authorizes publishing the current prepared snapshot as WIP, superseding the earlier no-partial-publication rule **for this snapshot only**. It does not mark any remaining step complete, merge PR50, authorize empirical collection/fitting/calibration/policy training or activation/deployment, or waive any blocked verification/review gate. Keep the current source branch and non-force push to its existing origin branch.
Remaining accepted sequence: (2) qualify the Python-free GNU/Rust executable/runtime/sysroot subset, complete locked offline source/build-script/proc-macro and enforceable build context; (3) run frozen Rust formatting/check/Clippy/focused tests plus affected arena/TS verification; (4) close frozen F9 numeric-B/source-invoice/loading/custody/original-clock/resource/EOF-reap obligations; (5) finish and verify shared418/belief parity and one inclusive BOTH-window budget, genuine fitted-economic hydration/admission, strict publication/storage confirmation and complete interrupted-versus-uninterrupted resume closure. Step1's ordinary XZ profile alone remains accepted.
Training still requires repairs and evidence: current Rust source/tests remain uncompiled/unrun; the zero-run replacement has source-level proof/invoice review but no executed whole-window witness; fitted inference intentionally returns MissingEvidence; actual artifact store/publication/durability and complete resume support are missing. Validate the24000 ancestry-group gate with14400/4800/4800 split and estimator/calibration acceptance before policy training. Preserve raw D+B labels, separate ledgers, settlement gas0, scalar zero-init/no-bias semantics and the unmodified1048576 shared allowance; do not bypass missing evidence with defaults, a second meter or synthetic-model activation.
Publication verification may rerun only the named synthetic/mock/static Node suites and syntax/diff checks, not any consumed acquisition/decoder or unqualified Rust tool. Report those passing checks separately from unavailable Rust/runtime verification. The WIP commit must preserve all source/profile/STOP variants and retained-data receipts, and must not claim Upgrade Complete or trainingReady:true.
