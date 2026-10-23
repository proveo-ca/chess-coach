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
