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
