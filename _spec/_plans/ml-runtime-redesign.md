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
