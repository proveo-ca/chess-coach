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
